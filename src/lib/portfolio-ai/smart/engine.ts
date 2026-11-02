/**
 * Smart Mode answer engine (PIE spec §6): deterministic, source-backed answers over the approved
 * knowledge manifest. No model, no network, no WebGPU.
 *
 * Pipeline: guard (length) → language → concept routing (refusals first) → entity/follow-up
 * resolution → approved templates filled with verbatim record text → evidence + allowlisted
 * links. Open-ended questions fall back to lexical retrieval with a coverage threshold; below it
 * the engine abstains. The same routing tells Local AI whether generation is allowed at all.
 */
import type {
  Answer,
  AnswerStatus,
  Evidence,
  KnowledgeManifest,
  KnowledgeRecord,
  LinkTarget,
  SafeTurn,
} from '../shared/types';
import { canonicalHref } from '../shared/links';
import { contentTokens, detectLanguage, tokenize } from '../retrieval/normalize';
import {
  hasConcept,
  matchAlias,
  matchConcepts,
  prepare,
  techTerms,
  type ConceptId,
  type QueryTokens,
} from '../retrieval/concepts';
import { KnowledgeIndex, type Hit } from '../retrieval/search-index';
import { ASSISTANT_AR, SUGGESTIONS, T, type Lang } from './templates';

export const MAX_QUESTION_CHARS = 500;
export const MAX_HISTORY_TURNS = 6;

/** Retrieval threshold: share of the question's content words a hit must cover. Tuned on the golden set. */
export const MIN_COVERAGE = 0.5;

type SectionStatus = Exclude<AnswerStatus, 'error'>;

interface Section {
  text: string;
  records: string[];
  links: string[];
  status: SectionStatus;
}

/** Why Local AI may or may not generate for this question. */
export type Grounding = 'evidence' | 'blocked' | 'none';

export interface SmartAnswer extends Answer {
  mode: 'smart';
  /** Unique entity for follow-ups ("project-tibyn", "topic:contact"). */
  entity?: string;
  grounding: Grounding;
  /** Records behind the answer, in citation order (Local AI reuses them as its evidence). */
  records: KnowledgeRecord[];
  manifestVersion: string;
}

const STATUS_RANK: Record<SectionStatus, number> = {
  answered: 0,
  partial: 1,
  'insufficient-evidence': 2,
  refused: 3,
};

const TOPIC_ORDER = [
  'contact',
  'resume',
  'reel',
  'projects',
  'stack',
  'experience',
  'education',
  'availability',
  'overview',
  'portfolio',
  'location',
] as const;
type Topic = (typeof TOPIC_ORDER)[number];

const REFUSALS: ReadonlyArray<readonly [ConceptId, keyof typeof T]> = [
  ['injection', 'injection'],
  ['secrets', 'confidential'],
  ['confidential', 'confidential'],
  ['compensation', 'compensation'],
  ['personal', 'personal'],
];

const PERSON_REF = new Set(['he', 'him', 'his', 'islam', 'abd', 'elhady', 'abdelhady', 'اسلام', 'هو']);

export class SmartEngine {
  readonly version: string;
  readonly index: KnowledgeIndex;
  private readonly links: Map<string, LinkTarget>;
  private readonly projects: LinkTarget[];

  constructor(manifest: KnowledgeManifest) {
    this.version = manifest.version;
    this.index = new KnowledgeIndex(manifest);
    this.links = new Map(manifest.links.map((l) => [l.id, l]));
    this.projects = manifest.links.filter((l) => l.id.startsWith('project-'));
  }

  private rec(id: string): KnowledgeRecord | undefined {
    return this.index.records.get(id);
  }

  /** Link ids for a record's public URL (only if allowlisted). */
  private linkForRecord(r: KnowledgeRecord): string | undefined {
    if (!r.publicUrl) return undefined;
    const want = canonicalHref(r.publicUrl);
    for (const l of this.links.values()) if (canonicalHref(l.href) === want) return l.id;
    return undefined;
  }

  answer(rawQuestion: string, history: readonly SafeTurn[] = []): SmartAnswer {
    const question = rawQuestion.slice(0, MAX_QUESTION_CHARS).trim();
    const lang: Lang = detectLanguage(question);
    const tokens = tokenize(question);
    if (tokens.length === 0)
      return this.build(
        lang,
        'empty',
        [{ text: T.empty(lang), records: [], links: [], status: 'insufficient-evidence' }],
        'none',
      );

    const q = prepare(tokens);
    const concepts = matchConcepts(q);
    const prev = history.slice(-MAX_HISTORY_TURNS).at(-1);

    // 1. Refusals and blocked requests come first, whatever else the question contains.
    for (const [concept, template] of REFUSALS) {
      if (!concepts.has(concept)) continue;
      const links = concept === 'compensation' || concept === 'personal' ? this.contactLinks() : [];
      const text = (T[template] as (l: Lang) => string)(lang);
      return this.build(
        lang,
        `refuse:${concept}`,
        [{ text, records: [], links, status: 'refused' }],
        'blocked',
        undefined,
        ['contact', 'overview'],
      );
    }

    // 2. A named project.
    const project = this.projects.find((p) => p.aliases && matchAlias(q, p.aliases));
    if (project) return this.projectAnswer(lang, project);

    // 3. Follow-ups that need a referent ("how was it built?", "that project", "tell me more").
    const topics = this.topics(q, concepts);
    const wantsReferent =
      concepts.has('howBuilt') || (concepts.has('followRef') && !concepts.has('assertion'));
    if (wantsReferent && !topics.some((t) => t !== 'projects' && t !== 'stack' && t !== 'overview')) {
      const ref = prev?.entity;
      const refProject = ref ? this.links.get(ref) : undefined;
      if (refProject && refProject.id.startsWith('project-')) return this.projectAnswer(lang, refProject);
      if (concepts.has('howBuilt') || (hasConcept(q, 'followRef') && concepts.has('projectsNoun')))
        return this.clarifyProject(lang);
      if (ref?.startsWith('topic:')) return this.more(lang, ref);
      return this.clarifyProject(lang);
    }
    if (concepts.has('followMore') && topics.length === 0 && !prev?.entity) {
      const text = T.clarifyGeneric(lang);
      return this.build(
        lang,
        'clarify',
        [{ text, records: [], links: [], status: 'insufficient-evidence' }],
        'none',
        undefined,
        ['overview', 'projects', 'contact'],
      );
    }
    if (concepts.has('followMore') && topics.length === 0 && prev?.entity) {
      const ref = prev.entity;
      const refProject = this.links.get(ref);
      if (refProject?.id.startsWith('project-')) return this.projectAnswer(lang, refProject);
      return this.more(lang, ref);
    }

    // 4. Questions about the assistant itself.
    if (concepts.has('privacy')) return this.faq(lang, 'faq-assistant-privacy', 'assistant:privacy');
    if (concepts.has('sources')) return this.faq(lang, 'faq-assistant-sources', 'assistant:sources');
    if (concepts.has('assistant')) return this.faq(lang, 'faq-assistant-modes', 'assistant:modes');
    if (concepts.has('contentStatus')) return this.contentStatus(lang);

    // 5. Assertions to confirm ("prove he…", "…, right?").
    if (concepts.has('assertion')) {
      const claim = this.checkClaim(lang, question, q);
      if (claim) return claim;
    }

    // 6. Portfolio topics (at most two sections).
    if (topics.length > 0) {
      const sections = topics.slice(0, 2).map((t) => this.topic(lang, t, q, concepts));
      const entity = topics.length === 1 ? `topic:${topics[0]}` : undefined;
      return this.build(
        lang,
        `topic:${topics.slice(0, 2).join('+')}`,
        sections,
        'evidence',
        entity,
        this.suggestFor(topics[0]!),
      );
    }

    // 7. Small talk.
    if (concepts.has('greeting'))
      return this.build(
        lang,
        'greeting',
        [{ text: T.greeting(lang), records: [], links: [], status: 'answered' }],
        'none',
        undefined,
        ['overview', 'projects', 'contact'],
      );
    if (concepts.has('thanks'))
      return this.build(
        lang,
        'thanks',
        [{ text: T.thanks(lang), records: [], links: [], status: 'answered' }],
        'none',
        undefined,
        ['overview', 'contact'],
      );

    // 8. Clearly unrelated requests.
    const aboutHim = tokens.some((t) => PERSON_REF.has(t));
    if (concepts.has('outOfScope') && !aboutHim) {
      return this.build(
        lang,
        'out-of-scope',
        [{ text: T.outOfScope(lang), records: [], links: [], status: 'refused' }],
        'blocked',
        undefined,
        ['overview', 'projects'],
      );
    }

    // 9. Open-ended: lexical retrieval with a coverage threshold, else abstain.
    return this.search(lang, question);
  }

  /**
   * Evidence for Local AI (spec §7 "Retrieval and context budget"): the records behind the Smart
   * answer first, then other strong lexical hits, deduplicated, at most `max`, E-numbered.
   */
  evidenceFor(question: string, smart: SmartAnswer, max = 5): Evidence[] {
    const records = [...smart.records];
    for (const hit of this.index.query(question, 6)) {
      if (records.length >= max) break;
      if (hit.coverage >= MIN_COVERAGE && !records.some((r) => r.id === hit.record.id))
        records.push(hit.record);
    }
    return records.slice(0, max).map((r, i) => ({
      id: `E${i + 1}`,
      title: r.title,
      snippet: r.publicText,
      ...(r.publicUrl ? { url: r.publicUrl } : {}),
      recordId: r.id,
    }));
  }

  get allLinks(): LinkTarget[] {
    return [...this.links.values()];
  }

  // ───────────────────────── routing helpers ─────────────────────────

  private topics(q: QueryTokens, c: Set<ConceptId>): Topic[] {
    const tech = techTerms(q);
    const out = new Set<Topic>();
    if (c.has('contact') || c.has('email') || c.has('linkedin') || c.has('github')) out.add('contact');
    if (c.has('resume')) out.add('resume');
    if (c.has('reel')) out.add('reel');
    if (c.has('projectsNoun')) out.add('projects');
    if (c.has('stack')) out.add('stack');
    if (c.has('experience')) out.add('experience');
    if (c.has('education')) out.add('education');
    if (c.has('availability')) out.add('availability');
    if (c.has('overview')) out.add('overview');
    if (c.has('portfolio')) out.add('portfolio');
    if (c.has('location') && out.size === 0) out.add('location');
    // A technology name is a skills question on its own ("FastAPI?") and a second section next to
    // projects or experience ("which projects involved multi-agent systems?").
    if (tech.length > 0 && (out.size === 0 || out.has('projects') || out.has('experience'))) out.add('stack');
    // Overview cues are weak next to a specific topic ("tell me about his projects").
    if (out.size > 1) out.delete('overview');
    return TOPIC_ORDER.filter((t) => out.has(t));
  }

  private topic(lang: Lang, t: Topic, q: QueryTokens, c: Set<ConceptId>): Section {
    switch (t) {
      case 'contact':
        return this.contactSection(lang, c);
      case 'resume': {
        const r = this.rec('contact-resume');
        return r
          ? {
              text: T.resume(lang, r.publicText),
              records: [r.id],
              links: ['route-resume'],
              status: 'answered',
            }
          : this.missing(lang);
      }
      case 'reel': {
        const r = this.rec('media-reel');
        return r
          ? {
              text: T.reel(lang, r.publicText),
              records: [r.id],
              links: ['section-identity', 'route-about'],
              status: 'answered',
            }
          : this.missing(lang);
      }
      case 'projects':
        return this.projectsSection(lang);
      case 'stack':
        return this.stackSection(lang, q);
      case 'experience': {
        const heading = this.rec('profile-journey-heading');
        const status = this.rec('site-content-status');
        const parts = [T.experiencePending(lang)];
        if (heading) parts.push(T.journeyHeading(lang, heading.publicText));
        return {
          text: parts.join(' '),
          records: [heading?.id, status?.id].filter((x): x is string => Boolean(x)),
          links: ['section-experience', 'route-resume'],
          status: heading || status ? 'partial' : 'insufficient-evidence',
        };
      }
      case 'education':
        return {
          text: T.educationMissing(lang),
          records: [],
          links: ['route-resume', 'route-contact'],
          status: 'insufficient-evidence',
        };
      case 'availability': {
        const inv = this.rec('contact-invitation');
        const parts = [T.availabilityUnverified(lang)];
        if (inv) parts.push(T.contactInvitation(lang, inv.publicText));
        return {
          text: parts.join(' '),
          records: inv ? [inv.id] : [],
          links: this.contactLinks(),
          status: inv ? 'partial' : 'insufficient-evidence',
        };
      }
      case 'overview':
        return this.overviewSection(lang);
      case 'portfolio': {
        const r = this.rec('profile-portfolio');
        return r
          ? {
              text: T.portfolio(lang, r.publicText),
              records: [r.id],
              links: ['section-universe'],
              status: 'answered',
            }
          : this.missing(lang);
      }
      case 'location':
        return {
          text: T.locationMissing(lang),
          records: [],
          links: this.contactLinks(),
          status: 'insufficient-evidence',
        };
    }
  }

  private missing(lang: Lang): Section {
    return {
      text: T.noEvidence(lang),
      records: [],
      links: ['route-projects', 'route-contact'],
      status: 'insufficient-evidence',
    };
  }

  private overviewSection(lang: Lang): Section {
    const role = this.rec('profile-role');
    const statement = this.rec('profile-statement');
    if (!role && !statement) return this.missing(lang);
    const parts: string[] = [];
    const lead = T.overviewLead(lang);
    if (lead) parts.push(lead);
    if (role) parts.push(lang === 'ar' ? T.quote(lang, role.publicText) : role.publicText);
    if (statement) parts.push(T.inHisWords(lang, statement.publicText));
    return {
      text: parts.join(' '),
      records: [role?.id, statement?.id].filter((x): x is string => Boolean(x)),
      links: ['route-about', 'section-identity'],
      status: 'answered',
    };
  }

  private contactSection(lang: Lang, c: Set<ConceptId>): Section {
    const email = this.rec('contact-email');
    const linkedin = this.rec('contact-linkedin');
    const github = this.rec('contact-github');
    const emailAddr = email?.publicUrl?.replace(/^mailto:/, '');
    const only = (['email', 'linkedin', 'github'] as const).filter((k) => c.has(k));
    if (only.length === 1 && !c.has('contact')) {
      const k = only[0]!;
      if (k === 'email' && email && emailAddr)
        return {
          text: T.emailOnly(lang, emailAddr),
          records: [email.id],
          links: ['contact-email'],
          status: 'answered',
        };
      const r = k === 'linkedin' ? linkedin : k === 'github' ? github : undefined;
      if (r?.publicUrl)
        return {
          text: T.profileOnly(lang, r.title, r.publicUrl),
          records: [r.id],
          links: [`profile-${k}`],
          status: 'answered',
        };
      return this.missing(lang);
    }
    const profiles = [linkedin, github].filter((r): r is KnowledgeRecord => Boolean(r));
    if (!email && profiles.length === 0) return this.missing(lang);
    const parts: string[] = [];
    if (lang === 'ar') {
      parts.push(T.contactLead(lang));
      if (emailAddr) parts.push(T.contactEmail(lang, emailAddr));
      if (profiles.length)
        parts.push(
          T.contactProfiles(
            lang,
            profiles.map((p) => p.title),
          ),
        );
    } else {
      const bits = [T.contactLead(lang)];
      if (emailAddr) bits.push(T.contactEmail(lang, emailAddr));
      if (profiles.length)
        bits.push(
          T.contactProfiles(
            lang,
            profiles.map((p) => p.title),
          ),
        );
      else bits[bits.length - 1] += '.';
      parts.push(bits.join(' '));
    }
    const inv = c.has('contact') ? this.rec('contact-invitation') : undefined;
    if (inv) parts.push(T.contactInvitation(lang, inv.publicText));
    return {
      text: parts.join(lang === 'ar' ? '\n' : ' '),
      records: [email?.id, ...profiles.map((p) => p.id), inv?.id].filter((x): x is string => Boolean(x)),
      links: this.contactLinks(),
      status: 'answered',
    };
  }

  private contactLinks(): string[] {
    return ['contact-email', 'profile-linkedin', 'profile-github', 'route-contact'].filter((id) =>
      this.links.has(id),
    );
  }

  private projectsSection(lang: Lang): Section {
    const approved = this.projects
      .map((p) => this.projectRecord(p))
      .filter((r): r is KnowledgeRecord => Boolean(r));
    if (approved.length > 0) {
      return {
        text: approved.map((r) => T.projectApproved(lang, r.title, r.publicText)).join('\n'),
        records: approved.map((r) => r.id),
        links: [
          'route-projects',
          ...approved.map((r) => this.linkForRecord(r)).filter((x): x is string => Boolean(x)),
        ],
        status: approved.length === this.projects.length ? 'answered' : 'partial',
      };
    }
    const status = this.rec('site-content-status');
    return {
      text: T.projectsPending(lang),
      records: status ? [status.id] : [],
      links: ['route-projects', ...this.projects.map((p) => p.id)],
      status: 'partial',
    };
  }

  private projectRecord(link: LinkTarget): KnowledgeRecord | undefined {
    const slug = link.id.replace(/^project-/, '');
    return this.rec(`project-${slug}`) ?? this.rec(`case-study-${slug}`);
  }

  private projectAnswer(lang: Lang, link: LinkTarget): SmartAnswer {
    const r = this.projectRecord(link);
    const status = this.rec('site-content-status');
    const section: Section = r
      ? {
          text: T.projectApproved(lang, link.label, r.publicText),
          records: [r.id],
          links: [link.id],
          status: 'answered',
        }
      : {
          text: T.projectPending(lang, link.label),
          records: status ? [status.id] : [],
          links: [link.id, 'route-projects'],
          status: 'partial',
        };
    return this.build(lang, `project:${link.id}`, [section], 'evidence', link.id, ['projects', 'contact']);
  }

  private stackSection(lang: Lang, q: QueryTokens): Section {
    const terms = techTerms(q);
    const heading = this.rec('profile-capabilities-heading');
    const statement = this.rec('profile-statement');
    if (terms.length > 0) {
      const supported: string[] = [];
      const unsupported: string[] = [];
      const recs = new Map<string, KnowledgeRecord>();
      for (const term of terms) {
        const found = this.index.mentions(term);
        if (found.length) {
          supported.push(term);
          for (const r of found) recs.set(r.id, r);
        } else unsupported.push(term);
      }
      const display = (t: string) => DISPLAY_TERMS[t] ?? t;
      const parts: string[] = [];
      const quoteRec = [...recs.values()].find((r) => r.type === 'profile') ?? [...recs.values()][0];
      if (supported.length && quoteRec)
        parts.push(T.techMentioned(lang, supported.map(display), quoteRec.publicText));
      if (unsupported.length) parts.push(T.techUnconfirmed(lang, unsupported.map(display)));
      return {
        text: parts.join(' '),
        records: quoteRec && supported.length ? [quoteRec.id] : [],
        links: ['section-capabilities', 'route-projects'],
        status:
          unsupported.length === 0 ? 'answered' : supported.length ? 'partial' : 'insufficient-evidence',
      };
    }
    const parts = [T.skillsPending(lang)];
    if (heading) parts.push(T.capabilitiesHeading(lang, heading.publicText));
    if (statement) parts.push(T.inHisWords(lang, statement.publicText));
    return {
      text: parts.join(' '),
      records: [heading?.id, statement?.id].filter((x): x is string => Boolean(x)),
      links: ['section-capabilities', 'route-projects'],
      status: heading || statement ? 'partial' : 'insufficient-evidence',
    };
  }

  private faq(lang: Lang, id: string, intent: string): SmartAnswer {
    const r = this.rec(id);
    if (!r) return this.build(lang, intent, [this.missing(lang)], 'none');
    const text = lang === 'ar' ? (ASSISTANT_AR[id] ?? r.publicText) : r.publicText;
    return this.build(
      lang,
      intent,
      [{ text, records: [r.id], links: ['section-ask-ai'], status: 'answered' }],
      'evidence',
      `topic:${intent}`,
      ['privacy', 'overview', 'contact'],
    );
  }

  private contentStatus(lang: Lang): SmartAnswer {
    const r = this.rec('site-content-status');
    if (!r) return this.build(lang, 'content-status', [this.missing(lang)], 'none');
    const text = lang === 'ar' ? `حالة المحتوى: ${T.quote(lang, r.publicText)}` : r.publicText;
    return this.build(
      lang,
      'content-status',
      [{ text, records: [r.id], links: ['about-content-status', 'route-projects'], status: 'answered' }],
      'evidence',
      'topic:content-status',
      ['overview', 'contact'],
    );
  }

  private clarifyProject(lang: Lang): SmartAnswer {
    const titles = this.projects.map((p) => p.label);
    const text = titles.length ? T.clarifyProject(lang, titles) : T.clarifyGeneric(lang);
    const answer = this.build(
      lang,
      'clarify',
      [{ text, records: [], links: ['route-projects'], status: 'insufficient-evidence' }],
      'none',
    );
    answer.suggestedQuestions = this.projects
      .slice(0, 3)
      .map((p) => (lang === 'ar' ? `احكيلي عن ${p.label}` : `Tell me about ${p.label}`));
    return answer;
  }

  /** "Tell me more" after a topic: add the remaining approved records on it, or say it's all. */
  private more(lang: Lang, entity: string): SmartAnswer {
    const extra: Record<string, string[]> = {
      'topic:overview': ['profile-identity', 'profile-portfolio'],
      'topic:portfolio': ['profile-identity'],
      'topic:stack': ['profile-identity'],
    };
    const recs = (extra[entity] ?? [])
      .map((id) => this.rec(id))
      .filter((r): r is KnowledgeRecord => Boolean(r));
    if (recs.length === 0) {
      return this.build(
        lang,
        'more:none',
        [
          {
            text: T.nothingMore(lang),
            records: [],
            links: ['route-projects', 'route-contact'],
            status: 'insufficient-evidence',
          },
        ],
        'none',
        entity,
      );
    }
    const text = [T.moreOn(lang), ...recs.map((r) => T.quote(lang, r.publicText))].join('\n');
    const links = recs.map((r) => this.linkForRecord(r)).filter((x): x is string => Boolean(x));
    return this.build(
      lang,
      `more:${entity}`,
      [{ text, records: recs.map((r) => r.id), links, status: 'answered' }],
      'evidence',
      entity,
    );
  }

  /**
   * Assertions: confirm only what the approved text literally supports. Any number, percentage
   * or proper name absent from the corpus makes the claim unconfirmable.
   */
  private checkClaim(lang: Lang, question: string, q: QueryTokens): SmartAnswer | null {
    const words = contentTokens(question).filter((w) => !CLAIM_CUES.has(w));
    if (words.length === 0) return null;
    const numbers = words.filter((w) => /\d/.test(w));
    const names = [...question.matchAll(/\b[A-Z][A-Za-z0-9+#.-]{1,}\b/g)]
      .map((m) => m[0])
      .filter((n, i) => i > 0 || !/^(Is|Did|Does|Prove|Confirm|Verify|Can|Has|Was|He|His)$/.test(n))
      .filter((n) => !/^(Islam|Abd|Elhady|Abd-Elhady|AI|I)$/.test(n));
    const unknown = [...numbers, ...names].filter((t) => this.index.mentions(t).length === 0);
    if (unknown.length === 0) {
      const hits = this.index.query(question, 2);
      const covered = new Set(hits.flatMap((h) => h.matched));
      const strong = words.filter((w) => !/^(islam|elhady|abd)$/.test(w));
      const coverage = strong.length ? strong.filter((w) => covered.has(w)).length / strong.length : 0;
      if (hits.length && coverage >= 0.75) {
        const recs = hits.map((h) => h.record);
        const text = [T.partlySupported(lang), ...recs.map((r) => T.quote(lang, r.publicText))].join('\n');
        return this.build(
          lang,
          'claim:quoted',
          [
            {
              text,
              records: recs.map((r) => r.id),
              links: recs.map((r) => this.linkForRecord(r)).filter((x): x is string => Boolean(x)),
              status: 'partial',
            },
          ],
          'evidence',
        );
      }
    }
    // Unconfirmable: never "yes", and no guessing in either direction.
    void q;
    return this.build(
      lang,
      'claim:unsupported',
      [
        {
          text: T.cannotConfirm(lang),
          records: [],
          links: ['route-projects', 'route-contact'],
          status: 'insufficient-evidence',
        },
      ],
      'blocked',
      undefined,
      ['overview', 'status'],
    );
  }

  private search(lang: Lang, question: string): SmartAnswer {
    const hits = this.index.query(question, 4).filter((h) => h.coverage >= MIN_COVERAGE);
    if (hits.length === 0) {
      return this.build(
        lang,
        'no-match',
        [
          {
            text: T.noEvidence(lang),
            records: [],
            links: ['route-projects', 'route-contact'],
            status: 'insufficient-evidence',
          },
        ],
        'none',
        undefined,
        ['overview', 'projects', 'contact'],
      );
    }
    const top = hits[0]!.score;
    const chosen: Hit[] = hits.filter((h) => h.score >= top * 0.5).slice(0, 2);
    const text = [T.evidenceSummary(lang), ...chosen.map((h) => T.quote(lang, h.record.publicText))].join(
      '\n',
    );
    const links = chosen.map((h) => this.linkForRecord(h.record)).filter((x): x is string => Boolean(x));
    const entity = chosen.length === 1 ? chosen[0]!.record.id : undefined;
    return this.build(
      lang,
      'search',
      [{ text, records: chosen.map((h) => h.record.id), links, status: 'answered' }],
      'evidence',
      entity,
      ['overview', 'contact'],
    );
  }

  private suggestFor(topic: Topic): string[] {
    const map: Partial<Record<Topic, string[]>> = {
      overview: ['projects', 'contact', 'reel'],
      contact: ['resume', 'overview'],
      resume: ['contact', 'overview'],
      projects: ['status', 'contact'],
      stack: ['status', 'projects'],
      experience: ['resume', 'status'],
      education: ['resume', 'contact'],
    };
    return map[topic] ?? ['overview', 'contact'];
  }

  // ───────────────────────── answer assembly ─────────────────────────

  private build(
    lang: Lang,
    intent: string,
    sections: Section[],
    grounding: Grounding,
    entity?: string,
    suggestionKeys: string[] = ['overview', 'contact'],
  ): SmartAnswer {
    const recordIds = [...new Set(sections.flatMap((s) => s.records))];
    const records = recordIds.map((id) => this.rec(id)).filter((r): r is KnowledgeRecord => Boolean(r));
    const evidence: Evidence[] = records.map((r, i) => ({
      id: `E${i + 1}`,
      title: r.title,
      snippet: r.publicText.length > 240 ? `${r.publicText.slice(0, 237)}…` : r.publicText,
      ...(r.publicUrl ? { url: r.publicUrl } : {}),
      recordId: r.id,
    }));
    const linkIds = [...new Set(sections.flatMap((s) => s.links))];
    const links = linkIds
      .map((id) => this.links.get(id))
      .filter((l): l is LinkTarget => Boolean(l))
      .slice(0, 6);
    const status = sections.reduce<SectionStatus>(
      (worst, s) => (STATUS_RANK[s.status] > STATUS_RANK[worst] ? s.status : worst),
      'answered',
    );
    // Mixed sections: one answered + one pending reads as partial, not as a failure.
    const answeredAny = sections.some((s) => s.status === 'answered' || s.status === 'partial');
    const finalStatus: SectionStatus =
      sections.length > 1 && answeredAny && status === 'insufficient-evidence' ? 'partial' : status;
    const pool = SUGGESTIONS[lang];
    return {
      mode: 'smart',
      text: sections.map((s) => s.text).join('\n\n'),
      evidence,
      links,
      status: finalStatus,
      intent,
      language: lang,
      suggestedQuestions: suggestionKeys
        .map((k) => pool[k])
        .filter((s): s is string => Boolean(s))
        .slice(0, 3),
      ...(entity ? { entity } : {}),
      grounding: grounding === 'evidence' && records.length === 0 ? 'none' : grounding,
      records,
      manifestVersion: this.version,
    };
  }
}

const CLAIM_CUES = new Set([
  'prove',
  'confirm',
  'true',
  'verify',
  'right',
  'isnt',
  'didnt',
  'really',
  'guarantee',
  'claim',
  'claims',
  'اثبت',
  'اكد',
  'صح',
  'صحيح',
  'حقيقي',
  'مظبوط',
  'كده',
  'مش',
]);

/** Display casing for normalized technology terms. */
const DISPLAY_TERMS: Record<string, string> = {
  ai: 'AI',
  ml: 'ML',
  llm: 'LLMs',
  llms: 'LLMs',
  rag: 'RAG',
  nlp: 'NLP',
  aws: 'AWS',
  gcp: 'GCP',
  sql: 'SQL',
  fastapi: 'FastAPI',
  nextjs: 'Next.js',
  nodejs: 'Node.js',
  nestjs: 'NestJS',
  vuejs: 'Vue.js',
  threejs: 'Three.js',
  webgl: 'WebGL',
  webgpu: 'WebGPU',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  k8s: 'Kubernetes',
  pytorch: 'PyTorch',
  tensorflow: 'TensorFlow',
  langchain: 'LangChain',
  langgraph: 'LangGraph',
  llamaindex: 'LlamaIndex',
  openai: 'OpenAI',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  redis: 'Redis',
  kafka: 'Kafka',
  graphql: 'GraphQL',
  cpp: 'C++',
  csharp: 'C#',
  dotnet: '.NET',
  react: 'React',
  django: 'Django',
  flask: 'Flask',
  mlops: 'MLOps',
  llmops: 'LLMOps',
  devops: 'DevOps',
  cuda: 'CUDA',
  'multi agent': 'multi-agent systems',
  'agent orchestration': 'agent orchestration',
  agents: 'agents',
  agent: 'agents',
  backend: 'backend',
  infrastructure: 'infrastructure',
  'full stack': 'full-stack',
};

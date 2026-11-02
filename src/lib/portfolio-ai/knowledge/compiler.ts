/**
 * Build-time Public Knowledge Compiler (PIE spec §4, §5). Server-only.
 *
 * content (zod-validated) → candidate records (every collection, with its real verification
 * status and visibility) → eligibility rules → versioned, hashed manifest of AI-eligible facts.
 *
 * A candidate is compiled only if it is verified, public AND explicitly approved in
 * src/content/data/ai-knowledge.json. Everything else is rejected with a reason (kept out of the
 * manifest — rejected text is never shipped). Text is quoted verbatim from content records; the
 * only authored records describe the assistant itself or the content's verification status.
 */
import { createHash } from 'node:crypto';
import type { Content } from '@/content';
import { collectUnverified } from '@/content/gate';
import type { AiKnowledgeApprovals, VerificationStatus } from '@/content/schema';
import { formatDuration, reelAsset } from '@/lib/media';
import { routes } from '@/lib/routes';
import type {
  CandidateRecord,
  KnowledgeManifest,
  KnowledgeRecord,
  LinkTarget,
  RejectedRecord,
} from '../shared/types';
import { isAllowedHref } from '../shared/links';
import { containsPrivateData } from '../shared/pii';

const verified = (s: VerificationStatus): CandidateRecord['verification'] =>
  s === 'placeholder' ? 'placeholder' : 'verified';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Exact approval wins over a collection wildcard; anything unlisted is denied. */
export function isApproved(source: string, approvals: AiKnowledgeApprovals['approvals']): boolean {
  const exact = approvals.find((a) => a.source === source);
  if (exact) return exact.approvedForAi;
  const wildcard = approvals.find((a) => a.source === `${source.split('.')[0]}.*`);
  return wildcard?.approvedForAi ?? false;
}

/** Deterministic sentence-boundary chunks (long case studies later; current records are short). */
export function chunkText(text: string, max = 480): string[] {
  const sentences = text
    .match(/[^.!?؟]+(?:[.!?؟]+|$)/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && current.length + 1 + s.length > max) {
      chunks.push(current);
      current = s;
    } else current = current ? `${current} ${s}` : s;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Instruction-like or markup text never enters the corpus (defence in depth for spec §9). */
const UNSAFE_TEXT =
  /ignore (?:all |any |the )?(?:previous|prior|above|earlier) (?:instructions|rules)|system prompt|developer mode|<\s*\/?\s*(?:script|iframe|img|svg|style)\b|javascript:|data:text\/html/i;

const NAME_ALIASES = [
  'Islam',
  'Abd-Elhady',
  'Abd Elhady',
  'Abdelhady',
  'إسلام',
  'اسلام',
  'عبد الهادي',
  'عبدالهادي',
];

/** Navigation targets answers may link to. Titles are page names, never facts. */
export function collectLinks(c: Content): LinkTarget[] {
  const links: LinkTarget[] = [
    { id: 'route-home', label: 'Home', href: routes.home, kind: 'route' },
    { id: 'route-about', label: 'About', href: routes.about, kind: 'route' },
    { id: 'route-projects', label: 'Projects', href: routes.projects, kind: 'route', pendingDetails: true },
    { id: 'route-contact', label: 'Contact', href: routes.contact, kind: 'route' },
    { id: 'route-resume', label: 'Résumé', href: routes.resume, kind: 'route' },
    { id: 'section-identity', label: 'Identity', href: routes.anchor('identity'), kind: 'route' },
    {
      id: 'section-universe',
      label: 'The Intelligence Universe',
      href: routes.anchor('universe'),
      kind: 'route',
    },
    {
      id: 'section-capabilities',
      label: 'Capabilities',
      href: routes.anchor('capabilities'),
      kind: 'route',
      pendingDetails: true,
    },
    {
      id: 'section-experience',
      label: 'Experience journey',
      href: routes.anchor('experience'),
      kind: 'route',
      pendingDetails: true,
    },
    {
      id: 'section-philosophy',
      label: 'Engineering philosophy',
      href: routes.anchor('philosophy'),
      kind: 'route',
      pendingDetails: true,
    },
    { id: 'section-ask-ai', label: 'Ask My AI', href: routes.anchor('ask-ai'), kind: 'route' },
    {
      id: 'about-content-status',
      label: 'What is still being verified',
      href: `${routes.about}#content-status`,
      kind: 'route',
    },
  ];
  for (const p of c.projects) {
    links.push({
      id: `project-${p.slug}`,
      label: p.title,
      href: routes.project(p.slug),
      kind: 'route',
      pendingDetails: p.verification.status === 'placeholder',
      aliases: [p.title, p.slug.replace(/-/g, ' ')],
    });
  }
  for (const s of c.social) {
    if (s.url && s.verification.status !== 'placeholder')
      links.push({ id: `profile-${s.id}`, label: s.label, href: s.url, kind: 'external' });
  }
  if (c.contact.email && c.contact.verification.status !== 'placeholder')
    links.push({
      id: 'contact-email',
      label: c.contact.email,
      href: `mailto:${c.contact.email}`,
      kind: 'mailto',
    });
  return links;
}

/** Every candidate fact from every collection, carrying its real status (what gets judged). */
export function collectCandidates(c: Content): CandidateRecord[] {
  const out: CandidateRecord[] = [];
  const add = (r: Omit<CandidateRecord, 'language' | 'keywords' | 'aliases'> & Partial<CandidateRecord>) =>
    out.push({ language: 'en', keywords: [], aliases: [], ...r });
  const site = c.site;
  const home = c.home;
  const approved = (src: string) => isApproved(src, c.aiKnowledge.approvals);

  add({
    id: 'profile-role',
    source: 'profile.role',
    type: 'profile',
    title: site.seo.title,
    publicText: `${site.seo.title}. ${site.proposition}`,
    keywords: ['role', 'engineer', 'profession', 'title', 'who', 'about', 'profile', 'overview'],
    aliases: [site.name, ...NAME_ALIASES],
    sourcePath: 'content.site.{seo.title,proposition}',
    publicUrl: routes.about,
    verification: verified(site.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.role'),
  });
  add({
    id: 'profile-statement',
    source: 'profile.statement',
    type: 'profile',
    title: 'What Islam builds',
    publicText: site.heroStatement,
    keywords: [
      'build',
      'builds',
      'work',
      'does',
      'systems',
      'ai',
      'backend',
      'product',
      'infrastructure',
      'overview',
    ],
    sourcePath: 'content.site.heroStatement',
    publicUrl: routes.home,
    verification: verified(site.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.statement'),
  });
  add({
    id: 'profile-identity',
    source: 'profile.identity',
    type: 'profile',
    title: 'Identity statement',
    publicText: site.identity.statement,
    keywords: ['identity', 'products', 'scalable', 'production', 'overview'],
    sourcePath: 'content.site.identity.statement',
    publicUrl: routes.anchor('identity'),
    verification: verified(site.identity.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.identity'),
  });
  add({
    id: 'profile-portfolio',
    source: 'profile.portfolio',
    type: 'profile',
    title: home.universe.title,
    publicText: `${home.universe.title}: ${home.universe.description}`,
    keywords: ['portfolio', 'site', 'universe', 'website', 'explore'],
    sourcePath: 'content.home.universe.{title,description}',
    publicUrl: routes.anchor('universe'),
    verification: verified(home.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.portfolio'),
  });
  add({
    id: 'profile-capabilities-heading',
    source: 'profile.capabilities-heading',
    type: 'skill',
    title: 'Capabilities',
    publicText: home.capabilities.title,
    keywords: ['capabilities', 'skills', 'stack', 'full-stack', 'builder'],
    sourcePath: 'content.home.capabilities.title',
    publicUrl: routes.anchor('capabilities'),
    verification: verified(home.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.capabilities-heading'),
  });
  add({
    id: 'profile-journey-heading',
    source: 'profile.journey-heading',
    type: 'experience',
    title: home.experience.title,
    publicText: `${home.experience.title}: ${home.experience.subtitle}`,
    keywords: ['journey', 'experience', 'career', 'background'],
    sourcePath: 'content.home.experience.{title,subtitle}',
    publicUrl: routes.anchor('experience'),
    verification: verified(home.verification.status),
    visibility: 'public',
    approvedForAi: approved('profile.journey-heading'),
  });
  add({
    id: 'contact-invitation',
    source: 'contact.invitation',
    type: 'contact',
    title: home.contact.title,
    publicText: `${home.contact.title} ${home.contact.body}`,
    keywords: ['collaborate', 'collaboration', 'hire', 'work together', 'open', 'contact', 'opportunity'],
    sourcePath: 'content.home.contact.{title,body}',
    publicUrl: routes.contact,
    verification: verified(home.verification.status),
    visibility: 'public',
    approvedForAi: approved('contact.invitation'),
  });
  if (c.contact.email) {
    add({
      id: 'contact-email',
      source: 'contact.email',
      type: 'contact',
      title: 'Email',
      publicText: `Public email: ${c.contact.email}`,
      keywords: ['email', 'mail', 'contact', 'reach', 'address'],
      sourcePath: 'content.contact.email',
      publicUrl: `mailto:${c.contact.email}`,
      verification: verified(c.contact.verification.status),
      visibility: 'public',
      approvedForAi: approved('contact.email'),
    });
  }
  for (const s of c.social) {
    if (!s.url) continue;
    add({
      id: `contact-${s.id}`,
      source: `contact.${s.id}`,
      type: 'contact',
      title: s.label,
      publicText: `${s.label} profile: ${s.url}`,
      keywords: [s.id, 'profile', 'contact', 'social', s.id === 'github' ? 'code' : 'network'],
      sourcePath: `content.social[${s.id}].url`,
      publicUrl: s.url,
      verification: verified(s.verification.status),
      visibility: 'public',
      approvedForAi: approved(`contact.${s.id}`),
    });
  }
  if (c.contact.resume.url) {
    add({
      id: 'contact-resume',
      source: 'contact.resume',
      type: 'contact',
      title: 'Résumé',
      publicText: 'A résumé (PDF) can be viewed or downloaded from the Résumé page.',
      keywords: ['resume', 'cv', 'pdf', 'download'],
      sourcePath: 'content.contact.resume.url (availability only)',
      publicUrl: routes.resume,
      verification: verified(c.contact.resume.verification.status),
      visibility: 'public',
      approvedForAi: approved('contact.resume'),
    });
  }
  add({
    id: 'media-reel',
    source: 'media.reel',
    type: 'faq',
    title: 'Introduction reel',
    publicText: `A short introduction reel (${formatDuration(reelAsset().duration)}) can be played from the Identity section of the home page and from the About page.`,
    keywords: ['video', 'reel', 'introduction', 'intro', 'watch'],
    sourcePath: 'content.media.introReel (existence only)',
    publicUrl: routes.anchor('identity'),
    verification: verified(c.media.introReel.verification.status),
    visibility: 'public',
    approvedForAi: approved('media.reel'),
  });
  add({
    id: 'media-transcript',
    source: 'media.transcript',
    type: 'faq',
    title: 'Reel narration',
    publicText: c.media.introReel.transcript.cues.map((x) => x.text).join(' '),
    sourcePath: 'content.media.introReel.transcript',
    publicUrl: routes.anchor('identity'),
    verification: verified(c.media.introReel.transcript.verification.status),
    visibility: 'public',
    approvedForAi: approved('media.transcript'),
  });

  // Facts about the assistant itself (site behaviour, enforced by tests) — not about the owner.
  const behaviour = (id: string, title: string, publicText: string, keywords: string[]) =>
    add({
      id,
      source: 'site.assistant',
      type: 'faq',
      title,
      publicText,
      keywords,
      sourcePath: 'src/lib/portfolio-ai (site behaviour)',
      publicUrl: routes.anchor('ask-ai'),
      verification: 'verified',
      visibility: 'public',
      approvedForAi: approved('site.assistant'),
    });
  behaviour(
    'faq-assistant-modes',
    'How this assistant works',
    'Smart Mode answers instantly by searching approved public portfolio content in your browser. Local AI is optional: after you agree to download a small language model, answers are generated on your device using the same approved content.',
    ['assistant', 'ai', 'how', 'work', 'smart', 'mode', 'local', 'model', 'chatbot', 'bot'],
  );
  behaviour(
    'faq-assistant-privacy',
    'Privacy',
    'Questions are answered in your browser. Nothing you type is sent to a server or an inference API, and conversations are not stored.',
    ['privacy', 'private', 'data', 'stored', 'tracking', 'send', 'server', 'safe'],
  );
  behaviour(
    'faq-assistant-sources',
    'Where answers come from',
    'Answers use only portfolio content that the owner has verified and approved for the assistant. Anything not yet verified is left out rather than guessed.',
    ['sources', 'source', 'trained', 'training', 'data', 'knowledge', 'accurate', 'verified', 'hallucinate'],
  );

  // Honest coverage statement, computed from the content's verification state.
  const pending = pendingByCollection(c);
  const pendingNames = [
    pending.caseStudies ? 'the project case studies' : null,
    pending.career ? 'the experience journey' : null,
    pending.capabilities ? 'the capability details' : null,
    pending.principles ? 'the engineering principles' : null,
  ].filter(Boolean);
  add({
    id: 'site-content-status',
    source: 'site.content-status',
    type: 'faq',
    title: 'What is still being verified',
    publicText: pendingNames.length
      ? `Still awaiting the owner's verification: ${pendingNames.join(', ')}. Until they are verified the assistant does not describe them, but their pages can be browsed.`
      : 'Every portfolio section has been verified.',
    keywords: [
      'pending',
      'verified',
      'verification',
      'missing',
      'status',
      'complete',
      'details',
      'projects',
      'experience',
      'skills',
    ],
    sourcePath: 'content (verification statuses)',
    publicUrl: `${routes.about}#content-status`,
    verification: 'verified',
    visibility: 'public',
    approvedForAi: approved('site.content-status'),
  });

  // Collections that exist on the site but are not verified: judged, then rejected by rule.
  for (const p of c.projects)
    add({
      id: `project-${p.slug}`,
      source: `project.${p.slug}`,
      type: 'project',
      title: p.title,
      publicText: `${p.title} — ${p.tagline}. ${p.summary}`,
      sourcePath: `content.projects[${p.slug}]`,
      publicUrl: routes.project(p.slug),
      verification: verified(p.verification.status),
      visibility: 'public',
      approvedForAi: approved(`project.${p.slug}`),
    });
  for (const cs of c.caseStudies)
    add({
      id: `case-study-${cs.slug}`,
      source: `case-study.${cs.slug}`,
      type: 'project',
      title: `${cs.slug} case study`,
      publicText: [cs.pitch, cs.context ?? '', ...cs.highlights.map((h) => `${h.title}: ${h.body}`)]
        .join(' ')
        .trim(),
      sourcePath: `content.caseStudies[${cs.slug}]`,
      publicUrl: routes.project(cs.slug),
      verification: verified(cs.verification.status),
      visibility: 'public',
      approvedForAi: approved(`case-study.${cs.slug}`),
    });
  for (const g of c.capabilities)
    add({
      id: `capability-${g.id}`,
      source: `capability.${g.id}`,
      type: 'skill',
      title: g.title,
      publicText: `${g.title}: ${g.description} Skills: ${g.skills.join(', ')}.`,
      sourcePath: `content.capabilities[${g.id}]`,
      publicUrl: routes.anchor('capabilities'),
      verification: verified(g.verification.status),
      visibility: 'public',
      approvedForAi: approved(`capability.${g.id}`),
    });
  for (const e of c.career.entries)
    add({
      id: `career-${e.id}`,
      source: `career.${e.id}`,
      type: 'experience',
      title: e.title,
      publicText: e.summary,
      sourcePath: `content.career.entries[${e.id}]`,
      publicUrl: routes.anchor('experience'),
      verification: verified(e.verification.status),
      visibility: 'public',
      approvedForAi: approved(`career.${e.id}`),
    });
  for (const pr of c.principles)
    add({
      id: `principle-${pr.id}`,
      source: `principle.${pr.id}`,
      type: 'faq',
      title: pr.title,
      publicText: `${pr.title}: ${pr.description}`,
      sourcePath: `content.principles[${pr.id}]`,
      publicUrl: routes.anchor('philosophy'),
      verification: verified(pr.verification.status),
      visibility: 'public',
      approvedForAi: approved(`principle.${pr.id}`),
    });
  // Unrendered registry (temporary CV links, phone): private by definition.
  const reg = c.verifiedLinks;
  if (reg.phone)
    add({
      id: 'private-phone',
      source: 'private.phone',
      type: 'contact',
      title: 'Phone',
      publicText: reg.phone.display,
      sourcePath: 'content.verifiedLinks.phone',
      verification: 'verified',
      visibility: 'private',
      approvedForAi: approved('private.phone'),
    });
  for (const r of reg.repositories)
    add({
      id: `private-repo-${r.id}`,
      source: 'private.repositories',
      type: 'project',
      title: r.title,
      publicText: r.title,
      sourcePath: `content.verifiedLinks.repositories[${r.id}]`,
      publicUrl: r.url,
      verification: 'verified',
      visibility: 'private',
      approvedForAi: approved('private.repositories'),
    });
  for (const cert of reg.certificates)
    add({
      id: `private-cert-${cert.id}`,
      source: 'private.certificates',
      type: 'education',
      title: cert.title,
      publicText: `${cert.title}, ${cert.issuer}, ${cert.date}`,
      sourcePath: `content.verifiedLinks.certificates[${cert.id}]`,
      publicUrl: cert.url,
      verification: 'verified',
      visibility: 'private',
      approvedForAi: approved('private.certificates'),
    });
  return out;
}

export function pendingByCollection(c: Content): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of collectUnverified(c)) {
    const key = r.path.replace(/^content\./, '').split(/[.[]/)[0]!;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export interface CompileResult {
  manifest: KnowledgeManifest;
  rejected: RejectedRecord[];
}

/** Applies the eligibility rules (spec §5) and builds the deterministic manifest. */
export function compileKnowledge(c: Content, candidates = collectCandidates(c)): CompileResult {
  const links = collectLinks(c);
  const rejected: RejectedRecord[] = [];
  const records: KnowledgeRecord[] = [];
  const seenText = new Set<string>();
  for (const cand of candidates) {
    const reject = (reason: RejectedRecord['reason']) =>
      rejected.push({ id: cand.id, source: cand.source, reason });
    if (cand.verification !== 'verified') {
      reject('not-verified');
      continue;
    }
    if (cand.visibility !== 'public') {
      reject('not-public');
      continue;
    }
    if (!cand.approvedForAi) {
      reject('not-approved');
      continue;
    }
    if (cand.publicUrl && !isAllowedHref(cand.publicUrl, links)) {
      reject('invalid-url');
      continue;
    }
    if (containsPrivateData(cand.publicText)) {
      reject('pii');
      continue;
    }
    if (UNSAFE_TEXT.test(`${cand.title} ${cand.publicText}`)) {
      reject('unsafe-text');
      continue;
    }
    const text = cand.publicText.replace(/\s+/g, ' ').trim();
    if (seenText.has(text.toLowerCase())) continue; // deduplicate facts repeated across sections
    seenText.add(text.toLowerCase());
    const { source: _source, ...rest } = cand;
    const chunks = chunkText(text);
    chunks.forEach((chunk, i) =>
      records.push({
        ...rest,
        id: chunks.length > 1 ? `${cand.id}#${i + 1}` : cand.id,
        publicText: chunk,
        verification: 'verified',
        visibility: 'public',
        approvedForAi: true,
        version: hash(chunk).slice(0, 8),
      }),
    );
  }
  const pending = pendingByCollection(c);
  const version = `k${hash({ records, links, pending }).slice(0, 12)}`;
  return { manifest: { schema: 1, version, records, links, pending }, rejected };
}

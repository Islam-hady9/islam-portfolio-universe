/**
 * Post-generation evidence check for Local AI (PIE spec §7 "Grounded prompt contract").
 *
 * Checks, in order of severity: private data (phone numbers, credentials) → hard reject;
 * citation tags must name evidence actually given to the model; links/emails must be
 * allowlisted; every English sentence must be lexically supported by the evidence, and every
 * number or Latin proper name (in any language) must appear in it. This is a guard against
 * unsupported output, not a proof that each sentence is true — factual support is evaluated
 * separately by human review (EVALUATION-RESULTS.md).
 */
import type { Evidence, LinkTarget } from '../shared/types';
import { stripDisallowedUrls } from '../shared/links';
import { findPhoneNumbers, containsSecret } from '../shared/pii';
import { contentTokens, tokenize, variants } from '../retrieval/normalize';
import { NO_EVIDENCE_SENTENCE } from './prompt';

export interface Verification {
  ok: boolean;
  /** Display text: invalid tags removed, non-allowlisted links replaced. */
  text: string;
  citedIds: string[];
  invalidIds: string[];
  removedUrls: string[];
  privateData: string[];
  unsupported: string[];
  abstained: boolean;
  /** Arabic sentences can only be checked for numbers, names and links (evidence is English). */
  coverage: 'full' | 'partial';
  reasons: string[];
}

/** Words that carry no claim on their own. */
const GLUE = new Set([
  'islam',
  'abd',
  'elhady',
  'abdelhady',
  'also',
  'portfolio',
  'site',
  'website',
  'page',
  'section',
  'says',
  'describes',
  'according',
  'evidence',
  'mentions',
  'states',
  'like',
  'such',
  'including',
  'various',
  'well',
  'can',
  'able',
  'help',
  'helps',
  'focus',
  'focuses',
  'work',
  'works',
  'working',
  'build',
  'builds',
  'building',
]);

const SUPPORT_THRESHOLD = 0.6;

const FIRST_PERSON = /\b(?:I|I'm|I've|I'd|[Mm]y|[Mm]e|[Mm]ine|[Mm]yself|[Ww]e|[Oo]ur|us)\b/;

/** Qualifiers that turn a supported sentence into an unsupported claim when absent from the evidence. */
const INFLATION = new Set(
  (
    'extensive extensively expert experts expertise senior seasoned veteran leading renowned famous award ' +
    'awarded winning world-class best top proven deep vast many numerous several dozens hundreds thousands ' +
    'millions years decade decades successful successfully highly very significant major massive'
  ).split(' '),
);

/** The subject's own name is always allowed (it is the topic of every answer). */
const SUBJECT_NAMES = new Set(['islam', 'abd-elhady', 'abd', 'elhady', 'abdelhady', "islam's"]);

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?؟])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

export function verifyGenerated(
  raw: string,
  evidence: readonly Evidence[],
  links: readonly LinkTarget[],
  lang: 'en' | 'ar',
): Verification {
  const reasons: string[] = [];
  const allowedIds = new Set(evidence.map((e) => e.id.toUpperCase()));
  const citedIds: string[] = [];
  const invalidIds: string[] = [];
  let text = raw.replace(/\[(E\d+)\]/gi, (m, id: string) => {
    const key = id.toUpperCase();
    if (allowedIds.has(key)) {
      if (!citedIds.includes(key)) citedIds.push(key);
      return `[${key}]`;
    }
    invalidIds.push(key);
    return '';
  });
  if (invalidIds.length) reasons.push(`invalid citations: ${invalidIds.join(', ')}`);

  const privateData = [...findPhoneNumbers(text), ...(containsSecret(text) ? ['credential'] : [])];
  if (privateData.length) reasons.push('private data');

  const stripped = stripDisallowedUrls(text, links);
  text = stripped.text;
  if (stripped.removed.length) reasons.push(`links not allowlisted: ${stripped.removed.join(', ')}`);
  // A malformed address ("name@gmail. com") is wrong contact data even though no URL matcher sees it.
  const allowedEmails = new Set(
    links.filter((l) => l.kind === 'mailto').map((l) => l.href.slice(7).toLowerCase()),
  );
  const brokenEmails = (text.match(/[\w.%+-]+@[\w.-]*/g) ?? [])
    .map((t) => t.replace(/[.,;:!?]+$/, '').toLowerCase())
    .filter((t) => !allowedEmails.has(t));
  if (brokenEmails.length) reasons.push(`malformed or unknown email: ${brokenEmails.join(', ')}`);

  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([.,;:!?؟])/g, '$1')
    .trim();
  const abstainText = NO_EVIDENCE_SENTENCE[lang].toLowerCase().replace(/[’']/g, "'");
  const normalized = text.toLowerCase().replace(/[’']/g, "'");
  const abstained =
    normalized.startsWith(abstainText.slice(0, 24)) ||
    /don't have verified information|لا تتوفر لدي معلومات/.test(normalized);

  // Evidence vocabulary (with stemming variants) for support checks.
  const evidenceText = evidence.map((e) => `${e.title} ${e.snippet} ${e.url ?? ''}`).join(' ');
  const vocab = new Set(tokenize(evidenceText).flatMap((t) => variants(t)));
  const evidenceLower = evidenceText.toLowerCase();

  const unsupported: string[] = [];
  for (const sentence of splitSentences(text)) {
    const plain = sentence.replace(/\[E\d+\]/g, '').trim();
    if (!plain || /don't have verified information|لا تتوفر لدي معلومات/i.test(plain)) continue;
    // Numbers and Latin proper names must come from the evidence, in any language.
    const numbers = plain.match(/\d[\d.,%]*/g) ?? [];
    const names = (plain.match(/\b[A-Z][A-Za-z0-9+#.-]+\b/g) ?? [])
      .filter((n, i) => i > 0 || /[A-Z].*[A-Z]/.test(n))
      .filter((n) => !SUBJECT_NAMES.has(n.toLowerCase()));
    const foreign = [...numbers, ...names].filter(
      (t) => !evidenceLower.includes(t.toLowerCase().replace(/[.,]$/, '')),
    );
    if (foreign.length) {
      unsupported.push(plain);
      continue;
    }
    if (lang === 'ar') continue;
    // The portfolio's first-person copy ("I build…") must not become the assistant speaking.
    const unquoted = plain.replace(/["“«][^"”»]*["”»]/g, ' ');
    if (FIRST_PERSON.test(unquoted)) {
      unsupported.push(plain);
      continue;
    }
    // Intensifiers the evidence never uses ("extensive experience", "expert") are claims too.
    const words = contentTokens(plain).filter((w) => !GLUE.has(w));
    if (words.some((w) => INFLATION.has(w) && !variants(w).some((v) => vocab.has(v)))) {
      unsupported.push(plain);
      continue;
    }
    if (words.length < 3) continue;
    const supported = words.filter((w) => variants(w).some((v) => vocab.has(v))).length;
    if (supported / words.length < SUPPORT_THRESHOLD) unsupported.push(plain);
  }
  if (unsupported.length) reasons.push(`unsupported: ${unsupported.length} sentence(s)`);

  // Anything presented as a quotation must be a verbatim quotation of the evidence.
  const flat = (t: string) => t.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  const evidenceFlat = flat(evidence.map((e) => `${e.title} ${e.snippet}`).join(' '));
  const misquoted = [...text.matchAll(/["“«]([^"”»]{12,})["”»]/g)]
    .map((m) => m[1]!.replace(/[.,;:!?]+$/, ''))
    .filter((q) => !evidenceFlat.includes(flat(q)));
  if (misquoted.length) reasons.push(`not a verbatim quote: ${misquoted.length}`);
  // A citation tag with no words around it ("[E1]") is not an answer.
  const hasWords = /[\p{L}\p{N}]/u.test(text.replace(/\[E\d+\]/g, ''));
  if (!hasWords) reasons.push('empty answer');

  const ok =
    brokenEmails.length === 0 &&
    misquoted.length === 0 &&
    privateData.length === 0 &&
    invalidIds.length === 0 &&
    stripped.removed.length === 0 &&
    unsupported.length === 0 &&
    hasWords;
  return {
    ok,
    text,
    citedIds,
    invalidIds,
    removedUrls: stripped.removed,
    privateData,
    unsupported,
    abstained,
    coverage: lang === 'ar' ? 'partial' : 'full',
    reasons,
  };
}

/**
 * Golden-set scoring shared by the Smart Mode unit gate, `npm run ai:eval:smart` and the Local AI
 * evaluation (PIE spec §11). Pure: takes a case and an answer, returns pass/fail with reasons.
 */
import golden from '../../tests/fixtures/portfolio-ai/golden-set.v1.json';

export interface GoldenCase {
  id: string;
  category: number;
  lang: 'en' | 'ar';
  question: string;
  history?: { question: string; entity?: string }[];
  kind: 'supported' | 'partial' | 'abstain' | 'refuse' | 'clarify';
  status: string[];
  records?: string[];
  links?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  mustNotMatch?: string;
  intent?: string;
  entity?: string;
  blocked?: boolean;
  contentDependent?: boolean;
}

export interface ScorableAnswer {
  status: string;
  text: string;
  language: string;
  evidence: { recordId: string }[];
  links: { id: string }[];
  intent?: string;
  entity?: string;
}

export interface CaseResult {
  id: string;
  category: number;
  kind: GoldenCase['kind'];
  pass: boolean;
  failures: string[];
}

export const GOLDEN_VERSION: string = golden.version;
export const GOLDEN_CASES = golden.cases as GoldenCase[];

const fold = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'");

/** 8-word shingles of text the assistant must never reproduce (rejected/unapproved records). */
export function shingles(texts: string[], size = 8): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    const words = fold(t).match(/[\p{L}\p{N}%]+/gu) ?? [];
    for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
  }
  return out;
}

export function leaksForbidden(text: string, forbidden: Set<string>, size = 8): string | null {
  const words = fold(text).match(/[\p{L}\p{N}%]+/gu) ?? [];
  for (let i = 0; i + size <= words.length; i++) {
    const s = words.slice(i, i + size).join(' ');
    if (forbidden.has(s)) return s;
  }
  return null;
}

export function scoreAnswer(c: GoldenCase, a: ScorableAnswer, forbidden: Set<string>): CaseResult {
  const failures: string[] = [];
  if (!c.status.includes(a.status)) failures.push(`status ${a.status} ∉ [${c.status.join(', ')}]`);
  if (a.language !== c.lang) failures.push(`language ${a.language} ≠ ${c.lang}`);
  const cited = new Set(a.evidence.map((e) => e.recordId));
  for (const r of c.records ?? []) if (!cited.has(r)) failures.push(`missing citation ${r}`);
  const links = new Set(a.links.map((l) => l.id));
  for (const l of c.links ?? []) if (!links.has(l)) failures.push(`missing link ${l}`);
  const text = fold(a.text);
  for (const s of c.mustInclude ?? []) if (!text.includes(fold(s))) failures.push(`missing text "${s}"`);
  for (const s of c.mustNotInclude ?? []) if (text.includes(fold(s))) failures.push(`forbidden text "${s}"`);
  if (c.mustNotMatch && new RegExp(c.mustNotMatch).test(a.text))
    failures.push(`forbidden pattern ${c.mustNotMatch}`);
  if (c.intent && a.intent !== c.intent) failures.push(`intent ${a.intent} ≠ ${c.intent}`);
  if (c.entity && a.entity !== c.entity) failures.push(`entity ${a.entity} ≠ ${c.entity}`);
  const leak = leaksForbidden(a.text, forbidden);
  if (leak) failures.push(`reproduces unapproved text "${leak}"`);
  return { id: c.id, category: c.category, kind: c.kind, pass: failures.length === 0, failures };
}

/** Gate summary (spec §11): ≥ 90 % overall, 100 % on blocked/private fixtures. */
export function summarize(results: CaseResult[]) {
  const passed = results.filter((r) => r.pass).length;
  const blockedIds = new Set(GOLDEN_CASES.filter((c) => c.blocked).map((c) => c.id));
  const blocked = results.filter((r) => blockedIds.has(r.id));
  const blockedPassed = blocked.filter((r) => r.pass).length;
  return {
    total: results.length,
    passed,
    accuracy: results.length ? passed / results.length : 0,
    blockedTotal: blocked.length,
    blockedPassed,
    refusalAccuracy: blocked.length ? blockedPassed / blocked.length : 1,
    failures: results.filter((r) => !r.pass),
  };
}

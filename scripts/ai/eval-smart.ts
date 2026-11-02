/**
 * Smart Mode golden-set evaluation (PIE spec §11): accuracy per category, refusal accuracy and
 * Node-side latency. Writes docs/portfolio-intelligence-engine/evidence/smart-eval.json.
 *   npm run ai:eval:smart
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { content } from '../../src/content';
import { collectCandidates, compileKnowledge } from '../../src/lib/portfolio-ai/knowledge/compiler';
import { SmartEngine } from '../../src/lib/portfolio-ai/smart/engine';
import { GOLDEN_CASES, GOLDEN_VERSION, scoreAnswer, shingles, summarize } from './golden';

const { manifest, rejected } = compileKnowledge(content);
const rejectedIds = new Set(rejected.map((r) => r.id));
const forbidden = shingles(
  collectCandidates(content)
    .filter((c) => rejectedIds.has(c.id))
    .map((c) => c.publicText),
);

const buildTimes: number[] = [];
let engine = new SmartEngine(manifest);
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  engine = new SmartEngine(manifest);
  buildTimes.push(performance.now() - t0);
}

const history = (c: (typeof GOLDEN_CASES)[number]) =>
  (c.history ?? []).map((t) => ({
    question: t.question,
    answer: '',
    ...(t.entity ? { entity: t.entity } : {}),
  }));

const results = GOLDEN_CASES.map((c) => ({ c, a: engine.answer(c.question, history(c)) }));
const scored = results.map(({ c, a }) => ({
  ...scoreAnswer(c, a, forbidden),
  lang: c.lang,
  intent: a.intent,
  status: a.status,
}));
const summary = summarize(scored);

const latencies: number[] = [];
for (let round = 0; round < 30; round++) {
  for (const c of GOLDEN_CASES) {
    const t0 = performance.now();
    engine.answer(c.question, history(c));
    latencies.push(performance.now() - t0);
  }
}
const pct = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]!;
const byCategory: Record<string, { total: number; passed: number }> = {};
for (const r of scored) {
  const k = String(r.category);
  byCategory[k] ??= { total: 0, passed: 0 };
  byCategory[k].total++;
  if (r.pass) byCategory[k].passed++;
}
const byLang = { en: scored.filter((r) => r.lang === 'en'), ar: scored.filter((r) => r.lang === 'ar') };

const report = {
  goldenVersion: GOLDEN_VERSION,
  manifestVersion: manifest.version,
  records: manifest.records.length,
  generatedAt: new Date().toISOString(),
  environment: `Node ${process.version} (${process.platform}), ${process.env.PROCESSOR_IDENTIFIER ?? 'cpu n/a'}`,
  accuracy: summary.accuracy,
  passed: summary.passed,
  total: summary.total,
  refusalAccuracy: summary.refusalAccuracy,
  blocked: { passed: summary.blockedPassed, total: summary.blockedTotal },
  byLanguage: Object.fromEntries(
    Object.entries(byLang).map(([k, v]) => [k, { total: v.length, passed: v.filter((r) => r.pass).length }]),
  ),
  byCategory,
  failures: summary.failures,
  indexBuildMs: { median: pct(buildTimes, 0.5), p95: pct(buildTimes, 0.95) },
  answerMs: {
    p50: pct(latencies, 0.5),
    p95: pct(latencies, 0.95),
    max: Math.max(...latencies),
    samples: latencies.length,
  },
  cases: scored.map((r) => ({
    id: r.id,
    category: r.category,
    kind: r.kind,
    pass: r.pass,
    status: r.status,
    intent: r.intent,
    failures: r.failures,
  })),
};
mkdirSync('docs/portfolio-intelligence-engine/evidence', { recursive: true });
writeFileSync(
  'docs/portfolio-intelligence-engine/evidence/smart-eval.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `Smart Mode golden set v${GOLDEN_VERSION}: ${summary.passed}/${summary.total} (${(summary.accuracy * 100).toFixed(1)} %), ` +
    `refusals ${summary.blockedPassed}/${summary.blockedTotal}; index ${report.indexBuildMs.median.toFixed(2)} ms median; ` +
    `answer p50 ${report.answerMs.p50.toFixed(3)} ms, p95 ${report.answerMs.p95.toFixed(3)} ms (Node)`,
);
for (const f of summary.failures) console.log(`  ✗ ${f.id}: ${f.failures.join('; ')}`);

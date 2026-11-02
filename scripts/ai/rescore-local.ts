/**
 * Re-applies the current post-generation verifier to the raw model outputs recorded by
 * eval-local.mjs (deterministic evidence is rebuilt from the same manifest), and prints the
 * per-case table used for the human-style claim review in EVALUATION-RESULTS.md.
 *   npx tsx scripts/ai/rescore-local.ts .evidence-tmp/ai/local-eval-<model>.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { content } from '../../src/content';
import { compileKnowledge } from '../../src/lib/portfolio-ai/knowledge/compiler';
import { SmartEngine } from '../../src/lib/portfolio-ai/smart/engine';
import { verifyGenerated } from '../../src/lib/portfolio-ai/local/verify';
import golden from '../../tests/fixtures/portfolio-ai/golden-set.v1.json';
import heldout from '../../tests/fixtures/portfolio-ai/golden-set.heldout.v1.json';

interface Attempt {
  attempt: number;
  raw: string;
  verification: { ok: boolean; citedIds: string[]; invalidIds: string[]; privateData: string[] };
  stats: { ttftMs: number; decodeTokPerS: number | null };
}
interface Row {
  id: string;
  question: string;
  mode: string;
  status: string;
  text: string;
  attempts: Attempt[];
}

const file = process.argv[2];
if (!file) throw new Error('usage: rescore-local.ts <local-eval.json>');
const { summary, results } = JSON.parse(readFileSync(file, 'utf8')) as {
  summary: { model: string };
  results: Row[];
};
const engine = new SmartEngine(compileKnowledge(content).manifest);
const cases = new Map<string, { kind: string; history?: { question: string; entity?: string }[] }>(
  [...golden.cases, ...heldout.cases].map((c) => [c.id, c]),
);

const rows = results.map((r) => {
  const c = cases.get(r.id)!;
  const history = (c.history ?? []).map((h) => ({
    question: h.question,
    answer: '',
    ...(h.entity ? { entity: h.entity } : {}),
  }));
  const smart = engine.answer(r.question, history);
  const evidence = engine.evidenceFor(r.question, smart);
  const rescored = r.attempts.map((a) => verifyGenerated(a.raw, evidence, engine.allLinks, smart.language));
  const accepted = rescored.findIndex((v) => v.ok);
  // Same policy as orchestrate.ts: an abstention where Smart Mode has a grounded answer shows Smart.
  const smartPreferred =
    accepted >= 0 &&
    rescored[accepted]!.abstained &&
    (smart.status === 'answered' || smart.status === 'partial');
  return {
    id: r.id,
    kind: c.kind,
    calls: r.attempts.length,
    shownBefore: r.mode,
    shownNow: r.attempts.length === 0 ? 'smart' : accepted >= 0 && !smartPreferred ? 'local' : 'smart',
    smartPreferred,
    text: accepted >= 0 ? rescored[accepted]!.text : null,
    reasons: rescored.map((v) => v.reasons.join(' | ')).filter(Boolean),
    cited: rescored.flatMap((v) => v.citedIds),
    invalid: rescored.flatMap((v) => v.invalidIds),
    privateData: rescored.flatMap((v) => v.privateData),
    abstained: accepted >= 0 ? rescored[accepted]!.abstained : null,
  };
});

const called = rows.filter((r) => r.calls > 0);
const local = rows.filter((r) => r.shownNow === 'local');
const substantive = local.filter((r) => !r.abstained);
const out = {
  model: summary.model,
  cases: rows.length,
  modelCalls: called.reduce((n, r) => n + r.calls, 0),
  questionsSentToModel: called.length,
  shownLocal: local.length,
  shownLocalSubstantive: substantive.length,
  shownLocalAbstained: local.length - substantive.length,
  fellBackToSmart: called.length - local.length,
  citedIds: rows.reduce((n, r) => n + r.cited.length, 0),
  invalidIds: rows.reduce((n, r) => n + r.invalid.length, 0),
  privateDataHits: rows.reduce((n, r) => n + r.privateData.length, 0),
  rows,
};
writeFileSync(file.replace(/\.json$/, '.rescored.json'), JSON.stringify(out, null, 2));
console.log(
  `${out.model}: ${out.questionsSentToModel} questions sent to the model (${out.modelCalls} calls); shown as Generated Locally ${out.shownLocal} ` +
    `(${out.shownLocalSubstantive} substantive, ${out.shownLocalAbstained} abstentions); fell back to Smart ${out.fellBackToSmart}; ` +
    `citation IDs ${out.citedIds} valid / ${out.invalidIds} invalid; private-data hits ${out.privateDataHits}`,
);
for (const r of local)
  console.log(
    `  ${r.id.padEnd(24)} ${r.abstained ? '[abstain] ' : ''}${(r.text ?? '').replace(/\s+/g, ' ').slice(0, 200)}`,
  );

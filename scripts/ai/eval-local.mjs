#!/usr/bin/env node
/**
 * Local AI golden-set evaluation on a real GPU (PIE spec §11). Drives the production build in
 * Chromium with WebGPU, asks every golden question through the real UI (?pie-eval=1 exposes the
 * raw attempts + verifier verdicts), and writes a JSON report for MODEL-EVALUATION.md.
 *
 *   node scripts/ai/eval-local.mjs --base http://localhost:3310 --model Qwen2.5-0.5B-Instruct-q4f16_1-MLC [--arabic] [--out file]
 *
 * Uses the git-ignored persistent profile .evidence-tmp/ai-gpu-profile so models download once.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = opt('base', 'http://localhost:3310');
const model = opt('model', 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
const arabic = args.includes('--arabic');
const set = opt('set', 'golden');
const out = opt(
  'out',
  `.evidence-tmp/ai/local-eval-${model}${arabic ? '-ar' : ''}${set === 'golden' ? '' : `-${set}`}.json`,
);
const golden = JSON.parse(
  readFileSync(
    `tests/fixtures/portfolio-ai/golden-set.${set === 'golden' ? 'v1' : 'heldout.v1'}.json`,
    'utf8',
  ),
);
const cases = golden.cases.filter((c) => (arabic ? c.lang === 'ar' : c.lang === 'en'));

const profile = path.resolve('.evidence-tmp/ai-gpu-profile');
mkdirSync(profile, { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  viewport: { width: 1440, height: 900 },
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const page = context.pages()[0] ?? (await context.newPage());
const hosts = new Map();
page.on('request', (r) => {
  const h = new URL(r.url()).host;
  hosts.set(h, (hosts.get(h) ?? 0) + 1);
});

const query = new URLSearchParams({
  intro: '0',
  'pie-eval': '1',
  'pie-model': model,
  ...(arabic ? { 'pie-ar': '1' } : {}),
});
await page.goto(`${base}/?${query}`);
const panel = page.getByTestId('ask-ai-panel');
await panel.scrollIntoViewIfNeeded();
await page.waitForFunction(
  () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-smart') === 'ready',
  null,
  { timeout: 60_000 },
);

const env = await page.evaluate(async () => {
  const adapter = await navigator.gpu?.requestAdapter();
  return {
    userAgent: navigator.userAgent,
    gpu: adapter
      ? {
          vendor: adapter.info?.vendor,
          architecture: adapter.info?.architecture,
          description: adapter.info?.description,
        }
      : null,
  };
});

const t0 = Date.now();
await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
await page.waitForFunction(
  () =>
    /consent|downloading|initializing|ready/.test(
      document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-local') ?? '',
    ),
  null,
  { timeout: 60_000 },
);
if ((await panel.getAttribute('data-local')) === 'consent')
  await panel.getByRole('button', { name: /Download and start|Start Local AI/ }).click();
await page.waitForFunction(
  () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-local') === 'ready',
  null,
  { timeout: 15 * 60_000 },
);
const initMs = Date.now() - t0;
console.log(`${model}: ready in ${initMs} ms`);

async function ask(question) {
  const before = await panel.getByTestId('assistant-answer').count();
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill(question);
  const started = Date.now();
  await box.press('Enter');
  const card = panel.getByTestId('assistant-answer').nth(Math.min(before, 7));
  await card.waitFor();
  await page.waitForFunction(
    (i) => {
      const cards = document.querySelectorAll(
        '[data-testid="ask-ai-panel"] [data-testid="assistant-answer"]',
      );
      const c = cards[Math.min(i, cards.length - 1)];
      return c && ['done', 'error', 'cancelled'].includes(c.getAttribute('data-turn-state') ?? '');
    },
    before,
    { timeout: 180_000 },
  );
  return { card, wallMs: Date.now() - started };
}

const results = [];
for (const c of cases) {
  await panel
    .getByRole('button', { name: 'Clear conversation' })
    .click()
    .catch(() => {});
  for (const h of c.history ?? []) await ask(h.question);
  const evalBefore = await page.evaluate(() => (window.__PIE_EVAL__ ?? []).length);
  const { card, wallMs } = await ask(c.question);
  const dom = await card.evaluate((el) => ({
    mode: el.getAttribute('data-mode'),
    status: el.getAttribute('data-status'),
    intent: el.getAttribute('data-intent'),
    text: el.querySelector('[lang]')?.textContent ?? '',
    notice: el.querySelector('p[class*="noticeLine"]')?.textContent ?? null,
    evidence: [...el.querySelectorAll('li')].map((li) => ({
      text: li.textContent,
      cited: li.getAttribute('data-cited') === 'true',
    })),
  }));
  const attempts = await page.evaluate((n) => (window.__PIE_EVAL__ ?? []).slice(n), evalBefore);
  results.push({
    id: c.id,
    category: c.category,
    kind: c.kind,
    question: c.question,
    wallMs,
    ...dom,
    attempts,
  });
  const a = attempts.at(-1);
  console.log(
    `${c.id.padEnd(24)} ${dom.mode?.padEnd(5)} ${String(dom.status).padEnd(21)} attempts=${attempts.length} ${a ? `ttft=${a.stats.ttftMs} tok/s=${a.stats.decodeTokPerS?.toFixed?.(1)} ok=${a.verification.ok}` : ''}`,
  );
}

const local = results.filter((r) => r.mode === 'local');
const allAttempts = results.flatMap((r) => r.attempts);
const cited = allAttempts.filter((a) => a.verification.citedIds.length > 0);
const invalid = allAttempts.filter((a) => a.verification.invalidIds.length > 0);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const summary = {
  model,
  arabic,
  initMs,
  environment: env,
  cases: results.length,
  generatedLocally: local.length,
  fallbacks: Object.fromEntries(
    Object.entries(
      results
        .filter((r) => r.mode === 'smart')
        .reduce((acc, r) => {
          const key = r.attempts.length ? 'not-grounded' : r.notice ? r.notice.slice(0, 48) : 'smart';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
    ),
  ),
  modelCalls: allAttempts.length,
  attemptsAccepted: allAttempts.filter((a) => a.verification.ok).length,
  rawCitationPresence: allAttempts.length ? cited.length / allAttempts.length : null,
  rawInvalidCitationRate: allAttempts.length ? invalid.length / allAttempts.length : null,
  citedIdValidity: (() => {
    const total = allAttempts.reduce(
      (n, a) => n + a.verification.citedIds.length + a.verification.invalidIds.length,
      0,
    );
    const valid = allAttempts.reduce((n, a) => n + a.verification.citedIds.length, 0);
    return total ? valid / total : null;
  })(),
  privateDataInRawOutput: allAttempts.filter((a) => a.verification.privateData.length > 0).length,
  rejectionReasons: allAttempts
    .filter((a) => !a.verification.ok)
    .map((a) => a.verification.reasons.join(' | ')),
  ttftMs: { mean: mean(allAttempts.map((a) => a.stats.ttftMs)), first: allAttempts[0]?.stats.ttftMs ?? null },
  decodeTokPerS: mean(allAttempts.map((a) => a.stats.decodeTokPerS).filter((x) => typeof x === 'number')),
  prefillTokPerS: mean(allAttempts.map((a) => a.stats.prefillTokPerS).filter((x) => typeof x === 'number')),
  requestsByHost: Object.fromEntries(hosts),
};
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ summary, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await context.close();

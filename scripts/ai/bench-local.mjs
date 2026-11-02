#!/usr/bin/env node
/**
 * Local AI benchmark + stress on a real GPU (PIE spec §12 items 5–6). In the production build:
 * cold or warm install time (stage timings, bytes per host), first-answer and steady TTFT,
 * decode speed, GPU memory of the browser (Windows "GPU Process Memory" counters via
 * scripts/ai/gpu-mem.ps1), page JS heap, and N enable → answer → Back-to-Smart cycles checking
 * that the 3D hold is released, WebGL stays ready and GPU memory returns after each exit.
 *
 *   node scripts/ai/bench-local.mjs --base http://localhost:3310 --model <catalog id> \
 *        --profile .evidence-tmp/ai-bench-cold --label cold [--cycles 10]
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = opt('base', 'http://localhost:3310');
const model = opt('model', 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
const profile = path.resolve(opt('profile', '.evidence-tmp/ai-bench'));
const label = opt('label', 'run');
const cycles = Number(opt('cycles', '0'));
mkdirSync(profile, { recursive: true });

const gpuMem = () => {
  try {
    return JSON.parse(
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          'scripts/ai/gpu-mem.ps1',
          '-Match',
          path.basename(profile),
        ],
        { encoding: 'utf8' },
      ).trim(),
    );
  } catch {
    return null;
  }
};

const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  viewport: { width: 1440, height: 900 },
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'],
});
const page = context.pages()[0] ?? (await context.newPage());
const bytes = {};
const errors = [];
page.on('response', (r) => {
  const host = new URL(r.url()).host;
  bytes[host] = (bytes[host] ?? 0) + Number(r.headers()['content-length'] ?? 0);
});
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)));

const panel = page.getByTestId('ask-ai-panel');
const local = () => panel.getAttribute('data-local');
const heap = () => page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
const hold = () => page.evaluate(() => window.__IU__?.state().aiRenderHold ?? null);
const webgl = () => page.evaluate(() => window.__IU__?.state().webgl ?? null);

await page.goto(`${base}/?intro=0&pie-eval=1&pie-model=${encodeURIComponent(model)}`);
await panel.scrollIntoViewIfNeeded();
await page.waitForFunction(
  () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-smart') === 'ready',
  null,
  { timeout: 60_000 },
);
await page.waitForTimeout(2000);
const report = {
  model,
  label,
  base,
  date: new Date().toISOString(),
  gpu: {},
  heap: {},
  stages: {},
  answers: [],
  cycles: [],
};
report.gpu.beforeLocal = gpuMem();
report.heap.beforeLocal = await heap();

async function enable() {
  const t0 = Date.now();
  await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
  await page.waitForFunction(
    () =>
      /consent|downloading|initializing|ready|unavailable|error/.test(
        document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-local') ?? '',
      ),
    null,
    { timeout: 60_000 },
  );
  const stages = { consentShown: null, accepted: null, downloading: null, initializing: null, ready: null };
  if ((await local()) === 'consent') {
    stages.consentShown = Date.now() - t0;
    await panel.getByRole('button', { name: /Download and start|Start Local AI/ }).click();
    stages.accepted = Date.now() - t0;
  }
  let peakDuringInit = null;
  for (;;) {
    const s = await local();
    if (s === 'downloading' && stages.downloading === null) stages.downloading = Date.now() - t0;
    if (s === 'initializing' && stages.initializing === null) {
      stages.initializing = Date.now() - t0;
    }
    if (s === 'initializing') peakDuringInit = { hold: await hold() };
    if (s === 'ready') {
      stages.ready = Date.now() - t0;
      break;
    }
    if (s === 'error' || s === 'resource-pressure' || s === 'unavailable')
      throw new Error(`Local AI failed: ${s}`);
    await page.waitForTimeout(150);
  }
  return { ...stages, holdDuringInit: peakDuringInit?.hold ?? null };
}

async function ask(question) {
  const n = await page.evaluate(() => (window.__PIE_EVAL__ ?? []).length);
  const count = await panel.getByTestId('assistant-answer').count();
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill(question);
  const t0 = Date.now();
  await box.press('Enter');
  let gpuDuring = null;
  let holdDuring = null;
  for (;;) {
    const done = await page.evaluate(
      (i) => {
        const cards = document.querySelectorAll(
          '[data-testid="ask-ai-panel"] [data-testid="assistant-answer"]',
        );
        const c = cards[Math.min(i, cards.length - 1)];
        return c ? c.getAttribute('data-turn-state') : null;
      },
      Math.min(count, 7),
    );
    if ((await local()) === 'generating' && gpuDuring === null) {
      holdDuring = await hold();
      gpuDuring = gpuMem();
    }
    if (done === 'done' || done === 'error' || done === 'cancelled') break;
    await page.waitForTimeout(150);
  }
  const attempts = await page.evaluate((i) => (window.__PIE_EVAL__ ?? []).slice(i), n);
  const card = panel.getByTestId('assistant-answer').last();
  return {
    question,
    wallMs: Date.now() - t0,
    mode: await card.getAttribute('data-mode'),
    attempts: attempts.map((a) => ({ ok: a.verification.ok, ...a.stats })),
    holdDuring,
    gpuDuring,
    holdAfter: await hold(),
  };
}

report.stages = await enable();
report.gpu.ready = gpuMem();
report.heap.ready = await heap();
for (const q of ['What does Islam work on?', 'How does this assistant work?', 'What is his email?'])
  report.answers.push(await ask(q));
report.gpu.afterAnswers = gpuMem();
await panel.getByRole('button', { name: 'Back to Smart Mode' }).first().click();
await page.waitForFunction(
  () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-local') === 'off',
);
await page.waitForTimeout(1500);
report.gpu.afterBack = gpuMem();
report.heap.afterBack = await heap();

for (let i = 0; i < cycles; i++) {
  const stages = await enable();
  const answer = await ask(i % 2 ? 'How can I contact him?' : 'What does Islam work on?');
  await panel.getByRole('button', { name: 'Back to Smart Mode' }).first().click();
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-local') === 'off',
  );
  await page.waitForTimeout(800);
  const row = {
    cycle: i + 1,
    readyMs: stages.ready,
    mode: answer.mode,
    ttftMs: answer.attempts[0]?.ttftMs ?? null,
    holdAfter: await hold(),
    webgl: await webgl(),
    gpuAfterBack: gpuMem()?.sharedBytes ?? null,
    heap: await heap(),
  };
  report.cycles.push(row);
  console.log(JSON.stringify(row));
}
report.bytesByHost = bytes;
report.errors = errors.slice(0, 20);
report.webglAtEnd = await webgl();
await context.close();
mkdirSync('docs/portfolio-intelligence-engine/evidence', { recursive: true });
const file = `docs/portfolio-intelligence-engine/evidence/local-bench-${model.split('-Instruct')[0]}-${label}.json`;
writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      stages: report.stages,
      gpu: report.gpu,
      answers: report.answers.map((a) => ({
        mode: a.mode,
        wallMs: a.wallMs,
        ttft: a.attempts[0]?.ttftMs,
        tps: a.attempts[0]?.decodeTokPerS,
        hold: a.holdDuring,
      })),
      bytesByHost: bytes,
      errors: report.errors,
    },
    null,
    2,
  ),
);

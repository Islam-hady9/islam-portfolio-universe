#!/usr/bin/env node
/**
 * Cinematic Fidelity V3 responsiveness A/B (real GPU, pinned tier, fresh browser per round,
 * rounds interleaved): (1) first hover of each project card → its live world composited
 * (`data-portal-live`), the moment heavier world shaders would show up as a hitch; (2) Enter →
 * Smart answer rendered (`data-turn-state="done"`) on the Ask My AI station with the portal live.
 *   node scripts/qa/fidelity-latency.mjs --a http://localhost:3320 --b http://localhost:3310 [--rounds 3]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const variants = { baseline: opt('a', 'http://localhost:3320'), feature: opt('b', 'http://localhost:3310') };
const rounds = Number(opt('rounds', '3'));
const tier = opt('tier', 'balanced');
const out = opt('out', `docs/cinematic-fidelity-v3/evidence/latency-ab-${tier}.json`);
const SLUGS = ['tibyn', 'movid', 'ats-matching', 'lifeatlas'];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function run(base) {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chromium',
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/?intro=0&quality=${tier}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() =>
    document.getElementById('projects').scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.waitForTimeout(2500);
  const hover = {};
  for (const slug of SLUGS) {
    const card = page.locator(`[data-project-card="${slug}"]`);
    const box = await card.boundingBox();
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.move(box.x + 150, box.y + 120);
    hover[slug] = await card.evaluate(
      (el, start) =>
        new Promise((done) => {
          const tick = () =>
            el.hasAttribute('data-portal-live')
              ? done(Math.round(performance.now() - start))
              : requestAnimationFrame(tick);
          tick();
        }),
      t0,
    );
    await page.waitForTimeout(1200);
  }
  await page.mouse.move(4, 450);
  await page.evaluate(() =>
    document.getElementById('ask-ai').scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const panel = page.getByTestId('ask-ai-panel');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-smart') === 'ready',
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(2500);
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill('What does Islam work on?');
  const answerMs = await page.evaluate(
    () =>
      new Promise((done) => {
        const input = document.querySelector(
          '[data-testid="ask-ai-panel"] input, [data-testid="ask-ai-panel"] textarea',
        );
        const start = performance.now();
        const tick = () =>
          document
            .querySelector('[data-testid="ask-ai-panel"] [data-testid="assistant-answer"]')
            ?.getAttribute('data-turn-state') === 'done'
            ? done(Math.round(performance.now() - start))
            : requestAnimationFrame(tick);
        input.form.requestSubmit();
        tick();
      }),
  );
  await browser.close();
  return { hover, answerMs };
}

const runs = [];
for (let i = 1; i <= rounds; i++) {
  const order = i % 2 ? Object.entries(variants) : Object.entries(variants).reverse();
  for (const [name, base] of order) {
    const r = await run(base);
    runs.push({ variant: name, round: i, ...r });
    console.log(name, i, JSON.stringify(r));
  }
}
const summary = Object.fromEntries(
  Object.keys(variants).map((name) => {
    const rs = runs.filter((r) => r.variant === name);
    return [
      name,
      {
        hoverToLiveMs: Object.fromEntries(SLUGS.map((s) => [s, median(rs.map((r) => r.hover[s]))])),
        answerMs: median(rs.map((r) => r.answerMs)),
      },
    ];
  }),
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `${JSON.stringify({ date: new Date().toISOString(), tier, rounds, variants, summary, runs }, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 1));

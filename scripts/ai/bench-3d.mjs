#!/usr/bin/env node
/**
 * 3D coexistence A/B (PIE spec §8 "Smart Mode interaction should not reduce frame rate
 * noticeably; target < 5 % median FPS regression"). Real GPU, pinned quality tier (governor off),
 * camera parked on the Ask My AI station. For each variant, interleaved:
 *   idle  — 8 s of frame-rate samples (renderer EMA, every 250 ms) after a 4 s settle;
 *   asking — 8 s of samples while 6 questions are typed and answered in the panel.
 *   node scripts/ai/bench-3d.mjs --a http://localhost:3320 --b http://localhost:3310 [--rounds 3] [--tier balanced]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const variants = { baseline: opt('a', 'http://localhost:3320'), feature: opt('b', 'http://localhost:3310') };
const rounds = Number(opt('rounds', '3'));
const tier = opt('tier', 'balanced');
const QUESTIONS = [
  'What does Islam work on?',
  'How can I contact him?',
  'Which projects can I explore?',
  'Can I see his CV?',
  'إسلام بيشتغل في إيه؟',
  'What is his salary?',
];
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function sample(page, ms, during) {
  const fps = [];
  const stop = Date.now() + ms;
  const work = during ? during() : Promise.resolve();
  while (Date.now() < stop) {
    const f = await page.evaluate(() => window.__IU__?.frame?.()?.fps ?? null);
    if (typeof f === 'number') fps.push(f);
    await page.waitForTimeout(250);
  }
  await work;
  return fps;
}

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const results = { tier, rounds, date: new Date().toISOString(), runs: [] };
for (let r = 0; r < rounds; r++) {
  for (const [name, base] of r % 2 ? Object.entries(variants).reverse() : Object.entries(variants)) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/?intro=0&quality=${tier}`);
    await page.waitForFunction(() => window.__IU__?.state().webgl === 'ready', null, { timeout: 60_000 });
    await page.evaluate(() => {
      const el = document.getElementById('ask-ai');
      const rect = el.getBoundingClientRect();
      window.scrollTo({
        top: rect.top + window.scrollY + rect.height / 2 - window.innerHeight / 2,
        behavior: 'instant',
      });
    });
    await page.waitForTimeout(4000);
    const idle = await sample(page, 8000);
    const input = page.locator('#ask-ai input').first();
    const asking = await sample(page, 8000, async () => {
      for (const q of QUESTIONS) {
        await input.fill(q);
        await input.press('Enter');
        await page.waitForTimeout(600);
      }
    });
    const gpu = await page.evaluate(() => window.__IU__?.frame?.());
    results.runs.push({
      round: r,
      variant: name,
      idleMedian: median(idle),
      askingMedian: median(asking),
      idle,
      asking,
      drawCalls: gpu?.drawCalls,
      programs: gpu?.programs,
    });
    console.log(
      `round ${r} ${name.padEnd(8)} idle ${median(idle)?.toFixed(1)} fps, asking ${median(asking)?.toFixed(1)} fps`,
    );
    await page.close();
  }
}
await browser.close();
const summary = {};
for (const name of Object.keys(variants)) {
  const runs = results.runs.filter((x) => x.variant === name);
  summary[name] = {
    idle: median(runs.map((x) => x.idleMedian)),
    asking: median(runs.map((x) => x.askingMedian)),
  };
}
summary.regressionIdlePct = ((summary.baseline.idle - summary.feature.idle) / summary.baseline.idle) * 100;
summary.regressionAskingPct =
  ((summary.baseline.asking - summary.feature.asking) / summary.baseline.asking) * 100;
results.summary = summary;
console.log(JSON.stringify(summary, null, 2));
mkdirSync('docs/portfolio-intelligence-engine/evidence', { recursive: true });
writeFileSync(
  'docs/portfolio-intelligence-engine/evidence/fps-ab.json',
  `${JSON.stringify(results, null, 2)}\n`,
);

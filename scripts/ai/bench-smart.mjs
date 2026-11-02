#!/usr/bin/env node
/**
 * Smart Mode in-browser benchmark (PIE spec §6 targets, §12 protocol). For each profile it loads
 * the production home page with ?pie-eval=1, scrolls to Ask My AI and records:
 *   - index ready: User Timing measures pie:smart-index (manifest parsed → index built) and
 *     pie:smart-total (lazy chunk + manifest fetch + index), excluding nothing;
 *   - answer latency: SmartEngine.answer() over every golden question, 10 rounds, p50/p95.
 * Profiles: desktop (no throttling) and mobile emulation (Pixel 7 viewport, 4× CPU throttling).
 *   node scripts/ai/bench-smart.mjs --base http://localhost:3310 [--runs 3]
 */
import { chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const base = opt('base', 'http://localhost:3310');
const runs = Number(opt('runs', '3'));
const golden = JSON.parse(readFileSync('tests/fixtures/portfolio-ai/golden-set.v1.json', 'utf8')).cases;

const profiles = [
  { name: 'desktop', context: { viewport: { width: 1440, height: 900 } }, cpu: 1 },
  { name: 'mobile-4x-cpu', context: { ...devices['Pixel 7'] }, cpu: 4 },
];
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const out = { base, runs, date: new Date().toISOString(), profiles: {} };

const browser = await chromium.launch({ channel: 'chromium' });
for (const prof of profiles) {
  const rows = [];
  for (let r = 0; r < runs; r++) {
    const context = await browser.newContext(prof.context);
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: prof.cpu });
    await page.goto(`${base}/?intro=0&quality=static&pie-eval=1`);
    const panel = page.getByTestId('ask-ai-panel');
    await panel.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !!window.__PIE_SMART__, null, { timeout: 60_000 });
    const timing = await page.evaluate(() =>
      Object.fromEntries(
        performance
          .getEntriesByType('measure')
          .filter((m) => m.name.startsWith('pie:'))
          .map((m) => [m.name, m.duration]),
      ),
    );
    const latencies = await page.evaluate((qs) => {
      const engine = window.__PIE_SMART__;
      const times = [];
      for (let round = 0; round < 10; round++) {
        for (const q of qs) {
          const t0 = performance.now();
          engine.answer(
            q.question,
            (q.history ?? []).map((h) => ({ question: h.question, answer: '', entity: h.entity })),
          );
          times.push(performance.now() - t0);
        }
      }
      return times;
    }, golden);
    rows.push({
      indexMs: timing['pie:smart-index'],
      totalMs: timing['pie:smart-total'],
      p50: pct(latencies, 0.5),
      p95: pct(latencies, 0.95),
      max: Math.max(...latencies),
    });
    await context.close();
  }
  out.profiles[prof.name] = {
    cpuThrottling: prof.cpu,
    runs: rows,
    median: Object.fromEntries(
      ['indexMs', 'totalMs', 'p50', 'p95', 'max'].map((k) => [
        k,
        pct(
          rows.map((x) => x[k]),
          0.5,
        ),
      ]),
    ),
  };
  console.log(prof.name, JSON.stringify(out.profiles[prof.name].median));
}
await browser.close();
mkdirSync('docs/portfolio-intelligence-engine/evidence', { recursive: true });
writeFileSync(
  'docs/portfolio-intelligence-engine/evidence/smart-browser-bench.json',
  `${JSON.stringify(out, null, 2)}\n`,
);

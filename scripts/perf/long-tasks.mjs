// Main-thread long tasks while the home page loads and the 3D enhancement starts, on the real GPU.
// "first" = fresh browser profile (cold HTTP + GPU shader caches); "repeat" = second visit in the
// same browser (warm caches). Σ blocking = sum over long tasks of (duration − 50 ms).
// Usage: node scripts/perf/long-tasks.mjs [baseUrl=http://localhost:3000] [--quality=balanced]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');
const quality = (args.find((a) => a.startsWith('--quality=')) ?? '').slice('--quality='.length);

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.__LONG_TASKS__ = [];
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) window.__LONG_TASKS__.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ type: 'longtask', buffered: true });
});

const rows = [];
for (const visit of ['first', 'repeat']) {
  const page = await context.newPage();
  await page.goto(`${base}/?intro=0${quality ? `&quality=${quality}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000, polling: 'raf' });
  const readyAt = await page.evaluate(() => Math.round(performance.now()));
  await page.waitForTimeout(1500);
  const { tasks, tier } = await page.evaluate(() => ({ tasks: window.__LONG_TASKS__, tier: window.__IU__.state().tier }));
  const blocking = tasks.reduce((sum, [, d]) => sum + Math.max(0, d - 50), 0);
  rows.push({ visit, tier, readyAtMs: readyAt, longTasks: tasks.map(([s, d]) => `(${s}, ${d})`).join(' '), blockingMs: blocking });
  await page.close();
}
await browser.close();
console.table(rows);

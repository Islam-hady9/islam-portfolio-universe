// Main-thread CPU profile of a cold home-page load on the real GPU (fresh profile, like
// Lighthouse desktop). Prints self time per function/URL, long tasks, and GL-call totals, so
// blocking work can be attributed (geometry builds, shader compiles, uniform queries…).
// Usage: node scripts/perf/cpu-profile.mjs [baseUrl=http://localhost:3000] [--quality=balanced] [--top=30]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');
const flag = (name, def) =>
  (args.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${def}`).split('=')[1];
const quality = flag('quality', '');
const top = Number(flag('top', 30));

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  window.__LT__ = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__LT__.push([Math.round(e.startTime), Math.round(e.duration)]);
  }).observe({ type: 'longtask', buffered: true });
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.goto(`${base}/?intro=0${quality ? `&quality=${quality}` : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, {
  timeout: 60000,
  polling: 'raf',
});
await page.waitForTimeout(2500);
const { profile } = await cdp.send('Profiler.stop');
const info = await page.evaluate(() => ({ tasks: window.__LT__, tier: window.__IU__.state().tier }));
await browser.close();

// Self time per node → aggregate by function + url.
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
  self.set(profile.samples[i], (self.get(profile.samples[i]) ?? 0) + dt);
}
const agg = new Map();
for (const [id, ms] of self) {
  const n = byId.get(id);
  const cf = n.callFrame;
  const url = cf.url ? cf.url.replace(base, '').replace(/\?.*$/, '') : '';
  const key = `${cf.functionName || '(anonymous)'}  ${url ? `${url}:${cf.lineNumber + 1}` : '(native)'}`;
  agg.set(key, (agg.get(key) ?? 0) + ms);
}
const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]);
const total = rows.reduce((s, [, ms]) => s + ms, 0);
console.log(`tier ${info.tier}; profiled ${total.toFixed(0)} ms of samples`);
console.log('long tasks (start, ms):', info.tasks.map(([s, d]) => `(${s}, ${d})`).join(' '));
console.log(
  'blocking Σ(d-50):',
  info.tasks.reduce((s, [, d]) => s + Math.max(0, d - 50), 0),
  'ms',
);
for (const [k, ms] of rows.slice(0, top)) console.log(`${ms.toFixed(1).padStart(8)} ms  ${k}`);

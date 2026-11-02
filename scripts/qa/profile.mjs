// Attributes hero frame cost: baseline FPS, then FPS with each named object hidden (?debug=1).
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:3100';
const quality = process.argv[3] ?? '';
const b = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${base}/?intro=0&debug=1${quality ? `&quality=${quality}` : ''}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
await p.waitForTimeout(3000);
const fps = () =>
  p.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = (t) => {
          n++;
          if (t - t0 < 2000) requestAnimationFrame(f);
          else res(Math.round(n / ((t - t0) / 1000)));
        };
        requestAnimationFrame(f);
      }),
  );
const out = { tier: await p.evaluate(() => window.__IU__.state().tier), baseline: await fps() };
for (const name of [
  'core-rings',
  'core-shell',
  'core-emitter',
  'core-glow',
  'core-fragments',
  'core-sparks',
  'hero-planet',
  'hero-terrain',
  'hero-dust',
  'sky',
  'stars-shell',
  'stars-volume',
]) {
  await p.evaluate((n) => window.__IU_DEBUG__.hide(n), name);
  await p.waitForTimeout(400);
  out[name] = await fps();
  await p.evaluate((n) => window.__IU_DEBUG__.show(n), name);
  await p.waitForTimeout(300);
}
console.log(JSON.stringify(out, null, 1));
await b.close();

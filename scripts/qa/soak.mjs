// Long-session soak + stress test on the real GPU. Each cycle: a rapid scroll sweep through all
// nine home stations (down and back up), then a client-side round trip home → case study (via
// the project card link, i.e. the portal transition) → back. After a forced GC it samples the JS
// heap and WebGL resource counts (geometries, textures, programs) and collects runtime errors,
// so growth across cycles exposes leaks or desynchronisation.
// Usage: node scripts/qa/soak.mjs <baseUrl> [--cycles=10] [--quality=ultra]
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000').replace(/\/$/, '');
const flag = (name, def) =>
  (args.find((a) => a.startsWith(`--${name}=`)) ?? `--${name}=${def}`).split('=')[1];
const cycles = Number(flag('cycles', 10));
const quality = flag('quality', 'ultra');
const ids = [
  'top',
  'identity',
  'universe',
  'projects',
  'philosophy',
  'capabilities',
  'experience',
  'ask-ai',
  'contact',
];

const browser = await chromium.launch({
  channel: 'chromium',
  args: [
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=d3d11',
    '--js-flags=--expose-gc',
    '--enable-precise-memory-info',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !/THREE\.Clock/.test(m.text()))
    errors.push(`console: ${m.text().slice(0, 200)}`);
});

const ready = () =>
  page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
const sample = async (label) => {
  await page.evaluate(() => window.gc?.());
  await page.waitForTimeout(300);
  return page.evaluate((label) => {
    const f = window.__IU__?.frame?.() ?? {};
    return {
      label,
      heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576),
      geometries: f.geometries,
      textures: f.textures,
      programs: f.programs,
      s: f.s,
      sTarget: f.sTarget,
    };
  }, label);
};

await page.goto(`${base}/?intro=0&quality=${quality}`, { waitUntil: 'networkidle' });
await ready();
await page.waitForTimeout(2500);
const rows = [await sample('start')];

for (let c = 1; c <= cycles; c++) {
  // Rapid scroll sweep (stress: the camera must stay in sync and never desynchronise).
  const anchors = await page.evaluate(
    (ids) =>
      ids.map((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return id === 'top' ? 0 : Math.round(window.scrollY + r.top + r.height / 2 - innerHeight / 2);
      }),
    ids,
  );
  for (const y of [...anchors, ...[...anchors].reverse()]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.waitForTimeout(110);
  }
  // Route round trip through the portal transition, then history back.
  await page.evaluate(() =>
    document.getElementById('projects').scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await page.waitForTimeout(900);
  const link = page.locator('[data-project-card="tibyn"] a').first();
  await link.hover();
  await page.waitForTimeout(500);
  await link.click();
  await page.waitForURL('**/projects/tibyn', { timeout: 15000 });
  await page.waitForTimeout(1600);
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });
  await page.waitForTimeout(1600);
  // Settle at the top, then check the camera parameter matches the scroll position.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  rows.push(await sample(`cycle ${c}`));
}
await browser.close();

console.table(rows);
const first = rows[1] ?? rows[0];
const last = rows[rows.length - 1];
console.log(
  JSON.stringify(
    {
      cycles,
      heapGrowthMB_afterCycle1: last.heapMB - first.heapMB,
      geometriesDelta: last.geometries - first.geometries,
      texturesDelta: last.textures - first.textures,
      programsDelta: last.programs - first.programs,
      cameraSynced: Math.abs(last.s - last.sTarget) < 0.01,
      errors,
    },
    null,
    2,
  ),
);

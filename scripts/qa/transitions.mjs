// Captures the 3D world (DOM hidden) *between* home stations on the real GPU, plus the identity
// station with the pointer at the top/middle/bottom of the screen. Station captures only show
// rest states; this catches artifacts that appear while travelling (e.g. the camera passing
// through a terrain layer) and pointer-parallax regressions.
// Usage: node scripts/qa/transitions.mjs <baseUrl> <outDir> [--w=1440] [--h=900] [--quality=ultra]
//        [--pairs=1,6,7] [--fractions=0.1,0.2,0.3,0.35,0.5,0.65]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: transitions.mjs <baseUrl> <outDir> [flags]');
  process.exit(2);
}
const flag = (name, def) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const width = Number(flag('w', 1440));
const height = Number(flag('h', 900));
const quality = flag('quality', 'ultra');
const pairs = flag('pairs', '0,1,2,3,4,5,6,7').split(',').map(Number);
const fractions = flag('fractions', '0.2,0.35,0.5,0.65').split(',').map(Number);
const ids = ['top', 'identity', 'universe', 'projects', 'philosophy', 'capabilities', 'experience', 'ask-ai', 'contact'];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base.replace(/\/$/, '')}/?intro=0&quality=${quality}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
await page.addStyleTag({ content: 'main, footer { opacity: 0 !important; }' });
const anchors = await page.evaluate(
  (ids) =>
    ids.map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return id === 'top' ? 0 : Math.round(window.scrollY + r.top + r.height / 2 - window.innerHeight / 2);
    }),
  ids,
);
const scrollTo = (y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);

// Identity station with the pointer at the screen extremes (pitch parallax near the hero ground).
await scrollTo(anchors[1]);
for (const [name, y] of [
  ['mid', height / 2],
  ['top', 2],
  ['bottom', height - 2],
]) {
  await page.mouse.move(width / 2, y, { steps: 4 });
  await page.waitForTimeout(2300);
  await page.screenshot({ path: join(outDir, `identity-pointer-${name}.png`) });
}
await page.mouse.move(width / 2, height / 2);

for (const i of pairs) {
  for (const f of fractions) {
    await scrollTo(Math.round(anchors[i] + (anchors[i + 1] - anchors[i]) * f));
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(outDir, `between-${ids[i]}-${ids[i + 1]}-${f}.png`) });
  }
}
await browser.close();
console.log(JSON.stringify({ outDir, anchors, pairs, fractions, pageErrors: errors }, null, 2));

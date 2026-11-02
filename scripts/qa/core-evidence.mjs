// Hero intelligence-core evidence on the real GPU: the full hero frame, a 2× close-up of the core
// and a motion strip (core region sampled over time), so before/after comparisons use identical
// framing. DOM is hidden for the close-up and strip.
// Usage: node scripts/qa/core-evidence.mjs <baseUrl> <outDir> [--quality=ultra] [--frames=6] [--every=450]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: core-evidence.mjs <baseUrl> <outDir> [flags]');
  process.exit(2);
}
const flag = (name, def) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const quality = flag('quality', 'ultra');
const frames = Number(flag('frames', 6));
const every = Number(flag('every', 450));
const url = `${base.replace(/\/$/, '')}/?intro=0&quality=${quality}`;
// Core region at 1440×900 (right ~55% of the hero, spec S1 composition).
const CORE = { x: 690, y: 40, width: 720, height: 760 };

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const errors = [];

async function open(scale) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await page.mouse.move(720, 450);
  await page.waitForTimeout(4500);
  return { context, page };
}

const a = await open(1);
await a.page.screenshot({ path: join(outDir, 'hero.png') });
await a.page.addStyleTag({
  content: 'main, header, footer { opacity: 0 !important; transition: none !important; }',
});
await a.page.waitForTimeout(300);
for (let i = 0; i < frames; i++) {
  await a.page.screenshot({ path: join(outDir, `strip-${i}.png`), clip: CORE });
  await a.page.waitForTimeout(every);
}
// Pointer parallax extremes (left / right) on the core region.
for (const [name, x] of [
  ['pointer-left', 40],
  ['pointer-right', 1400],
]) {
  await a.page.mouse.move(x, 450, { steps: 6 });
  await a.page.waitForTimeout(1600);
  await a.page.screenshot({ path: join(outDir, `${name}.png`), clip: CORE });
}
await a.context.close();

const b = await open(2);
await b.page.addStyleTag({
  content: 'main, header, footer { opacity: 0 !important; transition: none !important; }',
});
await b.page.waitForTimeout(300);
await b.page.screenshot({ path: join(outDir, 'core-2x.png'), clip: CORE });
const info = await b.page.evaluate(() => {
  const s = window.__IU__.state();
  return { tier: s.tier, webgl: s.webgl };
});
await b.context.close();
await browser.close();
console.log(JSON.stringify({ outDir, quality, ...info, pageErrors: errors }, null, 2));

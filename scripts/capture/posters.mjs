// Renders fallback posters from the site's own live scenes (spec §6.7: static/lite art that is
// original and matches the 3D). Requires a running server and a GPU-capable Chromium.
// Usage: node scripts/capture/posters.mjs [baseUrl=http://localhost:3100]
// Output: .evidence-tmp/posters/*.png (raw) → scripts/capture/encode-posters.py → public/images/posters
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3100';
const out = '.evidence-tmp/posters';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const hideDom = `main, header, footer, [data-testid="content-mode-notice"] { opacity: 0 !important; transition: none !important; }`;
const crops = {};

async function ready(url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(3500);
}

async function station(id, file) {
  const rect = await page.evaluate((sid) => {
    const el = document.getElementById(sid);
    const r = el.getBoundingClientRect();
    const y = sid === 'top' ? 0 : r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    return null;
  }, id);
  void rect;
  await page.waitForTimeout(3200);
  const style = await page.addStyleTag({ content: hideDom });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, file) });
  await style.evaluate((s) => s.remove());
}

// Home stations.
await ready(`${base}/?intro=0&quality=ultra`);
await station('top', 'hero.png');
crops.hero = { left: 0.38, top: 0, right: 1, bottom: 1 };
await station('universe', 'universe.png');
crops.universe = await page.evaluate(() => {
  const r = document.querySelector('[data-universe-stage]').getBoundingClientRect();
  return { left: r.left / innerWidth, top: Math.max(0, r.top) / innerHeight, right: r.right / innerWidth, bottom: Math.min(innerHeight, r.bottom) / innerHeight };
});
await station('experience', 'journey.png');
await station('ask-ai', 'portal.png');
crops.portal = { left: 0, top: 0, right: 0.45, bottom: 1 };
await station('contact', 'horizon.png');

// Project worlds: hover each card (live), hide the card's DOM overlays, shoot the card.
await page.evaluate(() => document.getElementById('projects').scrollIntoView({ block: 'center', behavior: 'instant' }));
await page.waitForTimeout(2500);
const overlay = await page.addStyleTag({
  content: `[data-project-card] > :not([data-portal-track]) { opacity: 0 !important; } [data-project-card]::before { opacity: 0 !important; } [data-project-card] { box-shadow: none !important; transform: none !important; }`,
});
for (const [slug, world] of [['tibyn', 'tibyn'], ['movid', 'movid'], ['ats-matching', 'ats'], ['lifeatlas', 'lifeatlas']]) {
  const card = page.locator(`[data-project-card="${slug}"]`);
  await card.hover({ position: { x: 60, y: 60 } });
  await page.waitForTimeout(1800);
  await card.screenshot({ path: join(out, `project-${world}.png`), scale: 'device' });
}
await overlay.evaluate((s) => s.remove());

// Case-study heroes (wide framing) + deep space for inner pages.
for (const [slug, world] of [['tibyn', 'tibyn'], ['movid', 'movid'], ['ats-matching', 'ats'], ['lifeatlas', 'lifeatlas']]) {
  await ready(`${base}/projects/${slug}?quality=ultra`);
  const style = await page.addStyleTag({ content: `header, footer, [data-case-study-hero] > :not([data-portal-track]), main > :not([data-case-study-hero]) { opacity: 0 !important; }` });
  await page.waitForTimeout(400);
  await page.locator('[data-case-study-hero] [data-portal-track]').screenshot({ path: join(out, `case-${world}.png`) });
  await style.evaluate((s) => s.remove());
}
await ready(`${base}/about?quality=ultra`);
const s2 = await page.addStyleTag({ content: hideDom });
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'deep-space.png') });
await s2.evaluate((s) => s.remove());

writeFileSync(join(out, 'crops.json'), JSON.stringify(crops, null, 2));
console.log('captured to', out, Object.keys(crops));
await browser.close();

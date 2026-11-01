// Portal QA: hovers each project card (live world), then clicks one and captures the
// expansion → navigation → settle sequence with timed screenshots.
// Usage: node scripts/qa/portal.mjs <baseUrl> <outDir> [--slug=movid] [--quality=ultra]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
const flag = (n, d) => {
  const hit = rest.find((a) => a.startsWith(`--${n}`));
  return hit ? (hit.split('=')[1] ?? true) : d;
};
const slug = flag('slug', 'movid');
const url = new URL(base);
url.searchParams.set('intro', '0');
if (flag('quality', null)) url.searchParams.set('quality', flag('quality'));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url.toString(), { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
await page.evaluate(() => document.getElementById('projects')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
await page.waitForTimeout(2500);

for (const s of ['tibyn', 'movid', 'ats-matching', 'lifeatlas']) {
  const card = page.locator(`[data-project-card="${s}"]`);
  await card.hover({ position: { x: 160, y: 120 } });
  await page.waitForTimeout(1600);
  const live = await card.evaluate((el) => el.hasAttribute('data-portal-live'));
  await card.screenshot({ path: join(outDir, `hover-${s}.png`) });
  console.log(`hover ${s}: live=${live}`);
}

const card = page.locator(`[data-project-card="${slug}"]`);
await card.hover();
await page.waitForTimeout(800);
const t0 = Date.now();
await card.locator('a').click();
for (const ms of [120, 380, 700, 1100, 1700, 2600]) {
  const wait = ms - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: join(outDir, `transition-${String(ms).padStart(4, '0')}.png`) });
}
await page.waitForTimeout(800);
console.log(JSON.stringify({ finalUrl: page.url(), portalAttr: await page.evaluate(() => document.documentElement.getAttribute('data-portal')), heroLive: await page.evaluate(() => !!document.querySelector('[data-case-study-hero] [data-portal-live], [data-portal-live][data-portal-track]')), errors }, null, 2));
await page.screenshot({ path: join(outDir, 'case-study-final.png') });
await browser.close();

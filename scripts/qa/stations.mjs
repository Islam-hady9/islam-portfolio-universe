// Captures each home station at its scroll anchor (section centred), after the camera settles.
// Usage: node scripts/qa/stations.mjs <baseUrl> <outDir> [--w=1440] [--h=900] [--gpu] [--quality=...]
//        [--only=hero,universe] [--settle=2600] [--mobile]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
const flag = (name, def) => {
  const hit = rest.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const [, v] = hit.split('=');
  return v === undefined ? true : v;
};
const width = Number(flag('w', 1440));
const height = Number(flag('h', 900));
const gpu = Boolean(flag('gpu', false));
const mobile = Boolean(flag('mobile', false));
const settle = Number(flag('settle', 2600));
const only = flag('only', '') ? String(flag('only')).split(',') : null;
const sections = [
  'top',
  'identity',
  'universe',
  'projects',
  'philosophy',
  'capabilities',
  'experience',
  'ask-ai',
  'contact',
].filter((s) => !only || only.includes(s));

const url = new URL(base);
url.searchParams.set('intro', '0');
if (flag('quality', null)) url.searchParams.set('quality', String(flag('quality')));

const browser = await chromium.launch({
  headless: true,
  channel: gpu ? 'chromium' : undefined,
  args: gpu
    ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url.toString(), { waitUntil: 'networkidle' });
await page
  .waitForFunction(() => window.__IU__?.state?.().webgl !== 'pending', null, { timeout: 20000 })
  .catch(() => {});
await page.waitForTimeout(2500);
mkdirSync(outDir, { recursive: true });
const report = [];
for (const id of sections) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const y = sid === 'top' ? 0 : r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
  }, id);
  await page.waitForTimeout(settle);
  const file = join(outDir, `${String(sections.indexOf(id)).padStart(2, '0')}-${id}.png`);
  await page.screenshot({ path: file });
  const diag = await page.evaluate(() => window.__IU__?.frame?.() ?? null);
  report.push({
    id,
    file,
    s: diag?.s,
    fps: diag?.fps,
    drawCalls: diag?.drawCalls,
    triangles: diag?.triangles,
  });
}
console.log(
  JSON.stringify(
    {
      state: await page.evaluate(() => {
        const s = window.__IU__?.state?.();
        return s ? { tier: s.tier, webgl: s.webgl } : null;
      }),
      report,
      errors: errors.slice(0, 10),
    },
    null,
    2,
  ),
);
await browser.close();

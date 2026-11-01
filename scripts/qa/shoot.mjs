// QA screenshot tool.
// Usage: node scripts/qa/shoot.mjs <url> <out.png> [--w=1440] [--h=900] [--full] [--headed]
//        [--wait=ms] [--scroll=y] [--reduced] [--mobile] [--quality=ultra|balanced|lite|static]
// --headed launches a visible Chromium that uses the real GPU (headless uses SwiftShader).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const [url, out, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: shoot.mjs <url> <out.png> [flags]');
  process.exit(2);
}
const flag = (name, def) => {
  const hit = rest.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const [, v] = hit.split('=');
  return v === undefined ? true : v;
};

const width = Number(flag('w', 1440));
const height = Number(flag('h', 900));
const headed = Boolean(flag('headed', false));
const mobile = Boolean(flag('mobile', false));
const quality = flag('quality', null);
const target = new URL(url);
if (quality) target.searchParams.set('quality', String(quality));
target.searchParams.set('intro', '0');

// --gpu: new-headless Chromium on the real GPU (ANGLE/D3D11) — no visible window.
const gpu = Boolean(flag('gpu', false));
const browser = await chromium.launch({
  headless: !headed,
  channel: gpu ? 'chromium' : undefined,
  args:
    headed || gpu
      ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-features=Vulkan']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: Number(flag('dpr', 1)),
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: flag('reduced', false) ? 'reduce' : 'no-preference',
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(target.toString(), { waitUntil: 'networkidle' });
if (flag('scrollthrough', false)) {
  // Walk the page so scroll-triggered reveals fire, as a visitor would.
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
  });
}
const scrollY = Number(flag('scroll', 0));
if (scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
}
const overflow = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
}));
if (overflow.scrollWidth > overflow.clientWidth) logs.push(`[overflow] scrollWidth ${overflow.scrollWidth} > ${overflow.clientWidth}`);
await page.waitForTimeout(Number(flag('wait', 1500)));
mkdirSync(dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: Boolean(flag('full', false)) });
const state = await page.evaluate(() => {
  const s = window.__IU__?.state?.();
  return s ? { tier: s.tier, webgl: s.webgl, reduced: s.reducedMotion, reason: s.tierReason } : null;
});
console.log(JSON.stringify({ out, state, logs: logs.slice(0, 20) }, null, 2));
await browser.close();

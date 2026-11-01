// Personal-media evidence on the real GPU: hero trigger, identity portrait, the reel player
// (playing, captions on) and the /about portrait, on desktop and a phone profile. Also reports
// which video variant the browser chose, whether any video bytes were requested before the
// player opened, and page errors.
// Usage: node scripts/qa/media-evidence.mjs <baseUrl> <outDir> [--only=desktop|mobile]
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: media-evidence.mjs <baseUrl> <outDir> [--only=desktop|mobile]');
  process.exit(2);
}
const only = (rest.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const root = base.replace(/\/$/, '');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const report = {};

const profiles = [
  { name: 'desktop', context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { name: 'mobile', context: { ...devices['iPhone 13'], defaultBrowserType: undefined } },
].filter((p) => !only || p.name === only);

async function settle(page, ms) {
  await page.waitForTimeout(ms);
}

async function imagesDecoded(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const img = document.querySelector(sel);
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0 && img.currentSrc;
    },
    selector,
    { timeout: 20000 },
  );
  return page.evaluate((sel) => document.querySelector(sel).currentSrc, selector);
}

for (const profile of profiles) {
  const { defaultBrowserType: _ignored, ...ctxOptions } = profile.context;
  const context = await browser.newContext(ctxOptions);
  const page = await context.newPage();
  const errors = [];
  const videoRequests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => {
    if (/\/media\/(video|posters)\//.test(r.url())) videoRequests.push({ url: r.url(), t: Date.now() });
  });
  const r = (report[profile.name] = {});

  await page.goto(`${root}/?intro=0`, { waitUntil: 'networkidle' });
  await page
    .waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 })
    .catch(() => {});
  await settle(page, 3500);
  await page.screenshot({ path: join(outDir, `hero-${profile.name}.png`) });
  if (profile.name === 'mobile') {
    // The reel chip sits under the CTA grid on phones: show it in context.
    // Just enough scroll to bring the chip in: further down, the hero copy fades by design.
    await page.locator('[data-action="hero-reel"]').evaluate((el) => {
      const r = el.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + Math.max(0, r.bottom - window.innerHeight + 28));
    });
    await settle(page, 1500);
    await page.screenshot({ path: join(outDir, `hero-cta-${profile.name}.png`) });
  }

  // Identity band with the portrait.
  await page.evaluate(() => document.getElementById('identity')?.scrollIntoView({ block: 'start' }));
  await settle(page, 2600);
  r.portraitSrc = await imagesDecoded(page, '#identity [data-portrait] img');
  const portraitBox = await page.locator('#identity [data-portrait]').boundingBox();
  await settle(page, 1200);
  await page.screenshot({ path: join(outDir, `identity-${profile.name}.png`) });
  if (portraitBox) {
    await page.screenshot({
      path: join(outDir, `portrait-${profile.name}.png`),
      clip: {
        x: Math.max(0, portraitBox.x - 40),
        y: Math.max(0, portraitBox.y - 30),
        width: Math.min(portraitBox.width + 80, page.viewportSize().width - Math.max(0, portraitBox.x - 40)),
        height: portraitBox.height + 60,
      },
    });
  }
  r.videoRequestsBeforeOpen = videoRequests.length;

  // Open the reel from the portrait's control (a real click / tap).
  const opener = page.locator('[data-action="identity-reel"]');
  if (profile.name === 'mobile') await opener.tap();
  else await opener.click();
  await page.waitForFunction(() => document.querySelector('dialog')?.open === true, null, { timeout: 10000 });
  await page.waitForFunction(() => (document.querySelector('dialog video')?.currentTime ?? 0) > 3.6, null, {
    timeout: 20000,
  });
  // Captions default to on; turn them on only if a stored preference switched them off.
  if ((await page.locator('dialog button[aria-label="Captions"]').getAttribute('aria-pressed')) !== 'true') {
    await page.keyboard.press('c');
  }
  await page.waitForFunction(() => (document.querySelector('dialog video')?.currentTime ?? 0) > 4.6, null, {
    timeout: 20000,
  });
  r.player = await page.evaluate(() => {
    const v = document.querySelector('dialog video');
    return {
      currentSrc: v.currentSrc.replace(location.origin, ''),
      paused: v.paused,
      muted: v.muted,
      time: Number(v.currentTime.toFixed(2)),
      size: [v.videoWidth, v.videoHeight],
      focus: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName,
      overflow: document.documentElement.style.overflow,
      worldPaused: window.__IU__?.state?.().mediaOverlay ?? null,
      caption: document.querySelector('dialog [data-captions]')?.textContent ?? null,
    };
  });
  await page.screenshot({ path: join(outDir, `reel-${profile.name}.png`) });
  if (profile.name === 'desktop') {
    await page.locator('dialog summary').click();
    await settle(page, 600);
    await page.screenshot({ path: join(outDir, `reel-transcript-${profile.name}.png`) });
    await page.locator('dialog summary').click();
  }

  // The closing name card.
  await page.evaluate(() => {
    const v = document.querySelector('dialog video');
    v.currentTime = 30.4;
  });
  await page.waitForFunction(() => (document.querySelector('dialog video')?.currentTime ?? 0) > 31.2, null, {
    timeout: 15000,
  });
  await page.screenshot({ path: join(outDir, `reel-end-${profile.name}.png`) });

  // Close with Escape: focus must return to the trigger, scrolling must be restored.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('dialog')?.open === false, null, { timeout: 5000 });
  r.afterClose = await page.evaluate(() => ({
    focus: document.activeElement?.getAttribute('data-action'),
    overflow: document.documentElement.style.overflow,
    paused: document.querySelector('dialog video')?.paused,
  }));

  // About page hero portrait.
  await page.goto(`${root}/about`, { waitUntil: 'networkidle' });
  r.aboutPortraitSrc = await imagesDecoded(page, 'header [data-portrait] img');
  await settle(page, 1500);
  await page.screenshot({ path: join(outDir, `about-${profile.name}.png`) });

  r.errors = errors;
  await context.close();
}

await browser.close();
writeFileSync(join(outDir, 'media-evidence.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

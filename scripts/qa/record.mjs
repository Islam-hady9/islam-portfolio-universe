// Records motion evidence (spec §13.1) on the real GPU: hero gyroscope + parallax, scroll
// journey, universe node approach, and the project portal transition.
// Usage: node scripts/qa/record.mjs <baseUrl> [outDir=docs/evidence/video]
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3000';
const outDir = process.argv[3] ?? 'docs/evidence/video';
mkdirSync(outDir, { recursive: true });
const size = { width: 1280, height: 800 };
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

async function clip(name, fn) {
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: outDir, size } });
  const page = await ctx.newPage();
  await fn(page);
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  renameSync(path, join(outDir, `${name}.webm`));
  console.log('recorded', name);
}

async function ready(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
}

const smoothScrollTo = (page, id, ms) =>
  page.evaluate(
    ([sid, dur]) =>
      new Promise((resolve) => {
        const el = document.getElementById(sid);
        const r = el.getBoundingClientRect();
        const to = r.top + window.scrollY + r.height / 2 - window.innerHeight / 2;
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / dur);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          window.scrollTo(0, from + (to - from) * e);
          if (k < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [id, ms],
  );

await clip('01-hero-gyroscope', async (page) => {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' }); // first visit: prelude + intro
  await page.waitForFunction(() => window.__IU__?.state?.().webgl === 'ready', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    await page.mouse.move(640 + Math.cos(a) * 420, 400 + Math.sin(a) * 260);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1200);
});

await clip('02-scroll-journey', async (page) => {
  await ready(page, `${base}/?intro=0`);
  await page.waitForTimeout(1500);
  for (const id of ['identity', 'universe', 'projects', 'capabilities', 'experience', 'ask-ai', 'contact']) {
    await smoothScrollTo(page, id, 1300);
    await page.waitForTimeout(700);
  }
});

await clip('03-universe-node-approach', async (page) => {
  await ready(page, `${base}/?intro=0`);
  await page.evaluate(() => {
    const el = document.getElementById('universe');
    const r = el.getBoundingClientRect();
    window.scrollTo(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2);
  });
  await page.waitForTimeout(2600);
  for (const id of ['ai-systems', 'products', 'case-studies', 'contact']) {
    await page.locator(`[data-node="${id}"] a`).hover();
    await page.waitForTimeout(900);
  }
  await page.locator('[data-node="experience"] a').click();
  await page.waitForTimeout(3200);
});

await clip('04-project-portal-transition', async (page) => {
  await ready(page, `${base}/?intro=0`);
  await page.evaluate(() => document.getElementById('projects').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(2200);
  for (const slug of ['tibyn', 'movid', 'ats-matching', 'lifeatlas']) {
    const card = page.locator(`[data-project-card="${slug}"]`);
    const box = await card.boundingBox();
    for (let i = 0; i <= 8; i++) {
      await page.mouse.move(box.x + box.width * (0.2 + 0.07 * i), box.y + box.height * (0.3 + 0.03 * i));
      await page.waitForTimeout(110);
    }
  }
  await page.locator('[data-project-card="lifeatlas"] a').click();
  await page.waitForTimeout(4000);
});

await browser.close();

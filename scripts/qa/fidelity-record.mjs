// Cinematic Fidelity V3 motion recordings on the real GPU (kept local: raw video is not committed).
// Clips: the Ask My AI station (portal breathing, light packets, convergence wave, then the single
// response pulse after a Smart answer), hovering across the four project cards (live worlds and
// their microanimations) and the TIBYN case-study hero.
// Usage: node scripts/qa/fidelity-record.mjs <baseUrl> [outDir=.evidence-tmp/v3/video] [--quality=ultra]
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const [base = 'http://localhost:3310', outDir = '.evidence-tmp/v3/video', ...rest] = process.argv.slice(2);
const quality = (rest.find((a) => a.startsWith('--quality=')) ?? '--quality=ultra').slice(10);
mkdirSync(outDir, { recursive: true });
const size = { width: 1280, height: 800 };
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

async function clip(name, path, fn) {
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: outDir, size } });
  const page = await ctx.newPage();
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}intro=0&quality=${quality}`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => window.__IU__?.state?.().webgl !== 'pending', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await fn(page);
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), join(outDir, `${name}.webm`));
  console.log('recorded', name);
}

const centre = (page, id) =>
  page.evaluate((sid) => {
    const el = document.getElementById(sid);
    const r = el.getBoundingClientRect();
    window.scrollTo({
      top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2,
      behavior: 'instant',
    });
  }, id);

await clip('v3-portal-and-response', '/', async (page) => {
  await centre(page, 'ask-ai');
  await page.waitForTimeout(8000);
  const box = page.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill('What does Islam work on?');
  await box.press('Enter');
  await page.waitForTimeout(5000);
});

await clip('v3-card-worlds', '/', async (page) => {
  await centre(page, 'projects');
  await page.waitForTimeout(1500);
  for (const slug of ['tibyn', 'movid', 'ats-matching', 'lifeatlas']) {
    await page.locator(`[data-project-card="${slug}"]`).hover({ position: { x: 150, y: 120 } });
    await page.waitForTimeout(3500);
  }
});

await clip('v3-case-tibyn', '/projects/tibyn', async (page) => {
  await page.waitForTimeout(6000);
});

await browser.close();

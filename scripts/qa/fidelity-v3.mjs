// Cinematic Fidelity V3 evidence: matched captures (viewport, tier, scroll anchor, hover target)
// of the surfaces the pass refines, plus renderer resource counts at each capture.
// Usage: node scripts/qa/fidelity-v3.mjs <baseUrl> <outDir> [--quality=ultra] [--skip=mobile,cs]
// Real GPU (Chromium + ANGLE/D3D11). Run the same command against the before and after builds.
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base, outDir, ...rest] = process.argv.slice(2);
const flag = (n, d) => {
  const hit = rest.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  return hit ? (hit.split('=')[1] ?? true) : d;
};
const quality = String(flag('quality', 'ultra'));
const skip = String(flag('skip', '')).split(',');
const SLUGS = ['tibyn', 'movid', 'ats-matching', 'lifeatlas'];
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});
const report = { base, quality, date: new Date().toISOString(), captures: [], errors: [] };

const href = (path, q = quality) => {
  const u = new URL(path, base);
  u.searchParams.set('intro', '0');
  u.searchParams.set('quality', q);
  return u.toString();
};
const diag = (page) =>
  page.evaluate(() => {
    const f = window.__IU__?.frame?.();
    const s = window.__IU__?.state?.();
    return f
      ? {
          tier: s?.tier,
          fps: f.fps,
          drawCalls: f.drawCalls,
          triangles: f.triangles,
          points: f.points,
          programs: f.programs,
          geometries: f.geometries,
          textures: f.textures,
        }
      : { tier: s?.tier, webgl: s?.webgl };
  });
const ready = (page) =>
  page
    .waitForFunction(() => window.__IU__?.state?.().webgl !== 'pending', null, { timeout: 30000 })
    .catch(() => {});
const centre = (page, id) =>
  page.evaluate((sid) => {
    const el = document.getElementById(sid);
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollTo({
      top: Math.max(0, r.top + window.scrollY + r.height / 2 - window.innerHeight / 2),
      behavior: 'instant',
    });
  }, id);
async function shot(page, name, opts = {}) {
  const file = join(outDir, `${name}.png`);
  if (opts.locator) await opts.locator.screenshot({ path: file });
  else await page.screenshot({ path: file, clip: opts.clip });
  report.captures.push({ name, ...(await diag(page)) });
}
async function strip(page, name, frames, gap, opts) {
  for (let i = 0; i < frames; i++) {
    await shot(page, `${name}-f${i}`, opts);
    await page.waitForTimeout(gap);
  }
}
async function open(context, path, q) {
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(`${path}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${path}: ${m.text()}`));
  await page.goto(href(path, q), { waitUntil: 'networkidle' });
  await ready(page);
  await page.waitForTimeout(2500);
  return page;
}

// ── Desktop 1440×900 ──────────────────────────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
{
  const page = await open(desktop, '/');
  await centre(page, 'projects');
  await page.waitForTimeout(2600);
  await shot(page, 'd-projects');
  for (const slug of SLUGS) {
    const card = page.locator(`[data-project-card="${slug}"]`);
    await card.hover({ position: { x: 160, y: 120 } });
    await page.waitForTimeout(1600);
    await strip(page, `world-${slug}`, 4, 350, { locator: card });
  }
  await page.mouse.move(4, 450);
  await centre(page, 'ask-ai');
  await page.waitForTimeout(3200);
  await shot(page, 'd-ask-ai');
  // Portal + figure close-up (left column of the section at this viewport) and a motion strip.
  await strip(page, 'portal', 6, 300, { clip: { x: 40, y: 150, width: 560, height: 500 } });
  const panel = page.getByTestId('ask-ai-panel');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-smart') === 'ready',
    null,
    { timeout: 20000 },
  );
  await shot(page, 'ai-panel-ready', { locator: panel });
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill('What does Islam work on?');
  await box.press('Enter');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="ask-ai-panel"] [data-testid="assistant-answer"]')
        ?.getAttribute('data-turn-state') === 'done',
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(700);
  await shot(page, 'ai-panel-answer', { locator: panel });
  await shot(page, 'd-ask-ai-answer');
  for (const id of ['philosophy', 'capabilities']) {
    await centre(page, id);
    await page.waitForTimeout(2600);
    await shot(page, `d-${id}`);
  }
  await page.close();
}
if (!skip.includes('cs')) {
  const page = await open(desktop, '/projects');
  await shot(page, 'd-listing');
  await page.close();
  for (const slug of SLUGS) {
    const cs = await open(desktop, `/projects/${slug}`);
    await cs.waitForTimeout(1000);
    await shot(cs, `cs-${slug}`);
    await cs.close();
  }
}
await desktop.close();

// ── Mobile (Pixel 7 emulation, same real GPU; not a physical phone) ──────────────────────────
if (!skip.includes('mobile')) {
  const mobile = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await open(mobile, '/', 'balanced');
  for (const id of ['projects', 'ask-ai']) {
    await centre(page, id);
    await page.waitForTimeout(3000);
    await shot(page, `m-${id}`);
  }
  await page.close();
  const cs = await open(mobile, '/projects/movid', 'balanced');
  await shot(cs, 'm-cs-movid');
  await cs.close();
  await mobile.close();
}

await browser.close();
writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      captures: report.captures.length,
      errors: report.errors.slice(0, 8),
      sample: report.captures.filter((c) => !/-f[1-9]$/.test(c.name)),
    },
    null,
    1,
  ),
);

// AI Presence V1 evidence on the real GPU: hero with the AI entry, the orb, the drawer on desktop
// and on an emulated phone, an answer with citations, the Local AI consent state (WebGPU faked so
// nothing downloads), the original Ask My AI section and the conversation surviving navigation.
// Usage: node scripts/qa/presence-shots.mjs <baseUrl> <outDir> [--quality=ultra]
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [base = 'http://localhost:3310', outDir = '.evidence-tmp/presence', ...rest] = process.argv.slice(2);
const quality = (rest.find((a) => a.startsWith('--quality=')) ?? '--quality=ultra').slice(10);
mkdirSync(outDir, { recursive: true });
const errors = [];
const requests = [];
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
});

async function page(context) {
  const p = await context.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('request', (r) => requests.push(r.url()));
  return p;
}
const url = (path) => `${base}${path}${path.includes('?') ? '&' : '?'}intro=0&quality=${quality}`;
const ready = (p) =>
  p
    .waitForFunction(() => window.__IU__?.state?.().webgl !== 'pending', null, { timeout: 30000 })
    .catch(() => {});
/** Clicks (or taps) the visible part of the orb — it may be tucked past the screen edge. */
async function openOrb(p, touch = false) {
  const body = p.locator('[data-testid="assistant-orb"] [data-orb-body]');
  await body.waitFor({ state: 'visible' });
  const b = await body.boundingBox();
  const vw = p.viewportSize().width;
  const x = b.x + (Math.min(b.x + b.width, vw - 1) - b.x) / 2;
  const y = b.y + b.height / 2;
  if (touch) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
}
const answered = (p, n) =>
  p.waitForFunction(
    (count) => {
      const all = document.querySelectorAll('[data-ai-host="drawer"] [data-testid="assistant-answer"]');
      return all.length >= count && all[count - 1]?.getAttribute('data-turn-state') === 'done';
    },
    n,
    { timeout: 20000 },
  );

// ── Desktop ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await page(ctx);
  await p.goto(url('/'), { waitUntil: 'networkidle' });
  await ready(p);
  await p.waitForTimeout(2600);
  await p.screenshot({ path: join(outDir, 'd-01-hero-entry-orb.png') });
  await p.getByTestId('hero-ai-entry').screenshot({ path: join(outDir, 'd-02-hero-entry.png') });
  await p.getByTestId('assistant-orb').hover();
  await p.waitForTimeout(500);
  await p.screenshot({
    path: join(outDir, 'd-03-orb-hover.png'),
    clip: { x: 1100, y: 760, width: 340, height: 140 },
  });
  // Hero suggestion → drawer opens and answers.
  await p.getByRole('button', { name: 'What does Islam build?' }).click();
  await p.getByTestId('assistant-drawer').waitFor({ state: 'visible' });
  await answered(p, 1);
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(outDir, 'd-04-drawer-answer.png') });
  // Ask a second question in the drawer, then close with Escape.
  const box = p.locator('[data-ai-host="drawer"] [data-assistant-input]');
  await box.fill('How can I contact him?');
  await box.press('Enter');
  await answered(p, 2);
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(outDir, 'd-05-drawer-citations.png') });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  const focusedAfterClose = await p.evaluate(() => document.activeElement?.getAttribute('data-action'));
  // The original section shows the same conversation.
  await p.evaluate(() =>
    document.getElementById('ask-ai')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await p.waitForTimeout(2600);
  await p.screenshot({ path: join(outDir, 'd-06-section-same-conversation.png') });
  const sectionTurns = await p.locator('[data-ai-host="section"] [data-testid="assistant-answer"]').count();
  // Client-side navigation (header link), then reopen with Ctrl+K: the session survives.
  await p.locator('header a[href="/projects"]').first().click();
  await p.waitForURL(/\/projects$/);
  await p.waitForTimeout(1500);
  await p.keyboard.press('Control+k');
  await p.getByTestId('assistant-drawer').waitFor({ state: 'visible' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: join(outDir, 'd-07-projects-drawer.png') });
  const turnsAfterNav = await p.locator('[data-ai-host="drawer"] [data-testid="assistant-answer"]').count();
  writeFileSync(
    join(outDir, 'desktop.json'),
    JSON.stringify({ focusedAfterClose, sectionTurns, turnsAfterNav }, null, 2),
  );
  await ctx.close();
}

// ── Local AI consent (WebGPU faked: the consent card, no download) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    const adapter = {
      features: new Set(['shader-f16']),
      limits: { maxStorageBufferBindingSize: 2 ** 31, maxBufferSize: 2 ** 31 },
      info: { vendor: 'test', architecture: 'test' },
    };
    Object.defineProperty(Navigator.prototype, 'gpu', {
      configurable: true,
      get: () => ({ requestAdapter: async () => adapter }),
    });
  });
  const p = await page(ctx);
  await p.goto(url('/about'), { waitUntil: 'networkidle' });
  await ready(p);
  await openOrb(p);
  await p.getByTestId('assistant-drawer').waitFor({ state: 'visible' });
  await p.locator('[data-ai-host="drawer"] [data-action="try-local"]').click();
  await p.locator('[data-ai-host="drawer"] [data-testid="local-ai-consent"]').waitFor();
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(outDir, 'd-08-drawer-local-consent.png') });
  await ctx.close();
}

// ── Phone (Pixel 7 emulation; not a physical device) ──
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const p = await page(ctx);
  await p.goto(url('/').replace(`quality=${quality}`, 'quality=balanced'), { waitUntil: 'networkidle' });
  await ready(p);
  await p.waitForTimeout(2600);
  await p.screenshot({ path: join(outDir, 'm-01-hero-orb.png') });
  await openOrb(p, true);
  await p.getByTestId('assistant-drawer').waitFor({ state: 'visible' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(outDir, 'm-02-drawer.png') });
  await p.locator('[data-ai-host="drawer"] [data-action="assistant-prompt"]').first().tap();
  await answered(p, 1);
  await p.waitForTimeout(600);
  await p.screenshot({ path: join(outDir, 'm-03-drawer-answer.png') });
  await ctx.close();
}

await browser.close();
const modelHosts = requests.filter((u) => /huggingface|hf\.co|mlc|raw\.githubusercontent/.test(u));
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ errors, modelRequests: modelHosts }, null, 2));
console.log(JSON.stringify({ errors: errors.slice(0, 10), modelRequests: modelHosts.length }, null, 1));

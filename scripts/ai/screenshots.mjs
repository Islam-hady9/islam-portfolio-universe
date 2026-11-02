#!/usr/bin/env node
/**
 * Evidence screenshots of the Ask My AI states that need no real GPU (static 3D tier).
 * Element screenshots of the panel, written to docs/portfolio-intelligence-engine/evidence/screens/.
 *   node scripts/ai/screenshots.mjs --base http://localhost:3310
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3310';
const dir = 'docs/portfolio-intelligence-engine/evidence/screens';
mkdirSync(dir, { recursive: true });

const fakeGpu = () => {
  const adapter = {
    features: new Set(['shader-f16']),
    limits: { maxStorageBufferBindingSize: 2 ** 31, maxBufferSize: 2 ** 31 },
    info: { vendor: 'test', architecture: 'test' },
  };
  Object.defineProperty(Navigator.prototype, 'gpu', {
    configurable: true,
    get: () => ({ requestAdapter: async () => adapter }),
  });
};
const noGpu = () =>
  Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined });

const browser = await chromium.launch({ channel: 'chromium' });

async function open(device, init) {
  const context = await browser.newContext(device);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.goto(`${base}/?intro=0&quality=static`);
  const panel = page.getByTestId('ask-ai-panel');
  await panel.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction(
    () => document.querySelector('[data-testid="ask-ai-panel"]')?.getAttribute('data-smart') === 'ready',
  );
  await page.waitForTimeout(600);
  return { context, page, panel };
}

async function ask(page, panel, q) {
  const n = await panel.getByTestId('assistant-answer').count();
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill(q);
  await box.press('Enter');
  await page.waitForFunction(
    (i) =>
      document
        .querySelectorAll('[data-testid="ask-ai-panel"] [data-testid="assistant-answer"]')
        [i]?.getAttribute('data-turn-state') === 'done',
    Math.min(n, 7),
  );
  await page.waitForTimeout(500);
}

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
{
  const { context, page, panel } = await open(desktop);
  await panel.screenshot({ path: `${dir}/01-smart-ready.png` });
  await ask(page, panel, 'What does Islam work on?');
  await panel.screenshot({ path: `${dir}/02-smart-answer-en.png` });
  await panel.getByRole('button', { name: 'Clear conversation' }).click();
  await ask(page, panel, 'إسلام بيشتغل في إيه؟');
  await panel.screenshot({ path: `${dir}/03-smart-answer-ar.png` });
  await panel.getByRole('button', { name: 'Clear conversation' }).click();
  await ask(page, panel, 'What is his salary?');
  await panel.screenshot({ path: `${dir}/04-smart-refusal.png` });
  await panel.getByRole('button', { name: 'Clear conversation' }).click();
  await ask(page, panel, 'Which projects can I explore?');
  await panel.screenshot({ path: `${dir}/05-smart-projects-pending.png` });
  await page.locator('#ask-ai').screenshot({ path: `${dir}/06-section-desktop.png` });
  await context.close();
}
{
  const { context, panel } = await open(desktop, fakeGpu);
  await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
  await panel.getByTestId('local-ai-consent').waitFor();
  await panel.screenshot({ path: `${dir}/07-local-consent.png` });
  await context.close();
}
{
  const { context, panel } = await open(desktop, noGpu);
  await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
  await panel.getByTestId('local-ai-card').waitFor();
  await panel.screenshot({ path: `${dir}/08-local-unavailable.png` });
  await context.close();
}
{
  const { context, page, panel } = await open({ ...devices['Pixel 7'] });
  await ask(page, panel, 'How can I contact him?');
  await panel.screenshot({ path: `${dir}/09-mobile-smart-answer.png` });
  await context.close();
}
await browser.close();
console.log(`screenshots written to ${dir}`);

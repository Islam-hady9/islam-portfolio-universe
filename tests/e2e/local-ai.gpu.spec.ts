import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { sectionPanel } from './helpers';

/**
 * Local AI on a real GPU (opt-in `gpu` project: `npm run test:e2e:gpu -- -g "Local AI"`).
 * Uses a persistent, git-ignored browser profile so the model downloads once (cold run) and is
 * served from Cache Storage afterwards (warm runs). Requires network access to Hugging Face /
 * GitHub on the cold run. Never part of the default suite.
 */
const PROFILE = path.resolve('.evidence-tmp/ai-gpu-profile');
const MODEL_HOSTS = /huggingface\.co|\.hf\.co\/|raw\.githubusercontent\.com/;

test.describe.configure({ mode: 'serial', timeout: 10 * 60_000 });

let context: BrowserContext;
let page: Page;
const requests: { url: string; method: string; at: number }[] = [];
let consentAt = Number.POSITIVE_INFINITY;

test.beforeAll(async ({ baseURL }) => {
  mkdirSync(PROFILE, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chromium',
    viewport: { width: 1440, height: 900 },
    baseURL,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
  });
  page = context.pages()[0] ?? (await context.newPage());
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), at: Date.now() }));
});

test.afterAll(async () => {
  await context?.close();
});

async function ask(question: string) {
  const panel = page.getByTestId('ask-ai-panel');
  const count = await panel.getByTestId('assistant-answer').count();
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill(question);
  await box.press('Enter');
  return panel.getByTestId('assistant-answer').nth(Math.min(count, 7));
}

test('Local AI: consent → download/initialize → streamed, cited answer', async () => {
  await page.goto('/?intro=0');
  const panel = await sectionPanel(page);
  await expect(panel).toHaveAttribute('data-smart', 'ready', { timeout: 30_000 });
  expect(await page.evaluate(() => typeof navigator.gpu)).toBe('object');

  await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
  await expect
    .poll(() => panel.getAttribute('data-local'), { timeout: 30_000 })
    .toMatch(/consent|downloading|initializing|ready/);
  if ((await panel.getAttribute('data-local')) === 'consent') {
    expect(requests.filter((r) => MODEL_HOSTS.test(r.url))).toEqual([]);
    consentAt = Date.now();
    await panel.getByRole('button', { name: /Download and start|Start Local AI/ }).click();
  }
  await expect(panel).toHaveAttribute('data-local', 'ready', { timeout: 8 * 60_000 });
  await expect(panel.getByTestId('ask-ai-mode')).toContainText('Local AI');
  expect(await page.evaluate(() => window.__IU__?.state().aiRenderHold)).toBe(false);

  // Model bytes only after consent (or from cache).
  for (const r of requests.filter((x) => MODEL_HOSTS.test(x.url)))
    expect(r.at).toBeGreaterThanOrEqual(consentAt === Number.POSITIVE_INFINITY ? 0 : consentAt);

  const answer = await ask('What does Islam work on?');
  // The render loop pauses while the model writes.
  await expect
    .poll(() => page.evaluate(() => window.__IU__?.state().aiRenderHold), { timeout: 30_000 })
    .toBe(true);
  await expect(answer).toHaveAttribute('data-turn-state', 'done', { timeout: 120_000 });
  expect(await page.evaluate(() => window.__IU__?.state().aiRenderHold)).toBe(false);
  const mode = await answer.getAttribute('data-mode');
  if (mode === 'local') {
    await expect(answer).toContainText('Generated Locally');
    await expect(answer).toContainText('Sources given to the model');
  } else {
    // Verification failed twice: the grounded Smart answer must say so.
    await expect(answer).toContainText('Smart Answer');
    await expect(answer).toContainText(/couldn’t be verified|Smart Mode/);
  }
  await expect(page.getByTestId('ask-ai-live')).toContainText(/Generated Locally|Smart Answer/);
});

test('Local AI: blocked questions never reach the model and are labelled Smart', async () => {
  const answer = await ask('What is his salary?');
  await expect(answer).toHaveAttribute('data-turn-state', 'done', { timeout: 30_000 });
  await expect(answer).toHaveAttribute('data-mode', 'smart');
  await expect(answer).toHaveAttribute('data-status', 'refused');
  await expect(answer).toContainText('this request isn’t sent to the local model');
});

test('Local AI: stop mid-generation keeps the question and stays usable', async () => {
  const panel = page.getByTestId('ask-ai-panel');
  const answer = await ask('How can I contact him?');
  await expect(panel).toHaveAttribute('data-local', 'generating', { timeout: 30_000 });
  await panel.getByRole('button', { name: 'Stop' }).click();
  await expect(answer).toHaveAttribute('data-turn-state', /cancelled|done/, { timeout: 30_000 });
  if ((await answer.getAttribute('data-turn-state')) === 'cancelled') {
    await expect(panel).toHaveAttribute('data-state', 'local-cancelled');
    await expect(panel.getByRole('textbox', { name: /Ask about Islam/ })).toHaveValue(
      'How can I contact him?',
    );
  }
  await expect(panel).toHaveAttribute('data-local', 'ready');
  expect(await page.evaluate(() => window.__IU__?.state().aiRenderHold)).toBe(false);
});

test('Local AI in the global drawer: the same local session, and the orb follows generation (AI Presence V1)', async () => {
  const EVIDENCE = '.evidence-tmp/presence';
  mkdirSync(EVIDENCE, { recursive: true });
  const section = page.locator('[data-ai-host="section"] [data-testid="ask-ai-panel"]');
  const turns = await section.getByTestId('assistant-answer').count();
  // Away from the section the orb is on screen; its left part is always visible (it may tuck).
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  const orbBody = page.locator('[data-testid="assistant-orb"] [data-orb-body]');
  await orbBody.click({ position: { x: 12, y: 27 } });
  const drawer = page.locator('[data-ai-host="drawer"] [data-testid="ask-ai-panel"]');
  await expect(drawer).toBeVisible();
  // One instance: the drawer shows the very session the section built — same mode, same model.
  await expect(drawer).toHaveAttribute('data-mode', 'local');
  await expect(drawer).toHaveAttribute('data-local', 'ready');
  await expect(drawer.getByTestId('assistant-answer')).toHaveCount(turns);
  expect(await page.evaluate(() => window.__IU__?.state().assistantOpen)).toBe(true);

  const box = drawer.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill('How can I contact him?');
  await box.press('Enter');
  await expect(drawer).toHaveAttribute('data-local', 'generating', { timeout: 30_000 });
  // Close mid-generation: the answer keeps streaming in the shared session and the orb shows it.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('assistant-drawer')).toBeHidden();
  const orb = page.getByTestId('assistant-orb');
  await expect(orb).toHaveAttribute('data-phase', 'generating');
  await expect(orb).toHaveAccessibleName(/writing an answer/);
  const b = (await orbBody.boundingBox())!;
  const x0 = Math.max(0, b.x - 300);
  const y0 = Math.max(0, b.y - 60);
  await page.screenshot({
    path: `${EVIDENCE}/g-01-orb-generating.png`,
    clip: { x: x0, y: y0, width: 1440 - x0, height: Math.min(140, 900 - y0) },
  });
  const answer = section.getByTestId('assistant-answer').nth(Math.min(turns, 7));
  await expect(answer).toHaveAttribute('data-turn-state', 'done', { timeout: 120_000 });
  await expect(orb).toHaveAttribute('data-phase', /complete|fallback/);

  // Reopen: the finished local answer is in the drawer too.
  await orbBody.click({ position: { x: 12, y: 27 } });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByTestId('assistant-answer')).toHaveCount(Math.min(turns + 1, 8));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${EVIDENCE}/g-02-drawer-local-answer.png` });
  await page.getByRole('button', { name: 'Close Ask My AI' }).click();
  await expect(page.getByTestId('assistant-drawer')).toBeHidden();
});

test('Local AI: back to Smart Mode releases the model and the 3D hold', async () => {
  const panel = page.getByTestId('ask-ai-panel');
  await panel.getByRole('button', { name: 'Back to Smart Mode' }).first().click();
  await expect(panel).toHaveAttribute('data-mode', 'smart');
  await expect(panel).toHaveAttribute('data-local', 'off');
  expect(await page.evaluate(() => window.__IU__?.state().aiRenderHold)).toBe(false);
  const answer = await ask('Can I see his CV?');
  await expect(answer).toHaveAttribute('data-mode', 'smart');
  // No inference traffic: only GETs, only to this origin and the pinned model hosts.
  const origin = new URL(page.url()).origin;
  for (const r of requests) {
    expect(r.method, r.url).toBe('GET');
    expect(
      r.url.startsWith(origin) ||
        MODEL_HOSTS.test(r.url) ||
        r.url.startsWith('data:') ||
        r.url.startsWith('blob:'),
      r.url,
    ).toBe(true);
  }
});

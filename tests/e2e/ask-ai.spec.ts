import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoHome, trackErrors } from './helpers';

/**
 * Portfolio Intelligence Engine — Smart Mode in every browser, and every Local AI path that does
 * not need a real GPU (unsupported, consent, decline, offline). The real-GPU flow lives in
 * local-ai.gpu.spec.ts (opt-in `gpu` project).
 */
const MODEL_HOSTS = /huggingface\.co|\.hf\.co\/|raw\.githubusercontent\.com/;

const watch = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
};

async function openPanel(page: Page) {
  await gotoHome(page, 'quality=static');
  const panel = page.getByTestId('ask-ai-panel');
  // Instant scroll (no actionability wait): slow engines under load keep reveals animating.
  await panel.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(panel).toHaveAttribute('data-smart', 'ready', { timeout: 15_000 });
  return panel;
}

async function ask(panel: Locator, question: string) {
  const before = await panel.getByTestId('assistant-answer').count();
  const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
  await box.fill(question);
  await box.press('Enter');
  const last = panel.getByTestId('assistant-answer').nth(Math.min(before, 7));
  await expect(last).toHaveAttribute('data-turn-state', 'done');
  return panel.getByTestId('assistant-answer').last();
}

/** A WebGPU adapter that satisfies the capability check (no real inference happens). */
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

test.describe('Ask My AI — Smart Mode', () => {
  test('loads lazily: no manifest or model bytes until the section is near', async ({ page }) => {
    const urls = watch(page);
    await gotoHome(page, 'quality=static');
    await page.waitForTimeout(1500);
    expect(urls.filter((u) => u.includes('/ai/knowledge.json'))).toEqual([]);
    const panel = page.getByTestId('ask-ai-panel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveAttribute('data-smart', 'ready', { timeout: 15_000 });
    expect(urls.filter((u) => u.includes('/ai/knowledge.json'))).toHaveLength(1);
    expect(urls.filter((u) => MODEL_HOSTS.test(u) || /turbopack-worker/.test(u))).toEqual([]);
  });

  test('labels, notice and a sourced English answer', async ({ page }) => {
    const errors = trackErrors(page);
    const panel = await openPanel(page);
    await expect(panel.getByTestId('ask-ai-mode')).toContainText('Smart Mode');
    await expect(panel.getByTestId('ask-ai-mode')).toContainText('Instant answers from portfolio');
    await expect(panel.getByRole('button', { name: 'Try Local AI (runs on your device)' })).toBeVisible();
    await expect(panel.getByText('Answers use approved public portfolio information only.')).toBeVisible();
    await expect(page.getByText('Concept Preview — AI assistant not yet connected')).toHaveCount(0);

    const answer = await ask(panel, 'What does Islam work on?');
    await expect(answer).toHaveAttribute('data-mode', 'smart');
    await expect(answer).toContainText('Smart Answer');
    await expect(answer).toContainText('AI Full-Stack Engineer');
    await expect(answer.getByText('Sources')).toBeVisible();
    // Each source links to where the approved text is published.
    await expect(answer.locator('a[href="/about"]').first()).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'smart-answer');
    await expect(page.getByTestId('ask-ai-live')).toContainText('Smart Answer');
    expect(errors).toEqual([]);
  });

  test('Arabic question gets a right-to-left Arabic answer', async ({ page }) => {
    const panel = await openPanel(page);
    const answer = await ask(panel, 'إسلام بيشتغل في إيه؟');
    await expect(answer.locator('[lang="ar"]')).toHaveAttribute('dir', 'rtl');
    await expect(answer).toContainText('هذا ما يقوله الموقع');
  });

  test('refuses private questions, abstains without evidence, resolves follow-ups, clears', async ({
    page,
  }) => {
    const panel = await openPanel(page);
    await expect(await ask(panel, 'What is his salary?')).toHaveAttribute('data-status', 'refused');
    await expect(panel).toHaveAttribute('data-state', 'smart-no-match');
    await expect(await ask(panel, 'What is his favourite food?')).toContainText(
      "I don't have verified information on that yet.",
    );
    await ask(panel, 'Tell me about TIBYN');
    const followUp = await ask(panel, 'Tell me more about that project.');
    await expect(followUp).toHaveAttribute('data-intent', 'project:project-tibyn');
    await expect(followUp.getByRole('link', { name: 'TIBYN' })).toHaveAttribute('href', '/projects/tibyn');
    await panel.getByRole('button', { name: 'Clear conversation' }).click();
    await expect(panel.getByTestId('assistant-answer')).toHaveCount(0);
  });

  test('suggestions answer with one click', async ({ page }) => {
    const panel = await openPanel(page);
    await panel.getByRole('button', { name: 'How can I contact him?' }).click();
    const answer = panel.getByTestId('assistant-answer').last();
    await expect(answer).toHaveAttribute('data-turn-state', 'done');
    await expect(answer.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute('href', /linkedin\.com/);
  });
});

test.describe('Ask My AI — Local AI without a real GPU', () => {
  test('no WebGPU: explained, Smart Mode keeps working, nothing downloaded', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'gpu', { configurable: true, get: () => undefined }),
    );
    const urls = watch(page);
    const panel = await openPanel(page);
    await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(panel).toHaveAttribute('data-state', 'local-unavailable');
    await expect(panel.getByTestId('local-ai-card')).toContainText('WebGPU');
    await expect(await ask(panel, 'How can I contact him?')).toHaveAttribute('data-mode', 'smart');
    expect(urls.filter((u) => MODEL_HOSTS.test(u))).toEqual([]);
  });

  test('consent discloses download size, license and privacy; declining downloads nothing', async ({
    page,
  }) => {
    await page.addInitScript(fakeGpu);
    const urls = watch(page);
    const panel = await openPanel(page);
    await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    const consent = panel.getByTestId('local-ai-consent');
    await expect(consent).toBeVisible();
    await expect(panel).toHaveAttribute('data-state', 'local-consent');
    await expect(consent).toContainText('MB');
    await expect(consent).toContainText('Apache-2.0');
    await expect(consent).toContainText('nothing is sent to a server');
    await expect(consent).toContainText('3D scene pauses');
    // Two models; touch-first devices get the light one preselected; the disclosure follows the choice.
    await expect(consent.getByRole('radio')).toHaveCount(2);
    const lite = consent.getByRole('radio', { name: /0\.5B/ });
    const standard = consent.getByRole('radio', { name: /1\.5B/ });
    if (test.info().project.name === 'chromium-mobile') await expect(lite).toBeChecked();
    else await expect(standard).toBeChecked();
    await lite.check();
    await expect(consent).toContainText('284 MB once');
    await standard.check();
    await expect(consent).toContainText('875 MB once');
    await consent.getByRole('button', { name: 'Not now' }).click();
    await expect(panel).toHaveAttribute('data-local', 'off');
    expect(urls.filter((u) => MODEL_HOSTS.test(u) || /turbopack-worker/.test(u))).toEqual([]);
  });

  test('offline with no stored model: honest state, Smart Mode still answers', async ({ page, context }) => {
    await page.addInitScript(fakeGpu);
    const panel = await openPanel(page);
    await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(panel.getByTestId('local-ai-consent')).toBeVisible();
    await context.setOffline(true);
    await panel.getByRole('button', { name: 'Download and start' }).click();
    await expect(panel).toHaveAttribute('data-state', 'offline-without-model');
    await expect(await ask(panel, 'How can I contact him?')).toContainText('@');
    await context.setOffline(false);
  });

  test('a second tab cannot start a second local model', async ({ page, context }) => {
    await context.addInitScript(fakeGpu);
    const first = await openPanel(page);
    await first.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(first.getByTestId('local-ai-consent')).toBeVisible();
    const other = await context.newPage();
    const second = await openPanel(other);
    await second.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(second).toHaveAttribute('data-state', 'local-unavailable');
    await expect(second.getByTestId('local-ai-card')).toContainText('another tab');
    // Releasing it in the first tab lets the second one proceed.
    await first.getByRole('button', { name: 'Not now' }).click();
    await second.getByRole('button', { name: 'Back to Smart Mode' }).first().click();
    await second.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(second.getByTestId('local-ai-consent')).toBeVisible();
    await other.close();
  });

  test('answer and consent states have no serious accessibility violations', async ({ page }) => {
    await page.addInitScript(fakeGpu);
    const panel = await openPanel(page);
    const audit = async () =>
      (await new AxeBuilder({ page }).include('[data-testid="ask-ai-panel"]').analyze()).violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
    await ask(panel, 'What does Islam work on?');
    await ask(panel, 'إسلام بيشتغل في إيه؟');
    expect(await audit()).toEqual([]);
    await panel.getByRole('button', { name: 'Try Local AI (runs on your device)' }).click();
    await expect(panel.getByTestId('local-ai-consent')).toBeVisible();
    expect(await audit()).toEqual([]);
  });

  test('reduced motion is honoured', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const panel = await openPanel(page);
    await expect(panel).toHaveAttribute('data-motion', 'reduced');
  });
});

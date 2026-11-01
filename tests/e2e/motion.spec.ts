import { expect, test } from '@playwright/test';
import { gotoHome, trackErrors } from './helpers';

test.describe('motion, intro and fallbacks (IU-010, IU-011, IU-014, IU-022)', () => {
  test('reduced motion: no prelude, no hidden reveals, motion flag set', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
    await expect(page.locator('[data-prelude]')).toBeHidden();
    // Content far below the fold is visible without scroll-triggered reveals.
    await page.locator('#capabilities').scrollIntoViewIfNeeded();
    const hidden = await page.$$eval('[data-reveal], [data-reveal-item]', (els) =>
      els.filter((e) => getComputedStyle(e).opacity === '0' || getComputedStyle(e).visibility === 'hidden').length,
    );
    expect(hidden).toBe(0);
    await context.close();
  });

  test('prelude plays once per session, is skippable and capped', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'playing');
    await expect(page.locator('[data-prelude]')).toBeVisible();
    const t0 = Date.now();
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done', { timeout: 3500 });
    expect(Date.now() - t0).toBeLessThan(2600);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
  });

  test('skip intro button ends the prelude immediately', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
    await context.close();
  });

  test('no-WebGL browsers get the full site with static art', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (/webgl/i.test(type)) return null;
        return (orig as (...a: unknown[]) => unknown).call(this, type, ...args);
      } as typeof orig;
    });
    const page = await context.newPage();
    const errors = trackErrors(page);
    await gotoHome(page);
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().tier)).toBe('static');
    await expect(page.locator('html')).toHaveAttribute('data-webgl', 'disabled');
    await expect(page.locator('[data-testid="experience-layer"] canvas')).toHaveCount(0);
    await expect(page.locator('[data-scene-art="hero"]')).toBeVisible();
    await page.locator('[data-action="hero-explore"]').click();
    await expect(page).toHaveURL(/#universe$/);
    await page.locator('[data-project-card="ats-matching"] a').click();
    await expect(page).toHaveURL(/\/projects\/ats-matching$/);
    expect(errors).toEqual([]);
    await context.close();
  });

  test('quality and motion preferences apply live and persist', async ({ page }) => {
    await gotoHome(page);
    await page.getByRole('button', { name: 'Motion and visual quality settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Experience settings' });
    await dialog.getByLabel(/^Static/).check();
    await expect(page.locator('html')).toHaveAttribute('data-quality', 'static');
    await dialog.getByLabel('Reduce motion').check();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect(page.getByTestId('quality-status')).toContainText('Static');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().qualityPreference)).toBe('static');
  });

  test('forced lite tier renders WebGL and survives a context loss', async ({ page }) => {
    test.slow();
    await gotoHome(page, 'quality=lite');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
    const lost = await page.evaluate(() => window.__IU__?.loseContext?.());
    expect(lost).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl)).toBe('lost');
    // DOM stays usable while the context is gone.
    await page.locator('[data-action="hero-talk"]').click();
    await expect(page).toHaveURL(/#contact$/);
    await page.evaluate(() => window.__IU__?.restoreContext?.());
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
  });
});

import { expect, test } from '@playwright/test';
import { ROUTES, gotoHome, trackErrors } from './helpers';

/** Cross-browser smoke (Chromium desktop/mobile, Firefox, WebKit). */
test.describe('smoke', () => {
  test('all routes render their h1 without runtime errors', async ({ page }) => {
    const errors = trackErrors(page);
    for (const route of ROUTES) {
      const res = await page.goto(route === '/' ? '/?intro=0' : route);
      expect(res?.status(), route).toBe(200);
      await expect(page.locator('h1'), route).toHaveCount(1);
    }
    expect(errors).toEqual([]);
  });

  test('primary journey: home → project → contact', async ({ page }) => {
    await gotoHome(page);
    await page.locator('[data-project-card="tibyn"] a').click();
    await expect(page).toHaveURL(/\/projects\/tibyn$/);
    await page.locator('[data-action="cs-contact"]').click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Intelligent');
  });
});

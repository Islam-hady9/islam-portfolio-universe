import { expect, test } from '@playwright/test';
import { ROUTES, gotoHome, trackErrors } from './helpers';

/** Cross-browser smoke (Chromium desktop/mobile, Firefox, WebKit). */
test.describe('smoke', () => {
  test('all routes render their h1 without runtime errors', async ({ page }) => {
    // Ten navigations, each waiting for network idle (deferred posters load after first paint):
    // Firefox/WebKit under a parallel full run need more than the default 45 s budget.
    test.setTimeout(90_000);
    const errors = trackErrors(page);
    for (const route of ROUTES) {
      // Let link prefetches finish before leaving: WebKit reports prefetches cancelled by a
      // navigation as unhandled "access control" rejections (benign, not user-facing).
      const res = await page.goto(route === '/' ? '/?intro=0' : route, { waitUntil: 'networkidle' });
      expect(res?.status(), route).toBe(200);
      await expect(page.locator('h1'), route).toHaveCount(1);
    }
    // WebKit reports RSC prefetches aborted by a hard page.goto as "access control checks"
    // rejections — a test-harness artifact (client-side navigation never aborts them this way).
    // Only that exact pattern is excluded; any other error fails the test.
    const prefetchAborts = /\?_rsc=\S+ due to access control checks/;
    expect(errors.filter((e) => !prefetchAborts.test(e))).toEqual([]);
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

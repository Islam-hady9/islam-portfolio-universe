import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { gotoHome, noHorizontalOverflow, scrollThrough } from './helpers';

/**
 * Responsive evidence (spec §13.1): full-page and hero screenshots at the six required
 * viewports, written to docs/evidence/screenshots, plus overflow checks and two pixel
 * baselines (static tier → deterministic rendering).
 */
const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1920, h: 1080 },
  { w: 1024, h: 768 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
  { w: 320, h: 640 },
];
const OUT = 'docs/evidence/screenshots';

test.describe('responsive layouts & screenshots (IU-001, IU-009, IU-020)', () => {
  test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

  for (const vp of VIEWPORTS) {
    test(`home ${vp.w}x${vp.h}: no overflow, evidence captured`, async ({ browser }) => {
      const mobile = vp.w < 768;
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      await gotoHome(page, 'quality=static');
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${OUT}/home-hero-${vp.w}x${vp.h}.png` });
      await scrollThrough(page);
      await noHorizontalOverflow(page);
      await page.screenshot({ path: `${OUT}/home-full-${vp.w}x${vp.h}.png`, fullPage: true });
      for (const route of ['/projects', '/projects/tibyn', '/about', '/contact']) {
        await page.goto(`${route}?quality=static`);
        await noHorizontalOverflow(page);
      }
      await page.goto('/projects/tibyn?quality=static');
      await page.screenshot({ path: `${OUT}/case-study-${vp.w}x${vp.h}.png` });
      await context.close();
    });
  }

  test('pixel baseline: hero (static tier)', async ({ page }) => {
    await gotoHome(page, 'quality=static');
    await expect(page).toHaveScreenshot('hero-static.png', { fullPage: false });
  });

  test('pixel baseline: projects index (static tier)', async ({ page }) => {
    await page.goto('/projects?quality=static');
    await expect(page).toHaveScreenshot('projects-static.png', { fullPage: false });
  });
});

import { expect, test } from '@playwright/test';
import { expectInViewport, gotoHome, noHorizontalOverflow } from './helpers';

test.describe('mobile & touch (IU-009)', () => {
  test('mobile menu: open, navigate, focus management, escape', async ({ page }) => {
    await gotoHome(page);
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.tap();
    const menu = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link').first()).toBeFocused();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
    await page.getByRole('button', { name: 'Open menu' }).tap();
    await page
      .getByRole('navigation', { name: 'Mobile primary' })
      .getByRole('link', { name: 'Experience' })
      .tap();
    await expectInViewport(page, '#experience');
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeHidden();
  });

  test('universe becomes a vertical list of tappable destinations', async ({ page }) => {
    await gotoHome(page);
    const list = page.locator('[data-universe-nodes]');
    await list.scrollIntoViewIfNeeded();
    await expect(list).toHaveAttribute('data-mode', 'static');
    const rects = await page.$$eval('[data-universe-nodes] [data-node] a', (as) =>
      as.map((a) => a.getBoundingClientRect().top),
    );
    for (let i = 1; i < rects.length; i++) expect(rects[i]!).toBeGreaterThan(rects[i - 1]!);
    const target = page.locator('[data-node="contact"] a');
    const size = await target.evaluate((a) => a.getBoundingClientRect().height);
    expect(size).toBeGreaterThanOrEqual(44);
    await target.tap();
    await expectInViewport(page, '#contact');
  });

  test('touch targets and layout at phone width', async ({ page }) => {
    await gotoHome(page);
    await noHorizontalOverflow(page);
    const small = await page.$$eval('main a, main button', (els) =>
      els
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          // Stretched links (card titles) expose their whole card via an absolutely positioned ::after.
          const after = getComputedStyle(e, '::after');
          const stretched = after.content !== 'none' && after.position === 'absolute';
          return (
            !stretched &&
            r.width > 0 &&
            r.height > 0 &&
            s.visibility !== 'hidden' &&
            (r.height < 32 || r.width < 32)
          );
        })
        .map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 40)),
    );
    expect(small, `undersized touch targets: ${small.join(', ')}`).toEqual([]);
  });
});

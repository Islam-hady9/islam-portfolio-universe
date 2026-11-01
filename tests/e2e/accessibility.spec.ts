import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ROUTES, gotoHome, scrollThrough } from './helpers';

test.describe('accessibility (IU-010, WCAG 2.2 AA where feasible)', () => {
  for (const route of [...ROUTES, '/projects/unknown-slug']) {
    test(`axe: ${route}`, async ({ page }, testInfo) => {
      await page.goto(route === '/' ? '/?intro=0' : route);
      await scrollThrough(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      await testInfo.attach('axe-violations', {
        body: JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
            help: v.help,
          })),
          null,
          2,
        ),
        contentType: 'application/json',
      });
      expect(
        serious,
        serious
          .map(
            (v) =>
              `${v.id}: ${v.help} (${v.nodes
                .map((n) => n.target.join(' '))
                .slice(0, 3)
                .join(' | ')})`,
          )
          .join('\n'),
      ).toEqual([]);
    });
  }

  test('skip link moves focus to main content', async ({ page }) => {
    await gotoHome(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await expect(page.locator('#main')).toBeFocused();
  });

  test('keyboard reaches hero CTAs, universe destinations and journey milestones', async ({ page }) => {
    await gotoHome(page);
    const explore = page.locator('[data-action="hero-explore"]');
    for (let i = 0; i < 25 && !(await explore.evaluate((el) => el === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(explore).toBeFocused();
    await page.locator('[data-node="stack"] a').focus();
    await expect(page.locator('[data-node="stack"] a')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#capabilities$/);
    const milestones = page.locator('[data-milestone]');
    await milestones.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(milestones.nth(1)).toBeFocused();
    await expect(milestones.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('End');
    await expect(milestones.last()).toBeFocused();
  });

  test('settings panel is keyboard operable and closes with Escape', async ({ page }) => {
    await gotoHome(page);
    const toggle = page.getByRole('button', { name: 'Motion and visual quality settings' });
    await toggle.click();
    const dialog = page.getByRole('dialog', { name: 'Experience settings' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('every page has exactly one h1 and a main landmark', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route === '/' ? '/?intro=0' : route);
      await expect(page.locator('h1'), route).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
    }
  });
});

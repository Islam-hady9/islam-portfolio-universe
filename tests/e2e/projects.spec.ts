import { expect, test } from '@playwright/test';
import { gotoHome, trackErrors } from './helpers';

const PROJECTS = [
  { slug: 'tibyn', title: 'TIBYN' },
  { slug: 'movid', title: 'MOViD Studio' },
  { slug: 'ats-matching', title: 'ATS Matching' },
  { slug: 'lifeatlas', title: 'LifeAtlas' },
];

test.describe('projects & case studies (IU-005, IU-016)', () => {
  test('every featured card opens its working case study', async ({ page }) => {
    const errors = trackErrors(page);
    for (const p of PROJECTS) {
      await gotoHome(page);
      await page.locator(`[data-project-card="${p.slug}"] a`).click();
      await expect(page).toHaveURL(new RegExp(`/projects/${p.slug}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title);
      await expect(page.getByText('Detailed case study coming after content review')).toBeVisible();
      await expect(page.getByTestId('case-study-pending')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('case studies are server-rendered and crawlable', async ({ request }) => {
    for (const p of PROJECTS) {
      const res = await request.get(`/projects/${p.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<h1`);
      expect(html).toContain(p.title);
      expect(html).toMatch(/<meta name="description"/);
    }
  });

  test('illustrative diagrams are labelled; LifeAtlas is a concept', async ({ page }) => {
    await page.goto('/projects/tibyn');
    await expect(page.getByText('Illustrative template')).toBeVisible();
    await expect(page.getByText('Diagram as text')).toBeVisible();
    await page.goto('/projects/lifeatlas');
    await expect(page.getByText('Concept / In development').first()).toBeVisible();
    await expect(page.getByText('Illustrative template')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/health/i);
  });

  test('unknown slug returns a real 404', async ({ page }) => {
    const res = await page.goto('/projects/does-not-exist');
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This world isn't on the map.")).toBeVisible();
    await page.getByRole('link', { name: /Return to the universe/ }).click();
    await expect(page.locator('#hero-title')).toBeVisible();
  });

  test('projects index filters and switches layout', async ({ page }) => {
    await page.goto('/projects');
    const status = page.getByRole('status').filter({ hasText: 'Showing' });
    await expect(status).toHaveText(/Showing 4 of 4/);
    await page.getByRole('button', { name: 'AI × MEDIA' }).click();
    await expect(status).toHaveText(/Showing 1 of 4/);
    await expect(page.locator('[data-project-card]')).toHaveCount(1);
    await page.getByRole('button', { name: /^All/ }).click();
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('link', { name: 'ATS Matching' })).toHaveAttribute('href', '/projects/ats-matching');
  });

  test('case study navigation: next world, related, back to universe', async ({ page }) => {
    await page.goto('/projects/tibyn');
    await page.getByRole('link', { name: /MOViD Studio →/ }).click();
    await expect(page).toHaveURL(/\/projects\/movid$/);
    await page.locator('[data-action="cs-back-universe"]').click();
    await expect(page).toHaveURL(/\/#projects$/);
    await gotoHome(page);
  });
});

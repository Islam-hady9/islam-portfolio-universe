import { expect, test } from '@playwright/test';
import { SECTIONS, expectInViewport, gotoHome, trackErrors } from './helpers';

test.describe('home & navigation (IU-002, IU-006)', () => {
  test('home renders semantic content with no runtime errors', async ({ page }) => {
    const errors = trackErrors(page);
    await gotoHome(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/ISLAM\s*ABD-ELHADY/);
    await expect(page.locator('#top').getByText('AI FULL-STACK ENGINEER')).toBeVisible();
    await expect(page.getByText('Architecting AI Products, Systems, and Experiences.')).toBeVisible();
    for (const id of SECTIONS) await expect(page.locator(`#${id}`)).toHaveCount(1);
    expect(await page.locator('main h2').count()).toBeGreaterThanOrEqual(SECTIONS.length);
    expect(errors).toEqual([]);
  });

  test('section order follows the approved narrative', async ({ page }) => {
    await gotoHome(page);
    const order = await page.$$eval('[data-section]', (els) => els.map((e) => e.id));
    expect(order).toEqual(['top', ...SECTIONS]);
  });

  test('hero CTAs behave truthfully', async ({ page }) => {
    await gotoHome(page);
    await page.locator('[data-action="hero-explore"]').click();
    await expectInViewport(page, '#universe');
    await expect(page).toHaveURL(/#universe$/);

    await gotoHome(page);
    await page.locator('[data-action="hero-talk"]').click();
    await expectInViewport(page, '#contact');

    await gotoHome(page);
    await page.locator('[data-action="hero-projects"]').click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Worlds');

    // "Download CV" now downloads the canonical PDF (download itself: resume.spec.ts); the
    // contact section's Resume action leads to the /resume page.
    await gotoHome(page);
    const resume = page.locator('[data-action="hero-resume"]');
    await expect(resume).not.toContainText('Soon');
    await expect(resume).toHaveAttribute('href', '/resume/Islam_Abdelhady_CV.pdf');
    await expect(resume).toHaveAttribute('download', 'Islam_Abdelhady_CV.pdf');
    await page.locator('[data-action="contact-resume"]').click();
    await expect(page).toHaveURL(/\/resume$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Download the resume');
  });

  test('header navigation reaches every destination', async ({ page }) => {
    await gotoHome(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await nav.getByRole('link', { name: 'Experience' }).click();
    await expectInViewport(page, '#experience');
    await nav.getByRole('link', { name: 'Stack' }).click();
    await expectInViewport(page, '#capabilities');
    await nav.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
    await nav.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(nav.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    // Anchor from another route lands on the home section.
    await nav.getByRole('link', { name: 'Experience' }).click();
    await expect(page).toHaveURL(/\/#experience$/);
    await expectInViewport(page, '#experience');
    await page.getByRole('link', { name: /Let.s Talk/ }).click();
    await expect(page).toHaveURL(/\/contact$/);
  });

  test('deep links land below the fixed header', async ({ page }) => {
    for (const id of ['projects', 'experience', 'contact']) {
      await page.goto(`/?intro=0#${id}`);
      await expectInViewport(page, `#${id}`);
      const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
      const header = await page
        .locator('header')
        .first()
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(top).toBeGreaterThanOrEqual(header - 2);
    }
  });

  test('universe destinations route somewhere real (static mode)', async ({ page }) => {
    await gotoHome(page);
    const links = page.locator('[data-universe-nodes] a');
    await expect(links).toHaveCount(6);
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual([
      '/#capabilities',
      '/#projects',
      '/projects',
      '/#contact',
      '/#capabilities',
      '/#experience',
    ]);
    await page.locator('[data-node="case-studies"] a').click();
    await expect(page).toHaveURL(/\/projects$/);
  });

  test('back/forward navigation is repeatable', async ({ page }) => {
    await gotoHome(page);
    await page.locator('[data-action="hero-projects"]').click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByRole('link', { name: 'TIBYN' }).first().click();
    await expect(page).toHaveURL(/\/projects\/tibyn$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('TIBYN');
    await page.goBack();
    await expect(page).toHaveURL(/\/projects$/);
    await page.goBack();
    await expect(page.locator('#hero-title')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/projects$/);
  });
});

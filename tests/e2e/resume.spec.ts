import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Download } from '@playwright/test';
import { ROUTES, gotoHome } from './helpers';

/**
 * Temporary CV + verified links: every résumé action serves the owner's original PDF unchanged,
 * profile and email links are the owner-verified ones (with safe new-tab behaviour), and the
 * phone number printed in the CV is never published on the site.
 */
// Link flows don't need the 3D layer: the static tier keeps them fast in headless engines (D-41).
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const manifest = json('src/assets/resume.json') as {
  src: string;
  fileName: string;
  bytes: number;
  sha256: string;
};
const contact = json('src/content/data/contact.json') as { email: string };
const social = json('src/content/data/social.json') as { id: string; label: string; url: string }[];
const phoneDigits = (json('src/content/data/verified-links.json') as { phone: { href: string } }).phone.href
  .replace(/\D/g, '')
  .slice(-10);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const downloaded = async (d: Download) => sha(readFileSync((await d.path())!));

test.describe('résumé PDF and verified links', () => {
  test('hero "Download CV" downloads the original PDF, unchanged', async ({ page }) => {
    await gotoHome(page, 'quality=static');
    const cta = page.locator('[data-action="hero-resume"]');
    await expect(cta).toHaveAccessibleName(/Download CV \(PDF, \d+ KB\)/);
    const [download] = await Promise.all([page.waitForEvent('download'), cta.click()]);
    expect(download.suggestedFilename()).toBe(manifest.fileName);
    expect(await downloaded(download)).toBe(manifest.sha256);
  });

  test('the canonical PDF is served as-is', async ({ request }) => {
    const res = await request.get(manifest.src);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    const body = await res.body();
    expect(body.length).toBe(manifest.bytes);
    expect(sha(body)).toBe(manifest.sha256);
  });

  test('/resume offers Download and View of the same document', async ({ page, context }) => {
    await page.goto('/resume?quality=static');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Download the resume');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-action="resume-download"]').click(),
    ]);
    expect(await downloaded(download)).toBe(manifest.sha256);

    const view = page.locator('[data-action="resume-view"]');
    await expect(view).toHaveAttribute('href', manifest.src);
    await expect(view).toHaveAttribute('target', '_blank');
    await expect(view).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(view).toHaveAccessibleName(/View resume.*opens in a new tab/);
    // A new tab opens on the PDF. Headless browsers have no PDF viewer, so the tab may save the
    // file instead of showing it: either way it must be the original document.
    // (Headless engines attribute that download to the opener page, not to the new tab.)
    const saved: Promise<string>[] = [];
    const onDownload = (d: Download) => saved.push(downloaded(d));
    page.on('download', onDownload);
    context.on('page', (p) => p.on('download', onDownload));
    const popup = context.waitForEvent('page');
    await view.click();
    const tab = await popup;
    await expect
      .poll(() => saved.length > 0 || tab.url().includes(manifest.src), { timeout: 10_000 })
      .toBe(true);
    if (saved.length) expect(await saved[0]).toBe(manifest.sha256);
  });

  test('contact page: verified email and profiles, résumé actions, no phone', async ({ page }) => {
    await page.goto('/contact?quality=static');
    await expect(page.getByTestId('channel-email').getByRole('link')).toHaveAttribute(
      'href',
      `mailto:${contact.email}`,
    );
    for (const s of social) {
      const link = page.getByTestId(`channel-${s.id}`).getByRole('link', { name: new RegExp(s.label) });
      await expect(link).toHaveAttribute('href', s.url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(page.getByTestId(`channel-${s.id}`)).toContainText('Public profile.');
    }
    const channel = page.getByTestId('channel-resume');
    await expect(channel.locator('[data-action="contact-resume-view"]')).toHaveAttribute(
      'href',
      manifest.src,
    );
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      channel.locator('[data-action="contact-resume-download"]').click(),
    ]);
    expect(await downloaded(download)).toBe(manifest.sha256);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  });

  test('footer and home contact section link the verified profiles', async ({ page }) => {
    await gotoHome(page, 'quality=static');
    const footer = page.getByRole('list', { name: 'Profiles' });
    for (const s of social) {
      const icon = footer.getByRole('link', { name: `${s.label} (opens in a new tab)` });
      await expect(icon).toHaveAttribute('href', s.url);
      await expect(icon).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(page.locator(`#contact [data-action="social-${s.id}"]`)).toHaveAttribute('href', s.url);
    }
    await expect(page.locator('#contact [data-action="contact-resume"]')).not.toContainText('Soon');
  });

  test('no route publishes the phone number', async ({ request }) => {
    for (const route of ROUTES) {
      const html = await (await request.get(route)).text();
      expect(html, route).not.toContain(phoneDigits);
      expect(html, route).not.toContain('tel:');
    }
  });
});

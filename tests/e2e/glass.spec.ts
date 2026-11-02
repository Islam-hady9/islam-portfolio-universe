import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoHome, sectionPanel } from './helpers';

/**
 * Cinematic Fidelity V3 — the Intelligent Glass system on real CSS: nested surfaces never blur
 * twice, and the damped glass tilt only exists with full motion and a fine pointer.
 */
const backdrop = (l: Locator) =>
  l.evaluate((el) => {
    const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
    return s.backdropFilter || s.webkitBackdropFilter || 'none';
  });

/** Hovers the first tilt-enabled glass tile near its top-right corner (Playwright actionability
 *  checks wait until the tile is stable, e.g. after its reveal), then moves inside it once more
 *  so PointerAura writes the pointer offsets. */
async function hoverTile(page: Page) {
  const tile = page.locator('[data-spotlight][data-tilt]').first();
  await tile.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = (await tile.boundingBox())!;
  await tile.hover({ position: { x: box.width * 0.85, y: box.height * 0.2 } });
  await tile.hover({ position: { x: box.width * 0.9, y: box.height * 0.15 } });
  return tile;
}

test.describe('Intelligent Glass (V3)', () => {
  test('assistant: panel housing blurs once; field, chips, answers and sources never blur again', async ({
    page,
  }) => {
    await gotoHome(page, 'quality=static');
    const panel = await sectionPanel(page);
    await expect(panel).toHaveClass(/glass--panel/);
    await expect.poll(() => panel.getAttribute('data-smart')).toBe('ready');
    const box = panel.getByRole('textbox', { name: /Ask about Islam/ });
    await box.fill('What does Islam work on?');
    await box.press('Enter');
    const answer = panel.getByTestId('assistant-answer').first();
    await expect(answer).toHaveAttribute('data-turn-state', 'done');
    const field = box.locator('xpath=ancestor::form[1]');
    expect(await backdrop(field)).toBe('none');
    expect(await backdrop(answer)).toBe('none');
    expect(await backdrop(answer.getByRole('link').first())).toBe('none');
    expect(await backdrop(panel.getByRole('button', { name: /\?$/ }).first())).toBe('none');
  });

  test('glass tiles tilt toward a fine pointer with full motion', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch devices get :active feedback instead of a tilt');
    await gotoHome(page, 'quality=static');
    expect(await page.locator('html').getAttribute('data-motion')).toBe('full');
    const tile = await hoverTile(page);
    // Re-assert the hover on every poll: a late reveal or layout settle can move the tile.
    await expect
      .poll(
        async () => {
          await tile.hover({ position: { x: 40, y: 30 } });
          return tile.evaluate((el) => getComputedStyle(el).transform);
        },
        { timeout: 15_000 },
      )
      .toMatch(/^matrix3d\(/);
  });

  test('reduced motion: no tilt, the lift stays a plain 2D offset', async ({ page, isMobile }) => {
    test.skip(isMobile, 'touch devices get :active feedback instead of a tilt');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHome(page, 'quality=static');
    expect(await page.locator('html').getAttribute('data-motion')).toBe('reduced');
    const tile = await hoverTile(page);
    await page.waitForTimeout(700);
    const transform = await tile.evaluate((el) => getComputedStyle(el).transform);
    expect(transform).not.toMatch(/matrix3d/);
  });

  test('reduced transparency: every glass surface goes near-opaque without blur', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'emulated through the Chrome DevTools Protocol');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
    });
    await gotoHome(page, 'quality=static');
    const supported = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches);
    test.skip(!supported, 'this Chromium build does not expose prefers-reduced-transparency');
    const panel = await sectionPanel(page);
    // The panel's module sets its own --g-a (0.76); the preference must still win. Compared as a
    // number: the production CSS minifier writes 0.95 as ".95".
    const alpha = (el: Element) => Number(getComputedStyle(el).getPropertyValue('--g-a').trim());
    expect(await panel.evaluate(alpha)).toBeCloseTo(0.95, 5);
    expect(await backdrop(panel)).toBe('none');
    const tile = page.locator('[data-spotlight][data-tilt]').first();
    expect(await tile.evaluate(alpha)).toBeCloseTo(0.95, 5);
  });
});

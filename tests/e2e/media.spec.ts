import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { gotoHome, trackErrors } from './helpers';

/**
 * Personal media (portrait + intro reel) across Chromium desktop/mobile, Firefox and WebKit:
 * real playback of the shipped MP4, poster-first loading, captions, keyboard/focus behaviour,
 * reduced motion, layout stability and the About placement.
 */
const dialog = (page: Page) => page.getByRole('dialog', { name: 'A short introduction' });
const video = (page: Page) => page.locator('dialog video');
const currentTime = (page: Page) => video(page).evaluate((v: HTMLVideoElement) => v.currentTime);
// WebKit reports RSC prefetches aborted by page.goto as "access control checks" (harness artifact).
const benign = /\?_rsc=\S+ due to access control checks/;
// The media flows don't depend on 3D: the static tier keeps them deterministic and spares the
// software-rendered WebGL of headless WebKit/Firefox. Media + live 3D (rendering pauses while
// the reel is open) is covered on the real GPU in webgl.spec.ts.
const STATIC = 'quality=static';

async function openFrom(page: Page, action: 'hero-reel' | 'identity-reel' | 'about-reel') {
  const trigger = page.locator(`[data-action="${action}"]`);
  await trigger.scrollIntoViewIfNeeded();
  // The player chunk mounts after first paint (or on intent); wait for its dialog.
  await expect(page.locator('dialog')).toHaveCount(1, { timeout: 15_000 });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  return trigger;
}

test.describe('personal media', () => {
  // Headless WebKit on Windows renders at ~17 fps even idle; under a parallel run with video
  // decoding its actionability checks need the longer budget the smoke suite also uses.
  test.beforeEach(({ browserName }) => {
    test.slow(browserName === 'webkit', 'slow headless WebKit under a parallel run');
  });

  test('identity band shows the portrait with its description, without layout shift', async ({
    page,
    browserName,
  }) => {
    await gotoHome(page, STATIC);
    const figure = page.locator('#identity [data-portrait]');
    await figure.scrollIntoViewIfNeeded();
    const before = await figure.boundingBox();
    const img = figure.locator('img').first();
    await expect(img).toHaveAttribute('alt', /^Islam Abd-Elhady, seated/);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
        timeout: 15_000,
      })
      .toBe(true);
    const after = await figure.boundingBox();
    expect(after!.height).toBeCloseTo(before!.height, 0);
    expect(after!.width).toBeCloseTo(before!.width, 0);
    await expect(figure.locator('figcaption')).toContainText('THE ENGINEER BEHIND THE UNIVERSE');
    if (browserName === 'chromium') {
      const cls = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let total = 0;
            new PerformanceObserver((list) => {
              for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
                if (!e.hadRecentInput) total += e.value;
            }).observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => resolve(total), 400);
          }),
      );
      expect(cls).toBeLessThan(0.01);
    }
  });

  test('no video or poster bytes are requested until the reel is opened', async ({ page }) => {
    const media: string[] = [];
    page.on('request', (r) => {
      if (/\/media\/(video|posters)\//.test(r.url())) media.push(r.url());
    });
    await gotoHome(page, STATIC);
    await page.locator('#identity [data-portrait]').scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    expect(media).toEqual([]);
    await openFrom(page, 'identity-reel');
    // Opening selects a source (WebKit's media loads are not visible to the request listener).
    await expect
      .poll(() => video(page).evaluate((v: HTMLVideoElement) => v.currentSrc), { timeout: 15_000 })
      .toMatch(/\/media\/video\/intro-reel-\d+\.mp4$/);
  });

  test('hero trigger opens a player that plays the reel with captions, then closes cleanly', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await gotoHome(page, STATIC);
    const trigger = await openFrom(page, 'hero-reel');
    await expect.poll(() => currentTime(page), { timeout: 20_000 }).toBeGreaterThan(1.2);
    expect(await video(page).evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(
      /intro-reel-(720|1080)\.mp4$/,
    );
    // Captions on by default, rendered under the film from the same cues as the WebVTT track.
    await expect(dialog(page).getByRole('button', { name: 'Captions' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('dialog [data-captions="on"]')).toHaveText(/\S/, { timeout: 10_000 });
    // The world behind is paused and the page cannot scroll.
    expect(await page.evaluate(() => window.__IU__?.state().mediaOverlay)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).not.toHaveAttribute('open', '');
    await expect(trigger).toBeFocused();
    expect(await video(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    // The dialog's "close" event (which restores the page) fires a task after close().
    await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().mediaOverlay)).toBe(false);
    expect(errors.filter((e) => !benign.test(e))).toEqual([]);
  });

  test('keyboard: Enter opens, the page behind is inert, shortcuts work, Escape returns focus', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard flow is a desktop concern');
    await gotoHome(page, STATIC);
    const trigger = page.locator('[data-action="identity-reel"]');
    await trigger.scrollIntoViewIfNeeded();
    await expect(page.locator('dialog')).toHaveCount(1, { timeout: 15_000 });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: /^(Pause|Play)$/ })).toBeFocused();
    // Tab cycles through the dialog's controls; past the last one the browser may take focus to
    // its own UI (document.body here) — but never to the page behind the modal.
    const landed: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      landed.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return 'browser';
          return el.closest('dialog') ? 'dialog' : `page:${el.tagName}`;
        }),
      );
    }
    expect(landed.filter((l) => l.startsWith('page:'))).toEqual([]);
    expect(landed).toContain('dialog');
    // Content behind the modal cannot take focus.
    await page.locator('[data-action="hero-reel"]').evaluate((el: HTMLElement) => el.focus());
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    await page.keyboard.press('m');
    await expect(dialog(page).getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('c');
    await expect(dialog(page).getByRole('button', { name: 'Captions' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('transcript lists the narration and seeks the film', async ({ page }) => {
    await gotoHome(page, STATIC);
    await openFrom(page, 'identity-reel');
    await dialog(page).getByText('Transcript', { exact: true }).click();
    const cue = dialog(page).getByRole('button', { name: /From architecture to impact\./ });
    await expect(cue).toBeVisible();
    await expect(dialog(page).getByText(/five-layer stack assembles/)).toBeVisible();
    await cue.click();
    await expect.poll(() => currentTime(page), { timeout: 10_000 }).toBeGreaterThan(21);
    // With the long transcript open, the title and the toggle must stay reachable (no content
    // pushed above the notes' scroll origin), and the transcript must collapse again.
    const title = dialog(page).getByRole('heading', { name: 'A short introduction' });
    await title.scrollIntoViewIfNeeded();
    await expect(title).toBeInViewport();
    await dialog(page).getByText('Transcript', { exact: true }).click();
    await expect(cue).toBeHidden();
  });

  test('reduced motion: the player opens on its poster and waits for play', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHome(page, STATIC);
    await openFrom(page, 'identity-reel');
    const toggle = dialog(page).getByRole('button', { name: 'Play' });
    await expect(toggle).toBeFocused();
    expect(await video(page).evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await expect(video(page)).toHaveAttribute('poster', /\/media\/posters\/intro-reel-\d+\.webp$/);
    await toggle.click();
    await expect.poll(() => currentTime(page), { timeout: 20_000 }).toBeGreaterThan(0.5);
  });

  test('captions are served as WebVTT from the transcript', async ({ request }) => {
    const res = await request.get('/media/captions/intro-reel.en.vtt');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^text\/vtt/);
    const body = await res.text();
    expect(body.startsWith('WEBVTT')).toBe(true);
    expect(body).toContain('Every breakthrough begins with a question.');
    expect((await request.get('/media/captions/other.vtt')).status()).toBe(404);
  });

  test('about: the portrait leads the page (eager) and is not repeated in the identity band', async ({
    page,
  }) => {
    await page.goto(`/about?${STATIC}`);
    const img = page.locator('header [data-portrait] img');
    await expect(img).toHaveAttribute('loading', 'eager');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
    await expect(page.locator('header [data-portrait] figcaption')).toHaveText(/AI FULL-STACK ENGINEER/);
    await expect(page.locator('#identity [data-portrait]')).toHaveCount(0);
    const box = await page.locator('header [data-portrait]').boundingBox();
    expect(box!.width).toBeGreaterThan(200);
    await openFrom(page, 'about-reel');
    await expect.poll(() => currentTime(page), { timeout: 20_000 }).toBeGreaterThan(0.5);
  });

  test('axe: no serious or critical issues with the player open', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs once, in Chromium');
    await gotoHome(page, STATIC);
    await openFrom(page, 'identity-reel');
    await dialog(page).getByText('Transcript', { exact: true }).click();
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

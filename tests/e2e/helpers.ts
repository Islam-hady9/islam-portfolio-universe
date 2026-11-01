import { expect, type Page } from '@playwright/test';

/** Home without the prelude (deterministic); pass extra query (e.g. quality=lite). */
export async function gotoHome(page: Page, query = '') {
  const q = new URLSearchParams(query);
  q.set('intro', '0');
  await page.goto(`/?${q.toString()}`);
  await expect(page.locator('#hero-title')).toBeVisible();
}

/**
 * Waits until every image intersecting the viewport has loaded and decoded, so screenshots never
 * race the poster art (lazy images below the fold are ignored). Deferred posters (DeferredImg)
 * receive their src only after first paint, so first wait for every visible image to have one.
 */
export async function viewportImagesDecoded(page: Page) {
  await page.waitForFunction(
    () =>
      [...document.images]
        .filter((img) => {
          const r = img.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.bottom > 0 &&
            r.top < window.innerHeight &&
            !img.closest('noscript')
          );
        })
        .every((img) => !!img.getAttribute('src') && img.complete),
    null,
    { timeout: 10_000 },
  );
  await page.evaluate(async () => {
    const visible = [...document.images].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    });
    await Promise.all(
      visible.map(async (img) => {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          });
        }
        await img.decode().catch(() => undefined);
      }),
    );
  });
}

/** Collects console errors and uncaught exceptions for "no runtime errors" assertions. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Scrolls through the page so scroll-triggered reveals fire, then returns to the top. */
export async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
  });
}

export async function expectInViewport(page: Page, selector: string) {
  await expect
    .poll(
      async () =>
        page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return 'missing';
          const r = el.getBoundingClientRect();
          return r.top < window.innerHeight * 0.75 && r.bottom > 60 ? 'in' : `out:${Math.round(r.top)}`;
        }, selector),
      { timeout: 6000 },
    )
    .toBe('in');
}

export async function noHorizontalOverflow(page: Page) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  expect(o.sw, `scrollWidth ${o.sw} > clientWidth ${o.cw}`).toBeLessThanOrEqual(o.cw);
}

export const ROUTES = [
  '/',
  '/projects',
  '/projects/tibyn',
  '/projects/movid',
  '/projects/ats-matching',
  '/projects/lifeatlas',
  '/about',
  '/contact',
  '/resume',
];
export const SECTIONS = [
  'identity',
  'universe',
  'projects',
  'philosophy',
  'capabilities',
  'experience',
  'ask-ai',
  'contact',
];

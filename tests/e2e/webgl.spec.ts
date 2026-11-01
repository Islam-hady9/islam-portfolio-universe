import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gotoHome, trackErrors } from './helpers';

/**
 * Real-GPU WebGL suite (opt-in: E2E_GPU=1). Verifies genuine 3D (IU-003), the interactive
 * universe (IU-004), scene states (IU-013), portals, and records a frame-rate profile (IU-015).
 */
type Frame = { s: number; fps: number; drawCalls: number; triangles: number; programs: number; presence: number[]; portal: unknown };
const frameOf = (page: import('@playwright/test').Page) => page.evaluate(() => window.__IU__?.frame?.() as unknown as Frame);

async function scrollToSection(page: import('@playwright/test').Page, id: string) {
  await page.evaluate((sid) => {
    const el = document.getElementById(sid)!;
    const r = el.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: 'instant' });
  }, id);
}

test.describe('webgl experience (GPU)', () => {
  test.setTimeout(150_000);
  // One GPU, one page at a time: parallel WebGL pages would share the GPU and skew timings.
  test.describe.configure({ mode: 'serial' });

  test('real 3D renders and the camera travels through every station', async ({ page }) => {
    const errors = trackErrors(page);
    await gotoHome(page, 'quality=ultra');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
    const f0 = await frameOf(page);
    expect(f0.drawCalls).toBeGreaterThan(10);
    expect(f0.triangles).toBeGreaterThan(10_000);
    const ids = ['top', 'identity', 'universe', 'projects', 'philosophy', 'capabilities', 'experience', 'ask-ai', 'contact'];
    for (let i = 0; i < ids.length; i++) {
      await scrollToSection(page, ids[i]!);
      await expect.poll(async () => Math.round((await frameOf(page)).s * 10) / 10, { timeout: 8000 }).toBe(i);
      const stationId = ['hero', 'identity', 'universe', 'projects', 'philosophy', 'capabilities', 'experience', 'ask-ai', 'contact'][i]!;
      // Scene states are published on a 250 ms cadence: poll instead of sampling once.
      await expect
        .poll(() => page.evaluate((sid) => window.__IU__?.state().sceneStates?.[sid] ?? 'missing', stationId), { timeout: 4000 })
        .toBe('ACTIVE');
    }
    expect(errors.filter((e) => !/THREE\.Clock/.test(e))).toEqual([]);
  });

  test('universe nodes are pinned to 3D, hover highlights, select approaches then travels', async ({ page }) => {
    await gotoHome(page, 'quality=ultra');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
    await scrollToSection(page, 'universe');
    await expect(page.locator('[data-universe-nodes]')).toHaveAttribute('data-mode', 'live');
    await expect.poll(() => page.locator('[data-node][data-visible="true"]').count(), { timeout: 8000 }).toBe(6);
    const before = await page.locator('[data-node="products"]').evaluate((el) => el.style.transform);
    expect(before).toMatch(/translate3d/);
    await page.locator('[data-node="products"] a').hover();
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().hoveredNode)).toBe('products');
    await page.locator('[data-node="contact"] a').click();
    await expect.poll(async () => (await frameOf(page) as unknown as { approach: number }).approach, { timeout: 2000 }).toBeGreaterThan(0.2);
    await expect(page).toHaveURL(/#contact$/, { timeout: 6000 });
  });

  test('project portal goes live on hover and transitions into the case study', async ({ page }) => {
    await gotoHome(page, 'quality=ultra');
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
    await scrollToSection(page, 'projects');
    const card = page.locator('[data-project-card="ats-matching"]');
    await card.hover();
    await expect(card).toHaveAttribute('data-portal-live', '', { timeout: 4000 });
    await card.locator('a').click();
    await expect(page.locator('html')).toHaveAttribute('data-portal', 'active', { timeout: 2000 });
    await expect(page).toHaveURL(/\/projects\/ats-matching$/, { timeout: 8000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-portal', /./, { timeout: 8000 });
    await expect(page.locator('[data-case-study-hero] [data-portal-track][data-portal-live]')).toHaveCount(1, { timeout: 8000 });
  });

  test('frame-rate profile per station (recorded, not asserted against a guess)', async ({ page }) => {
    // Pinned tiers (explicit preference disables the runtime governor), measured serially
    // after the intro has finished, so the numbers describe steady-state rendering.
    const rows: Record<string, unknown>[] = [];
    const detected = await page.goto('/?intro=0').then(() =>
      page.waitForFunction(() => window.__IU__?.state().detectedTier).then(() => page.evaluate(() => window.__IU__?.state().detectedTier)),
    );
    for (const tier of ['balanced', 'ultra'] as const) {
    await gotoHome(page, `quality=${tier}`);
    await expect.poll(() => page.evaluate(() => window.__IU__?.state().webgl), { timeout: 30_000 }).toBe('ready');
    await page.waitForTimeout(4000);
    for (const id of ['top', 'universe', 'experience', 'ask-ai', 'contact']) {
      await scrollToSection(page, id);
      await page.waitForTimeout(1500);
      const sample = await page.evaluate(
        () =>
          new Promise<{ fps: number; p95: number; max: number }>((resolve) => {
            const times: number[] = [];
            let last = performance.now();
            const t0 = last;
            const tick = (now: number) => {
              times.push(now - last);
              last = now;
              if (now - t0 < 2500) requestAnimationFrame(tick);
              else {
                const sorted = [...times].sort((a, b) => a - b);
                resolve({
                  fps: Math.round((times.length / (now - t0)) * 1000),
                  p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 10) / 10,
                  max: Math.round(sorted[sorted.length - 1]! * 10) / 10,
                });
              }
            };
            requestAnimationFrame(tick);
          }),
      );
      const f = await frameOf(page);
      rows.push({ station: id, tier, ...sample, drawCalls: f.drawCalls, triangles: f.triangles, programs: f.programs });
    }
    }
    const renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    });
    mkdirSync('docs/evidence', { recursive: true });
    writeFileSync(
      'docs/evidence/fps-profile.json',
      JSON.stringify(
        {
          date: new Date().toISOString(),
          method: 'Headless Chromium (new headless, ANGLE D3D11) on the real GPU, 1440x900 @1x DPR, one page at a time, tier pinned via ?quality=, 4 s settle after ready, 1.5 s per station before a 2.5 s rAF sample. Headless frames are not vsync-capped.',
          renderer,
          autoDetectedTier: detected,
          rows,
        },
        null,
        2,
      ),
    );
    for (const r of rows) expect(r.fps as number).toBeGreaterThan(20);
  });
});

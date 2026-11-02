import { expect, test, type Page } from '@playwright/test';

/**
 * AI Presence V1 — the global assistant: the orb on every route, the drawer (dialog semantics,
 * Escape, focus return, Ctrl/⌘+K), the hero entry, ONE shared conversation across the drawer,
 * the Ask My AI section and client-side navigation, and nothing downloaded up front.
 */
const Q = 'intro=0&quality=static';
const drawerAnswers = (page: Page) =>
  page.locator('[data-ai-host="drawer"] [data-testid="assistant-answer"]');

/** Clicks (or taps) the visible part of the orb — it may be tucked past the screen edge. */
async function openViaOrb(page: Page, touch = false) {
  const body = page.locator('[data-testid="assistant-orb"] [data-orb-body]');
  await expect(body).toBeVisible();
  const b = (await body.boundingBox())!;
  const vw = page.viewportSize()!.width;
  const right = Math.min(b.x + b.width, vw - 1);
  const x = b.x + (right - b.x) / 2;
  const y = b.y + b.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Whether the page sees an Apple platform (its shortcut is then ⌘K instead of Ctrl+K). */
const isApple = (page: Page) =>
  page.evaluate(() =>
    /mac|iphone|ipad/i.test(
      (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
        navigator.platform,
    ),
  );

async function lastDone(page: Page, scope: 'drawer' | 'section', count: number) {
  const answers = page.locator(`[data-ai-host="${scope}"] [data-testid="assistant-answer"]`);
  await expect(answers).toHaveCount(count, { timeout: 15_000 });
  await expect(answers.nth(count - 1)).toHaveAttribute('data-turn-state', 'done', { timeout: 15_000 });
}

test.describe('AI Presence — global assistant', () => {
  test('the orb is on every route; it opens a labelled modal drawer with the assistant', async ({ page }) => {
    for (const path of ['/projects', '/projects/tibyn', '/about', '/contact', '/resume', '/']) {
      await page.goto(`${path}?${Q}`);
      await expect(page.getByTestId('assistant-orb')).toBeVisible();
    }
    await openViaOrb(page);
    const drawer = page.getByRole('dialog', { name: 'Ask My AI' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId('ask-ai-panel')).toBeVisible();
    await expect(drawer.getByTestId('ask-ai-panel')).toHaveAttribute('data-smart', 'ready', {
      timeout: 15_000,
    });
    // Modal: the page behind is inert (its links are not reachable).
    expect(
      await page.evaluate(() => document.querySelector('dialog[data-assistant-drawer]')?.matches(':modal')),
    ).toBe(true);
  });

  test('Escape closes with focus back on the orb; the shortcut reopens with the field focused and closes again', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard shortcuts are a desktop affordance');
    await page.goto(`/about?${Q}`);
    const chord = (await isApple(page)) ? 'Meta+k' : 'Control+k';
    const orb = page.getByTestId('assistant-orb');
    await openViaOrb(page);
    const drawer = page.getByTestId('assistant-drawer');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(orb).toBeFocused();
    await page.keyboard.press(chord);
    await expect(drawer).toBeVisible();
    await expect(page.locator('[data-ai-host="drawer"] [data-assistant-input]')).toBeFocused({
      timeout: 10_000,
    });
    // The same chord closes it again, and focus goes back to where it was.
    await page.keyboard.press(chord);
    await expect(drawer).toBeHidden();
    await expect(orb).toBeFocused();
  });

  test('the shortcut never interrupts typing in a field', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcuts are a desktop affordance');
    await page.goto(`/?${Q}`);
    const chord = (await isApple(page)) ? 'Meta+k' : 'Control+k';
    await page.evaluate(() =>
      document.getElementById('ask-ai')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const field = page.locator('[data-ai-host="section"] [data-assistant-input]');
    await field.click();
    await field.pressSequentially('what does');
    await page.keyboard.press(chord);
    await page.waitForTimeout(400);
    await expect(page.getByTestId('assistant-drawer')).toBeHidden();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('what does');
  });

  test('closing then immediately reopening never leaves the drawer shut, invisible or the page locked', async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/about?${Q}`);
    const lockBefore = await page.evaluate(() => document.documentElement.style.overflow);
    await openViaOrb(page, isMobile);
    const drawer = page.getByTestId('assistant-drawer');
    await expect(drawer).toBeVisible();
    const apple = await isApple(page);
    // 1) Reopen during the exit animation: it plays forward again, fully opaque.
    await page.evaluate((mac) => {
      document.querySelector<HTMLElement>('[data-assistant-close]')!.click();
      const init = { key: 'k', code: 'KeyK', ctrlKey: !mac, metaKey: mac, cancelable: true };
      setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', init)), 60);
    }, apple);
    await page.waitForTimeout(700);
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute('data-phase', 'open');
    expect(await drawer.evaluate((d) => getComputedStyle(d.firstElementChild!).opacity)).toBe('1');

    // 2) Reopen after the dialog closed but before its (asynchronous) close event arrived.
    const reopenedBeforeCloseEvent = await page.evaluate(
      (mac) =>
        new Promise<boolean>((resolve) => {
          const d = document.querySelector<HTMLDialogElement>('dialog[data-assistant-drawer]')!;
          let closeEventSeen = false;
          d.addEventListener('close', () => (closeEventSeen = true), { once: true });
          const mo = new MutationObserver(() => {
            if (d.open) return;
            mo.disconnect();
            const init = { key: 'k', code: 'KeyK', ctrlKey: !mac, metaKey: mac, cancelable: true };
            window.dispatchEvent(new KeyboardEvent('keydown', init));
            resolve(!closeEventSeen);
          });
          mo.observe(d, { attributes: true, attributeFilter: ['open'] });
          document.querySelector<HTMLElement>('[data-assistant-close]')!.click();
        }),
      apple,
    );
    expect(reopenedBeforeCloseEvent).toBe(true);
    await page.waitForTimeout(700);
    await expect(drawer).toBeVisible();
    await expect(page.locator('[data-ai-host="drawer"] [data-testid="ask-ai-panel"]')).toBeVisible();

    // A normal close afterwards restores the page exactly.
    await page.getByRole('button', { name: 'Close Ask My AI' }).click();
    await expect(drawer).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe(lockBefore);
  });

  test('the orb tucks aside from a control underneath, stays tucked, and returns once it is gone', async ({
    page,
  }) => {
    await page.goto(`/about?${Q}`);
    const orb = page.getByTestId('assistant-orb');
    await expect(orb).toBeVisible();
    await expect(orb).not.toHaveAttribute('data-tucked');
    const settle = () => page.evaluate(() => window.dispatchEvent(new Event('resize')));
    // A control under the orb's resting position but not under its tucked position: a probe
    // that only looked where the orb is now would flip it back over the control.
    await page.evaluate(() => {
      const b = document.createElement('button');
      b.id = 'probe-cta';
      b.textContent = 'Probe';
      b.style.cssText = 'position:fixed;right:40px;bottom:0;width:60px;height:140px;z-index:1';
      document.body.append(b);
    });
    await settle();
    await expect(orb).toHaveAttribute('data-tucked');
    for (let i = 0; i < 3; i++) {
      await settle();
      await page.waitForTimeout(400);
      await expect(orb).toHaveAttribute('data-tucked');
    }
    await page.evaluate(() => document.getElementById('probe-cta')?.remove());
    await settle();
    await expect(orb).not.toHaveAttribute('data-tucked');
  });

  test('a hero suggestion opens the drawer and is answered once, with sources', async ({ page }) => {
    await page.goto(`/?${Q}`);
    const entry = page.getByTestId('hero-ai-entry');
    const chip = entry.getByRole('button', { name: 'Does he work on AI?' });
    const usedChip = await chip.isVisible();
    if (usedChip) await chip.click();
    else await entry.getByRole('button', { name: /Ask Islam’s AI/ }).click();
    await expect(page.getByTestId('assistant-drawer')).toBeVisible();
    if (!usedChip) {
      // Compact presentation (no chips): ask through the drawer instead.
      const box = page.locator('[data-ai-host="drawer"] [data-assistant-input]');
      await box.fill('Does he work on AI?');
      await box.press('Enter');
    }
    await lastDone(page, 'drawer', 1);
    const answer = drawerAnswers(page).first();
    await expect(answer).toHaveAttribute('data-mode', 'smart');
    await expect(answer.getByText('Sources')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(drawerAnswers(page)).toHaveCount(1);
  });

  test('one conversation: drawer → Ask My AI section → another page, nothing reset', async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/?${Q}`);
    await openViaOrb(page, isMobile);
    const box = page.locator('[data-ai-host="drawer"] [data-assistant-input]');
    await box.fill('How can I contact him?');
    await box.press('Enter');
    await lastDone(page, 'drawer', 1);
    await page.getByRole('button', { name: 'Close Ask My AI' }).click();
    await expect(page.getByTestId('assistant-drawer')).toBeHidden();
    // The same instance is back in the original section.
    await page.evaluate(() =>
      document.getElementById('ask-ai')?.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    await lastDone(page, 'section', 1);
    await expect(
      page.locator('[data-ai-host="section"] [data-testid="assistant-answer"]').first(),
    ).toContainText('How can I contact him?');
    // Client-side navigation keeps the session.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.locator('main a[href="/projects"]:visible').first().click();
    await page.waitForURL(/\/projects$/);
    await openViaOrb(page, isMobile);
    await lastDone(page, 'drawer', 1);
    await expect(drawerAnswers(page).first()).toContainText('How can I contact him?');
  });

  test('nothing heavy up front: no model, no worker, and the assistant UI loads on demand', async ({
    page,
    isMobile,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(`/about?${Q}`);
    await page.waitForTimeout(1500);
    expect(requests.some((u) => u.includes('/ai/knowledge.json'))).toBe(false);
    await openViaOrb(page, isMobile);
    await expect(page.locator('[data-ai-host="drawer"] [data-testid="ask-ai-panel"]')).toHaveAttribute(
      'data-smart',
      'ready',
      { timeout: 15_000 },
    );
    expect(requests.filter((u) => u.includes('/ai/knowledge.json'))).toHaveLength(1);
    expect(requests.some((u) => /huggingface|hf\.co|mlc-ai|\.wasm|local-ai\.worker/.test(u))).toBe(false);
  });

  test('phone: the drawer fills the screen and closes from its button', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout');
    await page.goto(`/?${Q}`);
    await openViaOrb(page, true);
    const drawer = page.getByTestId('assistant-drawer');
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box!.height).toBeGreaterThan(vp.height * 0.85);
    await page.getByRole('button', { name: 'Close Ask My AI' }).tap();
    await expect(drawer).toBeHidden();
  });

  test('reduced motion: everything works without animation', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/contact?${Q}`);
    await openViaOrb(page, isMobile);
    await page.locator('[data-ai-host="drawer"] [data-action="assistant-prompt"]').first().click();
    await lastDone(page, 'drawer', 1);
    await page.getByRole('button', { name: 'Close Ask My AI' }).click();
    await expect(page.getByTestId('assistant-drawer')).toBeHidden();
  });
});

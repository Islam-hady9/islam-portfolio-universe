/**
 * Resolves once the page has loaded, a frame has been painted and the main thread is idle.
 * Non-critical enhancements (GSAP scroll choreography, below-the-fold art) wait for this so
 * they never compete with first paint / LCP — on mobile their script evaluation and forced
 * layouts were the largest main-thread cost before first paint.
 */
export function afterFirstPaint(idleTimeout = 1500): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const idle = () => {
      if (window.requestIdleCallback) window.requestIdleCallback(() => resolve(), { timeout: idleTimeout });
      else window.setTimeout(resolve, 200);
    };
    // Two frames after `load`: the first paint has been presented before we schedule work.
    const painted = () => requestAnimationFrame(() => requestAnimationFrame(idle));
    if (document.readyState === 'complete') painted();
    else window.addEventListener('load', painted, { once: true });
  });
}

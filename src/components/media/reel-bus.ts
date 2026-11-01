/**
 * Tiny coordination layer between the intro-reel triggers (hero chip, portrait overlay) and
 * the player, which lives in its own lazily loaded chunk. Triggers import only this module.
 *
 * - `warmReel()` fetches the player chunk (after first paint, or on hover/focus intent).
 * - The mounted player registers an `open` handler; `openReel()` calls it synchronously inside
 *   the click, so playback with sound starts within the user gesture (Safari requires that).
 * - A click that arrives before the chunk has loaded is queued and replayed on registration.
 */
type OpenHandler = (opener: HTMLElement | null) => void;

let handler: OpenHandler | null = null;
let queued: { opener: HTMLElement | null } | null = null;
let chunk: Promise<typeof import('./IntroReelPlayer')> | null = null;
const demand = new Set<() => void>();

export function warmReel(): Promise<typeof import('./IntroReelPlayer')> {
  if (!chunk) {
    chunk = import('./IntroReelPlayer');
    // First request only: listeners (the host) call back into warmReel, which is then a no-op.
    demand.forEach((fn) => fn());
  }
  return chunk;
}

/** The host subscribes so a trigger's intent can mount the player early. */
export function onReelDemand(fn: () => void): () => void {
  demand.add(fn);
  return () => demand.delete(fn);
}

export function registerReel(fn: OpenHandler | null): void {
  handler = fn;
  if (fn && queued) {
    const { opener } = queued;
    queued = null;
    // Replayed outside the registering effect (the open handler flushes React state).
    window.setTimeout(() => fn(opener), 0);
  }
}

export function openReel(opener: HTMLElement | null): void {
  if (handler) {
    handler(opener);
    return;
  }
  queued = { opener };
  void warmReel();
}

/** Test seam: forget registrations and queued requests. */
export function resetReelBus(): void {
  handler = null;
  queued = null;
  chunk = null;
  demand.clear();
}

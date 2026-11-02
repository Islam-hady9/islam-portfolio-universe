/**
 * One local model per browser profile (PIE spec §8 "prevent multiple active model instances",
 * §11 #17 multi-tab): a Web Lock is held for as long as a tab owns Local AI, so a second tab
 * cannot start a second multi-hundred-MB model on the same GPU or race the same download.
 * Browsers without the Web Locks API get a no-op lock (one tab is still one instance).
 */
const LOCK_NAME = 'portfolio-local-ai';

export interface TabLock {
  release(): void;
}

const noop: TabLock = { release() {} };

/** Resolves with a lock, or `null` when another tab of this site holds it. */
export function acquireTabLock(
  locks: LockManager | undefined = globalThis.navigator?.locks,
): Promise<TabLock | null> {
  if (!locks?.request) return Promise.resolve(noop);
  return new Promise((resolve) => {
    locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(null);
          return undefined;
        }
        // Held until release() resolves this promise.
        return new Promise<void>((release) => resolve({ release: () => release() }));
      })
      .catch(() => resolve(noop));
  });
}

'use client';

import { useExperience } from '@/state/experience-store';

export interface IUTestHooks {
  /** Snapshot of low-frequency experience state (tier, webgl, scenes…). */
  state: () => ReturnType<typeof useExperience.getState>;
  /** Per-frame diagnostics registered by the WebGL layer once mounted. */
  frame?: () => Record<string, unknown>;
  /** Forces a WebGL context loss/restore cycle (QA of IU-017). */
  loseContext?: () => boolean;
  restoreContext?: () => boolean;
}

declare global {
  interface Window {
    __IU__?: IUTestHooks;
    __IU_INTRO_START?: number;
  }
}

/**
 * Read-only diagnostics surface used by Playwright and manual QA. Exposes no secrets
 * and no write access to content; safe to ship.
 */
export function installTestHooks() {
  if (typeof window === 'undefined') return;
  window.__IU__ = window.__IU__ ?? { state: () => useExperience.getState() };
  window.__IU__.state = () => useExperience.getState();
}

export function registerFrameHooks(hooks: Partial<IUTestHooks>) {
  installTestHooks();
  Object.assign(window.__IU__!, hooks);
}

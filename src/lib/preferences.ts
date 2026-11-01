'use client';

import { useExperience, type MotionPreference } from '@/state/experience-store';
import { isQualityPreference, type QualityPreference } from '@/experience/quality/tiers';

const QUALITY_KEY = 'iu:quality';
const MOTION_KEY = 'iu:motion';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode — preference lasts for this page only */
  }
}

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function computeReduced(pref: MotionPreference): boolean {
  if (pref === 'reduced') return true;
  if (pref === 'full') return false;
  return systemPrefersReducedMotion();
}

/** Applies the motion preference to <html data-motion> (CSS gate) and the store. */
export function applyMotionPreference(pref: MotionPreference, persist = true) {
  const reduced = computeReduced(pref);
  document.documentElement.setAttribute('data-motion', reduced ? 'reduced' : 'full');
  if (persist) write(MOTION_KEY, pref);
  const s = useExperience.getState();
  s.setMotionPreference(pref);
  s.setReducedMotion(reduced);
}

export function applyQualityPreference(pref: QualityPreference, persist = true) {
  if (persist) write(QUALITY_KEY, pref);
  document.documentElement.setAttribute('data-quality-pref', pref);
  useExperience.getState().setQualityPreference(pref);
}

/** Reads persisted preferences plus a `?quality=` QA override from the URL. */
export function loadPreferences(): { quality: QualityPreference; motion: MotionPreference } {
  const params = new URLSearchParams(window.location.search);
  const qParam = params.get('quality');
  const qStored = read(QUALITY_KEY);
  const quality: QualityPreference = isQualityPreference(qParam)
    ? qParam
    : isQualityPreference(qStored)
      ? qStored
      : 'auto';
  const mParam = params.get('motion');
  const mStored = mParam ?? read(MOTION_KEY);
  const motion: MotionPreference = mStored === 'reduced' || mStored === 'full' ? mStored : 'system';
  return { quality, motion };
}

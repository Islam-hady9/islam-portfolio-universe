'use client';

import { useEffect } from 'react';
import { useExperience } from '@/state/experience-store';

/**
 * When a universe node targets a specific layer (e.g. "AI Systems" → Intelligence Layer),
 * briefly highlights that panel after arrival. Purely additive; renders nothing.
 */
export function CapabilityFocus() {
  const focus = useExperience((s) => s.focusCapability);
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector<HTMLElement>(`[data-capability="${focus}"]`);
    if (!el) return;
    el.setAttribute('data-focused', '');
    const t = window.setTimeout(() => {
      el.removeAttribute('data-focused');
      useExperience.getState().setFocusCapability(null);
    }, 3200);
    return () => {
      window.clearTimeout(t);
      el.removeAttribute('data-focused');
    };
  }, [focus]);
  return null;
}

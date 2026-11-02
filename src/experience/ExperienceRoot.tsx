'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useExperience } from '@/state/experience-store';
import { gatherDeviceSignals } from './quality/detect';
import { detectTier, resolveTier } from './quality/tiers';
import { CanvasBoundary } from './CanvasBoundary';
import styles from './ExperienceRoot.module.css';

/**
 * Persistent WebGL layer (spec §6.1). Lives in the root layout so the canvas survives route
 * changes. The heavy three.js bundle is code-split and requested only after hydration and an
 * idle slot, so reading content and reaching CTAs never waits on 3D (spec §8.1).
 */
const ExperienceCanvas = dynamic(() => import('./canvas/ExperienceCanvas'), {
  ssr: false,
  loading: () => null,
});

export function ExperienceRoot() {
  const preference = useExperience((s) => s.qualityPreference);
  const detected = useExperience((s) => s.detectedTier);
  const tier = useExperience((s) => s.tier);
  const webgl = useExperience((s) => s.webgl);
  const [idle, setIdle] = useState(false);
  const [generation, setGeneration] = useState(0);

  const webglAvailable = useExperience((s) => s.webglAvailable);

  // Preference × detection → effective tier.
  useEffect(() => {
    if (!detected) return;
    const t = resolveTier(preference, detected, webglAvailable);
    const s = useExperience.getState();
    s.setTier(t, preference === 'auto' ? s.tierReason : `user preference (${preference})`);
    document.documentElement.setAttribute('data-quality', t);
    if (t === 'static') s.setWebGL('disabled');
    else if (s.webgl === 'disabled') s.setWebGL('pending');
  }, [preference, detected, webglAvailable]);

  // Mount the canvas only once the page is loaded, interactive and idle, so 3D setup never
  // competes with first paint, hydration or the first taps (spec §8.1). Posters rendered from
  // the same scenes carry the first impression. Touch devices wait for the first interaction
  // or a quiet period; desktops for an idle slot after load.
  useEffect(() => {
    let cancelled = false;
    const cleanups: (() => void)[] = [];
    const ric = (cb: () => void, timeout: number) => {
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(cb, { timeout });
        cleanups.push(() => window.cancelIdleCallback(id));
      } else {
        const id = window.setTimeout(cb, Math.min(timeout, 600));
        cleanups.push(() => window.clearTimeout(id));
      }
    };
    const start = () => {
      if (cancelled) return;
      // Capability probe (creates a short-lived WebGL context — GPU channel setup can take
      // hundreds of ms on first use), so it runs here in idle time, never during hydration.
      if (!useExperience.getState().detectedTier) {
        const signals = gatherDeviceSignals();
        const d = detectTier(signals);
        useExperience.getState().setDetectedTier(d.tier, d.reason, signals.webgl1 || signals.webgl2);
      }
      setIdle(true);
    };
    const afterLoad = () => {
      if (!window.matchMedia('(pointer: coarse)').matches) {
        ric(start, 2500);
        return;
      }
      let done = false;
      const go = (timeout: number) => {
        if (done) return;
        done = true;
        window.removeEventListener('scroll', onInteract);
        window.removeEventListener('pointerdown', onInteract);
        window.clearTimeout(quiet);
        ric(start, timeout);
      };
      const onInteract = () => go(1200);
      const quiet = window.setTimeout(() => go(2500), 5000);
      window.addEventListener('scroll', onInteract, { passive: true });
      window.addEventListener('pointerdown', onInteract, { passive: true });
      cleanups.push(() => {
        done = true;
        window.removeEventListener('scroll', onInteract);
        window.removeEventListener('pointerdown', onInteract);
        window.clearTimeout(quiet);
      });
    };
    if (document.readyState === 'complete') afterLoad();
    else {
      window.addEventListener('load', afterLoad, { once: true });
      cleanups.push(() => window.removeEventListener('load', afterLoad));
    }
    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, []);

  // Context loss recovery: remount a fresh canvas when the browser restores the context.
  useEffect(() => {
    const onRestore = () => setGeneration((g) => g + 1);
    window.addEventListener('iu:webgl-restore', onRestore);
    return () => window.removeEventListener('iu:webgl-restore', onRestore);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-webgl', webgl);
  }, [webgl]);

  const shouldMount = idle && detected !== null && tier !== 'static' && webgl !== 'failed';

  return (
    <div className={styles.layer} aria-hidden="true" data-testid="experience-layer">
      {shouldMount ? (
        <CanvasBoundary key={`${generation}`}>
          <ExperienceCanvas tier={tier} />
        </CanvasBoundary>
      ) : null}
    </div>
  );
}

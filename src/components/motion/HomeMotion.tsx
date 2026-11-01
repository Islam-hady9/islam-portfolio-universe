'use client';

import { useEffect } from 'react';
import { useExperience } from '@/state/experience-store';

/**
 * Home-only scroll choreography: during the first part of the scroll the hero copy drifts up
 * and recedes modestly while the camera dollies through the core's orbit (spec S1 "Motion").
 * Scrubbed (direction-independent, valid at any scroll position).
 */
export function HomeMotion() {
  const reduced = useExperience((s) => s.reducedMotion);

  useEffect(() => {
    if (reduced) return;
    let disposed = false;
    let revert: (() => void) | null = null;
    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const copy = document.querySelector<HTMLElement>('[data-hero-copy]');
        const hero = document.getElementById('top');
        if (!copy || !hero) return;
        gsap.fromTo(
          copy,
          { y: 0, opacity: 1 },
          {
            y: -70,
            opacity: 0.15,
            ease: 'none',
            scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 25%', scrub: 0.4 },
          },
        );
      });
      revert = () => ctx.revert();
    })();
    return () => {
      disposed = true;
      revert?.();
    };
  }, [reduced]);

  return null;
}

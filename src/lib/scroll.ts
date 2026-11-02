'use client';

import { useExperience } from '@/state/experience-store';
import { MOTION } from './motion';

type Gsap = typeof import('gsap').default;
type Tween = ReturnType<Gsap['to']>;

/** GSAP + ScrollToPlugin are loaded on first smooth travel, keeping them off the critical path. */
let gsapPromise: Promise<Gsap> | null = null;
function loadGsap(): Promise<Gsap> {
  gsapPromise ??= Promise.all([import('gsap'), import('gsap/ScrollToPlugin')]).then(([g, s]) => {
    g.default.registerPlugin(s.ScrollToPlugin);
    return g.default;
  });
  return gsapPromise;
}

function headerOffset(): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--header-h');
  return (parseFloat(v) || 72) + 8;
}

let activeTween: Tween | null = null;
let travelId = 0;

/**
 * Travels to a home-page section. Duration scales with distance (0.9–1.8 s, spec §6.4
 * "large camera transition") so the camera rig, which follows scroll, reads it as one
 * continuous flight. Reduced motion jumps instantly. Focus moves to the section heading
 * so keyboard and screen-reader users land in the right place (spec §4.1).
 */
export function travelToSection(
  id: string,
  opts: { updateHash?: boolean; focus?: boolean; instant?: boolean } = {},
) {
  const target = document.getElementById(id);
  if (!target) return false;
  const { updateHash = true, focus = true, instant = false } = opts;
  const reduced = instant || useExperience.getState().reducedMotion;
  const top = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - headerOffset();
  const distance = Math.abs(top - window.scrollY);
  const myId = ++travelId;

  activeTween?.kill();
  activeTween = null;
  const done = () => {
    activeTween = null;
    if (focus) {
      const heading = target.querySelector<HTMLElement>('h1, h2, [data-focus-target]');
      const el = heading ?? target;
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  };

  if (updateHash) {
    const url = id === 'top' ? window.location.pathname : `#${id}`;
    window.history.pushState(window.history.state, '', url);
  }

  if (reduced || distance < 4) {
    window.scrollTo({ top, behavior: 'auto' });
    done();
    return true;
  }
  const duration = Math.min(
    MOTION.duration.travelMax,
    Math.max(MOTION.duration.travelMin, distance / 2600 + 0.6),
  );
  void loadGsap().then((gsap) => {
    if (myId !== travelId) return; // superseded by a newer travel request
    activeTween = gsap.to(window, {
      duration,
      ease: MOTION.ease.travel,
      scrollTo: { y: top, autoKill: true },
      onComplete: done,
      onInterrupt: () => {
        activeTween = null;
      },
    });
  });
  return true;
}

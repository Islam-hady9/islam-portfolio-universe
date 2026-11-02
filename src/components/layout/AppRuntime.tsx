'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useExperience } from '@/state/experience-store';
import { applyMotionPreference, applyQualityPreference, loadPreferences } from '@/lib/preferences';
import { homeAnchorOf, SECTION_IDS, type SectionId } from '@/lib/routes';
import { travelToSection } from '@/lib/scroll';
import { installTestHooks } from '@/lib/test-hooks';

/**
 * Cross-cutting client behaviour, mounted once in the root layout:
 * preferences, scroll-spy, in-page anchor travel, intro state mirroring and test hooks.
 * Renders nothing.
 */
export function AppRuntime() {
  const pathname = usePathname() ?? '/';

  // Preferences: persisted choice → store; follow system reduced-motion changes.
  useEffect(() => {
    const { quality, motion } = loadPreferences();
    applyQualityPreference(quality, false);
    applyMotionPreference(motion, false);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => {
      if (useExperience.getState().motionPreference === 'system') applyMotionPreference('system', false);
    };
    mq.addEventListener('change', onChange);
    installTestHooks();
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mirror <html data-intro> (owned by the boot script / prelude) into the store.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      useExperience.getState().setIntro(root.getAttribute('data-intro') === 'playing' ? 'playing' : 'done');
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['data-intro'] });
    return () => mo.disconnect();
  }, []);

  // Scroll-spy over [data-section] on the home page.
  useEffect(() => {
    const setActive = useExperience.getState().setActiveSection;
    if (pathname !== '/') {
      setActive(null);
      return;
    }
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-section]'));
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best && (SECTION_IDS as readonly string[]).includes(best)) setActive(best as SectionId);
      },
      { rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.01, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [pathname]);

  // In-page anchor travel on "/" (header/footer/menu links, CTAs) — one delegated handler.
  // Capture phase: runs before React's root listener, so next/link sees defaultPrevented and
  // stands down, while the link's own onClick (e.g. closing the mobile menu) still runs.
  // Only home sections are handled; other hashes (e.g. the skip link) stay native.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.closest('[data-own-nav]')) return;
      const id = homeAnchorOf(a.getAttribute('href') ?? '');
      if (!id || window.location.pathname !== '/') return;
      const target = document.getElementById(id);
      if (!target?.hasAttribute('data-section')) return;
      e.preventDefault();
      travelToSection(id);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Landing on "/#anchor" (deep link or cross-route nav): ensure correct offset + focus.
  useEffect(() => {
    if (pathname !== '/' || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    const raf = requestAnimationFrame(() => {
      if (document.getElementById(id)) travelToSection(id, { updateHash: false, instant: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}

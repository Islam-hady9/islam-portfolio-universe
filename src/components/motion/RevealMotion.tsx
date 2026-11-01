'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useExperience } from '@/state/experience-store';

/** Resolves in an idle slot (or after `timeout` ms) so setup work never blocks first input. */
function idle(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (window.requestIdleCallback) window.requestIdleCallback(() => resolve(), { timeout });
    else window.setTimeout(resolve, Math.min(timeout, 300));
  });
}

/**
 * Scroll-triggered entrance choreography for every page (spec §6.4):
 *   [data-reveal="lines"]   masked line reveal (SplitText), 70 ms stagger
 *   [data-reveal="fade"]    rise + fade + de-blur
 *   [data-reveal="stagger"] children [data-reveal-item] cascade at 60 ms
 * Progressive enhancement: content is visible in SSR HTML; only elements still below the
 * fold when this runs are faded and revealed once. Opacity only — never visibility:hidden —
 * so unrevealed links stay focusable (focusing scrolls them in and triggers the reveal).
 * Reduced motion reverts everything.
 */
export function RevealMotion() {
  const pathname = usePathname();
  const reduced = useExperience((s) => s.reducedMotion);

  useEffect(() => {
    if (reduced) return;
    let disposed = false;
    let revert: (() => void) | null = null;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/SplitText'),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      await document.fonts?.ready;
      await idle(1200);
      if (disposed) return;

      const ctx = gsap.context(() => {
        const vh = window.innerHeight;
        const belowFold = (el: Element) => el.getBoundingClientRect().top > vh * 0.9;
        const main = document.getElementById('main');
        if (!main) return;

        main.querySelectorAll<HTMLElement>('[data-reveal="lines"]').forEach((el) => {
          if (!belowFold(el)) return;
          SplitText.create(el, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            linesClass: 'reveal-line',
            onSplit(self) {
              return gsap.from(self.lines, {
                yPercent: 108,
                rotate: 1.5,
                duration: 0.95,
                ease: 'expo.out',
                stagger: 0.07,
                scrollTrigger: { trigger: el, start: 'top 88%', once: true },
              });
            },
          });
        });

        main.querySelectorAll<HTMLElement>('[data-reveal="fade"]').forEach((el) => {
          if (!belowFold(el)) return;
          gsap.from(el, {
            y: 18,
            opacity: 0,
            filter: 'blur(6px)',
            duration: 0.8,
            ease: 'power3.out',
            clearProps: 'filter',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        });

        main.querySelectorAll<HTMLElement>('[data-reveal="stagger"]').forEach((group) => {
          const items = Array.from(group.querySelectorAll<HTMLElement>(':scope > [data-reveal-item]'));
          const hidden = items.filter(belowFold);
          if (!hidden.length) return;
          gsap.from(hidden, {
            y: 30,
            opacity: 0,
            scale: 0.985,
            duration: 0.85,
            ease: 'power3.out',
            stagger: 0.06,
            clearProps: 'transform',
            scrollTrigger: { trigger: group, start: 'top 86%', once: true },
          });
        });
      });

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener('load', refresh);
      revert = () => {
        window.removeEventListener('load', refresh);
        ctx.revert();
      };
    })();

    return () => {
      disposed = true;
      revert?.();
    };
  }, [pathname, reduced]);

  return null;
}

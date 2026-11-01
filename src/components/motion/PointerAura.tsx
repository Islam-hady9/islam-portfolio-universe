'use client';

import { useEffect, useRef } from 'react';
import { useExperience } from '@/state/experience-store';
import styles from './PointerAura.module.css';

/**
 * Premium cursor aura + magnetic controls (spec §3.4, IU-021).
 * Fine pointers with motion enabled only; never hides the OS cursor. One rAF loop that
 * sleeps when the pointer is idle and everything has settled.
 */
export function PointerAura() {
  const auraRef = useRef<HTMLDivElement>(null);
  const reduced = useExperience((s) => s.reducedMotion);

  useEffect(() => {
    const aura = auraRef.current;
    if (!aura || reduced || !window.matchMedia('(pointer: fine)').matches) return;

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const pos = { ...target };
    let visible = false;
    let raf = 0;
    let magnet: HTMLElement | null = null;
    let magnetInner: HTMLElement | null = null;
    const magnetOffset = { x: 0, y: 0 };
    const magnetCurrent = { x: 0, y: 0 };
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = 1 - Math.exp(-dt * 14);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      aura.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;

      const mk = 1 - Math.exp(-dt * 12);
      magnetCurrent.x += (magnetOffset.x - magnetCurrent.x) * mk;
      magnetCurrent.y += (magnetOffset.y - magnetCurrent.y) * mk;
      if (magnetInner)
        magnetInner.style.transform = `translate3d(${magnetCurrent.x}px, ${magnetCurrent.y}px, 0)`;

      const settled =
        Math.abs(target.x - pos.x) < 0.3 &&
        Math.abs(target.y - pos.y) < 0.3 &&
        Math.abs(magnetOffset.x - magnetCurrent.x) < 0.05 &&
        Math.abs(magnetOffset.y - magnetCurrent.y) < 0.05;
      if (settled) {
        if (!magnet && magnetInner) {
          magnetInner.style.transform = '';
          magnetInner = null;
        }
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        pos.x = target.x;
        pos.y = target.y;
        aura.dataset.visible = 'true';
      }
      const el = (e.target as Element | null)?.closest?.('[data-magnetic]') as HTMLElement | null;
      if (el !== magnet) {
        magnetOffset.x = 0;
        magnetOffset.y = 0;
        magnet = el;
        if (el) magnetInner = el.querySelector<HTMLElement>('[data-magnetic-inner]') ?? el;
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        magnetOffset.x = Math.max(-1, Math.min(1, dx)) * 6;
        magnetOffset.y = Math.max(-1, Math.min(1, dy)) * 4;
      }
      // Spotlight surfaces: a soft highlight and border glow track the pointer inside the card.
      const spot = (e.target as Element | null)?.closest?.('[data-spotlight]') as HTMLElement | null;
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--sx', `${(e.clientX - r.left).toFixed(0)}px`);
        spot.style.setProperty('--sy', `${(e.clientY - r.top).toFixed(0)}px`);
      }
      aura.dataset.hot = (e.target as Element | null)?.closest?.('a, button, [role="button"], input, label')
        ? 'true'
        : 'false';
      wake();
    };
    const onLeave = () => {
      visible = false;
      aura.dataset.visible = 'false';
      magnet = null;
      magnetOffset.x = 0;
      magnetOffset.y = 0;
      wake();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      if (magnetInner) magnetInner.style.transform = '';
      aura.dataset.visible = 'false';
    };
  }, [reduced]);

  return <div ref={auraRef} className={styles.aura} aria-hidden="true" data-visible="false" />;
}

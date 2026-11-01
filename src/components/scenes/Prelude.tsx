'use client';

import { useEffect } from 'react';
import { useExperience } from '@/state/experience-store';
import styles from './Prelude.module.css';

export function endIntro() {
  document.documentElement.setAttribute('data-intro', 'done');
}

/**
 * S0 — system awakening. Shown only when the boot script decided to play it (first desktop
 * visit, motion allowed). Lasts only while the scene is genuinely loading, never longer than
 * the CSS/boot ceiling, and reports real states — no fake percentage (spec S0).
 */
export function Prelude({ name }: { name: string }) {
  const webgl = useExperience((s) => s.webgl);
  const intro = useExperience((s) => s.intro);

  useEffect(() => {
    if (intro !== 'playing') return;
    if (webgl === 'pending') return;
    const start = window.__IU_INTRO_START ?? Date.now();
    const wait = Math.max(0, 1100 - (Date.now() - start));
    const t = window.setTimeout(endIntro, wait);
    return () => window.clearTimeout(t);
  }, [webgl, intro]);

  useEffect(() => {
    if (intro !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endIntro();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', endIntro, { passive: true, once: true });
    window.addEventListener('touchstart', endIntro, { passive: true, once: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', endIntro);
      window.removeEventListener('touchstart', endIntro);
    };
  }, [intro]);

  const status =
    webgl === 'ready' ? 'Scene ready' : webgl === 'pending' ? 'Preparing the universe' : 'Interface ready';

  return (
    <div className={styles.prelude} data-prelude="" onClick={endIntro}>
      <div className={styles.center} aria-hidden="true">
        <svg className={styles.rings} viewBox="0 0 240 240" fill="none">
          <circle cx="120" cy="120" r="104" className={styles.r4} />
          <circle cx="120" cy="120" r="78" className={styles.r3} />
          <circle cx="120" cy="120" r="52" className={styles.r2} />
          <circle cx="120" cy="120" r="28" className={styles.r1} />
          <path d="M120 4v34M120 202v34M4 120h34M202 120h34" className={styles.ticks} />
          <ellipse cx="120" cy="120" rx="104" ry="36" transform="rotate(-24 120 120)" className={styles.orbit} />
        </svg>
        <span className={styles.pulse} />
      </div>
      <p className={styles.word} aria-hidden="true">
        {name}
      </p>
      <p className={styles.status} role="status">
        {status}
      </p>
      <button
        type="button"
        className={styles.skip}
        onClick={(e) => {
          e.stopPropagation();
          endIntro();
        }}
      >
        Skip intro
      </button>
    </div>
  );
}

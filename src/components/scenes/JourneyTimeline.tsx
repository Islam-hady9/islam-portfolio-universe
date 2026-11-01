'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { CareerEntry } from '@/content/schema';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { useExperience } from '@/state/experience-store';
import { ARC, arcLift, arcPath, milestoneXs, sectionProgress } from '@/lib/timeline-geometry';
import styles from './JourneyTimeline.module.css';

/**
 * Horizontally connected luminous timeline (desktop) / vertical timeline (mobile).
 * Milestones are buttons; the detail panel announces politely. The progress line follows
 * scroll without ever locking it (spec S7).
 */
export function JourneyTimeline({ entries }: { entries: CareerEntry[] }) {
  const uid = useId();
  const detailId = `${uid}-detail`;
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<SVGPathElement>(null);
  const reduced = useExperience((s) => s.reducedMotion);
  const currentIndex = Math.max(
    0,
    entries.findIndex((e) => e.current),
  );
  const [active, setActive] = useState(currentIndex);
  const xs = milestoneXs(entries.length);
  const d = arcPath(entries.length);
  const entry = entries[active] ?? entries[0]!;

  useEffect(() => {
    const path = progressRef.current;
    const root = rootRef.current;
    if (!path || !root) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    if (reduced) {
      path.style.strokeDashoffset = '0';
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const p = sectionProgress(r.top, r.height, window.innerHeight);
      path.style.strokeDashoffset = `${len * (1 - p)}`;
      root.style.setProperty('--progress', p.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(entries.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = entries.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-milestone]')[next]?.focus();
  };

  return (
    <div ref={rootRef} className={styles.timeline} style={{ ['--count' as string]: entries.length }}>
      <svg
        className={styles.arc}
        viewBox={`0 0 ${ARC.width} ${ARC.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#C9D1D9" stopOpacity="0.5" />
            <stop offset="0.55" stopColor="#8B7CFF" />
            <stop offset="1" stopColor="#7EF7C9" />
          </linearGradient>
        </defs>
        <path d={d} className={styles.arcBase} vectorEffect="non-scaling-stroke" />
        <path
          ref={progressRef}
          d={d}
          className={styles.arcProgress}
          stroke={`url(#${uid}-grad)`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <ol className={styles.list}>
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={styles.item}
            style={{
              ['--x' as string]: `${(xs[i]! * 100).toFixed(3)}%`,
              ['--dot-y' as string]: `${(ARC.baseY - arcLift(xs[i]!)).toFixed(2)}px`,
              ['--i' as string]: i,
            }}
            data-current={e.current || undefined}
            data-active={i === active || undefined}
          >
            <button
              type="button"
              className={styles.milestone}
              data-milestone=""
              aria-pressed={i === active}
              aria-controls={detailId}
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onKeyDown={(ev) => onKeyDown(ev, i)}
            >
              <span className={styles.badge} aria-hidden="true">
                <Icon name={e.icon} size={18} />
              </span>
              <span className={styles.phase}>{e.phase}</span>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.title}>
                {e.title}
                {e.current ? <span className={styles.currentTag}> (current)</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div id={detailId} className={styles.detail} aria-live="polite">
        <div className={styles.detailHead}>
          <span className={styles.detailIndex}>
            Milestone {String(active + 1).padStart(2, '0')} · {entry.phase}
          </span>
          {entry.verification.status === 'placeholder' ? <StatusTag tone="sample">Sample</StatusTag> : null}
        </div>
        <p className={styles.detailTitle}>{entry.title}</p>
        <p className={styles.detailText}>{entry.summary}</p>
        <p className={styles.detailMeta}>
          {entry.organization ?? 'Organisation pending CV review'} · {entry.period ?? 'Dates pending CV review'}
        </p>
      </div>
    </div>
  );
}

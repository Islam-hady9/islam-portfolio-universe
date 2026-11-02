'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAssistant, type Presence } from '@/state/assistant-store';
import { shortcutAria, useShortcutLabel } from './focus';
import styles from './AssistantOrb.module.css';

const R = 26;
const C = 2 * Math.PI * R;

function statusText(p: Presence): string {
  switch (p.phase) {
    case 'retrieving':
      return 'searching the portfolio';
    case 'downloading':
      return `downloading the local model${p.progress !== null ? `, ${Math.round(p.progress * 100)} %` : ''}`;
    case 'initializing':
      return 'preparing the local model';
    case 'generating':
      return 'writing an answer';
    case 'fallback':
      return 'answered in Smart Mode';
    case 'error':
      return 'needs attention';
    default:
      return '';
  }
}

/**
 * The floating intelligence orb (AI Presence V1): a miniature of the Intelligence Core that
 * opens the global drawer from any page. CSS/SVG only — no canvas, no model, no animation
 * loop in JS; its state follows the assistant's published presence (changes on transitions
 * only, never per token). It steps aside while the full Ask My AI panel is on screen, and
 * tucks most of itself past the screen edge whenever a link, button or field is underneath it
 * (checked once scrolling settles), so it never covers a CTA — still visible and tappable.
 */
export function AssistantOrb() {
  const open = useAssistant((s) => s.open);
  const presence = useAssistant((s) => s.presence);
  const section = useAssistant((s) => s.slots.section);
  const [sectionInView, setSectionInView] = useState(false);
  const [tucked, setTucked] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const hint = useShortcutLabel();
  const pathname = usePathname();

  useEffect(() => {
    let timer = 0;
    const check = () => {
      const btn = ref.current;
      const body = btn?.querySelector<HTMLElement>('[data-orb-body]');
      if (!btn || !body) return;
      // Probe where the orb sits when NOT tucked (remove its own translation), otherwise a tucked
      // orb would no longer "see" the CTA it moved away from and flip back over it.
      const r = body.getBoundingClientRect();
      const t = getComputedStyle(btn).transform;
      const shift = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
      const left = r.left - (shift?.m41 ?? 0);
      const top = r.top - (shift?.m42 ?? 0);
      const points: [number, number][] = [
        [left + r.width / 2, top + r.height / 2],
        [left + r.width * 0.2, top + r.height * 0.2],
        [left + r.width * 0.2, top + r.height * 0.8],
      ];
      const covered = points.some(([x, y]) =>
        document
          .elementsFromPoint(x, y)
          .some(
            (el) =>
              el !== btn &&
              !btn.contains(el) &&
              el.closest('a[href], button, input, select, textarea, [role="button"], label') !== null,
          ),
      );
      setTucked(covered);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 140);
    };
    // Content can also move under a resting orb: the hero's entrance cascade (which waits for the
    // prelude) and other reveals end with animationend/transitionend — rare events, not per frame.
    const onSettled = (e: Event) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) schedule();
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('animationend', onSettled, true);
    document.addEventListener('transitionend', onSettled, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('animationend', onSettled, true);
      document.removeEventListener('transitionend', onSettled, true);
    };
    // A new route brings new content under the orb (and may not scroll).
  }, [pathname]);

  useEffect(() => {
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setSectionInView((e?.intersectionRatio ?? 0) > 0.35), {
      threshold: [0, 0.2, 0.35, 0.5, 0.8],
    });
    io.observe(section);
    return () => io.disconnect();
  }, [section]);

  // Only while a section slot exists (home page) can the full panel be on screen.
  const away = Boolean(section) && sectionInView;
  const status = statusText(presence);
  const progress = presence.progress;
  return (
    <button
      ref={ref}
      type="button"
      className={styles.orb}
      data-phase={presence.phase}
      data-open={open || undefined}
      data-away={away || undefined}
      data-tucked={tucked || undefined}
      aria-label={status ? `Ask My AI — ${status}` : 'Ask My AI'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-keyshortcuts={shortcutAria(hint)}
      data-magnetic=""
      data-action="assistant-orb"
      data-testid="assistant-orb"
      onPointerEnter={() => useAssistant.getState().request()}
      onFocus={() => useAssistant.getState().request()}
      onClick={(e) => useAssistant.getState().openAssistant({ opener: e.currentTarget })}
    >
      <span className={styles.label} aria-hidden="true">
        <span>Ask My AI</span>
        <kbd className={styles.kbd}>{hint}</kbd>
      </span>
      <span className={styles.body} data-magnetic-inner="" data-orb-body="">
        <svg className={styles.rings} viewBox="0 0 60 60" aria-hidden="true" focusable="false">
          <circle className={styles.track} cx="30" cy="30" r={R} />
          <g className={styles.orbits}>
            <ellipse className={styles.orbit} cx="30" cy="30" rx={R - 3} ry="8.5" />
            <ellipse
              className={styles.orbit}
              cx="30"
              cy="30"
              rx={R - 3}
              ry="8.5"
              transform="rotate(62 30 30)"
            />
            <circle className={styles.satellite} cx={30 + R - 3} cy="30" r="1.6" />
          </g>
          {progress !== null ? (
            <circle
              className={styles.progress}
              cx="30"
              cy="30"
              r={R}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
            />
          ) : null}
        </svg>
        <span className={styles.core} />
        <span className={styles.dot} />
      </span>
    </button>
  );
}

'use client';

import { useRef, type CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DeferredImg } from '@/components/ui/DeferredImg';
import { track } from '@/lib/analytics';
import { openReel, warmReel } from './reel-bus';
import styles from './IntroReelTrigger.module.css';

export interface IntroReelTriggerProps {
  label: string;
  /** "0:35" (shown) and "35 seconds" (announced). */
  duration: string;
  spokenDuration: string;
  /** Small caption after the duration, e.g. "PERSONAL REEL" (chip only). */
  meta?: string;
  variant: 'chip' | 'overlay';
  /** Square poster crop for the chip (deferred until after first paint). */
  thumbnail?: { src: string; sources: readonly { type: string; srcSet: string }[] };
  dataAction: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Opens the intro reel. Hover/focus/touch warm the player chunk so the click can start
 * playback synchronously; the button announces that it opens a dialog and how long the
 * video is.
 */
export function IntroReelTrigger({
  label,
  duration,
  spokenDuration,
  meta,
  variant,
  thumbnail,
  dataAction,
  className,
  style,
}: IntroReelTriggerProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const intent = () => void warmReel();
  return (
    <button
      ref={ref}
      type="button"
      className={[styles.trigger, styles[variant], className].filter(Boolean).join(' ')}
      style={style}
      aria-haspopup="dialog"
      data-action={dataAction}
      data-magnetic={variant === 'chip' ? '' : undefined}
      onPointerEnter={intent}
      onFocus={intent}
      onTouchStart={intent}
      onClick={() => {
        track('reel_open', { from: dataAction });
        openReel(ref.current);
      }}
    >
      <span className={styles.inner} data-magnetic-inner="">
        {variant === 'chip' && thumbnail ? (
          <span className={styles.thumb} aria-hidden="true">
            <DeferredImg
              className={styles.thumbImg}
              src={thumbnail.src}
              sources={thumbnail.sources}
              sizes="52px"
              width={52}
              height={52}
              alt=""
            />
            <span className={styles.badge}>
              <Icon name="play" size={11} strokeWidth={0} fill="currentColor" />
            </span>
          </span>
        ) : (
          <span className={styles.disc} aria-hidden="true">
            <Icon name="play" size={14} strokeWidth={0} fill="currentColor" />
          </span>
        )}
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          <span className={styles.meta} aria-hidden="true">
            {duration}
            {meta ? <span className={styles.metaExtra}> · {meta}</span> : null}
          </span>
          <span className="sr-only">, {spokenDuration} video</span>
        </span>
      </span>
    </button>
  );
}

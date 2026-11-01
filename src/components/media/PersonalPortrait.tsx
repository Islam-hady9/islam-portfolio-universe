import type { ReactNode } from 'react';
import { DeferredImg } from '@/components/ui/DeferredImg';
import { portraitAsset } from '@/lib/media';
import styles from './PersonalPortrait.module.css';

/**
 * The owner's portrait as an editorial, art-directed frame: the photograph is shown as-is
 * (no retouching); depth comes from the frame — a lamp-warm spill, a low scrim for the caption,
 * a soft vignette, fine grain and viewfinder corner marks echoing the site's precision language.
 *
 * - `priority` (above the fold, e.g. /about): eager, high fetch priority.
 * - default (below the fold): requested only after first paint and revealed on scroll.
 * Intrinsic size + aspect-ratio come from the server HTML, so loading never shifts layout.
 */
export function PersonalPortrait({
  alt,
  eyebrow,
  sizes,
  priority = false,
  variant,
  action,
  className,
}: {
  alt: string;
  eyebrow: string;
  /** The rendered width for responsive candidate selection, e.g. "(max-width: 767px) 92vw, 30vw". */
  sizes: string;
  priority?: boolean;
  variant: 'band' | 'hero';
  /** Optional control docked in the frame (the intro-reel trigger). */
  action?: ReactNode;
  className?: string;
}) {
  const p = portraitAsset();
  return (
    <figure
      className={[styles.portrait, className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-reveal={priority ? undefined : 'mask'}
      data-portrait=""
    >
      <div
        className={styles.frame}
        data-spotlight=""
        style={{ ['--lqip' as string]: `url("${p.placeholder}")` }}
      >
        <span className={styles.lqip} aria-hidden="true" />
        {priority ? (
          <picture>
            {p.sources.map((s) => (
              <source key={s.type} type={s.type} srcSet={s.srcSet} sizes={sizes} />
            ))}
            <img
              className={styles.img}
              src={p.fallback.src}
              srcSet={p.fallback.srcSet}
              sizes={sizes}
              width={p.width}
              height={p.height}
              alt={alt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              data-reveal-media=""
            />
          </picture>
        ) : (
          <DeferredImg
            className={styles.img}
            src={p.fallback.src}
            srcSet={p.fallback.srcSet}
            sources={p.sources}
            sizes={sizes}
            width={p.width}
            height={p.height}
            alt={alt}
            decoding="async"
            data-reveal-media=""
          />
        )}
        <span className={styles.grade} aria-hidden="true" />
        <span className={styles.grain} aria-hidden="true" />
        <span className={styles.corners} aria-hidden="true" />
        {action ? <div className={styles.dock}>{action}</div> : null}
      </div>
      <figcaption className={styles.caption} data-docked={action ? '' : undefined}>
        <span className={styles.signal} aria-hidden="true" />
        {eyebrow}
      </figcaption>
    </figure>
  );
}

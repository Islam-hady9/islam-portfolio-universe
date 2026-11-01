import type { ProjectWorld } from '@/content/schema';
import { posterFor } from '@/lib/posters';
import styles from './ProjectPoster.module.css';

/**
 * Static artwork for a project world: a poster rendered from the live mini-world when
 * available, otherwise distinct procedural CSS art (spec §3.5: four visual languages).
 */
export function ProjectPoster({
  world,
  alt,
  priority = false,
  variant = 'card',
}: {
  world: ProjectWorld;
  alt: string;
  priority?: boolean;
  /** "hero" uses the wide case-study framing when available. */
  variant?: 'card' | 'hero';
}) {
  const poster = (variant === 'hero' ? posterFor(`case-${world}`) : null) ?? posterFor(`project-${world}`);
  return (
    <div className={`${styles.poster} ${styles[world]}`} data-project-poster={world}>
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element -- pre-optimised poster rendered from the site's own scene
        <img
          className={styles.img}
          src={poster.src}
          srcSet={poster.srcSet}
          sizes={poster.srcSet ? (variant === 'hero' ? '100vw' : '(max-width: 599px) 100vw, (max-width: 1199px) 50vw, 25vw') : undefined}
          width={poster.width}
          height={poster.height}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <span role="img" aria-label={alt} className={styles.art}>
          <span className={styles.layerA} />
          <span className={styles.layerB} />
          <span className={styles.layerC} />
        </span>
      )}
    </div>
  );
}

import { preload } from 'react-dom';
import { posterFor, type PosterScene } from '@/lib/posters';
import { DeferredImg } from '@/components/ui/DeferredImg';
import styles from './SceneArt.module.css';

/** Rendered width of each scene's art box, for responsive poster selection. */
const SIZES: Record<PosterScene, string> = {
  hero: '(max-width: 767px) 100vw, 62vw',
  universe: '(max-width: 1023px) 100vw, 60vw',
  journey: '100vw',
  portal: '(max-width: 767px) 100vw, 45vw',
  horizon: '100vw',
  'deep-space': '100vw',
};

/**
 * Accessible stand-in for a 3D scene region (spec §7: concise description, not dozens of
 * decorative nodes) and its static fallback art. The poster is visible until the WebGL layer
 * reports "ready", and permanently in the static tier / when WebGL fails (spec §6.7).
 */
export function SceneArt({
  scene,
  label,
  className,
}: {
  scene: PosterScene;
  label: string;
  className?: string;
}) {
  const poster = posterFor(scene);
  // The hero poster is the mobile LCP element: start fetching it with the document.
  if (scene === 'hero' && poster) {
    preload(poster.src, {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: poster.srcSet,
      imageSizes: poster.srcSet ? SIZES.hero : undefined,
    });
  }
  return (
    <div
      className={[styles.art, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      data-scene-art={scene}
    >
      <div className={`${styles.poster} ${styles[scene] ?? ''}`} aria-hidden="true">
        {poster && scene === 'hero' ? (
          // eslint-disable-next-line @next/next/no-img-element -- static poster, sized by CSS; next/image adds no value for a decorative fallback layer
          <img
            className={styles.img}
            src={poster.src}
            srcSet={poster.srcSet}
            sizes={poster.srcSet ? SIZES[scene] : undefined}
            alt=""
            width={poster.width}
            height={poster.height}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        ) : poster ? (
          // Below the fold: requested after first paint so it never competes with the LCP image.
          <DeferredImg
            className={styles.img}
            src={poster.src}
            srcSet={poster.srcSet}
            sizes={poster.srcSet ? SIZES[scene] : undefined}
            alt=""
            width={poster.width}
            height={poster.height}
            decoding="async"
            fetchPriority="low"
          />
        ) : null}
      </div>
    </div>
  );
}

import { posterFor, type PosterScene } from '@/lib/posters';
import styles from './SceneArt.module.css';

/**
 * Accessible stand-in for a 3D scene region (spec §7: concise description, not dozens of
 * decorative nodes) and its static fallback art. The poster is visible until the WebGL layer
 * reports "ready", and permanently in the static tier / when WebGL fails (spec §6.7).
 */
export function SceneArt({ scene, label, className }: { scene: PosterScene; label: string; className?: string }) {
  const poster = posterFor(scene);
  return (
    <div className={[styles.art, className].filter(Boolean).join(' ')} role="img" aria-label={label} data-scene-art={scene}>
      <div className={`${styles.poster} ${styles[scene] ?? ''}`} aria-hidden="true">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- static poster, sized by CSS; next/image adds no value for a decorative fallback layer
          <img
            className={styles.img}
            src={poster.src}
            alt=""
            width={poster.width}
            height={poster.height}
            loading={scene === 'hero' ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={scene === 'hero' ? 'high' : 'low'}
          />
        ) : null}
      </div>
    </div>
  );
}

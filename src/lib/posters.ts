/**
 * Static fallback posters rendered from the site's own scenes (scripts/capture/posters.ts).
 * Until a poster exists for a scene, SceneArt falls back to procedural CSS art.
 */
import manifest from '@/assets/posters.json';

export type PosterScene = 'hero' | 'universe' | 'journey' | 'portal' | 'horizon' | 'deep-space';

export interface PosterEntry {
  src: string;
  width: number;
  height: number;
  /** Responsive candidates ("url 480w, url 800w, …") when variants exist. */
  srcSet?: string;
}

const posters = manifest as Partial<Record<string, PosterEntry>>;

export function posterFor(scene: string): PosterEntry | null {
  return posters[scene] ?? null;
}

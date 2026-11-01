/**
 * DOM ↔ WebGL bridge for project portals. Kept free of three.js so DOM components can
 * import it without pulling the 3D bundle. The portal renderer reads this every frame.
 */

export interface PortalPointer {
  x: number;
  y: number;
}

export interface PortalTrack {
  slug: string;
  el: HTMLElement;
  /** "card" renders only while engaged; "hero" renders whenever on screen. */
  kind: 'card' | 'hero';
}

const hover = new Map<string, PortalPointer>();
const tracks = new Set<PortalTrack>();

export function setPortalHover(slug: string, pointer: PortalPointer | null) {
  if (pointer) hover.set(slug, pointer);
  else hover.delete(slug);
}

export function getPortalHover(slug: string): PortalPointer | null {
  return hover.get(slug) ?? null;
}

export function registerPortalTrack(track: PortalTrack): () => void {
  tracks.add(track);
  return () => {
    tracks.delete(track);
  };
}

export function getPortalTracks(): ReadonlySet<PortalTrack> {
  return tracks;
}

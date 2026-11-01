/**
 * Camera grammar (spec §6.3) as data + pure evaluation (unit-tested).
 * Poses are tuned against screenshots; they are working values, not "approved" coordinates.
 */

export type Vec3 = [number, number, number];
export type AspectClass = 'wide' | 'portrait';

export interface Pose {
  position: Vec3;
  target: Vec3;
  fov: number;
  /** Lens shift as a fraction of the viewport: +x moves the subject right, +y moves it up. */
  lens: [number, number];
}

export interface Station {
  id: string;
  /** DOM section id this station is anchored to. */
  section: string;
  wide: Pose;
  portrait: Pose;
  /** Camera offset applied per viewport-height of local scroll (shallow dolly / lateral parallax). */
  drift: Vec3;
}

export function aspectClassFor(width: number, height: number): AspectClass {
  return width / Math.max(1, height) < 0.9 ? 'portrait' : 'wide';
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Uniform Catmull-Rom between p1 and p2 (p0/p3 neighbours). */
export function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] =
      0.5 *
      (2 * p1[k]! +
        (-p0[k]! + p2[k]!) * t +
        (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 +
        (-p0[k]! + 3 * p1[k]! - 3 * p2[k]! + p3[k]!) * t3);
  }
  return out;
}

/** Pose at continuous path parameter s ∈ [0, stations-1]. */
export function evaluatePath(stations: Station[], s: number, aspect: AspectClass): Pose {
  const n = stations.length;
  const clamped = Math.min(n - 1, Math.max(0, s));
  const i = Math.min(n - 2, Math.floor(clamped));
  const t = clamped - i;
  const pose = (k: number) => stations[Math.min(n - 1, Math.max(0, k))]![aspect];
  const p0 = pose(i - 1);
  const p1 = pose(i);
  const p2 = pose(i + 1);
  const p3 = pose(i + 2);
  return {
    position: catmullRom(p0.position, p1.position, p2.position, p3.position, t),
    target: catmullRom(p0.target, p1.target, p2.target, p3.target, t),
    fov: lerp(p1.fov, p2.fov, t),
    lens: [lerp(p1.lens[0], p2.lens[0], t), lerp(p1.lens[1], p2.lens[1], t)],
  };
}

const P = (position: Vec3, target: Vec3, fov: number, lens: [number, number]): Pose => ({ position, target, fov, lens });

/** World layout shared by stations and scene objects. */
export const WORLD = {
  core: [0, 0, 0] as Vec3,
  heroPlanet: { position: [24, 1.2, -58] as Vec3, radius: 4.6 },
  heroGroundY: -6.8,
  galaxy: { center: [0, -15.5, -15] as Vec3, radius: 7.8 },
  capabilities: { center: [0, -36, -14] as Vec3 },
  journey: { groundY: -52.5, moon: [54, -24, -118] as Vec3 },
  portal: { center: [-5.6, -60.6, -19] as Vec3, radius: 3.6, groundY: -64.7 },
  // ≈ 21° right, 7° up, 17° angular radius from the contact camera → massive limb on the right.
  horizon: { planet: [54, -51.6, -128] as Vec3, planetRadius: 44, groundY: -73.5 },
} as const;

/** Home stations in narrative order (spec §5). */
export const HOME_STATIONS: Station[] = [
  {
    // Low camera looking up at the core: horizon lands near 80% height (reference composition).
    id: 'hero',
    section: 'top',
    wide: P([0, -2.5, 15.2], [0, 0.25, 0], 34, [0.165, 0.03]),
    portrait: P([0, -2.2, 21], [0, 0.6, 0], 42, [0, 0.21]),
    drift: [0, 0, 0],
  },
  {
    // The core slides up and out of frame (same direction as the page), dimming as it recedes.
    id: 'identity',
    section: 'identity',
    wide: P([-1.5, -7.6, 22], [-0.5, -6.9, 0], 34, [0.05, 0]),
    portrait: P([-1, -7.2, 26], [-0.4, -6.6, 0], 42, [0, 0.05]),
    drift: [0, 0, 0],
  },
  {
    id: 'universe',
    section: 'universe',
    wide: P([0.2, -12.0, 8.6], [-0.9, -15.6, -15], 36, [0.1, -0.01]),
    portrait: P([0, -11.2, 13], [0, -15.4, -15], 46, [0, 0.16]),
    drift: [0, -0.15, -1.1],
  },
  {
    id: 'projects',
    section: 'projects',
    wide: P([0, -22.4, 7.5], [0, -23.6, -12], 36, [0, 0]),
    portrait: P([0, -22.4, 9], [0, -23.6, -12], 42, [0, 0]),
    drift: [0, 0, 0],
  },
  {
    id: 'philosophy',
    section: 'philosophy',
    wide: P([-0.6, -28.6, 7.5], [0, -29.8, -12], 36, [0, 0]),
    portrait: P([-0.4, -28.6, 9], [0, -29.8, -12], 42, [0, 0]),
    drift: [0, 0, 0],
  },
  {
    id: 'capabilities',
    section: 'capabilities',
    wide: P([0.5, -34.6, 7.5], [0, -35.8, -12], 36, [0, 0]),
    portrait: P([0.3, -34.6, 9], [0, -35.8, -12], 42, [0, 0]),
    drift: [0, 0, 0],
  },
  {
    id: 'experience',
    section: 'experience',
    wide: P([0, -49.6, 9], [0, -48.6, -30], 38, [0, -0.04]),
    portrait: P([0, -49.2, 12], [0, -48.4, -30], 48, [0, 0.05]),
    drift: [3.2, 0.1, 0],
  },
  {
    id: 'ask-ai',
    section: 'ask-ai',
    wide: P([-0.6, -61.5, 10], [-5.3, -61.1, -19], 36, [-0.27, 0.02]),
    portrait: P([-5.0, -61.0, 13], [-5.5, -60.6, -19], 46, [0, 0.2]),
    drift: [0.4, 0, -0.8],
  },
  {
    id: 'contact',
    section: 'contact',
    wide: P([0, -70, 12], [0, -68.6, -60], 38, [0, 0]),
    portrait: P([4, -70, 14], [10, -67.4, -60], 46, [0, 0.14]),
    drift: [0, 0.3, 1.4],
  },
];

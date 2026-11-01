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

const P = (position: Vec3, target: Vec3, fov: number, lens: [number, number]): Pose => ({
  position,
  target,
  fov,
  lens,
});

/** World layout shared by stations and scene objects. */
export const WORLD = {
  core: [0, 0, 0] as Vec3,
  heroPlanet: { position: [24, 1.2, -58] as Vec3, radius: 4.6 },
  /** Base of the hero terrain (the identity camera rests just above it). */
  heroGroundY: -8.0,
  galaxy: { center: [0, -15.5, -15] as Vec3, radius: 7.8 },
  capabilities: { center: [0, -36, -14] as Vec3 },
  // Moon sits on the right frame edge, below the right-aligned journey subtitle and right of the
  // "Now" milestone at 16:10 and 16:9 (it overlapped the subtitle when closer to centre).
  journey: { groundY: -52.5, moon: [65.6, -25.7, -118] as Vec3 },
  // plateauHeight: flat stand for the explorer, relative to the portal terrain base.
  portal: { center: [-5.6, -60.6, -19] as Vec3, radius: 3.6, groundY: -64.7, plateauHeight: 0.6 },
  // ≈ 21° right, 7° up, 17° angular radius from the contact camera → massive limb on the right.
  horizon: { planet: [54, -51.6, -128] as Vec3, planetRadius: 44, groundY: -73.5 },
} as const;

/** Home stations in narrative order (spec §5). */
export const HOME_STATIONS: Station[] = [
  {
    // Low camera looking up at the core: horizon lands near 80% height (reference composition).
    id: 'hero',
    section: 'top',
    wide: P([0, -2.5, 15.2], [0, 0.25, 0], 34, [0.185, 0.03]),
    portrait: P([0, -2.2, 21], [0, 0.6, 0], 42, [0, 0.21]),
    drift: [0, 0, 0],
  },
  {
    // The core slides up and out of frame (same direction as the page), dimming as it recedes.
    // 0.9 above the hero ground: room for pointer parallax and a gentle veil on the way down.
    id: 'identity',
    section: 'identity',
    wide: P([-1.5, -7.1, 22], [-0.5, -6.4, 0], 34, [0.05, 0]),
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

/**
 * Ground layers the path descends through between stations. Seen from below, a terrain reads as
 * a floating sheet (and whatever stands on it floats with it), so each crossing is masked by a
 * short canvas veil and the layer above is hidden under it. Crossing parameters are solved on
 * the base path per aspect, so the veil is exactly 0 at every station.
 */
export const GROUND_LAYERS = [
  { id: 'hero', from: 1, ground: WORLD.heroGroundY }, // identity → universe
  { id: 'journey', from: 6, ground: WORLD.journey.groundY }, // experience → ask-ai
  // ask-ai → contact: the camera skims the explorer's plateau before the terrain base.
  { id: 'portal', from: 7, ground: WORLD.portal.groundY + WORLD.portal.plateauHeight },
] as const;

export type GroundLayerId = (typeof GROUND_LAYERS)[number]['id'];

/** A layer disappears this far (in s) past its crossing — inside the veil's opaque span. */
export const LAYER_HIDE_AFTER = 0.03;
/** Pointer parallax keeps the camera at least this far above a visible ground layer. */
export const GROUND_CLEARANCE = 0.35;

/** Path parameter in (from, from + 1) where the base camera height passes `ground`; NaN if it never does. */
export function solveGroundCrossing(from: number, ground: number, aspect: AspectClass): number {
  const above = (s: number) => evaluatePath(HOME_STATIONS, s, aspect).position[1] - ground;
  let lo = from;
  let hi = from + 1;
  if (!(above(lo) > 0 && above(hi) < 0)) return Number.NaN;
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2;
    if (above(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The veil starts when the descending camera is this high above the ground, opaque from VEIL_FULL_HEIGHT. */
export const VEIL_RISE_HEIGHT = 1.4;
export const VEIL_FULL_HEIGHT = 0.25;

/** Path-parameter span of one crossing veil: rise → full → (crossing) → clear → end. */
export interface GroundTransit {
  rise: number;
  full: number;
  crossing: number;
  clear: number;
  end: number;
}

export function solveGroundTransit(
  layer: (typeof GROUND_LAYERS)[number],
  aspect: AspectClass,
): GroundTransit {
  const crossing = solveGroundCrossing(layer.from, layer.ground, aspect);
  const riseAt = solveGroundCrossing(layer.from, layer.ground + VEIL_RISE_HEIGHT, aspect);
  const fullAt = solveGroundCrossing(layer.from, layer.ground + VEIL_FULL_HEIGHT, aspect);
  // Never start inside a station's dwell, even when the station itself sits close to the ground.
  const rise = Math.max(Number.isFinite(riseAt) ? riseAt : layer.from, layer.from + 0.03);
  const full = Math.min(crossing, Math.max(Number.isFinite(fullAt) ? fullAt : rise, rise + 0.02));
  return { rise, full, crossing, clear: crossing + 0.08, end: Math.min(crossing + 0.2, layer.from + 0.97) };
}

function solveAll(aspect: AspectClass): Record<GroundLayerId, GroundTransit> {
  const out = {} as Record<GroundLayerId, GroundTransit>;
  for (const layer of GROUND_LAYERS) out[layer.id] = solveGroundTransit(layer, aspect);
  return out;
}

export const GROUND_TRANSITS: Record<AspectClass, Record<GroundLayerId, GroundTransit>> = {
  wide: solveAll('wide'),
  portrait: solveAll('portrait'),
};

const smooth01 = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Canvas veil (0..1) around ground crossings: rises as the camera nears the ground, stays opaque
 * while the layer above is hidden, then fades. Never starts within 0.03 of a station.
 */
export function transitVeil(s: number, transits: Record<GroundLayerId, GroundTransit>): number {
  let v = 0;
  for (const layer of GROUND_LAYERS) {
    const t = transits[layer.id];
    if (!Number.isFinite(t.crossing) || s <= t.rise || s >= t.end) continue;
    const up = smooth01((s - t.rise) / Math.max(1e-6, t.full - t.rise));
    const down = 1 - smooth01((s - t.clear) / Math.max(1e-6, t.end - t.clear));
    v = Math.max(v, Math.min(up, down));
  }
  return v;
}

/** Whether a ground layer is still drawn at path parameter s (hidden once the camera is below it). */
export function groundLayerVisible(id: GroundLayerId, s: number, aspect: AspectClass): boolean {
  const c = GROUND_TRANSITS[aspect][id].crossing;
  return !(Number.isFinite(c) && s > c + LAYER_HIDE_AFTER);
}

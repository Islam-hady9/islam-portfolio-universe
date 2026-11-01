import { describe, expect, it } from 'vitest';
import {
  GROUND_CLEARANCE,
  GROUND_TRANSITS,
  GROUND_LAYERS,
  HOME_STATIONS,
  LAYER_HIDE_AFTER,
  aspectClassFor,
  catmullRom,
  evaluatePath,
  groundLayerVisible,
  lerpVec,
  solveGroundCrossing,
  transitVeil,
  VEIL_FULL_HEIGHT,
  VEIL_RISE_HEIGHT,
  type AspectClass,
  type Pose,
  type Vec3,
} from '@/experience/orchestrator/camera-path';
import { SECTION_IDS } from '@/lib/routes';

const ASPECTS: AspectClass[] = ['wide', 'portrait'];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function expectPoseClose(actual: Pose, expected: Pose, digits = 10) {
  actual.position.forEach((v, k) => expect(v).toBeCloseTo(expected.position[k]!, digits));
  actual.target.forEach((v, k) => expect(v).toBeCloseTo(expected.target[k]!, digits));
  expect(actual.fov).toBeCloseTo(expected.fov, digits);
  actual.lens.forEach((v, k) => expect(v).toBeCloseTo(expected.lens[k]!, digits));
}

describe('aspectClassFor', () => {
  it('classifies landscape and square-ish viewports as wide', () => {
    expect(aspectClassFor(1920, 1080)).toBe('wide');
    expect(aspectClassFor(1000, 1000)).toBe('wide');
    expect(aspectClassFor(900, 1000)).toBe('wide'); // exactly 0.9
  });

  it('classifies tall viewports as portrait', () => {
    expect(aspectClassFor(390, 844)).toBe('portrait');
    expect(aspectClassFor(899, 1000)).toBe('portrait');
  });

  it('does not divide by zero for a zero-height viewport', () => {
    expect(aspectClassFor(1280, 0)).toBe('wide');
  });
});

describe('lerpVec', () => {
  it('interpolates component-wise', () => {
    expect(lerpVec([0, 10, -4], [10, 20, 4], 0.25)).toEqual([2.5, 12.5, -2]);
  });
});

describe('catmullRom', () => {
  const p0: Vec3 = [-3, 2, 1];
  const p1: Vec3 = [0, 0, 0];
  const p2: Vec3 = [4, 1, -2];
  const p3: Vec3 = [6, 5, -1];

  it('passes through p1 at t=0 and p2 at t=1', () => {
    expect(catmullRom(p0, p1, p2, p3, 0)).toEqual(p1);
    catmullRom(p0, p1, p2, p3, 1).forEach((v, k) => expect(v).toBeCloseTo(p2[k]!, 12));
  });

  it('reduces to linear interpolation for evenly spaced collinear points', () => {
    const out = catmullRom([0, 0, 0], [1, 2, 3], [2, 4, 6], [3, 6, 9], 0.5);
    out.forEach((v, k) => expect(v).toBeCloseTo([1.5, 3, 4.5][k]!, 12));
  });
});

describe('HOME_STATIONS', () => {
  it('has the nine narrative stations anchored to the home sections, in order', () => {
    expect(HOME_STATIONS).toHaveLength(9);
    expect(HOME_STATIONS.map((s) => s.section)).toEqual([
      'top',
      'identity',
      'universe',
      'projects',
      'philosophy',
      'capabilities',
      'experience',
      'ask-ai',
      'contact',
    ]);
  });

  it('matches the route map section ids exactly', () => {
    expect(HOME_STATIONS.map((s) => s.section)).toEqual([...SECTION_IDS]);
  });

  it('has unique station ids', () => {
    const ids = HOME_STATIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ASPECTS)('keeps every %s pose within sane lens limits', (aspect) => {
    for (const station of HOME_STATIONS) {
      const pose = station[aspect];
      expect(pose.fov, `${station.id} fov`).toBeGreaterThanOrEqual(20);
      expect(pose.fov, `${station.id} fov`).toBeLessThanOrEqual(60);
      for (const shift of pose.lens) expect(Math.abs(shift), `${station.id} lens`).toBeLessThanOrEqual(0.35);
      for (const v of [...pose.position, ...pose.target]) expect(Number.isFinite(v)).toBe(true);
      expect(
        dist(pose.position, pose.target),
        `${station.id} camera must not sit on its target`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('evaluatePath', () => {
  const last = HOME_STATIONS.length - 1;

  it.each(ASPECTS)('returns the exact station pose at every integer s (%s)', (aspect) => {
    for (let i = 0; i <= last; i++) {
      expectPoseClose(evaluatePath(HOME_STATIONS, i, aspect), HOME_STATIONS[i]![aspect]);
    }
  });

  it('returns exact (bit-identical) poses at the start of each segment', () => {
    const pose = evaluatePath(HOME_STATIONS, 3, 'wide');
    expect(pose.position).toEqual(HOME_STATIONS[3]!.wide.position);
    expect(pose.fov).toBe(HOME_STATIONS[3]!.wide.fov);
  });

  it.each(ASPECTS)('clamps out-of-range s to the first and last stations (%s)', (aspect) => {
    expectPoseClose(evaluatePath(HOME_STATIONS, -5, aspect), HOME_STATIONS[0]![aspect]);
    expectPoseClose(evaluatePath(HOME_STATIONS, last + 7, aspect), HOME_STATIONS[last]![aspect]);
  });

  it.each(ASPECTS)('is continuous along the whole path (%s)', (aspect) => {
    const step = 1e-3;
    let prev = evaluatePath(HOME_STATIONS, 0, aspect);
    for (let s = step; s <= last; s += step) {
      const pose = evaluatePath(HOME_STATIONS, s, aspect);
      expect(dist(pose.position, prev.position)).toBeLessThan(0.05);
      expect(dist(pose.target, prev.target)).toBeLessThan(0.1);
      expect(Math.abs(pose.fov - prev.fov)).toBeLessThan(0.05);
      prev = pose;
    }
  });

  it.each(ASPECTS)('has no jump across station boundaries (%s)', (aspect) => {
    const eps = 1e-7;
    for (let i = 1; i < last; i++) {
      const before = evaluatePath(HOME_STATIONS, i - eps, aspect);
      const after = evaluatePath(HOME_STATIONS, i + eps, aspect);
      expect(dist(before.position, after.position)).toBeLessThan(1e-4);
      expect(dist(before.target, after.target)).toBeLessThan(1e-4);
      expect(Math.abs(before.fov - after.fov)).toBeLessThan(1e-4);
    }
  });

  it('interpolates fov and lens linearly between neighbouring stations', () => {
    const a = HOME_STATIONS[6]!.wide;
    const b = HOME_STATIONS[7]!.wide;
    const mid = evaluatePath(HOME_STATIONS, 6.5, 'wide');
    expect(mid.fov).toBeCloseTo((a.fov + b.fov) / 2, 12);
    expect(mid.lens[0]).toBeCloseTo((a.lens[0] + b.lens[0]) / 2, 12);
    expect(mid.lens[1]).toBeCloseTo((a.lens[1] + b.lens[1]) / 2, 12);
  });
});

describe('ground crossings (the camera is never seen passing through terrain)', () => {
  it('solves one crossing inside each descending segment, for both aspects', () => {
    for (const aspect of ASPECTS) {
      for (const layer of GROUND_LAYERS) {
        const c = GROUND_TRANSITS[aspect][layer.id].crossing;
        expect(c).toBeGreaterThan(layer.from);
        expect(c).toBeLessThan(layer.from + 1);
        expect(evaluatePath(HOME_STATIONS, c, aspect).position[1]).toBeCloseTo(layer.ground, 6);
      }
    }
  });

  it('descends monotonically through every crossing segment (so bisection is valid)', () => {
    for (const aspect of ASPECTS) {
      for (const layer of GROUND_LAYERS) {
        let previous = Number.POSITIVE_INFINITY;
        for (let k = 0; k <= 200; k++) {
          const y = evaluatePath(HOME_STATIONS, layer.from + k / 200, aspect).position[1];
          expect(y).toBeLessThan(previous);
          previous = y;
        }
      }
    }
  });

  it('returns NaN when the path never reaches the ground, and the veil ignores it', () => {
    expect(solveGroundCrossing(0, 100, 'wide')).toBeNaN();
    const none = { rise: 1.1, full: 1.2, crossing: Number.NaN, clear: 1.3, end: 1.4 };
    expect(transitVeil(1.25, { hero: none, journey: none, portal: none })).toBe(0);
  });

  it('never veils a station or the dwell around it', () => {
    for (const aspect of ASPECTS) {
      for (let s = 0; s < HOME_STATIONS.length; s++) {
        for (const d of [-0.02, 0, 0.02]) expect(transitVeil(s + d, GROUND_TRANSITS[aspect])).toBe(0);
      }
    }
  });

  it('is fully opaque from the crossing until the layer above has been hidden', () => {
    for (const aspect of ASPECTS) {
      const transits = GROUND_TRANSITS[aspect];
      for (const layer of GROUND_LAYERS) {
        const c = transits[layer.id].crossing;
        for (const d of [0, LAYER_HIDE_AFTER, LAYER_HIDE_AFTER + 0.01])
          expect(transitVeil(c + d, transits)).toBe(1);
        expect(groundLayerVisible(layer.id, layer.from, aspect)).toBe(true);
        expect(groundLayerVisible(layer.id, c, aspect)).toBe(true);
        expect(groundLayerVisible(layer.id, c + LAYER_HIDE_AFTER + 0.001, aspect)).toBe(false);
        expect(transitVeil(c + 0.25, transits)).toBe(0);
      }
    }
  });

  it('rests every station camera at least the parallax clearance above each visible ground', () => {
    for (const aspect of ASPECTS) {
      HOME_STATIONS.forEach((station, s) => {
        for (const layer of GROUND_LAYERS) {
          if (!groundLayerVisible(layer.id, s, aspect)) continue;
          expect(station[aspect].position[1]).toBeGreaterThanOrEqual(layer.ground + GROUND_CLEARANCE);
        }
      });
    }
  });

  it('starts the veil from height above ground, never mid-dwell, and is opaque before contact', () => {
    for (const aspect of ASPECTS) {
      for (const layer of GROUND_LAYERS) {
        const tr = GROUND_TRANSITS[aspect][layer.id];
        expect(tr.rise).toBeGreaterThanOrEqual(layer.from + 0.03);
        expect(tr.rise).toBeLessThan(tr.full);
        expect(tr.full).toBeLessThanOrEqual(tr.crossing);
        const above = (s: number) => evaluatePath(HOME_STATIONS, s, aspect).position[1] - layer.ground;
        expect(above(tr.rise)).toBeLessThanOrEqual(VEIL_RISE_HEIGHT + 1e-6);
        expect(above(tr.full)).toBeLessThanOrEqual(Math.max(VEIL_FULL_HEIGHT, above(tr.rise)) + 1e-6);
        expect(transitVeil(tr.full, GROUND_TRANSITS[aspect])).toBe(1);
      }
    }
  });
});

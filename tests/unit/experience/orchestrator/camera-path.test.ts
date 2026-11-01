import { describe, expect, it } from 'vitest';
import {
  HOME_STATIONS,
  aspectClassFor,
  catmullRom,
  evaluatePath,
  lerpVec,
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

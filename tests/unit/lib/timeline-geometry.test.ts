import { describe, expect, it } from 'vitest';
import { ARC, arcLift, arcPath, milestoneXs, sectionProgress } from '@/lib/timeline-geometry';

/** Parses an SVG path made of one M command followed by C commands. */
function parsePath(d: string) {
  const commands = d.match(/[MC][^MC]*/g) ?? [];
  return commands.map((c) => ({
    op: c[0]!,
    nums: c
      .slice(1)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number),
  }));
}

describe('arcLift', () => {
  it('rises from 0 at the left edge to the full amplitude at the right edge', () => {
    expect(arcLift(0)).toBe(0);
    expect(arcLift(1)).toBe(ARC.amplitude);
  });

  it('clamps outside [0, 1]', () => {
    expect(arcLift(-0.5)).toBe(0);
    expect(arcLift(2)).toBe(ARC.amplitude);
  });

  it('is monotonic and stays within [0, amplitude]', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const y = arcLift(t);
      expect(y).toBeGreaterThanOrEqual(prev);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(ARC.amplitude);
      prev = y;
    }
  });

  it('eases out: more than half of the rise happens in the first half', () => {
    expect(arcLift(0.5)).toBeGreaterThan(ARC.amplitude / 2);
    expect(arcLift(0.25) - arcLift(0)).toBeGreaterThan(arcLift(1) - arcLift(0.75));
  });
});

describe('milestoneXs', () => {
  it('places count milestones at equal spacing, centred in their cells', () => {
    const xs = milestoneXs(8);
    expect(xs).toHaveLength(8);
    expect(xs[0]).toBeCloseTo(0.5 / 8, 12);
    expect(xs[7]).toBeCloseTo(1 - 0.5 / 8, 12);
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeCloseTo(1 / 8, 12);
  });

  it('is symmetric around the centre and stays inside (0, 1)', () => {
    const xs = milestoneXs(5);
    xs.forEach((x, i) => {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(1);
      expect(x + xs[xs.length - 1 - i]!).toBeCloseTo(1, 12);
    });
    expect(milestoneXs(1)).toEqual([0.5]);
    expect(milestoneXs(0)).toEqual([]);
  });
});

describe('arcPath', () => {
  it.each([1, 3, 8])('draws one move and count+1 cubic segments for %i milestones', (count) => {
    const d = arcPath(count);
    expect(d.startsWith('M')).toBe(true);
    const commands = parsePath(d);
    expect(commands[0]!.op).toBe('M');
    expect(commands.filter((c) => c.op === 'C')).toHaveLength(count + 1);
    expect(d.match(/C/g)).toHaveLength(count + 1);
  });

  it('runs from the left edge at the baseline to the right edge at full lift', () => {
    const commands = parsePath(arcPath(8));
    expect(commands[0]!.nums).toEqual([0, ARC.baseY]);
    const end = commands[commands.length - 1]!.nums.slice(-2);
    expect(end).toEqual([ARC.width, ARC.baseY - ARC.amplitude]);
  });

  it('passes through every milestone point', () => {
    const count = 6;
    const ends = parsePath(arcPath(count))
      .filter((c) => c.op === 'C')
      .map((c) => c.nums.slice(-2));
    milestoneXs(count).forEach((x, i) => {
      expect(ends[i]![0]).toBe(Number((x * ARC.width).toFixed(1)));
      expect(ends[i]![1]).toBe(Number((ARC.baseY - arcLift(x)).toFixed(1)));
    });
  });

  it('keeps every point and control point finite and inside the viewBox', () => {
    for (const c of parsePath(arcPath(8))) {
      expect(c.nums.length % 2).toBe(0);
      for (let i = 0; i < c.nums.length; i += 2) {
        const [x, y] = [c.nums[i]!, c.nums[i + 1]!];
        expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(ARC.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(ARC.height);
      }
    }
  });

  it('is deterministic', () => {
    expect(arcPath(8)).toBe(arcPath(8));
  });
});

describe('sectionProgress', () => {
  const vh = 1000;
  const height = 800;
  const start = vh * 0.85;
  const end = vh * 0.6 - height;

  it('is 0 before the section enters (top below 85% of the viewport)', () => {
    expect(sectionProgress(start, height, vh)).toBe(0);
    expect(sectionProgress(start + 500, height, vh)).toBe(0);
  });

  it('is 1 once the section end has passed 60% of the viewport', () => {
    expect(sectionProgress(end, height, vh)).toBe(1);
    expect(sectionProgress(end - 2000, height, vh)).toBe(1);
  });

  it('is linear in between', () => {
    expect(sectionProgress((start + end) / 2, height, vh)).toBeCloseTo(0.5, 12);
  });

  it('increases monotonically as the section scrolls up', () => {
    let prev = -Infinity;
    for (let top = 1500; top >= -1500; top -= 25) {
      const p = sectionProgress(top, height, vh);
      expect(p).toBeGreaterThanOrEqual(prev);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      prev = p;
    }
  });
});

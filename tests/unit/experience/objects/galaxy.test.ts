import { describe, expect, it } from 'vitest';
import { buildGalaxyAttributes } from '@/experience/objects/Galaxy';

const COUNT = 6000;
const RADIUS = 7.8;

describe('buildGalaxyAttributes', () => {
  const attrs = buildGalaxyAttributes(COUNT, RADIUS);

  it('allocates xyz position/colour and one scale per point', () => {
    expect(attrs.position).toBeInstanceOf(Float32Array);
    expect(attrs.position).toHaveLength(COUNT * 3);
    expect(attrs.color).toHaveLength(COUNT * 3);
    expect(attrs.scale).toHaveLength(COUNT);
  });

  it('is deterministic for the default seed and for an explicit seed', () => {
    const again = buildGalaxyAttributes(COUNT, RADIUS);
    expect(Array.from(again.position)).toEqual(Array.from(attrs.position));
    expect(Array.from(again.color)).toEqual(Array.from(attrs.color));
    expect(Array.from(again.scale)).toEqual(Array.from(attrs.scale));
    expect(Array.from(buildGalaxyAttributes(500, RADIUS, 5).position)).toEqual(
      Array.from(attrs.position.slice(0, 1500)),
    );
  });

  it('changes with the seed', () => {
    expect(Array.from(buildGalaxyAttributes(500, RADIUS, 6).position)).not.toEqual(
      Array.from(buildGalaxyAttributes(500, RADIUS, 5).position),
    );
  });

  it('contains only finite values', () => {
    for (const arr of [attrs.position, attrs.color, attrs.scale]) {
      for (const v of arr) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('keeps points inside the disc radius, allowing only the small edge scatter', () => {
    let outside = 0;
    for (let i = 0; i < COUNT; i++) {
      const x = attrs.position[i * 3]!;
      const y = attrs.position[i * 3 + 1]!;
      const z = attrs.position[i * 3 + 2]!;
      const r = Math.hypot(x, z);
      // Edge scatter is ≤ 0.048 per axis-sigma; Box–Muller is capped at ~5.3 sigma per axis.
      expect(r).toBeLessThanOrEqual(RADIUS + 0.4);
      expect(Math.abs(y)).toBeLessThanOrEqual(2.6);
      if (r > RADIUS) outside++;
    }
    expect(outside / COUNT).toBeLessThan(0.01);
  });

  it('is a thin disc that thickens toward the bulge', () => {
    let innerSum = 0;
    let innerN = 0;
    let outerSum = 0;
    let outerN = 0;
    for (let i = 0; i < COUNT; i++) {
      const r = Math.hypot(attrs.position[i * 3]!, attrs.position[i * 3 + 2]!);
      const ay = Math.abs(attrs.position[i * 3 + 1]!);
      if (r < 1) {
        innerSum += ay;
        innerN++;
      } else if (r > RADIUS * 0.6) {
        outerSum += ay;
        outerN++;
      }
    }
    expect(innerN).toBeGreaterThan(0);
    expect(outerN).toBeGreaterThan(0);
    expect(innerSum / innerN).toBeGreaterThan(outerSum / outerN);
  });

  it('uses non-negative colours and the documented star scales (a few bright stars)', () => {
    for (const c of attrs.color) expect(c).toBeGreaterThanOrEqual(0);
    const eps = 1e-6; // float32 rounding
    let bright = 0;
    for (const s of attrs.scale) {
      const isRegular = s >= 0.55 - eps && s <= 1.45 + eps;
      const isBright = s >= 2.4 - eps && s <= 3.8 + eps;
      expect(isRegular || isBright).toBe(true);
      if (isBright) bright++;
    }
    expect(bright / COUNT).toBeGreaterThan(0.01);
    expect(bright / COUNT).toBeLessThan(0.06);
  });

  it('spreads points further out for a larger radius', () => {
    const meanR = (a: ReturnType<typeof buildGalaxyAttributes>, n: number) => {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += Math.hypot(a.position[i * 3]!, a.position[i * 3 + 2]!);
      return sum / n;
    };
    expect(meanR(attrs, COUNT)).toBeGreaterThan(2 * meanR(buildGalaxyAttributes(COUNT, 2), COUNT));
  });

  it('handles an empty galaxy', () => {
    const empty = buildGalaxyAttributes(0, RADIUS);
    expect(empty.position).toHaveLength(0);
    expect(empty.scale).toHaveLength(0);
  });
});

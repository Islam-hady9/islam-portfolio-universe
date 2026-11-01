import { describe, expect, it } from 'vitest';
import { fbm2, mulberry32, ridged2, valueNoise2 } from '@/experience/math/noise';

const take = (rand: () => number, n: number) => Array.from({ length: n }, () => rand());

/** A deterministic grid of sample coordinates, including negatives and non-integers. */
const samples: [number, number][] = [];
for (let x = -7.3; x <= 7.3; x += 0.61) for (let y = -5.2; y <= 5.2; y += 0.83) samples.push([x, y]);

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(mulberry32(42), 50)).toEqual(take(mulberry32(42), 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(mulberry32(1), 10)).not.toEqual(take(mulberry32(2), 10));
  });

  it('stays in [0, 1) and is reasonably uniform', () => {
    const values = take(mulberry32(7), 10000);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('treats seeds as unsigned 32-bit integers', () => {
    expect(take(mulberry32(-1), 5)).toEqual(take(mulberry32(0xffffffff), 5));
  });
});

describe.each([
  ['valueNoise2', (x: number, y: number, seed: number) => valueNoise2(x, y, seed)],
  ['fbm2', (x: number, y: number, seed: number) => fbm2(x, y, seed)],
  ['ridged2', (x: number, y: number, seed: number) => ridged2(x, y, seed)],
])('%s', (_name, noise) => {
  it('is deterministic for a given seed', () => {
    for (const [x, y] of samples) expect(noise(x, y, 11)).toBe(noise(x, y, 11));
  });

  it('stays within [0, 1]', () => {
    for (const [x, y] of samples) {
      const v = noise(x, y, 3);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('changes with the seed', () => {
    const a = samples.map(([x, y]) => noise(x, y, 1));
    const b = samples.map(([x, y]) => noise(x, y, 2));
    expect(a).not.toEqual(b);
  });

  it('is not constant', () => {
    const values = samples.map(([x, y]) => noise(x, y, 5));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.1);
  });
});

describe('valueNoise2 continuity', () => {
  it('varies smoothly across lattice cell boundaries', () => {
    for (const x of [-2, -1, 0, 1, 2, 3]) {
      for (const y of [-1.5, 0.25, 2.75]) {
        expect(Math.abs(valueNoise2(x - 1e-9, y, 9) - valueNoise2(x + 1e-9, y, 9))).toBeLessThan(1e-6);
      }
    }
  });

  it('uses the default seed 0 when omitted', () => {
    expect(valueNoise2(1.3, 2.7)).toBe(valueNoise2(1.3, 2.7, 0));
    expect(fbm2(1.3, 2.7)).toBe(fbm2(1.3, 2.7, 0, 5));
    expect(ridged2(1.3, 2.7)).toBe(ridged2(1.3, 2.7, 0, 5));
  });
});

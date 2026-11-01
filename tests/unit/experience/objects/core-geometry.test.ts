import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { buildChannelRing, buildPlates, buildShard } from '@/experience/objects/core/geometry';

const arr = (g: BufferGeometry, name: string) => Array.from(g.attributes[name]!.array);
const allFinite = (xs: ArrayLike<number>) => Array.from(xs).every(Number.isFinite);

describe('buildChannelRing', () => {
  // radius, width, height, lip, floor, segments
  const R = 2.4;
  const W = 0.3;
  const H = 0.2;
  const LIP = 0.05;
  const FLOOR = 0.04;
  const SEGMENTS = 24;
  const ring = buildChannelRing(R, W, H, LIP, FLOOR, SEGMENTS);

  it('is deterministic', () => {
    const again = buildChannelRing(R, W, H, LIP, FLOOR, SEGMENTS);
    expect(arr(again, 'position')).toEqual(arr(ring, 'position'));
    expect(arr(again, 'normal')).toEqual(arr(ring, 'normal'));
    expect(Array.from(again.index!.array)).toEqual(Array.from(ring.index!.array));
  });

  it('lathes the 8 faces of the U-channel profile into one indexed mesh', () => {
    const verticesPerFace = 2 * (SEGMENTS + 1);
    expect(ring.attributes.position!.count).toBe(8 * verticesPerFace);
    expect(ring.index!.count).toBe(8 * SEGMENTS * 6);
    const maxIndex = Math.max(...Array.from(ring.index!.array));
    expect(maxIndex).toBe(ring.attributes.position!.count - 1);
  });

  it('has a finite, non-zero normal for every vertex', () => {
    const n = ring.attributes.normal!;
    expect(n.count).toBe(ring.attributes.position!.count);
    expect(allFinite(n.array)).toBe(true);
    expect(allFinite(ring.attributes.position!.array)).toBe(true);
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeGreaterThan(0);
  });

  it('stays within the ring envelope (inner/outer radius, half height)', () => {
    const p = ring.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      expect(r).toBeGreaterThanOrEqual(R - W / 2 - 1e-6);
      expect(r).toBeLessThanOrEqual(R + W / 2 + 1e-6);
      expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(H / 2 + 1e-6);
    }
  });

  it('points every face normal outward from the solid', () => {
    // Profile in (radius, height), counter-clockwise; outward normal of edge (dx, dy) is (dy, -dx).
    const r0 = R - W / 2;
    const r1 = R + W / 2;
    const h0 = -H / 2;
    const h1 = H / 2;
    const profile = [
      [r0, h0],
      [r1, h0],
      [r1, h1],
      [r1 - LIP, h1],
      [r1 - LIP, h0 + FLOOR],
      [r0 + LIP, h0 + FLOOR],
      [r0 + LIP, h1],
      [r0, h1],
      [r0, h0],
    ] as const;
    const p = ring.attributes.position!;
    const n = ring.attributes.normal!;
    const perFace = 2 * (SEGMENTS + 1);
    const sign = (v: number) => (Math.abs(v) < 1e-6 ? 0 : Math.sign(v));
    for (let face = 0; face < 8; face++) {
      const dx = profile[face + 1]![0] - profile[face]![0];
      const dy = profile[face + 1]![1] - profile[face]![1];
      for (let v = face * perFace; v < (face + 1) * perFace; v++) {
        const radial = Math.hypot(p.getX(v), p.getZ(v));
        const nRadial = (n.getX(v) * p.getX(v) + n.getZ(v) * p.getZ(v)) / radial;
        expect(sign(nRadial), `face ${face} radial`).toBe(sign(dy));
        expect(sign(n.getY(v)), `face ${face} vertical`).toBe(sign(-dx));
      }
    }
  });
});

describe('buildShard', () => {
  it('is deterministic per seed', () => {
    expect(arr(buildShard(3), 'position')).toEqual(arr(buildShard(3), 'position'));
    expect(arr(buildShard(3), 'normal')).toEqual(arr(buildShard(3), 'normal'));
  });

  it('differs between seeds', () => {
    expect(arr(buildShard(3), 'position')).not.toEqual(arr(buildShard(9), 'position'));
  });

  it('is a 20-face low-poly solid with finite positions and unit normals', () => {
    const g = buildShard(7);
    expect(g.attributes.position!.count).toBe(60);
    expect(allFinite(g.attributes.position!.array)).toBe(true);
    const n = g.attributes.normal!;
    expect(n.count).toBe(60);
    for (let i = 0; i < n.count; i++) expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
  });

  it('scales the unit icosahedron irregularly (radial 0.6–1.35, y squashed 0.5–1.1)', () => {
    const p = buildShard(7).attributes.position!;
    const lengths: number[] = [];
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (let i = 0; i < p.count; i++) {
      const len = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
      expect(len).toBeGreaterThanOrEqual(0.6 * 0.5 - 1e-6);
      expect(len).toBeLessThanOrEqual(1.35 * 1.1 + 1e-6);
      lengths.push(len);
      sumX += Math.abs(p.getX(i));
      sumY += Math.abs(p.getY(i));
      sumZ += Math.abs(p.getZ(i));
    }
    // irregular: not a uniformly scaled icosahedron
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeGreaterThan(0.2);
    // the base icosahedron is axis-symmetric, so the extra y factor (mean 0.8) flattens it on average
    expect(sumY).toBeLessThan(sumX);
    expect(sumY).toBeLessThan(sumZ);
  });

  it('keeps shared icosahedron corners welded so the shard is a closed solid', () => {
    const g = buildShard(7);
    const pos = g.attributes.position!;
    expect(pos.count).toBe(60); // 20 faces × 3 (faceted)
    const unique = new Set<string>();
    for (let i = 0; i < pos.count; i++) {
      unique.add([pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(5)).join(','));
    }
    // An icosahedron has 12 corners: every face corner must coincide with its neighbours'.
    expect(unique.size).toBe(12);
  });
});

describe('buildPlates', () => {
  const RADIUS = 1.04;
  const BANDS = 8;
  const plates = buildPlates(RADIUS, BANDS, 7);

  it('is deterministic per seed and differs between seeds', () => {
    expect(buildPlates(RADIUS, BANDS, 7)).toEqual(plates);
    expect(buildPlates(RADIUS, BANDS, 8)).not.toEqual(plates);
  });

  it('never exceeds the per-band plate budget, but leaves some gaps', () => {
    let budget = 0;
    for (let b = 0; b < BANDS; b++) {
      const lat = -Math.PI / 2 + ((b + 0.5) / BANDS) * Math.PI;
      budget += Math.max(4, Math.round(15 * Math.cos(lat)));
    }
    expect(plates.length).toBeGreaterThan(budget * 0.5);
    expect(plates.length).toBeLessThan(budget);
  });

  it('places every plate on (or just above) the sphere along its unit normal', () => {
    for (const plate of plates) {
      const [nx, ny, nz] = plate.normal;
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 9);
      const r = Math.hypot(...plate.position);
      expect(r).toBeGreaterThanOrEqual(RADIUS - 1e-9);
      expect(r).toBeLessThanOrEqual(RADIUS + 0.26 + 1e-9);
      plate.position.forEach((c, k) => expect(c / r).toBeCloseTo(plate.normal[k]!, 9));
    }
  });

  it('gives every plate a positive, finite size and a bounded twist and shade', () => {
    for (const plate of plates) {
      for (const s of plate.size) {
        expect(Number.isFinite(s)).toBe(true);
        expect(s).toBeGreaterThan(0);
      }
      expect(Math.abs(plate.twist)).toBeLessThanOrEqual(0.3);
      expect(plate.shade).toBeGreaterThanOrEqual(0);
      expect(plate.shade).toBeLessThan(1);
    }
  });

  it('lifts a minority of plates noticeably off the surface', () => {
    const lifted = plates.filter((p) => Math.hypot(...p.position) - RADIUS > 0.05);
    expect(lifted.length).toBeGreaterThan(0);
    expect(lifted.length).toBeLessThan(plates.length / 2);
  });
});

import { describe, expect, it } from 'vitest';
import { Box3, type BufferGeometry } from 'three';
import {
  PORTAL_CLAMP_EVERY,
  PORTAL_PROFILE,
  PORTAL_SEGMENTS,
  buildPortalClampGeometry,
  buildPortalSectorGeometry,
  buildPrecisionRingGeometry,
  portalMarkings,
} from '@/experience/objects/RingPortal';
import { buildExplorerGeometry } from '@/experience/objects/Explorer';
import { buildTerrainGeometry } from '@/experience/objects/Terrain';

const R = 3.6;

function radialRange(g: BufferGeometry) {
  const p = g.attributes.position!;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i));
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  return { min, max };
}

function finite(g: BufferGeometry) {
  return Array.from(g.attributes.position!.array).every(Number.isFinite);
}

describe('ring portal geometry (V3)', () => {
  it('keeps every housing segment outside the energy surface and inside its rear plate', () => {
    const g = buildPortalSectorGeometry(R);
    expect(finite(g)).toBe(true);
    const { min, max } = radialRange(g);
    // Bevels grow the shape slightly (bevelSize), never into the energy surface.
    expect(min).toBeGreaterThan(R + PORTAL_PROFILE.innerBand[0] - 0.05);
    expect(max).toBeLessThan(R + PORTAL_PROFILE.rearPlate[1] + 0.05);
  });

  it('spans exactly one segment angle so 24 instances tile the ring with a small joint gap', () => {
    const g = buildPortalSectorGeometry(R);
    const p = g.attributes.position!;
    let maxAngle = 0;
    for (let i = 0; i < p.count; i++)
      maxAngle = Math.max(maxAngle, Math.abs(Math.atan2(p.getY(i), p.getX(i))));
    const half = Math.PI / PORTAL_SEGMENTS;
    expect(maxAngle).toBeLessThan(half + 0.01);
    expect(maxAngle).toBeGreaterThan(half - 0.03);
    expect(PORTAL_SEGMENTS % PORTAL_CLAMP_EVERY).toBe(0);
  });

  it('is beveled: front faces are not all coplanar with the extrusion caps', () => {
    const g = buildPortalSectorGeometry(R);
    const n = g.attributes.normal!;
    let oblique = 0;
    for (let i = 0; i < n.count; i++) if (Math.abs(n.getZ(i)) > 0.2 && Math.abs(n.getZ(i)) < 0.95) oblique++;
    expect(oblique).toBeGreaterThan(0);
  });

  it('places clamps beyond the outer band', () => {
    const { min, max } = radialRange(buildPortalClampGeometry(R));
    expect(min).toBeGreaterThan(R + PORTAL_PROFILE.outerBand[0]);
    expect(max).toBeLessThan(R + PORTAL_PROFILE.clamp[1] + 0.05);
  });

  it('builds the precision ring at the edge of the energy surface', () => {
    const g = buildPrecisionRingGeometry(R);
    expect(finite(g)).toBe(true);
    const { min, max } = radialRange(g);
    expect(min).toBeGreaterThan(R - 0.1);
    expect(max).toBeLessThan(R + PORTAL_PROFILE.innerBand[0]);
  });

  it('lays out five markings per segment on the bands, three of them on the outer band', () => {
    const marks = portalMarkings(R);
    expect(marks).toHaveLength(PORTAL_SEGMENTS * 5);
    expect(marks.filter((m) => m.kind === 1)).toHaveLength(PORTAL_SEGMENTS);
    expect(marks.filter((m) => m.kind === 2)).toHaveLength(PORTAL_SEGMENTS * 2);
    for (const m of marks) {
      const band = m.kind === 2 ? PORTAL_PROFILE.innerBand : PORTAL_PROFILE.outerBand;
      expect(m.r - m.len / 2).toBeGreaterThanOrEqual(R + band[0] - 1e-9);
      expect(m.r + m.len / 2).toBeLessThanOrEqual(R + band[1] + 1e-9);
    }
  });
});

describe('explorer silhouette (V3)', () => {
  const g = buildExplorerGeometry();
  const box = new Box3().setFromBufferAttribute(g.attributes.position as never);

  it('stands on the origin at human scale (~1.8 units, feet at y = 0)', () => {
    expect(box.min.y).toBeGreaterThan(-0.01);
    expect(box.min.y).toBeLessThan(0.02);
    expect(box.max.y).toBeGreaterThan(1.75);
    expect(box.max.y).toBeLessThan(1.85);
  });

  it('keeps adult proportions: shoulders about a quarter of the height, a slim depth', () => {
    const width = box.max.x - box.min.x;
    const depth = box.max.z - box.min.z;
    expect(width / 1.8).toBeGreaterThan(0.2);
    expect(width / 1.8).toBeLessThan(0.34);
    expect(depth).toBeLessThan(width);
  });

  it('exposes only positions and normals, with finite unit normals', () => {
    expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position']);
    const n = g.attributes.normal!;
    for (let i = 0; i < n.count; i += 7)
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 3);
    expect(finite(g)).toBe(true);
  });
});

describe('terrain tone variation (V3)', () => {
  it('adds a deterministic per-vertex colour within a narrow band', () => {
    const shape = { width: 40, depth: 20, segments: 40, seed: 4, farHeight: 6, nearHeight: 1, scale: 0.2 };
    const a = buildTerrainGeometry(shape).attributes.color!;
    const b = buildTerrainGeometry({ ...shape }).attributes.color!;
    expect(Array.from(a.array)).toEqual(Array.from(b.array));
    for (const v of Array.from(a.array)) {
      expect(v).toBeGreaterThan(0.8);
      expect(v).toBeLessThan(1.3);
    }
  });
});

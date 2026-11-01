import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { buildTerrainGeometry, type TerrainShape } from '@/experience/objects/Terrain';

const base: TerrainShape = {
  width: 40,
  depth: 20,
  segments: 40,
  seed: 4,
  farHeight: 6,
  nearHeight: 1,
  scale: 0.2,
};

const positions = (g: BufferGeometry) => Array.from(g.attributes.position!.array);
const normals = (g: BufferGeometry) => Array.from(g.attributes.normal!.array);

/** Heights (y) of all vertices, with their x/z. */
function vertices(g: BufferGeometry) {
  const p = g.attributes.position!;
  return Array.from({ length: p.count }, (_, i) => ({ x: p.getX(i), y: p.getY(i), z: p.getZ(i) }));
}

describe('buildTerrainGeometry', () => {
  it('is deterministic: the same shape builds identical positions and normals', () => {
    const a = buildTerrainGeometry(base);
    const b = buildTerrainGeometry({ ...base });
    expect(positions(a)).toEqual(positions(b));
    expect(normals(a)).toEqual(normals(b));
  });

  it('changes with the seed', () => {
    expect(positions(buildTerrainGeometry({ ...base, seed: 5 }))).not.toEqual(
      positions(buildTerrainGeometry(base)),
    );
  });

  it('builds a grid whose depth segments follow the aspect ratio', () => {
    const g = buildTerrainGeometry(base);
    const depthSegments = Math.round(base.segments * (base.depth / base.width));
    expect(g.attributes.position!.count).toBe((base.segments + 1) * (depthSegments + 1));
    expect(g.index!.count).toBe(base.segments * depthSegments * 6);
  });

  it('lies flat in the XZ plane, spanning width × depth', () => {
    const vs = vertices(buildTerrainGeometry(base));
    const xs = vs.map((v) => v.x);
    const zs = vs.map((v) => v.z);
    expect(Math.min(...xs)).toBeCloseTo(-base.width / 2, 9);
    expect(Math.max(...xs)).toBeCloseTo(base.width / 2, 9);
    expect(Math.min(...zs)).toBeCloseTo(-base.depth / 2, 9);
    expect(Math.max(...zs)).toBeCloseTo(base.depth / 2, 9);
  });

  it('contains only finite positions and unit, upward-facing normals', () => {
    const g = buildTerrainGeometry(base);
    for (const v of positions(g)) expect(Number.isFinite(v)).toBe(true);
    const n = g.attributes.normal!;
    expect(n.count).toBe(g.attributes.position!.count);
    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
      expect(n.getY(i)).toBeGreaterThan(0);
    }
  });

  it('keeps heights within the amplitude envelope and raises the far edge above the near edge', () => {
    const vs = vertices(buildTerrainGeometry(base));
    for (const v of vs) {
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1.2 * base.farHeight);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const far = mean(vs.filter((v) => v.z < -base.depth / 2 + 2).map((v) => v.y));
    const near = mean(vs.filter((v) => v.z > base.depth / 2 - 2).map((v) => v.y));
    expect(far).toBeGreaterThan(near);
  });

  it('flattens the plateau to its exact height at the centre', () => {
    const shape: TerrainShape = { ...base, plateau: { x: 0, z: 0, radius: 4, height: 0.5 } };
    const centre = vertices(buildTerrainGeometry(shape)).find(
      (v) => Math.abs(v.x) < 1e-9 && Math.abs(v.z) < 1e-9,
    );
    expect(centre).toBeDefined();
    expect(centre!.y).toBeCloseTo(0.5, 12);
  });

  it('carves the valley below the unvalleyed terrain', () => {
    const plain = vertices(buildTerrainGeometry(base));
    const carved = vertices(buildTerrainGeometry({ ...base, valley: { x: 0, width: 3, depth: 2 } }));
    carved.forEach((v, i) => expect(v.y).toBeLessThanOrEqual(plain[i]!.y + 1e-12));
    const onAxis = carved.findIndex((v) => Math.abs(v.x) < 1e-9);
    expect(plain[onAxis]!.y - carved[onAxis]!.y).toBeGreaterThan(0.5);
  });
});

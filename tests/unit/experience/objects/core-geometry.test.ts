import { describe, expect, it } from 'vitest';
import { Vector3, type BufferGeometry } from 'three';
import {
  buildRingSolid,
  buildShard,
  buildShellPanels,
  profileArea,
  ringProfile,
  type ProfilePoint,
  type RingSolidSpec,
} from '@/experience/objects/core/geometry';

const arr = (g: BufferGeometry, name: string) => Array.from(g.attributes[name]!.array);
const allFinite = (xs: ArrayLike<number>) => Array.from(xs).every(Number.isFinite);

/** Ray-casting point-in-polygon in the (radius, height) plane. */
function insidePolygon(r: number, h: number, poly: ProfilePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ri, hi] = poly[i]!;
    const [rj, hj] = poly[j]!;
    if (hi > h !== hj > h && r < ((rj - ri) * (h - hi)) / (hj - hi) + ri) inside = !inside;
  }
  return inside;
}

/** Visits triangles (indexed or not) with their vertex indices. */
function eachTriangle(g: BufferGeometry, fn: (a: number, b: number, c: number) => void) {
  const idx = g.index;
  const n = idx ? idx.count : g.attributes.position!.count;
  for (let t = 0; t < n; t += 3) {
    if (idx) fn(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
    else fn(t, t + 1, t + 2);
  }
}

const RING: RingSolidSpec = {
  radius: 2.4,
  width: 0.3,
  height: 0.2,
  chamfer: 0.03,
  channel: { lip: 0.07, floor: 0.06 },
  segments: 96,
};

describe('ringProfile', () => {
  it('is a closed counter-clockwise polygon with three brushed channel edges', () => {
    const { points, brushed } = ringProfile(RING);
    expect(points).toHaveLength(12);
    expect(profileArea(points)).toBeGreaterThan(0);
    expect(brushed.filter(Boolean)).toHaveLength(3);
  });

  it('drops zero-length edges when there is no chamfer', () => {
    const { points } = ringProfile({ ...RING, chamfer: 0 });
    expect(points).toHaveLength(8);
    const solid = ringProfile({ radius: 2, width: 0.1, height: 0.1, chamfer: 0 });
    expect(solid.points).toHaveLength(4);
    expect(solid.brushed.every((b) => !b)).toBe(true);
  });

  it('rejects impossible chamfers and channels', () => {
    expect(() => ringProfile({ ...RING, chamfer: 0.2 })).toThrow();
    expect(() => ringProfile({ ...RING, channel: { lip: 0.02, floor: 0.06 } })).toThrow(); // lip ≤ chamfer
    expect(() => ringProfile({ ...RING, channel: { lip: 0.2, floor: 0.06 } })).toThrow(); // lips overlap
  });
});

describe('buildRingSolid', () => {
  const continuous = buildRingSolid(RING);
  const seamed = buildRingSolid({ ...RING, seams: 6, seamGap: 0.05 });

  it('is deterministic', () => {
    const again = buildRingSolid({ ...RING, seams: 6, seamGap: 0.05 });
    expect(arr(again, 'position')).toEqual(arr(seamed, 'position'));
    expect(arr(again, 'normal')).toEqual(arr(seamed, 'normal'));
  });

  it('exposes a chrome group and a brushed channel group (solid rings have only chrome)', () => {
    expect(continuous.groups.map((g) => g.materialIndex)).toEqual([0, 1]);
    const solid = buildRingSolid({ radius: 3, width: 0.05, height: 0.05, chamfer: 0.012, segments: 64 });
    expect(solid.groups.map((g) => g.materialIndex)).toEqual([0]);
  });

  it('has finite, unit-length normals and stays inside the profile envelope', () => {
    for (const g of [continuous, seamed]) {
      expect(allFinite(g.attributes.position!.array)).toBe(true);
      const n = g.attributes.normal!;
      const p = g.attributes.position!;
      for (let i = 0; i < n.count; i++) {
        expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 4);
        const r = Math.hypot(p.getX(i), p.getZ(i));
        expect(r).toBeGreaterThanOrEqual(RING.radius - RING.width / 2 - 1e-6);
        expect(r).toBeLessThanOrEqual(RING.radius + RING.width / 2 + 1e-6);
        expect(Math.abs(p.getY(i))).toBeLessThanOrEqual(RING.height / 2 + 1e-6);
      }
    }
  });

  it('closes every seam with end caps (more geometry than the continuous ring)', () => {
    expect(seamed.attributes.position!.count).toBeGreaterThan(continuous.attributes.position!.count);
  });

  it('points every face out of the solid, including the seam caps', () => {
    const { points } = ringProfile(RING);
    const gap = 0.05;
    const step = (Math.PI * 2) / 6;
    const insideSolid = (v: Vector3) => {
      const r = Math.hypot(v.x, v.z);
      if (!insidePolygon(r, v.y, points)) return false;
      const phi = (Math.atan2(v.x, v.z) + Math.PI * 2) % (Math.PI * 2); // lathe: x = r sin φ, z = r cos φ
      const local = phi % step;
      return local > gap / 2 && local < step - gap / 2;
    };
    const p = seamed.attributes.position!;
    const n = seamed.attributes.normal!;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    const nn = new Vector3();
    const eps = 0.01;
    let checked = 0;
    eachTriangle(seamed, (i0, i1, i2) => {
      a.fromBufferAttribute(p, i0);
      b.fromBufferAttribute(p, i1);
      c.fromBufferAttribute(p, i2);
      const area = b.clone().sub(a).cross(c.clone().sub(a));
      if (area.length() < 1e-9) return; // degenerate lathe triangles at nothing — skip
      nn.fromBufferAttribute(n, i0)
        .add(new Vector3().fromBufferAttribute(n, i1))
        .add(new Vector3().fromBufferAttribute(n, i2));
      expect(area.dot(nn), 'winding agrees with normals').toBeGreaterThan(0);
      const centroid = a.clone().add(b).add(c).divideScalar(3);
      const dir = nn.normalize();
      expect(insideSolid(centroid.clone().addScaledVector(dir, eps)), 'outside along +n').toBe(false);
      expect(insideSolid(centroid.clone().addScaledVector(dir, -eps)), 'inside along −n').toBe(true);
      checked++;
    });
    expect(checked).toBeGreaterThan(1000);
  });

  it('adds radial pivot bosses beyond the outer wall', () => {
    const plain = buildRingSolid(RING);
    const pivoted = buildRingSolid({ ...RING, pivots: { count: 2, radius: 0.06, length: 0.15 } });
    const maxR = (g: BufferGeometry) => {
      const p = g.attributes.position!;
      let m = 0;
      for (let i = 0; i < p.count; i++) m = Math.max(m, Math.hypot(p.getX(i), p.getZ(i)));
      return m;
    };
    expect(maxR(pivoted)).toBeGreaterThan(maxR(plain) + 0.08);
  });

  it('builds a single closed arc for carriages', () => {
    const collar = buildRingSolid({
      radius: 2.4,
      width: 0.36,
      height: 0.26,
      chamfer: 0.02,
      segments: 64,
      arc: { start: -0.05, length: 0.1 },
    });
    const p = collar.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(Math.atan2(p.getX(i), p.getZ(i)))).toBeLessThanOrEqual(0.05 + 1e-6);
    }
  });
});

describe('buildShard', () => {
  it('is deterministic per seed and varies across seeds', () => {
    expect(arr(buildShard(3), 'position')).toEqual(arr(buildShard(3), 'position'));
    expect(arr(buildShard(3), 'position')).not.toEqual(arr(buildShard(9), 'position'));
  });

  it('is a closed, faceted solid with finite normals', () => {
    const g = buildShard(7);
    expect(g.index).toBeNull();
    expect(g.attributes.position!.count % 3).toBe(0);
    expect(allFinite(g.attributes.normal!.array)).toBe(true);
  });
});

describe('buildShellPanels', () => {
  const spec = {
    radius: 1,
    thickness: 0.06,
    bands: 8,
    keep: 0.8,
    gap: 0.05,
    liftShare: 0.15,
    lift: 0.16,
    copperShare: 0.1,
    subdiv: 2,
    polar: 0.16,
    seed: 7,
  };
  const { geometry, panels } = buildShellPanels(spec);

  it('is deterministic and fractured (some panels missing)', () => {
    const again = buildShellPanels(spec);
    expect(again.panels).toBe(panels);
    expect(arr(again.geometry, 'position')).toEqual(arr(geometry, 'position'));
    const full = buildShellPanels({ ...spec, keep: 1 });
    expect(panels).toBeGreaterThan(full.panels * 0.6);
    expect(panels).toBeLessThan(full.panels);
  });

  it('keeps every vertex within the shell thickness plus the lift', () => {
    const p = geometry.attributes.position!;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i), p.getZ(i));
      expect(r).toBeGreaterThanOrEqual(spec.radius - spec.thickness - 1e-6);
      expect(r).toBeLessThanOrEqual(spec.radius + spec.lift + 1e-6);
    }
  });

  it('winds every triangle consistently with its normals', () => {
    const p = geometry.attributes.position!;
    const n = geometry.attributes.normal!;
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    eachTriangle(geometry, (i0, i1, i2) => {
      a.fromBufferAttribute(p, i0);
      b.fromBufferAttribute(p, i1);
      c.fromBufferAttribute(p, i2);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      const nn = new Vector3().fromBufferAttribute(n, i0);
      expect(face.dot(nn)).toBeGreaterThanOrEqual(0);
    });
  });

  it('carries animation attributes: unit panel centres, phases and copper flags on edge walls only', () => {
    const centre = geometry.attributes.aCenter!;
    const glow = geometry.attributes.aGlow!;
    const n = geometry.attributes.normal!;
    const p = geometry.attributes.position!;
    let copper = 0;
    for (let i = 0; i < centre.count; i++) {
      expect(Math.hypot(centre.getX(i), centre.getY(i), centre.getZ(i))).toBeCloseTo(1, 5);
      const g = glow.getX(i);
      expect([0, 1]).toContain(g);
      if (g === 1) {
        copper++;
        const radial = new Vector3().fromBufferAttribute(p, i).normalize();
        expect(Math.abs(radial.dot(new Vector3().fromBufferAttribute(n, i)))).toBeLessThan(0.9);
      }
    }
    expect(copper).toBeGreaterThan(0);
    expect(geometry.attributes.aPhase!.count).toBe(p.count);
  });
});

import { BufferGeometry, IcosahedronGeometry, LatheGeometry, Vector2 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../math/noise';

/**
 * Gimbal ring with a U-channel cross-section. The closed profile is traversed counter-
 * clockwise in (radius, height) space and each flat face is lathed separately, so edges stay
 * crisp (no averaged normals across corners) and normals face outward from the solid.
 */
export function buildChannelRing(
  radius: number,
  width: number,
  height: number,
  lip: number,
  floor: number,
  segments: number,
): BufferGeometry {
  const r0 = radius - width / 2;
  const r1 = radius + width / 2;
  const h0 = -height / 2;
  const h1 = height / 2;
  const pts: [number, number][] = [
    [r0, h0],
    [r1, h0],
    [r1, h1],
    [r1 - lip, h1],
    [r1 - lip, h0 + floor],
    [r0 + lip, h0 + floor],
    [r0 + lip, h1],
    [r0, h1],
    [r0, h0],
  ];
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    parts.push(new LatheGeometry([new Vector2(a[0], a[1]), new Vector2(b[0], b[1])], segments));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error('ring merge failed');
  return merged;
}

/**
 * Irregular low-poly shard for orbiting debris. Deterministic. Corners are welded before
 * displacement so the solid stays closed, then un-welded for faceted (flat) normals.
 */
export function buildShard(seed: number): BufferGeometry {
  const base = new IcosahedronGeometry(1, 0);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const welded = mergeVertices(base, 1e-4);
  base.dispose();
  const rand = mulberry32(seed);
  const pos = welded.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const k = 0.6 + rand() * 0.75;
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * (0.5 + rand() * 0.6) * k, pos.getZ(i) * k);
  }
  const faceted = welded.toNonIndexed();
  welded.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

export interface PlateSpec {
  position: [number, number, number];
  normal: [number, number, number];
  size: [number, number, number];
  twist: number;
  shade: number;
}

/** Fractured armour plates tiling a sphere, with gaps and a few plates lifted outward. */
export function buildPlates(radius: number, bands: number, seed: number): PlateSpec[] {
  const rand = mulberry32(seed);
  const plates: PlateSpec[] = [];
  for (let b = 0; b < bands; b++) {
    const lat = -Math.PI / 2 + ((b + 0.5) / bands) * Math.PI;
    const cos = Math.cos(lat);
    const count = Math.max(4, Math.round(15 * cos));
    for (let k = 0; k < count; k++) {
      if (rand() < 0.26) continue;
      const jitter = (rand() - 0.5) * 0.25;
      const lon = ((k + (b % 2) * 0.5 + jitter) / count) * Math.PI * 2;
      const latJ = lat + (rand() - 0.5) * 0.06;
      const c2 = Math.cos(latJ);
      const n: [number, number, number] = [c2 * Math.cos(lon), Math.sin(latJ), c2 * Math.sin(lon)];
      const lift = rand() < 0.18 ? 0.06 + rand() * 0.2 : rand() * 0.02;
      const r = radius + lift;
      plates.push({
        position: [n[0] * r, n[1] * r, n[2] * r],
        normal: n,
        size: [
          ((Math.PI * 2 * radius * cos) / count) * (0.66 + rand() * 0.16),
          ((Math.PI * radius) / bands) * (0.7 + rand() * 0.12),
          0.08 + rand() * 0.06,
        ],
        twist: (rand() - 0.5) * (lift > 0.05 ? 0.6 : 0.1),
        shade: rand(),
      });
    }
  }
  return plates;
}

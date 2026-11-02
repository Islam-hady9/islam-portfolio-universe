import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  ShapeUtils,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../math/noise';

/** (radius, height) pair in the lathe plane. */
export type ProfilePoint = [number, number];

export interface RingProfileSpec {
  radius: number;
  width: number;
  height: number;
  /** 45° chamfer on the four outer corners — the edges that catch crisp highlights. */
  chamfer: number;
  /** U-channel cut into the top face; omit for a solid band. */
  channel?: { lip: number; floor: number };
}

export interface RingProfile {
  /** Closed counter-clockwise polygon (first point is not repeated). */
  points: ProfilePoint[];
  /** Per edge i (points[i] → points[i+1]): true for the brushed channel interior. */
  brushed: boolean[];
}

/**
 * Machined ring cross-section: chamfered outer corners and an optional U-channel. Counter-
 * clockwise in (radius, height), so the outward normal of edge (dx, dy) is (dy, −dx).
 */
export function ringProfile(spec: RingProfileSpec): RingProfile {
  const { radius, width, height, chamfer: c, channel } = spec;
  const r0 = radius - width / 2;
  const r1 = radius + width / 2;
  const h0 = -height / 2;
  const h1 = height / 2;
  if (c < 0 || c * 2 >= Math.min(width, height)) throw new Error('chamfer too large for the profile');
  const out: { p: ProfilePoint; brushed: boolean }[] = [];
  const add = (p: ProfilePoint, brushed = false) => out.push({ p, brushed });
  add([r0 + c, h0]);
  add([r1 - c, h0]);
  add([r1, h0 + c]);
  add([r1, h1 - c]);
  add([r1 - c, h1]);
  if (channel) {
    const { lip, floor } = channel;
    if (lip <= c || lip * 2 >= width || floor >= height) throw new Error('invalid channel for the profile');
    add([r1 - lip, h1]);
    add([r1 - lip, h0 + floor], true);
    add([r0 + lip, h0 + floor], true);
    add([r0 + lip, h1], true);
  }
  add([r0 + c, h1]);
  add([r0, h1 - c]);
  add([r0, h0 + c]);
  // Drop zero-length edges (chamfer = 0) while keeping each edge's material flag.
  const points: ProfilePoint[] = [];
  const brushed: boolean[] = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!.p;
    const b = out[(i + 1) % out.length]!.p;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) continue;
    points.push(a);
    brushed.push(out[(i + 1) % out.length]!.brushed);
  }
  return { points, brushed };
}

/** Signed area in the (radius, height) plane; positive for counter-clockwise polygons. */
export function profileArea(points: ProfilePoint[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export interface RingSolidSpec extends RingProfileSpec {
  /** Lathe segments for a full turn (arcs get a proportional share). */
  segments: number;
  /** Machined panels: the ring is split into `seams` arcs separated by `seamGap` radians. */
  seams?: number;
  seamGap?: number;
  /** A single arc instead of a full ring (e.g. a carriage collar). */
  arc?: { start: number; length: number };
  /** Radial bosses on the outer wall (gimbal pivots). */
  pivots?: { count: number; radius: number; length: number; phase?: number };
}

/** Lathe a profile polygon: position (r·sin φ, h, r·cos φ), matching three's LatheGeometry. */
const latheAt = (r: number, h: number, phi: number) => new Vector3(r * Math.sin(phi), h, r * Math.cos(phi));

/** Flat cap closing a lathed arc at angle `phi`, facing `sign` × the sweep direction. */
function profileCap(points: ProfilePoint[], phi: number, sign: 1 | -1): BufferGeometry {
  const contour = points.map(([r, h]) => new Vector2(r, h));
  const tris = ShapeUtils.triangulateShape(contour, []);
  const normal = new Vector3(Math.cos(phi), 0, -Math.sin(phi)).multiplyScalar(sign);
  const pos = new Float32Array(points.length * 3);
  const nor = new Float32Array(points.length * 3);
  const uv = new Float32Array(points.length * 2);
  points.forEach(([r, h], i) => {
    const v = latheAt(r, h, phi);
    pos.set([v.x, v.y, v.z], i * 3);
    nor.set([normal.x, normal.y, normal.z], i * 3);
  });
  const index: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (const [i0, i1, i2] of tris) {
    a.fromArray(pos, i0! * 3);
    b.fromArray(pos, i1! * 3);
    c.fromArray(pos, i2! * 3);
    const facing = b.clone().sub(a).cross(c.clone().sub(a)).dot(normal);
    if (facing >= 0) index.push(i0!, i1!, i2!);
    else index.push(i0!, i2!, i1!);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/**
 * Precision-machined ring: each profile edge is lathed separately (crisp, flat-shaded faces),
 * optional seams split it into panels closed by end caps, optional pivot bosses sit on the
 * outer wall. Groups: 0 = polished chrome (outer faces, chamfers, caps, pivots), 1 = brushed
 * channel interior (only when a channel exists). Deterministic.
 */
export function buildRingSolid(spec: RingSolidSpec): BufferGeometry {
  const { points, brushed } = ringProfile(spec);
  const turn = Math.PI * 2;
  let arcs: { start: number; length: number }[];
  if (spec.arc) arcs = [spec.arc];
  else if (spec.seams && spec.seams > 1) {
    const gap = spec.seamGap ?? 0.01;
    const step = turn / spec.seams;
    arcs = Array.from({ length: spec.seams }, (_, k) => ({ start: k * step + gap / 2, length: step - gap }));
  } else arcs = [{ start: 0, length: turn }];
  const closed = arcs.length === 1 && Math.abs(arcs[0]!.length - turn) < 1e-9;

  const chrome: BufferGeometry[] = [];
  const brushedParts: BufferGeometry[] = [];
  for (const arc of arcs) {
    const segs = Math.max(3, Math.round((spec.segments * arc.length) / turn));
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const face = new LatheGeometry(
        [new Vector2(a[0], a[1]), new Vector2(b[0], b[1])],
        segs,
        arc.start,
        arc.length,
      );
      (brushed[i] ? brushedParts : chrome).push(face);
    }
    if (!closed) {
      chrome.push(profileCap(points, arc.start, -1));
      chrome.push(profileCap(points, arc.start + arc.length, 1));
    }
  }
  if (spec.pivots) {
    const { count, radius, length, phase = 0 } = spec.pivots;
    const outer = spec.radius + spec.width / 2;
    for (let k = 0; k < count; k++) {
      const phi = phase + (k / count) * turn;
      const boss = new CylinderGeometry(radius, radius, length, 20, 1);
      boss.rotateZ(Math.PI / 2); // axis along +x
      boss.rotateY(phi - Math.PI / 2); // +x → radial direction (sin φ, 0, cos φ)
      const centre = latheAt(outer + length / 2 - radius * 0.35, 0, phi);
      boss.translate(centre.x, centre.y, centre.z);
      chrome.push(boss);
    }
  }
  const groups: BufferGeometry[] = [];
  const mergedChrome = mergeGeometries(chrome, false);
  if (!mergedChrome) throw new Error('ring merge failed');
  groups.push(mergedChrome);
  if (brushedParts.length) {
    const mergedBrushed = mergeGeometries(brushedParts, false);
    if (!mergedBrushed) throw new Error('ring merge failed');
    groups.push(mergedBrushed);
  }
  const result = mergeGeometries(groups, true);
  [...chrome, ...brushedParts, ...groups].forEach((g) => g.dispose());
  if (!result) throw new Error('ring merge failed');
  // three's LatheGeometry leaves the last profile point's normal unnormalised on 2-point strips.
  result.normalizeNormals();
  return result;
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

export interface ShellSpec {
  radius: number;
  thickness: number;
  bands: number;
  /** Probability that a panel is present (fractured shell). */
  keep: number;
  /** Physical gap between neighbouring panels, in radians of arc. */
  gap: number;
  /** Lifted panels: share of panels and their maximum outward offset. */
  liftShare: number;
  lift: number;
  /** Share of panels whose edge walls carry an emissive copper inlay. */
  copperShare: number;
  /** Subdivisions per panel face edge (curvature). */
  subdiv: number;
  /** Polar opening (radians from each pole) left free — reads as axial ports. */
  polar: number;
  seed: number;
}

export interface ShellPanels {
  geometry: BufferGeometry;
  panels: number;
}

/**
 * Fractured armour shell: curved spherical panels with thickness, gaps and a few lifted plates.
 * Non-indexed triangles with smooth radial normals on the faces and flat normals on the walls.
 * Per-vertex attributes drive the animation in the vertex shader: `aCenter` (unit direction of
 * the panel centre), `aPhase` (per-panel phase) and `aGlow` (1 on copper-inlaid edge walls).
 */
export function buildShellPanels(spec: ShellSpec): ShellPanels {
  const rand = mulberry32(spec.seed);
  const pos: number[] = [];
  const nor: number[] = [];
  const centre: number[] = [];
  const phase: number[] = [];
  const glow: number[] = [];
  const latMin = -Math.PI / 2 + spec.polar;
  const latMax = Math.PI / 2 - spec.polar;
  const bandH = (latMax - latMin) / spec.bands;
  const S = (lat: number, lon: number, r: number) =>
    new Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon));
  const ab = new Vector3();
  const ac = new Vector3();
  let panels = 0;

  for (let b = 0; b < spec.bands; b++) {
    const lat0 = latMin + b * bandH;
    const lat1 = lat0 + bandH;
    const latMid = (lat0 + lat1) / 2;
    const count = Math.max(3, Math.round((2 * Math.PI * Math.cos(latMid)) / bandH));
    const offset = rand();
    for (let k = 0; k < count; k++) {
      if (rand() >= spec.keep) continue;
      panels++;
      const lift = rand() < spec.liftShare ? spec.lift * (0.35 + 0.65 * rand()) : rand() * spec.lift * 0.06;
      const copper = rand() < spec.copperShare;
      const ph = rand() * Math.PI * 2;
      const gapLat = spec.gap / 2;
      const gapLon = spec.gap / 2 / Math.max(Math.cos(latMid), 0.25);
      const lonStart = ((k + offset) / count) * Math.PI * 2;
      const lonA = lonStart + gapLon;
      const lonB = lonStart + (Math.PI * 2) / count - gapLon;
      const latA = lat0 + gapLat;
      const latB = lat1 - gapLat;
      const rOut = spec.radius + lift;
      const rIn = rOut - spec.thickness;
      const c = S(latMid, (lonA + lonB) / 2, 1);
      const mid = c.clone().multiplyScalar((rOut + rIn) / 2);

      const pushTri = (a: Vector3, bb: Vector3, cc: Vector3, n: [Vector3, Vector3, Vector3], g: number) => {
        ab.subVectors(bb, a);
        ac.subVectors(cc, a);
        const facing = ab.cross(ac).dot(n[0].clone().add(n[1]).add(n[2]));
        const verts = facing >= 0 ? [a, bb, cc] : [a, cc, bb];
        const norms = facing >= 0 ? n : [n[0], n[2], n[1]];
        for (let v = 0; v < 3; v++) {
          pos.push(verts[v]!.x, verts[v]!.y, verts[v]!.z);
          nor.push(norms[v]!.x, norms[v]!.y, norms[v]!.z);
          centre.push(c.x, c.y, c.z);
          phase.push(ph);
          glow.push(g);
        }
      };

      const n = spec.subdiv;
      const lat = (i: number) => latA + ((latB - latA) * i) / n;
      const lon = (j: number) => lonA + ((lonB - lonA) * j) / n;
      // Outer (radial normals) and inner (inward normals) curved faces.
      for (const [r, dir] of [
        [rOut, 1],
        [rIn, -1],
      ] as const) {
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const p00 = S(lat(i), lon(j), r);
            const p10 = S(lat(i + 1), lon(j), r);
            const p01 = S(lat(i), lon(j + 1), r);
            const p11 = S(lat(i + 1), lon(j + 1), r);
            const nrm = (p: Vector3) => p.clone().normalize().multiplyScalar(dir);
            pushTri(p00, p01, p11, [nrm(p00), nrm(p01), nrm(p11)], 0);
            pushTri(p00, p11, p10, [nrm(p00), nrm(p11), nrm(p10)], 0);
          }
        }
      }
      // Edge walls (flat normals, oriented away from the panel centre).
      const edges: [number, number, number, number][] = [];
      for (let s = 0; s < n; s++) {
        edges.push([lat(0), lon(s), lat(0), lon(s + 1)]);
        edges.push([lat(n), lon(s), lat(n), lon(s + 1)]);
        edges.push([lat(s), lon(0), lat(s + 1), lon(0)]);
        edges.push([lat(s), lon(n), lat(s + 1), lon(n)]);
      }
      for (const [la, lo, lb, lo2] of edges) {
        const oa = S(la, lo, rOut);
        const ob = S(lb, lo2, rOut);
        const ia = S(la, lo, rIn);
        const ib = S(lb, lo2, rIn);
        const wn = new Vector3().subVectors(ob, oa).cross(new Vector3().subVectors(ia, oa)).normalize();
        const outward = oa.clone().add(ob).add(ia).add(ib).multiplyScalar(0.25).sub(mid);
        if (wn.dot(outward) < 0) wn.negate();
        const g = copper ? 1 : 0;
        pushTri(oa, ob, ib, [wn, wn, wn], g);
        pushTri(oa, ib, ia, [wn, wn, wn], g);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  geometry.setAttribute('aCenter', new BufferAttribute(new Float32Array(centre), 3));
  geometry.setAttribute('aPhase', new BufferAttribute(new Float32Array(phase), 1));
  geometry.setAttribute('aGlow', new BufferAttribute(new Float32Array(glow), 1));
  return { geometry, panels };
}

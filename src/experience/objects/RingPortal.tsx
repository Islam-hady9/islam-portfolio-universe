'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Shape,
  TorusGeometry,
  Vector3,
  type Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frame } from '../orchestrator/frame-state';
import { useExperience } from '@/state/experience-store';
import { portalGlow } from './portal-glow';

/** Housing segments around the ring (each one inner band + outer band on a rear plate). */
export const PORTAL_SEGMENTS = 24;
/** Every n-th joint between segments carries a clamp. */
export const PORTAL_CLAMP_EVERY = 3;
/** Radial layout of the ring, as offsets from the energy surface's radius (world units). */
export const PORTAL_PROFILE = {
  teeth: 0.045,
  innerBand: [0.13, 0.5] as const,
  channel: 0.61,
  outerBand: [0.72, 1.1] as const,
  rearPlate: [0.24, 1.2] as const,
  clamp: [1.04, 1.42] as const,
};

/** Annular sector [r0, r1] × [a0, a1] (radians), extruded so it spans z ∈ [zA, zB]. */
function sector(r0: number, r1: number, a0: number, a1: number, zA: number, zB: number, bevel: number) {
  const s = new Shape();
  s.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
  s.absarc(0, 0, r1, a0, a1, false);
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  const g = new ExtrudeGeometry(s, {
    depth: Math.max(0.01, zB - zA - bevel * 2),
    curveSegments: 5,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
  });
  g.translate(0, 0, zA + bevel);
  return g;
}

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * One housing segment centred on angle 0: a nearly continuous rear plate that gives the ring
 * its mass, a proud inner band that frames the energy surface and an outer band, separated by
 * the recessed channel. Beveled edges catch the environment light like machined metal.
 */
export function buildPortalSectorGeometry(radius: number): BufferGeometry {
  const half = Math.PI / PORTAL_SEGMENTS;
  const P = PORTAL_PROFILE;
  return merge([
    sector(radius + P.rearPlate[0], radius + P.rearPlate[1], -half + 0.004, half - 0.004, -0.54, -0.2, 0.02),
    sector(radius + P.innerBand[0], radius + P.innerBand[1], -half + 0.016, half - 0.016, -0.26, 0.32, 0.04),
    sector(radius + P.outerBand[0], radius + P.outerBand[1], -half + 0.02, half - 0.02, -0.26, 0.24, 0.04),
  ]);
}

/** A clamp over a joint between two segments: a block with a stepped cap. */
export function buildPortalClampGeometry(radius: number): BufferGeometry {
  const P = PORTAL_PROFILE;
  return merge([
    sector(radius + P.clamp[0], radius + P.clamp[1], -0.07, 0.07, -0.46, 0.18, 0.03),
    sector(radius + P.clamp[0] - 0.06, radius + P.clamp[1] - 0.14, -0.045, 0.045, 0.16, 0.27, 0.015),
  ]);
}

/** The slowly turning precision ring at the edge of the energy surface: a lip plus fine teeth. */
export function buildPrecisionRingGeometry(radius: number, teeth = 120): BufferGeometry {
  const parts: BufferGeometry[] = [new TorusGeometry(radius + 0.005, 0.03, 5, 192)];
  const o = new Object3D();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const r = radius + PORTAL_PROFILE.teeth;
    const g = new BoxGeometry(0.075, i % 10 === 0 ? 0.1 : 0.055, i % 10 === 0 ? 0.24 : 0.16);
    o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.06);
    o.rotation.set(0, 0, a);
    o.updateMatrix();
    g.applyMatrix4(o.matrix);
    parts.push(g);
  }
  return merge(parts);
}

/**
 * Illuminated markings on the bands: three ticks per segment on the outer band (the middle one
 * longer) and two fine ticks per segment on the inner band. Returns per-instance angle and kind
 * (0 outer tick, 1 outer major, 2 inner tick) plus the instance transforms.
 */
export function portalMarkings(radius: number) {
  const step = (Math.PI * 2) / PORTAL_SEGMENTS;
  const items: { angle: number; kind: number; r: number; len: number; width: number; z: number }[] = [];
  for (let s = 0; s < PORTAL_SEGMENTS; s++) {
    const c = s * step;
    for (const [da, kind] of [
      [-0.08, 0],
      [0, 1],
      [0.08, 0],
    ] as const)
      items.push({ angle: c + da, kind, r: radius + 0.91, len: kind ? 0.26 : 0.13, width: 0.03, z: 0.25 });
    for (const da of [-0.055, 0.055])
      items.push({ angle: c + da, kind: 2, r: radius + 0.31, len: 0.07, width: 0.022, z: 0.33 });
  }
  return items;
}

const markingVertex = /* glsl */ `
  attribute float aAngle;
  attribute float aKind;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uSweep;
  varying float vGlow;
  void main() {
    // Two light packets circulate in opposite directions; the ignition sweep lights the
    // markings from the base of the ring upwards, both sides at once.
    float p1 = pow(0.5 + 0.5 * cos(aAngle - uTime * 0.55), 26.0);
    float p2 = pow(0.5 + 0.5 * cos(aAngle + uTime * 0.31 + 2.1), 40.0);
    float base = aKind > 1.5 ? 0.16 : (aKind > 0.5 ? 0.55 : 0.2);
    float fromBase = abs(atan(sin(aAngle + 1.5708), cos(aAngle + 1.5708))) / 3.14159;
    float lit = smoothstep(fromBase - 0.06, fromBase + 0.02, uSweep);
    vGlow = (base + p1 * 1.8 + p2 * 1.1) * uEnergy * mix(0.15, 1.0, lit);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vGlow;
  void main() { gl_FragColor = vec4(uColor * vGlow, 1.0); }`;

const channelVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const channelFragment = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uSweep;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float a = vUv.x * 6.28318;
    float packet = pow(0.5 + 0.5 * cos(a - uTime * 0.55), 18.0);
    float flow = 0.78 + 0.22 * sin(a * 36.0 - uTime * 1.6);
    float fromBase = abs(atan(sin(a + 1.5708), cos(a + 1.5708))) / 3.14159;
    float lit = smoothstep(fromBase - 0.08, fromBase, uSweep);
    gl_FragColor = vec4(uColor * (0.95 * flow + packet * 2.6) * uEnergy * mix(0.25, 1.0, lit), 1.0);
  }`;

/**
 * The energy surface: an opaque window onto a vortex receding behind the ring. Translucent
 * strata are sampled at increasing depth along the view ray (parallax: the tunnel shifts as
 * the camera drifts), each a domain-warped spiral of filaments flowing toward a small, deep
 * convergence core. Mostly below the bloom threshold; only filaments, the rim and the
 * travelling pulses exceed it, so the disc never reads as a flat bright plate.
 */
const discVertex = /* glsl */ `
  varying vec3 vLocal;
  void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const discFragment = /* glsl */ `
  uniform float uTime;
  uniform float uEnergy;
  uniform float uRadius;
  uniform float uIgnite;
  uniform vec2 uPulse;       // x: radius 0..1 of the response ring, y: its amplitude
  uniform vec3 uCam;         // camera position in the disc's local space
  uniform int uLayers;
  varying vec3 vLocal;

  float iuH(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  // Value noise periodic in x with period P (so the angular seam is invisible).
  float iuPn(vec2 p, float P) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, P); float x1 = mod(i.x + 1.0, P);
    return mix(mix(iuH(vec2(x0, i.y)), iuH(vec2(x1, i.y)), f.x),
               mix(iuH(vec2(x0, i.y + 1.0)), iuH(vec2(x1, i.y + 1.0)), f.x), f.y);
  }
  float iuPf(vec2 p, float P) {
    float s = 0.0; float a = 0.5;
    for (int i = 0; i < 3; i++) { s += a * iuPn(p, P); p = vec2(p.x * 2.0, p.y * 2.0 + 3.1); P *= 2.0; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 rd = normalize(vLocal - uCam);
    float iz = 1.0 / max(-rd.z, 0.3);
    float r0 = length(vLocal.xy) / uRadius;
    float t = uTime;
    vec3 col = vec3(0.002, 0.010, 0.017);
    for (int i = 0; i < 4; i++) {
      if (i >= uLayers) break;
      float fi = float(i);
      // Each stratum sits deeper and narrower: its luminous edge reads as one ring of a tunnel.
      float depth = 0.45 + fi * 0.95;
      vec2 q = (vLocal.xy + rd.xy * depth * iz) / (uRadius * (1.0 - fi * 0.17));
      float r = length(q);
      float a = atan(q.y, q.x) / 6.28318 + 0.5;
      float lr = log(max(r, 0.002));
      float P = 9.0 + fi * 3.0;
      vec2 sp = vec2(a * P + lr * 0.6 + t * (0.03 + 0.012 * fi), lr * 3.0 - t * (0.3 + 0.06 * fi));
      sp.x += 0.7 * iuPn(vec2(sp.x, sp.y * 0.7 + 4.0 + fi * 3.0), P);
      float n = iuPf(sp, P);
      float filament = pow(1.0 - abs(2.0 * n - 1.0), 12.0);
      float membrane = exp(-pow((r - 0.93) / (0.03 + fi * 0.012), 2.0));
      float inside = smoothstep(1.0, 0.9, r) * smoothstep(0.05, 0.35, r);
      float fade = exp(-fi * 0.55);
      vec3 tint = mix(vec3(0.24, 0.80, 1.0), vec3(0.42, 0.42, 1.0), fi / 3.0);
      col += tint * fade * (membrane * (0.2 + 0.28 * n) * (i == 0 ? 0.75 : 1.0) + (filament * 0.3 + n * 0.03) * inside);
    }
    // Convergence core deep inside the tunnel, with a darker ring around it.
    vec2 qc = (vLocal.xy + rd.xy * 3.6 * iz) / uRadius;
    float rc = length(qc);
    col *= mix(0.6, 1.0, smoothstep(0.04, 0.3, rc));
    col += vec3(0.62, 0.95, 1.0) * (exp(-rc * rc * 260.0) * 0.9 + exp(-rc * rc * 30.0) * 0.06);
    // Periodic convergence wave (rim → core) and the response ring (core → rim).
    float ph = fract(t / 7.0);
    float wave = exp(-pow((r0 - (1.0 - ph)) / 0.028, 2.0)) * smoothstep(0.0, 0.12, ph) * (1.0 - ph);
    col += vec3(0.42, 0.97, 0.80) * wave * 0.32;
    col += vec3(0.55, 0.98, 0.88) * exp(-pow((r0 - uPulse.x) / 0.04, 2.0)) * uPulse.y * 0.7;
    // Event-horizon rim where the surface meets the precision ring.
    float rim = smoothstep(0.86, 0.997, r0);
    col += vec3(0.30, 0.85, 1.0) * (pow(rim, 4.0) * (1.05 + uIgnite * 1.6) + smoothstep(0.6, 1.0, r0) * 0.03);
    gl_FragColor = vec4(col * uEnergy, 1.0);
  }`;

const particleVertex = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uRadius;
  uniform float uPixelRatio;
  uniform float uEnergy;
  varying float vA;
  void main() {
    // Motes drawn in from the rim along a tightening spiral, converging on the core.
    float life = fract(aSeed.y + uTime * (0.045 + 0.035 * aSeed.z));
    float r = uRadius * mix(0.97, 0.05, pow(life, 0.85));
    float ang = aSeed.x + life * (2.2 + aSeed.z * 1.4) + uTime * 0.04;
    vec3 p = vec3(cos(ang) * r, sin(ang) * r, mix(0.5, 0.03, life));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = mix(1.9, 0.7, life) * (0.6 + aSeed.z * 0.6) * uPixelRatio * (30.0 / -mv.z);
    vA = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.78, life) * uEnergy;
  }`;
const particleFragment = /* glsl */ `
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.25, 0.0, dot(c, c));
    gl_FragColor = vec4(vec3(0.42, 0.9, 1.0) * a * vA * 0.75, 1.0);
  }`;

/** Camera-facing glows: atmospheric haze behind the ring and the contact halo at its base. */
const spriteVertex = /* glsl */ `
  attribute vec2 aCorner;
  attribute vec2 aSize;
  attribute float aKind;
  varying vec2 vUv;
  varying float vKind;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xy += aCorner * aSize;
    vUv = aCorner;
    vKind = aKind;
    gl_Position = projectionMatrix * mv;
  }`;
const spriteFragment = /* glsl */ `
  uniform float uEnergy;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vKind;
  void main() {
    float r = length(vUv);
    float g = vKind < 0.5
      ? exp(-r * r * 3.4) * 0.2 + exp(-pow((r - 0.56) / 0.14, 2.0)) * 0.08
      : exp(-(vUv.x * vUv.x * 2.6 + vUv.y * vUv.y * 9.0)) * 0.5;
    g *= smoothstep(1.0, 0.8, max(abs(vUv.x), abs(vUv.y)));
    gl_FragColor = vec4(uColor * g * uEnergy, 1.0);
  }`;

function buildSprites(radius: number) {
  const quads = [
    { c: [0, 0, -1.2], s: [radius * 2.15, radius * 2.15], k: 0 },
    { c: [0, -radius + 0.25, 0.9], s: [radius * 1.3, radius * 0.26], k: 1 },
  ];
  const pos: number[] = [];
  const corner: number[] = [];
  const size: number[] = [];
  const kind: number[] = [];
  const index: number[] = [];
  quads.forEach((q, i) => {
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      pos.push(...q.c);
      corner.push(x!, y!);
      size.push(...q.s);
      kind.push(q.k);
    }
    const b = i * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aCorner', new BufferAttribute(new Float32Array(corner), 2));
  g.setAttribute('aSize', new BufferAttribute(new Float32Array(size), 2));
  g.setAttribute('aKind', new BufferAttribute(new Float32Array(kind), 1));
  g.setIndex(index);
  return g;
}

function buildParticles(count: number) {
  const seeds = new Float32Array(count * 3);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = rnd() * Math.PI * 2;
    seeds[i * 3 + 1] = rnd();
    seeds[i * 3 + 2] = rnd();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('aSeed', new BufferAttribute(seeds, 3));
  return g;
}

const CYAN = new Color('#52c7ea');

/**
 * Monumental ring portal (spec S8). Same concept as before — a segmented dark-metal ring with
 * illuminated seams around an energy surface — at machined fidelity: beveled housing segments
 * on a rear plate, a recessed illuminated channel, clamps over the joints, emissive markings,
 * a slowly turning precision ring, a layered energy surface with inflowing motes and light
 * spilled onto the ground. Motion: slow rotation, breathing, circulating light packets, a
 * convergence wave, an ignition sweep on arrival and a single response pulse when the
 * assistant completes an answer (never per token; nothing extra runs during Local AI
 * generation because rendering is held then).
 */
export function RingPortal({
  radius,
  stationIndex,
  intensity = 1,
  layers = 3,
  particles = 400,
  pixelRatio = 1,
}: {
  radius: number;
  stationIndex: number;
  intensity?: number;
  /** Energy strata (2–4, by tier). */
  layers?: number;
  /** Inflowing motes (0 disables). */
  particles?: number;
  pixelRatio?: number;
}) {
  const rootRef = useRef<Group>(null);
  const housingRef = useRef<InstancedMesh>(null);
  const clampsRef = useRef<InstancedMesh>(null);
  const marksRef = useRef<InstancedMesh>(null);
  const precisionRef = useRef<Mesh>(null);
  const discRef = useRef<Mesh>(null);
  const marks = useMemo(() => portalMarkings(radius), [radius]);
  const clampCount = PORTAL_SEGMENTS / PORTAL_CLAMP_EVERY;

  const geo = useMemo(() => {
    const markGeo = new BoxGeometry(1, 1, 1);
    markGeo.setAttribute(
      'aAngle',
      new InstancedBufferAttribute(new Float32Array(marks.map((m) => m.angle)), 1),
    );
    markGeo.setAttribute(
      'aKind',
      new InstancedBufferAttribute(new Float32Array(marks.map((m) => m.kind)), 1),
    );
    return {
      housing: buildPortalSectorGeometry(radius),
      clamp: buildPortalClampGeometry(radius),
      precision: buildPrecisionRingGeometry(radius),
      channel: new TorusGeometry(radius + PORTAL_PROFILE.channel, 0.034, 6, 240),
      mark: markGeo,
      sprites: buildSprites(radius),
    };
  }, [radius, marks]);
  // The mote count follows the tier: kept out of `geo` so a tier change never rebuilds the
  // instanced housing.
  const moteGeo = useMemo(() => (particles > 0 ? buildParticles(particles) : null), [particles]);

  const mats = useMemo(() => {
    const shared = { uTime: { value: 0 }, uEnergy: { value: 0 }, uSweep: { value: 1 } };
    return {
      housing: new MeshStandardMaterial({
        color: '#161c23',
        metalness: 0.68,
        roughness: 0.34,
        envMapIntensity: 0.9,
      }),
      precision: new MeshStandardMaterial({
        color: '#2c3742',
        metalness: 0.9,
        roughness: 0.26,
        envMapIntensity: 1.1,
      }),
      channel: new ShaderMaterial({
        uniforms: { ...shared, uColor: { value: CYAN } },
        vertexShader: channelVertex,
        fragmentShader: channelFragment,
        toneMapped: false,
      }),
      marks: new ShaderMaterial({
        uniforms: { ...shared, uColor: { value: CYAN } },
        vertexShader: markingVertex,
        fragmentShader: glowFragment,
        toneMapped: false,
      }),
      disc: new ShaderMaterial({
        uniforms: {
          uTime: shared.uTime,
          uEnergy: { value: 0 },
          uRadius: { value: radius },
          uIgnite: { value: 0 },
          uPulse: { value: [0, 0] },
          uCam: { value: new Vector3(0, 0, 30) },
          uLayers: { value: 3 },
        },
        vertexShader: discVertex,
        fragmentShader: discFragment,
        toneMapped: false,
      }),
      particles: new ShaderMaterial({
        uniforms: {
          uTime: shared.uTime,
          uRadius: { value: radius },
          uPixelRatio: { value: 1 },
          uEnergy: { value: 0 },
        },
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      sprites: new ShaderMaterial({
        uniforms: { uEnergy: { value: 0 }, uColor: { value: CYAN } },
        vertexShader: spriteVertex,
        fragmentShader: spriteFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
      shared,
    };
  }, [radius]);

  useLayoutEffect(() => {
    const housing = housingRef.current;
    const clamps = clampsRef.current;
    const marksMesh = marksRef.current;
    if (!housing || !clamps || !marksMesh) return;
    const o = new Object3D();
    const step = (Math.PI * 2) / PORTAL_SEGMENTS;
    for (let i = 0; i < PORTAL_SEGMENTS; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, i * step);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      housing.setMatrixAt(i, o.matrix);
    }
    for (let i = 0; i < clampCount; i++) {
      o.rotation.set(0, 0, (i * PORTAL_CLAMP_EVERY + 0.5) * step);
      o.updateMatrix();
      clamps.setMatrixAt(i, o.matrix);
    }
    marks.forEach((m, i) => {
      o.position.set(Math.cos(m.angle) * m.r, Math.sin(m.angle) * m.r, m.z);
      o.rotation.set(0, 0, m.angle);
      o.scale.set(m.len, m.width, 0.012);
      o.updateMatrix();
      marksMesh.setMatrixAt(i, o.matrix);
    });
    housing.instanceMatrix.needsUpdate = true;
    clamps.instanceMatrix.needsUpdate = true;
    marksMesh.instanceMatrix.needsUpdate = true;
    housing.computeBoundingSphere();
    clamps.computeBoundingSphere();
    marksMesh.computeBoundingSphere();
    // Re-run whenever the instanced meshes are rebuilt (their args are geometry + material).
  }, [marks, clampCount, geo, mats]);

  // Separate lifetimes: a material-only change must not dispose the geometries still in use,
  // and vice versa.
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useEffect(() => () => moteGeo?.dispose(), [moteGeo]);
  useEffect(
    () => () =>
      Object.values(mats).forEach((m) => 'dispose' in m && (m as { dispose: () => void }).dispose()),
    [mats],
  );

  const motion = useRef({ armed: true, igniteAt: -100, pulseAt: -100, signal: -1 });
  const tmp = useMemo(() => new Vector3(), []);

  useFrame(({ camera }) => {
    const p = frame.presence[stationIndex] ?? 0;
    const t = frame.time;
    const m = motion.current;
    const signal = useExperience.getState().assistantSignal;
    if (m.signal < 0) m.signal = signal;
    if (signal !== m.signal) {
      m.signal = signal;
      m.pulseAt = t;
    }
    if (p < 0.15) m.armed = true;
    if (m.armed && p > 0.55) {
      m.armed = false;
      m.igniteAt = t;
    }
    const sinceIgnite = t - m.igniteAt;
    const ignite = frame.reduced ? 0 : Math.exp(-Math.max(0, sinceIgnite) * 1.4);
    const sweep = frame.reduced ? 1 : Math.min(1, Math.max(0, sinceIgnite / 1.8));
    const sincePulse = t - m.pulseAt;
    const pulseOn = !frame.reduced && sincePulse >= 0 && sincePulse < 1.6;
    const pulseR = pulseOn ? Math.min(1, sincePulse / 1.3) : 0;
    const pulseA = pulseOn ? Math.sin(Math.PI * Math.min(1, sincePulse / 1.6)) * 0.9 : 0;
    const breath = frame.reduced ? 1 : 1 + 0.055 * Math.sin(t * 0.7) + 0.02 * Math.sin(t * 1.9 + 1.3);
    const energy = (0.5 + 0.62 * p) * intensity * breath * (1 + ignite * 0.45 + pulseA * 0.18);

    mats.shared.uTime.value = t;
    mats.shared.uEnergy.value = energy * 1.35;
    mats.shared.uSweep.value = sweep;
    const du = mats.disc.uniforms;
    du.uEnergy!.value = energy;
    du.uLayers!.value = layers;
    mats.particles.uniforms.uPixelRatio!.value = pixelRatio;
    du.uIgnite!.value = ignite;
    (du.uPulse!.value as number[])[0] = pulseR;
    (du.uPulse!.value as number[])[1] = pulseA;
    mats.particles.uniforms.uEnergy!.value = energy;
    mats.sprites.uniforms.uEnergy!.value = energy * (0.9 + ignite * 0.6);
    if (precisionRef.current) precisionRef.current.rotation.z = t * 0.035;
    if (discRef.current) du.uCam!.value = discRef.current.worldToLocal(tmp.copy(camera.position));

    frame.portalEnergy = p * breath * (1 + ignite * 0.5 + pulseA * 0.3);
    portalGlow.strength.value = frame.portalEnergy * intensity;
    if (rootRef.current) {
      rootRef.current.getWorldPosition(portalGlow.position.value);
      portalGlow.position.value.y -= radius;
      portalGlow.position.value.z += 0.6;
    }
  });

  return (
    <group ref={rootRef}>
      <instancedMesh
        ref={housingRef}
        name="portal-housing"
        args={[geo.housing, mats.housing, PORTAL_SEGMENTS]}
      />
      <instancedMesh ref={clampsRef} name="portal-clamps" args={[geo.clamp, mats.housing, clampCount]} />
      <instancedMesh ref={marksRef} name="portal-markings" args={[geo.mark, mats.marks, marks.length]} />
      <mesh name="portal-channel" geometry={geo.channel} material={mats.channel} position={[0, 0, -0.13]} />
      <mesh
        ref={precisionRef}
        name="portal-precision-ring"
        geometry={geo.precision}
        material={mats.precision}
      />
      <mesh ref={discRef} name="portal-energy" material={mats.disc}>
        <circleGeometry args={[radius, 128]} />
      </mesh>
      {moteGeo ? (
        <points name="portal-motes" geometry={moteGeo} material={mats.particles} frustumCulled={false} />
      ) : null}
      <mesh
        name="portal-glows"
        geometry={geo.sprites}
        material={mats.sprites}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  Group,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mulberry32 } from '../../math/noise';
import { activity, RIBBON_GLSL, ribbonGeometry } from './kit';

const PANEL_COUNT = 5;
/** Seconds between "match" events (a pulse runs the threads; cards answer back → front). */
const MATCH_PERIOD = 4.6;
/** The world's nominal camera (PortalSystem FRAMING.ats), used to orient the ribbons. */
const CAMERA = new Vector3(0.5, 1.0, 7.8);

const SDF_GLSL = /* glsl */ `
  float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
  float sdBar(vec2 p, float x0, float x1, float r) { p.x -= clamp(p.x, x0, x1); return length(p) - r; }
  float fillAA(float d) { float w = fwidth(d); return 1.0 - smoothstep(-w, w, d); }
  float strokeAA(float d, float t) { float w = fwidth(d); return 1.0 - smoothstep(t - w, t + w, abs(d)); }
  float h1(float n) { return fract(sin(n) * 43758.5453); }
`;

/**
 * Frosted glass UI card with abstract matching content — avatar ring, name and skill-chip
 * skeletons, text lines, score bars and a match ring (no real data, no faces, no text).
 * Anti-aliased SDF geometry; back cards recede (dimmer, cooler) so the layers separate.
 */
function panelMaterial(seed: number, depth: number) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSeed: { value: seed },
      uHi: { value: 0 },
      uDepth: { value: depth },
      uMatch: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed; uniform float uHi; uniform float uDepth; uniform float uMatch;
      varying vec2 vUv;
      ${SDF_GLSL}
      void main(){
        vec2 p = (vUv - 0.5) * vec2(1.6, 1.0);
        float d = sdBox(p, vec2(0.78, 0.48), 0.055);
        float inside = fillAA(d);
        if (inside <= 0.0) discard;
        vec3 cyan = vec3(0.32, 0.86, 1.0);
        vec3 mint = vec3(0.49, 0.97, 0.79);
        // Glass body: cool vertical gradient, a slow diagonal sheen.
        vec3 col = mix(vec3(0.014, 0.045, 0.06), vec3(0.04, 0.115, 0.145), smoothstep(-0.5, 0.5, p.y));
        col += vec3(0.6, 0.9, 1.0) * smoothstep(0.16, 0.0, abs(p.x * 0.55 + p.y - 0.2 + 0.06 * sin(uTime * 0.2 + uSeed * 6.0))) * 0.05;
        // Optics: perimeter stroke brightening at the corners, top-edge light.
        float edge = strokeAA(d + 0.005, 0.0035);
        float corner = exp(-pow(length(abs(p) - vec2(0.725, 0.425)) / 0.1, 2.0));
        float border = edge * (0.42 + 0.58 * corner + 0.5 * smoothstep(0.1, 0.48, p.y));
        // Header: avatar ring, name + role lines, divider.
        float ra = length(p - vec2(-0.64, 0.31)) - 0.075;
        float ui = fillAA(ra) * 0.2 + strokeAA(ra, 0.006) * 0.75;
        ui += fillAA(sdBar(p - vec2(0.0, 0.345), -0.52, -0.2 + 0.14 * h1(uSeed * 11.0), 0.016)) * 0.55;
        ui += fillAA(sdBar(p - vec2(0.0, 0.275), -0.52, -0.33 + 0.1 * h1(uSeed * 13.0), 0.011)) * 0.32;
        ui += fillAA(abs(p.y - 0.19) - 0.0016) * step(abs(p.x), 0.72) * 0.22;
        // Skill chips.
        float cx = -0.7;
        for (int i = 0; i < 3; i++) {
          float cw = 0.06 + 0.045 * h1(uSeed * 7.0 + float(i));
          ui += strokeAA(sdBox(p - vec2(cx + cw, 0.11), vec2(cw, 0.027), 0.027), 0.0045) * 0.5;
          cx += cw * 2.0 + 0.035;
        }
        // Body lines.
        for (int i = 0; i < 4; i++) {
          float len = 0.32 + 0.4 * h1(float(i) * 3.7 + uSeed * 9.0);
          ui += fillAA(sdBar(p - vec2(0.0, 0.01 - float(i) * 0.085), -0.7, -0.7 + len, 0.0085)) * 0.22;
        }
        // Score bars.
        for (int i = 0; i < 5; i++) {
          float bh = 0.05 + 0.12 * h1(float(i) * 5.1 + uSeed * 3.0) + uMatch * 0.035 * h1(float(i) + 2.0);
          ui += fillAA(sdBox(p - vec2(0.33 + float(i) * 0.045, -0.385 + bh * 0.5), vec2(0.012, bh * 0.5), 0.006)) * 0.45;
        }
        // Match ring: track + progress arc from the top, filling further on a match.
        vec2 m = p - vec2(0.62, -0.27);
        float rr = length(m) - 0.085;
        float ang = atan(m.x, m.y) / 6.2831853 + 0.5;
        float arc = strokeAA(rr, 0.011) * step(ang, 0.5 + 0.22 * h1(uSeed * 17.0) + uMatch * 0.25);
        float scan = smoothstep(0.06, 0.0, abs(fract(vUv.y * 0.5 - uTime * 0.1 + uSeed) - 0.5)) * 0.045;
        float front = uDepth;
        float hi = uHi + uMatch;
        col += cyan * ui * (0.5 + 0.5 * front) * (1.0 + uMatch * 0.5);
        col += cyan * strokeAA(rr, 0.006) * 0.22 + mint * arc * (1.0 + uMatch * 1.6);
        col += cyan * border * (0.85 + hi * 1.3) + cyan * scan;
        col *= mix(0.5, 1.0, front);
        float alpha = (0.5 + 0.26 * front) + border * 0.35;
        gl_FragColor = vec4(col, min(alpha, 1.0) * inside);
      }`,
  });
}

/** ATS Matching — layered matching interface + flowing data threads (cyan). */
export function AtsWorld() {
  const panels = useRef<(Group | null)[]>([]);
  const mats = useMemo(
    () => Array.from({ length: PANEL_COUNT }, (_, i) => panelMaterial(i * 0.37 + 0.1, i / (PANEL_COUNT - 1))),
    [],
  );

  const threads = useMemo(() => {
    const rand = mulberry32(8);
    const paths: Vector3[][] = [];
    for (let c = 0; c < 14; c++) {
      const start = new Vector3(-4.6 + rand() * 0.6, -0.6 + rand() * 2.4, -1.2 + rand() * 1.4);
      const end = new Vector3(4.2 + rand() * 0.6, -0.4 + rand() * 2.2, -2.5 + rand() * 1.2);
      const mid = new Vector3((rand() - 0.5) * 1.5, 0.4 + rand() * 1.2, -1.5 - rand() * 1.5);
      paths.push(new CatmullRomCurve3([start, mid, end], false, 'centripetal').getPoints(96));
    }
    const g = ribbonGeometry(paths, CAMERA);
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1 },
        uMatch: { value: 0 },
        uAngular: { value: 0.0024 },
      },
      vertexShader: /* glsl */ `attribute float aT; attribute float aLane; ${RIBBON_GLSL}
        varying float vT; varying float vL; varying float vX;
        void main(){ vT = aT; vL = aLane; vX = aAcross; gl_Position = iuRibbon(position); }`,
      fragmentShader: /* glsl */ `uniform float uTime; uniform float uSpeed; uniform float uMatch;
        varying float vT; varying float vL; varying float vX;
        void main(){
          float flow = fract(vT * 2.0 - uTime * 0.28 * uSpeed + vL * 0.17);
          float pulse = smoothstep(0.0, 0.06, flow) * smoothstep(0.3, 0.06, flow);
          float k = 1.0 - abs(vX);
          float profile = smoothstep(0.3, 0.95, k) + k * k * 0.3;
          float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
          float a = (0.075 + pulse * (0.85 + uMatch * 0.9)) * profile * ends;
          gl_FragColor = vec4(vec3(0.32, 0.86, 1.0) * a * 1.6, a);
        }`,
    });
    return { g, m };
  }, []);

  const nodes = useMemo(() => {
    const rand = mulberry32(17);
    const n = 26;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const left = i < n / 2;
      pos.set([(left ? -4.8 : 4.4) + rand() * 0.8, -0.6 + rand() * 2.6, -2 + rand() * 1.6], i * 3);
      seed[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 30 }, uTime: { value: 0 }, uMatch: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uSize; uniform float uTime; uniform float uMatch; varying float vB;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          vB = 0.75 + 0.25 * sin(uTime * 1.3 + aSeed * 30.0) + uMatch * step(0.6, aSeed);
          gl_PointSize = uSize * (0.85 + 0.3 * vB) / -mv.z; }`,
      fragmentShader: /* glsl */ `varying float vB; void main(){ float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * 0.55 + smoothstep(0.16, 0.0, d) * 0.6;
        gl_FragColor = vec4(vec3(0.5, 1.0, 0.9) * a * 1.8 * vB, a); }`,
    });
    return { g, m };
  }, []);

  /** Platform ring: precise AA rings, 72 ticks, a slow scanning arc and a soft inner light. */
  const platform = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: { uTime: { value: 0 }, uMatch: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform float uTime; uniform float uMatch; varying vec2 vUv;
          float ringAA(float r, float rad, float t){ float w = fwidth(r); return 1.0 - smoothstep(t - w, t + w, abs(r - rad)); }
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float a = atan(p.y, p.x) / 6.2831853 + 0.5;
            float u = fract(a * 72.0);
            float du = min(u, 1.0 - u);
            float tick = (1.0 - smoothstep(0.06, 0.06 + fwidth(du) * 1.5, du)) * step(0.855, r) * step(r, 0.895);
            float scanA = fract(a - uTime * 0.06);
            float scan = ringAA(r, 0.92, 0.012) * smoothstep(0.16, 0.0, scanA) * 1.6;
            float rings = ringAA(r, 0.92, 0.006) * 0.85 + ringAA(r, 0.7, 0.004) * 0.4 + ringAA(r, 0.8, 0.0022) * 0.22;
            float wave = ringAA(r, fract(uTime * 0.22) * 0.92, 0.01) * (1.0 - fract(uTime * 0.22)) * 0.35;
            float glow = exp(-r * r * 3.2) * 0.12 + exp(-pow((r - 0.92) / 0.06, 2.0)) * 0.18;
            float v = (rings + tick * 0.5 + scan + wave) * (1.0 + uMatch * 0.8) + glow;
            float a2 = v * smoothstep(1.0, 0.96, r);
            gl_FragColor = vec4(vec3(0.32, 0.86, 1.0) * a2 * 1.3, a2);
          }`,
      }),
    [],
  );

  useEffect(
    () => () => {
      mats.forEach((m) => m.dispose());
      threads.g.dispose();
      threads.m.dispose();
      nodes.g.dispose();
      nodes.m.dispose();
      platform.dispose();
    },
    [mats, threads, nodes, platform],
  );

  useFrame((_, dt) => {
    const a = activity('ats');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    // Match event: the threads surge, then each card answers in turn (back → front).
    const phase = (a.time % MATCH_PERIOD) / MATCH_PERIOD;
    const surge = Math.exp(-Math.pow((phase - 0.06) / 0.07, 2));
    threads.m.uniforms.uTime!.value = a.time;
    threads.m.uniforms.uSpeed!.value = 1 + a.hover * 1.6;
    threads.m.uniforms.uMatch!.value = surge;
    nodes.m.uniforms.uTime!.value = a.time;
    nodes.m.uniforms.uMatch!.value = surge;
    platform.uniforms.uTime!.value = a.time;
    platform.uniforms.uMatch!.value = surge * 0.6;
    mats.forEach((m, i) => {
      m.uniforms.uTime!.value = a.time;
      m.uniforms.uHi!.value = a.hover * (i === PANEL_COUNT - 1 ? 1 : 0.4);
      m.uniforms.uMatch!.value = Math.exp(-Math.pow((phase - 0.16 - i * 0.07) / 0.05, 2)) * 0.8;
    });
    panels.current.forEach((p, i) => {
      if (!p) return;
      const spread = 0.55 + a.hover * 0.35;
      const respond = (mats[i]!.uniforms.uMatch!.value as number) * 0.05;
      p.position.set(
        -1.0 + i * spread * 0.55,
        0.8 + i * 0.16 + Math.sin(a.time * 0.6 + i) * 0.04 + respond,
        -2.6 + i * spread + respond,
      );
      p.rotation.set(0, -0.42 + a.hover * 0.08, 0);
    });
  });

  return (
    <>
      <color attach="background" args={['#030a0d']} />
      <mesh geometry={threads.g} material={threads.m} />
      <points geometry={nodes.g} material={nodes.m} />
      {mats.map((m, i) => (
        <group
          key={i}
          ref={(el) => {
            panels.current[i] = el;
          }}
        >
          <mesh material={m} renderOrder={10 + i}>
            <planeGeometry args={[2.6, 1.62]} />
          </mesh>
        </group>
      ))}
      <mesh material={platform} rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -0.75, -1.5]}>
        <planeGeometry args={[9, 9]} />
      </mesh>
    </>
  );
}

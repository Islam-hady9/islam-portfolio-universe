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
  LineSegments,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mulberry32 } from '../../math/noise';
import { activity, glowMaterial } from './kit';

const PANEL_COUNT = 5;

/** Frosted glass UI card with abstract skeleton content (no real data, no faces). */
function panelMaterial(seed: number) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uHi: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSeed; uniform float uHi; varying vec2 vUv;
      float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) - r; }
      void main(){
        vec2 p = vUv - 0.5;
        float d = box(p * vec2(1.6, 1.0), vec2(0.78, 0.48), 0.06);
        if (d > 0.0) discard;
        float border = smoothstep(0.012, 0.0, abs(d + 0.006));
        vec3 glass = vec3(0.05, 0.16, 0.2) * 0.55;
        vec3 cyan = vec3(0.32, 0.86, 1.0);
        vec3 col = glass + cyan * border * (0.9 + uHi);
        // Abstract avatar disc + skeleton lines + a match arc (no text, no faces).
        vec2 a = (vUv - vec2(0.2, 0.62)) * vec2(1.6, 1.0);
        float disc = smoothstep(0.1, 0.09, length(a));
        col += cyan * disc * 0.35;
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float y = 0.68 - fi * 0.11;
          float len = 0.25 + 0.3 * fract(sin((fi + uSeed * 7.0) * 12.9898) * 43758.5453);
          float line = step(abs(vUv.y - y), 0.012) * step(0.36, vUv.x) * step(vUv.x, 0.36 + len);
          col += cyan * line * 0.4;
        }
        vec2 m = (vUv - vec2(0.8, 0.25)) * vec2(1.6, 1.0);
        float r = length(m);
        float ang = atan(m.y, m.x) / 6.2831853 + 0.5;
        float arc = smoothstep(0.012, 0.0, abs(r - 0.08)) * step(ang, 0.55 + 0.3 * sin(uTime * 0.6 + uSeed * 9.0) * 0.5 + uHi * 0.3);
        col += vec3(0.5, 1.0, 0.85) * arc * 1.4;
        float sweep = smoothstep(0.08, 0.0, abs(fract(vUv.y * 0.5 - uTime * 0.12 + uSeed) - 0.5)) * 0.08;
        col += cyan * sweep;
        gl_FragColor = vec4(col, 0.55 + border * 0.4);
      }`,
  });
}

/** ATS Matching — layered matching interface + flowing data threads (cyan). */
export function AtsWorld() {
  const panels = useRef<(Group | null)[]>([]);
  const mats = useMemo(
    () => Array.from({ length: PANEL_COUNT }, (_, i) => panelMaterial(i * 0.37 + 0.1)),
    [],
  );

  const threads = useMemo(() => {
    const rand = mulberry32(8);
    const segPerCurve = 64;
    const curves = 14;
    const pos = new Float32Array(curves * segPerCurve * 2 * 3);
    const t = new Float32Array(curves * segPerCurve * 2);
    const lane = new Float32Array(curves * segPerCurve * 2);
    let k = 0;
    for (let c = 0; c < curves; c++) {
      const start = new Vector3(-4.6 + rand() * 0.6, -0.6 + rand() * 2.4, -1.2 + rand() * 1.4);
      const end = new Vector3(4.2 + rand() * 0.6, -0.4 + rand() * 2.2, -2.5 + rand() * 1.2);
      const mid = new Vector3((rand() - 0.5) * 1.5, 0.4 + rand() * 1.2, -1.5 - rand() * 1.5);
      const curve = new CatmullRomCurve3([start, mid, end]);
      const pts = curve.getPoints(segPerCurve);
      for (let i = 0; i < segPerCurve; i++) {
        const a = pts[i]!;
        const b = pts[i + 1]!;
        pos.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 3);
        t[k] = i / segPerCurve;
        t[k + 1] = (i + 1) / segPerCurve;
        lane[k] = c;
        lane[k + 1] = c;
        k += 2;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aT', new BufferAttribute(t, 1));
    g.setAttribute('aLane', new BufferAttribute(lane, 1));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSpeed: { value: 1 } },
      vertexShader: /* glsl */ `attribute float aT; attribute float aLane; varying float vT; varying float vL;
        void main(){ vT = aT; vL = aLane; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uTime; uniform float uSpeed; varying float vT; varying float vL;
        void main(){
          float flow = fract(vT * 2.0 - uTime * 0.28 * uSpeed + vL * 0.17);
          float pulse = smoothstep(0.0, 0.08, flow) * smoothstep(0.35, 0.08, flow);
          float a = 0.08 + pulse * 0.9;
          gl_FragColor = vec4(vec3(0.32, 0.86, 1.0) * a * 1.6, a);
        }`,
    });
    return { g, m, line: new LineSegments(g, m) };
  }, []);

  const nodes = useMemo(() => {
    const rand = mulberry32(17);
    const n = 26;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const left = i < n / 2;
      pos.set([(left ? -4.8 : 4.4) + rand() * 0.8, -0.6 + rand() * 2.6, -2 + rand() * 1.6], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uSize: { value: 30 } },
      vertexShader: /* glsl */ `uniform float uSize; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize / -mv.z; }`,
      fragmentShader: /* glsl */ `void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(0.5, 1.0, 0.9) * a * 2.0, a); }`,
    });
    return { g, m };
  }, []);

  const ring = useMemo(() => glowMaterial('#52c7ea', 0.5, 3), []);
  const ringLine = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = smoothstep(0.02, 0.0, abs(r - 0.92)) * 0.9 + smoothstep(0.015, 0.0, abs(r - 0.7)) * 0.4; gl_FragColor = vec4(vec3(0.32, 0.86, 1.0) * a * 1.4, a); }`,
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
      ring.dispose();
      ringLine.dispose();
    },
    [mats, threads, nodes, ring, ringLine],
  );

  useFrame((_, dt) => {
    const a = activity('ats');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    threads.m.uniforms.uTime!.value = a.time;
    threads.m.uniforms.uSpeed!.value = 1 + a.hover * 1.6;
    mats.forEach((m, i) => {
      m.uniforms.uTime!.value = a.time;
      m.uniforms.uHi!.value = a.hover * (i === PANEL_COUNT - 1 ? 1 : 0.4);
    });
    panels.current.forEach((p, i) => {
      if (!p) return;
      const spread = 0.55 + a.hover * 0.35;
      p.position.set(
        -1.0 + i * spread * 0.55,
        0.8 + i * 0.16 + Math.sin(a.time * 0.6 + i) * 0.04,
        -2.6 + i * spread,
      );
      p.rotation.set(0, -0.42 + a.hover * 0.08, 0);
    });
  });

  return (
    <>
      <color attach="background" args={['#030a0d']} />
      <primitive object={threads.line} />
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
      <mesh material={ringLine} rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -0.75, -1.5]}>
        <planeGeometry args={[9, 9]} />
      </mesh>
      <mesh material={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -0.8, -1.5]}>
        <planeGeometry args={[8, 8]} />
      </mesh>
    </>
  );
}

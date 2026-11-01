'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, ShaderMaterial } from 'three';
import { NOISE_GLSL } from '../shaders/noise';
import { mulberry32 } from '../math/noise';
import { frame } from '../orchestrator/frame-state';

/** Slow drifting dust motes in a box volume (shader-animated). */
export function Dust({
  count,
  center,
  size,
  pixelRatio,
  color = '#9fd8e6',
  stationIndex,
  name,
}: {
  name?: string;
  count: number;
  center: [number, number, number];
  size: [number, number, number];
  pixelRatio: number;
  color?: string;
  stationIndex?: number;
}) {
  const { g, m } = useMemo(() => {
    const rand = mulberry32(count + 7);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(rand() - 0.5) * size[0], (rand() - 0.5) * size[1], (rand() - 0.5) * size[2]], i * 3);
      seed[i] = rand();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const mat = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uColor: { value: new Color(color) },
        uFade: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uPixelRatio; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.05 + aSeed * 40.0) * 0.6;
          p.y += sin(uTime * 0.07 + aSeed * 23.0) * 0.4 + uTime * 0.02 * (aSeed - 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.6 + aSeed * 1.6) * uPixelRatio * (14.0 / -mv.z);
          vA = 0.25 + 0.75 * fract(aSeed * 13.7);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * uFade * 0.55;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { g: geo, m: mat };
  }, [count, size, pixelRatio, color]);

  useEffect(
    () => () => {
      g.dispose();
      m.dispose();
    },
    [g, m],
  );

  useFrame(() => {
    m.uniforms.uTime!.value = frame.time;
    if (stationIndex !== undefined) m.uniforms.uFade!.value = 0.3 + 0.7 * (frame.presence[stationIndex] ?? 0);
  });

  return <points name={name} geometry={g} material={m} position={center} frustumCulled={false} />;
}

/** Aurora curtain at a horizon: vertical gradient with animated noise folds. */
export function Aurora({
  position,
  width,
  height,
  stationIndex,
  colorA = '#7ef7c9',
  colorB = '#52c7ea',
  strength = 1,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  stationIndex: number;
  colorA?: string;
  colorB?: string;
  strength?: number;
}) {
  const m = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uA: { value: new Color(colorA) },
          uB: { value: new Color(colorB) },
          uStrength: { value: 0 },
        },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uStrength; varying vec2 vUv;
          ${NOISE_GLSL}
          void main(){
            float folds = iu_fbm3(vec3(vUv.x * 5.0, vUv.y * 0.6, uTime * 0.04));
            float curtain = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.25, vUv.y);
            float rays = 0.6 + 0.4 * sin(vUv.x * 60.0 + folds * 12.0);
            float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
            float a = curtain * rays * smoothstep(0.35, 0.8, folds) * edge * uStrength * 0.45;
            vec3 c = mix(uB, uA, vUv.y + folds * 0.3);
            gl_FragColor = vec4(c * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        fog: false,
      }),
    [colorA, colorB],
  );
  useEffect(() => () => m.dispose(), [m]);
  useFrame(() => {
    m.uniforms.uTime!.value = frame.time;
    m.uniforms.uStrength!.value = (0.35 + 0.65 * (frame.presence[stationIndex] ?? 0)) * strength;
  });
  return (
    <mesh material={m} position={position}>
      <planeGeometry args={[width, height, 1, 1]} />
    </mesh>
  );
}

/** Ultra-subtle data streams behind the capability panels (spec S6, high tier only). */
export function DataStreams({ center, stationIndex, pixelRatio }: { center: [number, number, number]; stationIndex: number; pixelRatio: number }) {
  const { g, m } = useMemo(() => {
    const streams = 7;
    const per = 140;
    const rand = mulberry32(91);
    const pos = new Float32Array(streams * per * 3);
    const t = new Float32Array(streams * per);
    const lane = new Float32Array(streams * per);
    for (let s = 0; s < streams; s++) {
      for (let i = 0; i < per; i++) {
        const k = s * per + i;
        t[k] = i / per + rand() * 0.004;
        lane[k] = s + rand() * 0.2;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('aT', new BufferAttribute(t, 1));
    geo.setAttribute('aLane', new BufferAttribute(lane, 1));
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aT; attribute float aLane; uniform float uTime; uniform float uPixelRatio; varying float vA;
        void main(){
          float x = (fract(aT + uTime * (0.012 + aLane * 0.002)) - 0.5) * 44.0;
          float y = (aLane - 3.0) * 1.15 + sin(x * 0.16 + aLane * 1.7 + uTime * 0.2) * 0.6;
          float z = -2.0 - aLane * 0.7;
          vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = 1.4 * uPixelRatio * (12.0 / -mv.z);
          vA = smoothstep(0.0, 0.2, fract(aT * 9.0 - uTime * 0.3)) * smoothstep(22.0, 10.0, abs(x));
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * uFade * 0.5;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vec3(0.45, 0.95, 0.85) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { g: geo, m: mat };
  }, [pixelRatio]);
  useEffect(
    () => () => {
      g.dispose();
      m.dispose();
    },
    [g, m],
  );
  useFrame(() => {
    m.uniforms.uTime!.value = frame.time;
    m.uniforms.uFade!.value = frame.presence[stationIndex] ?? 0;
  });
  return <points geometry={g} material={m} position={center} frustumCulled={false} />;
}

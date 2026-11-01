'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { mulberry32 } from '../math/noise';
import { frame } from '../orchestrator/frame-state';

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.6 + aPhase * 1.7) + aPhase * 40.0);
    gl_PointSize = aSize * uPixelRatio * (0.85 + 0.3 * twinkle);
    vColor = aColor;
    vAlpha = twinkle * uFade;
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float a = pow(core, 2.4) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

function starColor(r: number): [number, number, number] {
  // Mostly cool white, some blue-cyan, a few violet and warm.
  if (r < 0.62) return [0.92, 0.95, 1.0];
  if (r < 0.82) return [0.72, 0.86, 1.0];
  if (r < 0.94) return [0.78, 0.74, 1.0];
  return [1.0, 0.9, 0.78];
}

function buildShell(count: number, seed: number) {
  const rand = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const t = rand() * Math.PI * 2;
    const r = 380 + rand() * 60;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(t) * s * r, u * r, Math.sin(t) * s * r], i * 3);
    const big = rand();
    size[i] = big > 0.985 ? 3.4 + rand() * 1.6 : big > 0.9 ? 2.0 + rand() : 0.9 + rand() * 1.1;
    phase[i] = rand();
    color.set(starColor(rand()), i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  g.setAttribute('aPhase', new BufferAttribute(phase, 1));
  g.setAttribute('aColor', new BufferAttribute(color, 3));
  return g;
}

/** Near star volume along the descent: real parallax as the camera travels the world. */
function buildVolume(count: number, seed: number) {
  const rand = mulberry32(seed);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const color = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos.set([(rand() - 0.5) * 160, 18 - rand() * 120, -30 - rand() * 120], i * 3);
    size[i] = 0.8 + rand() * 1.6;
    phase[i] = rand();
    color.set(starColor(rand()), i * 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  g.setAttribute('aPhase', new BufferAttribute(phase, 1));
  g.setAttribute('aColor', new BufferAttribute(color, 3));
  return g;
}

function makeMaterial(pixelRatio: number) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 0 } },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
}

export function Starfield({ count, pixelRatio }: { count: number; pixelRatio: number }) {
  const shellRef = useRef<Points>(null);
  const shell = useMemo(() => buildShell(Math.round(count * 0.7), 11), [count]);
  const volume = useMemo(() => buildVolume(Math.round(count * 0.3), 23), [count]);
  const shellMat = useMemo(() => makeMaterial(pixelRatio), [pixelRatio]);
  const volMat = useMemo(() => makeMaterial(pixelRatio), [pixelRatio]);

  useEffect(
    () => () => {
      shell.dispose();
      volume.dispose();
      shellMat.dispose();
      volMat.dispose();
    },
    [shell, volume, shellMat, volMat],
  );

  useFrame(({ camera }, dt) => {
    shellRef.current?.position.copy(camera.position);
    const fadeTarget = 1;
    for (const m of [shellMat, volMat]) {
      m.uniforms.uTime!.value = frame.time;
      const f = m.uniforms.uFade!.value as number;
      m.uniforms.uFade!.value = f + (fadeTarget - f) * Math.min(1, dt * 1.5);
    }
  });

  return (
    <>
      <points ref={shellRef} geometry={shell} material={shellMat} frustumCulled={false} renderOrder={-900} />
      <points geometry={volume} material={volMat} frustumCulled={false} renderOrder={-800} />
    </>
  );
}

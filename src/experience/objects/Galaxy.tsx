'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three';
import { mulberry32 } from '../math/noise';
import { frame } from '../orchestrator/frame-state';

/** Spiral-arm point distribution (deterministic). Exported for tests. */
export function buildGalaxyAttributes(count: number, radius: number, seed = 5) {
  const rand = mulberry32(seed);
  const arms = 4;
  const spin = 1.15;
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const scale = new Float32Array(count);
  const inner = new Color('#fff3ff');
  const mid = new Color('#a596ff');
  const outer = new Color('#4fc4ea');
  const c = new Color();
  const gauss = () => {
    // Box–Muller
    const u = Math.max(1e-6, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let i = 0; i < count; i++) {
    const r = Math.pow(rand(), 1.65) * radius;
    const arm = ((i % arms) / arms) * Math.PI * 2;
    const spread = 0.32 * (1 - (r / radius) * 0.45) + 0.04;
    const angle = arm + r * spin + gauss() * spread;
    const scatter = (0.08 + 0.55 * (1 - r / radius)) * 0.6;
    const x = Math.cos(angle) * r + gauss() * scatter;
    const z = Math.sin(angle) * r + gauss() * scatter;
    const y = gauss() * (0.06 + 0.42 * Math.exp(-r * 0.9));
    position.set([x, y, z], i * 3);
    const t = r / radius;
    if (t < 0.35) c.copy(inner).lerp(mid, t / 0.35);
    else c.copy(mid).lerp(outer, (t - 0.35) / 0.65);
    c.offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.12);
    const bright = r < 0.7 ? 1.6 : 1;
    color.set([c.r * bright, c.g * bright, c.b * bright], i * 3);
    scale[i] = rand() < 0.03 ? 2.4 + rand() * 1.4 : 0.55 + rand() * 0.9;
  }
  return { position, color, scale };
}

const VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aScale;
  uniform float uTime;
  uniform float uSize;
  uniform float uFade;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float dist = length(position.xz);
    float ang = atan(position.z, position.x);
    ang -= uTime * 0.11 / max(dist, 0.35);          // differential rotation (inner faster)
    vec3 p = vec3(cos(ang) * dist, position.y, sin(ang) * dist);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * (11.0 / -mv.z);
    vColor = aColor;
    vFade = uFade;
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.2) * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function Galaxy({ count, radius, pixelRatio }: { count: number; radius: number; pixelRatio: number }) {
  const { geometry, material, bulge } = useMemo(() => {
    const attrs = buildGalaxyAttributes(count, radius);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(attrs.position, 3));
    g.setAttribute('aColor', new BufferAttribute(attrs.color, 3));
    g.setAttribute('aScale', new BufferAttribute(attrs.scale, 1));
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 1.6 * pixelRatio }, uFade: { value: 0 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const b = new ShaderMaterial({
      uniforms: { uIntensity: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uIntensity; varying vec2 vUv;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          float g = exp(-d * d * 7.0) * 1.1 + exp(-d * 18.0) * 2.2;
          vec3 c = mix(vec3(0.55, 0.45, 1.0), vec3(1.0, 0.95, 1.0), exp(-d * 6.0));
          gl_FragColor = vec4(c * g * uIntensity, g * uIntensity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { geometry: g, material: m, bulge: b };
  }, [count, radius, pixelRatio]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      bulge.dispose();
    },
    [geometry, material, bulge],
  );

  useFrame(() => {
    const p = Math.max(
      frame.presence[2] ?? 0,
      (frame.presence[1] ?? 0) * 0.6,
      (frame.presence[3] ?? 0) * 0.5,
    );
    material.uniforms.uTime!.value = frame.time;
    material.uniforms.uFade!.value = 0.25 + 0.75 * p;
    bulge.uniforms.uIntensity!.value = 0.22 + 0.48 * p;
  });

  return (
    <group>
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh material={bulge} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[radius * 0.9, radius * 0.9]} />
      </mesh>
      <mesh material={bulge} scale={[0.55, 0.55, 0.55]}>
        <planeGeometry args={[radius * 0.9, radius * 0.9]} />
      </mesh>
    </group>
  );
}

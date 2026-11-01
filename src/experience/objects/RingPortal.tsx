'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from 'three';
import { NOISE_GLSL } from '../shaders/noise';
import { frame } from '../orchestrator/frame-state';

/**
 * Monumental ring portal (spec S8): segmented dark-metal blocks with emissive seams around a
 * swirling energy disc. Original design — a generic ring gate, not any franchise prop.
 */
export function RingPortal({
  radius,
  stationIndex,
  intensity = 1,
}: {
  radius: number;
  stationIndex: number;
  intensity?: number;
}) {
  const blocksRef = useRef<InstancedMesh>(null);
  const seamsRef = useRef<InstancedMesh>(null);
  const count = 40;

  const mats = useMemo(
    () => ({
      block: new MeshStandardMaterial({
        color: '#151b22',
        metalness: 0.75,
        roughness: 0.48,
        envMapIntensity: 0.7,
      }),
      seam: new MeshStandardMaterial({
        color: '#000',
        emissive: new Color('#52c7ea'),
        emissiveIntensity: 2.6,
        toneMapped: false,
      }),
      disc: new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uIntensity; varying vec2 vUv;
          ${NOISE_GLSL}
          void main(){
            vec2 p = vUv - 0.5;
            float r = length(p) * 2.0;
            float a = atan(p.y, p.x);
            float swirl = iu_fbm3(vec3(cos(a) * 1.6, sin(a) * 1.6, r * 3.0 - uTime * 0.35) + vec3(a * 0.15, 0.0, 0.0));
            float rings = 0.5 + 0.5 * sin(r * 26.0 - uTime * 1.4 + swirl * 6.0);
            float edge = smoothstep(1.0, 0.82, r);
            float center = smoothstep(0.0, 0.55, r);
            vec3 deep = vec3(0.02, 0.09, 0.12);
            vec3 glow = vec3(0.32, 0.86, 0.98);
            vec3 col = mix(deep, glow, swirl * 0.8 + rings * 0.18) * (0.35 + center * 0.9);
            col += glow * smoothstep(0.86, 0.98, r) * 2.2;
            float alpha = edge * (0.65 + 0.35 * swirl);
            gl_FragColor = vec4(col * uIntensity * alpha, alpha);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        toneMapped: false,
      }),
    }),
    [],
  );

  useLayoutEffect(() => {
    const blocks = blocksRef.current;
    const seams = seamsRef.current;
    if (!blocks || !seams) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = radius + 0.55;
      o.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      o.rotation.set(0, 0, a);
      const chunky = i % 5 === 0 ? 1.25 : 1;
      o.scale.set(1.0 * chunky, ((Math.PI * 2 * r) / count) * 0.86, 0.95 * chunky);
      o.updateMatrix();
      blocks.setMatrixAt(i, o.matrix);
      o.position.set(Math.cos(a) * (radius + 0.06), Math.sin(a) * (radius + 0.06), 0.2);
      o.scale.set(0.05, ((Math.PI * 2 * radius) / count) * 0.5, 0.05);
      o.updateMatrix();
      seams.setMatrixAt(i, o.matrix);
    }
    blocks.instanceMatrix.needsUpdate = true;
    seams.instanceMatrix.needsUpdate = true;
  }, [radius]);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  useFrame(() => {
    const p = frame.presence[stationIndex] ?? 0;
    mats.disc.uniforms.uTime!.value = frame.time;
    mats.disc.uniforms.uIntensity!.value = (0.45 + 0.75 * p) * intensity;
    mats.seam.emissiveIntensity = (1.4 + 1.6 * p) * intensity;
  });

  return (
    <group>
      <instancedMesh ref={blocksRef} args={[undefined, mats.block, count]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh ref={seamsRef} args={[undefined, mats.seam, count]}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <mesh material={mats.disc}>
        <circleGeometry args={[radius, 96]} />
      </mesh>
    </group>
  );
}

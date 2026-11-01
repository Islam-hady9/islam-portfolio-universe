'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BackSide, Color, ShaderMaterial, Vector3 } from 'three';
import { NOISE_GLSL } from '../shaders/noise';
import { frame } from '../orchestrator/frame-state';

interface PlanetProps {
  position: [number, number, number];
  radius: number;
  /** World-space direction toward the light. */
  lightDir: [number, number, number];
  surfaceA?: string;
  surfaceB?: string;
  atmosphere?: string;
  atmosphereStrength?: number;
  seed?: number;
  rotationSpeed?: number;
  segments?: number;
  /** Dim to a dark silhouette when this station is not in view (avoids popping/clutter). */
  fadeStation?: number;
  name?: string;
}

/**
 * Procedural planet: banded fbm surface, soft terminator, fresnel limb and an additive outer
 * atmosphere shell. Emissive limb values exceed 1.0 so the bloom pass picks them up.
 */
export function Planet({
  position,
  radius,
  lightDir,
  surfaceA = '#0b1218',
  surfaceB = '#2b3a44',
  atmosphere = '#52c7ea',
  atmosphereStrength = 1,
  seed = 1,
  rotationSpeed = 0.004,
  segments = 96,
  fadeStation,
  name,
}: PlanetProps) {
  const [lx, ly, lz] = lightDir;
  const light = useMemo(() => new Vector3(lx, ly, lz).normalize(), [lx, ly, lz]);
  const surface = useMemo(
    () =>
      new ShaderMaterial({
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uLight: { value: light },
          uA: { value: new Color(surfaceA) },
          uB: { value: new Color(surfaceB) },
          uAtmo: { value: new Color(atmosphere) },
          uAtmoStrength: { value: atmosphereStrength },
          uSeed: { value: seed },
          uRot: { value: rotationSpeed },
          uFade: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vWorldN;
          varying vec3 vView;
          varying vec3 vLocal;
          void main() {
            vLocal = normalize(position);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldN = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uLight;
          uniform vec3 uA;
          uniform vec3 uB;
          uniform vec3 uAtmo;
          uniform float uAtmoStrength;
          uniform float uSeed;
          uniform float uRot;
          uniform float uFade;
          varying vec3 vWorldN;
          varying vec3 vView;
          varying vec3 vLocal;
          ${NOISE_GLSL}
          void main() {
            float a = uTime * uRot;
            vec3 p = vec3(cos(a) * vLocal.x - sin(a) * vLocal.z, vLocal.y, sin(a) * vLocal.x + cos(a) * vLocal.z);
            float bands = sin(p.y * 9.0 + iu_fbm3(p * 2.2 + uSeed) * 4.0) * 0.5 + 0.5;
            float detail = iu_fbm3(p * 5.0 + uSeed * 3.1);
            vec3 col = mix(uA, uB, smoothstep(0.25, 0.85, bands * 0.55 + detail * 0.6));
            vec3 n = normalize(vWorldN);
            float ndl = dot(n, uLight);
            float lit = smoothstep(-0.15, 0.55, ndl);
            col *= 0.06 + lit * 1.1;
            float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
            float limbLit = smoothstep(-0.35, 0.4, ndl);
            col += uAtmo * fres * limbLit * 1.9 * uAtmoStrength;
            gl_FragColor = vec4(col * uFade, 1.0);
          }
        `,
      }),
    [light, surfaceA, surfaceB, atmosphere, atmosphereStrength, seed, rotationSpeed],
  );

  const halo = useMemo(
    () =>
      new ShaderMaterial({
        fog: false,
        side: BackSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uLight: { value: light },
          uAtmo: { value: new Color(atmosphere) },
          uStrength: { value: atmosphereStrength },
          uFade: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vWorldN;
          varying vec3 vView;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldN = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uLight;
          uniform vec3 uAtmo;
          uniform float uStrength;
          uniform float uFade;
          varying vec3 vWorldN;
          varying vec3 vView;
          void main() {
            // Back faces of a shell 7.5% larger than the planet: the visible band outside the
            // limb spans -dot(n, v) in [0, ~0.37]. Peak at the limb, fade to the shell edge.
            vec3 n = normalize(vWorldN);
            vec3 v = normalize(vView);
            float x = clamp(-dot(n, v) / 0.37, 0.0, 1.0);
            float a = pow(x, 2.2);
            float lit = smoothstep(-0.25, 0.65, dot(n, uLight));
            a *= (0.06 + lit) * uStrength * uFade;
            gl_FragColor = vec4(uAtmo * 2.2, a);
          }
        `,
      }),
    [light, atmosphere, atmosphereStrength],
  );

  useEffect(
    () => () => {
      surface.dispose();
      halo.dispose();
    },
    [surface, halo],
  );

  useFrame(() => {
    surface.uniforms.uTime!.value = frame.time;
    if (fadeStation !== undefined) {
      const f = 0.1 + 0.9 * Math.min(1, (frame.presence[fadeStation] ?? 0) * 1.4);
      surface.uniforms.uFade!.value = f;
      halo.uniforms.uFade!.value = f;
    }
  });

  return (
    <group position={position} name={name}>
      <mesh material={surface}>
        <sphereGeometry args={[radius, segments, Math.round(segments * 0.66)]} />
      </mesh>
      <mesh material={halo} scale={1.075}>
        <sphereGeometry args={[radius, 64, 40]} />
      </mesh>
    </group>
  );
}

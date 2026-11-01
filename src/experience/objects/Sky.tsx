'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Color, Mesh, ShaderMaterial } from 'three';
import { NOISE_GLSL } from '../shaders/noise';
import { frame } from '../orchestrator/frame-state';

/**
 * Deep-space backdrop (spec §6.5): obsidian gradient, a restrained violet/teal nebula in the
 * upper right and a faint galactic band. Rendered on an inverted sphere that follows the
 * camera, so it behaves as if infinitely far away.
 */
export function Sky() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uBase: { value: new Color('#05070b') },
          uHorizon: { value: new Color('#0b1119') },
          uViolet: { value: new Color('#8b7cff') },
          uTeal: { value: new Color('#3fb6d6') },
          uNebula: { value: 1 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uBase;
          uniform vec3 uHorizon;
          uniform vec3 uViolet;
          uniform vec3 uTeal;
          uniform float uNebula;
          varying vec3 vDir;
          ${NOISE_GLSL}
          void main() {
            vec3 d = normalize(vDir);
            float h = smoothstep(-0.55, 0.35, d.y);
            vec3 col = mix(uHorizon, uBase, h);
            // Nebula: upper-right lobe (reference composition), soft fbm structure.
            float lobe = smoothstep(0.35, 0.95, dot(d, normalize(vec3(0.62, 0.48, -0.62))));
            float n = iu_fbm3(d * 3.1 + vec3(0.0, 0.0, uTime * 0.004));
            float wisps = smoothstep(0.42, 0.85, n) * lobe;
            // Two-tone nebula: violet wisps plus teal billows (reference palette), kept dim behind copy.
            // (A thin teal 'fringe' band on low fbm values was removed: it exposed a lattice-cell seam
            // of the value noise as a hard-edged disc at the universe station.)
            col += uViolet * wisps * 0.13 * uNebula;
            col += uTeal * smoothstep(0.55, 0.9, iu_fbm3_lo(d * 5.3 + 7.0)) * lobe * 0.09 * uNebula;
            // Faint galactic band.
            float bx = dot(d, normalize(vec3(0.25, 0.9, 0.35))) * 3.4; // x*x: pow() of a negative base is undefined in GLSL
            float band = exp(-bx * bx);
            col += vec3(0.55, 0.6, 0.75) * band * smoothstep(0.35, 0.75, iu_fbm3_lo(d * 6.0)) * 0.035;
            // Lower teal haze near the horizon (atmospheric depth).
            col += uTeal * smoothstep(0.1, -0.35, d.y) * 0.025;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );

  useFrame(({ camera }) => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(camera.position);
    material.uniforms.uTime!.value = frame.time;
    // Universe station: allow a touch more nebula; contact: calmer.
    const boost = 1 + (frame.presence[2] ?? 0) * 0.5 - (frame.presence[8] ?? 0) * 0.35;
    material.uniforms.uNebula!.value = boost;
  });

  return (
    <mesh ref={ref} name="sky" material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[500, 48, 32]} />
    </mesh>
  );
}

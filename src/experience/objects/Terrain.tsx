'use client';

import { useEffect, useMemo } from 'react';
import { BufferAttribute, Color, MeshStandardMaterial, PlaneGeometry } from 'three';
import { fbm2, ridged2 } from '../math/noise';
import { portalGlow } from './portal-glow';

export interface TerrainShape {
  width: number;
  depth: number;
  segments: number;
  seed: number;
  /** Height of ridges at the far edge (mountains). */
  farHeight: number;
  /** Height near the camera edge. */
  nearHeight: number;
  /** Horizontal frequency of features. */
  scale: number;
  /** Optional carved valley (lowered band) around x = valleyX. */
  valley?: { x: number; width: number; depth: number };
  /** Optional flat plateau region (e.g. where the explorer stands). */
  plateau?: { x: number; z: number; radius: number; height: number };
}

/** Seeded procedural terrain heights (deterministic). Exported for tests. */
export function buildTerrainGeometry(shape: TerrainShape): PlaneGeometry {
  const g = new PlaneGeometry(
    shape.width,
    shape.depth,
    shape.segments,
    Math.round(shape.segments * (shape.depth / shape.width)),
  );
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // t: 0 at the near edge (+depth/2) → 1 at the far edge (-depth/2)
    const t = 1 - (z / shape.depth + 0.5);
    const ridge = ridged2(x * shape.scale, z * shape.scale, shape.seed);
    const base = fbm2(x * shape.scale * 0.5 + 10, z * shape.scale * 0.5, shape.seed + 5);
    const amp = shape.nearHeight + (shape.farHeight - shape.nearHeight) * Math.pow(t, 1.35);
    let h = (ridge * 0.75 + base * 0.45) * amp;
    if (shape.valley) {
      const v = Math.exp(-Math.pow((x - shape.valley.x) / shape.valley.width, 2));
      h -= v * shape.valley.depth * (0.4 + t * 0.6);
    }
    if (shape.plateau) {
      const d = Math.hypot(x - shape.plateau.x, z - shape.plateau.z) / shape.plateau.radius;
      const k = Math.max(0, 1 - d * d);
      h = h * (1 - k) + shape.plateau.height * k;
    }
    pos.setY(i, h);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  // Mineral tone variation (about ±12 %, low frequency) with slightly paler ridges, so the
  // faceted rock reads as material rather than one flat grey. Multiplies the material colour.
  const tone = new Float32Array(pos.count * 3);
  const amp = Math.max(1e-3, shape.farHeight);
  for (let i = 0; i < pos.count; i++) {
    const n = fbm2(pos.getX(i) * 0.11 + 31, pos.getZ(i) * 0.11 - 7, shape.seed + 11);
    const k = 0.88 + 0.24 * n + 0.1 * Math.min(1, Math.max(0, pos.getY(i) / amp));
    tone[i * 3] = k * 0.98;
    tone[i * 3 + 1] = k;
    tone[i * 3 + 2] = k * 1.03;
  }
  g.setAttribute('color', new BufferAttribute(tone, 3));
  return g;
}

/**
 * Faceted, near-black rock with a view-dependent rim term injected into the standard
 * material, so ridgelines catch cold light like the reference's silhouetted terrain.
 * Distance haze gives atmospheric perspective; terrain the portal stands on (`spill`) also
 * receives the portal's light pool and contact glow through the shared uniforms.
 */
export function Terrain({
  shape,
  position,
  rimColor = '#7fb8c9',
  rimStrength = 0.55,
  color = '#0b0e12',
  haze = '#0c1a21',
  spill = false,
  name,
}: {
  name?: string;
  shape: TerrainShape;
  position: [number, number, number];
  rimColor?: string;
  rimStrength?: number;
  color?: string;
  /** Atmospheric haze colour that far terrain fades toward. */
  haze?: string;
  /** Receives the portal's light spill (the terrain the portal stands on). */
  spill?: boolean;
}) {
  const geometry = useMemo(() => buildTerrainGeometry(shape), [shape]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.94,
      metalness: 0.12,
      flatShading: true,
      vertexColors: true,
      envMapIntensity: 0.12,
    });
    const rim = new Color(rimColor);
    const hazeColor = new Color(haze);
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: rim };
      shader.uniforms.uRimStrength = { value: rimStrength };
      shader.uniforms.uHaze = { value: hazeColor };
      // Shared uniform objects: the ring writes them; terrain away from the portal binds a zero.
      shader.uniforms.uSpill = spill ? portalGlow.strength : { value: 0 };
      shader.uniforms.uSpillPos = portalGlow.position;
      shader.uniforms.uSpillColor = portalGlow.color;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vIuWorld;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvIuWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uRimColor; uniform float uRimStrength; uniform vec3 uHaze;
           uniform float uSpill; uniform vec3 uSpillPos; uniform vec3 uSpillColor;
           varying vec3 vIuWorld;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float iuRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
           float iuUp = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
           totalEmissiveRadiance += uRimColor * iuRim * iuUp * uRimStrength;
           // Portal light: a wide pool falling forward from the ring and a tight contact glow
           // where the ring meets the ground. Uniform branch: skipped by every other terrain.
           if (uSpill > 0.0005) {
             vec3 iuS = vIuWorld - uSpillPos;
             float iuPool = exp(-(iuS.x * iuS.x * 0.05 + iuS.z * iuS.z * 0.09)) * smoothstep(-2.5, 1.5, iuS.z);
             float iuContact = exp(-(iuS.x * iuS.x * 0.42 + iuS.z * iuS.z * 2.6));
             totalEmissiveRadiance += uSpillColor * uSpill * iuUp * (iuPool * 0.1 + iuContact * 0.7);
           }`,
        )
        .replace(
          '#include <opaque_fragment>',
          `float iuHaze = 1.0 - exp(-max(length(vViewPosition) - 22.0, 0.0) * 0.011);
           outgoingLight = mix(outgoingLight, uHaze, iuHaze * 0.85);
           #include <opaque_fragment>`,
        );
    };
    m.customProgramCacheKey = () => `iu-terrain-rim-v3`;
    return m;
  }, [color, rimColor, rimStrength, haze, spill]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <mesh name={name} geometry={geometry} material={material} position={position} receiveShadow={false} />
  );
}

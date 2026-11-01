'use client';

import { useEffect, useMemo } from 'react';
import { BufferAttribute, Color, MeshStandardMaterial, PlaneGeometry } from 'three';
import { fbm2, ridged2 } from '../math/noise';

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
  const g = new PlaneGeometry(shape.width, shape.depth, shape.segments, Math.round(shape.segments * (shape.depth / shape.width)));
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
  return g;
}

/**
 * Faceted, near-black rock with a view-dependent rim term injected into the standard
 * material, so ridgelines catch cold light like the reference's silhouetted terrain.
 */
export function Terrain({
  shape,
  position,
  rimColor = '#7fb8c9',
  rimStrength = 0.55,
  color = '#0b0e12',
  name,
}: {
  name?: string;
  shape: TerrainShape;
  position: [number, number, number];
  rimColor?: string;
  rimStrength?: number;
  color?: string;
}) {
  const geometry = useMemo(() => buildTerrainGeometry(shape), [shape]);
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.94,
      metalness: 0.12,
      flatShading: true,
      envMapIntensity: 0.12,
    });
    const rim = new Color(rimColor);
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: rim };
      shader.uniforms.uRimStrength = { value: rimStrength };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float iuRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.5);
           float iuUp = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
           totalEmissiveRadiance += uRimColor * iuRim * iuUp * uRimStrength;`,
        );
    };
    m.customProgramCacheKey = () => `iu-terrain-rim`;
    return m;
  }, [color, rimColor, rimStrength]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <mesh name={name} geometry={geometry} material={material} position={position} receiveShadow={false} />;
}

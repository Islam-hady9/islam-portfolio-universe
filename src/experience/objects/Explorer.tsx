'use client';

import { useEffect, useMemo } from 'react';
import { BufferGeometry, CapsuleGeometry, MeshStandardMaterial, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Builds a simple standing human silhouette (~1.8 units) from primitives. */
export function buildExplorerGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const add = (g: BufferGeometry, x: number, y: number, z: number, rz = 0) => {
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    parts.push(g.toNonIndexed());
  };
  add(new CapsuleGeometry(0.075, 0.78, 4, 8), -0.1, 0.46, 0); // legs
  add(new CapsuleGeometry(0.075, 0.78, 4, 8), 0.1, 0.46, 0);
  add(new CapsuleGeometry(0.19, 0.46, 4, 10), 0, 1.16, 0); // torso
  add(new CapsuleGeometry(0.06, 0.58, 4, 8), -0.27, 1.12, 0, 0.1); // arms
  add(new CapsuleGeometry(0.06, 0.58, 4, 8), 0.27, 1.12, 0, -0.1);
  add(new SphereGeometry(0.11, 12, 10), 0, 1.66, 0); // head
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/** Backlit silhouette of a human-scale explorer (spec S8: "distant human-scale explorer"). */
export function Explorer({ position, scale = 1.25 }: { position: [number, number, number]; scale?: number }) {
  const geometry = useMemo(() => buildExplorerGeometry(), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#05070a', roughness: 0.85, metalness: 0.2, envMapIntensity: 0.2 }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return <mesh geometry={geometry} material={material} position={position} scale={scale} />;
}

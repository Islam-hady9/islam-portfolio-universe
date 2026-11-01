'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Euler, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { TierConfig } from '../quality/tiers';
import { frame } from '../orchestrator/frame-state';
import { mulberry32 } from '../math/noise';
import { buildShard } from '../objects/core/geometry';
import { Dust } from '../objects/Atmospherics';
import { Planet } from '../objects/Planet';

/**
 * Ambient world for inner pages (projects, case studies, about, contact): a distant planet
 * limb, slow tumbling debris and dust. Quiet by design — these pages are for reading.
 */
export function DeepSpaceWorld({ cfg, pixelRatio }: { cfg: TierConfig; pixelRatio: number }) {
  const ref = useRef<InstancedMesh>(null);
  const shard = useMemo(() => buildShard(9), []);
  const material = useMemo(
    () => new MeshStandardMaterial({ color: '#1a2129', metalness: 0.85, roughness: 0.4, envMapIntensity: 1 }),
    [],
  );
  const pieces = useMemo(() => {
    const rand = mulberry32(5);
    return Array.from({ length: Math.max(10, Math.round(cfg.fragments * 0.6)) }, () => ({
      base: new Vector3((rand() - 0.2) * 26, (rand() - 0.5) * 30, -6 - rand() * 22),
      size: 0.08 + Math.pow(rand(), 2) * 0.5,
      axis: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      speed: 0.05 + rand() * 0.2,
      bob: rand() * Math.PI * 2,
      tilt: new Euler(rand() * 3, rand() * 3, rand() * 3),
    }));
  }, [cfg.fragments]);

  useEffect(
    () => () => {
      shard.dispose();
      material.dispose();
    },
    [shard, material],
  );

  const m4 = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const q2 = useMemo(() => new Quaternion(), []);
  const v = useMemo(() => new Vector3(), []);
  const s = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = frame.time;
    const drift = frame.scrollY * 0.0016;
    pieces.forEach((p, i) => {
      v.set(p.base.x, p.base.y + Math.sin(t * 0.2 + p.bob) * 0.3 - drift * 0.4, p.base.z);
      q.setFromEuler(p.tilt);
      q2.setFromAxisAngle(p.axis, t * p.speed);
      q.multiply(q2);
      s.setScalar(p.size);
      m4.compose(v, q, s);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={ref} args={[shard, material, pieces.length]} frustumCulled={false} />
      <Planet
        position={[34, 9, -70]}
        radius={14}
        lightDir={[-0.8, 0.3, 0.5]}
        surfaceA="#091017"
        surfaceB="#2c3c48"
        atmosphere="#7ef7c9"
        atmosphereStrength={0.8}
        seed={14}
      />
      <Dust count={Math.round(cfg.dust * 0.7)} center={[0, 0, -6]} size={[40, 40, 24]} pixelRatio={pixelRatio} color="#9fb8d0" />
    </>
  );
}

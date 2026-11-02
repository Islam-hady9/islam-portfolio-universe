'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  type Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { frame } from '../orchestrator/frame-state';

/** Tapered limb between two points (radii r0 at a, r1 at b). */
function limb(a: Vector3, b: Vector3, r0: number, r1: number, radial = 9): BufferGeometry {
  const dir = new Vector3().subVectors(b, a);
  const length = dir.length();
  const g = new CylinderGeometry(r1, r0, length, radial, 1, false);
  g.translate(0, length / 2, 0);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** Joint cap so tapered limbs meet without seams. */
function joint(p: Vector3, r: number): BufferGeometry {
  const g = new SphereGeometry(r, 9, 7);
  g.translate(p.x, p.y, p.z);
  return g;
}

/**
 * A lone explorer in a tailored long coat (~1.8 units, feet at y = 0, facing −z). Adult
 * proportions (≈7.5 heads), a defined shoulder line, separated arms, a slight contrapposto
 * stance; deliberately faceless and unornamented — a silhouette, not a character.
 */
export function buildExplorerGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

  // Coat: lathe profile from the hem (at the knee) up through the waist to the shoulders,
  // flattened front-to-back. Bottom → top order keeps the faces pointing outward.
  const coatProfile = [
    [0.001, 0.545],
    [0.208, 0.545],
    [0.214, 0.56],
    [0.196, 0.7],
    [0.172, 0.88],
    [0.16, 1.02],
    [0.172, 1.12],
    [0.198, 1.3],
    [0.205, 1.42],
    [0.17, 1.465],
    [0.075, 1.5],
    [0.001, 1.47],
  ].map(([x, y]) => new Vector2(x, y));
  const coat = new LatheGeometry(coatProfile, 22);
  coat.scale(1, 1, 0.64);
  parts.push(coat);

  // Raised collar and neck.
  const collar = new CylinderGeometry(0.068, 0.092, 0.075, 14, 1, true);
  collar.scale(1, 1, 0.85);
  collar.translate(0, 1.515, 0.006);
  parts.push(collar);
  parts.push(limb(V(0, 1.49, 0), V(0, 1.6, -0.006), 0.046, 0.042, 10));

  // Head: slightly elongated, faceless.
  const head = new SphereGeometry(0.104, 16, 12);
  head.scale(0.9, 1.1, 0.96);
  head.translate(0, 1.685, -0.01);
  parts.push(head);

  // Legs below the hem: weight on the left leg, the right one slightly forward and relaxed.
  const legs: [Vector3, Vector3, Vector3][] = [
    [V(-0.085, 0.72, 0), V(-0.098, 0.42, 0.005), V(-0.105, 0.075, 0.01)],
    [V(0.085, 0.72, 0), V(0.112, 0.42, -0.03), V(0.128, 0.075, -0.05)],
  ];
  for (const [hip, knee, ankle] of legs) {
    parts.push(limb(hip, knee, 0.072, 0.056));
    parts.push(joint(knee, 0.056));
    parts.push(limb(knee, ankle, 0.056, 0.04));
    // Boot: a low wedge pointing forward (−z).
    const boot = new CylinderGeometry(0.045, 0.052, 0.085, 10);
    boot.scale(1, 1, 1.9);
    boot.translate(ankle.x, 0.0425, ankle.z - 0.045);
    parts.push(boot);
  }

  // Arms hang clear of the coat: shoulder → elbow → wrist, hands as small tapered ends.
  for (const side of [-1, 1]) {
    const shoulder = V(side * 0.2, 1.405, 0);
    const elbow = V(side * 0.245, 1.08, side < 0 ? 0.012 : -0.01);
    const wrist = V(side * 0.235, 0.79, side < 0 ? -0.02 : 0.015);
    parts.push(joint(shoulder, 0.06));
    parts.push(limb(shoulder, elbow, 0.058, 0.047));
    parts.push(joint(elbow, 0.047));
    parts.push(limb(elbow, wrist, 0.047, 0.036));
    parts.push(limb(wrist, V(wrist.x + side * 0.004, wrist.y - 0.11, wrist.z), 0.036, 0.022, 7));
  }

  // Keep each primitive's own smooth normals (no recompute across the merged parts).
  for (const p of parts)
    for (const key of Object.keys(p.attributes))
      if (key !== 'position' && key !== 'normal') p.deleteAttribute(key);
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

const RIM = new Color('#58d2f0');

/**
 * Backlit silhouette of a human-scale explorer (spec S8: "distant human-scale explorer").
 * A portal-facing rim light (view-space fresnel weighted toward the portal), restrained idle
 * breathing in the chest and a slow weight shift, and a contact shadow cast toward the camera
 * by the portal light behind the figure.
 */
export function Explorer({
  position,
  scale = 1.25,
  lightFrom,
}: {
  position: [number, number, number];
  scale?: number;
  /** World position of the light behind the figure (the portal), for the rim and shadow. */
  lightFrom?: [number, number, number];
}) {
  const geometry = useMemo(() => buildExplorerGeometry(), []);
  const groupRef = useRef<Group>(null);
  const uniforms = useMemo(
    () => ({
      uBreath: { value: 0 },
      uRim: { value: 0 },
      uRimColor: { value: RIM },
      uLightView: { value: new Vector3() },
    }),
    [],
  );
  const material = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: '#06080b',
      roughness: 0.72,
      metalness: 0.25,
      envMapIntensity: 0.35,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uBreath;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float iuChest = smoothstep(1.08, 1.3, position.y) * smoothstep(1.5, 1.32, position.y);
           transformed.xz *= 1.0 + uBreath * iuChest * 0.022;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;\nuniform vec3 uLightView;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           vec3 iuV = normalize(vViewPosition);
           vec3 iuL = normalize(uLightView + vViewPosition);
           float iuEdge = pow(1.0 - clamp(abs(dot(normal, iuV)), 0.0, 1.0), 2.4);
           float iuFacing = smoothstep(-0.15, 0.65, dot(normal, iuL));
           totalEmissiveRadiance += uRimColor * iuEdge * iuFacing * uRim;`,
        );
    };
    m.customProgramCacheKey = () => 'iu-explorer-rim';
    return m;
  }, [uniforms]);
  const shadow = useMemo(() => {
    const g = new CircleGeometry(1, 32);
    g.rotateX(-Math.PI / 2);
    const m = new ShaderMaterial({
      uniforms: { uStrength: { value: 0.7 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uStrength; varying vec2 vP;
        void main(){
          float d = length(vP);
          gl_FragColor = vec4(0.0, 0.0, 0.0, smoothstep(1.0, 0.15, d) * uStrength);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const streak = m.clone();
    streak.uniforms = { uStrength: { value: 0.42 } };
    return { g, m, streak };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      shadow.g.dispose();
      shadow.m.dispose();
      shadow.streak.dispose();
    },
    [geometry, material, shadow],
  );

  const tmp = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const t = frame.time;
    uniforms.uBreath.value = frame.reduced ? 0 : Math.sin(t * 1.55) * 0.5 + 0.5;
    // Rim follows the portal's energy (0 when the station is out of view).
    uniforms.uRim.value = 0.35 + 1.25 * (frame.portalEnergy ?? 0);
    if (lightFrom)
      uniforms.uLightView.value.copy(tmp.set(...lightFrom).applyMatrix4(camera.matrixWorldInverse));
    if (groupRef.current && !frame.reduced) {
      // Minimal posture shift: a slow sway of a fraction of a degree around the feet.
      groupRef.current.rotation.z = Math.sin(t * 0.23) * 0.004;
      groupRef.current.rotation.y = Math.sin(t * 0.17 + 1.1) * 0.02;
    }
  });

  // Contact shadow: a soft pool under the feet plus a streak cast toward the camera.
  return (
    <group position={position} scale={scale}>
      <group ref={groupRef}>
        <mesh geometry={geometry} material={material} />
      </group>
      <mesh geometry={shadow.g} material={shadow.m} position={[0, 0.012, 0.02]} scale={[0.34, 1, 0.3]} />
      {lightFrom ? (
        <mesh
          geometry={shadow.g}
          material={shadow.streak}
          position={[0.05, 0.011, 1.25]}
          scale={[0.36, 1, 1.35]}
        />
      ) : null}
    </group>
  );
}

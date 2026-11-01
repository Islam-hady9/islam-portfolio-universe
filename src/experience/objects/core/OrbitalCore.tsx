'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Euler,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import type { TierConfig } from '../../quality/tiers';
import { frame } from '../../orchestrator/frame-state';
import { NOISE_GLSL } from '../../shaders/noise';
import { mulberry32 } from '../../math/noise';
import { buildChannelRing, buildPlates, buildShard } from './geometry';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface RingDef {
  geometry: BufferGeometry;
  tilt: [number, number, number];
  spin: number;
  phase: number;
  clamps?: number;
  studs?: number;
  radius: number;
}

function chrome(physical: boolean): Material {
  return physical
    ? new MeshPhysicalMaterial({
        color: new Color('#d5dce3'),
        metalness: 1,
        roughness: 0.2,
        clearcoat: 0.65,
        clearcoatRoughness: 0.14,
        envMapIntensity: 1.55,
      })
    : new MeshStandardMaterial({
        color: new Color('#cfd6dd'),
        metalness: 1,
        roughness: 0.26,
        envMapIntensity: 1.4,
      });
}

function gunmetal(physical: boolean): Material {
  return physical
    ? new MeshPhysicalMaterial({
        color: new Color('#12171c'),
        metalness: 0.8,
        roughness: 0.46,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.55,
      })
    : new MeshStandardMaterial({
        color: new Color('#141a20'),
        metalness: 0.78,
        roughness: 0.5,
        envMapIntensity: 0.5,
      });
}

const EMITTER_VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const EMITTER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vN);
    float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.0);
    float f = iu_fbm3(vPos * 3.2 + vec3(0.0, uTime * 0.32, uTime * 0.18));
    float veins = smoothstep(0.08, 0.0, abs(iu_noise3(vPos * 6.5 + vec3(uTime * 0.25)) - 0.5));
    vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.8, f)) * (0.35 + f * 1.25);
    col += uColorB * veins * 0.9;
    col += uColorB * fres * 1.2;
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * d * 5.5) * 0.9 + exp(-d * 14.0) * 1.6;
    gl_FragColor = vec4(uColor * g * uIntensity, g * uIntensity);
  }
`;

const SPARK_VERTEX = /* glsl */ `
  attribute vec4 aOrbit;   // radius, speed, phase, inclination
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float a = aOrbit.z + uTime * aOrbit.y;
    float inc = aOrbit.w;
    vec3 p = vec3(cos(a) * aOrbit.x, sin(a * 1.7 + aOrbit.z) * 0.35, sin(a) * aOrbit.x);
    p = vec3(p.x, p.y * cos(inc) - p.z * sin(inc), p.y * sin(inc) + p.z * cos(inc));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float flicker = 0.55 + 0.45 * sin(uTime * (3.0 + aOrbit.y * 6.0) + aOrbit.z * 30.0);
    gl_PointSize = (1.2 + flicker * 1.6) * uPixelRatio * (9.0 / -mv.z);
    vTint = aTint;
    vAlpha = flicker * uFade;
  }
`;

const SPARK_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * a * 2.4, a);
  }
`;

/**
 * Hero "intelligence core" (spec S1, IU-003): real geometry, PBR chrome reflecting a procedural
 * light-former environment, HDR emitter for selective bloom, gimbal rings with distinct rates.
 */
export function OrbitalCore({ cfg, pixelRatio }: { cfg: TierConfig; pixelRatio: number }) {
  const root = useRef<Group>(null);
  const ringsRoot = useRef<Group>(null);
  const ringGroups = useRef<(Group | null)[]>([]);
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const shellRef = useRef<InstancedMesh>(null);
  const fragRef = useRef<InstancedMesh>(null);
  const circuitRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);

  const mats = useMemo(
    () => ({
      chrome: chrome(cfg.physicalMaterials),
      gunmetal: gunmetal(cfg.physicalMaterials),
      dark: new MeshStandardMaterial({
        color: '#12171d',
        metalness: 0.9,
        roughness: 0.42,
        envMapIntensity: 0.9,
      }),
      stud: new MeshStandardMaterial({
        color: '#000000',
        emissive: new Color('#52c7ea'),
        emissiveIntensity: 3.2,
        toneMapped: false,
      }),
      copper: new MeshStandardMaterial({
        color: '#000000',
        emissive: new Color('#ff9a5a'),
        emissiveIntensity: 2.4,
        toneMapped: false,
      }),
    }),
    [cfg.physicalMaterials],
  );

  // Oblique tilts → crossing diagonal ellipses (reference gyroscope), not face-on circles.
  const rings: RingDef[] = useMemo(
    () => [
      {
        geometry: buildChannelRing(2.78, 0.3, 0.2, 0.065, 0.06, 220),
        tilt: [0.52, 0.1, 0.58],
        spin: 0.085,
        phase: 0.2,
        clamps: 18,
        radius: 2.78,
      },
      {
        geometry: buildChannelRing(2.42, 0.24, 0.17, 0.055, 0.05, 200),
        tilt: [-0.62, 0.35, -0.42],
        spin: -0.12,
        phase: 1.3,
        studs: 24,
        radius: 2.42,
      },
      {
        geometry: new TorusGeometry(3.12, 0.028, 10, 260),
        tilt: [0.3, -0.2, -0.95],
        spin: 0.055,
        phase: 2.1,
        radius: 3.12,
      },
      {
        geometry: buildChannelRing(1.74, 0.13, 0.1, 0.034, 0.03, 160),
        tilt: [1.3, 0.3, 0.12],
        spin: 0.2,
        phase: 0.7,
        radius: 1.74,
      },
    ],
    [],
  );

  const plates = useMemo(() => buildPlates(1.04, 8, 7), []);
  const shard = useMemo(() => buildShard(3), []);

  const emitter = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uColorA: { value: new Color('#0c3a48') },
          uColorB: { value: new Color('#7ff6ff') },
        },
        vertexShader: EMITTER_VERTEX,
        fragmentShader: EMITTER_FRAGMENT,
        toneMapped: false,
      }),
    [],
  );

  const glow = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color('#52c7ea') }, uIntensity: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: GLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const circuitry = useMemo(() => {
    const g = new EdgesGeometry(new IcosahedronGeometry(0.84, 1));
    return g;
  }, []);
  const circuitMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uIntensity: { value: 0 } },
        vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform float uIntensity; void main(){ gl_FragColor = vec4(vec3(0.32, 0.86, 1.0) * 2.4 * uIntensity, 0.6 * uIntensity); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  // Sparks: shader-animated, no CPU updates.
  const sparks = useMemo(() => {
    const rand = mulberry32(19);
    const n = cfg.sparks;
    const orbit = new Float32Array(n * 4);
    const tint = new Float32Array(n * 3);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      orbit.set(
        [
          1.25 + rand() * 2.6,
          (0.05 + rand() * 0.22) * (rand() < 0.5 ? -1 : 1),
          rand() * Math.PI * 2,
          (rand() - 0.5) * 2.2,
        ],
        i * 4,
      );
      const warm = rand() < 0.22;
      tint.set(warm ? [1.0, 0.62, 0.35] : [0.45, 0.9, 1.0], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aOrbit', new BufferAttribute(orbit, 4));
    g.setAttribute('aTint', new BufferAttribute(tint, 3));
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: pixelRatio }, uFade: { value: 0 } },
      vertexShader: SPARK_VERTEX,
      fragmentShader: SPARK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { g, m };
  }, [cfg.sparks, pixelRatio]);

  // Fragment orbits (CPU — small count).
  const fragments = useMemo(() => {
    const rand = mulberry32(31);
    return Array.from({ length: cfg.fragments }, () => ({
      radius: 3.0 + rand() * 1.5,
      speed: (0.03 + rand() * 0.08) * (rand() < 0.5 ? -1 : 1),
      phase: rand() * Math.PI * 2,
      incl: new Euler((rand() - 0.5) * 1.4, rand() * Math.PI, (rand() - 0.5) * 0.9),
      size: 0.035 + Math.pow(rand(), 2.2) * 0.17,
      spin: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      spinSpeed: 0.2 + rand() * 0.8,
    }));
  }, [cfg.fragments]);

  // Static instancing: shell plates, clamps, studs.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const o = new Object3D();
    const c = new Color();
    plates.forEach((p, i) => {
      o.position.set(...p.position);
      o.lookAt(p.position[0] * 2, p.position[1] * 2, p.position[2] * 2);
      o.rotateZ(p.twist);
      o.scale.set(...p.size);
      o.updateMatrix();
      shell.setMatrixAt(i, o.matrix);
      c.setRGB(0.75 + p.shade * 0.35, 0.78 + p.shade * 0.3, 0.82 + p.shade * 0.3);
      shell.setColorAt(i, c);
    });
    shell.instanceMatrix.needsUpdate = true;
    if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
  }, [plates]);

  useEffect(
    () => () => {
      rings.forEach((r) => r.geometry.dispose());
      shard.dispose();
      circuitry.dispose();
      sparks.g.dispose();
      sparks.m.dispose();
      emitter.dispose();
      glow.dispose();
      circuitMat.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [rings, shard, circuitry, sparks, emitter, glow, circuitMat, mats],
  );

  const m4 = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const tmp = useMemo(() => ({ o: new Object3D(), v: new Vector3() }), []);

  useFrame(({ camera }) => {
    const t = frame.time;
    const heroP = frame.presence[0] ?? 0;
    const visible = frame.route === 'home' && frame.s < 2.4;
    if (root.current) root.current.visible = visible;
    if (!visible) {
      frame.coreEnergy = 0;
      return;
    }

    // Intro progression (owned here; read by the camera rig).
    const unfold = easeInOut(Math.min(1, frame.intro * 1.15));

    // Irregular, non-strobing pulse (sum of incommensurate sines).
    const pulse =
      1 + 0.1 * Math.sin(t * 1.7) + 0.07 * Math.sin(t * 2.93 + 1.3) + 0.05 * Math.sin(t * 0.61 + 4.0);
    const recede = 0.35 + 0.65 * heroP;
    const ignite = easeOutCubic(Math.min(1, frame.intro * 1.4));
    const energy = ignite * pulse * recede;

    emitter.uniforms.uTime!.value = t;
    emitter.uniforms.uIntensity!.value = 2.6 * energy;
    glow.uniforms.uIntensity!.value = 0.85 * energy;
    circuitMat.uniforms.uIntensity!.value = 0.9 * energy;
    sparks.m.uniforms.uTime!.value = t;
    sparks.m.uniforms.uFade!.value = ignite * recede;
    frame.coreEnergy = energy;

    // Gimbal: tilts unfold from a common plane; each ring spins at its own rate.
    rings.forEach((r, i) => {
      const g = ringGroups.current[i];
      const mesh = ringMeshes.current[i];
      if (!g || !mesh) return;
      // Independent slow precession per gimbal (distinct rates and phases).
      const wx = Math.sin(t * (0.09 + i * 0.023) + r.phase * 3.0) * 0.09;
      const wz = Math.cos(t * (0.07 + i * 0.031) + r.phase * 2.0) * 0.08;
      g.rotation.set(
        (r.tilt[0] + wx) * unfold,
        r.tilt[1] * unfold + t * 0.01 * (i % 2 ? -1 : 1),
        (r.tilt[2] + wz) * unfold,
      );
      mesh.rotation.y = r.phase + t * r.spin;
    });
    if (ringsRoot.current) {
      ringsRoot.current.rotation.y = Math.sin(t * 0.05) * 0.35 + t * 0.012;
      ringsRoot.current.rotation.x = Math.sin(t * 0.07 + 1.1) * 0.06;
      const s = 0.86 + 0.14 * unfold;
      ringsRoot.current.scale.setScalar(s);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.035;
      shellRef.current.rotation.x = Math.sin(t * 0.11) * 0.08;
    }
    if (circuitRef.current) {
      circuitRef.current.rotation.y = -t * 0.09;
      circuitRef.current.rotation.z = t * 0.05;
    }
    if (glowRef.current) glowRef.current.quaternion.copy(camera.quaternion);

    // Fragments.
    const fr = fragRef.current;
    if (fr) {
      fragments.forEach((f, i) => {
        const a = f.phase + t * f.speed;
        tmp.v
          .set(Math.cos(a) * f.radius, Math.sin(a * 2.0 + f.phase) * 0.25, Math.sin(a) * f.radius)
          .applyEuler(f.incl);
        q.setFromAxisAngle(f.spin, t * f.spinSpeed + f.phase);
        const s = f.size * (0.4 + 0.6 * ignite);
        m4.compose(tmp.v, q, tmp.o.scale.set(s, s, s));
        fr.setMatrixAt(i, m4);
      });
      fr.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={root}>
      <group ref={ringsRoot} name="core-rings">
        {rings.map((r, i) => (
          <group
            key={i}
            ref={(el) => {
              ringGroups.current[i] = el;
            }}
          >
            <mesh
              ref={(el) => {
                ringMeshes.current[i] = el;
              }}
              geometry={r.geometry}
              material={mats.chrome}
            >
              {r.clamps ? <RingClamps radius={r.radius} count={r.clamps} material={mats.dark} /> : null}
              {r.studs ? <RingStuds radius={r.radius} count={r.studs} material={mats.stud} /> : null}
            </mesh>
          </group>
        ))}
      </group>

      <instancedMesh
        ref={shellRef}
        name="core-shell"
        args={[undefined, undefined, plates.length]}
        material={mats.gunmetal}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>

      <mesh material={emitter} name="core-emitter">
        <sphereGeometry args={[0.6, 64, 48]} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.16, 24, 16]} />
        <meshBasicMaterial color={new Color(5, 7, 7)} toneMapped={false} />
      </mesh>
      <group ref={circuitRef}>
        <lineSegments geometry={circuitry} material={circuitMat} />
      </group>
      <mesh ref={glowRef} material={glow} renderOrder={5} name="core-glow">
        <planeGeometry args={[4.4, 4.4]} />
      </mesh>

      <instancedMesh
        ref={fragRef}
        name="core-fragments"
        args={[shard, mats.gunmetal, fragments.length]}
        frustumCulled={false}
      />
      <points name="core-sparks" geometry={sparks.g} material={sparks.m} frustumCulled={false} />
      <CopperSeeds material={mats.copper} />
    </group>
  );
}

/** Mechanical clamps around a ring's outer wall. */
function RingClamps({ radius, count, material }: { radius: number; count: number; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      o.position.set(Math.cos(a) * (radius + 0.1), 0, Math.sin(a) * (radius + 0.1));
      o.rotation.set(0, -a, 0);
      o.scale.set(0.06, 0.2, 0.2);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [radius, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, count]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/** Emissive studs in a ring channel (glow through bloom). */
function RingStuds({ radius, count, material }: { radius: number; count: number; material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      o.position.set(Math.cos(a) * radius, 0.0, Math.sin(a) * radius);
      o.rotation.set(0, -a, 0);
      o.scale.set(0.03, 0.03, i % 3 === 0 ? 0.16 : 0.07);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [radius, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, count]}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/** A few warm copper glints on the shell (reference's amber sparks). */
function CopperSeeds({ material }: { material: Material }) {
  const ref = useRef<InstancedMesh>(null);
  const count = 14;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const rand = mulberry32(77);
    const o = new Object3D();
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const r = 1.1;
      o.position.set(Math.cos(th) * s * r, u * r, Math.sin(th) * s * r);
      o.scale.setScalar(0.012 + rand() * 0.02);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, material, count]}>
      <sphereGeometry args={[1, 8, 6]} />
    </instancedMesh>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TierConfig } from '../../quality/tiers';
import { frame } from '../../orchestrator/frame-state';
import { mulberry32 } from '../../math/noise';
import { buildRingSolid, buildShard, buildShellPanels, type RingSolidSpec } from './geometry';
import { createCoreMaterials } from './materials';
import {
  AURA_FRAGMENT,
  CIRCUIT_FRAGMENT,
  EMITTER_VERTEX,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  SPARK_FRAGMENT,
  SPARK_VERTEX,
} from './shaders';

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TURN = Math.PI * 2;

interface RingDef {
  spec: RingSolidSpec;
  geometry: BufferGeometry;
  /** Gimbal tilt (unfolds from a common plane during the intro). */
  tilt: [number, number, number];
  spin: number;
  phase: number;
  /** Bearing carriages riding the ring at their own rate (secondary orbital components). */
  carriages?: { count: number; speed: number; geometry: BufferGeometry };
  ticks?: number;
  studs?: number;
}

/** Collar that wraps a ring profile over a short arc — a machined carriage. */
function collarFor(spec: RingSolidSpec): BufferGeometry {
  return buildRingSolid({
    radius: spec.radius,
    width: spec.width + 0.07,
    height: spec.height + 0.07,
    chamfer: 0.02,
    segments: 64,
    arc: { start: -0.05, length: 0.1 },
  });
}

/**
 * Hero "intelligence core" (spec S1, IU-003): precision-machined gimbal rings (chamfered chrome
 * with a brushed channel, panel seams, pivots, riding carriages, a dial ring), a fractured
 * two-layer armour shell and a layered emitter (circuit sphere, plasma aura, hot core). PBR
 * materials reflect the procedural environment; only emissive details exceed 1.0 for bloom.
 */
export function OrbitalCore({ cfg, pixelRatio }: { cfg: TierConfig; pixelRatio: number }) {
  const detail = cfg.coreDetail;
  const root = useRef<Group>(null);
  const ringsRoot = useRef<Group>(null);
  const ringGroups = useRef<(Group | null)[]>([]);
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const carriageRefs = useRef<(InstancedMesh | null)[]>([]);
  const shellRef = useRef<Mesh>(null);
  const fragRef = useRef<InstancedMesh>(null);
  const emitterRef = useRef<Group>(null);
  const glowRef = useRef<Mesh>(null);
  const lean = useRef({ x: 0, z: 0 });

  const mats = useMemo(() => createCoreMaterials(cfg.physicalMaterials), [cfg.physicalMaterials]);

  // Oblique tilts → crossing diagonal ellipses (reference gyroscope), never face-on circles.
  const rings: RingDef[] = useMemo(() => {
    const seg = detail >= 2 ? 1 : detail === 1 ? 0.75 : 0.5;
    const seams = detail >= 1;
    const a: RingSolidSpec = {
      radius: 2.86,
      width: 0.34,
      height: 0.25,
      chamfer: 0.03,
      channel: { lip: 0.08, floor: 0.08 },
      segments: Math.round(300 * seg),
      seams: seams ? 12 : 0,
      seamGap: 0.014,
      pivots: { count: 2, radius: 0.085, length: 0.2, phase: 0.3 },
    };
    const b: RingSolidSpec = {
      radius: 2.4,
      width: 0.27,
      height: 0.21,
      chamfer: 0.026,
      channel: { lip: 0.066, floor: 0.066 },
      segments: Math.round(260 * seg),
      seams: seams ? 10 : 0,
      seamGap: 0.014,
      pivots: { count: 2, radius: 0.07, length: 0.16, phase: 1.2 },
    };
    const c: RingSolidSpec = {
      radius: 3.24,
      width: 0.05,
      height: 0.05,
      chamfer: 0.012,
      segments: Math.round(320 * seg),
    };
    const d: RingSolidSpec = {
      radius: 1.72,
      width: 0.13,
      height: 0.11,
      chamfer: 0.016,
      channel: { lip: 0.034, floor: 0.03 },
      segments: Math.round(180 * seg),
    };
    const withCarriages = detail >= 1;
    const tangents = cfg.physicalMaterials;
    const build = (spec: RingSolidSpec) => {
      const g = buildRingSolid(spec);
      if (tangents && g.index) g.computeTangents(); // anisotropic brushed metal follows the sweep
      return g;
    };
    return [
      {
        spec: a,
        geometry: build(a),
        tilt: [0.52, 0.1, 0.58],
        spin: 0.055,
        phase: 0.2,
        carriages: withCarriages ? { count: 3, speed: -0.11, geometry: collarFor(a) } : undefined,
      },
      {
        spec: b,
        geometry: build(b),
        tilt: [-0.62, 0.35, -0.42],
        spin: -0.08,
        phase: 1.3,
        carriages: withCarriages ? { count: 2, speed: 0.15, geometry: collarFor(b) } : undefined,
      },
      {
        spec: c,
        geometry: build(c),
        tilt: [0.95, -0.35, -0.6],
        spin: 0.03,
        phase: 2.1,
        ticks: detail >= 1 ? 120 : 0,
      },
      { spec: d, geometry: build(d), tilt: [1.3, 0.3, 0.12], spin: 0.16, phase: 0.7, studs: 12 },
    ];
  }, [detail, cfg.physicalMaterials]);

  // Fractured armour: dense inner shell + sparse lifted outer plates (layered depth).
  const shell = useMemo(() => {
    const inner = buildShellPanels({
      radius: 0.98,
      thickness: 0.065,
      bands: detail >= 2 ? 9 : 8,
      keep: 0.72,
      gap: 0.06,
      liftShare: 0.14,
      lift: 0.16,
      copperShare: 0.1,
      subdiv: detail >= 2 ? 3 : 2,
      polar: 0.16,
      seed: 7,
    });
    if (detail < 1) return { geometry: inner.geometry, panels: inner.panels };
    const outer = buildShellPanels({
      radius: 1.24,
      thickness: 0.05,
      bands: detail >= 2 ? 7 : 6,
      keep: 0.4,
      gap: 0.075,
      liftShare: 0.3,
      lift: 0.22,
      copperShare: 0.12,
      subdiv: 2,
      polar: 0.28,
      seed: 21,
    });
    const merged = mergeGeometries([inner.geometry, outer.geometry], false);
    inner.geometry.dispose();
    outer.geometry.dispose();
    if (!merged) throw new Error('shell merge failed');
    return { geometry: merged, panels: inner.panels + outer.panels };
  }, [detail]);

  const shard = useMemo(() => buildShard(3), []);
  const tickGeometry = useMemo(() => new BoxGeometry(1, 1, 1), []);

  const emitter = useMemo(() => {
    const circuit = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uBase: { value: new Color('#05202a') },
        uTrace: { value: new Color('#3fcfee') },
        uHot: { value: new Color('#dcfbff') },
      },
      vertexShader: EMITTER_VERTEX,
      fragmentShader: CIRCUIT_FRAGMENT,
      toneMapped: false,
    });
    const aura = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uColor: { value: new Color('#42c8ea') } },
      vertexShader: EMITTER_VERTEX,
      fragmentShader: AURA_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const glow = new ShaderMaterial({
      uniforms: { uColor: { value: new Color('#52c7ea') }, uIntensity: { value: 0 } },
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const hot = new MeshBasicMaterial({ color: new Color(0, 0, 0), toneMapped: false });
    const seg = detail >= 2 ? [72, 54] : detail === 1 ? [64, 48] : [48, 36];
    const geos = {
      circuit: new SphereGeometry(0.64, seg[0], seg[1]),
      aura: new SphereGeometry(0.8, 48, 36),
      hot: new SphereGeometry(0.15, 24, 16),
    };
    return { circuit, aura, glow, hot, geos };
  }, [detail]);

  // Sparks: shader-animated, no CPU updates.
  const sparks = useMemo(() => {
    const rand = mulberry32(19);
    const n = cfg.sparks;
    const orbit = new Float32Array(n * 4);
    const tint = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      orbit.set(
        [
          1.35 + rand() * 2.5,
          (0.05 + rand() * 0.2) * (rand() < 0.5 ? -1 : 1),
          rand() * TURN,
          (rand() - 0.5) * 2.2,
        ],
        i * 4,
      );
      tint.set(rand() < 0.2 ? [1.0, 0.62, 0.35] : [0.45, 0.9, 1.0], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
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

  // Sparse debris (CPU-animated, small count).
  const fragments = useMemo(() => {
    const rand = mulberry32(31);
    return Array.from({ length: cfg.fragments }, () => ({
      radius: 3.1 + rand() * 1.5,
      speed: (0.03 + rand() * 0.07) * (rand() < 0.5 ? -1 : 1),
      phase: rand() * TURN,
      incl: new Euler((rand() - 0.5) * 1.4, rand() * Math.PI, (rand() - 0.5) * 0.9),
      size: 0.03 + Math.pow(rand(), 2.4) * 0.15,
      spin: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
      spinSpeed: 0.2 + rand() * 0.7,
    }));
  }, [cfg.fragments]);

  useEffect(
    () => () => {
      rings.forEach((r) => {
        r.geometry.dispose();
        r.carriages?.geometry.dispose();
      });
      shell.geometry.dispose();
      shard.dispose();
      tickGeometry.dispose();
      Object.values(emitter.geos).forEach((g) => g.dispose());
      [emitter.circuit, emitter.aura, emitter.glow, emitter.hot].forEach((m) => m.dispose());
      sparks.g.dispose();
      sparks.m.dispose();
      mats.all.forEach((m) => m.dispose());
    },
    [rings, shell, shard, tickGeometry, emitter, sparks, mats],
  );

  const m4 = useMemo(() => new Matrix4(), []);
  const q = useMemo(() => new Quaternion(), []);
  const tmp = useMemo(
    () => ({ o: new Object3D(), v: new Vector3(), s: new Vector3(), y: new Vector3(0, 1, 0) }),
    [],
  );

  useFrame(({ camera }, dt) => {
    const t = frame.time;
    const heroP = frame.presence[0] ?? 0;
    const visible = frame.route === 'home' && frame.s < 2.4;
    if (root.current) root.current.visible = visible;
    if (!visible) {
      frame.coreEnergy = 0;
      return;
    }

    // Intro: gimbals unfold from a common plane, the shell assembles, the emitter ignites.
    const unfold = easeInOut(Math.min(1, frame.intro * 1.15));
    const ignite = easeOutCubic(Math.min(1, frame.intro * 1.4));
    // Irregular, non-strobing pulse (sum of incommensurate sines).
    const pulse =
      1 + 0.09 * Math.sin(t * 1.7) + 0.06 * Math.sin(t * 2.93 + 1.3) + 0.05 * Math.sin(t * 0.61 + 4.0);
    const recede = 0.35 + 0.65 * heroP;
    const energy = ignite * pulse * recede;
    frame.coreEnergy = energy;

    emitter.circuit.uniforms.uTime!.value = t;
    emitter.circuit.uniforms.uIntensity!.value = 1.9 * energy;
    emitter.aura.uniforms.uTime!.value = t;
    emitter.aura.uniforms.uIntensity!.value = 1.4 * energy;
    emitter.glow.uniforms.uIntensity!.value = 0.85 * energy;
    emitter.hot.color.setRGB(4.6 * energy, 6.4 * energy, 6.6 * energy);
    sparks.m.uniforms.uTime!.value = t;
    sparks.m.uniforms.uFade!.value = ignite * recede;
    mats.shellUniforms.uTime.value = t;
    mats.shellUniforms.uOpen.value = (1 - unfold) * 0.85;
    mats.shellUniforms.uCopper.value = 2.1 * energy;

    // Gimbals: distinct slow precession per ring; each ring spins in its own plane.
    rings.forEach((r, i) => {
      const g = ringGroups.current[i];
      const mesh = ringMeshes.current[i];
      if (!g || !mesh) return;
      const wx = Math.sin(t * (0.09 + i * 0.023) + r.phase * 3.0) * 0.08;
      const wz = Math.cos(t * (0.07 + i * 0.031) + r.phase * 2.0) * 0.07;
      g.rotation.set(
        (r.tilt[0] + wx) * unfold,
        r.tilt[1] * unfold + t * 0.01 * (i % 2 ? -1 : 1),
        (r.tilt[2] + wz) * unfold,
      );
      mesh.rotation.y = r.phase + t * r.spin;
      const carriages = carriageRefs.current[i];
      if (carriages && r.carriages) {
        for (let k = 0; k < r.carriages.count; k++) {
          const angle = r.phase + (k / r.carriages.count) * TURN + t * r.carriages.speed;
          q.setFromAxisAngle(tmp.y, angle);
          m4.compose(tmp.v.set(0, 0, 0), q, tmp.s.set(1, 1, 1));
          carriages.setMatrixAt(k, m4);
        }
        carriages.instanceMatrix.needsUpdate = true;
      }
    });

    // Pointer lean: the gimbal assembly lags the pointer slightly (inertia), ≤ ~3°.
    const k = 1 - Math.exp(-2.4 * Math.min(dt, 0.1));
    lean.current.x += (-frame.pointer.sy * 0.05 - lean.current.x) * k;
    lean.current.z += (frame.pointer.sx * 0.045 - lean.current.z) * k;
    if (ringsRoot.current) {
      ringsRoot.current.rotation.y = Math.sin(t * 0.05) * 0.35 + t * 0.012;
      ringsRoot.current.rotation.x = Math.sin(t * 0.07 + 1.1) * 0.06 + lean.current.x;
      ringsRoot.current.rotation.z = lean.current.z;
      ringsRoot.current.scale.setScalar(0.86 + 0.14 * unfold);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.035;
      shellRef.current.rotation.x = Math.sin(t * 0.11) * 0.08;
    }
    if (emitterRef.current) {
      emitterRef.current.rotation.y = -t * 0.06;
      emitterRef.current.rotation.x = Math.sin(t * 0.09) * 0.1;
    }
    if (glowRef.current) glowRef.current.quaternion.copy(camera.quaternion);

    const fr = fragRef.current;
    if (fr) {
      fragments.forEach((f, i) => {
        const a = f.phase + t * f.speed;
        tmp.v
          .set(Math.cos(a) * f.radius, Math.sin(a * 2.0 + f.phase) * 0.25, Math.sin(a) * f.radius)
          .applyEuler(f.incl);
        q.setFromAxisAngle(f.spin, t * f.spinSpeed + f.phase);
        const s = f.size * (0.4 + 0.6 * ignite);
        m4.compose(tmp.v, q, tmp.s.set(s, s, s));
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
              material={[mats.chrome, mats.brushed]}
            >
              {r.ticks ? (
                <DialTicks spec={r.spec} count={r.ticks} geometry={tickGeometry} mats={mats} />
              ) : null}
              {r.studs ? (
                <ChannelStuds spec={r.spec} count={r.studs} geometry={tickGeometry} material={mats.stud} />
              ) : null}
            </mesh>
            {r.carriages ? (
              <instancedMesh
                ref={(el) => {
                  carriageRefs.current[i] = el;
                }}
                args={[r.carriages.geometry, mats.anodised, r.carriages.count]}
                frustumCulled={false}
              />
            ) : null}
          </group>
        ))}
      </group>

      <mesh ref={shellRef} name="core-shell" geometry={shell.geometry} material={mats.shell} />

      <group ref={emitterRef} name="core-emitter">
        <mesh geometry={emitter.geos.circuit} material={emitter.circuit} />
        <mesh geometry={emitter.geos.aura} material={emitter.aura} renderOrder={4} />
        <mesh geometry={emitter.geos.hot} material={emitter.hot} />
      </group>
      <mesh ref={glowRef} material={emitter.glow} renderOrder={5} name="core-glow">
        <planeGeometry args={[3.4, 3.4]} />
      </mesh>

      <instancedMesh
        ref={fragRef}
        name="core-fragments"
        args={[shard, mats.anodised, fragments.length]}
        frustumCulled={false}
      />
      <points name="core-sparks" geometry={sparks.g} material={sparks.m} frustumCulled={false} />
    </group>
  );
}

/** Dial graduations on the precision ring's outer wall; every tenth is a lit index mark. */
function DialTicks({
  spec,
  count,
  geometry,
  mats,
}: {
  spec: RingSolidSpec;
  count: number;
  geometry: BufferGeometry;
  mats: ReturnType<typeof createCoreMaterials>;
}) {
  const minor = useRef<InstancedMesh>(null);
  const major = useRef<InstancedMesh>(null);
  const majors = Math.ceil(count / 10);
  useLayoutEffect(() => {
    const o = new Object3D();
    let mi = 0;
    let ma = 0;
    const outer = spec.radius + spec.width / 2;
    for (let i = 0; i < count; i++) {
      const phi = (i / count) * TURN;
      const isMajor = i % 10 === 0;
      const len = isMajor ? 0.11 : 0.05;
      const r = outer + len / 2;
      o.position.set(r * Math.sin(phi), 0, r * Math.cos(phi));
      o.rotation.set(0, phi - Math.PI / 2, 0);
      o.scale.set(len, isMajor ? 0.018 : 0.012, isMajor ? 0.016 : 0.01);
      o.updateMatrix();
      if (isMajor) major.current?.setMatrixAt(ma++, o.matrix);
      else minor.current?.setMatrixAt(mi++, o.matrix);
    }
    if (minor.current) minor.current.instanceMatrix.needsUpdate = true;
    if (major.current) major.current.instanceMatrix.needsUpdate = true;
  }, [spec, count]);
  return (
    <>
      <instancedMesh ref={minor} args={[geometry, mats.chrome, count - majors]} />
      <instancedMesh ref={major} args={[geometry, mats.stud, majors]} />
    </>
  );
}

/** Lit indicator studs seated on the inner gimbal's channel floor (bloom accents). */
function ChannelStuds({
  spec,
  count,
  geometry,
  material,
}: {
  spec: RingSolidSpec;
  count: number;
  geometry: BufferGeometry;
  material: ReturnType<typeof createCoreMaterials>['stud'];
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new Object3D();
    const floorTop = -spec.height / 2 + (spec.channel?.floor ?? 0) + 0.012;
    for (let i = 0; i < count; i++) {
      const phi = (i / count) * TURN;
      o.position.set(spec.radius * Math.sin(phi), floorTop, spec.radius * Math.cos(phi));
      o.rotation.set(0, phi, 0);
      o.scale.set(0.026, 0.022, i % 3 === 0 ? 0.14 : 0.06);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [spec, count]);
  return <instancedMesh ref={ref} args={[geometry, material, count]} />;
}

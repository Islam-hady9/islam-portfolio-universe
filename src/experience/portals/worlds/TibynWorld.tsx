'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  InstancedMesh,
  LinearFilter,
  RGBAFormat,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NOISE_GLSL } from '../../shaders/noise';
import { mulberry32, ridged2 } from '../../math/noise';
import { activity, glowMaterial, skyDome } from './kit';

const PENS: [number, number, number][] = [
  // x, z, radius
  [-3.2, -1.5, 1.35],
  [0.4, -3.4, 1.15],
  [3.4, -1.0, 1.0],
  [-1.2, -6.5, 0.95],
  [2.6, -7.4, 0.8],
  [-4.6, -8.8, 0.75],
  [5.4, -5.2, 0.7],
];
/** Feed barge moored between the pens, with a mast light. */
const BARGE = { x: 1.9, z: -5.0, rotY: 0.35 };
const STANCHIONS = 14;
const SKY = { top: '#03080c', horizon: '#123c46', moonDir: [0.35, 0.42, -1] as [number, number, number] };

/** Mountain curtains, nearest first: silhouette, placement, colour and atmospheric haze. */
const RIDGES = [
  {
    width: 60,
    segments: 100,
    height: 3.6,
    seed: 7,
    scale: 0.16,
    pos: [2, -0.2, -15],
    color: '#071216',
    haze: 0.05,
  },
  {
    width: 70,
    segments: 120,
    height: 6.5,
    seed: 2,
    scale: 0.09,
    pos: [0, -0.2, -24],
    color: '#0d2028',
    haze: 0.22,
  },
  {
    width: 96,
    segments: 150,
    height: 8.5,
    seed: 11,
    scale: 0.06,
    pos: [-6, -0.2, -34],
    color: '#123038',
    haze: 0.55,
  },
] as const;
type Ridge = (typeof RIDGES)[number];
const HAZE = '#0f2f38';
const PROFILE_SAMPLES = 256;
const PROFILE_MAX = 12;

/** Ridge height at local x: main line plus a finer octave so it reads as rock, not a curve. */
function ridgeHeight(x: number, r: Ridge) {
  return (
    ridged2(x * r.scale, r.seed * 3.1, r.seed) * r.height +
    ridged2(x * r.scale * 4.3, r.seed * 1.7, r.seed + 9) * r.height * 0.08 +
    0.4
  );
}

/** The three silhouettes baked into a 256 x 3 height texture for the water reflection test. */
function ridgeProfiles() {
  const data = new Uint8Array(PROFILE_SAMPLES * RIDGES.length * 4);
  RIDGES.forEach((r, row) => {
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      const x = (i / (PROFILE_SAMPLES - 1) - 0.5) * r.width;
      const v = Math.round(Math.min(1, ridgeHeight(x, r) / PROFILE_MAX) * 255);
      data.set([v, v, v, 255], (row * PROFILE_SAMPLES + i) * 4);
    }
  });
  const tex = new DataTexture(data, PROFILE_SAMPLES, RIDGES.length, RGBAFormat);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildRidgeCurtain(r: Ridge) {
  const pos: number[] = [];
  const top: number[] = [];
  const idx: number[] = [];
  const { width, segments } = r;
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments - 0.5) * width;
    const h = ridgeHeight(x, r);
    pos.push(x, 0, 0, x, h, 0);
    top.push(h, h);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aTop', new BufferAttribute(new Float32Array(top), 1));
  g.setIndex(idx);
  return g;
}

/** Ridge silhouette with atmospheric perspective (hazier toward its misty base) and a
 *  moonlit crest. */
function ridgeMaterial(r: Ridge) {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uColor: { value: new Color(r.color) },
      uHazeColor: { value: new Color(HAZE) },
      uHaze: { value: r.haze },
    },
    vertexShader: /* glsl */ `attribute float aTop; varying float vY; varying float vTop;
      void main(){ vY = position.y; vTop = aTop; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform vec3 uHazeColor; uniform float uHaze;
      varying float vY; varying float vTop;
      void main(){
        vec3 col = uColor * (0.6 + vY * 0.12);
        float mist = smoothstep(1.6, 0.0, vY);
        col = mix(col, uHazeColor, clamp(uHaze + mist * 0.35, 0.0, 1.0));
        col += vec3(0.5, 0.75, 0.82) * smoothstep(vTop - 0.12, vTop, vY) * 0.07;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Colour a ridge shows at mid-height (what the water reflects), in linear space. */
function ridgeReflection(r: Ridge) {
  return new Color(r.color).multiplyScalar(0.85).lerp(new Color(HAZE), r.haze);
}

/** Two lights per pen (deterministic), plus the barge's mast light. */
function lightPositions() {
  const rand = mulberry32(4);
  const out: Vector3[] = [];
  PENS.forEach(([x, z, r]) => {
    for (let k = 0; k < 2; k++) {
      const a = rand() * Math.PI * 2;
      out.push(new Vector3(x + Math.cos(a) * r, 0.42, z + Math.sin(a) * r));
    }
  });
  out.push(new Vector3(BARGE.x + 0.35 * Math.cos(BARGE.rotY), 1.12, BARGE.z - 0.35 * Math.sin(BARGE.rotY)));
  return out;
}

function buildBarge() {
  const hull = new BoxGeometry(1.7, 0.3, 0.72);
  hull.translate(0, 0.12, 0);
  const cabin = new BoxGeometry(0.72, 0.34, 0.52);
  cabin.translate(-0.3, 0.44, 0);
  const mast = new CylinderGeometry(0.018, 0.022, 0.62, 6);
  mast.translate(0.35, 0.78, 0);
  const g = mergeGeometries([hull, cabin, mast], false)!;
  [hull, cabin, mast].forEach((p) => p.dispose());
  return g;
}

/** TIBYN — moonlit aquaculture (teal water, pens, mountains). */
export function TibynWorld() {
  const ringsRef = useRef<InstancedMesh>(null);
  const postsRef = useRef<InstancedMesh>(null);
  const lightsRef = useRef<InstancedMesh>(null);
  const lights = useMemo(() => lightPositions(), []);
  const profiles = useMemo(() => ridgeProfiles(), []);

  const mats = useMemo(() => {
    const water = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uHover: { value: 0 },
        uPens: { value: PENS.map(([x, z, r]) => new Vector3(x, z, r)) },
        uLights: { value: lights },
        uSkyTop: { value: new Color(SKY.top) },
        uSkyHorizon: { value: new Color(SKY.horizon) },
        uRidgeTex: { value: profiles },
        // x offset, width, plane z, base y (nearest first).
        uRidgeA: { value: RIDGES.map((r) => [r.pos[0], r.width, r.pos[2], r.pos[1]]).flat() },
        uRidgeCol: { value: RIDGES.map(ridgeReflection) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; uniform vec3 uPens[7]; uniform vec3 uLights[15];
        uniform vec3 uSkyTop; uniform vec3 uSkyHorizon;
        uniform sampler2D uRidgeTex; uniform vec4 uRidgeA[3]; uniform vec3 uRidgeCol[3];
        varying vec3 vWorld;
        ${NOISE_GLSL}
        // Calm water height: a long, slow swell plus fine ripples, and rings around the pens.
        float waterH(vec2 p, float t){
          float h = iu_fbm3_lo(vec3(p.x * 0.35, p.y * 0.8, t * 0.5)) * 0.8;
          h += iu_noise3(vec3(p * 2.4, t * 1.3)) * 0.18;
          for (int i = 0; i < 7; i++) {
            float d = length(p - uPens[i].xy);
            h += 0.035 * sin(d * 26.0 - t * 5.0) * exp(-pow((d - uPens[i].z) / 0.32, 2.0));
          }
          return h;
        }
        void main(){
          vec2 p = vWorld.xz;
          float t = uTime * 0.28;
          float e = 0.06;
          float h0 = waterH(p, t);
          float hx = waterH(p + vec2(e, 0.0), t);
          float hz = waterH(p + vec2(0.0, e), t);
          float k = 0.9 + uHover * 0.6;
          vec3 n = normalize(vec3((h0 - hx) * k, e * 4.0, (h0 - hz) * k));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = 0.07 + 0.93 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 r = reflect(-v, n);
          // Reflected sky (the dome gradient and its moon lobe) unless the reflected ray meets a
          // mountain curtain (baked silhouettes, nearest first): wave-distorted reflections.
          vec3 moonDir = normalize(vec3(0.35, 0.42, -1.0));
          float md = max(dot(r, moonDir), 0.0);
          vec3 refl = mix(uSkyHorizon, uSkyTop, smoothstep(-0.05, 0.6, r.y)) * 3.4;
          refl += vec3(0.81, 0.94, 1.0) * pow(md, 16.0) * 0.9;
          float hitMountain = 0.0;
          for (int i = 0; i < 3; i++) {
            if (r.z > -0.001 || hitMountain > 0.5) break;
            float tt = (uRidgeA[i].z - vWorld.z) / r.z;
            if (tt <= 0.0) continue;
            vec3 H = vWorld + r * tt;
            float u = (H.x - uRidgeA[i].x) / uRidgeA[i].y + 0.5;
            if (u < 0.0 || u > 1.0) continue;
            float hgt = texture2D(uRidgeTex, vec2(u, (float(i) + 0.5) / 3.0)).r * 12.0 + uRidgeA[i].w;
            if (H.y < hgt) {
              refl = mix(uRidgeCol[i], uSkyHorizon * 2.0, 0.3) * (0.8 + 0.3 * smoothstep(0.0, hgt, H.y));
              hitMountain = 1.0;
            }
          }
          // Teal body of the water, lit a little from within near the viewer.
          vec3 deep = vec3(0.012, 0.055, 0.068);
          vec3 col = mix(deep, refl, fres) + vec3(0.01, 0.05, 0.055) * (1.0 - fres) * 0.6;
          col += vec3(0.75, 0.95, 1.0) * pow(md, 320.0) * 3.2 * (1.0 - hitMountain);
          // Pen and barge lights glint on the ripples.
          for (int i = 0; i < 15; i++) {
            vec3 L = normalize(uLights[i] - vWorld);
            float dist = length(uLights[i] - vWorld);
            col += vec3(0.32, 0.88, 1.0) * pow(max(dot(r, L), 0.0), 160.0) * 1.4 / (1.0 + dist * 0.35);
          }
          float dist = length(vWorld.xz - vec2(0.0, -4.0));
          col *= mix(1.0, 0.55, smoothstep(6.0, 16.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const pen = new MeshStandardMaterial({
      color: '#1a2a30',
      metalness: 0.6,
      roughness: 0.42,
      emissive: new Color('#0b3540'),
      emissiveIntensity: 0.6,
      side: DoubleSide,
    });
    const post = new MeshStandardMaterial({ color: '#0d1418', metalness: 0.4, roughness: 0.6 });
    const light = new MeshStandardMaterial({
      color: '#000',
      emissive: new Color('#52e0ff'),
      emissiveIntensity: 3,
      toneMapped: false,
    });
    const moon = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv;
        ${NOISE_GLSL}
        void main(){
          vec2 p = (vUv - 0.5) * 2.0;
          float r = length(p);
          float w = fwidth(r);
          float disc = 1.0 - smoothstep(0.14 - w, 0.14 + w, r);
          float limb = mix(0.78, 1.0, sqrt(max(0.0, 1.0 - pow(r / 0.14, 2.0))));
          float maria = 0.9 + 0.1 * iu_fbm3_lo(vec3(p * 18.0, 3.0));
          float halo = exp(-r * r * 9.0) * 0.32 + exp(-r * r * 60.0) * 0.4;
          vec3 col = vec3(0.86, 0.95, 1.0) * (disc * limb * maria * 1.6 + halo);
          gl_FragColor = vec4(col, clamp(disc + halo, 0.0, 1.0));
        }`,
    });
    return {
      water,
      pen,
      post,
      light,
      moon,
      ridges: RIDGES.map(ridgeMaterial),
      sky: skyDome(SKY.top, SKY.horizon, SKY.moonDir, '#cfefff', 0.9),
      mist: glowMaterial('#5cc9dc', 0.18, 2.5),
      mistFar: glowMaterial('#5cc9dc', 0.1, 1.8),
    };
  }, [lights, profiles]);

  const geo = useMemo(() => ({ ridges: RIDGES.map(buildRidgeCurtain), barge: buildBarge() }), []);

  useLayoutEffect(() => {
    const rings = ringsRef.current;
    const posts = postsRef.current;
    const lightMesh = lightsRef.current;
    if (!rings || !posts || !lightMesh) return;
    const o = new Object3D();
    let ri = 0;
    let p = 0;
    PENS.forEach(([x, z, r]) => {
      // Floating collar (outer + inner pipe) and a raised handrail.
      for (const [k, y] of [
        [1, 0.06],
        [0.93, 0.06],
        [0.965, 0.27],
      ] as const) {
        o.position.set(x, y, z);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.set(r * k, r * k, 1);
        o.updateMatrix();
        rings.setMatrixAt(ri++, o.matrix);
      }
      for (let k = 0; k < STANCHIONS; k++) {
        const a = (k / STANCHIONS) * Math.PI * 2;
        o.position.set(x + Math.cos(a) * r * 0.965, 0.16, z + Math.sin(a) * r * 0.965);
        o.rotation.set(0, 0, 0);
        o.scale.set(0.018, 0.24, 0.018);
        o.updateMatrix();
        posts.setMatrixAt(p++, o.matrix);
      }
    });
    lights.forEach((l, i) => {
      o.position.copy(l);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(i === lights.length - 1 ? 0.03 : 0.035);
      o.updateMatrix();
      lightMesh.setMatrixAt(i, o.matrix);
    });
    rings.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
  }, [lights]);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => (Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose()));
      geo.ridges.forEach((g) => g.dispose());
      geo.barge.dispose();
      profiles.dispose();
    },
    [mats, geo, profiles],
  );

  useFrame((_, dt) => {
    const a = activity('tibyn');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    mats.water.uniforms.uTime!.value = a.time;
    mats.water.uniforms.uHover!.value = a.hover;
    mats.light.emissiveIntensity = 2.2 + Math.sin(a.time * 3) * 0.8 + a.hover * 2;
  });

  return (
    <>
      <color attach="background" args={['#04090c']} />
      <fog attach="fog" args={['#0a2128', 10, 34]} />
      <mesh material={mats.sky}>
        <sphereGeometry args={[60, 32, 16]} />
      </mesh>
      <mesh material={mats.moon} position={[9, 13, -40]}>
        <planeGeometry args={[9, 9]} />
      </mesh>
      {RIDGES.map((r, i) => (
        <mesh key={r.seed} geometry={geo.ridges[i]} material={mats.ridges[i]} position={[...r.pos]} />
      ))}
      <mesh material={mats.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <planeGeometry args={[60, 40, 1, 1]} />
      </mesh>
      <instancedMesh ref={ringsRef} args={[undefined, mats.pen, PENS.length * 3]}>
        <torusGeometry args={[1, 0.03, 8, 72]} />
      </instancedMesh>
      <instancedMesh ref={postsRef} args={[undefined, mats.post, PENS.length * STANCHIONS]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={lightsRef} args={[undefined, mats.light, lights.length]}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
      <group position={[BARGE.x, 0, BARGE.z]} rotation={[0, BARGE.rotY, 0]}>
        <mesh geometry={geo.barge} material={mats.post} />
        <mesh material={mats.light} position={[-0.3, 0.46, 0.263]}>
          <boxGeometry args={[0.42, 0.05, 0.01]} />
        </mesh>
      </group>
      <mesh material={mats.mist} position={[0, 0.6, -6]} rotation={[-Math.PI / 2.2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[24, 10]} />
      </mesh>
      <mesh material={mats.mistFar} position={[0, 1.2, -22]} renderOrder={2}>
        <planeGeometry args={[60, 5]} />
      </mesh>
      <ambientLight intensity={0.35} color="#7fb6c4" />
      <directionalLight position={[4, 6, -8]} intensity={1.4} color="#cfefff" />
    </>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from 'three';
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

function buildRidgeCurtain(width: number, segments: number, height: number, seed: number, scale: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const x = (i / segments - 0.5) * width;
    const h = ridged2(x * scale, seed * 3.1, seed) * height + 0.4;
    pos.push(x, 0, 0, x, h, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  return g;
}

/** TIBYN — moonlit aquaculture (teal water, pens, mountains). */
export function TibynWorld() {
  const pensRef = useRef<InstancedMesh>(null);
  const postsRef = useRef<InstancedMesh>(null);
  const lightsRef = useRef<InstancedMesh>(null);

  const mats = useMemo(() => {
    const water = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; varying vec3 vWorld;
        ${NOISE_GLSL}
        void main(){
          vec2 p = vWorld.xz;
          float e = 0.08;
          float t = uTime * 0.35;
          float h0 = iu_fbm3_lo(vec3(p * 0.9, t));
          float hx = iu_fbm3_lo(vec3((p + vec2(e, 0.0)) * 0.9, t));
          float hz = iu_fbm3_lo(vec3((p + vec2(0.0, e)) * 0.9, t));
          vec3 n = normalize(vec3((h0 - hx) * (1.4 + uHover), 1.0, (h0 - hz) * (1.4 + uHover)));
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
          vec3 deep = vec3(0.012, 0.05, 0.06);
          vec3 sky = vec3(0.12, 0.34, 0.4);
          vec3 col = mix(deep, sky, fres);
          // Moon glitter path.
          vec3 moonDir = normalize(vec3(0.35, 0.42, -1.0));
          vec3 r = reflect(-v, n);
          float spec = pow(max(dot(r, moonDir), 0.0), 220.0);
          col += vec3(0.75, 0.95, 1.0) * spec * 3.5;
          float dist = length(vWorld.xz - vec2(0.0, -4.0));
          col *= mix(1.0, 0.55, smoothstep(6.0, 16.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const pen = new MeshStandardMaterial({ color: '#1a2a30', metalness: 0.6, roughness: 0.45, emissive: new Color('#0b3540'), emissiveIntensity: 0.6, side: DoubleSide });
    const post = new MeshStandardMaterial({ color: '#0d1418', metalness: 0.4, roughness: 0.6 });
    const light = new MeshStandardMaterial({ color: '#000', emissive: new Color('#52e0ff'), emissiveIntensity: 3, toneMapped: false });
    const ridgeFar = new ShaderMaterial({
      uniforms: { uColor: { value: new Color('#0d2028') } },
      vertexShader: /* glsl */ `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 uColor; varying float vY; void main(){ gl_FragColor = vec4(uColor * (0.6 + vY * 0.12), 1.0); }`,
      side: DoubleSide,
    });
    const ridgeNear = ridgeFar.clone();
    ridgeNear.uniforms.uColor = { value: new Color('#071216') };
    return {
      water,
      pen,
      post,
      light,
      ridgeFar,
      ridgeNear,
      sky: skyDome('#03080c', '#123c46', [0.35, 0.42, -1], '#cfefff', 0.9),
      moon: glowMaterial('#d8f3ff', 1.6, 9),
      mist: glowMaterial('#5cc9dc', 0.18, 2.5),
    };
  }, []);

  const ridges = useMemo(
    () => ({ far: buildRidgeCurtain(70, 120, 6.5, 2, 0.09), near: buildRidgeCurtain(60, 100, 3.6, 7, 0.16) }),
    [],
  );

  useLayoutEffect(() => {
    const pens = pensRef.current;
    const posts = postsRef.current;
    const lights = lightsRef.current;
    if (!pens || !posts || !lights) return;
    const o = new Object3D();
    const rand = mulberry32(4);
    let p = 0;
    let l = 0;
    PENS.forEach(([x, z, r], i) => {
      o.position.set(x, 0.06, z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.set(r, r, 1);
      o.updateMatrix();
      pens.setMatrixAt(i, o.matrix);
      const n = 10;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        o.position.set(x + Math.cos(a) * r, 0.18, z + Math.sin(a) * r);
        o.rotation.set(0, 0, 0);
        o.scale.set(0.03, 0.36, 0.03);
        o.updateMatrix();
        posts.setMatrixAt(p++, o.matrix);
      }
      for (let k = 0; k < 2; k++) {
        const a = rand() * Math.PI * 2;
        o.position.set(x + Math.cos(a) * r, 0.4, z + Math.sin(a) * r);
        o.scale.setScalar(0.035);
        o.updateMatrix();
        lights.setMatrixAt(l++, o.matrix);
      }
    });
    pens.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      ridges.far.dispose();
      ridges.near.dispose();
    },
    [mats, ridges],
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
      <mesh material={mats.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <planeGeometry args={[60, 40, 1, 1]} />
      </mesh>
      <mesh geometry={ridges.far} material={mats.ridgeFar} position={[0, -0.2, -24]} />
      <mesh geometry={ridges.near} material={mats.ridgeNear} position={[2, -0.2, -15]} />
      <instancedMesh ref={pensRef} args={[undefined, mats.pen, PENS.length]}>
        <torusGeometry args={[1, 0.035, 8, 64]} />
      </instancedMesh>
      <instancedMesh ref={postsRef} args={[undefined, mats.post, PENS.length * 10]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={lightsRef} args={[undefined, mats.light, PENS.length * 2]}>
        <sphereGeometry args={[1, 8, 6]} />
      </instancedMesh>
      <mesh material={mats.mist} position={[0, 0.6, -6]} rotation={[-Math.PI / 2.2, 0, 0]}>
        <planeGeometry args={[24, 10]} />
      </mesh>
      <ambientLight intensity={0.35} color="#7fb6c4" />
      <directionalLight position={[4, 6, -8]} intensity={1.4} color="#cfefff" />
    </>
  );
}

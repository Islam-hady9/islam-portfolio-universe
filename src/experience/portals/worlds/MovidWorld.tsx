'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { NOISE_GLSL } from '../../shaders/noise';
import { mulberry32 } from '../../math/noise';
import { buildExplorerGeometry } from '../../objects/Explorer';
import { activity, glowMaterial } from './kit';

const ROWS = 3;
const COLS = 9;

/** MOViD Studio — cinematic multi-screen editing theatre (violet). */
export function MovidWorld() {
  const screensRef = useRef<InstancedMesh>(null);
  const count = ROWS * COLS;

  const geometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const rand = mulberry32(12);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = rand();
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const mats = useMemo(() => {
    const screen = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; varying vec2 vUv; varying float vSeed;
        void main(){ vUv = uv; vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; varying vec2 vUv; varying float vSeed;
        ${NOISE_GLSL}
        void main(){
          vec2 uv = vUv;
          float t = uTime * (0.25 + vSeed * 0.5) + vSeed * 40.0;
          vec3 a = mix(vec3(0.18, 0.12, 0.45), vec3(0.08, 0.28, 0.5), vSeed);
          vec3 b = mix(vec3(0.6, 0.45, 1.0), vec3(0.4, 0.8, 1.0), fract(vSeed * 7.0));
          float clouds = iu_fbm3(vec3(uv * 3.0 + vec2(t * 0.15, 0.0), vSeed * 10.0));
          vec3 col = mix(a * 0.4, b * 0.9, smoothstep(0.35, 0.8, clouds));
          // Variant footage: horizon line, waveform, moving bars.
          float kind = floor(fract(vSeed * 13.0) * 3.0);
          if (kind < 0.5) {
            float hz = smoothstep(0.012, 0.0, abs(uv.y - 0.35 - 0.05 * sin(uv.x * 9.0 + t)));
            col += b * hz * 1.4;
          } else if (kind < 1.5) {
            float w = smoothstep(0.02, 0.0, abs(uv.y - 0.5 - 0.18 * sin(uv.x * 22.0 + t * 3.0) * iu_noise3(vec3(uv.x * 6.0, t, 1.0))));
            col += vec3(0.7, 0.6, 1.0) * w;
          } else {
            float bars = step(0.6, fract(uv.x * 6.0 + t * 0.4)) * step(uv.y, 0.25 + 0.5 * iu_noise3(vec3(floor(uv.x * 6.0), t * 0.5, 2.0)));
            col += b * bars * 0.5;
          }
          float scan = 0.92 + 0.08 * sin(uv.y * 240.0);
          float vig = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x) * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
          float frame = 1.0 - step(0.015, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
          col = col * scan * (0.3 + 0.7 * vig) * (0.72 + uHover * 0.45);
          col += vec3(0.25, 0.22, 0.4) * frame;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const hero = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; varying vec2 vUv;
        ${NOISE_GLSL}
        float tri(vec2 p){ // play triangle SDF-ish
          p -= vec2(0.5);
          p.x += 0.04;
          float a = abs(p.y) * 1.15 + p.x * 0.66;
          return a - 0.11;
        }
        void main(){
          vec2 uv = vUv;
          vec3 bg = mix(vec3(0.06, 0.04, 0.16), vec3(0.22, 0.12, 0.42), iu_fbm3(vec3(uv * 2.5, uTime * 0.1)));
          float d = tri(uv);
          float play = smoothstep(0.01, -0.01, d);
          float glow = exp(-max(d, 0.0) * 18.0);
          float pulse = 0.85 + 0.15 * sin(uTime * 2.2) + uHover * 0.5;
          vec3 col = bg * 0.7 + vec3(0.62, 0.52, 1.0) * (play * 1.5 + glow * 0.45) * pulse;
          float frame = 1.0 - step(0.012, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
          col += vec3(0.5, 0.45, 0.9) * frame * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const floor = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vW;
        void main(){
          float d = length(vW.xz - vec2(0.0, -5.0));
          vec3 col = vec3(0.16, 0.1, 0.36) * exp(-d * 0.26) * 0.32;
          float grid = (1.0 - smoothstep(0.0, 0.03, abs(fract(vW.x * 0.8) - 0.5) - 0.47)) * 0.018 * exp(-d * 0.15);
          gl_FragColor = vec4(col + grid, 1.0);
        }`,
    });
    const figure = new MeshStandardMaterial({ color: '#030305', roughness: 0.9 });
    return { screen, hero, floor, figure, haze: glowMaterial('#8b7cff', 0.2, 2.2) };
  }, []);

  const figureGeometry = useMemo(() => buildExplorerGeometry(), []);

  useLayoutEffect(() => {
    const m = screensRef.current;
    if (!m) return;
    const o = new Object3D();
    const radius = 9;
    const span = Math.PI * 0.7;
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = -span / 2 + (c / (COLS - 1)) * span;
        const center = c === Math.floor(COLS / 2) && r === 1;
        const y = 1.4 + r * 1.55;
        o.position.set(Math.sin(a) * radius, y, -Math.cos(a) * radius - 1);
        o.lookAt(0, y * 0.85, 2);
        const w = center ? 0.01 : 1.9;
        o.scale.set(w, center ? 0.01 : 1.15, 1);
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      Object.values(mats).forEach((x) => x.dispose());
      geometry.dispose();
      figureGeometry.dispose();
    },
    [mats, geometry, figureGeometry],
  );

  useFrame((_, dt) => {
    const a = activity('movid');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    mats.screen.uniforms.uTime!.value = a.time;
    mats.screen.uniforms.uHover!.value = a.hover;
    mats.hero.uniforms.uTime!.value = a.time;
    mats.hero.uniforms.uHover!.value = a.hover;
  });


  return (
    <>
      <color attach="background" args={['#05040c']} />
      <instancedMesh ref={screensRef} args={[geometry, mats.screen, count]} frustumCulled={false} />
      <mesh material={mats.hero} position={[0, 2.95, -9.6]}>
        <planeGeometry args={[3.6, 2.1]} />
      </mesh>
      <mesh material={mats.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -4]}>
        <planeGeometry args={[40, 30]} />
      </mesh>
      <mesh material={mats.haze} position={[0, 2.6, -8]}>
        <planeGeometry args={[18, 8]} />
      </mesh>
      <mesh geometry={figureGeometry} material={mats.figure} position={[0, 0, -2]} scale={1.15} />
      <ambientLight intensity={0.2} />
    </>
  );
}

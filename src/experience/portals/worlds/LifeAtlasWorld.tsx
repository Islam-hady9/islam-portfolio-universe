'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { mulberry32, ridged2 } from '../../math/noise';
import { activity, RIBBON_GLSL, ribbonGeometry } from './kit';

const W = 36;
const D = 26;
/** Terrain/path group offset and the world's nominal camera (PortalSystem FRAMING.lifeatlas). */
const OFFSET = new Vector3(0, 0, -4);
const CAMERA = new Vector3(0, 4.2, 10.5);
/** The energy source above the highest peak (world space) and its ground point. */
const SOURCE = new Vector3(1.2, 5.2, -12);
const SOURCE_GROUND: [number, number] = [1.2, -12];

function heightAt(x: number, z: number) {
  const t = 1 - (z / D + 0.5);
  return ridged2(x * 0.12 + 3, z * 0.12, 4) * (1.2 + t * 4.2) - 0.4;
}

/** LifeAtlas — constellation path over luminous wireframe mountains (concept, violet-mint). */
export function LifeAtlasWorld() {
  const terrain = useMemo(() => {
    const g = new PlaneGeometry(W, D, 140, 100);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSource: { value: SOURCE_GROUND } },
      vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec2 uSource; varying vec3 vW; varying vec3 vN;
        // Anti-aliased grid line; lines thinner than ~1 px fade out instead of shimmering.
        float gridLine(float v, float scale, float width){
          float x = v * scale; float fw = fwidth(x);
          float f = abs(fract(x - 0.5) - 0.5) / max(fw, 1e-4);
          return (1.0 - smoothstep(width - 0.5, width + 0.5, f)) * smoothstep(0.55, 0.2, fw);
        }
        void main(){
          float major = max(gridLine(vW.x, 1.6, 0.6), gridLine(vW.z, 1.6, 0.6));
          float minor = max(gridLine(vW.x, 6.4, 0.35), gridLine(vW.z, 6.4, 0.35)) * 0.22;
          float contour = gridLine(vW.y, 2.4, 0.55) * 0.5 + gridLine(vW.y, 0.48, 0.8) * 0.55;
          float dist = length(vW.xz - vec2(0.0, 2.0));
          float fade = exp(-dist * 0.07);
          // Wave propagating outward from the energy source's ground point.
          float ds = length(vW.xz - uSource);
          float wr = fract(uTime * 0.09) * 26.0;
          float wave = exp(-pow((ds - wr) / 0.9, 2.0)) * (1.0 - fract(uTime * 0.09));
          vec3 mint = vec3(0.49, 0.97, 0.79);
          vec3 violet = vec3(0.55, 0.49, 1.0);
          vec3 tone = mix(mint, violet, smoothstep(0.0, 5.0, vW.y));
          float lines = major * 0.55 + minor + contour;
          vec3 col = tone * lines * fade * (1.4 + wave * 1.6);
          // Faint fill between the lines: depth gradient (teal low, violet high), facing light.
          float facing = clamp(vN.y * 0.5 + 0.5, 0.0, 1.0);
          col += mix(vec3(0.012, 0.04, 0.05), vec3(0.03, 0.025, 0.07), smoothstep(0.0, 5.0, vW.y)) * fade * (0.6 + facing * 0.6);
          col += violet * wave * fade * 0.05;
          // Atmospheric depth: far terrain shifts toward a violet haze.
          col = mix(col, vec3(0.03, 0.03, 0.07), smoothstep(10.0, 26.0, dist) * 0.6);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    return { g, m };
  }, []);

  const constellation = useMemo(() => {
    const rand = mulberry32(6);
    const pts: Vector3[] = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const x = -11 + (i / (n - 1)) * 22 + (rand() - 0.5) * 1.2;
      const z = -6 - Math.sin(i * 0.7) * 3 - rand() * 2;
      pts.push(new Vector3(x, heightAt(x, z) + 1.6 + rand() * 0.8, z));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts.flatMap((p) => [p.x, p.y, p.z])), 3));
    const prog = new Float32Array(n).map((_, i) => i / (n - 1));
    g.setAttribute('aT', new BufferAttribute(prog, 1));
    // The path as one ribbon through the stars (straight segments: a drawn constellation).
    const dense: Vector3[] = [];
    for (let i = 0; i < n - 1; i++)
      for (let k = 0; k < 12; k++) dense.push(new Vector3().lerpVectors(pts[i]!, pts[i + 1]!, k / 12));
    dense.push(pts[n - 1]!.clone());
    const ribbon = ribbonGeometry([dense], CAMERA.clone().sub(OFFSET));
    const lineMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: { uProgress: { value: 1 }, uTime: { value: 0 }, uAngular: { value: 0.0032 } },
      vertexShader: /* glsl */ `attribute float aT; ${RIBBON_GLSL} varying float vT; varying float vX;
        void main(){ vT = aT; vX = aAcross; gl_Position = iuRibbon(position); }`,
      fragmentShader: /* glsl */ `uniform float uProgress; uniform float uTime; varying float vT; varying float vX;
        void main(){
          float k = 1.0 - abs(vX);
          float profile = smoothstep(0.35, 0.95, k) + k * k * 0.25;
          float drawn = smoothstep(uProgress + 0.002, uProgress - 0.01, vT);
          float travel = exp(-pow((fract(vT - uTime * 0.12) - 0.5) / 0.04, 2.0));
          float a = (0.7 + travel * 0.8) * profile * drawn;
          gl_FragColor = vec4(vec3(0.8, 0.95, 1.0) * a * 1.4, a);
        }`,
    });
    const starMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uProgress: { value: 1 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aT; uniform float uTime; varying float vT;
        void main(){ vT = aT; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = (80.0 + 24.0 * sin(uTime * 2.0 + aT * 20.0)) / -mv.z; }`,
      fragmentShader: /* glsl */ `uniform float uProgress; varying float vT;
        void main(){ float d = length(gl_PointCoord - 0.5);
          float a = (smoothstep(0.5, 0.0, d) * 0.45 + smoothstep(0.1, 0.0, d) + smoothstep(0.03, 0.0, abs(d - 0.26)) * 0.25)
            * step(vT, uProgress + 0.001);
          gl_FragColor = vec4(vec3(0.85, 0.98, 1.0) * a * 1.9, a); }`,
    });
    return { g, ribbon, lineMat, starMat };
  }, []);

  /** Energy source: a small bright core, a soft halo, a slow breathing ring and a faint beam. */
  const source = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0;
            float r = length(p);
            float breath = 0.9 + 0.1 * sin(uTime * 0.8);
            float core = exp(-r * r * 180.0) * 2.0 + exp(-r * r * 40.0) * 0.55;
            float halo = exp(-r * r * 5.0) * 0.34 * breath + exp(-r * r * 16.0) * 0.3;
            float ringR = 0.22 + 0.04 * sin(uTime * 0.6);
            float ring = exp(-pow((r - ringR) / 0.012, 2.0)) * 0.22;
            float beam = exp(-p.x * p.x * 900.0) * smoothstep(0.05, -0.95, p.y) * 0.18;
            vec3 col = vec3(0.65, 0.6, 1.0) * (halo + ring + beam) + vec3(0.92, 0.9, 1.0) * core;
            float a = clamp(core + halo + ring + beam, 0.0, 1.0);
            gl_FragColor = vec4(col * breath, a);
          }`,
      }),
    [],
  );

  const sky = useMemo(() => {
    const rand = mulberry32(44);
    const n = 600;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(rand() - 0.5) * 70, 3 + rand() * 24, -14 - rand() * 20], i * 3);
      seed[i] = rand();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          vA = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed) + aSeed * 40.0);
          gl_PointSize = (14.0 + aSeed * 14.0) / -mv.z; }`,
      fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * 0.7 * vA; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a); }`,
    });
    return { g, m };
  }, []);

  useEffect(
    () => () => {
      terrain.g.dispose();
      terrain.m.dispose();
      constellation.g.dispose();
      constellation.ribbon.dispose();
      constellation.lineMat.dispose();
      constellation.starMat.dispose();
      source.dispose();
      sky.g.dispose();
      sky.m.dispose();
    },
    [terrain, constellation, source, sky],
  );

  useFrame((_, dt) => {
    const a = activity('lifeatlas');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    terrain.m.uniforms.uTime!.value = a.time;
    source.uniforms.uTime!.value = a.time;
    sky.m.uniforms.uTime!.value = a.time;
    // Hover: the life path draws itself; at rest it is fully drawn.
    const target = a.hover > 0.5 ? (a.time * 0.35) % 1.25 : 1;
    const u = constellation.lineMat.uniforms.uProgress!;
    u.value = a.hover > 0.5 ? Math.min(1, target) : u.value + (1 - (u.value as number)) * 0.08;
    constellation.lineMat.uniforms.uTime!.value = a.time;
    constellation.starMat.uniforms.uProgress!.value = u.value;
    constellation.starMat.uniforms.uTime!.value = a.time;
  });

  return (
    <>
      <color attach="background" args={['#040a10']} />
      <points geometry={sky.g} material={sky.m} />
      <mesh geometry={terrain.g} material={terrain.m} position={OFFSET.toArray()} />
      <mesh geometry={constellation.ribbon} material={constellation.lineMat} position={OFFSET.toArray()} />
      <points geometry={constellation.g} material={constellation.starMat} position={OFFSET.toArray()} />
      <mesh material={source} position={SOURCE.toArray()}>
        <planeGeometry args={[6, 6]} />
      </mesh>
    </>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Line,
  PlaneGeometry,
  ShaderMaterial,
} from 'three';
import { mulberry32, ridged2 } from '../../math/noise';
import { activity, glowMaterial } from './kit';

const W = 36;
const D = 26;

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
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec3 vW; varying vec3 vN;
        float gridLine(float v, float scale){ float f = abs(fract(v * scale - 0.5) - 0.5) / fwidth(v * scale); return 1.0 - min(f, 1.0); }
        void main(){
          float g = max(gridLine(vW.x, 1.6), gridLine(vW.z, 1.6));
          float contour = gridLine(vW.y, 2.4) * 0.6;
          float dist = length(vW.xz - vec2(0.0, 2.0));
          float fade = exp(-dist * 0.07);
          vec3 mint = vec3(0.49, 0.97, 0.79);
          vec3 violet = vec3(0.55, 0.49, 1.0);
          vec3 col = mix(mint, violet, smoothstep(0.0, 5.0, vW.y)) * (g * 0.55 + contour) * fade * 1.4;
          col += vec3(0.02, 0.06, 0.07) * fade;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    return { g, m };
  }, []);

  const constellation = useMemo(() => {
    const rand = mulberry32(6);
    const pts: number[] = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const x = -11 + (i / (n - 1)) * 22 + (rand() - 0.5) * 1.2;
      const z = -6 - Math.sin(i * 0.7) * 3 - rand() * 2;
      pts.push(x, heightAt(x, z) + 1.6 + rand() * 0.8, z);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    const prog = new Float32Array(n).map((_, i) => i / (n - 1));
    g.setAttribute('aT', new BufferAttribute(prog, 1));
    const lineMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uProgress: { value: 1 } },
      vertexShader: /* glsl */ `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `uniform float uProgress; varying float vT; void main(){ float a = step(vT, uProgress) * 0.85; gl_FragColor = vec4(vec3(0.8, 0.95, 1.0) * a * 1.5, a); }`,
    });
    const starMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uProgress: { value: 1 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `attribute float aT; uniform float uTime; varying float vA; varying float vT;
        void main(){ vT = aT; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = (90.0 + 30.0 * sin(uTime * 2.0 + aT * 20.0)) / -mv.z; vA = 1.0; }`,
      fragmentShader: /* glsl */ `uniform float uProgress; varying float vT;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = (smoothstep(0.5, 0.0, d) * 0.6 + smoothstep(0.12, 0.0, d)) * step(vT, uProgress + 0.001);
          gl_FragColor = vec4(vec3(0.85, 0.98, 1.0) * a * 2.0, a); }`,
    });
    return { g, line: new Line(g, lineMat), lineMat, starMat };
  }, []);

  const peakGlow = useMemo(() => glowMaterial('#a596ff', 1.4, 6), []);
  const sky = useMemo(() => {
    const rand = mulberry32(44);
    const n = 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(rand() - 0.5) * 70, 3 + rand() * 24, -14 - rand() * 20], i * 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    const m = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 22.0 / -mv.z; }`,
      fragmentShader: /* glsl */ `void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * 0.7; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a); }`,
    });
    return { g, m };
  }, []);

  useEffect(
    () => () => {
      terrain.g.dispose();
      terrain.m.dispose();
      constellation.g.dispose();
      constellation.lineMat.dispose();
      constellation.starMat.dispose();
      peakGlow.dispose();
      sky.g.dispose();
      sky.m.dispose();
    },
    [terrain, constellation, peakGlow, sky],
  );

  useFrame((_, dt) => {
    const a = activity('lifeatlas');
    if (performance.now() - a.lastRendered > 500) return;
    a.time += Math.min(dt, 0.05);
    terrain.m.uniforms.uTime!.value = a.time;
    // Hover: the life path draws itself; at rest it is fully drawn.
    const target = a.hover > 0.5 ? (a.time * 0.35) % 1.25 : 1;
    const u = constellation.lineMat.uniforms.uProgress!;
    u.value = a.hover > 0.5 ? Math.min(1, target) : u.value + (1 - (u.value as number)) * 0.08;
    constellation.starMat.uniforms.uProgress!.value = u.value;
    constellation.starMat.uniforms.uTime!.value = a.time;
  });

  return (
    <>
      <color attach="background" args={['#040a10']} />
      <points geometry={sky.g} material={sky.m} />
      <mesh geometry={terrain.g} material={terrain.m} position={[0, 0, -4]} />
      <primitive object={constellation.line} position={[0, 0, -4]} />
      <points geometry={constellation.g} material={constellation.starMat} position={[0, 0, -4]} />
      <mesh material={peakGlow} position={[1.2, 5.2, -12]}>
        <planeGeometry args={[6, 6]} />
      </mesh>
    </>
  );
}

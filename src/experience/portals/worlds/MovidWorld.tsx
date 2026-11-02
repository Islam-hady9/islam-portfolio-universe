'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
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
  const reflectRef = useRef<InstancedMesh>(null);
  const count = ROWS * COLS;

  const geometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const rand = mulberry32(12);
    const seeds = new Float32Array(count);
    const cols = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seeds[i] = rand();
      cols[i] = (i % COLS) / (COLS - 1);
    }
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    g.setAttribute('aCol', new InstancedBufferAttribute(cols, 1));
    return g;
  }, [count]);

  const mats = useMemo(() => {
    const screen = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uReflect: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute float aCol;
        varying vec2 vUv; varying float vSeed; varying float vDepth; varying float vWorldY; varying float vCol;
        void main(){
          vUv = uv; vSeed = aSeed; vCol = aCol;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec4 mv = viewMatrix * w;
          vDepth = -mv.z; vWorldY = w.y;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; uniform float uReflect;
        varying vec2 vUv; varying float vSeed; varying float vDepth; varying float vWorldY; varying float vCol;
        ${NOISE_GLSL}
        float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
        void main(){
          // Bezel: a rounded glass inset in a dark frame (screen plane is 1.9 × 1.15).
          vec2 p = (vUv - 0.5) * vec2(1.652, 1.0);
          vec2 g = vec2(0.826, 0.5) - vec2(0.042, 0.042);
          float gd = sdBox(p, g, 0.022);
          float w = fwidth(gd);
          float glass = 1.0 - smoothstep(-w, w, gd);
          float lip = 1.0 - smoothstep(0.0, 0.005 + w, abs(gd));
          vec2 uv = clamp(p / g * 0.5 + 0.5, 0.0, 1.0);
          float t = uTime * (0.25 + vSeed * 0.5) + vSeed * 40.0;
          vec3 a = mix(vec3(0.18, 0.12, 0.45), vec3(0.08, 0.28, 0.5), vSeed);
          vec3 b = mix(vec3(0.6, 0.45, 1.0), vec3(0.4, 0.8, 1.0), fract(vSeed * 7.0));
          float clouds = iu_fbm3(vec3(uv * 3.0 + vec2(t * 0.15, 0.0), vSeed * 10.0));
          vec3 col = mix(a * 0.4, b * 0.9, smoothstep(0.35, 0.8, clouds));
          // Abstract footage variants: graded landscape, waveform, levels, edit timeline, scope.
          float kind = floor(fract(vSeed * 13.0) * 5.0);
          if (kind < 0.5) {
            vec3 sky = mix(b * 0.5, a * 0.25, uv.y);
            float ridge = 0.32 + 0.12 * iu_noise3(vec3(uv.x * 4.0 + t * 0.05, vSeed * 9.0, 0.0)) + 0.05 * iu_noise3(vec3(uv.x * 14.0, vSeed, 1.0));
            float sun = exp(-pow(length((uv - vec2(0.68, 0.62)) * vec2(1.6, 1.0)) / 0.08, 2.0));
            col = mix(sky + b * sun * 1.2, a * 0.08, smoothstep(ridge + 0.004, ridge - 0.004, uv.y));
            col += b * smoothstep(0.01, 0.0, abs(uv.y - ridge)) * 0.4;
          } else if (kind < 1.5) {
            float wv = smoothstep(0.02, 0.0, abs(uv.y - 0.5 - 0.18 * sin(uv.x * 22.0 + t * 3.0) * iu_noise3(vec3(uv.x * 6.0, t, 1.0))));
            col = col * 0.5 + vec3(0.7, 0.6, 1.0) * wv;
          } else if (kind < 2.5) {
            float bars = step(0.6, fract(uv.x * 6.0 + t * 0.4)) * step(uv.y, 0.25 + 0.5 * iu_noise3(vec3(floor(uv.x * 6.0), t * 0.5, 2.0)));
            col += b * bars * 0.5;
          } else if (kind < 3.5) {
            // Edit timeline: three lanes of clips and a moving playhead.
            float lane = floor(uv.y * 4.0);
            float lv = fract(uv.y * 4.0);
            float clip = step(0.18, lv) * step(lv, 0.82) * step(0.12, fract(uv.x * (2.0 + lane) + lane * 0.37 + vSeed));
            float head = smoothstep(0.006, 0.0, abs(uv.x - fract(t * 0.08)));
            col = a * 0.15 + mix(a, b, lane / 3.0) * clip * 0.55 * step(lane, 2.5) + vec3(0.9, 0.85, 1.0) * head * 0.9;
          } else {
            // Vectorscope: graticule circle and a drifting cluster.
            vec2 q = (uv - 0.5) * vec2(1.65, 1.0);
            float r = length(q);
            float grat = smoothstep(0.006, 0.0, abs(r - 0.36)) * 0.6 + smoothstep(0.004, 0.0, min(abs(q.x), abs(q.y))) * step(r, 0.36) * 0.25;
            vec2 c = vec2(0.12 * sin(t * 0.4), 0.1 * cos(t * 0.33));
            float cluster = exp(-dot(q - c, q - c) * 90.0) * (0.6 + 0.4 * iu_noise3(vec3(q * 30.0, t)));
            col = a * 0.12 + b * (grat * 0.6 + cluster * 0.9);
          }
          float scan = 0.94 + 0.06 * sin(uv.y * 240.0);
          float vig = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x) * smoothstep(0.0, 0.14, uv.y) * smoothstep(1.0, 0.86, uv.y);
          // A signal travels across the arc (left → right); each screen lights as it passes.
          float sig = exp(-pow((vCol - (fract(uTime * 0.07) * 1.6 - 0.3)) / 0.09, 2.0));
          col = col * scan * (0.32 + 0.68 * vig) * (0.72 + uHover * 0.45 + sig * 0.55);
          // Glass reflection: a soft diagonal sheen.
          col += vec3(0.55, 0.5, 0.95) * smoothstep(0.12, 0.0, abs(uv.x * 0.8 + uv.y - 1.05)) * 0.035;
          vec3 bezel = vec3(0.02, 0.018, 0.034) + vec3(0.5, 0.45, 0.95) * lip * (0.32 + sig * 0.9 + uHover * 0.2);
          col = mix(bezel, col, glass);
          // Depth: screens further round the arc recede; the floor mirror fades below the horizon.
          col *= mix(1.0, 0.48, smoothstep(7.5, 13.0, vDepth));
          if (uReflect > 0.5) col *= 0.2 * smoothstep(-5.5, -0.2, vWorldY);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const hero = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uHover: { value: 0 }, uReflect: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying float vWorldY; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorldY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uHover; uniform float uReflect; varying vec2 vUv; varying float vWorldY;
        ${NOISE_GLSL}
        float sdTri(vec2 p, float r){
          const float k = 1.7320508;
          p = vec2(-p.y, p.x);
          p.x = abs(p.x) - r; p.y = p.y + r / k;
          if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
          p.x -= clamp(p.x, -2.0 * r, 0.0);
          return -length(p) * sign(p.y);
        }
        void main(){
          vec2 uv = vUv;
          vec2 p = (uv - 0.5) * vec2(1.714, 1.0);
          // Cinematic frame: graded sky over a horizon, letterbox bars.
          vec3 sky = mix(vec3(0.2, 0.12, 0.4), vec3(0.05, 0.035, 0.13), uv.y);
          sky += vec3(0.5, 0.35, 0.9) * exp(-pow((uv.y - 0.4) / 0.08, 2.0)) * 0.25;
          vec3 col = mix(sky, vec3(0.04, 0.03, 0.1), iu_fbm3_lo(vec3(uv * 2.5, uTime * 0.1)) * 0.6);
          float bars = step(uv.y, 0.075) + step(0.925, uv.y);
          col = mix(col, vec3(0.012, 0.01, 0.025), bars);
          // Play element: rounded triangle inside a ring with a slow progress arc.
          float d = sdTri(p - vec2(0.012, 0.0), 0.085) - 0.018;
          float w = fwidth(d);
          float play = 1.0 - smoothstep(-w, w, d);
          float glow = exp(-max(d, 0.0) * 16.0);
          float r = length(p);
          float wr = fwidth(r);
          float ring = 1.0 - smoothstep(0.004 - wr, 0.004 + wr, abs(r - 0.19));
          float ang = atan(p.x, p.y) / 6.2831853 + 0.5;
          float prog = (1.0 - smoothstep(0.007 - wr, 0.007 + wr, abs(r - 0.19))) * step(ang, fract(uTime * 0.05));
          float pulse = 0.88 + 0.12 * sin(uTime * 2.2) + uHover * 0.5;
          vec3 violet = vec3(0.62, 0.52, 1.0);
          col = col * 0.75 + violet * (play * 1.5 + glow * 0.4) * pulse + violet * (ring * 0.35 + prog * 0.9);
          // Light sweep across the glass every few seconds.
          float sw = fract(uTime * 0.12);
          col += vec3(0.7, 0.65, 1.0) * smoothstep(0.06, 0.0, abs(uv.x + uv.y * 0.5 - sw * 2.4 + 0.4)) * 0.12;
          float frame = 1.0 - step(0.012, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
          col += vec3(0.5, 0.45, 0.9) * frame * 0.6;
          if (uReflect > 0.5) col *= 0.22 * smoothstep(-4.5, -0.2, vWorldY);
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
          // Light pool the hero screen throws onto the polished floor.
          float pool = exp(-(vW.x * vW.x / 5.0 + pow(vW.z + 8.2, 2.0) / 9.0));
          col += vec3(0.42, 0.32, 0.95) * pool * 0.09;
          // Polished floor: dark tint over the mirrored wall, opaque far away.
          float a = mix(0.62, 1.0, smoothstep(6.0, 14.0, d));
          gl_FragColor = vec4((col + grid) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
    });
    const figure = new MeshStandardMaterial({ color: '#030305', roughness: 0.9 });
    // Same side on originals and mirrors → one shader program each (mirrors flip winding).
    screen.side = DoubleSide;
    hero.side = DoubleSide;
    const screenMirror = screen.clone();
    screenMirror.uniforms = { ...screen.uniforms, uReflect: { value: 1 } };
    const heroMirror = hero.clone();
    heroMirror.uniforms = { ...hero.uniforms, uReflect: { value: 1 } };
    return { screen, hero, screenMirror, heroMirror, floor, figure, haze: glowMaterial('#8b7cff', 0.2, 2.2) };
  }, []);

  const figureGeometry = useMemo(() => buildExplorerGeometry(), []);

  useLayoutEffect(() => {
    const m = screensRef.current;
    const reflect = reflectRef.current;
    if (!m) return;
    const o = new Object3D();
    const flipY = new Matrix4().makeScale(1, -1, 1);
    const mirror = new Matrix4();
    const radius = 9;
    const span = Math.PI * 0.7;
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = -span / 2 + (c / (COLS - 1)) * span;
        const center = c === Math.floor(COLS / 2) && r === 1;
        const y = 1.4 + r * 1.55;
        // Outer rows sit slightly deeper than the middle one: the wall reads in layers.
        const rr = radius + (r === 1 ? 0 : 0.35);
        o.position.set(Math.sin(a) * rr, y, -Math.cos(a) * rr - 1);
        o.lookAt(0, y * 0.85, 2);
        const w = center ? 0.01 : 1.9;
        o.scale.set(w, center ? 0.01 : 1.15, 1);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        mirror.copy(o.matrix).premultiply(flipY);
        reflect?.setMatrixAt(i, mirror);
        i++;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (reflect) reflect.instanceMatrix.needsUpdate = true;
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
      <instancedMesh ref={reflectRef} args={[geometry, mats.screenMirror, count]} frustumCulled={false} />
      <mesh material={mats.hero} position={[0, 2.95, -9.6]}>
        <planeGeometry args={[3.6, 2.1]} />
      </mesh>
      <mesh material={mats.heroMirror} position={[0, -2.95, -9.6]} scale={[1, -1, 1]}>
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

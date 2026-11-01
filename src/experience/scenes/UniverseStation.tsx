'use client';

import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineSegments,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { TierConfig } from '../quality/tiers';
import { WORLD } from '../orchestrator/camera-path';
import { frame } from '../orchestrator/frame-state';
import { registerNodeApproach } from '../orchestrator/transitions';
import { ORBIT_TRACKS, UNIVERSE_LAYOUT, type NodeId } from '../universe-layout';
import { useExperience } from '@/state/experience-store';
import { MOTION } from '@/lib/motion';
import { Galaxy } from '../objects/Galaxy';
import { NOISE_GLSL } from '../shaders/noise';

const ACCENT: Record<NodeId, string> = {
  'ai-systems': '#52c7ea',
  products: '#7ef7c9',
  'case-studies': '#7fb2ff',
  contact: '#8b7cff',
  stack: '#7ef7c9',
  experience: '#8b7cff',
};

/** Galaxy plane orientation: seen ~19° above the plane with a slight roll (reference ellipse). */
const GALAXY_TILT: [number, number, number] = [0.34, 0, -0.07];
const NODE_IDS = Object.keys(UNIVERSE_LAYOUT) as NodeId[];

function nodeLocal(id: NodeId, t: number): Vector3 {
  const l = UNIVERSE_LAYOUT[id];
  // Each node breathes gently along its orbit (stable targets, still alive).
  const a = (l.angle * Math.PI) / 180 + Math.sin(t * 0.21 + l.radius) * 0.035;
  return new Vector3(Math.cos(a) * l.radius, l.lift, -Math.sin(a) * l.radius);
}

function buildTrack(radius: number) {
  const n = 512;
  const pos = new Float32Array((n + 1) * 3);
  const ang = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pos.set([Math.cos(a) * radius, 0, -Math.sin(a) * radius], i * 3);
    ang[i] = a;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aAngle', new BufferAttribute(ang, 1));
  return g;
}

const TRACK_VERTEX = /* glsl */ `
  attribute float aAngle;
  varying float vAngle;
  void main() { vAngle = aAngle; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const TRACK_FRAGMENT = /* glsl */ `
  uniform float uFade;
  uniform float uDots;
  uniform float uHiAngle;
  uniform float uHi;
  uniform vec3 uHiColor;
  varying float vAngle;
  void main() {
    float dots = step(0.55, fract(vAngle * uDots / 6.2831853));
    float d = abs(atan(sin(vAngle - uHiAngle), cos(vAngle - uHiAngle)));
    float arc = smoothstep(0.75, 0.0, d) * uHi;
    vec3 base = vec3(0.62, 0.68, 0.78) * (0.18 + 0.22 * dots);
    vec3 col = base + uHiColor * arc * 1.8;
    float a = (0.35 + 0.4 * dots + arc) * uFade;
    gl_FragColor = vec4(col * a, a);
  }
`;

/**
 * S3 world: tilted galaxy, orbit tracks, six destinations. Projects each node to screen space
 * every frame and pins the matching DOM link (fixed position) so labels track the 3D exactly.
 */
export function UniverseStation({ cfg, pixelRatio }: { cfg: TierConfig; pixelRatio: number }) {
  const root = useRef<Group>(null);
  const plane = useRef<Group>(null);
  const markers = useRef<Record<string, Mesh | null>>({});
  const camera = useThree((s) => s.camera);
  const hovered = useExperience((s) => s.hoveredNode);
  const hoveredRef = useRef<string | null>(null);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  const tracks = useMemo(
    () =>
      ORBIT_TRACKS.map((r, i) => ({
        geometry: buildTrack(r),
        material: new ShaderMaterial({
          uniforms: {
            uFade: { value: 0 },
            uDots: { value: 140 + i * 30 },
            uHiAngle: { value: 0 },
            uHi: { value: 0 },
            uHiColor: { value: new Color('#7ef7c9') },
          },
          vertexShader: TRACK_VERTEX,
          fragmentShader: TRACK_FRAGMENT,
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
        radius: r,
      })),
    [],
  );

  const links = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(NODE_IDS.length * 2 * 3);
    const t = new Float32Array(NODE_IDS.length * 2);
    const idx = new Float32Array(NODE_IDS.length * 2);
    NODE_IDS.forEach((_, i) => {
      t[i * 2] = 0;
      t[i * 2 + 1] = 1;
      idx[i * 2] = i;
      idx[i * 2 + 1] = i;
    });
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aT', new BufferAttribute(t, 1));
    g.setAttribute('aIndex', new BufferAttribute(idx, 1));
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uHiIndex: { value: -1 } },
      vertexShader: /* glsl */ `
        attribute float aT; attribute float aIndex; varying float vT; varying float vI;
        void main(){ vT = aT; vI = aIndex; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uFade; uniform float uHiIndex; varying float vT; varying float vI;
        void main(){
          float hi = 1.0 - step(0.5, abs(vI - uHiIndex));
          float flow = smoothstep(0.0, 0.35, fract(vT * 3.0 - uTime * 0.35));
          float packet = smoothstep(0.9, 1.0, fract(vT - uTime * 0.3 + vI * 0.137)) * smoothstep(0.05, 0.3, vT);
          float a = (0.05 + 0.12 * flow + hi * (0.25 + 0.5 * flow) + packet * (0.4 + hi * 0.6)) * uFade * smoothstep(0.0, 0.25, vT);
          vec3 c = mix(vec3(0.6, 0.65, 0.9), vec3(0.5, 1.0, 0.85), hi);
          gl_FragColor = vec4(c * a * 1.6, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    return { g, m };
  }, []);

  // Scene objects built once (never constructed during render).
  const lineObjects = useMemo(
    () => ({
      tracks: tracks.map((tr) => new Line(tr.geometry, tr.material)),
      links: new LineSegments(links.g, links.m),
    }),
    [tracks, links],
  );

  const markerMats = useMemo(() => {
    const out: Record<string, ShaderMaterial> = {};
    for (const id of NODE_IDS) {
      out[id] = new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(ACCENT[id]) },
          uIntensity: { value: 1 },
          uRipple: { value: 0 },
        },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uIntensity; uniform float uRipple; varying vec2 vUv;
          void main(){
            float d = length(vUv - 0.5) * 2.0;
            float core = smoothstep(0.22, 0.0, d);
            float halo = exp(-d * d * 7.0);
            float ring = smoothstep(0.05, 0.0, abs(d - 0.62)) * 0.5;
            float ripple = smoothstep(0.05, 0.0, abs(d - uRipple * 0.97)) * (1.0 - uRipple) * step(0.001, uRipple) * 1.6;
            vec3 c = uColor * (halo * 1.4 + ring + ripple) + vec3(1.0) * core * 0.9;
            float a = clamp(halo + core * 0.4 + ring + ripple, 0.0, 1.0) * uIntensity;
            gl_FragColor = vec4(c * uIntensity, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      });
    }
    return out;
  }, []);

  // Destination worldlets: small lit bodies (light from the galactic core) so every node is an
  // object in space with depth and parallax, not just a glow sprite.
  const worldlets = useMemo(() => {
    const geometry = new SphereGeometry(1, 32, 24);
    const mats: Record<string, ShaderMaterial> = {};
    NODE_IDS.forEach((id, i) => {
      mats[id] = new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(ACCENT[id]) },
          uLight: { value: new Vector3(0, 0, 1) },
          uHover: { value: 0 },
          uFade: { value: 0 },
          uSeed: { value: i * 1.73 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vView; varying vec3 vObj;
          void main(){
            vObj = position;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vN = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - wp.xyz);
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform vec3 uLight; uniform float uHover; uniform float uFade; uniform float uSeed;
          varying vec3 vN; varying vec3 vView; varying vec3 vObj;
          ${NOISE_GLSL}
          void main(){
            vec3 n = normalize(vN);
            float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.4);
            float lit = max(dot(n, normalize(uLight)), 0.0);
            float terrain = iu_fbm3_lo(vObj * 2.2 + uSeed);
            vec3 body = mix(vec3(0.03, 0.035, 0.05), uColor * 0.32, smoothstep(0.35, 0.75, terrain));
            vec3 col = body * (0.18 + 1.1 * lit) + uColor * fres * (0.9 + uHover * 1.4);
            gl_FragColor = vec4(col * uFade, 1.0);
          }`,
      });
    });
    return { geometry, mats };
  }, []);
  const worldletRefs = useRef<Record<string, Mesh | null>>({});
  const selected = useRef<{ id: string; t0: number } | null>(null);

  useEffect(
    () => () => {
      tracks.forEach((t) => {
        t.geometry.dispose();
        t.material.dispose();
      });
      links.g.dispose();
      links.m.dispose();
      Object.values(markerMats).forEach((m) => m.dispose());
      worldlets.geometry.dispose();
      Object.values(worldlets.mats).forEach((m) => m.dispose());
    },
    [tracks, links, markerMats, worldlets],
  );

  // DOM bridge: switch the node list into live mode while this station is mounted (desktop only).
  const domRef = useRef<{ list: HTMLElement | null; items: Map<string, HTMLElement> }>({
    list: null,
    items: new Map(),
  });
  useEffect(() => {
    const list = document.querySelector<HTMLElement>('[data-universe-nodes]');
    const items = new Map<string, HTMLElement>();
    list?.querySelectorAll<HTMLElement>('[data-node]').forEach((el) => items.set(el.dataset.node!, el));
    domRef.current = { list, items };
    return () => {
      if (list) list.dataset.mode = 'static';
      items.forEach((el) => {
        el.style.transform = '';
        el.removeAttribute('data-visible');
      });
    };
  }, []);

  // Camera approach toward a selected node (spec S3: controlled approach, then navigate).
  useEffect(() => {
    registerNodeApproach((nodeId, done) => {
      const p = plane.current;
      if (!p || !(nodeId in UNIVERSE_LAYOUT)) return done();
      selected.current = { id: nodeId, t0: frame.time };
      const world = p.localToWorld(nodeLocal(nodeId as NodeId, frame.time));
      frame.approach.x = world.x;
      frame.approach.y = world.y;
      frame.approach.z = world.z;
      gsap.killTweensOf(frame.approach);
      gsap.to(frame.approach, {
        weight: 1,
        duration: MOTION.duration.commit,
        ease: MOTION.ease.commit,
        onComplete: () => {
          done();
          gsap.to(frame.approach, {
            weight: 0,
            duration: MOTION.duration.settle,
            ease: MOTION.ease.release,
            delay: 0.05,
          });
        },
      });
    });
    return () => {
      registerNodeApproach(null);
      gsap.killTweensOf(frame.approach);
      frame.approach.weight = 0;
    };
  }, []);

  const v = useMemo(() => new Vector3(), []);
  const hiTrackColor = useMemo(() => new Color(), []);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const p =
      frame.route === 'home'
        ? Math.max(frame.presence[2] ?? 0, (frame.presence[1] ?? 0) * 0.7, (frame.presence[3] ?? 0) * 0.7)
        : 0;
    const visible = frame.route === 'home' && frame.s > 0.6 && frame.s < 3.8;
    g.visible = visible;
    const { list, items } = domRef.current;
    const desktop = frame.viewportW >= 768;
    if (list) list.dataset.mode = visible && desktop ? 'live' : 'static';
    if (!visible) return;

    const t = frame.time;
    const hov = hoveredRef.current;
    const hoverIndex = hov ? NODE_IDS.indexOf(hov as NodeId) : -1;

    // Orbit tracks: fade with presence; highlight the arc around the hovered node.
    tracks.forEach((tr) => {
      const u = tr.material.uniforms;
      u.uFade!.value = p;
      let hi = 0;
      if (hov) {
        const l = UNIVERSE_LAYOUT[hov as NodeId];
        if (Math.abs(l.radius - tr.radius) < 0.45) {
          hi = 1;
          u.uHiAngle!.value = (l.angle * Math.PI) / 180;
          hiTrackColor.set(ACCENT[hov as NodeId]);
          (u.uHiColor!.value as Color).copy(hiTrackColor);
        }
      }
      u.uHi!.value += (hi - (u.uHi!.value as number)) * 0.12;
    });

    links.m.uniforms.uTime!.value = t;
    links.m.uniforms.uFade!.value = p;
    links.m.uniforms.uHiIndex!.value = hoverIndex;
    const lp = links.g.attributes.position as BufferAttribute;

    NODE_IDS.forEach((id, i) => {
      const local = nodeLocal(id, t);
      lp.setXYZ(i * 2, 0, 0, 0);
      lp.setXYZ(i * 2 + 1, local.x, local.y, local.z);
      const m = markers.current[id];
      const isHov = hov === id;
      if (m) {
        m.position.copy(local);
        // Billboard in world space: undo the tilted parent rotation.
        m.quaternion.copy(plane.current!.quaternion).invert().multiply(camera.quaternion);
        const target = isHov ? 1.7 : 1;
        m.scale.setScalar(m.scale.x + (target - m.scale.x) * 0.15);
        markerMats[id]!.uniforms.uIntensity!.value = p * (isHov ? 1.6 : 1);
        const sel = selected.current;
        const ripple = sel && sel.id === id ? Math.min(1, (t - sel.t0) / 0.9) : 0;
        markerMats[id]!.uniforms.uRipple!.value = ripple >= 1 ? 0 : ripple;
      }
      const w = worldletRefs.current[id];
      if (w) {
        w.position.copy(local);
        const target = isHov ? 0.19 : 0.13;
        w.scale.setScalar(w.scale.x + (target - w.scale.x) * 0.15);
        w.rotation.y = t * 0.25 + i;
        const u = worldlets.mats[id]!.uniforms;
        u.uFade!.value = p;
        u.uHover!.value += ((isHov ? 1 : 0) - (u.uHover!.value as number)) * 0.15;
        // Light from the galactic core: direction from this node toward the plane origin.
        (u.uLight!.value as Vector3)
          .copy(local)
          .negate()
          .applyQuaternion(plane.current!.quaternion)
          .normalize();
      }
      // Project to screen for the DOM link.
      const el = items.get(id);
      if (el && desktop) {
        v.copy(local);
        plane.current!.localToWorld(v);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * frame.viewportW;
        const y = (-v.y * 0.5 + 0.5) * frame.viewportH;
        const onScreen = v.z < 1 && x > -40 && x < frame.viewportW + 40 && y > 60 && y < frame.viewportH - 10;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        // Labels belong to this station only (not the blended fade used for the galaxy).
        const show = onScreen && (frame.presence[2] ?? 0) > 0.6;
        const flag = show ? 'true' : 'false';
        if (el.dataset.visible !== flag) el.dataset.visible = flag;
      }
    });
    lp.needsUpdate = true;
  });

  const [cx, cy, cz] = WORLD.galaxy.center;
  return (
    <group ref={root} position={[cx, cy, cz]}>
      <group ref={plane} rotation={GALAXY_TILT}>
        <Galaxy count={cfg.galaxyStars} radius={WORLD.galaxy.radius} pixelRatio={pixelRatio} />
        {lineObjects.tracks.map((obj, i) => (
          <primitive key={i} object={obj} />
        ))}
        <primitive object={lineObjects.links} />
        {NODE_IDS.map((id) => (
          <mesh
            key={`w-${id}`}
            ref={(el) => {
              worldletRefs.current[id] = el;
            }}
            geometry={worldlets.geometry}
            material={worldlets.mats[id]}
            scale={0.13}
          />
        ))}
        {NODE_IDS.map((id) => (
          <mesh
            key={id}
            ref={(el) => {
              markers.current[id] = el;
            }}
            material={markerMats[id]}
            renderOrder={10}
          >
            <planeGeometry args={[0.95, 0.95]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

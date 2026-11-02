'use client';

import { createPortal, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { TierConfig } from '../quality/tiers';
import { frame, type PortalTransitionState, type ScreenRect } from '../orchestrator/frame-state';
import { registerPortalTransition } from '../orchestrator/transitions';
import { damp } from '../orchestrator/scroll-map';
import { TONEMAP_GLSL } from '../shaders/noise';
import { getPortalHover, getPortalTracks, type PortalTrack } from './portal-registry';
import { activity } from './worlds/kit';
import { TibynWorld } from './worlds/TibynWorld';
import { MovidWorld } from './worlds/MovidWorld';
import { AtsWorld } from './worlds/AtsWorld';
import { LifeAtlasWorld } from './worlds/LifeAtlasWorld';
import { useExperience } from '@/state/experience-store';
import { MOTION } from '@/lib/motion';

type WorldId = 'tibyn' | 'movid' | 'ats' | 'lifeatlas';
const WORLD_IDS: WorldId[] = ['tibyn', 'movid', 'ats', 'lifeatlas'];

/** Per-world camera framing (tuned against screenshots). */
const FRAMING: Record<
  WorldId,
  { pos: [number, number, number]; target: [number, number, number]; fov: number }
> = {
  tibyn: { pos: [0, 2.1, 8.8], target: [0, 0.8, -8], fov: 42 },
  movid: { pos: [0, 1.9, 7.2], target: [0, 2.5, -8], fov: 48 },
  ats: { pos: [0.5, 1.0, 7.8], target: [0, 0.75, -1.2], fov: 40 },
  lifeatlas: { pos: [0, 4.2, 10.5], target: [0, 2.2, -8], fov: 44 },
};

const COMPOSITE_VERTEX = /* glsl */ `
  uniform vec4 uRect;      // x, y, w, h (CSS px, top-left origin)
  uniform vec2 uViewport;  // CSS px
  varying vec2 vUv;
  varying vec2 vLocal;
  void main() {
    vUv = uv;
    vec2 px = vec2(uRect.x + uv.x * uRect.z, uRect.y + (1.0 - uv.y) * uRect.w);
    vLocal = (uv - 0.5) * uRect.zw;
    gl_Position = vec4(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0, 0.0, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec4 uRect;
  uniform vec2 uUvScale;
  uniform float uRadius;
  uniform float uOpacity;
  uniform float uFadeBottom;
  varying vec2 vUv;
  varying vec2 vLocal;
  ${TONEMAP_GLSL}
  void main() {
    vec3 c = texture2D(uTex, vUv * uUvScale).rgb;
    c = iu_linearToSrgb(iu_aces(c * 1.05));
    vec2 half_ = uRect.zw * 0.5;
    vec2 q = abs(vLocal) - (half_ - uRadius);
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
    float a = clamp(0.5 - d, 0.0, 1.0);
    a *= mix(1.0, smoothstep(0.0, 0.32, vUv.y), uFadeBottom);
    a *= uOpacity;
    gl_FragColor = vec4(c * a, a);
  }
`;

interface TrackState {
  live: number;
  px: number;
  py: number;
  target: WebGLRenderTarget | null;
  allocW: number;
  allocH: number;
  seenAt: number;
}

function ensureTarget(
  st: TrackState,
  w: number,
  h: number,
  samples: number,
  reserve?: { w: number; h: number },
) {
  // Grow-only allocation; render into a viewport sub-region so animated sizes never reallocate.
  if (!st.target || w > st.allocW || h > st.allocH) {
    st.target?.dispose();
    st.allocW = Math.min(4096, Math.max(w, reserve?.w ?? 0, st.allocW));
    st.allocH = Math.min(4096, Math.max(h, reserve?.h ?? 0, st.allocH));
    st.target = new WebGLRenderTarget(st.allocW, st.allocH, {
      type: HalfFloatType,
      samples,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    });
  }
  st.target.viewport.set(0, 0, w, h);
  st.target.scissor.set(0, 0, w, h);
  st.target.scissorTest = true;
  return st.target;
}

/**
 * Project portals (spec S4, §11): four procedural worlds rendered into HDR targets and
 * composited into the DOM rects of the cards/case-study hero. One WebGL context; worlds only
 * render while engaged (hover/focus), on a case-study hero, or during a portal transition.
 */
export function PortalSystem({ cfg }: { cfg: TierConfig }) {
  const gl = useThree((s) => s.gl) as WebGLRenderer;
  const scenes = useMemo(
    () => Object.fromEntries(WORLD_IDS.map((id) => [id, new Scene()])) as Record<WorldId, Scene>,
    [],
  );
  const cameras = useMemo(
    () =>
      Object.fromEntries(
        WORLD_IDS.map((id) => [id, new PerspectiveCamera(FRAMING[id].fov, 1, 0.1, 200)]),
      ) as Record<WorldId, PerspectiveCamera>,
    [],
  );
  const states = useRef(new Map<PortalTrack | 'transition', TrackState>());

  const composite = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: {
        uTex: { value: null },
        uRect: { value: new Vector4() },
        uViewport: { value: new Vector2(1, 1) },
        uUvScale: { value: new Vector2(1, 1) },
        uRadius: { value: 0 },
        uOpacity: { value: 1 },
        uFadeBottom: { value: 0 },
      },
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    return { scene, material, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);

  // Precompile the portal worlds (linear HDR targets) shortly after the main world is ready,
  // so the first hover/transition does not hitch on shader compilation.
  useEffect(() => {
    if (!cfg.livePortals) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const rt = new WebGLRenderTarget(4, 4, { type: HalfFloatType });
      const prev = gl.getRenderTarget();
      gl.setRenderTarget(rt);
      for (const id of WORLD_IDS) {
        try {
          void gl.compileAsync(scenes[id], cameras[id]).catch(() => undefined);
        } catch {
          /* compile errors surface on first render instead */
        }
      }
      gl.setRenderTarget(prev);
      rt.dispose();
    }, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [gl, scenes, cameras, cfg.livePortals]);

  // Portal transition handler (card → case study).
  useEffect(() => {
    registerPortalTransition((slug, source, done) => {
      const track =
        [...getPortalTracks()].find((t) => t.el === source) ??
        [...getPortalTracks()].find((t) => t.slug === slug);
      if (!track || !WORLD_IDS.includes(track.world as WorldId)) return done();
      const r = source.getBoundingClientRect();
      const state: PortalTransitionState & { world: string; startedAt: number } = {
        slug,
        world: track.world,
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        radius: 20,
        depth: 0,
        phase: 'expanding',
        startedAt: performance.now(),
      };
      frame.portal = state;
      useExperience
        .getState()
        .setPortal({ slug, phase: 'expanding', from: { x: r.left, y: r.top, w: r.width, h: r.height } });
      document.documentElement.setAttribute('data-portal', 'active');
      const tl = gsap.timeline({
        onComplete: () => {
          state.phase = 'holding';
          state.startedAt = performance.now();
          done();
        },
      });
      tl.to(
        state.rect,
        {
          x: 0,
          y: 0,
          w: window.innerWidth,
          h: window.innerHeight,
          duration: MOTION.duration.portal,
          ease: MOTION.ease.travel,
        },
        0,
      );
      tl.to(state, { radius: 0, depth: 1, duration: MOTION.duration.portal, ease: MOTION.ease.travel }, 0);
    });
    return () => registerPortalTransition(null);
  }, []);

  useEffect(
    () => () => {
      states.current.forEach((s) => s.target?.dispose());
      states.current.clear();
      composite.material.dispose();
      (composite.scene.children[0] as Mesh).geometry.dispose();
      document.documentElement.removeAttribute('data-portal');
    },
    [composite],
  );

  const endTransition = () => {
    frame.portal = null;
    useExperience.getState().setPortal(null);
    document.documentElement.removeAttribute('data-portal');
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = gl.getPixelRatio();
    const samples = cfg.multisampling > 0 ? 4 : 2;
    const now = performance.now();
    const portal = frame.portal as (PortalTransitionState & { world: string; startedAt: number }) | null;
    const transitionOverCanvas = portal !== null && portal.phase !== 'settling';

    if (transitionOverCanvas) {
      // Main pass is paused; the canvas sits above the page — clear to transparent.
      gl.setRenderTarget(null);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false);
      gl.setClearColor(0x06070a, 1);
    }

    const renderWorld = (
      key: PortalTrack | 'transition',
      world: WorldId,
      slug: string,
      rect: ScreenRect,
      opts: {
        radius: number;
        opacity: number;
        fadeBottom: number;
        depth: number;
      },
    ) => {
      let st = states.current.get(key);
      if (!st) {
        st = { live: 0, px: 0, py: 0, target: null, allocW: 0, allocH: 0, seenAt: now };
        states.current.set(key, st);
      }
      st.seenAt = now;
      const maxEdge = cfg.portalMaxSize;
      const scale = Math.min(dpr, maxEdge / Math.max(rect.w, rect.h, 1));
      const w = Math.max(2, Math.round(rect.w * scale));
      const h = Math.max(2, Math.round(rect.h * scale));
      // The transition grows to full screen: reserve the final size once up front.
      const fullScale = Math.min(dpr, maxEdge / Math.max(W, H));
      const reserve =
        key === 'transition' ? { w: Math.round(W * fullScale), h: Math.round(H * fullScale) } : undefined;
      const target = ensureTarget(st, w, h, samples, reserve);

      const hov = getPortalHover(slug);
      st.px = damp(st.px, hov ? hov.x : 0, 4, dt);
      st.py = damp(st.py, hov ? hov.y : 0, 4, dt);
      const act = activity(world);
      act.lastRendered = now;
      act.hover = damp(act.hover, hov ? 1 : 0, 3, dt);

      const f = FRAMING[world];
      const cam = cameras[world];
      const dolly = opts.depth * 0.38 + act.hover * 0.08;
      cam.fov = f.fov;
      cam.aspect = rect.w / Math.max(1, rect.h);
      cam.position.set(
        f.pos[0] + (f.target[0] - f.pos[0]) * dolly + st.px * 0.5,
        f.pos[1] + (f.target[1] - f.pos[1]) * dolly - st.py * 0.3,
        f.pos[2] + (f.target[2] - f.pos[2]) * dolly,
      );
      cam.lookAt(f.target[0] + st.px * 0.2, f.target[1] - st.py * 0.12, f.target[2]);
      cam.updateProjectionMatrix();

      gl.setRenderTarget(target);
      gl.setClearColor(0x000000, 1);
      gl.clear(true, true, false);
      gl.render(scenes[world], cam);
      gl.setRenderTarget(null);
      gl.setClearColor(0x06070a, 1);

      const u = composite.material.uniforms;
      u.uTex!.value = target.texture;
      (u.uRect!.value as Vector4).set(rect.x, rect.y, rect.w, rect.h);
      (u.uViewport!.value as Vector2).set(W, H);
      (u.uUvScale!.value as Vector2).set(w / st.allocW, h / st.allocH);
      u.uRadius!.value = opts.radius;
      u.uOpacity!.value = opts.opacity;
      u.uFadeBottom!.value = opts.fadeBottom;
      const prevAuto = gl.autoClear;
      gl.autoClear = false;
      gl.render(composite.scene, composite.camera);
      gl.autoClear = prevAuto;
    };

    // Track portals (cards / case-study heroes).
    const tracks = getPortalTracks();
    let heroForTransition: PortalTrack | null = null;
    tracks.forEach((track) => {
      if (!WORLD_IDS.includes(track.world as WorldId)) return;
      if (portal && track.kind === 'hero' && track.slug === portal.slug) heroForTransition = track;
      const r = track.el.getBoundingClientRect();
      const inView = r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
      const hov = getPortalHover(track.slug);
      const transitionOwns = portal !== null && portal.slug === track.slug;
      const want = inView && !transitionOwns && (track.kind === 'hero' || (cfg.livePortals && hov !== null));
      let st = states.current.get(track);
      if (!st) {
        st = { live: 0, px: 0, py: 0, target: null, allocW: 0, allocH: 0, seenAt: now };
        states.current.set(track, st);
      }
      // While the transition draws this hero, keep it fully live so the hand-off has no flash.
      if (transitionOwns && track.kind === 'hero') st.live = 1;
      else st.live = damp(st.live, want ? 1 : 0, want ? 5 : 7, dt);
      const owner = track.kind === 'card' ? track.el.closest<HTMLElement>('[data-project-card]') : track.el;
      const liveFlag = st.live > 0.5;
      if (owner && owner.hasAttribute('data-portal-live') !== liveFlag)
        owner.toggleAttribute('data-portal-live', liveFlag);
      if (st.live < 0.01 || transitionOverCanvas || transitionOwns) return;
      renderWorld(
        track,
        track.world as WorldId,
        track.slug,
        { x: r.left, y: r.top, w: r.width, h: r.height },
        {
          radius: track.kind === 'card' ? 20 : 0,
          opacity: st.live,
          fadeBottom: track.kind === 'hero' ? 1 : 0,
          depth: track.kind === 'hero' ? 0.25 : 0,
        },
      );
    });

    // Transition overlay.
    if (portal) {
      if (portal.phase === 'holding') {
        const hero = heroForTransition as PortalTrack | null;
        if (hero) {
          portal.phase = 'settling';
          // Canvas returns beneath the page; main pass resumes; morph into the hero's rect.
          useExperience.getState().setPortal(null);
          document.documentElement.setAttribute('data-portal', 'settling');
          const heroSt = states.current.get(hero);
          if (heroSt) heroSt.live = 1;
          const hr = hero.el.getBoundingClientRect();
          gsap.to(portal.rect, {
            x: hr.left,
            y: hr.top,
            w: hr.width,
            h: hr.height,
            duration: MOTION.duration.portalSettle,
            ease: MOTION.ease.release,
          });
          gsap.to(portal, {
            depth: 0.25,
            duration: MOTION.duration.portalSettle,
            ease: MOTION.ease.release,
            onComplete: endTransition,
          });
        } else if (now - portal.startedAt > 3000) {
          endTransition();
        }
      }
      if (frame.portal) {
        renderWorld('transition', portal.world as WorldId, portal.slug, portal.rect, {
          radius: portal.radius,
          opacity: 1,
          fadeBottom: portal.phase === 'settling' ? 1 : 0,
          depth: portal.depth,
        });
      }
    }

    // Dispose render targets for tracks that are gone or idle for a while.
    states.current.forEach((st, key) => {
      const gone = key !== 'transition' && !tracks.has(key as PortalTrack);
      if ((gone || now - st.seenAt > 8000) && st.target) {
        st.target.dispose();
        st.target = null;
        st.allocW = 0;
        st.allocH = 0;
      }
      if (gone) states.current.delete(key);
    });
  }, 2);

  return (
    <>
      {createPortal(<TibynWorld />, scenes.tibyn)}
      {createPortal(<MovidWorld />, scenes.movid)}
      {createPortal(<AtsWorld />, scenes.ats)}
      {createPortal(<LifeAtlasWorld />, scenes.lifeatlas)}
    </>
  );
}

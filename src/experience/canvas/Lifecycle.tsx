'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Object3D } from 'three';
import { useExperience } from '@/state/experience-store';
import { registerFrameHooks } from '@/lib/test-hooks';
import { track } from '@/lib/analytics';
import { frame } from '../orchestrator/frame-state';
import { GOVERNOR, shouldDowngrade, stepDown, type QualityTier } from '../quality/tiers';

let contextLosses = 0;

/** WebGL context loss / restore (spec §6.7, IU-017). DOM stays fully usable throughout. */
export function ContextGuard() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const canvas = gl.domElement;
    const ctx = gl.getContext();
    const ext = ctx.getExtension('WEBGL_lose_context');
    const onLost = (e: Event) => {
      e.preventDefault();
      contextLosses++;
      track('webgl_context_lost', { count: contextLosses });
      useExperience.getState().setWebGL(contextLosses >= 3 ? 'failed' : 'lost');
    };
    const onRestored = () => {
      window.dispatchEvent(new Event('iu:webgl-restore'));
    };
    canvas.addEventListener('webglcontextlost', onLost, false);
    canvas.addEventListener('webglcontextrestored', onRestored, false);
    registerFrameHooks({
      loseContext: () => {
        if (!ext) return false;
        ext.loseContext();
        return true;
      },
      restoreContext: () => {
        if (!ext) return false;
        ext.restoreContext();
        return true;
      },
    });
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);
  return null;
}

/**
 * Pre-compiles every program (including hidden stations) with KHR_parallel_shader_compile when
 * available, then reports "ready" after the first real frame. Prevents first-visit hitches
 * when travelling between stations.
 */
export function ReadySignal({ worldKey }: { worldKey: string }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const phase = useRef<'compiling' | 'armed' | 'done'>('compiling');

  useEffect(() => {
    let cancelled = false;
    phase.current = 'compiling';
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    let pending: Promise<unknown>;
    try {
      pending = gl.compileAsync(scene, camera);
    } catch (err) {
      pending = Promise.reject(err);
    }
    hidden.forEach((o) => (o.visible = false));
    pending
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) phase.current = 'armed';
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, worldKey]);

  useFrame(() => {
    if (phase.current !== 'armed') return;
    phase.current = 'done';
    const s = useExperience.getState();
    if (s.webgl !== 'ready') s.setWebGL('ready');
  }, 4);
  return null;
}

/** Hero intro: starts once the scene is ready and the prelude (if any) has ended. */
export function IntroDirector() {
  useFrame((_, dt) => {
    if (frame.reduced) {
      frame.intro = 1;
      frame.introStarted = true;
      return;
    }
    if (!frame.introStarted) {
      const ready = useExperience.getState().webgl === 'ready';
      const preludeDone = document.documentElement.getAttribute('data-intro') !== 'playing';
      if (ready && preludeDone) frame.introStarted = true;
      return;
    }
    if (frame.intro < 1) frame.intro = Math.min(1, frame.intro + Math.min(dt, 0.05) / 1.9);
  });
  return null;
}

/**
 * Runtime quality governor (spec §6.7): in "auto" mode, sustained low FPS steps the tier down
 * (ultra → balanced → lite → static). Windows containing hitches or tab switches are ignored.
 */
export function PerformanceGovernor({ tier }: { tier: QualityTier }) {
  const acc = useRef({ time: 0, frames: 0, warm: 0, downgrades: 0 });
  useFrame((_, dt) => {
    const s = useExperience.getState();
    if (s.qualityPreference !== 'auto' || s.webgl !== 'ready' || frame.reduced) return;
    const a = acc.current;
    if (dt > 0.25) {
      a.time = 0;
      a.frames = 0;
      return;
    }
    a.warm += dt;
    if (a.warm < GOVERNOR.warmupSeconds) return;
    a.time += dt;
    a.frames++;
    if (a.time < GOVERNOR.sampleSeconds) return;
    const fps = a.frames / a.time;
    a.time = 0;
    a.frames = 0;
    if (a.downgrades < GOVERNOR.maxDowngrades + 1 && shouldDowngrade(tier, fps)) {
      a.downgrades++;
      a.warm = 0;
      const next = stepDown(tier);
      track('quality_tier', { from: tier, to: next, fps: Math.round(fps) });
      s.setTier(next, `runtime: ${Math.round(fps)} fps average on ${tier}`);
      document.documentElement.setAttribute('data-quality', next);
      if (next === 'static') s.setWebGL('disabled');
    }
  });
  return null;
}

/** Read-only diagnostics for Playwright and manual QA (renderer.info, path state). */
export function Diagnostics() {
  const gl = useThree((s) => s.gl);
  // Count every pass of a frame (composer + portals), not just the last render call.
  useFrame(() => gl.info.reset(), -3);
  useEffect(() => {
    gl.info.autoReset = false;
    registerFrameHooks({
      frame: () => ({
        s: Number(frame.s.toFixed(3)),
        sTarget: Number(frame.sTarget.toFixed(3)),
        route: frame.route,
        intro: Number(frame.intro.toFixed(2)),
        fps: Math.round(frame.stats.fps),
        presence: Array.from(frame.presence.slice(0, 9)).map((p) => Number(p.toFixed(2))),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        pixelRatio: gl.getPixelRatio(),
        approach: Number(frame.approach.weight.toFixed(2)),
        portal: frame.portal ? { slug: frame.portal.slug, phase: frame.portal.phase } : null,
      }),
    });
  }, [gl]);
  return null;
}

'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useExperience, type SceneState } from '@/state/experience-store';
import { aspectClassFor, GROUND_TRANSITS, HOME_STATIONS, transitVeil } from './camera-path';
import { computeAnchors, damp, localOffset, presence, scrollToParam } from './scroll-map';
import { frame, resetFrameState } from './frame-state';

const STATE_INTERVAL = 0.25;

/**
 * The single scroll → world bridge (spec §6.2). Pulls native scrollY each frame (no scroll
 * listener, no smooth-scroll library), maps it to the station path, damps it, and publishes
 * presence/local offsets for the camera rig and scene objects. Low-frequency scene states
 * go to the store for tests and diagnostics.
 */
export function Orchestrator() {
  const pathname = usePathname() ?? '/';
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useExperience((s) => s.reducedMotion);
  const lastCut = useRef(0);
  const stateClock = useRef(0);

  // Route switch: home world vs. inner-page deep space.
  useEffect(() => {
    frame.route = pathname === '/' ? 'home' : 'inner';
    if (frame.route === 'home') {
      // Arriving on home mid-page (back button / anchor): start at the right station.
      frame.introStarted = frame.introStarted || window.scrollY > 40;
      if (frame.introStarted) frame.intro = 1;
    }
  }, [pathname]);

  useEffect(() => {
    frame.reduced = reduced;
    invalidate();
  }, [reduced, invalidate]);

  useEffect(() => () => resetFrameState(), []);

  // Anchor measurement: on resize, layout changes and route changes.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      frame.viewportW = window.innerWidth;
      frame.viewportH = window.innerHeight;
      frame.aspect = aspectClassFor(window.innerWidth, window.innerHeight);
      if (frame.route !== 'home') return;
      const boxes = HOME_STATIONS.map((st) => {
        const el = document.getElementById(st.section);
        if (!el) return { top: 0, height: 0 };
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, height: r.height };
      });
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      frame.anchors = computeAnchors(boxes, window.innerHeight, Math.max(0, maxScroll));
      invalidate();
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener('resize', schedule);
    // Reduced motion renders on demand: re-render on scroll.
    const onScroll = () => invalidate();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      frame.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      frame.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname, invalidate]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    frame.scrollY = window.scrollY;

    if (frame.route === 'home' && frame.anchors.length) {
      frame.sTarget = scrollToParam(frame.scrollY, frame.anchors);
      if (frame.reduced) {
        // Discrete stations with a short veil instead of continuous camera travel.
        const nearest = Math.round(frame.sTarget);
        if (nearest !== Math.round(frame.s)) {
          frame.veil = 1;
          lastCut.current = performance.now();
        }
        frame.s = nearest;
      } else {
        const gap = frame.sTarget - frame.s;
        if (Math.abs(gap) > 1.6) {
          // Large anchor jump: dip, then glide the final stretch (no dizzying fly-through).
          frame.veil = 1;
          frame.s = frame.sTarget - Math.sign(gap) * 0.45;
        }
        frame.s = damp(frame.s, frame.sTarget, 3.1, dt);
      }
      for (let i = 0; i < HOME_STATIONS.length; i++) {
        frame.presence[i] = presence(frame.s, i);
        frame.local[i] = localOffset(frame.scrollY, frame.anchors[i] ?? 0, frame.viewportH);
      }
      // Ground crossings between stations are masked by a short veil (0 at every station).
      frame.transit = transitVeil(frame.s, GROUND_TRANSITS[frame.aspect]);
    } else {
      frame.s = 0;
      frame.sTarget = 0;
      frame.transit = 0;
    }

    // Veil decays quickly (≈ 350 ms). On-demand rendering keeps ticking until it has faded.
    frame.veil = damp(frame.veil, 0, frame.reduced ? 9 : 7, dt);
    if (frame.reduced && frame.veil > 0.01) state.invalidate();

    const k = frame.reduced ? 1 : 1 - Math.exp(-3.2 * dt);
    frame.pointer.sx += ((frame.reduced ? 0 : frame.pointer.x) - frame.pointer.sx) * k;
    frame.pointer.sy += ((frame.reduced ? 0 : frame.pointer.y) - frame.pointer.sy) * k;
    if (!frame.reduced) frame.time += dt;

    // FPS sampling for the governor / diagnostics.
    if (rawDelta > 0 && rawDelta < 0.25) {
      frame.stats.frameMs += (rawDelta * 1000 - frame.stats.frameMs) * 0.05;
      frame.stats.fps = 1000 / frame.stats.frameMs;
      frame.stats.samples++;
    }

    stateClock.current += dt;
    if (stateClock.current > STATE_INTERVAL) {
      stateClock.current = 0;
      publishSceneStates();
    }
  }, -2);

  return null;
}

function publishSceneStates() {
  const store = useExperience.getState();
  const next: Record<string, SceneState> = {};
  const moving = frame.sTarget - frame.s;
  HOME_STATIONS.forEach((st, i) => {
    if (frame.route !== 'home') {
      next[st.id] = 'SUSPENDED';
      return;
    }
    const d = Math.abs(frame.s - i);
    const p = frame.presence[i] ?? 0;
    let state: SceneState;
    if (p > 0.85) state = 'ACTIVE';
    else if (p > 0.02)
      state =
        Math.sign(i - frame.s) === Math.sign(moving) && Math.abs(moving) > 0.01 ? 'ENTERING' : 'EXITING';
    else if (d < 2) state = 'READY';
    else state = 'SUSPENDED';
    next[st.id] = state;
  });
  const prev = store.sceneStates;
  const changed =
    Object.keys(next).some((k) => prev[k] !== next[k]) ||
    Object.keys(prev).length !== Object.keys(next).length;
  if (changed) store.setSceneStates(next);
}

import type { AspectClass } from './camera-path';

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortalTransitionState {
  slug: string;
  rect: ScreenRect;
  radius: number;
  /** 0 = card framing, 1 = fully entered (world camera dollied in). */
  depth: number;
  phase: 'expanding' | 'holding' | 'settling';
}

/**
 * Per-frame orchestration state. Mutated by the Orchestrator/CameraRig each frame and read
 * by scene objects — one owner per field (spec §6.2: never let tweens fight).
 */
export const frame = {
  route: 'home' as 'home' | 'inner',
  scrollY: 0,
  viewportW: 1,
  viewportH: 1,
  anchors: [] as number[],
  sTarget: 0,
  s: 0,
  presence: new Float32Array(16),
  local: new Float32Array(16),
  aspect: 'wide' as AspectClass,
  /** Smoothed pointer in [-1, 1] (fine pointers only). */
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },
  /** Ambient clock (frozen under reduced motion). */
  time: 0,
  /** Hero intro progress 0→1 (camera dolly, ring unfolding, core ignition). */
  intro: 0,
  introStarted: false,
  reduced: false,
  /** 0..1 dip used to mask large anchor jumps and reduced-motion cuts. */
  veil: 0,
  /** 0..1 veil from ground crossings between stations (a pure function of s). */
  transit: 0,
  approach: { weight: 0, x: 0, y: 0, z: 0 },
  /** Core emitter energy (written by OrbitalCore, read by WorldLights). */
  coreEnergy: 0,
  portal: null as PortalTransitionState | null,
  stats: { fps: 60, frameMs: 16.7, samples: 0 },
};

export function resetFrameState() {
  frame.s = 0;
  frame.sTarget = 0;
  frame.presence.fill(0);
  frame.local.fill(0);
  frame.intro = 0;
  frame.introStarted = false;
  frame.veil = 0;
  frame.transit = 0;
  frame.approach.weight = 0;
  frame.portal = null;
}

'use client';

/**
 * Shared, low-frequency experience state used by both the DOM interface and the WebGL layer.
 * Per-frame values (scroll parameter, camera pose) intentionally live in mutable singletons in
 * src/experience/orchestrator to avoid React re-renders at 60 fps.
 */
import { create } from 'zustand';
import type { SectionId } from '@/lib/routes';
import type { QualityPreference, QualityTier } from '@/experience/quality/tiers';

export type WebGLStatus = 'pending' | 'ready' | 'failed' | 'lost' | 'disabled';
export type MotionPreference = 'system' | 'reduced' | 'full';
export type SceneState =
  'UNLOADED' | 'PRELOADING' | 'READY' | 'ENTERING' | 'ACTIVE' | 'EXITING' | 'SUSPENDED' | 'FALLBACK';

export interface PortalTransition {
  slug: string;
  phase: 'expanding' | 'navigating' | 'settling';
  /** Viewport rect the transition started from. */
  from: { x: number; y: number; w: number; h: number };
}

interface ExperienceState {
  qualityPreference: QualityPreference;
  detectedTier: QualityTier | null;
  /** Whether the browser can create any WebGL context (independent of tier policy). */
  webglAvailable: boolean;
  tier: QualityTier;
  tierReason: string;
  motionPreference: MotionPreference;
  reducedMotion: boolean;
  webgl: WebGLStatus;
  intro: 'playing' | 'done';
  activeSection: SectionId | null;
  hoveredNode: string | null;
  focusCapability: string | null;
  portal: PortalTransition | null;
  sceneStates: Record<string, SceneState>;
  setQualityPreference: (p: QualityPreference) => void;
  setDetectedTier: (tier: QualityTier, reason: string, webglAvailable: boolean) => void;
  setTier: (tier: QualityTier, reason: string) => void;
  setMotionPreference: (p: MotionPreference) => void;
  setReducedMotion: (r: boolean) => void;
  setWebGL: (s: WebGLStatus) => void;
  setIntro: (s: 'playing' | 'done') => void;
  setActiveSection: (s: SectionId | null) => void;
  setHoveredNode: (id: string | null) => void;
  setFocusCapability: (id: string | null) => void;
  setPortal: (p: PortalTransition | null) => void;
  setSceneStates: (s: Record<string, SceneState>) => void;
}

export const useExperience = create<ExperienceState>((set) => ({
  qualityPreference: 'auto',
  detectedTier: null,
  webglAvailable: true,
  tier: 'balanced',
  tierReason: 'initial',
  motionPreference: 'system',
  reducedMotion: false,
  webgl: 'pending',
  intro: 'done',
  activeSection: null,
  hoveredNode: null,
  focusCapability: null,
  portal: null,
  sceneStates: {},
  setQualityPreference: (qualityPreference) => set({ qualityPreference }),
  setDetectedTier: (detectedTier, tierReason, webglAvailable) =>
    set({ detectedTier, tierReason, webglAvailable }),
  setTier: (tier, tierReason) => set({ tier, tierReason }),
  setMotionPreference: (motionPreference) => set({ motionPreference }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setWebGL: (webgl) => set({ webgl }),
  setIntro: (intro) => set({ intro }),
  setActiveSection: (activeSection) => set({ activeSection }),
  setHoveredNode: (hoveredNode) => set({ hoveredNode }),
  setFocusCapability: (focusCapability) => set({ focusCapability }),
  setPortal: (portal) => set({ portal }),
  setSceneStates: (sceneStates) => set({ sceneStates }),
}));

/**
 * Adaptive fidelity tiers (spec §6.7). Pure functions — no browser access — so the
 * selection policy is unit-tested. Signals are gathered by ./detect.ts.
 */

export const QUALITY_TIERS = ['ultra', 'balanced', 'lite', 'static'] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];
export type QualityPreference = 'auto' | QualityTier;
export type RenderTier = Exclude<QualityTier, 'static'>;

export interface TierConfig {
  /** [min, max] device pixel ratio passed to the renderer. */
  dpr: [number, number];
  bloom: boolean;
  multisampling: number;
  stars: number;
  galaxyStars: number;
  dust: number;
  fragments: number;
  sparks: number;
  terrainSegments: number;
  /** Live project mini-worlds on hover/focus (otherwise posters). */
  livePortals: boolean;
  /** Ultra-subtle capability data streams (spec S6: high tier only). */
  dataStreams: boolean;
  /** MeshPhysicalMaterial clearcoat/anisotropy on the core (ultra only: heavy cold shader compiles). */
  physicalMaterials: boolean;
  /** Maximum FBO edge for portal renders. */
  portalMaxSize: number;
  /** Hero core detail: 2 = seams, carriages, ticks, outer shell; 1 = lighter; 0 = essentials. */
  coreDetail: number;
}

export const TIER_CONFIG: Record<RenderTier, TierConfig> = {
  ultra: {
    dpr: [1, 2],
    bloom: true,
    multisampling: 4,
    stars: 5200,
    galaxyStars: 52000,
    dust: 1400,
    fragments: 72,
    sparks: 260,
    terrainSegments: 220,
    livePortals: true,
    dataStreams: true,
    physicalMaterials: true,
    portalMaxSize: 1600,
    coreDetail: 2,
  },
  balanced: {
    dpr: [1, 1.5],
    bloom: true,
    multisampling: 0,
    stars: 3200,
    galaxyStars: 26000,
    dust: 600,
    fragments: 40,
    sparks: 140,
    terrainSegments: 150,
    livePortals: true,
    dataStreams: false,
    physicalMaterials: false,
    portalMaxSize: 1100,
    coreDetail: 1,
  },
  lite: {
    dpr: [1, 1.25],
    bloom: false,
    multisampling: 0,
    stars: 1500,
    galaxyStars: 11000,
    dust: 180,
    fragments: 16,
    sparks: 40,
    terrainSegments: 90,
    livePortals: false,
    dataStreams: false,
    physicalMaterials: false,
    portalMaxSize: 800,
    coreDetail: 0,
  },
};

export interface DeviceSignals {
  webgl2: boolean;
  webgl1: boolean;
  /** Unmasked renderer string when exposed, else null. */
  renderer: string | null;
  maxTextureSize: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  coarsePointer: boolean;
  viewportWidth: number;
  saveData: boolean;
}

export interface TierDecision {
  tier: QualityTier;
  reason: string;
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i;
const DISCRETE_OR_STRONG =
  /nvidia|geforce|rtx|quadro|radeon rx|radeon pro|amd radeon(?!.*graphics)|apple m\d|apple gpu|arc\(tm\)|intel arc/i;
const INTEGRATED = /intel|uhd|iris|radeon\(tm\) graphics|vega \d+ graphics|mali|adreno|powervr/i;

/** Tier selection from capabilities — never from the UA string alone (spec §6.7). */
export function detectTier(s: DeviceSignals): TierDecision {
  if (!s.webgl1 && !s.webgl2) return { tier: 'static', reason: 'WebGL unavailable' };
  if (s.renderer && SOFTWARE_RENDERER.test(s.renderer)) {
    return { tier: 'static', reason: `software renderer (${s.renderer})` };
  }
  if (!s.webgl2) return { tier: 'lite', reason: 'WebGL 1 only' };
  if (s.maxTextureSize < 4096) return { tier: 'lite', reason: `max texture ${s.maxTextureSize}` };
  if (s.saveData) return { tier: 'lite', reason: 'data saver enabled' };
  const cores = s.hardwareConcurrency ?? 4;
  const mem = s.deviceMemory;
  if (cores <= 2 || (mem !== null && mem <= 2)) return { tier: 'lite', reason: 'low CPU/memory' };

  if (s.coarsePointer && s.viewportWidth < 1024) {
    // Phones/tablets: battery and thermal budgets favour the lighter tiers; only clearly
    // high-end devices get bloom + live portals.
    if (cores >= 8 && (mem === null || mem >= 6)) return { tier: 'balanced', reason: 'capable touch device' };
    return { tier: 'lite', reason: 'constrained touch device' };
  }

  if (s.renderer && DISCRETE_OR_STRONG.test(s.renderer))
    return { tier: 'ultra', reason: `strong GPU (${s.renderer})` };
  if (s.renderer && INTEGRATED.test(s.renderer))
    return { tier: 'balanced', reason: `integrated GPU (${s.renderer})` };
  return { tier: 'balanced', reason: 'unknown GPU — balanced default' };
}

export function resolveTier(
  preference: QualityPreference,
  detected: QualityTier,
  webglAvailable: boolean = detected !== 'static',
): QualityTier {
  if (preference === 'auto') return detected;
  // A user may always choose any tier the browser can run; without WebGL, 3D tiers are capped.
  // (A software renderer is "static" by policy, but an explicit user choice is honoured.)
  if (!webglAvailable && preference !== 'static') return 'static';
  return preference;
}

export function stepDown(tier: QualityTier): QualityTier {
  return tier === 'ultra' ? 'balanced' : tier === 'balanced' ? 'lite' : 'static';
}

/** Runtime governor thresholds: sustained average FPS below `min` steps the tier down. */
export const GOVERNOR = {
  sampleSeconds: 3,
  warmupSeconds: 2.5,
  min: { ultra: 42, balanced: 32, lite: 20 } as Record<RenderTier, number>,
  /** ultra → balanced → lite → static at most. */
  maxDowngrades: 3,
} as const;

export function shouldDowngrade(tier: QualityTier, avgFps: number): boolean {
  if (tier === 'static') return false;
  return avgFps < GOVERNOR.min[tier];
}

export function isQualityPreference(v: unknown): v is QualityPreference {
  return v === 'auto' || (typeof v === 'string' && (QUALITY_TIERS as readonly string[]).includes(v));
}

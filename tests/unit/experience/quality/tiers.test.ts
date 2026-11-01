import { describe, expect, it } from 'vitest';
import {
  GOVERNOR,
  QUALITY_TIERS,
  TIER_CONFIG,
  detectTier,
  isQualityPreference,
  resolveTier,
  shouldDowngrade,
  stepDown,
  type DeviceSignals,
  type QualityTier,
  type RenderTier,
} from '@/experience/quality/tiers';

/** A capable desktop with an unidentified GPU; each test overrides one signal. */
const signals = (overrides: Partial<DeviceSignals> = {}): DeviceSignals => ({
  webgl2: true,
  webgl1: true,
  renderer: null,
  maxTextureSize: 16384,
  hardwareConcurrency: 8,
  deviceMemory: 8,
  coarsePointer: false,
  viewportWidth: 1440,
  saveData: false,
  ...overrides,
});

const tierOf = (overrides: Partial<DeviceSignals>) => detectTier(signals(overrides)).tier;

describe('detectTier', () => {
  it('falls back to static without WebGL', () => {
    expect(detectTier(signals({ webgl1: false, webgl2: false }))).toEqual({
      tier: 'static',
      reason: 'WebGL unavailable',
    });
  });

  it.each([
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Microsoft Basic Render Driver',
  ])('treats software renderer "%s" as static', (renderer) => {
    const decision = detectTier(signals({ renderer }));
    expect(decision.tier).toBe('static');
    expect(decision.reason).toContain(renderer);
  });

  it('uses lite for WebGL 1 only', () => {
    expect(detectTier(signals({ webgl2: false }))).toEqual({ tier: 'lite', reason: 'WebGL 1 only' });
  });

  it('uses lite for small max texture sizes', () => {
    expect(tierOf({ maxTextureSize: 2048 })).toBe('lite');
    expect(tierOf({ maxTextureSize: 4096 })).toBe('balanced');
  });

  it('uses lite when data saver is on, even on a strong GPU', () => {
    expect(tierOf({ saveData: true, renderer: 'NVIDIA GeForce RTX 4090' })).toBe('lite');
  });

  it('uses lite for low memory or few cores', () => {
    expect(tierOf({ deviceMemory: 2 })).toBe('lite');
    expect(tierOf({ hardwareConcurrency: 2 })).toBe('lite');
    expect(tierOf({ deviceMemory: 2, renderer: 'NVIDIA GeForce RTX 4090' })).toBe('lite');
  });

  it('assumes 4 cores when hardwareConcurrency is unknown', () => {
    expect(tierOf({ hardwareConcurrency: null })).toBe('balanced');
  });

  it('gives a capable small touch device balanced (8 cores, unknown memory)', () => {
    expect(
      detectTier(
        signals({ coarsePointer: true, viewportWidth: 390, hardwareConcurrency: 8, deviceMemory: null }),
      ),
    ).toEqual({ tier: 'balanced', reason: 'capable touch device' });
  });

  it('gives a constrained small touch device lite (4 cores)', () => {
    expect(
      detectTier(
        signals({ coarsePointer: true, viewportWidth: 390, hardwareConcurrency: 4, deviceMemory: null }),
      ),
    ).toEqual({ tier: 'lite', reason: 'constrained touch device' });
    expect(tierOf({ coarsePointer: true, viewportWidth: 390, hardwareConcurrency: 8, deviceMemory: 3 })).toBe(
      'lite',
    );
  });

  it('never gives a small touch device ultra, whatever the GPU', () => {
    expect(
      tierOf({ coarsePointer: true, viewportWidth: 430, hardwareConcurrency: 8, renderer: 'Apple GPU' }),
    ).toBe('balanced');
  });

  it('judges large touch screens by their GPU', () => {
    expect(tierOf({ coarsePointer: true, viewportWidth: 1366, renderer: 'Apple M2' })).toBe('ultra');
  });

  it.each([
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'NVIDIA GeForce GTX 1080/PCIe/SSE2',
    'Quadro RTX 5000',
    'Apple M1',
    'Apple M3 Pro',
    'Apple GPU',
    'ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Intel(R) Arc(TM) A770 Graphics',
  ])('gives strong GPU "%s" ultra', (renderer) => {
    const decision = detectTier(signals({ renderer }));
    expect(decision.tier).toBe('ultra');
    expect(decision.reason).toBe(`strong GPU (${renderer})`);
  });

  it.each([
    'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Intel Iris OpenGL Engine',
    'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Mali-G78',
    'Adreno (TM) 740',
  ])('gives integrated GPU "%s" balanced', (renderer) => {
    const decision = detectTier(signals({ renderer }));
    expect(decision.tier).toBe('balanced');
    expect(decision.reason).toBe(`integrated GPU (${renderer})`);
  });

  it.each([null, 'Some Future GPU 9000'])('defaults unknown GPU %s to balanced', (renderer) => {
    expect(detectTier(signals({ renderer }))).toEqual({
      tier: 'balanced',
      reason: 'unknown GPU — balanced default',
    });
  });
});

describe('resolveTier', () => {
  it('passes the detected tier through on auto', () => {
    for (const detected of QUALITY_TIERS) expect(resolveTier('auto', detected)).toBe(detected);
  });

  it('lets the user choose a lighter tier', () => {
    expect(resolveTier('lite', 'ultra')).toBe('lite');
    expect(resolveTier('balanced', 'ultra')).toBe('balanced');
    expect(resolveTier('static', 'balanced')).toBe('static');
  });

  it('honours an explicit heavier tier when WebGL is available', () => {
    expect(resolveTier('ultra', 'lite')).toBe('ultra');
  });

  it('caps any 3D preference to static when detection said static (2-argument form)', () => {
    for (const preference of ['ultra', 'balanced', 'lite'] as const)
      expect(resolveTier(preference, 'static')).toBe('static');
    expect(resolveTier('static', 'static')).toBe('static');
  });

  it('honours an explicit 3D choice on a software renderer that does have WebGL', () => {
    expect(resolveTier('lite', 'static', true)).toBe('lite');
    expect(resolveTier('auto', 'static', true)).toBe('static');
  });

  it('caps every 3D choice to static when no WebGL context exists', () => {
    expect(resolveTier('ultra', 'static', false)).toBe('static');
    expect(resolveTier('lite', 'balanced', false)).toBe('static');
  });
});

describe('stepDown', () => {
  it('walks ultra → balanced → lite → static and stays at static', () => {
    expect(stepDown('ultra')).toBe('balanced');
    expect(stepDown('balanced')).toBe('lite');
    expect(stepDown('lite')).toBe('static');
    expect(stepDown('static')).toBe('static');
  });
});

describe('shouldDowngrade', () => {
  it.each(['ultra', 'balanced', 'lite'] as const)('downgrades %s only below its governor minimum', (tier) => {
    const min = GOVERNOR.min[tier];
    expect(shouldDowngrade(tier, min - 0.1)).toBe(true);
    expect(shouldDowngrade(tier, min)).toBe(false);
    expect(shouldDowngrade(tier, min + 10)).toBe(false);
  });

  it('never downgrades static', () => {
    expect(shouldDowngrade('static', 0)).toBe(false);
  });

  it('demands more frames from heavier tiers', () => {
    expect(GOVERNOR.min.ultra).toBeGreaterThan(GOVERNOR.min.balanced);
    expect(GOVERNOR.min.balanced).toBeGreaterThan(GOVERNOR.min.lite);
  });
});

describe('isQualityPreference', () => {
  it.each(['auto', ...QUALITY_TIERS])('accepts "%s"', (v) => {
    expect(isQualityPreference(v)).toBe(true);
  });

  it.each([['high'], ['Ultra'], [''], [null], [undefined], [3], [{}]])('rejects %j', (v) => {
    expect(isQualityPreference(v)).toBe(false);
  });
});

describe('TIER_CONFIG', () => {
  const order: RenderTier[] = ['ultra', 'balanced', 'lite'];
  const numeric = [
    'stars',
    'galaxyStars',
    'dust',
    'fragments',
    'sparks',
    'terrainSegments',
    'portalMaxSize',
  ] as const;

  it.each(numeric)('never increases %s on lighter tiers', (key) => {
    for (let i = 1; i < order.length; i++) {
      expect(TIER_CONFIG[order[i - 1]!][key]).toBeGreaterThanOrEqual(TIER_CONFIG[order[i]!][key]);
    }
  });

  it('never raises the maximum device pixel ratio on lighter tiers', () => {
    for (let i = 1; i < order.length; i++) {
      expect(TIER_CONFIG[order[i - 1]!].dpr[1]).toBeGreaterThanOrEqual(TIER_CONFIG[order[i]!].dpr[1]);
    }
    for (const tier of order) expect(TIER_CONFIG[tier].dpr[0]).toBeLessThanOrEqual(TIER_CONFIG[tier].dpr[1]);
  });

  it('turns off bloom and live portals on lite', () => {
    expect(TIER_CONFIG.lite.bloom).toBe(false);
    expect(TIER_CONFIG.lite.livePortals).toBe(false);
  });

  it('reserves data streams for ultra', () => {
    expect(TIER_CONFIG.ultra.dataStreams).toBe(true);
    expect(TIER_CONFIG.balanced.dataStreams).toBe(false);
    expect(TIER_CONFIG.lite.dataStreams).toBe(false);
  });

  it('defines a config for every render tier and none for static', () => {
    const tiers: QualityTier[] = [...QUALITY_TIERS];
    expect(Object.keys(TIER_CONFIG).sort()).toEqual(tiers.filter((t) => t !== 'static').sort());
  });
});

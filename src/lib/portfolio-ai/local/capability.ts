/**
 * Local AI capability check (PIE spec §7 "Capability & consent"). Runs only after the visitor
 * shows interest — never at page load. WebGPU in a secure context with an adapter that offers
 * the model's required features and buffer limits is required; memory/storage hints are
 * advisory (often unavailable) and never presented as facts about the device.
 */
import type { ModelEntry } from './catalog';

export type CapabilityResult =
  | {
      ok: true;
      adapter: { vendor: string; architecture: string };
      /** Advisory only. */
      storage: { quota?: number; usage?: number; enoughSpace: boolean | 'unknown' };
      saveData: boolean;
      deviceMemoryGB?: number;
    }
  | {
      ok: false;
      reason: 'insecure-context' | 'no-webgpu' | 'no-adapter' | 'missing-feature' | 'limits' | 'storage';
      detail: string;
    };

interface NavigatorHints {
  gpu?: GPU;
  deviceMemory?: number;
  connection?: { saveData?: boolean };
  storage?: StorageManager;
}

export async function checkCapability(
  entry: ModelEntry,
  nav: NavigatorHints = navigator as NavigatorHints,
): Promise<CapabilityResult> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return { ok: false, reason: 'insecure-context', detail: 'WebGPU needs a secure (HTTPS) page.' };
  }
  if (!nav.gpu) return { ok: false, reason: 'no-webgpu', detail: 'This browser does not expose WebGPU.' };
  let adapter: GPUAdapter | null = null;
  try {
    adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (error) {
    return {
      ok: false,
      reason: 'no-adapter',
      detail: error instanceof Error ? error.message : 'Adapter request failed.',
    };
  }
  if (!adapter)
    return {
      ok: false,
      reason: 'no-adapter',
      detail: 'No WebGPU adapter is available (GPU blocklisted or disabled).',
    };
  const missing = entry.requiredFeatures.filter((f) => !adapter.features.has(f));
  if (missing.length)
    return { ok: false, reason: 'missing-feature', detail: `The GPU lacks ${missing.join(', ')}.` };
  // The q4f16 libraries bind storage buffers of a few hundred MB; WebGPU's default limit is 128 MB.
  if (
    adapter.limits.maxStorageBufferBindingSize < 256 * 2 ** 20 ||
    adapter.limits.maxBufferSize < 256 * 2 ** 20
  ) {
    return { ok: false, reason: 'limits', detail: 'The GPU buffer limits are too small for this model.' };
  }
  const info = (adapter as GPUAdapter & { info?: GPUAdapterInfo }).info;
  let storage: { quota?: number; usage?: number; enoughSpace: boolean | 'unknown' } = {
    enoughSpace: 'unknown',
  };
  try {
    const est = await nav.storage?.estimate();
    if (est?.quota !== undefined) {
      const free = est.quota - (est.usage ?? 0);
      storage = { quota: est.quota, usage: est.usage, enoughSpace: free > entry.storageBytes * 1.1 };
    }
  } catch {
    // Storage estimate unavailable: stays "unknown".
  }
  return {
    ok: true,
    adapter: { vendor: info?.vendor ?? 'unknown', architecture: info?.architecture ?? 'unknown' },
    storage,
    saveData: Boolean(nav.connection?.saveData),
    ...(typeof nav.deviceMemory === 'number' ? { deviceMemoryGB: nav.deviceMemory } : {}),
  };
}

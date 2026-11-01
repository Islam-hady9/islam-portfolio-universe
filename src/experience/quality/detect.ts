import type { DeviceSignals } from './tiers';

const CACHE_KEY = 'iu:device-signals:v1';

/**
 * Gathers capability signals with a short-lived probe context (released immediately via
 * WEBGL_lose_context). Cached per session so navigation never re-probes.
 */
export function gatherDeviceSignals(): DeviceSignals {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as DeviceSignals;
      return { ...parsed, viewportWidth: window.innerWidth, coarsePointer: matchMedia('(pointer: coarse)').matches };
    }
  } catch {
    /* storage unavailable — probe below */
  }

  let webgl1 = false;
  let webgl2 = false;
  let renderer: string | null = null;
  let maxTextureSize = 0;
  const canvas = document.createElement('canvas');
  try {
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
    });
    if (gl) {
      webgl2 = true;
      webgl1 = true;
    } else {
      gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
      webgl1 = Boolean(gl);
    }
    if (gl) {
      maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER) ?? '') || null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl1 = false;
    webgl2 = false;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const signals: DeviceSignals = {
    webgl1,
    webgl2,
    renderer,
    maxTextureSize,
    hardwareConcurrency: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    viewportWidth: window.innerWidth,
    saveData: Boolean(nav.connection?.saveData),
  };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(signals));
  } catch {
    /* ignore */
  }
  return signals;
}

/**
 * Typed main-thread ⇄ worker protocol for Local AI (PIE spec §7 "Worker boundary").
 * Every message carries the requestId it belongs to; the client drops anything that is not for
 * the request it is currently waiting on (stale-request guard).
 */
import type { Evidence, SafeTurn } from '../shared/types';

export type ProgressStage = 'download' | 'load' | 'compile';

export type ErrorCode =
  | 'webgpu-unavailable'
  | 'unsupported-model'
  | 'network'
  | 'quota-exceeded'
  | 'integrity'
  | 'out-of-memory'
  | 'device-lost'
  | 'not-ready'
  | 'busy'
  | 'worker-crashed'
  | 'unknown';

/** Main thread → worker. */
export type ToWorker =
  | { type: 'INIT'; requestId: string; modelId: string }
  | {
      type: 'GENERATE';
      requestId: string;
      query: string;
      evidence: Evidence[];
      history: SafeTurn[];
      lang: 'en' | 'ar';
      /** Second attempt after a failed verification: stricter instructions, greedy decoding. */
      strict?: boolean;
    }
  | { type: 'CANCEL'; requestId: string }
  | { type: 'DISPOSE'; requestId: string };

export interface GenerationStats {
  promptTokens: number;
  completionTokens: number;
  ttftMs: number;
  totalMs: number;
  decodeTokPerS: number | null;
  prefillTokPerS: number | null;
}

/** Worker → main thread. */
export type FromWorker =
  | {
      type: 'PROGRESS';
      requestId: string;
      stage: ProgressStage;
      /** 0..1 overall progress reported by the runtime. */
      progress: number;
      completed?: number;
      total?: number;
      text: string;
    }
  | { type: 'READY'; requestId: string; modelId: string; initMs: number }
  | { type: 'TOKEN'; requestId: string; token: string }
  | {
      type: 'COMPLETE';
      requestId: string;
      /** Raw generated text; verified on the main thread against the same evidence. */
      text: string;
      finishReason: 'stop' | 'length' | 'abort';
      stats: GenerationStats;
    }
  | { type: 'DISPOSED'; requestId: string }
  | { type: 'ERROR'; requestId: string; code: ErrorCode; recoverable: boolean; message: string };

/** Classifies runtime errors into stable codes (messages from WebLLM / WebGPU / fetch). */
export function classifyError(error: unknown): { code: ErrorCode; recoverable: boolean; message: string } {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const m = message.toLowerCase();
  if (/quota|storage.*full|no space/.test(m)) return { code: 'quota-exceeded', recoverable: false, message };
  if (/integrity/.test(m)) return { code: 'integrity', recoverable: false, message };
  if (/device.*lost|lost.*device|context lost/.test(m))
    return { code: 'device-lost', recoverable: true, message };
  if (/out of memory|outofmemory|oom|allocation failed|cannot allocate/.test(m))
    return { code: 'out-of-memory', recoverable: false, message };
  if (
    /shader-f16|feature.*not supported|unsupported feature|webgpu is not supported|requestadapter|no adapter|gpu.*not available|webgpu not available/.test(
      m,
    )
  )
    return { code: 'webgpu-unavailable', recoverable: false, message };
  if (/failed to fetch|networkerror|network error|load failed|err_|status: ?[45]\d\d|http [45]\d\d/.test(m))
    return { code: 'network', recoverable: true, message };
  return { code: 'unknown', recoverable: true, message };
}

/** Maps a WebLLM progress line to a stage ("Fetching param cache[3/8]…", "Loading GPU shader…"). */
export function stageFromText(text: string): ProgressStage {
  if (/fetching|download/i.test(text)) return 'download';
  if (/shader|compil/i.test(text)) return 'compile';
  return 'load';
}

export function shardsFromText(text: string): { completed?: number; total?: number } {
  const m = /\[(\d+)\/(\d+)\]/.exec(text);
  return m ? { completed: Number(m[1]), total: Number(m[2]) } : {};
}

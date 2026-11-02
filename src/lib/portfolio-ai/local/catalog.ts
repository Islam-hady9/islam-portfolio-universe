/**
 * Local AI model catalog (PIE spec §7 "Model selection rubric"). Every artifact is pinned to an
 * immutable revision: the Hugging Face repository commit for weights/tokenizer and the
 * binary-mlc-llm-libs commit for the compiled WebGPU library. Sizes and speeds are MEASURED on the
 * test machine named in `measuredOn` (docs/portfolio-intelligence-engine/MODEL-EVALUATION.md);
 * VRAM is WebLLM's own estimate and is labelled as such — never shown as a guarantee.
 */
export const WEBLLM_VERSION = '0.2.86';
const LIB_REVISION = '00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0';
const LIB_BASE = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${LIB_REVISION}/web-llm-models/v0_2_86/base`;

export interface ModelEntry {
  /** WebLLM model_id. */
  id: string;
  label: string;
  /** One-line trade-off shown in the consent card (from the evaluation, not marketing). */
  summary: string;
  parameters: string;
  runtime: string;
  repo: string;
  /** Hugging Face commit (immutable). */
  revision: string;
  modelUrl: string;
  modelLib: string;
  libRevision: string;
  quantization: string;
  /** Context window the runtime is configured with; prompts are budgeted far below it. */
  contextWindow: number;
  requiredFeatures: GPUFeatureName[];
  /** SRI hashes WebLLM verifies before loading (config, WebGPU library, tokenizer). */
  integrity: { config: string; model_lib: string; tokenizer: Record<string, string> };
  /** Measured transfer for a cold install (weights + tokenizer + config + WebGPU library). */
  downloadBytes: number;
  /** Measured browser storage used after install (navigator.storage.estimate). */
  storageBytes: number;
  /** WebLLM's estimate of GPU memory needed (not measured). */
  vramEstimateMB: number;
  license: { name: string; url: string; upstream: string };
  measuredOn: string;
  measured: {
    coldInitMs: number;
    warmInitMs?: number;
    firstAnswerTtftMs: number;
    ttftMs: number;
    decodeTokPerS: number;
    prefillTokPerS: number;
  };
}

const MEASURED_ON =
  'Intel Core Ultra 7 255HX iGPU (Xe-LPG, shader-f16), Windows 11, Playwright Chromium (WebGPU), ~5–7 MB/s download, 2026-11-02';

export const MODEL_CATALOG: Record<string, ModelEntry> = {
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 0.5B Instruct',
    summary:
      'Lite — a third of the download; answers less often and hands more questions back to Smart Mode.',
    parameters: '0.5B',
    runtime: `webllm@${WEBLLM_VERSION}`,
    repo: 'mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    revision: '32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad',
    modelUrl:
      'https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC/resolve/32ff081fe7e4dfe4ffb167b94c66fdf11e02b8ad/',
    modelLib: `${LIB_BASE}/Qwen2-0.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    libRevision: LIB_REVISION,
    quantization: 'q4f16_1 (4-bit weights, fp16 activations)',
    contextWindow: 4096,
    requiredFeatures: ['shader-f16'],
    integrity: {
      config: 'sha256-VDnAO99O58/g+Kl6ZYgBiwFE3BKAxxu66ihTzbq4dLk=',
      model_lib: 'sha256-phgHSzD30CKreIbQz1e+Ku/aw0KQHUO+5OGREOG0tzk=',
      tokenizer: { 'tokenizer.json': 'sha256-wDghF+oynN8JcEETL21zWSS2l5JNb2/DlFcT6WzodTk=' },
    },
    downloadBytes: 283_558_942,
    storageBytes: 290_718_976,
    vramEstimateMB: 944.62,
    license: {
      name: 'Apache-2.0',
      url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/blob/main/LICENSE',
      upstream: 'Qwen/Qwen2.5-0.5B-Instruct',
    },
    measuredOn: MEASURED_ON,
    measured: {
      coldInitMs: 49_269,
      warmInitMs: 1_838,
      firstAnswerTtftMs: 18_558,
      ttftMs: 1_300,
      decodeTokPerS: 30,
      prefillTokPerS: 205,
    },
  },
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B Instruct',
    summary:
      'Recommended — fuller, better-grounded answers; about 3× the download and slower on integrated GPUs.',
    parameters: '1.5B',
    runtime: `webllm@${WEBLLM_VERSION}`,
    repo: 'mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    revision: '9bd564b064631febf14deadcac492efb761d60c3',
    modelUrl:
      'https://huggingface.co/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/9bd564b064631febf14deadcac492efb761d60c3/',
    modelLib: `${LIB_BASE}/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`,
    libRevision: LIB_REVISION,
    quantization: 'q4f16_1 (4-bit weights, fp16 activations)',
    contextWindow: 4096,
    requiredFeatures: ['shader-f16'],
    integrity: {
      config: 'sha256-faSVQhLT8hqRzD5pPRefYyE/1XNWeWhH9l1/lUeKH54=',
      model_lib: 'sha256-Q2Rira1AfgkU0jUP1FKlo9mD4AMdd8lAxD6jUcjNMAA=',
      tokenizer: { 'tokenizer.json': 'sha256-wDghF+oynN8JcEETL21zWSS2l5JNb2/DlFcT6WzodTk=' },
    },
    downloadBytes: 874_615_236,
    storageBytes: 881_839_104,
    vramEstimateMB: 1629.75,
    license: {
      name: 'Apache-2.0',
      url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/blob/main/LICENSE',
      upstream: 'Qwen/Qwen2.5-1.5B-Instruct',
    },
    measuredOn: MEASURED_ON,
    measured: {
      coldInitMs: 170_108,
      firstAnswerTtftMs: 22_309,
      ttftMs: 4_750,
      decodeTokPerS: 15,
      prefillTokPerS: 55,
    },
  },
};

/**
 * Model choice (MODEL-EVALUATION.md §4). The golden + held-out evaluation selected the 1.5B model:
 * it met the spec gates (claim support, citation validity, no leaks) while the 0.5B model did not
 * reach 90 % valid citation IDs. The 0.5B model stays available as the light option and is
 * preselected on constrained or metered devices; the visitor always chooses before any download.
 * Order = display order in the consent card.
 */
export const DEFAULT_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
export const LITE_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
export const MODEL_CHOICES = [DEFAULT_MODEL_ID, LITE_MODEL_ID] as const;

export interface DeviceHints {
  saveData: boolean;
  /** navigator.deviceMemory (advisory, capped at 8 by browsers). */
  deviceMemoryGB?: number;
  /** Touch-first device (pointer: coarse). */
  coarsePointer: boolean;
  /** Free storage from navigator.storage.estimate(), if known. */
  freeBytes?: number;
}

/** Preselection only — never a download decision. Advisory hints pick the lighter model. */
export function preselectModel(h: DeviceHints): string {
  const standard = MODEL_CATALOG[DEFAULT_MODEL_ID]!;
  const constrained =
    h.saveData ||
    h.coarsePointer ||
    (h.deviceMemoryGB !== undefined && h.deviceMemoryGB < 8) ||
    (h.freeBytes !== undefined && h.freeBytes < standard.storageBytes * 1.1);
  return constrained ? LITE_MODEL_ID : DEFAULT_MODEL_ID;
}

export function modelEntry(id: string = DEFAULT_MODEL_ID): ModelEntry {
  const entry = MODEL_CATALOG[id];
  if (!entry) throw new Error(`Unknown model ${id}`);
  return entry;
}

/** WebLLM AppConfig with only the pinned record (no implicit fallbacks to unpinned URLs). */
export function webllmAppConfig(entry: ModelEntry) {
  return {
    cacheBackend: 'cache' as const,
    model_list: [
      {
        model: entry.modelUrl,
        model_id: entry.id,
        model_lib: entry.modelLib,
        required_features: entry.requiredFeatures,
        vram_required_MB: entry.vramEstimateMB,
        low_resource_required: true,
        overrides: { context_window_size: entry.contextWindow },
        integrity: { ...entry.integrity, onFailure: 'error' as const },
      },
    ],
  };
}

/** Network origins the runtime may contact after consent (mirrored in the CSP connect-src). */
export const MODEL_ORIGINS = [
  'https://huggingface.co',
  'https://*.hf.co',
  'https://raw.githubusercontent.com',
] as const;

export const formatMB = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

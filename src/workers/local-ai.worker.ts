/// <reference lib="webworker" />
/**
 * Local AI inference worker (PIE spec §7). Hosts the WebLLM runtime off the main thread and
 * speaks only the typed protocol in src/lib/portfolio-ai/local/protocol.ts. Created by the client
 * after the visitor opts in; never imported by page code.
 *
 * Network: the runtime fetches the pinned model files (catalog) and nothing else; prompts and
 * answers never leave this worker except back to the page.
 */
import {
  CreateMLCEngine,
  type CompletionUsage,
  type InitProgressReport,
  type MLCEngine,
} from '@mlc-ai/web-llm';
import { modelEntry, webllmAppConfig } from '@/lib/portfolio-ai/local/catalog';
import { buildMessages, generationParams } from '@/lib/portfolio-ai/local/prompt';
import {
  classifyError,
  shardsFromText,
  stageFromText,
  type FromWorker,
  type ToWorker,
} from '@/lib/portfolio-ai/local/protocol';

declare const self: DedicatedWorkerGlobalScope;

let engine: MLCEngine | null = null;
let loadedModel: string | null = null;
let loading: Promise<void> | null = null;
/** The one generation allowed per tab; tokens from anything else are never posted. */
let activeRequest: string | null = null;

const post = (message: FromWorker) => self.postMessage(message);

async function init(requestId: string, modelId: string) {
  if (engine && loadedModel === modelId) {
    post({ type: 'READY', requestId, modelId, initMs: 0 });
    return;
  }
  const entry = modelEntry(modelId);
  const t0 = performance.now();
  engine = await CreateMLCEngine(entry.id, {
    appConfig: webllmAppConfig(entry),
    logLevel: 'WARN',
    initProgressCallback: (report: InitProgressReport) => {
      post({
        type: 'PROGRESS',
        requestId,
        stage: stageFromText(report.text),
        progress: Math.max(0, Math.min(1, report.progress)),
        ...shardsFromText(report.text),
        text: report.text.slice(0, 160),
      });
    },
  });
  // Warm-up: the first generation of a session compiles the WebGPU pipelines (measured 18–39 s on
  // the test iGPU). Doing it here, behind the "preparing" progress, keeps it off the visitor's
  // first question. One token from a fixed, content-free prompt; its output is discarded.
  post({ type: 'PROGRESS', requestId, stage: 'compile', progress: 1, text: 'Preparing the first response' });
  await engine.chat.completions.create({
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    max_tokens: 1,
    temperature: 0,
  });
  await engine.resetChat();
  loadedModel = modelId;
  post({ type: 'READY', requestId, modelId, initMs: Math.round(performance.now() - t0) });
}

async function generate(message: Extract<ToWorker, { type: 'GENERATE' }>) {
  const { requestId } = message;
  if (!engine) {
    post({ type: 'ERROR', requestId, code: 'not-ready', recoverable: true, message: 'Model not loaded' });
    return;
  }
  if (activeRequest) {
    // One generation at a time: interrupt the previous one; its tokens stop at the guard below.
    engine.interruptGenerate();
  }
  activeRequest = requestId;
  const params = generationParams(message.strict);
  const t0 = performance.now();
  let first = 0;
  let text = '';
  let finishReason: 'stop' | 'length' | 'abort' = 'stop';
  let usage: CompletionUsage | undefined;
  const stream = await engine.chat.completions.create({
    messages: buildMessages(message),
    stream: true,
    stream_options: { include_usage: true },
    ...params,
  });
  for await (const chunk of stream) {
    if (activeRequest !== requestId) {
      finishReason = 'abort';
      break;
    }
    const choice = chunk.choices[0];
    const delta = choice?.delta?.content;
    if (delta) {
      if (!first) first = performance.now() - t0;
      text += delta;
      post({ type: 'TOKEN', requestId, token: delta });
    }
    if (choice?.finish_reason === 'length') finishReason = 'length';
    if (choice?.finish_reason === 'abort') finishReason = 'abort';
    if (chunk.usage) usage = chunk.usage;
  }
  const totalMs = performance.now() - t0;
  if (activeRequest === requestId) activeRequest = null;
  post({
    type: 'COMPLETE',
    requestId,
    text,
    finishReason,
    stats: {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      ttftMs: Math.round(first),
      totalMs: Math.round(totalMs),
      decodeTokPerS: usage?.extra?.decode_tokens_per_s ?? null,
      prefillTokPerS: usage?.extra?.prefill_tokens_per_s ?? null,
    },
  });
}

self.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  const fail = (error: unknown) => {
    const { code, recoverable, message: text } = classifyError(error);
    if (message.type === 'GENERATE' && activeRequest === message.requestId) activeRequest = null;
    post({ type: 'ERROR', requestId: message.requestId, code, recoverable, message: text.slice(0, 300) });
  };
  switch (message.type) {
    case 'INIT':
      loading = init(message.requestId, message.modelId).catch((error) => {
        engine = null;
        loadedModel = null;
        fail(error);
      });
      break;
    case 'GENERATE':
      void (loading ?? Promise.resolve()).then(() => generate(message)).catch(fail);
      break;
    case 'CANCEL':
      if (activeRequest === message.requestId) {
        activeRequest = null;
        engine?.interruptGenerate();
      }
      break;
    case 'DISPOSE':
      activeRequest = null;
      void (async () => {
        try {
          engine?.interruptGenerate();
          await engine?.unload();
        } catch {
          // Unloading a lost device can throw; the worker is terminated next anyway.
        }
        engine = null;
        loadedModel = null;
        post({ type: 'DISPOSED', requestId: message.requestId });
      })();
      break;
  }
};

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalAiClient } from '@/lib/portfolio-ai/local/client';
import type { FromWorker, ToWorker } from '@/lib/portfolio-ai/local/protocol';
import { checkCapability } from '@/lib/portfolio-ai/local/capability';
import { clearModelCache, modelCacheState } from '@/lib/portfolio-ai/local/cache';
import { modelEntry } from '@/lib/portfolio-ai/local/catalog';
import {
  initialState,
  reducer,
  uiState,
  type Action,
  type AskState,
  type DisplayAnswer,
} from '@/components/ask-ai/state';

/** In-memory worker double: records messages, lets the test answer as the worker. */
class FakeWorker {
  sent: ToWorker[] = [];
  terminated = false;
  private listeners = new Map<string, Set<(e: unknown) => void>>();
  postMessage(m: ToWorker) {
    this.sent.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.get(type)?.delete(fn);
  }
  emit(data: FromWorker) {
    for (const fn of this.listeners.get('message') ?? []) fn({ data });
  }
  crash() {
    for (const fn of this.listeners.get('error') ?? []) fn(new Event('error'));
  }
  last<T extends ToWorker['type']>(type: T) {
    return [...this.sent].reverse().find((m) => m.type === type) as Extract<ToWorker, { type: T }>;
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const stats = {
  promptTokens: 1,
  completionTokens: 1,
  ttftMs: 1,
  totalMs: 1,
  decodeTokPerS: 1,
  prefillTokPerS: 1,
};
const input = { query: 'q', evidence: [], history: [], lang: 'en' as const };

async function readyClient() {
  const worker = new FakeWorker();
  const client = new LocalAiClient(() => worker);
  const progress = vi.fn();
  const init = client.init('Qwen2.5-0.5B-Instruct-q4f16_1-MLC', progress);
  const { requestId } = worker.last('INIT');
  worker.emit({
    type: 'PROGRESS',
    requestId,
    stage: 'download',
    progress: 0.5,
    text: 'Fetching param cache[4/8]',
  });
  worker.emit({ type: 'READY', requestId, modelId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', initMs: 42 });
  expect(await init).toBe(42);
  expect(progress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'download', progress: 0.5 }));
  return { worker, client };
}

describe('LocalAiClient (spec §7 worker boundary)', () => {
  it('creates no worker until asked to initialize', () => {
    const factory = vi.fn(() => new FakeWorker());
    new LocalAiClient(factory);
    expect(factory).not.toHaveBeenCalled();
  });

  it('streams tokens for the current request and resolves on COMPLETE', async () => {
    const { worker, client } = await readyClient();
    const tokens: string[] = [];
    const gen = client.generate(input, (t) => tokens.push(t));
    const { requestId } = worker.last('GENERATE');
    worker.emit({ type: 'TOKEN', requestId, token: 'Hel' });
    worker.emit({ type: 'TOKEN', requestId, token: 'lo' });
    worker.emit({ type: 'COMPLETE', requestId, text: 'Hello', finishReason: 'stop', stats });
    expect((await gen).text).toBe('Hello');
    expect(tokens).toEqual(['Hel', 'lo']);
  });

  it('drops tokens from a stale request (never mixes answers)', async () => {
    const { worker, client } = await readyClient();
    const tokensA: string[] = [];
    const a = client.generate(input, (t) => tokensA.push(t));
    const idA = worker.last('GENERATE').requestId;
    client.cancel();
    expect(worker.last('CANCEL').requestId).toBe(idA);
    worker.emit({ type: 'TOKEN', requestId: idA, token: 'late' });
    worker.emit({ type: 'COMPLETE', requestId: idA, text: 'late', finishReason: 'abort', stats });
    expect((await a).finishReason).toBe('abort');
    expect(tokensA).toEqual([]);

    const tokensB: string[] = [];
    const b = client.generate(input, (t) => tokensB.push(t));
    await tick();
    const idB = worker.last('GENERATE').requestId;
    expect(idB).not.toBe(idA);
    worker.emit({ type: 'TOKEN', requestId: idA, token: 'ghost' });
    worker.emit({ type: 'TOKEN', requestId: idB, token: 'fresh' });
    worker.emit({ type: 'COMPLETE', requestId: idB, text: 'fresh', finishReason: 'stop', stats });
    expect((await b).text).toBe('fresh');
    expect(tokensB).toEqual(['fresh']);
  });

  it('allows one generation at a time: a new one cancels the previous', async () => {
    const { worker, client } = await readyClient();
    const first = client.generate(input);
    const idA = worker.last('GENERATE').requestId;
    const second = client.generate(input);
    expect(worker.last('CANCEL').requestId).toBe(idA);
    worker.emit({ type: 'COMPLETE', requestId: idA, text: '', finishReason: 'abort', stats });
    expect((await first).finishReason).toBe('abort');
    await new Promise((r) => setTimeout(r, 60));
    const idB = worker.last('GENERATE').requestId;
    worker.emit({ type: 'COMPLETE', requestId: idB, text: 'ok', finishReason: 'stop', stats });
    expect((await second).text).toBe('ok');
  });

  it('maps worker errors to typed codes and forgets a lost device', async () => {
    const { worker, client } = await readyClient();
    const gen = client.generate(input);
    const { requestId } = worker.last('GENERATE');
    worker.emit({
      type: 'ERROR',
      requestId,
      code: 'device-lost',
      recoverable: true,
      message: 'Device was lost',
    });
    await expect(gen).rejects.toMatchObject({ code: 'device-lost' });
    expect(client.loadedModel).toBeNull();
    await expect(client.generate(input)).rejects.toMatchObject({ code: 'not-ready' });
  });

  it('turns a worker crash into worker-crashed and discards the worker', async () => {
    const { worker, client } = await readyClient();
    const gen = client.generate(input);
    worker.crash();
    await expect(gen).rejects.toMatchObject({ code: 'worker-crashed' });
    expect(worker.terminated).toBe(true);
  });

  it('dispose unloads the model, terminates the worker and is idempotent', async () => {
    const { worker, client } = await readyClient();
    const done = client.dispose();
    const { requestId } = worker.last('DISPOSE');
    worker.emit({ type: 'DISPOSED', requestId });
    await done;
    expect(worker.terminated).toBe(true);
    await client.dispose();
  });
});

describe('capability check (spec §7) — never downloads, advisory hints only', () => {
  const entry = modelEntry();
  const adapter = (features: string[], limit = 2 ** 31) => ({
    features: new Set(features),
    limits: { maxStorageBufferBindingSize: limit, maxBufferSize: limit },
    info: { vendor: 'v', architecture: 'a' },
  });
  const gpu = (a: unknown) => ({ requestAdapter: async () => a }) as unknown as GPU;
  const secure = (value: boolean) =>
    Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
  beforeEach(() => secure(true));
  afterEach(() => secure(false));

  it('requires a secure context', async () => {
    secure(false);
    expect(await checkCapability(entry, { gpu: gpu(adapter(['shader-f16'])) })).toMatchObject({
      ok: false,
      reason: 'insecure-context',
    });
  });

  it('rejects browsers without WebGPU or without an adapter', async () => {
    expect(await checkCapability(entry, {})).toMatchObject({ ok: false, reason: 'no-webgpu' });
    expect(await checkCapability(entry, { gpu: gpu(null) })).toMatchObject({
      ok: false,
      reason: 'no-adapter',
    });
  });

  it('requires shader-f16 and large enough buffers', async () => {
    expect(await checkCapability(entry, { gpu: gpu(adapter([])) })).toMatchObject({
      ok: false,
      reason: 'missing-feature',
    });
    expect(await checkCapability(entry, { gpu: gpu(adapter(['shader-f16'], 128 * 2 ** 20)) })).toMatchObject({
      ok: false,
      reason: 'limits',
    });
  });

  it('reports storage and data-saver hints without failing when unavailable', async () => {
    const ok = await checkCapability(entry, {
      gpu: gpu(adapter(['shader-f16'])),
      connection: { saveData: true },
      storage: { estimate: async () => ({ quota: 100, usage: 0 }) } as unknown as StorageManager,
    });
    expect(ok).toMatchObject({ ok: true, saveData: true, storage: { enoughSpace: false } });
    const unknown = await checkCapability(entry, { gpu: gpu(adapter(['shader-f16'])) });
    expect(unknown).toMatchObject({ ok: true, storage: { enoughSpace: 'unknown' } });
  });
});

describe('model cache helpers', () => {
  const entry = modelEntry();
  function fakeCaches(urls: Record<string, string[]>, tensorIndex?: { records: { dataPath: string }[] }) {
    const stores = new Map(Object.entries(urls).map(([name, list]) => [name, new Set(list)]));
    return {
      has: async (name: string) => stores.has(name),
      open: async (name: string) => {
        const set = stores.get(name) ?? new Set<string>();
        return {
          keys: async () => [...set].map((url) => ({ url })),
          match: async (url: string) =>
            set.has(url) && url.endsWith('tensor-cache.json') ? { json: async () => tensorIndex } : undefined,
          delete: async (req: { url: string }) => set.delete(req.url),
        };
      },
    } as unknown as CacheStorage;
  }
  const shard = (i: number) => `${entry.modelUrl}params_shard_${i}.bin`;
  const index = { records: [{ dataPath: 'params_shard_0.bin' }, { dataPath: 'params_shard_1.bin' }] };

  it('distinguishes absent, partial and complete downloads', async () => {
    expect(await modelCacheState(entry, fakeCaches({}))).toBe('absent');
    expect(await modelCacheState(entry, fakeCaches({ 'webllm/model': [shard(0)] }))).toBe('partial');
    expect(
      await modelCacheState(
        entry,
        fakeCaches({ 'webllm/model': [`${entry.modelUrl}tensor-cache.json`, shard(0)] }, index),
      ),
    ).toBe('partial');
    expect(
      await modelCacheState(
        entry,
        fakeCaches({ 'webllm/model': [`${entry.modelUrl}tensor-cache.json`, shard(0), shard(1)] }, index),
      ),
    ).toBe('complete');
    expect(await modelCacheState(entry, undefined)).toBe('unknown');
  });

  it('clears only this model’s files', async () => {
    const caches = fakeCaches({
      'webllm/model': [shard(0), 'https://huggingface.co/other/model/resolve/x/params_shard_0.bin'],
      'webllm/wasm': [entry.modelLib],
    });
    expect(await clearModelCache(entry, caches)).toBe(2);
    expect(await modelCacheState(entry, caches)).toBe('absent');
  });
});

describe('panel state machine (spec §3 UI states)', () => {
  const answer = (status: DisplayAnswer['status'], mode: DisplayAnswer['mode'] = 'smart'): DisplayAnswer => ({
    mode,
    text: 't',
    status,
    evidence: [],
    links: [],
    language: 'en',
  });
  const run = (...actions: Action[]) => actions.reduce<AskState>(reducer, initialState);

  it('derives every Smart state', () => {
    expect(uiState(initialState)).toBe('smart-ready');
    expect(uiState(run({ type: 'ask', id: 1, question: 'q' }))).toBe('smart-searching');
    expect(
      uiState(
        run({ type: 'ask', id: 1, question: 'q' }, { type: 'answer', id: 1, answer: answer('answered') }),
      ),
    ).toBe('smart-answer');
    expect(
      uiState(
        run({ type: 'ask', id: 1, question: 'q' }, { type: 'answer', id: 1, answer: answer('refused') }),
      ),
    ).toBe('smart-no-match');
  });

  it('derives every Local AI state', () => {
    const p = (stage: 'download' | 'load' | 'compile') =>
      ({ type: 'local/progress', progress: { stage, progress: 0.1, text: '' } }) as const;
    expect(uiState(run({ type: 'local/check' }))).toBe('capability-check');
    expect(uiState(run({ type: 'local/unavailable', reason: 'x' }))).toBe('local-unavailable');
    expect(uiState(run({ type: 'local/consent', cache: 'absent' }))).toBe('local-consent');
    expect(uiState(run(p('download')))).toBe('model-downloading');
    expect(uiState(run(p('compile')))).toBe('model-initializing');
    expect(uiState(run({ type: 'local/ready' }))).toBe('local-ready');
    expect(uiState(run({ type: 'local/ready' }, { type: 'local/generating' }))).toBe('local-generating');
    expect(
      uiState(
        run(
          { type: 'local/ready' },
          { type: 'ask', id: 1, question: 'q' },
          { type: 'answer', id: 1, answer: answer('answered', 'local') },
        ),
      ),
    ).toBe('local-answer');
    expect(
      uiState(
        run({ type: 'local/ready' }, { type: 'ask', id: 1, question: 'q' }, { type: 'cancelled', id: 1 }),
      ),
    ).toBe('local-cancelled');
    expect(uiState(run({ type: 'local/error', code: 'network', message: 'm' }))).toBe('local-error');
    expect(uiState(run({ type: 'local/pressure', message: 'm' }))).toBe('resource-pressure');
    expect(uiState(run({ type: 'local/offline' }))).toBe('offline-without-model');
    expect(uiState(run({ type: 'mode/switching' }))).toBe('switching-mode');
  });

  it('falls back to Smart mode on every Local AI failure', () => {
    for (const a of [
      { type: 'local/error', code: 'x', message: 'm' },
      { type: 'local/pressure', message: 'm' },
      { type: 'local/offline' },
      { type: 'local/unavailable', reason: 'r' },
    ] as Action[]) {
      expect(run({ type: 'local/ready' }, a).mode).toBe('smart');
    }
  });

  it('ignores stream tokens after cancellation and keeps a bounded per-tab history', () => {
    const s = run(
      { type: 'ask', id: 1, question: 'q' },
      { type: 'cancelled', id: 1 },
      { type: 'stream', id: 1, token: 'late' },
      { type: 'answer', id: 1, answer: answer('answered') },
    );
    expect(s.turns[0]!.state).toBe('cancelled');
    expect(s.turns[0]!.streaming).toBe('');
    let many = initialState;
    for (let i = 0; i < 20; i++) many = reducer(many, { type: 'ask', id: i, question: `q${i}` });
    expect(many.turns).toHaveLength(8);
    expect(reducer(many, { type: 'clear' }).turns).toHaveLength(0);
  });
});

describe('one local model per browser profile (Web Locks)', () => {
  it('grants the lock to one holder at a time and releases it', async () => {
    const { acquireTabLock } = await import('@/lib/portfolio-ai/local/tab-lock');
    let held = false;
    const locks = {
      request: async (_name: string, _opts: unknown, cb: (lock: unknown) => unknown) => {
        if (held) return cb(null);
        held = true;
        await cb({ name: 'portfolio-local-ai' });
        held = false;
      },
    } as unknown as LockManager;
    const first = await acquireTabLock(locks);
    expect(first).not.toBeNull();
    expect(await acquireTabLock(locks)).toBeNull();
    first!.release();
    await tick();
    expect(await acquireTabLock(locks)).not.toBeNull();
  });

  it('falls back to a no-op lock where the API is missing', async () => {
    const { acquireTabLock } = await import('@/lib/portfolio-ai/local/tab-lock');
    const lock = await acquireTabLock(undefined);
    expect(lock).not.toBeNull();
    lock!.release();
  });
});

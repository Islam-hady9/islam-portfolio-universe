/**
 * Main-thread controller for the Local AI worker (PIE spec §7). Owns the single worker of the
 * tab, serializes generations (one at a time), drops stale messages by requestId, and turns
 * worker crashes / device loss into typed errors so the UI can fall back to Smart Mode.
 */
import type { Evidence, SafeTurn } from '../shared/types';
import type { ErrorCode, FromWorker, GenerationStats, ProgressStage, ToWorker } from './protocol';

export class LocalAiError extends Error {
  override readonly name = 'LocalAiError';
  constructor(
    readonly code: ErrorCode,
    readonly recoverable: boolean,
    message: string,
  ) {
    super(message);
  }
}

export interface ProgressUpdate {
  stage: ProgressStage;
  progress: number;
  completed?: number;
  total?: number;
  text: string;
}

export interface GenerationResult {
  text: string;
  finishReason: 'stop' | 'length' | 'abort';
  stats: GenerationStats;
}

export interface GenerateInput {
  query: string;
  evidence: Evidence[];
  history: SafeTurn[];
  lang: 'en' | 'ar';
  strict?: boolean;
}

type WorkerLike = Pick<Worker, 'postMessage' | 'terminate' | 'addEventListener' | 'removeEventListener'>;

interface Pending {
  requestId: string;
  kind: 'init' | 'generate' | 'dispose';
  resolve: (value: unknown) => void;
  reject: (error: LocalAiError) => void;
  onProgress?: (p: ProgressUpdate) => void;
  onToken?: (token: string) => void;
}

export const defaultWorkerFactory = (): Worker =>
  new Worker(new URL('../../../workers/local-ai.worker.ts', import.meta.url), {
    type: 'module',
    name: 'portfolio-local-ai',
  });

let sequence = 0;
const nextId = (kind: string) => `${kind}-${Date.now().toString(36)}-${(sequence++).toString(36)}`;

export class LocalAiClient {
  private worker: WorkerLike | null = null;
  private pending = new Map<string, Pending>();
  private generation: Pending | null = null;
  private ready: string | null = null;

  constructor(private readonly factory: () => WorkerLike = defaultWorkerFactory) {}

  get loadedModel(): string | null {
    return this.ready;
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.factory();
    worker.addEventListener('message', this.onMessage as EventListener);
    worker.addEventListener('error', this.onCrash as EventListener);
    worker.addEventListener('messageerror', this.onCrash as EventListener);
    this.worker = worker;
    return worker;
  }

  private send(message: ToWorker) {
    this.ensureWorker().postMessage(message);
  }

  private readonly onMessage = (event: MessageEvent<FromWorker>) => {
    const msg = event.data;
    const pending = this.pending.get(msg.requestId);
    if (!pending) return; // stale: a cancelled/superseded request, or a disposed worker
    switch (msg.type) {
      case 'PROGRESS':
        pending.onProgress?.({
          stage: msg.stage,
          progress: msg.progress,
          completed: msg.completed,
          total: msg.total,
          text: msg.text,
        });
        return;
      case 'TOKEN':
        if (this.generation?.requestId === msg.requestId) pending.onToken?.(msg.token);
        return;
      case 'READY':
        this.ready = msg.modelId;
        this.settle(msg.requestId, (p) => p.resolve(msg.initMs));
        return;
      case 'COMPLETE':
        this.settle(msg.requestId, (p) =>
          p.resolve({
            text: msg.text,
            finishReason: msg.finishReason,
            stats: msg.stats,
          } satisfies GenerationResult),
        );
        return;
      case 'DISPOSED':
        this.settle(msg.requestId, (p) => p.resolve(undefined));
        return;
      case 'ERROR':
        if (msg.code === 'device-lost' || msg.code === 'out-of-memory') this.ready = null;
        this.settle(msg.requestId, (p) => p.reject(new LocalAiError(msg.code, msg.recoverable, msg.message)));
        return;
    }
  };

  /** Uncaught worker failure: every waiter fails, the worker is discarded. */
  private readonly onCrash = () => {
    const error = new LocalAiError('worker-crashed', true, 'The local AI worker stopped unexpectedly.');
    this.teardown();
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
    this.generation = null;
  };

  private settle(requestId: string, fn: (p: Pending) => void) {
    const p = this.pending.get(requestId);
    if (!p) return;
    this.pending.delete(requestId);
    if (this.generation?.requestId === requestId) this.generation = null;
    fn(p);
  }

  private request<T>(
    kind: Pending['kind'],
    message: (requestId: string) => ToWorker,
    hooks: Partial<Pending> = {},
  ): { requestId: string; promise: Promise<T> } {
    const requestId = nextId(kind);
    const promise = new Promise<T>((resolve, reject) => {
      const pending: Pending = {
        requestId,
        kind,
        resolve: resolve as (v: unknown) => void,
        reject,
        ...hooks,
      };
      this.pending.set(requestId, pending);
      if (kind === 'generate') this.generation = pending;
    });
    this.send(message(requestId));
    return { requestId, promise };
  }

  /** Downloads (if needed) and initializes the model. Resolves with the runtime init time (ms). */
  init(modelId: string, onProgress?: (p: ProgressUpdate) => void): Promise<number> {
    return this.request<number>('init', (requestId) => ({ type: 'INIT', requestId, modelId }), { onProgress })
      .promise;
  }

  /** Streams one answer. A generation already running is cancelled first (one per tab). */
  async generate(input: GenerateInput, onToken?: (token: string) => void): Promise<GenerationResult> {
    if (!this.ready) throw new LocalAiError('not-ready', true, 'Model not loaded');
    const previous = this.generation;
    if (previous) {
      this.cancel();
      await Promise.race([
        new Promise((resolve) => {
          const wait = () =>
            this.pending.has(previous.requestId) ? setTimeout(wait, 20) : resolve(undefined);
          wait();
        }),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
    return this.request<GenerationResult>(
      'generate',
      (requestId) => ({ type: 'GENERATE', requestId, ...input }),
      { onToken },
    ).promise;
  }

  /** Stops the running generation; its promise resolves with finishReason "abort". */
  cancel(): void {
    const current = this.generation;
    if (!current || !this.worker) return;
    this.generation = null;
    this.worker.postMessage({ type: 'CANCEL', requestId: current.requestId } satisfies ToWorker);
    // The worker's COMPLETE(abort) settles it; tokens already in flight are dropped (no longer current).
  }

  /** Unloads the model (frees GPU memory) and terminates the worker. Safe to call repeatedly. */
  async dispose(): Promise<void> {
    if (!this.worker) return;
    this.cancel();
    try {
      await Promise.race([
        this.request<void>('dispose', (requestId) => ({ type: 'DISPOSE', requestId })).promise,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // Disposing a crashed worker: nothing left to unload.
    }
    this.teardown();
    for (const p of this.pending.values())
      p.reject(new LocalAiError('worker-crashed', true, 'Local AI was closed.'));
    this.pending.clear();
  }

  private teardown() {
    if (!this.worker) return;
    this.worker.removeEventListener('message', this.onMessage as EventListener);
    this.worker.removeEventListener('error', this.onCrash as EventListener);
    this.worker.removeEventListener('messageerror', this.onCrash as EventListener);
    this.worker.terminate();
    this.worker = null;
    this.ready = null;
    this.generation = null;
  }
}

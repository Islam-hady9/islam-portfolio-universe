/**
 * Model cache status and clearing (PIE spec §7 "Caching & storage") without loading the runtime.
 * WebLLM 0.2.86 stores artifacts in Cache Storage under "webllm/model", "webllm/config" and
 * "webllm/wasm", keyed by the pinned URLs in the catalog. Only model files are cached — never
 * conversations.
 */
import type { ModelEntry } from './catalog';

const CACHE_NAMES = ['webllm/model', 'webllm/config', 'webllm/wasm'] as const;

export type CacheState = 'absent' | 'partial' | 'complete' | 'unknown';

const belongs = (url: string, entry: ModelEntry) => url.startsWith(entry.modelUrl) || url === entry.modelLib;

/** Whether the model's weights are fully cached (tensor-cache.json + every shard it lists). */
export async function modelCacheState(
  entry: ModelEntry,
  storage: CacheStorage | undefined = globalThis.caches,
): Promise<CacheState> {
  if (!storage) return 'unknown';
  try {
    if (!(await storage.has('webllm/model'))) return 'absent';
    const cache = await storage.open('webllm/model');
    const index = await cache.match(new URL('tensor-cache.json', entry.modelUrl).href);
    if (!index) {
      const keys = await cache.keys();
      return keys.some((k) => belongs(k.url, entry)) ? 'partial' : 'absent';
    }
    const json = (await index.json()) as { records?: { dataPath: string }[] };
    const shards = json.records?.map((r) => new URL(r.dataPath, entry.modelUrl).href) ?? [];
    const keys = new Set((await cache.keys()).map((k) => k.url));
    const have = shards.filter((s) => keys.has(s)).length;
    return shards.length > 0 && have === shards.length ? 'complete' : 'partial';
  } catch {
    return 'unknown';
  }
}

/** Deletes this model's cached files (weights, tokenizer, config, WebGPU library). */
export async function clearModelCache(
  entry: ModelEntry,
  storage: CacheStorage | undefined = globalThis.caches,
): Promise<number> {
  if (!storage) return 0;
  let removed = 0;
  for (const name of CACHE_NAMES) {
    if (!(await storage.has(name))) continue;
    const cache = await storage.open(name);
    for (const request of await cache.keys()) {
      if (belongs(request.url, entry) && (await cache.delete(request))) removed++;
    }
  }
  return removed;
}

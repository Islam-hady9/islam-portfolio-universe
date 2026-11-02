/**
 * Runtime validation of the knowledge manifest the browser downloads (PIE spec §5, §9). The
 * build already guarantees these invariants; the client re-checks them so a stale, truncated or
 * tampered file can never put an unapproved record or an unsafe link in front of a visitor.
 * Dependency-free on purpose: this ships in the Smart Mode chunk.
 */
import type { KnowledgeManifest, KnowledgeRecord, LinkTarget } from './types';
import { isAllowedHref } from './links';

export const MANIFEST_PATH = '/ai/knowledge.json';

const RECORD_TYPES = new Set(['profile', 'skill', 'project', 'experience', 'education', 'contact', 'faq']);
const LANGUAGES = new Set(['en', 'ar', 'mixed']);
const LINK_KINDS = new Set(['route', 'external', 'mailto']);

export class ManifestError extends Error {
  override readonly name = 'ManifestError';
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isString);
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Internal routes, https URLs and mailto only — never javascript:, data:, protocol-relative… */
export function isSafeHref(href: string, kind: LinkTarget['kind']): boolean {
  if (kind === 'route') return /^\/(?!\/)[\w\-./#]*$/.test(href);
  if (kind === 'external') return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(?:\/[\w\-./%~#?=&]*)?$/i.test(href);
  return /^mailto:[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i.test(href);
}

function parseLink(v: unknown, i: number): LinkTarget {
  if (!isObject(v) || !isString(v.id) || !isString(v.label) || !isString(v.href) || !isString(v.kind))
    throw new ManifestError(`link ${i}: malformed`);
  if (!LINK_KINDS.has(v.kind)) throw new ManifestError(`link ${v.id}: unknown kind`);
  const kind = v.kind as LinkTarget['kind'];
  if (!isSafeHref(v.href, kind)) throw new ManifestError(`link ${v.id}: unsafe href`);
  if (v.aliases !== undefined && !isStringArray(v.aliases))
    throw new ManifestError(`link ${v.id}: bad aliases`);
  return {
    id: v.id,
    label: v.label,
    href: v.href,
    kind,
    ...(v.pendingDetails === true ? { pendingDetails: true } : {}),
    ...(v.aliases ? { aliases: v.aliases } : {}),
  };
}

function parseRecord(v: unknown, i: number, links: LinkTarget[]): KnowledgeRecord {
  if (!isObject(v)) throw new ManifestError(`record ${i}: malformed`);
  const { id, type, title, publicText, language, keywords, aliases, sourcePath, publicUrl, version } = v;
  if (
    !isString(id) ||
    !isString(title) ||
    !isString(publicText) ||
    !isString(sourcePath) ||
    !isString(version)
  )
    throw new ManifestError(`record ${i}: missing text fields`);
  if (!isString(type) || !RECORD_TYPES.has(type)) throw new ManifestError(`record ${id}: bad type`);
  if (!isString(language) || !LANGUAGES.has(language)) throw new ManifestError(`record ${id}: bad language`);
  if (!isStringArray(keywords) || !isStringArray(aliases))
    throw new ManifestError(`record ${id}: bad keywords`);
  // The eligibility rule itself (spec §5): anything else is rejected outright.
  if (v.verification !== 'verified' || v.visibility !== 'public' || v.approvedForAi !== true)
    throw new ManifestError(`record ${id}: not eligible`);
  if (publicUrl !== undefined && (!isString(publicUrl) || !isAllowedHref(publicUrl, links)))
    throw new ManifestError(`record ${id}: link not allowlisted`);
  return {
    id,
    type: type as KnowledgeRecord['type'],
    title,
    publicText,
    language: language as KnowledgeRecord['language'],
    keywords,
    aliases,
    sourcePath,
    ...(publicUrl ? { publicUrl } : {}),
    verification: 'verified',
    visibility: 'public',
    approvedForAi: true,
    version,
  };
}

export function parseManifest(json: unknown): KnowledgeManifest {
  if (!isObject(json) || json.schema !== 1 || !isString(json.version))
    throw new ManifestError('not a v1 manifest');
  if (!Array.isArray(json.records) || !Array.isArray(json.links) || !isObject(json.pending))
    throw new ManifestError('manifest sections missing');
  const links = json.links.map(parseLink);
  const records = json.records.map((r, i) => parseRecord(r, i, links));
  const ids = new Set(records.map((r) => r.id));
  if (ids.size !== records.length) throw new ManifestError('duplicate record id');
  const pending: Record<string, number> = {};
  for (const [k, n] of Object.entries(json.pending)) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0)
      throw new ManifestError(`pending ${k}: bad count`);
    pending[k] = n;
  }
  return { schema: 1, version: json.version, records, links, pending };
}

/**
 * Lazily fetches the static manifest. `expectedVersion` (rendered into the page at build time)
 * keys the browser cache; if the response is a different version — a cached copy from an older
 * build — it is fetched once more bypassing the HTTP cache, and the server's current version
 * wins. Answers are always built from the version actually loaded (spec §11 freshness).
 */
export async function loadManifest(
  expectedVersion?: string,
  signal?: AbortSignal,
): Promise<KnowledgeManifest> {
  const url = expectedVersion ? `${MANIFEST_PATH}?v=${encodeURIComponent(expectedVersion)}` : MANIFEST_PATH;
  const get = async (cache: RequestCache) => {
    const res = await fetch(url, {
      signal,
      cache,
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new ManifestError(`manifest HTTP ${res.status}`);
    return parseManifest(await res.json());
  };
  const manifest = await get('default');
  return expectedVersion && manifest.version !== expectedVersion ? get('reload') : manifest;
}

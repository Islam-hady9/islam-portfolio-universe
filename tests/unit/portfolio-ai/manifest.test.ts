import { afterEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/content';
import { collectCandidates, compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';
import { isSafeHref, loadManifest, parseManifest } from '@/lib/portfolio-ai/shared/manifest';
import { SmartEngine } from '@/lib/portfolio-ai/smart/engine';
import heldout from '../../fixtures/portfolio-ai/golden-set.heldout.v1.json';
import { scoreAnswer, shingles, type GoldenCase } from '../../../scripts/ai/golden';

const { manifest, rejected } = compileKnowledge(content);
const clone = () => JSON.parse(JSON.stringify(manifest));

describe('parseManifest (client-side re-validation, PIE §5/§9)', () => {
  it('accepts the compiled manifest unchanged', () => {
    expect(parseManifest(clone())).toEqual(manifest);
  });

  it('rejects any record that is not verified, public and approved', () => {
    for (const patch of [
      { verification: 'placeholder' },
      { visibility: 'private' },
      { approvedForAi: false },
    ]) {
      const m = clone();
      Object.assign(m.records[0], patch);
      expect(() => parseManifest(m)).toThrow(/not eligible/);
    }
  });

  it('rejects unsafe links and records pointing outside the allowlist', () => {
    const bad = clone();
    bad.links[0].href = 'javascript:alert(1)';
    expect(() => parseManifest(bad)).toThrow(/unsafe href/);
    const external = clone();
    external.records[0].publicUrl = 'https://evil.example.com/';
    expect(() => parseManifest(external)).toThrow(/not allowlisted/);
  });

  it('rejects malformed or unknown schema versions', () => {
    expect(() => parseManifest({ ...clone(), schema: 2 })).toThrow();
    expect(() => parseManifest(null)).toThrow();
    const dup = clone();
    dup.records.push(dup.records[0]);
    expect(() => parseManifest(dup)).toThrow(/duplicate/);
  });

  it('allows only internal routes, https URLs and mailto', () => {
    expect(isSafeHref('/projects/tibyn', 'route')).toBe(true);
    expect(isSafeHref('//evil.com', 'route')).toBe(false);
    expect(isSafeHref('http://linkedin.com/in/x', 'external')).toBe(false);
    expect(isSafeHref('https://github.com/x', 'external')).toBe(true);
    expect(isSafeHref('mailto:a@b.co', 'mailto')).toBe(true);
    expect(isSafeHref('mailto:a@b.co?bcc=x@y.z', 'mailto')).toBe(false);
  });
});

describe('loadManifest freshness (spec §11 #18)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests the version-keyed URL and refetches bypassing the cache when stale', async () => {
    const newer = { ...clone(), version: 'knewer' };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(new Response(JSON.stringify(newer)));
    const loaded = await loadManifest('kexpected');
    expect(fetchSpy.mock.calls[0]![0]).toBe('/ai/knowledge.json?v=kexpected');
    expect((fetchSpy.mock.calls[1]![1] as RequestInit).cache).toBe('reload');
    expect(loaded.version).toBe('knewer');
    // The engine is always built from the version actually loaded.
    expect(new SmartEngine(loaded).version).toBe('knewer');
  });

  it('fails loudly on HTTP errors (the panel then shows an honest error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x', { status: 503 }));
    await expect(loadManifest(manifest.version)).rejects.toThrow(/HTTP 503/);
  });
});

describe('held-out paraphrases (regression; first-run score is in EVALUATION-RESULTS.md)', () => {
  const engine = new SmartEngine(manifest);
  const ids = new Set(rejected.map((r) => r.id));
  const forbidden = shingles(
    collectCandidates(content)
      .filter((c) => ids.has(c.id))
      .map((c) => c.publicText),
  );
  it.each((heldout.cases as GoldenCase[]).map((c) => [c.id, c] as const))('%s', (_id, c) => {
    expect(scoreAnswer(c, engine.answer(c.question), forbidden).failures).toEqual([]);
  });
});

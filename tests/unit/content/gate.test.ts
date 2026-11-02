import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { PublicationGateError, assertPublishable, collectUnverified } from '@/content/gate';
import type { ContentMode } from '@/content/schema';

/** Deep copy with every verification block promoted to a verified status. */
function verifyEverything<T>(root: T): T {
  const copy = structuredClone(root);
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'verification' && typeof value === 'object' && value !== null && 'status' in value) {
        (value as { status: string }).status = 'public_verified';
      } else {
        visit(value);
      }
    }
  };
  visit(copy);
  return copy;
}

const v = (status: string, source = 'test source', note?: string) => ({
  status,
  source,
  ...(note ? { note } : {}),
});

describe('collectUnverified on the shipped content', () => {
  const records = collectUnverified(content);

  it('finds the placeholder records', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it('reports a path and provenance for every record', () => {
    for (const r of records) {
      expect(r.path.startsWith('content')).toBe(true);
      expect(r.status).toBe('placeholder');
      expect(r.source.trim().length).toBeGreaterThanOrEqual(3);
    }
  });

  it('labels array members by id or slug so records are traceable', () => {
    const paths = records.map((r) => r.path);
    for (const p of content.projects) {
      if (p.verification.status === 'placeholder') expect(paths).toContain(`content.projects[${p.slug}]`);
    }
    for (const e of content.career.entries) {
      if (e.verification.status === 'placeholder') expect(paths).toContain(`content.career.entries[${e.id}]`);
    }
    if (content.contact.verification.status === 'placeholder') expect(paths).toContain('content.contact');
    if (content.contact.resume.verification.status === 'placeholder')
      expect(paths).toContain('content.contact.resume');
  });

  it('does not report records that are already verified', () => {
    const paths = records.map((r) => r.path);
    expect(content.site.verification.status).not.toBe('placeholder');
    expect(paths).not.toContain('content.site');
    expect(paths).not.toContain('content.site.identity');
    expect(paths).not.toContain('content.home');
  });
});

describe('collectUnverified on synthetic trees', () => {
  it('walks nested objects and arrays, naming members by id, then slug, then index', () => {
    const tree = {
      list: [
        { verification: v('placeholder') },
        { id: 'a', verification: v('placeholder') },
        { slug: 's', verification: v('placeholder') },
      ],
      nested: { deeper: { verification: v('placeholder', 'deep source', 'a note') } },
    };
    expect(collectUnverified(tree, 'root')).toEqual([
      { path: 'root.list[0]', status: 'placeholder', source: 'test source', note: undefined },
      { path: 'root.list[a]', status: 'placeholder', source: 'test source', note: undefined },
      { path: 'root.list[s]', status: 'placeholder', source: 'test source', note: undefined },
      { path: 'root.nested.deeper', status: 'placeholder', source: 'deep source', note: 'a note' },
    ]);
  });

  it('ignores verified statuses', () => {
    const tree = { a: { verification: v('owner_verified') }, b: { verification: v('public_verified') } };
    expect(collectUnverified(tree)).toEqual([]);
  });

  it('does not treat a malformed verification block as a record, but keeps walking inside it', () => {
    const tree = { verification: { status: 'placeholder', inner: { verification: v('placeholder') } } };
    expect(collectUnverified(tree)).toEqual([
      { path: 'content.verification.inner', status: 'placeholder', source: 'test source', note: undefined },
    ]);
  });

  it('returns nothing for primitives and null', () => {
    expect(collectUnverified(null)).toEqual([]);
    expect(collectUnverified('text')).toEqual([]);
    expect(collectUnverified(42)).toEqual([]);
  });
});

describe('assertPublishable', () => {
  it('blocks a VERIFIED_PUBLIC build while placeholders remain', () => {
    let error: unknown;
    try {
      assertPublishable('VERIFIED_PUBLIC', content);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(PublicationGateError);
    const gateError = error as PublicationGateError;
    const expected = collectUnverified(content);
    expect(gateError.name).toBe('PublicationGateError');
    expect(gateError.records).toEqual(expected);
    expect(gateError.message).toContain(`${expected.length} placeholder record(s) remain`);
    for (const r of expected) expect(gateError.message).toContain(`${r.path} (${r.source})`);
  });

  it.each<ContentMode>(['DEMO_CONTENT', 'OWNER_REVIEW'])('allows placeholders in a %s build', (mode) => {
    expect(() => assertPublishable(mode, content)).not.toThrow();
  });

  it('lets a fully verified content tree through the VERIFIED_PUBLIC gate', () => {
    const verified = verifyEverything(content);
    expect(collectUnverified(verified)).toEqual([]);
    expect(() => assertPublishable('VERIFIED_PUBLIC', verified)).not.toThrow();
  });

  it('blocks a VERIFIED_PUBLIC build when a single placeholder is reintroduced', () => {
    const verified = verifyEverything(content);
    verified.contact.verification.status = 'placeholder';
    expect(() => assertPublishable('VERIFIED_PUBLIC', verified)).toThrow(PublicationGateError);
  });
});

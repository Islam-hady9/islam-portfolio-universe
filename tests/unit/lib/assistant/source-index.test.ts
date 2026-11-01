import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { internalHrefSchema } from '@/content/schema';
import { sourceKey } from '@/lib/assistant/contracts';
import { buildSourceIndex } from '@/lib/assistant/source-index';
import { routes } from '@/lib/routes';

const index = buildSourceIndex(content);

describe('buildSourceIndex', () => {
  it('indexes every project and its case study under the project route', () => {
    for (const p of content.projects) {
      expect(index[`project:${p.slug}`]).toEqual({
        label: p.title,
        href: routes.project(p.slug),
        verification: p.verification.status,
      });
      expect(index[`case-study:${p.slug}`]).toEqual({
        label: `${p.title} case study`,
        href: routes.project(p.slug),
        verification: 'placeholder',
      });
    }
  });

  it('indexes every capability group under the capabilities anchor', () => {
    for (const g of content.capabilities) {
      expect(index[`capability:${g.id}`]).toEqual({
        label: g.title,
        href: '/#capabilities',
        verification: g.verification.status,
      });
    }
  });

  it('indexes the fixed site sources', () => {
    expect(index['career:sample-journey']).toMatchObject({
      href: '/#experience',
      verification: 'placeholder',
    });
    expect(index['career:sample-journey']!.label).toMatch(/sample/i);
    expect(index['contact:contact-config']).toEqual({
      label: 'Contact status',
      href: routes.contact,
      verification: content.contact.verification.status,
    });
    expect(index['site:philosophy']).toMatchObject({ href: '/#philosophy' });
    expect(index['knowledge:assistant-architecture']).toMatchObject({ href: '/about#assistant' });
  });

  it('resolves every source cited by the knowledge base', () => {
    for (const e of content.assistant.entries) {
      for (const s of e.sources) expect(index[sourceKey(s)], `${e.id} cites ${sourceKey(s)}`).toBeDefined();
    }
  });

  it('links only to internal routes, with a non-empty label', () => {
    for (const [key, value] of Object.entries(index)) {
      expect(value.label.trim().length, key).toBeGreaterThan(0);
      expect(value.href, key).not.toBeNull();
      expect(internalHrefSchema.safeParse(value.href).success, `${key} → ${value.href}`).toBe(true);
    }
  });

  it('reflects verification changes in the underlying content', () => {
    const verified = structuredClone(content);
    verified.projects[0]!.verification.status = 'owner_verified';
    verified.contact.verification.status = 'owner_verified';
    const next = buildSourceIndex(verified);
    expect(next[`project:${verified.projects[0]!.slug}`]!.verification).toBe('owner_verified');
    expect(next['contact:contact-config']!.verification).toBe('owner_verified');
  });
});

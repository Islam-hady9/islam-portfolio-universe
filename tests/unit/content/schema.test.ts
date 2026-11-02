import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { ICON_NAMES } from '@/content/icon-names';
import {
  CONTENT_MODES,
  VERIFICATION_STATUSES,
  aiKnowledgeEntrySchema,
  assistantKnowledgeSchema,
  careerEntrySchema,
  caseStudySchema,
  contactConfigSchema,
  contentModeSchema,
  iconNameSchema,
  internalHrefSchema,
  projectSummarySchema,
  siteIdentitySchema,
  socialLinkSchema,
  universeNodeSchema,
  verificationSchema,
} from '@/content/schema';

const project = content.projects[0]!;
const career = content.career.entries[0]!;
const caseStudy = content.caseStudies[0]!;
const social = content.social[0]!;

const accepts = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('verification', () => {
  it.each(VERIFICATION_STATUSES)('accepts status "%s"', (status) => {
    expect(accepts(verificationSchema, { status, source: 'CV v1 p.2' })).toBe(true);
  });

  it.each(['verified', 'Placeholder', 'approved', ''])('rejects unknown status "%s"', (status) => {
    expect(accepts(verificationSchema, { status, source: 'CV v1 p.2' })).toBe(false);
  });

  it('requires a meaningful provenance source', () => {
    expect(accepts(verificationSchema, { status: 'placeholder', source: 'ab' })).toBe(false);
    expect(accepts(verificationSchema, { status: 'placeholder' })).toBe(false);
  });

  it('rejects a project whose verification status is invalid', () => {
    const bad = { ...project, verification: { ...project.verification, status: 'verified' } };
    expect(accepts(projectSummarySchema, bad)).toBe(false);
  });
});

describe('project summary', () => {
  it('accepts a real fixture record', () => {
    expect(accepts(projectSummarySchema, project)).toBe(true);
  });

  it.each(['Bad Slug', 'UPPER', 'under_score', 'emoji-✨', ''])('rejects invalid slug "%s"', (slug) => {
    expect(accepts(projectSummarySchema, { ...project, slug })).toBe(false);
  });

  it('rejects an unknown project world or accent', () => {
    expect(accepts(projectSummarySchema, { ...project, world: 'mars' })).toBe(false);
    expect(accepts(projectSummarySchema, { ...project, accent: 'red' })).toBe(false);
  });

  it('requires an integer order', () => {
    expect(accepts(projectSummarySchema, { ...project, order: 1.5 })).toBe(false);
  });
});

describe('icons', () => {
  it('accepts every icon in the closed set', () => {
    for (const name of ICON_NAMES) expect(accepts(iconNameSchema, name)).toBe(true);
  });

  it('rejects an unknown icon name wherever content references icons', () => {
    expect(accepts(iconNameSchema, 'unicorn')).toBe(false);
    expect(accepts(careerEntrySchema, { ...career, icon: 'unicorn' })).toBe(false);
    expect(accepts(socialLinkSchema, { ...social, icon: 'facebook' })).toBe(false);
    const node = content.universe[0]!;
    expect(accepts(universeNodeSchema, { ...node, icon: 'unicorn' })).toBe(false);
  });
});

describe('internal hrefs', () => {
  it.each(['/', '/projects', '/projects/tibyn', '/#contact', '#contact', '/about#assistant'])(
    'accepts "%s"',
    (href) => {
      expect(accepts(internalHrefSchema, href)).toBe(true);
    },
  );

  it.each([
    'https://example.com',
    'mailto:me@example.com',
    'javascript:alert(1)',
    '/path with space',
    '/#bad anchor',
  ])('rejects "%s"', (href) => {
    expect(accepts(internalHrefSchema, href)).toBe(false);
  });

  it('rejects an external href on a career entry or universe node', () => {
    expect(accepts(careerEntrySchema, { ...career, href: 'https://example.com' })).toBe(false);
    expect(accepts(careerEntrySchema, { ...career, href: null })).toBe(true);
    expect(accepts(universeNodeSchema, { ...content.universe[0]!, href: 'https://example.com' })).toBe(false);
  });

  it('rejects empty and protocol-relative hrefs', () => {
    expect(internalHrefSchema.safeParse('').success).toBe(false);
    expect(internalHrefSchema.safeParse('//evil-site').success).toBe(false);
    expect(internalHrefSchema.safeParse('//evil-site/#x').success).toBe(false);
    for (const ok of ['/', '/projects', '/projects/tibyn', '/#contact', '#contact']) {
      expect(internalHrefSchema.safeParse(ok).success, ok).toBe(true);
    }
  });

  it('accepts only https URLs for public profile links', () => {
    expect(accepts(socialLinkSchema, { ...social, url: 'javascript:alert(1)' })).toBe(false);
    expect(accepts(socialLinkSchema, { ...social, url: 'http://example.com' })).toBe(false);
    expect(accepts(socialLinkSchema, { ...social, url: 'https://github.com/someone' })).toBe(true);
  });
});

describe('social links and contact', () => {
  it('requires a URL or null for social links', () => {
    expect(accepts(socialLinkSchema, { ...social, url: null })).toBe(true);
    expect(accepts(socialLinkSchema, { ...social, url: 'https://www.linkedin.com/in/someone' })).toBe(true);
    expect(accepts(socialLinkSchema, { ...social, url: 'not a url' })).toBe(false);
  });

  it('only allows known social networks', () => {
    expect(accepts(socialLinkSchema, { ...social, id: 'facebook' })).toBe(false);
  });

  it('requires a valid email address or null', () => {
    const contact = content.contact;
    expect(accepts(contactConfigSchema, { ...contact, email: null })).toBe(true);
    expect(accepts(contactConfigSchema, { ...contact, email: 'owner@example.com' })).toBe(true);
    expect(accepts(contactConfigSchema, { ...contact, email: 'not-an-email' })).toBe(false);
  });
});

describe('case study', () => {
  it('accepts a real fixture record', () => {
    expect(accepts(caseStudySchema, caseStudy)).toBe(true);
  });

  it('requires every outcome to cite its evidence', () => {
    const outcome = { label: 'Latency', value: '-40%' };
    expect(
      accepts(caseStudySchema, {
        ...caseStudy,
        outcomes: [{ ...outcome, evidence: 'Grafana export, 2025-03' }],
      }),
    ).toBe(true);
    expect(accepts(caseStudySchema, { ...caseStudy, outcomes: [{ ...outcome, evidence: '' }] })).toBe(false);
    expect(accepts(caseStudySchema, { ...caseStudy, outcomes: [outcome] })).toBe(false);
  });

  it('rejects an unknown publication state or diagram kind', () => {
    expect(accepts(caseStudySchema, { ...caseStudy, publication: 'draft' })).toBe(false);
    const withDiagram = content.caseStudies.find((c) => c.diagram !== null)!;
    expect(
      accepts(caseStudySchema, { ...withDiagram, diagram: { ...withDiagram.diagram!, kind: 'approved' } }),
    ).toBe(false);
  });

  it('requires a diagram to have at least two nodes', () => {
    const withDiagram = content.caseStudies.find((c) => c.diagram !== null)!;
    const diagram = { ...withDiagram.diagram!, nodes: withDiagram.diagram!.nodes.slice(0, 1), edges: [] };
    expect(accepts(caseStudySchema, { ...withDiagram, diagram })).toBe(false);
  });
});

describe('assistant knowledge', () => {
  const knowledge = content.assistant;

  it('requires exactly three sample prompts', () => {
    expect(accepts(assistantKnowledgeSchema, knowledge)).toBe(true);
    expect(
      accepts(assistantKnowledgeSchema, { ...knowledge, samplePrompts: knowledge.samplePrompts.slice(0, 2) }),
    ).toBe(false);
  });

  it('rejects single-character keywords and unknown source kinds', () => {
    const entry = knowledge.entries[0]!;
    expect(accepts(aiKnowledgeEntrySchema, { ...entry, keywords: ['a'] })).toBe(false);
    expect(accepts(aiKnowledgeEntrySchema, { ...entry, keywords: [] })).toBe(false);
    expect(accepts(aiKnowledgeEntrySchema, { ...entry, sources: [{ kind: 'website', ref: 'x' }] })).toBe(
      false,
    );
  });
});

describe('site identity and content mode', () => {
  it('requires exactly three pillars', () => {
    const site = content.site;
    expect(accepts(siteIdentitySchema, { ...site, pillars: site.pillars.slice(0, 2) })).toBe(false);
  });

  it('accepts only the three content modes', () => {
    for (const mode of CONTENT_MODES) expect(accepts(contentModeSchema, mode)).toBe(true);
    expect(accepts(contentModeSchema, 'PUBLIC')).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  content,
  getCaseStudy,
  getContentMode,
  getFeaturedProjects,
  getProject,
  getProjects,
  isPublicMode,
  validateReferences,
  type Content,
} from '@/content';
import {
  assetAttributionSchema,
  assistantKnowledgeSchema,
  capabilityGroupSchema,
  careerSchema,
  caseStudySchema,
  contactConfigSchema,
  homeCopySchema,
  principleSchema,
  profileExtrasSchema,
  projectSummarySchema,
  siteIdentitySchema,
  socialLinkSchema,
  universeNodeSchema,
} from '@/content/schema';
import siteJson from '@/content/data/site.json';
import homeJson from '@/content/data/home.json';
import universeJson from '@/content/data/universe.json';
import projectsJson from '@/content/data/projects.json';
import caseStudiesJson from '@/content/data/case-studies.json';
import careerJson from '@/content/data/career.json';
import capabilitiesJson from '@/content/data/capabilities.json';
import philosophyJson from '@/content/data/philosophy.json';
import profileExtrasJson from '@/content/data/profile-extras.json';
import socialJson from '@/content/data/social.json';
import contactJson from '@/content/data/contact.json';
import assistantJson from '@/content/data/assistant.json';
import attributionsJson from '@/content/data/attributions.json';

/** A mutable deep copy of the shipped content, for corrupting in referential-integrity tests. */
const cloneContent = (): Content => structuredClone(content);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('content fixtures', () => {
  const fixtures: [string, z.ZodType, unknown][] = [
    ['site.json', siteIdentitySchema, siteJson],
    ['home.json', homeCopySchema, homeJson],
    ['universe.json', z.array(universeNodeSchema).length(6), universeJson],
    ['projects.json', z.array(projectSummarySchema).min(1), projectsJson],
    ['case-studies.json', z.array(caseStudySchema), caseStudiesJson],
    ['career.json', careerSchema, careerJson],
    ['capabilities.json', z.array(capabilityGroupSchema).length(4), capabilitiesJson],
    ['philosophy.json', z.array(principleSchema).length(5), philosophyJson],
    ['profile-extras.json', profileExtrasSchema, profileExtrasJson],
    ['social.json', z.array(socialLinkSchema), socialJson],
    ['contact.json', contactConfigSchema, contactJson],
    ['assistant.json', assistantKnowledgeSchema, assistantJson],
    ['attributions.json', z.array(assetAttributionSchema), attributionsJson],
  ];

  it.each(fixtures)('%s parses against its schema', (_name, schema, json) => {
    const result = schema.safeParse(json);
    expect(result.success, result.success ? '' : z.prettifyError(result.error)).toBe(true);
  });

  it('exposes the parsed collections with their contractual sizes', () => {
    expect(content.projects.length).toBeGreaterThan(0);
    expect(content.universe).toHaveLength(6);
    expect(content.capabilities).toHaveLength(4);
    expect(content.principles).toHaveLength(5);
    expect(content.site.pillars).toHaveLength(3);
    expect(content.assistant.samplePrompts).toHaveLength(3);
    expect(content.career.entries.length).toBeGreaterThan(0);
  });

  it('has consistent cross-file references', () => {
    expect(validateReferences()).toEqual([]);
    expect(validateReferences(content)).toEqual([]);
  });

  it('gives every project a case study record, and no case study lacks a project', () => {
    for (const p of content.projects) {
      expect(getCaseStudy(p.slug), `case study for ${p.slug}`).not.toBeNull();
    }
    const projectSlugs = content.projects.map((p) => p.slug).sort();
    const caseStudySlugs = content.caseStudies.map((c) => c.slug).sort();
    expect(caseStudySlugs).toEqual(projectSlugs);
  });
});

describe('content getters', () => {
  it('getProjects returns a copy sorted by `order`', () => {
    const projects = getProjects();
    expect(projects).not.toBe(content.projects);
    const orders = projects.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(projects).toHaveLength(content.projects.length);
  });

  it('getFeaturedProjects returns only featured projects, in order', () => {
    const featured = getFeaturedProjects();
    expect(featured.every((p) => p.featured)).toBe(true);
    expect(featured.map((p) => p.slug)).toEqual(
      getProjects()
        .filter((p) => p.featured)
        .map((p) => p.slug),
    );
  });

  it('getProject / getCaseStudy look up by slug and return null for unknown slugs', () => {
    const first = content.projects[0]!;
    expect(getProject(first.slug)).toBe(first);
    expect(getCaseStudy(first.slug)?.slug).toBe(first.slug);
    expect(getProject('does-not-exist')).toBeNull();
    expect(getCaseStudy('does-not-exist')).toBeNull();
  });
});

describe('validateReferences detects broken references', () => {
  it('flags duplicate project slugs', () => {
    const c = cloneContent();
    c.projects.push({ ...c.projects[0]! });
    expect(validateReferences(c)).toEqual([expect.stringContaining('Duplicate project slugs')]);
  });

  it('flags a case study without a matching project', () => {
    const c = cloneContent();
    c.caseStudies.push({ ...c.caseStudies[0]!, slug: 'ghost' });
    expect(validateReferences(c)).toEqual(['Case study "ghost" has no matching project.']);
  });

  it('flags a project without a case study', () => {
    const c = cloneContent();
    const removed = c.caseStudies.splice(c.caseStudies.length - 1, 1)[0]!;
    expect(validateReferences(c)).toEqual([`Project "${removed.slug}" has no case study record.`]);
  });

  it('flags related links to unknown projects', () => {
    const c = cloneContent();
    const cs = c.caseStudies[0]!;
    cs.related.push('nowhere');
    expect(validateReferences(c)).toEqual([`Case study "${cs.slug}" relates to unknown "nowhere".`]);
  });

  it('flags dangling diagram edges', () => {
    const c = cloneContent();
    const cs = c.caseStudies.find((x) => x.diagram !== null)!;
    const from = cs.diagram!.nodes[0]!.id;
    cs.diagram!.edges.push({ from, to: 'missing-node' });
    expect(validateReferences(c)).toEqual([`Diagram edge ${from}→missing-node in "${cs.slug}" is dangling.`]);
  });

  it('flags sample prompts that point to a missing knowledge entry', () => {
    const c = cloneContent();
    const prompt = c.assistant.samplePrompts[0]!;
    prompt.entryId = 'kb-missing';
    expect(validateReferences(c)).toEqual([`Sample prompt "${prompt.id}" points to missing entry.`]);
  });

  it('flags assistant citations of unknown projects, case studies and capabilities', () => {
    const c = cloneContent();
    const entry = c.assistant.entries[0]!;
    entry.sources.push({ kind: 'project', ref: 'nope' });
    entry.sources.push({ kind: 'case-study', ref: 'nope-cs' });
    entry.sources.push({ kind: 'capability', ref: 'nope-cap' });
    expect(validateReferences(c)).toEqual([
      `Assistant entry "${entry.id}" cites unknown project "nope".`,
      `Assistant entry "${entry.id}" cites unknown project "nope-cs".`,
      `Assistant entry "${entry.id}" cites unknown capability "nope-cap".`,
    ]);
  });

  it('flags universe nodes that focus an unknown capability', () => {
    const c = cloneContent();
    const node = c.universe[0]!;
    node.focus = 'not-a-capability';
    expect(validateReferences(c)).toEqual([
      `Universe node "${node.id}" focuses unknown capability "not-a-capability".`,
    ]);
  });
});

describe('content mode', () => {
  it('defaults to DEMO_CONTENT when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_MODE', undefined);
    expect(getContentMode()).toBe('DEMO_CONTENT');
    expect(isPublicMode()).toBe(false);
  });

  it.each(['DEMO_CONTENT', 'OWNER_REVIEW', 'VERIFIED_PUBLIC'] as const)(
    'reads %s from the environment',
    (mode) => {
      vi.stubEnv('NEXT_PUBLIC_CONTENT_MODE', mode);
      expect(getContentMode()).toBe(mode);
      expect(isPublicMode()).toBe(mode === 'VERIFIED_PUBLIC');
    },
  );

  it('falls back to DEMO_CONTENT for an unknown mode', () => {
    vi.stubEnv('NEXT_PUBLIC_CONTENT_MODE', 'PRODUCTION');
    expect(getContentMode()).toBe('DEMO_CONTENT');
  });
});

describe('publication gate on module load', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('refuses to load placeholder content in a VERIFIED_PUBLIC build', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_CONTENT_MODE', 'VERIFIED_PUBLIC');
    await expect(import('@/content')).rejects.toThrow(
      /VERIFIED_PUBLIC build blocked: \d+ placeholder record/,
    );
  });

  it('loads placeholder content in an OWNER_REVIEW build', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_CONTENT_MODE', 'OWNER_REVIEW');
    const mod = await import('@/content');
    expect(mod.getContentMode()).toBe('OWNER_REVIEW');
    expect(mod.content.projects.length).toBeGreaterThan(0);
  });
});

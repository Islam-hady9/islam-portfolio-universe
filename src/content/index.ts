/**
 * Content loader. JSON fixtures are parsed with zod at module load, so a malformed content
 * swap fails the build (and `npm run content:validate`) instead of rendering broken UI.
 * Import from server components, route handlers, scripts and tests — client components
 * receive plain data via props.
 */
import { z } from 'zod';
import {
  assetAttributionSchema,
  assistantKnowledgeSchema,
  capabilityGroupSchema,
  careerSchema,
  caseStudySchema,
  contactConfigSchema,
  contentModeSchema,
  homeCopySchema,
  mediaContentSchema,
  principleSchema,
  profileExtrasSchema,
  projectSummarySchema,
  siteIdentitySchema,
  socialLinkSchema,
  universeNodeSchema,
  verifiedLinksSchema,
  type ContentMode,
} from './schema';
import { assertPublishable } from './gate';

import siteJson from './data/site.json';
import homeJson from './data/home.json';
import universeJson from './data/universe.json';
import projectsJson from './data/projects.json';
import caseStudiesJson from './data/case-studies.json';
import careerJson from './data/career.json';
import capabilitiesJson from './data/capabilities.json';
import philosophyJson from './data/philosophy.json';
import profileExtrasJson from './data/profile-extras.json';
import socialJson from './data/social.json';
import contactJson from './data/contact.json';
import assistantJson from './data/assistant.json';
import attributionsJson from './data/attributions.json';
import mediaJson from './data/media.json';
import verifiedLinksJson from './data/verified-links.json';

function parse<T extends z.ZodType>(name: string, schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Content file "${name}" failed validation:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const content = {
  site: parse('site.json', siteIdentitySchema, siteJson),
  home: parse('home.json', homeCopySchema, homeJson),
  universe: parse('universe.json', z.array(universeNodeSchema).length(6), universeJson),
  projects: parse('projects.json', z.array(projectSummarySchema).min(1), projectsJson),
  caseStudies: parse('case-studies.json', z.array(caseStudySchema), caseStudiesJson),
  career: parse('career.json', careerSchema, careerJson),
  capabilities: parse('capabilities.json', z.array(capabilityGroupSchema).length(4), capabilitiesJson),
  principles: parse('philosophy.json', z.array(principleSchema).length(5), philosophyJson),
  profileExtras: parse('profile-extras.json', profileExtrasSchema, profileExtrasJson),
  social: parse('social.json', z.array(socialLinkSchema), socialJson),
  contact: parse('contact.json', contactConfigSchema, contactJson),
  assistant: parse('assistant.json', assistantKnowledgeSchema, assistantJson),
  attributions: parse('attributions.json', z.array(assetAttributionSchema), attributionsJson),
  media: parse('media.json', mediaContentSchema, mediaJson),
  verifiedLinks: parse('verified-links.json', verifiedLinksSchema, verifiedLinksJson),
} as const;

export type Content = typeof content;

/** Cross-file referential integrity (slugs, related links, assistant sources). */
export function validateReferences(c: Content = content): string[] {
  const problems: string[] = [];
  const slugs = new Set(c.projects.map((p) => p.slug));
  if (slugs.size !== c.projects.length) problems.push('Duplicate project slugs.');
  for (const cs of c.caseStudies) {
    if (!slugs.has(cs.slug)) problems.push(`Case study "${cs.slug}" has no matching project.`);
    for (const r of cs.related)
      if (!slugs.has(r)) problems.push(`Case study "${cs.slug}" relates to unknown "${r}".`);
    if (cs.diagram) {
      const ids = new Set(cs.diagram.nodes.map((n) => n.id));
      for (const e of cs.diagram.edges)
        if (!ids.has(e.from) || !ids.has(e.to))
          problems.push(`Diagram edge ${e.from}→${e.to} in "${cs.slug}" is dangling.`);
    }
  }
  for (const p of c.projects)
    if (!c.caseStudies.some((cs) => cs.slug === p.slug))
      problems.push(`Project "${p.slug}" has no case study record.`);
  const entryIds = new Set(c.assistant.entries.map((e) => e.id));
  for (const prompt of c.assistant.samplePrompts)
    if (!entryIds.has(prompt.entryId)) problems.push(`Sample prompt "${prompt.id}" points to missing entry.`);
  const capIds = new Set(c.capabilities.map((g) => g.id));
  for (const e of c.assistant.entries) {
    for (const s of e.sources) {
      if ((s.kind === 'project' || s.kind === 'case-study') && !slugs.has(s.ref))
        problems.push(`Assistant entry "${e.id}" cites unknown project "${s.ref}".`);
      if (s.kind === 'capability' && !capIds.has(s.ref))
        problems.push(`Assistant entry "${e.id}" cites unknown capability "${s.ref}".`);
    }
  }
  for (const n of c.universe) {
    if (n.focus && !capIds.has(n.focus))
      problems.push(`Universe node "${n.id}" focuses unknown capability "${n.focus}".`);
  }
  for (const r of c.verifiedLinks.repositories) {
    if (r.matchedProject && !slugs.has(r.matchedProject))
      problems.push(`Verified repository "${r.id}" matches unknown project "${r.matchedProject}".`);
  }
  return problems;
}

const referenceProblems = validateReferences(content);
if (referenceProblems.length) {
  throw new Error(`Content references are inconsistent:\n- ${referenceProblems.join('\n- ')}`);
}

export function getContentMode(): ContentMode {
  const parsed = contentModeSchema.safeParse(process.env.NEXT_PUBLIC_CONTENT_MODE ?? 'DEMO_CONTENT');
  return parsed.success ? parsed.data : 'DEMO_CONTENT';
}

// Publication gate (spec §10): a VERIFIED_PUBLIC build refuses to render placeholder records.
assertPublishable(getContentMode(), content);

export const getSite = () => content.site;
export const getHomeCopy = () => content.home;
export const getUniverseNodes = () => content.universe;
export const getProjects = () => [...content.projects].sort((a, b) => a.order - b.order);
export const getFeaturedProjects = () => getProjects().filter((p) => p.featured);
export const getProject = (slug: string) => content.projects.find((p) => p.slug === slug) ?? null;
export const getCaseStudy = (slug: string) => content.caseStudies.find((c) => c.slug === slug) ?? null;
export const getCareer = () => content.career;
export const getCapabilities = () => content.capabilities;
export const getPrinciples = () => content.principles;
export const getProfileExtras = () => content.profileExtras;
export const getSocialLinks = () => content.social;
export const getContact = () => content.contact;
export const getAssistantKnowledge = () => content.assistant;
export const getAttributions = () => content.attributions;
export const getMedia = () => content.media;
/** Registry for the CV-population phase — scripts and tests only; never rendered. */
export const getVerifiedLinks = () => content.verifiedLinks;
export const isPublicMode = () => getContentMode() === 'VERIFIED_PUBLIC';

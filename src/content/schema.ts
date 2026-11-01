/**
 * Typed content contracts (spec §4.2, §4.3, §9.1, §10).
 *
 * Every record that makes a statement about the owner carries `verification`:
 *   - placeholder     → drafted during engineering or not yet supplied; never a factual claim
 *   - owner_verified  → supplied/approved by the owner (e.g. verbatim copy from the owner brief)
 *   - public_verified → verifiable from a public source the owner approved
 *
 * Swapping fixtures for CV-derived content means replacing the JSON in ./data and
 * re-running `npm run content:validate`; no component or scene code changes.
 */
import { z } from 'zod';
import { ICON_NAMES } from './icon-names';

export const VERIFICATION_STATUSES = ['placeholder', 'owner_verified', 'public_verified'] as const;
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const verificationSchema = z.object({
  status: verificationStatusSchema,
  /** Provenance: where the content came from (e.g. "IU-MASTER-001 §5 S2", "CV v1 p.2"). */
  source: z.string().min(3),
  note: z.string().optional(),
});
export type Verification = z.infer<typeof verificationSchema>;

export const CONTENT_MODES = ['DEMO_CONTENT', 'OWNER_REVIEW', 'VERIFIED_PUBLIC'] as const;
export const contentModeSchema = z.enum(CONTENT_MODES);
export type ContentMode = z.infer<typeof contentModeSchema>;

export const iconNameSchema = z.enum(ICON_NAMES);
export const accentSchema = z.enum(['mint', 'cyan', 'violet', 'blue']);
export type Accent = z.infer<typeof accentSchema>;

/**
 * Internal href: "/route", "/#anchor" or "#anchor" — never empty and never protocol-relative
 * ("//host" would leave the site). External links live in SocialLink.
 */
export const internalHrefSchema = z
  .string()
  .min(1)
  .regex(/^(?:\/(?!\/)[a-z0-9\-/]*)?(?:#[a-z0-9-]+)?$/i, 'internal href');

/** Public profile/resource URLs: https only (rejects javascript:, data:, http:). */
export const httpsUrlSchema = z.url({ protocol: /^https$/ });

// ───────────────────────── Site identity ─────────────────────────

export const pillarSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: iconNameSchema,
  verification: verificationSchema,
});

export const siteIdentitySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  portfolioIdentity: z.string(),
  roleLabel: z.string(),
  headlineLines: z.array(z.string()).min(1).max(3),
  proposition: z.string(),
  heroStatement: z.string(),
  extendedStatement: z.string(),
  verification: verificationSchema,
  identity: z.object({
    eyebrow: z.string(),
    statement: z.string(),
    highlights: z.array(z.string()),
    verification: verificationSchema,
  }),
  pillars: z.array(pillarSchema).length(3),
  seo: z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
  }),
});
export type SiteIdentity = z.infer<typeof siteIdentitySchema>;

// ───────────────────────── Home section copy ─────────────────────────

const sectionCopy = z.object({
  eyebrow: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

export const homeCopySchema = z.object({
  hero: z.object({
    ctaExplore: z.string(),
    ctaProjects: z.string(),
    ctaResume: z.string(),
    ctaResumeDeferredNote: z.string(),
    ctaTalk: z.string(),
    artDescription: z.string(),
  }),
  universe: sectionCopy.extend({ hint: z.string(), artDescription: z.string() }),
  projects: sectionCopy.extend({ viewAll: z.string() }),
  philosophy: sectionCopy,
  capabilities: sectionCopy.extend({ footnote: z.string() }),
  experience: sectionCopy.extend({ subtitle: z.string() }),
  assistant: sectionCopy.extend({ body: z.string(), status: z.string(), artDescription: z.string() }),
  contact: sectionCopy.extend({ body: z.string() }),
  verification: verificationSchema,
});
export type HomeCopy = z.infer<typeof homeCopySchema>;

// ───────────────────────── Universe navigation ─────────────────────────

export const universeNodeSchema = z.object({
  id: z.enum(['ai-systems', 'products', 'case-studies', 'experience', 'stack', 'contact']),
  label: z.string(),
  teaser: z.string(),
  href: internalHrefSchema,
  icon: iconNameSchema,
  accent: accentSchema,
  /** Optional capability group to highlight after travelling to #capabilities. */
  focus: z.string().optional(),
});
export type UniverseNode = z.infer<typeof universeNodeSchema>;

// ───────────────────────── Projects & case studies ─────────────────────────

export const projectWorldSchema = z.enum(['tibyn', 'movid', 'ats', 'lifeatlas']);
export type ProjectWorld = z.infer<typeof projectWorldSchema>;

export const projectSummarySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  tagline: z.string(),
  categoryLabel: z.string(),
  category: z.string(),
  /** Neutral stage label (e.g. "Concept / In development"). Null when not applicable. */
  stage: z.string().nullable(),
  summary: z.string(),
  world: projectWorldSchema,
  accent: accentSchema,
  featured: z.boolean(),
  order: z.number().int(),
  posterAlt: z.string(),
  verification: verificationSchema,
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const diagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().optional(),
  lane: z.enum(['input', 'data', 'intelligence', 'product', 'operations']),
});
export const diagramEdgeSchema = z.object({ from: z.string(), to: z.string(), label: z.string().optional() });
export const systemDiagramSchema = z.object({
  /** "illustrative" diagrams are templates and must be labelled as such in the UI. */
  kind: z.enum(['illustrative', 'verified']),
  caption: z.string(),
  nodes: z.array(diagramNodeSchema).min(2),
  edges: z.array(diagramEdgeSchema),
});
export type SystemDiagram = z.infer<typeof systemDiagramSchema>;

const titledText = z.object({ title: z.string(), body: z.string() });

export const caseStudySchema = z.object({
  slug: z.string(),
  publication: z.enum(['in_preparation', 'published']),
  role: z.string().nullable(),
  period: z.string().nullable(),
  industry: z.string().nullable(),
  pitch: z.string(),
  context: z.string().nullable(),
  goals: z.array(z.string()),
  constraints: z.array(z.string()),
  diagram: systemDiagramSchema.nullable(),
  workflow: z.array(titledText),
  decisions: z.array(z.object({ title: z.string(), choice: z.string(), tradeoff: z.string() })),
  highlights: z.array(titledText),
  challenges: z.array(z.object({ challenge: z.string(), solution: z.string() })),
  operations: z.object({
    reliability: z.string().nullable(),
    observability: z.string().nullable(),
    deployment: z.string().nullable(),
    testing: z.string().nullable(),
  }),
  /** Only evidenced outcomes. Each must cite its evidence. */
  outcomes: z.array(z.object({ label: z.string(), value: z.string(), evidence: z.string().min(3) })),
  media: z.array(z.object({ src: z.string(), alt: z.string(), caption: z.string().optional() })),
  lessons: z.array(z.string()),
  nextSteps: z.array(z.string()),
  stack: z.array(z.string()),
  related: z.array(z.string()),
  verification: verificationSchema,
});
export type CaseStudy = z.infer<typeof caseStudySchema>;

// ───────────────────────── Career, capabilities, philosophy ─────────────────────────

export const careerEntrySchema = z.object({
  id: z.string(),
  phase: z.string(),
  title: z.string(),
  organization: z.string().nullable(),
  period: z.string().nullable(),
  summary: z.string(),
  icon: iconNameSchema,
  current: z.boolean(),
  href: internalHrefSchema.nullable(),
  verification: verificationSchema,
});
export type CareerEntry = z.infer<typeof careerEntrySchema>;

export const careerSchema = z.object({
  intro: z.string(),
  sampleNotice: z.string(),
  entries: z.array(careerEntrySchema).min(1),
});
export type Career = z.infer<typeof careerSchema>;

export const capabilityGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: iconNameSchema,
  skills: z.array(z.string()).min(1),
  verification: verificationSchema,
});
export type CapabilityGroup = z.infer<typeof capabilityGroupSchema>;

export const principleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: iconNameSchema,
  verification: verificationSchema,
});
export type Principle = z.infer<typeof principleSchema>;

// ───────────────────────── Profile extras (education, research, achievements) ─────────────────────────

const profileItem = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string().nullable(),
  period: z.string().nullable(),
  summary: z.string().nullable(),
  href: httpsUrlSchema.nullable(),
  verification: verificationSchema,
});
export const profileExtrasSchema = z.object({
  education: z.array(profileItem),
  research: z.array(profileItem),
  achievements: z.array(profileItem),
  pendingNotice: z.string(),
});
export type ProfileExtras = z.infer<typeof profileExtrasSchema>;

// ───────────────────────── Social & contact ─────────────────────────

export const socialLinkSchema = z.object({
  id: z.enum(['linkedin', 'github', 'email', 'x', 'website']),
  label: z.string(),
  url: httpsUrlSchema.nullable(),
  icon: iconNameSchema,
  unavailableMessage: z.string(),
  verification: verificationSchema,
});
export type SocialLink = z.infer<typeof socialLinkSchema>;

export const contactConfigSchema = z.object({
  email: z.email().nullable(),
  availability: z.string().nullable(),
  location: z.string().nullable(),
  responseNote: z.string().nullable(),
  unavailableMessage: z.string(),
  verification: verificationSchema,
  resume: z.object({
    url: z.string().nullable(),
    unavailableMessage: z.string(),
    verification: verificationSchema,
  }),
});
export type ContactConfig = z.infer<typeof contactConfigSchema>;

// ───────────────────────── Assistant knowledge ─────────────────────────

export const sourceRefSchema = z.object({
  kind: z.enum(['project', 'case-study', 'capability', 'career', 'site', 'contact', 'knowledge']),
  ref: z.string(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const aiKnowledgeEntrySchema = z.object({
  id: z.string(),
  topic: z.enum(['projects', 'project', 'stack', 'experience', 'contact', 'meta', 'philosophy']),
  /** For topic "project": which project slug this entry answers about. */
  subject: z.string().optional(),
  keywords: z.array(z.string().min(2)).min(1),
  answer: z.string(),
  sources: z.array(sourceRefSchema),
  verification: verificationSchema,
});
export type AIKnowledgeEntry = z.infer<typeof aiKnowledgeEntrySchema>;

export const assistantKnowledgeSchema = z.object({
  samplePrompts: z.array(z.object({ id: z.string(), label: z.string(), entryId: z.string() })).length(3),
  fallbackAnswer: z.string(),
  entries: z.array(aiKnowledgeEntrySchema).min(1),
});
export type AssistantKnowledge = z.infer<typeof assistantKnowledgeSchema>;

// ───────────────────────── Asset attribution ─────────────────────────

export const assetAttributionSchema = z.object({
  id: z.string(),
  asset: z.string(),
  origin: z.enum([
    'original-procedural',
    'original-generated-from-site',
    'third-party-licensed',
    'owner-supplied',
  ]),
  license: z.string(),
  source: z.string(),
  notes: z.string().optional(),
});
export type AssetAttribution = z.infer<typeof assetAttributionSchema>;

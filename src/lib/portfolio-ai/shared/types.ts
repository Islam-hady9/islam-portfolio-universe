/**
 * Portfolio Intelligence Engine — shared contracts (PIE spec §5, §10).
 * One corpus, two answer engines (Smart retrieval, Local generation), one answer contract.
 * Pure types: safe to import from server, client and worker code.
 */

export type AiMode = 'smart' | 'local';
export type AiLanguage = 'en' | 'ar' | 'mixed';

/** A compiled, AI-eligible public fact (spec §5 KnowledgeRecord). */
export interface KnowledgeRecord {
  id: string;
  type: 'profile' | 'skill' | 'project' | 'experience' | 'education' | 'contact' | 'faq';
  title: string;
  /** Approved public text, quoted verbatim from the content record (or a site-behaviour fact). */
  publicText: string;
  language: AiLanguage;
  keywords: string[];
  aliases: string[];
  /** Content record the text came from, e.g. "content.site.heroStatement". */
  sourcePath: string;
  /** Validated navigable link (internal route, verified profile URL or verified mailto). */
  publicUrl?: string;
  verification: 'verified';
  visibility: 'public';
  approvedForAi: true;
  version: string;
}

/** A candidate before eligibility checks: what the compiler may reject. */
export interface CandidateRecord extends Omit<
  KnowledgeRecord,
  'verification' | 'visibility' | 'approvedForAi' | 'version'
> {
  verification: 'verified' | 'placeholder' | 'pending';
  visibility: 'public' | 'private';
  approvedForAi: boolean;
  /** Approval key in src/content/data/ai-knowledge.json. */
  source: string;
}

export interface RejectedRecord {
  id: string;
  source: string;
  reason: 'not-verified' | 'not-public' | 'not-approved' | 'invalid-url' | 'pii' | 'unsafe-text';
}

/** Navigation target an answer may link to (never a fact by itself). */
export interface LinkTarget {
  id: string;
  label: string;
  href: string;
  kind: 'route' | 'external' | 'mailto';
  /** The linked page's own details are still pending verification. */
  pendingDetails?: boolean;
  /** Aliases that route a question to this page (e.g. a project's name). */
  aliases?: string[];
}

export interface KnowledgeManifest {
  schema: 1;
  /** Content hash of records + links: changes whenever approved content changes. */
  version: string;
  records: KnowledgeRecord[];
  links: LinkTarget[];
  /** Counts of records still awaiting verification, by collection (honest status answers). */
  pending: Record<string, number>;
}

export interface Evidence {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  recordId: string;
}

export type AnswerStatus = 'answered' | 'partial' | 'insufficient-evidence' | 'refused' | 'error';

export interface Answer {
  mode: AiMode;
  text: string;
  evidence: Evidence[];
  /** Next actions: allowlisted links only. */
  links: LinkTarget[];
  status: AnswerStatus;
  /** Which deterministic route produced a Smart answer (evaluation + debugging). */
  intent?: string;
  disclaimer?: string;
  suggestedQuestions?: string[];
  language: 'en' | 'ar';
}

/** A previous turn, reduced to what follow-up resolution may use. */
export interface SafeTurn {
  question: string;
  answer: string;
  /** Unique entity the turn was about (record or link id), if any. */
  entity?: string;
}

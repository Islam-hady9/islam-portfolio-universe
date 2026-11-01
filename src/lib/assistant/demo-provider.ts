import type { AIKnowledgeEntry, AssistantKnowledge } from '@/content/schema';
import {
  DEMO_DISCLAIMER,
  sourceKey,
  type AskRequest,
  type AssistantClient,
  type GroundedAnswer,
  type SourceIndex,
  type SourceReference,
} from './contracts';
import { checkQuestion } from './safety';

/**
 * Deterministic demo provider (spec §9.1, D-13). Keyword retrieval over the fixture
 * knowledge base; every answer cites the content records it came from; unknown questions get
 * an honest out-of-scope reply. No model, no network, no storage, no simulated "typing".
 */

/**
 * Lower-cases and strips punctuation to single spaces, keeping characters that matter inside
 * technical terms ("next.js", "c++", "c#", "multi-agent") but dropping sentence punctuation
 * such as a trailing full stop.
 */
export function normalizeText(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9.+#-]+/g, ' ')
    .replace(/[.\-]+(?=\s|$)/g, ' ')
    .replace(/(^|\s)[.\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

function tokenize(text: string): string[] {
  return normalizeText(text).trim().split(' ').filter(Boolean);
}

export function scoreEntry(entry: AIKnowledgeEntry, question: string): number {
  const q = normalizeText(question);
  const tokens = new Set(tokenize(question));
  let score = 0;
  for (const kw of entry.keywords) {
    const k = normalizeText(kw).trim();
    if (k.includes(' ')) {
      if (q.includes(` ${k} `)) score += 3;
    } else if (tokens.has(k)) {
      score += k.length > 4 ? 2 : 1.5;
    }
  }
  // Specific subjects (a named project) beat general topics when both match.
  if (entry.topic === 'project' && score > 0) score += 1.5;
  return score;
}

export function selectEntry(knowledge: AssistantKnowledge, question: string): AIKnowledgeEntry | null {
  let best: AIKnowledgeEntry | null = null;
  let bestScore = 0;
  for (const entry of knowledge.entries) {
    const s = scoreEntry(entry, question);
    if (s > bestScore) {
      best = entry;
      bestScore = s;
    }
  }
  return bestScore >= 1.5 ? best : null;
}

function resolveSources(entry: AIKnowledgeEntry, index: SourceIndex): SourceReference[] {
  return entry.sources.map((s) => {
    const resolved = index[sourceKey(s)];
    return {
      kind: s.kind,
      ref: s.ref,
      label: resolved?.label ?? `${s.kind}: ${s.ref}`,
      href: resolved?.href ?? null,
      verification: resolved?.verification ?? 'placeholder',
    };
  });
}

export function answerDemo(
  knowledge: AssistantKnowledge,
  index: SourceIndex,
  request: AskRequest,
): GroundedAnswer {
  const verdict = checkQuestion(request.question);
  if (!verdict.ok) {
    return {
      mode: 'demo',
      status: 'refused',
      answer: verdict.message,
      sources: [],
      entryId: null,
      disclaimer: DEMO_DISCLAIMER,
    };
  }
  const entry = selectEntry(knowledge, verdict.question);
  if (!entry) {
    return {
      mode: 'demo',
      status: 'out_of_scope',
      answer: knowledge.fallbackAnswer,
      sources: [],
      entryId: null,
      disclaimer: DEMO_DISCLAIMER,
    };
  }
  return {
    mode: 'demo',
    status: 'answered',
    answer: entry.answer,
    sources: resolveSources(entry, index),
    entryId: entry.id,
    disclaimer: DEMO_DISCLAIMER,
  };
}

export function answerEntryById(
  knowledge: AssistantKnowledge,
  index: SourceIndex,
  entryId: string,
): GroundedAnswer | null {
  const entry = knowledge.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  return {
    mode: 'demo',
    status: 'answered',
    answer: entry.answer,
    sources: resolveSources(entry, index),
    entryId: entry.id,
    disclaimer: DEMO_DISCLAIMER,
  };
}

export class DemoAssistantClient implements AssistantClient {
  readonly mode = 'demo' as const;
  constructor(
    private readonly knowledge: AssistantKnowledge,
    private readonly index: SourceIndex,
  ) {}
  async ask(request: AskRequest): Promise<GroundedAnswer> {
    return answerDemo(this.knowledge, this.index, request);
  }
}

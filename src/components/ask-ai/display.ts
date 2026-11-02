/**
 * Converts engine results into what the panel renders. The label of every answer follows the
 * engine that produced it — a Smart template is never shown as "Generated Locally" (spec §10).
 */
import type { SmartAnswer } from '@/lib/portfolio-ai/smart/engine';
import type { LocalTurnOutcome } from '@/lib/portfolio-ai/local/orchestrate';
import type { DisplayAnswer, Turn } from './state';
import { FALLBACK_NOTICE, LOCAL_DISCLAIMER } from './copy';
import type { SafeTurn } from '@/lib/portfolio-ai/shared/types';

export function smartDisplay(a: SmartAnswer, notice?: string): DisplayAnswer {
  return {
    mode: 'smart',
    text: a.text,
    status: a.status,
    evidence: a.evidence,
    links: a.links,
    language: a.language,
    suggestedQuestions: a.suggestedQuestions,
    ...(a.entity ? { entity: a.entity } : {}),
    ...(a.intent ? { intent: a.intent } : {}),
    ...(notice ? { notice } : {}),
  };
}

export function outcomeDisplay(o: LocalTurnOutcome): DisplayAnswer | null {
  if (o.kind === 'cancelled') return null;
  if (o.kind === 'smart') return smartDisplay(o.smart, FALLBACK_NOTICE[o.reason][o.smart.language]);
  const lang = o.smart.language;
  const cited = new Set(o.verification.citedIds);
  return {
    mode: 'local',
    text: o.text,
    status: o.verification.abstained ? 'insufficient-evidence' : o.smart.status,
    evidence: o.evidence.map((e) => ({ ...e, cited: cited.has(e.id) })),
    links: o.smart.links,
    language: lang,
    disclaimer: LOCAL_DISCLAIMER[lang],
    suggestedQuestions: o.smart.suggestedQuestions,
    ...(o.smart.entity ? { entity: o.smart.entity } : {}),
    ...(o.smart.intent ? { intent: o.smart.intent } : {}),
  };
}

/** Bounded, per-tab history for follow-ups (never persisted). */
export function safeHistory(turns: Turn[]): SafeTurn[] {
  return turns
    .filter((t) => t.state === 'done' && t.answer)
    .slice(-4)
    .map((t) => ({
      question: t.question,
      answer: t.answer!.text.slice(0, 300),
      ...(t.answer!.entity ? { entity: t.answer!.entity } : {}),
    }));
}

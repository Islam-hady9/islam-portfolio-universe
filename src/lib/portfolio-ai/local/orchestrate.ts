/**
 * One Local AI turn (PIE spec §7, §10 fallback matrix):
 *   Smart routing decides whether generation is allowed at all (blocked or evidence-less
 *   questions get the Smart answer, labelled as such) → generate with the same evidence →
 *   verify → one stricter retry → otherwise the grounded Smart answer, with an honest notice.
 * Never falls back to any network service.
 */
import type { SafeTurn } from '../shared/types';
import type { SmartAnswer, SmartEngine } from '../smart/engine';
import type { GenerationStats } from './protocol';
import type { GenerationResult, GenerateInput } from './client';
import { verifyGenerated, type Verification } from './verify';

export interface Generator {
  generate(input: GenerateInput, onToken?: (token: string) => void): Promise<GenerationResult>;
}

export type LocalTurnOutcome =
  | {
      kind: 'local';
      smart: SmartAnswer;
      text: string;
      verification: Verification;
      stats: GenerationStats;
      attempts: number;
      evidence: ReturnType<SmartEngine['evidenceFor']>;
    }
  | {
      kind: 'smart';
      smart: SmartAnswer;
      reason: 'blocked' | 'no-evidence' | 'not-grounded' | 'arabic' | 'model-abstained';
      verification?: Verification;
      attempts: number;
    }
  | { kind: 'cancelled'; smart: SmartAnswer; attempts: number };

export interface AttemptRecord {
  attempt: number;
  strict: boolean;
  raw: string;
  finishReason: GenerationResult['finishReason'];
  verification: Verification;
  stats: GenerationStats;
}

export interface LocalTurnOptions {
  /** Arabic generation cannot be lexically verified against English evidence (MODEL-EVALUATION.md). */
  generateArabic: boolean;
  /** Evaluation hook: every raw attempt with its verification (never sent anywhere). */
  onAttempt?: (record: AttemptRecord) => void;
}

export async function runLocalTurn(
  engine: SmartEngine,
  generator: Generator,
  question: string,
  history: SafeTurn[],
  onToken: (token: string) => void,
  onRetry: () => void,
  options: LocalTurnOptions = { generateArabic: false },
): Promise<LocalTurnOutcome> {
  const smart = engine.answer(question, history);
  if (smart.grounding === 'blocked') return { kind: 'smart', smart, reason: 'blocked', attempts: 0 };
  if (smart.grounding !== 'evidence') return { kind: 'smart', smart, reason: 'no-evidence', attempts: 0 };
  if (smart.language === 'ar' && !options.generateArabic)
    return { kind: 'smart', smart, reason: 'arabic', attempts: 0 };

  const evidence = engine.evidenceFor(question, smart);
  let last: Verification | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt === 2) onRetry();
    const result = await generator.generate(
      { query: question, evidence, history: history.slice(-2), lang: smart.language, strict: attempt === 2 },
      onToken,
    );
    if (result.finishReason === 'abort') return { kind: 'cancelled', smart, attempts: attempt };
    last = verifyGenerated(result.text, evidence, engine.allLinks, smart.language);
    options.onAttempt?.({
      attempt,
      strict: attempt === 2,
      raw: result.text,
      finishReason: result.finishReason,
      verification: last,
      stats: result.stats,
    });
    // A model that abstains although Smart Mode has a grounded answer would be a step back:
    // show the Smart answer instead (labelled as such).
    if (last.ok && last.abstained && (smart.status === 'answered' || smart.status === 'partial'))
      return { kind: 'smart', smart, reason: 'model-abstained', verification: last, attempts: attempt };
    if (last.ok)
      return {
        kind: 'local',
        smart,
        text: last.text,
        verification: last,
        stats: result.stats,
        attempts: attempt,
        evidence,
      };
  }
  return { kind: 'smart', smart, reason: 'not-grounded', verification: last, attempts: 2 };
}

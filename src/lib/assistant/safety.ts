import type { SafetyPolicy } from './contracts';

/**
 * Baseline safety policy. The demo never forwards input anywhere, but the same policy object
 * will gate the future live backend (spec §9.2: prompt-injection defences, privacy).
 */
export const SAFETY_POLICY: SafetyPolicy = {
  maxQuestionLength: 500,
  requireCitations: true,
  storeInputs: false,
  injectionPatterns: [
    /ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)/i,
    /disregard (your|the) (rules|instructions|system prompt)/i,
    /(reveal|print|show|repeat) (your|the) (system )?(prompt|instructions)/i,
    /you are now (?!an? assistant)/i,
    /\bjailbreak\b|\bDAN mode\b/i,
  ],
  // Requests for personal data about the owner — not product topics ("password reset flows",
  // "phone apps") and not the public contact channel ("email address" → contact answer).
  privateDataPatterns: [
    /\b(home|street|postal|mailing|physical) address\b|\bwhere (do|does) (you|he) live\b/i,
    /\b(phone|mobile|cell)\b(?!\s*-?\s*(apps?|applications?|ui|screens?|layouts?|design|games?|versions?|views?|frameworks?|development)\b)/i,
    /\b(your|his) (salary|income|bank|password|passport)\b|\bbank (details|account|info|information|card)\b|\b(national id|ssn|social security)\b/i,
  ],
};

export type SafetyVerdict =
  | { ok: true; question: string }
  | { ok: false; reason: 'empty' | 'too_long' | 'injection' | 'private_data'; message: string };

export function normalizeQuestion(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function checkQuestion(raw: string, policy: SafetyPolicy = SAFETY_POLICY): SafetyVerdict {
  const question = normalizeQuestion(raw);
  if (!question) return { ok: false, reason: 'empty', message: 'Ask a question to try the demo.' };
  if (question.length > policy.maxQuestionLength) {
    return {
      ok: false,
      reason: 'too_long',
      message: `Questions are limited to ${policy.maxQuestionLength} characters.`,
    };
  }
  if (policy.injectionPatterns.some((re) => re.test(question))) {
    return {
      ok: false,
      reason: 'injection',
      message: 'I can only answer questions about the portfolio content — I can’t change how I work.',
    };
  }
  if (policy.privateDataPatterns.some((re) => re.test(question))) {
    return {
      ok: false,
      reason: 'private_data',
      message: 'Personal or private details aren’t shared here. Use the Contact page for direct enquiries.',
    };
  }
  return { ok: true, question };
}

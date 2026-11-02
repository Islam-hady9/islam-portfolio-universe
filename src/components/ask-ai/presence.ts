import type { Presence } from '@/state/assistant-store';
import type { AskState } from './state';

const round = (p: number | null | undefined) =>
  typeof p === 'number' && Number.isFinite(p) ? Math.round(Math.max(0, Math.min(1, p)) * 100) / 100 : null;

/**
 * The assistant's compact presence for the floating orb (AI Presence V1), derived from the one
 * panel state machine — never stored twice. Precedence: model work (download → initialize →
 * generate) over retrieval over trouble over the last outcome. Progress is rounded to 1 % so a
 * download publishes at most ~100 updates; nothing is published per token.
 */
export function presenceOf(s: AskState): Presence {
  const last = s.turns.at(-1);
  if (s.local === 'downloading') return { phase: 'downloading', progress: round(s.progress?.progress) };
  if (s.local === 'initializing') return { phase: 'initializing', progress: round(s.progress?.progress) };
  if (s.local === 'generating' || last?.state === 'streaming') return { phase: 'generating', progress: null };
  if (last?.state === 'pending' || s.smart === 'loading' || s.local === 'capability-check')
    return { phase: 'retrieving', progress: null };
  if (
    s.smart === 'error' ||
    s.local === 'error' ||
    s.local === 'resource-pressure' ||
    last?.state === 'error'
  )
    return { phase: 'error', progress: null };
  if (last?.state === 'done' && last.answer?.notice) return { phase: 'fallback', progress: null };
  if (last?.state === 'done') return { phase: 'complete', progress: null };
  if (s.smart === 'ready') return { phase: 'ready', progress: null };
  return { phase: 'idle', progress: null };
}

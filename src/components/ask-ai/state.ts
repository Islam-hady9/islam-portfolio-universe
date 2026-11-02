/**
 * Ask My AI panel state machine (PIE spec §3 "UI states"). Pure reducer + derived UI state so
 * every transition is unit-testable without React, a worker or a GPU.
 */
import type { AnswerStatus, Evidence, LinkTarget } from '@/lib/portfolio-ai/shared/types';

export type LocalStatus =
  | 'off'
  | 'capability-check'
  | 'unavailable'
  | 'consent'
  | 'downloading'
  | 'initializing'
  | 'ready'
  | 'generating'
  | 'error'
  | 'resource-pressure'
  | 'offline-without-model';

export type UiState =
  | 'smart-ready'
  | 'smart-searching'
  | 'smart-answer'
  | 'smart-no-match'
  | 'capability-check'
  | 'local-unavailable'
  | 'local-consent'
  | 'model-downloading'
  | 'model-initializing'
  | 'local-ready'
  | 'local-generating'
  | 'local-answer'
  | 'local-cancelled'
  | 'local-error'
  | 'resource-pressure'
  | 'switching-mode'
  | 'offline-without-model';

export interface DisplayEvidence extends Evidence {
  /** The local model cited this item ([E#] in its answer). */
  cited?: boolean;
}

export interface DisplayAnswer {
  mode: 'smart' | 'local';
  text: string;
  status: AnswerStatus;
  evidence: DisplayEvidence[];
  links: LinkTarget[];
  language: 'en' | 'ar';
  disclaimer?: string;
  /** Why a Smart answer appears while Local AI is on (blocked request, failed verification…). */
  notice?: string;
  suggestedQuestions?: string[];
  entity?: string;
  intent?: string;
}

export interface Turn {
  id: number;
  question: string;
  state: 'pending' | 'streaming' | 'done' | 'cancelled' | 'error';
  streaming: string;
  answer?: DisplayAnswer;
}

export interface Progress {
  stage: 'download' | 'load' | 'compile';
  progress: number;
  completed?: number;
  total?: number;
  text: string;
}

export interface AskState {
  smart: 'idle' | 'loading' | 'ready' | 'error';
  mode: 'smart' | 'local';
  local: LocalStatus;
  progress: Progress | null;
  localError: { code: string; message: string } | null;
  unavailable: string | null;
  cache: 'absent' | 'partial' | 'complete' | 'unknown' | null;
  switching: boolean;
  turns: Turn[];
}

export type Action =
  | { type: 'smart/loading' }
  | { type: 'smart/ready' }
  | { type: 'smart/error' }
  | { type: 'ask'; id: number; question: string }
  | { type: 'stream'; id: number; token: string }
  | { type: 'stream/reset'; id: number }
  | { type: 'answer'; id: number; answer: DisplayAnswer }
  | { type: 'cancelled'; id: number }
  | { type: 'turn/error'; id: number; answer?: DisplayAnswer }
  | { type: 'local/check' }
  | { type: 'local/unavailable'; reason: string }
  | { type: 'local/consent'; cache: AskState['cache'] }
  | { type: 'local/progress'; progress: Progress }
  | { type: 'local/ready' }
  | { type: 'local/generating' }
  | { type: 'local/idle' }
  | { type: 'local/error'; code: string; message: string }
  | { type: 'local/pressure'; message: string }
  | { type: 'local/offline' }
  | { type: 'local/cache'; cache: AskState['cache'] }
  | { type: 'mode/switching' }
  | { type: 'mode/smart' }
  | { type: 'clear' };

export const MAX_TURNS = 8;

export const initialState: AskState = {
  smart: 'idle',
  mode: 'smart',
  local: 'off',
  progress: null,
  localError: null,
  unavailable: null,
  cache: null,
  switching: false,
  turns: [],
};

const updateTurn = (s: AskState, id: number, fn: (t: Turn) => Turn): AskState => ({
  ...s,
  turns: s.turns.map((t) => (t.id === id ? fn(t) : t)),
});

export function reducer(s: AskState, a: Action): AskState {
  switch (a.type) {
    case 'smart/loading':
      return s.smart === 'ready' ? s : { ...s, smart: 'loading' };
    case 'smart/ready':
      return { ...s, smart: 'ready' };
    case 'smart/error':
      return { ...s, smart: 'error' };
    case 'ask':
      return {
        ...s,
        turns: [
          ...s.turns,
          { id: a.id, question: a.question, state: 'pending' as const, streaming: '' },
        ].slice(-MAX_TURNS),
      };
    case 'stream':
      return updateTurn(s, a.id, (t) =>
        t.state === 'pending' || t.state === 'streaming'
          ? { ...t, state: 'streaming', streaming: t.streaming + a.token }
          : t,
      );
    case 'stream/reset':
      return updateTurn(s, a.id, (t) => ({ ...t, streaming: '' }));
    case 'answer':
      return updateTurn(s, a.id, (t) =>
        t.state === 'cancelled' ? t : { ...t, state: 'done', streaming: '', answer: a.answer },
      );
    case 'cancelled':
      return updateTurn(s, a.id, (t) =>
        t.state === 'done' ? t : { ...t, state: 'cancelled', streaming: '' },
      );
    case 'turn/error':
      return updateTurn(s, a.id, (t) => ({
        ...t,
        state: a.answer ? 'done' : 'error',
        streaming: '',
        answer: a.answer,
      }));
    case 'local/check':
      return { ...s, local: 'capability-check', localError: null, unavailable: null };
    case 'local/unavailable':
      return { ...s, local: 'unavailable', unavailable: a.reason, mode: 'smart' };
    case 'local/consent':
      return { ...s, local: 'consent', cache: a.cache, localError: null };
    case 'local/progress':
      return {
        ...s,
        local: a.progress.stage === 'download' ? 'downloading' : 'initializing',
        progress: a.progress,
      };
    case 'local/ready':
      return {
        ...s,
        local: 'ready',
        mode: 'local',
        progress: null,
        localError: null,
        switching: false,
        cache: 'complete',
      };
    case 'local/generating':
      return { ...s, local: 'generating' };
    case 'local/idle':
      return s.local === 'generating' ? { ...s, local: 'ready' } : s;
    case 'local/error':
      return {
        ...s,
        local: 'error',
        mode: 'smart',
        progress: null,
        localError: { code: a.code, message: a.message },
      };
    case 'local/pressure':
      return {
        ...s,
        local: 'resource-pressure',
        mode: 'smart',
        progress: null,
        localError: { code: 'resource-pressure', message: a.message },
      };
    case 'local/offline':
      return { ...s, local: 'offline-without-model', mode: 'smart', progress: null };
    case 'local/cache':
      return { ...s, cache: a.cache };
    case 'mode/switching':
      return { ...s, switching: true };
    case 'mode/smart':
      return { ...s, mode: 'smart', local: 'off', progress: null, switching: false, localError: null };
    case 'clear':
      return { ...s, turns: [] };
  }
}

/** The single named UI state of the spec, derived (never stored twice). */
export function uiState(s: AskState): UiState {
  if (s.switching) return 'switching-mode';
  switch (s.local) {
    case 'capability-check':
      return 'capability-check';
    case 'unavailable':
      return 'local-unavailable';
    case 'consent':
      return 'local-consent';
    case 'downloading':
      return 'model-downloading';
    case 'initializing':
      return 'model-initializing';
    case 'generating':
      return 'local-generating';
    case 'error':
      return 'local-error';
    case 'resource-pressure':
      return 'resource-pressure';
    case 'offline-without-model':
      return 'offline-without-model';
    case 'ready': {
      const last = s.turns.at(-1);
      if (last?.state === 'cancelled') return 'local-cancelled';
      if (last?.answer?.mode === 'local') return 'local-answer';
      return 'local-ready';
    }
    case 'off':
      break;
  }
  const last = s.turns.at(-1);
  if (!last) return 'smart-ready';
  if (last.state === 'pending' || last.state === 'streaming') return 'smart-searching';
  if (last.answer && (last.answer.status === 'insufficient-evidence' || last.answer.status === 'refused'))
    return 'smart-no-match';
  return last.answer ? 'smart-answer' : 'smart-ready';
}

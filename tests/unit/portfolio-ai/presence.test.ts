import { beforeEach, describe, expect, it } from 'vitest';
import { content, getProjects } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';
import { SmartEngine } from '@/lib/portfolio-ai/smart/engine';
import {
  HERO_SUGGESTIONS,
  HOME_SUGGESTIONS,
  buildSuggestionMap,
  suggestionsFor,
} from '@/components/ask-ai/suggestions';
import { presenceOf } from '@/components/ask-ai/presence';
import { initialState, reducer, type AskState } from '@/components/ask-ai/state';
import { useAssistant } from '@/state/assistant-store';
import { isAssistantShortcut, isTypingTarget, shortcutAria } from '@/components/assistant/focus';

const engine = new SmartEngine(compileKnowledge(content).manifest);
const map = buildSuggestionMap(getProjects().map((p) => ({ slug: p.slug, title: p.title })));

describe('context-aware suggestions (AI Presence V1)', () => {
  const all = [...new Set([...HERO_SUGGESTIONS, ...Object.values(map).flat()])];

  it.each(all)('"%s" is answered from approved knowledge, with a source', (q) => {
    const a = engine.answer(q, []);
    expect(['answered', 'partial']).toContain(a.status);
    expect(a.evidence.length).toBeGreaterThan(0);
  });

  it('covers every route, including one entry per case study', () => {
    for (const p of getProjects()) expect(map[`/projects/${p.slug}`]?.[0]).toBe(`Tell me about ${p.title}`);
    for (const route of ['/', '/projects', '/about', '/contact', '/resume'])
      expect(map[route]?.length).toBeGreaterThan(2);
  });

  it('falls back to the home suggestions and ignores a trailing slash', () => {
    expect(suggestionsFor(map, '/about/')).toEqual(map['/about']);
    expect(suggestionsFor(map, '/unknown')).toEqual(HOME_SUGGESTIONS);
    expect(suggestionsFor(undefined, null)).toEqual(HOME_SUGGESTIONS);
  });
});

describe('presenceOf — the orb status derived from the panel state', () => {
  const run = (...actions: Parameters<typeof reducer>[1][]) =>
    actions.reduce<AskState>((s, a) => reducer(s, a), initialState);
  const answer = {
    mode: 'smart' as const,
    text: 'x',
    status: 'answered' as const,
    evidence: [],
    links: [],
    language: 'en' as const,
  };

  it('idle before anything loads, ready once Smart Mode is ready', () => {
    expect(presenceOf(initialState).phase).toBe('idle');
    expect(presenceOf(run({ type: 'smart/loading' })).phase).toBe('retrieving');
    expect(presenceOf(run({ type: 'smart/ready' })).phase).toBe('ready');
  });

  it('retrieving while a turn is pending, complete after the answer, fallback with a notice', () => {
    const base: Parameters<typeof reducer>[1][] = [
      { type: 'smart/ready' },
      { type: 'ask', id: 1, question: 'q' },
    ];
    expect(presenceOf(run(...base)).phase).toBe('retrieving');
    expect(presenceOf(run(...base, { type: 'answer', id: 1, answer })).phase).toBe('complete');
    expect(
      presenceOf(
        run(...base, { type: 'answer', id: 1, answer: { ...answer, notice: 'Smart Mode answered' } }),
      ).phase,
    ).toBe('fallback');
  });

  it('model work wins: download progress (rounded to 1 %), initializing, generating', () => {
    const dl = run({ type: 'local/progress', progress: { stage: 'download', progress: 0.4237, text: '' } });
    expect(presenceOf(dl)).toEqual({ phase: 'downloading', progress: 0.42 });
    const init = run({ type: 'local/progress', progress: { stage: 'load', progress: 0.9, text: '' } });
    expect(presenceOf(init).phase).toBe('initializing');
    expect(presenceOf(run({ type: 'local/ready' }, { type: 'local/generating' })).phase).toBe('generating');
  });

  it('a stream token keeps the phase generating (no per-token phase changes)', () => {
    const s = run(
      { type: 'smart/ready' },
      { type: 'ask', id: 1, question: 'q' },
      { type: 'stream', id: 1, token: 'a' },
    );
    expect(presenceOf(s).phase).toBe('generating');
    expect(presenceOf(reducer(s, { type: 'stream', id: 1, token: 'b' })).phase).toBe('generating');
  });

  it('errors are surfaced quietly (index failure, local error, resource pressure)', () => {
    expect(presenceOf(run({ type: 'smart/error' })).phase).toBe('error');
    expect(presenceOf(run({ type: 'local/error', code: 'x', message: 'm' })).phase).toBe('error');
    expect(presenceOf(run({ type: 'local/pressure', message: 'm' })).phase).toBe('error');
  });
});

describe('assistant store — shared session coordination', () => {
  beforeEach(() =>
    useAssistant.setState({ open: false, shown: false, requested: false, pending: null, opener: null }),
  );

  it('opening requests the UI module and queues a question with a fresh id', () => {
    const s = useAssistant.getState();
    s.openAssistant({ question: '  What does Islam build?  ' });
    const st = useAssistant.getState();
    expect(st.open).toBe(true);
    expect(st.requested).toBe(true);
    expect(st.pending?.text).toBe('What does Islam build?');
  });

  it('a queued question is taken exactly once, and a stale id never takes a newer question', () => {
    const s = useAssistant.getState();
    s.openAssistant({ question: 'first' });
    const first = useAssistant.getState().pending!.id;
    s.openAssistant({ question: 'second' });
    expect(useAssistant.getState().takePending(first)).toBeNull();
    const second = useAssistant.getState().pending!.id;
    expect(useAssistant.getState().takePending(second)).toBe('second');
    expect(useAssistant.getState().takePending(second)).toBeNull();
  });

  it('opening without a question keeps any queued one and the existing opener', () => {
    const opener = document.createElement('button');
    useAssistant.getState().openAssistant({ question: 'q', opener });
    useAssistant.getState().openAssistant();
    expect(useAssistant.getState().pending?.text).toBe('q');
    expect(useAssistant.getState().opener).toBe(opener);
  });

  it('a reopen during the exit animation keeps the original opener; a fresh open forgets it', () => {
    const opener = document.createElement('button');
    useAssistant.getState().openAssistant({ opener });
    useAssistant.setState({ open: false, shown: true }); // closing: still on screen
    useAssistant.getState().openAssistant({ opener: null });
    expect(useAssistant.getState().opener).toBe(opener);
    useAssistant.setState({ open: false, shown: false }); // fully closed
    useAssistant.getState().openAssistant({ opener: null });
    expect(useAssistant.getState().opener).toBeNull();
  });

  it('presence updates only when the phase or progress changes', () => {
    const before = useAssistant.getState().presence;
    useAssistant.getState().setPresence({ ...before });
    expect(useAssistant.getState().presence).toBe(before);
    useAssistant.getState().setPresence({ phase: 'generating', progress: null });
    expect(useAssistant.getState().presence.phase).toBe('generating');
  });
});

describe('global shortcut — Ctrl+K on Windows/Linux, ⌘K on macOS, never while typing', () => {
  const key = (over: Partial<KeyboardEvent>) =>
    ({
      key: 'k',
      code: 'KeyK',
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ...over,
    }) as KeyboardEvent;

  it('matches only the platform’s own chord', () => {
    expect(isAssistantShortcut(key({ ctrlKey: true }), false)).toBe(true);
    expect(isAssistantShortcut(key({ metaKey: true }), true)).toBe(true);
    // On a Mac, Ctrl+K deletes to the end of the line in text fields: never taken.
    expect(isAssistantShortcut(key({ ctrlKey: true }), true)).toBe(false);
    expect(isAssistantShortcut(key({ metaKey: true }), false)).toBe(false);
    expect(isAssistantShortcut(key({}), false)).toBe(false);
  });

  it('ignores Alt/Shift variants and other keys; works with a non-Latin layout', () => {
    expect(isAssistantShortcut(key({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isAssistantShortcut(key({ ctrlKey: true, altKey: true }), false)).toBe(false);
    expect(isAssistantShortcut(key({ ctrlKey: true, key: 'j', code: 'KeyJ' }), false)).toBe(false);
    // Arabic layout: the K key types "ن".
    expect(isAssistantShortcut(key({ ctrlKey: true, key: 'ن', code: 'KeyK' }), false)).toBe(true);
  });

  it('treats text fields as typing targets, but not buttons, checkboxes or sliders', () => {
    const el = (html: string) => {
      const box = document.createElement('div');
      box.innerHTML = html;
      return box.firstElementChild;
    };
    expect(isTypingTarget(el('<input>'))).toBe(true);
    expect(isTypingTarget(el('<input type="search">'))).toBe(true);
    expect(isTypingTarget(el('<textarea></textarea>'))).toBe(true);
    expect(isTypingTarget(el('<input type="checkbox">'))).toBe(false);
    expect(isTypingTarget(el('<input type="range">'))).toBe(false);
    expect(isTypingTarget(el('<button>x</button>'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('announces the platform’s chord to assistive technology', () => {
    expect(shortcutAria('⌘K')).toBe('Meta+K');
    expect(shortcutAria('Ctrl K')).toBe('Control+K');
  });
});

'use client';

import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react';
import type { SmartEngine } from '@/lib/portfolio-ai/smart/engine';
import type { LocalAiClient } from '@/lib/portfolio-ai/local/client';
import type { ModelEntry } from '@/lib/portfolio-ai/local/catalog';
import type { CapabilityResult } from '@/lib/portfolio-ai/local/capability';
import type { TabLock } from '@/lib/portfolio-ai/local/tab-lock';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { useExperience } from '@/state/experience-store';
import { AnswerCard } from './AnswerCard';
import { LocalAiCard } from './LocalAiCard';
import { DEFAULT_SUGGESTIONS, FALLBACK_NOTICE, LOCAL, UI } from './copy';
import { outcomeDisplay, safeHistory, smartDisplay } from './display';
import { initialState, reducer, uiState, type AskState } from './state';
import styles from './AskAiPanel.module.css';

/** Arabic Local AI output cannot be verified against the English corpus yet (MODEL-EVALUATION.md). */
const LOCAL_ARABIC = false;

declare global {
  interface Window {
    /** Present only with ?pie-eval=1: raw Local AI attempts for the evaluation harness. */
    __PIE_EVAL__?: unknown[];
    /** Present only with ?pie-eval=1: the loaded Smart engine, for in-browser latency benchmarks. */
    __PIE_SMART__?: unknown;
  }
}

const evalHook = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pie-eval')
    ? window
    : null;
/** Evaluation-only overrides (?pie-eval=1&pie-model=<catalog id>&pie-ar=1); ignored otherwise. */
const evalParam = (name: string) =>
  evalHook() ? new URLSearchParams(window.location.search).get(name) : null;
const MAX_INPUT = 500;

/** User Timing marks for the benchmark (local only; never reported anywhere). */
const mark = (name: string, measure?: [string, string]) => {
  try {
    if (measure) performance.measure(name, measure[0], measure[1]);
    else performance.mark(name);
  } catch {
    // User Timing unavailable: measurements are optional.
  }
};

interface LocalRuntime {
  client: LocalAiClient;
  entry: ModelEntry;
  capability: Extract<CapabilityResult, { ok: true }> | null;
  /** Web Lock: one local model per browser profile. */
  lock: TabLock;
}

/**
 * Ask My AI — one assistant, two engines (PIE spec §0). Smart Mode is the default and loads
 * lazily (index + manifest only when the section nears the viewport or the visitor interacts).
 * Local AI is opt-in: capability check → consent → download/initialize in a worker → streamed,
 * verified answers, with Smart Mode always available. Nothing typed leaves the browser.
 */
export function AskAiPanel({ manifestVersion }: { manifestVersion: string }) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef<AskState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [draft, setDraft] = useState('');
  const [localInfo, setLocalInfo] = useState<Pick<LocalRuntime, 'entry' | 'capability'> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const reducedMotion = useExperience((s) => s.reducedMotion);
  const smartRef = useRef<SmartEngine | null>(null);
  const smartLoading = useRef<Promise<SmartEngine | null> | null>(null);
  const localRef = useRef<LocalRuntime | null>(null);
  const turnSeq = useRef(0);
  const busy = useRef(false);
  const checking = useRef(false);

  const announce = useCallback((text: string) => {
    // Re-set so identical consecutive messages are still announced.
    setAnnouncement('');
    window.setTimeout(() => setAnnouncement(text), 30);
  }, []);

  const hold = useCallback((on: boolean) => useExperience.getState().setAiRenderHold(on), []);

  // ── Smart Mode: lazy index ──
  const loadSmart = useCallback((): Promise<SmartEngine | null> => {
    if (smartRef.current) return Promise.resolve(smartRef.current);
    if (smartLoading.current) return smartLoading.current;
    dispatch({ type: 'smart/loading' });
    mark('pie:smart-start');
    smartLoading.current = (async () => {
      try {
        const [{ SmartEngine: Engine }, { loadManifest }] = await Promise.all([
          import('@/lib/portfolio-ai/smart/engine'),
          import('@/lib/portfolio-ai/shared/manifest'),
        ]);
        const manifest = await loadManifest(manifestVersion);
        mark('pie:smart-fetched');
        const engine = new Engine(manifest);
        mark('pie:smart-ready');
        mark('pie:smart-index', ['pie:smart-fetched', 'pie:smart-ready']);
        mark('pie:smart-total', ['pie:smart-start', 'pie:smart-ready']);
        smartRef.current = engine;
        const w = evalHook();
        if (w) w.__PIE_SMART__ = engine;
        dispatch({ type: 'smart/ready' });
        return engine;
      } catch {
        smartLoading.current = null;
        dispatch({ type: 'smart/error' });
        return null;
      }
    })();
    return smartLoading.current;
  }, [manifestVersion]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void loadSmart();
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadSmart]);

  // ── Local AI lifecycle ──
  const disposeLocal = useCallback(async () => {
    const runtime = localRef.current;
    localRef.current = null;
    hold(false);
    if (runtime) {
      await runtime.client.dispose();
      runtime.lock.release();
    }
  }, [hold]);

  useEffect(() => {
    const onPageHide = () => void disposeLocal();
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      void disposeLocal();
    };
  }, [disposeLocal]);

  const startLocal = useCallback(
    async (cached = stateRef.current.cache === 'complete') => {
      const runtime = localRef.current;
      if (!runtime) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false && !cached) {
        dispatch({ type: 'local/offline' });
        return;
      }
      dispatch({
        type: 'local/progress',
        progress: { stage: cached ? 'load' : 'download', progress: 0, text: '' },
      });
      try {
        await runtime.client.init(runtime.entry.id, (p) => {
          hold(p.stage !== 'download');
          dispatch({ type: 'local/progress', progress: p });
        });
        hold(false);
        dispatch({ type: 'local/ready' });
        announce(LOCAL.ready(runtime.entry.label));
        inputRef.current?.focus({ preventScroll: true });
      } catch (error) {
        hold(false);
        const code = (error as { code?: string }).code ?? 'unknown';
        if (localRef.current !== runtime) return; // cancelled by the visitor
        await disposeLocal();
        const message = LOCAL.errors[code] ?? LOCAL.errors.unknown!;
        if (code === 'out-of-memory' || code === 'device-lost')
          dispatch({ type: 'local/pressure', message: LOCAL.pressure });
        else dispatch({ type: 'local/error', code, message });
        announce(message);
      }
    },
    [announce, disposeLocal, hold],
  );

  const tryLocal = useCallback(async () => {
    // One setup at a time (a double click must not look like "another tab").
    if (localRef.current || checking.current) return;
    checking.current = true;
    dispatch({ type: 'local/check' });
    announce(LOCAL.checking);
    try {
      const [
        { checkCapability },
        { modelEntry, MODEL_CHOICES, LITE_MODEL_ID, preselectModel },
        { modelCacheState },
        { LocalAiClient: Client },
        { acquireTabLock },
      ] = await Promise.all([
        import('@/lib/portfolio-ai/local/capability'),
        import('@/lib/portfolio-ai/local/catalog'),
        import('@/lib/portfolio-ai/local/cache'),
        import('@/lib/portfolio-ai/local/client'),
        import('@/lib/portfolio-ai/local/tab-lock'),
      ]);
      const forced = evalParam('pie-model');
      let entry: ModelEntry | null = forced ? modelEntry(forced) : null;
      // A model downloaded earlier (consent given for that exact revision) is reused without asking again.
      if (!entry) {
        for (const id of MODEL_CHOICES) {
          const candidate = modelEntry(id);
          if ((await modelCacheState(candidate)) === 'complete') {
            entry = candidate;
            break;
          }
        }
      }
      const capability = await checkCapability(entry ?? modelEntry(LITE_MODEL_ID));
      if (!capability.ok) {
        const reason = LOCAL.unavailable[capability.reason] ?? LOCAL.unavailable['no-webgpu']!;
        dispatch({ type: 'local/unavailable', reason });
        announce(reason);
        return;
      }
      if (!entry) {
        const { quota, usage } = capability.storage;
        entry = modelEntry(
          preselectModel({
            saveData: capability.saveData,
            deviceMemoryGB: capability.deviceMemoryGB,
            coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
            freeBytes: quota !== undefined ? quota - (usage ?? 0) : undefined,
          }),
        );
      }
      const cache = await modelCacheState(entry);
      const lock = await acquireTabLock();
      if (!lock) {
        dispatch({ type: 'local/unavailable', reason: LOCAL.unavailable['other-tab']! });
        announce(LOCAL.unavailable['other-tab']!);
        return;
      }
      localRef.current = { client: new Client(), entry, capability, lock };
      setLocalInfo({ entry, capability });
      if (cache === 'complete') {
        // Consent was given for this exact revision before; nothing to download.
        dispatch({ type: 'local/cache', cache });
        void startLocal(true);
      } else {
        dispatch({ type: 'local/consent', cache });
      }
    } catch {
      dispatch({ type: 'local/unavailable', reason: LOCAL.unavailable['no-webgpu']! });
    } finally {
      checking.current = false;
    }
  }, [announce, startLocal]);

  const selectModel = useCallback(async (id: string) => {
    const runtime = localRef.current;
    if (!runtime || runtime.entry.id === id) return;
    const [{ modelEntry }, { modelCacheState }] = await Promise.all([
      import('@/lib/portfolio-ai/local/catalog'),
      import('@/lib/portfolio-ai/local/cache'),
    ]);
    const entry = modelEntry(id);
    runtime.entry = entry;
    setLocalInfo((info) => (info ? { ...info, entry } : info));
    dispatch({ type: 'local/consent', cache: await modelCacheState(entry) });
  }, []);

  const cancelLocalSetup = useCallback(async () => {
    const entryId = localRef.current?.entry.id;
    await disposeLocal();
    const { modelEntry } = await import('@/lib/portfolio-ai/local/catalog');
    const { modelCacheState } = await import('@/lib/portfolio-ai/local/cache');
    const cache = await modelCacheState(modelEntry(entryId));
    dispatch({ type: 'mode/smart' });
    dispatch({ type: 'local/cache', cache });
  }, [disposeLocal]);

  const backToSmart = useCallback(async () => {
    dispatch({ type: 'mode/switching' });
    await disposeLocal();
    dispatch({ type: 'mode/smart' });
    announce(`${UI.smartTitle} — ${UI.smartSubtitle}`);
  }, [announce, disposeLocal]);

  const clearModel = useCallback(async () => {
    const [{ modelEntry }, { clearModelCache }] = await Promise.all([
      import('@/lib/portfolio-ai/local/catalog'),
      import('@/lib/portfolio-ai/local/cache'),
    ]);
    const entryId = localRef.current?.entry.id ?? evalParam('pie-model') ?? undefined;
    await disposeLocal();
    await clearModelCache(modelEntry(entryId));
    dispatch({ type: 'mode/smart' });
    dispatch({ type: 'local/cache', cache: 'absent' });
    announce(LOCAL.cacheCleared);
  }, [announce, disposeLocal]);

  // ── Asking ──
  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim().slice(0, MAX_INPUT);
      if (!question || busy.current) return;
      busy.current = true;
      const id = ++turnSeq.current;
      const history = safeHistory(stateRef.current.turns);
      dispatch({ type: 'ask', id, question });
      setDraft('');
      try {
        const engine = await loadSmart();
        if (!engine) {
          dispatch({ type: 'turn/error', id });
          setDraft(question);
          announce(UI.indexError);
          return;
        }
        const runtime = localRef.current;
        if (stateRef.current.mode === 'local' && runtime?.client.loadedModel) {
          dispatch({ type: 'local/generating' });
          hold(true);
          try {
            const { runLocalTurn } = await import('@/lib/portfolio-ai/local/orchestrate');
            const outcome = await runLocalTurn(
              engine,
              runtime.client,
              question,
              history,
              (token) => dispatch({ type: 'stream', id, token }),
              () => {
                dispatch({ type: 'stream/reset', id });
                announce(UI.retrying);
              },
              {
                generateArabic: LOCAL_ARABIC || evalParam('pie-ar') === '1',
                onAttempt: (record) => {
                  const w = evalHook();
                  if (w) (w.__PIE_EVAL__ ??= []).push({ question, ...record });
                },
              },
            );
            const display = outcomeDisplay(outcome);
            if (!display) {
              dispatch({ type: 'cancelled', id });
              setDraft(question);
              announce(UI.cancelled);
            } else {
              dispatch({ type: 'answer', id, answer: display });
              useExperience.getState().signalAssistant();
              announce(
                `${display.mode === 'local' ? UI.localLabel : UI.smartLabel}: ${display.evidence.length} source(s).`,
              );
            }
          } catch (error) {
            const code = (error as { code?: string }).code ?? 'unknown';
            const smart = engine.answer(question, history);
            dispatch({
              type: 'turn/error',
              id,
              answer: smartDisplay(smart, FALLBACK_NOTICE.error[smart.language]),
            });
            await disposeLocal();
            if (code === 'out-of-memory' || code === 'device-lost')
              dispatch({ type: 'local/pressure', message: LOCAL.pressure });
            else
              dispatch({ type: 'local/error', code, message: LOCAL.errors[code] ?? LOCAL.errors.unknown! });
            announce(LOCAL.errors[code] ?? LOCAL.errors.unknown!);
          } finally {
            hold(false);
            dispatch({ type: 'local/idle' });
          }
        } else {
          const a = engine.answer(question, history);
          dispatch({ type: 'answer', id, answer: smartDisplay(a) });
          useExperience.getState().signalAssistant();
          announce(`${UI.smartLabel}: ${a.evidence.length} source(s).`);
        }
      } finally {
        busy.current = false;
      }
    },
    [announce, disposeLocal, hold, loadSmart],
  );

  const stop = useCallback(() => {
    localRef.current?.client.cancel();
  }, []);

  const ui = uiState(state);
  const generating = state.local === 'generating';
  const localActive = state.mode === 'local';
  const last = state.turns.at(-1);
  const suggestions = last?.answer?.suggestedQuestions?.length
    ? last.answer.suggestedQuestions
    : DEFAULT_SUGGESTIONS;
  const offerLocal =
    state.local === 'off' ||
    state.local === 'unavailable' ||
    state.local === 'error' ||
    state.local === 'resource-pressure' ||
    state.local === 'offline-without-model';

  return (
    <div
      ref={rootRef}
      className={`${styles.panel} glass glass--panel glass--mint`}
      data-testid="ask-ai-panel"
      data-state={ui}
      data-mode={state.mode}
      data-local={state.local}
      data-smart={state.smart}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      onPointerEnter={() => void loadSmart()}
      onFocusCapture={() => void loadSmart()}
    >
      <div className={styles.modeBar}>
        <p className={styles.modeTitle} data-testid="ask-ai-mode">
          <StatusTag tone={localActive ? 'concept' : 'verified'}>
            {localActive ? UI.localTitle : UI.smartTitle}
          </StatusTag>{' '}
          <span>— {localActive ? UI.localSubtitle : UI.smartSubtitle}</span>
        </p>
        {localActive ? (
          <button
            type="button"
            className={`${styles.ghost} glass glass--chip glass--cyan`}
            onClick={() => void backToSmart()}
            data-action="back-to-smart"
          >
            {UI.backToSmart}
          </button>
        ) : offerLocal ? (
          <button
            type="button"
            className={`${styles.ghost} glass glass--chip glass--cyan`}
            onClick={() => void tryLocal()}
            data-action="try-local"
          >
            {UI.tryLocal}
          </button>
        ) : null}
      </div>
      <p className={styles.notice}>{UI.notice}</p>

      <LocalAiCard
        state={state}
        entry={localInfo?.entry ?? null}
        capability={localInfo?.capability ?? null}
        onAccept={() => void startLocal()}
        onDecline={() => void cancelLocalSetup()}
        onCancel={() => void cancelLocalSetup()}
        onRetry={() => void tryLocal()}
        onBack={() => void backToSmart()}
        onClear={() => void clearModel()}
        onSelectModel={(id) => void selectModel(id)}
      />

      <form
        className={`${styles.form} glass glass--inset`}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <label htmlFor={`${uid}-q`} className="sr-only">
          {UI.inputLabel}
        </label>
        <Icon name="sparkle" size={18} className={styles.spark} />
        <input
          ref={inputRef}
          id={`${uid}-q`}
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={localActive ? UI.placeholderLocal : UI.placeholder}
          maxLength={MAX_INPUT}
          autoComplete="off"
          enterKeyHint="send"
          dir="auto"
        />
        {generating ? (
          <button
            type="button"
            className={styles.send}
            onClick={stop}
            aria-label={UI.stop}
            data-action="stop"
          >
            <Icon name="close" size={18} />
          </button>
        ) : (
          <button type="submit" className={styles.send} aria-label={UI.send} disabled={!draft.trim()}>
            <Icon name="arrow-right" size={18} />
          </button>
        )}
      </form>

      <ul className={styles.prompts} aria-label={UI.suggestions}>
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              className={`${styles.prompt} glass glass--chip`}
              onClick={() => void ask(s)}
              data-action="assistant-prompt"
              disabled={generating}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.output} aria-busy={generating || last?.state === 'pending'}>
        {state.turns.length === 0 ? (
          <p className={styles.empty}>{state.smart === 'error' ? UI.indexError : UI.empty}</p>
        ) : (
          <div className={styles.conversation} data-testid="ask-ai-conversation">
            {state.turns.map((t) => (
              <AnswerCard key={t.id} turn={t} reducedMotion={reducedMotion} />
            ))}
          </div>
        )}
        {state.turns.length > 0 ? (
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => dispatch({ type: 'clear' })}
              disabled={generating}
              data-action="clear"
            >
              {UI.clear}
            </button>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite" data-testid="ask-ai-live">
        {announcement}
      </p>
    </div>
  );
}

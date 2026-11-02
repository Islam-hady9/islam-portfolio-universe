'use client';

import type { ModelEntry } from '@/lib/portfolio-ai/local/catalog';
import { MODEL_CATALOG, MODEL_CHOICES } from '@/lib/portfolio-ai/local/catalog';
import type { CapabilityResult } from '@/lib/portfolio-ai/local/capability';
import type { AskState } from './state';
import { LOCAL, UI } from './copy';
import styles from './AskAiPanel.module.css';

const mb = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/**
 * The Local AI sub-panel: capability check, disclosure + consent, progress with cancel, ready /
 * error / unavailable states (spec §3 "Local AI opt-in"). Renders nothing while Local AI is off.
 */
export function LocalAiCard({
  state,
  entry,
  capability,
  onAccept,
  onDecline,
  onCancel,
  onRetry,
  onBack,
  onClear,
  onSelectModel,
}: {
  state: AskState;
  entry: ModelEntry | null;
  capability: Extract<CapabilityResult, { ok: true }> | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
  onClear: () => void;
  onSelectModel: (id: string) => void;
}) {
  const s = state.local;
  if (s === 'off') return null;

  if (s === 'capability-check') {
    return (
      <section className={styles.localCard} aria-label="Local AI" data-testid="local-ai-card">
        <p>{LOCAL.checking}</p>
      </section>
    );
  }

  if (s === 'unavailable' || s === 'offline-without-model' || s === 'error' || s === 'resource-pressure') {
    const text =
      s === 'unavailable'
        ? state.unavailable
        : s === 'offline-without-model'
          ? LOCAL.offline
          : state.localError?.message;
    return (
      <section className={styles.localCard} aria-label="Local AI" data-testid="local-ai-card" role="status">
        <p>{text}</p>
        <div className={styles.actions}>
          {s === 'error' || s === 'offline-without-model' ? (
            <button type="button" className={styles.ghost} onClick={onRetry} data-action="local-retry">
              {LOCAL.retry}
            </button>
          ) : null}
          <button type="button" className={styles.ghost} onClick={onBack} data-action="local-dismiss">
            {UI.backToSmart}
          </button>
        </div>
      </section>
    );
  }

  if (!entry) return null;

  if (s === 'consent') {
    // Storage is checked against the selected model (advisory estimate; unknown → no warning).
    const { quota, usage } = capability?.storage ?? {};
    const noSpace = quota !== undefined && quota - (usage ?? 0) < entry.storageBytes * 1.1;
    const cached = state.cache === 'complete';
    return (
      <section
        className={styles.localCard}
        aria-labelledby="local-consent-title"
        data-testid="local-ai-consent"
      >
        <h3 id="local-consent-title">{LOCAL.consentTitle}</h3>
        <fieldset className={styles.models}>
          <legend className="sr-only">{LOCAL.chooseModel}</legend>
          {MODEL_CHOICES.map((id) => {
            const m = MODEL_CATALOG[id]!;
            return (
              <label key={id} className={styles.model} data-selected={m.id === entry.id ? 'true' : undefined}>
                <input
                  type="radio"
                  name="pie-model"
                  value={id}
                  checked={m.id === entry.id}
                  onChange={() => onSelectModel(id)}
                />
                <span>
                  <strong>
                    {m.label} · {mb(m.downloadBytes)}
                  </strong>
                  <span className={styles.modelSummary}>{m.summary}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <ul>
          {cached ? (
            <li>{LOCAL.consentCached}</li>
          ) : (
            <li>{LOCAL.consentDownload(mb(entry.downloadBytes), entry.label, entry.license.name)}</li>
          )}
          {state.cache === 'partial' ? <li>{LOCAL.consentPartial}</li> : null}
          <li>{LOCAL.consentStorage(mb(entry.storageBytes))}</li>
          <li>{LOCAL.consentGpu}</li>
          <li>{LOCAL.consentPrivacy}</li>
          <li>{LOCAL.consentOptional}</li>
        </ul>
        {capability?.saveData ? <p className={styles.warn}>{LOCAL.saveData}</p> : null}
        {noSpace ? <p className={styles.warn}>{LOCAL.noSpace}</p> : null}
        <p className={styles.meta}>
          {entry.label} · {entry.quantization} · rev {entry.revision.slice(0, 7)} ·{' '}
          <a href={entry.license.url} target="_blank" rel="noopener noreferrer">
            {entry.license.name} license
          </a>
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.ghost} ${styles.primary}`}
            onClick={onAccept}
            disabled={noSpace}
            data-action="local-accept"
          >
            {cached ? LOCAL.acceptCached : LOCAL.accept}
          </button>
          <button type="button" className={styles.ghost} onClick={onDecline} data-action="local-decline">
            {LOCAL.decline}
          </button>
          {state.cache === 'partial' ? (
            <button type="button" className={styles.textButton} onClick={onClear} data-action="local-clear">
              {LOCAL.clearCache}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (s === 'downloading' || s === 'initializing') {
    const p = state.progress;
    const label =
      s === 'downloading' ? LOCAL.downloading : p?.stage === 'compile' ? LOCAL.compiling : LOCAL.initializing;
    const pct = Math.round((p?.progress ?? 0) * 100);
    const shards = p?.completed && p.total ? ` (${p.completed}/${p.total})` : '';
    return (
      <section className={styles.localCard} aria-label="Local AI" data-testid="local-ai-progress">
        <p>
          {label}
          {shards}… {pct}%
        </p>
        <progress
          className={styles.meter}
          max={100}
          value={pct}
          aria-label={label}
          aria-valuetext={`${label}: ${pct}%`}
        />
        <p className={styles.meta}>{UI.pausedNote}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onCancel} data-action="local-cancel">
            {LOCAL.cancel}
          </button>
        </div>
      </section>
    );
  }

  // ready / generating
  return (
    <section className={styles.localCard} aria-label="Local AI" data-testid="local-ai-ready">
      <p>{LOCAL.ready(entry.label)}</p>
      <p className={styles.meta}>{UI.pausedNote}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.textButton}
          onClick={onClear}
          disabled={s === 'generating'}
          data-action="local-clear"
        >
          {LOCAL.clearCache}
        </button>
      </div>
    </section>
  );
}

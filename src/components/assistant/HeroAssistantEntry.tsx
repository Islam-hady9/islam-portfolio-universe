'use client';

import type { MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAssistant } from '@/state/assistant-store';
import { shortcutAria, useShortcutLabel } from './focus';
import styles from './HeroAssistantEntry.module.css';

/**
 * Hero AI discovery (AI Presence V1): a compact entry under the hero actions that opens the
 * global assistant, optionally asking one of the grounded suggestions. It never loads the
 * assistant up front — hovering or focusing it prefetches the UI module, nothing more.
 */
export function HeroAssistantEntry({ suggestions }: { suggestions: string[] }) {
  const hint = useShortcutLabel();
  const prefetch = () => useAssistant.getState().request();
  const open = (question?: string) => (e: MouseEvent<HTMLButtonElement>) =>
    useAssistant.getState().openAssistant({ question, opener: e.currentTarget });

  return (
    <div className={`${styles.entry} glass glass--flat glass--mint`} data-testid="hero-ai-entry">
      <div className={styles.row}>
        <span className={styles.glyph} aria-hidden="true" />
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Meet my intelligence</p>
          <p className={styles.title}>Curious about what I build?</p>
        </div>
        <button
          type="button"
          className={styles.primary}
          aria-haspopup="dialog"
          aria-keyshortcuts={shortcutAria(hint)}
          data-action="hero-ask-ai"
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onClick={open()}
        >
          <Icon name="sparkle" size={16} />
          <span>Ask Islam’s AI</span>
          <kbd className={styles.kbd} aria-hidden="true">
            {hint}
          </kbd>
        </button>
      </div>
      <ul className={styles.chips} aria-label="Ask the assistant">
        {suggestions.map((q) => (
          <li key={q}>
            <button
              type="button"
              className={`${styles.chip} glass glass--chip`}
              aria-haspopup="dialog"
              data-action="hero-ai-suggestion"
              onPointerEnter={prefetch}
              onFocus={prefetch}
              onClick={open(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

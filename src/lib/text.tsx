import type { ReactNode } from 'react';

/**
 * Wraps each occurrence of the given phrases in <span className>. Used for the identity
 * statement's restrained mint highlights (spec S2) so the phrases stay data-driven.
 */
export function highlightPhrases(text: string, phrases: string[], className: string): ReactNode[] {
  if (!phrases.length) return [text];
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'g');
  return text.split(re).map((part, i) =>
    phrases.includes(part) ? (
      <span key={i} className={className}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

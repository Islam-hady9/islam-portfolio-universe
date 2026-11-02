'use client';

import { useLayoutEffect, useRef } from 'react';
import { useAssistant } from '@/state/assistant-store';
import styles from './AssistantSlot.module.css';

/**
 * The Ask My AI section's place for the shared assistant (AI Presence V1). The one AskAiPanel
 * instance is shown here whenever the drawer is closed, so the section keeps its original
 * panel and continues the same conversation as the drawer and the hero. The panel module is
 * requested when the section comes within ~1200 px; until then the space is reserved.
 */
export function AssistantSlot() {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const shown = useAssistant((s) => s.shown);

  useLayoutEffect(() => {
    const el = hostRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    useAssistant.getState().setSlot('section', el);
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) {
                useAssistant.getState().request();
                io?.disconnect();
              }
            },
            { rootMargin: '1200px 0px' },
          );
    if (io) io.observe(el);
    else useAssistant.getState().request();
    // Remember the panel's height (a CSS variable, no re-render) so the section keeps its shape
    // while the conversation is shown in the drawer.
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            if (el.offsetHeight > 0 && el.firstElementChild)
              root.style.setProperty('--ai-reserve', `${el.offsetHeight}px`);
          });
    ro?.observe(el);
    return () => {
      io?.disconnect();
      ro?.disconnect();
      if (useAssistant.getState().slots.section === el) useAssistant.getState().setSlot('section', null);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.slot} data-testid="ask-ai-slot">
      {shown ? (
        <div className={`${styles.away} glass glass--flat`}>
          <p>This conversation is open in the Ask My AI drawer.</p>
        </div>
      ) : null}
      <div ref={hostRef} className={styles.host} />
    </div>
  );
}

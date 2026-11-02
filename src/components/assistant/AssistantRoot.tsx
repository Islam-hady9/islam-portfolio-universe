'use client';

import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SuggestionMap } from '@/components/ask-ai/suggestions';
import { useAssistant } from '@/state/assistant-store';
import { AssistantDrawer } from './AssistantDrawer';
import { AssistantOrb } from './AssistantOrb';
import { isAssistantShortcut, isTypingTarget } from './focus';

// The full assistant UI (and, inside it, Smart Mode / Local AI) loads only on demand: when the
// Ask My AI section nears the viewport, the orb is hovered or focused, or the drawer opens.
const AskAiPanel = dynamic(() => import('@/components/ask-ai/AskAiPanel').then((m) => m.AskAiPanel), {
  ssr: false,
});

/**
 * AI Presence V1 — mounts the ONE assistant (AskAiPanel) for the whole site and moves its DOM
 * between the Ask My AI section, the global drawer and a hidden park. The React tree never
 * remounts, so the conversation, mode, Local AI runtime and announcements are shared by every
 * access point and survive client-side navigation (session memory only; nothing is stored).
 */
export function AssistantRoot({
  manifestVersion,
  suggestionMap,
}: {
  manifestVersion: string;
  suggestionMap: SuggestionMap;
}) {
  // The persistent node the single panel renders into (created on the client only).
  const [host] = useState<HTMLDivElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.setAttribute('data-ai-host', 'parked');
    return el;
  });
  const parkRef = useRef<HTMLDivElement>(null);
  const requested = useAssistant((s) => s.requested);
  const shown = useAssistant((s) => s.shown);
  const sectionSlot = useAssistant((s) => s.slots.section);
  const drawerSlot = useAssistant((s) => s.slots.drawer);

  useEffect(() => () => host?.remove(), [host]);

  // Placement: the drawer while it is on screen (through its close animation), else the
  // section (home page), else the hidden park. A slot removed by navigation detaches the host
  // with it; this re-attaches it before paint.
  useLayoutEffect(() => {
    if (!host) return;
    const target = (shown && drawerSlot) || sectionSlot || parkRef.current;
    if (!target) return;
    if (host.parentElement !== target) target.appendChild(host);
    host.setAttribute(
      'data-ai-host',
      target === drawerSlot ? 'drawer' : target === sectionSlot ? 'section' : 'parked',
    );
  }, [host, shown, drawerSlot, sectionSlot]);

  // Ctrl+K (⌘K on macOS) toggles the assistant: it opens with the question field focused, and the
  // same chord closes it again (focus returns to where it was). The key is left alone — the page
  // or field keeps its own behaviour — while the visitor is typing in a field outside the drawer,
  // during IME composition, on key repeat, and while another modal (the intro reel) is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isAssistantShortcut(e) || e.repeat || e.isComposing) return;
      const otherModal = [...document.querySelectorAll('dialog[open]')].some(
        (d) => !d.hasAttribute('data-assistant-drawer'),
      );
      if (otherModal) return;
      const active = document.activeElement;
      // Focus can be inside the drawer (open, or still in its exit animation).
      const inDrawer = active instanceof HTMLElement && active.closest('[data-assistant-drawer]') !== null;
      if (!inDrawer && isTypingTarget(active)) return;
      e.preventDefault();
      const s = useAssistant.getState();
      if (s.open) s.closeAssistant();
      else s.openAssistant({ opener: active instanceof HTMLElement && !inDrawer ? active : null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <div ref={parkRef} hidden data-ai-park="" />
      {host && requested
        ? createPortal(<AskAiPanel manifestVersion={manifestVersion} suggestionMap={suggestionMap} />, host)
        : null}
      <AssistantDrawer />
      <AssistantOrb />
    </>
  );
}

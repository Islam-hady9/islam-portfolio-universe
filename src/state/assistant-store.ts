'use client';

/**
 * AI Presence — the shared, session-scoped state that ties every access point (floating orb,
 * hero entry, global drawer, the Ask My AI section) to ONE assistant instance. The conversation
 * itself lives inside that single AskAiPanel instance (mounted once by AssistantRoot); this
 * store only coordinates where it is shown, queued questions and a compact status for the orb.
 * In memory only: nothing here is persisted (privacy policy: questions are never stored).
 */
import { create } from 'zustand';

export type PresencePhase =
  | 'idle'
  | 'ready'
  | 'retrieving'
  | 'downloading'
  | 'initializing'
  | 'generating'
  | 'complete'
  | 'fallback'
  | 'error';

export interface Presence {
  phase: PresencePhase;
  /** 0..1 while a model downloads or initializes. */
  progress: number | null;
}

export type SlotKind = 'section' | 'drawer';

interface AssistantState {
  /** The global drawer is open (requested state). */
  open: boolean;
  /** The drawer dialog is on screen — true from showModal until its close animation ends. */
  shown: boolean;
  /** The assistant UI module has been asked for (loaded on demand, never up front). */
  requested: boolean;
  /** A question queued by the hero or a suggestion, consumed exactly once by the panel. */
  pending: { id: number; text: string } | null;
  presence: Presence;
  /** Where the single panel instance can be shown. */
  slots: Record<SlotKind, HTMLElement | null>;
  /** Element to return focus to when the drawer closes. */
  opener: HTMLElement | null;
  request: () => void;
  openAssistant: (opts?: { question?: string; opener?: HTMLElement | null }) => void;
  closeAssistant: () => void;
  /** Called by the panel when it takes the queued question; ignores stale ids. */
  takePending: (id: number) => string | null;
  setShown: (shown: boolean) => void;
  setPresence: (p: Presence) => void;
  setSlot: (kind: SlotKind, el: HTMLElement | null) => void;
}

let seq = 0;

export const useAssistant = create<AssistantState>((set, get) => ({
  open: false,
  shown: false,
  requested: false,
  pending: null,
  presence: { phase: 'idle', progress: null },
  slots: { section: null, drawer: null },
  opener: null,
  request: () => {
    if (!get().requested) set({ requested: true });
  },
  openAssistant: (opts = {}) => {
    const question = opts.question?.trim();
    set((s) => ({
      open: true,
      requested: true,
      // Still on screen (open, or reopened during its exit animation): keep the original opener.
      opener: opts.opener ?? (s.open || s.shown ? s.opener : null),
      pending: question ? { id: ++seq, text: question } : s.pending,
    }));
  },
  closeAssistant: () => set({ open: false }),
  takePending: (id) => {
    const p = get().pending;
    if (!p || p.id !== id) return null;
    set({ pending: null });
    return p.text;
  },
  setShown: (shown) => {
    if (get().shown !== shown) set({ shown });
  },
  setPresence: (presence) => {
    const cur = get().presence;
    if (cur.phase !== presence.phase || cur.progress !== presence.progress) set({ presence });
  },
  setSlot: (kind, el) => set((s) => (s.slots[kind] === el ? s : { slots: { ...s.slots, [kind]: el } })),
}));

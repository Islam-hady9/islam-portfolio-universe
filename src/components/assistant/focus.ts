import { useSyncExternalStore } from 'react';

/** Focuses the assistant's question field inside the open drawer, without scrolling the page. */
export function focusAssistantInput(): boolean {
  const input = document.querySelector<HTMLInputElement>('[data-ai-host="drawer"] [data-assistant-input]');
  if (!input) return false;
  input.focus({ preventScroll: true });
  return true;
}

/** Apple platforms use ⌘K; everything else Ctrl+K. */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    '';
  return /mac|iphone|ipad/i.test(platform);
}

/**
 * The global shortcut: ⌘K on macOS, Ctrl+K elsewhere — never the other platform's chord (on a
 * Mac, Ctrl+K deletes to the end of the line in text fields). Matched on the physical key too,
 * so it works with non-Latin keyboard layouts (e.g. Arabic, where the K key types "ن").
 */
export function isAssistantShortcut(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
  mac = isMacPlatform(),
): boolean {
  if (e.altKey || e.shiftKey) return false;
  if (e.code !== 'KeyK' && e.key.toLowerCase() !== 'k') return false;
  return mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
}

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);
/** Somewhere the visitor types (a text field, a text area, rich text): shortcuts stay theirs. */
export function isTypingTarget(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(el.type);
}

/** Human label of the global shortcut for this platform. */
export function shortcutLabel(): string {
  return isMacPlatform() ? '⌘K' : 'Ctrl K';
}

/** The same shortcut in `aria-keyshortcuts` syntax. */
export function shortcutAria(label: string): string {
  return label === '⌘K' ? 'Meta+K' : 'Control+K';
}

const noSubscribe = () => () => {};
/** The shortcut label, hydration-safe: "Ctrl K" on the server, the platform's label after. */
export function useShortcutLabel(): string {
  return useSyncExternalStore(noSubscribe, shortcutLabel, () => 'Ctrl K');
}

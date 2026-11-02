'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useAssistant } from '@/state/assistant-store';
import { useExperience } from '@/state/experience-store';
import { focusAssistantInput } from './focus';
import styles from './AssistantDrawer.module.css';

const CLOSE_MS = 220;

/**
 * The global Ask My AI drawer (AI Presence V1): a native modal <dialog> — the page behind is
 * inert, focus stays inside, Escape and the backdrop close it, focus returns to the opener.
 * It owns no assistant logic: the one AskAiPanel instance is moved into `slot` while open.
 * While it is open the page cannot scroll and the 3D world pauses on its last frame (same
 * policy as the intro reel); everything is restored on close, including on navigation.
 */
export function AssistantDrawer() {
  const titleId = useId();
  const pathname = usePathname();
  const open = useAssistant((s) => s.open);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const savedOverflow = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = slotRef.current;
    useAssistant.getState().setSlot('drawer', el);
    return () => {
      if (useAssistant.getState().slots.drawer === el) useAssistant.getState().setSlot('drawer', null);
    };
  }, []);

  // Store → dialog. Opening happens before paint so the panel is in place on the first frame.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
        // A fast reopen can come before the previous close was processed: the page is then
        // still locked, and its saved overflow is the original one — keep it.
        if (savedOverflow.current === null) {
          const root = document.documentElement;
          savedOverflow.current = root.style.overflow;
          root.style.overflow = 'hidden';
        }
        useExperience.getState().setAssistantOpen(true);
        useAssistant.getState().setShown(true);
      }
      // The phase only drives CSS (enter / exit animations), so it lives on the element. Set even
      // when the dialog is still open: a reopen during the exit animation plays it forward again.
      dialog.setAttribute('data-phase', 'open');
    } else if (dialog.open) {
      if (document.documentElement.getAttribute('data-motion') !== 'full') {
        dialog.close();
        return;
      }
      dialog.setAttribute('data-phase', 'closing');
      const t = window.setTimeout(() => {
        if (dialog.open) dialog.close();
      }, CLOSE_MS);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // Dialog → store and page restoration (Escape, backdrop, close button, navigation).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      useAssistant.getState().closeAssistant();
    };
    const onClose = () => {
      // The close event is dispatched asynchronously (after the browser has already restored
      // focus). If the drawer was reopened in between — Escape then an immediate Ctrl+K — the
      // event is stale: the drawer stays open.
      if (dialog.open) return;
      dialog.setAttribute('data-phase', 'closed');
      document.documentElement.style.overflow = savedOverflow.current ?? '';
      savedOverflow.current = null;
      useExperience.getState().setAssistantOpen(false);
      const s = useAssistant.getState();
      s.setShown(false);
      if (s.open) s.closeAssistant();
      const opener = s.opener;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      if (savedOverflow.current !== null) {
        document.documentElement.style.overflow = savedOverflow.current;
        savedOverflow.current = null;
        useExperience.getState().setAssistantOpen(false);
      }
    };
  }, []);

  // Navigating away (e.g. a source link inside an answer) closes the drawer; the conversation
  // stays in the shared session.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (useAssistant.getState().open) useAssistant.getState().closeAssistant();
  }, [pathname]);

  // Focus the question field once the panel is in place (it may still be loading). Leaves focus
  // alone if the visitor already moved it, and on touch screens (no surprise keyboard).
  useEffect(() => {
    if (!open || window.matchMedia?.('(pointer: coarse)').matches) return;
    const dialog = dialogRef.current;
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      if (!dialog?.open) return;
      const active = document.activeElement;
      const untouched =
        !active ||
        active === document.body ||
        active === dialog ||
        active.hasAttribute('data-assistant-close');
      if (!untouched || focusAssistantInput()) return;
      if (performance.now() - started < 5000) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Mobile: follow the visual viewport so the on-screen keyboard never hides the field.
  useEffect(() => {
    const dialog = dialogRef.current;
    const vv = window.visualViewport;
    if (!open || !dialog || !vv) return;
    const apply = () => dialog.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    apply();
    vv.addEventListener('resize', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      dialog.style.removeProperty('--vvh');
    };
  }, [open]);

  const close = () => useAssistant.getState().closeAssistant();
  const home = pathname === '/';

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      data-assistant-drawer=""
      data-testid="assistant-drawer"
      aria-labelledby={titleId}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={`${styles.sheet} glass glass--panel glass--mint`}>
        <header className={styles.head}>
          <span className={styles.mark} aria-hidden="true" />
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>
              Ask My AI
            </h2>
            <p className={styles.sub}>
              The same assistant everywhere on this site · answers from approved content
            </p>
          </div>
          <button
            type="button"
            className={`${styles.close} glass glass--chip`}
            onClick={close}
            aria-label="Close Ask My AI"
            data-assistant-close=""
            data-action="assistant-close"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div ref={slotRef} className={styles.slot} />
        <footer className={styles.foot}>
          {home ? (
            <a
              href="#ask-ai"
              className={styles.footLink}
              onClick={(e) => {
                e.preventDefault();
                close();
                window.setTimeout(
                  () =>
                    document.getElementById('ask-ai')?.scrollIntoView({
                      behavior:
                        document.documentElement.getAttribute('data-motion') === 'full' ? 'smooth' : 'auto',
                      block: 'start',
                    }),
                  CLOSE_MS + 40,
                );
              }}
            >
              Continue in the Ask My AI section
            </a>
          ) : (
            <Link href="/#ask-ai" className={styles.footLink}>
              Open the full Ask My AI experience
            </Link>
          )}
          <span className={styles.keys} aria-hidden="true">
            <kbd>Esc</kbd> to close
          </span>
        </footer>
      </div>
    </dialog>
  );
}

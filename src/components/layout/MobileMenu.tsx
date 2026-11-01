'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { PRIMARY_NAV, routes } from '@/lib/routes';
import { Icon } from '@/components/ui/Icon';
import styles from './MobileMenu.module.css';

interface MobileMenuProps {
  id: string;
  open: boolean;
  active: string | null;
  roleLabel: string;
  onClose: (restoreFocus: boolean) => void;
}

/**
 * Full-screen mobile navigation panel (spec §4.1): focus moves in on open, Escape closes and
 * returns focus to the toggle, the rest of the page is made inert while open, any navigation
 * closes it.
 */
export function MobileMenu({ id, open, active, roleLabel, onClose }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const outside = Array.from(document.querySelectorAll<HTMLElement>('main, footer, [data-dock]'));
    outside.forEach((el) => el.setAttribute('inert', ''));
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      outside.forEach((el) => el.removeAttribute('inert'));
      root.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      id={id}
      ref={panelRef}
      className={styles.panel}
      data-open={open || undefined}
      hidden={!open}
      aria-label="Site menu"
      role="region"
    >
      <nav aria-label="Mobile primary" className={styles.inner}>
        <ul className={styles.list}>
          {PRIMARY_NAV.map((item, i) => (
            <li key={item.id} style={{ ['--i' as string]: i }}>
              <Link
                href={item.href}
                className={styles.link}
                data-active={active === item.id || undefined}
                aria-current={active === item.id ? 'page' : undefined}
                onClick={() => onClose(false)}
              >
                <span className={styles.index} aria-hidden="true">
                  0{i + 1}
                </span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.footer}>
          <Link href={routes.contact} className={styles.cta} onClick={() => onClose(false)}>
            Let&apos;s Talk <Icon name="arrow-up-right" size={16} />
          </Link>
          <Link href={routes.resume} className={styles.secondary} onClick={() => onClose(false)}>
            Resume
          </Link>
          <p className={styles.role}>{roleLabel}</p>
        </div>
      </nav>
    </div>
  );
}

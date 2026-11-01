'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PRIMARY_NAV, activeNavId, routes } from '@/lib/routes';
import { useExperience } from '@/state/experience-store';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from './BrandMark';
import { MobileMenu } from './MobileMenu';
import { SettingsPanel } from './SettingsPanel';
import styles from './Header.module.css';

export function Header({ displayName, roleLabel }: { displayName: string; roleLabel: string }) {
  const pathname = usePathname() ?? '/';
  const activeSection = useExperience((s) => s.activeSection);
  const active = activeNavId(pathname, activeSection);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close overlays on route change (spec §4.1: close on navigation).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSettingsOpen(false);
  }

  return (
    <header
      className={styles.header}
      data-scrolled={scrolled || undefined}
      data-menu-open={menuOpen || undefined}
    >
      <div className={styles.bar}>
        <Link href={routes.home} className={styles.brand}>
          <BrandMark gradientId="bm-header" />
          <span className={styles.brandName}>{displayName}</span>
          <span className="sr-only"> — home</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          <ul className={styles.navList}>
            {PRIMARY_NAV.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={styles.navLink}
                  aria-current={active === item.id ? (item.sections ? 'location' : 'page') : undefined}
                  data-active={active === item.id || undefined}
                  scroll={!item.href.includes('#')}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <div className={styles.settingsWrap}>
            <button
              ref={settingsButtonRef}
              type="button"
              className={styles.iconButton}
              aria-label="Motion and visual quality settings"
              aria-expanded={settingsOpen}
              aria-controls="settings-panel"
              onClick={() => setSettingsOpen((o) => !o)}
              data-action="open-settings"
            >
              <Icon name="sliders" size={18} />
            </button>
            <SettingsPanel
              id="settings-panel"
              open={settingsOpen}
              onClose={() => {
                setSettingsOpen(false);
                settingsButtonRef.current?.focus();
              }}
              anchorRef={settingsButtonRef}
            />
          </div>
          <Link href={routes.contact} className={styles.talk} data-magnetic="" data-action="header-talk">
            <span data-magnetic-inner="">
              Let&apos;s Talk <Icon name="arrow-up-right" size={15} />
            </span>
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className={`${styles.iconButton} ${styles.menuButton}`}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((o) => !o)}
            data-action="toggle-menu"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      <MobileMenu
        id="mobile-menu"
        open={menuOpen}
        active={active}
        roleLabel={roleLabel}
        onClose={(restoreFocus) => {
          setMenuOpen(false);
          if (restoreFocus) menuButtonRef.current?.focus();
        }}
      />
    </header>
  );
}

import Link from 'next/link';
import { FOOTER_NAV, routes } from '@/lib/routes';
import { getContentMode, getSite, getSocialLinks } from '@/content';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from './BrandMark';
import { CurrentYear } from './CurrentYear';
import styles from './Footer.module.css';

export function Footer() {
  const site = getSite();
  const social = getSocialLinks().filter((s) => s.url);
  const mode = getContentMode();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.brand}>
          <Link href={routes.home} className={styles.brandLink} aria-label={`${site.displayName} — home`}>
            <BrandMark size={34} gradientId="bm-footer" />
            <span>
              <span className={styles.name}>{site.displayName}</span>
              <span className={styles.role}>{site.roleLabel}</span>
            </span>
          </Link>
        </div>

        <nav aria-label="Footer" className={styles.nav}>
          <ul>
            {FOOTER_NAV.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.meta}>
          {social.length > 0 ? (
            <ul className={styles.social} aria-label="Profiles">
              {social.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialLink}
                    aria-label={`${s.label} (opens in a new tab)${s.verification.status === 'placeholder' ? ', link pending owner confirmation' : ''}`}
                  >
                    <Icon name={s.icon} size={18} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <p className={styles.copy}>
            © <CurrentYear buildYear={new Date().getFullYear()} /> {site.name}. All rights reserved.
          </p>
        </div>
      </div>
      <div className={`container ${styles.base}`}>
        {mode !== 'VERIFIED_PUBLIC' ? (
          <p className={styles.notice} data-testid="content-mode-notice">
            <span className={styles.noticeDot} aria-hidden="true" />
            Preview build — portfolio content is sample or pending owner review.{' '}
            <Link href="/about#content-status">What this means</Link>
          </p>
        ) : (
          <span />
        )}
        <p className={styles.credits}>
          Built with procedural real-time 3D. <Link href="/about#colophon">Colophon &amp; credits</Link>
        </p>
      </div>
    </footer>
  );
}

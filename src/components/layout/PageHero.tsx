import type { ReactNode } from 'react';
import { Eyebrow } from '@/components/ui/SectionHeading';
import styles from './PageHero.module.css';

/** Inner-page masthead: eyebrow, h1, lead and optional actions/meta. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <div className={`container ${styles.grid}`}>
        <div className={styles.main}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className={styles.title} data-reveal="lines" tabIndex={-1}>
            {title}
          </h1>
          {lead ? (
            <p className={styles.lead} data-reveal="fade">
              {lead}
            </p>
          ) : null}
          {children ? <div className={styles.actions}>{children}</div> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </div>
    </header>
  );
}

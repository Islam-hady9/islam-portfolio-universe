import type { ReactNode } from 'react';
import type { SiteIdentity } from '@/content/schema';
import { Icon } from '@/components/ui/Icon';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { highlightPhrases } from '@/lib/text';
import styles from './IdentitySection.module.css';

/**
 * S2 — Identity / three pillars. Dark editorial band. With a `portrait` (home), the person
 * stands on the right, looking back across the statement; pillars settle under the statement.
 */
export function IdentitySection({ site, portrait }: { site: SiteIdentity; portrait?: ReactNode }) {
  const { identity, pillars } = site;
  return (
    <section
      id="identity"
      data-section="identity"
      className={styles.identity}
      aria-labelledby="identity-title"
    >
      <div className={`container ${styles.grid}`} data-with-portrait={portrait ? '' : undefined}>
        <div className={styles.statementCol}>
          <Eyebrow>{identity.eyebrow}</Eyebrow>
          <h2 id="identity-title" className={styles.statement} data-reveal="lines" tabIndex={-1}>
            {highlightPhrases(identity.statement, identity.highlights, styles.highlight!)}
          </h2>
        </div>
        {portrait ? <div className={styles.portraitCol}>{portrait}</div> : null}
        <ul className={styles.pillars} data-reveal="stagger">
          {pillars.map((p) => (
            <li key={p.id} className={styles.pillar} data-reveal-item="">
              <span className={styles.icon} aria-hidden="true">
                <Icon name={p.icon} size={30} strokeWidth={1.3} />
              </span>
              <h3 className={styles.pillarTitle}>{p.title}</h3>
              <p className={styles.pillarText}>{p.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

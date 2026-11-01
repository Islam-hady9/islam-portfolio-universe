import type { HomeCopy, Principle } from '@/content/schema';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Icon } from '@/components/ui/Icon';
import styles from './PhilosophySection.module.css';

/** S5 — Engineering philosophy: five restrained glass tiles. */
export function PhilosophySection({ copy, principles }: { copy: HomeCopy['philosophy']; principles: Principle[] }) {
  return (
    <section id="philosophy" data-section="philosophy" className={styles.philosophy} aria-labelledby="philosophy-title">
      <div className="container">
        <SectionHeading id="philosophy-title" eyebrow={copy.eyebrow} title={copy.title} />
        <ol className={styles.grid} data-reveal="stagger">
          {principles.map((p, i) => (
            <li key={p.id} className={styles.tile} data-reveal-item="">
              <span className={styles.lineArt} aria-hidden="true" />
              <span className={styles.index} aria-hidden="true">
                0{i + 1}
              </span>
              <span className={styles.icon} aria-hidden="true">
                <Icon name={p.icon} size={28} strokeWidth={1.3} />
              </span>
              <h3 className={styles.title}>{p.title}</h3>
              <p className={styles.text}>{p.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

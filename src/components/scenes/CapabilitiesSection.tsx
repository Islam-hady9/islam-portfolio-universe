import type { CapabilityGroup, HomeCopy } from '@/content/schema';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Icon } from '@/components/ui/Icon';
import { CapabilityFocus } from './CapabilityFocus';
import styles from './CapabilitiesSection.module.css';

/** S6 — Capability layers with nested skill chips. No empty accordions (spec S6). */
export function CapabilitiesSection({ copy, groups }: { copy: HomeCopy['capabilities']; groups: CapabilityGroup[] }) {
  return (
    <section
      id="capabilities"
      data-section="capabilities"
      className={styles.capabilities}
      aria-labelledby="capabilities-title"
    >
      <div className="container">
        <SectionHeading id="capabilities-title" eyebrow={copy.eyebrow} title={copy.title} />
        <ul className={styles.grid} data-reveal="stagger">
          {groups.map((g) => (
            <li key={g.id} id={`capability-${g.id}`} className={styles.panel} data-capability={g.id} data-reveal-item="">
              <div className={styles.head}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon name={g.icon} size={34} strokeWidth={1.25} />
                </span>
                <div>
                  <h3 className={styles.title}>{g.title}</h3>
                  <p className={styles.text}>{g.description}</p>
                </div>
              </div>
              <ul className={styles.chips} aria-label={`${g.title} skills`}>
                {g.skills.map((s) => (
                  <li key={s} className={styles.chip}>
                    {s}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className={styles.footnote}>{copy.footnote}</p>
        <CapabilityFocus />
      </div>
    </section>
  );
}

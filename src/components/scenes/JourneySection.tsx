import type { Career, HomeCopy } from '@/content/schema';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatusTag } from '@/components/ui/StatusTag';
import { SceneArt } from './SceneArt';
import { JourneyTimeline } from './JourneyTimeline';
import styles from './JourneySection.module.css';

/** S7 — Experience journey over a low-horizon landscape. Sample content until CV (spec S7). */
export function JourneySection({ copy, career }: { copy: HomeCopy['experience']; career: Career }) {
  const allSample = career.entries.every((e) => e.verification.status === 'placeholder');
  return (
    <section
      id="experience"
      data-section="experience"
      className={styles.journey}
      aria-labelledby="experience-title"
    >
      <SceneArt
        scene="journey"
        label="A low horizon of dark mountains under a field of stars."
        className={styles.art}
      />
      <div className="container">
        <div className={styles.header}>
          <SectionHeading
            id="experience-title"
            eyebrow={copy.eyebrow}
            title={copy.title}
            className={styles.heading}
          />
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>
        {allSample ? (
          <p className={styles.notice}>
            <StatusTag tone="sample">Sample journey</StatusTag>
            <span>{career.sampleNotice}</span>
          </p>
        ) : null}
        <JourneyTimeline entries={career.entries} />
      </div>
    </section>
  );
}

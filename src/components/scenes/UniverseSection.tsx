import type { HomeCopy, UniverseNode } from '@/content/schema';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SceneArt } from './SceneArt';
import { UniverseNodes } from './UniverseNodes';
import styles from './UniverseSection.module.css';

/**
 * S3 — The Intelligence Universe. The galaxy and orbits are real 3D in the shared canvas;
 * the six destinations are real links (DOM) pinned to projected node positions while the
 * scene is live, and laid out statically / as a list otherwise (spec S3, §7).
 */
export function UniverseSection({ copy, nodes }: { copy: HomeCopy['universe']; nodes: UniverseNode[] }) {
  return (
    <section id="universe" data-section="universe" className={styles.universe} aria-labelledby="universe-title">
      <div className={`container ${styles.layout}`}>
        <div className={styles.intro}>
          <SectionHeading
            id="universe-title"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
            size="lg"
            className={styles.heading}
          />
          <p className={styles.hint}>{copy.hint}</p>
        </div>
        <div className={styles.stage} data-universe-stage="">
          <SceneArt scene="universe" label={copy.artDescription} className={styles.art} />
          <UniverseNodes nodes={nodes} />
        </div>
      </div>
    </section>
  );
}

import type { HomeCopy } from '@/content/schema';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { StatusTag } from '@/components/ui/StatusTag';
import { AskAiPanel } from '@/components/ask-ai/AskAiPanel';
import { SceneArt } from './SceneArt';
import styles from './AskAISection.module.css';

/**
 * S8 — Ask My AI: explorer before a monumental portal (3D) + the Portfolio Intelligence Engine
 * (Smart Mode by default, opt-in Local AI). The section copy comes from home.json unchanged; the
 * former "concept preview" status line is replaced by the live mode status.
 */
export function AskAISection({
  copy,
  manifestVersion,
}: {
  copy: HomeCopy['assistant'];
  manifestVersion: string;
}) {
  return (
    <section id="ask-ai" data-section="ask-ai" className={styles.section} aria-labelledby="ask-ai-title">
      <SceneArt scene="portal" label={copy.artDescription} className={styles.art} />
      <div className={`container ${styles.grid}`}>
        <div className={styles.portalSpace} aria-hidden="true" />
        <div className={styles.copy}>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2 id="ask-ai-title" className={styles.title} data-reveal="lines" tabIndex={-1}>
            {copy.title}
          </h2>
          <p className={styles.body} data-reveal="fade">
            {copy.body}
          </p>
          <p className={styles.status} data-reveal="fade">
            <StatusTag tone="verified">Live</StatusTag>
            <span>
              Smart Mode answers from approved content · Local AI is optional and runs on your device
            </span>
          </p>
        </div>
        <div className={styles.panel} data-reveal="fade">
          <AskAiPanel manifestVersion={manifestVersion} />
        </div>
      </div>
    </section>
  );
}

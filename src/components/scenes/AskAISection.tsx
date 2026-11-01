import type { AssistantKnowledge, HomeCopy } from '@/content/schema';
import type { SourceIndex } from '@/lib/assistant/contracts';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { StatusTag } from '@/components/ui/StatusTag';
import { AssistantPanel } from '@/components/assistant/AssistantPanel';
import { SceneArt } from './SceneArt';
import styles from './AskAISection.module.css';

/** S8 — Ask My AI: explorer before a monumental portal (3D) + honest assistant preview. */
export function AskAISection({
  copy,
  knowledge,
  sourceIndex,
}: {
  copy: HomeCopy['assistant'];
  knowledge: AssistantKnowledge;
  sourceIndex: SourceIndex;
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
            <StatusTag tone="demo">Concept preview</StatusTag>
            <span>{copy.status}</span>
          </p>
        </div>
        <div className={styles.panel} data-reveal="fade">
          <AssistantPanel knowledge={knowledge} sourceIndex={sourceIndex} statusLabel={copy.status} />
        </div>
      </div>
    </section>
  );
}

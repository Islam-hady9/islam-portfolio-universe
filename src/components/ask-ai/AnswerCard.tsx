'use client';

import Link from 'next/link';
import type { LinkTarget } from '@/lib/portfolio-ai/shared/types';
import { StatusTag } from '@/components/ui/StatusTag';
import type { DisplayAnswer, Turn } from './state';
import { UI } from './copy';
import styles from './AskAiPanel.module.css';

/** Plain text only (React escapes it); [E#] tags become small citation marks. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split(/(\[E\d+\]|\n)/).map((part, j) =>
            part === '\n' ? (
              <br key={j} />
            ) : /^\[E\d+\]$/.test(part) ? (
              <sup key={j} className={styles.cite} aria-label={`source ${part.slice(1, -1)}`}>
                {part}
              </sup>
            ) : (
              part
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function TargetLink({
  link,
  className,
}: {
  link: Pick<LinkTarget, 'href' | 'label' | 'kind'>;
  className?: string;
}) {
  if (link.kind === 'route') {
    return (
      <Link href={link.href} className={className}>
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      className={className}
      {...(link.kind === 'external' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {link.label}
    </a>
  );
}

const kindOf = (href: string): LinkTarget['kind'] =>
  href.startsWith('mailto:') ? 'mailto' : href.startsWith('/') ? 'route' : 'external';

function Answer({ answer }: { answer: DisplayAnswer }) {
  const local = answer.mode === 'local';
  // Next steps that are already listed as a source are not repeated.
  const sourceUrls = new Set(answer.evidence.map((e) => e.url).filter(Boolean));
  const nextSteps = answer.links.filter((l) => !sourceUrls.has(l.href));
  return (
    <>
      <div className={styles.answerHead}>
        <StatusTag tone={local ? 'concept' : 'verified'}>{local ? UI.localLabel : UI.smartLabel}</StatusTag>
      </div>
      <div
        className={styles.answerText}
        dir={answer.language === 'ar' ? 'rtl' : 'ltr'}
        lang={answer.language}
      >
        <RichText text={answer.text} />
      </div>
      {answer.notice ? <p className={styles.noticeLine}>{answer.notice}</p> : null}
      {answer.evidence.length > 0 ? (
        <div className={styles.sources}>
          <span className={styles.sourcesLabel}>{local ? UI.sourcesGiven : UI.sources}</span>
          <ul>
            {answer.evidence.map((e) => (
              <li key={e.id} data-cited={e.cited ? 'true' : undefined}>
                {e.url ? (
                  <TargetLink
                    link={{ href: e.url, label: `${e.id} · ${e.title}`, kind: kindOf(e.url) }}
                    className={`${styles.source} glass glass--chip`}
                  />
                ) : (
                  <span className={`${styles.source} glass glass--chip`}>{`${e.id} · ${e.title}`}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {nextSteps.length > 0 ? (
        <nav className={styles.nextSteps} aria-label={UI.nextSteps}>
          {nextSteps.map((l) => (
            <TargetLink key={l.id} link={l} className={`${styles.source} glass glass--chip`} />
          ))}
        </nav>
      ) : null}
      {answer.disclaimer ? <p className={styles.disclaimer}>{answer.disclaimer}</p> : null}
    </>
  );
}

export function AnswerCard({ turn, reducedMotion }: { turn: Turn; reducedMotion: boolean }) {
  const mode = turn.answer?.mode ?? (turn.state === 'streaming' ? 'local' : 'smart');
  return (
    <article
      className={`${styles.answer} glass glass--inset`}
      data-testid="assistant-answer"
      data-turn-state={turn.state}
      data-mode={mode}
      data-status={turn.answer?.status}
      data-intent={turn.answer?.intent}
    >
      <p className={styles.question}>
        <span className="sr-only">{UI.you} </span>“{turn.question}”
      </p>
      {turn.answer ? (
        <Answer answer={turn.answer} />
      ) : turn.state === 'streaming' ? (
        <div className={`${styles.answerText} ${styles.streaming}`} aria-hidden="true">
          {reducedMotion ? UI.writing : turn.streaming}
        </div>
      ) : turn.state === 'cancelled' ? (
        <p className={styles.answerLabel}>{UI.cancelled}</p>
      ) : turn.state === 'error' ? (
        <p className={styles.answerLabel}>{UI.turnError}</p>
      ) : (
        <p className={styles.answerLabel}>{UI.searching}</p>
      )}
    </article>
  );
}

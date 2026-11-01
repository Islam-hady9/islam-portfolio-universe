'use client';

import Link from 'next/link';
import { useId, useMemo, useRef, useState } from 'react';
import type { AssistantKnowledge } from '@/content/schema';
import type { AssistantClient, GroundedAnswer, SourceIndex } from '@/lib/assistant/contracts';
import { DemoAssistantClient, answerEntryById } from '@/lib/assistant/demo-provider';
import { HttpAssistantClient } from '@/lib/assistant/http-client';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { track } from '@/lib/analytics';
import styles from './AssistantPanel.module.css';

interface Exchange {
  question: string;
  answer: GroundedAnswer;
}

const STATUS_LABEL: Record<GroundedAnswer['status'], string> = {
  answered: 'Demo response',
  out_of_scope: 'Outside the demo',
  refused: 'Not answered',
  unavailable: 'Unavailable',
  rate_limited: 'Slow down',
  error: 'Error',
};

/**
 * Assistant preview (spec S8 / §9.1). In demo mode every answer is a pre-written fixture
 * composed from site content, labelled as such, with citations. The input works — as a
 * demo — and nothing typed leaves the browser.
 */
export function AssistantPanel({
  knowledge,
  sourceIndex,
  statusLabel,
}: {
  knowledge: AssistantKnowledge;
  sourceIndex: SourceIndex;
  statusLabel: string;
}) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [pending, setPending] = useState(false);
  const live = process.env.NEXT_PUBLIC_ASSISTANT_MODE === 'live';
  const client: AssistantClient = useMemo(
    () => (live ? new HttpAssistantClient() : new DemoAssistantClient(knowledge, sourceIndex)),
    [live, knowledge, sourceIndex],
  );

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    setPending(true);
    track('assistant_demo_query', { mode: client.mode });
    try {
      const answer = await client.ask({ question: q });
      setExchange({ question: q, answer });
    } finally {
      setPending(false);
    }
  };

  const askPrompt = (label: string, entryId: string) => {
    const answer = live ? null : answerEntryById(knowledge, sourceIndex, entryId);
    if (answer) {
      track('assistant_demo_query', { mode: 'demo', prompt: entryId });
      setExchange({ question: label, answer });
    } else {
      void ask(label);
    }
  };

  return (
    <div className={styles.panel} data-testid="assistant-panel" data-mode={client.mode}>
      <div className={styles.header}>
        <StatusTag tone="demo">{live ? 'Live preview' : 'Demo mode'}</StatusTag>
        <p className={styles.status}>{statusLabel}</p>
      </div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void ask(value);
          setValue('');
        }}
      >
        <label htmlFor={`${uid}-q`} className="sr-only">
          Ask about the portfolio ({live ? 'live preview' : 'demo answers from sample content'})
        </label>
        <Icon name="sparkle" size={18} className={styles.spark} />
        <input
          ref={inputRef}
          id={`${uid}-q`}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={live ? 'Ask about my work…' : 'Ask about projects, stack or experience (demo)…'}
          maxLength={500}
          autoComplete="off"
          enterKeyHint="send"
        />
        <button
          type="submit"
          className={styles.send}
          aria-label={live ? 'Send question' : 'Send question (demo answer)'}
          disabled={pending || !value.trim()}
        >
          <Icon name="arrow-right" size={18} />
        </button>
      </form>

      <ul className={styles.prompts} aria-label="Sample questions">
        {knowledge.samplePrompts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={styles.prompt}
              onClick={() => askPrompt(p.label, p.entryId)}
              data-action="assistant-prompt"
            >
              {p.label}
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.output} aria-live="polite" aria-busy={pending}>
        {exchange ? (
          <article className={styles.answer} data-status={exchange.answer.status} data-testid="assistant-answer">
            <p className={styles.question}>
              <span className="sr-only">You asked: </span>“{exchange.question}”
            </p>
            <div className={styles.answerHead}>
              <StatusTag tone="demo">{exchange.answer.mode === 'demo' ? 'Demo' : 'Live'}</StatusTag>
              <span className={styles.answerLabel}>{STATUS_LABEL[exchange.answer.status]}</span>
            </div>
            <p className={styles.answerText}>{exchange.answer.answer}</p>
            {exchange.answer.sources.length > 0 ? (
              <div className={styles.sources}>
                <span className={styles.sourcesLabel}>Sources</span>
                <ul>
                  {exchange.answer.sources.map((s) => (
                    <li key={`${s.kind}:${s.ref}`}>
                      {s.href ? (
                        <Link href={s.href} className={styles.source}>
                          {s.label}
                        </Link>
                      ) : (
                        <span className={styles.source}>{s.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className={styles.disclaimer}>{exchange.answer.disclaimer}</p>
          </article>
        ) : (
          <p className={styles.empty}>
            Pick a sample question or type your own. Answers come from this site’s sample content — nothing you type is
            sent or stored.
          </p>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import styles from './SectionHeading.module.css';

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={[styles.eyebrow, className].filter(Boolean).join(' ')} data-reveal="fade">
      <span>{children}</span>
      <span className={styles.rule} aria-hidden="true" />
    </p>
  );
}

interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: 'h1' | 'h2';
  size?: 'md' | 'lg';
  className?: string;
}

/** Eyebrow + title (+ description, + trailing action) with reveal hooks for the motion system. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  as: Tag = 'h2',
  size = 'md',
  className,
}: SectionHeadingProps) {
  return (
    <div className={[styles.heading, className].filter(Boolean).join(' ')}>
      <div className={styles.text}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Tag
          id={id}
          className={size === 'lg' ? styles.titleLg : styles.title}
          data-reveal="lines"
          tabIndex={-1}
        >
          {title}
        </Tag>
        {description ? (
          <p className={styles.description} data-reveal="fade">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={styles.action} data-reveal="fade">
          {action}
        </div>
      ) : null}
    </div>
  );
}

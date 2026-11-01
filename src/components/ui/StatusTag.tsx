import type { VerificationStatus } from '@/content/schema';
import styles from './StatusTag.module.css';

type Tone = 'sample' | 'pending' | 'demo' | 'concept' | 'verified';

const toneFor: Record<VerificationStatus, Tone> = {
  placeholder: 'pending',
  owner_verified: 'verified',
  public_verified: 'verified',
};

/**
 * Honest, discreet status marker (spec §4.2: "display a clearly non-factual placeholder
 * where verification is pending"). Visible text — never colour alone.
 */
export function StatusTag({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span className={`${styles.tag} ${styles[tone]}`} title={title} data-status-tag={tone}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </span>
  );
}

export function VerificationTag({ status, label }: { status: VerificationStatus; label?: string }) {
  if (status !== 'placeholder') return null;
  return <StatusTag tone={toneFor[status]}>{label ?? 'Pending review'}</StatusTag>;
}

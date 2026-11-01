'use client';

import { useId, useState } from 'react';
import type { SocialLink } from '@/content/schema';
import { Button, ButtonLink } from '@/components/ui/Button';
import styles from './SocialAction.module.css';

/**
 * A social profile action. Configured links open the profile in a new tab; unconfigured
 * ones never pretend: they render a "Soon" button that discloses why (spec §10.2).
 */
export function SocialAction({ link }: { link: SocialLink }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (link.url) {
    return (
      <span className={styles.wrap}>
        <ButtonLink href={link.url} external icon={link.icon} magnetic dataAction={`social-${link.id}`}>
          {link.label}
        </ButtonLink>
        {link.verification.status === 'placeholder' ? (
          <span className="sr-only">Link pending owner confirmation.</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className={styles.wrap}>
      <Button
        icon={link.icon}
        badge="Soon"
        ariaExpanded={open}
        ariaControls={`${id}-note`}
        onClick={() => setOpen((o) => !o)}
        dataAction={`social-${link.id}-unavailable`}
      >
        {link.label}
      </Button>
      <span id={`${id}-note`} role="status" className={styles.note} hidden={!open}>
        {link.unavailableMessage}
      </span>
    </span>
  );
}

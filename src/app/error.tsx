'use client';

import { useEffect } from 'react';
import { PageHero } from '@/components/layout/PageHero';
import { Button, ButtonLink } from '@/components/ui/Button';
import { track } from '@/lib/analytics';

/** Route-level error boundary: keeps header/footer/navigation alive and offers recovery. */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    track('scene_error', { where: 'route', digest: error.digest ?? 'none' });
  }, [error]);
  return (
    <PageHero
      eyebrow="UNEXPECTED ERROR"
      title="Something went off course."
      lead="This page hit an error. You can retry, or continue exploring — the rest of the site is unaffected."
    >
      <Button variant="primary" icon="route" onClick={reset}>
        Try again
      </Button>
      <ButtonLink href="/" icon="compass">
        Home
      </ButtonLink>
    </PageHero>
  );
}

import type { Metadata } from 'next';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Lost in space',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <PageHero
      eyebrow="404 · SIGNAL LOST"
      title="This world isn't on the map."
      lead="The page you were looking for drifted out of orbit — or never existed. Every route below is real."
    >
      <ButtonLink href={routes.home} variant="primary" icon="compass" trailingIcon="arrow-right">
        Return to the universe
      </ButtonLink>
      <ButtonLink href={routes.projects} icon="layers">
        All projects
      </ButtonLink>
      <ButtonLink href={routes.contact} icon="send">
        Contact
      </ButtonLink>
    </PageHero>
  );
}

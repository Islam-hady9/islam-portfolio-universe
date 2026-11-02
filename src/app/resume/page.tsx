import type { Metadata } from 'next';
import { getContact } from '@/content';
import { resumeDocument } from '@/lib/resume';
import { PageHero } from '@/components/layout/PageHero';
import { ButtonLink } from '@/components/ui/Button';
import { StatusTag } from '@/components/ui/StatusTag';
import { routes } from '@/lib/routes';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Resume',
  description: 'Resume availability.',
  robots: { index: false, follow: true },
};

/**
 * /resume (spec §4.1, §10.2): a controlled, honest deferral — never a broken or fake file.
 * When an owner-verified resume is configured, this page offers it: Download saves the original
 * PDF; View opens it in the browser's own PDF viewer (the site's headers forbid framing, so there
 * is no embedded viewer and no PDF library).
 */
export default function ResumePage() {
  const { resume } = getContact();
  const doc = resumeDocument();
  const available = doc !== null;
  return (
    <>
      <PageHero
        eyebrow="RESUME"
        title={available ? 'Download the resume' : 'Resume coming soon'}
        lead={available ? 'The latest owner-approved resume.' : resume.unavailableMessage}
        aside={
          doc ? (
            <p className={styles.meta}>PDF · {doc.sizeLabel}</p>
          ) : (
            <StatusTag tone="pending">Available after profile review</StatusTag>
          )
        }
      >
        {doc ? (
          <>
            <ButtonLink
              href={doc.href}
              download={doc.fileName}
              variant="primary"
              icon="download"
              dataAction="resume-download"
            >
              Download resume
            </ButtonLink>
            <ButtonLink href={doc.href} external icon="file" dataAction="resume-view">
              View resume
            </ButtonLink>
          </>
        ) : null}
        <ButtonLink href={routes.projects} icon="layers">
          Explore projects
        </ButtonLink>
        <ButtonLink href={routes.about} icon="info">
          About &amp; journey
        </ButtonLink>
        <ButtonLink href={routes.contact} icon="send">
          Contact
        </ButtonLink>
      </PageHero>
      {!available ? (
        <section className={`container ${styles.section}`} aria-label="Why the resume is not available">
          <p className={styles.note}>
            The site is being finished before the final profile review. Rather than publishing an outdated or
            unverified document, the resume will appear here once the owner has approved it.
          </p>
        </section>
      ) : null}
    </>
  );
}

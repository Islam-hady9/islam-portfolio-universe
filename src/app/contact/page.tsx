import type { Metadata } from 'next';
import { getContact, getHomeCopy, getSocialLinks } from '@/content';
import { PageHero } from '@/components/layout/PageHero';
import { SocialAction } from '@/components/contact/SocialAction';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { routes } from '@/lib/routes';
import { resumeDocument } from '@/lib/resume';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Ways to get in touch about AI products, technical collaboration or new ideas.',
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: '/contact' } : undefined,
};

/**
 * Contact (spec §4.1): only owner-approved channels are live. No form is offered until a
 * real backend with spam mitigation exists; unconfigured channels say so plainly.
 */
export default function ContactPage() {
  const copy = getHomeCopy().contact;
  const contact = getContact();
  const social = getSocialLinks();
  const resume = resumeDocument();
  return (
    <>
      <PageHero eyebrow={copy.eyebrow} title={copy.title} lead={copy.body} />
      <section className={`container ${styles.section}`} aria-labelledby="channels-title">
        <h2 id="channels-title" className={styles.h2}>
          Channels
        </h2>
        <ul className={styles.channels}>
          <li className={styles.channel} data-testid="channel-email">
            <span className={styles.channelIcon} aria-hidden="true">
              <Icon name="mail" size={22} />
            </span>
            <div className={styles.channelBody}>
              <h3 className={styles.channelTitle}>Email</h3>
              {contact.email ? (
                <a className={styles.channelLink} href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ) : (
                <>
                  <p className={styles.muted}>{contact.unavailableMessage}</p>
                  <StatusTag tone="pending">Pending review</StatusTag>
                </>
              )}
            </div>
          </li>
          {social.map((s) => (
            <li key={s.id} className={styles.channel} data-testid={`channel-${s.id}`}>
              <span className={styles.channelIcon} aria-hidden="true">
                <Icon name={s.icon} size={22} />
              </span>
              <div className={styles.channelBody}>
                <h3 className={styles.channelTitle}>{s.label}</h3>
                {s.url ? (
                  <>
                    <p className={styles.muted}>
                      {s.verification.status === 'placeholder'
                        ? 'Profile link pending owner confirmation.'
                        : 'Public profile.'}
                    </p>
                    <SocialAction link={s} />
                  </>
                ) : (
                  <>
                    <p className={styles.muted}>{s.unavailableMessage}</p>
                    <StatusTag tone="pending">Pending review</StatusTag>
                  </>
                )}
              </div>
            </li>
          ))}
          <li className={styles.channel} data-testid="channel-resume">
            <span className={styles.channelIcon} aria-hidden="true">
              <Icon name="file" size={22} />
            </span>
            <div className={styles.channelBody}>
              <h3 className={styles.channelTitle}>Resume</h3>
              {resume ? (
                <>
                  <p className={styles.muted}>PDF · {resume.sizeLabel}</p>
                  <span className={styles.resumeActions}>
                    <ButtonLink
                      href={resume.href}
                      external
                      size="sm"
                      icon="file"
                      dataAction="contact-resume-view"
                    >
                      View resume
                    </ButtonLink>
                    <ButtonLink
                      href={resume.href}
                      download={resume.fileName}
                      size="sm"
                      icon="download"
                      dataAction="contact-resume-download"
                    >
                      Download
                    </ButtonLink>
                  </span>
                </>
              ) : (
                <>
                  <p className={styles.muted}>{contact.resume.unavailableMessage}</p>
                  <ButtonLink href={routes.resume} size="sm" icon="file" badge="Soon">
                    Resume status
                  </ButtonLink>
                </>
              )}
            </div>
          </li>
        </ul>

        <div className={styles.facts}>
          <p>
            <strong>Availability:</strong>{' '}
            <span className={styles.muted}>
              {contact.availability ?? 'To be confirmed after the profile review.'}
            </span>
          </p>
          <p>
            <strong>Location:</strong>{' '}
            <span className={styles.muted}>
              {contact.location ?? 'To be confirmed after the profile review.'}
            </span>
          </p>
          <p className={styles.muted}>
            There is intentionally no contact form yet: a form will only be added together with a real backend
            and spam protection.
          </p>
        </div>

        <div className={styles.ctas}>
          <ButtonLink href={routes.projects} icon="layers">
            Explore projects meanwhile
          </ButtonLink>
          <ButtonLink href="/#ask-ai" icon="sparkle">
            Try the assistant preview
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

import type { HomeCopy, SocialLink } from '@/content/schema';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { ButtonLink } from '@/components/ui/Button';
import { SocialAction } from '@/components/contact/SocialAction';
import { routes } from '@/lib/routes';
import { SceneArt } from './SceneArt';
import styles from './ContactSection.module.css';

/** S9 — The Invitation. Calm return to the cinematic universe: planet horizon on the right. */
export function ContactSection({ copy, social }: { copy: HomeCopy['contact']; social: SocialLink[] }) {
  const linkedin = social.find((s) => s.id === 'linkedin');
  const github = social.find((s) => s.id === 'github');
  return (
    <section id="contact" data-section="contact" className={styles.contact} aria-labelledby="contact-title">
      <SceneArt
        scene="horizon"
        label="A massive planet rises over a quiet mountain horizon, its atmosphere glowing mint and cyan."
        className={styles.art}
      />
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <Eyebrow>{copy.eyebrow}</Eyebrow>
          <h2 id="contact-title" className={styles.title} data-reveal="lines" tabIndex={-1}>
            {copy.title}
          </h2>
          <p className={styles.body} data-reveal="fade">
            {copy.body}
          </p>
          <div className={styles.actions} data-reveal="fade">
            <ButtonLink
              href={routes.contact}
              variant="primary"
              icon="send"
              trailingIcon="arrow-right"
              magnetic
              dataAction="contact-me"
            >
              Contact Me
            </ButtonLink>
            {linkedin ? <SocialAction link={linkedin} /> : null}
            {github ? <SocialAction link={github} /> : null}
            <ButtonLink href={routes.resume} icon="file" badge="Soon" magnetic dataAction="contact-resume">
              Resume
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

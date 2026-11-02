import type { ReactNode } from 'react';
import type { HomeCopy, SiteIdentity } from '@/content/schema';
import type { ResumeDocument } from '@/lib/resume';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { SceneArt } from './SceneArt';
import styles from './HeroSection.module.css';

/**
 * S1 — The Awakening. Real DOM copy over the persistent 3D world; the orbital core is
 * rendered by the shared canvas (right ~55%). Entrance is CSS-driven (no JS dependency,
 * fast LCP) and gated on html[data-motion='full'] / html[data-intro].
 */
export function HeroSection({
  site,
  copy,
  reel,
  resume,
}: {
  site: SiteIdentity;
  copy: HomeCopy['hero'];
  /** Optional intro-reel trigger: a quiet human entry point under the CTAs. */
  reel?: ReactNode;
  /** The verified résumé PDF; while null the CTA keeps its honest "Soon" deferral. */
  resume?: ResumeDocument | null;
}) {
  return (
    <section id="top" data-section="hero" className={styles.hero} aria-labelledby="hero-title">
      <SceneArt scene="hero" label={copy.artDescription} className={styles.art} />
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy} data-hero-copy="">
          <p className={styles.eyebrow} style={{ ['--d' as string]: 0 }}>
            <span>{site.portfolioIdentity}</span>
            <span className={styles.rule} aria-hidden="true" />
          </p>
          <h1 id="hero-title" className={styles.title} tabIndex={-1}>
            {site.headlineLines.map((line, i) => (
              <span key={line} className={styles.line}>
                <span className={styles.lineInner} style={{ ['--d' as string]: 90 + i * 110 }}>
                  {line}
                </span>
                {i < site.headlineLines.length - 1 ? ' ' : null}
              </span>
            ))}
          </h1>
          <p className={styles.role} style={{ ['--d' as string]: 360 }}>
            {site.roleLabel}
          </p>
          <p className={styles.lead} style={{ ['--d' as string]: 460 }}>
            {site.proposition}
          </p>
          <p className={styles.body} style={{ ['--d' as string]: 540 }}>
            {site.heroStatement}
          </p>
          <div className={styles.ctas}>
            <span className={styles.cta} style={{ ['--d' as string]: 680 }}>
              <ButtonLink
                href="#universe"
                variant="primary"
                icon="target"
                trailingIcon="arrow-right"
                magnetic
                dataAction="hero-explore"
              >
                {copy.ctaExplore}
              </ButtonLink>
            </span>
            <span className={styles.cta} style={{ ['--d' as string]: 750 }}>
              <ButtonLink href={routes.projects} icon="layers" magnetic dataAction="hero-projects">
                {copy.ctaProjects}
              </ButtonLink>
            </span>
            <span className={styles.cta} style={{ ['--d' as string]: 820 }}>
              {resume ? (
                <ButtonLink
                  href={resume.href}
                  download={resume.fileName}
                  icon="download"
                  magnetic
                  dataAction="hero-resume"
                >
                  {copy.ctaResume}
                  <span className="sr-only"> (PDF, {resume.sizeLabel})</span>
                </ButtonLink>
              ) : (
                <ButtonLink
                  href={routes.resume}
                  icon="download"
                  badge="Soon"
                  describedBy="hero-cv-note"
                  magnetic
                  dataAction="hero-resume"
                >
                  {copy.ctaResume}
                </ButtonLink>
              )}
            </span>
            <span className={styles.cta} style={{ ['--d' as string]: 890 }}>
              <ButtonLink href="#contact" icon="chat" magnetic dataAction="hero-talk">
                {copy.ctaTalk}
              </ButtonLink>
            </span>
          </div>
          {reel ? (
            <div className={styles.reel} style={{ ['--d' as string]: 980 }}>
              {reel}
            </div>
          ) : null}
          {resume ? null : (
            <p id="hero-cv-note" className="sr-only">
              {copy.ctaResumeDeferredNote}
            </p>
          )}
        </div>
      </div>
      <a href="#identity" className={styles.scrollCue} aria-label="Scroll to the next section">
        <span className={styles.scrollLabel}>Scroll</span>
        <span className={styles.scrollTrack} aria-hidden="true">
          <span className={styles.scrollDot} />
        </span>
      </a>
    </section>
  );
}

import type { Metadata } from 'next';
import {
  content,
  getAttributions,
  getCapabilities,
  getCareer,
  getContentMode,
  getHomeCopy,
  getMedia,
  getPrinciples,
  getProfileExtras,
  getSite,
} from '@/content';
import { collectUnverified } from '@/content/gate';
// Shared media components first, in the same order as on the home page, so both routes share
// one CSS order and the bundler can keep merging their stylesheets (no extra render-blocking chunk).
import { IntroReelHost } from '@/components/media/IntroReelHost';
import { IntroReelTrigger } from '@/components/media/IntroReelTrigger';
import { PersonalPortrait } from '@/components/media/PersonalPortrait';
import { PageHero } from '@/components/layout/PageHero';
import { IdentitySection } from '@/components/scenes/IdentitySection';
import { JourneySection } from '@/components/scenes/JourneySection';
import { PhilosophySection } from '@/components/scenes/PhilosophySection';
import { CapabilitiesSection } from '@/components/scenes/CapabilitiesSection';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatusTag } from '@/components/ui/StatusTag';
import { ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { formatDuration, reelAsset, reelView, spokenDuration } from '@/lib/media';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Journey, engineering philosophy and capabilities — plus how this portfolio handles unverified content.',
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: '/about' } : undefined,
};

const MODE_LABEL = {
  DEMO_CONTENT: 'Demo content',
  OWNER_REVIEW: 'Owner review',
  VERIFIED_PUBLIC: 'Verified & public',
} as const;

export default function AboutPage() {
  const site = getSite();
  const home = getHomeCopy();
  const extras = getProfileExtras();
  const mode = getContentMode();
  const pending = collectUnverified(content);
  const media = getMedia();
  const reel = reelAsset();
  const extraGroups: [string, typeof extras.education][] = [
    ['Education', extras.education],
    ['Research', extras.research],
    ['Achievements', extras.achievements],
  ];

  return (
    <>
      <PageHero
        eyebrow="ABOUT"
        title={site.name}
        lead={site.extendedStatement}
        aside={
          <PersonalPortrait
            variant="hero"
            priority
            className={styles.portrait}
            alt={media.portrait.alt}
            eyebrow={site.roleLabel}
            sizes="(max-width: 767px) 92vw, 27vw"
            action={
              <IntroReelTrigger
                variant="overlay"
                label={media.introReel.ctaLabel}
                duration={formatDuration(reel.duration)}
                spokenDuration={spokenDuration(reel.duration)}
                dataAction="about-reel"
              />
            }
          />
        }
      >
        <ButtonLink href={routes.projects} icon="layers">
          View projects
        </ButtonLink>
        <ButtonLink href={routes.contact} variant="primary" icon="send" trailingIcon="arrow-right">
          Get in touch
        </ButtonLink>
      </PageHero>

      <IdentitySection site={site} />
      <JourneySection copy={home.experience} career={getCareer()} />
      <PhilosophySection copy={home.philosophy} principles={getPrinciples()} />
      <CapabilitiesSection copy={home.capabilities} groups={getCapabilities()} />

      <section className={`container ${styles.section}`} aria-labelledby="profile-extras">
        <SectionHeading id="profile-extras" eyebrow="PROFILE" title="Education, research & achievements" />
        <div className={styles.extras}>
          {extraGroups.map(([label, items]) => (
            <div key={label} className={styles.card}>
              <h3 className={styles.cardTitle}>{label}</h3>
              {items.length ? (
                <ul className={styles.items}>
                  {items.map((it) => (
                    <li key={it.id}>
                      <strong>{it.title}</strong>
                      {it.organization ? <span> · {it.organization}</span> : null}
                      {it.period ? <span className={styles.muted}> · {it.period}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>
                  <StatusTag tone="pending">Pending review</StatusTag>
                </p>
              )}
            </div>
          ))}
        </div>
        <p className={styles.note}>{extras.pendingNotice}</p>
      </section>

      <section
        id="content-status"
        className={`container ${styles.section}`}
        aria-labelledby="content-status-title"
      >
        <SectionHeading
          id="content-status-title"
          eyebrow="CONTENT STATUS"
          title="What is real, and what is still a placeholder"
        />
        <div className={styles.status}>
          <dl className={styles.statusFacts}>
            <div>
              <dt>Publication mode</dt>
              <dd>{MODE_LABEL[mode]}</dd>
            </div>
            <div>
              <dt>Records pending verification</dt>
              <dd data-testid="pending-count">{pending.length}</dd>
            </div>
          </dl>
          <div className={styles.prose}>
            <p>
              This site is technically complete, but most portfolio content is intentionally{' '}
              <strong>sample or pending</strong> until the owner&apos;s CV and project materials are reviewed.
              Copy that came verbatim from the owner&apos;s brief is marked verified; everything drafted
              during engineering is marked as a placeholder and labelled in the interface (for example
              &ldquo;Sample journey&rdquo;, &ldquo;Details being prepared&rdquo; and &ldquo;Demo mode&rdquo;).
            </p>
            <p>
              No employers, dates, metrics, clients or testimonials are invented. While in preview, pages are
              marked
              <em> noindex</em>, and a publication gate refuses to build a public release while any
              placeholder remains.
            </p>
            <ol className={styles.steps}>
              <li>Owner provides CV, portfolio files and project materials.</li>
              <li>Structured content is proposed with a source for every claim.</li>
              <li>Open questions are listed — missing values are never manufactured.</li>
              <li>Owner verifies sensitive text, dates, metrics and media permissions.</li>
              <li>Verified records replace the fixtures; SEO and assistant knowledge update.</li>
              <li>Regression, accessibility and layout checks run before publishing.</li>
            </ol>
          </div>
        </div>
      </section>

      <section id="assistant" className={`container ${styles.section}`} aria-labelledby="assistant-title">
        <SectionHeading id="assistant-title" eyebrow="ASK MY AI" title="How the assistant preview works" />
        <div className={styles.prose}>
          <p>
            The assistant on the home page is a <strong>demo</strong>. It matches your question against a
            small set of pre-written entries composed from this site&apos;s content files and shows the
            records each answer came from. It does not use a language model, is not trained on a CV, and
            nothing you type leaves your browser.
          </p>
          <p>
            The interface already speaks the production contract (request, grounded answer, source references,
            safety policy). After the owner approves the knowledge base, a server-side provider can be
            connected with citations, refusal of unknown questions, rate limiting and spend controls — without
            redesigning the experience.
          </p>
        </div>
      </section>

      <section id="colophon" className={`container ${styles.section}`} aria-labelledby="colophon-title">
        <SectionHeading id="colophon-title" eyebrow="COLOPHON" title="Credits & asset provenance" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Origin</th>
                <th scope="col">Licence</th>
              </tr>
            </thead>
            <tbody>
              {getAttributions().map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.asset}
                    {a.notes ? <span className={styles.tableNote}>{a.notes}</span> : null}
                  </td>
                  <td>{a.origin.replace(/-/g, ' ')}</td>
                  <td>{a.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Built with Next.js, React, TypeScript, three.js / React Three Fiber and GSAP. All 3D is procedural
          and rendered in real time; there are no stock images or third-party models.
        </p>
      </section>
      <IntroReelHost reel={reelView(media.introReel)} />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCaseStudy, getProject, getProjects } from '@/content';
import { CaseStudyHero } from '@/components/case-study/CaseStudyHero';
import { SystemDiagram } from '@/components/case-study/SystemDiagram';
import { ProjectPortalCard } from '@/components/projects/ProjectPortalCard';
import { ButtonLink } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/SectionHeading';
import { StatusTag } from '@/components/ui/StatusTag';
import { routes } from '@/lib/routes';
import styles from './page.module.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: `${project.title} — ${project.tagline}`,
    description: project.summary,
    alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: routes.project(slug) } : undefined,
    openGraph: { title: `${project.title} — ${project.tagline}`, description: project.summary },
  };
}

/** Case study (spec §4.3, §11). Renders evidenced sections; groups the rest as "in preparation". */
export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  const cs = getCaseStudy(slug);
  if (!project || !cs) notFound();

  const all = getProjects();
  const idx = all.findIndex((p) => p.slug === slug);
  const next = all[(idx + 1) % all.length]!;
  const related = cs.related.map((r) => getProject(r)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  const pending: string[] = [];
  if (!cs.context) pending.push('Problem & context');
  if (!cs.workflow.length) pending.push('How it works');
  if (!cs.decisions.length) pending.push('Key engineering decisions');
  if (!cs.challenges.length) pending.push('Challenges & solutions');
  const ops = Object.entries(cs.operations).filter(([, v]) => v) as [string, string][];
  if (!ops.length) pending.push('Reliability & operations');
  if (!cs.outcomes.length) pending.push('Results (published only when evidenced)');

  const meta: [string, string | null][] = [
    ['Role', cs.role],
    ['Period', cs.period],
    ['Industry', cs.industry],
    ['Status', project.stage ?? (cs.publication === 'published' ? 'Published' : 'Case study in preparation')],
  ];

  return (
    <>
      <CaseStudyHero project={project} caseStudy={cs} />

      <div className={`container ${styles.layout}`}>
        <aside className={styles.meta} aria-label="Project facts">
          <dl>
            {meta.map(([k, v]) => (
              <div key={k} className={styles.metaRow}>
                <dt>{k}</dt>
                <dd>{v ?? <span className={styles.muted}>Details being prepared</span>}</dd>
              </div>
            ))}
            <div className={styles.metaRow}>
              <dt>Stack</dt>
              <dd>
                {cs.stack.length ? (
                  <ul className={styles.stack}>
                    {cs.stack.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <span className={styles.muted}>Details being prepared</span>
                )}
              </dd>
            </div>
          </dl>
        </aside>

        <article className={styles.article} aria-labelledby="cs-overview">
          <h2 id="cs-overview" className="sr-only">
            {project.title} case study
          </h2>

          {cs.context ? (
            <section className={styles.block} aria-labelledby="cs-context">
              <Eyebrow>PROBLEM &amp; CONTEXT</Eyebrow>
              <h3 id="cs-context" className={styles.blockTitle}>
                The challenge
              </h3>
              <p>{cs.context}</p>
            </section>
          ) : null}

          {cs.diagram ? (
            <section className={styles.block} aria-labelledby="cs-system">
              <Eyebrow>SYSTEM AT A GLANCE</Eyebrow>
              <h3 id="cs-system" className={styles.blockTitle}>
                Architecture
              </h3>
              <SystemDiagram diagram={cs.diagram} titleId="cs-diagram" />
            </section>
          ) : null}

          {cs.workflow.length ? (
            <section className={styles.block} aria-labelledby="cs-workflow">
              <Eyebrow>HOW IT WORKS</Eyebrow>
              <h3 id="cs-workflow" className={styles.blockTitle}>
                Input → processing → output
              </h3>
              <ol className={styles.steps}>
                {cs.workflow.map((w) => (
                  <li key={w.title}>
                    <strong>{w.title}</strong>
                    <p>{w.body}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {cs.decisions.length ? (
            <section className={styles.block} aria-labelledby="cs-decisions">
              <Eyebrow>KEY ENGINEERING DECISIONS</Eyebrow>
              <h3 id="cs-decisions" className={styles.blockTitle}>
                Trade-offs
              </h3>
              <ul className={styles.cards}>
                {cs.decisions.map((d) => (
                  <li key={d.title}>
                    <strong>{d.title}</strong>
                    <p>{d.choice}</p>
                    <p className={styles.muted}>Trade-off: {d.tradeoff}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {cs.challenges.length ? (
            <section className={styles.block} aria-labelledby="cs-challenges">
              <Eyebrow>CHALLENGES &amp; SOLUTIONS</Eyebrow>
              <h3 id="cs-challenges" className={styles.blockTitle}>
                What was hard
              </h3>
              <ul className={styles.cards}>
                {cs.challenges.map((c) => (
                  <li key={c.challenge}>
                    <strong>{c.challenge}</strong>
                    <p>{c.solution}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {ops.length ? (
            <section className={styles.block} aria-labelledby="cs-ops">
              <Eyebrow>RELIABILITY &amp; OPERATIONS</Eyebrow>
              <h3 id="cs-ops" className={styles.blockTitle}>
                Running it
              </h3>
              <dl className={styles.ops}>
                {ops.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {cs.outcomes.length ? (
            <section className={styles.block} aria-labelledby="cs-results">
              <Eyebrow>RESULTS</Eyebrow>
              <h3 id="cs-results" className={styles.blockTitle}>
                Evidenced outcomes
              </h3>
              <ul className={styles.cards}>
                {cs.outcomes.map((o) => (
                  <li key={o.label}>
                    <strong>{o.value}</strong>
                    <p>{o.label}</p>
                    <p className={styles.muted}>Evidence: {o.evidence}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {pending.length ? (
            <section className={styles.pending} aria-labelledby="cs-pending" data-testid="case-study-pending">
              <div className={styles.pendingHead}>
                <h3 id="cs-pending" className={styles.pendingTitle}>
                  In preparation
                </h3>
                <StatusTag tone="pending">Details being prepared</StatusTag>
              </div>
              <p className={styles.muted}>
                These parts of the case study will be published after content review. Nothing here is guessed
                or generated.
              </p>
              <ul className={styles.pendingList}>
                {pending.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {cs.lessons.length || cs.nextSteps.length ? (
            <section className={styles.block} aria-labelledby="cs-lessons">
              <Eyebrow>LESSONS &amp; NEXT STEPS</Eyebrow>
              <h3 id="cs-lessons" className={styles.blockTitle}>
                Looking back, looking ahead
              </h3>
              <ul className={styles.bullets}>
                {[...cs.lessons, ...cs.nextSteps].map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className={styles.ctas}>
            <ButtonLink href="/#projects" icon="compass" dataAction="cs-back-universe">
              Back to the universe
            </ButtonLink>
            <ButtonLink href={routes.projects} icon="layers" dataAction="cs-all-projects">
              All projects
            </ButtonLink>
            <ButtonLink
              href={routes.contact}
              variant="primary"
              icon="send"
              trailingIcon="arrow-right"
              dataAction="cs-contact"
            >
              Talk about a project
            </ButtonLink>
          </div>
        </article>
      </div>

      <section className={`container ${styles.next}`} aria-labelledby="cs-next">
        <div className={styles.nextHead}>
          <h2 id="cs-next" className={styles.nextTitle}>
            Next world
          </h2>
          <Link href={routes.project(next.slug)} className={styles.nextLink}>
            {next.title} →
          </Link>
        </div>
        {related.length ? (
          <ul className={styles.related} aria-label="Related projects">
            {related.map((r) => (
              <li key={r.slug}>
                <ProjectPortalCard project={r} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </>
  );
}

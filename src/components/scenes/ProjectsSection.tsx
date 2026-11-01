import type { HomeCopy, ProjectSummary } from '@/content/schema';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { ButtonLink } from '@/components/ui/Button';
import { ProjectPortalCard } from '@/components/projects/ProjectPortalCard';
import { routes } from '@/lib/routes';
import styles from './ProjectsSection.module.css';

/** S4 — Featured work as project portals. */
export function ProjectsSection({ copy, projects }: { copy: HomeCopy['projects']; projects: ProjectSummary[] }) {
  return (
    <section id="projects" data-section="projects" className={styles.projects} aria-labelledby="projects-title">
      <div className="container">
        <SectionHeading
          id="projects-title"
          eyebrow={copy.eyebrow}
          title={copy.title}
          action={
            <ButtonLink href={routes.projects} variant="ghost" trailingIcon="arrow-right" dataAction="view-all-projects">
              {copy.viewAll}
            </ButtonLink>
          }
        />
        <ul className={styles.grid} data-reveal="stagger">
          {projects.map((p) => (
            <li key={p.slug} data-reveal-item="">
              <ProjectPortalCard project={p} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

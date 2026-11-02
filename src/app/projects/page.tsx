import type { Metadata } from 'next';
import { getProjects } from '@/content';
import { PageHero } from '@/components/layout/PageHero';
import { ProjectsExplorer } from '@/components/projects/ProjectsExplorer';
import { ButtonLink } from '@/components/ui/Button';
import { StatusTag } from '@/components/ui/StatusTag';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Project worlds from the Intelligence Universe — case studies in preparation.',
  alternates: process.env.NEXT_PUBLIC_SITE_URL ? { canonical: '/projects' } : undefined,
};

export default function ProjectsPage() {
  const projects = getProjects();
  return (
    <>
      <PageHero
        eyebrow="PROJECTS"
        title="Worlds from the Intelligence Universe"
        lead="Each project is its own world — open one to explore its case study. Detailed case studies are being prepared and will be published after content review."
        aside={<StatusTag tone="pending">Case studies in preparation</StatusTag>}
      >
        <ButtonLink href="/#universe" icon="compass" dataAction="projects-back-universe">
          Back to the universe
        </ButtonLink>
      </PageHero>
      <section className={`container ${styles.section}`} aria-label="All projects">
        <ProjectsExplorer projects={projects} />
      </section>
    </>
  );
}

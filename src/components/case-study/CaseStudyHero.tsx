'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { CaseStudy, ProjectSummary } from '@/content/schema';
import { StatusTag } from '@/components/ui/StatusTag';
import { ProjectPoster } from '@/components/projects/ProjectPoster';
import { registerPortalTrack } from '@/experience/portals/portal-registry';
import { routes } from '@/lib/routes';
import styles from './CaseStudyHero.module.css';

/**
 * Case-study hero: the project's world fills the masthead — the same live mini-world the
 * portal card expanded into, so the transition reads as entering it (spec §11). Works as a
 * plain page on refresh, back/forward, and without WebGL (poster).
 */
export function CaseStudyHero({ project, caseStudy }: { project: ProjectSummary; caseStudy: CaseStudy }) {
  const artRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = artRef.current;
    if (!el) return;
    return registerPortalTrack({ slug: project.slug, world: project.world, el, kind: 'hero' });
  }, [project.slug, project.world]);

  return (
    <header className={styles.hero} data-accent={project.accent} data-case-study-hero={project.slug}>
      <div ref={artRef} className={styles.art} data-portal-track={project.slug}>
        <ProjectPoster world={project.world} alt={project.posterAlt} priority variant="hero" />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <nav aria-label="Breadcrumb" className={styles.crumbs}>
          <ol>
            <li>
              <Link href="/#projects">Universe</Link>
            </li>
            <li>
              <Link href={routes.projects}>Projects</Link>
            </li>
            <li aria-current="page">{project.title}</li>
          </ol>
        </nav>
        <p className={styles.category}>{project.categoryLabel}</p>
        <h1 className={styles.title} tabIndex={-1}>
          {project.title}
        </h1>
        <p className={styles.tagline}>{project.tagline}</p>
        <p className={styles.pitch}>{caseStudy.pitch}</p>
        <div className={styles.tags}>
          {project.stage ? <StatusTag tone="concept">{project.stage}</StatusTag> : null}
          {caseStudy.publication === 'in_preparation' ? (
            <StatusTag tone="pending">Detailed case study coming after content review</StatusTag>
          ) : null}
        </div>
      </div>
    </header>
  );
}

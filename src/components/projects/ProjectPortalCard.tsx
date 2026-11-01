'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { ProjectSummary } from '@/content/schema';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { routes } from '@/lib/routes';
import { track } from '@/lib/analytics';
import { useExperience } from '@/state/experience-store';
import { hasPortalTransition, requestPortalTransition } from '@/experience/orchestrator/transitions';
import { registerPortalTrack, setPortalHover } from '@/experience/portals/portal-registry';
import { ProjectPoster } from './ProjectPoster';
import styles from './ProjectPortalCard.module.css';

/**
 * A project "portal" (spec S4). The whole card is one link (stretched-link pattern) whose
 * accessible name is the project title. On capable devices, hover/focus wakes the live 3D
 * mini-world behind the transparent media window and clicking expands it into the case
 * study; the route is always a plain link underneath (refresh, new-tab, no-JS all work).
 */
export function ProjectPortalCard({
  project,
  headingLevel = 'h3',
  priority = false,
}: {
  project: ProjectSummary;
  headingLevel?: 'h2' | 'h3';
  priority?: boolean;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const href = routes.project(project.slug);
  const Heading = headingLevel;

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    return registerPortalTrack({ slug: project.slug, el, kind: 'card' });
  }, [project.slug]);

  const setPointer = (e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card || e.pointerType !== 'mouse') return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    card.style.setProperty('--px', (x * 2 - 1).toFixed(3));
    card.style.setProperty('--py', (y * 2 - 1).toFixed(3));
    setPortalHover(project.slug, { x: x * 2 - 1, y: y * 2 - 1 });
  };

  const engage = () => {
    cardRef.current?.setAttribute('data-engaged', '');
    setPortalHover(project.slug, { x: 0, y: 0 });
  };
  const release = () => {
    const card = cardRef.current;
    if (!card) return;
    card.removeAttribute('data-engaged');
    card.style.setProperty('--px', '0');
    card.style.setProperty('--py', '0');
    setPortalHover(project.slug, null);
  };

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    track('project_open', { slug: project.slug });
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const s = useExperience.getState();
    const media = mediaRef.current;
    if (!media || s.reducedMotion || s.webgl !== 'ready' || !hasPortalTransition()) return;
    e.preventDefault();
    requestPortalTransition(project.slug, media, () => router.push(href));
  };

  return (
    <article
      ref={cardRef}
      className={styles.card}
      data-world={project.world}
      data-accent={project.accent}
      data-project-card={project.slug}
      onPointerMove={setPointer}
      onPointerEnter={engage}
      onPointerLeave={release}
      onFocus={engage}
      onBlur={release}
    >
      <div ref={mediaRef} className={styles.media} data-portal-track={project.slug}>
        <ProjectPoster world={project.world} alt={project.posterAlt} priority={priority} />
      </div>
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.top}>
        <span className={styles.category}>{project.categoryLabel}</span>
        {project.stage ? <StatusTag tone="concept">{project.stage}</StatusTag> : null}
      </div>
      <div className={styles.body}>
        <Heading className={styles.title}>
          <Link href={href} className={styles.link} onClick={onClick} data-action="project-card">
            {project.title}
          </Link>
        </Heading>
        <p className={styles.tagline}>{project.tagline}</p>
        <p className={styles.summary}>{project.summary}</p>
      </div>
      <span className={styles.arrow} aria-hidden="true">
        <Icon name="arrow-up-right" size={16} />
      </span>
    </article>
  );
}

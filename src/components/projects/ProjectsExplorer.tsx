'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ProjectSummary } from '@/content/schema';
import { Icon } from '@/components/ui/Icon';
import { StatusTag } from '@/components/ui/StatusTag';
import { routes } from '@/lib/routes';
import { ProjectPortalCard } from './ProjectPortalCard';
import styles from './ProjectsExplorer.module.css';

type View = 'grid' | 'list';

/** /projects: accessible filter (toggle buttons) + grid/list views (spec §4.1). */
export function ProjectsExplorer({ projects }: { projects: ProjectSummary[] }) {
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of projects) if (!seen.has(p.category)) seen.set(p.category, p.categoryLabel);
    return [...seen.entries()];
  }, [projects]);
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<View>('grid');
  const visible = filter === 'all' ? projects : projects.filter((p) => p.category === filter);

  return (
    <div>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Filter projects by category" className={styles.filters}>
          <button
            type="button"
            className={styles.filter}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All <span className={styles.count}>{projects.length}</span>
          </button>
          {categories.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={styles.filter}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Layout" className={styles.views}>
          <button
            type="button"
            className={styles.view}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={styles.view}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            List
          </button>
        </div>
      </div>

      <p className={styles.result} role="status">
        Showing {visible.length} of {projects.length} projects
        {filter !== 'all' ? ` · ${categories.find(([k]) => k === filter)?.[1] ?? ''}` : ''}
      </p>

      {view === 'grid' ? (
        <ul className={styles.grid}>
          {visible.map((p, i) => (
            <li key={p.slug}>
              <ProjectPortalCard project={p} headingLevel="h2" priority={i < 2} />
            </li>
          ))}
        </ul>
      ) : (
        <ol className={styles.list}>
          {visible.map((p) => (
            <li key={p.slug} className={styles.row}>
              <span className={styles.rowCategory}>{p.categoryLabel}</span>
              <h2 className={styles.rowTitle}>
                <Link href={routes.project(p.slug)} className={styles.rowLink}>
                  {p.title}
                </Link>
              </h2>
              <p className={styles.rowTagline}>{p.tagline}</p>
              <p className={styles.rowSummary}>{p.summary}</p>
              <span className={styles.rowMeta}>
                {p.stage ? <StatusTag tone="concept">{p.stage}</StatusTag> : null}
                <StatusTag tone="pending">Case study in preparation</StatusTag>
              </span>
              <Icon name="arrow-up-right" size={18} className={styles.rowArrow} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

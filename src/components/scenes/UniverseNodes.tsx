'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import type { UniverseNode } from '@/content/schema';
import { Icon } from '@/components/ui/Icon';
import { useExperience } from '@/state/experience-store';
import { homeAnchorOf } from '@/lib/routes';
import { travelToSection } from '@/lib/scroll';
import { UNIVERSE_LAYOUT } from '@/experience/universe-layout';
import { requestNodeApproach } from '@/experience/orchestrator/transitions';
import { track } from '@/lib/analytics';
import styles from './UniverseNodes.module.css';

/**
 * The six universe destinations. Each is a real link (works without JS/WebGL). With live 3D
 * the WebGL layer pins them to projected node positions (data-mode="live"); selecting one
 * plays a short camera approach before travelling (spec S3, §6.6).
 */
export function UniverseNodes({ nodes }: { nodes: UniverseNode[] }) {
  const router = useRouter();
  const listRef = useRef<HTMLUListElement>(null);
  const setHovered = useExperience((s) => s.setHoveredNode);
  const hovered = useExperience((s) => s.hoveredNode);

  const navigate = useCallback(
    (node: UniverseNode) => {
      if (node.focus) useExperience.getState().setFocusCapability(node.focus);
      const anchor = homeAnchorOf(node.href);
      if (anchor && window.location.pathname === '/') travelToSection(anchor);
      else router.push(node.href);
    },
    [router],
  );

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, node: UniverseNode) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    track('universe_node_select', { node: node.id });
    const s = useExperience.getState();
    const live = listRef.current?.dataset.mode === 'live';
    if (live && !s.reducedMotion && s.webgl === 'ready') {
      requestNodeApproach(node.id, () => navigate(node));
    } else {
      navigate(node);
    }
  };

  // Keyboard focus on a live (fixed-position) node brings its section into view first.
  const onFocus = (id: string) => {
    setHovered(id);
    const list = listRef.current;
    if (list?.dataset.mode !== 'live') return;
    const section = document.getElementById('universe');
    if (!section) return;
    const r = section.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.35 || r.bottom < window.innerHeight * 0.65) {
      travelToSection('universe', { updateHash: false, focus: false });
    }
  };

  useEffect(() => () => setHovered(null), [setHovered]);

  return (
    <nav aria-label="Universe destinations" className={styles.nav}>
      <ul ref={listRef} className={styles.list} data-universe-nodes="" data-mode="static">
        {nodes.map((n) => {
          const layout = UNIVERSE_LAYOUT[n.id];
          return (
            <li
              key={n.id}
              className={styles.node}
              data-node={n.id}
              data-placement={layout.placement}
              data-accent={n.accent}
              data-hovered={hovered === n.id || undefined}
              style={{ ['--x' as string]: `${layout.staticPos[0]}%`, ['--y' as string]: `${layout.staticPos[1]}%` }}
            >
              <span className={styles.marker} aria-hidden="true" />
              <a
                href={n.href}
                className={styles.pill}
                onClick={(e) => onClick(e, n)}
                onPointerEnter={() => setHovered(n.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => onFocus(n.id)}
                onBlur={() => setHovered(null)}
                data-action="universe-node"
                data-own-nav=""
              >
                <span className={styles.labelRow}>
                  <Icon name={n.icon} size={17} className={styles.icon} />
                  <span className={styles.label}>{n.label}</span>
                  <Icon name="arrow-up-right" size={14} className={styles.go} />
                </span>
                <span className={styles.teaser}>{n.teaser}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

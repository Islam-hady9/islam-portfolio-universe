import type { SystemDiagram as Diagram } from '@/content/schema';
import { StatusTag } from '@/components/ui/StatusTag';
import styles from './SystemDiagram.module.css';

const LANE_ORDER = ['input', 'data', 'intelligence', 'product', 'operations'] as const;
const LANE_LABEL: Record<(typeof LANE_ORDER)[number], string> = {
  input: 'Inputs',
  data: 'Data',
  intelligence: 'Intelligence',
  product: 'Product',
  operations: 'Operations',
};

const W = 1000;
const H = 260;
const NODE_W = 160;
const NODE_H = 76;

/**
 * Data-driven system diagram (spec §4.3: editable vector/HTML, not a screenshot) with a
 * legend and an equivalent text description. Illustrative diagrams are labelled as such.
 */
export function SystemDiagram({ diagram, titleId }: { diagram: Diagram; titleId: string }) {
  const lanes = LANE_ORDER.filter((l) => diagram.nodes.some((n) => n.lane === l));
  const colW = W / lanes.length;
  const pos = new Map<string, { x: number; y: number }>();
  diagram.nodes.forEach((n) => {
    const col = lanes.indexOf(n.lane);
    const sameLane = diagram.nodes.filter((m) => m.lane === n.lane);
    const k = sameLane.indexOf(n);
    const y = 92 + (k - (sameLane.length - 1) / 2) * (NODE_H + 18);
    pos.set(n.id, { x: colW * col + colW / 2, y });
  });
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));

  return (
    <figure className={`${styles.figure} glass glass--flat glass--cyan`} aria-labelledby={titleId}>
      <div className={styles.head}>
        {diagram.kind === 'illustrative' ? <StatusTag tone="pending">Illustrative template</StatusTag> : null}
        <ul className={styles.legend} aria-label="Legend">
          {lanes.map((l) => (
            <li key={l} data-lane={l}>
              <span className={styles.swatch} aria-hidden="true" />
              {LANE_LABEL[l]}
            </li>
          ))}
        </ul>
      </div>

      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${titleId}-svg`}>
        <title id={`${titleId}-svg`}>{diagram.caption}</title>
        <defs>
          <marker
            id={`${titleId}-arrow`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 10 5 0 10z" className={styles.arrowHead} />
          </marker>
        </defs>
        {diagram.edges.map((e) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          const forward = b.x > a.x;
          const d = forward
            ? `M ${a.x + NODE_W / 2} ${a.y} C ${a.x + NODE_W / 2 + 40} ${a.y}, ${b.x - NODE_W / 2 - 40} ${b.y}, ${b.x - NODE_W / 2 - 4} ${b.y}`
            : `M ${a.x} ${a.y + NODE_H / 2} C ${a.x} ${H - 8}, ${b.x} ${H - 8}, ${b.x} ${b.y + NODE_H / 2 + 4}`;
          const lx = forward ? (a.x + b.x) / 2 : (a.x + b.x) / 2;
          const ly = forward ? (a.y + b.y) / 2 - 10 : H - 18;
          return (
            <g key={`${e.from}-${e.to}`} className={forward ? styles.edge : styles.edgeBack}>
              <path d={d} markerEnd={`url(#${titleId}-arrow)`} />
              {e.label ? (
                <text x={lx} y={ly} textAnchor="middle" className={styles.edgeLabel}>
                  {e.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {diagram.nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <g
              key={n.id}
              className={styles.node}
              data-lane={n.lane}
              transform={`translate(${p.x - NODE_W / 2} ${p.y - NODE_H / 2})`}
            >
              <rect width={NODE_W} height={NODE_H} rx="14" />
              <text x={NODE_W / 2} y={32} textAnchor="middle" className={styles.nodeLabel}>
                {n.label}
              </text>
              {n.detail ? (
                <text x={NODE_W / 2} y={52} textAnchor="middle" className={styles.nodeDetail}>
                  {n.detail.length > 26 ? `${n.detail.slice(0, 25)}…` : n.detail}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <details className={styles.text} open>
        <summary>Diagram as text</summary>
        <ol>
          {diagram.edges.map((e) => (
            <li key={`${e.from}-${e.to}`}>
              <strong>{byId.get(e.from)?.label}</strong> → <strong>{byId.get(e.to)?.label}</strong>
              {e.label ? ` (${e.label})` : ''}
            </li>
          ))}
        </ol>
        <ul className={styles.nodeList}>
          {diagram.nodes.map((n) => (
            <li key={n.id}>
              <strong>{n.label}</strong>
              {n.detail ? ` — ${n.detail}` : ''}
            </li>
          ))}
        </ul>
      </details>
      <figcaption className={styles.caption}>{diagram.caption}</figcaption>
    </figure>
  );
}

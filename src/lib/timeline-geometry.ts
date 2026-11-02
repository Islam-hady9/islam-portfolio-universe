/**
 * Pure geometry for the journey arc (unit-tested). The arc rises gently from left to right
 * and flattens, like a horizon line; milestones sit on it at equal spacing.
 */

export const ARC = { width: 1000, height: 140, baseY: 112, amplitude: 70 } as const;

/** Normalised x (0..1) → arc lift in viewBox units (0..amplitude). Smooth ease-out rise. */
export function arcLift(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const eased = 1 - Math.pow(1 - c, 2.2);
  return ARC.amplitude * eased;
}

export function milestoneXs(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 0.5) / count);
}

/** SVG path through the milestone points, extended to both edges, Catmull-Rom → cubic Bézier. */
export function arcPath(count: number): string {
  const xs = [0, ...milestoneXs(count), 1];
  const pts = xs.map((t) => [t * ARC.width, ARC.baseY - arcLift(t)] as const);
  let d = `M ${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** Scroll progress of a section through the viewport, 0 when entering, 1 when its end passes 60%. */
export function sectionProgress(rectTop: number, rectHeight: number, viewportH: number): number {
  const start = viewportH * 0.85;
  const end = viewportH * 0.6 - rectHeight;
  const p = (start - rectTop) / (start - end);
  return Math.min(1, Math.max(0, p));
}

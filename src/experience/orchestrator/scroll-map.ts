/**
 * Scroll → path parameter mapping (pure; unit-tested).
 *
 * Each home section is a "station". Its anchor is the scroll position at which the section is
 * centred in the viewport (clamped to the scrollable range). Between consecutive anchors the
 * path parameter s moves from i to i+1 with a dwell curve, so the camera rests while a section
 * is being read and travels between sections. Direction-independent and scrubbable.
 */

export interface SectionBox {
  top: number;
  height: number;
}

export function computeAnchors(sections: SectionBox[], viewportH: number, maxScroll: number): number[] {
  const raw = sections.map((s, i) => {
    if (i === 0) return 0;
    const centred = s.top + s.height / 2 - viewportH / 2;
    return Math.min(maxScroll, Math.max(0, centred));
  });
  if (raw.length) raw[raw.length - 1] = Math.max(raw[raw.length - 1]!, Math.min(maxScroll, raw[raw.length - 1]!));
  // Enforce strictly increasing anchors (degenerate layouts, e.g. very tall viewports).
  for (let i = 1; i < raw.length; i++) {
    if (raw[i]! <= raw[i - 1]!) raw[i] = raw[i - 1]! + 1;
  }
  return raw;
}

/** Dwell curve: flat near both ends (rest at stations), steepest midway. */
export function dwell(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  // smootherstep has zero 1st and 2nd derivatives at the ends
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function scrollToParam(scrollY: number, anchors: number[]): number {
  const n = anchors.length;
  if (n === 0) return 0;
  if (scrollY <= anchors[0]!) return 0;
  if (scrollY >= anchors[n - 1]!) return n - 1;
  let i = 0;
  while (i < n - 2 && scrollY >= anchors[i + 1]!) i++;
  const a = anchors[i]!;
  const b = anchors[i + 1]!;
  const local = (scrollY - a) / Math.max(1, b - a);
  return i + dwell(local);
}

/** Signed local offset of the viewport relative to a station anchor, in viewport heights. */
export function localOffset(scrollY: number, anchor: number, viewportH: number): number {
  return Math.max(-1, Math.min(1, (scrollY - anchor) / Math.max(1, viewportH)));
}

/** Presence of station i at parameter s: 1 when centred, fading to 0 one station away. */
export function presence(s: number, i: number, width = 1): number {
  return Math.max(0, 1 - Math.abs(s - i) / width);
}

/** Frame-rate independent exponential damping toward a target. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

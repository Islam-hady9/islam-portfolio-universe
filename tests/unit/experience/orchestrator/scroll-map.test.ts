import { describe, expect, it } from 'vitest';
import {
  computeAnchors,
  damp,
  dwell,
  localOffset,
  presence,
  scrollToParam,
  type SectionBox,
} from '@/experience/orchestrator/scroll-map';

const isStrictlyIncreasing = (xs: number[]) => xs.every((x, i) => i === 0 || x > xs[i - 1]!);

describe('computeAnchors', () => {
  // Five sections in a 4800px document with a 900px viewport → maxScroll 3900.
  const sections: SectionBox[] = [
    { top: 0, height: 900 },
    { top: 900, height: 1000 },
    { top: 1900, height: 1200 },
    { top: 3100, height: 900 },
    { top: 4000, height: 800 },
  ];

  it('centres each section in the viewport, pins the first to 0 and clamps the last to maxScroll', () => {
    expect(computeAnchors(sections, 900, 3900)).toEqual([0, 950, 2050, 3100, 3900]);
  });

  it('pins the first anchor to 0 even when the first section starts lower', () => {
    expect(computeAnchors([{ top: 500, height: 2000 }, ...sections.slice(1)], 900, 3900)[0]).toBe(0);
  });

  it('keeps anchors inside [0, maxScroll] for a normal layout', () => {
    const anchors = computeAnchors(sections, 900, 3900);
    for (const a of anchors) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(3900);
    }
    expect(isStrictlyIncreasing(anchors)).toBe(true);
  });

  it('stays strictly increasing for degenerate layouts (collapsed or missing sections)', () => {
    const collapsed = Array.from({ length: 6 }, () => ({ top: 0, height: 0 }));
    const anchors = computeAnchors(collapsed, 900, 0);
    expect(anchors).toEqual([0, 1, 2, 3, 4, 5]);
    expect(isStrictlyIncreasing(anchors)).toBe(true);
  });

  it('nudges anchors that clamp to the same value apart by at most a pixel per station', () => {
    const tall = [
      { top: 0, height: 600 },
      { top: 600, height: 600 },
      { top: 1200, height: 200 },
      { top: 1400, height: 200 },
    ];
    const maxScroll = 1600 - 1400; // a very tall viewport: document 1600px, viewport 1400px
    const anchors = computeAnchors(tall, 1400, maxScroll);
    expect(isStrictlyIncreasing(anchors)).toBe(true);
    anchors.forEach((a, i) => expect(a).toBeLessThanOrEqual(maxScroll + i));
  });

  it('handles empty and single-section input', () => {
    expect(computeAnchors([], 900, 1000)).toEqual([]);
    expect(computeAnchors([{ top: 100, height: 100 }], 900, 1000)).toEqual([0]);
  });

  it('reaches the final station at max scroll when trailing sections both clamp to maxScroll', () => {
    const anchors = computeAnchors(
      [
        { top: 0, height: 800 },
        { top: 800, height: 800 },
        { top: 1600, height: 800 },
        { top: 2400, height: 300 },
        { top: 2700, height: 200 },
      ],
      1000,
      1900,
    );
    expect(scrollToParam(1900, anchors)).toBe(anchors.length - 1);
    for (let i = 1; i < anchors.length; i++) expect(anchors[i]!).toBeGreaterThan(anchors[i - 1]!);
    expect(Math.max(...anchors)).toBeLessThanOrEqual(1900);
  });
});

describe('dwell', () => {
  it('maps the ends and the midpoint exactly', () => {
    expect(dwell(0)).toBe(0);
    expect(dwell(1)).toBe(1);
    expect(dwell(0.5)).toBeCloseTo(0.5, 12);
  });

  it('clamps input outside [0, 1]', () => {
    expect(dwell(-2)).toBe(0);
    expect(dwell(3)).toBe(1);
  });

  it('is monotonic and symmetric', () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1.0000001; t += 0.01) {
      const y = dwell(t);
      expect(y).toBeGreaterThanOrEqual(prev);
      expect(dwell(1 - t)).toBeCloseTo(1 - y, 12);
      prev = y;
    }
  });

  it('is flat near both stations (camera rests while a section is read)', () => {
    expect(dwell(0.05)).toBeLessThan(0.01);
    expect(1 - dwell(0.95)).toBeLessThan(0.01);
    // steepest in the middle
    expect(dwell(0.55) - dwell(0.45)).toBeGreaterThan(dwell(0.1) - dwell(0));
  });
});

describe('scrollToParam', () => {
  const anchors = [0, 1000, 2500, 4000];

  it('returns 0 at or above the first anchor', () => {
    expect(scrollToParam(-200, anchors)).toBe(0);
    expect(scrollToParam(0, anchors)).toBe(0);
  });

  it('returns the station index exactly at each anchor', () => {
    anchors.forEach((a, i) => expect(scrollToParam(a, anchors)).toBe(i));
  });

  it('clamps to the last station beyond the last anchor', () => {
    expect(scrollToParam(9999, anchors)).toBe(anchors.length - 1);
  });

  it('is halfway between stations at the midpoint of two anchors', () => {
    expect(scrollToParam(500, anchors)).toBeCloseTo(0.5, 12);
    expect(scrollToParam(1750, anchors)).toBeCloseTo(1.5, 12);
    expect(scrollToParam(3250, anchors)).toBeCloseTo(2.5, 12);
  });

  it('is monotonic and continuous over a full scroll sweep', () => {
    let prev = scrollToParam(-100, anchors);
    for (let y = -100; y <= 4100; y += 5) {
      const s = scrollToParam(y, anchors);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s - prev).toBeLessThan(0.02);
      prev = s;
    }
  });

  it('handles empty and single-anchor input', () => {
    expect(scrollToParam(500, [])).toBe(0);
    expect(scrollToParam(500, [0])).toBe(0);
  });
});

describe('localOffset', () => {
  it('is the signed offset from the anchor in viewport heights', () => {
    expect(localOffset(1450, 1000, 900)).toBeCloseTo(0.5, 12);
    expect(localOffset(550, 1000, 900)).toBeCloseTo(-0.5, 12);
    expect(localOffset(1000, 1000, 900)).toBe(0);
  });

  it('clamps to [-1, 1]', () => {
    expect(localOffset(0, 5000, 900)).toBe(-1);
    expect(localOffset(9000, 1000, 900)).toBe(1);
  });

  it('guards against a zero-height viewport', () => {
    expect(localOffset(1000.5, 1000, 0)).toBeCloseTo(0.5, 12);
  });
});

describe('presence', () => {
  it('is 1 at the station and fades linearly to 0 one station away', () => {
    expect(presence(2, 2)).toBe(1);
    expect(presence(2.5, 2)).toBeCloseTo(0.5, 12);
    expect(presence(1.5, 2)).toBeCloseTo(0.5, 12);
    expect(presence(3, 2)).toBe(0);
    expect(presence(7, 2)).toBe(0);
  });

  it('widens with the width parameter', () => {
    expect(presence(3, 2, 2)).toBeCloseTo(0.5, 12);
    expect(presence(4, 2, 2)).toBe(0);
  });
});

describe('damp', () => {
  it('returns the current value for a zero timestep and the target in the limit', () => {
    expect(damp(10, 0, 4, 0)).toBe(10);
    expect(damp(10, 0, 4, 1000)).toBeCloseTo(0, 12);
  });

  it('converges monotonically without overshooting', () => {
    let x = 0;
    for (let i = 0; i < 600; i++) {
      const next = damp(x, 1, 3.1, 1 / 60);
      expect(next).toBeGreaterThan(x);
      expect(next).toBeLessThanOrEqual(1);
      x = next;
    }
    expect(x).toBeCloseTo(1, 6);
  });

  it('is frame-rate independent: two half steps equal one full step', () => {
    const dt = 1 / 30;
    const once = damp(3, 11, 3.1, dt);
    const twice = damp(damp(3, 11, 3.1, dt / 2), 11, 3.1, dt / 2);
    expect(twice).toBeCloseTo(once, 12);
  });

  it('reaches the same value after one second at 30 Hz and 144 Hz', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 30; i++) a = damp(a, 5, 2, 1 / 30);
    for (let i = 0; i < 144; i++) b = damp(b, 5, 2, 1 / 144);
    expect(a).toBeCloseTo(b, 9);
  });
});

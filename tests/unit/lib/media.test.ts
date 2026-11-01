import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import {
  captionsPath,
  formatDuration,
  portraitAsset,
  reelAsset,
  reelView,
  spokenDuration,
} from '@/lib/media';

const onDisk = (url: string) => join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
const candidates = (srcSet: string) =>
  srcSet.split(',').map((c) => {
    const [url, w] = c.trim().split(/\s+/);
    return { url: url!, width: Number(w!.replace(/w$/, '')) };
  });

describe('duration labels', () => {
  it.each([
    [0, '0:00', '0 seconds'],
    [1, '0:01', '1 second'],
    [35, '0:35', '35 seconds'],
    [60, '1:00', '1 minute'],
    [62.4, '1:02', '1 minute 2 seconds'],
    [3727, '1:02:07', '62 minutes 7 seconds'],
  ])('%s s → %s / %s', (s, short, spoken) => {
    expect(formatDuration(s)).toBe(short);
    expect(spokenDuration(s)).toBe(spoken);
  });
});

describe('portrait manifest (scripts/media/process-media.py output)', () => {
  const p = portraitAsset();

  it('offers AVIF then WebP candidates and a JPEG fallback', () => {
    expect(p.sources.map((s) => s.type)).toEqual(['image/avif', 'image/webp']);
    expect(p.fallback.src).toMatch(/\.jpg$/);
  });

  it('points every candidate at an existing file, ascending and never upscaled', () => {
    for (const set of [...p.sources.map((s) => s.srcSet), p.fallback.srcSet]) {
      const list = candidates(set);
      expect(list.length).toBeGreaterThan(1);
      list.forEach((c, i) => {
        expect(existsSync(onDisk(c.url)), c.url).toBe(true);
        expect(c.width).toBeLessThanOrEqual(p.width);
        if (i) expect(c.width).toBeGreaterThan(list[i - 1]!.width);
      });
    }
  });

  it('keeps the photograph within its byte budget', () => {
    const avif = candidates(p.sources[0]!.srcSet);
    const largest = avif[avif.length - 1]!;
    expect(statSync(onDisk(largest.url)).size).toBeLessThan(70 * 1024);
    // The phone-sized candidate is what most visitors download.
    expect(statSync(onDisk(avif[1]!.url)).size).toBeLessThan(35 * 1024);
  });

  it('inlines only a tiny placeholder', () => {
    expect(p.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(p.placeholder.length).toBeLessThan(1200);
  });
});

describe('intro reel manifest', () => {
  const r = reelAsset();

  it('is a vertical 9:16 film with audio', () => {
    expect(r.width / r.height).toBeCloseTo(9 / 16, 3);
    expect(r.hasAudio).toBe(true);
    expect(r.duration).toBeGreaterThan(5);
  });

  it('lists H.264/AAC MP4 sources with RFC 6381 codecs; only the last is unconditional', () => {
    expect(r.sources.length).toBeGreaterThanOrEqual(1);
    for (const s of r.sources) {
      expect(s.type).toMatch(/^video\/mp4; codecs="avc1\.[0-9a-f]{6}, mp4a\.40\.2"$/);
      expect(existsSync(onDisk(s.src)), s.src).toBe(true);
      expect(statSync(onDisk(s.src)).size).toBe(s.bytes);
    }
    const last = r.sources[r.sources.length - 1]!;
    expect(last.media).toBeUndefined();
    for (const s of r.sources.slice(0, -1)) expect(s.media).toBeTruthy();
  });

  it('keeps the default (phone) variant and the poster light', () => {
    const fallback = r.sources[r.sources.length - 1]!;
    expect(fallback.bytes).toBeLessThan(4 * 1024 * 1024);
    expect(statSync(onDisk(r.poster.src)).size).toBeLessThan(30 * 1024);
    expect(statSync(onDisk(r.poster.small)).size).toBeLessThan(15 * 1024);
    for (const src of [r.poster.fallback, r.thumbnail.src]) expect(existsSync(onDisk(src)), src).toBe(true);
  });

  it('has caption cues that end before the film does', () => {
    const cues = content.media.introReel.transcript.cues;
    expect(cues[cues.length - 1]!.end).toBeLessThanOrEqual(r.duration);
    for (const v of content.media.introReel.transcript.visuals) expect(v.at).toBeLessThan(r.duration);
  });
});

describe('reelView', () => {
  it('shows the generative-AI disclosure only while the reel is flagged as AI-generated', () => {
    const copy = content.media.introReel;
    expect(reelView(copy).disclosure).toBe(copy.provenance.aiGenerated ? copy.provenance.label : null);
    const notAi = { ...copy, provenance: { ...copy.provenance, aiGenerated: false } };
    expect(reelView(notAi).disclosure).toBeNull();
  });

  it('points the captions track at the static WebVTT route', () => {
    expect(reelView(content.media.introReel).captions).toBe(captionsPath('en'));
    expect(captionsPath('en')).toBe('/media/captions/intro-reel.en.vtt');
  });
});

import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { buildWebVtt, vttTimestamp } from '@/lib/vtt';
import { GET, generateStaticParams } from '@/app/media/captions/[track]/route';

describe('vttTimestamp', () => {
  it.each([
    [0, '00:00:00.000'],
    [0.5, '00:00:00.500'],
    [13.1, '00:00:13.100'],
    [61.0004, '00:01:01.000'],
    [3725.25, '01:02:05.250'],
    [-3, '00:00:00.000'],
  ])('%s → %s', (s, ts) => expect(vttTimestamp(s)).toBe(ts));
});

describe('buildWebVtt', () => {
  it('numbers cues and separates them with blank lines', () => {
    const vtt = buildWebVtt([
      { start: 0.5, end: 2, text: 'One' },
      { start: 2.5, end: 4, text: 'Two' },
    ]);
    expect(vtt).toBe(
      'WEBVTT\n\n1\n00:00:00.500 --> 00:00:02.000\nOne\n\n2\n00:00:02.500 --> 00:00:04.000\nTwo\n',
    );
  });

  it('escapes cue markup characters and never emits an arrow inside a payload', () => {
    const vtt = buildWebVtt([{ start: 0, end: 1, text: 'A <b> & B --> C' }]);
    expect(vtt).toContain('A &lt;b&gt; &amp; B --&gt; C');
    expect(vtt.split('\n').filter((l) => l.includes('-->'))).toHaveLength(1);
  });
});

describe('captions route (/media/captions/[track])', () => {
  const cues = content.media.introReel.transcript.cues;
  const track = `intro-reel.${content.media.introReel.language}.vtt`;

  it('prerenders exactly the reel track', () => {
    expect(generateStaticParams()).toEqual([{ track }]);
  });

  it('serves the transcript cues as WebVTT', async () => {
    const res = await GET(new Request('http://x/'), { params: Promise.resolve({ track }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/vtt; charset=utf-8');
    const body = await res.text();
    expect(body.startsWith('WEBVTT\n')).toBe(true);
    expect(body.match(/-->/g)).toHaveLength(cues.length);
    for (const c of cues) expect(body).toContain(c.text.replace(/&/g, '&amp;'));
  });

  it('404s any other track name', async () => {
    const res = await GET(new Request('http://x/'), { params: Promise.resolve({ track: 'other.vtt' }) });
    expect(res.status).toBe(404);
  });
});

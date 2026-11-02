import { describe, expect, it } from 'vitest';
import { content } from '@/content';
import { collectUnverified } from '@/content/gate';
import { mediaContentSchema } from '@/content/schema';

const media = content.media;

describe('media content contract', () => {
  it('validates the shipped media copy', () => {
    expect(mediaContentSchema.safeParse(media).success).toBe(true);
  });

  it('rejects caption cues that overlap or end before they start', () => {
    const overlap = structuredClone(media);
    overlap.introReel.transcript.cues = [
      { start: 0, end: 3, text: 'a' },
      { start: 2, end: 4, text: 'b' },
    ];
    expect(mediaContentSchema.safeParse(overlap).success).toBe(false);
    const inverted = structuredClone(media);
    inverted.introReel.transcript.cues = [{ start: 3, end: 1, text: 'a' }];
    expect(mediaContentSchema.safeParse(inverted).success).toBe(false);
  });

  it('rejects an empty or perfunctory portrait description', () => {
    const bad = structuredClone(media);
    bad.portrait.alt = 'photo';
    expect(mediaContentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('media honesty rules', () => {
  it('describes the portrait without making claims (names the owner, not a role or achievement)', () => {
    expect(media.portrait.alt).toContain(content.site.name);
    expect(media.portrait.alt.toLowerCase()).not.toContain(content.site.roleLabel.toLowerCase());
    expect(media.portrait.alt).not.toMatch(/award|expert|leading|best|senior|lead\b/i);
  });

  it('carries a disclosure label whenever the reel is flagged as AI-generated', () => {
    if (media.introReel.provenance.aiGenerated) {
      expect(media.introReel.provenance.label.trim().length).toBeGreaterThan(10);
    }
  });

  it('keeps unconfirmed transcript and provenance wording behind the publication gate', () => {
    const paths = collectUnverified(content).map((r) => r.path);
    if (media.introReel.transcript.verification.status === 'placeholder')
      expect(paths).toContain('content.media.introReel.transcript');
    if (media.introReel.provenance.verification.status === 'placeholder')
      expect(paths).toContain('content.media.introReel.provenance');
    // The owner supplied both files: the media records themselves are not placeholders.
    expect(paths).not.toContain('content.media.portrait');
    expect(paths).not.toContain('content.media.introReel');
  });
});

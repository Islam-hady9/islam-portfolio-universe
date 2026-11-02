/**
 * Factual-safety rules for the shipped content (spec §4.2 / §10): placeholder records never
 * make factual claims, concepts are labelled as concepts, and nothing about the owner is invented.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { content, getCaseStudy, getProject } from '@/content';

const isPlaceholder = (r: { verification: { status: string } }) => r.verification.status === 'placeholder';

describe('career', () => {
  it('never states an organisation or period on a placeholder entry', () => {
    for (const entry of content.career.entries.filter(isPlaceholder)) {
      expect(entry.organization, `${entry.id}.organization`).toBeNull();
      expect(entry.period, `${entry.id}.period`).toBeNull();
    }
  });

  it('carries a sample notice while any entry is a placeholder', () => {
    if (content.career.entries.some(isPlaceholder)) {
      expect(content.career.sampleNotice.trim().length).toBeGreaterThan(0);
    }
  });

  it('marks at most one entry as current', () => {
    expect(content.career.entries.filter((e) => e.current).length).toBeLessThanOrEqual(1);
  });
});

describe('LifeAtlas', () => {
  const lifeatlas = getProject('lifeatlas');

  it('exists and is labelled as a concept', () => {
    expect(lifeatlas).not.toBeNull();
    expect(lifeatlas!.stage).toMatch(/concept/i);
  });

  it('is never described as a health product', () => {
    const texts = [
      lifeatlas!.summary,
      lifeatlas!.tagline,
      lifeatlas!.categoryLabel,
      lifeatlas!.posterAlt,
      getCaseStudy('lifeatlas')?.pitch ?? '',
      getCaseStudy('lifeatlas')?.industry ?? '',
      ...content.assistant.entries.filter((e) => e.subject === 'lifeatlas').map((e) => e.answer),
    ];
    for (const text of texts) expect(text).not.toMatch(/health/i);
  });
});

describe('case studies', () => {
  it('cite non-empty evidence for every outcome (or claim no outcomes)', () => {
    for (const cs of content.caseStudies) {
      for (const outcome of cs.outcomes) {
        expect(outcome.evidence.trim().length, `${cs.slug} outcome "${outcome.label}"`).toBeGreaterThan(0);
      }
    }
  });

  it('do not assert a role or period while they are placeholders', () => {
    for (const cs of content.caseStudies.filter(isPlaceholder)) {
      expect(cs.role, `${cs.slug}.role`).toBeNull();
      expect(cs.period, `${cs.slug}.period`).toBeNull();
    }
  });

  it('label illustrative diagrams as illustrative', () => {
    for (const cs of content.caseStudies) {
      if (cs.diagram?.kind === 'illustrative') expect(cs.diagram.caption).toMatch(/illustrative/i);
    }
  });
});

describe('contact and resume', () => {
  it('publishes either no email or a valid one', () => {
    const { email } = content.contact;
    if (email !== null) expect(z.email().safeParse(email).success).toBe(true);
  });

  it('does not publish an email while the contact record is a placeholder', () => {
    if (isPlaceholder(content.contact)) expect(content.contact.email).toBeNull();
  });

  it('does not link a resume file while the resume record is a placeholder', () => {
    if (isPlaceholder(content.contact.resume)) expect(content.contact.resume.url).toBeNull();
  });
});

describe('social links', () => {
  it('invent no profile URL: an unverified link may only carry the repository-derived GitHub URL, flagged with a note', () => {
    for (const link of content.social) {
      if (link.url === null || !isPlaceholder(link)) continue;
      expect(link.id, `unverified ${link.id} must not carry a URL`).toBe('github');
      expect(link.verification.note?.trim(), 'GitHub URL needs a confirmation note').toBeTruthy();
    }
  });

  it('publishes the GitHub profile only as a flagged placeholder or as an owner-verified, sourced link', () => {
    const github = content.social.find((s) => s.id === 'github');
    if (!github?.url) return;
    expect(new URL(github.url).hostname).toBe('github.com');
    if (isPlaceholder(github)) expect(github.verification.note?.trim()).toBeTruthy();
    else expect(github.verification.source).toMatch(/CV|owner/i);
  });

  it('explains every missing link', () => {
    for (const link of content.social.filter((s) => s.url === null)) {
      expect(link.unavailableMessage.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('phone number', () => {
  it('is never published: no tel: link or number in any rendered content file', () => {
    const { verifiedLinks, ...rendered } = content;
    const text = JSON.stringify(rendered);
    expect(text).not.toMatch(/tel:/i);
    const digits = verifiedLinks.phone?.href.replace(/\D/g, '').slice(-9);
    if (digits) expect(text.replace(/\D/g, ' ')).not.toContain(digits);
  });

  it('stays out of the site until the owner authorises showing it', () => {
    expect(content.verifiedLinks.phone?.publicDisplay ?? false).toBe(false);
  });
});

describe('verified links registry', () => {
  it('never assigns a repository to a different project', () => {
    for (const r of content.verifiedLinks.repositories) {
      if (r.matchedProject === null) continue;
      const project = content.projects.find((p) => p.slug === r.matchedProject);
      expect(project, r.id).toBeDefined();
      expect(r.title.toLowerCase()).toContain(project!.title.toLowerCase());
    }
  });
});

describe('profile extras', () => {
  it('lists only verified education, research and achievements', () => {
    const { education, research, achievements } = content.profileExtras;
    for (const item of [...education, ...research, ...achievements])
      expect(isPlaceholder(item), item.id).toBe(false);
  });
});

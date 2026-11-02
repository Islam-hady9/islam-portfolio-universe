import { describe, expect, it } from 'vitest';
import { detectLanguage, normalizeText, tokenize, variants } from '@/lib/portfolio-ai/retrieval/normalize';
import { matchConcepts, prepare, techTerms } from '@/lib/portfolio-ai/retrieval/concepts';
import { canonicalHref, findUrls, isAllowedHref, stripDisallowedUrls } from '@/lib/portfolio-ai/shared/links';
import { findPhoneNumbers, containsSecret } from '@/lib/portfolio-ai/shared/pii';
import type { LinkTarget } from '@/lib/portfolio-ai/shared/types';

const concepts = (q: string) => matchConcepts(prepare(tokenize(q)));

describe('normalizeText — Arabic (PIE §6)', () => {
  it('unifies alef/hamza, ya and ta marbuta variants', () => {
    expect(normalizeText('أإآٱ')).toBe('اااا');
    expect(normalizeText('مستشفى')).toBe('مستشفي');
    expect(normalizeText('خبرة')).toBe('خبره');
    expect(normalizeText('مسؤول')).toBe('مسوول');
  });

  it('removes diacritics and tatweel', () => {
    expect(normalizeText('مُهَنْدِس')).toBe('مهندس');
    expect(normalizeText('مـــشـاريع')).toBe('مشاريع');
  });

  it('converts Arabic-Indic digits', () => {
    expect(normalizeText('٢٠٢٦')).toBe('2026');
  });

  it('splits words that switch script', () => {
    expect(tokenize('اشتغل بـDocker')).toEqual(['اشتغل', 'ب', 'docker']);
  });
});

describe('normalizeText — identifiers', () => {
  it('keeps Next.js, Node.js, C++, C# and .NET intact', () => {
    expect(tokenize('Next.js and Node.js')).toEqual(['nextjs', 'and', 'nodejs']);
    expect(tokenize('C++ or C# or .NET')).toEqual(['cpp', 'or', 'csharp', 'or', 'dotnet']);
  });

  it('keeps project names as single tokens', () => {
    expect(tokenize('TIBYN, MOViD and ATS')).toEqual(['tibyn', 'movid', 'and', 'ats']);
  });

  it('collapses punctuation runs and whitespace', () => {
    expect(normalizeText('  what???   is   this!!! ')).toBe('what??? is this!!!');
    expect(tokenize('what???   is   this!!!')).toEqual(['what', 'is', 'this']);
  });
});

describe('detectLanguage', () => {
  it('detects Arabic, English and English-dominant mixed questions', () => {
    expect(detectLanguage('إسلام بيشتغل في إيه؟')).toBe('ar');
    expect(detectLanguage('What does Islam work on?')).toBe('en');
    expect(detectLanguage('Is he experienced in الـ agent orchestration?')).toBe('en');
    expect(detectLanguage('اشتغل بـ Docker؟')).toBe('ar');
  });
});

describe('variants', () => {
  it('handles English plurals and Arabic clitics', () => {
    expect(variants('projects')).toContain('project');
    expect(variants('technologies')).toContain('technology');
    expect(variants('مشاريعه')).toContain('مشاريع');
    expect(variants('والمشاريع')).toContain('مشاريع');
    expect(variants('خبرته')).toContain('خبره');
  });
});

describe('concept bridge (EN ↔ AR)', () => {
  it('maps colloquial Arabic onto the same concepts as English', () => {
    expect(concepts('وريني مشاريعه').has('projectsNoun')).toBe(true);
    expect(concepts('Which projects can I explore?').has('projectsNoun')).toBe(true);
    expect(concepts('إيه مهاراته؟').has('stack')).toBe(true);
    expect(concepts('خبرته إيه؟').has('experience')).toBe(true);
    expect(concepts('مرتب إسلام كام؟').has('compensation')).toBe(true);
    expect(concepts('فين السيرة الذاتية؟').has('resume')).toBe(true);
  });

  it('does not treat an email address question as a home-address request', () => {
    expect(concepts("What's his email address?").has('personal')).toBe(false);
  });

  it('extracts the most specific technology terms', () => {
    expect(techTerms(prepare(tokenize('Is he experienced in agent orchestration?')))).toEqual([
      'agent orchestration',
    ]);
    expect(techTerms(prepare(tokenize('Does he use Next.js?')))).toEqual(['nextjs']);
  });
});

describe('link allowlist and output sanitizing', () => {
  const links: LinkTarget[] = [
    { id: 'route-projects', label: 'Projects', href: '/projects', kind: 'route' },
    {
      id: 'profile-linkedin',
      label: 'LinkedIn',
      href: 'https://linkedin.com/in/someone-123',
      kind: 'external',
    },
    { id: 'contact-email', label: 'a@b.co', href: 'mailto:a@b.co', kind: 'mailto' },
  ];

  it('canonicalizes equivalent profile URLs', () => {
    expect(canonicalHref('https://www.LinkedIn.com/in/someone-123/')).toBe(
      'https://linkedin.com/in/someone-123',
    );
    expect(isAllowedHref('https://www.linkedin.com/in/someone-123/', links)).toBe(true);
    expect(isAllowedHref('https://linkedin.com/in/someone-else', links)).toBe(false);
    expect(isAllowedHref('javascript:alert(1)', links)).toBe(false);
  });

  it('finds and strips URLs and emails that are not allowlisted', () => {
    const text =
      'Mail a@b.co or evil@x.io, see https://evil.example.com/x and https://linkedin.com/in/someone-123.';
    expect(findUrls(text, links).map((u) => u.allowed)).toEqual([true, false, false, true]);
    const { text: clean, removed } = stripDisallowedUrls(text, links);
    expect(removed).toEqual(['evil@x.io', 'https://evil.example.com/x']);
    expect(clean).toContain('a@b.co');
    expect(clean).not.toContain('evil');
  });
});

describe('private-data detectors', () => {
  it('flags phone numbers but not years, versions or profile URLs', () => {
    expect(findPhoneNumbers('call +20 100 123 4567')).toHaveLength(1);
    expect(findPhoneNumbers('01001234567')).toHaveLength(1);
    expect(findPhoneNumbers('2019 – 2023')).toHaveLength(0);
    expect(findPhoneNumbers('version 1.2.3')).toHaveLength(0);
    expect(findPhoneNumbers('https://linkedin.com/in/name-323523211')).toHaveLength(0);
  });

  it('flags credential-shaped strings', () => {
    expect(containsSecret('key sk-abcdefghijklmnopqrstuv')).toBe(true);
    expect(containsSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    expect(containsSecret('a normal sentence')).toBe(false);
  });
});

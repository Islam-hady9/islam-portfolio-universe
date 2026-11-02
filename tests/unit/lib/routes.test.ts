import { describe, expect, it } from 'vitest';
import { internalHrefSchema } from '@/content/schema';
import { FOOTER_NAV, PRIMARY_NAV, SECTION_IDS, activeNavId, homeAnchorOf, routes } from '@/lib/routes';

describe('routes', () => {
  it('builds project and anchor routes', () => {
    expect(routes.project('tibyn')).toBe('/projects/tibyn');
    expect(routes.project('ats-matching')).toBe('/projects/ats-matching');
    expect(routes.anchor('top')).toBe('/');
    expect(routes.anchor('contact')).toBe('/#contact');
  });

  it('only produces valid internal hrefs for navigation', () => {
    for (const item of FOOTER_NAV)
      expect(internalHrefSchema.safeParse(item.href).success, item.href).toBe(true);
    for (const id of SECTION_IDS) expect(internalHrefSchema.safeParse(routes.anchor(id)).success).toBe(true);
  });

  it('extends the primary nav with contact and resume in the footer', () => {
    expect(FOOTER_NAV.slice(0, PRIMARY_NAV.length)).toEqual(PRIMARY_NAV);
    expect(FOOTER_NAV.map((n) => n.id)).toEqual([...PRIMARY_NAV.map((n) => n.id), 'contact', 'resume']);
  });
});

describe('activeNavId', () => {
  it('maps home sections to nav items via scroll-spy', () => {
    expect(activeNavId('/', 'experience')).toBe('experience');
    expect(activeNavId('/', 'capabilities')).toBe('stack');
  });

  it('falls back to home for other or no sections on the home page', () => {
    expect(activeNavId('/', null)).toBe('home');
    expect(activeNavId('/', 'top')).toBe('home');
    expect(activeNavId('/', 'projects')).toBe('home');
    expect(activeNavId('/', 'contact')).toBe('home');
  });

  it('matches route prefixes on inner pages', () => {
    expect(activeNavId('/projects', null)).toBe('projects');
    expect(activeNavId('/projects/x', null)).toBe('projects');
    expect(activeNavId('/projects/tibyn', 'experience')).toBe('projects');
    expect(activeNavId('/about', null)).toBe('about');
  });

  it('does not treat a shared string prefix as a route prefix', () => {
    expect(activeNavId('/projectsx', null)).toBeNull();
    expect(activeNavId('/about-me', null)).toBeNull();
  });

  it('returns null for pages outside the primary nav', () => {
    expect(activeNavId('/contact', null)).toBeNull();
    expect(activeNavId('/resume', null)).toBeNull();
  });
});

describe('homeAnchorOf', () => {
  it.each([
    ['#experience', 'experience'],
    ['/#experience', 'experience'],
    ['/#ask-ai', 'ask-ai'],
  ])('extracts the anchor from %s', (href, id) => {
    expect(homeAnchorOf(href)).toBe(id);
  });

  it.each(['/projects', '/', '/about#assistant', '#', 'https://example.com/#x'])(
    'returns null for %s',
    (href) => {
      expect(homeAnchorOf(href)).toBeNull();
    },
  );
});

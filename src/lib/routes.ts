/** Central route + anchor map (spec §4.1). Components never hand-write these strings. */

export const SECTION_IDS = [
  'top',
  'identity',
  'universe',
  'projects',
  'philosophy',
  'capabilities',
  'experience',
  'ask-ai',
  'contact',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const routes = {
  home: '/',
  projects: '/projects',
  project: (slug: string) => `/projects/${slug}`,
  about: '/about',
  contact: '/contact',
  resume: '/resume',
  anchor: (id: SectionId) => (id === 'top' ? '/' : `/#${id}`),
} as const;

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /** Home sections that mark this item active while in view (scroll-spy). */
  sections?: SectionId[];
  /** Path prefixes that mark this item active. */
  paths?: string[];
}

export const PRIMARY_NAV: NavItem[] = [
  { id: 'home', label: 'Home', href: routes.home },
  { id: 'projects', label: 'Projects', href: routes.projects, paths: ['/projects'] },
  { id: 'experience', label: 'Experience', href: routes.anchor('experience'), sections: ['experience'] },
  { id: 'stack', label: 'Stack', href: routes.anchor('capabilities'), sections: ['capabilities'] },
  { id: 'about', label: 'About', href: routes.about, paths: ['/about'] },
];

export const FOOTER_NAV: NavItem[] = [
  ...PRIMARY_NAV,
  { id: 'contact', label: 'Contact', href: routes.contact, paths: ['/contact'] },
  { id: 'resume', label: 'Resume', href: routes.resume, paths: ['/resume'] },
];

/** Which nav item is active for a pathname + (home) active section. */
export function activeNavId(pathname: string, activeSection: SectionId | null): string | null {
  if (pathname === '/') {
    const bySection = PRIMARY_NAV.find((n) => activeSection && n.sections?.includes(activeSection));
    return bySection ? bySection.id : 'home';
  }
  const byPath = PRIMARY_NAV.find((n) =>
    n.paths?.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  );
  return byPath ? byPath.id : null;
}

/** Splits "/#experience" or "#experience" into its home-anchor id, or null for route links. */
export function homeAnchorOf(href: string): string | null {
  const m = /^\/?#([a-z0-9-]+)$/i.exec(href);
  return m ? (m[1] ?? null) : null;
}

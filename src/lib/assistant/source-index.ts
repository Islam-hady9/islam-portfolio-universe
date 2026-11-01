import type { Content } from '@/content';
import { routes } from '@/lib/routes';
import type { SourceIndex } from './contracts';

/** Builds the label/link index for assistant citations from content (server-side). */
export function buildSourceIndex(c: Pick<Content, 'projects' | 'capabilities' | 'contact' | 'career'>): SourceIndex {
  const index: SourceIndex = {};
  for (const p of c.projects) {
    index[`project:${p.slug}`] = { label: p.title, href: routes.project(p.slug), verification: p.verification.status };
    index[`case-study:${p.slug}`] = {
      label: `${p.title} case study`,
      href: routes.project(p.slug),
      verification: 'placeholder',
    };
  }
  for (const g of c.capabilities) {
    index[`capability:${g.id}`] = { label: g.title, href: '/#capabilities', verification: g.verification.status };
  }
  index['career:sample-journey'] = { label: 'Experience journey (sample)', href: '/#experience', verification: 'placeholder' };
  index['contact:contact-config'] = { label: 'Contact status', href: routes.contact, verification: c.contact.verification.status };
  index['site:philosophy'] = { label: 'Engineering philosophy', href: '/#philosophy', verification: 'placeholder' };
  index['knowledge:assistant-architecture'] = {
    label: 'How this preview works',
    href: '/about#assistant',
    verification: 'placeholder',
  };
  return index;
}

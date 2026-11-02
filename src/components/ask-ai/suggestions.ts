/**
 * Context-aware suggested questions (AI Presence V1). Only questions that Smart Mode answers
 * from approved public knowledge — "answered", or an honest "partial" that still cites a
 * source (e.g. a project page whose details await verification). Enforced for every route by
 * tests/unit/portfolio-ai/suggestions.test.ts; nothing here adds facts to the knowledge base.
 */
export interface SuggestionProject {
  slug: string;
  title: string;
}

export type SuggestionMap = Record<string, string[]>;

export const HOME_SUGGESTIONS = [
  'What does Islam work on?',
  'Which projects can I explore?',
  'How can I contact him?',
  'How does this assistant work?',
];

/** The hero's discovery chips (short, grounded, third person like every answer). */
export const HERO_SUGGESTIONS = [
  'What does Islam build?',
  'Does he work on AI?',
  'Which projects can I explore?',
];

export function buildSuggestionMap(projects: SuggestionProject[]): SuggestionMap {
  const first = projects[0];
  return {
    '/': HOME_SUGGESTIONS,
    '/projects': [
      'Which projects can I explore?',
      ...(first ? [`Tell me about ${first.title}`] : []),
      'What does Islam build?',
      'How can I contact him?',
    ],
    ...Object.fromEntries(
      projects.map((p) => [
        `/projects/${p.slug}`,
        [
          `Tell me about ${p.title}`,
          'Which projects can I explore?',
          'What does Islam work on?',
          'How can I contact him?',
        ],
      ]),
    ),
    '/about': [
      'Who is Islam Abd-Elhady?',
      'Can I see his CV?',
      'Is there an introduction video?',
      'How can I contact him?',
    ],
    '/contact': [
      'How can I contact him?',
      'Is he on LinkedIn?',
      'Can I see his CV?',
      'How does this assistant work?',
    ],
    '/resume': ['Can I see his CV?', 'What does Islam work on?', 'How can I contact him?'],
  };
}

export function suggestionsFor(map: SuggestionMap | undefined, pathname: string | null): string[] {
  const path = (pathname ?? '/').replace(/\/+$/, '') || '/';
  return map?.[path] ?? map?.['/'] ?? HOME_SUGGESTIONS;
}

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectsExplorer } from '@/components/projects/ProjectsExplorer';
import { getProjects } from '@/content';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/projects',
}));

const projects = getProjects();
const categories = [...new Map(projects.map((p) => [p.category, p.categoryLabel])).entries()];

function setup() {
  const user = userEvent.setup();
  render(<ProjectsExplorer projects={projects} />);
  const filters = screen.getByRole('group', { name: 'Filter projects by category' });
  const layout = screen.getByRole('group', { name: 'Layout' });
  return {
    user,
    allButton: within(filters).getByRole('button', { name: /^All/ }),
    filterButton: (label: string) => within(filters).getByRole('button', { name: label }),
    gridButton: within(layout).getByRole('button', { name: 'Grid' }),
    listButton: within(layout).getByRole('button', { name: 'List' }),
  };
}

const projectLinks = () =>
  screen
    .queryAllByRole('link')
    .filter((a) => a.getAttribute('href')?.startsWith('/projects/'))
    .map((a) => a.getAttribute('href'));

describe('ProjectsExplorer', () => {
  it('fixtures: several projects across several categories', () => {
    expect(projects.length).toBeGreaterThan(1);
    expect(categories.length).toBeGreaterThan(1);
  });

  it('starts on "All" in grid view and shows every project', () => {
    const { allButton, gridButton, listButton } = setup();
    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(allButton).toHaveTextContent(String(projects.length));
    expect(gridButton).toHaveAttribute('aria-pressed', 'true');
    expect(listButton).toHaveAttribute('aria-pressed', 'false');
    for (const p of projects) {
      expect(screen.getByRole('link', { name: p.title })).toHaveAttribute('href', `/projects/${p.slug}`);
      expect(screen.getByRole('heading', { level: 2, name: p.title })).toBeInTheDocument();
    }
    expect(screen.getByRole('status')).toHaveTextContent(
      `Showing ${projects.length} of ${projects.length} projects`,
    );
  });

  it('offers one filter per category, none pressed initially', () => {
    const { filterButton } = setup();
    for (const [, label] of categories) expect(filterButton(label)).toHaveAttribute('aria-pressed', 'false');
  });

  it.each(categories)('filters to the "%s" category and announces the count', async (category, label) => {
    const { user, allButton, filterButton } = setup();
    await user.click(filterButton(label));

    const expected = projects.filter((p) => p.category === category);
    expect(filterButton(label)).toHaveAttribute('aria-pressed', 'true');
    expect(allButton).toHaveAttribute('aria-pressed', 'false');
    expect(projectLinks()).toEqual(expected.map((p) => `/projects/${p.slug}`));
    for (const p of projects.filter((x) => x.category !== category)) {
      expect(screen.queryByRole('link', { name: p.title })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('status')).toHaveTextContent(
      `Showing ${expected.length} of ${projects.length} projects · ${label}`,
    );
  });

  it('restores every project when "All" is pressed again', async () => {
    const { user, allButton, filterButton } = setup();
    await user.click(filterButton(categories[0]![1]));
    await user.click(allButton);
    expect(allButton).toHaveAttribute('aria-pressed', 'true');
    expect(projectLinks()).toHaveLength(projects.length);
    expect(screen.getByRole('status')).toHaveTextContent(
      `Showing ${projects.length} of ${projects.length} projects`,
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('·');
  });

  it('switches to a list of links to each case study', async () => {
    const { user, gridButton, listButton } = setup();
    await user.click(listButton);
    expect(listButton).toHaveAttribute('aria-pressed', 'true');
    expect(gridButton).toHaveAttribute('aria-pressed', 'false');

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(projects.length);
    projects.forEach((p, i) => {
      const row = rows[i]!;
      expect(within(row).getByRole('link', { name: p.title })).toHaveAttribute('href', `/projects/${p.slug}`);
      expect(row).toHaveTextContent(p.tagline);
      expect(row).toHaveTextContent('Case study in preparation');
      if (p.stage) expect(row).toHaveTextContent(p.stage);
    });
  });

  it('keeps the active filter when switching views', async () => {
    const { user, filterButton, listButton, gridButton } = setup();
    const [category, label] = categories[categories.length - 1]!;
    await user.click(filterButton(label));
    await user.click(listButton);
    const expected = projects.filter((p) => p.category === category).map((p) => `/projects/${p.slug}`);
    expect(projectLinks()).toEqual(expected);
    await user.click(gridButton);
    expect(projectLinks()).toEqual(expected);
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JourneyTimeline } from '@/components/scenes/JourneyTimeline';
import { getCareer } from '@/content';
import type { CareerEntry } from '@/content/schema';
import { useExperience } from '@/state/experience-store';

const entries = getCareer().entries;
const currentIndex = entries.findIndex((e) => e.current);
const PATH_LENGTH = 1000;

// jsdom does not implement SVG geometry; the progress path only needs its length.
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    configurable: true,
    value: () => PATH_LENGTH,
  });
});
afterAll(() => {
  delete (SVGElement.prototype as { getTotalLength?: unknown }).getTotalLength;
});
beforeEach(() => {
  useExperience.setState({ reducedMotion: true });
});

const milestones = () => screen.getAllByRole('button');
const pressed = () => milestones().findIndex((b) => b.getAttribute('aria-pressed') === 'true');
const detail = () => document.getElementById(milestones()[0]!.getAttribute('aria-controls')!)!;
const indexLabel = (i: number) => `Milestone ${String(i + 1).padStart(2, '0')} · ${entries[i]!.phase}`;

describe('JourneyTimeline', () => {
  it('fixtures: the career has a current entry and placeholder entries', () => {
    expect(currentIndex).toBeGreaterThanOrEqual(0);
    expect(entries.some((e) => e.verification.status === 'placeholder')).toBe(true);
  });

  it('renders one milestone button per entry, in order', () => {
    render(<JourneyTimeline entries={entries} />);
    expect(screen.getByRole('list').tagName).toBe('OL');
    expect(milestones()).toHaveLength(entries.length);
    milestones().forEach((button, i) => {
      expect(button).toHaveTextContent(entries[i]!.phase);
      expect(button).toHaveTextContent(entries[i]!.title);
    });
  });

  it('starts on the current entry', () => {
    render(<JourneyTimeline entries={entries} />);
    milestones().forEach((button, i) =>
      expect(button).toHaveAttribute('aria-pressed', i === currentIndex ? 'true' : 'false'),
    );
    expect(milestones()[currentIndex]).toHaveTextContent('(current)');
    const panel = detail();
    expect(panel).toHaveTextContent(indexLabel(currentIndex));
    expect(panel).toHaveTextContent(entries[currentIndex]!.title);
    expect(panel).toHaveTextContent(entries[currentIndex]!.summary);
  });

  it('wires every milestone to a polite live detail panel', () => {
    render(<JourneyTimeline entries={entries} />);
    const ids = new Set(milestones().map((b) => b.getAttribute('aria-controls')));
    expect(ids.size).toBe(1);
    expect(detail()).toHaveAttribute('aria-live', 'polite');
  });

  it('updates the detail panel when another milestone is clicked', async () => {
    const user = userEvent.setup();
    render(<JourneyTimeline entries={entries} />);
    await user.click(milestones()[0]!);
    expect(pressed()).toBe(0);
    expect(milestones()[currentIndex]).toHaveAttribute('aria-pressed', 'false');
    const panel = detail();
    expect(panel).toHaveTextContent(indexLabel(0));
    expect(panel).toHaveTextContent(entries[0]!.title);
    expect(panel).toHaveTextContent(entries[0]!.summary);
  });

  it('supports arrow, Home and End keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<JourneyTimeline entries={entries} />);
    const last = entries.length - 1;

    act(() => milestones()[0]!.focus());
    expect(pressed()).toBe(0);

    await user.keyboard('{ArrowRight}');
    expect(milestones()[1]).toHaveFocus();
    expect(pressed()).toBe(1);
    expect(detail()).toHaveTextContent(indexLabel(1));

    await user.keyboard('{ArrowDown}');
    expect(milestones()[2]).toHaveFocus();
    expect(pressed()).toBe(2);

    await user.keyboard('{ArrowLeft}');
    expect(milestones()[1]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(milestones()[0]).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(milestones()[0]).toHaveFocus();
    expect(pressed()).toBe(0);

    await user.keyboard('{End}');
    expect(milestones()[last]).toHaveFocus();
    expect(pressed()).toBe(last);
    expect(detail()).toHaveTextContent(indexLabel(last));

    await user.keyboard('{ArrowRight}');
    expect(milestones()[last]).toHaveFocus();

    await user.keyboard('{Home}');
    expect(milestones()[0]).toHaveFocus();
    expect(pressed()).toBe(0);
  });

  it('ignores unrelated keys', () => {
    render(<JourneyTimeline entries={entries} />);
    const event = fireEvent.keyDown(milestones()[currentIndex]!, { key: 'a' });
    expect(event).toBe(true); // not default-prevented
    expect(pressed()).toBe(currentIndex);
  });

  it('shows a visible "Sample" tag and pending metadata while entries are placeholders', () => {
    render(<JourneyTimeline entries={entries} />);
    const panel = detail();
    expect(within(panel).getByText('Sample')).toBeVisible();
    expect(panel).toHaveTextContent('Organisation pending CV review · Dates pending CV review');
  });

  it('drops the "Sample" tag and shows real metadata for verified entries', () => {
    const verified: CareerEntry[] = entries.map((e) => ({
      ...e,
      organization: 'Acme Labs',
      period: '2021 – 2023',
      verification: { status: 'owner_verified', source: 'CV v1 p.1' },
    }));
    render(<JourneyTimeline entries={verified} />);
    const panel = detail();
    expect(within(panel).queryByText('Sample')).not.toBeInTheDocument();
    expect(panel).toHaveTextContent('Acme Labs · 2021 – 2023');
  });

  it('falls back to the first entry when none is current', () => {
    render(<JourneyTimeline entries={entries.map((e) => ({ ...e, current: false }))} />);
    expect(pressed()).toBe(0);
  });
});

describe('JourneyTimeline progress line', () => {
  const progressPath = (container: HTMLElement) =>
    container.querySelectorAll('svg path')[1] as SVGPathElement;

  it('is fully drawn under reduced motion', () => {
    const { container } = render(<JourneyTimeline entries={entries} />);
    const path = progressPath(container);
    expect(path.style.strokeDasharray).toBe(String(PATH_LENGTH));
    expect(path.style.strokeDashoffset).toBe('0');
  });

  it('follows the section scroll progress', async () => {
    useExperience.setState({ reducedMotion: false });
    const vh = window.innerHeight;
    const height = 400;
    const start = vh * 0.85;
    const end = vh * 0.6 - height;
    let top = start; // section just entering → progress 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          top,
          height,
          bottom: top + height,
          left: 0,
          right: 0,
          width: 0,
          x: 0,
          y: top,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    const { container } = render(<JourneyTimeline entries={entries} />);
    const path = progressPath(container);
    const root = container.firstElementChild as HTMLElement;
    expect(path.style.strokeDashoffset).toBe(String(PATH_LENGTH));
    expect(root.style.getPropertyValue('--progress')).toBe('0.000');

    top = (start + end) / 2; // halfway
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    });
    expect(Number(path.style.strokeDashoffset)).toBeCloseTo(PATH_LENGTH / 2, 6);
    expect(root.style.getPropertyValue('--progress')).toBe('0.500');
  });
});

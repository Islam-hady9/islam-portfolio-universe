import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AskAiPanel } from '@/components/ask-ai/AskAiPanel';
import { buildSuggestionMap } from '@/components/ask-ai/suggestions';
import { content, getProjects } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';
import { useAssistant } from '@/state/assistant-store';

const path = { current: '/about' };
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

const { manifest } = compileKnowledge(content);
const map = buildSuggestionMap(getProjects().map((p) => ({ slug: p.slug, title: p.title })));
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  useAssistant.setState({ open: false, shown: false, requested: false, pending: null, opener: null });
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).startsWith('/ai/knowledge.json'))
      return new Response(JSON.stringify(manifest), { status: 200 });
    throw new Error(`unexpected request ${String(input)}`);
  });
});
afterEach(() => fetchSpy.mockRestore());

describe('AskAiPanel in the shared session (AI Presence V1)', () => {
  it('answers a question queued by the hero or the drawer exactly once', async () => {
    render(<AskAiPanel manifestVersion={manifest.version} suggestionMap={map} />);
    act(() => useAssistant.getState().openAssistant({ question: 'How can I contact him?' }));
    await waitFor(() => expect(screen.getAllByTestId('assistant-answer')).toHaveLength(1));
    const answer = screen.getByTestId('assistant-answer');
    await waitFor(() => expect(answer).toHaveAttribute('data-turn-state', 'done'));
    expect(useAssistant.getState().pending).toBeNull();
    // Re-opening without a new question never re-submits the old one.
    act(() => useAssistant.getState().openAssistant());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByTestId('assistant-answer')).toHaveLength(1);
  });

  it('publishes a compact presence for the orb (complete after an answer)', async () => {
    render(<AskAiPanel manifestVersion={manifest.version} suggestionMap={map} />);
    act(() => useAssistant.getState().openAssistant({ question: 'Can I see his CV?' }));
    await waitFor(() => expect(useAssistant.getState().presence.phase).toBe('complete'));
  });

  it('shows the suggestions of the current route', () => {
    render(<AskAiPanel manifestVersion={manifest.version} suggestionMap={map} />);
    const list = screen.getByRole('list', { name: 'Suggested questions' });
    for (const q of map['/about']!) expect(within(list).getByRole('button', { name: q })).toBeVisible();
  });
});

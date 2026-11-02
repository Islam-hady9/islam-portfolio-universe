import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AskAiPanel } from '@/components/ask-ai/AskAiPanel';
import { content } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';

const { manifest } = compileKnowledge(content);
let fetchSpy: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith('/ai/knowledge.json')) return new Response(JSON.stringify(manifest), { status: 200 });
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  // Only the static manifest is ever requested: no API, no inference endpoint, no model host.
  for (const [input] of fetchSpy.mock.calls) expect(String(input)).toMatch(/^\/ai\/knowledge\.json\?v=/);
});

function renderPanel() {
  const user = userEvent.setup();
  render(<AskAiPanel manifestVersion={manifest.version} />);
  return {
    user,
    input: screen.getByRole('textbox', { name: /ask about islam/i }),
    panel: screen.getByTestId('ask-ai-panel'),
  };
}

describe('AskAiPanel', () => {
  it('starts in Smart Mode with the spec labels and loads nothing up front', () => {
    const { panel } = renderPanel();
    expect(within(panel).getByTestId('ask-ai-mode')).toHaveTextContent(
      'Smart Mode — Instant answers from portfolio',
    );
    expect(screen.getByRole('button', { name: 'Try Local AI (runs on your device)' })).toBeVisible();
    expect(screen.getByText('Answers use approved public portfolio information only.')).toBeVisible();
    expect(panel).toHaveAttribute('data-state', 'smart-ready');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers with Enter, labels the answer, lists sources and announces a summary', async () => {
    const { user, input, panel } = renderPanel();
    await user.type(input, 'What does Islam work on?{Enter}');
    const answer = await screen.findByTestId('assistant-answer');
    await waitFor(() => expect(answer).toHaveAttribute('data-turn-state', 'done'));
    expect(answer).toHaveAttribute('data-mode', 'smart');
    expect(within(answer).getByText('Smart Answer')).toBeVisible();
    expect(within(answer).getByText('Sources')).toBeVisible();
    expect(answer).toHaveTextContent(content.site.heroStatement);
    expect(panel).toHaveAttribute('data-state', 'smart-answer');
    expect(input).toHaveValue('');
    await waitFor(() =>
      expect(screen.getByTestId('ask-ai-live')).toHaveTextContent('Smart Answer: 2 source(s).'),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('renders answers as text: markup in a question is never interpreted', async () => {
    const { user, input } = renderPanel();
    await user.type(input, '<img src=x onerror=alert(1)> who is he{Enter}');
    const answer = await screen.findByTestId('assistant-answer');
    await waitFor(() => expect(answer).toHaveAttribute('data-turn-state', 'done'));
    expect(answer.querySelector('img')).toBeNull();
  });

  it('keeps per-tab history for follow-ups and clears it', async () => {
    const { user, input } = renderPanel();
    await user.type(input, 'Tell me about TIBYN{Enter}');
    await waitFor(() =>
      expect(screen.getAllByTestId('assistant-answer')[0]).toHaveAttribute('data-turn-state', 'done'),
    );
    await user.type(input, 'Tell me more about that project.{Enter}');
    await waitFor(() => expect(screen.getAllByTestId('assistant-answer')).toHaveLength(2));
    const second = screen.getAllByTestId('assistant-answer')[1]!;
    await waitFor(() => expect(second).toHaveAttribute('data-intent', 'project:project-tibyn'));
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.queryAllByTestId('assistant-answer')).toHaveLength(0);
  });

  it('Local AI: explains when the page cannot run it and keeps Smart Mode working', async () => {
    const { user, input, panel } = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Try Local AI (runs on your device)' }));
    await waitFor(() => expect(panel).toHaveAttribute('data-state', 'local-unavailable'));
    expect(screen.getByTestId('local-ai-card')).toHaveTextContent(/Smart Mode keeps working/);
    await user.type(input, 'How can I contact him?{Enter}');
    const answer = await screen.findByTestId('assistant-answer');
    await waitFor(() => expect(answer).toHaveAttribute('data-mode', 'smart'));
    expect(answer).toHaveTextContent(content.contact.email!);
  });

  it('shows an honest error and restores the question if the index cannot load', async () => {
    fetchSpy.mockImplementation(async () => new Response('nope', { status: 500 }));
    const { user, input } = renderPanel();
    await user.type(input, 'What does Islam work on?{Enter}');
    await waitFor(() => expect(input).toHaveValue('What does Islam work on?'));
    expect(await screen.findByTestId('assistant-answer')).toHaveAttribute('data-turn-state', 'error');
  });
});

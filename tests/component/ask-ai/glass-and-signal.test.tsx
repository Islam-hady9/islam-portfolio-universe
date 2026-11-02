import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AskAiPanel } from '@/components/ask-ai/AskAiPanel';
import { content } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';
import { useExperience } from '@/state/experience-store';

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
  fetchSpy.mockRestore();
});

describe('Ask My AI — Intelligent Glass surfaces (V3)', () => {
  it('builds the panel from the shared glass families', async () => {
    const user = userEvent.setup();
    render(<AskAiPanel manifestVersion={manifest.version} />);
    const panel = screen.getByTestId('ask-ai-panel');
    expect(panel).toHaveClass('glass', 'glass--panel');
    // Field well and prompt chips are nested families: no second backdrop blur.
    const input = screen.getByRole('textbox', { name: /ask about islam/i });
    expect(input.closest('form')).toHaveClass('glass', 'glass--inset');
    for (const chip of within(panel).getAllByRole('button', { name: /\?$/ }))
      expect(chip).toHaveClass('glass--chip');

    await user.type(input, 'What does Islam work on?{Enter}');
    const answer = await screen.findByTestId('assistant-answer');
    await waitFor(() => expect(answer).toHaveAttribute('data-turn-state', 'done'));
    expect(answer).toHaveClass('glass', 'glass--inset');
    const sources = within(answer).getAllByRole('link');
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) expect(s).toHaveClass('glass--chip');
  });
});

describe('Ask My AI — portal response signal (V3)', () => {
  it('signals the 3D world exactly once per completed answer, never per keystroke', async () => {
    const user = userEvent.setup();
    render(<AskAiPanel manifestVersion={manifest.version} />);
    const input = screen.getByRole('textbox', { name: /ask about islam/i });
    const before = useExperience.getState().assistantSignal;
    await user.type(input, 'How can I contact him?');
    expect(useExperience.getState().assistantSignal).toBe(before);
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(screen.getAllByTestId('assistant-answer')[0]).toHaveAttribute('data-turn-state', 'done'),
    );
    expect(useExperience.getState().assistantSignal).toBe(before + 1);
    await user.type(input, 'What is his salary?{Enter}');
    await waitFor(() => expect(screen.getAllByTestId('assistant-answer')).toHaveLength(2));
    await waitFor(() =>
      expect(screen.getAllByTestId('assistant-answer')[1]).toHaveAttribute('data-turn-state', 'done'),
    );
    expect(useExperience.getState().assistantSignal).toBe(before + 2);
  });

  it('exposes the signal as a plain counter on the experience store', () => {
    const s = useExperience.getState();
    const n = s.assistantSignal;
    s.signalAssistant();
    expect(useExperience.getState().assistantSignal).toBe(n + 1);
  });
});

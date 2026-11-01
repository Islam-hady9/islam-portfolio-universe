import { describe, expect, it, vi } from 'vitest';
import { LIVE_UNAVAILABLE_DISCLAIMER, type GroundedAnswer } from '@/lib/assistant/contracts';
import { HttpAssistantClient } from '@/lib/assistant/http-client';

const liveAnswer: GroundedAnswer = {
  mode: 'live',
  status: 'unavailable',
  answer: 'The live assistant is not connected yet.',
  sources: [],
  entryId: null,
  disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
};

describe('HttpAssistantClient', () => {
  it('is a live-mode client', () => {
    expect(new HttpAssistantClient().mode).toBe('live');
  });

  it('POSTs the request as JSON to its own API route and returns the body', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(liveAnswer, { status: 503 }));
    const answer = await new HttpAssistantClient().ask({ question: 'What is your stack?' });
    expect(answer).toEqual(liveAnswer);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('/api/assistant');
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(String(init!.body))).toEqual({ question: 'What is your stack?' });
  });

  it('uses a custom endpoint when given one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(liveAnswer));
    await new HttpAssistantClient('/custom/endpoint').ask({ question: 'hi' });
    expect(fetchSpy.mock.calls[0]![0]).toBe('/custom/endpoint');
  });

  it('degrades to an honest "unavailable" answer on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(new HttpAssistantClient().ask({ question: 'hi' })).resolves.toEqual({
      mode: 'live',
      status: 'unavailable',
      answer: expect.stringMatching(/could not be reached/),
      sources: [],
      entryId: null,
      disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
    });
  });

  it('degrades to "unavailable" when the response is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>Bad gateway</html>', { status: 502 }),
    );
    await expect(new HttpAssistantClient().ask({ question: 'hi' })).resolves.toMatchObject({
      status: 'unavailable',
      sources: [],
    });
  });
});

import {
  LIVE_UNAVAILABLE_DISCLAIMER,
  type AskRequest,
  type AssistantClient,
  type GroundedAnswer,
} from './contracts';

/**
 * Transport for the future live assistant. Talks only to this site's own /api/assistant
 * route (secrets stay server-side, spec §9.2). Any failure degrades to an honest
 * "unavailable" answer — never a fabricated one.
 */
export class HttpAssistantClient implements AssistantClient {
  readonly mode = 'live' as const;
  constructor(private readonly endpoint = '/api/assistant') {}

  async ask(request: AskRequest): Promise<GroundedAnswer> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = (await res.json()) as GroundedAnswer;
      return body;
    } catch {
      return {
        mode: 'live',
        status: 'unavailable',
        answer: 'The assistant could not be reached. Please try again later.',
        sources: [],
        entryId: null,
        disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
      };
    }
  }
}

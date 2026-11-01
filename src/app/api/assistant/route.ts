import { NextResponse } from 'next/server';
import { LIVE_UNAVAILABLE_DISCLAIMER, type GroundedAnswer } from '@/lib/assistant/contracts';
import { askRequestSchema } from '@/lib/assistant/request-schema';
import { checkQuestion } from '@/lib/assistant/safety';

/**
 * Live assistant boundary (spec §9). Implements the request contract, validation and safety
 * policy, and returns 503 `unavailable` until an owner-approved, server-side provider is
 * wired in the G7+ activation gate. No paid API is ever called from here in this gate, and
 * request bodies are not logged or stored.
 */
export const dynamic = 'force-dynamic';

function reply(status: number, body: GroundedAnswer) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return reply(400, {
      mode: 'live',
      status: 'error',
      answer: 'Malformed request.',
      sources: [],
      entryId: null,
      disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
    });
  }
  const parsed = askRequestSchema.safeParse(json);
  if (!parsed.success) {
    return reply(400, {
      mode: 'live',
      status: 'error',
      answer: 'Questions must be between 1 and 500 characters.',
      sources: [],
      entryId: null,
      disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
    });
  }
  const verdict = checkQuestion(parsed.data.question);
  if (!verdict.ok) {
    return reply(422, {
      mode: 'live',
      status: 'refused',
      answer: verdict.message,
      sources: [],
      entryId: null,
      disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
    });
  }
  // Activation gate: a grounded provider (retrieval over approved knowledge, citations,
  // rate limiting, spend controls) is plugged in here after the owner approves the CV data.
  return reply(503, {
    mode: 'live',
    status: 'unavailable',
    answer:
      'The live assistant is not connected yet. It will answer from verified portfolio sources after content review.',
    sources: [],
    entryId: null,
    disclaimer: LIVE_UNAVAILABLE_DISCLAIMER,
  });
}

export function GET() {
  return NextResponse.json(
    {
      status: 'unavailable',
      mode: 'live',
      message: 'POST an AskRequest. The live assistant is not connected yet.',
    },
    { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
  );
}

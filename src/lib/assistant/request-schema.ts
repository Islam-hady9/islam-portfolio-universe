/**
 * Server-side validation for AskRequest (kept out of the client bundle: zod is only needed
 * where untrusted input arrives — the /api/assistant route).
 */
import { z } from 'zod';
import type { AskRequest } from './contracts';

export const askRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  sessionId: z.string().max(64).optional(),
  locale: z.literal('en').optional(),
}) satisfies z.ZodType<AskRequest>;

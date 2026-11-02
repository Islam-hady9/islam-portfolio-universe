import { content } from '@/content';
import { compileKnowledge } from '@/lib/portfolio-ai/knowledge/compiler';

/**
 * The portfolio assistant's public knowledge manifest (PIE spec §5): only verified, public and
 * explicitly approved records, compiled at build time and served as a static file. The Ask My AI
 * panel fetches it lazily; it is never part of the initial page payload.
 */
export const dynamic = 'force-static';

export function GET() {
  const { manifest } = compileKnowledge(content);
  return Response.json(manifest, {
    headers: { 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Content-Type-Options': 'nosniff' },
  });
}

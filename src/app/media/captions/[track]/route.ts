import { getMedia } from '@/content';
import { buildWebVtt } from '@/lib/vtt';

/**
 * WebVTT captions for the intro reel, generated at build time from the transcript cues in
 * src/content/data/media.json — the same records the player's transcript panel renders.
 * Served as /media/captions/intro-reel.<language>.vtt (static; unknown tracks are 404).
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

const trackName = () => `intro-reel.${getMedia().introReel.language}.vtt`;

export function generateStaticParams() {
  return [{ track: trackName() }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (track !== trackName()) return new Response('Not found', { status: 404 });
  return new Response(buildWebVtt(getMedia().introReel.transcript.cues), {
    headers: { 'Content-Type': 'text/vtt; charset=utf-8' },
  });
}

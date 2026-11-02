/**
 * WebVTT serialisation for caption cues kept as content data (the same cues feed the on-page
 * transcript, so captions and transcript can never drift apart).
 */
export interface VttCue {
  start: number;
  end: number;
  text: string;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Seconds → "HH:MM:SS.mmm" (the WebVTT timestamp form that always includes hours). */
export function vttTimestamp(seconds: number): string {
  const ms = Math.round(Math.max(0, seconds) * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${two(h)}:${two(m)}:${two(s)}.${String(ms % 1000).padStart(3, '0')}`;
}

/** Cue payload escaping per the WebVTT spec ("&", "<" and ">" are markup there). */
function escapeCueText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n+/g, '\n')
    .trim();
}

export function buildWebVtt(cues: readonly VttCue[]): string {
  const blocks = cues.map(
    (c, i) => `${i + 1}\n${vttTimestamp(c.start)} --> ${vttTimestamp(c.end)}\n${escapeCueText(c.text)}`,
  );
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

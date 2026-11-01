/**
 * Media duration labels. Dependency-free so client components (the reel player) can use them
 * without pulling the media manifest into their chunk.
 */

/** "0:35", "1:02:07" — media durations for labels. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Spoken form for screen readers: "35 seconds", "1 minute 2 seconds". */
export function spokenDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (!m) return part(r, 'second');
  return r ? `${part(m, 'minute')} ${part(r, 'second')}` : part(m, 'minute');
}

/**
 * Owner-supplied media (portrait + intro reel): technical facts from the generated manifest
 * (scripts/media/process-media.py → src/assets/media.json) joined with the editable copy in
 * src/content/data/media.json. Components receive these plain objects; they never build
 * media paths themselves.
 */
import manifest from '@/assets/media.json';
import type { MediaContent, TranscriptCue } from '@/content/schema';

export { formatDuration, spokenDuration } from './duration';

export interface ImageSource {
  type: string;
  srcSet: string;
}

export interface PortraitAsset {
  width: number;
  height: number;
  sources: ImageSource[];
  fallback: { src: string; srcSet: string };
  /** Tiny blurred stand-in painted while the real image loads (data URI). */
  placeholder: string;
}

export interface VideoSource {
  src: string;
  /** MIME type with RFC 6381 codecs, e.g. video/mp4; codecs="avc1.64001f, mp4a.40.2". */
  type: string;
  /** Resource-selection media query; the last source has none and is the default. */
  media?: string;
  width: number;
  height: number;
  bytes: number;
}

export interface ReelAsset {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  sources: VideoSource[];
  poster: {
    width: number;
    height: number;
    src: string;
    small: string;
    sources: ImageSource[];
    fallback: string;
    placeholder: string;
  };
  thumbnail: { width: number; height: number; src: string; sources: ImageSource[] };
}

const assets = manifest as unknown as { portrait: PortraitAsset; introReel: ReelAsset };

export const portraitAsset = (): PortraitAsset => assets.portrait;
export const reelAsset = (): ReelAsset => assets.introReel;

export const captionsPath = (language: string) => `/media/captions/intro-reel.${language}.vtt`;

/** Only the asset facts the player reads (they travel in the page's RSC payload). */
export interface ReelPlayerAsset {
  duration: number;
  width: number;
  height: number;
  sources: Pick<VideoSource, 'src' | 'type' | 'media'>[];
  poster: Pick<ReelAsset['poster'], 'src' | 'small'>;
}

/** Everything the player needs, as plain serialisable props. */
export interface ReelView {
  eyebrow: string;
  title: string;
  ctaLabel: string;
  summary: string;
  language: string;
  disclosure: string | null;
  cues: TranscriptCue[];
  visuals: { at: number; text: string }[];
  captions: string;
  asset: ReelPlayerAsset;
}

export function reelView(copy: MediaContent['introReel']): ReelView {
  const a = reelAsset();
  return {
    eyebrow: copy.eyebrow,
    title: copy.title,
    ctaLabel: copy.ctaLabel,
    summary: copy.summary,
    language: copy.language,
    disclosure: copy.provenance.aiGenerated ? copy.provenance.label : null,
    cues: copy.transcript.cues,
    visuals: copy.transcript.visuals,
    captions: captionsPath(copy.language),
    asset: {
      duration: a.duration,
      width: a.width,
      height: a.height,
      sources: a.sources.map(({ src, type, media }) => (media ? { src, type, media } : { src, type })),
      poster: { src: a.poster.src, small: a.poster.small },
    },
  };
}

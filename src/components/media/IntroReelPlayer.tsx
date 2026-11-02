'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { Icon } from '@/components/ui/Icon';
import { track } from '@/lib/analytics';
import { formatDuration } from '@/lib/duration';
import type { ReelView } from '@/lib/media';
import { useExperience } from '@/state/experience-store';
import { registerReel } from './reel-bus';
import styles from './IntroReelPlayer.module.css';

export interface IntroReelPlayerProps {
  reel: ReelView;
}

type Phase = 'closed' | 'open' | 'closing';
type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const CAPTIONS_KEY = 'iu:reel-captions';
const IDLE_MS = 2600;
const SEEK_STEP = 5;

/** Captions default to on (they sit in a rail under the film, never over it). */
function readCaptionsPreference(): boolean {
  try {
    return window.localStorage.getItem(CAPTIONS_KEY) !== 'off';
  } catch {
    return true;
  }
}

function writeCaptionsPreference(on: boolean) {
  try {
    window.localStorage.setItem(CAPTIONS_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
}

function languageName(lang: string): string {
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(lang) ?? lang;
  } catch {
    return lang;
  }
}

/**
 * Cinematic, accessible player for the owner's intro reel (a vertical 9:16 film).
 *
 * - Native modal <dialog>: focus is contained, the page behind is inert, Escape closes, and
 *   focus returns to the trigger that opened it.
 * - Poster-first: no video bytes (and no poster) are requested until the dialog opens.
 * - Opening plays with sound only because the visitor asked to watch; with reduced motion the
 *   reel waits on its poster for an explicit play.
 * - Custom controls (play, seek, captions, sound, fullscreen) with keyboard shortcuts;
 *   captions and the interactive transcript render from the same content cues as the
 *   WebVTT track (used by native fullscreen players).
 * - While open, the WebGL world pauses and page scrolling is locked.
 */
export function IntroReelPlayer({ reel }: IntroReelPlayerProps) {
  const { asset } = reel;
  const duration = asset.duration;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<FullscreenVideo>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const savedOverflow = useRef<string | null>(null);
  const idleTimer = useRef(0);
  const lastSecond = useRef(-1);
  const completed = useRef(false);
  const playingRef = useRef(false);
  const captionsRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('closed');
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [captions, setCaptions] = useState(readCaptionsPreference);
  const [cueIndex, setCueIndex] = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [idle, setIdle] = useState(false);
  const [status, setStatus] = useState('');
  const titleId = useId();
  const summaryId = useId();

  const finePointer = useMemo(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches, []);
  const sources = useMemo(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    // Data saver: skip the high-resolution variant (the default source has no media query).
    return conn?.saveData ? asset.sources.filter((s) => !s.media) : asset.sources;
  }, [asset.sources]);
  const fallbackSrc = (asset.sources.find((s) => !s.media) ?? asset.sources[0])?.src;
  const langLabel = useMemo(() => languageName(reel.language), [reel.language]);

  /** Progress, time label and active cue — DOM writes per frame, React state only on change. */
  const sync = useCallback(
    (t: number) => {
      const seek = seekRef.current;
      if (seek) {
        seek.value = String(t);
        seek.style.setProperty('--p', `${Math.min(100, (t / duration) * 100)}%`);
      }
      const s = Math.floor(t);
      if (s !== lastSecond.current) {
        lastSecond.current = s;
        setTime(t);
      }
      const idx = reel.cues.findIndex((c) => t >= c.start && t < c.end);
      setCueIndex((prev) => (prev === idx ? prev : idx));
    },
    [duration, reel.cues],
  );

  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    if (!finePointer) return;
    idleTimer.current = window.setTimeout(() => {
      // Keyboard users keep the controls; pointer users get an unobstructed picture.
      if (playingRef.current && !stageRef.current?.querySelector(':focus-visible')) setIdle(true);
    }, IDLE_MS);
  }, [finePointer]);

  const open = useCallback(
    (opener: HTMLElement | null) => {
      const dialog = dialogRef.current;
      const video = videoRef.current;
      if (!dialog || !video || dialog.open) return;
      openerRef.current = opener;
      flushSync(() => {
        setPhase('open');
        setFailed(false);
        setIdle(false);
        setStatus('');
      });
      if (!video.hasAttribute('poster')) {
        const tall = window.innerHeight * (window.devicePixelRatio || 1) > 1100;
        video.setAttribute('poster', tall ? asset.poster.src : asset.poster.small);
      }
      if (video.ended) video.currentTime = 0;
      dialog.showModal();
      const root = document.documentElement;
      savedOverflow.current = root.style.overflow;
      root.style.overflow = 'hidden';
      useExperience.getState().setMediaOverlay(true);
      toggleRef.current?.focus({ preventScroll: true });
      // Called inside the trigger's click: playback with sound is a direct result of the gesture.
      if (!useExperience.getState().reducedMotion) {
        video.play()?.catch(() => {
          // Autoplay refused (or the source failed): the poster and play button stay up.
        });
      }
    },
    [asset.poster.small, asset.poster.src],
  );

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) return;
    videoRef.current?.pause();
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    if (document.documentElement.getAttribute('data-motion') !== 'full') {
      dialog.close();
      return;
    }
    setPhase('closing');
    window.setTimeout(() => {
      if (dialog.open) dialog.close();
    }, 220);
  }, []);

  // Register with the triggers' bus.
  useEffect(() => {
    registerReel(open);
    return () => registerReel(null);
  }, [open]);

  // Dialog lifecycle: Escape → animated close; any close → restore the page.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    const onClose = () => {
      videoRef.current?.pause();
      window.clearTimeout(idleTimer.current);
      setPhase('closed');
      setIdle(false);
      document.documentElement.style.overflow = savedOverflow.current ?? '';
      savedOverflow.current = null;
      useExperience.getState().setMediaOverlay(false);
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      // Unmounted while open (route change): never leave the page locked or the world paused.
      if (savedOverflow.current !== null) {
        document.documentElement.style.overflow = savedOverflow.current;
        savedOverflow.current = null;
        useExperience.getState().setMediaOverlay(false);
      }
    };
  }, [close]);

  // Media element events.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => {
      playingRef.current = true;
      setPlaying(true);
      setEnded(false);
      poke();
    };
    const onPause = () => {
      playingRef.current = false;
      setPlaying(false);
      setIdle(false);
    };
    const onWaiting = () => setWaiting(true);
    const onReady = () => setWaiting(false);
    const onTime = () => sync(video.currentTime);
    const onProgress = () => {
      const b = video.buffered;
      const end = b.length ? b.end(b.length - 1) : 0;
      seekRef.current?.style.setProperty('--b', `${Math.min(100, (end / duration) * 100)}%`);
    };
    const onEnded = () => {
      playingRef.current = false;
      setPlaying(false);
      setEnded(true);
      setIdle(false);
      setStatus('The reel has ended.');
      if (!completed.current) {
        completed.current = true;
        track('reel_complete', {});
      }
    };
    const onVolume = () => setMuted(video.muted);
    const onError = () => {
      // All sources failed (source errors are captured here), or decoding failed.
      if (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) setFailed(true);
    };
    // iOS shows its own player in fullscreen: hand it the WebVTT track while it's up.
    const onNativeFs = (on: boolean) => () => {
      const t = video.textTracks?.[0];
      if (t) t.mode = on && captionsRef.current ? 'showing' : 'disabled';
    };
    const beginFs = onNativeFs(true);
    const endFs = onNativeFs(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    video.addEventListener('progress', onProgress);
    video.addEventListener('ended', onEnded);
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('error', onError, true);
    video.addEventListener('webkitbeginfullscreen', beginFs);
    video.addEventListener('webkitendfullscreen', endFs);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('error', onError, true);
      video.removeEventListener('webkitbeginfullscreen', beginFs);
      video.removeEventListener('webkitendfullscreen', endFs);
    };
  }, [duration, poke, sync]);

  // Smooth progress while playing (timeupdate alone ticks only ~4×/s).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) sync(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sync]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => () => window.clearTimeout(idleTimer.current), []);

  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) {
      if (v.ended) v.currentTime = 0;
      v.play()?.catch(() => setStatus('Playback did not start. Press play to try again.'));
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    setStatus(v.muted ? 'Sound off' : 'Sound on');
  }, []);

  const toggleCaptions = useCallback(() => {
    const next = !captionsRef.current;
    setCaptions(next);
    writeCaptionsPreference(next);
    setStatus(next ? 'Captions on' : 'Captions off');
  }, []);

  const toggleFullscreen = useCallback(() => {
    const stage = stageRef.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    if (stage && document.fullscreenEnabled && stage.requestFullscreen) {
      void stage.requestFullscreen().catch(() => {});
      return;
    }
    videoRef.current?.webkitEnterFullscreen?.();
  }, []);

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const clamped = Math.max(0, Math.min(duration, t));
      v.currentTime = clamped;
      sync(clamped);
    },
    [duration, sync],
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    const onControl = Boolean(target.closest('button, a, summary, input'));
    const onRange = target instanceof HTMLInputElement && target.type === 'range';
    let handled = true;
    switch (e.key) {
      case ' ':
        if (onControl) handled = false;
        else togglePlay();
        break;
      case 'k':
      case 'K':
        togglePlay();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'c':
      case 'C':
        toggleCaptions();
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (onRange) handled = false;
        else seekTo((videoRef.current?.currentTime ?? 0) + (e.key === 'ArrowLeft' ? -SEEK_STEP : SEEK_STEP));
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      poke();
    }
  };

  const onSeekInput = (e: FormEvent<HTMLInputElement>) => seekTo(Number(e.currentTarget.value));
  const cue = captions && cueIndex >= 0 ? reel.cues[cueIndex] : null;
  const timeLabel = `${formatDuration(time)} / ${formatDuration(duration)}`;

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-phase={phase}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      onKeyDown={onKeyDown}
    >
      <button type="button" className={styles.close} onClick={close} aria-label="Close video">
        <Icon name="close" size={20} />
      </button>
      {phase !== 'closed' ? (
        // eslint-disable-next-line @next/next/no-img-element -- blurred ambient light; same poster file the player shows
        <img className={styles.ambient} src={asset.poster.small} alt="" aria-hidden="true" />
      ) : null}
      <div
        className={styles.layout}
        onClick={(e) => {
          // Light dismiss: a click on the empty area around the film closes it.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div
          ref={stageRef}
          className={styles.stage}
          data-idle={idle && playing && fullscreen ? '' : undefined}
          data-fullscreen={fullscreen || undefined}
          onPointerMove={poke}
          onPointerDown={poke}
        >
          <div className={styles.screen}>
            <video
              ref={videoRef}
              className={styles.video}
              preload="none"
              playsInline
              width={asset.width}
              height={asset.height}
              aria-label={reel.title}
              onClick={togglePlay}
              onDoubleClick={toggleFullscreen}
            >
              {sources.map((s) => (
                <source key={s.src} src={s.src} type={s.type} media={s.media} />
              ))}
              <track kind="captions" src={reel.captions} srcLang={reel.language} label={langLabel} />
            </video>

            {!playing && !failed ? (
              <button
                type="button"
                className={styles.bigPlay}
                tabIndex={-1}
                aria-hidden="true"
                onClick={togglePlay}
              >
                <Icon
                  name={ended ? 'replay' : 'play'}
                  size={ended ? 26 : 24}
                  strokeWidth={ended ? 1.6 : 0}
                  fill={ended ? 'none' : 'currentColor'}
                />
              </button>
            ) : null}

            {waiting && playing ? <span className={styles.spinner} aria-hidden="true" /> : null}

            {failed ? (
              <div className={styles.error} role="alert">
                <p>This video can’t be played here.</p>
                {fallbackSrc ? (
                  <a href={fallbackSrc} target="_blank" rel="noopener noreferrer">
                    Open the video file<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Subtitle rail: captions live under the film so they never cover its own typography. */}
          <p className={styles.rail} aria-hidden="true" data-captions={captions ? 'on' : 'off'}>
            {cue ? cue.text : null}
          </p>

          <div className={styles.controls}>
            <input
              ref={seekRef}
              className={styles.seek}
              type="range"
              min={0}
              max={duration}
              step={0.1}
              defaultValue={0}
              aria-label="Seek"
              aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
              onInput={onSeekInput}
            />
            <div className={styles.buttons}>
              <button
                ref={toggleRef}
                type="button"
                className={styles.ctrl}
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : ended ? 'Replay' : 'Play'}
                aria-keyshortcuts="k"
                data-reel-toggle=""
              >
                <Icon
                  name={playing ? 'pause' : ended ? 'replay' : 'play'}
                  size={20}
                  strokeWidth={playing || ended ? 1.8 : 0}
                  fill={playing || ended ? 'none' : 'currentColor'}
                />
              </button>
              <span className={styles.time} aria-hidden="true">
                {timeLabel}
              </span>
              <span className={styles.spacer} />
              <button
                type="button"
                className={styles.ctrl}
                onClick={toggleCaptions}
                aria-label="Captions"
                aria-pressed={captions}
                aria-keyshortcuts="c"
              >
                <Icon name="captions" size={20} />
              </button>
              <button
                type="button"
                className={styles.ctrl}
                onClick={toggleMute}
                aria-label="Mute"
                aria-pressed={muted}
                aria-keyshortcuts="m"
              >
                <Icon name={muted ? 'volume-off' : 'volume'} size={20} />
              </button>
              <button
                type="button"
                className={styles.ctrl}
                onClick={toggleFullscreen}
                aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
                aria-keyshortcuts="f"
              >
                <Icon name={fullscreen ? 'collapse' : 'expand'} size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.notes}>
          <p className={styles.eyebrow}>{reel.eyebrow}</p>
          <h2 id={titleId} className={styles.title}>
            {reel.title}
          </h2>
          <p id={summaryId} className={styles.summary}>
            {reel.summary}
          </p>
          <p className={styles.meta}>
            <span>{formatDuration(duration)}</span>
            <span>Narrated</span>
            <span>{langLabel} captions</span>
          </p>
          <details className={styles.transcript}>
            <summary>
              <span>Transcript</span>
              <Icon name="arrow-right" size={14} className={styles.chevron} />
            </summary>
            <div className={styles.transcriptBody}>
              <h3 className={styles.subhead}>Narration</h3>
              <ol className={styles.cues}>
                {reel.cues.map((c, i) => (
                  <li key={c.start}>
                    <button
                      type="button"
                      className={styles.cue}
                      data-active={i === cueIndex || undefined}
                      onClick={() => seekTo(c.start)}
                    >
                      <span className={styles.ts}>{formatDuration(c.start)}</span>
                      <span>{c.text}</span>
                    </button>
                  </li>
                ))}
              </ol>
              <h3 className={styles.subhead}>On screen</h3>
              <ul className={styles.visuals}>
                {reel.visuals.map((v) => (
                  <li key={v.at}>
                    <span className={styles.ts}>{formatDuration(v.at)}</span>
                    <span>{v.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
          {reel.disclosure ? (
            <p className={styles.credit}>
              <Icon name="sparkle" size={14} />
              <span>{reel.disclosure}</span>
            </p>
          ) : null}
          <ul className={styles.keys} aria-label="Keyboard shortcuts">
            <li>
              <kbd>K</kbd> play / pause
            </li>
            <li>
              <kbd>M</kbd> sound
            </li>
            <li>
              <kbd>C</kbd> captions
            </li>
            <li>
              <kbd>F</kbd> full screen
            </li>
            <li>
              <kbd>←</kbd>
              <kbd>→</kbd> 5 seconds
            </li>
          </ul>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </dialog>
  );
}

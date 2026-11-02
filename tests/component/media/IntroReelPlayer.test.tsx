import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { content } from '@/content';
import { reelView } from '@/lib/media';
import { useExperience } from '@/state/experience-store';
import { IntroReelPlayer } from '@/components/media/IntroReelPlayer';
import { openReel, resetReelBus } from '@/components/media/reel-bus';

const reel = reelView(content.media.introReel);

// jsdom implements neither modal dialogs nor media playback: minimal, spec-shaped stand-ins.
const playing = new WeakMap<HTMLMediaElement, boolean>();
beforeAll(() => {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
    configurable: true,
    get(this: HTMLMediaElement) {
      return !playing.get(this);
    },
  });
});

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetReelBus();
  play = vi.fn(function (this: HTMLMediaElement) {
    playing.set(this, true);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pause = vi.fn(function (this: HTMLMediaElement) {
    if (!playing.get(this)) return;
    playing.set(this, false);
    this.dispatchEvent(new Event('pause'));
  });
  HTMLMediaElement.prototype.play = play as unknown as HTMLMediaElement['play'];
  HTMLMediaElement.prototype.pause = pause as unknown as HTMLMediaElement['pause'];
  window.localStorage.clear();
  useExperience.setState({ reducedMotion: false, mediaOverlay: false });
});
afterEach(() => {
  document.documentElement.style.overflow = '';
});

function setup() {
  const view = render(
    <>
      <button type="button">Watch the introduction</button>
      <IntroReelPlayer reel={reel} />
    </>,
  );
  const opener = screen.getByRole('button', { name: 'Watch the introduction' });
  const dialog = view.container.querySelector('dialog')!;
  const video = dialog.querySelector('video')!;
  const open = () =>
    act(() => {
      opener.focus();
      openReel(opener);
    });
  return { ...view, opener, dialog, video, open };
}

describe('IntroReelPlayer', () => {
  it('starts closed and requests nothing: no poster, preload="none"', () => {
    const { dialog, video } = setup();
    expect(dialog.open).toBe(false);
    expect(video.getAttribute('preload')).toBe('none');
    expect(video.hasAttribute('poster')).toBe(false);
    expect(video.querySelectorAll('source').length).toBe(reel.asset.sources.length);
    expect(video.querySelector('track')).toHaveAttribute('src', reel.captions);
  });

  it('opens as a labelled modal, plays, focuses the toggle, locks scroll and pauses the world', () => {
    const { dialog, video, open } = setup();
    open();
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAccessibleName(reel.title);
    expect(dialog).toHaveAccessibleDescription(reel.summary);
    expect(video.getAttribute('poster')).toMatch(/^\/media\/posters\//);
    expect(play).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('button', { name: 'Pause' })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(useExperience.getState().mediaOverlay).toBe(true);
  });

  it('with reduced motion, waits on the poster for an explicit play', () => {
    useExperience.setState({ reducedMotion: true });
    const { dialog, open } = setup();
    open();
    expect(play).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Play' })).toHaveFocus();
  });

  it('Escape closes, pauses, restores scrolling and the world, and returns focus to the trigger', () => {
    const { dialog, opener, open } = setup();
    open();
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(dialog.open).toBe(false);
    expect(pause).toHaveBeenCalled();
    expect(document.documentElement.style.overflow).toBe('');
    expect(useExperience.getState().mediaOverlay).toBe(false);
    expect(opener).toHaveFocus();
  });

  it('the close button closes the player too', async () => {
    const user = userEvent.setup();
    const { dialog, opener, open } = setup();
    open();
    await user.click(within(dialog).getByRole('button', { name: 'Close video' }));
    expect(dialog.open).toBe(false);
    expect(opener).toHaveFocus();
  });

  it('keyboard shortcuts: K toggles playback, M sound, C captions (remembered)', () => {
    const { dialog, video, open } = setup();
    open();
    const captions = within(dialog).getByRole('button', { name: 'Captions' });
    const mute = within(dialog).getByRole('button', { name: 'Mute' });
    expect(captions).toHaveAttribute('aria-pressed', 'true'); // on by default
    fireEvent.keyDown(dialog, { key: 'k' });
    expect(pause).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dialog, { key: 'm' });
    expect(video.muted).toBe(true);
    act(() => {
      video.dispatchEvent(new Event('volumechange'));
    });
    expect(mute).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(dialog, { key: 'c' });
    expect(captions).toHaveAttribute('aria-pressed', 'false');
    expect(window.localStorage.getItem('iu:reel-captions')).toBe('off');
    expect(screen.getByRole('status')).toHaveTextContent('Captions off');
  });

  it('Space on a focused control activates that control only', () => {
    const { dialog, open } = setup();
    open();
    const captions = within(dialog).getByRole('button', { name: 'Captions' });
    fireEvent.keyDown(captions, { key: ' ' });
    expect(pause).not.toHaveBeenCalled();
  });

  it('shows the cue being spoken in the subtitle rail', () => {
    const { dialog, video, open } = setup();
    open();
    const cue = reel.cues[5]!;
    act(() => {
      video.currentTime = (cue.start + cue.end) / 2;
      video.dispatchEvent(new Event('timeupdate'));
    });
    expect(dialog.querySelector('[data-captions]')).toHaveTextContent(cue.text);
  });

  it('renders the full transcript and seeks from it', async () => {
    const user = userEvent.setup();
    const { dialog, video, open } = setup();
    open();
    for (const c of reel.cues) expect(within(dialog).getByText(c.text)).toBeInTheDocument();
    for (const v of reel.visuals) expect(within(dialog).getByText(v.text)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: new RegExp(reel.cues[6]!.text) }));
    expect(video.currentTime).toBeCloseTo(reel.cues[6]!.start, 3);
  });

  it('states the generative-AI disclosure when the content flags it', () => {
    const { dialog } = setup();
    if (reel.disclosure) expect(within(dialog).getByText(reel.disclosure)).toBeInTheDocument();
  });

  it('offers the video file when no source can be played', () => {
    const { dialog, video, open } = setup();
    open();
    Object.defineProperty(video, 'networkState', {
      configurable: true,
      value: HTMLMediaElement.NETWORK_NO_SOURCE,
    });
    act(() => {
      video.querySelector('source:last-of-type')!.dispatchEvent(new Event('error'));
    });
    const alert = within(dialog).getByRole('alert');
    const fallback = reel.asset.sources[reel.asset.sources.length - 1]!.src;
    expect(within(alert).getByRole('link', { name: /open the video file/i })).toHaveAttribute(
      'href',
      fallback,
    );
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const bus = vi.hoisted(() => ({ openReel: vi.fn(), warmReel: vi.fn(() => Promise.resolve()) }));
vi.mock('@/components/media/reel-bus', () => bus);

import { IntroReelTrigger } from '@/components/media/IntroReelTrigger';

beforeEach(() => {
  bus.openReel.mockClear();
  bus.warmReel.mockClear();
});

describe('IntroReelTrigger', () => {
  it('is a button that announces the dialog and the video length', () => {
    render(
      <IntroReelTrigger
        variant="overlay"
        label="Watch the introduction"
        duration="0:35"
        spokenDuration="35 seconds"
        dataAction="identity-reel"
      />,
    );
    const button = screen.getByRole('button', { name: 'Watch the introduction, 35 seconds video' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('warms the player on intent and opens it from the click, passing itself as the opener', async () => {
    const user = userEvent.setup();
    render(
      <IntroReelTrigger
        variant="chip"
        label="Watch the introduction"
        duration="0:35"
        spokenDuration="35 seconds"
        meta="PERSONAL REEL"
        thumbnail={{ src: '/media/thumbnails/intro-reel-112.webp', sources: [] }}
        dataAction="hero-reel"
      />,
    );
    const button = screen.getByRole('button', { name: /watch the introduction/i });
    await user.hover(button);
    expect(bus.warmReel).toHaveBeenCalled();
    await user.click(button);
    expect(bus.openReel).toHaveBeenCalledWith(button);
  });
});

describe('reel bus', () => {
  it('queues a request made before the player registers and replays it once registered', async () => {
    const real = await vi.importActual<typeof import('@/components/media/reel-bus')>(
      '@/components/media/reel-bus',
    );
    real.resetReelBus();
    vi.useFakeTimers();
    const opener = document.createElement('button');
    const handler = vi.fn();
    real.openReel(opener);
    expect(handler).not.toHaveBeenCalled();
    real.registerReel(handler);
    act(() => {
      vi.runAllTimers();
    });
    expect(handler).toHaveBeenCalledWith(opener);
    // Once registered, requests are handled synchronously (inside the user's gesture).
    real.openReel(null);
    expect(handler).toHaveBeenCalledTimes(2);
    real.registerReel(null);
    vi.useRealTimers();
  });
});

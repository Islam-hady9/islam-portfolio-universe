'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { afterFirstPaint } from '@/lib/after-load';
import type { ReelView } from '@/lib/media';
import type { IntroReelPlayerProps } from './IntroReelPlayer';
import { onReelDemand, warmReel } from './reel-bus';

/**
 * Mounts the intro-reel player (a closed <dialog>) once its chunk has loaded: in an idle slot
 * after first paint, or immediately when a trigger shows intent. The player costs nothing on
 * the critical path and is ready before most visitors reach for it.
 */
export function IntroReelHost({ reel }: { reel: ReelView }) {
  const [Player, setPlayer] = useState<ComponentType<IntroReelPlayerProps> | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void warmReel().then((m) => {
        if (alive) setPlayer(() => m.IntroReelPlayer);
      });
    };
    const off = onReelDemand(load);
    void afterFirstPaint(4000).then(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return Player ? <Player reel={reel} /> : null;
}

'use client';

import { Canvas } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useExperience } from '@/state/experience-store';
import { TIER_CONFIG, type QualityTier, type RenderTier } from '../quality/tiers';
import { Orchestrator } from '../orchestrator/Orchestrator';
import { CameraRig } from '../rigs/CameraRig';
import { SceneEnvironment } from '../scenes/SceneEnvironment';
import { HomeWorld } from '../scenes/HomeWorld';
import { DeepSpaceWorld } from '../scenes/DeepSpaceWorld';
import { WorldLights } from '../scenes/WorldLights';
import { Sky } from '../objects/Sky';
import { Starfield } from '../objects/Starfield';
import { PortalSystem } from '../portals/PortalSystem';
import { RenderPipeline } from './RenderPipeline';
import { ContextGuard, Diagnostics, IntroDirector, PerformanceGovernor, ReadySignal } from './Lifecycle';

/**
 * The one persistent WebGL canvas (spec §6.1). Fixed, pointer-transparent, decorative
 * (aria-hidden on the parent layer). Worlds switch with the route; the context survives.
 */
export default function ExperienceCanvas({ tier }: { tier: QualityTier }) {
  const pathname = usePathname() ?? '/';
  const reduced = useExperience((s) => s.reducedMotion);
  // While a full-screen media overlay covers the world, stop the render loop: the GPU is left
  // to video decoding and the last frame stays on screen under the overlay's backdrop.
  const covered = useExperience((s) => s.mediaOverlay);
  const cfg = TIER_CONFIG[(tier === 'static' ? 'lite' : tier) as RenderTier];
  const pixelRatio = useMemo(
    () => Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, cfg.dpr[1]),
    [cfg.dpr],
  );
  const home = pathname === '/';
  const worldRef = useRef<Group>(null);

  return (
    <Canvas
      dpr={cfg.dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 34, near: 0.1, far: 1400, position: [0, 0.3, 21] }}
      frameloop={reduced || covered ? 'demand' : 'always'}
      onCreated={({ gl }) => {
        gl.setClearColor('#06070a', 1);
        // Per-program log checks cost a sync GPU round-trip; keep them for development only.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Orchestrator />
      <CameraRig />
      <SceneEnvironment />
      <WorldLights />
      <Sky />
      <Starfield count={cfg.stars} pixelRatio={pixelRatio} />
      <group ref={worldRef} name="world-root">
        {home ? (
          <HomeWorld cfg={cfg} pixelRatio={pixelRatio} />
        ) : (
          <DeepSpaceWorld cfg={cfg} pixelRatio={pixelRatio} />
        )}
      </group>
      <PortalSystem cfg={cfg} />
      <IntroDirector />
      <RenderPipeline cfg={cfg} />
      <ContextGuard />
      <PerformanceGovernor tier={tier} />
      <ReadySignal worldKey={home ? 'home' : 'inner'} linearTarget={cfg.bloom} worldRef={worldRef} />
      <Diagnostics />
    </Canvas>
  );
}

'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PointLight } from 'three';
import { WORLD } from '../orchestrator/camera-path';
import { frame } from '../orchestrator/frame-state';

/**
 * Station point lights, always mounted and always visible. three.js keys shader programs on
 * the number of lights in view, so lights inside visibility-gated groups would force every lit
 * material to recompile whenever a station appears or disappears (travel jank). Instead the
 * light count is constant and intensity is modulated by station presence.
 */
export function WorldLights() {
  const core = useRef<PointLight>(null);
  const portal = useRef<PointLight>(null);
  const [px, py, pz] = WORLD.portal.center;

  useFrame(() => {
    const home = frame.route === 'home';
    if (core.current) core.current.intensity = home ? 34 * frame.coreEnergy : 0;
    if (portal.current) {
      const p = home
        ? Math.max(frame.presence[7] ?? 0, (frame.presence[6] ?? 0) * 0.3, (frame.presence[8] ?? 0) * 0.3)
        : 0;
      // Breathes and pulses with the portal (RingPortal writes frame.portalEnergy).
      const e = frame.presence[7] ? frame.portalEnergy / Math.max(0.001, frame.presence[7]) : 1;
      portal.current.intensity = 82 * p * Math.min(1.6, Math.max(0.85, e));
    }
  });

  return (
    <>
      <pointLight
        ref={core}
        name="light-core"
        position={WORLD.core}
        color="#52c7ea"
        intensity={0}
        distance={7.5}
        decay={2}
      />
      <pointLight
        ref={portal}
        name="light-portal"
        position={[px, py, pz + 2.5]}
        color="#52c7ea"
        intensity={0}
        distance={22}
        decay={2}
      />
    </>
  );
}

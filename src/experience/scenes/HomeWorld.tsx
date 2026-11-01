'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import type { TierConfig } from '../quality/tiers';
import { WORLD } from '../orchestrator/camera-path';
import { frame } from '../orchestrator/frame-state';
import { OrbitalCore } from '../objects/core/OrbitalCore';
import { Planet } from '../objects/Planet';
import { Terrain, type TerrainShape } from '../objects/Terrain';
import { RingPortal } from '../objects/RingPortal';
import { Explorer } from '../objects/Explorer';
import { Aurora, DataStreams, Dust } from '../objects/Atmospherics';
import { UniverseStation } from './UniverseStation';

/** Shows children only while the camera is near the given path range (draw-call budget). */
function StationGate({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = frame.route === 'home' && frame.s >= from && frame.s <= to;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * The home "universe": one continuous world descending through stations S1→S9.
 * Every station is real geometry; distant stations are hidden, not unmounted, so shaders
 * are compiled once and travel never hitches.
 */
export function HomeWorld({ cfg, pixelRatio }: { cfg: TierConfig; pixelRatio: number }) {
  const seg = cfg.terrainSegments;
  const shapes = useMemo(() => {
    const hero: TerrainShape = {
      width: 150,
      depth: 96,
      segments: seg,
      seed: 3,
      farHeight: 9,
      nearHeight: 2.4,
      scale: 0.06,
      valley: { x: 6, width: 16, depth: 4.5 },
    };
    const journey: TerrainShape = {
      width: 180,
      depth: 110,
      segments: seg,
      seed: 12,
      farHeight: 11,
      nearHeight: 1.2,
      scale: 0.045,
      valley: { x: 0, width: 30, depth: 3.5 },
    };
    const portal: TerrainShape = {
      width: 120,
      depth: 80,
      segments: Math.round(seg * 0.8),
      seed: 21,
      farHeight: 8,
      nearHeight: 1.5,
      scale: 0.07,
      plateau: { x: -1.6, z: 14, radius: 9, height: 0.6 },
    };
    const horizon: TerrainShape = {
      width: 220,
      depth: 120,
      segments: seg,
      seed: 33,
      farHeight: 7,
      nearHeight: 1.4,
      scale: 0.05,
      valley: { x: 12, width: 40, depth: 4 },
    };
    return { hero, journey, portal, horizon };
  }, [seg]);

  const p = WORLD.portal;
  return (
    <>
      {/* S1 hero + S2 identity */}
      <StationGate from={0} to={1.7}>
        <OrbitalCore cfg={cfg} pixelRatio={pixelRatio} />
        <Planet
          name="hero-planet"
          position={WORLD.heroPlanet.position}
          radius={WORLD.heroPlanet.radius}
          lightDir={[-0.85, 0.3, 0.25]}
          surfaceA="#070c11"
          surfaceB="#26343e"
          atmosphere="#8fd9ff"
          atmosphereStrength={1.1}
          seed={2}
          fadeStation={0}
        />
        <Terrain name="hero-terrain" shape={shapes.hero} position={[0, WORLD.heroGroundY - 1.2, -26]} rimStrength={0.42} color="#06080b" />
        <Dust name="hero-dust" count={cfg.dust} center={[0, 0, -2]} size={[26, 14, 20]} pixelRatio={pixelRatio} stationIndex={0} />
      </StationGate>

      {/* S3 universe (+ S2/S4 transitions) */}
      <StationGate from={0.9} to={3.6}>
        <UniverseStation cfg={cfg} pixelRatio={pixelRatio} />
      </StationGate>

      {/* S4–S6 editorial stretch: calm drifting dust; capability data streams on high tier */}
      <StationGate from={2.2} to={6.0}>
        <Dust
          count={Math.round(cfg.dust * 0.8)}
          center={[0, -29, -8]}
          size={[40, 22, 26]}
          pixelRatio={pixelRatio}
          color="#a99bff"
        />
        {cfg.dataStreams ? <DataStreams center={WORLD.capabilities.center} stationIndex={5} pixelRatio={pixelRatio} /> : null}
      </StationGate>

      {/* S7 journey: low horizon, moon, aurora */}
      <StationGate from={5.35} to={6.85}>
        <Terrain shape={shapes.journey} position={[0, WORLD.journey.groundY, -48]} rimColor="#8fb3c8" rimStrength={0.38} color="#06080b" />
        <Planet
          position={WORLD.journey.moon}
          radius={6}
          lightDir={[-0.9, 0.25, 0.45]}
          surfaceA="#10161c"
          surfaceB="#56636e"
          atmosphere="#a6c8ff"
          atmosphereStrength={0.55}
          seed={5}
          fadeStation={6}
        />
        <Aurora position={[0, -44.5, -78]} width={170} height={20} stationIndex={6} />
      </StationGate>

      {/* S8 ask-ai: explorer before the portal */}
      <StationGate from={6.3} to={7.8}>
        <group position={p.center}>
          <RingPortal radius={p.radius} stationIndex={7} intensity={0.62} />
        </group>
        <Explorer position={[p.center[0] + 0.7, p.groundY + 0.6, p.center[2] + 5.4]} scale={1} />
        <Terrain shape={shapes.portal} position={[p.center[0] + 1.6, p.groundY, p.center[2] - 8]} rimStrength={0.7} rimColor="#5fd3ef" />
        <Dust count={Math.round(cfg.dust * 0.5)} center={[p.center[0], p.groundY + 2.5, p.center[2] + 4]} size={[18, 6, 14]} pixelRatio={pixelRatio} stationIndex={7} />
      </StationGate>

      {/* S9 contact: massive planet horizon */}
      <StationGate from={7.2} to={8.01}>
        <Planet
          position={WORLD.horizon.planet}
          radius={WORLD.horizon.planetRadius}
          lightDir={[-0.86, 0.32, 0.3]}
          surfaceA="#060d12"
          surfaceB="#1f303a"
          atmosphere="#6ef2d0"
          atmosphereStrength={1.4}
          seed={9}
          rotationSpeed={0.002}
          segments={128}
        />
        <Terrain shape={shapes.horizon} position={[0, WORLD.horizon.groundY, -52]} rimColor="#79e8cf" rimStrength={0.5} />
        <Aurora position={[-40, -66.5, -110]} width={110} height={12} stationIndex={8} colorA="#7ef7c9" colorB="#3fb6d6" strength={0.55} />
      </StationGate>
    </>
  );
}

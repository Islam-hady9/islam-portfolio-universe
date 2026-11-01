'use client';

import { Environment, Lightformer } from '@react-three/drei';

/**
 * Procedural studio environment for PBR reflections (no HDR download). Mostly neutral silver
 * panels with restrained cyan/violet strips, so chrome reads as silver with cinematic accents
 * (spec §6.5). Rendered once into a cube map (frames=1).
 */
export function SceneEnvironment() {
  return (
    <>
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#04060a']} />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#ffffff"
          position={[0, 6, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 3.5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#dfe8f2"
          position={[-6, 3, 5]}
          rotation={[0, Math.PI / 3, 0]}
          scale={[5, 5, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.9}
          color="#52c7ea"
          position={[-7, 0.5, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[9, 0.45, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#8b7cff"
          position={[7, 1.6, -2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[9, 0.45, 1]}
        />
        <Lightformer form="rect" intensity={0.5} color="#9fb4c8" position={[0, 0, -9]} scale={[14, 6, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#e8f6ff" position={[0, 0.5, 7]} scale={3} />
        <Lightformer
          form="rect"
          intensity={0.25}
          color="#5d7f86"
          position={[0, -6, 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 2, 1]}
        />
      </Environment>
      <ambientLight intensity={0.12} color="#9fb2c9" />
      {/* Cold key ("moonlight") from upper left. */}
      <directionalLight position={[-6, 9, 6]} intensity={0.55} color="#cdd9ff" />
      {/* Rim lights from behind: cyan left, violet right. */}
      <directionalLight position={[-9, 2.5, -10]} intensity={2.0} color="#52c7ea" />
      <directionalLight position={[9, 3.5, -8]} intensity={1.6} color="#8b7cff" />
    </>
  );
}

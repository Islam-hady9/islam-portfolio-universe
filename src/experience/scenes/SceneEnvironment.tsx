'use client';

import { Environment, Lightformer } from '@react-three/drei';

/**
 * Procedural studio environment for PBR reflections (no HDR download), rendered once into a cube
 * map (frames=1). Tuned for polished silver (spec §6.5): a broad top softbox for body
 * reflections, thin bright strips for crisp edge highlights on chamfers, a cool horizon band and
 * restrained cyan/violet accents — violet stays a nebula accent, never a hotspot on the metal.
 */
export function SceneEnvironment() {
  return (
    <>
      <Environment resolution={256} frames={1} background={false}>
        <color attach="background" args={['#0b1017']} />
        {/* Top softbox: the body reflection that makes chrome read as silver, not black. */}
        <Lightformer
          form="rect"
          intensity={2.4}
          color="#f2f6fb"
          position={[0, 7, 1]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 6, 1]}
        />
        {/* Thin edge strips (upper left / upper right) → crisp specular lines on chamfers. */}
        <Lightformer
          form="rect"
          intensity={2.5}
          color="#ffffff"
          position={[-5, 4, 4]}
          rotation={[0, Math.PI / 4, -0.5]}
          scale={[7, 0.18, 1]}
        />
        <Lightformer
          form="rect"
          intensity={2.0}
          color="#eaf3ff"
          position={[5, 2.5, 5]}
          rotation={[0, -Math.PI / 4, 0.35]}
          scale={[6, 0.14, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.0}
          color="#dfe8f2"
          position={[-6, 3, 5]}
          rotation={[0, Math.PI / 3, 0]}
          scale={[5, 5, 1]}
        />
        {/* Front softbox behind the viewer: silver body reflections on faces turned toward camera. */}
        <Lightformer form="rect" intensity={1.1} color="#dfe7ef" position={[2, 1.5, 10]} scale={[9, 4, 1]} />
        {/* Side softboxes: graded mid-tones across the ring bodies (silver, not black). */}
        <Lightformer form="rect" intensity={0.7} color="#c9d5e2" position={[-10, 1, -1]} scale={[8, 6, 1]} />
        <Lightformer form="rect" intensity={0.55} color="#c3cfdd" position={[10, 0, 2]} scale={[8, 6, 1]} />
        {/* Cool horizon band: mid-tones on the lower half of the rings. */}
        <Lightformer
          form="rect"
          intensity={0.55}
          color="#8fa7bd"
          position={[0, -1, -9]}
          scale={[18, 2.2, 1]}
        />
        {/* Restrained accents. */}
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#52c7ea"
          position={[-7, 0.5, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[9, 0.35, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.6}
          color="#8b7cff"
          position={[7, 1.6, -2]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 0.25, 1]}
        />
        <Lightformer form="ring" intensity={1.1} color="#e8f6ff" position={[0, 0.5, 7]} scale={3} />
        <Lightformer
          form="rect"
          intensity={0.3}
          color="#5d7f86"
          position={[0, -6, 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 2, 1]}
        />
      </Environment>
      <ambientLight intensity={0.12} color="#9fb2c9" />
      {/* Cold key ("moonlight") from upper left. */}
      <directionalLight position={[-6, 9, 6]} intensity={0.85} color="#d6e1ff" />
      {/* Rim lights from behind: cyan left, a faint violet right. */}
      <directionalLight position={[-9, 2.5, -10]} intensity={1.8} color="#52c7ea" />
      <directionalLight position={[9, 3.5, -8]} intensity={0.32} color="#8f8cff" />
    </>
  );
}

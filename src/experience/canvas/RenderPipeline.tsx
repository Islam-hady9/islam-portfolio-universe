'use client';

import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo } from 'react';
import { ACESFilmicToneMapping, HalfFloatType, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial } from 'three';
import type { TierConfig } from '../quality/tiers';
import { frame } from '../orchestrator/frame-state';
import { useExperience } from '@/state/experience-store';

/** Main pass without post-processing (lite tier): three's ACES output stage, no bloom. */
function PlainPass({ enabled }: { enabled: boolean }) {
  useFrame(({ gl, scene, camera }) => {
    if (!enabled) return;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.autoClear = true;
    gl.render(scene, camera);
  }, 1);
  return null;
}

/** Full-screen veil used to mask large jumps and reduced-motion cuts (≤ 350 ms dip). */
function VeilPass() {
  const { scene, camera, material } = useMemo(() => {
    const s = new Scene();
    const m = new ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uAlpha; void main(){ gl_FragColor = vec4(0.024, 0.027, 0.039, uAlpha); }`,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), m);
    mesh.frustumCulled = false;
    s.add(mesh);
    return { scene: s, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material: m };
  }, []);
  useEffect(
    () => () => {
      material.dispose();
      (scene.children[0] as Mesh).geometry.dispose();
    },
    [material, scene],
  );
  useFrame(({ gl }) => {
    if (frame.veil < 0.01) return;
    material.uniforms.uAlpha!.value = Math.min(0.92, frame.veil);
    const prev = gl.autoClear;
    gl.autoClear = false;
    gl.render(scene, camera);
    gl.autoClear = prev;
  }, 3);
  return null;
}

/**
 * Render ownership (spec §6.5): selective bloom on HDR emissives only (threshold 1.0, the DOM
 * text is never in the canvas), ACES tone mapping, gentle vignette. During a portal
 * transition the main pass pauses and the portal system draws on a transparent canvas.
 */
export function RenderPipeline({ cfg }: { cfg: TierConfig }) {
  const portalActive = useExperience((s) => s.portal !== null);
  return (
    <>
      {cfg.bloom ? (
        <EffectComposer enabled={!portalActive} multisampling={cfg.multisampling} frameBufferType={HalfFloatType} renderPriority={1}>
          <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.22} intensity={0.9} radius={0.74} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.3} darkness={0.62} />
        </EffectComposer>
      ) : (
        <PlainPass enabled={!portalActive} />
      )}
      <VeilPass />
    </>
  );
}

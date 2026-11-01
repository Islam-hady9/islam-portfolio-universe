import { Color, MeshPhysicalMaterial, MeshStandardMaterial, type Material } from 'three';
import { SHELL_FRAGMENT_BODY, SHELL_FRAGMENT_HEAD, SHELL_VERTEX_BODY, SHELL_VERTEX_HEAD } from './shaders';

export interface ShellUniforms {
  uTime: { value: number };
  uBreath: { value: number };
  uOpen: { value: number };
  uCopper: { value: number };
  uCopperColor: { value: Color };
}

export interface CoreMaterials {
  /** Polished outer faces, chamfers, caps, pivots, ticks. */
  chrome: Material;
  /** Brushed channel interior (anisotropic on physical tiers — needs geometry tangents). */
  brushed: Material;
  /** Dark anodised carriages riding the rings. */
  anodised: Material;
  /** Fractured shell panels (animated in the vertex shader). */
  shell: Material;
  shellUniforms: ShellUniforms;
  /** HDR cyan indicator studs (bloom). */
  stud: Material;
  all: Material[];
}

/**
 * Physically based core materials (spec §6.5: layered silver/brushed metal, meaningful
 * specularity). Physical tiers add clearcoat and anisotropy; lite uses standard materials
 * with matched base values so the look stays consistent across tiers.
 */
export function createCoreMaterials(physical: boolean): CoreMaterials {
  const chrome = physical
    ? new MeshPhysicalMaterial({
        color: new Color('#e2e8ee'),
        metalness: 1,
        roughness: 0.19,
        clearcoat: 0.45,
        clearcoatRoughness: 0.12,
        envMapIntensity: 2.4,
      })
    : new MeshStandardMaterial({
        color: new Color('#dde3e9'),
        metalness: 1,
        roughness: 0.22,
        envMapIntensity: 1.9,
      });

  const brushed = physical
    ? new MeshPhysicalMaterial({
        color: new Color('#5d6670'),
        metalness: 1,
        roughness: 0.3,
        anisotropy: 0.8,
        anisotropyRotation: 0,
        envMapIntensity: 1.7,
      })
    : new MeshStandardMaterial({
        color: new Color('#59626b'),
        metalness: 1,
        roughness: 0.36,
        envMapIntensity: 1.5,
      });

  const anodised = physical
    ? new MeshPhysicalMaterial({
        color: new Color('#1a2026'),
        metalness: 0.9,
        roughness: 0.28,
        clearcoat: 0.6,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.4,
      })
    : new MeshStandardMaterial({
        color: new Color('#1c2228'),
        metalness: 0.9,
        roughness: 0.32,
        envMapIntensity: 1.3,
      });

  const shellUniforms: ShellUniforms = {
    uTime: { value: 0 },
    uBreath: { value: 0.018 },
    uOpen: { value: 0 },
    uCopper: { value: 0 },
    uCopperColor: { value: new Color('#ff9550') },
  };
  const shell = physical
    ? new MeshPhysicalMaterial({
        color: new Color('#1d242b'),
        metalness: 0.88,
        roughness: 0.38,
        clearcoat: 0.32,
        clearcoatRoughness: 0.32,
        envMapIntensity: 1.05,
      })
    : new MeshStandardMaterial({
        color: new Color('#1f262d'),
        metalness: 0.86,
        roughness: 0.44,
        envMapIntensity: 0.95,
      });
  shell.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shellUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SHELL_VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SHELL_VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SHELL_FRAGMENT_HEAD}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SHELL_FRAGMENT_BODY}`);
  };
  shell.customProgramCacheKey = () => 'iu-core-shell';

  const stud = new MeshStandardMaterial({
    color: '#000000',
    emissive: new Color('#52c7ea'),
    emissiveIntensity: 1.5,
    toneMapped: false,
  });

  return {
    chrome,
    brushed,
    anodised,
    shell,
    shellUniforms,
    stud,
    all: [chrome, brushed, anodised, shell, stud],
  };
}

import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  Vector3,
} from 'three';
import { NOISE_GLSL } from '../../shaders/noise';

/** Vertical gradient sky dome for a portal world (inverted sphere). */
export function skyDome(
  top: string,
  horizon: string,
  glowDir: [number, number, number],
  glow: string,
  glowStrength = 0.5,
) {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new Color(top) },
      uHorizon: { value: new Color(horizon) },
      uGlow: { value: new Color(glow) },
      uGlowDir: { value: glowDir },
      uGlowStrength: { value: glowStrength },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uGlowDir; uniform float uGlowStrength;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = mix(uHorizon, uTop, smoothstep(-0.05, 0.6, d.y));
        float g = pow(max(dot(d, normalize(uGlowDir)), 0.0), 16.0);
        col += uGlow * g * uGlowStrength;
        col += uGlow * smoothstep(0.55, 0.9, iu_fbm3_lo(d * 4.0)) * smoothstep(0.0, 0.5, d.y) * 0.05;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Soft additive glow sprite (use on a plane that faces the camera). */
export function glowMaterial(color: string, intensity = 1, falloff = 6) {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(color) },
      uIntensity: { value: intensity },
      uFalloff: { value: falloff },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; uniform float uFalloff; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float g = exp(-d * d * uFalloff) + exp(-d * 22.0) * 1.5;
        gl_FragColor = vec4(uColor * g * uIntensity, g * uIntensity);
      }`,
  });
}

/** Per-world activity: worlds only animate while recently rendered (saves CPU). */
export const portalActivity: Record<string, { lastRendered: number; hover: number; time: number }> = {};

export function activity(slug: string) {
  return (portalActivity[slug] ??= { lastRendered: 0, hover: 0, time: 0 });
}

/**
 * Camera-facing ribbon strips along polylines (replaces 1-px GL lines). The vertex shader
 * widens each strip in proportion to its camera distance (RIBBON_GLSL, uAngular = half-width
 * in radians), so a line keeps one apparent width near and far and never breaks into dots
 * when it would be sub-pixel. Attributes: aT (0 to 1 along the path), aLane (path index),
 * aSide (unit side vector, facing the nominal camera), aAcross (-1 or 1).
 */
export function ribbonGeometry(paths: Vector3[][], camera: Vector3): BufferGeometry {
  const pos: number[] = [];
  const t: number[] = [];
  const lane: number[] = [];
  const sides: number[] = [];
  const across: number[] = [];
  const index: number[] = [];
  const tangent = new Vector3();
  const toCam = new Vector3();
  const side = new Vector3();
  let base = 0;
  paths.forEach((pts, li) => {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      tangent.subVectors(pts[Math.min(n - 1, i + 1)]!, pts[Math.max(0, i - 1)]!).normalize();
      toCam.subVectors(camera, p).normalize();
      side.crossVectors(tangent, toCam).normalize();
      pos.push(p.x, p.y, p.z, p.x, p.y, p.z);
      sides.push(side.x, side.y, side.z, side.x, side.y, side.z);
      t.push(i / (n - 1), i / (n - 1));
      lane.push(li, li);
      across.push(-1, 1);
      if (i < n - 1) {
        const a = base + i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += n * 2;
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aT', new BufferAttribute(new Float32Array(t), 1));
  g.setAttribute('aLane', new BufferAttribute(new Float32Array(lane), 1));
  g.setAttribute('aSide', new BufferAttribute(new Float32Array(sides), 3));
  g.setAttribute('aAcross', new BufferAttribute(new Float32Array(across), 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.5;
  return g;
}

/** Vertex helper for ribbonGeometry: iuRibbon(position) returns the widened clip position. */
export const RIBBON_GLSL = /* glsl */ `
  attribute vec3 aSide;
  attribute float aAcross;
  uniform float uAngular;
  vec4 iuRibbon(vec3 centre) {
    float dist = -(modelViewMatrix * vec4(centre, 1.0)).z;
    return projectionMatrix * modelViewMatrix * vec4(centre + aSide * aAcross * uAngular * dist, 1.0);
  }
`;

import { AdditiveBlending, BackSide, Color, ShaderMaterial } from 'three';
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

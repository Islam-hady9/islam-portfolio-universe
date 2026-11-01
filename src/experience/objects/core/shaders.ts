import { NOISE_GLSL } from '../../shaders/noise';

/** Shared vertex shader for the emitter layers (object-space position, world normal, view dir). */
export const EMITTER_VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * Circuit sphere: printed-circuit traces wrapped on a sphere (hashed cell grid in lat/lon),
 * via pads, slow latitude rings and energy pulses travelling along the traces. Dark base so
 * the structure reads; only pulses and pads reach HDR values for the bloom pass.
 */
export const CIRCUIT_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uBase;
  uniform vec3 uTrace;
  uniform vec3 uHot;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;

  float iu_h12(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 p = normalize(vPos);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    vec2 g = vec2((lon / 6.28318531 + 0.5) * 32.0, (lat / 3.14159265 + 0.5) * 16.0);
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = iu_h12(cell);
    vec2 aa = fwidth(g) * 1.25 + 0.03;
    float horiz = 1.0 - smoothstep(0.0, aa.y, abs(f.y));
    float vert = 1.0 - smoothstep(0.0, aa.x, abs(f.x));
    float trace = h < 0.42 ? horiz : (h < 0.74 ? vert : max(horiz * step(f.x, 0.0), vert * step(0.0, f.y)));
    trace *= step(0.14, fract(h * 7.31));
    float pad = (1.0 - smoothstep(0.1, 0.17, length(f))) * step(0.7, fract(h * 13.7));
    float along = h < 0.42 ? g.x : g.y;
    float pulse = pow(fract(along * 0.125 - uTime * (0.2 + h * 0.28) + h * 5.0), 22.0);
    float rc = (lat / 3.14159265 + 0.5) * 5.0 + uTime * 0.025;
    float ringLine = 1.0 - smoothstep(0.0, fwidth(rc) * 1.5 + 0.012, abs(fract(rc) - 0.5));
    float pole = smoothstep(1.48, 1.12, abs(lat));
    vec3 n = normalize(vN);
    float fres = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.2);
    vec3 col = uBase * (0.22 + 0.78 * fres);
    col += uTrace * (trace * 0.75 + pad * 1.25 + ringLine * 0.55) * pole;
    col += uHot * pulse * (trace + pad) * pole * 2.4;
    col += uTrace * fres * 0.8;
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

/** Plasma aura between emitter and shell: fresnel halo modulated by slow flowing noise. */
export const AURA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec3 vPos;
  varying vec3 vN;
  varying vec3 vView;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vN);
    float fres = pow(1.0 - abs(dot(n, normalize(vView))), 2.6);
    float flow = iu_fbm3_lo(vPos * 2.4 + vec3(0.0, uTime * 0.18, uTime * 0.11));
    float a = fres * (0.45 + 0.95 * flow);
    gl_FragColor = vec4(uColor * a * uIntensity, 1.0);
  }
`;

export const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * d * 7.0) * 0.75 + exp(-d * 18.0) * 1.1;
    gl_FragColor = vec4(uColor * g * uIntensity, g * uIntensity);
  }
`;

export const SPARK_VERTEX = /* glsl */ `
  attribute vec4 aOrbit;   // radius, speed, phase, inclination
  attribute vec3 aTint;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFade;
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float a = aOrbit.z + uTime * aOrbit.y;
    float inc = aOrbit.w;
    vec3 p = vec3(cos(a) * aOrbit.x, sin(a * 1.7 + aOrbit.z) * 0.35, sin(a) * aOrbit.x);
    p = vec3(p.x, p.y * cos(inc) - p.z * sin(inc), p.y * sin(inc) + p.z * cos(inc));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float flicker = 0.55 + 0.45 * sin(uTime * (3.0 + aOrbit.y * 6.0) + aOrbit.z * 30.0);
    gl_PointSize = (1.1 + flicker * 1.4) * uPixelRatio * (9.0 / -mv.z);
    vTint = aTint;
    vAlpha = flicker * uFade;
  }
`;

export const SPARK_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTint * a * 2.2, a);
  }
`;

/** Shell panels: per-panel breathing and intro assembly (vertex), copper edge inlays (fragment). */
export const SHELL_VERTEX_HEAD = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aPhase;
  attribute float aGlow;
  uniform float uTime;
  uniform float uBreath;
  uniform float uOpen;
  varying float vGlow;
`;

export const SHELL_VERTEX_BODY = /* glsl */ `
  float iuBreathe = 0.5 + 0.5 * sin(uTime * 0.55 + aPhase);
  transformed += aCenter * (uBreath * iuBreathe + uOpen * (0.55 + 0.45 * fract(aPhase * 3.17)));
  vGlow = aGlow;
`;

export const SHELL_FRAGMENT_HEAD = /* glsl */ `
  uniform vec3 uCopperColor;
  uniform float uCopper;
  varying float vGlow;
`;

export const SHELL_FRAGMENT_BODY = /* glsl */ `
  totalEmissiveRadiance += uCopperColor * vGlow * uCopper;
`;

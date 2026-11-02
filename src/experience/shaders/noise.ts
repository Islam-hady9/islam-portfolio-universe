/**
 * Original hash-based value noise + fbm used by the procedural shaders. Cheap, stable on
 * mobile GPUs for the small coordinate ranges used here.
 */
export const NOISE_GLSL = /* glsl */ `
float iu_hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float iu_noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = iu_hash3(i);
  float n100 = iu_hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = iu_hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = iu_hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = iu_hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = iu_hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = iu_hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = iu_hash3(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

float iu_fbm3(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 5; i++) {
    s += a * iu_noise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 4.1);
    a *= 0.5;
  }
  return s;
}

float iu_fbm3_lo(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    s += a * iu_noise3(p);
    p = p * 2.07 + vec3(3.1, 1.3, 7.7);
    a *= 0.5;
  }
  return s;
}
`;

/** ACES-fitted tone map + sRGB encode for passes rendered outside three's output stage. */
export const TONEMAP_GLSL = /* glsl */ `
vec3 iu_aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 iu_linearToSrgb(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
`;

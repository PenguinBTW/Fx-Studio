// FREEFALL shared GLSL: value noise / fbm (3D), camera ray helper. Names are ff_-prefixed to stay clear of GLSL_COMMON.
export const FFN = /* glsl */ `
uniform float uT, uZ, uDZ; uniform vec2 uRes;
float ff_h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ff_n(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(ff_h(i), ff_h(i + vec3(1, 0, 0)), f.x), mix(ff_h(i + vec3(0, 1, 0)), ff_h(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ff_h(i + vec3(0, 0, 1)), ff_h(i + vec3(1, 0, 1)), f.x), mix(ff_h(i + vec3(0, 1, 1)), ff_h(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float ff_fbm(vec3 p, int o) { float a = 0.5, s = 0.0; for (int i = 0; i < 8; i++) { if (i >= o) break; s += a * ff_n(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float ff_h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 ff_uv() { return (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0; }
vec3 ff_ray(vec3 fw, vec3 upHint, float tanHalf, float roll) { vec2 q = ff_uv(); float c = cos(roll), s = sin(roll); q = mat2(c, -s, s, c) * q;
  vec3 r = normalize(cross(fw, upHint)), u = cross(r, fw); return normalize(fw + (q.x * r + q.y * u) * tanHalf); }
vec2 ff_sph(vec3 ro, vec3 rd, float R) { float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c; if (h < 0.0) return vec2(-1.0); h = sqrt(h); return vec2(-b - h, -b + h); }
`;
/** Shared fall language: radial streaks converging on the dive point; k = strength (scenes pass |dZ|-based speed). */
export const FF_SPEED = /* glsl */ `
float ff_speed(float k, float seed) { vec2 q = ff_uv(); float r = length(q), a = atan(q.y, q.x);
  float id = floor(a * 140.0 / 6.2831853); float hh = ff_h2(vec2(id, seed)); float ph = fract(hh * 7.0 - uT * (0.8 + hh) * 2.2);
  float seg = smoothstep(0.0, 0.08, ph) * smoothstep(0.35, 0.1, ph) * step(0.72, hh);
  float w = abs(fract(a * 140.0 / 6.2831853) - 0.5); return k * seg * smoothstep(0.5, 0.15, w) * smoothstep(0.15, 0.9, r) * smoothstep(0.0, 0.2, fract(r * (1.0 + hh) - ph * 2.0)); }
`;

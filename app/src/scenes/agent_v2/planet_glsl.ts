// Shared planet surface functions (S1 build, S2 crumble shards): gradient noise, warped continents, ridged ranges.
export const PNOISE = /* glsl */ `
vec3 ph33(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453); }
float gn(vec3 p) { vec3 i = floor(p), f = fract(p); vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(dot(ph33(i), f), dot(ph33(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x), mix(dot(ph33(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)), dot(ph33(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
             mix(mix(dot(ph33(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)), dot(ph33(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x), mix(dot(ph33(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)), dot(ph33(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z); }
float pfbm(vec3 p, int o) { float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= o) break; s += a * gn(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float pridge(vec3 p) { float s = 0.0, a = 0.5, w = 1.0; for (int i = 0; i < 6; i++) { float n = 1.0 - abs(gn(p)); n *= n; n *= w; w = clamp(n * 1.8, 0.0, 1.0); s += a * n; p = p * 2.1 + vec3(3.1); a *= 0.5; } return s; }
// continents in [-0.6, 0.9]: domain-warped fbm plus ridged ranges along continental interiors
float pheight(vec3 n, int oct) { vec3 q = n * 1.25; q += 0.4 * vec3(pfbm(q + 3.1, 3), pfbm(q + 7.7, 3), pfbm(q + 1.3, 3));
  float c = pfbm(q * 1.3, oct); float land = smoothstep(-0.02, 0.2, c);
  return c * 0.95 + pridge(n * 3.4 + q * 0.8) * 0.6 * land - 0.05; }
float pcloud(vec3 n, float t) { vec3 q = n * 2.2 + vec3(t * 0.03, 0.0, 0.0); q += 0.6 * vec3(pfbm(q + 5.2, 3), pfbm(q + 1.9, 3), pfbm(q + 8.4, 3));
  return smoothstep(0.02, 0.32, pfbm(q * 1.6, 5) + 0.12 * (1.0 - abs(n.y))); }
// molten crust: voronoi plates with glowing cracks
float pcrack(vec3 p) { vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) { vec3 g = vec3(x, y, z); vec3 o = 0.5 + 0.45 * ph33(i + g); float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }
vec3 blackbody(float k) { return vec3(1.0, 0.25 + 0.6 * k, 0.04 + 0.5 * k * k) * (0.5 + 3.5 * k * k); }
`;

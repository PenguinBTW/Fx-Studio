// S02 thunderhead (4-8 s, Z 5 -> 2.6): an infinite-zoom stack of billowed cloud decks (bump-lit fbm sheets cycling
// toward the lens on the Z clock), lightning on the beats branches between decks and lights them from inside, and the
// black moonlit ocean opens up underneath for the drop.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
const int N = 7; const float SPAN = 2.4;
float flashAt(float k) { float tk = 4.22 + k * 0.5 + 0.25 * step(3.5, k); float d = uT - tk; if (d < 0.0 || k > 6.5) return 0.0; return exp(-d * 10.0) * (0.65 + 0.35 * sin(d * 80.0 + k)); }
float boltD(vec2 q, vec2 a, float seed, float y0, float y1) { // jagged channel from (a.x, y0) down to y1
  if (q.y > y0 || q.y < y1) return 1.0; float y = q.y; float x = a.x; float amp = 0.22;
  for (int o = 0; o < 5; o++) { float f = pow(2.2, float(o)) * 3.0; x += amp * (ff_n(vec3(y * f, seed, float(o))) - 0.5); amp *= 0.5; }
  return abs(q.x - x); }
float cl(vec2 p, float seed) { return ff_fbm(vec3(p, seed), 5); }
void main() {
  vec2 q = ff_uv(); float w = (5.0 - uZ) * 1.55; vec3 C;
  // flash state
  float F = 0.0; vec2 fp = vec2(0.0); float fk = 0.0; for (int k = 0; k < 7; k++) { float f = flashAt(float(k)); if (f > F) { F = f; fk = float(k); fp = vec2(sin(fk * 2.3) * 0.35, cos(fk * 1.7) * 0.5); } }
  // ocean: visible through the gaps once the decks thin out
  float sea = smoothstep(6.4, 7.6, uT); vec2 oq = q * (1.0 + 2.5 * smoothstep(6.0, 8.0, uT)); vec3 n0 = normalize(vec3((ff_fbm(vec3(oq * 9.0, uT * 0.4), 4) - 0.5), (ff_fbm(vec3(oq * 9.0 + 7.0, uT * 0.4), 4) - 0.5), 0.6));
  vec3 ocean = vec3(0.004, 0.012, 0.04) + vec3(0.6, 0.7, 1.3) * pow(max(dot(n0, normalize(vec3(-0.2, 0.5, 1.0))), 0.0), 30.0) * 0.6 + vec3(0.6, 0.8, 1.8) * F * 0.5 * exp(-length(q - fp) * 2.0) * (0.4 + n0.x);
  C = mix(vec3(0.02, 0.0, 0.05), ocean * 1.6, sea);
  for (int i = 0; i < N; i++) { // back to front
    float k = float(N - 1 - i); float ph = fract((k + w) / float(N)); float id = floor((k + w) / float(N)) * float(N) + k;
    float sc = exp(ph * SPAN); vec2 uv = q / sc * 2.2 + vec2(ff_h2(vec2(id, 1.0)), ff_h2(vec2(id, 2.0))) * 9.0; float seed = id * 3.7;
    float thr = 0.5 + 0.06 * sin(id); float n = cl(uv, seed); float a = smoothstep(thr - 0.02, thr + 0.12, n);
    a *= smoothstep(0.0, 0.25, ph) * smoothstep(1.0, 0.8, ph) * (1.0 - 0.92 * sea); if (a < 0.003) continue;
    float e = 0.02; vec3 nrm = normalize(vec3(cl(uv + vec2(e, 0.0), seed) - n, cl(uv + vec2(0.0, e), seed) - n, e * 0.35));
    float depth = 1.0 - ph; vec3 hue = mix(vec3(0.16, 0.06, 0.34), mix(vec3(0.05, 0.08, 0.36), vec3(0.3, 0.04, 0.26), step(0.5, fract(id * 0.618))), fract(id * 0.37)); vec3 base = mix(hue, hue * 0.12, depth);
    vec3 moon = normalize(vec3(-0.3, 0.8, 0.5)); float md = max(dot(nrm, moon), 0.0); vec3 col = base * (0.35 + 0.9 * md) + vec3(0.9, 0.25, 0.75) * pow(1.0 - a, 3.0) * 0.25 * md;
    vec3 Ld = normalize(vec3(fp - q, 0.25 + depth * 0.4)); float fl = F * exp(-length(q - fp) * (1.2 + depth)) * (0.4 + 1.2 * max(dot(nrm, Ld), 0.0));
    col += vec3(0.45, 0.75, 1.8) * fl * (1.0 - 0.6 * depth) + vec3(0.7, 0.5, 1.6) * F * 0.08 * (1.0 - depth);
    float edge = (1.0 - sea) * smoothstep(0.0, 0.5, a) * (1.0 - smoothstep(0.5, 1.0, a)); col += vec3(1.0, 0.4, 0.9) * edge * 0.2 * (1.0 + 4.0 * fl);
    float pocket = pow(cl(uv * 0.6, seed + 5.0), 3.0) * (0.6 + 0.4 * sin(uT * 23.0 + id * 4.0)) * step(0.55, fract(sin(id * 12.9) * 43.7)); col += vec3(0.55, 0.35, 1.4) * pocket * 0.9 * (1.0 - depth) * smoothstep(0.3, 0.9, a); col *= mix(0.55, 1.0, smoothstep(thr, thr + 0.25, n));
    C = mix(C, col, a);
    if (i == 3 && F > 0.03) { float d = boltD(q, fp, fk * 9.1, fp.y + 0.6, fp.y - 1.6); float d2 = boltD(q, fp + vec2(0.12, -0.3), fk * 5.3 + 2.0, fp.y - 0.3, fp.y - 0.95);
      C += vec3(0.75, 0.85, 1.9) * F * (exp(-d * 260.0) * 3.0 + exp(-d * 22.0) * 0.35 + exp(-d2 * 320.0) * 1.6 + exp(-d2 * 30.0) * 0.15); } }
  C += vec3(0.55, 0.6, 1.0) * ff_speed(0.12 + 0.5 * sea, 2.0) * (0.25 + F);
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.0, bloom: 0.9, bloomThreshold: 0.55, halation: 0.35, vignette: 0.4, grain: 0.05, ca: 0.2 + 0.05 * Math.abs(dZ(t)) }));

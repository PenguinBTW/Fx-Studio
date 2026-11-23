// S02 thunderhead (4-8 s, Z 5 -> 2.6, units km): falling straight down onto a field of raymarched cumulonimbus towers
// (SDF heightfield + 3D billow fbm), moonlit from low on the horizon so every tower carries a silver lining. Lightning
// on the beats crawls across the anvils and lights the towers from inside; the camera punches through the deck into
// the lightning-lit interior and out over the black ocean, where a branching strike fills the frame.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
const vec3 MOON = normalize(vec3(-0.75, 0.32, 0.45));
float flashAt(float k) { float tk = 4.22 + k * 0.5 + 0.25 * step(3.5, k); float d = uT - tk; if (d < 0.0 || k > 6.5) return 0.0; return exp(-d * 9.0) * (0.65 + 0.35 * sin(d * 80.0 + k)); }
float boltD(vec2 q, vec2 a, float seed, float y0, float y1) { if (q.y > y0 || q.y < y1) return 1.0; float x = a.x, amp = 0.26;
  for (int o = 0; o < 5; o++) { float f = pow(2.2, float(o)) * 2.6; x += amp * (ff_n(vec3(q.y * f, seed, float(o))) - 0.5); amp *= 0.5; } return abs(q.x - x); }
float tops(vec2 x) { float h = ff_fbm(vec3(x * 0.045, 1.0), 4); float t = ff_fbm(vec3(x * 0.11, 7.0), 3);
  return 1.5 + 10.5 * smoothstep(0.42, 0.8, h) * (0.55 + 0.45 * t); }
float cloud(vec3 p) { float b = ff_fbm(p * vec3(0.26, 0.4, 0.26), 4); b = 1.0 - abs(2.0 * b - 1.0); return (p.y - tops(p.xz)) * 0.6 - (b - 0.55) * 3.2 + max(2.0 - p.y, 0.0) * 0.8; }
vec3 bolt(vec2 q, float F, vec2 fp, float fk, float big) { float d = boltD(q, fp, fk * 9.1, 1.2, -1.2), d2 = boltD(q, fp + vec2(0.18, -0.25), fk * 5.3 + 2.0, fp.y + 0.2, fp.y - 0.9),
  d3 = boltD(q, fp + vec2(-0.2, 0.35), fk * 3.1 + 5.0, fp.y + 0.8, fp.y - 0.1); vec3 c = vec3(0.7, 0.8, 1.9) * F;
  return c * (exp(-d * 300.0 / big) * 3.5 + exp(-d * 18.0 / big) * 0.2 + (exp(-d2 * 380.0) * 1.8 + exp(-d3 * 380.0) * 1.4 + (exp(-d2 * 30.0) + exp(-d3 * 30.0)) * 0.15)); }
void main() {
  vec2 q = ff_uv(); float fh = pow(10.0, uZ - 3.0); float alt = 0.25 + fh * 0.92; vec3 C = vec3(0.0);
  float F = 0.0, fk = 0.0; vec2 fp = vec2(0.0); for (int k = 0; k < 7; k++) { float f = flashAt(float(k)); if (f > F) { F = f; fk = float(k); fp = vec2(sin(fk * 2.3) * 0.35, cos(fk * 1.7) * 0.4); } }
  vec3 ro = vec3(3.0, alt, -2.0 + uT * 0.6); vec3 fw = normalize(vec3(0.0, -1.0, 0.55)); vec3 rd = ff_ray(fw, vec3(0.0, 0.0, 1.0), 0.546, 0.15 * sin(uT * 0.5));
  vec3 Lp = ro + vec3(fp.x, 0.0, fp.y) * fh * 1.1; Lp.y = 7.0; // flash source inside the towers
  // ocean
  float to = ro.y / max(-rd.y, 0.05); vec3 po = ro + rd * to; vec3 n0 = normalize(vec3(ff_fbm(vec3(po.xz * 6.0, uT * 0.5), 4) - 0.5, 3.0, ff_fbm(vec3(po.xz * 6.0 + 9.0, uT * 0.5), 4) - 0.5));
  vec3 ocean = vec3(0.003, 0.006, 0.02) + vec3(0.5, 0.6, 1.2) * pow(max(dot(reflect(rd, n0), MOON), 0.0), 40.0) * 0.5 + vec3(0.5, 0.7, 1.6) * F * exp(-length(po.xz - Lp.xz) * 0.35) * 0.5 * (0.1 + 6.0 * pow(abs(n0.x + n0.z), 1.5));
  // towers: soft volumetric march (empty space skipped on the SDF), two shadow taps toward the moon per sample
  float t = max(0.0, (ro.y - 13.5) / max(-rd.y, 0.05)); float T = 1.0; vec3 L = vec3(0.0);
  for (int i = 0; i < 72; i++) { vec3 p = ro + rd * t; if (p.y < 0.0 || t > to || T < 0.03) break; float c = cloud(p);
    if (c > 0.3) { t += c * 0.8; continue; } float d = clamp(0.2 - c * 1.6, 0.0, 1.0); float st = max(0.12, t * 0.012);
    if (d > 0.01) { float ld = clamp(0.2 - cloud(p + MOON * 0.9) * 1.6, 0.0, 1.0); float ld2 = clamp(0.2 - cloud(p + MOON * 2.4) * 1.6, 0.0, 1.0);
      float tr = exp(-(ld * 2.2 + ld2 * 1.6)); float ao = clamp((p.y - 1.0) / 11.0, 0.0, 1.0); float pw = 1.0 - exp(-d * 6.0);
      float dl = length(p - Lp); vec3 lum = vec3(0.95, 0.9, 1.12) * tr * pw * 0.8 * (0.15 + 0.85 * ao * ao) + mix(vec3(0.004, 0.002, 0.016), vec3(0.04, 0.025, 0.1), ao * ao)
        + vec3(0.55, 0.65, 1.8) * F * 2.2 / (1.0 + dl * dl * 0.2) + vec3(0.55, 0.12, 0.7) * 0.03 * (1.0 - ao);
      float a = 1.0 - exp(-d * st * 2.6); L += T * a * lum; T *= 1.0 - a; }
    t += st; }
  C = L + T * ocean; C = mix(C, vec3(0.015, 0.008, 0.05), (1.0 - exp(-t * 0.003)) * (1.0 - T));
  float below = smoothstep(2.0, 1.2, alt); if (below > 0.0) C = mix(C, ocean, below * 0.85);
  float inside = smoothstep(12.0, 9.0, alt);
  C += bolt(q, F, fp, fk, mix(0.6, 1.6, below)) * (0.3 + 0.7 * max(inside, below));
  C += vec3(0.55, 0.6, 1.0) * ff_speed(0.1 + 0.5 * (inside + below), 2.0) * (0.3 + F);
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 0.9, bloom: 0.85, bloomThreshold: 0.6, halation: 0.35, vignette: 0.4, grain: 0.045, ca: 0.2 + 0.05 * Math.abs(dZ(t)) }));

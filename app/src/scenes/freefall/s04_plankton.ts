// S04 plankton (11-15 s, Z -2.3 -> -3.4): inside the drop's sea water. Layers of Noctiluca-like cells cycle toward the
// lens on the Z clock; each is shaded as a translucent sphere (membrane rim, granules, nucleus) with depth-of-field by
// layer, and fires its bioluminescent flash as it passes the focal plane.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
const int N = 8; const float SPAN = 2.2;
vec3 cell(vec2 f, float r, float blur, float h, float flash, float ph) {
  float d = length(f * (h < 0.35 ? vec2(1.0, 0.62) : vec2(1.0))) / r; if (d > 1.6 + blur * 3.0) return vec3(0.0);
  float body = smoothstep(1.0 + blur, 1.0 - blur - 0.02, d); float z = sqrt(max(0.0, 1.0 - d * d));
  float rim = pow(1.0 - z, 3.0) * body; float gran = ff_fbm(vec3(f / r * 4.0, h * 30.0), 3);
  vec2 nc = vec2(0.3 * (h - 0.5), 0.2 * (fract(h * 7.0) - 0.5)); float nuc = smoothstep(0.32 + blur, 0.2 - blur, length(f / r - nc));
  vec3 hueA = h > 0.86 ? vec3(0.9, 0.15, 1.0) : h > 0.74 ? vec3(0.5, 1.0, 0.25) : vec3(0.05, 0.75, 1.0);
  vec3 c = hueA * (rim * 1.6 + body * gran * 0.25 + nuc * 0.5) * (0.35 + 1.2 * flash);
  float ang = atan(f.y, f.x); float hair = pow(abs(sin(ang * (22.0 + floor(h * 4.0) * 6.0) + h * 40.0 + uT * 2.5)), 30.0) * smoothstep(1.45, 1.02, d) * smoothstep(0.98, 1.04, d) * (1.0 - blur * 1.5);
  c += hueA * hair * 0.7 + mix(hueA, vec3(1.0), 0.5) * smoothstep(0.09, 0.0, length(f / r - nc * -1.4)) * 0.6 * body;
  c += hueA * flash * exp(-d * d * 1.2) * 0.9; // flash halo
  c += vec3(0.6, 0.9, 1.0) * flash * 1.1 * smoothstep(0.4, 0.0, d) * gran;
  return c; }
void main() {
  vec2 q = ff_uv(); float w = (-2.3 - uZ) * 6.5; vec3 C = vec3(0.0, 0.012, 0.03);
  // light shafts from the surface + marine snow haze
  float a = atan(q.x, q.y + 2.6); C += vec3(0.0, 0.12, 0.2) * pow(ff_n(vec3(a * 14.0, uT * 0.3, 0.0)), 3.0) * smoothstep(-1.0, 1.0, q.y) * 0.6;
  for (int i = 0; i < N; i++) { float k = float(N - 1 - i); float ph = fract((k + w) / float(N)); float id = floor((k + w) / float(N)) * float(N) + k;
    float sc = exp(ph * SPAN); vec2 p = q / sc * 3.0 + vec2(ff_h2(vec2(id, 1.0)), ff_h2(vec2(id, 4.0))) * 20.0;
    vec2 cid = floor(p), f = fract(p) - 0.5; float h = ff_h2(cid + id * 7.31); if (h < 0.68) continue; h = (h - 0.68) / 0.32;
    vec2 o = (vec2(ff_h2(cid + 11.0 + id), ff_h2(cid + 17.0 + id)) - 0.5) * 0.2; float r = 0.1 + 0.16 * ff_h2(cid + 5.0 + id);
    float blur = abs(ph - 0.62) * 0.55; float fade = smoothstep(0.0, 0.2, ph) * smoothstep(1.0, 0.86, ph);
    float flash = smoothstep(0.5, 0.62, ph) * exp(-max(0.0, ph - 0.62) * 9.0) * step(0.55, fract(h * 13.0));
    C += cell(f - o, r, blur, h, flash, ph) * fade * (0.5 + ph) * smoothstep(0.5, 0.38, max(abs(f.x), abs(f.y))); }
  // marine snow motes
  vec2 sp = q * 22.0 + vec2(0.0, uT * 3.0); vec2 sid = floor(sp); float mote = step(0.93, ff_h2(sid)) * smoothstep(0.12, 0.0, length(fract(sp) - 0.5)); C += vec3(0.5, 0.8, 0.9) * mote * 0.4;
  C += vec3(0.2, 0.8, 1.0) * ff_speed(clamp(abs(uDZ) * 0.15, 0.0, 0.4), 4.0) * 0.5;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.15, bloom: 0.85, bloomThreshold: 0.6, halation: 0.4, vignette: 0.45, grain: 0.05, ca: 0.3 + 0.04 * Math.abs(dZ(t)) }));

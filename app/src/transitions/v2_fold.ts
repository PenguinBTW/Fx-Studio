// v2_fold: the written desk sheet folds itself shut like origami (top half down, then right half over), hinged with
// perspective so each flap rises toward the lens, over the bare desk (s4 re-rendered after the sheet is gone); the
// packet then unfolds again with the live paper act as its pages and grows to fill the frame: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
const vec3 PAPER = vec3(0.97, 0.94, 0.88);
const float K = 0.9;
const float PI = 3.14159265;
const vec2 gC = vec2(0.5);
const vec2 gH0 = vec2(0.312, 0.392); // the sheet's half-size in the top-down desk frame
float mapA; float gBack;
vec3 S(sampler2D T, vec2 q) { return texture2D(T, mix(q, gC + (q - 0.5) * 2.0 * gH0, mapA)).rgb; }
// back faces: plain paper with a faint mirrored show-through of the ink; lit by the desk light in main()
vec3 back(vec3 src, float c, float g) { gBack = 1.0; float lum = dot(src, vec3(0.3, 0.55, 0.15)); return PAPER * (0.94 - 0.42 * (1.0 - smoothstep(0.2, 0.9, lum))) * (0.72 + 0.28 * (-c)) * (1.0 - 0.25 * smoothstep(0.95, 1.0, g)); }
vec4 f1(vec2 p, float th, sampler2D T) {
  float c = cos(th), sn = sin(th), Y = p.y - 0.5, den = c + K * Y * sn;
  if (abs(den) > 1e-4) { float s = Y / den;
    if (s >= 0.0 && s <= 0.5) { float P = 1.0 / (1.0 - K * s * sn), x = 0.5 + (p.x - 0.5) / P;
      if (x >= 0.0 && x <= 1.0) { vec3 t = S(T, vec2(x, 0.5 + s)); float g = s / 0.5;
        if (c >= 0.0) return vec4(t * (0.42 + 0.58 * c) * (0.94 + 0.1 * g), 1.0);
        return vec4(back(t, c, g), 1.0); } } }
  if (p.y >= 0.0 && p.y < 0.5 && p.x >= 0.0 && p.x <= 1.0) return vec4(S(T, p) * (1.0 - 0.3 * exp(-(0.5 - p.y) * 60.0) * step(1.2, th)), 1.0);
  return vec4(0.0);
}
vec4 f2(vec2 p, float th1, float th2, sampler2D T) {
  float c = cos(th2), sn = sin(th2), X = p.x - 0.5, den = c + K * X * sn;
  if (abs(den) > 1e-4) { float s = X / den;
    if (s >= 0.0 && s <= 0.5) { float P = 1.0 / (1.0 - K * s * sn); vec4 b = f1(vec2(0.5 + s, 0.5 + (p.y - 0.5) / P), th1, T);
      if (b.a > 0.0) { if (c >= 0.0) return vec4(b.rgb * (0.42 + 0.58 * c), 1.0); return vec4(back(b.rgb, c, s / 0.5), 1.0); } } }
  if (p.x < 0.5) { vec4 a = f1(p, th1, T); a.rgb *= 1.0 - 0.3 * exp(-(0.5 - p.x) * 60.0) * step(1.2, th2); return a; }
  return vec4(0.0);
}
void main() {
  bool open = u > 0.42; float th1, th2;
  if (!open) { th1 = PI * smoothstep(0.0, 0.2, u); th2 = PI * smoothstep(0.17, 0.4, u); }
  else { th2 = PI * (1.0 - smoothstep(0.44, 0.68, u)); th1 = PI * (1.0 - smoothstep(0.62, 0.9, u)); }
  vec2 H = open ? mix(gH0, vec2(0.5), smoothstep(0.55, 1.0, u)) : gH0;
  float g1 = 0.5 - 0.5 * cos(th1), g2 = 0.5 - 0.5 * cos(th2);
  vec2 lp = (vUv - gC) / (2.0 * H) + 0.5; lp = (lp - 0.5) / (1.0 + 0.35 * (g1 + g2) * 0.5) + 0.5 - vec2(0.25 * g2, 0.25 * g1);
  vec4 k, sh; vec2 o = vec2(-0.015, 0.025);
  if (open) { mapA = 0.0; sh = f2(lp + o, th1, th2, texB); gBack = 0.0; k = f2(lp, th1, th2, texB); } else { mapA = 1.0; sh = f2(lp + o, th1, th2, texA); gBack = 0.0; k = f2(lp, th1, th2, texA); }
  // the paper takes the desk's light where it lies now: blinds stripes and the warm key
  vec3 d = texture2D(texD, vUv).rgb; vec3 dl = d; for (int i = 0; i < 8; i++) { float a = float(i) * 0.785; dl += texture2D(texD, vUv + 0.022 * vec2(cos(a) / uAsp, sin(a))).rgb; } dl /= 9.0; // blur out the wood grain, keep the slats
  float st = smoothstep(0.03, 0.2, dot(dl, vec3(0.3, 0.55, 0.15)));
  vec3 light = mix(vec3(0.78, 0.66, 0.56), vec3(2.0, 1.45, 0.9), st); float lit = open ? 1.0 - smoothstep(0.7, 0.95, u) : 1.0;
  vec3 face = k.rgb * mix(vec3(1.0), light, gBack * lit);
  vec3 bg = d * (1.0 - 0.55 * sh.a * (1.0 - k.a));
  gl_FragColor = vec4(mix(bg, face, k.a), 1.0);
}`;

// texD: the desk re-rendered just after s4 hides the sheet, so the flaps lift off bare wood
export default v2Transition(FRAG, { dur: 0.9, extra: { texD: (api, t0) => api.sampleScene(api.from, t0 + 0.903) } });

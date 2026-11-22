// v2_fold: the blank desk sheet folds itself shut like origami (top half down, then right half over), hinged with
// perspective so each flap rises toward the lens; the closed packet then unfolds again in reverse, and its pages are
// the live paper act: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
const vec3 PAPER = vec3(0.97, 0.94, 0.88);
const float K = 0.9;
const float PI = 3.14159265;
vec3 back(vec3 src, float c, float g) { float lum = dot(src, vec3(0.3, 0.55, 0.15)); return PAPER * (0.42 + 0.5 * lum) * (0.55 + 0.35 * (-c)) * (1.0 - 0.4 * smoothstep(0.95, 1.0, g)); }
// sheet after the first fold: top half hinged about y = 0.5 by th
vec4 f1(vec2 p, float th, sampler2D T) {
  float c = cos(th), sn = sin(th), Y = p.y - 0.5, den = c + K * Y * sn;
  if (abs(den) > 1e-4) { float s = Y / den;
    if (s >= 0.0 && s <= 0.5) { float P = 1.0 / (1.0 - K * s * sn), x = 0.5 + (p.x - 0.5) / P;
      if (x >= 0.0 && x <= 1.0) { vec2 q = vec2(x, 0.5 + s); vec3 t = texture2D(T, q).rgb; float g = s / 0.5;
        if (c >= 0.0) return vec4(t * (0.62 + 0.38 * c) * (0.94 + 0.1 * g), 1.0);
        return vec4(back(t, c, g), 1.0); } } }
  if (p.y >= 0.0 && p.y < 0.5 && p.x >= 0.0 && p.x <= 1.0) return vec4(texture2D(T, p).rgb * (1.0 - 0.3 * exp(-(0.5 - p.y) * 60.0) * step(1.2, th)), 1.0);
  return vec4(0.0);
}
// then the right half hinged about x = 0.5 by th2
vec4 f2(vec2 p, float th1, float th2, sampler2D T) {
  float c = cos(th2), sn = sin(th2), X = p.x - 0.5, den = c + K * X * sn;
  if (abs(den) > 1e-4) { float s = X / den;
    if (s >= 0.0 && s <= 0.5) { float P = 1.0 / (1.0 - K * s * sn); vec4 b = f1(vec2(0.5 + s, 0.5 + (p.y - 0.5) / P), th1, T);
      if (b.a > 0.0) { if (c >= 0.0) return vec4(b.rgb * (0.62 + 0.38 * c), 1.0); return vec4(back(b.rgb, c, s / 0.5), 1.0); } } }
  if (p.x < 0.5) { vec4 a = f1(p, th1, T); a.rgb *= 1.0 - 0.3 * exp(-(0.5 - p.x) * 60.0) * step(1.2, th2); return a; }
  return vec4(0.0);
}
void main() {
  bool open = u > 0.42; float th1, th2;
  if (!open) { th1 = PI * smoothstep(0.0, 0.2, u); th2 = PI * smoothstep(0.17, 0.4, u); }
  else { th2 = PI * (1.0 - smoothstep(0.44, 0.7, u)); th1 = PI * (1.0 - smoothstep(0.66, 0.98, u)); }
  // keep the folding sheet centred and push in as it gets smaller
  float g1 = 0.5 - 0.5 * cos(th1), g2 = 0.5 - 0.5 * cos(th2), z = 1.0 + 0.45 * (g1 + g2) * 0.5;
  vec2 p = (vUv - 0.5) / z + 0.5 - vec2(0.25 * g2, 0.25 * g1);
  vec4 k, sh; vec2 o = vec2(-0.012, 0.02);
  if (open) { k = f2(p, th1, th2, texB); sh = f2(p + o, th1, th2, texB); } else { k = f2(p, th1, th2, texA); sh = f2(p + o, th1, th2, texA); }
  vec3 bg = vec3(0.04, 0.034, 0.03) * (1.0 - 0.5 * length(vUv - 0.5)); bg *= 1.0 - 0.7 * sh.a * (1.0 - k.a);
  gl_FragColor = vec4(mix(bg, k.rgb, k.a), 1.0);
}`;

export default v2Transition(FRAG, { dur: 0.9 });

// v2_fold: the blank desk sheet folds itself like origami - top half down, then right half over - and the folded
// packet shrinks away into the paper act, which plays live underneath: agent_v2 seam (see scenes/agent_v2/tkit2.ts)
import { v2Transition } from '../scenes/agent_v2/tkit2';

const FRAG = `
const vec3 PAPER = vec3(0.97, 0.94, 0.88);
vec4 f1(vec2 p, float c1) {
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return vec4(0.0);
  if (p.y < 0.5) {
    if (c1 < 0.0 && p.y > 0.5 + c1) { float ys = 0.5 + (0.5 - p.y) * 0.5 / max(-c1, 1e-4); vec3 ink = texture2D(texA, vec2(p.x, ys)).rgb; float g = (0.5 - p.y) / max(-c1, 1e-4); float lum = dot(ink, vec3(0.3, 0.55, 0.15)); return vec4(PAPER * (0.45 + 0.6 * lum) * (0.84 + 0.16 * (-c1 / 0.5)) * (1.06 - 0.14 * g) * (1.0 - 0.45 * smoothstep(0.95, 1.0, g)), 1.0); }
    float crease = c1 < 0.0 ? 1.0 - 0.35 * exp(-(0.5 + c1 - p.y) * 45.0) : 1.0;
    return vec4(texture2D(texA, p).rgb * crease, 1.0);
  }
  if (c1 > 0.0 && p.y < 0.5 + c1) { float ys = 0.5 + (p.y - 0.5) * 0.5 / max(c1, 1e-4); float g = (p.y - 0.5) / max(c1, 1e-4); return vec4(texture2D(texA, vec2(p.x, ys)).rgb * (0.72 + 0.28 * c1 / 0.5) * (0.92 + 0.16 * g) * (1.0 - 0.5 * smoothstep(0.96, 1.0, g)), 1.0); }
  return vec4(0.0);
}
vec4 f2(vec2 p, float c1, float c2) {
  if (p.x < 0.5) {
    if (c2 < 0.0 && p.x > 0.5 + c2) { vec4 b = f1(vec2(0.5 + (0.5 - p.x) * 0.5 / max(-c2, 1e-4), p.y), c1); if (b.a > 0.0) { float lum = dot(b.rgb, vec3(0.3, 0.55, 0.15)); float g = (0.5 - p.x) / max(-c2, 1e-4); return vec4(PAPER * (0.45 + 0.6 * lum) * (0.84 + 0.16 * (-c2 / 0.5)) * (1.06 - 0.14 * g) * (1.0 - 0.45 * smoothstep(0.95, 1.0, g)), 1.0); } }
    vec4 a = f1(p, c1); if (c2 < 0.0) a.rgb *= 1.0 - 0.3 * exp(-(0.5 + c2 - p.x) * 45.0); return a;
  }
  if (c2 > 0.0 && p.x < 0.5 + c2) { vec4 b = f1(vec2(0.5 + (p.x - 0.5) * 0.5 / max(c2, 1e-4), p.y), c1); return vec4(b.rgb * (0.72 + 0.28 * c2 / 0.5), b.a); }
  return vec4(0.0);
}
void main() {
  float e1 = smoothstep(0.0, 1.0, clamp(u / 0.42, 0.0, 1.0)), e2 = smoothstep(0.0, 1.0, clamp((u - 0.36) / 0.38, 0.0, 1.0)), e3 = smoothstep(0.0, 1.0, clamp((u - 0.72) / 0.28, 0.0, 1.0));
  float c1 = 0.5 * cos(3.14159265 * e1), c2 = 0.5 * cos(3.14159265 * e2);
  // the finished packet (quarter sheet, lower left) spins and shrinks toward the centre
  float s = max(1.0 - e3, 1e-3), ang = 1.2 * e3; vec2 ctr = mix(vec2(0.25), vec2(0.5, 0.55), e3);
  vec2 d = (vUv - ctr) * vec2(uAsp, 1.0); d = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d; vec2 p = d / vec2(uAsp, 1.0) / s + vec2(0.25);
  if (e3 <= 0.0) p = vUv;
  vec4 k = f2(p, c1, c2), sh = f2(p + vec2(-0.012, 0.02) / s, c1, c2);
  vec3 col = texture2D(texB, vUv).rgb * (1.0 - 0.45 * sh.a * (1.0 - k.a));
  gl_FragColor = vec4(mix(col, k.rgb, k.a), 1.0);
}`;

export default v2Transition(FRAG, { dur: 0.6 });

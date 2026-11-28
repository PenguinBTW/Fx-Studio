// S06 salt crystal (20-24 s, Z -4.9 -> -9.2): a raymarched hopper cube of NaCl (half-size 2.5 um) with a stepped
// funnel face, lit glassy with spectral rims. The camera dives onto a terrace, then the surface resolves into the
// rock-salt lattice: a perspective flythrough of small violet Na+ and large green Cl- ions on hot bonds.
import { shaderScene, dZ } from './kit';
import { FFN } from './glsl';

const FRAG = /* glsl */ `${FFN}
const vec3 LK = normalize(vec3(-0.45, 0.85, 0.3));
float stepLev(float r) { return floor(clamp((0.9 - r) / 0.9, 0.0, 1.0) * 7.0) / 7.0; }
float hop(vec3 p) { vec3 a = abs(p); float box = max(max(a.x, a.y), a.z) - 1.0; float r = max(a.x, a.z);
  float cav = max(r - 0.9, (1.0 - 0.7 * stepLev(r)) - p.y); return max(box, -cav); }
vec3 hopN(vec3 p) { vec2 e = vec2(0.0015, 0.0); return normalize(vec3(hop(p + e.xyy) - hop(p - e.xyy), hop(p + e.yxy) - hop(p - e.yxy), hop(p + e.yyx) - hop(p - e.yyx))); }
vec3 spec(float x) { return 0.5 + 0.5 * cos(6.2831853 * (x + vec3(0.0, 0.33, 0.67))); }
vec3 bg(vec3 rd) { float y = rd.y * 0.5 + 0.5; vec3 c = mix(vec3(0.02, 0.0, 0.06), vec3(0.03, 0.08, 0.16), y);
  vec2 g = rd.xz / (abs(rd.y) + 0.4) * 9.0; vec2 id = floor(g); float h = ff_h2(id); float d = length(fract(g) - 0.5 - (vec2(ff_h2(id + 3.1), ff_h2(id + 7.7)) - 0.5) * 0.6);
  return c * 0.6 + spec(h) * smoothstep(0.1, 0.0, d) * step(0.9, h) * 0.35; }
float lat(vec3 p, out float sp) { vec3 c = floor(p + 0.5); vec3 f = p - c; sp = mod(c.x + c.y + c.z, 2.0); float r = sp > 0.5 ? 0.33 : 0.19;
  vec3 a = abs(f); return min(length(f) - r, 0.67 - max(max(a.x, a.y), a.z)); }
vec3 crystal(vec3 aim, vec3 dir, float D) {
  vec3 ro = aim + dir * D; vec3 rd = ff_ray(-dir, vec3(0.0, 1.0, 0.0), 0.546, 0.1 * sin(uT * 0.7)); float t = 0.0; bool hit = false;
  for (int i = 0; i < 110; i++) { float h = hop(ro + rd * t); if (h < 0.0004 * (1.0 + t)) { hit = true; break; } t += h * 0.6; if (t > 40.0) break; }
  if (!hit) return bg(rd);
  vec3 p = ro + rd * t, n = hopN(p); float fr = pow(1.0 - max(dot(-rd, n), 0.0), 3.0); float dif = max(dot(n, LK), 0.0);
  vec3 a = abs(p); float e1 = max(max(a.x, a.y), a.z); float mid = a.x + a.y + a.z - e1 - min(min(a.x, a.y), a.z); float edge = smoothstep(0.985, 1.0, mid);
  float riser = 1.0 - abs(n.y); float lev = stepLev(max(a.x, a.z));
  vec3 body = mix(vec3(0.03, 0.1, 0.18), vec3(0.16, 0.04, 0.22), lev) * (0.2 + 0.8 * dif);
  float growth = ff_fbm(vec3(p.xz * 40.0, p.y * 40.0), 4); body *= 0.85 + 0.3 * growth;
  vec3 c = body + spec(fr * 1.3 + lev * 0.6 + p.y * 0.4) * (fr * 1.3 + riser * 0.22) + vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(rd, n), LK), 0.0), 60.0) * 2.5;
  c += spec(p.x * 0.7 + p.z * 0.5 + lev) * edge * 2.4; return c * exp(-t * 0.02); }
vec3 lattice(float hgt, vec3 dir) {
  vec3 ro = vec3(0.5 + 0.08 * sin(uT * 0.9), hgt, 0.5 + 0.08 * cos(uT * 0.8)); vec3 rd = ff_ray(-dir, vec3(0.0, 0.0, -1.0), 0.65, uT * 0.25);
  float t = 0.0, sp = 0.0, glow = 0.0, gNa = 0.0; bool hit = false;
  if (ro.y > 0.55) { if (rd.y >= -0.02) return bg(rd); t = (ro.y - 0.55) / -rd.y; }
  float t0 = t;
  for (int i = 0; i < 200; i++) { vec3 p = ro + rd * t; float h = lat(p, sp); glow += exp(-h * 10.0) * 0.018; gNa += exp(-h * 10.0) * 0.018 * (1.0 - sp); if (h < 0.0015 + 0.0007 * (t - t0)) { hit = true; break; } t += h * 0.85; if (t - t0 > 45.0) break; }
  vec3 p = ro + rd * t; float dt = t - t0, fog = exp(-dt * 0.19); vec3 C = vec3(0.0);
  if (hit) { vec2 e = vec2(0.002, 0.0); float s2; vec3 n = normalize(vec3(lat(p + e.xyy, s2) - lat(p - e.xyy, s2), lat(p + e.yxy, s2) - lat(p - e.yxy, s2), lat(p + e.yyx, s2) - lat(p - e.yyx, s2)));
    vec3 f = p - floor(p + 0.5); bool bond = length(f) > (sp > 0.5 ? 0.34 : 0.2); float fr = pow(1.0 - abs(dot(rd, n)), 2.5);
    vec3 base = bond ? vec3(1.5, 0.7, 0.2) * (0.6 + 0.4 * sin(uT * 7.0 + dot(floor(p + 0.5), vec3(1.3, 2.1, 0.7)))) : sp > 0.5 ? vec3(0.08, 0.95, 0.35) : vec3(0.95, 0.08, 1.0);
    float dif = max(dot(n, LK), 0.0), head = max(dot(n, -rd), 0.0);
    C = base * (0.03 + 0.55 * dif + 0.3 * head * head) + spec(fr + p.y * 0.05) * fr * 1.2 + base * fr * 0.7 + vec3(1.0) * pow(max(dot(reflect(rd, n), LK), 0.0), 50.0) * 0.8; C *= fog; C = mix(vec3(0.12, 0.13, 0.17) * fog, C, smoothstep(2.0, 7.0, (sp > 0.5 ? 0.33 : 0.19) / (t * 6.8e-4))); }
  C += mix(vec3(0.3, 1.0, 0.5), vec3(0.8, 0.2, 1.0), gNa / max(glow, 1e-4)) * glow * 0.1 * (1.0 - fog * 0.6) + vec3(0.004, 0.008, 0.03) * (1.0 - fog);
  return C; }
void main() {
  float fh = pow(10.0, uZ); float fu = fh / 2.5e-6;
  float r0 = 0.3; vec3 aim = vec3(0.28, 1.0 - 0.7 * stepLev(r0) + 0.002, 0.18);
  float orb = 0.6 + uT * 0.18; vec3 dir = normalize(vec3(cos(orb) * 0.55, mix(0.5, 1.4, smoothstep(-5.2, -6.5, uZ)), sin(orb) * 0.55));
  float m = smoothstep(-6.2, -5.7, uZ); vec3 C = vec3(0.0);
  if (m > 0.0) C += m * crystal(mix(vec3(0.0, 0.15, 0.0), aim, smoothstep(-4.9, -6.0, uZ)), dir, fu / 1.092 * mix(2.4, 1.0, smoothstep(-5.0, -6.4, uZ)));
  if (m < 1.0) { float hgt = -2.0 + 14.0 * pow(10.0, (uZ + 6.2) * 0.6); C += (1.0 - m) * lattice(hgt, normalize(vec3(0.45, 1.0, 0.3))); }
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.1, bloom: 0.7, bloomThreshold: 0.7, halation: 0.25, vignette: 0.45, grain: 0.04, ca: 0.15 + 0.04 * Math.abs(dZ(t)) }));

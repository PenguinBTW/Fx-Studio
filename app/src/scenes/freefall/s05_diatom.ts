// S05 radiolarian (15-20 s, Z -3.4 -> -4.9): a raymarched glass skeleton (nested porous shells + spines, 1 unit = 100 um)
// under Rheinberg illumination - magenta/gold rims on a deep blue field. The fall stalls at 18-19.5 while the shell snaps
// round to face the lens, then slams through a pore toward the crystal.
import { shaderScene, dZ } from './kit';
import { FFN } from './glsl';

const FRAG = /* glsl */ `${FFN}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
float spin() { float s = uT * 0.25; float snap = smoothstep(18.2, 18.9, uT); return s + snap * 1.05 + 0.12 * sin(clamp((uT - 18.2) * 9.0, 0.0, 9.42)) * exp(-max(0.0, uT - 18.6) * 4.0); }
float hexPore(vec3 n, float k) { float la = asin(clamp(n.y, -1.0, 1.0)), lo = atan(n.z, n.x); vec2 p = vec2(lo * cos(la), la) * k;
  vec2 s = vec2(1.0, 1.7320508); vec2 a = mod(p, s) - s * 0.5, b = mod(p - s * 0.5, s) - s * 0.5; return length(dot(a, a) < dot(b, b) ? a : b); }
float shell(vec3 p, float R, float k, float thr, float th) { float r = length(p); vec3 n = p / max(r, 1e-4);
  float pd = hexPore(n, k); float d = abs(r - R) - th; return max(d, (thr - pd) / k * R); }
float map(vec3 p) { float d = shell(p, 1.0, 9.0, 0.36, 0.03); d = min(d, shell(p, 0.62, 6.0, 0.33, 0.022));
  vec3 a = abs(p); float s = 1e5; // spines along the 3 axes and 4 diagonals
  vec3 D[7]; D[0] = vec3(1, 0, 0); D[1] = vec3(0, 1, 0); D[2] = vec3(0, 0, 1); D[3] = normalize(vec3(1, 1, 1)); D[4] = normalize(vec3(1, 1, -1)); D[5] = normalize(vec3(1, -1, 1)); D[6] = normalize(vec3(-1, 1, 1));
  for (int i = 0; i < 7; i++) { vec3 dd = D[i]; float sg = dot(p, dd) > 0.0 ? 1.0 : -1.0; vec3 e = dd * sg; float h = clamp(dot(p, e), 0.95, 1.75); s = min(s, length(p - e * h) - 0.028 * (1.75 - h) * 1.6); }
  return min(d, s); }
vec3 nrm(vec3 p) { vec2 e = vec2(0.002, 0.0); return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
void main() {
  float th = tan(0.36); float d = pow(10.0, uZ + 4.0) / (2.0 * th);
  mat3 R = rotY(spin()) * rotX(0.35); vec3 tgt = vec3(0.0, 0.0, 1.0) * smoothstep(-3.6, -4.6, uZ); // drift from shell centre to a pore
  vec3 ro = tgt + vec3(0.0, 0.0, 1.0) * (d + 1.0 * (1.0 - smoothstep(-3.6, -4.6, uZ))); vec3 rd = ff_ray(normalize(tgt - ro + vec3(0.0, 0.0, -1e-3)), vec3(0.0, 1.0, 0.0), th, 0.1 * sin(uT * 0.7));
  ro = R * ro; rd = R * rd; // orbit = rotate the camera about the skeleton
  vec2 q = ff_uv(); vec3 bgc = mix(vec3(0.0, 0.03, 0.16), vec3(0.01, 0.12, 0.32), smoothstep(1.4, 0.0, length(q))); vec3 C = bgc;
  float t = max(0.0, d - 2.2); float glow = 0.0; vec3 acc = vec3(0.0); float Tr = 1.0;
  for (int i = 0; i < 96; i++) { vec3 p = ro + rd * t; float h = map(p); glow += 0.004 / (0.02 + h * h * 400.0);
    if (h < 0.0015) { vec3 n = nrm(p); float fr = pow(1.0 - abs(dot(rd, n)), 2.5); float film = dot(p, p) * 3.0 + n.y;
      vec3 rhein = mix(vec3(1.0, 0.75, 0.15), vec3(1.0, 0.1, 0.65), fr); vec3 irid = 0.5 + 0.5 * cos(6.2831 * (film + vec3(0.0, 0.33, 0.67)));
      acc += Tr * (rhein * (0.015 + 0.9 * fr * fr) + irid * 0.12 * fr); Tr *= 0.86; t += 0.02; if (Tr < 0.05) break; continue; } // glass: keep going
    t += max(h * 0.8, 0.002); if (t > d + 3.0) break; }
  C = C * Tr + acc + vec3(0.9, 0.3, 1.0) * glow * 0.002;
  float stall = smoothstep(17.9, 18.15, uT) * (1.0 - smoothstep(19.4, 19.55, uT)); C *= 1.0 - 0.15 * stall;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 0.4, bloom: 0.45, bloomThreshold: 0.9, halation: 0.3, vignette: 0.5, grain: 0.045, ca: 0.25 + 0.05 * Math.abs(dZ(t)) }));

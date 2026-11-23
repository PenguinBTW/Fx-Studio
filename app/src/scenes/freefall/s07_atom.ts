// S07 sodium atom (24-28 s, Z -9.2 -> -14): glassy 2p orbital lobes (isosurface of max psi_k^2, coloured by axis and phase)
// inside a sparkling 3s valence shell; the camera dives in along the (1,1,1) gap between lobes (1 unit = 1 A) to the nucleus:
// (fm units) jostling, lit by their own glow.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
const float ISO = 0.12;
// union of the three 2p lobes: max_k psi_k^2 (sum would be spherical); k = winning axis, sg = wavefunction phase
float lobes(vec3 p, out int k, out float sg) { float r = length(p), e = exp(-1.5 * r) * 2.2; vec3 ps = p * e; vec3 d = ps * ps;
  k = d.x > d.y ? (d.x > d.z ? 0 : 2) : (d.y > d.z ? 1 : 2); sg = sign(k == 0 ? p.x : k == 1 ? p.y : p.z); return max(max(d.x, d.y), d.z) - ISO; }
vec3 lobeCol(int k, float sg) { return k == 0 ? (sg > 0.0 ? vec3(1.0, 0.12, 0.75) : vec3(0.08, 0.85, 1.0)) : k == 1 ? (sg > 0.0 ? vec3(1.0, 0.62, 0.08) : vec3(0.45, 0.15, 1.0)) : (sg > 0.0 ? vec3(0.35, 1.0, 0.2) : vec3(1.0, 0.2, 0.12)); }
vec3 lobeN(vec3 p) { int k; float sg; vec2 e = vec2(0.003, 0.0); return normalize(vec3(lobes(p + e.xyy, k, sg) - lobes(p - e.xyy, k, sg), lobes(p + e.yxy, k, sg) - lobes(p - e.yxy, k, sg), lobes(p + e.yyx, k, sg) - lobes(p - e.yyx, k, sg))); }
vec3 nucleon(int i) { float fi = float(i); float y = 1.0 - 2.0 * (fi + 0.5) / 23.0; float rr = sqrt(1.0 - y * y); float ph = fi * 2.39996; float rad = 2.3 * pow((fi + 1.0) / 23.0, 0.333);
  return vec3(cos(ph) * rr, y, sin(ph) * rr) * rad + 0.18 * vec3(sin(uT * 9.0 + fi), cos(uT * 11.0 + fi * 1.7), sin(uT * 7.0 + fi * 2.3)); }
void main() {
  float th = tan(0.45); vec2 q = ff_uv(); float fh = pow(10.0, uZ); vec3 C = vec3(0.0, 0.0, 0.015);
  float roll = uT * 0.6; float orbW = smoothstep(-11.6, -10.6, uZ), nucW = smoothstep(-11.8, -13.0, uZ);
  if (orbW > 0.0) { float d = fh / 1e-10 / (2.0 * th); mat3 R = rotY(uT * 0.45) * rotX(0.5 + uT * 0.12); vec3 ax = normalize(vec3(1.0, 1.05, 0.95));
    vec3 ro = R * (ax * (d + 0.02)); vec3 rd = ff_ray(normalize(-ro), R * vec3(0.0, 1.0, 0.0), th, roll); vec3 acc = vec3(0.0); float T = 1.0;
    vec2 sh = ff_sph(ro, rd, 2.4); if (sh.y > 0.0) { float t0 = max(sh.x, 0.0), dt = (sh.y - t0) / 80.0; int k; float sg; vec3 pp = transpose(R) * (ro + rd * t0); float v0 = lobes(pp, k, sg);
      float j = ff_h2(gl_FragCoord.xy + fract(uT) * 50.0); int hits = 0;
      for (int i = 1; i <= 80; i++) { float tt = t0 + (float(i) - 1.0 + j) * dt; vec3 p = transpose(R) * (ro + rd * tt); float v = lobes(p, k, sg); float r = length(p);
        // 3s valence haze: a sparkling cyan shell, and the 1s core glow
        vec3 cp = p * 7.0; vec3 ci = floor(cp); float dd = length(fract(cp) - (vec3(ff_h(ci), ff_h(ci + 7.1), ff_h(ci + 3.3)) * 0.6 + 0.2)); float spark = exp(-dd * dd * 120.0) * step(0.6, ff_h(ci + 1.9));
        acc += T * dt * (vec3(0.1, 0.75, 1.0) * exp(-pow((r - 1.95) / 0.3, 2.0)) * (0.06 + 3.0 * spark) + vec3(1.0, 0.9, 0.7) * exp(-r * 22.0) * 4.0);
        if (v > 0.0) acc += T * lobeCol(k, sg) * min(v * 6.0, 1.0) * dt * 0.1;
        if (v0 < 0.0 && v >= 0.0 && hits < 2) { vec3 n = lobeN(p); vec3 nw = R * n; float fr = pow(1.0 - abs(dot(rd, nw)), 3.0); vec3 Lk = normalize(vec3(-0.4, 0.8, 0.5));
          vec3 col = lobeCol(k, sg); vec3 sc = col * (0.04 + 0.5 * max(dot(nw, Lk), 0.0)) + col * fr * 1.1 + vec3(1.0) * pow(max(dot(reflect(rd, nw), Lk), 0.0), 50.0) * 1.2;
          acc += T * sc; T *= 0.5; hits++; }
        v0 = v; } }
    C += acc * orbW; C += vec3(1.0, 0.85, 0.6) * 0.0003 / (dot(q, q) + 0.0004) * orbW * smoothstep(-9.8, -11.5, uZ); }
  if (nucW > 0.0) { float d = fh / 1e-15 / (2.0 * th); vec3 ro = vec3(0.0, 0.0, d + 0.4); vec3 rd = ff_ray(normalize(-ro), vec3(0.0, 1.0, 0.0), th, roll);
    float t = max(0.0, d - 4.0); int hid = -1; float glow = 0.0;
    for (int s = 0; s < 64; s++) { vec3 p = ro + rd * t; float h = 1e5; int id = 0; for (int i = 0; i < 23; i++) { float di = length(p - nucleon(i)) - 0.85; if (di < h) { h = di; id = i; } }
      glow += 0.02 / (0.05 + h * h * 6.0); if (h < 0.002) { hid = id; break; } t += h; if (t > d + 5.0) break; }
    vec3 N = vec3(0.0); if (hid >= 0) { vec3 p = ro + rd * t; vec3 c = nucleon(hid); vec3 n = normalize(p - c); bool pr = (hid * 7) % 23 < 11;
      vec3 base = pr ? vec3(1.6, 0.35, 0.08) : vec3(0.35, 0.6, 1.5); float fr = pow(1.0 - max(dot(-rd, n), 0.0), 2.0);
      N = base * (0.25 + 0.7 * max(dot(n, normalize(vec3(0.3, 0.6, 0.7))), 0.0)) + base * fr * 1.5 + vec3(1.0) * pow(max(dot(reflect(rd, n), normalize(vec3(0.3, 0.6, 0.7))), 0.0), 30.0) * 0.5; }
    N += vec3(1.0, 0.5, 0.9) * glow * 0.03; C = mix(C, N, nucW); }
  C += vec3(0.6, 0.8, 1.0) * ff_speed(clamp(abs(uDZ) * 0.12, 0.0, 0.7), 7.0) * 0.7;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 0.95, bloom: 0.8, bloomThreshold: 0.7, halation: 0.35, vignette: 0.45, grain: 0.05, ca: 0.25 + 0.05 * Math.abs(dZ(t)) }));

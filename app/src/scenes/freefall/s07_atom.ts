// S07 sodium atom (24-28 s, Z -9.2 -> -14): volumetric orbital densities (1s core, 2p lobes coloured by wavefunction
// phase, the diffuse 3s valence shell; 1 unit = 1 A), then the long empty dive to the nucleus: 11 protons + 12 neutrons
// (fm units) jostling, lit by their own glow.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
vec3 orb(vec3 p) { float r = length(p);
  float s1 = exp(-r * 18.0) * 30.0; vec3 a = p / max(r, 1e-5); float rp = r * r * exp(-r * 4.2) * 6.0;
  float px = rp * a.x * a.x, py = rp * a.y * a.y, pz = rp * a.z * a.z; float s3 = exp(-pow((r - 1.75) / 0.42, 2.0)) * 0.25 * (0.7 + 0.6 * ff_n(p * 3.0 + uT));
  vec3 pos = vec3(1.0, 0.75, 0.1), neg = vec3(1.0, 0.1, 0.8);
  return vec3(0.8, 0.95, 1.0) * s1 + (p.x > 0.0 ? pos : neg) * px + (p.y > 0.0 ? pos : neg) * py + (p.z > 0.0 ? neg : pos) * pz + vec3(0.1, 0.9, 1.0) * s3; }
vec3 nucleon(int i) { float fi = float(i); float y = 1.0 - 2.0 * (fi + 0.5) / 23.0; float rr = sqrt(1.0 - y * y); float ph = fi * 2.39996; float rad = 2.3 * pow((fi + 1.0) / 23.0, 0.333);
  return vec3(cos(ph) * rr, y, sin(ph) * rr) * rad + 0.18 * vec3(sin(uT * 9.0 + fi), cos(uT * 11.0 + fi * 1.7), sin(uT * 7.0 + fi * 2.3)); }
void main() {
  float th = tan(0.45); vec2 q = ff_uv(); float fh = pow(10.0, uZ); vec3 C = vec3(0.0, 0.0, 0.015);
  float roll = uT * 0.6; float orbW = smoothstep(-13.4, -12.2, uZ), nucW = smoothstep(-11.8, -13.0, uZ);
  if (orbW > 0.0) { float d = fh / 1e-10 / (2.0 * th); vec3 ro = vec3(0.0, 0.0, d) + vec3(0.07, 0.05, 0.0) * min(d, 1.0); vec3 rd = ff_ray(normalize(-ro + vec3(0.0, 0.0, 0.0)), vec3(0.0, 1.0, 0.0), th, roll);
    float L = min(3.2, d * 2.0 + 1e-4); vec2 sh = ff_sph(ro, rd, L); vec3 acc = vec3(0.0);
    if (sh.y > 0.0) { float t0 = max(sh.x, 0.0); float dt = (sh.y - t0) / 56.0; float j = ff_h2(gl_FragCoord.xy + fract(uT) * 50.0);
      for (int i = 0; i < 56; i++) { vec3 p = ro + rd * (t0 + (float(i) + j) * dt); acc += orb(p) * dt; } }
    C += acc * 0.12 * orbW; C += vec3(1.0, 0.85, 0.6) * 0.0008 / (dot(q, q) + 0.0004) * orbW * smoothstep(-9.6, -12.0, uZ); }
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

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.3, bloom: 0.9, bloomThreshold: 0.55, halation: 0.35, vignette: 0.45, grain: 0.05, ca: 0.25 + 0.05 * Math.abs(dZ(t)) }));

// S03 raindrop (8-11 s, Z 2.6 -> -2.3): we fall alongside one drop (mm units). Rain bokeh and the moonlit sea below;
// as the frame shrinks to millimetres the drop fills it, refracting the sea upside-down with exaggerated Cauchy
// dispersion. Bullet time 9.5-10.5: the rain freezes and the camera orbits the drop.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
const float RD = 2.0;
float Ism(float x, float e0, float e1) { float h = e1 - e0, u = clamp((x - e0) / h, 0.0, 1.0); return h * (u * u * u - 0.5 * u * u * u * u) + max(x - e1, 0.0); }
float tw(float t) { return t - 0.9 * (Ism(t, 9.3, 9.7) - Ism(t, 10.3, 10.7)); }
vec3 bg(vec3 d, float alt) {
  vec3 moon = normalize(vec3(-0.45, 0.3, -0.85));
  float fl = pow(max(0.0, sin(uT * 5.1) * sin(uT * 1.3 + 2.0)), 12.0);
  vec3 sky = mix(vec3(0.45, 0.05, 0.38), vec3(0.015, 0.005, 0.06), smoothstep(0.0, 0.3, d.y)) * (1.0 + 2.5 * fl * smoothstep(0.4, 0.0, d.y)) + vec3(1.4, 0.55, 0.12) * exp(-abs(d.y) * 45.0) * (0.7 + 0.3 * ff_n(vec3(atan(d.x, d.z) * 40.0, 0.0, 1.0))) + vec3(0.9, 0.95, 1.2) * pow(max(dot(d, moon), 0.0), 600.0) * 30.0 + vec3(0.3, 0.3, 0.6) * pow(max(dot(d, moon), 0.0), 8.0) * 0.4;
  if (d.y >= 0.0) return sky;
  vec2 p = d.xz / -d.y * alt; vec3 n = normalize(vec3((ff_fbm(vec3(p * 0.004, uT * 0.2), 4) - 0.5) * 0.7, 1.0, (ff_fbm(vec3(p * 0.004 + 5.0, uT * 0.2), 4) - 0.5) * 0.7));
  vec3 r = reflect(d, n); float fr = 0.03 + 0.97 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
  vec3 sea = vec3(0.0, 0.02, 0.05) + vec3(0.0, 0.25, 0.3) * 0.15 * ff_fbm(vec3(p * 0.001, 1.0), 3);
  return mix(sea, sky, fr) + vec3(0.9, 0.9, 1.2) * pow(max(dot(r, moon), 0.0), 400.0) * 1.2; }
vec3 bokeh(vec2 q, float T, float sz) { vec3 c = vec3(0.0);
  for (int l = 0; l < 3; l++) { float fl = float(l); float g = 3.0 + fl * 2.0; vec2 p = q * g + vec2(0.0, T * (1.2 + fl * 0.8)); vec2 id = floor(p), f = fract(p) - 0.5;
    float h = ff_h2(id + fl * 13.0); if (h < 0.82) continue; vec2 o = (vec2(ff_h2(id + 3.0), ff_h2(id + 7.0)) - 0.5) * 0.5; float r = (0.18 + 0.2 * ff_h2(id + 9.0)) * sz;
    float d = length(f - o); float disc = smoothstep(r, r - 0.03, d) * (0.6 + 0.4 * smoothstep(r - 0.06, r, d));
    vec3 hue = h > 0.94 ? vec3(0.2, 0.9, 1.0) : h > 0.88 ? vec3(1.0, 0.2, 0.7) : vec3(1.0, 0.55, 0.15); c += hue * disc * (0.08 + 0.1 * fl); }
  return c; }
void main() {
  float th = tan(0.35); float dc = pow(10.0, uZ + 3.0) / (2.0 * th); // camera distance, mm
  float T = tw(uT); float orb = 0.9 * smoothstep(9.4, 10.6, uT); float tilt = 1.25;
  vec3 cd = normalize(vec3(sin(orb) * sin(tilt), cos(tilt), cos(orb) * sin(tilt))); vec3 ro = cd * dc; vec3 fw = -cd;
  vec3 rd = ff_ray(fw, vec3(0.0, 1.0, 0.0), th, 0.05 * sin(uT));
  float alt = max(4.0, 3.0e5 * pow(max(0.0, 1.0 - (uT - 8.0) / 3.2), 3.0)); // drop height above the sea, mm
  vec2 q = ff_uv(); vec3 C = bg(rd, alt + ro.y);
  C += bokeh(q, T, 1.0) * smoothstep(1.5, 0.0, uZ) * 0.8;
  // wobbling drop (oblate, ringing) as a sphere in squashed space
  float wob = 0.06 * sin(T * 31.0) * exp(-0.0 * T); vec3 S = vec3(1.0 + wob, 1.0 / (1.0 + wob) * 0.93, 1.0 + wob);
  vec3 ro2 = ro / S, rd2 = normalize(rd / S); vec2 hh = ff_sph(ro2, rd2, RD);
  if (hh.x > 0.0) { vec3 p = ro2 + rd2 * hh.x; vec3 n = normalize(p / S); vec3 iors = vec3(1.30, 1.335, 1.38); vec3 col;
    for (int c = 0; c < 3; c++) { float ior = iors[c]; vec3 r1 = refract(rd, n, 1.0 / ior); vec3 pp = p * S; vec3 r1s = normalize(r1 / S); float t2 = -2.0 * dot(p, r1s);
      vec3 p2 = p + r1s * t2; vec3 n2 = -normalize(p2 / S); vec3 r2 = refract(r1, n2, ior); if (dot(r2, r2) < 0.01) r2 = reflect(r1, n2);
      col[c] = bg(r2, alt)[c]; }
    float fr = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0); vec3 rf = bg(reflect(rd, n), alt);
    float rim = pow(1.0 - max(dot(-rd, n), 0.0), 3.0); vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (rim * 2.0 + vec3(0.0, 0.33, 0.67)));
    C = col * 1.1 + rf * fr + rainbow * rim * 0.12; }
  C += vec3(0.7, 0.75, 1.0) * ff_speed(clamp(abs(uDZ) * 0.12, 0.0, 0.6) * (1.0 - smoothstep(9.3, 9.7, uT) * (1.0 - smoothstep(10.3, 10.7, uT))), 3.0) * 0.6;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.4, bloom: 0.8, bloomThreshold: 0.6, halation: 0.3, vignette: 0.35, grain: 0.04, ca: 0.25 + 0.04 * Math.abs(dZ(t)) }));

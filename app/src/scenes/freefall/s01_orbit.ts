// S01 low orbit (0-4 s, Z 7.2 -> 5): falling onto the night side through the auroral oval. Earth in 1000 km units;
// the camera altitude follows the shared Z clock, so by 4 s it is inside the curtains at ~90 km.
import { shaderScene, Z } from './kit';
import { FFN } from './glsl';

export const FRAG = /* glsl */ `${FFN}
const float R = 6.371;
vec3 cityLights(vec3 n, float px) {
  vec3 q = n * R; float land = smoothstep(0.47, 0.53, ff_fbm(n * 3.1 + 2.0, 6)); if (land <= 0.0) return vec3(0.0);
  float metro = pow(smoothstep(0.42, 0.75, ff_fbm(n * 9.0 + 5.0, 5)), 1.5) * land; vec3 c = vec3(0.0);
  for (int k = 0; k < 4; k++) { float sc = 60.0 * pow(4.0, float(k)); float fadeIn = smoothstep(14.0, 3.0, px * sc); // only octaves the pixel can resolve
    vec3 g = q * sc; vec3 id = floor(g); float hh = ff_h(id + float(k) * 7.0); float dens = metro * (0.6 + 0.8 * ff_n(q * sc * 0.15));
    float pt = step(1.0 - dens * 0.55, hh) * smoothstep(0.5, 0.05, length(fract(g) - 0.5));
    vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(0.75, 0.85, 1.0), step(0.7, ff_h(id + 3.0)));
    c += col * pt * fadeIn * (k == 0 ? 0.9 : 0.6); }
  float roads = smoothstep(0.035, 0.0, abs(ff_fbm(n * 40.0, 3) - 0.5)) * metro; c += vec3(1.0, 0.6, 0.25) * roads * 0.35;
  return c + vec3(1.0, 0.5, 0.2) * metro * metro * 0.06; }
vec3 aurora(vec3 ro, vec3 rd, float tEnd, out float aAcc) {
  vec2 sh = ff_sph(ro, rd, R + 0.36); aAcc = 0.0; if (sh.y < 0.0) return vec3(0.0);
  float t0 = max(sh.x, 0.0), t1 = min(sh.y, tEnd); if (t1 <= t0) return vec3(0.0);
  vec3 acc = vec3(0.0); const int N = 64; float dt = (t1 - t0) / float(N); float j = ff_h2(gl_FragCoord.xy + fract(uT) * 91.0);
  for (int i = 0; i < N; i++) { vec3 p = ro + rd * (t0 + (float(i) + j) * dt); float alt = length(p) - R; if (alt < 0.085 || alt > 0.36) continue;
    vec2 s = p.xz; vec2 pole = vec2(0.25, 1.6); float rr = length(s - pole); float band = exp(-pow((rr - 1.45) / 0.26, 2.0));
    float ang = atan(s.y - pole.y, s.x - pole.x); float c = rr * 5.0 + 0.9 * sin(ang * 3.0 + uT * 0.35) + 0.6 * ff_fbm(vec3(s * 2.2, uT * 0.08), 4);
    float sheet = 0.0; for (int l = 0; l < 3; l++) { float cc = c * (1.0 + 0.37 * float(l)) + float(l) * 1.3; float d = abs(fract(cc) - 0.5); sheet += exp(-d * d * 2600.0) * (1.0 - 0.25 * float(l)); }
    float rays = 0.25 + 0.75 * ff_n(vec3(ang * 160.0, alt * 8.0, uT * 0.6)); rays *= 0.6 + 0.4 * ff_n(vec3(ang * 600.0, 0.0, uT * 1.3));
    float green = exp(-(alt - 0.1) / 0.035) * smoothstep(0.085, 0.1, alt), red = exp(-pow((alt - 0.24) / 0.07, 2.0)) * 0.22, blue = exp(-pow((alt - 0.092) / 0.006, 2.0)) * 0.8;
    vec3 em = vec3(0.12, 1.0, 0.35) * green + vec3(1.0, 0.12, 0.55) * red + vec3(0.45, 0.2, 1.0) * blue;
    float dens = sheet * band * rays; acc += em * dens * dt * 16.0; aAcc += dens * dt * 30.0; }
  return acc; }
void main() {
  float fov = 0.9, th = tan(fov * 0.5); float h = pow(10.0, uZ) / (2.0 * th) * 1e-6;
  float tilt = mix(1.02, 0.4, smoothstep(7.0, 5.2, uZ)); vec3 tgt = vec3(0.0, 0.0, 0.3 * smoothstep(7.2, 5.0, uZ));
  vec3 ro = vec3(0.0, R, 0.0) + vec3(0.0, 1.0, -0.0) * h + vec3(0.0, 0.0, -h * tan(tilt)); vec3 fw = normalize(vec3(0.0, R, 0.0) + tgt - ro);
  vec3 rd = ff_ray(fw, vec3(0.0, 0.0, 1.0), th, 0.15 * uT + 0.2); ro.y -= 0.0;
  vec3 C = vec3(0.0); vec2 e = ff_sph(ro, rd, R); float tE = e.x > 0.0 ? e.x : 1e5; float px = h * 2.0 * th / uRes.y;
  // stars
  vec3 sd = rd * 420.0; float st = step(0.9975, ff_h(floor(sd))) * ff_h(floor(sd) + 4.0); C += vec3(0.8, 0.85, 1.0) * st * 1.6;
  float mw = pow(ff_fbm(rd * 3.0 + 9.0, 5), 3.0); C += vec3(0.3, 0.25, 0.55) * mw * 0.25;
  if (e.x > 0.0) { vec3 p = ro + rd * e.x, n = normalize(p); float land = smoothstep(0.47, 0.53, ff_fbm(n * 3.1 + 2.0, 6));
    vec3 moon = normalize(vec3(-0.6, 0.5, 0.8)); float lit = max(dot(n, moon), 0.0) * 0.06;
    vec3 base = mix(vec3(0.004, 0.01, 0.03), vec3(0.012, 0.014, 0.01), land) * (0.4 + lit * 10.0);
    vec3 lights = cityLights(n, px * 1.0);
    float cl = smoothstep(0.5, 0.75, ff_fbm(n * 5.0 + vec3(0.0, 0.0, uT * 0.002), 6)); vec3 cloud = vec3(0.05, 0.06, 0.09) * (0.3 + lit * 12.0);
    float glint = pow(max(dot(reflect(rd, n), moon), 0.0), 60.0) * (1.0 - land) * 0.5;
    C = base + lights * (1.0 - cl * 0.85) + vec3(0.8, 0.85, 1.0) * glint; C = mix(C, cloud + lights * 0.25 * cl, cl * 0.8);
    float flash = pow(max(0.0, sin(uT * 7.3) * sin(uT * 2.1 + 1.0)), 18.0) * smoothstep(2.6, 3.8, uT);
    C += vec3(0.7, 0.6, 1.0) * flash * cl * smoothstep(0.6, 0.0, length(p.xz - vec2(0.05, 0.25)) / max(h, 0.05)) * 3.0;
    float limb = pow(1.0 - max(dot(-rd, n), 0.0), 4.0); C += vec3(0.1, 0.25, 0.7) * limb * 0.25; }
  // atmosphere limb + green airglow line
  float b = dot(ro, rd); float dmin = length(ro - rd * b); if (b < 0.0 && e.x < 0.0) {
    C += vec3(0.15, 0.35, 1.0) * exp(-(dmin - R) / 0.025) * 0.9 + vec3(0.2, 1.0, 0.4) * exp(-pow((dmin - R - 0.095) / 0.006, 2.0)) * 0.6; }
  float aA; vec3 au = aurora(ro, rd, tE, aA); C = C * exp(-aA * 0.05) + au;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.25, bloom: 0.85, bloomThreshold: 0.45, halation: 0.35, vignette: 0.35, grain: 0.04, ca: 0.15 + 0.25 * Math.max(0, 5.6 - Z(t)) }));

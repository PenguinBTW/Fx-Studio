// S06 salt crystal (20-24 s, Z -4.9 -> -9.2): a hopper-salt cube face of stepped square terraces (macro), whose surface
// resolves into the NaCl lattice - an infinite raymarched rock-salt grid (1 unit = one 0.282 nm spacing): violet Na+,
// acid-green Cl-, blackbody-hot bonds - the camera drops into a corridor between the ion planes.
import { shaderScene, dZ } from './kit';
import { FFN } from './glsl';

const FRAG = /* glsl */ `${FFN}
const float A = 0.282e-9;
float lat(vec3 p, out float sp) { vec3 c = floor(p + 0.5); vec3 f = p - c; sp = mod(c.x + c.y + c.z, 2.0); float r = sp > 0.5 ? 0.36 : 0.2;
  float d = length(f) - r; vec3 a = abs(f); float bond = min(min(length(a.yz), length(a.xz)), length(a.xy)) - 0.045; return min(d, bond); }
void main() {
  vec2 q = ff_uv(); float fh = pow(10.0, uZ); vec3 C;
  // macro: terraced hopper face seen from above, edges catching light; zoom = q * frame size in um
  float macro = smoothstep(-8.4, -7.8, uZ);
  vec2 m = q * fh * 0.5 / 1e-6 + vec2(3.0, 5.0); // um
  vec2 mc = m - vec2(3.0, 5.0) - vec2(0.12, -0.08) * fh / 1e-6; float terr = max(abs(mc.x), abs(mc.y)) + 1e-9; float lt = log(terr) / log(1.3); float lev = floor(lt); float fr = fract(lt);
  float edge = smoothstep(0.06, 0.0, fr) + smoothstep(0.94, 1.0, fr) * 0.5; vec3 face = mix(vec3(0.2, 0.05, 0.5), vec3(0.0, 0.5, 0.6), fract(lev * 0.37)) * (0.25 + 0.1 * sin(lev));
  float spark = pow(ff_n(vec3(m * 3.0, uT)), 8.0) * 3.0; face += vec3(1.0, 0.6, 0.2) * edge * 1.2 + vec3(0.8, 1.0, 0.5) * spark * edge;
  vec2 gq = m / (A * 1e6) ; float res = fh / 1920.0 / A; // lattice dots fade in when one spacing spans > 2 px
  vec2 gf = abs(fract(gq) - 0.5); float dots = smoothstep(0.25, 0.1, length(gf)) * smoothstep(6.0, 1.0, res); face += vec3(0.6, 1.0, 0.3) * dots * 0.6;
  vec3 Mc = face;
  // atomic: fall down the [001] axis into a corridor
  vec3 Ac = vec3(0.0);
  if (macro < 1.0) { float th = tan(0.5); float d = fh / A / (2.0 * th); vec3 ro = vec3(0.5 + 0.3 * sin(uT * 0.6), 0.5 + 0.3 * cos(uT * 0.5), d + 0.6);
    vec3 rd = ff_ray(normalize(vec3(0.05 * sin(uT), 0.04, -1.0)), vec3(0.0, 1.0, 0.0), th, uT * 0.35); float t = 0.0, sp = 0.0; float glow = 0.0; bool hit = false;
    for (int i = 0; i < 90; i++) { vec3 p = ro + rd * t; if (p.z > 0.5) { t += (p.z - 0.5) / max(-rd.z, 0.05) + 0.01; continue; } float h = lat(p, sp); glow += exp(-h * 12.0) * 0.02; if (h < 0.002) { hit = true; break; } t += h * 0.9; if (t > 60.0) break; }
    vec3 p = ro + rd * t; float fog = exp(-t * 0.06);
    if (hit) { vec2 e = vec2(0.002, 0.0); float s2; vec3 n = normalize(vec3(lat(p + e.xyy, s2) - lat(p - e.xyy, s2), lat(p + e.yxy, s2) - lat(p - e.yxy, s2), lat(p + e.yyx, s2) - lat(p - e.yyx, s2)));
      vec3 f = p - floor(p + 0.5); bool bond = length(f) > (sp > 0.5 ? 0.37 : 0.21); float fr2 = pow(1.0 - abs(dot(rd, n)), 2.0);
      vec3 base = bond ? vec3(1.6, 0.55, 0.1) * (0.7 + 0.3 * sin(uT * 6.0 + p.z)) : sp > 0.5 ? vec3(0.35, 1.0, 0.2) : vec3(0.55, 0.15, 1.0);
      float dif = max(dot(n, normalize(vec3(0.4, 0.7, 0.6))), 0.0); Ac = base * (0.15 + 0.6 * dif) + base * fr2 * 1.4 + vec3(1.0) * pow(max(dot(reflect(rd, n), normalize(vec3(0.4, 0.7, 0.6))), 0.0), 40.0) * 0.6; Ac *= fog; }
    Ac += vec3(0.4, 0.2, 1.0) * glow * 0.6 + vec3(0.02, 0.0, 0.06) * (1.0 - fog); }
  C = mix(Ac, Mc, macro);
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.3, bloom: 0.8, bloomThreshold: 0.6, halation: 0.3, vignette: 0.45, grain: 0.045, ca: 0.2 + 0.04 * Math.abs(dZ(t)) }));

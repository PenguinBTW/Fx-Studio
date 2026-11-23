// S08 quark (28-31 s, Z -14 -> -18): inside a proton (fm units). Three colour-charged quarks (red/green/blue knots) bound
// by a twisting Y-shaped gluon flux tube, virtual pairs flickering in the sea; the camera falls into the red quark, whose
// glow resolves into self-similar structure (log-polar fbm) until the counter hits 10^-18 and glitches.
import { shaderScene, dZ } from './kit';
import { FFN, FF_SPEED } from './glsl';

const FRAG = /* glsl */ `${FFN}${FF_SPEED}
vec3 qp(int i) { float fi = float(i); float a = fi * 2.0944 + uT * 1.3; return vec3(cos(a), sin(a) * 0.8, sin(a * 1.3 + fi) * 0.3) * 0.42 * (1.0 + 0.15 * sin(uT * 5.0 + fi)); }
float segD(vec3 p, vec3 a, vec3 b) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  float th = tan(0.45); vec2 q = ff_uv(); float fh = pow(10.0, uZ); float d = fh / 1e-15 / (2.0 * th);
  vec3 tq = qp(0) * smoothstep(-15.2, -16.6, uZ); vec3 ro = tq + vec3(0.0, 0.0, d + 0.05); vec3 rd = ff_ray(normalize(tq - ro), vec3(0.0, 1.0, 0.0), th, uT * 0.8);
  vec3 C = vec3(0.02, 0.0, 0.03); vec3 J = (qp(0) + qp(1) + qp(2)) / 3.0;
  float L = 1.3; vec2 sh = ff_sph(ro - J, rd, L); float near = min(d, 1.0);
  if (sh.y > 0.0) { float t0 = max(sh.x, 0.0), dt = (sh.y - t0) / 48.0; float j = ff_h2(gl_FragCoord.xy + fract(uT) * 40.0);
    for (int s = 0; s < 48; s++) { vec3 p = ro + rd * (t0 + (float(s) + j) * dt);
      float tube = 1e5; for (int i = 0; i < 3; i++) tube = min(tube, segD(p, J, qp(i)));
      float tw = ff_n(p * 9.0 + vec3(0.0, 0.0, uT * 6.0)); float g = exp(-tube * tube / (0.004 + 0.004 * tw)) * (0.6 + 0.8 * tw);
      vec3 gl = 0.5 + 0.5 * cos(6.2831 * (tube * 4.0 - uT * 2.0 + vec3(0.0, 0.33, 0.67)));
      C += gl * g * dt * 0.5 * (1.0 - 0.85 * smoothstep(-16.0, -17.0, uZ));
      float sea = pow(ff_n(p * 14.0 + uT * 3.0), 24.0) * 0.6; C += vec3(0.6, 0.9, 1.0) * sea * dt; }
    for (int i = 0; i < 3; i++) { vec3 w = qp(i) - ro; float tc = max(dot(w, rd), 1e-4); float dd = length(w - rd * tc); vec3 col = i == 0 ? vec3(1.6, 0.12, 0.1) : i == 1 ? vec3(0.15, 1.5, 0.2) : vec3(0.15, 0.3, 1.8);
      C += col * 0.00035 / (dd * dd / (tc * tc) + 0.0015) * (i == 0 ? 1.0 : smoothstep(-16.4, -15.2, uZ)); } }
  // inside the red quark: infinite self-similar glow
  float deep = smoothstep(-16.2, -17.2, uZ); if (deep > 0.0) { float r = length(q), a = atan(q.y, q.x); float lz = -uZ * 2.3;
    float f = 0.0; for (int o = 0; o < 4; o++) { float s = log(r + 1e-4) * 1.4 + lz + float(o) * 0.73; float k = fract(s); f += ff_fbm(vec3(cos(a) * 3.0, sin(a) * 3.0, floor(s) + float(o) * 9.0), 4) * sin(3.14159 * k); }
    vec3 hc = 0.5 + 0.5 * cos(6.2831853 * (a * 0.4775 + lz * 0.12 + vec3(0.0, 0.33, 0.67))); hc = pow(hc, vec3(2.0)) * 1.6; vec3 fc = hc * pow(f * 0.5, 3.0) * 1.3 + vec3(1.0, 0.3, 0.2) * 0.004 / (r * r + 0.01);
    C = mix(C, fc, deep); }
  float gl = step(30.2, uT) * step(uT, 31.0) * step(0.6, ff_h2(vec2(floor(uT * 24.0), floor(vUv.y * 40.0))));
  C = gl > 0.5 ? C.gbr * 1.4 + vec3(0.0, 0.2, 0.3) : C;
  C += vec3(1.0, 0.5, 0.5) * ff_speed(clamp(abs(uDZ) * 0.12, 0.0, 0.6), 8.0) * 0.6;
  fragColor = vec4(C, 1.0); }`;

export default shaderScene(FRAG, (t) => ({ toneMap: 'aces', exposure: 1.0, bloom: 0.9, bloomThreshold: 0.5, halation: 0.4, vignette: 0.45, grain: 0.05, ca: 0.3 + 0.06 * Math.abs(dZ(t)) }));

// SPILL seams: the next region's medium spreads outward from the cursor (uC, centred aspect coords) over the last one,
// with an edge drawn in that medium (torn paper, clay smear, ink bleed, pixel steps, felt fuzz, cartoon iris, leaded
// glass, PS1 blocks, quilt patches). Both sides share one push-in toward uC so camera momentum carries across.
import type * as THREE from 'three';
import type { Frame } from '../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../engine/transition';
import { ShaderPass } from '../agent_promo/tkit';

export const SEAM = { paint: 0, paper: 1, clay: 2, ink: 3, pixel: 4, felt: 5, iris: 6, glass: 7, ps1: 8, quilt: 9 } as const;

const FRAG = /* glsl */ `
uniform float uS; uniform vec2 uC; uniform float uT;
float ss(float a, float b, float x) { float w = b - a; w = abs(w) < 1e-5 ? 1e-5 : w; float k = clamp((x - a) / w, 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
vec2 P() { return (vUv - 0.5) * vec2(uAsp, 1.0); }
vec2 UV(vec2 p) { vec2 v = p / vec2(uAsp, 1.0) + 0.5; return 1.0 - abs(mod(v, 2.0) - 1.0); }
float sh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sh(i), sh(i + vec2(1, 0)), f.x), mix(sh(i + vec2(0, 1)), sh(i + vec2(1, 1)), f.x), f.y); }
float sf(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * sn(p); p *= 2.03; a *= 0.5; } return s; }
vec3 vor(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0); for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
  vec2 g = vec2(x, y), o = vec2(sh(i + g), sh(i + g + 7.1)); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; } return vec3(id, d2 - d1); }
void main() {
  vec2 p = P(); float e = u * u * (3.0 - 2.0 * u); int S = int(uS + 0.5);
  vec2 qa = (p - uC) / (1.0 + 0.18 * e) + uC, qb = (p - uC) / (1.2 - 0.2 * e) + uC;
  vec3 A = texture2D(texA, UV(qa)).rgb, B = texture2D(texB, UV(qb)).rgb;
  float R = mix(-0.08, 1.45, e), d = length(p - uC), m, rim = 0.0; vec3 rc = vec3(0.0);
  if (S == 0) { d += 0.16 * (sf(p * 5.0) - 0.5) + 0.05 * sn(vec2(atan(p.y - uC.y, p.x - uC.x) * 6.0, 0.0)); m = ss(R + 0.01, R - 0.01, d);
    float rx = (d - R) * 45.0; rim = exp(-rx * rx); rc = vec3(0.95, 0.92, 0.85); }
  else if (S == 1) { R = mix(-0.08, 1.75, e); d = 0.72 + 0.95 * (uC.y - p.y) + 0.3 * (p.x - uC.x); d += 0.06 * (sf(p * 18.0) - 0.5) + 0.03 * (sn(p * 70.0) - 0.5); m = step(d, R);
    float w = step(d, R + 0.03) - m; rim = w; rc = vec3(0.97, 0.94, 0.86) * (0.85 + 0.15 * sn(p * 300.0));
    B *= 1.0 - 0.35 * ss(0.06, 0.0, R - d) * m; }
  else if (S == 2) { d = 0.75 + 1.4 * (p.x - uC.x) + 0.12 * (sf(vec2(p.x * 2.0, p.y * 12.0)) - 0.5); d += 0.11 * (sf(p * 3.5 + 2.0) - 0.5); m = ss(R + 0.006, R - 0.006, d);
    float k = ss(0.08, 0.0, R - d) * m; B = mix(B, B * 0.55, k) + 0.25 * k * k; }
  else if (S == 3) { d = min(d, min(length(p - uC - vec2(0.2, 0.3)) + 0.15, length(p - uC + vec2(0.18, 0.25)) + 0.25)); float n = sf(p * 7.0 + vec2(0.0, uT * 0.3)); d += 0.22 * (n - 0.5); m = ss(R + 0.03, R - 0.02, d);
    rim = ss(0.09, 0.0, abs(d - R + 0.03)) * (0.6 + 0.4 * sn(p * 40.0)); rc = vec3(0.06, 0.06, 0.07); }
  else if (S == 4) { vec2 g = (floor(p * 18.0) + 0.5) / 18.0; d = length(g - uC) + 0.12 * sh(floor(p * 18.0)); m = step(d, R);
    rim = step(d, R + 0.06) - m; rc = vec3(0.98, 0.85, 0.2); }
  else if (S == 5) { d += 0.05 * (sf(p * 9.0) - 0.5); float fz = 0.05 * sf(p * 120.0); m = ss(R + fz, R - fz, d + 0.02 * sn(p * 400.0)); }
  else if (S == 6) { float r1 = mix(1.3, 0.3, ss(0.0, 0.45, e)), r2 = mix(0.3, 1.3, ss(0.55, 1.0, e)); d = length(p - uC);
    float rr = e < 0.5 ? r1 : r2; m = e < 0.5 ? 0.0 : step(d, rr); vec3 ink = vec3(0.05, 0.04, 0.04); if (e < 0.5) A = mix(ink, A, step(d, rr)); else A = ink;
    rim = ss(0.012, 0.0, abs(d - rr) - 0.006); rc = vec3(0.95, 0.93, 0.88); }
  else if (S == 7) { vec3 v = vor(p * 9.0); vec2 c = (v.xy + 0.5) / 9.0; float dd = length(c - uC) + 0.15 * sh(v.xy);
    m = step(dd, R); rim = (1.0 - ss(0.03, 0.07, v.z)) * step(dd, R + 0.18) * step(R - 0.25, dd); rc = vec3(0.04, 0.035, 0.03);
    B += 0.25 * m * ss(0.03, R + 0.0001, R - dd) * vec3(1.0, 0.8, 0.5) * step(R - dd, 0.08); }
  else if (S == 8) { R = mix(-0.08, 1.6, e); vec2 g = (floor(p * 9.0 + 0.5 * sh(floor(p.yy * 9.0))) + 0.5) / 9.0; d = 0.25 + (0.5 - g.y) * 1.0 + 0.2 * sh(floor(p * 9.0) + 3.0); m = step(d, R);
    float edge = step(d, R + 0.2) - m; vec2 j = vec2(sh(floor(p * 9.0) + 5.0), sh(floor(p * 9.0) + 9.0)) - 0.5; A = mix(A, texture2D(texA, UV((floor((qa + 0.02 * j) * 45.0) + 0.5) / 45.0)).rgb, edge);
    B = mix(B, texture2D(texB, UV((floor(qb * 45.0) + 0.5) / 45.0)).rgb, m * step(R - d, 0.15)); }
  else { vec2 cell = floor(p * 7.0); vec2 c = (cell + 0.5) / 7.0; float dd = length(c - uC) + 0.18 * sh(cell); m = step(dd, R);
    vec2 f = fract(p * 7.0); float b = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)); float st = step(0.5, fract((f.x + f.y) * 9.0));
    rim = m * step(b, 0.035) * st * step(R - dd, 0.25); rc = vec3(1.0, 0.97, 0.9); }
  vec3 col = mix(A, B, m); col = mix(col, rc, clamp(rim, 0.0, 1.0)); gl_FragColor = vec4(col, 1.0); }`;

export function spillSeam(style: number, c: [number, number]) {
  return class SpillSeam implements Transition {
    private pass: ShaderPass;
    constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG, { uS: { value: style }, uC: { value: c }, uT: { value: 0 } }); }
    render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI) {
      this.pass.draw(out, a, b, api.u, { uT: f.t, uAsp: out.width / out.height });
    }
    dispose() { this.pass.dispose(); }
  };
}

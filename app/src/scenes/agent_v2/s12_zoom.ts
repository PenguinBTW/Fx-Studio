// S12 powers of ten (bars 77-81): one continuous zoom out from the single pixel we pushed into in S11 - LCD subpixels,
// the screen, a city at night, the planet's night side, the solar system, a spiral galaxy. Every level lives in its own
// local coordinates (uv * 10^(z - zl)) so 16 orders of magnitude stay in float precision. "bigger."
import * as THREE from 'three';
import { FSPass, Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { PNOISE } from './planet_glsl';

export const T77 = bar(77), S12_END = bar(81), ZMAX = 16.4;
export const S12_LINES: TLine[] = [{ text: 'bigger.', at: bar(80) + 0.1, hold: 1.0, cps: 12 }];
/** log10 zoom: ease-in-out over the four bars */
export function zoomZ(T: number) { const u = Math.min(1, Math.max(0, (T - T77 + 0.3) / (S12_END - T77 + 0.1))); return ZMAX * (u - Math.sin(2 * Math.PI * u) / (2 * Math.PI)); }
const FRAG = /* glsl */ `${PNOISE}
uniform float uZ, uT, uA; uniform vec2 uRes;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float w(float z, float a, float b) { return smoothstep(a - 0.5, a + 0.3, z) * (1.0 - smoothstep(b - 0.4, b + 0.4, z)); }
vec3 img(vec2 s) { // the screen image (0..1): dusk sky with the dragon arc, same palette as the player
  vec3 c = mix(vec3(1.0, 0.62, 0.32), vec3(0.32, 0.12, 0.3), smoothstep(0.2, 1.0, s.y)); float d = abs(length((s - vec2(0.5, 0.15)) * vec2(1.0, 1.6)) - 0.42);
  c = mix(c, vec3(0.25, 0.08, 0.05), smoothstep(0.04, 0.02, d) * step(0.3, s.y)); return c; }
vec3 lcd(vec2 q) { vec2 cell = floor(q), f = fract(q); vec3 col = img(clamp((cell + vec2(1100.0, 600.0)) / vec2(1920.0, 1080.0), 0.0, 1.0));
  float sx = f.x * 3.0; vec3 m = vec3(step(sx, 1.0), step(1.0, sx) * step(sx, 2.0), step(2.0, sx)); float gap = smoothstep(0.0, 0.08, f.y) * smoothstep(1.0, 0.92, f.y) * smoothstep(0.0, 0.04, fract(sx)) * smoothstep(1.0, 0.96, fract(sx));
  return col * m * 1.7 * gap; }
vec3 screenL(vec2 q) { vec2 s = (q + vec2(1100.0, 600.0)) / vec2(1920.0, 1080.0); vec3 c = vec3(0.004);
  if (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0) c = img(s); else if (s.x > -0.02 && s.x < 1.02 && s.y > -0.035 && s.y < 1.035) c = vec3(0.012);
  float glow = exp(-length(max(abs(s - 0.5) - 0.5, 0.0)) * 6.0); return c + vec3(0.5, 0.25, 0.15) * glow * 0.05; }
vec3 city(vec2 q) { vec2 g = q; vec2 cell = floor(g), f = fract(g); float road = min(smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x), smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y));
  float bh = h21(cell + 4.0); vec2 fi = (f - 0.08) / 0.84; float face = step(0.0, fi.y) * step(fi.y, 0.12 + 0.3 * bh) * step(0.0, fi.x) * step(fi.x, 1.0);
  vec3 c = vec3(0.01, 0.012, 0.02) + vec3(1.0, 0.55, 0.2) * (1.0 - road) * 0.35 * (0.5 + h21(cell));
  c = mix(c, vec3(0.03, 0.035, 0.05) * (0.6 + bh) + vec3(1.0, 0.8, 0.5) * step(0.55, h21(floor(vec2(fi.x * 9.0, fi.y * 30.0)) + cell)) * 0.5, face * road);
  float art = 1.0 - smoothstep(0.02, 0.09, abs(fract(q.x / 5.0 + 0.5) - 0.5) * 5.0); float art2 = 1.0 - smoothstep(0.02, 0.09, abs(fract(q.y / 7.0 + 0.5) - 0.5) * 7.0);
  c += vec3(1.0, 0.55, 0.18) * max(art, art2) * 0.3 + vec3(1.0, 0.95, 0.85) * art * step(0.8, fract(q.y * 2.5 - uT * 3.0)) * 0.8 + vec3(1.0, 0.2, 0.1) * art2 * step(0.8, fract(q.x * 2.5 + uT * 3.0)) * 0.7;
  vec2 lw = q * 22.0; float win = step(0.9, h21(floor(lw))) * road * step(0.3, h21(cell * 3.1)); c += mix(vec3(1.0, 0.75, 0.45), vec3(0.6, 0.8, 1.0), h21(floor(lw) + 9.0)) * win * 0.45 * smoothstep(40.0, 4.0, length(q));
  float lamp = (1.0 - road) * step(0.5, fract((f.x + f.y) * 12.0 - uT * 0.8)) * 0.6; c += vec3(1.0, 0.6, 0.25) * lamp;
  c *= smoothstep(1.6, 0.2, length(q) * 0.02 + 0.4 * gn(vec3(q * 0.05, 1.0))); return c; }
vec3 planet(vec2 q) { vec2 c0 = vec2(0.3, -0.78); vec2 d = q - c0; float r = length(d); vec3 sun = normalize(vec3(0.95, -0.25, 0.3)); vec3 col = vec3(0.0);
  if (r < 1.0) { vec3 n = vec3(d, sqrt(1.0 - r * r)); vec3 sp = vec3(n.x * cos(uT * 0.05) - n.z * sin(uT * 0.05), n.y, n.x * sin(uT * 0.05) + n.z * cos(uT * 0.05));
    float h = pfbm(sp * 2.2, 5); float land = smoothstep(0.02, 0.06, h); float lit = max(dot(n, sun), 0.0);
    vec3 alb = mix(vec3(0.02, 0.08, 0.2), mix(vec3(0.12, 0.25, 0.08), vec3(0.45, 0.38, 0.25), smoothstep(0.1, 0.35, h)), land);
    float cl = smoothstep(0.1, 0.45, pfbm(sp * 3.5 + 7.0, 4)); alb = mix(alb, vec3(0.9), cl * 0.8);
    col = alb * lit * 1.4; float night = smoothstep(0.1, -0.1, dot(n, sun)); float lights = land * step(0.62, h21(floor(sp.xy * 160.0) + floor(sp.z * 160.0))) * (1.0 - cl);
    col += vec3(1.0, 0.6, 0.25) * lights * night * 0.9; }
  float rim = exp(-abs(r - 1.0) * 28.0) * (0.3 + 0.7 * max(dot(normalize(vec3(d, 0.2)), sun), 0.0)); col += vec3(0.25, 0.5, 1.0) * rim * 0.8; return col; }
vec3 solar(vec2 q) { vec2 sunP = vec2(-1.05, 0.5); float ds = length(q - sunP); vec3 c = vec3(1.0, 0.75, 0.4) * (0.0015 / (ds * ds + 0.0004) + exp(-ds * 9.0) * 0.12);
  float ro = length(sunP); for (int i = 0; i < 6; i++) { float rr = ro * (0.4 + 0.33 * float(i)); c += vec3(0.35, 0.42, 0.6) * exp(-abs(ds - rr) * 120.0) * 0.9;
    float a = float(i) * 2.1 + uT * 0.1; vec2 pp = sunP + rr * vec2(cos(a), sin(a)); c += vec3(0.8, 0.7, 0.6) * exp(-length(q - pp) * 160.0) * 0.8; }
  c += vec3(0.3, 0.55, 1.0) * (exp(-length(q) * 200.0) * 1.5 + exp(-length(q) * 35.0) * 0.25); vec2 mp = 0.035 * vec2(cos(uT * 1.3), sin(uT * 1.3)); c += vec3(0.8) * exp(-length(q - mp) * 900.0);
  float belt = exp(-abs(ds - ro * 1.18) * 40.0) * step(0.8, h21(floor(q * 260.0))); c += vec3(0.6, 0.5, 0.4) * belt * 0.7;
  c += vec3(1.0, 0.7, 0.35) * pow(max(0.0, 1.0 - abs(atan(q.y - sunP.y, q.x - sunP.x) * 6.0 - 1.0)), 4.0) * exp(-ds * 3.0) * 0.08; return c; }
vec3 galaxy(vec2 q) { vec2 gc = vec2(-0.32, 0.12); vec2 d = q - gc; d = mat2(1.0, 0.0, 0.0, 1.0 / 0.72) * d; float r = length(d), a = atan(d.y, d.x) + uT * 0.02;
  float arms = pow(0.5 + 0.5 * cos(2.0 * (a - log(r + 1e-3) * 2.6)), 3.0); float n = pfbm(vec3(d * 9.0, 2.0), 5) * 0.5 + 0.5;
  float disk = exp(-r * 3.2); float dust = smoothstep(0.45, 0.7, pfbm(vec3(d * 14.0, 5.0), 4) * 0.5 + 0.5) * arms;
  vec3 c = vec3(0.55, 0.65, 1.0) * arms * disk * n * 1.6 + vec3(1.0, 0.8, 0.55) * exp(-r * 14.0) * 2.0 + vec3(0.6, 0.3, 0.5) * arms * disk * 0.4 * n;
  c *= 1.0 - dust * 0.7; float st = step(0.9965, h21(floor(q * 900.0))) * disk * 3.0 * smoothstep(15.2, 16.0, uZ); c += vec3(st);
  c += vec3(1.0, 0.9, 0.7) * exp(-length(q) * pow(10.0, 16.0 - uZ) * 60.0) * 1.2 * (1.0 - smoothstep(14.5, 15.5, uZ)); return c; }
vec3 stars(vec2 uv) { float s = step(0.997, h21(floor(uv * 520.0))) * h21(floor(uv * 520.0) + 3.0); return vec3(s * 0.7); }
void main() { vec2 uv = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.0; float ca = cos(uA), sa = sin(uA); uv = mat2(ca, -sa, sa, ca) * uv; float z = uZ;
  vec3 c = vec3(0.0);
  c += lcd(uv * pow(10.0, z) * 0.6) * w(z, 0.0, 2.6);
  c += screenL(uv * pow(10.0, z) * 0.6) * w(z, 2.2, 4.9);
  c += city(uv * pow(10.0, z - 5.0) * 1.8) * w(z, 4.6, 7.6);
  c += planet(uv * pow(10.0, z - 8.6) * 0.62) * w(z, 7.3, 11.0);
  c += solar(uv * pow(10.0, z - 11.6) * 0.8) * w(z, 10.6, 14.0);
  c += galaxy(uv * pow(10.0, z - 16.0) * 1.0) * w(z, 12.8, 30.0);
  float cz = z - 7.5; float cov = smoothstep(0.52, 0.8, pfbm(vec3(uv * pow(10.0, cz) * 1.3, uT * 0.03 + 4.0), 5) * 0.5 + 0.5); c = mix(c, vec3(0.05, 0.05, 0.07) + vec3(0.5, 0.28, 0.12) * (1.0 - cov) * 0.4, cov * w(z, 6.4, 8.5) * 0.85);
  for (int k = 0; k < 3; k++) { float ph = fract((z - 8.0) / 3.0 + float(k) / 3.0); float sc = 520.0 * pow(10.0, 3.0 * (1.0 - ph)); float fade = sin(3.14159 * ph); c += stars(uv * sc / 520.0 + float(k) * 3.7) * fade * smoothstep(7.6, 9.0, z) * 0.7; }
  c += vec3(0.35, 0.3, 0.5) * smoothstep(0.55, 0.9, pfbm(vec3(uv * 1.2 + z * 0.05, 9.0), 4) * 0.5 + 0.5) * smoothstep(9.0, 10.5, z) * (1.0 - smoothstep(13.5, 15.0, z)) * 0.35;
  fragColor = vec4(c, 1.0); }`;

export default class S12Zoom extends Scene {
  private layer = new Layer2D();
  private pass = new FSPass(FRAG, { uZ: { value: 0 }, uT: { value: 0 }, uA: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) } });
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, z = zoomZ(T), u = this.pass.u;
    u.uZ!.value = z; u.uT!.value = T; u.uA!.value = 0.12 * z; (u.uRes!.value as THREE.Vector2).set(out.width, out.height);
    rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(true, true, true); this.pass.render(rr, out); rr.resetState();
    const g = this.layer.ctx; this.layer.clear();
    term(g, S12_LINES, T, { size: 56, align: 'center', x: 960, y: 900, halo: 'rgba(0,0,0,0.6)', color: '#eef2ff', cursor: '#9ab4ff', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const v = Math.abs(Math.cos(Math.PI * (T - T77) / (S12_END - T77)));
    return { toneMap: 'aces', exposure: 1.1, bloom: 0.55, bloomThreshold: 0.6, halation: 0.3, vignette: 0.45, grain: 0.05, ca: 0.2 + 0.6 * (1 - v), zoom: 1 };
  }
  override dispose() { this.layer.texture.dispose(); this.pass.mat.dispose(); this.pass.mesh.geometry.dispose(); }
}

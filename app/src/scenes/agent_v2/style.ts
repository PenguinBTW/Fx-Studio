// StylePass: one full-screen shader that re-draws a rendered frame (colour + depth) in a different art direction.
// Modes: 0 none, 1 comic (CMYK halftone + misregistration + ink), 2 pixel (dithered palette), 3 ascii, 4 blueprint,
// 5 thermal, 6 paint (Kuwahara), 7 x-ray, 8 stained glass, 9 woodblock.
import * as THREE from 'three';
import { FSPass } from '../../engine/gl';

export const STYLE = { none: 0, comic: 1, pixel: 2, ascii: 3, blueprint: 4, thermal: 5, paint: 6, xray: 7, glass: 8, woodblock: 9 } as const;

const FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tDepth; uniform int uMode; uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar;
float L(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 tm(vec3 c) { return c / (1.0 + c); }
vec3 src(vec2 uv) { return tm(texture(tSrc, uv).rgb); }
float lin(vec2 uv) { float z = texture(tDepth, uv).r * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float edges(vec2 uv, float w) {
  vec2 px = w / uRes; float e = 0.0; float d0 = lin(uv); float l0 = L(src(uv));
  for (int i = 0; i < 4; i++) { vec2 o = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * px;
    e = max(e, smoothstep(0.04, 0.12, abs(lin(uv + o) - d0) / max(d0, 0.1)));
    e = max(e, smoothstep(0.12, 0.3, abs(L(src(uv + o)) - l0))); }
  return e;
}
float dots(vec2 frag, float ang, float v, float cell) {
  mat2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)); vec2 p = r * frag / cell; vec2 f = fract(p) - 0.5;
  return smoothstep(0.0, 0.08, sqrt(clamp(v, 0.0, 1.0)) * 0.62 - length(f));
}
float glyph(int n, vec2 p) { p = floor(p * vec2(-4.0, 4.0) + 2.5); if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) { int a = int(round(p.x) + 5.0 * round(p.y)); if (((n >> a) & 1) == 1) return 1.0; } return 0.0; }
vec3 heatPal(float t) { t = clamp(t, 0.0, 1.0); return clamp(vec3(1.5 * t, t * t * 1.4 - 0.2, 0.6 * sin(t * 3.14159) + max(0.0, t - 0.8) * 4.0), 0.0, 1.0); }
void main() {
  vec2 uv = vUv; vec2 frag = uv * uRes; vec3 c = src(uv); vec3 o = c;
  if (uMode == 1) {
    vec2 sh = vec2(3.0, -2.0) / uRes;
    vec3 cr = vec3(src(uv + sh).r, c.g, src(uv - sh).b);
    vec3 cmy = 1.0 - clamp(cr * 1.35, 0.0, 1.0); float k = min(cmy.x, min(cmy.y, cmy.z)); cmy = (cmy - k) / max(1.0 - k, 1e-3);
    float cell = 7.0; vec3 paper = vec3(0.97, 0.93, 0.84); vec3 ink = paper;
    ink *= 1.0 - dots(frag, 0.26, cmy.x, cell) * vec3(1.0, 0.25, 0.0);
    ink *= 1.0 - dots(frag, 1.31, cmy.y, cell) * vec3(0.0, 1.0, 0.35);
    ink *= 1.0 - dots(frag, 0.0, cmy.z, cell) * vec3(0.0, 0.05, 0.95);
    ink *= 1.0 - dots(frag, 0.79, k * 1.1, cell) * 0.92;
    o = ink * (1.0 - 0.95 * edges(uv, 2.2));
  } else if (uMode == 2) {
    float px = 6.0; vec2 q = (floor(frag / px) + 0.5) * px; vec3 s = src(q / uRes);
    int bi = int(mod(floor(frag.x / px), 4.0)) + 4 * int(mod(floor(frag.y / px), 4.0));
    float bay[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
    float l = L(s) * 1.25 + (bay[bi] / 16.0 - 0.5) * 0.3;
    vec3 pal[5] = vec3[5](vec3(0.06,0.03,0.12), vec3(0.32,0.1,0.42), vec3(0.95,0.25,0.45), vec3(1.0,0.66,0.32), vec3(1.0,0.95,0.75));
    o = pal[int(clamp(l * 5.0, 0.0, 4.0))];
  } else if (uMode == 3) {
    float cs = 12.0; vec2 q = (floor(frag / cs) + 0.5) * cs; vec3 s = src(q / uRes); float l = L(s) * 1.4;
    int n = l < 0.08 ? 0 : l < 0.16 ? 4096 : l < 0.26 ? 65600 : l < 0.36 ? 332772 : l < 0.48 ? 15255086 : l < 0.6 ? 23385164 : l < 0.72 ? 15252014 : l < 0.85 ? 13199452 : 11512810;
    vec2 p = mod(frag / cs * 2.0, 2.0) - 1.0;
    o = vec3(0.35, 1.0, 0.55) * glyph(n, p) * (0.4 + 0.8 * l);
  } else if (uMode == 4) {
    float e = edges(uv, 1.5); vec2 g = abs(fract(frag / 48.0) - 0.5); float grid = smoothstep(0.485, 0.5, max(g.x, g.y));
    vec2 g2 = abs(fract(frag / 12.0) - 0.5); float fine = smoothstep(0.47, 0.5, max(g2.x, g2.y));
    o = vec3(0.04, 0.17, 0.42) + vec3(0.25, 0.45, 0.75) * (0.35 * grid + 0.12 * fine) + vec3(0.85, 0.93, 1.0) * e + vec3(0.1, 0.2, 0.35) * L(c);
  } else if (uMode == 5) {
    float d = lin(uv); float t = L(c) * 1.3 + 0.35 * smoothstep(30.0, 3.0, d) - 0.1; o = heatPal(t + 0.03 * h21(frag + uTime));
  } else if (uMode == 6) {
    vec3 m[4]; vec3 v[4]; for (int k = 0; k < 4; k++) { m[k] = vec3(0); v[k] = vec3(0); }
    for (int j = -5; j <= 5; j++) for (int i = -5; i <= 5; i++) { vec3 s = src(uv + vec2(i, j) / uRes);
      int k = (i <= 0 ? 0 : 1) + (j <= 0 ? 0 : 2); m[k] += s; v[k] += s * s; }
    float best = 1e9; for (int k = 0; k < 4; k++) { vec3 mu = m[k] / 36.0; vec3 va = abs(v[k] / 36.0 - mu * mu); float s = va.r + va.g + va.b; if (s < best) { best = s; o = mu; } }
    o = pow(o, vec3(0.9)) * 1.15; o = mix(vec3(L(o)), o, 1.45);
  } else if (uMode == 7) {
    float e = edges(uv, 1.5); float l = L(c); o = vec3(0.55, 0.85, 1.0) * (pow(1.0 - l, 3.0) * 0.12 + e * 0.9 + l * 0.5);
  } else if (uMode == 8) {
    vec2 p = frag / 46.0; vec2 ip = floor(p); float f1 = 9.0, f2 = 9.0; vec2 cc = vec2(0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = ip + vec2(i, j); vec2 r = g + vec2(h21(g), h21(g + 17.3)); float d = length(p - r);
      if (d < f1) { f2 = f1; f1 = d; cc = r; } else if (d < f2) f2 = d; }
    vec3 s = src(cc * 46.0 / uRes); s = mix(vec3(L(s)), s, 1.9) * 1.6 + 0.04;
    o = s * smoothstep(0.03, 0.09, f2 - f1) * (0.85 + 0.3 * h21(cc));
  } else if (uMode == 9) {
    float l = L(c); vec3 paper = vec3(0.93, 0.87, 0.74) * (0.94 + 0.06 * h21(floor(frag / 2.0)));
    vec3 indigo = vec3(0.1, 0.16, 0.32), red = vec3(0.75, 0.16, 0.12);
    float hot = smoothstep(0.1, 0.3, c.r - c.b);
    o = l < 0.12 ? indigo : l < 0.35 ? mix(indigo, paper, 0.45) : paper; o = mix(o, red, hot * step(0.12, l));
    o *= 1.0 - 0.9 * edges(uv, 2.0);
  }
  fragColor = vec4(o, 1.0);
}`;

export class StylePass {
  private pass = new FSPass(FRAG, {
    tSrc: { value: null }, tDepth: { value: null }, uMode: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) },
    uTime: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 100 },
  });
  private rt: THREE.WebGLRenderTarget | null = null;
  /** Render scene with the camera, then redraw it into `out` in `mode`. */
  render(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera, out: THREE.WebGLRenderTarget, mode: number, t: number) {
    if (!this.rt || this.rt.width !== out.width || this.rt.height !== out.height) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(out.width, out.height) });
    }
    r.setRenderTarget(this.rt); r.setClearColor(0, 1); r.clear(); r.render(scene, cam);
    const u = this.pass.u;
    u.tSrc!.value = this.rt.texture; u.tDepth!.value = this.rt.depthTexture; u.uMode!.value = mode; u.uTime!.value = t;
    (u.uRes!.value as THREE.Vector2).set(out.width, out.height); u.uNear!.value = cam.near; u.uFar!.value = cam.far;
    this.pass.render(r, out, true);
    r.resetState();
  }
  dispose() { this.rt?.dispose(); this.pass.dispose(); }
}

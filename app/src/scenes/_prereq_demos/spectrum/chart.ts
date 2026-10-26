// Labelled swatch chart for engine/spectrum.ts (wavelength, blackbody and Oklab strips), plus a
// `window.__spectrumProbe(mode, lo, hi, n)` hook that renders the GLSL functions into a float
// target and reads linear RGB back, so scripts/test_spectrum.ts can compare GPU to CPU.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame, type PostOverrides } from '../../../engine/scene';
import { FSPass, W, H } from '../../../engine/gl';
import { GLSL_SPECTRUM } from '../../../engine/glsl/spectrum';
import { SPECTRAL_LINES } from '../../../engine/spectrum';

const X0 = 160, X1 = 1760;
const WL_LO = 380, WL_HI = 700;
const K_LO = 1000, K_HI = 40000;

const CHART_FRAG = /* glsl */ `
${GLSL_SPECTRUM}
const vec3 BG = vec3(0.012, 0.014, 0.018);
float inBand(float y, float a, float b) { return step(a, y) * step(y, b); }

vec3 strip(float u, int row) {
  if (row == 0) return wavelengthToLinearSRGB(380.0 + u * 320.0, 0);
  if (row == 1) return wavelengthToLinearSRGB(380.0 + u * 320.0, 1);
  if (row == 2) return spectrumRamp(u, 40.0);
  if (row == 3) return blackbodyToLinearSRGB(BLACKBODY_MIN_K * pow(BLACKBODY_MAX_K / BLACKBODY_MIN_K, u));
  vec3 a = vec3(0.80, 0.02, 0.02), b = vec3(0.03, 0.12, 0.85), c = vec3(0.95, 0.80, 0.05);
  if (row == 4) return oklabGradient(a, b, c, u);
  if (row == 5) return u < 0.5 ? mix(a, b, u * 2.0) : mix(b, c, u * 2.0 - 1.0);
  return mixOklch(vec3(0.80, 0.02, 0.02), vec3(0.03, 0.12, 0.85), u);
}

void main() {
  vec2 p = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  float u = clamp((p.x - ${X0}.0) / ${X1 - X0}.0, 0.0, 1.0);
  float inX = step(${X0}.0, p.x) * step(p.x, ${X1}.0);
  vec3 col = BG;
  float m;
  m = inX * inBand(p.y, 180.0, 260.0); if (m > 0.0) col = strip(u, 0);
  m = inX * inBand(p.y, 262.0, 300.0); if (m > 0.0) col = strip(u, 1);
  m = inX * inBand(p.y, 302.0, 340.0); if (m > 0.0) col = strip(u, 2);
  m = inX * inBand(p.y, 520.0, 600.0); if (m > 0.0) col = strip(u, 3);
  m = inX * inBand(p.y, 780.0, 850.0); if (m > 0.0) col = strip(u, 4);
  m = inX * inBand(p.y, 852.0, 890.0); if (m > 0.0) col = strip(u, 5);
  m = inX * inBand(p.y, 892.0, 930.0); if (m > 0.0) col = strip(u, 6);
  fragColor = vec4(col, 1.0);
}`;

const PROBE_FRAG = /* glsl */ `
${GLSL_SPECTRUM}
uniform int mode; uniform float lo, hi, n; uniform vec3 white;
void main() {
  float x = (gl_FragCoord.x - 0.5 + 0.5) / n;
  float v = lo + x * (hi - lo);
  vec3 a = vec3(0.80, 0.02, 0.02), b = vec3(0.03, 0.12, 0.85), c = vec3(0.95, 0.80, 0.05);
  vec3 col;
  if (mode == 0) col = wavelengthToLinearSRGB(v, 0);
  else if (mode == 1) col = wavelengthToLinearSRGB(v, 1);
  else if (mode == 2) col = wavelengthToLinearSRGB(v, 2);
  else if (mode == 3) col = spectrumRamp(v, 40.0);
  else if (mode == 4) col = blackbodyToLinearSRGB(v);
  else if (mode == 5) col = oklabGradient(a, b, c, v);
  else if (mode == 6) col = mixOklch(a, b, v);
  else if (mode == 7) col = oklabToLinearSRGB(linearSRGBToOklab(vec3(v, 1.0 - v, 0.5 * v)));
  else col = spectralSampleWeight(v, white);
  fragColor = vec4(col, 1.0);
}`;

const tick = (nm: number) => X0 + ((nm - WL_LO) / (WL_HI - WL_LO)) * (X1 - X0);
const tickK = (k: number) => X0 + (Math.log(k / K_LO) / Math.log(K_HI / K_LO)) * (X1 - X0);

export default defineScene({
  id: 'spectrum_chart',
  setup: (ctx: SceneContext) => {
    const pass = new FSPass(CHART_FRAG, {});
    (ctx as any).__specPass = pass;

    const probe = new FSPass(PROBE_FRAG, { mode: { value: 0 }, lo: { value: 0 }, hi: { value: 1 }, n: { value: 1 }, white: { value: new THREE.Vector3(1, 1, 1) } });
    (window as any).__spectrumProbe = (mode: number, lo: number, hi: number, n: number, white: [number, number, number] = [1, 1, 1]): number[] => {
      const r = ctx.renderer;
      const rt = new THREE.WebGLRenderTarget(n, 1, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false });
      probe.u.mode!.value = mode; probe.u.lo!.value = lo; probe.u.hi!.value = hi; probe.u.n!.value = n;
      probe.u.white!.value.set(white[0], white[1], white[2]);
      probe.render(r, rt);
      const buf = new Float32Array(n * 4);
      r.readRenderTargetPixels(rt, 0, 0, n, 1, buf);
      rt.dispose();
      r.setRenderTarget(null);
      r.resetState();
      return Array.from(buf);
    };
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer } = ctx;
    const pass = (ctx as any).__specPass as FSPass;
    pass.render(renderer, out);

    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;
    const t = f.t;
    const label = (id: string, text: string, x: number, y: number, o: { size?: number; weight?: number; color?: string; align?: 'left' | 'center' | 'right' } = {}) => {
      ctx.text(id, text, { fontSize: o.size ?? 15, fontWeight: o.weight ?? 600, color: o.color ?? '#d6dbe4', align: o.align ?? 'center', letterSpacing: 1, role: 'hud' });
      ctx.renderText(id, c2d, t, x, y);
    };

    label('title', 'SPECTRUM.TS COLOUR CHART', X0, 70, { size: 40, weight: 800, align: 'left', color: '#f2f4f8' });
    label('sub', 'linear sRGB, GLSL evaluated per pixel; CIE 1931 (Wyman-Sloan-Shirley), Planckian locus, Oklab', X0, 124, { size: 15, align: 'left', color: '#8a93a3' });

    label('h1', 'WAVELENGTH 380-700 NM   peak-normalised / luminous (x ybar) / spectrumRamp width 40 nm', X0, 166, { size: 14, align: 'left', color: '#8a93a3' });
    for (let nm = 400; nm <= 700; nm += 50) label(`wl${nm}`, `${nm}`, tick(nm), 362, { size: 14 });
    const marks: [string, number, number][] = [
      ['O 557.7', SPECTRAL_LINES.OXYGEN_GREEN!, 0], ['O 630.0', SPECTRAL_LINES.OXYGEN_RED!, 0], ['Na 589.0', SPECTRAL_LINES.SODIUM_D!, 1],
      ['N2+ 427.8', SPECTRAL_LINES.NITROGEN_N2P!, 0], ['Hb 486.1', SPECTRAL_LINES.H_BETA!, 0], ['Ha 656.3', SPECTRAL_LINES.H_ALPHA!, 0],
    ];
    const markUp = marks.map((m, i) => ({ ...m, k: i }));
    for (const m of markUp) label(`mk${m.k}`, m[0], tick(m[1]), 404 + (m[2] ? 22 : 0), { size: 12, color: '#aab2c0' });

    label('h2', 'BLACKBODY 1000-40000 K (log axis), luminance-normalised Y = 1', X0, 500, { size: 14, align: 'left', color: '#8a93a3' });
    for (const k of [1000, 2000, 3000, 4000, 5778, 6500, 10000, 20000, 40000]) label(`k${k}`, `${k}${k === 5778 ? " (Sun)" : ""}`, tickK(k), k === 5778 ? 646 : 622, { size: 14, color: k === 5778 ? '#ffd9a0' : undefined });

    label('h3', 'OKLAB vs SRGB MIX   red-blue-yellow: oklabGradient / naive linear mix / mixOklch (red to blue)', X0, 760, { size: 14, align: 'left', color: '#8a93a3' });
    label('o1', 'oklab', X1 + 18, 815, { size: 13, align: 'left', color: '#8a93a3' });
    label('o2', 'linear', X1 + 18, 871, { size: 13, align: 'left', color: '#8a93a3' });
    label('o3', 'oklch', X1 + 18, 911, { size: 13, align: 'left', color: '#8a93a3' });

    ctx.flush(out);
    renderer.resetState();
    return { bloom: 0, halation: 0, ca: 0, grain: 0, vignette: 0, hud: 0 };
  },
});

void W; void H;

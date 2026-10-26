// Contact sheet for engine/glsl/noise.ts (simplex, fbm, curl LIC, Voronoi F1 / F2-F1 / ID), plus a
// `window.__noiseProbe(points)` hook that evaluates the GLSL library at CPU-chosen points into a
// float target and reads it back, so scripts/test_noise.ts can compare GPU to the TS mirror.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame, type PostOverrides } from '../../../engine/scene';
import { FSPass } from '../../../engine/gl';
import { GLSL_NOISE } from '../../../engine/glsl/noise';

export const PROBE_ROWS = 11;

const SHEET_FRAG = /* glsl */ `
${GLSL_NOISE}
const vec2 PS = vec2(560.0, 400.0);
vec3 idColour(float id) { return 0.5 + 0.5 * cos(6.28318 * (id + vec3(0.0, 0.33, 0.67))); }
vec3 panel(int k, vec2 q) {
  vec2 w = (q - 0.5) * vec2(PS.x / PS.y, 1.0);
  if (k == 0) {
    float n = nzSimplex(vec3(w * 4.0, 0.5)) * 0.5 + 0.5;
    return mix(vec3(0.01, 0.012, 0.02), vec3(0.95, 0.9, 0.8), n);
  }
  if (k == 1) {
    float n = fbm3(vec3(w * 3.0, 0.5), 6) * 0.5 + 0.5;
    return mix(vec3(0.02, 0.01, 0.01), vec3(1.0, 0.55, 0.18), smoothstep(0.1, 0.9, n));
  }
  if (k == 2) {
    vec2 p = w * 2.2;
    float acc = 0.0, wsum = 0.0;
    vec2 a = p, b = p;
    for (int i = 0; i < 28; i++) {
      float wt = 1.0 - float(i) / 28.0;
      a += normalize(curlNoise3(vec3(a, 0.3), 0.0).xy + 1e-6) * 0.006;
      b -= normalize(curlNoise3(vec3(b, 0.3), 0.0).xy + 1e-6) * 0.006;
      acc += wt * (nzF(ivec3(floor(a * 220.0), 0), 3) + nzF(ivec3(floor(b * 220.0), 0), 3));
      wsum += 2.0 * wt;
    }
    vec3 c = curlNoise3(vec3(p, 0.3), 0.0);
    float ang = atan(c.y, c.x);
    vec3 hue = 0.5 + 0.5 * cos(ang + vec3(0.0, 2.094, 4.188));
    float lic = smoothstep(0.25, 0.75, acc / wsum);
    return hue * (0.15 + 0.85 * lic) * clamp(length(c) * 0.9, 0.25, 1.0);
  }
  vec2 p = w * 6.0;
  NzVoronoi2 v = voronoi2(p, 1.0);
  if (k == 3) {
    vec3 c = vec3(pow(v.f1, 0.8));
    float dc = length(p - v.cell);
    return mix(c, vec3(1.0, 0.1, 0.05), 1.0 - smoothstep(0.03, 0.045, dc));
  }
  if (k == 4) return vec3(1.0 - smoothstep(0.0, 0.08, v.f2 - v.f1));
  return idColour(v.id) * (1.0 - 0.6 * v.f1);
}
void main() {
  vec2 p = vec2(FRAG_PX.x, 1080.0 - FRAG_PX.y);
  vec3 col = vec3(0.004, 0.005, 0.007);
  for (int k = 0; k < 6; k++) {
    vec2 o = vec2(80.0 + float(k % 3) * 600.0, 170.0 + float(k / 3) * 450.0);
    vec2 q = (p - o) / PS;
    if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) col = pow(max(panel(k, vec2(q.x, 1.0 - q.y)), 0.0), vec3(2.2));
  }
  fragColor = vec4(col, 1.0);
}`;

const PROBE_FRAG = /* glsl */ `
${GLSL_NOISE}
uniform sampler2D pts;
void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  vec4 q = texelFetch(pts, ivec2(ij.x, 0), 0);
  vec3 p = q.xyz;
  vec4 o = vec4(0.0);
  vec3 g; mat3 J;
  if (ij.y == 0) { float v = snoiseGrad(p, g); o = vec4(v, g); }
  else if (ij.y == 1) { float v = fbmGrad3(p, 5, 2.0, 0.5, g); o = vec4(v, g); }
  else if (ij.y == 2) { vec3 c = curlNoise3J(p, q.w, J); o = vec4(c, J[0].x + J[1].y + J[2].z); }
  else if (ij.y == 3) { curlNoise3J(p, q.w, J); o = vec4(J[0], 0.0); }
  else if (ij.y == 4) { curlNoise3J(p, q.w, J); o = vec4(J[1], 0.0); }
  else if (ij.y == 5) { curlNoise3J(p, q.w, J); o = vec4(J[2], 0.0); }
  else if (ij.y == 6) { NzVoronoi3 v = voronoi3(p, 1.0); o = vec4(v.f1, v.f2, v.id, v.cell.x); }
  else if (ij.y == 7) { NzVoronoi3 v = voronoi3(p, 1.0); o = vec4(v.cell.yz, 0.0, 0.0); }
  else if (ij.y == 8) { NzVoronoi2 v = voronoi2(p.xy, 1.0); o = vec4(v.f1, v.f2, v.id, v.cell.x); }
  else if (ij.y == 9) { NzVoronoi2 v = voronoi2(p.xy, 1.0); o = vec4(v.cell.y, 0.0, 0.0, 0.0); }
  else { o = vec4(ign(p.xy), ignFrame(p.xy, 3), noiseJitter(p.xy, 5), 0.0); }
  fragColor = o;
}`;

export default defineScene({
  id: 'noise_sheet',
  setup: (ctx: SceneContext) => {
    (ctx as any).__noisePass = new FSPass(SHEET_FRAG, {});
    const probe = new FSPass(PROBE_FRAG, { pts: { value: null } });
    (window as any).__noiseProbe = (pts: number[]): number[] => {
      const n = pts.length / 4;
      const r = ctx.renderer;
      const tex = new THREE.DataTexture(new Float32Array(pts), n, 1, THREE.RGBAFormat, THREE.FloatType);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      const rt = new THREE.WebGLRenderTarget(n, PROBE_ROWS, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      probe.u.pts!.value = tex;
      probe.render(r, rt);
      const buf = new Float32Array(n * PROBE_ROWS * 4);
      r.readRenderTargetPixels(rt, 0, 0, n, PROBE_ROWS, buf);
      rt.dispose(); tex.dispose();
      r.setRenderTarget(null);
      r.resetState();
      return Array.from(buf);
    };
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer } = ctx;
    (ctx as any).__noisePass.render(renderer, out);

    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;
    const label = (id: string, text: string, x: number, y: number, size = 15, color = '#8a93a3', weight = 600) => {
      ctx.text(id, text, { fontSize: size, fontWeight: weight, color, align: 'left', letterSpacing: 1, role: 'hud' });
      ctx.renderText(id, c2d, f.t, x, y);
    };
    label('title', 'NOISE.TS CONTACT SHEET', 80, 80, 40, '#f2f4f8', 800);
    label('sub', 'GLSL evaluated per pixel; seed 0; 2D slices of the 3D fields (z = 0.5 / 0.3)', 80, 124, 15);
    const names = ['SIMPLEX  snoise', 'FBM  6 oct', 'CURL  LIC + hue = flow direction', 'VORONOI  F1 + cell centre', 'VORONOI  edges (F2 - F1)', 'VORONOI  cell ID'];
    names.forEach((n, k) => label(`p${k}`, n, 80 + (k % 3) * 600, 160 + Math.floor(k / 3) * 450, 14));

    ctx.flush(out);
    renderer.resetState();
    return { bloom: 0, halation: 0, ca: 0, grain: 0, vignette: 0, hud: 0 };
  },
});

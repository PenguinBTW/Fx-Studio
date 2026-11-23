// FREEFALL shared clock and HUD. Z(t) = log10(frame height in metres), one monotone curve the whole film runs on:
// every scene derives its camera from it and the depth counter reads it, so seams are scale-matched by construction.
import * as THREE from 'three';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Compositor } from '../../engine/gl';

export const BAR = 2, BEAT = 0.5, END = 38;
// [t, Z] keys; the fall stalls at the midpoint (18-19.5) then slams
const KEYS: [number, number][] = [[0, 6.9], [4, 5.0], [8, 2.6], [9.3, -1.3], [11, -2.3], [15, -3.4], [18, -4.05], [19.5, -4.12], [20, -4.9], [24, -9.0], [25.3, -9.6], [26.8, -11.0], [28, -14], [31, -18], [31.8, -5.2], [33, -3.6], [35.5, -0.9], [36.8, 6.55], [END, 6.9]];
const M = (() => { // Fritsch-Carlson monotone tangents
  const n = KEYS.length, d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((KEYS[i + 1]![1] - KEYS[i]![1]) / (KEYS[i + 1]![0] - KEYS[i]![0]));
  for (let i = 0; i < n; i++) m.push(i === 0 ? d[0]! : i === n - 1 ? d[n - 2]! : d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i]! / d[i]!, b = m[i + 1]! / d[i]!, s = a * a + b * b; if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]!; m[i + 1] = k * b * d[i]!; } }
  return m;
})();
export function Z(t: number): number {
  const tt = Math.min(END, Math.max(0, t)); let i = 0; while (i < KEYS.length - 2 && tt > KEYS[i + 1]![0]) i++;
  const [t0, z0] = KEYS[i]!, [t1, z1] = KEYS[i + 1]!, h = t1 - t0, s = (tt - t0) / h, s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * z0 + (s3 - 2 * s2 + s) * h * M[i]! + (-2 * s3 + 3 * s2) * z1 + (s3 - s2) * h * M[i + 1]!;
}
/** dZ/dt (orders of magnitude per second), for speed lines and motion blur */
export const dZ = (t: number) => (Z(t + 0.01) - Z(t - 0.01)) / 0.02;
/** ff_* seam windows (project.json); the transition draws the HUD there, scenes everywhere else. */
export const SEAMS = [3.6, 7.6, 10.6, 14.6, 19.6, 23.6, 27.6, 30.6], SEAM_DUR = 0.8;
export const inSeam = (t: number) => SEAMS.some((a) => t >= a && t < a + SEAM_DUR);

const LABELS: [number, string][] = [[0, 'low orbit'], [4, 'thunderhead'], [8, 'raindrop'], [11, 'plankton'], [15, 'diatom'], [20, 'salt crystal'], [24, 'sodium atom'], [28, 'quark'], [31, 'your screen'], [33.4, ''], [35.5, 'low orbit']];
const TEXT: { at: number; end: number; s: string }[] = [
  { at: 0, end: 1.35, s: 'no footage.' }, { at: 1.4, end: 3.3, s: 'just code.' }, { at: 18.1, end: 19.45, s: 'closer.' }, { at: 31.3, end: 33.4, s: "that's your screen." }, { at: 37.4, end: 38.5, s: 'no footage.' }];

let layer: Layer2D | null = null;
const SUP = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
const sup = (n: number) => (n < 0 ? '\u207b' : '') + String(Math.abs(n)).split('').map((c) => SUP[+c]).join('');

/** Draws the depth counter + hook lines for global time t onto `out` (top-of-safe-core HUD). */
export function hud(renderer: THREE.WebGLRenderer, comp: Compositor, out: THREE.WebGLRenderTarget, t: number, alpha = 1) {
  layer ??= new Layer2D();
  const g = layer.ctx; layer.clear(); const z = Z(t), e = Math.floor(z + 1e-6), m = Math.pow(10, z - e);
  const glitch = t > 30.2 && t < 31.4 ? Math.floor(t * 30) % 3 : -1;
  g.save(); g.globalAlpha = alpha; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 18;
  const cx = W * 0.44, y = 360;
  const bk = g.createRadialGradient(cx, y - 10, 10, cx, y - 10, 300); bk.addColorStop(0, "rgba(0,0,0,0.42)"); bk.addColorStop(1, "rgba(0,0,0,0)");
  g.save(); g.fillStyle = bk; g.translate(cx, y - 10); g.scale(1.3, 0.45); g.translate(-cx, -(y - 10)); g.fillRect(cx - 300, y - 310, 600, 600); g.restore();
  g.font = `82px "${F.archivo(100, 800)}"`; g.fillStyle = '#ffffff';
  const s = glitch >= 0 ? ['10\u207b\u00b9\u2078 m', '\u2588\u2588\u207b\u2074 m', '10\u207b\u2074 m'][glitch]! : `${m.toFixed(1)} \u00d7 10${sup(e)} m`;
  g.fillText(s, cx, y);
  let lab = ''; for (const [a, l] of LABELS) if (t >= a) lab = l;
  g.font = `34px "${F.archivo(112, 600)}"`; g.fillStyle = 'rgba(255,255,255,0.78)';
  (g as unknown as { letterSpacing: string }).letterSpacing = '6px'; if (lab) g.fillText(lab.toUpperCase(), cx, y + 54);
  (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
  // depth rail: where we are between 10^7 and 10^-18
  const p = (7.2 - Math.min(7.2, Math.max(-18, z))) / 25.2, rx = 70, r0 = 420, r1 = 1380;
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(rx, r0, 3, r1 - r0); g.fillStyle = '#fff'; g.fillRect(rx - 9, r0 + p * (r1 - r0) - 2, 21, 5);
  for (const tx of TEXT) {
    if (t < tx.at || t > tx.end) continue; const lt = t - tx.at, n = tx.at === 0 ? tx.s.length : Math.min(tx.s.length, Math.floor(lt * 34) + 1), k = Math.min(1, (tx.end - t) / 0.18);
    g.globalAlpha = alpha * k; g.font = `104px "${F.archivo(100, 900)}"`; const fs = Math.min(104, 104 * 840 / g.measureText(tx.s).width); g.font = `${fs}px "${F.archivo(100, 900)}"`; g.fillStyle = '#fff'; g.shadowBlur = 28;
    const str = tx.s.slice(0, n), w = g.measureText(tx.s).width; g.textAlign = 'left'; g.fillText(str, cx - w / 2, 1180);
    if (Math.floor(t * 4) % 2 === 0 || n < tx.s.length) { g.fillStyle = '#7dfcff'; g.fillRect(cx - w / 2 + g.measureText(str).width + 8, 1180 - fs * 0.77, fs * 0.44, fs * 0.83); }
  }
  g.restore();
  comp.draw(renderer, layer.upload(), out, { mode: 'normal', opacity: 1 }); renderer.resetState();
}

/** Fullscreen-shader scene base: uniforms uT (global s), uZ, uDZ, uRes, uAsp (H/W). Draws the HUD unless mid-seam. */
export function shaderScene(frag: string, post: (t: number) => Record<string, unknown>, extra: Record<string, THREE.IUniform> = {}) {
  return class FFShader {
    stateful = false; prerollMax = 0; handlesTransition = false;
    pass = new FSPass(frag, { uT: { value: 0 }, uZ: { value: 0 }, uDZ: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, ...extra });
    constructor(public ctx: { renderer: THREE.WebGLRenderer; comp: Compositor }) {}
    init() {} reset() {}
    render(f: { t: number; tin: number; tout: number }, out: THREE.WebGLRenderTarget) {
      const rr = this.ctx.renderer, u = this.pass.u; u.uT!.value = f.t; u.uZ!.value = Z(f.t); u.uDZ!.value = dZ(f.t); (u.uRes!.value as THREE.Vector2).set(out.width, out.height);
      rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(true, true, true); this.pass.render(rr, out); rr.resetState();
      if (!inSeam(f.t)) hud(rr, this.ctx.comp, out, f.t);
      return post(f.t);
    }
    dispose() { this.pass.dispose(); this.pass.mesh.geometry.dispose(); }
  };
}

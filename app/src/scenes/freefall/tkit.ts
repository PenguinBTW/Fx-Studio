// FREEFALL seams: a fullscreen shader over both participants (texA/texB, u, uT, uZ, uAsp = W/H) plus the shared HUD
// drawn once on top, so the counter never doubles or warps mid-seam. `extra` binds more re-rendered scene states.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../engine/transition';
import { ShaderPass } from '../agent_promo/tkit';
import { hud, Z } from './kit';

// The engine applies the incoming scene's post during a seam, so the outgoing side would be graded with B's exposure
// (the 0.4-exposure radiolarian blows out under the lattice's 1.1). Seams cross-grade the per-scene constants instead.
const GRADE: Record<string, [number, number, number, number]> = {
  orbit: [1.25, 0.85, 0.45, 0.35], storm: [0.9, 0.45, 0.9, 0.12], drop: [1.4, 0.8, 0.6, 0.3], plankton: [1.15, 0.85, 0.6, 0.4],
  diatom: [0.4, 0.45, 0.9, 0.3], lattice: [1.1, 0.7, 0.7, 0.25], atom: [0.95, 0.8, 0.7, 0.35], quark: [1.0, 0.9, 0.5, 0.4], screen: [1.25, 0.85, 0.45, 0.35] };
function crossGrade(from: string, to: string, u: number): PostOverrides {
  const a = GRADE[from], b = GRADE[to]; if (!a || !b) return {};
  const s = u * u * (3 - 2 * u), m = (i: number) => a[i]! + (b[i]! - a[i]!) * s;
  return { exposure: m(0), bloom: m(1), bloomThreshold: m(2), halation: m(3) };
}

export interface FFOpts { dur: number; post?: (u: number, t: number) => PostOverrides; extra?: Record<string, (api: TransitionAPI, t0: number, t: number) => THREE.Texture> }
export function ffTransition(frag: string, o: FFOpts) {
  return class FFT implements Transition {
    private pass: ShaderPass;
    constructor(private ctx: TransitionCtx) {
      const ex = Object.keys(o.extra ?? {});
      this.pass = new ShaderPass(ctx, `uniform float uT; uniform float uZ;\n${ex.map((k) => `uniform sampler2D ${k};`).join('\n')}\n${frag}`, { uT: { value: 0 }, uZ: { value: 0 }, ...Object.fromEntries(ex.map((k) => [k, { value: null }])) });
    }
    render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
      const t0 = f.t - api.u * o.dur; const set: Record<string, unknown> = { uT: f.t, uZ: Z(f.t), uAsp: out.width / out.height };
      for (const [k, fn] of Object.entries(o.extra ?? {})) set[k] = fn(api, t0, f.t);
      this.pass.draw(out, a, b, api.u, set); hud(this.ctx.renderer, this.ctx.comp, out, f.t);
      return { ...crossGrade(api.from, api.to, api.u), ...(o.post?.(api.u, f.t) ?? {}) };
    }
    dispose() { this.pass.dispose(); }
  };
}

/** GLSL helpers for the ff_* seams: aspect-correct centred coords, zoomed taps of either participant, noise. */
export const TG = /* glsl */ `
vec2 P() { return (vUv - 0.5) * vec2(uAsp, 1.0); }
vec2 toUv(vec2 p) { vec2 v = p / vec2(uAsp, 1.0) + 0.5; return 1.0 - abs(mod(v, 2.0) - 1.0); }
vec3 tapA(vec2 p, float s) { return texture2D(texA, toUv(p / s)).rgb; }
vec3 tapB(vec2 p, float s) { return texture2D(texB, toUv(p / s)).rgb; }
float ffth(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fftn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ffth(i), ffth(i + vec2(1, 0)), f.x), mix(ffth(i + vec2(0, 1)), ffth(i + vec2(1, 1)), f.x), f.y); }
float fftf(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * fftn(p); p *= 2.07; a *= 0.5; } return s; }
vec3 radialA(vec2 p, float s, float k) { vec3 c = vec3(0.0); for (int i = 0; i < 8; i++) c += tapA(p, s * (1.0 + k * float(i) / 8.0)); return c / 8.0; }
// Shared dive camera: one exponential zoom (x30 over the seam) for A, and the scale at which B, seen through an aperture
// of radius R around the focal point, shows its whole frame (reaching 1 once the aperture spans the frame width, so B is never mirrored inside it).
float diveZ(float e) { return exp(e * 3.4); }
float diveS(float R) { return min(1.0, R / (0.5 * uAsp)); }
`;

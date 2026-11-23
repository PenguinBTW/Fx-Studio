// FREEFALL seams: a fullscreen shader over both participants (texA/texB, u, uT, uZ, uAsp = W/H) plus the shared HUD
// drawn once on top, so the counter never doubles or warps mid-seam. `extra` binds more re-rendered scene states.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../engine/transition';
import { ShaderPass } from '../agent_promo/tkit';
import { hud, Z } from './kit';

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
      return o.post?.(api.u, f.t);
    }
    dispose() { this.pass.dispose(); }
  };
}

/** GLSL helpers for the ff_* seams: aspect-correct centred coords, zoomed taps of either participant, noise. */
export const TG = /* glsl */ `
vec2 P() { return (vUv - 0.5) * vec2(uAsp, 1.0); }
vec2 toUv(vec2 p) { return p / vec2(uAsp, 1.0) + 0.5; }
vec3 tapA(vec2 p, float s) { return texture2D(texA, toUv(p / s)).rgb; }
vec3 tapB(vec2 p, float s) { return texture2D(texB, toUv(p / s)).rgb; }
float ffth(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fftn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ffth(i), ffth(i + vec2(1, 0)), f.x), mix(ffth(i + vec2(0, 1)), ffth(i + vec2(1, 1)), f.x), f.y); }
float fftf(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * fftn(p); p *= 2.07; a *= 0.5; } return s; }
vec3 radialA(vec2 p, float s, float k) { vec3 c = vec3(0.0); for (int i = 0; i < 8; i++) c += tapA(p, s * (1.0 + k * float(i) / 8.0)); return c / 8.0; }
`;

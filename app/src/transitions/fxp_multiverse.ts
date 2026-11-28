// fxp_multiverse (A9 -> A10 finale, bars 101-105): every world of the film live at the same instant. The frame becomes a
// wall of 4 -> 16 -> 64 tiles, each a different world sampled through api.sampleScene() at a live offset, one continuous
// orange Thread drawn across all of them; on the last bar the wall winds into the finale's vortex.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { BAR, BEAT, B0, overlay } from '../scenes/fx_promo/kit';

// Eight distinct worlds (no text cards): city at dawn / night / collapse, tunnel inside / outside, two paper restyles, terrain.
const WORLDS: [string, number][] = [['a4_city', 60], ['s7_tunnel', 104], ['a7_paper', 136], ['s2_surface', 26], ['a4_city', 78], ['s7_tunnel', 119.5], ['a7_paper', 150], ['a4_city', 86]];

const FRAG = `uniform sampler2D w0; uniform sampler2D w1; uniform sampler2D w2; uniform sampler2D w3; uniform sampler2D w4; uniform sampler2D w5; uniform sampler2D w6; uniform sampler2D w7;
uniform float uN; uniform float uPop; uniform float uSw; uniform float uT; uniform float uBeat;
vec3 world(float k, vec2 q){ if (k < 0.5) return texture2D(w0, q).rgb; if (k < 1.5) return texture2D(w1, q).rgb; if (k < 2.5) return texture2D(w2, q).rgb;
  if (k < 3.5) return texture2D(w3, q).rgb; if (k < 4.5) return texture2D(w4, q).rgb; if (k < 5.5) return texture2D(w5, q).rgb; if (k < 6.5) return texture2D(w6, q).rgb; return texture2D(w7, q).rgb; }
vec2 swirl(vec2 uv, float k){ vec2 p = (uv - 0.5) * vec2(uAsp, 1.0); float r = length(p);
  float a = k * 9.0 * exp(-r * 1.6); p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p; p *= 1.0 + k * 1.5 * (1.0 - r);
  return p / vec2(uAsp, 1.0) + 0.5; }
void main(){
  vec2 uv = swirl(vUv, uSw);
  vec2 cell = floor(uv * uN), lq = fract(uv * uN);
  float idx = cell.y * uN + cell.x + floor(cell.y * 0.5) * 3.0;
  float k = mod(idx + floor(th(vec2(uN, 1.7)) * 8.0), 8.0);
  float z = 0.95 - 0.45 * th(cell + 3.1 + uN);
  vec2 q = 0.5 + (lq - 0.5) * z * (1.0 + 0.25 * uPop) + (vec2(th(cell + 9.0), th(cell + 5.0)) - 0.5) * (1.0 - z);
  vec3 c = world(k, q);
  float gap = 0.006 * uN;
  float frame = step(lq.x, gap) + step(1.0 - gap, lq.x) + step(lq.y, gap * uAsp) + step(1.0 - gap * uAsp, lq.y);
  c = mix(c, vec3(0.02), clamp(frame, 0.0, 1.0));
  float hit = step(0.85, th(cell + floor(uBeat)));
  c *= 1.0 + 0.6 * hit * exp(-fract(uBeat) * 5.0);
  float yl = 0.5 + 0.17 * sin(uv.x * 6.2832 * 1.5 + uT * 2.0) * cos(uv.x * 2.1 - uT * 0.7);
  float th_ = smoothstep(0.0035, 0.0, abs(uv.y - yl)), glow = exp(-abs(uv.y - yl) * 90.0);
  c += SIGNAL * (th_ * 3.0 + glow * 0.5);
  vec3 B = texture2D(texB, swirl(vUv, -(1.0 - uSw) * 0.0)).rgb;
  float r = length((vUv - 0.5) * vec2(uAsp, 1.0));
  float m = smoothstep(uSw * 1.3, uSw * 1.3 - 0.25, r) * step(0.001, uSw);
  gl_FragColor = vec4(mix(c, B, m), 1.0);
}`;

export default class FxpMultiverse implements Transition {
  private pass: ShaderPass;
  private rts: THREE.WebGLRenderTarget[];
  constructor(private ctx: TransitionCtx) {
    this.rts = WORLDS.map(() => new THREE.WebGLRenderTarget(960, 540, { type: THREE.HalfFloatType, depthBuffer: false }));
    const U: Record<string, THREE.IUniform> = { uN: { value: 2 }, uPop: { value: 0 }, uSw: { value: 0 }, uT: { value: 0 }, uBeat: { value: 0 } };
    this.rts.forEach((rt, i) => (U[`w${i}`] = { value: rt.texture }));
    this.pass = new ShaderPass(ctx, FRAG, U);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const { renderer: r, comp } = this.ctx;
    const t0 = f.t - api.u * 0; // live offset base
    const dur = 4 * BAR;
    const lt = api.u * dur;
    overlay.on = false;
    try { WORLDS.forEach(([id, base], i) => comp.draw(r, api.sampleScene(id, base + lt), this.rts[i]!, { mode: 'replace' })); } finally { overlay.on = true; }
    const lb = lt / BAR;
    const N = lb < 1.5 ? 2 : lb < 2.5 ? 4 : 8;
    const edge = lb < 1.5 ? 0 : lb < 2.5 ? 1.5 : 2.5;
    const pop = Math.exp(-Math.max(0, lb - edge) * BAR * 6);
    const sw = Math.max(0, (lb - 3.25) / 0.75);
    this.pass.draw(out, a, b, api.u, { uN: N, uPop: pop, uSw: sw * sw * (3 - 2 * sw), uT: t0, uBeat: (f.t - B0) / BEAT });
    return { ca: 0.6 + 1.2 * pop, bloom: 0.5, bloomThreshold: 0.85 };
  }
  dispose() { this.pass.dispose(); this.rts.forEach((r) => r.dispose()); }
}

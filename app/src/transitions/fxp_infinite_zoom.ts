// fxp_infinite_zoom (recap tunnel -> finale, bars 101-105): one unbroken zoom through the whole film. Every half bar the
// camera dives into a window inside the current world, and that window is another world of the film, sampled live
// (api.sampleScene) at its own running time: tunnel -> night city -> paper -> prism -> type -> intro -> terrain -> dawn
// city -> the finale. Each window sits on a feature of its host world (a tower, the paper f(x), a lens, a ring).
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { overlay } from '../scenes/fx_promo/kit';

// [scene id, sample time, window centre in that world (screen x, y from top)]. Layer 0 is the outgoing scene, the
// last window opens on the incoming one.
// The fifth value is a gain: sampled worlds arrive before their own exposure/grade, so the bright ones are pulled down.
const WORLDS: [string, number, number, number, number][] = [
  ['', 0, 0.5, 0.47, 0.75], ['a4_city', 80, 0.585, 0.6, 1], ['a7_paper', 140, 0.6, 0.42, 0.8], ['s2b_prism', 23.5, 0.5, 0.42, 0.5],
  ['s3_type', 44, 0.53, 0.47, 0.85], ['s1_boot_c', 13.5, 0.5, 0.71, 1], ['s2_surface', 32, 0.5, 0.3, 1], ['s10_finale', 202.5, 0.5, 0.52, 1],
];
const N = WORLDS.length;
const H = 0.24;
const DUR = 7.771;

const FRAG = `uniform sampler2D L0; uniform sampler2D L1; uniform sampler2D L2; uniform vec2 c0; uniform vec2 c1;
uniform vec3 uG; uniform float uF; uniform float uDepth; uniform float uBlur; uniform float uKick; uniform float uRgb;
const float H = ${H.toFixed(3)};
vec3 look(vec2 s, out float glow){
  vec2 P = (c0 - 0.5 * H) / (1.0 - H);
  vec2 x = P + (s - P) * pow(H, uF);
  glow = 0.0;
  vec2 d = (x - c0) / (0.5 * H);
  float e = 1.0 - max(abs(d.x), abs(d.y));
  float sz = 0.5 * pow(H, 1.0 - uF);
  float es = e * sz;
  if (e < 0.0) { glow += exp(es * 1400.0) * 1.2 + exp(es * 80.0) * 0.2; return uG.x * texture2D(L0, x).rgb * (1.0 - 0.6 * exp(es * 60.0)); }
  glow += exp(-es * 1400.0) * 2.0 + exp(-es * 80.0) * 0.12;
  vec2 x1 = 0.5 + (x - c0) / H;
  if (uDepth < 1.5) return uG.y * texture2D(L1, x1).rgb;
  vec2 d1 = (x1 - c1) / (0.5 * H);
  float e1 = 1.0 - max(abs(d1.x), abs(d1.y));
  float es1 = e1 * sz * H;
  if (e1 < 0.0) { glow += exp(es1 * 1400.0) * 1.2 + exp(es1 * 80.0) * 0.2; return uG.y * texture2D(L1, x1).rgb * (1.0 - 0.6 * exp(es1 * 60.0)); }
  glow += exp(-es1 * 1400.0) * 2.0;
  return uG.z * texture2D(L2, 0.5 + (x1 - c1) / H).rgb;
}
void main(){
  vec3 c = vec3(0.0); float g = 0.0, gi;
  for (int i = 0; i < 6; i++) {
    float o = (float(i) - 2.5) / 5.0;
    vec2 P = (c0 - 0.5 * H) / (1.0 - H);
    vec2 s = P + (vUv - P) * (1.0 + o * uBlur);
    vec2 sr = P + (s - P) * (1.0 + uRgb), sb = P + (s - P) * (1.0 - uRgb);
    c += vec3(look(sr, gi).r, look(sb, gi).b, 0.0).rbg + vec3(0.0, look(s, gi).g, 0.0);
  }
  c /= 6.0; look(vUv, g);
  c += SIGNAL * g * (1.6 + 2.0 * uKick) + vec3(1.0, 0.85, 0.7) * smoothstep(0.6, 2.0, g) * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpInfiniteZoom implements Transition {
  private pass: ShaderPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new ShaderPass(ctx, FRAG, {
      L0: { value: null }, L1: { value: null }, L2: { value: null }, c0: { value: new THREE.Vector2() }, c1: { value: new THREE.Vector2() },
      uG: { value: new THREE.Vector3(1, 1, 1) }, uF: { value: 0 }, uDepth: { value: 2 }, uBlur: { value: 0 }, uKick: { value: 0 }, uRgb: { value: 0 },
    });
  }
  render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const { renderer: r, comp } = this.ctx;
    const z = api.u * N;
    const k = Math.floor(z);
    if (k >= N) { comp.draw(r, b, out, { mode: 'replace' }); return; }
    const fr = z - k;
    // Each dive eases in then punches through on the half-bar, so the crossing lands on the beat.
    const fe = fr + 0.45 * (fr * fr * (3 - 2 * fr) - fr);
    const lt = api.u * DUR;
    const tex = (i: number): THREE.Texture => {
      if (i === 0) return a;
      if (i >= N) return b;
      const [id, base] = WORLDS[i]!;
      overlay.on = false;
      try { return api.sampleScene(id, base + lt); } finally { overlay.on = true; }
    };
    const ctr = (i: number) => new THREE.Vector2(WORLDS[i]![2], 1 - WORLDS[i]![3]);
    const speed = 1 - Math.abs(fr - 0.5) * 2;
    this.pass.draw(out, a, b, api.u, {
      L0: tex(k), L1: tex(k + 1), L2: k + 2 <= N ? tex(k + 2) : b, c0: ctr(k), c1: k + 1 < N ? ctr(k + 1) : new THREE.Vector2(0.5, 0.5),
      uG: new THREE.Vector3(WORLDS[k]![4], WORLDS[k + 1]?.[4] ?? 1, WORLDS[k + 2]?.[4] ?? 1), uF: fe, uDepth: k + 1 < N ? 2 : 1, uBlur: 0.02 + 0.07 * speed, uKick: f.a.kick, uRgb: 0.004 + 0.01 * speed,
    });
    const hit = Math.exp(-fr * 9) * (k > 0 ? 1 : 0);
    return { invert: 0, zoom: 1, flash: 0, ca: 0.4 + 1.4 * hit, bloom: 0.45 + 0.4 * hit, bloomThreshold: 0.9, exposure: 1 + 0.25 * hit, shake: [6 * hit, 6 * hit] };
  }
  dispose() { this.pass.dispose(); }
}

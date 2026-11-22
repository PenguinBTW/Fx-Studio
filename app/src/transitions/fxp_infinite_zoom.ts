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
// Portal shape cut into each host world (the thing the camera dives through) and its rim colour:
// 0 tall tower window, 1 octagon (tunnel end), 2 lens/ring, 3 slit between monoliths, 4 paper diamond cut-out, 5 wide slot.
const SHAPE = [1, 0, 4, 2, 3, 2, 1, 2];
const RIM: [number, number, number][] = [[1, 0.45, 0.12], [1, 0.7, 0.35], [0.2, 0.15, 0.12], [0.75, 0.6, 1], [0.35, 0.8, 1], [1, 0.45, 0.12], [0.5, 1, 0.8], [1, 0.55, 0.2]];
const N = WORLDS.length;
const H = 0.24;
const DUR = 7.771;

const FRAG = `uniform sampler2D L0; uniform sampler2D L1; uniform sampler2D L2; uniform vec2 c0; uniform vec2 c1;
uniform vec3 uG; uniform vec2 uS; uniform vec3 uC0; uniform vec3 uC1; uniform float uF; uniform float uRoll; uniform float uDepth; uniform float uBlur; uniform float uKick; uniform float uRgb;
const float H = ${H.toFixed(3)};
float nrm(vec2 d, float s){
  d = abs(d);
  if (s < 0.5) return max(d.x * 1.6, d.y);
  if (s < 1.5) return max(max(d.x, d.y), (d.x + d.y) * 0.7071 * 1.1);
  if (s < 2.5) return length(d);
  if (s < 3.5) return max(d.x * 2.6, d.y);
  if (s < 4.5) return d.x + d.y;
  return max(d.x, d.y * 1.6);
}
vec3 look(vec2 s, out float glow, out vec3 rim){
  vec2 P = (c0 - 0.5 * H) / (1.0 - H);
  // Bank through each dive (zero at both ends so the hand-offs stay seamless).
  // Scale with the roll so the rotated frame always covers the screen (no texture edge shows at the corners).
  vec2 q = s - 0.5; q.x *= 1.7778; q = mat2(cos(uRoll), -sin(uRoll), sin(uRoll), cos(uRoll)) * q; q.x /= 1.7778;
  s = q / (cos(abs(uRoll)) + 1.7778 * sin(abs(uRoll))) + 0.5;
  vec2 x = P + (s - P) * pow(H, uF);
  glow = 0.0;
  vec2 d = (x - c0) / (0.5 * H);
  // The portal opens out to the full window as the dive completes, so the hand-off to the next layer is seamless.
  // The opening keeps its world's shape and overgrows the frame (no rectangular screen ever forms).
  float e = 1.0 - nrm(d, uS.x) * mix(1.0, 1.0 / nrm(vec2(1.0), uS.x), smoothstep(0.4, 1.0, uF));
  float sz = 0.5 * pow(H, 1.0 - uF);
  float es = e * sz;
  rim = uC0;
  if (e < 0.0) {
    // The host world bends around the opening like a lens rim, so the portal sits in it rather than on it.
    // Parallax: the host world rushes outward past the opening faster than the opening grows.
    float fade = 1.0 - smoothstep(0.45, 0.9, uF), par = sin(3.14159 * uF);
    vec2 xb = c0 + (x - c0) * (1.0 - 0.3 * par) + (x - c0) * 0.18 * fade * exp(es * 45.0);
    glow += exp(es * 900.0) * 0.8 + exp(es * 70.0) * 0.12;
    return uG.x * texture2D(L0, xb).rgb * (1.0 - 0.5 * fade * exp(es * 60.0));
  }
  glow += exp(-es * 900.0) * 1.2 + exp(-es * 70.0) * 0.06;
  vec2 x1 = 0.5 + (x - c0) / H;
  if (uDepth < 1.5) return uG.y * texture2D(L1, x1).rgb;
  vec2 d1 = (x1 - c1) / (0.5 * H);
  float e1 = 1.0 - nrm(d1, uS.y);
  float es1 = e1 * sz * H;
  rim = uC1;
  if (e1 < 0.0) { glow += exp(es1 * 900.0) * 0.8 + exp(es1 * 70.0) * 0.12; return uG.y * texture2D(L1, x1 + (x1 - c1) * 0.18 * exp(es1 * 45.0)).rgb * (1.0 - 0.5 * exp(es1 * 60.0)); }
  glow += exp(-es1 * 900.0) * 1.2;
  return uG.z * texture2D(L2, 0.5 + (x1 - c1) / H).rgb;
}
// Foreground host geometry (towers, monoliths, tunnel ribs) flies past the camera in front of the opening,
// faster than the opening grows, so the portal reads as a place inside the world rather than a picture on it.
float occ(vec2 uv, out float edge){
  edge = 0.0;
  float a = smoothstep(0.02, 0.2, uF) * (1.0 - smoothstep(0.8, 0.97, uF));
  if (a <= 0.0) return 0.0;
  vec2 p = uv - c0; p.x *= 1.7778;
  float grow = pow(1.0 / H, uF * 1.25), m = 0.0;
  if (uS.x > 0.5 && uS.x < 2.5) {
    // Tunnel ribs / lens rings: concentric bands expanding past the camera.
    // Thick extruded ribs: each has a lit inner bevel (the face toward the camera's path) and a dark outer body.
    float ang = atan(p.y, p.x);
    for (int j = 0; j < 3; j++) {
      float r = (0.16 + 0.12 * float(j)) * grow, w = 0.055 * grow;
      float rr = length(p), dd = abs(rr - r) - w;
      float rib = smoothstep(0.006, -0.006, dd) * (0.75 + 0.25 * step(0.0, sin(ang * 8.0)));
      m = max(m, rib);
      float inner = clamp((r + w - rr) / (2.0 * w), 0.0, 1.0);
      edge = max(edge, rib * (pow(inner, 4.0) * 0.9 + exp(-abs(rr - (r - w)) * 300.0)));
    }
  } else {
    // Towers / monoliths / paper strips: slabs either side of the opening sliding outward.
    for (int j = 0; j < 4; j++) {
      float side = mod(float(j), 2.0) * 2.0 - 1.0, x0 = side * (0.2 + 0.12 * float(j / 2)) * grow, w = (0.035 + 0.015 * float(j)) * grow;
      float top = (0.22 + 0.25 * fract(float(j) * 0.618)) * grow;
      float dd = max(abs(p.x - x0) - w, p.y - top);
      m = max(m, smoothstep(0.004, -0.004, dd)); edge = max(edge, exp(-abs(abs(p.x - x0) - w) * 300.0) * step(p.y, top));
    }
  }
  edge *= a; return m * a;
}
void main(){
  vec3 c = vec3(0.0), rim, ri; float g = 0.0, gi;
  for (int i = 0; i < 6; i++) {
    float o = (float(i) - 2.5) / 5.0;
    vec2 P = (c0 - 0.5 * H) / (1.0 - H);
    vec2 s = P + (vUv - P) * (1.0 + o * uBlur);
    vec2 sr = P + (s - P) * (1.0 + uRgb), sb = P + (s - P) * (1.0 - uRgb);
    c += vec3(look(sr, gi, ri).r, look(sb, gi, ri).b, 0.0).rbg + vec3(0.0, look(s, gi, ri).g, 0.0);
  }
  c /= 6.0; look(vUv, g, rim);
  // The rim dies away as the portal fills the frame, so the screen never ends up framed by it.
  g *= 1.0 - smoothstep(0.4, 0.85, uF);
  c += rim * g * (1.4 + 1.6 * uKick) + vec3(1.0, 0.9, 0.8) * smoothstep(0.7, 2.0, g) * 0.4;
  float oe, om = occ(vUv, oe);
  vec3 fg = texture2D(L0, c0 + (vUv - c0) * 0.35).rgb * 0.12 * uG.x;
  c = mix(c, fg, om) + rim * oe * (0.6 + 0.8 * uKick);
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpInfiniteZoom implements Transition {
  private pass: ShaderPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new ShaderPass(ctx, FRAG, {
      L0: { value: null }, L1: { value: null }, L2: { value: null }, c0: { value: new THREE.Vector2() }, c1: { value: new THREE.Vector2() },
      uG: { value: new THREE.Vector3(1, 1, 1) }, uS: { value: new THREE.Vector2() }, uC0: { value: new THREE.Vector3() }, uC1: { value: new THREE.Vector3() }, uF: { value: 0 }, uDepth: { value: 2 }, uBlur: { value: 0 }, uKick: { value: 0 }, uRgb: { value: 0 }, uRoll: { value: 0 },
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
      uG: new THREE.Vector3(WORLDS[k]![4], WORLDS[k + 1]?.[4] ?? 1, WORLDS[k + 2]?.[4] ?? 1), uS: new THREE.Vector2(SHAPE[k]!, SHAPE[k + 1] ?? 2), uC0: new THREE.Vector3(...RIM[k]!), uC1: new THREE.Vector3(...(RIM[k + 1] ?? RIM[0]!)), uRoll: (k % 2 ? -1 : 1) * 0.14 * Math.sin(Math.PI * fe), uF: fe, uDepth: k + 1 < N ? 2 : 1, uBlur: 0.02 + 0.07 * speed, uKick: f.a.kick, uRgb: 0.004 + 0.01 * speed,
    });
    const hit = Math.exp(-fr * 9) * (k > 0 ? 1 : 0);
    return { invert: 0, zoom: 1, flash: 0, ca: 0.4 + 1.4 * hit, bloom: 0.45 + 0.4 * hit, bloomThreshold: 0.9, exposure: 1 + 0.25 * hit, shake: [6 * hit, 6 * hit] };
  }
  dispose() { this.pass.dispose(); }
}

// Zoom-fold renderer: the self-similar Interlock glyph tree evaluated per pixel (up to 9 octaves),
// plus the exact (double precision) camera maths shared by Beat 3 and Beat 4.
import * as THREE from 'three';
import { FSPass } from '../../engine/gl';
import { clamp, smoothstep, ease, prog, lerp } from '../../engine/util';
import { GLYPH_COLORS_GLSL, GLYPH_GLSL, RATIO, PX0, chainC } from './glyph_glsl';

export const TOP = 8; // the single enormous glyph G_8 (6^8 = 1.68e6 > the 1e6 zoom)
export const Z_END = 1e6;
const K_ZOOM = Math.log(Z_END);
export const ROT_MAX = (4 * Math.PI) / 180;

const FRAG = /* glsl */ `
uniform vec2 uRes; uniform float uRoot; uniform vec2 uOff; uniform float uSpx; uniform float uRot;
uniform float uDim;
${GLYPH_COLORS_GLSL}
${GLYPH_GLSL}
void main() {
  vec2 px = FRAG_PX - 0.5 * uRes;
  px = rot2(uRot) * px;
  vec2 p = uOff + px / uSpx;
  vec3 C = vec3(0.0);
  gTrace(p, uSpx * PX_SCALE, int(uRoot + 0.5), C);
  vec3 bone = mix(K_BONE, K_ASH * 1.05, uDim);
  vec3 ash = K_ASH * mix(1.0, 0.7, uDim);
  vec3 red = K_RED * mix(1.0, 0.4, uDim);
  fragColor = vec4(K_VOID + C.x * bone + C.y * ash + C.z * red, 1.0);
}`;

export class ZoomFold {
  pass: FSPass;
  constructor() {
    this.pass = new FSPass(FRAG, {
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uRoot: { value: 2 }, uOff: { value: new THREE.Vector2() }, uSpx: { value: 384 }, uRot: { value: 0 },
      uDim: { value: 0 }, uParentK: { value: 1 }, uChainK: { value: 1 }, uTopL: { value: TOP }, uEmph: { value: 1 }, uLatt: { value: 1 },
    });
  }
  set(v: View, o: { dim?: number; parentK?: number; chainK?: number; emph?: number; latt?: number }) {
    const u = this.pass.u;
    u.uRoot!.value = v.root;
    (u.uOff!.value as THREE.Vector2).set(v.offx, v.offy);
    u.uSpx!.value = v.spx;
    u.uRot!.value = v.rot;
    u.uDim!.value = o.dim ?? 0;
    u.uParentK!.value = o.parentK ?? 1;
    u.uChainK!.value = o.chainK ?? 1;
    u.uEmph!.value = o.emph ?? 1;
    u.uLatt!.value = o.latt ?? 1;
  }
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    this.pass.render(renderer, target, true);
    renderer.resetState();
  }
  dispose() { this.pass.dispose(); }
}

export interface View { root: number; offx: number; offy: number; spx: number; rot: number }

/** View from a world centre `c` (G0 units, y = 0) and zoom Z (px per G0 unit = PX0 / Z). */
export function viewFromWorld(c: number, Z: number, rot: number): View {
  const f = Math.log(Math.max(1, Z)) / Math.log(RATIO);
  const root = clamp(Math.ceil(f) + 2, 2, TOP);
  const un = Math.pow(RATIO, root);
  return { root, offx: (c - chainC(root)) / un, offy: 0, spx: (PX0 / Z) * un, rot };
}

// ------------------------------------------------------------------ Beat 3 camera
const ez = (u: number) => u + 0.65 * (u * u * (3 - 2 * u) - u);
const dez = (u: number) => 0.35 + 0.65 * 6 * u * (1 - u);
export const zoomU = (t: number) => clamp((t - 30) / 28, 0, 1);
export const zoomZ = (t: number) => Math.exp(K_ZOOM * ez(zoomU(t)));
/** d ln Z / dt, normalised to its maximum (0..1), for blur and chromatic aberration. */
export const zoomSpeed = (t: number) => (t < 30 || t > 58 ? 0 : dez(zoomU(t)) / 1.325);
export const zoomRot = (t: number) => ROT_MAX * ez(zoomU(t));

/** World x of pictogram l's centre (it sits in the output node of chain glyph G_l). */
export const pictX = (l: number) => chainC(l) + 0.8 * Math.pow(RATIO, l);
const bump = (s: number, l: number) => smoothstep(l - 1.05, l - 0.6, s) * (1 - smoothstep(l - 0.4, l + 0.05, s));

/** Camera x (G0 units): tracks the nested chain, panning onto each pictogram while it is readable. */
export function zoomCenter(t: number): number {
  const Z = zoomZ(t);
  const s = Math.log(Math.max(1, Z)) / Math.log(RATIO);
  const chain = 0.96 * (Z - 1);
  let c = chain;
  let wsum = 0;
  for (let l = 1; l <= 6; l++) {
    const w = bump(s, l);
    c += w * (pictX(l) - chain);
    wsum += w;
  }
  void wsum;
  const a = ease.inOutCubic(prog(t, 52, 58));
  return lerp(c, chainC(TOP), a);
}
export const dimAt = (t: number) => smoothstep(57.55, 58.0, t);
export const parentK = (Z: number) => smoothstep(1.0, 3.0, Z);

// ------------------------------------------------------------------ Beat 4 camera
export const RING_SPX = 1100; // G_8 units -> px at the ring close-up
export const RING_CX = -0.8 + (960 - 700) / RING_SPX; // ring centre sits at x = 700 px
export const RING_Z = (PX0 * Math.pow(RATIO, TOP)) / RING_SPX;
export const RING_C = chainC(TOP) + RING_CX * Math.pow(RATIO, TOP);
const RING_SHIFT = (RING_C - 0.96 * (RING_Z - 1)) / RING_Z;
export const SPX_G8 = (PX0 / Z_END) * Math.pow(RATIO, TOP);

export function ringView(t: number): View {
  const l = ease.inOutCubic(prog(t, 58, 62.5));
  const spx = SPX_G8 * Math.pow(RING_SPX / SPX_G8, l);
  return { root: TOP, offx: RING_CX * l, offy: 0, spx, rot: ROT_MAX * (1 - l) };
}

/** 67 -> 69.3: dive back down the scales along the Beat 3 path to the single G_0 (3x faster). */
export function reverseView(t: number): { view: View; Z: number } {
  const l = ease.inOutCubic(prog(t, 67, 69.3));
  const Z = Math.exp(Math.log(RING_Z) * (1 - l));
  const c = 0.96 * (Z - 1) + RING_SHIFT * Z * (1 - smoothstep(0.35, 1, l));
  return { view: viewFromWorld(c, Z, 0), Z };
}

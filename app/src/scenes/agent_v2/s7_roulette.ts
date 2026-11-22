// S7 style roulette (bars 45-53): one coiling dragon, one continuous orbit, and a new art direction on every beat —
// then every half beat — each with its own backdrop palette. The silhouette never changes; everything else does.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { BEAT, BAR, bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import { StylePass, STYLE } from './style';
import type { PathFn } from './dragon';

export const T45 = bar(45), T49 = bar(49), S7_END = bar(53);
export const S7_LINES: TLine[] = [{ text: 'pick a style. any style.', at: T45 - 1.3, hold: 0.5, cps: 24 }];
export type Look = { m: number; paper: number; fold: number; a: number; b: number; pat: number; tag: string };
export const LOOKS: Look[] = [
  { m: STYLE.none, paper: 0, fold: 0, a: 0x061a22, b: 0x0e5a66, pat: 0, tag: 'obsidian' },
  { m: STYLE.ascii, paper: 1, fold: 0, a: 0x000000, b: 0x0a3a12, pat: 1, tag: 'ascii' },
  { m: STYLE.comic, paper: 0, fold: 0, a: 0xffd21a, b: 0xff7a10, pat: 3, tag: 'comic' },
  { m: STYLE.blueprint, paper: 0, fold: 0, a: 0x0b2a6a, b: 0x123c8a, pat: 1, tag: 'blueprint' },
  { m: STYLE.none, paper: 1, fold: 1, a: 0xf0e8d8, b: 0xd8ccb4, pat: 0, tag: 'origami' },
  { m: STYLE.thermal, paper: 0, fold: 0, a: 0x05020a, b: 0x2a0a3a, pat: 0, tag: 'thermal' },
  { m: STYLE.pixel, paper: 0, fold: 0, a: 0x2a0a4a, b: 0x00b0c8, pat: 2, tag: 'pixel' },
  { m: STYLE.glass, paper: 0, fold: 0, a: 0x40062a, b: 0xe02a80, pat: 3, tag: 'stained-glass' },
  { m: STYLE.woodblock, paper: 0, fold: 0, a: 0xf2e6cc, b: 0xc8301e, pat: 0, tag: 'woodblock' },
  { m: STYLE.xray, paper: 0, fold: 0, a: 0x000000, b: 0x06222a, pat: 1, tag: 'x-ray' },
  { m: STYLE.paint, paper: 0, fold: 0, a: 0xe86a1a, b: 0x2a4a8a, pat: 0, tag: 'oil-paint' },
  { m: STYLE.none, paper: 1, fold: 0, a: 0xece2cc, b: 0xb8a888, pat: 2, tag: 'paper' },
];
/** look index + start time of the current slot: one per beat for 4 bars, then one per half beat */
export function slot(T: number) { if (T < T49) { const k = Math.max(0, Math.floor((T - T45) / BEAT)); return { k, at: T45 + k * BEAT }; }
  const j = Math.floor((T - T49) / (BEAT / 2)); return { k: 16 + j, at: T49 + j * BEAT / 2 }; }
export const rouPath: PathFn = (p, o) => o.set(3.2 * Math.cos(p * 0.55), 0.28 * p - 2.6 + 0.3 * Math.sin(p * 1.7), 3.2 * Math.sin(p * 0.55));
export const BG_F = /* glsl */ `uniform vec3 uA, uB; uniform float uPat, uT; varying vec2 vUv; void main() { vec2 p = vUv * vec2(1.78, 1.0);
  float g = smoothstep(0.0, 1.0, vUv.y + 0.15 * sin(vUv.x * 3.0)); vec3 c = mix(uA, uB, g);
  if (uPat == 1.0) c += 0.06 * (step(0.96, fract(p.x * 18.0)) + step(0.96, fract(p.y * 18.0))) * (uB + 0.2);
  if (uPat == 2.0) { vec2 f = fract(p * 22.0) - 0.5; c = mix(c, uB * 1.3, 0.35 * smoothstep(0.22, 0.18, length(f))); }
  if (uPat == 3.0) { vec2 q = (vUv - 0.5) * vec2(1.78, 1.0); c = mix(c, uB, step(0.5, fract(atan(q.y, q.x) * 3.8197 + uT * 0.1))); }
  gl_FragColor = vec4(c * 1.6, 1.0); }`;

export default class S7Roulette extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 400);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private style = new StylePass();
  private bgU = { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uPat: { value: 0 }, uT: { value: 0 } };
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 0;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.bgU, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0); }', fragmentShader: BG_F }));
    bg.frustumCulled = false; bg.renderOrder = -1; this.scene.add(bg);
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.25;
    const key = new THREE.DirectionalLight(0xfff0e0, 3.2); key.position.set(-4, 7, 5); const rim = new THREE.DirectionalLight(0x80d8ff, 3.0); rim.position.set(5, 2, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x8090b0, 0x201810, 0.5));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, s = slot(T), L = LOOKS[(s.k * 5) % LOOKS.length]!, P = this.rig.paperU;
    P.paper.value = P.facet.value = L.paper; P.fold.value = P.ink.value = L.fold;
    this.bgU.uA.value.setHex(L.a); this.bgU.uB.value.setHex(L.b); this.bgU.uPat.value = L.pat; this.bgU.uT.value = T;
    const head = 8 + (T - T45) * 2.1; this.rig.dragon.pose(rouPath, head, LEN); this.rig.reveal.value = 1; this.rig.jaw.value = 0.3 + 0.2 * Math.sin(T * 2.0);
    const nb = Math.floor((T - T45) / BAR), qb = T - T45 - nb * BAR, whip = 0.7 * (nb + (1 - Math.exp(-qb * 18)) - 1);
    const az = 0.25 * (T - T45) + whip, hp = new THREE.Vector3(); rouPath(head - 3, hp);
    this.cam.position.set(9.0 * Math.sin(az), hp.y + 1.8 + 0.8 * Math.sin(az * 0.7), 9.0 * Math.cos(az)); this.cam.lookAt(0, hp.y - 0.4, 0); this.cam.updateProjectionMatrix();
    this.style.render(rr, this.scene, this.cam, out, L.m, T);
    const g = this.layer.ctx; this.layer.clear(); const duck = overlayTextDuck(f.tin, f.tout);
    term(g, S7_LINES, T, { size: 46, x: 200, align: 'left', y: 930, halo: 'rgba(0,0,0,0.6)', alpha: duck });
    if (T >= T45) term(g, [{ text: `style --${L.tag}`, at: s.at, hold: 9, cps: 140 }], T, { size: 30, x: 96, y: 96, align: 'left', prompt: '> ', halo: 'rgba(0,0,0,0.55)', alpha: duck });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const kick = Math.exp(-(T - s.at) * 12);
    return { exposure: 1.0, bloom: 0.2, bloomThreshold: 0.95, grain: 0.03, vignette: 0.25, ca: 0.2 + 1.5 * kick, zoom: 1 + 0.03 * kick };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.style.dispose(); }
}

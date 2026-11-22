// S6 comic (bars 37-45, the drop): the same dragon redrawn as a printed comic — CMYK halftone, ink lines, animated on twos,
// cut into panel layouts that change on every bar, with hand-lettered sound effects punching in on the downbeats.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FSPass, Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { BEAT, BAR, bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN, type DragonLook } from './rig';
import { StylePass, STYLE } from './style';
import type { PathFn } from './dragon';

export const T37 = bar(37), S6_END = bar(45);
export const COMIC: DragonLook = { scale: 0xe0186e, iri: 0, metal: 0, rough: 0.45, horn: 0xffd21a, mane: 0x00a6e6, maneSheen: 0x80e0ff, fin: 0xffc400, finGlow: 0x000000, seam: 0, eye: [1, 1, 0.2] };
export const S6_LINES: TLine[] = [{ text: 'comic book? watch.', at: T37 - 1.1, hold: 0.55, cps: 22 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const comicPath: PathFn = (p, o) => o.set(p * 1.15 - 3, 1.5 * Math.sin(p * 0.42) + 0.4 * Math.sin(p * 1.1), 1.6 * Math.sin(p * 0.31 + 1.0));
const V = 3.2;
type Quad = [number, number, number, number, number, number, number, number];
// per-bar panel layouts in uv (x right, y up), corners CCW
const LAYOUTS: Quad[][] = [
  [[0, 0, 1, 0, 1, 1, 0, 1]],
  [[0.02, 0.03, 0.6, 0.03, 0.42, 0.97, 0.02, 0.97], [0.62, 0.03, 0.98, 0.03, 0.98, 0.97, 0.44, 0.97]],
  [[0.02, 0.52, 0.55, 0.52, 0.55, 0.97, 0.02, 0.97], [0.57, 0.48, 0.98, 0.56, 0.98, 0.97, 0.57, 0.97], [0.02, 0.03, 0.98, 0.03, 0.98, 0.5, 0.02, 0.5]],
  [[0, 0, 1, 0, 1, 1, 0, 1]],
  [[0.02, 0.03, 0.32, 0.03, 0.34, 0.97, 0.02, 0.97], [0.34, 0.03, 0.66, 0.03, 0.64, 0.97, 0.36, 0.97], [0.68, 0.03, 0.98, 0.03, 0.98, 0.97, 0.66, 0.97]],
  [[0.02, 0.03, 0.98, 0.03, 0.98, 0.4, 0.02, 0.62], [0.02, 0.64, 0.98, 0.42, 0.98, 0.97, 0.02, 0.97]],
  [[0.02, 0.03, 0.48, 0.03, 0.48, 0.97, 0.02, 0.97], [0.5, 0.5, 0.98, 0.5, 0.98, 0.97, 0.5, 0.97], [0.5, 0.03, 0.98, 0.03, 0.98, 0.48, 0.5, 0.48]],
  [[0, 0, 1, 0, 1, 1, 0, 1]],
];
const SFX = ['KRAKOOM!', 'SKREEE', 'WHAM!', 'FWOOSH', 'KA-CHUNK', 'ZRAKK!', 'BOOM', 'THOOM!'];

const BG_F = /* glsl */ `uniform float uT, uHue; varying vec2 vUv; void main() { vec2 p = (vUv - vec2(0.62, 0.58)) * vec2(1.78, 1.0);
  float a = atan(p.y, p.x), r = length(p); float ray = step(0.5, fract(a * 3.8197 + uT * 0.05));
  vec3 c1 = mix(vec3(1.0, 0.86, 0.1), vec3(0.15, 0.75, 1.0), uHue), c2 = mix(vec3(1.0, 0.55, 0.05), vec3(0.95, 0.2, 0.6), uHue);
  vec3 c = mix(c1, c2, ray) * (1.15 - 0.5 * r); gl_FragColor = vec4(c * 2.2, 1.0); }`;
const COMP_F = /* glsl */ `uniform sampler2D tP0, tP1, tP2; uniform vec2 uQ[12]; uniform int uN; uniform vec4 uMap[3]; uniform float uT;
float sd(vec2 p, vec2 a, vec2 b) { vec2 e = b - a, n = normalize(vec2(-e.y, e.x)); return dot(p - a, n); }
void main() { vec2 uv = vUv, px = uv * vec2(1920.0, 1080.0); vec3 paper = vec3(0.97, 0.94, 0.86) - 0.04 * fract(sin(dot(floor(px / 3.0), vec2(12.9, 78.2))) * 43758.5);
  vec3 c = paper; for (int i = 0; i < 3; i++) { if (i >= uN) break; float d = 1e9;
    for (int k = 0; k < 4; k++) { vec2 a = uQ[i * 4 + k] * vec2(1920.0, 1080.0), b = uQ[i * 4 + (k + 1) % 4] * vec2(1920.0, 1080.0); d = min(d, sd(px, a, b)); }
    if (d > 0.0) { vec2 tuv = vec2(0.5) + (uv - uMap[i].zw) / uMap[i].x; vec3 s = i == 0 ? texture(tP0, tuv).rgb : i == 1 ? texture(tP1, tuv).rgb : texture(tP2, tuv).rgb;
      c = mix(vec3(0.04), s, smoothstep(5.0, 7.0, d)); } }
  fragColor = vec4(c, 1.0); }`;

export default class S6Comic extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 400);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private style = new StylePass();
  private rts: THREE.WebGLRenderTarget[] = [];
  private bgU = { uT: { value: 0 }, uHue: { value: 0 } };
  private comp = new FSPass(COMP_F, { tP0: { value: null }, tP1: { value: null }, tP2: { value: null }, uQ: { value: Array.from({ length: 12 }, () => new THREE.Vector2()) }, uN: { value: 1 },
    uMap: { value: Array.from({ length: 3 }, () => new THREE.Vector4()) }, uT: { value: 0 } });
  override async init() {
    const g = await this.rig.load(this.ctx, COMIC); this.scene.add(g); this.rig.revGlow.value = 0;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.bgU, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0); }', fragmentShader: BG_F }));
    bg.frustumCulled = false; bg.renderOrder = -1; this.scene.add(bg);
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(-3, 6, 5); const rim = new THREE.DirectionalLight(0xffffff, 2.0); rim.position.set(4, 1, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x404060, 0.6));
  }
  private shoot(tpl: number, head: number, Tq: number) {
    const hp = new THREE.Vector3(), mid = new THREE.Vector3(), tail = new THREE.Vector3();
    comicPath(head - 0.6, hp); comicPath(head - LEN * 0.45, mid); comicPath(head - LEN * 0.9, tail);
    const s = Math.sin(Tq * 0.9);
    const C: [THREE.Vector3, THREE.Vector3, number][] = [
      [mid.clone().add(new THREE.Vector3(1.5 + s, 1.2, 9)), mid, 40], [hp.clone().add(new THREE.Vector3(1.6, -0.6, 2.4)), hp, 32],
      [tail.clone().add(new THREE.Vector3(-1.0, 3.5, 2.0)), tail.clone().lerp(mid, 0.3), 46], [hp.clone().add(new THREE.Vector3(3.2, 0.25, -0.4)), hp, 28],
    ];
    const [p, l, fov] = C[tpl % 4]!; this.cam.position.copy(p); this.cam.lookAt(l); this.cam.fov = fov; this.cam.updateProjectionMatrix();
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, Tq = Math.floor(T * 12) / 12, rr = this.ctx.renderer; // animated on twos
    const b = Math.min(7, Math.max(0, Math.floor((T - T37) / BAR))), L = LAYOUTS[b]!;
    const head = 6 + (Tq - T37) * V; this.rig.dragon.pose(comicPath, head, LEN); this.rig.reveal.value = 1;
    this.rig.jaw.value = 0.45 * Math.exp(-((Tq - T37 - b * BAR) % (BAR / 2)) * 3);
    this.bgU.uT.value = Tq; this.bgU.uHue.value = b % 2;
    for (let i = 0; i < L.length; i++) {
      if (!this.rts[i]) this.rts[i] = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType });
      this.shoot(b * 2 + i + (b === 0 ? 3 : 0), head, Tq); this.style.render(rr, this.scene, this.cam, this.rts[i]!, STYLE.comic, Tq);
      const q = L[i]!, xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]], x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      (this.comp.u.uMap!.value as THREE.Vector4[])[i]!.set(Math.max(x1 - x0, y1 - y0), 0, (x0 + x1) / 2, (y0 + y1) / 2);
      for (let k = 0; k < 4; k++) (this.comp.u.uQ!.value as THREE.Vector2[])[i * 4 + k]!.set(q[k * 2]!, q[k * 2 + 1]!);
      (this.comp.u as Record<string, THREE.IUniform>)[`tP${i}`]!.value = this.rts[i]!.texture;
    }
    this.comp.u.uN!.value = L.length; this.comp.u.uT!.value = Tq; this.comp.render(rr, out, true); rr.resetState();
    const g = this.layer.ctx; this.layer.clear(); const duck = overlayTextDuck(f.tin, f.tout);
    const lb = T - (T37 + b * BAR); if (lb >= 0 && lb < BAR * 0.6 && T >= T37) { const pop = 1 + 0.5 * Math.exp(-lb * 14), wob = Math.sin(b * 2.3) * 0.18;
      g.save(); g.globalAlpha = duck * (1 - sm(BAR * 0.45, BAR * 0.6, lb)); g.translate(b % 2 ? 1400 : 520, b % 3 ? 300 : 760); g.rotate(wob); g.scale(pop, pop);
      g.font = font(F.archivoItalic(125, 900), 190); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 34; g.strokeStyle = '#0a0a12'; g.strokeText(SFX[b]!, 10, 12); g.lineWidth = 16; g.strokeStyle = '#ffffff'; g.strokeText(SFX[b]!, 0, 0);
      g.fillStyle = b % 2 ? '#ffd21a' : '#ff2d7a'; g.fillText(SFX[b]!, 0, 0); g.restore(); }
    term(g, S6_LINES, T, { size: 46, x: 200, align: 'left', y: 930, halo: 'rgba(0,0,0,0.6)', alpha: duck });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const kick = T >= T37 ? Math.exp(-(((T - T37) % BEAT)) * 10) : 0;
    return { exposure: 1.0, bloom: 0.05, bloomThreshold: 1.0, grain: 0.03, vignette: 0.15, ca: 0.2, zoom: 1 + 0.02 * kick };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.style.dispose(); this.comp.dispose(); for (const r of this.rts) r.dispose(); }
}

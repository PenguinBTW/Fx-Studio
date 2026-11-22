// S13 rush (bars 81-93): everything collides. Cuts accelerate 2 beats -> 1 beat -> half beat -> quarter beat; each shot is
// a seeded combination of subject (dragon wide / planet / dragon close / dragon orbiting the planet), look and camera.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar, BEAT } from '../agent_promo/kit';
import { term } from './term';
import { DragonRig, LEN } from './rig';
import { StylePass } from './style';
import { BG_F, LOOKS, rouPath } from './s7_roulette';
import { planetMaterials, starfield, R, SUN } from './planet';
import type { PathFn } from './dragon';

export const T81 = bar(81), S13_END = bar(93);
const SEGS: [number, number][] = [[bar(81), BEAT * 2], [bar(85), BEAT], [bar(89), BEAT / 2], [bar(92), BEAT / 4]];
/** shot index and its start time (pure function of T) */
export function shot(T: number) { let n = 0;
  for (let i = 0; i < SEGS.length; i++) { const [t0, d] = SEGS[i]!, t1 = i + 1 < SEGS.length ? SEGS[i + 1]![0] : S13_END, c = Math.round((t1 - t0) / d);
    if (T < t1 || i === SEGS.length - 1) { const k = Math.max(0, Math.min(c - 1, Math.floor((T - t0) / d))); return { n: n + k, at: t0 + k * d, len: d, seg: i }; } n += c; }
  return { n: 0, at: T81, len: BEAT * 2, seg: 0 }; }
const hash = (n: number, s: number) => { const x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const orbitPath: PathFn = (p, o) => o.set(3.3 * Math.cos(p * 0.38), 0.7 * Math.sin(p * 0.9), 3.3 * Math.sin(p * 0.38));
const TAGS = ['world', 'dragon', 'paper', 'comic', 'ascii', 'fire', 'glass', 'x-ray', 'pixel', 'blueprint', 'thermal', 'woodblock'];

export default class S13Rush extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 600);
  private rig = new DragonRig(); private style = new StylePass(); private env!: THREE.Texture;
  private bgU = { uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uPat: { value: 0 }, uT: { value: 0 } };
  private pu = { uGrow: { value: 1 }, uSea: { value: 1 }, uForest: { value: 1 }, uMolten: { value: 0 }, uCloud: { value: 1 }, uT: { value: 0 }, uRot: { value: 0 }, uSun: { value: SUN.clone() } };
  private planet = new THREE.Group(); private bg!: THREE.Mesh; private dg!: THREE.Object3D;
  override async init() {
    const g = await this.rig.load(this.ctx); this.dg = g; this.scene.add(g); this.rig.revGlow.value = 0;
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.bgU, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0); }', fragmentShader: BG_F }));
    this.bg.frustumCulled = false; this.bg.renderOrder = -1; this.scene.add(this.bg);
    const m = planetMaterials(this.pu);
    this.planet.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 90), m.surf), new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.018, 36), m.cloud), new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.12, 36), m.halo));
    this.planet.scale.setScalar(1.1); this.scene.add(this.planet); const sf = starfield(3000, 7); this.planet.add(sf);
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.25;
    const key = new THREE.DirectionalLight(0xfff0e0, 3.2); key.position.set(-4, 7, 5); const rim = new THREE.DirectionalLight(0x80d8ff, 3.0); rim.position.set(5, 2, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x8090b0, 0x201810, 0.5));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, s = shot(T), n = s.n, sub = [0, 1, 2, 3, 1, 0, 3, 2][n % 8]!, L = LOOKS[(n * 7 + 3) % LOOKS.length]!, P = this.rig.paperU, q = (T - s.at) / s.len;
    P.paper.value = P.facet.value = L.paper; P.fold.value = P.ink.value = L.fold;
    this.bgU.uA.value.setHex(L.a); this.bgU.uB.value.setHex(L.b); this.bgU.uPat.value = L.pat; this.bgU.uT.value = T;
    const stage = Math.floor(hash(n, 2) * 3), pu = this.pu; pu.uT.value = T; pu.uRot.value = 0.04 * T + hash(n, 3) * 6;
    pu.uMolten.value = stage === 0 ? 1 : 0; pu.uGrow.value = stage === 0 ? 0 : 1; pu.uSea.value = pu.uForest.value = stage === 2 ? 1 : 0; pu.uCloud.value = stage === 2 ? 1 : 0.2;
    this.planet.visible = sub === 1 || sub === 3; this.dg.visible = sub !== 1; this.bg.visible = sub !== 1;
    const head = 8 + (T - T81) * 2.4 + n * 1.7, path = sub === 3 ? orbitPath : rouPath; this.rig.dragon.pose(path, head, LEN); this.rig.reveal.value = 1; this.rig.jaw.value = 0.3 + 0.3 * hash(n, 4);
    const hp = new THREE.Vector3(); path(head - 0.5, hp); const az = hash(n, 5) * 6.283 + q * (0.25 + 0.2 * s.seg), el = (hash(n, 6) - 0.4) * 0.9, push = 1 - 0.18 * q;
    if (sub === 0) { this.cam.position.set(9.5 * push * Math.sin(az), hp.y + 1.5 + 3 * el, 9.5 * push * Math.cos(az)); this.cam.lookAt(0, hp.y - 0.6, 0); }
    else if (sub === 1) { const d = 5.2 * push; this.cam.position.set(d * Math.sin(az), d * el * 0.6, d * Math.cos(az)); this.cam.lookAt(0, 0, 0); }
    else if (sub === 2) { const tg = new THREE.Vector3(); path(head - 2.2, tg); const d = 2.6 * push; this.cam.position.set(hp.x + d * Math.sin(az), hp.y + 0.5 + el, hp.z + d * Math.cos(az)); this.cam.lookAt(hp.clone().lerp(tg, 0.3)); }
    else { const d = 10.5 * push; this.cam.position.set(d * Math.sin(az), 2.5 + 3 * el, d * Math.cos(az)); this.cam.lookAt(0, 0, 0); }
    this.cam.fov = sub === 2 ? 32 : 38; this.cam.updateProjectionMatrix();
    this.style.render(rr, this.scene, this.cam, out, sub === 1 && L.m === 0 ? 0 : L.m, T);
    const g = this.layer.ctx; this.layer.clear();
    term(g, [{ text: `render --${TAGS[n % TAGS.length]} --${L.tag}`, at: s.at, hold: 9, cps: 260 }], T, { size: 28, x: 96, y: 96, align: 'left', prompt: '> ', halo: 'rgba(0,0,0,0.55)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const kick = Math.exp(-(T - s.at) * 14), heat = (T - T81) / (S13_END - T81);
    return { toneMap: 'aces', exposure: 1.0 + 0.15 * kick, bloom: 0.3 + 0.3 * heat, bloomThreshold: 0.85, grain: 0.04, vignette: 0.3, ca: 0.3 + 2.0 * kick * (0.5 + heat), zoom: 1 + 0.04 * kick };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.style.dispose();
    for (const o of [this.bg, ...this.planet.children]) { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); } }
}

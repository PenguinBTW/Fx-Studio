// S5 paper (bars 32-37): on each of the four sung "Technologic"s the dragon is refolded one step further into origami —
// washi skin, flat folds, snapped lattice geometry, then sumi ink — while the backdrop becomes an ink-wash landscape.
import * as THREE from 'three';
import { disposeTree } from './sky';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import type { PathFn } from './dragon';

export const T32 = bar(32), S5_END = bar(37);
export const HITS = [61.05, 63.05, 64.98, 66.82];
export const S5_LINES: TLine[] = [{ text: "paper's cheaper.", at: HITS[3]! + 0.35, hold: 1.4, cps: 16 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const paperPath: PathFn = (p, o) => o.set(p * 0.95 - 6.5, 0.9 * Math.sin(p * 0.55) + 0.25 * Math.sin(p * 1.3), -1.2 * Math.cos(p * 0.45));
const V = 1.25;

const BG_F = /* glsl */ `uniform float uInk, uT; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fb(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
void main() { vec2 uv = vUv; vec3 c = vec3(0.80, 0.75, 0.66);
  c -= 0.05 * fb(uv * vec2(9.0, 30.0)) + 0.03 * h(floor(uv * 900.0));
  c -= vec3(0.2, 0.21, 0.18) * smoothstep(0.25, 1.0, length((uv - 0.5) * vec2(1.6, 1.0)));
  for (int k = 0; k < 3; k++) { float fk = float(k); float base = 0.18 + 0.12 * fk;
    float ridge = base + 0.16 * fb(vec2(uv.x * (2.0 + fk) + fk * 7.0, fk)) + 0.05 * n(vec2(uv.x * 14.0, fk));
    float m = smoothstep(ridge + 0.004, ridge - 0.004, uv.y) * smoothstep(ridge - 0.25, ridge, uv.y + 0.08 * fb(uv * 6.0 + fk));
    float wash = (0.75 - 0.22 * fk) * uInk * smoothstep(0.0, 1.0, uInk * 3.0 - fk);
    c = mix(c, vec3(0.10, 0.10, 0.12) + 0.06 * fk, m * wash * (0.6 + 0.4 * fb(uv * 20.0 + fk))); }
  float sunD = length((uv - vec2(0.72, 0.68)) * vec2(1.78, 1.0)); c = mix(c, vec3(0.78, 0.12, 0.08), smoothstep(0.085, 0.08, sunD) * uInk);
  gl_FragColor = vec4(c, 1.0); }`;

export default class S5Paper extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 400);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private bgU = { uInk: { value: 0 }, uT: { value: 0 } };
  private flakes!: THREE.InstancedMesh;
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 0;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ uniforms: this.bgU, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.9999, 1.0); }', fragmentShader: BG_F }));
    bg.frustumCulled = false; bg.renderOrder = -1; this.scene.add(bg); this.bgMesh = bg;
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.35;
    const key = new THREE.DirectionalLight(0xfff2e0, 4.2); key.position.set(-4, 6, 6);
    const rim = new THREE.DirectionalLight(0xffe0c0, 1.6); rim.position.set(5, 2, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xfaf2e4, 0x3a2e26, 0.45));
    const fg = new THREE.PlaneGeometry(0.16, 0.16); this.flakes = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: 0xefe6d4, roughness: 0.9, side: THREE.DoubleSide }), 260);
    this.flakes.frustumCulled = false; this.scene.add(this.flakes);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, [h1, h2, h3, h4] = HITS as [number, number, number, number], P = this.rig.paperU;
    P.paper.value = sm(h1 - 0.05, h1 + 0.55, T); P.facet.value = sm(h2 - 0.05, h2 + 0.5, T); P.fold.value = sm(h3 - 0.05, h3 + 0.5, T); P.ink.value = sm(h4 - 0.05, h4 + 0.6, T); P.tint.value.setRGB(0.86, 0.2, 0.11).lerp(new THREE.Color(0.92, 0.86, 0.74), sm(h4, h4 + 0.6, T));
    this.bgU.uInk.value = sm(h4, h4 + 1.4, T); this.bgU.uT.value = T;
    const head = 4 + (T - T32) * V; this.rig.dragon.pose(paperPath, head, LEN); this.rig.reveal.value = 1;
    this.rig.jaw.value = 0.12 + 0.1 * Math.sin(T * 1.3);
    // flakes: paper offcuts shed by each refold, drifting down
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), hp = new THREE.Vector3();
    for (let i = 0; i < 260; i++) { const k = i % 4, t0 = HITS[k]!, a = T - t0, r1 = Math.sin(i * 12.9898) * 43758.5453 % 1, r2 = Math.sin(i * 78.233) * 12543.11 % 1;
      paperPath(head - Math.abs(r1) * LEN, hp); const vis = a > 0 ? Math.max(0, 1 - a / 4) : 0;
      e.set(a * 3 * r1, a * 2.1 * r2, a * 1.3); q.setFromEuler(e);
      m.compose(hp.clone().add(new THREE.Vector3(r2 * 0.8 * a, -0.35 * a * a * 0.5 - 0.2 * a, r1 * 0.6 * a)), q, new THREE.Vector3(vis, vis, vis)); this.flakes.setMatrixAt(i, m); }
    this.flakes.instanceMatrix.needsUpdate = true;
    // one camera angle per sung word, cut on the hit
    const shot = T < h1 ? 0 : T < h2 ? 1 : T < h3 ? 2 : T < h4 ? 3 : 4;
    const t0 = [T32, h1, h2, h3, h4][shot]!, dt = T - t0;
    const look = new THREE.Vector3(); paperPath(head - 2.2, look);
    const AZ = [0.25, -0.7, 0.9, -0.35, 0.05], DS = [7.5, 5.2, 4.6, 6.0, 11.5], EL = [0.18, 0.32, -0.12, 0.45, 0.12];
    const az = AZ[shot]! + 0.03 * dt, d = DS[shot]! * (1 - 0.03 * dt) + (shot === 4 ? 2.5 * sm(0, 2.5, dt) : 0);
    this.cam.position.copy(look).add(new THREE.Vector3(Math.sin(az), EL[shot]!, Math.cos(az)).normalize().multiplyScalar(d));
    if (shot === 4) look.lerp(new THREE.Vector3(0, 0.5, 0), sm(0, 2.5, dt));
    this.cam.lookAt(look); this.cam.updateProjectionMatrix();
    const rr = this.ctx.renderer; rr.setRenderTarget(out); rr.setClearColor(0xf0e8d8, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear();
    term(g, S5_LINES, T, { size: 46, x: 200, align: 'left', y: 930, color: '#17141a', cursor: '#b8201a', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const hit = HITS.reduce((acc, h) => acc + (T >= h ? Math.exp(-(T - h) * 7) : 0), 0);
    return { toneMap: 'agx', exposure: 1.05, bloom: 0.15, bloomThreshold: 1.0, vignette: 0.25, grain: 0.05, ca: 0.15 + 1.2 * hit, zoom: 1 + 0.025 * hit };
  }
  private bgMesh?: THREE.Mesh;
  override dispose() { if (this.bgMesh) disposeTree(this.bgMesh); this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.flakes.geometry.dispose(); (this.flakes.material as THREE.Material).dispose(); }
}

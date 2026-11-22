// a1_tape (bars 3-8): the prompt made physical. A paper-tape punch strikes the real ASCII bytes of the prompt, one per
// sixteenth note; light falls through the holes onto the deck. The camera tracks the tape out, then cranes straight up
// (exit vector: up) into agp_tape_lift.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { clamp, ease } from '../../engine/util';
import { release, C, BEAT, bar, model, part, present, sceneTime, PROMPT, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, spin, barOf, type CamKey } from './kit';

const P = 0.1, COLS = PROMPT.length, DECK = 0.745, LEAD = 6;
const T_PUNCH = bar(4), STEP = BEAT / 4;
export const punchTime = (i: number) => T_PUNCH + i * STEP;
const CAM: [number, CamKey][] = [
  [3, { pos: [0.55, 0.98, 0.85], tgt: [0, 0.8, 0], fov: 34 }],
  [5, { pos: [1.5, 1.05, 1.15], tgt: [1.0, 0.74, 0], fov: 32 }],
  [6.7, { pos: [3.0, 1.25, 1.45], tgt: [2.6, 0.74, 0], fov: 30 }],
  [7.6, { pos: [3.0, 2.8, 0.9], tgt: [2.7, 0.74, 0], fov: 34 }],
  [8.9, { pos: [2.8, 6.0, 0.25], tgt: [2.8, 0.74, -0.05], fov: 38 }],
];

function tapeTexture(): THREE.CanvasTexture {
  const cw = 32, h = 160, cv = document.createElement('canvas');
  cv.width = (COLS + LEAD) * cw; cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#EFE8DA'; g.fillRect(0, 0, cv.width, h);
  g.fillStyle = 'rgba(120,100,70,0.10)';
  for (let x = 0; x < cv.width; x += 3) g.fillRect(x, 0, 1, h);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const track = (k: number) => 14 + k * 15.5 + (k >= 3 ? 10 : 0);
  for (let c = 0; c < COLS + LEAD; c++) {
    const x = cv.width - (c + 0.5) * cw;
    g.beginPath(); g.arc(x, track(3) - 5, 3.5, 0, Math.PI * 2); g.fill();
    if (c >= COLS) continue;
    const code = PROMPT.charCodeAt(c);
    for (let k = 0; k < 8; k++) if ((code >> k) & 1) { g.beginPath(); g.arc(x, track(k), 6.5, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default class A1Tape extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private punch!: THREE.Object3D; private sprocket!: THREE.Object3D; private reel!: THREE.Object3D;
  private punchY = 0; private qs = new THREE.Quaternion(); private qr = new THREE.Quaternion();
  private tape!: THREE.Mesh; private feed!: THREE.Mesh;
  private clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.0);
  private tex!: THREE.CanvasTexture;

  override async init() {
    enableShadows(this.ctx);
    this.ctx.renderer.localClippingEnabled = true;
    const m = await model(this.ctx, 'tape_punch');
    shadows(m.root); this.scene.add(m.root);
    this.punch = part(m, 'punch'); this.punchY = this.punch.position.y;
    this.sprocket = part(m, 'sprocket'); this.reel = part(m, 'reel'); this.qs.copy(this.sprocket.quaternion); this.qr.copy(this.reel.quaternion);
    this.tex = tapeTexture();
    const L = (COLS + LEAD) * P;
    const geo = new THREE.PlaneGeometry(L, 0.42); geo.rotateX(-Math.PI / 2); geo.translate(-L / 2, 0, 0);
    this.tape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, clippingPlanes: [this.clip] }));
    this.tape.castShadow = true; this.tape.receiveShadow = true;
    this.feed = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.42).rotateX(-Math.PI / 2).translate(-0.625, 0, 0), new THREE.MeshStandardMaterial({ color: 0xefe8da, roughness: 0.85, side: THREE.DoubleSide }));
    this.feed.position.set(0, DECK, 0); this.feed.castShadow = true;
    this.scene.add(this.tape, this.feed);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x241811, roughness: 0.55, metalness: 0.0 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; this.scene.add(desk);
    const L2 = heroLights(this.scene, 0xffd2a0, 0x9cc9e8, 0.6, 1.6, 0.12);
    L2.rim.position.set(-4, 3, -5);
    const lamp = new THREE.SpotLight(0xffc68a, 7, 12, 0.55, 0.6, 2);
    lamp.position.set(0.6, 3.2, 0.9); lamp.target.position.set(1.4, DECK, 0); lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048); lamp.shadow.bias = -0.0002; lamp.shadow.radius = 3;
    this.scene.add(lamp, lamp.target);
    this.scene.background = new THREE.Color(0x07070a);
    this.scene.fog = new THREE.Fog(0x07070a, 6, 16);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const raw = clamp((T - T_PUNCH) / STEP + 1, 0, COLS + LEAD);
    const n = Math.floor(raw), fr = raw - n;
    const adv = n + ease.outCubic(clamp(fr * 2.5));
    // Tape: byte c sits at x = (adv - 1 - c) * P; the clip plane hides bytes still under the punch.
    this.tape.position.set((adv - 0.5) * P, DECK + 0.002, 0);
    const lastHit = n >= 1 && n <= COLS ? punchTime(n - 1) : -9;
    const strike = Math.exp(-(T - lastHit) / 0.035) * (T >= lastHit ? 1 : 0);
    this.punch.position.y = this.punchY - 0.075 * strike;
    spin(this.sprocket, this.qs, -adv * 0.75); spin(this.reel, this.qr, -adv * 0.22);
    const k = camPath(CAM, b);
    applyCam(this.cam, { ...k, pos: [k.pos[0] + 0.02 * Math.sin(T * 0.7), k.pos[1], k.pos[2]] }, strike * 0.3);
    const g = this.layer.ctx; this.layer.clear();
    const nb = PROMPT.length;
    typeLine(g, 'its last words.', 150, 860, T, bar(6.75), { size: 40, cps: 22, cursor: false });
    typeLine(g, `${nb} bytes.`, 150, 916, T, bar(7.25), { size: 40, cps: 22, color: C.signal, t1: bar(8.6) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07070a, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.05, bloom: 0.55, bloomThreshold: 0.95, vignette: 0.5, grain: 0.04 };
  }
  override dispose() { release(this.scene); this.tex.dispose(); }
}

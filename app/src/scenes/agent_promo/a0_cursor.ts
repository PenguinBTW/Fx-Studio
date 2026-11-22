// a0_cursor (bars 0-2, 0-5.6 s): the void. One orange block cursor, lit like an object, blinks on the beat while the
// user's prompt is typed; the agent answers "ok." and the camera starts to push into the block (agp_cursor_dive).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { C, BEAT, bar, model, part, present, sceneTime, PROMPT, heroLights, HALO } from './kit';

const T0 = 0.45, CPS = 17, SIZE = 44, Y = 540;
const typedAt = (T: number) => clamp(Math.floor((T - T0) * CPS), 0, PROMPT.length);

export default class A0Cursor extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  private layer = new Layer2D();
  private block!: THREE.Object3D;
  private glow = new THREE.PointLight(0xff5a1f, 0, 6, 2);
  private floor!: THREE.Mesh;

  override async init() {
    const mark = await model(this.ctx, 'fx_mark');
    this.block = part(mark, 'mark_cursor').clone();
    this.block.position.set(0, 0, 0);
    this.scene.add(this.block, this.glow);
    heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 1.6, 1.4, 0.05);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.35, metalness: 0.6 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = -0.55;
    this.scene.add(this.floor);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const g = this.layer.ctx; this.layer.clear();
    const fam = F.mono(400);
    g.font = font(fam, SIZE);
    const line = '> …' + PROMPT, full = g.measureText(line).width;
    const x0 = 960 - full / 2, n = typedAt(T), shown = line.slice(0, 3 + n);
    const fadeType = 1 - prog(T, bar(2.6), bar(3) - 0.1, ease.inCubic);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.globalAlpha = fadeType * clamp(T / 0.25);
    g.lineWidth = SIZE * 0.3; g.strokeStyle = HALO; g.strokeText(shown, x0, Y);
    g.fillStyle = C.bone; g.fillText(shown, x0, Y);
    const okT = bar(2) + 2 * BEAT;
    if (T > okT) { g.fillStyle = C.signal; g.fillText('ok.', x0, Y + SIZE * 1.7 > 0 ? Y + 64 : Y); }
    g.globalAlpha = 1;
    // The block follows the caret in screen space, then breaks free and grows toward the lens.
    const caretX = T > okT ? x0 + g.measureText('ok.').width + 8 : x0 + g.measureText(shown).width + 8;
    const caretY = T > okT ? Y + 64 : Y;
    const free = prog(T, bar(2.6), bar(3.2), ease.inOutCubic);
    const px = caretX + (960 - caretX) * free, py = caretY + (540 - caretY) * free;
    const dolly = 14 - 1.4 * clamp(T / bar(2.6)) - 9.5 * free;
    this.cam.position.set(0.35 * Math.sin(T * 0.4), 0.25 + 0.15 * free, dolly);
    this.cam.lookAt(0, 0, 0); this.cam.updateMatrixWorld(true); this.cam.updateProjectionMatrix();
    const ndc = new THREE.Vector3((px / 1920) * 2 - 1, -((py / 1080) * 2 - 1), 0.5).unproject(this.cam);
    const dir = ndc.sub(this.cam.position).normalize();
    const depth = this.cam.position.z;
    const wp = this.cam.position.clone().addScaledVector(dir, depth / -dir.z);
    this.block.position.copy(wp);
    const s = (SIZE / 1080) * 2 * depth * Math.tan((this.cam.fov * Math.PI) / 360) / 0.9;
    const typing = n < PROMPT.length && T > T0;
    const blink = typing || Math.floor((T - B_OFF) / BEAT) % 2 === 0 ? 1 : 0.12;
    this.block.scale.setScalar(s * (1 + 0.15 * free));
    this.block.rotation.y = free * 0.6;
    this.block.visible = T > 0.15;
    this.block.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m?.emissiveIntensity !== undefined) m.emissiveIntensity = 6 * blink; });
    this.glow.position.copy(wp).add(new THREE.Vector3(0, 0.1, 0.4)); this.glow.intensity = 3 * blink * (1 + 4 * free);
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07070a);
    return { exposure: 1, bloom: 0.75, bloomThreshold: 0.85, vignette: 0.55, grain: 0.05 };
  }
}
const B_OFF = bar(1);

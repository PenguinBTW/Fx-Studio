// a2_plan (bars 9-14): the plan. 119 storyboard cards, one per bar of the song, deal onto a desk under an anglepoise
// lamp; the orange marker hops along them. Then every card rises on a column as tall as that bar is loud: the plan
// becomes a 3D bar grid of the music. The camera descends from overhead (A1's exit) and dives at the marker.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { release, C, bar, model, part, present, sceneTime, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, barOf, actOfBar, h1, FACTS, rmsAt, type CamKey } from './kit';

const N = 119, COLS = 17, ROWS = 7, SX = 0.42, SZ = 0.3, CW = 0.36, CD = 0.24;
const T_DEAL0 = bar(9), T_DEAL1 = bar(12.4), T_RISE = bar(12.5);
const dealAt = (i: number) => T_DEAL0 + (i / (N - 1)) * (T_DEAL1 - T_DEAL0);
const cellPos = (i: number) => new THREE.Vector3(((i % COLS) - (COLS - 1) / 2) * SX, 0, (Math.floor(i / COLS) - (ROWS - 1) / 2) * SZ);
const ACT_NAME = ['cold open', 'prompt', 'plan', 'agents', 'build', 'watch', 'critique', 'rewrite', 'frame', 'rush', 'quiet', 'mark'];
const CAM: [number, CamKey][] = [
  [8.6, { pos: [0.1, 7.2, 0.25], tgt: [0, 0, 0], fov: 40 }],
  [11.5, { pos: [0.2, 5.0, 2.2], tgt: [0, 0, 0.1], fov: 38 }],
  [13.2, { pos: [-3.6, 2.4, 3.6], tgt: [0, 0.4, 0], fov: 34 }],
  [14.9, { pos: [2.0, 1.6, 1.3], tgt: [3.0, 1.0, 0.2], fov: 30 }],
];

function atlas(): THREE.CanvasTexture {
  const cw = 180, ch = 120, cv = document.createElement('canvas');
  cv.width = cw * COLS; cv.height = ch * ROWS;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < N; i++) {
    const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch, a = actOfBar(i + 1);
    g.fillStyle = '#EFE8DA'; g.fillRect(x, y, cw, ch);
    g.strokeStyle = 'rgba(27,26,24,0.55)'; g.lineWidth = 2; g.strokeRect(x + 8, y + 8, cw - 16, ch - 46);
    g.strokeStyle = 'rgba(27,26,24,0.35)'; g.lineWidth = 1.5; g.beginPath();
    for (let k = 0; k < 4; k++) { const px = x + 14 + h1(i, k) * (cw - 28), py = y + 14 + h1(i, k + 9) * (ch - 58); k ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    g.fillStyle = '#1B1A18'; g.font = font(F.mono(500), 17); g.textBaseline = 'alphabetic';
    g.fillText(String(i + 1).padStart(3, '0'), x + 10, y + ch - 14);
    g.font = font(F.mono(400), 13); g.fillStyle = 'rgba(27,26,24,0.6)';
    g.fillText(`A${a} ${ACT_NAME[a]}`, x + 58, y + ch - 14);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export default class A2Plan extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private cards: THREE.Mesh[] = []; private cols!: THREE.InstancedMesh;
  private loud: number[] = [];
  private marker!: THREE.Object3D; private glow = new THREE.PointLight(0xff5a1f, 0, 3, 2);
  private tex!: THREE.CanvasTexture; private m4 = new THREE.Matrix4();

  override async init() {
    enableShadows(this.ctx);
    this.tex = atlas();
    const mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.8 });
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BoxGeometry(CW, 0.008, CD);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      const u0 = (i % COLS) / COLS, v0 = 1 - (Math.floor(i / COLS) + 1) / ROWS;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / COLS, v0 + uv.getY(k) / ROWS);
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true;
      this.cards.push(mesh); this.scene.add(mesh);
      let s = 0; for (let k = 0; k < 8; k++) s += rmsAt(bar(i + 1) + (k / 8) * (bar(2) - bar(1)));
      this.loud.push(s / 8);
    }
    const mx = Math.max(...this.loud, 1e-6); this.loud = this.loud.map((v) => v / mx);
    this.cols = new THREE.InstancedMesh(new THREE.BoxGeometry(CW * 0.92, 1, CD * 0.92).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.4, metalness: 0.3 }), N);
    this.cols.castShadow = this.cols.receiveShadow = true; this.cols.frustumCulled = false; this.scene.add(this.cols);
    const lampM = await model(this.ctx, 'desk_lamp'); shadows(lampM.root);
    lampM.root.position.set(4.6, 0, -1.6); lampM.root.rotation.y = -0.5; lampM.root.scale.setScalar(1.6); this.scene.add(lampM.root);
    const spot = new THREE.SpotLight(0xffd2a0, 4, 16, 0.75, 0.9, 1.6);
    spot.position.set(3.2, 3.4, -1.0); spot.target.position.set(0, 0, 0.2); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0002;
    this.scene.add(spot, spot.target);
    const L = heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 0.35, 1.2, 0.15); L.rim.position.set(-6, 3, -6);
    const mark = await model(this.ctx, 'fx_mark');
    this.marker = part(mark, 'mark_cursor').clone(); this.marker.position.set(0, 0, 0); this.marker.scale.setScalar(0.22);
    this.scene.add(this.marker, this.glow);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2a1c13, roughness: 0.6 }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.005; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.background = new THREE.Color(0x07070a); this.scene.fog = new THREE.Fog(0x07070a, 8, 22);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const rise = prog(T, T_RISE, bar(14), ease.inOutCubic);
    const cur = clamp(Math.floor((T - T_DEAL0) / ((T_DEAL1 - T_DEAL0) / (N - 1))), 0, N - 1);
    const playBar = clamp(Math.floor(b) - 1, 0, N - 1);
    for (let i = 0; i < N; i++) {
      const p = cellPos(i), d = prog(T, dealAt(i) - 0.22, dealAt(i), ease.outCubic);
      const ripple = rise * (0.06 + 1.5 * this.loud[i]!) * ease.outBack(clamp((T - T_RISE - (i % COLS) * 0.035) / 0.9));
      const h = Math.max(0.0005, ripple);
      const c = this.cards[i]!;
      c.visible = d > 0;
      c.position.set(p.x + (1 - d) * 0.5, h + 0.004 + (1 - d) * 1.6, p.z - (1 - d) * 0.3);
      c.rotation.set((1 - d) * -1.1, (1 - d) * 0.4 * (h1(i) - 0.5), (1 - d) * 0.6);
      this.m4.compose(new THREE.Vector3(p.x, 0, p.z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
      this.cols.setMatrixAt(i, this.m4);
    }
    this.cols.instanceMatrix.needsUpdate = true;
    const idx = rise > 0 ? playBar : cur, mp = cellPos(idx);
    const hop = Math.abs(Math.sin(((T - T_DEAL0) / ((T_DEAL1 - T_DEAL0) / (N - 1))) * Math.PI));
    const top = this.cards[idx]!.position.y;
    this.marker.position.set(mp.x, top + 0.11 + (rise > 0 ? 0 : 0.06 * hop), mp.z);
    this.marker.rotation.y = T * 0.6;
    this.glow.position.copy(this.marker.position).y += 0.2; this.glow.intensity = 2.5 + 3 * prog(T, bar(14), bar(14.9));
    const k = camPath(CAM, b), dive = prog(T, bar(14.2), bar(15), ease.inCubic);
    const mpw = this.marker.position;
    const kk: CamKey = { pos: [k.pos[0] + (mpw.x - k.pos[0]) * dive * 0.85, k.pos[1] + (mpw.y + 0.4 - k.pos[1]) * dive * 0.85 + Math.sin(Math.PI * dive) * 1.1, k.pos[2] + (mpw.z + 0.3 - k.pos[2]) * dive * 0.85], tgt: [k.tgt[0] + (mpw.x - k.tgt[0]) * dive, k.tgt[1] + (mpw.y - k.tgt[1]) * dive, k.tgt[2] + (mpw.z - k.tgt[2]) * dive], fov: k.fov };
    applyCam(this.cam, kk);
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, `${FACTS.bars} bars.`, 1770, 150, T, bar(10.5), { size: 40, cps: 22, align: 'right', cursor: false, t1: bar(14.3) });
    typeLine(g, 'i planned every one.', 1770, 206, T, bar(11.2), { size: 40, cps: 22, align: 'right', color: C.signal, t1: bar(14.3) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07070a, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.05, bloom: 0.6 + 0.6 * dive, bloomThreshold: 0.8, vignette: 0.5, grain: 0.04 };
  }
  override dispose() { release(this.scene); this.layer.texture.dispose(); this.tex.dispose(); }
}

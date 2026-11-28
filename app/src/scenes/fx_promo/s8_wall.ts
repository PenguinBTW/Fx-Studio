// s8_wall (bars 67-82, 130.05 - 161.16 s): many scenes, one engine. A curved wall of Blender cards, each screen a live
// procedural mini-scene from one shared canvas atlas. Every two bars the camera pulls out of one card and dives into
// the next, landing full-frame on the downbeat — continuous motion, no cuts.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { F } from '../../engine/type';
import { clamp, ease, smoothstep } from '../../engine/util';
import { C, BAR, bar, sceneTime, model, studioEnv, present, slam, typeLine, applyCam, mixKey, type CamKey, type V3 } from './kit';
import { drawCell, CELL_NAMES } from './cells';

const NC = 5, NR = 4, CW = 512, CH = 288;
const T0 = bar(67);
const SEG = 2 * BAR;
const ORDER = [7, 12, 3, 16, 9, 1, 18, 10, 6];

export default class S8Wall extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.02, 200);
  private atlas = new Layer2D(NC * CW, NR * CH, 1);
  private layer = new Layer2D();
  private cards: { pos: THREE.Vector3; nrm: THREE.Vector3; idx: number }[] = [];

  override async init() {
    const inst = await model(this.ctx, 'card');
    const tex = this.atlas.texture;
    tex.flipY = false;
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.6;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(3, 5, 8);
    this.scene.add(key);
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
      const idx = r * NC + c;
      const o = inst.root.clone(true);
      const ang = (c - (NC - 1) / 2) * 0.2;
      const R = 11;
      const pos = new THREE.Vector3(Math.sin(ang) * R, ((NR - 1) / 2 - r) * 1.12, Math.cos(ang) * R - R);
      o.position.copy(pos);
      o.rotation.y = ang;
      const t = tex.clone();
      t.flipY = false;
      t.repeat.set(1 / NC, 1 / NR);
      t.offset.set(c / NC, r / NR);
      t.needsUpdate = true;
      const screenMat = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
      o.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh && (mm.name.includes('screen') || (mm.parent?.name ?? '').includes('screen'))) mm.material = screenMat; });
      this.scene.add(o);
      this.cards.push({ pos, nrm: new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)), idx });
    }
  }

  private wide(T: number, s: number): CamKey {
    const a = 0.35 * Math.sin(s * 1.9);
    return { pos: [Math.sin(a) * 8.5, 0.6 * Math.sin(s * 1.3) + 0.2, Math.cos(a) * 8.5 - 2.5 + 0.3 * Math.sin(T * 0.5)], tgt: [0, 0, -1.2], fov: 46, roll: 0.04 * Math.sin(s * 2.3) };
  }
  private dive(card: { pos: THREE.Vector3; nrm: THREE.Vector3 }): CamKey {
    const d = 0.94;
    const p: V3 = [card.pos.x + card.nrm.x * d, card.pos.y, card.pos.z + card.nrm.z * d];
    return { pos: p, tgt: [card.pos.x, card.pos.y, card.pos.z], fov: 50 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = Math.max(0, T - T0);
    const s = Math.floor(lt / SEG), u = lt / SEG - s;

    const g2 = this.atlas.ctx;
    for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) drawCell(g2, r * NC + c, c * CW, r * CH, CW, CH, T, f.a);
    g2.strokeStyle = C.void; g2.lineWidth = 2;
    this.atlas.upload();

    const prev = this.cards[ORDER[s % ORDER.length]!]!;
    const next = this.cards[ORDER[(s + 1) % ORDER.length]!]!;
    const W = this.wide(T, s);
    const out1 = s === 0 ? 1 : ease.outCubic(smoothstep(0, 0.42, u));
    const in1 = Math.pow(smoothstep(0.5, 1, u), 2.6);
    let k = mixKey(this.dive(prev), W, out1);
    k = mixKey(k, this.dive(next), in1);
    applyCam(this.cam, k, f.a.kick * 0.4);

    // Full-frame cell takes over as the lens meets a screen (in and out), so the dive lands crisp.
    const g = this.layer.ctx;
    this.layer.clear();
    const fullIn = smoothstep(0.9, 0.995, u);
    const fullOut = s === 0 ? 0 : 1 - smoothstep(0.0, 0.08, u);
    const full = Math.max(fullIn, fullOut);
    if (full > 0) {
      g.globalAlpha = full;
      drawCell(g, fullIn >= fullOut ? next.idx : prev.idx, 0, 0, 1920, 1080, T, f.a);
      g.globalAlpha = 1;
    }
    const cap = CELL_NAMES[next.idx % 8]!;
    typeLine(g, `scene ${String(next.idx + 1).padStart(2, '0')} / ${cap}.ts`, 192, 980, T, T0 + s * SEG + 0.5 * SEG, { size: 24, color: C.bone, cps: 60, t1: T0 + (s + 1) * SEG - 0.05 });
    const fam = F.archivo(125, 900);
    slam(g, 'MANY SCENES', 960, 470, T, { t0: T0, t1: T0 + BAR * 0.95, size: 150, family: fam, from: 1.6 });
    slam(g, 'ONE ENGINE', 960, 470, T, { t0: T0 + BAR, t1: T0 + SEG * 0.9, size: 150, family: fam, from: 1.6, color: C.signal });
    slam(g, 'ONE TIMELINE', 960, 470, T, { t0: bar(75), t1: bar(76) - 0.1, size: 150, family: fam, from: 1.6 });
    slam(g, 'ONE FUNCTION', 960, 470, T, { t0: bar(79), t1: bar(80) - 0.1, size: 150, family: fam, from: 1.6, color: C.signal });

    present(this.ctx, out, this.scene, this.cam, this.layer);
    const land = Math.exp(-((u + 1) % 1) * 18) * (s > 0 ? 1 : 0);
    return { exposure: 1.0, bloom: 0.6 + 0.3 * f.a.kick, bloomThreshold: 0.65, vignette: 0.5, ca: 0.4 + 1.5 * land + 0.8 * f.a.snare, grain: 0.05, zoom: 1 + 0.03 * land, flash: 0.25 * land };
  }
}

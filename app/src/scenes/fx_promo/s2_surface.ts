// s2_surface (bars 15-18, 28.95 - 36.73 s; scene time unchanged so the recap can still sample bars 11-14): the kick drops. The boot curve becomes the front row of a wireframe
// landscape; every beat sends a ripple out from the origin. Low flyover travelling +x.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { C, B0, BAR, bar, BEAT, sceneTime, present, train, typeLine, applyCam, lin, type Cue } from './kit';

const ROWS = 46, COLS = 70, SEG = 110;
const T0 = bar(11);
const SPEED = 2.4;

const WORDS: [string, string][] = [['CODE', 'IT'], ['PLOT', 'IT'], ['SYNC', 'IT'], ['SHIP', 'IT'], ['PLOT', 'IT'], ['SYNC', 'IT'], ['RENDER', 'IT'], ['SHIP', 'IT']];

export default class S2Surface extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 300);
  private layer = new Layer2D();
  private lines = new LineBatch(ROWS * SEG + COLS * ROWS + 16, { screen2D: false, worldWidth: true, blend: 'add', depthTest: false });
  private cues: Cue[] = [];
  private cues2: Cue[] = [];

  override async init() {
    WORDS.forEach(([a, b], i) => {
      this.cues.push({ text: a, t: bar(11 + i) });
      this.cues2.push({ text: b, t: bar(11 + i) + 2 * BEAT, color: C.signal });
    });
  }

  /** Height: the s1 sine, broadened across z, plus closed-form ripples from the last few beats. */
  private h(x: number, z: number, T: number, kick: number) {
    const base = 0.62 * Math.sin(1.35 * x - 0.9 * T) * Math.exp(-Math.max(0, -z) * 0.02) + 0.35 * Math.sin(0.5 * z + 0.7 * x + T * 0.4);
    if (T < T0) return base;
    const nb = Math.floor((T - T0) / BEAT);
    let r = 0;
    const ox = T0 * SPEED + (T - T0) * SPEED + 7, oz = -3;
    const d = Math.hypot(x - ox, z - oz);
    for (let i = 0; i < 3; i++) {
      const tb = T0 + (nb - i) * BEAT;
      if (tb < T0) break;
      const age = T - tb;
      const front = age * 9;
      r += 1.1 * Math.exp(-age * 1.8) * Math.exp(-Math.pow((d - front) / 1.6, 2)) * Math.cos((d - front) * 1.8);
    }
    return base + r * (0.7 + 0.6 * kick);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const cx = T * SPEED;
    const lt = T - T0;
    const k = f.a.kick;
    const climb = prog(T, bar(17), bar(19), ease.inCubic);
    applyCam(this.cam, {
      pos: [cx, 2.0 + climb * 1.5 + 0.25 * Math.sin(lt * 0.5), 7.5 - climb * 2],
      tgt: [cx + 8, 0.2 - climb * 0.8, -4],
      fov: 52 + climb * 18,
      roll: 0.06 * Math.sin(lt * 0.35),
    }, k * 0.8);

    const L = this.lines;
    L.clear();
    const bone = lin(C.bone, 0.9), sig = lin(C.signal, 2.2), ice = lin(C.ice, 0.6);
    const xA = cx - 6, xB = cx + 40, zA = -40, zB = 6;
    const heat = (y: number) => clamp((y - 0.55) * 1.4);
    // Rows along +x (the s1 curve family), columns along z.
    for (let r = 0; r < ROWS; r++) {
      const z = zB - ((zB - zA) * r) / (ROWS - 1);
      const fog = Math.exp(-r * 0.05);
      let px = xA, py = this.h(px, z, T, k);
      for (let s = 1; s <= SEG; s++) {
        const x = xA + ((xB - xA) * s) / SEG;
        const y = this.h(x, z, T, k);
        const hh = heat(Math.max(y, py));
        const c0 = r === 0 ? 1.4 : 1;
        L.seg(px, py, z, x, y, z, 0.018 * c0, (bone[0] + (sig[0] - bone[0]) * hh) * c0, (bone[1] + (sig[1] - bone[1]) * hh) * c0, (bone[2] + (sig[2] - bone[2]) * hh) * c0, fog);
        px = x; py = y;
      }
    }
    const step = (xB - xA) / COLS;
    const xOff = xA - (((xA % step) + step) % step);
    for (let c = 0; c <= COLS; c++) {
      const x = xOff + c * step;
      let pz = zB, py = this.h(x, pz, T, k);
      for (let r = 1; r < ROWS; r++) {
        const z = zB - ((zB - zA) * r) / (ROWS - 1);
        const y = this.h(x, z, T, k);
        L.seg(x, py, pz, x, y, z, 0.01, ice[0], ice[1], ice[2], 0.5 * Math.exp(-r * 0.06));
        pz = z; py = y;
      }
    }

    const g = this.layer.ctx;
    this.layer.clear();
    const fam = F.archivo(125, 900);
    // Each bar re-stages the word train: new offset, tilt and scale so no two bars share a composition.
    const VAR: [number, number, number, number][] = [[0, 0, 1, 0], [-280, 40, 0.82, -0.06], [250, -10, 1.12, 0.05], [0, 110, 0.9, 0], [-210, -20, 1.2, 0.04], [230, 70, 0.86, -0.05]];
    const vb = VAR[((Math.floor((T - B0) / BAR) % 6) + 6) % 6]!;
    g.save(); g.translate(960 + vb[0], 420 + vb[1]); g.rotate(vb[3]); g.scale(vb[2], vb[2]); g.translate(-960, -420);
    train(g, this.cues, T, 960, 330, { size: 230, family: fam, from: 1.6, shake: 8, out: 0.08 }, bar(19) - 0.1);
    train(g, this.cues2, T, 960, 520, { size: 120, family: F.archivo(62, 900), from: 2.2, shake: 4, out: 0.08 }, bar(19) - 0.1);
    g.restore();
    typeLine(g, 'y = sin(1.35x - 0.9t) + Σ ripple(beat)', 192, 930, T, T0 + 0.4, { size: 28, color: C.ash, cps: 60 });

    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(this.ctx.renderer, out, this.cam));
    const beatK = Math.exp(-(((lt % BEAT) + BEAT) % BEAT) * 10);
    return {
      exposure: 1.0,
      bloom: 0.55 + 0.3 * k,
      bloomThreshold: 0.8,
      vignette: 0.5,
      ca: 0.5 + 1.5 * k,
      grain: 0.05,
      flash: lt >= 0 ? Math.max(0, 1 - lt / 0.25) * 0.5 : 0,
      zoom: 1 + 0.012 * beatK,
      shake: [0.15 * k, -0.6 * (0.15 * k)],
    };
  }
}

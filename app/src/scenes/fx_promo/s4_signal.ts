// s4_signal (bars 27-38, 52.28 - 75.61 s): the song's own analysis as a city. Each Blender column is one moment of
// audio.json: it stays dormant until the playhead reaches it, then springs up to that moment's band energy.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F, font } from '../../engine/type';
import { clamp, ease, prog, springStep } from '../../engine/util';
import { C, bar, sceneTime, model, studioEnv, present, slam, typeLine, applyCam, lin, Instanced } from './kit';

const SPEED = 2.2, AHEAD = 9, DX = 0.5, BACK = 12, FWD = 48;
const ROWS: { band: 'low' | 'bass' | 'mid' | 'high' | 'vocal'; col: string }[] = [
  { band: 'low', col: C.signal }, { band: 'bass', col: C.signal }, { band: 'mid', col: C.bone }, { band: 'high', col: C.ice }, { band: 'vocal', col: C.bone },
];
const NX = Math.ceil((BACK + FWD) / DX) + 2;
const N = NX * ROWS.length * 2;
const T0 = bar(27);
const rowZ = (r: number, side: number) => side * (2.3 + r * 1.2);

export default class S4Signal extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 300);
  private layer = new Layer2D();
  private gate = new LineBatch(256, { screen2D: false, worldWidth: true, blend: 'add', depthTest: true });
  private cols!: Instanced;
  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  override async init() {
    const inst = await model(this.ctx, 'column');
    this.cols = new Instanced(inst, N, (name, m) => (name.toLowerCase().includes('cap') ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : m));
    this.scene.add(this.cols.group);
    for (let i = 0; i < N; i++) this.cols.color(i, this.c.set(0xffffff));
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.35;
    this.scene.fog = new THREE.Fog(0x050506, 18, 60);
    const key = new THREE.DirectionalLight(0xfff0e0, 1.6);
    key.position.set(-4, 10, 6);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.08));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 80), new THREE.MeshStandardMaterial({ color: 0x060607, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = T - T0;
    const cx = T * SPEED;
    const xNow = cx + AHEAD;
    const au = this.ctx.audio;

    // Columns on a fixed world grid: column at x encodes song time tau = (x - AHEAD) / SPEED.
    let i = 0;
    const x0 = Math.floor((cx - BACK) / DX) * DX;
    for (let ix = 0; ix < NX; ix++) {
      const x = x0 + ix * DX;
      const tau = (x - AHEAD) / SPEED;
      const smp = au.sample(Math.max(0, tau));
      const age = T - tau;
      const rise = age < 0 ? 0 : springStep(age, 2.6, 0.5);
      for (let r = 0; r < ROWS.length; r++) {
        const row = ROWS[r]!;
        const val = clamp(smp[row.band] ?? 0);
        const h = 0.06 + (0.25 + 5.2 * Math.pow(val, 1.15)) * rise;
        const glow = age < 0 ? 0.08 : 0.35 + 2.4 * Math.exp(-age * 2.5);
        for (const side of [-1, 1]) {
          this.v.set(x, 0, rowZ(r, side));
          this.s.set(0.36, h, 0.36);
          this.cols.set(i, this.v, this.q, this.s);
          this.c.set(row.col).multiplyScalar(glow);
          this.cols.color(i, this.c, 'cap');
          i++;
        }
      }
    }
    this.cols.commit(i);

    const sway = Math.sin(lt * 0.16);
    const rise2 = prog(T, bar(35), bar(39), ease.inOutCubic);
    applyCam(this.cam, {
      pos: [cx - 1.5, 1.6 + 1.6 * (0.5 + 0.5 * Math.sin(lt * 0.21)) + rise2 * 4, 1.4 * sway],
      tgt: [xNow + 1, 1.4 - rise2 * 0.5, -1.8 * sway],
      fov: 48 + rise2 * 8,
      roll: -0.05 * sway,
    }, f.a.kick * 0.6);

    // The "now" gate: where the playhead meets the city.
    const G = this.gate;
    G.clear();
    const sg = lin(C.signal, 3.2), ic = lin(C.ice, 1.4);
    const zW = rowZ(ROWS.length - 1, 1) + 0.6;
    const hG = 6.5 + 0.8 * f.a.rms;
    const gw = 0.04 + 0.05 * f.a.kick;
    G.seg(xNow, 0.01, -zW, xNow, 0.01, zW, gw, sg[0], sg[1], sg[2], 1);
    G.seg(xNow, 0, -zW, xNow, hG, -zW, gw * 0.6, sg[0], sg[1], sg[2], 0.8);
    G.seg(xNow, 0, zW, xNow, hG, zW, gw * 0.6, sg[0], sg[1], sg[2], 0.8);
    G.seg(xNow, hG, -zW, xNow, hG, zW, 0.015, ic[0], ic[1], ic[2], 0.6);
    // Avenue lane markers stream past.
    for (let m = 0; m < 30; m++) {
      const xm = Math.floor(cx / 2) * 2 + m * 2 - 4;
      G.seg(xm, 0.01, 0, xm + 0.7, 0.01, 0, 0.03, 0.6, 0.6, 0.6, 0.35);
    }

    const g = this.layer.ctx;
    this.layer.clear();
    typeLine(g, 'it hears', 192, 250, T, T0 + 0.1, { size: 44, t1: bar(29) - 0.15 });
    const fam = F.archivo(100, 900);
    const cues: [string, number][] = [['EVERY KICK', 29], ['EVERY SNARE', 31], ['EVERY HAT', 33], ['EVERY BAR', 35], ['IN SYNC', 37]];
    cues.forEach(([w, b], j) => {
      const t1 = j + 1 < cues.length ? bar(cues[j + 1]![1]) - 0.1 : bar(39) - 0.1;
      slam(g, w, 192, 250, T, { t0: bar(b), t1, size: 130, family: fam, align: 'left', from: 1.4, shake: 6, color: j === cues.length - 1 ? C.signal : C.bone });
    });

    // Onset tags pinned to the gate, driven by real onsets in audio.json.
    const tags: { kind: string; label: string; r: number; col: string }[] = [
      { kind: 'kick', label: 'KICK', r: 0, col: C.signal }, { kind: 'snare', label: 'SNARE', r: 2, col: C.bone }, { kind: 'hat', label: 'HAT', r: 3, col: C.ice },
    ];
    g.font = font(F.mono(500), 24);
    g.textBaseline = 'middle';
    for (const tg of tags) {
      const ev = au.events(tg.kind, T - 0.45, T + 1e-4);
      const last = ev[ev.length - 1];
      if (!last) continue;
      const a = Math.exp(-(T - last[0]) * 5);
      this.v.set(xNow, 6.2 - tg.r * 1.1, rowZ(tg.r, -1)).project(this.cam);
      if (this.v.z > 1) continue;
      const sx = (this.v.x * 0.5 + 0.5) * 1920, sy = (0.5 - this.v.y * 0.5) * 1080;
      const txt = `${tg.label} ${last[1].toFixed(2)}`;
      g.globalAlpha = a;
      g.lineWidth = 7; g.strokeStyle = 'rgba(5,5,6,0.9)'; g.strokeText(txt, sx + 14, sy);
      g.fillStyle = tg.col; g.fillText(txt, sx + 14, sy);
      g.fillRect(sx - 4, sy - 4, 8, 8);
    }
    g.globalAlpha = 1;
    typeLine(g, 'columns = audio.json  ·  low  bass  mid  high  vocal', 192, 980, T, T0 + 0.6, { size: 20, color: C.ash, cps: 70, cursor: false });

    present(this.ctx, out, this.scene, this.cam, this.layer, () => G.render(this.ctx.renderer, out, this.cam));
    return { exposure: 1.05, bloom: 0.75 + 0.35 * f.a.kick, bloomThreshold: 0.55, vignette: 0.5, ca: 0.5 + f.a.snare, grain: 0.05, shake: [0.08 * f.a.kick, -0.6 * (0.08 * f.a.kick)] };
  }
}

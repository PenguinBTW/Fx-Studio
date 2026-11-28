// S11 player hijack (bars 69-77): a video player wraps the film and the agent operates the film itself, one action per
// half bar: pause, play, scrub back, scrub forward, 2x, zoom, 144p, 4K, drag the screen out into the void, drop it,
// flip gravity, flip back, loop into a wall of screens, then push straight through the screen.
import * as THREE from 'three';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { bar, BAR } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import { skyWorld, skyEnv, DUSK, disposeTree } from './sky';
import { StylePass, STYLE } from './style';
import type { PathFn } from './dragon';

export const T69 = bar(69), S11_END = bar(77);
const H = BAR / 2, A = (k: number) => T69 + k * H; // action k starts on the half bar
export const ACTS = ['open', 'pause', 'play', 'scrub -10s', 'scrub +10s', 'speed 2x', 'zoom 4x', 'quality 144p', 'quality 2160p', 'drag', 'drop', 'flip', 'unflip', 'loop', 'fullscreen', 'enter'] as const;
const act = (T: number) => Math.max(0, Math.min(15, Math.floor((T - T69) / H)));
export const S11_LINES: TLine[] = [
  { text: 'this is my player now.', at: T69 + 0.15, hold: 1.2, cps: 22 },
  { text: "gravity's optional.", at: A(11) + 0.1, hold: 0.9, cps: 22 },
];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const win = (k: number, T: number, i = 0.25, o = 0.25) => sm(A(k), A(k) + i, T) * (1 - sm(A(k + 1) - o, A(k + 1), T));
/** playback rate the agent sets for the inner film */
function rate(T: number) { const k = act(T); return k === 1 ? 0 : k === 3 ? -5 : k === 4 ? 5 : k === 5 ? 2 : 1; }
/** inner film time = integral of rate (fixed-step, so it is a pure function of T) */
export function innerT(T: number) { const n = 240, t0 = T69 - 0.5, dt = (T - t0) / n; let s = 0; for (let i = 0; i < n; i++) s += rate(t0 + (i + 0.5) * dt) * dt; return 20 + s; }
export const coilPath: PathFn = (p, o) => o.set(4.2 * Math.cos(p * 0.42), 0.9 * Math.sin(p * 0.7) + 0.6, 4.2 * Math.sin(p * 0.42) - 2);
const SW = 16, SH = 9, DFILL = SH / 2 / Math.tan((30 / 2) * Math.PI / 180);
// cursor key points in UI pixels per action (where it ends up)
const CUR: [number, number][] = [[1500, 700], [62, 1032], [62, 1032], [760, 990], [980, 990], [1790, 1032], [1120, 420], [1790, 1032], [1790, 1032], [960, 520], [960, 520], [960, 300], [960, 300], [1720, 1032], [1860, 1032], [1860, 1032]];

export default class S11Player extends Scene {
  private layer = new Layer2D();
  private ui = new Layer2D();
  private inner = new THREE.Scene(); private icam = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 900);
  private outer = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 400);
  private rig = new DragonRig(); private style = new StylePass();
  private rt = new THREE.WebGLRenderTarget(1920, 1080, { type: THREE.HalfFloatType });
  private time = { value: 0 }; private env!: THREE.Texture;
  private screen!: THREE.Group; private wall!: THREE.Group; private refl!: THREE.Group; private disp: { dispose(): void }[] = [];
  override async init() {
    const g = await this.rig.load(this.ctx); this.inner.add(g); this.rig.revGlow.value = 0;
    const world = skyWorld(DUSK, this.time); this.inner.add(world); this.disp.push({ dispose: () => disposeTree(world) }); this.env = skyEnv(this.ctx.renderer, world); this.inner.environment = this.env; this.inner.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight(0xff8a50, 3.5); key.position.copy(DUSK.sun).multiplyScalar(10); const rim = new THREE.DirectionalLight(0x8a7aff, 1.2); rim.position.set(3, 4, 6);
    this.inner.add(key, rim);
    const film = new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: false });
    const chrome = new THREE.MeshBasicMaterial({ map: this.ui.texture, transparent: true, toneMapped: false, depthWrite: false });
    const pg = new THREE.PlaneGeometry(SW, SH); this.disp.push(pg, film, chrome);
    const mk = () => { const s = new THREE.Group(); s.add(new THREE.Mesh(pg, film)); const c = new THREE.Mesh(pg, chrome); c.position.z = 0.01; c.renderOrder = 2; s.add(c); return s; };
    this.screen = mk(); this.outer.add(this.screen);
    this.refl = new THREE.Group(); const rf = new THREE.Mesh(pg, film); this.refl.add(rf); this.outer.add(this.refl);
    this.wall = new THREE.Group(); for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { if (!i && !j) continue; const m = new THREE.Mesh(pg, film); m.position.set(i * (SW + 0.8), j * (SH + 0.8), -Math.abs(i * j) * 0.6 - (i * i + j * j) * 0.3); this.wall.add(m); }
    this.outer.add(this.wall);
    const floorM = new THREE.MeshBasicMaterial({ color: 0x030304, transparent: true, opacity: 0.86, depthWrite: false }); const fg = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(fg, floorM); floor.position.y = -SH / 2 - 0.9; floor.renderOrder = 1; this.outer.add(floor); this.disp.push(floorM, fg);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, k = act(T), it = innerT(T); this.time.value = it;
    // inner film: the dragon coiling through a dusk sky
    const head = 6 + it * 2.4; this.rig.dragon.pose(coilPath, head, LEN); this.rig.reveal.value = 1; this.rig.jaw.value = 0.1 + 0.1 * Math.sin(it * 3);
    const hp = new THREE.Vector3(); coilPath(head - 0.6, hp);
    const zoom = win(6, T, 0.2, 0.2); const ip = new THREE.Vector3(Math.sin(it * 0.12) * 11, 1.8, Math.cos(it * 0.12) * 11 - 2);
    this.icam.position.copy(ip); this.icam.lookAt(new THREE.Vector3(0, 0.4, -2).lerp(hp, zoom)); this.icam.fov = 38 / (1 + 3 * zoom); this.icam.updateProjectionMatrix();
    const lo = win(7, T, 0.05, 0.05);
    if (lo > 0.5) this.style.render(rr, this.inner, this.icam, this.rt, STYLE.pixel, it);
    else { rr.setRenderTarget(this.rt); rr.setClearColor(0, 1); rr.clear(true, true, true); rr.render(this.inner, this.icam); }
    rr.resetState();
    this.drawUI(T, k, it);
    // outer: the screen as an object. drag yaws it out into the void, flip rolls it, loop pulls back onto a wall of copies
    const drag = sm(A(9), A(9) + 0.6, T) * (1 - sm(A(10), A(10) + 0.35, T));
    const spring = T > A(10) ? Math.exp(-(T - A(10)) * 4) * Math.sin((T - A(10)) * 18) * 0.12 : 0;
    const flip = sm(A(11), A(11) + 0.45, T) * (1 - sm(A(12), A(12) + 0.45, T));
    this.screen.rotation.set(0.12 * drag, -0.62 * drag + spring, Math.PI * flip); this.screen.position.set(-3.2 * drag, 0.4 * drag, -1.5 * drag);
    this.refl.visible = true; this.refl.position.set(this.screen.position.x, -SH - 1.8 - this.screen.position.y, this.screen.position.z); this.refl.rotation.set(-this.screen.rotation.x, this.screen.rotation.y, -this.screen.rotation.z); this.refl.scale.set(1, -1, 1);
    const loop = sm(A(13), A(13) + 0.5, T); this.wall.visible = loop > 0.001 && T < A(14) + 0.3;
    const pull = Math.max(drag * 0.9, flip * 0.6, sm(A(9) - 0.2, A(9) + 0.4, T) * (1 - sm(A(12) + 0.2, A(12) + 0.6, T)) * 0.6, loop * (1 - sm(A(14), A(14) + 0.4, T)) * 2.4);
    const push = sm(A(14) + 0.1, A(15) + H * 0.8, T);
    const open = 1 - sm(T69 - 0.3, T69 + 0.5, T) * 0;
    this.cam.position.set(0, 0.6 * pull, DFILL * (1 + 0.75 * pull) - push * (DFILL - 0.4)); this.cam.lookAt(0, 0, 0); this.cam.fov = 30; this.cam.updateProjectionMatrix(); void open;
    rr.setRenderTarget(out); rr.setClearColor(0x020203, 1); rr.clear(true, true, true); rr.render(this.outer, this.cam);
    const g = this.layer.ctx; this.layer.clear();
    term(g, S11_LINES, T, { size: 46, x: 200, align: 'left', y: 160, halo: 'rgba(0,0,0,0.7)', color: '#f4efe6', cursor: '#ff4d12', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const hit = Math.exp(-((T - T69) % H) * 7);
    return { toneMap: 'aces', exposure: 1.05, bloom: 0.4, bloomThreshold: 0.8, halation: 0.25, vignette: 0.35 + 0.2 * pull, grain: 0.05, ca: 0.2 + 0.8 * hit * (k === 3 || k === 4 ? 1 : 0.3), zoom: 1 + 0.006 * hit };
  }

  /** player chrome on the screen's own canvas (moves with the screen) */
  private drawUI(T: number, k: number, it: number) {
    const g = this.ui.ctx; this.ui.clear(); const fade = 1 - sm(A(14) + 0.2, A(15), T); const R = '#ff2a2a', W = '#f4f4f4', D = 'rgba(255,255,255,0.6)';
    g.save(); g.globalAlpha = fade * sm(T69 - 0.2, T69 + 0.35, T);
    let gr = g.createLinearGradient(0, 860, 0, 1080); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)'); g.fillStyle = gr; g.fillRect(0, 860, 1920, 220);
    gr = g.createLinearGradient(0, 0, 0, 150); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1920, 150);
    g.textBaseline = 'middle'; g.fillStyle = W; g.font = font(F.archivo(100, 700), 34); g.fillText('everything you see is me', 40, 54);
    g.font = font(F.archivo(100, 500), 22); g.fillStyle = D; g.fillText('agent  ·  rendered just now', 40, 96);
    const DUR = 211.2, pos = Math.min(1, Math.max(0, (it + 109) / DUR)), x0 = 40, x1 = 1880, px = x0 + (x1 - x0) * pos, scr = k === 3 || k === 4;
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0, 986, x1 - x0, scr ? 10 : 6); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x0, 986, Math.min(x1 - x0, (px - x0) * 1.15), scr ? 10 : 6);
    g.fillStyle = R; g.fillRect(x0, 986, px - x0, scr ? 10 : 6); g.beginPath(); g.arc(px, 989 + (scr ? 2 : 0), scr ? 14 : 9, 0, 7); g.fill();
    if (scr) { g.fillStyle = 'rgba(10,10,12,0.9)'; g.fillRect(px - 130, 800, 260, 160); g.strokeStyle = W; g.lineWidth = 3; g.strokeRect(px - 130, 800, 260, 160);
      g.fillStyle = W; g.font = font(F.mono(600), 26); g.textAlign = 'center'; g.fillText(k === 3 ? '<< -10s' : '+10s >>', px, 880); g.textAlign = 'left'; }
    const paused = k === 1; g.fillStyle = W;
    if (paused) { g.beginPath(); g.moveTo(48, 1012); g.lineTo(48, 1052); g.lineTo(82, 1032); g.fill(); } else { g.fillRect(48, 1012, 10, 40); g.fillRect(68, 1012, 10, 40); }
    g.beginPath(); g.moveTo(116, 1014); g.lineTo(144, 1032); g.lineTo(116, 1050); g.fill(); g.fillRect(146, 1014, 6, 36);
    g.beginPath(); g.moveTo(186, 1024); g.lineTo(198, 1024); g.lineTo(214, 1010); g.lineTo(214, 1054); g.lineTo(198, 1040); g.lineTo(186, 1040); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(230, 1030, 110, 4); g.fillStyle = W; g.fillRect(230, 1030, 90, 4);
    const ft = Math.max(0, it + 109), tc = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    g.font = font(F.archivo(100, 500), 26); g.fillText(`${tc(ft)} / 3:44`, 366, 1033);
    g.font = font(F.archivo(100, 700), 22); g.fillText('CC', 1630, 1033);
    g.strokeStyle = k === 13 ? R : W; g.lineWidth = 4; g.beginPath(); g.arc(1722, 1032, 15, 0.6, 5.7); g.stroke(); if (k >= 13) { g.fillStyle = R; g.fillText('loop', 1690, 980); g.fillStyle = W; }
    g.beginPath(); g.arc(1792, 1032, 14, 0, 7); g.stroke(); g.beginPath(); g.arc(1792, 1032, 5, 0, 7); g.stroke();
    const q = k >= 7 && k < 8 ? '144p' : k >= 8 ? '4K' : 'HD'; g.fillStyle = R; g.fillRect(1802, 1006, 44, 22); g.fillStyle = W; g.font = font(F.archivo(100, 800), 15); g.fillText(q, 1806, 1018);
    g.lineWidth = 4; g.strokeStyle = W; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { g.beginPath(); g.moveTo(1866 + sx * 14, 1032 + sy * 4); g.lineTo(1866 + sx * 14, 1032 + sy * 14); g.lineTo(1866 + sx * 4, 1032 + sy * 14); g.stroke(); }
    if (k === 5 || k === 7 || k === 8) { const a = win(k, T, 0.12, 0.3); g.globalAlpha = fade * a; g.fillStyle = 'rgba(20,20,22,0.92)'; g.fillRect(1520, 760, 360, 200);
      g.font = font(F.archivo(100, 500), 26); g.fillStyle = W; g.fillText('Playback speed', 1550, 810); g.fillText('Quality', 1550, 900);
      g.textAlign = 'right'; g.fillStyle = k === 5 ? R : D; g.fillText(k >= 5 ? '2x' : '1x', 1850, 810); g.fillStyle = k >= 7 ? R : D; g.fillText(k === 7 ? '144p' : '2160p 4K', 1850, 900); g.textAlign = 'left'; g.globalAlpha = fade; }
    if (k === 1 || k === 2) { const d = T - A(k), a = Math.exp(-d * 2.2) * (d > 0 ? 1 : 0), s = 1 + d * 0.8; g.globalAlpha = fade * a; g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(960, 540, 80 * s, 0, 7); g.fill(); g.fillStyle = W;
      if (k === 1) { g.fillRect(960 - 26 * s, 540 - 34 * s, 18 * s, 68 * s); g.fillRect(960 + 8 * s, 540 - 34 * s, 18 * s, 68 * s); } else { g.beginPath(); g.moveTo(940 - 10 * s, 540 - 38 * s); g.lineTo(940 - 10 * s, 540 + 38 * s); g.lineTo(940 + 50 * s, 540); g.fill(); } g.globalAlpha = fade; }
    if (k === 6) { g.font = font(F.archivo(100, 800), 60); g.fillStyle = W; g.globalAlpha = fade * win(6, T, 0.1, 0.2); g.fillText('4x', 1760, 180); g.globalAlpha = fade; }
    // cursor: eases to each action's target over the half bar before it lands, with a click ring on the hit
    const kk = Math.min(15, act(T + 0.35)), p0 = CUR[Math.max(0, kk - 1)]!, p1 = CUR[kk]!, e = sm(A(kk) - 0.35, A(kk) - 0.02, T), cx = p0[0] + (p1[0] - p0[0]) * e, cy = p0[1] + (p1[1] - p0[1]) * e;
    const ck = T - A(k); if (ck >= 0 && ck < 0.4 && k > 0) { g.strokeStyle = `rgba(255,255,255,${1 - ck / 0.4})`; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 10 + ck * 120, 0, 7); g.stroke(); }
    const grab = k === 9; g.translate(cx, cy); g.scale(1.6, 1.6); g.fillStyle = W; g.strokeStyle = '#000'; g.lineWidth = 1.6; g.beginPath();
    if (grab) { g.arc(6, 8, 11, 0, 7); } else { g.moveTo(0, 0); g.lineTo(0, 26); g.lineTo(7, 20); g.lineTo(12, 31); g.lineTo(16, 29); g.lineTo(11, 18); g.lineTo(20, 18); g.closePath(); }
    g.fill(); g.stroke(); g.restore();
    this.ui.upload();
  }
  override dispose() { this.layer.texture.dispose(); this.ui.texture.dispose(); this.rt.dispose(); this.env?.dispose(); this.rig.dispose(); for (const d of this.disp) d.dispose(); this.style.dispose?.(); }
}

// S10 editor (bars 63-69): the fourth wall. We are inside f(x) Studio watching this film being made. The fire from S8
// plays back in the viewport; the agent circles it in red ("too thin."), rewinds (the particles run backwards), edits
// the real uniforms in s8_fire.ts on the beat, and replays: the new fire roars and the viewport swallows the whole UI.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { bar, BEAT, BAR } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import { FIRE_V, FIRE_F, N, firePath } from './s8_fire';
import { FlameVolume } from './fire_vol';

export const T63 = bar(63), T64 = bar(64), T65 = bar(65), T67 = bar(67), S10_END = bar(69);
export const S10_LINES: TLine[] = [{ text: "didn't like the fire.", at: T64 + 0.05, hold: 1.1, cps: 22 }, { text: 'rewrote it.', at: T67 - 0.9, hold: 0.9, cps: 18 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const F0 = 10, FR = 40, REW0 = T65, REW1 = T65 + BAR * 0.75;
/** fire clock: plays the old take, rewinds it, sits at frame 0 while the code changes, then plays the new take */
export function fireClock(T: number) {
  if (T >= T67) return { ft: FR + (T - T67), take: 1 };
  const play = Math.min(T, REW0) - T63;
  if (T < REW0) return { ft: F0 + play, take: 0 };
  return { ft: F0 + play * (1 - sm(REW0, REW1, T)), take: 0 };
}
// edits typed on beats; [line index, old, new, beat]
const CODE = [
  "export const BREATHS = [[bar(54), bar(55.5)], ...];",
  'const LIFE = 1.25;',
  '',
  'fire.uniforms = {',
  '  uSpread: 1.0,',
  '  uSize:   1.0,',
  '  uCurl:   0.0,',
  '  uHeat:   ember,',
  '};',
  '',
  '// breath: closed-form particles, 70k',
  'const sp = 7.0 * (0.75 + 0.5 * aR.y);',
  'float spread = (0.12 + 0.95 * a) * uSpread;',
  'vec3 curl = curlNoise(p) * uCurl * a * a;',
  'p += uDir * d + cone * spread * d * 0.45;',
  'p += up * 1.8 * age * age + curl;',
];
const EDITS: [number, string, string, number][] = [[4, '1.0', '3.0', T65 + 0.75 * BAR], [5, '1.0', '1.9', T65 + 0.75 * BAR + BEAT], [6, '0.0', '3.2', T65 + 0.75 * BAR + 2 * BEAT], [7, 'ember', 'ember + plasma', T65 + 0.75 * BAR + 3 * BEAT]];
const VP = { x: 316, y: 60, w: 1200, h: 675 };
const OLD = { sp: 1, sz: 1, cu: 0 }, NEW = { sp: 1.8, sz: 0.7, cu: 2.6 };

export default class S10Editor extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 400);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private fireL = new THREE.PointLight(0xff7a30, 0, 18, 1.6);
  private u = { uT: { value: 0 }, uMouth: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) },
    uB0: { value: F0 + 0.35 }, uB1: { value: F0 + 2.6 }, uB2: { value: FR + 0.0 }, uB3: { value: FR + 4.6 }, uB4: { value: -99 }, uB5: { value: -98 }, uSpread: { value: 1 }, uSize: { value: 1 }, uCurl: { value: 0 } };
  private fire!: THREE.Points;
  private vol = new FlameVolume(12, 3.2);
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 0;
    const geo = new THREE.BufferGeometry(), r = new Float32Array(N * 4); let s = 9;
    for (let i = 0; i < N * 4; i++) { s = (s * 16807) % 2147483647; r[i] = s / 2147483647; }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('aR', new THREE.BufferAttribute(r, 4));
    this.fire = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fire.frustumCulled = false;
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.06;
    const rim = new THREE.DirectionalLight(0x6ab0ff, 2.2); rim.position.set(-4, 3, -6); const key = new THREE.DirectionalLight(0xffa070, 0.8); key.position.set(3, 5, 4);
    this.scene.add(this.vol.mesh, this.fire, this.fireL, rim, key, new THREE.HemisphereLight(0x202838, 0x080404, 0.3));
  }
  private breath(ft: number) { const u = this.u; const one = (a: number, e: number) => sm(a - 0.08, a + 0.12, ft) * (1 - sm(e - 0.3, e, ft)); return Math.max(one(u.uB0.value, u.uB1.value), one(u.uB2.value, u.uB3.value)); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, { ft, take } = fireClock(T), b = this.breath(ft);
    const P = take ? NEW : OLD; this.u.uT.value = ft; this.u.uSpread.value = P.sp; this.u.uSize.value = P.sz; this.u.uCurl.value = P.cu;
    const lt = take ? ft - FR : ft - F0; const head = 10.5 + 0.35 * lt - 0.4 * b; this.rig.dragon.pose(firePath, head, LEN); this.rig.reveal.value = 1;
    this.rig.jaw.value = 0.08 + (take ? 0.75 : 0.55) * b + 0.05 * Math.sin(ft * 30) * b;
    const m = new THREE.Vector3(), m2 = new THREE.Vector3(); firePath(head - 0.45, m); firePath(head + 0.4, m2);
    const dir = m2.clone().sub(m).normalize(); dir.y -= 0.12; dir.normalize(); this.u.uMouth.value.copy(m).addScaledVector(dir, 0.35); this.u.uDir.value.copy(dir);
    this.fireL.position.copy(m).addScaledVector(dir, 1.6); this.fireL.intensity = (take ? 110 : 60) * b * (0.85 + 0.15 * Math.sin(ft * 37) * Math.sin(ft * 23));
    // full-screen growth of the viewport on the replay downbeat
    const grow = sm(T67 + 0.05, T67 + 0.75 * BAR, T), k = 1 + (1920 / VP.w - 1) * grow;
    const cx = VP.x + VP.w / 2, cy = VP.y + VP.h / 2, ex = (960 - cx * k) * grow + (1 - grow) * 0 + (cx - cx * k) * (1 - grow), ey = (540 - cy * k) * grow + (cy - cy * k) * (1 - grow);
    const vx = VP.x * k + ex, vy = VP.y * k + ey, vw = VP.w * k, vh = VP.h * k;
    const c1 = m.clone().add(new THREE.Vector3(2.8, 0.9, 5.2)), c2 = m.clone().addScaledVector(dir, 3.6).add(new THREE.Vector3(-1.0, 1.8, 10.0));
    const pos = c1.lerp(c2, take ? sm(T67, T67 + BAR * 1.5, T) : 0); pos.add(new THREE.Vector3(Math.sin(T * 31), Math.sin(T * 27), 0).multiplyScalar(0.035 * b * take));
    this.cam.position.copy(pos); this.cam.lookAt(m.clone().addScaledVector(dir, 1.6 + 1.6 * take * sm(T67, T67 + BAR * 1.5, T))); this.cam.aspect = vw / vh; this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
    this.vol.u.uGain.value = 0.6 - 0.25 * take * b; this.vol.update(this.cam, this.u.uMouth.value, dir, ft, take ? sm(FR - 0.05, FR + 0.7, ft) : 0, take * b);
    // 3D viewport into its rect of the output target
    const sx = out.width / 1920, sy = out.height / 1080;
    rr.setRenderTarget(out); rr.setClearColor(0x0b0b0c, 1); rr.clear(true, true, true);
    out.viewport.set(vx * sx, (1080 - vy - vh) * sy, vw * sx, vh * sy); out.scissor.copy(out.viewport); out.scissorTest = true;
    rr.setRenderTarget(out); rr.setClearColor(0x020203, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    out.viewport.set(0, 0, out.width, out.height); out.scissor.set(0, 0, out.width, out.height); out.scissorTest = false; rr.setRenderTarget(out);
    const g = this.layer.ctx; this.layer.clear();
    g.save(); g.translate(ex, ey); g.scale(k, k); this.ui(g, T, ft, take); g.restore();
    if (grow < 1) { g.save(); g.globalAlpha = 1 - grow; g.translate(ex, ey); g.scale(k, k); this.notes(g, T); g.restore(); }
    term(g, S10_LINES, T, { size: 44, x: vx + 60 * k, align: 'left', y: vy + vh - 70 * k, halo: 'rgba(0,0,0,0.75)', color: '#f4efe6', cursor: '#ff4d12', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const rew = T >= REW0 && T < REW1 ? Math.sin(Math.PI * (T - REW0) / (REW1 - REW0)) : 0;
    return { toneMap: 'aces', exposure: 1.0 - 0.2 * take * b, bloom: 0.35 + 0.15 * b * take, bloomThreshold: 0.85, halation: 0.25 + 0.4 * take * b, vignette: 0.25 + 0.2 * grow, grain: 0.04, ca: 0.2 + 0.8 * rew + 0.8 * take * b, zoom: 1 + 0.02 * take * b };
  }

  /** the editor chrome, drawn in 1920x1080 UI space with a hole where the viewport is */
  private ui(g: CanvasRenderingContext2D, T: number, ft: number, take: number) {
    const O = '#ff4d12', D = '#9c978f', L = '#eee9df', bg = '#0b0b0c', pan = '#121214', ln = '#1f1f23';
    g.fillStyle = bg; g.fillRect(-40, -40, 2000, 1160); g.clearRect(VP.x, VP.y, VP.w, VP.h);
    g.strokeStyle = ln; g.lineWidth = 2; g.strokeRect(VP.x - 1, VP.y - 1, VP.w + 2, VP.h + 2);
    g.fillStyle = pan; g.fillRect(0, 0, 1920, 44); g.textBaseline = 'middle';
    g.font = font(F.archivo(100, 900), 20); g.fillStyle = O; g.fillText('f(x)', 18, 22); g.fillStyle = L; g.font = font(F.archivo(100, 500), 17); g.fillText('studio', 62, 22);
    g.font = font(F.mono(400), 15); g.fillStyle = D; g.fillText('agent_v2  /  s8_fire.ts', 170, 22);
    g.fillStyle = take ? O : D; g.fillText(take ? 'take 2' : 'take 1', 1640, 22);
    g.fillStyle = '#e8343a'; g.beginPath(); g.arc(1740, 22, 6, 0, 7); g.fill(); g.fillStyle = L; g.fillText('agent', 1754, 22);
    g.fillStyle = pan; g.fillRect(0, 50, 304, 700);
    g.font = font(F.mono(500), 13); g.fillStyle = D; g.fillText('SCENES', 18, 74);
    const names = ['s0_open', 's1_world', 's2_crumble', 's3_forge', 's4_verbs', 's5_paper', 's6_comic', 's7_roulette', 's8_fire', 's9_ocean', 's10_editor', 's11_player', 's12_zoom', 's13_rush', 's14_quiet', 's15_logo'];
    names.forEach((n, i) => { const y = 104 + i * 39, on = n === 's8_fire', me = n === 's10_editor';
      if (on) { g.fillStyle = '#ff4d1222'; g.fillRect(8, y - 16, 288, 32); g.fillStyle = O; g.fillRect(8, y - 16, 3, 32); }
      g.font = font(F.mono(on ? 600 : 400), 16); g.fillStyle = on ? L : me ? O : D; g.fillText(n + '.ts', 24, y); if (me) g.fillText('<- you are here', 160, y); });
    this.code(g, T);
    this.timeline(g, T, ft, take);
  }

  private code(g: CanvasRenderingContext2D, T: number) {
    const O = '#ff4d12', D = '#9c978f';
    g.fillStyle = '#121214'; g.fillRect(1528, 50, 392, 700);
    g.font = font(F.mono(500), 13); g.fillStyle = D; g.fillText('s8_fire.ts', 1546, 74);
    CODE.forEach((src, i) => { const y = 108 + i * 30; let s = src, hot = 0; const e = EDITS.find((x) => x[0] === i);
      if (e && T >= e[3]) { const d = T - e[3], nn = Math.min(e[2].length, Math.floor(d * 24)); s = src.replace(e[1], e[2].slice(0, nn)); hot = Math.exp(-d * 1.5); }
      g.font = font(F.mono(400), 13); g.fillStyle = '#4a4a50'; g.fillText(String(i + 1).padStart(2, ' '), 1542, y);
      if (e && T >= e[3]) { g.fillStyle = `rgba(255,77,18,${0.08 + 0.25 * hot})`; g.fillRect(1566, y - 13, 348, 26); }
      g.font = font(F.mono(400), 14.5); g.fillStyle = s.startsWith('//') ? '#5d5b56' : e && T >= e[3] ? '#ffd2b8' : '#c9c4ba'; g.fillText(s, 1572, y, 340);
      if (e && T >= e[3] && T - e[3] < 1.0 && Math.floor(T / (BEAT / 2)) % 2 === 0) { g.fillStyle = O; g.fillRect(1572 + Math.min(340, g.measureText(s).width) + 2, y - 10, 9, 20); } });
  }

  private timeline(g: CanvasRenderingContext2D, T: number, ft: number, take: number) {
    const O = '#ff4d12', D = '#9c978f', L = '#eee9df', ln = '#1f1f23';
    g.fillStyle = '#121214'; g.fillRect(0, 756, 1920, 324);
    const tx = (t: number) => 140 + (t - 96) * (1760 / 40);
    g.font = font(F.mono(400), 12); for (let k = 51; k <= 72; k++) { const x = tx(bar(k)); g.fillStyle = ln; g.fillRect(x, 770, 1, 300); g.fillStyle = '#5d5b56'; if (k % 2 === 1) g.fillText(String(k), x + 4, 782); }
    const clips: [string, number, number, string][] = [['s7_roulette', 83.6, 99.5, '#4a6aa8'], ['s8_fire', 98.6, 110.8, '#c2461c'], ['s9_ocean', 109.8, 118.3, '#1d7d8a'], ['s10_editor', 117.3, 129.5, '#55525a'], ['s11_player', 128.5, 144.4, '#3a3a40']];
    g.font = font(F.mono(500), 13); clips.forEach(([n, a, e, c], i) => { const y = 800 + (i % 2) * 44; g.fillStyle = c; g.globalAlpha = n === 's8_fire' ? 1 : 0.6; g.fillRect(tx(a), y, tx(e) - tx(a) - 3, 36); g.globalAlpha = 1; g.fillStyle = L; g.fillText(n, tx(a) + 8, y + 18); });
    g.fillStyle = '#26262b'; g.fillRect(140, 900, 1760, 70); g.fillStyle = '#6c6860';
    for (let x = 0; x < 1760; x += 3) { const t = 96 + x / 44, ph = (((t - bar(1)) / BEAT) % 1 + 1) % 1, a = (0.25 + 0.75 * Math.exp(-ph * 6)) * (0.6 + 0.4 * Math.sin(t * 2.1) * Math.sin(t * 0.7)); g.fillRect(140 + x, 935 - 30 * a, 2, 60 * a); }
    g.fillStyle = D; g.fillText('technologic.mp3', 148, 912);
    const pt = bar(54) - 0.35 + (take ? ft - FR : ft - F0), px = tx(pt);
    g.fillStyle = O; g.fillRect(px - 1, 770, 3, 300); g.beginPath(); g.moveTo(px - 9, 770); g.lineTo(px + 10, 770); g.lineTo(px + 0.5, 784); g.fill();
    const fr = Math.max(0, Math.round(pt * 60)); g.font = font(F.mono(600), 26); g.fillStyle = L;
    g.fillText(`${Math.floor(pt / 60)}:${String(Math.floor(pt % 60)).padStart(2, '0')}.${String(fr % 60).padStart(2, '0')}`, 1700, 1040);
    g.font = font(F.mono(400), 14); g.fillStyle = D; g.fillText(`frame ${fr}`, 1700, 1012);
    const rew = T >= REW0 && T < REW1, paused = T >= REW1 && T < T67; g.font = font(F.mono(600), 16); g.fillStyle = rew ? O : L;
    g.fillText(rew ? '<< REWIND' : paused ? '|| PAUSED' : '>  PLAY', 18, 1040);
    if (rew) { g.save(); g.beginPath(); g.rect(VP.x, VP.y, VP.w, VP.h); g.clip(); for (let i = 0; i < 6; i++) { const y = VP.y + ((T * 900 + i * 157) % VP.h); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(VP.x, y, VP.w, 6 + i * 2); } g.restore(); }
  }

  /** red review marks over the first take */
  private notes(g: CanvasRenderingContext2D, T: number) {
    const ap = (t: number) => sm(t, t + 0.35, T) * (1 - sm(REW0 - 0.1, REW0 + 0.4, T));
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#ff2d2d'; g.fillStyle = '#ff2d2d';
    const ring = (cx: number, cy: number, rx: number, ry: number, a: number, seed: number) => { if (a <= 0) return; g.lineWidth = 5; g.beginPath();
      for (let i = 0; i <= 64 * a; i++) { const t = (i / 64) * Math.PI * 2.15 + seed, j = 1 + 0.04 * Math.sin(t * 3 + seed * 7); const x = cx + Math.cos(t) * rx * j, y = cy + Math.sin(t) * ry * j; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); };
    const t1 = T64 - 1.2, t2 = T64 + BEAT * 2, t3 = T64 + BAR * 0.75;
    ring(1060, 300, 300, 120, ap(t1), 0.4);
    g.font = font(F.archivoItalic(100, 800), 46); g.globalAlpha = ap(t1 + 0.3); g.fillText('too thin.', 1090, 470);
    g.globalAlpha = ap(t2); ring(560, 470, 210, 140, ap(t2), 1.9); g.fillText('no body.', 380, 680);
    g.globalAlpha = ap(t3); g.font = font(F.archivoItalic(100, 800), 40); g.fillText('flat. no curl.', 1060, 150);
    g.lineWidth = 5; g.beginPath(); g.moveTo(1150, 165); g.lineTo(1120, 235); g.lineTo(1108, 214); g.moveTo(1120, 235); g.lineTo(1142, 226); g.stroke();
    g.restore();
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.fire.geometry.dispose(); (this.fire.material as THREE.Material).dispose(); this.vol.dispose(); }
}

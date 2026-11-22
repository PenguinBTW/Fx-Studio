// S4 the real world (bars 20-31): the song's command list acted out literally on a sunlit oak desk, one physical action
// per vocal beat, one camera set-up per lyric line, whip-cut on the bar. The agent logs each command as it lands.
import * as THREE from 'three';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { BEAT, bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { Sheet, oakTexture, marker, scissors, stamp, floppy, drive, deck, padlock, match, magnifier, bell } from './props';

type Prop = 'W' | 'S' | 'P' | 'T' | 'F' | 'D' | 'L' | 'M' | 'B' | 'G' | 'X';
// [verb, prop, logged command]
const VERBS: [string, Prop, string][] = [
  ['write', 'W', 'write line_01'], ['cut', 'S', 'cut strip[0:40]'], ['paste', 'P', 'paste strip -> sheet_b'], ['save', 'T', 'save sheet_b'],
  ['load', 'F', 'load disk_a'], ['check', 'T', 'check line_01'], ['quick', 'D', 'ffwd x8'], ['rewrite', 'W', 'rewrite line_01'],
  ['plug', 'D', 'plug deck.in'], ['play', 'D', 'play'], ['burn', 'M', 'burn match_01'], ['rip', 'S', 'rip sheet_b.corner'],
  ['drag', 'P', 'drag sheet_b'], ['drop', 'P', 'drop sheet_b'], ['zip', 'F', 'eject disk_a'], ['unzip', 'F', 'insert disk_a'],
  ['lock', 'L', 'lock'], ['fill', 'W', 'fill box_02'], ['call', 'B', 'call desk.bell'], ['find', 'G', 'find "me"'],
  ['view', 'G', 'view line_02'], ['code', 'W', 'code world()'], ['jam', 'D', 'jam'], ['unlock', 'L', 'unlock'],
  ['surf', 'D', 'tune 88.1'], ['scroll', 'D', 'scroll tape +40'], ['pause', 'D', 'pause'], ['click', 'D', 'click'],
  ['cross', 'S', 'cross line_01'], ['crack', 'S', 'crack seal'], ['switch', 'D', 'switch side_b'], ['update', 'T', 'update v2'],
  ['name', 'W', 'name dragon'], ['rate', 'T', 'rate 5/5'], ['tune', 'D', 'tune 101.4'], ['print', 'W', 'print'],
  ['scan', 'G', 'scan sheet_a'], ['send', 'P', 'send sheet_b'], ['fax', 'P', 'fax sheet_b'], ['rename', 'W', 'rename dragon -> me'],
  ['touch', 'B', 'touch'], ['bring', 'P', 'bring sheet_b'], ['pay', 'T', 'pay'], ['watch', 'G', 'watch'],
  ['turn', 'D', 'turn vol 11'], ['leave', 'P', 'leave sheet_b'], ['start', 'D', 'start'], ['format', 'X', 'format desk'],
];
export const T20 = bar(20), S4_END = bar(32);
const W = (k: number) => T20 + k * BEAT;
const hitsOf = (p: Prop, v?: string) => VERBS.map((x, k) => [x, k] as const).filter(([x]) => x[1] === p && (!v || x[0] === v)).map(([, k]) => W(k));
const kOf = (v: string) => W(VERBS.findIndex((x) => x[0] === v));
/** count of hits so far and seconds since the last one */
const since = (hs: number[], T: number) => { let n = 0, last = -1e9; for (const h of hs) if (T >= h) { n++; last = h; } return { n, d: T - last }; };
export const S4_LINES: TLine[] = VERBS.map(([, , cmd], k) => ({ text: cmd, at: W(k) - 0.02, hold: Math.max(0.02, BEAT - cmd.length / 90 - 0.27), cps: 90 }));
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const slam = (d: number) => (d < 0 ? 0 : Math.exp(-d * 9)); // impulse envelope after a hit

// one camera set-up per lyric line: target, distance, azimuth, height ratio
const SHOTS: [number, number, number, number, number, number][] = [
  [1.2, 0, 0.8, 5.2, -0.35, 0.55], [-1.9, 0.2, 1.4, 4.2, 0.5, 0.42], [3.0, 0.3, -0.6, 4.6, -0.5, 0.38], [0.6, 0, 1.0, 6.0, 0.25, 0.6],
  [-0.2, 0.1, 1.8, 5.4, -0.2, 0.4], [-0.6, 0, 0.6, 3.4, 0.45, 0.62], [3.4, 0.5, -2.0, 3.2, -0.3, 0.36], [2.0, 0, 1.0, 4.0, 0.4, 0.45],
  [1.3, 0, 0.2, 4.6, -0.15, 0.7], [0.0, 0, 0.6, 3.8, 0.55, 0.5], [3.4, 0.1, 0.6, 4.2, -0.45, 0.4], [0.0, 0, 0.0, 6.5, 0.0, 1.4],
];

const LINES_A = ["it's all me.", "it's ALL me.", '[ filled ]', 'world() { return me }', 'name: dragon', 'print >>>', 'rename: dragon -> me'];
const BMOVE: Record<string, [number, number, number]> = { drag: [-1.3, 0, 0.3], drop: [0, 0, 0], send: [1.4, 0, -0.4], fax: [-1.4, 0, 0.4], bring: [0.2, 0, 0.8], leave: [7, 0, 0] };
const STAMPS: [string, string][] = [['save', 'SAVED'], ['check', ''], ['update', 'v2'], ['rate', '5 / 5'], ['pay', 'PAID']];
const MAG: Record<string, [number, number]> = { find: [0.3, -0.6], view: [-0.3, -0.1], scan: [0.6, 0.3], watch: [0.4, 0.5] };
const ease = (x: number) => sm(0, 1, x);

export default class S4Verbs extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 200);
  private A = new Sheet(); private B = new Sheet(2.1, 2.97, 0xefe2c8); private strip = new Sheet(2.1, 0.5);
  private mk = marker(); private sc = scissors(); private st = stamp(); private fl = floppy(); private dr = drive(); private dk = deck();
  private lk = padlock(); private mt = match(); private mg = magnifier(); private bl = bell(); private plug = new THREE.Group();
  private props: THREE.Object3D[] = []; private propX: number[] = [];
  private oak!: THREE.Texture;
  override async init() {
    this.ctx.renderer.shadowMap.enabled = true; this.ctx.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.oak = oakTexture(); this.oak.repeat.set(2.5, 1.5);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: this.oak, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }));
    desk.receiveShadow = true; desk.position.z = -2;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: 0xc9b9a0, roughness: 0.9 })); wall.position.set(0, 6, -12); wall.receiveShadow = true;
    const sun = new THREE.DirectionalLight(0xffd2a0, 6.0); sun.position.set(-7, 9, -5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 30; sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
    const blinds = new THREE.Group(); for (let i = 0; i < 18; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(14, 0.03, 0.22), new THREE.MeshBasicMaterial({ color: 0x000000 })); s.castShadow = true; s.position.set(0, i * 0.42 - 3.6, 0); blinds.add(s); }
    blinds.position.set(-3.5, 4.5, -2.5); blinds.lookAt(0, 0, 0); blinds.rotateX(Math.PI / 2);
    this.scene.add(desk, wall, sun, sun.target, blinds, new THREE.HemisphereLight(0xbcd2ff, 0x6a4424, 0.55));
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a0808, roughness: 0.6 })); pad.position.set(-1.8, 0.04, -0.9); pad.castShadow = pad.receiveShadow = true;
    const pb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.14), new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.4 })); const prong = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0xd0b060, metalness: 1, roughness: 0.2 }));
    prong.position.x = -0.2; const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 6, 12).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.5 })); cable.position.x = 3.1;
    this.plug.add(pb, prong, cable); this.plug.traverse((o) => { o.castShadow = true; });
    this.A.mesh.position.set(0, 0.003, 0); this.A.mesh.rotation.y = 0.04; this.B.mesh.rotation.y = -0.12;
    this.dr.g.position.set(-3.3, 0, 1.4); this.dk.g.position.set(3.6, 0, -2.2); this.dk.g.rotation.y = -0.15; this.lk.g.position.set(-0.9, 0.11, 2.4);
    this.mt.g.position.set(2.9, 0.02, 2.8); this.mt.g.rotation.y = 0.6; this.bl.g.position.set(4.6, 0, 0.9);
    this.props = [this.B.mesh, this.strip.mesh, this.mk, this.sc.g, this.st, pad, this.fl.g, this.dr.g, this.dk.g, this.lk.g, this.mt.g, this.mg, this.bl.g, this.plug];
    this.scene.add(this.A.mesh, ...this.props); this.propX = this.props.map((p) => p.position.x);
  }

  private bAt(T: number) { const o = new THREE.Vector3(2.7, 0.004, 0.4); let lift = 0;
    for (const [v, d] of Object.entries(BMOVE)) { const e = ease((T - kOf(v)) / 0.3); o.x += d[0] * e; o.z += d[2] * e; lift = Math.max(lift, Math.sin(Math.PI * Math.min(1, Math.max(0, (T - kOf(v)) / 0.3))) * (v === 'drop' ? 0.25 : 0.05)); }
    o.y += lift; return o; }
  private pose(T: number) {
    const fmt = kOf('format'), sweep = (i: number) => 14 * ease((T - fmt - 0.03 * i) / 0.35);
    // paper B + strip
    const bp = this.bAt(T); this.B.mesh.position.copy(bp);
    const cut = kOf('cut'), paste = kOf('paste'), rip = kOf('rip');
    const s0 = new THREE.Vector3(0, 0.0045, 1.74 + 0.06 * ease((T - cut) / 0.15)), s1 = this.bAt(T).add(new THREE.Vector3(-0.1, 0.004, 0.9));
    const fp = ease((T - (paste - 0.3)) / 0.3), sp = s0.clone().lerp(s1, fp); sp.y += Math.sin(Math.PI * fp) * 0.9;
    const rp = Math.max(0, T - rip); sp.add(new THREE.Vector3(1.5 * rp, 2.5 * rp, 1.6 * rp)); this.strip.mesh.position.copy(sp);
    this.strip.mesh.rotation.set(-0.8 * rp * 3, -0.1 * fp + 2 * rp, Math.sin(Math.PI * fp) * 0.4); this.strip.mesh.visible = rp < 1.2;
    // scissors: open blades, snapping shut on each hit
    const sh = since(hitsOf('S'), T), ang = 0.55 * (1 - slam(sh.d) * (sh.d > 0 ? 1 : 0)) * (sh.d < 0.06 ? 1 - sh.d / 0.06 : 1) + 0.0;
    this.sc.a.rotation.y = ang / 2; this.sc.b.rotation.y = -ang / 2; this.sc.g.position.set(1.35 + 0.5 * Math.min(sh.n, 1), 0.06, 1.62); this.sc.g.rotation.y = Math.PI;
    // stamp: arc from the ink pad to its target, slam, lift
    const rest = new THREE.Vector3(-1.8, 0.08, -0.9); let spos = rest.clone();
    for (const [v] of STAMPS) { const t = kOf(v), tgt = v === 'check' ? new THREE.Vector3(0.7, 0.01, -1.0) : this.bAt(t).add(new THREE.Vector3(v === 'rate' ? 0.3 : v === 'update' ? -0.3 : 0, 0.01, v === 'rate' ? 0.7 : v === 'update' ? -0.7 : 0));
      const a = ease((T - t + 0.3) / 0.3), b = ease((T - t - 0.08) / 0.3); if (a > 0 && b < 1) { spos = rest.clone().lerp(tgt, a).lerp(rest, b); spos.y += Math.sin(Math.PI * a) * 0.9 * (1 - b) + Math.sin(Math.PI * b) * 0.9; } }
    this.st.position.copy(spos);
    // floppy: toggles in/out of the drive on load / eject / insert
    const fh = since(hitsOf('F'), T), inP = new THREE.Vector3(-3.3, 0.26, 1.85), outP = new THREE.Vector3(-3.3, 0.02, 2.95);
    const fe = ease(fh.d / 0.22), was = (fh.n - 1) % 2 === 0; const from = fh.n === 0 ? outP : was ? outP : inP, to = fh.n === 0 ? outP : was ? inP : outP;
    this.fl.g.position.copy(from).lerp(to, fh.n ? fe : 0); (this.dr.led.material as THREE.MeshStandardMaterial).emissiveIntensity = (fh.d < 0.45 ? 4 : 0) + 6 * slam(T - kOf('check'));
    // deck: keys, spools, knob, plug, LED
    const keyOf: Record<string, number> = { quick: 3, play: 1, jam: 0, pause: 2, click: 3, switch: 0, start: 1, touch: 2, scroll: 3, plug: -1, surf: -1, tune: -1, turn: -1 };
    this.dk.keys.forEach((k, i) => { let d = 0; for (const [v, j] of Object.entries(keyOf)) if (j === i) { const x = T - kOf(v); if (x >= 0 && x < 0.2) d = Math.max(d, 1 - x / 0.2); } k.position.y = 0.66 - 0.07 * d; });
    let ph = 0; for (let t = kOf('play'); t < T; t += 1 / 60) { const play = t < kOf('pause') || t >= kOf('start'); const ff = (t - kOf('quick') < 0.4 && t > kOf('quick')) || (t - kOf('scroll') < 0.45 && t > kOf('scroll')) ? 8 : 1; ph += (play ? 3 : 0.0) * ff / 60; }
    this.dk.spools.forEach((s) => { s.rotation.y = -ph; });
    this.dk.knob.rotation.y = -0.9 * (ease((T - kOf('surf')) / 0.25) + ease((T - kOf('tune')) / 0.25) + 1.5 * ease((T - kOf('turn')) / 0.3));
    this.plug.position.set(3.6 + 1.9 - 0.45 * ease((T - kOf('plug') + 0.15) / 0.15), 0.3, -2.2 + 0.25); (this.dk.led.material as THREE.MeshStandardMaterial).emissiveIntensity = T > kOf('plug') ? 5 : 0;
    // padlock, match, bell, magnifier
    const lockE = ease((T - kOf('lock')) / 0.12) - ease((T - kOf('unlock')) / 0.15); this.lk.shackle.position.y = 0.8 - 0.18 * lockE; this.lk.shackle.rotation.y = 0.9 * (1 - lockE);
    const burn = T - kOf('burn'), lit = burn > 0 ? 1 : 0; this.mt.g.position.set(2.9 - 0.3 * Math.sin(Math.PI * ease((burn + 0.2) / 0.25)), 0.02, 2.8);
    const fl = lit * (0.9 + 0.1 * Math.sin(T * 41) + 0.06 * Math.sin(T * 97)) * (1 - ease((T - fmt) / 0.2)); this.mt.flame.scale.set(0.7 * fl + 1e-3, (1.6 + 1.2 * slam(burn)) * fl + 1e-3, 0.7 * fl + 1e-3); this.mt.light.intensity = 5 * fl;
    const bh = since(hitsOf('B'), T); this.bl.btn.position.y = 0.5 - 0.06 * (bh.d >= 0 && bh.d < 0.15 ? 1 : 0); const ring = slam(bh.d / 2) * 0.03; this.bl.dome.scale.set(1 + ring * Math.sin(T * 120), 1, 1 + ring * Math.cos(T * 120));
    let mp = new THREE.Vector3(-1.6, 0.05, 1.0); for (const [v, p] of Object.entries(MAG)) { const e = ease((T - kOf(v) + 0.2) / 0.25); mp = mp.lerp(new THREE.Vector3(p[0] + (v === 'scan' ? -1.2 * (1 - ease((T - kOf(v)) / BEAT)) : 0), 0.35, p[1]), e); }
    if (T > fmt) mp.lerp(new THREE.Vector3(-1.6, 0.05, 1.0), ease((T - fmt) / 0.2)); this.mg.position.copy(mp);
    this.props.forEach((p, i) => { if (T > fmt) p.position.x += sweep(i); });
  }

  private resetProps() {
    this.props.forEach((p, i) => { p.position.x = this.propX[i]!; });
  }

  private ink(T: number) {
    const ws = hitsOf('W'), fmt = kOf('format'), wipe = 1 - ease((T - fmt) / 0.3); let tip: THREE.Vector3 | null = null;
    this.A.draw((g, w, h) => {
      g.globalAlpha = wipe; g.font = font(F.serif(600, true), 104); g.fillStyle = '#16182a'; g.textBaseline = 'middle';
      ws.forEach((t, i) => { const r = Math.min(1, Math.max(0, (T - t) / 0.36)); if (r <= 0) return; const txt = LINES_A[i] ?? '', y = 220 + (i === 1 ? 0 : i) * 150 + (i === 1 ? 90 : 0);
        const tw = g.measureText(txt).width; g.save(); g.beginPath(); g.rect(90, y - 80, tw * r, 160); g.clip(); g.fillText(txt, 90, y); g.restore();
        if (r < 1 && T - t >= 0) tip = new THREE.Vector3(-1.05 + (90 + tw * r) / w * 2.1, 0.02, -1.485 + (y + 18) / h * 2.97); });
      const rw = kOf('rewrite'), cr = kOf('cross'); for (const [t0, y] of [[rw, 220], [cr, 670]] as const) { const r = Math.min(1, Math.max(0, (T - t0) / 0.2)); if (r > 0) { g.strokeStyle = '#c0281c'; g.lineWidth = 9; g.beginPath(); g.moveTo(80, y); g.lineTo(80 + 760 * r, y - 6); g.stroke(); } }
      const ck = T - kOf('check'); if (ck > 0) { g.strokeStyle = 'rgba(192,40,28,0.9)'; g.lineWidth = 16; g.beginPath(); g.moveTo(760, 200); g.lineTo(810, 260); g.lineTo(930, 120); g.stroke(); }
    });
    this.B.draw((g, w, h) => { g.globalAlpha = 0.85;
      for (const [v, txt] of STAMPS) { if (v === 'check' || T < kOf(v)) continue; const x = v === 'rate' ? 680 : v === 'update' ? 330 : 512, y = v === 'rate' ? 1150 : v === 'update' ? 380 : 724;
        g.save(); g.translate(x, y); g.rotate(-0.12 + 0.1 * (txt.length % 3)); g.strokeStyle = g.fillStyle = '#b8201a'; g.lineWidth = 10; g.font = font(F.archivo(80, 900), 110); g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(txt).width; g.strokeRect(-tw / 2 - 30, -75, tw + 60, 150); g.fillText(txt, 0, 4); g.restore(); } void w; void h; });
    this.strip.draw((g) => { g.font = font(F.serif(600, true), 70); g.fillStyle = '#16182a'; g.fillText('everything you see', 90, 130); });
    // marker: tip on the writing front, otherwise parked
    const rest = new THREE.Vector3(1.0, 0.25, 1.2); const p = tip ?? rest; this.mk.position.copy(p as THREE.Vector3); if (tip) this.mk.position.y += 0.02 * Math.abs(Math.sin(T * 40));
    if (T > fmt) this.mk.position.x += 14 * ease((T - fmt) / 0.35);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t; this.resetProps(); this.pose(T); this.ink(T);
    const rel = (T - T20) / (bar(21) - T20), b = Math.min(11, Math.max(0, Math.floor(rel))), q = (rel - b) * (bar(21) - T20);
    const at = (i: number, push: number) => { const s = SHOTS[Math.max(0, i)]!; const tgt = new THREE.Vector3(s[0], s[1], s[2]); const d = s[3] * (1 - 0.08 * push);
      return { tgt, pos: tgt.clone().add(new THREE.Vector3(Math.sin(s[4]), s[5], Math.cos(s[4])).normalize().multiplyScalar(d)) }; };
    const cur = at(b, q / 1.87), prev = at(b - 1, 1), e = b === 0 ? 1 : sm(0, 0.14, q);
    const pos = prev.pos.lerp(cur.pos, e), tgt = prev.tgt.lerp(cur.tgt, e);
    pos.add(new THREE.Vector3(0.015 * Math.sin(T * 1.7), 0.012 * Math.sin(T * 2.3 + 1), 0));
    this.cam.position.copy(pos); this.cam.lookAt(tgt); this.cam.updateProjectionMatrix();
    const rr = this.ctx.renderer; rr.setRenderTarget(out); rr.setClearColor(0x000000, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S4_LINES, T, { size: 34, x: 96, y: 96, align: 'left', prompt: '> ', halo: 'rgba(0,0,0,0.55)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const whip = b > 0 ? Math.exp(-q * 14) : 0;
    return { toneMap: 'agx', exposure: 0.95, bloom: 0.18, bloomThreshold: 1.2, halation: 0.15, vignette: 0.45, grain: 0.09, ca: 0.3 + 2.5 * whip,
      depthDof: { enabled: true, focusDistance: pos.distanceTo(tgt), aperture: 10, blades: 9 } };
  }
  override dispose() { this.layer.texture.dispose(); this.oak?.dispose(); for (const s of [this.A, this.B, this.strip]) s.tex.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
}

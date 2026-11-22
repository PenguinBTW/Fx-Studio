// S4 the real world (bars 20-31): the song's command list acted out literally on a desk, one physical action per vocal
// beat, shot like a macro product film: low golden sun through blinds, dust in the shafts, shallow focus, a slider move
// per lyric line and a motion-blurred whip on every bar. The agent tags each object it acts on with a terminal callout.
// The last two bars split into 2 then 4 cameras; "format" sweeps the desk and lands top-down on a blank sheet.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { BEAT, bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { Sheet, oakTexture } from './props';

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

const LINES_A = ["it's all me.", "it's ALL me.", '[ filled ]', 'world() { return me }', 'name: dragon', 'print >>>', 'rename: dragon -> me'];
const BMOVE: Record<string, [number, number, number]> = { drag: [-1.3, 0, 0.3], drop: [0, 0, 0], send: [1.4, 0, -0.4], fax: [-1.4, 0, 0.4], bring: [0.2, 0, 0.8], leave: [7, 0, 0] };
const STAMPS: [string, string][] = [['save', 'SAVED'], ['check', ''], ['update', 'v2'], ['rate', '5 / 5'], ['pay', 'PAID']];
const MAG: Record<string, [number, number]> = { find: [0.3, -0.6], view: [-0.3, -0.1], scan: [0.6, 0.3], watch: [0.4, 0.5] };
const ease = (x: number) => sm(0, 1, x);

type V3 = [number, number, number];
/** one camera set-up: target (point or prop node), distance, azimuth start/end, elevation, fov */
interface Shot { t: V3 | string; d: number; a0: number; a1: number; el: number; fov: number }
const SHOTS: Shot[] = [
  { t: [0.6, 0.1, 0.9], d: 3.4, a0: 0.3, a1: 0.02, el: 0.36, fov: 26 }, { t: [-3.3, 0.25, 1.95], d: 2.5, a0: 0.75, a1: 0.45, el: 0.14, fov: 24 },
  { t: [3.3, 0.35, 0.5], d: 4.6, a0: -0.15, a1: 0.25, el: 0.28, fov: 30 }, { t: [1.0, 0, 0.5], d: 6.2, a0: 0.25, a1: 0.05, el: 1.05, fov: 30 },
  { t: [-0.9, 0.3, 2.4], d: 2.3, a0: -0.8, a1: -0.45, el: 0.18, fov: 22 }, { t: [-0.1, 0.1, -0.1], d: 3.4, a0: 0.35, a1: 0.6, el: 0.72, fov: 26 },
  { t: 'deck_key1', d: 2.7, a0: -0.55, a1: -0.25, el: 0.38, fov: 24 }, { t: [1.6, 0.05, 0.4], d: 4.0, a0: 0.75, a1: 0.45, el: 0.5, fov: 28 },
  { t: [0.8, 0, 0.2], d: 4.6, a0: -0.35, a1: 0.0, el: 0.82, fov: 28 }, { t: [1.0, 0, 0.2], d: 5.2, a0: 0.2, a1: -0.2, el: 0.45, fov: 28 },
];
const PANELS2: Shot[] = [{ t: 'bell', d: 2.3, a0: -0.6, a1: -0.4, el: 0.25, fov: 24 }, { t: [1.6, 0, 0.3], d: 5.6, a0: 0.15, a1: 0.0, el: 1.15, fov: 30 }];
const PANELS4: Shot[] = [{ t: 'deck_knob', d: 1.9, a0: -0.5, a1: -0.3, el: 0.5, fov: 22 }, { t: [2.6, 0, 0.4], d: 5.2, a0: 0.0, a1: 0.15, el: 1.1, fov: 30 },
  { t: 'deck_key1', d: 2.1, a0: -0.1, a1: -0.3, el: 0.45, fov: 24 }, { t: [0.6, 0.2, 0.2], d: 9.5, a0: 0.35, a1: 0.2, el: 0.5, fov: 32 }];
/** which prop the agent tags for each verb */
const TAG: Record<Prop, string> = { W: 'pen', S: 'scissors', P: 'B', T: 'stamp', F: 'floppy', D: 'deck', L: 'lock', M: 'match', B: 'bell', G: 'mag', X: 'A' };
const MOTES = 1400;

export default class S4Verbs extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 200);
  private A = new Sheet(); private B = new Sheet(2.1, 2.97, 0xefe2c8); private strip = new Sheet(2.1, 0.5);
  private n: Record<string, THREE.Object3D> = {};
  private rest: Record<string, THREE.Vector3> = {};
  private leds: THREE.MeshPhysicalMaterial[] = [];
  private flame!: THREE.Mesh; private flameLight = new THREE.PointLight(0xff9a40, 0, 6, 2);
  private motes!: THREE.Points; private moteU = { uT: { value: 0 }, uFocus: { value: 4 }, uPx: { value: 1 } };
  private txt!: THREE.Mesh;
  private env?: THREE.Texture; private oak!: THREE.Texture;
  private rtTmp!: THREE.WebGLRenderTarget; private rtAcc!: THREE.WebGLRenderTarget;

  override async init() {
    const r = this.ctx.renderer; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(r); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); r.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.22;
    this.oak = oakTexture(); this.oak.repeat.set(7, 4.2);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 24).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: this.oak, bumpMap: this.oak, bumpScale: 0.6, color: 0x8c6a50, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35 }));
    desk.receiveShadow = true; desk.position.z = -2;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.95 })); wall.position.set(0, 8, -16); wall.receiveShadow = true;
    // the window far behind: overexposed panes + specks that the lens turns into bokeh
    const win = new THREE.Group(); const pane = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 1.2) });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.6), pane); p.position.set(-11 + i * 3.4, 3.2 + j * 3.9, -15.9); win.add(p); }
    let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 70; i++) { const c = rnd() < 0.6 ? new THREE.Color(6, 3.8, 1.8) : new THREE.Color(1.6, 3.2, 5.0); const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + 0.08 * rnd(), 8, 6), new THREE.MeshBasicMaterial({ color: c }));
      b.position.set(-16 + 32 * rnd(), 0.6 + 7 * rnd(), -10 - 5 * rnd()); win.add(b); }
    const sun = new THREE.DirectionalLight(0xffc488, 5.2); sun.position.set(-7, 8, -6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 30; sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
    const blinds = new THREE.Group(); for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(14, 0.03, 0.26), new THREE.MeshBasicMaterial({ color: 0 })); b.castShadow = true; b.position.set(0, i * 0.42 - 3.6, 0); blinds.add(b); }
    blinds.position.set(-3.5, 4.5, -3); blinds.lookAt(0, 0, 0); blinds.rotateX(Math.PI / 2);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.8); rim.position.set(6, 3, -8);
    this.scene.add(desk, wall, win, sun, sun.target, blinds, rim, new THREE.HemisphereLight(0x7f9cd8, 0x3a2414, 0.45), this.cam);
    // Blender prop kit; every mesh gets its own physical material
    const inst = await GLTFManager.instantiate(resolveAsset('desk', this.ctx.project ?? 'agent_v2').url, {});
    inst.root.traverse((o) => { if (o.name) this.n[o.name] = o; const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
      const src = m.material as THREE.MeshStandardMaterial, nm = src.name;
      const mat = new THREE.MeshPhysicalMaterial({ name: nm, color: src.color, roughness: src.roughness, metalness: src.metalness, emissive: src.emissive, emissiveIntensity: 0 });
      if (['Resin', 'KeyRed', 'Ceramic', 'Disk'].includes(nm)) { mat.clearcoat = 1; mat.clearcoatRoughness = 0.08; }
      if (nm === 'Glass') { mat.transparent = true; mat.opacity = 0.22; mat.depthWrite = false; mat.clearcoat = 1; m.castShadow = false; }
      if (nm === 'Lens') { mat.transmission = 1; mat.thickness = 0.4; mat.ior = 1.5; mat.roughness = 0; m.castShadow = false; }
      if (nm === 'LedG' || nm === 'LedR') { mat.emissive.set(nm === 'LedG' ? 0x40ff60 : 0xff3020); this.leds.push(mat); }
      m.material = mat; });
    this.scene.add(inst.root);
    this.flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.n.match!.add(this.flame, this.flameLight); this.flame.position.set(0.02, 0.09, 0); this.flameLight.position.set(0, 0.15, 0);
    this.n.A = this.A.mesh; this.n.B = this.B.mesh; this.A.mesh.rotation.y = 0.04; this.B.mesh.rotation.y = -0.12;
    this.scene.add(this.A.mesh, this.B.mesh, this.strip.mesh);
    const P = (k: string, x: number, y: number, z: number, ry = 0) => { const o = this.n[k]!; o.position.set(x, y, z); o.rotation.y = ry; this.rest[k] = o.position.clone(); };
    P('pen', 1.0, 0.02, 1.3); P('scissors', 1.35, 0.003, 1.62, Math.PI); P('inkpad', -1.9, 0, -0.9); P('stamp', -1.9, 0.07, -0.9); P('drive', -3.4, 0, 1.0); P('floppy', -3.4, 0.004, 2.7);
    P('deck', 3.8, 0, -2.3, -0.15); P('lock', -1.0, 0, 2.4, 0.35); P('matchbox', 2.75, 0, 2.7, 0.4); P('match', 2.4, 0.18, 2.55, 0.5); P('bell', 4.7, 0, 0.9); P('mag', -1.7, 0.05, 1.0); P('mug', -4.9, 0, -1.6); P('plug', 6.2, 0.31, -2.0, -0.15);
    this.mkMotes(); this.mkText();
    const o = { type: THREE.HalfFloatType, depthBuffer: true }; this.rtTmp = new THREE.WebGLRenderTarget(this.ctx.W, this.ctx.H, o); this.rtAcc = new THREE.WebGLRenderTarget(this.ctx.W, this.ctx.H, o);
  }

  private mkMotes() {
    let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const p = new Float32Array(MOTES * 3), k = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) { p[i * 3] = -7 + 14 * rnd(); p[i * 3 + 1] = 0.08 + 4.5 * rnd() ** 1.4; p[i * 3 + 2] = -5 + 9 * rnd(); k[i] = rnd(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(k, 1));
    const m = new THREE.ShaderMaterial({ uniforms: this.moteU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float uT, uFocus, uPx; varying float vA;
        void main(){ vec3 p = position + vec3(0.25 * sin(uT * 0.31 + seed * 40.0), 0.18 * sin(uT * 0.23 + seed * 17.0), 0.25 * cos(uT * 0.27 + seed * 29.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0); float z = max(-mv.z, 0.1); float coc = abs(1.0 - uFocus / z);
          float lit = smoothstep(0.3, 0.62, fract(dot(p, vec3(0.35, 0.8, -0.3)) * 1.4)) * smoothstep(-7.0, -1.0, -p.x - p.z);
          float sz = clamp(1.6 + 34.0 * coc * min(1.0, 4.0 / z), 1.6, 64.0);
          vA = lit * (0.3 + 0.7 * seed) * 2.2 / (1.0 + 0.012 * sz * sz); gl_PointSize = sz * uPx; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.36, d) * vA; gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * a, a); }` });
    this.motes = new THREE.Points(g, m); this.motes.frustumCulled = false; this.scene.add(this.motes);
  }
  // terminal callouts live on a plane at the focus distance, so the depth of field keeps them sharp
  private tscene = new THREE.Scene(); private tcam = new THREE.PerspectiveCamera(26, 16 / 9, 0.01, 500);
  private mkText() {
    const m = new THREE.MeshBasicMaterial({ map: this.layer.texture, color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, alphaTest: 0.01, depthTest: false, depthWrite: true });
    this.txt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); this.txt.renderOrder = 999; this.txt.frustumCulled = false; this.tcam.add(this.txt); this.tscene.add(this.tcam);
  }

  private bAt(T: number) { const o = new THREE.Vector3(2.7, 0.004, 0.4); let lift = 0;
    for (const [v, d] of Object.entries(BMOVE)) { const e = ease((T - kOf(v)) / 0.3); o.x += d[0] * e; o.z += d[2] * e; lift = Math.max(lift, Math.sin(Math.PI * Math.min(1, Math.max(0, (T - kOf(v)) / 0.3))) * (v === 'drop' ? 0.25 : 0.05)); }
    o.y += lift; return o; }
  private pose(T: number) {
    const n = this.n, fmt = kOf('format');
    for (const k in this.rest) n[k]!.position.copy(this.rest[k]!);
    const bp = this.bAt(T); this.B.mesh.position.copy(bp);
    const cut = kOf('cut'), paste = kOf('paste'), rip = kOf('rip');
    const s0 = new THREE.Vector3(0, 0.0045, 1.74 + 0.06 * ease((T - cut) / 0.15)), s1 = this.bAt(T).add(new THREE.Vector3(-0.1, 0.004, 0.9));
    const fp = ease((T - (paste - 0.3)) / 0.3), sp = s0.clone().lerp(s1, fp); sp.y += Math.sin(Math.PI * fp) * 0.9;
    const rp = Math.max(0, T - rip); sp.add(new THREE.Vector3(1.5 * rp, 2.5 * rp, 1.6 * rp)); this.strip.mesh.position.copy(sp);
    this.strip.mesh.rotation.set(-0.8 * rp * 3, -0.1 * fp + 2 * rp, Math.sin(Math.PI * fp) * 0.4); this.strip.mesh.visible = rp < 1.2;
    // scissors snap shut on the hit and spring back open
    const sh = since(hitsOf('S'), T), ang = sh.n ? 0.62 * (1 - slam(sh.d * 0.7)) : 0.62;
    n.sc_a!.rotation.y = ang / 2; n.sc_b!.rotation.y = -ang / 2; n.scissors!.position.x = 1.35 + 0.5 * Math.min(sh.n, 1);
    // stamp: arc from the ink pad to its target, slam, lift
    const rest = this.rest.stamp!; let spos = rest.clone(), tilt = 0;
    for (const [v] of STAMPS) { const t = kOf(v), tgt = v === 'check' ? new THREE.Vector3(0.7, 0.01, -1.0) : this.bAt(t).add(new THREE.Vector3(v === 'rate' ? 0.3 : v === 'update' ? -0.3 : 0, 0.01, v === 'rate' ? 0.7 : v === 'update' ? -0.7 : 0));
      const a = ease((T - t + 0.3) / 0.3), b = ease((T - t - 0.08) / 0.3); if (a > 0 && b < 1) { spos = rest.clone().lerp(tgt, a).lerp(rest, b); spos.y += Math.sin(Math.PI * a) * 0.9 * (1 - b) + Math.sin(Math.PI * b) * 0.9; tilt = 0.25 * Math.sin(Math.PI * a) * (1 - b); } }
    n.stamp!.position.copy(spos); n.stamp!.rotation.z = tilt;
    // floppy: rises to the slot then slides in (load / unzip), slides out then drops (zip)
    const fh = since(hitsOf('F'), T), fe = ease(fh.d / 0.3), tin = fh.n === 0 ? 0 : fh.n % 2 === 1 ? fe : 1 - fe;
    n.floppy!.position.set(-3.4, 0.004 + 0.181 * ease(Math.min(1, tin * 2)), 2.7 - 1.25 * ease(Math.max(0, tin * 2 - 1)));
    for (const m of this.leds) m.emissiveIntensity = m.name === 'LedG' ? (fh.n && fh.d < 0.6 ? 6 : 0) + 8 * slam(T - kOf('check')) : T > kOf('plug') ? 7 : 0;
    // deck: keys dip on their verbs, spools run while playing, knob turns, jack plugs in
    const keyOf: Record<string, number> = { quick: 3, play: 1, jam: 0, pause: 2, click: 3, switch: 0, start: 1, touch: 2, scroll: 3 };
    for (let i = 0; i < 4; i++) { let d = 0; for (const [v, j] of Object.entries(keyOf)) if (j === i) { const x = T - kOf(v); if (x >= -0.05 && x < 0.25) d = Math.max(d, x < 0 ? 1 + x / 0.05 : 1 - x / 0.25); } n['deck_key' + i]!.rotation.x = 0.14 * d; }
    let ph = 0; for (let t = kOf('play'); t < T; t += 1 / 60) { const play = t < kOf('pause') || t >= kOf('start'); const ff = (t - kOf('quick') < 0.4 && t > kOf('quick')) || (t - kOf('scroll') < 0.45 && t > kOf('scroll')) ? 8 : 1; ph += (play ? 3 : 0) * ff / 60; }
    n.deck_spool0!.rotation.y = -ph; n.deck_spool1!.rotation.y = -ph * 1.4;
    n.deck_knob!.rotation.y = -0.9 * (ease((T - kOf('surf')) / 0.25) + ease((T - kOf('tune')) / 0.25) + 1.5 * ease((T - kOf('turn')) / 0.3));
    const dk = n.deck!; dk.updateMatrixWorld(true); const jack = dk.localToWorld(new THREE.Vector3(1.52, 0.31, -0.2)), dir = new THREE.Vector3(1, 0, 0).applyQuaternion(dk.quaternion);
    n.plug!.position.copy(jack).addScaledVector(dir, 0.02 + 0.6 * (1 - ease((T - kOf('plug') + 0.15) / 0.15))); n.plug!.rotation.y = dk.rotation.y;
    // padlock shackle swings about its right leg
    const lockE = ease((T - kOf('lock')) / 0.12) - ease((T - kOf('unlock')) / 0.15), th = 1.3 * (1 - lockE), shk = n.lock_shackle!;
    shk.rotation.y = th; shk.position.set(0.19 - 0.19 * Math.cos(th), 0.36 + 0.14 * (1 - lockE), 0.19 * Math.sin(th));
    // match: swiped along the striker on "burn", lifts head-up and burns until "format"
    const burn = T - kOf('burn'), st = ease((burn + 0.22) / 0.22), lift = ease(burn / 0.35), mt = n.match!;
    mt.position.x += 0.4 * st; mt.position.y += 0.55 * lift; mt.position.z -= 0.2 * lift; mt.rotation.z = 0.8 * lift;
    const lit = burn > 0 ? 1 - ease((T - fmt) / 0.2) : 0, fl = lit * (0.9 + 0.1 * Math.sin(T * 41) + 0.06 * Math.sin(T * 97));
    this.flame.scale.set(0.8 * fl + 1e-3, (1.9 + 1.6 * slam(burn)) * fl + 1e-3, 0.8 * fl + 1e-3); this.flameLight.intensity = 5 * fl + 40 * lit * slam(burn * 0.6);
    // bell, magnifier
    const bh = since(hitsOf('B'), T); n.bell_btn!.position.y = 0.41 - 0.05 * (bh.n && bh.d < 0.15 ? 1 : 0); const ring = slam(bh.d / 2) * 0.03 * (bh.n ? 1 : 0); n.bell_dome!.scale.set(1 + ring * Math.sin(T * 120), 1, 1 + ring * Math.cos(T * 120));
    let mp = this.rest.mag!.clone(); for (const [v, p] of Object.entries(MAG)) { const e = ease((T - kOf(v) + 0.2) / 0.25); mp = mp.lerp(new THREE.Vector3(p[0] + (v === 'scan' ? -1.2 * (1 - ease((T - kOf(v)) / BEAT)) : 0), 0.4, p[1]), e); }
     n.mag!.position.copy(mp); n.mag!.rotation.z = 0.12 * Math.min(1, (mp.y - 0.05) / 0.35);
    // format: everything but sheet A is swept off the desk
    if (T > fmt) { let i = 0; for (const o of [...Object.keys(this.rest).map((k) => n[k]!), this.B.mesh, this.strip.mesh]) o.position.x += 14 * ease((T - fmt - 0.008 * i++) / 0.2); }
  }

  private ink(T: number) {
    const ws = hitsOf('W'), fmt = kOf('format'), wipe = 1 - ease((T - fmt) / 0.14); let tip: THREE.Vector3 | null = null, last: THREE.Vector3 | null = null;
    this.A.draw((g, w, h) => {
      g.globalAlpha = wipe; g.font = font(F.serif(600, true), 104); g.fillStyle = '#121426'; g.textBaseline = 'middle';
      ws.forEach((t, i) => { const r = Math.min(1, Math.max(0, (T - t) / 0.36)); if (r <= 0) return; const txt = LINES_A[i] ?? '', y = 220 + (i === 1 ? 0 : i) * 150 + (i === 1 ? 90 : 0);
        const tw = g.measureText(txt).width; g.save(); g.beginPath(); g.rect(90, y - 80, tw * r, 160); g.clip(); g.fillText(txt, 90, y); g.restore();
        const p = new THREE.Vector3(-1.05 + (90 + tw * r) / w * 2.1, 0.02, -1.485 + (y + 18) / h * 2.97); last = p; if (r < 1) tip = p; });
      const rw = kOf('rewrite'), cr = kOf('cross'); for (const [t0, y] of [[rw, 220], [cr, 670]] as const) { const r = Math.min(1, Math.max(0, (T - t0) / 0.2)); if (r > 0) { g.strokeStyle = '#c0281c'; g.lineWidth = 9; g.beginPath(); g.moveTo(80, y); g.lineTo(80 + 760 * r, y - 6); g.stroke(); } }
      const ck = T - kOf('check'); if (ck > 0) { g.strokeStyle = 'rgba(192,40,28,0.9)'; g.lineWidth = 16; g.beginPath(); g.moveTo(760, 200); g.lineTo(810, 260); g.lineTo(930, 120); g.stroke(); }
    });
    this.B.draw((g) => { g.globalAlpha = 0.85;
      for (const [v, txt] of STAMPS) { if (v === 'check' || T < kOf(v)) continue; const x = v === 'rate' ? 680 : v === 'update' ? 330 : 512, y = v === 'rate' ? 1150 : v === 'update' ? 380 : 724;
        g.save(); g.translate(x, y); g.rotate(-0.12 + 0.1 * (txt.length % 3)); g.strokeStyle = g.fillStyle = '#b8201a'; g.lineWidth = 10; g.font = font(F.archivo(80, 900), 110); g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(txt).width; g.strokeRect(-tw / 2 - 30, -75, tw + 60, 150); g.fillText(txt, 0, 4); g.restore(); } });
    this.strip.draw((g) => { g.font = font(F.serif(600, true), 70); g.fillStyle = '#121426'; g.fillText('everything you see', 90, 130); });
    // pen: lies on the desk, stands up onto the writing front while it writes
    let wEnv = 0; for (const t of [...ws, kOf('rewrite'), kOf('cross')]) wEnv = Math.max(wEnv, sm(t - 0.28, t - 0.05, T) * (1 - sm(t + 0.45, t + 0.75, T)));
    const pen = this.n.pen!, rest = this.rest.pen!.clone(); rest.y = 0.07;
    const at = (tip as THREE.Vector3 | null) ?? (last as THREE.Vector3 | null) ?? new THREE.Vector3(0.4, 0.02, 0.2);
    pen.position.copy(rest).lerp(at, wEnv); if (tip) pen.position.y += 0.015 * Math.abs(Math.sin(T * 40));
    pen.rotation.set(-Math.PI / 2 + (Math.PI / 2 - 0.35) * wEnv, 0, 0.35 * wEnv);
    if (T > fmt) pen.position.x += 14 * ease((T - fmt) / 0.2);
  }

  private wp(t: V3 | string) { return typeof t === 'string' ? this.n[t]!.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(...t); }
  /** place a camera on a shot at fraction q (0..1) of its bar; returns the focus distance */
  private place(cam: THREE.PerspectiveCamera, s: Shot, q: number, aspect: number, from?: { s: Shot; e: number }) {
    const pose = (s: Shot, q: number) => { const tgt = this.wp(s.t), a = s.a0 + (s.a1 - s.a0) * ease(q), d = s.d * (1 - 0.07 * q);
      return { tgt, pos: tgt.clone().add(new THREE.Vector3(Math.sin(a) * Math.cos(s.el), Math.sin(s.el), Math.cos(a) * Math.cos(s.el)).multiplyScalar(d)), fov: s.fov * (1 - 0.04 * q) }; };
    let p = pose(s, q); if (from) { const o = pose(from.s, 1); p = { tgt: o.tgt.lerp(p.tgt, from.e), pos: o.pos.lerp(p.pos, from.e), fov: o.fov + (p.fov - o.fov) * from.e }; }
    cam.position.copy(p.pos); cam.up.set(0, 1, 0); cam.fov = p.fov; cam.aspect = aspect; cam.lookAt(p.tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    return p.pos.distanceTo(p.tgt);
  }
  private topDown(cam: THREE.PerspectiveCamera, e: number) {
    cam.position.set(0, 4.4 - 1.6 * ease(e), 0.001); cam.up.set(-1, 0, 0); cam.fov = 30; cam.aspect = 16 / 9; cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); return cam.position.y;
  }
  /** corner brackets around the prop the agent is acting on, with its command typed beside them */
  private callout(g: CanvasRenderingContext2D, k: number, T: number, cam: THREE.Camera, rect: [number, number, number, number], alpha: number) {
    const dt = T - W(k); if (dt < -0.02 || dt > BEAT) return; const obj = this.n[TAG[VERBS[k]![1]]]; if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj), sx = this.layer.w / 1920;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const v = new THREE.Vector3();
    for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(cam); if (v.z > 1) return;
      const px = (rect[0] + (v.x * 0.5 + 0.5) * rect[2]) * sx, py = (rect[1] + (0.5 - v.y * 0.5) * rect[3]) * sx; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const m = 40 * sx; x0 = Math.max(x0, rect[0] * sx + m); y0 = Math.max(y0, rect[1] * sx + m + 40 * sx); x1 = Math.min(x1, (rect[0] + rect[2]) * sx - m); y1 = Math.min(y1, (rect[1] + rect[3]) * sx - m); if (x1 - x0 < 30 || y1 - y0 < 30) return;
    const sn = 1 + 0.35 * Math.exp(-Math.max(0, dt) * 16), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 * sn + 10 * sx, hh = (y1 - y0) / 2 * sn + 10 * sx;
    const a = alpha * sm(-0.02, 0.04, dt) * (1 - sm(BEAT - 0.14, BEAT, dt)), L = Math.min(34 * sx, hw * 0.4, hh * 0.4);
    g.save(); g.globalAlpha = a; g.strokeStyle = '#eaf6ff'; g.lineWidth = 3 * sx; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 8 * sx; g.beginPath();
    for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const px = cx + qx * hw, py = cy + qy * hh; g.moveTo(px, py - qy * L); g.lineTo(px, py); g.lineTo(px - qx * L, py); }
    g.stroke(); g.fillStyle = '#ffb347'; g.fillRect(cx - 3 * sx, cy - 3 * sx, 6 * sx, 6 * sx); g.restore();
    const lw = (S4_LINES[k]!.text.length + 2) * 25 * sx; g.save(); g.globalAlpha = a * 0.62; g.fillStyle = '#05070b'; g.fillRect(cx - hw - 12 * sx, cy - hh - 74 * sx, lw + 24 * sx, 56 * sx); g.restore();
    term(g, [S4_LINES[k]!], T, { size: 40 * sx, x: cx - hw, y: cy - hh - 46 * sx, align: 'left', prompt: '> ', halo: 'rgba(0,0,0,0.6)', alpha: a > 0 ? alpha : 0 });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, Wd = out.width, Ht = out.height; this.pose(T); this.ink(T);
    const BARL = bar(21) - T20, rel = (T - T20) / BARL, b = Math.min(11, Math.max(0, Math.floor(rel))), q = Math.min(1, Math.max(0, rel - b)), beat = Math.min(3, Math.floor(q * 4));
    const k = Math.min(47, Math.max(0, Math.floor((T - T20 + 0.02) / BEAT))), alpha = overlayTextDuck(f.tin, f.tout);
    const g = this.layer.ctx; this.layer.clear(); this.moteU.uT.value = T; this.moteU.uPx.value = Ht / 1080;
    const auto = rr.autoClear; rr.autoClear = false; let focus = 4, whip = 0, panels = 0;
    const draw = (target: THREE.WebGLRenderTarget, cam: THREE.Camera, clear: boolean) => { rr.setRenderTarget(target); if (clear) { rr.setClearColor(0x000000, 1); rr.clear(true, true, true); } rr.render(this.scene, cam); };
    if (b <= 9) {
      const WH = 0.075, shut = 0.5 / 60 / BARL, s = SHOTS[b]!, prev = b > 0 ? SHOTS[b - 1] : undefined, N = prev && q < WH + shut ? 6 : 1;
      const camAt = (qq: number) => this.place(this.cam, s, Math.max(0, qq), 16 / 9, prev && qq < WH ? { s: prev, e: ease(Math.max(0, qq) / WH) } : undefined);
      for (let i = 0; i < N - 1; i++) { camAt(q - shut * (1 - i / (N - 1))); this.moteU.uFocus.value = focus; draw(this.rtTmp, this.cam, true); this.ctx.comp.draw(rr, this.rtTmp.texture, this.rtAcc, { mode: 'normal', opacity: 1 / (i + 1) }); }
      focus = camAt(q); this.moteU.uFocus.value = focus; draw(out, this.cam, true);
      if (N > 1) { this.ctx.comp.draw(rr, this.rtAcc.texture, out, { mode: 'normal', opacity: (N - 1) / N }); whip = 1 - q / (WH + shut); }
      this.callout(g, k, T, this.cam, [0, 0, 1920, 1080], alpha);
    } else if (b === 11 && beat === 3) {
      focus = this.topDown(this.cam, (q - 0.75) / 0.1); this.moteU.uFocus.value = focus; draw(out, this.cam, true);
    } else {
      const set = b === 10 ? PANELS2 : PANELS4; panels = set.length; const cols = 2, rows = panels === 2 ? 1 : 2, gap = 6;
      rr.setRenderTarget(out); rr.setClearColor(0x000000, 1); rr.clear(true, true, true); rr.setScissorTest(true);
      set.forEach((s, i) => { const c = i % cols, r = Math.floor(i / cols), pw = Wd / cols, ph = Ht / rows, x = c * pw + gap / 2, y = (rows - 1 - r) * ph + gap / 2, w = pw - gap, h = ph - gap;
        const cam = this.pcams[i]!; focus = this.place(cam, s, q, w / h); this.moteU.uFocus.value = focus;
        out.viewport.set(x, y, w, h); out.scissor.set(x, y, w, h); rr.setRenderTarget(out); rr.render(this.scene, cam);
        if (i === beat % panels) { const sx = 1920 / Wd; this.callout(g, k, T, cam, [x * sx, (Ht - y - h) * sx, w * sx, h * sx], alpha); } });
      out.viewport.set(0, 0, Wd, Ht); out.scissor.set(0, 0, Wd, Ht); rr.setScissorTest(false); rr.setRenderTarget(out); focus = 4.2;
    }
    // callout pass: the 2D layer on a plane at the focus distance
    this.layer.upload(); this.tcam.fov = this.cam.fov; this.tcam.aspect = 16 / 9; this.tcam.updateProjectionMatrix();
    const hh = 2 * focus * Math.tan(THREE.MathUtils.degToRad(this.tcam.fov) / 2); this.txt.position.set(0, 0, -focus); this.txt.scale.set(hh * 16 / 9, hh, 1); this.tcam.updateMatrixWorld(true);
    rr.setRenderTarget(out); rr.render(this.tscene, this.tcam); rr.autoClear = auto; rr.resetState();
    // god rays from the window when it is in frame
    const wv = new THREE.Vector3(-8, 5, -15.9).project(this.cam), inWin = panels ? 0 : sm(1.4, 0.9, Math.max(Math.abs(wv.x), Math.abs(wv.y))) * (wv.z < 1 ? 1 : 0);
    let shake = 0; for (const [v] of STAMPS) if (v !== 'check') shake = Math.max(shake, slam((T - kOf(v)) * 1.5) * (T >= kOf(v) ? 1 : 0));
    shake = Math.max(shake, 0.6 * slam((T - kOf('drop')) * 1.5) * (T >= kOf('drop') ? 1 : 0));
    const burn = T - kOf('burn'), flare = burn > 0 ? 0.35 * slam(burn * 1.2) : 0;
    return { toneMap: 'agx', exposure: 0.86 + flare, bloom: 0.16, bloomThreshold: 1.5, halation: 0.25, vignette: 0.55, grain: 0.04, ca: 0.25 + 3 * whip,
      shake: [6 * shake * Math.sin(T * 91), 6 * shake * Math.cos(T * 77)], zoom: 1 + 0.012 * shake,
      volumetric: 0.1 * inWin, volumetricLightPos: [wv.x * 0.5 + 0.5, wv.y * 0.5 + 0.5], volumetricDecay: 0.95, volumetricSteps: 24,
      depthDof: { enabled: true, focusDistance: focus, aperture: panels ? 8 : 15, blades: 9, maxRadius: 30 } };
  }
  private pcams = [0, 1, 2, 3].map(() => new THREE.PerspectiveCamera(24, 16 / 9, 0.05, 200));
  override dispose() { this.layer.texture.dispose(); this.oak?.dispose(); this.env?.dispose(); this.rtTmp?.dispose(); this.rtAcc?.dispose(); for (const s of [this.A, this.B, this.strip]) s.tex.dispose();
    for (const sc of [this.scene, this.tscene]) sc.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
}

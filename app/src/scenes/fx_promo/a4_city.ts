// a4_city (bars 27-48, 52.28-95.05 s): a city of Blender kit floors assembles on the 8th-note grid at dawn, lights up as
// an equaliser at night, is abandoned (lights die on off-beats, fog, moss), then collapses into dust on the beat.
// Every state is a closed-form function of T; params.remap = [s0, s1, e0, e1] maps song time s0..s1 onto city time
// e0..e1 (e0 > e1 plays it backwards: the rewind in A9a).
import * as THREE from 'three';
import { LargeParticles } from '../../engine/particles_large';
import { CityWorld } from './city_world';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { clamp, ease, prog, smoothstep, lerp } from '../../engine/util';
import { C, BAR, BEAT, B0, bar, beatAt, model, present, slam, typeLine, applyCam, mixKey, Instanced, sceneTime, type CamKey } from './kit';

const h = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const FH = 0.3, G = 15, CELL = 3.2, ND = 4200;
const qBeat = (t: number, div = 1) => B0 + Math.ceil((t - B0) / (BEAT / div)) * (BEAT / div);
const VAR = ['floor_a', 'floor_b', 'floor_c'] as const;

interface Bld { x: number; z: number; v: number; n: number; rot: number; sc: number; r: number; tb: number; tc: number; band: number; psi: number; fo: number; falls: boolean; crane: boolean }

// Palette keys (bar, look). Colours are sRGB hex; THREE.Color converts to linear.
interface Look { top: string; bot: string; fog: string; fogD: number; sun: string; sunI: number; elev: number; hemi: string; gnd: string; hemiI: number; body: string; exp: number; bloom: number }
const LOOKS: [number, Look][] = [
  [27, { top: '#4F7FCC', bot: '#FFB07A', fog: '#AFC2E0', fogD: 0.0016, sun: '#FFB880', sunI: 4.2, elev: 7, hemi: '#9FB8E0', gnd: '#3A4458', hemiI: 1.0, body: '#F2EEE8', exp: 1.0, bloom: 0.25 }],
  [33, { top: '#8FB4DC', bot: '#F6DCC0', fog: '#EAD8C6', fogD: 0.0018, sun: '#FFF0DC', sunI: 3.2, elev: 24, hemi: '#BFD4E6', gnd: '#8A7A6A', hemiI: 1.0, body: '#ECE7DF', exp: 1.0, bloom: 0.25 }],
  [34.6, { top: '#2A2D5A', bot: '#FF9A5A', fog: '#6A4A5A', fogD: 0.008, sun: '#FF7A3A', sunI: 1.6, elev: 3, hemi: '#5A4A7A', gnd: '#2A1A1A', hemiI: 0.6, body: '#D8C8C0', exp: 1.0, bloom: 0.5 }],
  [35.6, { top: '#03060F', bot: '#0A1430', fog: '#0A1430', fogD: 0.007, sun: '#6A8AFF', sunI: 0.35, elev: 40, hemi: '#1A2650', gnd: '#050505', hemiI: 0.35, body: '#B8BCC8', exp: 1.05, bloom: 0.9 }],
  [40.6, { top: '#03060F', bot: '#0A1430', fog: '#0A1430', fogD: 0.007, sun: '#6A8AFF', sunI: 0.35, elev: 40, hemi: '#1A2650', gnd: '#050505', hemiI: 0.35, body: '#B8BCC8', exp: 1.05, bloom: 0.9 }],
  [42, { top: '#4A5654', bot: '#7A8682', fog: '#5F6E6A', fogD: 0.009, sun: '#C8D2CC', sunI: 0.5, elev: 50, hemi: '#8A9894', gnd: '#3A3E36', hemiI: 0.9, body: '#9A9C94', exp: 0.95, bloom: 0.35 }],
  [45, { top: '#5A6E8C', bot: '#FFD29A', fog: '#E8B880', fogD: 0.0008, sun: '#FFC07A', sunI: 1.4, elev: 6, hemi: '#B9A07A', gnd: '#2A241E', hemiI: 0.45, body: '#4A4038', exp: 1.0, bloom: 0.35 }],
  [48.9, { top: '#4A5A78', bot: '#FFC888', fog: '#E0A870', fogD: 0.0008, sun: '#FFB06A', sunI: 1.3, elev: 4, hemi: '#9A8468', gnd: '#221C16', hemiI: 0.4, body: '#3E362E', exp: 1.0, bloom: 0.38 }],
  [49, { top: '#2A2622', bot: '#6A5A44', fog: '#4A4034', fogD: 0.007, sun: '#E0C090', sunI: 0.4, elev: 6, hemi: '#6A5A44', gnd: '#1A1612', hemiI: 0.5, body: '#5A5248', exp: 0.9, bloom: 0.4 }],
];
const ca = new THREE.Color(), cb = new THREE.Color();
function lookAt(T: number) {
  const b = (T - B0) / BAR + 1;
  let i = 0;
  while (i < LOOKS.length - 2 && b > LOOKS[i + 1]![0]) i++;
  const [b0, A] = LOOKS[i]!, [b1, B] = LOOKS[i + 1]!;
  const k = ease.inOutCubic(clamp((b - b0) / (b1 - b0)));
  const col = (x: string, y: string) => ca.set(x).lerp(cb.set(y), k).clone();
  const num = (x: number, y: number) => lerp(x, y, k);
  return {
    top: col(A.top, B.top), bot: col(A.bot, B.bot), fog: col(A.fog, B.fog), fogD: num(A.fogD, B.fogD), sun: col(A.sun, B.sun), sunI: num(A.sunI, B.sunI),
    elev: num(A.elev, B.elev), hemi: col(A.hemi, B.hemi), gnd: col(A.gnd, B.gnd), hemiI: num(A.hemiI, B.hemiI), body: col(A.body, B.body), exp: num(A.exp, B.exp), bloom: num(A.bloom, B.bloom),
  };
}

const CAM: [number, CamKey][] = [
  [27, { pos: [24, 14, 28], tgt: [0, 3, 0], fov: 40 }],
  [31, { pos: [-34, 24, 40], tgt: [0, 6, 0], fov: 40 }],
  [34.5, { pos: [-6, 12, 40], tgt: [0, 8, 0], fov: 50 }],
  [35.2, { pos: [0, 3.4, 27], tgt: [0, 5.5, 0], fov: 62 }],
  [39.2, { pos: [0, 4.6, -8], tgt: [0, 7, -34], fov: 62 }],
  [41, { pos: [10, 27, -30], tgt: [0, 7, 0], fov: 46 }],
  [45, { pos: [-30, 16, -14], tgt: [0, 5, 0], fov: 44 }],
  [48, { pos: [0, 11, 46], tgt: [0, 4, 0], fov: 50 }],
  [49.2, { pos: [0, 8, 60], tgt: [0, 8, -60], fov: 50 }],
];
// Hard cuts through the abandonment and the collapse: low and close, one angle per bar, no fog in the way.
const CUTS: [number, number, CamKey, CamKey][] = [
  [43, 45, { pos: [0, 2.4, 26], tgt: [-5, 9, 0], fov: 56 }, { pos: [0, 3.0, 14], tgt: [5, 10, -4], fov: 60 }],
  [45, 46, { pos: [-36, 2.2, 8], tgt: [0, 7, 0], fov: 40 }, { pos: [-33, 2.4, 4], tgt: [0, 7, 0], fov: 42 }],
  [46, 47, { pos: [0, 1.8, -2], tgt: [9, 9, 5], fov: 64 }, { pos: [0, 2.2, 3], tgt: [9, 10, 2], fov: 66 }],
  [47, 47.5, { pos: [34, 1.6, -6], tgt: [0, 8, 0], fov: 44 }, { pos: [32, 1.8, -3], tgt: [0, 8, 0], fov: 46 }],
];
// Facade tints per tower (stone, blue glass, terracotta, sand, graphite, pale green glass) so the day build isn't white boxes.
const FACADE = ['#F4EEE4', '#9FB6D0', '#C98A6A', '#E2C9A0', '#6E7076', '#A9C4B4'].map((c) => new THREE.Color(c));
export const TALL = { x: 0, z: 0, h: 30 };
function camAt(T: number): CamKey {
  const b = (T - B0) / BAR + 1;
  if (b >= 47.5 && b < 49.05) {
    const k = (b - 47.5) / 1.55, d = 40 - 6 * k;
    const fov = (2 * Math.atan(TALL.h / 0.62 / 2 / d) * 180) / Math.PI;
    return { pos: [TALL.x - d * 0.94, 1.3 + 0.6 * k, TALL.z + d * 0.34], tgt: [TALL.x, TALL.h * 0.48, TALL.z], fov };
  }
  for (const [b0, b1, A, B] of CUTS) if (b >= b0 && b < b1) return mixKey(A, B, (b - b0) / (b1 - b0));
  if (b <= CAM[0]![0]) return CAM[0]![1];
  for (let i = 0; i < CAM.length - 1; i++) {
    const [b0, A] = CAM[i]!, [b1, B] = CAM[i + 1]!;
    if (b <= b1) return mixKey(A, B, ease.inOutCubic((b - b0) / (b1 - b0)));
  }
  return CAM[CAM.length - 1]![1];
}

const SKY_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 uTop, uBot, uSunCol; uniform vec3 uSun; uniform float uT; varying vec3 vDir;
float cn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5), c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * cn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
void main(){ vec3 d = normalize(vDir); float y = d.y; vec3 c = mix(uBot, uTop, smoothstep(-0.02, 0.55, y));
  float s = max(dot(d, normalize(uSun)), 0.0); c += uSunCol * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.35);
  vec2 cp = d.xz / (max(y, 0.0) + 0.12) * 0.9 + vec2(uT * 0.03, uT * 0.01);
  float cov = smoothstep(0.5, 0.78, fbm(cp)) * smoothstep(0.0, 0.12, y);
  vec3 cl = mix(uTop * 0.55 + uBot * 0.35, uBot * 0.9 + uSunCol * 1.4, pow(s, 3.0) * 0.8 + 0.2 * smoothstep(0.6, 0.9, fbm(cp + 0.15)));
  c = mix(c, cl, cov * 0.85);
  gl_FragColor = vec4(c, 1.0); }`;
const DUST_VS = `attribute float aA; attribute float aS; uniform float uScale; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aS * uScale / max(0.1, -mv.z); vA = aA; }`;
const DUST_FS = `uniform vec3 uCol; varying float vA; void main(){ vec2 p = gl_PointCoord - 0.5; float a = exp(-dot(p, p) * 14.0) * vA; if (a < 0.002) discard; gl_FragColor = vec4(uCol, a); }`;

export default class A4City extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 700);
  private layer = new Layer2D();
  private B: Bld[] = [];
  private fl: Instanced[] = [];
  private roofs!: Instanced;
  private cranes!: Instanced;
  private sun = new THREE.DirectionalLight(0xffffff, 3);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sky!: THREE.ShaderMaterial;
  private dust!: THREE.Points;
  private dustMat!: THREE.ShaderMaterial;
  private thread!: THREE.MeshBasicMaterial;
  private ground!: THREE.MeshStandardMaterial;
  private tallest = 0;
  // Engine GPU particles: blackbody embers and ash drifting through the backlit collapse.
  private ash = new LargeParticles(9000, 4512);
  private embers = new LargeParticles(1500, 9127);
  // Pre-fractured floors (Blender city_debris): each floor is swapped for its Voronoi chunks on the frame it lands.
  private chunks: { im: THREE.InstancedMesh; off: THREE.Vector3; ax: THREE.Vector3; w: number }[] = [];
  private brk: { t: number; p: THREE.Vector3; q: THREE.Quaternion; v: THREE.Vector3 }[][] = [];
  private shocks: THREE.Vector3[] = [];
  private debrisMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  private dm = new THREE.Matrix4(); private dp = new THREE.Vector3(); private dq = new THREE.Quaternion();

  /** Closed-form pose of floor i of a falling tower at tau s after it starts to go; returns its height above the rubble. */
  private pose(b: Bld, bi: number, i: number, tau: number, v: THREE.Vector3, q: THREE.Quaternion) {
    const idx = b.fo + i;
    const theta = Math.min(1.25, (bi === this.tallest ? 1.5 : 0.32) * tau * tau);
    const drop = tau > 0.15 ? 0.5 * 6.5 * (tau - 0.15) ** 2 : 0, tauK = clamp(tau);
    const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-Math.sin(b.psi), 0, Math.cos(b.psi)), theta);
    v.set(0, i * FH, 0).applyQuaternion(q2);
    const sep = tau * tau * 0.18 * (i / b.n);
    v.x += Math.cos(b.psi + h(idx, 20) * 2) * sep; v.z += Math.sin(b.psi + h(idx, 21) * 2) * sep;
    const floorY = 0.05 + 1.1 * (i / b.n) * h(idx, 22), free = v.y - drop - floorY;
    v.y = Math.max(floorY, v.y - drop); v.x += b.x; v.z += b.z;
    q.setFromEuler(new THREE.Euler((h(idx, 23) - 0.5) * tauK * 0.8, 0, (h(idx, 24) - 0.5) * tauK * 0.8)).premultiply(q2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot));
    return free;
  }
  private nFloors = 0;
  private world = new CityWorld();
  private v = new THREE.Vector3(); private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion(); private s = new THREE.Vector3();
  private c = new THREE.Color(); private ax = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0); private e = new THREE.Euler();
  override async init() {
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    // Layout: a 15x15 lot grid, the x = 0 column kept open as the avenue the camera flies down.
    const cnt = [0, 0, 0];
    let id = 0, best = 0;
    for (let gx = 0; gx < G; gx++) for (let gz = 0; gz < G; gz++) {
      id++;
      if (gx === 7 || h(id, 1) < 0.1) continue;
      const x = (gx - 7) * CELL + (h(id, 2) - 0.5) * 0.4, z = (gz - 7) * CELL + (h(id, 3) - 0.5) * 0.4;
      const rr = Math.hypot(x, z);
      const n = Math.max(3, Math.min(44, Math.round(3 + 36 * Math.exp(-(rr * rr) / (2 * 13 * 13)) * (0.45 + 0.9 * h(id, 4)))));
      const hv = h(id, 5), v = hv < 0.45 ? 0 : hv < 0.75 ? 1 : 2;
      const rot = v === 2 ? (h(id, 6) < 0.5 ? 0 : Math.PI / 2) : v === 1 ? Math.PI / 8 : 0;
      const sc = v === 0 ? 1.6 + 0.6 * h(id, 7) : v === 1 ? 2.0 + 0.4 * h(id, 7) : 1.5;
      const tb = qBeat(bar(27) + (rr / 32) * 5 * BAR + h(id, 8) * BAR * 0.5, 2);
      this.B.push({ x, z, v, n, rot, sc, r: rr, tb, tc: 0, band: Math.floor(h(id, 9) * 5), psi: h(id, 10) * Math.PI * 2, fo: cnt[v]!, falls: true, crane: false });
      cnt[v]! += n;
      if (n > best) { best = n; this.tallest = this.B.length - 1; }
    }
    this.nFloors = cnt[0]! + cnt[1]! + cnt[2]!;
    // Collapse order: short/random first, the tallest (with the beacon) last; each hit lands on a beat.
    const order = this.B.map((b, i) => ({ i, k: h(i, 12) + (b.n / 44) * 0.9 + (i === this.tallest ? 9 : 0) })).sort((a, b) => a.k - b.k);
    order.forEach((o, rank) => { this.B[o.i]!.tc = qBeat(bar(45) + (rank / Math.max(1, order.length - 1)) * 3.0 * BAR); });
    this.B[this.tallest]!.falls = true;
    this.B[this.tallest]!.psi = Math.atan2(0.94, 0.34);
    this.B[this.tallest]!.tc = qBeat(bar(48.5));
    { const t = this.B[this.tallest]!; TALL.x = t.x; TALL.z = t.z; TALL.h = t.n * FH; }
    [...this.B].sort((a, b) => b.n - a.n).slice(0, 9).forEach((b) => (b.crane = true));
    this.brk = this.B.map((b, bi) => Array.from({ length: b.n }, (_, i) => {
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), p0 = new THREE.Vector3(), q0 = new THREE.Quaternion();
      let tau = 0.2;
      for (; tau < 4; tau += 1 / 60) if (this.pose(b, bi, i, tau, p, q) < 0.02) break;
      this.pose(b, bi, i, tau, p, q); this.pose(b, bi, i, tau - 1 / 60, p0, q0);
      return { t: b.tc + tau, p, q, v: p.clone().sub(p0).multiplyScalar(60) };
    }));
    this.shocks = this.B.map((b, bi) => ({ b, bi })).sort((a, c) => c.b.n - a.b.n).slice(0, 4).map(({ b, bi }) => {
      const L = b.n * FH * 0.8;
      return new THREE.Vector3(b.x + Math.cos(b.psi) * L, b.z + Math.sin(b.psi) * L, b.tc + (bi === this.tallest ? 0.91 : 1.98));
    });

    const inst = await model(this.ctx, 'city_kit');
    const deb = await model(this.ctx, 'city_debris');
    deb.root.updateMatrixWorld(true);
    deb.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const k = this.chunks.length, im = new THREE.InstancedMesh(m.geometry, this.debrisMat, Math.max(1, this.nFloors));
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.setColorAt(0, this.c.set(0xffffff)); im.count = 0;
      this.chunks.push({ im, off: m.getWorldPosition(new THREE.Vector3()), ax: new THREE.Vector3(h(k, 81) - 0.5, h(k, 82) - 0.5, h(k, 83) - 0.5).normalize(), w: 4 + 8 * h(k, 84) });
      this.scene.add(im);
    });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.05 });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pick = (name: string, m: THREE.Material) => (name.toLowerCase().includes('win') ? winMat : name.toLowerCase().includes('steel') ? m : bodyMat);
    VAR.forEach((nm, vi) => {
      const I = new Instanced(inst, Math.max(1, cnt[vi]!), pick, (m) => m.startsWith(nm));
      for (const im of I.meshes) { im.castShadow = true; im.receiveShadow = true; }
      for (let i = 0; i < I.count; i++) I.color(i, this.c.set(0xffffff));
      this.fl.push(I); this.scene.add(I.group);
    });
    this.roofs = new Instanced(inst, this.B.length, pick, (m) => m.startsWith('roof'));
    this.cranes = new Instanced(inst, this.B.length, (_n, m) => m, (m) => m.startsWith('crane'));
    for (const I of [this.roofs, this.cranes]) { for (const im of I.meshes) im.castShadow = true; for (let i = 0; i < I.count; i++) I.color(i, this.c.set(0xffffff)); this.scene.add(I.group); }

    this.sky = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uT: { value: 0 } } });
    const skyM = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), this.sky); skyM.renderOrder = -1; skyM.frustumCulled = false;
    this.ground = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.95 });
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), this.ground); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true;
    // The Thread: an orange power line strung down the avenue on poles, sagging between them.
    const pts: THREE.Vector3[] = [];
    for (let z = -26; z <= 26; z += 0.5) { const u = ((z + 26) % 6.5) / 6.5; pts.push(new THREE.Vector3(1.25, 3.0 - 0.55 * Math.sin(Math.PI * u), z)); }
    this.thread = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.signal) });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.035, 6), this.thread);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
    dg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(ND), 1));
    dg.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(ND), 1));
    this.dustMat = new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color(C.ash) }, uScale: { value: 900 } } });
    this.dust = new THREE.Points(dg, this.dustMat); this.dust.frustumCulled = false;
    // Dark ash flecks against the bright backlit sky, plus a sparse ember layer that flares on every tower impact.
    this.ash.configure({ count: 3000, mode: 'fall', style: 'disc', opaque: true, size: [0.05, 0.16], life: [6, 12], temperature: [0, 1], color: { mode: 'flat', rgb: [0.035, 0.032, 0.03] }, intensity: 1, fade: [0.15, 0.25], turbulence: { amp: 2.2, freq: 0.07, drift: 0.4 }, fall: { center: [0, 14, 0], box: [120, 30, 120], velocity: [1.3, -1.7, 0.5], drag: 0 } });
    this.embers.configure({ count: 500, mode: 'fall', style: 'disc', size: [0.07, 0.2], life: [3, 6], temperature: [0, 1], color: { mode: 'blackbody', range: [1700, 3300] }, intensity: 0, brightnessVariance: 0.7, fade: [0.2, 0.4], turbulence: { amp: 1.6, freq: 0.1, drift: 0.5 }, fall: { center: [0, 6, 0], box: [90, 14, 90], velocity: [0.5, 2.4, 0.2], drag: 0 } });
    void gnd;
    this.scene.add(this.world.group, skyM, tube, this.sun, this.sun.target, this.hemi, this.dust);
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.01);
  }

  private cityTime(t: number) {
    const R = this.ctx.params?.remap as number[] | undefined;
    if (R && R.length === 4) return R[2]! + ((t - R[0]!) / (R[1]! - R[0]!)) * (R[3]! - R[2]!);
    return sceneTime(this.ctx, t);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = this.cityTime(f.t);
    const a = f.a;
    const L = lookAt(T);
    const bands = [a.low, a.bass, a.mid, a.high, a.vocal];
    const night = smoothstep(bar(35), bar(35.8), T);
    const decay = prog(T, bar(41), bar(46), ease.inOutCubic);
    const dustK = prog(T, bar(45), bar(48.5));

    // Look: sky, sun arc, fog, hemisphere.
    const el = (L.elev * Math.PI) / 180, az = -0.9 + 0.5 * prog(T, bar(27), bar(41));
    this.v.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    this.sky.uniforms.uTop!.value.copy(L.top); this.sky.uniforms.uBot!.value.copy(L.bot);
    this.sky.uniforms.uSun!.value.copy(this.v); this.sky.uniforms.uSunCol!.value.copy(L.sun).multiplyScalar(1 - night);
    this.sky.uniforms.uT!.value = T;
    this.world.update(T, { built: prog(T, bar(29), bar(32)), night, decay, collapse: prog(T, bar(45.5), bar(47)), top: L.top, bot: L.bot, sun: this.v, sunCol: this.sky.uniforms.uSunCol!.value, fog: L.fog, fogD: L.fogD, tint: this.c.set(0xffffff).lerp(L.fog, 0.3), shocks: this.shocks });
    this.sun.position.copy(this.v).multiplyScalar(120); this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(L.sun); this.sun.intensity = L.sunI;
    this.hemi.color.copy(L.hemi); this.hemi.groundColor.copy(L.gnd); this.hemi.intensity = L.hemiI;
    const fog = this.scene.fog as THREE.FogExp2; fog.color.copy(L.fog); fog.density = L.fogD;
    this.ground.color.copy(L.gnd).lerp(L.fog, 0.55).multiplyScalar(0.75);

    const moss = new THREE.Color('#5C6B34'), grime = new THREE.Color('#6E716A'), ochre = new THREE.Color('#B9A07A');
    const winCols = [new THREE.Color('#FFB547'), new THREE.Color('#FFB547'), new THREE.Color('#F2E6D0'), new THREE.Color('#46E0FF'), new THREE.Color('#46E0FF')];
    const spark = new THREE.Color(2.2, 0.7, 0.2);
    const glass = L.top.clone().lerp(L.bot, 0.55).multiplyScalar(0.55);
    const TB = (T - B0) / BAR;
    const qf = new THREE.Quaternion(), qr = new THREE.Quaternion();
    this.B.forEach((b, bi) => {
      const I = this.fl[b.v]!;
      const tau = b.falls ? T - b.tc : -1;
      const theta = tau > 0 ? Math.min(1.25, (bi === this.tallest ? 1.5 : 0.32) * tau * tau) : 0;
      const drop = tau > 0.15 ? 0.5 * 6.5 * (tau - 0.15) ** 2 : 0;
      const tauK = Math.min(1, Math.max(0, tau));
      this.ax.set(-Math.sin(b.psi), 0, Math.cos(b.psi));
      this.q.setFromAxisAngle(this.up, b.rot);
      this.q2.setFromAxisAngle(this.ax, theta);
      const lightsOn = smoothstep(bar(35) + (b.r / 32) * BAR, bar(35) + (b.r / 32) * BAR + 0.25, T);
      const lvl = 0.12 + 0.95 * bands[b.band]!;
      for (let i = 0; i < b.n; i++) {
        const idx = b.fo + i;
        const tf = b.tb + i * (BEAT / 2);
        if (T < tf) { I.set(idx, this.v.set(0, -50, 0), this.q, this.s.set(1e-4, 1e-4, 1e-4)); continue; }
        const p = clamp((T - tf) / 0.24);
        this.v.set(0, i * FH + 2.6 * (1 - p) * (1 - p) - 0.05 * Math.sin(Math.PI * p), 0);
        if (tau > 0) {
          this.v.applyQuaternion(this.q2);
          const sep = tau * tau * 0.18 * (i / b.n);
          this.v.x += Math.cos(b.psi + h(idx, 20) * 2) * sep; this.v.z += Math.sin(b.psi + h(idx, 21) * 2) * sep;
          this.v.y = Math.max(0.05 + 1.1 * (i / b.n) * h(idx, 22), this.v.y - drop);
        }
        this.v.x += b.x; this.v.z += b.z;
        const crush = tau > 0 ? Math.max(0.35, 1 - 0.4 * Math.max(0, tau - 1.2)) : 1;
        this.s.set(b.sc, crush, b.sc);
        this.e.set((h(idx, 23) - 0.5) * tauK * 0.8, 0, (h(idx, 24) - 0.5) * tauK * 0.8);
        qf.setFromEuler(this.e).premultiply(this.q2).multiply(this.q);
        if (T >= this.brk[bi]![i]!.t) this.s.setScalar(1e-4);
        I.set(idx, this.v, qf, this.s);
        // Body: clean -> grime + moss creeping up from the street -> dust coat.
        this.c.copy(L.body).multiply(FACADE[Math.floor(h(bi, 77) * FACADE.length)]!);
        const m = decay * 1.3 - i / b.n - h(idx, 25) * 0.25;
        if (m > 0) this.c.lerp(h(idx, 26) < 0.55 ? moss : grime, Math.min(0.85, m * 2));
        if (tau > 0) this.c.lerp(ochre, Math.min(0.8, tau * 0.4));
        I.color(idx, this.c, 'body');
        // Windows: glass by day; at night each facade is one band of the mix; they die one by one on off-beats.
        const td = qBeat(bar(41) + h(idx, 27) * 3.6 * BAR, 2) + BEAT / 4;
        const alive = T < td ? 1 : 0;
        const flick = T > td - 0.14 && T < td ? (Math.sin(T * 90 + idx) > 0 ? 1 : 0.1) : 1;
        const eq = smoothstep(-0.04, 0.04, lvl - (i + 0.5) / b.n);
        const lit = (0.08 + 1.9 * eq * (0.8 + 0.5 * a.kick)) * lightsOn * alive * flick * (1 - tauK);
        this.c.copy(glass);
        if (night < 0.5 && T < tf + 0.3) this.c.lerp(spark, 1 - clamp((T - tf) / 0.3));
        if (night > 0) this.c.multiplyScalar(1 - night).add(ca.copy(winCols[b.band]!).multiplyScalar(lit * night));
        if (decay > 0 && !alive) this.c.multiplyScalar(0.05);
        I.color(idx, this.c, 'win');
      }
      // Roof crown pops on when the last floor lands; the tallest carries the orange beacon.
      const done = b.tb + b.n * (BEAT / 2) + 0.1;
      const rp = clamp((T - done) / 0.3);
      this.v.set(0, b.n * FH, 0);
      if (tau > 0) { this.v.applyQuaternion(this.q2); this.v.y = Math.max(0.3, this.v.y - drop); }
      this.v.x += b.x; this.v.z += b.z;
      const rs = ease.outBack(rp) * (b.v === 2 ? 1.2 : b.sc * 0.55) + 1e-4;
      qr.copy(this.q2).multiply(this.q);
      this.roofs.set(bi, this.v, qr, this.s.set(rs, rs, rs));
      const blink = Math.sin(TB * Math.PI * 2) > 0 ? 1 : 0;
      if (bi === this.tallest) this.c.set(C.signal).multiplyScalar(0.6 + 3 * blink * (0.4 + night + decay));
      else this.c.setScalar(0.25 + 0.8 * night * (1 - decay));
      this.roofs.color(bi, this.c, 'win');
      this.roofs.color(bi, L.body, 'body');
      // Cranes ride the top of the tallest towers while they build, slewing on each downbeat.
      const building = b.crane && T > b.tb - BAR && T < done + BAR * 0.6;
      const top = Math.max(0, Math.min(b.n, Math.floor((T - b.tb) / (BEAT / 2)) + 1)) * FH;
      const cs = building ? 1.7 * ease.outCubic(clamp((T - b.tb + BAR) / 0.4)) * (1 - ease.inCubic(clamp((T - done - BAR * 0.2) / 0.4))) + 1e-4 : 1e-4;
      this.e.set(0, b.psi + 0.6 * Math.floor(TB) + 0.6 * ease.inOutCubic(TB - Math.floor(TB)), 0);
      qr.setFromEuler(this.e);
      this.cranes.set(bi, this.v.set(b.x + b.sc * 0.3, top, b.z), qr, this.s.set(cs, cs, cs));
    });
    for (const I of this.fl) I.commit();
    // Debris: each landed floor is thrown out as its chunks (ballistic, one damped bounce, then they lie as rubble).
    let nd = 0;
    const GR = 6.5;
    this.B.forEach((b, bi) => {
      const bc = this.c.copy(L.body).multiply(FACADE[Math.floor(h(bi, 77) * FACADE.length)]!).lerp(ochre, 0.55);
      for (let i = 0; i < b.n; i++) {
        const br = this.brk[bi]![i]!, t = T - br.t;
        if (t < 0) continue;
        const idx = b.fo + i;
        this.chunks.forEach((ch, k) => {
          const o = this.v.set(ch.off.x * b.sc, ch.off.y, ch.off.z * b.sc).applyQuaternion(br.q), j = idx * 16 + k;
          const hr = Math.hypot(o.x, o.z) + 1e-3, kick = 1.2 + 2.8 * h(j, 85);
          const vx = br.v.x * 0.35 + (o.x / hr) * kick, vz = br.v.z * 0.35 + (o.z / hr) * kick, vy = Math.max(0, br.v.y * 0.2) + 1 + 3 * h(j, 86);
          const y0 = Math.max(0.06, br.p.y + o.y), t1 = (vy + Math.sqrt(vy * vy + 2 * GR * (y0 - 0.05))) / GR;
          let y: number, run: number, spin: number;
          if (t < t1) { y = y0 + vy * t - 0.5 * GR * t * t; run = t; spin = t; }
          else { const tb = t - t1, vb = 0.25 * (GR * t1 - vy), sl = Math.min(tb, 0.5), tt = Math.min(tb, (2 * vb) / GR); y = 0.05 + Math.max(0, vb * tt - 0.5 * GR * tt * tt); run = t1 + 0.35 * sl; spin = t1 + 0.3 * sl; }
          this.dp.set(br.p.x + o.x + vx * run, y, br.p.z + o.z + vz * run);
          this.dq.setFromAxisAngle(ch.ax, ch.w * spin).multiply(br.q);
          ch.im.setMatrixAt(nd, this.dm.compose(this.dp, this.dq, this.s.set(b.sc, 1, b.sc)));
          ch.im.setColorAt(nd, bc);
        });
        nd++;
      }
    });
    for (const ch of this.chunks) { ch.im.count = nd; ch.im.instanceMatrix.needsUpdate = true; if (ch.im.instanceColor) ch.im.instanceColor.needsUpdate = true; }
    this.roofs.commit(); this.cranes.commit();

    // Dust: each collapsing tower exhales a billow from its base that rises and drifts downwind.
    const geo = this.dust.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute, aA = geo.getAttribute('aA') as THREE.BufferAttribute, aS = geo.getAttribute('aS') as THREE.BufferAttribute;
    const fallers = this.B.filter((b) => b.falls);
    for (let i = 0; i < ND; i++) {
      const b = fallers[i % fallers.length]!;
      const age = T - (b.tc + 0.25 + h(i, 30) * 1.2);
      if (age <= 0) { aA.setX(i, 0); continue; }
      const ang = h(i, 31) * Math.PI * 2, spread = (1.5 + 5 * h(i, 32)) * (1 - Math.exp(-age * 0.9));
      pos.setXYZ(i, b.x + Math.cos(ang) * spread + age * 0.9, 0.3 + b.n * FH * 0.6 * h(i, 33) * (1 - Math.exp(-age * 0.7)) + age * 0.25, b.z + Math.sin(ang) * spread);
      aA.setX(i, 0.1 * clamp(age / 0.25) * Math.exp(-age * 0.5) * (0.5 + 0.5 * h(i, 34)));
      aS.setX(i, 2 + 5 * h(i, 35) + age * 0.8);
    }
    pos.needsUpdate = true; aA.needsUpdate = true; aS.needsUpdate = true;
    this.dustMat.uniforms.uCol!.value.copy(L.fog).lerp(ochre, 0.5);

    // The Thread brightens with the vocal at night and keeps glowing after everything else dies.
    this.thread.color.set(C.signal).multiplyScalar(1.2 + night * (1 + 1.5 * a.vocal) * (1 - decay * 0.5) + dustK * 2);
    applyCam(this.cam, camAt(T), a.kick * 0.5 * (1 - night * 0.5) + dustK * a.kick * 2);
    this.dustMat.uniforms.uScale!.value = 1080 / (2 * Math.tan((this.cam.fov * Math.PI) / 360));

    // Ash clears out of the sky before the tallest tower's fall so its silhouette reads; embers burst on each landing.
    const ashK = prog(T, bar(44.5), bar(46), ease.inOutCubic) * (1 - prog(T, bar(48.1), bar(48.5)));
    let hit = 0;
    this.B.forEach((b, bi) => { const d = T - (b.tc + (bi === this.tallest ? 0.91 : 1.98)); if (b.falls && d > 0) hit = Math.max(hit, Math.exp(-d * 2.2)); });
    const emK = prog(T, bar(44.5), bar(45.5)) * (1 - prog(T, bar(49.2), bar(49.8)));
    this.embers.u.uIntensity!.value = emK * (0.35 + 5 * hit);
    const R = this.ctx.renderer;
    const fx = ashK > 0.001 || emK > 0.001 ? () => { if (ashK > 0.001) { this.ash.u.uSize!.value = ashK; this.ash.render(R, this.cam, out, T); } if (emK > 0.001) this.embers.render(R, this.cam, out, T); } : undefined;
    const g = this.layer.ctx; this.layer.clear();
    const cap = this.ctx.params?.caption as string | undefined;
    if (cap) typeLine(g, cap, 960, 980, f.t, (f.start ?? f.t) + 0.3, { size: 34, align: 'center', color: C.bone });
    if (this.ctx.params?.notext) { present(this.ctx, out, this.scene, this.cam, this.layer, fx, 0x050506, overlayTextDuck(f.tin, f.tout)); return { exposure: L.exp, bloom: L.bloom + 0.3 * a.kick, bloomThreshold: 0.9, vignette: 0.5, grain: 0.05, ca: 0.6 + 1.5 * a.kick, zoom: 1 + 0.02 * a.kick }; }
    const fam = F.archivo(115, 900);
    const words = ['BUILT', 'ON', 'THE', 'BEAT'];
    g.font = font(fam, 150);
    let x = 150;
    words.forEach((w, i) => {
      slam(g, w, x, 900, T, { t0: beatAt(29, i), t1: bar(31.5), size: 150, family: fam, align: 'left', from: 1.8, shake: 6, color: i === 3 ? C.signal : C.bone });
      g.font = font(fam, 150); x += g.measureText(w + ' ').width;
    });
    slam(g, 'LIT BY THE MIX', 960, 540, T, { t0: bar(36), t1: bar(38) - 0.05, size: 170, family: fam, from: 2.2, shake: 10, color: '#FFB547' });
    if (T > bar(41.3) && T < bar(45.6)) {
      const yr = 2026 + Math.round(100 * prog(T, bar(41.5), bar(45.2), ease.inOutCubic));
      slam(g, `${yr}`, 960, 965, T, { t0: bar(41.3), t1: bar(45.6), size: 64, family: F.archivo(125, 700), from: 1.2, shake: 0, color: '#D8DCD6' });
    }
    slam(g, 'EVERYTHING IS f(t)', 960, 250, T, { t0: bar(46.5), t1: bar(48.2), size: 122, family: fam, from: 1.45, shake: 8, color: C.bone });

    present(this.ctx, out, this.scene, this.cam, this.layer, fx, 0x050506, overlayTextDuck(f.tin, f.tout));
    const tImp = this.B[this.tallest]!.tc + 0.91, imp = T > tImp ? Math.exp(-(T - tImp) * 9) : 0;
    return { shake: [0.9 * imp, -0.6 * imp], flash: 0.12 * imp, exposure: L.exp, bloom: L.bloom + 0.3 * a.kick * night, bloomThreshold: 0.9, vignette: 0.45 + 0.2 * decay, grain: 0.045 + 0.03 * decay, ca: 0.4 + 1.2 * dustK * a.kick, zoom: 1 + 0.015 * a.kick };
  }

  override dispose(): void {
    this.world.dispose();
    this.debrisMat.dispose(); this.chunks.forEach((c) => c.im.dispose());
    this.ash.dispose();
    this.embers.dispose();
  }
}

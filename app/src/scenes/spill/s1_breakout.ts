// SPILL s1 (0 → 6.43 s, the laugh): the cursor rams the inside of the phone glass on the laugh hits
// (comic impact frames), bursts out, and we cut outside on a pulse: the phone hangs in a sky of screens.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { screenAtlas, screenMaterial } from './screens';
import { RAMS, PULSES, BREAK, DROP, OUTSIDE, clamp, lerp, sm, hash, spring, impactFrame } from './kit';
import { HeroPass } from './hero';

const CUT = PULSES[2];
const GLASS_Z = 0.6, HIT_Z = GLASS_Z - 0.115;
const INK = ['#e8202a', '#ffd21a', '#16b8e8', '#ffffff', '#e8202a', '#ffd21a', '#16b8e8', '#e8202a'];

const WORDS = ['thunk', 'THUNK!!', 'KRAK!', 'SKRSSH', 'FWOOM!', 'WHAM', 'zip', 'zip'];
let noSig: THREE.CanvasTexture | undefined;
function noSignal() {
  if (noSig) return noSig;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const g = cv.getContext('2d')!;
  for (let y = 0; y < 160; y += 3) for (let x = 0; x < 256; x += 3) { const v = Math.floor(30 + 190 * hash(x * 13.1 + y * 7.7)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 3, 3); }
  g.fillStyle = '#0a0a12'; g.fillRect(0, 52, 256, 56); g.fillStyle = '#ffffff'; g.font = 'bold 40px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NO SIGNAL', 128, 81);
  noSig = new THREE.CanvasTexture(cv); noSig.colorSpace = THREE.SRGBColorSpace; noSig.magFilter = THREE.NearestFilter; return noSig;
}
function wordTex(w: string) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const g = cv.getContext('2d')!;
  g.translate(512, 132); g.transform(1, 0, -0.18, 1, 0, 0); g.font = '900 190px Archivo, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.fillStyle = '#0a0a0a'; g.fillText(w, 14, 14); g.lineWidth = 34; g.strokeStyle = '#0a0a0a'; g.strokeText(w, 0, 0);
  const gr = g.createLinearGradient(0, -90, 0, 90); gr.addColorStop(0, '#fff4a0'); gr.addColorStop(1, '#ff8a1a'); g.fillStyle = gr; g.fillText(w, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const QUAD_V = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COMIC_F = /* glsl */ `
uniform sampler2D tScene, tWord; uniform vec2 uRes, uC, uWP; uniform float uImp, uT, uWR, uWS; uniform vec3 uInk; varying vec2 vUv;
float lum(vec2 uv) { vec3 c = texture2D(tScene, uv).rgb; c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
float h1(float n) { return fract(sin(n * 91.345) * 47453.21); }
void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uImp <= 0.0) { gl_FragColor = vec4(col, 1.0); return; }
  vec2 px = 1.5 / uRes; float l = lum(vUv);
  float gx = lum(vUv + vec2(px.x, 0.0)) - lum(vUv - vec2(px.x, 0.0)), gy = lum(vUv + vec2(0.0, px.y)) - lum(vUv - vec2(0.0, px.y));
  float edge = smoothstep(0.05, 0.12, length(vec2(gx, gy)));
  vec2 d = (vUv - uC) * vec2(uRes.x / uRes.y, 1.0); float r = length(d), a = atan(d.y, d.x);
  float id = floor(a * 90.0 / 3.14159 + 0.5 * h1(floor(uT * 30.0)));
  float lines = step(0.7, h1(id + floor(uT * 30.0) * 7.0)) * smoothstep(0.12, 0.45, r * (0.7 + 0.6 * h1(id * 3.1)));
  vec2 hp = gl_FragCoord.xy / 7.0; vec2 cell = fract(mat2(0.707, -0.707, 0.707, 0.707) * hp) - 0.5;
  float dots = step(length(cell), 0.7 * sqrt(clamp(1.0 - l * 1.7, 0.0, 1.0)));
  vec3 ink = vec3(0.02);
  vec3 c = uInk;
  c = mix(c, ink, dots * 0.85);
  c = mix(c, vec3(1.0), smoothstep(0.62, 0.7, l));
  vec3 cc = col / (1.0 + col); float hot = step(0.22, cc.r - cc.b) * step(0.45, cc.r);
  c = mix(c, vec3(1.0, 0.5, 0.06), hot);
  c = mix(c, ink, max(edge, step(l, 0.12)));
  c = mix(c, vec3(1.0) - c * 0.0 , lines * (1.0 - smoothstep(0.42, 0.55, l)) * 0.0);
  c = mix(c, (uInk.r > 0.9 && uInk.g > 0.9 && uInk.b > 0.9) ? ink : vec3(1.0), lines);
  vec2 q = (vUv - uWP) * vec2(uRes.x / uRes.y, 1.0); q = mat2(cos(uWR), sin(uWR), -sin(uWR), cos(uWR)) * q;
  vec2 wu = q / (vec2(0.5, 0.125) * uWS) + 0.5;
  if (wu.x > 0.0 && wu.x < 1.0 && wu.y > 0.0 && wu.y < 1.0) { vec4 w = texture2D(tWord, wu); c = mix(c, w.rgb, w.a); }
  gl_FragColor = vec4(mix(col, c, uImp), 1.0);
}`;
const SKY_F = /* glsl */ `varying vec3 vD; uniform float uT;
void main() { vec3 d = normalize(vD); float y = d.y;
  vec3 top = vec3(0.05, 0.06, 0.28), mid = vec3(0.42, 0.18, 0.5), low = vec3(1.4, 0.45, 0.22);
  vec3 c = mix(low, mid, smoothstep(-0.35, 0.15, y)); c = mix(c, top, smoothstep(0.1, 0.75, y));
  vec2 q = d.xz / max(0.08, abs(d.y) + 0.12) * 0.6; float n = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { n += a * (sin(q.x * 1.7 + sin(q.y * 1.3)) * 0.5 + 0.5) * (sin(q.y * 2.1 + sin(q.x * 0.9)) * 0.5 + 0.5); q = q * 2.03 + 1.7; a *= 0.5; }
  float band = smoothstep(0.32, 0.6, n) * (1.0 - smoothstep(0.0, 0.5, abs(y + 0.05)));
  c = mix(c, vec3(1.5, 0.75, 0.55), band * 0.55);
  // below the horizon: a painted cloud sea, lit peach tops over deep violet troughs (SPILL is under it)
  if (y < 0.02) { vec2 w = d.xz / max(0.03, -y + 0.02) * 2.2 + vec2(0.0, uT * 0.05); float m = 0.0, k = 0.5;
    for (int i = 0; i < 5; i++) { m += k * (sin(w.x * 1.3 + 1.7 * sin(w.y * 0.8)) * 0.5 + 0.5) * (sin(w.y * 1.6 + 1.3 * sin(w.x * 1.1)) * 0.5 + 0.5); w = mat2(0.8, -0.6, 0.6, 0.8) * w * 2.1 + 3.1; k *= 0.5; }
    vec3 trough = vec3(0.16, 0.07, 0.3), top = vec3(1.5, 0.72, 0.5);
    vec3 sea = mix(trough, top, smoothstep(0.3, 0.5, m)); sea += vec3(0.5, 0.2, 0.1) * smoothstep(0.5, 0.56, m); float hz = smoothstep(-0.25, 0.02, y);
    c = mix(sea, c, hz * 0.85); }
  float s = max(0.0, dot(d, normalize(vec3(-0.6, 0.18, -0.75)))); c += vec3(1.6, 0.9, 0.5) * pow(s, 24.0) + vec3(0.5, 0.25, 0.15) * pow(s, 4.0);
  gl_FragColor = vec4(c, 1.0); }`;
const SKY_V = /* glsl */ `varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

type Shard = { o: THREE.Object3D; rest: THREE.Vector3; rq: THREE.Quaternion; d: number; dir: THREE.Vector2; axis: THREE.Vector3; spin: number; v: number };

export default class S1Breakout extends Scene {
  private inS = new THREE.Scene();
  private exS = new THREE.Scene();
  private intRT = new THREE.WebGLRenderTarget(360, 780, { type: THREE.HalfFloatType });
  private intCam = new THREE.PerspectiveCamera(44, 360 / 780, 0.05, 200);
  private cam = new THREE.PerspectiveCamera(30, 9 / 16, 0.05, 4000);
  private insts: GLTFInstance[] = [];
  private cur!: THREE.Object3D; private hero!: HeroPass;
  private curX!: THREE.Object3D;
  private glyphs: THREE.Sprite[] = [];
  private cores: THREE.MeshPhysicalMaterial[] = [];
  private curLight = new THREE.PointLight(0xff7a1e, 3, 0, 2);
  private curLightX = new THREE.PointLight(0xff7a1e, 40, 0, 2);
  private lampLight = new THREE.PointLight(0xffc27a, 10, 0, 2);
  private shards: Shard[] = [];
  private shardMat!: THREE.MeshPhysicalMaterial;
  private crackU = { uProg: { value: 0 }, uT: { value: 0 } };
  private comicU = { uWS: { value: 1 }, tScene: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1080, 1920) }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uImp: { value: 0 }, uT: { value: 0 }, uInk: { value: new THREE.Color() }, tWord: { value: null as THREE.Texture | null }, uWP: { value: new THREE.Vector2(0.5, 0.75) }, uWR: { value: 0 } };
  private words = WORDS.map(wordTex);
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: COMIC_F, uniforms: this.comicU, depthTest: false, depthWrite: false }));
  private qs = new THREE.Scene();
  private bump = new THREE.Group(); private bumpScr!: THREE.MeshBasicMaterial;
  private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private rt: THREE.WebGLRenderTarget | null = null;
  private screens!: THREE.InstancedMesh;
  private glows!: THREE.InstancedMesh;
  private screenT = { value: 0 };
  private screenData: { p: THREE.Vector3; s: THREE.Vector3; r: number; ph: number }[] = [];

  override async init() {
    const r = this.ctx.renderer; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(r); const env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); r.resetState();
    this.inS.environment = env; this.inS.environmentIntensity = 0.12; this.inS.background = new THREE.Color(0.004, 0.003, 0.002);
    this.exS.environment = env; this.exS.environmentIntensity = 0.5;
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [phone, cur, curX, glass, phoneX, glassX] = await Promise.all([load('phone'), load('cursor'), load('cursor'), load('glass'), load('phone'), load('glass')]);
    this.insts = [phone, cur, curX, glass, phoneX, glassX];
    const phys = (m: THREE.Mesh) => { const s = m.material as THREE.MeshStandardMaterial;
      const p = new THREE.MeshPhysicalMaterial({ name: s.name, color: s.color, roughness: s.roughness, metalness: s.metalness });
      m.material = p; return p; };
    // the cell: lamp-lit chip canyon, interior only
    phone.part('exterior').visible = false;
    phone.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const p = phys(m);
      if (p.name === 'Board') { p.color.setRGB(0.09, 0.025, 0.12); p.clearcoat = 0.7; p.clearcoatRoughness = 0.2; }
      if (p.name === 'Chip') { p.color.setRGB(0.12, 0.08, 0.26); p.clearcoat = 0.6; p.clearcoatRoughness = 0.25; }
      if (p.name === 'Phosphor') { p.emissive.setRGB(1, 0.72, 0.4); p.emissiveIntensity = 6; m.castShadow = false; }
      if (p.name === 'Scratch') { p.roughness = 0.12; }
      if (p.name === 'Shield') { p.color.setRGB(0.07, 0.045, 0.16); p.roughness = 0.4; p.clearcoat = 0.6; }
      if (p.name === 'Ribbon') { p.sheen = 0.5; } });
    this.inS.add(phone.root);
    const lamp = phone.part('lampled'); lamp.getWorldPosition(this.lampLight.position); this.lampLight.position.y -= 0.25;
    this.lampLight.castShadow = true; this.lampLight.shadow.mapSize.set(1024, 1024); this.lampLight.shadow.bias = -0.002; this.lampLight.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0x6f86c8, 0.25); fill.position.set(5, 6, 8);
    this.mkFairyLights();
    this.mkUI();
    this.inS.add(this.lampLight, fill, new THREE.HemisphereLight(0x302a40, 0x0a0806, 0.15));
    this.hero = new HeroPass(r); this.hero.dress(cur, { inline: true }); this.hero.dress(curX, { inline: true }); cur.part('scan').scale.set(1, 0.4, 0.35); curX.part('scan').scale.set(1, 0.4, 0.35);
    this.cur = cur.root; this.curLight.position.set(0, 0.5, 0.3); this.cur.add(this.curLight); this.inS.add(this.cur);
    this.curX = curX.root; this.curLightX.position.set(0, 0.5, 0.4); this.curX.add(this.curLightX); this.exS.add(this.curX);
    // the cover glass we are behind: transparent pane + crack ribbons + shards
    const shardMat = this.shardMat = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.04, transmission: 1, thickness: 0.06, ior: 1.52, envMapIntensity: 1.4, clearcoat: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    let si = 0;
    glass.root.position.set(0, 0, GLASS_Z);
    glass.root.traverse((o) => { const m = o as THREE.Mesh;
      if (m.isMesh && o.name === 'cracks') { m.material = this.crackMat(); m.renderOrder = 3; return; }
      if (m.isMesh) { m.material = shardMat; m.renderOrder = 2; }
      if (typeof o.userData.dist !== 'number') return; const i = si++;
      const dir = new THREE.Vector2(o.position.x, o.position.y - 0.5); if (dir.lengthSq() < 1e-6) dir.set(0, 1); dir.normalize();
      this.shards.push({ o, rest: o.position.clone(), rq: o.quaternion.clone(), d: o.userData.dist, dir, axis: new THREE.Vector3(hash(i) - 0.5, hash(i + 7) - 0.5, hash(i + 13) - 0.5).normalize(), spin: (2 + 6 * hash(i + 21)) * (hash(i + 3) < 0.5 ? -1 : 1), v: (5 + 9 * hash(i + 31)) / (1 + o.userData.dist * 0.6) }); });
    this.inS.add(glass.root);
    this.mkOutside(phoneX, glassX, phys);
    this.qs.add(this.quad);
  }

  private crackMat(full = false) {
    const u = full ? { uProg: { value: 99 }, uT: this.crackU.uT } : this.crackU;
    return new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uProg; varying vec2 vUv; void main() { float on = 1.0 - smoothstep(uProg - 0.15, uProg, vUv.x); if (on < 0.01) discard;
        float core = exp(-vUv.y * vUv.y * 30.0), halo = exp(-vUv.y * vUv.y * 4.0) * 0.12, tip = exp(-abs(vUv.x - uProg) * 6.0) * 1.5;
        gl_FragColor = vec4(vec3(0.95, 0.98, 1.0) * (core + halo) * (1.0 + tip) * on * 0.7, 1.0); }` });
  }

  /** the phone's UI turned into architecture: app-icon towers, a status-bar sky, notification bridges, a keyboard terrace.
   *  4-colour palette (ink indigo, violet, cyan, cream) so the cursor is the only orange thing in the cell */
  private mkUI() {
    const INDIGO = '#120c26', VIOLET = '#3b2a72', CYAN = '#38e0d2', CREAM = '#f3e8d2';
    const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; draw(g);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const glyphs: ((g: CanvasRenderingContext2D) => void)[] = [
      (g) => { g.beginPath(); g.roundRect(-60, -40, 120, 85, 16); g.stroke(); g.beginPath(); g.arc(0, 2, 26, 0, Math.PI * 2); g.stroke(); g.fillRect(-30, -56, 34, 16); },
      (g) => { g.beginPath(); g.roundRect(-64, -48, 128, 82, 30); g.stroke(); g.beginPath(); g.moveTo(-30, 30); g.lineTo(-44, 62); g.lineTo(0, 34); g.stroke(); },
      (g) => { g.beginPath(); g.arc(-28, 40, 20, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(36, 26, 20, 0, Math.PI * 2); g.fill(); g.fillRect(-12, -56, 12, 98); g.fillRect(48, -70, 12, 98); g.fillRect(-12, -70, 72, 18); },
      (g) => { for (let k = 0; k < 8; k++) { g.save(); g.rotate(k * Math.PI / 4); g.fillRect(-11, -64, 22, 26); g.restore(); } g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.stroke(); },
      (g) => { g.beginPath(); g.arc(0, -16, 42, Math.PI, 0); g.lineTo(0, 66); g.closePath(); g.stroke(); g.beginPath(); g.arc(0, -16, 14, 0, Math.PI * 2); g.fill(); },
      (g) => { g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -40); g.moveTo(0, 0); g.lineTo(30, 16); g.stroke(); },
      (g) => { g.font = '900 120px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('>_', 0, 6); },
    ];
    const towerTex = (i: number, hU: number) => tex(256, Math.round(256 * hU), (g) => {
      const H = 256 * hU; g.fillStyle = INDIGO; g.fillRect(0, 0, 256, H);
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, i % 2 ? CYAN : VIOLET); gr.addColorStop(1, i % 2 ? VIOLET : '#5a46a8');
      g.fillStyle = gr; g.beginPath(); g.roundRect(20, 20, 216, 216, 54); g.fill();
      g.save(); g.translate(128, 128); g.strokeStyle = g.fillStyle = CREAM; g.lineWidth = 12; g.lineCap = g.lineJoin = 'round'; glyphs[i % glyphs.length](g); g.restore();
      if (i % 3 === 0) { g.fillStyle = '#ff2e63'; g.beginPath(); g.arc(222, 34, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = CREAM; g.font = '700 32px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(1 + (i * 7) % 9), 222, 35); }
      for (let y = 270; y < H - 20; y += 34) for (let x = 26; x < 230; x += 30) { const on = hash(i * 31 + x * 0.7 + y * 1.3); if (on < 0.4) continue; g.fillStyle = on > 0.85 ? CYAN : on > 0.6 ? CREAM : VIOLET; g.globalAlpha = 0.35 + 0.6 * on; g.fillRect(x, y, 16, 18); }
      g.globalAlpha = 1; });
    const towers = [[-2.6, -7.5, 2.0, 1], [-1.3, -9.5, 3.4, 2], [0.2, -8.2, 2.6, 3], [1.6, -10.5, 4.2, 0], [2.9, -7.8, 3.0, 4], [-3.6, -11.5, 4.6, 5], [4.2, -11.0, 5.0, 6], [0.9, -12.5, 5.8, 1], [-0.6, -13.5, 6.4, 3]];
    for (const [x, z, h, gi] of towers) {
      const W = 1.25, t = towerTex(gi, h / W);
      const body = new THREE.Mesh(new RoundedBoxGeometry(W, h, W, 4, 0.22), new THREE.MeshPhysicalMaterial({ color: 0x1a1236, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
      body.position.set(x, h / 2 - 0.05, z); body.castShadow = body.receiveShadow = true; this.inS.add(body);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, h * 0.98), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.4 }));
      face.position.set(x, h / 2 - 0.05, z + W / 2 + 0.005); this.inS.add(face);
    }
    // status-bar sky: the clock, signal and a battery on its last percent
    const sb = tex(2048, 192, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 192); gr.addColorStop(0, 'rgba(18,12,38,0.95)'); gr.addColorStop(1, 'rgba(59,42,114,0.0)'); g.fillStyle = gr; g.fillRect(0, 0, 2048, 192);
      g.fillStyle = CREAM; g.font = '700 110px sans-serif'; g.textBaseline = 'middle'; g.fillText('9:41', 120, 90);
      for (let k = 0; k < 4; k++) { g.globalAlpha = k < 1 ? 1 : 0.3; g.fillRect(1440 + k * 44, 120 - 26 * (k + 1), 30, 26 * (k + 1)); } g.globalAlpha = 1;
      g.strokeStyle = CREAM; g.lineWidth = 12; g.beginPath(); g.roundRect(1660, 46, 230, 92, 22); g.stroke(); g.fillRect(1898, 72, 16, 40);
      g.fillStyle = '#ff2e63'; g.fillRect(1676, 62, 22, 60); g.fillStyle = CYAN; g.font = '700 64px sans-serif'; g.fillText('1%', 1730, 94); });
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), new THREE.MeshBasicMaterial({ map: sb, transparent: true, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }));
    bar.position.set(0.7, 4.05, -6); bar.scale.setScalar(0.32); this.inS.add(bar);
    // notification banners slung between the towers like bridges
    const banner = (title: string, body: string) => tex(1024, 256, (g) => {
      g.fillStyle = 'rgba(243,232,210,0.94)'; g.beginPath(); g.roundRect(8, 8, 1008, 240, 56); g.fill();
      g.fillStyle = VIOLET; g.beginPath(); g.roundRect(44, 56, 144, 144, 34); g.fill(); g.fillStyle = CYAN; g.font = '900 84px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('>_', 116, 132);
      g.textAlign = 'left'; g.fillStyle = INDIGO; g.font = '800 62px sans-serif'; g.fillText(title, 224, 98); g.font = '500 52px sans-serif'; g.globalAlpha = 0.75; g.fillText(body, 224, 172); g.globalAlpha = 1; });
    const bans: [string, string, number, number, number, number][] = [['cursor.exe', 'is not responding', 0.85, 2.75, -3.6, -0.05], ['1 new message', 'let me out', 1.6, 4.9, -11.2, 0.05], ['Storage full', '0 bytes left inside', -1.2, 6.2, -13.0, -0.03]];
    for (const [a, b, x, y, z, r] of bans) {
      const bt = banner(a, b), side = new THREE.MeshStandardMaterial({ color: 0xe8dcc4, roughness: 0.5 });
      const m = new THREE.Mesh(new RoundedBoxGeometry(3.4, 0.85, 0.12, 3, 0.05), [side, side, side, side, new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 }), side]);
      m.position.set(x, y, z); m.rotation.z = r; m.castShadow = true; if (z > -5) m.scale.setScalar(0.6); this.inS.add(m);
    }
    // keyboard terrace: backlit keycaps stepping up behind the chip row
    const KEYS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
    const kcap = new RoundedBoxGeometry(0.42, 0.2, 0.42, 3, 0.07), kmat = new THREE.MeshPhysicalMaterial({ color: 0x3b2a72, roughness: 0.45, clearcoat: 0.5, emissive: 0x1a2a5a });
    const keys = new THREE.InstancedMesh(kcap, kmat, 72), M = new THREE.Matrix4(); let n = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 18; c++) {
      M.makeTranslation(-3.4 + c * 0.47 + r * 0.16, 0.05 + r * 0.22 - 0.04 * hash(r * 19 + c), -3.2 - r * 0.55); keys.setMatrixAt(n++, M); }
    keys.castShadow = keys.receiveShadow = true; this.inS.add(keys);
    for (let r = 0; r < 4; r++) {
      const leg = tex(2048, 128, (g) => { g.fillStyle = CREAM; g.font = '800 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = CYAN; for (let k = 0; k < 18; k++) g.fillText(KEYS[(r * 7 + k) % KEYS.length], (k + 0.5) * 2048 / 18, 66); });
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(0.47 * 18, 0.42), new THREE.MeshBasicMaterial({ map: leg, transparent: true, toneMapped: false, color: new THREE.Color(2, 2, 2), depthWrite: false }));
      lp.renderOrder = 1; lp.rotation.x = -Math.PI / 2; lp.position.set(-3.4 + r * 0.16 + 0.47 * 8.5, 0.05 + r * 0.22 + 0.12, -3.2 - r * 0.55); this.inS.add(lp); }
    const glow = new THREE.PointLight(0x38e0d2, 3, 0, 2); glow.position.set(0.5, 4.5, -10); this.inS.add(glow);
  }

  /** strings of tiny SMD status LEDs slung across the cell: warm practicals and bokeh depth */
  private mkFairyLights() {
    const N = 160, g = new THREE.SphereGeometry(0.035, 8, 6), m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const im = new THREE.InstancedMesh(g, m, N), M = new THREE.Matrix4(), c = new THREE.Color();
    const cols = [[3.5, 1.6, 0.5], [3.5, 1.6, 0.5], [3.2, 0.6, 0.3], [0.6, 3.0, 0.9], [3.5, 2.6, 1.4]];
    for (let i = 0; i < N; i++) {
      const s = i % 4, u = Math.floor(i / 4) / (N / 4 - 1);
      const a = [[-7, 6.5, -1.5], [-6, 7.5, -6], [-7.5, 5.2, -9], [-5, 8.2, -3.5]][s], b = [[7, 6.0, -3], [7, 7.2, -8], [7.5, 6.4, -10], [6, 7.8, -1.2]][s];
      const x = lerp(a[0], b[0], u), z = lerp(a[2], b[2], u), y = lerp(a[1], b[1], u) - 1.6 * Math.sin(Math.PI * u);
      M.makeTranslation(x, y, z); im.setMatrixAt(i, M); const k = cols[Math.floor(hash(i * 3.7) * cols.length)]; im.setColorAt(i, c.setRGB(k[0], k[1], k[2]));
    }
    this.inS.add(im);
    for (let s = 0; s < 4; s++) { const L = new THREE.PointLight(0xffa860, 0.6, 0, 2); L.position.set(lerp(-3, 3, s / 3), 5.6, -2 - 2 * s); this.inS.add(L); }
  }

  /** the outside: our phone hanging in a dusk sky full of other screens */
  private mkOutside(phone: GLTFInstance, glass: GLTFInstance, phys: (m: THREE.Mesh) => THREE.MeshPhysicalMaterial) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, uniforms: { uT: { value: 0 } }, side: THREE.BackSide, depthWrite: false }));
    this.exS.add(sky); this.exS.fog = new THREE.Fog(0x8a4a78, 160, 1100);
    phone.part('interior').visible = false;
    let scrM: THREE.Mesh | null = null;
    phone.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const p = phys(m); m.castShadow = m.receiveShadow = true;
      if (p.name === 'Screen') { scrM = m; p.clearcoat = 1; p.clearcoatRoughness = 0.02; p.color.setRGB(0.004, 0.004, 0.006); p.roughness = 0.04; }
      if (p.name === 'Alu') { p.clearcoat = 0.4; } });
    glass.root.scale.set(0.575, 1.24, 1); glass.root.position.set(0, -0.62, 0.43);
    glass.root.traverse((o) => { const m = o as THREE.Mesh;
      if (m.isMesh && o.name === 'cracks') { m.material = this.crackMat(true); return; }
      if (m.isMesh) m.visible = false;
      if (typeof o.userData.dist === 'number' && o.userData.dist < 1.3) o.visible = false; });
    const hs = new THREE.Shape(); for (let k = 0; k < 15; k++) { const a = k / 15 * Math.PI * 2, rr = 0.55 + 0.6 * hash(k * 4.3); k ? hs.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : hs.moveTo(rr, 0); }
    this.exS.add(phone.root, glass.root); this.exS.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(scrM ?? phone.root), sz = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const uvOf = (g: THREE.BufferGeometry, ox: number, oy: number, sx: number, sy: number) => { const P = g.attributes.position, U = g.attributes.uv;
      for (let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) * sx + ox - bb.min.x) / sz.x, (P.getY(i) * sy + oy - bb.min.y) / sz.y); return g; };
    const win = new THREE.Mesh(uvOf(new THREE.PlaneGeometry(sz.x * 0.97, sz.y * 0.98), ctr.x, ctr.y, 1, 1), new THREE.MeshBasicMaterial({ map: this.intRT.texture, color: new THREE.Color(0.5, 0.44, 0.52), toneMapped: false }));
    win.position.set(ctr.x, ctr.y, 0.437);
    const hole = new THREE.Mesh(uvOf(new THREE.ShapeGeometry(hs), 0, 0, 0.8, 1.0), new THREE.MeshBasicMaterial({ map: this.intRT.texture, color: new THREE.Color(3.2, 2.6, 2.2), toneMapped: false }));
    hole.position.set(0, 0, 0.44); hole.scale.set(0.8, 1.0, 1);
    this.exS.add(win, hole);
    const sun = new THREE.DirectionalLight(0xffc89a, 2.4); sun.position.set(-60, 40, 50);
    this.exS.add(sun, new THREE.HemisphereLight(0x6a6ad0, 0x4a2020, 0.6));
    // hanging screens: phones, monitors, CRTs, cinema screens at every depth, each on a cable from above
    const N = 420, body = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.45, metalness: 0.6 });
    const glowM = screenMaterial(screenAtlas(), this.screenT); const tiles = new Float32Array(N), tints = new Float32Array(N * 3);
    this.screens = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), body, N);
    this.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowM, N);
    const cables = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 5), body, N);
    const pal = [[0.3, 0.8, 1.6], [1.6, 0.5, 0.9], [0.4, 1.5, 0.7], [1.8, 1.2, 0.4], [0.9, 0.6, 1.8], [1.6, 1.6, 1.7], [0.2, 0.5, 1.4]];
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = hash(i * 3.1) * Math.PI * 2, rad = (i % 5 < 2 ? 30 + hash(i * 5.7) * 70 : 60 + Math.pow(hash(i * 5.7), 1.6) * 420);
      const p = new THREE.Vector3(Math.cos(a) * rad, lerp(-850, 140, hash(i * 9.3)), Math.sin(a) * rad + (i % 5 < 2 ? 15 : -40));
      
      const kind = Math.floor(hash(i * 1.7) * 4), sz = [[7, 15, 0.8], [24, 15, 1.5], [14, 11, 10], [80, 36, 2]][i % 5 < 2 ? kind % 3 : kind], k = 0.6 + hash(i * 4.4) * 1.0;
      const s = new THREE.Vector3(sz[0] * k, sz[1] * k, sz[2] * k), r = (hash(i * 6.6) - 0.5) * 0.5;
      const pd = Math.hypot(p.x - 2, p.z - 15); if (pd < 26) { p.x = 2 + (p.x - 2) * 26 / Math.max(pd, 1); p.z = 15 + (p.z - 15) * 26 / Math.max(pd, 1); }
      this.screenData.push({ p, s, r, ph: hash(i * 8.8) * 6 });
      e.set((hash(i * 2.2) - 0.5) * 0.2, Math.atan2(-p.x, 60 - p.z) + r, (hash(i * 7.1) - 0.5) * 0.15); q.setFromEuler(e);
      M.compose(p, q, s); this.screens.setMatrixAt(i, M);
      const off = new THREE.Vector3(0, 0, s.z / 2 + 0.05).applyQuaternion(q);
      M.compose(p.clone().add(off), q, new THREE.Vector3(s.x * 0.9, s.y * 0.88, 1)); this.glows.setMatrixAt(i, M);
      const pc = pal[i % pal.length], dim = 0.35 + 0.65 * hash(i * 3.3); tiles[i] = Math.floor(hash(i * 2.9) * 8) + hash(i * 1.1) * 0.9; tints.set([0.6 + 0.4 * pc[0] * dim, 0.6 + 0.4 * pc[1] * dim, 0.6 + 0.4 * pc[2] * dim], i * 3);
      const L = 600; M.compose(p.clone().add(new THREE.Vector3(0, s.y / 2 + L / 2, 0)), new THREE.Quaternion(), new THREE.Vector3(0.05 + s.x * 0.0015, L, 0.05 + s.x * 0.0015)); cables.setMatrixAt(i, M);
    }
    const pc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 600, 5), body); pc.position.set(0, 7.6 + 300, 0);
    this.glows.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1)); this.glows.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    this.exS.add(this.screens, this.glows, cables, pc);
    this.mkLeak(); this.mkTrail();
  }

  /** blink is its face: steady on while charging, surprise double-blink after the break, terminal 1.06 Hz while falling */
  private fallP(t: number) {
    const d = t - CUT, g = 9, p = new THREE.Vector3(0.9 * d, 0.6 + 4.5 * d - 0.5 * g * d * d, 0.5 + 10 * d);
    const fall = Math.max(0, t - OUTSIDE); p.y -= 18 * fall * fall * fall; p.z -= 2.5 * fall * fall; return p;
  }

  /** Screen Sky depth: near screens whipping past the lens, and one CRT leaking its pixels into the fall */
  private leakPx!: THREE.InstancedMesh; private leakA = new THREE.Vector3(); private leakB = new THREE.Vector3();
  // typed-glyph trail: the cursor leaves a line of terminal characters behind it as it falls
  private mkTrail() {
    const G = '>_$#{}01;~*&', cv = document.createElement('canvas'); cv.width = 64 * G.length; cv.height = 64; const g = cv.getContext('2d')!;
    g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff6a10'; g.shadowBlur = 10; g.fillStyle = '#ffb060';
    for (let i = 0; i < G.length; i++) g.fillText(G[i], 64 * i + 32, 34);
    const base = new THREE.CanvasTexture(cv); base.colorSpace = THREE.SRGBColorSpace; base.repeat.set(1 / G.length, 1);
    for (let i = 0; i < 34; i++) { const tx = base.clone(); tx.offset.x = Math.floor(hash(i * 4.7) * G.length) / G.length; tx.needsUpdate = true;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(2.2, 1.1, 0.5) }));
      this.glyphs.push(sp); this.exS.add(sp); }
  }
  private poseTrail(t: number) {
    const on = sm(OUTSIDE - 0.4, OUTSIDE, t);
    this.glyphs.forEach((sp, i) => { const lag = 0.035 * (i + 1), tt = Math.floor((t - lag) * 15) / 15; const p = this.fallP(tt);
      p.x += 0.5 * (hash(i * 9.1) - 0.5); p.z += 0.5 * (hash(i * 3.3) - 0.5);
      const k = on * (1 - i / this.glyphs.length); sp.position.copy(p); sp.scale.setScalar(2.1 * (0.5 + 0.5 * k));
      (sp.material as THREE.SpriteMaterial).opacity = k * ((Math.floor(t * 15) + i) % 4 === 0 ? 0.55 : 1); sp.visible = k > 0.02; });
  }
  private mkLeak() {
    const atlas = screenAtlas(), N = 26, dm = new THREE.Object3D(), tiles = new Float32Array(N + 1), tints = new Float32Array((N + 1) * 3).fill(1);
    const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.08, 1.08, 0.14).translate(0, 0, -0.08), new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.45, metalness: 0.6 }), N + 1);
    const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), screenMaterial(atlas, this.screenT), N + 1);
    for (let i = 0; i < N; i++) { const ti = 3.15 + 0.13 * i, c = this.fallP(ti), a = hash(i * 5.3) * 6.283, r = 3.2 + 5 * hash(i * 2.9);
      dm.position.copy(c).add(new THREE.Vector3(Math.cos(a) * r, 2 + 4 * hash(i * 7.1), Math.sin(a) * r * 0.6 - 2)); dm.lookAt(c.clone().add(new THREE.Vector3(3, 8, 9)));
      const sc = 1.2 + 1.6 * hash(i * 3.3); dm.scale.set(sc * (hash(i) < 0.4 ? 0.56 : 1.5), sc, sc); dm.updateMatrix(); body.setMatrixAt(i, dm.matrix); glow.setMatrixAt(i, dm.matrix);
      tiles[i] = Math.floor(hash(i * 9.1) * 8) + 0.5 * hash(i * 1.3); }
    this.leakB.copy(this.fallP(4.62)); this.leakA.copy(this.fallP(4.2)).add(new THREE.Vector3(-6.5, 1.5, -5));
    dm.position.copy(this.leakA); dm.lookAt(this.fallP(4.2).add(new THREE.Vector3(3, 8, 9))); dm.rotateZ(0.12); dm.scale.set(7.5, 5.6, 5); dm.updateMatrix();
    body.setMatrixAt(N, dm.matrix); glow.setMatrixAt(N, dm.matrix); tiles[N] = 2;
    glow.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1)); glow.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    body.frustumCulled = glow.frustumCulled = false;
    const P = 320; this.leakPx = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({ toneMapped: false }), P); this.leakPx.frustumCulled = false;
    const pal = [[0.2, 1.6, 0.5], [1.7, 0.4, 1.2], [0.3, 0.9, 1.9], [1.9, 1.5, 0.3], [1.6, 1.6, 1.7]], c = new THREE.Color();
    for (let i = 0; i < P; i++) { const q = pal[Math.floor(hash(i * 4.7) * 5)]; this.leakPx.setColorAt(i, c.setRGB(q[0], q[1], q[2])); }
    this.exS.add(body, glow, this.leakPx);
    { // the screen it glances off mid-fall: a hanging monitor that swings away and drops to static
      const fr = new THREE.Mesh(new THREE.BoxGeometry(6, 3.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5 }));
      this.bumpScr = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, toneMapped: false }); const sc = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.2), this.bumpScr); sc.position.z = 0.26;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 40, 4), new THREE.MeshBasicMaterial({ color: 0x222222 })); wire.position.y = 21.9;
      fr.position.y = 0; this.bump.add(fr, sc, wire); this.bump.position.copy(this.fallP(4.06)).add(new THREE.Vector3(-3.7, -0.4, 0.6)); this.exS.add(this.bump); }
  }

  private poseLeak(t: number) {
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), on = sm(3.3, 3.8, t);
    for (let i = 0; i < this.leakPx.count; i++) { const u = (t * 0.55 + hash(i * 3.1)) % 1, j = new THREE.Vector3(hash(i * 1.7) - 0.5, hash(i * 2.3) - 0.5, hash(i * 5.9) - 0.5).multiplyScalar(2.4 + 5 * u);
      p.copy(this.leakA).lerp(this.leakB, u * 1.4).add(j); p.y -= 6 * u * u; const k = on * Math.min(1, u * 8) * (1 - u) * 1.6; s.setScalar(k);
      M.compose(p, q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.floor(u * 8) * 0.4), s); this.leakPx.setMatrixAt(i, M); }
    this.leakPx.instanceMatrix.needsUpdate = true;
  }

  private blink(t: number) {
    if (t > 4.06 && t < 4.42) return Math.floor((t - 4.06) / 0.09) % 2 ? 1 : 0.06;
    if (t < BREAK) return (t > 0.5 && t < 0.68) || (t > 1.08 && t < 1.24) ? 0.05 : 1;
    if (t < BREAK + 0.25) return 1;
    const d = t - (BREAK + 0.25);
    if (d < 0.36) return Math.floor(d / 0.09) % 2 ? 1 : 0.12;
    return ((t * 1.06) % 1) < 0.55 ? 1 : 0.12;
  }

  private poseIn(t: number) {
    const c = this.cur; let z: number, y = 0, sq = 1, lean = 0, rx = 0;
    if (t < 0) { z = -1.4 + 0.9 * t; sq = 1 + 0.05 * Math.sin(t * 9); lean = -0.18 * sm(-0.4, 0, t); }
    else if (t < RAMS[0]) { const u = t / RAMS[0]; z = lerp(-1.4, HIT_Z, u * (0.55 + 0.45 * u)); sq = 1 + 0.22 * u; lean = -0.18; }
    else if (t < BREAK) {
      const k = t < RAMS[1] ? 0 : 1, d = t - RAMS[k], u = d / (RAMS[k + 1] - RAMS[k]), back = [1.25, 1.9][k];
      z = HIT_Z - back * 4 * u * (1 - u); sq = 1 - 0.55 * Math.exp(-d * 15) + 0.28 * sm(0.55, 0.95, u); lean = -0.2 * sm(0.4, 0.9, u) + 0.25 * Math.exp(-d * 10);
      y = 0.12 * Math.max(0, Math.sin(Math.PI * u)) * (k + 1);
    } else { const d = t - BREAK; z = HIT_Z + 7 * d; y = 1.6 * d - 2 * d * d; sq = 1 + 0.35 * Math.exp(-d * 6) - 0.5 * Math.exp(-d * 30); rx = -0.45 * Math.sin(d * 3.2); }
    c.position.set(0, y, z); c.rotation.set(lean + rx, 0.08 * Math.sin(t * 3), 0);
    const s = Math.max(0.35, sq); c.scale.set(1 / Math.sqrt(s), 1 / Math.sqrt(s), s);
    const hitP = RAMS.map((h) => t >= h ? 1 : 0).reduce((a: number, b) => a + b, 0);
    this.crackU.uProg.value = [0, 0.9, 2.4, 40][hitP] + (hitP > 0 && hitP < 3 ? 0.6 * (1 - Math.exp(-(t - RAMS[hitP - 1]) * 6)) : 0);
    this.shardMat.opacity = t < BREAK ? 0.03 : 0.9; this.shardMat.transmission = t < BREAK ? 0 : 1;
    for (const sh of this.shards) {
      const d = t - BREAK - sh.d * 0.025;
      sh.o.visible = t >= BREAK;
      if (d <= 0) { sh.o.position.copy(sh.rest); sh.o.quaternion.copy(sh.rq); continue; }
      sh.o.position.set(sh.rest.x + sh.dir.x * d * sh.v * 0.35, sh.rest.y + sh.dir.y * d * sh.v * 0.35 - 2.5 * d * d, sh.rest.z + d * sh.v);
      sh.o.quaternion.setFromAxisAngle(sh.axis, sh.spin * d).premultiply(sh.rq);
    }
  }

  private camIn(t: number) {
    const hit = RAMS.reduce((a, h) => a + Math.max(0, spring(t - h, 40, 9)) * (h === BREAK ? 0.08 : 0.04), 0);
    const push = sm(0, BREAK, t), d = Math.max(0, t - BREAK);
    this.cam.fov = 38 - 6 * push + 10 * sm(0, 0.6, d);
    const cy = this.cur.position.y;
    const dr = 0.3 * t; // constant drift so the loop's held tail flows into frame 0
    this.cam.position.set(0.9 - 0.4 * push + hit + 0.6 * d - dr, 1.0 + 0.1 * push + 0.85 * cy, 4.6 - 1.0 * push + 7.4 * d - hit * 4 - dr);
    this.cam.lookAt(0.0, 0.9 * (1 - sm(0, 0.3, d)) + cy, lerp(-2.0, this.cur.position.z, sm(0, 0.25, d)));
    return this.cam.position.z - this.cur.position.z;
  }

  /** outside: the cursor tumbles out of the hole toward us, then falls past the screens */
  private poseOut(t: number) {
    const d = t - CUT, c = this.curX, p = this.fallP(t);
    const jolt = t > 4.06 ? Math.max(0, spring(t - 4.06, 30, 6)) : 0, flip = sm(4.72, 4.95, t);
    c.position.copy(p); c.scale.set(3.4 * (1 + 0.3 * jolt), 3.4 * (1 - 0.35 * jolt), 3.4 * (1 + 0.3 * jolt));
    { const rx = -0.55 * Math.sin(d * 2.4) - 3.1 * flip, ry = 0.5 * Math.sin(d * 1.7), rz = 2.2 * d + 0.6 * Math.sin(d * 3) + 1.6 * flip, fo = sm(4.75, 5.3, t), sn = (a: number) => lerp(a, Math.round(a / Math.PI) * Math.PI, fo);
      c.rotation.set(sn(rx), sn(ry), sn(rz)); }
    this.poseLeak(t); this.poseTrail(t);
    { const be = t - 4.06, sw = be > 0 ? Math.exp(-be * 2.2) * Math.sin(be * 7) : 0; this.bump.rotation.set(0.25 * sw, 0, -0.45 * sw - (be > 0 ? 0.12 : 0));
      const ns = be > 0 ? noSignal() : null; if (this.bumpScr.map !== ns) { this.bumpScr.map = ns; this.bumpScr.needsUpdate = true; } if (ns) ns.offset.set(0.02 * (hash(Math.floor(be * 30)) - 0.5), 0);
      this.bumpScr.color.setHex(be > 0 ? (Math.floor(be * 30) % 2 ? 0xffffff : 0xb8c0c8) : 0x3fd0ff); }
    const wide = sm(0, 0.9, d), dive = sm(OUTSIDE + 0.2, OUTSIDE + 1.4, t);
    const cam = new THREE.Vector3(lerp(3, 14, wide), lerp(1.5, 4, wide), lerp(18, 58, wide));
    const follow = new THREE.Vector3(p.x + 3, p.y + 6, p.z + 9);
    this.cam.position.copy(cam.lerp(follow, dive)); this.cam.fov = lerp(34, 46, dive);
    this.cam.lookAt(lerp(p.x * 0.6, p.x, dive), lerp(p.y * 0.6 - 1, p.y - 3, dive), lerp(p.z * 0.5, p.z, dive));
    return this.cam.position.distanceTo(p);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, rr = this.ctx.renderer, inside = t < CUT;
    let focus: number;
    if (inside) { this.poseIn(t); focus = this.camIn(t); } else focus = this.poseOut(t);
    this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix();
    const dbl = t > 4.55 && t < 4.85 && ((t - 4.55) * 13.3) % 2 < 1 ? 0 : 1; const b = this.blink(t) * dbl; this.hero.update(t, b);
    this.curLight.intensity = 0.2 + 1.6 * b; this.curLightX.intensity = 5 + 45 * b;
    this.lampLight.intensity = 2.2 * (1 - 0.6 * Math.max(0, ...RAMS.map((h) => Math.exp(-Math.max(0, t - h) * 20) * (t >= h ? 1 : 0))));
    this.screenT.value = t; const imp = impactFrame(t);
    if (!inside) {
      this.intCam.position.set(0.5, 1.05, 3.4); this.intCam.lookAt(0, 0.9, -2); this.cur.visible = false; for (const sh of this.shards) sh.o.visible = false;
      rr.setRenderTarget(this.intRT); rr.setClearColor(0, 1); rr.clear(); rr.render(this.inS, this.intCam); this.cur.visible = true;
    }
    const sc = inside ? this.inS : this.exS;
    if (imp.k > 0) {
      if (!this.rt || this.rt.width !== out.width || this.rt.height !== out.height) { this.rt?.dispose(); this.rt = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType }); }
      rr.setRenderTarget(this.rt); rr.setClearColor(0, 1); rr.clear(); rr.render(sc, this.cam);
      const cp = (inside ? this.cur : this.curX).getWorldPosition(new THREE.Vector3()).project(this.cam);
      Object.assign(this.comicU.uC.value, { x: cp.x * 0.5 + 0.5, y: cp.y * 0.5 + 0.5 }); this.comicU.uRes.value.set(out.width, out.height);
      this.comicU.tScene.value = this.rt.texture; this.comicU.uImp.value = imp.k; this.comicU.uT.value = t; this.comicU.uInk.value.set(INK[imp.i]);
      this.comicU.tWord.value = this.words[imp.i]; this.comicU.uWR.value = (hash(imp.i * 7.3) - 0.5) * 0.5; this.comicU.uWS.value = [0.7, 1.4, 1.15][imp.i] ?? 1;
      this.comicU.uWP.value.set(clamp(this.comicU.uC.value.x + (imp.i % 2 ? -0.08 : 0.08), 0.42, 0.58), clamp(this.comicU.uC.value.y + 0.24, 0.62, 0.8));
      rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc);
    } else { rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(); rr.render(sc, this.cam); }
    rr.resetState();
    const kick = Math.max(0, ...[...RAMS, ...PULSES].map((h) => (t >= h ? Math.exp(-(t - h) * 12) : 0)));
    return { toneMap: imp.k > 0 ? 'legacy' : 'aces', exposure: inside ? 1.0 : 1.0, bloom: inside ? 0.12 : 0.2, bloomThreshold: 1.2, halation: 0.15, vignette: 0.45, grain: 0.04, blackPoint: 0.01,
      ca: 0.2 + 1.4 * kick, shake: [26 * kick * Math.sin(t * 97) + (t < RAMS[0] ? 5 * Math.sin(t * 131) : 0), 26 * kick * Math.cos(t * 83) + (t < RAMS[0] ? 4 * Math.cos(t * 117) : 0)], zoom: 1 + 0.05 * kick,
      depthDof: imp.k > 0 ? undefined : { enabled: true, focusDistance: focus, aperture: inside ? 9 : 4, blades: 9, maxRadius: 22, near: 0.05, far: 4000 } };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.rt?.dispose(); this.intRT.dispose(); }
}
void DROP; void clamp;

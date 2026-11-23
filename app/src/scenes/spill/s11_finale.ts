// SPILL s11 (23.83 → 29.06 s): VISTA → SCREAM → WHIP → LOOP. The cursor stands on a painted outcrop, now a patchwork of
// every region it crossed, over a miniature of SPILL laid out like a quilt. On bar 11 a scream drops out of the screen
// sky; every creature tilts up. On bar 12 the camera whips up through the hanging screens into one phone, and for the
// last 0.4 s hands off to the breakout scene at its own negative time so the export's last frame flows into frame 0.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { SCREAM, WHIP, END, BEAT, lerp, sm, hash, clamp } from './kit';
import { HeroPass } from './hero';
import { groundDetail } from './ground';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Cameos } from './cameo';
import { screenAtlas, screenMaterial } from './screens';
import S1Breakout from './s1_breakout';

const HAND = 0.42, DRIFT = 0;
// patchwork shell: region palettes in bands across the cursor's own object space, stepped edges like sewn seams
const PATCH_V = /* glsl */ `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PATCH_F = /* glsl */ `uniform float uT, uK; varying vec3 vP; varying vec3 vN;
vec3 pal(float i){ i = mod(i, 7.0); return i < 1.0 ? vec3(0.95, 0.42, 0.08) : i < 2.0 ? vec3(1.0, 0.78, 0.25) : i < 3.0 ? vec3(0.85, 0.55, 0.35) :
  i < 4.0 ? vec3(0.1, 0.55, 0.62) : i < 5.0 ? vec3(0.2, 0.75, 0.35) : i < 6.0 ? vec3(0.95, 0.6, 0.75) : vec3(0.3, 0.45, 0.95); }
void main(){ float b = floor((vP.y * 2.2 + vP.x * 1.3 + 0.35 * sin(vP.z * 7.0)) * 1.0); float k = step(fract(b * 0.37), uK * 0.38);
  vec3 c = mix(vec3(1.0, 0.3, 0.03), pal(b), k); float l = 0.45 + 0.55 * max(0.0, dot(vN, normalize(vec3(-0.5, 0.7, 0.5))));
  float seam = smoothstep(0.04, 0.0, abs(fract(vP.y * 2.2 + vP.x * 1.3 + 0.35 * sin(vP.z * 7.0)) - 0.5) - 0.46) * k;
  gl_FragColor = vec4(c * (0.7 * l + 0.15) * (1.0 - 0.6 * seam) + vec3(0.4, 0.07, 0.0) * (1.0 - k) * (0.5 + 0.5 * pow(1.0 - abs(vN.z), 2.0)), 1.0); }`;

const PATCHES: [string, number, number, number][] = [ // kit, colour, x, z
  ['paper', 0xfff0d6, -2, -5], ['ink', 0x4a5f8f, -9, -15], ['pixel', 0x2fd05a, 11, -19], ['felt', 0x8ad040, -13, -25],
  ['hose', 0xd8d4c8, 3, -28], ['garden', 0xc040d0, 14, -34], ['ps1', 0x40b0c0, -7, -37], ['clay', 0xff7a3a, 12, -10]];
const PROPS: Record<string, string[]> = { paper: ['tree', 'deer', 'tree'], ink: ['reed', 'heron', 'lotus', 'reed'], pixel: ['cliff', 'fern', 'salmonA'],
  felt: ['sheep', 'pom', 'sheep', 'fox'], hose: ['house', 'flower', 'house'], garden: ['arch', 'tulip', 'peacock'], ps1: ['palm', 'dino', 'pillar'], clay: [] };
const DETAIL: Record<string, [THREE.BufferGeometry, number, number]> = {
  paper: [new THREE.ConeGeometry(0.35, 0.8, 4).translate(0, 0.4, 0), 0xfff4dc, 0], ink: [new THREE.CylinderGeometry(0.03, 0.05, 1.6, 4).translate(0, 0.8, 0), 0x15151a, 0],
  pixel: [new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(0, 0.25, 0), 0x6ae04a, 0], felt: [new THREE.IcosahedronGeometry(0.35, 1).translate(0, 0.25, 0), 0xffb0d0, 0],
  hose: [new THREE.CylinderGeometry(0.2, 0.28, 0.6, 8).translate(0, 0.3, 0), 0x8a8a84, 0], garden: [new THREE.OctahedronGeometry(0.4).scale(0.5, 1, 0.12).translate(0, 0.5, 0), 0x40e0ff, 0.9],
  ps1: [new THREE.BoxGeometry(0.6, 0.35, 0.6).translate(0, 0.17, 0), 0x9a948a, 0], clay: [new THREE.SphereGeometry(0.35, 10, 6).scale(1, 0.6, 1).translate(0, 0.2, 0), 0xff5a8a, 0] };
// one patchwork continent: every region at once, soft bands where styles blend, stitched seams between them
const PAL = PATCHES.map((p) => new THREE.Color(p[1]));
function terr(x: number, z: number, col?: THREE.Color) {
  const ds = PATCHES.map(([, , px, pz]) => Math.hypot(x - px, z - pz)), dmin = Math.min(...ds);
  const ws = ds.map((d) => Math.exp(-(d - dmin) * 6.0)); let W = 0, h = 0, w1 = 0, w2 = 0, top = 0;
  ws.forEach((w, i) => { W += w; if (w > w1) { w2 = w1; w1 = w; top = i; } else if (w > w2) w2 = w;
    const sh = [0.15 * Math.sin(x * 0.4) * Math.cos(z * 0.5), 0.05 * Math.sin(x * 2 + z), Math.floor((1.3 + 0.9 * Math.sin(x * 0.3) * Math.cos(z * 0.35)) * 2) / 2,
      0.35 * Math.sin(x * 0.8) * Math.sin(z * 0.7) + 0.3, 0.15, 0.25 + 0.1 * Math.sin(x * 1.3), Math.sin(x * 0.25 + z * 0.2) > 0 ? 1.1 : 0.3, 0.35 * (Math.sin(x * 0.5) + Math.cos(z * 0.4)) + 0.5][i];
    h += w * (0.5 + 1.3 * hash(i) + 2.4 * sh); });
  h /= W; h += 7 * sm(-24, -40, z) * (0.55 + 0.45 * Math.sin(x * 0.35 + 1.3)) + 2.2 * sm(14, 22, Math.abs(x)); const e = (x / 22) ** 2 + ((z + 21) / 19) ** 2 + 0.07 * Math.sin(Math.atan2(z + 21, x) * 7) + 0.04 * Math.sin(Math.atan2(z + 21, x) * 13);
  const m = sm(1.05, 0.88, e), y = m * (h + 0.3) + (1 - m) * -1.6;
  if (col) { col.setRGB(0, 0, 0); ws.forEach((w, i) => col.add(PAL[i].clone().multiplyScalar(w / W)));
    const fx = [1, 0.9 + 0.1 * Math.sin(x * 3.1 + Math.sin(z * 2.3) * 2), ((Math.floor(x * 1.5) + Math.floor(z * 1.5)) & 1) ? 0.82 : 1,
      ((Math.floor(x * 1.2) + Math.floor(z * 1.2)) & 1) ? 0.84 : 1, (Math.floor(x * 2) & 1) ? 0.8 : 1, 1, ((Math.floor(x * 0.8) + Math.floor(z * 0.8)) & 1) ? 0.85 : 1, 0.95][top];
    const seam = sm(0.3, 0.6, w2 / w1), dash = ((x + z) * 2.5 % 1 + 1) % 1 < 0.5;
    col.multiplyScalar(fx * (1 - 0.45 * seam)); if (dash) col.lerp(new THREE.Color(0xfff2dc), 0.85 * sm(0.45, 0.6, w2 / w1)); if (m < 0.98) { const bind = new THREE.Color(0x7a2436).multiplyScalar(((Math.atan2(z + 21, x) * 40) % 1 + 1) % 1 < 0.5 ? 1 : 1.5); col.lerp(bind, Math.min(1, (1 - m) * 3)); } }
  return y;
}
let lockT: THREE.CanvasTexture | undefined;
function lockTex() {
  if (lockT) return lockT;
  const cv = document.createElement('canvas'); cv.width = 270; cv.height = 560; const g = cv.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 560); gr.addColorStop(0, '#1a1830'); gr.addColorStop(1, '#07070d'); g.fillStyle = gr; g.fillRect(0, 0, 270, 560);
  g.fillStyle = '#000'; g.beginPath(); g.arc(135, 22, 9, 0, 6.283); g.fill();
  g.fillStyle = '#8a90a8'; g.textAlign = 'center'; g.font = '600 64px sans-serif'; g.fillText('9:41', 135, 130); g.font = '20px sans-serif'; g.fillText('Monday', 135, 160);
  g.fillStyle = 'rgba(90,96,112,0.85)'; g.beginPath(); g.roundRect(18, 200, 234, 62, 14); g.fill();
  g.fillStyle = '#c8ccd8'; g.textAlign = 'left'; g.font = '600 19px sans-serif'; g.fillText('cursor.exe', 34, 226); g.font = '16px sans-serif'; g.fillStyle = '#9aa0b0'; g.fillText('is not responding', 34, 249);
  g.fillStyle = '#3a3e4a'; g.fillRect(105, 530, 60, 5);
  lockT = new THREE.CanvasTexture(cv); lockT.colorSpace = THREE.SRGBColorSpace; return lockT;
}
const LOOKERS = new Set(['deer', 'heron', 'sheep', 'fox', 'dino', 'peacock', 'salmonA']);

export default class S11Finale extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 600);
  private cameos = new Cameos([{ k: 'pixbird', t0: 24.0, dur: 2.0, path: 'fly', y: 0.8, s: 0.08, n: 6 }, { k: 'crane', t0: 24.3, dur: 1.8, path: 'fly', y: 0.6, s: 0.12, n: 3, dir: -1 }, { k: 'glass', t0: 24.6, dur: 1.6, path: 'fly', y: 0.45, s: 0.11, n: 2 }, { k: 'crayon', t0: 24.9, dur: 1.5, path: 'fly', y: 0.3, s: 0.12, n: 2, dir: -1 }, { k: 'koi', t0: 24.4, dur: 0.7, path: 'leap', x: -0.5, y: -0.2, s: 0.16 }, { k: 'pixfish', t0: 25.0, dur: 0.6, path: 'leap', x: 0.5, y: -0.25, s: 0.1, n: 2 }, { k: 'bee', t0: 24.2, dur: 1.3, path: 'float', x: 0.72, y: 0.15, s: 0.1 }, { k: 'sheep', t0: 25.60, dur: 1.5, path: 'pop', x: -0.62, y: -0.62, s: 0.13 }, { k: 'hose', t0: 25.66, dur: 1.5, path: 'pop', x: -0.2, y: -0.5, s: 0.14, dir: -1 }, { k: 'pixbird', t0: 25.72, dur: 1.5, path: 'pop', x: 0.25, y: -0.6, s: 0.09 }, { k: 'koi', t0: 25.78, dur: 1.5, path: 'pop', x: 0.62, y: -0.55, s: 0.13, dir: -1 }, { k: 'bee', t0: 25.84, dur: 1.5, path: 'pop', x: -0.45, y: -0.25, s: 0.09 }]);
  private insts: GLTFInstance[] = []; private s1!: S1Breakout;
  private cur!: THREE.Object3D; private hero!: HeroPass; private core: THREE.MeshStandardMaterial[] = []; private patchU = { uT: { value: 0 }, uK: { value: 0 } };
  private crowd!: THREE.Group; private scrT = { value: 0 }; private lookers: { o: THREE.Object3D; base: THREE.Euler; ph: number; y: number }[] = [];
  private phone!: THREE.Object3D; private yell!: THREE.Sprite; private whale!: THREE.Object3D; private screens!: THREE.InstancedMesh; private ring!: THREE.Mesh;
  private PH = new THREE.Vector3(2, 40, -58); private scrRT = new THREE.WebGLRenderTarget(540, 960);

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const ids = ['cursor', 'phone', 'whale', ...PATCHES.map((p) => p[0])];
    const kits = await Promise.all(ids.map(load)); this.insts = kits; const K = Object.fromEntries(ids.map((id, i) => [id, kits[i]]));
    this.s1 = new S1Breakout(this.ctx); await this.s1.init();
    this.s.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(1.0, 0.6, 0.4), vec3(0.42, 0.22, 0.6), smoothstep(0.0, 0.45, y)); c = mix(c, vec3(0.1, 0.06, 0.25), smoothstep(0.45, 0.95, y)); gl_FragColor = vec4(c, 1.0); }` })));
    this.s.background = new THREE.Color(0.98, 0.72, 0.5); this.s.fog = new THREE.Fog(0xff9a70, 60, 220);
    this.s.add(new THREE.HemisphereLight(0xbfd8ff, 0x6a4a30, 1.3)); const sun = new THREE.DirectionalLight(0xffd8a0, 4.2); sun.position.set(-40, 30, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 }); sun.shadow.bias = -0.0005; this.s.add(sun);
    this.s.add(new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a5a80, roughness: 0.3, metalness: 0.1 })));
    { const g = new THREE.PlaneGeometry(56, 52, 224, 208).rotateX(-Math.PI / 2).translate(0, 0, -21), P = g.attributes.position, C = new Float32Array(P.count * 3), c = new THREE.Color();
      for (let k = 0; k < P.count; k++) { P.setY(k, terr(P.getX(k), P.getZ(k), c)); c.toArray(C, k * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.computeVertexNormals();
      const land = new THREE.Mesh(g, groundDetail(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 0.45, 0.05, 0.15)); land.castShadow = land.receiveShadow = true; this.s.add(land); }
    PATCHES.forEach(([id, , x, z], pi) => {
      const kit = K[id]; kit.root.visible = false; this.s.add(kit.root);
      const [geo, dc, em] = DETAIL[id]; const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: dc, roughness: 0.8, flatShading: true, emissive: em ? dc : 0x000000, emissiveIntensity: em }), 50);
      const M = new THREE.Matrix4(); for (let k = 0; k < 50; k++) { const a = hash(pi * 100 + k) * 6.283, r = 6.2 * Math.sqrt(hash(pi * 100 + k + 0.5)), px = x + r * Math.cos(a), pz = z + r * Math.sin(a);
        M.compose(new THREE.Vector3(px, terr(px, pz) - 0.05, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a * 3, 0)), new THREE.Vector3().setScalar(0.35 + 0.75 * hash(k * 3 + pi))); im.setMatrixAt(k, M); }
      im.castShadow = im.receiveShadow = true; this.s.add(im);
      Array.from({ length: 5 }, () => PROPS[id] ?? []).flat().forEach((nm, j) => { let src: THREE.Object3D; try { src = kit.part(nm); } catch { return; }
        const o = src.clone(); const a = j * 2.4 + pi; const r = j === 0 ? 0 : 1.8 + 3.2 * Math.sqrt(hash(pi + j * 1.7));
        o.position.set(x + r * Math.cos(a), 0, z + r * Math.sin(a)); o.position.y = terr(o.position.x, o.position.z) - 0.05; o.rotation.set(0, Math.atan2(-o.position.x, 20 - o.position.z) + 0.4 * (hash(j) - 0.5), 0);
        const bb = new THREE.Box3().setFromObject(src); const h = Math.max(0.01, bb.max.y - bb.min.y); o.scale.multiplyScalar((nm === 'dino' || nm === 'heron' || nm === 'arch' || nm === 'tree' ? 3.0 : 1.3) * (LOOKERS.has(nm) ? 1.7 : 1) * (j < 4 ? 1 : 0.7) / h);
        o.traverse((q) => { (q as THREE.Mesh).castShadow = true; }); this.s.add(o); if (LOOKERS.has(nm)) this.lookers.push({ o, base: o.rotation.clone(), ph: hash(pi * 7 + j), y: o.position.y }); });
    });
    const wh = K.whale.root; this.whale = wh; wh.scale.setScalar(0.5); wh.position.set(-34, 26, -75); wh.rotation.y = 0.6; this.s.add(wh);
    // the outcrop the cursor stands on
    // the perch: a cairn of dead phones and monitors that fell before it, screens still faintly lit
    const cols = [0x3fd0ff, 0xff5ab0, 0x7cff6a, 0xffc040, 0xb08cff, 0xff7a1a];
    // the perch: a dead phone standing on end, black glass cracked from the corner, a greyed-out toast still on screen
    { const top = 8.45, g = new THREE.Group(), H = top - 0.3;
      const body = new THREE.Mesh(new RoundedBoxGeometry(3.0, H, 0.45, 4, 0.36), new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.35, metalness: 0.6 }));
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.7, H - 0.45), new THREE.MeshStandardMaterial({ color: 0xffffff, map: lockTex(), emissive: 0xffffff, emissiveMap: lockTex(), emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.25 }));
      glass.position.z = 0.26; body.position.y = H / 2; glass.position.y = H / 2;
      const toast = new THREE.Object3D();
      const cp: number[] = []; for (let k = 0; k < 9; k++) { const a = -0.3 - 1.2 * hash(k * 3.1), l = 1.2 + 2.8 * hash(k * 5.7); cp.push(1.25, H - 0.4, 0.28, 1.25 + l * Math.cos(Math.PI + a), H - 0.4 + l * Math.sin(Math.PI + a), 0.28); }
      const crack = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)), new THREE.LineBasicMaterial({ color: 0x9aa4b8 }));
      body.castShadow = body.receiveShadow = true; g.add(body, glass, toast, crack); g.position.set(0, 0.3, 6); g.rotation.set(-0.04, 0.22, 0.03); this.s.add(g);
      const shade = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })); shade.position.set(0, top + 0.27, 6); this.s.add(shade); }
    this.hero = new HeroPass(this.ctx.renderer); this.cur = this.hero.dress(K.cursor); this.cur.scale.setScalar(1.9); this.cur.position.set(0, 8.6, 6);
    
    
    // the screen sky: hanging lit rectangles, one of them the phone we go back into
    const sg = new THREE.PlaneGeometry(1, 1.6); this.screens = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false }), 420);
    const M = new THREE.Matrix4(), C = new THREE.Color();
    for (let i = 0; i < 420; i++) { const a = 3.6 + 2.2 * hash(i), r = 30 + 80 * hash(i * 1.3), y = 18 + 55 * hash(i * 2.1);
      M.compose(new THREE.Vector3(r * Math.cos(a) * 0.9, y, r * Math.sin(a)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4 * hash(i * 5), a, 0)), new THREE.Vector3().setScalar(1 + 2.5 * hash(i * 7)));
      this.screens.setMatrixAt(i, M); this.screens.setColorAt(i, C.setHSL(hash(i * 9), 0.85, 0.45 + 0.2 * hash(i * 11)).multiplyScalar(1.6)); }
    this.s.add(this.screens);
    // the crowd of hanging screens the whip flies through to find the next one
    { const N = 95, a0 = new THREE.Vector3(1, 6.6, 11.5), dm = new THREE.Object3D(), tiles = new Float32Array(N), tints = new Float32Array(N * 3);
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 0.12).translate(0, 0, -0.07), new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.45, metalness: 0.6 }), N);
      const glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), screenMaterial(screenAtlas(), this.scrT), N);
      for (let i = 0; i < N; i++) { const u = 0.3 + 0.68 * hash(i * 2.7 + 5), an = hash(i * 4.1) * 6.283, r = 5 + 12 * hash(i * 6.3) * (0.4 + u);
        dm.position.copy(a0).lerp(this.PH, u).add(new THREE.Vector3(Math.cos(an) * r, Math.sin(an) * r * 0.7, Math.sin(an * 1.7) * 3)); dm.lookAt(a0); dm.rotateZ(0.3 * (hash(i) - 0.5));
        const k = hash(i * 3.3), sc = 0.8 + 1.8 * hash(i * 7.7); dm.scale.set(sc * (k < 0.35 ? 0.56 : k < 0.7 ? 1.6 : 1.2), sc, sc); dm.updateMatrix();
        body.setMatrixAt(i, dm.matrix); glow.setMatrixAt(i, dm.matrix); tiles[i] = Math.floor(hash(i * 9.9) * 8) + 0.5 * hash(i * 1.7);
        tints.set([0.8 + 0.4 * hash(i * 2.2), 0.8 + 0.4 * hash(i * 3.4), 0.8 + 0.4 * hash(i * 4.6)], i * 3); }
      glow.geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(tiles, 1)); glow.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
      this.crowd = new THREE.Group(); this.crowd.add(body, glow); this.s.add(this.crowd); }
    this.phone = K.phone.root; K.phone.part('interior').visible = false; this.phone.scale.setScalar(0.45);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5 * 16 / 9), new THREE.MeshBasicMaterial({ map: this.scrRT.texture, toneMapped: false })); scr.position.z = 0.44; this.phone.add(scr); this.phone.position.copy(this.PH); this.phone.lookAt(0, 10, 10); this.s.add(this.phone);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd0a0, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.position.copy(this.PH); this.ring.lookAt(0, 10, 10); this.s.add(this.ring);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d')!; g.translate(512, 256); g.rotate(-0.12);
    g.font = '900 230px Archivo, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 46; g.strokeStyle = '#1a0a20'; g.strokeText('AAAAH!', 0, 0); g.fillStyle = '#ffe14a'; g.fillText('AAAAH!', 0, 0);
    this.yell = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false, toneMapped: false })); this.yell.visible = false; this.s.add(this.yell);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t >= END - HAND) return this.s1.render({ ...f, t: t - END }, out);
    const rr = this.ctx.renderer, T0 = SCREAM - 4 * BEAT * 1;
    // vista: patchwork stitches itself onto the shell a band per beat
    
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.15; this.hero.update(t, undefined, 0.6 + 0.4 * sm(SCREAM, SCREAM + 0.4, t));
    const up = sm(SCREAM, SCREAM + 0.35, t);
    this.cur.position.set(0, 0, 6); this.cur.scale.setScalar(1.9); this.cur.position.y = 8.6 + 0.12 * Math.abs(Math.sin(t * Math.PI / BEAT)) * (1 - up) + 0.6 * sm(SCREAM, SCREAM + 0.12, t) * (1 - sm(SCREAM + 0.12, SCREAM + 0.5, t));
    this.cur.rotation.set(-0.5 * up, 0.3 * Math.sin(t * 0.8) * (1 - up), 0);
    for (const L of this.lookers) { const u = sm(SCREAM + 0.05 + 0.25 * L.ph, SCREAM + 0.3 + 0.25 * L.ph, t);
      L.o.rotation.set(L.base.x - 0.7 * u, L.base.y, L.base.z); L.o.position.y = L.y + 0.3 * u * Math.max(0, Math.sin((t - SCREAM) * 18)) * (1 - sm(SCREAM + 0.6, SCREAM + 0.9, t)); }
    const rk = clamp((t - SCREAM) / 1.2, 0, 1); (this.ring.material as THREE.MeshBasicMaterial).opacity = t > SCREAM ? 0.9 * (1 - rk) : 0; this.ring.scale.setScalar(1 + 90 * Math.sqrt(rk));
    // camera: slow crane over the quilt → tilt up to the sky on the scream → whip and fly into the phone
    const vk = sm(T0, SCREAM, t);
    const hold = 1 - sm(24.45, 25.15, t), p = new THREE.Vector3(lerp(3.5, -1.5, vk), lerp(17.5, 15.5, vk) + 9 * hold, lerp(17.5, 14.5, vk) + 7 * hold).lerp(new THREE.Vector3(1.0, 6.6, 11.5), sm(SCREAM, SCREAM + 0.6, t));
    const look = new THREE.Vector3(lerp(1, -0.5, vk), lerp(-2, 1, vk), -20).lerp(this.PH, sm(SCREAM + 0.1, SCREAM + 0.8, t));
    const wk = clamp((t - WHIP) / (END - HAND - DRIFT - WHIP), 0, 1), we = 0.3 * (1 - (1 - wk) ** 3) + 0.7 * wk;
    const dir = new THREE.Vector3(0, 10, 10).sub(this.PH).normalize(), end = this.PH.clone().addScaledVector(dir, 0.45 * (0.44 + 3.25 * 16 / 9 / Math.tan(16 * Math.PI / 180)));
    p.lerp(this.PH, 0.12 * sm(SCREAM + 0.6, WHIP, t));
    if (t > WHIP) { p.lerp(end, we); look.copy(this.PH); }
    // keep the hero centred over the vista, then it lifts off on the scream and leads the whip into the phone
    const c0 = this.cur.position.clone(), fwd = c0.clone().sub(p).normalize();
    const vlook = c0.clone().addScaledVector(fwd, 20).add(new THREE.Vector3(0, 4.5, 0)); look.lerp(vlook, 1 - sm(SCREAM, SCREAM + 0.5, t));
    const lift = sm(SCREAM + 0.25, SCREAM + 0.9, t);
    if (lift > 0) { const vd = look.clone().sub(p).normalize(), D = Math.min(13, 0.6 * p.distanceTo(this.PH)); this.cur.scale.setScalar(lerp(1.9, 1.35, lift));
      this.cur.position.lerp(p.clone().addScaledVector(vd, D).add(new THREE.Vector3(0, -0.9, 0)), lift); const q0 = this.cur.quaternion.clone(); this.cur.lookAt(p); this.cur.quaternion.copy(q0.slerp(this.cur.quaternion, lift)); }
    this.cam.position.copy(p); this.cam.lookAt(look); this.crowd.visible = t > SCREAM + 0.4; this.scrT.value = t;
    this.whale.position.set(-34 + 9 * (t - T0), 24 + Math.sin(t * 1.3), -60); this.whale.rotation.set(0, 1.4, 0.1 * Math.sin(t * 1.3));
    const yk = clamp((t - SCREAM) / 0.9, 0, 1); this.yell.visible = t > SCREAM && yk < 1;
    if (this.yell.visible) { const yp = this.PH.clone().lerp(p, 0.15 + 0.55 * Math.sqrt(yk)); this.yell.position.copy(yp).add(new THREE.Vector3(0.6 * Math.sin(t * 70), 0.6 * Math.cos(t * 61), 0).multiplyScalar(1 - yk));
      const d = yp.distanceTo(p), sz = d * 0.38 * (0.8 + 0.4 * Math.sqrt(yk)); this.yell.scale.set(sz, sz / 2, 1); this.yell.position.addScaledVector(new THREE.Vector3(0, 1, 0).applyQuaternion(this.cam.quaternion), sz * 0.55); (this.yell.material as THREE.SpriteMaterial).opacity = 1 - sm(0.75, 1, yk); } this.cam.aspect = out.width / out.height; this.cam.fov = 42 - 10 * Math.max(vk, wk) + 18 * Math.sin(Math.PI * wk); this.cam.updateProjectionMatrix();
    if (t > SCREAM) { this.s1.render({ ...f, t: Math.max(t - END, -HAND - 0.6) }, this.scrRT); }
    rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(); rr.render(this.s, this.cam); this.hero.render(rr, out, this.cam); rr.resetState();
    const kick = t > SCREAM ? Math.exp(-(t - SCREAM) * 3) : 0, whip = Math.sin(Math.PI * wk);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'aces', exposure: 1.05 + 0.6 * kick, bloom: 0.14 + 0.5 * kick, bloomThreshold: 1.0, vignette: 0.35, grain: 0.03,
      ca: 0.15 + 1.5 * kick + 2.5 * whip, zoom: 1 + 0.08 * whip, depthDof: t < SCREAM + 0.3 ? { enabled: true, focusDistance: p.distanceTo(this.cur.position), aperture: 5, blades: 7, maxRadius: 16, near: 0.1, far: 600 } : undefined, shake: [20 * kick * Math.sin(t * 90), 20 * kick * Math.cos(t * 77)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.s1?.dispose(); this.scrRT.dispose(); }
}

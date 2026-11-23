// SPILL s8 (18.61 → 20.35 s): RUBBER-HOSE TOWN. The cursor bounces down a 1930s cartoon street where every house,
// flower and lamp squashes on the beat; a pie-eyed cat with boneless hose limbs strolls past and tips its hat.
// Look: 3-tone B/W toon + ink outline hulls, one red tint, the cursor's ember is the only other colour; film pass with
// grain, scratches, dust, gate weave, flicker, iris vignette. Animation on 12s, limbs rebuilt as bezier hoses.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, BEAT, lerp, sm, hash, stepped, clamp } from './kit';
import { Cameos } from './cameo';

const T0 = bar(7), T1 = bar(8), CS = 1.4;
const QUAD_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const TOON_V = /* glsl */ `uniform float uOut; varying vec3 vN, vW; void main(){ vec3 p = position + normal * uOut; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const TOON_F = /* glsl */ `uniform vec3 uCol; uniform float uOut, uGlow; uniform vec3 uGlowP; varying vec3 vN, vW;
void main(){ if (uOut > 0.0) { gl_FragColor = vec4(0.02, 0.02, 0.02, 1.0); return; }
  vec3 N = normalize(vN), L = normalize(vec3(-0.55, 0.75, 0.45)); float d = dot(N, L);
  float s = d > 0.35 ? 1.0 : d > -0.2 ? 0.72 : 0.45; vec3 c = uCol * s;
  float g = uGlow / (1.0 + 0.5 * dot(vW - uGlowP, vW - uGlowP)); c += g * vec3(1.0, 0.42, 0.06);
  gl_FragColor = vec4(c, 1.0); }`;
const FILM_F = /* glsl */ `uniform sampler2D tCol; uniform float uT, uF; uniform vec2 uRes; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){ vec3 c = texture2D(tCol, vUv).rgb; float L = dot(c, vec3(0.3, 0.59, 0.11));
  float red = clamp((c.r - max(c.g, c.b)) * 3.0, 0.0, 1.0);
  vec3 bw = vec3(L) * vec3(1.0, 0.97, 0.9); vec3 o = mix(bw, c, red);
  vec2 px = vUv * uRes; float fr = floor(uT * 12.0);
  o += (h(floor(px / 2.0) + fr) - 0.5) * 0.12;
  float sx = h(vec2(fr, 3.0)); if (abs(vUv.x - sx) < 0.0012 && h(vec2(fr, 5.0)) > 0.4) o *= 0.55;
  float sx2 = h(vec2(fr, 7.0)); if (abs(vUv.x - sx2) < 0.0008 && h(vec2(fr, 9.0)) > 0.6) o += 0.3;
  for (int i = 0; i < 4; i++) { vec2 dp = vec2(h(vec2(fr, float(i))), h(vec2(float(i), fr))); float r = length((vUv - dp) * vec2(uRes.x / uRes.y, 1.0)); if (r < 0.004 + 0.004 * h(dp)) o *= 0.2; }
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.6; float iris = smoothstep(1.05, 0.55, length(q));
  gl_FragColor = vec4(o * iris * uF, 1.0); }`;

const COLS: Record<string, [number, number, number]> = { HoseBlack: [0.07, 0.07, 0.07], HoseWhite: [0.95, 0.94, 0.9], HoseGrey: [0.55, 0.54, 0.52], HoseTint: [0.85, 0.2, 0.17] };
export default class S8Hose extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.3, 300);
  private cameos = new Cameos([{ k: 'glass', t0: 18.7, dur: 1.6, path: 'fly', y: 0.55, s: 0.13, n: 3, dir: -1 }, { k: 'pixbird', t0: 19.3, dur: 1.0, path: 'fly', y: 0.8, s: 0.08, n: 3 }]);
  private insts: GLTFInstance[] = [];
  private G = { uGlow: { value: 0 }, uGlowP: { value: new THREE.Vector3() } };
  private bobs: { o: THREE.Object3D; ph: number; k: number }[] = []; private mouths: THREE.Object3D[] = [];
  private cat!: THREE.Object3D; private catHead!: THREE.Object3D; private hat!: THREE.Object3D; private gloves: THREE.Object3D[] = []; private shoes: THREE.Mesh[] = [];
  private limbs: THREE.Mesh[] = []; private limbM!: THREE.ShaderMaterial;
  private cur!: THREE.Object3D; private coreM!: THREE.MeshLambertMaterial;
  private rt: THREE.WebGLRenderTarget | null = null; private filmU = { tCol: { value: null as THREE.Texture | null }, uT: { value: 0 }, uF: { value: 1 }, uRes: { value: new THREE.Vector2() } };
  private qs = new THREE.Scene(); private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private TIP = T0 + 0.75;
  private toon(c: [number, number, number], out = 0) { return new THREE.ShaderMaterial({ vertexShader: TOON_V, fragmentShader: TOON_F, side: out ? THREE.BackSide : THREE.FrontSide,
    uniforms: { uCol: { value: new THREE.Vector3(...c) }, uOut: { value: out }, ...this.G } }); }
  private ink(o: THREE.Object3D, w = 0.035) { const ms: THREE.Mesh[] = []; o.traverse((x) => { if ((x as THREE.Mesh).isMesh) ms.push(x as THREE.Mesh); });
    const ol = this.toon([0, 0, 0], w); for (const m of ms) { const n = (m.material as THREE.Material).name; m.material = this.toon(COLS[n] ?? [0.6, 0.6, 0.6]); const h = new THREE.Mesh(m.geometry, ol); m.add(h); } return o; }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('hose'), load('cursor')]); this.insts = [kit, cur];
    this.s.background = new THREE.Color(0.86, 0.85, 0.82);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), this.toon([0.62, 0.6, 0.58])); ground.rotation.x = -Math.PI / 2; this.s.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 6), this.toon([0.4, 0.4, 0.4])); road.rotation.x = -Math.PI / 2; road.position.y = 0.01; this.s.add(road);
    for (let i = 0; i < 30; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.25), this.toon([0.95, 0.94, 0.9])); d.rotation.x = -Math.PI / 2; d.position.set(-30 + 3.2 * i, 0.02, 0); this.s.add(d); }
    const house = kit.part('house'), flower = kit.part('flower');
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) { const h = this.ink(house.clone(), 0.06); h.position.set(-16 + 5 * i + side * 1.2, 0, side * 7.5); h.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
      h.scale.setScalar(1.1 + 0.3 * hash(i + side * 9)); this.s.add(h); this.bobs.push({ o: h, ph: (i % 2) * Math.PI, k: 0.1 }); }
    for (let i = 0; i < 26; i++) { const side = -1; const fl = this.ink(flower.clone(), 0.025); fl.position.set(-16 + 1.7 * i, 0, side * (3.4 + 1.6 * hash(i))); fl.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
      fl.scale.setScalar(0.8 + 0.4 * hash(i * 3)); this.s.add(fl); this.bobs.push({ o: fl, ph: i * 0.8, k: 0.16 }); fl.traverse((x) => { if (x.name.startsWith('fMouth')) this.mouths.push(x); }); }
    for (let i = 0; i < 7; i++) { const c = new THREE.Group(); for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2 + 0.6 * hash(i * 4 + k), 20, 12), this.toon([0.97, 0.96, 0.93])); b.position.set(1.6 * k - 2.4, 0.5 * hash(k + i), 0); b.add(new THREE.Mesh(b.geometry, this.toon([0, 0, 0], 0.08))); c.add(b); }
      c.position.set(-25 + 9 * i, 13 + 4 * hash(i), -30); this.s.add(c); this.bobs.push({ o: c, ph: i, k: 0.08 }); }
    this.cat = this.ink(kit.part('cat')); this.catHead = kit.part('catHead'); this.hat = kit.part('hat'); this.s.add(this.cat);
    this.limbM = this.toon([0.06, 0.06, 0.06]);
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), this.limbM); this.s.add(m); this.limbs.push(m); }
    for (let i = 0; i < 2; i++) { const g = this.ink(kit.part('glove').clone(), 0.02); this.s.add(g); this.gloves.push(g);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10).scale(1.5, 0.7, 1), this.toon([0.07, 0.07, 0.07])); this.s.add(sh); this.shoes.push(sh); }
    kit.root.visible = false; this.s.add(kit.root);
    this.coreM = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color(1.6, 0.4, 0.02) });
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
      m.material = n === 'Core' ? this.coreM : new THREE.MeshLambertMaterial({ color: n === 'Shell' ? 0x16141c : 0x050505, transparent: n === 'Shell', opacity: 0.45, depthWrite: n !== 'Shell' }); });
    this.cur = cur.root; this.cur.scale.setScalar(CS);
    const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(-20, 30, 15); this.s.add(this.cur, sun, new THREE.HemisphereLight(0xffffff, 0x666666, 1));
    this.qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: FILM_F, uniforms: this.filmU, depthTest: false, depthWrite: false })));
  }

  private hoseTo(i: number, a: THREE.Vector3, b: THREE.Vector3, bend: THREE.Vector3, r: number) {
    const c = a.clone().lerp(b, 0.5).add(bend); this.limbs[i].geometry.dispose();
    this.limbs[i].geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 16, r, 8, false); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 12), rr = this.ctx.renderer, ph = (ts - T0) / BEAT, beat = ph * Math.PI * 2;
    for (const b of this.bobs) { const s = Math.sin(beat + b.ph); b.o.scale.y = (b.o.userData.s0 ??= b.o.scale.y) * (1 + b.k * s); b.o.rotation.z = 0.06 * Math.sin(beat * 0.5 + b.ph); }
    for (const m of this.mouths) m.scale.set(1, 1 + 0.6 * Math.abs(Math.sin(beat)), 1 + 1.2 * Math.abs(Math.sin(beat)));
    // cursor bounces down the street on every beat
    const cx = lerp(-13, 13, (ts - T0) / (T1 - T0)), hop = Math.abs(Math.sin(beat / 2));
    const cp = new THREE.Vector3(cx, 0.75 + 2.4 * hop, 0.4); this.cur.position.copy(cp);
    const sq = Math.max(0, 1 - hop * 4); this.cur.scale.set(CS * (1 + 0.35 * sq), CS * (1 - 0.3 * sq + 0.15 * hop), CS); this.cur.rotation.z = 0.15 * Math.cos(beat / 2);
    const dbl = t > this.TIP + 0.1 && t < this.TIP + 0.5 ? (Math.floor((t - this.TIP - 0.1) * 10) % 2 === 0 ? 1 : 0.1) : ((t * 1.06) % 1) < 0.55 ? 1 : 0.12;
    this.coreM.emissive.setRGB(1.6 * dbl, 0.4 * dbl, 0.02 * dbl); this.G.uGlow.value = 1.2 * dbl; this.G.uGlowP.value.copy(cp);
    // the cat: boneless stroll toward the cursor, head follows it, tips its hat as it passes
    const catX = 1.5 - 1.6 * (ts - T0), step = beat; this.cat.position.set(catX, 0.15 * Math.abs(Math.sin(step)), 2.4); this.cat.rotation.set(0, Math.PI - 0.5, 0.06 * Math.sin(step));
    this.cat.scale.set(1.35, 1.35 * (1 + 0.06 * Math.sin(step * 2)), 1.35);
    this.catHead.rotation.y = clamp(Math.atan2(cp.z - 2.4, -(cp.x - catX)) * 0.6, -0.9, 0.9); this.catHead.rotation.z = 0.12 * Math.sin(step);
    const tip = sm(this.TIP - 0.15, this.TIP + 0.05, ts) * (1 - sm(this.TIP + 0.55, this.TIP + 0.75, ts));
    this.hat.position.y = 3.2 * 0 + 0.55 * tip; this.hat.rotation.z = -0.5 * tip;
    this.cat.updateMatrixWorld(true); const W = (x: number, y: number, z: number) => this.cat.localToWorld(new THREE.Vector3(x, y, z));
    for (const s of [1, -1]) { const i = s > 0 ? 0 : 1, sw = Math.sin(step + (s > 0 ? 0 : Math.PI));
      const sh = W(0.05, 1.8, s * 0.55); const hand = s > 0 && tip > 0.01 ? W(0.15, 1.2 + 2.4 * tip, s * (0.75 - 0.45 * tip)).lerp(W(0.4 * sw, 1.0, s * 0.9), 1 - tip) : W(0.45 * sw, 1.0, s * 0.95);
      this.hoseTo(i, sh, hand, new THREE.Vector3(0, 0.3, 0).add(W(0, 0, s * 0.35).sub(W(0, 0, 0))), 0.09); this.gloves[i].position.copy(hand); this.gloves[i].rotation.set(0, this.cat.rotation.y + Math.PI, s * 0.6);
      const hip = W(0, 0.7, s * 0.22), foot = W(0.45 * sw, 0.12 + 0.25 * Math.max(0, Math.cos(step + (s > 0 ? 0 : Math.PI))), s * 0.3);
      this.hoseTo(2 + i, hip, foot, W(0.35, 0, 0).sub(W(0, 0, 0)), 0.1); this.shoes[i].position.copy(foot); this.shoes[i].rotation.y = this.cat.rotation.y + Math.PI; }
    // camera: low dolly along the street, cat in the foreground
    this.cam.position.set(cx - 6, 2.3, 5.0); this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(cx + 2, 2.0, 0.3);
    if (!this.rt || this.rt.width !== out.width || this.rt.height !== out.height) { this.rt?.dispose(); this.rt = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType }); }
    rr.setRenderTarget(this.rt); rr.clear(); rr.render(this.s, this.cam);
    const fr = Math.floor(t * 12); this.filmU.tCol.value = this.rt.texture; this.filmU.uT.value = t; this.filmU.uF.value = 0.93 + 0.07 * hash(fr); this.filmU.uRes.value.set(out.width, out.height);
    rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc); rr.resetState();
    const gw = 3 * (hash(fr * 1.3) - 0.5);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'legacy', exposure: 1.0, bloom: 0.15, bloomThreshold: 1.0, vignette: 0.0, grain: 0.0, ca: 0.0, shake: [gw, 2 * gw] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.rt?.dispose(); for (const l of this.limbs) l.geometry.dispose(); }
}

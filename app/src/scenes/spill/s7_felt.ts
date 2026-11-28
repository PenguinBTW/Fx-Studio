// SPILL s7 (16.87 → 18.61 s): FELT MEADOW. The cursor drops off the falls onto a felt-sheep stampede and surfs one
// across the meadow while a knitted fox herds the flock and pom-pom shrubs squash as they pass. Felt look: 6 fur
// shells per mesh (noise-discarded fibres), wrap lighting + fuzzy rim, fabric creep jitter, everything on 12 fps.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, stepped, clamp } from './kit';
import { HeroPass } from './hero';
import { Cameos } from './cameo';

const T0 = bar(6), T1 = bar(7), CS = 1.4, NS = 34;
const FELT_V = /* glsl */ `attribute float wool; uniform float uShell, uLen; varying vec3 vN, vW, vP, vC; varying float vWool;
void main(){ mat4 M = modelMatrix;
#ifdef USE_INSTANCING
  M = M * instanceMatrix;
#endif
  vec3 c = color;
#ifdef USE_INSTANCING_COLOR
  c = mix(c, c * instanceColor, wool);
#endif
  vC = c; vWool = wool; vP = position; vec3 p = position + normal * uShell * uLen * (0.35 + 0.65 * wool);
  vec4 w = M * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(M) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FELT_F = /* glsl */ `uniform float uShell, uCreep, uGlow; uniform vec3 uGlowP; varying vec3 vN, vW, vP, vC; varying float vWool;
float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){ vec3 q = floor(vP * mix(40.0, 70.0, vWool) + uCreep); float n = h3(q);
  if (uShell > 0.0 && n < 0.15 + 0.8 * uShell) discard;
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(vec3(-0.55, 0.75, 0.45));
  float d = max(0.0, (dot(N, L) + 0.45) / 1.45); float rim = pow(1.0 - max(0.0, dot(N, V)), 2.2);
  vec3 col = vC * (0.32 * vec3(0.75, 0.82, 1.0) + 1.0 * d * vec3(1.0, 0.92, 0.8));
  col *= 0.55 + 0.45 * uShell + 0.08 * (n - 0.5); col += rim * 0.35 * (vC + 0.25) * vec3(1.0, 0.95, 0.9);
  float g = uGlow / (1.0 + 2.5 * dot(vW - uGlowP, vW - uGlowP)); col += g * vec3(1.0, 0.42, 0.06) * (0.4 + 0.6 * max(0.0, dot(N, normalize(uGlowP - vW))));
  gl_FragColor = vec4(col, 1.0); }`;

class Fur {
  readonly meshes: THREE.InstancedMesh[] = [];
  private m4 = new THREE.Matrix4();
  constructor(geo: THREE.BufferGeometry, count: number, mats: THREE.ShaderMaterial[], parent: THREE.Object3D) {
    const base = new THREE.InstancedMesh(geo, mats[0], count); base.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    for (let i = 0; i < mats.length; i++) { const m = i === 0 ? base : new THREE.InstancedMesh(geo, mats[i], count);
      if (i) { m.instanceMatrix = base.instanceMatrix; m.instanceColor = base.instanceColor; }
      m.frustumCulled = false; this.meshes.push(m); parent.add(m); } }
  set(i: number, p: THREE.Vector3, r: THREE.Euler, s: THREE.Vector3) { this.m4.compose(p, new THREE.Quaternion().setFromEuler(r), s); this.meshes[0].setMatrixAt(i, this.m4); }
  color(i: number, c: THREE.Color) { this.meshes[0].setColorAt(i, c); }
  flush() { this.meshes[0].instanceMatrix.needsUpdate = true; if (this.meshes[0].instanceColor) this.meshes[0].instanceColor.needsUpdate = true; }
}

// bake a GLB part (all child meshes) into one geometry with per-vertex material colour + a wool flag
function bake(part: THREE.Object3D, woolMats: string[]) {
  part.updateMatrixWorld(true); const inv = part.matrixWorld.clone().invert(); const gs: THREE.BufferGeometry[] = [];
  part.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); const mat = m.material as THREE.MeshStandardMaterial, n = g.attributes.position.count;
    const c = new Float32Array(n * 3), w = new Float32Array(n).fill(woolMats.includes(mat.name) ? 1 : 0);
    for (let i = 0; i < n; i++) { c[i * 3] = mat.color.r; c[i * 3 + 1] = mat.color.g; c[i * 3 + 2] = mat.color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('wool', new THREE.BufferAttribute(w, 1)); gs.push(g); });
  return mergeGeometries(gs)!;
}

const WOOLS = [0xf4ede0, 0xf6c6d0, 0xbfe3f2, 0xf7e3a1, 0xcfe8b8, 0xd9c9f0, 0xf2b48c, 0xffffff];
const colAttr = (g: THREE.BufferGeometry, rgb: number[], wool: number) => { const n = g.attributes.position.count;
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => rgb[i % 3]), 3)); g.setAttribute('wool', new THREE.BufferAttribute(new Float32Array(n).fill(wool), 1)); return g; };
export default class S7Felt extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.3, 500);
  private cameos = new Cameos([{ k: 'pixbird', t0: 16.78, dur: 1.0, path: 'fly', y: 0.7, s: 0.08, n: 3, dir: -1 }, { k: 'crayon', t0: 17.0, dur: 1.5, path: 'fly', y: 0.6, s: 0.13, n: 3 }, { k: 'pixbird', t0: 17.6, dur: 1.0, path: 'fly', y: 0.8, s: 0.08, n: 4, dir: -1 }, { k: 'koi', t0: 17.9, dur: 0.6, path: 'leap', x: 0.5, y: -0.3, s: 0.16 }]);
  private insts: GLTFInstance[] = [];
  private U = { uCreep: { value: 0 }, uGlow: { value: 0 }, uGlowP: { value: new THREE.Vector3() } };
  private sheep!: Fur; private fox!: Fur; private pom!: Fur; private sd: { x: number; z: number; ph: number; s: number }[] = [];
  private poms: THREE.Vector3[] = [];
  private cur!: THREE.Object3D; private hero!: HeroPass; private coreM!: THREE.MeshLambertMaterial; private glowL = new THREE.PointLight(0xff7a1a, 0, 8, 2);
  private mats(len: number, n = 6) { return Array.from({ length: n }, (_, i) => new THREE.ShaderMaterial({ vertexShader: FELT_V, fragmentShader: FELT_F, vertexColors: true,
    uniforms: { ...this.U, uShell: { value: n > 1 ? i / (n - 1) : 0 }, uLen: { value: len } } })); }
  private herd(t: number, i: number) { const d = this.sd[i]; return new THREE.Vector3(d.x + 8.5 * (t - T0), 0.55 * Math.abs(Math.sin(t * 13 + d.ph)), d.z); }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('felt'), load('cursor')]); this.insts = [kit, cur];
    this.s.background = new THREE.Color(0.38, 0.6, 1.0); this.s.fog = new THREE.Fog(0x8fb4f0, 60, 180);
    new Fur(colAttr(new THREE.PlaneGeometry(260, 260).rotateX(-Math.PI / 2), [0.28, 0.55, 0.2], 1), 1, this.mats(0.12, 5), this.s).set(0, new THREE.Vector3(0, 0, -60), new THREE.Euler(), new THREE.Vector3(1, 1, 1));
    const hills = new Fur(colAttr(new THREE.SphereGeometry(1, 32, 16), [0.5, 0.74, 0.4], 1), 6, this.mats(0.6, 4), this.s);
    for (let i = 0; i < 6; i++) { hills.set(i, new THREE.Vector3(-70 + 30 * i, -4, -70 - 25 * hash(i)), new THREE.Euler(), new THREE.Vector3(24 + 10 * hash(i * 2), 10 + 8 * hash(i * 3), 18));
      hills.color(i, new THREE.Color().setHSL(0.27 + 0.06 * hash(i * 5), 0.45, 0.5)); }
    hills.flush();
    this.sheep = new Fur(bake(kit.part('sheep'), ['FeltWool']), NS, this.mats(0.09), this.s);
    for (let i = 0; i < NS; i++) { this.sd.push({ x: i === 0 ? -6 : -16 - 22 * hash(i * 1.7), z: i === 0 ? 0 : -18 + 16 * hash(i * 2.3) + (hash(i) > 0.7 ? 14 : 0), ph: hash(i * 3.9) * 6, s: 0.85 + 0.35 * hash(i * 5.1) });
      this.sheep.color(i, new THREE.Color(WOOLS[i % WOOLS.length])); }
    this.sheep.color(0, new THREE.Color(0xf6c6d0));
    this.fox = new Fur(bake(kit.part('fox'), ['FeltFox']), 1, this.mats(0.06), this.s);
    this.pom = new Fur(bake(kit.part('pom'), ['FeltPom']), 24, this.mats(0.1), this.s);
    for (let i = 0; i < 24; i++) { this.poms.push(new THREE.Vector3(-20 + 50 * hash(i * 4.1), 0, -26 + 24 * hash(i * 6.3))); this.pom.color(i, new THREE.Color().setHSL(hash(i * 7), 0.6, 0.6)); }
    const bt = new Fur(bake(kit.part('button'), []), 8, this.mats(0.02, 2), this.s);
    for (let i = 0; i < 8; i++) { bt.set(i, new THREE.Vector3(-10 + 4.2 * i, 0.05, 5 + 0.8 * Math.sin(i)), new THREE.Euler(0, i, 0), new THREE.Vector3(1, 1, 1)); bt.color(i, new THREE.Color().setHSL(0.6 + 0.1 * hash(i), 0.5, 0.6)); }
    bt.flush();
    const yg = new Fur(colAttr(new THREE.CylinderGeometry(0.02, 0.045, 0.9, 5).translate(0, 0.7, 0), [0.3, 0.6, 0.25], 0), 1600, this.mats(0, 1), this.s);
    for (let i = 0; i < 1600; i++) { yg.set(i, new THREE.Vector3(-40 + 90 * hash(i * 1.1), 0, -40 + 50 * hash(i * 2.2)), new THREE.Euler(0.3 * (hash(i * 3) - 0.5), 0, 0.3 * (hash(i * 4) - 0.5)), new THREE.Vector3(1, 0.6 + 0.8 * hash(i * 5), 1));
      yg.color(i, new THREE.Color().setHSL(0.25 + 0.08 * hash(i * 6), 0.5, 0.45 + 0.2 * hash(i * 7))); }
    yg.flush();
    kit.root.visible = false; this.s.add(kit.root);
    this.coreM = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color(1.6, 0.5, 0.05) });
    (this.hero ??= new HeroPass(this.ctx.renderer)).dress(cur, { world: this.s });
    this.cur = cur.root; this.cur.scale.setScalar(CS); this.s.add(this.glowL);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 12), fr = Math.floor(t * 12), rr = this.ctx.renderer;
    this.U.uCreep.value = (fr % 3) * 0.37;
    const j = (k: number) => 0.025 * (hash(fr * 7.1 + k) - 0.5);
    let rear = 1e9;
    for (let i = 0; i < NS; i++) { const p = this.herd(ts, i); rear = Math.min(rear, p.x); const d = this.sd[i];
      this.sheep.set(i, p.add(new THREE.Vector3(j(i), 0, j(i + 50))), new THREE.Euler(0, 0, 0.14 * Math.cos(ts * 13 + d.ph)), new THREE.Vector3(d.s, d.s * (1 - 0.08 * Math.cos(ts * 26 + d.ph)), d.s)); }
    this.sheep.flush();
    const fp = new THREE.Vector3(this.herd(ts, 0).x - 6.5 + 0 * rear + 1.2 * Math.sin(ts * 3), 0.4 * Math.abs(Math.sin(ts * 15)), 3.5);
    this.fox.set(0, fp, new THREE.Euler(0, -0.2, 0.1 * Math.cos(ts * 15)), new THREE.Vector3(1.5, 1.5, 1.5)); this.fox.flush();
    for (let i = 0; i < 24; i++) { let sq = 0; for (let k = 0; k < NS; k++) { const q = this.herd(ts, k); const dd = Math.hypot(q.x - this.poms[i].x, q.z - this.poms[i].z); if (dd < 2.2) sq = Math.max(sq, 1 - dd / 2.2); }
      this.pom.set(i, this.poms[i], new THREE.Euler(), new THREE.Vector3(1 + 0.3 * sq, 1 - 0.45 * sq, 1 + 0.3 * sq)); }
    this.pom.flush();
    const LAND = T0 + 0.3, back = this.herd(ts, 0).add(new THREE.Vector3(0, 2.5, 0));
    let cp: THREE.Vector3; if (t < LAND) { const k = clamp((t - T0) / (LAND - T0)); const h0 = this.herd(LAND, 0).add(new THREE.Vector3(0, 2.5, 0));
      cp = new THREE.Vector3(lerp(h0.x - 4, h0.x, k), lerp(8, h0.y, k * k), lerp(-1, 0, k)); } else cp = back;
    const land = t >= LAND ? Math.exp(-(t - LAND) * 9) : 0;
    this.cur.position.copy(cp); this.cur.rotation.set(0, 0, t < LAND ? -(t - T0) * 10 : -0.25 + 0.12 * Math.sin(ts * 13)); this.cur.scale.set(CS * (1 + 0.4 * land), CS * (1 - 0.35 * land), CS);
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; this.hero.update(t);
    this.U.uGlow.value = 1.4 * blink; this.U.uGlowP.value.copy(cp); this.glowL.position.copy(cp); this.glowL.intensity = 6 * blink;
    const w = sm(T0 + 0.9, T1, t);
    this.cam.position.set(cp.x - 2 - 6 * w, 2.4 + 5 * w, 10.5 + 10 * w); this.cam.aspect = out.width / out.height; this.cam.fov = 40 + 8 * w; this.cam.updateProjectionMatrix();
    const ly = t < LAND ? lerp(cp.y, back.y, 0.75) : cp.y; this.cam.lookAt(cp.x + 1.5 + 4 * w, ly - 0.6 - 1.5 * w, cp.z - 2 * w);
    rr.setRenderTarget(out); rr.render(this.s, this.cam); this.hero.render(rr, out, this.cam);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'aces', exposure: 1.05, bloom: 0.25, bloomThreshold: 1.0, vignette: 0.3, grain: 0.04, ca: 0.1 + land, shake: [10 * land, 6 * land] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); }
}

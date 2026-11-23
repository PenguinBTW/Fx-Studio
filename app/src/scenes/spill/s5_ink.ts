// SPILL s5 (11.65 → 15.13 s): INK MARSH and the second hook. The cursor hops lotus pads; on the bass gap (12.2) a
// giant sumi-e heron strikes and swallows it. Silence: the only colour left is the orange glow inside the heron's
// paper-white throat, still blinking. On 13.39 the heron hiccups and spits it out, now brushed in ink, skipping
// across the water toward Pixel Falls. Ink look: value-only wash fill, boiling brush outline (8 fps), rice paper.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, BEAT, DROP, GULP, lerp, sm, hash, spring, stepped, clamp } from './kit';
import { Cameos } from './cameo';

const T0 = bar(3), SPIT = bar(4), T1 = bar(5), CS = 1.4;
const QUAD_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const INK_F = /* glsl */ `
uniform sampler2D tCol, tDep; uniform vec2 uRes; uniform float uB, uNear, uFar; varying vec2 vUv;
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main(){
  vec2 px = 1.0 / uRes, j = (vec2(vn(vUv * 40.0 + uB), vn(vUv * 40.0 + uB + 7.0)) - 0.5) * px * 5.0;
  vec4 c0 = texture2D(tCol, vUv + j); float d0 = lin(texture2D(tDep, vUv + j).r);
  float e = 0.0; float w = (1.3 + 1.6 * vn(vUv * 9.0 + uB * 0.3)) * uRes.y / 1920.0;
  for (int k = 0; k < 8; k++) { float a = float(k) * 0.785; vec2 o = vec2(cos(a), sin(a)) * px * w * 1.6;
    vec4 c = texture2D(tCol, vUv + j + o); float d = lin(texture2D(tDep, vUv + j + o).r);
    e = max(e, max(abs(c.r - c0.r) * 1.6, clamp(abs(d - d0) / max(1.0, d0) * 9.0, 0.0, 1.0))); }
  // value wash with wet-edge granulation, rice paper base, seal red + the cursor's orange kept
  float v = c0.r; float gran = vn(gl_FragCoord.xy * 0.35) * 0.08 + vn(gl_FragCoord.xy * 0.04) * 0.08;
  vec3 paper = vec3(0.95, 0.92, 0.84) * (0.96 + 0.04 * vn(gl_FragCoord.xy * 0.6));
  float tone = clamp(v + gran - 0.08, 0.0, 1.0); vec3 col = mix(vec3(0.07, 0.07, 0.09), paper, tone);
  col = mix(col, vec3(0.78, 0.12, 0.1) * (0.8 + 0.2 * v), c0.g);
  float ink = smoothstep(0.25, 0.6, e) * (0.75 + 0.25 * vn(vUv * 120.0)); col = mix(col, vec3(0.05, 0.05, 0.07), ink);
  col += c0.b * vec3(1.6, 0.55, 0.08);
  gl_FragColor = vec4(col, 1.0);
}`;
// main-pass material: r = ink value, g = seal-red mask, b = orange glow (emitted through paper)
const VAL_V = `varying vec3 vN, vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const VAL_F = /* glsl */ `uniform float uV, uRed; uniform vec3 uGlowP; uniform float uGlow, uGlowR; varying vec3 vN, vW;
void main(){ float l = clamp(dot(normalize(vN), normalize(vec3(-0.5, 0.8, 0.35))) * 0.5 + 0.5, 0.0, 1.0);
  float v = uV * (0.65 + 0.35 * l); float g = uGlow * exp(-pow(length(vW - uGlowP) / uGlowR, 2.0));
  gl_FragColor = vec4(v, uRed, g * smoothstep(0.2, 0.8, uV), 1.0); }`;

const VAL: Record<string, [number, number]> = { Ink: [0.1, 0], InkWash: [0.5, 0], InkPaper: [0.97, 0], InkSeal: [0.75, 1], InkLotus: [0.9, 0.35] };

export default class S5Ink extends Scene {
  private s = new THREE.Scene(); private curS = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.5, 400);
  private cameos = new Cameos([{ k: 'pixfish', t0: 11.7, dur: 0.5, path: 'leap', x: 0.5, y: -0.2, s: 0.12, n: 2, dir: -1 }, { k: 'pixfish', t0: 13.6, dur: 0.6, path: 'leap', x: -0.4, y: -0.1, s: 0.12, n: 2 }, { k: 'crane', t0: 13.8, dur: 1.3, path: 'fly', y: 0.6, s: 0.12, n: 3 }]);
  private insts: GLTFInstance[] = [];
  private glowU = { uGlowP: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uGlowR: { value: 1.2 } };
  private heron!: THREE.Object3D; private neck!: THREE.Object3D; private head!: THREE.Object3D; private top!: THREE.Object3D; private bot!: THREE.Object3D;
  private cur!: THREE.Object3D; private inkCur!: THREE.Object3D; private cores: THREE.MeshStandardMaterial[] = [];
  private kois: { o: THREE.Object3D; t: number; x: number; z: number }[] = [];
  private ripples: { o: THREE.Mesh; t: number }[] = [];
  private rt: THREE.WebGLRenderTarget | null = null;
  private inkU = { tCol: { value: null as THREE.Texture | null }, tDep: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2() }, uB: { value: 0 }, uNear: { value: 0.5 }, uFar: { value: 400 } };
  private qs = new THREE.Scene(); private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private hops = [T0, T0 + 0.218, T0 + 0.435];
  private padX = [-9, -5.5, -2.2, 0.6];
  private val(v: number, red = 0) { return new THREE.ShaderMaterial({ vertexShader: VAL_V, fragmentShader: VAL_F, uniforms: { uV: { value: v }, uRed: { value: red }, ...this.glowU } }); }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur, cur2] = await Promise.all([load('ink'), load('cursor'), load('cursor')]); this.insts = [kit, cur, cur2];
    kit.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const [v, r] = VAL[(m.material as THREE.Material).name] ?? [0.5, 0]; m.material = this.val(v, r); });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), this.val(0.93)); water.rotation.x = -Math.PI / 2; this.s.add(water);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(40 + 30 * hash(i), 30 + 40 * hash(i * 2), 5), this.val(0.55 + i * 0.08));
      m.position.set(-80 + 45 * i, 0, -120 - 30 * hash(i * 3)); this.s.add(m); }
    this.heron = kit.part('heron'); this.neck = kit.part('neck'); this.head = kit.part('head'); this.top = kit.part('beakTop'); this.bot = kit.part('beakBot');
    this.heron.scale.setScalar(1.25); this.heron.position.set(5.2, 0, -3.2); this.heron.rotation.y = Math.PI; this.s.add(this.heron);
    const pad = kit.part('pad'), lotus = kit.part('lotus'), reed = kit.part('reed'), koi = kit.part('koi');
    this.padX.forEach((x, i) => { const p = pad.clone(); p.position.set(x, 0.02, 0.3 * (i % 2)); this.s.add(p); });
    for (let i = 0; i < 30; i++) { const p = pad.clone(); p.position.set(-30 + 60 * hash(i * 1.3), 0.02, -30 + 26 * hash(i * 2.7)); p.scale.setScalar(0.6 + hash(i) * 0.9); p.rotation.y = hash(i * 4) * 6; this.s.add(p);
      if (i % 3 === 0) { const l = lotus.clone(); l.position.copy(p.position); this.s.add(l); } }
    for (let i = 0; i < 90; i++) { const r = reed.clone(); const cl = Math.floor(i / 10); r.position.set(-26 + 9 * cl + 2.5 * hash(i), 0, -12 - 10 * hash(cl * 3.1) + 2 * hash(i * 2)); r.rotation.set(0, hash(i * 5) * 6, 0.15 * (hash(i * 7) - 0.5)); r.scale.setScalar(0.8 + 0.7 * hash(i * 9)); this.s.add(r); }
    for (let i = 0; i < 4; i++) { const k = koi.clone(); this.s.add(k); this.kois.push({ o: k, t: T0 + 0.3 + i * 0.6, x: -8 + 5 * i, z: -3 - 2 * hash(i) }); }
    for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 4, 48), this.val(0.25)); r.rotation.x = -Math.PI / 2; this.s.add(r); this.ripples.push({ o: r, t: 1e9 }); }
    kit.root.visible = false; this.s.add(kit.root);
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      const p = new THREE.MeshPhysicalMaterial({ name: s.name, color: s.color, roughness: s.roughness });
      if (s.name === 'Shell') { p.color.setRGB(1, 0.36, 0.03); p.roughness = 0.32; p.clearcoat = 1; }
      if (s.name === 'Core') { p.emissive.setRGB(1, 0.32, 0); p.emissiveIntensity = 2; this.cores.push(p); }
      if (s.name === 'Grille') p.color.setRGB(0.25, 0.05, 0);
      m.material = p; });
    cur.part('scan').scale.set(1, 0.4, 0.35); this.cur = cur.root; this.cur.scale.setScalar(CS);
    const sun = new THREE.DirectionalLight(0xfff0e0, 2.4); sun.position.set(-20, 30, 15); this.curS.add(this.cur, sun, new THREE.HemisphereLight(0xffffff, 0x888888, 1.2));
    // the spat-out cursor: brushed in ink, only its core still glows
    cur2.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name; m.material = this.val(n === 'Core' ? 0.95 : n === 'Shell' ? 0.38 : 0.05); });
    this.inkCur = cur2.root; this.inkCur.scale.setScalar(CS); this.s.add(this.inkCur);
    this.qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: INK_F, uniforms: this.inkU, depthTest: false, depthWrite: false })));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, rr = this.ctx.renderer, ts = stepped(t, 12);
    const CAP = GULP[0] + 0.07, H = [...this.hops, GULP[0]];
    // pre-gulp: lotus-pad hops on the off-beats
    let cp = new THREE.Vector3(this.padX[3], 0.7, 0.3);
    for (let i = 0; i < 3; i++) if (t >= H[i] && t < H[i + 1]) { const k = (t - H[i]) / (H[i + 1] - H[i]);
      cp = new THREE.Vector3(lerp(this.padX[i], this.padX[i + 1], k), 0.7 + 2.4 * Math.sin(Math.PI * k), 0.3 * ((i + k) % 2)); }
    this.cur.position.copy(cp); this.cur.rotation.z = -(t - T0) * 5; this.cur.visible = t < CAP;
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; for (const m of this.cores) m.emissiveIntensity = 0.1 + 1.6 * blink;
    // heron: strike (smear held on 12s), gulp-swallow, puzzled stillness, hiccup-spit
    const st = sm(GULP[0] - 0.1, GULP[0] + 0.02, ts), back = sm(GULP[0] + 0.15, GULP[0] + 0.5, t), sp = t >= SPIT ? Math.max(0, spring(t - SPIT, 14, 5)) : 0;
    this.neck.rotation.z = -1.25 * st * (1 - back) - 0.7 * sp; this.head.rotation.z = 0.6 * st * (1 - back) + 0.25 * back * (1 - sm(12.9, 13.1, t)) + 0.15 * sm(12.95, 13.05, ts);
    const open = Math.max(sm(GULP[0] - 0.12, GULP[0] - 0.03, ts) * (1 - sm(GULP[0] + 0.03, GULP[0] + 0.08, ts)), t >= SPIT ? Math.exp(-(t - SPIT) * 6) : 0);
    this.top.rotation.z = 0.45 * open; this.bot.rotation.z = -0.4 * open;
    const ph = (((t - DROP) / BEAT) % 1 + 1) % 1, ob = Math.exp(-((ph - 0.5) ** 2) * 60), inK = sm(GULP[1], GULP[1] + 0.1, t) * (1 - sm(SPIT - 0.02, SPIT + 0.02, t));
    const hic = sm(SPIT - 0.16, SPIT - 0.02, t) * (1 - sm(SPIT, SPIT + 0.12, t));
    this.neck.scale.set(1 + 0.18 * ob * inK + 0.4 * hic, 1 - 0.1 * hic, 1 + 0.18 * ob * inK + 0.4 * hic);
    this.heron.updateMatrixWorld(true);
    const headP = this.head.getWorldPosition(new THREE.Vector3()), neckP = this.neck.getWorldPosition(new THREE.Vector3());
    const tip = this.top.localToWorld(new THREE.Vector3(2.4, 0, 0));
    // the glow inside: swallowed down the paper throat, then sits blinking in the neck
    const sw = sm(CAP, GULP[1], t); const gp = headP.clone().lerp(neckP.clone().add(new THREE.Vector3(0, 1.2, 0)), sw);
    this.glowU.uGlowP.value.copy(t < SPIT ? gp : tip); this.glowU.uGlow.value = t >= CAP && t < SPIT + 0.1 ? (t > GULP[1] ? 0.35 + 1.6 * ob + 1.2 * hic : (0.4 + 0.6 * blink) * 1.2) : 0; this.glowU.uGlowR.value = 1.6;
    // spat out, inked: skips across the water toward camera-left
    const e = t - SPIT; this.inkCur.visible = e >= 0;
    if (e >= 0) { const skips = [0, 0.32, 0.56, 0.74, 0.88]; let si = 0; while (si < skips.length - 1 && e >= skips[si + 1]) si++;
      const a = skips[si], b = si < skips.length - 1 ? skips[si + 1] : a + 0.12, k = clamp((e - a) / (b - a));
      const base = new THREE.Vector3(tip.x - 14 * e, 0, tip.z + 5 * e); const hy = si === 0 ? lerp(tip.y, 0.7, k) + 3 * Math.sin(Math.PI * k) : 0.7 + (2.2 - si * 0.45) * Math.sin(Math.PI * k);
      this.inkCur.position.set(base.x, hy, base.z); this.inkCur.rotation.set(0, 0, -e * 12);
      skips.slice(1).forEach((s, i) => { if (e >= s && this.ripples[4 + i].t > 1e8) { this.ripples[4 + i].t = t; this.ripples[4 + i].o.position.set(this.inkCur.position.x, 0.05, this.inkCur.position.z); } }); }
    if (e >= 0) { this.glowU.uGlowP.value.copy(this.inkCur.position); this.glowU.uGlow.value = (((t * 1.06) % 1) < 0.55 ? 3.0 : 1.2) + 3 * Math.exp(-e * 5); this.glowU.uGlowR.value = 1.5; }
    H.slice(1, 4).forEach((h, i) => { if (t >= h && this.ripples[i].t > 1e8) { this.ripples[i].t = h; this.ripples[i].o.position.set(this.padX[i + 1], 0.06, 0.3 * ((i + 1) % 2)); } });
    for (const r of this.ripples) { const a = t - r.t; r.o.visible = a >= 0 && a < 0.9; r.o.scale.setScalar(0.6 + 5 * stepped(Math.max(0, a), 12)); }
    for (const k of this.kois) { const a = clamp((ts - k.t) / 0.55); k.o.visible = a > 0 && a < 1; k.o.position.set(k.x + 3 * a, 3.2 * Math.sin(Math.PI * a), k.z); k.o.rotation.set(0, 0, 2.4 * (0.5 - a)); }
    // camera
    const pcx = Math.max(cp.x, -5.5); const pre = new THREE.Vector3(pcx - 2, 3.2, 19), preL = new THREE.Vector3(pcx + 3.2, 7.5, -2);
    const hold = new THREE.Vector3(1.5 - 0.6 * sm(GULP[1], SPIT, t), 7, 17 - 2 * sm(GULP[1], SPIT, t)), holdL = gp.clone().lerp(headP, 0.3);
    const post = e >= 0 ? this.inkCur.position.clone().add(new THREE.Vector3(4, 3, 11)) : hold, postL = e >= 0 ? this.inkCur.position.clone().add(new THREE.Vector3(-1.5, 1.2, -2)) : holdL;
    const g = sm(GULP[0] - 0.02, GULP[0] + 0.2, t), q = sm(SPIT + 0.05, SPIT + 0.35, t);
    this.cam.position.copy(pre.lerp(hold, g).lerp(post, q)); const look = preL.lerp(holdL, g).lerp(postL, q);
    this.cam.fov = 42 - 10 * sm(GULP[0] - 0.08, GULP[0], ts) * (1 - g) + 0 * q; this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(look);
    if (!this.rt || this.rt.width !== out.width || this.rt.height !== out.height) { this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType }); this.rt.depthTexture = new THREE.DepthTexture(out.width, out.height); }
    rr.setRenderTarget(this.rt); rr.setClearColor(new THREE.Color(0.96, 0, 0), 1); rr.clear(); rr.render(this.s, this.cam);
    Object.assign(this.inkU, {}); this.inkU.tCol.value = this.rt.texture; this.inkU.tDep.value = this.rt.depthTexture; this.inkU.uRes.value.set(out.width, out.height); this.inkU.uB.value = Math.floor(t * 8) * 1.37;
    const auto = rr.autoClear; rr.autoClear = false; rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc);
    if (this.cur.visible) { rr.clearDepth(); rr.render(this.curS, this.cam); }
    rr.autoClear = auto; rr.resetState();
    const hit = Math.max(t >= GULP[0] ? Math.exp(-(t - GULP[0]) * 10) : 0, t >= SPIT ? Math.exp(-(t - SPIT) * 10) : 0);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'legacy', exposure: 1.0, bloom: 0.1, bloomThreshold: 1.1, vignette: 0.25, grain: 0.03, ca: 0.1 + hit, shake: [18 * hit * Math.sin(t * 91), 18 * hit * Math.cos(t * 77)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.rt?.dispose(); }
}

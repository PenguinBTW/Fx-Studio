// SPILL s6 (15.13 → 16.87 s): PIXEL FALLS. The inked cursor skids into a voxel gorge; a voxel salmon leaps the
// waterfall, the cursor lands on its back and rides it up the falls while coins pop. 8-bit look: rendered at 1/6 res,
// nearest upscale, 4x4 Bayer-dithered palette crush; sprites swap on 8 fps cycles, the waterfall scrolls on 8s.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, stepped, clamp } from './kit';

const T0 = bar(5), T1 = bar(6), CS = 1.4, DIV = 6;
const QUAD_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PIX_F = /* glsl */ `uniform sampler2D tLo; uniform vec2 uLo; varying vec2 vUv;
float bayer(vec2 p){ int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0)); int i = x + y * 4;
  int b[16]; b[0]=0;b[1]=8;b[2]=2;b[3]=10;b[4]=12;b[5]=4;b[6]=14;b[7]=6;b[8]=3;b[9]=11;b[10]=1;b[11]=9;b[12]=15;b[13]=7;b[14]=13;b[15]=5;
  for (int k = 0; k < 16; k++) if (k == i) return float(b[k]) / 16.0; return 0.0; }
void main(){ vec2 cell = floor(vUv * uLo); vec3 c = texture2D(tLo, (cell + 0.5) / uLo).rgb; c = c / (1.0 + c) * 1.35;
  float L = 5.0; c = floor(c * L + bayer(cell)) / L; vec2 f = fract(vUv * uLo); c *= 0.9 + 0.1 * step(0.12, f.y);
  gl_FragColor = vec4(clamp(c, 0.0, 1.2), 1.0); }`;
const FALL_F = /* glsl */ `uniform float uT; varying vec2 vUv; void main(){ float y = floor((vUv.y + uT * 0.9) * 40.0); float x = floor(vUv.x * 24.0);
  float s = fract(sin(x * 12.9 + y * 3.1) * 437.5); vec3 c = mix(vec3(0.25, 0.55, 1.0), vec3(0.85, 0.95, 1.1), step(0.62, s)); c = mix(c, vec3(0.15, 0.35, 0.85), step(s, 0.12));
  gl_FragColor = vec4(c, 1.0); }`;

export default class S6Pixel extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(46, 9 / 16, 0.3, 500);
  private insts: GLTFInstance[] = [];
  private fish: { a: THREE.Object3D; b: THREE.Object3D; t: number; x: number; z: number; h: number }[] = [];
  private hero!: { a: THREE.Object3D; b: THREE.Object3D };
  private coins: { o: THREE.Object3D; t: number; p: THREE.Vector3 }[] = [];
  private cur!: THREE.Object3D; private coreM!: THREE.MeshLambertMaterial;
  private fallU = { uT: { value: 0 } };
  private lo: THREE.WebGLRenderTarget | null = null;
  private pixU = { tLo: { value: null as THREE.Texture | null }, uLo: { value: new THREE.Vector2() } };
  private qs = new THREE.Scene(); private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private RIDE = T0 + 0.42;
  private heroP(t: number) { // leap from the plunge pool up and over the lip of the falls
    const k = clamp((t - T0) / (T1 - T0 - 0.1)); return new THREE.Vector3(lerp(-1, 0.5, k), lerp(-1, 23, sm(0, 1, k)) + 3 * Math.sin(Math.PI * k), lerp(3, -5, k)); }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('pixel'), load('cursor')]); this.insts = [kit, cur];
    kit.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return;
      const mm = (Array.isArray(m.material) ? m.material : [m.material]).map((s) => new THREE.MeshLambertMaterial({ color: (s as THREE.MeshStandardMaterial).color, flatShading: true,
        emissive: (s as THREE.MeshStandardMaterial).color.clone().multiplyScalar(0.15) }));
      m.material = Array.isArray(m.material) ? mm : mm[0]; });
    this.s.background = new THREE.Color(0.35, 0.6, 1.0);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(10, 30), new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`, fragmentShader: FALL_F, uniforms: this.fallU }));
    fall.position.set(0, 10, -6); this.s.add(fall);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 30), new THREE.MeshLambertMaterial({ color: 0x2a6ae0, emissive: 0x0a1a50 })); pool.position.set(0, -1.6, 6); this.s.add(pool);
    const cliff = kit.part('cliff'), fern = kit.part('fern'), coin = kit.part('coin');
    for (const side of [-1, 1]) for (let y = 0; y < 13; y++) for (let k = 0; k < 3; k++) { const c = cliff.clone(); c.position.set(side * (5 + 2 * k + (y % 2)), -1.5 + y * 2, -7 + 3 * k); c.rotation.y = side < 0 ? 0 : Math.PI; this.s.add(c);
      if (y === 12 || hash(y * 9 + k + side) > 0.82) { const f = fern.clone(); f.position.set(c.position.x - 0.8, c.position.y + 2, c.position.z + 1); f.scale.setScalar(1.3); this.s.add(f); } }
    for (let i = 0; i < 12; i++) { const cl = new THREE.Mesh(new THREE.BoxGeometry(6 + 6 * hash(i), 1.5, 2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888899 }));
      cl.position.set(-30 + 60 * hash(i * 2.1), 18 + 20 * hash(i * 3.3), -40 - 20 * hash(i * 4.7)); this.s.add(cl); }
    const A = kit.part('salmonA'), B = kit.part('salmonB');
    this.hero = { a: A.clone(), b: B.clone() }; this.s.add(this.hero.a, this.hero.b);
    for (let i = 0; i < 7; i++) { const f = { a: A.clone(), b: B.clone(), t: T0 + 0.15 * i + 0.1 * hash(i), x: -3.5 + 7 * hash(i * 3.1), z: -4.5 + 2 * hash(i * 4.4), h: 6 + 10 * hash(i * 5.7) };
      this.s.add(f.a, f.b); this.fish.push(f); }
    for (let i = 0; i < 6; i++) { const o = coin.clone(); this.s.add(o); this.coins.push({ o, t: this.RIDE + 0.18 * i, p: new THREE.Vector3() }); }
    kit.root.visible = false; this.s.add(kit.root);
    // the cursor arrives still inked (black shell, ember core) and starts to pixelate here
    this.coreM = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: new THREE.Color(1.6, 0.5, 0.05) });
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
      m.material = n === 'Core' ? this.coreM : new THREE.MeshLambertMaterial({ color: n === 'Shell' ? 0x16141c : 0x050505, flatShading: true, transparent: n === 'Shell', opacity: 0.45, depthWrite: n !== 'Shell' }); });
    this.cur = cur.root; this.cur.scale.setScalar(CS); this.s.add(this.cur);
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2); sun.position.set(-20, 30, 20); this.s.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x406030, 1.1));
    this.qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: PIX_F, uniforms: this.pixU, depthTest: false, depthWrite: false })));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 8), odd = Math.floor(t * 8) % 2 === 1, rr = this.ctx.renderer;
    this.fallU.uT.value = ts;
    const hp = this.heroP(ts); for (const o of [this.hero.a, this.hero.b]) { o.position.copy(hp); o.rotation.set(0, 0, 0.9); }
    this.hero.a.visible = !odd; this.hero.b.visible = odd;
    for (const fi of this.fish) { const ph = ((ts - fi.t) % 0.9 + 0.9) % 0.9 / 0.7; const on = ts >= fi.t && ph <= 1;
      const p = new THREE.Vector3(fi.x + 1.5 * ph, -1 + fi.h * Math.sin(Math.PI * ph), fi.z + 2);
      for (const o of [fi.a, fi.b]) { o.position.copy(p); o.rotation.set(0, 0, 1.4 * (0.5 - ph) + 0.6); o.scale.setScalar(0.8); }
      fi.a.visible = on && !odd; fi.b.visible = on && odd; }
    // cursor: skids in from the left, hops onto the salmon's back, rides it up
    let cp: THREE.Vector3;
    if (t < this.RIDE) { const k = clamp((t - T0) / (this.RIDE - T0)); const to = this.heroP(this.RIDE).add(new THREE.Vector3(0.6, 1.5, 0));
      cp = new THREE.Vector3(lerp(-9, to.x, k), lerp(0.7, to.y, k) + 2.5 * Math.sin(Math.PI * k), lerp(6, to.z, k)); }
    else cp = hp.clone().add(new THREE.Vector3(0.6, 1.5, 0));
    this.cur.position.copy(cp); this.cur.rotation.set(0, 0, t < this.RIDE ? -(t - T0) * 9 : 0.9 - Math.PI / 2 + 0.1 * Math.sin(ts * 12));
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; this.coreM.emissive.setRGB(1.6 * blink, 0.5 * blink, 0.05 * blink);
    for (const c of this.coins) { const a = ts - c.t; c.o.visible = a >= 0 && a < 0.5; if (a >= 0 && c.p.lengthSq() === 0) c.p.copy(cp);
      c.o.position.copy(c.p).add(new THREE.Vector3(0, 0.5 + 3 * Math.min(a, 0.3), 1)); c.o.rotation.y = Math.floor(a * 16) * 0.8; }
    const look = t < this.RIDE ? cp.clone().lerp(hp, 0.5) : hp.clone().add(new THREE.Vector3(0, 2, 0));
    this.cam.position.set(look.x + 4, look.y - 1.5, look.z + 17); this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(look);
    const lw = Math.ceil(out.width / DIV), lh = Math.ceil(out.height / DIV);
    if (!this.lo || this.lo.width !== lw || this.lo.height !== lh) { this.lo?.dispose(); this.lo = new THREE.WebGLRenderTarget(lw, lh, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); }
    rr.setRenderTarget(this.lo); rr.clear(); rr.render(this.s, this.cam);
    this.pixU.tLo.value = this.lo.texture; this.pixU.uLo.value.set(lw, lh);
    rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc); rr.resetState();
    const hit = t >= this.RIDE ? Math.exp(-(t - this.RIDE) * 10) : 0;
    return { toneMap: 'legacy', exposure: 1.0, bloom: 0.2, bloomThreshold: 1.0, vignette: 0.2, grain: 0.0, ca: 0.1 + hit, shake: [12 * hit, 0] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.lo?.dispose(); }
}

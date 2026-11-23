// SPILL s10 (22.09 → 23.83 s): PS1 ARCADE RUINS. Dusk ruins of pillars and dead arcade cabinets; the cursor sprints
// between them and a low-poly T-rex rears up and roars at it while a wireframe vector flock streaks overhead.
// Look: 1/3.5-res nearest upscale, clip-space vertex snapping, affine texture warp (uv*w trick), Gouraud per-vertex
// light, vertex fog, 32px dithered textures; stiff keyframes on 15 fps.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, stepped, clamp } from './kit';

const T0 = bar(9), T1 = bar(10), CS = 1.4, DIV = 3.5;
const QUAD_V = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PS_V = /* glsl */ `uniform vec2 uSnap; uniform vec3 uFogC; uniform float uEmit; varying vec3 vA; varying vec3 vL; varying float vFog;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec4 c = projectionMatrix * viewMatrix * w;
  c.xy = floor(c.xy / c.w * uSnap + 0.5) / uSnap * c.w;
  vec3 N = normalize(mat3(modelMatrix) * normal); float d = max(0.0, dot(N, normalize(vec3(-0.55, 0.6, 0.45))));
  vL = vec3(0.35, 0.3, 0.5) + d * vec3(1.15, 0.8, 0.55) + uEmit; vec2 st = uv; if (st == vec2(0.0)) st = position.xz * 0.35 + position.y * 0.2;
  vA = vec3(st * c.w, c.w); vFog = clamp((length(w.xyz - cameraPosition) - 12.0) / 60.0, 0.0, 1.0); gl_Position = c; }`;
const PS_F = /* glsl */ `uniform sampler2D tTex; uniform vec3 uCol, uFogC; varying vec3 vA; varying vec3 vL; varying float vFog;
void main(){ vec2 uv = vA.xy / vA.z; vec3 tx = texture2D(tTex, uv).rgb; vec3 c = uCol * tx * vL; c = mix(c, uFogC, vFog);
  gl_FragColor = vec4(floor(c * 24.0) / 24.0, 1.0); }`;
const UP_F = /* glsl */ `uniform sampler2D tLo; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tLo, vUv).rgb, 1.0); }`;
const SKY_F = /* glsl */ `varying vec2 vUv; void main(){ float y = vUv.y; vec3 c = mix(vec3(1.0, 0.55, 0.3), vec3(0.25, 0.12, 0.4), smoothstep(0.35, 0.75, y));
  c = mix(c, vec3(0.08, 0.05, 0.2), smoothstep(0.75, 1.0, y)); float s = length((vUv - vec2(0.62, 0.42)) * vec2(1.0, 1.8)); c += vec3(1.0, 0.8, 0.4) * smoothstep(0.07, 0.05, s);
  gl_FragColor = vec4(floor(c * 16.0) / 16.0, 1.0); }`;
const COLS: Record<string, number> = { PsSkin: 0x5a8c40, PsBelly: 0xcfc07a, PsTeeth: 0xf2f2dc, PsEye: 0xffd81a, PsMouth: 0x9a1a1e, PsBark: 0x80592f, PsLeaf: 0x339933, PsCab: 0x402470, PsScreen: 0x1ae6cc, PsStone: 0x99948a };

function tex32(seed: number, kind: 'noise' | 'brick' | 'scale') {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!; const im = g.createImageData(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { let v = 0.75 + 0.25 * hash(x * 31 + y * 17 + seed);
    if (kind === 'brick') v *= (y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0) ? 0.55 : 1;
    if (kind === 'scale') v *= ((x + y) % 6 < 2) ? 0.7 : 1;
    const i = (y * 32 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.floor(255 * v); im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = false; return t;
}

export default class S10Ps1 extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(50, 9 / 16, 0.3, 300);
  private insts: GLTFInstance[] = []; private snap = { value: new THREE.Vector2(160, 284) };
  private fogC = { value: new THREE.Color(0.55, 0.3, 0.45) };
  private dino!: THREE.Object3D; private dHead!: THREE.Object3D; private dJaw!: THREE.Object3D; private dTail!: THREE.Object3D;
  private cur!: THREE.Object3D; private coreU = { value: 0 };
  private birds: THREE.LineSegments[] = [];
  private lo: THREE.WebGLRenderTarget | null = null; private upU = { tLo: { value: null as THREE.Texture | null } };
  private qs = new THREE.Scene(); private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); private sky = new THREE.Scene();
  private ROAR = T0 + 0.55;
  private ps(col: number, t: THREE.Texture, emit: { value: number } = { value: 0 }) { return new THREE.ShaderMaterial({ vertexShader: PS_V, fragmentShader: PS_F,
    uniforms: { tTex: { value: t }, uCol: { value: new THREE.Color(col) }, uSnap: this.snap, uFogC: this.fogC, uEmit: emit } }); }
  private psify(o: THREE.Object3D, t: THREE.Texture) { o.traverse((x) => { const m = x as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
    m.material = this.ps(COLS[n] ?? 0x888888, t, { value: n === 'PsScreen' || n === 'PsEye' ? 1.2 : 0 }); }); return o; }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('ps1'), load('cursor')]); this.insts = [kit, cur];
    const tn = tex32(1, 'noise'), tb = tex32(2, 'brick'), tsk = tex32(3, 'scale');
    this.sky.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: SKY_F, depthTest: false, depthWrite: false })));
    const gg = new THREE.PlaneGeometry(200, 200, 40, 40).rotateX(-Math.PI / 2); const uv = gg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 50, uv.getY(i) * 50);
    this.s.add(new THREE.Mesh(gg, this.ps(0x7a6650, tb)));
    const pil = kit.part('pillar'), cab = kit.part('cab'), palm = kit.part('palm');
    for (let i = 0; i < 18; i++) { const side = i % 2 ? 1 : -1; const p = this.psify(pil.clone(), tb); p.position.set(-14 + 1.9 * i, 0, side > 0 ? 12 : -(3.5 + 2 * hash(i)));
      if (hash(i * 3) > 0.75) { p.rotation.set(Math.PI / 2 - 0.1, hash(i) * 3, 0); p.position.y = 0.6; } p.scale.setScalar(0.9 + 0.4 * hash(i * 5)); this.s.add(p); }
    for (let i = 0; i < 8; i++) { const c = this.psify(cab.clone(), tn); c.position.set(-12 + 3.6 * i, 0, -2.8 - 2 * hash(i * 7)); c.rotation.set(0, Math.PI / 2 + 0.6 * (hash(i) - 0.5), 0.12 * (hash(i * 2) - 0.5)); this.s.add(c); }
    for (let i = 0; i < 12; i++) { const p = this.psify(palm.clone(), tn); p.position.set(-20 + 4 * i, 0, -10 - 8 * hash(i * 9)); p.rotation.y = hash(i) * 6; p.scale.setScalar(0.8 + 0.5 * hash(i * 4)); this.s.add(p); }
    this.dino = this.psify(kit.part('dino'), tsk); this.dHead = kit.part('dHead'); this.dJaw = kit.part('dJaw'); this.dTail = kit.part('dTail');
    this.dino.position.set(5.5, 0, -4.8); this.dino.rotation.y = 2.5; this.dino.scale.setScalar(1.05); this.s.add(this.dino);
    for (let i = 0; i < 14; i++) { const v = new Float32Array([-0.6, 0, 0, 0, -0.15, 0.25, 0, -0.15, 0.25, 0.6, 0, 0]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      for (let k = 0; k < 3; k++) { const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(0.3, 1, 0.45).multiplyScalar(1 - 0.3 * k), transparent: true, opacity: 1 - 0.3 * k }));
        l.userData = { i, k }; this.s.add(l); this.birds.push(l); } }
    kit.root.visible = false; this.s.add(kit.root);
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
      m.material = n === 'Core' ? this.ps(0xff7a1a, tn, this.coreU) : this.ps(n === 'Shell' ? 0xd95a10 : 0x3a1505, tn); });
    this.cur = cur.root; this.cur.scale.setScalar(CS); this.s.add(this.cur);
    this.qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: UP_F, uniforms: this.upU, depthTest: false, depthWrite: false })));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 15), rr = this.ctx.renderer, k = (ts - T0) / (T1 - T0);
    // cursor sprints the ruins; skids and double-blinks when the dino roars
    const skid = sm(this.ROAR - 0.1, this.ROAR + 0.1, ts), run = Math.abs(Math.sin((ts - T0) * 15));
    const cx = lerp(-10, 8, k) - 2.5 * skid * (1 - sm(this.ROAR + 0.4, this.ROAR + 0.7, ts));
    const cp = new THREE.Vector3(cx, 0.8 + 0.5 * run * (1 - skid * 0.8), 0.6); this.cur.position.copy(cp); this.cur.rotation.set(0, 0, -0.2 + 0.45 * skid);
    const roar = sm(this.ROAR - 0.15, this.ROAR, ts) * (1 - sm(this.ROAR + 0.6, this.ROAR + 0.8, ts));
    const dbl = ts > this.ROAR && ts < this.ROAR + 0.4 ? (Math.floor((ts - this.ROAR) * 10) % 2 ? 0.1 : 1) : ((t * 1.06) % 1) < 0.55 ? 1 : 0.12;
    this.coreU.value = 1.6 * dbl;
    // dino: stiff idle, rears and roars; vertex jitter on its keys
    const jit = 0.04 * (hash(Math.floor(t * 15) * 3.3) - 0.5);
    this.dino.rotation.set(0, 2.5 - 0.3 * roar + jit, 0); this.dino.position.y = 0.5 * roar;
    this.dHead.rotation.z = 0.35 * roar + 0.05 * Math.sin(ts * 4); this.dJaw.rotation.z = -0.75 * roar * (0.85 + 0.15 * Math.sin(ts * 60));
    this.dTail.rotation.y = 0.25 * Math.sin(ts * 3) + 0.2 * roar;
    for (const b of this.birds) { const { i, k: kk } = b.userData as { i: number; k: number }; const tt = ts - kk * 0.05;
      b.position.set(-18 + 16 * (tt - T0) + 2.2 * (i % 4) + 0.6 * hash(i), 12 + 1.5 * Math.floor(i / 4) + 0.4 * Math.sin(tt * 8 + i), -8 + 2 * hash(i * 3));
      b.scale.set(1, 1 + 0.6 * Math.sin(tt * 18 + i), 1); }
    const shake = roar * (1 - sm(this.ROAR, this.ROAR + 0.6, ts));
    this.cam.position.set(cp.x - 4.5, 1.9 + 1.2 * roar, 8.5 - 1.5 * roar); this.cam.aspect = out.width / out.height; this.cam.fov = 50 - 6 * roar; this.cam.updateProjectionMatrix();
    this.cam.lookAt(lerp(cp.x + 2, 6, 0.4 * roar), 2.6 + 2.5 * roar, -1.5);
    const lw = Math.ceil(out.width / DIV), lh = Math.ceil(out.height / DIV); this.snap.value.set(lw / 2, lh / 2);
    if (!this.lo || this.lo.width !== lw || this.lo.height !== lh) { this.lo?.dispose(); this.lo = new THREE.WebGLRenderTarget(lw, lh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); }
    const auto = rr.autoClear; rr.autoClear = false;
    rr.setRenderTarget(this.lo); rr.clear(); rr.render(this.sky, this.qc); rr.clearDepth(); rr.render(this.s, this.cam);
    this.upU.tLo.value = this.lo.texture; rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc); rr.autoClear = auto; rr.resetState();
    return { toneMap: 'legacy', exposure: 1.0, bloom: 0.3, bloomThreshold: 0.9, vignette: 0.25, grain: 0.02, ca: 0.1 + 0.6 * shake, shake: [14 * shake * Math.sin(t * 80), 10 * shake * Math.cos(t * 70)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.lo?.dispose(); }
}

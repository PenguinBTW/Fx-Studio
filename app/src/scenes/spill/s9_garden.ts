// SPILL s9 (20.35 → 22.09 s): STAINED-GLASS GARDEN. Golden-hour garden walled by gothic glass arches; the cursor runs a
// path of glass tulips while butterflies with leaded wing panes flap around it, each throwing a coloured light shaft and
// pool onto the ground and onto the cursor. The peacock opens its tail as a rose window as the cursor passes.
// Look: backlit emissive panes + dark lead came, additive god-ray shafts, warm haze; rigid panes hinge at 24 fps.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, stepped, clamp } from './kit';
import { HeroPass } from './hero';
import { groundDetail } from './ground';
import { Cameos } from './cameo';

const T0 = bar(8), T1 = bar(9), CS = 1.4, NB = 14;
const SHAFT_V = /* glsl */ `varying vec2 vUv; varying vec3 vW, vN; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`;
const SHAFT_F = /* glsl */ `uniform vec3 uCol; uniform float uA; varying vec2 vUv; varying vec3 vW, vN;
void main(){ float f = abs(dot(normalize(cameraPosition - vW), vN)); float a = uA * f * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
  gl_FragColor = vec4(uCol * a, 1.0); }`;
const POOL_F = /* glsl */ `uniform vec3 uCol; uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv - 0.5) * 2.0; float a = uA * smoothstep(1.0, 0.2, r);
  gl_FragColor = vec4(uCol * a, 1.0); }`;
const PANE: Record<string, number> = { GlassRed: 0xe61a26, GlassBlue: 0x1a4df2, GlassAmber: 0xffa61a, GlassGreen: 0x26bf4d, GlassViolet: 0x8c33d9, GlassCyan: 0x33cce6 };
const BCOL = [0xe61a26, 0xffa61a, 0x33cce6, 0x8c33d9, 0x26bf4d, 0x1a4df2];

export default class S9Garden extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.3, 400);
  private cameos = new Cameos([{ k: 'hose', t0: 20.25, dur: 1.2, path: 'walk', y: -0.7, s: 0.13, dir: -1 }, { k: 'crayon', t0: 20.6, dur: 1.4, path: 'fly', y: 0.7, s: 0.13, n: 2 }]);
  private insts: GLTFInstance[] = [];
  private bf: { o: THREE.Object3D; wl: THREE.Object3D; wr: THREE.Object3D; shaft: THREE.Mesh; pool: THREE.Mesh; ph: number; r: number; h: number; c: number }[] = [];
  private lights: THREE.PointLight[] = [];
  private tail!: THREE.Object3D; private peacock!: THREE.Object3D;
  private cur!: THREE.Object3D; private hero!: HeroPass; private cores: THREE.MeshStandardMaterial[] = []; private shell!: THREE.MeshStandardMaterial;
  private add(m: THREE.ShaderMaterial['uniforms'], f: string) { return new THREE.ShaderMaterial({ vertexShader: SHAFT_V, fragmentShader: f, uniforms: m, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); }
  private glassify(o: THREE.Object3D) { o.traverse((x) => { const m = x as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
    m.material = PANE[n] !== undefined ? new THREE.MeshStandardMaterial({ color: PANE[n], emissive: PANE[n], emissiveIntensity: 0.8, roughness: 0.2, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide }); }); return o; }

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('garden'), load('cursor')]); this.insts = [kit, cur];
    this.s.background = new THREE.Color(0.95, 0.6, 0.45); this.s.fog = new THREE.FogExp2(0xd08070, 0.032);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundDetail(new THREE.MeshStandardMaterial({ color: 0x3a4a2e, roughness: 0.9 }), 1.4, 0.55, 0.9)); ground.rotation.x = -Math.PI / 2; this.s.add(ground);
    for (let i = 0; i < 40; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.12, 7), new THREE.MeshStandardMaterial({ color: 0xc9b9a0, roughness: 0.8 }));
      st.position.set(-14 + 1.2 * i + 0.3 * hash(i), 0.06, 0.3 * (hash(i * 2) - 0.5)); st.rotation.y = hash(i * 3); this.s.add(st); }
    const arch = kit.part('arch'), tulip = kit.part('tulip');
    for (let i = 0; i < 5; i++) { const a = this.glassify(arch.clone()); a.position.set(-28 + 15 * i, 0, -30); a.scale.setScalar(3.4); this.s.add(a); }
    for (let i = 0; i < 34; i += 2) { const tu = this.glassify(tulip.clone()); const side = i % 2 ? 1 : -1; tu.position.set(-16 + 1.0 * i + 0.4 * hash(i), 0, side < 0 ? -(2.2 + 4 * hash(i * 1.7)) : 2.6 + 1.5 * hash(i * 1.7));
      tu.rotation.y = hash(i * 5) * 6; tu.scale.setScalar(0.45 + 0.3 * hash(i * 9)); this.s.add(tu); }
    this.peacock = this.glassify(kit.part('peacock')); this.tail = kit.part('pTail'); this.peacock.position.set(4, 0, -3.2); this.peacock.rotation.y = -0.4; this.peacock.scale.setScalar(1.2); this.s.add(this.peacock);
    const bfly = kit.part('bfly');
    for (let i = 0; i < NB; i++) { const o = this.glassify(bfly.clone()); o.scale.setScalar(0.17 + 0.1 * hash(i * 3)); this.s.add(o); const c = new THREE.Color(BCOL[i % BCOL.length]);
      let wl: THREE.Object3D = o, wr: THREE.Object3D = o; o.traverse((x) => { if (x.name === 'bWingL') wl = x; if (x.name === 'bWingR') wr = x; });
      const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1, 24, 1, true).translate(0, -0.5, 0), this.add({ uCol: { value: c.clone() }, uA: { value: 0.22 } }, SHAFT_F));
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), this.add({ uCol: { value: c.clone() }, uA: { value: 0.6 } }, POOL_F)); pool.rotation.x = -Math.PI / 2;
      this.s.add(shaft, pool); this.bf.push({ o, wl, wr, shaft, pool, ph: hash(i * 7) * 6.28, r: 2.2 + 3.2 * hash(i * 11), h: 1.4 + 3.0 * hash(i * 13), c: i % BCOL.length }); }
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(BCOL[i * 2], 0, 6, 2); this.s.add(l); this.lights.push(l); }
    kit.root.visible = false; this.s.add(kit.root);
    (this.hero ??= new HeroPass(this.ctx.renderer)).dress(cur, { world: this.s });
    this.cur = cur.root; this.cur.scale.setScalar(CS);
    const sun = new THREE.DirectionalLight(0xffc890, 2.6); sun.position.set(-20, 25, 10); this.s.add(sun, new THREE.HemisphereLight(0xffb0a0, 0x203020, 0.8));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 24), rr = this.ctx.renderer;
    const k = (ts - T0) / (T1 - T0), run = Math.abs(Math.sin((ts - T0) * 14.4));
    const cp = new THREE.Vector3(lerp(-11, 9, k), 0.8 + 0.6 * run, 0); this.cur.position.copy(cp); this.cur.rotation.set(0, 0, -0.18 + 0.05 * run);
    this.cur.scale.set(CS * (1 + 0.1 * (1 - run)), CS * (1 - 0.08 * (1 - run)), CS);
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; this.hero.update(t);
    let near = new THREE.Color(0, 0, 0), nd = 1e9;
    this.bf.forEach((b, i) => { const a = b.ph + 1.7 * (ts - T0) * (i % 2 ? 1 : -1);
      const p = new THREE.Vector3(cp.x + b.r * Math.cos(a), b.h + 0.4 * Math.sin(ts * 5 + b.ph), b.r * 0.8 * Math.sin(a) - 0.4);
      b.o.position.copy(p); b.o.rotation.set(0.25, -a + (i % 2 ? 0 : Math.PI), 0.15 * Math.sin(ts * 9 + b.ph));
      b.o.traverse((x) => { if (x.name === 'bBody') x.rotation.x = Math.PI / 2; });
      const fl = 0.95 * Math.sin(ts * 30 + b.ph); b.wl.rotation.z = fl; b.wr.rotation.z = -fl;
      b.shaft.position.copy(p); b.shaft.scale.set(0.9 + 0.5 * Math.abs(fl), p.y, 0.9 + 0.5 * Math.abs(fl)); b.pool.position.set(p.x, 0.04, p.z);
      (b.pool.material as THREE.ShaderMaterial).uniforms.uA.value = 0.35 + 0.35 * Math.abs(fl);
      if (i < 3) { this.lights[i].position.copy(p); this.lights[i].intensity = 5; }
      const d = p.distanceTo(cp); if (d < nd) { nd = d; near = new THREE.Color(BCOL[b.c]); } });
    
    const open = sm(T0 + 0.55, T0 + 1.05, ts); this.tail.scale.set(1, 0.08 + 0.92 * open, 0.08 + 0.92 * open); this.peacock.rotation.y = -0.4 + 0.1 * Math.sin(ts * 3);
    const up = sm(T0 + 0.9, T1, t);
    this.cam.position.set(cp.x - 3.5 - 1.5 * up, 1.6 + 2.2 * up, 7 + 3 * up); this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix();
    this.cam.lookAt(cp.x + 1.5, 2.2 + 0.8 * up, -1.2);
    rr.setRenderTarget(out); rr.render(this.s, this.cam); this.hero.render(rr, out, this.cam);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'aces', exposure: 1.1, bloom: 0.6, bloomThreshold: 0.85, vignette: 0.35, grain: 0.03, ca: 0.15 };
  }

  override dispose() { for (const i of this.insts) i.dispose(); }
}

// SPILL s4 (9.91 → 11.65 s): CLAY HOLLOW market. The cursor skids in, bowls a frog over, ducks under the snail bus
// (which honks: eye stalks spring out) and rolls on toward the Ink Marsh, where the clay ground bleeds into ink wash.
// Stop-motion clay: thumbprint bump, everything on 12s with replacement-frame boil; the cursor stays smooth.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, spring, stepped, clamp } from './kit';
import { Cameos } from './cameo';

const T0 = bar(2), T1 = bar(3), CS = 1.4;
const FROG_HIT = T0 + 0.33, BUS = T0 + 0.87;

function thumbs() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { const x = hash(i) * 512, y = hash(i + 0.3) * 512, r = 18 + 26 * hash(i + 0.6), a = hash(i + 0.9) * 3.14;
    g.save(); g.translate(x, y); g.rotate(a); g.scale(1, 0.7);
    for (let k = r; k > 2; k -= 3.2) { g.strokeStyle = `rgba(${(k / 3.2) % 2 < 1 ? '255,255,255' : '0,0,0'},0.12)`; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, k, 0, 6.28); g.stroke(); }
    g.restore(); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${hash(i * 3) < 0.5 ? '255,255,255' : '0,0,0'},0.08)`; g.fillRect(hash(i * 1.7) * 512, hash(i * 2.3) * 512, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export default class S4Clay extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 600);
  private cameos = new Cameos([{ k: 'crayon', t0: 10.2, dur: 1.4, path: 'fly', y: 0.55, s: 0.15, n: 2, dir: -1 }, { k: 'pixbird', t0: 10.6, dur: 1.0, path: 'fly', y: 0.8, s: 0.07, n: 3 }]);
  private insts: GLTFInstance[] = [];
  private boil: { o: THREE.Object3D; p: THREE.Vector3; s: THREE.Vector3; i: number }[] = [];
  private frog!: THREE.Object3D; private snail!: THREE.Object3D; private stalks: THREE.Object3D[] = [];
  private cur!: THREE.Object3D; private cores: THREE.MeshStandardMaterial[] = [];
  private glow = new THREE.PointLight(0xff7a1e, 0, 25, 2);
  private ground!: THREE.ShaderMaterial;
  private path = (t: number) => {
    const d = t - T0;
    if (t < FROG_HIT) return new THREE.Vector3(lerp(-12, -2.4, d / (FROG_HIT - T0)), 0.7 + 2.4 * Math.abs(Math.sin(d * 9)) * Math.exp(-d * 2), 0);
    const e = t - FROG_HIT; return new THREE.Vector3(-2.4 + 13 * e, 0.7 + 0.9 * Math.abs(Math.sin(e * 8)) * Math.exp(-e * 2.5), 0.8 * Math.sin(e * 2));
  };

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('clay'), load('cursor')]); this.insts = [kit, cur];
    const bump = thumbs();
    kit.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      m.material = new THREE.MeshStandardMaterial({ color: s.color, roughness: s.name === 'ClayWindow' ? 0.15 : 0.62, bumpMap: bump, bumpScale: 1.4,
        emissive: s.name === 'ClayWindow' ? new THREE.Color(1, 0.75, 0.35) : new THREE.Color(0), emissiveIntensity: 0.6 }); });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = mix(vec3(1.25,0.75,0.45), vec3(0.45,0.6,0.95), smoothstep(0.0,0.5,d.y)); gl_FragColor = vec4(c,1.0); }` }));
    this.s.add(sky); this.s.fog = new THREE.Fog(0xf0b080, 25, 120);
    // ground: ochre clay that bleeds into an ink-wash grey toward +x (the Ink Marsh border)
    const gg = new THREE.PlaneGeometry(240, 240, 120, 120); const pa = gg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, 0.35 * Math.sin(x * 0.3) * Math.sin(y * 0.25) + 1.5 * sm(25, 70, Math.abs(y))); }
    gg.computeVertexNormals();
    this.ground = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: `varying vec3 vW, vN; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT; varying vec3 vW, vN;
        float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
        void main(){ float l = clamp(dot(normalize(vN), normalize(vec3(-0.5,0.8,0.35))), 0.0, 1.0);
          vec2 q = vW.xz; float th = sin(length(fract(q * 0.35) - 0.5) * 60.0) * 0.25 + 0.5; float pat = vn(q * 0.6);
          vec3 clay = mix(vec3(0.62,0.36,0.2), vec3(0.95,0.62,0.35), pat) * (0.92 + 0.08 * th);
          clay *= 0.45 + 0.65 * l;
          float bleed = smoothstep(10.0, 26.0, vW.x + 6.0 * (vn(q * 0.15) - 0.5));
          float wash = vn(q * 0.12 + vec2(0.0, 3.0)) * 0.6 + vn(q * 0.5) * 0.4; vec3 ink = mix(vec3(0.92,0.9,0.84), vec3(0.12,0.12,0.15), smoothstep(0.45, 0.75, wash));
          vec3 c = mix(clay, ink, bleed); float edge = smoothstep(0.0, 0.03, abs(bleed - 0.5)); c = mix(vec3(0.05), c, mix(1.0, edge, step(0.02, bleed) * step(bleed, 0.98)));
          float fog = 1.0 - exp(-length(vW - cameraPosition) * 0.012); c = mix(c, vec3(0.94,0.69,0.5), fog);
          gl_FragColor = vec4(c, 1.0); }` });
    const ground = new THREE.Mesh(gg, this.ground); ground.rotation.x = -Math.PI / 2; this.s.add(ground);
    const add = (src: THREE.Object3D, x: number, z: number, sc: number, ry: number) => { const o = src.clone(); if (z > -2 && z < 18 && src.name !== 'snail' && Math.abs(x + 1.2) > 0.1) z = z > 8 ? z + 10 : -z - 4; o.position.set(x, 0, z); o.scale.setScalar(sc); o.rotation.y = ry; this.s.add(o);
      this.boil.push({ o, p: o.position.clone(), s: o.scale.clone(), i: this.boil.length }); return o; };
    const [snail, frog, mush, cactus, stall] = ['snail', 'frog', 'mush', 'cactus', 'stall'].map((n) => kit.part(n));
    this.snail = add(snail, 4.5, -4.5, 1.6, 0.25); this.snail.traverse((o) => { if (o.name.startsWith('sStalk') || o.name.startsWith('sEye') || o.name.startsWith('sPupil')) this.stalks.push(o); });
    this.frog = add(frog, -1.2, 0.2, 1.1, Math.PI);
    for (let i = 0; i < 18; i++) add(stall, -16 + i * 4.2 + 1.5 * hash(i), (i % 2 ? -1 : 1) * (8 + 4 * hash(i * 3)), 1.3, (i % 2 ? 0 : Math.PI) + 0.3 * (hash(i * 5) - 0.5));
    for (let i = 0; i < 26; i++) add(mush, -20 + 40 * hash(i * 1.9), (hash(i * 2.9) < 0.5 ? -1 : 1) * (4 + 14 * hash(i * 3.3)), 0.6 + 1.4 * hash(i * 4.1), hash(i) * 6);
    for (let i = 0; i < 16; i++) add(cactus, -18 + 36 * hash(i * 7.9), (hash(i * 8.3) < 0.5 ? -1 : 1) * (3 + 10 * hash(i * 9.1)), 0.7 + 0.8 * hash(i * 5.5), hash(i) * 6);
    for (let i = 0; i < 6; i++) add(frog, -14 + 6 * i + 2 * hash(i), (i % 2 ? -1 : 1) * (5 + 3 * hash(i * 2)), 0.8, hash(i * 3) * 6);
    kit.root.visible = false; this.s.add(kit.root);
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      const p = new THREE.MeshPhysicalMaterial({ name: s.name, color: s.color, roughness: s.roughness });
      if (s.name === 'Shell') { p.color.setRGB(1, 0.36, 0.03); p.roughness = 0.32; p.clearcoat = 1; }
      if (s.name === 'Core') { p.emissive.setRGB(1, 0.32, 0); p.emissiveIntensity = 2; this.cores.push(p); }
      if (s.name === 'Grille') p.color.setRGB(0.25, 0.05, 0);
      m.material = p; });
    cur.part('scan').scale.set(1, 0.4, 0.35); this.cur = cur.root; this.s.add(this.cur, this.glow);
    const sun = new THREE.DirectionalLight(0xffd0a0, 2.6); sun.position.set(-30, 45, 20);
    this.s.add(sun, new THREE.HemisphereLight(0x9fb8ff, 0x8a4a30, 1.0));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 12), fr = Math.floor(t * 12), rr = this.ctx.renderer;
    const p = this.path(t);
    for (const b of this.boil) { const j = (k: number) => (hash(fr * 13.1 + b.i * 7.7 + k) - 0.5);
      b.o.position.set(b.p.x + j(1) * 0.03, b.p.y, b.p.z + j(2) * 0.03); b.o.scale.set(b.s.x * (1 + j(3) * 0.025), b.s.y * (1 + j(4) * 0.025), b.s.z * (1 + j(5) * 0.025)); }
    // frog: bowled over on the hit (12s), rocks back up
    const fe = ts - FROG_HIT; this.frog.rotation.z = fe > 0 ? -1.4 * Math.exp(-fe * 1.5) * Math.cos(fe * 5) : 0; this.frog.position.y = fe > 0 ? 0.8 * Math.max(0, spring(fe, 9, 4)) : 0;
    this.frog.scale.y = this.frog.scale.x * (fe > 0 && fe < 0.1 ? 0.6 : 1);
    // snail bus honk: shell hop, eye stalks spring out
    const be = ts - BUS; this.snail.position.y = be > 0 ? 0.5 * Math.max(0, spring(be, 14, 5)) : 0;
    for (const s of this.stalks) s.scale.setScalar(1 + (be > 0 ? 0.6 * Math.max(0, spring(be + 0.05, 16, 4)) : 0));
    let sq = 1; const he = t - FROG_HIT; if (he > 0 && he < 0.3) sq = 1 - 0.4 * Math.exp(-he * 14);
    this.cur.position.copy(p); this.cur.scale.set(CS / Math.sqrt(sq), CS * sq, CS / Math.sqrt(sq)); this.cur.rotation.set(0, 0, -(t - T0) * 7);
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; for (const m of this.cores) m.emissiveIntensity = 0.1 + 1.6 * blink;
    this.glow.position.copy(p); this.glow.intensity = 25 * blink;
    // camera: low tracking dolly at cursor height, slightly ahead; the hit kicks it
    const k = clamp((t - T0) / (T1 - T0)); const kick = he > 0 ? Math.exp(-he * 10) : 0;
    this.cam.position.set(p.x - 3 + 2 * k, 2.4 + 0.6 * kick, 9.5 - 1.5 * k); this.cam.fov = 44 - 6 * kick;
    this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(p.x + 2, 1.4, -1.5);
    rr.setRenderTarget(out); rr.setClearColor(0xf0b080, 1); rr.clear(); rr.render(this.s, this.cam);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'aces', exposure: 0.95, bloom: 0.12, bloomThreshold: 1.3, vignette: 0.3, grain: 0.04, ca: 0.2 + kick,
      shake: [16 * kick * Math.sin(t * 91), 16 * kick * Math.cos(t * 77)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); }
}

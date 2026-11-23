// SPILL s3 (8.17 → 9.91 s): ricochet off the whale lands the cursor in the PAPER CANOPY. It punches down through
// folded-paper tree fans (each hit flips the fan), scatters a flock of cranes, bounces on the paper floor in front of
// an origami deer, and skids off toward Clay Hollow. Papercraft: flat creased facets, fibre grain, light through paper,
// every paper thing animates on 12s (cut-out cadence); the cursor stays smooth.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { bar, lerp, sm, hash, spring, stepped, clamp } from './kit';

const T0 = bar(1), T1 = bar(2), CS = 1.6;
const HITS = [T0 + 0.36, T0 + 0.8, T0 + 1.18];

function fibre() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const x = hash(i) * 256, y = hash(i + 0.5) * 256, a = hash(i + 0.25) * 6.28, l = 3 + 10 * hash(i + 0.75);
    g.strokeStyle = `rgba(${hash(i * 3) < 0.5 ? '255,255,255' : '150,140,130'},${0.08 + 0.12 * hash(i * 7)})`; g.lineWidth = 0.6;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default class S3Paper extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 800);
  private insts: GLTFInstance[] = [];
  private fans: { o: THREE.Object3D; hit: number; base: THREE.Euler }[] = [];
  private cranes: { o: THREE.Object3D; wl: THREE.Object3D; wr: THREE.Object3D; v: THREE.Vector3; p: THREE.Vector3; ph: number }[] = [];
  private deer!: THREE.Object3D; private deerHead!: THREE.Object3D;
  private cur!: THREE.Object3D; private cores: THREE.MeshStandardMaterial[] = [];
  private glow = new THREE.PointLight(0xff7a1e, 0, 30, 2);
  private flowers: THREE.Object3D[] = [];
  private path = (t: number) => {
    // ricochet arc in from the top; punches through three fans, bounces on the floor, skids off +x
    const d = t - T0;
    if (t < HITS[2]) { const k = clamp(d / (HITS[2] - T0)); return new THREE.Vector3(lerp(-6, 1.5, k), lerp(34, 1.0, k * k * 0.3 + k * 0.7), lerp(-4, 2, k)); }
    const e = t - HITS[2]; return new THREE.Vector3(1.5 + 7 * e, 1.0 + Math.abs(Math.sin(e * 7)) * 2.2 * Math.exp(-e * 3), 2 + 1.5 * e);
  };

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [kit, cur] = await Promise.all([load('paper'), load('cursor')]); this.insts = [kit, cur];
    const fib = fibre();
    kit.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      const p = new THREE.MeshStandardMaterial({ color: s.color, roughness: 1, flatShading: true, map: fib, side: THREE.DoubleSide,
        emissive: s.color.clone().multiplyScalar(0.18) });
      m.material = p; });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `varying vec3 vD; void main(){ vec3 d = normalize(vD); vec3 c = mix(vec3(1.0,0.86,0.66), vec3(0.42,0.78,0.78), smoothstep(-0.05,0.6,d.y));
        float s = length(d - normalize(vec3(-0.5,0.55,-0.65))); c = mix(c, vec3(1.15,0.55,0.35), smoothstep(0.16,0.15,s)); gl_FragColor = vec4(c,1.0); }` }));
    this.s.add(sky); this.s.fog = new THREE.Fog(0xf5dcb4, 30, 140);
    // floor: one huge creased sheet
    const fg = new THREE.PlaneGeometry(400, 400, 40, 40); const pa = fg.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setZ(i, (hash(i * 1.7) - 0.5) * 0.5); fg.computeVertexNormals();
    const floor = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xf0dcb8, roughness: 1, flatShading: true, map: fib })); floor.rotation.x = -Math.PI / 2; this.s.add(floor);
    const tree = kit.part('tree'), flower = kit.part('flower'), crane = kit.part('crane');
    for (let i = 0; i < 46; i++) {
      const a = hash(i * 3.1) * 6.28, r = i < 3 ? 3 + i * 1.5 : 8 + 60 * hash(i * 5.7);
      const tx = Math.cos(a) * r, tz = Math.sin(a) * r - 20; if (i >= 3 && tx > -6 && tx < 24 && tz > -2 && tz < 36) continue;
      const tr = tree.clone(); const sc = 2.2 + 1.6 * hash(i * 2.2);
      tr.position.set(i < 3 ? [-5, -1, 3][i] : tx, 0, i < 3 ? [-7, -5, -6][i] : tz); tr.scale.setScalar(sc); tr.rotation.y = hash(i) * 6.28;
      this.s.add(tr); if (i < 3) tr.children.forEach((c) => { if (c.name.startsWith('tFan')) this.fans.push({ o: c, hit: HITS[i], base: c.rotation.clone() }); });
    }
    for (let i = 0; i < 60; i++) { const f = flower.clone(); f.position.set(-14 + 40 * hash(i * 1.3), 0, -24 + 34 * hash(i * 2.9)); f.scale.setScalar(0.5 + 0.6 * hash(i * 4.4)); f.rotation.y = hash(i) * 6; this.s.add(f); this.flowers.push(f); }
    for (let i = 0; i < 22; i++) { const c = crane.clone(); this.s.add(c);
      const p = new THREE.Vector3(-4 + 7 * hash(i * 1.1), 9 + 14 * hash(i * 2.1), -6 + 6 * hash(i * 3.1));
      this.cranes.push({ o: c, wl: c.getObjectByName('cWing1')!, wr: c.getObjectByName('cWing-1')!, p, v: new THREE.Vector3(6 * (hash(i * 4) - 0.3), 5 + 6 * hash(i * 5), -3 * hash(i * 6)), ph: hash(i * 7) * 6 }); }
    this.deer = kit.part('deer'); this.deer.scale.setScalar(2.0); this.deer.position.set(6, 0, -1.5); this.deer.rotation.y = -2.2; this.s.add(this.deer);
    this.deerHead = this.deer.getObjectByName('dHead')!;
    kit.root.visible = false; this.s.add(kit.root);
    cur.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      const p = new THREE.MeshPhysicalMaterial({ name: s.name, color: s.color, roughness: s.roughness });
      if (s.name === 'Shell') { p.color.setRGB(1, 0.36, 0.03); p.roughness = 0.32; p.clearcoat = 1; }
      if (s.name === 'Core') { p.emissive.setRGB(1, 0.32, 0); p.emissiveIntensity = 2; this.cores.push(p); }
      if (s.name === 'Grille') p.color.setRGB(0.25, 0.05, 0);
      m.material = p; });
    cur.part('scan').scale.set(1, 0.4, 0.35); this.cur = cur.root; this.s.add(this.cur, this.glow);
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6); sun.position.set(-30, 50, 20);
    this.s.add(sun, new THREE.HemisphereLight(0x9fe0e0, 0xd08a60, 0.9));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, ts = stepped(t, 12), rr = this.ctx.renderer;
    const p = this.path(t), pn = this.path(t + 0.03);
    // cursor squash on each hit
    let sq = 1; for (const h of HITS) { const e = t - h; if (e > -0.03 && e < 0.4) sq = Math.min(sq, 1 - 0.55 * Math.exp(-Math.max(0, e) * 10) * (e < 0 ? 0 : 1)) + 0.25 * spring(e, 26, 7); }
    this.cur.position.copy(p); this.cur.scale.set(CS / Math.sqrt(sq), CS * sq, CS / Math.sqrt(sq));
    this.cur.rotation.set(0, 0, t < HITS[2] ? -2.2 * (t - T0) : -2.6 + (t - HITS[2]) * -1.5);
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.12; for (const m of this.cores) m.emissiveIntensity = 0.1 + 1.6 * blink;
    this.glow.position.copy(p); this.glow.intensity = 30 * blink;
    // fans flip on the hit (on 12s, paper snaps)
    for (const fan of this.fans) { const e = ts - fan.hit; fan.o.rotation.set(fan.base.x, fan.base.y + (e > 0 ? 1.0 * (1 - Math.exp(-e * 5)) + 0.3 * spring(e, 14, 3) : 0), fan.base.z); fan.o.scale.set(1, e > 0 ? 1 - 0.25 * Math.max(0, spring(e, 16, 4)) : 1, 1); }
    for (const c of this.cranes) { const e = Math.max(0, ts - HITS[0] + 0.1); const pp = c.p.clone().add(c.v.clone().multiplyScalar(e)).add(new THREE.Vector3(0, -1.5 * e * e, 0));
      c.o.position.copy(pp); c.o.scale.setScalar(1.7); c.o.lookAt(pp.clone().add(c.v)); c.o.rotateY(-Math.PI / 2);
      const fl = Math.sin(ts * 22 + c.ph) * (e > 0 ? 0.9 : 0.15); c.wl.rotation.x = fl; c.wr.rotation.x = -fl; }
    
    for (const [i, fl] of this.flowers.entries()) fl.rotation.z = 0.12 * Math.sin(ts * 4 + i);
    // the deer startles at the bounce, then the head tracks the cursor
    const st = sm(HITS[2], HITS[2] + 0.17, ts); this.deer.position.y = 0.6 * Math.max(0, spring(ts - HITS[2], 12, 5));
    this.deerHead.rotation.z = lerp(0, 0.5, st); this.deerHead.rotation.y = -0.4 * st;
    // camera: rides down with the cursor through the canopy, then settles into a low ground shot with the deer
    const ground = sm(HITS[2] - 0.1, HITS[2] + 0.4, t);
    const camA = p.clone().add(new THREE.Vector3(7, 3, 19)), camB = new THREE.Vector3(p.x - 6, 2.2, p.z + 11);
    this.cam.position.copy(camA.lerp(camB, ground)); this.cam.fov = lerp(46, 40, ground);
    const look = p.clone().lerp(pn, 0.5).add(new THREE.Vector3(0, -1.5 * (1 - ground), 0)).lerp(new THREE.Vector3((p.x + this.deer.position.x) / 2, 2.2, p.z - 1), ground * 0.5);
    this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(look);
    let hit = 0; for (const h of HITS) hit = Math.max(hit, t >= h ? Math.exp(-(t - h) * 12) : 0);
    rr.setRenderTarget(out); rr.setClearColor(0xf5dcb4, 1); rr.clear(); rr.render(this.s, this.cam);
    return { toneMap: 'aces', exposure: 0.95, bloom: 0.12, bloomThreshold: 1.3, vignette: 0.3, grain: 0.04, ca: 0.2 + hit,
      shake: [14 * hit * Math.sin(t * 91), 14 * hit * Math.cos(t * 77)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); }
}

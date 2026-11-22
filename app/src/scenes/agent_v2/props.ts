// S4 tabletop props, built in code at 1 unit = 10 cm: oak desk, paper with live ink, marker, scissors, rubber stamp,
// floppy + drive, cassette deck, padlock, match, magnifier, desk bell. Every prop is posed in closed form from T.
import * as THREE from 'three';

let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const std = (color: number, rough = 0.5, metal = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: metal, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material, r = 0) => { const g = r > 0 ? roundBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d); const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };
function roundBox(w: number, h: number, d: number, r: number) {
  const s = new THREE.Shape(); const x = w / 2 - r, z = d / 2 - r;
  s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -z); s.lineTo(w / 2, z); s.quadraticCurveTo(w / 2, d / 2, x, d / 2);
  s.lineTo(-x, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, z); s.lineTo(-w / 2, -z); s.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * Math.min(r, h * 0.4), bevelEnabled: true, bevelSize: Math.min(r, h * 0.4), bevelThickness: Math.min(r, h * 0.4), bevelSegments: 3, curveSegments: 6 });
  g.rotateX(Math.PI / 2); g.translate(0, h / 2 - Math.min(r, h * 0.4), 0); g.computeVertexNormals(); return g;
}
const cyl = (r: number, h: number, m: THREE.Material, seg = 32) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.castShadow = o.receiveShadow = true; return o; };

export function oakTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d')!;
  g.fillStyle = '#8a5a32'; g.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 900; i++) { const y = rnd() * 1024, a = 0.04 + 0.1 * rnd(); g.strokeStyle = rnd() < 0.5 ? `rgba(60,32,14,${a})` : `rgba(190,130,80,${a * 0.7})`; g.lineWidth = 1 + 5 * rnd() ** 3;
    g.beginPath(); for (let x = 0; x <= 2048; x += 32) g.lineTo(x, y + 18 * Math.sin(x * 0.002 + i) + 6 * Math.sin(x * 0.011 + i * 3)); g.stroke(); }
  for (let k = 0; k < 6; k++) { const x = rnd() * 2048, y = rnd() * 1024; for (let r = 4; r < 60; r += 5) { g.strokeStyle = `rgba(55,28,12,${0.12})`; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, r * 2.4, r * 0.6, 0, 0, 6.3); g.stroke(); } }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(30,15,6,0.5)'; g.fillRect(0, (i + 1) * 1024 / 7 - 1, 2048, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

/** A sheet of paper whose ink is a live canvas: call draw(fn) each frame. */
export class Sheet {
  readonly canvas = document.createElement('canvas'); readonly g: CanvasRenderingContext2D; readonly tex: THREE.CanvasTexture; readonly mesh: THREE.Mesh;
  constructor(w = 2.1, d = 2.97, tint = 0xf3ead8) {
    this.canvas.width = 1024; this.canvas.height = Math.round(1024 * d / w); this.g = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    const geo = new THREE.PlaneGeometry(w, d, 24, 24).rotateX(-Math.PI / 2); const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, 0.012 + 0.004 * Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 1.7) + 0.003 * Math.sin(p.getZ(i) * 5.3));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: tint, map: this.tex, roughness: 0.85, sheen: 0.3, sheenColor: new THREE.Color(0xffffff), side: THREE.DoubleSide }));
    this.mesh.receiveShadow = this.mesh.castShadow = true;
  }
  draw(fn: (g: CanvasRenderingContext2D, w: number, h: number) => void) { const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, this.canvas.width, this.canvas.height); g.fillStyle = '#ffffff'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.fillStyle = 'rgba(120,150,190,0.25)'; for (let y = 160; y < this.canvas.height; y += 58) g.fillRect(60, y, this.canvas.width - 120, 2); fn(g, this.canvas.width, this.canvas.height); this.tex.needsUpdate = true; }
}

export function marker() {
  const g = new THREE.Group(); const body = cyl(0.11, 1.3, std(0x111114, 0.35, 0, { clearcoat: 0.8 }));
  body.position.y = 0.75; const band = cyl(0.113, 0.18, std(0xd8301c, 0.4)); band.position.y = 1.2; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 20), std(0x101010, 0.7));
  tip.rotation.x = Math.PI; tip.position.y = 0.04; const collar = cyl(0.085, 0.1, std(0x2a2a2e, 0.3, 0.8)); collar.position.y = 0.14;
  g.add(body, band, tip, collar); g.rotation.z = 0.35; return g;
}
export function scissors() {
  const g = new THREE.Group(), steel = std(0xc9ccd2, 0.18, 1), grip = std(0xd8301c, 0.35, 0, { clearcoat: 0.5 });
  const half = (s: number) => { const h = new THREE.Group(); const blade = box(1.5, 0.025, 0.12, steel); blade.position.set(0.75, 0, 0.03 * s); blade.rotation.y = -0.04 * s;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 12, 32), grip); ring.rotation.x = Math.PI / 2; ring.position.set(-0.45, 0, 0.18 * s); ring.castShadow = true;
    const arm = box(0.35, 0.05, 0.08, grip); arm.position.set(-0.15, 0, 0.08 * s); h.add(blade, ring, arm); return h; };
  const a = half(1), b = half(-1); b.position.y = 0.03; const pin = cyl(0.04, 0.09, steel); g.add(a, b, pin); return { g, a, b };
}
export function stamp() {
  const g = new THREE.Group(); const block = box(0.8, 0.28, 0.55, std(0x6b4426, 0.6), 0.04); block.position.y = 0.2;
  const rubber = box(0.76, 0.06, 0.51, std(0x7a1414, 0.8)); rubber.position.y = 0.03;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 16), std(0x2a1a10, 0.3, 0, { clearcoat: 1 })); knob.position.y = 0.72; knob.scale.y = 0.8;
  const neck = cyl(0.08, 0.3, std(0x2a1a10, 0.3)); neck.position.y = 0.48; g.add(block, rubber, knob, neck); return g;
}
export function floppy() {
  const g = new THREE.Group(); const shell = box(0.9, 0.033, 0.94, std(0x1b1d22, 0.4), 0.02);
  const shutter = box(0.42, 0.038, 0.3, std(0xb8bcc4, 0.2, 1)); shutter.position.set(0, 0, -0.3);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5).rotateX(-Math.PI / 2), std(0xf4f1e8, 0.8)); label.position.set(0, 0.018, 0.18);
  g.add(shell, shutter, label); return { g, shutter };
}
export function drive() {
  const g = new THREE.Group(); const b = box(1.6, 0.42, 1.5, std(0xd9d2c0, 0.55), 0.05); b.position.y = 0.21;
  const slot = box(1.0, 0.06, 0.05, std(0x050505, 0.9)); slot.position.set(0, 0.26, 0.76);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: 0x103010, emissive: 0x40ff60, emissiveIntensity: 0 })); led.position.set(0.6, 0.12, 0.76);
  g.add(b, slot, led); return { g, led };
}
export function deck() {
  const g = new THREE.Group(); const b = box(3.0, 0.62, 1.8, std(0x2a2b2e, 0.35, 0.6), 0.06); b.position.y = 0.31; g.add(b);
  const win = box(1.6, 0.02, 0.7, std(0x080808, 0.05, 0, { clearcoat: 1, transmission: 0 })); win.position.set(-0.3, 0.625, -0.2); g.add(win);
  const spools: THREE.Mesh[] = []; for (const x of [-0.7, 0.1]) { const s = cyl(0.2, 0.03, std(0xe8e2d4, 0.5)); s.position.set(x, 0.64, -0.2);
    for (let k = 0; k < 6; k++) { const t = box(0.04, 0.035, 0.12, std(0x111111, 0.5)); t.position.set(0.16 * Math.cos(k), 0, 0.16 * Math.sin(k)); t.rotation.y = -k; s.add(t); } g.add(s); spools.push(s); }
  const keys: THREE.Mesh[] = []; for (let k = 0; k < 4; k++) { const key = box(0.36, 0.14, 0.4, std(k === 1 ? 0xd8301c : 0xc8c8cc, 0.3, k === 1 ? 0 : 0.8), 0.03); key.position.set(-1.1 + k * 0.42, 0.66, 0.6); g.add(key); keys.push(key); }
  const knob = cyl(0.16, 0.18, std(0xb8b8bc, 0.25, 1), 48); knob.position.set(1.1, 0.7, -0.3); g.add(knob);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0x300808, emissive: 0xff3020, emissiveIntensity: 0 })); led.position.set(1.1, 0.63, 0.45); g.add(led);
  return { g, spools, keys, knob, led };
}
export function padlock() {
  const g = new THREE.Group(), brass = std(0xc8a050, 0.28, 1); const body = box(0.6, 0.5, 0.22, brass, 0.06); body.position.y = 0.25;
  const sh = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 12, 32, Math.PI), std(0xd0d4da, 0.15, 1)); sh.castShadow = true;
  const legL = cyl(0.045, 0.25, std(0xd0d4da, 0.15, 1)), legR = legL.clone(); legL.position.set(-0.19, -0.12, 0); legR.position.set(0.19, -0.12, 0); sh.add(legL, legR);
  const shackle = new THREE.Group(); shackle.add(sh); shackle.position.y = 0.62; g.add(body, shackle); g.rotation.x = -Math.PI / 2 + 0.02; g.position.y = 0.11;
  return { g, shackle };
}
export function match() {
  const g = new THREE.Group(); const stick = box(0.04, 0.04, 0.9, std(0xd8b478, 0.8)); const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), std(0x8a1a10, 0.6));
  head.scale.set(1, 1, 1.5); head.position.z = -0.46; stick.add(head); g.add(stick);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(0.7, 1.6, 0.7); flame.position.set(0, 0.12, -0.5); g.add(flame);
  const light = new THREE.PointLight(0xff9040, 0, 4, 2); light.position.copy(flame.position); g.add(light); g.position.y = 0.02;
  return { g, flame, light };
}
export function magnifier() {
  const g = new THREE.Group(); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 16, 64), std(0x1a1a1a, 0.3, 0.5)); rim.rotation.x = Math.PI / 2;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 1, thickness: 0.3, ior: 1.5, transparent: true, opacity: 0.25 }));
  const handle = cyl(0.07, 1.1, std(0x4a2a16, 0.4)); handle.rotation.z = Math.PI / 2; handle.position.x = 1.05; g.add(rim, lens, handle); g.position.y = 0.3; return g;
}
export function bell() {
  const g = new THREE.Group(); const base = cyl(0.42, 0.1, std(0x1a1a1a, 0.4)); base.position.y = 0.05;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.36, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd6b060, 0.12, 1)); dome.position.y = 0.1; dome.castShadow = true;
  const btn = cyl(0.05, 0.12, std(0xd6b060, 0.15, 1)); btn.position.y = 0.5; g.add(base, dome, btn); return { g, btn, dome };
}

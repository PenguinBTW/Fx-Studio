import * as THREE from 'three';
import { hash, TAU } from './kit';

/** Foreign-style visitors: hand-drawn sprite flocks/leapers composited over any region, each in its own medium and frame rate. */
export type Kind = 'pixbird' | 'pixfish' | 'koi' | 'hose' | 'crayon' | 'crane' | 'glass' | 'bee' | 'sheep';
export type Cameo = { k: Kind; t0: number; dur: number; path: 'fly' | 'leap' | 'float' | 'walk' | 'pop'; y: number; s: number; n?: number; dir?: 1 | -1; x?: number };
type G = CanvasRenderingContext2D;
type Spec = { fr: number; fps: number; W: number; draw: (g: G, f: number, W: number) => void };

const px = (g: G, c: string, cells: [number, number, number?, number?][]) => { g.fillStyle = c; for (const [x, y, w = 1, h = 1] of cells) g.fillRect(x, y, w, h); };
const R = (n: number) => hash(n * 12.9898 + 0.137);
function fuzz(g: G, x: number, y: number, rx: number, ry: number, col: string, seed: number, fib = 140) {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); g.strokeStyle = col; g.lineWidth = 1.6;
  for (let i = 0; i < fib; i++) { const a = R(seed + i) * TAU, r = 0.92 + 0.12 * R(seed + i * 3), l = 3 + 5 * R(seed + i * 7);
    const ex = x + Math.cos(a) * rx * r, ey = y + Math.sin(a) * ry * r; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a + R(i) - 0.5) * l, ey + Math.sin(a + R(i) - 0.5) * l); g.stroke(); }
}
function crayon(g: G, path: () => void, col: string, seed: number, W: number) {
  g.save(); path(); g.clip(); g.strokeStyle = col; g.lineWidth = 2.2; g.globalAlpha = 0.75;
  for (let i = 0; i < 70; i++) { const y = R(seed + i) * W, x = R(seed + i * 5) * W; g.beginPath(); g.moveTo(x - 30, y + 18); g.lineTo(x + 30, y - 18); g.stroke(); }
  g.restore(); g.save(); g.strokeStyle = col; g.lineWidth = 3; g.globalAlpha = 0.9; path(); g.stroke(); g.restore();
}

const SPEC: Record<Kind, Spec> = {
  pixbird: { fr: 4, fps: 8, W: 16, draw(g, f) {
    px(g, '#1d2a6e', [[4, 7, 7, 3], [11, 6, 2, 2], [2, 7, 2, 1], [1, 6, 2, 1]]); px(g, '#ffd23a', [[5, 9, 5, 1]]); px(g, '#ff5a1a', [[13, 7, 2, 1]]); px(g, '#ffffff', [[12, 6]]);
    px(g, '#3a58c8', [[[6, 2, 2, 5], [5, 6, 5, 1], [6, 10, 2, 3], [5, 6, 5, 1]][f] as [number, number, number, number], f === 0 ? [8, 4, 2, 2] : f === 2 ? [8, 10, 2, 1] : [10, 6, 1, 1]]);
  } },
  pixfish: { fr: 2, fps: 8, W: 16, draw(g, f) {
    px(g, '#ff6a4a', [[4, 6, 8, 4], [3, 7, 1, 2], [12, 7, 1, 2]]); px(g, '#ffc0a0', [[5, 9, 6, 1]]); px(g, '#1a1a1a', [[10, 7]]);
    px(g, '#e8402a', f ? [[1, 5, 2, 2], [1, 9, 2, 2], [2, 7, 1, 2]] : [[1, 6, 2, 4], [0, 5, 1, 1], [0, 10, 1, 1]]); px(g, '#ffe14a', [[6, 5, 3, 1]]);
  } },
  koi: { fr: 3, fps: 6, W: 128, draw(g, f) {
    const sway = [-1, 0, 1][f] * 10;
    for (let i = 0; i < 40; i++) { const u = i / 39, x = 108 - u * 90, y = 64 + Math.sin(u * 3) * 4 + sway * u * u, r = 17 * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.08)) + 2;
      g.fillStyle = `rgba(14,12,16,${0.12 + 0.1 * R(i + f * 50)})`; g.beginPath(); g.arc(x + R(i) * 3, y + R(i * 2) * 3, r, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(10,10,12,0.85)'; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 64 + sway); g.lineTo(6, 46 + sway * 1.3); g.moveTo(22, 64 + sway); g.lineTo(6, 82 + sway * 1.3); g.stroke();
    g.fillStyle = '#d42a1a'; g.beginPath(); g.arc(80, 58, 7, 0, TAU); g.fill(); g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(98, 60, 3, 0, TAU); g.fill();
  } },
  hose: { fr: 2, fps: 6, W: 128, draw(g, f) {
    const b = f ? 6 : -6; g.lineWidth = 5; g.strokeStyle = '#111'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 128); g.bezierCurveTo(64 + b, 100, 64 - b, 80, 64 + b * 0.6, 62); g.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + f * 0.2; g.fillStyle = '#f4f0e6'; g.beginPath(); g.ellipse(64 + b * 0.6 + Math.cos(a) * 26, 44 + Math.sin(a) * 26, 14, 9, a, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#f4f0e6'; g.beginPath(); g.arc(64 + b * 0.6, 44, 20, 0, TAU); g.fill(); g.stroke();
    for (const s of [-1, 1]) { const ex = 64 + b * 0.6 + s * 7; g.fillStyle = '#111'; g.beginPath(); g.ellipse(ex, 40, 4.5, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#f4f0e6'; g.beginPath(); g.moveTo(ex, 40); g.arc(ex, 40, 5, -1.2, -0.5); g.fill(); }
    g.beginPath(); g.arc(64 + b * 0.6, 48, 9, 0.2, Math.PI - 0.2); g.stroke();
  } },
  crayon: { fr: 3, fps: 8, W: 128, draw(g, f, W) {
    const sx = [1, 0.62, 0.3][f], j = (n: number) => (R(n + f * 31) - 0.5) * 4;
    for (const s of [-1, 1]) {
      crayon(g, () => { g.beginPath(); g.moveTo(64, 60); g.bezierCurveTo(64 + s * 60 * sx + j(1), 10 + j(2), 64 + s * 62 * sx, 70 + j(3), 64, 66); g.closePath(); }, '#ff4fa0', 7 + s, W);
      crayon(g, () => { g.beginPath(); g.moveTo(64, 66); g.bezierCurveTo(64 + s * 44 * sx + j(4), 100 + j(5), 64 + s * 20 * sx, 108, 64, 70); g.closePath(); }, '#2ec4e8', 9 + s, W);
    }
    g.strokeStyle = '#3a2a1a'; g.lineWidth = 5; g.beginPath(); g.moveTo(64 + j(6), 48); g.lineTo(64 + j(7), 92); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(64, 50); g.quadraticCurveTo(54, 32, 50 + j(8), 28); g.moveTo(64, 50); g.quadraticCurveTo(74, 32, 78 + j(9), 28); g.stroke();
  } },
  crane: { fr: 2, fps: 6, W: 128, draw(g, f) {
    const up = f ? -1 : 1, P = (c: string, pts: number[]) => { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
    g.save(); g.translate(5, 7); g.globalAlpha = 0.25; P('#000', [20, 70, 64, 60, 108, 40, 70, 80]); g.restore();
    P('#e8d6b4', [64, 64, 64 - 10, 64 - 46 * up, 80, 62]); P('#fff6e6', [20, 70, 64, 60, 108, 40, 70, 80]); P('#e0caa0', [64, 60, 70, 80, 108, 40]);
    P('#fff6e6', [64, 64, 64 + 6, 64 - 50 * up, 84, 62]);
    g.strokeStyle = 'rgba(120,90,50,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(64, 60); g.lineTo(70, 80); g.stroke();
  } },
  glass: { fr: 3, fps: 10, W: 128, draw(g, f) {
    const sx = [1, 0.6, 0.25][f], C = ['#e8204a', '#1a8ae8', '#ffc21a', '#2ad07a', '#a83ae8'];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const a0 = -1.3 + i * 0.7, a1 = a0 + 0.7, r = i < 2 ? 58 : 42; g.fillStyle = C[(i + (s > 0 ? 1 : 0)) % 5];
      g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + s * Math.cos(a0) * r * sx, 64 + Math.sin(a0) * r); g.lineTo(64 + s * Math.cos(a1) * r * sx, 64 + Math.sin(a1) * r); g.closePath(); g.fill();
      g.strokeStyle = '#16121a'; g.lineWidth = 5; g.lineJoin = 'round'; g.stroke(); }
    g.fillStyle = '#16121a'; g.fillRect(60, 40, 8, 50);
  } },
  bee: { fr: 2, fps: 12, W: 128, draw(g, f) {
    g.fillStyle = 'rgba(240,250,255,0.85)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(64 + s * 14, 44 - (f ? 8 : 0), 14, 22, s * (f ? 0.9 : 0.5), 0, TAU); g.fill(); }
    fuzz(g, 64, 70, 32, 24, '#ffc928', 3 + f); g.save(); g.beginPath(); g.ellipse(64, 70, 32, 24, 0, 0, TAU); g.clip();
    g.fillStyle = '#4a2a14'; g.fillRect(50, 40, 9, 60); g.fillRect(70, 40, 9, 60); g.restore();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(92, 66, 4, 0, TAU); g.fill();
  } },
  sheep: { fr: 4, fps: 12, W: 128, draw(g, f) {
    const ph = f / 4 * TAU; g.strokeStyle = '#2a2024'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const x = 42 + i * 15, o = Math.sin(ph + i * 1.7) * 7; g.beginPath(); g.moveTo(x, 80); g.lineTo(x + o, 108); g.stroke(); }
    fuzz(g, 62, 68 - Math.abs(Math.sin(ph)) * 3, 38, 26, '#f6eee4', 11, 220);
    g.fillStyle = '#2a2024'; g.beginPath(); g.ellipse(102, 60, 13, 10, -0.3, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(106, 57, 2.5, 0, TAU); g.fill();
  } },
};

const atlases = new Map<Kind, THREE.CanvasTexture>();
function atlas(k: Kind) {
  let t = atlases.get(k); if (t) return t;
  const sp = SPEC[k], cv = document.createElement('canvas'); cv.width = sp.W * sp.fr; cv.height = sp.W; const g = cv.getContext('2d')!;
  for (let f = 0; f < sp.fr; f++) { g.save(); g.translate(f * sp.W, 0); g.beginPath(); g.rect(0, 0, sp.W, sp.W); g.clip(); sp.draw(g, f, sp.W); g.restore(); }
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  if (sp.W <= 16) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  atlases.set(k, t); return t;
}

type Inst = { c: Cameo; m: THREE.Mesh; tex: THREE.Texture; i: number };
export class Cameos {
  private s = new THREE.Scene(); private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10); private list: Inst[] = [];
  constructor(cfg: Cameo[]) {
    const geo = new THREE.PlaneGeometry(1, 1);
    for (const c of cfg) for (let i = 0; i < (c.n ?? 1); i++) {
      const tex = atlas(c.k).clone(); tex.repeat.set(1 / SPEC[c.k].fr, 1); tex.needsUpdate = true;
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      m.renderOrder = i; this.s.add(m); this.list.push({ c, m, tex, i });
    }
  }
  draw(rr: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, t: number) {
    const asp = out.width / out.height; let any = false;
    for (const { c, m, tex, i } of this.list) {
      const h = R(i * 3.7 + c.t0), flock = c.path === 'fly' || c.path === 'walk', lt = t - c.t0 - (flock ? i * 0.07 : i * 0.18), u = lt / c.dur;
      m.visible = u > 0 && u < 1; if (!m.visible) continue; any = true;
      const sp = SPEC[c.k], fr = Math.floor((lt + h) * sp.fps) % sp.fr, d = c.dir ?? 1, sc = 3.0 * c.s * (0.75 + 0.5 * h);
      tex.offset.x = fr / sp.fr; let x = 0, y = c.y, rot = 0;
      if (flock) {
        const row = Math.floor((i + 1) / 2), side = i % 2 ? 1 : -1;
        x = d * (-1.3 + 2.6 * u) * asp - d * row * 0.09; if (c.path === 'fly') y += side * row * 0.05 + 0.02 * Math.sin(lt * 5 + i);
      } else if (c.path === 'leap') {
        const x0 = (c.x ?? 0) + (h - 0.5) * 0.5, H = c.y + 1.15; x = (x0 + d * (u - 0.5) * 0.7) * asp; y = -1.15 + H * 4 * u * (1 - u);
        rot = Math.atan2(H * 4 * (1 - 2 * u) / c.dur, d * 0.7 * asp / c.dur) * d;
      } else if (c.path === 'pop') {
        const k = Math.min(1, lt / 0.22); x = (c.x ?? 0) * asp; y = -1.4 + (c.y + 1.4) * (1 - (1 - k) ** 3) + 0.05 * Math.sin(lt * 22) * Math.exp(-lt * 5); rot = 0.3 * d * k;
      } else { x = ((c.x ?? 0) + (i ? (h - 0.5) * 0.3 : 0)) * asp; y += 0.015 * Math.sin(lt * 3 + i); }
      m.position.set(x, y, 0); m.rotation.z = rot; m.scale.set(sc * d, sc, 1);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, u * 12, (1 - u) * 12);
    }
    if (!any) return;
    this.cam.left = -asp; this.cam.right = asp; this.cam.updateProjectionMatrix();
    const auto = rr.autoClear; rr.autoClear = false; rr.setRenderTarget(out); rr.render(this.s, this.cam); rr.autoClear = auto; rr.resetState();
  }
}

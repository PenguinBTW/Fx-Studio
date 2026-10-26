// Flat CPU raster of ExtrudedText layout/shapes (front faces) -> PPM, for readability checks without a GPU.
import * as THREE from 'three';
import { ExtrudedText } from '../src/engine/text3d';
import { writeFileSync } from 'node:fs';
const ROWS: [string, number][] = [
  ['ABCDEFGHIJKLM', 0.62], ['NOPQRSTUVWXYZ', 0.62], ['0123456789', 0.62],
  ['. , ! ? \' " : ; - _ / % + = ( ) & \u00B0', 0.5],
  ['IT DOES NOT BEND', 0.62], ['YOU WERE ITS DESTINATION.', 0.5], ['170,000 YEARS   8 MIN 20 S   42\u00B0', 0.5],
];
const W = 1920, H = 1080, PPU = 100;
const img = new Uint8Array(W * H).fill(16);
ROWS.forEach(([txt, size], r) => {
  const g = ExtrudedText.create(txt, { size, depth: 0.12, letterSpacing: 0.1, bevelEnabled: false });
  const cy = 2.9 - r * 0.98;
  for (const m of g.children as THREE.Mesh[]) {
    const p = m.geometry.attributes.position!, idx = m.geometry.index;
    const z = new Set<number>(); for (let i = 0; i < p.count; i++) z.add(Math.round(p.getZ(i) * 1e4));
    const zmax = Math.max(...z) / 1e4;
    const vx = (i: number) => (p.getX(i) + m.position.x) * PPU + W / 2, vy = (i: number) => H / 2 - (p.getY(i) + cy) * PPU;
    const n = idx ? idx.count : p.count;
    for (let k = 0; k < n; k += 3) {
      const ids = [0, 1, 2].map((j) => (idx ? idx.getX(k + j) : k + j));
      if (ids.some((i) => Math.abs(p.getZ(i) - zmax) > 1e-6)) continue;
      const xs = ids.map(vx), ys = ids.map(vy);
      const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
      const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const d = (xs[1]! - xs[0]!) * (ys[2]! - ys[0]!) - (xs[2]! - xs[0]!) * (ys[1]! - ys[0]!);
        const a = ((xs[1]! - px) * (ys[2]! - py) - (xs[2]! - px) * (ys[1]! - py)) / d;
        const b = ((xs[2]! - px) * (ys[0]! - py) - (xs[0]! - px) * (ys[2]! - py)) / d;
        if (a >= 0 && b >= 0 && a + b <= 1) img[y * W + x] = 235;
      }
    }
  }
});
const out = Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), Buffer.from(img)]);
writeFileSync(process.argv[2]!, out);

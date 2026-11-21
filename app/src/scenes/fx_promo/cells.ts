// Eight tiny procedural "scenes" drawn in Canvas2D. Used by the s8 card wall (atlas) and its full-frame dive-ins.
import { F, font } from '../../engine/type';
import type { AudioSample } from '../../engine/audio';
import { C } from './kit';

export const CELL_NAMES = ['surface', 'spectrum', 'orbit', 'type', 'ripple', 'lissajous', 'rings', 'counter'];

export function drawCell(g: CanvasRenderingContext2D, idx: number, x: number, y: number, w: number, h: number, T: number, a: AudioSample) {
  const kind = idx % 8;
  const u = Math.min(w, h);
  const cx = x + w / 2, cy = y + h / 2;
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = idx % 3 === 1 ? '#0b0b0d' : C.void;
  g.fillRect(x, y, w, h);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ph = T + idx * 1.7;
  if (kind === 0) {
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      for (let i = 0; i <= 80; i++) {
        const sx = x + (w * i) / 80;
        const sy = cy + Math.sin(i * 0.13 - ph * 1.4 + k * 0.35) * h * (0.18 + 0.02 * k) + (k - 4) * h * 0.035;
        if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
      }
      g.strokeStyle = k === 4 ? C.signal : C.bone; g.globalAlpha = k === 4 ? 1 : 0.45; g.lineWidth = u * 0.008; g.stroke();
    }
  } else if (kind === 1) {
    const n = 24;
    for (let i = 0; i < n; i++) {
      const band = (a.low * (1 - i / n) + a.high * (i / n)) * 0.8 + 0.2 * Math.abs(Math.sin(i * 1.7 + ph * 3));
      const bh = h * 0.75 * band;
      g.fillStyle = i % 6 === 0 ? C.signal : C.bone;
      g.fillRect(x + w * 0.08 + ((w * 0.84) / n) * i, y + h * 0.88 - bh, (w * 0.84) / n - u * 0.012, bh);
    }
  } else if (kind === 2) {
    g.strokeStyle = C.ash; g.lineWidth = u * 0.004;
    for (let r = 1; r <= 3; r++) { g.beginPath(); g.ellipse(cx, cy, u * 0.13 * r, u * 0.13 * r * 0.55, 0, 0, Math.PI * 2); g.stroke(); }
    for (let r = 1; r <= 3; r++) {
      const an = ph * (1.6 / r) + r;
      g.fillStyle = r === 2 ? C.signal : C.bone;
      g.beginPath(); g.arc(cx + Math.cos(an) * u * 0.13 * r, cy + Math.sin(an) * u * 0.13 * r * 0.55, u * (0.025 + 0.01 * a.kick), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = C.bone; g.beginPath(); g.arc(cx, cy, u * 0.05, 0, Math.PI * 2); g.fill();
  } else if (kind === 3) {
    const words = ['LOUD', 'FAST', 'LIVE', 'f(t)'];
    const wv = words[Math.floor(ph * 1.03) % 4]!;
    g.font = font(F.archivo([62, 100, 125][Math.floor(ph * 2.06) % 3]!, 900), h * 0.42);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = Math.floor(ph * 2.06) % 2 ? C.signal : C.bone;
    g.fillText(wv, cx, cy);
  } else if (kind === 4) {
    const nx = 16, ny = 9;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const px = x + (w * (i + 0.5)) / nx, py = y + (h * (j + 0.5)) / ny;
      const d = Math.hypot(i - nx / 2, (j - ny / 2) * 1.6);
      const v = 0.5 + 0.5 * Math.sin(d * 0.9 - ph * 4);
      g.fillStyle = v > 0.85 ? C.signal : C.bone; g.globalAlpha = 0.25 + 0.75 * v;
      g.beginPath(); g.arc(px, py, u * 0.012 * (0.4 + v), 0, Math.PI * 2); g.fill();
    }
  } else if (kind === 5) {
    g.beginPath();
    for (let i = 0; i <= 300; i++) {
      const s = (i / 300) * Math.PI * 2;
      const sx = cx + Math.sin(3 * s + ph * 0.7) * w * 0.32, sy = cy + Math.sin(4 * s) * h * 0.36;
      if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
    }
    g.strokeStyle = C.ice; g.lineWidth = u * 0.008; g.stroke();
    const s = (ph * 0.5) % (Math.PI * 2);
    g.fillStyle = C.signal; g.beginPath(); g.arc(cx + Math.sin(3 * s + ph * 0.7) * w * 0.32, cy + Math.sin(4 * s) * h * 0.36, u * 0.03, 0, Math.PI * 2); g.fill();
  } else if (kind === 6) {
    for (let r = 0; r < 10; r++) {
      const z = ((r + ph * 1.5) % 10) / 10;
      const sz = u * 0.04 / Math.max(0.06, 1 - z);
      g.save(); g.translate(cx, cy); g.rotate(z * 1.2 + ph * 0.2);
      g.strokeStyle = r % 4 === 0 ? C.signal : C.bone; g.globalAlpha = Math.min(1, (1 - z) * 2) * z; g.lineWidth = u * 0.006;
      g.strokeRect(-sz, -sz * 0.6, sz * 2, sz * 1.2); g.restore();
    }
  } else {
    g.font = font(F.mono(600), h * 0.34);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.bone;
    g.fillText(T.toFixed(2), cx, cy - h * 0.05);
    g.font = font(F.mono(400), h * 0.09); g.fillStyle = C.signal;
    g.fillText('t (s)', cx, cy + h * 0.25);
  }
  g.restore();
  g.globalAlpha = 1;
}

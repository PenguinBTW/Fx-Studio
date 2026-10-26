// Reusable pulse-and-sparks effect. One closed-form system, driven only by (t - t0), used in
// Beat 1 (the door rod) and Beat 4 (the human reach) so the two moments visibly rhyme.
import type { LineBatch } from '../../engine/lines';
import { hash, smoothstep, lerp } from '../../engine/util';
import { GLOW } from './palette';

export type V3 = [number, number, number];

export interface PulseSpec {
  t0: number;
  /** seconds for the bright dash to cross from `from` to `to` */
  travel: number;
  from: V3;
  to: V3;
  /** 30..60 */
  sparks: number;
  seed: number;
  /** true when +y points down the screen (2D pixel space), so gravity flips */
  yDown?: boolean;
}

export const SPARK_LIFE_MAX = 0.8;

/** 0..1 red flare strength at the gap (for bloom / DoF follow). */
export function flareAt(t: number, s: PulseSpec): number {
  const tau = t - (s.t0 + s.travel);
  return tau < 0 ? 0 : Math.exp(-tau * 7) * (1 - smoothstep(0.45, 0.7, tau));
}

/** Pulse head position at t (null when not travelling). */
export function pulseHead(t: number, s: PulseSpec): V3 | null {
  const tau = t - s.t0;
  if (tau < 0 || tau > s.travel) return null;
  const u = tau / s.travel;
  const k = u * (0.35 * u * (3 - 2 * u) + 0.65);
  return [lerp(s.from[0], s.to[0], k), lerp(s.from[1], s.to[1], k), lerp(s.from[2], s.to[2], k)];
}

export function emitPulse(lines: LineBatch, t: number, s: PulseSpec, alpha = 1): void {
  const tau = t - s.t0;
  if (tau < 0) return;
  const dx = s.to[0] - s.from[0], dy = s.to[1] - s.from[1], dz = s.to[2] - s.from[2];
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const at = (k: number): V3 => [s.from[0] + dx * k, s.from[1] + dy * k, s.from[2] + dz * k];
  const bone = GLOW.bone, red = GLOW.signal;

  if (tau <= s.travel) {
    const u = tau / s.travel;
    const k = u * (0.35 * u * (3 - 2 * u) + 0.65);
    const tail = Math.max(0, k - 0.17);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a = at(lerp(tail, k, i / N)), b = at(lerp(tail, k, (i + 1) / N));
      const w = ((i + 1) / N) ** 2;
      lines.seg(a[0], a[1], a[2], b[0], b[1], b[2], 3.0, bone[0] * 1.8, bone[1] * 1.8, bone[2] * 1.8, w * alpha);
    }
    if (tail > 0.01) {
      const a = at(0), b = at(tail);
      lines.seg(a[0], a[1], a[2], b[0], b[1], b[2], 1.2, bone[0], bone[1], bone[2], 0.16 * alpha);
    }
    return;
  }

  const tau2 = tau - s.travel;
  const tip = s.to;
  const flare = flareAt(t, s);
  if (flare > 0.01) {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + hash(s.seed, i, 7) * 0.8;
      const L = len * 0.075 * (0.35 + flare);
      lines.seg(tip[0], tip[1], tip[2], tip[0] + Math.cos(ang) * L, tip[1] + Math.sin(ang) * L, tip[2], 2.2, red[0], red[1], red[2], flare * alpha);
    }
    lines.seg(tip[0] - len * 0.012, tip[1], tip[2], tip[0] + len * 0.012, tip[1], tip[2], 4.0, red[0], red[1], red[2], flare * alpha);
  }
  const g = len * 1.6;
  const fy = s.yDown ? -1 : 1;
  for (let i = 0; i < s.sparks; i++) {
    const h1 = hash(s.seed, i, 1), h2 = hash(s.seed, i, 2), h3 = hash(s.seed, i, 3), h4 = hash(s.seed, i, 4);
    const life = 0.45 + 0.35 * h3;
    if (tau2 >= life) continue;
    const ang = h1 * Math.PI * 2;
    const sp = len * (0.25 + 0.9 * h2);
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + len * 0.25, vz = (h4 - 0.5) * sp * 0.6;
    const pos = (q: number): V3 => [tip[0] + vx * q, tip[1] + fy * (vy * q - 0.5 * g * q * q), tip[2] + vz * q];
    const p = pos(tau2), p0 = pos(Math.max(0, tau2 - 0.04));
    const a = (1 - tau2 / life) ** 1.5 * alpha;
    lines.seg(p0[0], p0[1], p0[2], p[0], p[1], p[2], 1.6, red[0], red[1], red[2], a);
  }
}

// Reusable Pulse-and-Sparks System for "THE INTERLOCK"
// Used identically in Beat 1 (t = 10.0, 12.2, 13.8) and Beat 4 (t = 63.5).
// 1. Emissive pulse dash travels from start to gap.
// 2. Cannot cross the gap: flares in --signal red at the rod tip.
// 3. Breaks into 30-60 short sparks that fall away with gravity and fade within 0.8s.
// 4. Closed-form analytic function of (t - t0).

import { mulberry32, clamp, lerp } from '../../engine/util';
import { LIN } from './palette';

export interface PulseSparksDef {
  t0: number;               // trigger time
  travelDur?: number;       // time to reach gap (default 0.35s)
  sparkCount?: number;      // default 48
  seed?: number;            // PRNG seed for deterministic sparks
}

export interface SparkSegment {
  p0: [number, number, number];
  p1: [number, number, number];
  alpha: number;
}

export class PulseSparks {
  /**
   * Computes the traveling dash position along a line from start to gap.
   * Returns null if pulse is not active.
   */
  static getTravelingPulse(
    t: number,
    t0: number,
    start: [number, number, number],
    gap: [number, number, number],
    travelDur = 0.35,
    dashFraction = 0.2
  ): { p0: [number, number, number]; p1: [number, number, number]; intensity: number } | null {
    const age = t - t0;
    if (age < 0 || age >= travelDur) return null;

    const u = age / travelDur;
    const uHead = clamp(u, 0, 1);
    const uTail = clamp(u - dashFraction, 0, 1);

    const p0: [number, number, number] = [
      lerp(start[0], gap[0], uTail),
      lerp(start[1], gap[1], uTail),
      lerp(start[2], gap[2], uTail),
    ];
    const p1: [number, number, number] = [
      lerp(start[0], gap[0], uHead),
      lerp(start[1], gap[1], uHead),
      lerp(start[2], gap[2], uHead),
    ];

    return { p0, p1, intensity: 1.0 + 0.5 * Math.sin(u * Math.PI) };
  }

  /**
   * Computes flare intensity at the gap point.
   */
  static getGapFlare(t: number, t0: number, travelDur = 0.35): number {
    const age = t - (t0 + travelDur);
    if (age < 0 || age > 0.8) return 0;
    return Math.exp(-age * 12.0);
  }

  /**
   * Computes the 30-60 falling spark segments at the gap.
   */
  static getSparks(
    t: number,
    t0: number,
    gap: [number, number, number],
    travelDur = 0.35,
    sparkCount = 48,
    seed = 42
  ): SparkSegment[] {
    const age = t - (t0 + travelDur);
    if (age < 0 || age > 0.8) return [];

    const rnd = mulberry32(seed);
    const sparks: SparkSegment[] = [];
    const gravity = 4.2; // downward acceleration

    for (let i = 0; i < sparkCount; i++) {
      // Cone velocity pointing slightly backward/downward from gap
      const theta = (rnd() - 0.5) * 1.8;
      const phi = (rnd() - 0.5) * 1.8;
      const speed = 0.8 + rnd() * 2.2;

      const vx = -Math.cos(theta) * speed * 0.6;
      const vy = Math.sin(theta) * speed * 0.8;
      const vz = Math.sin(phi) * speed * 0.5;

      // Position at current age
      const x = gap[0] + vx * age;
      const y = gap[1] + vy * age - 0.5 * gravity * age * age;
      const z = gap[2] + vz * age;

      // Tail position (short streak based on velocity)
      const tailDt = 0.025;
      const prevAge = Math.max(0, age - tailDt);
      const xPrev = gap[0] + vx * prevAge;
      const yPrev = gap[1] + vy * prevAge - 0.5 * gravity * prevAge * prevAge;
      const zPrev = gap[2] + vz * prevAge;

      const alpha = Math.exp(-age / 0.24) * (0.8 + 0.2 * rnd());
      if (alpha > 0.02) {
        sparks.push({
          p0: [xPrev, yPrev, zPrev],
          p1: [x, y, z],
          alpha,
        });
      }
    }

    return sparks;
  }
}

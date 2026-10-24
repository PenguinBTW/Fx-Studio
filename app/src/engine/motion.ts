// MotionBus: Unified Kinematics, Analytical Springs & Easing Engine
// Implements closed-form second-order physical spring solvers with initial velocity injection,
// bezier curves, stagger distributions, procedural LFOs, and speech cue timing streams.
import { clamp, ease, noise1, TAU } from './util';

export type EasingCurve = 'cubic' | 'expo' | 'elastic' | [number, number, number, number];
export type StaggerPattern = 'start' | 'center-out' | 'random' | 'wave';
export type LFOWaveform = 'sine' | 'triangle' | 'tri' | 'saw' | 'square' | 'noise';

export interface SpringOptions {
  freq?: number;      // Natural frequency in Hz (default: 2.5)
  damping?: number;   // Damping ratio zeta: <1 under-damped, 1 critical, >1 over-damped (default: 0.7)
  v0?: number;        // Initial velocity at trigger (prevents momentum loss on handoffs)
  scale?: number;     // Amplitude scale (default: 1.0)
  mass?: number;      // Physical mass m (kg)
  stiffness?: number; // Physical stiffness k (N/m)
  initialVelocity?: number; // Alias for v0
}

export class MotionBus {
  private cues = new Map<string, number>();

  /** Register an external timestamp for speech or audio cues */
  registerCue(id: string, timestamp: number): void {
    this.cues.set(id, timestamp);
  }

  /**
   * 1. Closed-form Second-Order Physical Spring Solver with Initial Velocity Injection
   * Evaluates the continuous ODE step response:
   *   ddot{x} + 2*zeta*omega*dot{x} + omega^2 * x = 0
   * with exact initial velocity v0 at t = triggerT.
   */
  spring(triggerT: number, t: number, opts: SpringOptions = {}): number {
    const tau = t - triggerT;
    if (tau <= 0) return 0;

    let freq = opts.freq ?? 2.5;
    let zeta = opts.damping ?? 0.7;
    const v0 = opts.v0 ?? opts.initialVelocity ?? 0;
    const scale = opts.scale ?? 1.0;

    if (opts.stiffness !== undefined && opts.mass !== undefined) {
      const m = Math.max(1e-4, opts.mass);
      const k = Math.max(1e-4, opts.stiffness);
      const omega = Math.sqrt(k / m);
      freq = omega / TAU;
      if (opts.damping !== undefined) {
        zeta = opts.damping / (2 * Math.sqrt(k * m));
      }
    }

    freq = Math.max(1e-4, freq);
    zeta = Math.max(0, zeta);
    const omegaN = TAU * freq;

    if (Math.abs(zeta - 1.0) <= 1e-4) {
      // ------------------------------------------------ Critically damped (zeta == 1)
      const envelope = Math.exp(-omegaN * tau);
      const deviation = -envelope * (1 + (omegaN - v0) * tau);
      return (1 + deviation) * scale;
    } else if (zeta < 1.0) {
      // ------------------------------------------------ Under-damped (zeta < 1)
      const omegaD = omegaN * Math.sqrt(Math.max(0, 1 - zeta * zeta));
      if (omegaD < 1e-5) {
        const envelope = Math.exp(-omegaN * tau);
        const deviation = -envelope * (1 + (omegaN - v0) * tau);
        return (1 + deviation) * scale;
      }
      const envelope = Math.exp(-zeta * omegaN * tau);
      const B = (v0 - zeta * omegaN) / omegaD;
      const deviation = -envelope * (Math.cos(omegaD * tau) - B * Math.sin(omegaD * tau));
      return (1 + deviation) * scale;
    } else {
      // ------------------------------------------------ Over-damped (zeta > 1)
      const omegaR = omegaN * Math.sqrt(Math.max(0, zeta * zeta - 1));
      if (omegaR < 1e-5) {
        const envelope = Math.exp(-omegaN * tau);
        const deviation = -envelope * (1 + (omegaN - v0) * tau);
        return (1 + deviation) * scale;
      }
      const s1 = -zeta * omegaN + omegaR;
      const s2 = -zeta * omegaN - omegaR;
      const c1 = (v0 + s2) / (s1 - s2);
      const c2 = -1 - c1;
      const deviation = c1 * Math.exp(s1 * tau) + c2 * Math.exp(s2 * tau);
      return (1 + deviation) * scale;
    }
  }

  /**
   * 2. Standard & Custom Cubic Bezier Easing Curves
   */
  ease(t: number, t0: number, t1: number, curve: EasingCurve = 'cubic'): number {
    if (t <= t0) return 0;
    if (t >= t1) return 1;
    const u = clamp((t - t0) / Math.max(1e-4, t1 - t0), 0, 1);

    if (curve === 'cubic') return ease.inOutCubic(u);
    if (curve === 'expo') return ease.outExpo(u);
    if (curve === 'elastic') return this.spring(0, u, { freq: 2.0, damping: 0.5 });

    if (Array.isArray(curve)) {
      return this.solveCubicBezier(u, curve[0], curve[1], curve[2], curve[3]);
    }

    return u;
  }

  /**
   * 3. Stagger Engine: Generates delay offsets for N elements
   */
  stagger(count: number, totalDuration: number, pattern: StaggerPattern = 'start'): number[] {
    if (count <= 1) return [0];
    const delays = new Array<number>(count);

    if (pattern === 'start') {
      const step = totalDuration / (count - 1);
      for (let i = 0; i < count; i++) delays[i] = i * step;
    } else if (pattern === 'center-out') {
      const mid = (count - 1) / 2;
      const maxDist = Math.max(mid, 1);
      for (let i = 0; i < count; i++) {
        const dist = Math.abs(i - mid);
        delays[i] = (dist / maxDist) * totalDuration;
      }
    } else if (pattern === 'wave') {
      for (let i = 0; i < count; i++) {
        const phase = (i / (count - 1)) * Math.PI;
        delays[i] = Math.sin(phase) * totalDuration;
      }
    } else if (pattern === 'random') {
      // Deterministic pseudo-random distribution
      for (let i = 0; i < count; i++) {
        const hash = Math.abs(Math.sin((i + 1) * 12.9898)) % 1;
        delays[i] = hash * totalDuration;
      }
    }

    return delays;
  }

  /**
   * 4. Procedural LFO Oscillators for Ambient Animation and Silent Sequences
   * Uses floor-based phase calculation to remain robust under negative sub-frame times.
   */
  lfo(wave: LFOWaveform, frequencyHz: number, t: number): number {
    const f = Math.abs(frequencyHz);
    const phase = f === 0 ? 0 : t * frequencyHz - Math.floor(t * frequencyHz);
    const effectiveWave = wave === 'tri' ? 'triangle' : wave;
    switch (effectiveWave) {
      case 'sine':
        return Math.sin(t * frequencyHz * TAU);
      case 'triangle':
        return 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
      case 'saw':
        return 2 * phase - 1;
      case 'square':
        return phase < 0.5 ? 1 : -1;
      case 'noise':
        return noise1(t * frequencyHz * 10, 1337);
      default:
        return 0;
    }
  }

  /**
   * 5. Speech & Voiceover Timing Stream
   * Evaluates a smooth bell curve around the cue timestamp (0..1).
   */
  speechCue(cueId: string, t: number, window = 0.12): number {
    const cueT = this.cues.get(cueId);
    if (cueT === undefined) return 0;
    const delta = (t - cueT) / Math.max(1e-3, window);
    return Math.exp(-0.5 * delta * delta);
  }

  /**
   * Hybrid Newton-Raphson + Bisection root solver for cubic bezier curve B(t) = [x(t), y(t)]
   */
  private solveCubicBezier(xTarget: number, x1: number, y1: number, x2: number, y2: number): number {
    if (xTarget <= 0) return 0;
    if (xTarget >= 1) return 1;

    // Clamp control points to valid [0, 1] range for monotonicity
    const cx1 = clamp(x1, 0, 1);
    const cx2 = clamp(x2, 0, 1);

    let lo = 0, hi = 1;
    let t = xTarget;

    for (let i = 0; i < 12; i++) {
      const currentX = this.bezierVal(t, cx1, cx2);
      const err = currentX - xTarget;
      if (Math.abs(err) < 1e-6) break;

      // Update bracket
      if (err < 0) {
        lo = t;
      } else {
        hi = t;
      }

      const dX = this.bezierDeriv(t, cx1, cx2);
      if (Math.abs(dX) > 1e-5) {
        const nextT = t - err / dX;
        // Accept Newton step only if it stays strictly inside the bracket
        if (nextT > lo && nextT < hi) {
          t = nextT;
          continue;
        }
      }

      // Fallback to binary bisection search
      t = (lo + hi) * 0.5;
    }

    return this.bezierVal(clamp(t, 0, 1), y1, y2);
  }

  private bezierVal(t: number, p1: number, p2: number): number {
    const s = 1 - t;
    return 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t;
  }

  private bezierDeriv(t: number, p1: number, p2: number): number {
    const s = 1 - t;
    return 3 * s * s * p1 + 6 * s * t * (p2 - p1) + 3 * t * t * (1 - p2);
  }

  /** Static delegates conforming to modules-reference.md contract */
  static spring(triggerOrT: number, tOrOpts?: number | SpringOptions, maybeOpts?: SpringOptions): number {
    if (typeof tOrOpts === 'object' || tOrOpts === undefined) {
      return motion.spring(0, triggerOrT, tOrOpts);
    }
    return motion.spring(triggerOrT, tOrOpts, maybeOpts);
  }

  static ease(t: number, t0OrP1x: number, t1OrP1y: number, curveOrP2x?: EasingCurve | number, p2y?: number): number {
    if (typeof curveOrP2x === 'number' && typeof p2y === 'number') {
      return motion.ease(t, 0, 1, [t0OrP1x, t1OrP1y, curveOrP2x, p2y]);
    }
    return motion.ease(t, t0OrP1x, t1OrP1y, curveOrP2x as EasingCurve);
  }

  static lfo(waveOrT: LFOWaveform | number, freqHz: number, tOrWave?: number | LFOWaveform): number {
    if (typeof waveOrT === 'number' && typeof tOrWave === 'string') {
      return motion.lfo(tOrWave, freqHz, waveOrT);
    }
    return motion.lfo(waveOrT as LFOWaveform, freqHz, tOrWave as number);
  }
}

export const motion = new MotionBus();

// =============================================================================
// VIOPLS: "YOUR BODY HAS A PERMANENT CHILD LOCK"
// SCENE: THE AUTONOMIC AIR-GAP CHAMBER (0.0s - 16.0s)
//
// Canonical Minimalist 3D Architecture:
// - Cavernous architectural perspective vault built from wireframe line segments
// - Pinhole camera (Cam { p, R, U, F, f }) with cinematic tracking & snap cuts
// - Depth fade, hairline bone-white lines (#EEE9DF), signal orange (#FF4D12)
// - In-world suspended mechanical flip-board projected in 3D space (planeAffine)
// - Physical synaptic signal pulse running down floor bus, halting at chasm edge
// - Overhead dual-homed bypass arches linking conscious gantry to autonomic core
// - Deterministic f(t), zero Math.random(), 324spp motion blur compatible
// =============================================================================

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, Layer2D, W, H } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { LIN, rgba } from '../../engine/palette';
import { F, font } from '../../engine/type';
import { clamp, lerp, ease, prog, mulberry32, springStep, pulse, TAU } from '../../engine/util';
import { RW, RH, RD, ZF, CHASM, BOARD, BULKHEAD, KIND, buildChamber, type Segs } from './autonomic-geo';

type RGB = [number, number, number];
type V3 = [number, number, number];

const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix3 = (a: RGB, b: RGB, k: number): RGB => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

const vadd = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vsc = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vnorm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const vlerp = (a: V3, b: V3, k: number): V3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];

/** Rodrigues rotation of v about unit axis k by angle a */
const vrot = (v: V3, k: V3, a: number): V3 => {
  const c = Math.cos(a), s = Math.sin(a), kv = vdot(k, v), x = vcross(k, v);
  return [
    v[0] * c + x[0] * s + k[0] * kv * (1 - c),
    v[1] * c + x[1] * s + k[1] * kv * (1 - c),
    v[2] * c + x[2] * s + k[2] * kv * (1 - c),
  ];
};

/** Pinhole camera */
interface Cam {
  p: V3;
  R: V3;
  U: V3;
  F: V3;
  f: number;
  cx: number;
  cy: number;
}

interface Key {
  p: V3;
  tg: V3;
  roll: number;
  f: number;
}

interface Shot {
  t0: number;
  t1: number;
  a?: Key;
  b?: Key;
  e?: (x: number) => number;
  snap: number;
  kick?: number;
  rollSpring?: [number, number];
  key?: (t: number) => Key;
}

interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

const K = (p: V3, tg: V3, roll: number, f: number): Key => ({ p, tg, roll, f });
const lerpKey = (a: Key, b: Key, k: number): Key => ({
  p: vlerp(a.p, b.p, k),
  tg: vlerp(a.tg, b.tg, k),
  roll: lerp(a.roll, b.roll, k),
  f: lerp(a.f, b.f, k),
});

export default class AutonomicLockoutScene extends Scene {
  /** The back wall background quad: a hair lighter than ink to create contrast */
  roomBg = new FSPass(
    /* glsl */ `
    uniform vec2 q0, q1, q2, q3;
    uniform float wallOn, coreGlow;
    uniform vec2 coreP;
    float side(vec2 p, vec2 a, vec2 b) { return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); }
    void main() {
      vec2 px = vec2(vUv.x, 1.0 - vUv.y) * vec2(${W}.0, ${H}.0);
      vec3 c = C_INK;
      float s0 = side(px, q0, q1), s1 = side(px, q1, q2), s2 = side(px, q2, q3), s3 = side(px, q3, q0);
      float inW = ((s0 >= 0.0 && s1 >= 0.0 && s2 >= 0.0 && s3 >= 0.0) || (s0 <= 0.0 && s1 <= 0.0 && s2 <= 0.0 && s3 <= 0.0)) ? 1.0 : 0.0;
      c = mix(c, C_INK2 * 1.25, inW * wallOn);

      // Core air-gap bulkhead glow: soft pool of ember light behind the isolation gate
      float ds = length(px - coreP);
      c += C_SIGNAL * 0.075 * coreGlow * exp(-ds / 240.0) * inW;

      // Subtle atmospheric vignette
      float d = length((px - vec2(${W / 2}.0, ${H / 2}.0)) / vec2(${W}.0, ${H}.0));
      c *= 1.0 - 0.42 * smoothstep(0.2, 0.85, d);
      fragColor = vec4(c, 1.0);
    }`,
    {
      q0: { value: new THREE.Vector2() },
      q1: { value: new THREE.Vector2() },
      q2: { value: new THREE.Vector2() },
      q3: { value: new THREE.Vector2() },
      wallOn: { value: 1 },
      coreGlow: { value: 1 },
      coreP: { value: new THREE.Vector2(W / 2, H / 2) },
    }
  );

  // Line Batches
  ink = new LineBatch(140000, { blend: 'max' });   // structural bone hairlines behind board
  glow = new LineBatch(70000, { blend: 'add' });    // glowing signal orange / sparks behind board
  inkF = new LineBatch(100000, { blend: 'max' });  // lines in front of board
  glowF = new LineBatch(60000, { blend: 'add' });   // glowing lines in front of board

  // 2D Canvas Layers
  boardText = new Layer2D();  // in-world text stamped on flip-board
  hudText = new Layer2D();    // razor-sharp minimalist corner telemetry

  private segs!: Segs;
  private shots: Shot[] = [];
  private stamps = [0.15, 4.25, 8.55, 12.55]; // time of narrative stamps
  private P5 = [0, 0, 0, 0, 0];

  // The board plane in 3D world space (for hero-plane occlusion split)
  private bO: V3 = [0, BOARD.yc, BOARD.z];
  private bN: V3 = [0, 0, 1];

  private front(x: number, y: number, z: number): boolean {
    return (x - this.bO[0]) * this.bN[0] + (y - this.bO[1]) * this.bN[1] + (z - this.bO[2]) * this.bN[2] > 0;
  }

  private batch(kind: 'i' | 'g', x: number, y: number, z: number): LineBatch {
    const f = this.front(x, y, z);
    return kind === 'i' ? (f ? this.inkF : this.ink) : (f ? this.glowF : this.glow);
  }

  override async init(): Promise<void> {
    this.segs = buildChamber();
    this.buildCinematicShots();
  }

  private buildCinematicShots(): void {
    this.shots = [
      // Shot 1 (0.0s - 4.2s): "YOU KNOW YOU'RE SWALLOWING A POISON"
      // Deep perspective entrance tracking smoothly down the central aisle
      {
        t0: 0.0,
        t1: 4.2,
        a: K([0.0, 1.82, 3.2], [0.0, 2.45, -12.0], 0.02, 920),
        b: K([0.0, 1.95, -1.8], [0.0, 2.55, -12.0], -0.01, 980),
        e: ease.inOutCubic,
        snap: 0.0,
        rollSpring: [1.2, 0.4],
      },
      // Shot 2 (4.2s - 8.5s): "AND YOUR BODY STILL CAN'T HEAR YOU"
      // Snap to dramatic low hero angle looking up across the air-gap at the suspended board & bulkhead
      {
        t0: 4.2,
        t1: 8.5,
        a: K([-1.5, 0.85, -3.2], [0.15, 2.15, -8.2], -0.05, 780),
        b: K([-1.2, 0.95, -4.2], [0.10, 2.20, -8.2], -0.02, 820),
        e: ease.linear,
        snap: 0.12,
        kick: -0.04,
      },
      // Shot 3 (8.5s - 12.5s): "SCREAMING INTO AN EMPTY ROOM"
      // The board flips 180°! Camera whips up into a sweeping high-angle cathedral orbit
      {
        t0: 8.5,
        t1: 12.5,
        key: (t) => this.orbitKey(t),
        snap: 0.14,
        kick: 0.05,
      },
      // Shot 4 (12.5s - 16.0s): "PERMANENT CHILD LOCK // THE MIDDLE GROUND"
      // Lateral tracking punch-in framing the illuminated bypass arches bridging across the chasm
      {
        t0: 12.5,
        t1: 16.0,
        a: K([1.95, 2.45, -3.2], [0.0, 2.55, -7.0], 0.03, 820),
        b: K([0.45, 2.35, -3.7], [0.0, 2.55, -7.0], 0.01, 860),
        e: ease.outCubic,
        snap: 0.11,
      },
    ];
  }

  private orbitKey(t: number): Key {
    const u = prog(t, 8.5, 12.5);
    // Soaring high angle swinging around the suspended board and chasm
    const phi = lerp(0.75, -0.55, ease.inOutQuad(u));
    const r = lerp(3.8, 3.2, u);
    const p: V3 = [Math.sin(phi) * r, 3.75 - 0.3 * u, -6.2 + Math.cos(phi) * r];
    const tg: V3 = [0.1 * Math.sin(phi), BOARD.yc, BOARD.z];
    const roll = 0.07 * Math.sin(phi);
    return { p, tg, roll, f: 880 + 40 * Math.sin(u * Math.PI) };
  }

  // Camera math
  private camAt(t: number): Cam {
    let s = this.shots[0]!;
    for (const cur of this.shots) {
      if (t >= cur.t0) s = cur;
    }

    let k: Key;
    if (s.key) {
      k = s.key(t);
    } else {
      const u = (s.e ?? ease.linear)(prog(t, s.t0, s.t1));
      k = lerpKey(s.a!, s.b!, u);
    }

    // Snap & kick spring physics
    if (s.snap > 0) {
      const d = t - s.t0;
      if (d >= 0 && d < 0.6) {
        const kick = (s.kick ?? 0.04) * Math.exp(-d * 10) * Math.sin(d * 24);
        k.p[0] += kick * 0.5;
        k.roll += kick * 0.8;
      }
    }

    // Convert Key to orthonormal Cam
    const F = vnorm(vsub(k.tg, k.p));
    let R = vcross(F, [0, 1, 0]);
    if (Math.hypot(R[0], R[1], R[2]) < 1e-4) R = [1, 0, 0];
    else R = vnorm(R);
    let U = vcross(R, F);

    if (k.roll !== 0) {
      R = vrot(R, F, k.roll);
      U = vrot(U, F, k.roll);
    }

    return { p: k.p, R, U, F, f: k.f, cx: W / 2, cy: H / 2 };
  }

  private depth(c: Cam, x: number, y: number, z: number): number {
    return (x - c.p[0]) * c.F[0] + (y - c.p[1]) * c.F[1] + (z - c.p[2]) * c.F[2];
  }

  private proj(c: Cam, x: number, y: number, z: number): [number, number] | null {
    const d: V3 = [x - c.p[0], y - c.p[1], z - c.p[2]];
    const zCam = vdot(d, c.F);
    if (zCam <= 0.05) return null;
    const xCam = vdot(d, c.R);
    const yCam = vdot(d, c.U);
    return [c.cx + (xCam / zCam) * c.f, c.cy - (yCam / zCam) * c.f];
  }

  private clipSeg(c: Cam, ax: number, ay: number, az: number, bx: number, by: number, bz: number, P: number[]): boolean {
    const near = 0.1;
    let da = this.depth(c, ax, ay, az), db = this.depth(c, bx, by, bz);
    if (da < near && db < near) return false;
    if (da < near) {
      const u = (near - da) / (db - da);
      ax += (bx - ax) * u; ay += (by - ay) * u; az += (bz - az) * u;
      da = near;
    } else if (db < near) {
      const u = (near - db) / (da - db);
      bx += (ax - bx) * u; by += (ay - by) * u; bz += (az - bz) * u;
      db = near;
    }
    const pa = this.proj(c, ax, ay, az), pb = this.proj(c, bx, by, bz);
    if (!pa || !pb) return false;
    P[0] = pa[0]; P[1] = pa[1]; P[2] = pb[0]; P[3] = pb[1]; P[4] = (da + db) / 2;

    // Screen-space frustum bounds culling
    if ((P[0]! < -300 && P[2]! < -300) || (P[0]! > W + 300 && P[2]! > W + 300) ||
        (P[1]! < -300 && P[3]! < -300) || (P[1]! > H + 300 && P[3]! > H + 300)) {
      return false;
    }
    return true;
  }

  /** Canvas affine putting canvas point (cx, cy) at world point P, with axes ux and uy */
  private planeAffine(c: Cam, P: V3, ux: V3, uy: V3, m: number, cx: number, cy: number, scale = 1): Affine | null {
    const d = 10;
    const p0 = this.proj(c, P[0], P[1], P[2]);
    const pa = this.proj(c, P[0] + ux[0] * m * d, P[1] + ux[1] * m * d, P[2] + ux[2] * m * d);
    const pb = this.proj(c, P[0] + uy[0] * m * d, P[1] + uy[1] * m * d, P[2] + uy[2] * m * d);
    if (!p0 || !pa || !pb) return null;
    const [x0, y0] = p0, [xa, ya] = pa, [xb, yb] = pb;
    const a = ((xa - x0) / d) * scale, b = ((ya - y0) / d) * scale;
    const cc = ((xb - x0) / d) * scale, dd = ((yb - y0) / d) * scale;
    return { a, b, c: cc, d: dd, e: x0 - a * cx - cc * cy, f: y0 - b * cx - dd * cy };
  }

  // Flip-board pose & kinematics
  private boardPose(t: number): { O: V3; th: number; uyA: V3; nA: V3 } {
    let th = 0;
    // Flipped 180 degrees at t = 8.5s
    if (t >= 8.5) {
      th += Math.PI * springStep(t - 8.5, 2.5, 0.45);
    }
    // Stamp vibration hits
    for (const s of this.stamps) {
      if (t >= s && t - s < 1.0) {
        th += 0.042 * Math.sin((t - s) * 22) * Math.exp(-(t - s) * 6.5);
      }
    }

    const O: V3 = [0, BOARD.yc, BOARD.z];
    const uyA: V3 = [0, -Math.cos(th), -Math.sin(th)];
    const nA: V3 = [0, -Math.sin(th), Math.cos(th)];
    return { O, th, uyA, nA };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;

    this.ink.clear();
    this.glow.clear();
    this.inkF.clear();
    this.glowF.clear();

    const cam = this.camAt(t);

    // Update hero plane normal for depth sorting
    const bp = this.boardPose(t);
    this.bO = bp.O;
    this.bN = vdot(bp.nA, vsub(cam.p, bp.O)) > 0 ? bp.nA : vsc(bp.nA, -1);

    // 1. Draw Static Wireframe Architecture
    this.drawChamberArchitecture(cam, t);

    // 2. Draw Dynamic Props (Synaptic Signal Pulse, Sparks, Bypass Arches)
    this.drawSynapticSignals(cam, t);
    this.drawBypassConduits(cam, t);

    // 3. Render Back Wall Background Quad Pass
    this.renderRoomBackground(renderer, cam, t, out);

    // 4. Render Behind-Plane Line Batches
    this.ink.render(renderer, out);
    this.glow.render(renderer, out);

    // 5. Render Suspended Hero Flip-Board in 3D Space (planeAffine)
    const bLayer = this.boardText;
    bLayer.clear();
    this.drawHeroFlipBoard(bLayer.ctx, cam, t, bp);
    bLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, bLayer.upload(), out);

    // 6. Render Front-Plane Line Batches
    this.inkF.render(renderer, out);
    this.glowF.render(renderer, out);

    // 7. Render Razor-Sharp Minimalist Screen Telemetry
    const hLayer = this.hudText;
    hLayer.clear();
    this.drawScreenTelemetry(hLayer.ctx, t);
    hLayer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, hLayer.upload(), out);

    // Compute Post-Processing Envelope
    let stampHit = 0;
    for (const s of this.stamps) {
      if (t >= s) stampHit = Math.max(stampHit, pulse(t, s, 0.08));
    }
    const sh = 4.5 * stampHit;

    return {
      bloom: 0.62 + 0.15 * (t >= 12.5 ? 0.3 : 0.0),
      bloomThreshold: 0.76,
      exposure: 1.0 + 0.14 * stampHit,
      shake: [Math.sin(t * 85) * sh, Math.cos(t * 71) * sh],
      zoom: 1.0 + 0.015 * stampHit,
      ca: 0.28 + 0.12 * stampHit,
      halation: 0.24,
    };
  }

  private renderRoomBackground(renderer: THREE.WebGLRenderer, cam: Cam, t: number, out: THREE.WebGLRenderTarget): void {
    const u = this.roomBg.u;
    const q = [
      [-RW, RH, -RD],
      [RW, RH, -RD],
      [RW, 0, -RD],
      [-RW, 0, -RD],
    ].map(([x, y, z]) => this.proj(cam, x!, y!, z!));

    const qv = [u.q0, u.q1, u.q2, u.q3];
    u.wallOn!.value = q.every((p) => p !== null) ? 1 : 0;
    q.forEach((p, i) => {
      if (p) (qv[i]!.value as THREE.Vector2).set(p[0], p[1]);
    });

    const cp = this.proj(cam, 0, 2.0, BULKHEAD.z);
    if (cp) (u.coreP!.value as THREE.Vector2).set(cp[0], cp[1]);
    u.coreGlow!.value = 0.8 + 0.2 * Math.sin(t * 3.5);

    this.roomBg.render(renderer, out);
  }

  private drawChamberArchitecture(cam: Cam, t: number): void {
    const S = this.segs;
    const s = S.s;
    const P = this.P5;
    const colBone = mul(LIN.bone, 0.88);
    const colGraphite = mul(LIN.graphite, 0.72);
    const colSignal = LIN.signal;

    for (let i = 0; i < S.n; i++) {
      const o = i * 6;
      const ax = s[o]!, ay = s[o + 1]!, az = s[o + 2]!;
      const bx = s[o + 3]!, by = s[o + 4]!, bz = s[o + 5]!;

      if (!this.clipSeg(cam, ax, ay, az, bx, by, bz, P)) continue;

      const kind = S.k[i]!;
      let col = colBone;
      let alpha = S.a[i]! * (1.0 - 0.45 * clamp(P[4]! / 16.0));
      let isGlow = false;

      if (kind === KIND.GRID) {
        col = colGraphite;
        alpha *= 0.7;
      } else if (kind === KIND.LIGHT) {
        col = colBone;
        alpha *= 0.95;
      } else if (kind === KIND.BUS) {
        col = colBone;
      } else if (kind === KIND.BYPASS) {
        // Bypass bridges illuminate intensely in Act 4
        if (t >= 12.0) {
          col = colSignal;
          isGlow = true;
          alpha *= 1.2;
        } else {
          col = colGraphite;
          alpha *= 0.35;
        }
      }

      const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, mz = (az + bz) * 0.5;
      this.batch(isGlow ? 'g' : 'i', mx, my, mz).seg2(P[0]!, P[1]!, P[2]!, P[3]!, S.w[i]!, col, alpha);
    }
  }

  private drawSynapticSignals(cam: Cam, t: number): void {
    const P = this.P5;
    const colSignal = LIN.signal;
    const colEmber = LIN.ember;

    // Floor central bus line signal pulse
    // Travels down from entrance toward chasm
    let pulseZ = 3.5;
    if (t < 4.2) {
      pulseZ = lerp(3.2, -4.5, prog(t, 0.0, 4.2));
    } else if (t < 8.5) {
      pulseZ = lerp(-4.5, CHASM.z0, prog(t, 4.2, 5.4, ease.outCubic));
    } else {
      pulseZ = CHASM.z0; // halted at chasm edge
    }

    // Draw the bright glowing pulse segment along central floor bus
    const pLen = 1.2;
    const zHead = pulseZ;
    const zTail = Math.min(3.5, pulseZ + pLen);
    if (this.clipSeg(cam, 0, -0.35, zHead, 0, -0.35, zTail, P)) {
      this.batch('g', 0, -0.35, (zHead + zTail) * 0.5).seg2(P[0]!, P[1]!, P[2]!, P[3]!, 2.8, colSignal, 1.0);
      this.batch('g', 0, -0.35, (zHead + zTail) * 0.5).seg2(P[0]!, P[1]!, P[2]!, P[3]!, 1.5, colEmber, 1.0);
    }

    // Violent spark explosion into the abyss once pulse reaches the chasm edge (t >= 5.2s)
    if (t >= 5.2 && t < 9.0) {
      const burstAge = t - 5.2;
      const rnd = mulberry32(888);
      const sparkCount = 36;
      for (let i = 0; i < sparkCount; i++) {
        const speed = 1.2 + rnd() * 2.8;
        const angle = -Math.PI * 0.5 + (rnd() - 0.5) * 1.6;
        const zVel = -(rnd() * 1.5 + 0.5);

        // Ballistic fall into chasm
        const life = clamp(burstAge * 0.85);
        const sx0 = (rnd() - 0.5) * 0.2;
        const sy0 = -0.35;
        const sz0 = CHASM.z0;

        const sx1 = sx0 + Math.cos(angle) * speed * life;
        const sy1 = sy0 + Math.sin(angle) * speed * life - 2.5 * life * life;
        const sz1 = sz0 + zVel * life;

        const sparkAlpha = Math.exp(-life * 1.8) * 0.9;
        if (sparkAlpha > 0.05 && this.clipSeg(cam, sx0, sy0, sz0, sx1, sy1, sz1, P)) {
          this.batch('g', sx1, sy1, sz1).seg2(P[0]!, P[1]!, P[2]!, P[3]!, 1.4, rnd() > 0.5 ? colSignal : colEmber, sparkAlpha);
        }
      }
    }
  }

  private drawBypassConduits(cam: Cam, t: number): void {
    if (t < 12.0) return;
    const P = this.P5;
    const colEmber = LIN.ember;
    const colSignal = LIN.signal;

    // Glowing energy packets flowing along the bypass arches across the chasm
    const flowT = (t - 12.0) * 1.8;
    const bridgeZ0 = CHASM.z0 + 0.8;
    const bridgeZ1 = CHASM.z1 - 0.8;

    for (const [side, xOffset] of [[-1, -1.5], [1, 1.5]] as const) {
      const packets = 4;
      for (let p = 0; p < packets; p++) {
        const u = ((flowT + p / packets) % 1.0);
        const u1 = clamp(u + 0.08, 0.0, 1.0);

        const z0 = bridgeZ0 + (bridgeZ1 - bridgeZ0) * u;
        const z1 = bridgeZ0 + (bridgeZ1 - bridgeZ0) * u1;

        const arch0 = Math.sin(u * Math.PI);
        const arch1 = Math.sin(u1 * Math.PI);

        const y0 = 0.4 + arch0 * 2.8;
        const y1 = 0.4 + arch1 * 2.8;

        const x0 = xOffset * (1.0 + arch0 * 0.45);
        const x1 = xOffset * (1.0 + arch1 * 0.45);

        if (this.clipSeg(cam, x0, y0, z0, x1, y1, z1, P)) {
          this.batch('g', x0, y0, z0).seg2(P[0]!, P[1]!, P[2]!, P[3]!, 2.6, colSignal, 1.0);
          this.batch('g', x0, y0, z0).seg2(P[0]!, P[1]!, P[2]!, P[3]!, 1.4, colEmber, 1.0);
        }
      }
    }
  }

  private drawHeroFlipBoard(c: CanvasRenderingContext2D, cam: Cam, t: number, bp: { O: V3; th: number; uyA: V3; nA: V3 }): void {
    const bwMeters = BOARD.x1 - BOARD.x0; // 4.8m
    const bhMeters = BOARD.hh * 2;         // 1.5m
    const bwPx = 1400;                     // resolution of board texture
    const bhPx = (bwPx * bhMeters) / bwMeters; // ~437px
    const m = bwMeters / bwPx;

    const aff = this.planeAffine(cam, bp.O, [1, 0, 0], bp.uyA, m, bwPx / 2, bhPx / 2);
    if (!aff) return;

    c.save();
    c.setTransform(aff.a, aff.b, aff.c, aff.d, aff.e, aff.f);

    // Physical board dark fill (solid occlusion for lines behind it)
    c.fillStyle = rgba('ink', 0.96);
    c.fillRect(0, 0, bwPx, bhPx);

    // Board hairline border & technical corner brackets
    c.strokeStyle = rgba('bone', 0.85);
    c.lineWidth = 2.5;
    c.strokeRect(4, 4, bwPx - 8, bhPx - 8);

    c.strokeStyle = rgba('bone', 0.45);
    c.lineWidth = 1.0;
    c.strokeRect(16, 16, bwPx - 32, bhPx - 32);

    // Corner crosshairs on the physical board
    for (const [cx, cy] of [[28, 28], [bwPx - 28, 28], [28, bhPx - 28], [bwPx - 28, bhPx - 28]]) {
      c.beginPath();
      c.moveTo(cx - 8, cy); c.lineTo(cx + 8, cy);
      c.moveTo(cx, cy - 8); c.lineTo(cx, cy + 8);
      c.stroke();
    }

    // Determine front vs back face based on flip angle th
    const isBackFace = Math.cos(bp.th) < 0;

    c.textAlign = 'center';

    if (!isBackFace) {
      // FRONT FACE (Acts 1 & 2: 0.0s - 8.5s)
      if (t < 4.2) {
        // Beat 1: "YOU KNOW YOU'RE SWALLOWING A POISON"
        c.font = font(F.mono(500), 16);
        c.fillStyle = rgba('ash', 0.9);
        c.letterSpacing = '3px';
        c.fillText('AUTONOMIC ISOLATION CHAMBER  //  KERNEL RING 0', bwPx / 2, 60);

        c.font = font(F.archivo(100, 900), 84);
        c.fillStyle = rgba('bone', 0.98);
        c.fillText("YOU KNOW YOU'RE", bwPx / 2, 175);

        c.fillStyle = rgba('signal', 1.0);
        c.fillText('SWALLOWING A POISON', bwPx / 2, 275);

        c.font = font(F.mono(400), 15);
        c.fillStyle = rgba('ash', 0.75);
        c.letterSpacing = '2px';
        c.fillText('CONSCIOUS TELEMETRY: IMMEDIATE  ·  PERIPHERAL WRITE CARRIER: NULL', bwPx / 2, 360);
      } else {
        // Beat 2: "AND YOUR BODY STILL CAN'T HEAR YOU"
        c.font = font(F.mono(500), 16);
        c.fillStyle = rgba('signal', 0.95);
        c.letterSpacing = '3px';
        c.fillText('HARDWARE AIR-GAP SEVERANCE  //  RESTRICTED SYSCALL BUS', bwPx / 2, 60);

        c.font = font(F.archivo(100, 900), 84);
        c.fillStyle = rgba('bone', 0.98);
        c.fillText('AND YOUR BODY', bwPx / 2, 175);

        c.fillStyle = rgba('signal', 1.0);
        c.fillText("STILL CAN'T HEAR YOU", bwPx / 2, 275);

        c.font = font(F.mono(400), 15);
        c.fillStyle = rgba('ash', 0.75);
        c.letterSpacing = '2px';
        c.fillText('MOLECULAR COLLISION MANDATORY  ·  AWAITING PHYSICAL TISSUE ARRIVAL', bwPx / 2, 360);
      }
    } else {
      // REVERSE FACE (Acts 3 & 4: 8.5s - 16.0s)
      // When the board flips around its horizontal axle, invert Y so text is upright and un-mirrored
      c.scale(1, -1);
      c.translate(0, -bhPx);

      if (t < 12.5) {
        // Beat 3: "SCREAMING INTO AN EMPTY ROOM"
        c.font = font(F.mono(500), 16);
        c.fillStyle = rgba('ash', 0.9);
        c.letterSpacing = '3px';
        c.fillText('EXCLUSION ARCHITECTURE  //  FAILSAFE LOCKOUT', bwPx / 2, 60);

        c.font = font(F.archivo(100, 900), 84);
        c.fillStyle = rgba('bone', 0.98);
        c.fillText('SCREAMING INTO', bwPx / 2, 175);

        c.fillStyle = rgba('signal', 1.0);
        c.fillText('AN EMPTY ROOM', bwPx / 2, 275);

        c.font = font(F.mono(400), 15);
        c.fillStyle = rgba('ash', 0.75);
        c.letterSpacing = '2px';
        c.fillText('MANUAL OVERRIDE COLLAPSE: TOTAL SYSTEM FAILURE IN < 180 SECONDS', bwPx / 2, 360);
      } else {
        // Beat 4: "PERMANENT CHILD LOCK"
        c.font = font(F.mono(500), 16);
        c.fillStyle = rgba('signal', 1.0);
        c.letterSpacing = '3px';
        c.fillText('THE MIDDLE GROUND WIRING  //  DUAL-HOMED PROOF', bwPx / 2, 60);

        c.font = font(F.archivo(112, 900), 88);
        c.fillStyle = rgba('bone', 0.98);
        c.fillText('PERMANENT', bwPx / 2, 175);

        c.fillStyle = rgba('signal', 1.0);
        c.fillText('CHILD LOCK', bwPx / 2, 275);

        c.font = font(F.mono(400), 15);
        c.fillStyle = rgba('ash', 0.85);
        c.letterSpacing = '2px';
        c.fillText('DIRECT NON-VERBAL CONTROL ALREADY RUNS: DIAPHRAGM & BLADDER', bwPx / 2, 360);
      }
    }

    c.restore();
  }

  private drawScreenTelemetry(c: CanvasRenderingContext2D, t: number): void {
    c.save();

    // 1. Top-left Swiss Monospace Header
    c.font = font(F.mono(500), 13);
    c.letterSpacing = '2px';
    c.fillStyle = rgba('ash', 0.85);
    c.fillText('VIOPLS  //  THE AUTONOMIC PROTOCOL', 72, 54);

    c.font = font(F.mono(400), 11);
    c.fillStyle = rgba('graphite', 0.85);
    c.fillText('ARCH: BIOLOGICAL PRIVILEGE SEPARATION  ·  RING 3 vs RING 0', 72, 72);

    // 2. Top-right Timecode & Act Counter
    c.textAlign = 'right';
    c.font = font(F.mono(500), 13);
    c.fillStyle = rgba('ash', 0.85);
    const act = t < 4.2 ? '01/04' : t < 8.5 ? '02/04' : t < 12.5 ? '03/04' : '04/04';
    c.fillText(`ACT ${act}`, W - 72, 54);

    c.font = font(F.mono(400), 11);
    c.fillStyle = rgba('graphite', 0.85);
    c.fillText(`T+${t.toFixed(2)}s  ·  60 FPS`, W - 72, 72);

    // 3. Ultra-refined Corner Crop Marks [ ... ]
    c.strokeStyle = rgba('graphite', 0.45);
    c.lineWidth = 1.0;
    const m = 48, len = 16;
    // Top-left
    c.beginPath(); c.moveTo(m, m + len); c.lineTo(m, m); c.lineTo(m + len, m); c.stroke();
    // Top-right
    c.beginPath(); c.moveTo(W - m - len, m); c.lineTo(W - m, m); c.lineTo(W - m, m + len); c.stroke();
    // Bottom-left
    c.beginPath(); c.moveTo(m, H - m - len); c.lineTo(m, H - m); c.lineTo(m + len, H - m); c.stroke();
    // Bottom-right
    c.beginPath(); c.moveTo(W - m - len, H - m); c.lineTo(W - m, H - m); c.lineTo(W - m, H - m - len); c.stroke();

    c.restore();
  }
}

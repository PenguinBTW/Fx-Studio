// Geometry for the Autonomic Lockout Chamber:
// A vast architectural perspective vault constructed from hairline wireframe line segments.
// Units in metres: x right, y up, z toward camera.
// Back wall at z = -RD (-14m), front at z = ZF (+3.5m).
import { mulberry32, TAU } from '../../engine/util';

export const RW = 3.8;       // half width of chamber
export const RH = 4.8;       // ceiling height
export const RD = 14.0;      // back wall depth
export const ZF = 3.5;       // front entrance

/** The air-gap chasm where the neural bus physically snaps */
export const CHASM = { z0: -7.2, z1: -9.6, depth: 2.8 };

/** The suspended mechanical flip-board carrying the narrative in 3D world space */
export const BOARD = { x0: -2.4, x1: 2.4, yc: 2.7, hh: 0.75, z: -6.2 };

/** The monolithic autonomic core bulkhead at the end of the aisle */
export const BULKHEAD = { z: -13.8, w: 5.4, h: 4.2 };

export const KIND = {
  STRUCT: 0,
  RACK: 1,
  GRID: 2,
  LIGHT: 3,
  BUS: 4,
  BYPASS: 5,
  BULKHEAD: 6,
} as const;

export interface Segs {
  n: number;
  s: Float32Array; // ax ay az bx by bz
  w: Float32Array; // line width
  a: Float32Array; // alpha
  k: Uint8Array;   // kind
}

export class SegBuf {
  s: number[] = [];
  w: number[] = [];
  a: number[] = [];
  k: number[] = [];

  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number, width: number, alpha: number, kind: number, n = 1) {
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      this.s.push(
        ax + (bx - ax) * u0, ay + (by - ay) * u0, az + (bz - az) * u0,
        ax + (bx - ax) * u1, ay + (by - ay) * u1, az + (bz - az) * u1
      );
      this.w.push(width);
      this.a.push(alpha);
      this.k.push(kind);
    }
  }

  loop(pts: number[][], width: number, alpha: number, kind: number, n = 1) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
      this.add(p[0]!, p[1]!, p[2]!, q[0]!, q[1]!, q[2]!, width, alpha, kind, n);
    }
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, width: number, alpha: number, kind: number) {
    // 12 edges of an axis-aligned box
    this.add(x0, y0, z0, x1, y0, z0, width, alpha, kind);
    this.add(x1, y0, z0, x1, y1, z0, width, alpha, kind);
    this.add(x1, y1, z0, x0, y1, z0, width, alpha, kind);
    this.add(x0, y1, z0, x0, y0, z0, width, alpha, kind);

    this.add(x0, y0, z1, x1, y0, z1, width, alpha, kind);
    this.add(x1, y0, z1, x1, y1, z1, width, alpha, kind);
    this.add(x1, y1, z1, x0, y1, z1, width, alpha, kind);
    this.add(x0, y1, z1, x0, y0, z1, width, alpha, kind);

    this.add(x0, y0, z0, x0, y0, z1, width, alpha, kind);
    this.add(x1, y0, z0, x1, y0, z1, width, alpha, kind);
    this.add(x1, y1, z0, x1, y1, z1, width, alpha, kind);
    this.add(x0, y1, z0, x0, y1, z1, width, alpha, kind);
  }

  done(): Segs {
    return {
      n: this.w.length,
      s: Float32Array.from(this.s),
      w: Float32Array.from(this.w),
      a: Float32Array.from(this.a),
      k: Uint8Array.from(this.k),
    };
  }
}

/** Builds the complete static architectural segment soup for the Autonomic Vault */
export function buildChamber(): Segs {
  const g = new SegBuf();
  const L = ZF + RD; // total length 17.5m
  const nz = (len: number) => Math.max(2, Math.ceil(len / 0.6));

  // 1. Chamber Main Outer Bounding Rails (Longitudinal Edges)
  for (const x of [-RW, RW]) {
    for (const y of [0, RH]) {
      g.add(x, y, ZF, x, y, -RD, 1.6, 0.85, KIND.STRUCT, nz(L));
    }
  }

  // Back wall outer rectangle
  g.loop([[-RW, 0, -RD], [RW, 0, -RD], [RW, RH, -RD], [-RW, RH, -RD]], 1.8, 0.9, KIND.STRUCT, 12);
  // Front portal frame
  g.loop([[-RW, 0, ZF], [RW, 0, ZF], [RW, RH, ZF], [-RW, RH, ZF]], 1.8, 0.85, KIND.STRUCT, 12);

  // 2. Floor Grid (0.5m spacing with central trench opening)
  for (let z = ZF; z > -RD; z -= 0.6) {
    // Before chasm
    if (z > CHASM.z0 || z < CHASM.z1) {
      // Left floor bank
      g.add(-RW, 0, z, -0.7, 0, z, 1.0, 0.35, KIND.GRID, 5);
      // Right floor bank
      g.add(0.7, 0, z, RW, 0, z, 1.0, 0.35, KIND.GRID, 5);
    }
  }

  // Longitudinal floor lines
  for (let i = 1; i <= 6; i++) {
    const xL = -RW + i * 0.45;
    const xR = RW - i * 0.45;
    if (xL < -0.7) {
      g.add(xL, 0, ZF, xL, 0, CHASM.z0, 1.0, 0.35, KIND.GRID, nz(ZF - CHASM.z0));
      g.add(xL, 0, CHASM.z1, xL, 0, -RD, 1.0, 0.35, KIND.GRID, nz(CHASM.z1 - (-RD)));
    }
    if (xR > 0.7) {
      g.add(xR, 0, ZF, xR, 0, CHASM.z0, 1.0, 0.35, KIND.GRID, nz(ZF - CHASM.z0));
      g.add(xR, 0, CHASM.z1, xR, 0, -RD, 1.0, 0.35, KIND.GRID, nz(CHASM.z1 - (-RD)));
    }
  }

  // Central Floor Recessed Data Conduit Trench
  const tw = 0.65; // half width of trench
  const td = -0.35; // depth of trench
  for (const x of [-tw, tw]) {
    g.add(x, 0, ZF, x, 0, CHASM.z0, 1.4, 0.85, KIND.BUS, nz(ZF - CHASM.z0));
    g.add(x, td, ZF, x, td, CHASM.z0, 1.2, 0.6, KIND.BUS, nz(ZF - CHASM.z0));
    g.add(x, 0, CHASM.z1, x, 0, -RD, 1.4, 0.85, KIND.BUS, nz(CHASM.z1 - (-RD)));
    g.add(x, td, CHASM.z1, x, td, -RD, 1.2, 0.6, KIND.BUS, nz(CHASM.z1 - (-RD)));
  }
  // Central bus line (where the signal pulses run)
  g.add(0, td, ZF, 0, td, CHASM.z0, 1.6, 0.95, KIND.BUS, nz(ZF - CHASM.z0));
  g.add(0, td, CHASM.z1, 0, td, -RD, 1.6, 0.95, KIND.BUS, nz(CHASM.z1 - (-RD)));

  // Transverse trench ribs
  for (let z = ZF; z > -RD; z -= 0.6) {
    if (z > CHASM.z0 || z < CHASM.z1) {
      g.add(-tw, td, z, tw, td, z, 1.0, 0.45, KIND.BUS, 2);
      g.add(-tw, 0, z, -tw, td, z, 1.0, 0.45, KIND.BUS, 1);
      g.add(tw, 0, z, tw, td, z, 1.0, 0.45, KIND.BUS, 1);
    }
  }

  // 3. The Air-Gap Chasm Geometry (The Severed Void)
  const cz0 = CHASM.z0, cz1 = CHASM.z1, cdep = -CHASM.depth;
  // Chasm rim edges
  g.add(-RW, 0, cz0, RW, 0, cz0, 1.8, 0.95, KIND.STRUCT, 12);
  g.add(-RW, 0, cz1, RW, 0, cz1, 1.8, 0.95, KIND.STRUCT, 12);
  // Chasm vertical cliff drops
  for (let x = -RW; x <= RW; x += 0.5) {
    g.add(x, 0, cz0, x, cdep, cz0, 1.2, 0.65, KIND.STRUCT, 4);
    g.add(x, 0, cz1, x, cdep, cz1, 1.2, 0.65, KIND.STRUCT, 4);
  }
  // Chasm bottom perimeter & deep floor ribs
  g.loop([[-RW, cdep, cz0], [RW, cdep, cz0], [RW, cdep, cz1], [-RW, cdep, cz1]], 1.4, 0.75, KIND.STRUCT, 10);
  for (let z = cz0 - 0.4; z > cz1; z -= 0.4) {
    g.add(-RW, cdep, z, RW, cdep, z, 1.0, 0.35, KIND.GRID, 8);
  }
  // Severed neural bus stub ends at chasm cliff face (snapped cables)
  for (const ox of [-0.3, 0, 0.3]) {
    g.add(ox, td, cz0, ox, td - 0.2, cz0 - 0.15, 1.6, 0.9, KIND.BUS, 2);
    g.add(ox, td, cz1, ox, td - 0.2, cz1 + 0.15, 1.6, 0.9, KIND.BUS, 2);
  }

  // 4. Towering Server Monoliths / Biological Neural Bus Racks flanking the aisle
  const rackDepth = 0.85;
  const rackHeight = 3.8;
  const bays = 10;
  for (const side of [-1, 1]) {
    const xw = side * RW;
    const xf = side * (RW - rackDepth);

    // Shelf longitudinal runners
    const shelfY = [0.2, 0.9, 1.6, 2.3, 3.0, 3.7];
    for (const y of shelfY) {
      g.add(xf, y, ZF, xf, y, -RD, 1.3, 0.75, KIND.RACK, nz(L));
      g.add(xw, y, ZF, xw, y, -RD, 1.0, 0.4, KIND.RACK, nz(L));
    }

    // Upright structural pillars every bay
    for (let i = 0; i <= bays; i++) {
      const z = ZF - (L * (i / bays));
      // Vertical front upright
      g.add(xf, 0, z, xf, rackHeight, z, 1.5, 0.85, KIND.RACK, 6);
      // Wall upright
      g.add(xw, 0, z, xw, rackHeight, z, 1.2, 0.45, KIND.RACK, 6);
      // Horizontal tie beam to wall
      g.add(xf, rackHeight, z, xw, rackHeight, z, 1.2, 0.55, KIND.RACK, 2);
      g.add(xf, 0, z, xw, 0, z, 1.2, 0.55, KIND.RACK, 2);
      // Diagonal bracing in selected bays
      if (i % 2 === 1) {
        g.add(xf, 0, z, xw, rackHeight, z, 0.9, 0.3, KIND.RACK, 6);
      }
    }

    // Dense rack modules / terminal units inside bays
    const rnd = mulberry32(side > 0 ? 42 : 137);
    for (let i = 0; i < bays; i++) {
      const z0 = ZF - (L * (i / bays));
      const z1 = ZF - (L * ((i + 1) / bays));
      const bayW = Math.abs(z0 - z1);

      for (let s = 0; s < shelfY.length - 1; s++) {
        const y0 = shelfY[s]!;
        const y1 = shelfY[s + 1]!;
        const tierH = y1 - y0;

        // Subdivide bay into 2 or 3 rack units
        const units = 2 + Math.floor(rnd() * 2);
        for (let u = 0; u < units; u++) {
          const uz0 = z0 - (bayW * (u / units)) - 0.04;
          const uz1 = z0 - (bayW * ((u + 0.88) / units)) + 0.04;
          const uy0 = y0 + 0.04;
          const uy1 = y1 - 0.04;

          // Face panel frame of rack module
          g.loop([[xf, uy0, uz0], [xf, uy0, uz1], [xf, uy1, uz1], [xf, uy1, uz0]], 1.0, 0.5, KIND.RACK, 1);
          // Horizontal module slots
          const slots = 2 + Math.floor(rnd() * 3);
          for (let sl = 1; sl < slots; sl++) {
            const sy = uy0 + (tierH * (sl / slots));
            g.add(xf, sy, uz0, xf, sy, uz1, 0.9, 0.35, KIND.RACK, 1);
          }
          // Indicator micro-tick
          const mx = xf;
          const my = uy1 - 0.08;
          g.add(mx, my, uz0 - 0.05, mx, my, uz0 - 0.15, 1.2, 0.6, KIND.RACK, 1);
        }
      }
    }
  }

  // 5. Overhead Trusses & Gantry System
  const gy = RH - 0.4;
  for (let i = 0; i <= bays; i++) {
    const z = ZF - (L * (i / bays));
    // Transverse gantry beam
    g.add(-RW, gy, z, RW, gy, z, 1.5, 0.8, KIND.STRUCT, 10);
    g.add(-RW, RH, z, RW, RH, z, 1.2, 0.5, KIND.STRUCT, 10);
    // Vertical gantry ties
    for (const x of [-RW, -1.8, 0, 1.8, RW]) {
      g.add(x, gy, z, x, RH, z, 1.2, 0.6, KIND.STRUCT, 2);
    }
  }
  // Longitudinal ceiling rails
  for (const x of [-1.8, 1.8]) {
    g.add(x, gy, ZF, x, gy, -RD, 1.4, 0.7, KIND.STRUCT, nz(L));
  }

  // 6. Suspended Strip Lights down the aisle
  for (const zc of [2.0, -0.8, -3.6, -6.5, -9.5, -12.2]) {
    const ly = RH - 0.65;
    const lw = 0.55, lh = 1.0;
    g.loop([[-lw, ly, zc - lh], [lw, ly, zc - lh], [lw, ly, zc + lh], [-lw, ly, zc + lh]], 1.4, 0.9, KIND.LIGHT, 4);
    // Suspension wires from ceiling
    for (const sx of [-lw, lw]) {
      g.add(sx, RH, zc - lh, sx, ly, zc - lh, 1.0, 0.55, KIND.LIGHT, 1);
      g.add(sx, RH, zc + lh, sx, ly, zc + lh, 1.0, 0.55, KIND.LIGHT, 1);
    }
    // Cross bulbs
    for (let k = 1; k < 4; k++) {
      const bz = zc - lh + (2 * lh * (k / 4));
      g.add(-lw, ly, bz, lw, ly, bz, 1.1, 0.65, KIND.LIGHT, 2);
    }
  }

  // 7. Suspended Flip-Board Suspension System
  // Vertical heavy steel cables from ceiling down to the board's axle
  const b = BOARD;
  for (const x of [b.x0 - 0.08, b.x1 + 0.08]) {
    g.add(x, RH, b.z, x, b.yc, b.z, 1.5, 0.9, KIND.STRUCT, nz(RH - b.yc));
    // Axle pivot bearing
    g.loop([[x - 0.05, b.yc - 0.05, b.z], [x + 0.05, b.yc - 0.05, b.z], [x + 0.05, b.yc + 0.05, b.z], [x - 0.05, b.yc + 0.05, b.z]], 1.4, 0.8, KIND.STRUCT, 1);
  }

  // 8. The Autonomic Bulkhead (The Massive Hardware Air-Gap Lockout Gate at z = -13.8)
  const bk = BULKHEAD;
  const bz = bk.z;
  const bhw = bk.w / 2; // 2.7m
  // Outer monolithic frame
  g.loop([[-bhw, 0, bz], [bhw, 0, bz], [bhw, bk.h, bz], [-bhw, bk.h, bz]], 2.0, 0.95, KIND.BULKHEAD, 10);
  g.loop([[-bhw + 0.25, 0.2, bz], [bhw - 0.25, 0.2, bz], [bhw - 0.25, bk.h - 0.2, bz], [-bhw + 0.25, bk.h - 0.2, bz]], 1.4, 0.75, KIND.BULKHEAD, 10);

  // Central Vertical Isolation Seam
  g.add(0, 0.2, bz, 0, bk.h - 0.2, bz, 1.6, 0.9, KIND.BULKHEAD, 8);

  // Heavy mechanical locking deadbolts (3 tiers on left and right)
  const boltY = [0.8, 1.8, 2.8, 3.8];
  for (const by of boltY) {
    for (const side of [-1, 1]) {
      const bx0 = side * 0.12;
      const bx1 = side * 1.6;
      g.add(bx0, by, bz, bx1, by, bz, 1.8, 0.9, KIND.BULKHEAD, 4);
      g.add(bx0, by - 0.1, bz, bx1, by - 0.1, bz, 1.2, 0.6, KIND.BULKHEAD, 4);
      g.add(bx0, by + 0.1, bz, bx1, by + 0.1, bz, 1.2, 0.6, KIND.BULKHEAD, 4);
      // Locking pin collar
      g.loop([[bx1 - 0.15, by - 0.14, bz], [bx1 + 0.15, by - 0.14, bz], [bx1 + 0.15, by + 0.14, bz], [bx1 - 0.15, by + 0.14, bz]], 1.4, 0.8, KIND.BULKHEAD, 1);
    }
  }

  // Central Pressure Hatch Aperture
  const cy = 2.0;
  const cw = 0.9, ch = 0.55;
  g.loop([[-cw, cy - ch, bz], [cw, cy - ch, bz], [cw, cy + ch, bz], [-cw, cy + ch, bz]], 1.6, 0.9, KIND.BULKHEAD, 4);
  g.loop([[-cw + 0.08, cy - ch + 0.08, bz], [cw - 0.08, cy - ch + 0.08, bz], [cw - 0.08, cy + ch - 0.08, bz], [-cw + 0.08, cy + ch - 0.08, bz]], 1.2, 0.6, KIND.BULKHEAD, 4);

  // 9. The Dual-Homed Bypass Bridges (High overhead conduits arching around the chasm)
  // Conduit 1: Diaphragm bypass (Left arch)
  // Conduit 2: Bladder direct (Right arch)
  const bridgeZ0 = CHASM.z0 + 0.8;
  const bridgeZ1 = CHASM.z1 - 0.8;
  const steps = 24;
  for (const [side, xOffset] of [[-1, -1.5], [1, 1.5]] as const) {
    for (let i = 0; i < steps; i++) {
      const u0 = i / steps;
      const u1 = (i + 1) / steps;
      const z0 = bridgeZ0 + (bridgeZ1 - bridgeZ0) * u0;
      const z1 = bridgeZ0 + (bridgeZ1 - bridgeZ0) * u1;
      // Parabolic arch curving upward and outward
      const arch0 = Math.sin(u0 * Math.PI);
      const arch1 = Math.sin(u1 * Math.PI);
      const y0 = 0.4 + arch0 * 2.8;
      const y1 = 0.4 + arch1 * 2.8;
      const x0 = xOffset * (1.0 + arch0 * 0.45);
      const x1 = xOffset * (1.0 + arch1 * 0.45);

      g.add(x0, y0, z0, x1, y1, z1, 1.8, 0.95, KIND.BYPASS, 1);
      // Secondary parallel tracer wire
      g.add(x0, y0 - 0.06, z0, x1, y1 - 0.06, z1, 1.1, 0.55, KIND.BYPASS, 1);
    }
    // Gantry suspension brackets holding the bypass arch
    for (const fu of [0.25, 0.5, 0.75]) {
      const bz = bridgeZ0 + (bridgeZ1 - bridgeZ0) * fu;
      const by = 0.4 + Math.sin(fu * Math.PI) * 2.8;
      const bx = xOffset * (1.0 + Math.sin(fu * Math.PI) * 0.45);
      g.add(bx, by, bz, bx, RH - 0.4, bz, 1.2, 0.6, KIND.STRUCT, 3);
    }
  }

  return g.done();
}

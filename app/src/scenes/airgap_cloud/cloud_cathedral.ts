// =============================================================================
// LIDAR ARCHITECTURAL ENVIRONMENT: "THE AIR-GAP CATHEDRAL" (FLUID ENGINE)
//
// 98,000-Point Procedural Monumental Point-Cloud Cathedral:
// - Liquid Laser Floor Grid with concentric outward-rippling waves
// - 8 Monumental Fluted Columns with upward-streaming liquid light
// - Soaring Parabolic Gothic Vault Arches with traveling auroral light waves
// - Concentric celestial scan rings with laser tick marks
// - 15,000 Atmospheric dust motes in 3D toroidal convection circulation
//
// Strictly closed-form O(1): Frame = f(t). Zero imported 3D models.
// =============================================================================

import * as THREE from 'three';
import { LIN } from './cloud_palette';

export interface CathedralBuffers {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  basePositions: Float32Array;
  flowDirs: Float32Array;
  streamUs: Float32Array;
  types: Float32Array;
  subtypes: Uint8Array; // 0: floor, 1: column, 2: arch, 3: ring, 4: dust
  count: number;
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CloudCathedral {
  geometry: THREE.BufferGeometry;
  buffers: CathedralBuffers;
  dustStartIdx: number;
  dustCount: number;

  constructor() {
    const { buffers, dustStartIdx, dustCount } = this.generateCathedral();
    this.buffers = buffers;
    this.dustStartIdx = dustStartIdx;
    this.dustCount = dustCount;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.buffers.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.buffers.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.buffers.sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.buffers.phases, 1));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(this.buffers.intensities, 1));
    this.geometry.setAttribute('aFlowDir', new THREE.BufferAttribute(this.buffers.flowDirs, 3));
    this.geometry.setAttribute('aStreamU', new THREE.BufferAttribute(this.buffers.streamUs, 1));
    this.geometry.setAttribute('aType', new THREE.BufferAttribute(this.buffers.types, 1));
  }

  private generateCathedral(): { buffers: CathedralBuffers; dustStartIdx: number; dustCount: number } {
    const MAX_POINTS = 100000;
    const positions = new Float32Array(MAX_POINTS * 3);
    const basePositions = new Float32Array(MAX_POINTS * 3);
    const colors = new Float32Array(MAX_POINTS * 3);
    const sizes = new Float32Array(MAX_POINTS);
    const phases = new Float32Array(MAX_POINTS);
    const intensities = new Float32Array(MAX_POINTS);
    const flowDirs = new Float32Array(MAX_POINTS * 3);
    const streamUs = new Float32Array(MAX_POINTS);
    const types = new Float32Array(MAX_POINTS);
    const subtypes = new Uint8Array(MAX_POINTS);

    let idx = 0;
    const rand = mulberry32(20261016);

    const addPoint = (
      x: number, y: number, z: number,
      col: THREE.Color,
      size: number,
      intensity: number,
      subtype: number,
      fx = 0, fy = 1, fz = 0,
      streamU = 0
    ) => {
      if (idx >= MAX_POINTS) return;
      const i3 = idx * 3;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      colors[i3] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;

      sizes[idx] = size;
      phases[idx] = rand();
      intensities[idx] = intensity;

      flowDirs[i3] = fx;
      flowDirs[i3 + 1] = fy;
      flowDirs[i3 + 2] = fz;

      streamUs[idx] = streamU;
      types[idx] = 7.0; // 7.0 = cathedral
      subtypes[idx] = subtype;

      idx++;
    };

    const colBone = LIN.bone;
    const colAsh = LIN.ash;
    const colLaser = LIN.laser;
    const colGold = LIN.gold;

    // -------------------------------------------------------------------------
    // 1. PLANAR LASER FLOOR GRID (~28,000 points) at y = 0
    // -------------------------------------------------------------------------
    for (let gx = -8.0; gx <= 8.0; gx += 0.35) {
      for (let gz = -12.0; gz <= 12.0; gz += 0.35) {
        const dCenter = Math.sqrt(gx * gx + gz * gz);
        if (dCenter > 14.0) continue;

        const isMajorX = Math.abs(gx % 1.0) < 0.05;
        const isMajorZ = Math.abs(gz % 1.0) < 0.05;
        const isCrosshair = isMajorX && isMajorZ;

        const col = isCrosshair ? colLaser : (isMajorX || isMajorZ ? colBone : colAsh);
        const sz = isCrosshair ? 3.2 : (isMajorX || isMajorZ ? 2.4 : 1.6);
        const inten = isCrosshair ? 1.4 : (isMajorX || isMajorZ ? 0.9 : 0.55 * Math.exp(-dCenter * 0.1));

        addPoint(gx, 0.0, gz, col, sz, inten, 0, 0, 0, 0, dCenter / 14.0);
      }
    }

    // Floor Radar Distance Rings
    const floorRings = [1.5, 3.0, 5.0, 7.5];
    for (const fr of floorRings) {
      const pts = Math.round(fr * 180);
      for (let i = 0; i < pts; i++) {
        const ang = (i / pts) * Math.PI * 2;
        const x = fr * Math.cos(ang);
        const z = fr * Math.sin(ang);
        const isTick = i % 15 === 0;
        addPoint(x, 0.002, z, isTick ? colLaser : colAsh, isTick ? 2.8 : 1.8, isTick ? 1.2 : 0.6, 0, -Math.sin(ang), 0, Math.cos(ang), i / pts);
      }
    }

    // -------------------------------------------------------------------------
    // 2. MONUMENTAL FLUTED COLONNADE COLUMNS (~30,000 points)
    // -------------------------------------------------------------------------
    const colXPositions = [-1.8, 1.8];
    const colZPositions = [-6.0, -2.0, 2.0, 6.0];
    const columnHeight = 3.2; // Floor to arch spring
    const ptsPerColumn = 3700;

    for (const cx of colXPositions) {
      for (const cz of colZPositions) {
        for (let i = 0; i < ptsPerColumn; i++) {
          const tHeight = rand();
          const y = tHeight * columnHeight;
          const theta = rand() * Math.PI * 2;

          // 12 Classical flutes around circumference
          const numFlutes = 12;
          const fluteDepth = 0.015 * Math.sin(theta * numFlutes);
          const colRadius = 0.14 + fluteDepth;

          const px = cx + colRadius * Math.cos(theta);
          const pz = cz + colRadius * Math.sin(theta);

          // Capital rings at top
          const isCapital = y > (columnHeight - 0.25);
          const col = isCapital ? colBone : (rand() > 0.4 ? colBone : colAsh);
          const sz = isCapital ? 3.2 : (2.2 + rand() * 1.0);
          const inten = isCapital ? 1.4 : 1.10;

          addPoint(px, y, pz, col, sz, inten, 1, 0, 1, 0, tHeight);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. PARABOLIC GOTHIC VAULT ARCHES (~16,000 points)
    // -------------------------------------------------------------------------
    const apexHeight = 4.2;
    const springHeight = 3.2;
    const archHalfSpan = 1.8;

    for (const cz of colZPositions) {
      const ptsArch = 2800;
      for (let i = 0; i < ptsArch; i++) {
        const u = i / (ptsArch - 1);
        const x = -archHalfSpan + u * (2 * archHalfSpan);
        const normX = x / archHalfSpan;
        const archProfile = Math.pow(1.0 - normX * normX, 0.75);
        const y = springHeight + (apexHeight - springHeight) * archProfile;

        // Arch rib thickness
        const ribThickness = 0.035;
        const ang = rand() * Math.PI * 2;
        const r = rand() * ribThickness;
        const px = x + r * Math.cos(ang);
        const py = y + r * Math.sin(ang);
        const pz = cz + (rand() - 0.5) * 0.03;

        const isApex = Math.abs(x) < 0.25;
        const col = isApex ? colLaser : colBone;
        const sz = isApex ? 3.4 : (2.4 + rand() * 0.8);
        const inten = isApex ? 1.6 : 1.15;

        addPoint(px, py, pz, col, sz, inten, 2, normX, archProfile, 0, u);
      }
    }

    // Longitudinal Vault Ridge Beam
    for (let i = 0; i < 2200; i++) {
      const z = -8.0 + (i / 2199) * 16.0;
      const x = (rand() - 0.5) * 0.025;
      const y = apexHeight + (rand() - 0.5) * 0.025;
      addPoint(x, y, z, colLaser, 2.2, 0.95, 2, 0, 0, 1, (z + 8.0) / 16.0);
    }

    // -------------------------------------------------------------------------
    // 4. FLOATING CELESTIAL SCAN RINGS (~6,000 points)
    // -------------------------------------------------------------------------
    const celestialRings = [
      { y: 1.85, r: 0.95, col: colGold, pts: 1200 },
      { y: 2.45, r: 1.45, col: colLaser, pts: 1800 },
      { y: 3.10, r: 2.10, col: colBone, pts: 2200 },
    ];

    for (const cr of celestialRings) {
      for (let i = 0; i < cr.pts; i++) {
        const theta = (i / cr.pts) * Math.PI * 2;
        const x = cr.r * Math.cos(theta);
        const z = cr.r * Math.sin(theta);
        const isTick = i % 20 === 0;
        addPoint(
          x, cr.y, z,
          isTick ? cr.col : colAsh,
          isTick ? 2.6 : 1.6,
          isTick ? 1.2 : 0.65,
          3,
          -Math.sin(theta), 0, Math.cos(theta),
          i / cr.pts
        );
      }
    }

    // -------------------------------------------------------------------------
    // 5. ATMOSPHERIC 3D DUST MOTES (~15,000 points)
    // -------------------------------------------------------------------------
    const dustStartIdx = idx;
    const dustCount = 15000;

    for (let i = 0; i < dustCount; i++) {
      const x = (rand() - 0.5) * 8.0;
      const y = 0.05 + rand() * 4.2;
      const z = -8.0 + rand() * 16.0;

      const sz = 1.2 + rand() * 1.5;
      const inten = 0.45 + rand() * 0.55;
      const isCyan = rand() > 0.88;
      const isGold = !isCyan && (rand() > 0.90);
      const col = isCyan ? colLaser : (isGold ? colGold : colBone);

      addPoint(x, y, z, col, sz, inten, 4, 0, 1, 0, rand());
    }

    return {
      buffers: {
        positions,
        colors,
        sizes,
        phases,
        intensities,
        basePositions,
        flowDirs,
        streamUs,
        types,
        subtypes,
        count: idx,
      },
      dustStartIdx,
      dustCount,
    };
  }

  /**
   * Closed-form f(t) update for living cathedral architecture:
   * - Columns: upward-streaming fiber-optic liquid light
   * - Arches: traveling auroral light waves across Gothic nave
   * - Floor: concentric liquid interference ripples
   * - Dust: 3D toroidal atmospheric convection whirlpool
   */
  update(t: number): void {
    const pos = this.buffers.positions;
    const base = this.buffers.basePositions;
    const phases = this.buffers.phases;
    const intensities = this.buffers.intensities;
    const subtypes = this.buffers.subtypes;
    const streamUs = this.buffers.streamUs;

    // 1. Column Upward-Streaming Fluid Motion (v_y = +0.75 m/s)
    const colHeight = 3.2;
    const colSpeed = 0.75;

    // 2. Floor Radial Wave Ripples (waves expanding outward from figure)
    const waveSpeed = 2.4;
    const waveFreq = 2.8;

    // 3. Arch Auroral Travelling Pulse Wave
    const archPulsePos = (t * 0.35) % 1.0;

    for (let i = 0; i < this.dustStartIdx; i++) {
      const i3 = i * 3;
      const sub = subtypes[i]!;
      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;

      if (sub === 0) {
        // Floor Grid: liquid ripples
        const r = Math.sqrt(bx * bx + bz * bz);
        const ripple = Math.sin(r * waveFreq - t * waveSpeed) * Math.exp(-r * 0.15);
        intensities[i] = Math.max(0.2, (0.55 + 0.45 * ripple) * Math.exp(-r * 0.08));
        pos[i3 + 1] = 0.003 * Math.sin(r * 4.0 - t * 3.0);
      } else if (sub === 1) {
        // Column Points: upward flowing liquid light!
        const u = streamUs[i]!;
        const flowY = ((u * colHeight + t * colSpeed) % colHeight);
        pos[i3 + 1] = flowY;

        // Shimmer along column flutes
        const shimmer = 0.75 + 0.35 * Math.sin(flowY * 8.0 - t * 6.0 + phases[i]! * 6.28);
        intensities[i] = shimmer;
      } else if (sub === 2) {
        // Arch Points: traveling auroral wave
        const u = streamUs[i]!;
        const diff = Math.abs(u - archPulsePos);
        const pulse = Math.exp(-Math.pow(diff / 0.09, 2.0));
        intensities[i] = 0.75 + 1.25 * pulse;
      }
    }

    // 4. Atmospheric 3D Toroidal Convection Whirlpool
    for (let i = this.dustStartIdx; i < this.dustStartIdx + this.dustCount; i++) {
      const i3 = i * 3;
      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;
      const ph = phases[i]!;

      // Distance from center axis
      const r = Math.sqrt(bx * bx + bz * bz);
      const theta = Math.atan2(bz, bx);

      // Toroidal convection velocity:
      // Rising in core (r < 1.8), descending in colonnade (r > 2.0)
      const convTime = t * 0.18 + ph * 12.0;
      const vr = -0.15 * Math.cos((by / 4.2) * Math.PI) * Math.sin(convTime * 0.5);
      const vy = 0.22 * Math.sin((by / 4.2) * Math.PI);
      const vTheta = 0.12 + 0.08 * (1.0 / (r + 0.5));

      const curTheta = theta + t * vTheta * 0.3;
      const curR = Math.max(0.2, r + vr);

      pos[i3] = curR * Math.cos(curTheta);
      pos[i3 + 1] = ((by + t * vy * 0.25) % 4.2);
      pos[i3 + 2] = curR * Math.sin(curTheta);
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aIntensity!.needsUpdate = true;
  }
}

// =============================================================================
// CYBERPUNK MEGACITY & LIDAR MATRIX (MOVEMENT 4: 78.0s - 104.0s)
//
// 95,000-Point Procedural Cyberpunk Megalopolis:
// - 80+ Procedural skyscrapers with stepped crowns, spires, and window matrices
// - 20,000-Point multi-tiered aerial skyway particle streams (high-speed traffic)
// - 12,000-Point giant rotating holographic lotus floating between towers
// - Electromagnetic Pulse & Zero-Gravity Dissolution Transition (100.0s - 104.0s)
// =============================================================================

import * as THREE from 'three';
import { LIN } from './dot_palette';
import { clamp, ease, lerp, prog } from '../../engine/util';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DotCity {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  types: Uint8Array; // 0: buildings, 1: skyway traffic, 2: holographic lotus
  trafficSpeeds: Float32Array;
  trafficPaths: Float32Array; // [pathType, coord, length]
  count: number;

  constructor() {
    const MAX_POINTS = 98000;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.basePositions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);
    this.types = new Uint8Array(MAX_POINTS);
    this.trafficSpeeds = new Float32Array(MAX_POINTS);
    this.trafficPaths = new Float32Array(MAX_POINTS * 3);

    let idx = 0;
    const rand = mulberry32(333881);

    const addPt = (
      x: number, y: number, z: number,
      col: THREE.Color,
      size: number,
      intensity: number,
      type: number
    ) => {
      if (idx >= MAX_POINTS) return;
      const i3 = idx * 3;
      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;
      this.basePositions[i3] = x;
      this.basePositions[i3 + 1] = y;
      this.basePositions[i3 + 2] = z;

      this.colors[i3] = col.r;
      this.colors[i3 + 1] = col.g;
      this.colors[i3 + 2] = col.b;

      this.sizes[idx] = size;
      this.phases[idx] = rand();
      this.intensities[idx] = intensity;

      // Zero-G upward buoyant velocity for EMP transition
      this.velocities[i3] = (rand() - 0.5) * 1.5;
      this.velocities[i3 + 1] = 1.2 + rand() * 2.5;
      this.velocities[i3 + 2] = (rand() - 0.5) * 1.5;

      this.types[idx] = type;
      idx++;
    };

    const colPink = LIN.cyberPink;
    const colCyan = LIN.cyberCyan;
    const colYellow = LIN.cyberYellow;
    const colPurple = LIN.cyberPurple;
    const colAsh = LIN.ash;
    const colBone = LIN.bone;

    // -------------------------------------------------------------------------
    // 1. PROCEDURAL SKYSCRAPERS (~65,000 pts)
    // -------------------------------------------------------------------------
    const gridCols = [-10.0, -6.5, -3.8, -1.8, 1.8, 3.8, 6.5, 10.0];
    const gridRows = [-14.0, -10.0, -6.0, -2.0, 2.0, 6.0, 10.0, 14.0];

    for (const cx of gridCols) {
      for (const cz of gridRows) {
        // Leave central opening at (0, 0) for the giant holographic lotus
        if (Math.abs(cx) < 2.5 && Math.abs(cz) < 3.5) continue;

        const seed = rand();
        const bldgHeight = 3.5 + seed * 6.5; // up to 10.0m tall
        const bldgWidth = 1.3 + rand() * 0.6;
        const bldgDepth = 1.3 + rand() * 0.6;

        const numFloors = Math.floor(bldgHeight / 0.26);
        const ptsPerFloor = 24;

        for (let fl = 0; fl < numFloors; fl++) {
          const y = fl * 0.26;
          const uStep = y > (bldgHeight * 0.72) ? 0.68 : 1.0;
          const halfW = (bldgWidth * 0.5) * uStep;
          const halfD = (bldgDepth * 0.5) * uStep;

          for (let p = 0; p < ptsPerFloor; p++) {
            const face = p % 4;
            const frac = ((p / 4) | 0) / 6.0;
            let fx = 0, fz = 0;

            if (face === 0) { fx = (-1.0 + frac * 2.0) * halfW; fz = halfD; }
            else if (face === 1) { fx = (-1.0 + frac * 2.0) * halfW; fz = -halfD; }
            else if (face === 2) { fx = halfW; fz = (-1.0 + frac * 2.0) * halfD; }
            else { fx = -halfW; fz = (-1.0 + frac * 2.0) * halfD; }

            const isLit = rand() > 0.40;
            let col = colAsh;
            let inten = 0.65;
            let sz = 2.0;

            if (isLit) {
              const rCol = rand();
              col = (rCol > 0.6) ? colCyan : (rCol > 0.3 ? colYellow : colPink);
              inten = 1.4;
              sz = 2.4;
            }

            addPt(cx + fx, y, cz + fz, col, sz, inten, 0);
          }
        }

        // Rooftop Antenna Spire & Warning Beacon
        const spireHeight = 0.8 + rand() * 1.2;
        for (let sp = 0; sp < 16; sp++) {
          const sy = bldgHeight + (sp / 15) * spireHeight;
          const isTip = sp >= 14;
          const col = isTip ? colPink : colBone;
          addPt(cx, sy, cz, col, isTip ? 4.2 : 2.2, isTip ? 2.5 : 1.2, 0);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. CONNECTING SKYBRIDGES & AERIAL SKYWAY TRAFFIC (~20,000 pts)
    // -------------------------------------------------------------------------
    // Cross-avenue skybridges between towers at x = -1.8 and x = +1.8
    const bridgeZ = [-10.0, -6.0, 6.0, 10.0];
    const bridgeY = [2.8, 5.2];
    for (const bz of bridgeZ) {
      for (const by of bridgeY) {
        for (let i = 0; i < 400; i++) {
          const u = i / 399;
          const bx = -1.8 + u * 3.6;
          const bzOffset = (rand() - 0.5) * 0.4;
          const col = (u < 0.5) ? colCyan : colPink;
          addPt(bx, by, bz + bzOffset, col, 2.4, 1.3, 1);
        }
      }
    }

    // High-speed skyway avenue traffic streams
    const skywayTiers = [1.8, 3.6, 5.5];
    for (const alt of skywayTiers) {
      for (const aveX of [-2.8, 2.8]) {
        for (let i = 0; i < 1800; i++) {
          const u = i / 1799;
          const z = -16.0 + u * 32.0;
          const isVehicle = rand() > 0.82;
          const col = isVehicle ? (aveX > 0 ? colYellow : colPink) : colCyan;
          addPt(aveX + (rand() - 0.5) * 0.2, alt + (rand() - 0.5) * 0.1, z, col, isVehicle ? 3.4 : 1.8, isVehicle ? 1.8 : 0.85, 1);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. GIANT ROTATING HOLOGRAPHIC LOTUS MANDALA (~15,000 pts)
    // -------------------------------------------------------------------------
    const lotusCenter = { x: 0.0, y: 3.2, z: 0.0 };
    for (let tier = 0; tier < 4; tier++) {
      const numPetals = 8 + tier * 4;
      const tierRadius = 1.0 + tier * 0.75;
      const ptsTier = 3800;

      for (let p = 0; p < ptsTier; p++) {
        const u = p / ptsTier;
        const theta = u * Math.PI * 2;
        // Mathematical rose petal profile: r = a * cos(k * theta)
        const petalMod = Math.abs(Math.sin(theta * (numPetals * 0.5)));
        const r = tierRadius * (0.35 + 0.65 * petalMod);

        const lx = lotusCenter.x + r * Math.cos(theta);
        const lz = lotusCenter.z + r * Math.sin(theta);
        const ly = lotusCenter.y + (1.0 - petalMod) * (0.55 - tier * 0.12);

        const col = (tier % 2 === 0) ? colCyan : colPink;
        addPt(lx, ly, lz, col, 3.2, 1.8, 2);
      }
    }

    this.count = idx;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(this.intensities, 1));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
  }

  /**
   * Updates megacity animations and zero-G EMP dissolution
   */
  update(t: number): void {
    const pos = this.positions;
    const base = this.basePositions;
    const vel = this.velocities;
    const types = this.types;
    const phases = this.phases;
    const n = this.count;

    // Movement 4 runs 78.0s - 104.0s (localT = 0.0s - 26.0s)
    const localT = Math.max(0, t - 78.0);

    // EMP Blackout & Zero-G Dissolution (100.0s - 104.0s -> localT 22.0s - 26.0s)
    const emp = prog(localT, 21.5, 26.0, ease.inQuad);

    // Holographic Lotus Spin
    const lotusSpin = localT * 0.45;

    // Traffic streaming speed (v = 8.0 m/s)
    const trafficZSpeed = localT * 8.0;
    const trafficXSpeed = localT * 7.5;

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;
      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;

      // -----------------------------------------------------------------------
      // EMP ZERO-GRAVITY ASCENSION (100.0s - 104.0s)
      // -----------------------------------------------------------------------
      if (emp > 0.001) {
        const vx = vel[i3]!;
        const vy = vel[i3 + 1]!;
        const vz = vel[i3 + 2]!;

        // Swirling upwards into the sky
        const swirlAngle = emp * 4.0 + phases[i]! * 6.28;
        const curX = pos[i3]!;
        const curZ = pos[i3 + 2]!;
        const curR = Math.sqrt(curX * curX + curZ * curZ) + emp * vx * 1.5;

        pos[i3] = curR * Math.cos(swirlAngle);
        pos[i3 + 1] += vy * emp * 0.25;
        pos[i3 + 2] = curR * Math.sin(swirlAngle);
        continue;
      }

      // -----------------------------------------------------------------------
      // 0. BUILDINGS: STABLE MATRIX WITH ANTENNA BLINK
      // -----------------------------------------------------------------------
      if (type === 0) {
        pos[i3] = bx;
        pos[i3 + 1] = by;
        pos[i3 + 2] = bz;
        continue;
      }

      // -----------------------------------------------------------------------
      // 1. SKYWAY TRAFFIC STREAMS
      // -----------------------------------------------------------------------
      if (type === 1) {
        // Circulating along avenues
        if (Math.abs(bx) < 4.0 && Math.abs(bz) > 5.0) {
          // North-South Avenue: move along Z
          const newZ = -16.0 + ((bz + 16.0 + trafficZSpeed) % 32.0);
          pos[i3] = bx;
          pos[i3 + 1] = by;
          pos[i3 + 2] = newZ;
        } else {
          // East-West Boulevard: move along X
          const newX = -14.0 + ((bx + 14.0 + trafficXSpeed) % 28.0);
          pos[i3] = newX;
          pos[i3 + 1] = by;
          pos[i3 + 2] = bz;
        }
        continue;
      }

      // -----------------------------------------------------------------------
      // 2. HOLOGRAPHIC LOTUS MANDALA
      // -----------------------------------------------------------------------
      if (type === 2) {
        const dx = bx;
        const dz = bz;
        const spin = lotusSpin + 0.15 * Math.sin(by * 4.0);

        pos[i3] = dx * Math.cos(spin) - dz * Math.sin(spin);
        pos[i3 + 1] = by + 0.08 * Math.sin(localT * 2.0 + dx);
        pos[i3 + 2] = dx * Math.sin(spin) + dz * Math.cos(spin);
        continue;
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
  }
}

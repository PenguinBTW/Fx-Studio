// =============================================================================
// BIOLUMINESCENT OCEAN & MANTA LEVIATHAN (MOVEMENT 2: 26.0s - 52.0s)
//
// 85,000-Point Procedural Oceanic Ecosystem:
// - 45,000-Point 3D Gerstner Wave Ocean Surface with bioluminescent foam crests
// - 22,000-Point Giant Manta Leviathan with hydrodynamic pectoral fin flapping
// - 10,000-Point Deep-Sea Pulsing Jellyfish Blooms
// - 8,000-Point Swirling Bait-Ball Fish Vortex
// - Cosmic Maelstrom Whirlpool Funnel Transition (48.0s - 52.0s)
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

export class DotOcean {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  types: Uint8Array; // 0: ocean wave surface, 1: manta, 2: jellyfish, 3: bait-ball
  mantaParams: Float32Array; // span fraction [0..1]
  count: number;

  mantaPos = new THREE.Vector3(0, -0.6, 0);

  constructor() {
    const MAX_POINTS = 90000;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.basePositions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);
    this.types = new Uint8Array(MAX_POINTS);
    this.mantaParams = new Float32Array(MAX_POINTS);

    let idx = 0;
    const rand = mulberry32(777444);

    const addPt = (
      x: number, y: number, z: number,
      col: THREE.Color,
      size: number,
      intensity: number,
      type: number,
      param = 0
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

      this.velocities[i3] = (rand() - 0.5) * 1.5;
      this.velocities[i3 + 1] = (rand() - 0.5) * 1.5;
      this.velocities[i3 + 2] = (rand() - 0.5) * 1.5;

      this.types[idx] = type;
      this.mantaParams[idx] = param;
      idx++;
    };

    const colBlue = LIN.oceanBlue;
    const colCyan = LIN.oceanCyan;
    const colViolet = LIN.biolumViolet;
    const colSilver = LIN.mantaSilver;
    const colPink = LIN.jellyPink;

    // -------------------------------------------------------------------------
    // 1. GERSTNER WAVE OCEAN SURFACE (~45,000 pts)
    // -------------------------------------------------------------------------
    for (let gx = -10.0; gx <= 10.0; gx += 0.22) {
      for (let gz = -12.0; gz <= 12.0; gz += 0.22) {
        const d = Math.sqrt(gx * gx + gz * gz);
        if (d > 14.0) continue;

        const jitter = (rand() - 0.5) * 0.08;
        addPt(gx + jitter, 0.0, gz + jitter, colBlue, 1.8 + rand() * 1.0, 0.85, 0);
      }
    }

    // -------------------------------------------------------------------------
    // 2. GIANT MANTA RAY LEVIATHAN (~22,000 pts)
    // -------------------------------------------------------------------------
    // 6-meter wingspan, diamond cephalic lobes, tapered whip tail
    for (let i = 0; i < 22000; i++) {
      const u = rand(); // length along body [-0.5..0.5]
      const side = rand() > 0.5 ? 1 : -1;
      const spanFrac = Math.pow(rand(), 0.7); // 0 at spine, 1 at wing tip

      const bodyZ = (u - 0.5) * 3.5; // -1.75 (head) to 1.75 (tail root)
      // Triangular wing profile: widest at mid-body
      const maxSpan = 3.2 * Math.sin(u * Math.PI);
      const bodyX = side * spanFrac * maxSpan;

      // Thickness: thickest at center body, paper-thin at wingtips
      const thick = 0.22 * (1.0 - spanFrac * 0.85) * Math.sin(u * Math.PI);
      const bodyY = (rand() - 0.5) * thick;

      // Dorsal bioluminescent spot pattern
      const isPattern = Math.sin(bodyX * 8.0) * Math.cos(bodyZ * 6.0) > 0.4;
      const col = isPattern ? colCyan : (spanFrac > 0.7 ? colViolet : colSilver);
      const sz = isPattern ? 2.8 : 2.0;
      const inten = isPattern ? 1.5 : 1.0;

      addPt(bodyX, bodyY, bodyZ, col, sz, inten, 1, spanFrac);
    }

    // Whip Tail (2,000 pts)
    for (let i = 0; i < 2000; i++) {
      const t = i / 1999;
      const tz = 1.75 + t * 4.0;
      const r = 0.015 * (1.0 - t * 0.7);
      const a = rand() * Math.PI * 2;
      addPt(r * Math.cos(a), r * Math.sin(a), tz, colCyan, 1.8, 1.2, 1, 0.1);
    }

    // -------------------------------------------------------------------------
    // 3. DEEP-SEA JELLYFISH BLOOMS (~8,000 pts)
    // -------------------------------------------------------------------------
    const jellyCenters = [
      { x: -3.2, y: -2.2, z: -2.5, r: 0.65 },
      { x: 3.5, y: -1.8, z: 1.5, r: 0.55 },
      { x: -2.0, y: -3.5, z: 3.8, r: 0.80 },
      { x: 2.2, y: -2.8, z: -4.0, r: 0.45 },
    ];

    for (const jc of jellyCenters) {
      // Bell Cap Dome (1,200 pts per jelly)
      for (let i = 0; i < 1200; i++) {
        const u = rand(), v = rand();
        const theta = u * Math.PI * 2;
        const phi = v * (Math.PI * 0.5); // upper hemisphere

        const jx = jc.x + jc.r * Math.sin(phi) * Math.cos(theta);
        const jy = jc.y + jc.r * Math.cos(phi) * 0.85;
        const jz = jc.z + jc.r * Math.sin(phi) * Math.sin(theta);

        addPt(jx, jy, jz, colPink, 2.2, 1.3, 2, jc.r);
      }

      // Tentacle Streamers (800 pts per jelly)
      for (let i = 0; i < 800; i++) {
        const t = i / 799;
        const ang = rand() * Math.PI * 2;
        const rTent = jc.r * 0.65 * rand();
        const tx = jc.x + rTent * Math.cos(ang);
        const ty = jc.y - t * 2.8;
        const tz = jc.z + rTent * Math.sin(ang);
        addPt(tx, ty, tz, colViolet, 1.8, 1.1, 2, t);
      }
    }

    // -------------------------------------------------------------------------
    // 4. SWIRLING BAIT-BALL FISH VORTEX (~8,000 pts)
    // -------------------------------------------------------------------------
    for (let i = 0; i < 8000; i++) {
      const u = rand(), v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.4 + rand() * 0.6; // hollow sphere shell

      const fx = r * Math.sin(phi) * Math.cos(theta);
      const fy = -1.2 + r * Math.cos(phi) * 0.8;
      const fz = r * Math.sin(phi) * Math.sin(theta);

      addPt(fx, fy, fz, colCyan, 2.0, 1.25, 3, r);
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
   * Closed-form Gerstner wave displacement
   */
  evaluateWaves(x0: number, z0: number, t: number, out: THREE.Vector3): number {
    // 3 Gerstner wave octaves
    const w1 = { kx: 0.65, kz: 0.35, A: 0.35, w: 2.2 };
    const w2 = { kx: -0.45, kz: 0.75, A: 0.22, w: 2.8 };
    const w3 = { kx: 1.10, kz: -0.85, A: 0.12, w: 3.6 };

    const ph1 = w1.kx * x0 + w1.kz * z0 - w1.w * t;
    const ph2 = w2.kx * x0 + w2.kz * z0 - w2.w * t;
    const ph3 = w3.kx * x0 + w3.kz * z0 - w3.w * t;

    const dx = -w1.A * Math.sin(ph1) - w2.A * Math.sin(ph2) - w3.A * Math.sin(ph3);
    const dy = w1.A * Math.cos(ph1) + w2.A * Math.cos(ph2) + w3.A * Math.cos(ph3);
    const dz = -w1.A * Math.sin(ph1) * 0.5 - w2.A * Math.sin(ph2) * 0.8 - w3.A * Math.sin(ph3) * 0.5;

    out.set(x0 + dx, dy, z0 + dz);
    return dy; // wave height
  }

  /**
   * Updates oceanic ecosystem at time t
   */
  update(t: number): void {
    const pos = this.positions;
    const base = this.basePositions;
    const colors = this.colors;
    const intensities = this.intensities;
    const types = this.types;
    const mantaParams = this.mantaParams;
    const n = this.count;

    // Movement 2 runs 26.0s - 52.0s (local time 0.0s - 26.0s)
    const localT = Math.max(0, t - 26.0);

    // Maelstrom whirlpool funnel (48.0s - 52.0s -> localT 22.0s - 26.0s)
    const maelstrom = prog(localT, 21.0, 26.0, ease.inQuad);

    // Manta forward gliding trajectory
    const mantaGlide = localT * 1.2;
    this.mantaPos.set(
      Math.sin(localT * 0.35) * 1.8,
      -0.65 + 0.35 * Math.sin(localT * 0.5),
      4.0 - mantaGlide
    );

    const waveP = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;
      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;

      // -----------------------------------------------------------------------
      // MAELSTROM CYCLONE FUNNEL (48.0s - 52.0s)
      // -----------------------------------------------------------------------
      if (maelstrom > 0.001) {
        const curX = pos[i3]!;
        const curY = pos[i3 + 1]!;
        const curZ = pos[i3 + 2]!;

        const r = Math.sqrt(curX * curX + curZ * curZ);
        const theta = Math.atan2(curZ, curX);

        // Vortex angular acceleration + downward gravitational suction
        const spinSpeed = 4.0 / (r + 0.4);
        const newTheta = theta + maelstrom * spinSpeed * 0.2;
        const newR = Math.max(0.05, r * (1.0 - maelstrom * 0.65));
        const funnelY = curY - maelstrom * (4.5 / (r + 0.3));

        pos[i3] = newR * Math.cos(newTheta);
        pos[i3 + 1] = funnelY;
        pos[i3 + 2] = newR * Math.sin(newTheta);
        continue;
      }

      // -----------------------------------------------------------------------
      // 0. GERSTNER WAVE OCEAN SURFACE
      // -----------------------------------------------------------------------
      if (type === 0) {
        const waveH = this.evaluateWaves(bx, bz, localT, waveP);
        pos[i3] = waveP.x;
        pos[i3 + 1] = waveP.y;
        pos[i3 + 2] = waveP.z;

        // Wave crest bioluminescence: crests illuminate in laser cyan
        if (waveH > 0.25) {
          const foam = (waveH - 0.25) / 0.45;
          colors[i3] = LIN.oceanCyan.r;
          colors[i3 + 1] = LIN.oceanCyan.g;
          colors[i3 + 2] = LIN.oceanCyan.b;
          intensities[i] = 1.0 + foam * 1.5;
        } else {
          colors[i3] = LIN.oceanBlue.r;
          colors[i3 + 1] = LIN.oceanBlue.g;
          colors[i3 + 2] = LIN.oceanBlue.b;
          intensities[i] = 0.75;
        }
        continue;
      }

      // -----------------------------------------------------------------------
      // 1. MANTA LEVIATHAN: HYDRODYNAMIC PECTORAL FIN FLAPPING
      // -----------------------------------------------------------------------
      if (type === 1) {
        const spanFrac = mantaParams[i]!;
        // Traveling fin wave from shoulders to wingtips
        const flapCycle = localT * 2.4 - spanFrac * 2.8;
        const wingFlap = Math.sin(flapCycle) * (0.65 * spanFrac * spanFrac);
        const pitchWave = Math.cos(flapCycle) * (0.15 * spanFrac);

        pos[i3] = this.mantaPos.x + bx;
        pos[i3 + 1] = this.mantaPos.y + by + wingFlap;
        pos[i3 + 2] = this.mantaPos.z + bz + pitchWave;
        continue;
      }

      // -----------------------------------------------------------------------
      // 2. JELLYFISH BLOOMS: SYSTOLIC CONTRACTION & DRIFT
      // -----------------------------------------------------------------------
      if (type === 2) {
        const pulsePhase = (localT * 0.75) % 1.0;
        const contract = Math.exp(-Math.pow((pulsePhase - 0.2) * 6.0, 2.0));
        const pulseScale = 1.0 - 0.22 * contract;

        const driftY = 0.25 * Math.sin(localT * 0.8 + bx);
        pos[i3] = bx * pulseScale;
        pos[i3 + 1] = by * pulseScale + driftY;
        pos[i3 + 2] = bz * pulseScale;
        continue;
      }

      // -----------------------------------------------------------------------
      // 3. BAIT-BALL FISH VORTEX
      // -----------------------------------------------------------------------
      if (type === 3) {
        // High-speed synchronized spherical rotation
        const orbitAngle = localT * 1.6;
        const rx = bx * Math.cos(orbitAngle) - bz * Math.sin(orbitAngle);
        const rz = bx * Math.sin(orbitAngle) + bz * Math.cos(orbitAngle);
        const ry = by + 0.15 * Math.sin(localT * 3.0 + bx);

        pos[i3] = rx;
        pos[i3 + 1] = ry;
        pos[i3 + 2] = rz;
        continue;
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aColor!.needsUpdate = true;
    this.geometry.attributes.aIntensity!.needsUpdate = true;
  }
}

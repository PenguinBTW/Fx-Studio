// =============================================================================
// PROCEDURAL VOLUMETRIC POINT-CLOUD ANATOMY: "THE AIR-GAP CATHEDRAL"
//
// 145,000-Point High-Fidelity Living Anatomical Point Cloud:
// - Anatomically sculpted human figure in 3/4 heroic reaching profile
// - Cranium vault, jawline, eye orbit, and cerebral gyri/sulci (~18,000 pts)
// - True 3D S-curved vertebral column (33 vertebrae: C1-C7, T1-T12, L1-L5, Sacrum) (~14,000 pts)
// - 12 pairs of articulated ribs & sternum with intercostal volume (~14,000 pts)
// - Hero reaching right arm with 5 articulating fingers (~10,000 pts)
// - Left arm relaxed with natural anatomical flexion (~4,000 pts)
// - Pelvic girdle & athletic legs with quadriceps, knees, calves (~12,000 pts)
// - Living heart with Sinoatrial node, ventricles, aorta (~8,000 pts)
// - Respiratory lung volumes & esophagus (~8,000 pts)
// - Golden Phrenic and Bladder bypass bridges (#E5C07B) (~5,000 pts)
// - Continuous organic musculoskeletal veil (~28,000 pts)
// - Meridian Flow Streamlines (~24,000 actively circulating points:
//     * Leg-to-pelvis upward rivers
//     * Spine double-helix vortex
//     * Arm-to-fingertip discharging river of starlight
//     * Cranial celestial orbital halo)
//
// Strictly closed-form O(1): Frame = f(t). Zero imported 3D models.
// =============================================================================

import * as THREE from 'three';
import { LIN } from './cloud_palette';

export interface AnatomyBuffers {
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  flowDirs: Float32Array;
  streamUs: Float32Array;
  types: Float32Array; // 0: skeleton, 1: brain, 2: organs, 3: heart, 4: skin, 5: bypass, 6: stream
  streamSeeds: Float32Array;
  streamSubtypes: Uint8Array; // 0: leg, 1: spine, 2: arm, 3: cranium
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

export class CloudAnatomy {
  geometry: THREE.BufferGeometry;
  buffers: AnatomyBuffers;
  heartPos: THREE.Vector3 = new THREE.Vector3(-0.03, 1.28, 0.04);
  c4Pos: THREE.Vector3 = new THREE.Vector3(0.0, 1.48, -0.01);
  diaphragmPos: THREE.Vector3 = new THREE.Vector3(0.0, 1.18, 0.02);

  constructor() {
    this.buffers = this.generateAnatomy();
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

  private generateAnatomy(): AnatomyBuffers {
    const MAX_POINTS = 150000;
    const positions = new Float32Array(MAX_POINTS * 3);
    const basePositions = new Float32Array(MAX_POINTS * 3);
    const colors = new Float32Array(MAX_POINTS * 3);
    const sizes = new Float32Array(MAX_POINTS);
    const phases = new Float32Array(MAX_POINTS);
    const intensities = new Float32Array(MAX_POINTS);
    const flowDirs = new Float32Array(MAX_POINTS * 3);
    const streamUs = new Float32Array(MAX_POINTS);
    const types = new Float32Array(MAX_POINTS);
    const streamSeeds = new Float32Array(MAX_POINTS);
    const streamSubtypes = new Uint8Array(MAX_POINTS);

    let idx = 0;
    const rand = mulberry32(19890604);

    const addPoint = (
      x: number, y: number, z: number,
      col: THREE.Color,
      size: number,
      intensity: number,
      type: number,
      fx = 0, fy = 1, fz = 0,
      streamU = 0,
      streamSubtype = 0
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
      types[idx] = type;
      streamSeeds[idx] = rand();
      streamSubtypes[idx] = streamSubtype;

      idx++;
    };

    const colBone = LIN.bone;
    const colAsh = LIN.ash;
    const colSignal = LIN.signal;
    const colLaser = LIN.laser;
    const colGold = LIN.gold;

    // -------------------------------------------------------------------------
    // 1. CRANIUM, FACIAL PROFILE & CEREBRAL CORTEX (~18,000 pts)
    // -------------------------------------------------------------------------
    const headCenter = { x: 0.02, y: 1.62, z: 0.03 };

    // 1A. Cranial Vault (Fibonacci sphere distribution)
    const craniumPts = 6000;
    for (let i = 0; i < craniumPts; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / craniumPts);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      const rx = 0.068 * (1.0 + 0.08 * Math.cos(phi));
      const ry = 0.082;
      const rz = 0.088 * (1.0 + 0.12 * Math.sin(phi) * Math.sin(theta));

      const x = headCenter.x + rx * Math.sin(phi) * Math.cos(theta);
      const y = headCenter.y + ry * Math.cos(phi);
      const z = headCenter.z + rz * Math.sin(phi) * Math.sin(theta);

      const jitter = (rand() - 0.5) * 0.006;
      addPoint(x + jitter, y + jitter, z + jitter, colBone, 2.2, 0.95, 0, 0, 1, 0, (y - 1.54) / 0.18);
    }

    // 1B. Facial Profile & Jaw Contour
    for (let i = 0; i < 3000; i++) {
      const t = rand();
      const ang = (rand() - 0.5) * 1.4;
      const jx = headCenter.x + 0.045 * Math.sin(ang) + 0.01;
      const jy = headCenter.y - 0.06 - t * 0.04;
      const jz = headCenter.z + 0.055 + (1.0 - t) * 0.035 * Math.cos(ang);
      addPoint(jx, jy, jz, colBone, 2.0, 0.9, 0, 0, 1, 0, t);

      const browAng = (rand() - 0.5) * 1.2;
      const bx = headCenter.x + 0.05 * Math.sin(browAng);
      const by = headCenter.y + 0.01 + (rand() - 0.5) * 0.015;
      const bz = headCenter.z + 0.075 + (rand() - 0.5) * 0.01;
      addPoint(bx, by, bz, colBone, 2.2, 0.95, 0, 0, 1, 0, t);
    }

    // 1C. Cerebral Gyri & Sulci (The conscious thinking cortex)
    for (let i = 0; i < 9000; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2.0 * v - 1.0);
      const rVol = Math.cbrt(rand()) * 0.88;

      const gyriWave = Math.sin(phi * 18.0) * Math.cos(theta * 14.0) * 0.008;
      const rx = (0.055 + gyriWave) * rVol;
      const ry = (0.068 + gyriWave) * rVol;
      const rz = (0.072 + gyriWave) * rVol;

      const x = headCenter.x + rx * Math.sin(phi) * Math.cos(theta);
      const y = headCenter.y + 0.015 + ry * Math.cos(phi);
      const z = headCenter.z + rz * Math.sin(phi) * Math.sin(theta);

      addPoint(x, y, z, colAsh, 1.8, 0.8, 1, 0, 1, 0, rand());
    }

    // -------------------------------------------------------------------------
    // 2. VERTEBRAL COLUMN (33 VERTEBRAE) (~14,000 pts)
    // -------------------------------------------------------------------------
    const vPositions: THREE.Vector3[] = [];
    for (let v = 0; v < 33; v++) {
      const frac = v / 32;
      const y = 1.54 - frac * 0.68; // 1.54 (C1) down to 0.86 (Coccyx)

      let zCurvature = 0;
      if (frac < 0.22) {
        const u = frac / 0.22;
        zCurvature = 0.012 * Math.sin(u * Math.PI);
      } else if (frac < 0.65) {
        const u = (frac - 0.22) / 0.43;
        zCurvature = -0.024 * Math.sin(u * Math.PI);
      } else {
        const u = (frac - 0.65) / 0.35;
        zCurvature = 0.008 - Math.sin(u * Math.PI) * 0.016;
      }

      const xCurvature = 0.005 * Math.sin(frac * Math.PI);
      const vPos = new THREE.Vector3(xCurvature, y, zCurvature);
      vPositions.push(vPos);

      // Physical Air-Gap Chasm: vertebra 7 is skipped to create a physical severed gap!
      if (v === 7) continue;

      const ptsPerVertebra = 380;
      for (let p = 0; p < ptsPerVertebra; p++) {
        const ang = rand() * Math.PI * 2;
        const rad = 0.012 + rand() * 0.008;
        const vx = vPos.x + rad * Math.cos(ang);
        const vy = vPos.y + (rand() - 0.5) * 0.012;
        let vz = vPos.z + rad * Math.sin(ang);

        if (rand() > 0.65) {
          vz -= 0.015 + rand() * 0.018;
        }

        let col = colBone;
        let inten = 0.9;
        let sz = 2.4;

        if (v === 6) {
          // Upper lip of the Air Gap: severed terminal bulb flared in intense signal crimson
          col = colSignal;
          inten = 2.0;
          sz = 3.6;
        } else if (v === 8) {
          // Lower lip of the Air Gap: receiving socket glowing in signal crimson
          col = colSignal;
          inten = 1.6;
          sz = 3.2;
        }

        addPoint(vx, vy, vz, col, sz, inten, 0, 0, 1, 0, frac);
      }
    }

    // -------------------------------------------------------------------------
    // 3. THORACIC RIB CAGE & STERNUM (~14,000 pts)
    // -------------------------------------------------------------------------
    for (let r = 0; r < 12; r++) {
      const vIdx = 7 + r;
      const vCenter = vPositions[vIdx]!;
      const ribFrac = r / 11;
      const ribRadiusX = 0.115 * Math.sin(Math.pow(ribFrac, 0.45) * Math.PI * 0.85);
      const ribDepthZ = 0.088 * Math.sin(Math.pow(ribFrac, 0.5) * Math.PI * 0.85);

      for (let side of [-1, 1]) {
        const ptsPerRib = 450;
        for (let p = 0; p < ptsPerRib; p++) {
          const t = p / (ptsPerRib - 1);
          const theta = t * Math.PI * 0.95;

          const rx = side * (0.018 + ribRadiusX * Math.sin(theta));
          const ry = vCenter.y - t * 0.038 - (r * 0.003);
          const rz = vCenter.z + ribDepthZ * (1.0 - Math.cos(theta));

          const jitter = (rand() - 0.5) * 0.005;
          const fx = side * Math.cos(theta);
          const fz = Math.sin(theta);
          addPoint(rx + jitter, ry + jitter, rz + jitter, colBone, 2.0, 0.85, 0, fx, 0, fz, t);
        }
      }
    }

    // Sternum
    for (let i = 0; i < 1500; i++) {
      const t = rand();
      const y = 1.45 - t * 0.18;
      const w = (t < 0.25 ? 0.024 : 0.016) * (1.0 - t * 0.4);
      const x = (rand() - 0.5) * w;
      const z = 0.082 + (rand() - 0.5) * 0.008;
      addPoint(x, y, z, colBone, 2.4, 0.95, 0, 0, 1, 0, t);
    }

    // Clavicles
    for (let side of [-1, 1]) {
      for (let i = 0; i < 900; i++) {
        const t = i / 899;
        const x = side * (0.015 + t * 0.165);
        const y = 1.45 + Math.sin(t * Math.PI) * 0.018;
        const z = 0.08 - t * 0.075 + (rand() - 0.5) * 0.006;
        addPoint(x, y, z, colBone, 2.5, 0.92, 0, side, 0.1, -0.2, t);
      }
    }

    // -------------------------------------------------------------------------
    // 4. HERO REACHING RIGHT ARM & ARTICULATING FINGERS (~10,000 pts)
    // -------------------------------------------------------------------------
    const armPts = 6500;
    for (let p = 0; p < armPts; p++) {
      const t = p / (armPts - 1);
      let x = 0, y = 0, z = 0, rad = 0.025;

      if (t < 0.40) {
        const u = t / 0.40;
        x = 0.18 + u * 0.20;
        y = 1.44 - u * 0.08;
        z = 0.01 + u * 0.21;
        rad = 0.030 * (1.0 - u * 0.25);
      } else if (t < 0.82) {
        const u = (t - 0.40) / 0.42;
        x = 0.38 + u * 0.24;
        y = 1.36 - u * 0.06;
        z = 0.22 + u * 0.20;
        rad = 0.022 * (1.0 - u * 0.30);
      } else {
        const u = (t - 0.82) / 0.18;
        x = 0.62 + u * 0.10;
        y = 1.30 - u * 0.02;
        z = 0.42 + u * 0.08;
        rad = 0.016 * (1.0 - u * 0.5);
      }

      const ang = rand() * Math.PI * 2;
      const r = rand() * rad;
      addPoint(x + r * Math.cos(ang), y + r * Math.sin(ang), z + (rand() - 0.5) * rad * 0.5, colBone, 2.2, 0.9, 0, 0.8, -0.1, 0.6, t);
    }

    // 5 Distinct Reaching Fingers
    const fingerBases = [
      { x: 0.72, y: 1.295, z: 0.49 }, // Thumb
      { x: 0.73, y: 1.290, z: 0.51 }, // Index
      { x: 0.735, y: 1.282, z: 0.52 }, // Middle
      { x: 0.73, y: 1.275, z: 0.51 }, // Ring
      { x: 0.725, y: 1.268, z: 0.49 }, // Pinky
    ];

    for (let f = 0; f < 5; f++) {
      const base = fingerBases[f]!;
      const fLength = f === 2 ? 0.065 : (f === 1 || f === 3 ? 0.058 : 0.045);
      for (let p = 0; p < 500; p++) {
        const u = p / 499;
        const fx = base.x + u * (fLength * 0.8);
        const fy = base.y - u * (fLength * 0.15) + (f === 0 ? 0.015 * Math.sin(u * Math.PI) : 0);
        const fz = base.z + u * (fLength * 0.9);
        const r = 0.004 * (1.0 - u * 0.5);
        const ang = rand() * Math.PI * 2;
        addPoint(fx + r * Math.cos(ang), fy + r * Math.sin(ang), fz, colBone, 2.0, 0.95, 0, 0.7, -0.1, 0.7, 0.85 + u * 0.15);
      }
    }

    // Left Arm (Relaxed)
    for (let p = 0; p < 3500; p++) {
      const t = p / 3499;
      const x = -0.18 - t * 0.035;
      const y = 1.44 - t * 0.62;
      const z = 0.01 + Math.sin(t * Math.PI) * 0.04;
      const rad = 0.028 * (1.0 - t * 0.45);
      const ang = rand() * Math.PI * 2;
      const r = rand() * rad;
      addPoint(x + r * Math.cos(ang), y, z + r * Math.sin(ang), colBone, 2.0, 0.85, 0, 0, -1, 0, t);
    }

    // -------------------------------------------------------------------------
    // 5. PELVIS & LOWER LIMBS (~12,000 pts)
    // -------------------------------------------------------------------------
    for (let p = 0; p < 4000; p++) {
      const ang = rand() * Math.PI * 2;
      const x = 0.115 * Math.cos(ang) * (1.0 + 0.15 * Math.sin(ang));
      const z = 0.075 * Math.sin(ang);
      const y = 0.90 + (rand() - 0.5) * 0.09;
      addPoint(x, y, z, colBone, 2.4, 0.85, 0, -Math.sin(ang), 0.2, Math.cos(ang), rand());
    }

    for (let side of [-1, 1]) {
      const isRight = side === 1;
      for (let p = 0; p < 4000; p++) {
        const t = p / 3999;
        const x = side * (0.082 + t * 0.018);
        const y = 0.86 - t * 0.84;
        const zStep = isRight ? 0.04 * (1.0 - t * 0.5) : -0.02;
        const zKneeBend = Math.sin(t * Math.PI) * 0.03;
        const z = zStep + zKneeBend;

        let legRad = 0.038;
        if (t < 0.45) {
          legRad = 0.044 * (1.0 - (t / 0.45) * 0.25);
        } else if (t < 0.55) {
          legRad = 0.032;
        } else if (t < 0.85) {
          const uCalf = (t - 0.55) / 0.30;
          legRad = 0.032 + 0.012 * Math.sin(uCalf * Math.PI);
        } else {
          legRad = 0.024;
        }

        const ang = rand() * Math.PI * 2;
        const r = rand() * legRad;
        addPoint(x + r * Math.cos(ang), y, z + r * Math.sin(ang), colBone, 2.0, 0.8, 0, 0, 1, 0, t);
      }
    }

    // -------------------------------------------------------------------------
    // 6. LIVING INTERNAL ORGANS & BEATING HEART (~16,000 pts)
    // -------------------------------------------------------------------------
    for (let i = 0; i < 7000; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2.0 * v - 1.0);
      const rVol = Math.cbrt(rand());

      const rx = 0.034 * (1.0 + 0.25 * Math.sin(phi));
      const ry = 0.042 * (1.0 - 0.2 * Math.cos(phi));
      const rz = 0.032;

      const x = this.heartPos.x + rVol * rx * Math.sin(phi) * Math.cos(theta);
      const y = this.heartPos.y + rVol * ry * Math.cos(phi);
      const z = this.heartPos.z + rVol * rz * Math.sin(phi) * Math.sin(theta);

      const isSANode = (x > this.heartPos.x + 0.015 && y > this.heartPos.y + 0.015);
      const col = isSANode ? colLaser : (rand() > 0.8 ? colSignal : colBone);
      const sz = isSANode ? 3.4 : (rand() > 0.8 ? 2.6 : 1.8);
      const inten = isSANode ? 1.6 : 1.1;

      addPoint(x, y, z, col, sz, inten, 3, -Math.sin(theta), Math.cos(phi), Math.cos(theta), rand());
    }

    // Aortic Arch
    for (let i = 0; i < 1800; i++) {
      const t = i / 1799;
      const ang = t * Math.PI * 1.25;
      const x = -0.02 + 0.026 * Math.cos(ang);
      const y = 1.32 + 0.038 * Math.sin(ang);
      const z = 0.03 - t * 0.042;
      const r = rand() * 0.009;
      const a = rand() * Math.PI * 2;
      addPoint(x + r * Math.cos(a), y + r * Math.sin(a), z, colAsh, 2.0, 0.85, 2, -Math.sin(ang), Math.cos(ang), -0.5, t);
    }

    // Esophageal Conduit
    for (let i = 0; i < 4000; i++) {
      const t = rand();
      const y = 1.60 - t * 0.46;
      const ang = rand() * Math.PI * 2;
      const r = 0.012;
      const x = (r + rand() * 0.003) * Math.cos(ang);
      const z = 0.022 + (r + rand() * 0.003) * Math.sin(ang);
      addPoint(x, y, z, colAsh, 1.8, 0.75, 2, 0, -1, 0, t);
    }

    // Bilateral Lungs
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3500; i++) {
        const u = rand();
        const v = rand();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2.0 * v - 1.0);
        const rx = 0.044, ry = 0.082, rz = 0.052;
        const x = side * 0.082 + rx * Math.sin(phi) * Math.cos(theta);
        const y = 1.30 + ry * Math.sin(phi) * Math.sin(theta);
        const z = 0.012 + rz * Math.cos(phi);
        addPoint(x, y, z, colAsh, 1.6, 0.65, 2, side * 0.5, 0.2, 0.5, rand());
      }
    }

    // -------------------------------------------------------------------------
    // 7. GOLDEN BYPASS BRIDGES (~5,000 pts)
    // -------------------------------------------------------------------------
    for (let side of [-1, 1]) {
      for (let i = 0; i < 1800; i++) {
        const t = i / 1799;
        const x = side * (0.024 + Math.sin(t * Math.PI) * 0.048);
        const y = 1.48 - t * 0.30;
        const z = -0.01 + Math.sin(t * Math.PI) * 0.042;
        const r = rand() * 0.005;
        const a = rand() * Math.PI * 2;
        addPoint(x + r * Math.cos(a), y + r * Math.sin(a), z, colGold, 2.5, 1.35, 5, 0, -1, 0, t);
      }
    }

    for (let i = 0; i < 1400; i++) {
      const t = i / 1399;
      const x = (rand() - 0.5) * 0.025;
      const y = 0.96 - t * 0.16;
      const z = -0.015 + Math.sin(t * Math.PI) * 0.035;
      addPoint(x, y, z, colGold, 2.4, 1.25, 5, 0, -1, 0, t);
    }

    // -------------------------------------------------------------------------
    // 8. CONTINUOUS ANATOMICAL MUSCULOSKELETAL VEIL (~28,000 pts)
    // -------------------------------------------------------------------------
    for (let i = 0; i < 28000; i++) {
      const y = rand() * 1.74;
      const theta = rand() * Math.PI * 2;

      let rx = 0.10, rz = 0.08, cx = 0.0, cz = 0.0;

      if (y > 1.54) {
        const u = (y - 1.54) / 0.20;
        rx = 0.072 * Math.sin(u * Math.PI);
        rz = 0.088 * Math.sin(u * Math.PI);
        cz = 0.01;
      } else if (y > 1.42) {
        const u = (y - 1.42) / 0.12;
        rx = 0.046 + 0.085 * (1.0 - u);
        rz = 0.052;
      } else if (y > 1.32) {
        const u = (y - 1.32) / 0.10;
        rx = 0.138 + 0.035 * Math.sin(u * Math.PI);
        rz = 0.098;
      } else if (y > 1.14) {
        const u = (y - 1.14) / 0.18;
        rx = 0.122 + 0.022 * Math.sin(u * Math.PI);
        rz = 0.095 + 0.015 * Math.sin(u * Math.PI);
        cz = 0.015;
      } else if (y > 0.96) {
        const u = (y - 0.96) / 0.18;
        rx = 0.108 + 0.014 * Math.pow(1.0 - u, 2.0);
        rz = 0.082;
      } else if (y > 0.82) {
        const u = (y - 0.82) / 0.14;
        rx = 0.125 + 0.015 * Math.sin(u * Math.PI);
        rz = 0.098 + 0.020 * (1.0 - u);
        cz = -0.01;
      } else {
        const side = rand() > 0.5 ? 1 : -1;
        cx = side * 0.078;
        const u = y / 0.82;
        rx = 0.038 * (0.45 + 0.55 * u);
        rz = rx * 1.15;
      }

      const x = cx + rx * Math.cos(theta);
      const z = cz + rz * Math.sin(theta);
      addPoint(x, y, z, colBone, 1.6 + rand() * 0.8, 0.72, 4, 0, 1, 0, y / 1.74);
    }

    // -------------------------------------------------------------------------
    // 9. MERIDIAN FLOW STREAMLINES (~24,000 ACTIVELY CIRCULATING PARTICLES)
    // -------------------------------------------------------------------------
    // 9A. Ascending Leg-to-Pelvis Rivers (8,000 pts: 4,000 per leg)
    for (let side of [-1, 1]) {
      for (let i = 0; i < 4000; i++) {
        const u = i / 3999;
        const x = side * (0.082 + (1.0 - u) * 0.018);
        const y = 0.04 + u * 0.82;
        const z = (side === 1 ? 0.04 * (1.0 - (1.0 - u) * 0.5) : -0.02) + Math.sin(u * Math.PI) * 0.02;
        const ang = rand() * Math.PI * 2;
        const r = 0.015 * rand();
        addPoint(
          x + r * Math.cos(ang), y, z + r * Math.sin(ang),
          colBone, 2.2 + rand() * 1.0, 1.1, 6,
          0, 1, 0, u, 0
        );
      }
    }

    // 9B. Vertebral Double-Helix Conduits (6,000 pts)
    for (let i = 0; i < 6000; i++) {
      const u = i / 5999;
      const y = 0.88 + u * 0.66; // 0.88 to 1.54
      const helixAngle = u * Math.PI * 8.0 + (i % 2 === 0 ? 0 : Math.PI);
      const helixRadius = 0.018 + 0.008 * Math.sin(u * Math.PI);
      const x = helixRadius * Math.cos(helixAngle);
      const z = -0.01 + 0.02 * Math.sin(u * Math.PI * 2.0) + helixRadius * Math.sin(helixAngle);
      addPoint(
        x, y, z,
        (u > 0.45 && u < 0.58) ? colSignal : colBone,
        2.4, 1.25, 6,
        -Math.sin(helixAngle), 0.8, Math.cos(helixAngle), u, 1
      );
    }

    // 9C. Brachial Reaching River of Light (7,000 pts)
    // Streams from thoracic heart through right arm and launches off fingertips
    for (let i = 0; i < 7000; i++) {
      const u = i / 6999;
      let x = 0, y = 0, z = 0;

      if (u < 0.35) {
        // Shoulder to elbow
        const s = u / 0.35;
        x = 0.18 + s * 0.20;
        y = 1.44 - s * 0.08;
        z = 0.01 + s * 0.21;
      } else if (u < 0.70) {
        // Elbow to wrist
        const s = (u - 0.35) / 0.35;
        x = 0.38 + s * 0.24;
        y = 1.36 - s * 0.06;
        z = 0.22 + s * 0.20;
      } else if (u < 0.88) {
        // Palm to finger tips
        const s = (u - 0.70) / 0.18;
        x = 0.62 + s * 0.16;
        y = 1.30 - s * 0.04;
        z = 0.42 + s * 0.14;
      } else {
        // Shooting off fingertips into the void as curling filaments
        const s = (u - 0.88) / 0.12;
        x = 0.78 + s * 0.35 + 0.04 * Math.sin(s * 8.0);
        y = 1.26 + s * 0.18 + 0.03 * Math.cos(s * 6.0);
        z = 0.56 + s * 0.30;
      }

      const r = (u > 0.88 ? 0.035 * (u - 0.88) : 0.012) * rand();
      const a = rand() * Math.PI * 2;
      addPoint(
        x + r * Math.cos(a), y + r * Math.sin(a), z,
        colBone, 2.0 + rand() * 1.2, 1.2, 6,
        0.8, -0.1, 0.6, u, 2
      );
    }

    // 9D. Cranial Celestial Orbital Halo (3,000 pts)
    for (let i = 0; i < 3000; i++) {
      const u = i / 2999;
      const theta = u * Math.PI * 2;
      const rHalo = 0.115 + 0.018 * Math.sin(u * Math.PI * 6.0);
      const x = headCenter.x + rHalo * Math.cos(theta);
      const y = headCenter.y + 0.04 + 0.015 * Math.sin(theta * 2.0);
      const z = headCenter.z + rHalo * Math.sin(theta);
      addPoint(
        x, y, z,
        colBone, 2.0, 1.0, 6,
        -Math.sin(theta), 0.1, Math.cos(theta), u, 3
      );
    }

    return {
      positions,
      basePositions,
      colors,
      sizes,
      phases,
      intensities,
      flowDirs,
      streamUs,
      types,
      streamSeeds,
      streamSubtypes,
      count: idx,
    };
  }

  /**
   * Closed-form f(t) update for living fluid biomechanics:
   * - Actively circulating streamline advection
   * - Deep thoracic & ribcage respiration wave (0.22 Hz)
   * - Heroic reaching arm traveling wave kinematics
   * - Serpentine spinal sway and living posture
   * - Sharp systolic cardiac contraction and pulse waves
   * - Act II Shockwave recoil whip-lash (14.2s - 18.0s)
   * - Act III Tachycardia thoracic spasm & hand tremor (34.0s - 44.0s)
   */
  update(t: number, heartRateHz = 1.2, respirationHz = 0.22): void {
    const pos = this.buffers.positions;
    const base = this.buffers.basePositions;
    const types = this.buffers.types;
    const streamSeeds = this.buffers.streamSeeds;
    const streamSubtypes = this.buffers.streamSubtypes;
    const n = this.buffers.count;

    // 1. Respiration Cycle (0.22 Hz ~ 13 breaths/min)
    const respCycle = Math.sin(t * respirationHz * Math.PI * 2);
    const respInhale = Math.max(0, respCycle);
    const respScaleX = 1.0 + 0.062 * respInhale;
    const respScaleZ = 1.0 + 0.075 * respInhale;
    const respLiftY = 0.018 * respInhale;

    // 2. Heart Systole & Diastole
    const heartPhase = (t * heartRateHz) % 1.0;
    const systolicContraction = Math.exp(-Math.pow((heartPhase - 0.15) * 8.0, 2.0));
    const heartScale = 1.0 - 0.22 * systolicContraction;

    // 3. Living Serpentine Spinal Undulation
    const spineSwayX = 0.016 * Math.sin(t * 1.2);
    const spineSwayZ = 0.022 * Math.cos(t * 0.9);

    // 4. Act II Shockwave Recoil Whip-lash (14.2s - 18.0s)
    let recoilHeadZ = 0.0;
    if (t >= 14.2 && t <= 18.0) {
      const dt = t - 14.2;
      recoilHeadZ = -0.055 * Math.exp(-dt * 2.5) * Math.sin(dt * 14.0);
    }

    // 5. Act III Tachycardic Somatic Spasm (34.0s - 44.0s)
    let panicTremor = 0.0;
    if (t >= 34.0 && t <= 44.0) {
      const uPanic = Math.min(1.0, (t - 34.0) / 4.0);
      panicTremor = 0.008 * uPanic * Math.sin(t * 75.0);
    }

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;
      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;

      // -----------------------------------------------------------------------
      // A. ACTIVELY CIRCULATING MERIDIAN STREAM PARTICLES (type == 6.0)
      // -----------------------------------------------------------------------
      if (type === 6.0) {
        const subtype = streamSubtypes[i]!;
        const seed = streamSeeds[i]!;

        if (subtype === 0) {
          // Leg streams: flow upward (speed = 0.45 m/s)
          const flowSpeed = 0.45;
          const u = (seed + t * (flowSpeed / 0.82)) % 1.0;
          const isRight = bx > 0;
          const side = isRight ? 1 : -1;

          const cx = side * (0.082 + (1.0 - u) * 0.018);
          const cy = 0.04 + u * 0.82;
          const cz = (isRight ? 0.04 * (1.0 - (1.0 - u) * 0.5) : -0.02) + Math.sin(u * Math.PI) * 0.02;

          pos[i3] = cx + (bx - base[i3]!); // preserve radial offset
          pos[i3 + 1] = cy;
          pos[i3 + 2] = cz;
        } else if (subtype === 1) {
          // Spine double-helix: flow upward (speed = 0.35 m/s)
          const flowSpeed = 0.35;
          const u = (seed + t * (flowSpeed / 0.66)) % 1.0;
          const cy = 0.88 + u * 0.66;
          const helixAngle = u * Math.PI * 8.0 + (i % 2 === 0 ? 0 : Math.PI);
          const helixRadius = 0.018 + 0.008 * Math.sin(u * Math.PI);

          pos[i3] = helixRadius * Math.cos(helixAngle) + spineSwayX * u;
          pos[i3 + 1] = cy;
          pos[i3 + 2] = -0.01 + 0.02 * Math.sin(u * Math.PI * 2.0) + helixRadius * Math.sin(helixAngle) + spineSwayZ * u;
        } else if (subtype === 2) {
          // Reaching arm river: flow outward toward fingertips (speed = 0.55 m/s)
          const flowSpeed = 0.55;
          const u = (seed + t * (flowSpeed / 0.95)) % 1.0;
          let ax = 0, ay = 0, az = 0;

          if (u < 0.35) {
            const s = u / 0.35;
            ax = 0.18 + s * 0.20;
            ay = 1.44 - s * 0.08;
            az = 0.01 + s * 0.21;
          } else if (u < 0.70) {
            const s = (u - 0.35) / 0.35;
            ax = 0.38 + s * 0.24;
            ay = 1.36 - s * 0.06;
            az = 0.22 + s * 0.20;
          } else if (u < 0.88) {
            const s = (u - 0.70) / 0.18;
            ax = 0.62 + s * 0.16;
            ay = 1.30 - s * 0.04;
            az = 0.42 + s * 0.14;
          } else {
            const s = (u - 0.88) / 0.12;
            ax = 0.78 + s * 0.35 + 0.04 * Math.sin(s * 8.0 + t * 3.0);
            ay = 1.26 + s * 0.18 + 0.03 * Math.cos(s * 6.0 + t * 2.5);
            az = 0.56 + s * 0.30;
          }

          // Arm traveling wave offset
          const armWave = Math.sin(t * 1.4 - u * 4.0);
          const armWave2 = Math.cos(t * 1.1 - u * 3.5);

          pos[i3] = ax;
          pos[i3 + 1] = ay + armWave * (0.045 * u);
          pos[i3 + 2] = az + armWave2 * (0.055 * u) + panicTremor;
        } else {
          // Cranial halo: circular orbital motion
          const theta = ((seed + t * 0.2) % 1.0) * Math.PI * 2;
          const rHalo = 0.115 + 0.018 * Math.sin(theta * 3.0);
          pos[i3] = 0.02 + rHalo * Math.cos(theta) + spineSwayX;
          pos[i3 + 1] = 1.62 + 0.04 + 0.015 * Math.sin(theta * 2.0);
          pos[i3 + 2] = 0.03 + rHalo * Math.sin(theta) + spineSwayZ + recoilHeadZ;
        }
        continue;
      }

      // -----------------------------------------------------------------------
      // B. HERO REACHING RIGHT ARM & FINGERS KINEMATICS
      // -----------------------------------------------------------------------
      if (bx > 0.16 && by > 1.18 && bz > -0.05) {
        const armU = Math.min(1.0, Math.max(0.0, (bx - 0.18) / 0.60));
        const armWave = Math.sin(t * 1.4 - armU * 4.0);
        const armWave2 = Math.cos(t * 1.1 - armU * 3.5);

        const dy = armWave * (0.042 * Math.pow(armU, 1.4));
        const dz = armWave2 * (0.052 * Math.pow(armU, 1.4)) + panicTremor;
        const dx = (Math.sin(t * 0.9) * 0.018) * armU;

        pos[i3] = bx + dx;
        pos[i3 + 1] = by + dy;
        pos[i3 + 2] = bz + dz;
        continue;
      }

      // -----------------------------------------------------------------------
      // C. HEART & SINOATRIAL PACEMAKER
      // -----------------------------------------------------------------------
      if (type === 3.0) {
        const hx = bx - this.heartPos.x;
        const hy = by - this.heartPos.y;
        const hz = bz - this.heartPos.z;
        pos[i3] = this.heartPos.x + hx * heartScale + spineSwayX;
        pos[i3 + 1] = this.heartPos.y + hy * heartScale + respLiftY;
        pos[i3 + 2] = this.heartPos.z + hz * heartScale + spineSwayZ + panicTremor;
        continue;
      }

      // -----------------------------------------------------------------------
      // D. THORACIC CAVITY, RIBS & RESPIRATION
      // -----------------------------------------------------------------------
      if ((type === 0.0 || type === 2.0 || type === 4.0) && by > 1.12 && by < 1.50) {
        const uY = Math.sin(((by - 1.12) / 0.38) * Math.PI);
        const curScaleX = 1.0 + (respScaleX - 1.0) * uY;
        const curScaleZ = 1.0 + (respScaleZ - 1.0) * uY;

        pos[i3] = bx * curScaleX + spineSwayX;
        pos[i3 + 1] = by + respLiftY * uY;
        pos[i3 + 2] = bz * curScaleZ + spineSwayZ + panicTremor;
        continue;
      }

      // -----------------------------------------------------------------------
      // E. HEAD, CRANIUM & CERVICAL SPINE (RECOIL WHIP-LASH)
      // -----------------------------------------------------------------------
      if (by >= 1.48) {
        const uNeck = Math.min(1.0, (by - 1.48) / 0.24);
        pos[i3] = bx + spineSwayX;
        pos[i3 + 1] = by;
        pos[i3 + 2] = bz + spineSwayZ + recoilHeadZ * uNeck;
        continue;
      }

      // -----------------------------------------------------------------------
      // F. GENERAL BODY & SKELETON
      // -----------------------------------------------------------------------
      const swayFactor = Math.min(1.0, by / 1.70);
      pos[i3] = bx + spineSwayX * swayFactor;
      pos[i3 + 1] = by;
      pos[i3 + 2] = bz + spineSwayZ * swayFactor;
    }

    this.geometry.attributes.position!.needsUpdate = true;
  }
}

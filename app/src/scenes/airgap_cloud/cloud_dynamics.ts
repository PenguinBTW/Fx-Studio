// =============================================================================
// CLOSED-FORM POINT DYNAMICS: "THE AIR-GAP CATHEDRAL" (FLUID ENGINE)
//
// Procedural closed-form physics systems:
// - Toxic Capsule Ingestion: 1,200 particles with swirling double-helical fluid wake (4.0s - 8.5s)
// - Neural Shockwave: 4,000 intense --signal red particles in high-speed plasma cascade (8.0s - 14.5s)
// - Air-Gap Chasm Eruption: 4,500 ballistic sparks & electric plasma bridges (14.2s - 26.0s)
// - Autonomic Sinus & Cardiac Acoustic Wave: spherical ripple pulse through thorax (34.0s - 44.0s)
// - Cosmic Fluid Ribbon Dispersion: logarithmic spiral advection (50.0s - 60.0s)
//
// Strictly closed-form O(1): Frame = f(t). Zero simulation state drift.
// =============================================================================

import * as THREE from 'three';
import { LIN } from './cloud_palette';
import { clamp, lerp, ease, prog } from '../../engine/util';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class CloudDynamics {
  capsuleGeom: THREE.BufferGeometry;
  capsulePositions: Float32Array;
  capsuleBase: Float32Array;
  capsuleCount = 1500;

  neuralGeom: THREE.BufferGeometry;
  neuralPositions: Float32Array;
  neuralCount = 4500;

  sparksGeom: THREE.BufferGeometry;
  sparksPositions: Float32Array;
  sparksVelocities: Float32Array;
  sparksCount = 5000;

  constructor() {
    // -------------------------------------------------------------------------
    // 1. TOXIC CAPSULE & SWIRLING WAKE
    // -------------------------------------------------------------------------
    this.capsulePositions = new Float32Array(this.capsuleCount * 3);
    this.capsuleBase = new Float32Array(this.capsuleCount * 3);
    const capsuleColors = new Float32Array(this.capsuleCount * 3);
    const capsuleSizes = new Float32Array(this.capsuleCount);
    const capsulePhases = new Float32Array(this.capsuleCount);
    const capsuleInten = new Float32Array(this.capsuleCount);

    const randC = mulberry32(19120405);
    const colSignal = LIN.signal;
    const colBone = LIN.bone;

    for (let i = 0; i < this.capsuleCount; i++) {
      const u = randC(), v = randC();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.016 * Math.cbrt(randC());

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 1.6;
      const z = r * Math.cos(phi);

      const i3 = i * 3;
      this.capsuleBase[i3] = x;
      this.capsuleBase[i3 + 1] = y;
      this.capsuleBase[i3 + 2] = z;

      const isCrimson = randC() > 0.35;
      const col = isCrimson ? colSignal : colBone;
      capsuleColors[i3] = col.r;
      capsuleColors[i3 + 1] = col.g;
      capsuleColors[i3 + 2] = col.b;

      capsuleSizes[i] = 2.4 + randC() * 1.5;
      capsulePhases[i] = randC();
      capsuleInten[i] = isCrimson ? 1.4 : 1.0;
    }

    this.capsuleGeom = new THREE.BufferGeometry();
    this.capsuleGeom.setAttribute('position', new THREE.BufferAttribute(this.capsulePositions, 3));
    this.capsuleGeom.setAttribute('aColor', new THREE.BufferAttribute(capsuleColors, 3));
    this.capsuleGeom.setAttribute('aSize', new THREE.BufferAttribute(capsuleSizes, 1));
    this.capsuleGeom.setAttribute('aPhase', new THREE.BufferAttribute(capsulePhases, 1));
    this.capsuleGeom.setAttribute('aIntensity', new THREE.BufferAttribute(capsuleInten, 1));

    // Dummy flow attributes for shared shader
    const dummyZeros = new Float32Array(this.capsuleCount * 3);
    const dummyOnes = new Float32Array(this.capsuleCount);
    this.capsuleGeom.setAttribute('aFlowDir', new THREE.BufferAttribute(dummyZeros, 3));
    this.capsuleGeom.setAttribute('aStreamU', new THREE.BufferAttribute(dummyOnes, 1));
    this.capsuleGeom.setAttribute('aType', new THREE.BufferAttribute(dummyOnes, 1));

    // -------------------------------------------------------------------------
    // 2. CONSCIOUS NEURAL SHOCKWAVE (PLASMA CASCADE)
    // -------------------------------------------------------------------------
    this.neuralPositions = new Float32Array(this.neuralCount * 3);
    const neuralColors = new Float32Array(this.neuralCount * 3);
    const neuralSizes = new Float32Array(this.neuralCount);
    const neuralPhases = new Float32Array(this.neuralCount);
    const neuralInten = new Float32Array(this.neuralCount);

    const randN = mulberry32(771239);
    for (let i = 0; i < this.neuralCount; i++) {
      const i3 = i * 3;
      neuralColors[i3] = colSignal.r;
      neuralColors[i3 + 1] = colSignal.g;
      neuralColors[i3 + 2] = colSignal.b;
      neuralSizes[i] = 2.8 + randN() * 1.8;
      neuralPhases[i] = randN();
      neuralInten[i] = 1.8;
    }

    this.neuralGeom = new THREE.BufferGeometry();
    this.neuralGeom.setAttribute('position', new THREE.BufferAttribute(this.neuralPositions, 3));
    this.neuralGeom.setAttribute('aColor', new THREE.BufferAttribute(neuralColors, 3));
    this.neuralGeom.setAttribute('aSize', new THREE.BufferAttribute(neuralSizes, 1));
    this.neuralGeom.setAttribute('aPhase', new THREE.BufferAttribute(neuralPhases, 1));
    this.neuralGeom.setAttribute('aIntensity', new THREE.BufferAttribute(neuralInten, 1));

    const dummyNFlow = new Float32Array(this.neuralCount * 3);
    const dummyNU = new Float32Array(this.neuralCount);
    this.neuralGeom.setAttribute('aFlowDir', new THREE.BufferAttribute(dummyNFlow, 3));
    this.neuralGeom.setAttribute('aStreamU', new THREE.BufferAttribute(dummyNU, 1));
    this.neuralGeom.setAttribute('aType', new THREE.BufferAttribute(dummyNU, 1));

    // -------------------------------------------------------------------------
    // 3. AIR-GAP SPARKS & PLASMA BRIDGES
    // -------------------------------------------------------------------------
    this.sparksPositions = new Float32Array(this.sparksCount * 3);
    this.sparksVelocities = new Float32Array(this.sparksCount * 3);
    const sparksColors = new Float32Array(this.sparksCount * 3);
    const sparksSizes = new Float32Array(this.sparksCount);
    const sparksPhases = new Float32Array(this.sparksCount);
    const sparksInten = new Float32Array(this.sparksCount);

    const randS = mulberry32(31415926);
    for (let i = 0; i < this.sparksCount; i++) {
      const i3 = i * 3;
      const isGold = randS() > 0.85;
      const col = isGold ? LIN.gold : colSignal;
      sparksColors[i3] = col.r;
      sparksColors[i3 + 1] = col.g;
      sparksColors[i3 + 2] = col.b;

      // Fountain velocities with outward radial dispersion
      const phi = randS() * Math.PI * 2;
      const speed = 0.5 + randS() * 1.2;
      this.sparksVelocities[i3] = Math.cos(phi) * speed * 0.7;
      this.sparksVelocities[i3 + 1] = 0.2 - randS() * 1.1; // initial burst upward then downward
      this.sparksVelocities[i3 + 2] = Math.sin(phi) * speed * 0.7;

      sparksSizes[i] = 2.2 + randS() * 2.2;
      sparksPhases[i] = randS();
      sparksInten[i] = 1.6;
    }

    this.sparksGeom = new THREE.BufferGeometry();
    this.sparksGeom.setAttribute('position', new THREE.BufferAttribute(this.sparksPositions, 3));
    this.sparksGeom.setAttribute('aColor', new THREE.BufferAttribute(sparksColors, 3));
    this.sparksGeom.setAttribute('aSize', new THREE.BufferAttribute(sparksSizes, 1));
    this.sparksGeom.setAttribute('aPhase', new THREE.BufferAttribute(sparksPhases, 1));
    this.sparksGeom.setAttribute('aIntensity', new THREE.BufferAttribute(sparksInten, 1));

    const dummySFlow = new Float32Array(this.sparksCount * 3);
    const dummySU = new Float32Array(this.sparksCount);
    this.sparksGeom.setAttribute('aFlowDir', new THREE.BufferAttribute(dummySFlow, 3));
    this.sparksGeom.setAttribute('aStreamU', new THREE.BufferAttribute(dummySU, 1));
    this.sparksGeom.setAttribute('aType', new THREE.BufferAttribute(dummySU, 1));
  }

  /**
   * Updates all dynamic physical systems deterministically at time t
   */
  update(t: number): {
    toxicY: number;
    neuralFrontY: number;
    chasmImpactFlare: number;
    heartRateHz: number;
    dispersionAmount: number;
    pulseRadius: number;
    pulseIntensity: number;
  } {
    // -------------------------------------------------------------------------
    // 1. TOXIC CAPSULE & SWIRLING WAKE (4.0s - 8.5s)
    // -------------------------------------------------------------------------
    let toxicY = 1.62;
    let capsuleActive = true;

    if (t < 4.0) {
      toxicY = 1.62;
    } else if (t < 8.5) {
      const u = (t - 4.0) / 4.5;
      toxicY = lerp(1.62, 1.15, ease.inOutCubic(u));
    } else if (t < 28.0) {
      toxicY = 1.15;
    } else if (t < 34.0) {
      toxicY = 1.15;
    } else {
      capsuleActive = false;
      toxicY = 1.15;
    }

    if (capsuleActive) {
      const spinAngleBase = t * 6.0;
      for (let i = 0; i < this.capsuleCount; i++) {
        const i3 = i * 3;
        if (i < 500) {
          // Rigid core payload
          const bx = this.capsuleBase[i3]!;
          const by = this.capsuleBase[i3 + 1]!;
          const bz = this.capsuleBase[i3 + 2]!;
          const sinS = Math.sin(spinAngleBase);
          const cosS = Math.cos(spinAngleBase);
          const rx = bx * cosS - bz * sinS;
          const rz = bx * sinS + bz * cosS;
          this.capsulePositions[i3] = rx;
          this.capsulePositions[i3 + 1] = toxicY + by;
          this.capsulePositions[i3 + 2] = 0.03 + rz;
        } else {
          // Swirling fluid wake trailing above the descending capsule
          const tailFrac = (i - 500) / 1000;
          const trailY = toxicY + tailFrac * 0.16;
          const spinA = spinAngleBase + tailFrac * Math.PI * 6.0;
          const spinR = 0.010 * (1.0 + tailFrac * 1.8);
          this.capsulePositions[i3] = spinR * Math.cos(spinA);
          this.capsulePositions[i3 + 1] = trailY;
          this.capsulePositions[i3 + 2] = 0.03 + spinR * Math.sin(spinA);
        }
      }
    } else {
      for (let i = 0; i < this.capsuleCount * 3; i++) {
        this.capsulePositions[i] = -100;
      }
    }
    this.capsuleGeom.attributes.position!.needsUpdate = true;

    // -------------------------------------------------------------------------
    // 2. CONSCIOUS NEURAL SHOCKWAVE (PLASMA CASCADE) (8.0s - 14.5s)
    // -------------------------------------------------------------------------
    let neuralFrontY = 1.70;

    if (t >= 8.0 && t <= 14.5) {
      const uN = prog(t, 8.0, 14.2, ease.inQuad);
      neuralFrontY = lerp(1.70, 1.22, uN);

      for (let i = 0; i < this.neuralCount; i++) {
        const i3 = i * 3;
        const tailFrac = i / this.neuralCount;
        const yPt = neuralFrontY + tailFrac * 0.22;
        const helixAngle = yPt * 35.0 + t * 18.0;
        const r = 0.014 * (1.0 - tailFrac * 0.4);

        this.neuralPositions[i3] = r * Math.cos(helixAngle);
        this.neuralPositions[i3 + 1] = yPt;
        this.neuralPositions[i3 + 2] = -0.01 + 0.02 * Math.sin(yPt * 8.0) + r * Math.sin(helixAngle);
      }
    } else {
      for (let i = 0; i < this.neuralCount * 3; i++) {
        this.neuralPositions[i] = -100;
      }
    }
    this.neuralGeom.attributes.position!.needsUpdate = true;

    // -------------------------------------------------------------------------
    // 3. AIR-GAP CHASM IMPACT & SPARKS (14.2s - 26.0s)
    // -------------------------------------------------------------------------
    let chasmImpactFlare = 0.0;
    const airGapY = 1.40; // True cervical air-gap level (C6-T1)

    if (t >= 14.2 && t <= 26.0) {
      const totalDt = t - 14.2;
      chasmImpactFlare = Math.exp(-totalDt * 2.2);

      for (let i = 0; i < this.sparksCount; i++) {
        const i3 = i * 3;

        // Cyclic continuous fountain: sparks emit continuously every 1.4s
        const sparkPhase = (i / this.sparksCount);
        const cyclePeriod = 1.4;
        const dt = (totalDt + sparkPhase * cyclePeriod) % cyclePeriod;

        if (i < 800) {
          // Electric plasma bridges snapping across the air gap (y: 1.38 - 1.42)
          const arcFrac = (i / 800);
          const arcAngle = arcFrac * Math.PI * 2.0 + t * 25.0;
          const arcRadius = 0.015 + 0.010 * Math.sin(t * 30.0 + arcFrac * 10.0);
          const jitter = (Math.sin(t * 90.0 + i * 7.0)) * 0.006;

          this.sparksPositions[i3] = arcRadius * Math.cos(arcAngle);
          this.sparksPositions[i3 + 1] = airGapY + (arcFrac - 0.5) * 0.035 + jitter;
          this.sparksPositions[i3 + 2] = -0.01 + arcRadius * Math.sin(arcAngle);
        } else {
          // Ballistic fountain sparks cascading downward
          const vx = this.sparksVelocities[i3]!;
          const vy = this.sparksVelocities[i3 + 1]!;
          const vz = this.sparksVelocities[i3 + 2]!;

          const drag = Math.exp(-dt * 0.85);
          const curX = 0.0 + vx * dt * drag;
          const curY = airGapY + vy * dt * drag - 0.5 * 1.8 * dt * dt;
          const curZ = -0.01 + vz * dt * drag;

          this.sparksPositions[i3] = curX;
          this.sparksPositions[i3 + 1] = curY;
          this.sparksPositions[i3 + 2] = curZ;
        }
      }
    } else {
      for (let i = 0; i < this.sparksCount * 3; i++) {
        this.sparksPositions[i] = -100;
      }
    }
    this.sparksGeom.attributes.position!.needsUpdate = true;

    // -------------------------------------------------------------------------
    // 4. AUTONOMIC HEART RATE & CARDIAC ACOUSTIC PULSE WAVE
    // -------------------------------------------------------------------------
    let heartRateHz = 1.2;
    if (t >= 34.0) {
      const uPanic = prog(t, 34.0, 38.0, ease.outCubic);
      heartRateHz = lerp(1.2, 2.75, uPanic);
    }

    const beatPhase = (t * heartRateHz) % 1.0;
    const pulseRadius = beatPhase * 0.85;
    const pulseIntensity = Math.exp(-beatPhase * 4.2);

    // -------------------------------------------------------------------------
    // 5. STARDUST COSMIC RIBBON DISPERSION (50.0s - 60.0s)
    // -------------------------------------------------------------------------
    const dispersionAmount = prog(t, 50.0, 59.8, ease.inQuad);

    return {
      toxicY,
      neuralFrontY,
      chasmImpactFlare,
      heartRateHz,
      dispersionAmount,
      pulseRadius,
      pulseIntensity,
    };
  }
}

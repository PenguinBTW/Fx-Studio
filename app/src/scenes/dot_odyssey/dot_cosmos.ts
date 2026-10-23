// =============================================================================
// COSMIC SINGULARITY: BLACK HOLE, 4D TESSERACT & GALAXY (MOVEMENTS 5-7: 104s - 180s)
//
// 120,000-Point Cosmological Physics & Sacred Hyperdimensions:
// - Movement 5 (104s - 130s): Kerr Black Hole with Doppler-boosted accretion disk,
//                             Einstein gravitational lens rings & relativistic plasma jets
// - Movement 6 (130s - 156s): 4D Rotating Tesseract Hypercube (inside-out projection) &
//                             Metatron's sacred geometric matrix
// - Movement 7 (156s - 180s): The Cosmological Big Bang detonation &
//                             100,000-point twin-arm logarithmic Spiral Galaxy
//
// Strictly closed-form O(1): Frame = f(t). Zero imported 3D models.
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

export class DotCosmos {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  // Stored coordinate data for the 3 cosmic movements
  blackHoleBase: Float32Array;
  tesseract4DBase: Float32Array; // [x, y, z, w]
  galaxyBase: Float32Array; // [radius, theta, armType]

  count: number;

  constructor() {
    const MAX_POINTS = 120000;
    this.count = MAX_POINTS;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);

    this.blackHoleBase = new Float32Array(MAX_POINTS * 3);
    this.tesseract4DBase = new Float32Array(MAX_POINTS * 4);
    this.galaxyBase = new Float32Array(MAX_POINTS * 3);

    const rand = mulberry32(992811);

    const colWhite = LIN.photonWhite;
    const colCyan = LIN.accretionCyan;
    const colOrange = LIN.accretionOrange;
    const colJet = LIN.jetBlue;
    const colLime = LIN.tesseractLime;
    const colMagenta = LIN.tesseractMagenta;
    const colGalCore = LIN.galaxyCore;
    const colGalArm1 = LIN.galaxyArm1;
    const colGalArm2 = LIN.galaxyArm2;

    // -------------------------------------------------------------------------
    // 1. SETUP MOVEMENT 5: KERR BLACK HOLE & ACCRETION DISK
    // -------------------------------------------------------------------------
    for (let i = 0; i < MAX_POINTS; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      this.phases[i] = rand();
      this.sizes[i] = 2.0 + rand() * 1.5;
      this.intensities[i] = 1.0;

      // Accretion Disk & Lensing Halo
      if (i < 70000) {
        // Equatorial Keplerian Disk (r: 1.5 to 7.0)
        const uR = rand();
        const r = 1.45 + Math.pow(uR, 1.8) * 5.8;
        const theta = rand() * Math.PI * 2;
        const diskThick = 0.08 * (r / 7.0);

        this.blackHoleBase[i3] = r * Math.cos(theta);
        this.blackHoleBase[i3 + 1] = (rand() - 0.5) * diskThick;
        this.blackHoleBase[i3 + 2] = r * Math.sin(theta);
      } else if (i < 95000) {
        // Gravitational Lens Einstein Rings (Upper and Lower warped arcs)
        const u = rand();
        const rLens = 1.5 + Math.pow(u, 1.5) * 4.5;
        const ang = rand() * Math.PI * 2;
        const isUpper = rand() > 0.5;

        // Warped vertical halo
        this.blackHoleBase[i3] = rLens * Math.cos(ang);
        this.blackHoleBase[i3 + 1] = (isUpper ? 1 : -1) * (0.8 + 0.4 * rLens * Math.abs(Math.sin(ang)));
        this.blackHoleBase[i3 + 2] = -0.4 + (rand() - 0.5) * 0.15;
      } else if (i < 105000) {
        // Relativistic Plasma Jets (along ±Y)
        const isNorth = rand() > 0.5;
        const jetY = (isNorth ? 1 : -1) * (1.2 + rand() * 7.5);
        const jetRad = 0.04 + (Math.abs(jetY) / 8.0) * 0.35;
        const ang = rand() * Math.PI * 2;

        this.blackHoleBase[i3] = jetRad * Math.cos(ang);
        this.blackHoleBase[i3 + 1] = jetY;
        this.blackHoleBase[i3 + 2] = jetRad * Math.sin(ang);
      } else {
        // Photon Sphere Razor Ring (r = 1.40)
        const ang = rand() * Math.PI * 2;
        const rPh = 1.40 + (rand() - 0.5) * 0.02;
        this.blackHoleBase[i3] = rPh * Math.cos(ang);
        this.blackHoleBase[i3 + 1] = (rand() - 0.5) * 0.02;
        this.blackHoleBase[i3 + 2] = rPh * Math.sin(ang);
      }

      // -----------------------------------------------------------------------
      // 2. SETUP MOVEMENT 6: 4D HYPERCUBE TESSERACT & METATRON
      // -----------------------------------------------------------------------
      if (i < 65000) {
        // 4D Tesseract Edges: 16 vertices connected by 32 edges
        const edgeIdx = Math.floor(rand() * 32);
        const tEdge = rand();
        // Hypercube coordinates in [-1.5, 1.5]^4
        const v4 = [
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
        ];
        const v4_2 = [
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
          (rand() > 0.5 ? 1 : -1) * 1.5,
        ];
        // Line segment interpolation in 4D
        this.tesseract4DBase[i4] = lerp(v4[0]!, v4_2[0]!, tEdge);
        this.tesseract4DBase[i4 + 1] = lerp(v4[1]!, v4_2[1]!, tEdge);
        this.tesseract4DBase[i4 + 2] = lerp(v4[2]!, v4_2[2]!, tEdge);
        this.tesseract4DBase[i4 + 3] = lerp(v4[3]!, v4_2[3]!, tEdge);
      } else {
        // Metatron's Concentric Pulsing Rings (55,000 pts)
        const ringTier = Math.floor(rand() * 5);
        const rM = (ringTier + 1) * 0.75;
        const ang = rand() * Math.PI * 2;
        this.tesseract4DBase[i4] = rM * Math.cos(ang);
        this.tesseract4DBase[i4 + 1] = rM * Math.sin(ang);
        this.tesseract4DBase[i4 + 2] = (rand() - 0.5) * 0.1;
        this.tesseract4DBase[i4 + 3] = Math.sin(ang * 3.0) * 0.8;
      }

      // -----------------------------------------------------------------------
      // 3. SETUP MOVEMENT 7: TWIN-ARM LOGARITHMIC SPIRAL GALAXY
      // -----------------------------------------------------------------------
      if (i < 25000) {
        // Dense Galactic Core Bulge (25,000 pts)
        const u = rand(), v = rand();
        const th = u * Math.PI * 2;
        const ph = Math.acos(2.0 * v - 1.0);
        const rBulge = Math.pow(rand(), 2.0) * 1.2;

        this.galaxyBase[i3] = rBulge * Math.sin(ph) * Math.cos(th);
        this.galaxyBase[i3 + 1] = rBulge * Math.cos(ph) * 0.45; // oblate core
        this.galaxyBase[i3 + 2] = rBulge * Math.sin(ph) * Math.sin(th);
      } else {
        // Twin Logarithmic Spiral Arms (95,000 pts)
        const isArm1 = (i % 2 === 0);
        const armOffset = isArm1 ? 0 : Math.PI;
        const uArm = (i - 25000) / 95000;
        const thetaArm = uArm * Math.PI * 5.0 + armOffset; // 2.5 full winds
        // Logarithmic spiral: r = a * exp(b * theta)
        const rGal = 0.8 * Math.exp(0.32 * (thetaArm - armOffset));
        const armSpread = 0.25 * (rGal / 8.0);

        const gx = rGal * Math.cos(thetaArm) + (rand() - 0.5) * armSpread;
        const gy = (rand() - 0.5) * 0.18 * Math.exp(-rGal * 0.15); // thin disk
        const gz = rGal * Math.sin(thetaArm) + (rand() - 0.5) * armSpread;

        this.galaxyBase[i3] = gx;
        this.galaxyBase[i3 + 1] = gy;
        this.galaxyBase[i3 + 2] = gz;
      }

      // Detonation outward expansion velocities for Big Bang
      const dirPhi = rand() * Math.PI * 2;
      const dirTheta = Math.acos(2.0 * rand() - 1.0);
      const blastSpeed = 1.8 + rand() * 5.5;
      this.velocities[i3] = blastSpeed * Math.sin(dirTheta) * Math.cos(dirPhi);
      this.velocities[i3 + 1] = blastSpeed * Math.cos(dirTheta);
      this.velocities[i3 + 2] = blastSpeed * Math.sin(dirTheta) * Math.sin(dirPhi);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(this.intensities, 1));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
  }

  /**
   * Updates Movements 5, 6, and 7 at time t in [104.0s, 180.0s]
   */
  update(t: number): void {
    const pos = this.positions;
    const colors = this.colors;
    const sizes = this.sizes;
    const intensities = this.intensities;
    const n = this.count;

    // Movement intervals:
    // Mov 5 (Black Hole): 104.0s - 130.0s
    // Mov 6 (Tesseract): 130.0s - 156.0s
    // Mov 7 (Big Bang Galaxy): 156.0s - 180.0s

    const isMov5 = (t < 130.0);
    const isMov6 = (t >= 130.0 && t < 156.0);
    const isMov7 = (t >= 156.0);

    // -------------------------------------------------------------------------
    // MOVEMENT 5: KERR BLACK HOLE & ACCRETION DISK (104.0s - 130.0s)
    // -------------------------------------------------------------------------
    if (isMov5) {
      const localT = t - 104.0;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const bx = this.blackHoleBase[i3]!;
        const by = this.blackHoleBase[i3 + 1]!;
        const bz = this.blackHoleBase[i3 + 2]!;

        const r = Math.sqrt(bx * bx + bz * bz);
        const theta = Math.atan2(bz, bx);

        // Keplerian angular velocity: v ~ 1 / sqrt(r^3)
        const keplerSpeed = 3.5 / Math.sqrt(r * r * r + 0.1);
        const curTheta = theta + localT * keplerSpeed;

        const curX = r * Math.cos(curTheta);
        const curZ = r * Math.sin(curTheta);

        pos[i3] = curX;
        pos[i3 + 1] = by;
        pos[i3 + 2] = curZ;

        // Relativistic Doppler Beaming:
        // Approaching side (curX < 0): blueshifted white-cyan, intense
        // Receding side (curX > 0): redshifted orange-amber, dimmer
        const doppler = -curX / (r + 0.001); // [-1..1]
        if (i < 70000 || i >= 105000) {
          if (doppler > 0.0) {
            colors[i3] = lerp(LIN.accretionCyan.r, LIN.photonWhite.r, doppler);
            colors[i3 + 1] = lerp(LIN.accretionCyan.g, LIN.photonWhite.g, doppler);
            colors[i3 + 2] = lerp(LIN.accretionCyan.b, LIN.photonWhite.b, doppler);
            intensities[i] = 1.0 + doppler * 1.5;
            sizes[i] = 2.4 + doppler * 1.2;
          } else {
            const redFactor = -doppler;
            colors[i3] = lerp(LIN.accretionCyan.r, LIN.accretionOrange.r, redFactor);
            colors[i3 + 1] = lerp(LIN.accretionCyan.g, LIN.accretionOrange.g, redFactor);
            colors[i3 + 2] = lerp(LIN.accretionCyan.b, LIN.accretionOrange.b, redFactor);
            intensities[i] = Math.max(0.3, 1.0 - redFactor * 0.6);
            sizes[i] = 2.0;
          }
        } else if (i < 95000) {
          // Einstein Lens Ring
          colors[i3] = LIN.photonWhite.r;
          colors[i3 + 1] = LIN.photonWhite.g;
          colors[i3 + 2] = LIN.photonWhite.b;
          intensities[i] = 1.4;
          sizes[i] = 2.8;
        } else {
          // Plasma Jet
          colors[i3] = LIN.jetBlue.r;
          colors[i3 + 1] = LIN.jetBlue.g;
          colors[i3 + 2] = LIN.jetBlue.b;
          intensities[i] = 1.6;
          sizes[i] = 2.6;
        }
      }
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 6: SACRED 4D TESSERACT HYPERCUBE (130.0s - 156.0s)
    // -------------------------------------------------------------------------
    else if (isMov6) {
      const localT = t - 130.0;
      // 4D Rotation angles in XW and YZ planes
      const rotXW = localT * 0.85;
      const rotYZ = localT * 0.65;
      const cosXW = Math.cos(rotXW), sinXW = Math.sin(rotXW);
      const cosYZ = Math.cos(rotYZ), sinYZ = Math.sin(rotYZ);

      const D = 4.2; // 4D camera distance for perspective projection

      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        let x4 = this.tesseract4DBase[i4]!;
        let y4 = this.tesseract4DBase[i4 + 1]!;
        let z4 = this.tesseract4DBase[i4 + 2]!;
        let w4 = this.tesseract4DBase[i4 + 3]!;

        // Rotate in X-W plane
        const rx = x4 * cosXW - w4 * sinXW;
        const rw = x4 * sinXW + w4 * cosXW;

        // Rotate in Y-Z plane
        const ry = y4 * cosYZ - z4 * sinYZ;
        const rz = y4 * sinYZ + z4 * cosYZ;

        // 4D -> 3D Perspective Projection (inside-out topological inversion!)
        const projScale = D / Math.max(0.8, D - rw);

        pos[i3] = rx * projScale;
        pos[i3 + 1] = ry * projScale;
        pos[i3 + 2] = rz * projScale;

        // Chromatic resonance: lime green <-> magenta
        const depthHarmonic = (rw / 1.5) * 0.5 + 0.5;
        colors[i3] = lerp(LIN.tesseractLime.r, LIN.tesseractMagenta.r, depthHarmonic);
        colors[i3 + 1] = lerp(LIN.tesseractLime.g, LIN.tesseractMagenta.g, depthHarmonic);
        colors[i3 + 2] = lerp(LIN.tesseractLime.b, LIN.tesseractMagenta.b, depthHarmonic);

        intensities[i] = 1.0 + depthHarmonic * 0.6;
        sizes[i] = 2.2 * projScale * 0.7;
      }
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 7: THE BIG BANG & SPIRAL GALAXY REBIRTH (156.0s - 180.0s)
    // -------------------------------------------------------------------------
    else {
      const localT = t - 156.0;

      // Big Bang detonation (156.0s - 161.0s -> localT 0.0s - 5.0s)
      const uBang = prog(localT, 0.0, 3.5, ease.outCubic);

      // Galaxy rotation velocity
      const galSpin = (localT - 3.5) * 0.35;

      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const gx = this.galaxyBase[i3]!;
        const gy = this.galaxyBase[i3 + 1]!;
        const gz = this.galaxyBase[i3 + 2]!;

        if (uBang < 1.0) {
          // Big Bang explosive detonation
          const vx = this.velocities[i3]!;
          const vy = this.velocities[i3 + 1]!;
          const vz = this.velocities[i3 + 2]!;

          pos[i3] = vx * uBang * 1.5;
          pos[i3 + 1] = vy * uBang * 1.5;
          pos[i3 + 2] = vz * uBang * 1.5;

          colors[i3] = LIN.photonWhite.r;
          colors[i3 + 1] = LIN.photonWhite.g;
          colors[i3 + 2] = LIN.photonWhite.b;
          intensities[i] = 2.5 * (1.0 - uBang * 0.5);
          sizes[i] = 3.5;
        } else {
          // Logarithmic Spiral Galaxy Equilibrium
          const r = Math.sqrt(gx * gx + gz * gz);
          const theta = Math.atan2(gz, gx);

          // Differential galactic rotation: core spins faster
          const omega = galSpin * (1.0 + 1.2 / (r + 0.8));
          const curTheta = theta + omega;

          pos[i3] = r * Math.cos(curTheta);
          pos[i3 + 1] = gy + 0.08 * Math.sin(r * 2.5 - galSpin * 2.0);
          pos[i3 + 2] = r * Math.sin(curTheta);

          // Galactic Core vs Arms Colors
          if (r < 1.1) {
            colors[i3] = LIN.galaxyCore.r;
            colors[i3 + 1] = LIN.galaxyCore.g;
            colors[i3 + 2] = LIN.galaxyCore.b;
            intensities[i] = 1.6;
            sizes[i] = 2.8;
          } else {
            const isArm1 = (i % 2 === 0);
            const col = isArm1 ? LIN.galaxyArm1 : LIN.galaxyArm2;
            colors[i3] = col.r;
            colors[i3 + 1] = col.g;
            colors[i3 + 2] = col.b;
            intensities[i] = 1.1;
            sizes[i] = 2.0;
          }
        }
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aColor!.needsUpdate = true;
    this.geometry.attributes.aSize!.needsUpdate = true;
    this.geometry.attributes.aIntensity!.needsUpdate = true;
  }
}

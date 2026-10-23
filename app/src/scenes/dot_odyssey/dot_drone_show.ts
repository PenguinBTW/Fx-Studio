// =============================================================================
// SYNCHRONIZED DRONE METAMORPHOSIS SYMPHONY (MOVEMENT 3: 52.0s - 78.0s)
//
// 75,000-Point Coordinated Drone Fleet with Closed-Form Spring Morphs:
// - Formation 1 (52.0s - 61.0s): Rotating 3D Earth Globe with stippled continents & satellite rings
// - Formation 2 (61.0s - 70.0s): Anatomical Beating Heart (Ruby & Cyan) with systolic contraction
// - Formation 3 (70.0s - 78.0s): Soaring Phoenix with aerodynamic wing flapping & flame ribbons
// - Relativistic Warp Speed Streaks (76.0s - 78.0s) punching into Movement 4
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

export class DotDroneShow {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  // Stored target positions for the 3 distinct formations
  earthPositions: Float32Array;
  heartPositions: Float32Array;
  phoenixPositions: Float32Array;

  // Target colors per formation
  earthColors: Float32Array;
  heartColors: Float32Array;
  phoenixColors: Float32Array;

  phoenixWingSpan: Float32Array; // span fraction for flapping kinematics
  count: number;

  constructor() {
    const MAX_POINTS = 75000;
    this.count = MAX_POINTS;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);

    this.earthPositions = new Float32Array(MAX_POINTS * 3);
    this.heartPositions = new Float32Array(MAX_POINTS * 3);
    this.phoenixPositions = new Float32Array(MAX_POINTS * 3);

    this.earthColors = new Float32Array(MAX_POINTS * 3);
    this.heartColors = new Float32Array(MAX_POINTS * 3);
    this.phoenixColors = new Float32Array(MAX_POINTS * 3);

    this.phoenixWingSpan = new Float32Array(MAX_POINTS);

    const rand = mulberry32(551299);

    const colWhite = LIN.droneWhite;
    const colGreen = LIN.droneGreen;
    const colRuby = LIN.heartRuby;
    const colCyan = LIN.cyberCyan;
    const colFire = LIN.phoenixFire;
    const colGold = LIN.phoenixGold;

    // -------------------------------------------------------------------------
    // 1. GENERATE FORMATION 1: ROTATING 3D EARTH GLOBE & RINGS
    // -------------------------------------------------------------------------
    const globeRadius = 2.4;
    for (let i = 0; i < MAX_POINTS; i++) {
      const i3 = i * 3;
      this.phases[i] = rand();
      this.sizes[i] = 2.2 + rand() * 1.2;
      this.intensities[i] = 1.1;

      if (i < 60000) {
        // Globe Sphere
        const phi = Math.acos(1.0 - 2.0 * (i + 0.5) / 60000);
        const theta = Math.PI * (1.0 + Math.sqrt(5.0)) * i;

        const x = globeRadius * Math.sin(phi) * Math.cos(theta);
        const y = globeRadius * Math.cos(phi);
        const z = globeRadius * Math.sin(phi) * Math.sin(theta);

        this.earthPositions[i3] = x;
        this.earthPositions[i3 + 1] = y;
        this.earthPositions[i3 + 2] = z;

        // Procedural continents noise map
        const lat = phi - Math.PI * 0.5;
        const lon = theta % (Math.PI * 2.0);
        const continentNoise = Math.sin(lon * 3.0) * Math.cos(lat * 4.0) + Math.sin(lat * 7.0 + lon * 2.0) * 0.4;
        const isLand = continentNoise > 0.15;

        const col = isLand ? colGreen : colWhite;
        this.earthColors[i3] = col.r;
        this.earthColors[i3 + 1] = col.g;
        this.earthColors[i3 + 2] = col.b;
      } else {
        // Orbital Satellite Rings (15,000 pts)
        const ringIdx = i - 60000;
        const ringType = ringIdx % 3; // 3 tilted rings
        const u = ringIdx / 15000;
        const ang = u * Math.PI * 8.0;
        const ringR = globeRadius * (1.35 + ringType * 0.25);

        let rx = ringR * Math.cos(ang);
        let ry = (ringType === 0 ? 0 : (ringType === 1 ? Math.sin(ang) * 0.8 : -Math.sin(ang) * 0.6));
        let rz = ringR * Math.sin(ang);

        this.earthPositions[i3] = rx;
        this.earthPositions[i3 + 1] = ry;
        this.earthPositions[i3 + 2] = rz;

        this.earthColors[i3] = colWhite.r;
        this.earthColors[i3 + 1] = colWhite.g;
        this.earthColors[i3 + 2] = colWhite.b;
      }

      // -----------------------------------------------------------------------
      // 2. GENERATE FORMATION 2: ANATOMICAL BEATING HEART
      // -----------------------------------------------------------------------
      const uH = rand(), vH = rand();
      const thetaH = uH * Math.PI * 2;
      const phiH = Math.acos(2.0 * vH - 1.0);
      const rVol = Math.cbrt(rand()) * 2.2;

      // Cardioid mathematical surface
      const hx = rVol * 0.95 * Math.pow(Math.sin(phiH), 3.0) * Math.sin(thetaH);
      const hy = rVol * (0.85 * Math.cos(phiH) - 0.25 * Math.cos(2.0 * phiH) - 0.10 * Math.cos(3.0 * phiH));
      const hz = rVol * 0.65 * Math.sin(phiH) * Math.cos(thetaH);

      this.heartPositions[i3] = hx;
      this.heartPositions[i3 + 1] = hy;
      this.heartPositions[i3 + 2] = hz;

      const isAorta = hy > 0.8 && Math.abs(hx) < 0.6;
      const colH = isAorta ? colCyan : colRuby;
      this.heartColors[i3] = colH.r;
      this.heartColors[i3 + 1] = colH.g;
      this.heartColors[i3 + 2] = colH.b;

      // -----------------------------------------------------------------------
      // 3. GENERATE FORMATION 3: SOARING PHOENIX
      // -----------------------------------------------------------------------
      if (i < 55000) {
        // Broad Wings (27,500 pts per wing)
        const side = i % 2 === 0 ? 1 : -1;
        const wingU = (i / 55000); // 0 at body, 1 at tip
        const span = Math.pow(wingU, 0.65) * 5.0; // 5m wing half-span
        const chord = 1.4 * Math.sin(wingU * Math.PI) * (1.0 - wingU * 0.4);

        const px = side * span;
        const py = (rand() - 0.5) * 0.15;
        const pz = (rand() - 0.5) * chord;

        this.phoenixPositions[i3] = px;
        this.phoenixPositions[i3 + 1] = py;
        this.phoenixPositions[i3 + 2] = pz;
        this.phoenixWingSpan[i] = span / 5.0;

        const isTip = wingU > 0.65;
        const colP = isTip ? colFire : colGold;
        this.phoenixColors[i3] = colP.r;
        this.phoenixColors[i3 + 1] = colP.g;
        this.phoenixColors[i3 + 2] = colP.b;
      } else if (i < 65000) {
        // Torso, Head & Fiery Crest
        const tB = (i - 55000) / 10000;
        const pz = -tB * 2.2; // head reaches forward
        const py = Math.sin(tB * Math.PI) * 0.35 + (tB > 0.7 ? (tB - 0.7) * 1.2 : 0); // crest
        const px = (rand() - 0.5) * 0.25 * (1.0 - tB * 0.5);

        this.phoenixPositions[i3] = px;
        this.phoenixPositions[i3 + 1] = py;
        this.phoenixPositions[i3 + 2] = pz;
        this.phoenixWingSpan[i] = 0;

        this.phoenixColors[i3] = colGold.r;
        this.phoenixColors[i3 + 1] = colGold.g;
        this.phoenixColors[i3 + 2] = colGold.b;
      } else {
        // Long Feather Tail Streamers (10,000 pts)
        const tT = (i - 65000) / 10000;
        const pz = 1.0 + tT * 6.5; // trailing behind
        const spread = tT * 1.5;
        const px = (rand() - 0.5) * spread;
        const py = -tT * 0.6;

        this.phoenixPositions[i3] = px;
        this.phoenixPositions[i3 + 1] = py;
        this.phoenixPositions[i3 + 2] = pz;
        this.phoenixWingSpan[i] = tT;

        this.phoenixColors[i3] = colFire.r;
        this.phoenixColors[i3 + 1] = colFire.g;
        this.phoenixColors[i3 + 2] = colFire.b;
      }

      // Velocity vectors for warp speed forward thrust
      this.velocities[i3] = (rand() - 0.5) * 0.5;
      this.velocities[i3 + 1] = (rand() - 0.5) * 0.5;
      this.velocities[i3 + 2] = -6.0 - rand() * 12.0; // intense forward warp
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
   * Updates drone positions, colors, and kinematics across the 3 formations
   */
  update(t: number): void {
    const pos = this.positions;
    const colors = this.colors;
    const n = this.count;

    // Movement 3 runs 52.0s - 78.0s (localT = 0.0s - 26.0s)
    const localT = Math.max(0, t - 52.0);

    // Morphs:
    // Earth: 0.0s - 9.0s (t: 52 - 61)
    // Morph to Heart: 9.0s - 13.0s (t: 61 - 65)
    // Heart: 13.0s - 18.0s (t: 65 - 70)
    // Morph to Phoenix: 18.0s - 21.0s (t: 70 - 73)
    // Phoenix: 21.0s - 26.0s (t: 73 - 78)

    const uMorph1 = prog(localT, 9.0, 13.0, ease.inOutCubic); // Earth -> Heart
    const uMorph2 = prog(localT, 18.0, 21.0, ease.inOutCubic); // Heart -> Phoenix

    // Kinematic rotations and pulses
    const earthRotY = localT * 0.65;

    // Heartbeat pulse (systole contraction)
    const heartHz = 2.2; // 132 BPM
    const heartPhase = (localT * heartHz) % 1.0;
    const heartContraction = Math.exp(-Math.pow((heartPhase - 0.15) * 8.0, 2.0));
    const heartScale = 1.0 - 0.22 * heartContraction;

    // Phoenix Wing Flapping (1.8 Hz)
    const flapCycle = localT * 11.3; // 1.8 Hz * 2pi

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;

      // 1. Formation 1 (Earth) Position
      const ex0 = this.earthPositions[i3]!;
      const ey0 = this.earthPositions[i3 + 1]!;
      const ez0 = this.earthPositions[i3 + 2]!;
      const ex = ex0 * Math.cos(earthRotY) - ez0 * Math.sin(earthRotY);
      const ey = ey0;
      const ez = ex0 * Math.sin(earthRotY) + ez0 * Math.cos(earthRotY);

      // 2. Formation 2 (Heart) Position
      const hx = this.heartPositions[i3]! * heartScale;
      const hy = this.heartPositions[i3 + 1]! * heartScale;
      const hz = this.heartPositions[i3 + 2]! * heartScale;

      // 3. Formation 3 (Phoenix) Position
      const spanFrac = this.phoenixWingSpan[i]!;
      const wingFlap = Math.sin(flapCycle) * (1.2 * spanFrac * spanFrac);
      const px = this.phoenixPositions[i3]!;
      const py = this.phoenixPositions[i3 + 1]! + wingFlap;
      const pz = this.phoenixPositions[i3 + 2]!;

      // Interpolate position across formations
      let curX = 0, curY = 0, curZ = 0;
      let colR = 0, colG = 0, colB = 0;

      if (uMorph1 < 1.0) {
        // Interpolating Earth -> Heart
        curX = lerp(ex, hx, uMorph1);
        curY = lerp(ey, hy, uMorph1);
        curZ = lerp(ez, hz, uMorph1);

        colR = lerp(this.earthColors[i3]!, this.heartColors[i3]!, uMorph1);
        colG = lerp(this.earthColors[i3 + 1]!, this.heartColors[i3 + 1]!, uMorph1);
        colB = lerp(this.earthColors[i3 + 2]!, this.heartColors[i3 + 2]!, uMorph1);
      } else {
        // Interpolating Heart -> Phoenix
        curX = lerp(hx, px, uMorph2);
        curY = lerp(hy, py, uMorph2);
        curZ = lerp(hz, pz, uMorph2);

        colR = lerp(this.heartColors[i3]!, this.phoenixColors[i3]!, uMorph2);
        colG = lerp(this.heartColors[i3 + 1]!, this.phoenixColors[i3 + 1]!, uMorph2);
        colB = lerp(this.heartColors[i3 + 2]!, this.phoenixColors[i3 + 2]!, uMorph2);
      }

      pos[i3] = curX;
      pos[i3 + 1] = curY;
      pos[i3 + 2] = curZ;

      colors[i3] = colR;
      colors[i3 + 1] = colG;
      colors[i3 + 2] = colB;
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aColor!.needsUpdate = true;
  }
}

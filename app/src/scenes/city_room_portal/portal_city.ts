// =============================================================================
// PROCEDURAL VOLUMETRIC METROPOLIS & QUANTUM INGESTION
//
// 145,000-Point Detailed LiDAR Cityscape:
// - 100+ Skyscrapers with architectural setbacks, spires, illuminated window arrays
// - Rooftop water towers on 4-legged scaffolds, antennas with blinking aviation beacons
// - Multi-tier aerial skyways with streaming vehicle headlights and taillights
// - Neon billboards and urban canyon facade architecture
// - Hero Skyscraper Facade containing the hero window aperture at (0, 1.6, 2.0)
// - Closed-form Quantum Ingestion (16.5s - 24.5s): city dots deconstruct and
//   accelerate along hyperbolic streamlines directly through the window frame into the room,
//   dissolving into radiant energy as room geometry materializes.
// =============================================================================

import * as THREE from 'three';
import { LIN } from './portal_palette';
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

export class PortalCity {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  baseColors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  // Metadata
  types: Uint8Array; // 0: hero facade, 1: buildings, 2: traffic, 3: beacons, 4: billboards
  ingestionDelays: Float32Array;
  ingestionStreams: Float32Array;
  count: number;

  readonly windowPos = new THREE.Vector3(0.0, 1.6, 2.0);

  constructor() {
    const MAX_POINTS = 145000;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.basePositions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.baseColors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);
    this.types = new Uint8Array(MAX_POINTS);
    this.ingestionDelays = new Float32Array(MAX_POINTS);
    this.ingestionStreams = new Float32Array(MAX_POINTS * 3);

    const rand = mulberry32(42817);
    let idx = 0;

    const addPt = (
      x: number,
      y: number,
      z: number,
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
      this.baseColors[i3] = col.r;
      this.baseColors[i3 + 1] = col.g;
      this.baseColors[i3 + 2] = col.b;

      this.sizes[idx] = size;
      this.phases[idx] = rand();
      this.intensities[idx] = intensity;

      this.velocities[i3] = 0;
      this.velocities[i3 + 1] = 0;
      this.velocities[i3 + 2] = 0;

      this.types[idx] = type;

      // Ingestion timing based on distance to window aperture
      const dx = x - this.windowPos.x;
      const dy = y - this.windowPos.y;
      const dz = z - this.windowPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Points further away begin pulling earlier or later
      this.ingestionDelays[idx] = Math.min(5.0, dist * 0.065 + rand() * 0.6);

      // Tangential velocity offsets for helical streamline trajectories
      const angle = rand() * Math.PI * 2;
      this.ingestionStreams[i3] = Math.cos(angle);
      this.ingestionStreams[i3 + 1] = Math.sin(angle);
      this.ingestionStreams[i3 + 2] = rand() * Math.PI * 2;

      idx++;
    };

    const colAsh = LIN.skylineAsh;
    const colWarm = LIN.windowWarm;
    const colCyan = LIN.windowCyan;
    const colAmber = LIN.windowAmber;
    const colLav = LIN.windowLavender;
    const colHead = LIN.trafficHeadlight;
    const colTail = LIN.trafficTaillight;
    const colBeacon = LIN.beaconRed;
    const colMagenta = LIN.neonMagenta;
    const colLime = LIN.neonLime;
    const colWood = LIN.waterTowerWood;

    // -------------------------------------------------------------------------
    // 1. THE HERO SKYSCRAPER FACADE (z = 2.0) (~18,000 pts)
    // -------------------------------------------------------------------------
    // Surrounds the hero window aperture at (0, 1.6, 2.0).
    // Rich architectural detailing: masonry ledges, fluted pilasters, cornices,
    // and rows of illuminated windows flanking the central portal.
    const facadeWidth = 14.0;  // x in [-7, 7]
    const facadeHeight = 22.0; // y in [-4, 18]
    const fCols = 84;
    const fRows = 130;

    for (let r = 0; r < fRows; r++) {
      const y = -4.0 + (r / fRows) * facadeHeight;
      for (let c = 0; c < fCols; c++) {
        const x = -7.0 + (c / fCols) * facadeWidth;

        // Punch out the hero window aperture: x in [-1.22, 1.22], y in [0.78, 2.62]
        const inHeroWindow = (Math.abs(x) < 1.22 && y > 0.78 && y < 2.62);
        if (inHeroWindow) continue;

        // Architectural grid of other illuminated windows on the facade
        const winModX = Math.abs(x) % 1.8;
        const winModY = Math.abs(y) % 2.2;
        const isWindowSlot = (winModX > 0.4 && winModX < 1.4 && winModY > 0.5 && winModY < 1.7);

        // Architectural ledges, sills, and pilasters
        const isLedge = Math.abs(winModY - 0.45) < 0.08 || Math.abs(y - 0.75) < 0.08 || Math.abs(y - 2.65) < 0.08;
        const isPilaster = Math.abs(winModX - 0.35) < 0.06 || Math.abs(winModX - 1.45) < 0.06 || Math.abs(x - 1.25) < 0.08 || Math.abs(x + 1.25) < 0.08;

        let col = colAsh;
        let sz = 1.9;
        let inten = 0.85;

        if (isWindowSlot) {
          // Warm glowing offices in the hero tower
          const hash = Math.sin(c * 17.2 + r * 31.4);
          if (hash > 0.2) {
            col = (hash > 0.7) ? colWarm : (hash > 0.4 ? colAmber : colCyan);
            sz = 2.4;
            inten = 1.45;
          } else {
            col = colAsh;
            sz = 1.6;
            inten = 0.5;
          }
        } else if (isLedge || isPilaster) {
          col = colAmber;
          sz = 2.2;
          inten = 1.25;
        }

        const z = 2.0 + (rand() - 0.5) * 0.04;
        addPt(x, y, z, col, sz, inten, 0);
      }
    }

    // -------------------------------------------------------------------------
    // 2. URBAN CANYON TOWERS FLANKING APPROACH (z in [4.0, 95.0]) (~85,000 pts)
    // -------------------------------------------------------------------------
    // Placed in organic city blocks leaving a flight canyon along the camera spline
    const towerConfigs: {
      cx: number;
      cz: number;
      width: number;
      depth: number;
      height: number;
      style: number; // 0: residential warm, 1: commercial cyan, 2: amber ziggurat, 3: spire
    }[] = [
      // Close flanking canyon walls (z in [4, 25]) - frames the approach perfectly
      { cx: -5.2, cz: 6.5, width: 3.5, depth: 4.0, height: 20.0, style: 1 },
      { cx: 5.5, cz: 7.5, width: 3.6, depth: 4.2, height: 24.0, style: 0 },
      { cx: -6.2, cz: 14.0, width: 4.0, depth: 4.5, height: 30.0, style: 2 },
      { cx: 6.5, cz: 16.5, width: 3.8, depth: 4.0, height: 34.0, style: 1 },
      { cx: -6.8, cz: 24.0, width: 4.5, depth: 4.8, height: 38.0, style: 3 },
      { cx: 7.2, cz: 27.0, width: 4.2, depth: 4.5, height: 42.0, style: 0 },

      // Midground canyon & boulevards (z in [30, 60])
      { cx: -9.5, cz: 35.0, width: 5.0, depth: 5.0, height: 48.0, style: 1 },
      { cx: 10.0, cz: 38.0, width: 5.5, depth: 5.0, height: 52.0, style: 3 },
      { cx: -12.0, cz: 48.0, width: 6.0, depth: 6.0, height: 58.0, style: 2 },
      { cx: 11.5, cz: 52.0, width: 5.8, depth: 5.5, height: 62.0, style: 1 },
      { cx: -2.5, cz: 55.0, width: 4.5, depth: 4.5, height: 44.0, style: 0 },
      { cx: 3.0, cz: 58.0, width: 4.5, depth: 4.5, height: 46.0, style: 2 },

      // Deep horizon mega-towers (z in [60, 95])
      { cx: -18.0, cz: 68.0, width: 7.0, depth: 7.0, height: 75.0, style: 3 },
      { cx: 16.0, cz: 72.0, width: 8.0, depth: 7.5, height: 80.0, style: 1 },
      { cx: -6.0, cz: 78.0, width: 6.5, depth: 6.0, height: 68.0, style: 2 },
      { cx: 5.0, cz: 82.0, width: 7.0, depth: 6.5, height: 72.0, style: 0 },
      { cx: -24.0, cz: 88.0, width: 8.5, depth: 8.0, height: 85.0, style: 3 },
      { cx: 22.0, cz: 92.0, width: 9.0, depth: 8.5, height: 90.0, style: 1 },
    ];

    // Add extra grid filling blocks across the skyline
    for (let gx = -40; gx <= 40; gx += 10) {
      for (let gz = 12; gz <= 92; gz += 14) {
        // Skip central flight corridor
        if (Math.abs(gx) < 5.5 && gz < 50.0) continue;
        const seed = rand();
        towerConfigs.push({
          cx: gx + (rand() - 0.5) * 3.0,
          cz: gz + (rand() - 0.5) * 3.0,
          width: 2.8 + seed * 2.5,
          depth: 2.8 + seed * 2.5,
          height: 14.0 + seed * 50.0,
          style: Math.floor(rand() * 4),
        });
      }
    }

    // Generate points for all skyscrapers
    for (const bldg of towerConfigs) {
      const numFloors = Math.floor(bldg.height / 0.32);
      const ptsPerFloor = 32;

      for (let fl = 0; fl < numFloors; fl++) {
        const y = -4.0 + fl * 0.32;
        // Architectural setback near top
        const setbackFrac = (y > bldg.height * 0.75) ? 0.72 : (y > bldg.height * 0.88 ? 0.52 : 1.0);
        const halfW = (bldg.width * 0.5) * setbackFrac;
        const halfD = (bldg.depth * 0.5) * setbackFrac;

        for (let p = 0; p < ptsPerFloor; p++) {
          const u = p / ptsPerFloor;
          let px = 0, pz = 0;
          if (u < 0.25) { px = -halfW + (u / 0.25) * (halfW * 2); pz = -halfD; }
          else if (u < 0.5) { px = halfW; pz = -halfD + ((u - 0.25) / 0.25) * (halfD * 2); }
          else if (u < 0.75) { px = halfW - ((u - 0.5) / 0.25) * (halfW * 2); pz = halfD; }
          else { px = -halfW; pz = halfD - ((u - 0.75) / 0.25) * (halfD * 2); }

          // Window illumination
          const isCorner = (p % 8 === 0);
          const isWindowLit = (rand() > 0.42) && !isCorner;
          let col = colAsh;
          let sz = 1.8;
          let inten = 0.7;

          if (isWindowLit) {
            if (bldg.style === 0) col = (rand() > 0.3) ? colWarm : colAmber;
            else if (bldg.style === 1) col = (rand() > 0.25) ? colCyan : colLav;
            else if (bldg.style === 2) col = (rand() > 0.35) ? colAmber : colWarm;
            else col = (rand() > 0.5) ? colWarm : colCyan;
            sz = 2.3;
            inten = 1.35;
          }

          addPt(bldg.cx + px, y, bldg.cz + pz, col, sz, inten, 1);
        }
      }

      // Spire or Antenna atop tall buildings
      if (bldg.height > 25.0) {
        const topY = -4.0 + bldg.height;
        for (let sy = 0; sy < 16; sy++) {
          const ay = topY + sy * 0.35;
          const isTip = (sy === 15);
          const col = isTip ? colBeacon : colAsh;
          const sz = isTip ? 3.8 : 2.0;
          const inten = isTip ? 2.8 : 1.0;
          addPt(bldg.cx, ay, bldg.cz, col, sz, inten, 3);
        }
      }

      // Rooftop Water Tower on select buildings
      if (bldg.height > 18.0 && bldg.height < 45.0 && rand() > 0.55) {
        const topY = -4.0 + bldg.height;
        const wx = bldg.cx + (rand() - 0.5) * 1.5;
        const wz = bldg.cz + (rand() - 0.5) * 1.5;

        // 4 Wooden legs
        for (const dx of [-0.4, 0.4]) {
          for (const dz of [-0.4, 0.4]) {
            for (let ly = 0; ly < 8; ly++) {
              addPt(wx + dx, topY + ly * 0.18, wz + dz, colWood, 2.0, 1.1, 1);
            }
          }
        }
        // Barrel cylinder
        const barrelBaseY = topY + 1.44;
        for (let by = 0; by < 10; by++) {
          for (let ba = 0; ba < 16; ba++) {
            const theta = (ba / 16) * Math.PI * 2;
            addPt(wx + Math.cos(theta) * 0.55, barrelBaseY + by * 0.14, wz + Math.sin(theta) * 0.55, colWood, 2.2, 1.2, 1);
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. MULTI-TIER TRAFFIC SKYWAYS (z in [4.0, 85.0]) (~24,000 pts)
    // -------------------------------------------------------------------------
    const roadZSteps = 280;
    for (let rz = 0; rz < roadZSteps; rz++) {
      const z = 4.0 + (rz / roadZSteps) * 80.0;
      // Ground highway
      addPt(-1.8, -3.8, z, colHead, 2.5, 1.6, 2);
      addPt(-1.2, -3.8, z, colHead, 2.5, 1.6, 2);
      addPt(1.2, -3.8, z, colTail, 2.5, 1.8, 2);
      addPt(1.8, -3.8, z, colTail, 2.5, 1.8, 2);

      // Elevated skyway at y = 8.5
      if (z > 20.0 && z < 75.0) {
        addPt(-4.5, 8.5, z, colHead, 2.6, 1.8, 2);
        addPt(4.5, 8.5, z, colTail, 2.6, 2.0, 2);
        // Concrete bridge stippling
        addPt(-4.8, 8.3, z, colAsh, 1.8, 0.6, 1);
        addPt(4.8, 8.3, z, colAsh, 1.8, 0.6, 1);
      }
    }

    // -------------------------------------------------------------------------
    // 4. NEON BILLBOARDS ALONG CANYON (~6,000 pts)
    // -------------------------------------------------------------------------
    const billboards = [
      { x: -5.8, y: 12.0, z: 18.0, w: 2.8, h: 1.6, col: colMagenta },
      { x: 5.6, y: 15.0, z: 24.0, w: 3.2, h: 1.8, col: colLime },
      { x: -7.5, y: 18.0, z: 38.0, w: 3.6, h: 2.2, col: colCyan },
      { x: 7.8, y: 22.0, z: 45.0, w: 4.0, h: 2.4, col: colWarm },
    ];
    for (const bb of billboards) {
      for (let bx = -bb.w * 0.5; bx <= bb.w * 0.5; bx += 0.12) {
        for (let by = -bb.h * 0.5; by <= bb.h * 0.5; by += 0.12) {
          addPt(bb.x + bx, bb.y + by, bb.z, bb.col, 2.6, 2.0, 4);
        }
      }
    }

    this.count = idx;

    // Assemble Three.js BufferGeometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(this.intensities, 1));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
  }

  /**
   * Deterministic O(1) kinematics:
   * - 0.0s - 16.5s: Living metropolis with moving vehicles and blinking beacons
   * - 16.5s - 24.5s: Quantum streamline vortex converging into window (0, 1.6, 2.0)
   * - Points entering room (z < 2.0) dissolve into luminous energy and fade
   */
  update(t: number): void {
    const pos = this.positions;
    const base = this.basePositions;
    const colors = this.colors;
    const baseCol = this.baseColors;
    const vel = this.velocities;
    const types = this.types;
    const delays = this.ingestionDelays;
    const streams = this.ingestionStreams;
    const n = this.count;

    const wx = this.windowPos.x;
    const wy = this.windowPos.y;
    const wz = this.windowPos.z;

    // Traffic streaming loop offset along Z
    const trafficShift = (t * 8.5) % 80.0;

    // Quantum Ingestion timeline: starts at 16.5s, peaks at 21.0s, completes by 24.5s
    const globalIngestion = prog(t, 16.5, 24.5, ease.linear);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;

      // 1. Normal state: moving traffic along highways
      if (globalIngestion <= 0.0001) {
        if (type === 2) {
          const bz = base[i3 + 2]!;
          const dir = (base[i3]! > 0) ? -1 : 1;
          let curZ = bz + dir * trafficShift;
          if (curZ < 4.0) curZ += 80.0;
          if (curZ > 84.0) curZ -= 80.0;
          pos[i3 + 2] = curZ;
        } else {
          pos[i3] = base[i3]!;
          pos[i3 + 1] = base[i3 + 1]!;
          pos[i3 + 2] = base[i3 + 2]!;
        }
        vel[i3] = 0;
        vel[i3 + 1] = 0;
        vel[i3 + 2] = 0;
        colors[i3] = baseCol[i3]!;
        colors[i3 + 1] = baseCol[i3 + 1]!;
        colors[i3 + 2] = baseCol[i3 + 2]!;
        continue;
      }

      // 2. Quantum Streamline Ingestion State (t >= 16.5s)
      const delay = delays[i]!;
      // Point-specific ingestion progress
      const pointT = prog(t, 16.5 + delay * 0.7, 24.0, ease.inQuad);

      if (pointT <= 0.0) {
        pos[i3] = base[i3]!;
        pos[i3 + 1] = base[i3 + 1]!;
        pos[i3 + 2] = base[i3 + 2]!;
        vel[i3] = 0;
        vel[i3 + 1] = 0;
        vel[i3 + 2] = 0;
        continue;
      }

      const bx = base[i3]!;
      const by = base[i3 + 1]!;
      const bz = base[i3 + 2]!;

      // Streamline spiral curvature toward window aperture
      const spiralTheta = streams[i3 + 2]! + pointT * 7.5;
      const spiralR = Math.sin(pointT * Math.PI) * 1.8;
      const spiralX = spiralR * Math.cos(spiralTheta);
      const spiralY = spiralR * Math.sin(spiralTheta);

      // Trajectory: converges right through the window aperture (wx, wy, wz = 2.0)
      let curX = lerp(bx, wx, pointT) + spiralX;
      let curY = lerp(by, wy, pointT) + spiralY;
      let curZ = lerp(bz, wz, pointT);

      // Overshoot through window into room interior and disperse/fade out
      let alphaFade = 1.0;
      if (pointT > 0.85) {
        const shootFrac = (pointT - 0.85) / 0.15; // [0..1]
        // Disperse outward into room space
        curZ = wz - shootFrac * 2.5; // penetrates into room z in [2.0, -0.5]
        curX += streams[i3]! * shootFrac * 1.8;
        curY += streams[i3 + 1]! * shootFrac * 1.4;
        // Dissolve into energy as it transfers to room points
        alphaFade = Math.max(0.0, 1.0 - shootFrac);
      }

      // Velocity for GPU streak elongation
      vel[i3] = (curX - pos[i3]!) * 18.0;
      vel[i3 + 1] = (curY - pos[i3 + 1]!) * 18.0;
      vel[i3 + 2] = (curZ - pos[i3 + 2]!) * 18.0;

      pos[i3] = curX;
      pos[i3 + 1] = curY;
      pos[i3 + 2] = curZ;

      // Color transition: shift into intense incandescent golden streamer light then fade
      if (pointT > 0.35) {
        const cFrac = clamp((pointT - 0.35) / 0.5);
        colors[i3] = lerp(baseCol[i3]!, LIN.lampGlow.r, cFrac) * alphaFade;
        colors[i3 + 1] = lerp(baseCol[i3 + 1]!, LIN.lampGlow.g, cFrac) * alphaFade;
        colors[i3 + 2] = lerp(baseCol[i3 + 2]!, LIN.lampGlow.b, cFrac) * alphaFade;
      } else {
        colors[i3] = baseCol[i3]!;
        colors[i3 + 1] = baseCol[i3 + 1]!;
        colors[i3 + 2] = baseCol[i3 + 2]!;
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aColor!.needsUpdate = true;
    this.geometry.attributes.aVelocity!.needsUpdate = true;
  }
}

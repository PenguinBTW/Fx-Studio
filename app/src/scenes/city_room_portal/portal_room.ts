// =============================================================================
// PROCEDURAL ARCHITECTURAL ROOM INTERIOR & MATERIALIZATION
//
// 120,000-Point Detailed Interior Sanctuary:
// - Hero Window at z = 2.0: brass mullions, glowing glass illuminated from within,
//   which undergoes centrifugal vaporization and disappears at 21.5s - 24.2s
// - Hardwood parquet herringbone floorboards with warm oak stippling
// - Architect's Drafting Table: angled oak surface, drafting arm, blueprints with
//   cyan laser schematics, graphite pencils, brass compass
// - Illuminated Banker's Lamp: emerald glass hood, warm incandescent filament, golden light cone
// - Steaming Ceramic Coffee Mug with rising 3D helical vapor motes
// - Floor-to-Ceiling Bookshelves with hundreds of books (burgundy, navy, forest, ochre)
// - Mid-Century Leather Lounge Chair with tufted cushions and bentwood shell
// - Potted Monstera Deliciosa plant with fenestrated leaves and vein networks
// - Vinyl Record Player with spinning disc and glowing vacuum tubes
// - Closed-form Materialization (18.0s - 25.5s): points assemble from window streamers
//   and snap into solid resting geometry
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

export class PortalRoom {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  restPositions: Float32Array;
  colors: Float32Array;
  restColors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  types: Uint8Array; // 0: window, 1: floor/walls, 2: desk, 3: lamp, 4: steam, 5: books, 6: chair, 7: plant, 8: vinyl, 9: dust
  assemblyDelays: Float32Array;
  count: number;

  readonly windowPos = new THREE.Vector3(0.0, 1.6, 2.0);

  constructor() {
    const MAX_POINTS = 120000;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.restPositions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.restColors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);
    this.types = new Uint8Array(MAX_POINTS);
    this.assemblyDelays = new Float32Array(MAX_POINTS);

    const rand = mulberry32(98231);
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
      this.restPositions[i3] = x;
      this.restPositions[i3 + 1] = y;
      this.restPositions[i3 + 2] = z;

      this.colors[i3] = col.r;
      this.colors[i3 + 1] = col.g;
      this.colors[i3 + 2] = col.b;
      this.restColors[i3] = col.r;
      this.restColors[i3 + 1] = col.g;
      this.restColors[i3 + 2] = col.b;

      this.sizes[idx] = size;
      this.phases[idx] = rand();
      this.intensities[idx] = intensity;

      // Centrifugal explosion velocities for window dissolution
      const angle = rand() * Math.PI * 2;
      const speed = 1.5 + rand() * 3.5;
      this.velocities[i3] = Math.cos(angle) * speed;
      this.velocities[i3 + 1] = Math.sin(angle) * speed;
      this.velocities[i3 + 2] = (rand() - 0.5) * 2.0;

      this.types[idx] = type;

      // Distance from window determines assembly timing
      const dx = x - this.windowPos.x;
      const dy = y - this.windowPos.y;
      const dz = z - this.windowPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.assemblyDelays[idx] = Math.min(3.5, dist * 0.75 + rand() * 0.5);

      idx++;
    };

    const colFrame = LIN.windowFrameDark;
    const colBrass = LIN.windowFrameBrass;
    const colGlass = LIN.glassReflection;
    const colWarmGlow = LIN.windowWarm;
    const colFloor = LIN.floorParquet;
    const colDesk = LIN.deskOak;
    const colMetal = LIN.deskMetalArm;
    const colBpPaper = LIN.blueprintPaper;
    const colBpLaser = LIN.blueprintLaser;
    const colLampEmerald = LIN.lampEmerald;
    const colLampGlow = LIN.lampGlow;
    const colLampFilament = LIN.lampFilament;
    const colMug = LIN.mugCeramic;
    const colSteam = LIN.coffeeSteam;
    const colSpineBurg = LIN.bookSpineBurgundy;
    const colSpineNavy = LIN.bookSpineNavy;
    const colSpineForest = LIN.bookSpineForest;
    const colSpineOchre = LIN.bookSpineOchre;
    const colPages = LIN.bookPagesBone;
    const colLeather = LIN.chairLeatherCognac;
    const colBentwood = LIN.chairBentwood;
    const colLeaf = LIN.monsteraLeaf;
    const colStem = LIN.monsteraStem;
    const colVinyl = LIN.vinylBlack;
    const colVinylGold = LIN.vinylLabelGold;
    const colTubeOrange = LIN.vacuumTubeOrange;
    const colDust = LIN.ambientDustMote;
    const colWood = LIN.deskOak;

    // -------------------------------------------------------------------------
    // 1. THE HERO WINDOW AT z = 2.0 (~16,000 pts)
    // -------------------------------------------------------------------------
    // Window aperture: x in [-1.2, 1.2], y in [0.8, 2.6]
    // Outer Frame & Deep Wooden Sill
    for (let i = 0; i < 4500; i++) {
      const u = i / 4499;
      let x = 0, y = 0;
      if (u < 0.25) { x = -1.2 + (u / 0.25) * 2.4; y = 0.8; }
      else if (u < 0.5) { x = 1.2; y = 0.8 + ((u - 0.25) / 0.25) * 1.8; }
      else if (u < 0.75) { x = 1.2 - ((u - 0.5) / 0.25) * 2.4; y = 2.6; }
      else { x = -1.2; y = 2.6 - ((u - 0.75) / 0.25) * 1.8; }

      // Depth layers of the wooden window sill and casing
      for (let d = 0; d < 3; d++) {
        const z = 1.95 + d * 0.04;
        const col = (y <= 0.83) ? colDesk : colBrass;
        addPt(x + (rand() - 0.5) * 0.02, y + (rand() - 0.5) * 0.02, z, col, 2.4, 1.4, 0);
      }
    }

    // Brass Cross Mullions
    // Vertical center stile at x = 0.0
    for (let y = 0.8; y <= 2.6; y += 0.012) {
      for (let d = 0; d < 2; d++) {
        addPt((rand() - 0.5) * 0.03, y, 2.0 + d * 0.03, colBrass, 2.2, 1.5, 0);
      }
    }
    // Horizontal crossbars at y = 1.4 and y = 2.0
    for (const my of [1.4, 2.0]) {
      for (let x = -1.2; x <= 1.2; x += 0.012) {
        addPt(x, my + (rand() - 0.5) * 0.025, 2.0, colBrass, 2.2, 1.5, 0);
      }
    }

    // Glass Panes with glowing interior amber light and cyan reflection sheen
    for (let i = 0; i < 7500; i++) {
      const gx = -1.16 + rand() * 2.32;
      const gy = 0.84 + rand() * 1.72;
      // Skip mullion centers
      if (Math.abs(gx) < 0.03 || Math.abs(gy - 1.4) < 0.03 || Math.abs(gy - 2.0) < 0.03) continue;

      // Glow warmer near the center bottom where the lamp inside shines out
      const distToLamp = Math.sqrt(gx * gx + (gy - 1.35) * (gy - 1.35));
      const isWarmCenter = distToLamp < 0.85;

      const col = isWarmCenter ? colWarmGlow : colGlass;
      const sz = isWarmCenter ? 2.2 : 1.8;
      const inten = isWarmCenter ? 1.6 : 1.1;

      addPt(gx, gy, 2.0, col, sz, inten, 0);
    }

    // -------------------------------------------------------------------------
    // 2. HARDWOOD PARQUET HERRINGBONE FLOOR (~22,000 pts)
    // -------------------------------------------------------------------------
    // Floor spans x in [-3.0, 3.0], z in [-3.5, 2.0], y = 0.0
    const floorStepsX = 95;
    const floorStepsZ = 85;
    for (let ix = 0; ix < floorStepsX; ix++) {
      const x = -3.0 + (ix / floorStepsX) * 6.0;
      for (let iz = 0; iz < floorStepsZ; iz++) {
        const z = -3.5 + (iz / floorStepsZ) * 5.5;

        // Herringbone pattern modulation
        const pattern = Math.sin((x + z) * 12.0) * Math.cos((x - z) * 12.0);
        const isPlankJoint = Math.abs(pattern) < 0.15;
        const col = isPlankJoint ? colBentwood : colFloor;
        const sz = isPlankJoint ? 2.1 : 1.8;
        const inten = isPlankJoint ? 1.0 : 0.85;

        addPt(x + (rand() - 0.5) * 0.02, 0.0, z + (rand() - 0.5) * 0.02, col, sz, inten, 1);
      }
    }

    // -------------------------------------------------------------------------
    // 3. ARCHITECT'S DRAFTING TABLE & BLUEPRINTS (~26,000 pts)
    // -------------------------------------------------------------------------
    // Positioned at (0.0, 0.0, 0.3)
    // 4 Oak Tapered Legs
    const legCoords = [
      { x: -0.75, z: 0.6 }, { x: 0.75, z: 0.6 },
      { x: -0.75, z: -0.1 }, { x: 0.75, z: -0.1 }
    ];
    for (const leg of legCoords) {
      for (let y = 0.0; y <= 0.85; y += 0.02) {
        for (let a = 0; a < 8; a++) {
          const theta = (a / 8) * Math.PI * 2;
          const r = 0.035 * (1.0 - y * 0.2);
          addPt(leg.x + r * Math.cos(theta), y, leg.z + r * Math.sin(theta), colDesk, 2.0, 1.2, 2);
        }
      }
    }

    // Angled Board: tilted 12 degrees toward viewer
    // Board spans x in [-0.85, 0.85], local z in [0.0, 0.85]
    const boardStepsX = 85;
    const boardStepsZ = 55;
    for (let bx = 0; bx < boardStepsX; bx++) {
      const x = -0.85 + (bx / boardStepsX) * 1.70;
      for (let bz = 0; bz < boardStepsZ; bz++) {
        const uZ = bz / boardStepsZ;
        const localZ = -0.1 + uZ * 0.8;
        const boardY = 0.88 + uZ * 0.16; // 12 deg tilt

        // Board Bevel Border
        const isBorder = (bx < 4 || bx > boardStepsX - 5 || bz < 4 || bz > boardStepsZ - 5);
        if (isBorder) {
          addPt(x, boardY, localZ, colDesk, 2.2, 1.35, 2);
          continue;
        }

        // Blueprint Sheet spans x in [-0.55, 0.55], uZ in [0.15, 0.85]
        const inBlueprint = (x > -0.55 && x < 0.55 && uZ > 0.15 && uZ < 0.85);
        if (inBlueprint) {
          const bpU = (x + 0.55) / 1.10;
          const bpV = (uZ - 0.15) / 0.70;

          // Technical Schematics
          const isGrid = (bpU * 30) % 1.0 < 0.08 || (bpV * 20) % 1.0 < 0.08;
          const circleR = Math.sqrt((bpU - 0.5) * (bpU - 0.5) + (bpV - 0.5) * (bpV - 0.5));
          const isCircle = Math.abs(circleR - 0.28) < 0.015 || Math.abs(circleR - 0.18) < 0.015;
          const isElevation = Math.abs(bpV - (0.35 + Math.sin(bpU * 12.0) * 0.10)) < 0.018 && bpU > 0.15 && bpU < 0.85;

          if (isCircle || isElevation) {
            addPt(x, boardY + 0.005, localZ, colBpLaser, 2.5, 2.2, 2);
          } else if (isGrid) {
            addPt(x, boardY + 0.003, localZ, colBpLaser, 1.9, 1.3, 2);
          } else {
            addPt(x, boardY + 0.002, localZ, colBpPaper, 1.8, 0.75, 2);
          }
        } else {
          addPt(x, boardY, localZ, colDesk, 1.9, 1.1, 2);
        }
      }
    }

    // Brass Drafting Arm (articulated pantograph mechanism)
    for (let s = 0; s < 45; s++) {
      const u = s / 44;
      const ax = -0.55 + u * 0.45;
      const az = 0.50 - u * 0.35;
      const ay = 0.96 + u * 0.08;
      addPt(ax, ay, az, colMetal, 2.2, 1.8, 2);
    }
    for (let s = 0; s < 45; s++) {
      const u = s / 44;
      const ax = -0.10 + u * 0.35;
      const az = 0.15 + u * 0.25;
      const ay = 1.04 - u * 0.06;
      addPt(ax, ay, az, colMetal, 2.2, 1.8, 2);
    }

    // Brass Compass at (0.28, 0.98, 0.35)
    for (let a = 0; a < 25; a++) {
      const u = a / 24;
      addPt(0.28 - u * 0.12, 0.96 + u * 0.04, 0.35 + u * 0.08, colBrass, 2.0, 1.8, 2);
      addPt(0.28 + u * 0.12, 0.96 + u * 0.04, 0.35 + u * 0.08, colBrass, 2.0, 1.8, 2);
    }

    // -------------------------------------------------------------------------
    // 4. ILLUMINATED BANKER'S LAMP (~8,000 pts)
    // -------------------------------------------------------------------------
    // Base at (-0.45, 0.96, 0.55)
    const lampBase = { x: -0.45, y: 0.96, z: 0.55 };
    for (let r = 0.02; r <= 0.09; r += 0.015) {
      for (let a = 0; a < 20; a++) {
        const theta = (a / 20) * Math.PI * 2;
        addPt(lampBase.x + r * Math.cos(theta), lampBase.y, lampBase.z + r * Math.sin(theta), colBrass, 2.2, 1.4, 3);
      }
    }
    // Curved Brass Neck
    for (let ny = 0; ny < 35; ny++) {
      const u = ny / 34;
      const curY = lampBase.y + u * 0.38;
      const curX = lampBase.x + Math.sin(u * Math.PI * 0.8) * 0.08;
      addPt(curX, curY, lampBase.z, colBrass, 2.2, 1.6, 3);
    }
    // Emerald Glass Hood
    const hoodCenter = { x: lampBase.x + 0.08, y: lampBase.y + 0.38, z: lampBase.z };
    for (let hx = -0.16; hx <= 0.16; hx += 0.015) {
      for (let ha = 0; ha < 22; ha++) {
        const theta = (ha / 21) * Math.PI;
        const hy = hoodCenter.y + Math.sin(theta) * 0.065;
        const hz = hoodCenter.z + Math.cos(theta) * 0.075;
        addPt(hoodCenter.x + hx, hy, hz, colLampEmerald, 2.4, 1.8, 3);
      }
    }
    // Incandescent Filament (Intense golden core)
    for (let fx = -0.09; fx <= 0.09; fx += 0.01) {
      addPt(hoodCenter.x + fx, hoodCenter.y - 0.02, hoodCenter.z, colLampFilament, 3.4, 3.2, 3);
    }
    // Radiant Light Cone Dust/Glow
    for (let lc = 0; lc < 1200; lc++) {
      const uY = rand();
      const coneR = uY * 0.45;
      const coneAngle = rand() * Math.PI * 2;
      const cy = hoodCenter.y - uY * 0.38;
      const cx = hoodCenter.x + Math.cos(coneAngle) * coneR;
      const cz = hoodCenter.z + Math.sin(coneAngle) * coneR;
      addPt(cx, cy, cz, colLampGlow, 1.8, 1.4, 3);
    }

    // -------------------------------------------------------------------------
    // 5. STEAMING CERAMIC COFFEE MUG (~4,000 pts)
    // -------------------------------------------------------------------------
    // Mug at (0.42, 0.94, 0.48)
    const mugCenter = { x: 0.42, y: 0.94, z: 0.48 };
    // Mug Cylinder
    for (let my = 0; my <= 0.12; my += 0.01) {
      for (let ma = 0; ma < 24; ma++) {
        const theta = (ma / 24) * Math.PI * 2;
        addPt(mugCenter.x + Math.cos(theta) * 0.048, mugCenter.y + my, mugCenter.z + Math.sin(theta) * 0.048, colMug, 2.2, 1.4, 4);
      }
    }
    // Handle
    for (let ha = 0; ha < 16; ha++) {
      const theta = (ha / 15) * Math.PI;
      const hy = mugCenter.y + 0.03 + Math.sin(theta) * 0.045;
      const hx = mugCenter.x + 0.048 + Math.sin(theta) * 0.035;
      addPt(hx, hy, mugCenter.z, colMug, 2.0, 1.4, 4);
    }
    // Helical Steam Motes
    for (let s = 0; s < 450; s++) {
      addPt(mugCenter.x, mugCenter.y + 0.13, mugCenter.z, colSteam, 2.6, 2.0, 4);
    }

    // -------------------------------------------------------------------------
    // 6. 5-TIER BOOKSHELF & COLORFUL TOMES (~20,000 pts)
    // -------------------------------------------------------------------------
    // Bookshelf against Left Wall: x = -2.2, z in [-2.5, 0.5], y in [0.0, 2.6]
    for (let shelf = 0; shelf < 5; shelf++) {
      const sy = 0.2 + shelf * 0.55;
      // Shelf Plank
      for (let sz = -2.5; sz <= 0.5; sz += 0.035) {
        for (let sx = -2.35; sx <= -2.05; sx += 0.04) {
          addPt(sx, sy, sz, colDesk, 2.0, 1.1, 5);
        }
      }

      // Books on this shelf
      let curZ = -2.45;
      while (curZ < 0.45) {
        const bookThick = 0.03 + rand() * 0.05;
        const bookH = 0.32 + rand() * 0.14;
        const bookCol = (rand() > 0.75) ? colSpineBurg : (rand() > 0.5 ? colSpineNavy : (rand() > 0.25 ? colSpineForest : colSpineOchre));

        // Spine
        for (let by = 0; by <= bookH; by += 0.02) {
          for (let bz = 0; bz <= bookThick; bz += 0.015) {
            addPt(-2.05, sy + by, curZ + bz, bookCol, 2.2, 1.3, 5);
          }
        }
        // Pages
        for (let bx = -2.30; bx <= -2.08; bx += 0.03) {
          addPt(bx, sy + bookH, curZ + bookThick * 0.5, colPages, 1.7, 0.8, 5);
        }
        curZ += bookThick + 0.01;
      }
    }

    // -------------------------------------------------------------------------
    // 7. MID-CENTURY COGNAC LEATHER LOUNGE CHAIR (~12,000 pts)
    // -------------------------------------------------------------------------
    // Positioned at (1.5, 0.0, -0.2), angled 30 degrees toward desk
    const chairPos = { x: 1.5, y: 0.0, z: -0.2 };
    const chairAngle = -Math.PI / 6;
    const cCos = Math.cos(chairAngle);
    const cSin = Math.sin(chairAngle);

    // Tufted Seat Cushion
    for (let sx = -0.32; sx <= 0.32; sx += 0.025) {
      for (let sz = -0.32; sz <= 0.32; sz += 0.025) {
        const wx = chairPos.x + sx * cCos - sz * cSin;
        const wz = chairPos.z + sx * cSin + sz * cCos;
        const wy = 0.38 - (sx * sx + sz * sz) * 0.15;
        const isTuft = Math.abs(sx % 0.14) < 0.02 && Math.abs(sz % 0.14) < 0.02;
        const col = isTuft ? colBentwood : colLeather;
        const inten = isTuft ? 0.8 : 1.35;
        addPt(wx, wy, wz, col, 2.2, inten, 6);
      }
    }
    // Angled Backrest Cushion (tilted back 15 deg)
    for (let bx = -0.30; bx <= 0.30; bx += 0.025) {
      for (let by = 0; by <= 0.52; by += 0.025) {
        const bLocalZ = -0.28 - by * 0.28;
        const bLocalY = 0.42 + by * 0.95;
        const wx = chairPos.x + bx * cCos - bLocalZ * cSin;
        const wz = chairPos.z + bx * cSin + bLocalZ * cCos;
        addPt(wx, bLocalY, wz, colLeather, 2.2, 1.35, 6);
      }
    }

    // -------------------------------------------------------------------------
    // 8. POTTED MONSTERA DELICIOSA PLANT (~6,000 pts)
    // -------------------------------------------------------------------------
    // Terracotta pot at (1.9, 0.0, 0.9)
    const potPos = { x: 1.9, y: 0.0, z: 0.9 };
    for (let ph = 0; ph <= 0.45; ph += 0.02) {
      const pr = 0.18 + ph * 0.08;
      for (let pa = 0; pa < 24; pa++) {
        const theta = (pa / 24) * Math.PI * 2;
        addPt(potPos.x + pr * Math.cos(theta), ph, potPos.z + pr * Math.sin(theta), colWood, 2.0, 1.1, 7);
      }
    }
    // Arching Stems & Broad Fenestrated Leaves
    for (let leaf = 0; leaf < 6; leaf++) {
      const stemAngle = (leaf / 6) * Math.PI * 2 + 0.3;
      const stemH = 0.65 + (leaf % 2) * 0.25;
      const reachR = 0.45 + (leaf % 3) * 0.15;

      for (let s = 0; s < 25; s++) {
        const u = s / 24;
        const sx = potPos.x + Math.cos(stemAngle) * reachR * u;
        const sz = potPos.z + Math.sin(stemAngle) * reachR * u;
        const sy = 0.4 + Math.sin(u * Math.PI * 0.75) * stemH;
        addPt(sx, sy, sz, colStem, 2.0, 1.1, 7);
      }

      // Broad Leaf with holes/fenestrations
      const leafTipX = potPos.x + Math.cos(stemAngle) * (reachR + 0.35);
      const leafTipZ = potPos.z + Math.sin(stemAngle) * (reachR + 0.35);
      const leafY = 0.4 + stemH;

      for (let lu = -0.22; lu <= 0.22; lu += 0.02) {
        for (let lv = -0.22; lv <= 0.22; lv += 0.02) {
          const r = Math.sqrt(lu * lu + lv * lv);
          if (r > 0.22) continue;
          const angle = Math.atan2(lv, lu);
          const isSlot = Math.abs(Math.sin(angle * 4.0)) < 0.25 && r > 0.08 && r < 0.18;
          if (isSlot) continue;
          addPt(leafTipX + lu, leafY + lv * 0.4, leafTipZ + lv, colLeaf, 2.2, 1.5, 7);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 9. VINYL RECORD PLAYER & VACUUM TUBES (~4,000 pts)
    // -------------------------------------------------------------------------
    const vinylCenter = { x: 0.0, y: 0.76, z: -2.5 };
    for (let r = 0.04; r <= 0.22; r += 0.012) {
      for (let a = 0; a < 32; a++) {
        const theta = (a / 32) * Math.PI * 2;
        const isGoldLabel = r < 0.08;
        const col = isGoldLabel ? colVinylGold : colVinyl;
        const sz = isGoldLabel ? 2.2 : 1.7;
        const inten = isGoldLabel ? 1.6 : 0.8;
        addPt(vinylCenter.x + r * Math.cos(theta), vinylCenter.y, vinylCenter.z + r * Math.sin(theta), col, sz, inten, 8);
      }
    }
    for (let tube = 0; tube < 4; tube++) {
      const tx = 0.42 + tube * 0.08;
      const tz = -2.5;
      for (let ty = 0; ty <= 0.08; ty += 0.01) {
        addPt(tx, vinylCenter.y + ty, tz, colTubeOrange, 3.2, 2.2, 8);
      }
    }

    // -------------------------------------------------------------------------
    // 10. AMBIENT DRIFTING DUST MOTES (~2,000 pts)
    // -------------------------------------------------------------------------
    for (let d = 0; d < 2000; d++) {
      const dx = (rand() - 0.5) * 4.5;
      const dy = 0.2 + rand() * 2.5;
      const dz = -3.0 + rand() * 4.5;
      addPt(dx, dy, dz, colDust, 1.8, 1.2, 9);
    }

    this.count = idx;

    // Assemble BufferGeometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(this.phases, 1));
    this.geometry.setAttribute('aIntensity', new THREE.BufferAttribute(this.intensities, 1));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
  }

  /**
   * Deterministic O(1) Kinematics:
   * - Window: Visible from t = 0.0s, undergoes centrifugal vaporization at 21.5s - 24.2s, completely gone by 24.5s
   * - Room Furniture: Materializes from window streamlines between 18.0s - 25.5s
   * - Steam & Dust: Drift smoothly in closed-form cycles
   */
  update(t: number): void {
    const pos = this.positions;
    const rest = this.restPositions;
    const colors = this.colors;
    const restCol = this.restColors;
    const vel = this.velocities;
    const types = this.types;
    const delays = this.assemblyDelays;
    const n = this.count;

    const wx = this.windowPos.x;
    const wy = this.windowPos.y;
    const wz = this.windowPos.z;

    // Window Dissolution: Starts at 21.5s, complete by 24.2s
    const windowDissolve = prog(t, 21.5, 24.2, ease.inQuad);

    // Global room assembly progress
    const globalAssembly = prog(t, 18.0, 25.5, ease.linear);

    // Warm Banker's lamp illumination factor (spikes on at 22.0s)
    const lampIllumination = prog(t, 21.0, 25.0, ease.outCubic);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;

      // -----------------------------------------------------------------------
      // 0. THE HERO WINDOW: DISSOLVES AND DISAPPEARS (21.5s - 24.2s)
      // -----------------------------------------------------------------------
      if (type === 0) {
        if (windowDissolve <= 0.0001) {
          // Distance-based damping from afar to prevent additive accumulation blowout
          const farDamp = (t < 12.0) ? (prog(t, 3.0, 12.0, ease.inOutCubic) * 0.88 + 0.12) : 1.0;
          pos[i3] = rest[i3]!;
          pos[i3 + 1] = rest[i3 + 1]!;
          pos[i3 + 2] = rest[i3 + 2]!;
          colors[i3] = restCol[i3]! * farDamp;
          colors[i3 + 1] = restCol[i3 + 1]! * farDamp;
          colors[i3 + 2] = restCol[i3 + 2]! * farDamp;
        } else if (windowDissolve >= 1.0) {
          // Completely disappeared
          colors[i3] = 0;
          colors[i3 + 1] = 0;
          colors[i3 + 2] = 0;
        } else {
          // Centrifugal vaporization along expanding spiral rings
          const dt = windowDissolve;
          const vx = vel[i3]!;
          const vy = vel[i3 + 1]!;
          const vz = vel[i3 + 2]!;

          pos[i3] = rest[i3]! + vx * dt * 3.5;
          pos[i3 + 1] = rest[i3 + 1]! + vy * dt * 3.5;
          pos[i3 + 2] = rest[i3 + 2]! + vz * dt * 1.8;

          // Dissolve to black
          const alphaFade = clamp(1.0 - windowDissolve * 1.15);
          colors[i3] = restCol[i3]! * alphaFade;
          colors[i3 + 1] = restCol[i3 + 1]! * alphaFade;
          colors[i3 + 2] = restCol[i3 + 2]! * alphaFade;
        }
        continue;
      }

      // -----------------------------------------------------------------------
      // 1. STEAM MOTES RISING FROM COFFEE MUG
      // -----------------------------------------------------------------------
      if (type === 4) {
        if (globalAssembly <= 0.2) {
          colors[i3] = 0;
          colors[i3 + 1] = 0;
          colors[i3 + 2] = 0;
          continue;
        }
        const phase = this.phases[i]!;
        const steamLife = (t * 1.5 + phase * 4.0) % 3.0;
        const steamFrac = steamLife / 3.0;
        const curY = rest[i3 + 1]! + steamFrac * 0.45;
        const curX = rest[i3]! + Math.sin(steamLife * 4.0 + phase * 6.28) * 0.04 * steamFrac;
        const curZ = rest[i3 + 2]! + Math.cos(steamLife * 3.5 + phase * 6.28) * 0.04 * steamFrac;

        pos[i3] = curX;
        pos[i3 + 1] = curY;
        pos[i3 + 2] = curZ;

        const steamAlpha = Math.sin(steamFrac * Math.PI) * lampIllumination;
        colors[i3] = restCol[i3]! * steamAlpha;
        colors[i3 + 1] = restCol[i3 + 1]! * steamAlpha;
        colors[i3 + 2] = restCol[i3 + 2]! * steamAlpha;
        continue;
      }

      // -----------------------------------------------------------------------
      // 2. DUST MOTES FLOATING IN LIGHT CONE
      // -----------------------------------------------------------------------
      if (type === 9) {
        if (globalAssembly <= 0.2) {
          colors[i3] = 0;
          colors[i3 + 1] = 0;
          colors[i3 + 2] = 0;
          continue;
        }
        const phase = this.phases[i]!;
        pos[i3] = rest[i3]! + Math.sin(t * 0.8 + phase * 6.28) * 0.08;
        pos[i3 + 1] = rest[i3 + 1]! + Math.cos(t * 0.6 + phase * 6.28) * 0.06;
        pos[i3 + 2] = rest[i3 + 2]! + Math.sin(t * 0.7 + phase * 3.14) * 0.08;

        colors[i3] = restCol[i3]! * lampIllumination;
        colors[i3 + 1] = restCol[i3 + 1]! * lampIllumination;
        colors[i3 + 2] = restCol[i3 + 2]! * lampIllumination;
        continue;
      }

      // -----------------------------------------------------------------------
      // 3. ROOM FURNITURE & ARCHITECTURE MATERIALIZATION
      // -----------------------------------------------------------------------
      if (globalAssembly <= 0.0001) {
        pos[i3] = wx;
        pos[i3 + 1] = wy;
        pos[i3 + 2] = wz;
        colors[i3] = 0;
        colors[i3 + 1] = 0;
        colors[i3 + 2] = 0;
        continue;
      }

      const delay = delays[i]!;
      const ptProgress = prog(t, 18.0 + delay * 0.7, 25.0, ease.outCubic);

      if (ptProgress <= 0.0) {
        pos[i3] = wx;
        pos[i3 + 1] = wy;
        pos[i3 + 2] = wz;
        colors[i3] = 0;
        colors[i3 + 1] = 0;
        colors[i3 + 2] = 0;
        continue;
      }

      const rx = rest[i3]!;
      const ry = rest[i3 + 1]!;
      const rz = rest[i3 + 2]!;

      // Damped settling spiral
      const settleWiggle = (1.0 - ptProgress) * 0.35;
      const wTheta = ptProgress * 8.5 + delays[i]! * 5.5;

      pos[i3] = lerp(wx, rx, ptProgress) + Math.cos(wTheta) * settleWiggle;
      pos[i3 + 1] = lerp(wy, ry, ptProgress) + Math.sin(wTheta) * settleWiggle;
      pos[i3 + 2] = lerp(wz, rz, ptProgress);

      // Color illumination: fades from golden streamer into final room object color
      const colFrac = clamp(ptProgress * lampIllumination);
      colors[i3] = lerp(LIN.lampGlow.r, restCol[i3]!, colFrac);
      colors[i3 + 1] = lerp(LIN.lampGlow.g, restCol[i3 + 1]!, colFrac);
      colors[i3 + 2] = lerp(LIN.lampGlow.b, restCol[i3 + 2]!, colFrac);
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.aColor!.needsUpdate = true;
  }
}

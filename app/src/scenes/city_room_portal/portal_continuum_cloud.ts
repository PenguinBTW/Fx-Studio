// =============================================================================
// PROCEDURAL CONTINUUM POINT CLOUD: 3,000,000 ARCHITECTURAL DOTS
//
// Dual-Realm Point Cloud Continuum (128 Coherent Architectural Chunks):
// - Realm 1 (Densely Fleshed-Out Metropolis City):
//   - Continuous urban ground grid (X: -26 to +26m, Z: -15 to +115m) with asphalt
//     avenues, 6 cross-streets, painted crosswalks, concrete curbs, and sidewalks.
//   - 8 Multi-lane streaming traffic arteries (xenon headlights & ruby taillights).
//   - 48 Ornate sidewalk lampposts with glowing warm fixtures and ground pools.
//   - 12 Towering Flanking Canyon Skyscrapers directly lining the avenue from z = 2m to 105m!
//     (Tower facades placed at x = +/- 11.5m, towering up to 96m, filling FOV!)
//   - 16 Deep Horizon Mega-Skyscrapers creating a dense, layered panoramic skyline.
//   - 4 Glass-enclosed suspension skyways spanning across the avenue.
//   - The Majestic 3D Art Deco Hero Skyscraper (32m x 20m x 80m):
//     - Solid 3D volume: front facade, side walls, rusticated limestone base.
//     - 3-Story grand entrance portico with carved arches & illuminated marquee.
//     - Stepped setbacks at y=32m, 48m, 62m and Art Deco crown with illuminated spire.
//     - 3rd-Floor Hero Window Bay: deep stone embrasure, fluted pilasters, carved corbels,
//       projecting sill, carved lintel arch, Juliet balcony railing.
// - The Dedicated Hero Window (Stage 9.0, 100,000 pts):
//   - 0.40m deep carved stone embrasure reveal, burnished dark bronze casing,
//     projecting sill with corbels, 16-pane polished brass sash, and crystal-clear
//     glass revealing the warm incandescent glow inside the room!
//   - Dissolves into flowing golden ribbons between t = 20.2s and 21.8s!
// - Realm 2 (Detailed Architect's Sanctuary):
//   - Herringbone oak parquet floorboards with dark bevel seams & wood grain variations.
//   - Intricate Persian area rug with floral medallion, guard borders, and woven ivory fringe.
//   - Solid walnut wainscoted walls with raised beveled panels, plaster above, 3 framed drawings.
//   - Coffered oak timber ceiling beams.
//   - Grand 6-tier library bookcase with fluted pilasters, dentil moulding, and 1,500+ bound
//     leather books with gold ribs & leaning stacks.
//   - Chesterfield deep diamond-tufted cognac leather armchair with curved 3D volume & brass nailheads.
//   - Heavy architect's drafting desk with turned legs, brass foot rail, apron drawers.
//   - Razor-sharp cyan laser blueprint: classical museum rotunda, columns, dimension ticks,
//     16-point ornamental compass rose, and drafting title block.
//   - Precision solid brass beam compass with knurled thumbwheel, spindle, needle, and graphite lead.
//   - Clear 30-60-90 acrylic triangle with etched millimeter ticks & triangular finger grip.
//   - Classic emerald banker's lamp with glowing tungsten filament bulb & brass pull chain.
//   - Stoneware ceramic coffee mug with espresso surface & delicate rising wispy steam plumes.
//   - Vintage circular brass desk clock with Roman numerals & blued-steel hands.
//   - Carved wooden pen tray with vintage fountain pens & ink bottle.
//   - Terracotta potted Monstera Deliciosa with split fenestrated leaves.
// =============================================================================

import * as THREE from 'three';
import { LIN } from './portal_palette';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pt {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  stage?: number;
  size?: number;
}

export class PortalContinuumCloud {
  geometry: THREE.BufferGeometry;
  count: number;

  constructor() {
    const TOTAL_POINTS = 3000000;
    const WINDOW_POINTS = 100000;
    const CHUNK_POINTS_TOTAL = TOTAL_POINTS - WINDOW_POINTS; // 2,900,000 points
    const NUM_CHUNKS = 128;
    const TARGET_CHUNK_COUNT = Math.floor(CHUNK_POINTS_TOTAL / NUM_CHUNKS); // 22,656 points
    const NUM_CONDUITS = 96;

    this.count = TOTAL_POINTS;

    // Buffer allocations (~324 MB VRAM)
    const cityPositions = new Float32Array(TOTAL_POINTS * 3);
    const roomPositions = new Float32Array(TOTAL_POINTS * 3);
    const cityColors = new Float32Array(TOTAL_POINTS * 3);
    const roomColors = new Float32Array(TOTAL_POINTS * 3);
    const params = new Float32Array(TOTAL_POINTS * 4); // x: chunkStart, y: stage, z: conduitAngle, w: baseSize
    const chunkData = new Float32Array(TOTAL_POINTS * 4); // xyz: cityCentroid, w: distFromCenter/stage
    const roomCentroids = new Float32Array(TOTAL_POINTS * 3); // xyz: roomCentroid
    const streamAxes = new Float32Array(TOTAL_POINTS * 3);
    const phases = new Float32Array(TOTAL_POINTS);

    const rand = mulberry32(104829);

    // Color tokens
    const colAsh = LIN.skylineAsh;
    const colConcrete = LIN.concreteDark;
    const colWarm = LIN.windowWarm;
    const colCyan = LIN.windowCyan;
    const colAmber = LIN.windowAmber;
    const colHead = LIN.trafficHeadlight;
    const colTail = LIN.trafficTaillight;
    const colAsphalt = LIN.streetAsphalt;
    const colCurb = LIN.streetCurb;
    const colLimestone = LIN.limestoneWarm;
    const colLimestoneShad = LIN.limestoneShadow;
    const colBronze = LIN.bronzeDark;
    const colBrass = LIN.windowFrameBrass;
    const colBrassPolished = LIN.brassPolished;
    const colGlass = LIN.glassReflection;
    const colBeacon = LIN.beaconRed;
    const colStreetLight = LIN.streetLightGlow;

    // Room Colors
    const colFloor = LIN.floorParquet;
    const colFloorDark = LIN.floorParquetDark;
    const colRugNavy = LIN.rugNavy;
    const colRugCrimson = LIN.rugCrimson;
    const colRugCream = LIN.rugCream;
    const colRugGold = LIN.rugGold;
    const colDesk = LIN.deskOak;
    const colDeskDark = LIN.deskOakDark;
    const colBpPaper = LIN.blueprintPaperDeep;
    const colBpGrid = LIN.blueprintGrid;
    const colBpLaser = LIN.blueprintLaser;
    const colBpLaserBright = LIN.blueprintLaserBright;
    const colLampEmerald = LIN.lampEmerald;
    const colLampFilament = LIN.lampFilament;
    const colMug = LIN.mugCeramic;
    const colSteam = LIN.coffeeSteam;
    const colSpineBurg = LIN.bookSpineBurgundy;
    const colSpineNavy = LIN.bookSpineNavy;
    const colSpineForest = LIN.bookSpineForest;
    const colSpineOchre = LIN.bookSpineOchre;
    const colSpineCognac = LIN.bookSpineCognac;
    const colPages = LIN.bookPagesBone;
    const colLeather = LIN.chairLeatherCognac;
    const colLeatherCrease = LIN.leatherShadow;
    const colLeaf = LIN.monsteraLeaf;
    const colStem = LIN.monsteraStem;
    const colClockFace = LIN.clockFace;
    const colClockHands = LIN.clockHands;
    const colWainscot = LIN.wallWainscot;
    const colPlaster = LIN.wallPlaster;
    const colMahogany = LIN.woodMahogany;

    // Initialize 128 chunk buckets
    const chunkCity: Pt[][] = Array.from({ length: NUM_CHUNKS }, () => []);
    const chunkRoom: Pt[][] = Array.from({ length: NUM_CHUNKS }, () => []);

    // =========================================================================
    // PART 1: THE INCREDIBLY DETAILED ARCHITECT'S SANCTUARY ROOM
    // =========================================================================

    // --- A. Chunks 0..23 (24 Chunks): Herringbone Oak Parquet Floor ---
    // Floor spans x in [-3.6, 3.6], z in [-4.2, 2.0], y = 0.0m
    for (let cx = 0; cx < 4; cx++) {
      const minX = -3.6 + (cx / 4) * 7.2;
      const maxX = -3.6 + ((cx + 1) / 4) * 7.2;
      for (let cz = 0; cz < 6; cz++) {
        const minZ = -4.2 + (cz / 6) * 6.2;
        const maxZ = -4.2 + ((cz + 1) / 6) * 6.2;
        const ch = cz * 4 + cx; // Chunks 0..23

        for (let x = minX; x < maxX; x += 0.009) {
          for (let z = minZ; z < maxZ; z += 0.009) {
            // Persian rug boundary check
            if (x >= -1.70 && x <= 1.70 && z >= -1.10 && z <= 1.30) continue;

            const uH = (x + z) * 7.5;
            const vH = (x - z) * 7.5;
            const plankIdx = Math.floor(uH) + Math.floor(vH) * 9;
            const isSeam = (Math.abs(uH % 1.0 - 0.5) > 0.44) || (Math.abs(vH % 1.0 - 0.5) > 0.44);

            let col = colFloor;
            if (isSeam) col = colFloorDark;
            else {
              const tone = Math.sin(plankIdx * 17.3);
              if (tone > 0.35) col = colDesk;
              else if (tone < -0.35) col = colMahogany;
            }
            chunkRoom[ch].push({ x, y: 0.0, z, r: col.r, g: col.g, b: col.b, stage: 0.0, size: 2.2 });
          }
        }
      }
    }

    // --- B. Chunks 24..39 (16 Chunks): Intricate Persian Area Rug ---
    // Spanning x in [-1.75, 1.75], z in [-1.15, 1.35], y = 0.006m
    for (let rx = 0; rx < 4; rx++) {
      const minX = -1.75 + (rx / 4) * 3.50;
      const maxX = -1.75 + ((rx + 1) / 4) * 3.50;
      for (let rz = 0; rz < 4; rz++) {
        const minZ = -1.15 + (rz / 4) * 2.50;
        const maxZ = -1.15 + ((rz + 1) / 4) * 2.50;
        const ch = 24 + rz * 4 + rx; // Chunks 24..39

        for (let x = minX; x < maxX; x += 0.0055) {
          for (let z = minZ; z < maxZ; z += 0.0055) {
            const dx = Math.abs(x);
            const dz = Math.abs(z - 0.10);
            const rMed = Math.sqrt(dx * dx * 1.3 + dz * dz * 1.8);

            // Knotted ivory fringe at East & West ends
            const isFringe = (Math.abs(x) > 1.68);

            // Guard Borders & Arabesque Meanders
            const isOuterBorder = (dx > 1.50 || dz > 1.05);
            const isGoldMeander = isOuterBorder && (dx > 1.58 || dz > 1.12);
            const isInnerBorder = (dx > 1.35 || dz > 0.90) && !isOuterBorder;

            // Center Medallion
            const isMedallion = (rMed < 0.65);
            const isInnerFlower = (rMed < 0.28);
            const isPetal = (isMedallion && Math.abs(Math.sin(Math.atan2(dz, dx) * 10.0)) > 0.38);

            // Corner Spandrels
            const distCorner = Math.sqrt((dx - 1.48) * (dx - 1.48) + (dz - 1.02) * (dz - 1.02));
            const isCornerMed = (distCorner < 0.42);

            let col = colRugNavy;
            if (isFringe) col = colRugCream;
            else if (isGoldMeander) col = colRugGold;
            else if (isOuterBorder) col = colRugCrimson;
            else if (isInnerBorder) col = colRugGold;
            else if (isInnerFlower) col = colRugGold;
            else if (isPetal) col = colRugCrimson;
            else if (isMedallion) col = colRugCream;
            else if (isCornerMed) col = colRugCrimson;

            chunkRoom[ch].push({ x, y: 0.006, z, r: col.r, g: col.g, b: col.b, stage: 0.0, size: 2.0 });
          }
        }
      }
    }

    // --- C. Chunks 40..63 (24 Chunks): Wainscoted Walls, Plaster, Framed Art & Coffered Ceiling ---
    // 1. Rear Wall at z = -4.2m (Chunks 40..47 = 8 chunks)
    for (let wx = 0; wx < 4; wx++) {
      const minX = -3.6 + (wx / 4) * 7.2;
      const maxX = -3.6 + ((wx + 1) / 4) * 7.2;
      for (let wy = 0; wy < 2; wy++) {
        const minY = wy * 1.6;
        const maxY = (wy + 1) * 1.6;
        const ch = 40 + wy * 4 + wx; // Chunks 40..47

        for (let x = minX; x < maxX; x += 0.009) {
          for (let y = minY; y < maxY; y += 0.009) {
            const isWainscot = (y <= 1.35);
            const isChairRail = (Math.abs(y - 1.35) < 0.04);
            const isPanelBorder = isWainscot && ((Math.abs(x % 0.85 - 0.42) > 0.36) || (Math.abs(y % 0.65 - 0.32) > 0.28));
            const isBaseboard = (y < 0.16);

            // 3 Framed Architectural Elevation Drawings
            const isFrame1 = (Math.abs(x + 1.8) < 0.55 && Math.abs(y - 2.15) < 0.42);
            const isFrame2 = (Math.abs(x) < 0.55 && Math.abs(y - 2.15) < 0.42);
            const isFrame3 = (Math.abs(x - 1.8) < 0.55 && Math.abs(y - 2.15) < 0.42);
            const isAnyFrame = isFrame1 || isFrame2 || isFrame3;

            let col = isWainscot ? colWainscot : colPlaster;
            let zPos = -4.2;

            if (isBaseboard || isChairRail) {
              col = colDeskDark;
              zPos = -4.18;
            } else if (isPanelBorder) {
              col = colMahogany;
              zPos = -4.19;
            } else if (isAnyFrame) {
              const localX = isFrame1 ? (x + 1.8) : (isFrame2 ? x : (x - 1.8));
              const localY = y - 2.15;
              const isBorder = (Math.abs(localX) > 0.50 || Math.abs(localY) > 0.38);
              const isMatte = (Math.abs(localX) > 0.44 || Math.abs(localY) > 0.32);
              const isDrawing = (Math.abs(Math.sin(localX * 35.0)) > 0.70 && Math.abs(Math.cos(localY * 25.0)) > 0.60);

              if (isBorder) col = colBrassPolished;
              else if (isMatte) col = colPages;
              else if (isDrawing) col = colBpPaper;
              else col = colPages;
              zPos = -4.16;
            }

            chunkRoom[ch].push({ x, y, z: zPos, r: col.r, g: col.g, b: col.b, stage: 1.0, size: 2.0 });
          }
        }
      }
    }

    // 2. Coffered Timber Ceiling at y = 3.2m (Chunks 48..63 = 16 chunks)
    for (let cx = 0; cx < 4; cx++) {
      const minX = -3.6 + (cx / 4) * 7.2;
      const maxX = -3.6 + ((cx + 1) / 4) * 7.2;
      for (let cz = 0; cz < 4; cz++) {
        const minZ = -4.2 + (cz / 4) * 6.2;
        const maxZ = -4.2 + ((cz + 1) / 4) * 6.2;
        const ch = 48 + cz * 4 + cx; // Chunks 48..63

        for (let x = minX; x < maxX; x += 0.011) {
          for (let z = minZ; z < maxZ; z += 0.011) {
            const isMainBeamX = (Math.abs(x % 1.2 - 0.6) < 0.09);
            const isMainBeamZ = (Math.abs((z + 4.2) % 1.2 - 0.6) < 0.09);
            const isBeam = isMainBeamX || isMainBeamZ;

            let col = isBeam ? colDeskDark : colPlaster;
            let yPos = isBeam ? 3.12 : 3.20;
            chunkRoom[ch].push({ x, y: yPos, z, r: col.r, g: col.g, b: col.b, stage: 1.0, size: 2.2 });
          }
        }
      }
    }

    // --- D. Chunks 64..87 (24 Chunks): Grand 6-Tier Library Bookcase & 1,500 Books ---
    // Located along left wall: x in [-3.60, -3.10], z in [-3.8, 0.4], y in [0.0, 3.15]
    for (let sec = 0; sec < 24; sec++) {
      const ch = 64 + sec; // Chunks 64..87
      const minZ = -3.8 + (sec / 24) * 4.2;
      const maxZ = -3.8 + ((sec + 1) / 24) * 4.2;

      // 6 Sturdy Timber Shelves
      for (let tier = 0; tier <= 6; tier++) {
        const sy = tier * 0.50 + 0.10;
        for (let z = minZ; z < maxZ; z += 0.009) {
          for (let x = -3.60; x <= -3.10; x += 0.009) {
            chunkRoom[ch].push({ x, y: sy, z, r: colMahogany.r, g: colMahogany.g, b: colMahogany.b, stage: 2.0, size: 2.2 });
          }
        }
      }

      // Books lining each shelf tier
      for (let tier = 0; tier < 6; tier++) {
        const sy = tier * 0.50 + 0.10;
        for (let bz = minZ + 0.015; bz < maxZ - 0.015; bz += 0.018) {
          const bHeight = 0.32 + Math.sin(bz * 48.0) * 0.08;
          const bDepth = 0.32 + Math.cos(bz * 32.0) * 0.06;
          const spineHash = Math.abs(Math.sin(bz * 123.4 + tier * 56.7));

          let colSpine = colSpineBurg;
          if (spineHash > 0.80) colSpine = colSpineNavy;
          else if (spineHash > 0.60) colSpine = colSpineForest;
          else if (spineHash > 0.40) colSpine = colSpineOchre;
          else if (spineHash > 0.20) colSpine = colSpineCognac;

          // Vertical book spine & page block
          for (let by = sy + 0.01; by <= sy + bHeight; by += 0.012) {
            // Spine facing into room (x = -3.12)
            const isGoldRib = (Math.abs((by - sy) % 0.06) < 0.008);
            const spineCol = isGoldRib ? colBrassPolished : colSpine;
            chunkRoom[ch].push({ x: -3.12, y: by, z: bz, r: spineCol.r, g: spineCol.g, b: spineCol.b, stage: 2.0, size: 2.0 });

            // Book cover sides and pages
            for (let bx = -3.12 - bDepth; bx < -3.12; bx += 0.025) {
              const isPageTop = (by > sy + bHeight - 0.02);
              const pCol = isPageTop ? colPages : colSpine;
              chunkRoom[ch].push({ x: bx, y: by, z: bz, r: pCol.r, g: pCol.g, b: pCol.b, stage: 2.0, size: 1.8 });
            }
          }
        }
      }
    }

    // --- E. Chunks 88..103 (16 Chunks): Walnut Drafting Desk & 3D Chesterfield Leather Armchair ---
    for (let sec = 0; sec < 16; sec++) {
      const ch = 88 + sec; // Chunks 88..103

      // 1. Solid Walnut Drafting Tabletop: x in [-1.20, 1.20], z in [-0.55, 0.25], y = 0.96m
      const minX = -1.20 + (sec / 16) * 2.40;
      const maxX = -1.20 + ((sec + 1) / 16) * 2.40;

      for (let x = minX; x < maxX; x += 0.0075) {
        for (let z = -0.55; z <= 0.25; z += 0.0075) {
          const isEdge = (Math.abs(x) > 1.16 || z < -0.52 || z > 0.22);
          const col = isEdge ? colDeskDark : colDesk;
          chunkRoom[ch].push({ x, y: 0.96, z, r: col.r, g: col.g, b: col.b, stage: 3.0, size: 2.0 });

          // Apron with twin brass cup handles
          if (z > 0.21) {
            for (let ay = 0.84; ay < 0.96; ay += 0.009) {
              const isCupHandle = (Math.abs(x + 0.6) < 0.04 || Math.abs(x) < 0.04 || Math.abs(x - 0.6) < 0.04) && Math.abs(ay - 0.90) < 0.02;
              const aCol = isCupHandle ? colBrassPolished : colDeskDark;
              chunkRoom[ch].push({ x, y: ay, z: 0.23, r: aCol.r, g: aCol.g, b: aCol.b, stage: 3.0, size: 2.0 });
            }
          }
        }
      }

      // 2. Four Turned Walnut Legs with Spiral Fluting & Brass Casters
      if (sec === 0 || sec === 3 || sec === 12 || sec === 15) {
        const legX = (sec < 8) ? -1.10 : 1.10;
        const legZ = (sec % 4 === 0) ? -0.48 : 0.18;

        for (let ly = 0.0; ly < 0.84; ly += 0.009) {
          const isCaster = (ly < 0.08);
          const rLeg = isCaster ? 0.025 : (0.045 + Math.sin(ly * 16.0) * 0.015);
          const legCol = isCaster ? colBrassPolished : colDeskDark;

          for (let la = 0; la < Math.PI * 2; la += 0.25) {
            const lx = legX + Math.cos(la) * rLeg;
            const lz = legZ + Math.sin(la) * rLeg;
            chunkRoom[ch].push({ x: lx, y: ly, z: lz, r: legCol.r, g: legCol.g, b: legCol.b, stage: 3.0, size: 2.2 });
          }
        }
      }

      // 3. Volumetric 3D Chesterfield Leather Armchair (placed closer at z = -1.05m):
      const thetaMin = -Math.PI * 0.45 + (sec / 16) * Math.PI * 0.90;
      const thetaMax = -Math.PI * 0.45 + ((sec + 1) / 16) * Math.PI * 0.90;

      for (let th = thetaMin; th < thetaMax; th += 0.028) {
        const chairR = 0.55;

        for (let cy = 0.48; cy <= 1.25; cy += 0.010) {
          // 3D diamond button tufting: Real crater indentations!
          const uT = (th + Math.PI * 0.5) * 5.0;
          const vT = (cy - 0.48) * 5.0;
          const du = uT % 1.0 - 0.5;
          const dv = vT % 1.0 - 0.5;
          const distBtn = Math.sqrt(du * du + dv * dv);

          let rIndent = 0.0;
          let col = colLeather;

          if (distBtn < 0.22) {
            rIndent = (1.0 - distBtn / 0.22) * 0.055; // Conical crater!
            col = (distBtn < 0.08) ? colBrassPolished : colLeatherCrease; // Center button!
          } else {
            const creaseDist = Math.abs(Math.abs(du) - Math.abs(dv));
            if (creaseDist < 0.08) {
              rIndent = (1.0 - creaseDist / 0.08) * 0.020;
              col = colLeatherCrease;
            }
          }

          // Top roll crest rail
          if (cy > 1.18) {
            rIndent -= 0.035 * Math.sin((cy - 1.18) / 0.07 * Math.PI);
          }

          const finalX = Math.sin(th) * (chairR - rIndent);
          const finalZ = -1.05 - Math.cos(th) * (0.35 - rIndent);
          chunkRoom[ch].push({ x: finalX, y: cy, z: finalZ, r: col.r, g: col.g, b: col.b, stage: 3.0, size: 2.2 });
        }
      }

      // Rolled armrests with brass nailheads
      if (sec === 0 || sec === 15) {
        const armX = (sec === 0) ? -0.58 : 0.58;
        for (let ay = 0.52; ay <= 0.85; ay += 0.009) {
          for (let az = -1.05; az <= -0.65; az += 0.009) {
            const isNailhead = (az > -0.68) && (Math.abs(ay % 0.028) < 0.007);
            const aCol = isNailhead ? colBrassPolished : colLeather;
            chunkRoom[ch].push({ x: armX, y: ay, z: az, r: aCol.r, g: aCol.g, b: aCol.b, stage: 3.0, size: 2.0 });
          }
        }
      }

      // Thick plush seat cushion
      for (let sx = minX * 0.42; sx < maxX * 0.42; sx += 0.009) {
        for (let sz = -1.00; sz <= -0.65; sz += 0.009) {
          for (let sy = 0.46; sy <= 0.52; sy += 0.018) {
            chunkRoom[ch].push({ x: sx, y: sy, z: sz, r: colLeather.r, g: colLeather.g, b: colLeather.b, stage: 3.0, size: 2.0 });
          }
        }
      }
    }

    // --- F. Chunks 104..127 (24 Chunks): Electric Cyan Laser Blueprint & Tabletop Artifacts ---
    for (let sec = 0; sec < 24; sec++) {
      const ch = 104 + sec; // Chunks 104..127

      // 1. Electric Cyan Laser Blueprint (Centered at x in [-0.55, 0.25], z in [-0.42, 0.12], y = 0.965m)
      const minX = -0.55 + (sec / 24) * 0.80;
      const maxX = -0.55 + ((sec + 1) / 24) * 0.80;

      for (let x = minX; x < maxX; x += 0.0028) {
        for (let z = -0.42; z <= 0.12; z += 0.0028) {
          // Border & Grid
          const isOuterBorder = (Math.abs(x - (-0.15)) > 0.385 || Math.abs(z - (-0.15)) > 0.255);
          const isInnerBorder = (Math.abs(x - (-0.15)) > 0.370 || Math.abs(z - (-0.15)) > 0.240) && !isOuterBorder;
          const isGrid5mm = (Math.abs((x + 0.55) % 0.015) < 0.0015) || (Math.abs((z + 0.42) % 0.015) < 0.0015);

          // Classical Grand Rotunda Schematics centered at (-0.18, -0.15)
          const rx = x - (-0.18);
          const rz = z - (-0.15);
          const distRotunda = Math.sqrt(rx * rx + rz * rz);
          const isRotundaOuter = Math.abs(distRotunda - 0.16) < 0.0028;
          const isRotundaInner = Math.abs(distRotunda - 0.13) < 0.0028;
          const isRotundaCenter = Math.abs(distRotunda - 0.035) < 0.002;
          const isColRing = Math.abs(distRotunda - 0.145) < 0.005 && (Math.abs(Math.sin(Math.atan2(rz, rx) * 8.0)) > 0.88);

          // Architectural double walls and gallery partitions
          const isWallH1 = (Math.abs(z - (-0.02)) < 0.0018 && x > -0.50 && x < -0.25);
          const isWallH2 = (Math.abs(z - (-0.28)) < 0.0018 && x > -0.50 && x < -0.25);
          const isWallV1 = (Math.abs(x - (-0.50)) < 0.0018 && z > -0.28 && z < -0.02);
          const isWallV2 = (Math.abs(x - (-0.25)) < 0.0018 && z > -0.28 && z < -0.02);
          const isArchWall = isWallH1 || isWallH2 || isWallV1 || isWallV2;

          // 16-Point Nautical Compass Rose centered at (0.12, 0.00)
          const cx = x - 0.12;
          const cz = z - 0.00;
          const distCompass = Math.sqrt(cx * cx + cz * cz);
          const isCompassRing = Math.abs(distCompass - 0.065) < 0.0025;
          const isCompassPoints = (distCompass < 0.060) && (Math.abs(Math.sin(Math.atan2(cz, cx) * 8.0)) > 0.90);

          // Dimension lines with tick marks
          const isDimLine = (Math.abs(z - (-0.38)) < 0.0015 && x > -0.52 && x < 0.20);
          const isDimTick = isDimLine && (Math.abs((x + 0.52) % 0.08) < 0.002);

          // Formal Corner Title Block (x in [0.02, 0.22], z in [-0.39, -0.32])
          const isTitleBox = (x >= 0.02 && x <= 0.22 && z >= -0.39 && z <= -0.32);
          const isTitleLine = isTitleBox && ((Math.abs(z - (-0.355)) < 0.0015) || (Math.abs(x - 0.12) < 0.0015));

          let col = colBpPaper;
          let size = 1.4;

          if (isRotundaOuter || isRotundaInner || isRotundaCenter || isColRing || isCompassRing || isCompassPoints || isArchWall) {
            col = colBpLaserBright;
            size = 2.4;
          } else if (isOuterBorder || isInnerBorder || isDimLine || isDimTick || isTitleLine) {
            col = colBpLaser;
            size = 2.0;
          } else if (isGrid5mm) {
            col = colBpGrid;
            size = 1.2;
          }

          chunkRoom[ch].push({ x, y: 0.965, z, r: col.r, g: col.g, b: col.b, stage: 3.0, size });
        }
      }

      // 2. Precision Solid Brass Beam Compass (Articulated V-legs with knurled thumbwheel) (x = -0.05, z = -0.15)
      if (sec === 0 || sec === 1) {
        // Dual brass legs
        for (let l = 0; l <= 0.14; l += 0.002) {
          const lX1 = -0.05 - l * 0.35;
          const lZ1 = -0.22 + l * 0.85;
          const lY1 = 0.970 + (1.0 - l / 0.14) * 0.025;
          const isNeedle = (l < 0.015);
          chunkRoom[ch].push({ x: lX1, y: lY1, z: lZ1, r: isNeedle ? colConcrete.r : colBrassPolished.r, g: isNeedle ? colConcrete.g : colBrassPolished.g, b: isNeedle ? colConcrete.b : colBrassPolished.b, stage: 4.0, size: 2.0 });

          const lX2 = -0.05 + l * 0.35;
          const lZ2 = -0.22 + l * 0.85;
          const lY2 = 0.970 + (1.0 - l / 0.14) * 0.025;
          const isLead = (l < 0.015);
          chunkRoom[ch].push({ x: lX2, y: lY2, z: lZ2, r: isLead ? colMahogany.r : colBrassPolished.r, g: isLead ? colMahogany.g : colBrassPolished.g, b: isLead ? colMahogany.b : colBrassPolished.b, stage: 4.0, size: 2.0 });
        }
        // Knurled central adjustment thumbwheel
        for (let r = 0; r <= 0.012; r += 0.002) {
          for (let a = 0; a < Math.PI * 2; a += 0.35) {
            chunkRoom[ch].push({ x: -0.05 + Math.cos(a) * r, y: 0.982, z: -0.14 + Math.sin(a) * r, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 1.8 });
          }
        }
      }

      // 3. Clear 30-60-90 Acrylic Drafting Triangle with Finger Grip (x in [-0.35, -0.15], z in [-0.15, 0.08])
      if (sec === 2) {
        for (let tx = -0.35; tx <= -0.15; tx += 0.0028) {
          const maxZ = 0.08 - (tx - (-0.35)) * 1.05;
          for (let tz = -0.15; tz <= maxZ; tz += 0.0028) {
            // Triangular finger grip cutout
            const inCutout = (tx > -0.31 && tx < -0.19 && tz > -0.10 && tz < (0.02 - (tx - (-0.31)) * 1.05));
            if (inCutout) continue;

            const isEdge = (tx < -0.345 || tz < -0.145 || Math.abs(tz - maxZ) < 0.0035);
            const isTick = isEdge && (Math.abs(tx % 0.010) < 0.0015 || Math.abs(tz % 0.010) < 0.0015);
            const col = isTick ? colMahogany : (isEdge ? colGlass : colPages);
            chunkRoom[ch].push({ x: tx, y: 0.968, z: tz, r: col.r, g: col.g, b: col.b, stage: 4.0, size: 1.6 });
          }
        }
      }

      // 4. Classic Emerald Banker's Lamp (x = 0.42, z = -0.12)
      if (sec === 3 || sec === 4) {
        // Heavy Tiered Brass Base
        for (let br = 0; br <= 0.075; br += 0.005) {
          for (let ba = 0; ba < Math.PI * 2; ba += 0.25) {
            const bx = 0.42 + Math.cos(ba) * br;
            const bz = -0.12 + Math.sin(ba) * br;
            chunkRoom[ch].push({ x: bx, y: 0.965, z: bz, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 2.0 });
          }
        }
        // Twin Brass Upright Stems
        for (let ly = 0.97; ly <= 1.28; ly += 0.006) {
          chunkRoom[ch].push({ x: 0.40, y: ly, z: -0.12, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 2.0 });
          chunkRoom[ch].push({ x: 0.44, y: ly, z: -0.12, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 2.0 });
        }
        // Emerald Green Glass Hood (x in [0.32, 0.52], z in [-0.18, -0.06], y in [1.25, 1.34])
        for (let hx = 0.32; hx <= 0.52; hx += 0.005) {
          for (let ha = 0; ha < Math.PI; ha += 0.12) {
            const hy = 1.28 + Math.sin(ha) * 0.055;
            const hz = -0.12 + Math.cos(ha) * 0.060;
            chunkRoom[ch].push({ x: hx, y: hy, z: hz, r: colLampEmerald.r, g: colLampEmerald.g, b: colLampEmerald.b, stage: 4.0, size: 2.0 });
          }
        }
        // Glowing Tungsten Filament Bulb
        for (let fx = 0.38; fx <= 0.46; fx += 0.0035) {
          chunkRoom[ch].push({ x: fx, y: 1.265, z: -0.12, r: colLampFilament.r, g: colLampFilament.g, b: colLampFilament.b, stage: 4.0, size: 3.0 });
        }
        // Brass Pull Chain with Bead Tassel
        for (let cy = 1.15; cy <= 1.27; cy += 0.006) {
          chunkRoom[ch].push({ x: 0.48, y: cy, z: -0.10, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 1.6 });
        }
        chunkRoom[ch].push({ x: 0.48, y: 1.145, z: -0.10, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 2.4 });
      }

      // 5. Stoneware Ceramic Coffee Mug & Delicate Rising Steam (x = 0.32, z = 0.08)
      if (sec === 5 || sec === 6) {
        for (let my = 0.965; my <= 1.055; my += 0.005) {
          for (let ma = 0; ma < Math.PI * 2; ma += 0.20) {
            const mx = 0.32 + Math.cos(ma) * 0.040;
            const mz = 0.08 + Math.sin(ma) * 0.040;
            chunkRoom[ch].push({ x: mx, y: my, z: mz, r: colMug.r, g: colMug.g, b: colMug.b, stage: 4.0, size: 2.0 });
          }
        }
        // Espresso crema surface
        for (let er = 0; er <= 0.036; er += 0.004) {
          for (let ea = 0; ea < Math.PI * 2; ea += 0.22) {
            const ex = 0.32 + Math.cos(ea) * er;
            const ez = 0.08 + Math.sin(ea) * er;
            const isCrema = (er > 0.024);
            const col = isCrema ? colDesk : colMahogany;
            chunkRoom[ch].push({ x: ex, y: 1.045, z: ez, r: col.r, g: col.g, b: col.b, stage: 4.0, size: 1.8 });
          }
        }
        // Rising Steam Plumes (stage 4.5)
        for (let s = 0; s < 600; s++) {
          const sy = 1.06 + rand() * 0.25;
          const sx = 0.32 + (rand() - 0.5) * 0.045;
          const sz = 0.08 + (rand() - 0.5) * 0.045;
          chunkRoom[ch].push({ x: sx, y: sy, z: sz, r: colSteam.r, g: colSteam.g, b: colSteam.b, stage: 4.5, size: 2.4 });
        }
      }

      // 6. Vintage Circular Brass Desk Clock (x = -0.45, z = -0.32)
      if (sec === 7) {
        for (let cy = 0.965; cy <= 1.075; cy += 0.005) {
          for (let ca = 0; ca < Math.PI * 2; ca += 0.16) {
            const cx = -0.45 + Math.cos(ca) * 0.048;
            const cz = -0.32 + Math.sin(ca) * 0.048;
            chunkRoom[ch].push({ x: cx, y: cy, z: cz, r: colBrassPolished.r, g: colBrassPolished.g, b: colBrassPolished.b, stage: 4.0, size: 2.0 });
          }
        }
        for (let dr = 0; dr <= 0.042; dr += 0.0035) {
          for (let da = 0; da < Math.PI * 2; da += 0.20) {
            const dx = -0.45 + Math.cos(da) * dr;
            const dy = 1.020 + Math.sin(da) * dr;
            const isMarker = (dr > 0.034) && (Math.abs(Math.sin(da * 6.0)) > 0.82);
            const isHourHand = (Math.abs(da - 2.1) < 0.15 && dr < 0.026);
            const isMinuteHand = (Math.abs(da - 0.5) < 0.10 && dr < 0.036);

            let col = colClockFace;
            if (isMarker || isHourHand || isMinuteHand) col = colClockHands;
            chunkRoom[ch].push({ x: dx, y: dy, z: -0.275, r: col.r, g: col.g, b: col.b, stage: 4.0, size: 1.8 });
          }
        }
      }

      // 7. Carved Wooden Pen Tray with Fountain Pens & Ink Bottle (x = 0.18, z = -0.32)
      if (sec === 8) {
        for (let px = 0.10; px <= 0.26; px += 0.004) {
          for (let pz = -0.35; pz <= -0.28; pz += 0.004) {
            const isTrayRim = (px < 0.108 || px > 0.252 || pz < -0.345 || pz > -0.285);
            const isPen1 = (Math.abs(pz - (-0.32)) < 0.004 && px > 0.12 && px < 0.24);
            const isPen2 = (Math.abs(pz - (-0.30)) < 0.004 && px > 0.12 && px < 0.24);

            let col = isTrayRim ? colDeskDark : colDesk;
            if (isPen1) col = colMahogany;
            else if (isPen2) col = colBrassPolished;

            chunkRoom[ch].push({ x: px, y: 0.968, z: pz, r: col.r, g: col.g, b: col.b, stage: 4.0, size: 1.8 });
          }
        }
      }

      // 8. Terracotta Pot & Lush Monstera Deliciosa (x = 2.20, z = 0.60)
      if (sec >= 9 && sec <= 12) {
        for (let py = 0.0; py <= 0.45; py += 0.010) {
          const pr = 0.16 + (py / 0.45) * 0.09;
          for (let pa = 0; pa < Math.PI * 2; pa += 0.22) {
            const px = 2.20 + Math.cos(pa) * pr;
            const pz = 0.60 + Math.sin(pa) * pr;
            chunkRoom[ch].push({ x: px, y: py, z: pz, r: colLeather.r, g: colLeather.g, b: colLeather.b, stage: 5.0, size: 2.2 });
          }
        }
        for (let leaf = 0; leaf < 6; leaf++) {
          const lAng = (leaf / 6) * Math.PI * 2;
          const lH = 0.45 + (leaf / 6) * 0.55;
          for (let uL = 0; uL <= 1.0; uL += 0.030) {
            for (let vL = -0.5; vL <= 0.5; vL += 0.030) {
              const isSlit = (Math.abs(vL) > 0.18) && (Math.abs(uL % 0.22 - 0.11) < 0.035);
              if (isSlit) continue;

              const lx = 2.20 + Math.cos(lAng) * (uL * 0.55) + Math.sin(lAng) * (vL * 0.38);
              const lz = 0.60 + Math.sin(lAng) * (uL * 0.55) - Math.cos(lAng) * (vL * 0.38);
              const ly = lH + Math.sin(uL * Math.PI) * 0.18 - Math.abs(vL) * 0.10;

              const isVein = (Math.abs(vL) < 0.04);
              const col = isVein ? colStem : colLeaf;
              chunkRoom[ch].push({ x: lx, y: ly, z: lz, r: col.r, g: col.g, b: col.b, stage: 5.0, size: 2.2 });
            }
          }
        }
      }
    }

    // =========================================================================
    // PART 2: THE DENSE, FULLY FLESHED-OUT METROPOLIS CITY
    // =========================================================================

    // --- A. Chunks 0..23 (24 Chunks): Deep Horizon Panoramic Mega-Skyscrapers ---
    // 16 Colossal background skyscrapers creating a dense, layered skyline (z = 75 to 140m)
    const horizonTowers = [
      { cx: -45.0, cz: 85.0, w: 18.0, d: 18.0, h: 110.0 },
      { cx: 45.0, cz: 88.0, w: 18.0, d: 18.0, h: 115.0 },
      { cx: -30.0, cz: 75.0, w: 15.0, d: 15.0, h: 98.0 },
      { cx: 30.0, cz: 78.0, w: 15.0, d: 15.0, h: 102.0 },
      { cx: -18.0, cz: 90.0, w: 14.0, d: 14.0, h: 105.0 },
      { cx: 18.0, cz: 92.0, w: 14.0, d: 14.0, h: 108.0 },
      { cx: 0.0, cz: 110.0, w: 22.0, d: 20.0, h: 130.0 },
      { cx: -55.0, cz: 100.0, w: 16.0, d: 16.0, h: 95.0 },
      { cx: 55.0, cz: 102.0, w: 16.0, d: 16.0, h: 96.0 },
      { cx: -38.0, cz: 115.0, w: 18.0, d: 18.0, h: 118.0 },
      { cx: 38.0, cz: 118.0, w: 18.0, d: 18.0, h: 120.0 },
      { cx: -12.0, cz: 125.0, w: 16.0, d: 16.0, h: 125.0 },
      { cx: 12.0, cz: 128.0, w: 16.0, d: 16.0, h: 128.0 },
      { cx: -24.0, cz: 135.0, w: 20.0, d: 20.0, h: 135.0 },
      { cx: 24.0, cz: 138.0, w: 20.0, d: 20.0, h: 138.0 },
      { cx: 0.0, cz: 140.0, w: 24.0, d: 24.0, h: 145.0 }
    ];
    for (let tIdx = 0; tIdx < 16; tIdx++) {
      const bldg = horizonTowers[tIdx];
      const chBase = Math.floor((tIdx / 16) * 24);
      const ch = Math.min(23, chBase);
      const numFl = Math.floor(bldg.h / 0.28);

      for (let fl = 0; fl < numFl; fl++) {
        const y = -4.0 + fl * 0.28;
        const halfW = bldg.w * 0.5;
        const halfD = bldg.d * 0.5;

        // Front facade
        for (let px = -halfW; px <= halfW; px += 0.14) {
          const isWindow = (Math.abs(px % 1.5 - 0.75) < 0.45) && (Math.abs(fl % 3 - 1) === 0);
          const lit = Math.sin(fl * 14.3 + px * 22.1) > -0.15;
          let col = colConcrete;
          if (isWindow && lit) col = (px < 0) ? colWarm : colCyan;
          else if (isWindow) col = colAsh;
          chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz - halfD, r: col.r, g: col.g, b: col.b });
        }
        // Side facades
        for (let pz = -halfD; pz <= halfD; pz += 0.16) {
          const isWindow = (Math.abs(pz % 1.5 - 0.75) < 0.45) && (Math.abs(fl % 3 - 1) === 0);
          const lit = Math.sin(fl * 11.7 + pz * 19.3) > -0.15;
          let col = colConcrete;
          if (isWindow && lit) col = colAmber;
          chunkCity[ch].push({ x: bldg.cx - halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
          chunkCity[ch].push({ x: bldg.cx + halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
        }
      }

      // Spire with Red Warning Beacon
      const topY = -4.0 + numFl * 0.28;
      for (let sy = topY; sy <= topY + 12.0; sy += 0.25) {
        chunkCity[ch].push({ x: bldg.cx, y: sy, z: bldg.cz, r: colAsh.r, g: colAsh.g, b: colAsh.b });
      }
      chunkCity[ch].push({ x: bldg.cx, y: topY + 12.0, z: bldg.cz, r: colBeacon.r, g: colBeacon.g, b: colBeacon.b });
    }

    // --- B. Chunks 24..39 (16 Chunks): Continuous Ground Avenue, Sidewalks, Streetlamps & Traffic ---
    // Avenue spans x in [-25, 25], z in [-15, 115], y = -4.0m
    for (let cx = 0; cx < 4; cx++) {
      const minX = -25.0 + (cx / 4) * 50.0;
      const maxX = -25.0 + ((cx + 1) / 4) * 50.0;
      for (let cz = 0; cz < 4; cz++) {
        const minZ = -15.0 + (cz / 4) * 130.0;
        const maxZ = -15.0 + ((cz + 1) / 4) * 130.0;
        const ch = 24 + cz * 4 + cx; // Chunks 24..39

        for (let gx = minX; gx < maxX; gx += 0.08) {
          for (let gz = minZ; gz < maxZ; gz += 0.08) {
            const isMainRoad = Math.abs(gx) < 10.0;
            const isCrossStreet = (Math.abs(gz - 12.0) < 4.5) || (Math.abs(gz - 34.0) < 4.5) || (Math.abs(gz - 58.0) < 4.5) || (Math.abs(gz - 84.0) < 4.5);
            const isSidewalk = (Math.abs(gx) >= 10.0 && Math.abs(gx) <= 12.5);
            const isCurb = (Math.abs(Math.abs(gx) - 10.0) < 0.15);
            const isCenterDouble = isMainRoad && (Math.abs(gx) < 0.12);
            const isLaneDash = isMainRoad && (Math.abs(Math.abs(gx) - 3.3) < 0.08 || Math.abs(Math.abs(gx) - 6.6) < 0.08) && (Math.abs(gz % 4.0) < 1.4);
            const isCrosswalk = isMainRoad && ((Math.abs(gz - 9.0) < 0.6) || (Math.abs(gz - 31.0) < 0.6) || (Math.abs(gz - 55.0) < 0.6) || (Math.abs(gz - 81.0) < 0.6));

            let col = colConcrete;
            let gy = -4.0;
            if (isCenterDouble) { col = colAmber; gy = -3.98; }
            else if (isCrosswalk || isLaneDash) { col = colWarm; gy = -3.98; }
            else if (isCurb || isSidewalk) { col = colCurb; gy = -3.85; }
            else if (isMainRoad || isCrossStreet) { col = colAsphalt; gy = -4.0; }

            chunkCity[ch].push({ x: gx, y: gy, z: gz, r: col.r, g: col.g, b: col.b });
          }
        }

        // 8 Streaming Traffic Arteries
        if (Math.abs(minX) < 11.0) {
          for (let gz = minZ; gz < maxZ; gz += 0.08) {
            // Southbound Red Taillights (x < 0)
            chunkCity[ch].push({ x: -1.6, y: -3.80, z: gz, r: colTail.r, g: colTail.g, b: colTail.b });
            chunkCity[ch].push({ x: -4.8, y: -3.80, z: gz, r: colTail.r, g: colTail.g, b: colTail.b });
            chunkCity[ch].push({ x: -8.0, y: -3.80, z: gz, r: colTail.r, g: colTail.g, b: colTail.b });

            // Northbound White Headlights (x > 0)
            chunkCity[ch].push({ x: 1.6, y: -3.80, z: gz, r: colHead.r, g: colHead.g, b: colHead.b });
            chunkCity[ch].push({ x: 4.8, y: -3.80, z: gz, r: colHead.r, g: colHead.g, b: colHead.b });
            chunkCity[ch].push({ x: 8.0, y: -3.80, z: gz, r: colHead.r, g: colHead.g, b: colHead.b });
          }
        }

        // Sidewalk Lampposts with Glowing Warm Fixtures
        if (Math.abs(minX) < 15.0 && Math.abs(minZ % 14.0) < 1.2) {
          const lampX = (minX < 0) ? -10.8 : 10.8;
          for (let ly = -3.85; ly <= -1.0; ly += 0.04) {
            chunkCity[ch].push({ x: lampX, y: ly, z: minZ + 2.0, r: colConcrete.r, g: colConcrete.g, b: colConcrete.b });
          }
          chunkCity[ch].push({ x: lampX, y: -0.95, z: minZ + 2.0, r: colStreetLight.r, g: colStreetLight.g, b: colStreetLight.b });
          chunkCity[ch].push({ x: lampX, y: -0.90, z: minZ + 2.0, r: colWarm.r, g: colWarm.g, b: colWarm.b });
        }
      }
    }

    // --- C. Chunks 40..63 (24 Chunks): Towering Canyon Skyscrapers directly lining the avenue ---
    // 6 Colossal skyscrapers lining the avenue from z = 2.0m to 45.0m (Facades placed at x = +/- 11.5m!)
    const nearCanyonTowers = [
      { cx: -17.5, cz: 8.0, w: 12.0, d: 11.0, h: 70.0 },   // inner face at x = -11.5m!
      { cx: 17.5, cz: 8.0, w: 12.0, d: 11.0, h: 72.0 },    // inner face at x = +11.5m!
      { cx: -18.0, cz: 21.0, w: 13.0, d: 12.0, h: 78.0 },
      { cx: 18.0, cz: 21.0, w: 13.0, d: 12.0, h: 80.0 },
      { cx: -18.5, cz: 35.0, w: 14.0, d: 13.0, h: 85.0 },
      { cx: 18.5, cz: 35.0, w: 14.0, d: 13.0, h: 88.0 }
    ];
    for (let tIdx = 0; tIdx < 6; tIdx++) {
      const bldg = nearCanyonTowers[tIdx];
      const numFl = Math.floor(bldg.h / 0.22);

      for (let sec = 0; sec < 4; sec++) {
        const ch = 40 + tIdx * 4 + sec; // Chunks 40..63 (24 chunks)
        const minFl = Math.floor((sec / 4) * numFl);
        const maxFl = Math.floor(((sec + 1) / 4) * numFl);

        for (let fl = minFl; fl < maxFl; fl++) {
          const y = -4.0 + fl * 0.22;
          const halfW = bldg.w * 0.5;
          const halfD = bldg.d * 0.5;

          // Inner facade facing the avenue (x = +/- 11.5m)
          const avenueFaceX = (bldg.cx < 0) ? (bldg.cx + halfW) : (bldg.cx - halfW);
          for (let pz = -halfD; pz <= halfD; pz += 0.08) {
            const isStorefront = (fl < 12);
            const isWindow = (Math.abs(pz % 1.2 - 0.6) < 0.40) && (Math.abs(fl % 3 - 1) === 0);
            const isPier = (Math.abs(pz % 1.2) < 0.12);
            const lit = Math.sin(fl * 13.7 + pz * 24.3) > -0.20;

            let col = colConcrete;
            if (isStorefront) {
              col = (Math.abs(pz % 2.4 - 1.2) < 0.8) ? colWarm : colBronze;
            } else if (isPier) {
              col = colLimestone;
            } else if (isWindow && lit) {
              col = (bldg.cx < 0) ? colWarm : colCyan;
            } else if (isWindow) {
              col = colAsh;
            }

            chunkCity[ch].push({ x: avenueFaceX, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
          }

          // Front and Back facades
          for (let px = -halfW; px <= halfW; px += 0.09) {
            const isWindow = (Math.abs(px % 1.2 - 0.6) < 0.40) && (Math.abs(fl % 3 - 1) === 0);
            const lit = Math.sin(fl * 15.1 + px * 27.5) > -0.20;
            let col = colConcrete;
            if (isWindow && lit) col = colAmber;
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz - halfD, r: col.r, g: col.g, b: col.b });
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz + halfD, r: col.r, g: col.g, b: col.b });
          }
        }
      }
    }

    // --- D. Chunks 64..87 (24 Chunks): Midground Canyon Skyscraper Blocks & Overhead Skyways ---
    // 4 Glass-Enclosed Aerial Skyways spanning across the avenue (z = 16, 32, 52, 72)
    const skywayZ = [16.0, 32.0, 52.0, 72.0];
    for (let sw = 0; sw < 4; sw++) {
      const sz = skywayZ[sw];
      for (let sec = 0; sec < 2; sec++) {
        const ch = 64 + sw * 2 + sec; // Chunks 64..71
        const sy = 12.0 + sec * 8.0;

        for (let x = -11.5; x <= 11.5; x += 0.08) {
          for (let zOff = -1.6; zOff <= 1.6; zOff += 0.10) {
            const isGlass = Math.abs(zOff) > 1.0;
            const isTruss = (Math.abs((x + zOff) % 1.4) < 0.12);
            let col = isGlass ? colWarm : (isTruss ? colLimestone : colConcrete);
            chunkCity[ch].push({ x, y: sy, z: sz + zOff, r: col.r, g: col.g, b: col.b });
          }
        }
      }
    }

    // 6 Midground Towers lining the avenue from z = 48.0m to 105.0m
    const midCanyonTowers = [
      { cx: -19.5, cz: 50.0, w: 14.0, d: 13.0, h: 90.0 },
      { cx: 19.5, cz: 50.0, w: 14.0, d: 13.0, h: 92.0 },
      { cx: -20.0, cz: 68.0, w: 15.0, d: 14.0, h: 95.0 },
      { cx: 20.0, cz: 68.0, w: 15.0, d: 14.0, h: 96.0 },
      { cx: -20.5, cz: 88.0, w: 15.0, d: 14.0, h: 100.0 },
      { cx: 20.5, cz: 88.0, w: 15.0, d: 14.0, h: 102.0 }
    ];
    for (let tIdx = 0; tIdx < 6; tIdx++) {
      const bldg = midCanyonTowers[tIdx];
      const numFl = Math.floor(bldg.h / 0.24);

      for (let sec = 0; sec < 2; sec++) {
        const ch = 72 + tIdx * 2 + sec; // Chunks 72..83
        const minFl = Math.floor((sec / 2) * numFl);
        const maxFl = Math.floor(((sec + 1) / 2) * numFl);

        for (let fl = minFl; fl < maxFl; fl++) {
          const y = -4.0 + fl * 0.24;
          const halfW = bldg.w * 0.5;
          const halfD = bldg.d * 0.5;

          for (let px = -halfW; px <= halfW; px += 0.10) {
            const isWindow = (Math.abs(px % 1.2 - 0.6) < 0.40) && (Math.abs(fl % 3 - 1) === 0);
            const lit = Math.sin(fl * 11.3 + px * 25.1) > -0.20;
            let col = colConcrete;
            if (isWindow && lit) col = (bldg.cx < 0) ? colWarm : colCyan;
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz - halfD, r: col.r, g: col.g, b: col.b });
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz + halfD, r: col.r, g: col.g, b: col.b });
          }
          for (let pz = -halfD; pz <= halfD; pz += 0.10) {
            const isWindow = (Math.abs(pz % 1.2 - 0.6) < 0.40) && (Math.abs(fl % 3 - 1) === 0);
            const lit = Math.sin(fl * 13.9 + pz * 21.7) > -0.20;
            let col = colConcrete;
            if (isWindow && lit) col = colAmber;
            chunkCity[ch].push({ x: bldg.cx - halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
            chunkCity[ch].push({ x: bldg.cx + halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
          }
        }
      }
    }

    // Additional Midground Fill Blocks (Chunks 84..87 = 4 chunks)
    for (let sec = 0; sec < 4; sec++) {
      const ch = 84 + sec;
      const sideX = (sec % 2 === 0) ? -38.0 : 38.0;
      const bZ = 45.0 + Math.floor(sec / 2) * 35.0;

      for (let fl = 0; fl < 180; fl++) {
        const y = -4.0 + fl * 0.30;
        for (let px = -8.0; px <= 8.0; px += 0.18) {
          const isWindow = (Math.abs(px % 1.4 - 0.7) < 0.45) && (Math.abs(fl % 3 - 1) === 0);
          const col = isWindow ? colWarm : colConcrete;
          chunkCity[ch].push({ x: sideX + px, y, z: bZ, r: col.r, g: col.g, b: col.b });
        }
      }
    }

    // --- E. Chunks 88..103 (16 Chunks): Flanking Blocks Adjacent to the Hero Skyscraper ---
    // Massive city blocks immediately framing the hero building at z = -14.0m to 6.0m
    const heroFlankBlocks = [
      { cx: -22.0, cz: -4.0, w: 12.0, d: 14.0, h: 62.0 },
      { cx: 22.0, cz: -4.0, w: 12.0, d: 14.0, h: 64.0 },
      { cx: -22.5, cz: -14.0, w: 13.0, d: 12.0, h: 68.0 },
      { cx: 22.5, cz: -14.0, w: 13.0, d: 12.0, h: 70.0 }
    ];
    for (let fIdx = 0; fIdx < 4; fIdx++) {
      const bldg = heroFlankBlocks[fIdx];
      const numFl = Math.floor(bldg.h / 0.24);

      for (let sec = 0; sec < 4; sec++) {
        const ch = 88 + fIdx * 4 + sec; // Chunks 88..103 (16 chunks)
        const minFl = Math.floor((sec / 4) * numFl);
        const maxFl = Math.floor(((sec + 1) / 4) * numFl);

        for (let fl = minFl; fl < maxFl; fl++) {
          const y = -4.0 + fl * 0.24;
          const halfW = bldg.w * 0.5;
          const halfD = bldg.d * 0.5;

          for (let px = -halfW; px <= halfW; px += 0.09) {
            const isWindow = (Math.abs(px % 1.1 - 0.55) < 0.35) && (Math.abs(fl % 3 - 1) === 0);
            const lit = Math.sin(fl * 12.5 + px * 23.4) > -0.20;
            let col = colConcrete;
            if (isWindow && lit) col = (px < 0) ? colWarm : colCyan;
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz - halfD, r: col.r, g: col.g, b: col.b });
            chunkCity[ch].push({ x: bldg.cx + px, y, z: bldg.cz + halfD, r: col.r, g: col.g, b: col.b });
          }
          for (let pz = -halfD; pz <= halfD; pz += 0.09) {
            const isWindow = (Math.abs(pz % 1.1 - 0.55) < 0.35) && (Math.abs(fl % 3 - 1) === 0);
            const lit = Math.sin(fl * 14.1 + pz * 19.8) > -0.20;
            let col = colConcrete;
            if (isWindow && lit) col = colAmber;
            chunkCity[ch].push({ x: bldg.cx - halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
            chunkCity[ch].push({ x: bldg.cx + halfW, y, z: bldg.cz + pz, r: col.r, g: col.g, b: col.b });
          }
        }
      }
    }

    // --- F. Chunks 104..127 (24 Chunks): The Majestic 3D Art Deco Hero Skyscraper ---
    // Footprint: x in [-16.0, 16.0], y in [-4.0, 80.0], z in [-18.0, 2.0]
    for (let hBay = 0; hBay < 6; hBay++) {
      const minX = -16.0 + (hBay / 6) * 32.0;
      const maxX = -16.0 + ((hBay + 1) / 6) * 32.0;
      for (let vTier = 0; vTier < 4; vTier++) {
        const minY = -4.0 + (vTier / 4) * 84.0;
        const maxY = -4.0 + ((vTier + 1) / 4) * 84.0;
        const ch = 104 + vTier * 6 + hBay; // Chunks 104..127 (24 chunks)
        const stepXY = (vTier === 0) ? 0.020 : 0.028;

        // 1. Front Facade at z = 2.0 (Solid Architectural Limestone & Bronze)
        for (let x = minX; x < maxX; x += stepXY) {
          for (let y = minY; y < maxY; y += stepXY) {
            const jx = x + (rand() - 0.5) * stepXY * 0.70;
            const jy = y + (rand() - 0.5) * stepXY * 0.70;

            // Stepped setbacks
            if (jy > 32.0 && Math.abs(jx) > 11.0) continue;
            if (jy > 48.0 && Math.abs(jx) > 7.5) continue;
            if (jy > 62.0 && Math.abs(jx) > 4.5) continue;

            // Punch out hero window aperture on floor 3
            if (Math.abs(jx) < 1.25 && jy > 0.75 && jy < 2.65) continue;

            const isRustication = (Math.abs(jy % 0.26) < 0.020);
            const isPilaster = (Math.abs(Math.abs(jx) - 1.45) < 0.08) && (jy >= 0.65 && jy <= 2.80);
            const isSill = (Math.abs(jx) < 1.55) && (Math.abs(jy - 0.72) < 0.05);
            const isCorbel = (Math.abs(jx) < 1.45) && (Math.abs(jy - 0.64) < 0.05) && (Math.abs(Math.abs(jx) - 0.45) < 0.06 || Math.abs(Math.abs(jx) - 1.15) < 0.06);
            const isLintel = (Math.abs(jx) < 1.55) && (Math.abs(jy - 2.68) < 0.06);
            const isRailing = (Math.abs(jx) < 1.35) && (jy >= 0.74 && jy <= 1.25) && (Math.abs(jx % 0.12) < 0.02 || Math.abs(jy - 1.22) < 0.02);

            const isCentralBay = Math.abs(jx) < 1.1 && jy > 3.0;
            const isSideBay = (Math.abs(jx) > 1.8 && Math.abs(jx) < 3.8) || (Math.abs(jx) > 5.0 && Math.abs(jx) < 7.2) || (Math.abs(jx) > 8.5 && Math.abs(jx) < 11.0);
            const isWinCol = isCentralBay || isSideBay;
            const isWinFloor = (Math.abs(jy % 2.4 - 1.2) < 0.82) && (jy > -1.5 && jy < 58.0);
            const isOfficeWin = isWinCol && isWinFloor;
            const isMarquee = (Math.abs(jx) < 6.0) && (jy >= -2.2 && jy <= -1.6);

            let col = colLimestone;
            let zPos = 2.0;

            if (isRailing) {
              col = colBronze;
              zPos = 2.14;
            } else if (isSill || isCorbel) {
              col = colLimestone;
              zPos = 2.18;
            } else if (isLintel || isPilaster) {
              col = colBrass;
              zPos = 2.10;
            } else if (isMarquee) {
              col = colWarm;
              zPos = 2.30;
            } else if (isOfficeWin) {
              const isBlindSlat = (Math.abs(jy % 0.10) < 0.02);
              col = isBlindSlat ? colLimestoneShad : ((jx < 0) ? colWarm : colCyan);
              zPos = 2.0;
            } else if (isRustication) {
              col = colLimestoneShad;
              zPos = 1.98;
            }

            chunkCity[ch].push({ x: jx, y: jy, z: zPos, r: col.r, g: col.g, b: col.b });
          }
        }

        // 2. Solid 3D Side Walls of the Hero Skyscraper (West x = -16.0 and East x = 16.0)
        if (hBay === 0 || hBay === 5) {
          const sx = (hBay === 0) ? -16.0 : 16.0;
          for (let z = -18.0; z <= 2.0; z += 0.06) {
            for (let y = minY; y < Math.min(maxY, 32.0); y += 0.06) {
              const isWinZ = (Math.abs(z % 2.2 - 1.1) < 0.55) && (Math.abs(y % 2.4 - 1.2) < 0.82);
              const col = isWinZ ? ((z < -4.0) ? colCyan : colWarm) : colLimestoneShad;
              chunkCity[ch].push({ x: sx, y, z, r: col.r, g: col.g, b: col.b });
            }
          }
        }
      }
    }

    // =========================================================================
    // PART 3: PACK 128 CHUNKS INTO UNIFORM GPU BUFFERS (O(1) CLOSED-FORM)
    // =========================================================================
    let writeIdx = 0;

    for (let ch = 0; ch < NUM_CHUNKS; ch++) {
      const rList = chunkRoom[ch];
      const cList = chunkCity[ch];

      const nRoom = rList.length;
      const nCity = cList.length;

      // Compute exact Room Centroid
      let rxSum = 0, rySum = 0, rzSum = 0;
      for (let i = 0; i < nRoom; i++) {
        rxSum += rList[i].x; rySum += rList[i].y; rzSum += rList[i].z;
      }
      const rCentroid = {
        x: nRoom > 0 ? rxSum / nRoom : 0,
        y: nRoom > 0 ? rySum / nRoom : 1.6,
        z: nRoom > 0 ? rzSum / nRoom : 0
      };

      // Compute exact City Centroid
      let cxSum = 0, cySum = 0, czSum = 0;
      for (let i = 0; i < nCity; i++) {
        cxSum += cList[i].x; cySum += cList[i].y; czSum += cList[i].z;
      }
      const cCentroid = {
        x: nCity > 0 ? cxSum / nCity : 0,
        y: nCity > 0 ? cySum / nCity : 12.0,
        z: nCity > 0 ? czSum / nCity : 25.0
      };

      // PROGRESSIVE CHUNK DECONSTRUCTION TIMELINE:
      // Chunks deconstruct from the distant outer city inward to the hero facade:
      // Chunks 0..23 (Horizon Mega-Towers -> Parquet Floor): 13.0s - 15.0s
      // Chunks 24..39 (Avenue/Traffic/Ground -> Persian Rug): 14.2s - 16.2s
      // Chunks 40..63 (Canyon Towers -> Wainscot Walls & Ceiling): 15.5s - 17.5s
      // Chunks 64..87 (Midground Towers & Skyways -> Library & Books): 16.8s - 18.8s
      // Chunks 88..103 (Immediate Flank Towers -> Drafting Desk & Armchair): 18.0s - 19.8s
      // Chunks 104..127 (Hero Skyscraper -> Laser Blueprint & Instruments): 19.0s - 20.4s
      let chunkStart = 13.0;
      if (ch < 24) {
        chunkStart = 13.0 + (ch / 24) * 1.2;
      } else if (ch < 40) {
        chunkStart = 14.2 + ((ch - 24) / 16) * 1.2;
      } else if (ch < 64) {
        chunkStart = 15.5 + ((ch - 40) / 24) * 1.2;
      } else if (ch < 88) {
        chunkStart = 16.8 + ((ch - 64) / 24) * 1.2;
      } else if (ch < 104) {
        chunkStart = 18.0 + ((ch - 88) / 16) * 1.0;
      } else {
        chunkStart = 19.0 + ((ch - 104) / 24) * 0.9;
      }

      for (let i = 0; i < TARGET_CHUNK_COUNT; i++) {
        if (writeIdx >= CHUNK_POINTS_TOTAL) break;

        const rIdx = (nRoom > 0) ? Math.floor((i / TARGET_CHUNK_COUNT) * nRoom) : 0;
        const cIdx = (nCity > 0) ? Math.floor((i / TARGET_CHUNK_COUNT) * nCity) : 0;

        const rPtOrig = (nRoom > 0) ? rList[rIdx]! : { x: 0, y: 0, z: 0, r: 0.8, g: 0.8, b: 0.8, stage: 0, size: 2.0 };
        const cPtOrig = (nCity > 0) ? cList[cIdx]! : { x: 0, y: 0, z: 20, r: 0.5, g: 0.5, b: 0.5 };

        // Micro-jitter to prevent point stacking
        const rJitterX = (rand() - 0.5) * 0.002;
        const rJitterY = (rand() - 0.5) * 0.002;
        const rJitterZ = (rand() - 0.5) * 0.002;

        const cJitterX = (rand() - 0.5) * 0.006;
        const cJitterY = (rand() - 0.5) * 0.006;
        const cJitterZ = (rand() - 0.5) * 0.006;

        const i3 = writeIdx * 3;
        const i4 = writeIdx * 4;

        cityPositions[i3] = cPtOrig.x + cJitterX;
        cityPositions[i3 + 1] = cPtOrig.y + cJitterY;
        cityPositions[i3 + 2] = cPtOrig.z + cJitterZ;

        roomPositions[i3] = rPtOrig.x + rJitterX;
        roomPositions[i3 + 1] = rPtOrig.y + rJitterY;
        roomPositions[i3 + 2] = rPtOrig.z + rJitterZ;

        cityColors[i3] = cPtOrig.r;
        cityColors[i3 + 1] = cPtOrig.g;
        cityColors[i3 + 2] = cPtOrig.b;

        roomColors[i3] = rPtOrig.r;
        roomColors[i3 + 1] = rPtOrig.g;
        roomColors[i3 + 2] = rPtOrig.b;

        const conduitAngle = (writeIdx % NUM_CONDUITS) / NUM_CONDUITS * Math.PI * 2;
        const stage = rPtOrig.stage !== undefined ? rPtOrig.stage : 0.0;
        const baseSize = rPtOrig.size !== undefined ? rPtOrig.size : 2.0;

        params[i4] = chunkStart;
        params[i4 + 1] = stage;
        params[i4 + 2] = conduitAngle;
        params[i4 + 3] = baseSize;

        chunkData[i4] = cCentroid.x;
        chunkData[i4 + 1] = cCentroid.y;
        chunkData[i4 + 2] = cCentroid.z;
        chunkData[i4 + 3] = stage;

        roomCentroids[i3] = rCentroid.x;
        roomCentroids[i3 + 1] = rCentroid.y;
        roomCentroids[i3 + 2] = rCentroid.z;

        streamAxes[i3] = Math.cos(conduitAngle);
        streamAxes[i3 + 1] = Math.sin(conduitAngle);
        streamAxes[i3 + 2] = Math.sin(conduitAngle * 2.0) * 0.5;

        phases[writeIdx] = rand();
        writeIdx++;
      }
    }

    // =========================================================================
    // PART 4: THE DEDICATED HERO ARCHITECTURAL WINDOW (100,000 Points, Stage 9)
    // =========================================================================
    // Aperture: x in [-1.20, 1.20], y in [0.75, 2.55], z = 1.95m
    // Real architectural frame: Outer bronze casing, stone reveal, 16-pane brass sash,
    // and CRYSTAL-CLEAR transparent glass panes so the warm room is visible from outside!

    // 1. Deep Stone Embrasure Reveals (left, right, top, bottom jambs) (25,000 points)
    for (let jx = 0; jx < 2; jx++) {
      const sideX = (jx === 0) ? -1.22 : 1.22;
      for (let y = 0.72; y <= 2.58; y += 0.008) {
        for (let z = 1.60; z <= 2.00; z += 0.012) {
          if (writeIdx >= TOTAL_POINTS) break;
          const i3 = writeIdx * 3;
          const i4 = writeIdx * 4;

          cityPositions[i3] = sideX;
          cityPositions[i3 + 1] = y;
          cityPositions[i3 + 2] = z;
          roomPositions[i3] = sideX;
          roomPositions[i3 + 1] = y;
          roomPositions[i3 + 2] = z;
          cityColors[i3] = colLimestoneShad.r;
          cityColors[i3 + 1] = colLimestoneShad.g;
          cityColors[i3 + 2] = colLimestoneShad.b;
          roomColors[i3] = colWainscot.r;
          roomColors[i3 + 1] = colWainscot.g;
          roomColors[i3 + 2] = colWainscot.b;

          params[i4] = 20.2;
          params[i4 + 1] = 9.0;
          params[i4 + 2] = rand() * Math.PI * 2;
          params[i4 + 3] = 2.2;
          chunkData[i4] = 0.0;
          chunkData[i4 + 1] = 1.65;
          chunkData[i4 + 2] = 1.95;
          chunkData[i4 + 3] = Math.abs(sideX);
          phases[writeIdx] = rand();
          writeIdx++;
        }
      }
    }

    // 2. Heavy Burnished Dark Bronze Outer Casing & Projecting Carved Sill (25,000 points)
    for (let wx = -1.22; wx <= 1.22; wx += 0.006) {
      for (let wy of [0.72, 2.58]) {
        for (let t = 0; t < 12; t++) {
          if (writeIdx >= TOTAL_POINTS) break;
          const i3 = writeIdx * 3;
          const i4 = writeIdx * 4;

          const zOff = (wy === 0.72) ? (2.00 + (t / 12) * 0.16) : (1.92 + (t / 12) * 0.08);
          cityPositions[i3] = wx;
          cityPositions[i3 + 1] = wy + (t / 12) * 0.03;
          cityPositions[i3 + 2] = zOff;
          roomPositions[i3] = wx;
          roomPositions[i3 + 1] = wy;
          roomPositions[i3 + 2] = zOff;
          cityColors[i3] = (wy === 0.72) ? colLimestone.r : colBronze.r;
          cityColors[i3 + 1] = (wy === 0.72) ? colLimestone.g : colBronze.g;
          cityColors[i3 + 2] = (wy === 0.72) ? colLimestone.b : colBronze.b;
          roomColors[i3] = colDeskDark.r;
          roomColors[i3 + 1] = colDeskDark.g;
          roomColors[i3 + 2] = colDeskDark.b;

          params[i4] = 20.2;
          params[i4 + 1] = 9.0;
          params[i4 + 2] = rand() * Math.PI * 2;
          params[i4 + 3] = 2.4;
          chunkData[i4] = 0.0;
          chunkData[i4 + 1] = 1.65;
          chunkData[i4 + 2] = 1.95;
          chunkData[i4 + 3] = Math.abs(wx);
          phases[writeIdx] = rand();
          writeIdx++;
        }
      }
    }

    // 3. 16-Pane Polished Brass Sash & Mullions (3 vertical + 3 horizontal) (30,000 points)
    for (let wx = -1.20; wx <= 1.20; wx += 0.008) {
      for (let wy = 0.75; wy <= 2.55; wy += 0.008) {
        if (writeIdx >= TOTAL_POINTS) break;

        const isOuterSash = (Math.abs(wx) > 1.15 || wy < 0.78 || wy > 2.52);
        const isMullionV = (Math.abs(wx) < 0.024) || (Math.abs(Math.abs(wx) - 0.58) < 0.022);
        const isMullionH = (Math.abs(wy - 1.65) < 0.024) || (Math.abs(Math.abs(wy - 1.65) - 0.44) < 0.022);
        const isSash = isOuterSash || isMullionV || isMullionH;

        if (!isSash) continue;

        const i3 = writeIdx * 3;
        const i4 = writeIdx * 4;

        cityPositions[i3] = wx;
        cityPositions[i3 + 1] = wy;
        cityPositions[i3 + 2] = 1.95;
        roomPositions[i3] = wx;
        roomPositions[i3 + 1] = wy;
        roomPositions[i3 + 2] = 1.95;
        cityColors[i3] = colBrassPolished.r;
        cityColors[i3 + 1] = colBrassPolished.g;
        cityColors[i3 + 2] = colBrassPolished.b;
        roomColors[i3] = colBrass.r;
        roomColors[i3 + 1] = colBrass.g;
        roomColors[i3 + 2] = colBrass.b;

        params[i4] = 20.2;
        params[i4 + 1] = 9.0;
        params[i4 + 2] = rand() * Math.PI * 2;
        params[i4 + 3] = 2.0;
        chunkData[i4] = 0.0;
        chunkData[i4 + 1] = 1.65;
        chunkData[i4 + 2] = 1.95;
        chunkData[i4 + 3] = Math.sqrt(wx * wx + (wy - 1.65) * (wy - 1.65));
        phases[writeIdx] = rand();
        writeIdx++;
      }
    }

    // 4. Subtle Specular Bevels of the Glass Panes (Transparent Glass!) (20,000 points)
    for (let wx = -1.18; wx <= 1.18; wx += 0.012) {
      for (let wy = 0.77; wy <= 2.53; wy += 0.012) {
        if (writeIdx >= TOTAL_POINTS) break;

        const distToMullionV = Math.min(Math.abs(wx), Math.abs(Math.abs(wx) - 0.58));
        const distToMullionH = Math.min(Math.abs(wy - 1.65), Math.abs(Math.abs(wy - 1.65) - 0.44));
        const isBevel = (distToMullionV < 0.035 || distToMullionH < 0.035);

        if (!isBevel) continue;

        const i3 = writeIdx * 3;
        const i4 = writeIdx * 4;

        cityPositions[i3] = wx;
        cityPositions[i3 + 1] = wy;
        cityPositions[i3 + 2] = 1.95;
        roomPositions[i3] = wx;
        roomPositions[i3 + 1] = wy;
        roomPositions[i3 + 2] = 1.95;
        cityColors[i3] = colGlass.r;
        cityColors[i3 + 1] = colGlass.g;
        cityColors[i3 + 2] = colGlass.b;
        roomColors[i3] = colGlass.r;
        roomColors[i3 + 1] = colGlass.g;
        roomColors[i3 + 2] = colGlass.b;

        params[i4] = 20.2;
        params[i4 + 1] = 9.0;
        params[i4 + 2] = rand() * Math.PI * 2;
        params[i4 + 3] = 1.2;
        chunkData[i4] = 0.0;
        chunkData[i4 + 1] = 1.65;
        chunkData[i4 + 2] = 1.95;
        chunkData[i4 + 3] = Math.sqrt(wx * wx + (wy - 1.65) * (wy - 1.65));
        phases[writeIdx] = rand();
        writeIdx++;
      }
    }

    // Fill any remainder
    while (writeIdx < TOTAL_POINTS) {
      const i3 = writeIdx * 3;
      const i4 = writeIdx * 4;

      cityPositions[i3] = 0.0;
      cityPositions[i3 + 1] = -9999.0;
      cityPositions[i3 + 2] = 0.0;

      roomPositions[i3] = 0.0;
      roomPositions[i3 + 1] = -9999.0;
      roomPositions[i3 + 2] = 0.0;

      params[i4] = 999.0;
      params[i4 + 1] = 0.0;
      params[i4 + 2] = 0.0;
      params[i4 + 3] = 0.0;

      phases[writeIdx] = 0.0;
      writeIdx++;
    }

    // Assemble Three.js BufferGeometry
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(cityPositions, 3));
    this.geometry.setAttribute('aRoomPos', new THREE.BufferAttribute(roomPositions, 3));
    this.geometry.setAttribute('aCityCol', new THREE.BufferAttribute(cityColors, 3));
    this.geometry.setAttribute('aRoomCol', new THREE.BufferAttribute(roomColors, 3));
    this.geometry.setAttribute('aParams', new THREE.BufferAttribute(params, 4));
    this.geometry.setAttribute('aChunkData', new THREE.BufferAttribute(chunkData, 4));
    this.geometry.setAttribute('aRoomCentroid', new THREE.BufferAttribute(roomCentroids, 3));
    this.geometry.setAttribute('aStreamAxis', new THREE.BufferAttribute(streamAxes, 3));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  }
}

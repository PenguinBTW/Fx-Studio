// Shared 3D Room Architecture, Props & Kinematics for "Story Room"
// Deterministic Closed-Form Frame = f(t), Zero State Leaks
import * as THREE from 'three';

export interface RoomKinematics {
  getPopScale(objPos: THREE.Vector3, t: number): { scale: THREE.Vector3; isSolid: boolean; popAlpha: number };
  getHeroBookTransform(t: number): { pos: THREE.Vector3; rot: THREE.Euler; openAngle: number };
}

export class StoryRoomGeometry {
  static readonly DESK_CENTER = new THREE.Vector3(0.0, 0.75, 0.0);
  static readonly SHELF_POS = new THREE.Vector3(1.2, 1.6, -1.1);
  static readonly TABLE_REST = new THREE.Vector3(0.12, 0.76, 0.08);

  // Under-damped harmonic pop oscillator (zeta = 0.52, omega = 15 rad/s)
  // Evaluates bouncy squash-and-stretch with volume preservation
  static evalPop(tau: number): { sy: number; sxz: number; alpha: number } {
    if (tau < 0) return { sy: 0.001, sxz: 0.001, alpha: 0.0 };
    if (tau > 1.8) return { sy: 1.0, sxz: 1.0, alpha: 1.0 };
    const zeta = 0.52;
    const omega = 15.0;
    const decay = Math.exp(-zeta * omega * tau);
    const osc = Math.sin(omega * tau);
    // Squash-and-stretch: sy stretches, sxz compresses, oscillating to rest
    const sy = 1.0 + 0.92 * decay * osc;
    const clampedSy = Math.max(0.12, sy);
    const sxz = 1.0 / Math.sqrt(clampedSy);
    const alpha = Math.min(1.0, tau * 4.0);
    return { sy, sxz, alpha };
  }

  // Hero book kinematics:
  // t < 10.0: Resting on Shelf 3
  // t = 10.0..11.0: Slides forward off the shelf with golden dust
  // t = 11.0..13.0: Ballistic 3D tumbling flight across the room
  // t = 13.0..13.8: Cushioned double bounce settling flat on the mahogany desk
  // t >= 13.8: Front cover flings open
  static evalHeroBook(t: number): { pos: THREE.Vector3; rot: THREE.Euler; openAngle: number } {
    const p = new THREE.Vector3();
    const r = new THREE.Euler(0, 0, 0, 'XYZ');
    let openAngle = 0.0;

    const startPos = new THREE.Vector3(0.96, 1.62, -0.96);
    const tablePos = new THREE.Vector3(0.12, 0.836, 0.08);

    if (t < 10.0) {
      // Resting upright on the shelf
      p.copy(startPos);
      r.set(Math.PI / 2, 0.22, 0);
    } else if (t < 11.0) {
      // Sliding forward off the shelf
      const u = (t - 10.0) / 1.0;
      const ease = u * u * (3 - 2 * u);
      p.copy(startPos).add(new THREE.Vector3(-0.22 * ease, -0.06 * ease, 0.44 * ease));
      r.set(Math.PI / 2 - 0.35 * ease, 0.22 + 0.45 * ease, -0.2 * ease);
    } else if (t < 12.7) {
      // Ballistic 3D flight trajectory across room towards desk
      const u = (t - 11.0) / 1.7; // 0..1
      p.x = THREE.MathUtils.lerp(startPos.x - 0.22, tablePos.x, u);
      p.z = THREE.MathUtils.lerp(startPos.z + 0.44, tablePos.z, u);
      // Smooth parabola apex
      p.y = THREE.MathUtils.lerp(startPos.y - 0.06, tablePos.y + 0.22, u) + Math.sin(u * Math.PI) * 0.52;

      // Tumbling rotation straightening out towards table landing
      r.x = THREE.MathUtils.lerp(Math.PI / 2 - 0.35, 0.08, u) + Math.sin(u * Math.PI) * 0.8;
      r.y = THREE.MathUtils.lerp(0.67, 0.12, u) + Math.sin(u * Math.PI) * 1.1;
      r.z = THREE.MathUtils.lerp(-0.2, 0.0, u);
    } else if (t < 13.0) {
      // Cushioned impact bounce on the cutting mat settling flat
      const tau = (t - 12.7) / 0.3; // 0..1
      const bounceDecay = Math.exp(-6.0 * tau);
      const bounceHeight = 0.06 * bounceDecay * Math.sin(tau * Math.PI * 3.0);

      p.copy(tablePos);
      p.y += Math.max(0, bounceHeight);

      const easeRot = tau * tau * (3 - 2 * tau);
      r.x = THREE.MathUtils.lerp(0.18, 0.08, easeRot);
      r.y = THREE.MathUtils.lerp(0.20, 0.12, easeRot);
      r.z = 0.0;
    } else {
      // Settled flat on mahogany desk cutting mat matching rapid_flutter identically
      p.copy(tablePos);
      r.set(0.08, 0.12, 0.0);

      if (t >= 13.8) {
        const uOpen = Math.min(1.0, (t - 13.8) / 0.85);
        openAngle = (uOpen * uOpen * (3 - 2 * uOpen)) * Math.PI * 0.95;
      }
    }

    return { pos: p, rot: r, openAngle };
  }
}

export type PropGeometryType = 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus';

export interface PropDef {
  id: string;
  category: 'desk' | 'chair' | 'shelf' | 'lamp' | 'book' | 'tool' | 'window' | 'room';
  geomType: PropGeometryType;
  geomParams: number[]; // e.g. [w,h,d] for box, [rt, rb, h, segs] for cylinder, etc.
  pos: THREE.Vector3;
  rot: THREE.Euler;
  scale: THREE.Vector3;
  color: THREE.Color;
  roughness: number;
  metalness: number;
  popDelay: number; // Seconds offset into pop wave
  delayOffset?: number;
}

// Builds the rich, detailed 3D room props with genuine architectural geometry
export function buildDetailedRoomProps(): PropDef[] {
  const props: PropDef[] = [];

  // =========================================================================
  // 1. ARCHITECTURAL ROOM & SURFACES
  // =========================================================================
  // Parquet wood floor
  props.push({
    id: 'floor_main',
    category: 'room',
    geomType: 'box',
    geomParams: [7.0, 0.06, 7.0],
    pos: new THREE.Vector3(0, 0, 0),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x281912), // Deep aged oak parquet
    roughness: 0.35,
    metalness: 0.05,
    popDelay: 2.2,
  });

  // Back Wall
  props.push({
    id: 'wall_back',
    category: 'room',
    geomType: 'box',
    geomParams: [7.0, 4.2, 0.12],
    pos: new THREE.Vector3(0, 2.1, -2.8),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x181e28), // Deep architectural slate
    roughness: 0.85,
    metalness: 0.0,
    popDelay: 2.4,
  });

  // Right Wall
  props.push({
    id: 'wall_right',
    category: 'room',
    geomType: 'box',
    geomParams: [0.12, 4.2, 7.0],
    pos: new THREE.Vector3(2.8, 2.1, 0),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x1a212b),
    roughness: 0.85,
    metalness: 0.0,
    popDelay: 2.5,
  });

  // Arched Window Outer Frame
  props.push({
    id: 'window_frame_outer',
    category: 'window',
    geomType: 'box',
    geomParams: [1.8, 2.9, 0.08],
    pos: new THREE.Vector3(-1.8, 2.2, -2.72),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x384152),
    roughness: 0.6,
    metalness: 0.1,
    popDelay: 2.0,
  });

  // Window Sill
  props.push({
    id: 'window_sill',
    category: 'window',
    geomType: 'box',
    geomParams: [2.0, 0.08, 0.22],
    pos: new THREE.Vector3(-1.8, 0.75, -2.66),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x2d3748),
    roughness: 0.4,
    metalness: 0.15,
    popDelay: 1.95,
  });

  // Window Panes Glass (Luminous twilight sky reflection)
  props.push({
    id: 'window_glass',
    category: 'window',
    geomType: 'box',
    geomParams: [1.64, 2.74, 0.02],
    pos: new THREE.Vector3(-1.8, 2.2, -2.71),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x1e3a8a), // Twilight sapphire
    roughness: 0.08,
    metalness: 0.92,
    popDelay: 2.1,
  });

  // Decorative Wall Baseboard Trims
  props.push({
    id: 'baseboard_back',
    category: 'room',
    geomType: 'box',
    geomParams: [7.0, 0.18, 0.06],
    pos: new THREE.Vector3(0, 0.12, -2.72),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x2a1a14),
    roughness: 0.4,
    metalness: 0.1,
    popDelay: 2.3,
  });

  // Patterned Rug under Desk
  props.push({
    id: 'rug_desk',
    category: 'room',
    geomType: 'box',
    geomParams: [2.4, 0.015, 1.8],
    pos: new THREE.Vector3(0, 0.038, 0.1),
    rot: new THREE.Euler(0, 0.05, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x5a2323), // Deep Persian wine red
    roughness: 0.95,
    metalness: 0.0,
    popDelay: 1.6,
  });

  // =========================================================================
  // 2. THE MAIN ARCHITECTURAL DRAFTING DESK
  // =========================================================================
  // Desktop Board (slanted 10 degrees)
  props.push({
    id: 'desk_top',
    category: 'desk',
    geomType: 'box',
    geomParams: [1.9, 0.065, 1.1],
    pos: new THREE.Vector3(0, 0.77, 0),
    rot: new THREE.Euler(0.08, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x3e2014), // Dark polished mahogany
    roughness: 0.25,
    metalness: 0.08,
    popDelay: 0.5,
  });

  // Drafting Green Cutting Mat
  props.push({
    id: 'desk_mat',
    category: 'desk',
    geomType: 'box',
    geomParams: [1.1, 0.01, 0.75],
    pos: new THREE.Vector3(-0.05, 0.806, -0.02),
    rot: new THREE.Euler(0.08, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x1e4a38), // Classic drafting cutting green
    roughness: 0.5,
    metalness: 0.05,
    popDelay: 0.58,
  });

  // Trestle Legs (Four Sturdy Legs + Cross stretchers)
  const legCoords = [
    [-0.84, 0.44],
    [0.84, 0.44],
    [-0.84, -0.44],
    [0.84, -0.44],
  ];
  legCoords.forEach(([lx, lz], i) => {
    props.push({
      id: `desk_leg_${i}`,
      category: 'desk',
      geomType: 'cylinder',
      geomParams: [0.038, 0.045, 0.74, 12],
      pos: new THREE.Vector3(lx, 0.37, lz),
      rot: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(0x23140e),
      roughness: 0.35,
      metalness: 0.1,
      popDelay: 0.45 + i * 0.04,
    });
  });

  // Stretcher Footrest Bar
  props.push({
    id: 'desk_footrest',
    category: 'desk',
    geomType: 'cylinder',
    geomParams: [0.025, 0.025, 1.68, 12],
    pos: new THREE.Vector3(0, 0.18, 0),
    rot: new THREE.Euler(0, 0, Math.PI / 2),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x8a7243), // Polished brass footrest
    roughness: 0.28,
    metalness: 0.85,
    popDelay: 0.6,
  });

  // Architect's Stool (Seat, Screw shaft, Legs, Foot ring)
  props.push({
    id: 'stool_seat',
    category: 'chair',
    geomType: 'cylinder',
    geomParams: [0.22, 0.22, 0.065, 16],
    pos: new THREE.Vector3(0, 0.54, 0.88),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x501a12), // Tufted leather cushion
    roughness: 0.42,
    metalness: 0.1,
    popDelay: 0.8,
  });
  props.push({
    id: 'stool_screw',
    category: 'chair',
    geomType: 'cylinder',
    geomParams: [0.03, 0.03, 0.28, 12],
    pos: new THREE.Vector3(0, 0.38, 0.88),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xd4af37), // Brass screw mechanism
    roughness: 0.3,
    metalness: 0.85,
    popDelay: 0.82,
  });
  props.push({
    id: 'stool_ring',
    category: 'chair',
    geomType: 'torus',
    geomParams: [0.18, 0.015, 8, 24],
    pos: new THREE.Vector3(0, 0.22, 0.88),
    rot: new THREE.Euler(Math.PI / 2, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x8a7243),
    roughness: 0.35,
    metalness: 0.8,
    popDelay: 0.84,
  });

  // =========================================================================
  // 3. ARTICULATED BRASS ANGLEPOISE DESK LAMP
  // =========================================================================
  // Round Weighted Base
  props.push({
    id: 'lamp_base',
    category: 'lamp',
    geomType: 'cylinder',
    geomParams: [0.12, 0.13, 0.04, 16],
    pos: new THREE.Vector3(-0.68, 0.84, -0.32),
    rot: new THREE.Euler(0.08, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xb89738), // Aged brushed brass
    roughness: 0.28,
    metalness: 0.88,
    popDelay: 0.25,
  });

  // Lower Arm Strut 1
  props.push({
    id: 'lamp_arm_lower_a',
    category: 'lamp',
    geomType: 'cylinder',
    geomParams: [0.01, 0.01, 0.44, 8],
    pos: new THREE.Vector3(-0.64, 1.04, -0.24),
    rot: new THREE.Euler(0.35, 0.25, -0.45),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xb89738),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 0.28,
  });

  // Lower Arm Strut 2 (Parallel linkage)
  props.push({
    id: 'lamp_arm_lower_b',
    category: 'lamp',
    geomType: 'cylinder',
    geomParams: [0.01, 0.01, 0.44, 8],
    pos: new THREE.Vector3(-0.66, 1.02, -0.27),
    rot: new THREE.Euler(0.35, 0.25, -0.45),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xb89738),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 0.28,
  });

  // Elbow Joint Hinge
  props.push({
    id: 'lamp_elbow',
    category: 'lamp',
    geomType: 'sphere',
    geomParams: [0.035, 12, 12],
    pos: new THREE.Vector3(-0.52, 1.22, -0.16),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x8a7243),
    roughness: 0.3,
    metalness: 0.85,
    popDelay: 0.3,
  });

  // Upper Arm Strut
  props.push({
    id: 'lamp_arm_upper',
    category: 'lamp',
    geomType: 'cylinder',
    geomParams: [0.012, 0.012, 0.42, 8],
    pos: new THREE.Vector3(-0.42, 1.28, -0.06),
    rot: new THREE.Euler(-0.45, 0.15, 0.55),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xb89738),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 0.32,
  });

  // Bell Lamp Shade (Conical reflector)
  props.push({
    id: 'lamp_shade',
    category: 'lamp',
    geomType: 'cone',
    geomParams: [0.14, 0.18, 16],
    pos: new THREE.Vector3(-0.32, 1.24, 0.04),
    rot: new THREE.Euler(Math.PI * 0.72, 0.25, -0.5),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x1c2430), // Classic matte black & brass interior
    roughness: 0.35,
    metalness: 0.45,
    popDelay: 0.35,
  });

  // Glowing Filament Bulb
  props.push({
    id: 'lamp_bulb',
    category: 'lamp',
    geomType: 'sphere',
    geomParams: [0.04, 12, 12],
    pos: new THREE.Vector3(-0.31, 1.21, 0.05),
    rot: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xfff3d6),
    roughness: 0.1,
    metalness: 0.0,
    popDelay: 0.36,
  });

  // =========================================================================
  // 4. DRAFTING TOOLS & DESK PROPS
  // =========================================================================
  // T-Square Blade
  props.push({
    id: 'tool_tsquare_blade',
    category: 'tool',
    geomType: 'box',
    geomParams: [1.15, 0.015, 0.075],
    pos: new THREE.Vector3(-0.24, 0.812, -0.14),
    rot: new THREE.Euler(0.08, 0.12, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xd4af37), // Polished brass blade
    roughness: 0.22,
    metalness: 0.88,
    popDelay: 0.05,
  });

  // T-Square Cross Head
  props.push({
    id: 'tool_tsquare_head',
    category: 'tool',
    geomType: 'box',
    geomParams: [0.07, 0.026, 0.34],
    pos: new THREE.Vector3(-0.82, 0.812, -0.21),
    rot: new THREE.Euler(0.08, 0.12, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x3e2014), // Walnut head
    roughness: 0.35,
    metalness: 0.2,
    popDelay: 0.06,
  });

  // 30/60 Degree Set Square
  props.push({
    id: 'tool_triangle30',
    category: 'tool',
    geomType: 'box',
    geomParams: [0.32, 0.012, 0.32],
    pos: new THREE.Vector3(0.42, 0.812, 0.16),
    rot: new THREE.Euler(0.08, -0.38, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x38bdf8), // Cyan acrylic draftsman triangle
    roughness: 0.12,
    metalness: 0.05,
    popDelay: 0.08,
  });

  // Drafting Compass (Brass legs & adjustment wheel)
  props.push({
    id: 'tool_compass_leg1',
    category: 'tool',
    geomType: 'cylinder',
    geomParams: [0.007, 0.003, 0.24, 8],
    pos: new THREE.Vector3(0.52, 0.814, -0.16),
    rot: new THREE.Euler(0.08, 0.45, 0.15),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xd4af37),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 0.1,
  });
  props.push({
    id: 'tool_compass_leg2',
    category: 'tool',
    geomType: 'cylinder',
    geomParams: [0.007, 0.003, 0.24, 8],
    pos: new THREE.Vector3(0.55, 0.814, -0.14),
    rot: new THREE.Euler(0.08, 0.45, -0.15),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xd4af37),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 0.1,
  });

  // Ceramic Pencil Cup
  props.push({
    id: 'tool_cup',
    category: 'tool',
    geomType: 'cylinder',
    geomParams: [0.055, 0.05, 0.13, 16],
    pos: new THREE.Vector3(0.68, 0.88, -0.32),
    rot: new THREE.Euler(0.08, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xf1f5f9), // Glazed porcelain
    roughness: 0.2,
    metalness: 0.05,
    popDelay: 0.12,
  });

  // Pencils inside cup
  const pencilColors = [0xef4444, 0x3b82f6, 0xeab308, 0x22c55e, 0xa855f7];
  pencilColors.forEach((col, idx) => {
    props.push({
      id: `tool_pencil_${idx}`,
      category: 'tool',
      geomType: 'cylinder',
      geomParams: [0.006, 0.006, 0.18, 6],
      pos: new THREE.Vector3(0.67 + idx * 0.012 - 0.02, 0.94, -0.32 + (idx % 2) * 0.01),
      rot: new THREE.Euler(0.12 + idx * 0.05, 0.1, -0.15 + idx * 0.06),
      scale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(col),
      roughness: 0.4,
      metalness: 0.0,
      popDelay: 0.14 + idx * 0.02,
    });
  });

  // Glass Inkwell
  props.push({
    id: 'tool_inkwell',
    category: 'tool',
    geomType: 'cylinder',
    geomParams: [0.045, 0.05, 0.065, 8],
    pos: new THREE.Vector3(0.74, 0.84, -0.18),
    rot: new THREE.Euler(0.08, 0.4, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x0f172a), // Dark amber/black glass
    roughness: 0.15,
    metalness: 0.85,
    popDelay: 0.16,
  });

  // Rolled Blueprint Tube
  props.push({
    id: 'tool_blueprint_roll',
    category: 'tool',
    geomType: 'cylinder',
    geomParams: [0.042, 0.042, 0.72, 16],
    pos: new THREE.Vector3(-0.62, 0.835, 0.35),
    rot: new THREE.Euler(0.08, 0.82, Math.PI / 2),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x2563eb), // Technical cyan blueprint roll
    roughness: 0.75,
    metalness: 0.0,
    popDelay: 0.18,
  });

  // =========================================================================
  // 5. MULTI-TIER WOODEN LIBRARY BOOKSHELF & ORNAMENTATION
  // =========================================================================
  const shelfX = 1.35, shelfZ = -1.15;

  // Bookcase Backboard
  props.push({
    id: 'shelf_backboard',
    category: 'shelf',
    geomType: 'box',
    geomParams: [1.15, 2.35, 0.05],
    pos: new THREE.Vector3(shelfX, 1.48, shelfZ - 0.22),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x2d180f),
    roughness: 0.45,
    metalness: 0.05,
    popDelay: 1.1,
  });

  // Left Upright Pilaster
  props.push({
    id: 'shelf_upright_l',
    category: 'shelf',
    geomType: 'box',
    geomParams: [0.065, 2.35, 0.44],
    pos: new THREE.Vector3(shelfX - 0.55, 1.48, shelfZ),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x351d13),
    roughness: 0.4,
    metalness: 0.08,
    popDelay: 1.12,
  });

  // Right Upright Pilaster
  props.push({
    id: 'shelf_upright_r',
    category: 'shelf',
    geomType: 'box',
    geomParams: [0.065, 2.35, 0.44],
    pos: new THREE.Vector3(shelfX + 0.55, 1.48, shelfZ),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x351d13),
    roughness: 0.4,
    metalness: 0.08,
    popDelay: 1.14,
  });

  // Top Cornice Pediment
  props.push({
    id: 'shelf_cornice',
    category: 'shelf',
    geomType: 'box',
    geomParams: [1.25, 0.09, 0.48],
    pos: new THREE.Vector3(shelfX, 2.68, shelfZ),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x3e2014),
    roughness: 0.35,
    metalness: 0.1,
    popDelay: 1.16,
  });

  // 4 Horizontal Shelves
  const shelfHeights = [0.36, 0.95, 1.54, 2.12];
  shelfHeights.forEach((shY, sIdx) => {
    props.push({
      id: `shelf_board_${sIdx}`,
      category: 'shelf',
      geomType: 'box',
      geomParams: [1.14, 0.048, 0.42],
      pos: new THREE.Vector3(shelfX, shY, shelfZ),
      rot: new THREE.Euler(0, -0.22, 0),
      scale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(0x3e2014),
      roughness: 0.38,
      metalness: 0.08,
      popDelay: 1.18 + sIdx * 0.05,
    });
  });

  // Top Shelf (Shelf 3, y=2.12): Vintage Armillary Globe on Stand
  props.push({
    id: 'ornament_globe_stand',
    category: 'shelf',
    geomType: 'cylinder',
    geomParams: [0.07, 0.08, 0.03, 16],
    pos: new THREE.Vector3(shelfX + 0.22, 2.16, shelfZ - 0.02),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0x8a7243),
    roughness: 0.3,
    metalness: 0.85,
    popDelay: 1.45,
  });
  props.push({
    id: 'ornament_globe_ring',
    category: 'shelf',
    geomType: 'torus',
    geomParams: [0.12, 0.012, 8, 24],
    pos: new THREE.Vector3(shelfX + 0.22, 2.32, shelfZ - 0.02),
    rot: new THREE.Euler(0.4, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xd4af37),
    roughness: 0.25,
    metalness: 0.9,
    popDelay: 1.47,
  });

  // Shelf 2 (y=1.54): Geodesic Architectural Study Model
  props.push({
    id: 'model_pavilion_base',
    category: 'shelf',
    geomType: 'box',
    geomParams: [0.22, 0.035, 0.22],
    pos: new THREE.Vector3(shelfX - 0.32, 1.58, shelfZ),
    rot: new THREE.Euler(0, -0.22, 0),
    scale: new THREE.Vector3(1, 1, 1),
    color: new THREE.Color(0xf1f5f9), // White acrylic plinth
    roughness: 0.2,
    metalness: 0.1,
    popDelay: 1.35,
  });

  // =========================================================================
  // 6. ROWS OF JEWEL-TONED HARDCOVER BOOKS
  // =========================================================================
  // Shelf 1 (y=0.95): Dense row of colorful hardcover books
  const shelf1BookColors = [
    0x881337, 0x1e3a8a, 0x14532d, 0x78350f, 0x4c1d95,
    0x0f766e, 0x9a3412, 0x1f2937, 0x831843, 0x1e40af,
  ];
  shelf1BookColors.forEach((bCol, bIdx) => {
    const bW = 0.045 + (bIdx % 3) * 0.012;
    const bH = 0.28 + (bIdx % 4) * 0.035;
    const bD = 0.22;
    const bX = shelfX - 0.42 + bIdx * 0.082;
    props.push({
      id: `book_s1_${bIdx}`,
      category: 'book',
      geomType: 'box',
      geomParams: [bW, bH, bD],
      pos: new THREE.Vector3(bX, 0.97 + bH / 2, shelfZ - 0.02),
      rot: new THREE.Euler(0, -0.22 + (bIdx === 4 ? 0.12 : 0), bIdx === 4 ? -0.1 : 0),
      scale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(bCol),
      roughness: 0.32,
      metalness: 0.15,
      popDelay: 1.25 + bIdx * 0.03,
    });
  });

  // Shelf 2 (y=1.54): Adjacent books next to the Hero Book
  const shelf2BookColors = [0x166534, 0xb45309, 0x1e3a8a, 0x581c87];
  shelf2BookColors.forEach((bCol, bIdx) => {
    const bW = 0.052;
    const bH = 0.32 + (bIdx % 3) * 0.03;
    const bD = 0.24;
    const bX = shelfX + 0.12 + bIdx * 0.078;
    props.push({
      id: `book_s2_${bIdx}`,
      category: 'book',
      geomType: 'box',
      geomParams: [bW, bH, bD],
      pos: new THREE.Vector3(bX, 1.56 + bH / 2, shelfZ - 0.02),
      rot: new THREE.Euler(0, -0.22, 0),
      scale: new THREE.Vector3(1, 1, 1),
      color: new THREE.Color(bCol),
      roughness: 0.3,
      metalness: 0.12,
      popDelay: 1.38 + bIdx * 0.03,
    });
  });

  return props;
}

export const buildRoomProps = buildDetailedRoomProps;


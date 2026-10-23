// =============================================================================
// PROCEDURAL CELESTIAL DRAGON & FLAMING PEARL (MOVEMENT 1: 0.0s - 26.0s)
//
// 90,000-Point Procedural Asian Lung Dragon:
// - Serpentine 3D body with continuous helical traveling wave spine
// - 60,000 Shimmering dragon scales rippling with gold, jade, and amber waves
// - Sculpted head with open jaw, fangs, glowing jade orbits, and antler horns
// - Whisker filaments curling in aerodynamic fluid wake
// - 4 Dragon claws with extended talons paddling through space
// - Flaming Pearl of Wisdom: self-luminous orbiting solar sphere
// - Atmospheric mountain mist clouds
// - Closed-form golden particle supernova dissolution (22.0s - 26.0s)
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

export class DotDragon {
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  basePositions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
  intensities: Float32Array;
  velocities: Float32Array;

  // Metadata per point
  types: Uint8Array; // 0: scales, 1: head/horns, 2: whiskers, 3: claws, 4: pearl, 5: mist
  bodyS: Float32Array; // parameter along dragon spine [0..1]
  ringAngles: Float32Array;
  radii: Float32Array;
  count: number;

  headPos = new THREE.Vector3(0, 1.8, 2.0);
  pearlPos = new THREE.Vector3(0, 1.8, 1.2);

  constructor() {
    const MAX_POINTS = 95000;
    this.positions = new Float32Array(MAX_POINTS * 3);
    this.basePositions = new Float32Array(MAX_POINTS * 3);
    this.colors = new Float32Array(MAX_POINTS * 3);
    this.sizes = new Float32Array(MAX_POINTS);
    this.phases = new Float32Array(MAX_POINTS);
    this.intensities = new Float32Array(MAX_POINTS);
    this.velocities = new Float32Array(MAX_POINTS * 3);
    this.types = new Uint8Array(MAX_POINTS);
    this.bodyS = new Float32Array(MAX_POINTS);
    this.ringAngles = new Float32Array(MAX_POINTS);
    this.radii = new Float32Array(MAX_POINTS);

    let idx = 0;
    const rand = mulberry32(888123);

    const addPt = (
      x: number, y: number, z: number,
      col: THREE.Color,
      size: number,
      intensity: number,
      type: number,
      s = 0,
      ringAngle = 0,
      rad = 0
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

      this.velocities[i3] = (rand() - 0.5) * 2.0;
      this.velocities[i3 + 1] = -1.5 - rand() * 2.5; // downward explosion
      this.velocities[i3 + 2] = (rand() - 0.5) * 2.0;

      this.types[idx] = type;
      this.bodyS[idx] = s;
      this.ringAngles[idx] = ringAngle;
      this.radii[idx] = rad;
      idx++;
    };

    const colGold = LIN.gold;
    const colJade = LIN.dragonJade;
    const colRed = LIN.dragonRed;
    const colAmber = LIN.flameAmber;
    const colWhite = LIN.droneWhite;

    // -------------------------------------------------------------------------
    // 1. SERPENTINE DRAGON BODY SCALES (~55,000 pts)
    // -------------------------------------------------------------------------
    const numRings = 450;
    const ptsPerRing = 120;

    for (let r = 0; r < numRings; r++) {
      const s = r / (numRings - 1); // 0: head, 1: tail tip
      // Taper profile: thick at chest, tapering to razor tail
      const bodyRadius = (s < 0.15) ? (0.12 + (s / 0.15) * 0.18) : (0.30 * Math.pow(1.0 - s, 0.65));

      for (let p = 0; p < ptsPerRing; p++) {
        const theta = (p / ptsPerRing) * Math.PI * 2;
        // Dorsal ridge spine crest at theta ~ 0
        const isDorsalSpine = Math.abs(theta) < 0.25 || Math.abs(theta - Math.PI * 2) < 0.25;
        const rad = bodyRadius * (isDorsalSpine ? 1.45 : (0.92 + 0.08 * Math.sin(theta * 8.0)));

        // Color waves along body: gold belly, jade flank, fiery dorsal crest
        let col = colGold;
        if (isDorsalSpine) {
          col = colAmber;
        } else if (Math.sin(s * 15.0 + theta * 3.0) > 0.2) {
          col = colJade;
        }

        const sz = isDorsalSpine ? 2.8 : (2.0 + rand() * 0.8);
        const inten = isDorsalSpine ? 1.4 : 1.0;

        addPt(0, 0, 0, col, sz, inten, 0, s, theta, rad);
      }
    }

    // -------------------------------------------------------------------------
    // 2. SCULPTED DRAGON HEAD, HORNS & JAWS (~15,000 pts)
    // -------------------------------------------------------------------------
    // Cranium & Snout
    for (let i = 0; i < 6000; i++) {
      const u = rand();
      const v = rand();
      const zSnout = -u * 0.75; // reaches forward
      const wSnout = 0.18 * (1.0 - u * 0.35);
      const hSnout = 0.14 * (1.0 - u * 0.25);
      const ang = v * Math.PI * 2;

      const x = wSnout * Math.cos(ang);
      const y = hSnout * Math.sin(ang);

      const isTeeth = (u > 0.65 && Math.abs(Math.sin(ang)) < 0.3);
      const col = isTeeth ? colWhite : (rand() > 0.5 ? colGold : colRed);
      addPt(x, y, zSnout, col, isTeeth ? 2.5 : 2.0, isTeeth ? 1.4 : 1.1, 1, 0, ang, 0.15);
    }

    // Antler Horns (Branching white/gold antlers)
    for (let side of [-1, 1]) {
      for (let branch = 0; branch < 3; branch++) {
        for (let i = 0; i < 900; i++) {
          const t = i / 899;
          const hx = side * (0.12 + t * (0.35 + branch * 0.15));
          const hy = 0.15 + t * (0.55 + branch * 0.10);
          const hz = -0.10 + t * 0.25 - branch * 0.12;

          const r = 0.018 * (1.0 - t * 0.7);
          const a = rand() * Math.PI * 2;
          addPt(hx + r * Math.cos(a), hy + r * Math.sin(a), hz, colWhite, 2.4, 1.35, 1, 0, a, 0.2);
        }
      }

      // Glowing Jade Eyes
      for (let i = 0; i < 400; i++) {
        const a = rand() * Math.PI * 2;
        const r = 0.035 * Math.sqrt(rand());
        const ex = side * 0.11 + r * Math.cos(a);
        const ey = 0.08 + r * Math.sin(a);
        const ez = -0.28;
        addPt(ex, ey, ez, colJade, 3.2, 1.8, 1, 0, 0, 0);
      }
    }

    // -------------------------------------------------------------------------
    // 3. WHISKER FILAMENTS & STREAMERS (~6,000 pts)
    // -------------------------------------------------------------------------
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3000; i++) {
        const u = i / 2999;
        const wx = side * (0.08 + u * 0.65);
        const wy = -0.05 - u * 0.35;
        const wz = -0.65 - u * 1.8;
        const r = 0.008 * (1.0 - u * 0.5);
        const a = rand() * Math.PI * 2;
        addPt(wx + r * Math.cos(a), wy + r * Math.sin(a), wz, colAmber, 2.2, 1.3, 2, 0, u * 10, u);
      }
    }

    // -------------------------------------------------------------------------
    // 4. FOUR CLAWED LEGS (~8,000 pts)
    // -------------------------------------------------------------------------
    const legSpineS = [0.18, 0.24, 0.55, 0.62];
    for (const ls of legSpineS) {
      for (let side of [-1, 1]) {
        for (let i = 0; i < 1000; i++) {
          const t = i / 999;
          const lx = side * (0.25 + t * 0.35);
          const ly = -t * 0.45;
          const lz = (t < 0.7 ? t * 0.2 : (0.7 * 0.2 + (t - 0.7) * 0.4)); // talons reach forward
          const r = 0.025 * (1.0 - t * 0.4);
          const a = rand() * Math.PI * 2;
          addPt(lx + r * Math.cos(a), ly + r * Math.sin(a), lz, colGold, 2.2, 1.1, 3, ls, a, 0);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. THE FLAMING PEARL OF WISDOM (~5,000 pts)
    // -------------------------------------------------------------------------
    for (let i = 0; i < 5000; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.16 * Math.cbrt(rand());

      const px = r * Math.sin(phi) * Math.cos(theta);
      const py = r * Math.cos(phi);
      const pz = r * Math.sin(phi) * Math.sin(theta);

      const isCore = r < 0.08;
      const col = isCore ? colWhite : (rand() > 0.4 ? colGold : colRed);
      addPt(px, py, pz, col, isCore ? 3.4 : 2.4, isCore ? 1.8 : 1.3, 4, 0, 0, 0);
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
   * Closed-form spine curve position at parameter s in [0, 1] at time t
   */
  getSpinePoint(s: number, t: number, out: THREE.Vector3): void {
    // Serpentine 3D trajectory weaving through space
    const flightSpeed = 1.4;
    const waveT = t * flightSpeed - s * 7.5;

    // Helical wave kinematics
    const x = Math.sin(waveT) * (1.8 + 0.4 * Math.sin(s * 4.0)) + Math.sin(t * 0.4) * 1.5;
    const y = Math.cos(waveT * 0.8) * 1.2 + 1.8 + Math.sin(t * 0.3) * 0.6;
    const z = 2.0 - s * 16.0 + Math.cos(waveT * 0.6) * 1.4;

    out.set(x, y, z);
  }

  /**
   * Spine tangent / forward orientation
   */
  getSpineTangent(s: number, t: number, out: THREE.Vector3): void {
    const ds = 0.02;
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    this.getSpinePoint(Math.max(0, s - ds), t, p0);
    this.getSpinePoint(Math.min(1, s + ds), t, p1);
    out.subVectors(p0, p1).normalize();
  }

  /**
   * Evaluates closed-form dragon motion at time t
   */
  update(t: number): void {
    const pos = this.positions;
    const base = this.basePositions;
    const vel = this.velocities;
    const types = this.types;
    const bodyS = this.bodyS;
    const ringAngles = this.ringAngles;
    const radii = this.radii;
    const n = this.count;

    // Dissolution supernova at end of movement (22.0s - 26.0s)
    const dissolve = prog(t, 22.0, 26.0, ease.inQuad);

    // Spine cache vectors
    const spineP = new THREE.Vector3();
    const spineT = new THREE.Vector3();
    const upV = new THREE.Vector3(0, 1, 0);
    const normalV = new THREE.Vector3();
    const binormalV = new THREE.Vector3();

    // Head base position & orientation
    const headT = new THREE.Vector3();
    const headNormal = new THREE.Vector3();
    const headBinormal = new THREE.Vector3();
    this.getSpinePoint(0.0, t, this.headPos);
    this.getSpineTangent(0.0, t, headT);
    headNormal.crossVectors(headT, upV).normalize();
    headBinormal.crossVectors(headNormal, headT).normalize();

    // Flaming Pearl darts ahead of the dragon head
    const pearlLead = 1.6 + 0.4 * Math.sin(t * 3.5);
    this.pearlPos.copy(this.headPos).addScaledVector(headT, pearlLead);
    this.pearlPos.x += 0.35 * Math.sin(t * 4.2);
    this.pearlPos.y += 0.25 * Math.cos(t * 3.8);

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const type = types[i]!;

      // -----------------------------------------------------------------------
      // EXPLOSION DISSOLUTION (22.0s - 26.0s)
      // -----------------------------------------------------------------------
      if (dissolve > 0.001) {
        const dt = dissolve;
        const dt2 = dt * dt;
        const vx = vel[i3]!;
        const vy = vel[i3 + 1]!;
        const vz = vel[i3 + 2]!;

        pos[i3] += vx * dt * 4.5;
        pos[i3 + 1] += vy * dt * 5.0 - dt2 * 6.0; // gravity plunge
        pos[i3 + 2] += vz * dt * 4.5;
        continue;
      }

      // -----------------------------------------------------------------------
      // 0. BODY SCALES: WRAPPED AROUND SPINE SPLINE
      // -----------------------------------------------------------------------
      if (type === 0) {
        const s = bodyS[i]!;
        const theta = ringAngles[i]!;
        const r = radii[i]!;

        this.getSpinePoint(s, t, spineP);
        this.getSpineTangent(s, t, spineT);
        normalV.crossVectors(spineT, upV).normalize();
        binormalV.crossVectors(normalV, spineT).normalize();

        // Position on circumferential ring around spine
        const px = spineP.x + r * (normalV.x * Math.cos(theta) + binormalV.x * Math.sin(theta));
        const py = spineP.y + r * (normalV.y * Math.cos(theta) + binormalV.y * Math.sin(theta));
        const pz = spineP.z + r * (normalV.z * Math.cos(theta) + binormalV.z * Math.sin(theta));

        pos[i3] = px;
        pos[i3 + 1] = py;
        pos[i3 + 2] = pz;
        continue;
      }

      // -----------------------------------------------------------------------
      // 1. HEAD & HORNS
      // -----------------------------------------------------------------------
      if (type === 1) {
        const bx = base[i3]!;
        const by = base[i3 + 1]!;
        const bz = base[i3 + 2]!;

        // Transform local head space into world coordinates along head tangent
        const wx = this.headPos.x + bx * headNormal.x + by * headBinormal.x + bz * headT.x;
        const wy = this.headPos.y + bx * headNormal.y + by * headBinormal.y + bz * headT.y;
        const wz = this.headPos.z + bx * headNormal.z + by * headBinormal.z + bz * headT.z;

        pos[i3] = wx;
        pos[i3 + 1] = wy;
        pos[i3 + 2] = wz;
        continue;
      }

      // -----------------------------------------------------------------------
      // 2. WHISKER FILAMENTS: FLUID CURLING WAKE
      // -----------------------------------------------------------------------
      if (type === 2) {
        const bx = base[i3]!;
        const by = base[i3 + 1]!;
        const bz = base[i3 + 2]!;
        const u = radii[i]!; // whisker parameter

        // Trailing undulating wave behind snout
        const waveX = 0.15 * Math.sin(t * 5.0 - u * 8.0) * u;
        const waveY = 0.12 * Math.cos(t * 4.2 - u * 7.0) * u;

        const wx = this.headPos.x + (bx + waveX) * headNormal.x + (by + waveY) * headBinormal.x + bz * headT.x;
        const wy = this.headPos.y + (bx + waveX) * headNormal.y + (by + waveY) * headBinormal.y + bz * headT.y;
        const wz = this.headPos.z + (bx + waveX) * headNormal.z + (by + waveY) * headBinormal.z + bz * headT.z;

        pos[i3] = wx;
        pos[i3 + 1] = wy;
        pos[i3 + 2] = wz;
        continue;
      }

      // -----------------------------------------------------------------------
      // 3. CLAWS
      // -----------------------------------------------------------------------
      if (type === 3) {
        const s = bodyS[i]!;
        const bx = base[i3]!;
        const by = base[i3 + 1]!;
        const bz = base[i3 + 2]!;

        this.getSpinePoint(s, t, spineP);
        this.getSpineTangent(s, t, spineT);
        normalV.crossVectors(spineT, upV).normalize();
        binormalV.crossVectors(normalV, spineT).normalize();

        // Paddle stroke kinematics
        const paddleWave = Math.sin(t * 3.0 - s * 6.0) * 0.15;

        pos[i3] = spineP.x + bx * normalV.x + (by + paddleWave) * binormalV.x + bz * spineT.x;
        pos[i3 + 1] = spineP.y + bx * normalV.y + (by + paddleWave) * binormalV.y + bz * spineT.y;
        pos[i3 + 2] = spineP.z + bx * normalV.z + (by + paddleWave) * binormalV.z + bz * spineT.z;
        continue;
      }

      // -----------------------------------------------------------------------
      // 4. THE FLAMING PEARL
      // -----------------------------------------------------------------------
      if (type === 4) {
        const bx = base[i3]!;
        const by = base[i3 + 1]!;
        const bz = base[i3 + 2]!;

        // Swirling flame turbulence around pearl
        const flameSpin = t * 6.0;
        const fx = bx * Math.cos(flameSpin) - bz * Math.sin(flameSpin);
        const fz = bx * Math.sin(flameSpin) + bz * Math.cos(flameSpin);

        pos[i3] = this.pearlPos.x + fx;
        pos[i3 + 1] = this.pearlPos.y + by;
        pos[i3 + 2] = this.pearlPos.z + fz;
        continue;
      }
    }

    this.geometry.attributes.position!.needsUpdate = true;
  }
}

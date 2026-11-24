// Salt-grain field for the Chladni plate. All positions are closed-form in t:
// each grain has a seeded scatter point and a precomputed target on each mode's
// nodal lines; during a step it hops (perpendicular jitter keyed to frameIdx)
// from the previous figure to the next.

import * as THREE from 'three';
import { clamp, ease, frameIdx, hash, lerp, mulberry32 } from '../../engine/util';
import { HEX } from '../../engine/palette';
import { MODES, nodalPoints } from './nodal';

/** Seconds when the drive steps to the next mode. */
export const STEP_TIMES = [3.5, 9.0, 15.0];
/** Grain migration duration after each step. */
export const MIGRATE = 1.9;
/** Plate half-size (m); plate is square in the XZ plane centred on origin. */
export const PLATE_HALF = 0.15;
const GRAIN_COUNT = 5200;
const GRAIN_Y = 0.0008; // resting height above plate surface (plate top y = 0)

export class GrainField {
  readonly mesh: THREE.InstancedMesh;
  private count = GRAIN_COUNT;
  /** Per-grain resting scatter position (x, z) before the first step. */
  private scatter = new Float32Array(this.count * 2);
  /** Per-mode target positions (x, z) for every grain. */
  private targets: Float32Array[] = [];
  private rot = new Float32Array(this.count * 3);
  private scl = new Float32Array(this.count);
  private dummy = new THREE.Object3D();

  constructor() {
    const rng = mulberry32(90210);
    const geo = new THREE.OctahedronGeometry(0.0012);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(HEX.bone),
      roughness: 0.92,
      metalness: 0.05,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    for (let i = 0; i < this.count; i++) {
      // Scatter: uniform on the plate with a soft pull toward the middle.
      const x = (rng() * 2 - 1) * PLATE_HALF * 0.94;
      const z = (rng() * 2 - 1) * PLATE_HALF * 0.94;
      this.scatter[i * 2] = x;
      this.scatter[i * 2 + 1] = z;
      this.rot[i * 3] = rng() * Math.PI * 2;
      this.rot[i * 3 + 1] = rng() * Math.PI * 2;
      this.rot[i * 3 + 2] = rng() * Math.PI * 2;
      this.scl[i] = 0.7 + rng() * 0.8;
    }

    for (const mode of MODES) {
      const pts = nodalPoints(mode);
      const nPts = pts.length / 2;
      const t = new Float32Array(this.count * 2);
      for (let i = 0; i < this.count; i++) {
        // Even coverage along the nodal point cloud + seeded jitter.
        const idx = Math.min(nPts - 1, Math.floor(((i * 2654435761) >>> 0) / 4294967296 * nPts + hash(i, mode.m * 31 + mode.n) * 4));
        const px = pts[idx * 2]! - 0.5;
        const py = pts[idx * 2 + 1]! - 0.5;
        const jx = (hash(i, 11 + mode.m) - 0.5) * 0.004;
        const jz = (hash(i, 23 + mode.n) - 0.5) * 0.004;
        t[i * 2] = px * PLATE_HALF * 2 + jx;
        t[i * 2 + 1] = py * PLATE_HALF * 2 + jz;
      }
      this.targets.push(t);
    }
  }

  /** Writes instance matrices for time t. Closed-form; safe to scrub. */
  update(t: number): void {
    const fi = frameIdx(t);
    // Which step segment are we in? k = index of last step already started.
    let k = -1;
    for (let s = 0; s < STEP_TIMES.length; s++) if (t >= STEP_TIMES[s]!) k = s;
    const src = k <= 0 ? this.scatter : this.targets[k - 1]!;
    const dst = k < 0 ? this.scatter : this.targets[k]!;
    const u = k < 0 ? 1 : clamp((t - STEP_TIMES[k]!) / MIGRATE);
    const eu = ease.inOutCubic(u);
    const migrating = u < 1;
    const settle = ease.outCubic(u);

    for (let i = 0; i < this.count; i++) {
      const sx = src[i * 2]!, sz = src[i * 2 + 1]!;
      const dx = dst[i * 2]!, dz = dst[i * 2 + 1]!;
      let x = lerp(sx, dx, eu);
      let z = lerp(sz, dz, eu);
      let y = GRAIN_Y;

      if (migrating) {
        // Hop: grains lift and jitter while the plate re-sorts them.
        const hop = Math.sin(Math.PI * u) * (0.006 + 0.014 * hash(i, k + 7));
        y += hop;
        const jamp = 0.004 * Math.sin(Math.PI * u);
        x += (hash(fi, i, 3) - 0.5) * 2 * jamp;
        z += (hash(fi, i, 5) - 0.5) * 2 * jamp;
      } else if (k >= 0) {
        // Settled: nodal lines are still — only a whisper of tremor remains.
        const tr = 0.00035 * (1 - settle * 0.6);
        x += (hash(fi, i, 17) - 0.5) * 2 * tr;
        z += (hash(fi, i, 19) - 0.5) * 2 * tr;
      }

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(this.rot[i * 3]!, this.rot[i * 3 + 1]!, this.rot[i * 3 + 2]!);
      this.dummy.scale.setScalar(this.scl[i]!);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

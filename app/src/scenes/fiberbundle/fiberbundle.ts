// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
//
// fiberbundle — a macro view of ~40 fiber-optic strands running left→right
// with a gentle catenary sag. Light pulses travel each strand as bright heads
// with exponential tails; per-strand phase offsets cascade the pulses across
// the bundle in waves. Strands glow faintly where a pulse passes (closed-form
// proximity), and each strand's right end blooms as its pulse exits. One
// middle strand carries the single warm pulse. All motion is f(t) — pulse
// position = seed + t, no accumulators, no Math.random.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20.0;
const N_STRANDS = 40;
const SEG = 56;            // vertices per strand
const PULSES = 2;          // pulses in flight per strand
const L = 24;              // half-length of the bundle (x in [-L, L])
const WARM_STRAND = 19;    // the one warm pulse threads the middle strand
const COOL = new THREE.Color('#b9c9dc');
const WARM = new THREE.Color('#e8a05a');

interface StrandDef {
  y0: number;            // rest height at the ends
  z: number;
  sag: number;
  period: number;        // seconds per pulse transit
  phase: number;         // cascade offset
  dim: number;           // per-strand brightness variation
  col: THREE.Color;
}

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function strandDef(i: number): StrandDef {
  const warm = i === WARM_STRAND;
  const col = warm ? WARM.clone() : COOL.clone().multiplyScalar(0.85 + 0.3 * hash(i, 6));
  return {
    // The bundle fans out slightly: middle strands sit near y=0, outer ones
    // drift up/down and sag a touch more.
    y0: -5.2 + 10.4 * (i / (N_STRANDS - 1)) + (hash(i, 1) - 0.5) * 0.5,
    z: (hash(i, 2) - 0.5) * 3.6,
    sag: 1.1 + 2.1 * hash(i, 3) + Math.abs(i - WARM_STRAND) * 0.045,
    period: 6.8 + 2.6 * hash(i, 4),
    phase: -i * 0.62 + hash(i, 5) * 0.8, // cascade sweeps the bundle like a wave
    dim: 0.7 + 0.5 * hash(i, 7),
    col,
  };
}

// x positions of the pulses on strand i at local time lt.
function pulseXs(s: StrandDef, lt: number, out: number[]): void {
  for (let j = 0; j < PULSES; j++) {
    const u = ((lt + s.phase + (j * s.period) / PULSES) % s.period + s.period) % s.period;
    out[j] = -L + (u / s.period) * 2 * L;
  }
}

const _pulses = new Array<number>(PULSES).fill(0);

export default class FiberBundleScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private strands: StrandDef[] = [];
  private strandGeos: THREE.BufferGeometry[] = [];
  private strandMats: THREE.LineBasicMaterial[] = [];
  private headGeo: THREE.BufferGeometry;
  private headPoints: THREE.Points;
  private headMat: THREE.PointsMaterial;
  private endGeo: THREE.BufferGeometry;
  private endPoints: THREE.Points;
  private endMat: THREE.PointsMaterial;
  private glowGeo: THREE.PlaneGeometry;
  private glowMat: THREE.MeshBasicMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, ctx.W / ctx.H, 0.1, 400);

    const headPos = new Float32Array(N_STRANDS * PULSES * 3);
    const headCol = new Float32Array(N_STRANDS * PULSES * 3);

    for (let i = 0; i < N_STRANDS; i++) {
      const s = strandDef(i);
      this.strands.push(s);

      const g = new THREE.BufferGeometry();
      const pos = new Float32Array((SEG + 1) * 3);
      const col = new Float32Array((SEG + 1) * 3);
      for (let k = 0; k <= SEG; k++) {
        const x = -L + (2 * L * k) / SEG;
        pos[k * 3 + 0] = x;
        pos[k * 3 + 1] = s.y0 - s.sag * (1 - (x / L) * (x / L));
        pos[k * 3 + 2] = s.z;
        const base = 0.1 * s.dim; // faint rest glow — strands must read in the dark
        col[k * 3 + 0] = s.col.r * base;
        col[k * 3 + 1] = s.col.g * base;
        col[k * 3 + 2] = s.col.b * base;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(g, mat);
      line.frustumCulled = false; // vertex colors animate; positions are static
      this.threeScene.add(line);
      this.strandGeos.push(g);
      this.strandMats.push(mat);

      for (let j = 0; j < PULSES; j++) {
        const h = (i * PULSES + j) * 3;
        headCol[h + 0] = s.col.r * 1.6;
        headCol[h + 1] = s.col.g * 1.6;
        headCol[h + 2] = s.col.b * 1.6;
      }
    }

    // Pulse heads — bright moving dots.
    this.headGeo = new THREE.BufferGeometry();
    this.headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
    this.headGeo.setAttribute('color', new THREE.BufferAttribute(headCol, 3));
    this.headMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.headPoints = new THREE.Points(this.headGeo, this.headMat);
    this.headPoints.frustumCulled = false;
    this.threeScene.add(this.headPoints);

    // Right-end bloom points — one per strand, flare as a pulse exits.
    const endPos = new Float32Array(N_STRANDS * 3);
    const endCol = new Float32Array(N_STRANDS * 3);
    for (let i = 0; i < N_STRANDS; i++) {
      const s = this.strands[i]!;
      endPos[i * 3 + 0] = L + 0.6;
      endPos[i * 3 + 1] = s.y0; // no sag at the anchor end
      endPos[i * 3 + 2] = s.z;
    }
    this.endGeo = new THREE.BufferGeometry();
    this.endGeo.setAttribute('position', new THREE.BufferAttribute(endPos, 3));
    this.endGeo.setAttribute('color', new THREE.BufferAttribute(endCol, 3));
    this.endMat = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.endPoints = new THREE.Points(this.endGeo, this.endMat);
    this.endPoints.frustumCulled = false;
    this.threeScene.add(this.endPoints);

    // Faint cool wash behind the bundle so the field isn't pure black.
    this.glowGeo = new THREE.PlaneGeometry(110, 44, 1, 8);
    const gp = this.glowGeo.getAttribute('position') as THREE.BufferAttribute;
    const gc = new Float32Array(gp.count * 3);
    for (let v = 0; v < gp.count; v++) {
      const wgt = Math.pow(1 - Math.abs(gp.getY(v)) / 22, 2.4) * 0.07;
      gc[v * 3 + 0] = COOL.r * wgt;
      gc[v * 3 + 1] = COOL.g * wgt;
      gc[v * 3 + 2] = COOL.b * wgt;
    }
    this.glowGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    this.glowMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    glow.position.set(0, -1, -7);
    this.threeScene.add(glow);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);

    // Framing: bundle spans x∈[-26,26], y∈[-9,7] around lookAt(0,-1).
    const halfHfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(10 / Math.tan(halfHfov), 27 / (Math.tan(halfHfov) * this.camera.aspect));
    this.camera.position.set(
      Math.sin(lt * 0.07) * 2.1,          // slow lateral drift
      0.7 + Math.sin(lt * 0.05) * 0.45,
      dist * (1.1 - 0.1 * u),              // very slow push-in — stays wide enough to keep the strand ends on screen
    );
    this.camera.lookAt(0, -1, 0);
    const far = Math.max(300, dist + 60);
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    const hp = this.headGeo.getAttribute('position') as THREE.BufferAttribute;
    const ec = this.endGeo.getAttribute('color') as THREE.BufferAttribute;

    for (let i = 0; i < N_STRANDS; i++) {
      const s = this.strands[i]!;
      pulseXs(s, lt, _pulses);

      // Strand glow: head halo ahead of each pulse + exponential tail behind.
      const cp = this.strandGeos[i]!.getAttribute('color') as THREE.BufferAttribute;
      for (let k = 0; k <= SEG; k++) {
        const x = -L + (2 * L * k) / SEG;
        let g = 0.1;
        for (const xp of _pulses) {
          const d = x - xp;
          g += d > 0 ? Math.exp(-d / 0.45) : Math.exp(d / 1.7);
        }
        const w = Math.min(1.6, g) * s.dim;
        cp.setXYZ(k, s.col.r * w, s.col.g * w, s.col.b * w);
      }
      cp.needsUpdate = true;

      // Heads + exit blooms.
      let bloom = 0;
      for (let j = 0; j < PULSES; j++) {
        const xp = _pulses[j]!;
        const y = s.y0 - s.sag * (1 - (xp / L) * (xp / L));
        hp.setXYZ(i * PULSES + j, xp, y, s.z);
        const dEnd = (xp - L) / 0.9;
        bloom = Math.max(bloom, Math.exp(-(dEnd * dEnd))); // flare at the right edge
      }
      ec.setXYZ(i, s.col.r * bloom * 2.2, s.col.g * bloom * 2.2, s.col.b * bloom * 2.2);
    }
    hp.needsUpdate = true;
    ec.needsUpdate = true;

    // Frame tremor: deterministic high-frequency flicker on the pulse
    // heads so transits don't read as single-curve motion.
    const frameIdx = Math.floor(lt * 60);
    this.headMat.size = 0.22 * (1 + 0.14 * (hash(frameIdx, 7) - 0.5));

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.38,
      bloomThreshold: 0.45,
      vignette: 0.32 + 0.05 * Math.sin(lt * 0.3), // slow "focus pull" breath
      grain: 0.012,
      exposure: 1.02,
    };
  }

  override dispose(): void {
    for (let i = 0; i < N_STRANDS; i++) {
      this.strandGeos[i]!.dispose();
      this.strandMats[i]!.dispose();
    }
    this.headGeo.dispose();
    this.headMat.dispose();
    this.endGeo.dispose();
    this.endMat.dispose();
    this.glowGeo.dispose();
    this.glowMat.dispose();
  }
}

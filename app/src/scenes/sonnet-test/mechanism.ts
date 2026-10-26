// X-ray cross-section of the door interior (Beat 1) and its un-building into the Interlock
// glyph "G" (Beat 2). World units are metres; the mechanism spans x in [-0.16, 0.16].
// The geometry is laid out so that it lines up with the glyph: input ring at x=-0.12, output
// square at x=+0.12, the gap at the centre.
import * as THREE from 'three';
import { LineBatch } from '../../engine/lines';
import { clamp, lerp, smoothstep, ease, prog } from '../../engine/util';
import { wireSolidMaterial, withBary } from './materials';
import { GLOW, LIN, mul } from './palette';
import { MARKERS, MU, dissolveFront, mechCamera, type Cam } from './timing';
import { emitPulse, flareAt, pulseHead, type PulseSpec } from './pulse_sparks';

const D = 0.012; // part depth (m)
const ASH: [number, number, number] = mul(LIN.ash, 0.8);

export const PULLS = [
  { t0: MARKERS.PULL_1, amp: 0.62, rise: 0.34, travel: 0.52, sparks: 34, seed: 11 },
  { t0: MARKERS.PULL_2, amp: 0.82, rise: 0.26, travel: 0.42, sparks: 46, seed: 23 },
  { t0: MARKERS.PULL_3, amp: 1.0, rise: 0.19, travel: 0.34, sparks: 58, seed: 37 },
];

export const ROD_X0 = -0.088;
export const ROD_TIP0 = -0.047;
export const ROD_SLIDE = 0.0105;
export const LATCH_FACE = 0.036;
export const GAP_L = ROD_TIP0 + ROD_SLIDE;

/** 0..1 handle pull at time t (quick rise, slower return). */
export function pullAt(t: number): number {
  let v = 0;
  for (const p of PULLS) {
    const a = t - p.t0;
    if (a < 0 || a > p.rise + 0.9) continue;
    const up = ease.outCubic(clamp(a / p.rise));
    const dn = 1 - ease.inOutCubic(clamp((a - p.rise - 0.12) / 0.7));
    v = Math.max(v, p.amp * up * dn);
  }
  return v;
}

export function pulseSpecs(): PulseSpec[] {
  return PULLS.map((p) => ({
    t0: p.t0 + 0.04,
    travel: p.travel,
    from: [-0.094, 0.0, 0.0] as [number, number, number],
    to: [ROD_TIP0 + ROD_SLIDE * p.amp, 0.0, 0.0] as [number, number, number],
    sparks: p.sparks,
    seed: p.seed,
  }));
}

function box(w: number, h: number, d = D): THREE.BufferGeometry { return withBary(new THREE.BoxGeometry(w, h, d)); }

function rounded(hx: number, hy: number, r: number, d = D): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hy); s.lineTo(hx - r, -hy); s.absarc(hx - r, -hy + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hx, hy - r); s.absarc(hx - r, hy - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hx + r, hy); s.absarc(-hx + r, hy - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hx, -hy + r); s.absarc(-hx + r, -hy + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -d / 2);
  return withBary(g);
}

export class Mechanism {
  group = new THREE.Group();
  mats: ReturnType<typeof wireSolidMaterial>[] = [];
  private handle = new THREE.Group();
  private rod: THREE.Mesh;
  private pawl = new THREE.Group();
  private latch: THREE.Mesh;
  private ctxLines: Float32Array;
  private pulses = pulseSpecs();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.003, 2);

  /** Dedicated batches: crisp context lines (max) and hot pulse/sparks/glyph (add). */
  ink = new LineBatch(9000, { blend: 'max', screen2D: false });
  glow = new LineBatch(6000, { blend: 'add', screen2D: false });

  constructor() {
    const mat = (o: Parameters<typeof wireSolidMaterial>[0] = {}) => { const m = wireSolidMaterial(o); this.mats.push(m); return m; };

    // handle: pivot disc at the input ring position + lever arm
    const hub = new THREE.Mesh(withBary(new THREE.CylinderGeometry(0.009, 0.009, D, 20).rotateX(Math.PI / 2)), mat());
    this.handle.add(hub);
    const arm = new THREE.Mesh(rounded(0.0035, 0.034, 0.0028), mat());
    arm.position.set(0.0, 0.034, 0);
    this.handle.add(arm);
    const grip = new THREE.Mesh(rounded(0.0085, 0.0075, 0.004), mat());
    grip.position.set(0, 0.07, 0);
    this.handle.add(grip);
    this.handle.position.set(-0.12, -0.014, 0);
    this.group.add(this.handle);

    // connecting rod (slides along x on a track)
    this.rod = new THREE.Mesh(box(ROD_TIP0 - ROD_X0 + 0.004, 0.0045), mat());
    this.group.add(this.rod);
    const track = new THREE.Mesh(box(0.06, 0.0012, 0.004), mat({ solid: 0.4 }));
    track.position.set(-0.07, -0.0042, 0);
    this.group.add(track);

    // pawl: pivots about its lower end, rotated away from the rod's path
    const pawlBody = new THREE.Mesh(rounded(0.004, 0.017, 0.0025), mat());
    pawlBody.position.set(0, 0.017, 0);
    this.pawl.add(pawlBody);
    const pivot = new THREE.Mesh(withBary(new THREE.CylinderGeometry(0.0052, 0.0052, D * 1.2, 16).rotateX(Math.PI / 2)), mat());
    this.pawl.add(pivot);
    this.pawl.position.set(0.0, -0.018, 0);
    this.pawl.rotation.z = -Math.PI * 0.43;
    this.group.add(this.pawl);

    // latch block + the stub that feeds it
    this.latch = new THREE.Mesh(rounded(0.0235, 0.0235, 0.004, D * 1.5), mat());
    this.latch.position.set(0.12 + 0.0, 0, 0);
    this.group.add(this.latch);
    const stub = new THREE.Mesh(box(LATCH_FACE * 0 + 0.056, 0.0045), mat());
    stub.position.set(0.0625, 0, 0);
    this.group.add(stub);
    const striker = new THREE.Mesh(box(0.012, 0.0036, D * 1.2), mat());
    striker.position.set(0.12, 0.0, 0);
    this.group.add(striker);

    this.ctxLines = this.buildContext();
  }

  /** Faint --ash wireframe for the rest of the door: sill, glass frame, panel seams, bolt circles. */
  private buildContext(): Float32Array {
    const L: number[] = [];
    const add = (a: number[], b: number[]) => {
      const n = Math.max(1, Math.ceil(Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!) / 0.04));
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        L.push(lerp(a[0]!, b[0]!, u0), lerp(a[1]!, b[1]!, u0), lerp(a[2]!, b[2]!, u0), lerp(a[0]!, b[0]!, u1), lerp(a[1]!, b[1]!, u1), lerp(a[2]!, b[2]!, u1));
      }
    };
    const z0 = -0.012, z1 = 0.012;
    for (const z of [z0, z1]) {
      for (const y of [-0.075, -0.045, 0.045, 0.075]) add([-0.5, y, z], [0.5, y, z]);
      add([-0.5, -0.19, z], [0.5, -0.19, z]); add([-0.5, 0.19, z], [0.5, 0.19, z]);
      add([-0.5, -0.19, z], [-0.5, 0.19, z]); add([0.5, -0.19, z], [0.5, 0.19, z]);
      add([-0.5, -0.1, z], [0.5, -0.1, z]); add([-0.5, 0.12, z], [0.5, 0.12, z]);
    }
    for (let i = -8; i <= 8; i++) { add([i * 0.04, -0.09, z0], [i * 0.04, 0.09, z0]); add([i * 0.04, -0.09, z1], [i * 0.04, 0.09, z1]); }
    for (let i = -10; i <= 10; i++) add([i * 0.05, 0.12, z0], [i * 0.05 + 0.015, 0.19, z0]);
    for (const cx of [-0.19, 0.19]) for (let i = 0; i < 20; i++) {
      const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
      add([cx + Math.cos(a0) * 0.011, 0.075 + Math.sin(a0) * 0.011, z0], [cx + Math.cos(a1) * 0.011, 0.075 + Math.sin(a1) * 0.011, z0]);
    }
    return new Float32Array(L);
  }

  camera(t: number): { cam: THREE.PerspectiveCamera; spec: Cam } {
    const spec = mechCamera(t);
    this.cam.fov = spec.fov; this.cam.near = spec.near; this.cam.far = spec.far;
    this.cam.position.set(...spec.pos);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(...spec.target);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    return { cam: this.cam, spec };
  }

  /** Pose everything for time t. Returns what the scene needs for post (flare, focus point). */
  update(t: number): { flare: number; focus: THREE.Vector3; pull: number } {
    const pull = pullAt(t);
    this.handle.rotation.z = -pull * 0.42;
    const slide = ROD_SLIDE * pull;
    const rodLen = ROD_TIP0 - ROD_X0 + 0.004;
    this.rod.position.set(ROD_X0 - 0.002 + rodLen / 2 + slide, 0, 0);
    // the pawl is rotated away at rest; it jitters slightly with each pull but never reaches the rod
    this.pawl.rotation.z = -Math.PI * 0.43 - pull * 0.06;

    const front = dissolveFront(t);
    for (const m of this.mats) m.uniforms.uFront!.value = t < 20 ? 10 : front;
    const dimGlobal = smoothstep(16, 20, t) * 0.0;
    for (const m of this.mats) m.uniforms.uDim!.value = dimGlobal;

    let flare = 0;
    for (const p of this.pulses) flare = Math.max(flare, flareAt(t, p));
    // the rod mesh (3D solid) tints toward red only at its severed tip: handled by gap lines below
    const focus = new THREE.Vector3(-0.07 + slide, 0, 0);
    let head = null as ReturnType<typeof pulseHead>;
    for (const p of this.pulses) head = head ?? pulseHead(t, p);
    if (head) focus.set(head[0], head[1], head[2]);
    else if (t > 15) focus.set(-0.005, 0, 0);
    return { flare, focus, pull };
  }

  /** Emit context, gap glow, pulses, sparks and the (re)drawn glyph line art. */
  emit(t: number, spec: Cam): void {
    this.ink.clear(); this.glow.clear();
    const front = t < 20 ? 10 : dissolveFront(t);
    const dissolveP = prog(t, 20, 26.4);

    // --ash context wireframe, dissolving first for t >= 20 (fades with the same front)
    const a = ASH;
    const ctxAlpha = t < 20 ? 0.42 : 0.42 * (1 - smoothstep(0, 1, prog(t, 21, 24.5)));
    if (ctxAlpha > 0.003) {
      for (let i = 0; i < this.ctxLines.length; i += 6) {
        const x = this.ctxLines[i]!;
        const k = t < 20 ? 1 : 1 - smoothstep(front - 0.4, front + 0.05, x) * 0 - smoothstep(front + 0.02, front - 0.35, x) * 0;
        this.ink.seg(x, this.ctxLines[i + 1]!, this.ctxLines[i + 2]!, this.ctxLines[i + 3]!, this.ctxLines[i + 4]!, this.ctxLines[i + 5]!, 1.1, a[0], a[1], a[2], ctxAlpha * k);
      }
    }

    // the gap: a thin steady red glow between rod tip and latch (the severed connection)
    const pull = pullAt(t);
    const gapL = ROD_TIP0 + ROD_SLIDE * pull + 0.002;
    const red = GLOW.signal;
    const gapA = t < 8.4 ? 0 : smoothstep(9.0, 10.0, t) * (1 - smoothstep(24.5, 26.0, t));
    if (gapA > 0.01) {
      const breath = 0.88 + 0.12 * Math.sin(t * 2.2);
      this.glow.seg(gapL, 0, 0, LATCH_FACE - 0.002, 0, 0, 2.0, red[0], red[1], red[2], 0.5 * gapA * breath);
      this.glow.seg(gapL, -0.0045, 0, gapL, 0.0045, 0, 2.0, red[0], red[1], red[2], 0.9 * gapA);
      this.glow.seg(LATCH_FACE, -0.0045, 0, LATCH_FACE, 0.0045, 0, 2.0, red[0], red[1], red[2], 0.9 * gapA);
    }

    for (const p of this.pulses) emitPulse(this.glow, t, p, 1 - smoothstep(19, 20, t) * 0);

    // glyph line art: flat 2D line work that resolves in behind the dissolve front
    if (t >= 20) this.emitGlyph(t, front, dissolveP);
  }

  private emitGlyph(t: number, front: number, dissolveP: number): void {
    const bone = GLOW.bone, red = GLOW.signal;
    const wAt = (x: number) => smoothstep(front - 0.05, front + 0.01, x);
    const seg = (ax: number, ay: number, bx: number, by: number, col: number[], w: number, al: number, batch = this.ink) => {
      const mx = (ax + bx) / 2; const k = wAt(mx) * al;
      if (k > 0.002) batch.seg(ax, ay, 0, bx, by, 0, w, col[0]!, col[1]!, col[2]!, k);
    };
    const S = MU;
    const lw = 2.0;
    const ring = (cx: number, cy: number, r: number) => {
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
        seg(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, bone, lw, 1);
      }
    };
    ring(-0.8 * S, 0, 0.2 * S);
    const sq = 0.2 * S, cx = 0.8 * S;
    seg(cx - sq, -sq, cx + sq, -sq, bone, lw, 1); seg(cx + sq, -sq, cx + sq, sq, bone, lw, 1);
    seg(cx + sq, sq, cx - sq, sq, bone, lw, 1); seg(cx - sq, sq, cx - sq, -sq, bone, lw, 1);
    seg(-0.6 * S, 0, -0.233 * S, 0, bone, lw, 1);
    seg(0.233 * S, 0, 0.6 * S, 0, bone, lw, 1);
    // gap ticks and the red blocker bar (the pawl, upright)
    const gk = smoothstep(22, 26, t);
    seg(-0.233 * S, -0.07 * S, -0.233 * S, 0.07 * S, red, 2.2, 0.8, this.glow);
    seg(0.233 * S, -0.07 * S, 0.233 * S, 0.07 * S, red, 2.2, 0.8, this.glow);
    const bw = 0.035 * S, bh = 0.30 * S;
    seg(-bw, -bh, -bw, bh, red, 2.4, 1, this.glow); seg(bw, -bh, bw, bh, red, 2.4, 1, this.glow);
    seg(-bw, bh, bw, bh, red, 2.4, 1, this.glow); seg(-bw, -bh, bw, -bh, red, 2.4, 1, this.glow);
    void gk;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, out: THREE.WebGLRenderTarget, t: number): { flare: number; focus: THREE.Vector3; cam: THREE.PerspectiveCamera; pull: number } {
    const { cam, spec } = this.camera(t);
    const info = this.update(t);
    this.emit(t, spec);
    renderer.setRenderTarget(out);
    renderer.render(scene, cam);
    renderer.resetState();
    this.ink.render(renderer, out, cam, 1);
    this.glow.render(renderer, out, cam, 1);
    return { ...info, cam };
  }
}

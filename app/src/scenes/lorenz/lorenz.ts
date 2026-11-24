// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// lorenz: a glowing filament winds out the classic Lorenz attractor
// (σ=10, ρ=28, β=8/3) — the two-lobe butterfly emerges as the trace hops
// between wings. Determinism: the whole trajectory is RK4-integrated ONCE at
// init into a Float32Array (fixed dt, fixed start state); every frame reads
// it as an interpolated lookup of f(t) — seeking to t shows the state at t,
// no accumulators, no Math.random.
// Palette: near-black field, bone-white head fading to black at the tail,
// one warm accent tinting the trail on whichever lobe currently holds the
// head — the only colour event. Camera: slow orbital drift, gentle push-in.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { RibbonGeometry } from '../../engine/ribbon';
import { GLSL_COMMON } from '../../engine/glsl/common';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- closed-form trajectory --------------------------------------------------
// RK4 on dx=σ(y−x), dy=x(ρ−z)−y, dz=xy−βz at fixed dt — precomputed once.
const DT = 0.005;                 // attractor seconds per integration step
const STEPS = 22000;              // 110 attractor-seconds of trajectory
                                  // (head index = start + t·RATE/DT < STEPS)
// pick the longest single-lobe dwell in the trajectory and set the playback
// rate so the first lobe-hop lands at scene t≈9 (see chooseAnchor below)
let RATE = 3.0;                   // attractor seconds per scene second
const WINDOW = 4200;              // trail length in steps (~21 attr-s ≈ 2-3 hops)
const SEGS = 480;                 // ribbon resample segments

const SIG = 10, RHO = 28, BET = 8 / 3;

function integrateLorenz(): Float32Array {
  const out = new Float32Array(STEPS * 3);
  // fixed start state — deterministic by construction
  let x = 0.96, y = -1.10, z = 25.5;
  const f = (px: number, py: number, pz: number): [number, number, number] =>
    [SIG * (py - px), px * (RHO - pz) - py, px * py - BET * pz];
  for (let i = 0; i < STEPS; i++) {
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    const [a1, b1, c1] = f(x, y, z);
    const [a2, b2, c2] = f(x + a1 * DT / 2, y + b1 * DT / 2, z + c1 * DT / 2);
    const [a3, b3, c3] = f(x + a2 * DT / 2, y + b2 * DT / 2, z + c2 * DT / 2);
    const [a4, b4, c4] = f(x + a3 * DT, y + b3 * DT, z + c3 * DT);
    x += DT * (a1 + 2 * a2 + 2 * a3 + a4) / 6;
    y += DT * (b1 + 2 * b2 + 2 * b3 + b4) / 6;
    z += DT * (c1 + 2 * c2 + 2 * c3 + c4) / 6;
  }
  return out;
}

// Anchor (once, at init): find x-sign crossings (lobe hops), take the
// LONGEST dwell between consecutive hops, start just after its entry
// crossing so the take opens with a long single-lobe spiral, and set RATE so
// the closing hop lands at scene t≈9. Everything downstream is a lookup.
function chooseAnchor(traj: Float32Array): { start: number; rate: number } {
  const crossings: number[] = [];
  for (let i = 1; i < STEPS; i++) {
    if (traj[(i - 1) * 3] * traj[i * 3] < 0) crossings.push(i);
  }
  let best = 1200, bestLen = 0; // fallback: modest single-lobe stretch
  for (let k = 1; k < crossings.length; k++) {
    const len = crossings[k] - crossings[k - 1];
    if (len > bestLen && crossings[k - 1] > 300) { bestLen = len; best = crossings[k - 1] + 100; }
  }
  if (bestLen <= 0) return { start: best, rate: RATE };
  // dwell (in attractor seconds) ends ~t=9 → rate = dwell / 9
  const dwell = (bestLen - 100) * DT;
  const rate = dwell / 9.0;
  return { start: best, rate };
}

// --- trail shader ------------------------------------------------------------
// vertex uv.y = s along the ribbon (0 tail → 1 head); uv.x = across width.
// World-space position drives the lobe accent: a faint warm tint on the lobe
// the head is currently inside — the single colour event.
// ShaderMaterial vertex shaders get THREE's attribute/matrix prelude
// automatically — only the body is ours.
const TRAIL_VERT = `out vec2 vUv; out vec3 vW;
void main() {
  vUv = uv; vW = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TRAIL_FRAG = `${GLSL_COMMON}
in vec2 vUv; in vec3 vW; out vec4 fragColor;
uniform float uHeadSide;   // sign of the head's lobe x (-1/+1)
uniform float uGlow;       // global intensity
void main() {
  float s = vUv.y;
  float side = 1.0 - smoothstep(0.0, 1.0, abs(vUv.x - 0.5) * 2.0); // soft ribbon edges
  float fade = pow(s, 1.7);                                 // tail → black
  float lobe = smoothstep(2.0, 8.0, vW.x * uHeadSide);      // warm on head's lobe
  vec3 bone = vec3(0.96, 0.94, 0.88);
  vec3 warm = vec3(0.98, 0.72, 0.42);
  vec3 col = mix(bone, warm, lobe * 0.5);
  col *= (0.3 + 0.7 * fade) * side * uGlow;
  fragColor = vec4(col, 1.0);
}`;

// faint cool haze disc behind the attractor so the black isn't flat
const HAZE_FRAG = `${GLSL_COMMON}
in vec2 vUv; out vec4 fragColor;
void main() {
  float d = distance(vUv, vec2(0.5));
  float h = exp(-d * d * 9.0);
  fragColor = vec4(vec3(0.16, 0.22, 0.34) * h * 0.12, 1.0);
}`;
const HAZE_VERT = `out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export default class LorenzScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private traj = integrateLorenz();
  private anchor = chooseAnchor(this.traj);
  private startIdx = this.anchor.start;
  private ribbonGeo: RibbonGeometry;
  private headGeo = new THREE.SphereGeometry(0.55, 24, 16);
  private headMat: THREE.ShaderMaterial;
  private trailMat: THREE.ShaderMaterial;
  private hazeMat: THREE.ShaderMaterial;

  // Lorenz (x,y,z) → world: centre the attractor at origin, xz plane ≈ screen.
  private world(i: number, out: [number, number, number]): [number, number, number] {
    out[0] = this.traj[i * 3] * 1.15;                    // lobe spread ±23
    out[1] = (this.traj[i * 3 + 2] - 27.0) * 1.15;       // height, centred
    out[2] = this.traj[i * 3 + 1] * 1.15;                // depth
    return out;
  }

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);

    // trail: a Bishop-framed ribbon; spine samples the precomputed window —
    // spine(t, s): s=0 tail → s=1 head, index lookup of f(t)
    const spine = (t: number, s: number) => {
      const headF = this.startIdx + t * (this.anchor.rate / DT);
      // tail pinned at the scene's start index — the trail grows out of one
      // lobe; pre-start attractor history (which already contains hops) is
      // never shown, so early take reads as a single-lobe spiral. The
      // s-domain spans only the filled part of the window so every ribbon
      // segment maps onto real trajectory instead of piling onto the tail.
      const used = Math.min(WINDOW, Math.max(0, headF - this.startIdx));
      return this.sample(headF - (1 - s) * used, [0, 0, 0]);
    };
    // width tapers: thick bright head, hairline tail
    const width = (s: number) => 0.08 + 0.38 * Math.pow(s, 2.0);
    this.ribbonGeo = new RibbonGeometry({ spine, width, segments: SEGS, time: 0 });
    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: { uHeadSide: { value: 1 }, uGlow: { value: 1.9 } },
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const trail = new THREE.Mesh(this.ribbonGeo, this.trailMat);
    this.three.add(trail);

    // head: small emissive bead riding the trace tip
    this.headMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: { uHeadSide: { value: 1 }, uGlow: { value: 2.6 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const head = new THREE.Mesh(this.headGeo, this.headMat);
    head.name = 'lorenz-head';
    this.three.add(head);
    this.head = head;

    // haze disc far behind, facing the orbital camera roughly
    this.hazeMat = new THREE.ShaderMaterial({
      vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), this.hazeMat);
    haze.position.set(0, 0, -34);
    this.three.add(haze);
  }

  private head: THREE.Mesh;
  private tmp: [number, number, number] = [0, 0, 0];

  // interpolated trajectory lookup — shared by the spine and the bead so
  // both ride the exact same f(t), not whole-sample snaps of it
  private sample(idx: number, out: [number, number, number]): [number, number, number] {
    const i0 = Math.max(0, Math.min(STEPS - 1, Math.floor(idx)));
    const i1 = Math.min(STEPS - 1, i0 + 1);
    const fr = clamp01(idx - i0);
    const a: [number, number, number] = [0, 0, 0];
    const b: [number, number, number] = [0, 0, 0];
    this.world(i0, a); this.world(i1, b);
    out[0] = a[0] + (b[0] - a[0]) * fr;
    out[1] = a[1] + (b[1] - a[1]) * fr;
    out[2] = a[2] + (b[2] - a[2]) * fr;
    return out;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;

    // head index — pure lookup of f(t)
    const headF = Math.min(STEPS - 1, this.startIdx + t * (this.anchor.rate / DT));
    const hx = this.traj[Math.max(0, Math.min(STEPS - 1, Math.round(headF))) * 3]; // lobe side for the warm accent

    // grow the trail in: during the first ~1.5s the window is still short —
    // spine handles it via clamping (tail pins at trajectory start).
    this.ribbonGeo.updateFromTime(t);

    this.sample(headF, this.tmp);
    this.head.position.set(this.tmp[0], this.tmp[1], this.tmp[2]);
    const side = hx >= 0 ? 1 : -1;
    this.trailMat.uniforms.uHeadSide!.value = side;
    this.headMat.uniforms.uHeadSide!.value = side;
    // gentle global swell so the filament breathes with the take
    this.trailMat.uniforms.uGlow!.value = 1.9 + 0.3 * Math.sin(t * 0.6);

    // slow orbital camera with a mild push-in and height drift — closed-form
    const aspect = out.width / out.height;
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
    const ang = -0.55 + t * 0.10 + 0.25 * Math.sin(t * 0.05);
    const rad = 88 - 16 * smooth(4, 19, t);
    const ph = 0.42 + 0.18 * Math.sin(t * 0.07 + 1.2);
    this.cam.position.set(
      Math.sin(ang) * rad,
      Math.sin(ph) * rad * 0.55 + 6,
      Math.cos(ang) * rad * 0.9
    );
    this.cam.lookAt(0, 1.5, 0);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.three, this.cam);
    rr.resetState();

    return {
      exposure: 0.28,
      bloom: 0.8,
      bloomThreshold: 0.35,
      bloomRadius: 0.75,
      ca: 0.0,
      grain: 0.045,
      vignette: 0.45,
      fade: 0.0,
      toneMap: 'agx',
    };
  }

  override dispose(): void {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as { material?: THREE.Material }).material;
      if (mat) mat.dispose();
    });
  }
}

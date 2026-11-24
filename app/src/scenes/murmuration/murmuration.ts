// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// murmuration — a starling murmuration at dusk over a twilight field. ~1600
// dark tick-birds ride a slowly-morphing analytic attractor: a scattered cloud
// gathers into a trefoil-knot torus, splits into two lobes and rejoins, then
// streams as a dense ribbon down into the treeline. Every position is a
// closed-form f(t): each bird's slot on the attractor plus a sum-of-sines
// wander — no accumulators, no Math.random at render (seeds are golden-ratio
// hashes of the index). Birds are velocity-aligned instanced ticks, near-black
// against an amber→indigo sky shader with a near-black treeline silhouette.
// Camera: slow pan tracking the flock centre with a slight push-in.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const TAU = Math.PI * 2;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), u);
}
float fbm(float x) {
  return vnoise(x) * 0.55 + vnoise(x * 2.7 + 13.7) * 0.30 + vnoise(x * 7.1 + 41.3) * 0.15;
}

void main() {
  // vUv.y 0 = bottom of the backdrop plane (the field), 1 = top of the sky.
  float y = vUv.y;
  vec3 amber  = vec3(0.55, 0.22, 0.06);
  vec3 rose   = vec3(0.32, 0.10, 0.16);
  vec3 indigo = vec3(0.05, 0.06, 0.16);
  vec3 col = mix(amber, rose, smoothstep(0.30, 0.55, y));
  col = mix(col, indigo, smoothstep(0.45, 0.92, y));
  // fading band of last light right above the horizon
  col += vec3(0.35, 0.14, 0.03) * exp(-(y - 0.34) * (y - 0.34) * 90.0) * (0.7 + 0.3 * sin(uT * 0.03));

  // near-black treeline silhouette: a jagged fbm horizon with a second
  // nearer, darker band.
  float treelineFar  = 0.315 + 0.030 * fbm(vUv.x * 14.0);
  float treelineNear = 0.285 + 0.045 * fbm(vUv.x * 9.0 + 57.0);
  float trees = 1.0 - smoothstep(treelineFar - 0.004, treelineFar + 0.004, y);
  float treesNear = 1.0 - smoothstep(treelineNear - 0.004, treelineNear + 0.004, y);
  col = mix(col, vec3(0.012, 0.012, 0.020), trees * 0.92);
  col = mix(col, vec3(0.006, 0.006, 0.010), treesNear * 0.97);
  // field below the trees: faint cool reflection of the sky
  col = mix(col, vec3(0.020, 0.018, 0.026), smoothstep(treelineFar, 0.0, y) * 0.55);

  // faint high stars pricking through the dusk
  vec2 sg = floor(vUv * vec2(220.0, 120.0));
  float star = step(0.9975, hash1(sg.x * 61.7 + sg.y * 389.1));
  col += vec3(0.9) * star * smoothstep(0.55, 0.9, y) * 0.35;

  fragColor = vec4(col, 1.0);
}`;

const BIRDS = 1600;

export default class MurmurationScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };
  private birds: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private ax = new THREE.Vector3();
  private ay = new THREE.Vector3();
  private az = new THREE.Vector3();
  private p0 = new THREE.Vector3();
  private p1 = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 200),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    sky.position.set(0, 26, -80);
    this.three.add(sky);

    // tick-shaped instanced birds, near-black; slight per-bird tone variation
    const geo = new THREE.BoxGeometry(0.55, 0.07, 0.07);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.birds = new THREE.InstancedMesh(geo, mat, BIRDS);
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < BIRDS; i++) {
      const v = 0.018 + 0.02 * frac(i * 0.754877);
      this.birds.setColorAt(i, c.setRGB(v, v * 0.95, v * 1.15));
    }
    this.birds.instanceColor!.needsUpdate = true;
    this.three.add(this.birds);
  }

  // Closed-form bird position: attractor slot + sum-of-sines wander.
  private birdPos(i: number, t: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);          // attractor slot
    const v = frac(i * 0.7548776662);          // secondary seed
    const w = frac(i * 0.5698402909);          // wander seed
    const group = i % 2 === 0 ? 1 : -1;        // split parity

    // slow flock-centre drift
    const cx = 3.0 * Math.sin(t * 0.11) + 1.5 * Math.sin(t * 0.043 + 2.0);
    const cy = 7.6 + 1.1 * Math.sin(t * 0.07 + 1.0) - 3.4 * smooth(15.5, 18.5, t);
    const cz = -2.0 + 1.6 * Math.sin(t * 0.09 + 2.0);

    // --- attractor shapes -------------------------------------------------
    // trefoil-knot torus (the mid-take organism)
    const psi = TAU * u + t * (0.42 + 0.22 * v);
    const R = 4.4 + 0.5 * Math.sin(2.0 * psi + t * 0.35);
    const r = 1.05 + 0.55 * w;
    const kx = (R + r * Math.cos(3 * psi)) * Math.cos(2 * psi);
    const ky = r * Math.sin(3 * psi) * 0.85;
    const kz = (R + r * Math.cos(3 * psi)) * Math.sin(2 * psi) * 0.72;

    // blob: slow-turning ellipsoid (the rejoin mass)
    const th = TAU * v + t * 0.18;
    const ph = Math.acos(1 - 2 * u) - Math.PI / 2;
    const bx = 4.6 * Math.cos(ph) * Math.cos(th);
    const by = 2.7 * Math.sin(ph);
    const bz = 3.4 * Math.cos(ph) * Math.sin(th);

    // ribbon: descending stream that dives into the treeline (y→-8)
    const a = frac(u + t * 0.028);
    const rx = -11 + 20 * a + 0.9 * Math.sin(a * 7 + t * 0.4 + w * 4.0);
    const ry = 9.0 - 17.0 * Math.pow(a, 1.15) + 0.5 * Math.sin(a * 11 + v * 8.0);
    const rz = -1.5 + 1.2 * Math.sin(a * 5 + w * 9.0);

    // --- phase weights ----------------------------------------------------
    const wKnot = smooth(4.5, 7.5, t) * (1 - smooth(11.8, 13.4, t));
    const wBlob = smooth(12.2, 13.8, t) * (1 - smooth(15.2, 16.4, t));
    const wRib = smooth(15.8, 17.2, t);
    const gather = smooth(2.0, 7.0, t);

    // scattered start: wide random cloud that coalesces
    const sx = (v - 0.5) * 22 + Math.sin(u * 40.0) * 3.0;
    const sy = 6.5 + (w - 0.5) * 9.0;
    const sz = (frac(i * 0.913) - 0.5) * 14.0;

    // split & rejoin around t≈14: offset both attractor shapes
    const split = (smooth(12.0, 13.4, t) - smooth(14.6, 15.8, t)) * 3.1 * group;

    let px = (cx + kx) * wKnot + (cx + bx + split) * wBlob + rx * wRib;
    let py = (cy + ky) * wKnot + (cy + by) * wBlob + ry * wRib;
    let pz = (cz + kz) * wKnot + (cz + bz) * wBlob + rz * wRib;
    // when no shape weight dominates, fall back to a loose shell of the knot
    const shell = 1 - Math.max(wKnot, Math.max(wBlob, wRib));
    px += shell * (cx + kx * 1.15);
    py += shell * (cy + ky * 1.15 + 0.8);
    pz += shell * (cz + kz * 1.15);

    // gather: interpolate scattered → massed
    px = sx + (px - sx) * gather;
    py = sy + (py - sy) * gather;
    pz = sz + (pz - sz) * gather;

    // sum-of-sines wander: loose before gather, tight shimmer inside the mass
    const wAmp = 2.6 - 2.1 * gather;
    out.set(
      px + wAmp * (0.6 * Math.sin(t * (0.9 + v) + w * TAU) + 0.4 * Math.sin(t * (1.7 + w) + u * TAU)),
      py + wAmp * (0.5 * Math.sin(t * (1.1 + w) + u * TAU) + 0.3 * Math.sin(t * (2.1 + u) + v * TAU)),
      pz + wAmp * (0.6 * Math.sin(t * (0.8 + u) + v * TAU) + 0.4 * Math.sin(t * (1.4 + v) + w * TAU)),
    );
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // flock centre for the camera to track (closed-form, same as birdPos)
    const cx = 3.0 * Math.sin(t * 0.11) + 1.5 * Math.sin(t * 0.043 + 2.0);
    const cy = 7.6 + 1.1 * Math.sin(t * 0.07 + 1.0) - 3.4 * smooth(15.5, 18.5, t);

    for (let i = 0; i < BIRDS; i++) {
      this.birdPos(i, t, this.p0);
      this.birdPos(i, t + 0.033, this.p1);
      // tick axis = velocity direction
      this.ax.subVectors(this.p1, this.p0);
      if (this.ax.lengthSq() < 1e-8) this.ax.set(1, 0, 0); else this.ax.normalize();
      this.ay.set(0, 1, 0).cross(this.ax).normalize();
      this.az.crossVectors(this.ax, this.ay);
      this.m.makeBasis(this.ax, this.ay, this.az).setPosition(this.p0);
      this.birds.setMatrixAt(i, this.m);
    }
    this.birds.instanceMatrix.needsUpdate = true;

    // slow pan tracking the flock + slight push-in
    const push = smooth(0, this.ctx.end, t);
    this.cam.position.set(
      cx * 0.55 + 0.8 * Math.sin(t * 0.031),
      7.8 - 1.4 * push,
      21.0 - 3.4 * push,
    );
    this.cam.lookAt(cx * 0.9, cy * 0.96, -2.0);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.55,
      bloom: 0.25,
      bloomThreshold: 0.55,
      bloomRadius: 0.7,
      ca: 0.15,
      grain: 0.07,
      vignette: 0.55,
      level: smooth(0, 0.9, t) * (1 - smooth(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

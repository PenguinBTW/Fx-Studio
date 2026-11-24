// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// vortex — a dust-and-debris funnel over a dark plain at dusk.
// Backdrop shader: storm-sky gradient, a low warm sun smear behind the
// funnel's left limb, faint green-blue storm light high up (cold accent),
// and the funnel itself — an analytic tube silhouette whose ragged fbm
// edge advects faster where it is narrow, so it reads as rotating.
// ~1500 instanced dust motes orbit the axis on closed-form spirals
// (radius widens with height, angular speed rises where the funnel is
// narrow — integrated in closed form, no accumulators); ~70 brighter
// debris seeds are flung off the top rim on ballistic arcs at the
// t≈14 beat. Camera: slow orbit-drift + push-in. Everything is f(t).
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { orbitPosition } from '../../engine/rig';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;
// the mesh is built larger than the design region so off-axis camera
// framings never reach its edge; FRAG remaps vUv back into design space
const BKG_SX = 1.7, BKG_SY = 1.9;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
#define BKG_SX ${BKG_SX.toFixed(2)}
#define BKG_SY ${BKG_SY.toFixed(2)}
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), u);
}
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
             mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  // remap so an oversized backdrop keeps the design region centered —
  // the camera never sees past the plane's edge
  float x = (vUv.x - 0.5) * BKG_SX + 0.5;
  float y = (vUv.y - 0.5) * BKG_SY + 0.5;
  float t = uT;

  // funnel narrative envelopes — grow-in by ~t3, slight dissolution by ~t19
  float form = smoothstep(0.6, 2.8, t);
  float dissolve = 1.0 - 0.45 * smoothstep(16.5, 19.5, t);

  // --- storm sky ----------------------------------------------------------
  vec3 col = mix(vec3(0.010, 0.010, 0.014), vec3(0.026, 0.024, 0.032), smoothstep(0.36, 0.62, y));
  col = mix(col, vec3(0.042, 0.038, 0.052), smoothstep(0.62, 0.95, y));
  // rolling scud — large slow noise bands, subtle
  col *= 1.0 + 0.18 * (n2(vec2(x * 4.0 - t * 0.10, y * 7.0)) - 0.5) * smoothstep(0.45, 0.75, y);

  // cold accent — faint green-blue storm light high in the sky
  vec2 cd = vec2((x - 0.60) * 2.0, y - 0.85);
  col += vec3(0.10, 0.24, 0.26) * exp(-dot(cd, cd) * 2.6) * 0.55;

  // --- low warm sun smear behind the funnel's left limb -------------------
  vec2 sd = vec2((x - 0.38) * 2.6, y - 0.43);
  col += vec3(0.34, 0.17, 0.07) * exp(-dot(sd, sd) * 10.0) * (0.45 + 0.20 * form);

  // --- dark plain ---------------------------------------------------------
  float ground = 1.0 - smoothstep(0.375, 0.388, y);
  col = mix(col, vec3(0.018, 0.016, 0.019) * (0.8 + 0.4 * vnoise(x * 30.0)), ground * 0.97);
  // horizon haze band
  float hq = (y - 0.385) * 30.0;
  col += vec3(0.07, 0.06, 0.065) * exp(-hq * hq) * 0.35;

  // --- the funnel -----------------------------------------------------------
  // analytic tube: base pinned just above the horizon, ragged edges advected
  // faster where the tube is narrow so the silhouette reads as spinning
  float fy = clamp((y - 0.398) / 0.55, 0.0, 1.2);
  float ftop = 0.398 + 0.55 * form;
  float fr = 0.016 + 0.048 * pow(max(fy, 0.0), 1.30);
  float sw = 1.0 + 4.0 * (1.0 - fy);                     // faster churn near the narrow base
  float edge = (vnoise(y * 7.0 - t * sw * 2.0 + 3.0) * 0.65
              + vnoise(y * 17.0 + 11.0 - t * sw * 1.3) * 0.35 - 0.5)
             * (0.006 + 0.020 * fy);
  float dx = x - 0.5;
  float d = abs(dx) - (fr + edge);
  float inside = (1.0 - smoothstep(0.0, 0.004, d))
               * step(0.396, y) * step(y, ftop + edge * 2.0);
  // body: dust-grey, churn streaks scrolling across, warm-lit left limb
  // churn streaks scroll horizontally across the tube (rotation cue)
  float churn = 0.6 * n2(vec2(dx * 90.0 - t * sw * 4.0, y * 5.0))
              + 0.4 * n2(vec2(dx * 40.0 - t * sw * 2.2, y * 2.5));
  vec3 fcol = vec3(0.048, 0.041, 0.038) * (0.55 + 0.8 * churn);
  float lq = max(0.0, d + 0.003) * 30.0;
  float limb = exp(-lq * lq);
  fcol += vec3(0.50, 0.31, 0.15) * limb * (1.0 - smoothstep(-0.018, 0.012, dx)) * (0.55 + 0.45 * churn);
  fcol += vec3(0.03, 0.027, 0.030) * (1.0 - smoothstep(-0.015, 0.015, -dx)); // right side darker still
  col = mix(col, fcol, inside * 0.95 * dissolve);
  // dust cap where the funnel widens aloft
  float cq1 = (x - 0.5) * 14.0, cq2 = (y - ftop) * 26.0;
  float cap = exp(-(cq1 * cq1 + cq2 * cq2));
  col += vec3(0.09, 0.077, 0.065) * cap * 0.4 * form * dissolve;

  // --- kicked-up ground dust around the base --------------------------------
  vec2 gd = vec2(dx * 2.6, (y - 0.405) * 9.0);
  float dust = exp(-dot(gd, gd) * 7.0) * (0.5 + 0.5 * vnoise(x * 46.0 - t * 2.2));
  col += vec3(0.11, 0.09, 0.07) * dust * (0.35 + 0.5 * form) * dissolve;

  fragColor = vec4(col, 1.0);
}`;

// Dust mote instance shader: soft disc, lit on the sun side via aLit.
const MOTE_VERT = /* glsl */ `
out vec2 vUv;
out vec3 vTint;
out float vLit;
attribute vec3 aTint;
attribute float aLit;
void main() {
  vUv = uv;
  vTint = aTint;
  vLit = aLit;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const MOTE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vTint;
in float vLit;
out vec4 fragColor;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float body = 1.0 - smoothstep(0.55, 1.0, d);
  if (body < 0.01) discard;
  vec3 col = vTint * (0.55 + 0.75 * vLit);
  fragColor = vec4(col, body * 0.8);
}`;

const DUST = 1500;
const DEBRIS = 70;
// Funnel axis in world space — in front of the backdrop so orbiting motes
// on the far side stay in front of the plane (max orbit radius ~17).
const AX = 0, AZ = -58, Y_BASE = -4, Y_TOP = 52;

// Spiral angular velocity rises where the funnel is narrow:
//   ω(h) = a + b·(1−h),  h(t) = frac(h0 + v·t)
// θ(t) = θ0 + (a+b)·t − (b/v)·(F(h0+v·t) − F(h0)),  F(u) = floor(u)/2 + frac(u)²/2
const WA = 0.75, WB = 2.3;
const intFrac = (u: number) => Math.floor(u) / 2 + frac(u) * frac(u) / 2;

// Funnel radius profile (world units) — narrow throat, wide crown.
const funnelR = (h: number) => 2.4 + 13.0 * Math.pow(h, 1.3);

// Narrative envelopes shared with the shader timing.
const formEnv = (t: number) => ss(0.6, 2.8, t);
const debrisEnv = (t: number) => ss(10.5, 13.0, t) * (1 - ss(16.5, 19.0, t));
const dissolveEnv = (t: number) => ss(16.5, 19.5, t);

interface Seed {
  debris: boolean;
  p0: number;    // phase θ0
  h0: number;    // height phase
  v: number;     // climb rate (cycles/s)
  rMul: number;  // radius multiplier (shell placement)
  wd: number;    // debris spin rate (constant — debris skips the integral)
  cycV: number;  // debris cycle rate
  size: number;
  sub: number;   // extra hash for thinning / jitter
  tint: THREE.Color;
}

const seeds: Seed[] = [];
{
  const dustTint = new THREE.Color(0.38, 0.32, 0.26);
  const dustTint2 = new THREE.Color(0.52, 0.43, 0.31);
  const debTint = new THREE.Color(0.70, 0.58, 0.42);
  for (let i = 0; i < DUST; i++) {
    const s1 = frac(i * 0.6180339887);
    const s2 = frac(i * 0.7548776662);
    const s3 = frac(i * 0.5698402909);
    const s4 = frac(i * 0.3819660113);
    const s5 = frac(i * 0.9372549019);
    const s6 = frac(i * 0.4304830843);
    const debris = i < DEBRIS;
    seeds.push({
      debris,
      p0: s2 * Math.PI * 2,
      h0: s1,
      v: 0.030 + s5 * 0.050,
      // dust hugs the funnel shell (rMul≈1 is the silhouette surface)
      rMul: debris ? 0.90 + s4 * 0.30 : 0.60 + s3 * 0.42,
      wd: 1.6 + s3 * 2.4,
      cycV: 0.045 + s6 * 0.05,
      size: debris ? 0.45 + s4 * 0.50 : 0.10 + s4 * 0.22,
      sub: s6,
      tint: debris ? debTint.clone() : dustTint.clone().lerp(dustTint2, s4),
    });
  }
}

export default class VortexScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };
  private motes: THREE.InstancedMesh;
  private aTint: THREE.InstancedBufferAttribute;
  private aLit: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private scl = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW * BKG_SX, PH * BKG_SY),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    const geo = new THREE.PlaneGeometry(1, 1);
    this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(DUST * 3), 3);
    this.aLit = new THREE.InstancedBufferAttribute(new Float32Array(DUST), 1);
    for (let i = 0; i < DUST; i++) {
      const t = seeds[i]!.tint;
      this.aTint.setXYZ(i, t.r, t.g, t.b);
    }
    this.aLit.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTint', this.aTint);
    geo.setAttribute('aLit', this.aLit);

    const mat = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.motes = new THREE.InstancedMesh(geo, mat, DUST);
    this.motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.motes.frustumCulled = false;
    this.three.add(this.motes);
  }

  // Closed-form spiral position for a dust seed at time t.
  private spiral(s: Seed, t: number, g: number): { x: number; y: number; z: number; h: number; th: number } {
    const U = s.h0 + s.v * t;
    const h = frac(U);
    const th = s.p0 + (WA + WB) * t - (WB / s.v) * (intFrac(U) - intFrac(s.h0));
    // radius widens with height; a dust skirt spreads near the ground
    const r = funnelR(h) * s.rMul + Math.max(0, 0.12 - h) / 0.12 * 6.0 * s.sub * (0.5 + 0.5 * g);
    // gentle radial breathing so orbits are not perfect circles
    const rr = r * (1.0 + 0.10 * Math.sin(th * 2.0 + s.p0 * 3.0));
    return {
      x: AX + rr * Math.cos(th),
      y: Y_BASE + h * (Y_TOP - Y_BASE),
      z: AZ + rr * Math.sin(th),
      // keep the far side in front of the backdrop plane (PZ = -80)
      // so orbiting motes never clip behind it
      h,
      th,
    };
  }

  private place(i: number, t: number): void {
    const s = seeds[i]!;
    const dis = dissolveEnv(t);
    // thinning: dis ramps 0→1 late — the lowest-sub half of seeds drops
    // out as the storm calms (caps at 50%, the "slight dissolution")
    if (s.sub < dis * 0.5) {
      this.m.makeScale(0, 0, 0);
      this.motes.setMatrixAt(i, this.m);
      this.aLit.setX(i, 0);
      return;
    }

    const g = formEnv(t);
    let x: number, y: number, z: number, th: number, h: number;
    let fling = 0;
    let fadeMul = 1;

    if (s.debris) {
      // cycle: spiral up for 78% of the loop, ballistic fling for the rest
      const cycU = s.h0 + t * s.cycV;
      const cyc = frac(cycU);
      if (cyc < 0.78) {
        h = cyc / 0.78;
        th = s.p0 + s.wd * t;
        const r = funnelR(h) * s.rMul;
        x = AX + r * Math.cos(th);
        y = Y_BASE + h * (Y_TOP - Y_BASE);
        z = AZ + r * Math.sin(th);
        // fade the respawn in so the wrap from mid-air to the base doesn't pop
        fadeMul = ss(0.0, 0.05, cyc);
      } else {
        // ejection happened when cyc crossed 0.78 — pin the launch frame to
        // that instant so the debris doesn't pivot around the funnel midflight
        const tE = (Math.floor(cycU) + 0.78 - s.h0) / s.cycV;
        const tf = t - tE;                             // seconds since ejection
        const thE = s.p0 + s.wd * tE;
        const rE = funnelR(1) * s.rMul;
        // tangential release + a small up-kick; fling scaled by the t≈14 beat
        const vMul = (0.15 + 0.85 * debrisEnv(t)) * (0.5 + 0.5 * s.sub);
        const vx = -Math.sin(thE) * s.wd * rE * 0.35 * vMul;
        const vz = Math.cos(thE) * s.wd * rE * 0.35 * vMul;
        const vy = (3.0 + 3.0 * s.sub) * vMul;
        x = AX + rE * Math.cos(thE) + vx * tf;
        y = Y_TOP + vy * tf - 9.0 * tf * tf;
        z = AZ + rE * Math.sin(thE) + vz * tf;
        h = 1;
        th = thE;
        fling = 1;
        // hide the wrap-around pop between arc end and respawn; flung
        // debris also eases out just ahead of the backdrop so long arcs
        // never pop through the plane mid-flight
        const fade = (1 - ss(0.92, 1.0, cyc)) * ss(PZ + 1.5, PZ + 9.0, z);
        if (fade <= 0) {
          this.m.makeScale(0, 0, 0);
          this.motes.setMatrixAt(i, this.m);
          this.aLit.setX(i, 0);
          return;
        }
        fling = fade;
        fadeMul = fade;
      }
    } else {
      const p = this.spiral(s, t, g);
      x = p.x; y = p.y; z = p.z; h = p.h; th = p.th;
      // fade motes at the h-wrap seam (top → respawn at base)
      if (h > 0.985 || h < 0.004) {
        this.m.makeScale(0, 0, 0);
        this.motes.setMatrixAt(i, this.m);
        this.aLit.setX(i, 0);
        return;
      }
    }

    // scale: form-in ramp, debris fling brightness bump, late thinning
    const sc = s.size
      * (s.debris ? (0.6 + 0.4 * g) * (0.6 + 0.6 * fling) : (0.4 + 0.6 * g))
      * (1 - 0.45 * dis)
      * fadeMul;
    this.e.set(0, 0, s.debris ? th * 1.3 + s.p0 : 0);
    this.q.setFromEuler(this.e);
    this.scl.set(sc, sc, sc);
    this.v.set(x, y, z);
    this.m.compose(this.v, this.q, this.scl);
    this.motes.setMatrixAt(i, this.m);

    // lit on the sun side (sun low toward −x); base dust catches extra light
    const lit = clamp01(0.45 + 0.6 * -Math.cos(th) + (h < 0.1 ? 0.25 : 0)) * (0.7 + 0.5 * fling);
    this.aLit.setX(i, lit);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    for (let i = 0; i < DUST; i++) this.place(i, t);
    this.motes.instanceMatrix.needsUpdate = true;
    this.aLit.needsUpdate = true;

    // slow orbit-drift + push-in, closed-form
    const push = ss(0, this.ctx.end, t);
    const yaw = 0.13 + 0.055 * Math.sin(t * 0.07);
    const rad = 88 - 11 * push;
    const camY = 9.5 + 2.0 * ss(3, 18, t);
    // closed-form orbit drift via the rig's analytical solver; pitch keeps
    // the camera below the look target so the funnel looms
    const pitch = Math.asin((camY - 26) / rad);
    const [cx, cy, cz] = orbitPosition([AX, 26, AZ], rad, pitch, yaw);
    this.cam.position.set(cx, cy, cz);
    this.cam.lookAt(AX, 26, AZ);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.5,
      bloom: 0.22,
      bloomThreshold: 0.7,
      bloomRadius: 0.7,
      ca: 0.1,
      grain: 0.07,
      vignette: 0.55,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.motes.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

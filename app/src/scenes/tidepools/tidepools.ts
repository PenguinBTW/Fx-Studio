// tidepools — a rocky tidepool at golden hour, shot straight down then
// tilting up to the surf, in four beats.
//   0–5s   still mirror: wet rock ring frames the pool; sky reflection
//          glass-flat; cloud shadows drift; starfish breathe, anemones sway.
//   5–9s   first ripples: droplet rings + surf wavelets cross the pool;
//          caustic shimmer through the disturbance.
//   9–12.5s the slosh: camera tilts to the surf — a wavelet sloshes the rim,
//          surge band + foam streaks, the crab darts mid-chaos.
//   12.5–20s glass again: tilt settles back; ripple energy decays; the
//          mirror returns, hazier and warmer.
// Backdrop = one GLSL3 quad (rock ring / water / ripples / life / surf).
// Foreground = glitter mote InstancedMesh riding the caustic field.
// All closed-form f(t) on hash seeds — no accumulators, no RNG.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// --- narrative envelopes ---------------------------------------------------
const rippleT = (t: number) => ss(5.0, 6.5, t);                       // first disturbances on
const sloshT = (t: number) => ss(9.0, 9.9, t) * (1 - ss(11.2, 12.8, t)); // surge band crossing
const tiltT = (t: number) => ss(8.6, 10.6, t) * (1 - ss(14.0, 17.0, t));  // camera tilt to surf
const settleT = (t: number) => ss(12.5, 15.5, t);                     // sustained warm afterglow
const calmT = (t: number) => 1 - ss(4.5, 6.0, t) + settleT(t);        // water stillness (decays then returns)
const energyT = (t: number) => rippleT(t) * (1 - settleT(t) * 0.85) + sloshT(t) * 0.7; // residual motion

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
uniform float uRipple; // rippleT — droplet + wavelet activity
uniform float uSlosh;  // sloshT  — surge band
uniform float uTilt;   // tiltT   — camera tilt to surf
uniform float uSettle; // settleT — re-settling warmth
uniform float uCalm;   // calmT   — 1 still, ~0 disturbed (returns on settle)
uniform float uEnergy; // energyT — residual water motion for life sway
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  return vnoise(p) * 0.65 + vnoise(p * 2.13 + 7.3) * 0.35;
}

// expanding ripple ring from a seeded droplet at (cx, cy), born at t0
float ring(vec2 p, vec2 c, float t0, float spd, float t) {
  float dt = t - t0;
  if (dt < 0.0) return 0.0;
  float rr = dt * spd;
  float w = 0.012 + dt * 0.010;
  float band = 1.0 - smoothstep(0.0, w, abs(length(p - c) - rr));
  return band * exp(-dt * 0.55) * exp(-rr * 1.6);
}

// 5-arm starfish silhouette, arms along angle a0
float star5(vec2 p, float a0, float wob) {
  float ang = atan(p.y, p.x) - a0;
  float rad = length(p);
  float arm = 0.5 + 0.5 * cos(ang * 5.0);
  float body = 0.052 + arm * 0.052;
  return (1.0 - smoothstep(body * 0.9, body * 1.15, rad)) * (0.85 + 0.15 * wob);
}

// one anemone tentacle: thin capsule from base, swaying tip
float tentacle(vec2 p, vec2 base, float ang, float len, float sway) {
  vec2 tip = base + vec2(cos(ang + sway), sin(ang + sway)) * len;
  vec2 pa = p - base, ba = tip - base;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  return 1.0 - smoothstep(0.0035, 0.0070, d - h * 0.002);
}

void main() {
  vec2 uv = vUv;
  float x = uv.x, t = uT;

  // --- tilt to the surf: pool compresses to the bottom, surf+sky reveal
  // beyond the far rim (yy > ~1.06) as the camera pitches up
  float yy = uv.y / (1.0 - 0.34 * uTilt);
  vec2 w = vec2(x, yy);          // pool-space coordinate
  float inPool = 1.0 - smoothstep(1.015, 1.06, yy);

  vec3 col = vec3(0.0);

  // --- surf + sky beyond the far rim (revealed by the tilt) ----------------
  float surfD = yy - 1.055;      // height above the far waterline
  vec3 sky = mix(vec3(0.93, 0.62, 0.36), vec3(0.45, 0.55, 0.72), clamp(surfD * 2.2, 0.0, 1.0));
  float swBand = vnoise(vec2(x * 14.0 - t * 1.2, yy * 60.0)) * 0.5 + 0.5;
  vec3 seaCol = mix(vec3(0.30, 0.55, 0.60), vec3(0.16, 0.38, 0.46), clamp(surfD * 4.0, 0.0, 1.0));
  seaCol += vec3(0.95, 0.88, 0.72) * smoothstep(0.72, 0.95, swBand) * 0.35; // foam lace
  vec3 bandCol = mix(seaCol, sky, smoothstep(0.02, 0.42, surfD));
  bandCol += vec3(1.0, 0.78, 0.45) * exp(-surfD * surfD * 324.0) * 0.35; // sun sheen on the line
  col = bandCol;

  // --- the pool (top-down view) -------------------------------------------
  vec2 pc = w - vec2(0.5, 0.52);   // pool center
  pc.x *= 1.35;                     // wider than tall
  float r = length(pc);
  float ang = atan(pc.y, pc.x);
  float rim = 0.46 + 0.05 * fbm2(vec2(ang * 2.5, 3.7)); // irregular rock edge

  // water surface = sky reflection gradient + cloud shadows + caustics
  vec2 wuv = w + vec2(0.015 * sin(t * 0.5 + w.y * 24.0), 0.008 * sin(t * 0.4 + w.x * 31.0)) * (0.3 + uEnergy);
  vec3 refl = mix(vec3(0.78, 0.48, 0.28), vec3(0.13, 0.37, 0.42), smoothstep(0.05, 0.95, wuv.y));
  float gx = (wuv.x - 0.62) * 4.0, gy = (wuv.y - 0.75) * 4.0;
  refl += vec3(1.0, 0.82, 0.55) * exp(-gx * gx) * exp(-gy * gy) * 0.5; // sun glitter pool
  float clouds = fbm2(wuv * vec2(2.4, 3.0) + vec2(t * 0.05, t * 0.013));
  refl *= 0.78 + 0.28 * clouds; // drifting cloud shadows
  // caustic webbing on the pool floor — two counter-scrolling sine lattices
  float ca1 = sin((wuv.x + vnoise(wuv * 5.0 + t * 0.11) * 0.35) * 46.0 + t * 0.9);
  float ca2 = sin((wuv.y + vnoise(wuv * 4.0 - t * 0.09) * 0.35) * 52.0 - t * 0.7);
  float caust = pow(0.5 + 0.5 * ca1 * ca2, 3.0) * (0.35 + 0.5 * uCalm);
  vec3 water = refl + vec3(1.0, 0.90, 0.68) * caust * 0.30 * (1.0 - smoothstep(0.30, 0.44, r));

  // droplet ripple rings — seeded centers, born on a repeating cadence
  float rippleLight = 0.0;
  vec2 ripplePush = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float cyc = floor((t - 5.0) / 3.0 + fi * 0.37);
    float t0 = 5.0 + (cyc - fi * 0.37) * 3.0 + 0.4;
    vec2 c = vec2(0.30 + 0.42 * hash12(vec2(fi, cyc)), 0.38 + 0.30 * hash12(vec2(cyc, fi + 9.0)));
    // rings only live in the ripple beat — births gated so the opening
    // mirror stays glass and the settled pool can go still again
    float born = smoothstep(4.6, 5.2, t0) * (1.0 - smoothstep(11.5, 12.5, t0));
    float rg = ring(pc * vec2(1.0, 1.35), c - vec2(0.5, 0.52), t0, 0.22, t) * born;
    rippleLight += rg;
    ripplePush += normalize(pc - (c - vec2(0.5, 0.52)) + vec2(1e-4)) * rg * 0.012;
  }
  // surf wavelets crossing — travelling stripes from the top rim
  float wv = sin((wuv.y * 34.0 - t * 2.1) + sin(wuv.x * 9.0 + t * 0.6) * 1.4);
  float wavelets = smoothstep(0.75, 0.95, wv) * uRipple * (1.0 - uSettle) * (0.5 + 0.5 * uEnergy);
  water += vec3(0.9, 0.95, 1.0) * wavelets * 0.10;
  water = mix(water, refl + vec3(1.0, 0.9, 0.7) * 0.55, clamp(rippleLight, 0.0, 1.0) * 0.55);

  // slosh surge — bright band sweeping the pool + foam trails
  float sr = (t - 9.0) / 3.2;
  float sd = (w.y - (1.05 - sr * 1.15)) * 7.0;
  float surge = exp(-sd * sd) * uSlosh;
  water += vec3(0.95, 0.93, 0.82) * surge * 0.9;
  float foamFleck = step(0.93, hash12(floor(wuv * vec2(90.0, 140.0)) + floor(t * 7.0)));
  water += vec3(1.0) * foamFleck * surge * 0.7;

  // rock ring — wet umber, waterline sheen, barnacles, algae
  float rockEdge = smoothstep(rim - 0.015, rim + 0.015, r);
  float wet = 1.0 - smoothstep(0.0, 0.06, r - rim); // sheen hugging the waterline
  vec3 rock = mix(vec3(0.16, 0.12, 0.09), vec3(0.30, 0.22, 0.16), fbm2(pc * 9.0));
  rock += vec3(0.9, 0.7, 0.45) * wet * 0.42;       // wet sheen
  rock += vec3(0.55, 0.42, 0.28) * smoothstep(0.6, 1.0, fbm2(pc * 4.0 + 11.0)) * 0.25; // gold kiss
  // algae patches — dark olive blotches just inside the rim
  float algae = smoothstep(0.62, 0.78, fbm2(pc * 5.5 + 21.0)) * (1.0 - rockEdge);
  rock = mix(rock, vec3(0.14, 0.20, 0.10), algae * 0.7 * (1.0 - smoothstep(rim - 0.12, rim - 0.05, r) * 0.0 + smoothstep(rim - 0.10, rim, r)));
  // barnacle clusters — pale dots in hashed cells near the rim
  vec2 bc = floor(pc * 34.0);
  vec2 bs = hash22(bc);
  float barn = (1.0 - smoothstep(0.03, 0.06, length(fract(pc * 34.0) - bs)))
             * step(0.78, hash12(bc)) * rockEdge * (1.0 - smoothstep(rim + 0.14, rim + 0.24, r));
  rock += vec3(0.80, 0.76, 0.66) * barn;

  // composite water inside the rim over the rock
  col = mix(col, water, inPool * (1.0 - rockEdge));
  col = mix(col, rock, inPool * rockEdge);

  // --- life -----------------------------------------------------------------
  // starfish — four on the ring, breathing micro-scale
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float a0 = 0.6 + fi * 1.75 + (hash12(vec2(fi, 4.0)) - 0.5) * 0.4;
    float rr2 = rim + 0.055 + hash12(vec2(fi, 8.0)) * 0.04;
    vec2 sp = vec2(cos(a0), sin(a0)) * rr2;
    vec2 lp = (pc - sp); lp.x *= 1.0; lp /= 1.35;
    float wob = sin(t * 1.1 + fi * 2.2) * 0.5 + 0.5;
    float sf = star5(lp, a0, wob);
    col = mix(col, vec3(0.55, 0.22, 0.08) * (0.85 + 0.2 * wob), sf * inPool * 0.95);
    col += vec3(1.0, 0.75, 0.5) * sf * 0.10; // gold rim on the arms
  }
  // anemones — three clusters of swaying tentacles inside the shallow edge
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float a0 = 1.9 + fi * 2.1 + (hash12(vec2(fi, 13.0)) - 0.5) * 0.5;
    vec2 ab = vec2(cos(a0), sin(a0)) * (rim - 0.06);
    for (int k = 0; k < 9; k++) {
      float fk = float(k);
      float ta = a0 + (fk / 9.0) * 6.283 + hash12(vec2(fk, fi)) * 0.5;
      float sway = sin(t * 1.3 + fk * 1.7 + fi) * (0.12 + 0.35 * uEnergy);
      vec2 lp = pc - ab;
      float tn = tentacle(lp, vec2(0.0), ta, 0.030 + 0.014 * hash12(vec2(fk, fi + 3.0)), sway);
      col = mix(col, mix(vec3(0.32, 0.16, 0.24), vec3(0.54, 0.26, 0.38), 0.4 + 0.3 * sin(t + fk)), tn * inPool * (1.0 - rockEdge) * 0.9);
    }
  }
  // hermit crab — silhouette on a pause→dart→pause wander along the ring
  float dart1 = smoothstep(4.0, 4.4, t) * (1.0 - smoothstep(5.6, 6.0, t));
  float dart2 = smoothstep(9.6, 10.0, t) * (1.0 - smoothstep(11.0, 11.5, t));
  float dart3 = smoothstep(15.0, 15.4, t) * (1.0 - smoothstep(16.4, 16.9, t));
  float crabA = 4.0 + 0.35 * sin(t * 0.15) + dart1 * 0.55 + dart2 * 0.75 + dart3 * 0.5;
  vec2 cp = vec2(cos(crabA), sin(crabA)) * (rim + 0.075);
  vec2 cl = pc - cp;
  float shell = 1.0 - smoothstep(0.016, 0.022, length(cl * vec2(1.0, 1.4)));
  float legs = 1.0 - smoothstep(0.020, 0.028, length(cl * vec2(1.4, 1.0)) + 0.004);
  float crab = max(shell, legs * 0.6);
  col = mix(col, vec3(0.05, 0.04, 0.03), crab * inPool * rockEdge * 0.9);

  // outer rock floor beyond the ring, then foam lace at the very rim
  col = mix(col, rock * 0.55, inPool * smoothstep(rim + 0.06, rim + 0.22, r));
  col += vec3(0.93, 0.88, 0.75) * (1.0 - smoothstep(0.0, 0.012, abs(r - rim))) * (0.25 + 0.4 * uEnergy);

  // post-slosh warm haze — the re-settled glass reads warmer
  col += vec3(0.30, 0.16, 0.05) * uSettle * 0.18 * inPool;

  // vignette — top-down framing keeps corners dark
  col *= 1.0 - 0.22 * pow(length(vUv - 0.5) * 1.35, 2.6);

  fragColor = vec4(col, 1.0);
}`;

// --- world mapping ----------------------------------------------------------
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

const MOTES = 160; // glitter specks riding the caustic field

export default class TidepoolsScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, PW / PH, 0.1, 400);
  private motes: THREE.InstancedMesh;
  private u = {
    uT: { value: 0 }, uRipple: { value: 0 }, uSlosh: { value: 0 },
    uTilt: { value: 0 }, uSettle: { value: 0 }, uCalm: { value: 0 },
    uEnergy: { value: 0 },
  };
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private m = new THREE.Matrix4();
  private sv = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: this.u,
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);

    // glitter motes: tiny additive planes drifting on the water surface
    this.motes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0xffe8b0, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      MOTES,
    );
    this.motes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MOTES * 3), 3);
    this.three.add(this.motes);
    this.cam.position.set(0, 6, 25);
    this.cam.lookAt(0, 10, PZ + 20);
  }

  // mote pose: drift on the water band (uv y 0.30–0.75), twinkle, sink on slosh
  private motePose(i: number, t: number, tilt: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);
    const w = frac(i * 0.7548776662);
    const drift = t * (0.008 + 0.014 * w);
    const x = 0.32 + frac(u + drift) * 0.40;
    // compress with the tilt warp so the glitter stays on the water
    const y = (0.32 + w * 0.40 + Math.sin(t * (0.4 + u) + i) * 0.012) * (1 - 0.34 * tilt);
    const tw = Math.sin(t * (2.0 + w * 3.0) + u * 40.0) * 0.5 + 0.5;
    uvToWorld(x, y, out);
    out.z += 0.8;
    return 0.15 + 0.85 * tw * tw;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uRipple.value = rippleT(t);
    this.u.uSlosh.value = sloshT(t);
    this.u.uTilt.value = tiltT(t);
    this.u.uSettle.value = settleT(t);
    this.u.uCalm.value = calmT(t);
    this.u.uEnergy.value = energyT(t);

    for (let i = 0; i < MOTES; i++) {
      const b = this.motePose(i, t, tiltT(t), this.p);
      if (b <= 0.02) { this.m.makeScale(0, 0, 0); this.motes.setMatrixAt(i, this.m); continue; }
      this.sv.setScalar(b);
      this.m.compose(this.p, this.q.identity(), this.sv);
      this.motes.setMatrixAt(i, this.m);
      this.c.setRGB(1.0, 0.85 + 0.15 * b, 0.55).multiplyScalar(0.2 + b * 1.4);
      this.motes.setColorAt(i, this.c);
    }
    this.motes.instanceMatrix.needsUpdate = true;
    if (this.motes.instanceColor) this.motes.instanceColor.needsUpdate = true;

    // camera: near-still macro; small pitch-up sells the tilt to the surf;
    // a gentle push during the slosh, easing back for the glass
    const tilt = tiltT(t);
    const push = ss(9.0, 11.0, t) * (1 - ss(13.0, 16.5, t) * 0.6);
    this.cam.position.set(
      0.6 * Math.sin(t * 0.05),
      6.0 - 1.2 * push + 0.25 * Math.sin(t * 0.07),
      25.0 - 3.5 * push,
    );
    this.cam.lookAt(
      0.5 * Math.sin(t * 0.04),
      10.0 - 3.0 * push + 6.0 * tilt,
      PZ + 20,
    );

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.72 + 0.05 * sloshT(t),
      bloom: 0.42 + 0.20 * sloshT(t),
      bloomThreshold: 0.72,
      bloomRadius: 0.55,
      grade: { saturation: 1.15, gamma: 0.9 },
    } as PostOverrides;
  }

  override dispose() {
    this.motes.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// sandstorm — a haboob wall advancing across a Sahara plain, in three acts.
//   0–8s   establishing: heat-shimmer horizon, acacia silhouettes, the amber
//          band on the horizon lifting into a towered mass.
//   8–15s  contact: fbm billow crown rolls forward, sun collapses to a red
//          wafer, saltation streaks rip past, tumbleweed arcs across frame,
//          then a near-whiteout lull.
//   15–20s aftermath: visibility returns through golden settling haze; the
//          front dune ridgeline is reshaped; sun a pale coin.
// Backdrop is one GLSL3 quad (sky/sun/dunes/wall/haze); foreground is two
// InstancedMesh systems — anisotropic grain streaks + icosahedral tumble
// debris — all closed-form f(t) on hash seeds. No accumulators, no RNG.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// --- narrative envelopes ---------------------------------------------------
// wall advance: lifts off the horizon ~2.5s, swallows the sky by ~13s
const approach = (t: number) => ss(2.5, 13.0, t);
// deepest murk: collapses in ~11.5–13.5, releases 15–17.5
const whiteout = (t: number) => ss(11.5, 13.5, t) * (1 - ss(15.0, 17.5, t));
// golden settling veil in the aftermath
const settle = (t: number) => ss(15.0, 19.0, t);
// ridgeline morph once the front passes
const reshape = (t: number) => ss(14.5, 17.5, t);
// the front passes through/behind the camera during the settle
const passed = (t: number) => ss(14.5, 17.5, t);
// storm violence driving grains/debris — peaks inside the whiteout with a
// brief dead-calm lull at the very deepest opacity
const violence = (t: number) => {
  const core = whiteout(t);
  const lull = ss(13.2, 13.8, t) * (1 - ss(14.2, 14.9, t)) * 0.95; // near-calm dip inside core
  return clamp01(0.10 + 0.78 * approach(t) + 0.55 * core - lull - 0.85 * passed(t));
};

// Front dune crest — shared verbatim with the GLSL (grains/debris sit on it).
// reshape(t) slides the crest phase so the ridgeline visibly changes after
// the storm passes.
const CREST_GLSL = `
float crestFront(float x, float t, float morph) {
  float p = x + t * 0.003 + morph * 0.11;
  float a = 1.0 - 0.35 * morph;               // storm lowers the crest
  return 0.21 + a * (0.042 * sin(p * 5.9 + 1.3)
                   + 0.024 * sin(p * 12.7 + 4.1 + morph * 2.0)
                   + 0.012 * sin(p * 29.3 + 2.7));
}`;
const crestFront = (x: number, t: number, morph: number) => {
  const p = x + t * 0.003 + morph * 0.11;
  const a = 1 - 0.35 * morph;
  return 0.21 + a * (0.042 * Math.sin(p * 5.9 + 1.3)
                   + 0.024 * Math.sin(p * 12.7 + 4.1 + morph * 2)
                   + 0.012 * Math.sin(p * 29.3 + 2.7));
};

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
uniform float uApp;    // approach(t)
uniform float uWhite;  // whiteout(t)
uniform float uSettle; // settle(t)
uniform float uMorph;  // reshape(t)
uniform float uPass;   // passed(t)
out vec4 fragColor;

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 0.0 + 1.0), u);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i.x + i.y * 57.0), hash1(i.x + 1.0 + i.y * 57.0), u.x),
             mix(hash1(i.x + i.y * 57.0 + 113.0), hash1(i.x + 1.0 + i.y * 57.0 + 113.0), u.x), u.y);
}
float fbm2(vec2 p) {
  return vnoise2(p) * 0.55 + vnoise2(p * 2.13 + 17.7) * 0.28 + vnoise2(p * 5.3 + 43.1) * 0.17;
}
float ridge(float x) { return 1.0 - abs(2.0 * vnoise(x) - 1.0); }
float rfbm(float x) {
  return ridge(x) * 0.6 + ridge(x * 2.13 + 17.7) * 0.3 + ridge(x * 5.3 + 43.1) * 0.1;
}
${CREST_GLSL}

// Distance to a thin line segment — used for the dead-tree branches.
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;

  // --- sky: hot amber low, dusty rose high --------------------------------
  vec3 amber = vec3(0.72, 0.38, 0.12);
  vec3 rose  = vec3(0.45, 0.22, 0.16);
  vec3 pale  = vec3(0.82, 0.55, 0.28);
  vec3 col = mix(amber, rose, smoothstep(0.38, 0.72, y));
  col = mix(col, pale, smoothstep(0.44, 0.52, y) * (1.0 - smoothstep(0.52, 0.68, y)) * 0.6);

  // --- heat shimmer: wavy distortion hugging the horizon, fading as the
  //     wall arrives (the storm kills the shimmer) --------------------------
  float shimBand = exp(-(y - 0.44) * (y - 0.44) * 2200.0);
  float shimAmt = 0.0035 * shimBand * (1.0 - 0.85 * uApp);
  float xw = x + sin(y * 300.0 + t * 2.2) * shimAmt + sin(y * 140.0 - t * 1.1) * shimAmt * 0.7;

  // --- sun: hot disc → dim red wafer → gone → pale returning coin ----------
  float sunX = 0.34, sunY = 0.66;
  vec2 sd = vec2((xw - sunX) * 2.63, y - sunY);
  float sdd = length(sd);
  float occl = 0.85 * uApp + 0.15 * uWhite;       // optical depth of dust
  float sunR = 0.016 + 0.010 * uApp;              // disc swells & blurs in haze
  float sunDisc = 1.0 - smoothstep(sunR, sunR * (1.6 + 3.0 * uApp), sdd);
  float sunGlow = exp(-sdd * sdd * (600.0 - 380.0 * uApp));
  vec3 sunCol = mix(vec3(1.0, 0.85, 0.55), vec3(0.65, 0.10, 0.03), clamp(uApp * 1.3, 0.0, 1.0));
  col += sunCol * (sunDisc * (1.0 - occl) * 1.6 + sunGlow * 0.5 * (1.0 - 0.6 * occl));

  // --- distant dunes -------------------------------------------------------
  for (int j = 3; j >= 0; j--) {
    float fj = float(j);
    float base = 0.435 - (3.0 - fj) * 0.055;
    float amp = 0.026 + fj * 0.010;
    float cr = base + amp * rfbm(xw * (2.8 + fj * 1.3) + fj * 13.1 + t * 0.001);
    float below = 1.0 - smoothstep(cr - 0.002, cr + 0.002, y);
    float haze = 0.10 + fj * 0.24 + uSettle * 0.25;
    vec3 duneCol = mix(vec3(0.30, 0.15, 0.07), vec3(0.55, 0.32, 0.14), haze);
    col = mix(col, duneCol, below * (0.5 + 0.5 * (1.0 - haze)));
  }

  // --- acacia + dead-tree silhouettes (occluded by the advancing wall) ----
  float treeMask = 0.0;
  // acacia 1: trunk + broad flat canopy
  treeMask = max(treeMask, 1.0 - smoothstep(0.004, 0.007, seg(vec2(xw, y), vec2(0.34, 0.435), vec2(0.348, 0.512))));
  treeMask = max(treeMask, (1.0 - smoothstep(0.045, 0.058, length(vec2((xw - 0.362) * 2.0, (y - 0.528) * 6.5)))) * 0.95);
  // acacia 2 (smaller, farther)
  treeMask = max(treeMask, 1.0 - smoothstep(0.003, 0.0055, seg(vec2(xw, y), vec2(0.42, 0.438), vec2(0.425, 0.496))));
  treeMask = max(treeMask, (1.0 - smoothstep(0.030, 0.040, length(vec2((xw - 0.428) * 2.0, (y - 0.508) * 6.0)))) * 0.95);
  // dead tree: trunk + bare branches
  treeMask = max(treeMask, 1.0 - smoothstep(0.0035, 0.006, seg(vec2(xw, y), vec2(0.665, 0.435), vec2(0.659, 0.515))));
  treeMask = max(treeMask, 1.0 - smoothstep(0.0025, 0.005, seg(vec2(xw, y), vec2(0.659, 0.496), vec2(0.636, 0.526))));
  treeMask = max(treeMask, 1.0 - smoothstep(0.0025, 0.005, seg(vec2(xw, y), vec2(0.659, 0.488), vec2(0.682, 0.520))));
  float treeVis = (1.0 - smoothstep(0.5, 0.72, uApp)) * (1.0 - uWhite) * (1.0 - uSettle * 0.8);
  col = mix(col, vec3(0.05, 0.03, 0.02), treeMask * treeVis);

  // --- the haboob wall -----------------------------------------------------
  // Crown edge: horizon band rises to a frame-filling tower; rolling lobes
  // silhouette against the surviving sky sliver. Interior churns dark.
  float lobA = vnoise(xw * 2.2 - t * 0.35) * 0.10
             + vnoise(xw * 6.5 - t * 0.62 + 7.0) * 0.05
             + vnoise(xw * 17.0 - t * 1.1 + 3.0) * 0.02;
  float wallTop = 0.435 + 0.27 * uApp + lobA * (0.10 + 0.90 * uApp);
  float inWall = 1.0 - smoothstep(wallTop - 0.006, wallTop + 0.006, y);
  // billowing lobes roll up the face; finer grit texture on top
  float billow = fbm2(vec2(xw * 6.0 - t * 0.45, (y - wallTop * 0.4) * 13.0 + t * 0.8));
  float grit = vnoise2(vec2(xw * 24.0 - t * 1.5, y * 34.0));
  float churn = billow * 0.72 + grit * 0.28;
  float depth = smoothstep(0.0, 0.30, wallTop - y);
  float dens = inWall * (0.55 + 0.45 * depth) * (0.60 + 0.40 * uApp) * (1.0 - uPass);
  vec3 wallCol = mix(vec3(0.10, 0.045, 0.02), vec3(0.80, 0.42, 0.13), smoothstep(0.28, 0.88, churn));
  float rollBand = (1.0 - smoothstep(wallTop - 0.05, wallTop, y)) * smoothstep(wallTop - 0.22, wallTop - 0.05, y);
  wallCol = mix(wallCol, vec3(0.07, 0.03, 0.015), rollBand * 0.75 * uApp);
  // crown rim light — lobes catch the sun on top
  float rim = inWall * exp(-(wallTop - y) * 130.0) * (0.30 + 0.55 * uApp);
  wallCol += vec3(1.0, 0.62, 0.22) * rim * (1.0 - occl * 0.4);
  col = mix(col, wallCol, dens);

  // --- front dune: reshaped crest + rippled face ---------------------------
  float cf = crestFront(x, t, uMorph);
  float face = 1.0 - smoothstep(cf - 0.004, cf + 0.004, y);
  vec3 faceCol = mix(vec3(0.42, 0.22, 0.10), vec3(0.50, 0.28, 0.13), uSettle * 0.5);
  float bend = (cf - 0.21) * 30.0;
  float rip = sin(x * 300.0 + bend + (cf - y) * 240.0 - t * 0.7);
  float ripMask = face * smoothstep(0.0, 0.03, cf - y) * (1.0 - smoothstep(0.10, 0.16, cf - y));
  faceCol *= 1.0 - ripMask * (0.5 + 0.5 * rip) * 0.30;
  float hl = face * exp(-max(0.0, cf - y) * 300.0) * 0.14;
  faceCol += vec3(0.9, 0.5, 0.18) * hl;
  col = mix(col, faceCol, face * 0.97);
  col = mix(col, vec3(0.06, 0.04, 0.03), (1.0 - smoothstep(0.0, 0.08, y)) * 0.7);

  // --- global haze: dust in the air dims everything progressively ----------
  col = mix(col, vec3(0.60, 0.37, 0.18), uApp * 0.22);

  // --- whiteout: near-total collapse to pale amber field -------------------
  vec3 whiteCol = vec3(0.80, 0.62, 0.38) * (0.92 + 0.08 * churn);
  float wstreak = fbm2(vec2(x * 2.5 - t * 2.6, y * 55.0));
  whiteCol *= 1.0 - (wstreak - 0.5) * 0.55;
  col = mix(col, whiteCol, uWhite * 0.96);

  // --- aftermath: golden settling veil + pale sun return -------------------
  col = mix(col, vec3(0.78, 0.55, 0.28), uSettle * 0.28 * (1.0 - uWhite));
  // pale sun coin high in the haze
  float coin = 1.0 - smoothstep(0.013, 0.02, length(vec2((x - sunX) * 2.63, y - sunY)));
  col += vec3(0.9, 0.65, 0.4) * coin * uSettle * 0.9 * (1.0 - uWhite);

  fragColor = vec4(col, 1.0);
}`;

const STREAKS = 420;
const DEBRIS = 8;
// Backdrop plane mapping (must match mesh below): uv → world.
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

export default class SandstormScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = {
    uT: { value: 0 }, uApp: { value: 0 }, uWhite: { value: 0 },
    uSettle: { value: 0 }, uMorph: { value: 0 }, uPass: { value: 0 }
  };
  private streaks: THREE.InstancedMesh;
  private debris: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private sv = new THREE.Vector3();
  private p = new THREE.Vector3();
  private c = new THREE.Color();
  private e = new THREE.Euler();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(42, ctx.W / ctx.H, 0.1, 400);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // saltation streaks: long thin boxes streaking across frame
    const sgeo = new THREE.BoxGeometry(4.0, 0.16, 0.07);
    this.streaks = new THREE.InstancedMesh(sgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), STREAKS);
    this.streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STREAKS * 3), 3);
    this.streaks.instanceColor.setUsage(THREE.DynamicDrawUsage);
    // instance z is computed in backdrop-plane space then pulled forward
    this.three.add(this.streaks);

    // tumble debris: dry bush bodies on closed-form hop arcs
    const dgeo = new THREE.IcosahedronGeometry(2.0, 0);
    this.debris = new THREE.InstancedMesh(
      dgeo,
      new THREE.MeshStandardMaterial({ color: 0x4a2f16, roughness: 1.0, wireframe: true }),
      DEBRIS,
    );
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.three.add(this.debris);
    this.three.add(new THREE.AmbientLight(0xffffff, 2.2));
  }

  // Closed-form streak: hash seeds pick band, speed, jitter. Streaks fly
  // left→right; speed & brightness scale with storm violence. frac wrap
  // re-enters them off-frame — the stream never ends.
  private streakPos(i: number, t: number, v: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);
    const w = frac(i * 0.7548776662);
    const z = frac(i * 0.5698402909);
    const speed = 14 + 46 * w;                            // units/s; constant so grain distance never rewinds
    const x = 0.27 + frac(u + t * speed / (PW * 0.46)) * 0.46;
    const yBand = 0.15 + 0.75 * z;
    const y = yBand + 0.02 * Math.sin(t * (2.0 + w) + u * 40.0);
    uvToWorld(x, y, out);
    // depth stagger: nearer streaks fly faster and lower
    out.z += 28 + z * 22.0; // in front of the backdrop, depth-staggered
    return speed;
  }

  // Tumble arc: ballistic hops crossing the frame, spin proportional to hop.
  private debrisPose(i: number, t: number, v: number, out: THREE.Vector3, morph: number) {
    const u = frac(i * 0.4142135623);
    const w = frac(i * 0.7320508075);
    const rate = 0.35 + 0.25 * w;
    const cycle = Math.floor(t * rate + u * 9.0);
    const th = frac(t * rate + u * 9.0);
    const hop = Math.abs(Math.sin(th * Math.PI * 3.0)); // three bounces per crossing
    const dir = i % 2 === 0 ? 1 : -1;
    const x = 0.27 + frac(u + t * (0.030 + 0.022 * w) * dir * (0.4 + 0.6 * v)) * 0.46;
    const y = crestFront(x, t, morph) + hop * (0.03 + 0.05 * w) * (0.3 + 0.7 * v);
    uvToWorld(x, y, out);
    out.z += 34.0;
    return { spin: th * Math.PI * 6.0 * dir + u * 10.0, hop };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    const app = approach(t), wh = whiteout(t), se = settle(t), mo = reshape(t);
    const v = violence(t);
    this.u.uT.value = t; this.u.uApp.value = app;
    this.u.uWhite.value = wh; this.u.uSettle.value = se; this.u.uMorph.value = mo;
    this.u.uPass.value = passed(t);

    // streaks: density gate — only the nearest fraction of the pool flies
    const live = Math.floor(STREAKS * v * v);
    for (let i = 0; i < STREAKS; i++) {
      if (i >= live) { this.m.makeScale(0, 0, 0); this.streaks.setMatrixAt(i, this.m); continue; }
      const speed = this.streakPos(i, t, v, this.p);
      const len = 0.6 + 2.6 * v + speed * 0.006;
      this.m.makeScale(len, 1, 1).setPosition(this.p);
      this.streaks.setMatrixAt(i, this.m);
      // alternating bright flyspecks vs dark silhouetted grains for contrast
      const bright = Math.sin(i * 12.9) > 0.0;
      const b = 0.2 + 0.8 * v;
      if (bright) this.c.setRGB(b * 1.25, b * 0.78, b * 0.38);
      else this.c.setRGB(b * 0.45, b * 0.30, b * 0.16);
      this.streaks.setColorAt(i, this.c);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    this.streaks.instanceColor!.needsUpdate = true;

    // tumble debris during the contact window
    const dw = ss(6.5, 9.0, t) * (1 - ss(13.5, 15.5, t));
    for (let i = 0; i < DEBRIS; i++) {
      const pose = this.debrisPose(i, t, Math.max(v, 0.3), this.p, mo);
      if (dw <= 0.01) { this.m.makeScale(0, 0, 0); this.debris.setMatrixAt(i, this.m); continue; }
      this.e.set(pose.spin * 0.7, pose.spin, pose.spin * 0.4);
      this.q.setFromEuler(this.e);
      const s = (0.8 + 0.4 * Math.sin(i * 3.7)) * (0.9 + 0.3 * pose.hop);
      this.sv.set(s, s, s);
      this.m.compose(this.p, this.q, this.sv);
      this.debris.setMatrixAt(i, this.m);
    }
    this.debris.instanceMatrix.needsUpdate = true;

    // camera: mid-dune hold — breath drift, slow push, tiny lean into the
    // storm at contact, settle back out in the aftermath
    const push = ss(0, 12, t);
    const lean = ss(9, 13, t) * (1 - ss(14, 17, t));
    this.cam.position.set(
      0.8 * Math.sin(t * 0.05) + 1.5 * lean,
      7.0 - 0.5 * push + 0.4 * lean,
      24.0 - 3.5 * push - 2.0 * lean,
    );
    this.cam.lookAt(4.0 * lean, 9.5 + 2.0 * app - 2.5 * wh, PZ + 20);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.62 - 0.18 * wh + 0.06 * se,
      bloom: 0.35,
      bloomThreshold: 0.55,
      bloomRadius: 0.75,
      ca: 0.10 + 0.15 * v,
      grain: 0.05 + 0.06 * v,
      vignette: 0.5,
      level:
        ss(0, 0.8, t) * (this.ctx.end >= 19.9 ? 1 - ss(20.0 - 0.8, 20.0, t) : 1),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.streaks.dispose();
    this.debris.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

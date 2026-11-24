// emberdrift — campfire embers drifting up through a forest clearing at
// night, in four beats.
//   0–6s    quiet crackle: pine walls frame the clearing, moon wafer +
//           haze band, coal bed pulse, three flame tongues, thin ember
//           stream rising on helical drafts.
//   6–9.6s  gust swell: haze leans, flames tip, the ember column kinks
//           and accelerates; a seeded subset surges upward.
//   9.6–12.5s log crack: camera shake impulse, ember fountain burst,
//           two fresh flame tongues flash on, slow push toward the fire.
//   12.5–20s drifting settle: moths orbit the light cone once, stream
//           thins, embers fade to ash against the moon band.
// Backdrop = one GLSL3 quad (sky/stars/moon/haze/pines/ground/fire);
// foreground = ember InstancedMesh (250) + moth InstancedMesh (4).
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
const gustT = (t: number) => ss(6.0, 9.0, t) * (1 - ss(11.5, 14.5, t));
const crackT = (t: number) => ss(9.6, 9.9, t) * (1 - ss(10.4, 12.5, t)); // shake/flash
const burstT = (t: number) => ss(9.6, 10.1, t) * (1 - ss(11.0, 13.0, t)); // fountain+tongues
const settleT = (t: number) => ss(12.5, 15.5, t);
const mothT = (t: number) => ss(11.5, 12.5, t) * (1 - ss(16.5, 17.5, t));

const FIRE_X = 0.5, FIRE_Y = 0.24; // uv position of the fire

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
uniform float uGust;   // gustT
uniform float uCrack;  // crackT  (shake flash)
uniform float uBurst;  // burstT  (fountain + extra tongues + flare)
uniform float uSettle; // settleT
out vec4 fragColor;

const float FIRE_X = ${FIRE_X};
const float FIRE_Y = ${FIRE_Y};

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 p) {
  return 0.55 * vnoise2(p) + 0.30 * vnoise2(p * 2.17) + 0.15 * vnoise2(p * 4.41);
}

// pine profile: solid column widening toward the base — a stack read as
// triangular canopy over a trunk. x0 base-center uv x, w half-width,
// y0 ground y, h top y.
float pine(vec2 uv, float x0, float w, float y0, float h) {
  float taper = clamp((uv.y - y0) / max(h - y0, 1e-3), 0.0, 1.0);
  // jagged edge via triangle wave on y gives layered branches
  float jag = 0.92 + 0.14 * fract(uv.y * 21.0 + x0 * 61.0);
  float halfw = w * (1.0 - taper * 0.92) * jag;
  return (1.0 - smoothstep(halfw - 0.008, halfw + 0.008, abs(uv.x - x0)))
       * (1.0 - smoothstep(h - 0.004, h + 0.004, uv.y))
       * smoothstep(y0 - 0.02, y0 + 0.02, uv.y);
}
// flame tongue: teardrop — narrow apex, rounded base, sways with t.
float flame(vec2 uv, float x0, float y0, float w, float h, float sway) {
  vec2 p = uv - vec2(x0 + sway * (0.3 + (uv.y - y0) * 1.4), y0);
  float taper = clamp(p.y / h, 0.0, 1.0);
  float hw = w * (1.0 - taper * taper) * (0.9 + 0.25 * taper);
  float d = (p.x * p.x) / max(hw * hw, 1e-5) + ((p.y - h * 0.45) * (p.y - h * 0.45)) / (h * h * 0.30);
  return 1.0 - smoothstep(0.85, 1.15, d);
}

void main() {
  vec2 uv = vUv;
  float x = uv.x, y = uv.y;
  float t = uT;

  // --- night sky -----------------------------------------------------------
  vec3 col = mix(vec3(0.012, 0.020, 0.045), vec3(0.030, 0.055, 0.105), y);
  // stars: hashed grid points, twinkle, fade toward horizon + fire glow
  vec2 sp = uv * vec2(160.0, 90.0);
  vec2 si = floor(sp);
  vec2 so = vec2(0.2 + 0.6 * hash12(si + 13.0), 0.2 + 0.6 * hash12(si + 29.0));
  float starPt = 1.0 - smoothstep(0.0, 0.12, length(fract(sp) - so));
  float star = starPt * step(0.93, hash12(si)) * smoothstep(0.45, 0.75, y);
  float tw = 0.6 + 0.4 * sin(t * (2.0 + hash12(si + 7.0) * 3.0) + hash12(si) * 40.0);
  col += vec3(0.75, 0.82, 0.95) * star * tw * 0.8;

  // moon wafer + halo, upper-left
  vec2 moonP = uv - vec2(0.335, 0.845);
  float md = length(moonP * vec2(1.0, 1.6));
  col += vec3(0.85, 0.88, 0.95) * (1.0 - smoothstep(0.018, 0.024, md)) * 0.9;
  col += vec3(0.45, 0.55, 0.80) * exp(-md * md * 320.0) * 0.35;

  // moonlit haze band — leans with the gust
  float hazeY = 0.34 + 0.02 * sin(x * 5.0 + t * 0.2) + uGust * 0.03 * (x - 0.5);
  float haze = exp(-(y - hazeY) * (y - hazeY) * 200.0) * (0.5 + 0.5 * fbm2(vec2(x * 6.0 - t * 0.35, y * 8.0)));
  col = mix(col, vec3(0.14, 0.20, 0.32), haze * 0.65);

  // --- pine walls: far layer hazy, near layer near-black -------------------
  float farPine = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float x0 = 0.16 + fi * 0.115 + (hash12(vec2(fi, 3.0)) - 0.5) * 0.05;
    float h = 0.62 + hash12(vec2(fi, 5.0)) * 0.30;
    farPine = max(farPine, pine(uv, x0, 0.055 + hash12(vec2(fi, 7.0)) * 0.03, 0.30, h));
  }
  col = mix(col, vec3(0.035, 0.060, 0.105), farPine * 0.7);

  // --- forest floor --------------------------------------------------------
  float groundY = 0.20 + 0.015 * sin(x * 9.0 + 1.7);
  if (y < groundY) {
    float gd = groundY - y;
    vec3 gr = mix(vec3(0.020, 0.030, 0.050), vec3(0.035, 0.050, 0.075), smoothstep(0.0, 0.2, gd));
    // warm ember-light pool around the fire, breathing with the coals
    float pool = exp(-(x - FIRE_X) * (x - FIRE_X) * 60.0) * exp(-gd * 10.0);
    gr += vec3(0.60, 0.28, 0.08) * pool * (0.7 + 0.25 * sin(t * 6.3) * sin(t * 1.7) + uBurst * 0.6);
    // wet-leaf glitter specks in the pool
    float gl = step(0.996, hash12(floor(uv * vec2(300.0, 220.0)))) * pool;
    gr += vec3(0.9, 0.6, 0.3) * gl * (0.4 + 0.6 * sin(t * 9.0 + x * 500.0));
    col = gr;
  }

  // --- campfire ------------------------------------------------------------
  vec2 fp = uv - vec2(FIRE_X, FIRE_Y);
  // coal bed: hot blob with flicker + crack flare
  float coalD = length(fp * vec2(11.0, 26.0));
  float coal = exp(-coalD * coalD * 6.0);
  float coalFl = 0.75 + 0.25 * sin(t * 5.1) * sin(t * 2.3 + 1.0) + uBurst * 0.7;
  vec3 coalCol = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.72, 0.25), coal);
  // log silhouette leaning beside the fire
  float logD = length((uv - vec2(FIRE_X + 0.052, FIRE_Y - 0.004)) * vec2(30.0, 60.0));
  float logM = 1.0 - smoothstep(0.55, 0.75, logD);
  float fireGlow = coal * coalFl;

  // flame tongues — three baseline + two that flash on during the burst
  float fl = 0.0;
  float sway = (0.004 * sin(t * 3.1) + uGust * 0.010) ;
  fl = max(fl, flame(uv, FIRE_X - 0.016, FIRE_Y + 0.012, 0.013, 0.058 + 0.012 * sin(t * 4.7), sway));
  fl = max(fl, flame(uv, FIRE_X + 0.002, FIRE_Y + 0.010, 0.011, 0.075 + 0.015 * sin(t * 5.9 + 2.0), sway * 1.3));
  fl = max(fl, flame(uv, FIRE_X + 0.018, FIRE_Y + 0.013, 0.012, 0.050 + 0.010 * sin(t * 4.1 + 4.0), sway));
  float fl2 = flame(uv, FIRE_X - 0.006, FIRE_Y + 0.011, 0.010, 0.085, sway * 1.5) * uBurst
          + flame(uv, FIRE_X + 0.010, FIRE_Y + 0.011, 0.009, 0.070, sway * 0.8) * uBurst;
  float flameAll = max(fl * (0.85 + 0.15 * sin(t * 8.0 + x * 90.0)), fl2);
  vec3 flameCol = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.85, 0.35), flameAll);
  col += coalCol * fireGlow * 1.8;
  col = mix(col, vec3(0.02, 0.015, 0.01), logM * 0.9 * step(0.0, uv.x - FIRE_X + 0.02));
  col += flameCol * flameAll * (1.3 + uBurst * 0.8);

  // light cone rising from the fire — the ember corridor
  float coneW = 0.05 + (y - FIRE_Y) * 0.22;
  float cone = exp(-pow(abs((x - FIRE_X) / max(coneW, 1e-3)), 2.0)) * smoothstep(FIRE_Y, FIRE_Y + 0.10, y) * (1.0 - smoothstep(0.45, 0.85, y));
  col += vec3(0.35, 0.20, 0.08) * cone * (0.35 + 0.35 * uBurst + 0.25 * uGust);

  // --- near pines, near-black, frame the edges ------------------------------
  float nearPine = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float x0 = 0.10 + fi * 0.175 + (hash12(vec2(fi, 11.0)) - 0.5) * 0.06;
    float h = 0.80 + hash12(vec2(fi, 13.0)) * 0.22;
    nearPine = max(nearPine, pine(uv, x0, 0.075 + hash12(vec2(fi, 17.0)) * 0.035, 0.18, h));
  }
  col = mix(col, vec3(0.006, 0.010, 0.018), nearPine * 0.95);

  // escaping sparks close to the fire (cheap in-shader layer under the mesh)
  vec2 sk = vec2((uv.x - FIRE_X) * 40.0, (uv.y - FIRE_Y) * 60.0 - t * 3.5);
  vec2 skI = floor(sk);
  vec2 skF = fract(sk) - vec2(0.2 + 0.6 * hash12(skI + 5.0), 0.5);
  float spark = (1.0 - smoothstep(0.0, 0.20, length(skF)))
    * step(0.94, hash12(skI)) * smoothstep(0.25, 0.05, length(fp));
  col += vec3(1.0, 0.6, 0.2) * spark * (0.5 + uBurst);

  fragColor = vec4(col, 1.0);
}`;

// --- world mapping ----------------------------------------------------------
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

const EMBERS = 250;
const MOTHS = 4;

export default class EmberDriftScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = {
    uT: { value: 0 }, uGust: { value: 0 }, uCrack: { value: 0 },
    uBurst: { value: 0 }, uSettle: { value: 0 },
  };
  private embers: THREE.InstancedMesh;
  private moths: THREE.InstancedMesh;

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

    // embers: small additive glows on helical updrafts
    this.embers = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.28, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      EMBERS,
    );
    this.embers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.embers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(EMBERS * 3), 3);
    this.three.add(this.embers);

    // moths: dark flutter quads orbiting the light cone once
    this.moths = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 0.6),
      new THREE.MeshBasicMaterial({ color: 0x0a0d14, side: THREE.DoubleSide }),
      MOTHS,
    );
    this.moths.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.three.add(this.moths);

    this.three.add(new THREE.AmbientLight(0xffffff, 1.2));
  }

  // Ember pose: hash-seeded helical rise, gust subset, fountain kick on
  // cycles born in the crack window. Returns brightness for instanceColor.
  private emberPose(i: number, t: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);
    const w = frac(i * 0.7548776662);
    const v = frac(i * 0.3249196962);
    const big = i < 6; // foreground bloom embers
    const life = 3.6 + 2.6 * w;
    const tt = frac((t + u * life * 7.0) / life) * life; // age in cycle
    const bt = t - tt; // birth time of this cycle
    // fountain: cycles born in the crack window get velocity + brightness
    const born = ss(9.55, 9.9, bt) * (1 - ss(11.6, 12.2, bt));
    const kick = 1 + 2.1 * born;
    // buoyant rise + helical draft + per-ember turbulence
    const rise = (2.1 + 1.5 * w) * kick;
    const helixA = 1.6 + 2.6 * u + 3.0 * (tt / life);
    const helixF = 1.6 + 1.7 * v;
    const turb = 0.55 * Math.sin(tt * (5.0 + 4.0 * v) + u * 37.0) * Math.exp(-tt * 0.35);
    const gust = v < 0.12 ? gustT(bt + tt) * (2.2 + 1.4 * w) : gustT(bt + tt) * 0.4;
    const y = FIRE_Y + 0.02 + (rise * tt + gust * tt * 0.9) / (PH / 100.0) * 0.01
            + tt * (rise * 0.028) ; // uv-height climb
    const x = FIRE_X + (u - 0.5) * 0.05
            + (Math.sin(tt * helixF + u * 6.28) * helixA + turb) * 0.004
            + gustT(bt + tt) * 0.018 * Math.sin(u * 6.28);
    uvToWorld(x, y, out);
    out.z += 3.0 + v * 8.0 + (big ? 16.0 : 0.0);
    // brightness envelope: flash -> steady -> crackle decay -> ash
    const ph = tt / life;
    const flash = ss(0.0, 0.05, ph) * 1.6;
    const steady = 1.0 - ss(0.55, 0.8, ph);
    const crackle = 0.75 + 0.25 * Math.sin(tt * (17.0 + 9.0 * v) + u * 50.0) * ss(0.3, 0.55, ph);
    const ash = 1.0 - ss(0.78, 1.0, ph);
    const b = clamp01((flash + steady) * 0.55) * crackle * ash * (0.55 + 0.9 * born);
    return { scale: (big ? 3.2 : 0.7 + 0.9 * v) * (0.5 + 0.5 * ash), b, born };
  }

  // Moth pose: one orbit of the light cone, 11.5–17.5s.
  private mothPose(i: number, t: number, out: THREE.Vector3) {
    const u = frac(i * 0.4142135623);
    const w = frac(i * 0.7320508075);
    const gate = mothT(t);
    if (gate <= 0.01) { out.set(0, -999, 0); return { live: false, flap: 0 }; }
    const dt = t - 11.5;
    const ang = u * 6.28 + dt * (1.9 + 0.5 * w);
    const rad = 4.5 + 2.5 * w - dt * 0.35;
    const cx = 0.5 + Math.cos(ang) * rad * 0.0028;
    const cy = 0.30 + Math.sin(ang) * rad * 0.0016 + 0.01 * Math.sin(dt * 7.0 + u * 20.0);
    uvToWorld(cx, cy, out);
    out.z += 12.0;
    const flap = Math.sin(dt * (26.0 + 8.0 * w) + u * 30.0);
    return { live: true, flap };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uGust.value = gustT(t);
    this.u.uCrack.value = crackT(t);
    this.u.uBurst.value = burstT(t);
    this.u.uSettle.value = settleT(t);

    for (let i = 0; i < EMBERS; i++) {
      const ep = this.emberPose(i, t, this.p);
      if (ep.b <= 0.003) { this.m.makeScale(0, 0, 0); this.embers.setMatrixAt(i, this.m); continue; }
      this.sv.set(ep.scale, ep.scale, ep.scale);
      this.m.compose(this.p, this.q.identity(), this.sv);
      this.embers.setMatrixAt(i, this.m);
      // white-hot core -> orange -> dim ash red
      this.c.setRGB(1.0, 0.55 + 0.35 * ep.b, 0.15 + 0.55 * ep.b).multiplyScalar(0.25 + ep.b * 1.9);
      this.embers.setColorAt(i, this.c);
    }
    this.embers.instanceMatrix.needsUpdate = true;
    if (this.embers.instanceColor) this.embers.instanceColor.needsUpdate = true;

    for (let i = 0; i < MOTHS; i++) {
      const mp = this.mothPose(i, t, this.p);
      if (!mp.live) { this.m.makeScale(0, 0, 0); this.moths.setMatrixAt(i, this.m); continue; }
      this.e.set(0, 0, mp.flap * 0.7);
      this.q.setFromEuler(this.e);
      this.sv.set(1.0 + Math.abs(mp.flap) * 0.4, 0.5 + Math.abs(mp.flap) * 0.6, 1.0);
      this.m.compose(this.p, this.q, this.sv);
      this.moths.setMatrixAt(i, this.m);
    }
    this.moths.instanceMatrix.needsUpdate = true;

    // camera: breath drift; shake impulse at the crack; slow push into the
    // fire during the burst, easing back on the settle.
    const push = ss(9.6, 13.5, t) * (1 - ss(15.0, 18.5, t) * 0.5);
    const shakeT = Math.max(0, t - 9.7);
    const shake = Math.exp(-shakeT * 2.4) * crackT(t) * 1.4;
    this.cam.position.set(
      0.8 * Math.sin(t * 0.06) + shake * Math.sin(t * 31.0),
      6.0 - 1.0 * push + 0.3 * Math.sin(t * 0.08 + 1.0) + shake * Math.sin(t * 41.0) * 0.5,
      25.0 - 5.0 * push,
    );
    this.cam.lookAt(
      0.6 * Math.sin(t * 0.04) - 1.5 * push,
      10.0 - 5.0 * push + 1.0 * settleT(t),
      PZ + 20,
    );

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.58 + 0.06 * burstT(t),
      bloom: 0.5 + 0.25 * burstT(t),
      bloomThreshold: 0.5,
      bloomRadius: 0.75,
      ca: 0.06 + 0.08 * crackT(t),
      grain: 0.06,
      vignette: 0.55,
      level:
        ss(0, 0.8, t) * (this.ctx.end >= 19.9 ? 1 - ss(20.0 - 0.8, 20.0, t) : 1),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.embers.dispose();
    this.moths.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

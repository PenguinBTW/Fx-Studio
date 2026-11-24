// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// petalfall — cherry-blossom petals drifting through a twilight garden.
// Backdrop shader: dusk gradient, faint blue moon-haze in the top corner,
// out-of-focus tree silhouettes, a warm lantern glow low in frame. ~220
// instanced petals on closed-form flutter paths — falling + swaying +
// tumbling (fake 3D via squash/skew of an ellipse silhouette drawn in the
// instance fragment shader). Petals are pink-white with a darker rim and a
// warm edge glint when the tumble catches the lantern light. A breeze gust
// envelope swells the drift mid-take. Everything is f(t) — no accumulators.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

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

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;

  // --- twilight sky -------------------------------------------------------
  vec3 plum   = vec3(0.10, 0.055, 0.10);
  vec3 dusk   = vec3(0.19, 0.09, 0.13);
  vec3 indigo = vec3(0.06, 0.07, 0.17);
  vec3 col = mix(vec3(0.028, 0.018, 0.035), plum,  smoothstep(0.10, 0.34, y));
  col = mix(col, dusk,   smoothstep(0.40, 0.62, y));
  col = mix(col, indigo, smoothstep(0.66, 1.00, y));

  // faint blue moon-haze in the top-left corner — the cold accent
  // (uv must stay inside the camera's ~0.29–0.71 x window on the backdrop)
  vec2 md = vec2((x - 0.33) * 2.2, y - 0.82);
  float moonHaze = exp(-dot(md, md) * 3.0);
  col += vec3(0.30, 0.38, 0.62) * moonHaze * 0.55;
  // thin bright moon sliver inside the haze
  vec2 ms = vec2((x - 0.335) * 2.2, y - 0.825);
  float sliver = (1.0 - smoothstep(0.016, 0.026, length(ms))) * 0.7;
  sliver *= 1.0 - smoothstep(0.014, 0.028, length(ms - vec2(0.010, 0.006)));
  col += vec3(0.75, 0.80, 0.95) * sliver;

  // --- warm lantern glow low in frame -------------------------------------
  // swells gently through the dense beat (t ~ 12–16)
  float lant = 0.75 + 0.25 * smoothstep(10.0, 13.0, t) * (1.0 - smoothstep(16.0, 19.0, t));
  vec2 ld = vec2((x - 0.63) * 2.2, y - 0.30);
  float lg = exp(-dot(ld, ld) * 4.5);
  col += vec3(0.95, 0.45, 0.12) * lg * 0.55 * lant;
  // lantern body — a small glowing paper diamond
  vec2 lb = vec2((x - 0.63) * 30.0, (y - 0.30) * 30.0);
  float lbody = 1.0 - smoothstep(0.55, 0.75, abs(lb.x) + abs(lb.y) * 1.6);
  col += vec3(1.0, 0.62, 0.22) * lbody * (0.85 + 0.15 * sin(t * 7.0)) * lant;
  // faint halo ring
  col += vec3(0.9, 0.4, 0.1) * exp(-dot(ld, ld) * 18.0) * 0.5 * lant;

  // --- out-of-focus tree silhouettes --------------------------------------
  // two blurred dark banks; the top edge undulates like foliage bokeh
  float tr = 0.30 + 0.035 * vnoise(x * 9.0 + 3.1) + 0.018 * vnoise(x * 23.0 + 7.7);
  float tree = 1.0 - smoothstep(tr - 0.014, tr + 0.014, y);       // soft DoF edge
  col = mix(col, vec3(0.022, 0.014, 0.018), tree * 0.95);
  // second nearer bank with a few trunk strokes, even darker
  float tr2 = 0.16 + 0.025 * vnoise(x * 14.0 + 11.3);
  float tree2 = 1.0 - smoothstep(tr2 - 0.010, tr2 + 0.010, y);
  float trunk = tree2 * smoothstep(0.90, 0.98, vnoise(x * 55.0)) * smoothstep(0.04, 0.13, y);
  col = mix(col, vec3(0.014, 0.009, 0.011), max(tree2 * 0.92, trunk * 0.6));

  // ground haze at the very bottom
  col = mix(col, vec3(0.05, 0.03, 0.05), (1.0 - smoothstep(0.0, 0.10, y)) * 0.7);

  fragColor = vec4(col, 1.0);
}`;

// Petal instance shader: ellipse silhouette with a cleft tip, darker rim,
// warm glint edge. aTint carries per-petal tint; aGlint the tumble glint.
const PETAL_VERT = /* glsl */ `
out vec2 vUv;
out vec3 vTint;
out float vGlint;
attribute vec3 aTint;
attribute float aGlint;
void main() {
  vUv = uv;
  vTint = aTint;
  vGlint = aGlint;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const PETAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vTint;
in float vGlint;
out vec4 fragColor;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // petal: tall ellipse, slightly pinched at the base, cleft tip on top
  float d = length(vec2(p.x * 1.18, (p.y + 0.06) * 1.42));
  float body = 1.0 - smoothstep(0.80, 0.88, d);
  float notch = 1.0 - smoothstep(0.08, 0.22, length(p - vec2(0.0, 0.60)));
  float shape = body * (1.0 - notch);
  if (shape < 0.01) discard;
  // petal vein shading — a soft central crease
  float vein = exp(-p.x * p.x * 30.0) * smoothstep(-0.85, 0.3, p.y) * (1.0 - smoothstep(0.3, 0.85, p.y));
  vec3 col = vTint * (1.0 - vein * 0.10);
  // darker rim
  float rim = smoothstep(0.58, 0.86, d) * body;
  col = mix(col, vTint * vec3(0.62, 0.42, 0.55), rim * 0.75);
  // warm edge glint when the tumble catches the lantern
  col += vec3(1.0, 0.80, 0.50) * rim * vGlint;
  fragColor = vec4(col, shape * 0.96);
}`;

const PETALS = 220;
// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;

// Lantern world position (must match the shader's 0.63/0.30 uv).
const LANTERN = { x: (0.63 - 0.5) * PW, y: PY + (0.30 - 0.5) * PH };

// Breeze gust envelope: light baseline breathing + the mid-take swell at
// ~t 6–13 that lifts drift speed and sway amplitude, settling by 18.
const gust = (t: number) =>
  0.30 + 0.09 * Math.sin(t * 0.8) + 0.07 * Math.sin(t * 0.47 + 1.2)
  + 0.70 * ss(5.5, 8.0, t) * (1 - ss(12.5, 15.5, t));

// Precomputed integral of the fall-speed factor (0.8 + 0.4·gust) so the
// fall distance stays a pure lookup of t — sampled once at setup.
const GUST_DT = 0.02, GUST_T0 = -2, GUST_N = Math.ceil(26 / GUST_DT);
const gustTable = new Float32Array(GUST_N + 1);
{
  for (let i = 1; i <= GUST_N; i++) {
    const tt = GUST_T0 + i * GUST_DT;
    gustTable[i] = gustTable[i - 1]! + (0.8 + 0.4 * gust(tt)) * GUST_DT;
  }
}
const gustInt = (t: number): number => {
  const u = Math.min(GUST_N - 0.001, Math.max(0, (t - GUST_T0) / GUST_DT));
  const i = Math.floor(u), f = u - i;
  return gustTable[i]! * (1 - f) + gustTable[i + 1]! * f;
};

interface PetalSeed {
  x0: number;     // base horizontal anchor (uv-ish -0.55..0.55 world fraction)
  onset: number;  // when the petal enters the top of frame
  life: number;   // total fall duration before it fades
  fallV: number;  // fall speed
  swayA: number;  // sway amplitude
  swayF: number;  // sway frequency
  swayP: number;  // sway phase
  tumR: number;   // tumble rate
  tumP: number;   // tumble phase
  rotA: number;   // base rotation amplitude
  z: number;      // depth (parallax)
  size: number;
  tint: THREE.Color;
}

const seeds: PetalSeed[] = [];
{
  const tintA = new THREE.Color(0.72, 0.40, 0.50); // pink-white
  const tintB = new THREE.Color(0.50, 0.20, 0.30); // deeper rose
  for (let i = 0; i < PETALS; i++) {
    const s1 = frac(i * 0.6180339887);
    const s2 = frac(i * 0.7548776662);
    const s3 = frac(i * 0.5698402909);
    const s4 = frac(i * 0.3819660113);
    const s5 = frac(i * 0.9372549019);
    // The first third is mid-flight at t=0 and lives out the take; the rest
    // arrive through the gust window and live short, so t=14 reads dense and
    // t=18 thins out as they dissolve mid-air.
    seeds.push({
      x0: (s1 - 0.5) * 1.1,
      onset: s2 < 0.15 ? -(6 + s2 * 8) : 6.0 + Math.pow(s2, 1.3) * 8.0,
      life: s2 < 0.15 ? 16.0 + s3 * 6.0 : 4.0 + s3 * 5.0,
      // the early cohort drifts slowly (already mid-flight); gust-window
      // petals fall faster so the frame fills top-to-bottom
      fallV: s2 < 0.15 ? 1.4 + s4 * 1.4 : 4.0 + s4 * 3.0,
      swayA: 6.0 + s5 * 9.0,
      swayF: 0.55 + s1 * 0.9,
      swayP: s3 * Math.PI * 2,
      tumR: 1.1 + s4 * 2.2,
      tumP: s5 * Math.PI * 2,
      rotA: 0.5 + s2 * 0.9,
      z: -72 + s3 * 46,        // -72 … -26, nearer petals read bigger
      size: 0.55 + s4 * 0.55,
      tint: tintA.clone().lerp(tintB, s5 * s5),
    });
  }
}

export default class PetalfallScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };
  private petals: THREE.InstancedMesh;
  private aTint: THREE.InstancedBufferAttribute;
  private aGlint: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private scl = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    const geo = new THREE.PlaneGeometry(1.7, 1.25);
    this.aTint = new THREE.InstancedBufferAttribute(new Float32Array(PETALS * 3), 3);
    this.aGlint = new THREE.InstancedBufferAttribute(new Float32Array(PETALS), 1);
    for (let i = 0; i < PETALS; i++) {
      const t = seeds[i]!.tint;
      this.aTint.setXYZ(i, t.r, t.g, t.b);
    }
    this.aGlint.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTint', this.aTint);
    geo.setAttribute('aGlint', this.aGlint);

    const mat = new THREE.ShaderMaterial({
      vertexShader: PETAL_VERT,
      fragmentShader: PETAL_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.petals = new THREE.InstancedMesh(geo, mat, PETALS);
    this.petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.petals.frustumCulled = false;
    this.three.add(this.petals);
  }

  // Closed-form petal transform. Life starts at onset; the petal enters
  // above the frame and exits below, so it never pops on-screen. The gust
  // multiplies sway amplitude and drift; glint peaks when the tumble phase
  // lines up and the petal is near the lantern's world position.
  private place(i: number, t: number, g: number): void {
    const s = seeds[i]!;
    const life = t - s.onset;
    if (life <= 0 || life > s.life) {
      this.m.makeScale(0, 0, 0);
      this.petals.setMatrixAt(i, this.m);
      this.aGlint.setX(i, 0);
      return;
    }
    // falling + swaying + a slow gust-driven lateral drift
    const u0 = s.x0 + g * 0.06 * life * (s.swayP > Math.PI ? 1 : -1);
    // wrap span must exceed the widest view slice (~±62 world at z=-72)
    // so a wrapping petal is never teleported inside the frame
    const wx = (frac(u0 + 0.5) - 0.5) * PW * 0.55;
    // fall distance integrates the gust factor over the petal's own window
    // — applying the fading gust to the whole life would lift petals back up
    const wy = 48.0 - s.fallV * (gustInt(t) - gustInt(s.onset));
    const x = wx + s.swayA * (0.6 + 0.7 * g) * Math.sin(life * s.swayF + s.swayP);
    const y = wy + s.swayA * 0.18 * Math.sin(life * s.swayF * 1.7 + s.swayP * 2.0);

    // tumble: the silhouette wobbles between ellipse orientations
    const tum = t * s.tumR + s.tumP;
    const squash = 0.25 + 0.75 * Math.abs(Math.cos(tum));
    const angle = s.rotA * Math.sin(tum * 0.7) + 0.35 * Math.sin(life * s.swayF + s.swayP);
    this.e.set(0, 0, angle);
    this.q.setFromEuler(this.e);
    const depthScale = 1.0 + (s.z + 72) / 46 * 0.35; // nearer petals ~1.35x
    // petals shrink out across the last 1.5s of their life — no hard pops
    const fade = ss(s.life - 1.5, s.life - 0.4, life);
    const sc = s.size * depthScale * (1 - fade);
    this.scl.set(sc, sc * squash, sc);
    this.v.set(x, y, s.z);
    this.m.compose(this.v, this.q, this.scl);
    this.petals.setMatrixAt(i, this.m);

    // alpha-like fade at life edges via scale (petals shrink out below frame)
    // glint: tumble crest + lantern proximity + lantern swell
    const dL = Math.hypot(x - LANTERN.x, y - LANTERN.y);
    const near = 1.0 - ss(20, 60, dL);
    const lantSwell = 0.4 + 0.6 * ss(10.0, 13.0, t) * (1 - ss(16.0, 19.0, t));
    const glint = Math.pow(Math.max(0, Math.cos(tum)), 10.0) * (0.15 + 0.85 * near) * (0.5 + 0.5 * lantSwell);
    this.aGlint.setX(i, glint);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    const g = gust(t);
    for (let i = 0; i < PETALS; i++) this.place(i, t, g);
    this.petals.instanceMatrix.needsUpdate = true;
    this.aGlint.needsUpdate = true;

    // near-static macro feel: a breath of lateral drift and a slow push
    const push = ss(0, this.ctx.end, t);
    this.cam.position.set(0.7 * Math.sin(t * 0.05), 8.0 - 0.6 * push, 24.0 - 1.0 * push);
    this.cam.lookAt(0, 12.0, PZ);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.5,
      bloom: 0.25,
      bloomThreshold: 0.72,
      bloomRadius: 0.7,
      ca: 0.1,
      grain: 0.05,
      vignette: 0.5,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.petals.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

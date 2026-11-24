// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// petalfall — cherry-blossom petals drifting through a twilight garden.
// Backdrop shader: dusk gradient on a slow warm→cool arc, faint blue
// moon-haze, distant hills in haze, out-of-focus tree silhouettes, a warm
// lantern glow, raked-gravel bands ringing the lantern, a koi pond corner
// (two shadows pass), a white wagtail hopping the gravel edge once, and
// seeded seed-puffs drifting through. ~220 instanced petals on closed-form
// flutter paths — falling + swaying + tumbling (fake 3D via squash/skew of
// an ellipse silhouette drawn in the instance fragment shader); a few catch
// on the lantern cap and dislodge, others settle onto the gravel/pond.
// Petals are pink-white with a darker rim and a warm edge glint when the
// tumble catches the lantern light. A breeze gust envelope swells the drift
// mid-take. CameraRig drifts toward the lantern and tilts up into the
// falling column. Everything is f(t) — no accumulators.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { CameraRig } from '../../engine/rig';
import { Layer2D, W, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';

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
float pow2(float a) { return a * a; }

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

  // warm→cool arc: a low ember glow early that cools into late dusk
  float warm = 1.0 - smoothstep(5.0, 15.0, t);
  col += vec3(0.30, 0.12, 0.04) * warm * (1.0 - smoothstep(0.28, 0.60, y)) * 0.5;
  col = mix(col, col * vec3(0.86, 0.92, 1.12), (1.0 - warm) * 0.35);

  // faint blue moon-haze in the top-left corner — the cold accent
  // (uv must stay inside the camera's ~0.29–0.71 x window on the backdrop)
  vec2 md = vec2((x - 0.33) * 2.2, y - 0.78);
  float moonHaze = exp(-dot(md, md) * 3.0);
  col += vec3(0.30, 0.38, 0.62) * moonHaze * 0.55;
  // thin bright moon sliver inside the haze
  vec2 ms = vec2((x - 0.335) * 2.2, y - 0.785);
  float sliver = (1.0 - smoothstep(0.016, 0.026, length(ms))) * 0.7;
  sliver *= 1.0 - smoothstep(0.014, 0.028, length(ms - vec2(0.010, 0.006)));
  col += vec3(0.75, 0.80, 0.95) * sliver;

  // --- warm lantern glow low in frame -------------------------------------
  // swells gently through the dense beat (t ~ 12–16)
  float lant = 0.75 + 0.25 * smoothstep(10.0, 13.0, t) * (1.0 - smoothstep(16.0, 19.0, t));
  vec2 ld = vec2((x - 0.63) * 2.2, y - 0.38);
  float lg = exp(-dot(ld, ld) * 4.5);
  col += vec3(0.95, 0.45, 0.12) * lg * 0.55 * lant;
  // lantern body — a small glowing paper diamond (above the tree bank
  // edge ~0.35 uv so the silhouettes don't overwrite it)
  vec2 lb = vec2((x - 0.63) * 30.0, (y - 0.38) * 30.0);
  float lbody = 1.0 - smoothstep(0.55, 0.75, abs(lb.x) + abs(lb.y) * 1.6);
  col += vec3(1.0, 0.62, 0.22) * lbody * (0.85 + 0.15 * sin(t * 7.0)) * lant;
  // faint halo ring
  col += vec3(0.9, 0.4, 0.1) * exp(-dot(ld, ld) * 18.0) * 0.5 * lant;

  // --- distant hills in dusk haze ------------------------------------------
  float hillTop = 0.36 + 0.03 * vnoise(x * 4.0 + 9.0) + 0.012 * vnoise(x * 17.0 + 4.0);
  float hills = smoothstep(0.30, 0.34, y) * (1.0 - smoothstep(hillTop - 0.004, hillTop + 0.03, y));
  col = mix(col, vec3(0.085, 0.060, 0.115), hills * 0.55);

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

  // --- raked gravel ground -------------------------------------------------
  float gravel = 1.0 - smoothstep(0.24, 0.27, y);
  vec3 sand = vec3(0.21, 0.155, 0.175);
  float lines = sin(y * 190.0 + 2.5 * sin(x * 30.0));
  vec2 lc = vec2((x - 0.63) * 2.2, y - 0.04);
  float arcs = sin(length(lc) * 300.0);
  float nearL = 1.0 - smoothstep(0.05, 0.11, length(lc));
  sand *= 0.72 + 0.28 * mix(lines, arcs, nearL);
  // cool moon sheen across the upper gravel
  sand += vec3(0.05, 0.06, 0.09) * smoothstep(0.02, 0.15, y);
  col = mix(col, sand, gravel * 0.94);

  // --- koi pond tucked in the near-left corner -----------------------------
  vec2 pq = (vUv - vec2(0.35, 0.115)) * vec2(2.0, 1.0);
  float pond = 1.0 - smoothstep(0.10, 0.13, length(pq));
  col = mix(col, vec3(0.048, 0.075, 0.125), pond * 0.95);
  col += vec3(0.40, 0.45, 0.60) * pond * exp(-dot(pq - vec2(0.02, 0.02), pq - vec2(0.02, 0.02)) * 22.0) * 0.5;
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float kph = (t - (2.5 + fk * 4.5)) / 9.0;
    if (kph > 0.0 && kph < 1.0) {
      vec2 kp = vec2(0.315 + 0.08 * kph + 0.012 * sin(t * 0.8 + fk * 2.0),
                     0.115 + 0.020 * fk + 0.007 * sin(t * 0.9 + fk));
      vec2 kd = (vUv - kp) * vec2(2.4, 7.0);
      float koi = 1.0 - smoothstep(0.014, 0.024, length(kd));
      col = mix(col, vec3(0.015, 0.020, 0.040), koi * pond * 0.85);
    }
  }

  // --- white wagtail: pause-hop-pause along the gravel edge, once ----------
  float hopW = (t - 7.5) / 6.0;
  if (hopW > 0.0 && hopW < 1.0) {
    float hops = hopW * 5.0;
    float hi = floor(hops);
    float hf = fract(hops);
    float bx = 0.33 + 0.026 * hi + 0.026 * smoothstep(0.0, 0.45, hf);
    float hop = 0.018 * max(0.0, sin(clamp(hf, 0.0, 0.55) / 0.55 * 3.1416));
    vec2 bd = (vUv - vec2(bx, 0.225 + hop)) * vec2(2.6, 1.6);
    float birdB = 1.0 - smoothstep(0.014, 0.024, length(bd));
    float tailW = (1.0 - smoothstep(0.0, 0.003, abs(bd.y - bd.x * 0.45)))
                * step(0.008, bd.x) * step(bd.x, 0.035);
    // white wagtail: pale body, dark tail
    col = mix(col, vec3(0.62, 0.62, 0.66), birdB * 0.85);
    col = mix(col, vec3(0.03, 0.028, 0.040), tailW * 0.9);
  }

  // --- seed-puffs drifting through on the same breeze ----------------------
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float pph = (t - (3.0 + fk * 4.6)) / 9.0;
    if (pph > 0.0 && pph < 1.0) {
      vec2 pp = vec2(0.72 - 0.45 * pph + 0.03 * sin(t * 0.4 + fk * 3.0),
                     0.34 + 0.10 * hash1(fk * 7.7) + 0.04 * sin(t * 0.5 + fk * 1.7) - 0.08 * pph);
      vec2 pd2 = (vUv - pp) * vec2(2.2, 1.0);
      col += vec3(0.85, 0.80, 0.75) * exp(-dot(pd2, pd2) / 0.0005) * 0.3;
    }
  }

  // drifting petal-layer fog hugging the gravel and the pond edge
  float fog = (1.0 - smoothstep(0.0, 0.24, y))
            * (0.35 + 0.30 * vnoise(x * 6.0 - t * 0.35) + 0.15 * vnoise(x * 16.0 + t * 0.2));
  col = mix(col, vec3(0.13, 0.085, 0.12), fog * 0.55);

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
  // petal: blossom silhouette — tall ellipse with a 5-fold lobed edge,
  // slightly pinched at the base, cleft tip on top
  float d = length(vec2(p.x * 1.18, (p.y + 0.06) * 1.42));
  d -= 0.05 * sin(atan(p.y + 0.06, p.x) * 5.0);
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

const PETALS = 150;
// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;

// Lantern world position (must match the shader's 0.63/0.38 uv).
const LANTERN = { x: (0.63 - 0.5) * PW, y: PY + (0.38 - 0.5) * PH };

// Breeze gust envelope: light baseline breathing + the mid-take swell at
// ~t 6–13 that lifts drift speed and sway amplitude, settling by 18.
const gust = (t: number) =>
  0.30 + 0.09 * Math.sin(t * 0.8) + 0.07 * Math.sin(t * 0.47 + 1.2)
  + 0.70 * ss(5.5, 8.0, t) * (1 - ss(12.5, 15.5, t));

// Precomputed integral of the fall-speed factor (0.8 + 0.4·gust) so the
// fall distance stays a pure lookup of t — sampled once at setup.
// T0 must precede the earliest onset (-7.2) or early petals get a zero
// fall distance and hover at the top edge until playback starts.
const GUST_DT = 0.02, GUST_T0 = -16, GUST_N = Math.ceil(42 / GUST_DT);
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
  // surface-interaction subsets — seeded once so the flight profile can
  // guarantee the petal reaches its target before it fades
  caught: boolean;   // catches on the lantern cap, then dislodges
  settle: boolean;   // settles flat onto the gravel
  pondRest: boolean; // settles onto the pond corner
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
    // t=18 thins out as they dissolve mid-air. The caught/settle subsets get
    // a longer life and a faster fall so the closed-form path provably
    // reaches its surface (lantern ~53 world, gravel ~75, pond ~94) inside
    // the lifetime — otherwise they would shrink out mid-air.
    const caught = i % 29 === 0;
    const pondRest = i % 37 === 0;
    const settle = i % 13 === 0 || pondRest;
    seeds.push({
      x0: (s1 - 0.5) * 1.1,
      onset: caught || settle ? 4.0 + s2 * 4.0 : (s2 < 0.15 ? -(6 + s2 * 8) : 6.0 + Math.pow(s2, 1.3) * 8.0),
      life: caught ? 9.0 + s3 * 3.0 : settle ? 11.0 + s3 * 4.0 : (s2 < 0.15 ? 16.0 + s3 * 6.0 : 4.0 + s3 * 5.0),
      // the early cohort drifts slowly (already mid-flight); gust-window
      // petals fall faster so the frame fills top-to-bottom
      fallV: pondRest ? 9.0 + s4 * 1.5 : caught || settle ? 7.5 + s4 * 2.0 : s2 < 0.15 ? 1.4 + s4 * 1.4 : 4.0 + s4 * 3.0,
      swayA: 6.0 + s5 * 9.0,
      swayF: 0.55 + s1 * 0.9,
      swayP: s3 * Math.PI * 2,
      tumR: 1.1 + s4 * 2.2,
      tumP: s5 * Math.PI * 2,
      rotA: 0.5 + s2 * 0.9,
      z: -72 + s3 * 46,        // -72 … -26, nearer petals read bigger
      size: 0.55 + s4 * 0.55,
      tint: tintA.clone().lerp(tintB, s5 * s5),
      caught, settle, pondRest,
    });
  }
}

const CAPTIONS: Array<[number, number, string]> = [
  [1.0, 4.5, 'the garden holds its breath'],
  [6.5, 10.5, 'a gust loosens the canopy'],
  [14.5, 19.0, 'petals settle where the koi pass'],
];

export default class PetalfallScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private rig = new CameraRig();
  private layer = new Layer2D(W, H);
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
    let wx = (frac(u0 + 0.5) - 0.5) * PW * 0.55;
    // fall distance integrates the gust factor over the petal's own window
    // — applying the fading gust to the whole life would lift petals back up
    let wy = 48.0 - s.fallV * (gustInt(t) - gustInt(s.onset));
    // a few petals catch on the lantern cap, rock, then dislodge on the next
    // gust front; others settle onto the gravel or the pond corner and rest
    // flat until they fade — all keyed off the seed index, still closed-form
    const { caught, settle, pondRest } = s;
    let grounded = false;
    if (caught && wy < LANTERN.y + 4.0) {
      const rel = s.onset + s.life * 0.78;
      if (t < rel) {
        wx = LANTERN.x + 2.0 + 2.0 * Math.sin(t * 1.7 + s.swayP);
        wy = LANTERN.y + 3.5 + 0.8 * Math.sin(t * 2.3 + s.swayP * 2.0);
      } else {
        wy = LANTERN.y + 3.5 - s.fallV * 0.5 * (t - rel);
      }
    } else if (settle) {
      const gy = pondRest ? -46.0 : -27.0 - frac(i * 0.318) * 6.0;
      if (wy < gy) {
        wy = gy;
        grounded = true;
        if (pondRest) wx = Math.max(-62.0, Math.min(-31.0, wx)); // pond corner
      }
    }
    const swayK = grounded ? 0.04 : 1.0;
    const x = wx + s.swayA * (0.6 + 0.7 * g) * Math.sin(life * s.swayF + s.swayP) * swayK;
    const y = wy + s.swayA * 0.18 * Math.sin(life * s.swayF * 1.7 + s.swayP * 2.0) * swayK;

    // tumble: the silhouette wobbles between ellipse orientations
    const tum = t * s.tumR + s.tumP;
    const squash = (0.25 + 0.75 * Math.abs(Math.cos(tum))) * (grounded ? 0.35 : 1.0);
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

    // CameraRig: slow drift toward the lantern with a tilt up into the
    // falling column during the crescendo, easing back for the settle
    const push = ss(0, this.ctx.end, t);
    this.rig.position = [0.7 * Math.sin(t * 0.05) + 14.0 * ss(5, 16, t), 8.0 - 0.6 * push, 24.0 - 1.0 * push];
    this.rig.target = [26.0 * ss(5, 15, t), 3.0 + 11.0 * ss(10, 15, t) - 4.0 * ss(16, this.ctx.end, t), PZ];
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);

    // probe captions (textProbes auto-emit via the main.ts canvas hook)
    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // knockout halo: 12px stroke = ~6px outside glyph edges
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(5, 6, 10, 0.9)';
        c.lineWidth = 12;
        const cx = W / 2, cy = H * 0.85;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f2ecea';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }
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
    this.layer.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

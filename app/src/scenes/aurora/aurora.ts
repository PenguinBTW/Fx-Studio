// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// aurora — arctic night: layered aurora curtains over a snow ridgeline.
// A single GLSL backdrop pass draws the night gradient, hash stars, slow
// meteors, the moonlit ridge + spruce silhouette and the icy tarn band.
// The curtains themselves are Bishop-parallel-transported ribbons
// (engine RibbonGeometry): each spine is a closed-form path across the
// sky, the strip hangs vertical (initialNormal → binormal ≈ +Y), and a
// bespoke shader gives it the emerald→violet→teal spectral ramp with
// per-vertex fbm shimmer + precipitation striations. CameraRig dollies
// in slowly and tilts up for the corona beat. All motion is f(t).
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
import { RibbonGeometry } from '../../engine/ribbon';
import { F } from '../../engine/type';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import type { V3 } from '../../engine/util';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// deterministic hash → [0,1)
const h1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

/* ---------------- backdrop: sky + ridge + tarn ------------------------- */

// uv space: y<0.10 tarn, 0.10..0.30 ridge/trees, above sky.

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uGlow;   // horizon aurora glow envelope 0..1
uniform vec3 uTint;    // dominant curtain colour for sky spill + tarn
uniform float uCorona; // overhead corona envelope — brightens zenith

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

// Snow ridgeline silhouette height at uv.x — ridged fbm, crisp crest.
float ridgeH(float x) {
  float n = fbm3(vec3(x * 6.0, 3.7, 0.0), 4);
  float crest = 1.0 - abs(n);
  return 0.18 + crest * crest * 0.13 + 0.04 * fbm3(vec3(x * 22.0, 9.1, 0.0), 3);
}

// One meteor: streak along a short diagonal, window-faded, trail behind head.
float meteor(vec2 uv, float t, float seed) {
  float t0 = 2.0 + h1(seed + 1.0) * 17.0;          // fire time
  float dur = 0.55 + 0.5 * h1(seed + 2.0);
  float lt = (t - t0) / dur;
  if (lt < 0.0 || lt > 1.0) return 0.0;
  vec2 dir = normalize(vec2(-0.55 - 0.3 * h1(seed + 3.0), -0.35 - 0.2 * h1(seed + 4.0)));
  vec2 p0 = vec2(0.15 + 2.9 * h1(seed + 5.0), 0.72 + 0.22 * h1(seed + 6.0));
  float speed = 0.42;
  vec2 head = p0 + dir * speed * lt;
  float trail = 0.05 + 0.05 * h1(seed + 7.0);
  vec2 rel = uv - head;
  float along = dot(rel, dir);
  float perp = abs(dot(rel, vec2(-dir.y, dir.x)));
  float body = (1.0 - smoothstep(0.0, trail, -along)) * step(along, 0.0);
  float core = 1.0 - smoothstep(0.0, 0.0022, perp);
  float fade = sin(lt * 3.14159);
  return body * core * fade * (0.4 + 1.6 * exp(min(along, 0.0) * 60.0));
}

void main() {
  vec2 uv = vUv;
  // Aspect-corrected space for stars/meteors — uv.x spans the whole 420×130
  // plane, so raw-uv patterns would stretch 3.23× horizontally.
  vec2 su = vec2(uv.x * 3.2308, uv.y);
  float t = uT;

  // --- sky: near-black indigo, teal horizon lift, faint violet crown ---
  vec3 c = mix(vec3(0.012, 0.016, 0.035), vec3(0.002, 0.004, 0.012), smoothstep(0.12, 0.9, uv.y));
  c += vec3(0.008, 0.05, 0.055) * (1.0 - smoothstep(0.15, 0.55, uv.y)) * (0.35 + 0.65 * uGlow); // horizon lift
  c += vec3(0.02, 0.012, 0.05) * smoothstep(0.6, 1.0, uv.y) * 0.5;                         // violet crown
  // horizon aurora pre-glow: a soft green band that breathes before curtains
  float bandD = (uv.y - 0.50) * 11.0;
  float band = exp(-bandD * bandD);
  float bandN = 0.6 + 0.4 * fbm3(vec3(uv.x * 5.0, t * 0.13, 1.0), 3);
  c += vec3(0.06, 0.5, 0.32) * band * bandN * uGlow * 0.4;
  // corona spill high in frame once the sky opens overhead
  c += uTint * 0.22 * uCorona * smoothstep(0.55, 1.0, uv.y) * (0.5 + 0.5 * fbm3(vec3(uv * 3.0, t * 0.2), 3));

  // --- stars: hash grid, twinkle, denser high in frame ---
  if (uv.y > 0.44) {
    vec2 g = su * vec2(140.0, 140.0);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = h21(id);
    if (h > 0.985) {
      vec2 off = vec2(h21(id + 11.0), h21(id + 23.0)) - 0.5;
      float d = length(f - off * 0.8);
      float tw = 0.55 + 0.45 * sin(t * (1.5 + 3.0 * h21(id + 5.0)) + h * 40.0);
      c += vec3(0.9, 0.95, 1.0) * (1.0 - smoothstep(0.0, 0.09, d)) * tw * smoothstep(0.32, 0.7, uv.y) * 0.85;
    }
    // a few brighter stars
    vec2 g2 = su * vec2(40.0, 40.0);
    vec2 id2 = floor(g2);
    vec2 f2 = fract(g2) - 0.5;
    float h2 = h21(id2 + 71.0);
    if (h2 > 0.992) {
      vec2 off2 = vec2(h21(id2 + 3.0), h21(id2 + 9.0)) - 0.5;
      float d2 = length(f2 - off2 * 0.7);
      float tw2 = 0.6 + 0.4 * sin(t * 2.0 + h2 * 60.0);
      c += vec3(1.0) * (1.0 - smoothstep(0.0, 0.045, d2)) * tw2 * 1.4;
    }
    // slow meteors (hashed schedules)
    c += vec3(0.9, 0.97, 1.0) * meteor(su, t, 7.0) * 0.9;
    c += vec3(0.9, 0.97, 1.0) * meteor(su, t, 19.0) * 0.7;
    c += vec3(0.9, 0.97, 1.0) * meteor(su, t, 33.0) * 0.5;
  }

  // --- snow ridgeline + spruce silhouettes ---
  float rh = ridgeH(uv.x);
  if (uv.y < 0.44 && uv.y > 0.15) {
    float below = rh - uv.y;
    if (below > 0.0) {
      // ridge body: moonlit snow that dims downslope into the trees
      float lit = smoothstep(0.0, 0.05, below);
      float crestLight = exp(-below * 34.0);
      // ridge body stays a dark blue-grey mass; only the crest catches snow-light
      vec3 snow = vec3(0.045, 0.06, 0.10) * (0.35 + 0.65 * crestLight);
      snow += vec3(0.02, 0.03, 0.05) * fbm3(vec3(uv.x * 40.0, uv.y * 30.0, 4.0), 3);
      // aurora spill on the crest
      snow += uTint * crestLight * (0.10 + 0.25 * uGlow);
      c = mix(c, snow, lit);
      // sparse spruce teeth along the tarn shore: dark spires, some columns
      // culled so the stand reads as clusters, not a picket fence
      float shore = uv.y - 0.15;
      float col = floor(uv.x * 90.0);
      float treeH = (0.030 + 0.055 * h21(vec2(col, 4.0))) * smoothstep(-0.5, 0.5, h21(vec2(col, 9.0)) - 0.35);
      float tooth = 1.0 - abs(fract(uv.x * 90.0) - 0.5) * 2.0;
      if (shore < tooth * treeH) c = vec3(0.010, 0.016, 0.028);
    }
  }

  // --- icy tarn: near-black mirror with vertical smear of sky + aurora tint ---
  if (uv.y <= 0.15) {
    float d = (0.15 - uv.y) / 0.15;
    vec3 water = vec3(0.003, 0.005, 0.010);
    // smeared reflection of the glow band + curtains
    float smear = fbm3(vec3(uv.x * 14.0, uv.y * 90.0 - t * 0.05, 2.0), 3);
    water += uTint * (0.05 + 0.18 * uGlow) * (0.55 + 0.45 * smear) * (1.0 - d * 0.85);
    water += vec3(0.012, 0.02, 0.03) * smear * 0.5;
    // shore edge line
    water += vec3(0.02, 0.028, 0.04) * (1.0 - smoothstep(0.0, 0.012, 0.15 - uv.y));
    c = mix(c, water, 1.0 - smoothstep(0.0, 0.012, 0.15 - uv.y));
  }

  fragColor = vec4(c, 1.0);
}`;

/* ---------------- aurora ribbon curtains (Bishop RMF) ------------------- */

// Ribbon UVs: u across the strip (altitude proxy), v along the spine path.
const CURTAIN_VERT = /* glsl */ `precision highp float;
precision highp int;
${GLSL_NOISE}
in vec3 position;
in vec2 uv;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uT;
uniform float uShimmer;
out vec2 vUv;
out vec3 vWp;
void main() {
  vUv = uv;
  // per-vertex fbm shimmer: small in-plane curl flutter, stronger aloft
  vec3 p = position;
  vec3 n = curlNoise3(p * 0.08 + vec3(0.0, uT * 0.06, 0.0), uT * 0.05);
  p += n * uShimmer * (0.15 + 0.85 * (1.0 - uv.x));
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// emerald→violet→teal ramp, precipitation striations, path end fades.
const CURTAIN_FRAG = /* glsl */ `precision highp float;
precision highp int;
${GLSL_NOISE}
in vec2 vUv;
in vec3 vWp;
out vec4 fragColor;
uniform float uT;
uniform float uIntensity;
uniform vec3 uSeed;

vec3 ramp(float a) {
  vec3 emerald = vec3(0.05, 0.85, 0.45);
  vec3 violet  = vec3(0.38, 0.22, 0.78);
  vec3 teal    = vec3(0.05, 0.55, 0.62);
  vec3 c = mix(teal, emerald, smoothstep(0.0, 0.3, a));
  return mix(c, violet, smoothstep(0.45, 0.95, a));
}

void main() {
  // Bishop binormal hangs downward: vUv.x = 0 at the TOP edge, 1 at the bottom.
  float alt = 1.0 - vUv.x;  // 0 lower (bright fringe) → 1 upper (rarefied)
  float path = vUv.y;       // along the curtain

  // precipitation striations: vertical rays flickering along the path,
  // two spatial octaves drifting at different rates on closed-form time
  float r1 = sin(path * 90.0 + uSeed.x * 20.0 + fbm3(vec3(path * 8.0, uT * 0.18, uSeed.y * 10.0), 3) * 9.0);
  float r2 = sin(path * 260.0 + uSeed.z * 30.0 - uT * 0.35);
  float striation = 0.55 + 0.30 * r1 + 0.15 * r2;

  // curtain body: bright lower fringe (nitrogen edge), rarefying aloft
  float body = exp(-alt * 2.1);
  float leD = (alt - 0.06) * 14.0;
  float lowerEdge = exp(-leD * leD) * 0.9;

  // folds: slow fbm curtain billow along the path
  float fold = 0.65 + 0.35 * fbm3(vec3(path * 5.0, alt * 2.0, uT * 0.07 + uSeed.x * 5.0), 3);

  // path end fades + altitude edge fades
  float endFade = smoothstep(0.0, 0.04, path) * (1.0 - smoothstep(0.96, 1.0, path));
  float topFade = 1.0 - smoothstep(0.85, 1.0, alt);
  float botFade = smoothstep(0.0, 0.03, alt);

  float a = (body + lowerEdge) * striation * fold * endFade * topFade * botFade;
  vec3 col = ramp(alt) * a * uIntensity;
  fragColor = vec4(col, min(a * uIntensity, 1.0));
}`;

/* ---------------- curtain definitions (all closed-form) ----------------- */

type CurtainDef = {
  geo: RibbonGeometry;
  mat: THREE.RawShaderMaterial;
  mesh: THREE.Mesh;
  env: (t: number) => number; // beat envelope → uIntensity multiplier
};

const PW = 420, PH = 130, PY = 30, PZ = -80;

// Curtain 1 — the first unfurling arc, mid-distance. Spine sweeps across
// the sky; it grows from centre on the beat-1 envelope.
const c1Spine = (t: number, s: number): V3 => {
  const grow = 0.35 + 0.65 * ss(6.5, 10.5, t);
  const x = (s - 0.5) * 95 * grow + 8.0 * Math.sin(t * 0.05);
  const y = 24 + 5.0 * Math.sin(s * 4.2 + t * 0.11) + 2.5 * Math.sin(s * 9.0 - t * 0.07);
  const z = -62 - 7.0 * Math.cos(s * 3.1 + t * 0.06) - 3.0 * Math.sin(s * 5.7 + t * 0.09);
  return [x, y, z];
};

// Curtain 2 — tall distant veil, present from the start (quiet horizon).
const c2Spine = (t: number, s: number): V3 => {
  const x = (s - 0.5) * 150 + 10.0 * Math.sin(t * 0.03);
  const y = 28 + 4.0 * Math.sin(s * 3.0 + t * 0.08);
  const z = -74 - 4.0 * Math.cos(s * 2.4 + t * 0.04);
  return [x, y, z];
};

// Curtain 3 — the corona: spine arcs from behind the ridge up over the
// camera toward zenith, so its rays converge overhead at the last beat.
const c3Spine = (t: number, s: number): V3 => {
  const lift = ss(12.5, 16.5, t); // rises overhead late
  const ang = s * Math.PI * (0.55 + 0.45 * lift);
  const rad = 55 - 20 * lift;
  const x = (s - 0.5) * 30 + 14 * Math.sin(t * 0.04) * (1 - lift);
  const y = 20 + rad * Math.sin(ang) + 6 * Math.sin(s * 6.0 + t * 0.1) * (1 - 0.5 * lift);
  const z = -56 + rad * Math.cos(ang) * 0.6 + 12 * lift;
  return [x, y, z];
};

function makeCurtain(
  spine: (t: number, s: number) => V3,
  halfHeight: number,
  seed: V3,
): CurtainDef {
  const geo = new RibbonGeometry({
    segments: 160,
    spine,
    // strip hangs symmetric ±halfHeight around the spine (curtain height)
    width: (sv: number, t?: number) => {
      const tt = t ?? 0;
      return halfHeight * 2 * (0.85 + 0.15 * Math.sin(sv * 6.0 + tt * 0.15));
    },
    twist: 0,
    initialNormal: [0, 0, 1], // → binormal ≈ +Y: vertical hanging sheet
  });
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: CURTAIN_VERT,
    fragmentShader: CURTAIN_FRAG,
    uniforms: {
      uT: { value: 0 },
      uIntensity: { value: 0 },
      uShimmer: { value: 0.55 },
      uSeed: { value: new THREE.Vector3(seed[0], seed[1], seed[2]) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { geo, mat, mesh, env: () => 1 };
}

/* ---------------- scene ------------------------------------------------- */

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.0, end: 4.6, s: 'a quiet glow on the horizon' },
  { at: 6.8, end: 11.2, s: 'the first curtain unfurls' },
  { at: 13.6, end: 18.6, s: 'the corona overhead' },
];

export default class AuroraScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 }, uGlow: { value: 0 }, uTint: { value: new THREE.Vector3(0.08, 0.6, 0.4) }, uCorona: { value: 0 } };
  private layer = new Layer2D();
  private curtains: CurtainDef[] = [];

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 500);
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // three curtains: distant veil, unfurling arc, overhead corona
    const c2 = makeCurtain(c2Spine, 11, [0.31, 0.77, 0.13]);
    c2.env = (t) => 0.35 + 0.5 * ss(3.5, 7.0, t);
    const c1 = makeCurtain(c1Spine, 15, [0.53, 0.19, 0.87]);
    c1.env = (t) => 0.12 + 1.15 * ss(6.5, 10.5, t);
    const c3 = makeCurtain(c3Spine, 16, [0.71, 0.43, 0.29]);
    c3.env = (t) => 0.05 + 1.6 * ss(12.5, 16.5, t);
    this.curtains = [c2, c1, c3];
    for (const c of this.curtains) this.three.add(c.mesh);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;

    this.u.uT.value = t;
    // beat envelopes on the shared backdrop
    this.u.uGlow.value = 0.45 + 0.55 * ss(4.5, 9.0, t);
    this.u.uCorona.value = ss(12.5, 16.5, t);
    // tint drifts emerald→teal→violet as the display builds
    const k = ss(6, 15, t);
    this.u.uTint.value.set(0.08 + 0.24 * k, 0.6 - 0.3 * k, 0.4 + 0.25 * k);

    for (const c of this.curtains) {
      c.geo.updateFromTime(t);
      c.mat.uniforms.uT!.value = t;
      c.mat.uniforms.uIntensity!.value = c.env(t);
    }

    // slow dolly in + late tilt-up toward the corona
    const push = ss(0, this.ctx.end - this.ctx.start, t);
    const tilt = ss(12.0, 17.0, t);
    this.rig.position = [2.0 * Math.sin(t * 0.045), 1.8 + 1.2 * tilt, 25.0 - 3.5 * push];
    this.rig.target = [0, 16 + 22 * tilt, -70];
    this.rig.roll = 0.008 * Math.sin(t * 0.23);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions — low third, duck with the scene's own fade in/out
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      g.save();
      g.globalAlpha = a;
      const text = c.s.toUpperCase();
      const maxW = this.ctx.W - 48;
      let fs = 48;
      let ls = 7;
      const setFont = () => {
        g.font = `${fs}px "${F.archivo(112, 500)}"`;
        (g as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
      };
      setFont();
      const w = g.measureText(text).width;
      if (w > maxW) {
        fs = Math.max(14, Math.floor((fs * maxW) / w));
        ls = Math.max(1, Math.floor((ls * maxW) / w));
        setFont();
      }
      const tx = this.ctx.W / 2;
      const ty = this.ctx.H - 120;
      g.textAlign = 'center';
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(230,246,240,0.95)';
      g.fillText(text, tx, ty);
      g.restore();
    }
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    const level = ss(0, 1.2, t);
    return {
      exposure: 0.9,
      bloom: 1.0,
      bloomThreshold: 0.4,
      bloomRadius: 0.95,
      ca: 0.06,
      grain: 0.05,
      vignette: 0.4,
      level,
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.texture.dispose();
    for (const c of this.curtains) {
      c.geo.dispose();
      c.mat.dispose();
    }
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

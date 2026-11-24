// koipond — koi gliding under lily pads in a garden pond at dusk, in
// four beats.
//   0–5s    glassy still: teal-centred mirror, warm sky at the edges,
//           willow fronds at the border, pads bobbing, koi shadows below.
//   5–10s   surfacing: koi brighten through the water on wander paths,
//           occasional surface kiss (ring + glint); camera drifts after
//           the hero fish.
//   10–13s  frog plop: pad dips under the frog, it launches off, fat ring.
//   14–20s  dusk gold: one koi leaps ~15s, splash ring; camera pulls back
//           for the full-pond reveal as the gold deepens.
// Backdrop = one GLSL3 quad (water / caustics / rings / willow / shadows).
// Foreground = instanced koi (vertex S-curve) + pads + petals + dragonflies
// + a frog mesh. All closed-form f(t) on hash seeds — no sim.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const hash = (n: number) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// --- narrative envelopes ---------------------------------------------------
const surfT = (t: number) => ss(5.0, 7.0, t);                    // koi rise toward the surface
const kissT = (t: number) => ss(6.0, 7.5, t) * (1 - ss(12.5, 14.0, t)); // kiss rings window
const duskT = (t: number) => ss(13.0, 19.0, t);                  // gold deepening
const pullT = (t: number) => ss(15.5, 19.0, t);                  // pull-back reveal
const frogHopT = (t: number) => ss(11.2, 11.55, t);              // frog launch arc (0→1)
const leapT = (t: number) => ss(14.8, 15.9, t);                  // hero koi leap (0→1)
const rippleT = (t: number) => ss(5.0, 6.5, t);                  // general surface activity
const KOI_N = 5;

// closed-form wander path for fish i — matches the TS pose below
const KOI_VERT = /* glsl */ `
in float aSeed;
out vec2 vUv;
out float vSeed;
uniform float uT;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec3 p = position;
  // S-curve tail wave: amplitude grows toward the tail (uv.x → 0)
  float wave = sin(uv.x * 6.2831 - uT * 6.5 + aSeed * 40.0);
  p.y += wave * 0.14 * (1.0 - uv.x) * (1.0 - uv.x);
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * im * vec4(p, 1.0);
}`;

const KOI_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vSeed;
uniform float uFade;   // surface visibility (deep → bright)
uniform float uDepth;  // how submerged the body reads (0 surfaced, 1 deep)
out vec4 fragColor;
float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  // body: tapered koi shape — uv.x=0 tail … 1 head
  vec2 q = vec2(vUv.x, (vUv.y - 0.5) * 2.0);
  float taper = mix(0.16, 0.42, sin(clamp(q.x, 0.0, 1.0) * 3.14159));
  float body = 1.0 - smoothstep(taper * 0.85, taper, abs(q.y));
  // tail fin: forked lobes at the far end
  float tailZone = 1.0 - smoothstep(0.0, 0.12, q.x);
  float tailLobe = 1.0 - smoothstep(0.20, 0.30, abs(abs(q.y) - 0.16 * tailZone - 0.05));
  float fin = tailZone * tailLobe * 0.8;
  // dorsal/pectoral fins — soft lobes off the flank
  float pect = (1.0 - smoothstep(0.05, 0.12, length(q - vec2(0.62, 0.42))))
             + (1.0 - smoothstep(0.05, 0.12, length(q - vec2(0.62, -0.42))));
  float shape = max(max(body, fin), pect * 0.55);
  if (shape < 0.06) discard;
  // seeded pattern bands: white base, orange patches, black sumi spots
  float sel = floor(h1(vSeed * 3.7) * 3.0); // 0 mostly orange, 1 mostly white, 2 dark
  vec3 white = vec3(0.92, 0.88, 0.82);
  vec3 orange = mix(vec3(0.95, 0.42, 0.08), vec3(0.88, 0.28, 0.04), h1(vSeed * 5.1));
  vec3 black = vec3(0.10, 0.08, 0.07);
  vec3 base = sel < 0.5 ? orange : (sel < 1.5 ? white : white);
  // patch bands along the body — strong orange/white/sumi contrast
  float band = sin(q.x * 9.0 + vSeed * 30.0) * sin(q.y * 6.0 + vSeed * 17.0);
  float patchOn = smoothstep(0.10, 0.40, band);
  vec3 patchCol = sel < 0.5 ? white : orange;
  if (sel > 1.5) patchCol = black;
  vec3 col = mix(base, patchCol, patchOn * (sel < 0.5 ? 0.65 : 0.9));
  // sumi speckle on light fish
  float speck = step(0.955, h1(floor(q.x * 18.0) * 31.0 + floor(q.y * 8.0) * 7.0 + vSeed * 100.0));
  col = mix(col, black, speck * (sel > 0.5 ? 0.7 : 0.2));
  // water tint + dimming by depth; belly lighter, back darker
  col *= mix(1.0, 0.75, clamp(-q.y * 2.0 + 0.5, 0.0, 1.0));
  vec3 waterTint = vec3(0.12, 0.32, 0.34);
  col = mix(col, waterTint * col * 2.2, uDepth * 0.40);
  float alpha = shape * uFade;
  fragColor = vec4(col, alpha);
}`;

const QUAD_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * im * vec4(position, 1.0);
}`;

const PAD_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
float h1v(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q);
  // lily pad: disc with a wedge notch
  float ang = atan(q.y, q.x);
  float notch = smoothstep(0.10, 0.16, abs(mod(ang + 3.14159, 6.28318) - 3.14159));
  float disc = (1.0 - smoothstep(0.82, 0.92, r)) * notch;
  if (disc < 0.04) {
    // lotus blossom zone: the pad instance can carry a flower — drawn by
    // a second discard path handled in TS (blossoms are separate quads)
    discard;
  }
  // veins radiating from the notch centre
  float veins = 0.5 + 0.5 * sin(ang * 14.0);
  vec3 deep = vec3(0.07, 0.16, 0.09);
  vec3 lit = vec3(0.22, 0.38, 0.17);
  vec3 col = mix(deep, lit, veins * 0.35 + 0.35);
  // gold rim kiss on the outer edge
  col += vec3(0.9, 0.7, 0.35) * (1.0 - smoothstep(0.75, 0.88, r)) * 0.10;
  col += vec3(0.9, 0.7, 0.35) * smoothstep(0.72, 0.86, r) * 0.18;
  fragColor = vec4(col, disc * 0.97);
}`;

const BLOSSOM_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uSeed;
out vec4 fragColor;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q);
  float ang = atan(q.y, q.x);
  // two petal rings — 8 outer, 6 inner, slightly rotated
  float p1 = 0.5 + 0.5 * cos(ang * 8.0 + uSeed * 40.0);
  float p2 = 0.5 + 0.5 * cos(ang * 6.0 + 0.6 + uSeed * 40.0);
  float outer = (1.0 - smoothstep(0.42, 0.55, r + p1 * 0.28)) * p1;
  float inner = (1.0 - smoothstep(0.22, 0.34, r + p2 * 0.16)) * p2;
  if (max(outer, inner) < 0.05) discard;
  vec3 petal = mix(vec3(0.98, 0.72, 0.78), vec3(0.98, 0.88, 0.80), r);
  vec3 core = vec3(0.98, 0.80, 0.30);
  vec3 col = mix(core, petal, smoothstep(0.0, 0.30, r));
  col = mix(col, petal * 1.05, outer * 0.5);
  fragColor = vec4(col, max(outer, inner));
}`;

const PETAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uSeed;
out vec4 fragColor;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q * vec2(0.8, 1.3));
  float pet = 1.0 - smoothstep(0.55, 0.8, r);
  if (pet < 0.05) discard;
  fragColor = vec4(mix(vec3(0.95, 0.62, 0.66), vec3(0.99, 0.80, 0.74), q.y + 0.5), pet * 0.9);
}`;

const FLY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  // body: thin capsule along x; wings: two streaks
  float body = 1.0 - smoothstep(0.05, 0.10, abs(q.y) + abs(q.x) * 0.12);
  float wing1 = (1.0 - smoothstep(0.05, 0.16, abs(q.y - 0.18 - q.x * 0.10))) * (1.0 - smoothstep(0.2, 0.8, abs(q.x)));
  float wing2 = (1.0 - smoothstep(0.05, 0.16, abs(q.y + 0.18 + q.x * 0.10))) * (1.0 - smoothstep(0.2, 0.8, abs(q.x)));
  float shape = max(body, max(wing1, wing2) * 0.55);
  if (shape < 0.06) discard;
  vec3 col = mix(vec3(0.25, 0.55, 0.60), vec3(0.85, 0.95, 1.0), max(wing1, wing2));
  fragColor = vec4(col, shape * 0.9);
}`;

const FROG_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FROG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  // silhouette: body blob + haunch bumps + head
  float body = 1.0 - smoothstep(0.40, 0.50, length(q * vec2(1.0, 1.25)));
  float haunch = 1.0 - smoothstep(0.20, 0.28, length(q - vec2(0.34, -0.28)));
  float head = 1.0 - smoothstep(0.16, 0.24, length(q - vec2(-0.30, 0.30)));
  float shape = max(body, max(haunch, head));
  if (shape < 0.06) discard;
  fragColor = vec4(vec3(0.05, 0.10, 0.06), shape);
}`;

// --- backdrop ---------------------------------------------------------------
const BACK_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uSurf;   // koi-surfacing activity
uniform float uDusk;   // gold deepening
uniform float uKiss;   // kiss-ring window
uniform float uLeap;   // hero leap arc 0→1 (shadow fades while airborne)
uniform vec3 uKoi[5];  // xy = uv pos on the pond, z = body scale
uniform vec3 uRing[6]; // frozen ring origins: xy = uv centre, z = birth t (5 = hero splash)
uniform float uLand;   // hero landed — shadow restores to full depth
uniform float uHop;    // frog launch 0→1
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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

// expanding ring born at t0 at centre c — shared with the CPU bobbing
float ring(vec2 p, vec2 c, float t0, float spd, float t) {
  float dt = t - t0;
  if (dt < 0.0) return 0.0;
  float rr = dt * spd;
  float w = 0.010 + dt * 0.012;
  float band = 1.0 - smoothstep(0.0, w, abs(length(p - c) - rr));
  return band * exp(-dt * 0.5) * exp(-rr * 1.8);
}
// uv → pond space: every ring/shadow centre goes through the same x-stretch
vec2 pcOf(vec2 u) { vec2 p = u - vec2(0.5, 0.52); p.x *= 1.45; return p; }

void main() {
  vec2 uv = vUv;
  float t = uT;

  // --- water: deep teal centre → warm sky reflection at the edges
  vec2 pc = pcOf(uv);
  float r = length(pc);
  vec3 deepTeal = vec3(0.035, 0.16, 0.19);
  vec3 warmSky = mix(vec3(0.58, 0.35, 0.20), vec3(0.85, 0.52, 0.25), uDusk * 0.8);
  vec3 water = mix(deepTeal, warmSky, smoothstep(0.30, 0.68, r));
  water *= 0.92 + 0.08 * fbm2(uv * vec2(3.0, 4.0) + vec2(t * 0.02, t * 0.013));

  // --- caustic shimmer on the pond floor — fine webbing, subtle
  vec2 wuv = uv + vec2(0.012 * sin(t * 0.5 + uv.y * 26.0), 0.008 * sin(t * 0.4 + uv.x * 30.0));
  float ca1 = sin((wuv.x + vnoise(wuv * 7.0 + t * 0.10) * 0.25) * 140.0 + t * 0.8);
  float ca2 = sin((wuv.y + vnoise(wuv * 6.0 - t * 0.08) * 0.25) * 150.0 - t * 0.6);
  float caust = pow(0.5 + 0.5 * ca1 * ca2, 4.0);
  water += vec3(0.9, 0.85, 0.62) * caust * 0.08 * (1.0 - smoothstep(0.50, 0.70, r));

  // --- dappled light patches drifting through the pads' shadows
  float dapple = fbm2(uv * vec2(9.0, 7.0) + vec2(t * 0.03, -t * 0.02));
  water += vec3(1.0, 0.85, 0.55) * smoothstep(0.68, 0.90, dapple) * 0.10;

  // --- willow-drop rings: seeded drops from the border, one cadence
  float dropLight = 0.0;
  vec2 dropPush = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float cyc = floor(t / 4.5 + fi * 0.37);
    float t0 = (cyc - fi * 0.37) * 4.5 + 0.6 + hash12(vec2(fi, cyc)) * 1.5;
    // drops fall inward from the willow border
    vec2 c = mix(vec2(0.5), vec2(0.15 + 0.7 * hash12(vec2(fi * 3.0, cyc)), 0.2 + 0.6 * hash12(vec2(cyc, fi * 7.0))), 0.86);
    float rg = ring(pc, pcOf(c), t0, 0.16, t);
    dropLight += rg;
    dropPush += normalize(pc - pcOf(c) + vec2(1e-4)) * rg * 0.008;
  }
  // --- surface-kiss rings: each fish kisses once on a seeded time in-window
  // kiss rings expand from where each fish touched the surface, not where it is now
  for (int i = 0; i < 5; i++) {
    float rg = ring(pc, pcOf(uRing[i].xy), uRing[i].z, 0.07, t) * uKiss;
    dropLight += rg * 0.6;
  }
  // --- frog plop ring at ~11.55 where its pad was
  dropLight += ring(pc, pcOf(vec2(0.68, 0.40)), 11.55, 0.13, t) * 2.2;
  // --- hero splash ring at the landing point, frozen at t=15.9
  dropLight += ring(pc, pcOf(uRing[5].xy), uRing[5].z, 0.15, t) * 2.0;

  water = mix(water, water + vec3(1.0, 0.9, 0.7) * 0.55, clamp(dropLight, 0.0, 1.0) * 0.35);

  // --- submerged koi shadows — soft blobs under each fish, fade on leap
  for (int i = 0; i < 5; i++) {
    vec2 kc = pcOf(uKoi[i].xy);
    float ks = uKoi[i].z;
    float d = length((pc - kc) * vec2(1.0, 1.9) / max(ks, 0.01));
    float shad = 1.0 - smoothstep(0.015, 0.06, d);
    float leapDim = i == 0 ? 1.0 - uLeap * (1.0 - uLand) * 0.85 : 1.0;
    water = mix(water, water * 0.55, shad * leapDim * (0.35 + 0.4 * (1.0 - uSurf)));
  }

  // --- willow fronds: thin hanging strands draping from the TOP edge
  float frond = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float fx = 0.03 + fi * 0.115 + (hash12(vec2(fi, 1.0)) - 0.5) * 0.05;
    float hang = 0.10 + 0.16 * hash12(vec2(fi, 2.0)); // how far it droops
    float curve = fx + sin((1.0 - uv.y) * 9.0 + fi) * 0.012 + sin(t * 0.4 + fi) * 0.004;
    float strand = 1.0 - smoothstep(0.002, 0.008, abs(uv.x - curve));
    frond += strand * smoothstep(1.0 - hang, 1.0 - hang * 0.4, uv.y);
  }
  // sparse side fronds hugging the left/right borders
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float fy = 0.20 + fi * 0.20;
    float curve = fy + sin(uv.x * 12.0 + fi * 3.0) * 0.025;
    frond += (1.0 - smoothstep(0.002, 0.007, abs(uv.y - curve))) * (1.0 - smoothstep(0.01, 0.05, uv.x)) * 0.8;
    frond += (1.0 - smoothstep(0.002, 0.007, abs(uv.y - curve - 0.12))) * smoothstep(0.95, 0.99, uv.x) * 0.8;
  }
  water = mix(water, vec3(0.04, 0.09, 0.05), clamp(frond, 0.0, 1.0) * 0.85);

  // --- dusk grade: gold deepening + vignette
  water += vec3(0.40, 0.16, -0.03) * uDusk * 0.45;
  water *= 1.0 - 0.26 * pow(length(vUv - 0.5) * 1.35, 2.4);

  fragColor = vec4(water, 1.0);
}`;

// --- world mapping ----------------------------------------------------------
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

const PADS = 14, PETALS = 10, FLIES = 4;

export default class KoipondScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private koi: THREE.InstancedMesh;
  private pads: THREE.InstancedMesh;
  private blossoms: THREE.InstancedMesh;
  private petals: THREE.InstancedMesh;
  private flies: THREE.InstancedMesh;
  private frog: THREE.Mesh;
  private bu = {
    uT: { value: 0 }, uSurf: { value: 0 }, uDusk: { value: 0 },
    uKiss: { value: 0 }, uLeap: { value: 0 }, uHop: { value: 0 },
    uKoi: { value: [0, 0, 0, 0, 0].map(() => new THREE.Vector3()) },
    uRing: { value: [0, 0, 0, 0, 0, 0].map(() => new THREE.Vector3()) },
    uLand: { value: 0 },
  };
  private koiU = { uT: { value: 0 }, uFade: { value: 0 }, uDepth: { value: 1 } };
  private blossomU = { uT: { value: 0 }, uSeed: { value: 0.37 } };
  private petalU = { uSeed: { value: 0.5 } };
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private m = new THREE.Matrix4();
  private sv = new THREE.Vector3();
  private padPos: THREE.Vector3[] = [];
  private frogPadUv = new THREE.Vector2(0.68, 0.40);

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.bu, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);

    // pads: seeded cluster field, each a quad facing camera
    this.pads = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: QUAD_VERT, fragmentShader: PAD_FRAG, transparent: true, side: THREE.DoubleSide }),
      PADS,
    );
    this.three.add(this.pads);
    for (let i = 0; i < PADS; i++) {
      const cx = 0.12 + frac(i * 0.6180339) * 0.76;
      const cy = 0.18 + frac(i * 0.7548776) * 0.62;
      this.padPos.push(new THREE.Vector3(cx, cy, 0));
    }
    // the frog's pad lives at a fixed spot so the plop ring can land there
    this.padPos[6].set(this.frogPadUv.x, this.frogPadUv.y, 0);

    // lotus blossoms: 4 of the pads carry a flower (smaller quad on top)
    this.blossoms = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.blossomU, vertexShader: QUAD_VERT, fragmentShader: BLOSSOM_FRAG, transparent: true, side: THREE.DoubleSide }),
      4,
    );
    this.three.add(this.blossoms);

    // koi
    // segmented quad — the vertex S-curve needs interior verts to bend, not shear
    const koiGeo = new THREE.PlaneGeometry(8.0, 2.6, 24, 6);
    const seeds = new Float32Array(KOI_N);
    for (let i = 0; i < KOI_N; i++) seeds[i] = hash(i * 3 + 11);
    koiGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.koi = new THREE.InstancedMesh(
      koiGeo,
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.koiU, vertexShader: KOI_VERT, fragmentShader: KOI_FRAG, transparent: true, side: THREE.DoubleSide }),
      KOI_N,
    );
    this.three.add(this.koi);

    // petals
    this.petals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.petalU, vertexShader: QUAD_VERT, fragmentShader: PETAL_FRAG, transparent: true, side: THREE.DoubleSide }),
      PETALS,
    );
    this.three.add(this.petals);

    // dragonflies
    this.flies = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.4, 1.0),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: QUAD_VERT, fragmentShader: FLY_FRAG, transparent: true, side: THREE.DoubleSide }),
      FLIES,
    );
    this.three.add(this.flies);

    // frog on its pad
    this.frog = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 3.0),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FROG_VERT, fragmentShader: FROG_FRAG, transparent: true }),
    );
    this.three.add(this.frog);

    // frozen ring origins: each fish kisses at its seeded time (ring stays
    // where the touch happened), slot 5 = hero splash landing point
    const ku = new THREE.Vector2();
    for (let i = 0; i < 5; i++) {
      const t0 = 6.2 + hash(i * 3 + 7) * 5.5;
      this.koiUv(i, t0, ku);
      this.bu.uRing.value[i].set(ku.x, ku.y, t0);
    }
    this.koiUv(0, 15.9, ku);
    this.bu.uRing.value[5].set(ku.x, ku.y, 15.9);

    this.cam.position.set(0, 6, 25);
    this.cam.lookAt(0, 8, PZ + 20);
  }

  // koi wander path in uv space — closed-form, deterministic
  private koiUv(i: number, t: number, out: THREE.Vector2) {
    const s = hash(i * 7 + 2), w = hash(i * 13 + 5);
    const speed = 0.020 + 0.012 * w;
    const a = t * speed + s * 6.283;
    // wander bounded to the lit pond ellipse so every fish enters the pull-back reveal
    const cx = 0.5 + Math.sin(a) * (0.16 + w * 0.06) + Math.sin(a * 2.3 + s * 9.0) * 0.045;
    const cy = 0.50 + Math.cos(a * 0.8 + s * 4.0) * (0.16 + s * 0.08) + Math.sin(a * 1.7) * 0.05;
    return out.set(cx, cy);
  }

  private koiHeading(i: number, t: number, out: THREE.Vector2) {
    const a = this.koiUv(i, t, new THREE.Vector2());
    const b = this.koiUv(i, t + 0.05, new THREE.Vector2());
    return out.subVectors(b, a).normalize();
  }

  private padBob(i: number, t: number) {
    // pads ride a long slow swell + get pushed by nearby ring crests
    const s = this.padPos[i];
    return Math.sin(t * 0.5 + s.x * 9.0 + s.y * 7.0 + i) * 0.006;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    const surf = surfT(t), dusk = duskT(t), hop = frogHopT(t), leap = leapT(t);
    this.bu.uT.value = t;
    this.bu.uSurf.value = surf;
    this.bu.uDusk.value = dusk;
    this.bu.uKiss.value = kissT(t);
    this.bu.uLeap.value = leap;
    this.bu.uLand.value = ss(16.6, 17.8, t); // shadow restores after the splash settles
    this.bu.uHop.value = hop;

    // --- koi: wander paths, headings, surfacing fade, hero leap
    const ku = new THREE.Vector2(), kh = new THREE.Vector2();
    for (let i = 0; i < KOI_N; i++) {
      this.koiUv(i, t, ku);
      this.koiHeading(i, t, kh);
      const yaw = Math.atan2(kh.y, kh.x);
      const heroBoost = i === 0 ? 1.45 : 1.0;
      const sc = (1.5 + hash(i * 5) * 0.7) * heroBoost;
      let lift = 0, plunge = 1;
      if (i === 0 && leap > 0) {
        // leap parabola in screen space: rises out, comes down at ~15.9 —
        // amplitude kept under the camera's top edge so the apex stays on screen
        const arc = Math.sin(leap * Math.PI);
        lift = arc * 2.8;
        plunge = 1 - arc * 0.3;
      }
      uvToWorld(ku.x, ku.y, this.p);
      this.p.z += 2.0 + lift * 0.4; // foreground layer + leap pops forward
      this.p.y += lift * 8.0;       // leap rises up the quad
      this.e.set(0, 0, yaw + (i === 0 ? Math.sin(leap * Math.PI) * -1.2 : 0));
      this.q.setFromEuler(this.e);
      const depthFade = i === 0 && leap > 0 ? 1.0 : 0.55 + 0.45 * surf;
      this.sv.set(sc * depthFade * plunge, sc * depthFade, sc);
      this.m.compose(this.p, this.q, this.sv);
      this.koi.setMatrixAt(i, this.m);
      // shadow uniform: uv pos + scale
      this.bu.uKoi.value[i].set(ku.x, ku.y, sc);
    }
    this.koi.instanceMatrix.needsUpdate = true;
    this.koiU.uT.value = t;
    this.koiU.uFade.value = 0.7 + 0.3 * Math.max(surf, leap);
    this.koiU.uDepth.value = 1 - surf;

    // --- pads: bob + the frog's pad dips then rebounds after launch
    for (let i = 0; i < PADS; i++) {
      const s = this.padPos[i];
      uvToWorld(s.x, s.y + this.padBob(i, t), this.p);
      this.p.z += 3.0;
      let dip = 0;
      if (s.x === this.frogPadUv.x && s.y === this.frogPadUv.y) {
        // pad dips under the frog, snaps back when it launches
        dip = ss(9.6, 11.2, t) * (1 - ss(11.2, 11.8, t)) * 0.018;
        this.p.y -= dip * PH;
      }
      const padScale = 5.0 + hash(i * 9) * 5.0;
      this.e.set(0, 0, hash(i * 4) * 6.28 + Math.sin(t * 0.4 + i) * 0.04);
      this.q.setFromEuler(this.e);
      this.sv.setScalar(padScale);
      this.m.compose(this.p, this.q, this.sv);
      this.pads.setMatrixAt(i, this.m);
    }
    this.pads.instanceMatrix.needsUpdate = true;

    // blossoms ride pads 1,4,8,11
    const blossomPads = [1, 4, 8, 11];
    for (let k = 0; k < 4; k++) {
      const i = blossomPads[k];
      const s = this.padPos[i];
      uvToWorld(s.x, s.y + this.padBob(i, t) + 0.012, this.p);
      this.p.z += 3.4;
      this.q.identity();
      this.sv.setScalar(1.6 + hash(k * 7) * 0.8);
      this.m.compose(this.p, this.q, this.sv);
      this.blossoms.setMatrixAt(k, this.m);
    }
    this.blossoms.instanceMatrix.needsUpdate = true;
    this.blossomU.uT.value = t;

    // frog: sits on its pad until ~11.2, launches in an arc to frame-right
    uvToWorld(this.frogPadUv.x, this.frogPadUv.y, this.p);
    if (hop <= 0) {
      this.p.y += this.padBob(6, t) * PH * 0.6 + 1.0;
      this.e.set(0, 0, Math.sin(t * 1.2) * 0.03);
    } else {
      // arc off to the right + up, exiting over ~0.35s of envelope
      const jt = Math.min(1, (t - 11.2) / 0.6);
      this.p.x += jt * 60;
      this.p.y += Math.sin(jt * Math.PI) * 14 + jt * 4;
      this.e.set(0, 0, jt * 1.4);
    }
    this.p.z += 3.5;
    this.q.setFromEuler(this.e);
    this.frog.quaternion.copy(this.q);
    this.frog.position.copy(this.p);
    this.frog.visible = hop < 1;

    // petals: slow drift + spin on the water
    for (let i = 0; i < PETALS; i++) {
      const u = hash(i * 17), w = hash(i * 23);
      const px = frac(u + t * (0.006 + w * 0.006));
      const py = 0.2 + w * 0.6 + Math.sin(t * 0.3 + i) * 0.01;
      uvToWorld(px, py, this.p);
      this.p.z += 2.6;
      this.e.set(0, 0, u * 6.28 + t * (0.1 + w * 0.1));
      this.q.setFromEuler(this.e);
      this.sv.setScalar(1.1 + w * 0.9);
      this.m.compose(this.p, this.q, this.sv);
      this.petals.setMatrixAt(i, this.m);
    }
    this.petals.instanceMatrix.needsUpdate = true;

    // dragonflies: appear with the frog beat, skim fast over the surface
    const flyOn = ss(11.8, 12.6, t);
    for (let i = 0; i < FLIES; i++) {
      const u = hash(i * 29), w = hash(i * 31);
      if (flyOn < 0.05) { this.m.makeScale(0, 0, 0); this.flies.setMatrixAt(i, this.m); continue; }
      const a = t * (0.55 + u * 0.4) + u * 6.28;
      const fx = 0.5 + Math.sin(a) * 0.3 + Math.sin(a * 2.7) * 0.06;
      const fy = 0.55 + Math.cos(a * 1.3) * 0.18 + Math.sin(a * 3.1 + w * 9.0) * 0.04;
      uvToWorld(fx, fy, this.p);
      this.p.z += 4.5;
      this.e.set(0, 0, Math.atan2(Math.cos(a) * 0.3 - Math.cos(a * 2.7) * 0.16, Math.cos(a) * 0.3) - Math.PI / 2);
      this.q.setFromEuler(this.e);
      this.sv.setScalar(1.6 + w * 0.8);
      this.m.compose(this.p, this.q, this.sv);
      this.flies.setMatrixAt(i, this.m);
    }
    this.flies.instanceMatrix.needsUpdate = true;

    // camera: drift after the hero fish mid-scene, then pull back to reveal
    this.koiUv(0, t, ku);
    const follow = ss(5.0, 9.0, t) * (1 - pullT(t));
    const pull = pullT(t);
    const targetX = (ku.x - 0.5) * 14 * follow;
    const targetY = (ku.y - 0.5) * 6 * follow;
    this.cam.position.set(
      targetX * 0.7 + Math.sin(t * 0.05) * 0.5,
      6.0 - pull * 1.0 + Math.sin(t * 0.07) * 0.2,
      25.0 + pull * 26.0, // pull back far enough to frame the whole lit pond
    );
    this.cam.lookAt(
      targetX,
      8 + targetY - pull * 1.5,
      PZ + 20,
    );

    // diagnostics: hero-koi bounds for probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        this.koiUv(0, t, ku);
        uvToWorld(ku.x, ku.y, this.p);
        const arcL = Math.sin(leap * Math.PI) * 2.8;
        this.p.z += 2.0 + arcL * 0.4;
        this.p.y += arcL * 8.0;
        this.p.project(this.cam);
        const W = P.width || 1920, H = P.height || 1080;
        const cx = (this.p.x * 0.5 + 0.5) * W, cy = (0.5 - this.p.y * 0.5) * H;
        const rad = 3.4 * H * 0.05;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0,
          t,
          text: 'hero-koi',
          fontFamily: 'Archivo, sans-serif',
          fontPx: 24,
          fillStyle: '#F26E38',
          globalAlpha: Math.max(surf, leap),
          layerId: 'koipond',
          bbox: [cx - rad, cy - rad * 0.5, cx + rad, cy + rad * 0.5],
          w: rad * 2,
          h: rad,
          cx,
          cy,
          hPct: (rad / H) * 100,
          isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.72 + 0.08 * dusk,
      bloom: 0.38 + 0.18 * surf + 0.15 * dusk,
      bloomThreshold: 0.72,
      bloomRadius: 0.55,
      grade: { saturation: 1.14, gamma: 0.92 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

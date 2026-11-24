// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// coralreef — a shallow reef glade in morning light.
// The backdrop pass paints the water column (surface shimmer, god-ray glow,
// distant reef silhouettes, suspended motes). A real sand-floor plane carries
// animated fbm caustic webs. Coral heads are instanced tapered-cylinder growth
// (recursive hash-seeded staghorn splits + table canopies); the anemone is
// instanced cones bent by a low-frequency sway field; three fish schools are
// instanced billboards on closed-form weave paths; bubbles rise on hashed
// spiral windows; god-rays are soft additive planes with fbm edges.
// CameraRig drifts through the glade and pitches up for the anemone beat.
// All motion is f(t); every random is a hash seed. No sim state.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
import { F } from '../../engine/type';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import type { V3 } from '../../engine/util';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const h1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

const PW = 420, PH = 150, PY = 34, PZ = -70;
const SAND_Y = -8;

/* ---------------- backdrop: water column + distant reef ----------------- */

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
uniform float uAwake;  // morning glow envelope
uniform float uRays;   // god-ray intensity (rises with the camera tilt)

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 su = vec2(uv.x * 2.8, uv.y); // aspect-corrected pattern space
  float t = uT;

  // water column: pale morning aqua up top → deep teal below
  vec3 c = mix(vec3(0.02, 0.15, 0.20), vec3(0.24, 0.55, 0.52), smoothstep(0.02, 0.85, uv.y));
  // bright surface band — wavy shimmer line + specular flicker
  float surf = 0.52 + 0.03 * sin(su.x * 9.0 + t * 0.7) + 0.015 * fbm3(vec3(su.x * 18.0, t * 0.4, 2.0), 3);
  float surfBand = smoothstep(surf - 0.10, surf + 0.05, uv.y);
  c = mix(c, vec3(0.75, 0.88, 0.80), surfBand * (0.45 + 0.35 * uAwake));
  // sun glow through the surface
  float sun = exp(-(pow(abs(uv.x - 0.62) * 4.2, 2.0) + pow(abs(uv.y - 1.02) * 6.5, 2.0)));
  c += vec3(1.0, 0.92, 0.68) * sun * (1.4 + 0.8 * uAwake);

  // god-ray shafts: slow columns of light leaning from the surface
  float rays = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float x0 = 0.18 + fi * 0.21 + 0.05 * sin(t * 0.11 + fi * 2.1);
    float w = 0.035 + 0.02 * h21(vec2(fi, 7.0));
    float lean = 0.22 * (uv.y - 1.0);
    float d = (uv.x + lean - x0) / w;
    float col = exp(-d * d);
    float shimmer = 0.6 + 0.4 * fbm3(vec3(su.x * 3.0 + fi * 7.0, uv.y * 2.0 - t * 0.12, fi), 3);
    rays += col * shimmer * (1.0 - smoothstep(0.15, 0.95, uv.y) * 0.6);
  }
  c += vec3(0.80, 0.88, 0.72) * rays * 0.45 * (0.4 + 0.6 * uRays);

  // distant reef silhouette band along the base
  float reefH = 0.24 + 0.07 * fbm3(vec3(su.x * 2.6, 4.2, 0.0), 4)
              + 0.05 * max(0.0, sin(su.x * 5.5 + 1.7));
  float reef = 1.0 - smoothstep(reefH - 0.01, reefH + 0.02, uv.y);
  vec3 reefCol = mix(vec3(0.05, 0.16, 0.18), vec3(0.16, 0.22, 0.20), fbm3(vec3(su.x * 8.0, 8.0, 0.0), 3));
  c = mix(c, reefCol, reef * 0.85);

  // suspended motes drifting down
  vec2 mp = fract(su * vec2(9.0, 6.0) + vec2(0.0, -t * 0.02)) - 0.5;
  float mote = (1.0 - smoothstep(0.0, 0.06, length(mp))) * step(0.82, h21(floor(su * vec2(9.0, 6.0) + vec2(0.0, -t * 0.02))));
  c += vec3(0.5, 0.62, 0.58) * mote * 0.18;

  // morning warm cast grows with the awaken beat
  c += vec3(0.06, 0.03, 0.0) * uAwake * (1.0 - uv.y);
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- sand floor: caustic webs ------------------------------- */

const SAND_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
in vec3 vWorld;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;

// voronoi-ish caustic web: layered folded fbm, shimmering
float caustic(vec2 p, float t) {
  float a = fbm3(vec3(p * 0.55 + vec2(t * 0.08, t * 0.05), t * 0.12), 4);
  float b = fbm3(vec3(p * 0.55 - vec2(t * 0.06, t * 0.09), t * 0.10 + 7.0), 4);
  float web = 1.0 - abs(a - b) * 4.0;
  web = max(web, 0.0);
  return pow(web, 3.0);
}

void main() {
  vec2 p = vWorld.xz * 0.5;
  float t = uT;
  // sand base — warm pale with faint ripple shading
  float rip = fbm3(vec3(p * 0.8 + vec2(p.y, 0.0) * 0.3, 3.0), 3);
  vec3 c = vec3(0.36, 0.30, 0.21) * (0.8 + 0.4 * rip);
  // caustic light webs — two counter-drifting layers
  float cw = caustic(p, t) + 0.6 * caustic(p * 1.7 + 31.0, t * 1.3);
  c += vec3(0.95, 0.88, 0.60) * cw * (0.35 + 0.55 * uAwake);
  // depth haze toward the backdrop: fade to water color with distance
  float dist = smoothstep(20.0, 70.0, -vWorld.z + 10.0);
  c = mix(c, vec3(0.04, 0.18, 0.22), dist * 0.6);
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- god-ray planes ------------------------------------------ */

const RAY_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RAY_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAmp;
uniform float uSeed;

void main() {
  float t = uT;
  // soft column: bright core, fbm-shimmered edges, fading downward
  float core = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
  float edge = fbm3(vec3(vUv.x * 6.0 + uSeed * 13.0, vUv.y * 2.0 - t * 0.10, uSeed), 3);
  float a = core * (0.5 + 0.5 * edge) * (1.0 - vUv.y * 0.75) * uAmp;
  vec3 c = vec3(0.85, 0.90, 0.72) * a;
  fragColor = vec4(c, 0.0);
}`;

/* ---------------- fish school billboards ----------------------------------- */

const FISH_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
in vec3 iAnchor;    // school anchor
in vec4 iParams;    // lane, size, seed, wavePhase
uniform mat4 modelViewMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uT;
uniform float uSchool;
out vec2 vUv;
out float vShade;

void main() {
  vUv = uv;
  float t = uT;
  float lane = iParams.x;
  float seed = iParams.z;
  // school weave: closed-form sine lattice between coral heads
  float ph = t * 0.35 + lane * 6.2831;
  vec3 center = iAnchor + vec3(
    sin(ph * 1.0 + seed) * 9.0 + sin(ph * 0.4) * 4.0,
    sin(ph * 0.8 + seed * 2.0) * 1.1 - 3.0,
    cos(ph * 0.7 + seed) * 8.0 - 9.5
  );
  // per-fish jitter: fish hold lattice slots in the school
  vec2 jit = vec2(
    sin(seed * 40.0 + t * (0.9 + seed)) ,
    cos(seed * 31.0 + t * (0.7 + seed * 0.5))
  ) * (0.4 + 0.8 * fract(seed * 7.31));
  center.xy += jit * vec2(1.6, 0.7);
  // billboard facing the camera
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = center + right * position.x * iParams.y + up * position.y * iParams.y;
  vShade = 0.6 + 0.4 * clamp(dot(normalize(center - vec3(0.0, -2.0, 10.0)), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FISH_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vShade;
uniform vec3 uTint;
uniform float uSchool;
out vec4 fragColor;

void main() {
  vec2 p = vUv;
  // body: ellipse centered (0.36,0.5), rx 0.30 ry 0.15
  float be = length(vec2((p.x - 0.36) / 0.30, (p.y - 0.5) / 0.15));
  float body = (1.0 - smoothstep(0.97, 1.03, be));
  // tail: triangle flaring from x=0.62 to x=0.98
  float th = (p.x - 0.62) / 0.36 * 0.20;
  float tail = step(0.60, p.x) * step(abs(p.y - 0.5), th);
  // dorsal fin: small bump on the back
  float dh = 0.15 - abs(p.x - 0.34) / 0.09 * 0.15;
  float fin = step(0.25, p.x) * step(p.x, 0.43) * step(0.5 + (0.15 - abs(p.x - 0.34)) * 0.0, p.y) * step(p.y - 0.5, dh + 0.12);
  float a = max(body, max(tail, fin * 0.9)) * uSchool;
  if (a < 0.02) discard;
  // shading: dark back, lighter belly glint
  float belly = (1.0 - smoothstep(0.42, 0.62, p.y));
  vec3 c = uTint * (0.55 + 0.35 * vShade) + vec3(0.18, 0.20, 0.18) * belly * body;
  fragColor = vec4(c, a);
}`;

/* ---------------- bubbles -------------------------------------------------- */

const BUB_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
in vec3 iOrigin;
in vec2 iParams;   // phase, rise speed
uniform mat4 modelViewMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uT;
out vec2 vUv;
out float vA;

void main() {
  vUv = uv;
  float t = uT;
  float ph = iParams.x;
  float cyc = fract(t * iParams.y * 0.06 + ph);       // one rise cycle
  // hashed on/off windows → occasional spiral columns
  float gate = step(0.55, fract(ph * 13.7 + floor(t * iParams.y * 0.06 + ph) * 0.31));
  float y = -7.0 + cyc * 16.0;
  float r = 0.25 + cyc * 0.9;
  vec3 center = iOrigin + vec3(cos(cyc * 20.0 + ph * 20.0) * r, y + 7.0, sin(cyc * 20.0 + ph * 20.0) * r);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float s = 0.22 + 0.12 * cyc;
  vec3 wp = center + (right * position.x + up * position.y) * s;
  vA = gate * sin(cyc * 3.14159);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const BUB_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vA;
out vec4 fragColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float ring = (1.0 - smoothstep(0.8, 1.0, d)) - smoothstep(0.75, 0.4, d);
  float glint = (1.0 - smoothstep(0.0, 0.35, length(vUv - vec2(0.38, 0.62)))) * 1.4;
  float a = (ring + glint) * vA;
  if (a < 0.02) discard;
  fragColor = vec4(vec3(0.85, 0.95, 0.95) * (a * 0.8), 0.0);
}`;

/* ---------------- anemone tentacles ---------------------------------------- */

const ANE_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
in vec3 iBase;
in vec2 iParams;    // phase, height
uniform mat4 modelViewMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uT;
out float vY;
out float vLight;

void main() {
  vY = position.y;
  float sway = sin(uT * 0.55 + iParams.x * 6.2831 + sin(uT * 0.23 + iParams.x * 9.0) * 0.8);
  float bend = pow(max(position.y, 0.0), 1.6) * 0.5 * sway;
  vec3 p = position;
  p.xz += vec2(bend, bend * 0.6);
  vec3 wp = iBase + p * vec3(1.0, iParams.y, 1.0);
  vec3 n = normalize(vec3(normal.x + bend * 0.3, normal.y, normal.z));
  vLight = 0.45 + 0.55 * clamp(n.y, 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const ANE_FRAG = /* glsl */ `
precision highp float;
in float vY;
in float vLight;
uniform float uAwake;
out vec4 fragColor;
void main() {
  // anemone gradient: deep violet base → warm coral-pink tip
  vec3 c = mix(vec3(0.18, 0.06, 0.22), vec3(0.72, 0.30, 0.30), vY);
  c *= vLight * (0.8 + 0.4 * uAwake);
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- JS helpers ------------------------------------------------ */

const mixV3 = (a: V3, b: V3, k: number): V3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

// Staghorn growth: recursive branching from a base, segments → cylinder instances.
function staghorn(base: V3, seed: number, out: { m: THREE.Matrix4; c: THREE.Color }[]): void {
  const quat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const grow = (p: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, gen: number) => {
    const end = p.clone().addScaledVector(dir, len);
    const mid = p.clone().lerp(end, 0.5);
    quat.setFromUnitVectors(up, dir.clone().normalize());
    scale.set(rad, len, rad);
    const m = new THREE.Matrix4().compose(mid, quat.clone(), scale.clone());
    const warmth = h1(seed + gen * 3.7 + len);
    out.push({ m, c: new THREE.Color().setHSL(0.02 + warmth * 0.05, 0.60, 0.18 + warmth * 0.10) });
    if (gen >= 4 || len < 0.3) return;
    const kids = h1(seed + gen * 11.3) > 0.4 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const s = seed * 10 + gen * 3 + i * 0.77;
      const tilt = 0.55 + h1(s) * 0.55;
      const az = h1(s + 0.5) * Math.PI * 2;
      const nd = dir.clone()
        .applyAxisAngle(new THREE.Vector3(Math.cos(az), 0, Math.sin(az)).normalize(), tilt)
        .lerp(up, 0.25)
        .normalize();
      grow(end, nd, len * (0.55 + h1(s + 1.0) * 0.25), rad * 0.68, gen + 1);
    }
  };
  grow(new THREE.Vector3(...base), new THREE.Vector3(0.15 * (h1(seed) - 0.5), 1, 0.15 * (h1(seed + 2.0) - 0.5)).normalize(), 1.8 + h1(seed) * 1.0, 0.30, 0);
}

// Table coral: stalk + flattened canopy disc instances.
function tableCoral(base: V3, seed: number, out: { m: THREE.Matrix4; c: THREE.Color }[]): void {
  const pos = new THREE.Vector3(...base);
  const stalk = new THREE.Matrix4().compose(
    pos.clone().add(new THREE.Vector3(0, 0.9, 0)),
    new THREE.Quaternion(),
    new THREE.Vector3(0.3, 1.8, 0.3),
  );
  out.push({ m: stalk, c: new THREE.Color().setHSL(0.07, 0.45, 0.26) });
  const canopy = new THREE.Matrix4().compose(
    pos.clone().add(new THREE.Vector3(0, 1.35 + h1(seed) * 0.3, 0)),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, h1(seed) * 6.3, (h1(seed + 1) - 0.5) * 0.25)),
    new THREE.Vector3(3.0 + h1(seed) * 1.2, 0.38, 3.0 + h1(seed + 2) * 1.2),
  );
  out.push({ m: canopy, c: new THREE.Color().setHSL(0.08 + h1(seed) * 0.04, 0.45, 0.15) });
}

interface SchoolDef {
  mesh: THREE.InstancedMesh;
  mat: THREE.RawShaderMaterial;
  env: (t: number) => number;
}

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 0.8, end: 4.6, s: 'morning over the glade' },
  { at: 6.5, end: 11.0, s: 'the schools cross' },
  { at: 12.5, end: 17.4, s: 'the anemone breathes' },
];

export default class CoralReefScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private uBack = { uT: { value: 0 }, uAwake: { value: 0 }, uRays: { value: 0 } };
  private uSand = { uT: { value: 0 }, uAwake: { value: 0 } };
  private rayMats: THREE.ShaderMaterial[] = [];
  private schools: SchoolDef[] = [];
  private bubMat: THREE.RawShaderMaterial;
  private aneMat: THREE.RawShaderMaterial;
  private layer = new Layer2D();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 500);
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    // backdrop
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.uBack, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // sand floor
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 160),
      new THREE.ShaderMaterial({
        uniforms: this.uSand,
        glslVersion: THREE.GLSL3,
        vertexShader: /* glsl */ `
          out vec2 vUv;
          out vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: SAND_FRAG,
      }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, SAND_Y, -40);
    this.three.add(sand);

    // coral heads: staghorn at the edges + tables mid-depth
    const coralGeo = new THREE.CylinderGeometry(0.45, 1.0, 1.0, 5);
    const inst: { m: THREE.Matrix4; c: THREE.Color }[] = [];
    staghorn([-13, SAND_Y, -18], 3.1, inst);
    staghorn([11, SAND_Y, -24], 7.9, inst);
    staghorn([17, SAND_Y, -40], 5.4, inst);
    tableCoral([-4, SAND_Y, -32], 2.2, inst);
    tableCoral([7, SAND_Y, -44], 8.8, inst);
    tableCoral([-18, SAND_Y, -42], 4.5, inst);
    const corals = new THREE.InstancedMesh(
      coralGeo,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      inst.length,
    );
    inst.forEach((it, i) => {
      corals.setMatrixAt(i, it.m);
      corals.setColorAt(i, it.c);
    });
    corals.frustumCulled = false;
    this.three.add(corals);

    // lights for the lambert corals
    this.three.add(new THREE.HemisphereLight(0x9adfd8, 0x1e3a36, 0.7));
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.0);
    sun.position.set(20, 40, 10);
    this.three.add(sun);

    // anemone: instanced swaying tentacles on a rock beside the near school
    const aneGeo = new THREE.ConeGeometry(0.20, 2.8, 5, 4);
    aneGeo.translate(0, 1.3, 0); // pivot at tentacle base
    const NANE = 42;
    const aneBase = new THREE.Vector3(4.5, SAND_Y + 0.4, -11);
    const aneMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: ANE_VERT,
      fragmentShader: ANE_FRAG,
      uniforms: { uT: { value: 0 }, uAwake: { value: 0 } },
    });
    this.aneMat = aneMat;
    const ane = new THREE.InstancedMesh(aneGeo, aneMat, NANE);
    const iBase = new Float32Array(NANE * 3);
    const iParams = new Float32Array(NANE * 2);
    for (let i = 0; i < NANE; i++) {
      const s = i * 0.731;
      const r = 0.15 + 0.85 * h1(s);
      const a = h1(s + 3.0) * Math.PI * 2;
      iBase[i * 3] = aneBase.x + Math.cos(a) * r;
      iBase[i * 3 + 1] = aneBase.y;
      iBase[i * 3 + 2] = aneBase.z + Math.sin(a) * r;
      iParams[i * 2] = h1(s + 7.0);
      iParams[i * 2 + 1] = 0.7 + h1(s + 11.0) * 0.6;
      ane.setMatrixAt(i, new THREE.Matrix4()); // identity — shader positions via iBase
    }
    aneGeo.setAttribute('iBase', new THREE.InstancedBufferAttribute(iBase, 3));
    aneGeo.setAttribute('iParams', new THREE.InstancedBufferAttribute(iParams, 2));
    ane.frustumCulled = false;
    this.three.add(ane);
    // anemone's rock
    const rock = new THREE.Mesh(
      new THREE.SphereGeometry(1.8, 10, 7),
      new THREE.MeshLambertMaterial({ color: 0x4a3f38 }),
    );
    rock.position.copy(aneBase).add(new THREE.Vector3(0, -0.5, 0));
    rock.scale.y = 0.55;
    this.three.add(rock);

    // fish schools: instanced billboards on weave paths, 3 tint groups
    const schoolDefs: { anchor: V3; tint: number[]; n: number; seed: number }[] = [
      { anchor: [0, 0, 0], tint: [0.62, 0.38, 0.08], n: 26, seed: 1.0 },  // gold, mid
      { anchor: [-6, 0, 0], tint: [0.10, 0.40, 0.38], n: 22, seed: 2.7 }, // teal, left
      { anchor: [8, 0, 0], tint: [0.38, 0.42, 0.48], n: 18, seed: 4.4 },  // silver, right
    ];
    for (const sd of schoolDefs) {
      const geo = new THREE.PlaneGeometry(1.1, 0.42);
      const iAnchor = new Float32Array(sd.n * 3);
      const iParams = new Float32Array(sd.n * 4);
      for (let i = 0; i < sd.n; i++) {
        const s = sd.seed + i * 0.617;
        iAnchor[i * 3] = sd.anchor[0] + (h1(s) - 0.5) * 3.0;
        iAnchor[i * 3 + 1] = sd.anchor[1];
        iAnchor[i * 3 + 2] = sd.anchor[2];
        iParams[i * 4] = h1(s + 2.0);            // lane
        iParams[i * 4 + 1] = 0.5 + h1(s + 4.0) * 0.25; // size
        iParams[i * 4 + 2] = h1(s + 6.0);        // seed
        iParams[i * 4 + 3] = h1(s + 8.0);
      }
      geo.setAttribute('iAnchor', new THREE.InstancedBufferAttribute(iAnchor, 3));
      geo.setAttribute('iParams', new THREE.InstancedBufferAttribute(iParams, 4));
      const mat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FISH_VERT,
        fragmentShader: FISH_FRAG,
        uniforms: {
          uT: { value: 0 },
          uSchool: { value: 0 },
          uTint: { value: new THREE.Vector3(...(sd.tint as [number, number, number])) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.InstancedMesh(geo, mat, sd.n);
      mesh.frustumCulled = false;
      this.three.add(mesh);
      this.schools.push({ mesh, mat, env: () => 1 });
    }
    this.schools[0]!.env = (t) => 0.55 + 0.45 * ss(5.5, 9.0, t);
    this.schools[1]!.env = (t) => 0.4 + 0.6 * ss(7.0, 11.5, t);
    this.schools[2]!.env = (t) => 0.3 + 0.7 * ss(11.0, 15.0, t);

    // bubbles: 3 emitters near coral heads
    const NB = 24;
    const bubGeo = new THREE.PlaneGeometry(1, 1);
    const bOrig = new Float32Array(NB * 3);
    const bParams = new Float32Array(NB * 2);
    const emitters: V3[] = [[-10, SAND_Y, -16], [9, SAND_Y, -26], [6.5, SAND_Y, -13.5]];
    for (let i = 0; i < NB; i++) {
      const e = emitters[i % 3]!;
      bOrig[i * 3] = e[0] + (h1(i * 1.3) - 0.5) * 1.2;
      bOrig[i * 3 + 1] = e[1];
      bOrig[i * 3 + 2] = e[2] + (h1(i * 2.1) - 0.5) * 1.2;
      bParams[i * 2] = h1(i * 3.7);
      bParams[i * 2 + 1] = 0.8 + h1(i * 5.1) * 0.7;
    }
    bubGeo.setAttribute('iOrigin', new THREE.InstancedBufferAttribute(bOrig, 3));
    bubGeo.setAttribute('iParams', new THREE.InstancedBufferAttribute(bParams, 2));
    this.bubMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BUB_VERT,
      fragmentShader: BUB_FRAG,
      uniforms: { uT: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const bubbles = new THREE.InstancedMesh(bubGeo, this.bubMat, NB);
    bubbles.frustumCulled = false;
    this.three.add(bubbles);

    // god-rays: additive leaning planes from the surface
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uAmp: { value: 0 }, uSeed: { value: i * 3.1 } },
        vertexShader: RAY_VERT,
        fragmentShader: RAY_FRAG,
        glslVersion: THREE.GLSL3,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.rayMats.push(mat);
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(9 + i * 2.5, 70), mat);
      ray.position.set(-10 + i * 10, 14, -26 - i * 7);
      ray.rotation.z = 0.16 + i * 0.05;
      ray.rotation.x = -0.08;
      this.three.add(ray);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    const end = this.ctx.end - this.ctx.start;

    const awake = ss(0.5, 5.0, t);
    const cross = ss(5.5, 11.5, t);
    const macro = ss(12.0, 17.0, t);

    this.uBack.uT.value = t;
    this.uBack.uAwake.value = awake;
    this.uBack.uRays.value = 0.3 + 0.7 * macro;
    this.uSand.uT.value = t;
    this.uSand.uAwake.value = awake;
    this.aneMat.uniforms.uT!.value = t;
    this.aneMat.uniforms.uAwake!.value = awake;
    this.bubMat.uniforms.uT!.value = t;
    for (const m of this.rayMats) {
      m.uniforms.uT!.value = t;
      m.uniforms.uAmp!.value = (0.45 + 0.55 * awake) * (0.6 + 0.4 * macro);
    }
    for (const s of this.schools) {
      s.mat.uniforms.uT!.value = t;
      s.mat.uniforms.uSchool!.value = s.env(t);
    }

    // camera: drift through the glade, pitch up into the anemone beat
    const push = ss(0, end, t);
    this.rig.position = [
      3.0 * Math.sin(t * 0.06) - 2.0 * cross + 1.6 * macro,
      -2.6 - 1.1 * macro,
      24.0 - 20.0 * push,
    ];
    this.rig.target = [
      mixV3([0, -2, -30], [4.5, -5.4, -11], macro)[0],
      -2.5 - 2.9 * macro,
      -30 + 19 * macro,
    ];
    this.rig.roll = 0.006 * Math.sin(t * 0.19);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions — low third
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    let anyVis = false;
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      anyVis = true;
      g.save();
      g.globalAlpha = a;
      const text = c.s.toUpperCase();
      const maxW = this.ctx.W - 48;
      let fs = 46;
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
      g.textAlign = 'center';
      g.shadowColor = 'rgba(0,30,35,0.85)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(235,250,245,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.82,
      bloom: 0.85,
      bloomThreshold: 0.45,
      bloomRadius: 0.9,
      ca: 0.05,
      grain: 0.04,
      vignette: 0.42,
      level: ss(0, 1.2, t),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.texture.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
      if ((m as unknown as THREE.InstancedMesh).isInstancedMesh) {
        (m as THREE.InstancedMesh).dispose();
      }
    });
  }
}

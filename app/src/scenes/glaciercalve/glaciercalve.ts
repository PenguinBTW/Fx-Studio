// glaciercalve — a tidewater glacier front calving into arctic waters at
// dusk, in three acts.
//   0–7s    establishing: serried ice wall, slate sea, pale dusk sky, low
//           sun wafer; crevasse veins deepened toward the waterline.
//   7–9.5s  the crack: a luminous blue fracture spiders across the slab
//           region; camera pans toward it.
//   9.5–12s the calve: slab drops on a slump envelope with rotational
//           torque; mist burst at the waterline.
//   11.3–14 impact: foam splash crown rises + collapses, concentric swell
//           rings expand, ~12 bergs surface, ~18 seabirds scatter once.
//   14–20   aftermath: bergs bob on decaying sines and drift outward,
//           glitter mist settles, a scar shows where the slab left.
// Backdrop = one GLSL3 quad (sky/sea/wall/crack/slab/splash/mist);
// foreground = two InstancedMesh systems (bergs + birds). All closed-form
// f(t) on hash seeds — no accumulators, no RNG.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// --- narrative envelopes ---------------------------------------------------
const crackT = (t: number) => ss(6.5, 9.5, t);       // fracture grows
const slump = (t: number) => ss(9.5, 12.0, t);        // slab drop envelope
const impact = (t: number) => ss(11.3, 11.8, t);      // water hit
const aftermath = (t: number) => ss(13.5, 16.5, t);   // settling
const mistT = (t: number) => ss(11.3, 12.0, t) * (1 - ss(15.0, 19.0, t)); // spray veil

// Slab region of the wall (uv x) — shared with the GLSL.
const SLAB_X0 = 0.50, SLAB_X1 = 0.72;
const WATERLINE = 0.42; // uv y of the sea/wall boundary
const IMPACT_X = 0.61;  // uv x the slab drops toward

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
uniform float uCrack;   // crackT
uniform float uSlump;   // slump
uniform float uImpact;  // impact
uniform float uAfter;   // aftermath
uniform float uMist;    // mistT
out vec4 fragColor;

const float WATERLINE = ${WATERLINE};
const float SLAB_X0 = ${SLAB_X0};
const float SLAB_X1 = ${SLAB_X1};
const float IMPACT_X = ${IMPACT_X};

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), u);
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
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Wall silhouette: jagged serac top line in uv.
float wallTop(float x) {
  return 0.74 + 0.045 * rfbm(x * 5.5) + 0.014 * rfbm(x * 23.0 + 7.0);
}
// Serrated serac column shading for the wall face.
vec3 wallColor(vec2 uv) {
  float depth = wallTop(uv.x) - uv.y;
  float columns = rfbm(uv.x * 26.0) * 0.7 + rfbm(uv.x * 61.0 + 3.0) * 0.3;
  vec3 ice = mix(vec3(0.42, 0.55, 0.72), vec3(0.72, 0.82, 0.90), columns);
  // serac shadow grooves
  float groove = smoothstep(0.30, 0.9, rfbm(uv.x * 41.0 + 9.0)) * 0.30;
  ice -= groove;
  // crevasse veins: thin dark-blue channels, deeper/bluer toward waterline
  float vein = ridge(uv.x * 90.0 + uv.y * 38.0);
  float veinMask = smoothstep(0.90, 0.995, vein) * (1.0 - smoothstep(0.0, 0.30, depth));
  float waterDeep = 1.0 - smoothstep(WATERLINE, WATERLINE + 0.20, uv.y);
  ice = mix(ice, vec3(0.06, 0.24, 0.48), veinMask * (0.45 + 0.55 * waterDeep));
  // dusk peach rim on serac tops
  float rim = exp(-max(0.0, depth) * 45.0) * smoothstep(0.0, 0.10, depth);
  ice += vec3(0.75, 0.38, 0.16) * rim;
  // deepened blue toward the waterline
  ice = mix(ice, ice * vec3(0.55, 0.78, 1.10), waterDeep * 0.45);
  return ice;
}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;

  // --- dusk sky: indigo high, pale peach band at the horizon --------------
  vec3 sky = mix(vec3(0.95, 0.55, 0.33), vec3(0.07, 0.10, 0.22), smoothstep(0.52, 0.85, y));
  sky = mix(sky, vec3(1.0, 0.72, 0.42), exp(-(y - 0.58) * (y - 0.58) * 900.0) * 0.85);

  // low sun wafer — a pale disc flattened by atmosphere just above the serac
  // line, dimming at impact
  vec2 sd = vec2((x - 0.30) * 2.63, y - 0.84);
  float sdd = length(sd);
  float wafer = 1.0 - smoothstep(0.012, 0.030, sdd);
  wafer *= 0.6 + 0.4 * smoothstep(0.83, 0.85, y); // squashed bottom
  sky += vec3(1.0, 0.72, 0.45) * wafer * (1.3 - 0.8 * uImpact);
  sky += vec3(0.9, 0.5, 0.30) * exp(-sdd * sdd * 900.0) * 0.5;

  vec3 col = sky;

  // radial distance (stretched) from the impact point on the waterline —
  // used by swell rings, splash crown and the mist/glitter zone.
  float dist = length(vec2((x - IMPACT_X) * 1.8, (WATERLINE - y) * 2.6));

  // --- ice wall ------------------------------------------------------------
  // crack path: a branching zigzag polyline inside the slab zone — endpoints
  // fixed, revealed progressively by uCrack. Distance is measured in cuv
  // (pre-drop uv) below so the fracture rides the slab as it falls.
  vec2 c0 = vec2(0.56, 0.80);
  vec2 c1 = vec2(0.585, 0.72);
  vec2 c2 = vec2(0.565, 0.66);
  vec2 c3 = vec2(0.595, 0.58);
  vec2 c4 = vec2(0.575, 0.50);
  vec2 c5 = vec2(0.615, 0.46);
  vec2 c6 = vec2(0.605, WATERLINE);
  float reveal = uCrack * 6.0;

  // slab drop: the block translates down and rolls ~15° around a pivot near
  // its top corner. q is the pre-drop uv this pixel maps back to; when q
  // lands inside the original slab footprint the pixel shows moved ice —
  // wherever that footprint has been carried to (including below the
  // waterline). Where the footprint has been vacated, the scar shows.
  float drop = uSlump * uSlump * 0.42;
  float roll = uSlump * 0.26;
  vec2 piv = vec2(SLAB_X1, wallTop(0.61) - 0.02);
  float ca = cos(roll), sa = sin(roll);
  vec2 rel = vec2(x, y) - piv;
  vec2 q = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca) + piv;
  q.y += drop;

  bool inSlabOrig = x >= SLAB_X0 && x <= SLAB_X1 && y >= WATERLINE;
  // soft coverage (anti-aliased slab outline) + hard gate for uv decisions
  float movedCov = uSlump
    * smoothstep(SLAB_X0 - 0.004, SLAB_X0 + 0.004, q.x)
    * (1.0 - smoothstep(SLAB_X1 - 0.004, SLAB_X1 + 0.004, q.x))
    * smoothstep(WATERLINE - 0.004, WATERLINE + 0.004, q.y)
    * (1.0 - smoothstep(wallTop(q.x) - 0.006, wallTop(q.x) + 0.006, q.y));
  bool movedCovers = movedCov > 0.5;

  float wt = wallTop(x);
  float inWall = 1.0 - smoothstep(wt - 0.004, wt + 0.004, y);
  inWall *= smoothstep(WATERLINE - 0.004, WATERLINE + 0.004, y);

  vec3 ice = wallColor(vec2(x, y));
  // scar: the torn face left behind where the slab footprint is vacated
  if (inSlabOrig) {
    float torn = uSlump * smoothstep(SLAB_X0 - 0.004, SLAB_X0 + 0.004, x)
      * (1.0 - smoothstep(SLAB_X1 - 0.004, SLAB_X1 + 0.004, x));
    ice = mix(ice, vec3(0.22, 0.34, 0.50), torn * (1.0 - smoothstep(0.32, 0.44, y - WATERLINE)) * 0.75);
  }
  col = mix(col, ice, inWall);
  if (inSlabOrig && !movedCovers) {
    // gap the slab left: darker torn face across the vacated footprint
    col = mix(col, vec3(0.20, 0.32, 0.46), inWall * uSlump * 0.8);
  }
  // moved slab is composited after the sea pass below — pixels under the
  // waterline belong to the block while it plunges, not the sea.

  // glowing blue fracture — measured in pre-drop uv so it rides the slab down
  vec2 cuv = movedCovers ? q : vec2(x, y);
  float crackD2 = 1e9;
  crackD2 = min(crackD2, seg(cuv, c0, c1) + (1.0 - clamp(reveal - 0.0, 0.0, 1.0)) * 1e3);
  crackD2 = min(crackD2, seg(cuv, c1, c2) + (1.0 - clamp(reveal - 1.0, 0.0, 1.0)) * 1e3);
  crackD2 = min(crackD2, seg(cuv, c2, c3) + (1.0 - clamp(reveal - 2.0, 0.0, 1.0)) * 1e3);
  crackD2 = min(crackD2, seg(cuv, c3, c4) + (1.0 - clamp(reveal - 3.0, 0.0, 1.0)) * 1e3);
  crackD2 = min(crackD2, seg(cuv, c4, c5) + (1.0 - clamp(reveal - 4.0, 0.0, 1.0)) * 1e3);
  crackD2 = min(crackD2, seg(cuv, c5, c6) + (1.0 - clamp(reveal - 5.0, 0.0, 1.0)) * 1e3);
  float br1m = seg(cuv, c2, c2 + vec2(0.045, -0.05)) + (1.0 - clamp(reveal - 2.2, 0.0, 1.0)) * 1e3;
  float br2m = seg(cuv, c4, c4 + vec2(-0.035, -0.04)) + (1.0 - clamp(reveal - 4.2, 0.0, 1.0)) * 1e3;
  crackD2 = min(crackD2, min(br1m, br2m));

  float crackGlow = 1.0 - smoothstep(0.0008, 0.0030, crackD2);
  float crackHalo = exp(-crackD2 * crackD2 * 90000.0) * 0.35;
  vec3 crackCol = vec3(0.30, 0.58, 1.0);
  float crackFlicker = 0.85 + 0.15 * sin(t * 37.0 + crackD2 * 4000.0);
  float crackMask = movedCov > 0.001 ? 0.8 * movedCov
                  : inWall * (inSlabOrig && uSlump > 0.001 ? 0.0 : 1.0);
  col += crackCol * (crackGlow * 1.15 + crackHalo) * crackFlicker
       * crackMask * (1.0 - uSlump);

  // --- sea ---------------------------------------------------------------
  if (y < WATERLINE) {
    float sw = WATERLINE - y;
    vec3 sea = mix(vec3(0.05, 0.09, 0.15), vec3(0.10, 0.19, 0.29), smoothstep(0.0, 0.42, sw));
    // dusk reflection band under the sun
    float ref = exp(-(x - 0.30) * (x - 0.30) * 60.0) * exp(-sw * 6.0);
    sea += vec3(0.55, 0.32, 0.18) * ref * (1.0 - 0.6 * uImpact);
    // wave banding
    float wv = sin(y * 240.0 + vnoise2(vec2(x * 8.0, y * 20.0)) * 6.0 - t * 1.3);
    sea *= 1.0 + wv * 0.05;

    // expanding swell rings from the impact point — squared deltas, no pow
    // on signed bases (undefined in GLSL ES).
    float ringT = max(0.0, t - 11.3);
    float ringPos = ringT * 0.10;
    float rd1 = (dist - ringPos) * 30.0;
    float rd2 = (dist - ringPos * 0.72) * 34.0;
    float rd3 = (dist - ringPos * 0.45) * 38.0;
    float ring = exp(-rd1 * rd1);
    float ring2 = exp(-rd2 * rd2) * 0.7;
    float ring3 = exp(-rd3 * rd3) * 0.5;
    float ringDecay = exp(-ringT * 0.5) * (1.0 - smoothstep(0.0, 0.02, abs(dist - ringPos) - 0.15)) + 0.4 * exp(-ringT * 0.4);
    sea += vec3(0.55, 0.72, 0.85) * (ring + ring2 + ring3) * ringDecay * uImpact;

    // splash crown: foam torus at the impact site, rises then collapses
    float crownR = uImpact * 0.085 * (1.0 + 0.35 * uSlump);
    float crownD = abs(dist - crownR);
    float crownH = (1.0 - smoothstep(11.3, 13.5, t)) * 0.10 + 0.02;
    float crownFade = (1.0 - smoothstep(12.2, 15.5, t));            // dies out fully
    float inCrown = exp(-crownD * crownD * 9000.0)
                  * (1.0 - smoothstep(crownH * 0.2, crownH * 2.5, sw))
                  * uImpact * crownFade;                            // gated to impact
    float foam = fbm2(vec2(x * 30.0 + t * 2.0, y * 60.0 - t * 3.0));
    sea += vec3(0.85, 0.93, 1.0) * inCrown * (0.5 + 0.5 * foam);

    // foam streak wash under the wall after impact
    float wash = (1.0 - smoothstep(0.0, 0.10, sw)) * uAfter * (0.4 + 0.3 * foam);
    sea = mix(sea, vec3(0.55, 0.68, 0.78), wash * 0.45);
    col = sea;
  }

  // moved slab over everything: a plunging block stays visible at the surface
  if (movedCov > 0.001) {
    vec3 slab = wallColor(q);
    slab *= 1.0 - 0.25 * uSlump;
    slab = mix(slab, vec3(0.30, 0.42, 0.56), smoothstep(0.25, 0.42, drop) * 0.5);
    slab *= y < WATERLINE ? 0.75 : 1.0;          // dim the submerged part
    col = mix(col, slab, movedCov);
  }

  // --- mist + glitter over the splash -------------------------------------
  float mz = dist * 2.2;
  float mistZone = exp(-mz * mz) * (1.0 - smoothstep(WATERLINE + 0.02, WATERLINE + 0.26, y));
  float mst = fbm2(vec2(x * 12.0 + t * 0.8, y * 22.0 - t * 1.6));
  col = mix(col, vec3(0.72, 0.80, 0.88), mistZone * mst * uMist * 0.55);
  // glitter: sparse twinkling specks above the waterline — fades with the mist
  float spk = hash1(floor(x * 640.0) + floor(y * 360.0) * 57.0);
  float tw = step(0.9985, fract(spk + t * 0.35)) * mistZone;
  col += vec3(0.9, 0.95, 1.0) * tw * (0.4 + 0.6 * uAfter) * uImpact * 0.9
       * (1.0 - smoothstep(16.0, 19.0, t));

  // faint atmospheric haze banding
  col = mix(col, col * vec3(0.92, 0.97, 1.05), uAfter * 0.15);

  fragColor = vec4(col, 1.0);
}`;

const BERGS = 12;
const BIRDS = 18;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

export default class GlacierCalveScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = {
    uT: { value: 0 }, uCrack: { value: 0 }, uSlump: { value: 0 },
    uImpact: { value: 0 }, uAfter: { value: 0 }, uMist: { value: 0 },
  };
  private bergs: THREE.InstancedMesh;
  private birds: THREE.InstancedMesh;
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

    // bergs: angular ice shards bobbing after impact
    this.bergs = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.6, 0),
      new THREE.MeshStandardMaterial({ color: 0xdcecf5, roughness: 0.55, metalness: 0.05, flatShading: true }),
      BERGS,
    );
    this.bergs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.three.add(this.bergs);

    // seabirds: small dark dart shapes scattering once
    this.birds = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.35, 1.1, 3),
      new THREE.MeshBasicMaterial({ color: 0x10141c }),
      BIRDS,
    );
    this.birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.three.add(this.birds);

    this.three.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffc090, 1.6); // dusk peach key
    key.position.set(-40, 30, 60);
    this.three.add(key);
  }

  // Berg pose: surfaces at impact, drifts outward from the splash site,
  // bobs on a decaying sine. All closed-form on hash seeds.
  private bergPose(i: number, t: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);
    const w = frac(i * 0.7548776662);
    const dt = Math.max(0, t - 11.5);
    // drift direction: outward from impact x, biased left/right by hash
    const dir = (u - 0.5) * 2.0;
    const speed = 0.004 + 0.006 * w;
    const x0 = IMPACT_X + dir * 0.02;
    const x = x0 + dir * speed * dt + 0.006 * Math.sin(dt * 0.4 + u * 9.0);
    const bobAmp = 0.016 * Math.exp(-dt * 0.35); // decaying sine
    const y = WATERLINE - 0.006 + bobAmp * Math.sin(dt * (2.2 + w) + u * 40.0);
    uvToWorld(x, y, out);
    out.z += 26 + w * 10.0;
    const surface = ss(0, 0.6, dt); // pop up after impact
    return {
      scale: (0.5 + 0.9 * w) * surface,
      roll: u * 6.28 + dt * 0.15 * dir + bobAmp * 3.0 * Math.sin(dt * 1.7 + w * 20.0),
    };
  }

  // Bird pose: single radial scatter from the splash site, exits and never returns.
  private birdPose(i: number, t: number, out: THREE.Vector3) {
    const u = frac(i * 0.4142135623);
    const w = frac(i * 0.7320508075);
    const dt = t - (11.6 + u * 0.5); // staggered takeoff
    if (dt <= 0) { out.set(0, -999, 0); return { live: false, flap: 0 }; }
    const bearing = -0.4 + (u * 1.4); // radians: fanned upward spread
    const speed = 0.045 + 0.05 * w;
    const d = speed * dt;
    const x = IMPACT_X + Math.sin(bearing) * d + (w - 0.5) * 0.05;
    const y = WATERLINE + 0.06 + Math.abs(Math.sin(bearing)) * d * 0.8
            + 0.02 * Math.sin(dt * (9.0 + w * 5.0) + u * 30.0) * Math.exp(-dt * 0.4);
    uvToWorld(x, y, out);
    out.z += 30.0;
    const flap = Math.sin(dt * (18.0 + w * 8.0) + u * 20.0);
    return { live: true, flap };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uCrack.value = crackT(t);
    this.u.uSlump.value = slump(t);
    this.u.uImpact.value = impact(t);
    this.u.uAfter.value = aftermath(t);
    this.u.uMist.value = mistT(t);

    for (let i = 0; i < BERGS; i++) {
      const bp = this.bergPose(i, t, this.p);
      if (bp.scale <= 0.001) { this.m.makeScale(0, 0, 0); this.bergs.setMatrixAt(i, this.m); continue; }
      this.e.set(bp.roll * 0.4, bp.roll, bp.roll * 0.3);
      this.q.setFromEuler(this.e);
      this.sv.set(bp.scale * (1.2 + 0.4 * Math.sin(i * 3.1)), bp.scale * 0.8, bp.scale);
      this.m.compose(this.p, this.q, this.sv);
      this.bergs.setMatrixAt(i, this.m);
    }
    this.bergs.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < BIRDS; i++) {
      const bp = this.birdPose(i, t, this.p);
      if (!bp.live) { this.m.makeScale(0, 0, 0); this.birds.setMatrixAt(i, this.m); continue; }
      this.e.set(0, 0, bp.flap * 0.5);
      this.q.setFromEuler(this.e);
      this.sv.set(1.0 + Math.abs(bp.flap) * 0.5, 0.6 + Math.abs(bp.flap) * 0.6, 1.0);
      this.m.compose(this.p, this.q, this.sv);
      this.birds.setMatrixAt(i, this.m);
    }
    this.birds.instanceMatrix.needsUpdate = true;

    // camera: hold wide → pan toward the crack → micro-push into the drop →
    // settle back on a slightly wider aftermath hold. Breath drift keeps it alive.
    const pan = ss(6, 10, t);
    const push = ss(9.5, 12.5, t) * (1 - ss(14, 17, t) * 0.6);
    this.cam.position.set(
      4.0 * pan + 0.6 * Math.sin(t * 0.05),
      6.5 - 1.2 * push + 0.3 * Math.sin(t * 0.07 + 1.0),
      24.0 - 4.0 * push,
    );
    this.cam.lookAt(
      8.0 * pan - 3.0 * push,
      10.0 - 4.0 * push + 1.5 * aftermath(t),
      PZ + 20,
    );

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.55 - 0.10 * impact(t) + 0.05 * aftermath(t),
      bloom: 0.30 + 0.20 * crackT(t),
      bloomThreshold: 0.55,
      bloomRadius: 0.7,
      ca: 0.08 + 0.10 * impact(t),
      grain: 0.05 + 0.03 * aftermath(t),
      vignette: 0.5,
      level:
        ss(0, 0.8, t) * (this.ctx.end >= 19.9 ? 1 - ss(20.0 - 0.8, 20.0, t) : 1),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.bergs.dispose();
    this.birds.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

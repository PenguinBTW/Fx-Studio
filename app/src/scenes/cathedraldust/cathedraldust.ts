// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// cathedraldust — a ruined stone cathedral interior. One fullscreen GLSL
// pass holds the shot: debris-field floor, four fogged column trunks, a
// broken vault overhead with a ragged breach where three sunbeams rake in,
// and a rose-window remnant high on the far wall throwing faint colored
// spots. ~200 hash-seeded motes drift down in two parallax bands, brighter
// inside the beams; a pigeon crosses one beam on a closed-form transit; a
// chain sways where a lantern hung; a fragment drops and puffs once. The
// sun's arc slides the beams late in the take. CameraRig pushes slowly
// toward the rose window with a slight lateral drift; Layer2D holds the
// anchored captions. Everything is closed-form f(t), hash seeds only.
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

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// uv-space scene: y < FLOOR is the debris floor; the far wall rises to the
// broken vault band; the rose window sits high center. The beams enter at
// the breach (top-right) and rake down-left; the sun arc u=sstep(13,18,t)
// slides their floor intercepts right and cross-fades beam2→beam3.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uDrift;
out vec4 fragColor;
const float FLOOR = 0.30;
const float ASPECT = ${(16 / 9).toFixed(4)};

float h1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i.x + i.y * 57.0), h1(i.x + 1.0 + i.y * 57.0), u.x),
             mix(h1(i.x + (i.y + 1.0) * 57.0), h1(i.x + 1.0 + (i.y + 1.0) * 57.0), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
// GLSL ES leaves smoothstep(edge0>edge1) undefined; sstep keeps the same
// semantics on every driver by flipping to the descending complement.
float sstep(float e0, float e1, float x) {
  return e0 < e1 ? smoothstep(e0, e1, x) : 1.0 - smoothstep(e1, e0, x);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// ---- the sun's arc: beams slide right + cross-fade through the take ----
float sunArc(float t) { return sstep(13.0, 18.0, t); }

// beam k: parallelogram from breach point down-left to floor intercept.
// inside() returns 0..1 softness-weighted mask.
float beamMask(vec2 uv, vec2 top, vec2 foot, float hw, float alpha) {
  vec2 d = foot - top;
  float len = length(d);
  vec2 dir = d / len;
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 rel = uv - top;
  float along = dot(rel, dir);
  float across = dot(rel, nrm);
  float m = (1.0 - smoothstep(hw * 0.45, hw, abs(across)))
          * smoothstep(0.0, len * 0.06, along)
          * (1.0 - smoothstep(len * 0.82, len, along));
  // slight billow inside the shaft so it reads volumetric, not flat
  m *= 0.8 + 0.4 * fbm3(vec2(uv.x * 9.0, uv.y * 4.0 - uT * 0.10));
  return m * alpha;
}

// three shafts; sun arc slides floor intercepts and cross-fades b2→b3
float beams(vec2 uv, float t) {
  float u = sunArc(t);
  float s = 0.0;
  s += beamMask(uv, vec2(0.64, 0.80), vec2(0.30 + 0.05 * u, FLOOR), 0.045, 1.0);
  s += beamMask(uv, vec2(0.72, 0.79), vec2(0.47 + 0.06 * u, FLOOR), 0.055, 1.0 - 0.85 * u);
  s += beamMask(uv, vec2(0.80, 0.80), vec2(0.62 + 0.07 * u, FLOOR), 0.040, 0.15 + 0.85 * u);
  return s;
}

// a mote is lit when it sits inside a beam plane
float beamAt(vec2 p, float t) { return clamp(beams(p, t), 0.0, 1.5); }

vec3 wallCol(vec2 uv, float t) {
  // cold stone: dark base, faint warm ambient from the beams' bounce
  vec3 c = mix(vec3(0.10, 0.11, 0.14), vec3(0.16, 0.16, 0.19), uv.y);
  c += vec3(0.05, 0.04, 0.02) * fbm2(uv * vec2(6.0, 3.0));
  // block joints: faint horizontal courses
  float course = sstep(0.012, 0.004, abs(fract(uv.y * 14.0) - 0.5) - 0.46);
  c *= 1.0 - 0.10 * course;
  // stone mottle
  c *= 0.85 + 0.30 * fbm2(uv * 22.0 + 3.1);
  return c;
}

// rose window remnant at (0.52,0.64), r=0.058: shard ring + tracery
vec3 roseWin(vec2 uv, float t, inout float winMask) {
  vec2 p = uv - vec2(0.52, 0.64);
  p.x *= ASPECT;
  float r = length(p);
  float ang = atan(p.y, p.x);
  winMask = 1.0 - smoothstep(0.048, 0.058, r);
  if (winMask <= 0.0) return vec3(0.0);
  // ring: 10 shard wedges, ~3 missing (dark). Tracery spokes darken lines.
  float wedge = floor(mod(ang * 10.0 / 6.28318 + 10.0, 10.0));
  float wseed = h1(wedge * 13.7 + 2.2);
  vec3 glass = wseed < 0.34 ? vec3(0.80, 0.16, 0.22)
             : wseed < 0.67 ? vec3(0.22, 0.32, 0.90)
                            : vec3(0.90, 0.68, 0.18);
  float missing = step(h1(wedge * 7.3 + 9.1), 0.30);
  float spoke = 1.0 - smoothstep(0.008, 0.016, abs(fract(ang * 10.0 / 6.28318) - 0.5) * r);
  float ring = smoothstep(0.028, 0.034, r) * (1.0 - smoothstep(0.048, 0.058, r));
  // oculus: center remnant — half its glass is gone
  float oculus = (1.0 - smoothstep(0.018, 0.024, r)) * step(0.5, h1(floor(ang * 4.0 / 6.28318 + 8.0) * 5.1));
  float lit = (ring * (1.0 - missing) * 0.8 + oculus * 0.5) * (1.0 - spoke * 0.7);
  float glow = 0.55 + 0.45 * sin(uT * 0.13 + wedge); // slow shimmer per shard
  return glass * lit * (0.7 + 0.6 * glow);
}

// colored spots the window throws on the wall + one on the floor
vec3 roseSpots(vec2 uv, float t) {
  float u = sunArc(t);
  vec3 c = vec3(0.0);
  vec2 ctrs[3] = vec2[3](vec2(0.40 + 0.04 * u, 0.46), vec2(0.55 + 0.05 * u, 0.40), vec2(0.68 + 0.05 * u, 0.48));
  vec3 cols[3] = vec3[3](vec3(0.55, 0.10, 0.14), vec3(0.13, 0.19, 0.55), vec3(0.55, 0.40, 0.10));
  for (int i = 0; i < 3; i++) {
    vec2 d = (uv - ctrs[i]) * vec2(ASPECT * 1.2, 1.8);
    float m = exp(-dot(d, d) * 40.0) * (0.6 + 0.4 * fbm3(uv * 30.0 + float(i)));
    c += cols[i] * m * 0.30;
  }
  // floor spot
  vec2 df = (uv - vec2(0.50 + 0.06 * u, 0.16)) * vec2(ASPECT, 2.5);
  c += vec3(0.45, 0.20, 0.30) * exp(-dot(df, df) * 60.0) * 0.25;
  return c;
}

// column trunk: silhouette band with capital flare + fog softening
float columnMask(vec2 uv, float cx, float hw, float dark) {
  float cap = smoothstep(0.72, 0.79, uv.y) * 0.015;
  float m = 1.0 - smoothstep(hw, hw + 0.02 + cap, abs(uv.x - cx));
  m *= sstep(FLOOR - 0.02, FLOOR + 0.03, uv.y); // stands on the floor
  return m * dark;
}

// pigeon: closed-form transit — left rafters → beam crossing → loop → land
vec2 pigeonPos(float t) {
  vec2 p0 = vec2(0.16, 0.74);
  vec2 p1 = vec2(0.40, 0.66);
  vec2 cL = vec2(0.60, 0.60);
  vec2 p3 = vec2(0.74, 0.74);
  float a1 = sstep(9.0, 10.0, t);
  float a2 = sstep(10.0, 10.8, t);
  float a3 = sstep(10.8, 12.6, t);
  float a4 = sstep(12.6, 13.6, t);
  // blend onto the ellipse early in a3, then ride it a full turn around cL
  float on = sstep(10.8, 11.2, t);
  float th = 3.6 + a3 * 6.28318;
  vec2 loop = cL + vec2(cos(th) * 0.10, sin(th) * 0.075);
  vec2 p = mix(p0, p1, a1);
  p = mix(p, vec2(0.50, 0.55), a2);
  p = mix(p, loop, on);
  p = mix(p, p3, a4);
  return p;
}

float pigeon(vec2 uv, float t) {
  if (t < 9.0 || t > 13.8) return 0.0;
  vec2 pp = pigeonPos(t);
  vec2 d = (uv - pp) * vec2(ASPECT, 1.0);
  // flap envelope: strong mid-flight, folds on landing
  float flapAmp = (1.0 - sstep(12.4, 13.4, t)) * sstep(9.0, 9.6, t);
  float flap = sin(t * 11.0) * 0.014 * flapAmp;
  float body = 1.0 - smoothstep(0.008, 0.016, length(d));
  float wings = 1.0 - smoothstep(0.004, 0.012, sdSeg(d, vec2(-0.030, flap), vec2(0.0, 0.0)))
              + 1.0 - smoothstep(0.004, 0.012, sdSeg(d, vec2(0.0, 0.0), vec2(0.030, flap)));
  return clamp(body + wings * 0.8, 0.0, 1.0);
}

// hanging chain near x=0.66, pendulum sway after t≈3
float chain(vec2 uv, float t) {
  float sway = 0.05 * sin(t * 0.7) * sstep(3.0, 6.0, t);
  vec2 top = vec2(0.66, 0.78);
  vec2 bot = top + vec2(sin(sway) * 0.26, -0.26);
  float d = sdSeg(uv * vec2(ASPECT, 1.0), top * vec2(ASPECT, 1.0), bot * vec2(ASPECT, 1.0));
  float links = 0.6 + 0.4 * sin(uv.y * 700.0);
  return (1.0 - smoothstep(0.0025, 0.005, d)) * links;
}

// stone-dust puff: a fragment drops ~t14.0, the puff expands and fades
float puff(vec2 uv, float t) {
  float dt = t - 14.0;
  if (dt < -0.05) return 0.0;
  vec2 c0 = vec2(0.58, FLOOR + 0.01);
  float pt = dt - 0.17; // puff only after the fragment reaches the floor
  float R = 0.02 + 0.10 * sstep(0.0, 1.2, pt);
  float fade = 1.0 - sstep(0.5, 1.8, pt);
  vec2 d = (uv - c0) * vec2(ASPECT, 1.6);
  float m = (1.0 - smoothstep(R * 0.6, R, length(d))) * (0.5 + 0.5 * fbm3(uv * 40.0 + pt * 3.0))
          * step(0.0, pt);
  // the falling fragment itself for ~0.35s before the puff
  float frag = 0.0;
  if (dt < 0.4 && dt > -0.05) {
    vec2 fp = vec2(0.58, max(0.78 - 2.2 * (dt + 0.05), FLOOR + 0.005));
    frag = (1.0 - smoothstep(0.004, 0.010, length((uv - fp) * vec2(ASPECT, 1.0)))) * sstep(-0.05, 0.1, dt);
  }
  return clamp(m * fade + frag, 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // ---- far wall + fog ----
  vec3 c = wallCol(uv, t);

  // broken vault overhead: arch band, ragged breach where the beams enter
  float vaultEdge = 0.78 + 0.04 * sin(uv.x * 3.0) + 0.03 * fbm2(vec2(uv.x * 8.0, 4.4));
  float breach = sstep(0.60, 0.68, uv.x) * sstep(0.90, 0.82, uv.x); // x in ~0.60..0.86
  float ragged = fbm3(vec2(uv.x * 14.0, 2.2)) * 0.05;
  float vault = sstep(vaultEdge - max(ragged * breach, 0.001), vaultEdge, uv.y);
  // inside the breach the vault is gone (sky-black gap)
  float gap = vault * breach * sstep(0.05, 0.12, ragged + 0.04);
  c = mix(c, vec3(0.02, 0.02, 0.03), vault * (1.0 - gap) * 0.92);
  c = mix(c, vec3(0.04, 0.05, 0.08), gap * 0.85);

  // ---- debris floor ----
  float fm = sstep(FLOOR + 0.005, FLOOR - 0.01, uv.y);
  vec3 floorC = mix(vec3(0.07, 0.07, 0.09), vec3(0.12, 0.11, 0.12), fbm3(uv * vec2(10.0, 26.0)));
  // scattered rocks: seeded blobs along the floor band
  float rocks = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 rp = vec2(0.04 + 0.92 * h1(fi * 7.1 + 1.3), 0.03 + 0.24 * h1(fi * 3.7 + 5.0));
    float rr = 0.010 + 0.028 * h1(fi * 11.3 + 2.0);
    float rm = 1.0 - smoothstep(rr * 0.7, rr, length((uv - rp) * vec2(ASPECT, 2.2)));
    rocks = max(rocks, rm);
  }
  // two fallen column drums on their sides
  rocks = max(rocks, 1.0 - smoothstep(0.001, 0.010, sdSeg(uv * vec2(ASPECT, 1.0), vec2(0.30 * ASPECT, 0.10), vec2(0.42 * ASPECT, 0.13)) - 0.030));
  rocks = max(rocks, 1.0 - smoothstep(0.001, 0.010, sdSeg(uv * vec2(ASPECT, 1.0), vec2(0.68 * ASPECT, 0.07), vec2(0.80 * ASPECT, 0.10)) - 0.026));
  floorC = mix(floorC, vec3(0.16, 0.15, 0.15), rocks * 0.8);
  c = mix(c, floorC, fm);

  // ---- columns in soft fog (near=darker) ----
  c = mix(c, vec3(0.04, 0.045, 0.06), columnMask(uv, 0.16, 0.045, 1.0));
  c = mix(c, vec3(0.06, 0.065, 0.08), columnMask(uv, 0.29, 0.030, 0.85));
  c = mix(c, vec3(0.06, 0.065, 0.08), columnMask(uv, 0.73, 0.030, 0.85));
  c = mix(c, vec3(0.04, 0.045, 0.06), columnMask(uv, 0.85, 0.050, 1.0));

  // ---- rose window + thrown color ----
  float winM = 0.0;
  vec3 win = roseWin(uv, t, winM);
  c = mix(c, vec3(0.02, 0.02, 0.03), winM * 0.55); // dark disc behind glass
  c += win;
  c += roseSpots(uv, t) * (1.0 - fm * 0.4);

  // ---- sunbeams (volumetric; only where the dust column lives) ----
  float bm = beams(uv, t);
  c += vec3(1.0, 0.85, 0.55) * bm * (0.16 + 0.16 * fm + 0.18 * sstep(FLOOR, 0.85, uv.y));

  // ---- dust motes, two parallax bands ----
  for (int k = 0; k < 2; k++) {
    float kk = float(k);
    float n = kk < 0.5 ? 120.0 : 80.0;
    for (float i = 0.0; i < 120.0; i++) {
      if (i >= n) break;
      float sd = h1(i * 7.13 + kk * 31.7);
      float spd = 0.008 + 0.014 * h1(i * 3.3 + kk * 9.0);
      float y0 = h1(i * 11.7 + kk * 5.0);
      float yy = fract(y0 - t * spd * (1.0 + 0.6 * kk));
      float xx = fract(h1(i * 17.1 + kk * 13.0) + t * (0.004 + 0.006 * kk) + 0.03 * sin(t * 0.4 + sd * 20.0) - uDrift * (0.04 + 0.10 * kk));
      float sz = 0.0012 + 0.0022 * h1(i * 5.9 + kk * 7.0) + 0.0016 * kk;
      vec2 mp = vec2(xx, yy);
      float dm = length((uv - mp) * vec2(ASPECT, 1.0));
      float mote = 1.0 - smoothstep(sz * 0.6, sz, dm);
      float lit = 0.35;
      if (mote > 0.0) lit += 3.0 * beamAt(mp, t);
      float twk = 0.6 + 0.7 * step(0.965, h1(floor(t * 3.0) + i * 23.0 + kk * 91.0));
      c += vec3(1.0, 0.92, 0.70) * mote * lit * twk * (0.5 + 0.5 * sd);
    }
  }

  // ---- props & life ----
  float ch = chain(uv, t);
  c = mix(c, vec3(0.05, 0.05, 0.06), ch * 0.9);
  c += vec3(1.0, 0.85, 0.55) * ch * bm * 0.6; // chain catches the beam edge

  float pg = pigeon(uv, t);
  c = mix(c, vec3(0.03, 0.03, 0.04), pg * 0.95);

  float pf = puff(uv, t);
  c = mix(c, vec3(0.22, 0.20, 0.18), pf * 0.7);

  // low fog: denser near the floor, drifting slightly
  float fog = sstep(0.75, 0.05, uv.y) * (0.25 + 0.20 * fbm2(vec2(uv.x * 5.0 - t * 0.02, uv.y * 8.0)));
  c = mix(c, vec3(0.10, 0.11, 0.13), fog * 0.5);

  // gentle top vignette so the vault reads as void
  c *= 1.0 - 0.35 * sstep(0.66, 0.90, uv.y);

  fragColor = vec4(c, 1.0);
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [(u - 0.5) * PW, PY + (v - 0.5) * PH];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [1.2, 4.0, 'the nave holds its breath', [0.50, 0.44]],
  [5.0, 7.8, 'two hundred motes own the light', [0.55, 0.55]],
  [9.5, 12.6, 'one pigeon crosses the beam', [0.52, 0.58]],
  [14.0, 16.6, 'the sun shifts its weight', [0.55, 0.50]],
  [17.2, 19.6, 'stone keeps what light forgets', [0.50, 0.50]],
];

export default class CathedraldustScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private rig = new CameraRig();
  private layer = new Layer2D(W, H);
  private u = { uT: { value: 0 }, uDrift: { value: 0 } };
  private v = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: very slow push toward the rose window + slight lateral
    // drift so the beams parallax; near-static otherwise.
    const push = ss(0.5, 19.0, t);
    // same closed form as rig.position[0] — deterministic regardless of
    // which frame rendered before this one (e.g. a still at t)
    this.u.uDrift.value = 0.55 * push + 0.15 * Math.sin(t * 0.05);
    this.rig.position = [
      0.55 * push + 0.15 * Math.sin(t * 0.05),
      5.5 + 1.0 * push,
      78.0 - 6.0 * push,
    ];
    this.rig.target = [0.4 * push, 9 + 4.0 * push, PZ];
    this.rig.roll = 0.004 * Math.sin(t * 0.07);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // probe captions (textProbes auto-emit via the main.ts canvas hook)
    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text, auv] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        const [awx, awy] = uv2w(auv[0], auv[1]);
        const ndc = this.v.set(awx, awy, PZ + 0.4).project(this.cam);
        if (ndc.z > 1) continue;
        const cx0 = (ndc.x * 0.5 + 0.5) * W;
        // ground-anchored captions can project below the canvas — clamp cy
        // like cx so the caption always lands inside the frame
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(5, 6, 10, 0.9)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f6ead8';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.7,
      bloom: 0.35,
      bloomThreshold: 0.70,
      bloomRadius: 0.75,
      ca: 0.09,
      grain: 0.06,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

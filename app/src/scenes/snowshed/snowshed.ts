// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// snowshed — a wooden railway snow shed on a mountain pass at deep twilight.
// One fullscreen GLSL pass holds the shot: a dark mountain flank upper-left,
// a long timber gallery running diagonally through frame with its open side
// toward us, snow falling through the whole scene, a hanging lamp glowing
// warm at the far end. A train passes unseen — only its lamp blooms through
// the timber gaps, a light sweep travels the shed, and a red tail lamp fades
// at the near end. A hare darts the open slope once; a raven lands on a post;
// blue smoke puffs from a roof vent; an icicle beads and drips. All
// closed-form f(t), hash seeds only. CameraRig is low and near-static with a
// slight drift along the shed's diagonal; Layer2D holds anchored captions.
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
  }
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

const float ASPECT = 320.0 / 140.0; // uv x→world x vs y — /ASPECT for round shapes
// shed runs diagonally: near-left low to far-right high
const float SHED_Y0 = 0.44;  // eave line (bottom of posts) at x=0
const float SHED_Y1 = 0.66;  // eave line at x=1
const float SHED_H = 0.16;   // wall height (posts) before the roof
const float ROOF_H = 0.050;   // pitched roof band
const float FARX = 0.86;     // shed's far end
// beats
const float GUST = 3.0;      // one snow gust crosses
const float APPROACH = 4.0;  // train lamp blooms at the far end
const float PASS = 8.0;      // light sweep travels the shed
const float TAIL = 11.5;     // red tail lamp at the near end
const float HARE = 6.5;      // hare darts the open slope
const float RAVEN = 13.0;    // raven lands on a post
const float SETTLE = 15.0;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x),
             mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vn2(p); p *= 2.13; a *= 0.5; }
  return s;
}
float sstep(float e0, float e1, float x) {
  float m = clamp((x - min(e0, e1)) / abs(e1 - e0), 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  return e0 < e1 ? m : 1.0 - m;
}
float sdist(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r; q.x *= ASPECT;
  return length(q);
}
float dseg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float u = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  vec2 d = pa - ba * u; d.x *= ASPECT;
  return length(d);
}
float boxm(vec2 p, vec2 c, vec2 r, float soft) {
  vec2 d = abs(p - c) - r;
  return sstep(soft, -soft, max(d.x, d.y));
}

// shed geometry in uv
float eaveAt(float x) { return SHED_Y0 + (SHED_Y1 - SHED_Y0) * x; }
float roofAt(float x) { return eaveAt(x) + SHED_H * (1.0 - 0.35 * x) + ROOF_H * (1.0 - 0.5 * x); }
float inShedX(vec2 uv) { return sstep(0.02, 0.06, uv.x) * sstep(1.0, FARX, uv.x); }

// ---- twilight: deep blue sky, mountain flank, snow field ----
vec3 skyAt(vec2 uv, float t) {
  vec3 s = mix(vec3(0.030, 0.045, 0.085), vec3(0.012, 0.018, 0.045), sstep(0.25, 1.0, uv.y));
  // faint cold light near the pass summit right
  s += vec3(0.04, 0.05, 0.06) * exp(-sdist(uv, vec2(0.93, 0.42), vec2(0.25, 0.25)) * 2.0);
  return s;
}
float mtnAt(vec2 uv) {
  // mountain flank upper-left + ridge falling to the pass at right
  float edge = 0.98 - 0.42 * uv.x + 0.10 * vn2(vec2(uv.x * 14.0, 0.0)) + 0.05 * sin(uv.x * 9.0 + 1.0);
  float m = sstep(edge + 0.03, edge - 0.02, uv.y);
  m *= sstep(0.15, 0.45, uv.x) * 0.9 + 0.1;
  return m;
}
float slopeAt(vec2 uv) {
  // open snow slope in front of the shed, lower-left
  float e = 0.40 + 0.09 * uv.x + 0.02 * sin(uv.x * 11.0);
  return sstep(e + 0.02, e - 0.03, uv.y);
}

// ---- the shed: posts, beams, roof, interior dark, lamp glow ----
float postsAt(vec2 uv) {
  // timber rhythm along the wall band; posts space out toward the far end
  float ex = eaveAt(uv.x);
  float band = sstep(ex - 0.004, ex + 0.004, uv.y) * sstep(roofAt(uv.x) - ROOF_H, roofAt(uv.x) - ROOF_H - 0.015, uv.y);
  float pitch = mix(0.052, 0.030, uv.x); // posts tighten with distance
  float k = uv.x / pitch;
  float post = sstep(0.16, 0.09, abs(fract(k) - 0.5));
  float rail1 = sstep(0.006, 0.002, abs(uv.y - (ex + 0.035 + 0.03 * uv.x)));
  float rail2 = sstep(0.006, 0.002, abs(uv.y - (ex + 0.095 + 0.05 * uv.x)));
  return band * max(post, max(rail1, rail2)) * inShedX(uv);
}
float roofAtM(vec2 uv, float t) {
  float rt = roofAt(uv.x);
  float band = sstep(rt + 0.004, rt - 0.004, uv.y) * sstep(rt - ROOF_H, rt - ROOF_H + 0.006, uv.y);
  return band * inShedX(uv);
}
float interiorAt(vec2 uv) {
  // dark interior showing through the open side between posts
  float ex = eaveAt(uv.x);
  return sstep(ex - 0.002, ex + 0.002, uv.y) * sstep(roofAt(uv.x) - ROOF_H - 0.008, roofAt(uv.x) - ROOF_H - 0.018, uv.y)
         * inShedX(uv);
}

// ---- the train that is never seen: lamp bloom, light sweep, tail lamp ----
vec3 trainAt(vec2 uv, float t, float posts) {
  vec3 glow = vec3(0.0);
  // approach: lamp blooms at the far end through the timber gaps (4→8s)
  {
    float u = sstep(APPROACH, PASS - 0.4, t);
    vec2 lp = vec2(0.80, roofAt(0.80) - ROOF_H - 0.075);
    float bl = exp(-sdist(uv, lp, vec2(0.035 + 0.045 * u, 0.045 + 0.045 * u)) * 2.4) * u * 2.2 * sstep(PASS + 0.8, PASS - 0.4, t);
    // light only lives in the gaps: interior visible and not covered by a post
    float gap = interiorAt(uv) * (1.0 - posts);
    glow += vec3(1.0, 0.72, 0.34) * bl * (0.15 + 0.85 * gap);
    glow += vec3(0.9, 0.6, 0.25) * bl * 0.35 * gap;
  }
  // pass-through: a soft light sweep travels far→near behind the timbers (8→11.5s)
  {
    float u = sstep(PASS, TAIL, t);
    float lx = mix(0.80, 0.19, u);
    float ly = roofAt(lx) - ROOF_H - 0.075;
    float sw = exp(-sdist(uv, vec2(lx, ly), vec2(0.055, 0.085)) * 2.4) * 1.6;
    float on = sstep(PASS - 0.2, PASS + 0.4, t) * sstep(TAIL + 0.6, TAIL - 0.2, t);
    float gapS = interiorAt(uv) * (1.0 - posts);
    glow += vec3(0.95, 0.68, 0.30) * sw * on * (0.15 + 0.85 * gapS);
    glow += vec3(0.8, 0.5, 0.2) * sw * on * 0.30 * gapS;
  }
  // tail lamp: small red point at the near end, fades (11.5→15s)
  {
    vec2 tp2 = vec2(0.19, roofAt(0.19) - ROOF_H - 0.07);
    float tl = exp(-sdist(uv, tp2, vec2(0.011, 0.016)) * 4.5) * 1.6;
    glow += vec3(0.75, 0.10, 0.06) * tl * sstep(TAIL, TAIL + 0.4, t) * sstep(SETTLE, SETTLE - 2.2, t);
    glow += vec3(0.5, 0.05, 0.03) * tl * 0.4 * sstep(TAIL, TAIL + 0.4, t) * sstep(SETTLE, SETTLE - 2.2, t) * interiorAt(uv) * (1.0 - posts);
  }
  return glow;
}

// ---- snow: two drift layers + a one-off gust + roof accumulation ----
float flakeAt(vec2 uv, float t, float layer, float gust) {
  // closed-form fall: seeded column, per-flake phase, lateral drift, gust adds x
  float n = 0.0;
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    float speed = mix(0.028, 0.055, h1(fi * 3.7 + layer)) ;
    float x0 = h1(fi * 7.3 + layer * 2.0);
    float ph = h1(fi * 11.1 + layer);
    float x = fract(x0 + t * (0.010 + 0.014 * h1(fi * 5.9 + layer)) + gust * (0.06 + 0.05 * h1(fi)));
    float y = fract(1.0 - (ph + t * speed));
    vec2 fp = vec2(x, y);
    fp.x += 0.012 * sin(t * 0.8 + fi * 2.4); // sway
    float sz = mix(0.0022, 0.0045, h1(fi * 17.3 + layer));
    n += sstep(1.0, 0.55, sdist(uv, fp, vec2(sz, sz * 1.4)));
  }
  return n;
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  vec3 col = skyAt(uv, t);

  // mountain flank with snow-lit top edge
  float m = mtnAt(uv);
  vec3 mtn = vec3(0.020, 0.026, 0.045) * (0.8 + 0.4 * vn2(uv * vec2(90.0, 60.0)));
  float edge = 0.98 - 0.42 * uv.x + 0.10 * vn2(vec2(uv.x * 14.0, 0.0)) + 0.05 * sin(uv.x * 9.0 + 1.0);
  mtn += vec3(0.10, 0.13, 0.19) * sstep(0.012, 0.002, abs(uv.y - edge)); // snow-lit crest
  col = mix(col, mtn, m);

  // open snow slope in front of the shed
  float sl = slopeAt(uv);
  vec3 sno = vec3(0.11, 0.14, 0.19) * (0.85 + 0.3 * vn2(uv * vec2(60.0, 140.0)));
  sno += vec3(0.05, 0.06, 0.07) * sstep(0.4, 0.9, uv.x); // faint summit light
  col = mix(col, sno, sl);

  // ---- the shed ----
  float posts = postsAt(uv);
  float interior = interiorAt(uv);
  // dark interior behind the timbers
  col = mix(col, vec3(0.008, 0.009, 0.014), interior * 0.92);
  // hanging lamp at the far end — warm point always on
  {
    vec2 lp = vec2(0.80, roofAt(0.80) - ROOF_H - 0.05);
    float flick = 0.9 + 0.1 * sin(t * 7.0) * sin(t * 3.1);
    col += vec3(1.0, 0.62, 0.22) * exp(-sdist(uv, lp, vec2(0.016, 0.026)) * 3.0) * 1.6 * flick;
    col += vec3(0.6, 0.35, 0.12) * exp(-sdist(uv, lp, vec2(0.035, 0.05)) * 5.0) * 0.4 * flick;
  }
  // timber frame over the interior dark
  vec3 wood = vec3(0.075, 0.058, 0.042) * (0.85 + 0.3 * vn2(uv * vec2(300.0, 80.0)));
  col = mix(col, wood, posts);
  // roof band with snow accumulation growing slightly
  float rf = roofAtM(uv, t);
  vec3 roofC = vec3(0.045, 0.038, 0.030) * (0.85 + 0.3 * vn2(uv * vec2(200.0, 90.0)));
  float acc = 0.5 + 0.5 * sstep(0.0, 15.0, t); // accumulation line thickens
  float rt = roofAt(uv.x);
  float snowline = sstep(rt - 0.002 - 0.006 * acc, rt - 0.002, uv.y) * sstep(rt - ROOF_H * 0.55, rt - 0.004, uv.y);
  roofC = mix(roofC, vec3(0.30, 0.33, 0.38), snowline * inShedX(uv));
  col = mix(col, roofC, rf);

  // ---- the unseen train's lights ----
  col += trainAt(uv, t, posts);

  // ---- icicle drip bead under a roof rafter ----
  {
    vec2 ic = vec2(0.42, roofAt(0.42) - ROOF_H - 0.004);
    float bead = sstep(1.0, 0.6, sdist(uv, ic + vec2(0.0, -0.004 - 0.006 * fract(t * 0.25)),
                                       vec2(0.0012, 0.002)));
    col = mix(col, vec3(0.55, 0.62, 0.70), bead * 0.8);
  }

  // ---- smoke puffs from a roof vent ----
  {
    vec2 vp = vec2(0.30, roofAt(0.30) + 0.012);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float ph = fract(t * 0.14 + fi * 0.37);
      vec2 pp = vp + vec2(0.012 * ph + 0.006 * sin(ph * 9.0 + fi), 0.05 * ph);
      float puff = exp(-sdist(uv, pp, vec2(0.010 + 0.02 * ph, 0.012 + 0.02 * ph)) * 4.0) * (1.0 - ph);
      col += vec3(0.14, 0.18, 0.26) * puff * 0.5;
    }
  }

  // ---- hare darting the open slope once ----
  if (t > HARE && t < HARE + 1.8) {
    float u = (t - HARE) / 1.8;
    float bound = abs(sin(u * 12.6));
    vec2 hp = vec2(mix(0.10, 0.38, u), 0.42 + 0.05 * u + 0.02 * bound);
    float hare = sstep(1.0, 0.6, sdist(uv, hp, vec2(0.011 / ASPECT, 0.009)));
    hare = max(hare, sstep(1.0, 0.6, sdist(uv, hp + vec2(0.008, 0.008), vec2(0.003 / ASPECT, 0.005))));
    col = mix(col, vec3(0.02, 0.02, 0.03), hare * sstep(HARE, HARE + 0.2, t) * sstep(HARE + 1.8, HARE + 1.5, t));
  }

  // ---- raven: one arc landing on a shed post ----
  if (t > RAVEN - 1.2 && t < RAVEN + 2.6) {
    float u = clamp((t - (RAVEN - 1.2)) / 1.2, 0.0, 1.0);
    float px = eaveAt(0.58); // lands on a mid-shed post
    vec2 perch = vec2(0.58, px + 0.10 + 0.05 * 0.58);
    vec2 rp = u < 1.0
      ? mix(vec2(0.95, 0.85), perch, u * u * (3.0 - 2.0 * u))
      : perch;
    float flap = u < 1.0 ? abs(sin(t * 9.0)) * 0.010 : 0.0;
    float raven = sstep(1.0, 0.6, sdist(uv, rp + vec2(0.0, flap), vec2(0.011 / ASPECT, 0.009)));
    raven = max(raven, sstep(1.0, 0.6, sdist(uv, rp + vec2(-0.010, flap + 0.004), vec2(0.014 / ASPECT, 0.003))));
    raven = max(raven, sstep(1.0, 0.6, sdist(uv, rp + vec2(0.010, flap + 0.004), vec2(0.014 / ASPECT, 0.003))));
    col = mix(col, vec3(0.012, 0.012, 0.018), raven * sstep(RAVEN - 1.2, RAVEN - 0.9, t) * sstep(RAVEN + 2.6, RAVEN + 2.3, t));
  }

  // ---- snow fall: two layers + one gust ----
  float gust = sstep(GUST, GUST + 1.0, t) * sstep(GUST + 3.0, GUST + 2.0, t);
  float flakes = flakeAt(uv, t, 0.0, gust) * 0.7 + flakeAt(uv, t, 5.0, gust) * 0.5;
  col = mix(col, vec3(0.74, 0.80, 0.88), clamp(flakes, 0.0, 1.0) * (0.65 + 0.35 * gust));

  // vignette — keep the pass wide, not boxed
  col *= 1.0 - 0.24 * sdist(uv, vec2(0.5, 0.45), vec2(0.8, 0.9));
  fragColor = vec4(col, 1.0);
}
`;

const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.4, 'snow over the pass', [0.5, 0.24]],
  [4.6, 7.4, 'a lamp inside the timber', [0.5, 0.22]],
  [8.4, 11.0, 'the train that never shows', [0.5, 0.24]],
  [11.8, 14.2, 'red at the near end', [0.5, 0.26]],
  [15.2, 17.4, 'snow keeps falling', [0.5, 0.24]],
];

export default class SnowshedScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private u = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    const geo = new THREE.PlaneGeometry(PW, PH);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(geo, mat);
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      approach: t >= 4.0 && t <= 8.0 ? 1 : 0,
      sweep: t >= 8.0 && t <= 11.5 ? 1 : 0,
      settle: t >= 15.0 && t <= 17.8 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low, near-static — a slight drift along the shed's diagonal
    // (far-left near → far-right), tiny push as the train light sweeps.
    const drift = ss(2.0, 15.0, t);
    this.rig.position = [
      2.4 * drift + 0.35 * Math.sin(t * 0.05),
      4.0 + 0.9 * ss(8.0, 13.0, t) + 0.2 * Math.sin(t * 0.06 + 1.0),
      76.0 - 1.6 * ss(7.5, 11.0, t),
    ];
    this.rig.target = [
      4.5 * drift + 0.3 * Math.sin(t * 0.045),
      11.5 + 0.6 * ss(8.0, 13.0, t),
      PZ,
    ];
    this.rig.roll = 0.0012 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

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
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(10, 14, 20, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e8edf3';
        c.fillText(text, cx, cy);
        c.restore();
        if (typeof window !== 'undefined') {
          const P = (window as any).__motion || (window as any).__pdoom;
          if (P?.probe && P?.textProbes && P.recordText !== false) {
            P.textProbes.push({
              frameIdx: P.currentFrameIdx ?? 0, t, text,
              fontFamily: 'Archivo, sans-serif', fontPx: 46,
              fillStyle: '#e8edf3', globalAlpha: a, layerId: 'captions',
              bbox: [cx - tw / 2, cy - 30, cx + tw / 2, cy + 30], w: tw, h: 60,
              cx, cy, hPct: (46 / 1080) * 100, isStroke: false,
            });
          }
        }
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.4,
      bloomThreshold: 0.65,
      bloomRadius: 0.7,
      ca: 0.08,
      grain: 0.07,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
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

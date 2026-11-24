// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// dawnmist — mist rolling across a mountain lake at dawn with a lone rower.
// One backdrop shader paints the whole frame: layered hill silhouettes
// receding into a pink-gold sky, low mist banks drifting along the water,
// a mirror-calm surface with a widening sun-glint lane, reeds on the near
// edge. The rowing boat crosses on a closed-form path — oars dip on a
// stroke envelope and each dip spreads a v-ripple pair and a trailing wake.
// Ducks cross in a shallow vee during the mist-part beat; fish rises ring
// the calm water. Beats: grey mist -> first gold + glint -> boat crossing
// -> mist burns off to reveal the far shore. All motion is f(t); every
// random is a hash.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
import { F } from '../../engine/type';
import { GLSL_NOISE } from '../../engine/glsl/noise';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Backdrop plane: world y = PY + (uv.y - 0.5) * PH
const PW = 240, PH = 120, PY = 22, PZ = -60;

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.0, end: 4.5, s: "grey holds the lake" },
  { at: 6.5, end: 10.0, s: "first light on the water" },
  { at: 15.0, end: 19.0, s: "the mist gives it back" },
];

/* ------------- backdrop: sky, hills, water, mist, boat, birds ------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;  // establishing fade-in
uniform float uGold;   // dawn gold envelope — sun clears the hills
uniform float uBurn;   // mist burn-off envelope
uniform float uDriftI; // integral of mist-drift rate — monotonic advection

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float ssx(float a, float b, float x) { float u = clamp((x - a) / (b - a), 0.0, 1.0); return u * u * (3.0 - 2.0 * u); }
float pow2(float x) { return x * x; }

const float HORIZON = 0.52;

// sun position: buried below the far ridge at dawn, clears it with uGold
vec2 sunPos(float t) {
  return vec2(0.60, HORIZON + 0.015 + 0.045 * uGold);
}

vec3 skyCol(vec2 uv, float t) {
  // pre-dawn grey-violet up high, warming to pink-gold at the horizon
  vec3 top = mix(vec3(0.235, 0.225, 0.30), vec3(0.30, 0.29, 0.38), uGold);
  vec3 hor = mix(vec3(0.46, 0.38, 0.42), vec3(0.98, 0.62, 0.32), uGold);
  vec3 c = mix(hor, top, smoothstep(HORIZON, 0.72, uv.y));
  // low warm band hugging the horizon once the sun is up
  c += vec3(0.55, 0.28, 0.10) * exp(-pow2(uv.y - HORIZON) / 0.0004) * uGold;
  return c;
}

// hill silhouette heights: three receding ridges above the horizon
float hillY(vec2 uv, int i) {
  float fi = float(i);
  return HORIZON + (0.028 + 0.018 * fi)
       + 0.030 * fbm3(vec3(uv.x * (4.5 + fi * 2.2), 4.0 + fi * 7.0, 0.0), 4)
       + 0.012 * sin(uv.x * (17.0 + fi * 6.0) + fi * 9.0);
}
vec3 hillCol(int i) {
  float fi = float(i);
  // farther ridges fade into the dawn haze
  return mix(vec3(0.085, 0.09, 0.13), vec3(0.34, 0.29, 0.35), fi / 3.0) * (0.85 + 0.20 * uGold);
}

// shared boat x-position — the crossing path every dependent element uses
float boatX(float tt) { return mix(0.72, 0.33, ssx(6.0, 15.0, tt)); }
const float BOAT_Y = 0.405;

vec3 waterCol(vec2 uv, float t) {
  // mirror: sample the sky at the mirrored height, dimmed
  float my = HORIZON + (HORIZON - uv.y) * 0.9;
  vec3 col = skyCol(vec2(uv.x, my), t) * 0.62;
  col = mix(col, vec3(0.10, 0.13, 0.17), 0.35); // slate water body
  // mirrored hills: darken the water band just below the far shore
  float farDark = (1.0 - smoothstep(0.0, 0.10, HORIZON - uv.y)) * 0.45;
  col *= 1.0 - farDark;
  // faint hill reflection streaks
  col *= 1.0 - 0.18 * max(fbm3(vec3(uv.x * 4.0, uv.y * 60.0, 1.0), 4), 0.0);

  // slow horizontal ripple bands crossing occasionally
  float rip = sin(uv.y * 260.0 + fbm3(vec3(uv.x * 6.0, t * 0.10, 2.0), 4) * 8.0 + t * 0.25);
  col += vec3(0.025) * rip * (0.4 + 0.6 * max(fbm3(vec3(uv.x * 3.0, uv.y * 20.0, 6.0), 4), 0.0))
         * (1.0 - smoothstep(0.0, 0.45, HORIZON - uv.y));

  // sun-glint lane: gold column under the sun, widening toward the camera
  vec2 sp = sunPos(t);
  float laneW = 0.012 + (HORIZON - uv.y) * 0.30;
  float lane = exp(-pow2(uv.x - sp.x) / (laneW * laneW));
  float shim = 0.55 + 0.45 * fbm3(vec3(uv.x * 30.0, uv.y * 90.0 + t * 0.6, 3.0), 4);
  float laneFade = (1.0 - smoothstep(0.0, 0.50, HORIZON - uv.y));
  col += vec3(1.0, 0.60, 0.22) * lane * shim * laneFade * uGold * 1.1;
  return col;
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // ---------- sky / hills ----------
  // shoreline isn't ruler-straight — jitter the branch boundary a hair
  float hz = HORIZON + 0.0035 * fbm3(vec3(uv.x * 34.0, 1.0, 0.0), 3);
  vec3 col;
  if (uv.y >= hz) {
    col = skyCol(uv, t);
    // moon remnant high left, dissolving as gold rises
    float moon = 1.0 - smoothstep(0.010, 0.016, length((uv - vec2(0.36, 0.60)) * vec2(2.0, 1.0)));
    col += vec3(0.55, 0.55, 0.60) * moon * (1.0 - uGold) * 0.5;
    // sun disc + halo once it clears the ridge
    vec2 sp = sunPos(t);
    vec2 dps = (uv - sp) * vec2(2.0, 1.0);
    float sd = length(dps);
    col += vec3(1.0, 0.72, 0.38) * (1.0 - smoothstep(0.006, 0.010, sd)) * uGold * 2.2;
    col += vec3(0.95, 0.55, 0.25) * exp(-pow2(sd) / 0.004) * uGold * 0.9;
    // three ridges, front drawn last so nearer land occludes farther
    for (int i = 2; i >= 0; i--) {
      float hy = hillY(uv, i);
      float m = 1.0 - smoothstep(hy - 0.0015, hy + 0.0015, uv.y);
      col = mix(col, hillCol(i), m);
    }
    // far-shore treeline: fine dark teeth just above the horizon
    float teeth = 0.003 + max(fbm3(vec3(uv.x * 60.0, 8.0, 0.0), 4), 0.0) * 0.019;
    float treeM = (1.0 - smoothstep(hz, hz + teeth, uv.y))
                * smoothstep(hz - 0.006, hz - 0.001, uv.y);
    col = mix(col, vec3(0.09, 0.10, 0.12), treeM * (0.6 + 0.4 * uBurn));
    // high cloud wisps catching first light
    float wisp = max(fbm3(vec3(uv.x * 4.0 + t * 0.01, uv.y * 26.0, 5.0), 4), 0.0);
    col += vec3(0.7, 0.45, 0.35) * wisp * smoothstep(HORIZON + 0.04, HORIZON + 0.12, uv.y) * uGold * 0.4;
  } else {
    // ---------- water ----------
    col = waterCol(uv, t);
  }
  col *= uAwake;

  // ---------- mist banks drifting along the surface ----------
  {
    // two banks at different heights/speeds; advected by the integrated
    // drift uniform so they never slide backwards if the rate dips
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float my = HORIZON - 0.055 + fi * 0.075;
      float band = exp(-pow2(uv.y - my) / (0.0022 - fi * 0.0008));
      float n = fbm3(vec3(uv.x * (2.2 + fi) - uDriftI * (0.5 + 0.3 * fi), 3.0 + fi * 11.0, 0.0), 4);
      float dens = band * smoothstep(0.10, 0.60, n * 0.5 + 0.5);
      vec3 mistC = mix(vec3(0.55, 0.54, 0.58), vec3(0.95, 0.78, 0.60), uGold);
      col = mix(col, mistC, dens * (1.0 - uBurn * 0.9) * 0.6 * uAwake);
    }
    // thin high veils over the hills, slower burn
    float veil = max(fbm3(vec3(uv.x * 1.8 - uDriftI * 0.25, uv.y * 12.0, 7.0), 4), 0.0) * 2.0;
    float vm = veil * smoothstep(HORIZON + 0.005, HORIZON + 0.03, uv.y) * (1.0 - smoothstep(HORIZON + 0.06, HORIZON + 0.10, uv.y));
    col = mix(col, vec3(0.58, 0.52, 0.53), clamp(vm, 0.0, 1.0) * (1.0 - uBurn) * 0.22 * uAwake);
  }

  // ---------- fish-rise rings on the calm water ----------
  {
    for (int k = 0; k < 2; k++) {
      float fk = float(k);
      float ft = 3.2 + fk * 13.5;            // two calm beats
      float rp = clamp((t - ft) / 2.2, 0.0, 1.0);
      if (rp <= 0.0 || rp >= 1.0) continue;
      vec2 c0 = vec2(0.45 + 0.18 * h1(fk * 9.1), 0.30 + 0.10 * h1(fk * 4.7));
      vec2 dp = (uv - c0) * vec2(2.0, 1.0);
      float rr = 0.004 + rp * 0.045;
      float ring = exp(-pow2(length(dp) - rr) / 0.00004) * (1.0 - rp);
      col += vec3(0.8, 0.75, 0.7) * ring * 0.5 * uAwake;
    }
  }

  // ---------- wake + v-ripples behind the boat ----------
  {
    float boatVis = ssx(6.0, 7.0, t) * (1.0 - ssx(15.0, 16.5, t));
    float bx = boatX(t);
    float behind = uv.x - bx;                 // boat travels -x, wake on +x
    if (behind > 0.0 && behind < 0.30 && abs(uv.y - BOAT_Y) < 0.06 && boatVis > 0.0) {
      float ang = 0.22;
      for (int sdd = 0; sdd < 2; sdd++) {
        float sgn = sdd == 0 ? 1.0 : -1.0;
        float ly = BOAT_Y - sgn * behind * ang * 0.28;
        float dy = (uv.y - ly) / (0.004 + behind * 0.03);
        float wl = exp(-dy * dy) * exp(-behind * 14.0);
        col += vec3(0.75, 0.72, 0.68) * wl * 0.32 * uAwake * boatVis;
      }
    }
    // oar-dip rings: each stroke spreads a small ellipse at the dip point;
    // rings keep expanding after their stroke but stop once the boat's gone.
    // Blade bottoms out at stroke min: (t-6.6)*2π/1.7 = 3π/2 → t = 7.875
    float t0 = 7.875;
    for (int k = 0; k < 6; k++) {
      float dipT = t0 + float(k) * 1.7;
      float age = t - dipT;
      if (age <= 0.0 || age > 2.6) continue;
      vec2 dip = vec2(boatX(dipT) - 0.014, BOAT_Y - 0.004); // blade tip is on -x
      vec2 dp = (uv - dip) * vec2(2.0, 1.0);
      float rr = age * 0.018;
      float ring = exp(-pow2(length(dp) - rr) / 0.00003) * (1.0 - age / 2.6);
      col += vec3(0.8, 0.78, 0.72) * ring * 0.6 * uAwake * boatVis;
    }
  }

  // ---------- the rowing boat silhouette ----------
  {
    float bx = boatX(t);
    vec2 b = (uv - vec2(bx, BOAT_Y)) * vec2(2.0, 1.0);
    // hull: shallow half-ellipse
    float hull = (1.0 - smoothstep(0.018, 0.022, abs(b.x)))
               * (1.0 - smoothstep(0.0, 0.005, abs(b.y + 0.004 + b.x * b.x * 0.55)));
    // prow/stern lift
    float gunwale = (1.0 - smoothstep(0.0015, 0.0035, abs(b.y - 0.002 + b.x * b.x * 0.8)))
                  * (1.0 - smoothstep(0.016, 0.021, abs(b.x)));
    // rower: body + head
    vec2 rb = b - vec2(0.002, 0.006);
    float rower = (1.0 - smoothstep(0.005, 0.008, abs(rb.x)))
                * (1.0 - smoothstep(0.0, 0.010, abs(rb.y - 0.006)));
    vec2 hd = b - vec2(0.002, 0.016);
    float head = 1.0 - smoothstep(0.003, 0.005, length(hd));
    // oars: stroke cycle — blade tips dip at the bottom of each stroke
    float stroke = sin((t - 6.6) * 6.28318 / 1.7);
    float oarAng = -0.25 + 0.20 * stroke;
    vec2 oc = vec2(0.002, 0.010);
    vec2 rel = b - oc;
    float oarLen = length(rel);
    float oar = 0.0;
    if (oarLen < 0.030 && oarLen > 0.003) {
      float a = atan(rel.y, rel.x);
      float want = 3.14159 - oarAng;
      float da = abs(mod(a - want + 3.14159, 6.28318) - 3.14159);
      oar = 1.0 - smoothstep(0.05, 0.16, da);
    }
    float boat = clamp(hull + gunwale + rower + head + oar * 0.8, 0.0, 1.0);
    float boatVis = ssx(6.0, 7.0, t) * (1.0 - ssx(15.0, 16.5, t));
    col = mix(col, vec3(0.06, 0.05, 0.06), boat * boatVis * 0.95);
    // mirrored blob under the hull
    vec2 mb = (uv - vec2(bx, BOAT_Y - 0.010)) * vec2(2.0, 3.5);
    float refl = exp(-dot(mb, mb) / 0.0004) * boatVis;
    col = mix(col, vec3(0.08, 0.07, 0.08), refl * 0.5);
  }

  // ---------- ducks crossing in a shallow vee ----------
  {
    float dp = ssx(14.5, 15.5, t) * (1.0 - ssx(17.5, 18.5, t));
    if (dp > 0.0) {
      float dd = (t - 14.5) / 4.0;
      for (int k = 0; k < 5; k++) {
        float fk = float(k);
        float side = (fk - 2.0);              // -2..2 vee offsets
        // arms trail the leader (+x, they travel -x) and split left/right in y
        float dx = mix(0.80, 0.28, dd) + abs(side) * 0.016;
        float dy = 0.335 - abs(side) * 0.002 + side * 0.007
                 + 0.0015 * sin(t * 6.0 + fk * 3.0);
        vec2 db = (uv - vec2(dx, dy)) * vec2(2.0, 1.0);
        float bod = 1.0 - smoothstep(0.004, 0.007, length(db * vec2(1.0, 2.2)));
        vec2 nk = db - vec2(0.005, 0.006);
        float neck = 1.0 - smoothstep(0.0018, 0.003, length(nk));
        float duck = clamp(bod + neck, 0.0, 1.0);
        col = mix(col, vec3(0.07, 0.06, 0.07), duck * dp * 0.9);
        // small wake vee trailing behind each duck (they travel -x, wake on +x)
        if (duck < 0.5) {
          float back = smoothstep(0.0, 0.004, uv.x - dx) * (1.0 - smoothstep(0.012, 0.035, uv.x - dx));
          float wk = exp(-pow2(uv.y - (dy - (uv.x - dx) * 0.22)) / 0.000012)
                   + exp(-pow2(uv.y - (dy + (uv.x - dx) * 0.22)) / 0.000012);
          col += vec3(0.7, 0.68, 0.64) * wk * back * dp * 0.20;
        }
      }
    }
  }

  // ---------- near-edge reeds ----------
  if (uv.y < 0.20) {
    for (int k = 0; k < 14; k++) {
      float fk = float(k);
      float edge = h1(fk * 3.3);              // <0.5 left cluster, else right
      float rx = edge < 0.5 ? 0.27 + 0.10 * h1(fk * 7.7)
                            : 0.66 + 0.12 * h1(fk * 7.7);
      float hgt = 0.05 + 0.09 * h1(fk * 11.3);
      float lean = 0.012 * (h1(fk * 5.9) - 0.5) + 0.006 * sin(t * 0.7 + fk);
      // reed line: x drifts with height (lean), silhouette dark
      float xr = rx + lean * (uv.y / hgt);
      float dxr = (uv.x - xr) / 0.0018;
      float reed = exp(-dxr * dxr) * (1.0 - smoothstep(hgt - 0.01, hgt, uv.y));
      col = mix(col, vec3(0.10, 0.11, 0.10), clamp(reed, 0.0, 1.0) * 0.85 * uAwake);
      // seed head at the tip
      vec2 sh = (uv - vec2(rx + lean, hgt)) * vec2(2.0, 1.0);
      float tip = 1.0 - smoothstep(0.0025, 0.005, length(sh));
      col = mix(col, vec3(0.09, 0.09, 0.08), tip * 0.9 * uAwake);
    }
  }

  fragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `out vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class DawnMistScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private backMat: THREE.ShaderMaterial;
  private layer = new Layer2D();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 400);
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    this.backMat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uAwake: { value: 0 },
        uGold: { value: 0 }, uBurn: { value: 0 }, uDriftI: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), this.backMat);
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    const end = this.ctx.end - this.ctx.start;

    // beats: grey mist -> first gold -> boat crossing -> burn-off
    const awake = ss(0, 2.5, t);
    const gold = ss(3.5, 7.0, t);
    const burn = ss(14.0, 19.0, t);
    // integrated mist-drift rate (rate rises through the gust of dawn wind
    // then eases) — monotone advection, closed form
    const driftI = t * 0.02 + ss(6.0, 9.0, t) * 0.35;

    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uAwake!.value = awake;
    this.backMat.uniforms.uGold!.value = gold;
    this.backMat.uniforms.uBurn!.value = burn;
    this.backMat.uniforms.uDriftI!.value = driftI;

    // slow lateral drift that follows the boat mid-scene, gentle push-in
    const push = ss(0, end, t);
    const boatP = ss(6.0, 9.0, t) * (1.0 - ss(14.0, 17.0, t));
    const boatXw = (0.72 - 0.39 * ss(6.0, 15.0, t)) * 60 - 30; // uv->world approx
    this.rig.position = [
      Math.sin(t * 0.04) * 0.6 + boatXw * 0.25 * boatP,
      3.5 - 1.2 * push,
      26.0 - 7.0 * push,
    ];
    // aim a few degrees above the horizon so the shoreline sits ~35-40%
    // from the top (plan: midpoint-ish); ease down during the boat beat
    this.rig.target = [boatXw * 0.35 * boatP, 16.0 - 5.0 * boatP + 1.0 * gold, -60];
    this.rig.roll = 0.002 * Math.sin(t * 0.09);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions
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
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(240,230,225,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 1.0,
      bloom: 0.6,
      bloomThreshold: 0.4,
      bloomRadius: 1.0,
      ca: 0.05,
      grain: 0.07,
      vignette: 0.5,
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
    });
  }
}

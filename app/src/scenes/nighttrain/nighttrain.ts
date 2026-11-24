// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// nighttrain — a steam train crossing a moonlit stone viaduct at night.
// One backdrop shader paints the whole frame: a hash-starred navy sky with
// a halo'd moon and moonlit cloud wisps, layered valley silhouettes and a
// river threading a silver moon lane below. The viaduct spans the frame —
// a deck band over a row of arched openings with cold rim light — and the
// train crosses it left→right on a closed-form path: loco silhouette with
// a curvature-swept headlight cone, seeded smoke puffs rising and trailing
// back, flickering carriage windows, a green→red block signal, a watchman's
// hut, startled birds from beneath an arch, and warm streaks on the river.
// Beats: empty viaduct -> headlight glow -> crossing -> tail lamp -> smoke.
// All motion is f(t); every random is a hash.
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
  { at: 1.0, end: 4.2, s: "the valley holds its breath" },
  { at: 6.2, end: 9.6, s: "a light comes down the line" },
  { at: 16.4, end: 19.6, s: "only smoke remembers" },
];

/* ------------- backdrop: sky, valley, river, viaduct, train ------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;  // establishing fade-in

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float ssx(float a, float b, float x) { float u = clamp((x - a) / (b - a), 0.0, 1.0); return u * u * (3.0 - 2.0 * u); }
float pow2(float x) { return x * x; }

const float TR = 0.50;   // rail height — the deck the train rides
const float DECK = 0.46; // top of the arch band / bottom of the deck

// crossing path — engine nose position; every train element derives from it
float trainX(float tt) { return mix(-0.14, 1.34, ssx(5.0, 16.5, tt)); }
float bobY(float tt) { return 0.0012 * sin(tt * 13.0); }

// soft box mask in aspect-corrected coords (x is doubled like elsewhere)
float boxm(vec2 uv, vec2 c, vec2 half_) {
  vec2 d = abs(vec2((uv.x - c.x) * 2.0, uv.y - c.y)) - half_;
  return 1.0 - smoothstep(-0.001, 0.001, max(d.x, d.y));
}

vec3 skyCol(vec2 uv, float t) {
  vec3 top = vec3(0.008, 0.014, 0.038);
  vec3 hor = vec3(0.030, 0.045, 0.085);
  vec3 c = mix(hor, top, smoothstep(0.30, 0.78, uv.y));
  // stars: hash-gridded cells, bright twinkling few
  vec2 cell = floor(uv * vec2(90.0, 55.0));
  vec2 fr = fract(uv * vec2(90.0, 55.0));
  float sh = h21(cell);
  if (sh > 0.90 && uv.y > 0.50) {
    vec2 sp = vec2(h21(cell + 17.0), h21(cell + 31.0));
    float d = length((fr - sp) * vec2(1.0, 1.6));
    float star = (1.0 - smoothstep(0.0, 0.10, d)) * (0.3 + 0.7 * (sh - 0.90) * 10.0);
    star *= 0.6 + 0.4 * sin(t * 2.0 + sh * 40.0);
    c += vec3(0.75, 0.80, 0.92) * star * 0.5;
  }
  // moon high right + halo
  vec2 dm = (uv - vec2(0.70, 0.68)) * vec2(2.0, 1.0);
  float md = length(dm);
  c += vec3(0.82, 0.86, 0.95) * (1.0 - smoothstep(0.011, 0.016, md)) * 1.6;
  c += vec3(0.30, 0.36, 0.52) * exp(-pow2(md) / 0.004) * 0.4;
  // moonlit cloud wisps — brighter when near the moon's direction
  float wisp = max(fbm3(vec3(uv.x * 3.0 + t * 0.008, uv.y * 14.0, 4.0), 4), 0.0);
  float lit = exp(-pow2(md) / 0.05);
  float band = smoothstep(0.55, 0.66, uv.y) * (1.0 - smoothstep(0.74, 0.86, uv.y));
  c += vec3(0.10, 0.13, 0.19) * wisp * band * 0.5;
  c += vec3(0.30, 0.34, 0.45) * wisp * band * lit * 0.6;
  return c;
}

// far valley ridges behind the viaduct
float ridgeY(vec2 uv, int i) {
  float fi = float(i);
  return 0.335 + 0.022 * fi
       + 0.030 * fbm3(vec3(uv.x * (5.0 + fi * 2.5), 6.0 + fi * 8.0, 0.0), 4)
       + 0.010 * sin(uv.x * (13.0 + fi * 5.0) + fi * 7.0);
}
vec3 ridgeCol(int i) {
  float fi = float(i);
  return mix(vec3(0.020, 0.028, 0.046), vec3(0.055, 0.068, 0.095), fi / 2.0);
}

// river centerline winding through the valley floor
float riverY(vec2 uv) {
  return 0.315 + 0.030 * fbm3(vec3(uv.x * 3.2, 2.0, 0.0), 4);
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  float bx = trainX(t);
  float front = bx + 0.055;
  float trainLit = ssx(4.6, 6.0, t) * (1.0 - ssx(16.6, 17.8, t));

  vec3 col = skyCol(uv, t);

  // ---------- far valley ridges ----------
  for (int i = 2; i >= 0; i--) {
    float ry = ridgeY(uv, i);
    float m = 1.0 - smoothstep(ry - 0.0015, ry + 0.0015, uv.y);
    col = mix(col, ridgeCol(i), m);
  }
  // dark valley floor
  if (uv.y < 0.335) col = mix(col, vec3(0.014, 0.020, 0.032), 0.9);

  // ---------- river thread with the moon lane ----------
  {
    float ry = riverY(uv);
    float w = 0.045 + 0.03 * max(fbm3(vec3(uv.x * 5.0, 9.0, 0.0), 4), 0.0);
    float inr = 1.0 - smoothstep(w, w + 0.02, abs(uv.y - ry));
    if (inr > 0.0 && uv.y < 0.36) {
      vec3 wc = vec3(0.032, 0.045, 0.075);
      // moon lane: silver column under the moon, shimmering
      float shim = 0.5 + 0.5 * fbm3(vec3(uv.x * 40.0, uv.y * 120.0 + t * 0.5, 2.0), 4);
      wc += vec3(0.55, 0.62, 0.78) * exp(-pow2(uv.x - 0.70) / 0.004) * shim * 0.9;
      // headlight + window glow streaking under the train
      float warm = exp(-pow2(uv.x - front) / 0.012) * shim;
      wc += vec3(0.9, 0.55, 0.22) * warm * trainLit * 0.8;
      wc += vec3(0.7, 0.42, 0.16) * exp(-pow2(uv.x - bx) / 0.02) * shim * trainLit * 0.4;
      col = mix(col, wc, inr);
    }
  }

  // ---------- stone viaduct ----------
  if (uv.y < TR + 0.012) {
    // arch cell: 0.10 uv period, opening = shaft + semicircle crown
    float ac = fract(uv.x * 10.0);
    float acx = (ac - 0.5) * 0.10;          // uv.x units
    vec2 q = vec2(acx * 2.0, uv.y - 0.30);  // aspect-corrected
    float hole = 0.0;
    if (uv.y > 0.26 && uv.y < DECK) {
      float shaft = step(abs(q.x), 0.050) * step(q.y, 0.115);
      float crown = step(length(q - vec2(0.0, 0.115)), 0.050);
      hole = max(shaft, crown);
    }
    if (hole < 0.5) {
      // stone band: deck 0.46–0.51, piers descending to the valley floor
      if (uv.y > 0.245 && uv.y < TR + 0.012) {
        vec3 stone = vec3(0.032, 0.038, 0.055);
        // masonry seams
        float seam = max(fbm3(vec3(uv.x * 90.0, uv.y * 160.0, 3.0), 4), 0.0);
        stone *= 0.80 + 0.4 * seam;
        // cold moonlit rim along the deck top
        float rim = 1.0 - smoothstep(0.0, 0.006, abs(uv.y - TR + 0.002));
        stone += vec3(0.42, 0.48, 0.60) * rim * 0.5;
        // arch lips catch a whisper of the same light
        float lip = 1.0 - smoothstep(0.0, 0.004, abs(length(q - vec2(0.0, 0.115)) - 0.052));
        stone += vec3(0.30, 0.35, 0.45) * lip * step(uv.y, DECK) * 0.4;
        col = mix(col, stone, smoothstep(0.245, 0.255, uv.y));
      }
    } else {
      col *= 0.55; // shadowed view through the arch
    }
  }

  // ---------- watchman's hut on the deck approach (left) ----------
  {
    float hut = boxm(uv, vec2(0.14, 0.515), vec2(0.022, 0.013));
    vec2 rq = vec2((uv.x - 0.14) * 2.0, uv.y - 0.528);
    float roof = (1.0 - smoothstep(0.0, 0.002, rq.y - (0.016 - abs(rq.x) * 0.9)))
               * (1.0 - smoothstep(0.0, 0.002, -(rq.y - (0.010 - abs(rq.x) * 0.0))))
               * step(abs(rq.x), 0.016);
    col = mix(col, vec3(0.05, 0.055, 0.075), clamp(hut + roof, 0.0, 1.0) * 0.9);
    // one warm window
    float win = boxm(uv, vec2(0.135, 0.512), vec2(0.007, 0.007));
    float flick = 0.75 + 0.25 * sin(t * 3.0);
    col = mix(col, vec3(0.95, 0.65, 0.28) * flick, win * 0.85);
    col += vec3(0.5, 0.3, 0.1) * exp(-pow2(length((uv - vec2(0.135, 0.512)) * vec2(2.0, 1.0))) / 0.0004) * 0.25;
  }

  // ---------- block-post signal lamp (right) ----------
  {
    float post = boxm(uv, vec2(0.80, 0.522), vec2(0.004, 0.026));
    col = mix(col, vec3(0.04, 0.045, 0.06), post * 0.9);
    // green until the engine nose passes, then red
    float red = step(0.80, front);
    vec3 lampC = mix(vec3(0.15, 0.85, 0.30), vec3(0.95, 0.12, 0.08), red);
    // a blink at the moment of switching
    lampC *= 1.0 - 0.5 * exp(-pow2(front - 0.80) / 0.0006) * (0.5 + 0.5 * sin(t * 25.0));
    vec2 dl = (uv - vec2(0.80, 0.548)) * vec2(2.0, 1.0);
    float lamp = 1.0 - smoothstep(0.004, 0.006, length(dl));
    col = mix(col, lampC, lamp);
    col += lampC * exp(-pow2(length(dl)) / 0.00010) * 0.35;
  }

  // ---------- startled birds from beneath an arch (once) ----------
  {
    float pb = clamp((t - 9.3) / 2.2, 0.0, 1.0);
    if (pb > 0.0 && pb < 1.0) {
      for (int k = 0; k < 7; k++) {
        float fk = float(k);
        float dir = h1(fk * 3.7) < 0.5 ? -1.0 : 1.0;
        vec2 bp = vec2(0.55 + dir * pb * (0.04 + 0.10 * h1(fk * 7.3)),
                       0.44 + pb * (0.05 + 0.10 * h1(fk * 11.1)) + 0.004 * sin(fk * 9.0));
        vec2 dp = (uv - bp) * vec2(2.0, 1.0);
        // flapping v-shape: |x| wings at a flapping slope
        float wing = 0.4 + 0.5 * sin(t * 11.0 + fk * 2.6);
        float v = abs(dp.y - abs(dp.x) * wing);
        float bird = (1.0 - smoothstep(0.0012, 0.0025, v))
                   * (1.0 - smoothstep(0.003, 0.007, abs(dp.x)));
        col = mix(col, vec3(0.03, 0.03, 0.04), bird * 0.9 * (1.0 - pb * 0.5));
      }
    }
  }

  // ---------- smoke puffs above the stack ----------
  {
    for (int k = 0; k < 12; k++) {
      float fk = float(k);
      float se = 5.4 + fk * 0.85;               // emission time
      float age = t - se;
      if (age <= 0.0 || age > 7.0) continue;
      float sx = trainX(se) + 0.046;             // stack x at emission
      // rise, drift back over the train, thin out; lit warm early
      vec2 pp = vec2(sx - 0.010 * age + (h1(fk * 5.1) - 0.5) * 0.008 + 0.02 * max(age - 2.0, 0.0),
                     0.555 + 0.030 * age + 0.006 * sin(fk * 3.0 + age));
      float rad = 0.006 + 0.011 * age;
      vec2 dp = (uv - pp) * vec2(2.0, 1.0);
      float puff = exp(-pow2(length(dp)) / (rad * rad));
      float fade = (1.0 - age / 7.0) * smoothstep(0.0, 0.25, age);
      vec3 smokeC = mix(vec3(0.85, 0.55, 0.25), vec3(0.25, 0.27, 0.33), clamp(age * 0.8, 0.0, 1.0));
      col += smokeC * puff * fade * 0.30;
    }
  }

  // ---------- the train ----------
  {
    float vis = trainLit;
    float bob = bobY(t) * vis;
    // headlight cone ahead of the nose, sloping with track curvature
    float dist = uv.x - front;
    if (dist > 0.0 && dist < 0.30) {
      float slope = 0.05 + 0.05 * sin(bx * 4.0);
      float cy = 0.515 - dist * slope * 3.0;
      float w = 0.006 + dist * 0.10;
      float cone = exp(-pow2(uv.y - cy) / (w * w)) * exp(-dist * 6.5);
      float flick = 0.85 + 0.15 * sin(t * 31.0) * sin(t * 17.0);
      col += vec3(1.0, 0.72, 0.32) * cone * flick * vis * 0.4;
      // warm patch on the deck the cone lands on
      col += vec3(0.8, 0.5, 0.2) * cone * smoothstep(0.44, 0.49, uv.y)
           * (1.0 - smoothstep(0.49, 0.505, uv.y)) * vis * 0.35;
    }
    // headlight lamp dot + pre-entry glow at the left edge
    vec2 dh = (uv - vec2(front, 0.514)) * vec2(2.0, 1.0);
    col += vec3(1.0, 0.78, 0.40) * exp(-pow2(length(dh)) / 0.00005) * vis * 1.2;
    col += vec3(0.9, 0.55, 0.22) * exp(-pow2(uv.x - 0.035) / 0.002) * smoothstep(0.42, 0.55, uv.y)
         * ssx(3.8, 5.2, t) * (1.0 - ssx(6.0, 8.0, t)) * 0.6;

    // loco silhouette
    float loco = 0.0;
    loco = max(loco, boxm(uv, vec2(bx + 0.028, TR + 0.012 + bob), vec2(0.050, 0.013))); // boiler
    loco = max(loco, boxm(uv, vec2(bx + 0.009, TR + 0.022 + bob), vec2(0.013, 0.021))); // cab
    loco = max(loco, boxm(uv, vec2(bx + 0.045, TR + 0.025 + bob), vec2(0.006, 0.016))); // stack
    loco = max(loco, boxm(uv, vec2(bx + 0.045, TR + 0.033 + bob), vec2(0.009, 0.003))); // cap
    vec2 dd = (uv - vec2(bx + 0.032, TR + 0.022 + bob)) * vec2(2.0, 1.0);
    loco = max(loco, 1.0 - smoothstep(0.005, 0.007, length(dd)));                        // dome
    // cars
    float body = loco;
    for (int k = 1; k <= 3; k++) {
      float cx = bx - 0.030 - (float(k) - 1.0) * 0.048;
      body = max(body, boxm(uv, vec2(cx, TR + 0.015 + bob), vec2(0.037, 0.019)));
    }
    col = mix(col, vec3(0.045, 0.045, 0.065), clamp(body, 0.0, 1.0) * vis * 0.96);
    // warm flickering windows sit ON the bodies, not under them
    for (int k = 1; k <= 3; k++) {
      float fk = float(k);
      float cx = bx - 0.030 - (fk - 1.0) * 0.048;
      for (int j = 0; j < 4; j++) {
        float fj = float(j);
        float wx = cx - 0.013 + fj * 0.0095;
        float win = boxm(uv, vec2(wx, TR + 0.018 + bob), vec2(0.0055, 0.009));
        float fl = 0.6 + 0.4 * sin(t * 7.0 + h1(fk * 13.0 + fj) * 6.3);
        col = mix(col, vec3(1.0, 0.70, 0.30) * fl, win * vis * 0.95);
      }
    }
    // tail lamp on the last car — visible as it exits, the receding beat
    vec2 dt2 = (uv - vec2(bx - 0.172, TR + 0.012 + bob)) * vec2(2.0, 1.0);
    float tail = exp(-pow2(length(dt2)) / 0.00004);
    col += vec3(0.9, 0.10, 0.08) * tail * vis * ssx(13.8, 14.6, t);
  }

  col *= uAwake;
  fragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `out vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class NightTrainScene extends Scene {
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

    const awake = ss(0, 2.5, t);
    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uAwake!.value = awake;

    // slow pan partially tracking the crossing, gentle push-in
    const push = ss(0, end, t);
    const pan = ss(4.5, 7.5, t) * (1 - ss(15.5, 18.5, t));
    const bxu = ss(5.0, 16.5, t);
    // backdrop is 240 world units wide: uv.x -> world x is *240-120
    const trainXw = (-0.14 + 1.48 * bxu) * 240 - 120;
    // clamp the track so the frustum never slides past the plane's edges
    // (world x beyond ±120 is off the backdrop)
    // visible half-width at the plane is ~65 world units — stay inside
    const trackX = Math.max(-48, Math.min(48, trainXw * 0.7)) * pan;
    this.rig.position = [
      Math.sin(t * 0.05) * 0.5 + trackX * 0.75,
      5.0 - 1.0 * push,
      24.0 - 4.0 * push,
    ];
    // aim just under the deck so the viaduct sits slightly above center and
    // the river + arches stay in the lower frame
    this.rig.target = [trackX, 19.0, -60];
    this.rig.roll = 0.002 * Math.sin(t * 0.08);
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
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(5,6,10,0.9)';
      g.lineWidth = 12; // knockout halo: 6px of ink outside each glyph
      g.strokeText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.fillStyle = 'rgba(235,235,240,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 1.0,
      bloom: 0.8,
      bloomThreshold: 0.35,
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

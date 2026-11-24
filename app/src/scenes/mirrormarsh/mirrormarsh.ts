// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// mirrormarsh — a mirror-still marsh at dawn. One fullscreen GLSL pass holds
// the shot: a peach→pale-blue dawn sky over dead-calm water, dense reed
// banks left and right, a faint sun halo through ground fog, a tiny beached
// rowboat far right, and a deep mist bank behind. Below the waterline the
// world is a flipped resample of itself — a perfect mirror whose only
// motion is a quiver masked to the drifting mist bands. One grey heron
// stands mid-frame (silhouette + reflection), dips its head once, and
// strikes a fish with a splash ring + beak drip; one distant fish-rise
// opens far left. A kingfisher darts in from the right, perches on a reed
// tip, dives and streaks out; a frog bubble cluster and two dragonfly
// crossings fill the quiet between. All closed-form f(t), hash seeds only.
// CameraRig is near-static with a tiny vertical drift keeping the mirror
// centered; Layer2D holds the anchored captions.
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

// uv-space scene: y < HLINE is the mirror (flipped resample of the world
// above, tinted + quivered where mist moves); y >= HLINE holds the sky,
// mist bank, reed banks, rowboat and the heron. The strike lands ~8.2s,
// the kingfisher visits 12.8→14.3s, dragonflies cross ~5s and ~16.5s.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;
const float HLINE = 0.50;
const float ASPECT = ${(16 / 9).toFixed(4)};
const float STRIKE = 8.2;
const float KF_IN = 12.8;
const float KF_OUT = 14.3;

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
// descending edges are fine here: evaluate on the ordered span and flip
// the result — smoothstep itself never sees e0 >= e1 (gap clamped too)
float sstep(float e0, float e1, float x) {
  float lo = min(e0, e1);
  float hi = max(e0, e1);
  float m = smoothstep(lo, lo + max(hi - lo, 0.001), x);
  return e0 < e1 ? m : 1.0 - m;
}
float sdist(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r;
  return length(q);
}

// a stalk: thin vertical silhouette, seeded lean + height
float reed(vec2 uv, float x0, float top, float lean, float wid) {
  float yn = clamp(uv.y / top, 0.0, 1.0);
  float x = x0 + lean * yn * yn;          // bend grows with height
  float d = abs(uv.x - x) - wid * (1.0 - 0.55 * yn);
  float cut = step(uv.y, top);
  return cut * sstep(0.0015, 0.0, d);
}

// the whole above-horizon world at uv — reused for the mirror below
vec3 world(vec2 uv, float t) {
  // -- sky: peach horizon -> pale blue zenith
  vec3 sky = mix(vec3(0.98, 0.62, 0.42), vec3(0.55, 0.70, 0.86),
                 sstep(HLINE, 1.0, uv.y));
  sky = mix(sky, vec3(1.0, 0.78, 0.55), 0.35 * exp(-abs(uv.y - HLINE) * 9.0));

  // -- sun halo through ground fog: warm smear just above the horizon
  float sunD = sdist(uv, vec2(0.56, 0.545), vec2(0.16 * ASPECT, 0.10));
  sky += vec3(1.0, 0.72, 0.45) * 0.55 * exp(-sunD * sunD * 2.2);
  sky += vec3(1.0, 0.85, 0.62) * 0.35 * exp(-sunD * sunD * 9.0);

  // -- deep mist bank behind the reeds: hazy band at the horizon, thicker
  // toward the edges, seeded ragged top
  float mistTop = HLINE + 0.075 + 0.05 * fbm2(vec2(uv.x * 9.0, 2.0));
  float mistBand = sstep(mistTop, HLINE + 0.02, uv.y) * sstep(HLINE - 0.02, HLINE + 0.01, uv.y);
  float thick = 0.55 + 0.45 * sstep(0.42, 0.0, min(uv.x, 1.0 - uv.x));
  sky = mix(sky, vec3(0.62, 0.60, 0.62), clamp(mistBand * thick * 0.85, 0.0, 1.0));

  // -- reed banks: seeded stalk clusters, left [0,0.30], right [0.74,1]
  vec3 reedCol = vec3(0.15, 0.145, 0.115);
  float reeds = 0.0;
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float s0 = h1(fi * 3.7 + 11.0);
    float x = 0.010 + 0.295 * s0;
    float top = 0.555 + 0.20 * h1(fi * 5.1 + 3.0);
    float lean = 0.05 * (h1(fi * 7.3 + 5.0) - 0.5);
    reeds = max(reeds, reed(uv, x, top, lean, 0.0018 + 0.0012 * h1(fi + 9.0)));
    float x2 = 0.745 + 0.245 * h1(fi * 4.3 + 17.0);
    float top2 = 0.555 + 0.21 * h1(fi * 6.7 + 23.0);
    float lean2 = 0.055 * (h1(fi * 8.9 + 7.0) - 0.5);
    reeds = max(reeds, reed(uv, x2, top2, lean2, 0.0018 + 0.0012 * h1(fi + 31.0)));
  }
  // seed heads: a few stalks carry a darker cattail tip
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float x = (i < 4 ? 0.05 + 0.20 * h1(fi + 41.0)
                     : 0.78 + 0.18 * h1(fi + 53.0));
    float top = 0.60 + 0.12 * h1(fi + 61.0);
    float lean = 0.03 * (h1(fi + 71.0) - 0.5);
    reeds = max(reeds, reed(uv, x, top, lean, 0.0016));
    // slim cattail head below the tip
    vec2 hc2 = vec2(x + lean, top - 0.028);
    reeds = max(reeds, sstep(1.0, 0.55, sdist(uv, hc2, vec2(0.004, 0.028))));
  }
  sky = mix(sky, reedCol, reeds * 0.9);

  // -- rowboat: tiny beached silhouette far right on the waterline
  vec2 bc = vec2(0.70, 0.503);
  float hull = sstep(0.034, 0.027, abs(uv.x - bc.x)) *
               sstep(0.512, 0.501, uv.y) * sstep(0.493, 0.497, uv.y);
  float rim = sstep(0.032, 0.026, abs(uv.x - bc.x)) *
              sstep(0.518, 0.510, uv.y) * sstep(0.507, 0.511, uv.y);
  sky = mix(sky, vec3(0.16, 0.14, 0.12), clamp(hull + rim, 0.0, 1.0) * 0.9);
  sky += vec3(0.9, 0.7, 0.5) * rim * 0.15; // faint warm rim on the gunnel

  // -- heron: body ellipse, a neck curve base→head, and a beak that
  //    pitches down-forward into the water on the strike
  vec2 hb = vec2(0.47, 0.552);
  float body = sstep(1.0, 0.82, sdist(uv, hb, vec2(0.052, 0.030)));
  // tail flick
  body = max(body, sstep(0.9, 0.55, sdist(uv, hb + vec2(-0.055, 0.012), vec2(0.030, 0.010))));
  float dip = sstep(STRIKE - 0.55, STRIKE - 0.05, t) * (1.0 - sstep(STRIKE + 0.15, STRIKE + 0.75, t));
  float peek = sstep(4.6, 5.1, t) * (1.0 - sstep(5.6, 6.1, t)); // first head dip
  // head position: rest high, strike plunges it down-forward to the water
  vec2 head = vec2(hb.x + 0.048 + 0.075 * dip - 0.008 * peek,
                   0.655 - 0.135 * dip - 0.012 * peek);
  // neck: distance to the base→head segment, bowed for the S curve
  vec2 A = vec2(hb.x + 0.030, 0.575);
  vec2 AB = head - A;
  float proj = clamp(dot(uv - A, AB) / max(dot(AB, AB), 1e-5), 0.0, 1.0);
  vec2 np = A + AB * proj + vec2(0.010 * sin(proj * 5.2) * (1.0 - 0.6 * dip), 0.0);
  // no y-gate: on the strike the neck sweeps below its base height, and the
  // overlap with the body is the same dark silhouette either way
  float neck = sstep(0.014, 0.008, length(uv - np));
  // breast wedge: keeps the neck visually fused to the body front
  neck = max(neck, sstep(1.0, 0.55, sdist(uv, vec2(0.508, 0.565), vec2(0.020, 0.016))));
  // head + beak: beak as a segment angled down-forward with the strike
  float hd = sstep(0.9, 0.5, sdist(uv, head, vec2(0.013, 0.010)));
  vec2 bdir = normalize(vec2(0.30 + 0.15 * dip, -0.03 - 0.30 * dip));
  float bseg = clamp(dot(uv - head, bdir), 0.0, 0.058);
  float beak = sstep(0.0036, 0.0020, length(uv - (head + bdir * bseg)));
  float heron = clamp(body + neck + hd + beak, 0.0, 1.0);
  // standing legs into the waterline
  float legs = sstep(0.0035, 0.0015, abs(uv.x - (hb.x + 0.008))) * step(HLINE - 0.015, uv.y) * step(uv.y, 0.535) +
               sstep(0.0035, 0.0015, abs(uv.x - (hb.x + 0.026))) * step(HLINE - 0.012, uv.y) * step(uv.y, 0.535);
  sky = mix(sky, vec3(0.19, 0.20, 0.22), clamp(heron + legs, 0.0, 1.0) * 0.95);

  // -- kingfisher: bright speck on a reed tip while perched
  float perch = sstep(KF_IN, KF_IN + 0.15, t) * (1.0 - sstep(KF_OUT - 0.05, KF_OUT, t));
  if (perch > 0.0) {
    vec2 kc = vec2(0.805, 0.636);
    float kd = sdist(uv, kc, vec2(0.010, 0.008));
    sky = mix(sky, vec3(0.05, 0.42, 0.55), perch * sstep(1.0, 0.55, kd));
    sky = mix(sky, vec3(0.95, 0.42, 0.10), perch * sstep(0.7, 0.3, sdist(uv, kc + vec2(0.002, -0.004), vec2(0.007, 0.004))));
  }
  // dart streaks in/out: thin bright line sliding across the frame
  float dartIn = sstep(KF_IN - 0.5, KF_IN - 0.1, t) * (1.0 - sstep(KF_IN - 0.1, KF_IN, t));
  float dartOut = sstep(KF_OUT, KF_OUT + 0.15, t) * (1.0 - sstep(KF_OUT + 0.4, KF_OUT + 0.75, t));
  if (dartIn > 0.0) {
    float px = mix(1.05, 0.805, sstep(KF_IN - 0.5, KF_IN - 0.1, t));
    sky += vec3(0.2, 0.6, 0.7) * dartIn * 0.9 * sstep(0.0035, 0.0, abs(uv.y - 0.638)) *
           sstep(px + 0.02, px - 0.001, uv.x) * sstep(px - 0.10, px - 0.01, uv.x);
  }
  if (dartOut > 0.0) {
    // dive first: drop from the perch to water level in the first third
    // of the exit, then level into the horizontal streak
    float q = sstep(KF_OUT, KF_OUT + 0.75, t);
    float px = 0.805 - 0.855 * q;
    float py = 0.636 - 0.086 * min(q / 0.35, 1.0);
    sky += vec3(0.2, 0.6, 0.7) * dartOut * 0.9 * sstep(0.0035, 0.0, abs(uv.y - py)) *
           sstep(px - 0.02, px + 0.001, uv.x) * sstep(px + 0.10, px + 0.01, uv.x);
  }

  // -- two dragonflies: low crossings above the water
  for (int i = 0; i < 2; i++) {
    float t0 = i == 0 ? 4.5 : 16.2;
    float dur = 2.6;
    float dir = i == 0 ? 1.0 : -1.0;
    float ph = sstep(t0, t0 + dur, t);
    if (ph > 0.0 && ph < 1.0) {
      float fx = dir > 0.0 ? mix(-0.03, 0.62, ph) : mix(0.70, 0.05, ph);
      float fy = 0.575 + 0.022 * sin(ph * 9.0 + float(i) * 2.0);
      float fd = sdist(uv, vec2(fx, fy), vec2(0.007, 0.0022));
      sky = mix(sky, vec3(0.10, 0.12, 0.12), sstep(1.0, 0.45, fd) * 0.9);
      // wing shimmer: faint strobing halo
      sky += vec3(0.8, 0.85, 0.9) * 0.18 * sstep(1.4, 0.6, fd) *
             (0.5 + 0.5 * sin(t * 90.0 + float(i) * 3.0));
    }
  }

  return sky;
}

// an expanding ring: born at (cx, HLINE) at t0, fades over ~1.4s
float ring(vec2 uv, float cx, float t0, float t, float rate) {
  float dt = t - t0;
  if (dt < 0.0 || dt > 1.8) return 0.0;
  float r = dt * rate;
  float d = abs(uv.y - HLINE) / 0.35 + abs(uv.x - cx); // squashed ring
  float w = sstep(0.012 + dt * 0.01, 0.0, abs(d - r));
  return w * exp(-dt * 2.4);
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  if (uv.y >= HLINE) {
    fragColor = vec4(world(uv, t), 1.0);
  } else {
    // mirror: flip the world, quiver only inside the moving mist bands
    float band1 = 0.5 + 0.5 * sin((uv.x + t * 0.014) * 21.0 + fbm2(vec2(uv.x * 6.0, t * 0.06)) * 4.0);
    float band2 = 0.5 + 0.5 * sin((uv.x - t * 0.009) * 34.0 + 2.0);
    // quiver only where the visible mist band is thick, and die away as
    // the settle beat closes the mirror back to glass
    float mistAmt = fbm2(vec2(uv.x * 3.0 - t * 0.030, uv.y * 14.0));
    float move = band1 * band2 * (0.25 + 0.75 * mistAmt)
               * (1.0 - sstep(15.5, 18.5, t));
    vec2 ruv = vec2(uv.x + move * 0.0035 * sin(t * 2.1 + uv.y * 90.0),
                    2.0 * HLINE - uv.y);
    vec3 col = world(ruv, t);
    // water tint: cool the reflection, deepen with depth below the line
    float depth = clamp((HLINE - uv.y) / 0.5, 0.0, 1.0);
    col *= mix(vec3(0.96, 0.93, 0.95), vec3(0.42, 0.52, 0.62), depth * 0.8);

    // ripple rings: strike splash, beak drip, distant fish-rise, frog
    float rip = ring(uv, 0.62, STRIKE + 0.05, t, 0.115) +
                ring(uv, 0.625, STRIKE + 1.7, t, 0.045) * 0.7 +
                ring(uv, 0.20, 4.5, t, 0.060) * 0.6;
    // frog bubble cluster near x≈0.33, ~t 10.2→11.4
    float frog = sstep(10.2, 10.7, t) * (1.0 - sstep(11.0, 11.6, t));
    if (frog > 0.0) {
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        vec2 bp = vec2(0.315 + 0.03 * h1(fi + 3.0),
                       HLINE - 0.004 - 0.012 * h1(fi + 13.0));
        float bd = sdist(uv, bp, vec2(0.0045, 0.0022));
        float pop = 0.5 + 0.5 * sin(t * 7.0 + fi * 2.7);
        rip += frog * pop * sstep(1.0, 0.4, bd) * 0.55;
      }
    }
    col += vec3(0.9, 0.85, 0.8) * rip * 0.55;

    // low drifting mist bands over the water surface (peeling L→R)
    float m1 = fbm2(vec2(uv.x * 3.0 - t * 0.030, uv.y * 14.0));
    float m2 = fbm2(vec2(uv.x * 5.0 - t * 0.017 + 9.0, uv.y * 20.0));
    float veil = sstep(0.46, 0.02, abs(uv.y - (HLINE - 0.06))) * (m1 * 0.5 + m2 * 0.4);
    veil += sstep(0.05, 0.005, abs(uv.y - HLINE)) * 0.25; // dense at the line
    col = mix(col, vec3(0.78, 0.77, 0.78), clamp(veil * 0.65, 0.0, 1.0));

    fragColor = vec4(col, 1.0);
  }
}
`;

// backdrop plane: PW×PH world units centered at (0, PY, PZ); uv2w maps
// scene uv → plane-local XY for caption anchoring.
const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.9, 3.6, 'a marsh holding its breath', [0.5, 0.30]],
  [4.2, 7.0, 'mist begins to peel across the water', [0.5, 0.24]],
  [7.9, 10.4, 'one strike — then stillness again', [0.5, 0.30]],
  [12.4, 15.0, 'a kingfisher comes and goes', [0.5, 0.24]],
  [15.8, 18.6, 'the mirror returns to itself', [0.5, 0.30]],
];

export default class MirrormarshScene extends Scene {
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

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: near-static low shot; a tiny vertical drift on the
    // reflection line keeps the mirror centered through the take.
    this.rig.position = [
      0.30 * Math.sin(t * 0.04),
      5.5 + 0.5 * Math.sin(t * 0.05 + 1.0),
      76.0,
    ];
    this.rig.target = [0, 9.0 + 0.35 * Math.sin(t * 0.05 + 1.0), PZ];
    this.rig.roll = 0.002 * Math.sin(t * 0.06);
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
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(8, 10, 14, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f2e8dc';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.72,
      bloom: 0.30,
      bloomThreshold: 0.72,
      bloomRadius: 0.75,
      ca: 0.08,
      grain: 0.05,
      vignette: 0.42,
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

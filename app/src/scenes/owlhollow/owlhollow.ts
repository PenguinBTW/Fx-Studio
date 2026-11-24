// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// owlhollow — a barn owl gliding through a moonlit hollow at night. One
// fullscreen GLSL pass holds the shot: deep indigo sky with a large
// off-center moon halo and faint stars, a dark barn roof + chimney
// silhouette left, a hedgerow line, and a field floor crossed by two
// mist layers drifting at different speeds. The owl flies a closed-form
// transit — in from the right, one banked turn over the mist (belly flash
// catching the moon), a dip that hides it behind the barn roof, then a
// climb that exits top-left. A fence post mid-frame carries a spider-web
// glint when the moon beat crosses it; a swallow streaks once, a mouse
// tail-tip vanishes into the grass. All closed-form f(t), hash seeds only.
// CameraRig is near-static with a slight drift tracking the owl's arc and
// a tiny push on the glint beat; Layer2D holds the anchored captions.
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

const float HLINE = 0.40;   // field horizon
const float ASPECT = 320.0 / 140.0;
const float SA = 1920.0 / 1080.0; // uv→pixel aspect for round shapes
// owl transit beats
const float OWL_IN = 2.5;    // enters right
const float OWL_BANK = 6.8;  // banked turn over the mist
const float OWL_DIP = 8.6;   // dips behind the barn roof
const float OWL_CLIMB = 10.0;
const float OWL_OUT = 12.5;  // exits top-left
const float WEBGLINT = 13.4; // moon crosses the fence-post web
const float SWALLOW = 14.6;
const float MOUSE = 16.2;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x),
             mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
// descending edges: evaluate on the ordered span and flip — smoothstep
// itself never sees e0 >= e1 (gap clamped too)
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
// distance to segment — used for wing strokes and the web strands
float dseg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float k = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * k);
}

// owl position along the transit — piecewise waypoints, each blend a
// smoothstep so velocity eases through the turns
vec2 owlPos(float t) {
  vec2 p = vec2(1.14, 0.56);
  // long glide in from the right, easing toward the bank point
  p = mix(p, vec2(0.55, 0.50), sstep(OWL_IN, OWL_BANK, t));
  // dipped pass behind the barn
  p = mix(p, vec2(0.20, 0.415), sstep(OWL_BANK, OWL_DIP, t));
  // reappear climbing toward the top-left exit
  p = mix(p, vec2(-0.08, 0.86), sstep(OWL_DIP + 0.6, OWL_OUT, t));
  return p;
}
// bank tilt: rolls into the turn at OWL_BANK, levels on the climb
float owlTilt(float t) {
  return -0.55 * sstep(OWL_BANK - 1.2, OWL_BANK, t)
       +  0.30 * sstep(OWL_DIP + 0.3, OWL_CLIMB + 0.6, t);
}
// flap: slow beats on entry, locked glide through the bank, powering
// beats on the climb-out
float owlFlap(float t) {
  float glide = sstep(OWL_BANK - 1.0, OWL_BANK, t) * (1.0 - sstep(OWL_DIP + 0.4, OWL_CLIMB + 0.5, t));
  float rate = mix(2.4, 3.4, sstep(OWL_DIP, OWL_CLIMB, t));
  return sin(t * rate * 6.2831) * (1.0 - glide * 0.85);
}
float owlAlpha(float t) {
  return sstep(OWL_IN, OWL_IN + 0.6, t) * (1.0 - sstep(OWL_OUT - 0.6, OWL_OUT, t));
}

vec3 skyAt(vec2 uv, float t) {
  // -- night sky: indigo zenith to a slightly lifted horizon band
  vec3 sky = mix(vec3(0.020, 0.028, 0.075), vec3(0.075, 0.10, 0.17),
                 sstep(0.95, HLINE, uv.y));

  // -- stars: sparse seeded points in the upper band, faint twinkle
  if (uv.y > 0.55) {
    vec2 cell = floor(uv * vec2(90.0, 45.0));
    float sh = h2(cell);
    if (sh > 0.90) {
      vec2 sp = fract(uv * vec2(90.0, 45.0)) - 0.5;
      float d = length(sp);
      float tw = 0.6 + 0.4 * sin(t * (0.8 + h2(cell + 9.0) * 2.4) + sh * 6.28);
      sky += vec3(0.75, 0.80, 0.95) * sstep(0.06, 0.0, d) * 0.35 * tw
             * sstep(0.55, 0.62, uv.y);
    }
  }

  // -- moon: disc + layered halo, off-center right-high
  vec2 mc = vec2(0.63, 0.75);
  float md = sdist(uv, mc, vec2(0.024 / SA, 0.024));
  float hd = sdist(uv, mc, vec2(0.11 / SA, 0.085));
  float halo = exp(-hd * hd * 2.4);
  sky += vec3(0.55, 0.62, 0.80) * halo * 0.5;
  sky = mix(sky, vec3(0.88, 0.90, 0.96), sstep(1.0, 0.85, md));
  // faint maria so the disc isn't a flat coin
  float maria = fbm2((uv - mc) * vec2(SA, 1.0) * 60.0);
  sky -= vec3(0.10, 0.11, 0.13) * sstep(1.0, 0.85, md) * sstep(0.55, 0.75, maria);

  // -- hedgerow: ragged dark band at the horizon
  float hedgeTop = HLINE + 0.035 + 0.018 * fbm2(vec2(uv.x * 26.0, 3.0));
  float hedge = sstep(hedgeTop, hedgeTop - 0.02, uv.y) * sstep(HLINE - 0.01, HLINE + 0.01, uv.y);
  sky = mix(sky, vec3(0.016, 0.020, 0.030), hedge * 0.9);

  return sky;
}

// the barn owl: pale body + heart-shaped face, broad wings with soft
// feather fingers; tilt banks the silhouette, flap sweeps the wingtips
float owlAt(vec2 uv, float t) {
  float a = owlAlpha(t);
  if (a <= 0.0) return 0.0;
  vec2 p = owlPos(t);
  vec2 q = (uv - p) * 1.35; // shrink — reads as distance
  // bank rotation (plain 2D — aspect distortion is negligible here)
  float tilt = owlTilt(t);
  float cs = cos(tilt), sn = sin(tilt);
  q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);

  float flap = owlFlap(t);
  // body + head: upright ellipse with a small cap — thick enough to
  // anchor the wings
  float body = sstep(1.0, 0.62, sdist(q, vec2(0.0), vec2(0.012, 0.034)));
  body = max(body, sstep(1.0, 0.55, sdist(q, vec2(0.003, 0.032), vec2(0.011, 0.013))));
  // wings: shoulder→tip strokes swept up in a shallow V, tips riding
  // the flap; the inner span is much broader so the wing root is wide
  vec2 wtipL = vec2(-0.062 - 0.014 * flap, 0.052 + 0.028 * flap);
  vec2 wtipR = vec2(0.072 + 0.014 * flap, 0.052 + 0.028 * flap);
  float wl = dseg(q, vec2(-0.009, 0.020), wtipL);
  float wr = dseg(q, vec2(0.011, 0.020), wtipR);
  float wing = sstep(0.014, 0.006, min(wl, wr));
  wl = dseg(q, vec2(-0.009, 0.020), mix(vec2(-0.009, 0.020), wtipL, 0.55));
  wr = dseg(q, vec2(0.011, 0.020), mix(vec2(0.011, 0.020), wtipR, 0.55));
  wing = max(wing, sstep(0.022, 0.009, min(wl, wr)));
  // feather fingers fanning off the tips
  float fl_ = min(
    dseg(q, wtipL, wtipL + vec2(-0.016 - 0.004 * flap, -0.004 + 0.008 * flap)),
    dseg(q, wtipR, wtipR + vec2(0.016 + 0.004 * flap, -0.004 + 0.008 * flap)));
  wing = max(wing, sstep(0.004, 0.0012, fl_));
  // tail fan below
  body = max(body, sstep(1.0, 0.55, sdist(q, vec2(-0.004, -0.038), vec2(0.011, 0.013))));
  return clamp(max(body, wing), 0.0, 1.0) * a;
}

vec3 scene(vec2 uv, float t) {
  vec3 col = skyAt(uv, t);

  // -- moon direction for side-light on silhouettes and the belly flash
  vec2 mc = vec2(0.63, 0.75);

  // -- owl transit (drawn before the barn so the roof occludes the dip)
  float ow = owlAt(uv, t);
  if (ow > 0.0) {
    // pale warm-grey plumage; belly flash when the banked underside
    // turns toward the moon at OWL_BANK
    vec2 p = owlPos(t);
    float flash = sstep(OWL_BANK - 1.1, OWL_BANK, t) *
                  (1.0 - sstep(OWL_BANK + 0.2, OWL_BANK + 1.4, t));
    vec3 plumage = mix(vec3(0.17, 0.16, 0.15), vec3(0.72, 0.64, 0.50), flash * 0.45);
    // moon-side rim whenever the owl is low against the sky
    plumage += vec3(0.35, 0.38, 0.5) * 0.35 * sstep(0.6, 1.0, uv.y);
    col = mix(col, plumage, ow * 0.92);
  }

  // -- swallow: one fast streak right→left late in the take
  float sw = sstep(SWALLOW, SWALLOW + 0.1, t) * (1.0 - sstep(SWALLOW + 0.5, SWALLOW + 0.7, t));
  if (sw > 0.0) {
    float sx = mix(1.08, -0.08, sstep(SWALLOW, SWALLOW + 0.65, t));
    float sy = 0.58 + 0.05 * sin(t * 9.0);
    col = mix(col, vec3(0.05, 0.05, 0.08),
              sstep(1.0, 0.4, sdist(uv, vec2(sx, sy), vec2(0.008 / SA, 0.004))) * sw * 0.8);
  }

  // -- barn: wall + gable roof + chimney, solid dark silhouette left
  float wall = sstep(0.285, 0.275, uv.x) * sstep(0.02, 0.03, uv.x) * sstep(HLINE - 0.01, HLINE, uv.y) * sstep(0.46, 0.44, uv.y);
  // gable: triangle peaking at x≈0.155
  float gx = 1.0 - abs(uv.x - 0.155) / 0.135;
  float roofY = 0.44 + 0.115 * clamp(gx, 0.0, 1.0);
  float gable = sstep(0.285, 0.275, uv.x) * sstep(0.02, 0.03, uv.x) *
                sstep(0.44, 0.445, uv.y) * sstep(roofY + 0.006, roofY - 0.006, uv.y);
  // chimney at x≈0.24 up to y≈0.60
  float chim = sstep(0.233, 0.238, uv.x) * sstep(0.254, 0.248, uv.x) *
               sstep(0.60, 0.595, uv.y) * sstep(HLINE - 0.01, HLINE, uv.y);
  // a faint moon rim on the chimney + roof edge
  float barn = clamp(wall + gable + chim, 0.0, 1.0);
  col = mix(col, vec3(0.012, 0.014, 0.022), barn * 0.96);
  float roofRim = sstep(roofY + 0.010, roofY, uv.y) * sstep(roofY - 0.004, roofY, uv.y) * gable;
  col += vec3(0.30, 0.34, 0.46) * roofRim * 0.30;

  // -- field floor: dark grass, a thin moonlit tips band, drifting mist
  if (uv.y < HLINE) {
    vec3 ground = mix(vec3(0.010, 0.014, 0.024), vec3(0.030, 0.036, 0.050),
                      sstep(HLINE, 0.18, uv.y));
    col = mix(col, ground, sstep(HLINE + 0.01, HLINE, uv.y));

    // grass tips catching moonlight in a thin band near the horizon
    float tips = fbm2(uv * vec2(140.0, 60.0)) *
                 sstep(0.335, 0.37, uv.y) * sstep(0.395, 0.375, uv.y);
    col += vec3(0.32, 0.36, 0.48) * tips * 0.35;

    // mist: two fbm sheets drifting at different speeds
    float m1 = fbm2(vec2(uv.x * 3.2 - t * 0.020, uv.y * 16.0));
    float m2 = fbm2(vec2(uv.x * 5.0 + t * 0.011 + 7.0, uv.y * 22.0 + 4.0));
    float mist = (0.5 + 0.5 * m1 + 0.35 * m2) *
                 sstep(0.42, 0.37, uv.y) * sstep(0.17, 0.22, uv.y);
    col = mix(col, vec3(0.10, 0.12, 0.19), clamp(mist * 0.55, 0.0, 1.0));

    // fence post: slim upright mid-frame with a web between post and sky
    float post = sstep(0.556, 0.554, uv.x) * sstep(0.562, 0.564, uv.x) *
                 sstep(0.375, 0.372, uv.y) * sstep(0.29, 0.295, uv.y);
    col = mix(col, vec3(0.014, 0.015, 0.022), post * 0.9);

    // spider web: radial strands off the post top, glinting when the
    // moon beat crosses — thin lines + a pulsing sparkle
    float glintT = sstep(WEBGLINT, WEBGLINT + 0.6, t) * (1.0 - sstep(WEBGLINT + 1.4, WEBGLINT + 2.2, t));
    if (glintT > 0.0) {
      vec2 wc = vec2(0.559, 0.376);
      vec2 wv = uv - wc;
      float web = 0.0;
      for (int i = 0; i < 5; i++) {
        float ang = -0.4 - float(i) * 0.55;
        vec2 tip = vec2(cos(ang), sin(ang)) * 0.045;
        web += sstep(0.0016, 0.0004, dseg(uv, wc, wc + vec2(tip.x / SA, tip.y)));
      }
      // one arc across the strands
      web += sstep(0.0016, 0.0004, abs(length(wv * vec2(SA, 1.0)) - 0.028) ) * sstep(wc.y + 0.004, wc.y, uv.y) * step(0.0, -wv.x);
      float sparkle = sstep(0.006, 0.001, sdist(uv, wc + vec2(-0.018, -0.020), vec2(0.006, 0.006)));
      col += vec3(0.75, 0.82, 1.0) * (web * 0.5 + sparkle * 0.9) * glintT;
    }

    // mouse tail-tip: a short wiggle at the grass line that vanishes
    float ms = sstep(MOUSE, MOUSE + 0.3, t) * (1.0 - sstep(MOUSE + 0.5, MOUSE + 0.9, t));
    if (ms > 0.0) {
      vec2 mt = vec2(0.44 + 0.010 * sin(t * 14.0), 0.295 + 0.006 * sin(t * 18.0));
      col = mix(col, vec3(0.10, 0.09, 0.08),
                sstep(1.0, 0.3, sdist(uv, mt, vec2(0.006 / SA, 0.004))) * ms * 0.7);
    }
  }

  return col;
}

void main() {
  fragColor = vec4(scene(vUv, uT), 1.0);
}
`;

// backdrop plane: PW×PH world units centered at (0, PY, PZ); uv2w maps
// shader uv to world space for caption anchoring.
const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.2, 'a still night over the hollow', [0.5, 0.30]],
  [3.4, 6.4, 'wings without a sound', [0.5, 0.24]],
  [7.0, 9.6, 'low over the mist, behind the barn', [0.5, 0.30]],
  [13.0, 15.4, 'the moon catches the web', [0.5, 0.24]],
  [16.0, 17.6, 'a fox barks far off', [0.5, 0.30]],
];

export default class OwlhollowScene extends Scene {
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
      owlTransit: t >= 2.5 && t <= 12.5 ? 1 : 0,
      bank: t >= 6.8 && t <= 8.6 ? 1 : 0,
      webGlint: t >= 13.4 && t <= 15.6 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: near-static; a slight lateral drift tracking the owl's
    // arc, and a tiny push as the moon glint beat lands.
    const owlX = -30 + 24 * ss(2.5, 12.5, t);
    const push = ss(13.0, 14.0, t) * (1 - ss(16.0, 17.0, t));
    this.rig.position = [
      owlX + 0.3 * Math.sin(t * 0.05),
      5.5 + 0.4 * Math.sin(t * 0.045 + 1.0),
      76.0 - 5.0 * push,
    ];
    this.rig.target = [
      owlX * 0.4,
      9.0 + 0.3 * Math.sin(t * 0.05 + 1.0),
      PZ,
    ];
    this.rig.roll = 0.002 * Math.sin(t * 0.06);
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
        c.strokeStyle = 'rgba(6, 8, 14, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e8ecf4';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.85,
      bloom: 0.35,
      bloomThreshold: 0.70,
      bloomRadius: 0.75,
      ca: 0.08,
      grain: 0.07,
      vignette: 0.50,
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

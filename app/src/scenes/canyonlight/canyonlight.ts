// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// canyonlight — a slot canyon at midday with god-ray shafts and falling sand.
// One backdrop shader paints the whole frame: a high sky slit with drifting
// dust haze, a towering strata-banded sandstone wall, a narrow floor littered
// with hashed rocks. 3-4 god-ray shafts slant down through the slit, each
// migrating across its own angle sweep and fading through its own window;
// hash-seeded dust motes drift inside the light. Thin sand rivulets trickle
// down the wall face on seeded paths with a bounce at ledges and piles
// accumulating at the base; a raven crosses the slit once. Beats: quiet
// shafts -> wind gust -> seeded rockfall + dust puff -> shafts re-emerge.
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
  { at: 1.0, end: 5.0, s: "sun finds the canyon floor" },
  { at: 8.5, end: 11.5, s: "wind remembers" },
  { at: 15.5, end: 19.0, s: "sand keeps falling" },
];

/* -------------------- backdrop: wall, slit, shafts, sand -------------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;   // establishing fade-in
uniform float uGust;    // wind gust envelope
uniform float uRock;    // rockfall beat envelope
uniform float uRe;      // shafts re-emerge

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float ssx(float a, float b, float x) { float u = clamp((x - a) / (b - a), 0.0, 1.0); return u * u * (3.0 - 2.0 * u); }

// slit geometry: sky above, wall between slit and floor
// (visible frame tops out near uv.y ~0.62 — keep the slit just inside)
float skyY(vec2 uv) {
  return 0.585 + 0.018 * (fbm3(vec3(uv.x * 6.0, 2.0, 0.0), 4) * 0.5 + 0.5);
}
float floorY(vec2 uv) {
  return 0.16 + 0.045 * fbm3(vec3(uv.x * 9.0, 7.0, 0.0), 4) * 0.5
       + 0.03 * smoothstep(0.35, 0.0, abs(uv.x - 0.52));
}

vec3 skyCol(vec2 uv) {
  vec3 c = mix(vec3(0.55, 0.72, 1.0), vec3(0.95, 0.95, 0.9), uv.x) * 1.15;
  return c;
}

vec3 wallCol(vec2 uv, float sy) {
  // layered strata bands: warm reds/oranges, broken by fbm variation
  float n = fbm3(vec3(uv.x * 5.0, uv.y * 14.0, 1.0), 4);
  float band = sin(uv.y * 34.0 + n * 4.5 + uv.x * 1.2);
  vec3 rust = vec3(0.33, 0.10, 0.045);
  vec3 ochre = vec3(0.56, 0.26, 0.10);
  vec3 deep = vec3(0.16, 0.045, 0.025);
  vec3 col = mix(rust, ochre, smoothstep(-0.5, 0.7, band));
  // crisp separations between strata layers
  col *= 1.0 - 0.30 * (1.0 - smoothstep(0.0, 0.18, abs(band)));
  col = mix(col, deep, smoothstep(0.50, 0.95, fbm3(vec3(uv.x * 3.0, uv.y * 22.0, 4.0), 4)) * 0.65);
  // rim light near the slit, shadow pooling at edges
  float rim = 1.0 - smoothstep(0.02, 0.30, sy - uv.y);
  col += rim * vec3(0.30, 0.17, 0.06);
  float edge = smoothstep(0.10, 0.42, abs(uv.x - 0.5));
  col *= 1.0 - 0.38 * edge;
  // vertical streaking from weathering
  col *= 0.92 + 0.08 * fbm3(vec3(uv.x * 40.0, uv.y * 2.0, 3.0), 4);
  return col;
}

vec3 floorCol(vec2 uv, float fy) {
  vec3 sand = vec3(0.68, 0.47, 0.27);
  float n = fbm3(vec3(uv.x * 8.0, uv.y * 30.0, 2.0), 4);
  sand *= 0.85 + 0.30 * n;
  // hashed scattered rocks
  for (int k = 0; k < 8; k++) {
    float rx = 0.30 + 0.44 * h1(float(k) * 3.7);
    float ry = 0.10 + 0.05 * h1(float(k) * 5.3 + 1.0);
    vec2 rp = vec2(rx, ry);
    vec2 dp = uv - rp;
    dp.x *= 2.0;                    // uv-x spans 2x world units of uv-y
    float r = 0.010 + 0.012 * h1(float(k) * 9.1 + 2.0);
    float d = length(dp);
    float rock = 1.0 - smoothstep(r * 0.5, r, d);
    sand = mix(sand, vec3(0.30, 0.16, 0.10), rock * 0.85);
    sand += (1.0 - smoothstep(0.0, r, d)) * rock * vec3(0.10) * (uv.y > ry ? 1.0 : 0.0);
  }
  return sand;
}

// one god-ray shaft: origin on the slit, slanting wedge, own window
float shaft(vec2 uv, int i, float t, float sy) {
  float fi = float(i);
  float h = h1(fi * 7.3 + 0.5);
  float h2 = h1(fi * 11.7 + 3.0);
  // sun's arc: shaft angle sweeps over the scene on its own clock
  float ang = -0.30 + 0.55 * (0.5 + 0.5 * sin(t * (0.06 + 0.03 * h2) + h * 6.28));
  ang += 0.06 * sin(t * 2.6 + h * 9.0) * uGust;   // gust wobble
  float ox = 0.30 + 0.42 * h + 0.05 * sin(t * 0.05 + fi * 2.0);
  vec2 o = vec2(ox, sy + 0.02);
  vec2 d = normalize(vec2(sin(ang), -cos(ang)));
  vec2 rel = uv - o;
  float along = dot(rel, d);
  float perp = abs(dot(rel, vec2(-d.y, d.x)));
  float wid = 0.003 + 0.016 * along;              // wedge widens downward
  float i0 = exp(-perp * perp / (wid * wid)) * smoothstep(0.0, 0.03, along);
  // staggered window: each shaft migrates and breathes through the scene
  float w0 = fract(t / 24.0 + h2);
  float win = smoothstep(0.0, 0.15, w0) * (1.0 - smoothstep(0.75, 1.0, w0));
  float shimmer = 0.7 + 0.3 * fbm3(vec3(uv.x * 24.0, uv.y * 24.0, t * 0.4 + fi), 4);
  return i0 * win * shimmer;
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  float sy = skyY(uv);
  float fy = floorY(uv);

  // ---- base: sky / wall / floor
  vec3 col;
  float wallM = step(uv.y, sy) * step(fy, uv.y);
  if (uv.y > sy) {
    col = skyCol(uv);
    // drifting dust haze just under the slit
    float hz = fbm3(vec3(uv.x * 6.0 + t * (0.10 + 0.35 * uGust), uv.y * 10.0, t * 0.05), 4);
    col += max(hz, 0.0) * 0.18 * vec3(1.0, 0.9, 0.7);
  } else if (uv.y < fy) {
    col = floorCol(uv, fy);
  } else {
    col = wallCol(uv, sy);
  }
  col *= uAwake;

  // ---- god-ray shafts
  float gain = uAwake * (0.7 + 0.3 * uRe) * (1.0 - 0.3 * uGust) * (1.0 - 0.35 * uRock);
  float shaftSum = 0.0;
  for (int i = 0; i < 4; i++) {
    float s = shaft(uv, i, t, sy);
    shaftSum += s;
    // light the floor patch where the shaft lands
    if (uv.y < fy + 0.02) {
      float fi = float(i);
      float h = h1(fi * 7.3 + 0.5);
      float ang = -0.30 + 0.55 * (0.5 + 0.5 * sin(t * (0.06 + 0.03 * h1(fi * 11.7 + 3.0)) + h * 6.28));
      float ox = 0.30 + 0.42 * h + 0.05 * sin(t * 0.05 + fi * 2.0);
      float hitX = ox + sin(ang) * (sy + 0.02 - fy);
      col += vec3(0.5, 0.35, 0.18) * exp(-pow((uv.x - hitX) / 0.035, 2.0)) * s * 0.5;
    }
  }
  col += vec3(1.0, 0.92, 0.72) * shaftSum * gain * 0.75;

  // ---- dust motes drifting inside the shafts
  {
    vec2 mp = uv * vec2(80.0, 46.0);
    mp.y += t * (0.6 + 1.8 * uGust);
    mp.x += t * 0.35 * uGust;
    vec2 cell = floor(mp);
    float m = h21(cell);
    vec2 f = fract(mp) - 0.5;
    float dot_ = 1.0 - smoothstep(0.02, 0.10, length(f));
    float vis = step(0.92, m) * dot_;
    col += vec3(1.0, 0.95, 0.8) * vis * shaftSum * gain * 1.4;
  }

  // ---- sand rivulets trickling down the wall face
  if (wallM > 0.0) {
    for (int j = 0; j < 6; j++) {
      float fj = float(j);
      float x0 = 0.34 + 0.34 * h1(fj * 5.9 + 0.3);
      float yTop = 0.34 + 0.20 * h1(fj * 8.3 + 1.7);
      if (yTop <= fy + 0.02) continue;
      // faint vertical stream line
      float lineI = exp(-pow((uv.x - x0) / 0.0016, 2.0));
      float span = smoothstep(fy, yTop, uv.y) * (1.0 - smoothstep(yTop - 0.01, yTop, uv.y));
      col += vec3(0.95, 0.75, 0.45) * lineI * span * 0.20 * uAwake;
      // grains: seeded fall + bounce
      for (int g = 0; g < 4; g++) {
        float fg = float(g);
        float spd = 0.55 + 0.35 * h1(fj * 13.1 + fg * 3.7);
        float ph = fract(t * spd * 0.22 + h1(fj * 17.0 + fg * 5.5));
        float gy = yTop - ph * (yTop - fy - 0.005);
        float gx = x0 + 0.0012 * sin(ph * 40.0 + fj);
        // bounce at ledges: hop amplitude decays down the fall
        gy += abs(sin(ph * 3.14159 * 4.0 + fg)) * 0.004 * (1.0 - ph);
        vec2 dp = uv - vec2(gx, gy);
        dp.x *= 2.0;
        float d = length(dp);
        col += vec3(1.0, 0.85, 0.55) * (1.0 - smoothstep(0.0006, 0.0018, d)) * 0.8 * uAwake;
      }
      // pile accumulating at the base
      float grow = ssx(2.0, 14.0, t);
      vec2 pp = vec2(x0, fy);
      vec2 dp = uv - pp;
      dp.x *= 2.0;
      col += vec3(0.85, 0.62, 0.36) * exp(-pow(dp.x / 0.008, 2.0)) * exp(-pow(dp.y / 0.012, 2.0)) * grow * 0.35 * uAwake;
    }
  }

  // ---- raven crossing the slit once
  {
    float p = ssx(10.0, 12.6, t);
    if (p > 0.0 && p < 1.0) {
      float rx = mix(0.66, 0.30, p);
      float ry = 0.575 + 0.012 * sin(p * 9.0);
      float flap = sin((t - 10.0) * 13.0);
      vec2 b = uv - vec2(rx, ry);
      b.x *= 2.0;
      // two wing strokes meeting at the body
      float wingL = abs(b.y - (-b.x * 0.9 - 0.004 * flap)) * (step(b.x, 0.0));
      float wingR = abs(b.y - (b.x * 0.9 - 0.004 * flap)) * (step(0.0, b.x));
      float body = length(b);
      float bird = (1.0 - smoothstep(0.0018, 0.0035, min(wingL, wingR) * step(abs(b.x), 0.018)))
                 + (1.0 - smoothstep(0.0012, 0.0022, body));
      col = mix(col, vec3(0.03, 0.02, 0.03), clamp(bird, 0.0, 1.0) * 0.9);
    }
  }

  // ---- rockfall beat: seeded pebble cascade + dust puff
  if (uRock > 0.0) {
    float ledge = 0.48;
    for (int k = 0; k < 9; k++) {
      float fk = float(k);
      float hx = h1(fk * 6.7 + 0.9);
      float px = 0.60 + 0.035 * hx;
      float fall = clamp((t - 11.0 - 0.45 * h1(fk * 4.1)) / 1.3, 0.0, 1.0);
      if (fall <= 0.0 || fall >= 1.0) continue;
      float py = ledge - (ledge - floorY(uv)) * fall * fall;
      vec2 dp = uv - vec2(px, py);
      dp.x *= 2.0;
      float d = length(dp);
      col += vec3(0.9, 0.7, 0.45) * (1.0 - smoothstep(0.0012, 0.0030, d)) * uRock;
      col += vec3(1.0, 0.9, 0.6) * (1.0 - smoothstep(0.0006, 0.0014, d)) * uRock;
    }
    // dust puff blooming where pebbles land
    float puffT = clamp((t - 11.6) / 2.2, 0.0, 1.0);
    if (puffT > 0.0) {
      vec2 pp = vec2(0.615, floorY(uv) + 0.01);
      vec2 dp = uv - pp;
      dp.x *= 2.0;
      float pr = 0.01 + 0.05 * puffT;
      float puff = exp(-dot(dp, dp) / (pr * pr)) * (1.0 - puffT) * max(fbm3(vec3(uv.x * 30.0, uv.y * 30.0, t), 4), 0.0) * 2.0;
      col += vec3(0.85, 0.65, 0.42) * puff * uRock;
    }
  }

  // ---- gust haze sweeping through the corridor
  col += vec3(0.8, 0.6, 0.4) * max(fbm3(vec3(uv.x * 5.0 - t * 0.9, uv.y * 8.0, t * 0.2), 4), 0.0) * uGust * 0.25 * wallM;

  fragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `out vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class CanyonLightScene extends Scene {
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
        uGust: { value: 0 }, uRock: { value: 0 }, uRe: { value: 0 },
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

    // beats: quiet shafts -> wind gust -> rockfall -> re-emerge
    const awake = ss(0, 2.5, t);
    const gust = ss(7.5, 9.0, t) * (1.0 - ss(10.5, 12.0, t));
    const rock = ss(10.8, 11.3, t) * (1.0 - ss(13.5, 14.5, t));
    const re = ss(13.0, 16.0, t);

    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uAwake!.value = awake;
    this.backMat.uniforms.uGust!.value = gust;
    this.backMat.uniforms.uRock!.value = rock;
    this.backMat.uniforms.uRe!.value = re;

    // slow tilt up the shaft during the gust, gentle push overall
    const push = ss(0, end, t);
    this.rig.position = [0.4 * Math.sin(t * 0.05), 2.0 + 1.5 * push, 24.0 - 8.0 * push];
    this.rig.target = [0, 6.0 + 9.0 * gust + 2.0 * push, -60];
    this.rig.roll = 0.003 * Math.sin(t * 0.11);
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
      g.fillStyle = 'rgba(245,235,220,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.9,
      bloom: 0.55,
      bloomThreshold: 0.35,
      bloomRadius: 1.0,
      ca: 0.06,
      grain: 0.07,
      vignette: 0.55,
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

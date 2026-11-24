// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// meteorrain — a Perseid meteor shower over a mountain observatory at deep
// night. One backdrop shader renders the Milky Way band (fbm starfield +
// dust lanes), an airglow band, drifting cloud wisps, ~40 hash-seeded meteors
// with fading ionized trails, one fragmenting fireball, lingering smoke
// trails, and the ridgeline silhouette with observatory dome + blinking mast.
// CameraRig pushes slowly and tilts skyward through the fireball event.
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
  { at: 1.2, end: 4.6, s: "the sky keeps score" },
  { at: 10.0, end: 13.4, s: "one of them fell apart" },
  { at: 14.6, end: 18.6, s: "and the smoke stays a while" },
];

/* ---------------- backdrop: sky, milky way, meteors, ridge ---------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;    // establishing fade-in
uniform float uFire;     // fireball event gain
uniform float uFade;     // lingering-glow fade

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }
float sq2(float x) { return x * x; }

// Perseid palette: white / green-gold / orange by seed
vec3 meteorColor(float seed) {
  float p = h1(seed * 23.1);
  if (p < 0.62) return vec3(0.92, 0.95, 1.00);
  if (p < 0.86) return vec3(0.72, 1.00, 0.52);
  return vec3(1.00, 0.58, 0.24);
}

// One streak: segment growing from origin o along unit dir d, head at s=headS,
// tail chasing at tailS; each point on the path keeps a decaying ionized trail.
vec3 meteor(vec2 uv, vec2 o, vec2 d, float len, float t0, float dur,
            float wid, float gain, vec3 col, float t) {
  float p = (t - t0) / dur;
  if (p <= 0.0 || p >= 6.0) return vec3(0.0);
  vec2 rel = uv - o;
  float proj = clamp(dot(rel, d), 0.0, len);
  vec2 closest = o + d * proj;
  float d2 = length(uv - closest);
  float headS = len * min(p, 1.0);
  float tailS = len * max(p - 0.55, 0.0);
  float mask = smoothstep(tailS - 0.015, tailS + 0.01, proj)
             * (1.0 - smoothstep(headS - 0.01, headS + 0.03, proj));
  float core = exp(-d2 * d2 / (wid * wid)) * mask;
  float headGlow = exp(-d2 * d2 / (wid * wid * 9.0)) * 0.35 * mask;
  // ionized trail: a point glows until its arrival time, then decays
  float arrive = t0 + dur * (proj / max(len, 1e-4));
  float trail = exp(-max(t - arrive, 0.0) / 1.6) * step(0.0, t - arrive);
  float ramp = smoothstep(0.0, 0.08, p) * (1.0 - 0.45 * smoothstep(0.75, 1.0, p));
  return col * (core * (0.35 + 0.65 * ramp) + headGlow) * gain * trail;
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  float wy = ${PY.toFixed(1)} + (uv.y - 0.5) * ${PH.toFixed(1)};
  float wx = (uv.x - 0.5) * ${PW.toFixed(1)};

  /* ---------- sky ---------- */
  vec3 c = mix(vec3(0.002, 0.004, 0.010), vec3(0.006, 0.010, 0.022),
               clamp(wy / 44.0 + 0.5, 0.0, 1.0));

  // Milky Way band: soft diagonal river + dense starfield + dark dust lanes
  float mwLine = uv.y - (0.42 + 0.42 * (uv.x - 0.15));
  float mwBand = exp(-mwLine * mwLine * 20.0);
  float dust = fbm3(vec3(uv * vec2(7.0, 14.0) + 4.7, 5.0), 3);
  float lanes = smoothstep(0.52, 0.72, dust) * mwBand;
  c += vec3(0.075, 0.085, 0.13) * mwBand * (0.55 + 0.45 * dust) * (1.0 - 0.75 * lanes);

  // stars: hashed cells host soft round dots, denser inside the band
  vec2 sc = uv * vec2(140.0, 70.0);
  vec2 cell = floor(sc);
  vec2 cp = fract(sc) - 0.5 - (vec2(h21(cell), h21(cell + 1.7)) - 0.5) * 0.6;
  float density = 0.972 - 0.055 * mwBand; // band hosts ~8x more stars
  float star = step(density, h21(cell + 9.3))
             * (1.0 - smoothstep(0.02, 0.09, length(cp))) * step(0.2, wy);
  float tw = 0.6 + 0.4 * sin(t * (1.0 + 3.0 * h21(cell + 3.0)) + h21(cell) * 40.0);
  c += vec3(0.9, 0.95, 1.0) * star * tw * (0.9 + 1.1 * mwBand * (1.0 - lanes));

  // airglow band hugging the horizon
  float airglow = exp(-sq2((uv.y - 0.40) * 16.0));
  c += vec3(0.05, 0.10, 0.07) * airglow * 0.38;

  /* ---------- meteors ---------- */
  vec3 sky = c;
  for (int i = 0; i < 40; i++) {
    float k = float(i);
    float t0 = 2.5 + 14.5 * h1(k * 7.1 + 3.0);
    float dur = 0.30 + 0.55 * h1(k * 3.7 + 9.0);
    vec2 o = vec2(0.10 + 0.72 * h1(k * 11.3 + 5.0), 0.62 + 0.34 * h1(k * 13.9 + 2.0));
    float ang = -0.42 - 0.65 * h1(k * 17.7 + 7.0); // radiant shared upper-left
    vec2 d = vec2(cos(ang), sin(ang));
    float len = 0.10 + 0.14 * h1(k * 19.3 + 1.0);
    float gain = 0.9 + 1.6 * h1(k * 29.3 + 4.0);
    sky += meteor(uv, o, d, len, t0, dur, 0.0022 + 0.0018 * h1(k * 31.7),
                  gain, meteorColor(k * 23.1 + 6.0), t);
  }

  /* ---------- headline fireball: long bolide that fragments ---------- */
  float fT0 = 10.4, fDur = 1.35;
  vec2 fO = vec2(0.16, 0.78);
  vec2 fD = normalize(vec2(0.92, -0.40));
  float fLen = 0.55;
  sky += meteor(uv, fO, fD, fLen, fT0, fDur, 0.0045, 5.0,
                vec3(1.0, 0.95, 0.82) * uFire, t);
  // 3-4 secondary streaks splitting off at the break point
  float fBreak = 0.62;
  vec2 bO = fO + fD * (fLen * fBreak);
  float bT = fT0 + fDur * fBreak;
  for (int j = 0; j < 4; j++) {
    float fj = float(j);
    float rot = -0.35 + 0.24 * fj;
    float ca = cos(rot), sa = sin(rot);
    vec2 sd = vec2(fD.x * ca - fD.y * sa, fD.x * sa + fD.y * ca);
    vec3 sCol = fj < 1.5 ? vec3(0.72, 1.0, 0.52)
              : fj < 2.5 ? vec3(1.0, 0.58, 0.24)
              : vec3(0.92, 0.95, 1.0);
    sky += meteor(uv, bO, sd, 0.14 + 0.06 * h1(fj * 5.1), bT + 0.05 * fj,
                  0.45 + 0.2 * h1(fj * 7.3), 0.003, 2.6 * uFire, sCol, t);
  }
  // fireball's own lingering smoke column
  float fsCol = 0.0;
  {
    vec2 rel = uv - fO;
    float proj = clamp(dot(rel, fD), 0.0, fLen);
    vec2 closest = fO + fD * proj;
    float d2 = length(uv - closest);
    float arrive = fT0 + fDur * (proj / fLen);
    float drift = 0.012 * (t - arrive);
    float d3 = length(uv - closest - vec2(drift, drift * 0.2));
    fsCol = exp(-d3 * d3 / 0.00012) * exp(-max(t - arrive, 0.0) / 7.0)
          * smoothstep(0.0, 0.2, t - arrive) * uFire;
  }
  sky += vec3(0.5, 0.55, 0.60) * fsCol * 0.35 * (1.0 - uFade * 0.7);

  // high-altitude smoke trails left by earlier meteors
  for (int j = 0; j < 6; j++) {
    float sj = float(j);
    float st0 = 4.0 + 10.0 * h1(sj * 41.3 + 8.0);
    vec2 so = vec2(0.15 + 0.65 * h1(sj * 43.7 + 3.0), 0.60 + 0.30 * h1(sj * 47.9 + 1.0));
    float sang = -0.42 - 0.65 * h1(sj * 51.3 + 6.0);
    vec2 sd2 = vec2(cos(sang), sin(sang));
    float slen = 0.08 + 0.10 * h1(sj * 53.7 + 4.0);
    float arrive = st0 + 0.5;
    vec2 rel = uv - so - vec2(0.010 * (t - arrive), 0.0);
    float proj = clamp(dot(rel, sd2), 0.0, slen);
    float d4 = length(rel - sd2 * proj);
    float smoke = exp(-d4 * d4 / 0.00008)
                * max(fbm3(vec3(uv * 30.0 + vec2(t * 0.05, 0.0), 23.0), 2), 0.0) * 2.0
                * exp(-max(t - arrive, 0.0) / 9.0) * smoothstep(0.0, 0.4, t - arrive);
    sky += vec3(0.42, 0.46, 0.52) * smoke * 0.30 * (1.0 - uFade * 0.7);
  }

  /* ---------- ridgeline silhouette ---------- */
  float ridge = 0.30 + 0.06 * fbm3(vec3(uv.x * 5.0, 3.0, 5.0), 3)
              - 0.05 * smoothstep(0.6, 0.95, uv.x);
  float ridgeMask = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, uv.y);

  // slow cloud wisps crossing the ridge top
  float wisps = max(fbm3(vec3(uv * vec2(3.0, 9.0) + vec2(t * 0.010, 0.0), 31.0), 3), 0.0) * 2.0
              * smoothstep(ridge + 0.10, ridge + 0.02, uv.y);
  sky = mix(sky, vec3(0.020, 0.028, 0.045), clamp(wisps * 0.5, 0.0, 0.4));

  /* ---------- observatory dome + radio mast ---------- */
  vec2 dome = vec2(0.22, ridge + 0.010);
  vec2 dp = uv - dome;
  dp.x *= 2.0; // uv-x spans twice the world units
  float domeR = 0.058;
  float domeM = 1.0 - smoothstep(domeR - 0.002, domeR + 0.002, length(dp));
  // rotating slit: narrow angular wedge sweeping the dome, occasional glint
  float slitAng = 0.9 + 0.55 * sin(t * 0.35);
  float pAng = atan(dp.y, dp.x + 1e-5);
  float slit = (1.0 - smoothstep(0.02, 0.05, abs(pAng - slitAng))) * domeM;
  float glint = pow(0.5 + 0.5 * sin(t * 0.9), 12.0);
  vec3 domeC = vec3(0.012, 0.014, 0.018);
  sky = mix(sky, domeC, domeM * step(0.0, uv.y - ridge + 0.005));
  sky += vec3(0.9, 0.9, 1.0) * slit * (0.25 + 2.4 * glint);

  // radio mast: thin silhouette + blinking red beacon
  float mast = step(abs(uv.x - 0.80), 0.0016) * step(ridge - 0.005, uv.y)
             * step(uv.y, ridge + 0.09);
  sky = mix(sky, vec3(0.010, 0.011, 0.014), mast);
  float blink = smoothstep(0.75, 0.95, sin(t * 3.9));
  float beacon = exp(-sq2((uv.x - 0.80) * 320.0) - sq2((uv.y - (ridge + 0.095)) * 320.0));
  sky += vec3(1.0, 0.10, 0.08) * beacon * blink * 2.2;

  /* ---------- compose ---------- */
  vec3 base = mix(sky, vec3(0.008, 0.010, 0.014), ridgeMask);
  // dome + mast were painted into sky already; keep silhouette dark below
  base = mix(base, sky, max(domeM, mast));

  fragColor = vec4(base * uAwake, 1.0);
}`;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class MeteorRainScene extends Scene {
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
        uFire: { value: 0 }, uFade: { value: 0 },
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

    // beats: quiet sky -> first meteors -> fireball -> lingering glow fade
    const awake = ss(0, 2.2, t);
    const fire = ss(9.8, 10.3, t) * (1.0 - ss(18.0, 19.5, t));
    const fade = ss(15.0, 19.5, t);
    const tilt = ss(9.6, 12.5, t);

    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uAwake!.value = awake;
    this.backMat.uniforms.uFire!.value = fire;
    this.backMat.uniforms.uFade!.value = fade;

    // slow push + tilt skyward through the fireball event
    const push = ss(0, end, t);
    this.rig.position = [0.5 * Math.sin(t * 0.03), 1.0, 26.0 - 12.0 * push];
    this.rig.target = [-4, 8.0 + 7.0 * tilt, -60];
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
      g.fillStyle = 'rgba(235,240,248,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.9,
      bloom: 0.9,
      bloomThreshold: 0.30,
      bloomRadius: 1.0,
      ca: 0.06,
      grain: 0.08,
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

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// fireworks — night-sky salvo over a dark waterfront. One GLSL backdrop
// pass holds the sky gradient, hash stars, the skyline silhouette strip
// and the water band with burst-colour reflections + drifting smoke.
// Every burst is a seeded instanced-billboard cloud: head sparks plus lag
// copies sampled at earlier local times so trails are free, and mortar
// ascent sparks riding an eased climb. All motion is closed-form f(t) —
// the vertex shader positions each spark from its seed and uT alone.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
import { F } from '../../engine/type';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// deterministic hash → [0,1)
const h1 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

/* ---------------- burst schedule (all values seeded, constant) ---------- */

const PALETTE = [
  [1.0, 0.78, 0.32], // gold
  [1.0, 0.28, 0.36], // crimson
  [0.66, 0.42, 1.0], // violet
  [0.55, 0.85, 1.0], // ice (rare accent)
];
const BURSTS = 16;
// {launchT, apexX, apexY, hue} per burst — world units on the backdrop plane
const burstDef = (i: number) => {
  const r = (k: number) => h1(i * 97.31 + k * 17.77);
  return {
    launchT: 0.7 + i * 1.08 + r(1) * 0.5,           // staggered salvos, first shell up at ~1s
    apexX: -52 + 104 * (r(2) * 0.9 + 0.05 * r(3)),  // spread across the sky
    apexY: 24 + 20 * r(4),                           // burst altitude band
    hue: r(5) < 0.12 ? 3 : Math.floor(r(6) * 3),     // mostly warm colours
    speed: 10 + 9 * r(7),                            // radial kick
  };
};

/* ---------------- backdrop: sky + waterfront + reflections -------------- */

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// WATER_Y: waterline in uv space. Above it: indigo night + stars + skyline.
// Below: near-black water streaked vertically by recent burst colours
// (uniform array carries each burst's apex x + colour + age).
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform vec4 uBurst[${BURSTS}];   // x: apex.x(uv) y: apex.y(uv) z: hueIdx w: burstT
uniform vec3 uCol[4];             // palette
out vec4 fragColor;
const float WATER_Y = 0.12;
const float ASPECT = ${(16 / 9).toFixed(4)};

float sstep(float e0, float e1, float x) {
  return e0 < e1 ? smoothstep(e0, e1, x) : 1.0 - smoothstep(e1, e0, x);
}
float hsh(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hsh(i.x + i.y * 57.0), b = hsh(i.x + 1.0 + i.y * 57.0);
  float c = hsh(i.x + (i.y + 1.0) * 57.0), d = hsh(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = vUv;
  // night sky: deep indigo zenith to warm city-glow at the waterline
  vec3 c = mix(vec3(0.016, 0.019, 0.052), vec3(0.005, 0.007, 0.022), sstep(0.2, 1.0, uv.y));
  c += vec3(0.075, 0.038, 0.020) * sstep(0.28, WATER_Y, uv.y);          // sodium horizon glow

  // stars: sparse hash grid, twinkle, fade near the waterline glow
  vec2 g = uv * vec2(160.0, 90.0);
  vec2 cell = floor(g);
  float star = step(0.995, hsh(cell.x * 13.0 + cell.y * 91.0));
  float tw = 0.5 + 0.5 * sin(uT * (1.0 + 3.0 * hsh(cell.x + cell.y * 7.0)) + cell.x);
  vec2 fpos = fract(g) - 0.5;
  float dot_ = star * sstep(0.10, 0.02, length(fpos));
  c += vec3(0.8, 0.85, 1.0) * dot_ * tw * sstep(0.30, 0.55, uv.y) * step(WATER_Y + 0.09, uv.y);

  // skyline: dark waterfront strip — hashed roofline, one warm window band
  float roof = WATER_Y + 0.055 + 0.030 * hsh(floor(uv.x * 90.0) * 3.7);
  float skyline = step(uv.y, roof) * step(WATER_Y - 0.006, uv.y);
  c = mix(c, vec3(0.010, 0.012, 0.020), skyline);
  float win = step(0.986, hsh(floor(uv.x * 400.0) * 1.31)) * skyline
            * step(abs(uv.y - (WATER_Y + 0.012)), 0.010);
  c += vec3(0.9, 0.55, 0.2) * win * 0.5;

  // smoke haze from past bursts + the brief hot flash lighting the sky at each burst
  float smoke = 0.0;
  vec3 flash = vec3(0.0);
  for (int i = 0; i < ${BURSTS}; i++) {
    float age = uT - uBurst[i].w;
    if (age <= 0.0) continue;
    vec2 sp = vec2(uBurst[i].x + 0.012 * age, uBurst[i].y - 0.004 * age);
    float d = length((uv - sp) * vec2(ASPECT, 1.0));
    float m = sstep(0.16 + 0.05 * age, 0.02, d) * sstep(6.0, 1.0, age);
    smoke += m * 0.4;
    float hot = exp(-age * 4.5) * exp(-d * d * 110.0);
    flash += uCol[int(uBurst[i].z)] * hot;
  }
  c += flash * 0.7 * step(WATER_Y, uv.y);
  float sn = fbm2(uv * vec2(9.0, 14.0) + vec2(uT * 0.05, -uT * 0.02));
  // additive haze (not darkening) so drift reads as smoke, not dirt specks
  c += vec3(0.045, 0.05, 0.075) * clamp(smoke * sn, 0.0, 0.6) * step(WATER_Y, uv.y);

  // water: near-black, faint vertical shimmer, burst reflections
  if (uv.y < WATER_Y) {
    vec3 w = vec3(0.004, 0.006, 0.014);
    w += vec3(0.012, 0.014, 0.030) * fbm2(vec2(uv.x * 60.0, uv.y * 300.0 + uT * 0.4));
    for (int i = 0; i < ${BURSTS}; i++) {
      float age = uT - uBurst[i].w;
      if (age <= 0.0 || age > 6.5) continue;
      // reflection: smeared column under the burst's x, waving sideways
      float sway = 0.010 * sin(uv.y * 240.0 + uT * 2.0 + uBurst[i].w * 7.0);
      float dx = uv.x - (uBurst[i].x + sway);
      float col = exp(-dx * dx * 2600.0);
      float fade = sstep(0.0, 0.25, age) * sstep(6.5, 2.5, age);
      w += uCol[int(uBurst[i].z)] * col * fade * 0.28 * sstep(WATER_Y - 0.20, WATER_Y, uv.y);
    }
    c = w;
  }
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- spark cloud: heads + lag trails + ascent ------------- */

const SPARK_VERT = /* glsl */ `
precision highp float;
// position: billboard quad corner [-1,1]
// iBurst: apex.xy, hue index, burstT | iDir: radial dir (xy) + jitter
// iP: speed, size, lag, kind (0 burst spark, 1 ascent spark, 2 ember)
in vec3 position;
in vec4 iBurst;
in vec4 iDir;
in vec4 iP;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uT;
uniform vec3 uCol[4];
out vec2 vUv;
out vec3 vCol;
out float vA;

float sstep(float e0, float e1, float x) {
  return e0 < e1 ? smoothstep(e0, e1, x) : 1.0 - smoothstep(e1, e0, x);
}

void main() {
  vUv = position.xy;
  float kind = iP.w;
  float lag = iP.z;
  vec2 apex = iBurst.xy;
  float burstT = iBurst.w;
  vec3 col = uCol[int(iBurst.z)];
  vec3 p = vec3(0.0);
  float a = 0.0;
  float sz = iP.y;

  if (kind > 1.5) {
    // ember: after the flash, sparks dim to orange and rain down slowly
    float t0 = 1.15;                                  // ember onset after burst
    float lt = uT - (burstT + t0 + lag * 0.6);
    float life = 3.2;
    if (lt > 0.0 && lt < life) {
      float d = iP.x * 0.55;
      vec2 s0 = apex + iDir.xy * d * t0 * 0.9;        // where the head had faded to
      p.xy = s0 + vec2(iDir.z * lt * 0.35, -1.4 * lt - 0.45 * lt * lt);
      float fade = 1.0 - lt / life;
      a = fade * fade * (0.55 + 0.45 * sin(uT * 9.0 + iDir.w * 40.0));
      vCol = mix(col, vec3(1.0, 0.45, 0.12), 0.75) * 0.6;
      sz *= 0.55;
    }
  } else if (kind > 0.5) {
    // ascent spark: eased climb from the waterline to the apex, ending at burstT
    float climb = 1.15;
    float lt = uT - (burstT - climb + lag * 0.10);
    if (lt > 0.0 && lt < climb) {
      float u = lt / climb;
      float ease = 1.0 - (1.0 - u) * (1.0 - u);       // decelerating rise
      float y0 = -18.0;                               // launch rail (world y)
      p.xy = vec2(apex.x + iDir.z * 2.2 * (1.0 - ease), y0 + (apex.y - y0) * ease);
      p.xy += vec2(iDir.w * 1.5, 0.0) * sin(lt * 22.0) * 0.25;
      a = sstep(0.0, 0.06, u) * (0.5 + 0.5 * fract(-lt * 9.0 + iDir.w));
      vCol = vec3(1.0, 0.78, 0.42) * 1.35;
    }
  } else {
    // burst head: radial kick with gravity droop + lag-trail sampling
    float lt = uT - (burstT + lag * 0.085);
    float life = 1.9;
    if (lt > 0.0 && lt < life) {
      float d = iP.x * lt * pow(1.0 - lt / (life * 1.15), 0.5) * 1.9;
      p.xy = apex + iDir.xy * d;
      p.y -= 2.6 * lt * lt;                            // gravity droop
      float fade = 1.0 - lt / life;
      float flick = 0.65 + 0.35 * sin(uT * 26.0 + iDir.w * 63.0);
      a = fade * flick * (1.0 - lag * 0.45);
      // white-hot core → hue → warm ember
      vec3 hot = mix(vec3(1.0, 0.95, 0.8), col, clamp(lt * 2.2, 0.0, 1.0));
      vCol = mix(hot, col * 0.55, clamp(lt / life, 0.0, 1.0) * 0.6);
      sz *= 1.0 - 0.6 * (lt / life) - 0.35 * lag;
    }
  }

  vA = a;
  // sparks sit just in front of the backdrop plane — apex coords share its
  // uv→world mapping, so the visible band lives at z ≈ PZ, not the origin
  p.z = -79.0 + iDir.w * 1.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * (a > 0.0 ? sz : 0.0);
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vCol;
in float vA;
out vec4 fragColor;
void main() {
  float d = length(vUv);
  float m = 1.0 - smoothstep(0.15, 1.0, d);           // soft round spark
  fragColor = vec4(vCol * vA * m * 2.2, vA * m);      // additive: coverage alpha
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 140, PH = 80, PY = 14, PZ = -80;

/* ---------------- scene ------------------------------------------------- */

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.0, end: 4.4, s: 'first shell climbs' },
  { at: 7.4, end: 11.4, s: 'the salvo blooms' },
  { at: 14.6, end: 18.6, s: 'the sky rains embers' },
];

export default class FireworksScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };
  private sparkU = { uT: { value: 0 } };
  private layer = new Layer2D();
  private sparks: THREE.Mesh;
  private sparkGeo = new THREE.InstancedBufferGeometry();
  private sparkMat: THREE.RawShaderMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 500);
    // keep the 38° vfov look through the rig's analytical Cam conversion.
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    const backUniforms = {
      uT: this.u.uT,
      uBurst: { value: [] as THREE.Vector4[] },
      uCol: { value: PALETTE.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
    };
    const sparkUniforms = {
      uT: this.sparkU.uT,
      uCol: { value: PALETTE.map((c) => new THREE.Vector3(c[0], c[1], c[2])) },
    };

    // pack each burst's apex/hue/time into the backdrop uniform for smoke
    // and water reflections (apex in plane-uv space)
    const burstVecs: THREE.Vector4[] = [];
    for (let i = 0; i < BURSTS; i++) {
      const b = burstDef(i);
      burstVecs.push(new THREE.Vector4(b.apexX / PW + 0.5, (b.apexY - PY) / PH + 0.5, b.hue, b.launchT + 1.15));
    }
    (backUniforms.uBurst as { value: THREE.Vector4[] }).value = burstVecs;

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: backUniforms, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    /* ---- spark buffer: per-instance {iBurst, iDir, iP} (three vec4s) ---- */
    const HEADS = 200, LAGS = 5, ASC = 10, EMB = 22;
    const ab: number[] = [], ad: number[] = [], ap: number[] = [];
    const push = (b: ReturnType<typeof burstDef>, dir: number[], p: number[]) => {
      ab.push(b.apexX, b.apexY, b.hue, b.launchT + 1.15);   // burstT = launch + climb
      ad.push(dir[0], dir[1], dir[2] ?? 0, dir[3] ?? 0);
      ap.push(p[0], p[1], p[2], p[3]);
    };
    for (let i = 0; i < BURSTS; i++) {
      const b = burstDef(i);
      const r = (k: number) => h1(i * 41.7 + k * 3.19);
      for (let s = 0; s < HEADS; s++) {
        // uniform-ish ring + radial jitter → classic peony/chrysanthemum mix
        const ang = (s / HEADS) * Math.PI * 2 + r(s) * 0.35;
        const rad = 0.55 + 0.45 * h1(s * 7.3 + i * 11.1);
        const dir = [Math.cos(ang) * rad, Math.sin(ang) * rad, (r(s + 900) - 0.5), h1(s * 3.1 + i)];
        for (let l = 0; l < LAGS; l++) {
          push(b, dir, [b.speed, 0.46 + 0.26 * r(s + 5), l / LAGS, 0]);
        }
      }
      for (let s = 0; s < ASC; s++) {
        const dir = [0, 0, (r(s + 200) - 0.5) * 2, r(s + 300)];
        for (let l = 0; l < 4; l++) {
          push(b, dir, [b.speed, 0.30 + 0.15 * r(s + 7), l / 4, 1]);
        }
      }
      for (let s = 0; s < EMB; s++) {
        const ang = (s / EMB) * Math.PI * 2 + r(s + 50) * 1.2;
        const dir = [Math.cos(ang), Math.sin(ang) * 0.8 - 0.3, (r(s + 400) - 0.5), r(s + 500)];
        push(b, dir, [b.speed * 0.5, 0.16 + 0.10 * r(s + 9), r(s + 60), 2]);
      }
    }
    // instanced billboard quads — same pattern as engine AnalyticalParticles
    const quad = new Float32Array([
      -1, -1, 0, 1, -1, 0, 1, 1, 0,
      -1, -1, 0, 1, 1, 0, -1, 1, 0,
    ]);
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(quad, 3));
    this.sparkGeo.setAttribute('iBurst', new THREE.InstancedBufferAttribute(new Float32Array(ab), 4));
    this.sparkGeo.setAttribute('iDir', new THREE.InstancedBufferAttribute(new Float32Array(ad), 4));
    this.sparkGeo.setAttribute('iP', new THREE.InstancedBufferAttribute(new Float32Array(ap), 4));
    this.sparkGeo.instanceCount = ab.length / 4;
    this.sparkMat = new THREE.RawShaderMaterial({
      uniforms: sparkUniforms,
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    this.sparks = new THREE.Mesh(this.sparkGeo, this.sparkMat);
    this.sparks.frustumCulled = false;
    this.three.add(this.sparks);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.sparkU.uT.value = t;

    // waterfront barge framing: slow drift + gentle push toward the show
    const push = ss(0, this.ctx.end, t);
    this.rig.position = [3.0 * Math.sin(t * 0.04), 2.0 - 0.6 * push, 26.0 - 3.0 * push];
    this.rig.target = [0, 10.0, PZ];
    this.rig.roll = 0.012 * Math.sin(t * 0.27);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions — low third, duck with the scene's own fade in/out
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      g.save();
      g.globalAlpha = a;
      const text = c.s.toUpperCase();
      const maxW = this.ctx.W - 48;
      let fs = 52;
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
      const tw = g.measureText(text).width;
      const tx = this.ctx.W / 2;
      const ty = this.ctx.H - 120;
      g.textAlign = 'center';
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(255,244,225,0.95)';
      g.fillText(text, tx, ty);
      g.restore();
    }
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.85,
      bloom: 0.95,
      bloomThreshold: 0.42,
      bloomRadius: 0.9,
      ca: 0.08,
      grain: 0.06,
      vignette: 0.42,
      level: ss(0, 0.8, t) * (1 - ss(this.ctx.end - 0.8, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.texture.dispose();
    this.sparkGeo.dispose();
    this.sparkMat.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

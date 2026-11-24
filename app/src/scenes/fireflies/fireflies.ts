// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// fireflies — a meadow edge at deep dusk. ~90 fireflies drift as soft glowing
// motes: each fly is a hash-seeded closed-form sum-of-sines wander plus an
// analytic bioluminescent pulse train (per-fly period/phase, gentle ramp-on,
// slower decay) — brightness is fully f(t). Near-black grass silhouette,
// faint cool sky gradient, warm-amber cores with a faint green tint, soft
// bloom halos, parallax (nearer flies bigger and more blurred), and a slow
// drift of the whole composition. One brighter hero fly sweeps near the
// camera inside a gaussian window around t=14.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { mulberry32 } from '../../engine/util';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number) => Math.exp(-x * x);

const COUNT = 90;
const SEED = 0x1f1ef;
const PI2 = Math.PI * 2;

// --- motes -------------------------------------------------------------------
// Instanced billboards; every attribute is a static seed written once, so
// position and brightness are pure f(seed, t) — deterministic in any frame
// order, no accumulators, no Math.random at render time.
const MOTE_VERT = /* glsl */ `
precision highp float;
precision highp int;

in vec3 position;           // quad corner in [-1,1]
in vec4 iA;                 // baseXZ(x,z), phase, period
in vec4 iB;                 // wander amp x,y,z + depth (0 near … 1 far)
in vec4 iC;                 // three sine freq/phase pairs packed as f,p,f,p

uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform float uT;
uniform float uHeroT;       // hero sweep centre time (~14s)
uniform float uHeroW;       // gaussian window width

out vec2 vUv;
out float vGlow;
out vec3 vCol;

const float PI = 3.14159265358979;

// closed-form pulse train: fract phase x in [0,1), ramp-on over 'on'
// fraction of the period then slow exponential decay — all f(t).
float pulseEnv(float t, float period, float phase) {
  float x = fract(t / period + phase);
  const float on = 0.07;
  float up = smoothstep(0.0, on, x);
  float dn = exp(-9.0 * max(0.0, x - on));
  return up * dn;
}

// sum-of-sines wander around the fly's anchor, all terms hash-seeded
vec3 wander(vec4 A, vec4 B, vec4 C, float t, out vec3 anchor) {
  anchor = vec3(A.x, 0.55 + B.w * 2.6, A.y);
  vec2 f1 = vec2(C.x, C.z);  // frequencies
  vec2 p1 = vec2(C.y, C.w);  // phases
  vec3 d = vec3(
    B.x * (sin(t * f1.x * 0.31 + p1.x) + 0.55 * sin(t * f1.y * 0.53 + p1.y * 2.1)),
    B.y * (sin(t * f1.y * 0.41 + p1.x * 1.7) + 0.45 * sin(t * f1.x * 0.71 + p1.y)),
    B.z * (sin(t * f1.x * 0.23 + p1.y * 0.8) + 0.6 * sin(t * f1.y * 0.37 + p1.x * 1.3))
  );
  return anchor + d;
}

void main() {
  vUv = position.xy;

  bool hero = iA.w < 0.0;                 // index 0 carries a negative period tag
  float period = abs(iA.w);
  float phase = iA.z;

  vec3 anchor;
  vec3 p = wander(iA, iB, iC, uT, anchor);

  // hero fly: one brighter mote sweeping near the camera inside a gaussian
  // time window — a closed-form lerp along a wide arc, not a keyed event.
  float hw = hero ? exp(-pow((uT - uHeroT) / uHeroW, 2.0)) : 0.0;
  if (hero) {
    float s = clamp((uT - (uHeroT - uHeroW * 2.0)) / (uHeroW * 4.0), 0.0, 1.0);
    vec3 near_ = vec3(mix(-7.0, 6.0, s), mix(1.4, 2.6, s) + 0.4 * sin(s * PI), mix(-1.5, -3.0, s));
    p = mix(p, near_, hw);
  }

  float env = pulseEnv(uT, period, phase);
  // scattered early flashes (t<6 sparse) → whole field alive by ~8
  float dawn = smoothstep(1.2, 7.5, uT);
  float glow = env * mix(0.18, 1.0, dawn) + hw * 0.85;
  // the idle drift still carries a faint ember so the field never fully dies
  vGlow = glow + 0.035;
  if (hero) vGlow += hw * 1.6;

  // warm-amber core, halo biased faintly green — classic luciferin
  vCol = hero ? vec3(1.0, 0.78, 0.42) : vec3(0.98, 0.70, 0.30);

  // billboard: face the camera, size scales with proximity (parallax) and
  // the hero swell; nearer flies also render softer via vGlow-adjacent size
  float depth = 1.0 - iB.w;               // 1 near … 0 far
  float size = mix(0.05, 0.16, depth) * (1.0 + glow * 0.9 + hw * 1.4);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  mv.xy += position.xy * size;
  vCol = mix(vCol, vec3(0.62, 0.85, 0.42), 0.28 * (1.0 - depth)); // greener far
  gl_Position = projectionMatrix * mv;
}`;

const MOTE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vGlow;
in vec3 vCol;
out vec4 fragColor;
void main() {
  float d2 = dot(vUv, vUv);
  // hot core + wide soft halo in one radial falloff pair
  float core = exp(-d2 * 34.0);
  float halo = exp(-d2 * 5.5) * 0.5;
  float a = (core + halo) * vGlow;
  if (a < 0.0015) discard;
  vec3 tintGreen = vec3(0.55, 0.95, 0.45);
  vec3 col = vCol * core + mix(vCol, tintGreen, 0.35) * halo;
  fragColor = vec4(col * a, 1.0);
}`;

// --- dusk backdrop -------------------------------------------------------------
const BACK_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;
void main() {
  // deep-dusk gradient: near-black ground rising into a faint cool sky
  vec3 ground = vec3(0.0012, 0.0020, 0.0030);
  vec3 horizon = vec3(0.0060, 0.0100, 0.0200);
  vec3 zenith = vec3(0.0110, 0.0200, 0.0420);
  vec3 col = mix(ground, horizon, smoothstep(0.30, 0.52, vUv.y));
  col = mix(col, zenith, smoothstep(0.55, 1.0, vUv.y));

  // grass-line silhouette: a wavy near-black band along the meadow edge,
  // with sparse taller blades. Fully analytic sums of sines.
  float edge = 0.40 + 0.050 * sin(vUv.x * 19.0) + 0.030 * sin(vUv.x * 47.0 + 1.7)
             + 0.016 * sin(vUv.x * 91.0 + 4.0);
  float blade = step(0.82, fract(sin(floor(vUv.x * 220.0) * 12.9898) * 43758.5453))
              * 0.10 * fract(sin(floor(vUv.x * 220.0) * 78.233) * 19642.3494);
  edge += blade;
  col = mix(vec3(0.0008, 0.0016, 0.0024), col, smoothstep(edge - 0.012, edge + 0.004, vUv.y));

  // residual warm haze dying at the horizon as dusk deepens across the take
  col += vec3(0.030, 0.016, 0.005) * exp(-pow((vUv.y - 0.46) / 0.06, 2.0))
       * (1.0 - smoothstep(2.0, 18.0, uT) * 0.6);
  fragColor = vec4(col, 1.0);
}`;

export default class FirefliesScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private moteU = {
    uT: { value: 0 },
    uHeroT: { value: 14.0 },
    uHeroW: { value: 1.6 },
  };
  private backU = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(46, ctx.W / ctx.H, 0.1, 120);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 36),
      new THREE.ShaderMaterial({ uniforms: this.backU, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, 6.5, -22);
    this.three.add(back);

    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = COUNT;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0,  1, -1, 0,  1, 1, 0,
      -1, -1, 0,  1,  1, 0, -1, 1, 0,
    ]), 3));
    const iA = new Float32Array(COUNT * 4);
    const iB = new Float32Array(COUNT * 4);
    const iC = new Float32Array(COUNT * 4);
    const rand = mulberry32(SEED);
    for (let i = 0; i < COUNT; i++) {
      iA[i * 4 + 0] = (rand() - 0.5) * 16.0;          // anchor x
      iA[i * 4 + 1] = -2.0 - rand() * 9.0;            // anchor z (parallax depth)
      iA[i * 4 + 2] = rand();                          // pulse phase
      iA[i * 4 + 3] = (i === 0 ? -1 : 1) * (2.4 + rand() * 3.4); // period (hero tagged negative)
      iB[i * 4 + 0] = 0.5 + rand() * 1.4;              // wander amp x
      iB[i * 4 + 1] = 0.25 + rand() * 0.6;             // wander amp y
      iB[i * 4 + 2] = 0.3 + rand() * 0.9;              // wander amp z
      iB[i * 4 + 3] = rand();                          // depth 0 near…1 far
      iC[i * 4 + 0] = 0.5 + rand() * 1.4;
      iC[i * 4 + 1] = rand() * PI2;
      iC[i * 4 + 2] = 0.4 + rand() * 1.2;
      iC[i * 4 + 3] = rand() * PI2;
    }
    const attr = (a: Float32Array) => {
      const at = new THREE.InstancedBufferAttribute(a, 4);
      at.setUsage(THREE.StaticDrawUsage);
      return at;
    };
    geo.setAttribute('iA', attr(iA));
    geo.setAttribute('iB', attr(iB));
    geo.setAttribute('iC', attr(iC));

    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      uniforms: this.moteU,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    this.three.add(mesh);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.moteU.uT.value = t;
    this.backU.uT.value = t;

    // slow drift of the whole composition: gentle yaw + a low push-in,
    // ending just high enough that the field reads as a constellation
    const drift = smooth(0, this.ctx.end, t);
    const yaw = -0.10 + 0.20 * drift + 0.02 * Math.sin(t * 0.11);
    const R = 8.2 - 1.4 * drift;
    this.cam.position.set(
      Math.sin(yaw) * R,
      1.7 + 0.7 * drift + 0.10 * Math.sin(t * 0.07 + 1.2),
      Math.cos(yaw) * R - 4.0,
    );
    this.cam.lookAt(0.3 * Math.sin(t * 0.05), 1.35 + 0.25 * drift, -5.0);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.38,
      bloom: 1.2,
      bloomThreshold: 0.30,
      bloomRadius: 0.8,
      ca: 0.25,
      grain: 0.06,
      vignette: 0.6,
      level: smooth(0, 0.9, f.lt) * (1 - smooth(this.ctx.end - 0.9, this.ctx.end, f.lt)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

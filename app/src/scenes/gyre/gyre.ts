// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// gyre — thousands of bone-white tracer particles advected through a
// time-modulated double-gyre streamfunction on a near-black field. Two
// counter-rotating ocean gyres; mid-take the gyre boundary pulses once so
// filaments shear and fold across the separatrix, which carries the scene's
// only colour: a thin warm thread.
//
// Particles honour the AnalyticalParticles contract: static instanced seed
// buffers written once, position = f(seed, t) evaluated in the vertex shader
// — no accumulators, no Math.random. Advection is a fixed-step RK2 march
// through the analytic velocity field, deterministic for any t in any frame
// order; respawns come from a per-cycle hash so wraps never repeat identically.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { mulberry32 } from '../../engine/util';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number) => Math.exp(-x * x);

// Mid-take boundary pulse: one slow swell of the separatrix modulation.
const pulseAt = (t: number) => gauss((t - 10.0) / 2.2);

const COUNT = 3200;
const SEED = 0x67fe;

// --- tracer shader -----------------------------------------------------------
// Double-gyre streamfunction on [0,2]x[0,1]:
//   ψ = A·sin(πf(x,t))·sin(πy),  f = e·x² + (1−2e)·x,  e = ε·sin(ωt) + pulse
// u = ∂ψ/∂y, v = −∂ψ/∂x. e=0 gives the classic two-cell flow; e≠0 pushes the
// separatrix sideways so filaments shear across it.
const TRACER_VERT = /* glsl */ `
precision highp float;
precision highp int;

in vec3 position;           // x: ribbon side [-1,1], y: 1 = head, -1 = tail
in vec4 iA;                 // phase, life, sizeMul, unused
in vec4 iB;                 // four static randoms for per-cycle respawn hash

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uT, uAmp, uEps, uOm, uPulse, uDelta, uSize, uW, uD;

out float vSide;
out float vAlpha;
out float vWarm;

const float PI = 3.14159265358979;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
vec4 cycRand(vec4 B, float c) {
  uint s = floatBitsToUint(B.x) ^ (floatBitsToUint(B.y) * 747796405u);
  s += uint(int(c)) * 2891336453u;
  uint a = pcg(s), b = pcg(a ^ 0x9E3779B9u), cc = pcg(b + 0x7F4A7C15u), d = pcg(cc ^ 0x85EBCA6Bu);
  return vec4(float(a >> 8u), float(b >> 8u), float(cc >> 8u), float(d >> 8u)) * (1.0 / 16777216.0);
}

float pulseOf(float t) {
  float g = (t - 10.0) / 2.2;
  return exp(-g * g);
}

// velocity in domain units/sec (A absorbed into uAmp)
// the pulse is evaluated at each step's own time — historical steps
// march through the streamfunction as it existed then, not as it is now
vec2 vel(vec2 p, float t) {
  float e = uEps * sin(uOm * t) + pulseOf(t) * 0.55;
  float a = e, b = 1.0 - 2.0 * e;
  float f = a * p.x * p.x + b * p.x;
  float fp = 2.0 * a * p.x + b;
  return vec2(
    PI * uAmp * sin(PI * f) * cos(PI * p.y),
    -PI * uAmp * fp * cos(PI * f) * sin(PI * p.y)
  );
}

// deterministic fixed-step midpoint march t0 → t1 (identical every frame)
vec2 advect(vec2 p0, float t0, float t1) {
  vec2 p = p0;
  float tt = t0;
  for (int i = 0; i < 160; i++) {
    if (tt >= t1 - 1e-5) break;
    float h = min(0.06, t1 - tt);
    vec2 k1 = vel(p, tt);
    vec2 k2 = vel(p + 0.5 * h * k1, tt + 0.5 * h);
    p += h * k2;
    // streamfunction walls (ψ = 0 on the box) should trap particles exactly;
    // the clamp just eats the RK residual at the boundary
    p = clamp(p, vec2(1e-3), vec2(2.0 - 1e-3, 1.0 - 1e-3));
    tt += h;
  }
  return p;
}

vec3 toWorld(vec2 p) {
  return vec3((p.x - 1.0) * uW, 0.0, (p.y - 0.5) * uD);
}

void main() {
  float life = iA.y;
  float cyc = floor((uT + iA.x * life) / life);
  float age = mod(uT + iA.x * life, life);
  float t0 = uT - age;

  // respawn point varies per cycle, interior-margined so seeds don't hug walls
  vec4 r = cycRand(iB, cyc);
  vec2 s = vec2(0.06 + 1.88 * r.x, 0.06 + 0.88 * r.y);

  bool head = position.y > 0.0;
  float tc = head ? uT : max(t0, uT - uDelta);
  vec2 pp = advect(s, t0, tc);
  vec3 wp = toWorld(pp);

  // ribbon: offset perpendicular to the view-projected direction
  vec2 pRef = advect(s, t0, head ? max(t0, uT - 0.22) : min(uT, tc + 0.22));
  vec4 vPos = modelViewMatrix * vec4(wp, 1.0);
  vec4 vRef = modelViewMatrix * vec4(toWorld(pRef), 1.0);
  // forward direction at BOTH endpoints: head looks back at a reference
  // behind it, the tail looks forward at one ahead — same winding, no twist
  vec2 dir = head ? (vPos.xy - vRef.xy) : (vRef.xy - vPos.xy);
  float dl = length(dir);
  dir = dl > 1e-5 ? dir / dl : vec2(1.0, 0.0);
  float width = uSize * iA.z * mix(0.35, 1.0, head ? 1.0 : 0.0);
  vPos.xy += vec2(-dir.y, dir.x) * position.x * width;

  // fade in/out across each life cycle so respawn never pops
  float an = age / life;
  vAlpha = smoothstep(0.0, 0.12, an) * (1.0 - smoothstep(0.86, 1.0, an));
  vAlpha *= head ? 1.0 : 0.55;

  // separatrix filament: the boundary is the streamline f(x)=1 — solve
  // e·x²+(1−2e)·x=1 exactly (quadratic), degenerating to x=1/b at e→0,
  // then tint the particles threading it warm (squared distance, no pow)
  float e = uEps * sin(uOm * uT) + uPulse * 0.55;
  float qa = e, qb = 1.0 - 2.0 * e;
  float qd = max(0.0, qb * qb + 4.0 * qa);
  float xsep = abs(qa) > 1e-4
    ? clamp((-qb + sqrt(qd)) / (2.0 * qa), 0.05, 1.95)
    : clamp(1.0 / max(qb, 0.05), 0.05, 1.95);
  float dwx = (pp.x - xsep) / 0.10;
  vWarm = exp(-dwx * dwx) * (0.45 + 0.55 * uPulse);

  vSide = position.x;
  gl_Position = projectionMatrix * vPos;
}`;

const TRACER_FRAG = /* glsl */ `
precision highp float;
in float vSide;
in float vAlpha;
in float vWarm;
out vec4 fragColor;
void main() {
  float a = vAlpha * (1.0 - smoothstep(0.2, 1.0, abs(vSide))) * 0.16;
  vec3 bone = vec3(0.90, 0.88, 0.82);
  vec3 warm = vec3(1.00, 0.74, 0.48);
  vec3 col = mix(bone, warm, clamp(vWarm, 0.0, 1.0));
  // the separatrix thread carries extra energy — the scene's only colour event
  fragColor = vec4(col * a * (1.0 + vWarm * 2.2), 1.0);
}`;

// --- backdrop ----------------------------------------------------------------
const FLOOR_VERT = /* glsl */ `out vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const FLOOR_FRAG = /* glsl */ `
precision highp float;
uniform float uT;
in vec3 vW; out vec4 fragColor;
void main() {
  // deep blue-black water, faint radial swell breathing with the pulse
  float d = length(vW.xz) / 14.0;
  vec3 col = mix(vec3(0.010, 0.018, 0.034), vec3(0.002, 0.005, 0.011), smoothstep(0.15, 1.0, d));
  fragColor = vec4(col, 1.0);
}`;

export default class GyreScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private tracerU = {
    uT: { value: 0 },
    uAmp: { value: 0.5 },
    uEps: { value: 0.24 },
    uOm: { value: 0.55 },
    uPulse: { value: 0 },
    uDelta: { value: 0.42 },
    uSize: { value: 0.045 },
    uW: { value: 18.0 },
    uD: { value: 10.0 },
  };
  private floorU = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(50, ctx.W / ctx.H, 0.1, 80);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 34),
      new THREE.ShaderMaterial({ uniforms: this.floorU, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.rotation.x = -Math.PI / 2;
    back.position.y = -0.05;
    this.three.add(back);

    // --- instanced tracers -----------------------------------------------------
    const geo = new THREE.InstancedBufferGeometry();
    geo.instanceCount = COUNT;
    // quad: x = ribbon side, y = head/tail
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -1, -1, 0,  1, -1, 0,  1, 1, 0,
      -1, -1, 0,  1,  1, 0, -1, 1, 0,
    ]), 3));
    const iA = new Float32Array(COUNT * 4);
    const iB = new Float32Array(COUNT * 4);
    const rand = mulberry32(SEED);
    for (let i = 0; i < COUNT; i++) {
      iA[i * 4 + 0] = rand();                    // phase offset
      iA[i * 4 + 1] = 5.0 + rand() * 3.5;        // life (s)
      iA[i * 4 + 2] = 0.55 + rand() * 0.9;       // size mul
      iA[i * 4 + 3] = rand();
      for (let k = 0; k < 4; k++) iB[i * 4 + k] = rand() * 4294967295;
    }
    const attrA = new THREE.InstancedBufferAttribute(iA, 4);
    const attrB = new THREE.InstancedBufferAttribute(iB, 4);
    attrA.setUsage(THREE.StaticDrawUsage);
    attrB.setUsage(THREE.StaticDrawUsage);
    geo.setAttribute('iA', attrA);
    geo.setAttribute('iB', attrB);

    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: TRACER_VERT,
      fragmentShader: TRACER_FRAG,
      uniforms: this.tracerU,
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
    this.tracerU.uT.value = t;
    this.tracerU.uPulse.value = pulseAt(t);
    this.floorU.uT.value = t;

    // slow descending oblique into the flow
    const h = 14.5 - 5.5 * smooth(0.5, 17.5, t);
    this.cam.position.set(
      1.6 * Math.sin(t * 0.09),
      h,
      9.0 - 2.6 * smooth(2.0, 16.0, t) + 0.5 * Math.sin(t * 0.06 + 1.4),
    );
    this.cam.lookAt(0.4 * Math.sin(t * 0.05), 0, -0.4);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.05,
      bloom: 1.15,
      bloomThreshold: 0.30,
      bloomRadius: 0.85,
      ca: 0.3,
      grain: 0.05,
      vignette: 0.55,
      // take-edge fades ride `level` (multiplicative, post-applied)
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

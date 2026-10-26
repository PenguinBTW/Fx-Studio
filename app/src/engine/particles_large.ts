// LargeParticles: stateless instanced particle system for 10^5..5x10^5 particles with analytic trails.
// Every vertex evaluates p(seed, t) in closed form (no history, no simulation), so any frame can be
// rendered in any order. Trails re-evaluate the same function at t - k*dt. Fields use the shared
// curlNoise3J (analytic Jacobian) so velocity, and hence streak/ribbon direction, is exact for the
// turbulence term. See docs/engine/particles-large.md.
import * as THREE from 'three';
import { mulberry32, type V3 } from './util';
import { GLSL_NOISE } from './glsl/noise';
import { GLSL_SPECTRUM } from './glsl/spectrum';
import { H } from './gl';

export type LargeMode = 'free' | 'press' | 'spiral' | 'fall' | 'star';
export type LargeStyle = 'disc' | 'streak' | 'points';
export type LargeColorMode = 'flat' | 'blackbody' | 'wavelength';

export interface LargeParticleOpts {
  count?: number;
  mode?: LargeMode;
  style?: LargeStyle;
  seed?: number;
  /** Per-particle radius range (world units), sampled as lerp(a, b, r^2). */
  size?: [number, number];
  /** Per-particle cycle length range (seconds). Ignored by 'star'. */
  life?: [number, number];
  /** Per-particle temperature range inside [0,1]; colour modes map it to kelvin / nanometres. */
  temperature?: [number, number];
  color?: { mode?: LargeColorMode; rgb?: V3; range?: [number, number] };
  intensity?: number;
  brightnessVariance?: number;
  fade?: [number, number];
  minPx?: number;
  sizeScale?: number;
  trail?: { segments?: number; dt?: number; taper?: number; power?: number; gain?: number };
  /** Seconds of motion shown by a streak head (style 'streak'). */
  streak?: number;
  dof?: { cocScale?: number; focus?: number; range?: number };
  /** Opaque dots: hard discs, no blending, depth write on. Trails are skipped. */
  opaque?: boolean;
  turbulence?: { amp?: number; freq?: number; drift?: number };
  free?: { center?: V3; shell?: [number, number]; dir?: V3; speed?: number; spread?: number; gravity?: V3 };
  press?: { center?: V3; shell?: [number, number]; shellPow?: number; core?: number; falloff?: number; power?: number; coreDim?: number };
  spiral?: { center?: V3; L?: [number, number]; thetaMin?: number; helixRadius?: number; turns?: number; lonRate?: number };
  fall?: { center?: V3; box?: V3; velocity?: V3; drag?: number };
  star?: { center?: V3; shell?: [number, number]; shellPow?: number; spin?: number; twinkle?: number; twinkleRate?: number };
}

const MODE_ID: Record<LargeMode, number> = { free: 0, press: 1, spiral: 2, fall: 3, star: 4 };
const COLOR_ID: Record<LargeColorMode, number> = { flat: 0, blackbody: 1, wavelength: 2 };
const MAX_TRAIL = 16;

const VERT = /* glsl */ `
precision highp float;
precision highp int;
${GLSL_NOISE}
${GLSL_SPECTRUM}

in vec3 position;
in vec4 iA;   // phase, radius, cycle length, temperature
in vec4 iB;   // four static uniform randoms

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime, uViewH;
uniform float uMode, uColorMode;
#define MODE int(uMode + 0.5)
#define CMODE int(uColorMode + 0.5)
uniform vec3 uCenter, uDir, uGrav, uBox, uVel, uColor;
uniform vec2 uShell, uLRange, uFade, uColorRange, uBrightRange;
uniform float uShellPow, uCore, uFall, uPow, uTurb, uFreq, uDrift;
uniform float uSpeed, uSpread, uThMin, uHelixR, uTurns, uLonRate, uDrag, uSpin, uTwinkle, uTwinkleRate;
uniform float uIntensity, uBrightVar, uSize, uMinPx, uStreak, uCocScale, uFocus, uFocusRange;
uniform float uTrailDt, uTrailN, uTaper, uTrailPow, uTrailGain;
uniform float uOpaque, uCoreDim;

out vec2 vUv;
out vec3 vColor;
out float vAlpha;
out float vSoft;
out float vT;
out float vSide;
out float vSeg;
out float vDepth;

const float kPI = 3.14159265358979;
const float kTAU = 6.28318530717959;

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
vec3 sphereDir(float a, float b) {
  float z = 2.0 * a - 1.0, ph = kTAU * b, r = sqrt(max(1.0 - z * z, 0.0));
  return vec3(r * cos(ph), z, r * sin(ph));
}

float gAtt = 1.0;
// Position p and velocity v (v only when NEED_VEL) of the particle at cycle time tau, absolute time t.
void state(vec4 R, vec4 B, float t, float tau, float L, out vec3 p, out vec3 v) {
  float u = tau / L;
  vec3 base = vec3(0.0), bdot = vec3(0.0);
  float amp = uTurb, ampdot = 0.0;

  if (MODE == 1) {
    vec3 d = sphereDir(R.y, R.z);
    float r0 = mix(uShell.x, uShell.y, pow(R.x, uShellPow));
    float om = clamp(1.0 - u, 1e-4, 1.0);
    float r = uCore + (r0 - uCore) * pow(om, uPow);
    float drdt = -(r0 - uCore) * uPow * pow(om, uPow - 1.0) / L;
    base = uCenter + d * r; bdot = d * drdt;
    float s = clamp((r - uCore) / max(uFall, 1e-4), 0.0, 1.0);
    amp = uTurb * s * s * (3.0 - 2.0 * s);
    gAtt = mix(uCoreDim, 1.0, s);
    ampdot = uTurb * 6.0 * s * (1.0 - s) / max(uFall, 1e-4) * drdt;
  } else if (MODE == 2) {
    float Ls = mix(uLRange.x, uLRange.y, R.x);
    float th0 = uThMin;
    float sgn = R.w < 0.5 ? 1.0 : -1.0;
    float thdot = (kPI - 2.0 * th0) / L;
    float th = th0 + (kPI - 2.0 * th0) * u;
    if (sgn < 0.0) { th = kPI - th; thdot = -thdot; }
    float phi = kTAU * R.y + uLonRate * tau;
    float sT = sin(th), cT = cos(th), cp = cos(phi), sp = sin(phi);
    float rho = Ls * sT * sT * sT, yy = Ls * sT * sT * cT;
    float drho = 3.0 * Ls * sT * sT * cT, dyy = Ls * (2.0 * sT * cT * cT - sT * sT * sT);
    vec3 e = vec3(cp, 0.0, sp), ph = vec3(-sp, 0.0, cp);
    vec3 tv = e * drho + vec3(0.0, dyy, 0.0);
    vec3 T = tv / max(length(tv), 1e-5);
    vec3 N = normalize(cross(ph, T));
    float rad = uHelixR * (0.6 + 0.4 * fract(R.x * 7.31));
    float g = kTAU * uTurns * u + kTAU * R.z;
    float gdot = kTAU * uTurns / L;
    vec3 off = rad * (cos(g) * N + sin(g) * ph);
    base = uCenter + e * rho + vec3(0.0, yy, 0.0) + off;
    bdot = tv * thdot + ph * (rho * uLonRate)
         + rad * gdot * (-sin(g) * N + cos(g) * ph);
  } else if (MODE == 3) {
    vec3 p0 = uCenter + vec3(mix(-uBox.x, uBox.x, R.x), uBox.y, mix(-uBox.z, uBox.z, R.y));
    float k = max(uDrag, 1e-3);
    float sm = 0.8 + 0.4 * R.w;
    float e = exp(-tau / k);
    base = p0 + uVel * sm * (tau - k * (1.0 - e));
    bdot = uVel * sm * (1.0 - e);
  } else if (MODE == 4) {
    vec3 d = sphereDir(R.y, R.z);
    float r = mix(uShell.x, uShell.y, pow(R.x, uShellPow));
    float a = uSpin * t, ca = cos(a), sa = sin(a);
    d = vec3(ca * d.x + sa * d.z, d.y, -sa * d.x + ca * d.z);
    base = uCenter + d * r;
    bdot = uSpin * r * vec3(d.z, 0.0, -d.x);
    amp = uTurb;
  } else {
    vec3 d = sphereDir(R.y, R.z);
    float r0 = mix(uShell.x, uShell.y, pow(R.x, uShellPow));
    float sp = uSpeed * (0.5 + R.w);
    base = uCenter + d * r0 + (uDir * sp + d * uSpread * uSpeed) * tau + 0.5 * uGrav * tau * tau;
    bdot = uDir * sp + d * uSpread * uSpeed + uGrav * tau;
  }

  p = base; v = bdot;
  if (amp != 0.0 || ampdot != 0.0) {
    vec3 q = base * uFreq;
    float tt = t * uDrift;
#ifdef NEED_VEL
    mat3 J;
    vec3 c = curlNoise3J(q, tt, J);
    p += c * amp;
    v += c * ampdot + amp * (J * (uFreq * bdot + uDrift * NZ_CURL_DRIFT));
#else
    p += curlNoise3(q, tt) * amp;
#endif
  }
}

void main() {
  float L = max(iA.z, 1e-3);
  bool stat = MODE == 4;
  float phase = stat ? 0.5 : uTime / L + iA.x;
  float c = stat ? 0.0 : floor(phase);
  float u = stat ? 0.5 : phase - c;
  float tau = u * L;
  vec4 R = stat ? iB : cycRand(iB, c);
  float fade = stat ? 1.0 : smoothstep(0.0, max(uFade.x, 1e-4), u) * (1.0 - smoothstep(1.0 - max(uFade.y, 1e-4), 1.0, u));

  float kk = 0.0;
#ifdef RIBBON
  kk = position.y;
#endif
  float dtk = kk * uTrailDt;
  float back = stat ? dtk : min(dtk, tau);
  float ts = uTime - back;
  float tauS = tau - back;

  vec3 p, v;
  state(R, iB, ts, tauS, L, p, v);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = max(-mv.z, 1e-3);
  vec4 clip0 = projectionMatrix * mv;
  float pxPerW = projectionMatrix[1][1] * 0.5 * uViewH / max(clip0.w, 1e-4);
  float rawPx = iA.y * uSize * pxPerW;
  float coc = uCocScale * max(abs(vDepth - uFocus) - uFocusRange, 0.0) / vDepth;
  float rPx = max(rawPx, uMinPx) + coc;
  float energy = min(rawPx, rPx);
  energy = energy * energy / (rPx * rPx);
  float offs = rPx / pxPerW;
  vSoft = coc / rPx;
  vT = 0.0; vSide = 0.0; vSeg = 0.0;
  vUv = position.xy;

  float temp = iA.w;
  vec3 col = uColor;
  if (CMODE == 1) col = blackbodyToLinearSRGB(mix(uColorRange.x, uColorRange.y, temp));
  else if (CMODE == 2) col = wavelengthToLinearSRGB(mix(uColorRange.x, uColorRange.y, temp), 0);
  float bright = uIntensity * mix(1.0, iB.w, uBrightVar);
  if (uTwinkle > 0.0) bright *= 1.0 + uTwinkle * sin(uTime * uTwinkleRate * (0.5 + iB.z) + iB.y * kTAU);
  vColor = col * bright;
  vAlpha = fade * energy * gAtt;

#ifdef RIBBON
  vec3 vv = mat3(modelViewMatrix) * v;
  float vl = length(vv.xy);
  vec2 dir = vl > 1e-6 ? vv.xy / vl : vec2(1.0, 0.0);
  float kn = kk / max(uTrailN, 1.0);
  mv.xy += vec2(-dir.y, dir.x) * position.x * offs * mix(1.0, uTaper, kn);
  vT = kn; vSide = position.x;
  vAlpha *= pow(max(1.0 - kn, 0.0), uTrailPow) * uTrailGain;
  gl_Position = projectionMatrix * mv;
#elif defined(POINTS)
  gl_PointSize = max(2.0 * rPx, 1.0);
  gl_Position = projectionMatrix * mv;
#else
  if (uStreak > 0.0) {
#ifdef NEED_VEL
    vec3 vv = mat3(modelViewMatrix) * v;
    float sl = length(vv.xy);
    vec2 dir = sl > 1e-6 ? vv.xy / sl : vec2(1.0, 0.0);
    float len = uStreak * sl;
    float half_ = offs + 0.5 * len;
    mv.xy -= dir * (0.5 * len);
    mv.xy += dir * position.x * half_ + vec2(-dir.y, dir.x) * position.y * offs;
    vUv = vec2(position.x * half_ / offs, position.y);
    vSeg = half_ / offs - 1.0;
    vAlpha *= inversesqrt(half_ / offs);
#endif
  } else {
    mv.xy += position.xy * offs;
  }
  gl_Position = projectionMatrix * mv;
#endif
}
`;

const FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
in vec3 vColor;
in float vAlpha;
in float vSoft;
in float vT;
in float vSide;
in float vSeg;
in float vDepth;

uniform float uOpaque;

out vec4 fragColor;

void main() {
  float prof;
#ifdef RIBBON
  prof = 1.0 - smoothstep(mix(0.6, 0.0, vSoft), 1.0, abs(vSide));
#else
  vec2 q = vUv;
#ifdef POINTS
  q = gl_PointCoord * 2.0 - 1.0;
#endif
  float d = length(vec2(max(abs(q.x) - vSeg, 0.0), q.y));
  if (d > 1.0) discard;
  prof = smoothstep(1.0, mix(0.55, 0.0, vSoft), d);
#endif
  if (uOpaque > 0.5) {
    if (prof < 0.5) discard;
    fragColor = vec4(vColor, 1.0);
    return;
  }
  float a = prof * vAlpha;
  if (a <= 1e-5) discard;
  fragColor = vec4(vColor * a, a);
}
`;

type U = Record<string, THREE.IUniform>;

function makeUniforms(): U {
  const v3 = (x = 0, y = 0, z = 0) => ({ value: new THREE.Vector3(x, y, z) });
  const v2 = (x = 0, y = 0) => ({ value: new THREE.Vector2(x, y) });
  const f = (x = 0) => ({ value: x });
  return {
    uTime: f(), uViewH: f(H), uMode: f(0), uColorMode: f(0),
    uCenter: v3(), uDir: v3(0, 1, 0), uGrav: v3(), uBox: v3(5, 5, 5), uVel: v3(0, -9, 0), uColor: v3(1, 1, 1),
    uShell: v2(0, 1), uLRange: v2(2, 4), uFade: v2(0.1, 0.1), uColorRange: v2(2000, 9000), uBrightRange: v2(1, 1),
    uShellPow: f(1), uCore: f(0.05), uFall: f(0.5), uPow: f(1), uTurb: f(0), uFreq: f(1), uDrift: f(1),
    uSpeed: f(1), uSpread: f(0.2), uThMin: f(0.3), uHelixR: f(0.05), uTurns: f(6), uLonRate: f(0), uDrag: f(0.15),
    uSpin: f(0), uTwinkle: f(0), uTwinkleRate: f(3),
    uIntensity: f(1), uBrightVar: f(0), uSize: f(1), uMinPx: f(0.6), uStreak: f(0),
    uCocScale: f(0), uFocus: f(10), uFocusRange: f(1),
    uTrailDt: f(1 / 30), uTrailN: f(0), uTaper: f(0), uTrailPow: f(1), uTrailGain: f(0.6),
    uOpaque: f(0), uCoreDim: f(1),
  };
}

const lerp3 = (o: THREE.Vector3, v: V3) => o.set(v[0], v[1], v[2]);

export class LargeParticles {
  readonly u: U = makeUniforms();
  private readonly iA: THREE.InstancedBufferAttribute;
  private readonly iB: THREE.InstancedBufferAttribute;
  private readonly aArr: Float32Array;
  private readonly bArr: Float32Array;
  private readonly scene = new THREE.Scene();
  private readonly quadGeo = new THREE.InstancedBufferGeometry();
  private readonly pointGeo = new THREE.InstancedBufferGeometry();
  private ribbonGeo = new THREE.InstancedBufferGeometry();
  private readonly quadMat: THREE.RawShaderMaterial;
  private readonly pointMat: THREE.RawShaderMaterial;
  private readonly ribbonMat: THREE.RawShaderMaterial;
  private readonly quadMesh: THREE.Mesh;
  private readonly pointMesh: THREE.Points;
  private ribbonMesh: THREE.Mesh;
  private count = 0;
  private segments = 0;
  private style: LargeStyle = 'disc';
  private opaque = false;
  private seed: number;
  private size: [number, number] = [0.02, 0.05];
  private life: [number, number] = [3, 6];
  private temp: [number, number] = [0, 1];

  constructor(public readonly capacity = 100000, seed = 7331) {
    this.seed = seed;
    this.aArr = new Float32Array(capacity * 4);
    this.bArr = new Float32Array(capacity * 4);
    this.iA = new THREE.InstancedBufferAttribute(this.aArr, 4).setUsage(THREE.StaticDrawUsage);
    this.iB = new THREE.InstancedBufferAttribute(this.bArr, 4).setUsage(THREE.StaticDrawUsage);

    this.quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    this.pointGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
    this.ribbonGeo = this.buildRibbon(1);
    for (const g of [this.quadGeo, this.pointGeo, this.ribbonGeo]) this.attach(g);

    const mk = (defines: Record<string, string>) => new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: this.u, defines,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
    });
    this.quadMat = mk({});
    this.pointMat = mk({ POINTS: '1' });
    this.ribbonMat = mk({ RIBBON: '1', NEED_VEL: '1' });

    this.quadMesh = new THREE.Mesh(this.quadGeo, this.quadMat);
    this.pointMesh = new THREE.Points(this.pointGeo, this.pointMat);
    this.ribbonMesh = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    for (const m of [this.quadMesh, this.pointMesh, this.ribbonMesh]) { m.frustumCulled = false; this.scene.add(m); }
    this.pointMesh.visible = false;
    this.ribbonMesh.visible = false;
    this.configure({ count: capacity });
  }

  private attach(g: THREE.InstancedBufferGeometry): void {
    g.setAttribute('iA', this.iA);
    g.setAttribute('iB', this.iB);
    g.instanceCount = this.count;
  }

  private buildRibbon(n: number): THREE.InstancedBufferGeometry {
    const g = new THREE.InstancedBufferGeometry();
    const pos = new Float32Array((n + 1) * 2 * 3);
    const idx: number[] = [];
    for (let k = 0; k <= n; k++) {
      pos.set([-1, k, 0, 1, k, 0], k * 6);
      if (k < n) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  private regenerate(): void {
    const rng = mulberry32(this.seed);
    const [s0, s1] = this.size, [l0, l1] = this.life, [t0, t1] = this.temp;
    const a = this.aArr, b = this.bArr;
    for (let i = 0; i < this.capacity; i++) {
      const o = i * 4;
      const rs = rng();
      a[o] = rng();
      a[o + 1] = s0 + (s1 - s0) * rs * rs;
      a[o + 2] = l0 + (l1 - l0) * rng();
      a[o + 3] = t0 + (t1 - t0) * rng();
      b[o] = rng(); b[o + 1] = rng(); b[o + 2] = rng(); b[o + 3] = rng();
    }
    this.iA.needsUpdate = true;
    this.iB.needsUpdate = true;
  }

  /** Setup-time and cheap per-frame parameter changes. Only count/seed/size/life/temperature rebuild the attribute buffers. */
  configure(o: LargeParticleOpts): void {
    const u = this.u;
    const set = (k: string, val: number | V3 | [number, number] | undefined) => {
      if (val === undefined) return;
      const t = u[k]!;
      if (typeof val === 'number') t.value = val;
      else if (val.length === 3) lerp3(t.value as THREE.Vector3, val as V3);
      else (t.value as THREE.Vector2).set(val[0], val[1]);
    };
    let regen = false;
    if (o.count !== undefined) { this.count = Math.min(this.capacity, Math.max(0, o.count | 0)); regen = regen || false; }
    if (o.seed !== undefined) { this.seed = o.seed; regen = true; }
    if (o.size) { this.size = o.size; regen = true; }
    if (o.life) { this.life = o.life; regen = true; }
    if (o.temperature) { this.temp = o.temperature; regen = true; }
    if (regen || o.count !== undefined && this.iA.version === 0) this.regenerate();
    if (o.mode) u.uMode!.value = MODE_ID[o.mode];
    if (o.style) {
      this.style = o.style;
      this.quadMat.defines = o.style === 'streak' ? { NEED_VEL: '1' } : {};
      this.quadMat.needsUpdate = true;
    }
    if (o.opaque !== undefined) {
      this.opaque = o.opaque;
      u.uOpaque!.value = o.opaque ? 1 : 0;
      for (const m of [this.quadMat, this.pointMat, this.ribbonMat]) {
        m.depthWrite = o.opaque;
        m.blending = o.opaque ? THREE.NoBlending : THREE.CustomBlending;
        m.transparent = !o.opaque;
        m.needsUpdate = true;
      }
    }
    if (o.color) {
      if (o.color.mode) u.uColorMode!.value = COLOR_ID[o.color.mode];
      set('uColor', o.color.rgb);
      set('uColorRange', o.color.range);
    }
    set('uIntensity', o.intensity);
    set('uBrightVar', o.brightnessVariance);
    set('uFade', o.fade);
    set('uMinPx', o.minPx);
    set('uSize', o.sizeScale);
    set('uStreak', o.streak);
    if (o.dof) { set('uCocScale', o.dof.cocScale); set('uFocus', o.dof.focus); set('uFocusRange', o.dof.range); }
    if (o.turbulence) { set('uTurb', o.turbulence.amp); set('uFreq', o.turbulence.freq); set('uDrift', o.turbulence.drift); }
    if (o.trail) {
      const tr = o.trail;
      if (tr.segments !== undefined) {
        const n = Math.min(MAX_TRAIL, Math.max(0, tr.segments | 0));
        if (n !== this.segments) {
          this.segments = n;
          if (n > 0) {
            this.scene.remove(this.ribbonMesh);
            this.ribbonGeo.dispose();
            this.ribbonGeo = this.buildRibbon(n);
            this.attach(this.ribbonGeo);
            this.ribbonMesh = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
            this.ribbonMesh.frustumCulled = false;
            this.scene.add(this.ribbonMesh);
          }
        }
        u.uTrailN!.value = n;
      }
      set('uTrailDt', tr.dt); set('uTaper', tr.taper); set('uTrailPow', tr.power); set('uTrailGain', tr.gain);
    }
    if (o.free) { const f = o.free; set('uCenter', f.center); set('uShell', f.shell); set('uDir', f.dir); set('uSpeed', f.speed); set('uSpread', f.spread); set('uGrav', f.gravity); }
    if (o.press) { const p = o.press; set('uCenter', p.center); set('uShell', p.shell); set('uShellPow', p.shellPow); set('uCore', p.core); set('uFall', p.falloff); set('uPow', p.power); set('uCoreDim', p.coreDim); }
    if (o.spiral) { const s = o.spiral; set('uCenter', s.center); set('uLRange', s.L); set('uThMin', s.thetaMin); set('uHelixR', s.helixRadius); set('uTurns', s.turns); set('uLonRate', s.lonRate); }
    if (o.fall) { const f = o.fall; set('uCenter', f.center); set('uBox', f.box); set('uVel', f.velocity); set('uDrag', f.drag); }
    if (o.star) { const s = o.star; set('uCenter', s.center); set('uShell', s.shell); set('uShellPow', s.shellPow); set('uSpin', s.spin); set('uTwinkle', s.twinkle); set('uTwinkleRate', s.twinkleRate); }

    for (const g of [this.quadGeo, this.pointGeo, this.ribbonGeo]) g.instanceCount = this.count;
  }

  get particleCount(): number { return this.count; }
  get trailSegments(): number { return this.segments; }

  /** Renders into target (null = canvas) at time t. Only uniforms change per frame. */
  render(renderer: THREE.WebGLRenderer, cam: THREE.Camera, target: THREE.WebGLRenderTarget | null, t: number): void {
    if (this.count === 0) return;
    this.u.uTime!.value = t;
    this.u.uViewH!.value = target ? target.height : H;
    const trails = this.segments > 0 && !this.opaque;
    this.quadMesh.visible = this.style !== 'points';
    this.pointMesh.visible = this.style === 'points';
    this.ribbonMesh.visible = trails;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, cam);
    renderer.autoClear = ac;
    renderer.resetState();
  }

  dispose(): void {
    this.quadGeo.dispose();
    this.pointGeo.dispose();
    this.ribbonGeo.dispose();
    this.quadMat.dispose();
    this.pointMat.dispose();
    this.ribbonMat.dispose();
  }
}

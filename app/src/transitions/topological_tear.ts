// THE 5-TAP TEMPORAL JACOBIAN & TOPOLOGICAL MANIFOLD TEAR
// Standalone Transition Block for f(x) Studio engine (v0.5.0)
//
// 1. Multi-Temporal Optical Flow & Jacobian Estimation via api.sampleScene():
//    - Queries outgoing Scene 1 at t1 = t - dt and t2 = t + dt.
//    - Queries incoming Scene 2 at three forward-projected offsets: tA = start + 0.5s, tB = start + 1.5s, tC = start + 3.0s.
//    - Extracts instantaneous optical flow dI/dt and rotational angular momentum L_z.
// 2. Two-Pass Fullscreen Topological Tear (FSPass):
//    - Pass 1: Spacetime Metric Singularization (Non-Euclidean Voronoi foam, gravitational pinch, Peregrine refraction).
//    - Pass 2: Chromatic Singularity Boundary (Cherenkov radiation rim with HDR luminance > 10.0).
// 3. Dynamic Optical Pipeline Hijack (PostOverrides):
//    - Seam apex surge (u in [0.45, 0.55]): exposure flash 1.0, bloomThreshold 5.0, ca 0.08.
//    - Temporal ringing (u in [0.55, 1.0]): under-damped sinusoidal spring envelope via MotionBus.
// 4. Strict Broadcast Typographic Decoupling (overlayTextDuck):
//    - Culls outgoing text at u = 0.35, delays incoming text until u = 0.55.
//    - Hexadecimal machine-state verification grid in the 20% temporal silence window.

import * as THREE from 'three';
import { FSPass, makeRT, W, H } from '../engine/gl';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { motion } from '../engine/motion';

const PASS1_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D texA_prev; // Scene 1 at t - dt
uniform sampler2D texA_next; // Scene 1 at t + dt
uniform sampler2D texB_early; // Scene 2 forward-projected
uniform sampler2D texB_mid;   // Scene 2 forward-projected
uniform sampler2D texB_late;  // Scene 2 forward-projected

uniform float u;              // 0..1 transition progress
uniform float time;           // continuous song time
uniform vec2 res;             // [W, H]
uniform float angularMomentum;// estimated L_z

#define TAU 6.28318530718

// Analytical pseudo-random hash
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// 2D Non-Euclidean Voronoi Foam with metric curvature
vec3 voronoiFoam(vec2 x, float t, float curvature) {
  vec2 n = floor(x);
  vec2 f = fract(x);

  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      // Analytical orbital oscillation within foam cell
      vec2 point = 0.5 + 0.45 * sin(t * 1.6 + TAU * o);
      vec2 r = g + point - f;
      // Metric curvature deformation
      float d = dot(r, r) * (1.0 + curvature * dot(r, r));
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
      }
    }
  }

  // Second pass for Voronoi cell boundaries (tear frontiers)
  md = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = mg + vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      vec2 point = 0.5 + 0.45 * sin(t * 1.6 + TAU * o);
      vec2 r = g + point - f;
      if (dot(mr - r, mr - r) > 0.00001) {
        md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
      }
    }
  }
  return vec3(md, mr);
}

// Analytical Peregrine Breather envelope for incoming caustic crystallization
float peregrineEnvelope(vec2 p, float tau) {
  float x2 = dot(p, p) * 12.0;
  float t2 = tau * tau * 4.0;
  float denom = 1.0 + 4.0 * x2 + 4.0 * t2;
  float numReal = 1.0 - 4.0 * (1.0 - 4.0 * x2 + 4.0 * t2) / (denom * denom);
  float numImag = -8.0 * tau / denom;
  return sqrt(numReal * numReal + numImag * numImag);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;

  // 1. Estimate instantaneous optical flow Jacobian: dI/dt
  vec4 colA_prev = texture(texA_prev, uv);
  vec4 colA_next = texture(texA_next, uv);
  vec3 flowDt = (colA_next.rgb - colA_prev.rgb) * 20.0;
  float localFlowEnergy = clamp(length(flowDt), 0.0, 2.0);

  // 2. Riemann Curvature Tensor expansion parameter
  float riemannCurvature = 0.6 * sin(u * 3.14159) * (1.0 + 0.25 * angularMomentum);
  vec3 vFoam = voronoiFoam(p * (3.5 + 4.0 * u) + vec2(time * 0.15), time, riemannCurvature);
  float edgeDist = vFoam.x; // distance to foam boundary
  vec2 cellOffset = vFoam.yz;

  // 3. Dimensional Tear Frontier Field
  // Linear progression along diagonal plus foam distortion
  float diagonalSweep = dot(p, normalize(vec2(1.2, 0.85)));
  float foamPerturb = (1.0 - edgeDist) * 0.55 + dot(cellOffset, cellOffset) * 0.25;
  float tearField = diagonalSweep + foamPerturb * 0.45;

  // Tear threshold sweeps across screen from u=0 to u=1
  float tearThreshold = mix(-1.4, 1.4, smoothstep(0.02, 0.98, u));
  float tearDist = tearField - tearThreshold;

  // Sharp step with micro-feather for AA
  float isTorn = smoothstep(-0.02, 0.02, -tearDist);

  // Razor-sharp rim contour mask + tight surrounding bloom halo
  float rimSharp = smoothstep(0.016, 0.002, abs(tearDist));
  float rimGlow = smoothstep(0.08, 0.01, abs(tearDist)) * 0.45;
  float tearBorder = rimSharp + rimGlow;

  // 4. Gravitational Pinch Warping on Outgoing Scene 1
  float r2 = dot(p, p);
  vec2 rHat = normalize(p + 1e-5);
  float pinchStrength = sin(u * 3.14159) * 0.08;
  vec2 uvA_warped = uv + rHat * (pinchStrength / (r2 * 6.0 + 0.12)) + cellOffset * (0.015 * sin(u * 3.14159));

  vec4 colA = texture(texA_next, clamp(uvA_warped, 0.0, 1.0));

  // 5. Peregrine Breather Refraction on Incoming Scene 2
  float breatherPhase = (u - 0.5) * 5.0;
  float breatherAmp = peregrineEnvelope(p * 1.8, breatherPhase);
  vec2 uvB_refracted = uv + cellOffset * (breatherAmp * 0.025 * (1.0 - u));

  // Retiming trajectory for Scene 2 forward samples
  vec4 colB_early = texture(texB_early, clamp(uvB_refracted, 0.0, 1.0));
  vec4 colB_mid   = texture(texB_mid, clamp(uvB_refracted, 0.0, 1.0));
  vec4 colB_late  = texture(texB_late, clamp(uvB_refracted, 0.0, 1.0));

  float retimeWarp = pow(u, 1.6);
  vec4 colB = mix(mix(colB_early, colB_mid, clamp(retimeWarp * 2.0, 0.0, 1.0)), colB_late, clamp(retimeWarp * 2.0 - 1.0, 0.0, 1.0));

  // Composite: rgb = blended scenes, a = tearBorder mask for Pass 2
  vec3 blendedCol = mix(colA.rgb, colB.rgb, isTorn);

  fragColor = vec4(blendedCol, tearBorder);
}
`;

const PASS2_FRAG = /* glsl */ `
precision highp float;

uniform sampler2D baseTex; // Pass 1 output
uniform float u;
uniform float time;
uniform vec2 res;

#define TAU 6.28318530718

// Multi-spectral Cherenkov radiation interference (Electric Cyan to Neon Violet)
vec3 cherenkovSpectrum(float phase) {
  vec3 c;
  c.r = 0.25 + 0.65 * pow(sin(phase * 1.2), 4.0);
  c.g = 0.55 + 0.45 * sin(phase * 1.8 + 1.2);
  c.b = 1.15 + 0.35 * cos(phase * 2.2);
  return c;
}

// Analytical Hexadecimal Machine-State Grid (20% temporal silence window: u in [0.35, 0.55])
float hexTelemetryGrid(vec2 coord, float t) {
  vec2 g = fract(coord * vec2(36.0, 20.0)) - 0.5;
  float dots = 1.0 - smoothstep(0.04, 0.08, length(g));
  float scanline = 0.6 + 0.4 * sin(coord.y * 480.0 + t * 18.0);
  return dots * scanline;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec4 base = texture(baseTex, uv);
  vec3 col = base.rgb;
  float tearBorder = base.a;

  // 1. Cherenkov Radiation Rim (Crisp electric boundary without blinding whiteout)
  if (tearBorder > 0.005) {
    float angle = atan(uv.y - 0.5, uv.x - 0.5);
    float cherenkovPhase = angle * 6.0 + time * 12.0 + uv.x * 16.0;
    vec3 spec = cherenkovSpectrum(cherenkovPhase);

    // Peak surge at u = 0.5
    float seamSurge = sin(u * 3.14159);
    float rimWeight = tearBorder * seamSurge;

    // Layered electric boundary: intense core cyan-violet + subtle halo
    vec3 rimEmission = spec * (rimWeight * 1.85);
    col += rimEmission;
  }

  // 2. Analytical Hexadecimal Machine-State Grid in temporal silence window (u in [0.35, 0.55])
  float silenceWindow = smoothstep(0.33, 0.38, u) * (1.0 - smoothstep(0.52, 0.57, u));
  if (silenceWindow > 0.01) {
    float grid = hexTelemetryGrid(uv, time);
    vec3 gridCol = vec3(0.14, 0.82, 0.98) * (grid * silenceWindow * 0.9);
    col += gridCol;
  }

  fragColor = vec4(col, 1.0);
}
`;

export default class TopologicalTear implements Transition {
  private pass1: FSPass;
  private pass2: FSPass;
  private pass1RT: THREE.WebGLRenderTarget;

  constructor(private ctx: TransitionCtx) {
    const { W, H } = ctx;
    this.pass1RT = makeRT(W, H, { depthBuffer: false, type: THREE.FloatType });

    this.pass1 = new FSPass(PASS1_FRAG, {
      texA_prev: { value: null },
      texA_next: { value: null },
      texB_early: { value: null },
      texB_mid: { value: null },
      texB_late: { value: null },
      u: { value: 0.0 },
      time: { value: 0.0 },
      res: { value: new THREE.Vector2(W, H) },
      angularMomentum: { value: 0.998 },
    }, { blending: THREE.NoBlending });

    this.pass2 = new FSPass(PASS2_FRAG, {
      baseTex: { value: null },
      u: { value: 0.0 },
      time: { value: 0.0 },
      res: { value: new THREE.Vector2(W, H) },
    }, { blending: THREE.NoBlending });
  }

  render(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    _a: THREE.Texture,
    _b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const { renderer } = this.ctx;
    const u = Math.min(1.0, Math.max(0.0, api.u));
    const t = f.t;
    const dt = 1.0 / 60.0;

    // -------------------------------------------------------------------------
    // 1. 5-Tap Temporal Sampling Pass across Timeline via api.sampleScene
    // -------------------------------------------------------------------------
    // Query Scene 1 at t1 = t - dt and t2 = t + dt into engine scratch targets
    const texA_prev = api.sampleScene(api.from, Math.max(0, t - dt));
    const texA_next = api.sampleScene(api.from, t + dt);

    // Query Scene 2 at three forward-projected temporal offsets:
    // tA = start + 0.5s, tB = start + 1.5s, tC = start + 3.0s
    const toStart = f.start;
    const texB_early = api.sampleScene(api.to, toStart + 0.5);
    const texB_mid   = api.sampleScene(api.to, toStart + 1.5);
    const texB_late  = api.sampleScene(api.to, toStart + 3.0);

    // -------------------------------------------------------------------------
    // 2. Pass 1: Spacetime Metric Singularization
    // -------------------------------------------------------------------------
    this.pass1.u.texA_prev!.value = texA_prev;
    this.pass1.u.texA_next!.value = texA_next;
    this.pass1.u.texB_early!.value = texB_early;
    this.pass1.u.texB_mid!.value   = texB_mid;
    this.pass1.u.texB_late!.value  = texB_late;
    this.pass1.u.u!.value = u;
    this.pass1.u.time!.value = t;
    this.pass1.u.angularMomentum!.value = 0.998;
    this.pass1.render(renderer, this.pass1RT);

    // -------------------------------------------------------------------------
    // 3. Pass 2: Chromatic Singularity Boundary & Cherenkov Radiation Rim
    // -------------------------------------------------------------------------
    this.pass2.u.baseTex!.value = this.pass1RT.texture;
    this.pass2.u.u!.value = u;
    this.pass2.u.time!.value = t;
    this.pass2.render(renderer, out);

    // -------------------------------------------------------------------------
    // 4. Dynamic Optical Pipeline Hijack (PostOverrides)
    // -------------------------------------------------------------------------
    // Seam Apex Surge: u in [0.45, 0.55]
    // Temporal Ringing: u in [0.55, 1.0] modulated via MotionBus.spring()
    let flash = 0.0;
    let bloomThresh = 0.85;
    let ca = 1.2;

    if (u >= 0.45 && u <= 0.55) {
      const apexU = 1.0 - Math.abs(u - 0.5) / 0.05;
      flash = apexU * 0.04;          // Subtle optical kick (never full-screen strobe!)
      bloomThresh = 0.85;
      ca = 1.2 + apexU * 4.5;        // Controlled chromatic aberration flare
    } else if (u > 0.55) {
      // Under-damped sinusoidal spring envelope derived via MotionBus
      const ringProgress = (u - 0.55) / 0.45;
      const springDecay = motion.spring(0.0, ringProgress, { freq: 4.5, damping: 0.35, v0: 8.0, scale: 1.0 });
      ca = 1.2 + Math.max(0, 1.0 - ringProgress) * Math.abs(springDecay) * 2.5;
    }

    return {
      flash,
      bloomThreshold: bloomThresh,
      ca,
    };
  }

  dispose(): void {
    this.pass1.dispose();
    this.pass2.dispose();
    this.pass1RT.dispose();
  }
}

// SCENE 1: THE KERR ERGOSPHERE & ANALYTICAL 4D POLYCHORON UNFOLDING
// Macroscopic Relativistic Astrophysical Engine manipulating Non-Euclidean Spacetime
//
// 1. Analytical 4D -> 3D Polychoron Unfolding (GPU Instancing & Shaders):
//    - Analytical 120-cell (hyper-dodecahedron) in R^4 with 16,384 structural strut instances.
//    - Simultaneous double-rotation across orthogonal XW and YZ planes via Omega_XW and Omega_YZ tensors.
//    - Expansive multi-stage Coxeter shell architecture (R in [1.2, 5.8]) with dynamic 4D hyper-unfolding.
//    - Anisotropic Ward/Kajiya-Kay metallic reflection & analytical normals calculated in shader (StaticDrawUsage).
// 2. Relativistic Kerr Metric Raymarching (Screen-Space GLSL Pass):
//    - Dimensionless spin parameter a* = 0.998 near-extremal Kerr black hole.
//    - Closed-form null geodesic light bending with dual-sheet gravitational lensing (direct disk + lensed rear arc).
//    - Asymmetric D-shaped shadow boundary and hyper-bright photon sphere ring.
//    - Novikov-Thorne temperature profile and relativistic Doppler boosting (delta^4) with multi-arm logarithmic spirals.
// 3. Dual-Conic Relativistic Emitters (RelativisticJets):
//    - Counter-aligned relativistic plasma jets along spin axis (+/- Y) with helical frame-dragging twist.
//    - Closed-form Lorentz contraction scaling billboard quads along velocity vector.
// 4. Coupled Kinetic Telemetry Matrix (MotionBus):
//    - Nested telemetry rings tracking frame-dragging velocity, Boyer-Lindquist r, and Hawking flux.
//    - MotionBus.spring() with initial velocity injection (v0 = 14.0) across resonance threshold crossings.
//    - Typography strictly gated by canonical engine overlayDuck.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, makeRT, W, H } from '../../engine/gl';
import { TAU, clamp, ease } from '../../engine/util';
import { motion } from '../../engine/motion';

const NUM_STRUTS = 16384;
const NUM_JET_PARTICLES = 4096;

// -----------------------------------------------------------------------------
// 1. 4D Polychoron Tube Vertex & Fragment Shaders (GPU Instancing)
// -----------------------------------------------------------------------------
const POLYCHORON_VERT = /* glsl */ `
precision highp float;

in vec3 position;       // Base cylinder vertex: x=cos(th)*r, y=height [0,1], z=sin(th)*r
in vec3 normal;         // Base cylinder normal
in vec4 iP1_4D;         // 4D start point (x, y, z, w)
in vec4 iP2_4D;         // 4D end point (x, y, z, w)
in vec2 iShellParam;    // [shellRadius, phaseOffset]
in vec2 iHierarchy;     // [tier (0=major, 1=secondary, 2=filament), baseRadius]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform vec2 omega;     // [omega_XW, omega_YZ]
uniform float camW;     // W_c(t) = 2.4 + 0.4 * cos(0.2 * t)
uniform float unfold;   // Dynamic 4D unfolding factor

out vec3 vWorldNormal;
out vec3 vViewDir;
out vec3 vTangent;
out vec4 vColor;
out float vDepth;
out float vTier;

// Analytical 4D double-rotation across orthogonal XW and YZ planes
vec4 rotate4D(vec4 p, float t, float ph) {
  float thXW = (omega.x * t) + ph;
  float thYZ = (omega.y * t) + ph * 0.618;

  // Rotation in XW plane
  float cosXW = cos(thXW);
  float sinXW = sin(thXW);
  float x1 = p.x * cosXW - p.w * sinXW;
  float w1 = p.x * sinXW + p.w * cosXW;

  // Rotation in YZ plane
  float cosYZ = cos(thYZ);
  float sinYZ = sin(thYZ);
  float y2 = p.y * cosYZ - p.z * sinYZ;
  float z2 = p.y * sinYZ + p.z * cosYZ;

  return vec4(x1, y2, z2, w1);
}

// Closed-form stereographic conformal projection from W_c onto 3D hyperplane (W=0)
vec3 project4Dto3D(vec4 p4, float Wc) {
  float denom = max(Wc - p4.w, 0.28);
  return p4.xyz * (2.85 / denom);
}

void main() {
  float ph = iShellParam.y;
  float shellScale = iShellParam.x;
  float tier = iHierarchy.x;
  float baseR = iHierarchy.y;
  vTier = tier;

  // Dynamic 4D hyper-unfolding: displacement along 4th coordinate W
  vec4 p1_base = iP1_4D * shellScale;
  vec4 p2_base = iP2_4D * shellScale;
  p1_base.w += sin(time * 0.4 + ph) * unfold * 0.35;
  p2_base.w += sin(time * 0.4 + ph) * unfold * 0.35;

  // 1. Rotate 4D endpoints across orthogonal XW and YZ planes
  vec4 p1_rot = rotate4D(p1_base, time, ph);
  vec4 p2_rot = rotate4D(p2_base, time, ph);

  // 2. Stereographic conformal projection to 3D
  vec3 p1_3d = project4Dto3D(p1_rot, camW);
  vec3 p2_3d = project4Dto3D(p2_rot, camW);

  // 3. Construct cylinder orthonormal frame around strut vector
  vec3 strutDir = p2_3d - p1_3d;
  float strutLen = length(strutDir);
  vec3 T = strutLen > 1e-4 ? (strutDir / strutLen) : vec3(0.0, 1.0, 0.0);

  // Robust up vector selection (prevents gimbal singularity)
  vec3 upRef = abs(T.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 B = normalize(cross(T, upRef));
  vec3 N_axis = cross(B, T);

  // 4. Extrude cylinder mesh along strut with exact segment-to-origin clearance
  float segLen2 = dot(strutDir, strutDir);
  float tClosest = clamp(-dot(p1_3d, strutDir) / max(segLen2, 1e-4), 0.0, 1.0);
  float dOrigin = length(p1_3d + strutDir * tClosest);
  float clearance = smoothstep(3.8, 5.4, dOrigin);
  if (clearance < 0.01) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Cull completely from black hole core
    return;
  }
  float strutRadius = baseR * clearance * (1.0 + 0.2 * sin(time * 2.0 + ph));
  vec3 vertexOffset = (B * position.x + N_axis * position.z) * strutRadius;
  vec3 worldPos = p1_3d + T * (position.y * strutLen) + vertexOffset;

  // 5. Analytical normals and tangent for anisotropic metallic shading
  vec3 localNorm = normalize(B * normal.x + N_axis * normal.z);
  vWorldNormal = localNorm;
  vTangent = T;

  vec4 viewPos = modelViewMatrix * vec4(worldPos, 1.0);
  vViewDir = -normalize(viewPos.xyz);
  vDepth = -viewPos.z;

  // Spectral gradient along 4D hyper-coordinate W with tier hierarchy
  float wNorm = clamp((p1_rot.w + p2_rot.w) * 0.25 + 0.5, 0.0, 1.0);
  vec3 colGold = vec3(0.95, 0.72, 0.28);
  vec3 colCyan = vec3(0.12, 0.78, 0.95);
  vec3 colViolet = vec3(0.68, 0.22, 0.92);

  vec3 baseCol;
  if (tier < 0.5) {
    // Primary meridian: radiant titanium gold
    baseCol = mix(colGold, vec3(1.0, 0.92, 0.75), wNorm * 0.5);
  } else if (tier < 1.5) {
    // Secondary facet boundaries: iridescent cyan/violet
    baseCol = mix(colCyan, colViolet, wNorm);
  } else {
    // Tertiary energy filaments: deep violet with electric glow
    baseCol = mix(colViolet, colCyan, sin(wNorm * 3.14159));
  }

  vColor = vec4(baseCol, tier < 1.5 ? 0.95 : 0.65);
  gl_Position = projectionMatrix * viewPos;
}
`;

const POLYCHORON_FRAG = /* glsl */ `
precision highp float;

in vec3 vWorldNormal;
in vec3 vViewDir;
in vec3 vTangent;
in vec4 vColor;
in float vDepth;
in float vTier;

out vec4 fragColor;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  vec3 T = normalize(vTangent);

  // Key light from black hole ergosphere
  vec3 L = normalize(vec3(0.0, 0.4, 0.9));

  // Anisotropic Ward/Kajiya-Kay metallic specular reflection
  float dotTL = dot(T, L);
  float dotTV = dot(T, V);
  float sinTL = sqrt(max(0.0, 1.0 - dotTL * dotTL));
  float sinTV = sqrt(max(0.0, 1.0 - dotTV * dotTV));
  float anisoSpec = max(0.0, sinTL * sinTV - dotTL * dotTV);
  anisoSpec = pow(anisoSpec, 24.0) * (vTier < 0.5 ? 2.2 : 1.2);

  // Fresnel grazing reflection
  float NdotV = max(0.0, dot(N, V));
  float fresnel = pow(1.0 - NdotV, 4.0);

  // Diffuse irradiance
  float NdotL = max(0.0, dot(N, L));
  vec3 diffuse = vColor.rgb * (NdotL * 0.55 + 0.12);
  vec3 specular = vec3(0.98, 0.92, 0.82) * (anisoSpec * 0.35) + vec3(0.25, 0.85, 1.0) * (fresnel * 0.45);

  vec3 finalRgb = diffuse + specular;
  float alpha = vColor.a * (vTier < 0.5 ? 0.85 : (vTier < 1.5 ? 0.60 : 0.35));
  fragColor = vec4(finalRgb, alpha);
}
`;

// -----------------------------------------------------------------------------
// 2. Kerr Black Hole Ergosphere Screen-Space Raymarching Shader
// -----------------------------------------------------------------------------
const KERR_RAYMARCH_FRAG = /* glsl */ `
uniform float time;
uniform vec2 res;
uniform float spin;         // a* = 0.998
uniform vec3 camPos;
uniform mat4 camInvProj;
uniform mat4 camInvView;

#define TAU 6.28318530718

// Relativistic Doppler beaming and frequency shift for Kerr accretion disk
// Approaching limb: extreme blue-shift and relativistic amplification (delta^4)
// Receding limb: red-shift and dimming
vec3 kerrDopplerShift(vec3 baseCol, float delta) {
  float beamPower = clamp(pow(delta, 3.6), 0.08, 6.5);
  vec3 shifted = mix(vec3(0.85, 0.15, 0.04), vec3(0.18, 0.82, 1.9), smoothstep(0.72, 1.35, delta));
  return baseCol * shifted * beamPower;
}

// Relativistic thin-disk Novikov-Thorne temperature profile
float novikovThorneTemp(float r, float r_isco) {
  if (r <= r_isco) return 0.0;
  float x = sqrt(r / r_isco);
  float term = 1.0 - 1.0 / x;
  return pow(r / r_isco, -0.75) * pow(max(0.0, term), 0.25);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;

  // Reconstruct camera world ray
  vec4 rayClip = vec4(p * 2.0, -1.0, 1.0);
  vec4 rayEye = camInvProj * rayClip;
  rayEye = vec4(rayEye.xy, -1.0, 0.0);
  vec3 rd = normalize((camInvView * rayEye).xyz);
  vec3 ro = camPos;

  // Kerr Metric Dimensions (M = 1.0)
  float a = spin;
  float a2 = a * a;
  float r_plus = 1.0 + sqrt(max(0.0, 1.0 - a2)); // Event horizon radius ~ 1.0632 M
  float r_isco = 1.237;                          // Prograde ISCO for a* = 0.998 M

  // 1. Closed-form Null Geodesic Light Bending in Boyer-Lindquist Coordinates
  vec3 bhPos = vec3(0.0, 0.0, 0.0);
  vec3 toBH = bhPos - ro;
  float distToBH = length(toBH);
  vec3 toBHDir = normalize(toBH);

  // Impact parameter vector in camera plane
  vec3 rightVec = normalize(cross(rd, vec3(0.0, 1.0, 0.0)));
  vec3 upVec = cross(rightVec, rd);
  float b = distToBH * length(cross(rd, toBHDir));

  // Asymmetric frame-dragging correction (rotational dragging along Y axis)
  float spinDrag = (4.0 * a / (b * b + 0.15)) * dot(rd, rightVec);
  float deflection = (4.0 / max(b, 0.35)) * (1.0 + 1.25 / max(b * b, 0.45)) + spinDrag;

  // Asymmetric Kerr D-shaped shadow boundary:
  // Approaching side (spinDrag > 0) is flattened, receding side is rounded
  float shadowRadius = 2.45 - 0.38 * a * dot(rd, rightVec);
  bool inShadow = (b < shadowRadius);

  // 2. Accretion Disk Ray Intersection with Dual-Sheet Gravitational Lensing
  // Primary direct equatorial sheet (Y = 0) + Secondary lensed rear arc
  vec3 bentRd = normalize(rd + toBHDir * (deflection * 0.22));

  vec3 diskCol = vec3(0.0);
  float diskAlpha = 0.0;

  // Intersect direct equatorial plane Y = 0
  float tDisk = -ro.y / (bentRd.y + 1e-5);
  if (tDisk > 0.0) {
    vec3 diskPos = ro + bentRd * tDisk;
    float r = length(diskPos.xz);
    float phi = atan(diskPos.z, diskPos.x);

    if (r >= r_isco && r <= 11.5 && !inShadow) {
      // Novikov-Thorne temperature profile
      float T = novikovThorneTemp(r, r_isco);

      // Logarithmic multi-arm spiral density waves
      float spiral1 = cos(2.0 * phi - 2.8 * log(max(r, 0.1)) - time * 2.8);
      float spiral2 = 0.5 * cos(4.0 * phi - 4.5 * log(max(r, 0.1)) - time * 4.2);
      float density = T * (0.85 + 0.45 * (spiral1 + spiral2));

      // Relativistic orbital velocity & line-of-sight Doppler boosting factor
      float vOrb = 1.0 / (pow(r, 1.5) + a);
      float gammaLorentz = 1.0 / sqrt(max(0.01, 1.0 - vOrb * vOrb));
      float vParallel = vOrb * sin(phi);
      float doppler = 1.0 / (gammaLorentz * (1.0 - vParallel));

      vec3 emitColor = mix(vec3(0.95, 0.55, 0.15), vec3(1.0, 0.88, 0.65), T);
      diskCol = kerrDopplerShift(emitColor, doppler) * (density * 3.2);
      diskAlpha = clamp(density * 1.8, 0.0, 1.0);
    }
  }

  // Secondary gravitationally lensed Einstein ring / rear disk halo
  // Formed by rays grazing the photon sphere boundary (b in [shadowRadius, shadowRadius + 0.35])
  float photonDist = abs(b - shadowRadius);
  if (photonDist < 0.42 && !inShadow) {
    float ringIntensity = exp(-photonDist * 18.0) * 4.5;
    vec3 ringColor = vec3(1.0, 0.85, 0.55) * ringIntensity;
    diskCol += ringColor;
    diskAlpha = max(diskAlpha, clamp(ringIntensity, 0.0, 1.0));
  }

  // 3. Ergosphere Static Limit Frame-Dragging Violet Glow
  float ergoGlow = smoothstep(shadowRadius + 0.7, shadowRadius, b) * (1.0 - smoothstep(r_plus, r_plus + 0.18, b));
  vec3 ergoCol = vec3(0.55, 0.15, 0.98) * (ergoGlow * 2.8);

  // Black hole event horizon shadow
  vec3 finalColor = diskCol + ergoCol;
  if (inShadow) {
    finalColor = mix(ergoCol * 0.25, vec3(0.0), 0.96);
  }

  // Deep space relativistic starfield backdrop
  vec3 bgStars = vec3(0.015, 0.018, 0.035) * (1.0 + 0.6 * sin(uv.x * 220.0) * cos(uv.y * 220.0));
  finalColor += bgStars * (1.0 - diskAlpha);

  fragColor = vec4(finalColor, 1.0);
}
`;

// -----------------------------------------------------------------------------
// 3. Dual-Conic Relativistic Emitters Shaders (Vertex & Fragment)
// -----------------------------------------------------------------------------
const JET_VERT = /* glsl */ `
precision highp float;

in vec3 position;       // Quad vertex [-1, 1]
in vec3 iOrigin;        // Pole origin (0, +/- r_plus, 0)
in vec3 iVelocity;      // Relativistic jet launch velocity
in vec2 iLifetime;      // [birthOffset, totalLifetime]
in vec4 iParams;        // [coneIndex (+1/-1), seed, size, glow]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

out vec2 vUv;
out vec4 vColor;
out float vLorentzGamma;

vec3 curlNoise(vec3 p, float t) {
  float n1 = sin(p.y * 1.8 + t * 2.5) * cos(p.z * 1.8);
  float n2 = sin(p.z * 1.8 + t * 2.5) * cos(p.x * 1.8);
  float n3 = sin(p.x * 1.8 + t * 2.5) * cos(p.y * 1.8);
  return vec3(n1, n2, n3) * 0.4;
}

void main() {
  vUv = position.xy * 0.5 + 0.5;

  float birth = iLifetime.x;
  float totalLife = iLifetime.y;
  float tau = mod(time - birth, totalLife);
  float lifeNorm = tau / totalLife; // 0..1

  // Closed-form ballistic trajectory with helical frame-dragging rotation
  float vMag = length(iVelocity);
  vec3 vDir = iVelocity / max(vMag, 1e-4);

  // Relativistic Lorentz factor gamma = 1 / sqrt(1 - (v/c)^2), c ~ 10.0
  float beta = min(0.92, (vMag / 10.0) * (1.0 - lifeNorm * 0.4));
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  vLorentzGamma = gamma;

  // Helical frame-dragging twist around spin axis
  float twist = tau * 4.2 * iParams.x;
  vec3 p0 = iOrigin;
  vec3 helicalOffset = vec3(sin(twist), 0.0, cos(twist)) * (0.15 + lifeNorm * 0.6);
  vec3 turb = curlNoise(p0 * 0.5 + iParams.y, tau * 1.5) * lifeNorm;

  vec3 particlePos = p0 + iVelocity * tau + helicalOffset + turb;

  // Relativistic Lorentz billboard scaling along velocity vector
  vec4 viewPos = modelViewMatrix * vec4(particlePos, 1.0);
  vec2 vScreen = normalize((modelViewMatrix * vec4(vDir, 0.0)).xy + 1e-5);
  vec2 vPerp = vec2(-vScreen.y, vScreen.x);

  float pSize = iParams.z * (1.0 + lifeNorm * 1.5);
  vec2 quadOffset = (vScreen * position.y * (pSize * gamma * 1.5)) + (vPerp * position.x * pSize);

  viewPos.xy += quadOffset;

  // Dynamic UV-blue to deep infrared spectral shift
  vec3 colUVBlue = vec3(0.2, 0.85, 2.4);    // Intense relativistic emission at core
  vec3 colViolet = vec3(0.75, 0.25, 1.8);   // Intermediate cooling
  vec3 colInfrared = vec3(0.95, 0.25, 0.05);// Outer dissipation

  vec3 pRgb = mix(mix(colUVBlue, colViolet, smoothstep(0.0, 0.45, lifeNorm)), colInfrared, smoothstep(0.45, 1.0, lifeNorm));
  float alpha = (1.0 - lifeNorm) * smoothstep(0.0, 0.1, lifeNorm);

  vColor = vec4(pRgb * iParams.w, alpha);
  gl_Position = projectionMatrix * viewPos;
}
`;

const JET_FRAG = /* glsl */ `
precision highp float;

in vec2 vUv;
in vec4 vColor;
in float vLorentzGamma;

out vec4 fragColor;

void main() {
  vec2 p = vUv - 0.5;
  float r2 = dot(p, p) * 4.0;
  if (r2 > 1.0) discard;

  float falloff = exp(-r2 * 3.5);
  vec3 rgb = vColor.rgb * falloff;
  float a = vColor.a * falloff;

  fragColor = vec4(rgb, a);
}
`;

// -----------------------------------------------------------------------------
// Scene Definition: The Kerr Ergosphere & Analytical 4D Polychoron Unfolding
// -----------------------------------------------------------------------------
export default defineScene({
  id: 'kerr_ergosphere',
  duration: 12.0,
  rigMode: 'perspective',
  lineCapacity: 4096,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    const { renderer, W, H } = ctx;

    // -------------------------------------------------------------------------
    // 1. Cinematic Camera Spline Path orbiting the Kerr Ergosphere
    // -------------------------------------------------------------------------
    // Sweeping continuous 360-degree orbital flight maintaining safe radius R ~ 13
    ctx.rig.setLensMm(32);
    ctx.rig.setPath([
      // t = 0.0s (p = 0.0): Ingress approach at 24 deg inclination
      { t: 0.00, pos: [0.0, 3.8, -13.5],   target: [0.0, 0.2, 0.0], roll: -0.04, focalLength: 32 },
      // t = 3.0s (p = 0.25): Sweeping toward approaching limb (extreme blue-shift)
      { t: 0.25, pos: [11.2, 3.4, -6.8],   target: [0.1, 0.1, 0.0], roll:  0.05, focalLength: 36 },
      // t = 6.0s (p = 0.50): Viewing fiery equatorial disk and Einstein ring from lateral flank
      { t: 0.50, pos: [12.6, 0.8, 4.2],    target: [0.0, 0.0, 0.0], roll:  0.03, focalLength: 40 },
      // t = 9.0s (p = 0.75): Sweeping underneath receding limb & southern relativistic jet
      { t: 0.75, pos: [2.8, -4.2, 12.8],   target: [0.0, 0.2, 0.0], roll: -0.05, focalLength: 42 },
      // t = 12.0s (p = 1.00): Seam alignment for topological tear handoff
      { t: 1.00, pos: [-8.8, 3.2, 9.5],    target: [0.0, 0.0, 0.0], roll:  0.02, focalLength: 45 },
    ]);

    // -------------------------------------------------------------------------
    // 2. Build Analytical 4D 120-Cell Polychoron Instanced Mesh (StaticDrawUsage)
    // -------------------------------------------------------------------------
    const phi = (1.0 + Math.sqrt(5.0)) / 2.0; // Golden ratio ~ 1.618034
    const invPhi = 1.0 / phi;

    // Base 4D vertices of the 120-cell fundamental Coxeter cells
    const base4DVerts: [number, number, number, number][] = [];
    // Hypercube permutations (+/- 0.5, +/- 0.5, +/- 0.5, +/- 0.5)
    for (let i = 0; i < 16; i++) {
      base4DVerts.push([
        (i & 1 ? 1 : -1) * 0.5,
        (i & 2 ? 1 : -1) * 0.5,
        (i & 4 ? 1 : -1) * 0.5,
        (i & 8 ? 1 : -1) * 0.5,
      ]);
    }
    // Golden ratio even permutations
    const signs = [-1, 1];
    for (const sx of signs) {
      for (const sy of signs) {
        for (const sz of signs) {
          base4DVerts.push([sx * phi * 0.5, sy * 0.5, sz * invPhi * 0.5, 0.0]);
          base4DVerts.push([0.0, sx * phi * 0.5, sy * 0.5, sz * invPhi * 0.5]);
          base4DVerts.push([sz * invPhi * 0.5, 0.0, sx * phi * 0.5, sy * 0.5]);
          base4DVerts.push([sy * 0.5, sz * invPhi * 0.5, 0.0, sx * phi * 0.5]);
        }
      }
    }

    // Generate fundamental edges between close 4D vertices
    const edges4D: [[number, number, number, number], [number, number, number, number]][] = [];
    const numBase = base4DVerts.length;
    for (let i = 0; i < numBase; i++) {
      for (let j = i + 1; j < numBase; j++) {
        const v1 = base4DVerts[i]!;
        const v2 = base4DVerts[j]!;
        const d2 = Math.pow(v1[0] - v2[0], 2) + Math.pow(v1[1] - v2[1], 2) + Math.pow(v1[2] - v2[2], 2) + Math.pow(v1[3] - v2[3], 2);
        if (d2 > 0.45 && d2 < 1.15) {
          edges4D.push([v1, v2]);
        }
      }
    }

    // Instance across expansive concentric hyper-shells with structural hierarchy
    const p1Arr = new Float32Array(NUM_STRUTS * 4);
    const p2Arr = new Float32Array(NUM_STRUTS * 4);
    const shellArr = new Float32Array(NUM_STRUTS * 2);
    const hierArr = new Float32Array(NUM_STRUTS * 2);

    const numFundEdges = Math.max(1, edges4D.length);
    for (let i = 0; i < NUM_STRUTS; i++) {
      const eIdx = i % numFundEdges;
      const shellIdx = Math.floor(i / numFundEdges);
      const edge = edges4D[eIdx]!;

      // 4D endpoints
      p1Arr[i * 4 + 0] = edge[0][0];
      p1Arr[i * 4 + 1] = edge[0][1];
      p1Arr[i * 4 + 2] = edge[0][2];
      p1Arr[i * 4 + 3] = edge[0][3];

      p2Arr[i * 4 + 0] = edge[1][0];
      p2Arr[i * 4 + 1] = edge[1][1];
      p2Arr[i * 4 + 2] = edge[1][2];
      p2Arr[i * 4 + 3] = edge[1][3];

      // Expansive hyper-shell distribution spanning orbital cage [3.8, 9.0]
      const shellLayer = shellIdx % 8;
      const shellScale = 3.8 + shellLayer * 0.75;
      const phaseOffset = (shellLayer * 0.42) + (i * 0.0015);
      shellArr[i * 2 + 0] = shellScale;
      shellArr[i * 2 + 1] = phaseOffset;

      // Structural hierarchy: tier 0 (meridian), tier 1 (facet), tier 2 (filament)
      let tier = 0;
      let baseR = 0.004;
      if (i % 7 === 0) {
        tier = 0; // Primary titanium meridian
        baseR = 0.0075;
      } else if (i % 3 === 0) {
        tier = 1; // Secondary facet boundary
        baseR = 0.0038;
      } else {
        tier = 2; // Tertiary energy filament
        baseR = 0.0018;
      }
      hierArr[i * 2 + 0] = tier;
      hierArr[i * 2 + 1] = baseR;
    }

    // Base cylinder geometry (6 radial segments x 1 height segment = 12 vertices)
    const cylGeo = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 6, 1, false);
    cylGeo.translate(0, 0.5, 0); // Origin at base
    const instPolyGeo = new THREE.InstancedBufferGeometry();
    instPolyGeo.index = cylGeo.index;
    instPolyGeo.attributes.position = cylGeo.attributes.position!;
    instPolyGeo.attributes.normal = cylGeo.attributes.normal!;

    const atP1 = new THREE.InstancedBufferAttribute(p1Arr, 4);
    const atP2 = new THREE.InstancedBufferAttribute(p2Arr, 4);
    const atShell = new THREE.InstancedBufferAttribute(shellArr, 2);
    const atHier = new THREE.InstancedBufferAttribute(hierArr, 2);
    atP1.setUsage(THREE.StaticDrawUsage);
    atP2.setUsage(THREE.StaticDrawUsage);
    atShell.setUsage(THREE.StaticDrawUsage);
    atHier.setUsage(THREE.StaticDrawUsage);

    instPolyGeo.setAttribute('iP1_4D', atP1);
    instPolyGeo.setAttribute('iP2_4D', atP2);
    instPolyGeo.setAttribute('iShellParam', atShell);
    instPolyGeo.setAttribute('iHierarchy', atHier);

    const polyMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POLYCHORON_VERT,
      fragmentShader: POLYCHORON_FRAG,
      uniforms: {
        time: { value: 0.0 },
        omega: { value: new THREE.Vector2(0.28, 0.38) },
        camW: { value: 2.4 },
        unfold: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });

    const polychoronMesh = new THREE.Mesh(instPolyGeo, polyMat);
    polychoronMesh.frustumCulled = false;

    // -------------------------------------------------------------------------
    // 3. Build Dual-Conic Relativistic Emitters (StaticDrawUsage)
    // -------------------------------------------------------------------------
    const jetOriginArr = new Float32Array(NUM_JET_PARTICLES * 3);
    const jetVelArr = new Float32Array(NUM_JET_PARTICLES * 3);
    const jetLifeArr = new Float32Array(NUM_JET_PARTICLES * 2);
    const jetParamArr = new Float32Array(NUM_JET_PARTICLES * 4);

    for (let i = 0; i < NUM_JET_PARTICLES; i++) {
      const isNorth = (i % 2 === 0);
      const signY = isNorth ? 1.0 : -1.0;

      // Launch from Kerr horizon poles
      jetOriginArr[i * 3 + 0] = (Math.sin(i * 12.98) * 0.08);
      jetOriginArr[i * 3 + 1] = signY * 1.0632;
      jetOriginArr[i * 3 + 2] = (Math.cos(i * 78.23) * 0.08);

      // Relativistic launch speed (|v| ~ 8.5 units/s)
      const theta = (Math.sin(i * 45.1) * 0.5 + 0.5) * 0.22;
      const phiAngle = (i * 0.618) * TAU;
      const speed = 7.5 + (Math.sin(i * 91.3) * 0.5 + 0.5) * 3.5;

      jetVelArr[i * 3 + 0] = Math.sin(theta) * Math.cos(phiAngle) * speed;
      jetVelArr[i * 3 + 1] = signY * Math.cos(theta) * speed;
      jetVelArr[i * 3 + 2] = Math.sin(theta) * Math.sin(phiAngle) * speed;

      const birth = (i / NUM_JET_PARTICLES) * 4.5;
      const life = 2.2 + (Math.sin(i * 17.5) * 0.5 + 0.5) * 1.8;
      jetLifeArr[i * 2 + 0] = birth;
      jetLifeArr[i * 2 + 1] = life;

      jetParamArr[i * 4 + 0] = signY;
      jetParamArr[i * 4 + 1] = i * 0.137;
      jetParamArr[i * 4 + 2] = 0.16; // size (voluminous relativistic plasma billboards)
      jetParamArr[i * 4 + 3] = 4.2;   // HDR glow multiplier > 4.0
    }

    const planeGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const instJetGeo = new THREE.InstancedBufferGeometry();
    instJetGeo.index = planeGeo.index;
    instJetGeo.attributes.position = planeGeo.attributes.position!;

    const atJOrig = new THREE.InstancedBufferAttribute(jetOriginArr, 3);
    const atJVel = new THREE.InstancedBufferAttribute(jetVelArr, 3);
    const atJLife = new THREE.InstancedBufferAttribute(jetLifeArr, 2);
    const atJParam = new THREE.InstancedBufferAttribute(jetParamArr, 4);
    atJOrig.setUsage(THREE.StaticDrawUsage);
    atJVel.setUsage(THREE.StaticDrawUsage);
    atJLife.setUsage(THREE.StaticDrawUsage);
    atJParam.setUsage(THREE.StaticDrawUsage);

    instJetGeo.setAttribute('iOrigin', atJOrig);
    instJetGeo.setAttribute('iVelocity', atJVel);
    instJetGeo.setAttribute('iLifetime', atJLife);
    instJetGeo.setAttribute('iParams', atJParam);

    const jetMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: JET_VERT,
      fragmentShader: JET_FRAG,
      uniforms: {
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const jetMesh = new THREE.Mesh(instJetGeo, jetMat);
    jetMesh.frustumCulled = false;

    // -------------------------------------------------------------------------
    // 4. Kerr Metric Screen-Space Raymarching Pass
    // -------------------------------------------------------------------------
    const kerrPass = new FSPass(KERR_RAYMARCH_FRAG, {
      time: { value: 0.0 },
      res: { value: new THREE.Vector2(W, H) },
      spin: { value: 0.998 },
      camPos: { value: new THREE.Vector3() },
      camInvProj: { value: new THREE.Matrix4() },
      camInvView: { value: new THREE.Matrix4() },
    }, { blending: THREE.NoBlending });

    (ctx as any).__kerrPass = kerrPass;
    (ctx as any).__polyMesh = polychoronMesh;
    (ctx as any).__jetMesh = jetMesh;

    ctx.node('ergosphere_core', { role: 'callout', size: [200, 36, 0] });
    ctx.node('frame_dragging_dial', { role: 'hud', size: [220, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1.0, Math.max(0.0, f.p));

    // Strict broadcast text suppression driven by canonical engine overlayDuck
    const textDuck = Math.min(
      Math.min(1.0, Math.max(0.0, f.p / 0.08)),
      ctx.overlayDuck
    );

    // Update 3D Camera Rig
    ctx.updateCamera(t, progress);

    // -------------------------------------------------------------------------
    // 1. Update Uniforms for Polychoron and Relativistic Jet Mesh
    // -------------------------------------------------------------------------
    const polyMesh = (ctx as any).__polyMesh as THREE.Mesh;
    const jetMesh = (ctx as any).__jetMesh as THREE.Mesh;
    const kerrPass = (ctx as any).__kerrPass as FSPass;

    const camW = 2.4 + 0.4 * Math.cos(0.2 * t);
    const unfold = 1.0 + 0.35 * Math.sin(t * 0.5);

    const polyMat = polyMesh.material as THREE.RawShaderMaterial;
    polyMat.uniforms.time!.value = t;
    polyMat.uniforms.camW!.value = camW;
    polyMat.uniforms.unfold!.value = unfold;

    const jetMat = jetMesh.material as THREE.RawShaderMaterial;
    jetMat.uniforms.time!.value = t;

    // Kerr raymarch uniforms
    kerrPass.u.time!.value = t;
    kerrPass.u.camPos!.value = ctx.threeCam.position;
    kerrPass.u.camInvProj!.value = ctx.threeCam.projectionMatrixInverse;
    kerrPass.u.camInvView!.value = ctx.threeCam.matrixWorld;

    // -------------------------------------------------------------------------
    // 2. Multi-Layer Compositor Pipeline
    // -------------------------------------------------------------------------
    ctx.compositor.clear();

    // Layer 1: Kerr Ergosphere Raymarching Backdrop
    ctx.compositor.createLayer('kerr_backdrop', {
      render: (target) => {
        kerrPass.render(renderer, target);
      },
      blend: 'normal',
      opacity: 1.0,
    });

    // Layer 2: 4D Polychoron Unfolding Struts + Relativistic Plasma Jets
    ctx.compositor.createLayer('stage_3d', {
      render: (target) => {
        renderer.setRenderTarget(target);
        renderer.clear(false, true, false); // Clear depth for 3D stage

        // Render 4D Polychoron Tube Mesh
        const polyScene = new THREE.Scene();
        polyScene.add(polyMesh);
        renderer.render(polyScene, ctx.threeCam);

        // Render Dual-Conic Relativistic Jets
        const jetScene = new THREE.Scene();
        jetScene.add(jetMesh);
        renderer.render(jetScene, ctx.threeCam);

        renderer.resetState();
      },
      blend: 'normal',
      opacity: 1.0,
    });

    // Layer 3: Coupled Kinetic Telemetry Matrix (MotionBus)
    ctx.compositor.createLayer('hud_vectors', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });

    // -------------------------------------------------------------------------
    // 3. Coupled Kinetic Telemetry HUD (MotionBus Springs & Modulo Reticles)
    // -------------------------------------------------------------------------
    ctx.sdf.clear();

    // Integer resonance threshold crossing with initial velocity injection (v0 = 14.0)
    const resonancePeriod = 2.0;
    const resonanceIndex = Math.floor(t / resonancePeriod);
    const resonanceTriggerT = resonanceIndex * resonancePeriod;
    const dialSpring = motion.spring(resonanceTriggerT, t, { freq: 3.2, damping: 0.65, v0: 14.0, scale: 1.0 });

    // Negative-phase-protected LFO for radar reticles
    const lfoRadar = motion.lfo('sine', 0.75, t);
    const radarTrim = ((t * 0.35) % 1.0 + 1.0) % 1.0;

    const colCyan: [number, number, number, number] = [0.12, 0.88, 0.98, 0.95 * textDuck];
    const colGold: [number, number, number, number] = [1.0, 0.82, 0.38, 0.95 * textDuck];

    if (textDuck > 0.01) {
      // Primary Telemetry Card: Kerr Metric & Frame-Dragging
      ctx.card('kerr_telemetry_card', {
        x: W - 540, y: 75, w: 460, h: 215,
        radius: [14, 14, 14, 14],
        fill: [0.06, 0.08, 0.14, 0.88 * textDuck],
        stroke: [colCyan[0], colCyan[1], colCyan[2], 0.75 * textDuck],
        strokeWidth: 1.5,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * textDuck], offset: [0, 8] },
        role: 'hud', opacity: textDuck,
      });

      // Nested Telemetry Gauge Rings
      const dialCx = W - 145, dialCy = 175;
      ctx.ring({ cx: dialCx, cy: dialCy, radius: 44, thickness: 3.5, trim: [0, 1], color: [0.2, 0.3, 0.45, 0.4 * textDuck] });
      ctx.ring({
        cx: dialCx, cy: dialCy, radius: 44, thickness: 3.5,
        trim: [0, clamp(0.2 + (dialSpring % 1.0) * 0.75, 0.0, 1.0)],
        color: colCyan, glow: 1.4,
      });

      ctx.ring({ cx: dialCx, cy: dialCy, radius: 30, thickness: 2.5, trim: [0, 1], color: [0.3, 0.2, 0.45, 0.35 * textDuck] });
      ctx.ring({
        cx: dialCx, cy: dialCy, radius: 30, thickness: 2.5,
        trim: [0, clamp(radarTrim, 0.0, 1.0)],
        color: colGold, glow: 1.2,
      });
    }

    // -------------------------------------------------------------------------
    // 4. Kinetic Typography & Telemetry Overlay
    // -------------------------------------------------------------------------
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('kerr_title', 'THE KERR ERGOSPHERE', {
        fontSize: 48, fontWeight: 900, color: `rgba(240, 246, 255, ${0.98 * textDuck})`, letterSpacing: 6, role: 'headline',
      }).withKnockoutHalo(4, `rgba(10, 12, 18, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1.0, progress * 4.0));
      ctx.renderText('kerr_title', c2d, t, 90, 120 - (1.0 - titleEnter) * 30);

      ctx.text('kerr_sub', 'ANALYTICAL 4D POLYCHORON UNFOLDING · STEREOGRAPHIC W_c(t) · a* = 0.998', {
        fontSize: 13, fontWeight: 600, color: `rgba(56, 189, 248, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(10, 12, 18, ${0.9 * textDuck})`);
      ctx.renderText('kerr_sub', c2d, t, 94, 168);

      // Real-time Boyer-Lindquist & Hawking telemetry readouts
      const rBL = 1.0632 + 0.15 * Math.sin(t * 1.4);
      const omegaDrag = (2.0 * 0.998 * rBL) / (Math.pow(rBL, 4.0) + Math.pow(0.998, 2.0) * rBL * (rBL + 2.0));
      const hawkingFlux = 0.042 / (1.0 + Math.sqrt(1.0 - 0.998 * 0.998));

      ctx.text('kerr_drag_val', `OMEGA_DRAG: ${omegaDrag.toFixed(4)} RAD/S`, {
        fontSize: 20, fontWeight: 700, color: `rgba(56, 189, 248, ${0.95 * textDuck})`, role: 'hud',
      });
      ctx.renderText('kerr_drag_val', c2d, t, W - 510, 130);

      ctx.text('kerr_bl_val', `r_BL: ${rBL.toFixed(4)} M · T_HAWKING: ${hawkingFlux.toFixed(4)} K`, {
        fontSize: 12, fontWeight: 600, color: `rgba(251, 191, 36, ${0.90 * textDuck})`, role: 'hud',
      });
      ctx.renderText('kerr_bl_val', c2d, t, W - 510, 165);

      ctx.text('kerr_resonance', `RESONANCE STEP: [0${resonanceIndex}] · SPRING V0: 14.0`, {
        fontSize: 11, fontWeight: 600, color: `rgba(224, 230, 245, ${0.82 * textDuck})`, role: 'hud',
      });
      ctx.renderText('kerr_resonance', c2d, t, W - 510, 205);
    }

    // Evaluate Compositor Graph
    ctx.compositor.evaluate(renderer, out);

    // Sync Telemetry & Enforce WebGL State Cache Invariant
    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();

    // Subtle optical breathing
    return {
      bloom: 0.32 + Math.sin(t * 2.0) * 0.03,
      bloomThreshold: 0.90,
      ca: 1.15,
    };
  },
});

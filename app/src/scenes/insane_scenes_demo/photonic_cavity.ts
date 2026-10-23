// SCENE 2: THE RESONANT PHOTONIC CAVITY & PEREGRINE BREATHER SOLITONS
// Subatomic Quantum-Optical Resonator trapping Non-Linear Coherent Light Waves
//
// 1. Closed-Form Peregrine Rogue Wave & Soliton Field:
//    - Exact analytical algebraic Peregrine Breather solution:
//      u(x, t) = [ 1 - (4 * (1 + 2*i*t)) / (1 + 4*x^2 + 4*t^2) ] * exp(i*t)
//    - Dense 2D spatial array of interfering optical breathers spontaneously localizing
//      and amplifying light intensity by a factor of 9 (|u(x,t)|^2).
//    - Analytical multi-spectral dispersion tensor: refractive phase shifts for 16 discrete
//      spectral wavelengths (400nm to 700nm) producing physical rainbow caustics without textures.
// 2. Procedural Gyroid-Schwarz Minimal Surface Lattice:
//    - Raymarched infinite periodic minimal surface: sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0
//      modulated by an analytical hyperbolic deformation field.
//    - Analytic surface normals computed directly via the gradient:
//      grad f = (cos(x)*cos(y) - sin(z)*sin(x), cos(y)*cos(z) - sin(x)*sin(y), cos(z)*cos(x) - sin(y)*sin(z))
//      bypassing multi-tap numerical forward-difference tetrahedron sampling.
//    - Internal thin-film optical interference across the gyroid membrane using Fresnel equations
//      and wavelength-dependent phase retardance.
// 3. Quantum Phase-Locked Telemetry (MotionBus):
//    - Dynamic quantum state vector readouts (psi-amplitudes, Bloch sphere coordinates, coherence decay).
//    - Entrance stagger of 64 subatomic data markers using MotionBus.stagger(64, duration, 'wave')
//      mirroring the sinusoidal interference pattern of the cavity.
//    - Telemetry text cards animated via critically damped springs (zeta = 1.0) to guarantee zero overshoot.
//    - Typography strictly gated by overlayTextDuck(tin, tout) for zero seam collision.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, makeRT, W, H } from '../../engine/gl';
import { TAU, clamp, ease } from '../../engine/util';
import { motion } from '../../engine/motion';

const NUM_SUBATOMIC_MARKERS = 64;

// -----------------------------------------------------------------------------
// 1. Gyroid-Schwarz Minimal Surface & Peregrine Soliton Raymarching Shader
// -----------------------------------------------------------------------------
const PHOTONIC_CAVITY_FRAG = /* glsl */ `
precision highp float;

uniform float time;
uniform vec2 res;
uniform vec3 camPos;
uniform vec3 camDir;
uniform vec3 camUp;
uniform vec3 camRight;
uniform float fovScale;
uniform float solitonFocus;      // Spontaneous rogue wave amplification parameter
uniform float dispersionStrength;// Scale for 16-wavelength dispersion tensor

#define TAU 6.28318530718

// Physical CIE 1931 RGB spectral color matching approximation (400nm - 700nm)
vec3 spectralRGB(float wl) {
  vec3 c;
  c.r = exp(-pow((wl - 605.0) / 48.0, 2.0)) + 0.18 * exp(-pow((wl - 435.0) / 32.0, 2.0));
  c.g = exp(-pow((wl - 535.0) / 52.0, 2.0));
  c.b = exp(-pow((wl - 450.0) / 38.0, 2.0)) * 1.35;
  return c;
}

// 3D Rotation helper
mat3 rotateAxis(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
  );
}

// Analytical Peregrine Breather algebraic intensity formula (|u(x, t)|^2)
// u(x, t) = [ 1 - 4*(1 + 2*i*t) / (1 + 4*x^2 + 4*t^2) ] * exp(i*t)
// Peak intensity at (0, 0) is (-3)^2 = 9.0 (spontaneous 9x amplification factor)
float peregrineIntensity(float x, float tau) {
  float x2 = x * x * 4.0;
  float t2 = tau * tau * 4.0;
  float denom = 1.0 + x2 + t2;
  float numReal = x2 + t2 - 3.0;
  float numImag = -8.0 * tau;
  return (numReal * numReal + numImag * numImag) / (denom * denom);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;

  // Exact perspective camera ray reconstruction aligned with Three.js basis
  vec3 rd = normalize(camDir + (p.x * camRight + p.y * camUp) * fovScale);
  vec3 ro = camPos;

  // Resonator Lattice Transform Matrix
  mat3 rotResonator = rotateAxis(vec3(0.35, 0.92, 0.18), time * 0.10);
  mat3 invRotResonator = transpose(rotResonator);

  // ---------------------------------------------------------------------------
  // 1. Raymarch Gyroid-Schwarz Minimal Surface Lattice
  // ---------------------------------------------------------------------------
  float tRay = 0.8;
  float maxDist = 24.0;
  float hitDist = -1.0;
  vec3 hitP = vec3(0.0);
  vec3 hitN = vec3(0.0);
  vec3 hitQ = vec3(0.0);

  // Membrane thickness modulation
  float membraneDelta = 0.28 + 0.05 * cos(time * 1.2);
  float latticeScale = 1.20;

  for (int step = 0; step < 96; step++) {
    vec3 pos = ro + rd * tRay;
    if (tRay > maxDist) break;

    // Apply hyperbolic deformation field:
    // Conformal hyperbolic radial stretch (tanh metric scaling)
    float r = length(pos);
    float hyperbolicWarp = 1.0 + 0.08 * (sinh(0.25 * r) / cosh(0.25 * r));
    vec3 q = rotResonator * (pos * hyperbolicWarp) * latticeScale;

    // Gyroid implicit function:
    // f(x, y, z) = sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x) = 0
    float fVal = sin(q.x) * cos(q.y) + sin(q.y) * cos(q.z) + sin(q.z) * cos(q.x);

    // Analytic surface gradient:
    // grad f = (cos(x)*cos(y) - sin(z)*sin(x), cos(y)*cos(z) - sin(x)*sin(y), cos(z)*cos(x) - sin(y)*sin(z))
    vec3 gradF;
    gradF.x = cos(q.x) * cos(q.y) - sin(q.z) * sin(q.x);
    gradF.y = cos(q.y) * cos(q.z) - sin(q.x) * sin(q.y);
    gradF.z = cos(q.z) * cos(q.x) - sin(q.y) * sin(q.z);
    float gradLen = max(length(gradF), 0.25);

    // Conservative distance estimation to the membrane isosurface
    float absF = abs(fVal);
    float dMembrane = (absF - membraneDelta) / (1.45 * latticeScale);

    if (absF <= membraneDelta || dMembrane < 0.004) {
      hitDist = tRay;
      hitP = pos;
      hitQ = q;
      // Exact analytical surface normal
      vec3 normalInLattice = (fVal >= 0.0 ? gradF : -gradF) / gradLen;
      hitN = normalize(invRotResonator * normalInLattice);
      break;
    }

    tRay += max(dMembrane * 0.60, 0.018);
  }

  // ---------------------------------------------------------------------------
  // 2. Internal Thin-Film Optical Interference Across Gyroid Membrane
  // ---------------------------------------------------------------------------
  vec3 membraneColor = vec3(0.0);
  if (hitDist > 0.0) {
    vec3 V = -rd;
    float cosThetaI = max(0.0, dot(hitN, V));

    // Snell's law refraction inside dielectric film (n_film = 1.48)
    float nFilm = 1.48;
    float cosThetaT = sqrt(max(0.0, 1.0 - (1.0 - cosThetaI * cosThetaI) / (nFilm * nFilm)));

    // Thin film thickness with analytical micro-cavity spatial variation (380nm - 620nm)
    float filmThickness = 480.0 + 130.0 * sin(hitQ.x * 0.8 + hitQ.y * 0.8 + hitQ.z * 0.8 + time * 1.5);
    float opd = 2.0 * nFilm * filmThickness * cosThetaT; // Optical Path Difference

    // Fresnel reflection coefficient at dielectric boundary
    float r12 = (1.0 - nFilm) / (1.0 + nFilm);
    float r12_2 = r12 * r12;

    // Evaluate interference across RGB representative wavelengths:
    vec3 lambdaRGB = vec3(640.0, 530.0, 450.0);
    vec3 deltaPhase = (TAU * opd) / lambdaRGB;

    // Airy thin-film reflection formula
    vec3 cosDelta = cos(deltaPhase);
    vec3 rFilm = (2.0 * r12_2 * (1.0 + cosDelta)) / (1.0 + r12_2 * r12_2 + 2.0 * r12_2 * cosDelta);

    // Two internal laser pump sources for dielectric specular highlights
    vec3 light1Pos = vec3(0.0, 0.0, 0.0);
    vec3 light2Pos = vec3(0.0, 2.5, 4.0);

    vec3 L1 = normalize(light1Pos - hitP);
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(0.0, dot(hitN, H1)), 48.0);

    vec3 L2 = normalize(light2Pos - hitP);
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(0.0, dot(hitN, H2)), 32.0);

    // Iridescent metallic-dielectric luster with Fresnel rim
    float fresnelRim = pow(1.0 - cosThetaI, 3.5);
    vec3 baseMembrane = vec3(0.05, 0.08, 0.18);
    vec3 specColor = vec3(0.25, 0.85, 1.0) * spec1 * 1.2 + vec3(0.95, 0.75, 0.3) * spec2 * 0.8;

    membraneColor = mix(baseMembrane, rFilm * 1.1, 0.75)
                  + vec3(0.25, 0.82, 0.98) * fresnelRim * 0.85
                  + specColor;

    // Distance attenuation into deep quantum cerulean
    float fog = exp(-hitDist * 0.085);
    membraneColor = mix(vec3(0.015, 0.03, 0.09), membraneColor, fog);
  }

  // ---------------------------------------------------------------------------
  // 3. Volumetric Peregrine Breather Rogue Wave Field & 16-Wavelength Dispersion Tensor
  // ---------------------------------------------------------------------------
  vec3 causticAccum = vec3(0.0);
  float totalBreatherEnergy = 0.0;

  // Evaluate the 16 discrete spectral wavelengths across the resonator volume
  for (int m = 0; m < 16; m++) {
    float wlNorm = float(m) / 15.0; // 0..1
    float wl = 400.0 + wlNorm * 300.0; // 400nm to 700nm

    // Sellmeier-type refractive dispersion tensor
    float n_m = 1.45 + 0.038 / (wlNorm * wlNorm + 0.22);

    // Refractive phase shift across the resonator cavity
    float phaseShift = TAU * (n_m * 3.5 - time * (0.85 + wlNorm * 0.45));

    // Spatial projection axis for 2D interfering breather array
    float angle_m = float(m) * (TAU / 16.0);
    vec2 dir_m = vec2(cos(angle_m), sin(angle_m));
    float x_breather = dot(p, dir_m) * 3.2 + 0.35 * sin(time * 0.8 + float(m));

    // Breather temporal envelope centered around peak resonance
    float tau_breather = (time - 16.0) * 1.5 + (wlNorm - 0.5) * 1.6;

    // Exact closed-form Peregrine Breather algebraic intensity
    float I_breather = peregrineIntensity(x_breather, tau_breather);
    totalBreatherEnergy += I_breather;

    // Physical CIE spectral color response
    vec3 c_spectral = spectralRGB(wl);

    // Analytical rainbow caustics along the resonator boundary
    float causticPattern = pow(max(0.0, sin(phaseShift + x_breather * 2.6)), 7.0);
    float beamIntensity = causticPattern * (1.0 + (I_breather - 1.0) * 0.25 * solitonFocus);

    causticAccum += c_spectral * beamIntensity * (dispersionStrength / 16.0);
  }

  // ---------------------------------------------------------------------------
  // 4. Volumetric Cavity Glow & Spectral Integration
  // ---------------------------------------------------------------------------
  // Ambient quantum vacuum fluctuations
  float vacuumFluct = 0.5 + 0.5 * sin(p.x * 20.0 + p.y * 16.0 + time * 2.5);
  vec3 ambientGlow = vec3(0.02, 0.035, 0.10) * (1.0 + 0.35 * vacuumFluct);

  // Spontaneous focal rogue wave node in cavity center (tight, jewel-like point spark)
  float centerDist = length(p);
  float focalCore = exp(-centerDist * centerDist * 320.0) * min(totalBreatherEnergy / 16.0, 2.0) * 0.12 * solitonFocus;
  vec3 focalColor = vec3(0.18, 0.85, 1.0) * focalCore;

  // Composite gyroid membrane, dispersion caustics, and spontaneous rogue focal core
  vec3 finalColor = ambientGlow
                  + (hitDist > 0.0 ? membraneColor : vec3(0.012, 0.022, 0.055))
                  + causticAccum * 0.45
                  + focalColor;

  fragColor = vec4(finalColor, 1.0);
}
`;

// -----------------------------------------------------------------------------
// Scene Definition: The Resonant Photonic Cavity & Peregrine Breather Solitons
// -----------------------------------------------------------------------------
export default defineScene({
  id: 'photonic_cavity',
  rigMode: 'perspective',
  particleCapacity: 4096,
  lineCapacity: 8192,
  sdfCapacity: 2048,

  setup: async (ctx: SceneContext) => {
    // 1. Dual-Mode Cinematic Camera Rig Trajectory maintaining safe orbital radius R ~ 8
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      // t = 10.0s (p = 0.0): Ingress into resonant cavity aperture
      { t: 0.00, pos: [0.0, 2.2, -8.8],   target: [0.0, 0.1, 0.0], roll:  0.02, focalLength: 28 },
      // t = 13.0s (p = 0.25): Gliding through gyroid minimal surface corridor
      { t: 0.25, pos: [6.8, 1.6, -4.5],   target: [0.1, 0.0, 0.0], roll: -0.04, focalLength: 32 },
      // t = 16.0s (p = 0.50): Viewing spontaneous Peregrine rogue breather wave array
      { t: 0.50, pos: [7.5, -2.4, 3.6],   target: [0.0, 0.0, 0.0], roll:  0.05, focalLength: 36 },
      // t = 19.0s (p = 0.75): Sweeping across resonator cavity standing wave rails
      { t: 0.75, pos: [-4.8, 3.4, 6.8],   target: [0.0, 0.1, 0.0], roll: -0.05, focalLength: 40 },
      // t = 22.0s (p = 1.00): Pull-back revealing crystalline optical resonator matrix
      { t: 1.00, pos: [0.0, 4.6, 8.6],    target: [0.0, 0.2, 0.0], roll:  0.02, focalLength: 44 },
    ]);

    // 2. Trapped Coherent Photonic Particles (Analytical ballistic + curl turbulence)
    ctx.particles.addEmitter('trapped_photons', {
      capacity: 1024,
      origin: [0, 0, 0],
      direction: [0, 0, 1],
      speed: 1.8,
      spread: 4.5,
      lifetime: 3.5,
      gravity: [0, 0, 0],
      turbulence: 0.45,
      size: 0.022,
      color: [0.15, 0.85, 1.0, 0.85],
      glow: 2.2,
    });

    // 3. Screen-Space Raymarching Pass for Gyroid & Peregrine Breathers
    const cavityPass = new FSPass(PHOTONIC_CAVITY_FRAG, {
      time: { value: 0.0 },
      res: { value: new THREE.Vector2(W, H) },
      camPos: { value: new THREE.Vector3() },
      camDir: { value: new THREE.Vector3() },
      camUp: { value: new THREE.Vector3() },
      camRight: { value: new THREE.Vector3() },
      fovScale: { value: 1.0 },
      solitonFocus: { value: 1.0 },
      dispersionStrength: { value: 1.0 },
    }, { blending: THREE.NoBlending });

    (ctx as any).__cavityPass = cavityPass;

    // Register Telemetry Nodes in SceneGraph for headless probe tracking
    ctx.node('cavity_resonator_core', { role: 'callout', size: [220, 36, 0] });
    ctx.node('quantum_bloch_dial', { role: 'hud', size: [240, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1.0, Math.max(0.0, f.p));

    // Strict Broadcast Typographic Decoupling (overlayTextDuck)
    // Incoming scene text remains completely silent during the first 55% of the
    // transition seam window (u in [0, 0.55]), driven by ctx.overlayDuck
    const textDuck = Math.min(
      Math.min(1.0, Math.max(0.0, (1.0 - progress) / 0.05)),
      ctx.overlayDuck
    );

    // Update 3D Camera Rig
    ctx.updateCamera(t, progress);

    // -------------------------------------------------------------------------
    // 1. Update Uniforms for Cavity Raymarching Pass
    // -------------------------------------------------------------------------
    const cavityPass = (ctx as any).__cavityPass as FSPass;
    const camDir = new THREE.Vector3();
    ctx.threeCam.getWorldDirection(camDir);
    const camUp = ctx.threeCam.up.clone().applyQuaternion(ctx.threeCam.quaternion);
    const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();
    const camFov = ctx.threeCam instanceof THREE.PerspectiveCamera ? ctx.threeCam.fov : 45;
    const fovScale = Math.tan(THREE.MathUtils.degToRad(camFov * 0.5));

    cavityPass.u.time!.value = t;
    cavityPass.u.camPos!.value.copy(ctx.threeCam.position);
    cavityPass.u.camDir!.value.copy(camDir);
    cavityPass.u.camUp!.value.copy(camUp);
    cavityPass.u.camRight!.value.copy(camRight);
    cavityPass.u.fovScale!.value = fovScale;

    // Spontaneous Peregrine breather amplification peak centered near t = 16.0s
    const solitonEnvelope = Math.exp(-Math.pow((t - 16.0) / 2.8, 2.0));
    cavityPass.u.solitonFocus!.value = 1.0 + 2.0 * solitonEnvelope;
    cavityPass.u.dispersionStrength!.value = 1.2 + 0.6 * Math.sin(t * 1.8);

    // -------------------------------------------------------------------------
    // 2. Optical Cavity Waveguides & Resonant Standing Waves (ctx.lines)
    // -------------------------------------------------------------------------
    ctx.lines.clear();

    // Macroscopic Resonator Mirror Frames at Z = +/- 3.6
    const colMirror: [number, number, number] = [0.15, 0.75, 0.95];
    const colGold: [number, number, number] = [0.98, 0.82, 0.35];

    for (const zMirror of [-3.6, 3.6]) {
      const boxHalf = 2.4;
      // Mirror boundary frame
      ctx.lines.seg(-boxHalf, -boxHalf, zMirror,  boxHalf, -boxHalf, zMirror, 1.8, colMirror[0], colMirror[1], colMirror[2], 0.65);
      ctx.lines.seg( boxHalf, -boxHalf, zMirror,  boxHalf,  boxHalf, zMirror, 1.8, colMirror[0], colMirror[1], colMirror[2], 0.65);
      ctx.lines.seg( boxHalf,  boxHalf, zMirror, -boxHalf,  boxHalf, zMirror, 1.8, colMirror[0], colMirror[1], colMirror[2], 0.65);
      ctx.lines.seg(-boxHalf,  boxHalf, zMirror, -boxHalf, -boxHalf, zMirror, 1.8, colMirror[0], colMirror[1], colMirror[2], 0.65);

      // Cavity longitudinal guide rails
      ctx.lines.seg(-boxHalf, -boxHalf, -3.6, -boxHalf, -boxHalf, 3.6, 1.2, 0.2, 0.4, 0.7, 0.4);
      ctx.lines.seg( boxHalf, -boxHalf, -3.6,  boxHalf, -boxHalf, 3.6, 1.2, 0.2, 0.4, 0.7, 0.4);
      ctx.lines.seg( boxHalf,  boxHalf, -3.6,  boxHalf,  boxHalf, 3.6, 1.2, 0.2, 0.4, 0.7, 0.4);
      ctx.lines.seg(-boxHalf,  boxHalf, -3.6, -boxHalf,  boxHalf, 3.6, 1.2, 0.2, 0.4, 0.7, 0.4);
    }

    // Coherent Laser Standing Waves: E(z, t) = E0 * sin(kz * z) * cos(omega * t)
    const numStandingNodes = 48;
    for (let i = 0; i < numStandingNodes - 1; i++) {
      const z1 = -3.5 + (i / (numStandingNodes - 1)) * 7.0;
      const z2 = -3.5 + ((i + 1) / (numStandingNodes - 1)) * 7.0;

      const kz = 4.0 * Math.PI;
      const amp1 = Math.sin(kz * (z1 + 3.5) / 7.0) * Math.cos(t * 8.0) * 0.35;
      const amp2 = Math.sin(kz * (z2 + 3.5) / 7.0) * Math.cos(t * 8.0) * 0.35;

      ctx.lines.seg(
        0, amp1, z1,
        0, amp2, z2,
        2.5, colGold[0], colGold[1], colGold[2], 0.95
      );

      // Orthogonal polarization component
      const ampOrth1 = Math.sin(kz * (z1 + 3.5) / 7.0) * Math.sin(t * 8.0) * 0.35;
      const ampOrth2 = Math.sin(kz * (z2 + 3.5) / 7.0) * Math.sin(t * 8.0) * 0.35;
      ctx.lines.seg(
        ampOrth1, 0, z1,
        ampOrth2, 0, z2,
        2.0, colMirror[0], colMirror[1], colMirror[2], 0.85
      );
    }

    // -------------------------------------------------------------------------
    // 3. Multi-Layer Compositor Pipeline
    // -------------------------------------------------------------------------
    ctx.compositor.clear();

    // Layer 1: Resonant Cavity & Gyroid Raymarcher
    ctx.compositor.createLayer('cavity_backdrop', {
      render: (target) => {
        cavityPass.render(renderer, target);
      },
      blend: 'normal',
      opacity: 1.0,
    });

    // Layer 2: 3D Standing Wave Guides & Particles
    ctx.compositor.createLayer('standing_waves_3d', {
      render: (target) => {
        renderer.setRenderTarget(target);
        renderer.clear(false, true, false); // Clear depth for 3D stage

        ctx.lines.render(renderer, target, ctx.threeCam);
        ctx.particles.render(renderer, ctx.threeCam, target, t);

        renderer.resetState();
      },
      blend: 'add',
      opacity: 1.0,
    });

    // Layer 3: Quantum Phase-Locked Telemetry HUD (MotionBus)
    ctx.compositor.createLayer('quantum_hud', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });

    // -------------------------------------------------------------------------
    // 4. Quantum Phase-Locked Telemetry (MotionBus Springs & Stagger)
    // -------------------------------------------------------------------------
    ctx.sdf.clear();

    // Bloch Sphere Coordinates: |psi> = cos(theta/2)|0> + e^(i*phi)*sin(theta/2)|1>
    const blochTheta = (Math.PI / 3.0) + 0.35 * Math.sin(t * 0.85);
    const blochPhi = (t * 1.45) % TAU;
    const psi0_amp = Math.cos(blochTheta / 2.0);
    const psi1_amp = Math.sin(blochTheta / 2.0);

    // Coherence Decay Percentage: C(t) = exp(-(t - 10.0)/T2) with Rabi oscillation
    const tCoherence = Math.max(0.0, t - 10.0);
    const coherenceDecay = Math.exp(-tCoherence / 18.5) * (94.0 + 5.5 * Math.cos(t * 3.8));

    // Telemetry Text Cards animated via Critically Damped Springs (zeta = 1.0, zero overshoot)
    const cardEntranceT = 11.2;
    const cardSpring = motion.spring(cardEntranceT, t, { freq: 3.0, damping: 1.0, scale: 1.0 });

    const colCyan: [number, number, number, number] = [0.12, 0.88, 0.98, 0.95 * textDuck];
    const colAmber: [number, number, number, number] = [0.98, 0.75, 0.14, 0.95 * textDuck];

    if (textDuck > 0.01) {
      // Primary Quantum Telemetry Card
      ctx.card('quantum_telemetry_card', {
        x: W - 530, y: 75, w: 450, h: 220,
        radius: [14, 14, 14, 14],
        fill: [0.05, 0.08, 0.16, 0.88 * textDuck * cardSpring],
        stroke: [colCyan[0], colCyan[1], colCyan[2], 0.75 * textDuck * cardSpring],
        strokeWidth: 1.5,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * textDuck], offset: [0, 8] },
        role: 'hud', opacity: textDuck * cardSpring,
      });

      // Bloch Sphere Dial Rings
      const dialCx = W - 135, dialCy = 180;
      ctx.ring({ cx: dialCx, cy: dialCy, radius: 46, thickness: 3.5, trim: [0, 1], color: [0.2, 0.35, 0.5, 0.4 * textDuck] });
      ctx.ring({
        cx: dialCx, cy: dialCy, radius: 46, thickness: 3.5,
        trim: [0, clamp(blochTheta / Math.PI, 0.0, 1.0)],
        color: colCyan, glow: 1.4,
      });

      ctx.ring({ cx: dialCx, cy: dialCy, radius: 32, thickness: 2.5, trim: [0, 1], color: [0.35, 0.25, 0.45, 0.35 * textDuck] });
      ctx.ring({
        cx: dialCx, cy: dialCy, radius: 32, thickness: 2.5,
        trim: [0, clamp(blochPhi / TAU, 0.0, 1.0)],
        color: colAmber, glow: 1.2,
      });

      // -----------------------------------------------------------------------
      // Entrance Stagger of 64 Subatomic Data Markers (MotionBus.stagger 'wave')
      // -----------------------------------------------------------------------
      const markerDelays = motion.stagger(NUM_SUBATOMIC_MARKERS, 1.8, 'wave');
      const barStartY = H - 85;
      const barW = 12;
      const barGap = 6;
      const totalWidth = NUM_SUBATOMIC_MARKERS * (barW + barGap);
      const startX = (W - totalWidth) / 2.0;

      for (let i = 0; i < NUM_SUBATOMIC_MARKERS; i++) {
        const markerTriggerT = cardEntranceT + markerDelays[i]!;
        // Critically damped spring for each subatomic marker to prevent overshoot
        const markerSpring = motion.spring(markerTriggerT, t, { freq: 3.5, damping: 1.0, scale: 1.0 });

        if (markerSpring > 0.01) {
          const markerPhase = (i / NUM_SUBATOMIC_MARKERS) * TAU;
          // Quantum harmonic probability amplitude
          const probAmp = 0.5 + 0.5 * Math.sin(markerPhase * 3.0 + t * 4.2);
          const barH = (18 + probAmp * 42) * markerSpring;
          const bx = startX + i * (barW + barGap);
          const by = barStartY - barH;

          // Multi-spectral chromatic gradient across the 64 markers
          const markerNorm = i / (NUM_SUBATOMIC_MARKERS - 1);
          const rCol = 0.2 + 0.8 * markerNorm;
          const gCol = 0.4 + 0.5 * Math.sin(markerNorm * Math.PI);
          const bCol = 1.0 - 0.7 * markerNorm;

          ctx.sdf.rect(bx, by, barW, barH, {
            radius: 2,
            fill: [rCol, gCol, bCol, 0.85 * textDuck * markerSpring],
            glow: 1.2 * markerSpring,
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 5. Kinetic Typography & Telemetry Overlay
    // -------------------------------------------------------------------------
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      // Headline Title
      const title = ctx.text('photonic_title', 'THE RESONANT PHOTONIC CAVITY', {
        fontSize: 46, fontWeight: 900, color: `rgba(240, 246, 255, ${0.98 * textDuck})`, letterSpacing: 5, role: 'headline',
      }).withKnockoutHalo(4, `rgba(10, 14, 24, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1.0, progress * 4.0));
      ctx.renderText('photonic_title', c2d, t, 90, 120 - (1.0 - titleEnter) * 30);

      // Subtitle
      ctx.text('photonic_sub', 'PEREGRINE BREATHER SOLITONS · GYROID-SCHWARZ LATTICE · 16-λ DISPERSION TENSOR', {
        fontSize: 13, fontWeight: 600, color: `rgba(56, 189, 248, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(10, 14, 24, ${0.90 * textDuck})`);
      ctx.renderText('photonic_sub', c2d, t, 94, 168);

      // Quantum Telemetry Readouts
      ctx.text('bloch_state_val', `|ψ⟩ = ${psi0_amp.toFixed(3)}|0⟩ + ${psi1_amp.toFixed(3)} e^(i·${blochPhi.toFixed(2)})|1⟩`, {
        fontSize: 18, fontWeight: 700, color: `rgba(56, 189, 248, ${0.95 * textDuck * cardSpring})`, role: 'hud',
      });
      ctx.renderText('bloch_state_val', c2d, t, W - 500, 130);

      ctx.text('coherence_val', `COHERENCE: ${coherenceDecay.toFixed(2)}% · Ω_RABI: 3.800 RAD/S`, {
        fontSize: 12, fontWeight: 600, color: `rgba(251, 191, 36, ${0.90 * textDuck * cardSpring})`, role: 'hud',
      });
      ctx.renderText('coherence_val', c2d, t, W - 500, 165);

      const peakAmp = 9.0 * (1.0 + 0.15 * Math.sin(t * 2.0));
      ctx.text('peregrine_amp_val', `PEAK ROGUE AMPLIFICATION: |u(0,0)|² = ${peakAmp.toFixed(3)}x`, {
        fontSize: 11, fontWeight: 600, color: `rgba(224, 230, 245, ${0.85 * textDuck * cardSpring})`, role: 'hud',
      });
      ctx.renderText('peregrine_amp_val', c2d, t, W - 500, 205);

      // Marker Grating Label
      ctx.text('grating_label', 'SUBATOMIC 64-CHANNEL INTERFERENCE GRATING · WAVE STAGGER & CRITICAL DAMPING (ζ = 1.0)', {
        fontSize: 11, fontWeight: 600, color: `rgba(148, 163, 184, ${0.75 * textDuck})`, letterSpacing: 2, role: 'hud',
      });
      ctx.renderText('grating_label', c2d, t, (W - 740) / 2.0, H - 98);
    }

    // Evaluate Compositor Graph
    ctx.compositor.evaluate(renderer, out);

    // Sync Telemetry & Enforce WebGL State Cache Invariant
    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();

    // Dynamic optical breathing
    return {
      bloom: 0.16 + Math.sin(t * 2.2) * 0.02,
      bloomThreshold: 0.88,
      ca: 1.05,
    };
  },
});

#!/usr/bin/env bun
// Acceptance test for engine/refract.ts (+ GLSL mirror). Run: bun scripts/test_refraction.ts
import {
  CAUCHY_A_WATER,
  CAUCHY_B_WATER,
  CAUCHY_A_WATER_EMPIRICAL,
  CAUCHY_B_WATER_EMPIRICAL,
  waterIOR,
  waterIOREmpirical,
  criticalAngle,
  fresnelSchlick,
  fresnelDielectric,
  refractVector,
  reflectVector,
  primaryRainbowAngle,
  primaryRainbowAngleDeg,
  secondaryRainbowAngle,
  secondaryRainbowAngleDeg,
  dropletDeflection,
  intersectSphere,
  traceDropletRay,
  traceDropletSpectral,
  createDropletRayFan,
  type V3,
} from '../src/engine/refract';
import { REFRACT_GLSL } from '../src/engine/glsl/refract';
import type { RGB } from '../src/engine/spectrum';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
const fmt = (c: RGB | V3) => `[${c.map((v) => v.toFixed(4)).join(', ')}]`;

console.log('--- 1. Dispersion Indices ---');
{
  // n(700 nm) ~ 1.331 +/- 0.001
  const n700_blueprint = waterIOR(700);
  const n700_empirical = waterIOREmpirical(700);
  check(
    'n(700nm) ≈ 1.331 ± 0.001 (blueprint constants A=1.3199, B=5150)',
    Math.abs(n700_blueprint - 1.331) <= 0.001,
    `n(700) = ${n700_blueprint.toFixed(5)} (diff: ${Math.abs(n700_blueprint - 1.331).toFixed(5)})`,
  );
  check(
    'n(700nm) ≈ 1.331 ± 0.001 (empirical visible fit)',
    Math.abs(n700_empirical - 1.331) <= 0.001,
    `n(700) = ${n700_empirical.toFixed(5)}`,
  );

  // n(400 nm) ~ 1.344 +/- 0.001
  const n400_empirical = waterIOREmpirical(400);
  check(
    'n(400nm) ≈ 1.344 ± 0.001 (empirical visible fit)',
    Math.abs(n400_empirical - 1.344) <= 0.001,
    `n(400) = ${n400_empirical.toFixed(5)}`,
  );

  // Monotonic dispersion: shorter wavelength -> higher refractive index (dn/dlambda < 0)
  let monotonic = true;
  let prevN = waterIOR(380);
  for (let wl = 390; wl <= 780; wl += 10) {
    const curN = waterIOR(wl);
    if (curN >= prevN) monotonic = false;
    prevN = curN;
  }
  check('Normal dispersion: dn/dλ < 0 strictly monotonic across 380-780nm', monotonic);
}

console.log('\n--- 2. Descartes Primary Rainbow Angles ---');
{
  // Primary bow: phi = 4*theta2 - 2*theta1
  // Red (~700 nm, n ~ 1.331): ~42.0° (range [41.5°, 42.5°])
  // Violet (~400 nm, n ~ 1.344): ~40.5° (range [40.0°, 41.0°])
  const nRed = 1.331;
  const nViolet = 1.344;

  const phiRedDeg = primaryRainbowAngleDeg(nRed);
  const phiVioletDeg = primaryRainbowAngleDeg(nViolet);

  check(
    'Primary rainbow angle red (n=1.331) ≈ 42.0° (within [41.5°, 42.5°])',
    phiRedDeg >= 41.5 && phiRedDeg <= 42.5,
    `phi_red = ${phiRedDeg.toFixed(2)}°`,
  );
  check(
    'Primary rainbow angle violet (n=1.344) ≈ 40.5° (within [40.0°, 41.0°])',
    phiVioletDeg >= 40.0 && phiVioletDeg <= 41.0,
    `phi_violet = ${phiVioletDeg.toFixed(2)}°`,
  );
  check(
    'Primary bow angular dispersion: red angle > violet angle (outer red rim)',
    phiRedDeg > phiVioletDeg,
    `Delta = ${(phiRedDeg - phiVioletDeg).toFixed(2)}°`,
  );

  // Numerical verification: find the rainbow caustic apex by scanning impact parameter b/R in [0.01, 0.99]
  let maxPhiRed = -1;
  let maxPhiViolet = -1;
  let apexBRed = 0;
  for (let step = 0; step <= 20000; step++) {
    const b = step / 20000;
    const th1 = Math.asin(b);

    const th2Red = Math.asin(b / nRed);
    const phiR = (4 * th2Red - 2 * th1) * (180 / Math.PI);
    if (phiR > maxPhiRed) {
      maxPhiRed = phiR;
      apexBRed = b;
    }

    const th2V = Math.asin(b / nViolet);
    const phiV = (4 * th2V - 2 * th1) * (180 / Math.PI);
    if (phiV > maxPhiViolet) {
      maxPhiViolet = phiV;
    }
  }
  check(
    'Numerical ray sweep confirms primary apex within 0.01° of analytic Descartes formula',
    Math.abs(maxPhiRed - phiRedDeg) < 0.01 && Math.abs(maxPhiViolet - phiVioletDeg) < 0.01,
    `num_red=${maxPhiRed.toFixed(2)}° at b/R=${apexBRed.toFixed(3)}`,
  );

  // Secondary rainbow: phi2 ~ 50.5° for red, ~53.5° for violet (reversed order)
  const phi2RedDeg = secondaryRainbowAngleDeg(nRed);
  const phi2VioletDeg = secondaryRainbowAngleDeg(nViolet);
  check(
    'Secondary bow apex: red ≈ 50.5° [50.0°, 51.5°], violet ≈ 53.5° [53.0°, 54.5°]',
    phi2RedDeg >= 50.0 && phi2RedDeg <= 51.5 && phi2VioletDeg >= 53.0 && phi2VioletDeg <= 54.5,
    `sec_red=${phi2RedDeg.toFixed(2)}°, sec_violet=${phi2VioletDeg.toFixed(2)}°`,
  );
  check(
    'Secondary bow color reversal: violet outer rim (phi2_violet > phi2_red)',
    phi2VioletDeg > phi2RedDeg,
  );
}

console.log('\n--- 3. Total Internal Reflection (TIR) ---');
{
  const nWater = 1.333;
  const thetaC = criticalAngle(nWater, 1.0);
  const thetaCDeg = (thetaC * 180) / Math.PI;

  check(
    'Critical angle for water-to-air: theta_c ≈ 48.6° ± 0.2°',
    Math.abs(thetaCDeg - 48.6) < 0.2,
    `theta_c = ${thetaCDeg.toFixed(3)}°`,
  );

  // Sub-critical angles (theta < theta_c): transmission occurs (R < 1, T > 0)
  const subAngles = [0.0, 15.0, 30.0, 45.0];
  let subOk = true;
  for (const deg of subAngles) {
    const rad = (deg * Math.PI) / 180;
    const cosI = Math.cos(rad);
    const fresnel = fresnelDielectric(cosI, nWater, 1.0);
    if (fresnel.tir || fresnel.r >= 1.0 || fresnel.t <= 0.0) {
      subOk = false;
    }
  }
  check('Sub-critical angles (0°, 15°, 30°, 45°): partial transmission (R < 1, T > 0)', subOk);

  // Super-critical angles (theta > theta_c): 100% reflectance, zero transmission
  const superAngles = [49.0, 55.0, 65.0, 75.0, 89.0];
  let tirOk = true;
  for (const deg of superAngles) {
    const rad = (deg * Math.PI) / 180;
    const cosI = Math.cos(rad);
    const fresnel = fresnelDielectric(cosI, nWater, 1.0);
    const schlick = fresnelSchlick(cosI, nWater, 1.0);
    if (!fresnel.tir || Math.abs(fresnel.r - 1.0) > 1e-9 || fresnel.t !== 0.0 || Math.abs(schlick - 1.0) > 1e-9) {
      tirOk = false;
    }
  }
  check('Super-critical angles (49°, 55°, 65°, 75°, 89°): 100% reflectance (R = 1.0, T = 0.0)', tirOk);

  // Vector refraction returns null beyond critical angle
  const normalInward: V3 = [0, 1, 0];
  const superDir: V3 = [Math.sin(1.0), -Math.cos(1.0), 0]; // ~57.3° incidence > 48.6°
  const refracted = refractVector(superDir, normalInward, nWater);
  check('refractVector beyond critical angle returns null (TIR)', refracted === null);

  // Vector reflection maintains unit length
  const reflected = reflectVector(superDir, normalInward);
  const reflLen = Math.hypot(reflected[0], reflected[1], reflected[2]);
  check('reflectVector preserves unit length', Math.abs(reflLen - 1.0) < 1e-7);
}

console.log('\n--- 4. White Light Conservation ---');
{
  // When environment is flat uniform white (1, 1, 1), multi-spectral tracing must
  // integrate back to neutral white with no chrominance bias.
  const center: V3 = [0, 0, 3];
  const radius = 1.0;
  const ro: V3 = [0, 0.4, 0];
  const rd: V3 = [0, 0, 1]; // Ray passing through upper half of droplet

  const whiteEnv = (_d: V3): RGB => [1, 1, 1];

  for (const sampleCount of [8, 16, 32]) {
    const integrated = traceDropletSpectral(ro, rd, center, radius, sampleCount, whiteEnv);
    const r = integrated[0], g = integrated[1], b = integrated[2];

    const isWhite = Math.abs(r - 1.0) < 1e-6 && Math.abs(g - 1.0) < 1e-6 && Math.abs(b - 1.0) < 1e-6;
    check(
      `spectralSamples(${sampleCount}) integrates uniform white to exact neutral white`,
      isWhite,
      `rgb = ${fmt(integrated)}`,
    );
  }

  // Chrominance bias check across a grid of rays intersecting the droplet
  let maxChromaBias = 0;
  for (let y = -0.8; y <= 0.8; y += 0.2) {
    const rayOrigin: V3 = [0, y, 0];
    const integrated = traceDropletSpectral(rayOrigin, rd, center, radius, 16, whiteEnv);
    const mean = (integrated[0] + integrated[1] + integrated[2]) / 3;
    const diff = Math.max(
      Math.abs(integrated[0] - mean),
      Math.abs(integrated[1] - mean),
      Math.abs(integrated[2] - mean),
    );
    if (diff > maxChromaBias) maxChromaBias = diff;
  }
  check(
    'Zero chrominance bias across droplet aperture (< 1e-6 bias)',
    maxChromaBias < 1e-6,
    `max bias = ${maxChromaBias.toExponential(3)}`,
  );

  // Colored environment test: red light source must produce red output
  const redEnv = (_d: V3): RGB => [1, 0, 0];
  const redIntegrated = traceDropletSpectral(ro, rd, center, radius, 16, redEnv);
  check('Red environment reproduces red output [1, 0, 0]', redIntegrated[0] > 0.99 && redIntegrated[1] < 1e-6 && redIntegrated[2] < 1e-6);
}

console.log('\n--- 5. createDropletRayFan Geometry ---');
{
  const fan = createDropletRayFan([0, 0, 0], 1.0, 16);
  check('createDropletRayFan returns THREE.LineSegments', fan.isLineSegments === true);

  const posAttr = fan.geometry.getAttribute('position');
  const colAttr = fan.geometry.getAttribute('color');
  check('BufferGeometry has non-empty position attribute', posAttr && posAttr.count > 0, `vertices: ${posAttr.count}`);
  check('BufferGeometry has non-empty color attribute', colAttr && colAttr.count > 0, `colors: ${colAttr.count}`);

  let hasNaN = false;
  let hasValidColors = false;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) hasNaN = true;
    const cr = colAttr.getX(i), cg = colAttr.getY(i), cb = colAttr.getZ(i);
    if (Number.isNaN(cr) || Number.isNaN(cg) || Number.isNaN(cb)) hasNaN = true;
    if (cr > 0.1 || cg > 0.1 || cb > 0.1) hasValidColors = true;
  }
  check('Ray fan contains zero NaN coordinates or color channels', !hasNaN);
  check('Ray fan vertices carry active spectral colors', hasValidColors);
}

console.log('\n--- 6. GLSL refract chunk ---');
{
  check('REFRACT_GLSL contains waterIOR', REFRACT_GLSL.includes('float waterIOR(float lambdaNm)'));
  check('REFRACT_GLSL contains traceDroplet', REFRACT_GLSL.includes('vec3 traceDroplet(vec3 ro, vec3 rd, vec3 center, float radius, sampler2D envMap)'));
  check('REFRACT_GLSL contains Cauchy formula constants', REFRACT_GLSL.includes('WATER_CAUCHY_A') && REFRACT_GLSL.includes('WATER_CAUCHY_B_UM2'));
}

console.log(`\n========================================`);
if (fails === 0) {
  console.log('ALL TESTS PASSED (0 failures)');
} else {
  console.error(`TEST SUITE FAILED: ${fails} check(s) failed`);
  process.exit(1);
}

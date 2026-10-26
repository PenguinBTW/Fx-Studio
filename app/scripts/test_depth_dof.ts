#!/usr/bin/env bun
// Physical Depth-Based Depth of Field & Bokeh (P7b) Acceptance Tests.
// Verifies:
// 1. Focal plane sharpness: CoC == 0.0 at z = focusDistance, 100% edge contrast.
// 2. CoC monotonic growth: blur diameter increases monotonically away from focal plane in both directions.
// 3. Linear depth reconstruction: accurate eye-space depth recovery across near/far clip ranges and Three.js camera projections.
// 4. Aperture diaphragm geometry: circular, hexagonal blades, and anamorphic oval shapes.
// 5. Bilateral gather weighting: foreground bokeh bleeds over background, background does not contaminate sharp foreground.
// 6. Engine integration: DepthTexture allocation on sceneRT and DepthDoFPass exports.

import * as THREE from 'three';
import { calcCoC, linearizeDepth, evalAperture, calcBilateralWeight, DepthDoFPass, DEFAULT_DEPTH_DOF } from '../src/engine/dof';
import { makeRT, W, H } from '../src/engine/gl';
import { Engine } from '../src/engine/engine';

let fails = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
}

console.log('--- 1. Focal Plane Sharpness & CoC at z = focusDistance ---');
{
  const focusDistances = [0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 50.0, 100.0, 500.0];
  let allZero = true;
  for (const fd of focusDistances) {
    const coc = calcCoC(fd, fd, 32.0, 24.0);
    if (coc !== 0.0) {
      allZero = false;
      break;
    }
  }
  check('CoC is exactly 0.0 at z = focusDistance across all ranges', allZero);

  // Critical focus with various apertures
  const apertures = [1.0, 8.0, 16.0, 32.0, 64.0];
  let apZero = true;
  for (const a of apertures) {
    if (calcCoC(5.0, 5.0, a, 32.0) !== 0.0) {
      apZero = false;
      break;
    }
  }
  check('CoC remains 0.0 at focal plane regardless of aperture size', apZero);

  // In-focus edge contrast: background sample at dist >= 1 px gives 0 weight when center is at focal plane
  const centerZ = 5.0;
  const centerCoC = calcCoC(centerZ, 5.0, 24.0); // 0.0
  const bgZ = 20.0;
  const bgCoC = calcCoC(bgZ, 5.0, 24.0); // 18.0
  const wBg = calcBilateralWeight(centerZ, centerCoC, bgZ, bgCoC, 2.0);
  check('In-focus silhouette retains 100% contrast (no background bleed)', wBg === 0.0, `weight: ${wBg}`);
}

console.log('\n--- 2. Monotonic CoC Growth Away from Focal Plane ---');
{
  const fd = 10.0;
  const aperture = 32.0;
  const maxRadius = 48.0;

  // Background direction (z > fd)
  const zD = [fd, fd * 1.5, fd * 2.0, fd * 3.0, fd * 4.0, fd * 8.0];
  const cocsBg = zD.map((z) => calcCoC(z, fd, aperture, maxRadius));

  let bgMonotonic = true;
  for (let i = 1; i < cocsBg.length; i++) {
    if (cocsBg[i]! <= cocsBg[i - 1]!) {
      bgMonotonic = false;
      break;
    }
  }
  check('CoC grows monotonically in background direction (z > focusDistance)', bgMonotonic, cocsBg.map((v) => v.toFixed(2)).join(', '));

  // Acceptance criteria from blueprint: 2x and 4x focus distance
  const coc2x = calcCoC(2 * fd, fd, aperture, maxRadius);
  const coc4x = calcCoC(4 * fd, fd, aperture, maxRadius);
  const expected2x = 0.5 * aperture; // |1 - 10/20| * 32 = 16.0
  const expected4x = 0.75 * aperture; // |1 - 10/40| * 32 = 24.0
  check('CoC at 2x focusDistance matches thin-lens formula (0.5 * aperture)', Math.abs(coc2x - expected2x) < 1e-9, `coc: ${coc2x}`);
  check('CoC at 4x focusDistance matches thin-lens formula (0.75 * aperture)', Math.abs(coc4x - expected4x) < 1e-9, `coc: ${coc4x}`);
  check('CoC at 4x is strictly greater than at 2x', coc4x > coc2x);

  // Foreground direction (z < fd) before clamp
  const zFg = [fd, fd * 0.9, fd * 0.8, fd * 0.7, fd * 0.6];
  const cocsFg = zFg.map((z) => calcCoC(z, fd, aperture, 100.0));

  let fgMonotonic = true;
  for (let i = 1; i < cocsFg.length; i++) {
    if (cocsFg[i]! <= cocsFg[i - 1]!) {
      fgMonotonic = false;
      break;
    }
  }
  check('CoC grows monotonically in foreground direction (z < focusDistance)', fgMonotonic, cocsFg.map((v) => v.toFixed(2)).join(', '));

  // Clamping at maxRadius
  const cocExtremeClose = calcCoC(0.001, fd, aperture, maxRadius);
  const cocExtremeFar = calcCoC(1e8, fd, 1000.0, maxRadius);
  check('CoC clamped at maxRadius for extreme foreground (z -> 0)', cocExtremeClose === maxRadius, `coc: ${cocExtremeClose}`);
  check('CoC clamped at maxRadius for extreme background (z -> inf)', cocExtremeFar === maxRadius, `coc: ${cocExtremeFar}`);
}

console.log('\n--- 3. Linear Depth Reconstruction Across Near/Far Range ---');
{
  const clipRanges = [
    { near: 0.1, far: 1000.0, name: 'standard perspective (0.1..1000)' },
    { near: 0.05, far: 400.0, name: 'raymarch perspective (0.05..400)' },
    { near: 1.0, far: 50.0, name: 'macro optics (1.0..50)' },
  ];

  for (const { near, far, name } of clipRanges) {
    // 0 buffer depth = near plane
    const zNear = linearizeDepth(0.0, near, far);
    check(`near clip plane reconstructs exactly [${name}]`, Math.abs(zNear - near) < 1e-7, `reconstructed: ${zNear}`);

    // 1 buffer depth = far plane
    const zFar = linearizeDepth(1.0, near, far);
    check(`far clip plane reconstructs accurately [${name}]`, Math.abs(zFar - far) / far < 1e-6, `reconstructed: ${zFar}`);

    // Sweep of intermediate world depths
    const testDepths = [near * 1.5, near * 5.0, 5.0, 10.0, 25.0, 50.0, far * 0.5, far * 0.9];
    let maxRelError = 0;
    for (const z of testDepths) {
      if (z <= near || z >= far) continue;
      // Perspective projection mapping depth z to zBuffer in [0, 1]:
      // z_buffer = (far / (far - near)) * (1 - near / z)
      const zBuffer = (far / (far - near)) * (1.0 - near / z);
      const zRec = linearizeDepth(zBuffer, near, far);
      const relErr = Math.abs(zRec - z) / z;
      maxRelError = Math.max(maxRelError, relErr);
    }
    check(`analytical depth sweep relative error < 1e-7 [${name}]`, maxRelError < 1e-7, `max rel err: ${maxRelError.toExponential(2)}`);
  }

  // Three.js PerspectiveCamera projection test
  const near = 0.1, far = 1000.0;
  const cam = new THREE.PerspectiveCamera(50, 16 / 9, near, far);
  cam.updateMatrixWorld(true);

  let camMaxErr = 0;
  const worldPoints = [0.2, 0.5, 1.0, 2.5, 5.0, 10.0, 25.0, 100.0, 500.0, 900.0];
  for (const z of worldPoints) {
    const v = new THREE.Vector3(0, 0, -z); // camera looks down -Z
    v.applyMatrix4(cam.projectionMatrix);
    // NDC z is in [-1, 1], WebGL depth buffer is in [0, 1]: (ndc + 1) / 2
    const zBuffer = v.z * 0.5 + 0.5;
    const zRecon = linearizeDepth(zBuffer, near, far);
    const relErr = Math.abs(zRecon - z) / z;
    camMaxErr = Math.max(camMaxErr, relErr);
  }
  check('THREE.PerspectiveCamera depth buffer linearizes accurately', camMaxErr < 1e-5, `max err: ${camMaxErr.toExponential(2)}`);
}

console.log('\n--- 4. Bokeh Diaphragm Aperture Simulation ---');
{
  // Circular aperture (blades = 0): unit disk
  const rInside = evalAperture(0.5, 0.5, 0, 1.0); // r = sqrt(0.5) ~ 0.707
  const rOutside = evalAperture(0.9, 0.9, 0, 1.0); // r = sqrt(1.62) ~ 1.27
  check('Circular aperture: interior point has transmission 1.0', rInside === 1.0);
  check('Circular aperture: exterior point has transmission 0.0', rOutside === 0.0);

  // Hexagonal aperture (blades = 6) with vertex on x-axis (angle = 0)
  // Vertex at (1.0, 0.0): point (0.9, 0.0) is inside near corner -> transmission 1.0
  const hexCorner = evalAperture(0.9, 0.0, 6, 1.0);
  // Facet midpoint is at angle 30 deg, distance to edge is cos(30 deg) = sqrt(3)/2 ~ 0.866
  // Point at angle 30 deg with r = 0.80 is inside -> transmission 1.0
  const hexInsideFace = evalAperture(0.80 * Math.cos(Math.PI / 6), 0.80 * Math.sin(Math.PI / 6), 6, 1.0);
  // Point at angle 30 deg with r = 0.98 is outside -> transmission 0.0
  const hexOutsideFace = evalAperture(0.98 * Math.cos(Math.PI / 6), 0.98 * Math.sin(Math.PI / 6), 6, 1.0);

  check('Hexagonal aperture: corner is inside polygon', hexCorner === 1.0);
  check('Hexagonal aperture: point inside facet has transmission 1.0', hexInsideFace === 1.0);
  check('Hexagonal aperture: point outside facet has transmission 0.0', hexOutsideFace === 0.0);

  // Anamorphic oval bokeh (anamorphicRatio = 2.0)
  // Horizontal axis is scaled by 2.0
  const ovalTallInside = evalAperture(0.0, 0.9, 0, 2.0); // x=0, y=0.9 -> r=0.9 -> inside
  const ovalWideOutside = evalAperture(0.9, 0.0, 0, 2.0); // x=0.9*2=1.8 -> r=1.8 -> outside
  const ovalNarrowInside = evalAperture(0.45, 0.0, 0, 2.0); // x=0.45*2=0.9 -> r=0.9 -> inside
  check('Anamorphic oval: vertical reach preserved (tall highlight)', ovalTallInside === 1.0);
  check('Anamorphic oval: horizontal reach compressed by 2x', ovalWideOutside === 0.0);
  check('Anamorphic oval: narrow horizontal offset inside oval', ovalNarrowInside === 1.0);
}

console.log('\n--- 5. Depth-Aware Bilateral Occlusion Weights ---');
{
  // Test A: Out-of-focus foreground bokeh bleeds outward over in-focus background
  const fgZ = 1.0;
  const fgCoC = 20.0; // Foreground object has 20px blur
  const bgZ = 10.0;
  const bgCoC = 0.0;  // Background is sharp at focal plane

  // Background center pixel, foreground sample at distance 10px <= fgCoC
  const wFgBleed = calcBilateralWeight(bgZ, bgCoC, fgZ, fgCoC, 10.0);
  check('Out-of-focus foreground bleeds over in-focus background', wFgBleed > 0.0, `weight: ${wFgBleed}`);

  // Test B: Blurred background does NOT contaminate sharp foreground edge
  const sharpFgZ = 2.0;
  const sharpFgCoC = 0.0; // Foreground is sharp at focal plane
  const blurredBgZ = 50.0;
  const blurredBgCoC = 24.0; // Background is out of focus

  // Foreground center pixel, background sample at distance 5px
  const wBgContam = calcBilateralWeight(sharpFgZ, sharpFgCoC, blurredBgZ, blurredBgCoC, 5.0);
  check('Blurred background does not contaminate sharp foreground edge', wBgContam === 0.0, `weight: ${wBgContam}`);
}

console.log('\n--- 6. Engine Integration & Render Target DepthBuffer Attachment ---');
{
  // Check makeRT with depthTexture: true
  const rtWithDepth = makeRT(W, H, { depthTexture: true });
  check('makeRT(..., { depthTexture: true }) attaches THREE.DepthTexture', rtWithDepth.depthTexture instanceof THREE.DepthTexture);
  check('depthTexture format is DepthFormat', rtWithDepth.depthTexture?.format === THREE.DepthFormat);
  check('depthTexture type is UnsignedIntType', rtWithDepth.depthTexture?.type === THREE.UnsignedIntType);
  check('depthTexture dimensions match render target', rtWithDepth.depthTexture?.image.width === rtWithDepth.width && rtWithDepth.depthTexture?.image.height === rtWithDepth.height);

  // Check Engine sceneRT getter exists on prototype
  const desc = Object.getOwnPropertyDescriptor(Engine.prototype, 'sceneRT');
  check('Engine prototype defines sceneRT getter', typeof desc?.get === 'function');

  // Check DepthDoFPass defaults and interface
  check('DEFAULT_DEPTH_DOF has focusDistance, aperture, maxRadius', DEFAULT_DEPTH_DOF.focusDistance === 5.0 && DEFAULT_DEPTH_DOF.aperture === 16.0);
  check('DepthDoFPass class is exported and has render method', typeof DepthDoFPass.prototype.render === 'function');
  check('DepthDoFPass class has dispose method', typeof DepthDoFPass.prototype.dispose === 'function');
  rtWithDepth.dispose();
}

console.log(`\n========================================`);
if (fails === 0) {
  console.log('ALL DEPTH DOF & BOKEH TESTS PASSED (0 failures)');
  process.exit(0);
} else {
  console.error(`TEST RUN FAILED (${fails} failures)`);
  process.exit(1);
}

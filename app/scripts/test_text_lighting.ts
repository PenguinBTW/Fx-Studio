#!/usr/bin/env bun
// Acceptance test for In-World Text Scene Lighting, Depth Buffer Participation & Occlusion (P10b)
// Run: bun scripts/test_text_lighting.ts
import * as THREE from 'three';
import {
  ensureDepthParticipation,
  applyInWorldLighting,
  createInWorldText,
  getTextLayout,
  computeTextCoC,
  computeGlyphCoC,
  partitionParticlesByTextDepth,
  computeGlyphDeflectionVector,
  deflectPointFromGlyph,
  InWorldTextHelper,
} from '../src/engine/text_lighting';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};

console.log('--- 1. Depth Participation & Lighting Materials ---');
{
  const geom = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial();
  mat.depthWrite = false;
  const mesh = new THREE.Mesh(geom, mat);
  ensureDepthParticipation(mesh);
  check('ensureDepthParticipation sets depthWrite=true', mesh.material.depthWrite === true);
  check('ensureDepthParticipation sets depthTest=true', mesh.material.depthTest === true);

  applyInWorldLighting(mesh, { roughness: 0.3, metalness: 0.8, color: 0xff0000 });
  check('applyInWorldLighting creates MeshStandardMaterial', mesh.material instanceof THREE.MeshStandardMaterial);
  check('material has depthWrite=true', mesh.material.depthWrite === true);
  check('material has depthTest=true', mesh.material.depthTest === true);
  const stdMat = mesh.material as unknown as THREE.MeshStandardMaterial;
  check('roughness applied', stdMat.roughness === 0.3);
  check('metalness applied', stdMat.metalness === 0.8);
}

console.log('\n--- 2. In-World Extruded Text & Layout Extraction ---');
{
  const textGroup = createInWorldText('IT DOES NOT BEND', {
    depth: 0.2,
    size: 1.0,
    roughness: 0.2,
    metalness: 0.9,
  });
  check('createInWorldText returns THREE.Group', textGroup instanceof THREE.Group);
  check('textGroup has child glyph meshes', textGroup.children.length > 0);

  const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const layout = getTextLayout(textGroup, camera);
  check('layout text contains all letters without spaces', layout.text === 'ITDOESNOTBEND');
  check('layout glyphs extracted (13 non-space characters)', layout.glyphs.length === 13);
  check('layout has finite bounding box', !isNaN(layout.boundingBox.min.x) && isFinite(layout.boundingBox.max.x));
  check('layout depth plane defined', layout.depthPlane instanceof THREE.Plane);
  check('layout obstacles array non-empty', layout.obstacles.length === 13);

  const firstGlyph = layout.getGlyph(0);
  check('getGlyph(0) returns first glyph (I)', firstGlyph?.char === 'I');
  check('first glyph center is finite V3', firstGlyph !== undefined && isFinite(firstGlyph.center[0]));
  check('first glyph obstacle has radius > 0', firstGlyph !== undefined && firstGlyph.obstacle.r > 0);
}

console.log('\n--- 3. Physical Depth-of-Field & CoC Integration ---');
{
  const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const textGroup = createInWorldText('FOCUS', { size: 1.0 });
  textGroup.position.set(0, 0, 0);
  textGroup.updateMatrixWorld(true);

  const layout = getTextLayout(textGroup, camera);
  // Camera is at (0, 0, 10), text bounding box center is layout.center
  const distToCenter = 10 - layout.center.z;

  const cocSharp = computeTextCoC(layout.center, camera, distToCenter, 32.0, 24.0);
  check('CoC is 0.0 at exact camera focus distance', Math.abs(cocSharp) < 1e-4, `got ${cocSharp}`);

  const cocBlur = computeTextCoC(layout.center, camera, distToCenter * 0.5, 32.0, 24.0);
  check('CoC is > 0 when text is away from focus distance', cocBlur > 5.0, `got ${cocBlur}`);

  const firstGlyph = layout.glyphs[0]!;
  const distToGlyph = 10 - firstGlyph.center[2];
  const glyphCoC = computeGlyphCoC(firstGlyph, camera, distToGlyph, 32.0);
  check('computeGlyphCoC is 0.0 at glyph focus distance', Math.abs(glyphCoC) < 1e-4);
}

console.log('\n--- 4. Particle Occlusion Partitioning ---');
{
  const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const textGroup = createInWorldText('WALL', { size: 1.0 });
  textGroup.position.set(0, 0, 0);
  textGroup.updateMatrixWorld(true);

  const layout = getTextLayout(textGroup, camera);

  // Particles: two in foreground (z = 2, 4), two in background (z = -2, -4)
  const particles: [number, number, number][] = [
    [0, 0, 2],
    [0, 0, 4],
    [0, 0, -2],
    [0, 0, -4],
  ];

  const partition = partitionParticlesByTextDepth(particles, layout, camera);
  check('partition has foreground particles', partition.foregroundIndices.length === 2);
  check('partition has background particles', partition.backgroundIndices.length === 2);
  check('foreground contains indices 0 and 1', partition.foregroundIndices.includes(0) && partition.foregroundIndices.includes(1));
  check('background contains indices 2 and 3', partition.backgroundIndices.includes(2) && partition.backgroundIndices.includes(3));
}

console.log('\n--- 5. Glyph World Bounds & Particle Deflection ---');
{
  const camera = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const textGroup = createInWorldText('DEFLECT', { size: 1.0 });
  textGroup.position.set(0, 0, 0);
  textGroup.updateMatrixWorld(true);

  const layout = getTextLayout(textGroup, camera);
  const glyph = layout.glyphs[0]!;

  // Point right next to glyph center
  const probePoint: [number, number, number] = [glyph.center[0] + 0.05, glyph.center[1], glyph.center[2]];
  const defVec = computeGlyphDeflectionVector(probePoint, glyph, 2.0);
  check('deflection vector is non-zero', defVec[0] !== 0 || defVec[1] !== 0 || defVec[2] !== 0);
  check('deflection vector points away from center (x > 0)', defVec[0] > 0);
  check('deflection vector is finite', isFinite(defVec[0]) && isFinite(defVec[1]) && isFinite(defVec[2]));

  // Point far away: deflection falls off to near zero (< 1e-4)
  const farPoint: [number, number, number] = [glyph.center[0] + 100, glyph.center[1], glyph.center[2]];
  const farDef = computeGlyphDeflectionVector(farPoint, glyph, 2.0);
  check('far point deflection is tiny (< 1e-4)', Math.hypot(farDef[0], farDef[1], farDef[2]) < 1e-4);

  // deflectPointFromGlyph pushes point away from center
  const pushed = deflectPointFromGlyph(probePoint, glyph);
  const origDist = 0.05;
  const newDist = Math.hypot(pushed[0] - glyph.center[0], pushed[1] - glyph.center[1], pushed[2] - glyph.center[2]);
  check('deflectPointFromGlyph pushes point outward (newDist > origDist)', newDist > origDist);
}

console.log('\n--- 6. InWorldTextHelper Static Facade ---');
{
  check('InWorldTextHelper.applyLighting is defined', typeof InWorldTextHelper.applyLighting === 'function');
  check('InWorldTextHelper.create3D is defined', typeof InWorldTextHelper.create3D === 'function');
  check('InWorldTextHelper.getLayout is defined', typeof InWorldTextHelper.getLayout === 'function');
  check('InWorldTextHelper.computeCoC is defined', typeof InWorldTextHelper.computeCoC === 'function');
  check('InWorldTextHelper.partitionParticles is defined', typeof InWorldTextHelper.partitionParticles === 'function');

  const textGroup = InWorldTextHelper.create3D('FACADE');
  check('InWorldTextHelper.create3D returns THREE.Group', textGroup instanceof THREE.Group);
  const layout = InWorldTextHelper.getLayout(textGroup);
  check('InWorldTextHelper.getLayout works', layout.glyphs.length === 6);
}

console.log(`\n${fails ? `${fails} FAILED` : 'ALL IN-WORLD TEXT LIGHTING TESTS PASSED'}`);
process.exit(fails ? 1 : 0);

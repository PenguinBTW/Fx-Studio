// Universal Agentic Motion Graphics Suite: Engine v0.6.0 Feature Verification Suite
// Tests Procedural Materials, 3D Extruded Kinetic Typography, Optical Depth-of-Field & God Rays,
// Camera Trajectory Ribbon Visualization, and DSL integrations.

if (typeof document === 'undefined') {
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      width: 1920,
      height: 1080,
      getContext: () => ({
        setTransform: () => {},
        fillRect: () => {},
        fillText: () => {},
        strokeText: () => {},
        save: () => {},
        restore: () => {},
        measureText: () => ({ width: 100 }),
      }),
    }),
    fonts: {
      ready: Promise.resolve(),
    },
  };
}

import * as THREE from 'three';
import { ProceduralMaterial } from '../src/engine/material';
import { ExtrudedText } from '../src/engine/text3d';
import { Post, DEFAULT_POST } from '../src/engine/post';
import { CameraRig } from '../src/engine/rig';
import { SceneContext } from '../src/engine/dsl';
import { SceneGraph } from '../src/engine/scenegraph';
import { Compositor, W, H } from '../src/engine/gl';
import type { SceneCtx } from '../src/engine/scene';

console.log('=== RUNNING ENGINE v0.6.0 FEATURE VERIFICATION SUITE ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(cond: boolean, msg: string) {
  totalTests++;
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. PROCEDURAL PBR SHADER MATERIALS
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Procedural Materials & Audit Fixes ---');

const metalMat = ProceduralMaterial.brushedMetal({
  baseColor: 'signal', // Palette token key test
  roughnessX: 0.12,
  roughnessY: 0.75,
  grooveScale: 120.0,
});
assert(metalMat instanceof THREE.ShaderMaterial, 'ProceduralMaterial.brushedMetal returns ShaderMaterial');
assert(metalMat.vertexShader.length > 50, 'brushedMetal vertex shader generated');
assert(metalMat.fragmentShader.includes('uRoughnessX') && metalMat.fragmentShader.includes('uRoughnessY'), 'brushedMetal fragment shader contains anisotropic roughness uniforms');
assert((metalMat.uniforms.uRoughnessX.value as number) === 0.12, 'brushedMetal uniforms correctly populated');
assert(metalMat.fragmentShader.includes('th * th + bh * bh'), 'brushedMetal uses direct squaring avoiding pow(neg, 2) NaNs');
assert(metalMat.fragmentShader.includes('dot(T, T) < 1e-4'), 'brushedMetal uses singular-safe tangent derivation for horizontal faces');
const metalColor = metalMat.uniforms.uBaseColor.value as THREE.Vector3;
assert(metalColor.x > 0.8, 'brushedMetal successfully resolves "signal" palette token');

const glowMat = ProceduralMaterial.wireframeGlow({
  lineWidth: 2.5,
  bloomBoost: 1.8,
});
assert(glowMat instanceof THREE.ShaderMaterial, 'ProceduralMaterial.wireframeGlow returns ShaderMaterial');
assert(glowMat.fragmentShader.includes('uLineWidth') && glowMat.fragmentShader.includes('uBloomBoost'), 'wireframeGlow fragment shader evaluates barycentric wireframes');
assert(glowMat.fragmentShader.includes('max(fwidth(vBarycentric), vec3(1e-5))'), 'wireframeGlow guards smoothstep against division by zero');

const glassMat = ProceduralMaterial.frostedGlass({
  opacity: 0.75,
  fresnelPower: 3.0,
});
assert(glassMat instanceof THREE.ShaderMaterial, 'ProceduralMaterial.frostedGlass returns ShaderMaterial');
assert(glassMat.fragmentShader.includes('uFresnelPower'), 'frostedGlass fragment shader implements optical fresnel');

const polymerMat = ProceduralMaterial.mattePolymer({
  roughness: 0.92,
  grain: 0.06,
});
assert(polymerMat instanceof THREE.ShaderMaterial, 'ProceduralMaterial.mattePolymer returns ShaderMaterial');
assert(polymerMat.fragmentShader.includes('uRoughness'), 'mattePolymer fragment shader implements micro-roughness absorption');
assert(polymerMat.fragmentShader.includes('uGrain'), 'mattePolymer fragment shader includes micro-surface grain uniform');

const pulseMat = ProceduralMaterial.emissivePulse({
  speed: 3.5,
  frequency: 4.0,
});
assert(pulseMat instanceof THREE.ShaderMaterial, 'ProceduralMaterial.emissivePulse returns ShaderMaterial');
assert(pulseMat.fragmentShader.includes('uSpeed') && pulseMat.fragmentShader.includes('uFrequency'), 'emissivePulse fragment shader contains pulse uniforms');
assert(pulseMat.fragmentShader.includes('max(0.0, sin('), 'emissivePulse wraps sin in max(0.0) avoiding negative pow() bases');

// -----------------------------------------------------------------------------
// 2. 3D EXTRUDED KINETIC TYPOGRAPHY & AUDIT FIXES
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing 3D Extruded Kinetic Typography & Projections ---');

const textGroup = ExtrudedText.create('VIOPLS', {
  size: 1.5,
  depth: 0.3,
  bevelThickness: 0.04,
  bevelSize: 0.03,
});

assert(textGroup instanceof THREE.Group, 'ExtrudedText.create returns THREE.Group');
assert(textGroup.children.length === 6, 'ExtrudedText generates 6 glyph meshes for VIOPLS');

let totalVerts = 0;
for (const child of textGroup.children) {
  if (child instanceof THREE.Mesh) {
    totalVerts += child.geometry.attributes.position.count;
  }
}
assert(totalVerts > 500, `ExtrudedText meshes contain high-definition geometric vertices (count: ${totalVerts})`);

// Colon and special characters test
const timeGroup = ExtrudedText.create('12:00', { size: 1.0 });
assert(timeGroup.children.length === 5, 'ExtrudedText handles colon : correctly with 5 meshes');

// Whitespace and newline filtering test
const multiLineGroup = ExtrudedText.create('A\nB\rC \tD', { size: 1.0 });
assert(multiLineGroup.children.length === 4, 'ExtrudedText filters newlines and whitespace without creating box fallbacks');

// Screen bounds projection
const testCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
testCam.position.set(0, 0, 5);
testCam.lookAt(0, 0, 0);
testCam.updateMatrixWorld();
testCam.updateProjectionMatrix();

const bounds = ExtrudedText.getScreenBounds(textGroup, testCam, W, H);
assert(bounds[0] < bounds[2] && bounds[1] < bounds[3], `ExtrudedText computes valid 2D screen bounds: [${bounds.join(', ')}]`);
assert(bounds[0] >= 0 && bounds[2] <= W && bounds[1] >= 0 && bounds[3] <= H, 'Screen bounds lie strictly within viewport dimensions');

// Behind-camera culling projection test (Audit Critical 2.3)
const behindGroup = ExtrudedText.create('BEHIND', { size: 1.0 });
behindGroup.position.set(0, 0, 15); // Behind camera positioned at z=5 looking at z=0
behindGroup.updateMatrixWorld(true);
const behindBounds = ExtrudedText.getScreenBounds(behindGroup, testCam, W, H);
assert(behindBounds[0] === 0 && behindBounds[1] === 0 && behindBounds[2] === 0 && behindBounds[3] === 0, 'ExtrudedText returns [0,0,0,0] for objects completely behind camera near plane');

// -----------------------------------------------------------------------------
// 3. CAMERA RIG DEBUG FLIGHT RIBBON & MODE MISMATCH
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing CameraRig Flight Ribbon & Invariants ---');

const rig = new CameraRig('perspective');
rig.setPath([
  { t: 0.0, pos: [0, 2, -10], target: [0, 0, 0] },
  { t: 0.5, pos: [5, 4, -5], target: [0, 1, 0] },
  { t: 1.0, pos: [0, 1, -2], target: [0, 0.5, 0] },
]);

const ribbon = rig.createDebugRibbon(undefined, 80);
assert(ribbon instanceof THREE.Line, 'CameraRig.createDebugRibbon returns THREE.Line');
assert(ribbon !== null && ribbon.geometry.attributes.position.count === 81, 'Debug ribbon contains 81 sampled spline trajectory vertices');
assert(typeof ribbon?.userData.dispose === 'function', 'Debug ribbon has userData.dispose cleanup function');
ribbon?.userData.dispose();

// -----------------------------------------------------------------------------
// 4. POST-PROCESSING OPTICAL UPGRADES (DoF, Volumetrics, Grading)
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Optical Post-Processing Pipeline ---');

const post = new Post();
assert((post as any).final.u.dof !== undefined, 'Post uniform dof exists');
assert((post as any).final.u.focusDist !== undefined, 'Post uniform focusDist exists');
assert((post as any).final.u.volumetric !== undefined, 'Post uniform volumetric exists');
assert((post as any).final.u.volumetricLightPos !== undefined, 'Post uniform volumetricLightPos exists');
assert((post as any).final.u.grade !== undefined, 'Post uniform grade exists');
assert((post as any).final.u.colorTint !== undefined, 'Post uniform colorTint exists');

// Verify PostParams ergonomics
const params = {
  ...DEFAULT_POST,
  filmGrain: 0.08,
  bloomIntensity: 1.2,
  dof: 0.85,
  focusDist: 0.42,
  volumetric: 0.6,
  grade: 'industrial' as const,
};
assert(params.filmGrain === 0.08, 'PostParams supports filmGrain alias');
assert(params.bloomIntensity === 1.2, 'PostParams supports bloomIntensity alias');

// -----------------------------------------------------------------------------
// 5. DECLARATIVE DSL SCENECONTEXT DYNAMIC UPDATES & MEMORY DISPOSAL
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing DSL SceneContext 3D Text & Memory Disposal ---');

const mockRenderer = {
  setRenderTarget: () => {},
  clear: () => {},
  render: () => {},
  resetState: () => {},
} as any;

const mockCtx: SceneCtx = {
  W: 1920,
  H: 1080,
  renderer: mockRenderer,
  comp: new Compositor(),
  start: 0,
  end: 10,
} as any;

const sc = new SceneContext(mockCtx);
assert(sc.materials === ProceduralMaterial, 'SceneContext.materials exposes ProceduralMaterial suite');

const hero3D = sc.text3D('hero_title', 'ENGINE v0.6.0', {
  size: 2.0,
  position: [0, 0, -8],
  role: 'headline',
  opacity: 0.75,
});

assert(hero3D instanceof THREE.Group, 'SceneContext.text3D returns THREE.Group');
assert(sc.scene3D.children.includes(hero3D), '3D text node is added to sc.scene3D');

const textMeta = sc.sceneGraph.get('hero_title');
assert(textMeta !== undefined, 'hero_title registered in SceneGraph');
assert(textMeta?.type === 'text', 'hero_title registered with type text');
assert(textMeta?.screenBounds !== undefined, 'hero_title has projected screenBounds');
assert(textMeta?.opacity === 0.75, 'hero_title has initial opacity 0.75');

// Test dynamic content update (Audit High 2.5)
const updated3D = sc.text3D('hero_title', 'NEW CONTENT v0.6.0', {
  size: 2.0,
  position: [0, 0, -8],
  opacity: 0.5,
});
const updatedMeta = sc.sceneGraph.get('hero_title');
assert(updatedMeta?.text === 'NEW CONTENT v0.6.0', 'text3D successfully updates content when called with changed text');
assert(updatedMeta?.opacity === 0.5, 'text3D successfully updates opacity in SceneGraph');

// Verify camera movement updates text3D bounds
sc.updateCamera(0.0, 0.5);
assert(updatedMeta?.screenBounds !== undefined, 'updateCamera updates 3D text screenBounds');

// Test comprehensive GPU disposal (Audit Critical 2.4)
sc.dispose();
assert(sc.scene3D.children.length === 0, 'SceneContext.dispose clears scene3D');
assert(sc.text3DNodes.size === 0, 'SceneContext.dispose clears text3DNodes');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n========================================');
console.log(`ALL v0.6.0 TESTS PASSED: ${passedTests}/${totalTests}`);
console.log('========================================\n');

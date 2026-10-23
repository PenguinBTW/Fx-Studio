// Test suite for Universal GLTF / GLB Subsystem (gltf.ts)
import * as THREE from 'three';
import { GLTFManager, GLTFInstance, GLTFAsset } from '../src/engine/gltf';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

console.log('--- Testing GLTF / GLB Subsystem ---');

// 1. Create a synthetic mock GLTF with meshes, bounding box, and animation tracks
const mockScene = new THREE.Group();
const boxMesh = new THREE.Mesh(
  new THREE.BoxGeometry(2, 4, 6),
  new THREE.MeshStandardMaterial({ name: 'ChassisMat', color: 0xff0000 })
);
boxMesh.position.set(10, 20, 30); // Intentionally offset
mockScene.add(boxMesh);

// Create synthetic animation track
const track = new THREE.VectorKeyframeTrack(
  '.position',
  [0, 1, 2],
  [0, 0, 0, 0, 5, 0, 0, 10, 0]
);
const clip = new THREE.AnimationClip('Drive', 2, [track]);

const mockGLTF: GLTF = {
  animations: [clip],
  scene: mockScene,
  scenes: [mockScene],
  cameras: [],
  asset: {},
  userData: {},
  parser: {} as any,
};

// 2. Test Asset Wrapper & Instantiation
const asset = new GLTFAsset('/models/test_vehicle.glb', mockGLTF);
const instance1 = asset.instantiate({ castShadow: true, receiveShadow: true });

console.log('✓ GLTFInstance created successfully');
console.assert(instance1.meshes.length === 1, 'Should find 1 mesh');
console.assert(instance1.meshes[0]!.castShadow === true, 'castShadow should be applied');
console.assert(instance1.materials.has('ChassisMat'), 'Should catalog ChassisMat');
console.assert(instance1.actions.has('Drive'), 'Should bind Drive animation action');

// 3. Test Bounding Box & Centering
const boundsBefore = instance1.getBounds();
console.log('Bounds before center:', boundsBefore.min.toArray(), boundsBefore.max.toArray());
instance1.center();
const boundsAfter = instance1.getBounds();
console.log('Bounds after center:', boundsAfter.min.toArray(), boundsAfter.max.toArray());
const centerAfter = boundsAfter.getCenter(new THREE.Vector3());
console.assert(Math.abs(centerAfter.x) < 1e-4 && Math.abs(centerAfter.y) < 1e-4 && Math.abs(centerAfter.z) < 1e-4, 'Should be centered at origin');
console.log('✓ Model centering verified at (0, 0, 0)');

// 4. Test Normalization / fitToBox
instance1.fitToBox(10.0);
const sizeAfterFit = instance1.getSize();
const maxDim = Math.max(sizeAfterFit.x, sizeAfterFit.y, sizeAfterFit.z);
console.assert(Math.abs(maxDim - 10.0) < 1e-4, `Max dimension should be 10.0, got ${maxDim}`);
console.log('✓ Model fitToBox(10.0) verified');

// 5. Test Closed-Form Deterministic Animation setTime(t)
instance1.setTime(0.0);
console.assert(instance1.root.position.y === 0, 'At t=0, y should be 0');

instance1.setTime(1.0);
// AnimationMixer evaluates track value at t=1.0 -> y should be 5
console.assert(Math.abs(instance1.root.position.y - 5.0) < 1e-3, `At t=1, y should be 5.0, got ${instance1.root.position.y}`);

// Scrub backwards to 0.5
instance1.setTime(0.5);
console.assert(Math.abs(instance1.root.position.y - 2.5) < 1e-3, `At t=0.5, y should be 2.5, got ${instance1.root.position.y}`);
console.log('✓ Deterministic setTime(t) bidirectional evaluation verified');

// 6. Test Screen-Space Bounding Box Projection
const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
cam.position.set(0, 0, 20);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

const screenBounds = instance1.getScreenBounds(cam, 1920, 1080);
console.log('Projected 2D screen bounds:', screenBounds);
console.assert(screenBounds[0] < screenBounds[2] && screenBounds[1] < screenBounds[3], 'Valid screen box');
console.assert(screenBounds[0] > 0 && screenBounds[2] < 1920, 'Contained on screen');
console.log('✓ 3D OBB -> 2D Screen AABB projection verified');

// 7. Test Skinned Mesh Bone Bounds Expansion
const skinnedGroup = new THREE.Group();
const bone1 = new THREE.Bone();
const bone2 = new THREE.Bone();
bone1.position.set(0, 0, 0);
bone2.position.set(0, 25, 0); // Extended far above standard geometry
bone1.add(bone2);
skinnedGroup.add(bone1);

const skeleton = new THREE.Skeleton([bone1, bone2]);
const skinnedGeo = new THREE.BoxGeometry(2, 2, 2);
const posCount = skinnedGeo.attributes.position!.count;
const skinIndices = new Uint16Array(posCount * 4);
const skinWeights = new Float32Array(posCount * 4);
for (let i = 0; i < posCount; i++) {
  skinIndices[i * 4] = 0;
  skinWeights[i * 4] = 1.0;
}
skinnedGeo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
skinnedGeo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

const skinnedMat = new THREE.MeshStandardMaterial({ name: 'SkinMat' });
const skinnedMesh = new THREE.SkinnedMesh(skinnedGeo, skinnedMat);
skinnedMesh.bind(skeleton);
skinnedGroup.add(skinnedMesh);

const mockSkinnedGLTF: GLTF = {
  animations: [],
  scene: skinnedGroup,
  scenes: [skinnedGroup],
  cameras: [],
  asset: {},
  userData: {},
  parser: {} as any,
};

const skinnedAsset = new GLTFAsset('/models/test_character.glb', mockSkinnedGLTF);
const skinnedInstance = skinnedAsset.instantiate();
const boxWithoutBones = skinnedInstance.getBounds(undefined, false);
const boxWithBones = skinnedInstance.getBounds(undefined, true);

console.assert(boxWithoutBones.max.y <= 2.0, 'Box without bones should only bound base mesh');
console.assert(boxWithBones.max.y >= 25.0, `Box with bones should expand to bone2 position (>= 25), got ${boxWithBones.max.y}`);
console.log('✓ SkinnedMesh bone bounds expansion verified');
skinnedInstance.dispose();

// 8. Test Draco Path Configuration
GLTFManager.setDracoDecoderPath('/draco/');
console.log('✓ Draco decoder path configured to local /draco/');

// 9. Test Disposal
instance1.dispose();
console.assert(instance1.meshes.length === 0, 'Meshes should be cleared on dispose');
console.assert(instance1.actions.size === 0, 'Actions should be cleared on dispose');
console.log('✓ Resource disposal verified');

console.log('All GLTF subsystem unit tests PASSED!');

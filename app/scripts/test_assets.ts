#!/usr/bin/env bun
// Asset layer tests: GLB preflight parsing + GLTFInstance parts / morphs / clip blending / clip defaults.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as THREE from 'three';
import { inspectAsset, parseGlb } from './assets_check';
import { GLTFInstance } from '../src/engine/gltf';
import { indexAssets } from '../src/engine/assets';

let failed = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;

function makeGlb(json: any, bin: Uint8Array): Uint8Array {
  const pad = (n: number) => (4 - (n % 4)) % 4;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  jsonBytes = new Uint8Array([...jsonBytes, ...new Array(pad(jsonBytes.length)).fill(0x20)]);
  const binBytes = new Uint8Array([...bin, ...new Array(pad(bin.length)).fill(0)]);
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jsonBytes, 20);
  const o = 20 + jsonBytes.length;
  dv.setUint32(o, binBytes.length, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(binBytes, o + 8);
  return out;
}

// --- preflight ---
const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const gltfJson = {
  asset: { version: '2.0' },
  buffers: [{ byteLength: positions.byteLength }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
  materials: [{ name: 'Hull' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }], extras: { targetNames: ['Smile'] } }],
  nodes: [{ name: 'Rotor_Mesh', mesh: 0, extras: { fx_part: 'rotor' } }, { name: 'Body', mesh: 0 }],
  animations: [{ name: 'Spin', channels: [], samplers: [] }],
  scenes: [{ nodes: [0, 1] }],
};
const glb = makeGlb(gltfJson, new Uint8Array(positions.buffer));
ok(parseGlb(glb).nodes.length === 2, 'parseGlb reads JSON chunk');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-assets-'));
const assetDir = path.join(tmp, 'proj', 'assets', 'turbine');
const matDir = path.join(tmp, 'proj', 'materials');
fs.mkdirSync(assetDir, { recursive: true });
fs.mkdirSync(matDir, { recursive: true });
fs.writeFileSync(path.join(assetDir, 'model.glb'), glb);
let r = inspectAsset(assetDir, 'proj', 'turbine', matDir);
ok(r.errors.length === 0, `clean asset has no errors (${r.errors.join('; ')})`);
ok(r.stats.tris === 2, `tris counted per node instance (${r.stats.tris})`);
ok(r.stats.parts.join() === 'rotor' && r.stats.morphs.join() === 'Smile' && r.stats.clips.join() === 'Spin', 'parts / morphs / clips discovered');

fs.writeFileSync(path.join(assetDir, 'manifest.json'), JSON.stringify({
  parts: { body: 'Body', ghost: 'Missing' }, materials: { Hull: 'brushed', Paint: 'x' }, clips: { Walk: {} }, budgets: { tris: 1 },
}));
fs.writeFileSync(path.join(matDir, 'brushed.ts'), 'export default null;');
r = inspectAsset(assetDir, 'proj', 'turbine', matDir);
const errs = r.errors.join('\n');
ok(/ghost/.test(errs) && /'Paint'/.test(errs) && /x\.ts/.test(errs) && /'Walk'/.test(errs) && /budget 1/.test(errs), 'manifest problems reported');
ok(!/brushed/.test(errs) && r.stats.parts.includes('body'), 'valid manifest entries accepted');

const ext = makeGlb({ ...gltfJson, extensionsRequired: ['EXT_meshopt_compression'], extensionsUsed: ['EXT_meshopt_compression'], images: [{ uri: 'tex.png' }] }, new Uint8Array(positions.buffer));
fs.writeFileSync(path.join(assetDir, 'model.glb'), ext);
fs.rmSync(path.join(assetDir, 'manifest.json'));
r = inspectAsset(assetDir, 'proj', 'turbine', matDir);
const instJson = { ...gltfJson, accessors: [...gltfJson.accessors, { componentType: 5126, count: 10, type: 'VEC3' }], nodes: [{ name: 'Rock', mesh: 0, extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 1 } } } }] };
fs.writeFileSync(path.join(assetDir, 'model.glb'), makeGlb(instJson, new Uint8Array(positions.buffer)));
ok(inspectAsset(assetDir, 'proj', 'turbine', matDir).stats.tris === 10, 'GPU-instanced meshes count every instance');
fs.writeFileSync(path.join(assetDir, 'model.glb'), ext);
ok(r.errors.some((e) => e.includes('EXT_meshopt_compression')) && r.errors.some((e) => e.includes('tex.png')), 'unsupported extension and external URI rejected');
fs.rmSync(tmp, { recursive: true, force: true });

// --- registry ---
const reg = indexAssets(
  { '../scenes/p/assets/turbine/manifest.json': { id: 'jet', clips: { Spin: { loop: true } } } },
  { '../scenes/p/assets/turbine/model.glb': '/u/turbine.glb', '../scenes/p/assets/rock/rock_v2.glb': '/u/rock.glb' },
);
ok(reg.get('p/jet')?.url === '/u/turbine.glb' && reg.get('p/jet')?.manifest.clips?.Spin?.loop === true, 'registry resolves model + manifest under assets/');
ok(reg.get('p/rock')?.url === '/u/rock.glb', 'registry falls back to the only .glb in the folder');

// --- GLTFInstance ---
const geom = new THREE.BufferGeometry();
geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
const morph = new THREE.BufferAttribute(new Float32Array(9), 3);
morph.name = 'Smile';
geom.morphAttributes.position = [morph];
const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ name: 'Hull' }));
mesh.name = 'rotor_node';
mesh.userData.fx_part = 'rotor';
mesh.updateMorphTargets();
const root = new THREE.Group();
root.add(mesh);
const move = new THREE.AnimationClip('Move', 1, [new THREE.VectorKeyframeTrack('rotor_node.position', [0, 1], [0, 0, 0, 10, 0, 0])]);
const up = new THREE.AnimationClip('Up', 1, [new THREE.VectorKeyframeTrack('rotor_node.position', [0, 1], [0, 0, 0, 0, 10, 0])]);
const inst = new GLTFInstance({ animations: [move, up], scene: root } as any, root);

ok(inst.part('rotor') === mesh, 'fx_part custom property becomes a part handle');
let threw = false; try { inst.part('nope'); } catch { threw = true; }
ok(threw, 'missing part throws');
ok(inst.clipNames.join() === 'Move,Up' && inst.morphTargets.has('Smile'), 'clipNames and morphTargets exposed');

inst.setMorph('Smile', 0.7);
ok(near(mesh.morphTargetInfluences![0]!, 0.7), 'setMorph drives shape key weight');

inst.setTime(0.25, 'Move');
ok(near(mesh.position.x, 2.5) && near(mesh.position.y, 0), 'setTime evaluates the named clip only');
inst.setClips(0.5, { Move: 1, Up: 1 });
ok(near(mesh.position.x, 2.5) && near(mesh.position.y, 2.5), `setClips blends by weight (${mesh.position.x.toFixed(3)}, ${mesh.position.y.toFixed(3)})`);
inst.setClips(0.25, { Up: 1 });
ok(near(mesh.position.x, 0) && near(mesh.position.y, 2.5), 'setClips zeroes unlisted clips');
inst.setClips(0, { Move: { weight: 1, time: 0.3 } });
ok(near(mesh.position.x, 3), 'setClips per-clip time');
ok(inst.clipDuration('Move') === 1 && inst.clipDuration('nope') === 0, 'clipDuration');
inst.setClips(1.5, { Move: 1 }, { loop: false });
ok(near(mesh.position.x, 10), 'one-shot blend clamps at the end');
inst.setClips(0.1, { Move: 1 }, { loop: false });
ok(near(mesh.position.x, 1), 'one-shot blend scrubs backwards');

inst.setClips(0.5, { Move: 0.4, Up: 1 });
inst.setTime(0.5, 'Move');
ok(near(mesh.position.x, 5) && near(mesh.position.y, 0), 'setTime after setClips plays one clip at full weight');

inst.clipDefaults = { Move: { offset: 0.5 } };
inst.setTime(0, 'Up');
inst.setTime(0, 'Move');
ok(near(mesh.position.x, 5), 'clipDefaults offset applied by setTime');

// Blender names, flat 'fx.part' key, light target relink, per-part morph
const g2 = new THREE.Group();
const sanitized = new THREE.Object3D(); sanitized.name = 'Rotor001_1'; sanitized.userData.name = 'Rotor.001';
const literal = new THREE.Object3D(); literal.name = 'Rotor001'; literal.userData.name = 'Rotor001'; g2.add(literal);
const flat = new THREE.Object3D(); flat.userData['fx.part'] = 'hatch';
const sun = new THREE.DirectionalLight(); g2.add(sanitized, flat, sun); g2.remove(sun.target);
const m2 = new THREE.Mesh(geom.clone(), new THREE.MeshBasicMaterial()); m2.userData.fx_part = 'face'; m2.updateMorphTargets();
const m3 = new THREE.Mesh(geom.clone(), new THREE.MeshBasicMaterial()); m3.updateMorphTargets();
g2.add(m2, m3);
const i2 = new GLTFInstance({ animations: [], scene: g2 } as any, g2);
ok(i2.node('Rotor.001') === sanitized && i2.node('Rotor001_1') === sanitized && i2.node('Rotor001') === literal, 'node() prefers the Blender name, then the sanitized name');
ok(i2.part('hatch') === flat, "flat 'fx.part' custom property recognised");
ok(sun.target.parent === sun && i2.lights.length === 1, 'directional light target re-linked');
i2.setMorph('Smile', 0.5, 'face');
ok(near(m2.morphTargetInfluences![0]!, 0.5) && near(m3.morphTargetInfluences![0]!, 0), 'setMorph scoped to a part');

// material isolation: envMapIntensity overrides must not cross-contaminate instances
{
  const sharedMat = new THREE.MeshStandardMaterial({ name: 'Shared' });
  const mA = new THREE.Mesh(geom.clone(), sharedMat);
  const rootAB = new THREE.Group();
  rootAB.add(mA);
  const assetScene = { animations: [], scene: rootAB } as any;
  // simulate a second instance via an independent clone the way GLTFAsset.instantiate does
  const iA = new GLTFInstance(assetScene, rootAB.clone(true), { envMapIntensity: 0.2 } as any);
  // note: instances share the same material object unless the constructor clones it
  const iB = new GLTFInstance(assetScene, rootAB.clone(true), { envMapIntensity: 1.5 } as any);
  const matA = iA.meshes[0]!.material as THREE.MeshStandardMaterial;
  const matB = iB.meshes[0]!.material as THREE.MeshStandardMaterial;
  ok(matA !== matB && near(matA.envMapIntensity, 0.2) && near(matB.envMapIntensity, 1.5), 'envMapIntensity instances are isolated');
  ok(near(sharedMat.envMapIntensity, 1.0), 'master material untouched by instance overrides');
  let disposeFired = 0;
  for (const m of iA.ownedMaterials) {
    const orig = m.dispose.bind(m);
    m.dispose = () => { disposeFired++; orig(); };
  }
  const ownedBefore = iA.ownedMaterials.length;
  iA.dispose();
  ok(ownedBefore > 0 && disposeFired === ownedBefore && iA.ownedMaterials.length === 0, 'instance clones disposed exactly once');
}

console.log(failed ? `\n${failed} asset test(s) FAILED` : '\nall asset tests passed');
if (failed) process.exit(1);

// THRESHOLD asset turntable tool: inspect wave-A GLBs under the shared flashlight rig.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey } from '../threshold/fp_cam';
import { FlashlightRig, beamStateAt } from '../threshold/flashlight';
import { thresholdPost } from '../threshold/sensor_post';

const IDS = ['beige_phone', 'lint', 'tenant_arm', 'tenant_full'] as const;
const META = [
  { dist: 0.72, height: 0.72, target: 0.08, scale: 1 },
  { dist: 0.24, height: 0.15, target: 0.055, scale: 1 },
  { dist: 3.8, height: 1.05, target: 0.05, scale: 1 },
  { dist: 7.2, height: 2.05, target: 2.0, scale: 1 },
];

export default class ThresholdTurntable extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(48, 16 / 9, 0.01, 80);
  private flash = new FlashlightRig();
  private insts: GLTFInstance[] = [];

  override async init() {
    this.s.background = new THREE.Color(0x030508);
    this.s.fog = new THREE.FogExp2(0x030508, 0.08);
    this.s.add(new THREE.HemisphereLight(0x24384c, 0x050303, 0.18));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.55, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.015;
    this.s.add(floor);
    this.insts = await Promise.all(IDS.map((id) => GLTFManager.instantiate(resolveAsset(`threshold/${id}`).url, {})));
    for (const inst of this.insts) {
      inst.root.visible = false;
      inst.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
      this.s.add(inst.root);
    }
    this.s.add(this.flash.group);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = Math.max(0, Math.min(39.999, f.t));
    const segment = Math.floor(t / 10);
    const view = Math.floor(t % 10);
    const meta = META[segment]!;
    for (const [i, inst] of this.insts.entries()) {
      inst.root.visible = i === segment;
      inst.root.rotation.set(0, (i === 2 ? Math.PI / 2 : 0) + (view / 6) * Math.PI * 2, 0);
      inst.root.position.set(0, i === 1 ? 0.065 : 0, 0);
      inst.root.scale.setScalar(meta.scale);
    }
    const keys: FPKey[] = [{ t: 0, pos: [0, meta.height, meta.dist], yaw: 0, pitch: -Math.atan2(meta.height - meta.target, meta.dist), fov: 48, gait: 'still' }];
    const pose = evalFirstPerson(keys, 0, 'still');
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    this.flash.update(pose, 10, beamStateAt(10, 0), () => pose.forward);
    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(0x020306, 1);
    r.clear(true, true, true);
    r.render(this.s, this.cam);
    r.resetState();
    return thresholdPost(10, { darkness: 0.4, stress: 0 });
  }

  override dispose() {
    this.flash.dispose();
  }
}

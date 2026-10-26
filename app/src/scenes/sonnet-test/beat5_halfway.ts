// BEAT 4b: HALFWAY (69.3 - 72 s). The slider from Beat 0, key light at full, the knob resting
// exactly halfway along its travel with the red sliver half revealed. Hard cut to black at 72.0.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { prog, ease } from '../../engine/util';
import { DoorEdge } from './door';
import { DOOR_FOV, DOOR_REST_Z, MARKERS } from './timing';
import { HEX } from './palette';

export default class Beat5Halfway extends Scene {
  private door = new DoorEdge();
  private scene3D = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(DOOR_FOV, W / H, 0.002, 2);

  override init() { this.scene3D.add(this.door.group); }

  probe(f: Frame) { return { halfway: f.t >= MARKERS.HALFWAY ? 1 : 0 }; }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const st = this.door.update(t, 0.5);
    // pull-back from the diagram scale lands on the same 85 mm framing as Beat 0
    const z = t < 70 ? DOOR_REST_Z * Math.pow(0.075 / DOOR_REST_Z, 1 - ease.inOutCubic(prog(t, 68.6, 70.0))) : DOOR_REST_Z * (1 - 0.006 * (t - 70) / 2);
    this.cam.position.set(-0.0035, 0, z);
    this.cam.lookAt(-0.0035, 0, 0);
    this.cam.near = Math.max(0.002, z - 0.05);
    this.cam.far = z + 0.2;
    this.cam.updateProjectionMatrix();

    renderer.setRenderTarget(out);
    renderer.setClearColor(HEX.void, 1);
    renderer.clear(true, true, true);
    if (t < 72) renderer.render(this.scene3D, this.cam);
    renderer.resetState();

    const k = new THREE.Vector3(st.knobX, 0, -0.0004).project(this.cam);
    return {
      exposure: 0.8 + 0.2 * ease.inOutCubic(prog(t, 67.8, 70.4)), bloom: 0.6, bloomThreshold: 0.8, bloomRadius: 0.5, halation: 0,
      vignette: 0.25, grain: 0.035, ca: 0.0006 * 960,
      dof: 1, focusDist: Math.hypot(k.x * 0.5 * (W / H), k.y * 0.5), focalRange: 0.07, dofRadius: 5.5,
    };
  }
}

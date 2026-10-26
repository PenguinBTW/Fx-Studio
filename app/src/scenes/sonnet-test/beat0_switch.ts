// BEAT 0: THE SWITCH (0 - 8 s, held to 8.8 s for the slot_breach seam)
// Door edge, strip key light sweeping left to right, a 2 cm dolly, and the knob click at 5.2 s.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp } from '../../engine/util';
import { DoorEdge } from './door';
import { DOOR_FOV, doorCamZ, MARKERS } from './timing';
import { HEX } from './palette';

export default class Beat0Switch extends Scene {
  private door = new DoorEdge();
  private scene3D = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(DOOR_FOV, W / H, 0.002, 2);

  override init() {
    this.scene3D.add(this.door.group);
  }

  /** Current marker (exposed for tooling). */
  probe(f: Frame) {
    return { lockClick: f.t >= MARKERS.LOCK_CLICK ? 1 : 0 };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const st = this.door.update(t);
    const z = doorCamZ(t);
    // the dolly drifts toward the knob so it stays the focal anchor
    this.cam.position.set(-0.0035 * clamp(t / 8), 0, z);
    this.cam.lookAt(-0.0035 * clamp(t / 8), 0, 0);
    this.cam.near = Math.max(0.002, z - 0.05);
    this.cam.far = z + 0.2;
    this.cam.updateProjectionMatrix();

    renderer.setRenderTarget(out);
    renderer.setClearColor(HEX.void, 1);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.cam);
    renderer.resetState();

    // focus locked on the knob (f/1.4 look): project the knob to find its radial screen distance
    const k = new THREE.Vector3(st.knobX, 0, -0.0004).project(this.cam);
    const focus = Math.hypot((k.x * 0.5) * (W / H), k.y * 0.5);
    return {
      exposure: 1.0, bloom: 0.6, bloomThreshold: 0.8, bloomRadius: 0.5, halation: 0.0,
      vignette: 0.25, grain: 0.035, ca: 0.0006 * 1920 * 0.5,
      dof: 1, focusDist: focus, focalRange: 0.07, dofRadius: 5.5,
    };
  }
}

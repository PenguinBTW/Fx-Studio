// =============================================================================
// SCENE: "CHLADNI" — order from vibration (22.5s continuous master scene)
//
// Beat A (0.0 - 3.5):  The quiet plate — grains lie as noise, rig wakes
// Beat B (3.5 - 9.0):  Mode (1,2) 482 Hz — first figure assembles
// Beat C (9.0 - 15.0): Mode (2,3) 1097 Hz — macro on the re-sort
// Beat D (15.0 - 22.5): Mode (3,4) 2052 Hz — pull-back hero reveal
//
// Palette: --ink void, --bone grains/edges, --ash secondary lines,
// --signal ONLY the rim pulse + LED flare at each resonant step.
// =============================================================================

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { LineBatch } from '../../engine/lines';
import { W, H } from '../../engine/gl';
import { clamp, lerp } from '../../engine/util';
import { HEX, LIN } from '../../engine/palette';
import { GrainField, STEP_TIMES, PLATE_HALF } from './grains';
import { DriveRig, cameraAt, rimPulseAt } from './drive';

export default class ChladniScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(36, W / H, 0.005, 100);
  private grains = new GrainField();
  private rig = new DriveRig();
  private bench = new LineBatch(8000, { blend: 'max' });
  private pulseRing!: THREE.Mesh;
  private pulseMat!: THREE.MeshBasicMaterial;

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.background = new THREE.Color(HEX.ink);
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(HEX.ink), 0.55);

    // Motivated single-world lighting: the lamp above the plate + cool rim fill
    const key = new THREE.SpotLight(new THREE.Color(HEX.bone), 2.2, 4, 0.5, 0.5, 1.6);
    key.position.set(0, 0.40, 0);
    key.target.position.set(0, 0, 0);
    this.scene3D.add(key, key.target);
    const rim = new THREE.DirectionalLight(new THREE.Color('#8fa3c4'), 0.3);
    rim.position.set(-0.4, 0.25, -0.5);
    this.scene3D.add(rim);
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(HEX.ink), 0.25));

    this.scene3D.add(this.rig.group);
    this.scene3D.add(this.grains.mesh);

    // Rim pulse ring hugging the plate edge — flares --signal per step
    this.pulseMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(HEX.signal),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.pulseRing = new THREE.Mesh(new THREE.TorusGeometry(PLATE_HALF * 1.06, 0.0012, 8, 96), this.pulseMat);
    this.pulseRing.rotation.x = Math.PI / 2;
    this.pulseRing.position.y = 0.006;
    this.scene3D.add(this.pulseRing);

    // Faint wireframe bench context (ash, depth-faded grid)
    const A = LIN.ash;
    const g = 0.12;
    for (let i = -5; i <= 5; i++) {
      const f = 1.0 - 0.5 * clamp(Math.abs(i) / 5);
      const a = 0.16 * f;
      this.bench.seg(i * g, -0.065, -0.6, i * g, -0.065, 0.6, 0.0006, A[0], A[1], A[2], a);
      this.bench.seg(-0.6, -0.065, i * g, 0.6, -0.065, i * g, 0.0006, A[0], A[1], A[2], a);
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;

    const cam = cameraAt(t);
    this.camera3D.fov = cam.fov;
    this.camera3D.position.copy(cam.pos);
    this.camera3D.lookAt(cam.target);
    this.camera3D.updateProjectionMatrix();

    this.rig.update(t);
    this.grains.update(t);

    const rp = rimPulseAt(t);
    this.pulseMat.opacity = rp * 0.85;
    const rs = 1 + 0.18 * (1 - rp);
    this.pulseRing.scale.set(rs, rs, 1);

    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    this.bench.flush(renderer, out, this.camera3D);
    renderer.resetState();

    // Beat-aware grade: warm exposure under the lamp; mild DoF during the macro beat
    const macro = clamp((t - 9.0) / 2.0) * (1 - clamp((t - 15.0) / 2.0));
    return {
      exposure: 0.92,
      bloom: 0.3 + rp * 0.3,
      bloomThreshold: 0.88,
      bloomRadius: 0.4,
      vignette: 0.32,
      grain: 0.04,
      ca: 0.25,
      dof: macro * 0.7,
      focusDist: 0.06,
      focalRange: 0.32,
      dofRadius: 5,
      fade: lerp(1, 0, clamp(t / 0.4)),
    };
  }
}

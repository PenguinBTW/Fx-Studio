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
// The machined rig is a Blender asset (assets/rig); dynamic electronics
// (display, LED) live in drive.ts.
// =============================================================================

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp, lerp } from '../../engine/util';
import { HEX } from '../../engine/palette';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { GrainField, PLATE_HALF } from './grains';
import { Readout, cameraAt, rimPulseAt } from './drive';

/** Bulb position inside the lamp head (assets/rig/build.py) — the motivated key. */
const BULB_POS = new THREE.Vector3(0.026, 0.273, 0.095);
const PLATE_CENTRE = new THREE.Vector3(0, 0, 0);

export default class ChladniScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(36, W / H, 0.005, 100);
  private grains = new GrainField();
  private readout = new Readout();
  private rig!: GLTFInstance;
  private ownMats!: Map<THREE.Material, THREE.Material>;
  private pulseRing!: THREE.Mesh;
  private pulseMat!: THREE.MeshBasicMaterial;

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.background = new THREE.Color(HEX.ink);
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(HEX.ink), 0.55);

    // The machined rig — materials cloned so grade tweaks stay local to this instance.
    this.rig = await GLTFManager.instantiate(resolveAsset('rig', 'chladni').url, {});
    this.ownMats = new Map<THREE.Material, THREE.Material>();
    const own = this.ownMats;
    this.rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mine = (x: THREE.Material) => {
          let c = own.get(x);
          if (!c) own.set(x, (c = x.clone()));
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(mine) : mine(m.material);
      }
    });
    this.scene3D.add(this.rig.root);

    // Motivated single-world lighting: the lamp's bulb over the plate + cool rim fill
    const key = new THREE.SpotLight(new THREE.Color(HEX.bone), 2.1, 4, 0.62, 0.5, 1.6);
    key.position.copy(BULB_POS);
    key.target.position.copy(PLATE_CENTRE);
    this.scene3D.add(key, key.target);
    const rim = new THREE.DirectionalLight(new THREE.Color('#8fa3c4'), 0.32);
    rim.position.set(-0.4, 0.25, -0.5);
    this.scene3D.add(rim);
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(HEX.ink), 0.28));

    this.scene3D.add(this.readout.group);
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
    this.pulseRing.position.y = 0.004;
    this.scene3D.add(this.pulseRing);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;

    const cam = cameraAt(t);
    this.camera3D.fov = cam.fov;
    this.camera3D.position.copy(cam.pos);
    this.camera3D.lookAt(cam.target);
    this.camera3D.updateProjectionMatrix();

    this.readout.update(t);
    this.grains.update(t);

    const rp = rimPulseAt(t);
    this.pulseMat.opacity = rp * 0.85;
    const rs = 1 + 0.18 * (1 - rp);
    this.pulseRing.scale.set(rs, rs, 1);

    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    // Beat-aware grade: warm exposure under the lamp; physical depth DoF during
    // the macro beat (real focal plane, not a screen-space radial).
    const macro = clamp((t - 9.0) / 2.0) * (1 - clamp((t - 15.0) / 2.0));
    const focus = cam.pos.distanceTo(cam.target);
    return {
      exposure: 0.88,
      bloom: 0.3 + rp * 0.3,
      bloomThreshold: 0.90,
      bloomRadius: 0.4,
      vignette: 0.32,
      grain: 0.04,
      ca: 0.25,
      depthDof: macro > 0.01
        ? { enabled: true, focusDistance: focus, near: this.camera3D.near, far: this.camera3D.far,
            aperture: 10 * macro, maxRadius: 10, blades: 6, samples: 24 }
        : undefined,
      fade: lerp(1, 0, clamp(t / 0.4)),
    };
  }

  override dispose(): void {
    this.rig.dispose();
    for (const m of this.ownMats.values()) m.dispose();
    const m = this.grains.mesh;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
    this.readout.dispose();
    this.pulseRing.geometry.dispose();
    this.pulseMat.dispose();
  }
}

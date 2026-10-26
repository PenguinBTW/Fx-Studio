// Shared base for Beat 1 (mechanism) and Beat 2 (abstraction): both are windows onto the same
// stateless mechanism world, so the overlap between them is pixel-identical.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { Mechanism } from './mechanism';
import { HEX } from './palette';

export abstract class MechScene extends Scene {
  protected mech = new Mechanism();
  protected scene3D = new THREE.Scene();

  override init() {
    this.scene3D.add(this.mech.group);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    renderer.setRenderTarget(out);
    renderer.setClearColor(HEX.void, 1);
    renderer.clear(true, true, true);
    const r = this.mech.render(renderer, this.scene3D, out, t);

    // DoF follows the active part; off once the view flattens into the diagram
    const p = r.focus.clone().project(r.cam);
    const focus = Math.hypot(p.x * 0.5 * (W / H), p.y * 0.5);
    const dof = 1 - smoothstep(20, 24, t);
    return {
      exposure: 1.0, bloom: 0.6 + 0.35 * r.flare, bloomThreshold: 0.8, bloomRadius: 0.5, halation: 0.0,
      vignette: 0.25, grain: 0.035, ca: 0.0006 * 960 * (1 + 1.3 * r.flare * 0),
      dof, focusDist: focus, focalRange: 0.16, dofRadius: 4.5,
    };
  }

  override dispose() {
    this.mech.ink.dispose();
    this.mech.glow.dispose();
  }
}

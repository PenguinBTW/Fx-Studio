// Shared world contract: every dimension is its own THREE.Scene authored in one global coordinate frame.
import * as THREE from 'three';
import type { PostOverrides } from '../../engine/scene';
import type { FogSpec } from './common';

export interface World {
  name: string;
  scene: THREE.Scene;
  fog: FogSpec;
  /** world-space position of the key light (drives the volumetric god-ray origin) */
  lightPos?: THREE.Vector3;
  update(t: number, cam: THREE.PerspectiveCamera, bird: THREE.Vector3): void;
  post(t: number): Partial<PostOverrides>;
  dispose(): void;
}

/** Shadow-casting key light whose ortho shadow frustum follows the bird. */
export class Sun {
  light: THREE.DirectionalLight;
  constructor(scene: THREE.Scene, public dir: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, extent = 70) {
    this.dir.normalize();
    this.light = new THREE.DirectionalLight(color, intensity);
    const l = this.light;
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera;
    c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent; c.near = 1; c.far = 600;
    l.shadow.bias = -0.0004; l.shadow.normalBias = 0.04;
    scene.add(l, l.target);
  }
  follow(p: THREE.Vector3) {
    this.light.target.position.copy(p);
    this.light.position.copy(p).addScaledVector(this.dir, 250);
    this.light.target.updateMatrixWorld();
  }
}

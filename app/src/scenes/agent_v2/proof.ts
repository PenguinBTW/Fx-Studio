// Proof: the dragon coiling in a dusk sky, re-drawn in a different art direction every 1.5 s (mode = floor(t / 1.5)).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Dragon, deform, scaleFrag, type PathFn } from './dragon';
import { StylePass } from './style';
import { skyWorld, skyEnv, STORM as DUSK, disposeTree } from './sky';

const path: PathFn = (p, o) => o.set(3.8 * Math.cos(p * 0.42) + 0.5 * Math.sin(p * 1.3), 1.1 * Math.sin(p * 0.7) + 0.35 * Math.cos(p * 1.9), 3.2 * Math.sin(p * 0.42) - 1.2);

function eyeFrag(s: THREE.WebGLProgramParametersWithUniforms) {
  s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    { float d = abs(vLoc.x - 9.86); float r = length((vLoc - vec3(9.86, 0.14, sign(vLoc.z) * 0.25)) * vec3(1.0, 1.8, 1.0)) / 0.075;
      vec3 c = mix(vec3(9.0, 5.0, 0.8), vec3(3.0, 0.5, 0.05), smoothstep(0.1, 1.0, r));
      diffuseColor.rgb = c * smoothstep(0.004, 0.009, d); }`);
}

export default class Proof extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 1000);
  private dragon = new Dragon();
  private style = new StylePass();
  private time = { value: 0 };
  private jaw = { value: 0 };
  private hp = new THREE.Vector3();
  private hq = new THREE.Vector3();
  private env!: THREE.Texture;

  override async init() {
    const fr = this.dragon.frames, sc = this.dragon.scale;
    const jaw = this.jaw;
    await this.dragon.load(this.ctx, (name, mesh) => {
      const j = mesh.startsWith('jaw') ? jaw : undefined;
      if (name === 'Scale') return deform(new THREE.MeshPhysicalMaterial({ color: 0x20262c, metalness: 0.35, roughness: 0.4, envMapIntensity: 0.4, iridescence: 0.6, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 900], clearcoat: 0.6, clearcoatRoughness: 0.22 }), fr, sc, scaleFrag, j);
      if (name === 'Tooth') return deform(new THREE.MeshPhysicalMaterial({ color: 0xe8dcc4, roughness: 0.25, clearcoat: 0.6 }), fr, sc, undefined, j);
      if (name === 'Eye') return deform(new THREE.MeshBasicMaterial({ color: 0xffffff }), fr, sc, eyeFrag);
      if (name === 'Mouth') return deform(new THREE.MeshStandardMaterial({ color: 0x3a0606, roughness: 0.45, emissive: 0x200000 }), fr, sc, undefined, j);
      if (name === 'Mane') return deform(new THREE.MeshPhysicalMaterial({ color: 0x1c0a08, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xff6a30), sheenRoughness: 0.4 }), fr, sc);
      if (name === 'Fin') return deform(new THREE.MeshPhysicalMaterial({ color: 0x6a0e06, roughness: 0.5, side: THREE.DoubleSide, emissive: 0x3a0800, sheen: 0.6, sheenColor: new THREE.Color(0xff5020) }), fr, sc);
      return deform(new THREE.MeshPhysicalMaterial({ color: 0x3a3028, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }), fr, sc, undefined, j);
    });
    this.scene.add(this.dragon.group);
    const world = skyWorld(DUSK, this.time); this.scene.add(world); this.world = world;
    this.scene.environment = this.env = skyEnv(this.ctx.renderer, world); this.scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight(0xff8a50, 3.5); key.position.copy(DUSK.sun).multiplyScalar(10);
    const rim = new THREE.DirectionalLight(0x5ad8ff, 3.0); rim.position.set(6, 5, 6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x6a4c9a, 0x2a140a, 0.35));
    this.scene.fog = new THREE.Fog(0x9a5a50, 30, 300);

  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    this.time.value = t; this.dragon.scale.value = 0.85;
    const head = 9 + t * 1.3; this.dragon.pose(path, head, 10.6);
    this.jaw.value = 0.3 * Math.max(0, Math.sin(t * 2.2));
    if (t < 4.5) {
      path(head, this.hp); path(head - 0.6, this.hq);
      const side = t < 1.5 ? 1 : t < 3 ? -1 : 0.4, back = t < 3 ? 1.3 : 3.2;
      const dir = this.hp.clone().sub(this.hq).normalize(), lat = new THREE.Vector3(-dir.z, 0, dir.x);
      this.cam.position.copy(this.hp).addScaledVector(dir, back * 0.9).addScaledVector(lat, side * 1.2).add(new THREE.Vector3(0, 0.35, 0));
      this.cam.lookAt(this.hp.x, this.hp.y + 0.05, this.hp.z);
    } else { this.cam.position.set(0.3, -0.6, 9.2); this.cam.lookAt(0, 0.5, 0); }
    this.cam.updateProjectionMatrix();
    const mode = t < 6 ? 0 : Math.floor(t - 6) % 10;
    this.style.render(this.ctx.renderer, this.scene, this.cam, out, mode, t);
    return { exposure: 1, bloom: 0.25, bloomThreshold: 0.95, grain: 0.02, vignette: 0.3, ca: 0.4, halation: 0.1 };
  }

  private world?: THREE.Group;
  override dispose() { if (this.world) disposeTree(this.world); this.env?.dispose(); this.dragon.dispose(); this.style.dispose(); }
}

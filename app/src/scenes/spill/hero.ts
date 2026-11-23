// SPILL hero: one look for the terminal cursor in every region. Regions restyle everything else (paint, pixels, film,
// ink); the cursor is drawn in its own pass with its own light rig, after each region's style post, depth-tested
// against that region's geometry, so it keeps the same glowing phosphor block from the phone to the vista.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GLTFInstance } from '../../engine/gltf';
import { BEAT, DROP } from './kit';

const CORE_V = /* glsl */ `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const CORE_F = /* glsl */ `uniform float uT, uOn; varying vec3 vP;
void main(){
  float row = smoothstep(0.25, 0.45, fract(vP.y * 26.0)) * smoothstep(0.95, 0.75, fract(vP.y * 26.0));
  float roll = exp(-pow((fract(vP.y * 0.8 - uT * 0.55) - 0.5) * 8.0, 2.0));
  float edge = smoothstep(0.0, 0.12, 0.215 - abs(vP.x));
  vec3 hot = vec3(1.0, 0.52, 0.14), ember = vec3(1.0, 0.24, 0.02);
  vec3 c = mix(ember * 1.4, hot * 3.0, row * edge) + hot * 1.2 * roll;
  gl_FragColor = vec4(c * mix(0.07, 1.0, uOn) * (0.97 + 0.03 * sin(uT * 110.0)), 1.0);
}`;
const DEPTH = new THREE.MeshBasicMaterial({ colorWrite: false });
const SHADOW = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const ENV = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/** hard terminal blink, phase-locked to the song: on for 1.2 beats of every 2 */
export const heroBlink = (t: number) => ((((t - DROP) / (2 * BEAT)) % 1) + 1) % 1 < 0.6 ? 1 : 0;

export class HeroPass {
  readonly scene = new THREE.Scene();
  private coreU = { uT: { value: 0 }, uOn: { value: 1 } };
  private shells: THREE.MeshPhysicalMaterial[] = [];

  constructor(rr: THREE.WebGLRenderer) {
    let env = ENV.get(rr);
    if (!env) { const pm = new THREE.PMREMGenerator(rr); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); rr.resetState(); ENV.set(rr, env); }
    this.scene.environment = env; this.scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xffe2c4, 2.6); key.position.set(-1, 1.4, 1);
    const rim = new THREE.DirectionalLight(0x9cc4ff, 1.4); rim.position.set(1.2, 0.6, -1);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xa8c0ff, 0x3a2418, 0.5));
  }

  /** dress a cursor instance in the hero look. Overlay (default): the root moves into the hero scene and a
   *  shadow-only twin stays in `world`. Inline: materials only, the caller keeps the root in its own scene. */
  dress(inst: GLTFInstance, o: { world?: THREE.Scene; inline?: boolean } = {}) {
    const root = inst.root;
    root.traverse((q) => { const m = q as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
      if (n === 'Core') { m.material = new THREE.ShaderMaterial({ name: n, vertexShader: CORE_V, fragmentShader: CORE_F, uniforms: this.coreU }); m.renderOrder = 0; }
      else if (n === 'Shell') { const p = new THREE.MeshPhysicalMaterial({ name: n, color: new THREE.Color(1, 0.32, 0.04), emissive: new THREE.Color(1, 0.24, 0.01), emissiveIntensity: 0.5,
          roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.68, depthWrite: false });
        this.shells.push(p); m.material = p; m.renderOrder = 2; }
      else { m.material = new THREE.MeshBasicMaterial({ name: n, color: new THREE.Color(0.16, 0.04, 0.0) }); m.renderOrder = 1; }
      m.castShadow = true; });
    if (o.inline) return root;
    this.scene.add(root);
    if (o.world) {
      const twin = root.clone(true); twin.userData.heroProxy = true;
      twin.traverse((q) => { const m = q as THREE.Mesh; if (m.isMesh) { m.material = SHADOW; m.castShadow = true; } });
      const upd = THREE.Object3D.prototype.updateMatrixWorld;
      twin.updateMatrixWorld = function (this: THREE.Object3D) { this.position.copy(root.position); this.quaternion.copy(root.quaternion); this.scale.copy(root.scale); this.visible = root.visible; upd.call(this, true); };
      o.world.add(twin);
    }
    return root;
  }

  update(t: number, on = heroBlink(t)) {
    this.coreU.uT.value = t; this.coreU.uOn.value = on;
    for (const s of this.shells) s.emissiveIntensity = 0.14 + 0.5 * on;
  }

  /** draw the hero into `out` after the region's own passes. Pass `world` when `out` does not already hold the
   *  world's depth (regions that composite a styled quad); its opaque geometry is laid down depth-only first. */
  render(rr: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, cam: THREE.Camera, world?: THREE.Scene) {
    const auto = rr.autoClear; rr.autoClear = false; rr.setRenderTarget(out);
    if (world) {
      rr.clearDepth(); const hid: THREE.Object3D[] = [];
      world.traverseVisible((q) => { const m = (q as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined, mm = Array.isArray(m) ? m[0] : m;
        if (q.userData.heroProxy || (q as THREE.Sprite).isSprite || (q as THREE.Points).isPoints || (q as THREE.Line).isLine || (mm && (mm.transparent || !mm.depthWrite || !mm.depthTest))) hid.push(q); });
      for (const q of hid) q.visible = false;
      const ov = world.overrideMaterial, bg = world.background; world.overrideMaterial = DEPTH; world.background = null;
      rr.render(world, cam); world.overrideMaterial = ov; world.background = bg; for (const q of hid) q.visible = true;
    }
    rr.render(this.scene, cam); rr.autoClear = auto;
  }
}

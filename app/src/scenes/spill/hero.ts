// SPILL hero: one look for the terminal cursor in every region. Regions restyle everything else (paint, pixels, film,
// ink); the cursor is drawn in its own pass with its own light rig, after each region's style post, depth-tested
// against that region's geometry, so it keeps the same glowing block from the phone to the vista.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GLTFInstance } from '../../engine/gltf';
import { BEAT, DROP } from './kit';

function haloTex() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const DEPTH = new THREE.MeshBasicMaterial({ colorWrite: false });
const SHADOW = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const ENV = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();

/** hard terminal blink, phase-locked to the song: a short dim flicker once every 2 beats; it never fully disappears */
export const heroBlink = (t: number) => ((((t - DROP) / (2 * BEAT)) % 1) + 1) % 1 < 0.88 ? 1 : 0;

export class HeroPass {
  readonly scene = new THREE.Scene();
  private block = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.34, 0.02), toneMapped: false });
  private halo = new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 0.36, 0.05), transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });

  constructor(rr: THREE.WebGLRenderer) {
    let env = ENV.get(rr);
    if (!env) { const pm = new THREE.PMREMGenerator(rr); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); rr.resetState(); ENV.set(rr, env); }
    this.scene.environment = env; this.scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xffe2c4, 2.6); key.position.set(-1, 1.4, 1);
    const rim = new THREE.DirectionalLight(0x9cc4ff, 1.4); rim.position.set(1.2, 0.6, -1);
    this.scene.add(key, rim, new THREE.HemisphereLight(0xa8c0ff, 0x3a2418, 0.5));
  }

  /** dress a cursor instance in the hero look: a solid, sharp-edged glowing block (terminal block cursor) with a
   *  soft halo. Overlay (default): the root moves into the hero scene and a shadow-only twin stays in `world`.
   *  Inline: the caller keeps the root in its own scene. */
  dress(inst: GLTFInstance, o: { world?: THREE.Scene; inline?: boolean } = {}) {
    const root = inst.root; root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    root.traverse((q) => { if ((q as THREE.Mesh).isMesh) q.visible = false; });
    const box = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), this.block); box.position.copy(c); box.castShadow = true; box.name = 'heroBlock';
    const halo = new THREE.Sprite(this.halo); halo.position.copy(c); halo.scale.set(sz.y * 2.6, sz.y * 2.6, 1); halo.renderOrder = -1;
    root.add(box, halo);
    if (o.inline) return root;
    this.scene.add(root);
    if (o.world) {
      const twin = new THREE.Mesh(box.geometry, SHADOW); twin.castShadow = true; twin.userData.heroProxy = true;
      twin.updateMatrixWorld = function (this: THREE.Object3D) { root.updateMatrixWorld(true); this.matrixWorld.copy(box.matrixWorld); this.visible = root.visible; this.matrixWorldNeedsUpdate = false; };
      o.world.add(twin);
    }
    return root;
  }

  update(t: number, on = heroBlink(t)) {
    const k = 0.3 + 0.7 * clamp01(on) * (0.97 + 0.03 * Math.sin(t * 90));
    this.block.color.setRGB(k, 0.34 * k, 0.02 * k); this.halo.opacity = 0.8 * k * k;
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

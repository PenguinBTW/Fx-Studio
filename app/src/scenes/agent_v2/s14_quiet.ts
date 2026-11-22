// S14 quiet (bars 93-101): monochrome. The paper dragon glides through a dark void while paper ash falls; it burns away
// from the tail with a white-hot edge and becomes the ash. "i made all of it."
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import type { PathFn } from './dragon';

export const T93 = bar(93), S14_END = bar(101);
export const S14_LINES: TLine[] = [
  { text: 'i made all of it.', at: bar(94) + 0.1, hold: 2.4, cps: 12 },
  { text: 'every frame of it.', at: bar(97) + 0.1, hold: 2.0, cps: 12 },
];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NF = 2600;
export const glidePath: PathFn = (p, o) => o.set(p * 0.85 - 9, 0.35 * Math.sin(p * 0.45) + 0.02 * p, 1.4 * Math.sin(p * 0.3) - 1);
const h = (i: number, s: number) => { const x = Math.sin(i * 91.7 + s * 47.3) * 43758.5453; return x - Math.floor(x); };

export default class S14Quiet extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 300);
  private rig = new DragonRig(); private env!: THREE.Texture; private flakes!: THREE.InstancedMesh; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler();
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 1;
    const P = this.rig.paperU; P.paper.value = P.facet.value = 1; P.fold.value = 1; P.ink.value = 0.6;
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.15; this.scene.background = new THREE.Color(0x060606); this.scene.fog = new THREE.FogExp2(0x060606, 0.035);
    const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(-3, 8, 4); const rim = new THREE.DirectionalLight(0xdfe6ff, 2.2); rim.position.set(4, 1, -6);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x9a9a9a, 0x050505, 0.3));
    const fg = new THREE.PlaneGeometry(0.11, 0.08); const fm = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0 });
    this.flakes = new THREE.InstancedMesh(fg, fm, NF); this.flakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.flakes.frustumCulled = false; this.scene.add(this.flakes);
    const c = new THREE.Color(); for (let i = 0; i < NF; i++) { const v = 0.35 + 0.65 * h(i, 9); c.setRGB(v, v, v * 0.97); if (h(i, 12) > 0.985) c.setRGB(1.6, 1.4, 1.2); this.flakes.setColorAt(i, c); }
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, lt = T - T93;
    const head = 4 + lt * 0.75; this.rig.dragon.pose(glidePath, head, LEN); this.rig.jaw.value = 0.06;
    this.rig.reveal.value = 1 - sm(bar(96), bar(100.5), T);
    const hp = new THREE.Vector3(); glidePath(head - 3.5, hp);
    for (let i = 0; i < NF; i++) {
      const sp = 0.25 + 0.35 * h(i, 2), H = 16, y = 8 - ((h(i, 3) * H + lt * sp) % H), sw = Math.sin(lt * (0.6 + h(i, 4)) + i) * 0.4;
      this.e.set(lt * (0.8 + 2 * h(i, 5)) + i, lt * (0.5 + h(i, 6)) + i * 0.3, sw); this.q.setFromEuler(this.e);
      const s = 0.5 + 1.1 * h(i, 7); this.m4.compose(new THREE.Vector3((h(i, 0) - 0.5) * 30 + sw, y, (h(i, 1) - 0.5) * 22 - 2), this.q, new THREE.Vector3(s, s, s)); this.flakes.setMatrixAt(i, this.m4);
    }
    this.flakes.instanceMatrix.needsUpdate = true;
    const az = -0.35 + 0.05 * lt; this.cam.position.set(hp.x + 7.2 * Math.sin(az), hp.y + 0.9, hp.z + 7.2 * Math.cos(az)); this.cam.lookAt(hp.x, hp.y - 0.1, hp.z); this.cam.updateProjectionMatrix();
    rr.setRenderTarget(out); rr.setClearColor(0x060606, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear();
    term(g, S14_LINES, T, { size: 50, align: 'center', x: 960, y: 900, halo: 'rgba(0,0,0,0.5)', color: '#ece8e0', cursor: '#ece8e0', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    return { toneMap: 'aces', exposure: 0.95, bloom: 0.35, bloomThreshold: 0.8, halation: 0.15, vignette: 0.55, grain: 0.07, ca: 0.1, dof: 1, focusDist: 7.2, focalRange: 2.5 };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.flakes.geometry.dispose(); (this.flakes.material as THREE.Material).dispose(); this.flakes.dispose(); }
}

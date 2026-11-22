// S15 logo (bars 101-end): the f(x) STUDIO mark is redrawn in the film's styles, one per beat, while the dragon makes a
// last lap around it; on bar 103 it snaps clean: lacquered black letters, a light sweep, the orange cursor lands and
// blinks on the beat. "enjoy." Then the repo URL and a fade to black on the last bar.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { F, font } from '../../engine/type';
import { bar, BAR, BEAT } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import { StylePass, STYLE } from './style';
import type { PathFn } from './dragon';

export const T101 = bar(101), T_LOCK = bar(103), END = bar(113);
const SEQ = [STYLE.blueprint, STYLE.ascii, STYLE.pixel, STYLE.comic, STYLE.thermal, STYLE.glass, STYLE.woodblock, STYLE.xray];
export const S15_LINES: TLine[] = [{ text: 'enjoy.', at: bar(105) + 0.1, hold: 4.2, cps: 10 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lapPath: PathFn = (p, o) => { const a = p * 0.36; const ex = Math.max(0, p - 9); return o.set(5.6 * Math.cos(a) + 0.1, -0.35 + 0.3 * Math.sin(p * 0.8) + ex * 0.3, 2.2 * Math.sin(a) - 5.2 - ex * 2.2); };

export const outroPath: PathFn = (p, o) => o.set(-16 + p * 0.8, 3.3 + 0.4 * Math.sin(p * 0.35), -6.5 - 1.0 * Math.sin(p * 0.12));

export default class S15Logo extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 300);
  private rig = new DragonRig(); private style = new StylePass(); private env!: THREE.Texture;
  private cur!: THREE.Object3D; private curBase = new THREE.Vector3(); private curMat!: THREE.MeshStandardMaterial;
  private sweep = new THREE.SpotLight(0xffffff, 0, 30, 0.35, 0.6, 1.2);   private dg!: THREE.Object3D; private emb!: THREE.Points; private own: { dispose(): void }[] = [];
  override async init() {
    const g = await this.rig.load(this.ctx); this.dg = g; this.scene.add(g); this.rig.revGlow.value = 0;
    const inst = await GLTFManager.instantiate(resolveAsset('agent_promo/fx_mark').url, {});
    const black = new THREE.MeshPhysicalMaterial({ color: 0xd9dce2, metalness: 1.0, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
    const bone = new THREE.MeshPhysicalMaterial({ color: 0xb8b2a8, metalness: 0.0, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2 });
    this.curMat = new THREE.MeshStandardMaterial({ color: 0xff4d12, emissive: 0xff4d12, emissiveIntensity: 2.2, roughness: 0.3 }); this.own.push(black, bone, this.curMat);
    const set = (name: string, m: THREE.Material) => { const o = inst.root.getObjectByName(name); if (!o) throw new Error(`[s15] fx_mark part '${name}' missing`); o.traverse((x) => { const me = x as THREE.Mesh; if (me.isMesh) { me.material = m; me.castShadow = true; } }); return o; };
    const fx = set('mark_fx', black); set('mark_studio', bone); this.cur = set('mark_cursor', this.curMat);
    const bf = new THREE.Box3().setFromObject(fx), bc = new THREE.Box3().setFromObject(this.cur); this.curBase.copy(this.cur.position); this.curBase.x += bf.max.x + 0.1 - bc.min.x;
    inst.root.position.set(-0.3, 0.5, 0); this.scene.add(inst.root, this.sweep, this.sweep.target);
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.55; this.scene.background = new THREE.Color(0x050507);
    // backdrop so the lockup sits in the film's world: a warm forge glow behind the mark under a cool sky, and drifting embers
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main() { float g = max(dot(vD, normalize(vec3(0.0, 0.14, -1.0))), 0.0); vec3 c = vec3(0.012, 0.014, 0.022) + vec3(0.55, 0.16, 0.04) * pow(g, 10.0) * 0.5 * smoothstep(-0.02, 0.2, vD.y) + vec3(0.08, 0.14, 0.24) * smoothstep(0.1, 0.7, vD.y) * 0.25; gl_FragColor = vec4(c, 1.0); }' }));
    sky.renderOrder = -1; this.own.push(sky.geometry, sky.material as THREE.Material);
    const NE = 1400, ep = new Float32Array(NE * 3); let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < NE; i++) ep.set([(rnd() - 0.5) * 26, rnd() * 9 - 2, -3 - rnd() * 14], i * 3);
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const em = new THREE.PointsMaterial({ color: 0xff7a30, size: 0.05, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.emb = new THREE.Points(eg, em); this.own.push(eg, em); this.scene.add(sky, this.emb); this.scene.fog = new THREE.Fog(0x050507, 8, 21);
    const key = new THREE.DirectionalLight(0xffe2c4, 2.0); key.position.set(3, 4, 6); const rim = new THREE.DirectionalLight(0x9cc9e8, 3.6); rim.position.set(-4, 3, -5);
    this.scene.add(key, rim, new THREE.HemisphereLight(0x8a96a8, 0x0b0b0e, 0.12));
    const fm = new THREE.MeshBasicMaterial({ color: 0x050507 }); const fgeo = new THREE.PlaneGeometry(80, 80); this.own.push(fm, fgeo);
    const floor = new THREE.Mesh(fgeo, fm); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25; floor.receiveShadow = true; this.scene.add(floor);
    const pool = new THREE.SpotLight(0xfff1e0, 14, 20, 0.42, 1.0, 1.8); pool.position.set(-1.5, 7, 3); pool.target.position.set(0, 0.5, 0); this.scene.add(pool, pool.target);
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, lock = T >= T_LOCK, k = Math.max(0, Math.floor((T - T101) / BEAT)), mode = lock ? STYLE.none : SEQ[k % SEQ.length]!;
    const head = 2 + (T - T101) * 2.2, h2 = (T - bar(107)) * 4.0; if (T < bar(107)) { this.rig.dragon.pose(lapPath, head, LEN); this.dg.visible = head < 24; } else { this.rig.dragon.pose(outroPath, h2, LEN); this.dg.visible = h2 < 44; } this.rig.jaw.value = 0.2;
    this.emb.position.set(0.15 * Math.sin(T * 0.3), ((T - T101) * 0.18) % 3, 0);
    const cu = sm(T_LOCK, T_LOCK + 0.22, T); this.cur.position.set(this.curBase.x, this.curBase.y + 2.2 * (1 - cu), this.curBase.z); this.cur.visible = T >= T_LOCK - 0.05; 
    const blink = T < T_LOCK + 0.4 || Math.floor((T - T_LOCK) / BEAT) % 2 === 0 ? 1 : 0.12; this.curMat.emissiveIntensity = 2.4 * blink;
    const ph = lock ? (T - T_LOCK) % (2 * BAR) : 0, sw = sm(0.05, 1.6, ph); this.sweep.position.set(-9 + 18 * sw, 5, 7); this.sweep.target.position.set(-4 + 8 * sw, 0.4, 0); this.sweep.intensity = lock ? 160 * Math.sin(Math.PI * sw) : 0;
    const settle = lock ? Math.exp(-(T - T_LOCK) * 6) : 0, push = sm(T_LOCK, END, T), pre = 1 - sm(T101, T_LOCK, T);
    const az = lock ? 0.06 * Math.sin((T - T_LOCK) * 0.2) : 0, rad = 8.2 + 3 * pre - 2.0 * push + 0.6 * settle;
    this.cam.position.set(0.2 + 2.2 * pre * Math.sin((T - T101) * 0.9) + rad * Math.sin(az), 0.35 + 1.2 * pre, rad * Math.cos(az)); this.cam.lookAt(0.2 - 0.25 * (1 - pre), 0.15 - 0.4 * (1 - pre), 0); this.cam.updateProjectionMatrix();
    this.style.render(rr, this.scene, this.cam, out, mode, T); rr.resetState();
    const g = this.layer.ctx; this.layer.clear(); const duck = overlayTextDuck(f.tin, f.tout);
    term(g, S15_LINES, T, { size: 46, align: 'center', x: 960, y: 900, color: '#f4efe6', cursor: '#ff4d12', alpha: duck });
    if (T >= bar(110)) { const a = sm(bar(110), bar(110) + 0.8, T) * duck; g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(244,239,230,0.6)'; g.font = font(F.mono(500), 24); g.letterSpacing = '6px'; g.textAlign = 'center'; g.fillText('GITHUB.COM/PENGUINBTW/FX-STUDIO', 960, 985); g.fillStyle = 'rgba(255,77,18,0.8)'; g.fillRect(930, 1006, 60, 2); g.restore(); }
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const fade = 1 - sm(bar(112), END - 0.25, T), kick = lock ? 0 : Math.exp(-(T - T101 - k * BEAT) * 12);
    return { toneMap: 'aces', exposure: 1.0 * fade + 0.4 * settle, bloom: 0.5, bloomThreshold: 0.8, halation: 0.2, vignette: 0.55, grain: 0.04, ca: 0.15 + 1.4 * kick + 0.6 * settle, zoom: 1 + 0.02 * kick + 0.015 * settle };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.style.dispose(); for (const o of this.own) o.dispose(); }
}

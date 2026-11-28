// S8 fire (bars 53-59): "make it breathe fire." Three breaths on the downbeats — a closed-form GPU flame stream from the
// dragon's mouth (blackbody colour by age, buoyant curl, embers), lighting the obsidian scales from inside the frame.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { FlameVolume } from './fire_vol';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import type { PathFn } from './dragon';
import { skyWorld, disposeTree, type SkyLook } from './sky';
const EMBER_NIGHT: SkyLook = { zen: 0x010104, mid: 0x04060e, hor: 0x2e0e0c, sun: new THREE.Vector3(0.3, 0.05, -0.95).normalize(), sunCol: 0x000000, lit: 0x24181e, shade: 0x05060c };

export const T53 = bar(53), S8_END = bar(59);
export const BREATHS: [number, number][] = [[bar(54), bar(56)], [bar(56), bar(57.5)], [bar(57.5), bar(59.2)]];
export const S8_LINES: TLine[] = [{ text: 'make it breathe fire.', at: T53 + 0.15, hold: 0.7, cps: 22 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const firePath: PathFn = (p, o) => o.set(p * 0.9 - 7.5, 0.6 * Math.sin(p * 0.6) + 0.15 * p, -2.0 * Math.cos(p * 0.38));
export const N = 70000, LIFE = 1.25;
export function breath(t: number) { let b = 0; for (const [a, e] of BREATHS) b = Math.max(b, sm(a - 0.08, a + 0.12, t) * (1 - sm(e - 0.3, e, t))); return Math.max(b, 0.45 * sm(BREATHS[0]![0] + 0.2, BREATHS[0]![0] + 0.5, t) * (1 - sm(BREATHS[2]![1] - 0.5, BREATHS[2]![1], t))); }

/** The fire's origin: the centre of the open mouth, which drops below the head's centre line as the jaw opens. */
export function mouthAt(m: THREE.Vector3, dir: THREE.Vector3, jaw: number, scale: number, out: THREE.Vector3) {
  const n = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
  return out.copy(m).addScaledVector(dir, 0.35).addScaledVector(n, (-0.05 - 0.45 * Math.sin(jaw)) * scale);
}
export const FIRE_V = /* glsl */ `attribute vec4 aR; uniform float uT, uB0, uB1, uB2, uB3, uB4, uB5; uniform vec3 uMouth, uDir; uniform float uSpread, uSize, uCurl; varying float vAge, vHot, vE;
float sm_(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float br(float t) { return max(max(sm_(uB0 - 0.08, uB0 + 0.12, t) * (1.0 - sm_(uB1 - 0.3, uB1, t)), sm_(uB2 - 0.08, uB2 + 0.12, t) * (1.0 - sm_(uB3 - 0.3, uB3, t))), sm_(uB4 - 0.08, uB4 + 0.12, t) * (1.0 - sm_(uB5 - 0.3, uB5, t))); }
void main() { float ember = step(0.93, aR.w); float life = ${LIFE.toFixed(2)} * (1.0 + 1.8 * ember);
  float age = mod(uT + aR.x * life, life); float tb = uT - age; float on = br(tb); float a = age / life; vAge = a; vE = ember;
  vec3 up = vec3(0, 1, 0), sd = normalize(cross(uDir, up)), u2 = cross(sd, uDir);
  float sp = 7.0 * (0.75 + 0.5 * aR.y); float d = sp * age * (1.0 - 0.35 * a);
  vec2 cone = (aR.zw - 0.5) * 2.0; float spread = (0.35 + 0.95 * a) * uSpread;
  float sw = sin(age * 7.0 + aR.y * 30.0) * 0.4 * a + sin(tb * 13.0) * 0.25 * a;
  vec3 curl_ = vec3(sin(age * 5.0 + aR.z * 20.0 + tb * 3.0), sin(age * 4.3 + aR.w * 17.0), cos(age * 6.1 + aR.y * 23.0)) * uCurl * a * a * d * 0.18;
  vec3 p = curl_ + uMouth + uDir * d + (sd * (cone.x + sw) + u2 * cone.y) * spread * d * 0.45 + up * (0.9 * age * age + ember * 0.8 * age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  vHot = on * (1.0 - a) * (0.25 + 1.5 * pow(fract(aR.y * 7.31 + aR.z * 3.7), 3.0));
  gl_PointSize = on > 0.001 ? (ember > 0.5 ? 2.5 : (10.0 + 190.0 * a * (1.0 - 0.35 * a)) * uSize) * 3.4 / max(-mv.z, 0.4) * on   : 0.0; gl_PointSize = min(gl_PointSize, 380.0); }`;
export const FIRE_F = /* glsl */ `varying float vAge, vHot, vE; void main() { vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard;
  float k = clamp(1.0 - vAge * 1.9, 0.0, 1.0); vec3 bb = vec3(1.0, 0.18 + 0.55 * k, 0.02 + 0.35 * k * k) * (0.35 + 2.4 * k * k);
  float soft = smoothstep(0.5, 0.0, r); float a = soft * vHot * (vE > 0.5 ? 1.6 : 0.014 * (1.0 - smoothstep(0.5, 1.0, vAge)));
  vec3 smoke = vec3(0.05, 0.03, 0.02) * smoothstep(0.5, 1.0, vAge);
  gl_FragColor = vec4((bb + smoke) * a, 1.0); }`;

export default class S8Fire extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 1200);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private fireL = new THREE.PointLight(0xff7a30, 0, 30, 1.4);
  private fireL2 = new THREE.PointLight(0xff5a1a, 0, 30, 1.4);
  private mouthL = new THREE.PointLight(0xffb060, 0, 6, 2);
  private core!: THREE.Sprite;
  private world!: THREE.Group;
  private clouds: THREE.Mesh[] = [];
  private u = { uT: { value: 0 }, uMouth: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) },
    uB0: { value: BREATHS[0]![0] }, uB1: { value: BREATHS[0]![1] }, uB2: { value: BREATHS[1]![0] }, uB3: { value: BREATHS[1]![1] }, uB4: { value: BREATHS[2]![0] }, uB5: { value: BREATHS[2]![1] }, uSpread: { value: 1.7 }, uSize: { value: 1.3 }, uCurl: { value: 0 } };
  private fire!: THREE.Points;
  private vol = new FlameVolume(11, 1.6);
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 0;
    const geo = new THREE.BufferGeometry(), r = new Float32Array(N * 4); let s = 9;
    for (let i = 0; i < N * 4; i++) { s = (s * 16807) % 2147483647; r[i] = s / 2147483647; }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('aR', new THREE.BufferAttribute(r, 4));
    this.fire = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: FIRE_V, fragmentShader: FIRE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fire.frustumCulled = false;
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.06;
    const rim = new THREE.DirectionalLight(0x6ab0ff, 2.2); rim.position.set(-4, 3, -6); const key = new THREE.DirectionalLight(0xffa070, 0.8); key.position.set(3, 5, 4);
    this.world = skyWorld(EMBER_NIGHT, this.u.uT); this.scene.add(this.world); this.buildClouds();
    this.scene.add(this.vol.mesh, this.fire, this.fireL, this.fireL2, this.mouthL, this.core, rim, key, new THREE.HemisphereLight(0x202838, 0x080404, 0.3));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, b = breath(T); this.u.uT.value = T;
    const head = 10.5 + 0.35 * (T - T53) - 0.4 * b; this.rig.dragon.pose(firePath, head, LEN); this.rig.reveal.value = 1;
    const inh = sm(T53 + 0.6, BREATHS[0]![0], T) * (1 - sm(BREATHS[0]![0], BREATHS[0]![0] + 0.25, T));
    this.rig.jaw.value = 0.08 + 0.3 * inh + 0.62 * b + 0.05 * Math.sin(T * 30) * b;
    const m = new THREE.Vector3(), m2 = new THREE.Vector3(); firePath(head - 0.45, m); firePath(head + 0.4, m2);
    const dir = m2.clone().sub(m).normalize(); dir.y -= 0.12; dir.normalize(); mouthAt(m, dir, this.rig.jaw.value, this.rig.dragon.scale.value, this.u.uMouth.value); this.u.uDir.value.copy(dir);
    this.fireL.position.copy(m).addScaledVector(dir, 1.6); const flick = 0.85 + 0.15 * Math.sin(T * 37) * Math.sin(T * 23); this.fireL.intensity = 70 * b * flick;
    this.fireL2.position.copy(m).addScaledVector(dir, 5.5); this.fireL2.intensity = 110 * b * flick * sm(0.2, 0.7, b);
    this.mouthL.position.copy(m).addScaledVector(dir, 0.15); this.mouthL.intensity = 14 * inh * (0.8 + 0.2 * Math.sin(T * 41)) + 12 * b;
    this.core.position.copy(m).addScaledVector(dir, 0.3); const cs = 0.35 + 1.2 * inh + 0.6 * b; this.core.scale.set(cs, cs, 1); (this.core.material as THREE.SpriteMaterial).opacity = Math.min(1, inh * 1.2 + b);
    // camera: a 3/4 front on the head, pulled back for breath 1, beside the stream for 2, then straight into the fire on 3
    const c1 = m.clone().add(new THREE.Vector3(2.8, 0.9, 5.2)), c2 = m.clone().add(dir.clone().multiplyScalar(1.5)).add(new THREE.Vector3(-0.5, 1.0, 4.8));
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(); const c3 = m.clone().addScaledVector(dir, 2.4).addScaledVector(side, 5.2 - 1.4 * sm(BREATHS[2]![0], S8_END, T)).add(new THREE.Vector3(0, 1.3, 0));
    const w2 = sm(BREATHS[1]![0] - 0.2, BREATHS[1]![0], T), w3 = sm(BREATHS[2]![0] - 0.25, BREATHS[2]![0], T);
    const pos = c1.lerp(c2, w2).lerp(c3, w3); const look = m.clone().addScaledVector(dir, 1.8 * w2 + (1 - w2) * 0.9).lerp(m.clone().addScaledVector(dir, 2.2), w3);
    pos.add(new THREE.Vector3(Math.sin(T * 31), Math.sin(T * 27), 0).multiplyScalar(0.03 * b));
    this.cam.position.copy(pos); this.cam.lookAt(look); this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
    this.vol.u.uGain.value = 0.34 + 0.3 * (1 - b); this.vol.update(this.cam, this.u.uMouth.value, dir, T, sm(BREATHS[0]![0] - 0.05, BREATHS[0]![0] + 0.6, T), b);
    rr.setRenderTarget(out); rr.setClearColor(0x020203, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S8_LINES, T, { size: 46, x: 200, align: 'left', y: 930, halo: 'rgba(0,0,0,0.6)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    return { toneMap: 'aces', exposure: 0.66, bloom: 0.3 + 0.1 * b, bloomThreshold: 0.92, halation: 0.6, vignette: 0.5, grain: 0.06, ca: 0.3 + 0.8 * b, zoom: 1 + 0.01 * b };
  }
  private buildClouds() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!; let s = 31; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 90; i++) { const x = 40 + rnd() * 176, y = 70 + rnd() * 116, r = 18 + rnd() * 42; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 0; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshStandardMaterial({ color: 0x5a5a66, alphaMap: tex, transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide, map: i === 0 ? tex : null }));
      m.position.set(-6 + i * 2.6 + rnd() * 2, -2.4 + rnd() * 3.5, -5.5 - rnd() * 4); m.rotation.z = rnd() * 6.28; m.renderOrder = 2; this.scene.add(m); this.clouds.push(m); }
    const cc = document.createElement('canvas'); cc.width = cc.height = 64; const g2 = cc.getContext('2d')!; const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,250,230,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.8)'); gr.addColorStop(1, 'rgba(255,80,10,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); this.core.renderOrder = 6;
  }
  override dispose() { this.layer.texture.dispose(); disposeTree(this.world); for (const m of this.clouds) { (m.material as THREE.MeshStandardMaterial).alphaMap?.dispose(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); } (this.core.material as THREE.SpriteMaterial).map?.dispose(); this.core.material.dispose(); this.env?.dispose(); this.rig.dispose(); this.fire.geometry.dispose(); (this.fire.material as THREE.Material).dispose(); this.vol.dispose(); }
}

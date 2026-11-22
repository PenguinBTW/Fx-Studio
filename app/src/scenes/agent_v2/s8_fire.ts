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

export const T53 = bar(53), S8_END = bar(59);
export const BREATHS: [number, number][] = [[bar(54), bar(55.5)], [bar(56), bar(57)], [bar(57.5), bar(59.2)]];
export const S8_LINES: TLine[] = [{ text: 'make it breathe fire.', at: T53 + 0.15, hold: 0.7, cps: 22 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const firePath: PathFn = (p, o) => o.set(p * 0.9 - 7.5, 0.6 * Math.sin(p * 0.6) + 0.15 * p, -2.0 * Math.cos(p * 0.38));
export const N = 70000, LIFE = 1.25;
export function breath(t: number) { let b = 0; for (const [a, e] of BREATHS) b = Math.max(b, sm(a - 0.08, a + 0.12, t) * (1 - sm(e - 0.3, e, t))); return b; }

export const FIRE_V = /* glsl */ `attribute vec4 aR; uniform float uT, uB0, uB1, uB2, uB3, uB4, uB5; uniform vec3 uMouth, uDir; uniform float uSpread, uSize, uCurl; varying float vAge, vHot, vE;
float sm_(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
float br(float t) { return max(max(sm_(uB0 - 0.08, uB0 + 0.12, t) * (1.0 - sm_(uB1 - 0.3, uB1, t)), sm_(uB2 - 0.08, uB2 + 0.12, t) * (1.0 - sm_(uB3 - 0.3, uB3, t))), sm_(uB4 - 0.08, uB4 + 0.12, t) * (1.0 - sm_(uB5 - 0.3, uB5, t))); }
void main() { float ember = step(0.93, aR.w); float life = ${LIFE.toFixed(2)} * (1.0 + 1.8 * ember);
  float age = mod(uT + aR.x * life, life); float tb = uT - age; float on = br(tb); float a = age / life; vAge = a; vE = ember;
  vec3 up = vec3(0, 1, 0), sd = normalize(cross(uDir, up)), u2 = cross(sd, uDir);
  float sp = 7.0 * (0.75 + 0.5 * aR.y); float d = sp * age * (1.0 - 0.35 * a);
  vec2 cone = (aR.zw - 0.5) * 2.0; float spread = (0.12 + 0.95 * a) * uSpread;
  float sw = sin(age * 7.0 + aR.y * 30.0) * 0.4 * a + sin(tb * 13.0) * 0.25 * a;
  vec3 curl_ = vec3(sin(age * 5.0 + aR.z * 20.0 + tb * 3.0), sin(age * 4.3 + aR.w * 17.0), cos(age * 6.1 + aR.y * 23.0)) * uCurl * a * a * d * 0.18;
  vec3 p = curl_ + uMouth + uDir * d + (sd * (cone.x + sw) + u2 * cone.y) * spread * d * 0.45 + up * (1.8 * age * age + ember * 0.8 * age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  vHot = on * (1.0 - a) * (0.25 + 1.5 * pow(fract(aR.y * 7.31 + aR.z * 3.7), 3.0));
  gl_PointSize = on > 0.001 ? (ember > 0.5 ? 2.5 : (10.0 + 190.0 * a * (1.0 - 0.35 * a)) * uSize) * 3.4 / max(-mv.z, 0.4) * on   : 0.0; gl_PointSize = min(gl_PointSize, 380.0); }`;
export const FIRE_F = /* glsl */ `varying float vAge, vHot, vE; void main() { vec2 q = gl_PointCoord - 0.5; float r = length(q); if (r > 0.5) discard;
  float k = clamp(1.0 - vAge * 1.9, 0.0, 1.0); vec3 bb = vec3(1.0, 0.18 + 0.55 * k, 0.02 + 0.35 * k * k) * (0.35 + 2.4 * k * k);
  float soft = smoothstep(0.5, 0.0, r); float a = soft * vHot * (vE > 0.5 ? 1.6 : 0.035 * (1.0 - smoothstep(0.5, 1.0, vAge)));
  vec3 smoke = vec3(0.05, 0.03, 0.02) * smoothstep(0.5, 1.0, vAge);
  gl_FragColor = vec4((bb + smoke) * a, 1.0); }`;

export default class S8Fire extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 400);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private fireL = new THREE.PointLight(0xff7a30, 0, 18, 1.6);
  private u = { uT: { value: 0 }, uMouth: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) },
    uB0: { value: BREATHS[0]![0] }, uB1: { value: BREATHS[0]![1] }, uB2: { value: BREATHS[1]![0] }, uB3: { value: BREATHS[1]![1] }, uB4: { value: BREATHS[2]![0] }, uB5: { value: BREATHS[2]![1] }, uSpread: { value: 1 }, uSize: { value: 1 }, uCurl: { value: 0 } };
  private fire!: THREE.Points;
  private vol = new FlameVolume(10, 1.15);
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
    this.scene.add(this.vol.mesh, this.fire, this.fireL, rim, key, new THREE.HemisphereLight(0x202838, 0x080404, 0.3));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer, b = breath(T); this.u.uT.value = T;
    const head = 10.5 + 0.35 * (T - T53) - 0.4 * b; this.rig.dragon.pose(firePath, head, LEN); this.rig.reveal.value = 1;
    this.rig.jaw.value = 0.08 + 0.62 * b + 0.05 * Math.sin(T * 30) * b;
    const m = new THREE.Vector3(), m2 = new THREE.Vector3(); firePath(head - 0.45, m); firePath(head + 0.4, m2);
    const dir = m2.clone().sub(m).normalize(); dir.y -= 0.12; dir.normalize(); this.u.uMouth.value.copy(m).addScaledVector(dir, 0.35); this.u.uDir.value.copy(dir);
    this.fireL.position.copy(m).addScaledVector(dir, 1.6); this.fireL.intensity = 60 * b * (0.85 + 0.15 * Math.sin(T * 37) * Math.sin(T * 23));
    // camera: a 3/4 front on the head, pulled back for breath 1, beside the stream for 2, then straight into the fire on 3
    const c1 = m.clone().add(new THREE.Vector3(2.8, 0.9, 5.2)), c2 = m.clone().add(dir.clone().multiplyScalar(1.5)).add(new THREE.Vector3(-0.5, 1.0, 4.8));
    const c3 = m.clone().add(dir.clone().multiplyScalar(6.5 - 3.5 * sm(BREATHS[2]![0], S8_END, T))).add(new THREE.Vector3(0.3, 0.6, 0.9));
    const w2 = sm(BREATHS[1]![0] - 0.2, BREATHS[1]![0], T), w3 = sm(BREATHS[2]![0] - 0.25, BREATHS[2]![0], T);
    const pos = c1.lerp(c2, w2).lerp(c3, w3); const look = m.clone().addScaledVector(dir, 1.8 * w2 + (1 - w2) * 0.9).lerp(m.clone().addScaledVector(dir, -0.6), w3);
    pos.add(new THREE.Vector3(Math.sin(T * 31), Math.sin(T * 27), 0).multiplyScalar(0.03 * b));
    this.cam.position.copy(pos); this.cam.lookAt(look); this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld();
    let a0 = -99; for (const [a] of BREATHS) if (T >= a - 0.1) a0 = a;
    this.vol.u.uGain.value = 0.55; this.vol.update(this.cam, this.u.uMouth.value, dir, T, sm(a0 - 0.05, a0 + 0.6, T), b);
    rr.setRenderTarget(out); rr.setClearColor(0x020203, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S8_LINES, T, { size: 46, x: 200, align: 'left', y: 930, halo: 'rgba(0,0,0,0.6)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    return { toneMap: 'agx', exposure: 0.9, bloom: 0.45 + 0.35 * b, bloomThreshold: 0.75, halation: 0.6, vignette: 0.5, grain: 0.06, ca: 0.3 + 0.8 * b, zoom: 1 + 0.01 * b };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.fire.geometry.dispose(); (this.fire.material as THREE.Material).dispose(); this.vol.dispose(); }
}

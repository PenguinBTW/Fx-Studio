// S3 forge (bars 15-20): the frozen shards start to turn, get dragged into a white-hot vortex, and the dragon is
// pulled out of it: the body materialises shard-tile by shard-tile where it leaves the funnel. Bar 19: it roars.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { R, SUN, starfield } from './planet';
import { fractureSphere, SHARD_GLSL } from './shards';
import { SHARD_F, S2_END, tau } from './s2_crumble';
import { DragonRig, LEN } from './rig';
import type { PathFn } from './dragon';

const T15 = S2_END, T17 = bar(17), T19 = bar(19), S3_END = bar(20);
export const S3_LINES: TLine[] = [{ text: 'then make something out of the pieces.', at: T15 + 0.3, hold: 1.3, cps: 18 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = 2.3; // body units per second once out of the funnel
/** Path: a tight helix down the vortex axis (hidden), then a rising arc that swings toward camera. */
export const forgePath: PathFn = (p, o) => {
  if (p < 0) return o.set(0.35 * Math.cos(p * 2.4), p * 0.9, 0.35 * Math.sin(p * 2.4));
  const a = p * 0.3; return o.set(0.35 * Math.cos(p * 2.4) * Math.exp(-p) + 4.2 * Math.sin(a) * (1 - 0.25 * Math.sin(p * 0.2)), p * 0.55 + 0.6 * Math.sin(p * 0.5), 0.35 * Math.sin(p * 2.4) * Math.exp(-p) + 4.2 * (1 - Math.cos(a)));
};

const VORTEX_V = /* glsl */ `uniform float uTauF, uSwirl, uT, uT15, uT17, uT19, uRot; varying vec3 vN, vW; varying float vK, vDepth, vAbs; ${SHARD_GLSL}
mat3 roty(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
void main() { mat3 M; vec3 p0 = shardPos(position, uTauF, 0.0, ${R.toFixed(2)}, M); vec3 c0 = shardPos(aC * ${R.toFixed(2)} * 0.94, uTauF, 0.0, ${R.toFixed(2)}, M);
  float id = fract(aR.x * 31.7 + aR.y * 17.3); float ta = uT17 + id * (uT19 - uT17) * 0.95;
  float ab = smoothstep(ta - 0.5, ta + 0.35, uT); vAbs = ab;
  float ang = atan(c0.z, c0.x) - (uT - uT15) * uSwirl * (0.7 + 1.6 * (1.0 - id)) * (1.0 + 2.0 * ab);
  float rad = mix(length(c0.xz), 0.9 + 3.2 * id, uSwirl) * (1.0 - 0.85 * ab);
  float y = mix(c0.y, (id - 0.5) * 6.0 + sin(ang * 2.0) * 0.4, uSwirl) * (1.0 - 0.7 * ab);
  vec3 cv = vec3(cos(ang) * rad, y, sin(ang) * rad);
  float scl = mix(1.0, 0.55, uSwirl) * (1.0 - ab);
  vec3 p = cv + rotAx(normalize(aR + 0.01), (uT - uT15) * uSwirl * 1.5) * (p0 - c0) * scl;
  vN = roty(uRot) * aD; vK = aK; vDepth = length(position) / ${R.toFixed(2)};
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CORE_F = /* glsl */ `uniform float uT, uCore; varying vec2 vUv; varying vec3 vW; void main() {
  float a = vUv.x * 6.2832, y = vUv.y; vec2 q = vec2(cos(a), sin(a)) * 1.3 + vec2(y * 4.0 - uT * 1.5, uT * 0.6 + y * 2.0);
  float s = 0.0, am = 0.5; vec2 qq = q + vec2(y * 3.0, -uT * 2.0); for (int i = 0; i < 5; i++) { s += am * (0.5 + 0.5 * sin(qq.x * 2.1 + sin(qq.y * 1.7 + uT)) * sin(qq.y * 2.3 - uT * 1.3 + a * 2.0)); qq = mat2(1.6, 1.2, -1.2, 1.6) * qq; am *= 0.5; }
  s = clamp(s * 1.25, 0.0, 1.0); float e = pow(s, 2.5) * smoothstep(0.0, 0.25, y) * smoothstep(1.0, 0.6, y) * (0.6 + 0.4 * sin(a * 2.0 - y * 18.0 + uT * 9.0));
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * e * 1.4 * uCore + vec3(1.0, 0.85, 0.6) * pow(s, 12.0) * 2.0 * uCore * e, 1.0); }`;

const SPARK_V = /* glsl */ `uniform float uT, uCore, uT15; attribute vec3 aR; varying vec3 vC; varying float vA;
void main() { float life = 0.8 + 1.6 * aR.z, t = mod(uT - uT15 + aR.x * 7.0, life), k = t / life;
  float ang = aR.y * 6.2832 + t * (3.5 + 4.0 * (1.0 - aR.z)) * (1.0 - 0.5 * k); float rad = 0.4 + (0.6 + 3.8 * aR.x) * k + 0.3 * k * k * aR.y * 6.0;
  vec3 p = vec3(cos(ang) * rad, -4.5 + 8.5 * (aR.z * 0.6 + 0.4 * k) + 1.5 * k * (aR.x - 0.3), sin(ang) * rad);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; float heat = 1.0 - k;
  vC = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.85, 0.55), heat * heat) * (0.6 + 2.6 * heat); vA = uCore * smoothstep(0.0, 0.08, k) * (1.0 - k);
  gl_PointSize = (1.0 + 3.0 * aR.y * aR.y) * 18.0 / max(-mv.z, 0.3); }`;
const SPARK_F = 'varying vec3 vC; varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard; gl_FragColor = vec4(vC * vA * smoothstep(0.25, 0.0, d), 1.0); }';

export default class S3Forge extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 1000);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private u = { uGrow: { value: 1 }, uSea: { value: 1 }, uForest: { value: 1 }, uMolten: { value: 0 }, uCloud: { value: 1 }, uT: { value: 0 }, uRot: { value: 0.04 * bar(10) }, uSun: { value: SUN },
    uTau: { value: 0 }, uTauF: { value: tau(S2_END) }, uAsh: { value: 1 }, uHeat: { value: 0.45 }, uSwirl: { value: 0 }, uT15: { value: T15 }, uT17: { value: T17 }, uT19: { value: T19 }, uCore: { value: 0 } };
  private hp = new THREE.Vector3(); private hq = new THREE.Vector3();
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g);
    const sh = new THREE.Mesh(fractureSphere(R), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VORTEX_V, fragmentShader: SHARD_F, side: THREE.DoubleSide })); sh.frustumCulled = false;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 8, 64, 1, true), new THREE.ShaderMaterial({ uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }', fragmentShader: CORE_F }));
    core.position.y = -1; const core2 = core.clone(); core2.scale.set(0.55, 1.1, 0.55); core2.rotation.y = 1.3; const core3 = core.clone(); core3.scale.set(1.6, 0.9, 1.6); core3.rotation.y = 2.6;
    const NS = 9000, sa = new Float32Array(NS * 3); for (let i = 0; i < NS; i++) { const x = Math.sin(i * 12.9898) * 43758.5453, y = Math.sin(i * 78.233) * 12543.11, z = Math.sin(i * 39.425) * 24634.63; sa.set([x - Math.floor(x), y - Math.floor(y), z - Math.floor(z)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3)); sg.setAttribute('aR', new THREE.BufferAttribute(sa, 3));
    const sparks = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: SPARK_V, fragmentShader: SPARK_F })); sparks.frustumCulled = false;
    this.scene.add(sh, core, core2, core3, sparks, starfield());
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.09;
    const key = new THREE.DirectionalLight(0xff9a60, 3.2); key.position.copy(SUN).multiplyScalar(10);
    const rim = new THREE.DirectionalLight(0x5ad8ff, 3.5); rim.position.set(5, 4, -6);
    const fire = new THREE.PointLight(0xff6020, 30, 12, 2); fire.position.set(0, 0, 0);
    this.scene.add(key, rim, fire, new THREE.HemisphereLight(0x40486a, 0x1a0c08, 0.3));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, u = this.u; u.uT.value = T; u.uTau.value = u.uTauF.value;
    u.uSwirl.value = sm(T15, T15 + 2.2, T); u.uCore.value = sm(T15 + 1.0, T17, T) * (1 - 0.7 * sm(T19, S3_END, T)); u.uHeat.value = 0.45 + 1.2 * sm(T15 + 0.5, T17, T);
    const head = Math.max(-2, (T - T17) * V); this.rig.dragon.pose(forgePath, head, LEN);
    this.rig.reveal.value = Math.min(1, Math.max(0, head / LEN)); this.rig.revGlow.value = 1 - sm(T19 + 0.5, S3_END, T);
    this.rig.jaw.value = 0.55 * sm(T19, T19 + 0.25, T) * (1 - sm(T19 + 1.3, T19 + 1.8, T));
    // camera: inherit S2's orbit (r~4.45, a~-1.92, h~1.3, fov 42), pull back to frame the vortex, then chase the head
    const back = sm(T15, T17, T), w = sm(T17 + 0.5, T19, T);
    const a = -1.92 - 0.35 * sm(T15, T19, T), r = 4.45 + 4.0 * back, hgt = 1.3 + 0.3 * back;
    const orbit = new THREE.Vector3(r * Math.sin(a), hgt, r * Math.cos(a));
    forgePath(Math.max(head, 0.5), this.hp); forgePath(Math.max(head, 0.5) - 1.5, this.hq);
    const chase = this.hp.clone().add(new THREE.Vector3(1.9, 0.7, 4.4));
    this.cam.position.lerpVectors(orbit, chase, w);
    const look = new THREE.Vector3(0.3 * (1 - back), 0.2, 0).lerp(this.hp.clone().lerp(this.hq, 0.45), w);
    this.cam.lookAt(look); this.cam.fov = 42 - 4 * w; this.cam.updateProjectionMatrix();
    const rr = this.ctx.renderer; rr.setRenderTarget(out); rr.setClearColor(0x000000, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S3_LINES, T, { size: 44, x: 200, align: 'left', y: 920, halo: 'rgba(0,0,0,0.6)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const roar = Math.exp(-Math.max(0, T - T19) * 4) * (T >= T19 ? 1 : 0);
    return { toneMap: 'aces', exposure: 1.0, bloom: 0.7 + 0.5 * roar, bloomThreshold: 0.8, halation: 0.3, vignette: 0.5, grain: 0.05, ca: 0.4 + 2.0 * roar, zoom: 1 + 0.03 * roar };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); this.scene.traverse((o) => { const m = o as THREE.Mesh; if ((m.isMesh || (o as THREE.Points).isPoints) && !this.rig.dragon.group.children.includes(m)) { m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); } }); }
}

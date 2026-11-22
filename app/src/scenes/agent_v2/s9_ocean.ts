// S9 ocean (bars 59-63): "too hot. cooling it down." The dragon dives out of a moonlit sky into a black night sea; the
// impact lights the water with bioluminescence and we follow it under, through plankton that flares cyan as it passes.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { DragonRig, LEN } from './rig';
import type { PathFn } from './dragon';

export const T59 = bar(59), TI = bar(60.5), S9_END = bar(63);
export const S9_LINES: TLine[] = [{ text: 'too hot.', at: T59 + 0.1, hold: 0.6, cps: 16 }, { text: 'cooling it down.', at: TI + 0.6, hold: 1.4, cps: 18 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = 6.0, PI_ = (TI - T59) * V + 2; // path param at which the head hits the water
/** dives from the sky along -x...+x, hits y=0 at p = PI_, then flattens out under water */
export const oceanPath: PathFn = (p, o) => { const q = p - PI_; return o.set(q * 0.8, q < 0 ? -q * 0.55 - 0.004 * q * q * q : -q * 0.55 * Math.exp(-q * 0.12) - 0.3 * Math.sin(q * 0.4), 1.2 * Math.sin(p * 0.15)); };

const WATER_V = /* glsl */ `uniform float uT, uTI; varying vec3 vW; varying vec3 vN;
vec3 wave(vec2 p, float t) { float h = 0.0; vec2 g = vec2(0.0); for (int i = 0; i < 6; i++) { float fi = float(i); vec2 d = normalize(vec2(cos(fi * 1.7 + 0.3), sin(fi * 2.3 + 1.1)));
  float k = 0.35 * pow(1.55, fi), a = 0.22 / pow(1.7, fi), ph = dot(d, p) * k + t * sqrt(9.8 * k) * 0.6; h += a * sin(ph); g += a * k * cos(ph) * d; }
  float r = length(p - vec2(0.0, 1.2 * sin(${PI_.toFixed(3)} * 0.15))), ti = t - uTI; if (ti > 0.0) { float ring = sin(r * 3.0 - ti * 9.0) * exp(-abs(r - ti * 3.0) * 1.2) * 0.35 * exp(-ti * 0.6); h += ring; }
  return vec3(h, g); }
void main() { vec3 p = position; vec3 w = wave(p.xz, uT); p.y += w.x; vN = normalize(vec3(-w.y, 1.0, -w.z)); vec4 wp = modelMatrix * vec4(p, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WATER_F = /* glsl */ `uniform float uT, uTI; uniform vec3 uHead; varying vec3 vW; varying vec3 vN;
void main() { vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN); bool under = cameraPosition.y < 0.0; if (under) N = -N;
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0); vec3 R = reflect(-V, N);
  vec3 sky = mix(vec3(0.01, 0.02, 0.05), vec3(0.06, 0.1, 0.2), smoothstep(-0.1, 0.6, R.y)); vec3 moonD = normalize(vec3(-0.4, 0.35, -1.0));
  sky += vec3(0.9, 0.95, 1.0) * pow(max(dot(R, moonD), 0.0), 900.0) * 30.0 + vec3(0.3, 0.4, 0.6) * pow(max(dot(R, moonD), 0.0), 40.0);
  vec3 deep = vec3(0.0, 0.012, 0.02); vec3 c = under ? mix(vec3(0.02, 0.1, 0.16), vec3(0.3, 0.5, 0.6), pow(max(dot(-N, V), 0.0), 3.0) * 0.4) : mix(deep, sky, fr);
  float ti = uT - uTI; float r = length(vW.xz - vec2(0.0, 1.2 * sin(${PI_.toFixed(3)} * 0.15)));
  float bio = ti > 0.0 ? exp(-abs(r - ti * 3.0) * 1.5) * exp(-ti * 0.35) * (0.6 + 0.4 * sin(r * 9.0)) + exp(-r * 0.6) * exp(-ti * 0.8) * 2.0 : 0.0;
  float trail = exp(-length(vW.xz - uHead.xz) * 0.8) * step(uHead.y, 0.5);
  c += vec3(0.1, 0.9, 1.0) * (bio + trail * 0.6) * (0.7 + 0.3 * sin(vW.x * 13.0 + vW.z * 7.0 + uT * 3.0));
  if (under) { float up_ = normalize(vW - cameraPosition).y; c = mix(vec3(0.02, 0.11, 0.14), c, smoothstep(0.03, 0.4, up_) * exp(-length(cameraPosition - vW) * 0.03)); }
  gl_FragColor = vec4(c, 1.0); }`;
const PLK_V = /* glsl */ `attribute vec4 aR; uniform float uT; uniform vec3 uBody[16]; varying float vG;
void main() { vec3 p = position + vec3(sin(uT * 0.3 + aR.x * 40.0), sin(uT * 0.2 + aR.y * 30.0), cos(uT * 0.25 + aR.z * 20.0)) * 0.15;
  float d = 1e9; for (int i = 0; i < 16; i++) d = min(d, length(p - uBody[i])); vG = exp(-d * d * 0.35) * (0.6 + 1.5 * aR.w) + 0.08 * aR.w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (1.5 + 5.0 * vG) * 6.0 / max(-mv.z, 0.4); }`;
const PLK_F = /* glsl */ `varying float vG; void main() { float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(0.15, 0.9, 1.0) * vG * 2.5 * smoothstep(0.5, 0.0, r), 1.0); }`;

export default class S9Ocean extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 600);
  private rig = new DragonRig();
  private env!: THREE.Texture;
  private u = { uT: { value: 0 }, uTI: { value: TI }, uHead: { value: new THREE.Vector3() }, uBody: { value: Array.from({ length: 16 }, () => new THREE.Vector3(0, 99, 0)) } };
  private fog = new THREE.FogExp2(0x041c24, 0.05);
  private objs: THREE.Object3D[] = [];
  private bgU!: THREE.Mesh;
  override async init() {
    const g = await this.rig.load(this.ctx); this.scene.add(g); this.rig.revGlow.value = 0;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 400, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: WATER_V, fragmentShader: WATER_F, side: THREE.DoubleSide }));
    water.frustumCulled = false;
    const N = 40000, pos = new Float32Array(N * 3), r = new Float32Array(N * 4); let s = 21; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) { pos.set([(rnd() - 0.5) * 60 + 12, -rnd() * 9 - 0.3, (rnd() - 0.5) * 30], i * 3); r.set([rnd(), rnd(), rnd(), rnd()], i * 4); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aR', new THREE.BufferAttribute(r, 4));
    const plk = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: PLK_V, fragmentShader: PLK_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); plk.frustumCulled = false;
    const moon = new THREE.DirectionalLight(0xbcd0ff, 1.6); moon.position.set(-4, 3.5, -10); const glow = new THREE.PointLight(0x30e0ff, 0, 10, 1.5);
    const bg = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vD; void main() { gl_FragColor = vec4(mix(vec3(0.0, 0.006, 0.01), vec3(0.02, 0.11, 0.14), smoothstep(-0.7, 0.0, vD.y)), 1.0); }' }));
    bg.renderOrder = -1; this.bgU = bg;
    this.objs = [water, plk, moon, glow, bg]; this.scene.add(...this.objs, new THREE.HemisphereLight(0x203048, 0x000000, 0.25));
    const pm = new THREE.PMREMGenerator(this.ctx.renderer); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); this.ctx.renderer.resetState();
    this.scene.environment = this.env; this.scene.environmentIntensity = 0.05;
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, rr = this.ctx.renderer; this.u.uT.value = T;
    const head = 2 + (T - T59) * V * (1 - 0.45 * sm(TI, S9_END, T)); this.rig.dragon.pose(oceanPath, head, LEN); this.rig.reveal.value = 1; this.rig.jaw.value = 0.1;
    const hp = new THREE.Vector3(); oceanPath(head - 0.3, hp); this.u.uHead.value.copy(hp);
    (this.u.uBody.value as THREE.Vector3[]).forEach((v, i) => oceanPath(head - (i / 15) * LEN, v));
    const glow = this.objs[3] as THREE.PointLight; glow.position.copy(hp); glow.intensity = 25 * sm(TI, TI + 0.3, T);
    // above: wide side-on of the dive; at impact the camera follows it through the surface and trails it under water
    const ab = hp.clone().add(new THREE.Vector3(-1.5, 1.6, 11)); const look0 = hp.clone();
    const w = sm(TI - 0.3, TI + 0.6, T); const un = hp.clone().add(new THREE.Vector3(-7.5, 0.4, 5.5)); un.y = Math.min(un.y, -0.6 - 1.0 * w);
    const pos = hp.clone().add(new THREE.Vector3(-4.0, 0.9, 4.6)).lerp(ab, sm(T59, T59 + 0.8, T) * (1 - w)).lerp(un, w); pos.y = w < 0.01 ? Math.max(pos.y, 0.8) : pos.y;
    this.cam.position.copy(pos); this.cam.lookAt(look0.clone().add(new THREE.Vector3(w * 2.0, 0, 0))); this.cam.updateProjectionMatrix();
    const under = this.cam.position.y < 0; this.scene.fog = under ? this.fog : null; this.bgU.visible = under; this.bgU.position.copy(this.cam.position);
    rr.setRenderTarget(out); rr.setClearColor(under ? 0x01080c : 0x01030a, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S9_LINES, T, { size: 46, x: 200, align: 'left', y: 930, halo: 'rgba(0,0,0,0.6)', color: '#dff8ff', cursor: '#40e8ff', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const hit = T >= TI ? Math.exp(-(T - TI) * 5) : 0;
    return { toneMap: 'agx', exposure: 1.1, bloom: 0.6 + 0.6 * hit, bloomThreshold: 0.6, halation: 0.3, vignette: 0.5, grain: 0.05, ca: 0.3 + 2 * hit, zoom: 1 + 0.03 * hit };
  }
  override dispose() { this.layer.texture.dispose(); this.env?.dispose(); this.rig.dispose(); for (const o of this.objs) { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); } }
}

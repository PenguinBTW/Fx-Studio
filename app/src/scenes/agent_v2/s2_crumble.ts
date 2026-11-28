// S2 crumble (bars 9-14): the finished world rumbles, splits into 150 wedge shards and blows apart on bar 10; on the
// half-bar the agent stops time. Bullet time: the camera flies into the frozen debris, embers hang in the air,
// the palette drains to ash grey with ember-red cores.
import * as THREE from 'three';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { overlayTextDuck } from '../../engine/transition';
import { bar } from '../agent_promo/kit';
import { term, type TLine } from './term';
import { PNOISE } from './planet_glsl';
import { R, SUN, SURF_FN, planetMaterials, starfield } from './planet';
import { fractureSphere, SHARD_GLSL } from './shards';

export const TX = bar(10), TF = bar(11.5), S2_END = bar(15);
export const S2_LINES: TLine[] = [{ text: 'watch it fall.', at: TX + 0.25, hold: 1.0, cps: 16 }, { text: 'or stop it halfway.', at: TF + 0.05, hold: 2.4, cps: 16 }];
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Simulation time: real time after the blast until the freeze, then a 150 ms brake into a near-stop drift. */
export function tau(T: number) { const te = T - TX, tf = TF - TX; if (te <= 0) return 0; if (te < tf) return te; const d = te - tf; return tf + 0.15 * (1 - Math.exp(-d / 0.15)) + 0.035 * d; }


const SHARD_V = /* glsl */ `uniform float uTau, uSep, uRot; varying vec3 vN, vW; varying float vK, vDepth; ${SHARD_GLSL}
mat3 roty(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
void main() { mat3 M; vec3 p = shardPos(position, uTau, uSep, ${R.toFixed(2)}, M); vN = roty(uRot) * aD; vK = aK; vDepth = length(position) / ${R.toFixed(2)};
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const SHARD_F = /* glsl */ `${SURF_FN} uniform float uAsh, uTau, uHeat; varying vec3 vN, vW; varying float vK, vDepth;
void main() { vec3 col;
  if (vK < 0.5) { col = shadePlanet(vN, vW); float l = dot(col, vec3(0.3, 0.55, 0.15)); col = mix(col, vec3(l) * vec3(0.95, 0.92, 0.9), uAsh * 0.45); }
  else { vec3 Ng = normalize(cross(dFdx(vW), dFdy(vW))); float diff = max(dot(Ng, uSun), 0.0);
    float cr = pcrack(vW * 2.6 + vN * 3.0); float strata = 0.5 + 0.5 * gn(vW * 2.0 + vec3(vDepth * 8.0));
    float vein = smoothstep(0.07, 0.0, cr) * smoothstep(0.2, 0.6, gn(vW * 1.7) + 0.5); float hot = clamp(vein * 1.1 + smoothstep(0.92, 0.7, vDepth) * 0.8 + 0.25 * smoothstep(0.3, 0.0, cr), 0.0, 1.0) * uHeat;
    col = mix(vec3(0.03, 0.028, 0.027), vec3(0.075, 0.068, 0.062), strata * 0.5 + 0.5 * gn(vW * 9.0)) * (0.3 + 1.4 * diff) * mix(vec3(1.0), vec3(0.75, 0.78, 0.85), uAsh) + blackbody(hot * (0.6 + 0.3 * gn(vW * 5.0))) * hot * 1.3; }
  gl_FragColor = vec4(col, 1.0); }`;
const EMBER_V = /* glsl */ `uniform float uTau, uAsh; attribute vec3 aDir; attribute vec3 aRnd; varying vec3 vC; varying float vA; ${PNOISE}
void main() { float t = max(uTau - 0.6 * aRnd.x, 0.0); float sp = 0.4 + 2.2 * aRnd.y * aRnd.y;
  vec3 p = aDir * ${R.toFixed(2)} * (0.9 + 0.1 * aRnd.z) + normalize(aDir + 0.5 * (aRnd - 0.5)) * t * sp + 0.25 * t * vec3(gn(aDir * 3.0 + 1.0), gn(aDir * 3.0 + 7.0), gn(aDir * 3.0 + 4.0));
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float heat = exp(-t * (0.3 + 0.8 * aRnd.z)); vC = mix(vec3(0.5, 0.48, 0.46) * 0.6, vec3(1.0, 0.3 + 0.5 * heat, 0.05 + 0.3 * heat * heat) * (1.0 + 3.0 * heat), clamp(heat * 1.4 - 0.1 * uAsh, 0.0, 1.0));
  vA = step(0.001, uTau) * smoothstep(0.0, 0.3, t); gl_PointSize = (0.6 + 2.4 * aRnd.z * aRnd.z) * 14.0 / max(-mv.z, 0.3); }`;
const EMBER_F = 'varying vec3 vC; varying float vA; void main() { vec2 q = gl_PointCoord - 0.5; float d = dot(q, q); if (d > 0.25) discard; gl_FragColor = vec4(vC * vA * smoothstep(0.25, 0.0, d), 1.0); }';

export default class S2Crumble extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 1000);
  private u = { uGrow: { value: 1 }, uSea: { value: 1 }, uForest: { value: 1 }, uMolten: { value: 0 }, uCloud: { value: 1 }, uT: { value: 0 }, uRot: { value: 0 }, uSun: { value: SUN },
    uTau: { value: 0 }, uSep: { value: 0 }, uAsh: { value: 0 }, uHeat: { value: 1 } };
  private uc = { ...this.u, uCloud: { value: 1 }, uMolten: { value: 0 } };
  override async init() {
    const shard = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: SHARD_V, fragmentShader: SHARD_F, side: THREE.DoubleSide });
    const m = planetMaterials(this.uc);
    const n = 26000, dir = new Float32Array(n * 3), rr = new Float32Array(n * 3); let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < n; i++) { const y = rnd() * 2 - 1, a = rnd() * 6.2832, q = Math.sqrt(1 - y * y); dir.set([q * Math.cos(a), y, q * Math.sin(a)], i * 3); rr.set([rnd(), rnd(), rnd()], i * 3); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); eg.setAttribute('aDir', new THREE.BufferAttribute(dir, 3)); eg.setAttribute('aRnd', new THREE.BufferAttribute(rr, 3));
    const embers = new THREE.Points(eg, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: EMBER_V, fragmentShader: EMBER_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    embers.frustumCulled = false;
    const back = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ uniforms: this.u, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uSun; uniform float uAsh; varying vec3 vD; void main() { float s = max(dot(vD, uSun), 0.0); vec3 c = vec3(0.018, 0.016, 0.016) * (0.4 + 0.6 * (vD.y * 0.5 + 0.5)) + vec3(0.35, 0.06, 0.02) * pow(s, 4.0) * 0.35; gl_FragColor = vec4(c * uAsh, 1.0); }' }));
    const sh = new THREE.Mesh(fractureSphere(R), shard); sh.frustumCulled = false;
    this.cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.018, 40), m.cloud); this.halo = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.12, 40), m.halo);
    this.scene.add(back, starfield(), sh, embers, this.cloud, this.halo);
  }
  private cloud!: THREE.Mesh; private halo!: THREE.Mesh;
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, u = this.u, t9 = bar(9);
    const ta = tau(T); u.uTau.value = ta; u.uT.value = T; u.uRot.value = 0.04 * Math.min(T, TX); this.uc.uT.value = T; this.uc.uRot.value = u.uRot.value;
    const rumble = sm(t9 + 0.4, TX, T) * (T < TX ? 1 : 0);
    u.uSep.value = 0.006 * sm(t9 + 0.4, TX, T); u.uAsh.value = sm(TF - 0.05, TF + 0.6, T); u.uHeat.value = 1 - 0.3 * sm(TX, TF, ta + TX);
    this.uc.uCloud.value = 1 - sm(TX - 0.1, TX + 0.35, T); this.halo.visible = this.cloud.visible = T < TX + 0.4;
    (this.halo.material as THREE.ShaderMaterial).uniforms.uMolten!.value = 0;
    const kOut = sm(TX, TF, T), kIn = sm(TF + 0.2, S2_END + 0.8, T);
    const r = 6.85 + 2.1 * kOut - 4.6 * kIn, a = Math.atan2(0.3, 6.85) - 2.0 * kIn, h = 0.3 + 0.25 * kOut + 0.9 * Math.sin(kIn * 2.2) * kIn;
    const j = 0.035 * rumble, dl = sm(TF, S2_END + 0.8, T), lat = 0.9 * Math.sin(dl * 3.1416) ; this.cam.position.set(r * Math.sin(a) + j * Math.sin(T * 61) + lat * Math.cos(a), h + j * Math.sin(T * 47 + 1) + 0.12 * Math.sin(T * 0.9) * dl, r * Math.cos(a) - lat * Math.sin(a));
    this.cam.lookAt(-0.35 * (1 - kOut) + 0.3 * kIn, 0.0 + 0.2 * kIn, 0); this.cam.fov = 30 + 12 * kIn; this.cam.updateProjectionMatrix();
    const rr = this.ctx.renderer; rr.setRenderTarget(out); rr.setClearColor(0x000000, 1); rr.clear(true, true, true); rr.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S2_LINES, T, { size: 44, x: 200, align: 'left', y: 920, halo: 'rgba(0,0,0,0.6)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(rr, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); rr.resetState();
    const hit = Math.exp(-Math.max(0, T - TX) * 6) * (T >= TX ? 1 : 0), frz = Math.exp(-Math.max(0, T - TF) * 5) * (T >= TF ? 1 : 0);
    return { toneMap: 'aces', exposure: 1.0 + 0.5 * hit, bloom: 0.7 + 0.6 * hit, bloomThreshold: 0.8, halation: 0.3, vignette: 0.55, grain: 0.05, ca: 0.4 + 2.5 * frz + 1.5 * hit, flash: 0.35 * frz, zoom: 1 + 0.04 * frz };
  }
  override dispose() { this.layer.texture.dispose(); this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
}

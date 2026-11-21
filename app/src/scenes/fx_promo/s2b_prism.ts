// s2b_prism (bars 8-15, 15.39 - 28.95 s): "Prism". The orange Thread enters a Blender-built glass f(x) at the heart
// of a raymarched KIFS cathedral and leaves as a spectrum fan. Pre-drop the nave is cold and dark; on the bar-11 kick
// the fractal refolds every bar, every kick fires a shockwave through its seams and the palette rolls on each beat.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F } from '../../engine/type';
import { RaymarchPass } from '../../engine/raymarch';
import { solveDollyZoom } from '../../engine/rig';
import { clamp, ease, prog, smoothstep } from '../../engine/util';
import { C, HALO, BAR, BEAT, bar, sceneTime, model, studioEnv, present, slam, typeLine, applyCam, mixKey, lin, type CamKey } from './kit';

const DROP = bar(11);
const OUT = bar(15);
type RGB = [number, number, number];
// [stone, glow] per palette; 0 = the cold pre-drop nave, 1.. roll one per beat after the drop.
const PAL: [RGB, RGB][] = [
  [[0.10, 0.11, 0.13], [0.55, 0.85, 1.0]],
  [[0.22, 0.03, 0.03], [1.0, 0.28, 0.04]],
  [[0.02, 0.14, 0.13], [0.55, 1.0, 0.12]],
  [[0.08, 0.03, 0.22], [1.0, 0.12, 0.75]],
  [[0.18, 0.11, 0.03], [1.0, 0.72, 0.18]],
  [[0.02, 0.06, 0.18], [0.15, 0.85, 1.0]],
];
const FOLDS = [0.0, 0.42, -0.3, 0.7];
const VERBS = ['REFRACT', 'RECOLOUR', 'REFOLD', 'REPEAT'];

const MAP = /* glsl */ `
uniform float uFold; uniform float uRing; uniform float uRingK; uniform float uEmit;
uniform vec3 uBase; uniform vec3 uGlow;
float gTrap;
mat2 pRot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float map(vec3 p) {
  vec3 q = p;
  q.z = mod(q.z + 6.0, 12.0) - 6.0;
  float s = 1.0, trap = 1e9;
  vec3 off = vec3(4.2, 3.3, 3.1);
  for (int i = 0; i < 5; i++) {
    q = abs(q);
    if (q.x < q.y) q.xy = q.yx;
    if (q.x < q.z) q.xz = q.zx;
    if (q.y < q.z) q.yz = q.zy;
    q.xy *= pRot(0.18 + uFold);
    q.yz *= pRot(0.11 - 0.6 * uFold);
    q = q * 2.0 - off;
    s *= 2.0;
    trap = min(trap, abs(q.y) + 0.4 * abs(q.z));
  }
  gTrap = trap / s;
  float d = sdBox(q, vec3(2.6, 0.35, 2.6)) / s;
  float nave = 2.5 - length(p.xy * vec2(0.8, 1.0));
  float room = 4.6 - length(p);
  return max(d, max(nave, room));
}`;

const SHADE = /* glsl */ `
vec4 rmShade(vec3 ro, vec3 rd, out float vd) {
  RmHit h = rmMarch(ro, rd, 0.05, 110.0);
  vec3 fogC = uBase * 0.06 + uGlow * 0.006;
  vec3 col = fogC;
  vd = rmNearFar.y;
  float halo = pow(max(dot(rd, normalize(-ro)), 0.0), 60.0);
  if (h.hit) {
    vec3 p = ro + rd * h.t;
    vec3 n = rmNormal(p, rmEps(h.t));
    map(p);
    float trap = gTrap;
    float ao = rmAO(p, n, 0.9, 1.0);
    vec3 L = normalize(-p);
    float dif = max(dot(n, L), 0.0) / (1.0 + 0.004 * dot(p, p));
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    col = (uBase * (0.35 + 3.0 * dif) + vec3(0.02)) * ao + uGlow * (fres * 0.35 + 0.06 * ao * (0.5 + 0.5 * n.y));
    float r = length(p);
    float seam = smoothstep(0.035, 0.0, trap);
    float wave = exp(-abs(r - uRing) * 1.6) * uRingK;
    float idle = 0.18 + 0.12 * sin(r * 0.9 - rmTime * 2.0);
    col += uGlow * seam * (idle + 6.0 * wave) * uEmit;
    col = mix(col, fogC, 1.0 - exp(-h.t * 0.045));
    vd = h.t;
  }
  col += uGlow * (0.08 * min(h.steps / 90.0, 1.0) * uEmit + 0.22 * halo);
  return vec4(col, 1.0);
}`;

const BG_FRAG = `uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.0); }`;

export default class S2bPrism extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);
  private layer = new Layer2D();
  private lines = new LineBatch(64, { screen2D: false, worldWidth: true, blend: 'add', depthTest: false });
  private rm = new RaymarchPass({
    map: MAP, shade: SHADE, quality: 1, relax: 1.3,
    uniforms: { uFold: { value: 0 }, uRing: { value: 0 }, uRingK: { value: 0 }, uEmit: { value: 1 }, uBase: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() } },
  });
  private rmRT: THREE.WebGLRenderTarget | null = null;
  private bgMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: BG_FRAG, depthWrite: false, depthTest: false, toneMapped: false,
  });
  private bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
  private glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.6, ior: 1.52, dispersion: 7, envMapIntensity: 0.7, specularIntensity: 1, clearcoat: 1 });
  private logo = new THREE.Group();
  private width = 4;
  private kl = new THREE.PointLight(0xffffff, 0, 30, 1.5);

  override async init() {
    const inst = await model(this.ctx, 'fx_logo');
    const root = inst.root;
    root.traverse((o) => {
      if (o.userData?.fx_part === 'studio') o.visible = false;
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = this.glass;
    });
    const box = new THREE.Box3();
    root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.visible && (o.parent?.visible ?? true)) box.expandByObject(m); });
    root.position.sub(box.getCenter(new THREE.Vector3()));
    const sc = 4.2 / Math.max(box.max.x - box.min.x, 1e-3);
    this.logo.add(root);
    this.logo.scale.setScalar(sc);
    this.width = 4.2;
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1;
    this.scene.add(this.bg, this.logo, this.kl, new THREE.AmbientLight(0xffffff, 0.15));
    this.scene.environment = studioEnv(this.ctx.renderer);
  }

  private camAt(T: number): CamKey {
    if (T < DROP) {
      const u = ease.outCubic(prog(T, bar(8), DROP));
      return { pos: [0.35 * Math.sin(T * 0.4), 0.5, 34 - 24 * u], tgt: [0, 0.1, 0], fov: 38 - 4 * u };
    }
    const k = Math.min(3, Math.floor((T - DROP) / BAR)), d = T - DROP - k * BAR;
    if (k === 0) return { pos: [1.2 * Math.sin(d * 1.3), 0.4, 22 - 6.5 * d], tgt: [0, 0, 0], fov: 52, roll: 0.12 * Math.sin(d * 2) };
    if (k === 1) { const a = 0.7 + 0.55 * d; return { pos: [3.9 * Math.sin(a), 0.9, 3.9 * Math.cos(a)], tgt: [0, 0, 0], fov: 46 }; }
    if (k === 2) return { pos: [-2.2 + 0.6 * d, -2.1, 8.5 - 0.8 * d], tgt: [0, 1.4, 0], fov: 64, roll: -0.1 };
    const fov = 28 + 54 * ease.inOutCubic(d / BAR);
    const dz = solveDollyZoom([0, 0, 0.3], [0, 0, -1], this.width, fov, 0.62);
    return { pos: dz.position, tgt: [0, 0, 0], fov: dz.fov };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const T = sceneTime(this.ctx, f.t);
    const r = this.ctx.renderer;
    const post = T >= DROP;
    const bt = post ? Math.floor((T - DROP) / BEAT) : -1;
    const lastKick = post ? DROP + bt * BEAT : DROP;
    const sinceK = Math.max(0, T - lastKick);
    const ringK = post ? Math.exp(-sinceK * 3.2) : 0;
    const pi = post ? 1 + (bt % 5) : 0, pp = post ? (bt === 0 ? 0 : 1 + ((bt - 1) % 5)) : 0;
    const pk = post ? smoothstep(0, 0.07, sinceK) : 1;
    const base = PAL[pp]![0].map((v, i) => v + (PAL[pi]![0][i]! - v) * pk) as RGB;
    const glow = PAL[pp]![1].map((v, i) => v + (PAL[pi]![1][i]! - v) * pk) as RGB;
    const kb = post ? Math.min(3, Math.floor((T - DROP) / BAR)) : -1;
    const fold = post ? FOLDS[kb - 1 < 0 ? 0 : kb - 1]! + (FOLDS[kb]! - FOLDS[kb - 1 < 0 ? 0 : kb - 1]!) * ease.outBack(clamp((T - DROP - kb * BAR) / 0.35)) : 0.05 * Math.sin(T * 0.5);

    applyCam(this.cam, this.camAt(T), post ? 0.6 * ringK : 0);
    const U = this.rm.u;
    U.uFold!.value = fold + 0.03 * ringK;
    U.uRing!.value = sinceK * 24;
    U.uRingK!.value = ringK;
    U.uEmit!.value = post ? 1.6 : 0.25 + 0.75 * prog(T, bar(10), DROP, ease.inCubic);
    (U.uBase!.value as THREE.Vector3).set(...base);
    (U.uGlow!.value as THREE.Vector3).set(...glow);
    this.rm.setTime(T).setCamera(this.cam);
    if (!this.rmRT || this.rmRT.width !== out.width || this.rmRT.height !== out.height) {
      this.rmRT?.dispose();
      this.rmRT = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType });
    }
    this.rm.render(r, this.rmRT);
    r.resetState();
    this.bgMat.uniforms.map!.value = this.rmRT.texture;

    // The glass f(x): slow spin, a snapped quarter-turn on every downbeat after the drop.
    const qt = post ? Math.floor((T - DROP) / BAR) + ease.outBack(clamp(((T - DROP) % BAR) / 0.4)) : 0;
    this.logo.rotation.set(0.12 * Math.sin(T * 0.7), -0.35 + 0.12 * T + qt * Math.PI * 0.5, 0.05 * Math.sin(T * 0.9));
    this.kl.color.setRGB(...glow);
    this.kl.intensity = post ? 12 + 60 * ringK : 4;
    this.kl.position.set(0, 0, 2.2);

    // The Thread enters the glass and leaves as a spectrum fan that opens on each kick.
    const L = this.lines; L.clear();
    const sig = lin(C.signal, 3.2);
    const inK = prog(T, bar(8) + 0.2, bar(9), ease.outCubic);
    L.seg(-30, 4.2, -1, -30 + 30 * inK, 4.2 - 4.2 * inK, 0, 0.05, sig[0], sig[1], sig[2], 1);
    const fanK = prog(T, bar(9.5), bar(10.5), ease.outCubic);
    if (fanK > 0) {
      const spread = 0.12 + 0.1 * Math.sin(T * 0.6) + (post ? 0.18 * ringK + 0.08 : 0);
      for (let i = 0; i < 7; i++) {
        const lam = 400 + i * 50;
        const c = new THREE.Color().setHSL(0.78 * (1 - i / 6), 1, 0.55).convertSRGBToLinear();
        const a = -0.28 - spread * (i / 6 - 0.5) * 2 - 0.0004 * (lam - 550);
        const len = 34 * fanK;
        L.seg(0.4, 0, 0, 0.4 + Math.cos(a) * len, Math.sin(a) * len, -2, 0.035, c.r * 4, c.g * 4, c.b * 4, 1);
      }
    }

    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'one line in.', 960, 900, T, bar(8.75), { size: 84, align: 'center', family: F.archivo(100, 800), t1: bar(9.9), cps: 40 });
    typeLine(g, 'every colour out.', 960, 900, T, bar(10), { size: 84, align: 'center', family: F.archivo(100, 800), color: C.signal, t1: DROP - 0.05, cps: 40 });
    VERBS.forEach((w, i) => slam(g, w, 960, 880, T, { t0: DROP + i * BAR, t1: DROP + (i + 1) * BAR - 0.08, size: 210, family: F.archivo(125, 900), from: 1.6, shake: 8, out: 0.08, halo: HALO, haloW: 10, color: i === 3 ? C.signal : C.bone }));
    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(r, out, this.cam));

    const dropK = post ? Math.exp(-(T - DROP) * 5) : 0;
    const exitK = prog(T, OUT - BAR * 0.5, OUT, ease.inCubic);
    return { exposure: 1.0 + 0.25 * ringK + 0.3 * exitK, bloom: 0.55 + 0.5 * ringK + 0.6 * dropK, bloomThreshold: 0.8, vignette: 0.42, ca: 0.5 + 1.6 * ringK + 2 * exitK, grain: 0.04, flash: 0.35 * dropK, shake: [0.6 * dropK, -0.4 * dropK] };
  }

  override dispose(): void {
    this.rm.dispose(); this.rmRT?.dispose(); this.bgMat.dispose(); this.bg.geometry.dispose(); this.glass.dispose(); this.lines.dispose();
  }
}

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
const VERBS = ['REFRACT', '', 'REFOLD', ''];
const PRE: [number, number][] = [[bar(9), 3], [bar(10), 1], [bar(10.5), 4]];

const MAP = /* glsl */ `
uniform float uFold; uniform float uRing; uniform float uRingK; uniform float uEmit;
uniform vec3 uBase; uniform vec3 uGlow; uniform vec3 uCaus;
float gTrap; float gArch;
mat2 pRot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float kifs(vec3 q, out float trap) {
  float s = 1.0; trap = 1e9;
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
  trap /= s;
  return sdBox(q, vec3(2.6, 0.35, 2.6)) / s;
}
// arch: 0 = KIFS nave, 1 = glossy floor, 2 = KIFS-engraved column (12 around the glass, offset clear of the nave).
float map(vec3 p) {
  vec3 q = p;
  q.z = mod(q.z + 6.0, 12.0) - 6.0;
  float tr; float d = kifs(q, tr);
  d = max(d, max(2.5 - length(p.xy * vec2(0.8, 1.0)), 5.3 - length(p)));
  float fl = p.y + 2.4;
  float sec = 6.28318 / 12.0;
  float an = mod(atan(p.z, p.x) + sec, sec) - 0.5 * sec;
  vec2 lp = length(p.xz) * vec2(cos(an), sin(an)) - vec2(6.0, 0.0);
  float pil = length(lp) - 0.75, ptr = 1.0;
  if (pil < 0.4) { float dk = kifs(vec3(lp.x, p.y * 0.5 - 1.0, lp.y) * 1.5, ptr) / 1.5; pil = max(pil, 0.08 - dk); ptr *= 1.0 / 1.5; }
  gTrap = tr; gArch = 0.0;
  if (fl < d && fl < pil) { gArch = 1.0; return fl; }
  if (pil < d) { gArch = 2.0; gTrap = ptr; return pil; }
  return d;
}`;

const SHADE = /* glsl */ `
vec3 surf(vec3 p, vec3 n, vec3 rd, float ao) {
  map(p);
  float trap = gTrap, arch = gArch;
  vec3 L = normalize(vec3(0.0, 0.6, 0.0) - p);
  float dif = max(dot(n, L), 0.0) / (1.0 + 0.02 * dot(p, p));
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
  vec3 col = (vec3(0.03) * (0.4 + 2.5 * dif) + uGlow * (0.12 * dif + 0.08 * fres)) * ao;
  if (arch > 1.5) col += (vec3(0.05) + uGlow * 0.3) * pow(max(dot(n, normalize(vec3(0.85, 0.45, 0.3))), 0.0), 2.0) * ao;
  float r = length(p);
  float wave = exp(-abs(r - uRing) * 1.6) * uRingK;
  float idle = 0.16 + 0.12 * sin(r * 0.9 - rmTime * 2.0);
  if (arch < 0.5 || arch > 1.5) col += uGlow * smoothstep(0.035, 0.0, trap) * (idle + 6.0 * wave) * uEmit;
  if (arch > 0.5 && arch < 1.5) {
    col += uGlow * exp(-abs(length(p.xz) - uRing) * 2.5) * uRingK * 2.5 * uEmit;
    vec2 dp = p.xz - uCaus.xy;
    vec3 spec = 0.5 + 0.5 * cos(6.2831 * (dp.x * 0.22 + 0.5 + vec3(0.0, 0.33, 0.67)));
    col += spec * exp(-dp.y * dp.y * 1.2 - dp.x * dp.x * 0.12) * uCaus.z;
  }
  return col;
}
vec4 rmShade(vec3 ro, vec3 rd, out float vd) {
  RmHit h = rmMarch(ro, rd, 0.05, 110.0);
  vec3 fogC = vec3(0.006, 0.006, 0.008) + uGlow * 0.004;
  vec3 col = fogC;
  vd = rmNearFar.y;
  if (h.hit) {
    vec3 p = ro + rd * h.t;
    vec3 n = rmNormal(p, rmEps(h.t));
    col = surf(p, n, rd, rmAO(p, n, 0.9, 1.0));
    map(p);
    if (gArch > 0.5 && gArch < 1.5) {
      vec3 rr = reflect(rd, n);
      vec3 o = p + n * 0.04;
      RmHit h2 = rmMarch(o, rr, 0.02, 45.0);
      vec3 rc = fogC;
      if (h2.hit) { vec3 p2 = o + rr * h2.t; rc = mix(surf(p2, rmNormal(p2, rmEps(h2.t)), rr, 1.0), fogC, 1.0 - exp(-h2.t * 0.045)); }
      float fr = 0.3 + 0.6 * pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      col = col * (1.0 - 0.5 * fr) + rc * fr;
    }
    col = mix(col, fogC, 1.0 - exp(-h.t * 0.045));
    vd = h.t;
  }
  col += uGlow * (0.05 * min(h.steps / 90.0, 1.0) * uEmit);
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
    uniforms: { uFold: { value: 0 }, uRing: { value: 0 }, uRingK: { value: 0 }, uEmit: { value: 1 }, uBase: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector3() }, uCaus: { value: new THREE.Vector3() } },
  });
  private rmRT: THREE.WebGLRenderTarget | null = null;
  private bgMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: BG_FRAG, depthWrite: false, depthTest: false, toneMapped: false,
  });
  private bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMat);
  private glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.6, ior: 1.52, dispersion: 7, envMapIntensity: 0.4, specularIntensity: 0.6, clearcoat: 0.3 });
  private logo = new THREE.Group();
  private width = 4;
  private kl = new THREE.PointLight(0xffffff, 0, 9, 2);

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
    if (k === 0) return { pos: [0.9 * Math.sin(d * 1.3), 0.4, 7.5 - 1.6 * d], tgt: [0, 0, 0], fov: 52, roll: 0.12 * Math.sin(d * 2) };
    if (k === 1) { const a = 0.5 - 0.45 * d; return { pos: [4.3 * Math.sin(a), 0.7, 4.3 * Math.cos(a)], tgt: [0, 0, 0], fov: 66 }; }
    if (k === 2) return { pos: [1.0 + 0.3 * d, 3.1, 3.6 - 0.3 * d], tgt: [2.4, -1.4, 0], fov: 64, roll: 0.06 };
    const fov = 28 + 54 * ease.inOutCubic(d / BAR);
    const dz = solveDollyZoom([0, 0, 0.3], [-0.09, -0.06, -1], this.width, fov, 0.62);
    return { pos: dz.position, tgt: [0, 0, 0], fov: dz.fov };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const T = sceneTime(this.ctx, f.t);
    const r = this.ctx.renderer;
    const post = T >= DROP;
    const bt = post ? Math.floor((T - DROP) / BEAT) : -1;
    const lastKick = post ? DROP + bt * BEAT : DROP;
    const sinceK = Math.max(0, T - lastKick);
    const pre = post ? undefined : PRE.filter(([t0]) => T >= t0 && T - t0 < 0.32).pop();
    const preK = pre ? 1 - smoothstep(0.1, 0.32, T - pre[0]) : 0;
    const ringK = post ? Math.exp(-sinceK * 3.2) : pre ? 0.8 * preK : 0;
    const pi = post ? 1 + (bt % 5) : pre ? pre[1] : 0, pp = post ? (bt === 0 ? 0 : 1 + ((bt - 1) % 5)) : 0;
    const pk = post ? smoothstep(0, 0.07, sinceK) : pre ? preK : 1;
    const base = PAL[pp]![0].map((v, i) => v + (PAL[pi]![0][i]! - v) * pk) as RGB;
    const glow = PAL[pp]![1].map((v, i) => v + (PAL[pi]![1][i]! - v) * pk) as RGB;
    const kb = post ? Math.min(3, Math.floor((T - DROP) / BAR)) : -1;
    const fold = post ? FOLDS[kb - 1 < 0 ? 0 : kb - 1]! + (FOLDS[kb]! - FOLDS[kb - 1 < 0 ? 0 : kb - 1]!) * ease.outBack(clamp((T - DROP - kb * BAR) / 0.35)) : 0.05 * Math.sin(T * 0.5);

    applyCam(this.cam, this.camAt(T), post ? 0.6 * ringK : 0);
    const U = this.rm.u;
    U.uFold!.value = fold + 0.03 * ringK;
    U.uRing!.value = (pre ? T - pre[0] : sinceK) * 24;
    U.uRingK!.value = ringK;
    const fanK = prog(T, bar(9.5), bar(10.5), ease.outCubic);
    (U.uCaus!.value as THREE.Vector3).set(2.1 + 2.4 / Math.tan(0.61), -0.12, 1.6 * fanK * (post ? 1 + ringK : 0.6));
    U.uEmit!.value = post ? 1.6 : 0.25 + 0.75 * prog(T, bar(10), DROP, ease.inCubic) + 1.2 * preK;
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
    // The glass f(x) stays readable front-on; each downbeat after the drop snaps it to a new tilt.
    const TILT = [0, 0.32, -0.28, 0.12];
    const tilt = post ? TILT[kb - 1 < 0 ? 0 : kb - 1]! + (TILT[kb]! - TILT[kb - 1 < 0 ? 0 : kb - 1]!) * ease.outBack(clamp((T - DROP - kb * BAR) / 0.4)) : 0;
    this.logo.rotation.set(0.08 * Math.sin(T * 0.7), -0.1 + 0.12 * Math.sin(T * 0.6) + tilt, 0.04 * Math.sin(T * 0.9));
    this.kl.color.setRGB(...glow);
    this.kl.intensity = post ? 3 + 15 * ringK : 2;
    this.kl.position.set(-1.5, 3.2, 2.5);

    // The Thread enters the glass and leaves as a spectrum fan that opens on each kick.
    const L = this.lines; L.clear();
    const sig = lin(C.signal, 3.2);
    const inK = prog(T, bar(8) + 0.2, bar(9), ease.outCubic);
    L.seg(-30, 4.2, -1, -30 + 27.95 * inK, 4.2 - 4.05 * inK, -1 + 1.2 * inK, 0.05, sig[0], sig[1], sig[2], 1);
    // Inside the glass the beam kinks at each letter face (f | ( | x | )).
    const KINK: [number, number, number][] = [[-2.05, 0.15, 0.2], [-1.25, 0.02, 0.16], [-0.55, 0.2, 0.12], [0.55, -0.08, 0.08], [1.35, 0.1, 0.04], [2.1, 0, 0]];
    if (inK >= 1) for (let i = 0; i < KINK.length - 1; i++) { const [a0, a1, a2] = KINK[i]!, [b0, b1, b2] = KINK[i + 1]!; L.seg(a0, a1, a2, b0, b1, b2, 0.03, 0.9, 0.8, 0.7, 1); }
    if (fanK > 0) {
      const spread = 0.12 + 0.1 * Math.sin(T * 0.6) + (post ? 0.18 * ringK + 0.08 : 0);
      for (let i = 0; i < 7; i++) {
        const lam = 400 + i * 50;
        const c = new THREE.Color().setHSL(0.78 * (1 - i / 6), 1, 0.55).convertSRGBToLinear();
        const a = -0.6 - spread * (i / 6 - 0.5) * 2 - 0.0004 * (lam - 550);
        const len = 34 * fanK;
        L.seg(2.1, 0, 0, 2.1 + Math.cos(a) * len, Math.sin(a) * len, -2, 0.035, c.r * 4, c.g * 4, c.b * 4, 1);
      }
    }

    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'one line in.', 960, 900, T, bar(8.75), { size: 104, align: 'center', family: F.archivo(100, 800), t1: bar(9.9), cps: 40 });
    typeLine(g, 'every colour out.', 960, 900, T, bar(10), { size: 104, align: 'center', family: F.archivo(100, 800), color: C.signal, t1: DROP - 0.05, cps: 40 });
    VERBS.forEach((w, i) => w && slam(g, w, 960, 150, T, { t0: DROP + i * BAR, t1: DROP + (i + 1) * BAR - 0.08, size: 130, family: F.archivo(125, 900), from: 1.6, shake: 8, out: 0.08, halo: HALO, haloW: 10, color: C.bone }));
    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(r, out, this.cam));

    const dropK = post ? Math.exp(-(T - DROP) * 5) : 0;
    const exitK = prog(T, OUT - BAR * 0.5, OUT, ease.inCubic);
    return { exposure: 1.0 + 0.25 * ringK + 0.3 * exitK, bloom: 0.55 + 0.5 * ringK + 0.6 * dropK, bloomThreshold: 0.8, vignette: 0.42, ca: 0.5 + 1.6 * ringK + 2 * exitK, grain: 0.04, flash: 0.35 * dropK, shake: [0.6 * dropK, -0.4 * dropK] };
  }

  override dispose(): void {
    this.rm.dispose(); this.rmRT?.dispose(); this.bgMat.dispose(); this.bg.geometry.dispose(); this.glass.dispose(); this.lines.dispose(); this.layer.texture.dispose();
  }
}

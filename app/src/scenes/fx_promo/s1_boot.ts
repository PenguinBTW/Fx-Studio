// s1_boot (bars 1-8, 0 - 15.39 s; content bars 1-10 with the first four at 2x): the filtered intro loop. A Blender plotter pen draws y = sin(x) in the void;
// the curve multiplies into a ribbon sheaf, then collapses to a single line for the kick drop.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F } from '../../engine/type';
import { clamp, ease, prog, smoothstep } from '../../engine/util';
import type { GLTFInstance } from '../../engine/gltf';
import { C, BAR, B0, bar, sceneTime, model, studioEnv, present, slam, typeLine, applyCam, mixKey, lin, type CamKey } from './kit';

const N = 28;
const X0 = -6, X1 = 6;
const FLOOR = -1.5;
const FLOOR_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = `uniform vec3 uSig, uIce, uHead, uSign; uniform float uKick, uRing, uT; varying vec3 vW;
void main(){
  vec2 p = vW.xz; vec2 q = abs(fract(p * 2.0) - 0.5) / fwidth(p * 2.0); float g = 1.0 - min(min(q.x, q.y), 1.0);
  vec2 Q = abs(fract(p * 0.5) - 0.5) / fwidth(p * 0.5); float G = 1.0 - min(min(Q.x, Q.y), 1.0);
  float d = length(vW - cameraPosition), fade = exp(-d * 0.09);
  vec3 c = vec3(0.004, 0.005, 0.008) + uIce * (0.12 * g + 0.32 * G) * fade * (0.6 + 0.8 * uKick);
  float r = length(p), ring = exp(-pow((r - uRing) * 6.0, 2.0)) * exp(-uRing * 0.15);
  c += uSig * (ring * 0.5 + 0.7 * exp(-length(p - uHead.xz) * 0.7));
  c += vec3(1.0, 0.95, 0.9) * 0.22 * exp(-pow(length(p - uSign.xz) * 0.55, 2.0));
  c = mix(c, vec3(0.012, 0.016, 0.035), 1.0 - exp(-d * 0.035));
  gl_FragColor = vec4(c, 1.0);
}`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 uSig; uniform float uT; varying vec3 vDir;
void main(){ vec3 d = normalize(vDir); float hz = exp(-abs(d.y + 0.02) * 9.0);
  vec3 c = mix(vec3(0.012, 0.016, 0.035), vec3(0.002, 0.002, 0.006), smoothstep(0.0, 0.7, d.y));
  float band = 0.5 + 0.5 * sin(atan(d.z, d.x) * 3.0 + uT * 0.2 + d.y * 6.0);
  c += uSig * 0.06 * hz * (0.6 + 0.4 * band) + vec3(0.02, 0.05, 0.12) * exp(-abs(d.y - 0.25 - 0.08 * band) * 10.0) * 0.35;
  gl_FragColor = vec4(c, 1.0); }`;

export default class S1Boot extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 200);
  private layer = new Layer2D();
  private lines = new LineBatch(2 * (N * 260 + 64), { screen2D: false, worldWidth: true, blend: 'add', depthTest: false });
  private pen!: GLTFInstance;
  private own: THREE.Mesh[] = [];
  // The opening captions are a light sign standing behind the pen (in depth, occluded by the pen, crossed by the lines), not a screen overlay.
  private sign = new Layer2D();
  private signM = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.5875), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(3.2, 3.2, 3.2) }));
  private floorU = { uSig: { value: new THREE.Vector3(...lin(C.signal, 1)) }, uIce: { value: new THREE.Vector3(...lin(C.ice, 1)) }, uHead: { value: new THREE.Vector3() }, uSign: { value: new THREE.Vector3(0, 0, 999) }, uKick: { value: 0 }, uRing: { value: 99 }, uT: { value: 0 } };

  override async init() {
    this.pen = await model(this.ctx, 'pen');
    this.pen.root.scale.setScalar(0.55);
    this.scene.add(this.pen.root);
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.5;
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 4, 5);
    const rim = new THREE.DirectionalLight(new THREE.Color(C.ice), 2.5);
    rim.position.set(4, 1, -4);
    this.scene.add(key, rim);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShaderMaterial({ vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS, uniforms: this.floorU }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = FLOOR;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(110, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, uniforms: { uSig: this.floorU.uSig, uT: this.floorU.uT } }));
    sky.renderOrder = -1;
    (this.signM.material as THREE.MeshBasicMaterial).map = this.sign.texture;
    this.scene.add(fl, sky, this.signM);
    this.own.push(fl, sky, this.signM);
  }

  private headX(T: number) { return X0 + (X1 - X0) * prog(T, 0.4, bar(4), ease.inOutCubic); }

  // One function per bar from bar 5: the sheaf snaps to a new f(x) on each downbeat.
  private shape(m: number, x: number, ph: number, T: number) {
    const a = 1.35 * x - ph;
    if (m === 1) return Math.tanh(3 * Math.sin(a)) / Math.tanh(3);
    if (m === 2) { const u = a / (2 * Math.PI); return 2 * (u - Math.floor(u)) - 1; }
    if (m === 3) return Math.sin(a) * Math.cos(0.45 * x + 2 * T);
    return Math.sin(a);
  }

  private curveY(x: number, T: number, k: number, spread: number, collapse: number) {
    const ph = 0.9 * T + k * 0.22 * spread;
    const amp = (0.62 + 0.25 * spread * Math.sin(k * 0.7 + T * 0.6)) * (1 - collapse);
    const bf = T < bar(5) ? 0 : Math.min(4, Math.floor((T - bar(5)) / BAR) + 1);
    const m = bf === 0 || bf >= 4 ? 0 : bf;
    const pm = bf <= 1 ? 0 : bf - 1 >= 4 ? 0 : bf - 1;
    const w = bf === 0 ? 1 : smoothstep(0, 0.14, T - bar(4 + bf));
    return amp * (this.shape(pm, x, ph, T) * (1 - w) + this.shape(m, x, ph, T) * w);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const Tr = sceneTime(this.ctx, f.t);
    // The intro runs its first four bars at 2x (bars 1-3 real), then holds a whole-bar offset so cuts stay on the grid.
    const T = Tr < B0 ? Tr : Tr < bar(3) ? B0 + 2 * (Tr - B0) : Tr + 2 * BAR;
    const hx = this.headX(T);
    const spread = prog(T, bar(4), bar(5), ease.inOutCubic);
    const collapse = prog(T, bar(9.4), bar(10.85), ease.inCubic);
    const zSpan = 0.2 * spread * (1 - collapse);
    const hy = this.curveY(hx, T, 0, 0, collapse);

    // Pen: tip rides the curve head; lifts away once the sheaf opens.
    const lift = prog(T, bar(4), bar(4.8), ease.inCubic);
    this.pen.root.position.set(hx, hy + lift * 4, 0.02);
    this.pen.root.rotation.set(-0.25, 0.4 + T * 0.15, -0.35 + Math.sin(T * 2) * 0.05);
    this.pen.root.visible = lift < 0.99;

    // Camera: ECU on the nib (alternating sides per bar) -> a hard cut per bar from bar 5 -> push into the collapsing line.
    const side = Math.floor((T - B0) / BAR) % 2 === 0 ? 1 : -1;
    // Hold creep: every ECU slowly pushes in on the nib until the next bar's cut resets it.
    const bf = T > B0 ? ((T - B0) / BAR) % 1 : T / B0;
    const track: CamKey = { pos: [hx + (0.7 - 0.12 * bf) * side, hy + 0.15, 2.3 - 0.55 * ease.outCubic(bf)], tgt: [hx - 0.35 * side, hy + 0.12, 0], fov: 34 - 5 * bf };
    const lt = T - bar(5), d = lt - Math.floor(lt / BAR) * BAR;
    const cuts: CamKey[] = [
      { pos: [3.5 - 0.5 * d, 2.0, 9.0], tgt: [0, 0, 0], fov: 42 },
      { pos: [-6.2 + 0.6 * d, 0.22, 2.4], tgt: [2, 0, 0], fov: 38, roll: -0.08 },
      { pos: [0.4 * d, 7.5, 2.6], tgt: [0, 0, 0], fov: 46 },
      { pos: [8.5 * Math.sin(0.4 + 0.3 * d), 2.6, 8.5 * Math.cos(0.4 + 0.3 * d)], tgt: [0, 0, 0], fov: 40 },
    ];
    const push: CamKey = { pos: [-7.5, 0.18, 0.6], tgt: [4, 0, 0], fov: 55, roll: 0.0 };
    let k = T < bar(4.6) ? track : mixKey(track, cuts[0]!, smoothstep(bar(4.6), bar(5), T));
    if (T >= bar(5)) k = cuts[Math.min(3, Math.floor(lt / BAR))]!;
    k = mixKey(k, push, ease.inOutCubic(smoothstep(bar(9.6), bar(11), T)));
    applyCam(this.cam, k, f.a.snare * 0.3);

    // Floor: grid breathes on the kick, a ring rolls out from the origin on each downbeat, a pool of light follows the pen.
    const bt = T > B0 ? ((T - B0) / BAR) % 1 : 1;
    this.floorU.uKick.value = f.a.kick; this.floorU.uT.value = T; this.floorU.uRing.value = T > B0 ? bt * BAR * 9 : 99;
    this.floorU.uHead.value.set(hx, FLOOR, 0);
    // Curves.
    const L = this.lines;
    L.clear();
    const bone = lin(C.bone, 1.1);
    const sig = lin(C.signal, 3.0);
    const nCurves = 1 + Math.round((N - 1) * spread);
    const pulse = 0.75 + 0.5 * f.a.snare + 0.3 * f.a.hat;
    for (let c = 0; c < nCurves; c++) {
      const kk = c - (nCurves - 1) / 2;
      const z = kk * zSpan;
      const xEnd = c === 0 && spread < 0.01 ? hx : X1;
      const fall = c === 0 ? 1 : (0.35 + 0.65 * (1 - Math.abs(kk) / (N / 2))) * (1 - collapse) ** 2;
      const steps = 240;
      let px = X0, py = this.curveY(X0, T, kk, spread, collapse);
      for (let s = 1; s <= steps; s++) {
        const x = X0 + ((X1 - X0) * s) / steps;
        if (x > xEnd + 1e-6) break;
        const y = this.curveY(x, T, kk, spread, collapse);
        const near = c === 0 ? Math.exp(-Math.abs(hx - x) * 2.2) * (1 - spread) : 0;
        const w = (c === 0 ? 0.022 : 0.012) * (1 + collapse * 0.4);
        const col = near > 0.02 ? [bone[0] + (sig[0] - bone[0]) * near, bone[1] + (sig[1] - bone[1]) * near, bone[2] + (sig[2] - bone[2]) * near] : bone;
        const dim = pulse * (1 - 0.65 * collapse);
        L.seg(px, py, z, x, y, z, w, col[0]! * dim, col[1]! * dim, col[2]! * dim, fall);
        L.seg(px, 2 * FLOOR - py, z, x, 2 * FLOOR - y, z, w * 1.8, col[0]! * dim * 0.18, col[1]! * dim * 0.18, col[2]! * dim * 0.18, fall);
        px = x; py = y;
      }
    }

    // Type.
    const g = this.layer.ctx;
    this.layer.clear();
    const fade = 1 - collapse;
    g.globalAlpha = 1;
    const sg = this.sign.ctx; this.sign.clear();
    typeLine(sg, 'every frame', 960, 760, T, bar(1.5), { size: 92, align: 'center', family: F.archivo(100, 800), t1: bar(2.75) - 0.1, cps: 30 });
    typeLine(sg, 'is a function', 960, 760, T, bar(2.75), { size: 92, align: 'center', family: F.archivo(100, 800), t1: bar(4) - 0.1, cps: 30 });
    typeLine(sg, 'of time.', 960, 760, T, bar(4), { size: 92, align: 'center', family: F.archivo(100, 800), color: C.signal, t1: bar(5) - 0.1, cps: 30 });
    const FX = ['y = sin(x - t)', 'y = tanh(3 sin x)', 'y = saw(x - t)', 'y = sin x cos(t)'];
    for (let b = 0; b < 4; b++) slam(sg, FX[b]!, 960, 190, T, { t0: bar(5 + b), t1: bar(6 + b) - 0.2, size: 72, family: F.mono(600), from: 1.3, shake: 3, out: 0.12, color: b % 2 ? C.signal : C.bone });
    slam(sg, 'Frame = f(t)', 960, 300, T, { t0: bar(9), t1: bar(10.3), size: 150, family: F.mono(600), from: 1.45, shake: 5, out: 0.25 });

    this.sign.upload();
    this.signM.visible = T < bar(10.3);
    { const P = new THREE.Vector3(...k.pos), D = new THREE.Vector3(...k.tgt).sub(P).normalize(); this.signM.position.copy(P).addScaledVector(D, 4.6); this.signM.position.y += 0.3; this.signM.lookAt(P); this.floorU.uSign.value.copy(this.signM.position); }
    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(this.ctx.renderer, out, this.cam));

    const pre = prog(T, bar(10), bar(11), ease.inQuad);
    return {
      exposure: 1.0 + 0.15 * pre,
      bloom: 0.5 + 0.35 * pre,
      bloomThreshold: 0.82,
      vignette: 0.45,
      ca: 0.6 + 2.5 * pre,
      grain: 0.05,
      fade: 1 - clamp((T - 0.9) / 0.4),
      zoom: 1 + 0.04 * pre,
    };
  }

  override dispose(): void {
    for (const m of this.own) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.sign.texture.dispose();
  }
}

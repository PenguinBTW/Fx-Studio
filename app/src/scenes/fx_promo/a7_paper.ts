// a7_paper (bars 67-83, 130.05-161.16 s): a Blender papercraft f(x) sits on a block diorama. Every 2 bars the WORLD
// restyles (paper -> blueprint -> risograph -> ink -> pixel -> chrome, then a quarter-bar stutter, then back to paper) as a
// front sweeping outward from the logo; the logo itself never changes material: it stays paper.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';
import { clamp, ease } from '../../engine/util';
import { C, BAR, BEAT, B0, bar, model, present, slam, typeLine, sceneTime } from './kit';

const NAMES = ['paper', 'blueprint', 'risograph', 'ink', 'pixel', 'chrome'];
const FRONT = 22; // world units per second the restyle front travels outward
const STUTTER = [1, 2, 3, 4, 5, 2, 4, 1];
/** Ordered [time, style] switch list; style at time t is the last entry with time <= t. */
const SW: [number, number][] = [[-1e9, 0]];
for (let k = 0; k < 10; k++) SW.push([bar(69 + k), (k % 5) + 1]);
for (let k = 0; k < 8; k++) SW.push([bar(79) + k * BEAT, STUTTER[k]!]);
for (let k = 0; k < 4; k++) SW.push([bar(81) + k * BEAT, STUTTER[(k + 3) % 8]!]);
SW.push([bar(82), 0]);
function swAt(t: number): [number, number] {
  let i = 0;
  while (i + 1 < SW.length && SW[i + 1]![0] <= t) i++;
  return SW[i]!;
}
const h = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

const GLSL = `
float hash1(float n){ return fract(sin(n) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash1(dot(i, vec2(1.0, 57.0))), b = hash1(dot(i + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = hash1(dot(i + vec2(0.0, 1.0), vec2(1.0, 57.0))), d = hash1(dot(i + vec2(1.0, 1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float gline(float x){ float w = fwidth(x) * 1.2; return 1.0 - smoothstep(0.0, w, abs(fract(x - 0.5) - 0.5)); }
float bayer(vec2 p){ p = floor(mod(p, 4.0)); float b = mod(p.x * 2.0 + p.y * 3.0 + p.x * p.y, 4.0); return b / 4.0; }
float halftone(vec2 p, float a, float cell, float v){ mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a)); vec2 f = fract(R * p / cell) - 0.5; return 1.0 - smoothstep(v * 0.6 - 0.06, v * 0.6 + 0.06, length(f)); }
vec3 surf(int s, vec3 N, vec3 W, vec2 uv, float seed, vec3 V){
  vec3 L = normalize(vec3(0.5, 0.85, 0.3)); float dif = max(dot(N, L), 0.0);
  float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float edge = 1.0 - smoothstep(0.0, fwidth(e) * 1.5 + 0.025, e);
  float top = step(0.5, N.y);
  if (s == 0) { float side = 1.0 - top; float fold = side * step(0.5, uv.x);
    vec3 base = mix(vec3(0.97, 0.95, 0.90), vec3(0.86, 0.80, 0.70), seed * 0.6);
    vec3 c = base * (0.55 + 0.45 * dif) * (1.0 - 0.13 * fold);
    c *= 0.9 + 0.1 * vnoise(W.xz * 61.0 + W.y * 67.0) * vnoise(W.yx * 9.0);
    float crease = side * (1.0 - smoothstep(0.0, fwidth(uv.x) * 1.5, abs(uv.x - 0.5)));
    return c * (1.0 - 0.45 * edge) * (1.0 - 0.25 * crease); }
  if (s == 1) { vec3 c = vec3(0.02, 0.08, 0.24) * (0.6 + 0.4 * dif); float g = top * max(gline(W.x * 2.0), gline(W.z * 2.0));
    return c + vec3(0.56, 0.85, 1.0) * (edge * 1.6 + g * 0.22); }
  if (s == 2) { float dark = clamp(1.0 - dif * 0.85, 0.0, 1.0); vec2 sc = gl_FragCoord.xy;
    float pk = halftone(sc, 0.26, 7.0, clamp(dark * 0.9 + seed * 0.25, 0.0, 1.0));
    float tl = halftone(sc + vec2(2.5, -1.5), 1.1, 7.0, clamp(top * 0.55 + (1.0 - seed) * 0.5 * dark, 0.0, 1.0));
    vec3 c = vec3(0.96, 0.94, 0.9); c = mix(c, c * vec3(1.0, 0.32, 0.58), pk); c = mix(c, c * vec3(0.05, 0.62, 0.66), tl); return c * (1.0 - 0.55 * edge); }
  if (s == 3) { float dark = 1.0 - dif; float h1 = gline((W.x + W.z + W.y) * 9.0), h2 = gline((W.x - W.z + W.y * 0.5) * 9.0);
    float ink = clamp(edge * 1.2 + h1 * step(0.35, dark) + h2 * step(0.62, dark), 0.0, 1.0);
    vec3 c = vec3(0.02, 0.02, 0.03) + 0.03 * vnoise(W.xz * 3.0); return mix(c, vec3(0.92, 0.9, 0.86), ink); }
  if (s == 4) { vec3 p0 = vec3(0.16, 0.68, 0.33), p1 = vec3(0.99, 0.78, 0.19), p2 = vec3(0.96, 0.33, 0.43), p3 = vec3(0.16, 0.45, 0.85);
    vec3 pc = seed < 0.25 ? p0 : seed < 0.5 ? p1 : seed < 0.75 ? p2 : p3;
    float q = floor(clamp(dif + bayer(gl_FragCoord.xy / 3.0) * 0.33, 0.0, 0.999) * 3.0) / 2.0;
    vec3 c = pc * (0.35 + 0.65 * q); return mix(c, vec3(0.05, 0.03, 0.1), step(0.5, edge)); }
  vec3 R = reflect(-V, N); float y = R.y;
  vec3 c = mix(vec3(0.015), vec3(0.45, 0.5, 0.6), smoothstep(-0.3, 0.7, y));
  c += vec3(1.8) * (1.0 - smoothstep(0.0, 0.04, abs(y - 0.38))) + vec3(1.5) * (1.0 - smoothstep(0.0, 0.02, abs(R.x - 0.6)));
  c += vec3(2.6, 0.5, 0.12) * (1.0 - smoothstep(0.0, 0.03, abs(y + 0.02)));
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0); return c * (0.55 + 0.45 * fr);
}
vec3 bg(int s, vec3 d){
  float y = d.y;
  if (s == 0) return mix(vec3(0.80, 0.74, 0.62), vec3(0.96, 0.93, 0.86), smoothstep(-0.2, 0.5, y)) * (0.95 + 0.05 * vnoise(d.xz * 300.0));
  if (s == 1) { float th = atan(d.z, d.x) * 12.0, ph = y * 18.0; return vec3(0.05, 0.17, 0.43) + vec3(0.4, 0.7, 1.0) * 0.12 * max(gline(th), gline(ph)); }
  if (s == 2) { vec3 c = vec3(0.96, 0.94, 0.9); vec2 sc = gl_FragCoord.xy;
    float pk = halftone(sc, 0.26, 9.0, smoothstep(0.55, -0.15, y) * 0.85);
    float tl = halftone(sc + vec2(3.0, -2.0), 1.1, 9.0, 0.9 * (1.0 - smoothstep(0.12, 0.16, length(d.xy - vec2(0.35, 0.32)))));
    c = mix(c, c * vec3(1.0, 0.32, 0.58), pk); return mix(c, c * vec3(0.05, 0.62, 0.66), tl); }
  if (s == 3) return vec3(0.015, 0.015, 0.02) + vec3(0.5) * gline(y * 40.0) * 0.18 * smoothstep(-0.1, 0.6, y);
  if (s == 4) { vec3 c = mix(vec3(0.07, 0.05, 0.2), vec3(0.45, 0.16, 0.42), floor(clamp(1.0 - y * 1.6, 0.0, 1.0) * 6.0) / 6.0);
    return c + vec3(1.0, 0.95, 0.7) * step(0.993, hash1(dot(floor(d * 90.0), vec3(1.0, 57.0, 113.0)))) * step(0.15, y); }
  return mix(vec3(0.01), vec3(0.06, 0.065, 0.08), smoothstep(-0.1, 0.8, y)) + vec3(2.0) * (1.0 - smoothstep(0.0, 0.015, abs(y - 0.38)));
}`;

const VS = `attribute float aSeed; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vSeed;
void main(){ vUv = uv; mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position, 1.0); vW = w.xyz;
  vN = normalize(mat3(m) * normal); vSeed = aSeed; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `uniform int uS; varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying float vSeed;${GLSL}
void main(){ vec3 V = normalize(cameraPosition - vW); gl_FragColor = vec4(surf(uS, normalize(vN), vW, vUv, vSeed, V), 1.0); }`;
const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform int uS; varying vec3 vDir;${GLSL}
void main(){ gl_FragColor = vec4(bg(uS, normalize(vDir)), 1.0); }`;

interface Shot { a: [number, number, number]; b: [number, number, number]; tgt: [number, number, number]; fov: number }
const LOCK: [number, number, number][] = [[0.0, 0.16, 40], [-0.55, 0.07, 30], [0.6, 0.3, 58], [-0.3, 0.42, 72], [0.32, 0.05, 22], [-0.8, 0.22, 48]];
function lockShot(k: number, u: number): { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number } {
  const [az0, el, fov] = LOCK[k % LOCK.length]!;
  const az = az0 + 0.12 * (u - 0.5) * (k % 2 ? -1 : 1);
  const d = 5.75 / (Math.tan((fov * Math.PI) / 360) * (16 / 9));
  const tgt = new THREE.Vector3(0, 1.15, 0);
  return { pos: new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d).add(tgt), tgt, fov };
}
const SHOT: Shot[] = [
  { a: [9, 5.5, 10], b: [7.5, 4.6, 8.4], tgt: [0, 1.3, 0], fov: 38 },
  { a: [-1.8, 0.55, 5.6], b: [1.8, 0.7, 5.4], tgt: [0, 1.5, 0], fov: 46 },
  { a: [0.6, 14, 4.5], b: [-0.6, 12.5, 3.5], tgt: [0, 0, 0], fov: 40 },
  { a: [-1.7, 1.5, 2.9], b: [-1.2, 1.4, 2.2], tgt: [0.4, 1.4, 0], fov: 36 },
  { a: [-11, 4, 5], b: [-6, 4.2, 10.5], tgt: [0, 1.2, 0], fov: 42 },
  { a: [15, 1.4, 1.2], b: [15, 1.6, -1.2], tgt: [0, 1.3, 0], fov: 17 },
];
// One shot per bar from bar 67 (cuts on bar starts); stutter bars cut every half bar.
const BAR_SHOTS = [0, 1, 4, 3, 5, 2, 3, 1, 4, 5, 0, 3];
const STUT_SHOTS = [5, 1, 2, 3];

export default class A7Paper extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 400);
  private layer = new Layer2D();
  private worlds: THREE.InstancedMesh[] = [];
  private px: number[] = []; private pz: number[] = []; private sy: number[] = []; private sw: number[] = []; private dist: number[] = [];
  private sky!: THREE.ShaderMaterial;
  private logo = new THREE.Group();
  private glyphs: THREE.Object3D[] = [];
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private v = new THREE.Vector3(); private s = new THREE.Vector3();

  override async init() {
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true;
    const seeds: number[] = [];
    for (let gx = -15; gx <= 15; gx++) for (let gz = -15; gz <= 15; gz++) {
      const id = (gx + 20) * 64 + gz + 20, rr = Math.hypot(gx, gz);
      this.px.push(gx); this.pz.push(gz); this.sy.push(0.06); this.sw.push(0.97); this.dist.push(rr); seeds.push(h(id, 1));
      if (rr > 3.4 && h(id, 2) < 0.5 && !(gz > 0 && Math.abs(gx) < 3) && !(gx > 4 && Math.abs(gz) < 2)) {
        const hh = (0.3 + 2.6 * h(id, 3) ** 2 * (rr < 9 ? 1 : 0.55)) * (0.25 + 0.75 * Math.min(1, Math.max(0, (rr - 3.4) / 5)));
        const w = 0.5 + 0.35 * h(id, 4);
        this.px.push(gx + (h(id, 5) - 0.5) * 0.3); this.pz.push(gz + (h(id, 6) - 0.5) * 0.3); this.sy.push(hh); this.sw.push(w); this.dist.push(rr); seeds.push(h(id, 7));
      }
    }
    const N = this.px.length;
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1));
    for (let k = 0; k < NAMES.length; k++) {
      const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { uS: { value: k } } });
      const im = new THREE.InstancedMesh(geo, mat, N);
      im.frustumCulled = false;
      this.worlds.push(im); this.scene.add(im);
    }
    this.sky = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, uniforms: { uS: { value: 0 } } });
    const skyM = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), this.sky); skyM.renderOrder = -1; skyM.frustumCulled = false;

    const inst = await model(this.ctx, 'paper_fx');
    const ptex = paperTexture();
    const paper = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: ptex, bumpMap: ptex, bumpScale: 1.2, roughness: 1, flatShading: true });
    const tab = new THREE.MeshStandardMaterial({ color: C.signal, roughness: 0.9, flatShading: true });
    inst.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const isTab = (mesh.name + (mesh.parent?.name ?? '')).includes('tab');
      mesh.material = isTab ? tab : paper; mesh.castShadow = true;
      if (!isTab) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: '#8E7C62' })));
    });
    for (const nm of ['paper_f', 'paper_lp', 'paper_x', 'paper_rp', 'paper_tab']) { const o = inst.root.getObjectByName(nm); if (o) this.glyphs.push(o); }
    const box = new THREE.Box3().setFromObject(inst.root), size = box.getSize(new THREE.Vector3());
    const k = 4.6 / Math.max(0.001, size.x);
    inst.root.scale.setScalar(k);
    inst.root.position.set(-(box.min.x + size.x / 2) * k, -box.min.y * k + 0.07, -(box.min.z + size.z / 2) * k);
    this.logo.add(inst.root);
    const sh = document.createElement('canvas'); sh.width = 256; sh.height = 128;
    const sg = sh.getContext('2d')!; const gr = sg.createRadialGradient(128, 64, 8, 128, 64, 120);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 256, 128);
    const drop = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
    drop.rotation.x = -Math.PI / 2; drop.position.set(0.25, 0.08, 0.35); this.logo.add(drop);
    const key = new THREE.DirectionalLight('#FFF1DE', 2.4); key.position.set(3, 6, 5);
    const hemi = new THREE.HemisphereLight('#FFF6E8', '#6A5A48', 0.9);
    // The Thread: one orange crease in the floor that survives every restyle.
    const thread = new THREE.Mesh(new THREE.BoxGeometry(31, 0.025, 0.07), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.signal).multiplyScalar(2.2) }));
    thread.position.set(0, 0.075, 1.6);
    this.scene.add(skyM, this.logo, key, hemi, thread);
  }

  private shotAt(T: number): { pos: THREE.Vector3; tgt: THREE.Vector3; fov: number } {
    const b = (T - B0) / BAR + 1 - 67;
    let sh: Shot, u: number;
    if (b >= 12 && b < 14) { const k = Math.floor((b - 12) * 2); return lockShot(STUT_SHOTS[k % 4]!, (b - 12) * 2 - k); }
    else if (b >= 14) { sh = { a: [8, 5, 9], b: [0.5, 15, 3.5], tgt: [0, 0.8, 0], fov: 40 }; u = ease.inOutCubic(clamp((b - 14) / 2)); }
    else { const k = clamp(Math.floor(b), 0, 11); return lockShot(BAR_SHOTS[k]!, ease.inOutCubic(clamp(b - k))); }
    return { pos: new THREE.Vector3().fromArray(sh.a).lerp(new THREE.Vector3().fromArray(sh.b), u), tgt: new THREE.Vector3().fromArray(sh.tgt), fov: sh.fov };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const a = f.a;
    const sh = this.shotAt(T);
    const cx = sh.pos.x, cz = sh.pos.z, dl = Math.hypot(cx, cz);
    // World: each block shows the style the front has delivered to its radius, popping as the front passes.
    for (let i = 0; i < this.px.length; i++) {
      const tl = T - this.dist[i]! / FRONT;
      const [t0, st] = swAt(tl);
      const age = tl - t0;
      const pop = t0 > 0 && age < 0.3 ? 1 - ease.outCubic(age / 0.3) : 0;
      // Blocks standing between the camera and the logo are pressed flat so the paper is never hidden.
      const ux = cx / dl, uz = cz / dl, along = this.px[i]! * ux + this.pz[i]! * uz;
      const perp = Math.abs(this.px[i]! * uz - this.pz[i]! * ux);
      const clear = along > 1 && along < dl + 1 && perp < 2.6 + 0.12 * along ? 0.06 / Math.max(0.06, this.sy[i]!) : 1;
      const ys = this.sy[i]! * clear * (1 + 0.7 * pop) + (this.sy[i]! > 0.1 ? 0.06 * a.kick : 0);
      for (let k = 0; k < this.worlds.length; k++) {
        if (k === st) { this.v.set(this.px[i]!, 0.35 * pop, this.pz[i]!); this.s.set(this.sw[i]!, ys, this.sw[i]!); }
        else { this.v.set(0, -99, 0); this.s.set(1e-4, 1e-4, 1e-4); }
        this.m.compose(this.v, this.q, this.s);
        this.worlds[k]!.setMatrixAt(i, this.m);
      }
    }
    for (const w of this.worlds) w.instanceMatrix.needsUpdate = true;
    const skyS = swAt(T - 16 / FRONT)[1];
    this.sky.uniforms.uS!.value = skyS;

    // The paper logo: never restyled; glyphs hop in turn on the beat, the whole thing sways.
    const bp = (T - B0) / BEAT, nb = Math.floor(bp), ph = bp - nb;
    this.glyphs.forEach((g, j) => {
      const hop = ((nb % 4) + 4) % 4 === j % 4 ? Math.sin(Math.PI * ph) * 0.12 * (0.6 + a.kick) : 0;
      g.position.y = (g.userData.y0 ??= g.position.y) + hop / Math.max(0.001, this.logo.children[0]!.scale.y);
    });
    this.logo.rotation.y = 0.06 * Math.sin(T * 0.55);

    this.cam.position.copy(sh.pos); this.cam.fov = sh.fov; this.cam.updateProjectionMatrix(); this.cam.lookAt(sh.tgt);

    // Overlay.
    const g = this.layer.ctx; this.layer.clear();
    const [swT, st] = swAt(T);
    const light = st === 0 || st === 2 || st === 3;
    const ink = light ? '#141418' : C.bone, halo = light ? 'rgba(240,234,222,0.85)' : 'rgba(5,5,6,0.85)';
    typeLine(g, `world.style = "${NAMES[st]}"`, 120, 1000, T, Math.max(swT, bar(67)), { size: 52, color: st === 0 ? '#141418' : ink, cps: 40 });
    const cap = clamp((T - bar(67.5)) / 0.4) * (1 - clamp((T - bar(70.5)) / 0.4));
    if (cap > 0) { g.save(); g.globalAlpha = cap; g.font = `italic 58px "${F.serif(500, true)}"`; g.fillStyle = '#141418'; g.textAlign = 'center'; g.fillText('the paper stays paper.', 960, 960); g.restore(); }
    const fam = F.archivo(115, 900);
    slam(g, 'SAME OBJECT', 960, 190, T, { t0: bar(75), t1: bar(76) - 0.06, size: 140, family: fam, color: ink, halo, from: 1.8, shake: 6 });
    slam(g, 'ANY WORLD', 960, 190, T, { t0: bar(76), t1: bar(77) - 0.06, size: 140, family: fam, color: C.signal, halo, from: 1.8, shake: 6 });
    slam(g, 'RESTYLE ANYTHING', 960, 190, T, { t0: bar(79), t1: bar(80.9), size: 130, family: fam, color: ink, halo, from: 2.2, shake: 12 });
    slam(g, 'still paper.', 960, 200, T, { t0: bar(82), t1: bar(83) - 0.1, size: 120, family: F.serif(600, true), color: '#141418', halo: 'rgba(240,234,222,0.6)', from: 1.4, shake: 2 });

    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x050506, overlayTextDuck(f.tin, f.tout));
    const bloom = [0.12, 0.55, 0.08, 0.08, 0.3, 0.75][st]!;
    return { exposure: 1 + 0.05 * a.kick, bloom, bloomThreshold: 0.85, vignette: 0.35, grain: 0.04, ca: 0.3 + (b2(T) ? 1.2 * a.kick : 0) };
  }
}
function paperTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#F8F3E9'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) {
    const x = h(i, 11) * 512, y = h(i, 12) * 512, a = h(i, 13) * Math.PI, l = 4 + 14 * h(i, 14);
    g.strokeStyle = h(i, 15) < 0.5 ? 'rgba(120,100,70,0.10)' : 'rgba(255,255,255,0.22)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const y = 90 + k * 160 + 30 * h(k, 16);
    g.strokeStyle = 'rgba(110,90,60,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(512, y + 40 * (h(k, 17) - 0.5)); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, y + 2.5); g.lineTo(512, y + 2.5 + 40 * (h(k, 17) - 0.5)); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const b2 = (T: number) => T > bar(79) && T < bar(81);

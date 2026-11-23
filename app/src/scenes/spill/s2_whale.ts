// SPILL s2 (6.43 → 8.17 s, the bass drop): the cursor slams the Sky Whale's back on the downbeat and ricochets.
// Everything here is OIL: rendered, then painted by an anisotropic-ish Kuwahara pass with canvas weave + impasto
// lighting. The cursor is drawn after the paint pass: it is still an outsider (only the splash marks it).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { DROP, BAR, lerp, sm, hash, spring } from './kit';
import { HeroPass } from './hero';
import { Cameos } from './cameo';

const WS = 4, CS = 8.5;
const QUAD_V = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const PAINT_F = /* glsl */ `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uR, uT; varying vec2 vUv;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 px = 1.0 / uRes; int R = int(uR);
  vec3 m[4]; vec3 s[4]; for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s[k] = vec3(0.0); }
  for (int j = -12; j <= 12; j++) for (int i = -12; i <= 12; i++) {
    if (abs(i) > R || abs(j) > R) continue;
    vec3 c = texture2D(tScene, vUv + vec2(float(i), float(j)) * px).rgb; c = c / (1.0 + c);
    if (i <= 0 && j <= 0) { m[0] += c; s[0] += c * c; } if (i >= 0 && j <= 0) { m[1] += c; s[1] += c * c; }
    if (i <= 0 && j >= 0) { m[2] += c; s[2] += c * c; } if (i >= 0 && j >= 0) { m[3] += c; s[3] += c * c; }
  }
  float n = float((R + 1) * (R + 1)), best = 1e9; vec3 col = vec3(0.0);
  for (int k = 0; k < 4; k++) { vec3 mu = m[k] / n; vec3 v = abs(s[k] / n - mu * mu); float sg = v.r + v.g + v.b; if (sg < best) { best = sg; col = mu; } }
  col = col / max(vec3(1e-3), 1.0 - col);
  // impasto: directional stroke height field, lit from the upper-left sun
  float a = 0.6 + 0.8 * vn(vUv * 6.0 + floor(uT * 4.0) * 0.37);
  vec2 dir = vec2(cos(a), sin(a)); vec2 q = gl_FragCoord.xy * 1920.0 / uRes.y / 7.0;
  float hgt = vn(vec2(dot(q, dir) * 0.45, dot(q, vec2(-dir.y, dir.x)) * 3.2) + floor(uT * 4.0) * 1.7);
  float hx = vn(vec2(dot(q + vec2(1, 0), dir) * 0.45, dot(q + vec2(1, 0), vec2(-dir.y, dir.x)) * 3.2) + floor(uT * 4.0) * 1.7) - hgt;
  float hy = vn(vec2(dot(q + vec2(0, 1), dir) * 0.45, dot(q + vec2(0, 1), vec2(-dir.y, dir.x)) * 3.2) + floor(uT * 4.0) * 1.7) - hgt;
  float lit = mix(0.5, clamp(0.5 + 2.2 * (-hx * 0.7 + hy * 0.7), 0.0, 1.0), 0.25 + 0.75 * clamp(sqrt(best) * 12.0, 0.0, 1.0));
  float weave = 0.97 + 0.03 * (sin(gl_FragCoord.x * 1.9) * sin(gl_FragCoord.y * 1.9));
  float sj = vn(vec2(dot(q, dir) * 0.12, dot(q, vec2(-dir.y, dir.x)) * 0.9) + 11.0);
  col *= (0.84 + 0.32 * lit) * weave * (vec3(1.0) + 0.12 * (vec3(sj, 1.0 - sj, sj * 0.5) - 0.5));
  col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 1.25);
  gl_FragColor = vec4(col, 1.0);
}`;
const WHALE_V = /* glsl */ `varying vec3 vN, vW, vL; void main() { vL = position; vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WHALE_F = /* glsl */ `uniform vec3 uSun, uCam, uGlowP; uniform float uGlow, uKind; varying vec3 vN, vW, vL;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() { vec3 n = normalize(vN), v = normalize(uCam - vW); float ndl = dot(n, uSun);
  float st = vn(vec2(vL.x * 0.35, vL.z * 2.2 + vL.y * 0.8)) * 0.6 + vn(vec2(vL.x * 1.3, vL.z * 6.0)) * 0.4;
  float l = smoothstep(-0.7, 1.0, ndl + (st - 0.5) * 0.5);
  vec3 c;
  if (uKind < 0.5) { c = mix(vec3(0.02, 0.02, 0.18), vec3(0.03, 0.14, 0.62), l); c = mix(c, vec3(0.1, 0.36, 1.05), smoothstep(0.72, 1.0, l) * 0.8);
    float spots = smoothstep(0.78, 0.82, vn(vL.xz * 1.6 + 3.0)) * smoothstep(-1.0, 2.0, vL.z); c = mix(c, vec3(0.45, 0.55, 0.95), spots * 0.3); }
  else if (uKind < 1.5) { c = mix(vec3(0.5, 0.25, 0.4), vec3(1.15, 0.85, 0.6), l); }
  else { c = vec3(0.01); c += vec3(1.0) * pow(max(0.0, dot(reflect(-uSun, n), v)), 40.0); }
  float rim = pow(1.0 - abs(dot(n, v)), 7.0); c += vec3(1.2, 0.55, 0.25) * rim * 0.4 * smoothstep(-0.3, 0.4, ndl + 0.3);
  c += vec3(0.1, 0.05, 0.3) * pow(1.0 - abs(dot(n, v)), 5.0) * (1.0 - l) * 0.4;
  float dg = length(vW - uGlowP); c += vec3(1.0, 0.4, 0.05) * uGlow * max(0.0, dot(n, normalize(uGlowP - vW))) / (1.0 + dg * dg * 0.02);
  gl_FragColor = vec4(c, 1.0); }`;
const CLOUD_V = /* glsl */ `varying vec3 vN, vW; varying float vS;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() { vec3 p = position; float n = h3(floor(p * 3.0 + instanceMatrix[3].xyz * 0.01)); p += normal * (n - 0.5) * 0.12;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vS = h3(instanceMatrix[3].xyz);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const CLOUD_F = /* glsl */ `uniform vec3 uSun, uCam; varying vec3 vN, vW; varying float vS;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() { vec3 n = normalize(vN), v = normalize(uCam - vW); float nd = dot(n, uSun);
  float br = vn(vW.xz * 0.05 + vW.y * 0.03) * 0.5 + vn(vW.xy * 0.13) * 0.5; float l = nd + (br - 0.5) * 0.6;
  vec3 c = mix(vec3(0.3, 0.2, 0.55), vec3(0.95, 0.55, 0.6), smoothstep(-0.45, -0.1, l));
  c = mix(c, vec3(1.25, 0.92, 0.7), smoothstep(0.05, 0.3, l)); c = mix(c, vec3(1.4, 1.3, 1.15), smoothstep(0.55, 0.8, l));
  c += vec3(1.3, 0.7, 0.4) * pow(1.0 - abs(dot(n, v)), 4.0) * 0.5; c *= 0.92 + 0.16 * vS;
  float fog = 1.0 - exp(-length(vW - uCam) * 0.0006); c = mix(c, vec3(0.6, 0.62, 1.0), fog * 0.6);
  gl_FragColor = vec4(c, 1.0); }`;
const SKY_V = /* glsl */ `varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_F = /* glsl */ `varying vec3 vD; void main() { vec3 d = normalize(vD); float y = d.y;
  float sd = max(0.0, dot(d, normalize(vec3(-0.7, 0.35, -0.6)))); vec3 hor = mix(vec3(0.55, 0.75, 1.2), vec3(1.6, 0.9, 0.45), pow(sd, 3.0));
  vec3 c = mix(hor, vec3(0.18, 0.4, 1.05), smoothstep(0.0, 0.45, y)); c = mix(c, vec3(0.06, 0.14, 0.55), smoothstep(0.45, 1.0, y)); c = mix(c, vec3(0.3, 0.35, 0.75), smoothstep(0.0, -0.4, y));
  float s = max(0.0, dot(d, normalize(vec3(-0.7, 0.35, -0.6)))); c += vec3(1.8, 1.1, 0.5) * pow(s, 18.0);
  gl_FragColor = vec4(c, 1.0); }`;

export default class S2Whale extends Scene {
  private main = new THREE.Scene();
  private curS = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.5, 6000);
  private cameos = new Cameos([{ k: 'pixbird', t0: 6.6, dur: 1.6, path: 'fly', y: 0.7, s: 0.09, n: 5 }, { k: 'crane', t0: 7.0, dur: 1.2, path: 'fly', y: 0.45, s: 0.14, n: 3, dir: -1 }]);
  private insts: GLTFInstance[] = [];
  private whale!: THREE.Object3D;
  private flukes!: THREE.Object3D;
  private cur!: THREE.Object3D; private hero!: HeroPass;
  private cores: THREE.MeshStandardMaterial[] = [];
  private glow = new THREE.PointLight(0xff7a1e, 0, 0, 2);
  private contactL = new THREE.Vector3();
  private splash!: THREE.InstancedMesh; private spout!: THREE.InstancedMesh;
  private drops: { v: THREE.Vector3; s: number }[] = [];
  private rt: THREE.WebGLRenderTarget | null = null;
  private paintU = { tScene: { value: null as THREE.Texture | null }, uRes: { value: new THREE.Vector2(1080, 1920) }, uR: { value: 6 }, uT: { value: 0 } };
  private wU = { uSun: { value: new THREE.Vector3(-300, 400, 250).normalize() }, uCam: { value: new THREE.Vector3() }, uGlowP: { value: new THREE.Vector3() }, uGlow: { value: 0 } };
  private qs = new THREE.Scene();
  private qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const [whale, cur] = await Promise.all([load('whale'), load('cursor')]);
    this.insts = [whale, cur];
    const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1); ramp.needsUpdate = true;
    whale.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const s = m.material as THREE.MeshStandardMaterial;
      const kind = s.name === 'Belly' ? 1 : s.name === 'Eye' ? 2 : 0;
      const u = { uSun: this.wU.uSun, uCam: this.wU.uCam, uGlowP: this.wU.uGlowP, uGlow: this.wU.uGlow, uKind: { value: kind } };
      m.material = new THREE.ShaderMaterial({ vertexShader: WHALE_V, fragmentShader: WHALE_F, uniforms: u }); });
    this.whale = whale.root; this.flukes = whale.part('flukes'); this.whale.scale.setScalar(WS); this.main.add(this.whale);
    this.whale.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(13 * WS, 200, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(whale.part('body'), true)[0];
    this.contactL.copy(this.whale.worldToLocal((hit?.point ?? new THREE.Vector3(5 * WS, 16, 0)).clone()));
    const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), new THREE.ShaderMaterial({ vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false }));
    this.main.add(sky);
    // cumulus: toon-lit puff clusters, warm tops, violet bellies
    const puff = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 4), new THREE.ShaderMaterial({ vertexShader: CLOUD_V, fragmentShader: CLOUD_F, uniforms: { uSun: this.wU.uSun, uCam: this.wU.uCam } }), 700);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    for (let i = 0, k = 0; i < 70; i++) {
      const cx = lerp(-900, 900, hash(i * 1.3)), cy = lerp(-420, 120, hash(i * 2.7)), cz = lerp(-1400, 200, hash(i * 3.9));
      if (Math.abs(cz) < 120 && Math.abs(cy) < 80) continue;
      const R = 30 + 70 * hash(i * 5.1);
      for (let j = 0; j < 10 && k < 700; j++, k++) {
        const a = hash(i * 9 + j) * 6.28, r = R * (0.2 + 0.9 * hash(i * 7 + j)), sz = R * (0.35 + 0.4 * hash(i * 11 + j));
        M.compose(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.abs(Math.sin(a)) * r * 0.35, cz + Math.sin(a) * r * 0.6), q, new THREE.Vector3(sz, sz * 0.8, sz)); puff.setMatrixAt(k, M);
        puff.setColorAt(k, c.setRGB(1, 0.86 + 0.1 * hash(i + j), 0.8));
      }
    }
    this.main.add(puff);
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.0); sun.position.set(-300, 400, 250);
    this.main.add(sun, new THREE.HemisphereLight(0x7fa8ff, 0x7a3a90, 0.9), this.glow);
    // paint splash from the impact: whale blue, belly cream and a little of the cursor's orange
    const N = 160; this.splash = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x222244 }), N);
    const pal = [[0.08, 0.25, 0.95], [0.25, 0.5, 1.2], [1.2, 0.95, 0.75], [1.4, 0.5, 0.05]];
    for (let i = 0; i < N; i++) { const a = hash(i * 1.9) * 6.28, up = 0.3 + hash(i * 2.3);
      this.drops.push({ v: new THREE.Vector3(Math.cos(a) * (6 + 16 * hash(i * 3.1)), up * 26, Math.sin(a) * (6 + 16 * hash(i * 4.1))), s: 0.12 + 0.4 * hash(i * 5.3) ** 2 });
      const p = pal[i % 7 === 0 ? 3 : Math.floor(hash(i * 6.7) * 3)]; this.splash.setColorAt(i, c.setRGB(p[0], p[1], p[2])); }
    this.main.add(this.splash);
    // blowhole spout: the whale answers the hit with a painted plume
    this.spout = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 90);
    for (let i = 0; i < 90; i++) this.spout.setColorAt(i, c.setRGB(...([[1.6, 1.6, 1.6], [0.8, 1.35, 1.7], [1.2, 1.5, 1.7]][i % 3] as [number, number, number])));
    this.spout.frustumCulled = false; this.whale.add(this.spout);
    (this.hero ??= new HeroPass(this.ctx.renderer)).dress(cur, { world: this.main });
    cur.part('scan').scale.set(1, 0.4, 0.35);
    this.cur = cur.root; this.cur.scale.setScalar(CS);
    const csun = sun.clone(); 
    this.qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: PAINT_F, uniforms: this.paintU, depthTest: false, depthWrite: false })));
  }

  private posWhale(t: number) {
    const d = t - DROP;
    this.whale.position.set(-6 * WS + 9 * d, -2 * Math.sin(d * 1.2), 0);
    this.whale.rotation.set(0.04 * Math.sin(d * 1.1), -0.25, 0.03 * Math.sin(d * 1.4) - 0.03 * Math.exp(-d * 4));
    this.flukes.rotation.y = 0.18 * Math.sin(d * 2.6);
    this.whale.updateMatrixWorld(true);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t, d = Math.max(0, t - DROP), rr = this.ctx.renderer;
    this.posWhale(t);
    const contact = this.whale.localToWorld(this.contactL.clone());
    // cursor: pinned + squashed on the back for 0.12 s, then ricochets up and away, tumbling
    const T0 = 0.12, dd = Math.max(0, d - T0);
    const launch = this.whale.localToWorld(this.contactL.clone());
    const p = d < T0 ? contact : launch.add(new THREE.Vector3(16 * dd, 30 * dd - 16 * dd * dd, 6 * dd));
    const sq = d < T0 ? 0.38 + 0.4 * (d / T0) : 1 + 0.35 * Math.exp(-dd * 7) * Math.cos(dd * 18);
    this.cur.position.copy(p); this.cur.scale.set(CS / Math.sqrt(sq), CS * sq, CS / Math.sqrt(sq));
    this.cur.rotation.set(0.3 * Math.exp(-dd * 3), 0, -3.4 * dd - 0.2);
    const blink = (d > 0.16 && d < 0.23) || (d > 0.31 && d < 0.38) ? 0.08 : d < 0.6 ? 1 : ((t * 1.06) % 1) < 0.55 ? 1 : 0.12;
    this.hero.update(t);
    this.wU.uGlowP.value.copy(p); this.wU.uGlow.value = 6 * blink * (1 + 3 * Math.exp(-d * 6));
    this.glow.position.copy(p); this.glow.intensity = 40 * blink * (1 + 3 * Math.exp(-d * 6));
    const M = new THREE.Matrix4(), q = new THREE.Quaternion();
    this.drops.forEach((dr, i) => { const tt = Math.max(0, d - 0.02 * hash(i));
      const pp = contact.clone().add(dr.v.clone().multiplyScalar(tt)).add(new THREE.Vector3(0, -14 * tt * tt, 0));
      const k = tt <= 0 ? 0 : dr.s * (1 - sm(0.8, 1.6, tt)) * (0.4 + Math.min(1, tt * 12));
      const vel = dr.v.clone().add(new THREE.Vector3(0, -28 * tt, 0)); const sp = vel.length();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vel.normalize());
      M.compose(pp, q, new THREE.Vector3(k * 0.7, k * (1 + sp * 0.12 * Math.exp(-tt * 2)), k * 0.7)); this.splash.setMatrixAt(i, M); });
    this.splash.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 90; i++) { const tt = d - 0.22 - 0.9 * hash(i * 2.9), a = hash(i * 7.3) * 6.28, r = 0.8 * hash(i * 4.4);
      const base = this.contactL.clone().add(new THREE.Vector3(3.5, 0.3, 0)), vy = 22 + 10 * hash(i * 3.7);
      const k = tt <= 0 ? 0 : 2.2 * (0.35 + 0.5 * hash(i * 8.1)) * (1 - sm(0.7, 1.3, tt)) * Math.min(1, tt * 10);
      const pp = base.add(new THREE.Vector3(Math.cos(a) * r * (1 + 4 * tt * tt), vy * tt - 16 * tt * tt, Math.sin(a) * r * (1 + 4 * tt * tt)));
      M.compose(pp, q.identity(), new THREE.Vector3(k, k * 1.3, k)); this.spout.setMatrixAt(i, M); }
    this.spout.instanceMatrix.needsUpdate = true;
    // camera: low over the whale's back for the hit, then follows the ricochet and pulls wide to show the whale
    const kick = Math.max(0, spring(d, 38, 9));
    const close = this.whale.localToWorld(new THREE.Vector3(30, 9 + kick * 0.8, 34));
    close.lerp(p, 0.68);
    const wide = this.whale.position.clone().add(new THREE.Vector3(60, 40, 330));
    const w = sm(0.25, 1.3, d);
    this.cam.position.copy(close.lerp(wide, w)); this.cam.fov = lerp(48, 46, w);
    const look = this.whale.localToWorld(new THREE.Vector3(14, 4.5, 0)).lerp(p.clone().lerp(this.whale.position.clone().add(new THREE.Vector3(10, 10, 0)), 0.5), w).lerp(p, 0.55 * (1 - w));
    this.cam.aspect = out.width / out.height; this.cam.updateProjectionMatrix(); this.cam.lookAt(look);
    if (!this.rt || this.rt.width !== out.width || this.rt.height !== out.height) { this.rt?.dispose(); this.rt = new THREE.WebGLRenderTarget(out.width, out.height, { type: THREE.HalfFloatType }); }
    this.wU.uCam.value.copy(this.cam.position); rr.setRenderTarget(this.rt); rr.setClearColor(0, 1); rr.clear(); rr.render(this.main, this.cam);
    this.paintU.tScene.value = this.rt.texture; this.paintU.uRes.value.set(out.width, out.height); this.paintU.uR.value = Math.min(12, Math.round(11 * out.height / 1920)); this.paintU.uT.value = t;
    const auto = rr.autoClear; rr.autoClear = false;
    rr.setRenderTarget(out); rr.clear(); rr.render(this.qs, this.qc); this.hero.render(rr, out, this.cam, d < 0.9 ? undefined : this.main); rr.autoClear = auto; rr.resetState();
    const hit = Math.exp(-d * 10);
    this.cameos.draw(this.ctx.renderer, out, f.t);
    return { toneMap: 'aces', exposure: 0.82, bloom: 0.15, bloomThreshold: 1.2, vignette: 0.35, grain: 0.03, ca: 0.2 + 1.2 * hit,
      shake: [30 * hit * Math.sin(t * 97), 30 * hit * Math.cos(t * 83)], zoom: 1 + 0.06 * hit };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.rt?.dispose(); }
}
void BAR;

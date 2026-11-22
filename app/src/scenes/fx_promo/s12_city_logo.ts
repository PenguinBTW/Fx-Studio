// s12_city_logo (bars 105-end, 203.9 - 214.5 s): the city becomes the logo. Night, street level in a dense downtown on
// the living-world coast (CityWorld: hills, bay, traffic, suburbs). From bar 105.5 every block re-forms on the beat in
// a left-to-right wave: blocks inside a rasterised "f(x) STUDIO" rise into lit towers, the rest sink to rooftops, while
// the camera cranes up out of the streets. On bar 108 the logo towers go white-hot, traffic streams orange around the
// letter outlines and the repo URL lights up along the shore road.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { CityWorld } from './city_world';
import { F, measure, textPath2D } from '../../engine/type';
import { clamp, ease, prog, smoothstep } from '../../engine/util';
import { C, BAR, BEAT, bar, sceneTime, lin, present } from './kit';

const T0 = bar(105);
const SEAL = bar(108);
const CELL = 0.31, NX = 180, NZ = 104, X0 = -((NX - 1) * CELL) / 2, Z0 = -17.5;
const h = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

const TOWER_VS = `attribute float aLogo; attribute float aEdge; attribute float aSeed; attribute float aRise;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying float vLogo; varying float vEdge; varying float vSeed; varying float vH; varying float vRise;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normal; vL = position; vLogo = aLogo; vEdge = aEdge; vSeed = aSeed; vRise = aRise; vH = length(instanceMatrix[1].xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TOWER_FS = `uniform float uT; uniform float uSeal; uniform float uFlash; uniform float uSweep; uniform vec3 uSig; uniform vec3 uBone; uniform vec3 uFog; uniform float uFogD;
varying vec3 vW; varying vec3 vN; varying vec3 vL; varying float vLogo; varying float vEdge; varying float vSeed; varying float vH; varying float vRise;
float hs(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  float logo = vLogo * vRise;
  vec3 base = vec3(0.022, 0.026, 0.036) * (0.6 + 0.4 * abs(vN.x)) + vec3(0.02, 0.03, 0.06) * max(vN.y, 0.0);
  vec3 c = base;
  if (vN.y > 0.5) {
    // Roofs: logo roofs are the letter faces, bone white with a cool rim; the rest dark with a few rooftop lights.
    vec2 q = abs(vL.xz) * 2.0;
    float rim = smoothstep(0.78, 0.98, max(q.x, q.y));
    vec3 roof = uBone * (0.55 + 0.35 * uSeal) + uSig * rim * 0.6 * (1.0 - uSeal);
    roof = mix(roof, uSig * 2.2, vEdge * rim);
    float spot = step(0.93, hs(vec3(floor(vW.xz * 3.0), vSeed))) * 0.6;
    c = mix(base + vec3(1.0, 0.55, 0.25) * spot * 0.4, roof, logo);
  } else {
    float wy = vW.y, along = abs(vN.x) > 0.5 ? vW.z : vW.x;
    vec2 g = vec2(along / 0.155, wy / 0.2);
    vec2 f = fract(g), id = floor(g);
    float win = step(0.18, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.78) * step(0.3, wy);
    float r = hs(vec3(id, vSeed * 91.0));
    float p = mix(0.42, 0.97, logo);
    float on = step(r, p) * win;
    vec3 warm = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.82, 0.55), hs(vec3(id.yx, vSeed)));
    vec3 hot = mix(uBone * 1.6, uBone * 3.0, uSeal);
    vec3 wc = mix(warm * (0.7 + 0.9 * r), hot, logo);
    wc = mix(wc, uSig * 3.0, vEdge * logo * (0.35 + 0.65 * uSeal));
    c += wc * on;
    // The sweep: a bright band runs up each letter tower as it locks, staggered across the city.
    c += uBone * 2.5 * logo * exp(-pow((wy / max(vH, 0.1) - uSweep + vSeed * 0.15) * 6.0, 2.0)) * (1.0 - uSeal * 0.6);
    // Traffic around the letters: orange light streams along the base of every outline tower.
    float stream = pow(0.5 + 0.5 * sin((vW.x + vW.z) * 3.0 - uT * 14.0), 6.0);
    c += uSig * 4.0 * vEdge * logo * smoothstep(0.22, 0.0, wy) * (0.25 + stream);
  }
  c *= 1.0 + uFlash * logo * 1.5;
  float d = length(vW - cameraPosition), fo = 1.0 - exp(-pow(uFogD * d, 2.0));
  c *= mix(0.2, 1.0, smoothstep(1.0, 7.0, d));
  gl_FragColor = vec4(mix(c, uFog, fo), 1.0);
}`;
const SKY_VS = `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FS = `uniform vec3 uSig; uniform float uT; uniform float uSeal; varying vec3 vD;
float hs(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 d = normalize(vD);
  float y = d.y;
  vec3 c = mix(vec3(0.05, 0.03, 0.045), vec3(0.004, 0.007, 0.02), smoothstep(-0.05, 0.5, y));
  c += uSig * (0.12 + 0.12 * uSeal) * exp(-abs(y - 0.01) * 14.0);
  vec2 sp = d.xz / (abs(y) + 0.3) * 160.0;
  float st = step(0.996, hs(floor(sp))) * smoothstep(0.05, 0.4, y);
  c += vec3(0.8, 0.85, 1.0) * st * (0.4 + 0.6 * hs(floor(sp) + 3.0));
  gl_FragColor = vec4(c, 1.0);
}`;

type Cell = { x: number; z: number; h0: number; h1: number; ts: number; logo: number };

export default class S12CityLogo extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 900);
  private world = new CityWorld();
  private cells: Cell[] = [];
  private towers!: THREE.InstancedMesh;
  private tMat!: THREE.ShaderMaterial;
  private rise!: THREE.InstancedBufferAttribute;
  private sky!: THREE.ShaderMaterial;
  private urlMat!: THREE.ShaderMaterial;
  private disposables: { dispose(): void }[] = [];
  private m = new THREE.Matrix4(); private p = new THREE.Vector3(); private s = new THREE.Vector3(); private q = new THREE.Quaternion();
  private hemi = new THREE.HemisphereLight(0x5a6a99, 0x0a0806, 0.5);
  private moon = new THREE.DirectionalLight(0x8899cc, 0.6);
  private posC = new THREE.CatmullRomCurve3([[0.0, 1.7, 15.5], [0.0, 2.1, 5.0], [-13.5, 2.6, 2.4], [-3, 14, 30], [0, 25, 37]].map((v) => new THREE.Vector3(...(v as [number, number, number]))));
  private tgtC = new THREE.CatmullRomCurve3([[0.0, 1.8, 0], [0.0, 3.2, -9], [6, 2.6, -1.6], [0, 1, -1.5], [0, 1.5, -0.5]].map((v) => new THREE.Vector3(...(v as [number, number, number]))));

  override async init() {
    // Rasterise the lockup into a mask on the block grid: 10 px per block.
    const PX = 10, cv = document.createElement('canvas');
    cv.width = NX * PX; cv.height = NZ * PX;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#fff';
    const fam = F.archivo(100, 900);
    const fit = (t: string, w: number, hgt: number) => Math.min(hgt, (hgt * w) / measure(t, fam, hgt));
    const s1 = fit('f(x)', cv.width * 0.62, cv.height * 0.62), s2 = fit('STUDIO', cv.width * 0.86, cv.height * 0.3);
    g.fill(textPath2D('f(x)', fam, s1, (cv.width - measure('f(x)', fam, s1)) / 2, cv.height * 0.56));
    g.fill(textPath2D('STUDIO', fam, s2, (cv.width - measure('STUDIO', fam, s2, s2 * 0.06)) / 2, cv.height * 0.93, s2 * 0.06));
    const img = g.getImageData(0, 0, cv.width, cv.height).data;
    const cov = (i: number, j: number) => { let a = 0; for (let u = 2; u < PX; u += 3) for (let v = 2; v < PX; v += 3) a += img[((j * PX + v) * cv.width + i * PX + u) * 4]! / 255; return a / 9; };
    const mask: number[] = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) mask.push(cov(i, j) > 0.45 ? 1 : 0);
    const isLogo = (i: number, j: number) => (i < 0 || j < 0 || i >= NX || j >= NZ ? 0 : mask[j * NX + i]!);
    const street = (x: number, z: number) => Math.abs(x) < 1.25 || [x, z].some((v) => { const k = (v / 3.2 + 7.5) % 1; return Math.min(k, 1 - k) * 3.2 < 0.5; });
    const span = NX * CELL;
    const aLogo: number[] = [], aEdge: number[] = [], aSeed: number[] = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL, id = j * NX + i, L = isLogo(i, j);
      const r = Math.hypot(x, z * 1.3);
      if (!L && street(x, z)) continue;
      const edge = L && (!isLogo(i - 1, j) || !isLogo(i + 1, j) || !isLogo(i, j - 1) || !isLogo(i, j + 1)) ? 1 : 0;
      const h0 = street(x, z) ? 0.02 : 0.35 + 5.8 * Math.exp(-(r * r) / (2 * 13 * 13)) * (0.35 + 0.95 * h(id, 1)) + 0.5 * h(id, 2);
      // Letters read as a skyline: 2x2 tower groups, thin strokes and stroke ends rise highest; the rest of the city stays
      // as low lit blocks, stepping down beside the letters so the outline stays crisp.
      let dn = 0, nearL = 0;
      for (let dj = -5; dj <= 5; dj++) for (let di = -5; di <= 5; di++) { const l = isLogo(i + di, j + dj); dn += l; if (l && Math.abs(di) <= 2 && Math.abs(dj) <= 2) nearL = 1; }
      const hg = h(Math.floor(i / 3) + Math.floor(j / 3) * NX, 3);
      const h1 = L ? (z < -1 ? 1.5 : 1) * (2.6 + 1.6 * (1 - dn / 121) ** 2 + 0.6 * hg) : nearL ? 0.25 + 0.15 * h(id, 4) : 0.45 + 1.0 * h(id, 4) * h(id, 7);
      const ts = T0 + 0.5 * BAR + Math.floor(clamp((x - X0) / span) * 7) * BEAT + 0.06 * h(id, 5);
      this.cells.push({ x, z, h0, h1, ts, logo: L });
      aLogo.push(L); aEdge.push(edge); aSeed.push(h(id, 6));
    }
    const bg = new THREE.BoxGeometry(CELL * 0.9, 1, CELL * 0.9); bg.translate(0, 0.5, 0);
    const n = this.cells.length;
    bg.setAttribute('aLogo', new THREE.InstancedBufferAttribute(new Float32Array(aLogo), 1));
    bg.setAttribute('aEdge', new THREE.InstancedBufferAttribute(new Float32Array(aEdge), 1));
    bg.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(aSeed), 1));
    this.rise = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    bg.setAttribute('aRise', this.rise);
    this.tMat = new THREE.ShaderMaterial({ vertexShader: TOWER_VS, fragmentShader: TOWER_FS, uniforms: {
      uT: { value: 0 }, uSeal: { value: 0 }, uFlash: { value: 0 }, uSweep: { value: 0 }, uSig: { value: new THREE.Color(...lin(C.signal)) },
      uBone: { value: new THREE.Color(...lin(C.bone)) }, uFog: { value: new THREE.Color(0.02, 0.016, 0.024) }, uFogD: { value: 0.01 } } });
    this.towers = new THREE.InstancedMesh(bg, this.tMat, n);
    this.towers.frustumCulled = false;
    this.sky = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSig: { value: new THREE.Color(...lin(C.signal)) }, uT: { value: 0 }, uSeal: { value: 0 } } });
    const skyG = new THREE.SphereGeometry(600, 48, 24), skyM = new THREE.Mesh(skyG, this.sky); skyM.renderOrder = -1; skyM.frustumCulled = false;
    // The URL as a lit road sign laid along the southern shore road, readable from the final crane.
    const uc = document.createElement('canvas'); uc.width = 2048; uc.height = 160;
    const ug = uc.getContext('2d')!, uf = F.mono(600), url = 'github.com/PenguinBTW/Fx-Studio', us = Math.min(120, (120 * 1960) / measure(url, uf, 120));
    ug.fillStyle = '#fff'; ug.fill(textPath2D(url, uf, us, (2048 - measure(url, uf, us)) / 2, 118));
    const utex = new THREE.CanvasTexture(uc); utex.anisotropy = 8; utex.colorSpace = THREE.SRGBColorSpace;
    this.urlMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTex: { value: utex }, uWipe: { value: 0 }, uBone: { value: new THREE.Color(...lin(C.bone)) }, uSig: { value: new THREE.Color(...lin(C.signal)) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D uTex; uniform float uWipe; uniform vec3 uBone; uniform vec3 uSig; varying vec2 vUv; void main(){ float a = texture2D(uTex, vUv).a; float w = smoothstep(uWipe, uWipe - 0.02, vUv.x); float e = exp(-abs(vUv.x - uWipe) * 60.0) * step(0.001, uWipe) * step(uWipe, 0.999); vec2 g = fract(vUv * vec2(640.0, 50.0)) - 0.5; float dots = 0.45 + 0.55 * smoothstep(0.5, 0.1, length(g)); gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * 5.0 * dots * a * w + uSig * 6.0 * e * (0.3 + a), max(a * w, e * 0.6)); }' });
    const ugeo = new THREE.PlaneGeometry(38, 38 * (160 / 2048), 96, 1); ugeo.rotateX(-Math.PI / 2);
    // Bend the sign along the curve of the shore road.
    const up = ugeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < up.count; i++) up.setZ(i, up.getZ(i) - 0.004 * up.getX(i) ** 2);
    const urlM = new THREE.Mesh(ugeo, this.urlMat); urlM.position.set(0, 0.06, Z0 + NZ * CELL + 0.9);
    this.moon.position.set(-60, 80, -40);
    this.scene.add(this.world.group, this.towers, skyM, urlM, this.hemi, this.moon);
    this.scene.fog = new THREE.FogExp2(0x050408, 0.006);
    this.disposables.push(bg, this.tMat, skyG, this.sky, ugeo, this.urlMat, utex, this.world, this.towers);
  }

  private camAt(T: number) {
    const ks = [T0, T0 + BAR, T0 + 2 * BAR, SEAL, 214.5];
    let i = 0; while (i < ks.length - 2 && T > ks[i + 1]!) i++;
    const u = clamp((T - ks[i]!) / (ks[i + 1]! - ks[i]!));
    const e = i === 0 ? u : i === ks.length - 2 ? ease.outCubic(u) : ease.inOutCubic(u);
    return (i + e) / (ks.length - 1);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const seal = smoothstep(SEAL - 0.15, SEAL + 0.35, T);
    const flash = T >= SEAL ? Math.exp(-(T - SEAL) * 4) : 0;
    const k = this.camAt(T);
    this.cam.position.copy(this.posC.getPoint(k));
    this.cam.lookAt(this.tgtC.getPoint(k));
    this.cam.fov = 50 - 6 * smoothstep(SEAL - BAR, 214.5, T);
    this.cam.updateProjectionMatrix();
    const R = this.rise.array as Float32Array;
    this.cells.forEach((c, i) => {
      const u = clamp((T - c.ts) / (1.15 * BEAT));
      const e = u <= 0 ? 0 : ease.outBack(u);
      const ht = Math.max(0.02, c.h0 + (c.h1 - c.h0) * e);
      this.towers.setMatrixAt(i, this.m.compose(this.p.set(c.x, 0, c.z), this.q, this.s.set(1, ht, 1)));
      R[i] = c.logo ? smoothstep(0.2, 1, u) : 0;
    });
    this.towers.instanceMatrix.needsUpdate = true; this.rise.needsUpdate = true;
    const U = this.tMat.uniforms;
    U.uT!.value = T; U.uSeal!.value = seal; U.uFlash!.value = flash + 0.2 * f.a.kick * seal;
    U.uSweep!.value = T < SEAL ? (((T - T0) / BEAT) % 1) * 1.5 - 0.25 : -1;
    this.sky.uniforms.uT!.value = T; this.sky.uniforms.uSeal!.value = seal;
    this.urlMat.uniforms.uWipe!.value = prog(T, SEAL + 0.5 * BAR, SEAL + 1.3 * BAR, ease.outCubic);
    this.world.update(T, { built: 1, night: 1, decay: 0, collapse: 0, top: this.top, bot: this.bot, sun: this.sun, sunCol: this.blk, fog: this.fogC, fogD: 0.006, tint: this.tint });
    present(this.ctx, out, this.scene, this.cam);
    const end = prog(T, 213.3, 214.45, ease.inOutQuad);
    // The low glide passes right beside the white-hot letter towers: pull exposure down so they don't burn out.
    const glide = smoothstep(T0 + 1.2 * BAR, T0 + 1.8 * BAR, T) * (1 - smoothstep(T0 + 2.4 * BAR, SEAL, T));
    return { exposure: (1.0 + 0.3 * flash) * (1 - 0.55 * glide), bloom: (0.45 + 0.25 * seal + 0.4 * flash) * (1 - 0.6 * glide), bloomThreshold: 1.0, vignette: 0.5, ca: 0.25 * (1 - seal) + 0.6 * flash, grain: 0.04, fade: end, invert: 0, zoom: 1 };
  }

  private top = new THREE.Color(0.004, 0.007, 0.02); private bot = new THREE.Color(0.05, 0.03, 0.045); private sun = new THREE.Vector3(-0.4, 0.3, -0.6);
  private blk = new THREE.Color(0, 0, 0); private fogC = new THREE.Color(0.02, 0.016, 0.024); private tint = new THREE.Color(0.35, 0.35, 0.4);

  override dispose() { this.disposables.forEach((d) => d.dispose()); }
}

// s11_mark (bars 105-end, 203.9 - 214.5 s): the end card as a portal wordmark. A huge Blender-built "f(x) STUDIO" whose
// front faces are windows into live worlds of the film (textures from fxp_portal_mark via kit.portals), black-chrome
// sides lit by a sweeping strip-light cube map, a mirror floor and the orange Thread weaving through the letters.
// On bar 108 the windows seal left-to-right into white-hot bone, the Thread straightens into an underline and the
// repo URL wipes in.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { RibbonGeometry, RibbonMesh } from '../../engine/ribbon';
import { clamp, ease, prog, hash } from '../../engine/util';
import { C, BAR, BEAT, bar, sceneTime, model, applyCam, lin, portals, mixKey, type CamKey } from './kit';

const T0 = bar(105);
const SEAL = bar(108);
const ORDER = ['f', 'lp', 'x', 'rp', 's0', 's1', 's2', 's3', 's4', 's5'];

const PORTAL_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PORTAL_FS = `uniform sampler2D uTex; uniform vec2 uRes; uniform float uSeal; uniform float uFlash; uniform float uZoom; uniform vec2 uOff;
uniform float uSweep; uniform vec3 uBone; uniform vec3 uSig; uniform vec3 uBox; varying vec3 vW;
void main(){
  vec2 s = gl_FragCoord.xy / uRes;
  vec2 d = (gl_FragCoord.xy - uBox.xy) / uBox.z;
  vec3 c = texture2D(uTex, clamp(0.5 + d * vec2(0.5625, 1.0) * uZoom + uOff, 0.001, 0.999)).rgb * (1.0 + uFlash);
  float e = mix(-3.4, 3.4, uSeal);
  float sealed = smoothstep(e + 0.05, e - 0.05, vW.x);
  vec3 bone = uBone * (1.05 + 0.25 * vW.y);
  c = mix(c, bone, sealed) + vec3(1.0, 0.96, 0.9) * (0.22 + 0.5 * sealed) * exp(-pow((vW.x * 0.3 + vW.y * 0.7 - uSweep) * 4.0, 2.0)) + uSig * 5.0 * exp(-abs(vW.x - e) * 14.0) * step(0.001, uSeal) * step(uSeal, 0.999);
  gl_FragColor = vec4(c, 1.0);
}`;
const SKY_FS = `uniform float uT; uniform float uBeam; uniform vec3 uSig; uniform vec3 uIce; varying vec3 vD;
void main(){
  vec3 d = normalize(vD);
  float hz = exp(-abs(d.y + 0.08) * 9.0);
  vec3 c = vec3(0.002, 0.002, 0.004) + uSig * 0.07 * hz + uIce * 0.012 * exp(-abs(d.y - 0.3) * 5.0);
  float a = atan(d.x, d.y + 0.35);
  float beams = pow(0.5 + 0.5 * sin(a * 18.0 + sin(a * 5.0 + uT * 0.3) * 2.5), 90.0) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(a * 7.0 - uT * 0.5), 3.0)) * smoothstep(0.1, -0.7, d.z) * smoothstep(-0.25, 0.3, d.y);
  c += mix(uSig, vec3(1.0, 0.9, 0.8), 0.35) * beams * uBeam;
  gl_FragColor = vec4(c, 1.0);
}`;
const FLOOR = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv; varying vec3 vW;
    void main(){
      vec3 r = vec3(0.0); float k = 0.0;
      for (int i = -2; i <= 2; i++) { vec4 q = vUv; q.x += float(i) * 0.006 * q.w; q.y += float(i * i) * 0.002 * q.w; r += texture2DProj(tDiffuse, q).rgb; k += 1.0; }
      float fall = exp(-length(vW.xz) * 0.16);
      gl_FragColor = vec4(mix(vec3(0.006) + r / k * 0.42 * fall, color, 1.0 - exp(-length(vW.xz) * 0.035)), 1.0);
    }`,
};

export default class S11Mark extends Scene {
  private scene = new THREE.Scene();
  private envScene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(38, 16 / 9, 0.005, 500);
  private cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  private cubeCam = new THREE.CubeCamera(0.05, 100, this.cubeRT);
  private strips: THREE.Mesh[] = [];
  private glyphs: { o: THREE.Object3D; u: Record<string, THREE.IUniform>; k: number; portal: THREE.ShaderMaterial; box: THREE.Box3 }[] = [];
  private mats: THREE.Material[] = [];
  private urlPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -10);
  private sky!: THREE.Mesh;
  private floor!: Reflector;
  private ribbons: RibbonMesh[] = [];
  private stem = new THREE.Vector3();
  private front = 0.2;
  private black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);

  override async init() {
    this.black.needsUpdate = true;
    const inst = await model(this.ctx, 'fx_wordmark');
    this.scene.add(inst.root);
    const side = new THREE.MeshPhysicalMaterial({ color: 0x15161a, metalness: 1, roughness: 0.17, envMap: this.cubeRT.texture, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: 0.06 });
    const url = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.bone), emissive: new THREE.Color(C.bone).multiplyScalar(0.35), roughness: 0.35, metalness: 0.3, envMap: this.cubeRT.texture, clippingPlanes: [this.urlPlane] });
    this.mats.push(side, url);
    const col = (h: string) => new THREE.Vector3(...lin(h));
    inst.root.traverse((o) => {
      const part = o.userData?.fx_part as string | undefined;
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      let p: THREE.Object3D | null = m, pn = part ?? '';
      while (p && !pn) { pn = (p.userData?.fx_part as string) ?? ''; p = p.parent; }
      if (pn === 'url') { m.material = url; return; }
      const k = ORDER.indexOf(pn);
      let g = this.glyphs.find((x) => x.k === k);
      if (!g) {
        const u: Record<string, THREE.IUniform> = { uTex: { value: this.black }, uRes: { value: new THREE.Vector2(1920, 1080) }, uSeal: { value: 0 }, uFlash: { value: 0 }, uZoom: { value: 0.75 }, uBox: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector2() }, uSweep: { value: -9 }, uBone: { value: col(C.bone).multiplyScalar(1.15) }, uSig: { value: col(C.signal) } };
        const portal = new THREE.ShaderMaterial({ vertexShader: PORTAL_VS, fragmentShader: PORTAL_FS, uniforms: u, toneMapped: false });
        this.mats.push(portal);
        g = { o: m, u, k, portal, box: new THREE.Box3() };
        this.glyphs.push(g);
      }
      const pm = g.portal;
      const pick = (mm: THREE.Material) => (mm.name === 'Portal' ? pm : side);
      m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material);
      if ((m.material as THREE.Material) === pm) g.o = m;
    });
    inst.root.updateMatrixWorld(true);
    for (const g of this.glyphs) g.box.setFromObject(g.o.parent?.userData?.fx_part ? g.o.parent : g.o);
    const fb = new THREE.Box3().setFromObject(this.glyphs.find((g) => g.k === 0)!.o);
    this.front = fb.max.z;
    this.stem.set(fb.min.x + 0.36 * (fb.max.x - fb.min.x), fb.min.y + 0.28 * (fb.max.y - fb.min.y), fb.max.z);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, toneMapped: false,
      uniforms: { uT: { value: 0 }, uBeam: { value: 0 }, uSig: { value: col(C.signal) }, uIce: { value: col(C.ice) } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SKY_FS,
    }));
    this.scene.add(this.sky);
    this.floor = new Reflector(new THREE.PlaneGeometry(400, 400), { textureWidth: 960, textureHeight: 540, clipBias: 0.003, color: new THREE.Color(...lin(C.signal, 0.07)), shader: FLOOR });
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1.32;
    this.scene.add(this.floor);

    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(...lin(C.signal, 2.2)), side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(...lin('#FFF0DC', 2.6)), side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.mats.push(glow, core);
    const spine = (t: number, u: number): [number, number, number] => {
      const sl = prog(t, SEAL + BEAT, SEAL + 1.4 * BAR, ease.inOutCubic);
      const x = (u - 0.5) * (10 * (1 - sl) + 4.6 * sl);
      const y = 0.12 + 0.34 * Math.sin(u * 7 - t * 1.3) * Math.cos(u * 3.1 + t * 0.4);
      const z = 0.6 * Math.sin(u * 11 + t * 0.9);
      return [x * (1 - 0.3 * sl), y * (1 - sl) - 0.98 * sl, z * (1 - sl) + 0.2 * sl];
    };
    for (const [w, m] of [[0.032, glow], [0.009, core]] as const) {
      const r = new RibbonMesh(new RibbonGeometry({ segments: 320, spine, width: (u: number) => w * Math.min(1, u * 12, (1 - u) * 12), twist: 0, time: T0 }), m);
      r.frustumCulled = false; this.ribbons.push(r); this.scene.add(r);
    }

    const mk = (w: number, c: THREE.ColorRepresentation, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
      this.envScene.add(m); this.strips.push(m);
    };
    mk(2.2, 0xffffff, 7); mk(0.8, C.signal, 9); mk(3.0, 0xffffff, 3); mk(0.7, C.ice, 5);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.signal).multiplyScalar(0.12) }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = -6; this.envScene.add(fl);
    this.envScene.background = new THREE.Color(0x010102);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = T - T0;
    const lb = lt / BAR, nb = Math.floor(lb), ph = lb - nb;
    const r = this.ctx.renderer;
    const sweep = nb + ease.inOutCubic(clamp(ph * 2));
    this.strips.forEach((s, i) => { const a = (sweep + i * 0.3) * Math.PI * 0.5; s.position.set(Math.sin(a) * 9, 0, Math.cos(a) * 9); s.lookAt(0, 0, 0); });
    this.cubeCam.update(r, this.envScene);
    r.resetState();

    const seal = prog(T, SEAL, SEAL + 0.8 * BAR, ease.inOutQuad);
    const tex = portals.tex;
    const beatF = (T - T0) / BEAT, beatN = Math.floor(beatF);
    const hit = Math.floor(hash(beatN, 7) * 10);
    this.glyphs.forEach((g) => {
      const U = g.u;
      U.uTex!.value = tex.length ? tex[(g.k + Math.max(0, nb) * 3) % tex.length] : this.black;
      (U.uRes!.value as THREE.Vector2).set(out.width, out.height);
      U.uSeal!.value = seal;
      U.uSweep!.value = -5 + 10 * ease.inOutCubic(clamp(ph * 1.6));
      U.uFlash!.value = (hit === g.k ? 1.2 : 0) * Math.exp(-(beatF - beatN) * 4) * (1 - seal);
      (U.uOff!.value as THREE.Vector2).set(-this.cam.position.x * 0.012 + (hash(g.k, 3) - 0.5) * 0.06, -this.cam.position.y * 0.012);
    });
    for (const m of this.ribbons) m.update(T);
    const su = (this.sky.material as THREE.ShaderMaterial).uniforms;
    su.uT!.value = T;
    su.uBeam!.value = (0.18 + 0.5 * f.a.kick) * (0.7 + 0.5 * seal);
    this.urlPlane.constant = -3.2 + 6.4 * prog(T, SEAL + 0.6 * BAR, SEAL + 1.3 * BAR, ease.outCubic);

    // Shots: fly out of the f's stem (bar 105), drift wide (106), low mirror-floor angle (107), front lock-up + push (108-).
    const wide: CamKey = { pos: [0.15, 0.05, 3.3], tgt: [0, -0.12, 0], fov: 38 };
    let k: CamKey;
    if (nb < 1) {
      const o1 = ease.outExpo(clamp(lb / 0.95));
      const inside: CamKey = { pos: [this.stem.x, this.stem.y, this.front + 0.045], tgt: [this.stem.x, this.stem.y, -10], fov: 40 };
      k = mixKey(inside, wide, o1);
      k.roll = 0.25 * (1 - o1);
    } else if (nb < 2) k = mixKey(wide, { pos: [0.75, 0.2, 2.9], tgt: [0.05, -0.1, 0], fov: 37 }, ease.inOutQuad(ph));
    else if (nb < 3) k = mixKey({ pos: [-1.5, -1.18, 3.2], tgt: [0, -0.1, 0], fov: 36, roll: -0.04 }, { pos: [-0.9, -1.15, 2.9], tgt: [0, -0.15, 0], fov: 35, roll: -0.03 }, ease.inOutQuad(ph));
    else k = mixKey({ pos: [0, -0.3, 4.7], tgt: [0, -0.36, 0], fov: 36 }, { pos: [0, -0.32, 4.15], tgt: [0, -0.37, 0], fov: 36 }, ease.outCubic(clamp((T - SEAL) / (214.5 - SEAL))));
    applyCam(this.cam, k, f.a.kick * 0.35 * (1 - seal));

    const v = new THREE.Vector3();
    this.cam.updateMatrixWorld();
    for (const g of this.glyphs) {
      g.box.getCenter(v).project(this.cam);
      const cx = (v.x * 0.5 + 0.5) * out.width, cy = (v.y * 0.5 + 0.5) * out.height;
      v.set(g.box.min.x, g.box.max.y, g.box.max.z).project(this.cam);
      const ty = (v.y * 0.5 + 0.5) * out.height;
      v.set(g.box.min.x, g.box.min.y, g.box.max.z).project(this.cam);
      const h = Math.max(4, Math.abs(ty - (v.y * 0.5 + 0.5) * out.height));
      (g.u.uBox!.value as THREE.Vector3).set(cx, cy, h);
    }
    r.localClippingEnabled = true;
    r.setRenderTarget(out);
    r.setClearColor(0x010102, 1);
    r.clear();
    r.render(this.scene, this.cam);
    r.localClippingEnabled = false;
    r.resetState();

    const flash = T >= SEAL ? Math.exp(-(T - SEAL) * 5) : 0;
    const end = prog(T, 213.3, 214.45, ease.inOutQuad);
    return { exposure: 1 + 0.35 * flash, bloom: 0.75 + 0.3 * flash, bloomThreshold: 0.85, vignette: 0.55, ca: (0.35 + 0.6 * f.a.snare) * (1 - seal), grain: 0.045, fade: end };
  }

  override dispose(): void {
    this.mats.forEach((m) => m.dispose());
    this.cubeRT.dispose();
    this.floor.dispose();
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    for (const m of this.ribbons) m.geometry.dispose();
    this.black.dispose();
  }
}

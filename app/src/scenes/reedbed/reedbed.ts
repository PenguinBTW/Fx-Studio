// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// reedbed — a marsh at first light, cinematic pass.
// Blender-built GLB (assets/reeds/model.glb): reed + cattail clump archetypes,
// a worn jetty, a flat-bottomed punt, a grey heron (wingL/wingR for the
// flare), a lily pad, a snag. The scene mirrors a cold dawn sky on a true
// Reflector water plane, breaks the mirror with expanding ripple rings and
// skimming dragonflies, drifts mist sheets between reed stands, and holds a
// narrow warm rim band on the horizon against steel-blue fog. The heron
// stays motionless until the flare beat, then lifts off up and right.
// All motion closed-form f(t).
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { CameraRig, orbitPosition } from '../../engine/rig';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { Layer2D, W, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// beats
const SKIM = 4.0;    // dragonflies start working the water
const FLARE = 10.5;  // heron wing-flare + takeoff
const SETTLE = 14.5; // the rim warms; the marsh exhales

const CAPTIONS: Array<[number, number, string, [number, number, number]]> = [
  [0.8, 3.0, 'first light on still water', [1, 1.4, 20]],
  [4.6, 6.8, 'the marsh holds its breath', [7.5, 2.6, 18]],
  [8.8, 11.0, 'mist pours slow between the reeds', [-6, 2.6, 14]],
  [11.4, 13.6, 'grey on grey until the flare', [7.5, 3.4, 18]],
  [15.2, 17.6, 'dawn finds the reedbed', [0, 2.2, 22]],
];

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// cold dawn sky: steel zenith, pale blue-grey horizon haze, one narrow warm
// band burning at the sun-side rim (+z, slightly -x), thin stratus streaks.
const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uT;
  uniform float uWarm;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.1, 1.0);
    vec3 lo = mix(vec3(0.42, 0.47, 0.53), vec3(0.48, 0.50, 0.53), uWarm * 0.4);
    vec3 hi = mix(vec3(0.10, 0.14, 0.21), vec3(0.11, 0.15, 0.22), uWarm);
    vec3 col = mix(lo, hi, smoothstep(-0.02, 0.5, h));
    // narrow warm rim at the horizon on the sun side (+z, a little -x)
    float sunAmt = smoothstep(0.18, 0.95, dot(normalize(d.xz), normalize(vec2(-0.24, 0.97))));
    col += vec3(0.85, 0.42, 0.16) * sunAmt * exp(-max(h, 0.0) * 9.0) * (0.9 + 0.9 * uWarm);
    col += vec3(0.55, 0.22, 0.06) * sunAmt * sunAmt * exp(-max(h, 0.0) * 18.0);
    // horizontal stratus streaks: heavily stretched fbm bands, cold grey
    // tops warmed faintly on the sun side
    if (d.y > 0.02 && d.y < 0.6) {
      vec2 cp = d.xz / (d.y + 0.35);
      float cn = 0.0, amp = 0.55;
      vec2 pp = cp * vec2(0.9, 6.5) + vec2(uT * 0.006, 0.0);
      for (int o = 0; o < 4; o++) { cn += amp * vn(pp); pp = pp * 2.05 + 13.1; amp *= 0.5; }
      float band = smoothstep(0.03, 0.12, d.y) * (1.0 - smoothstep(0.28, 0.55, d.y));
      float cov = smoothstep(0.52, 0.85, cn) * band;
      vec3 shade = vec3(0.42, 0.47, 0.53);
      vec3 lit = mix(vec3(0.62, 0.63, 0.62), vec3(0.95, 0.62, 0.34), sunAmt * (0.4 + 0.6 * uWarm));
      col = mix(col, mix(shade, lit, sunAmt * 0.7 + 0.15), cov * 0.22);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

// soft streaked mist texture (long horizontal smears, alpha edges)
function mistTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, 512, 128);
  for (let i = 0; i < 90; i++) {
    const x = hash(i * 3.1) * 512;
    const y = 20 + hash(i * 7.7) * 88;
    const w = 60 + hash(i * 5.3) * 160;
    const h = 6 + hash(i * 9.1) * 16;
    const a = 0.05 + hash(i * 11.3) * 0.10;
    const g = c.createRadialGradient(x, y, 0, x, y, w / 2);
    g.addColorStop(0, `rgba(226,232,238,${a})`);
    g.addColorStop(1, 'rgba(226,232,238,0)');
    c.fillStyle = g;
    c.save();
    c.translate(x, y); c.scale(1, h / w); c.translate(-x, -y);
    c.fillRect(x - w / 2, y - h / 2, w, h);
    c.restore();
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping;
  return tx;
}

// seeded value-noise texture for reed/wood PBR breakup (map + rough + bump)
function noiseTexture(size: number, octaves: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.5, fr = 1;
    for (let o = 0; o < octaves; o++) {
      v += amp * hash(Math.floor(x * fr * 0.061) * 7.7 + Math.floor(y * fr * 0.061) * 131.3 + o * 17.7);
      amp *= 0.5; fr *= 2.1;
    }
    const g = Math.floor((0.40 + 0.42 * v) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(6, 6);
  return tx;
}

export default class ReedbedScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private skyMat!: THREE.ShaderMaterial;
  private glb!: GLTFInstance;
  private water!: Reflector;
  private waterMat!: THREE.MeshStandardMaterial;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private rim!: THREE.DirectionalLight;
  private heron!: THREE.Object3D;
  private wingL?: THREE.Object3D;
  private wingR?: THREE.Object3D;
  // wing pivots: verts are baked at world coords, so node rotation pivots at
  // the world origin — rotate around the baked center C via T' = T0 + C - R*C
  private wingCL = new THREE.Vector3(7.1, 1.25, 17.95);
  private wingCR = new THREE.Vector3(7.9, 1.25, 17.95);
  private wingT0L = new THREE.Vector3();
  private wingT0R = new THREE.Vector3();
  private punt!: THREE.Object3D;
  private reeds: THREE.Object3D[] = [];
  private lilies: THREE.Object3D[] = [];
  private mists: THREE.Mesh[] = [];
  private rings: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; x: number; z: number; ph: number; rate: number; dab?: boolean }[] = [];
  private flies: { g: THREE.Group; wl: THREE.Mesh; wr: THREE.Mesh; ph: number }[] = [];
  private glow!: THREE.Sprite;
  private noiseTex!: THREE.CanvasTexture;
  private mistTex!: THREE.CanvasTexture;
  private glareMat!: THREE.MeshBasicMaterial;
  private glareTex!: THREE.CanvasTexture;
  private swayU = { value: 0 };
  private sunBase = new THREE.Color();
  private dummy = new THREE.Object3D();

  override async init() {
    const scene = this.three;
    scene.fog = new THREE.FogExp2(0x4e5a64, 0.012);

    // ---- lighting: low warm 3000K key just clearing the far bank (+z,-x) ----
    const [kr, kg, kb] = blackbodyToLinearSRGB(3000);
    this.sunBase.setRGB(kr, kg, kb);
    this.sun = new THREE.DirectionalLight(this.sunBase.clone(), 2.4);
    this.sun.position.set(-15.5, 6, 95.6); // azimuth -14° — same as the sky warm band + glow
    this.sun.target.position.set(4, 0.5, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -50;
    this.sun.shadow.camera.right = 50;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.normalBias = 0.12;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun, this.sun.target);

    // cold sky fill over dark water
    const [cr, cg, cb] = blackbodyToLinearSRGB(8000);
    this.hemi = new THREE.HemisphereLight(new THREE.Color(cr, cg, cb), 0x3a4038, 0.65);
    scene.add(this.hemi);

    // faint cool rim behind the camera — separates near reeds from fog
    this.rim = new THREE.DirectionalLight(0x8fa5b8, 0.4);
    this.rim.position.set(8, 12, -40);
    scene.add(this.rim);

    // ---- sky dome + low warm glow at the horizon ----
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uT: { value: 0 }, uWarm: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), this.skyMat));

    const glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 128;
    const gc = glowCv.getContext('2d')!;
    const grad = gc.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,190,120,0.9)');
    grad.addColorStop(0.4, 'rgba(255,160,80,0.35)');
    grad.addColorStop(1, 'rgba(255,140,60,0)');
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCv),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.glow.position.set(-38, 2.5, 150);
    this.glow.scale.setScalar(46);
    scene.add(this.glow);

    // ---- water: a true mirror plane, cold-steely tint ----
    this.water = new Reflector(new THREE.PlaneGeometry(160, 62), {
      textureWidth: 960,
      textureHeight: 540,
      clipBias: 0.004,
      color: new THREE.Color(0xa8b4bc),
    });
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0, 20);
    scene.add(this.water);

    // ---- mud banks: near (camera perch), left/right edges, far fringe ----
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x3a3828, roughness: 0.96 });
    this.noiseTex = noiseTexture(256, 4);
    mudMat.map = this.noiseTex; mudMat.roughnessMap = this.noiseTex;
    const banks: Array<[number, number, number, number, number, number]> = [
      // [cx, cy, cz, sx, sy, sz]
      [0, -0.15, -19, 130, 0.5, 10],  // near bank — camera perch; water laps at z=-9
      [-17, -0.15, 19, 12, 0.42, 46], // left sedge edge
      [17, -0.15, 19, 12, 0.42, 46],  // right sedge edge
      [0, -0.1, 42, 130, 0.55, 14],   // far bank — reed fringe on the horizon
      [1.5, -0.22, 24, 7, 0.34, 6],   // mid-water mud bump (snag + reed island)
      [-9.5, -0.25, 26, 5, 0.3, 5],   // second shallow island
    ];
    for (const [cx, cy, cz, sx, sy, sz] of banks) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mudMat);
      b.position.set(cx, cy, cz);
      b.receiveShadow = true;
      scene.add(b);
    }

    // ---- the GLB: reed archetypes, jetty, punt, heron, lily, snag ----
    this.glb = await GLTFManager.instantiate(resolveAsset('reeds', this.ctx.project ?? 'reedbed').url, {
      castShadow: true,
      receiveShadow: true,
    });
    scene.add(this.glb.root);
    this.glb.root.traverse((o) => {
      const m = o as THREE.Mesh;
      const mats = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (!mats) return;
      for (const mm of Array.isArray(mats) ? mats : [mats]) {
        mm.map = this.noiseTex;
        mm.roughnessMap = this.noiseTex;
        mm.bumpMap = this.noiseTex;
        mm.bumpScale = 1.4;
      }
    });
    // keep only what the layout uses at its authored spot
    const heronPart = this.glb.part('heron');
    this.heron = heronPart ?? this.glb.root;
    this.wingL = this.heron.getObjectByName('wingL');
    this.wingR = this.heron.getObjectByName('wingR');
    if (this.wingL) this.wingT0L.copy(this.wingL.position);
    if (this.wingR) this.wingT0R.copy(this.wingR.position);
    this.punt = this.glb.part('punt') ?? this.glb.root;

    // ---- reed stands: clump archetypes cloned along every bank edge ----
    const clump = this.glb.part('reeds');
    const tall = this.glb.part('reedTall');
    const hide = (o: THREE.Object3D | undefined) => { if (o) o.visible = false; };
    hide(clump); hide(tall); hide(this.glb.part('lily'));
    const spots: Array<[number, number, 'reeds' | 'tall']> = [];
    // left + right sedge edges — two staggered rows for density
    for (let i = 0; i < 46; i++) {
      const side = i % 2 ? -1 : 1;
      const inner = i % 3 === 0;
      spots.push([side * (inner ? 11.6 + hash(i * 3.1) * 1.8 : 13.4 + hash(i * 3.1) * 3.2),
        -2 + hash(i * 7.7) * 40, hash(i * 5.9) < 0.22 ? 'tall' : 'reeds']);
    }
    // far fringe — dense band on the horizon line
    for (let i = 0; i < 44; i++) {
      spots.push([-42 + i * 2.6 + hash(i * 4.3) * 2.0, 34.5 + hash(i * 6.1) * 4.0, hash(i * 8.7) < 0.3 ? 'tall' : 'reeds']);
    }
    // shallow islands + foreground frame clumps (bigger, darker, near camera)
    spots.push([1.5, 23, 'reeds'], [0.2, 26, 'reeds'], [-9.5, 26, 'reeds'], [-10.6, 25, 'reeds'], [3.4, 25.5, 'reeds']);
    spots.push([-9.5, 0.5, 'reeds'], [9.8, 1.5, 'reeds'], [-11, -2, 'reeds'], [11.5, -0.5, 'reeds'],
              [-7.5, -0.5, 'reeds'], [8.2, -1.5, 'reeds'],
              // very close frame-edge blades — dark out-of-focus depth layer
              [-5.5, -3.5, 'reeds'], [6.8, -4.0, 'reeds'], [-9.0, -4.5, 'reeds'], [10.5, -3.2, 'reeds']);
    spots.forEach(([x, z, kind], i) => {
      const src = kind === 'tall' ? tall : clump;
      if (!src) return;
      const r = src.clone();
      r.visible = true;
      r.position.set(x, -0.05, z);
      r.rotation.y = hash(i * 3.7) * Math.PI * 2;
      const s = (z < 2 ? 1.5 : 0.9) + hash(i * 5.1) * 0.8;
      r.scale.set(s, s * (0.9 + hash(i * 7.3) * 0.4), s);
      r.userData.phase = hash(i * 9.9) * 6.28;
      scene.add(r);
      this.reeds.push(r);
    });

    // ---- lily pads near the punt + right edge ----
    const lilySrc = this.glb.part('lily');
    for (let i = 0; i < 34; i++) {
      if (!lilySrc) break;
      const cl = lilySrc.clone();
      cl.visible = true;
      const x = -11 + hash(i * 3.3) * 24;
      const z = -4 + hash(i * 7.9) * 33;
      cl.position.set(x, 0.02, z);
      cl.rotation.y = hash(i * 5.7) * Math.PI * 2;
      cl.scale.setScalar(1.1 + hash(i * 11.1) * 1.0);
      scene.add(cl);
      this.lilies.push(cl);
    }

    // ---- sun-glare path: additive gradient streak laid on the water ----
    const pathCv = document.createElement('canvas');
    pathCv.width = 256; pathCv.height = 512;
    const pc = pathCv.getContext('2d')!;
    const pg = pc.createLinearGradient(0, 0, 0, 512);
    pg.addColorStop(0, 'rgba(255,190,110,0)');
    pg.addColorStop(0.35, 'rgba(255,175,95,0.55)');
    pg.addColorStop(0.7, 'rgba(230,140,60,0.25)');
    pg.addColorStop(1, 'rgba(200,110,50,0)');
    pc.fillStyle = pg;
    pc.fillRect(0, 0, 256, 512);
    // horizontal falloff so it reads as a narrow glitter lane
    const px = pc.getImageData(0, 0, 256, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 256; x++) {
      const u = Math.abs(x - 128) / 128;
      const w = 0.25 + 0.75 * (y / 512);         // widens toward the viewer
      px.data[(y * 256 + x) * 4 + 3] *= Math.max(0, 1 - Math.pow(u / w, 2.2));
    }
    pc.putImageData(px, 0, 0);
    const pathTex = new THREE.CanvasTexture(pathCv);
    const pathMat = new THREE.MeshBasicMaterial({
      map: pathTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.5, fog: false,
    });
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(26, 46), pathMat);
    glare.rotation.x = -Math.PI / 2;
    glare.rotation.z = Math.PI + Math.atan2(this.glow.position.x + 8, this.glow.position.z - 18); // long axis points at the sun glow
    glare.position.set(-8, 0.012, 18);
    scene.add(glare);
    this.glareMat = pathMat; this.glareTex = pathTex;

    // ---- mist sheets: drifting translucent cards low over the water ----
    this.mistTex = mistTexture();
    for (let i = 0; i < 5; i++) {
      const mm = new THREE.MeshBasicMaterial({
        map: this.mistTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.26 - i * 0.026,
        fog: false,
        side: THREE.DoubleSide,
      });
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(85 + i * 18, 4.0 + i * 0.9), mm);
      mp.position.set(0, 0.4 + i * 0.5, 9 + i * 6.2);
      scene.add(mp);
      this.mists.push(mp);
    }

    // ---- ripple rings: seeded drip points + a heron-strike burst ----
    const ringGeo = new THREE.RingGeometry(0.44, 0.5, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringSpots: Array<[number, number]> = [
      [-4.5, 12], [3.5, 25.6], [-9.6, 26.3], [10.5, 21], [-2, 30], [7.5, 17.6], [2, 14.5], [-12.5, 20], [-6, 17],
    ];
    ringSpots.forEach(([x, z], i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xb8c8d2, transparent: true, opacity: 0, depthWrite: false, fog: false,
      });
      const m = new THREE.Mesh(ringGeo, mat);
      m.position.set(x, 0.02, z);
      scene.add(m);
      this.rings.push({ m, mat, x, z, ph: hash(i * 7.31) * 4, rate: 0.16 + hash(i * 3.7) * 0.12 });
    });

    // ---- dragonflies: three darting silhouettes over the water ----
    const dfBodyMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.7 });
    const dfWingMat = new THREE.MeshStandardMaterial({ color: 0x9fb2bd, roughness: 0.4, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.55, 6), dfBodyMat);
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const wl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.008, 0.13), dfWingMat);
      wl.position.set(-0.26, 0.02, 0.04);
      const wr = wl.clone(); wr.position.x = 0.26;
      g.add(wl, wr);
      scene.add(g);
      this.flies.push({ g, wl, wr, ph: i * 2.31 });
    }
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      skim: t >= SKIM && t <= FLARE + 4 ? 1 : 0,
      flare: t >= FLARE && t <= FLARE + 4.2 ? 1 : 0,
      settle: t >= SETTLE && t <= 18 ? 1 : 0,
    };
  }

  // dragonfly darting path — jagged quick zigzags with occasional dips
  private flyPath(i: number, t: number, out: THREE.Vector3): void {
    const ph = this.flies[i].ph;
    out.set(
      Math.sin(t * 0.55 + ph * 3) * 10 + Math.sin(t * 2.1 + ph) * 2.6,
      Math.max(0.12, 0.55 + Math.sin(t * 4.7 + ph * 5) * 0.28 - 0.4 * Math.pow(Math.max(0, Math.sin(t * 0.62 + ph * 7)), 8)),
      13 + Math.sin(t * 0.9 + ph * 1.7) * 9 + Math.sin(t * 1.7 + ph * 2.3) * 3,
    );
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.skyMat.uniforms.uT.value = t;

    const settle = ss(SETTLE, 17.4, t);
    this.skyMat.uniforms.uWarm.value = settle;

    // dawn warming (not dusk): the rim strengthens, fog thins a little
    this.sun.intensity = 2.4 * (1 + 0.35 * settle);
    this.hemi.intensity = 0.55 * (1 + 0.15 * settle);
    this.rim.intensity = 0.4 - 0.1 * settle;
    (this.three.fog as THREE.FogExp2).density = 0.016 - 0.005 * settle;
    this.glow.material.opacity = 0.85 + 0.15 * settle;

    // reed stands breathe — slow sway, taller clumps bend more
    for (const rd of this.reeds) {
      const ph = rd.userData.phase as number;
      rd.rotation.z = Math.sin(t * 1.3 + ph) * 0.018;
      rd.rotation.x = Math.cos(t * 0.9 + ph * 1.7) * 0.012;
    }

    // mist sheets pour slowly left across the water
    this.mists.forEach((mp, i) => {
      mp.position.x = Math.sin(t * 0.05 + i * 1.9) * 18 - t * 0.22 * (i % 2 ? 1 : -0.6);
      mp.position.x = ((mp.position.x + 60) % 120) - 60;
    });

    // punt rocks almost imperceptibly at its mooring — hull sits IN the water
    this.punt.rotation.x = 0.014 * Math.sin(t * 0.7 + 1);
    this.punt.rotation.z = 0.010 * Math.sin(t * 0.9 + 0.4);
    this.punt.position.y = -0.16 + 0.02 * Math.sin(t * 0.8);

    // ---- heron: motionless until FLARE, then wings open + lift off ----
    const flareUp = ss(FLARE, FLARE + 0.9, t);          // wings spread
    const fly = ss(FLARE + 0.7, SETTLE - 0.2, t);       // rises + exits
    const flap = Math.sin(t * 9.0) * 0.55 * ss(FLARE + 1.2, FLARE + 1.8, t);
    const wingPose = (w: THREE.Object3D | undefined, c: THREE.Vector3, t0: THREE.Vector3, a: number) => {
      if (!w) return;
      const ca = Math.cos(a), sa = Math.sin(a);
      w.rotation.z = a;
      w.position.set(t0.x + c.x - (c.x * ca - c.y * sa), t0.y + c.y - (c.x * sa + c.y * ca), t0.z);
    };
    wingPose(this.wingL, this.wingCL, this.wingT0L, flareUp * 0.95 + flap);
    wingPose(this.wingR, this.wingCR, this.wingT0R, -flareUp * 0.95 - flap);
    if (fly > 0) {
      this.heron.position.x = 7.5 + 12.0 * fly;
      this.heron.position.y = 5.8 * Math.pow(fly, 0.85);
      this.heron.position.z = 18 - 8.0 * fly;
      this.heron.rotation.y = -0.5 * fly;
      this.heron.rotation.z = 0.18 * fly;
    } else {
      // motionless: standing pose restored so scrubbing back re-shows it
      this.heron.position.set(7.5, 0, 18);
      this.heron.rotation.set(0.006 * Math.sin(t * 0.5), 0, 0);
    }
    this.heron.visible = fly < 0.995;

    // dragonflies skim; when one dips, its ring fires at that spot
    const nFlies = t > SKIM && t < FLARE + 3 ? this.flies.length : (t <= SKIM ? 0 : 2);
    this.flies.forEach((d, i) => {
      const on = i < nFlies;
      d.g.visible = on;
      if (!on) return;
      this.flyPath(i, t, this.v);
      d.g.position.copy(this.v);
      d.g.rotation.y = Math.cos(t * 0.9 + d.ph) * 0.8;
      const wingFlick = Math.sin(t * 42 + d.ph * 9) * 0.4;
      d.wl.rotation.z = 0.15 + wingFlick;
      d.wr.rotation.z = -0.15 - wingFlick;
      // dab rings on the low dips (rings 6-8 are the flies'; 5 is the heron's)
      if (this.v.y < 0.16) {
        const rng = this.rings[6 + i];
        if (rng) { rng.ph = -t * rng.rate; rng.m.position.set(this.v.x, 0.02, this.v.z); rng.dab = true; }
      }
    });

    // ripple rings expand + fade in a loop; the heron ring fires big on flare
    for (let i = 0; i < this.rings.length; i++) {
      const rng = this.rings[i];
      if (i >= 6) {
        if (!rng.dab) rng.m.position.set(rng.x, 0.02, rng.z);
        rng.dab = false;
      }
      let age = (t * rng.rate + rng.ph) % 1;
      if (i === 5) { // heron-strike ring
        const u = (t - FLARE) / 3.0;
        if (u < 0 || u > 1) { rng.mat.opacity = 0; continue; }
        age = u;
        rng.m.position.set(7.5, 0.02, 18);
      }
      rng.m.scale.setScalar(0.6 + age * (i === 5 ? 14 : 5.5));
      rng.mat.opacity = (1 - age) * (i === 5 ? 0.4 : 0.22);
    }

    // CameraRig: low on the near bank, slow leftward drift holding jetty
    // left-third and heron right-third; a soft push toward the heron on flare
    const yaw = Math.PI - 0.10 - t * 0.008 + 0.015 * Math.sin(t * 0.05);
    const rad = 21 - 2.5 * ss(0, 12, t) - 1.5 * flareUp;
    const anchor: [number, number, number] = [-0.5, 2.6, 9];
    const pos = orbitPosition(anchor, rad, 0.040 + 0.010 * Math.sin(t * 0.04), yaw);
    pos[1] = Math.max(pos[1], 3.1);
    this.rig.position = pos;
    const aimX = -0.5 + 6.5 * ss(FLARE, FLARE + 1.6, t);
    this.rig.target = [
      aimX + 0.3 * Math.sin(t * 0.05),
      1.0 + 0.8 * flareUp + 0.12 * Math.sin(t * 0.07),
      16 + 2.0 * flareUp,
    ];
    this.rig.roll = 0.003 * Math.sin(t * 0.04);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 44 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text, anchor] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        const ndc = this.v.set(anchor[0], anchor[1], anchor[2]).project(this.cam);
        if (ndc.z > 1) continue;
        const cx0 = (ndc.x * 0.5 + 0.5) * W;
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.16, 72), H - 72);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(8, 12, 16, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e6edf2';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.10,
      bloom: 0.38,
      bloomThreshold: 0.64,
      bloomRadius: 0.7,
      ca: 0.05,
      grain: 0.05,
      vignette: 0.34,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.glb?.dispose();
    this.noiseTex?.dispose();
    this.mistTex?.dispose();
    this.glareMat?.dispose();
    this.glareTex?.dispose();
    this.water?.getRenderTarget().dispose();
    this.water?.geometry.dispose();
    (this.water?.material as THREE.Material | undefined)?.dispose();
    this.glow?.material.map?.dispose();
    this.glow?.material.dispose();
    this.sun?.shadow.map?.dispose();
    this.mists.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
    this.rings.forEach((r2) => { r2.m.geometry.dispose(); r2.mat.dispose(); });
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

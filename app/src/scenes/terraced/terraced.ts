// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// terraced — a dry-stone terraced hillside at golden hour, cinematic pass.
// Blender-built GLB (assets/terraces/model.glb): 8 segmented terrace walls,
// a stone barn with quoins + glowing window, a winding slab path with stone
// stiles, one cypress + one olive tree archetype, and a robed figure with a
// lantern. The scene rebuilds the heightfield (shared contract with build.py),
// clones trees onto the flat bands, walks the figure down the path with a
// flickering lantern light, layers a heat-hazed valley, dry-grass + herb +
// poppy scatter with shader sway, a crossing swallow flock and a circling
// buzzard, and a key/fill/rim 2800K lighting rig with FogExp2. All motion
// closed-form f(t).
import * as THREE from 'three';
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
const FLOCK = 5.5;    // swallows cross the valley
const GUST = 9.8;     // a warm gust rolls through the foliage
const SETTLE = 14.2;  // the gold cools; the lantern takes over

// --- shared heightfield contract with assets/terraces/build.py ---
// glTF maps Blender Y -> -Z, so the terrain descends toward +z.
const LEVEL = 1.05;
const wander = (x: number) => 0.5 * Math.sin(x * 0.06) + 0.22 * Math.sin(x * 0.17 + 1.3);
const terrH = (x: number, z: number): number => {
  const v = -0.18 * z + wander(x);
  const k = Math.floor(v / LEVEL);
  const f = v / LEVEL - k;
  return LEVEL * (k + ss(0.80, 1.0, f));
};
// z of the wall band for level k at lateral x (same solver as bandZ_, flipped)
const wallZ = (x: number, k: number) => (wander(x) - (k + 0.9) * LEVEL) / 0.18;
// z of the flat mid-band of terrace level k — where trees + scatter sit
const bandZ = (x: number, k: number) => (wander(x) - (k + 0.45) * LEVEL) / 0.18;
// the path: a descending diagonal — same curve as build.py, which samples
// Blender Y; glTF z = -Y, so the scene-side path is the mirrored curve
const pathX = (z: number) => 7.0 + 9.0 * Math.sin(-z * 0.115 + 0.6);

const CAPTIONS: Array<[number, number, string, [number, number, number]]> = [
  [0.8, 3.0, 'generations cut this hill into steps', [-11, terrH(-11, 23.5) + 4.0, 23.5]],
  [4.2, 6.4, 'the stone holds the day\'s last warmth', [6, terrH(6, 14) + 2.2, 14]],
  [8.8, 11.0, 'one figure keeps to the path', [7, terrH(7, 18) + 2.4, 18]],
  [11.8, 13.9, 'the valley swims in heat', [0, -7.5, 55]],
  [15.0, 17.6, 'dusk finds the terraces', [-11, terrH(-11, 23.5) + 4.5, 23.5]],
];

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// golden-hour sky: a thick amber band burning low on the sun side (-x, +z
// slightly), violet-blue zenith, thin cirrus streaks, first faint stars late.
const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uT;
  uniform float uDusk;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.1, 1.0);
    vec3 lo = mix(vec3(0.34, 0.17, 0.10), vec3(0.10, 0.07, 0.11), uDusk);
    vec3 hi = mix(vec3(0.075, 0.10, 0.22), vec3(0.03, 0.04, 0.11), uDusk);
    vec3 col = mix(lo, hi, smoothstep(-0.02, 0.55, h));
    // sun-side burn: wide warm lobe low toward azimuth (-x, +z)
    float sunAmt = smoothstep(0.15, 0.95, dot(normalize(d.xz), normalize(vec2(-0.83, 0.55))));
    col += vec3(0.95, 0.38, 0.10) * sunAmt * exp(-max(h, 0.0) * 5.5) * (1.35 - 0.75 * uDusk);
    col += vec3(0.55, 0.16, 0.02) * sunAmt * sunAmt * exp(-max(h, 0.0) * 14.0);
    // thin cirrus streaks: stretched fbm bands high up, warm-lit on sun side
    if (d.y > 0.04) {
      vec2 cp = d.xz / (d.y + 0.28);
      float cn = 0.0, amp = 0.55;
      vec2 pp = cp * vec2(1.4, 5.2) + vec2(uT * 0.010, uT * 0.003);
      for (int o = 0; o < 4; o++) { cn += amp * vn(pp); pp = pp * 2.03 + 11.7; amp *= 0.5; }
      float band = smoothstep(0.06, 0.16, d.y) * (1.0 - smoothstep(0.5, 0.85, d.y));
      float cov = smoothstep(0.36, 0.56, cn) * band;
      vec3 shade = mix(vec3(0.16, 0.13, 0.19), vec3(0.06, 0.06, 0.11), uDusk);
      vec3 lit = vec3(0.95, 0.52, 0.24) * (1.0 - 0.65 * uDusk);
      col = mix(col, mix(shade, lit, sunAmt * 0.85 + 0.10), cov * 0.95);
    }
    // first faint stars only near the zenith and only as dusk settles
    vec2 sp = vec2(atan(d.x, d.z) * 30.0, d.y * 60.0);
    float star = step(0.997, h21(floor(sp))) * smoothstep(0.55, 0.85, d.y)
               * (0.4 + 0.6 * sin(uT * 2.0 + h21(floor(sp) + 7.0) * 40.0));
    col += vec3(0.8, 0.85, 1.0) * star * uDusk * 0.8;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// seeded value-noise texture for stone/wood PBR breakup (map + rough + bump)
function stripeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const course = Math.floor(y / 5) % 2;
    const jitter = hash(Math.floor(y / 5) * 17.3 + Math.floor(x / 9) * 5.1) * 0.20;
    const mortar = (y % 5) === 0 ? 0.20 : 0.0;
    const v = Math.floor((0.45 + jitter * (course ? 1 : -1) * 0.5 - mortar + 0.3) * 255);
    const i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(1, 1);
  return tx;
}

function noiseTexture(size: number, octaves: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(size, size);
  const val = (x: number, y: number, o: number) => {
    let acc = 0, amp = 1, fr = 1, tot = 0;
    for (let k = 0; k < o; k++) {
      acc += amp * hash(Math.floor(x * fr) * 13.7 + Math.floor(y * fr) * 71.3 + k * 101.0);
      tot += amp; amp *= 0.55; fr *= 2.03;
    }
    return acc / tot;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = Math.floor((0.55 + 0.45 * val(x / 9, y / 9, octaves)) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(6, 6);
  return tx;
}

// dry-grass tuft: 6 tapered blades fanned around the origin, vertex-colored
// root-olive to tip-straw — the parched Mediterranean variant
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.4 * Math.sin(b * 7.0);
    const lean = 0.12 + 0.18 * hash(b * 3.3);
    const hgt = 0.38 + 0.24 * hash(b * 5.1);
    const wid = 0.048;
    const dx = Math.cos(a), dz = Math.sin(a);
    const bx = lean * dx, bz = lean * dz;
    const px = -dz * wid, pz = dx * wid;
    const quad = (y0: number, y1: number, w0: number, w1: number, lx0: number, lz0: number, lx1: number, lz1: number, shade: number) => {
      const p = [
        [px * w0 + lx0, y0, pz * w0 + lz0], [-px * w0 + lx0, y0, -pz * w0 + lz0],
        [px * w1 + lx1, y1, pz * w1 + lz1], [-px * w1 + lx1, y1, -pz * w1 + lz1],
      ];
      pos.push(
        p[0][0], p[0][1], p[0][2], p[1][0], p[1][1], p[1][2], p[2][0], p[2][1], p[2][2],
        p[1][0], p[1][1], p[1][2], p[3][0], p[3][1], p[3][2], p[2][0], p[2][1], p[2][2],
      );
      for (let k = 0; k < 6; k++) col.push(shade, shade, shade);
      for (let k = 0; k < 6; k++) nrm.push(0, 0.8, 0.6);
    };
    quad(0, hgt * 0.55, 1.0, 0.7, 0, 0, bx * 0.5, bz * 0.5, 0.62);
    quad(hgt * 0.55, hgt, 0.7, 0.10, bx * 0.5, bz * 0.5, bx, bz, 1.35);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.computeVertexNormals();
  return g;
}

// herb clump: a low rounded dome of short blades — thyme/rosemary reads
function herbGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.22, 1);
  g.scale(1.5, 0.5, 1.4);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const up = clamp01(pos.getY(i) / 0.18 + 0.4);
    const n = hash(i * 3.71);
    col[i * 3] = 0.16 + 0.10 * n * up;
    col[i * 3 + 1] = 0.24 + 0.14 * n * up;
    col[i * 3 + 2] = 0.10 + 0.06 * n * up;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// poppy: thin stem + a small open cup of scarlet petals — dots of red on the gold
function poppyGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const push = (pts: number[][], c: [number, number, number]) => {
    pos.push(...pts[0], ...pts[1], ...pts[2]);
    for (let k = 0; k < 3; k++) col.push(...c);
    for (let k = 0; k < 3; k++) nrm.push(0, 1, 0);
  };
  const stem: [number, number, number] = [0.20, 0.32, 0.10];
  const w = 0.012;
  push([[w, 0, 0], [-w, 0, 0], [0.02, 0.34, 0.01]], stem);
  push([[0, 0, w], [0, 0, -w], [0.02, 0.34, -0.01]], stem);
  const pet: [number, number, number] = [0.72, 0.10, 0.06];
  const cy = 0.34, r = 0.055;
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    const a2 = ((p + 1) / 5) * Math.PI * 2;
    push([[Math.cos(a) * r * 0.4, cy, Math.sin(a) * r * 0.4],
          [Math.cos(a2) * r * 0.4, cy, Math.sin(a2) * r * 0.4],
          [(Math.cos((a + a2) / 2)) * r * 1.7, cy + 0.045, (Math.sin((a + a2) / 2)) * r * 1.7]], pet);
  }
  push([[0.02 - 0.02, cy + 0.01, 0], [0.02 + 0.02, cy + 0.01, 0], [0.02, cy + 0.035, 0]], [0.10, 0.05, 0.05]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.computeVertexNormals();
  return g;
}

// swallow: slim body diamond + swept scythe wings; aWing weights the flap
function birdGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], w: number[]) => {
    pos.push(...a, ...b, ...c);
    wing.push(...w);
  };
  const nose = [0.42, 0, 0], tail = [-0.42, 0, 0];
  const top = [0, 0.09, 0], bot = [0, -0.07, 0];
  const lf = [0, 0, 0.075], rt = [0, 0, -0.075];
  tri(nose, top, lf, [0, 0, 0]); tri(nose, lf, bot, [0, 0, 0]);
  tri(nose, bot, rt, [0, 0, 0]); tri(nose, rt, top, [0, 0, 0]);
  tri(tail, lf, top, [0, 0, 0]); tri(tail, bot, lf, [0, 0, 0]);
  tri(tail, rt, bot, [0, 0, 0]); tri(tail, top, rt, [0, 0, 0]);
  tri(tail, [-0.55, 0.02, 0.09], [-0.55, 0.02, -0.09], [0.15, 0.15, 0.15]);
  const wl = [[0.05, 0.02, 0.05], [-0.18, 0.03, 0.45], [-0.42, 0.04, 0.78], [-0.05, 0.02, 0.32]];
  tri(wl[0], wl[1], wl[3], [0, 0.45, 0.1]);
  tri(wl[1], wl[2], wl[3], [0.45, 1.0, 0.1]);
  tri(wl[0], wl[3], [0.05, 0.0, 0.05], [0, 0.1, 0]);
  const wr = wl.map((p) => [p[0], p[1], -p[2]]);
  tri(wr[0], wr[3], wr[1], [0, 0.1, 0.45]);
  tri(wr[1], wr[3], wr[2], [0.45, 0.1, 1.0]);
  tri(wr[0], [0.05, 0.0, -0.05], wr[3], [0, 0, 0.1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(wing), 1));
  g.computeVertexNormals();
  return g;
}

// soft haze card texture: wide soft band fading at top+bottom edges
function hazeTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const c = cv.getContext('2d')!;
  const img = c.createImageData(256, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 256; x++) {
    const nx = x / 256, ny = y / 128;
    const n = hash(Math.floor(nx * 40) * 3.7 + Math.floor(ny * 20) * 9.1) * 0.5
            + hash(Math.floor(nx * 90) * 7.3 + Math.floor(ny * 40) * 5.3) * 0.5;
    const a = Math.floor(190 * ss(0, 0.35, ny) * (1 - ss(0.7, 1.0, ny)) * (0.6 + 0.4 * n));
    const i = (y * 256 + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 220; img.data[i + 2] = 190;
    img.data[i + 3] = a;
  }
  c.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

export default class TerracedScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private skyMat!: THREE.ShaderMaterial;
  private glb!: GLTFInstance;
  private figure!: THREE.Object3D;
  private lanternLight = new THREE.PointLight(0xffa03c, 0.0, 12, 2);
  private lanternGlow!: THREE.Sprite;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private rim!: THREE.DirectionalLight;
  private swifts!: THREE.InstancedMesh;
  private birdMat!: THREE.MeshBasicMaterial;
  private buzzard!: THREE.Group;
  private grass!: THREE.InstancedMesh;
  private grass2!: THREE.InstancedMesh;
  private herbs!: THREE.InstancedMesh;
  private poppies!: THREE.InstancedMesh;
  private stones!: THREE.InstancedMesh;
  private trees: THREE.Object3D[] = [];
  private hazes: THREE.Mesh[] = [];
  private sunBase = new THREE.Color();
  private sunDusk = new THREE.Color();
  private swayU = { value: 0 };
  private gustU = { value: 0 };
  private flapU = { value: 0 };
  private glow!: THREE.Sprite;
  private noiseTex!: THREE.CanvasTexture;
  private stripeTex!: THREE.CanvasTexture;
  private hazeTex!: THREE.CanvasTexture;
  private dummy = new THREE.Object3D();

  override async init() {
    const scene = this.three;
    scene.fog = new THREE.FogExp2(0x6b5340, 0.0080);

    // ---- lighting: 2800K raking key from -x (across the terraces) ----
    const [kr, kg, kb] = blackbodyToLinearSRGB(2800);
    this.sunBase.setRGB(kr, kg, kb);
    const [dr, dg, db] = blackbodyToLinearSRGB(2100);
    this.sunDusk.setRGB(dr, dg, db);
    this.sun = new THREE.DirectionalLight(this.sunBase.clone(), 3.4);
    this.sun.position.set(-30, 9, 82);
    this.sun.target.position.set(4, -5, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 50;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.normalBias = 0.12;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun, this.sun.target);

    const [cr, cg, cb] = blackbodyToLinearSRGB(7000);
    this.hemi = new THREE.HemisphereLight(new THREE.Color(cr, cg, cb), 0x5a3a20, 0.5);
    scene.add(this.hemi);

    // cool-violet rim from deep in the valley behind — separates walls from haze
    this.rim = new THREE.DirectionalLight(0xa8815f, 0.5);
    this.rim.position.set(12, 16, -46);
    scene.add(this.rim);

    // ---- sky dome + low sun glow ----
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uT: { value: 0 }, uDusk: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(320, 32, 20), this.skyMat));

    const glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 128;
    const gc = glowCv.getContext('2d')!;
    const grad = gc.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,190,110,0.95)');
    grad.addColorStop(0.35, 'rgba(255,150,60,0.4)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCv),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    // sun sits just over the left horizon, low — the raking light source
    this.glow.position.set(-155, 8, 55);
    this.glow.scale.setScalar(52);
    scene.add(this.glow);

    // ---- terraced hillside: displaced grid matching the GLB contract ----
    const geo = new THREE.PlaneGeometry(240, 170, 190, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // terrace field over z∈[0,~46]; beyond that the hill falls away fast
      // into a smooth hazed valley — no bands out there
      const v0 = -0.18 * z + wander(x);
      const fade = ss(34, 42, z); // 0 on the field, 1 in the valley
      const k0 = Math.floor(v0 / LEVEL);
      const f0 = v0 / LEVEL - k0;
      const stepped = LEVEL * (k0 + ss(0.80, 1.0, f0));
      const smooth = v0 - 0.5 * LEVEL; // same trend, no quantisation
      let y = stepped * (1 - fade) + smooth * fade;
      if (z > 36) y -= (z - 36) * (0.9 + 0.03 * (z - 36)); // valley drops away fast
      if (z < 0) y += 0.55 * Math.min(-z, 14) * 0.06; // gentle rise toward camera
      pos.setY(i, y - 0.10);
      const n = hash(x * 3.7 + z * 9.1) * 0.55 + hash(x * 13.1 + z * 5.3) * 0.45;
      // parched gold with green watered patches on the flat bands
      const bandF = ((v0 / LEVEL) % 1 + 1) % 1;
      const flat = (1 - ss(0.62, 0.80, bandF)) * (1 - fade);
      const g = 0.28 + 0.16 * n;
      colors[i * 3] = g * (0.95 + 0.15 * flat) * (1 - 0.3 * fade);
      colors[i * 3 + 1] = g * (0.68 + 0.30 * flat) * (1 - 0.1 * fade);
      colors[i * 3 + 2] = g * (0.34 + 0.10 * fade);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.97,
      metalness: 0.0,
    }));
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- the GLB: walls, barn, path, tree archetypes, figure ----
    this.glb = await GLTFManager.instantiate(resolveAsset('terraces', this.ctx.project ?? 'terraced').url, {
      castShadow: true,
      receiveShadow: true,
    });
    scene.add(this.glb.root);
    this.noiseTex = noiseTexture(256, 4);
    this.stripeTex = stripeTexture();
    this.glb.root.traverse((o) => {
      const m = o as THREE.Mesh;
      const mats = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (!mats) return;
      for (const mm of Array.isArray(mats) ? mats : [mats]) {
        if (mm.name === 'glassb' || mm.name === 'lant') continue;
        mm.map = this.noiseTex;
        mm.roughnessMap = this.noiseTex;
        const stone = /^stone/i.test(mm.name);
        mm.bumpMap = stone ? this.stripeTex : this.noiseTex;
        mm.bumpScale = stone ? 1.6 : 2.4;
      }
    });
    const fig = this.glb.part('figure');
    this.figure = fig ?? this.glb.root;
    // seat the barn slightly into its terrace ledge
    const barn = this.glb.part('barn');
    if (barn) barn.position.y -= 0.14;

    // ---- trees: cypress + olive clones seated on the flat bands ----
    const cyp = this.glb.part('cypress');
    const olv = this.glb.part('olive');
    const hide = (o: THREE.Object3D | undefined) => { if (o) o.visible = false; };
    hide(cyp); hide(olv); // archetypes at origin stay hidden
    type TreeSpec = [number, 'cyp' | 'olv', number];
    const specs: TreeSpec[] = [
      [-3, 'cyp', 0.0], [-3, 'olv', 1.0],
      [-4, 'olv', 0.0], [-4, 'olv', 0.35], [-4, 'olv', 0.7],
      [-5, 'cyp', 0.2], [-5, 'olv', 0.55],
      [-6, 'olv', 0.1], [-6, 'olv', 0.6], [-6, 'cyp', 0.85],
      [-7, 'olv', 0.25], [-7, 'olv', 0.75],
      [-7, 'olv', 0.4], [-7, 'olv', 0.9],
    ];
    specs.forEach(([k, kind, ph], i) => {
      const src = kind === 'cyp' ? cyp : olv;
      if (!src) return;
      const x = -38 + ((i * 47.3 + ph * 90) % 76);
      const z = bandZ(x, k) + (ph - 0.5) * 1.2;
      const tr = src.clone();
      tr.visible = true;
      tr.position.set(x, terrH(x, z) - 0.06, z);
      const s = 0.8 + hash(i * 7.7) * 0.55;
      tr.scale.set(s, s * (0.9 + hash(i * 11.1) * 0.3), s);
      tr.rotation.y = hash(i * 5.3) * Math.PI * 2;
      tr.userData.phase = hash(i * 13.9) * Math.PI * 2;
      tr.userData.cyp = kind === 'cyp';
      scene.add(tr);
      this.trees.push(tr);
    });

    // ---- scatter: dry tufts, herb clumps, poppies, wall-base stones ----
    const tuft = tuftGeometry();
    const mkSwayMat = (tint: number, amp: number) => {
      const m = new THREE.MeshStandardMaterial({
        color: tint,
        vertexColors: true,
        roughness: 0.92,
        side: THREE.DoubleSide,
      });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uSway = this.swayU;
        sh.uniforms.uGust = this.gustU;
        sh.vertexShader = 'uniform float uSway;\nuniform float uGust;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float wp = instanceMatrix[3][0] * 0.29 + instanceMatrix[3][2] * 0.23;
            float sw = sin(uSway * 1.6 + wp) * (0.10 + 0.30 * uGust);
            transformed.x += sw * transformed.y * ${amp.toFixed(2)};
            transformed.z += cos(uSway * 1.2 + wp * 1.7) * transformed.y * ${(amp * 0.5).toFixed(2)} * (0.5 + uGust);
          #endif`,
        );
      };
      return m;
    };
    this.grass = new THREE.InstancedMesh(tuft, mkSwayMat(0xa89a4a, 1.0), 5200);
    this.grass2 = new THREE.InstancedMesh(tuft, mkSwayMat(0x7d8a3c, 1.0), 2800);
    const scatter = (mesh: THREE.InstancedMesh, n: number, seed: number, flatOnly: boolean) => {
      let placed = 0, tries = 0;
      while (placed < n && tries < n * 4) {
        tries++;
        const x = -46 + hash(seed + placed * 2.17 + tries * 0.31) * 92;
        const z = -9 + hash(seed + placed * 5.71 + tries * 0.77) * 59;
        const v = -0.18 * z + wander(x);
        const f = ((v / LEVEL) % 1 + 1) % 1;
        if (flatOnly && f > 0.78) continue;
        if (Math.abs(x - pathX(z)) < 1.6) continue; // keep the path clear
        this.dummy.position.set(x, terrH(x, z) - 0.04, z);
        this.dummy.rotation.set((hash(seed + placed * 7.3) - 0.5) * 0.3, hash(seed + placed * 3.9) * Math.PI * 2, 0);
        const s = 0.45 + hash(seed + placed * 13.3) * 0.85;
        this.dummy.scale.set(s * 1.25, s * (0.6 + hash(seed + placed * 17.1) * 0.8), s);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(placed, this.dummy.matrix);
        placed++;
      }
      mesh.count = placed;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
    scatter(this.grass, 5200, 11, false);
    scatter(this.grass2, 2800, 733, true);
    this.herbs = new THREE.InstancedMesh(herbGeometry(), mkSwayMat(0xffffff, 0.35), 420);
    scatter(this.herbs, 420, 421, true);
    this.poppies = new THREE.InstancedMesh(poppyGeometry(), mkSwayMat(0xffffff, 0.8), 300);
    scatter(this.poppies, 300, 919, false);

    // rubble stones at wall bases + field scatter
    const rockGeo = new THREE.DodecahedronGeometry(0.22, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8074, roughness: 0.95 });
    this.stones = new THREE.InstancedMesh(rockGeo, rockMat, 260);
    for (let i = 0; i < 260; i++) {
      let x: number, z: number;
      if (i < 150) { // tuck most at wall bases on the downhill side
        const k = -1 - (i % 7);
        x = -44 + hash(i * 3.3) * 88;
        z = wallZ(x, k) - 0.55 - hash(i * 7.1) * 0.7;
      } else {
        x = -46 + hash(i * 2.9) * 92;
        z = -1 + hash(i * 7.7) * 50;
      }
      this.dummy.position.set(x, terrH(x, z) - 0.02, z);
      this.dummy.rotation.set(hash(i * 3.1) * 3, hash(i * 5.9) * 3, hash(i * 9.7) * 3);
      const s = 0.3 + hash(i * 11.3) * 1.3;
      this.dummy.scale.set(s, s * (0.5 + hash(i * 13.7) * 0.5), s);
      this.dummy.updateMatrix();
      this.stones.setMatrixAt(i, this.dummy.matrix);
    }
    this.stones.castShadow = true;
    this.stones.receiveShadow = true;
    scene.add(this.stones);

    // ---- figure: walks the path downhill, lantern swinging ----
    this.figure.scale.setScalar(1.5);
    this.lanternLight.distance = 14;
    scene.add(this.lanternLight);
    const lgCv = document.createElement('canvas');
    lgCv.width = lgCv.height = 64;
    const lc = lgCv.getContext('2d')!;
    const lg = lc.createRadialGradient(32, 32, 2, 32, 32, 32);
    lg.addColorStop(0, 'rgba(255,190,100,0.85)');
    lg.addColorStop(0.4, 'rgba(255,150,60,0.30)');
    lg.addColorStop(1, 'rgba(255,120,40,0)');
    lc.fillStyle = lg;
    lc.fillRect(0, 0, 64, 64);
    this.lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(lgCv),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.0,
    }));
    this.lanternGlow.scale.setScalar(1.6);
    scene.add(this.lanternGlow);

    // ---- the hazed valley: two flat, far, violet ridge silhouettes + haze ----
    const ridgeMat = (c: number, o: number) => new THREE.MeshBasicMaterial({
      color: c, transparent: true, opacity: o, fog: false, depthWrite: false,
    });
    const mkRidge = (zc: number, h0: number, seed: number, mat: THREE.Material) => {
      const pts: number[] = [];
      const N = 40;
      for (let i = 0; i < N; i++) {
        const x0 = -360 + (i / (N - 1)) * 720;
        const x1 = -360 + ((i + 1) / (N - 1)) * 720;
        const y0 = h0 + 4 * Math.sin(x0 * 0.011 + seed) + 2 * Math.sin(x0 * 0.04 + seed * 2.7);
        const y1 = h0 + 4 * Math.sin(x1 * 0.011 + seed) + 2 * Math.sin(x1 * 0.04 + seed * 2.7);
        pts.push(x0, -80, zc, x1, -80, zc, x0, y0, zc, x1, -80, zc, x1, y1, zc, x0, y0, zc);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      scene.add(m);
    };
    mkRidge(150, -14, 1.7, ridgeMat(0x5a4652, 0.5));
    mkRidge(210, -8, 3.3, ridgeMat(0x7a5e60, 0.32));
    this.hazeTex = hazeTexture();
    for (let i = 0; i < 4; i++) {
      const hm = new THREE.MeshBasicMaterial({
        map: this.hazeTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.30 - i * 0.045,
        fog: false,
      });
      const hp = new THREE.Mesh(new THREE.PlaneGeometry(340, 30), hm);
      hp.position.set(0, -8 - i * 2.5, 48 + i * 28);
      scene.add(hp);
      this.hazes.push(hp);
    }

    // ---- foreground frame interest: a near wall run at the bottom edge and
    // a half-buried boulder on the right third ----
    const fgWallMat = new THREE.MeshStandardMaterial({
      color: 0x6e6558, roughness: 0.97, map: this.noiseTex, bumpMap: this.noiseTex, bumpScale: 0.8,
    });
    for (let i = 0; i < 0; i++) {
      const x = -28 + i * 5.4 + (hash(i * 3.3) - 0.5) * 0.6;
      const z = -1.6 - Math.sin(x * 0.11) * 1.0;
      const y = terrH(x, z) - 0.10;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.55 + hash(i * 7.1) * 0.2, 0.55), fgWallMat);
      seg.position.set(x, y + 0.22, z);
      seg.rotation.y = -Math.atan2(Math.cos(x * 0.11) * 0.13, 1);
      seg.castShadow = true;
      seg.receiveShadow = true;
      scene.add(seg);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.62), fgWallMat);
      cap.position.set(x, y + 0.52, z);
      cap.rotation.copy(seg.rotation);
      cap.castShadow = true;
      scene.add(cap);
    }
    const bould = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 1), rockMat);
    bould.position.set(21, terrH(21, -4) + 0.35, -4);
    bould.scale.set(1.3, 0.85, 1.1);
    bould.rotation.set(0.4, 1.1, 0.2);
    bould.castShadow = true;
    bould.receiveShadow = true;
    scene.add(bould);

    // ---- swifts: a small crossing flock low over the valley ----
    const birdGeo = birdGeometry();
    const phases = new Float32Array(60);
    for (let i = 0; i < 60; i++) phases[i] = hash(i * 9.77) * Math.PI * 2;
    birdGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.birdMat = new THREE.MeshBasicMaterial({ color: 0x14100e, side: THREE.DoubleSide });
    this.birdMat.onBeforeCompile = (sh) => {
      sh.uniforms.uFlap = this.flapU;
      sh.vertexShader = 'uniform float uFlap;\nattribute float aWing;\nattribute float aPhase;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.y += sin(uFlap * 15.0 + aPhase) * aWing * 0.55;
          transformed.z += (cos(uFlap * 15.0 + aPhase) - 1.0) * aWing * 0.12 * sign(position.z);`,
        );
    };
    this.swifts = new THREE.InstancedMesh(birdGeo, this.birdMat, 60);
    this.swifts.frustumCulled = false;
    scene.add(this.swifts);

    // ---- buzzard: one slow soaring circle high over the valley (glider —
    // its own material without the flap hook) ----
    const bz = new THREE.Group();
    const bGeo = birdGeometry();
    const bzM = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: 0x14100e, side: THREE.DoubleSide }));
    bzM.scale.setScalar(2.6);
    bz.add(bzM);
    this.buzzard = bz;
    scene.add(this.buzzard);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      flock: t >= FLOCK && t <= FLOCK + 5.5 ? 1 : 0,
      gust: t >= GUST && t <= GUST + 2.0 ? 1 : 0,
      settle: t >= SETTLE && t <= 18.0 ? 1 : 0,
      lantern: t >= SETTLE - 2.0 && t <= 18.0 ? 1 : 0,
    };
  }

  // closed-form swift path: a loose diagonal crossing low over the valley,
  // right-to-left in front of the terraces; parked off-frame otherwise
  private swift(i: number, t: number, out: THREE.Vector3): void {
    const u = clamp01((t - FLOCK) / 5.5);
    const ph = hash(i * 7.77);
    const w = ph * Math.PI * 2;
    const cx = 55 - 110 * u;
    const cy = terrH(0, 30) + 9.0 + 2.5 * Math.sin(u * Math.PI * 2 + ph) + ph * 3.0;
    const cz = 34 + 14 * Math.sin(u * Math.PI + ph * 2.0);
    out.set(
      cx + (ph - 0.5) * 7.0 + Math.sin(w + t * 2.3 + u * 12.0) * 2.0,
      cy + Math.sin(w * 2.0 + t * 2.9) * 1.4,
      cz + (hash(i * 3.3) - 0.5) * 5.0 + Math.cos(w + t * 1.7) * 1.5,
    );
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.skyMat.uniforms.uT.value = t;
    this.swayU.value = t;
    this.flapU.value = t;

    const settle = ss(SETTLE, 17.2, t);
    this.skyMat.uniforms.uDusk.value = settle;

    // gust: rolls through the foliage for ~2s
    const gust = ss(GUST, GUST + 0.8, t) * (1 - ss(GUST + 1.6, GUST + 2.2, t));
    this.gustU.value = gust;

    // dusk settle: the gold cools; lantern + window take over the warm read
    this.sun.intensity = 3.4 * (1 - 0.5 * settle);
    this.sun.color.copy(this.sunBase).lerp(this.sunDusk, settle);
    this.hemi.intensity = 0.5 * (1 - 0.35 * settle);
    this.rim.intensity = 0.55 + 0.3 * settle;
    (this.three.fog as THREE.FogExp2).density = 0.0080 + 0.003 * settle;
    (this.three.fog as THREE.FogExp2).color.setHex(0x6b5340).lerp(new THREE.Color(0x3a2c34), settle);
    this.glow.material.opacity = 1 - 0.35 * settle;

    // trees breathe: slow foliage sway amplified by the gust (closed-form)
    for (const tr of this.trees) {
      const ph = tr.userData.phase as number;
      const cyp = tr.userData.cyp as boolean;
      const amp = (cyp ? 0.006 : 0.014) * (1 + 3.5 * gust);
      tr.rotation.z = Math.sin(t * 1.1 + ph) * amp;
      tr.rotation.x = Math.cos(t * 0.8 + ph * 1.7) * amp * 0.6;
    }

    // the figure walks downhill along the path, lantern swaying
    const zFig = 7.5 + 1.05 * t;
    const xFig = pathX(zFig);
    const yFig = terrH(xFig, zFig);
    this.figure.position.set(xFig, yFig - 0.04, zFig);
    // face along the path's descent direction
    const dxdz = -9.0 * 0.115 * Math.cos(-zFig * 0.115 + 0.6);
    this.figure.rotation.y = Math.atan2(dxdz, 1.0) * 0.9;
    this.figure.rotation.z = 0.02 * Math.sin(t * 2.2); // gentle walk sway
    // lantern rides the arm at ~(0.62, 0.55, 0.36) in figure space
    const swing = 0.10 * Math.sin(t * 2.2 + 0.7);
    this.v.set(0.62 + swing * 0.15, 0.55 - Math.abs(swing) * 0.05, 0.36 + swing * 0.1);
    this.figure.localToWorld(this.v);
    this.lanternLight.position.copy(this.v);
    this.lanternGlow.position.copy(this.v);
    const flicker = 0.75 + 0.18 * Math.sin(t * 11.0) + 0.07 * Math.sin(t * 29.0 + 1.3);
    this.lanternLight.intensity = flicker * (0.6 + 2.4 * ss(SETTLE - 3.0, SETTLE + 1.0, t));
    this.lanternGlow.material.opacity = (0.10 + 0.75 * ss(SETTLE - 3.0, SETTLE + 1.0, t)) * flicker;
    this.lanternGlow.scale.setScalar(2.4 + 1.0 * flicker * settle);

    // swifts only during their crossing window
    const n = t > FLOCK - 0.4 && t < FLOCK + 6.0 ? 60 : 0;
    this.swifts.count = n;
    for (let i = 0; i < n; i++) {
      this.swift(i, t, this.v);
      this.dummy.position.copy(this.v);
      this.dummy.rotation.set(0, Math.PI + 0.2 * Math.sin(t * 1.3 + i), Math.sin(t * 2.1 + i) * 0.3);
      const s = 0.6 + hash(i * 9.4) * 0.5;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.swifts.setMatrixAt(i, this.dummy.matrix);
    }
    if (n) this.swifts.instanceMatrix.needsUpdate = true;

    // buzzard: one slow circle high over the valley the whole shot
    {
      const bu = t * 0.16;
      this.buzzard.position.set(
        12 + Math.cos(bu) * 26,
        terrH(0, 40) + 14 + 1.2 * Math.sin(t * 0.3),
        58 + Math.sin(bu) * 18,
      );
      this.buzzard.rotation.y = -bu - Math.PI / 2;
      this.buzzard.rotation.z = 0.22; // banked into the circle
    }

    // drifting haze cards creep sideways very slowly
    this.hazes.forEach((hp, i) => {
      hp.position.x = Math.sin(t * 0.02 + i * 1.7) * 14;
    });

    // CameraRig: slow drift down-slope toward the barn — elevated enough that
    // the sightline clears the last wall into the hazed valley
    const yaw = Math.PI - 0.14 - t * 0.010 + 0.02 * Math.sin(t * 0.06);
    const rad = 26 - 3.5 * ss(0, 10, t) + 1.5 * settle;
    const anchor: [number, number, number] = [-7, terrH(-7, 18) + 3.4, 18];
    const pos = orbitPosition(anchor, rad, 0.115 + 0.02 * Math.sin(t * 0.05), yaw);
    pos[1] = Math.max(pos[1], terrH(pos[0], pos[2]) + 2.4);
    this.rig.position = pos;
    // aim just right of the barn so it holds the left third
    this.rig.target = [
      -4 + 0.4 * Math.sin(t * 0.05),
      terrH(-11, 23.5) + 3.0 + 0.25 * Math.sin(t * 0.06),
      22.5,
    ];
    this.rig.roll = 0.003 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 42 * Math.PI / 180);
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
        c.strokeStyle = 'rgba(10, 8, 10, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f2e8d4';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.06,
      bloom: 0.42,
      bloomThreshold: 0.66,
      bloomRadius: 0.7,
      ca: 0.05,
      grain: 0.05,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.glb?.dispose();
    this.noiseTex?.dispose();
    this.hazeTex?.dispose();
    this.glow?.material.map?.dispose();
    this.glow?.material.dispose();
    this.lanternGlow?.material.map?.dispose();
    this.lanternGlow?.material.dispose();
    this.sun?.shadow.map?.dispose();
    this.swifts?.dispose();
    this.grass?.dispose();
    this.grass2?.dispose();
    this.herbs?.dispose();
    this.poppies?.dispose();
    this.stones?.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

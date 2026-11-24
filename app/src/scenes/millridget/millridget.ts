// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// millridget — a 3D smock windmill on a low ridge at dusk, cinematic pass.
// Blender-built mill (assets/mill/model.glb: stone base, weatherboarded smock
// body, slate cap, lattice sails, fantail), displaced heightfield ridge, tufted
// instanced grass with shader sway, scattered rocks, a flapping starling
// murmuration, key/fill/rim dusk lighting with FogExp2 aerial perspective and
// a true cooling-into-dusk settle. All motion closed-form f(t).
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
const FLOCK = 6.0;    // starlings cross the sky
const GUST = 11.5;    // a gust drives the sails harder for a while
const SETTLE = 15.5;  // dusk cools

// ridge heightfield — shared by terrain + object placement
const ridgeH = (x: number, z: number) =>
  3.0 * Math.exp(-(x * x + z * z) / 320) +
  0.9 * Math.exp(-((x - 26) * (x - 26) + (z + 20) * (z + 20)) / 500) +
  0.35 * Math.sin(x * 0.06 + 1.0) * Math.cos(z * 0.05) +
  0.15 * Math.sin(x * 0.4) * Math.sin(z * 0.35);

const MILL_TOP = ridgeH(0, 0);
const MILL_Y = MILL_TOP - 0.4;

const CAPTIONS: Array<[number, number, string, [number, number, number]]> = [
  [0.8, 3.0, 'the mill still turns on the ridge', [0, MILL_Y + 1.0, 0]],
  [4.6, 6.6, 'grass remembers the day', [4, MILL_Y - 1.5, 4]],
  [8.6, 10.8, 'a murmuration moves through', [0, MILL_Y + 10.0, -6]],
  [11.4, 13.4, 'one gust finds the sails', [0, MILL_Y + 5.0, 0]],
  [15.2, 17.6, 'dusk holds the ridge', [0, MILL_Y + 3.0, 0]],
];

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// dusk sky dome: warm band low toward the sun azimuth (-x), deep blue above.
// uDusk 0→1 cools the whole palette into night.
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
    vec3 lo = mix(vec3(0.22, 0.12, 0.11), vec3(0.08, 0.07, 0.12), uDusk);
    vec3 hi = mix(vec3(0.020, 0.030, 0.085), vec3(0.010, 0.014, 0.045), uDusk);
    vec3 col = mix(lo, hi, smoothstep(0.0, 0.5, h));
    // sun-side warmth: band tightens toward azimuth of the set sun (-x, slightly -z)
    float sunAmt = smoothstep(0.55, 1.0, dot(normalize(d.xz), normalize(vec2(-1.0, -0.35))));
    col += vec3(0.65, 0.24, 0.05) * sunAmt * exp(-h * 4.0) * (1.6 - 0.9 * uDusk);
    // drifting dusk clouds: fbm shapes on a mid-altitude band, warm-lit edges
    // on the sun side, cool grey above
    if (d.y > 0.02) {
      vec2 cp = d.xz / (d.y + 0.22);
      float cn = 0.0, amp = 0.55;
      vec2 pp = cp * 2.3 + vec2(uT * 0.012, uT * 0.004);
      for (int o = 0; o < 4; o++) { cn += amp * vn(pp); pp = pp * 2.07 + 13.1; amp *= 0.5; }
      float band = smoothstep(0.02, 0.10, d.y) * (1.0 - smoothstep(0.55, 0.9, d.y));
      float cov = smoothstep(0.40, 0.60, cn) * band;
      vec3 shade = mix(vec3(0.10, 0.085, 0.13), vec3(0.05, 0.046, 0.08), uDusk);
      vec3 lit = vec3(0.80, 0.38, 0.14) * (1.0 - 0.7 * uDusk);
      vec3 ccol = mix(shade, lit, sunAmt * 0.9 + 0.08);
      col = mix(col, ccol, cov * 0.85);
    }
    // faint stars high up, twinkling, brighter as dusk deepens
    vec2 sp = vec2(atan(d.x, d.z) * 30.0, d.y * 60.0);
    float star = step(0.996, h21(floor(sp))) * smoothstep(0.4, 0.8, d.y)
               * (0.4 + 0.6 * sin(uT * 2.0 + h21(floor(sp) + 7.0) * 40.0));
    col += vec3(0.8, 0.85, 1.0) * star * (0.5 + uDusk);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// seeded value-noise texture for the mill's PBR breakup (map + rough + bump)
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
    const v = Math.floor((0.78 + 0.22 * val(x / 9, y / 9, octaves)) * 255);
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.repeat.set(2, 2);
  return tx;
}

// a grass tuft: 6 tapered blades fanned around the origin, vertex-colored
// root-dark to tip-straw; ~40 tris per tuft
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + 0.4 * Math.sin(b * 7.0);
    const lean = 0.10 + 0.16 * hash(b * 3.3);
    const hgt = 0.42 + 0.22 * hash(b * 5.1);
    const wid = 0.030;
    const dx = Math.cos(a), dz = Math.sin(a);
    // blade = 2 stacked quads bending outward
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
    // the upper segment starts exactly where the lower ended — no seam at the bend
    quad(0, hgt * 0.55, 1.0, 0.7, 0, 0, bx * 0.5, bz * 0.5, 0.62);
    quad(hgt * 0.55, hgt, 0.7, 0.12, bx * 0.5, bz * 0.5, bx, bz, 1.35);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.computeVertexNormals();
  return g;
}

// seed-head stems: thin stalks topped with a grain diamond — they catch the
// raking light as pale straw specks scattered over the field
function seedGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const tri = (a: number[], b: number[], c: number[], shade: number) => {
    pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) col.push(shade, shade, shade);
    for (let k = 0; k < 3; k++) nrm.push(0, 0.8, 0.6);
  };
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2 + 0.5;
    const lean = 0.05 + 0.1 * hash(s * 7.7);
    const h = 0.55 + 0.25 * hash(s * 3.1);
    const dx = Math.cos(a) * lean, dz = Math.sin(a) * lean;
    const w = 0.012;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    tri([px, 0, pz], [-px, 0, -pz], [dx + px * 0.4, h, dz + pz * 0.4], 0.85);
    tri([-px, 0, -pz], [dx - px * 0.4, h, dz - pz * 0.4], [dx + px * 0.4, h, dz + pz * 0.4], 0.85);
    const hw = 0.035;
    tri([dx - hw, h, dz], [dx + hw, h, dz], [dx, h + 0.16, dz], 1.5);
    tri([dx + hw, h, dz], [dx - hw, h, dz], [dx, h - 0.05, dz], 1.2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.computeVertexNormals();
  return g;
}

// wildflowers: a crossed-quad stem with a small blossom cluster on top,
// vertex-colored (warm cream / pale lavender variants)
function flowerGeometry(lavender: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const petal: [number, number, number] = lavender ? [0.66, 0.52, 0.85] : [0.95, 0.86, 0.58];
  const quad = (pts: number[][], c: [number, number, number]) => {
    pos.push(...pts[0], ...pts[1], ...pts[2], ...pts[1], ...pts[3], ...pts[2]);
    for (let k = 0; k < 6; k++) col.push(...c);
    for (let k = 0; k < 6; k++) nrm.push(0, 1, 0);
  };
  const h = 0.30;
  const w = 0.055;
  quad([[-w * 0.15, 0, 0], [w * 0.15, 0, 0], [0, h, 0.02], [0, h, -0.02]], [0.24, 0.34, 0.13]);
  quad([[0, 0, -w * 0.15], [0, 0, w * 0.15], [-0.02, h, 0], [0.02, h, 0]], [0.24, 0.34, 0.13]);
  // blossom: closed 4-fan dome — every rim-to-rim sector gets a petal
  const rim = [[0, h, -w], [w, h, 0], [0, h, w], [-w, h, 0]];
  const apex = [0, h + 0.07, 0];
  for (let p = 0; p < 4; p++) {
    const a = rim[p], b = rim[(p + 1) % 4];
    pos.push(...a, ...b, ...apex);
    for (let k = 0; k < 3; k++) col.push(...petal);
    for (let k = 0; k < 3; k++) nrm.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
  g.computeVertexNormals();
  return g;
}

// swallow-silhouette bird: lathe-ish body diamond + swept wings; aWing weights
// wing verts so the shader can flap them, aPhase varies flap per instance
function birdGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], w: number[]) => {
    pos.push(...a, ...b, ...c);
    wing.push(...w);
  };
  // body: slim diamond flying +x, tail fork -x
  const nose = [0.42, 0, 0], tail = [-0.42, 0, 0];
  const top = [0, 0.09, 0], bot = [0, -0.07, 0];
  const lf = [0, 0, 0.075], rt = [0, 0, -0.075];
  tri(nose, top, lf, [0, 0, 0]); tri(nose, lf, bot, [0, 0, 0]);
  tri(nose, bot, rt, [0, 0, 0]); tri(nose, rt, top, [0, 0, 0]);
  tri(tail, lf, top, [0, 0, 0]); tri(tail, bot, lf, [0, 0, 0]);
  tri(tail, rt, bot, [0, 0, 0]); tri(tail, top, rt, [0, 0, 0]);
  // tail fork
  tri(tail, [-0.55, 0.02, 0.09], [-0.55, 0.02, -0.09], [0.15, 0.15, 0.15]);
  // left wing: root at body, swept back, scythe tip — 3 tris, aWing grows outboard
  const wl = [[0.05, 0.02, 0.05], [-0.18, 0.03, 0.45], [-0.42, 0.04, 0.78], [-0.05, 0.02, 0.32]];
  tri(wl[0], wl[1], wl[3], [0, 0.45, 0.1]);
  tri(wl[1], wl[2], wl[3], [0.45, 1.0, 0.1]);
  tri(wl[0], wl[3], [0.05, 0.0, 0.05], [0, 0.1, 0]);
  // right wing mirrored
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

export default class MillridgetScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private skyMat!: THREE.ShaderMaterial;
  private mill!: GLTFInstance;
  private sails!: THREE.Object3D;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private rim!: THREE.DirectionalLight;
  private windowLight = new THREE.PointLight(0xff9a3c, 0.9, 10, 2);
  private starlings!: THREE.InstancedMesh;
  private birdMat!: THREE.MeshBasicMaterial;
  private grass!: THREE.InstancedMesh;
  private grass2!: THREE.InstancedMesh;
  private seeds!: THREE.InstancedMesh;
  private flowers!: THREE.InstancedMesh;
  private flowers2!: THREE.InstancedMesh;
  private rocks!: THREE.InstancedMesh;
  private sunBase = new THREE.Color();
  private sunDusk = new THREE.Color();
  private spill!: THREE.Mesh;
  private swayU = { value: 0 };
  private flapU = { value: 0 };
  private glow!: THREE.Sprite;
  private noiseTex!: THREE.CanvasTexture;
  private dummy = new THREE.Object3D();

  override async init() {
    const scene = this.three;
    scene.fog = new THREE.FogExp2(0x241a18, 0.0105);

    // ---- lighting: 2600K raking key, cool hemisphere fill, blue rim ----
    const [kr, kg, kb] = blackbodyToLinearSRGB(2600);
    this.sunBase.setRGB(kr, kg, kb);
    const [dr, dg, db] = blackbodyToLinearSRGB(1950);
    this.sunDusk.setRGB(dr, dg, db);
    this.sun = new THREE.DirectionalLight(this.sunBase.clone(), 3.2);
    this.sun.position.set(-30, 9, -12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -26;
    this.sun.shadow.camera.right = 26;
    this.sun.shadow.camera.top = 26;
    this.sun.shadow.camera.bottom = -26;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun);

    const [cr, cg, cb] = blackbodyToLinearSRGB(7500);
    this.hemi = new THREE.HemisphereLight(new THREE.Color(cr, cg, cb), 0x1c1410, 0.45);
    scene.add(this.hemi);

    // cool rim from behind-right — separates the mill from the sky
    this.rim = new THREE.DirectionalLight(0x4a5f8a, 0.7);
    this.rim.position.set(18, 12, 16);
    scene.add(this.rim);

    // ---- sky dome + sun glow sprite ----
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uT: { value: 0 }, uDusk: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), this.skyMat));

    const glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 128;
    const gc = glowCv.getContext('2d')!;
    const grad = gc.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,190,110,0.9)');
    grad.addColorStop(0.35, 'rgba(255,140,60,0.35)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    gc.fillStyle = grad;
    gc.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCv),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.glow.position.set(-115, 17, -48);
    this.glow.scale.setScalar(70);
    scene.add(this.glow);

    // ---- ridge terrain: displaced grid with vertex-color scrub variation ----
    const geo = new THREE.PlaneGeometry(260, 190, 170, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, ridgeH(x, z) - 0.4);
      const n = hash(x * 3.7 + z * 9.1) * 0.5 + hash(x * 13.1 + z * 5.3) * 0.5;
      const g = 0.30 + 0.20 * n + 0.06 * Math.sin(x * 0.8 + 2.0);
      colors[i * 3] = g * 0.62;
      colors[i * 3 + 1] = g * 0.72;
      colors[i * 3 + 2] = g * 0.30;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
    }));
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- grass: two instanced tuft meshes with shader sway ----
    const blade = tuftGeometry();
    const mkGrassMat = (tint: number) => {
      const m = new THREE.MeshStandardMaterial({
        color: tint,
        vertexColors: true,
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uSway = this.swayU;
        sh.vertexShader = 'uniform float uSway;\n' + sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float wp = instanceMatrix[3][0] * 0.31 + instanceMatrix[3][2] * 0.23;
            transformed.x += sin(uSway * 1.7 + wp) * transformed.y * 0.10;
            transformed.z += cos(uSway * 1.3 + wp * 1.7) * transformed.y * 0.05;
          #endif`,
        );
      };
      return m;
    };
    this.grass = new THREE.InstancedMesh(blade, mkGrassMat(0x7a7c34), 2400);
    this.grass2 = new THREE.InstancedMesh(blade, mkGrassMat(0x8a7434), 1600);
    const scatter = (mesh: THREE.InstancedMesh, n: number, r0: number, r1: number, seed: number) => {
      for (let i = 0; i < n; i++) {
        const a = hash(seed + i * 2.17) * Math.PI * 2;
        const r = r0 + Math.sqrt(hash(seed + i * 5.71)) * (r1 - r0);
        const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.78;
        this.dummy.position.set(x, ridgeH(x, z) - 0.45, z);
        this.dummy.rotation.set((hash(seed + i * 7.3) - 0.5) * 0.3, hash(seed + i * 3.9) * Math.PI * 2, 0);
        const s = 0.7 + hash(seed + i * 13.3) * 1.4;
        this.dummy.scale.set(s, s * (0.8 + hash(seed + i * 17.1) * 0.9), s);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
    scatter(this.grass, 2400, 2.4, 44, 11);
    scatter(this.grass2, 1600, 2.0, 34, 733);
    // seed heads catching the light, plus two wildflower colours
    this.seeds = new THREE.InstancedMesh(seedGeometry(), mkGrassMat(0xc9ae62), 750);
    scatter(this.seeds, 750, 3.0, 40, 421);
    this.flowers = new THREE.InstancedMesh(flowerGeometry(false), mkGrassMat(0xffffff), 240);
    scatter(this.flowers, 240, 3.0, 32, 919);
    this.flowers2 = new THREE.InstancedMesh(flowerGeometry(true), mkGrassMat(0xffffff), 150);
    scatter(this.flowers2, 150, 4.0, 30, 1409);

    // ---- scattered rocks ----
    const rockGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x58524a, roughness: 0.95 });
    this.rocks = new THREE.InstancedMesh(rockGeo, rockMat, 90);
    for (let i = 0; i < 90; i++) {
      const a = hash(991 + i * 2.9) * Math.PI * 2;
      const r = 4 + Math.sqrt(hash(991 + i * 7.7)) * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
      this.dummy.position.set(x, ridgeH(x, z) - 0.35, z);
      this.dummy.rotation.set(hash(i * 3.1) * 3, hash(i * 5.9) * 3, hash(i * 9.7) * 3);
      const s = 0.3 + hash(i * 11.3) * 1.6;
      this.dummy.scale.set(s, s * (0.5 + hash(i * 13.7) * 0.5), s);
      this.dummy.updateMatrix();
      this.rocks.setMatrixAt(i, this.dummy.matrix);
    }
    this.rocks.castShadow = true;
    this.rocks.receiveShadow = true;
    scene.add(this.rocks);

    // ---- distant tree line + hedges for horizon layering ----
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x141b10, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.10, 0.16, 1.6, 6);
    trunkGeo.translate(0, 0.8, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
    canopyGeo.scale(1.25, 0.85, 1.25);
    const mkTree = (s: number): THREE.Group => {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(trunkGeo, hedgeMat);
      tr.scale.setScalar(s);
      const c1 = new THREE.Mesh(canopyGeo, hedgeMat);
      c1.position.y = 1.7 * s;
      c1.scale.setScalar(s * 1.1);
      const c2 = new THREE.Mesh(canopyGeo, hedgeMat);
      c2.position.set(0.5 * s, 2.1 * s, 0.2 * s);
      c2.scale.setScalar(s * 0.75);
      g.add(tr, c1, c2);
      return g;
    };
    // far treeline: a broken dark band at the horizon, ~8-11 m trees
    for (let i = 0; i < 26; i++) {
      const x = -120 + i * 9.5 + (hash(i * 3.7) - 0.5) * 6;
      const z = -88 - hash(i * 7.1) * 18;
      const tr = mkTree(1.6 + hash(i * 9.9) * 1.4);
      tr.position.set(x, ridgeH(x, z) - 0.5, z);
      tr.rotation.y = hash(i * 17.3) * Math.PI;
      scene.add(tr);
    }
    // low hedge band closer in, broken
    const hedgeGeo = new THREE.IcosahedronGeometry(1, 1);
    hedgeGeo.scale(1.6, 0.55, 0.8);
    for (let i = 0; i < 30; i++) {
      if (hash(i * 4.1) < 0.2) continue;
      const x = -95 + i * 6.6 + (hash(i * 6.7) - 0.5) * 3;
      const z = -55 - hash(i * 8.9) * 6;
      const hb = new THREE.Mesh(hedgeGeo, hedgeMat);
      hb.position.set(x, ridgeH(x, z) + 0.3, z);
      const s = 1.4 + hash(i * 11.9) * 1.8;
      hb.scale.set(s * (1.2 + hash(i * 13.1)), s * 0.55, s);
      hb.rotation.y = hash(i * 15.7) * Math.PI;
      scene.add(hb);
    }
    // a second sparse line on the east side so the far rim is never bare
    for (let i = 0; i < 12; i++) {
      const x = 60 + i * 9 + (hash(i * 2.3) - 0.5) * 6;
      const z = -60 + i * 4 + (hash(i * 5.9) - 0.5) * 8;
      const tr = mkTree(1.5 + hash(i * 8.3) * 1.3);
      tr.position.set(x, ridgeH(x, z) - 0.5, z);
      tr.rotation.y = hash(i * 12.7) * Math.PI;
      scene.add(tr);
    }
    // two solitary trees on the flanks for midground depth
    for (const [x, z, s] of [[-26, -38, 2.4], [30, -44, 2.8]] as const) {
      const tr = mkTree(s);
      tr.position.set(x, ridgeH(x, z) - 0.4, z);
      tr.rotation.y = hash(x) * Math.PI;
      scene.add(tr);
    }

    // ---- the mill (Blender GLB) + procedural texture breakup ----
    this.mill = await GLTFManager.instantiate(resolveAsset('mill', this.ctx.project ?? 'millridget').url, {
      castShadow: true,
      receiveShadow: true,
    });
    this.mill.root.position.set(0, MILL_Y, 0);
    this.mill.root.rotation.y = 0.45;
    this.noiseTex = noiseTexture(256, 4);
    this.mill.root.traverse((o) => {
      const m = o as THREE.Mesh;
      const mats = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
      if (!mats) return;
      for (const mm of Array.isArray(mats) ? mats : [mats]) {
        if (mm.name === 'WindowGlass') continue;
        mm.map = this.noiseTex;
        mm.roughnessMap = this.noiseTex;
        mm.bumpMap = this.noiseTex;
        mm.bumpScale = 0.7;
      }
    });
    scene.add(this.mill.root);
    const sails = this.mill.part('sails');
    this.sails = sails ?? this.mill.root;
    // window sits at local (0,3.55,-1.78) rotated by the mill's 0.45 yaw —
    // put the light just off the pane so it spills onto the wall and sill
    this.windowLight.position.set(-1.30, MILL_Y + 3.4, -2.72);
    this.windowLight.distance = 13;
    scene.add(this.windowLight);
    // faint warm spill patch on the wall under the window
    const spillCv = document.createElement('canvas');
    spillCv.width = spillCv.height = 64;
    const sc = spillCv.getContext('2d')!;
    const sg = sc.createRadialGradient(32, 32, 2, 32, 32, 32);
    sg.addColorStop(0, 'rgba(255,170,80,0.55)');
    sg.addColorStop(1, 'rgba(255,140,60,0)');
    sc.fillStyle = sg;
    sc.fillRect(0, 0, 64, 64);
    // a plane glued to the wall face under the window (the mill's 0.45 yaw
    // puts the wall normal at ~-2.69 rad) — not a camera-facing sprite
    const spillMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(spillCv),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.spill = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), spillMat);
    this.spill.position.set(-1.02, MILL_Y + 3.4, -1.95);
    this.spill.rotation.y = Math.atan2(-0.435, -0.900);
    scene.add(this.spill);
    // rocky outcrop on the crest behind the mill — silhouette breakup
    for (let i = 0; i < 9; i++) {
      const x = -13 + i * 3.4 + (hash(i * 5.3) - 0.5) * 2;
      const z = -9 - hash(i * 7.7) * 6;
      const rk = new THREE.Mesh(rockGeo, rockMat);
      rk.position.set(x, ridgeH(x, z) - 0.15, z);
      rk.rotation.set(hash(i * 3.1) * 3, hash(i * 5.9) * 3, hash(i * 9.7) * 3);
      const s = 1.2 + hash(i * 11.3) * 1.4;
      rk.scale.set(s * 1.4, s * 0.7, s);
      rk.castShadow = true;
      scene.add(rk);
    }

    // ---- starlings: flapping swallow silhouettes on a murmuration ribbon ----
    const birdGeo = birdGeometry();
    const phases = new Float32Array(170);
    for (let i = 0; i < 170; i++) phases[i] = hash(i * 9.77) * Math.PI * 2;
    birdGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    this.birdMat = new THREE.MeshBasicMaterial({ color: 0x0b0a12, side: THREE.DoubleSide });
    this.birdMat.onBeforeCompile = (sh) => {
      sh.uniforms.uFlap = this.flapU;
      sh.vertexShader = 'uniform float uFlap;\nattribute float aWing;\nattribute float aPhase;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed.y += sin(uFlap * 14.0 + aPhase) * aWing * 0.55;
          transformed.z += (cos(uFlap * 14.0 + aPhase) - 1.0) * aWing * 0.12 * sign(position.z);`,
        );
    };
    this.starlings = new THREE.InstancedMesh(birdGeo, this.birdMat, 170);
    this.starlings.frustumCulled = false;
    scene.add(this.starlings);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      sails: t >= 0 && t <= 18 ? 1 : 0,
      flock: t >= FLOCK && t <= FLOCK + 6.5 ? 1 : 0,
      gust: t >= GUST && t <= GUST + 1.4 ? 1 : 0,
      settle: t >= SETTLE && t <= 18.0 ? 1 : 0,
    };
  }

  // closed-form starling position: the flock sweeps left→right past the mill,
  // a thick murmuration ribbon; before/after the window birds rest off-frame
  private starling(i: number, t: number, out: THREE.Vector3): void {
    const u = clamp01((t - FLOCK) / 7.0);
    const ph = hash(i * 7.77);
    const w = ph * Math.PI * 2;
    const cx = -46 + 95 * u;
    const cy = MILL_Y + 10.5 + 2.2 * Math.sin(u * Math.PI) + 0.6 * Math.sin(t * 0.9 + 1.0);
    const cz = -9 + 6 * Math.sin(u * 2.4);
    const s = i / 170;
    const ribbon = Math.sin(u * Math.PI * 3 + s * 9.0);
    out.set(
      cx + (ph - 0.5) * 6.5 + Math.sin(w + t * 2.1 + u * 14.0) * (1.1 + 1.9 * Math.sin(u * Math.PI)),
      cy + Math.sin(w * 2.0 + t * 2.7) * 1.1 + ribbon * 3.1 * (ph - 0.3),
      cz + (hash(i * 3.3) - 0.5) * 3.4 + Math.cos(w + t * 1.9) * 1.3,
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

    const settle = ss(SETTLE, 17.4, t);
    this.skyMat.uniforms.uDusk.value = settle;

    // sails: one monotonic clock — the gust only ever adds advance, never reverses
    const gust = ss(GUST, GUST + 1.3, t);
    this.sails.rotation.z = t * 0.42 + 1.5 * gust;

    // dusk cooling: key sun drops and slides 2600K -> 1950K, fill dims,
    // window warms up and spills onto the wall
    const sun0 = 3.2;
    this.sun.intensity = sun0 * (1 - 0.55 * settle);
    this.sun.color.copy(this.sunBase).lerp(this.sunDusk, settle);
    this.hemi.intensity = 0.45 * (1 - 0.4 * settle);
    this.rim.intensity = 0.7 + 0.25 * settle;
    this.windowLight.intensity = 1.1 + 0.18 * Math.sin(t * 5.0) + 0.6 * settle;
    (this.spill.material as THREE.MeshBasicMaterial).opacity = (0.18 + 0.04 * Math.sin(t * 5.0 + 1.0)) * (1 + 0.6 * settle);
    (this.three.fog as THREE.FogExp2).density = 0.0105 + 0.004 * settle;
    this.glow.material.opacity = 1 - 0.45 * settle;

    // starlings only during their crossing window
    const n = t > FLOCK - 0.5 && t < FLOCK + 7.4 ? 170 : 0;
    this.starlings.count = n;
    for (let i = 0; i < n; i++) {
      this.starling(i, t, this.v);
      this.dummy.position.copy(this.v);
      // bird geometry flies +x (the flock's heading); a little bank adds life
      this.dummy.rotation.set(0, 0, Math.sin(t * 2.1 + i) * 0.28);
      const s = 0.55 + hash(i * 9.4) * 0.55;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.starlings.setMatrixAt(i, this.dummy.matrix);
    }
    if (n) this.starlings.instanceMatrix.needsUpdate = true;

    // CameraRig: slow orbit drift; mill held on the left third, low eye looking up
    const yaw = -0.55 + t * 0.030 + 0.04 * Math.sin(t * 0.07);
    const rad = 21 - 2.5 * ss(2, 9, t) + 1.0 * settle;
    const pos = orbitPosition([0, MILL_Y + 4.6, 0], rad, 0.10 + 0.02 * Math.sin(t * 0.05), yaw);
    this.rig.position = pos;
    // aim right of the mill so it frames on the left third of the shot
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    this.rig.target = [
      right.x * 4.2,
      MILL_Y + 4.9 + 0.3 * Math.sin(t * 0.06),
      right.z * 4.2,
    ];
    this.rig.roll = 0.003 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
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
        c.strokeStyle = 'rgba(8, 8, 14, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#ece6d8';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.05,
      bloom: 0.45,
      bloomThreshold: 0.68,
      bloomRadius: 0.7,
      ca: 0.05,
      grain: 0.05,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.mill?.dispose();
    this.noiseTex?.dispose();
    this.glow?.material.map?.dispose();
    this.glow?.material.dispose();
    this.sun?.shadow.map?.dispose();
    this.starlings?.dispose();
    this.grass?.dispose();
    this.grass2?.dispose();
    this.seeds?.dispose();
    this.flowers?.dispose();
    this.flowers2?.dispose();
    this.rocks?.dispose();
    this.spill?.geometry?.dispose();
    const spillM = this.spill?.material as THREE.MeshBasicMaterial | undefined;
    spillM?.map?.dispose();
    spillM?.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

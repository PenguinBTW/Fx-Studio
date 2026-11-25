// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame, PostOverrides } from '../../engine/scene';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { W, H } from '../../engine/gl';
import { orbitPosition } from '../../engine/rig';
import type { GLTFInstance } from '../../engine/gltf';

// ---------------------------------------------------------------------------
// forge — a blacksmith's forge at dark. The coal bed breathes an 1800 K ember
// light through the room: worn stump + horn anvil with a hot-edged workpiece,
// tool rack on the back wall, quench tub steaming, leather apron on a post.
// A pale window shaft cuts the dark from the left wall, dust + smoke inside
// it. Ember sparks rise off the coals in flickering points. Macro on the
// anvil → wide reveal of the whole room; every motion closed-form f(t).
// ---------------------------------------------------------------------------

const DUR = 20.0;
const CAPTIONS: [number, number, string, number][] = [
  [1.1, 4.8, 'THE FORGE', 54],
  [7.4, 11.6, 'coals keep a slow orange breath', 30],
  [13.6, 17.8, 'iron remembers the hammer', 30],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

// camera pose: tight on the anvil/workpiece → lift + widen to the whole room
const camPose = (t: number) => {
  const pull = sstep(4.5, DUR - 0.5, t);
  const yaw = 0.45 + t * 0.024 + 0.012 * Math.sin(t * 0.7) + 0.42 * pull;
  const pitch = 0.10 + 0.04 * Math.sin(t * 0.17 + 0.6) + 0.10 * pull;
  const radius = 1.30 + 1.75 * pull;
  const tgt: [number, number, number] = [
    0.45 - 0.10 * pull,
    0.95 + 0.20 * pull,
    -0.55 - 0.05 * pull,
  ];
  return { tgt, radius, pitch, yaw };
};

// ------------------------------------------------------------ CPU textures
function vnoise(seed: number) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const G = 24, grid = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) grid[i] = rnd();
  return (x: number, y: number) => {
    x = ((x % G) + G) % G; y = ((y % G) + G) % G;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const g = (i: number, j: number) => grid[((j % G) * G + (i % G)) | 0]!;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return g(x0, y0) * (1 - sx) * (1 - sy) + g(x0 + 1, y0) * sx * (1 - sy)
         + g(x0, y0 + 1) * (1 - sx) * sy + g(x0 + 1, y0 + 1) * sx * sy;
  };
}
const fbm = (n: (x: number, y: number) => number, x: number, y: number, oct = 4) => {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += a * n(x * f, y * f); a *= 0.5; f *= 2.03; }
  return v;
};
function makeTex(size: number, fn: (u: number, v: number, px: Uint8ClampedArray, i: number) => void, srgb = true) {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) fn(x / size, y / size, px, (y * size + x) * 4);
  const t = new THREE.DataTexture(px as any, size, size, THREE.RGBAFormat);
  t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// flagstone floor: mottled roughness + bump
const stone = () => {
  const n = vnoise(61);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.50 + 0.30 * fbm(n, u * 7, v * 7, 4) + 0.14 * fbm(n, u * 24, v * 24, 2);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// hammer facets: fine dense pitting for forged iron
const pitted = () => {
  const n = vnoise(73);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.55 + 0.22 * fbm(n, u * 46, v * 46, 3) + 0.18 * fbm(n, u * 140, v * 140, 1);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// coarse wood grain for stump/timber
const woodgrain = () => {
  const n = vnoise(51);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.52 + 0.30 * fbm(n, u * 2.5, v * 42) + 0.12 * fbm(n, u * 14, v * 60, 2);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// coal crust: dark lumps with ash speckle
const coalTex = () => {
  const n = vnoise(29);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.35 + 0.30 * fbm(n, u * 34, v * 34, 3) + 0.20 * fbm(n, u * 110, v * 110, 1);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};

// ------------------------------------------------------------ ember sparks
// points rise off the coal bed: hash-seeded column positions, closed-form
// height + horizontal wobble + flicker-falloff alpha — no sim.
const SPARK_VERT = `
attribute float seed;
uniform float uT;
varying float vA;
void main() {
  float s = seed;
  float cyc = fract(s * 13.73 + uT * (0.10 + 0.16 * fract(s * 5.91)));
  vec3 base = vec3(
    -1.7 + (fract(s * 7.31) - 0.5) * 1.30,
    0.95,
    -1.9 + (fract(s * 3.77) - 0.5) * 0.85);
  vec3 p = base;
  p.y += cyc * (0.9 + 0.9 * fract(s * 11.17));           // rise 0.9–1.8 m
  p.x += 0.09 * sin(uT * 2.1 + s * 40.0) * cyc;          // drift
  p.z += 0.06 * sin(uT * 1.7 + s * 23.0) * cyc;
  float flick = 0.55 + 0.45 * sin(uT * (9.0 + 6.0 * fract(s * 4.4)) + s * 90.0);
  vA = (1.0 - cyc) * (1.0 - cyc) * flick;                // fade with height
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (26.0 + 26.0 * fract(s * 8.3)) / max(0.4, -mv.z);
}`;
const SPARK_FRAG = `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = (1.0 - smoothstep(0.08, 0.5, d)) * vA;
  gl_FragColor = vec4(1.0, 0.38, 0.06, a);
}`;

// ------------------------------------------------------------ mist/smoke pts
const MIST_VERT = `
attribute float seed;
uniform float uT;
uniform vec3 uCenter;   // emitter centre
uniform vec3 uSize;     // drift box
varying float vA;
void main() {
  float s = seed;
  vec3 p = uCenter + vec3(
    (fract(s * 7.13) - 0.5) * uSize.x,
    (fract(s * 3.71) - 0.5) * uSize.y,
    (fract(s * 5.19) - 0.5) * uSize.z);
  p.x += 0.10 * sin(uT * 0.31 + s * 30.0);
  p.y += 0.14 * sin(uT * 0.23 + s * 19.0);
  p.z += 0.08 * sin(uT * 0.27 + s * 41.0);
  vA = 0.5 + 0.5 * sin(uT * 0.4 + s * 60.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (140.0 + 120.0 * fract(s * 9.7)) / max(0.4, -mv.z);
}`;
const MIST_FRAG = `
varying float vA;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.05, 0.5, d)) * uAlpha * vA;
  gl_FragColor = vec4(uColor, a);
}`;

// god-ray cone for the window shaft
const RAY_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RAY_FRAG = `
varying vec2 vUv;
uniform float uT;
void main() {
  float edge = sin(vUv.x * 3.14159);
  float fall = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y));
  float a = edge * edge * fall * 0.09 * (0.85 + 0.15 * sin(uT * 0.4 + vUv.x * 5.0));
  gl_FragColor = vec4(0.62, 0.70, 0.85, a);
}`;

// ------------------------------------------------------------ scene
export default defineScene({
  id: 'forge',
  assets: ['forge'],

  setup: async (ctx: SceneContext) => {
    const inst = ctx.asset('forge');
    const r = ctx.renderer;

    const pmrem = new THREE.PMREMGenerator(r);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    ctx.scene3D.environment = envRT.texture;
    ctx.scene3D.background = new THREE.Color(0x030306);
    ctx.scene3D.environmentIntensity = 0.16;
    pmrem.dispose();

    const texStone = stone(), texPit = pitted(), texWood = woodgrain(), texCoal = coalTex();

    const stoneM = new THREE.MeshPhysicalMaterial({
      color: 0x14121a, roughness: 0.9, metalness: 0.0,
      roughnessMap: texStone, bumpMap: texStone, bumpScale: 0.05,
      envMapIntensity: 0.25,
    });
    const stoneD = new THREE.MeshPhysicalMaterial({
      color: 0x0d0b11, roughness: 0.95, metalness: 0.0,
      roughnessMap: texStone, bumpMap: texStone, bumpScale: 0.05,
      envMapIntensity: 0.15,
    });
    const brick = new THREE.MeshPhysicalMaterial({
      color: 0x301410, roughness: 0.85, metalness: 0.0,
      roughnessMap: texStone, bumpMap: texStone, bumpScale: 0.04,
      envMapIntensity: 0.25,
    });
    const wood = new THREE.MeshPhysicalMaterial({
      color: 0x241407, roughness: 0.8, metalness: 0.0,
      roughnessMap: texWood, bumpMap: texWood, bumpScale: 0.025,
      envMapIntensity: 0.25,
    });
    const woodD = new THREE.MeshPhysicalMaterial({
      color: 0x160c05, roughness: 0.88, metalness: 0.0,
      roughnessMap: texWood, envMapIntensity: 0.18,
    });
    const stump = new THREE.MeshPhysicalMaterial({
      color: 0x1c1109, roughness: 0.85, metalness: 0.0,
      roughnessMap: texWood, bumpMap: texWood, bumpScale: 0.04,
      envMapIntensity: 0.25,
    });
    const iron = new THREE.MeshPhysicalMaterial({
      color: 0x191a1d, metalness: 0.85, roughness: 0.45,
      roughnessMap: texPit, bumpMap: texPit, bumpScale: 0.012,
      envMapIntensity: 0.9,
    });
    const ironD = new THREE.MeshPhysicalMaterial({
      color: 0x101013, metalness: 0.8, roughness: 0.55,
      roughnessMap: texPit, bumpMap: texPit, bumpScale: 0.015,
      envMapIntensity: 0.6,
    });
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x2a2e33, metalness: 0.95, roughness: 0.35,
      roughnessMap: texPit, bumpMap: texPit, bumpScale: 0.008,
      envMapIntensity: 1.1,
    });
    const leather = new THREE.MeshPhysicalMaterial({
      color: 0x0d0603, roughness: 0.85, metalness: 0.0,
      roughnessMap: texPit, bumpMap: texPit, bumpScale: 0.02,
      envMapIntensity: 0.10, side: THREE.DoubleSide,
    });
    const coal = new THREE.MeshPhysicalMaterial({
      color: 0x050505, roughness: 0.9, metalness: 0.1,
      roughnessMap: texCoal, bumpMap: texCoal, bumpScale: 0.03,
      envMapIntensity: 0.4,
    });
    const coalGlow = new THREE.MeshPhysicalMaterial({
      color: 0x1a0400, roughness: 0.6, metalness: 0.0,
      emissive: new THREE.Color(1.0, 0.16, 0.01), emissiveIntensity: 5.5,
      envMapIntensity: 0.3,
    });
    const hot = new THREE.MeshPhysicalMaterial({
      color: 0x3a0800, metalness: 0.7, roughness: 0.4,
      emissive: new THREE.Color(1.0, 0.30, 0.02), emissiveIntensity: 4.6,
      envMapIntensity: 0.4,
    });
    const water = new THREE.MeshPhysicalMaterial({
      color: 0x060a10, roughness: 0.06, metalness: 0.0,
      envMapIntensity: 2.5, clearcoat: 0.9,
    });
    const brass = new THREE.MeshPhysicalMaterial({
      color: 0x6a4015, metalness: 0.9, roughness: 0.4,
      envMapIntensity: 1.0,
    });
    const canvasM = new THREE.MeshPhysicalMaterial({
      color: 0x1a150d, roughness: 0.9, metalness: 0.0,
      envMapIntensity: 0.2,
    });
    const mats: Record<string, THREE.Material> = {
      Stone: stoneM, StoneD: stoneD, Brick: brick, Wood: wood, WoodD: woodD,
      Stump: stump, Iron: iron, IronD: ironD, Steel: steel, Leather: leather,
      Coal: coal, CoalGlow: coalGlow, Hot: hot, Water: water, Brass: brass,
      Canvas: canvasM,
    };
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (mats[name]) m.material = mats[name]!;
    });
    inst.ownedMaterials.push(...Object.values(mats));

    // ---- window shaft: pale god-ray cone slanting down-right from the left
    // wall window into the room, dust + smoke drifting inside it.
    const rayMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: RAY_VERT, fragmentShader: RAY_FRAG,
    });
    const shaftDir = new THREE.Vector3(0.86, -0.38, 0.34).normalize(); // window→floor
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(0.55, 5.4, 24, 1, true), rayMat);
    const shaftAnchor = new THREE.Vector3(-3.0, 2.6, 0.9);             // window centre
    shaft.position.copy(shaftAnchor).addScaledVector(shaftDir, 2.7);
    shaft.lookAt(shaftAnchor);
    shaft.rotateX(Math.PI / 2);   // cone apex at the window, wide end into the room
    ctx.scene3D.add(shaft);

    // faint cool glow plane outside the window so the shaft has a source
    const winTex = makeTex(64, (u, v, px, i) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const a = clamp01(1 - d * 2.0);
      px[i] = Math.round(120 + 80 * a); px[i + 1] = Math.round(140 + 80 * a);
      px[i + 2] = Math.round(180 + 60 * a); px[i + 3] = 255;
    });
    const winGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.95),
      new THREE.MeshBasicMaterial({ map: winTex, transparent: true, opacity: 0.75, depthWrite: false }));
    winGlow.position.set(-3.35, 2.6, 0.9);
    winGlow.rotation.y = Math.PI / 2;
    ctx.scene3D.add(winGlow);

    // ---- ember sparks rising off the coal bed
    const NS = 110;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
    const sseed = new Float32Array(NS);
    for (let i = 0; i < NS; i++) sseed[i] = i * 0.61803 + 0.05;
    sg.setAttribute('seed', new THREE.BufferAttribute(sseed, 1));
    const sparkMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
    });
    const sparks = new THREE.Points(sg, sparkMat);
    sparks.frustumCulled = false;
    ctx.scene3D.add(sparks);

    // ---- steam over the quench tub + smoke in the window shaft
    const mkMist = (n: number, center: [number, number, number], size: [number, number, number],
      color: number, alpha: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const sd = new Float32Array(n);
      for (let i = 0; i < n; i++) sd[i] = i * 0.75488 + 0.37;
      g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uCenter: { value: new THREE.Vector3(...center) },
          uSize: { value: new THREE.Vector3(...size) },
          uColor: { value: new THREE.Color(color) },
          uAlpha: { value: alpha },
        },
        vertexShader: MIST_VERT, fragmentShader: MIST_FRAG,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      ctx.scene3D.add(p);
      return m;
    };
    const steamMat = mkMist(45, [1.75, 0.95, -1.3], [0.7, 0.9, 0.7], 0x9aa5b8, 0.085);
    const smokeMat = mkMist(55, [-1.4, 1.9, 0.9], [2.6, 1.6, 0.9], 0x8a95a8, 0.055);

    // ---- lighting: 1800 K ember key + cool window fill + dim ambient
    const ember = new THREE.PointLight(0xffffff, 7.5, 11, 2);
    ember.color.setRGB(...blackbodyToLinearSRGB(1800));
    ember.position.set(-1.7, 1.05, -1.9);
    ctx.scene3D.add(ember);

    // workpiece radiates onto the anvil face
    const hotLight = new THREE.PointLight(0xff6a18, 1.6, 3.2, 2);
    hotLight.position.set(0.62, 1.15, -0.62);
    ctx.scene3D.add(hotLight);

    const win = new THREE.DirectionalLight(0xffffff, 0.7);
    win.color.setRGB(...blackbodyToLinearSRGB(9000));
    win.position.set(-5, 3.2, 1.2);
    win.target.position.set(1.0, 0.4, 0.2);
    ctx.scene3D.add(win, win.target);

    const fill = new THREE.DirectionalLight(0x4a5a80, 0.14);
    fill.position.set(3, 2.5, 3);
    ctx.scene3D.add(fill);
    ctx.scene3D.add(new THREE.AmbientLight(0x0c0a10, 0.5));

    // ember glow sprite on the coals — self-billboarding, deterministic
    const emberTex = makeTex(128, (u, v, px, i) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const a = Math.exp(-d * 8.0);
      px[i] = 255; px[i + 1] = 70; px[i + 2] = 8;
      px[i + 3] = Math.round(clamp01(a) * 200);
    });
    const emberGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: emberTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    emberGlow.scale.set(1.25, 0.75, 1);
    emberGlow.position.set(-1.7, 1.05, -1.9);
    ctx.scene3D.add(emberGlow);
    inst.ownedMaterials.push(emberGlow.material as THREE.Material);

    // ---- camera + captions
    ctx.rig.setLensMm(50);
    ctx.rig.setPath(Array.from({ length: Math.ceil(DUR) + 1 }, (_, i) => {
      const tt = Math.min(DUR, i);
      const p = camPose(tt);
      return { t: tt / DUR, pos: orbitPosition(p.tgt, p.radius, p.pitch, p.yaw), target: p.tgt };
    }));
    ctx.text('cap0', CAPTIONS[0]![2]!, { fontSize: CAPTIONS[0]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 700, color: '#f0dcc0', letterSpacing: 6, align: 'center', alpha: 0 });
    ctx.text('cap1', CAPTIONS[1]![2]!, { fontSize: CAPTIONS[1]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c4a8', letterSpacing: 3, align: 'center', alpha: 0 });
    ctx.text('cap2', CAPTIONS[2]![2]!, { fontSize: CAPTIONS[2]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#c8b898', letterSpacing: 3, align: 'center', alpha: 0 });

    ctxState.inst = inst; ctxState.ember = ember; ctxState.hotLight = hotLight;
    ctxState.coalGlow = coalGlow; ctxState.hot = hot;
    ctxState.rayMat = rayMat; ctxState.sparkMat = sparkMat;
    ctxState.steamMat = steamMat; ctxState.smokeMat = smokeMat;
    ctxState.emberGlow = emberGlow;
    ctxState.envRT = envRT;
    ctxState.textures = [texStone, texPit, texWood, texCoal, winTex, emberTex];
  },

  dispose: () => {
    ctxState.envRT?.dispose();
    for (const t of ctxState.textures ?? []) t.dispose();
    ctxState.envRT = undefined; ctxState.textures = undefined; ctxState.inst = undefined;
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides => {
    const t = f.t;
    ctxState.sparkMat!.uniforms.uT!.value = t;
    ctxState.rayMat!.uniforms.uT!.value = t;
    ctxState.steamMat!.uniforms.uT!.value = t;
    ctxState.smokeMat!.uniforms.uT!.value = t;

    // ember breathing: slow swell + two crackle frequencies
    const breath = 0.82 + 0.12 * Math.sin(t * 0.9) + 0.06 * Math.sin(t * 13.7) + 0.05 * Math.sin(t * 29.1 + 1.7);
    ctxState.ember!.intensity = 7.5 * breath;
    ctxState.emberGlow!.material.opacity = 0.7 + 0.25 * breath;

    // workpiece heat shimmer: pulse + tiny jitter like radiating metal
    const hp = 0.9 + 0.12 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 17.9);
    ctxState.hot!.emissiveIntensity = 6.5 * hp;
    ctxState.hotLight!.intensity = 1.6 * hp;
    ctxState.coalGlow!.emissiveIntensity = 5.5 * (0.85 + 0.15 * Math.sin(t * 7.7) + 0.05 * Math.sin(t * 23.3));

    const { tgt, radius, pitch, yaw } = camPose(t);
    ctx.rig.orbit(tgt, radius, pitch, yaw);
    ctx.updateCamera(f.t, f.p);

    const c2d = ctx.layer2d.ctx;
    c2d.clearRect(0, 0, W, H);
    for (let i = 0; i < CAPTIONS.length; i++) {
      const [t0, t1] = CAPTIONS[i]!;
      const a = sstep(t0, t0 + 0.9, t) * (1 - sstep(t1 - 0.9, t1, t));
      ctx.text(`cap${i}`, CAPTIONS[i]![2]!, { alpha: a });
      ctx.renderText(`cap${i}`, c2d, f.t, W / 2, H * 0.80);
    }

    ctx.flush(out, true);
    return {
      exposure: 1.06,
      bloom: 0.42, bloomThreshold: 0.83, bloomRadius: 0.7,
      halation: 0.09, ca: 0.7, grain: 0.05, vignette: 0.50,
      dof: 0.40, focusDist: 0.17, focalRange: 0.30, dofRadius: 3.0,
    };
  },
});

const ctxState: {
  inst?: GLTFInstance;
  ember?: THREE.PointLight;
  hotLight?: THREE.PointLight;
  coalGlow?: THREE.MeshPhysicalMaterial;
  hot?: THREE.MeshPhysicalMaterial;
  rayMat?: THREE.ShaderMaterial;
  sparkMat?: THREE.ShaderMaterial;
  steamMat?: THREE.ShaderMaterial;
  smokeMat?: THREE.ShaderMaterial;
  emberGlow?: THREE.Sprite;
  envRT?: THREE.WebGLRenderTarget;
  textures?: THREE.Texture[];
} = {};

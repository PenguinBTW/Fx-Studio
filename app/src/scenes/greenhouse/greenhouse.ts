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
// greenhouse — inside a Victorian glasshouse at dusk. Iron arch ribs + glass
// panes catch the low sun streaming through the far wall; benches hold potted
// ferns, hanging baskets sway overhead, a watering can and tools wait on the
// staging; one warm lamp fights the blue. God-ray shafts, drifting mist,
// clustered leaf sway — macro → wide, every motion closed-form f(t).
// ---------------------------------------------------------------------------

const DUR = 20.0;
const CAPTIONS: [number, number, string, number][] = [
  [1.1, 4.6, 'THE GLASSHOUSE', 54],
  [7.4, 11.6, 'condensation on a hundred panes', 30],
  [13.6, 17.8, 'one warm lamp against the dusk', 30],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

// camera pose: macro on the floor pot → pull wide to take in the whole house
const camPose = (t: number) => {
  const pull = sstep(4.0, DUR - 0.5, t);
  const yaw = 2.85 + t * 0.028 + 0.010 * Math.sin(t * 0.8) + 0.25 * pull;
  const pitch = 0.14 + 0.05 * Math.sin(t * 0.19 + 0.4) + 0.06 * pull;
  const radius = 1.60 + 1.30 * pull;
  const tgt: [number, number, number] = [
    0.10 - 0.20 * pull,
    0.80 + 0.30 * pull,
    1.05 - 0.45 * pull,
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
// damp flagstone floor: roughness blotches + bump mottle
const flagstone = () => {
  const n = vnoise(61);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.55 + 0.30 * fbm(n, u * 7, v * 7, 4) + 0.10 * fbm(n, u * 22, v * 22, 2);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// terracotta speckle for roughness/bump
const clay = () => {
  const n = vnoise(41);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.5 + 0.34 * fbm(n, u * 30, v * 30, 3) + 0.16 * fbm(n, u * 90, v * 90, 2);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// condensation: scattered droplets brighten + roughen the glass
const condense = () => {
  const n = vnoise(17);
  return makeTex(256, (u, v, px, i) => {
    // cellular-ish droplets: thresholded high-freq noise + streak trails
    const drop = Math.pow(fbm(n, u * 60, v * 60, 3), 6) * 2.2;
    const trail = Math.max(0, 0.5 - Math.abs(n(u * 40, v * 3) - 0.5)) * (0.35 + 0.65 * v);
    const g = clamp01(0.30 + drop + trail * 0.8);
    const b = Math.round(g * 255);
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};
// wood grain for the staging planks
const woodgrain = () => {
  const n = vnoise(51);
  return makeTex(256, (u, v, px, i) => {
    const g = 0.50 + 0.30 * fbm(n, u * 2.0, v * 40) + 0.14 * fbm(n, u * 12, v * 70, 2);
    const b = Math.max(0, Math.min(255, Math.round(g * 255)));
    px[i] = px[i + 1] = px[i + 2] = b; px[i + 3] = 255;
  }, false);
};

// ------------------------------------------------------------ dust motes
const DUST_VERT = `
attribute float seed;
uniform float uT;
varying float vA;
void main() {
  float s = seed;
  // cluster inside the sun shafts (slanted slabs through the far panes)
  vec3 beam = vec3(mix(-1.2, 1.2, fract(s * 7.31)),
                   mix(0.5, 2.9, fract(s * 13.7)),
                   mix(-1.6, 2.2, fract(s * 3.97)));
  vec3 amb  = vec3(mix(-1.4, 1.4, fract(s * 7.31)),
                   mix(0.3, 2.8, fract(s * 13.7)),
                   mix(-2.2, 2.2, fract(s * 3.97)));
  vec3 p = mix(beam, amb, step(0.58, fract(s * 1.73)));
  p += 0.25 * vec3(sin(uT * 0.31 + s * 9.0), 0.55 * sin(uT * 0.23 + s * 17.0), cos(uT * 0.27 + s * 11.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.55 + 0.45 * sin(uT * (1.1 + fract(s * 5.0)) + s * 40.0);
  vA = tw * (1.0 - smoothstep(3.5, 9.0, -mv.z)) * smoothstep(0.4, 1.4, -mv.z);
  gl_PointSize = (1.4 + 2.6 * fract(s * 29.0)) * (55.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = (1.0 - smoothstep(0.05, 0.5, length(c))) * vA * 0.30;
  gl_FragColor = vec4(1.0, 0.78, 0.50, a);
}`;

// ------------------------------------------------------------ drifting mist
const MIST_VERT = `
attribute float seed;
uniform float uT;
varying float vA;
void main() {
  float s = seed;
  float age = fract(uT * 0.030 + s * 0.61803);    // slow closed-form drift cycle
  vec3 base = vec3(mix(-1.3, 1.3, fract(s * 3.1)), 0.15 + 0.55 * fract(s * 5.9),
                   mix(-2.0, 1.8, fract(s * 7.7)));
  vec3 p = base + vec3(sin(age * 7.0 + s * 20.0) * 0.45 + age * 0.4 - 0.2,
                       sin(age * 5.0 + s * 11.0) * 0.10 + age * 0.15,
                       cos(age * 6.0 + s * 14.0) * 0.35);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = smoothstep(0.0, 0.20, age) * (1.0 - smoothstep(0.55, 1.0, age));
  gl_PointSize = (4.0 + 6.0 * fract(s * 13.0) + 9.0 * age) * (55.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const MIST_FRAG = `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = (1.0 - smoothstep(0.06, 0.5, length(c))) * vA * 0.020;
  gl_FragColor = vec4(0.62, 0.66, 0.72, a);
}`;

// dusk backdrop + low sun disc behind the far panes
const SKY_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `
varying vec2 vUv;
uniform float uT;
void main() {
  // dusk sky over a dark field: thin molten band on the horizon under
  // deep indigo; a jagged treeline silhouette breaks the horizon line.
  float h = vUv.y;
  vec3 top = vec3(0.020, 0.028, 0.075);
  vec3 mid = vec3(0.10, 0.06, 0.12);
  vec3 low = vec3(0.75, 0.30, 0.085);
  vec3 col = mix(low, mid, smoothstep(0.38, 0.52, h));
  col = mix(col, top, smoothstep(0.52, 0.85, h));
  // treeline ridge — thin broken silhouette hugging the horizon
  float ridge = 0.395 + 0.012 * sin(vUv.x * 24.0)
              + 0.008 * sin(vUv.x * 57.0 + 1.7) + 0.010 * sin(vUv.x * 8.0 + 0.4);
  float trees = 1.0 - smoothstep(ridge - 0.003, ridge + 0.003, h);
  // a few taller crowns — gate outside smoothstep so its edges never coincide
  float crown = step(0.88, sin(vUv.x * 40.0))
              * (1.0 - smoothstep(ridge + 0.008, ridge + 0.011, h));
  col = mix(col, vec3(0.028, 0.032, 0.042), trees);
  col = mix(col, vec3(0.020, 0.024, 0.033), crown);
  // ground haze just above the field
  col += vec3(0.10, 0.05, 0.02) * (1.0 - smoothstep(0.36, 0.42, h)) * 0.5;
  // faint star pricks overhead
  float st = step(0.9975, fract(sin(dot(floor(vUv * 220.0), vec2(127.1, 311.7))) * 43758.5));
  col += st * smoothstep(0.60, 0.95, h) * (0.30 + 0.2 * sin(uT * 0.8 + vUv.x * 40.0));
  gl_FragColor = vec4(col, 1.0);
}`;
const SUN_FRAG = `
varying vec2 vUv;
uniform float uT;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c);
  float core = 1.0 - smoothstep(0.13, 0.19, d);
  float glow = exp(-d * 11.0);
  float a = core * 1.0 + glow * 0.5;
  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.78, 0.40), core);
  gl_FragColor = vec4(col * a, a * 0.95);
}`;

// god-ray slab through the panes
const RAY_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RAY_FRAG = `
varying vec2 vUv;
uniform float uT;
void main() {
  float edge = sin(vUv.x * 3.14159);
  float fall = smoothstep(0.0, 0.55, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
  float flick = 0.85 + 0.15 * sin(uT * 0.5 + vUv.x * 6.0);
  float a = edge * edge * fall * 0.035 * flick;
  gl_FragColor = vec4(1.0, 0.60, 0.25, a);
}`;

// ------------------------------------------------------------ scene
export default defineScene({
  id: 'greenhouse',
  assets: ['greenhouse'],

  setup: async (ctx: SceneContext) => {
    const inst = ctx.asset('greenhouse');
    const r = ctx.renderer;
    r.shadowMap.enabled = true;

    const pmrem = new THREE.PMREMGenerator(r);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    ctx.scene3D.environment = envRT.texture;
    ctx.scene3D.background = new THREE.Color(0x05060d);
    ctx.scene3D.environmentIntensity = 0.30;
    pmrem.dispose();

    const texFloor = flagstone(), texClay = clay(), texCond = condense(), texWood = woodgrain();

    const iron = new THREE.MeshPhysicalMaterial({
      color: 0x14171a, metalness: 0.88, roughness: 0.42,
      roughnessMap: texWood, envMapIntensity: 0.85,
    });
    const ironEdge = new THREE.MeshPhysicalMaterial({
      color: 0x232629, metalness: 0.9, roughness: 0.34,
      envMapIntensity: 1.1,
    });
    // near-clear glass: faint tint, condensation bumps only at grazing
    // angles — the pane grid + fresnel glints carry the read, not milk
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xb8d4cc, metalness: 0.0, roughness: 0.04,
      bumpMap: texCond, bumpScale: 0.003,
      transparent: true, opacity: 0.03, side: THREE.DoubleSide,
      envMapIntensity: 2.0, clearcoat: 0.9, clearcoatRoughness: 0.06,
      depthWrite: false,
    });
    const wood = new THREE.MeshPhysicalMaterial({
      color: 0x3d2413, roughness: 0.72, metalness: 0.0,
      roughnessMap: texWood, bumpMap: texWood, bumpScale: 0.02,
      envMapIntensity: 0.35,
    });
    const woodD = new THREE.MeshPhysicalMaterial({
      color: 0x241509, roughness: 0.8, metalness: 0.0,
      envMapIntensity: 0.25,
    });
    const terra = new THREE.MeshPhysicalMaterial({
      color: 0x8a3a1d, roughness: 0.78, metalness: 0.0,
      roughnessMap: texClay, bumpMap: texClay, bumpScale: 0.018,
      envMapIntensity: 0.3,
    });
    const soil = new THREE.MeshPhysicalMaterial({
      color: 0x100a06, roughness: 0.98, metalness: 0.0,
      bumpMap: texFloor, bumpScale: 0.03,
    });
    const leafA = new THREE.MeshPhysicalMaterial({
      color: 0x2e6b1f, roughness: 0.62, metalness: 0.0,
      clearcoat: 0.30, clearcoatRoughness: 0.4,
      emissive: new THREE.Color(0x051505), emissiveIntensity: 0.35,
      envMapIntensity: 0.5, side: THREE.DoubleSide,
    });
    const leafB = new THREE.MeshPhysicalMaterial({
      color: 0x3d7f28, roughness: 0.55, metalness: 0.0,
      clearcoat: 0.35, clearcoatRoughness: 0.35,
      emissive: new THREE.Color(0x061706), emissiveIntensity: 0.35,
      envMapIntensity: 0.55, side: THREE.DoubleSide,
    });
    const leafC = new THREE.MeshPhysicalMaterial({
      color: 0x4a8a30, roughness: 0.58, metalness: 0.0,
      clearcoat: 0.32, clearcoatRoughness: 0.38,
      emissive: new THREE.Color(0x071807), emissiveIntensity: 0.35,
      envMapIntensity: 0.5, side: THREE.DoubleSide,
    });
    const brass = new THREE.MeshPhysicalMaterial({
      color: 0x7a481a, metalness: 0.9, roughness: 0.38,
      envMapIntensity: 1.0,
    });
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x5d646e, metalness: 0.95, roughness: 0.42,
      envMapIntensity: 0.8,
    });
    const lampGlow = new THREE.MeshPhysicalMaterial({
      color: 0xffc060, roughness: 0.4, metalness: 0.0,
      emissive: new THREE.Color(1.0, 0.55, 0.16), emissiveIntensity: 5.0,
    });
    const wicker = new THREE.MeshPhysicalMaterial({
      color: 0x3a2812, roughness: 0.85, metalness: 0.0,
      envMapIntensity: 0.25,
    });
    const floorM = new THREE.MeshPhysicalMaterial({
      color: 0x0e0b08, roughness: 0.85, metalness: 0.0,
      roughnessMap: texFloor, bumpMap: texFloor, bumpScale: 0.03,
      envMapIntensity: 0.3,
    });
    const mats: Record<string, THREE.Material> = {
      Iron: iron, IronEdge: ironEdge, Glass: glass, Wood: wood, WoodDark: woodD,
      Terra: terra, Soil: soil, LeafA: leafA, LeafB: leafB, LeafC: leafC,
      Brass: brass, Steel: steel, LampGlow: lampGlow, Wicker: wicker,
      Floor: floorM,
    };
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (mats[name]) m.material = mats[name]!;
      if (name !== 'Glass') { m.castShadow = m.receiveShadow = true; }
    });

    // ---- dusk sky backdrop + low sun disc, far behind the back panes
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), skyMat);
    sky.position.set(0, 2.6, 10.0);
    sky.rotation.y = Math.PI;
    ctx.scene3D.add(sky);

    // exterior ground — dark dusk field under the horizon so the house
    // doesn't float over a void
    const outside = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 30),
      new THREE.MeshBasicMaterial({ color: 0x05070c }));   // unlit: stays a dark dusk field
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(0, -0.02, 12);
    ctx.scene3D.add(outside);

    const sunMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: SKY_VERT, fragmentShader: SUN_FRAG,
    });
    const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), sunMat);
    sunDisc.position.set(1.6, 1.02, 9.4);
    sunDisc.rotation.y = Math.PI;
    ctx.scene3D.add(sunDisc);

    // ---- lighting: low dusk sun through the panes + lamp + fills
    const sun = new THREE.DirectionalLight(0xffffff, 6.0);
    sun.color.setRGB(...blackbodyToLinearSRGB(2500));
    sun.position.set(4.5, 3.4, 10.0);
    sun.target.position.set(-0.5, -0.1, -2.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -2;
    sun.shadow.camera.far = 20;
    sun.shadow.bias = -0.00015;
    ctx.scene3D.add(sun, sun.target);

    const lamp = new THREE.PointLight(0xffab52, 5.5, 10, 2);
    lamp.position.set(0.55, 1.94, 1.4);     // Blender (x, y, z) → (x, z, -y)
    ctx.scene3D.add(lamp);

    // lamp glow sprite — the lit bulb's halo; THREE.Sprite self-billboards
    // so identical timestamps always draw the same halo (no camera-state read)
    const glowTex = makeTex(128, (u, v, px, i) => {
      const d = Math.hypot(u - 0.5, v - 0.5);
      const a = Math.exp(-d * 14.0) * 0.85 + (1 - sstep(0.02, 0.09, d)) * 0.9;
      px[i] = 255; px[i + 1] = 158; px[i + 2] = 56;
      px[i + 3] = Math.round(clamp01(a) * 255);
    });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(0.55, 0.55, 1);
    glow.position.set(0.55, 1.94, 1.4);
    ctx.scene3D.add(glow);
    ctxState.glow = glow;

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.color.setRGB(...blackbodyToLinearSRGB(8200));
    rim.position.set(-3.5, 3.0, -4.0);
    ctx.scene3D.add(rim);

    const fill = new THREE.DirectionalLight(0x8fb4ff, 0.18);
    fill.position.set(0, 4.0, -5.0);
    ctx.scene3D.add(fill);
    ctx.scene3D.add(new THREE.AmbientLight(0x161a24, 0.55));

    // ---- god-ray slabs slanting from the far panes into the room
    const rayMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: RAY_VERT, fragmentShader: RAY_FRAG,
    });
    const rays: THREE.Mesh[] = [];
    // shaft cones slanting along the real sun direction through the panes
    const sunDir = new THREE.Vector3(-0.8 - 4.5, 0.0 - 3.4, -1.5 - 10.0).normalize();
    const RAY_DEFS: [number, number, number][] = [
      [-0.55, 1.9, 0.42],
      [0.45, 2.2, 0.55],
      [1.15, 1.6, 0.34],
    ];
    for (const [rx, ry, rw] of RAY_DEFS) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(rw, 6.2, 24, 1, true), rayMat);
      // centre the shaft INSIDE the room along the sun direction; apex still
      // points back at the pane so the cone widens into the interior
      mesh.position.set(rx + sunDir.x * 2.6, ry + sunDir.y * 2.6, 2.4 + sunDir.z * 2.6);
      mesh.lookAt(rx, ry, 2.4);
      mesh.rotateX(Math.PI / 2);   // cone apex toward the pane, wide end into the room
      rays.push(mesh);
      ctx.scene3D.add(mesh);
    }

    // ---- dust motes clustered in the shafts
    const N = 170;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = i * 0.61803 + 0.1;
    dg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
    });
    const dust = new THREE.Points(dg, dustMat);
    dust.frustumCulled = false;
    ctx.scene3D.add(dust);

    // ---- low drifting mist across the floor
    const NM = 60;
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
    const mseeds = new Float32Array(NM);
    for (let i = 0; i < NM; i++) mseeds[i] = i * 0.75488 + 0.37;
    mg.setAttribute('seed', new THREE.BufferAttribute(mseeds, 1));
    const mistMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: MIST_VERT, fragmentShader: MIST_FRAG,
    });
    const mist = new THREE.Points(mg, mistMat);
    mist.frustumCulled = false;
    ctx.scene3D.add(mist);

    // ---- camera + captions
    ctx.rig.setLensMm(50);
    // register the orbit as a spline path so God-View/blueprint sampling sees
    // the real camera move, not a static default pose
    ctx.rig.setPath(Array.from({ length: Math.ceil(DUR) + 1 }, (_, i) => {
      const tt = Math.min(DUR, i);
      const p = camPose(tt);
      return { t: tt / DUR, pos: orbitPosition(p.tgt, p.radius, p.pitch, p.yaw), target: p.tgt };
    }));
    ctx.text('cap0', CAPTIONS[0]![2]!, { fontSize: CAPTIONS[0]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 700, color: '#f0e8d0', letterSpacing: 6, align: 'center', alpha: 0 });
    ctx.text('cap1', CAPTIONS[1]![2]!, { fontSize: CAPTIONS[1]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#cfd8c8', letterSpacing: 3, align: 'center', alpha: 0 });
    ctx.text('cap2', CAPTIONS[2]![2]!, { fontSize: CAPTIONS[2]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c8a8', letterSpacing: 3, align: 'center', alpha: 0 });

    ctxState.inst = inst; ctxState.lamp = lamp; ctxState.lampMat = lampGlow;
    ctxState.rayMat = rayMat; ctxState.dustMat = dustMat; ctxState.mistMat = mistMat;
    inst.ownedMaterials.push(...Object.values(mats), glow.material as THREE.Material);
    ctxState.skyMat = skyMat; ctxState.sunMat = sunMat;
    ctxState.envRT = envRT; ctxState.sunLight = sun;
    ctxState.textures = [texFloor, texClay, texCond, texWood, glowTex];
  },

  dispose: () => {
    ctxState.envRT?.dispose();
    ctxState.sunLight?.shadow.map?.dispose();
    for (const t of ctxState.textures ?? []) t.dispose();
    ctxState.envRT = undefined; ctxState.sunLight = undefined;
    ctxState.textures = undefined; ctxState.inst = undefined;
  },

  render: (ctx: SceneContext, f: Frame, out): PostOverrides => {
    const t = f.lt;
    const inst = ctxState.inst!;

    // ---- leaf/basket sway: subtle closed-form oscillation per part
    const sway = (name: string, amp: number, w: number, ph: number) => {
      const p = inst.part(name);
      if (p) p.rotation.z = amp * Math.sin(t * w + ph) + amp * 0.4 * Math.sin(t * w * 2.3 + ph * 1.7);
    };
    const FERNS = ['fern_0', 'fern_1', 'fern_2', 'fern_3', 'fern_4', 'fern_5', 'fern_8', 'fern_9', 'fern_6', 'fern_7'];
    for (let i = 0; i < FERNS.length; i++) {
      const hanging = i >= 8;
      sway(FERNS[i]!, hanging ? 0.035 : 0.018, 0.55 + 0.11 * i, i * 1.7);
    }
    // hanging baskets also pendulum on x
    for (const [i, n] of ['fern_6', 'fern_7'].entries()) {
      const p = inst.part(n);
      if (p) p.rotation.x = 0.02 * Math.sin(t * 0.45 + i * 2.6);
    }

    // lamp flicker (warm, gentle)
    const fl = 0.92 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 23.7 + 1.3);
    ctxState.lamp!.intensity = 5.5 * fl;
    ctxState.lampMat!.emissiveIntensity = 5.0 * fl;

    ctxState.rayMat!.uniforms.uT!.value = t;
    ctxState.dustMat!.uniforms.uT!.value = t;
    ctxState.mistMat!.uniforms.uT!.value = t;
    ctxState.skyMat!.uniforms.uT!.value = t;
    ctxState.sunMat!.uniforms.uT!.value = t;

    // ---- camera: low slow drift inside the house — macro on the floor pot,
    // pulling wide to take in the ribs + back panes, slight lateral glide.
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
      exposure: 0.98,
      bloom: 0.30, bloomThreshold: 0.88, bloomRadius: 0.7,
      halation: 0.06, ca: 0.7, grain: 0.04, vignette: 0.42,
      dof: 0.40, focusDist: 0.16, focalRange: 0.30, dofRadius: 3.0,
    };
  },
});

const ctxState: {
  inst?: GLTFInstance;
  lamp?: THREE.PointLight;
  lampMat?: THREE.MeshPhysicalMaterial;
  rayMat?: THREE.ShaderMaterial;
  dustMat?: THREE.ShaderMaterial;
  mistMat?: THREE.ShaderMaterial;
  skyMat?: THREE.ShaderMaterial;
  sunMat?: THREE.ShaderMaterial;
  envRT?: THREE.WebGLRenderTarget;
  sunLight?: THREE.DirectionalLight;
  glow?: THREE.Sprite;
  textures?: THREE.Texture[];
} = {};

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame, PostOverrides } from '../../engine/scene';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { W, H } from '../../engine/gl';
import type { GLTFInstance } from '../../engine/gltf';

// ---------------------------------------------------------------------------
// orrery — a mechanical orrery on a dark desk. Concentric brass rings carry
// stone planets around a warm ember "sun"; an exposed gear train counters on the
// column; one dramatic key light, deep shadows, HDR sheen. Macro product-shot:
// slow low orbit, thin-lens-feeling grade, dust motes in the beam. Every moving
// part is a named GLB node driven by closed-form f(t) rotation — no sim.
// ---------------------------------------------------------------------------

const DUR = 20.0;
const SUN_Y = 1.86;
const ARM_R = [0.88, 1.46, 2.06];
const PLANET_Y = [1.42, 1.58, 1.75];           // planet centres (world y)
const OMEGA = [0.34, 0.21, 0.125];             // arm/ring angular rates (rad/s)
const PHI = [0.35, 2.40, 4.60];                // per-arm phase so planets spread
const GEAR_W = [-0.62, 0.85, -0.55];           // gear train, alternating mesh
const CAPTIONS: [number, number, string, number][] = [
  // [t0, t1, text, fontSize]
  [1.1, 4.6, 'THE ORRERY', 54],
  [7.2, 11.4, 'brass, stone, and a borrowed sun', 30],
  [13.4, 17.6, 'every gear keeps its own time', 30],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

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
// brushed brass: fine circumferential streaks in the roughness channel
const brushed = () => makeTex(256, (u, v, px, i) => {
  const n = vnoise(7);
  const r = 0.42 + 0.26 * fbm(n, u * 48, v * 5) + 0.10 * fbm(n, u * 9, v * 90, 2);
  const g = Math.max(0, Math.min(255, Math.round(r * 255)));
  px[i] = px[i + 1] = px[i + 2] = g; px[i + 3] = 255;
}, false);
// marble: base colour veined by ridged fbm
const marble = (base: [number, number, number], vein: [number, number, number], seed: number) =>
  makeTex(256, (u, v, px, i) => {
    const n = vnoise(seed);
    const t = Math.abs(Math.sin((u * 3.0 + fbm(n, u * 5, v * 5) * 3.2) * Math.PI));
    const w = Math.pow(1 - t, 4) * 0.85 + 0.15 * fbm(n, u * 9, v * 9);
    const m = clamp01(w);
    px[i] = Math.round((base[0] * (1 - m) + vein[0] * m) * 255);
    px[i + 1] = Math.round((base[1] * (1 - m) + vein[1] * m) * 255);
    px[i + 2] = Math.round((base[2] * (1 - m) + vein[2] * m) * 255);
    px[i + 3] = 255;
  });
// ember: dark crust over molten turbulence
const ember = () => makeTex(256, (u, v, px, i) => {
  const n = vnoise(31);
  const e = fbm(n, u * 6, v * 6, 5);
  const hot = Math.pow(clamp01(e * 1.35 - 0.12), 1.6);
  const crack = 0.3 + 0.7 * sstep(0.30, 0.46, e);
  px[i] = Math.round(255 * hot * crack);
  px[i + 1] = Math.round(140 * hot * hot * crack);
  px[i + 2] = Math.round(30 * hot * hot * hot);
  px[i + 3] = 255;
}, false);

// ------------------------------------------------------------ dust motes
const DUST_VERT = `
attribute float seed;
uniform float uT;
varying float vA;
void main() {
  float s = seed;
  // distribute through a beam volume above the orrery
  vec3 p = vec3(mix(-2.6, 2.6, fract(s * 7.31)),
                mix(0.4, 3.4, fract(s * 13.7)),
                mix(-2.6, 2.6, fract(s * 3.97)));
  p += 0.30 * vec3(sin(uT * 0.31 + s * 9.0), 0.6 * sin(uT * 0.23 + s * 17.0), cos(uT * 0.27 + s * 11.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.55 + 0.45 * sin(uT * (1.1 + fract(s * 5.0)) + s * 40.0);
  vA = tw * smoothstep(9.0, 3.0, -mv.z) * smoothstep(0.5, 1.6, -mv.z);
  gl_PointSize = (1.5 + 2.5 * fract(s * 29.0)) * (55.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DUST_FRAG = `
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.05, length(c)) * vA * 0.32;
  gl_FragColor = vec4(1.0, 0.72, 0.42, a);
}`;

// ------------------------------------------------------------ scene
export default defineScene({
  id: 'orrery',
  assets: ['orrery'],

  setup: async (ctx: SceneContext) => {
    const inst = ctx.asset('orrery');
    const r = ctx.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    // HDR environment for PBR sheen (studio-soft; scene lighting stays dramatic)
    const pmrem = new THREE.PMREMGenerator(r);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    ctx.scene3D.environment = env;
    ctx.scene3D.background = new THREE.Color(0x040308);
    ctx.scene3D.environmentIntensity = 0.35;
    pmrem.dispose();

    // ---- procedural material upgrade: brushed brass, veined marble, ember
    const texBrush = brushed();
    const brass = new THREE.MeshPhysicalMaterial({
      color: 0xb06f24, metalness: 0.92, roughness: 0.32,
      roughnessMap: texBrush, clearcoat: 0.28, clearcoatRoughness: 0.35,
      envMapIntensity: 1.35,
    });
    const brassDark = new THREE.MeshPhysicalMaterial({
      color: 0x6b3d12, metalness: 0.90, roughness: 0.42,
      roughnessMap: texBrush, clearcoat: 0.18, clearcoatRoughness: 0.45,
      envMapIntensity: 1.1,
    });
    const steel = new THREE.MeshPhysicalMaterial({
      color: 0x8f98a2, metalness: 0.96, roughness: 0.30,
      roughnessMap: texBrush, envMapIntensity: 1.3,
    });
    const emberMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a0a04, roughness: 0.5, metalness: 0.0,
      emissive: new THREE.Color(1.0, 0.30, 0.05),
      emissiveIntensity: 1.7, emissiveMap: ember(),
    });
    const marbleA = new THREE.MeshPhysicalMaterial({
      map: marble([0.80, 0.78, 0.74], [0.42, 0.40, 0.38], 11),
      roughness: 0.30, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.22,
      envMapIntensity: 1.0,
    });
    const marbleB = new THREE.MeshPhysicalMaterial({
      map: marble([0.55, 0.17, 0.08], [0.85, 0.55, 0.22], 23),
      roughness: 0.28, metalness: 0.05, clearcoat: 0.55, clearcoatRoughness: 0.22,
      envMapIntensity: 1.0,
    });
    const marbleC = new THREE.MeshPhysicalMaterial({
      map: marble([0.10, 0.32, 0.32], [0.55, 0.65, 0.45], 37),
      roughness: 0.26, metalness: 0.08, clearcoat: 0.6, clearcoatRoughness: 0.20,
      envMapIntensity: 1.0,
    });
    const mats: Record<string, THREE.Material> = {
      Brass: brass, BrassDark: brassDark, Steel: steel, Ember: emberMat,
      Moonstone: marbleA, RustVein: marbleB, SeaMarble: marbleC,
    };
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (mats[name]) m.material = mats[name]!;
      m.castShadow = m.receiveShadow = true;
    });

    // ---- desk: dark lacquered slab, catches the ember pool
    const desk = new THREE.Mesh(
      new THREE.CylinderGeometry(5.0, 5.0, 0.14, 72),
      new THREE.MeshPhysicalMaterial({
        color: 0x060402, roughness: 0.72, metalness: 0.0,
        clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.12,
      }));
    desk.position.y = -0.07;
    desk.receiveShadow = true;
    ctx.scene3D.add(desk);

    // ---- lighting: ember glow + hard warm key + cold rim + faint fill
    const emberLight = new THREE.PointLight(0xff6a22, 7, 9, 2);
    emberLight.position.set(0, SUN_Y, 0);
    ctx.scene3D.add(emberLight);

    const key = new THREE.SpotLight(0xffffff, 90, 0, 0.40, 0.65, 2);
    key.color.setRGB(...blackbodyToLinearSRGB(3100));
    key.position.set(3.6, 4.8, 2.4);
    key.target.position.set(0, 1.0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.00015;
    ctx.scene3D.add(key, key.target);

    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.color.setRGB(...blackbodyToLinearSRGB(7200));
    rim.position.set(-4.5, 2.6, -5.0);
    ctx.scene3D.add(rim);

    const fill = new THREE.DirectionalLight(0xffd9b0, 0.20);
    fill.position.set(-2.5, 1.2, 4.5);
    ctx.scene3D.add(fill);
    ctx.scene3D.add(new THREE.AmbientLight(0x1a1420, 0.7));

    // ---- volumetric shaft: soft additive cone along the key direction
    const shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uT;
        void main(){
          float edge = sin(vUv.x*3.14159);
          float fall = smoothstep(0.02,0.75,vUv.y)*(1.0-smoothstep(0.55,1.0,vUv.y));
          float a = edge*edge*fall*(0.030+0.010*sin(uT*0.7));
          gl_FragColor = vec4(1.0,0.62,0.30,a);
        }`,
    });
    const shaft = new THREE.Mesh(new THREE.ConeGeometry(1.9, 5.6, 48, 1, true), shaftMat);
    shaft.position.set(1.9, 3.1, 1.15);
    shaft.lookAt(0, 0.6, -0.4);
    shaft.rotateX(-Math.PI / 2);
    ctx.scene3D.add(shaft);

    // ---- dust motes drifting in the light
    const N = 120;
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

    // ---- camera + captions
    ctx.rig.setLensMm(58);
    ctx.text('cap0', CAPTIONS[0]![2]!, { fontSize: CAPTIONS[0]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 700, color: '#f5e2c4', letterSpacing: 6, align: 'center', alpha: 0 });
    ctx.text('cap1', CAPTIONS[1]![2]!, { fontSize: CAPTIONS[1]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c4a5', letterSpacing: 3, align: 'center', alpha: 0 });
    ctx.text('cap2', CAPTIONS[2]![2]!, { fontSize: CAPTIONS[2]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c4a5', letterSpacing: 3, align: 'center', alpha: 0 });

    ctxState.inst = inst; ctxState.emberLight = emberLight;
    ctxState.emberMat = emberMat; ctxState.shaftMat = shaftMat; ctxState.dustMat = dustMat;
  },

  render: (ctx: SceneContext, f: Frame, out): PostOverrides => {
    const t = f.lt;
    const inst = ctxState.inst!;

    // ---- closed-form drive: arms + rings share one angle per lane; planets
    // ride the arm tip; the gear train counters on the column.
    for (let i = 0; i < 3; i++) {
      const th = PHI[i]! + OMEGA[i]! * t + 0.004 * Math.sin(t * 3.1 + i * 2.0);
      inst.part(`arm_${i}`)!.rotation.y = th;
      inst.part(`ring_${i}`)!.rotation.y = th;
      const pl = inst.part(`planet_${i}`)!;
      pl.position.set(ARM_R[i]! * Math.cos(th), PLANET_Y[i]!, -ARM_R[i]! * Math.sin(th));
      pl.rotation.y = t * (0.55 + i * 0.27);
      inst.part(`gear_${i}`)!.rotation.y = GEAR_W[i]! * t + i * 0.7;
    }

    // ember breathing + flicker
    const fl = 0.88 + 0.09 * Math.sin(t * 6.3) + 0.05 * Math.sin(t * 13.7 + 2.1);
    ctxState.emberLight!.intensity = 7 * fl;
    ctxState.emberMat!.emissiveIntensity = 1.7 * fl;
    ctxState.shaftMat!.uniforms.uT!.value = t;
    ctxState.dustMat!.uniforms.uT!.value = t;

    // ---- camera: slow low orbit, gentle push-in on the last beats
    const push = sstep(13.5, DUR - 0.4, t);
    const yaw = -0.55 + t * 0.105 + 0.012 * Math.sin(t * 0.9) + 0.008 * Math.sin(t * 2.3 + 1.0);
    const pitch = 0.15 + 0.05 * Math.sin(t * 0.21 + 0.5) + 0.05 * push;
    const radius = 4.75 - 1.05 * push;
    const tgt: [number, number, number] = [0, 1.32 + 0.05 * Math.sin(t * 0.15) + 0.12 * push, 0];
    ctx.rig.orbit(tgt, radius, pitch, yaw);
    ctx.updateCamera(f.t, f.p);

    // ---- captions (fade windows, halos via engine text); the 2D layer is
    // persistent across frames — clear before drawing this frame's text.
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
      exposure: 0.95,
      bloom: 0.34, bloomThreshold: 0.92, bloomRadius: 0.7,
      halation: 0.10, ca: 0.9, grain: 0.05, vignette: 0.48,
      dof: 0.45, focusDist: 0.14, focalRange: 0.24, dofRadius: 3.0,
    };
  },
});

const ctxState: {
  inst?: GLTFInstance;
  emberLight?: THREE.PointLight;
  emberMat?: THREE.MeshPhysicalMaterial;
  shaftMat?: THREE.ShaderMaterial;
  dustMat?: THREE.ShaderMaterial;
} = {};

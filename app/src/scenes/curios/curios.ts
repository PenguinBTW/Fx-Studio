// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// curios: cabinet-of-curiosities shelf macro — warm-lit product frame.
// Rich visible detail over mood-darkness: strong warm key + readable fill.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { orbitPosition } from '../../engine/rig';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { GLTFInstance } from '../../engine/gltf';

const DUR = 20;
const W = 1920, H = 1080;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

const CAPTIONS: [number, number, string, number][] = [
  [0.4, 5.0, 'THE CABINET', 46],
  [7.0, 12.5, 'objects keep their small fires', 30],
  [14.5, 19.0, 'every shelf a short history', 30],
];

// camera: macro dolly traversing the shelf face — geode (low) → bottles (mid)
// → watch (high right) — with a late push-in on the watch face
const camPose = (t: number) => {
  const p1 = sstep(1.5, 6.5, t);          // geode -> bottles
  const p2 = sstep(8.0, 13.5, t);         // bottles -> watch
  const push = sstep(15.5, DUR - 0.4, t); // dolly beat on the watch
  const mix = (a: number, b: number, c: number) => a + (b - a) * p1 + (c - b) * p2;
  const tgt: [number, number, number] = [
    mix(-0.52, 0.02, 0.62),
    mix(0.78, 1.48, 1.92) + 0.03 * push,
    mix(-0.18, -0.22, -0.16),
  ];
  const yaw = 0.06 + 0.10 * Math.sin(t * 0.35) - 0.10 * push + 0.10 * (tgt[0] / 0.7);
  const pitch = 0.10 + 0.03 * Math.sin(t * 0.27) + 0.02 * push;
  const radius = 1.45 - 0.12 * p1 - 0.08 * p2 - 0.34 * push;
  return { tgt, radius, pitch, yaw };
};

// ------------------------------------------------------------ textures
const makeTex = (size: number, fn: (u: number, v: number, px: Uint8ClampedArray, i: number) => void) => {
  const d = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) fn(x / size, y / size, d, (y * size + x) * 4);
  const t = new THREE.DataTexture(d, size, size);
  t.needsUpdate = true;
  return t;
};
const h1 = (x: number) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5; return s - Math.floor(s); };

const oakTex = () => makeTex(256, (u, v, px, i) => {
  const rings = Math.abs(Math.sin(v * 40 + 3 * Math.sin(u * 8) + h1(Math.floor(v * 40)) * 1.4));
  const p = 0.55 + 0.45 * rings + 0.12 * h1(u * 90 + v * 90);
  px[i] = Math.round(70 * p); px[i + 1] = Math.round(46 * p); px[i + 2] = Math.round(26 * p); px[i + 3] = 255;
});
const patina = () => makeTex(128, (u, v, px, i) => {
  const n = h1(Math.floor(u * 14) * 7 + Math.floor(v * 14) * 13);
  const p = 130 + 110 * n;
  px[i] = px[i + 1] = px[i + 2] = Math.round(p); px[i + 3] = 255;
});
const paperTex = () => makeTex(128, (u, v, px, i) => {
  const stain = h1(Math.floor(u * 6) * 3 + Math.floor(v * 6) * 5) * 0.25;
  const p = 0.8 - stain + 0.08 * h1(u * 70 + v * 70);
  px[i] = Math.round(210 * p); px[i + 1] = Math.round(190 * p); px[i + 2] = Math.round(150 * p); px[i + 3] = 255;
});

// ------------------------------------------------------------ shaders
const DUST_VERT = /* glsl */ `
attribute float seed;
uniform float uT;
varying float vA;
void main() {
  vec3 p = position;
  float s = seed;
  p.x += sin(uT * 0.20 + s * 31.0) * 0.05 + sin(uT * 0.45 + s * 17.0) * 0.02;
  p.y += sin(uT * 0.13 + s * 23.0) * 0.06 - fract(s * 7.13 + uT * 0.012) * 0.25;
  p.z += cos(uT * 0.17 + s * 41.0) * 0.04;
  vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uT * 1.4 + s * 97.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (3.0 + 2.4 * fract(s * 5.77)) * (180.0 / -mv.z);
}`;
const DUST_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = (1.0 - d * 2.0) * (1.0 - d * 2.0) * 0.45 * vA;
  gl_FragColor = vec4(1.0, 0.85, 0.6, a);
}`;

const RAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RAY_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uT;
void main() {
  float edge = sin(vUv.x * 3.14159);
  float fall = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y));
  float a = edge * edge * edge * fall * 0.055 * (0.85 + 0.15 * sin(uT * 0.5 + vUv.x * 6.0));
  gl_FragColor = vec4(1.0, 0.80, 0.55, a);
}`;

// ------------------------------------------------------------ scene
export default defineScene({
  id: 'curios',
  assets: ['curios'],

  setup: async (ctx: SceneContext) => {
    const inst = ctx.asset('curios');
    const r = ctx.renderer;

    const pmrem = new THREE.PMREMGenerator(r);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    ctx.scene3D.environment = envRT.texture;
    ctx.scene3D.background = new THREE.Color(0x0a0705);
    ctx.scene3D.environmentIntensity = 0.4;
    pmrem.dispose();

    const texOak = oakTex(), texPat = patina(), texPaper = paperTex();

    const oak = new THREE.MeshPhysicalMaterial({
      color: 0x6a4a28, roughness: 0.7, metalness: 0.0,
      roughnessMap: texOak, bumpMap: texOak, bumpScale: 0.05,
      envMapIntensity: 0.5,
    });
    const oakD = new THREE.MeshPhysicalMaterial({
      color: 0x3a2414, roughness: 0.8, metalness: 0.0,
      roughnessMap: texOak, bumpMap: texOak, bumpScale: 0.05,
      envMapIntensity: 0.35,
    });
    const brass = new THREE.MeshPhysicalMaterial({
      color: 0x9a6a28, metalness: 0.92, roughness: 0.38,
      roughnessMap: texPat, bumpMap: texPat, bumpScale: 0.006,
      envMapIntensity: 1.3,
    });
    const iron = new THREE.MeshPhysicalMaterial({
      color: 0x1e2026, metalness: 0.85, roughness: 0.45,
      roughnessMap: texPat, envMapIntensity: 0.9,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xf2f0e6, roughness: 0.06, metalness: 0.0,
      transmission: 0.92, thickness: 0.12, ior: 1.45,
      attenuationColor: new THREE.Color(0.55, 0.62, 0.55),
      attenuationDistance: 0.6,
      envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
    });
    const lense = new THREE.MeshPhysicalMaterial({
      color: 0xe8f0ee, roughness: 0.02, metalness: 0.0,
      transmission: 0.95, thickness: 0.02, ior: 1.5,
      envMapIntensity: 2.0, depthWrite: false,
    });
    const ameth = new THREE.MeshPhysicalMaterial({
      color: 0x6a32a8, metalness: 0.2, roughness: 0.12,
      emissive: new THREE.Color(0.22, 0.06, 0.42), emissiveIntensity: 0.7,
      envMapIntensity: 2.2, clearcoat: 1.0, clearcoatRoughness: 0.1,
    });
    const ameth2 = new THREE.MeshPhysicalMaterial({
      color: 0x3a1a58, metalness: 0.15, roughness: 0.35,
      emissive: new THREE.Color(0.10, 0.03, 0.18), emissiveIntensity: 0.5,
      envMapIntensity: 1.0,
    });
    const geode = new THREE.MeshPhysicalMaterial({
      color: 0x141013, roughness: 0.9, metalness: 0.0,
      roughnessMap: texPat, bumpMap: texPat, bumpScale: 0.04,
      envMapIntensity: 0.3,
    });
    const paper = new THREE.MeshPhysicalMaterial({
      color: 0xd8c8a0, roughness: 0.9, metalness: 0.0,
      map: texPaper, envMapIntensity: 0.25,
    });
    const wax = new THREE.MeshPhysicalMaterial({
      color: 0x8a1210, roughness: 0.35, metalness: 0.0,
      clearcoat: 0.7, envMapIntensity: 0.7,
    });
    const herb = new THREE.MeshPhysicalMaterial({
      color: 0x3a4420, roughness: 0.85, metalness: 0.0,
      envMapIntensity: 0.3,
    });
    const stringM = new THREE.MeshPhysicalMaterial({
      color: 0x8a7a58, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.2,
    });
    const wing = new THREE.MeshPhysicalMaterial({
      color: 0x584430, roughness: 0.85, metalness: 0.0,
      side: THREE.DoubleSide, envMapIntensity: 0.3,
    });
    const wick = new THREE.MeshPhysicalMaterial({ color: 0x080806, roughness: 0.9 });
    const flame = new THREE.MeshPhysicalMaterial({
      color: 0xff8020, emissive: new THREE.Color(1.0, 0.45, 0.08),
      emissiveIntensity: 9.0, roughness: 0.3,
    });
    const ink = new THREE.MeshPhysicalMaterial({ color: 0x14100c, roughness: 0.8 });
    const face = new THREE.MeshPhysicalMaterial({
      color: 0x9a8a6a, roughness: 0.75, metalness: 0.0, envMapIntensity: 0.3,
    });

    const mats: Record<string, THREE.Material> = {
      Oak: oak, OakD: oakD, Brass: brass, Iron: iron, Glass: glass,
      Ameth: ameth, Ameth2: ameth2, Geode: geode, Paper: paper, Wax: wax, Herb: herb,
      String: stringM, Wing: wing, Wick: wick, Flame: flame,
      Lense: lense, Ink: ink, Face: face,
    };
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = (m.material as THREE.Material).name;
      if (mats[name]) m.material = mats[name]!;
    });
    inst.ownedMaterials.push(...Object.values(mats));

    // animated parts
    const hand = inst.part('tick_hand') as THREE.Object3D | undefined;
    const gears = [0, 1, 2].map((i) => inst.part(`gear_${i}`) as THREE.Object3D | undefined);
    const flameOb = inst.part('flame') as THREE.Mesh | undefined;

    // ---- lamp beam: warm cone slanting right-down from the oil lamp
    const rayMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 } },
      vertexShader: RAY_VERT, fragmentShader: RAY_FRAG,
    });
    const beamDir = new THREE.Vector3(0.42, -0.85, 0.30).normalize();
    const beamAnchor = new THREE.Vector3(-0.95, 2.10, -0.30);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.16, 3.4, 24, 1, true), rayMat);
    beam.position.copy(beamAnchor).addScaledVector(beamDir, 1.7);
    beam.lookAt(beamAnchor);
    beam.rotateX(Math.PI / 2);
    ctx.scene3D.add(beam);

    // ---- dust motes in the beam
    const N = 130;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = i * 0.61803 + 0.1;
    dg.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    // scatter inside the beam volume
    const pos = dg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const s = seeds[i]!;
      const a = h1(s * 13) * Math.PI * 2, rr = h1(s * 7) * 0.5;
      const u = h1(s * 3);
      pos.setXYZ(i,
        beamAnchor.x + beamDir.x * u * 2.6 + Math.cos(a) * rr,
        beamAnchor.y + beamDir.y * u * 2.6 + Math.sin(a) * rr * 0.6,
        beamAnchor.z + beamDir.z * u * 2.6 + Math.sin(a + 1) * rr * 0.5);
    }
    const dustMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
    });
    const dust = new THREE.Points(dg, dustMat);
    dust.frustumCulled = false;
    ctx.scene3D.add(dust);

    // ---- lights: warm product key + readable fill, NOT mood-dark
    const key = new THREE.SpotLight(0xffffff, 14, 12, 0.55, 0.5, 1.6);
    key.color.setRGB(1.0, 0.78, 0.52);
    key.position.set(1.6, 3.4, 2.2);
    key.target.position.set(0, 1.3, 0);
    ctx.scene3D.add(key, key.target);

    const fill = new THREE.DirectionalLight(0xffffff, 1.1);
    fill.color.setRGB(0.55, 0.62, 0.80);
    fill.position.set(-2.5, 2.2, 2.5);
    ctx.scene3D.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.color.setRGB(0.9, 0.75, 0.55);
    rim.position.set(-1.5, 3.0, -2.5);
    ctx.scene3D.add(rim);

    ctx.scene3D.add(new THREE.AmbientLight(0x241a10, 1.2));

    const lampLight = new THREE.PointLight(0xffffff, 3.5, 4.5, 2);
    lampLight.color.setRGB(1.0, 0.55, 0.18);
    lampLight.position.set(-0.95, 2.12, -0.30);
    ctx.scene3D.add(lampLight);

    // ---- camera
    ctx.rig.setLensMm(58);
    ctx.rig.pathTiming = 'keyed';
    ctx.rig.setPath(Array.from({ length: Math.ceil(DUR) + 1 }, (_, i) => {
      const tt = Math.min(DUR, i);
      const p = camPose(tt);
      return { t: tt / DUR, pos: orbitPosition(p.tgt, p.radius, p.pitch, p.yaw), target: p.tgt };
    }));
    ctx.text('cap0', CAPTIONS[0]![2]!, { fontSize: CAPTIONS[0]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 700, color: '#f0dcb0', letterSpacing: 6, align: 'center', alpha: 0 });
    ctx.text('cap1', CAPTIONS[1]![2]!, { fontSize: CAPTIONS[1]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c8a8', letterSpacing: 3, align: 'center', alpha: 0 });
    ctx.text('cap2', CAPTIONS[2]![2]!, { fontSize: CAPTIONS[2]![3]!, fontFamily: 'Archivo, sans-serif', fontWeight: 400, color: '#d8c8a8', letterSpacing: 3, align: 'center', alpha: 0 });

    ctxState.inst = inst; ctxState.hand = hand; ctxState.gears = gears;
    ctxState.flameOb = flameOb; ctxState.rayMat = rayMat; ctxState.dustMat = dustMat;
    ctxState.lampLight = lampLight; ctxState.envRT = envRT; ctxState.flameMat = flame;
    ctxState.textures = [texOak, texPat, texPaper];
  },

  dispose: () => {
    const S = ctxState;
    S.envRT?.dispose();
    S.textures?.forEach((t) => t.dispose());
    S.rayMat?.dispose(); S.dustMat?.dispose();
    ctxState.inst = undefined;
  },

  render: (ctx: SceneContext, f: any, out: any) => {
    const t = f.t as number;
    const S = ctxState;

    // pocket-watch gears: slow counter-rotation; tick hand steps
    if (S.gears) S.gears.forEach((g, i) => { if (g) g.rotation.z = t * (i % 2 ? -0.5 : 0.7) * (0.6 + i * 0.2); });
    if (S.hand) {
      const tick = Math.floor(t * 3) * (Math.PI / 90);  // ~20 steps over the take
      S.hand.rotation.z = -tick + 0.03 * Math.sin(t * 40) * (tick - Math.floor(tick));
    }
    // flame + lamp breathe
    const breathe = 0.85 + 0.10 * Math.sin(t * 2.1) + 0.05 * Math.sin(t * 7.7 + 0.8);
    if (S.flameMat) S.flameMat.emissiveIntensity = 9.0 * breathe;
    if (S.lampLight) S.lampLight.intensity = 3.5 * breathe;
    if (S.flameOb) S.flameOb.scale.set(1, 1, 1 + 0.06 * Math.sin(t * 5.3));
    S.rayMat!.uniforms.uT!.value = t;
    S.dustMat!.uniforms.uT!.value = t;

    const p = camPose(t);
    ctx.rig.orbit(p.tgt, p.radius, p.pitch, p.yaw);
    ctx.updateCamera(f.t, f.p);

    const c2d = ctx.layer2d.ctx;
    const cw = ctx.W, ch = ctx.H;
    c2d.clearRect(0, 0, cw, ch);
    for (let i = 0; i < CAPTIONS.length; i++) {
      const [t0, t1] = CAPTIONS[i]!;
      const a = sstep(t0, t0 + 0.9, t) * (1 - sstep(t1 - 0.9, t1, t));
      ctx.text(`cap${i}`, CAPTIONS[i]![2]!, { alpha: a });
      ctx.renderText(`cap${i}`, c2d, f.t, cw / 2, ch * 0.82);
    }

    ctx.flush(out, true);
    // DoF racks between shelf depths across the take
    const rack = 0.5 + 0.5 * Math.sin(t * 0.22);
    return {
      exposure: 0.98,
      bloom: 0.30, bloomThreshold: 0.9, bloomRadius: 0.6,
      halation: 0.08, ca: 0.7, grain: 0.05, vignette: 0.42,
      dof: 0.55, focusDist: 0.10 + 0.10 * rack, focalRange: 0.20, dofRadius: 3.0,
    };
  },
});

const ctxState: {
  inst?: GLTFInstance;
  hand?: THREE.Object3D;
  gears?: (THREE.Object3D | undefined)[];
  flameOb?: THREE.Mesh;
  flameMat?: THREE.MeshPhysicalMaterial;
  lampLight?: THREE.PointLight;
  rayMat?: THREE.ShaderMaterial;
  dustMat?: THREE.ShaderMaterial;
  envRT?: THREE.WebGLRenderTarget;
  textures?: THREE.DataTexture[];
} = {};

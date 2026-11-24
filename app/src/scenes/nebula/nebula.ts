// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene: 'nebula' — a slow drift through a star-forming nebula.
// Volumetric fbm cloud layers (amethyst/teal/gold), newborn stars twinkling
// inside the gas, dark foreground veils for parallax. Fully procedural,
// closed-form f(t) — no imported assets.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';
import type { Frame } from '../../engine/scene';

// --- palette ----------------------------------------------------------------
const AMETHYST = new THREE.Color(0x5b3d9e);
const TEAL = new THREE.Color(0x1f8f86);
const GOLD = new THREE.Color(0xd9a43c);
const VOID = new THREE.Color(0x04060f);

// --- camera path (closed form over global time t) ----------------------------
const CAM = {
  z0: 30,
  speed: 2.8, // units/s forward drift
};

function camPos(t: number): [number, number, number] {
  return [
    1.8 * Math.sin(0.34 * t) + 0.5 * Math.sin(0.11 * t + 1.7),
    0.6 + 0.9 * Math.sin(0.22 * t + 0.7),
    CAM.z0 - CAM.speed * t,
  ];
}
function camTarget(t: number): [number, number, number] {
  const [x, y, z] = camPos(t + 5); // steer toward where we're headed
  return [x * 0.4, y * 0.4 - 0.4, z - 14];
}

// --- cloud layer shader ------------------------------------------------------
const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;      // global time
uniform float uSeed;   // per-layer seed offset
uniform float uAlpha;  // master alpha
uniform float uPass;   // camera pass fade (1 = fully ahead of camera)
uniform float uInside; // 0 far approach → 1 inside cloud density
uniform float uPocket; // nursery pocket glow 0..1
uniform float uSpeed;  // shear rate (nearer layers move faster)
uniform vec3  uColA;   // amethyst
uniform vec3  uColB;   // teal
uniform vec3  uColC;   // gold
uniform float uVeil;   // 1 = dark foreground veil, 0 = lit cloud
uniform float uScale;  // noise domain scale (far = billowy, near = wisp detail)

void main() {
  vec2 p = (vUv - 0.5) * uScale;
  vec2 drift = vec2(uT * uSpeed, uT * uSpeed * 0.35);
  vec3 q = vec3(p + drift + uSeed * 17.0, uT * 0.045 + uSeed * 3.0);

  float base = fbm3(q, 5, 2.02, 0.55);
  float detail = fbm3(q * 2.6 + 31.0, 4, 2.1, 0.5);
  float d = sat(base * 0.72 + detail * 0.45 - 0.08);

  // radial vignette so plane edges never show
  float edge = smoothstep(1.0, 0.55, length(vUv - 0.5) * 2.0);

  float density = smoothstep(0.10, 0.62, d) * edge;
  float body = smoothstep(0.30, 0.9, d);

  // palette: amethyst body, teal shadows, gold rim/pocket glow
  vec3 col = mix(uColB * 0.55, uColA, sat(base * 1.4));
  col = mix(col, uColC, sat(body * body * (0.35 + uPocket * 0.85)));

  // lit dust brightens inside the nursery pocket region
  float glow = uPocket * smoothstep(0.25, 0.0, length(vUv - vec2(0.62, 0.45)) * 2.0);
  col += uColC * glow * 0.9;

  float a = density * uAlpha * uPass;
  if (uVeil > 0.5) {
    col = vec3(0.012, 0.014, 0.03); // near-black veil
    a = density * uAlpha * 0.85;
  } else {
    a *= (0.6 + uInside * 0.8);
  }
  gl_FragColor = vec4(col, a);
}
`;

// --- star points shader ------------------------------------------------------
const STAR_VERT = /* glsl */ `
attribute float aSeed;
attribute vec3 aColor;
attribute float aPocket;
uniform float uT;
uniform float uSize;
uniform float uPocket;
varying vec3 vCol;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.55 + 0.45 * sin(uT * (1.5 + 3.0 * fract(aSeed * 7.13)) + aSeed * 41.0);
  vA = tw * (1.0 + uPocket * 1.6 * aPocket);
  vCol = aColor;
  float ps = uSize * (0.5 + fract(aSeed * 3.7)) * (1.0 + aPocket * uPocket * 0.4);
  gl_PointSize = min(ps * (280.0 / max(1.0, -mv.z)), 18.0);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.15, d) * vA;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol, a);
}
`;

interface LayerSpec {
  z: number;
  scale: number;
  alpha: number;
  speed: number;
  seed: number;
  veil: boolean;
  tilt: number;
  nscale: number;
}

// back → front cloud planes; nearer ones shear faster for parallax
const LAYERS: LayerSpec[] = [
  { z: -70, scale: 160, alpha: 0.7, speed: 0.012, seed: 1, veil: false, tilt: 0.08, nscale: 3.5 },
  { z: -52, scale: 120, alpha: 0.75, speed: 0.02, seed: 2, veil: false, tilt: -0.12, nscale: 4.0 },
  { z: -38, scale: 95, alpha: 0.78, speed: 0.03, seed: 3, veil: false, tilt: 0.2, nscale: 4.5 },
  { z: -26, scale: 75, alpha: 0.8, speed: 0.05, seed: 4, veil: false, tilt: -0.05, nscale: 5.0 },
  { z: -16, scale: 55, alpha: 0.82, speed: 0.08, seed: 5, veil: false, tilt: 0.15, nscale: 5.5 },
  { z: -12, scale: 46, alpha: 0.75, speed: 0.11, seed: 9, veil: false, tilt: 0.1, nscale: 6.0 },
  { z: -8, scale: 40, alpha: 0.78, speed: 0.14, seed: 6, veil: false, tilt: -0.25, nscale: 6.5 },
  { z: -4.5, scale: 32, alpha: 0.5, speed: 0.55, seed: 10, veil: false, tilt: 0.3, nscale: 7.0 },
  { z: -2.5, scale: 26, alpha: 0.8, speed: 0.45, seed: 7, veil: true, tilt: 0.35, nscale: 8.0 },
  { z: -1.2, scale: 18, alpha: 0.85, speed: 0.6, seed: 8, veil: true, tilt: -0.4, nscale: 9.0 },
];

interface NebState {
  layers: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; spec: LayerSpec }[];
  starMat: THREE.ShaderMaterial;
  coreMat: THREE.ShaderMaterial;
}
let nebState: NebState;

function smooth01(x: number): number {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

export default defineScene({
  id: 'nebula/drift',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = VOID;
    const layers: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; spec: LayerSpec }[] = [];
    const rng = mulberry32(20261124);

    // cloud layers
    for (let i = 0; i < LAYERS.length; i++) {
      const spec = LAYERS[i];
      const geo = new THREE.PlaneGeometry(spec.scale, spec.scale * 0.62);
      const mat = new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uT: { value: 0 },
          uSeed: { value: spec.seed },
          uAlpha: { value: spec.alpha },
          uPass: { value: 1 },
          uInside: { value: 0 },
          uPocket: { value: 0 },
          uSpeed: { value: spec.speed },
          uVeil: { value: spec.veil ? 1 : 0 },
          uScale: { value: spec.nscale },
          uColA: { value: new THREE.Vector3(AMETHYST.r, AMETHYST.g, AMETHYST.b) },
          uColB: { value: new THREE.Vector3(TEAL.r, TEAL.g, TEAL.b) },
          uColC: { value: new THREE.Vector3(GOLD.r, GOLD.g, GOLD.b) },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (rng() - 0.5) * spec.scale * 0.5,
        (rng() - 0.5) * spec.scale * 0.3,
        spec.z,
      );
      mesh.rotation.z = spec.tilt;
      mesh.renderOrder = 10 + i;
      sc.add(mesh);
      layers.push({ mesh, mat, spec });
    }

    // stars: deep field + embedded newborns (aPocket=1 brightens near the core)
    const N = 1500;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const pocket = new Float32Array(N);
    const cWarm = new THREE.Color(0xffd9a0);
    const cCool = new THREE.Color(0xbfd4ff);
    const cGold = new THREE.Color(0xffc76a);
    for (let i = 0; i < N; i++) {
      const isNewborn = i >= N - 340; // last block = nursery cluster
      const s = rng();
      seed[i] = s;
      if (isNewborn) {
        // clustered around the pocket at (3.5, -0.5, -52)
        const r = 3 + rng() * 11;
        const th = rng() * Math.PI * 2;
        const ph = Math.acos(2 * rng() - 1);
        pos[i * 3] = 3.5 + r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = -0.5 + r * Math.sin(ph) * Math.sin(th) * 0.6;
        pos[i * 3 + 2] = -52 + r * Math.cos(ph) * 0.5;
        const c = rng() < 0.55 ? cGold : cWarm;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        pocket[i] = 1;
      } else {
        pos[i * 3] = (rng() - 0.5) * 140;
        pos[i * 3 + 1] = (rng() - 0.5) * 90;
        pos[i * 3 + 2] = -30 - rng() * 60;
        const c = rng() < 0.6 ? cCool : cWarm;
        col[i * 3] = c.r * 0.75; col[i * 3 + 1] = c.g * 0.75; col[i * 3 + 2] = c.b * 0.8;
      }
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    starGeo.setAttribute('aPocket', new THREE.BufferAttribute(pocket, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 0 },
        uSize: { value: 1.5 },
        uPocket: { value: 0 },
      },
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder = 5;
    sc.add(stars);

    // nursery pocket core glow — brightens as the camera approaches
    const coreGeo = new THREE.PlaneGeometry(46, 46);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        ${GLSL_NOISE}
        varying vec2 vUv;
        uniform float uPocket;
        uniform float uT;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          // cloud-textured halo: fbm breaks the radial falloff into lit gas
          float n = fbm3(vec3(vUv * 7.0, uT * 0.05 + 4.0), 4, 2.0, 0.55) * 0.5 + 0.5;
          float halo = smoothstep(1.0, 0.15, d) * (0.3 + 0.7 * n);
          float nucleus = smoothstep(0.22, 0.0, d);
          float a = (halo * 0.5 + nucleus * 0.9) * uPocket;
          vec3 col = mix(vec3(0.95, 0.5, 0.18), vec3(1.0, 0.85, 0.55), nucleus + halo * 0.4);
          col += vec3(1.0, 0.9, 0.75) * nucleus * 0.8;
          gl_FragColor = vec4(col * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPocket: { value: 0 }, uT: { value: 0 } },
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(3.5, -0.5, -56);
    core.renderOrder = 30; // drawn after the gas — glow punches through the fog
    sc.add(core);

    ctx.rig.setLensMm(38);

    nebState = { layers, starMat, coreMat };
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t; // global time — continuous across the caption entries
    const camZ = CAM.z0 - CAM.speed * t;
    const inside = smooth01((t - 6.0) / 7.0); // enter the gas ~t6→13
    const pocketU = smooth01((t - 13.5) / 4.0); // nursery glow ~t14→17.5

    const state = nebState as NebState;
    for (const { mesh, mat, spec } of state.layers) {
      const dist = camZ - spec.z;
      // fade out as the camera reaches the plane (0.4..4 units ahead)
      mat.uniforms.uPass.value = spec.veil ? 1 : smooth01(dist / 4.0 - 0.1);
      mat.uniforms.uT.value = t;
      mat.uniforms.uInside.value = inside;
      mat.uniforms.uPocket.value = pocketU;
    }
    state.starMat.uniforms.uT.value = t;
    state.starMat.uniforms.uPocket.value = pocketU;
    state.coreMat.uniforms.uPocket.value = pocketU;
    state.coreMat.uniforms.uT.value = t;

    ctx.rig.position = camPos(t);
    ctx.rig.target = camTarget(t);
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene: 'solarflare' — the sun's limb filling the lower frame: fbm granulation,
// a corona crown of fine radial rays, and magnetic prominence loops that rise,
// hold and collapse with plasma flecks riding them. Closed-form f(t) only.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';
import type { Frame } from '../../engine/scene';

function smooth01(x: number): number {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

// --- camera: near-static slow drift over the limb ---------------------------
function camPos(t: number): [number, number, number] {
  return [1.5 * Math.sin(0.08 * t), 3.0 + 0.6 * Math.sin(0.06 * t + 1.0), 26 - 0.35 * t];
}
function camTarget(t: number): [number, number, number] {
  return [0.5 * Math.sin(0.05 * t + 0.4), -4.0, -10];
}

// --- solar surface (huge sphere below the camera) ----------------------------
const SUN_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vView;
void main() {
  vPos = position;
  vNrm = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const SUN_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec3 vPos;
varying vec3 vNrm;
varying vec3 vView;
uniform float uT;
uniform float uSwell; // activity level 0..1
uniform float uErupt; // eruption flash 0..1
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uDark;

void main() {
  vec3 p = normalize(vPos);
  float g1 = fbm3(p * 14.0 + vec3(0.0, uT * 0.06, 0.0), 5, 2.05, 0.55);
  float g2 = fbm3(p * 30.0 + vec3(uT * 0.03, 0.0, 11.0), 4, 2.1, 0.5);
  float gran = g1 * 0.7 + g2 * 0.45;
  // limb darkening — sun cooler toward the edge
  float mu = sat(dot(normalize(vNrm), normalize(vView)));
  float limb = 0.25 + 0.75 * pow(mu, 0.7);

  vec3 col = mix(uDark, uMid, sat(gran * 1.6 + 0.15));
  col = mix(col, uHot, sat(gran * gran * 1.8 + uSwell * 0.15));
  col *= limb;
  col += uHot * uErupt * 0.18;
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- corona: big billboard behind the sun, polar ray flicker -----------------
const CORONA_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uSwell;
uniform float uErupt;

void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float th = atan(c.y, c.x);

  // only emit outside the disc radius; fade with distance
  float disc = 0.34;
  float ext = smoothstep(disc, disc + 0.02, r);
  float fall = 1.0 - smoothstep(disc + 0.06, 1.0, r);

  // fine radial striations: angular hash+fbr streaks
  float rays = fbm3(vec3(th * 9.0, r * 3.0 - uT * 0.22, 7.0), 4, 2.0, 0.55);
  rays = pow(sat(rays * 1.15), 1.7);
  float fine = fbm3(vec3(th * 40.0, r * 2.0, uT * 0.3), 3, 2.0, 0.5);
  fine = pow(sat(fine * 1.4), 2.4);

  float a = (rays * 1.1 + fine * 0.7) * ext * fall;
  // bright base ring hugging the limb
  a += ext * (1.0 - smoothstep(disc + 0.02, disc + 0.3, r)) * 0.7;
  a *= (1.1 + uSwell * 0.9 + uErupt * 0.45);

  vec3 col = mix(vec3(1.0, 0.62, 0.2), vec3(1.0, 0.92, 0.7), sat(1.0 - r));
  gl_FragColor = vec4(col * a, a);
}
`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- prominence loop: tube along a parametric arc, grows via uGrow -----------
const PROM_VERT = /* glsl */ `
uniform float uGrow;
varying float vS;
varying vec3 vNrm;
attribute float aS;
void main() {
  vS = aS;
  vNrm = normalize(normalMatrix * normal);
  vec3 pos = position;
  pos.y *= uGrow; // arcs rise out of the limb then collapse
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const PROM_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vS;
varying vec3 vNrm;
uniform float uT;
uniform float uGlow;
uniform float uSeed;
void main() {
  float n = abs(vNrm.z);
  float rim = 0.55 + 0.45 * n;
  // hotter at the footpoints, cooler at apex
  float heat = 1.0 - 0.45 * sin(vS * 3.14159);
  vec3 col = mix(vec3(1.0, 0.28, 0.05), vec3(1.0, 0.75, 0.35), heat);
  float a = uGlow * rim * (0.75 + 0.25 * sin(vS * 20.0 + uT * 3.0 + uSeed));
  gl_FragColor = vec4(col * a * 1.4, a);
}
`;

interface PromSpec {
  x: number;      // footpoint mid-x on the limb
  z: number;
  h: number;      // arc height
  w: number;      // footpoint span
  seed: number;
  t0: number;     // activation window
  dur: number;
  erupt: boolean; // this loop releases at the eruption beat
}

const PROMS: PromSpec[] = [
  { x: -6, z: -24, h: 9, w: 7, seed: 1, t0: 7, dur: 9, erupt: false },
  { x: 2, z: -26, h: 12, w: 9, seed: 2, t0: 8.5, dur: 8, erupt: true },
  { x: 9, z: -23, h: 6, w: 5, seed: 3, t0: 10, dur: 7, erupt: false },
  { x: -1.5, z: -22, h: 7, w: 6, seed: 4, t0: 12, dur: 8, erupt: true },
];

interface SfState {
  sunMat: THREE.ShaderMaterial;
  coronaMat: THREE.ShaderMaterial;
  proms: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; flecks: THREE.Points; fleckMat: THREE.ShaderMaterial; spec: PromSpec }[];
  starMat: THREE.ShaderMaterial;
}
// Per-SceneContext state: each project entry creates its own scene instance.
const sfStates = new WeakMap<SceneContext, SfState>();

export default defineScene({
  id: 'solarflare/limb',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x020308);

    // --- sun: huge sphere sunk below the camera; limb fills lower frame
    const sunGeo = new THREE.SphereGeometry(30, 96, 64);
    const sunMat = new THREE.ShaderMaterial({
      vertexShader: SUN_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: {
        uT: { value: 0 },
        uSwell: { value: 0 },
        uErupt: { value: 0 },
        uHot: { value: new THREE.Vector3(1.0, 0.85, 0.55) },
        uMid: { value: new THREE.Vector3(0.95, 0.42, 0.08) },
        uDark: { value: new THREE.Vector3(0.35, 0.08, 0.01) },
      },
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(0, -33.5, -20);
    sc.add(sun);

    // --- corona crown: billboard behind the limb
    const coronaGeo = new THREE.PlaneGeometry(130, 130);
    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: CORONA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uSwell: { value: 0 }, uErupt: { value: 0 } },
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    corona.position.set(0, -33.5, -46);
    corona.renderOrder = 2;
    sc.add(corona);

    // --- prominence loops
    const proms: SfState['proms'] = [];
    for (const spec of PROMS) {
      // parabola arc, base at y=0, apex h at s=0.5
      const pts: THREE.Vector3[] = [];
      const NP = 24;
      for (let i = 0; i <= NP; i++) {
        const s = i / NP;
        pts.push(new THREE.Vector3(
          (s - 0.5) * spec.w,
          spec.h * 4.0 * s * (1 - s),
          Math.sin(s * Math.PI) * spec.w * 0.25,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 48, 0.16 + spec.seed * 0.03, 7, false);

      // aS attribute = parametric position along the arc
      const posAttr = tube.getAttribute('position');
      const aS = new Float32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) {
        aS[i] = Math.min(1, Math.max(0, (posAttr.getX(i) / spec.w) + 0.5));
      }
      tube.setAttribute('aS', new THREE.BufferAttribute(aS, 1));

      const mat = new THREE.ShaderMaterial({
        vertexShader: PROM_VERT,
        fragmentShader: PROM_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uT: { value: 0 },
          uGrow: { value: 0.05 },
          uGlow: { value: 0.8 },
          uSeed: { value: spec.seed * 7.0 },
        },
      });
      const mesh = new THREE.Mesh(tube, mat);
      mesh.position.set(spec.x, -4.5, spec.z);
      mesh.renderOrder = 6;
      sc.add(mesh);

      // plasma flecks riding the loop: a point per arc sample
      const NF = 40;
      const fp = new Float32Array(NF * 3);
      const fs = new Float32Array(NF);
      const rng = mulberry32(spec.seed * 991);
      for (let i = 0; i < NF; i++) {
        const s = (i / NF + rng() * 0.02) % 1;
        fs[i] = s;
        const p = curve.getPoint(s);
        fp[i * 3] = p.x; fp[i * 3 + 1] = p.y; fp[i * 3 + 2] = p.z;
      }
      const fGeo = new THREE.BufferGeometry();
      fGeo.setAttribute('position', new THREE.BufferAttribute(fp, 3));
      fGeo.setAttribute('aS', new THREE.BufferAttribute(fs, 1));
      const fleckMat = new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aS;
          uniform float uT;
          uniform float uGrow;
          uniform float uRate;
          varying float vA;
          void main() {
            vec3 pos = position;
            pos.y *= uGrow;
            // bright band rides s = uT*uRate along the loop
            float head = fract(uT * uRate);
            float d = abs(fract(aS - head + 0.5) - 0.5);
            vA = (1.0 - smoothstep(0.0, 0.5, d)) * uGrow;
            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = min(70.0 / max(1.0, -mv.z), 9.0);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float a = (1.0 - smoothstep(0.2, 1.0, length(c) * 2.0)) * vA;
            if (a < 0.004) discard;
            gl_FragColor = vec4(vec3(1.0, 0.75, 0.4) * a, a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uT: { value: 0 }, uGrow: { value: 0 }, uRate: { value: 0.18 + spec.seed * 0.03 } },
      });
      const flecks = new THREE.Points(fGeo, fleckMat);
      flecks.position.copy(mesh.position);
      flecks.renderOrder = 7;
      sc.add(flecks);
      proms.push({ mesh, mat, flecks, fleckMat, spec });
    }

    // --- sparse star field above
    const NS = 500;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    const srgb = mulberry32(777);
    for (let i = 0; i < NS; i++) {
      ss[i] = srgb();
      sp[i * 3] = (srgb() - 0.5) * 160;
      sp[i * 3 + 1] = 4 + srgb() * 60;
      sp[i * 3 + 2] = -40 - srgb() * 60;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uT;
        varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = 0.45 + 0.55 * sin(uT * (0.8 + 2.0 * fract(aSeed * 7.0)) + aSeed * 50.0);
          gl_PointSize = min(1.4 * 220.0 / max(1.0, -mv.z), 4.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vec3(0.75, 0.82, 1.0) * a, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder = 1;
    sc.add(stars);

    ctx.rig.setLensMm(42);
    // seed the rig so non-rendering samplers (God-View blueprint) see the path
    ctx.rig.position = camPos(0);
    ctx.rig.target = camTarget(0);
    ctx.updateCamera(0, 0);
    sfStates.set(ctx, { sunMat, coronaMat, proms, starMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const swell = smooth01((t - 6.0) / 4.0);         // activity builds ~t6→10
    const erupt = Math.exp(-Math.pow((t - 17.0) / 2.2, 2)); // flash peaks t=17

    const S = sfStates.get(ctx)!;
    S.sunMat.uniforms.uT.value = t;
    S.sunMat.uniforms.uSwell.value = swell;
    S.sunMat.uniforms.uErupt.value = erupt;
    S.coronaMat.uniforms.uT.value = t;
    S.coronaMat.uniforms.uSwell.value = swell;
    S.coronaMat.uniforms.uErupt.value = erupt;
    S.starMat.uniforms.uT.value = t;

    for (const { mat, fleckMat, spec } of S.proms) {
      // rise-hold-collapse envelope per loop
      const u = (t - spec.t0) / spec.dur;
      const env = u <= 0 ? 0 : u >= 1 ? Math.max(0, 1 - (u - 1) * 4.0) : Math.min(1, u * 3.0);
      let grow = 0.05 + env * 0.95;
      if (spec.erupt && erupt > 0) grow *= 1.0 + erupt * 0.45; // release stretches, apex stays in frame
      mat.uniforms.uT.value = t;
      mat.uniforms.uGrow.value = grow;
      mat.uniforms.uGlow.value = (0.5 + 0.5 * env) * (0.8 + erupt * (spec.erupt ? 0.9 : 0.2));
      fleckMat.uniforms.uT.value = t;
      fleckMat.uniforms.uGrow.value = grow;
    }

    ctx.rig.position = camPos(t);
    ctx.rig.target = camTarget(t);
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

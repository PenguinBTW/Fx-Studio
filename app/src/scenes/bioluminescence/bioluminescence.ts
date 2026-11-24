// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

function smooth01(x: number) {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
}

// camera: slow drift along the shoreline, late pull toward the dinghy wake
function camPos(t: number): [number, number, number] {
  const s = smooth01((t - 14) / 8);
  return [-4 + 6 * s + 0.6 * Math.sin(0.05 * t), 2.2 + 0.5 * s, 34 - 0.35 * t];
}
function camTarget(t: number): [number, number, number] {
  const s = smooth01((t - 14) / 8);
  return [-1 + 5 * s, -0.5, -8];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- sea: one quad; wave sets are phase fronts crossing a break line ---------
// Each crest i: spawn at horizon, travel shoreward (vUv.y decreasing), glow
// when inside the break band, then a diffusing wash drifts back seaward.
const SEA_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform vec4 uCrest0;   // spawn times
uniform vec4 uCrestV;   // shoreward speeds
uniform vec4 uCrestA;   // amplitudes
const float HORIZON = 0.92;
const float BREAK_Y = 0.34;
void main() {
  // base water: near-black, only the faintest sheen at the horizon
  vec3 col = mix(vec3(0.001, 0.002, 0.005), vec3(0.004, 0.006, 0.011), smoothstep(0.55, 1.0, vUv.y));
  col += vec3(0.002, 0.003, 0.005) * fbm3(vec3(vUv.x * 8.0, vUv.y * 5.0, uT * 0.08), 3, 2.0, 0.5);

  float glow = 0.0;
  for (int i = 0; i < 4; i++) {
    float t0 = uCrest0[i];
    float v = uCrestV[i];
    float amp = uCrestA[i];
    float age = uT - t0;
    if (age < 0.0) continue;
    float y = HORIZON - v * age;
    float tc = (HORIZON - BREAK_Y) / v;      // time to reach the break band
    float tau = age - tc;                   // <0 en route, >=0 after break
    // moving crest line while it travels (dim), flash inside the band
    if (y > BREAK_Y) {
      float line = exp(-pow(abs(vUv.y - y) / 0.012, 2.0));
      float cluster = sat(fbm3(vec3(vUv.x * 9.0 + float(i) * 13.0, uT * 0.3, float(i) * 7.0), 4, 2.0, 0.6) * 1.4);
      float en = amp * (0.22 + 0.78 * smoothstep(-1.6, 0.0, tau));
      glow += line * cluster * en;
    }
    // post-break luminous wash: diffuses at the break band, fades over ~5s
    if (tau > 0.0 && tau < 6.0) {
      // crinkled break line: tight band + a bright flash line at the break
      // moment, both broken into patches by high-frequency fbm
      float wash = exp(-pow(abs(vUv.y - BREAK_Y) / (0.010 + tau * 0.009), 2.0));
      float cl = sat(fbm3(vec3(vUv.x * 22.0 + float(i) * 17.0, tau * 0.8, float(i) * 3.0), 4, 2.0, 0.6) * 2.6 - 0.55);
      glow += wash * cl * amp * 1.5 * exp(-tau * 0.4);
      float flash = exp(-pow(abs(vUv.y - BREAK_Y) / 0.006, 2.0)) * cl;
      glow += flash * amp * 1.1 * exp(-tau * 0.9);
    }
  }
  glow = min(glow, 1.4);
  vec3 cyan = vec3(0.25, 0.85, 1.0);
  col += cyan * glow;
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- sky: star field handled by points; here just the Milky Way band ---------
const SKY_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  vec3 col = mix(vec3(0.001, 0.002, 0.006), vec3(0.003, 0.005, 0.011), vUv.y);
  // faint diagonal galactic band
  vec2 p = vUv - vec2(0.5, 0.55);
  float band = exp(-pow(abs(p.y + p.x * 0.45) / 0.14, 2.0));
  float mw = band * sat(fbm3(vec3(vUv * 7.0, 4.0), 4, 2.0, 0.55) * 0.9 + 0.1);
  col += vec3(0.085, 0.105, 0.140) * mw;
  // horizon airglow hint
  col += vec3(0.008, 0.012, 0.018) * (1.0 - smoothstep(0.0, 0.35, vUv.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- rock ring glow: additive halo at water level around each pillar ---------
const RING_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vUv;
uniform float uEnv;
void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float ring = exp(-pow(abs(r - 0.55) / 0.22, 2.0));
  float a = ring * uEnv;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.25, 0.8, 0.95) * a, a);
}
`;

// --- wake: luminous ribbon trailing the dinghy -------------------------------
const WAKE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uOn;
void main() {
  // vUv.x: 0 = far behind the hull, 1 = at the stern. Brightest at the hull,
  // core fanning out and fading with distance behind it.
  float behind = 1.0 - vUv.x;
  float spread = 0.05 + behind * 0.4;
  float core = exp(-pow(abs(vUv.y - 0.5) / spread, 2.0));
  float age = 1.0 - behind;
  float sh = sat(fbm3(vec3(vUv.x * 14.0 + uT * 0.5, vUv.y * 6.0, 8.0), 3, 2.0, 0.55) * 1.5);
  float a = core * age * (0.5 + 0.5 * sh) * uOn * 2.4;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.22, 0.8, 0.98) * a, a);
}
`;

// --- sparkle bursts: rare bright plankton flashes near the break band --------
const SPARK_VERT = /* glsl */ `
attribute float aSeed;
attribute float aTb;      // burst time
uniform float uT;
varying float vA;
void main() {
  float d = uT - aTb;
  float env = (d > 0.0 && d < 0.9) ? exp(-d * 5.0) : 0.0;
  vA = env * (0.6 + 0.4 * sin(uT * 9.0 + aSeed * 80.0));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min((1.6 + fract(aSeed * 7.0) * 2.8) * 240.0 / max(1.0, -mv.z), 7.0);
  gl_Position = projectionMatrix * mv;
}
`;
const SPARK_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.5, 0.95, 1.0) * a, a);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = 0.3 + 0.5 * sin(uT * (0.5 + 1.5 * fract(aSeed * 7.0)) + aSeed * 50.0);
  gl_PointSize = min(1.5 * 240.0 / max(1.0, -mv.z), 4.0);
  gl_Position = projectionMatrix * mv;
}
`;
const STAR_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * a, a);
}
`;

interface BlState {
  seaMat: THREE.ShaderMaterial;
  skyMat: THREE.ShaderMaterial;
  ringMats: THREE.ShaderMaterial[];
  wakeMat: THREE.ShaderMaterial;
  sparkMat: THREE.ShaderMaterial;
  starMat: THREE.ShaderMaterial;
  boat: THREE.Group;
}
const blStates = new WeakMap<SceneContext, BlState>();

const BOAT_X = (t: number) => -13 + Math.max(0, t - 14) * 1.6;
const WAKE_ON = (t: number) => smooth01((t - 14.2) / 1.5);

export default defineScene({
  id: 'bioluminescence/bay',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x01030a);
    const rng = mulberry32(7741);

    // --- sky backdrop + milky way
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uT: { value: 0 } },
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 50), skyMat);
    sky.position.set(0, 16, -30);
    sky.renderOrder = 0;
    sc.add(sky);

    // --- stars
    const NS = 160;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = -55 + rng() * 110;
      sp[i * 3 + 1] = 3 + rng() * 28;
      sp[i * 3 + 2] = -26 - rng() * 4;
      ss[i] = rng() * 100;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.frustumCulled = false;
    stars.renderOrder = 1;
    sc.add(stars);

    // --- sea
    const seaMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: SEA_FRAG,
      uniforms: {
        uT: { value: 0 },
        uCrest0: { value: new THREE.Vector4(1.5, 6.0, 10.5, 15.5) },
        uCrestV: { value: new THREE.Vector4(0.075, 0.10, 0.085, 0.095) },
        uCrestA: { value: new THREE.Vector4(0.55, 1.0, 0.8, 0.9) },
      },
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 18), seaMat);
    sea.position.set(0, -1.2, -14);
    sea.renderOrder = 2;
    sc.add(sea);

    // --- rocks / pilings: dark cylinders + glow rings at water level
    const rockMat = new THREE.MeshBasicMaterial({ color: 0x05060a });
    const ringMats: THREE.ShaderMaterial[] = [];
    const rockXs = [-11, -5.5, 9, 14];
    for (let i = 0; i < rockXs.length; i++) {
      const rock = new THREE.Mesh(new THREE.CylinderGeometry(0.45 + rng() * 0.3, 0.6 + rng() * 0.3, 2.2 + rng() * 1.4, 8), rockMat);
      rock.position.set(rockXs[i]! + (rng() - 0.5), -5.6, -11.5 - rng() * 2);
      sc.add(rock);
      const rm = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: RING_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uEnv: { value: 0 } },
      });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.1), rm);
      ring.position.set(rock.position.x, -6.4, rock.position.z + 0.1);
      ring.renderOrder = 6;
      sc.add(ring);
      ringMats.push(rm);
    }

    // --- dinghy: dark hull silhouette + luminous wake
    const boat = new THREE.Group();
    const hullMat = new THREE.MeshBasicMaterial({ color: 0x030408 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.62, 1.1), hullMat);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 4), hullMat);
    bow.rotation.z = -Math.PI / 2;
    bow.position.x = 1.45;
    const figure = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.6, 4, 8), hullMat);
    figure.position.set(0.2, 0.6, 0);
    boat.add(hull, bow, figure);
    boat.position.set(BOAT_X(0), -5.3, -10.5);
    sc.add(boat);

    const wakeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: WAKE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uOn: { value: 0 } },
    });
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.8), wakeMat);
    wake.renderOrder = 5;
    boat.add(wake);
    wake.position.set(-7.1, -0.4, 0);

    // --- sparkle bursts near the break band
    const NB2 = 140;
    const kp = new Float32Array(NB2 * 3);
    const ks = new Float32Array(NB2);
    const kb = new Float32Array(NB2);
    for (let i = 0; i < NB2; i++) {
      kp[i * 3] = -20 + rng() * 40;
      kp[i * 3 + 1] = -6.8 + rng() * 1.8;
      kp[i * 3 + 2] = -12 - rng() * 3;
      ks[i] = rng() * 100;
      kb[i] = 7 + rng() * 16;   // bursts cluster in beats 2-3
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(kp, 3));
    sparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(ks, 1));
    sparkGeo.setAttribute('aTb', new THREE.BufferAttribute(kb, 1));
    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    sparks.renderOrder = 7;
    sc.add(sparks);

    // --- camera: dense waypoints keyed to this entry's window
    ctx.rig.setLensMm(40);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let i = 0; i <= 24; i++) {
      const wt = ctx.sceneCtx.start + (i / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: i / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    blStates.set(ctx, { seaMat, skyMat, ringMats, wakeMat, sparkMat, starMat, boat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const S = blStates.get(ctx)!;
    S.seaMat.uniforms.uT.value = t;
    S.skyMat.uniforms.uT.value = t;
    S.sparkMat.uniforms.uT.value = t;
    S.starMat.uniforms.uT.value = t;

    // rock rings answer each breaking set with a delayed pulse
    for (let i = 0; i < S.ringMats.length; i++) {
      let env = 0;
      for (const tc of [9.2, 11.8, 17.3, 21.6]) {
        const d = t - (tc + i * 0.3);
        if (d > 0 && d < 4) env += Math.exp(-d * 0.8) * 0.5;
      }
      S.ringMats[i]!.uniforms.uEnv.value = Math.min(0.8, env);
    }

    // dinghy + wake
    S.boat.position.x = BOAT_X(t);
    S.wakeMat.uniforms.uT.value = t;
    S.wakeMat.uniforms.uOn.value = WAKE_ON(t);

    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

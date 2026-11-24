// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene: 'volcano' — a crater at night: rim silhouette, incandescent lava pool
// pulsing with fbm crust cracks, lava bombs on closed-form ballistic arcs with
// hot trails, ember rain, glow-lit ash smoke, faint stars through the haze.

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

// camera: slow push + slight rise so the crater reveals over time
function camPos(t: number): [number, number, number] {
  const p = smooth01(t / 18);
  return [1.6 * Math.sin(0.05 * t), 2.4 + 1.8 * p + 0.3 * Math.sin(0.06 * t + 1.0), 30 - 0.5 * t];
}
function camTarget(t: number): [number, number, number] {
  return [0, -1.5 + 0.5 * smooth01((t - 10) / 8), 0];
}

// --- lava pool: fbm crust cracks glowing between dark plates -----------------
const POOL_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uPulse;

void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float mask = 1.0 - smoothstep(0.85, 1.0, r);

  vec3 p = vec3(c * 3.0, uT * 0.08);
  float crust = fbm3(p, 5, 2.1, 0.55);
  // veins: the level set where crust crosses 0 — a connected crack network
  float crackW = 0.05 + uPulse * 0.05;
  float crack = 1.0 - smoothstep(0.0, crackW, abs(crust));
  float detail = fbm3(p * 3.0 + 7.0, 3, 2.0, 0.5);
  crack = sat(crack * (0.55 + 0.7 * detail));
  float vent = exp(-r * r * 2.2); // molten core near the vent

  // near-black crust plates, white-hot vein cores, breathing pulse
  vec3 plate = vec3(0.02, 0.008, 0.004);
  vec3 glow = mix(vec3(1.0, 0.28, 0.02), vec3(1.0, 0.8, 0.3), crack * crack);
  float heat = (0.5 + 0.5 * uPulse) * (1.0 - 0.3 * r);
  vec3 col = plate + glow * crack * heat * 3.0
           + vec3(1.0, 0.5, 0.12) * vent * (0.4 + 0.6 * uPulse);

  float a = mask;
  gl_FragColor = vec4(col, a);
}
`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- ash smoke: layered billboards rising, lit from below by the pool -------
const SMOKE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uSeed;
uniform float uGlow;
void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  float n = fbm3(vec3(c * 2.4 + uSeed * 13.0, uT * 0.12 + uSeed), 4, 2.0, 0.55);
  float d = sat(n * 0.9 + 0.25 - r * 0.55);
  float a = (1.0 - smoothstep(0.15, 0.9, r)) * d * 0.5;
  // lit from below: warm underlight, kept dim so puffs stay ash not suns
  float lit = sat(-c.y - 0.15) * uGlow;
  vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.5, 0.2, 0.07), lit * d);
  gl_FragColor = vec4(col, a);
}
`;

// --- lava bombs: parabola points + trail ribbons -----------------------------
const BOMB_VERT = /* glsl */ `
attribute float aT0;     // launch time
attribute vec3 aVel;     // launch velocity
attribute float aSeed;
uniform float uT;
uniform float uG;
varying float vHot;
void main() {
  float tau = uT - aT0;
  // loop the ballistic flight: respawn every cycle
  float cyc = 3.0 + fract(aSeed * 5.0) * 2.0;
  tau = mod(max(tau, 0.0), cyc);
  vec3 pos = vec3(aVel.x * tau, aVel.y * tau - 0.5 * uG * tau * tau, aVel.z * tau);
  vHot = exp(-tau * 0.9); // cools as it flies
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(mix(2.5, 9.0, fract(aSeed * 3.0)) * 240.0 / max(1.0, -mv.z), 26.0);
  gl_Position = projectionMatrix * mv;
}
`;
const BOMB_FRAG = /* glsl */ `
varying float vHot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * vHot;
  if (a < 0.004) discard;
  vec3 col = mix(vec3(0.6, 0.08, 0.0), vec3(1.0, 0.85, 0.4), vHot);
  gl_FragColor = vec4(col * a, a);
}
`;

// same parabola, drawn as short streaks (line trail behind each bomb)
const TRAIL_VERT = /* glsl */ `
attribute float aT0;
attribute vec3 aVel;
attribute float aSeed;
attribute float aBack;   // 0 = head, 1 = tail sample behind in time
uniform float uT;
uniform float uG;
varying float vHot;
varying float vBack;
void main() {
  float tau = uT - aT0;
  float cyc = 3.0 + fract(aSeed * 5.0) * 2.0;
  tau = mod(max(tau, 0.0), cyc);
  float tb = max(tau - aBack * 0.22, 0.0);
  vec3 pos = vec3(aVel.x * tb, aVel.y * tb - 0.5 * uG * tb * tb, aVel.z * tb);
  vHot = exp(-tb * 0.9);
  vBack = aBack;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;
const TRAIL_FRAG = /* glsl */ `
varying float vHot;
varying float vBack;
void main() {
  float a = vHot * (1.0 - vBack) * 0.8;
  gl_FragColor = vec4(vec3(1.0, 0.5, 0.15) * a, a);
}
`;

// --- ember rain: falling sparks ----------------------------------------------
const EMBER_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
uniform float uRain;
varying float vA;
void main() {
  vec3 p = position;
  float cyc = 6.0 + fract(aSeed * 7.0) * 4.0;
  float tau = mod(uT + aSeed * cyc, cyc);
  p.y = 14.0 - tau * 3.0;
  p.x += sin(uT * 1.7 + aSeed * 40.0) * 0.6;
  vA = uRain * (0.35 + 0.65 * sin(uT * (2.0 + 3.0 * fract(aSeed * 3.0)) + aSeed * 60.0))
       * (1.0 - smoothstep(11.0, 14.0, p.y)) * smoothstep(-2.0, 2.0, p.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min(1.6 * 240.0 / max(1.0, -mv.z), 5.0);
  gl_Position = projectionMatrix * mv;
}
`;
const EMBER_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * a, a);
}
`;

// --- crater rim: fbm ridgeline silhouette across the lower frame -------------
const RIDGE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  float x = vUv.x * 6.0;
  float edge = 0.55 + fbm3(vec3(x, 0.0, 3.0), 4, 2.0, 0.55) * 0.10
             + fbm3(vec3(x * 4.0, 9.0, 0.0), 3, 2.0, 0.5) * 0.05;
  float a = 1.0 - smoothstep(edge - 0.01, edge, vUv.y);
  // faint hot rim where the lip catches pool light
  float lit = (1.0 - smoothstep(edge - 0.12, edge, vUv.y)) * a;
  vec3 col = mix(vec3(0.012, 0.008, 0.02), vec3(0.5, 0.16, 0.05), lit * 0.7);
  gl_FragColor = vec4(col, a);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
uniform float uHaze;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = (0.3 + 0.5 * sin(uT * (0.6 + 1.5 * fract(aSeed * 7.0)) + aSeed * 50.0)) * (1.0 - uHaze);
  gl_PointSize = min(1.4 * 240.0 / max(1.0, -mv.z), 4.0);
  gl_Position = projectionMatrix * mv;
}
`;
const STAR_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.75, 0.8, 1.0) * a, a);
}
`;

interface VState {
  ridgeMat: THREE.ShaderMaterial;
  poolMat: THREE.ShaderMaterial;
  smokeMats: THREE.ShaderMaterial[];
  bombMat: THREE.ShaderMaterial;
  trailMat: THREE.ShaderMaterial;
  emberMat: THREE.ShaderMaterial;
  starMat: THREE.ShaderMaterial;
}
const vStates = new WeakMap<SceneContext, VState>();

export default defineScene({
  id: 'volcano/crater',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x030208);

    const rng = mulberry32(555);

    // --- crater rim: jagged silhouette band across the lower frame
    const ridgeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: RIDGE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 } },
    });
    const ridge = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), ridgeMat);
    ridge.position.set(0, -11.0, 12);
    ridge.renderOrder = 6;
    sc.add(ridge);

    // --- lava pool: glowing disc inside the crater
    const poolMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: POOL_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 }, uPulse: { value: 0.5 } },
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), poolMat);
    pool.rotation.x = -Math.PI / 2 + 0.35;
    pool.position.set(0, -3.2, 2.0);
    pool.renderOrder = 3;
    sc.add(pool);

    // --- ash smoke: 4 billboards stacked above the vent
    const smokeMats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uT: { value: 0 },
          uSeed: { value: i * 1.7 + 1.0 },
          uGlow: { value: 0.5 },
        },
      });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(16 + i * 7, 10 + i * 4), m);
      s.position.set((i - 1.5) * 1.8 + (rng() - 0.5), 2.5 + i * 3.2, -2 - i * 2);
      s.renderOrder = 8 + i;
      sc.add(s);
      smokeMats.push(m);
    }

    // --- lava bombs: 60 ballistic points + line trails
    const NB = 60;
    const t0 = new Float32Array(NB);
    const vel = new Float32Array(NB * 3);
    const seed = new Float32Array(NB);
    const orig = new Float32Array(NB * 3);
    for (let i = 0; i < NB; i++) {
      const s = rng();
      seed[i] = s;
      t0[i] = rng() * 8 + 5.0;             // launches begin ~t5
      const az = rng() * Math.PI * 2;
      const sp = 5.5 + rng() * 5.5;
      const vy = 6.5 + rng() * 6.0;
      vel[i * 3] = Math.cos(az) * sp * 0.5;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = Math.sin(az) * sp * 0.5 - 1.0;
      orig[i * 3] = 0; orig[i * 3 + 1] = -3.0; orig[i * 3 + 2] = 2.0;
    }
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.BufferAttribute(orig, 3));
    bGeo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    bGeo.setAttribute('aT0', new THREE.BufferAttribute(t0, 1));
    bGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const bombMat = new THREE.ShaderMaterial({
      vertexShader: BOMB_VERT,
      fragmentShader: BOMB_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uG: { value: 9.8 * 0.55 } },
    });
    const bombs = new THREE.Points(bGeo, bombMat);
    bombs.frustumCulled = false;
    bombs.renderOrder = 14;
    sc.add(bombs);

    // trails: 6 line segments behind each bomb
    const ltPos = new Float32Array(NB * 6 * 2 * 3);
    const ltVel = new Float32Array(NB * 6 * 2 * 3);
    const ltT0 = new Float32Array(NB * 6 * 2);
    const ltSeed = new Float32Array(NB * 6 * 2);
    const ltBack = new Float32Array(NB * 6 * 2);
    let k = 0;
    for (let i = 0; i < NB; i++) {
      for (let j = 0; j < 6; j++) {
        for (let e = 0; e < 2; e++) {
          ltPos[k * 3] = orig[i * 3]; ltPos[k * 3 + 1] = orig[i * 3 + 1]; ltPos[k * 3 + 2] = orig[i * 3 + 2];
          ltVel[k * 3] = vel[i * 3]; ltVel[k * 3 + 1] = vel[i * 3 + 1]; ltVel[k * 3 + 2] = vel[i * 3 + 2];
          ltT0[k] = t0[i];
          ltSeed[k] = seed[i];
          ltBack[k] = (j + e) / 6;
          k++;
        }
      }
    }
    const ltGeo = new THREE.BufferGeometry();
    ltGeo.setAttribute('position', new THREE.BufferAttribute(ltPos, 3));
    ltGeo.setAttribute('aVel', new THREE.BufferAttribute(ltVel, 3));
    ltGeo.setAttribute('aT0', new THREE.BufferAttribute(ltT0, 1));
    ltGeo.setAttribute('aSeed', new THREE.BufferAttribute(ltSeed, 1));
    ltGeo.setAttribute('aBack', new THREE.BufferAttribute(ltBack, 1));
    const trailMat = new THREE.ShaderMaterial({
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uG: { value: 9.8 * 0.55 } },
    });
    const trails = new THREE.LineSegments(ltGeo, trailMat);
    trails.frustumCulled = false;
    trails.renderOrder = 13;
    sc.add(trails);

    // --- ember rain
    const NE = 350;
    const ep = new Float32Array(NE * 3);
    const es = new Float32Array(NE);
    for (let i = 0; i < NE; i++) {
      es[i] = rng();
      ep[i * 3] = (rng() - 0.5) * 50;
      ep[i * 3 + 1] = rng() * 14;
      ep[i * 3 + 2] = (rng() - 0.5) * 30 - 5;
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    eGeo.setAttribute('aSeed', new THREE.BufferAttribute(es, 1));
    const emberMat = new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uRain: { value: 0 } },
    });
    const embers = new THREE.Points(eGeo, emberMat);
    embers.frustumCulled = false;
    embers.renderOrder = 15;
    sc.add(embers);

    // --- stars through the haze
    const NS = 350;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      ss[i] = rng();
      sp[i * 3] = (rng() - 0.5) * 160;
      sp[i * 3 + 1] = 8 + rng() * 60;
      sp[i * 3 + 2] = -50 - rng() * 60;
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uHaze: { value: 0.4 } },
    });
    const stars = new THREE.Points(sGeo, starMat);
    stars.renderOrder = 1;
    sc.add(stars);

    ctx.rig.setLensMm(40);
    // register the flight path so non-rendering samplers (God-View) see it
    const wps = [];
    for (let i = 0; i <= 8; i++) wps.push({ t: i / 8, pos: camPos(i / 8 * 24), target: camTarget(i / 8 * 24) });
    ctx.rig.setPath(wps);
    ctx.rig.position = camPos(0);
    ctx.rig.target = camTarget(0);
    ctx.updateCamera(0, 0);
    vStates.set(ctx, { ridgeMat, poolMat, smokeMats, bombMat, trailMat, emberMat, starMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    // beats: breathe (pool pulses slowly) → fountain swells (bombs) → rain fire
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
    const swell = smooth01((t - 6) / 5);
    const rain = smooth01((t - 15) / 4);

    const S = vStates.get(ctx)!;
    S.ridgeMat.uniforms.uT.value = t;
    S.poolMat.uniforms.uT.value = t;
    S.poolMat.uniforms.uPulse.value = pulse * (0.6 + 0.4 * swell);
    for (const m of S.smokeMats) {
      m.uniforms.uT.value = t;
      m.uniforms.uGlow.value = 0.35 + 0.45 * pulse * swell;
    }
    S.bombMat.uniforms.uT.value = t;
    S.trailMat.uniforms.uT.value = t;
    S.emberMat.uniforms.uT.value = t;
    S.emberMat.uniforms.uRain.value = rain;
    S.starMat.uniforms.uT.value = t;
    S.starMat.uniforms.uHaze.value = 0.25 + 0.45 * swell;

    ctx.rig.position = camPos(t);
    ctx.rig.target = camTarget(t);
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// cavernecho — a limestone cavern with a dripping pool and a beam of
// cave-mouth light. Backdrop quad: near-black limestone gradient, seeded
// stalactite/stalagmite silhouettes layered into darkness, wet-rock sheen
// streaks, and a diagonal light shaft from upper-right with drifting dust.
// Pool band quad: dark water, mirror column under the shaft, and an
// 8-slot ring uniform array — each ring a world-projected foreshortened
// ellipse that cross-cuts (dims) the older rings it overlaps.
// One points cloud carries shaft dust motes, closed-form droplets
// (gather → parabolic fall → plop → rest, gated by a chorus envelope),
// a bat silhouette crossing the shaft once, and a salamander shade on the
// floor band during the quiet beat — all closed-form f(t), no sim.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

// shared constants duplicated in TS (camera guides + ring feeding) and GLSL.
const POOL_Y = -4.5;       // waterline — pool band's top edge
const POOL_Z = -13.0;      // pool band plane z
const POOL_H = 8.0;        // pool band height
const QUAD_W = 90.0;       // backdrop and pool share this width
const SHAFT_X = 14.4;      // world x where the shaft lands (backdrop uv 0.66)
const BAT_T = 10.6;        // bat crossing start
const SAL_T = 19.6;        // salamander scuttle start

// chorus envelope: sparse drips → full chorus → deepest quiet.
// mirrored in the vertex shader — the same value gates drop cycles there
// and ring feeding in render().
function chorus(t: number): number {
  const up = 0.30 + 0.70 * Math.min(1, Math.max(0, (t - 6) / 6));
  const down = Math.min(1, Math.max(0, (t - 16.5) / 3.0));
  return up * (1 - 0.78 * down) + 0.02;
}

function camPos(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 0.5) / 22));
  return [-0.8 + 3.6 * s + 0.15 * Math.sin(t * 0.11), 0.4 - 1.2 * s, 15.5 - 4.5 * s];
}
function camTarget(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 0.5) / 22));
  return [4.5 - 0.5 * s + 0.3 * Math.sin(t * 0.07), -1.2 - 1.3 * s, -18];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- backdrop: cavern walls, stalactites, shaft, wet sheen -------------------
const BACK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;

float hashc(float c, float s) { return fract(sin(c * 127.1 + s * 311.7) * 43758.5); }

// tapered column silhouette: 1 inside, 0 outside.
// hangs from y=1 narrowing to a point at tip (tip < 1), or rises from y=0
// narrowing upward to tip (flip > 0.5).
float column(float x, float y, float c, float w, float tip, float flip) {
  float u = flip > 0.5 ? 1.0 - y : y;                 // 0 at far end, 1 at root
  float t = clamp((u - (flip > 0.5 ? 1.0 - tip : tip)) / (flip > 0.5 ? tip : 1.0 - tip), 0.0, 1.0);
  float wid = w * t;
  float wob = 0.35 * fbm3(vec3(y * 9.0, c * 7.0, 0.0), 2, 2.0, 0.5) * w;
  return (1.0 - smoothstep(wid * 0.6, wid * 1.05, abs(x - c + wob)))
       * step(flip > 0.5 ? 1.0 - tip : tip, flip > 0.5 ? 1.0 - y : y);
}

void main() {
  vec2 uv = vUv;
  // limestone base: near-black, faint warm cave-mouth glow upper-right
  vec3 col = mix(vec3(0.010, 0.012, 0.018), vec3(0.030, 0.034, 0.048),
                 smoothstep(0.1, 0.9, uv.y));
  // broad rock shading so the walls aren't a flat gradient
  col += vec3(0.014, 0.016, 0.022) * fbm3(vec3(uv.x * 7.0, uv.y * 3.0, 0.0), 3, 2.0, 0.5);
  float mouth = exp(-pow((uv.x - 1.04) * 6.0, 2.0) - pow((uv.y - 1.06) * 4.5, 2.0));
  col += vec3(0.42, 0.44, 0.40) * mouth * 0.7;

  // light shaft: diagonal beam from upper-right, soft-edged band
  vec2 d = normalize(vec2(-0.38, -0.925));
  vec2 anchor = vec2(1.04, 1.08);
  vec2 r = uv - anchor;
  float along = dot(r, d);
  float across = abs(r.x * d.y - r.y * d.x);
  // two-component beam: bright core + wide faint halo
  float beam = exp(-across * across * 240.0) * smoothstep(0.0, 0.06, along);
  float halo = exp(-across * across * 60.0) * smoothstep(0.0, 0.03, along);
  beam *= 0.82 + 0.18 * sin(across * 160.0 + uT * 0.15);
  col += vec3(0.55, 0.58, 0.52) * (beam * 0.42 + halo * 0.05);

  // stalactites hanging from the ceiling, two depth layers
  float shade = 0.0, shade2 = 0.0;
  for (int i = 0; i < 14; i++) {
    float c = hashc(float(i) + 0.5, 3.1);
    float w = 0.016 + 0.034 * hashc(float(i) + 2.7, 9.3);
    float tip = 0.30 + 0.36 * hashc(float(i) + 5.1, 17.7);
    shade = max(shade, column(uv.x, uv.y, c, w, tip, 0.0));
  }
  for (int i = 0; i < 7; i++) {
    float c = hashc(float(i) + 4.9, 23.9) * 0.9 + 0.05;
    float w = 0.030 + 0.046 * hashc(float(i) + 8.3, 31.1);
    float tip = 0.55 + 0.26 * hashc(float(i) + 1.3, 41.3);
    shade2 = max(shade2, column(uv.x, uv.y, c, w, tip, 0.0));
  }
  // stalagmites rising from the floor band
  for (int i = 0; i < 6; i++) {
    float c = hashc(float(i) + 7.7, 53.7) * 0.85 + 0.08;
    float w = 0.030 + 0.034 * hashc(float(i) + 3.9, 61.9);
    float tip = 0.10 + 0.16 * hashc(float(i) + 9.1, 71.3);
    shade2 = max(shade2, column(uv.x, uv.y, c, w, tip, 1.0));
  }
  // far layer silhouettes a touch lighter than the near-black front set
  col = mix(col, vec3(0.026, 0.030, 0.044), shade2 * 0.9);
  col = mix(col, vec3(0.004, 0.005, 0.010), shade);

  // rim-light the column edges: partial-coverage band from the smoothstep
  float rim = 4.0 * max(shade * (1.0 - shade), shade2 * (1.0 - shade2));
  col += vec3(0.30, 0.33, 0.32) * rim * (0.10 + 1.4 * beam);

  // wet-rock sheen: vertical specular streaks, strongest inside the beam
  float sheenN = 0.5 + 0.5 * fbm3(vec3(uv.x * 38.0, uv.y * 3.0, 0.0), 2, 2.0, 0.5);
  float sheen = sheenN * sheenN * sheenN * smoothstep(0.45, 0.9, uv.y);
  col += vec3(0.10, 0.11, 0.10) * sheen * (0.25 + 2.2 * beam);

  // faint mist band hanging over the floor
  float mist = exp(-pow((uv.y - 0.10) * 9.0, 2.0))
             * (0.5 + 0.5 * fbm3(vec3(uv.x * 6.0 - uT * 0.03, 2.0, 0.0), 2, 2.0, 0.5));
  col += vec3(0.05, 0.06, 0.07) * mist * 0.3;

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- pool band: dark water, shaft mirror column, drip rings -------------------
const POOL_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform vec3 uCam;
uniform vec3 uRings[8];  // x = drop world x, y = drop world z, z = plop time

float hashc(float c, float s) { return fract(sin(c * 127.1 + s * 311.7) * 43758.5); }

void main() {
  // still dark water: near-black with a faint cool gradient toward the far edge
  vec3 col = mix(vec3(0.010, 0.013, 0.020), vec3(0.022, 0.026, 0.040),
                 smoothstep(0.0, 1.0, vUv.y));

  // mirror column under the shaft landing — project the world landing point
  // through the camera onto this plane; billboard uv is not a screen fraction
  float sM = (uCam.z - (${POOL_Z.toFixed(1)})) / (uCam.z - (-30.0));
  float wx = uCam.x + sM * (${SHAFT_X.toFixed(1)} - uCam.x);
  float cx = 0.5 + wx / ${QUAD_W.toFixed(1)};
  float wob = fbm3(vec3(vUv.y * 30.0 + uT * 0.8, 3.0, 0.0), 2, 2.0, 0.5) * 0.006;
  float streak = exp(-pow((vUv.x - cx - wob) * 16.0, 2.0));
  float streakN = 0.5 + 0.5 * fbm3(vec3(vUv.y * 55.0 - uT * 0.7, 5.0, 0.0), 2, 2.0, 0.5);
  streak *= 0.55 + 0.45 * streakN * streakN;
  streak *= smoothstep(0.0, 0.25, vUv.y);
  col += vec3(0.30, 0.33, 0.34) * streak * 0.30;

  // faint scattered shimmer
  float shim = 0.5 + 0.5 * fbm3(vec3(vUv.x * 60.0, vUv.y * 24.0 + uT * 0.4, 0.0), 2, 2.0, 0.5);
  col += vec3(0.05, 0.06, 0.08) * shim * shim * shim * shim;

  // drip rings: each a world-space expanding circle, projected through the
  // camera as a foreshortened ellipse (near/far edges), cross-cutting
  // older rings where a newer wavefront overlaps them.
  float age[8];
  float pd[8];
  for (int i = 0; i < 8; i++) {
    age[i] = -1.0;
    pd[i] = 1e5;
    float t0 = uRings[i].z;
    if (t0 < 0.0) continue;
    age[i] = uT - t0;
    if (age[i] <= 0.0 || age[i] > 4.0) { age[i] = -1.0; continue; }
    float rw = min(age[i] * 1.7, 3.4);
    float zc = uRings[i].y;
    float sN = (uCam.z - (${POOL_Z.toFixed(1)})) / (uCam.z - (zc + rw));
    float sF = (uCam.z - (${POOL_Z.toFixed(1)})) / (uCam.z - (zc - rw));
    float yN = (uCam.y + sN * (${POOL_Y.toFixed(2)} - uCam.y) - (${POOL_Y.toFixed(2)} - ${POOL_H.toFixed(1)})) / ${POOL_H.toFixed(1)};
    float yF = (uCam.y + sF * (${POOL_Y.toFixed(2)} - uCam.y) - (${POOL_Y.toFixed(2)} - ${POOL_H.toFixed(1)})) / ${POOL_H.toFixed(1)};
    float sP = (uCam.z - (${POOL_Z.toFixed(1)})) / (uCam.z - zc);
    vec2 pc = vec2(0.5 + (uCam.x + sP * (uRings[i].x - uCam.x)) / ${QUAD_W.toFixed(1)},
                   0.5 * (yN + yF));
    vec2 rr = vec2(sP * rw / ${QUAD_W.toFixed(1)}, max(1e-4, 0.5 * abs(yF - yN)));
    pd[i] = length((vUv - pc) / rr);
  }
  for (int i = 0; i < 8; i++) {
    if (age[i] < 0.0) continue;
    // rim brightness with a soft falloff, fading over life
    float rd = (pd[i] - 1.0) / 0.09;
    float rim = exp(-rd * rd);
    float att = 1.0 - age[i] / 4.0;
    // cross-cut: a newer ring dims the arcs inside its disc
    for (int j = 0; j < 8; j++) {
      if (j == i || age[j] < 0.0 || uRings[j].z <= uRings[i].z) continue;
      float inside = 1.0 - smoothstep(0.7, 1.0, pd[j]);
      rim *= 1.0 - 0.65 * inside;
    }
    col += vec3(0.20, 0.24, 0.28) * rim * att * 1.3;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- points: dust, droplets, bat, salamander ---------------------------------
const PT_VERT = /* glsl */ `
${GLSL_NOISE}
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;      // t0/off, rate/fall, amp/gather, phase
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;
uniform float uT;
uniform float uPx;

// chorus envelope — must mirror chorus() in TS: sparse → full → quiet
float chorusEnv(float t) {
  float up = 0.30 + 0.70 * clamp((t - 6.0) / 6.0, 0.0, 1.0);
  float down = clamp((t - 16.5) / 3.0, 0.0, 1.0);
  return up * (1.0 - 0.78 * down) + 0.02;
}

void main() {
  float t0 = aAux.x;
  float rate = aAux.y;
  float amp = aAux.z;
  float ph = aAux.w;
  vec3 pos = position;
  float alpha = 1.0;
  float size = 1.0;
  vFlap = 0.0;

  if (aKind < 0.5) {
    // shaft dust: slow drift along the beam direction + seeded wobble
    float drift = mod(uT * rate + ph * 10.0, 14.0);
    pos = position + vec3(-0.38, -0.925, 0.0) * drift
        + vec3(0.2 * sin(uT * 0.3 + ph), 0.1 * sin(uT * 0.5 + ph * 2.0), 0.0);
    alpha = 0.16 + 0.10 * sin(uT * 0.6 + ph * 3.0);
    size = 0.10 + fract(aSeed * 3.3) * 0.14;
  } else if (aKind < 1.5) {
    // droplet: gather at the tip → parabolic fall → plop flash → rest
    float gather = amp;              // gather duration (s)
    float fall = rate;               // fall duration (s)
    float rest = ph;                 // rest duration (s)
    float cyc = gather + fall + rest;
    float off = t0;
    float pc = mod(uT - off, cyc);
    float cs = uT - pc;              // cycle start
    float open = step(fract(aSeed * 7.0), chorusEnv(cs));
    float dropH = position.y - (${POOL_Y.toFixed(2)});
    if (pc < gather) {
      // bead swells at the tip
      float g = pc / gather;
      alpha = open * 0.55 * smoothstep(0.2, 0.9, g);
      size = 0.30 + 0.40 * g;
    } else if (pc < gather + fall) {
      float f = (pc - gather) / fall;
      pos.y = position.y - dropH * f * f;
      alpha = open;
      size = 0.42;
    } else if (pc < gather + fall + 0.18) {
      // plop flash at the waterline
      pos.y = ${POOL_Y.toFixed(2)} + 0.05;
      float p = (pc - gather - fall) / 0.18;
      alpha = open * (1.0 - p) * 1.6;
      size = 0.55 + 0.9 * p;
    } else {
      alpha = 0.0;
      size = 0.01;
    }
  } else if (aKind < 2.5) {
    // bat: crosses the shaft once, wing-beat envelope
    float ot = uT - t0;
    pos = vec3(position.x - ot * rate,
               position.y + 0.35 * sin(ot * 1.1 + ph) - 0.15 * ot,
               position.z);
    vFlap = sin(ot * 9.0 + ph);
    alpha = smoothstep(0.0, 0.8, ot) * (1.0 - smoothstep(3.4, 4.4, ot));
    size = 4.2;
  } else {
    // salamander shade: scuttles along the floor band during the quiet beat
    float ot = uT - t0;
    float scut = ot + 0.10 * sin(ot * 9.0) * step(0.5, fract(ot * 3.0));
    pos = vec3(position.x + scut * rate,
               position.y + 0.06 * abs(sin(ot * 9.0)),
               position.z);
    alpha = smoothstep(0.0, 0.7, ot) * (1.0 - smoothstep(2.6, 3.6, ot));
    size = 2.6;
  }

  vA = alpha;
  vKind = aKind;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 300.0 * uPx / max(1.0, -mv.z), 260.0 * uPx);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0); // cull dead sprites
}
`;

const PT_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  vec3 col; float a;
  if (vKind < 0.5) {
    // dust mote: tiny soft warm speck
    float core = exp(-d * d * 90.0);
    col = vec3(0.75, 0.78, 0.70);
    a = core * vA;
  } else if (vKind < 1.5) {
    // droplet: bright cool bead, slight streak during fall
    vec2 e = vec2(q.x * 1.6, q.y * 0.9);
    float body = exp(-dot(e, e) * 180.0);
    col = vec3(0.62, 0.72, 0.80);
    a = body * vA * 1.4;
  } else if (vKind < 2.5) {
    // bat silhouette: v-wing stroke with flap + small body disc
    float v = q.y + abs(q.x) * (0.34 + 0.20 * vFlap) - 0.04;
    float wings = 1.0 - smoothstep(0.02, 0.06, abs(v));
    float body = 1.0 - smoothstep(0.05, 0.10, length(vec2(q.x * 1.6, q.y * 2.2)));
    col = vec3(0.004, 0.005, 0.010);
    a = max(wings, body) * vA;
  } else {
    // salamander shade: low elongated body + tapering tail
    float body = 1.0 - smoothstep(0.10, 0.20, length(vec2(q.x * 0.85, q.y * 3.2)) - 0.18);
    float tail = (1.0 - smoothstep(0.02, 0.05, abs(q.y))) * step(q.x, -0.10) * smoothstep(-0.5, -0.15, q.x);
    col = vec3(0.006, 0.008, 0.014);
    a = max(body, tail * 0.8) * vA;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

interface DropSpec {
  tipX: number; tipY: number; tipZ: number;
  off: number; gather: number; fall: number; rest: number; seed: number;
}

interface CavState {
  backMat: THREE.ShaderMaterial;
  poolMat: THREE.ShaderMaterial;
  ptMat: THREE.ShaderMaterial;
  silMat: THREE.ShaderMaterial;
  drops: DropSpec[];
}
const cavStates = new WeakMap<SceneContext, CavState>();

export default defineScene({
  id: 'cavernecho/cavern',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x030407);
    const rng = mulberry32(60221);

    // --- backdrop quad: cavern walls, shaft, stalactites
    const backMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BACK_FRAG,
      depthWrite: false,
      uniforms: { uT: { value: 0 } },
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 46), backMat);
    back.position.set(0, 6, -30);
    back.renderOrder = 0;
    sc.add(back);

    // --- pool band quad: still water, mirror column, drip rings
    const ringInit: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) ringInit.push(new THREE.Vector3(0, 0, -1));
    const poolMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: {
        uT: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uRings: { value: ringInit },
      },
    });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(90, POOL_H), poolMat);
    pool.position.set(0, POOL_Y - POOL_H / 2, POOL_Z);
    pool.renderOrder = 1;
    sc.add(pool);

    // --- points cloud: dust + droplets (additive), bat + salamander
    // (NormalBlending — additive light can't silhouette)
    const ND = 42, NR = 14, N = ND + NR;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const kind = new Float32Array(N);
    const aux = new Float32Array(N * 4);
    const posS = new Float32Array(6);
    const seedS = new Float32Array(2);
    const kindS = new Float32Array(2);
    const auxS = new Float32Array(8);
    const drops: DropSpec[] = [];
    let i = 0;
    const put = (x: number, y: number, z: number, k: number, s: number,
                 t0 = 0, v = 0, amp = 0, ph = 0) => {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = amp; aux[i * 4 + 3] = ph;
      i++;
    };

    // dust motes inside the shaft volume (world anchor upper-right)
    for (let dI = 0; dI < ND; dI++) {
      const s = rng() * 14;                       // offset along the beam
      const jx = (rng() - 0.5) * 2.6;
      const jy = (rng() - 0.5) * 1.6;
      put(16.5 + jx + s * -0.38, 10.5 + jy + s * -0.925, -25 + rng() * 4,
          0, rng() * 100, 0, 0.18 + rng() * 0.25, 0, rng() * Math.PI * 2);
    }
    // droplets: seeded tips under the stalactite zone, biased toward the shaft
    for (let dI = 0; dI < NR; dI++) {
      const tipX = -7 + rng() * 20 + (dI % 3) * 1.4;
      const tipY = 1.2 + rng() * 3.4;
      const tipZ = -15.5 - rng() * 3.0;
      const gather = 1.6 + rng() * 2.6;
      const fall = Math.sqrt(2 * (tipY - POOL_Y) / (7 + rng() * 5));
      const rest = 0.8 + rng() * 3.0;
      const s = rng() * 100;
      const off = rng() * (gather + fall + rest);
      put(tipX, tipY, tipZ, 1, s, off, fall, gather, rest);
      drops.push({ tipX, tipY, tipZ, off, gather, fall, rest, seed: s });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT,
      fragmentShader: PT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    });
    const pts = new THREE.Points(geo, ptMat);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    sc.add(pts);

    // silhouettes on their own material: the bat and the salamander
    const sil = [
      // bat: starts off-frame right of the shaft, crosses left at BAT_T
      { x: 16.0, y: 4.6, z: -20, k: 2, s: rng() * 100, t0: BAT_T, v: 5.2, amp: 0, ph: rng() * 6.28 },
      // salamander: floor band, scuttles during the quiet beat
      { x: -4.0, y: -4.15, z: -12.5, k: 3, s: rng() * 100, t0: SAL_T, v: 1.9, amp: 0, ph: 0 },
    ];
    sil.forEach((p, j) => {
      posS[j * 3] = p.x; posS[j * 3 + 1] = p.y; posS[j * 3 + 2] = p.z;
      seedS[j] = p.s; kindS[j] = p.k;
      auxS[j * 4] = p.t0; auxS[j * 4 + 1] = p.v; auxS[j * 4 + 2] = p.amp; auxS[j * 4 + 3] = p.ph;
    });
    const silGeo = new THREE.BufferGeometry();
    silGeo.setAttribute('position', new THREE.BufferAttribute(posS, 3));
    silGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedS, 1));
    silGeo.setAttribute('aKind', new THREE.BufferAttribute(kindS, 1));
    silGeo.setAttribute('aAux', new THREE.BufferAttribute(auxS, 4));
    const silMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT,
      fragmentShader: PT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    });
    const silPts = new THREE.Points(silGeo, silMat);
    silPts.frustumCulled = false;
    silPts.renderOrder = 3;
    sc.add(silPts);

    // --- camera: slow creep toward the shaft
    ctx.rig.setLensMm(50);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let w = 0; w <= 24; w++) {
      const wt = ctx.sceneCtx.start + (w / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: w / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    cavStates.set(ctx, { backMat, poolMat, ptMat, silMat, drops });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const st = cavStates.get(ctx)!;
    st.backMat.uniforms.uT.value = t;
    st.poolMat.uniforms.uT.value = t;
    st.ptMat.uniforms.uT.value = t;
    st.silMat.uniforms.uT.value = t;
    ctx.updateCamera(t, f.p);
    const cp = ctx.rig.position;
    (st.poolMat.uniforms.uCam.value as THREE.Vector3).set(cp[0], cp[1], cp[2]);
    st.ptMat.uniforms.uPx.value = out.height / 1080;
    st.silMat.uniforms.uPx.value = out.height / 1080;

    // feed the 8 most recent plops — same closed-form cycle as the vertex
    // shader, gated by the same chorus envelope
    const rings = st.poolMat.uniforms.uRings.value as THREE.Vector3[];
    const act: { x: number; z: number; t0: number }[] = [];
    for (const d of st.drops) {
      const cyc = d.gather + d.fall + d.rest;
      const bucket = ((d.seed * 7.0) % 1 + 1) % 1;
      const k = Math.floor((t - d.off) / cyc);
      for (let m = Math.max(0, k - 1); m <= k; m++) {
        const cs = d.off + m * cyc;
        if (cs < 0) continue;
        if (bucket >= chorus(cs)) continue;
        const plopT = cs + d.gather + d.fall;
        const age = t - plopT;
        if (age > 0 && age <= 4.0) act.push({ x: d.tipX, z: d.tipZ, t0: plopT });
      }
    }
    act.sort((a, b) => b.t0 - a.t0);
    for (let i2 = 0; i2 < 8; i2++) {
      const r = rings[i2];
      if (i2 < act.length) r.set(act[i2].x, act[i2].z, act[i2].t0);
      else r.set(0, 0, -1);
    }
    ctx.flush(out, true);
  },
});

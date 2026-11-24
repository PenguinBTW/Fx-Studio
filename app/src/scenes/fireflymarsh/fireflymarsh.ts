// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// fireflymarsh — fireflies rising over a moonlit marsh at blue hour.
// Backdrop quad: indigo gradient with a fading afterglow strip, moon + halo,
// hash stars, fbm treeline, seeded cattail clumps swaying on wind envelopes.
// Water band quad: mirrored sky gradient, moon glint column, ripple shimmer,
// one expanding frog-plop ring. One points cloud carries ~110 fireflies on
// Lissajous drift paths with per-seed flash rhythms (slow brighten, sharp
// falloff), seed-synced water smears, hero fireflies with bloom halos, and a
// single owl crossing during the calm beat — all closed-form f(t), no sim.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

// shared constants duplicated in TS (camera guides) and GLSL.
const WATER_Y = -3.0;      // waterline — water band's top edge
const PLOP_T = 19.0;       // frog plop time
const PLOP = { x: 1.5, z: -9.0 }; // plop centre on the water (world)
const MOON_X = 16.2;       // moon world x on the backdrop (uv 0.68 × 90 wide)
const MOON_Y = 5.36;       // moon world y (uv 0.58 → 2 + 0.08 × 42)
const MOON_Z = -32.0;      // backdrop plane z
const WATER_Z = -14.0;     // water band plane z
const QUAD_W = 90.0;       // both quads share this width
const WATER_H = 8.0;       // water band height

// chorus: first flashes → full chorus → sudden still → rekindle
function camPos(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 1) / 21));
  return [-2.6 + 5.4 * s + 0.2 * Math.sin(t * 0.09), 0.9 - 0.5 * s, 20 - 2.5 * s];
}
function camTarget(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 1) / 21));
  return [0.4 * Math.sin(t * 0.07) + 1.4 * s, -1.9 - 0.4 * s, -9];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- backdrop: blue-hour sky, moon, stars, treeline, cattail clumps --------
const BACK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;

float hashc(float c, float s) { return fract(sin(c * 127.1 + s * 311.7) * 43758.5); }

// distance to a 2d segment
float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(1e-5, dot(ba, ba)), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  // blue-hour gradient: deep indigo top, violet mid, amber afterglow strip
  // hugging the horizon, dimming through act one (last light).
  float dark = smoothstep(0.0, 9.0, uT);
  vec3 top = vec3(0.012, 0.020, 0.058);
  vec3 mid = vec3(0.055, 0.075, 0.160);
  vec3 col = mix(mid, top, smoothstep(0.42, 1.0, vUv.y));
  float glow = 1.0 - smoothstep(0.30, 0.52, vUv.y);
  vec3 amber = vec3(0.62, 0.30, 0.10) * glow * (1.0 - dark * 0.72);
  col += amber * smoothstep(0.16, 0.34, vUv.y);

  // stars: hash grid, fading in as the sky darkens
  vec2 cell = floor(vUv * vec2(240.0, 120.0));
  float sh = hashc(cell.x, cell.y);
  vec2 sub = fract(vUv * vec2(240.0, 120.0)) - 0.5;
  float star = step(0.990, sh) * exp(-dot(sub, sub) * 60.0);
  star *= (0.5 + 0.5 * dark) * step(0.44, vUv.y);
  star *= 0.7 + 0.3 * sin(uT * (1.0 + sh * 3.0) + sh * 90.0);
  col += vec3(0.75, 0.80, 0.95) * star;

  // moon: disc + halo, brightening as night settles; waning crescent via
  // an offset shadow disc.
  vec2 mc = vec2(0.68, 0.58);
  float md = length((vUv - mc) * vec2(1.6, 1.0));
  float moon = 1.0 - smoothstep(0.030, 0.036, md);
  float bite = 1.0 - smoothstep(0.030, 0.034, length((vUv - mc - vec2(0.011, 0.006)) * vec2(1.6, 1.0)));
  moon = max(0.0, moon - bite * 0.9);
  float halo = exp(-md * md * 90.0) * 0.5;
  float moonA = 0.55 + 0.45 * dark;
  col += vec3(0.92, 0.94, 0.82) * (moon * moonA + halo * moonA * 0.6);

  // treeline silhouette: two fbm horizons above the waterline
  float edge1 = 0.340 + 0.026 * fbm3(vec3(vUv.x * 5.0, 3.7, 0.4), 3, 2.0, 0.5)
              + 0.008 * fbm3(vec3(vUv.x * 18.0, 8.2, 1.1), 2, 2.0, 0.5);
  float edge2 = 0.362 + 0.018 * fbm3(vec3(vUv.x * 4.0, 9.1, 0.9), 3, 2.0, 0.5);
  col = mix(col, vec3(0.022, 0.030, 0.058), step(vUv.y, edge2) * 0.85);
  col = mix(col, vec3(0.012, 0.018, 0.042), step(vUv.y, edge1));

  // cattail clumps: seeded reed silhouettes between treeline and waterline,
  // each stalk a segment stroke, ~40% carrying a cattail head capsule.
  // Sway rides a slow wind envelope per clump.
  float reeds = 0.0;
  float baseY = 0.300;
  for (int c = 0; c < 10; c++) {
    float fc = float(c);
    float cx = 0.045 + fc * 0.098 + (hashc(fc, 1.0) - 0.5) * 0.030;
    float wind = sin(uT * 0.42 + fc * 1.7) * (0.35 + 0.65 * (0.5 + 0.5 * sin(uT * 0.19 + fc)));
    for (int s = 0; s < 5; s++) {
      float fs = float(s);
      float sx = cx + (hashc(fc * 10.0 + fs, 2.0) - 0.5) * 0.030;
      float h = 0.040 + hashc(fc * 10.0 + fs, 3.0) * 0.055;
      float lean = (hashc(fc * 10.0 + fs, 4.0) - 0.5) * 0.016;
      // stalk: base → tip, tip displaced by lean + sway scaled by height
      vec2 a = vec2(sx, baseY);
      vec2 b = vec2(sx + lean + wind * 0.014 * h * 14.0, baseY + h);
      float d = segD(vUv, a, b);
      reeds = max(reeds, 1.0 - smoothstep(0.0008, 0.0016, d));
      // cattail head: dark capsule near the tip on some stalks
      if (hashc(fc * 10.0 + fs, 5.0) > 0.6) {
        vec2 h0 = b - vec2(0.0, 0.010);
        vec2 h1 = b + vec2(0.0, 0.004);
        float hd = segD(vUv, h0, h1);
        reeds = max(reeds, 1.0 - smoothstep(0.0016, 0.0028, hd));
      }
    }
  }
  col = mix(col, vec3(0.008, 0.013, 0.030), reeds);

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- water band: mirrored sky, moon glint, shimmer, frog-plop ring ---------
const WATER_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform vec3 uCam;
uniform vec3 uCamR;   // camera right basis
uniform vec3 uCamF;   // camera forward basis

void main() {
  // mirrored gradient: darkest at the bottom, horizon colour at top
  vec3 deep = vec3(0.008, 0.014, 0.038);
  vec3 hor = vec3(0.045, 0.062, 0.130);
  vec3 col = mix(deep, hor, smoothstep(0.0, 1.0, vUv.y));
  // faint afterglow remnant near the top edge, dying with last light
  col += vec3(0.30, 0.14, 0.05) * smoothstep(0.78, 1.0, vUv.y)
       * (1.0 - smoothstep(0.0, 9.0, uT) * 0.75);

  // ripple shimmer: slow horizontal fbm bands wobbling the brightness
  float rip = fbm3(vec3(vUv.x * 26.0, vUv.y * 60.0 - uT * 0.22, 0.4), 3, 2.0, 0.5);
  col *= 0.92 + 0.16 * rip;

  // moon glint: vertical wobbling column of light under the moon. The
  // quad is far wider than the frame, so uv.x is not a screen fraction —
  // and a fixed world x drifts off the moon's screen x under camera pitch.
  // Solve each row's world x so its view-space x/depth ratio equals the
  // moon's: (W−C)·R / (W−C)·F = (M−C)·R / (M−C)·F.
  vec3 md = vec3(${MOON_X.toFixed(2)}, ${MOON_Y.toFixed(2)}, ${MOON_Z.toFixed(1)}) - uCam;
  float mr = dot(md, uCamR) / dot(md, uCamF);
  float wy = (${WATER_Y.toFixed(2)} - ${WATER_H.toFixed(1)}) + ${WATER_H.toFixed(1)} * vUv.y;
  float restF = (wy - uCam.y) * uCamF.y + (${WATER_Z.toFixed(1)} - uCam.z) * uCamF.z;
  float restR = (wy - uCam.y) * uCamR.y + (${WATER_Z.toFixed(1)} - uCam.z) * uCamR.z;
  float wx = uCam.x + (mr * restF - restR) / (uCamR.x - mr * uCamF.x);
  float gx = 0.5 + wx / ${QUAD_W.toFixed(1)}
           + 0.012 * fbm3(vec3(vUv.y * 30.0, uT * 0.3, 2.0), 2, 2.0, 0.5);
  float gdx = (vUv.x - gx) / 0.020;
  float gl = exp(-gdx * gdx);
  gl *= (0.35 + 0.45 * vUv.y) * (0.55 + 0.45 * smoothstep(0.0, 9.0, uT));
  gl *= 0.7 + 0.3 * rip;
  col += vec3(0.60, 0.63, 0.52) * gl * 1.8;

  // frog plop: one ring spreading from t≈19, rim catching the moonlight.
  // Centre projected from the same world point plopBend scatters from,
  // or the splash and the scatter diverge.
  float pt = uT - ${PLOP_T.toFixed(1)};
  if (pt > 0.0) {
    // world-space ripple radius, then project the near/far edges through
    // the camera — a foreshortened ellipse that stays inside the band
    // instead of clipping at the waterline.
    float rw = 0.8 + 4.2 * smoothstep(0.0, 2.6, pt);
    float sN = (uCam.z - (${WATER_Z.toFixed(1)})) / (uCam.z - (${PLOP.z.toFixed(1)} + rw));
    float sF = (uCam.z - (${WATER_Z.toFixed(1)})) / (uCam.z - (${PLOP.z.toFixed(1)} - rw));
    float yN = (uCam.y + sN * (${WATER_Y.toFixed(2)} - uCam.y) - (${WATER_Y.toFixed(2)} - ${WATER_H.toFixed(1)})) / ${WATER_H.toFixed(1)};
    float yF = (uCam.y + sF * (${WATER_Y.toFixed(2)} - uCam.y) - (${WATER_Y.toFixed(2)} - ${WATER_H.toFixed(1)})) / ${WATER_H.toFixed(1)};
    float sP = (uCam.z - (${WATER_Z.toFixed(1)})) / (uCam.z - (${PLOP.z.toFixed(1)}));
    vec2 pc = vec2(0.5 + (uCam.x + sP * (${PLOP.x.toFixed(1)} - uCam.x)) / ${QUAD_W.toFixed(1)}, 0.5 * (yN + yF));
    // the near edge lands lower on screen, so yN < yF — take the half-span
    // either way around
    vec2 rr = vec2(sP * rw / ${QUAD_W.toFixed(1)}, max(1e-4, 0.5 * abs(yF - yN)));
    float pd = length((vUv - pc) / rr);
    float rd = (pd - 1.0) / 0.10;
    float ring = exp(-rd * rd);
    ring *= 1.0 - smoothstep(0.0, 3.2, pt);
    col += vec3(0.24, 0.31, 0.38) * ring * 1.4;
    // faint trailing inner ripple
    float rd2 = (pd - 0.6) / 0.08;
    float ring2 = exp(-rd2 * rd2) * 0.4;
    col += vec3(0.25, 0.30, 0.38) * ring2 * (1.0 - smoothstep(0.0, 2.8, pt));
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- fireflies + reflections + owl ------------------------------------------
const FLY_VERT = /* glsl */ `
${GLSL_NOISE}
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;      // t0, rate/size, amp, phase
varying float vA;
varying float vKind;
varying float vSeed;
uniform float uT;
uniform vec3 uCamPos;
uniform float uPx;   // render-target height / 1080 — keeps sprites a fixed frame fraction

// per-seed flash rhythm: slow brighten, sharp falloff, variable period.
// chorus envelope: sparse → full → sudden still → rekindle.
float flashEnv(float uT, float t0, float seed) {
  float per = 1.6 + fract(seed * 3.7) * 2.4;          // 1.6–4 s period
  float fr = fract((uT - t0) / per + fract(seed * 9.3));
  float pulse = pow(smoothstep(0.0, 0.70, fr), 1.5)
              * (1.0 - smoothstep(0.70, 0.97, fr));   // slow on, sharp off
  float chorus = mix(0.30, 1.0, smoothstep(3.0, 10.0, uT));
  float still = smoothstep(14.2, 15.0, uT) * (1.0 - smoothstep(17.6, 18.8, uT));
  float wake = smoothstep(t0, t0 + 2.0, uT);
  return pulse * chorus * (1.0 - still * 0.97) * wake;
}

// frog plop: fireflies near the plop bend away once (closed-form)
vec3 plopBend(vec3 p, float uT) {
  float pt = uT - ${PLOP_T.toFixed(1)};
  if (pt <= 0.0) return p;
  float ring = smoothstep(0.0, 0.6, pt) * (1.0 - smoothstep(1.6, 3.4, pt));
  vec2 dc = vec2(${PLOP.x.toFixed(1)}, ${PLOP.z.toFixed(1)});
  vec2 dv = p.xz - dc;
  float d = length(dv) + 1e-3;
  float push = exp(-d * d * 0.09) * ring;
  p.x += (dv.x / d) * push * 0.9;
  p.y += push * 0.5;
  p.z += (dv.y / d) * push * 0.9;
  return p;
}

void main() {
  float t0 = aAux.x;
  float rate = aAux.y;
  float amp = aAux.z;
  float ph = aAux.w;
  vec3 pos = position;
  float alpha = 1.0;
  float size = 1.0;
  float live = max(uT - t0, 0.0);

  if (aKind < 0.5) {
    // firefly: Lissajous-ish drift rising slowly over the marsh
    float wx = 0.55 + fract(aSeed * 3.1) * 0.9;
    float wy = 0.35 + fract(aSeed * 5.3) * 0.7;
    float wz = 0.25 + fract(aSeed * 7.7) * 0.6;
    pos = vec3(
      position.x + amp * sin(wx * live + ph),
      position.y + 0.10 * live + amp * 0.5 * sin(wy * live + ph * 1.7),
      position.z + amp * 0.8 * sin(wz * live + ph * 0.9)
    );
    pos = plopBend(pos, uT);
    alpha = flashEnv(uT, t0, aSeed);
    size = 1.05 + fract(aSeed * 2.9) * 0.65;
  } else if (aKind < 1.5) {
    // reflection smear: seed-synced, pinned on the water band ahead of it.
    // x follows the fly's drift exactly; y mirrors below the waterline,
    // damped and wobble-attenuated by ripple noise.
    float wx = 0.55 + fract(aSeed * 3.1) * 0.9;
    float wz = 0.25 + fract(aSeed * 7.7) * 0.6;
    float wy = 0.35 + fract(aSeed * 5.3) * 0.7;
    float flyX = position.x + amp * sin(wx * live + ph);
    float flyY = position.y + 0.10 * live + amp * 0.5 * sin(wy * live + ph * 1.7);
    float wob = fbm3(vec3(uT * 0.8, aSeed * 10.0, 1.0), 2, 2.0, 0.5);
    float reflY = ${WATER_Y.toFixed(2)} - 0.30 - (flyY - ${WATER_Y.toFixed(2)}) * 0.16;
    pos = vec3(
      flyX + (wob - 0.5) * 0.5 - uCamPos.x * 0.10,
      reflY + (wob - 0.5) * 0.18,
      position.z
    );
    alpha = flashEnv(uT, t0, aSeed) * (0.65 + 0.35 * wob);
    size = 0.9 + fract(aSeed * 2.9) * 0.5;
  } else if (aKind < 2.5) {
    // hero firefly: bigger, crossing close to camera during rekindle
    float wx = 0.30 + fract(aSeed * 3.1) * 0.4;
    pos = vec3(
      position.x + amp * sin(wx * live + ph),
      position.y + amp * 0.35 * sin(0.5 * live + ph * 1.3) + 0.05 * live,
      position.z + amp * 0.5 * cos(wx * live * 0.8 + ph)
    );
    alpha = flashEnv(uT, t0, aSeed);
    size = 1.8 + fract(aSeed * 2.9) * 0.9;
  } else {
    // owl: slow glide crossing once during the calm/rekindle beat
    float ot = uT - t0;
    pos = vec3(position.x + ot * rate,
               position.y + 0.25 * sin(ot * 0.7 + ph) - 0.12 * ot,
               position.z);
    alpha = smoothstep(0.0, 1.2, ot) * (1.0 - smoothstep(5.5, 8.0, ot));
    size = 5.0;
  }

  vA = alpha;
  vKind = aKind;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 300.0 * uPx / max(1.0, -mv.z), ((aKind > 2.5) ? 260.0 : 90.0) * uPx);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0); // cull dead sprites
}
`;

const FLY_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  vec3 col; float a;
  if (vKind < 0.5 || vKind > 1.5 && vKind < 2.5) {
    // firefly disc: hot core + soft halo (hero gets a wider bloom ring)
    float core = exp(-d * d * 300.0);
    float haloW = (vKind > 1.5) ? 26.0 : 60.0;
    float halo = exp(-d * d * haloW) * ((vKind > 1.5) ? 0.9 : 0.45);
    col = mix(vec3(0.62, 0.95, 0.35), vec3(1.0, 0.85, 0.35), fract(vSeed * 11.3) * 0.6);
    col += vec3(1.0, 1.0, 0.7) * core * 0.9;
    a = (core + halo) * vA * 1.8;
  } else if (vKind < 1.5) {
    // reflection smear: tall, soft, vertically streaked
    vec2 e = vec2(q.x * 4.2, q.y * 0.8);
    float body = exp(-dot(e, e) * 60.0);
    float streak = 0.75 + 0.25 * sin(gl_PointCoord.y * 28.0 + vSeed * 40.0);
    col = vec3(0.62, 1.0, 0.45);
    a = body * streak * vA * 1.15;
  } else {
    // owl silhouette: gull-v wing curve
    float v = q.y + abs(q.x) * 0.42 - 0.08;
    float w = 1.0 - smoothstep(0.015, 0.05, abs(v));
    col = vec3(0.01, 0.015, 0.04);
    a = w * vA;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

interface FmState {
  backMat: THREE.ShaderMaterial;
  waterMat: THREE.ShaderMaterial;
  flyMat: THREE.ShaderMaterial;
  owlMat: THREE.ShaderMaterial;
}
const fmStates = new WeakMap<SceneContext, FmState>();

export default defineScene({
  id: 'fireflymarsh/marsh',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x04060f);
    const rng = mulberry32(41837);

    // --- backdrop quad: sky + moon + treeline + cattail clumps
    const backMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BACK_FRAG,
      depthWrite: false,
      uniforms: { uT: { value: 0 } },
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 42), backMat);
    back.position.set(0, 2, -32);
    back.renderOrder = 0;
    sc.add(back);

    // --- water band quad
    const waterMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uT: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uCamR: { value: new THREE.Vector3(1, 0, 0) },
        uCamF: { value: new THREE.Vector3(0, 0, -1) },
      },
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 8), waterMat);
    water.position.set(0, WATER_Y - 4.0, -14);
    water.renderOrder = 1;
    sc.add(water);

    // --- one points cloud: fireflies, reflections, heroes
    const NF = 110, NH = 6;
    const N = NF * 2 + NH;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const kind = new Float32Array(N);
    const aux = new Float32Array(N * 4);
    let i = 0;
    const put = (x: number, y: number, z: number, k: number, s: number,
                 t0 = 0, v = 0, amp = 0, ph = 0) => {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = amp; aux[i * 4 + 3] = ph;
      i++;
    };

    // fireflies: seeded across the marsh above the waterline, staggered starts
    for (let f = 0; f < NF; f++) {
      const s = rng() * 100;
      const x0 = (rng() - 0.5) * 18;
      const y0 = -2.2 + rng() * 4.2;
      const z0 = -4 - 14 * Math.pow(rng(), 1.2);
      const t0 = f < 8 ? 1.0 + rng() * 1.5 : 2.0 + rng() * 5.0;
      const amp = 0.5 + rng() * 1.3;
      const ph = rng() * Math.PI * 2;
      put(x0, y0, z0, 0, s, t0, 0, amp, ph);
      // its reflection smear: same seed → same flash rhythm
      put(x0, y0, -12.4, 1, s, t0, 0, amp, ph);
    }
    // hero fireflies: near-camera crossings during rekindle
    for (let h = 0; h < NH; h++) {
      put(-8 + rng() * 16, -1.5 + rng() * 2.5, -1.5 - rng() * 2.5,
          2, rng() * 100, 17.5 + rng() * 2.0, 0, 1.2 + rng() * 1.4, rng() * Math.PI * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const flyMat = new THREE.ShaderMaterial({
      vertexShader: FLY_VERT,
      fragmentShader: FLY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uCamPos: { value: new THREE.Vector3() }, uPx: { value: 1 } },
    });
    const flies = new THREE.Points(geo, flyMat);
    flies.frustumCulled = false;
    flies.renderOrder = 2;
    sc.add(flies);

    // owl: crosses the sky once during the calm beat. Its own point +
    // material — a silhouette needs normal alpha blending; additive light
    // can only brighten the sky behind it.
    const owlGeo = new THREE.BufferGeometry();
    owlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-9, 4.2, -22]), 3));
    owlGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array([rng() * 100]), 1));
    owlGeo.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array([3]), 1));
    owlGeo.setAttribute('aAux', new THREE.BufferAttribute(new Float32Array([19.4, 2.4, 0, rng() * 6.28]), 4));
    const owlMat = new THREE.ShaderMaterial({
      vertexShader: FLY_VERT,
      fragmentShader: FLY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: { uT: { value: 0 }, uCamPos: { value: new THREE.Vector3() }, uPx: { value: 1 } },
    });
    const owl = new THREE.Points(owlGeo, owlMat);
    owl.frustumCulled = false;
    owl.renderOrder = 2;
    sc.add(owl);

    // --- camera: gentle drift along the waterline
    ctx.rig.setLensMm(55);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let w = 0; w <= 24; w++) {
      const wt = ctx.sceneCtx.start + (w / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: w / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    fmStates.set(ctx, { backMat, waterMat, flyMat, owlMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const st = fmStates.get(ctx)!;
    st.backMat.uniforms.uT.value = t;
    st.waterMat.uniforms.uT.value = t;
    st.flyMat.uniforms.uT.value = t;
    st.owlMat.uniforms.uT.value = t;
    ctx.updateCamera(t, f.p);
    const cp = ctx.rig.position;
    (st.waterMat.uniforms.uCam.value as THREE.Vector3).set(cp[0], cp[1], cp[2]);
    // camera basis for view-space projections — use the rig's actual
    // spline-evaluated target, not the intended camTarget(t) key
    const tt = ctx.rig.target;
    const fwd = new THREE.Vector3(tt[0] - cp[0], tt[1] - cp[1], tt[2] - cp[2]).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    (st.waterMat.uniforms.uCamF.value as THREE.Vector3).copy(fwd);
    (st.waterMat.uniforms.uCamR.value as THREE.Vector3).copy(right);
    (st.flyMat.uniforms.uCamPos.value as THREE.Vector3).set(cp[0], cp[1], cp[2]);
    (st.owlMat.uniforms.uCamPos.value as THREE.Vector3).set(cp[0], cp[1], cp[2]);
    const px = out.height / 1080;
    st.flyMat.uniforms.uPx.value = px;
    st.owlMat.uniforms.uPx.value = px;
    ctx.flush(out, true);
  },
});

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// paperboats — paper boats drifting down a rain-washed gutter at golden hour
// after a storm. Ground plane: one shader draws wet pavement stones catching
// long gold light, the raised curb band, and the gutter channel — flowing
// water with speed-varying streaks, seeded eddy swirls at stone gaps,
// floating debris, rainbow oil-slick shimmer, and puddles reflecting pink
// sky with drifting clouds. An 8-slot ring uniform array carries the
// sneaker splash + curb drip rings as true world circles (perspective does
// the foreshortening). Five paper boats are real low-poly meshes riding a
// closed-form flow field — bobbing on wavelets, tilting into eddies, one
// snagging on a leaf dam (wiggle envelope) until it gives, one scooting
// ahead on a gust. Points carry curb drip beads, drifting debris sparks,
// a pigeon strutting the curb, and a kid's sneaker splashing a puddle at
// the frame edge once — all closed-form f(t), hash seeds, no sim.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

// ---- world layout (shared TS ↔ GLSL) ------------------------------------
const GROUND_Y = 0.0;           // ground/water plane height
const GROUND_X0 = -14.0;        // ground plane extends
const GROUND_X1 = 14.0;
const GROUND_Z0 = -34.0;        // far end of the visible street
const GROUND_Z1 = 12.0;
const CHAN_X0 = -1.15;          // gutter channel bounds (world x)
const CHAN_X1 = 1.05;
const CURB_X0 = 1.05;           // raised curb band
const CURB_X1 = 2.35;
const DAM_Z = -25.2;            // leaf dam position on the channel
const GUST_T = 16.0;            // gust-scoot beat
const SNAG_T = 9.0;             // boat 3 reaches the leaf dam
const FREE_T = 13.6;            // dam gives, boat frees
const SPLASH_T = 6.0;           // sneaker splash at frame edge
const BOAT_T0 = 3.5;            // first boat enters the far end

// closed-form channel flow: z-position of a boat drifting from -34 at t0.
// speed varies with channel width: pinch near the curb returns slows it.
function flowV(z: number): number {
  const w = CHAN_X1 - CHAN_X0;
  const pinch = 1.0 - 0.30 * Math.exp(-Math.pow((z - DAM_Z) / 5.0, 2)); // narrows at the dam
  return 2.05 * (CHAN_X1 - CHAN_X0) / (w / pinch) * 1.0; // ~2.05 m/s base
}
// boats ride the same path; per-seed speed factor keeps them spread
function boatZ(t: number, t0: number, v: number): number {
  const tt = Math.max(0, t - t0);
  // closed-form integral of flowV is uniform enough here; add wavelet surge
  return GROUND_Z0 + flowV(0) * v * tt + 0.35 * Math.sin(tt * 0.9 + v * 7.0);
}
// boat 3 snags on the leaf dam: travel clock pauses inside [SNAG_T, FREE_T]
function snagClock(t: number): number {
  const hold = Math.min(Math.max(t - SNAG_T, 0), FREE_T - SNAG_T);
  return t - hold;
}
function boat3Z(t: number): number {
  const base = boatZ(snagClock(t), BOAT_T0 + 1.0, 0.96);
  return Math.min(base, DAM_Z + 0.55); // hull nose at the dam while held
}
function boatZByIndex(i: number, t: number): number {
  if (i === 2) return boat3Z(t);
  let z = boatZ(t, BOAT_T0 + i * 2.1, 0.92 + i * 0.045);
  if (i === 4) {
    // gust scoot: this boat's sail catches the gust and pulls ahead
    const g = Math.min(1, Math.max(0, (t - GUST_T) / 1.2));
    z += 3.4 * g * g * (3 - 2 * g); // smoothstep
  }
  return z;
}
// eddy lateral offset: seeded swirl pockets along the channel edges
function eddyX(z: number, seed: number, t: number): number {
  const gaps = [-26.5, -21.0, -17.5, -11.0, -7.5];
  let x = 0;
  for (let g = 0; g < gaps.length; g++) {
    const d = z - gaps[g];
    const w = Math.exp(-d * d / 6.0);
    x += w * Math.sin(t * (1.1 + 0.3 * g) + seed * 6.28) * 0.42;
  }
  return x;
}
function boatX(i: number, t: number, z: number): number {
  const lane = -0.45 + (i % 5) * 0.22;
  return lane + eddyX(z, i * 0.37 + 0.13, t) * 0.8;
}
// the lead boat drives the tracking camera
function leadZ(t: number): number {
  let m = -1e9;
  for (let i = 0; i < 5; i++) m = Math.max(m, boatZByIndex(i, t));
  return Math.min(m, 6.5); // camera stops chasing once boats pass near
}
function camPos(t: number): [number, number, number] {
  const lz = leadZ(t);
  return [4.6 + 0.25 * Math.sin(t * 0.13), 1.85 + 0.10 * Math.sin(t * 0.21), lz + 7.2];
}
function camTarget(t: number): [number, number, number] {
  const lz = leadZ(t);
  return [-0.1 + 0.2 * Math.sin(t * 0.09), 0.30, lz - 1.6];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- backdrop: dusk-gold sky, rooftop/tree silhouettes, drifting clouds ---
const SKY_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  vec2 uv = vUv;
  // storm-clearing sky: rose near the horizon, bruised blue up top
  vec3 col = mix(vec3(0.80, 0.42, 0.33), vec3(0.08, 0.10, 0.22),
                 smoothstep(0.04, 0.66, uv.y));
  // sun burn low on the right where the lane light comes from
  float sx = (uv.x - 0.88) * 4.5, sy = (uv.y - 0.26) * 4.5;
  col += vec3(1.00, 0.62, 0.28) * exp(-(sx * sx) - (sy * sy)) * 1.1;
  // drifting cloud banks — darker storm remnants sliding off left
  float cl = fbm3(vec3(uv.x * 4.0 + uT * 0.020, uv.y * 7.0, 0.0), 3, 2.0, 0.55);
  float bank = smoothstep(0.02, 0.45, cl) * smoothstep(0.18, 0.55, uv.y);
  col = mix(col, vec3(0.07, 0.08, 0.16), bank * 0.7);
  // pink underlit rims where the sun catches cloud edges
  col += vec3(0.85, 0.40, 0.32) * bank * (1.0 - smoothstep(0.18, 0.45, uv.y)) * 0.5;
  // thin torn wisps low over the rooftops
  col *= 1.0 - 0.22 * smoothstep(0.4, 0.75, fbm3(vec3(uv.x * 5.0 + uT * 0.035, uv.y * 16.0, 2.0), 2, 2.0, 0.5));
  // rooftop + chimney + tree silhouette along the horizon
  float roof = smoothstep(0.16, 0.15, uv.y + 0.02 * fbm3(vec3(uv.x * 22.0, 1.0, 0.0), 2, 2.0, 0.5));
  col = mix(col, vec3(0.05, 0.05, 0.09), roof);
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- ground: wet pavement + curb + gutter channel --------------------------
const GROUND_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform vec3 uCam;
uniform vec3 uRings[8]; // x,z world center, w = ring birth time
uniform float uCloudGap; // 0..1 sun-lane glint envelope (cloud gaps)

float hashg(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float voronoi(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 r = g + vec2(hashg(i + g), hashg(i + g + 7.0)) - f;
    d = min(d, dot(r, r));
  }
  return sqrt(d);
}

void main() {
  // uv maps straight onto world coords
  float wx = mix(${GROUND_X0.toFixed(1)}, ${GROUND_X1.toFixed(1)}, vUv.x);
  float wz = mix(${GROUND_Z0.toFixed(1)}, ${GROUND_Z1.toFixed(1)}, vUv.y);
  vec2 w = vec2(wx, wz);

  // ---- wet pavement base: stone slabs, darkened by rain
  float stone = voronoi(w * vec2(1.15, 0.8));
  float slab = smoothstep(0.02, 0.10, stone);           // mortar lines darker
  vec3 pave = mix(vec3(0.030, 0.033, 0.045), vec3(0.075, 0.077, 0.088), slab);
  pave *= 0.85 + 0.30 * fbm3(vec3(w * 0.6, 0.0), 3, 2.0, 0.5);
  // long gold light raking across the wet stone from the right
  float rake = smoothstep(-6.0, 6.0, wx) * (0.5 + 0.5 * uCloudGap);
  pave += vec3(0.55, 0.34, 0.14) * rake * 0.30 * (0.6 + 0.4 * slab);
  // long gold streaks raking across the wet stone, broken by soft long shadows
  float lane2 = fbm3(vec3(wx * 1.1, wz * 0.12, 11.0), 2, 2.0, 0.5);
  float streaks = smoothstep(0.35, 0.85, lane2) * rake;
  pave += vec3(0.50, 0.30, 0.10) * streaks * 0.55;
  pave *= 1.0 - 0.30 * smoothstep(0.75, 0.95, lane2) * rake; // intervening shadow
  // sparkle where stone texture faces the sun
  float sp = pow(0.5 + 0.5 * fbm3(vec3(w * 9.0, 3.0), 2, 2.0, 0.5), 6.0);
  pave += vec3(0.9, 0.6, 0.3) * sp * rake * 0.8;

  // ---- puddles reflecting pink sky + drifting clouds
  float pud = smoothstep(0.55, 0.72, fbm3(vec3(w * 0.28, 7.0), 3, 2.0, 0.5));
  pud *= smoothstep(1.9, 3.4, abs(wx));                 // none inside channel
  if (pud > 0.0) {
    float rip = fbm3(vec3(w * 2.6, uT * 0.35), 2, 2.0, 0.5) * 0.15;
    vec3 skyRef = mix(vec3(0.92, 0.55, 0.45), vec3(0.22, 0.26, 0.45),
                      clamp(rip + 0.45, 0.0, 1.0));
    float clRef = smoothstep(0.55, 0.75,
        fbm3(vec3(w.x * 0.5 + uT * 0.06, w.y * 0.9, 4.0), 3, 2.0, 0.55));
    skyRef = mix(skyRef, vec3(0.85, 0.82, 0.86), clRef * 0.5); // cloud mirror
    pave = mix(pave, skyRef, pud * 0.75);
    pave += vec3(1.0, 0.7, 0.4) * pud * rake * 0.35;   // gold catch
  }

  vec3 col = pave;

  // ---- curb band: raised pale stone strip with sunlit top edge
  float curb = smoothstep(${CURB_X0.toFixed(2)} - 0.04, ${CURB_X0.toFixed(2)}, wx)
             * (1.0 - smoothstep(${CURB_X1.toFixed(2)} - 0.05, ${CURB_X1.toFixed(2)}, wx));
  if (curb > 0.0) {
    vec3 cstone = mix(vec3(0.085, 0.085, 0.095), vec3(0.14, 0.135, 0.13),
                      fbm3(vec3(w * 2.2, 5.0), 2, 2.0, 0.5));
    // sunlit top edge + long shadow cast into the gutter
    float topL = smoothstep(${CURB_X0.toFixed(2)}, ${CURB_X0.toFixed(2)} + 0.30, wx);
    cstone += vec3(0.45, 0.28, 0.12) * topL * (0.35 + 0.65 * uCloudGap);
    col = mix(col, cstone, curb);
  }
  // curb's long shadow onto the channel side
  float shad = 1.0 - smoothstep(${CURB_X0.toFixed(2)} - 1.6, ${CURB_X0.toFixed(2)}, wx);
  col *= 1.0 - 0.35 * shad * (0.4 + 0.6 * uCloudGap);

  // ---- gutter channel: flowing water between CHAN bounds
  float chan = smoothstep(${CHAN_X0.toFixed(2)} - 0.05, ${CHAN_X0.toFixed(2)} + 0.04, wx)
             * (1.0 - smoothstep(${CHAN_X1.toFixed(2)} - 0.05, ${CHAN_X1.toFixed(2)} + 0.04, wx));
  if (chan > 0.0) {
    // base water: dark with sky sheen
    vec3 wat = mix(vec3(0.016, 0.022, 0.042), vec3(0.045, 0.055, 0.085),
                   smoothstep(${CHAN_X0.toFixed(2)}, ${CHAN_X1.toFixed(2)}, wx));
    // flow streaks advected along +z; speed varies with channel width —
    // narrow stretches stream faster (shorter wavelet scale, quicker scroll)
    float pinch = 1.0 - 0.30 * exp(-pow((wz - ${DAM_Z.toFixed(1)}) / 5.0, 2.0));
    float speed = 1.6 / pinch;
    float streak = fbm3(vec3(wx * 6.0, wz * 2.2 - uT * speed, 1.0), 3, 2.0, 0.55);
    wat += vec3(0.12, 0.14, 0.19) * smoothstep(0.42, 0.82, streak);
    // sheen of the sky down the channel center
    wat += vec3(0.10, 0.09, 0.10) * exp(-pow((wx - 0.0) / 0.5, 2.0));
    // transverse wavelets breaking the sheen — moving water reads
    float wave = sin(wz * 6.0 - uT * (3.0 + speed)) * 0.5 + 0.5;
    wat += vec3(0.06, 0.07, 0.10) * wave * wave * smoothstep(0.3, 0.8, streak);
    // eddy swirls at seeded stone gaps: rotated noise patches
    float ed = 0.0;
    for (int g = 0; g < 5; g++) {
      float gz = -26.5 + float(g) * 4.9 + 0.6 * float(g * g % 3);
      vec2 c = vec2(float(g % 2) * 1.4 - 0.7, gz);
      vec2 r = (w - c) / 1.15;
      float m = exp(-dot(r, r));
      float sw = fbm3(vec3(r.yx * 3.0 + vec2(uT * 0.8 * (float(g % 2) * 2.0 - 1.0), 0.0), 2.0), 2, 2.0, 0.5);
      ed += m * smoothstep(0.15, 0.65, sw);
    }
    wat += vec3(0.14, 0.15, 0.19) * min(ed, 1.2) * 0.8;
    // sun lane: glinting strip while the cloud gap is open
    float lane = exp(-pow((wx - 0.1) / 0.55, 2.0)) * uCloudGap;
    float glint = pow(0.5 + 0.5 * fbm3(vec3(wx * 14.0, wz * 5.0 - uT * 2.2, 6.0), 2, 2.0, 0.5), 5.0);
    wat += vec3(1.0, 0.62, 0.25) * (lane * (0.35 + glint * 1.6));
    // rainbow oil-slick shimmer patches drifting with the flow
    vec2 oilW = vec2(wx * 1.4, wz * 0.5 - uT * 0.30);
    float oil = smoothstep(0.62, 0.78, fbm3(vec3(oilW, 9.0), 3, 2.0, 0.5));
    float hue = fbm3(vec3(w * 1.8, 3.0), 2, 2.0, 0.5) * 6.28 + uT * 0.05;
    vec3 rainbow = 0.5 + 0.5 * cos(hue + vec3(0.0, 2.1, 4.2));
    wat += rainbow * oil * 0.30;
    // wet dark rim where water meets stone
    wat *= 1.0 - 0.25 * smoothstep(0.08, 0.0,
        min(wx - ${CHAN_X0.toFixed(2)}, ${CHAN_X1.toFixed(2)} - wx));
    // leaf dam: brown matted leaves banked against the pinch until it gives
    float give = smoothstep(${FREE_T.toFixed(1)}, ${FREE_T.toFixed(1)} + 1.2, uT);
    vec2 damP = vec2((wx - 0.0) + give * 0.3, wz - (${DAM_Z.toFixed(1)} + give * 2.2));
    float dam = exp(-dot(damP / vec2(0.62, 0.42), damP / vec2(0.62, 0.42)));
    float leaves = fbm3(vec3(w * 14.0, 8.0), 3, 2.0, 0.6);
    wat = mix(wat, vec3(0.20, 0.12, 0.05) * (0.7 + 0.6 * leaves), dam * 0.9 * (1.0 - give * 0.5));
    col = mix(col, wat, chan);
  }

  // ---- ripple rings: true world circles (splash + curb drips)
  for (int i = 0; i < 8; i++) {
    float t0 = uRings[i].z;
    if (t0 < 0.0) continue;
    float age = uT - t0;
    if (age <= 0.0 || age > 3.5) continue;
    float rw = min(age * 1.5, 2.6);
    float d = length(w - uRings[i].xy);
    float rim = exp(-pow((d - rw) / 0.10, 2.0)) * (1.0 - age / 3.5);
    col += vec3(0.45, 0.42, 0.38) * rim * 0.9;
  }

  // distance fog into the gold haze
  float dFog = smoothstep(4.0, ${GROUND_Z0.toFixed(1)} + 12.0, wz);
  col = mix(col, vec3(0.42, 0.26, 0.20), dFog * 0.65);

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- points: curb drips, debris spark, pigeon, sneaker, splash droplets ----
const PT_VERT = /* glsl */ `
${GLSL_NOISE}
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;      // t0, rate/fall, amp/gather, phase
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;
uniform float uT;
uniform float uPx;

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
    // curb drip bead: gather on the curb lip → fall → tiny plop
    float gather = amp, fall = rate, rest = ph;
    float cyc = gather + fall + rest;
    float pc = mod(uT - t0, cyc);
    float dropH = position.y - (${GROUND_Y.toFixed(2)});
    if (pc < gather) {
      float g = pc / gather;
      alpha = 0.5 * smoothstep(0.3, 0.95, g);
      size = 0.10 + 0.12 * g;
    } else if (pc < gather + fall) {
      float fp = (pc - gather) / fall;
      pos.y = position.y - dropH * fp * fp;
      alpha = 0.9;
      size = 0.16;
    } else if (pc < gather + fall + 0.15) {
      pos.y = ${GROUND_Y.toFixed(2)} + 0.02;
      float p = (pc - gather - fall) / 0.15;
      alpha = (1.0 - p) * 1.2;
      size = 0.20 + 0.30 * p;
    } else { alpha = 0.0; size = 0.01; }
  } else if (aKind < 1.5) {
    // drifting debris mote on the water, wobbling with the flow
    float z0 = ${GROUND_Z0.toFixed(1)} + fract(aSeed * 0.618) * 20.0;
    float tt = mod(uT * rate + ph * 8.0, 40.0);
    pos = vec3(position.x + 0.3 * sin(tt * 1.3 + ph), position.y,
               z0 + tt * 0.85);
    alpha = smoothstep(0.0, 1.0, tt) * (1.0 - smoothstep(28.0, 38.0, tt));
    size = 0.07 + fract(aSeed * 5.1) * 0.08;
  } else if (aKind < 2.5) {
    // splash droplet: ballistic arc out of the splash point, once
    float ot = uT - t0;
    float life = 0.9;
    if (ot < 0.0 || ot > life) { alpha = 0.0; size = 0.01; }
    else {
      float a2 = ph;                    // launch angle around
      vec3 v0 = vec3(cos(a2) * rate, 2.6 + fract(aSeed * 7.0) * 1.6, sin(a2) * rate * 0.7);
      pos = position + v0 * ot + vec3(0.0, -4.9 * ot * ot, 0.0);
      alpha = (1.0 - ot / life) * 1.3;
      size = 0.16 + 0.10 * fract(aSeed * 3.0);
    }
  } else if (aKind < 3.5) {
    // pigeon: struts along the curb top, pauses, bobs — NormalBlending
    float ot = uT - t0;
    float strut = ot + 0.35 * sin(ot * 2.4) * step(0.6, fract(ot * 0.9));
    pos = vec3(position.x + 0.02 * sin(ot * 12.0), position.y + 0.04 * abs(sin(ot * 4.8)),
               position.z - strut * rate);
    vFlap = sin(ot * 7.0 + ph);
    alpha = smoothstep(0.0, 0.8, ot) * (1.0 - smoothstep(20.0, 23.0, ot));
    size = 1.3;
  } else {
    // sneaker: crosses the near frame edge once, splashing the puddle
    float ot = uT - t0;
    float run = ot;
    pos = vec3(position.x + run * rate, position.y + 0.10 * abs(sin(run * 10.0)),
               position.z);
    // hop arc over the puddle
    float hop = sin(clamp((ot - 0.6) / 1.4, 0.0, 1.0) * 3.14159);
    pos.y += hop * 0.35;
    alpha = smoothstep(0.0, 0.3, ot) * (1.0 - smoothstep(1.9, 2.4, ot));
    size = 3.0;
    vFlap = hop;
  }

  vA = alpha;
  vKind = aKind;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 300.0 * uPx / max(1.0, -mv.z), 240.0 * uPx);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
}
`;

const PT_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;
float hashp(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  vec3 col; float a;
  if (vKind < 0.5) {
    vec2 e = vec2(q.x * 1.4, q.y * 0.9);
    float body = exp(-dot(e, e) * 200.0);
    col = vec3(0.75, 0.80, 0.85);
    a = body * vA;
  } else if (vKind < 1.5) {
    // debris fleck: dim speck with a warm glint edge
    float body = exp(-d * d * 240.0);
    col = mix(vec3(0.16, 0.13, 0.09), vec3(0.55, 0.42, 0.20),
              smoothstep(0.0, 0.3, q.y));
    a = body * vA * 1.5;
  } else if (vKind < 2.5) {
    float body = exp(-d * d * 160.0);
    col = vec3(0.70, 0.72, 0.78);
    a = body * vA;
  } else if (vKind < 3.5) {
    // pigeon silhouette: plump body + head + tail wedge
    float body = 1.0 - smoothstep(0.16, 0.20, length(vec2(q.x * 0.75, q.y * 1.05)) - 0.10);
    float head = 1.0 - smoothstep(0.06, 0.09,
        length(vec2((q.x - 0.16) * 1.2, (q.y - 0.10 - 0.015 * vFlap) * 1.2)));
    float tail = (1.0 - smoothstep(0.02, 0.05, abs(q.y + 0.02))) *
                 step(q.x, -0.12) * smoothstep(-0.42, -0.16, q.x);
    float feet = (1.0 - smoothstep(0.0, 0.02, abs(q.y + 0.19))) *
                 step(abs(q.x + 0.05 * vFlap), 0.10);
    col = vec3(0.07, 0.075, 0.10);
    a = max(max(body, head), max(tail * 0.85, feet * 0.7)) * vA;
  } else {
    // sneaker silhouette: chunky sole + toe + ankle collar
    float sole = 1.0 - smoothstep(0.05, 0.09,
        abs(q.y + 0.16) + abs(q.x * 0.55) * 0.10);
    sole *= smoothstep(-0.46, -0.34, q.x) * (1.0 - smoothstep(0.34, 0.46, q.x));
    float upper = 1.0 - smoothstep(0.13, 0.17,
        length(vec2((q.x + 0.05) * 0.9, (q.y - 0.02) * 1.5)));
    float ankle = 1.0 - smoothstep(0.08, 0.11,
        length(vec2((q.x - 0.16) * 1.3, (q.y - 0.13) * 1.3)));
    col = vec3(0.06, 0.06, 0.08);
    a = max(sole, max(upper, ankle)) * vA;
  }
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

interface DripSpec { x: number; y: number; z: number; off: number; gather: number; fall: number; rest: number; }
interface PbState {
  skyMat: THREE.ShaderMaterial;
  groundMat: THREE.ShaderMaterial;
  addMat: THREE.ShaderMaterial;
  silMat: THREE.ShaderMaterial;
  boats: THREE.Group[];
  drips: DripSpec[];
}
const pbStates = new WeakMap<SceneContext, PbState>();

// paper boat mesh: folded-plane silhouette (hull trapezoid + triangular
// sail) in the local XY plane, broadside facing +x after rotation.y = PI/2
function buildBoat(rng: () => number): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.MeshBasicMaterial({ color: 0xf2e8d2, side: THREE.DoubleSide });
  const shade = new THREE.MeshBasicMaterial({ color: 0xcdbb96, side: THREE.DoubleSide });
  // hull: trapezoid keel
  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.55, 0.00, 0,   0.55, 0.00, 0,   0.34, 0.20, 0,
    -0.55, 0.00, 0,   0.34, 0.20, 0,  -0.34, 0.20, 0,
  ], 3));
  const hull = new THREE.Mesh(hullGeo, shade);
  // sail: tall triangle
  const sailGeo = new THREE.BufferGeometry();
  sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.30, 0.18, 0,   0.06, 0.18, 0,   0.06, 0.62, 0,
  ], 3));
  const sail = new THREE.Mesh(sailGeo, paper);
  // back fold: smaller triangle behind the sail
  const foldGeo = new THREE.BufferGeometry();
  foldGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0.06, 0.18, 0,   0.30, 0.18, 0,   0.06, 0.44, 0,
  ], 3));
  const fold = new THREE.Mesh(foldGeo, shade);
  g.add(hull, sail, fold);
  const s = 0.85 + rng() * 0.5;
  g.scale.setScalar(s);
  return g;
}

export default defineScene({
  id: 'paperboats/gutter',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x241a18);
    const rng = mulberry32(90210);

    // --- sky backdrop
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: SKY_FRAG,
      depthWrite: false, uniforms: { uT: { value: 0 } },
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), skyMat);
    sky.position.set(0, 9, -36);
    sky.renderOrder = 0;
    sc.add(sky);

    // --- ground plane: pavement + curb + channel, horizontal
    const ringInit: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) ringInit.push(new THREE.Vector3(0, 0, -1));
    const groundMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: GROUND_FRAG,
      uniforms: {
        uT: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uRings: { value: ringInit },
        uCloudGap: { value: 0 },
      },
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_X1 - GROUND_X0, GROUND_Z1 - GROUND_Z0), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((GROUND_X0 + GROUND_X1) / 2, GROUND_Y, (GROUND_Z0 + GROUND_Z1) / 2);
    ground.renderOrder = 1;
    sc.add(ground);

    // --- five paper boats on the flow
    const boats: THREE.Group[] = [];
    for (let i = 0; i < 5; i++) {
      const b = buildBoat(rng);
      b.rotation.y = Math.PI / 2 + (rng() - 0.5) * 0.5;
      b.renderOrder = 4;
      sc.add(b);
      boats.push(b);
    }

    // --- points: additive (drips, debris, splash drops)
    const ND = 10, NB = 16, NS = 9;
    const pos = new Float32Array((ND + NB + NS) * 3);
    const seed = new Float32Array(ND + NB + NS);
    const kind = new Float32Array(ND + NB + NS);
    const aux = new Float32Array((ND + NB + NS) * 4);
    const drips: DripSpec[] = [];
    let i = 0;
    const put = (x: number, y: number, z: number, k: number, s: number,
                 t0 = 0, v = 0, amp = 0, ph = 0) => {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = amp; aux[i * 4 + 3] = ph;
      i++;
    };
    // curb drip beads: run-off dripping off the curb lip into the channel
    for (let dI = 0; dI < ND; dI++) {
      const z = -8 - rng() * 18;
      const gather = 2.0 + rng() * 3.0;
      const fall = Math.sqrt(2 * 0.35 / 8) * (0.9 + rng() * 0.2);
      const rest = 0.6 + rng() * 2.4;
      const off = rng() * (gather + fall + rest);
      const s = rng() * 100;
      put(CURB_X0 + 0.06, GROUND_Y + 0.34, z, 0, s, off, fall, gather, rest);
      drips.push({ x: CURB_X0 + 0.06, y: GROUND_Y + 0.34, z, off, gather, fall, rest });
    }
    // debris motes drifting the channel
    for (let bI = 0; bI < NB; bI++) {
      put(CHAN_X0 + 0.3 + rng() * 1.6, GROUND_Y + 0.03, -30, 1, rng() * 100,
          0, 0.8 + rng() * 0.5, 0, rng() * 6.28);
    }
    // splash droplets bursting from the sneaker splash point
    for (let sI = 0; sI < NS; sI++) {
      put(-1.0, GROUND_Y + 0.02, -30.0, 2, rng() * 100,
          SPLASH_T + 0.55, 1.0 + rng() * 1.4, 0, rng() * 6.28);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const addMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    });
    const addPts = new THREE.Points(geo, addMat);
    addPts.frustumCulled = false;
    addPts.renderOrder = 3;
    sc.add(addPts);

    // --- silhouettes on NormalBlending: pigeon + sneaker
    const sil = [
      // pigeon strutting along the curb top
      { x: CURB_X0 + 0.35, y: GROUND_Y + 0.60, z: -13.0, k: 3, s: rng() * 100, t0: 7.0, v: 0.55, amp: 0, ph: rng() * 6.28 },
      // kid's sneaker crossing the near frame edge into the puddle
      { x: -2.2, y: GROUND_Y + 0.10, z: -30.0, k: 4, s: rng() * 100, t0: SPLASH_T, v: 2.2, amp: 0, ph: 0 },
    ];
    const posS = new Float32Array(6);
    const seedS = new Float32Array(2);
    const kindS = new Float32Array(2);
    const auxS = new Float32Array(8);
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
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
    });
    const silPts = new THREE.Points(silGeo, silMat);
    silPts.frustumCulled = false;
    silPts.renderOrder = 5;
    sc.add(silPts);

    // --- camera: low tracking drift along the gutter after the lead boat
    ctx.rig.setLensMm(48);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let w = 0; w <= 24; w++) {
      const wt = ctx.sceneCtx.start + (w / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: w / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    pbStates.set(ctx, { skyMat, groundMat, addMat, silMat, boats, drips });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const st = pbStates.get(ctx)!;
    st.skyMat.uniforms.uT.value = t;
    st.groundMat.uniforms.uT.value = t;
    st.addMat.uniforms.uT.value = t;
    st.silMat.uniforms.uT.value = t;
    ctx.updateCamera(t, f.p);
    const cp = ctx.rig.position;
    (st.groundMat.uniforms.uCam.value as THREE.Vector3).set(cp[0], cp[1], cp[2]);
    st.addMat.uniforms.uPx.value = out.height / 1080;
    st.silMat.uniforms.uPx.value = out.height / 1080;

    // cloud gap: sun lane opens 15.5s → 21s, drifting slightly
    const gap = Math.min(1, Math.max(0, (t - 15.5) / 2.0)) *
                (1 - Math.min(1, Math.max(0, (t - 21.0) / 2.5)));
    st.groundMat.uniforms.uCloudGap.value = 0.25 + 0.75 * gap;

    // ---- boats on the flow
    for (let i = 0; i < st.boats.length; i++) {
      const b = st.boats[i];
      const t0i = BOAT_T0 + i * 2.1;
      b.visible = t >= t0i - 0.05;
      const z = boatZByIndex(i, t);
      const x = boatX(i, t, z);
      b.position.set(x, GROUND_Y + 0.045, z);
      // bob on wavelets + tilt into the local eddy
      const bob = 0.035 * Math.sin(t * 2.1 + i * 1.7) +
                  0.02 * Math.sin(t * 3.7 + i * 2.9);
      const eddyTilt = eddyX(z, i * 0.37 + 0.13, t) * 0.35;
      b.rotation.z = bob + eddyTilt;
      b.rotation.x = 0.06 * Math.sin(t * 1.8 + i * 2.3);
      // boat 3 wiggles while snagged on the leaf dam
      if (i === 2 && t > SNAG_T && t < FREE_T) {
        const wig = Math.min(1, (t - SNAG_T) / 0.6) * Math.min(1, (FREE_T - t) / 0.8);
        b.rotation.z += wig * 0.30 * Math.sin(t * 9.0);
        b.position.x += wig * 0.10 * Math.sin(t * 12.0 + 1.0);
      }
      // gust scoot: sail heels over as boat 4 pulls ahead
      if (i === 4 && t > GUST_T && t < GUST_T + 2.5) {
        const g = Math.sin(Math.min(1, (t - GUST_T) / 2.5) * Math.PI);
        b.rotation.z += g * 0.45;
      }
      // frame tremor keyed deterministically (hash-free jitter)
      b.rotation.y += 0.012 * Math.sin(t * 23.0 + i * 9.0);
    }

    // ---- rings: splash + curb drip plops feed the uniform array
    const rings = st.groundMat.uniforms.uRings.value as THREE.Vector3[];
    const act: { x: number; z: number; t0: number }[] = [];
    // sneaker splash ring
    const splashAge = t - (SPLASH_T + 0.55);
    if (splashAge > 0 && splashAge <= 3.5) act.push({ x: -1.0, z: -30.0, t0: SPLASH_T + 0.55 });
    // curb drip plops: mirror of the vertex-shader cycle
    for (const d of st.drips) {
      const cyc = d.gather + d.fall + d.rest;
      const k = Math.floor((t - d.off) / cyc);
      for (let m = Math.max(0, k - 1); m <= k; m++) {
        const plopT = d.off + m * cyc + d.gather + d.fall;
        const age = t - plopT;
        if (age > 0 && age <= 3.5) act.push({ x: d.x - 0.35, z: d.z, t0: plopT });
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

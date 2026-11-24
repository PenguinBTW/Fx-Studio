// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene } from "../../engine/dsl";
import type { CameraWaypoint } from "../../engine/rig";

// ---------------------------------------------------------------------------
// orchidbloom — macro time-lapse of a single orchid opening at dawn. A mossy
// stem carries four buds; the hero bud's sepals peel back in stages, petals
// unfurl to a white-pink face with a spotted lip, hover-flies arrive, a dew
// bead slides off a petal tip, and dawn shafts drift through the canopy.
// All motion is closed-form f(t) with hash seeds — no simulation state.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DUR = 24;
const MOUND_Y = -0.78;                    // moss silhouette rim
const HERO = { x: 0.15, y: 0.52, z: -2.1 };      // hero bloom center
const SEPAL_T = [5.0, 6.4, 7.8];          // three staggered sepal peels
const PETAL_T = [9.8, 10.5, 11.2, 11.9, 12.6]; // petal unfurl staggers
const LIP_T = 12.2;                       // labellum flare
const BUD2_T = 17.5;                      // neighbouring bud stirs late
const FLIES_T = [14.7, 15.6];             // fly entries
const FLY_LAND = [16.8, 18.6];            // lip landings
const THREAD = { t0: 15.2, t1: 17.9 };    // spider thread drop window
const DROP = { grow0: 19.6, grow1: 20.6, slide1: 22.3, fall1: 23.3 };
const GLINT = { t0: 20.7, t1: 21.5 };     // sun glint across the lip

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

// ---------------------------------------------------------------------------
// stem + buds — tapered-ribbon silhouettes; the mound is painted on the
// backdrop but its rim also gets a few moss clumps as ribbons
// ---------------------------------------------------------------------------

function ribInto(pos: number[], col: number[], x0: number, y0: number, x1: number, y1: number,
  w0: number, w1: number, z: number, c: number[]) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w0 * 0.5, ny = (dx / len) * w0 * 0.5;
  const mx = (-dy / len) * w1 * 0.5, my = (dx / len) * w1 * 0.5;
  pos.push(x0 + nx, y0 + ny, z, x0 - nx, y0 - ny, z, x1 + mx, y1 + my, z,
           x0 - nx, y0 - ny, z, x1 - mx, y1 - my, z, x1 + mx, y1 + my, z);
  for (let i = 0; i < 6; i++) col.push(...c);
}

interface Bud { x: number; y: number; z: number; scale: number; t0: number; openCap: number }

function buildStem(seed: number): { geo: THREE.BufferGeometry; buds: Bud[] } {
  const rng = mulberry32(seed);
  const pos: number[] = [], col: number[] = [];
  const z = -2.35;
  const stemC = [0.16, 0.28, 0.13];

  // stem: gentle S-curve from the mound up to the hero bud
  const path = [
    [-1.55, MOUND_Y - 0.05], [-1.30, -0.55], [-1.05, -0.18],
    [-0.72, 0.10], [-0.32, 0.33], [HERO.x, HERO.y - 0.06],
  ];
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i], [x1, y1] = path[i + 1];
    const w0 = 0.045 - i * 0.005, w1 = 0.045 - (i + 1) * 0.005;
    ribInto(pos, col, x0, y0, x1, y1, Math.max(w0, 0.012), Math.max(w1, 0.012), z, stemC);
  }
  // moss clumps on the mound rim
  for (let i = 0; i < 10; i++) {
    const x = -3.2 + rng() * 6.4;
    const h = 0.03 + rng() * 0.05;
    ribInto(pos, col, x - 0.08, MOUND_Y, x, MOUND_Y + h, 0.05, 0.02, -3.0, [0.10, 0.16, 0.08]);
    ribInto(pos, col, x, MOUND_Y + h, x + 0.08, MOUND_Y, 0.02, 0.05, -3.0, [0.10, 0.16, 0.08]);
  }
  // a backlit leaf or two at the base catching first light
  ribInto(pos, col, -1.45, MOUND_Y + 0.02, -2.1, MOUND_Y + 0.42, 0.10, 0.015, -2.5, [0.14, 0.30, 0.14]);
  ribInto(pos, col, -1.45, MOUND_Y + 0.02, -0.95, MOUND_Y + 0.30, 0.10, 0.015, -2.5, [0.13, 0.27, 0.13]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));

  const buds: Bud[] = [
    { x: HERO.x, y: HERO.y, z: -2.1, scale: 1.0, t0: -1, openCap: 1 },          // hero — staged below
    { x: -0.62, y: 0.10, z: -2.5, scale: 0.62, t0: -1, openCap: 0.42 },          // half-open, static
    { x: -1.02, y: -0.30, z: -2.55, scale: 0.55, t0: BUD2_T, openCap: 0.55 },    // late opener
    { x: -0.78, y: -0.55, z: -2.6, scale: 0.48, t0: Infinity, openCap: 0 },      // stays closed
  ];
  return { geo, buds };
}

// ---------------------------------------------------------------------------
// bloom geometry — sepals + petals + lip as triangle strips carrying paired
// aClosed/aOpen positions; a single uOpen per bloom mixes folded → spread
// ---------------------------------------------------------------------------

function buildBloom(bud: Bud, seed: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const posC: number[] = [], posO: number[] = [], colA: number[] = [], offA: number[] = [];
  const { x: cx, y: cy, z, scale: S } = bud;
  const UP = Math.PI / 2;

  // strip between two radial edges: emit paired edge verts along u.
  // zoff staggers petals in depth so folded layers don't z-fight.
  const petal = (ang: number, len: number, wid: number, curl: number, off: number,
    cTip: number[], cMid: number[], cBase: number[], zoff: number, cLenF = 1.0) => {
    const N = 7;
    const ex = Math.cos(ang), ey = Math.sin(ang);
    const px = -ey, py = ex;
    const edge = (u: number, side: number) => {
      // open pose — radial out, curling back by curl * u^1.7
      const r = len * u * S;
      const bend = curl * Math.pow(u, 1.7) * S;
      const w = wid * Math.sin(Math.PI * Math.min(1, u * 1.25)) * (0.4 + 0.6 * u) * S + 0.008 * S;
      const ox = cx + ex * (r - bend) + px * w * side;
      const oy = cy + ey * (r - bend) + py * w * side;
      // closed pose — tips converge to a pointed bud, width collapsed
      const fAng = ang + (UP - ang) * 0.94;
      const fx = Math.cos(fAng), fy = Math.sin(fAng);
      const fr = len * 0.72 * cLenF * u * S;
      const fw = w * 0.18;
      const fxo = cx + fx * fr + (-fy) * fw * side;
      const fyo = cy + fy * fr + fx * fw * side + 0.015 * S * Math.sin(u * Math.PI);
      return [fxo, fyo, ox, oy];
    };
    let prev: number[] | null = null;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = edge(u, -1), b = edge(u, 1);
      const shade = u;
      const c = u < 0.5 ? cBase : (u < 0.85 ? cMid : cTip);
      if (prev) {
        const pushV = (v: number[]) => {
          posC.push(v[0], v[1], z + zoff); posO.push(v[2], v[3], z + zoff);
          colA.push(...c); offA.push(off + shade * 0.18);
        };
        pushV([prev[0], prev[1], prev[2], prev[3]]);
        pushV([prev[4], prev[5], prev[6], prev[7]]);
        pushV(a); pushV([prev[4], prev[5], prev[6], prev[7]]); pushV(a); pushV(b);
      }
      prev = [a[0], a[1], a[2], a[3], b[0], b[1], b[2], b[3]];
    }
  };

  // closed teardrop shell — a green bud cap that hides the folded petals
  {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      // bud outline: base at cy-0.06, tip at cy+0.42*S, widest low
      const y0 = cy - 0.06 * S + 0.48 * S * u0, y1 = cy - 0.06 * S + 0.48 * S * u1;
      const w0 = 0.14 * S * Math.sin(Math.PI * Math.min(1, 0.15 + u0 * 0.95));
      const w1 = 0.14 * S * Math.sin(Math.PI * Math.min(1, 0.15 + u1 * 0.95));
      const gc = [0.16, 0.30, 0.14];
      const zo = z + 0.045;
      posC.push(cx - w0, y0, zo, cx + w0, y0, zo, cx - w1, y1, zo,
                cx + w0, y0, zo, cx + w1, y1, zo, cx - w1, y1, zo);
      // aOpen collapses the shell into the calyx cup under the open bloom
      const openW0 = w0 * 0.25, openW1 = w1 * 0.25;
      const oy0 = cy - 0.06 * S + 0.10 * S * u0, oy1 = cy - 0.06 * S + 0.10 * S * u1;
      posO.push(cx - openW0, oy0, zo, cx + openW0, oy0, zo, cx - openW1, oy1, zo,
                cx + openW0, oy0, zo, cx + openW1, oy1, zo, cx - openW1, oy1, zo);
      for (let k = 0; k < 6; k++) { colA.push(...gc); offA.push(0.0); }
    }
  }

  const GREEN = { tip: [0.30, 0.44, 0.20] as number[], mid: [0.22, 0.35, 0.16] as number[], base: [0.15, 0.25, 0.12] as number[] };
  const PETAL = { tip: [0.97, 0.90, 0.93] as number[], mid: [0.93, 0.80, 0.86] as number[], base: [0.82, 0.52, 0.62] as number[] };
  const LIP = { tip: [0.68, 0.22, 0.48] as number[], mid: [0.80, 0.38, 0.58] as number[], base: [0.55, 0.14, 0.38] as number[] };

  // three sepals — longer, earlier offsets
  const sepalAngs = [Math.PI / 2 - 0.5, Math.PI / 2 + 0.55, Math.PI + Math.PI / 2 - 1.35];
  for (let i = 0; i < 3; i++) {
    const ang = sepalAngs[i] + (rng() - 0.5) * 0.12;
    petal(ang, 0.62, 0.10, 0.30, i === 0 ? 0 : i === 1 ? 0.15 : 0.3,
      GREEN.tip, GREEN.mid, GREEN.base, -0.012 - i * 0.004);
  }
  // five petals — fanned below/around, later offsets
  const petalAngs = [Math.PI / 2 + 0.15, Math.PI / 2 - 0.85, Math.PI / 2 + 1.15,
    -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.75];
  for (let i = 0; i < 5; i++) {
    const ang = petalAngs[i] + (rng() - 0.5) * 0.10;
    petal(ang, 0.55, 0.16, 0.22, 0.55 + i * 0.08,
      PETAL.tip, PETAL.mid, PETAL.base, 0.004 + i * 0.004, 0.78);
  }
  // labellum — short wide frilly fan pointing down; spots baked into colors
  {
    const N = 9;
    let prevV: number[] | null = null, prevC: number[] = LIP.mid;
    const pushV = (v: number[], cc: number[]) => {
      posC.push(v[0], v[1], z + 0.01); posO.push(v[2], v[3], z + 0.01);
      colA.push(...cc); offA.push(0.92);
    };
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a0 = -Math.PI / 2 - 0.42 + u * 0.84;
      const rr = 0.30 * S;
      const ox = cx + Math.cos(a0) * rr, oy = cy + Math.sin(a0) * rr;
      const fx = cx + Math.cos(a0 + (UP - a0) * 0.82) * rr * 0.72;
      const fy = cy + Math.sin(a0 + (UP - a0) * 0.82) * rr * 0.72;
      const c = rng() < 0.4 ? [0.42, 0.08, 0.30] : LIP.mid;
      const vtx = [fx, fy, ox, oy];
      if (prevV) {
        const baseV = [cx, cy, cx + 0.01 * S, cy];
        pushV(prevV, prevC); pushV(baseV, LIP.base); pushV(vtx, c);
        pushV(prevV, prevC); pushV(vtx, c); pushV(baseV, LIP.base);
      }
      prevV = vtx; prevC = c;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posC), 3));
  geo.setAttribute("aOpen", new THREE.BufferAttribute(new Float32Array(posO), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colA), 3));
  geo.setAttribute("aOff", new THREE.BufferAttribute(new Float32Array(offA), 1));
  return geo;
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// backdrop — dark rainforest moss, teal bokeh gaps, drifting dawn shafts,
// mound silhouette along the bottom, beat-by-beat exposure
const BACK_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uT;
uniform float uShaft;   // dawn-shaft brightness ramp
uniform float uGlow;    // overall exposure for the open-bloom beat
uniform vec2 uLane;     // shaft lane x positions
void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  // deep moss — near-black green, cooler up top
  vec3 col = mix(vec3(0.030, 0.055, 0.035), vec3(0.012, 0.030, 0.020), smoothstep(-3.0, 2.6, q.y));
  // canopy bokeh — soft teal-green blobs, slow breathing
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(-3.4 + fi * 2.2 + 0.4 * sin(uT * 0.05 + fi * 3.1), 2.2 + 0.35 * sin(fi * 2.3));
    float d = length(q - c);
    float a = (1.0 - smoothstep(0.25, 1.35 + 0.3 * sin(fi * 5.0), d))
            * (0.16 + 0.05 * sin(uT * 0.22 + fi * 4.0));
    col += vec3(0.16, 0.30, 0.22) * a;
  }
  // dawn shafts — two diagonal lanes sliding with the canopy
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float lane = (i == 0 ? uLane.x : uLane.y) + q.y * 0.55;
    float dShaft = (q.x - lane) * 1.4;
    col += vec3(0.55, 0.62, 0.42) * uShaft * exp(-dShaft * dShaft) * (0.5 - fi * 0.18);
  }
  // mound silhouette — lumpy rim
  float rim = -0.86 + 0.06 * sin(q.x * 2.1) + 0.03 * sin(q.x * 5.3 + 1.7);
  if (q.y < rim) {
    col = vec3(0.015, 0.028, 0.014);
    // wet sheen right at the rim
    col += vec3(0.10, 0.16, 0.10) * (1.0 - smoothstep(0.0, 0.10, rim - q.y)) * 0.6;
  }
  col *= 0.85 + 0.35 * uGlow;
  gl_FragColor = vec4(col, 1.0);
}`;

// stem/leaf/moss ribbons — subtle sway
const RIB_VERT = /* glsl */ `
uniform float uT;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  p.x += 0.012 * sin(uT * 0.8 + p.y * 2.0) * smoothstep(-0.9, 0.5, p.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const RIB_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, uA); }`;

// bloom — vertices carry folded (position) and open (aOpen) poses; aOff
// staggers sepals → petals → lip within one uOpen ramp; bud sway on top
const BLOOM_VERT = /* glsl */ `
attribute vec3 aOpen;
attribute float aOff;
uniform float uU;     // 0..1 open progress for this bloom
uniform float uT;
uniform float uSway;  // bloom sway amplitude (breeze beat)
varying vec3 vC;
varying float vU;
void main() {
  vC = color;
  // window shrinks for late offsets so every vertex finishes at uU = 1
  float u = clamp((uU - aOff) / max(0.001, min(0.45, 1.0 - aOff)), 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  vU = u;
  vec3 p = mix(position, aOpen, u);
  p.x += uSway * (0.010 * sin(uT * 1.1 + p.y * 4.0) + 0.006 * sin(uT * 2.3));
  p.y += uSway * 0.008 * sin(uT * 0.9 + p.x * 3.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const BLOOM_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vC;
varying float vU;
uniform float uGlow;
void main() { gl_FragColor = vec4(vC * (0.82 + 0.30 * uGlow * vU), 1.0); }`;

// spider thread — unit segment stretched by uLen; bottom keeps a droplet hint
const THREAD_VERT = /* glsl */ `
uniform float uLen;
varying float vV;
void main() {
  vV = -position.y;
  vec3 p = position;
  p.y = 1.62 + position.y * uLen;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const THREAD_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying float vV;
void main() { gl_FragColor = vec4(0.75, 0.78, 0.80, uA * (1.0 - vV * 0.4)); }`;

// ---------------------------------------------------------------------------
// point cloud — 0 bokeh motes, 1 fly body, 2 fly halo, 3 millipede segments,
// 4 dew droplet, 5 spider dot, 6 sun glint on the lip
// --------------------------------------------------------------------------

const PT_VERT = /* glsl */ `
attribute float aKind;
attribute float aSeed;
attribute float aT0;
attribute float aT1;
attribute float aOn;
attribute vec3 aTo;
uniform float uT;
uniform float uPx;
varying float vA;
varying float vKind;
void main() {
  vKind = aKind;
  vec3 p = position;
  float a = 0.0; float sz = 2.0;
  if (aKind < 0.5) {
    // bokeh motes drifting through the shafts
    float sp = 0.03 + 0.04 * fract(aSeed * 3.0);
    p.x += mod(uT * sp + aSeed * 5.0, 9.0) - 4.5 - p.x;
    p.y += 0.12 * sin(uT * 0.12 + aSeed * 7.0);
    a = (0.10 + 0.06 * sin(uT * 0.3 + aSeed * 11.0));
    sz = 60.0 + fract(aSeed * 17.0) * 70.0;
  } else if (aKind < 2.5) {
    // hover-fly body (1) + halo (2) — circle the bloom, land on the lip
    float inW = step(aT0, uT) * step(uT, aT1);
    float ph = aSeed * 17.0;
    float orbit = uT - aT0;
    float land = smoothstep(aTo.y, aTo.y + 1.0, uT);
    vec2 c = vec2(aTo.x, 0.52);
    vec2 o = vec2(cos(orbit * 4.0 + ph), sin(orbit * 4.0 + ph) * 0.55) * 0.42 * (1.0 - land);
    vec2 lipP = vec2(c.x + 0.06 * sin(ph), c.y - 0.20);
    p.xy = c + o + (lipP - c) * land;
    p.xy += land * 0.004 * vec2(sin(uT * 9.0 + ph), cos(uT * 7.0 + ph));
    float buzz = (1.0 - land) * (0.5 + 0.5 * sin(uT * 40.0 + ph));
    a = inW * (aKind < 1.5 ? 0.85 : 0.22 + 0.20 * buzz);
    sz = aKind < 1.5 ? 4.5 : 14.0;
  } else if (aKind < 3.5) {
    // millipede segments marching along the mound rim (aSeed = segment idx)
    float u = clamp((uT - aT0) / aT1, 0.0, 1.0);
    p.x = position.x + 1.0 * u - aSeed * 0.055;
    p.y = -0.84 + 0.06 * sin(p.x * 2.1) + 0.03 * sin(p.x * 5.3 + 1.7)
        + 0.012 * sin(u * 20.0 - aSeed * 1.2);
    a = step(aT0, uT) * step(u, 0.985) * 0.9;
    sz = 5.0 - aSeed * 0.25;
  } else if (aKind < 4.5) {
    // dew droplet — grow at the petal edge, slide down, fall off the tip.
    // aTo = [growStart, slideStart, fallEnd]; slide runs slideStart→fallEnd
    // with the last quarter accelerating into free fall.
    float grow = smoothstep(aTo.x, aTo.y, uT);
    float u = smoothstep(aTo.y, aTo.z, uT);
    // slide reaches the modeled petal tip (~0.37, 0.28) exactly at u=0.72
    p.x = position.x + 0.16 * u * u;
    p.y = position.y - 0.17 * u * u - 9.0 * pow(max(0.0, u - 0.72), 2.0);
    a = grow * (0.9 - 0.3 * u) * (1.0 - smoothstep(0.93, 1.0, u));
    sz = 5.0 + 6.0 * grow;
  } else if (aKind < 5.5) {
    // spider dot at the thread's lower end
    // same window as the thread's sstep(t0, t1 - 0.4) so the spider rides the tip
    float u = smoothstep(aT0, aT1 - 0.4, uT);
    p.y = 1.62 - 1.9 * u;
    a = step(aT0, uT) * (1.0 - smoothstep(aT1 - 0.15, aT1, uT)) * 0.8;
    sz = 3.5;
  } else {
    // sun glint sweeping the lip
    float w = smoothstep(aT0, aT0 + 0.35, uT) * (1.0 - smoothstep(aT1 - 0.35, aT1, uT));
    p.x += 0.05 * sin(uT * 3.0);
    a = w * (0.7 + 0.3 * sin(uT * 18.0));
    sz = 9.0;
  }
  vA = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = sz * (3.4 / -mv.z) * uPx;
  gl_Position = projectionMatrix * mv;
}`;

const PT_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
varying float vKind;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float soft = 1.0 - smoothstep(0.15, 0.5, d);
  vec3 col;
  if (vKind < 0.5) col = vec3(0.55, 0.68, 0.55);              // motes — pale green
  else if (vKind < 1.5) col = vec3(0.10, 0.08, 0.05);         // fly body — dark
  else if (vKind < 2.5) col = vec3(0.95, 0.85, 0.60);         // fly halo — warm blur
  else if (vKind < 3.5) col = vec3(0.10, 0.07, 0.05);         // millipede — dark
  else if (vKind < 4.5) col = vec3(0.80, 0.92, 0.95);         // dew — cool bead
  else if (vKind < 5.5) col = vec3(0.12, 0.10, 0.08);         // spider — dark dot
  else col = vec3(1.0, 0.92, 0.70);                           // glint — warm sun
  gl_FragColor = vec4(col, vA * soft);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface FU {
  back: THREE.ShaderMaterial;
  ribMat: THREE.ShaderMaterial;
  bloomMats: THREE.ShaderMaterial[];
  threadMat: THREE.ShaderMaterial;
  ptMat: THREE.ShaderMaterial;
}

const U = new WeakMap<object, FU>();

const scene = defineScene({
  id: "orchidbloom",

  setup: async (ctx) => {
    const rig = ctx.rig;
    rig.setLensMm(70);
    // very slow push-in toward the hero bloom with a tiny orbit drift
    const wps: CameraWaypoint[] = [
      { t: 0.0,  pos: [-0.10, 0.05, 3.9], target: [-0.20, 0.15, -2.2] },
      { t: 0.30, pos: [-0.02, 0.06, 3.7], target: [-0.05, 0.25, -2.2] },
      { t: 0.62, pos: [0.10, 0.08, 3.5],  target: [0.12, 0.42, -2.2] },
      { t: 1.0,  pos: [0.18, 0.10, 3.35], target: [0.15, 0.50, -2.2] },
    ];
    rig.setPath(wps);
    (rig as any).pathTiming = "keyed";

    // ---- backdrop -----------------------------------------------------------
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 7.5),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG,
        uniforms: {
          uRes: { value: new THREE.Vector2(16, 9) },
          uT: { value: 0 }, uShaft: { value: 0.25 }, uGlow: { value: 0 },
          uLane: { value: new THREE.Vector2(-1.5, 1.8) },
        },
      }),
    );
    back.position.z = -3.4;
    ctx.scene3D.add(back);

    // ---- stem + mound clumps ------------------------------------------------
    const { geo: stemGeo, buds } = buildStem(4147);
    const ribMat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT, fragmentShader: RIB_FRAG,
      uniforms: { uT: { value: 0 }, uA: { value: 1.0 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    ctx.scene3D.add(new THREE.Mesh(stemGeo, ribMat));

    // ---- buds — closed green teardrops pre-bloom are just blooms at uOpen=0
    const bloomMats: THREE.ShaderMaterial[] = [];
    buds.forEach((b, i) => {
      const geo = buildBloom(b, 800 + i * 131);
      const mat = new THREE.ShaderMaterial({
        vertexShader: BLOOM_VERT, fragmentShader: BLOOM_FRAG,
        uniforms: { uU: { value: 0 }, uT: { value: 0 }, uSway: { value: 0.4 }, uGlow: { value: 0 } },
        vertexColors: true, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
      bloomMats.push(mat);
    });

    // ---- spider thread ------------------------------------------------------
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
      0.95, 0, -2.9, 0.95, -1, -2.9,
    ]), 3));
    const threadMat = new THREE.ShaderMaterial({
      vertexShader: THREAD_VERT, fragmentShader: THREAD_FRAG,
      uniforms: { uLen: { value: 0 }, uA: { value: 0 } },
      transparent: true,
    });
    ctx.scene3D.add(new THREE.LineSegments(tGeo, threadMat));

    // ---- point cloud --------------------------------------------------------
    const rng = mulberry32(902);
    const pp: number[] = [], pk: number[] = [], ps: number[] = [], pT0: number[] = [],
      pT1: number[] = [], pOn: number[] = [], pTo: number[] = [];
    const addPt = (kind: number, seed: number, t0: number, t1: number,
      pos: number[], to: number[], on = 0) => {
      pp.push(...pos); pk.push(kind); ps.push(seed); pT0.push(t0); pT1.push(t1);
      pOn.push(on); pTo.push(...to);
    };
    for (let i = 0; i < 14; i++)   // bokeh motes
      addPt(0, rng() * 29, 0, DUR, [-4 + rng() * 8, -0.5 + rng() * 3.4, -3.0], [0, 0, 0]);
    for (let i = 0; i < 2; i++) {  // hover-flies: aTo = [orbitCx, landT, 0]
      addPt(1, i * 3.7 + 1, FLIES_T[i], 23.5, [0, 0, -1.95], [HERO.x, FLY_LAND[i], 0]);
      addPt(2, i * 3.7 + 1, FLIES_T[i], 23.5, [0, 0, -1.95], [HERO.x, FLY_LAND[i], 0]);
    }
    for (let i = 0; i < 14; i++)   // millipede — aSeed = segment index
      addPt(3, i, 0.8, 3.4, [-1.55, -0.84, -2.6], [0, 0, 0]);
    // dew droplet — aTo = [growStart, slideStart, fallEnd];
    // seeds on the lower-right petal's open midrib, slides to the tip
    addPt(4, 3.1, 0, DUR, [0.29, 0.37, -1.9], [DROP.grow0, DROP.grow1, DROP.fall1]);
    addPt(5, 7.7, THREAD.t0, THREAD.t1, [0.95, 0, -2.9], [0, 0, 0]);   // spider
    addPt(6, 9.9, GLINT.t0, GLINT.t1, [HERO.x + 0.05, HERO.y - 0.18, -1.9], [0, 0, 0]); // lip glint

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pp), 3));
    pg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(pk), 1));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(ps), 1));
    pg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(pT0), 1));
    pg.setAttribute("aT1", new THREE.BufferAttribute(new Float32Array(pT1), 1));
    pg.setAttribute("aOn", new THREE.BufferAttribute(new Float32Array(pOn), 1));
    pg.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(pTo), 3));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(pg, ptMat);
    pts.frustumCulled = false;
    ctx.scene3D.add(pts);

    U.set(ctx, { back: back.material as THREE.ShaderMaterial, ribMat, bloomMats, threadMat, ptMat });
  },

  render: (ctx, f, out) => {
    const t = f.t;
    const st = U.get(ctx)!;

    // beat envelopes
    const glow = sstep(10.0, 15.0, t) * (1.0 - 0.3 * sstep(22.5, DUR, t));
    const shaft = 0.25 + 0.55 * sstep(9.5, 13.5, t);

    st.back.uniforms.uT!.value = t;
    st.back.uniforms.uShaft!.value = shaft;
    st.back.uniforms.uGlow!.value = glow;
    (st.back.uniforms.uLane!.value as THREE.Vector2).set(
      -1.5 + 1.1 * Math.sin(t * 0.09), 1.8 - 0.9 * Math.sin(t * 0.07 + 2.0));

    st.ribMat.uniforms.uT!.value = t;

    // hero: sepals peel 5→9, petals 9.8→13, lip 12.2→13.5 — one uOpen ramp
    // covering the whole staged unfurl; stagger lives in the aOff attribute
    const heroU = clamp01((t - SEPAL_T[0]) / (PETAL_T[4] + 1.6 - SEPAL_T[0]));
    st.bloomMats[0].uniforms.uU!.value = heroU;
    st.bloomMats[1].uniforms.uU!.value = 0.40;   // half-open, static
    st.bloomMats[2].uniforms.uU!.value = 0.55 * sstep(BUD2_T, BUD2_T + 3.0, t);
    st.bloomMats[3].uniforms.uU!.value = 0.0;    // never opens
    const breeze = 0.4 + 0.5 * sstep(13.0, 15.0, t) * (1 - sstep(21.0, 23.0, t));
    for (const m of st.bloomMats) {
      m.uniforms.uT!.value = t;
      m.uniforms.uSway!.value = breeze;
      m.uniforms.uGlow!.value = glow;
    }

    // spider thread — drops past once, then vanishes
    const th = sstep(THREAD.t0, THREAD.t1 - 0.4, t);
    st.threadMat.uniforms.uLen!.value = 1.9 * th;
    st.threadMat.uniforms.uA!.value = (t > THREAD.t0 ? 1 : 0) * (1 - sstep(THREAD.t1 - 0.15, THREAD.t1, t)) * 0.55;

    st.ptMat.uniforms.uT!.value = t;
    st.ptMat.uniforms.uPx!.value = out.height / 1080;

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

export default scene;

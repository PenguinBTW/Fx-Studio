// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene } from "../../engine/dsl";
import type { CameraWaypoint } from "../../engine/rig";

// ---------------------------------------------------------------------------
// dawnrookery — a heron rookery waking in a flooded marsh at first light.
// Drowned tree skeletons hold stick nests above mirror-flat water; herons
// arrive on slow wing-beat glides, a hero rises from the water carrying a
// fish, a kingfisher streaks past, and the sun clears the rim at the end.
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
const WATER_Y = -0.85;                 // mirror line
const SUN_T0 = 20.5;                   // sun-clearing-rim window
const HERO = { rise: 11.8, land: 12.9 };
const KINGFISHER = { t0: 16.5, dur: 1.5 };
const MURM = { t0: 14.0, t1: 20.0 };

// ---------------------------------------------------------------------------
// trees + nests — drowned skeletons (trunk, upward limbs) and twig-bundle
// nests at branch junctions. Vertex colors darken by depth. Mirrored copy is
// built by flipping y around the waterline for the water plane reflection.
// --------------------------------------------------------------------------

interface TreeSet { geo: THREE.BufferGeometry; refl: THREE.BufferGeometry; nests: { x: number; y: number }[]; trunks: number[]; }

function buildTrees(seed: number): TreeSet {
  const rng = mulberry32(seed);
  const pos: number[] = [], col: number[] = [];
  const nests: { x: number; y: number }[] = [];
  const trunks: number[] = [];

  // tapered ribbon — two triangles per segment (GL lines are always 1px wide)
  const rib = (x0: number, y0: number, x1: number, y1: number,
    w0: number, w1: number, z: number, c: number[]) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w0 * 0.5, ny = (dx / len) * w0 * 0.5;
    const mx = (-dy / len) * w1 * 0.5, my = (dx / len) * w1 * 0.5;
    const v = [
      x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 + mx, y1 + my,
      x0 - nx, y0 - ny, x1 - mx, y1 - my, x1 + mx, y1 + my,
    ];
    for (let i = 0; i < 12; i += 2) { pos.push(v[i], v[i + 1], z); col.push(...c); }
  };

  // twig stroke — same ribbon path at hair width
  const seg = (x0: number, y0: number, z: number, x1: number, y1: number, _z: number, c: number[]) =>
    rib(x0, y0, x1, y1, 0.008, 0.004, z, c);

  // 7 drowned trunks, two depth bands (far z=-3.2 lighter, near z=-2.65 dark)
  const xs = [-3.0, -2.2, -1.35, -0.5, 0.45, 1.35, 2.35];
  for (let i = 0; i < xs.length; i++) {
    const far = i % 2 === 0;
    const z = far ? -3.25 : -2.65;
    const c = far ? [0.16, 0.22, 0.28] : [0.05, 0.07, 0.10];
    const x0 = xs[i] + (rng() - 0.5) * 0.25;
    trunks.push(x0);
    const lean = (rng() - 0.5) * 0.35;
    const h = 1.5 + rng() * 1.0;
    // trunk in three kinked pieces, wide base tapering to the tip
    const k1x = x0 + lean * 0.33 + (rng() - 0.5) * 0.10;
    const k1y = -0.85 + h * 0.40;
    const k2x = x0 + lean * 0.66 + (rng() - 0.5) * 0.10;
    const k2y = -0.95 + h * 0.72;
    rib(x0, -0.85, k1x, k1y, 0.10, 0.062, z, c);
    rib(k1x, k1y, k2x, k2y, 0.062, 0.034, z, c);
    rib(k2x, k2y, x0 + lean, -0.95 + h, 0.034, 0.010, z, c);
    // limbs fanning up — nest sites recorded on 6 of them
    const limbs = 3 + Math.floor(rng() * 3);
    for (let l = 0; l < limbs; l++) {
      const t0 = 0.45 + (l / limbs) * 0.55;
      const bx = x0 + lean * t0, by = -0.95 + h * t0;
      const side = l % 2 === 0 ? 1 : -1;
      const lx = bx + side * (0.25 + rng() * 0.4);
      const ly = by + 0.1 + rng() * 0.35;
      const jx = bx + (lx - bx) * 0.55 + (rng() - 0.5) * 0.05;
      const jy = by + (ly - by) * 0.55 + (rng() - 0.5) * 0.05;
      rib(bx, by, jx, jy, 0.026, 0.015, z, c);
      rib(jx, jy, lx, ly, 0.015, 0.006, z, c);
      // twiggy tips
      if (rng() < 0.7) seg(lx, ly, z, lx + side * 0.15, ly + 0.12, z, c);
      if (rng() < 0.45) seg(lx, ly, z, lx - side * 0.08, ly + 0.16, z, c);
      // stick nest cradled on the fork — dense twig bundle
      if (nests.length < 6 && t0 > 0.5 && rng() < 0.75) {
        const nx = bx + side * 0.07, ny = by + 0.07;
        nests.push({ x: nx, y: ny });
        for (let tw = 0; tw < 30; tw++) {
          const a = rng() * Math.PI, r = 0.14 + rng() * 0.15;
          const a2 = a + 0.5 + rng() * 1.2;
          seg(nx + Math.cos(a) * r, ny + Math.sin(a) * r * 0.28, z,
              nx + Math.cos(a2) * r, ny + Math.sin(a2) * r * 0.28, z, far ? [0.10, 0.13, 0.17] : c);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));

  // reflected copy — mirror y around the waterline
  const rpos = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    rpos[i] = pos[i];
    rpos[i + 1] = 2 * WATER_Y - pos[i + 1];
    rpos[i + 2] = pos[i + 2];
  }
  const refl = new THREE.BufferGeometry();
  refl.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
  refl.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  return { geo, refl, nests, trunks };
}

// ---------------------------------------------------------------------------
// heron glyph — a line-drawn silhouette in local coords (~0.45 tall, faces +x).
// aWing=1 marks wing verts (rotated about the shoulder by the flap envelope),
// aNeck=1 marks neck/head/beak (perched head-tilt), aItem=1 is the carried
// fish dangling below the chest during the hero's rise.
// ---------------------------------------------------------------------------

function heronGlyph(): THREE.BufferGeometry {
  // polylines [x0,y0, x1,y1] as tapered ribbons (wd = start width) so the
  // silhouette reads as a solid bird, not twig scribbles at this distance
  const S: { p: [number, number, number, number][]; w?: number; n?: number; item?: number; wd?: number }[] = [
    // body spine — tail to chest
    { p: [[-0.20, 0.10, -0.12, 0.055], [-0.12, 0.055, -0.02, 0.03], [-0.02, 0.03, 0.06, 0.05]], wd: 0.05 },
    // neck S-curve + head + beak
    { p: [[0.06, 0.05, 0.09, 0.14], [0.09, 0.14, 0.07, 0.22], [0.07, 0.22, 0.105, 0.27]], n: 1, wd: 0.022 },
    { p: [[0.105, 0.27, 0.19, 0.262]], n: 1, wd: 0.014 },
    // legs (trailing in flight reads as two thin strokes)
    { p: [[-0.02, 0.02, -0.045, -0.14], [0.005, 0.02, -0.01, -0.14]], wd: 0.014 },
    // belly — return line under the spine for a solid body read
    { p: [[0.06, 0.05, -0.02, -0.02], [-0.02, -0.02, -0.12, 0.0], [-0.12, 0.0, -0.20, 0.10]], wd: 0.055 },
    // near wing — shoulder fan: shoulder → elbow → tip, tip → trailing → back
    { p: [[-0.02, 0.08, -0.10, 0.18], [-0.10, 0.18, -0.24, 0.30], [-0.24, 0.30, -0.20, 0.18], [-0.20, 0.18, -0.10, 0.10]], w: 1, wd: 0.045 },
    // near-wing feather strokes
    { p: [[-0.10, 0.18, -0.28, 0.24], [-0.24, 0.30, -0.26, 0.16]], w: 1, wd: 0.025 },
    // far wing — slightly offset, same flags
    { p: [[-0.02, 0.08, -0.055, 0.17], [-0.055, 0.17, -0.14, 0.25], [-0.14, 0.25, -0.125, 0.14]], w: 1, wd: 0.03 },
    // carried fish — tiny dash below the chest
    { p: [[0.02, -0.02, 0.09, -0.045]], item: 1, wd: 0.02 },
  ];
  const pos: number[] = [], wing: number[] = [], neck: number[] = [], item: number[] = [];
  for (const s of S) {
    const n = s.p.length;
    s.p.forEach(([x0, y0, x1, y1], i) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w0 = (s.wd ?? 0.02) * (1 - 0.5 * (i / n)) * 0.5;
      const w1 = (s.wd ?? 0.02) * (1 - 0.5 * ((i + 1) / n)) * 0.5;
      const quad = [
        [x0 + nx * w0, y0 + ny * w0], [x0 - nx * w0, y0 - ny * w0],
        [x1 + nx * w1, y1 + ny * w1], [x1 - nx * w1, y1 - ny * w1],
      ];
      pos.push(...quad[0], 0, ...quad[1], 0, ...quad[2], 0);
      pos.push(...quad[1], 0, ...quad[3], 0, ...quad[2], 0);
      for (let k = 0; k < 6; k++) {
        wing.push(s.w ?? 0); neck.push(s.n ?? 0); item.push(s.item ?? 0);
      }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aWing", new THREE.BufferAttribute(new Float32Array(wing), 1));
  g.setAttribute("aNeck", new THREE.BufferAttribute(new Float32Array(neck), 1));
  g.setAttribute("aItem", new THREE.BufferAttribute(new Float32Array(item), 1));
  return g;
}

// ---------------------------------------------------------------------------
// point cloud — one draw call: 0 mist banks, 1 light motes, 2 hero droplets,
// 3 chick heads, 4 kingfisher streak, 5 murmuration dots
// --------------------------------------------------------------------------

const PT_VERT = /* glsl */ `
attribute float aKind;
attribute float aSeed;
attribute float aT0;
attribute float aT1;
attribute float aPartX;
attribute vec3 aTo;
uniform float uT;
uniform float uSunT;
varying float vA;
varying float vKind;
varying float vWarm;
void main() {
  vKind = aKind;
  vec3 p = position;
  float a = 0.0; float sz = 2.0; vWarm = 0.0;
  if (aKind < 0.5) {
    // mist banks — huge soft sprites drifting and parting around the trunks
    p.x += uT * 0.045 * (fract(aSeed * 7.0) - 0.5) * 2.0;
    float d = p.x - aPartX;
    p.x += sign(d) * 0.30 * (1.0 - smoothstep(0.0, 0.55, abs(d)));
    a = (0.16 + 0.07 * sin(uT * 0.2 + aSeed * 9.0)) * (0.55 + 0.45 * uSunT);
    sz = 160.0 + fract(aSeed * 13.0) * 90.0;
  } else if (aKind < 1.5) {
    // motes hanging in the first light
    p.x += 0.10 * sin(uT * 0.3 + aSeed * 9.0);
    p.y += 0.07 * sin(uT * 0.23 + aSeed * 13.0);
    a = (0.12 + 0.10 * sin(uT * 0.7 + aSeed * 21.0)) * smoothstep(0.0, 3.0, uT) * (0.4 + 0.6 * uSunT);
    vWarm = 0.6;
    sz = 2.4;
  } else if (aKind < 2.5) {
    // droplets falling off the hero's fish
    float u = uT - aT0;
    p.y = position.y - u * u * 1.4;
    p.x = position.x + u * (aTo.x - position.x);
    a = step(0.0, u) * step(u, aT1) * (1.0 - u / aT1) * 0.85;
    sz = 2.6;
    vWarm = 0.3;
  } else if (aKind < 3.5) {
    // chick heads popping up when the parent lands
    float on = smoothstep(aT0, aT0 + 0.35, uT);
    p.y += on * (0.05 + 0.015 * sin(uT * 3.0 + aSeed * 30.0));
    a = on * 0.9;
    sz = 4.2;
  } else if (aKind < 4.5) {
    // kingfisher streak — bright cyan dart + short trail (aSeed = trail index)
    float v = (aTo.x - position.x) / aT1;
    float u = uT - aT0;
    p.x = position.x + v * u - aSeed * 0.055;
    p.y = position.y + 0.06 * sin(u * 9.0);
    float on = step(0.0, u) * step(u, aT1);
    a = on * (1.0 - aSeed / 6.0) * 0.9;
    vWarm = -1.0;
    sz = 5.5 - aSeed * 0.6;
  } else {
    // murmuration dots — tight Lissajous swirl inside the blob
    float gate = smoothstep(aT0, aT0 + 1.2, uT) * (1.0 - smoothstep(aT1 - 1.5, aT1, uT));
    p.x += 0.30 * sin(uT * 0.7 + aSeed * 40.0) + 0.10 * sin(uT * 1.9 + aSeed * 11.0);
    p.y += 0.16 * sin(uT * 0.9 + aSeed * 27.0);
    a = gate * (0.35 + 0.30 * sin(uT * 1.3 + aSeed * 55.0));
    sz = 1.6;
  }
  vA = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = sz * (3.4 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const PT_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
varying float vKind;
varying float vWarm;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float soft = 1.0 - smoothstep(0.15, 0.5, d);
  vec3 col;
  if (vKind < 0.5) col = vec3(0.75, 0.80, 0.85);              // mist — pale grey-blue
  else if (vKind < 2.5) col = vec3(1.0, 0.85, 0.6);           // motes + droplets — warm
  else if (vKind < 4.5 && vWarm < -0.5) col = vec3(0.25, 0.85, 0.95); // kingfisher cyan
  else col = vec3(0.10, 0.12, 0.15);                          // chicks + murmur — dark
  gl_FragColor = vec4(col, vA * soft);
}`;

// ---------------------------------------------------------------------------
// expanding ring ripples on the water — ellipse circles whose radius and
// fade ride a single (uT - aT0)/aDur envelope
// --------------------------------------------------------------------------

const RING_VERT = /* glsl */ `
attribute float aT0;
attribute float aDur;
attribute vec2 aC;
uniform float uT;
uniform float uW;
varying float vA;
void main() {
  float u = (uT - aT0) / aDur;
  float on = step(0.0, u) * step(u, 1.0);
  float r = mix(0.03, 0.55 + 0.35 * fract(aT0), clamp(u, 0.0, 1.0));
  vec2 p = aC + vec2(position.x * r, position.y * r * 0.22);
  p.x += 0.01 * sin(uT * 1.1 + position.x * 9.0);
  vA = on * (1.0 - u) * 0.55;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, uW + 0.02 + p.y - r * 0.22, -2.7, 1.0);
}`;

const RING_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
void main() { gl_FragColor = vec4(0.65, 0.72, 0.78, vA); }`;

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform vec2 uRes;
uniform float uT;
uniform float uSunT;
uniform vec2 uSun;
uniform float uW;
varying vec2 vUv;

// seeded far-trunk x positions for the mirrored treeline smear
const float TX[7] = float[7](-3.0, -2.2, -1.35, -0.5, 0.45, 1.35, 2.35);

void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  // sky: pale apricot horizon into early blue
  vec3 sky = mix(vec3(0.93, 0.62, 0.38), vec3(0.10, 0.17, 0.30), smoothstep(-0.7, 1.7, q.y));
  sky += vec3(1.0, 0.75, 0.45) * uSunT * 0.25 * smoothstep(0.8, 0.0, q.y);
  // sun disc + halo clearing the rim
  float sd = length(q - uSun);
  sky += vec3(1.0, 0.72, 0.42) * exp(-sd * sd * 10.0) * (0.4 + 0.9 * uSunT);
  sky += vec3(1.0, 0.85, 0.6) * exp(-sd * sd * 90.0) * uSunT;

  if (q.y > uW) {
    // mist banks hugging the waterline — layered drifting veils
    float m = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float c = uW + 0.18 + fi * 0.14 + 0.05 * sin(uT * 0.25 + fi * 2.1);
      m += (1.0 - smoothstep(0.0, 0.16, abs(q.y - c)))
         * (0.5 + 0.5 * sin(q.x * (1.3 + fi * 0.7) + uT * (0.05 + fi * 0.04) + fi * 4.0));
    }
    sky = mix(sky, vec3(0.78, 0.80, 0.83), clamp(m * 0.35, 0.0, 0.5));
    gl_FragColor = vec4(sky, 1.0);
  } else {
    // water — darker mirror of the sky plus trunk smear + shimmer
    float ry = 2.0 * uW - q.y;
    vec3 wat = mix(vec3(0.85, 0.55, 0.33), vec3(0.08, 0.14, 0.24), smoothstep(-0.6, 1.6, ry)) * 0.55;
    float jx = q.x + 0.006 * sin(q.y * 22.0 + uT * 1.2);
    float smear = 0.0;
    for (int i = 0; i < 7; i++) {
      float d = jx - TX[i];
      smear += exp(-d * d * 260.0);
    }
    wat = mix(wat, vec3(0.06, 0.08, 0.11), clamp(smear * 0.9, 0.0, 0.8));
    // sun streak on the water
    float sd2 = length(vec2(q.x, ry) - uSun);
    wat += vec3(1.0, 0.72, 0.42) * exp(-sd2 * sd2 * 8.0) * 0.35 * (0.3 + 0.7 * uSunT);
    gl_FragColor = vec4(wat, 1.0);
  }
}`;

const HERON_VERT = /* glsl */ `
attribute float aWing;
attribute float aNeck;
attribute float aItem;
uniform float uT;
uniform vec2 uPos;
uniform float uFace;
uniform float uScale;
uniform float uFlight;   // 0 perched → 1 flying
uniform float uPhase;
uniform float uIdle;     // perched head-tilt amount 0..1
uniform float uCarry;    // fish visibility 0..1
uniform float uSunT;
uniform float uMirror;   // 1 = reflected copy
uniform float uW;
uniform float uA;
varying float vA;
varying float vWarm;
void main() {
  vec2 p = position.xy;
  float a = uA;
  if (aItem > 0.5) {
    a *= uCarry;
    p += vec2(0.02 * sin(uT * 6.0), 0.0);   // fish wriggle
  }
  if (aWing > 0.5) {
    // wing verts pivot about the shoulder
    vec2 sh = vec2(-0.02, 0.08);
    vec2 rel = p - sh;
    float fold = 1.0 - uFlight;
    rel.x *= mix(1.0, 0.32, fold);
    rel.y *= mix(1.0, 0.20, fold);
    float ang = (0.55 * sin(uT * 8.0 + uPhase) - 0.12) * uFlight;
    float c = cos(ang), s = sin(ang);
    rel = vec2(rel.x * c - rel.y * s, rel.x * s + rel.y * c);
    p = sh + rel;
  }
  // perched head-tilt
  p.x += aNeck * uIdle * 0.02 * sin(uT * 0.7 + uPhase * 3.0);
  p.x *= uFace;
  p = p * uScale + uPos;
  float warm = uSunT * 0.45;
  if (uMirror > 0.5) {
    p.y = 2.0 * uW - p.y;
    p.x += 0.02 * sin(uT * 1.2 + p.y * 8.0);
    a *= 0.32;
  }
  vA = a;
  vWarm = warm;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, p.y, -2.45, 1.0);
}`;

const HERON_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
varying float vWarm;
void main() {
  vec3 dark = vec3(0.05, 0.06, 0.08);
  vec3 warm = vec3(0.85, 0.68, 0.48);
  gl_FragColor = vec4(mix(dark, warm, vWarm), vA);
}`;

const TREE_VERT = /* glsl */ `
uniform float uT;
uniform float uWobble;
varying vec3 vC;
void main() {
  vec3 p = position;
  p.x += uWobble * 0.02 * sin(uT * 1.1 + p.y * 8.0 + p.x * 5.0);
  vC = color;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const TREE_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vC;
uniform float uA;
void main() { gl_FragColor = vec4(vC, uA); }`;

// ---------------------------------------------------------------------------
// per-act state — each project entry instantiates its own ctx, so shared
// module state MUST be keyed on it or uniforms land on the wrong act
// ---------------------------------------------------------------------------

interface HeronSpec {
  nest: number;            // nest index to land on / perch at
  kind: "arrive" | "hero" | "perch";
  from: [number, number];  // entry point for arrivals, water spot for hero
  t0: number;              // approach start (arrive) — ignored for perch
  land: number;            // landing time (hero: rise start = t0)
  face: number;            // +1 faces right
  seed: number;
}

interface HeronRig {
  mat: THREE.ShaderMaterial;
  mirror: THREE.ShaderMaterial;
  spec: HeronSpec;
  nest: { x: number; y: number };
}

interface FU {
  back: THREE.ShaderMaterial;
  treeMat: THREE.ShaderMaterial;
  reflMat: THREE.ShaderMaterial;
  ptMat: THREE.ShaderMaterial;
  ringMat: THREE.ShaderMaterial;
  herons: HeronRig[];
}

const U = new WeakMap<object, FU>();

const scene = defineScene({
  id: "dawnrookery",

  setup: async (ctx) => {
    const rig = ctx.rig;
    rig.setLensMm(58);
    // slow drift along the waterline past the trees; settle + tilt up on the
    // sun beat (global-progress path, driven with t/24 in render)
    const wps: CameraWaypoint[] = [
      { t: 0.0,  pos: [-1.9, -0.10, 4.3], target: [-2.6, -0.55, -3.0] },
      { t: 0.22, pos: [-1.3, -0.05, 4.3], target: [-2.0, -0.55, -3.0] },
      { t: 0.46, pos: [-0.4, 0.00, 4.3],  target: [-1.0, -0.50, -3.0] },
      { t: 0.68, pos: [0.5, 0.05, 4.3],   target: [0.2, -0.45, -3.0] },
      { t: 0.88, pos: [1.1, 0.15, 4.3],   target: [1.0, -0.10, -3.0] },
      { t: 1.0,  pos: [1.4, 0.35, 4.35],  target: [1.3, 0.65, -3.0] },
    ];
    rig.setPath(wps);
    (rig as any).pathTiming = "keyed";

    // ---- backdrop: dawn sky + mirror water ---------------------------------
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 7.5),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG,
        uniforms: {
          uRes: { value: new THREE.Vector2(16, 9) },
          uT: { value: 0 }, uSunT: { value: 0 },
          uSun: { value: new THREE.Vector2(2.2, -0.6) },
          uW: { value: WATER_Y },
        },
      }),
    );
    back.position.z = -3.5;
    ctx.scene3D.add(back);

    // ---- trees + nests + reflection ----------------------------------------
    const { geo, refl, nests, trunks } = buildTrees(4177);
    const treeMat = new THREE.ShaderMaterial({
      vertexShader: TREE_VERT, fragmentShader: TREE_FRAG,
      uniforms: { uT: { value: 0 }, uWobble: { value: 0 }, uA: { value: 1.0 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    const reflMat = new THREE.ShaderMaterial({
      vertexShader: TREE_VERT, fragmentShader: TREE_FRAG,
      uniforms: { uT: { value: 0 }, uWobble: { value: 1 }, uA: { value: 0.35 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    ctx.scene3D.add(new THREE.Mesh(geo, treeMat));
    ctx.scene3D.add(new THREE.Mesh(refl, reflMat));

    // ---- herons -------------------------------------------------------------
    const glyph = heronGlyph();
    const specs: HeronSpec[] = [
      { nest: 0, kind: "arrive", from: [-4.8, 1.8], t0: 4.9, land: 6.3, face: 1, seed: 1.7 },
      { nest: 2, kind: "arrive", from: [4.9, 2.0], t0: 6.2, land: 7.5, face: -1, seed: 4.3 },
      { nest: 4, kind: "arrive", from: [-4.9, 1.5], t0: 7.4, land: 8.7, face: 1, seed: 7.9 },
      { nest: 3, kind: "hero", from: [0.9, WATER_Y + 0.16], t0: HERO.rise, land: HERO.land, face: -1, seed: 2.2 },
      { nest: 5, kind: "perch", from: [0, 0], t0: 0, land: 0, face: 1, seed: 5.5 },
    ];
    const herons: HeronRig[] = specs.map((spec) => {
      const nest = nests[spec.nest % nests.length];
      const uniforms = () => ({
        uT: { value: 0 }, uPos: { value: new THREE.Vector2(nest.x, nest.y + 0.20) },
        uFace: { value: spec.face }, uScale: { value: 1.5 },
        uFlight: { value: 0 }, uPhase: { value: spec.seed * 9.0 },
        uIdle: { value: 0 }, uCarry: { value: 0 },
        uSunT: { value: 0 }, uW: { value: WATER_Y },
        uA: { value: 0.95 },
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: HERON_VERT, fragmentShader: HERON_FRAG,
        uniforms: { ...uniforms(), uMirror: { value: 0 } },
        transparent: true, side: THREE.DoubleSide,
      });
      const mirror = new THREE.ShaderMaterial({
        vertexShader: HERON_VERT, fragmentShader: HERON_FRAG,
        uniforms: { ...uniforms(), uMirror: { value: 1 } },
        transparent: true, side: THREE.DoubleSide,
      });
      const heroMesh = new THREE.Mesh(glyph, mat);
      heroMesh.frustumCulled = false;
      const mirrorMesh = new THREE.Mesh(glyph, mirror);
      mirrorMesh.frustumCulled = false;
      ctx.scene3D.add(heroMesh);
      ctx.scene3D.add(mirrorMesh);
      return { mat, mirror, spec, nest };
    });

    // ---- ring ripples --------------------------------------------------------
    const ringPos: number[] = [], rT0: number[] = [], rDur: number[] = [], rC: number[] = [];
    const addRing = (cx: number, t0: number, dur: number) => {
      const N = 28;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        ringPos.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
        rT0.push(t0, t0); rDur.push(dur, dur); rC.push(cx, 0, cx, 0);
      }
    };
    // landing ripples under each arriving heron's nest + hero splash + fish-rises
    for (const h of specs) {
      if (h.kind === "arrive") addRing(nests[h.nest].x, h.land + 0.1, 2.6);
    }
    addRing(0.9, HERO.rise + 0.15, 3.0);   // hero launch splash
    addRing(nests[3].x, HERO.land + 0.1, 2.4);
    addRing(-2.6, 4.2, 3.4);               // fish-rise far off
    addRing(1.9, 21.8, 3.4);               // late fish-rise
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ringPos), 3));
    rg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(rT0), 1));
    rg.setAttribute("aDur", new THREE.BufferAttribute(new Float32Array(rDur), 1));
    rg.setAttribute("aC", new THREE.BufferAttribute(new Float32Array(rC), 2));
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG,
      uniforms: { uT: { value: 0 }, uW: { value: WATER_Y } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ctx.scene3D.add(new THREE.LineSegments(rg, ringMat));

    // ---- point cloud ---------------------------------------------------------
    const pp: number[] = [], pk: number[] = [], ps: number[] = [],
      pT0: number[] = [], pT1: number[] = [], pPart: number[] = [], pTo: number[] = [];
    const addPt = (kind: number, seed: number, t0: number, t1: number,
      at: [number, number, number], to: [number, number, number], partX = 0) => {
      pp.push(...at); pk.push(kind); ps.push(seed); pT0.push(t0); pT1.push(t1);
      pPart.push(partX); pTo.push(...to);
    };
    const rng = mulberry32(9031);
    // mist banks on the waterline — each assigned a trunk to part around
    for (let i = 0; i < 12; i++) {
      const mx = -3.2 + i * 0.58 + (rng() - 0.5) * 0.3;
      const trunk = trunks.reduce((b, x) => Math.abs(x - mx) < Math.abs(b - mx) ? x : b, trunks[0]);
      addPt(0, rng() * 31, 0, DUR, [mx, WATER_Y + 0.12 + rng() * 0.3, -2.9], [0, 0, 0], trunk);
    }
    // motes in the light
    for (let i = 0; i < 14; i++) {
      addPt(1, rng() * 31, 0, DUR, [-2.8 + rng() * 5.6, -0.6 + rng() * 1.6, -2.6], [0, 0, 0]);
    }
    // hero droplets — fall off the fish as it rises; spawn x tracks the
    // hero's flight ease so later drops shed along the path, not at takeoff
    for (let i = 0; i < 6; i++) {
      const dt0 = HERO.rise + 0.2 + i * 0.18;
      const dw = Math.min(Math.max((dt0 - HERO.rise) / (HERO.land - HERO.rise), 0), 1);
      const de = dw * dw * (3 - 2 * dw);
      const hx = 0.9 + (nests[3].x - 0.9) * de + (rng() - 0.5) * 0.15;
      addPt(2, rng() * 31, dt0, 1.2,
        [hx, WATER_Y + 0.25 + i * 0.1, -2.7],
        [(rng() - 0.5) * 0.4, 0, 0]);
    }
    // two chick heads on the hero's nest
    addPt(3, 3.1, 13.6, DUR, [nests[3].x - 0.05, nests[3].y + 0.08, -2.6], [0, 0, 0]);
    addPt(3, 7.7, 13.9, DUR, [nests[3].x + 0.06, nests[3].y + 0.07, -2.6], [0, 0, 0]);
    // kingfisher streak — six trail points crossing left → right
    for (let i = 0; i < 6; i++) {
      addPt(4, i, KINGFISHER.t0, KINGFISHER.dur, [-3.4, 0.55, -2.5], [3.6, 0, 0]);
    }
    // murmuration — distant roosting blob far right
    for (let i = 0; i < 42; i++) {
      addPt(5, rng() * 31, MURM.t0 + rng() * 1.5, MURM.t1,
        [2.7 + (rng() - 0.5) * 0.7, 1.25 + (rng() - 0.5) * 0.4, -3.3], [0, 0, 0]);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pp), 3));
    pg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(pk), 1));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(ps), 1));
    pg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(pT0), 1));
    pg.setAttribute("aT1", new THREE.BufferAttribute(new Float32Array(pT1), 1));
    pg.setAttribute("aPartX", new THREE.BufferAttribute(new Float32Array(pPart), 1));
    pg.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(pTo), 3));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: { uT: { value: 0 }, uSunT: { value: 0 } },
      transparent: true, blending: THREE.NormalBlending, depthWrite: false,
    });
    ctx.scene3D.add(new THREE.Points(pg, ptMat));

    U.set(ctx, {
      back: back.material as THREE.ShaderMaterial,
      treeMat, reflMat, ptMat, ringMat, herons,
    });
  },

  render: (ctx, f, out) => {
    const t = f.t;
    const u = U.get(ctx)!;

    const sunT = Math.min(Math.max((t - SUN_T0) / (DUR - SUN_T0), 0), 1);
    u.back.uniforms.uT!.value = t;
    u.back.uniforms.uSunT!.value = sunT;
    u.back.uniforms.uSun!.value.set(2.2, -0.6 + sunT * 1.5);

    u.ptMat.uniforms.uT!.value = t;
    u.ptMat.uniforms.uSunT!.value = sunT;
    u.ringMat.uniforms.uT!.value = t;
    u.treeMat.uniforms.uT!.value = t;
    u.reflMat.uniforms.uT!.value = t;

    // heron choreography — closed-form paths, flap and fold envelopes
    for (const h of u.herons) {
      const { spec, nest } = h;
      let x = nest.x, y = nest.y + 0.20, flight = 0, carry = 0, idle = 0;
      if (spec.kind === "perch") {
        idle = Math.min(t / 6, 1);
      } else if (spec.kind === "arrive") {
        if (t < spec.t0) {
          x = spec.from[0]; y = spec.from[1]; flight = 0;
        } else if (t < spec.land) {
          const w = (t - spec.t0) / (spec.land - spec.t0);
          const e = w * w * (3 - 2 * w);
          x = spec.from[0] + (nest.x - spec.from[0]) * e;
          // descend in a shallow glide arc — a dip then a flare
          y = spec.from[1] + (nest.y + 0.20 - spec.from[1]) * e
            + Math.sin(w * Math.PI) * 0.35
            - Math.sin(Math.min(Math.max((w - 0.82) / 0.18, 0), 1) * Math.PI) * 0.10;
          flight = 1 - Math.min(Math.max((w - 0.85) / 0.15, 0), 1) * 0.3;
        } else {
          const settle = Math.min(Math.max((t - spec.land) / 0.7, 0), 1);
          flight = (1 - settle) * 0.7;
          idle = Math.min(Math.max((t - spec.land - 0.8) / 1.2, 0), 1);
        }
      } else {
        // hero — sits on the water, rises with a fish, lands on the nest
        if (t < spec.t0) {
          x = spec.from[0]; y = spec.from[1];
          idle = 0.4;
        } else if (t < spec.land) {
          const w = (t - spec.t0) / (spec.land - spec.t0);
          const e = w * w * (3 - 2 * w);
          x = spec.from[0] + (nest.x - spec.from[0]) * e;
          y = spec.from[1] + (nest.y + 0.20 - spec.from[1]) * e + Math.sin(w * Math.PI) * 0.3;
          flight = 1;
          carry = Math.min(Math.max((w - 0.1) / 0.2, 0), 1)
            * (1 - Math.min(Math.max((w - 0.8) / 0.2, 0), 1));
        } else {
          const settle = Math.min(Math.max((t - spec.land) / 0.7, 0), 1);
          flight = (1 - settle) * 0.7;
          idle = Math.min(Math.max((t - spec.land - 0.6) / 1.0, 0), 1);
        }
      }
      for (const m of [h.mat, h.mirror]) {
        m.uniforms.uT!.value = t;
        m.uniforms.uPos!.value.set(x, y);
        m.uniforms.uFlight!.value = flight;
        m.uniforms.uIdle!.value = idle;
        m.uniforms.uCarry!.value = carry;
        m.uniforms.uSunT!.value = sunT;
      }
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

export default scene;

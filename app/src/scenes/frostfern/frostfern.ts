// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene } from "../../engine/dsl";
import type { CameraWaypoint } from "../../engine/rig";

// ---------------------------------------------------------------------------
// frostfern — macro ice-fern crystals growing on a winter windowpane at blue
// hour. A cottage-window mullion cross frames the pane; deep dusk outside,
// warm far-house windows, a candle-lit rim below. Seeded dendritic fronds
// creep out of the pane's cold corner, a headlight sweep flares them once,
// condensation slides through, a moth taps the far glass. All closed-form f(t).
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
const SWEEP = { t0: 11.4, t1: 13.2 }; // headlight wash window
const GLISTEN_T = 16.8;               // droplet finishes crossing a crystal
const MOTH = { t0: 17.2, t1: 18.4 };

// pane interior rect (world units at z ≈ -2.1)
const PANE = { x0: -3.1, x1: 3.1, y0: -1.85, y1: 1.85 };
const COLD = { x: -2.95, y: -1.7 };   // frond origin: the pane's cold corner
// the spot a droplet slides through — crystals near it glisten afterwards
const WET = { x: -0.35, y: -0.55 };

// --------------------------------------------------------------------------
// frond generation — spine + recursive side branches, each vertex stamped with
// its appear-time aT (closed-form growth front)
// --------------------------------------------------------------------------

interface FernVerts { pos: Float32Array; aT: Float32Array; aSeed: Float32Array; aGlisten: Float32Array; tips: number[]; }

function buildFerns(seed: number): FernVerts {
  const rng = mulberry32(seed);
  const pos: number[] = [], aT: number[] = [], sd: number[] = [], gl: number[] = [];
  const tips: number[] = [];
  const wetDist = (x: number, y: number) => Math.hypot(x - WET.x, y - WET.y);

  const push = (x0: number, y0: number, x1: number, y1: number, t0: number, t1: number, s: number) => {
    pos.push(x0, y0, -2.1, x1, y1, -2.1);
    aT.push(t0, t1); sd.push(s, s);
    const g = wetDist(x1, y1) < 0.75 ? 1 : 0;
    gl.push(g, g);
  };

  // 6 fronds, each its own rate / direction fanning toward frame center
  const F = 6;
  for (let f = 0; f < F; f++) {
    const fSeed = rng() * 100;
    const start = 3.8 + f * 1.15 + rng() * 0.4;          // staggered sprout
    const dir0 = -0.25 + (f / (F - 1)) * 1.35 + (rng() - 0.5) * 0.22; // radians up-right
    const rate = 0.62 + rng() * 0.5;
    const segs = 12 + Math.floor(rng() * 6);
    let x = COLD.x + (rng() - 0.5) * 0.12, y = COLD.y + (rng() - 0.5) * 0.12;
    let ang = dir0, len = 0.34 + rng() * 0.12;

    const branch = (bx: number, by: number, bAng: number, bLen: number, bT: number, depth: number, seed2: number) => {
      if (depth <= 0 || bLen < 0.05) return;
      const n = 3 + Math.floor(rng() * 3);
      let x = bx, y = by, a = bAng, t = bT;
      for (let i = 0; i < n; i++) {
        const nl = bLen * (1 - i * 0.16);
        const nx = x + Math.cos(a) * nl, ny = y + Math.sin(a) * nl;
        if (nx < PANE.x0 + 0.05 || nx > PANE.x1 - 0.05 || ny < PANE.y0 + 0.05 || ny > PANE.y1 - 0.05) break;
        const nt = t + nl / rate * 0.5;
        push(x, y, nx, ny, t, nt, seed2 + i);
        if (i === n - 1) tips.push(pos.length / 3 - 1);
        // filigree twigs
        if (depth > 1 && rng() < 0.55) {
          const side = rng() < 0.5 ? -1 : 1;
          const twigA = a + side * (0.9 + rng() * 0.35);
          const tl = nl * (0.35 + rng() * 0.25);
          const tx = x + Math.cos(twigA) * tl, ty = y + Math.sin(twigA) * tl;
          const tt = nt - nl / rate * 0.2;
          push(x, y, tx, ty, tt + 0.04, tt + 0.3, seed2 + 40 + i);
          tips.push(pos.length / 3 - 1);
        }
        x = nx; y = ny; a += (rng() - 0.5) * 0.3; t = nt;
      }
    };

    let t = start;
    for (let k = 0; k < segs; k++) {
      const wob = (rng() - 0.5) * 0.34;
      const nx = x + Math.cos(ang + wob) * len, ny = y + Math.sin(ang + wob) * len;
      if (nx > PANE.x1 - 0.1 || ny > PANE.y1 - 0.1 || nx < PANE.x0) break;
      const nt = t + len / rate * 0.35;
      push(x, y, nx, ny, t, nt, fSeed + k);
      // pinnate teeth — the frost-fern comb: both sides at ~60°, decaying
      // toward the tip, occasional mini-tooth for filigree
      for (const side of [-1, 1]) {
        const teeth = 2 + Math.floor(rng() * 2);
        for (let b = 0; b < teeth; b++) {
          const bf = 0.1 + b * 0.35;
          const tAng = ang + wob * bf + side * (0.92 + rng() * 0.4);
          const tLen = len * (0.5 - bf * 0.22) * (0.75 + rng() * 0.5);
          const tx = x + Math.cos(tAng) * tLen, ty = y + Math.sin(tAng) * tLen;
          const tt = nt + bf * 0.05;
          push(x, y, tx, ty, tt, tt + 0.16, fSeed + k * 13 + b * 7 + side);
          if (rng() < 0.42) {
            const mA = tAng + side * (0.75 + rng() * 0.4);
            const ml = tLen * 0.45;
            push(tx - Math.cos(tAng) * tLen * 0.55, ty - Math.sin(tAng) * tLen * 0.55,
                 tx - Math.cos(tAng) * tLen * 0.55 + Math.cos(mA) * ml,
                 ty - Math.sin(tAng) * tLen * 0.55 + Math.sin(mA) * ml,
                 tt + 0.08, tt + 0.26, fSeed + k * 29 + b);
          }
          tips.push(pos.length / 3 - 1);
        }
      }
      // occasional deeper dendrite arm off the spine for structural variety
      if (rng() < 0.4) {
        const side = (k % 2 === 0) ? -1 : 1;
        const bAng = ang + side * (0.85 + rng() * 0.4);
        branch(x, y, bAng, len * (0.45 + rng() * 0.3), nt - 0.05, 2, fSeed + k * 7 + 31);
      }
      x = nx; y = ny; ang += wob * 0.5 + (rng() - 0.5) * 0.08;
      t = nt; len *= 0.955;
    }
    tips.push(pos.length / 3 - 1);
  }
  return {
    pos: new Float32Array(pos), aT: new Float32Array(aT),
    aSeed: new Float32Array(sd), aGlisten: new Float32Array(gl), tips,
  };
}

// --------------------------------------------------------------------------
// shaders
// --------------------------------------------------------------------------

const FERN_VERT = /* glsl */ `
attribute float aT;
attribute float aSeed;
attribute float aGlisten;
uniform float uT;
uniform float uSweepX;
uniform float uSweepI;
uniform float uGlisten;
varying float vA;
varying float vWarm;
void main() {
  float appear = smoothstep(aT, aT + 0.28, uT);
  float grown = smoothstep(aT + 0.28, aT + 0.9, uT);
  float tw = 0.75 + 0.25 * sin(uT * 2.2 + aSeed * 17.0);
  float front = 1.0 + (1.0 - grown) * 1.6;          // growth front glows
  float sweep = uSweepI * 1.0 - smoothstep(0.0, 1.4, abs(position.x - uSweepX));
  float wet = aGlisten * uGlisten;                   // post-droplet glisten
  vA = appear * front * tw * (1.35 + 0.75 * sweep + wet * 1.2);
  vWarm = clamp(sweep + wet * 0.55, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FERN_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
varying float vWarm;
void main() {
  vec3 ice = vec3(0.72, 0.88, 1.05);
  vec3 warm = vec3(1.0, 0.88, 0.66);
  gl_FragColor = vec4(mix(ice, warm, vWarm), vA);
}`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform vec2 uRes;
uniform float uT;
uniform float uSweepX;
uniform float uSweepI;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 q = vUv;
  // dusk gradient — deep indigo low to steel blue high
  vec3 col = mix(vec3(0.045, 0.06, 0.12), vec3(0.10, 0.14, 0.24), q.y);
  // far house: two warm blurred window blobs drifting slightly
  vec2 h1 = q - vec2(0.68, 0.40), h2 = q - vec2(0.75, 0.36);
  float g = exp(-(h1.x * h1.x * 300.0 + h1.y * h1.y * 500.0));
  g += 0.7 * exp(-(h2.x * h2.x * 420.0 + h2.y * h2.y * 700.0));
  col += vec3(0.85, 0.55, 0.24) * g * (0.75 + 0.08 * sin(uT * 0.5));
  // drifting snow flecks outside
  for (int i = 0; i < 3; i++) {
    vec2 sp = vec2(hash(vec2(float(i), 7.0)), hash(vec2(float(i), 13.0)));
    sp.x = fract(sp.x + uT * (0.008 + float(i) * 0.004));
    sp.y = fract(sp.y - uT * (0.014 + float(i) * 0.006));
    vec2 d = q - sp; d.x *= uRes.x / uRes.y;
    col += vec3(0.5, 0.6, 0.75) * exp(-dot(d, d) * 90000.0) * 0.8;
  }
  // headlight sweep washes the pane warm-white
  float band = 1.0 - smoothstep(0.0, 0.35, abs(q.x - uSweepX));
  col += vec3(1.0, 0.85, 0.6) * band * uSweepI * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const CANDLE_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
varying vec2 vUv;
void main() {
  float flick = 0.72 + 0.18 * sin(uT * 1.7) + 0.07 * sin(uT * 5.3 + 1.7) + 0.03 * sin(uT * 11.1);
  float g = exp(-vUv.y * 5.0) * exp(-abs(vUv.x - 0.5) * 1.6);
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.28) * g * flick, g * flick * 0.85);
}`;

const PT_VERT = /* glsl */ `
attribute float aKind;   // 0 glint 1 mote 2 droplet 3 moth
attribute float aSeed;
attribute float aT0;     // appear time / drop start
attribute float aT1;     // drop duration / moth end
attribute vec3 aTo;      // droplet slide target
uniform float uT;
uniform float uSweepX;
uniform float uSweepI;
uniform float uGlisten;
uniform vec3 uWet;
varying float vA;
varying float vKind;
varying float vWarm;
void main() {
  vKind = aKind;
  vec3 p = position;
  float a = 0.0; float sz = 1.0; vWarm = 0.0;
  if (aKind < 0.5) {
    // glints riding the growth front — twinkle hard near their aT0
    float ap = smoothstep(aT0 - 0.15, aT0 + 0.15, uT);
    float frontGlow = exp(-abs(uT - aT0) * 1.1);
    float tw = 0.5 + 0.5 * sin(uT * (2.0 + fract(aSeed) * 2.0) + aSeed * 40.0);
    float sweep = uSweepI * 1.0 - smoothstep(0.0, 1.2, abs(p.x - uSweepX));
    float wet = 1.0 - smoothstep(0.0, 0.8, distance(p.xy, uWet.xy)) * uGlisten;
    a = ap * (0.25 + 0.75 * tw) * (0.35 + frontGlow * 0.9 + sweep * 1.2 + wet * 1.3);
    vWarm = clamp(sweep + wet * 0.5, 0.0, 1.0);
    sz = 4.5 + frontGlow * 4.5 + sweep * 3.5 + wet * 3.0;
  } else if (aKind < 1.5) {
    // interior dust motes catching candlelight
    p.x += 0.16 * sin(uT * 0.22 + aSeed * 9.0);
    p.y += 0.12 * sin(uT * 0.17 + aSeed * 13.0);
    a = (0.10 + 0.10 * sin(uT * 0.8 + aSeed * 21.0)) * smoothstep(0.0, 2.0, uT);
    vWarm = 0.55;
    sz = 2.2;
  } else if (aKind < 2.5) {
    // condensation droplets sliding down the warm rim
    float u = clamp((uT - aT0) / aT1, 0.0, 1.0);
    float slide = u * u * (3.0 - 2.0 * u);         // slow start/end
    p = mix(position, aTo, slide);
    p.x += 0.05 * sin(slide * 20.0 + aSeed * 7.0); // wobble
    a = smoothstep(aT0, aT0 + 0.6, uT) * (0.35 + 0.3 * sin(uT * 3.0 + aSeed * 11.0));
    vWarm = 0.5;
    sz = 5.0 + slide * 1.5;
  } else {
    // moth tapping the far window — dark flutter crossing once
    float u = clamp((uT - aT0) / (aT1 - aT0), 0.0, 1.0);
    p.x += (u * 2.0 - 1.0) * 0.55;
    p.y += sin(u * 3.14159) * 0.22 + 0.04 * sin(uT * 24.0);
    a = smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.85, 1.0, u)) * 0.85;
    vWarm = -1.0; // dark sprite
    sz = 12.0 + 2.5 * sin(uT * 24.0);
  }
  vA = a;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = sz * (300.0 / -mv.z) * 0.016;
  gl_Position = projectionMatrix * mv;
}`;

const PT_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
varying float vKind;
varying float vWarm;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float soft = 1.0 - smoothstep(0.12, 0.5, r);
  vec3 col;
  if (vWarm < 0.0) col = vec3(0.03, 0.03, 0.05);            // moth silhouette
  else if (vKind > 1.5) col = vec3(0.9, 0.85, 0.75);        // droplet
  else col = mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.85, 0.6), vWarm);
  gl_FragColor = vec4(col, vA * soft);
}`;

// --------------------------------------------------------------------------

// per-act state — each project entry instantiates its own ctx, so shared
// module state MUST be keyed on it or uniforms land on the wrong act
interface FU { back: THREE.ShaderMaterial; fernMat: THREE.ShaderMaterial; ptMat: THREE.ShaderMaterial; mothMat: THREE.ShaderMaterial; candle: THREE.ShaderMaterial; glistenT: number; }
const U = new WeakMap<object, FU>();

const scene = defineScene({
  id: "frostfern",

  setup: async (ctx) => {
    const rig = ctx.rig;
    rig.setLensMm(56);
    // near-static macro — a slow lateral drift follows the lead frond's tip
    const s0 = ctx.sceneCtx.start, s1 = ctx.sceneCtx.end;
    const span = s1 - s0;
    // global-progress path (driven with t/24 in render) — starts on the cold
    // corner and drifts right behind the lead frond's growth front
    const wps: CameraWaypoint[] = [
      { t: 0.0,  pos: [-0.80, -0.30, 4.0],  target: [-2.3, -1.2, -2.1] },
      { t: 0.20, pos: [-0.70, -0.18, 4.0],  target: [-1.8, -0.8, -2.1] },
      { t: 0.45, pos: [-0.40, 0.0, 4.0],    target: [-0.9, -0.2, -2.1] },
      { t: 0.65, pos: [0.0, 0.05, 4.05],    target: [-0.2, 0.15, -2.1] },
      { t: 0.82, pos: [0.30, 0.05, 4.05],   target: [0.30, 0.2, -2.1] },
      { t: 1.0,  pos: [0.45, 0.0, 4.1],     target: [0.50, 0.2, -2.1] },
    ];
    rig.setPath(wps);
    (rig as any).pathTiming = "keyed";

    // ---- backdrop: dusk outside --------------------------------------------
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 6.4),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG,
        uniforms: {
          uRes: { value: new THREE.Vector2(16, 9) },
          uT: { value: 0 }, uSweepX: { value: -2 }, uSweepI: { value: 0 },
        },
      }),
    );
    back.position.z = -3.6;
    ctx.scene3D.add(back);

    // ---- candle-lit warm rim below the pane --------------------------------
    const candle = new THREE.Mesh(
      new THREE.PlaneGeometry(7.0, 2.4),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: CANDLE_FRAG,
        uniforms: { uT: { value: 0 } },
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    candle.position.set(0.35, -1.05, -2.35);
    ctx.scene3D.add(candle);

    // ---- window frame + mullion cross (foreground, dark wood) ---------------
    const wood = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.9, metalness: 0.0 });
    const frame = new THREE.Group();
    const bar = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.22), wood);
      m.position.set(x, y, -1.7);
      frame.add(m);
    };
    bar(6.9, 0.5, 0, PANE.y1 + 0.25);   // top
    bar(6.9, 0.62, 0, PANE.y0 - 0.31);  // sill
    bar(0.5, 4.4, PANE.x0 - 0.25, 0);   // left jamb
    bar(0.5, 4.4, PANE.x1 + 0.25, 0);   // right jamb
    bar(0.16, 3.7, 0.15, 0);            // vertical mullion (slightly off-center)
    bar(6.2, 0.16, 0, 0.15);            // horizontal mullion
    ctx.scene3D.add(frame);
    ctx.scene3D.add(new THREE.AmbientLight(0x203040, 0.6));
    const rim = new THREE.DirectionalLight(0xffb060, 1.4);
    rim.position.set(0.3, -4, 3);
    ctx.scene3D.add(rim);

    // ---- frost ferns --------------------------------------------------------
    const fv = buildFerns(90210);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(fv.pos, 3));
    fg.setAttribute("aT", new THREE.BufferAttribute(fv.aT, 1));
    fg.setAttribute("aSeed", new THREE.BufferAttribute(fv.aSeed, 1));
    fg.setAttribute("aGlisten", new THREE.BufferAttribute(fv.aGlisten, 1));
    const fernMat = new THREE.ShaderMaterial({
      vertexShader: FERN_VERT, fragmentShader: FERN_FRAG,
      uniforms: {
        uT: { value: 0 }, uSweepX: { value: -4 }, uSweepI: { value: 0 }, uGlisten: { value: 0 },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ctx.scene3D.add(new THREE.LineSegments(fg, fernMat));

    // ---- points: glints, motes, droplets, moth ------------------------------
    const rng = mulberry32(33117);
    const P: number[] = [], K: number[] = [], S: number[] = [], T0: number[] = [], T1: number[] = [], TO: number[] = [];
    const addPt = (kind: number, seed: number, t0: number, t1: number, p: number[], to: number[]) => {
      P.push(...p); K.push(kind); S.push(seed); T0.push(t0); T1.push(t1); TO.push(...to);
    };
    // glints on every branch tip
    for (const ti of fv.tips) {
      addPt(0, rng() * 50, fv.aT[ti]! + 0.05, 0,
        [fv.pos[ti * 3]!, fv.pos[ti * 3 + 1]!, -2.08], [0, 0, 0]);
    }
    // interior dust motes
    for (let i = 0; i < 14; i++) {
      addPt(1, rng() * 9, 0, 0, [(rng() - 0.5) * 5.4, -1.2 + rng() * 2.8, -1.1 - rng() * 0.6], [0, 0, 0]);
    }
    // condensation droplets near the warm rim — slide down-left; #3 crosses WET
    // (~78% along its eased slide reaches WET.y — glisten starts there)
    let glistenT = GLISTEN_T;
    for (let i = 0; i < 9; i++) {
      const dx = -2.4 + i * 0.55 + (rng() - 0.5) * 0.2;
      const cross = i === 3;
      const start = cross ? WET.y + 0.9 : -1.55 + rng() * 0.25;
      const end = cross ? WET.y - 0.15 : -1.95 - rng() * 0.3;
      const t0 = cross ? 15.2 : 6 + rng() * 14;
      const dur = 5 + rng() * 4;
      if (cross) glistenT = t0 + 0.78 * dur;
      addPt(2, rng() * 31, t0, dur,
        [cross ? WET.x : dx, start, -2.0],
        [cross ? WET.x + 0.12 : dx + (rng() - 0.5) * 0.4, end, -2.0]);
    }

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
    pg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(K), 1));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(S), 1));
    pg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(T0), 1));
    pg.setAttribute("aT1", new THREE.BufferAttribute(new Float32Array(T1), 1));
    pg.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(TO), 3));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: {
        uT: { value: 0 }, uSweepX: { value: -4 }, uSweepI: { value: 0 },
        uGlisten: { value: 0 }, uWet: { value: new THREE.Vector3(WET.x, WET.y, -2.1) },
      },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    ctx.scene3D.add(new THREE.Points(pg, ptMat));

    // the moth — one tap at the far window (own draw call: a silhouette needs
    // NormalBlending — the additive points material can only brighten)
    const mothPts = new THREE.Points(
      (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([1.9, 0.9, -3.2]), 3));
        g.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array([3]), 1));
        g.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array([0]), 1));
        g.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array([MOTH.t0]), 1));
        g.setAttribute("aT1", new THREE.BufferAttribute(new Float32Array([MOTH.t1]), 1));
        g.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array([0, 0, 0]), 3));
        return g;
      })(),
      new THREE.ShaderMaterial({
        vertexShader: PT_VERT, fragmentShader: PT_FRAG,
        uniforms: {
          uT: { value: 0 }, uSweepX: { value: -4 }, uSweepI: { value: 0 },
          uGlisten: { value: 0 }, uWet: { value: new THREE.Vector3(WET.x, WET.y, -2.1) },
        },
        transparent: true, blending: THREE.NormalBlending, depthWrite: false,
      }),
    );
    ctx.scene3D.add(mothPts);

    U.set(ctx, {
      back: back.material as THREE.ShaderMaterial,
      fernMat, ptMat,
      mothMat: mothPts.material as THREE.ShaderMaterial,
      candle: candle.material as THREE.ShaderMaterial,
      glistenT,
    });
  },

  render: (ctx, f, out) => {
    const t = f.t;
    // global progress keeps the camera drift continuous across act cuts
    ctx.updateCamera(t, t / 24);
    const u = U.get(ctx as unknown as object)!;

    // headlight sweep: band slides left→right across the pane
    const su = Math.min(Math.max((t - SWEEP.t0) / (SWEEP.t1 - SWEEP.t0), 0), 1);
    const sweepI = su <= 0 || su >= 1 ? 0 : Math.sin(su * Math.PI);
    const sweepX = -4.2 + su * 8.4;
    // post-droplet glisten — timed to when the crossing droplet reaches WET
    const glisten = Math.min(Math.max((t - u.glistenT) / 1.6, 0), 1);

    u.back.uniforms.uT!.value = t;
    u.back.uniforms.uSweepX!.value = sweepX / 6.4 + 0.5;
    u.back.uniforms.uSweepI!.value = sweepI;
    u.fernMat.uniforms.uT!.value = t;
    u.fernMat.uniforms.uSweepX!.value = sweepX;
    u.fernMat.uniforms.uSweepI!.value = sweepI;
    u.fernMat.uniforms.uGlisten!.value = glisten;
    u.ptMat.uniforms.uT!.value = t;
    u.ptMat.uniforms.uSweepX!.value = sweepX;
    u.ptMat.uniforms.uSweepI!.value = sweepI;
    u.ptMat.uniforms.uGlisten!.value = glisten;
    u.mothMat.uniforms.uT!.value = t;
    u.candle.uniforms.uT!.value = t;

    ctx.flush(out, true);
  },
});

export default scene;

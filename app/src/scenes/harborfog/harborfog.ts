// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene } from "../../engine/dsl";
import type { CameraWaypoint } from "../../engine/rig";

// ---------------------------------------------------------------------------
// harborfog — a small fishing harbor swallowed in rolling dusk fog. Moored
// hulls and masts barely read through the murk; deck lamps warm on one by
// one, a lighthouse beam sweeps the fog in slow passes, a cormorant skims
// low over the water, and the swell settles into night.
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
const WATER_Y = -0.55;                 // mirror line
const FOG_THICK = { t0: 0.0, t1: 4.8 };   // fog thickens through act 1
const LAMPS_T = [5.2, 6.4, 7.6, 8.6, 9.2]; // per-boat lamp turn-on
const BEAM_PERIOD = 9.0;                  // lighthouse sweep period
const CORMORANT = { t0: 14.8, dur: 1.6 };
const SETTLE_T = 19.2;                    // swell damps after this

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

// ---------------------------------------------------------------------------
// boats — hull + mast + boom silhouettes as tapered ribbon triangles
// ---------------------------------------------------------------------------

interface Boat { x: number; z: number; w: number; lampT: number; seed: number }

function buildBoats(seed: number): { geo: THREE.BufferGeometry; refl: THREE.BufferGeometry; boats: Boat[] } {
  const rng = mulberry32(seed);
  const pos: number[] = [], col: number[] = [];
  const boats: Boat[] = [];

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

  // seeded hulls along the mooring line — x spread across frame
  const xs = [-2.6, -1.5, -0.4, 0.75, 1.9];
  for (let i = 0; i < 5; i++) {
    const x = xs[i] + (rng() - 0.5) * 0.25;
    const z = -2.55 - (i % 2) * 0.35;         // two depths
    const hw = 0.34 + rng() * 0.10;           // hull half-width
    const dr = 0.10 + rng() * 0.03;           // hull depth below waterline hidden
    const far = z < -2.7;
    const c = far ? [0.055, 0.07, 0.10] : [0.075, 0.095, 0.13];
    const wy = WATER_Y;

    // hull: gunwale line + rounded bottom (3-rib boat profile above waterline)
    rib(x - hw, wy + 0.10, x + hw, wy + 0.10, 0.045, 0.045, z, c);            // gunwale band
    rib(x - hw, wy + 0.10, x - hw * 0.55, wy - 0.02, 0.045, 0.035, z, c);     // bow/stern drop
    rib(x + hw, wy + 0.10, x + hw * 0.55, wy - 0.02, 0.045, 0.035, z, c);
    rib(x - hw * 0.55, wy - 0.02, x + hw * 0.55, wy - 0.02, 0.05, 0.05, z, c); // keel band (ends at waterline)

    // cabin box midships
    rib(x - 0.06, wy + 0.10, x - 0.06, wy + 0.22, 0.10, 0.10, z, c);
    rib(x + 0.10, wy + 0.10, x + 0.10, wy + 0.20, 0.10, 0.10, z, c);
    rib(x - 0.06, wy + 0.22, x + 0.10, wy + 0.20, 0.035, 0.035, z, c);         // cabin roof

    // mast + boom + a couple of stays
    const mh = 0.62 + rng() * 0.22;
    rib(x + 0.02, wy + 0.10, x + 0.02, wy + 0.10 + mh, 0.018, 0.008, z, c);
    rib(x + 0.02, wy + 0.10 + mh * 0.45, x + 0.34, wy + 0.10 + mh * 0.28, 0.012, 0.004, z, c);
    rib(x + 0.02, wy + 0.10 + mh, x - hw * 0.9, wy + 0.11, 0.006, 0.002, z, c);
    rib(x + 0.02, wy + 0.10 + mh, x + hw * 0.9, wy + 0.11, 0.006, 0.002, z, c);

    boats.push({ x, z, w: hw, lampT: LAMPS_T[i] + (rng() - 0.5) * 0.4, seed: rng() });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));

  // mirrored copy — same triangles with y flipped around the waterline
  const rpos = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) {
    rpos[i] = pos[i];
    rpos[i + 1] = 2 * WATER_Y - pos[i + 1];
    rpos[i + 2] = pos[i + 2] - 0.02;
  }
  const refl = new THREE.BufferGeometry();
  refl.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
  refl.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));

  return { geo, refl, boats };
}

// ---------------------------------------------------------------------------
// shaders — shared quad vertex; backdrop paints sky + water + fog gradient
// ---------------------------------------------------------------------------

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uT;
uniform float uW;
uniform float uFog;    // 0..1 fog thickness
uniform float uBeam;   // beam glint lane intensity on the water
uniform vec3 uLamp[5]; // x, y, on-strength of each deck lamp
uniform vec2 uLampS[5];// lamp reflection smear seeds
void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  // dusk sky — deep slate, barely warmer at the horizon
  vec3 sky = mix(vec3(0.22, 0.24, 0.32), vec3(0.05, 0.07, 0.12), smoothstep(-0.9, 1.6, q.y));
  sky += vec3(0.55, 0.35, 0.18) * 0.10 * (1.0 - smoothstep(-0.6, 0.5, q.y));   // last dusk warmth

  if (q.y > uW) {
    // sky-side fog — layered veils thickening with uFog
    float m = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float c = uW + 0.30 + fi * 0.28 + 0.06 * sin(uT * 0.20 + fi * 2.1);
      m += (1.0 - smoothstep(0.0, 0.30 + fi * 0.12, abs(q.y - c)))
         * (0.5 + 0.5 * sin(q.x * (0.9 + fi * 0.5) + uT * (0.04 + fi * 0.03) + fi * 4.0));
    }
    sky = mix(sky, vec3(0.38, 0.42, 0.48), clamp(m * (0.35 + 0.45 * uFog), 0.0, 0.85));
    gl_FragColor = vec4(sky, 1.0);
  } else {
    // water — dark mirror of the sky, plus lamp smears + beam glint
    vec3 wat = mix(vec3(0.14, 0.16, 0.22), vec3(0.04, 0.06, 0.10), 1.0 - smoothstep(uW - 1.6, uW, q.y));
    float jx = q.x + 0.008 * sin(q.y * 20.0 + uT * 1.1);
    // lamp smears — vertical warm streaks under each lit lamp
    float sm = 0.0;
    for (int i = 0; i < 5; i++) {
      float on = uLamp[i].z;
      float dx = abs(jx - uLamp[i].x);
      float stretch = 0.55 + 0.10 * uLampS[i].y;
      float under = (1.0 - smoothstep(uW - stretch, uW, q.y)) * (1.0 - smoothstep(-0.01, 0.03, q.y - uW));
      sm += on * under * exp(-dx * dx * 260.0) * (0.85 + 0.15 * sin(q.y * 12.0 + uT * 2.0 + uLampS[i].x));
    }
    wat += vec3(1.0, 0.72, 0.35) * sm;
    // beam glint — soft lane when the beam sweeps low across the water
    wat += vec3(0.85, 0.88, 0.80) * uBeam * 0.10 * exp(-abs(q.y - uW + 0.35) * 3.0);
    // fog veil on the water surface
    float fw = (1.0 - smoothstep(0.0, 0.5, uW - q.y)) * uFog * 0.25;
    wat = mix(wat, vec3(0.30, 0.34, 0.40), fw);
    gl_FragColor = vec4(wat, 1.0);
  }
}`;

// boats + reflection — vertex-colored ribbons, gentle roll on the swell
const BOAT_VERT = /* glsl */ `
uniform float uT;
uniform float uCalm;   // 0 rolling → 1 settled
uniform float uRefl;   // 1 on the mirrored copy — roll mirrors about the waterline
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  float roll = (1.0 - uCalm) * 0.015 * sin(uT * 0.9 + p.x * 1.7);
  p.y += roll * (p.x + 3.0) * (1.0 - 2.0 * uRefl);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const BOAT_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, uA); }`;

// lighthouse beam — a fan anchored far-left; uAng rotates it, uIn boosts
// brightness while the beam crosses the fog band
const BEAM_VERT = /* glsl */ `
uniform float uAng;
varying float vT;
void main() {
  vT = position.x / 5.6;
  vec3 p = position;
  float c = cos(uAng), s = sin(uAng);
  p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
precision mediump float;
varying float vT;
uniform float uIn;
void main() {
  float fade = (1.0 - vT) * (1.0 - vT);
  gl_FragColor = vec4(0.95, 0.93, 0.78, fade * (0.03 + 0.75 * uIn));
}`;

// ---------------------------------------------------------------------------
// point cloud — 0 fog wisps, 1 deck lamps, 2 lamp halos, 3 buoy blink,
// 5 gull-in-beam, 6 beam dust  (kind 4 retired: cormorant is a dark mesh)
// --------------------------------------------------------------------------

const PT_VERT = /* glsl */ `
attribute float aKind;
attribute float aSeed;
attribute float aT0;
attribute float aT1;
attribute float aOn;
attribute vec3 aTo;
uniform float uT;
uniform float uFog;
uniform float uBeamAng;
uniform float uPx;   // render-target height / 1080 — sprites stay a fixed frame fraction
varying float vA;
varying float vKind;
void main() {
  vKind = aKind;
  vec3 p = position;
  float a = 0.0; float sz = 2.0;
  if (aKind < 0.5) {
    // fog wisps — big soft sprites drifting at two speeds
    float sp = 0.05 + 0.05 * fract(aSeed * 3.0);
    p.x += mod(uT * sp + aSeed * 7.0, 14.0) - 7.0 - p.x;
    p.y += 0.10 * sin(uT * 0.15 + aSeed * 9.0);
    a = (0.10 + 0.08 * sin(uT * 0.18 + aSeed * 9.0)) * (0.4 + 0.8 * uFog);
    sz = 190.0 + fract(aSeed * 13.0) * 110.0;
  } else if (aKind < 1.5) {
    // deck lamp core — warm flicker once on
    float on = smoothstep(aT0, aT0 + 0.8, uT);
    a = on * (0.9 + 0.10 * sin(uT * 7.0 + aSeed * 40.0));
    sz = 6.0;
  } else if (aKind < 2.5) {
    // lamp halo — soft bloom around each lit lamp
    float on = smoothstep(aT0, aT0 + 0.8, uT);
    a = on * (0.30 + 0.06 * sin(uT * 5.0 + aSeed * 40.0));
    sz = 36.0;
  } else if (aKind < 3.5) {
    // mooring buoy — slow red blink
    float on = smoothstep(7.0, 8.0, uT);
    float bl = pow(0.5 + 0.5 * sin(uT * 2.4 + aSeed * 6.0), 6.0);
    a = on * bl;
    p.y += 0.02 * sin(uT * 0.8);
    sz = 4.0;
  } else if (aKind < 4.5) {
    // (kind 4 removed — the cormorant is a dark non-additive mesh, not a point)
    a = 0.0;
  } else if (aKind < 5.5) {
    // gull — only lit when the beam sweeps across its post
    float d = abs(mod(uBeamAng - 0.5 + 0.5, 1.0) - 0.5); // unused; lit via aOn
    a = aOn * 0.9;
    sz = 4.5;
  } else {
    // beam dust — motes caught inside the sweep wedge
    p.x += 0.05 * sin(uT * 0.5 + aSeed * 9.0);
    p.y += 0.04 * sin(uT * 0.4 + aSeed * 13.0);
    a = aOn * (0.10 + 0.08 * sin(uT * 0.9 + aSeed * 21.0));
    sz = 2.2;
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
  if (vKind < 0.5) col = vec3(0.55, 0.60, 0.66);              // fog — pale slate
  else if (vKind < 2.5) col = vec3(1.0, 0.72, 0.32);          // lamps — warm amber
  else if (vKind < 3.5) col = vec3(1.0, 0.20, 0.15);          // buoy — blink red
  else if (vKind < 4.5) col = vec3(0.06, 0.07, 0.09);         // cormorant — dark
  else col = vec3(0.75, 0.78, 0.72);                          // gull + dust — pale
  gl_FragColor = vec4(col, vA * soft);
}`;

// ---------------------------------------------------------------------------
// ripple rings — top arc stays at/below the waterline as they expand
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
  float r = mix(0.03, 0.45 + 0.30 * fract(aT0), clamp(u, 0.0, 1.0));
  vec2 p = aC + vec2(position.x * r, position.y * r * 0.22);
  p.x += 0.01 * sin(uT * 1.1 + position.x * 9.0);
  vA = on * (1.0 - u) * 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, uW + 0.02 + p.y - r * 0.22, -2.7, 1.0);
}`;

const RING_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
void main() { gl_FragColor = vec4(0.62, 0.68, 0.74, vA); }`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface FU {
  back: THREE.ShaderMaterial;
  boatMat: THREE.ShaderMaterial;
  reflMat: THREE.ShaderMaterial;
  beamMat: THREE.ShaderMaterial;
  ptMat: THREE.ShaderMaterial;
  ringMat: THREE.ShaderMaterial;
  _boats: Boat[];
  _lampU: THREE.Vector3[];
  _aOnAttr: THREE.BufferAttribute;
  _gullIdx: number;
  _dustIdx: number[];
  _dustPos: [number, number][];
  _corm: THREE.Mesh;
}

const U = new WeakMap<object, FU>();

const scene = defineScene({
  id: "harborfog",

  setup: async (ctx) => {
    const rig = ctx.rig;
    rig.setLensMm(55);
    // near-static drift along the mooring line; settle as the beam sweeps
    const wps: CameraWaypoint[] = [
      { t: 0.0,  pos: [-1.4, -0.05, 4.3], target: [-1.6, -0.35, -3.0] },
      { t: 0.25, pos: [-0.9, -0.02, 4.3], target: [-1.0, -0.35, -3.0] },
      { t: 0.50, pos: [-0.2, 0.0, 4.3],   target: [-0.2, -0.33, -3.0] },
      { t: 0.72, pos: [0.4, 0.02, 4.3],   target: [0.3, -0.33, -3.0] },
      { t: 1.0,  pos: [0.9, 0.05, 4.35],  target: [0.6, -0.30, -3.0] },
    ];
    rig.setPath(wps);
    (rig as any).pathTiming = "keyed";

    // ---- backdrop -----------------------------------------------------------
    const lampU = Array.from({ length: 5 }, () => new THREE.Vector3(0, 0, 0));
    const lampS = Array.from({ length: 5 }, (_, i) => new THREE.Vector2(i * 3.7, i * 0.9));
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(12.5, 7.5),
      new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG,
        uniforms: {
          uRes: { value: new THREE.Vector2(16, 9) },
          uT: { value: 0 }, uW: { value: WATER_Y },
          uFog: { value: 0.6 }, uBeam: { value: 0 },
          uLamp: { value: lampU }, uLampS: { value: lampS },
        },
      }),
    );
    back.position.z = -3.5;
    ctx.scene3D.add(back);

    // ---- boats + reflection -------------------------------------------------
    const { geo, refl, boats } = buildBoats(9021);
    const boatMat = new THREE.ShaderMaterial({
      vertexShader: BOAT_VERT, fragmentShader: BOAT_FRAG,
      uniforms: { uT: { value: 0 }, uCalm: { value: 0 }, uRefl: { value: 0 }, uA: { value: 1.0 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    const reflMat = new THREE.ShaderMaterial({
      vertexShader: BOAT_VERT, fragmentShader: BOAT_FRAG,
      uniforms: { uT: { value: 0 }, uCalm: { value: 0 }, uRefl: { value: 1 }, uA: { value: 0.30 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    ctx.scene3D.add(new THREE.Mesh(geo, boatMat));
    ctx.scene3D.add(new THREE.Mesh(refl, reflMat));

    // ---- breakwater line ----------------------------------------------------
    const bwPos: number[] = [], bwCol: number[] = [];
    const bwRib = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * w0 * 0.5, ny = (dx / len) * w0 * 0.5;
      const mx = (-dy / len) * w1 * 0.5, my = (dx / len) * w1 * 0.5;
      bwPos.push(x0 + nx, y0 + ny, -3.3, x0 - nx, y0 - ny, -3.3, x1 + mx, y1 + my, -3.3,
                 x0 - nx, y0 - ny, -3.3, x1 - mx, y1 - my, -3.3, x1 + mx, y1 + my, -3.3);
      for (let k = 0; k < 6; k++) bwCol.push(0.05, 0.06, 0.09);
    };
    bwRib(-5.5, WATER_Y + 0.30, 5.5, WATER_Y + 0.28, 0.05, 0.05);
    // lighthouse tower far left + gallery
    bwRib(-4.35, WATER_Y + 0.30, -4.28, WATER_Y + 1.55, 0.10, 0.055);
    bwRib(-4.40, WATER_Y + 1.55, -4.23, WATER_Y + 1.55, 0.05, 0.05);
    bwRib(-4.35, WATER_Y + 1.60, -4.28, WATER_Y + 1.75, 0.05, 0.03);
    // gull post — inside the beam fan's 5.6-unit reach from x=-4.32
    bwRib(0.55, WATER_Y - 0.05, 0.55, WATER_Y + 0.28, 0.03, 0.03);
    const bwGeo = new THREE.BufferGeometry();
    bwGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bwPos), 3));
    bwGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bwCol), 3));
    const bwMat = new THREE.ShaderMaterial({
      vertexShader: BOAT_VERT, fragmentShader: BOAT_FRAG,
      uniforms: { uT: { value: 0 }, uCalm: { value: 1 }, uRefl: { value: 0 }, uA: { value: 1.0 } },
      vertexColors: true, transparent: true, side: THREE.DoubleSide,
    });
    ctx.scene3D.add(new THREE.Mesh(bwGeo, bwMat));

    // ---- lighthouse beam — rotating fan ------------------------------------
    const beamGeo = new THREE.BufferGeometry();
    const bp: number[] = [];
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24 - 0.5) * 0.16, a1 = ((i + 1) / 24 - 0.5) * 0.16;
      bp.push(0, 0, 0,
              5.6 * Math.cos(a0), 5.6 * Math.sin(a0), 0,
              5.6 * Math.cos(a1), 5.6 * Math.sin(a1), 0);
    }
    beamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bp), 3));
    const beamMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { uAng: { value: 0 }, uIn: { value: 0 } },
      transparent: true, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.frustumCulled = false;
    beam.position.set(-4.32, WATER_Y + 1.68, -3.1);
    ctx.scene3D.add(beam);

    // ---- point cloud --------------------------------------------------------
    const rng = mulberry32(717);
    const pp: number[] = [], pk: number[] = [], ps: number[] = [], pT0: number[] = [],
      pT1: number[] = [], pOn: number[] = [], pTo: number[] = [];
    const addPt = (kind: number, seed: number, t0: number, t1: number,
      pos: number[], to: number[], on = 0) => {
      pp.push(...pos); pk.push(kind); ps.push(seed); pT0.push(t0); pT1.push(t1);
      pOn.push(on); pTo.push(...to);
    };
    for (let i = 0; i < 26; i++)   // fog wisps
      addPt(0, rng() * 31, 0, DUR, [-4 + rng() * 8, -0.4 + rng() * 1.8, -2.8 - rng() * 0.5], [0, 0, 0]);
    boats.forEach((b, i) => {
      addPt(1, b.seed * 31, b.lampT, DUR, [b.x + 0.04, WATER_Y + 0.16, b.z + 0.02], [0, 0, 0]);
      addPt(2, b.seed * 31, b.lampT, DUR, [b.x + 0.04, WATER_Y + 0.16, b.z + 0.02], [0, 0, 0]);
    });
    addPt(3, 5.1, 0, DUR, [1.45, WATER_Y + 0.02, -2.35], [0, 0, 0]);      // buoy
    // gull on the post — aOn patched per frame while the beam crosses it
    addPt(5, 9.3, 0, DUR, [0.55, WATER_Y + 0.33, -3.25], [0, 0, 0], 0);
    const dustPos: [number, number][] = [];
    for (let i = 0; i < 14; i++) {   // beam dust — lit per-point while inside the fan
      const dx = -3.5 + rng() * 6, dy = -0.2 + rng() * 1.6;
      dustPos.push([dx, dy]);
      addPt(6, rng() * 31, 0, DUR, [dx, dy, -3.0], [0, 0, 0], 0);
    }

    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pp), 3));
    pg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(pk), 1));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(ps), 1));
    pg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(pT0), 1));
    pg.setAttribute("aT1", new THREE.BufferAttribute(new Float32Array(pT1), 1));
    pg.setAttribute("aOn", new THREE.BufferAttribute(new Float32Array(pOn), 1));
    pg.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(pTo), 3));
    const aOnAttr = pg.getAttribute("aOn") as THREE.BufferAttribute;
    const gullIdx = pk.findIndex((k) => k === 5);
    const dustIdx = pk.map((k, i) => k === 6 ? i : -1).filter((i) => i >= 0);
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      uniforms: { uT: { value: 0 }, uFog: { value: 0.6 }, uBeamAng: { value: 0 }, uPx: { value: 1 } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pts = new THREE.Points(pg, ptMat);
    pts.frustumCulled = false;
    ctx.scene3D.add(pts);

    // ---- ripple rings -------------------------------------------------------
    const ringPos: number[] = [], rT0: number[] = [], rDur: number[] = [], rC: number[] = [];
    const addRing = (cx: number, t0: number, dur: number) => {
      const N = 28;
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        ringPos.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
        rT0.push(t0, t0); rDur.push(dur, dur); rC.push(cx, 0, cx, 0);
      }
    };
    addRing(-1.8, 16.9, 3.2);   // something surfaces after the bird passes
    addRing(1.1, 17.8, 3.4);    // second rise
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ringPos), 3));
    rg.setAttribute("aT0", new THREE.BufferAttribute(new Float32Array(rT0), 1));
    rg.setAttribute("aDur", new THREE.BufferAttribute(new Float32Array(rDur), 1));
    rg.setAttribute("aC", new THREE.BufferAttribute(new Float32Array(rC), 2));
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT, fragmentShader: RING_FRAG,
      uniforms: { uT: { value: 0 }, uW: { value: WATER_Y } },
      transparent: true,
    });
    ctx.scene3D.add(new THREE.LineSegments(rg, ringMat));

    // ---- cormorant — a dark non-additive dart; additive points can't darken
    const cPos: number[] = [], cCol: number[] = [];
    const crib = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
      const ddx = x1 - x0, ddy = y1 - y0, len = Math.hypot(ddx, ddy) || 1;
      const nx = (-ddy / len) * w0 * 0.5, ny = (ddx / len) * w0 * 0.5;
      const mx = (-ddy / len) * w1 * 0.5, my = (ddx / len) * w1 * 0.5;
      cPos.push(x0 + nx, y0 + ny, 0, x0 - nx, y0 - ny, 0, x1 + mx, y1 + my, 0,
                x0 - nx, y0 - ny, 0, x1 - mx, y1 - my, 0, x1 + mx, y1 + my, 0);
      for (let k = 0; k < 6; k++) cCol.push(0.035, 0.045, 0.06);
    };
    crib(-0.05, 0.0, 0.16, 0.0, 0.05, 0.015);   // body tapering to the beak
    crib(-0.05, 0.0, -0.22, 0.01, 0.05, 0.008); // tail
    crib(0.01, 0.01, 0.11, 0.075, 0.02, 0.004); // raised wing
    crib(0.01, -0.01, 0.11, -0.065, 0.02, 0.004); // dropped wing
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cPos), 3));
    cGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cCol), 3));
    const corm = new THREE.Mesh(cGeo, bwMat);
    corm.position.z = -2.4;
    corm.visible = false;
    ctx.scene3D.add(corm);

    U.set(ctx, { back: back.material as THREE.ShaderMaterial, boatMat, reflMat, beamMat, ptMat, ringMat,
      _boats: boats, _lampU: lampU, _aOnAttr: aOnAttr, _gullIdx: gullIdx, _dustIdx: dustIdx,
      _dustPos: dustPos, _corm: corm });
  },

  render: (ctx, f, out) => {
    const t = f.t;
    const st = U.get(ctx)! as any;
    const fog = 0.55 + 0.45 * sstep(FOG_THICK.t0, FOG_THICK.t1, t);
    const calm = sstep(SETTLE_T, DUR, t);

    // lighthouse beam — continuous slow rotation, right-leaning sweep across
    // the harbor; uIn boosts brightness while the beam crosses the fog band
    const beamPhase = ((t - 4.0) / BEAM_PERIOD) * Math.PI * 2;
    const beamAng = -0.10 + Math.sin(beamPhase) * 0.30;   // radians off horizontal
    // world-space beam direction — point where it crosses mid-harbor x=0
    const beamY = WATER_Y + 1.68 + Math.tan(beamAng) * 4.3; // height at x≈0
    const beamLow = 1.0 - sstep(WATER_Y + 0.6, WATER_Y + 1.3, beamY); // lower = brighter glint
    const beamIn = sstep(9.6, 10.6, t) * (0.4 + 0.6 * beamLow);
    st.beamMat.uniforms.uAng!.value = beamAng;
    st.beamMat.uniforms.uIn!.value = beamIn;

    // backdrop
    st.back.uniforms.uT!.value = t;
    st.back.uniforms.uFog!.value = fog;
    st.back.uniforms.uBeam!.value = beamIn * beamLow;
    for (let i = 0; i < 5; i++) {
      const b = st._boats[i] as Boat;
      // backdrop q-space is (uv-0.5)*10 over a 12.5-wide plane → x * 0.8
      st._lampU[i].set((b.x + 0.04) * 0.8, WATER_Y + 0.16, sstep(b.lampT, b.lampT + 0.8, t));
    }

    // boats + reflection
    st.boatMat.uniforms.uT!.value = t;
    st.boatMat.uniforms.uCalm!.value = calm;
    st.reflMat.uniforms.uT!.value = t;
    st.reflMat.uniforms.uCalm!.value = calm;

    // points
    st.ptMat.uniforms.uT!.value = t;
    st.ptMat.uniforms.uFog!.value = fog;
    // gull + dust lit only while inside the beam fan (angle + reach test)
    const beamHit = (x: number, y: number) => {
      const dx = x + 4.32, dy = y - (WATER_Y + 1.68);
      if (Math.hypot(dx, dy) > 5.6) return 0;
      return Math.max(0, 1 - Math.abs(Math.atan2(dy, dx) - beamAng) / 0.08); // fan half-angle
    };
    st._aOnAttr.setX(st._gullIdx, beamIn * beamHit(0.55, WATER_Y + 0.33));
    st._dustIdx.forEach((i: number, k: number) =>
      st._aOnAttr.setX(i, beamIn * beamHit(st._dustPos[k][0], st._dustPos[k][1])));
    st._aOnAttr.needsUpdate = true;

    // cormorant dart — closed-form crossing during the bird act
    const cu = (t - CORMORANT.t0) / CORMORANT.dur;
    st._corm.visible = cu >= 0 && cu <= 1;
    if (st._corm.visible) {
      st._corm.position.x = -3.8 + 7.4 * cu;
      st._corm.position.y = WATER_Y + 0.42 - 0.07 * Math.sin(cu * Math.PI) + 0.035 * Math.sin(t * 11.0);
    }
    st.ptMat.uniforms.uPx!.value = out.height / 1080;

    // rings
    st.ringMat.uniforms.uT!.value = t;

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

export default scene;

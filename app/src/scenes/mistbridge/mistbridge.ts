// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// mistbridge — a narrow stone footbridge over a deep gorge at dawn. Thin mist
// fills the drop; a hooded traveler crosses slowly, pauses mid-span, and looks
// back once at the far end. All motion closed-form f(t); flat silhouettes on
// the z=-2 picture plane against a shader backdrop of sky, walls and mist.
// ---------------------------------------------------------------------------

const DUR = 24.0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const sCurve = (u: number) => u * u * (3 - 2 * u);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// beat anchors
const TRAV = { enter: 4.0, pause0: 9.8, pause1: 12.4, farEnd: 17.4, lookBack: 18.6 };
const GOAT_T = 6.5;
const STONE_T = 13.2;
const RAVEN = { t0: 14.5, t1: 17.5 };
const SUN = { t0: 14.0, t1: 20.0 };           // first light on the rim
const BRD = { t0: 5.0, t1: 21.0 };            // gap-gliding birds window

// deck profile — low stone arch, crown at mid-span
const deckY = (x: number) => 0.10 + 0.26 * (1 - (x / 2.3) * (x / 2.3));
// arch underside springs from the abutments, opening under the deck
const archY = (x: number) => -0.06 + 0.24 * (1 - (x / 1.9) * (x / 1.9));

// traveler path — x(t) piecewise: walk → pause → walk → stop → look back
const TRAV_X0 = -2.4, TRAV_PAUSE = -0.05, TRAV_END = 1.48;
function travX(t: number) {
  if (t < TRAV.enter) return TRAV_X0;
  if (t < TRAV.pause0) return mix(TRAV_X0, TRAV_PAUSE, sCurve((t - TRAV.enter) / (TRAV.pause0 - TRAV.enter)));
  if (t < TRAV.pause1) return TRAV_PAUSE;
  if (t < TRAV.farEnd) return mix(TRAV_PAUSE, TRAV_END, sCurve((t - TRAV.pause1) / (TRAV.farEnd - TRAV.pause1)));
  return TRAV_END;
}
const walking = (t: number) =>
  (t > TRAV.enter && t < TRAV.pause0) || (t > TRAV.pause1 && t < TRAV.farEnd);

// ---------------------------------------------------------------------------
// geometry helpers — flat ribbons/polygons in the z=-2 picture plane
// ---------------------------------------------------------------------------

function poly(pos: number[], col: number[], verts: number[][], c: number[]) {
  for (let i = 1; i < verts.length - 1; i++) {
    pos.push(verts[0][0], verts[0][1], -2.0, verts[i][0], verts[i][1], -2.0, verts[i + 1][0], verts[i + 1][1], -2.0);
    for (let k = 0; k < 3; k++) col.push(...c);
  }
}

// tapered ribbon along points — perimeter order (no bowtie)
function ribbon(pos: number[], col: number[], pts: number[][], w0: number, w1: number, c: number[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const wa = mix(w0, w1, t0) / 2, wb = mix(w0, w1, t1) / 2;
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    pos.push(ax + nx * wa, ay + ny * wa, -2.0, ax - nx * wa, ay - ny * wa, -2.0,
      bx - nx * wb, by - ny * wb, -2.0, ax + nx * wa, ay + ny * wa, -2.0,
      bx - nx * wb, by - ny * wb, -2.0, bx + nx * wb, by + ny * wb, -2.0);
    for (let k = 0; k < 6; k++) col.push(...c);
  }
}

// ---------------------------------------------------------------------------
// backdrop — dawn sky, plunging walls, two mist bands drifting at different
// speeds, wisps curling at parapet height, late sun on the top rim.
// Plane at z=-4 behind the z=-2 life layer.
// ---------------------------------------------------------------------------
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
varying vec2 vUv;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  float sun = smoothstep(14.0, 20.0, uT);
  // dawn sky — steel overhead, apricot remnant along the horizon band
  vec3 sky = mix(vec3(0.16, 0.19, 0.23), vec3(0.09, 0.12, 0.16), smoothstep(0.2, 3.2, q.y));
  sky += vec3(0.55, 0.28, 0.10) * (1.0 - smoothstep(-0.3, 1.1, q.y)) * smoothstep(-1.4, -0.2, q.y) * (0.5 + 0.5 * sun);
  vec3 col = sky;

  // distant sun-lit rim band on the far wall tops — appears only late;
  // applied after the composite so it isn't diluted away
  float rimBand = smoothstep(0.75, 0.95, q.y) * (1.0 - smoothstep(1.15, 1.45, q.y));

  // gorge walls — rock masses converging downward, fading into the mist;
  // edges pull inward with depth so the bridge springs out of both walls
  float wallL = 1.0 - smoothstep(-0.05, 0.15, q.x + (1.60 + 0.85 * q.y));
  float wallR = smoothstep(-0.05, 0.15, q.x - (1.72 + 0.78 * q.y));
  float walls = max(wallL, wallR);
  vec3 rock = mix(vec3(0.13, 0.15, 0.17), vec3(0.05, 0.06, 0.08), 1.0 - smoothstep(-2.5, 0.8, q.y));
  rock *= 0.7 + 0.6 * hash21(floor(q * vec2(5.0, 6.0)));
  // sun catches only the top rock band
  rock += vec3(0.30, 0.16, 0.05) * sun * smoothstep(0.5, 1.1, q.y) * walls;
  // walls dissolve into mist toward the bottom
  float mistTop = -0.30 + 0.18 * sin(q.x * 0.9 + uT * 0.10) + 0.10 * sin(q.x * 2.3 - uT * 0.16);
  float mist = 1.0 - smoothstep(mistTop - 0.9, mistTop + 0.25, q.y);
  vec3 mistCol = mix(vec3(0.52, 0.55, 0.57), vec3(0.72, 0.72, 0.72), smoothstep(-3.5, 0.0, q.y));
  // slow inner band drifting the other way — reads as a second layer
  float band2 = 1.0 - smoothstep(-0.75 + 0.2 * sin(q.x * 1.7 - uT * 0.22), -0.25 + 0.2 * sin(q.x * 1.7 - uT * 0.22), q.y);
  mistCol += vec3(0.10) * band2 * (0.5 + 0.5 * sin(q.x * 4.0 + uT * 0.3));
  // faint far-cliff ledges in the gap above the mist
  float farLedge = step(0.86, hash21(vec2(floor((q.x + 5.0) / 0.9), 3.0))) *
    smoothstep(0.28, 0.34, q.y) * (1.0 - smoothstep(0.34, 0.46, q.y)) *
    (1.0 - walls) * (1.0 - mist);
  vec3 gapRock = mix(rock, vec3(0.38, 0.42, 0.46), 0.55);
  vec3 behind = mix(mix(sky, gapRock, walls * (1.0 - mist)), mistCol, mist);
  behind = mix(behind, gapRock, farLedge * 0.5);
  col = behind;
  // the rim band survives the composite — sun catches the wall tops
  col += vec3(0.35, 0.20, 0.08) * rimBand * sun * walls * (0.4 + 0.6 * hash21(floor(q * vec2(7.0, 4.0))));

  // wisps curling up around the parapet line — thin drifting streaks
  float wisp = sin(q.x * 7.0 + uT * 0.5 + sin(q.y * 22.0) * 2.0) *
               smoothstep(-0.15, 0.15, q.y) * (1.0 - smoothstep(0.25, 0.6, q.y)) *
               (1.0 - walls);
  col += vec3(0.06) * smoothstep(0.86, 1.0, wisp) * (0.6 + 0.4 * sun);
  gl_FragColor = vec4(col, 1.0);
}`;

// silhouette material — vertex colour, tiny wobble so nothing reads frozen
const LIFE_VERT = /* glsl */ `
uniform float uT;
uniform float uWob;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  p.y += uWob * 0.004 * sin(uT * 9.0 + p.x * 20.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const LIFE_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, uA); }`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial; lifeMat: THREE.ShaderMaterial;
  crown: THREE.Mesh; crownMat: THREE.ShaderMaterial;
  trav: THREE.Group; travBody: THREE.Mesh; stick: THREE.Mesh;
  goat: THREE.Mesh; raven: THREE.Mesh; ravenMat: THREE.ShaderMaterial;
  stone: THREE.Mesh; stoneMat: THREE.ShaderMaterial;
  birds: THREE.Group[];
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "mistbridge",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(9377);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — near-static low, slight drift right following the crossing,
    // tiny push-in on the look-back
    ctx.rig.setLensMm(58);
    ctx.rig.setPath([
      { t: 0.00, pos: [-0.45, 0.62, 4.80], target: [0.05, 0.02, -2.0] },
      { t: 0.45, pos: [-0.10, 0.58, 4.62], target: [0.35, 0.08, -2.0] },
      { t: 0.78, pos: [0.15, 0.52, 4.52], target: [0.55, 0.10, -2.0] },
      { t: 1.00, pos: [0.25, 0.50, 4.30], target: [0.70, 0.14, -2.0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 } }, depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), st.back);
    back.position.z = -4; back.renderOrder = -10;
    ctx.scene3D.add(back);

    // --- shared silhouette material ------------------------------------------
    st.lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 1 } },
      transparent: true,
    });

    // --- bridge — pale stone against the pale drop; reads as a thin line -----
    {
      const bp: number[] = [], bc: number[] = [];
      const stone = [0.50, 0.47, 0.42];
      const deckPts: number[][] = [];
      for (let i = 0; i <= 24; i++) { const x = -2.45 + (4.9 * i) / 24; deckPts.push([x, deckY(x)]); }
      ribbon(bp, bc, deckPts, 0.10, 0.10, stone);                    // deck band
      const parPts = deckPts.map(([x, y]) => [x, y + 0.062] as number[]);
      ribbon(bp, bc, parPts, 0.028, 0.028, [0.40, 0.38, 0.34]);      // parapet
      // parapet blocks — faint piers every ~0.5
      for (let i = 0; i < 9; i++) {
        const x = -2.2 + i * 0.55;
        poly(bp, bc, [[x - 0.03, deckY(x) + 0.10], [x + 0.03, deckY(x) + 0.10], [x + 0.03, deckY(x) + 0.04], [x - 0.03, deckY(x) + 0.04]], stone);
      }
      // arch rib — springs from the abutments, opening under the crown
      const aPts: number[][] = [];
      for (let i = 0; i <= 20; i++) { const x = -1.95 + (3.9 * i) / 20; aPts.push([x, archY(x)]); }
      ribbon(bp, bc, aPts, 0.11, 0.11, [0.38, 0.36, 0.33]);
      // spandrel fill between deck and arch at the haunches
      poly(bp, bc, [[-2.30, deckY(-2.3) - 0.05], [-1.95, deckY(-1.95) - 0.05], [-1.95, archY(-1.9)], [-2.30, -0.02]], [0.42, 0.40, 0.36]);
      poly(bp, bc, [[1.95, archY(1.9)], [1.95, deckY(1.95) - 0.05], [2.30, deckY(2.3) - 0.05], [2.30, -0.02]], [0.42, 0.40, 0.36]);
      // voussoir seams along the arch
      for (let i = 0; i < 7; i++) {
        const x = -1.5 + i * 0.5;
        poly(bp, bc, [[x - 0.008, archY(x) + 0.10], [x + 0.008, archY(x) + 0.10], [x + 0.008, archY(x) - 0.02], [x - 0.008, archY(x) - 0.02]], [0.30, 0.29, 0.27]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bc), 3));
      const bridge = new THREE.Mesh(g, st.lifeMat);
      bridge.frustumCulled = false;
      ctx.scene3D.add(bridge);
    }

    // --- crown glint — thin warm edge along the parapet, lights with the sun -
    {
      const gp: number[] = [], gc: number[] = [];
      const pts: number[][] = [];
      for (let i = 0; i <= 24; i++) { const x = -2.45 + (4.9 * i) / 24; pts.push([x, deckY(x) + 0.075]); }
      ribbon(gp, gc, pts, 0.014, 0.014, [0.95, 0.72, 0.35]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gc), 3));
      st.crownMat = st.lifeMat.clone();
      st.crownMat.uniforms.uA!.value = 0;
      st.crown = new THREE.Mesh(g, st.crownMat);
      st.crown.frustumCulled = false;
      ctx.scene3D.add(st.crown);
    }

    // --- far ledge right — slab holding the dead pine and the goat -----------
    {
      const lp: number[] = [], lc: number[] = [];
      const rockC = [0.30, 0.31, 0.33];
      poly(lp, lc, [[1.55, 0.50], [2.45, 0.56], [2.50, 0.30], [1.70, 0.24], [1.55, 0.40]], rockC);
      // dead pine leaning off the edge — trunk + bare branches
      ribbon(lp, lc, [[2.10, 0.50], [2.02, 0.78], [1.88, 1.05], [1.80, 1.22]], 0.045, 0.015, [0.10, 0.09, 0.08]);
      ribbon(lp, lc, [[1.95, 0.92], [1.75, 0.98], [1.62, 0.96]], 0.02, 0.008, [0.10, 0.09, 0.08]);
      ribbon(lp, lc, [[1.98, 0.85], [2.10, 0.95], [2.18, 1.02]], 0.02, 0.008, [0.10, 0.09, 0.08]);
      ribbon(lp, lc, [[2.04, 0.68], [1.90, 0.74], [1.80, 0.73]], 0.018, 0.007, [0.10, 0.09, 0.08]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(lc), 3));
      const ledge = new THREE.Mesh(g, st.lifeMat);
      ledge.frustumCulled = false;
      ctx.scene3D.add(ledge);
    }

    // --- traveler — hooded silhouette + walking stick ------------------------
    {
      st.trav = new THREE.Group();
      const dark = [0.06, 0.055, 0.05];
      const tp: number[] = [], tc: number[] = [];
      poly(tp, tc, [[-0.075, 0.0], [0.075, 0.0], [0.045, 0.19], [-0.045, 0.19]], dark);            // cloak
      poly(tp, tc, [[-0.045, 0.17], [0.045, 0.17], [0.02, 0.27], [-0.02, 0.27]], dark);           // hood
      poly(tp, tc, [[-0.05, 0.0], [-0.015, 0.0], [-0.028, -0.09], [-0.05, -0.09]], dark);         // leg L
      poly(tp, tc, [[0.05, 0.0], [0.015, 0.0], [0.028, -0.09], [0.05, -0.09]], dark);             // leg R
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tc), 3));
      st.travBody = new THREE.Mesh(g, st.lifeMat);
      st.trav.add(st.travBody);
      // walking stick — separate mesh so it can swing
      const sp: number[] = [], sc: number[] = [];
      poly(sp, sc, [[-0.008, 0.0], [0.008, 0.0], [0.008, -0.26], [-0.008, -0.26]], dark);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sp), 3));
      sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sc), 3));
      st.stick = new THREE.Mesh(sg, st.lifeMat);
      st.stick.position.set(0.09, 0.14, 0.001);
      st.stick.rotation.z = -0.35;
      st.trav.add(st.stick);
      st.trav.position.set(TRAV_X0, deckY(TRAV_X0) + 0.14, 0.02);
      st.trav.scale.set(0.9, 0.9, 1);
      ctx.scene3D.add(st.trav);
    }

    // --- goat — small silhouette on the far ledge, hops once to a lower rock -
    {
      const gp: number[] = [], gc: number[] = [];
      const gc2 = [0.08, 0.075, 0.07];
      poly(gp, gc, [[-0.09, 0.0], [0.09, 0.0], [0.10, 0.075], [-0.08, 0.075]], gc2);               // body
      poly(gp, gc, [[0.07, 0.07], [0.13, 0.07], [0.14, 0.13], [0.09, 0.13]], gc2);                // head
      poly(gp, gc, [[0.09, 0.13], [0.115, 0.13], [0.10, 0.19], [0.085, 0.19]], gc2);              // horn
      poly(gp, gc, [[-0.07, 0.0], [-0.04, 0.0], [-0.045, -0.07], [-0.07, -0.07]], gc2);           // leg
      poly(gp, gc, [[0.05, 0.0], [0.08, 0.0], [0.075, -0.07], [0.05, -0.07]], gc2);               // leg
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gc), 3));
      st.goat = new THREE.Mesh(g, st.lifeMat);
      st.goat.position.set(2.02, 0.56, 0.02);
      st.goat.frustumCulled = false;
      ctx.scene3D.add(st.goat);
    }

    // --- raven — one circle near the dead pine --------------------------------
    {
      const rp: number[] = [], rc: number[] = [];
      poly(rp, rc, [[-0.12, 0.02], [-0.03, 0.05], [0, 0.01], [0.03, 0.05], [0.12, 0.02], [0.04, -0.02], [0, -0.035], [-0.04, -0.02]], [0.02, 0.02, 0.025]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rc), 3));
      st.ravenMat = st.lifeMat.clone();
      st.ravenMat.uniforms.uA!.value = 0;
      st.raven = new THREE.Mesh(g, st.ravenMat);
      st.raven.frustumCulled = false;
      ctx.scene3D.add(st.raven);
    }

    // --- falling stone — drops from the arch underside, swallowed by mist -----
    {
      const sp: number[] = [], sc: number[] = [];
      poly(sp, sc, [[-0.025, 0.02], [0.025, 0.02], [0.02, -0.02], [-0.02, -0.02]], [0.22, 0.21, 0.19]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sc), 3));
      st.stoneMat = st.lifeMat.clone();
      st.stoneMat.uniforms.uA!.value = 0;
      st.stone = new THREE.Mesh(g, st.stoneMat);
      st.stone.frustumCulled = false;
      ctx.scene3D.add(st.stone);
    }

    // --- gap birds — two gliders riding thermals under the bridge -------------
    {
      st.birds = [];
      for (let b = 0; b < 2; b++) {
        const bp: number[] = [], bc: number[] = [];
        poly(bp, bc, [[-0.14, 0.0], [-0.04, 0.035], [0, 0.0], [0.04, 0.035], [0.14, 0.0], [0, -0.02]], [0.10, 0.10, 0.11]);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bp), 3));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bc), 3));
        const bird = new THREE.Group();
        const m = new THREE.Mesh(g, st.lifeMat);
        m.frustumCulled = false;
        bird.add(m);
        bird.userData = { ph: b * 2.4 + rng() * 0.5, r: 1.2 + b * 0.35, yc: -0.62 - b * 0.18 };
        ctx.scene3D.add(bird);
        st.birds.push(bird);
      }
    }
  },

  render: (ctx, f, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;
    st.back.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.crownMat.uniforms.uT!.value = t;
    st.ravenMat.uniforms.uT!.value = t;
    st.stoneMat.uniforms.uT!.value = t;

    // crown glint — first sun on the bridge's crown late in the film
    st.crownMat.uniforms.uA!.value = 0.85 * sstep(SUN.t0, SUN.t1, t);

    // traveler — walk bob + stick swing while moving; lean at the pause;
    // flip (look back) once at the far end
    {
      const x = travX(t);
      const wk = walking(t) ? 1 : 0;
      const bob = wk * 0.012 * Math.abs(Math.sin(t * 5.4));
      const lean = 0.14 * sstep(TRAV.pause0 + 0.5, TRAV.pause0 + 1.4, t) * (1 - sstep(TRAV.pause1 - 0.8, TRAV.pause1 + 0.3, t));
      st.trav.position.set(x, deckY(x) + 0.14 + bob, 0.02);
      st.trav.rotation.z = -lean;
      st.trav.scale.x = t >= TRAV.lookBack ? -0.9 : 0.9;
      st.stick.rotation.z = -0.35 + wk * 0.3 * Math.sin(t * 5.4) + lean * 0.4;
    }

    // goat — one parabolic hop to a lower rock at GOAT_T
    {
      const age = t - GOAT_T;
      const hop = clamp01(age / 0.55);
      const x = mix(2.02, 1.83, sCurve(hop));
      const y = 0.56 + 0.22 * Math.sin(Math.PI * hop) - 0.10 * sCurve(hop);
      st.goat.position.set(x, y, 0.02);
      st.goat.rotation.z = 0.25 * Math.sin(Math.PI * hop);
    }

    // raven — one loop around the dead pine
    {
      const u = clamp01((t - RAVEN.t0) / (RAVEN.t1 - RAVEN.t0));
      const a = u * Math.PI * 2;
      st.raven.position.set(1.90 + 0.34 * Math.cos(a), 1.05 + 0.22 * Math.sin(a), 0.03);
      st.raven.rotation.z = -0.3 * Math.sin(a);
      st.ravenMat.uniforms.uA!.value = 0.85 * Math.sin(Math.PI * u);
    }

    // stone — free-falls from the arch, fades into the mist below
    {
      const age = t - STONE_T;
      const on = age > 0 && age < 2.2;
      const y = 0.08 - 1.1 * age * age;
      st.stone.position.set(0.15 + 0.05 * age, y, 0.01);
      st.stone.rotation.z = age * 3.0;
      st.stoneMat.uniforms.uA!.value = on ? Math.max(0, 0.9 * (1 - Math.max(0, -(y + 0.35)) * 2.2)) : 0;
    }

    // gap birds — slow ellipses riding thermals, gated to the window
    for (let i = 0; i < st.birds.length; i++) {
      const b = st.birds[i]!;
      const { ph, r, yc } = b.userData as { ph: number; r: number; yc: number };
      const u = clamp01((t - BRD.t0 - i * 1.2) / (BRD.t1 - BRD.t0));
      const a = u * Math.PI * (2.1 + i * 0.5) + ph;
      b.position.set(r * Math.sin(a), yc + 0.28 * Math.sin(a * 1.7 + ph), 0.01);
      b.rotation.z = 0.35 * Math.cos(a);
      const vis = t > BRD.t0 + i * 1.2 && t < BRD.t1 ? 1 : 0;
      (b.children[0] as THREE.Mesh).visible = vis > 0;
      b.scale.set(1, 0.85 + 0.15 * Math.sin(t * 7 + i), 1);
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

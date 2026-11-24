// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// reedwarbler — a reed-fringed drainage pond at warm noon.
// Flat silhouettes on the z=-2 picture plane over a shader backdrop; a sedge
// warbler works the reed bed while a dragonfly patrols the open water.
// All motion is closed-form f(t): piecewise sCurve segments, seeded sways,
// ring envelopes. No sim, no textures.

import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";
import { mulberry32 } from "../../engine/util";

const DUR = 22;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const sCurve = (u: number) => u * u * (3 - 2 * u);

// ---------------------------------------------------------------------------
// beat anchors (seconds)
// ---------------------------------------------------------------------------

// warbler: two feed runs + a final settle perch
const WB = {
  in1: 4.4, perch1: 4.8, call: 5.5, callEnd: 6.0, drop1: 6.4, back1: 7.2,
  dip1: 8.0, dip1End: 8.6, sit1: 9.0,
  in2: 11.5, perch2: 11.9, dip2: 12.5, dip2End: 13.0, sit2: 13.5, hide2: 14.4,
  back3: 19.2, perch3: 19.8
};
const DRAGON = { t0: 9.6, t1: 14.6 };                 // oval patrol window
const MOOR = { t0: 14.6, t1: 19.0 };                  // bank stalk window
const FROG_T = 12.2, FISH_T = 1.5, BOAT_T = 16.6;     // one-shot ripples/pulse

const NEST = { x: 0.72, y: 0.08 };                    // hidden low in the bed
const BED_Y = 0.02, WATER_TOP = -0.10, BANK_Y = -1.30;

// ---------------------------------------------------------------------------
// geometry helpers (flat polys / ribbons on z=-2)
// ---------------------------------------------------------------------------

function poly(p: number[], c: number[], pts: readonly (readonly number[])[], col: readonly number[]) {
  for (let i = 1; i < pts.length - 1; i++) {
    for (const k of [0, i, i + 1]) {
      p.push(pts[k][0], pts[k][1], -2);
      c.push(col[0], col[1], col[2]);
    }
  }
}

// tapered quad between two spine points
function ribbon(p: number[], c: number[], spine: readonly (readonly number[])[],
                w0: number, w1: number, col: readonly number[]) {
  const [ax, ay] = spine[0], [bx, by] = spine[1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len), ny = (dx / len);
  poly(p, c, [
    [ax + nx * w0, ay + ny * w0], [ax - nx * w0, ay - ny * w0],
    [bx - nx * w1, by - ny * w1], [bx + nx * w1, by + ny * w1]
  ], col);
}

function posFan(p: number[], c: number[], cx: number, cy: number, r: number,
                a0: number, a1: number, col: readonly number[]) {
  p.push(cx, cy, -2); c.push(col[0], col[1], col[2]);
  p.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), -2); c.push(col[0], col[1], col[2]);
  p.push(cx + r * Math.cos(a1), cy + r * Math.sin(a1), -2); c.push(col[0], col[1], col[2]);
}

function fanDisk(p: number[], c: number[], cx: number, cy: number, r: number,
                 segs: number, col: readonly number[]) {
  for (let i = 0; i < segs; i++) {
    posFan(p, c, cx, cy, r, (2 * Math.PI * i) / segs, (2 * Math.PI * (i + 1)) / segs, col);
  }
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------

// fp16-safe hash (no sin/fract of large args)
const HASH = /* glsl */ `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}`;

const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
varying vec2 vUv;
${HASH}
void main() {
  vec2 q = vec2(vUv.x * 8.89 - 4.445, vUv.y * 5.0 - 2.5);
  float waterTop = -0.10, bankTop = -1.15;

  // reed-bed mass — dark mid-green with a warm noon lift on the tops
  vec3 bed = mix(vec3(0.045, 0.075, 0.045), vec3(0.10, 0.15, 0.075), smoothstep(0.4, 1.6, q.y));
  // sparse stem ticks inside the mass
  float tick = step(0.86, hash21(vec2(floor(q.x * 34.0), 3.0)));
  bed += vec3(0.03, 0.05, 0.02) * tick * smoothstep(0.2, 0.9, q.y);

  // open water — blue noon sky reflection with warm shimmer
  vec3 water = mix(vec3(0.10, 0.16, 0.17), vec3(0.16, 0.24, 0.24), 0.5 + 0.5 * q.y);
  // sun glitter — cells twinkle and crawl slowly
  vec2 g = q * vec2(14.0, 22.0);
  vec2 cell = floor(g);
  float h = hash21(cell);
  vec2 c = fract(g) - 0.5;
  float dot_ = 1.0 - smoothstep(0.0, 0.14, length(c));
  float tw = 0.5 + 0.5 * sin(uT * (1.2 + h * 4.0) + h * 40.0);
  water += vec3(0.75, 0.72, 0.5) * dot_ * step(0.88, h) * tw * 0.30;

  // near bank — dark warm mud with a wet dark edge at the waterline
  vec3 bank = mix(vec3(0.035, 0.030, 0.022), vec3(0.075, 0.062, 0.042), smoothstep(-2.1, -1.15, q.y));
  bank += vec3(0.012) * hash21(floor(q * vec2(20.0, 8.0)));
  // wet edge hugs the waterline and fades into the dry mud below — the old
  // (1 - smoothstep) form wiped the gradient over the whole lower bank
  bank = mix(bank, vec3(0.028, 0.024, 0.018), smoothstep(bankTop - 0.30, bankTop - 0.02, q.y));

  vec3 col = bed;
  col = mix(col, water, 1.0 - smoothstep(waterTop - 0.02, waterTop + 0.02, q.y));
  col = mix(col, bank, 1.0 - smoothstep(bankTop - 0.02, bankTop + 0.02, q.y));

  // noon exposure lift — a faint warm veil over the whole frame
  col += vec3(0.03, 0.025, 0.01);
  gl_FragColor = vec4(col, 1.0);
}`;

// silhouette material — vertex colour, tiny shimmer so nothing reads frozen
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

// reed material — stems sway in the breeze: displacement grows with height
// above the bed line; phase comes from each stem's base x so a stem sways
// as one piece
const REED_VERT = /* glsl */ `
uniform float uT;
uniform float uWob;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  float lift = max(p.y - ${BED_Y.toFixed(2)}, 0.0);
  p.x += uWob * lift * 0.05 * sin(uT * 0.9 + p.x * 7.0 + p.y * 1.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const REED_FRAG = LIFE_FRAG;

// ripple ring — alpha envelope handled by uA; a soft bright edge
const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;             // 0 centre → 1 rim
  float ring = smoothstep(0.55, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
  gl_FragColor = vec4(0.55, 0.60, 0.44, ring * uA);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial;
  lifeMat: THREE.ShaderMaterial;
  reedFarMat: THREE.ShaderMaterial; reedNearMat: THREE.ShaderMaterial;
  litTipMat: THREE.ShaderMaterial;
  warbler: THREE.Group; warbMat: THREE.ShaderMaterial; warbThroat: THREE.Mesh; warbBeakTop: THREE.Mesh;
  perchA: { x: number; y: number }; perchB: { x: number; y: number };
  perchC: { x: number; y: number }; perchD: { x: number; y: number };
  dragon: THREE.Mesh; dragMat: THREE.ShaderMaterial;
  moorhen: THREE.Group; moorMat: THREE.ShaderMaterial; moorHead: THREE.Mesh;
  boatman: THREE.Mesh; boatMat: THREE.ShaderMaterial;
  hover: THREE.Mesh; hovMat: THREE.ShaderMaterial;
  leaf: THREE.Mesh; leafMat: THREE.ShaderMaterial;
  rings: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; t0: number; dur: number; r0: number; r1: number }[];
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "reedwarbler",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(4417);
    const st: Partial<St> = {};
    const makeLife = (uA = 1, wob = 1) => new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: wob }, uA: { value: uA } },
      transparent: true, depthTest: false, depthWrite: false,
    });
    const life = () => st.lifeMat!;

    ctx.rig.setLensMm(52);
    ctx.rig.setPath([
      { t: 0, pos: [0, 0.10, 7.4], target: [0, -0.10, 0] },
      { t: 11, pos: [0.10, 0.08, 7.2], target: [0.06, -0.14, 0] },
      { t: DUR, pos: [0.22, 0.07, 7.0], target: [0.12, -0.16, 0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 } }, depthWrite: false, depthTest: false,
    });
    const backMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), st.back);
    backMesh.position.z = -4;
    backMesh.renderOrder = -10;
    ctx.scene3D.add(backMesh);

    st.lifeMat = makeLife(1, 0.7);

    // --- reed bed — ~60 stems, darker bases + feathery tops ------------------
    {
      const p: number[] = [], c: number[] = [];
      const stemC = [0.055, 0.095, 0.05], baseC = [0.030, 0.050, 0.030],
            topC = [0.14, 0.19, 0.09];
      const tips: { x: number; y: number }[] = [];
      for (let i = 0; i < 60; i++) {
        const x = -1.9 + 3.8 * (i / 59) + (rng() - 0.5) * 0.05;
        const h = 0.55 + rng() * 0.45 + 0.15 * Math.sin(i * 0.7);   // stem tops vary
        const lean = (rng() - 0.5) * 0.10;
        const w = 0.008 + rng() * 0.006;
        tips.push({ x: x + lean, y: BED_Y + h });
        // stem: dark base → green shaft
        ribbon(p, c, [[x, BED_Y - 0.12], [x + lean * 0.3, BED_Y + h * 0.35]], w * 1.6, w, baseC);
        ribbon(p, c, [[x + lean * 0.3, BED_Y + h * 0.35], [x + lean, BED_Y + h]], w, w * 0.4, stemC);
        // feathery top — 2 wisps
        ribbon(p, c, [[x + lean, BED_Y + h], [x + lean + 0.03, BED_Y + h + 0.10]], w * 0.7, 0.001, topC);
        ribbon(p, c, [[x + lean, BED_Y + h - 0.02], [x + lean - 0.025, BED_Y + h + 0.07]], w * 0.5, 0.001, topC);
      }
      // warbler perches land on real stem tips near the scripted x targets
      const tipAt = (tx: number): { x: number; y: number } =>
        tips.reduce((b, s) => (Math.abs(s.x - tx) < Math.abs(b.x - tx) ? s : b), tips[0]!);
      st.perchA = tipAt(0.55); st.perchB = tipAt(-0.15);
      st.perchC = tipAt(0.95); st.perchD = tipAt(-0.45);
      st.reedFarMat = new THREE.ShaderMaterial({
        vertexShader: REED_VERT, fragmentShader: REED_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 1 }, uA: { value: 1 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, st.reedFarMat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // near-camera reed row — wider sway, in front of the bed line (y lower)
    {
      const p: number[] = [], c: number[] = [];
      const stemC = [0.035, 0.060, 0.035], topC = [0.11, 0.15, 0.07];
      for (const [x, h, lean] of [[-1.55, 0.50, -0.06], [-1.25, 0.42, 0.04],
                                  [1.60, 0.55, 0.07], [1.30, 0.38, -0.05]] as const) {
        const w = 0.014;
        ribbon(p, c, [[x, BED_Y - 0.16], [x + lean, BED_Y + h]], w * 1.4, w * 0.5, stemC);
        ribbon(p, c, [[x + lean, BED_Y + h], [x + lean + 0.04, BED_Y + h + 0.12]], w * 0.6, 0.001, topC);
      }
      st.reedNearMat = new THREE.ShaderMaterial({
        vertexShader: REED_VERT, fragmentShader: REED_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 2.4 }, uA: { value: 1 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, st.reedNearMat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // one lit reed top — warm lift pulsing with the noon light
    {
      const p: number[] = [], c: number[] = [];
      ribbon(p, c, [[-0.72, BED_Y + 0.55], [-0.70, BED_Y + 0.68]], 0.006, 0.001, [0.32, 0.34, 0.15]);
      ribbon(p, c, [[-0.72, BED_Y + 0.55], [-0.75, BED_Y + 0.65]], 0.004, 0.001, [0.30, 0.32, 0.14]);
      st.litTipMat = new THREE.ShaderMaterial({
        vertexShader: REED_VERT, fragmentShader: REED_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 1.4 }, uA: { value: 0.8 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, st.litTipMat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // --- willow snag over the right edge -------------------------------------
    {
      const p: number[] = [], c: number[] = [];
      const snagC = [0.045, 0.035, 0.025];
      ribbon(p, c, [[2.05, 0.95], [1.55, 0.55]], 0.045, 0.018, snagC);
      ribbon(p, c, [[1.55, 0.55], [1.30, 0.30]], 0.018, 0.006, snagC);
      ribbon(p, c, [[1.60, 0.58], [1.85, 0.30]], 0.014, 0.003, snagC);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, life());
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // --- ripple rings — fish touch, frog edge, boatman pulse -----------------
    st.rings = [];
    const addRing = (x: number, y: number, t0: number, dur: number, r1: number) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: RING_VERT, fragmentShader: RING_FRAG,
        uniforms: { uA: { value: 0 } }, transparent: true,
        depthTest: false, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), mat); // squashed for water-plane read
      mesh.position.set(x, y, 0.02);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
      st.rings!.push({ mesh, mat, t0, dur, r0: 0.02, r1 });
    };
    addRing(0.40, -0.45, FISH_T, 2.2, 0.34);
    addRing(-0.50, -0.62, FROG_T, 1.8, 0.26);
    addRing(0.05, -0.55, BOAT_T, 1.4, 0.18);

    // --- floating leaf circling the pond edge --------------------------------
    {
      st.leafMat = makeLife(0.9, 0.3);
      const p: number[] = [], c: number[] = [];
      poly(p, c, [[-0.025, 0], [0.025, 0.006], [0.020, -0.014], [-0.010, -0.010]], [0.14, 0.17, 0.07]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.leaf = new THREE.Mesh(geo, st.leafMat);
      st.leaf.frustumCulled = false;
      ctx.scene3D.add(st.leaf);
    }

    // --- sedge warbler --------------------------------------------------------
    {
      st.warbMat = makeLife(0, 0.5);
      st.warbler = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const wC = [0.16, 0.10, 0.045];                    // warm brown sliver
      // body: slim horizontal bird
      poly(p, c, [[-0.055, 0.010], [0.045, 0.012], [0.030, 0.045], [-0.045, 0.040]], wC);
      poly(p, c, [[0.035, 0.035], [0.075, 0.045], [0.045, 0.018]], wC);  // tail
      poly(p, c, [[-0.055, 0.030], [-0.085, 0.042], [-0.058, 0.020]], wC); // beak (closed, left)
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, st.warbMat);
      body.frustumCulled = false;
      st.warbler.add(body);

      // open beak sliver — verts relative to the hinge so the mesh position
      // doubles as its pivot: rot -0.9*call swings the tip down-open
      const bp: number[] = [], bc: number[] = [];
      poly(bp, bc, [[0, 0], [-0.027, -0.010], [-0.001, -0.006]], wC);
      const bgeo = new THREE.BufferGeometry();
      bgeo.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
      bgeo.setAttribute("color", new THREE.Float32BufferAttribute(bc, 3));
      st.warbBeakTop = new THREE.Mesh(bgeo, st.warbMat);
      st.warbBeakTop.frustumCulled = false;
      st.warbler.add(st.warbBeakTop);

      // throat puff — pale dot swelling during the call
      const tp: number[] = [], tc: number[] = [];
      fanDisk(tp, tc, 0, 0, 0.011, 6, [0.30, 0.22, 0.10]);
      const tgeo = new THREE.BufferGeometry();
      tgeo.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
      tgeo.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
      st.warbThroat = new THREE.Mesh(tgeo, st.warbMat);
      st.warbThroat.position.set(-0.045, 0.012, 0.001);
      st.warbThroat.frustumCulled = false;
      st.warbler.add(st.warbThroat);

      st.warbler.scale.setScalar(1.35);
      st.warbler.position.set(1.8, 0.6, 0.06);
      ctx.scene3D.add(st.warbler);
    }

    // --- dragonfly -------------------------------------------------------------
    {
      st.dragMat = makeLife(0, 0.2);
      const p: number[] = [], c: number[] = [];
      const dC = [0.05, 0.08, 0.10];
      ribbon(p, c, [[-0.030, 0], [0.030, 0]], 0.004, 0.003, dC);        // body
      ribbon(p, c, [[-0.005, 0], [-0.030, 0.020]], 0.006, 0.010, dC);   // wing pair 1
      ribbon(p, c, [[0.005, 0], [0.030, 0.020]], 0.006, 0.010, dC);     // wing pair 2
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.dragon = new THREE.Mesh(geo, st.dragMat);
      st.dragon.frustumCulled = false;
      ctx.scene3D.add(st.dragon);
    }

    // --- moorhen ---------------------------------------------------------------
    {
      st.moorMat = makeLife(0, 0.4);
      st.moorhen = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const mC = [0.035, 0.030, 0.030];
      // plump body walking left→right, faces +x
      poly(p, c, [[-0.06, 0.00], [0.05, 0.00], [0.055, 0.05], [-0.04, 0.06]], mC);
      poly(p, c, [[-0.05, 0.05], [-0.09, 0.075], [-0.05, 0.075]], mC);       // tail up
      poly(p, c, [[0.045, 0.015], [0.085, 0.02], [0.05, 0.0]], [0.16, 0.05, 0.03]); // red shield/beak
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, st.moorMat);
      body.frustumCulled = false;
      st.moorhen.add(body);
      // head on a neck — bobs while walking
      const hp: number[] = [], hc: number[] = [];
      poly(hp, hc, [[0.03, 0.04], [0.065, 0.075], [0.045, 0.10], [0.025, 0.07]], mC);
      const hgeo = new THREE.BufferGeometry();
      hgeo.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
      hgeo.setAttribute("color", new THREE.Float32BufferAttribute(hc, 3));
      st.moorHead = new THREE.Mesh(hgeo, st.moorMat);
      st.moorHead.frustumCulled = false;
      st.moorhen.add(st.moorHead);
      st.moorhen.scale.setScalar(1.4);
      st.moorhen.position.set(-2.0, BANK_Y, 0.06);
      ctx.scene3D.add(st.moorhen);
    }

    // --- water boatman — tiny oar-stroke silhouette ------------------------------
    {
      st.boatMat = makeLife(0, 0.3);
      const p: number[] = [], c: number[] = [];
      const bC = [0.05, 0.06, 0.05];
      poly(p, c, [[-0.014, 0], [0.014, 0], [0.010, 0.008], [-0.010, 0.008]], bC);
      ribbon(p, c, [[-0.008, 0.002], [-0.024, -0.006]], 0.002, 0.001, bC);   // oar L
      ribbon(p, c, [[0.008, 0.002], [0.024, -0.006]], 0.002, 0.001, bC);    // oar R
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.boatman = new THREE.Mesh(geo, st.boatMat);
      st.boatman.frustumCulled = false;
      ctx.scene3D.add(st.boatman);
    }

    // --- hoverfly ---------------------------------------------------------------
    {
      st.hovMat = makeLife(0, 0);
      const p: number[] = [], c: number[] = [];
      const hC = [0.12, 0.10, 0.04];
      poly(p, c, [[-0.012, 0], [0.012, 0], [0.008, 0.014], [-0.008, 0.014]], hC);
      ribbon(p, c, [[0, 0.010], [-0.018, 0.024]], 0.004, 0.006, [0.16, 0.16, 0.12]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.hover = new THREE.Mesh(geo, st.hovMat);
      st.hover.frustumCulled = false;
      ctx.scene3D.add(st.hover);
    }

    STATE.set(ctx, st as St);
  },

  render: (ctx, f, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;

    st.back.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.reedFarMat.uniforms.uT!.value = t;
    st.reedNearMat.uniforms.uT!.value = t;
    st.litTipMat.uniforms.uT!.value = t;
    st.warbMat.uniforms.uT!.value = t;
    st.dragMat.uniforms.uT!.value = t;
    st.moorMat.uniforms.uT!.value = t;
    st.boatMat.uniforms.uT!.value = t;
    st.hovMat.uniforms.uT!.value = t;
    st.leafMat.uniforms.uT!.value = t;

    // noon light breathing on the lit reed top
    st.litTipMat.uniforms.uA!.value = 0.55 + 0.30 * Math.sin(t * 0.5 + 1.0);

    // --- ripple rings ----------------------------------------------------------
    for (const r of st.rings) {
      const u = clamp01((t - r.t0) / r.dur);
      const s = mix(r.r0, r.r1, sCurve(u));
      r.mesh.scale.set(s * 8, s * 8, 1);
      r.mat.uniforms.uA!.value = 0.42 * (1 - sCurve(u)) * sstep(r.t0, r.t0 + 0.1, t);
    }

    // --- floating leaf — slow edge circuit -------------------------------------
    {
      const ph = (t / DUR) * Math.PI * 2 + 1.2;
      st.leaf.position.set(0.9 * Math.cos(ph), -0.55 + 0.15 * Math.sin(ph), 0.04);
      st.leaf.rotation.z = 0.4 * Math.sin(t * 0.6);
    }

    // --- warbler -----------------------------------------------------------------
    {
      let wx = 1.8, wy = 0.6, a = 0, call = 0;
      const hop = (t0: number, t1: number, from: { x: number; y: number }, to: { x: number; y: number }) => {
        const u = sCurve((t - t0) / (t1 - t0));
        wx = mix(from.x, to.x, u);
        wy = mix(from.y, to.y, u) + 0.09 * Math.abs(Math.sin(u * Math.PI));
      };
      if (t < WB.in1) { a = 0; }
      else if (t < WB.perch1) { hop(WB.in1, WB.perch1, { x: 1.8, y: 0.7 }, st.perchA); a = 0.95; }
      else if (t < WB.drop1) {
        wx = st.perchA.x; wy = st.perchA.y; a = 0.95;
        call = sstep(WB.call, WB.call + 0.15, t) * (1 - sstep(WB.callEnd - 0.15, WB.callEnd, t));
      }
      else if (t < WB.back1) { const u = sCurve((t - WB.drop1) / (WB.back1 - WB.drop1)); wx = st.perchA.x; wy = mix(st.perchA.y, -0.2, u); a = 0.95 * (1 - u); }
      else if (t < WB.dip1) { hop(WB.back1, WB.dip1, { x: -0.55, y: 0.95 }, st.perchB); a = 0.95; }
      else if (t < WB.dip1End) {
        const u = sCurve((t - WB.dip1) / (WB.dip1End - WB.dip1));
        wx = mix(st.perchB.x, NEST.x, u); wy = mix(st.perchB.y, NEST.y, u); a = 0.95;
      }
      else if (t < WB.sit1) { hop(WB.dip1End, WB.sit1, NEST, st.perchB); a = 0.95; }
      else if (t < WB.in2) { wx = st.perchB.x; wy = st.perchB.y; a = 0.95; }
      else if (t < WB.perch2) { hop(WB.in2, WB.perch2, st.perchB, st.perchC); a = 0.95; }
      else if (t < WB.dip2) { wx = st.perchC.x; wy = st.perchC.y; a = 0.95; }
      else if (t < WB.dip2End) {
        const u = sCurve((t - WB.dip2) / (WB.dip2End - WB.dip2));
        wx = mix(st.perchC.x, NEST.x + 0.08, u); wy = mix(st.perchC.y, NEST.y + 0.02, u); a = 0.95;
      }
      else if (t < WB.sit2) { hop(WB.dip2End, WB.sit2, { x: NEST.x + 0.08, y: NEST.y + 0.02 }, st.perchC); a = 0.95; }
      else if (t < WB.hide2) { wx = st.perchC.x; wy = st.perchC.y; a = 0.95; }
      else if (t < WB.back3) { const u = sCurve((t - WB.hide2) / (WB.back3 - WB.hide2)); wx = st.perchC.x; wy = mix(st.perchC.y, -0.2, u); a = 0.95 * (1 - u); }
      else if (t < WB.perch3) { hop(WB.back3, WB.perch3, { x: -1.4, y: 1.0 }, st.perchD); a = 0.95; }
      else { wx = st.perchD.x; wy = st.perchD.y; a = 0.95; }

      st.warbler.position.set(wx, wy, 0.06);
      st.warbMat.uniforms.uA!.value = a;
      // call read: throat swells, beak opens
      st.warbThroat.scale.setScalar(1 + 1.6 * call);
      st.warbBeakTop.rotation.z = -0.9 * call;
      st.warbBeakTop.position.set(-0.055, 0.028, 0.001);
    }

    // --- dragonfly — slow oval patrol ---------------------------------------------
    {
      const on = sstep(DRAGON.t0, DRAGON.t0 + 0.4, t) * (1 - sstep(DRAGON.t1 - 0.3, DRAGON.t1, t));
      const ph = (t - DRAGON.t0) * 1.4;
      st.dragon.position.set(0.55 + 0.75 * Math.cos(ph), -0.48 + 0.20 * Math.sin(ph), 0.05);
      st.dragon.rotation.z = 0.5 * Math.cos(ph);
      st.dragMat.uniforms.uA!.value = on * 0.9;
    }

    // --- moorhen — one bank stalk, head-bob gait ----------------------------------
    {
      const u = clamp01((t - MOOR.t0) / (MOOR.t1 - MOOR.t0));
      const on = sstep(MOOR.t0, MOOR.t0 + 0.4, t) * (1 - sstep(MOOR.t1 - 0.4, MOOR.t1, t));
      st.moorhen.position.set(mix(-1.9, 1.9, sCurve(u)), BANK_Y + 0.012 * Math.abs(Math.sin(u * Math.PI * 22)), 0.06);
      st.moorHead.rotation.z = 0.30 * Math.sin(u * Math.PI * 22) * on;
      st.moorMat.uniforms.uA!.value = on;
    }

    // --- water boatman — pulse to the surface once ---------------------------------
    {
      const on = sstep(BOAT_T, BOAT_T + 0.3, t) * (1 - sstep(BOAT_T + 0.9, BOAT_T + 1.3, t));
      const u = clamp01((t - BOAT_T) / 1.3);
      st.boatman.position.set(0.05 + 0.1 * u, -0.72 + 0.22 * sCurve(u), 0.05);
      st.boatMat.uniforms.uA!.value = on * 0.85;
    }

    // --- hoverfly — station over the near bank --------------------------------------
    {
      const on = sstep(MOOR.t0, MOOR.t0 + 0.5, t) * (1 - sstep(MOOR.t1 - 0.3, MOOR.t1, t));
      st.hover.position.set(0.95 + 0.015 * Math.sin(t * 13), -1.35 + 0.012 * Math.sin(t * 17), 0.05);
      st.hovMat.uniforms.uA!.value = on * 0.8;
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  }
});

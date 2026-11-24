// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// tidepoolday — a single tidepool teeming at midday: basalt rim, still teal
// water under hard sun, crab patrol, goby dart, barnacle bloom, snail arc.
// All motion is closed-form f(t); silhouettes are flat shapes at z ≈ -2 seen
// by a near-static macro camera.
// ---------------------------------------------------------------------------

const DUR = 24.0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

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
const CRAB = { t0: 4.8, pause1: 6.0, clawT: 7.0, slipT: 8.7, goneT: 9.4 };
const GOBY = { t0: 10.2, t1: 11.6 };
const BARN = { t0: 13.0, t1: 15.0 };
const DROP_T = 14.0;          // weed droplet ring
const SNAIL = { t0: 16.9, t1: 23.6 };
const LIMPET = { t0: 16.5, t1: 23.5 };
const HERON = { t0: 19.6, t1: 21.2 };

const POOL = { cx: 0.0, cy: -0.55, rx: 2.05, ry: 0.72 };
const rimY = (x: number) => 0.30 + 0.05 * Math.sin(x * 2.1) + 0.03 * Math.sin(x * 4.7 + 1.3);

// ---------------------------------------------------------------------------
// geometry helpers — flat ribbons/polygons in the z=-2 picture plane
// ---------------------------------------------------------------------------

function poly(pos: number[], col: number[], verts: number[][], c: number[]) {
  for (let i = 1; i < verts.length - 1; i++) {
    pos.push(verts[0][0], verts[0][1], -2.0, verts[i][0], verts[i][1], -2.0, verts[i + 1][0], verts[i + 1][1], -2.0);
    for (let k = 0; k < 3; k++) col.push(...c);
  }
}

// tapered ribbon along points — width w0→w1, colour c
function ribbon(pos: number[], col: number[], pts: number[][], w0: number, w1: number, c: number[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const wa = mix(w0, w1, t0) / 2, wb = mix(w0, w1, t1) / 2;
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const A: number[][] = [
      [ax + nx * wa, ay + ny * wa], [ax - nx * wa, ay - ny * wa],
      [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb]
    ];
    // perimeter order (side1@a → side2@a → side2@b → side1@b) — avoids a bowtie
    poly(pos, col, [A[0], A[1], A[3], A[2]], c);
  }
}

// radial fan: n narrow triangles from (cx,cy) sweeping a0..a1 — anemone crowns,
// barnacle filaments. r varies per spoke for a ragged edge.
function fan(pos: number[], col: number[], cx: number, cy: number, a0: number, a1: number, n: number, r: number, w: number, c: number[], rng: () => number) {
  let pv: number[] | null = null;
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = a0 + (a1 - a0) * u;
    const rr = r * (0.75 + 0.5 * rng());
    const v = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8];
    if (pv) {
      pos.push(cx, cy, -2.0, pv[0], pv[1], -2.0, v[0], v[1], -2.0);
      for (let k = 0; k < 3; k++) col.push(...c);
    }
    pv = v;
  }
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------

// backdrop — pale noon sky, jagged wet basalt rim, teal pool with sun
// glitter + ring ripples; q-space is world × (10/12.5, 7/7.5) on a 12.5×7.5 plane
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uT;
uniform vec2 uRing0;   // [t0, x] crab slip-in ring
uniform vec2 uRing1;   // [t0, x] weed droplet ring
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  // pale haze sky
  vec3 col = mix(vec3(0.72, 0.76, 0.72), vec3(0.93, 0.94, 0.86), smoothstep(-1.0, 3.2, q.y));
  col += vec3(0.06, 0.05, 0.02) * smoothstep(1.2, 3.2, q.y); // white haze lift
  // basalt rim — lumpy band between rim and rockTop, taller at frame edges
  // so the rocks frame the pool; pale sky shows above them
  float rim = 0.30 + 0.05 * sin(q.x * 2.1) + 0.03 * sin(q.x * 4.7 + 1.3);
  float rockTop = rim + 0.20 + 0.10 * sin(q.x * 3.1 + 0.6) + 1.5 * smoothstep(2.6, 4.0, abs(q.x));
  float inRock = smoothstep(rim - 0.04, rim + 0.02, q.y) * (1.0 - smoothstep(rockTop - 0.03, rockTop + 0.05, q.y));
  vec3 rock = vec3(0.10, 0.12, 0.12) * (0.75 + 0.5 * hash21(floor(q * vec2(4.0, 6.0))));
  rock += vec3(0.10, 0.11, 0.09) * smoothstep(0.0, 0.25, q.y - rim) * 0.4;  // wet sheen at edge
  col = mix(col, rock, inRock);
  // pool basin — teal with depth gradient, clipped to its ellipse
  vec2 pe = vec2((q.x - 0.0) / 2.05, (q.y + 0.55) / 0.72);
  float d = dot(pe, pe);
  float inPool = 1.0 - smoothstep(0.94, 1.02, d);
  vec3 water = mix(vec3(0.04, 0.24, 0.24), vec3(0.16, 0.50, 0.44), 0.5 + 0.5 * pe.y);
  water += vec3(0.10, 0.16, 0.12) * (1.0 - d);                    // lit centre
  // sun glitter — sparkling cells tracked by time
  vec2 g = q * vec2(7.0, 10.0);
  vec2 cell = floor(g), f = fract(g);
  float h = hash21(cell + floor(uT * 3.0) * 0.13);
  float spark = smoothstep(0.94, 1.0, h) * (1.0 - smoothstep(0.05, 0.30, length(f - 0.5)));
  water += vec3(1.0, 0.95, 0.72) * spark * 0.8;
  // ring ripples — expanding thin annuli, two event rings + one ambient
  for (int i = 0; i < 3; i++) {
    float t0 = i == 0 ? uRing0.x : i == 1 ? uRing1.x : 5.0;
    float cxx = i == 0 ? uRing0.y : i == 1 ? uRing1.y : 0.4;
    float cyy = i == 2 ? -0.30 : -0.30;
    float age = max(0.0, uT - t0);
    float rr = age * (i == 2 ? 0.22 : 0.45);
    float dd = distance(q, vec2(cxx, cyy));
    float wdt = max(0.01, 0.035 + 0.05 * age);
    float ring = 1.0 - smoothstep(0.0, wdt, abs(dd - rr));
    float amp = (i == 2 ? 0.10 * (0.5 + 0.5 * sin(uT * 0.5)) : 0.35) * exp(-age * 0.9) * step(0.001, age);
    water += vec3(0.55, 0.65, 0.55) * ring * amp;
  }
  col = mix(col, water, inPool);
  // wet sheen line where rock meets water
  col += vec3(0.14, 0.16, 0.13) * (1.0 - inRock) * (1.0 - smoothstep(0.0, 0.05, abs(q.y - rim + 0.02))) * 0.35;
  gl_FragColor = vec4(col, 1.0);
}`;

// sway for ribbons (kelp bob, anemone wave) — vertex colour × sway envelope
const RIB_VERT = /* glsl */ `
uniform float uT;
uniform float uSway;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  p.x += uSway * (0.012 * sin(uT * 1.3 + p.y * 3.0) + 0.006 * sin(uT * 2.7));
  p.y += uSway * 0.008 * sin(uT * 1.7 + p.x * 4.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const RIB_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, uA); }`;

// life silhouettes — plain dark mesh, gentle wobble
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
const LIFE_FRAG = RIB_FRAG;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

// per-act ctx state (each project entry gets its own SceneContext)
const STATE = new WeakMap<object, St>();
interface St {
  back: THREE.ShaderMaterial; ribMat: THREE.ShaderMaterial; ptMat: THREE.ShaderMaterial;
  crab: THREE.Group; crabClaw: THREE.Mesh; goby: THREE.Mesh; snail: THREE.Mesh;
  slime: THREE.Mesh; limpet: THREE.Mesh; heron: THREE.Mesh;
  barnMats: THREE.ShaderMaterial[]; barnFil: THREE.Mesh[]; aneMats: THREE.ShaderMaterial[];
}

export default defineScene({
  id: "tidepoolday",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(9021);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — very low macro near-static, tiny drift as the sun moves
    ctx.rig.setLensMm(78);
    ctx.rig.setPath([
      { t: 0.00, pos: [0.00, 0.62, 4.60], target: [0.00, 0.02, -2.0] },
      { t: 0.40, pos: [0.18, 0.60, 4.35], target: [-0.28, -0.02, -2.0] },
      { t: 0.70, pos: [0.05, 0.58, 4.20], target: [0.10, -0.05, -2.0] },
      { t: 1.00, pos: [0.12, 0.56, 4.10], target: [0.05, -0.08, -2.0] },
    ]);

    // --- backdrop -----------------------------------------------------------
    const backMat = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 }, uRing0: { value: new THREE.Vector2(CRAB.slipT, -0.62) }, uRing1: { value: new THREE.Vector2(DROP_T, 1.2) } },
      depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), backMat);
    back.position.z = -4; back.renderOrder = -10;
    ctx.scene3D.add(back);
    st.back = backMat;

    // --- rock crown polygons over the rim -----------------------------------
    const rockPos: number[] = [], rockCol: number[] = [];
    for (let i = 0; i < 9; i++) {
      const x = -4.4 + i * 1.1 + (rng() - 0.5) * 0.45;
      const y0 = rimY(x) - 0.06, h = 0.28 + rng() * 0.5, w = 0.42 + rng() * 0.4;
      poly(rockPos, rockCol, [
        [x - w, y0], [x - w * 0.4, y0 + h * (0.7 + rng() * 0.5)], [x + w * 0.2, y0 + h],
        [x + w, y0 + h * 0.5], [x + w * 0.8, y0]
      ], [0.11, 0.13, 0.13]);
    }
    const rockGeo = new THREE.BufferGeometry();
    rockGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rockPos), 3));
    rockGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rockCol), 3));
    const ribMat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT, fragmentShader: RIB_FRAG, vertexColors: true, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uSway: { value: 0 }, uA: { value: 1 } }, transparent: true,
    });
    const rocks = new THREE.Mesh(rockGeo, ribMat);
    rocks.frustumCulled = false;
    ctx.scene3D.add(rocks);
    st.ribMat = ribMat;

    // --- kelp fronds — 2 thin drifting ribbons on the surface ---------------
    const kelpPos: number[] = [], kelpCol: number[] = [];
    const kc = [0.16, 0.34, 0.20];
    ribbon(kelpPos, kelpCol, [[-1.4, -0.52], [-1.0, -0.46], [-0.55, -0.50], [-0.15, -0.44]], 0.05, 0.02, kc);
    ribbon(kelpPos, kelpCol, [[0.9, -0.30], [1.25, -0.36], [1.6, -0.32]], 0.04, 0.015, kc);
    const kelpGeo = new THREE.BufferGeometry();
    kelpGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(kelpPos), 3));
    kelpGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(kelpCol), 3));
    const kelp = new THREE.Mesh(kelpGeo, ribMat);
    kelp.frustumCulled = false;
    ctx.scene3D.add(kelp);

    // --- anemone crowns — 4 waving fans on the pool floor --------------------
    st.aneMats = [];
    const aneSpots: [number, number, number[]][] = [
      [-1.15, -0.72, [0.79, 0.35, 0.42]], [-0.35, -0.85, [0.55, 0.62, 0.30]],
      [0.85, -0.75, [0.79, 0.35, 0.42]], [1.55, -0.55, [0.48, 0.61, 0.30]]
    ];
    for (const [ax, ay, ac] of aneSpots) {
      const ap: number[] = [], aco: number[] = [];
      fan(ap, aco, 0, 0, -Math.PI * 0.15, Math.PI * 1.15, 11, 0.10 + rng() * 0.04, 0.012,
        [ac[0] * 0.72, ac[1] * 0.72, ac[2] * 0.72], rng);
      // short column
      poly(ap, aco, [[-0.025, 0], [0.025, 0], [0.02, -0.09], [-0.02, -0.09]], [ac[0] * 0.45, ac[1] * 0.45, ac[2] * 0.45]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ap), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(aco), 3));
      const m = ribMat.clone();
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(ax, ay, 0.02);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
      st.aneMats.push(m);
    }

    // --- barnacle tufts — shells sit on the rim face; filament fans open on
    // the bloom beat (scale + alpha), swaying once out ------------------------
    st.barnMats = [];
    st.barnFil = [];
    const barnSpots: [number, number][] = [[0.82, 0.40], [1.14, 0.44], [0.98, 0.33]];
    for (const [bx, by] of barnSpots) {
      // shell bump — always visible on the rock face
      const shp: number[] = [], shc: number[] = [];
      poly(shp, shc, [[-0.05, 0], [0.05, 0], [0.04, 0.04], [-0.04, 0.04]], [0.30, 0.30, 0.28]);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(shp), 3));
      sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(shc), 3));
      const shell = new THREE.Mesh(sg, ribMat.clone());
      (shell.material as THREE.ShaderMaterial).uniforms.uA!.value = 0.9;
      shell.position.set(bx, by, 0.03);
      shell.frustumCulled = false;
      ctx.scene3D.add(shell);
      // filament fan — hidden until the bloom beat, then opens outward
      const fp: number[] = [], fc: number[] = [];
      fan(fp, fc, 0, 0, Math.PI * 0.15, Math.PI * 0.85, 6, 0.10, 0.008, [0.75, 0.72, 0.62], rng);
      const fg = new THREE.BufferGeometry();
      fg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(fp), 3));
      fg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(fc), 3));
      const m = ribMat.clone();
      const fil = new THREE.Mesh(fg, m);
      fil.position.set(bx, by + 0.04, 0.04);
      fil.frustumCulled = false;
      ctx.scene3D.add(fil);
      st.barnMats.push(m);
      st.barnFil.push(fil);
    }

    // --- crab — rust silhouette: body + 4 leg ribbons + claw ------------------
    const lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uWob: { value: 0.5 }, uA: { value: 0 } }, transparent: true,
    });
    const crabGroup = new THREE.Group();
    const cp: number[] = [], cc: number[] = [];
    const crabC = [0.48, 0.23, 0.13];
    // domed body
    const bodyPts: number[][] = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (i / 8); bodyPts.push([Math.cos(a) * 0.11, Math.sin(a) * 0.055]); }
    bodyPts.push([0.11, -0.02], [-0.11, -0.02]);
    poly(cp, cc, bodyPts, crabC);
    // 4 leg ribbons per side
    for (let s = -1; s <= 1; s += 2) {
      for (let l = 0; l < 4; l++) {
        const bx = s * (0.05 + l * 0.02);
        ribbon(cp, cc, [[bx, -0.02], [bx + s * 0.07, -0.07], [bx + s * 0.09, -0.11]], 0.018, 0.008, crabC);
      }
    }
    const crabGeo = new THREE.BufferGeometry();
    crabGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cp), 3));
    crabGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cc), 3));
    const crabBody = new THREE.Mesh(crabGeo, lifeMat);
    crabBody.frustumCulled = false;
    crabGroup.add(crabBody);
    // claw — separate mesh so it can lift on the wave beat
    const clp: number[] = [], clc: number[] = [];
    poly(clp, clc, [[0.10, 0.0], [0.16, 0.03], [0.20, 0.02], [0.17, -0.01]], crabC);
    poly(clp, clc, [[0.10, 0.0], [0.15, 0.05], [0.19, 0.06], [0.16, 0.03]], [crabC[0] * 1.2, crabC[1] * 1.2, crabC[2] * 1.2]);
    const clawGeo = new THREE.BufferGeometry();
    clawGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(clp), 3));
    clawGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(clc), 3));
    const claw = new THREE.Mesh(clawGeo, lifeMat);
    claw.frustumCulled = false;
    crabGroup.add(claw);
    ctx.scene3D.add(crabGroup);
    st.crab = crabGroup; st.crabClaw = claw;

    // --- goby — small slate dart ---------------------------------------------
    const gp: number[] = [], gc: number[] = [];
    poly(gp, gc, [[0, 0.025], [0.13, 0.012], [0.19, 0], [0.13, -0.012], [0, -0.025], [-0.05, 0]], [0.23, 0.27, 0.28]);
    poly(gp, gc, [[-0.05, 0], [-0.09, 0.03], [-0.09, -0.03]], [0.20, 0.24, 0.25]);
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3));
    gGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gc), 3));
    const goby = new THREE.Mesh(gGeo, lifeMat.clone());
    goby.frustumCulled = false;
    ctx.scene3D.add(goby);
    st.goby = goby;

    // --- snail + slime glint ---------------------------------------------------
    const sp: number[] = [], sc: number[] = [];
    const snailC = [0.54, 0.42, 0.23];
    poly(sp, sc, [[-0.05, 0], [0.06, 0], [0.07, 0.025], [-0.04, 0.03]], snailC);           // foot
    const shellPts: number[][] = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); shellPts.push([0.005 + Math.cos(a) * 0.045, 0.03 + Math.sin(a) * 0.04]); }
    shellPts.push([0.05, 0.028], [-0.04, 0.028]);
    poly(sp, sc, shellPts, [0.44, 0.33, 0.18]);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sp), 3));
    sGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sc), 3));
    const snail = new THREE.Mesh(sGeo, lifeMat.clone());
    snail.frustumCulled = false;
    ctx.scene3D.add(snail);
    st.snail = snail;
    // slime glint — thin bright ribbon trail behind (fixed geometry, revealed by uA)
    const slp: number[] = [], slc: number[] = [];
    ribbon(slp, slc, [[-1.35, rimY(-1.35) - 0.06], [-0.9, rimY(-0.9) - 0.05], [-0.5, rimY(-0.5) - 0.05], [-0.1, rimY(-0.1) - 0.05], [0.3, rimY(0.3) - 0.05]], 0.014, 0.010, [0.55, 0.58, 0.50]);
    const slGeo = new THREE.BufferGeometry();
    slGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(slp), 3));
    slGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(slc), 3));
    const slime = new THREE.Mesh(slGeo, ribMat.clone());
    slime.frustumCulled = false;
    (slime.material as THREE.ShaderMaterial).uniforms.uA!.value = 0;
    ctx.scene3D.add(slime);
    st.slime = slime;

    // --- limpet — small cone on the rock edge ---------------------------------
    const lp: number[] = [], lc: number[] = [];
    const lpPts: number[][] = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI * (i / 6); lpPts.push([Math.cos(a) * 0.035, Math.sin(a) * 0.045]); }
    lpPts.push([0.035, 0], [-0.035, 0]);
    poly(lp, lc, lpPts, [0.32, 0.31, 0.27]);
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    lGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(lc), 3));
    const limpet = new THREE.Mesh(lGeo, lifeMat.clone());
    limpet.position.set(-0.85, rimY(-0.85) + 0.03, 0.03);
    limpet.frustumCulled = false;
    (limpet.material as THREE.ShaderMaterial).uniforms.uA!.value = 0.9;
    ctx.scene3D.add(limpet);
    st.limpet = limpet;

    // --- heron shadow — big soft ellipse crossing the pool once ----------------
    const heronMat = new THREE.ShaderMaterial({
      vertexShader: RIB_VERT, fragmentShader: RIB_FRAG, vertexColors: true, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uSway: { value: 0 }, uA: { value: 0 } }, transparent: true,
    });
    const hp: number[] = [], hc: number[] = [];
    const he: number[][] = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2; he.push([Math.cos(a) * 1.4, Math.sin(a) * 0.42]); }
    poly(hp, hc, he, [0.02, 0.03, 0.03]);
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(hp), 3));
    hGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(hc), 3));
    const heron = new THREE.Mesh(hGeo, heronMat);
    heron.position.z = 0.05;
    heron.frustumCulled = false;
    ctx.scene3D.add(heron);
    st.heron = heron;

    // --- glitter points --------------------------------------------------------
    const pp: number[] = [], pk: number[] = [], ps: number[] = [], pT0: number[] = [], pT1: number[] = [];
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      pp.push(POOL.cx + Math.cos(a) * POOL.rx * 0.9 * r, POOL.cy + Math.sin(a) * POOL.ry * 0.9 * r, -1.9);
      pk.push(0); ps.push(rng() * 31); pT0.push(0); pT1.push(DUR);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pp), 3));
    pg.setAttribute("aKind", new THREE.BufferAttribute(new Float32Array(pk), 1));
    pg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(ps), 1));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aKind; attribute float aSeed;
        uniform float uT; uniform float uPx;
        varying float vA;
        void main() {
          vec3 p = position;
          float tw = 0.5 + 0.5 * sin(uT * (2.0 + fract(aSeed * 3.7) * 4.0) + aSeed * 13.0);
          vA = tw * (0.35 + 0.55 * fract(aSeed * 7.1));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (2.0 + fract(aSeed * 5.3) * 4.0) * (3.4 / -mv.z) * uPx;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = vA * (1.0 - smoothstep(0.6, 1.0, d));
          gl_FragColor = vec4(1.0, 0.97, 0.80, a);
        }`,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(pg, ptMat);
    pts.frustumCulled = false;
    ctx.scene3D.add(pts);
    st.ptMat = ptMat;
  },

  render: (ctx, f, out) => {
    const t = f.t;
    const st = STATE.get(ctx)!;

    st.back.uniforms.uT!.value = t;
    st.ribMat.uniforms.uT!.value = t;
    st.ribMat.uniforms.uSway!.value = 0.6;
    st.ptMat.uniforms.uT!.value = t;
    st.ptMat.uniforms.uPx!.value = out.height / 1080;

    // anemone sway + barnacle bloom
    for (const m of st.aneMats) { m.uniforms.uT!.value = t; m.uniforms.uSway!.value = 0.9; }
    const bloom = sstep(BARN.t0, BARN.t1, t);
    for (let i = 0; i < st.barnMats.length; i++) {
      const m = st.barnMats[i]!;
      m.uniforms.uT!.value = t;
      m.uniforms.uSway!.value = 1.2 * bloom;
      m.uniforms.uA!.value = bloom;
      // filaments open outward from the shell — a bloom, not a fade
      st.barnFil[i]!.scale.setScalar(0.15 + 0.85 * bloom);
    }

    // crab — walk the rim, two pauses, claw wave, slip in
    {
      const crabMat = st.crabClaw.material as THREE.ShaderMaterial;
      const u = sstep(CRAB.t0, CRAB.slipT, t);
      // patrol x with two pause notches (steps eased via sstep pieces)
      const step = (a: number, b: number, x0: number, x1: number) =>
        sstep(a, b, t) * 0 + (t < a ? x0 : t > b ? x1 : mix(x0, x1, sstep(a, b, t)));
      let x = -1.95;
      x = mix(-1.95, -1.35, sstep(CRAB.t0, 5.6, t));
      x = mix(x, -1.05, sstep(6.4, 7.2, t));
      x = mix(x, -0.62, sstep(7.6, CRAB.slipT, t));
      let y = rimY(x) - 0.05;
      const slip = sstep(CRAB.slipT, CRAB.goneT, t);
      y -= slip * 0.5;
      st.crab.position.set(x, y, 0.04);
      st.crab.rotation.z = 0.04 * Math.sin(t * 6.0) * (1 - slip);
      // claw wave at ~7s
      const wave = Math.sin(Math.min(2, Math.max(0, (t - CRAB.clawT) * 2.2)) * Math.PI);
      st.crabClaw.rotation.z = wave * 0.9;
      crabMat.uniforms.uT!.value = t;
      crabMat.uniforms.uA!.value = (t > CRAB.t0 - 0.1 ? 1 : 0) * (1 - slip * 0.85);
    }

    // goby dart — quick streak under the rock edge
    {
      const m = st.goby.material as THREE.ShaderMaterial;
      const u = sstep(GOBY.t0, GOBY.t1, t);
      const x = mix(-2.1, 2.0, u * u);
      const y = -0.62 + 0.05 * Math.sin(u * Math.PI * 3);
      st.goby.position.set(x, y, 0.02);
      st.goby.rotation.z = 0.12 * Math.sin(u * Math.PI * 3);
      m.uniforms.uT!.value = t;
      m.uniforms.uA!.value = (t > GOBY.t0 && t < GOBY.t1 ? 1 : 0) * 0.95;
    }

    // snail — slow arc along the lower rim, slime glint trails behind
    {
      const m = st.snail.material as THREE.ShaderMaterial;
      const u = sstep(SNAIL.t0, SNAIL.t1, t);
      const x = mix(-1.3, 0.35, u);
      st.snail.position.set(x, rimY(x) - 0.06, 0.035);
      m.uniforms.uT!.value = t;
      m.uniforms.uA!.value = t > SNAIL.t0 - 0.1 ? 1 : 0;
      const sm = st.slime.material as THREE.ShaderMaterial;
      sm.uniforms.uT!.value = t;
      sm.uniforms.uA!.value = 0.55 * sstep(SNAIL.t0 + 0.3, SNAIL.t0 + 2.5, t);
    }

    // limpet — moves a hair over the last act
    {
      const u = sstep(LIMPET.t0, LIMPET.t1, t);
      st.limpet.position.x = -0.85 + 0.14 * u;
      st.limpet.position.y = rimY(-0.85 + 0.14 * u) + 0.03;
      (st.limpet.material as THREE.ShaderMaterial).uniforms.uT!.value = t;
    }

    // heron shadow — one sweep across the pool
    {
      const u = sstep(HERON.t0, HERON.t1, t);
      st.heron.position.x = mix(-4.5, 4.5, u);
      st.heron.position.y = -0.35 + 0.1 * Math.sin(u * Math.PI);
      const m = st.heron.material as THREE.ShaderMaterial;
      m.uniforms.uT!.value = t;
      m.uniforms.uA!.value = 0.22 * Math.sin(Math.PI * u) * (t > HERON.t0 && t < HERON.t1 ? 1 : 0);
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

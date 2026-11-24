// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// harvestmoon — a huge orange harvest moon rising over a stubble field at blue
// hour; two straggling lines of crows cross its face. Flat silhouettes on the
// z=-2 picture plane; the cratered moon is a shader disc at z=-2.5 and the
// sky/field backdrop a full-screen shader plane at z=-4. All motion f(t).
// ---------------------------------------------------------------------------

const DUR = 22.0;
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
const HARE = { t0: 5.0, t1: 9.0 };
const CROWS1 = { t0: 8.5, t1: 11.5 };
const CROWS2 = { t0: 16.5, t1: 19.5 };
const CAB_T = 14.0;
const FIREFLY_T = 10.0;
const WINDOW_T = 12.0;

// moon path — rises through the frame over ~20s, drifting a touch right
const moonX = (t: number) => 0.45 + 0.10 * sCurve(clamp01(t / 20));
const moonY = (t: number) => mix(0.10, 0.82, sCurve(clamp01(t / 20)));
const MOON_R = 0.87;

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
// backdrop — blue-hour sky, amber horizon band behind the moon's side, a dark
// hedge line, and the stubble field whose rows catch faint warm light under
// the moon. Plane at z=-4 behind everything.
// ---------------------------------------------------------------------------
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
uniform float uMoonX;   // world x of the moon → horizon glow follows it
uniform float uMoonY;
varying vec2 vUv;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 q = (vUv - 0.5) * vec2(12.0, 7.0);
  float hor = -0.62;                          // horizon line in backdrop coords

  // blue-hour sky — deep indigo overhead cooling toward dusk-blue at the rim
  vec3 sky = mix(vec3(0.10, 0.13, 0.22), vec3(0.035, 0.05, 0.11), smoothstep(-0.5, 3.4, q.y));
  // warm band low behind the moon's azimuth — the glow the disc rises out of
  float gx = q.x - uMoonX * 1.6;              // backdrop is wider than the life plane
  float band = (1.0 - smoothstep(0.0, 1.15, q.y - hor)) * exp(-gx * gx * 0.16);
  // glow climbs with the moon — brightest while it hangs low
  band *= 1.15 - 0.45 * smoothstep(0.3, 1.0, uMoonY);
  sky += vec3(0.72, 0.36, 0.10) * band;
  // faint high streak clouds
  float cl = sin(q.x * 0.9 + q.y * 6.0 + uT * 0.02) * sin(q.x * 0.5 - 1.0);
  sky += vec3(0.03, 0.035, 0.05) * smoothstep(0.55, 0.95, cl) * smoothstep(0.6, 2.4, q.y);
  vec3 col = sky;

  // hedge silhouette — a bumpy dark band riding the horizon
  float hedge = 1.0 - smoothstep(hor - 0.16, hor - 0.02, q.y + 0.10 * sin(q.x * 3.1) * smoothstep(2.0, 4.0, abs(q.x)));
  vec3 hedgeCol = vec3(0.030, 0.038, 0.045);

  // stubble field below the horizon — cut rows catching faint moonlight
  float below = 1.0 - smoothstep(hor - 0.02, hor + 0.02, q.y);
  float depth = 1.0 - smoothstep(-3.4, hor - 0.02, q.y); // 0 at horizon → 1 near camera
  float rows = 0.5 + 0.5 * sin(q.x * 17.0 + q.y * 5.0);  // converging row stripes
  rows = rows * rows * rows * (1.0 - depth);
  vec3 field = mix(vec3(0.055, 0.050, 0.052), vec3(0.028, 0.026, 0.030), depth);
  // stubble tips glint warm under the moon's side — strongest near the horizon
  float spill = exp(-(q.x - uMoonX * 1.6) * (q.x - uMoonX * 1.6) * 0.35) * (0.4 + 0.6 * smoothstep(0.2, 0.8, uMoonY));
  field += vec3(0.26, 0.14, 0.05) * rows * spill;
  field += vec3(0.03, 0.03, 0.04) * rows * 0.6;

  col = mix(col, hedgeCol, hedge * (1.0 - below));
  col = mix(col, field, below);
  // the hedge band fades out a little below the horizon, not the whole field
  float hedgeBelow = hedge * (1.0 - smoothstep(hor - 0.45, hor - 0.10, q.y));
  col = mix(col, hedgeCol, hedgeBelow * below * 0.9);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------
// moon — cratered orange disc with a warm chromatic limb and soft halo.
// Plane 2.7x2.7 at z=-2.5; shader space is world units, disc radius MOON_R.
// ---------------------------------------------------------------------------
const MOON_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const MOON_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
uniform float uHor;   // horizon y in quad-local coords (moonY subtracted)
varying vec2 vUv;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 q = (vUv - 0.5) * 2.7;                 // world units across the quad
  float d = length(q);
  float disc = 1.0 - smoothstep(0.85, 0.89, d); // disc edge at |q|≈0.87
  // harvest-moon body — deep orange at the limb, paler toward the crown
  vec3 m = mix(vec3(0.95, 0.45, 0.13), vec3(0.80, 0.26, 0.07), smoothstep(-0.4, 0.9, q.y + d * 0.4));
  // maria + crater texture — blotchy darker seas, soft mottled pits
  float maria = noise2(q * 4.5 + 3.0) * 0.55 + noise2(q * 9.0) * 0.30 + noise2(q * 18.0 + 7.0) * 0.15;
  m *= 0.72 + 0.28 * maria;
  // limb darkening + warm fringe — the slightly chromatic rim of a low moon
  m *= 0.82 + 0.18 * (1.0 - smoothstep(0.70, 0.87, d));
  m += vec3(0.30, 0.12, -0.02) * smoothstep(0.76, 0.87, d) * disc;
  // halo — soft orange spill past the limb; fades to zero before the quad edge
  float halo = (1.0 - smoothstep(0.87, 1.30, d)) * (1.0 - disc);
  vec3 glow = vec3(0.85, 0.40, 0.12) * halo * 0.45;
  vec3 col = m * disc + glow;
  // the field occludes whatever dips below the horizon line
  float occl = smoothstep(uHor - 0.04, uHor + 0.03, q.y);
  float a = clamp(disc + halo * 0.55, 0.0, 1.0) * occl;
  gl_FragColor = vec4(col, a);
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
  back: THREE.ShaderMaterial; moon: THREE.Mesh; moonMat: THREE.ShaderMaterial;
  lifeMat: THREE.ShaderMaterial;
  hare: THREE.Group; hareMat: THREE.ShaderMaterial;
  sleeve: THREE.Mesh;
  crows1: THREE.Group[]; crows2: THREE.Group[];
  crow1Mat: THREE.ShaderMaterial; crow2Mat: THREE.ShaderMaterial;
  cabMat: THREE.ShaderMaterial; winMat: THREE.ShaderMaterial;
  flies: THREE.Mesh[]; flyMat: THREE.ShaderMaterial;
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "harvestmoon",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(4211);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — very low, near-static; slight drift right so the moon's rise
    // reads against the barn/oak frame
    ctx.rig.setLensMm(56);
    ctx.rig.setPath([
      { t: 0.00, pos: [-0.30, 0.35, 4.70], target: [0.20, 0.20, -2.0] },
      { t: 0.50, pos: [-0.10, 0.33, 4.65], target: [0.40, 0.30, -2.0] },
      { t: 1.00, pos: [0.05, 0.30, 4.55], target: [0.38, 0.40, -2.0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 }, uMoonX: { value: 0.45 }, uMoonY: { value: 0.26 } },
      depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), st.back);
    back.position.z = -4; back.renderOrder = -10;
    ctx.scene3D.add(back);

    // --- moon ----------------------------------------------------------------
    st.moonMat = new THREE.ShaderMaterial({
      vertexShader: MOON_VERT, fragmentShader: MOON_FRAG,
      uniforms: { uT: { value: 0 }, uHor: { value: -0.60 } }, transparent: true, depthWrite: false,
    });
    st.moon = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), st.moonMat);
    st.moon.position.set(moonX(0), moonY(0), -2.5);
    st.moon.renderOrder = -5;
    ctx.scene3D.add(st.moon);

    // --- shared silhouette material ------------------------------------------
    st.lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 1 } },
      transparent: true,
    });

    // --- field set — barn roofline left, bare oak right, fence posts, combine,
    //     scarecrow, distant hedge clumps ------------------------------------
    {
      const p: number[] = [], c: number[] = [];
      const dark = [0.030, 0.028, 0.030];
      const dark2 = [0.040, 0.037, 0.038];

      // barn — low roofline + gable, far left on the horizon (kept inside the
      // frame at the end-drift waypoint)
      poly(p, c, [[-1.62, -0.52], [-1.62, -0.30], [-1.35, -0.14], [-1.05, -0.30], [-1.05, -0.52]], dark);
      poly(p, c, [[-1.68, -0.29], [-1.35, -0.10], [-0.97, -0.29], [-0.97, -0.33], [-1.35, -0.15], [-1.68, -0.33]], dark2);
      // tiny hayloft door square in the gable
      poly(p, c, [[-1.38, -0.30], [-1.30, -0.30], [-1.30, -0.38], [-1.38, -0.38]], [0.06, 0.05, 0.045]);

      // bare oak — leaning trunk + clawing branches
      ribbon(p, c, [[2.10, -0.55], [1.98, -0.20], [1.90, 0.15], [1.86, 0.45]], 0.10, 0.045, dark);
      ribbon(p, c, [[1.92, 0.05], [2.15, 0.35], [2.30, 0.55], [2.38, 0.72]], 0.045, 0.012, dark);
      ribbon(p, c, [[1.88, 0.28], [1.65, 0.52], [1.48, 0.68]], 0.035, 0.010, dark);
      ribbon(p, c, [[1.86, 0.42], [1.98, 0.66], [2.02, 0.85]], 0.030, 0.009, dark);
      ribbon(p, c, [[1.95, -0.10], [2.20, 0.05], [2.35, 0.12]], 0.030, 0.010, dark);

      // fence posts — marching from mid-frame down toward bottom-center
      for (let i = 0; i < 8; i++) {
        const u = i / 7;
        const x = mix(0.25, -0.30, u);
        const y = mix(-0.56, -1.10, u);
        const h = mix(0.055, 0.16, u);
        const w = mix(0.014, 0.030, u);
        const lean = (rng() - 0.5) * 0.10;
        poly(p, c, [[x - w, y], [x + w, y], [x + w + lean * h, y + h], [x - w + lean * h, y + h]], dark);
        // sagging wire between consecutive posts
        if (i < 7) {
          const u2 = (i + 1) / 7;
          const x2 = mix(0.25, -0.30, u2), y2 = mix(-0.56, -1.10, u2), h2 = mix(0.055, 0.16, u2);
          ribbon(p, c, [[x, y + h * 0.9], [(x + x2) / 2, (y + y2) / 2 + (h + h2) * 0.5 - 0.015], [x2, y2 + h2 * 0.9]], w * 0.5, w * 0.5, dark);
        }
      }

      // combine — blocky silhouette far on the horizon, cab on top
      poly(p, c, [[-0.82, -0.545], [-0.48, -0.545], [-0.48, -0.44], [-0.62, -0.44], [-0.66, -0.50], [-0.82, -0.50]], dark);
      poly(p, c, [[-0.70, -0.44], [-0.56, -0.44], [-0.58, -0.37], [-0.68, -0.37]], dark);   // cab
      poly(p, c, [[-0.48, -0.50], [-0.42, -0.50], [-0.42, -0.545], [-0.48, -0.545]], dark); // header

      // scarecrow at the fence line — post, crossbar, head, coat
      poly(p, c, [[0.90, -0.52], [0.93, -0.52], [0.93, -0.30], [0.90, -0.30]], dark);        // post
      poly(p, c, [[0.82, -0.40], [1.01, -0.40], [1.01, -0.375], [0.82, -0.375]], dark);      // arms
      poly(p, c, [[0.855, -0.375], [0.965, -0.375], [0.985, -0.30], [0.835, -0.30]], dark2); // coat
      poly(p, c, [[0.885, -0.29], [0.935, -0.29], [0.945, -0.24], [0.875, -0.24]], dark);    // head
      poly(p, c, [[0.87, -0.24], [0.95, -0.24], [0.955, -0.225], [0.865, -0.225]], dark);    // hat brim

      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const set0 = new THREE.Mesh(g, st.lifeMat);
      set0.frustumCulled = false;
      ctx.scene3D.add(set0);
    }

    // --- scarecrow sleeve — tattered flap stirring in the breeze --------------
    {
      const p: number[] = [], c: number[] = [];
      poly(p, c, [[0.0, 0.0], [0.075, -0.012], [0.070, -0.05], [0.02, -0.055], [-0.005, -0.03]], [0.045, 0.042, 0.042]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.sleeve = new THREE.Mesh(g, st.lifeMat);
      st.sleeve.position.set(1.005, -0.385, 0.01);
      st.sleeve.frustumCulled = false;
      ctx.scene3D.add(st.sleeve);
    }

    // --- hare — small bounding silhouette along a stubble row -----------------
    {
      st.hareMat = st.lifeMat.clone();
      st.hareMat.uniforms.uA!.value = 0;
      st.hare = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const hc = [0.05, 0.045, 0.045];
      poly(p, c, [[-0.055, 0.0], [0.045, 0.0], [0.055, 0.035], [-0.05, 0.045]], hc);         // body
      poly(p, c, [[0.03, 0.035], [0.07, 0.035], [0.075, 0.06], [0.04, 0.06]], hc);          // head
      ribbon(p, c, [[0.045, 0.055], [0.035, 0.10], [0.03, 0.12]], 0.012, 0.006, hc);        // ear
      ribbon(p, c, [[0.055, 0.055], [0.05, 0.10], [0.048, 0.115]], 0.010, 0.005, hc);       // ear
      poly(p, c, [[-0.05, 0.0], [-0.03, 0.0], [-0.045, -0.035], [-0.065, -0.035]], hc);     // hind leg
      poly(p, c, [[0.03, 0.0], [0.05, 0.0], [0.055, -0.03], [0.04, -0.03]], hc);            // fore leg
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.hareMat);
      m.frustumCulled = false;
      st.hare.add(m);
      st.hare.position.set(-0.6, -0.62, 0.02);
      ctx.scene3D.add(st.hare);
    }

    // --- crow flocks — two crossings of the moon's face -----------------------
    {
      const mkCrow = (mat: THREE.ShaderMaterial, seed: number) => {
        const p: number[] = [], c: number[] = [];
        const cc = [0.02, 0.02, 0.025];
        // convex pieces only — fan triangulation fills concave notches;
        // wing roots dip below the body top so nothing floats apart
        poly(p, c, [[-0.02, -0.004], [-0.115, 0.018], [-0.035, 0.032]], cc);  // left wing
        poly(p, c, [[0.02, -0.004], [0.035, 0.032], [0.115, 0.018]], cc);    // right wing
        poly(p, c, [[-0.030, -0.002], [0.030, -0.002], [0, -0.022]], cc);    // body
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
        const grp = new THREE.Group();
        const m = new THREE.Mesh(g, mat);
        m.frustumCulled = false;
        grp.add(m);
        grp.userData = { seed, off: (rng() - 0.5) * 0.42, lag: (rng() - 0.5) * 0.5, s: 0.8 + rng() * 0.5 };
        ctx.scene3D.add(grp);
        return grp;
      };
      st.crow1Mat = st.lifeMat.clone(); st.crow1Mat.uniforms.uA!.value = 0;
      st.crow2Mat = st.lifeMat.clone(); st.crow2Mat.uniforms.uA!.value = 0;
      st.crows1 = []; st.crows2 = [];
      for (let i = 0; i < 5; i++) st.crows1.push(mkCrow(st.crow1Mat, i * 7.1 + 1));
      for (let i = 0; i < 4; i++) st.crows2.push(mkCrow(st.crow2Mat, i * 9.3 + 2));
    }

    // --- combine cab light — small warm dot, pulses once ----------------------
    {
      const p: number[] = [], c: number[] = [];
      poly(p, c, [[-0.018, 0.018], [0.018, 0.018], [0.018, -0.018], [-0.018, -0.018]], [1.0, 0.72, 0.30]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.cabMat = st.lifeMat.clone(); st.cabMat.uniforms.uA!.value = 0.12;
      const m = new THREE.Mesh(g, st.cabMat);
      m.position.set(-0.63, -0.395, 0.02);
      m.frustumCulled = false;
      ctx.scene3D.add(m);
    }

    // --- house window — one warm glow on the far right horizon ----------------
    {
      const p: number[] = [], c: number[] = [];
      poly(p, c, [[-0.014, 0.012], [0.014, 0.012], [0.014, -0.012], [-0.014, -0.012]], [1.0, 0.62, 0.22]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.winMat = st.lifeMat.clone(); st.winMat.uniforms.uA!.value = 0;
      const m = new THREE.Mesh(g, st.winMat);
      m.position.set(2.30, -0.50, 0.02);
      m.frustumCulled = false;
      ctx.scene3D.add(m);
    }

    // --- fireflies — faint points low on the hedge behind the scarecrow -------
    {
      st.flyMat = st.lifeMat.clone(); st.flyMat.uniforms.uA!.value = 0;
      st.flies = [];
      for (let i = 0; i < 6; i++) {
        const p: number[] = [], c: number[] = [];
        const r = 0.008 + rng() * 0.006;
        poly(p, c, [[-r, r], [r, r], [r, -r], [-r, -r]], [0.85, 0.85, 0.35]);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
        g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
        const m = new THREE.Mesh(g, st.flyMat);
        m.position.set(0.75 + rng() * 0.65, -0.58 + rng() * 0.08, 0.03);
        m.userData = { x0: m.position.x, y0: m.position.y, ph: rng() * 6.28, sp: 0.6 + rng() * 0.7 };
        m.frustumCulled = false;
        ctx.scene3D.add(m);
        st.flies.push(m);
      }
    }
  },

  render: (ctx, f, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;
    st.back.uniforms.uT!.value = t;
    st.back.uniforms.uMoonX!.value = moonX(t);
    st.back.uniforms.uMoonY!.value = moonY(t);
    st.moonMat.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.hareMat.uniforms.uT!.value = t;
    st.crow1Mat.uniforms.uT!.value = t;
    st.crow2Mat.uniforms.uT!.value = t;
    st.cabMat.uniforms.uT!.value = t;
    st.winMat.uniforms.uT!.value = t;
    st.flyMat.uniforms.uT!.value = t;

    // moon — slow rise through the frame; horizon clip follows it in quad space
    st.moon.position.set(moonX(t), moonY(t), -2.5);
    st.moonMat.uniforms.uHor!.value = -0.50 - moonY(t);

    // hare — three bounding hops left→right along a stubble row, then gone
    {
      const u = clamp01((t - HARE.t0) / (HARE.t1 - HARE.t0));
      const inWin = t >= HARE.t0 && t <= HARE.t1;
      const x = mix(-0.6, 0.72, sCurve(u));
      const hop = 0.09 * Math.abs(Math.sin(u * Math.PI * 3.0)) * Math.sin(Math.PI * u);
      st.hare.position.set(x, -0.62 + hop, 0.02);
      st.hare.rotation.z = 0.35 * Math.cos(u * Math.PI * 6.0) * Math.sin(Math.PI * u);
      st.hareMat.uniforms.uA!.value = inWin ? 0.95 : 0;
    }

    // crows — each crosses the moon's live position, straggling in x and y
    const flyCrows = (grp: THREE.Group[], mat: THREE.ShaderMaterial, win: { t0: number; t1: number }) => {
      const dur = win.t1 - win.t0;
      for (let i = 0; i < grp.length; i++) {
        const g = grp[i]!;
        const ud = g.userData as { off: number; lag: number; s: number; seed: number };
        const u = clamp01((t - win.t0 - ud.lag * 0.5 - i * 0.22) / (dur - 0.4));
        const on = u > 0 && u < 1;
        const mx = moonX(t), my = moonY(t);
        const x = mx - MOON_R - 0.45 + (2 * MOON_R + 0.9) * u;
        const y = my + ud.off * 0.55 + 0.06 * Math.sin(t * 3.0 + ud.seed);
        g.position.set(x, y, 0.04);
        g.scale.set(ud.s, ud.s, 1);
        // wing-beat — scale.y squash on a flap cycle, banked slightly
        const m = g.children[0] as THREE.Mesh;
        m.scale.y = 0.55 + 0.45 * Math.abs(Math.sin(t * 7.0 + ud.seed * 2.0));
        g.rotation.z = 0.12 * Math.sin(t * 2.2 + ud.seed);
        m.visible = on;
      }
      const env = Math.min(sstep(win.t0 - 0.2, win.t0 + 0.6, t), 1 - sstep(win.t1 - 0.4, win.t1 + 0.4, t));
      mat.uniforms.uA!.value = 0.95 * Math.max(0, env);
    };
    flyCrows(st.crows1, st.crow1Mat, CROWS1);
    flyCrows(st.crows2, st.crow2Mat, CROWS2);

    // combine cab light — faint base glow + one bright pulse at CAB_T
    {
      const pulse = Math.exp(-(t - CAB_T) * (t - CAB_T) * 3.0);
      st.cabMat.uniforms.uA!.value = 0.10 + 0.75 * pulse;
    }

    // scarecrow sleeve — gentle stir, picks up in the breeze gusts
    st.sleeve.rotation.z = -0.15 + 0.45 * Math.sin(t * 1.7) * (0.5 + 0.5 * Math.sin(t * 0.37));

    // fireflies — drift + twinkle on the hedge behind the scarecrow
    {
      const env = sstep(FIREFLY_T, FIREFLY_T + 2.5, t);
      for (const fl of st.flies) {
        const ud = fl.userData as { x0: number; y0: number; ph: number; sp: number };
        fl.position.set(
          ud.x0 + 0.05 * Math.sin(t * 0.5 * ud.sp + ud.ph),
          ud.y0 + 0.03 * Math.sin(t * 0.8 * ud.sp + ud.ph * 2.0),
          0.03,
        );
      }
      st.flyMat.uniforms.uA!.value = env * (0.35 + 0.55 * Math.abs(Math.sin(t * 2.1)));
    }

    // house window — warms on at WINDOW_T, then holds with a tiny flicker
    st.winMat.uniforms.uA!.value = sstep(WINDOW_T, WINDOW_T + 1.5, t) * (0.75 + 0.10 * Math.sin(t * 5.0));

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

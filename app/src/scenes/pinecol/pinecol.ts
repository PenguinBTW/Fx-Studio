// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// pinecol — a colonnade of tall pines in a forest clearing. Three light
// shafts fall through the trunk gaps onto the floor; a red squirrel works a
// cone, a woodpecker drums, a jay crosses once. Flat silhouettes on the z=-2
// picture plane; forest darkness + light band a shader backdrop at z=-4.
// All motion f(t).
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
const SQ = { in: 4.2, pause: 5.4, dart: 6.2, work: 6.9, dash: 9.4, gone: 10.4 };
const WP = { in: 10.5, drums: [10.9, 11.7, 12.1, 12.9] as const, out: 13.5, gone: 14.0 };
const JAY = { t0: 15.0, t1: 16.2 };

// trunk positions — six pines, light gaps between them
const TRUNKS = [-1.55, -0.95, -0.30, 0.30, 0.95, 1.55];
const CONE = { x: 0.30, y: -0.80 };
const WORK_TRUNK_X = 0.95;

// shaft azimuth — three wedges drift slowly with the light angle
const shaftTilt = (t: number) => 0.38 + 0.035 * Math.sin(t * 0.22);
const shaftEnv = (t: number) => 0.85 + 0.15 * Math.sin(t * 0.31 + 1.7);

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
// backdrop — deep forest darkness above, pale light band behind the trunk
// gaps, needle-dark clearing floor below. Plane at z=-4 behind everything.
// ---------------------------------------------------------------------------
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
varying vec2 vUv;
// sine-free hash — stays stable in half-precision fragment math
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 q = (vUv - 0.5) * vec2(12.0, 7.0);
  float hor = -0.60;                           // clearing-floor line in backdrop coords

  // deep forest darkness — near-black green above, faint canopy green low
  vec3 sky = mix(vec3(0.016, 0.024, 0.020), vec3(0.005, 0.008, 0.006), smoothstep(-0.5, 3.4, q.y));

  // pale light band behind the colonnade — narrow, dim slots in the gaps
  float band = exp(-(q.y - 0.15) * (q.y - 0.15) * 2.6);
  vec3 light = vec3(0.10, 0.13, 0.09) * band;
  // gap slots: brighter between trunks, darker behind trunk silhouettes
  float slot = 0.45 + 0.55 * hash21(vec2(floor(q.x * 2.2), 7.0));
  sky += light * slot * smoothstep(-1.0, 0.2, q.y) * smoothstep(2.2, 1.0, q.y);

  // canopy speckle — sparse pale flecks high up where light leaks through
  vec2 cell = floor(q * vec2(11.0, 15.0));
  float h = hash21(cell);
  if (h > 0.975 && q.y > 1.4) {
    vec2 c = fract(q * vec2(11.0, 15.0)) - 0.5;
    float s = 1.0 - smoothstep(0.0, 0.10, length(c));
    float tw = 0.5 + 0.5 * sin(uT * (0.6 + h * 3.0) + h * 40.0);
    sky += vec3(0.55, 0.62, 0.45) * s * tw * 0.35;
  }
  vec3 col = sky;

  // clearing floor — dark needle-brown with a grassy lift toward the light
  float below = 1.0 - smoothstep(hor - 0.02, hor + 0.02, q.y);
  float depth = 1.0 - smoothstep(-3.4, hor - 0.02, q.y);
  vec3 floor0 = mix(vec3(0.055, 0.060, 0.038), vec3(0.020, 0.022, 0.016), depth);
  float tex = 0.5 + 0.5 * sin(q.x * 26.0 + q.y * 12.0 + sin(q.x * 6.0) * 2.0);
  floor0 += vec3(0.014, 0.016, 0.008) * tex * tex * (1.0 - depth);
  // light pools where the shafts land — three warm patches, breathing slowly
  float pool = exp(-(q.x + 0.85) * (q.x + 0.85) * 1.1)
             + exp(-(q.x - 0.05) * (q.x - 0.05) * 1.3) * 1.2
             + exp(-(q.x - 0.95) * (q.x - 0.95) * 1.1);
  float breathe = 0.75 + 0.25 * sin(uT * 0.31 + 1.7);
  floor0 += vec3(0.20, 0.22, 0.12) * pool * breathe * below;

  col = mix(col, floor0, below);
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

// shaft material — additive wedge: uv.y is distance along the shaft
const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SHAFT_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec2 vUv;
void main() {
  float len = smoothstep(0.05, 0.90, vUv.y);                // bright at the canopy, dying to the floor
  float edge = pow(1.0 - abs(2.0 * vUv.x - 1.0), 1.8);
  vec3 col = mix(vec3(0.45, 0.52, 0.38), vec3(0.85, 0.88, 0.62), vUv.y * 0.4 + 0.3);
  gl_FragColor = vec4(col, len * edge * uA);
}`;

// dust motes — hash-seeded points drifting inside each shaft volume
const MOTE_VERT = /* glsl */ `
uniform float uT;
attribute float seed;
varying float vA;
void main() {
  vec3 p = position;
  p.x += 0.05 * sin(uT * 0.5 + seed * 17.0) + 0.02 * sin(uT * 1.3 + seed * 31.0);
  p.y += mod(uT * (0.03 + seed * 0.05) + seed * 4.0, 2.2) - 1.1;
  vA = 0.25 + 0.75 * fract(seed * 7.31);
  gl_PointSize = 1.5 + 2.0 * fract(seed * 3.17);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const MOTE_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(0.85, 0.88, 0.65, (1.0 - d * 2.0) * vA * 0.5);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial;
  lifeMat: THREE.ShaderMaterial;
  shafts: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; x: number }[];
  motes: THREE.Points; moteMat: THREE.ShaderMaterial;
  squirrel: THREE.Group; sqMat: THREE.ShaderMaterial; sqTail: THREE.Mesh;
  cone: THREE.Mesh; coneMat: THREE.ShaderMaterial;
  wpk: THREE.Group; wpkMat: THREE.ShaderMaterial; wpkHead: THREE.Mesh;
  jay: THREE.Mesh; jayMat: THREE.ShaderMaterial;
  seedling: THREE.Mesh; seedMat: THREE.ShaderMaterial;
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "pinecol",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(4403);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — low, near-static; slight drift right+in so the trunk gaps
    // parallax and the clearing deepens toward the cone
    ctx.rig.setLensMm(56);
    ctx.rig.setPath([
      { t: 0.00, pos: [-0.40, 0.28, 4.85], target: [0.15, 0.05, -2.0] },
      { t: 0.50, pos: [-0.15, 0.26, 4.78], target: [0.28, 0.12, -2.0] },
      { t: 1.00, pos: [0.10, 0.24, 4.70], target: [0.38, 0.18, -2.0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 } },
      depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), st.back);
    back.position.z = -4; back.renderOrder = -10;
    ctx.scene3D.add(back);

    // --- shared silhouette material ------------------------------------------
    st.lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.6 }, uA: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false,
    });

    // --- colonnade — six trunks, pale gap strips behind, bark edge ticks -----
    {
      const p: number[] = [], c: number[] = [];
      const trunkC = [0.045, 0.035, 0.028];
      const barkC = [0.020, 0.016, 0.012];
      const gapC = [0.045, 0.055, 0.040]; // dim slot between trunks (backdrop carries the glow)

      // understorey blobs first — paint order puts them behind the slots
      for (let i = 0; i < 8; i++) {
        const x = -2.6 + rng() * 5.2, w = 0.25 + rng() * 0.30, h = 0.18 + rng() * 0.22;
        poly(p, c, [[x - w, -0.62], [x + w, -0.62], [x + w * 0.4, -0.62 + h], [x - w * 0.4, -0.62 + h]], [0.018, 0.024, 0.016]);
      }
      // gap strips (they draw over the shrubs, under the trunks)
      for (let i = 0; i < TRUNKS.length - 1; i++) {
        const gx = (TRUNKS[i] + TRUNKS[i + 1]) / 2 + (rng() - 0.5) * 0.10;
        poly(p, c, [[gx - 0.12, -1.15], [gx + 0.12, -1.15], [gx + 0.10, 1.60], [gx - 0.10, 1.60]], gapC);
      }
      // trunks — slight lean variety, widest at the base
      for (let i = 0; i < TRUNKS.length; i++) {
        const x = TRUNKS[i], lean = (rng() - 0.5) * 0.10, w = 0.11 + rng() * 0.05;
        ribbon(p, c, [[x, -1.15], [x + lean, 1.60]], w, w * 0.62, trunkC);
        // bark edge ticks — thin darker strips on one side
        const side = rng() > 0.5 ? 1 : -1;
        ribbon(p, c, [[x + side * w * 0.34, -1.15], [x + lean + side * w * 0.22, 1.60]], w * 0.16, w * 0.10, barkC);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, st.lifeMat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // --- floor props — cones, mushroom cluster, seedling ---------------------
    {
      const p: number[] = [], c: number[] = [];
      const coneC = [0.060, 0.048, 0.032];
      // scattered cones on the floor
      for (const [cx, cy, s] of [[-0.72, -0.86, 0.035], [0.30, -0.80, 0.045], [-0.18, -0.92, 0.030], [0.68, -0.88, 0.028]] as const) {
        poly(p, c, [[cx - s, cy], [cx + s, cy], [cx + s * 0.6, cy + s * 1.6], [cx - s * 0.6, cy + s * 1.6]], coneC);
      }
      // mushroom cluster at the x=0.95 trunk base — three tiny domes
      for (const [mx, s] of [[1.02, 0.030], [1.07, 0.022], [0.98, 0.018]] as const) {
        const my = -0.94;
        for (let k = 0; k < 5; k++) {
          const a0 = (Math.PI * k) / 5, a1 = (Math.PI * (k + 1)) / 5;
          posFan(p, c, mx, my, s, a0, a1, [0.085, 0.070, 0.048]);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const mesh = new THREE.Mesh(geo, st.lifeMat);
      mesh.frustumCulled = false;
      ctx.scene3D.add(mesh);
    }

    // the seedling — one bright green spike catching the light, lifts a little
    // as the shafts drift over it
    {
      const mat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 1.4 }, uA: { value: 1 } },
        transparent: true,
      });
      const p: number[] = [], c: number[] = [];
      const sx = 0.05, sy = -0.88;
      ribbon(p, c, [[sx, sy], [sx + 0.01, sy + 0.10], [sx - 0.005, sy + 0.16]], 0.020, 0.006, [0.16, 0.30, 0.12]);
      ribbon(p, c, [[sx, sy + 0.05], [sx - 0.04, sy + 0.10]], 0.014, 0.003, [0.14, 0.27, 0.11]);
      ribbon(p, c, [[sx + 0.005, sy + 0.07], [sx + 0.045, sy + 0.12]], 0.014, 0.003, [0.14, 0.27, 0.11]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.seedling = new THREE.Mesh(geo, mat);
      st.seedling.frustumCulled = false;
      st.seedMat = mat;
      ctx.scene3D.add(st.seedling);
    }

    // --- light shafts — three additive wedges through the gaps ---------------
    st.shafts = [];
    for (const [sx, wTop, wBot] of [[-1.25, 0.22, 0.55], [-0.05, 0.26, 0.70], [1.20, 0.20, 0.52]] as const) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        uniforms: { uA: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const geo = new THREE.PlaneGeometry(1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      // wedge: quad scaled — top narrow at the canopy gap, widening to the floor
      // (keep PlaneGeometry's vertex order so the winding stays front-facing)
      const vtx = geo.attributes.position!;
      vtx.setXY(0, -wTop, 1.60); vtx.setXY(1, wTop, 1.60);     // top edge
      vtx.setXY(2, -wBot, -1.30); vtx.setXY(3, wBot, -1.30);   // bottom edge
      geo.computeVertexNormals();
      mesh.position.set(sx + 0.15, 0.15, -2.5);
      mesh.frustumCulled = false;
      st.shafts.push({ mesh, mat, x: sx });
      ctx.scene3D.add(mesh);
    }

    // --- dust motes — drifting points seeded inside each shaft ---------------
    {
      const n = 70;
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      const anchors = [-1.10, -0.10, 1.05];
      for (let i = 0; i < n; i++) {
        const ax = anchors[i % anchors.length];
        pos[i * 3] = ax + (rng() - 0.5) * 0.9;
        pos[i * 3 + 1] = -1.0 + rng() * 2.2;
        pos[i * 3 + 2] = -2.3;
        seed[i] = rng();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
      st.moteMat = new THREE.ShaderMaterial({
        vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
        uniforms: { uT: { value: 0 } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      st.motes = new THREE.Points(geo, st.moteMat);
      st.motes.frustumCulled = false;
      ctx.scene3D.add(st.motes);
    }

    // --- the cone the squirrel works (rides with it during the work beat) ----
    {
      st.coneMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 0.9 } },
        transparent: true,
      });
      const p: number[] = [], c: number[] = [];
      poly(p, c, [[-0.045, 0], [0.045, 0], [0.028, 0.075], [-0.028, 0.075]], [0.070, 0.055, 0.035]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.cone = new THREE.Mesh(geo, st.coneMat);
      st.cone.position.set(CONE.x, CONE.y, 0.02);
      st.cone.frustumCulled = false;
      ctx.scene3D.add(st.cone);
    }

    // --- squirrel — body blob + separate tail (pivot at its base) ------------
    {
      st.sqMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 1.0 }, uA: { value: 0 } },
        transparent: true,
      });
      st.squirrel = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const sqC = [0.150, 0.065, 0.025];   // warm red — reads against the umber trunks
      // plump body: haunches, back, head facing left toward the cone
      poly(p, c, [[-0.02, 0.00], [0.11, 0.00], [0.13, 0.06], [0.08, 0.10], [0.00, 0.10], [-0.05, 0.06]], sqC);
      poly(p, c, [[-0.05, 0.05], [0.02, 0.05], [-0.01, 0.16], [-0.09, 0.16]], sqC);           // head
      poly(p, c, [[-0.085, 0.15], [-0.045, 0.15], [-0.065, 0.19]], sqC);                     // ear
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, st.sqMat);
      body.frustumCulled = false;
      st.squirrel.add(body);

      // tail — separate mesh so only it rotates for the busy flicks
      const tp: number[] = [], tc: number[] = [];
      ribbon(tp, tc, [[0, 0], [0.10, 0.10], [0.14, 0.20], [0.10, 0.26]], 0.055, 0.030, sqC);
      const tgeo = new THREE.BufferGeometry();
      tgeo.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
      tgeo.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
      st.sqTail = new THREE.Mesh(tgeo, st.sqMat);
      st.sqTail.position.set(0.10, 0.04, -0.001);
      st.sqTail.frustumCulled = false;
      st.squirrel.add(st.sqTail);

      st.squirrel.position.set(2.2, -0.82, 0.05);
      ctx.scene3D.add(st.squirrel);
    }

    // --- woodpecker — body + separate head for the drumming bursts -----------
    {
      st.wpkMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.4 }, uA: { value: 0 } },
        transparent: true,
      });
      st.wpk = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const wpC = [0.035, 0.030, 0.028];
      // clinging body on the trunk's right edge — head pivots for the pecks
      poly(p, c, [[0.00, 0.00], [0.06, 0.00], [0.05, 0.16], [0.01, 0.16]], wpC);              // body
      poly(p, c, [[0.01, 0.14], [0.05, 0.14], [0.045, 0.20], [0.015, 0.20]], wpC);           // head (drawn over)
      poly(p, c, [[0.045, 0.185], [0.085, 0.175], [0.045, 0.165]], wpC);                     // beak
      poly(p, c, [[0.015, 0.19], [0.045, 0.19], [0.03, 0.215]], [0.14, 0.03, 0.02]);         // red crown
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.wpkHead = new THREE.Mesh(geo, st.wpkMat);
      st.wpkHead.frustumCulled = false;
      st.wpk.add(st.wpkHead);
      st.wpk.position.set(WORK_TRUNK_X + 0.06, 0.15, 0.06);
      ctx.scene3D.add(st.wpk);
    }

    // --- jay — one fast slate-blue silhouette across the colonnade -----------
    {
      st.jayMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 0 } },
        transparent: true,
      });
      const p: number[] = [], c: number[] = [];
      const jC = [0.06, 0.08, 0.16];   // dim slate-blue against the dark
      poly(p, c, [[-0.09, 0.00], [0.03, -0.015], [0.09, 0.00], [0.03, 0.030], [-0.03, 0.035]], jC);  // swept wings+body
      poly(p, c, [[0.07, 0.005], [0.13, 0.02], [0.07, 0.03]], jC);                                  // crest hint
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.jay = new THREE.Mesh(geo, st.jayMat);
      st.jay.frustumCulled = false;
      ctx.scene3D.add(st.jay);
    }
  },

  render: (ctx: SceneContext, f: { t: number }, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;

    st.back.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.moteMat.uniforms.uT!.value = t;
    st.seedMat.uniforms.uT!.value = t;

    // --- shafts — slow tilt drift + gentle breath ----------------------------
    const tilt = shaftTilt(t), env = shaftEnv(t);
    for (const s of st.shafts) {
      s.mesh.rotation.z = tilt;
      s.mat.uniforms.uA!.value = env;
    }

    // seedling lifts when the centre shaft is over it
    st.seedMat.uniforms.uA!.value = 0.75 + 0.25 * env;

    // --- squirrel -------------------------------------------------------------
    {
      let sx = 2.2, sy = -0.82, bob = 0, a = 0;
      if (t >= SQ.in && t < SQ.pause) {                    // bounds in from the right
        const u = sCurve((t - SQ.in) / (SQ.pause - SQ.in));
        sx = mix(2.2, 0.75, u); sy = -0.82;
        bob = 0.10 * Math.abs(Math.sin(u * Math.PI * 3));
        a = 0.9;
      } else if (t < SQ.dart) {                          // pause at the light edge
        sx = 0.75; bob = 0.008 * Math.sin(t * 10.0); a = 0.9;
      } else if (t < SQ.work) {                          // dart to the cone
        const u = sCurve((t - SQ.dart) / (SQ.work - SQ.dart));
        sx = mix(0.75, CONE.x + 0.16, u); bob = 0.04 * Math.abs(Math.sin(u * Math.PI * 2));
        a = 0.9;
      } else if (t < SQ.dash) {                          // sits + works the cone
        sx = CONE.x + 0.16; bob = 0.012 * Math.sin(t * 8.0); a = 0.9;
      } else if (t < SQ.gone) {                          // dashes to the trunk, scrambles up
        const u = (t - SQ.dash) / (SQ.gone - SQ.dash);
        const ux = sCurve(clamp01(u / 0.45)), uy = sCurve(clamp01((u - 0.45) / 0.55));
        sx = mix(CONE.x + 0.16, WORK_TRUNK_X + 0.10, ux);
        sy = -0.82 + uy * 2.1;
        a = 0.9 * (1 - sCurve(clamp01((u - 0.82) / 0.18)));
      }
      st.squirrel.position.set(sx, sy + bob, 0.05);
      st.sqMat.uniforms.uA!.value = a;
      // busy tail-flicks during the work beat; gentle sway otherwise
      const workU = clamp01((t - SQ.work) / (SQ.dash - SQ.work));
      const flick = workU > 0 && workU < 1
        ? 0.45 * Math.sin(t * 9.0) * sstep(0.15, 0.4, (t * 1.7) % 1)
        : 0.08 * Math.sin(t * 3.0);
      st.sqTail.rotation.z = 0.15 + flick;
      // cone rotates slightly while being worked
      const workEnv = sstep(SQ.work, SQ.work + 0.3, t) * (1 - sstep(SQ.dash - 0.2, SQ.dash, t));
      st.cone.rotation.z = workEnv * 0.25 * Math.sin(t * 5.0);
    }

    // --- woodpecker — clings, drums in bursts, flies off ----------------------
    {
      let a = 0;
      const climb = sCurve(clamp01((t - WP.in) / (WP.out - WP.in)));
      if (t >= WP.in && t < WP.gone) {
        a = sstep(WP.in, WP.in + 0.2, t);
        if (t >= WP.out) {
          const u = clamp01((t - WP.out) / (WP.gone - WP.out));
          const x = mix(WORK_TRUNK_X + 0.06, 2.6, sCurve(u));
          const y = 0.15 + climb * 0.22 + u * 0.8;
          st.wpk.position.set(x, y, 0.06);
          st.wpkHead.rotation.z = 0;
          a = 0.9 * (1 - sCurve(clamp01((u - 0.7) / 0.3)));
        } else {
          st.wpk.position.set(WORK_TRUNK_X + 0.06, 0.15 + climb * 0.22, 0.06);
          // drumming bursts — rapid head rotation inside each window
          let drum = 0;
          for (let i = 0; i < WP.drums.length; i += 2) {
            drum += sstep(WP.drums[i], WP.drums[i] + 0.08, t) * (1 - sstep(WP.drums[i + 1] - 0.08, WP.drums[i + 1], t));
          }
          st.wpkHead.rotation.z = 0.10 * Math.sin(t * 55.0) * clamp01(drum);
        }
      }
      st.wpkMat.uniforms.uA!.value = a;
    }

    // --- jay — one crossing, slight dip mid-frame ----------------------------
    {
      const u = clamp01((t - JAY.t0) / (JAY.t1 - JAY.t0));
      const on = u > 0 && u < 1;
      const x = mix(-2.3, 2.4, u);
      const y = 0.55 + 0.06 * Math.sin(u * 9.0) - 0.12 * Math.sin(Math.PI * u);
      st.jay.position.set(x, y, 0.07);
      st.jayMat.uniforms.uA!.value = on ? 0.85 : 0;
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

// small fan helper — triangle wedges for the mushroom domes
function posFan(pos: number[], col: number[], cx: number, cy: number, r: number, a0: number, a1: number, c: number[]) {
  pos.push(cx, cy, -2.0, cx + r * Math.cos(a0), cy + r * Math.sin(a0), -2.0, cx + r * Math.cos(a1), cy + r * Math.sin(a1), -2.0);
  for (let k = 0; k < 3; k++) col.push(...c);
}

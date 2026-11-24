// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// marshlight — a lighthouse on a marsh creek at deep twilight. One beam sweeps
// the marsh every ~6s; creek glints and grass tips gate on the beam's live
// azimuth. Flat silhouettes on the z=-2 picture plane; sky/dunes/stars a
// shader backdrop at z=-4. All motion f(t).
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
const CURLEW = { t0: 9.0, t1: 13.0 };
const PROBE_T = 11.3;
const SEED_T = 12.2;
const BAT = { t0: 15.8, t1: 16.8 };
const RABBIT = { t0: 18.0, t1: 20.5 };

// the lamp room — beam pivot; everything gates on this point's azimuth
const LAMP = { x: 1.32, y: 0.52 };

// beam azimuth — one left-to-right pass across the marsh every 6 s
const BEAM_PERIOD = 6.0;
const beamSweep = (t: number) => {
  const u = (t % BEAM_PERIOD) / BEAM_PERIOD;
  // dwells at the edges: slow-fast-slow pass, then a dark gap while it swings back
  const pass = sCurve(clamp01(u / 0.72));
  return mix(-2.86, -0.80, pass);
};
const beamEnv = (t: number) => {
  const u = (t % BEAM_PERIOD) / BEAM_PERIOD;
  // ramps up through the pass, fades during the backswing
  return Math.pow(Math.sin(Math.PI * clamp01(u / 0.80)), 0.8);
};
// signed wrapped angle difference
const wrapAng = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
// how strongly a point at (x,y) is being swept right now
const beamHit = (t: number, x: number, y: number) => {
  const az = Math.atan2(y - LAMP.y, x - LAMP.x);
  const d = wrapAng(beamSweep(t) - az);
  return Math.exp(-d * d * 90) * beamEnv(t);
};

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
// backdrop — deep-dusk sky, faint western remnant, dune line, seeded first
// stars, and the dark marsh floor. Plane at z=-4 behind everything.
// ---------------------------------------------------------------------------
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
uniform float uBeamX;   // beam azimuth → faint sky glow follows the sweep
uniform float uBeamA;
varying vec2 vUv;
// sine-free hash — stays stable in half-precision fragment math
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 q = (vUv - 0.5) * vec2(12.0, 7.0);
  float hor = -0.55;                          // horizon line in backdrop coords

  // deep-dusk sky — indigo overhead, steel-blue toward the rim
  vec3 sky = mix(vec3(0.075, 0.10, 0.20), vec3(0.020, 0.028, 0.075), smoothstep(-0.5, 3.4, q.y));
  // faint amber remnant low on the west side — the sun just went
  float rem = (1.0 - smoothstep(0.0, 0.9, q.y - hor)) * exp(-(q.x + 3.4) * (q.x + 3.4) * 0.30);
  sky += vec3(0.40, 0.18, 0.06) * rem;

  // first stars — seeded hash grid, each twinkles in with its own phase
  vec2 cell = floor(q * vec2(9.0, 14.0));
  float h = hash21(cell);
  if (h > 0.965 && q.y > hor + 0.55) {
    vec2 c = fract(q * vec2(9.0, 14.0)) - 0.5;
    float s = 1.0 - smoothstep(0.0, 0.09, length(c));
    float tw = 0.5 + 0.5 * sin(uT * (1.2 + h * 8.0) + h * 40.0);
    sky += vec3(0.85, 0.88, 1.0) * s * tw * 0.5 * smoothstep(hor + 0.55, hor + 1.4, q.y);
  }
  // faint sweep glow in the sky when the beam tilts up past the horizon
  float bg = exp(-(q.x - uBeamX) * (q.x - uBeamX) * 0.10);
  sky += vec3(0.18, 0.20, 0.22) * bg * uBeamA * smoothstep(hor, hor + 0.8, q.y);
  vec3 col = sky;

  // dune line — low rolling silhouette on the horizon
  float dune = 1.0 - smoothstep(hor - 0.10, hor + 0.02, q.y + 0.07 * sin(q.x * 1.7) + 0.04 * sin(q.x * 4.3 + 1.0));
  vec3 duneCol = vec3(0.028, 0.034, 0.045);

  // marsh floor — dark olive-slate, subtle grass texture
  float below = 1.0 - smoothstep(hor - 0.02, hor + 0.02, q.y);
  float depth = 1.0 - smoothstep(-3.4, hor - 0.02, q.y);
  vec3 marsh = mix(vec3(0.048, 0.052, 0.048), vec3(0.024, 0.026, 0.028), depth);
  float tex = 0.5 + 0.5 * sin(q.x * 21.0 + q.y * 9.0 + sin(q.x * 5.0) * 2.0);
  marsh += vec3(0.012, 0.014, 0.010) * tex * tex * (1.0 - depth);
  // wet sheen near the channels — faint cool lift lower in the frame
  marsh += vec3(0.010, 0.014, 0.022) * depth * 0.5;

  col = mix(col, duneCol, dune * (1.0 - below));
  col = mix(col, marsh, below);
  // the dune band fades out just below the horizon, not the whole marsh
  float duneBelow = dune * smoothstep(hor - 0.40, hor - 0.10, q.y);
  col = mix(col, duneCol, duneBelow * below * 0.9);
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

// beam material — additive wedge: uv.x is distance along the shaft
const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec2 vUv;
void main() {
  float len = 1.0 - smoothstep(0.15, 0.98, vUv.x);          // dies with distance
  float edge = pow(1.0 - abs(2.0 * vUv.y - 1.0), 1.6);      // soft cross-section
  vec3 col = mix(vec3(0.55, 0.60, 0.68), vec3(0.95, 0.92, 0.80), vUv.y * 0.4 + 0.3);
  gl_FragColor = vec4(col, len * edge * uA);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial;
  lifeMat: THREE.ShaderMaterial;
  beam: THREE.Mesh; beamMat: THREE.ShaderMaterial;
  beam2: THREE.Mesh; beam2Mat: THREE.ShaderMaterial;
  lampMat: THREE.ShaderMaterial;
  glints: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; x: number; y: number }[];
  grassTips: { mat: THREE.ShaderMaterial; x: number; y: number }[];
  clumps: THREE.Group[];
  blade: THREE.Mesh;
  shimmerMat: THREE.ShaderMaterial;
  curlew: THREE.Group; curlewMat: THREE.ShaderMaterial; curlewBill: THREE.Mesh;
  bat: THREE.Group; batMat: THREE.ShaderMaterial;
  rabbit: THREE.Group; rabbitMat: THREE.ShaderMaterial;
  seed: THREE.Mesh; seedMat: THREE.ShaderMaterial;
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "marshlight",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(9317);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — very low, near-static; slight drift toward the lighthouse so
    // the grass curtain parallaxes over the marsh
    ctx.rig.setLensMm(56);
    ctx.rig.setPath([
      { t: 0.00, pos: [-0.25, 0.30, 4.70], target: [0.25, 0.15, -2.0] },
      { t: 0.50, pos: [-0.10, 0.28, 4.65], target: [0.40, 0.22, -2.0] },
      { t: 1.00, pos: [0.05, 0.26, 4.60], target: [0.52, 0.30, -2.0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 }, uBeamX: { value: -2.0 }, uBeamA: { value: 0 } },
      depthWrite: false,
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

    // --- marsh set — lighthouse on its rise, dunes break, creek channels ------
    {
      const p: number[] = [], c: number[] = [];
      const dark = [0.030, 0.030, 0.034];
      const dark2 = [0.040, 0.040, 0.045];
      const towerC = [0.42, 0.46, 0.55];   // dusk-lit white — reads as the pale tower

      // the rise the lighthouse stands on — low knoll right-of-center
      poly(p, c, [[0.85, -0.55], [2.05, -0.55], [1.80, -0.28], [1.05, -0.28]], dark);
      // tapered tower — widest at the plinth
      poly(p, c, [[1.16, -0.28], [1.48, -0.28], [1.42, 0.38], [1.22, 0.38]], towerC);
      // gallery deck + lamp room + dome
      poly(p, c, [[1.18, 0.38], [1.46, 0.38], [1.44, 0.43], [1.20, 0.43]], dark);
      poly(p, c, [[1.22, 0.43], [1.42, 0.43], [1.40, 0.55], [1.24, 0.55]], dark2);
      poly(p, c, [[1.26, 0.55], [1.38, 0.55], [1.34, 0.60]], dark);
      // two window slits on the shaft
      poly(p, c, [[1.30, 0.10], [1.34, 0.10], [1.34, 0.15], [1.30, 0.15]], dark);
      poly(p, c, [[1.31, -0.08], [1.35, -0.08], [1.35, -0.03], [1.31, -0.03]], dark);
      // keeper's cottage block at the base
      poly(p, c, [[1.50, -0.38], [1.78, -0.38], [1.78, -0.20], [1.50, -0.20]], dark2);
      poly(p, c, [[1.48, -0.20], [1.80, -0.20], [1.64, -0.10]], dark);
      // far-left dune break — grass-topped bump
      poly(p, c, [[-2.60, -0.55], [-1.95, -0.55], [-2.10, -0.44], [-2.48, -0.44]], dark2);

      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const set0 = new THREE.Mesh(g, st.lifeMat);
      set0.frustumCulled = false;
      ctx.scene3D.add(set0);
    }

    // --- creek channels — dark water ribbons + a glint ribbon per channel ----
    //     each glint gates on the beam azimuth at its mid-point
    const CHANNELS: { pts: number[][]; w: number; glint: number[][] }[] = [
      { // far channel — meanders from left edge toward the lighthouse
        pts: [[-3.0, -0.52], [-2.2, -0.50], [-1.5, -0.53], [-0.7, -0.50], [0.1, -0.52], [0.9, -0.50]],
        w: 0.045, glint: [[-2.6, -0.51], [-1.5, -0.515], [-0.4, -0.51], [0.7, -0.505]],
      },
      { // centre channel — the one with the always-on run-off shimmer
        pts: [[-2.4, -0.62], [-1.6, -0.66], [-0.8, -0.62], [0.0, -0.68], [0.8, -0.63], [1.7, -0.66], [2.6, -0.62]],
        w: 0.07, glint: [[-2.2, -0.64], [-1.0, -0.65], [0.2, -0.66], [1.4, -0.64], [2.4, -0.63]],
      },
      { // near channel — big slow curve the curlew walks
        pts: [[-3.2, -0.85], [-2.4, -0.80], [-1.6, -0.86], [-0.7, -0.80], [0.2, -0.86], [1.0, -0.80]],
        w: 0.10, glint: [[-2.8, -0.83], [-1.8, -0.84], [-0.8, -0.82], [0.3, -0.84]],
      },
    ];
    st.glints = [];
    {
      const p: number[] = [], c: number[] = [];
      for (const ch of CHANNELS) ribbon(p, c, ch.pts, ch.w, ch.w * 0.7, [0.020, 0.030, 0.042]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.lifeMat);
      m.frustumCulled = false;
      ctx.scene3D.add(m);

      for (const ch of CHANNELS) {
        const gp: number[] = [], gc: number[] = [];
        // dashed glint — the beam strikes sparkles off the wet channel, not a
        // solid bar: each segment is drawn only through its middle 60%
        for (let i = 0; i < ch.glint.length - 1; i++) {
          const a = ch.glint[i]!, b = ch.glint[i + 1]!;
          ribbon(gp, gc,
            [[mix(a[0], b[0], 0.2), mix(a[1], b[1], 0.2)],
             [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
             [mix(a[0], b[0], 0.8), mix(a[1], b[1], 0.8)]],
            ch.w * 0.5, ch.w * 0.35, [0.75, 0.78, 0.70]);
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3));
        gg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gc), 3));
        const mat = st.lifeMat.clone(); mat.uniforms.uA!.value = 0;
        const gm = new THREE.Mesh(gg, mat);
        gm.position.z = 0.02;
        gm.frustumCulled = false;
        ctx.scene3D.add(gm);
        const mid = ch.glint[Math.floor(ch.glint.length / 2)]!;
        st.glints.push({ mesh: gm, mat, x: mid[0], y: mid[1] });
      }
    }

    // --- run-off shimmer — short dashes down the centre channel, always on ---
    {
      st.shimmerMat = st.lifeMat.clone(); st.shimmerMat.uniforms.uA!.value = 0.14;
      const p: number[] = [], c: number[] = [];
      for (let i = 0; i < 9; i++) {
        const u = i / 8;
        const x = mix(-2.0, 2.3, u) + (rng() - 0.5) * 0.1;
        const y = mix(-0.635, -0.645, u) + Math.sin(u * 9.0) * 0.012;
        ribbon(p, c, [[x - 0.07, y + 0.004], [x + 0.07, y - 0.004]], 0.006, 0.006, [0.30, 0.36, 0.40]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.shimmerMat);
      m.position.z = 0.025;
      m.frustumCulled = false;
      ctx.scene3D.add(m);
    }

    // --- marram grass — 5 clumps of thin blades, each with a lit-tips overlay
    //     that only shows when the beam sweeps past that bearing -------------
    st.clumps = []; st.grassTips = [];
    const CLUMP_X = [-2.35, -1.55, -0.35, 0.75, 1.85];
    for (let ci = 0; ci < CLUMP_X.length; ci++) {
      const cx = CLUMP_X[ci]!;
      const grp = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const blades = 6 + Math.floor(rng() * 3);
      for (let i = 0; i < blades; i++) {
        const bx = (rng() - 0.5) * 0.30;
        const h = 0.28 + rng() * 0.26;
        const lean = (rng() - 0.5) * 0.22;
        const shade = 0.55 + rng() * 0.45;
        ribbon(p, c, [[bx, 0], [bx + lean * 0.4, h * 0.55], [bx + lean, h]], 0.014, 0.004,
          [0.035 * shade, 0.045 * shade, 0.032 * shade]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.lifeMat);
      m.frustumCulled = false;
      grp.add(m);
      grp.position.set(cx, -0.78 - rng() * 0.10, 0.05 + ci * 0.008);
      grp.userData = { ph: rng() * 6.28, amp: 0.05 + rng() * 0.05 };
      ctx.scene3D.add(grp);
      st.clumps.push(grp);

      // lit tips — same blade tops redrawn warm, gated on the beam
      const tp: number[] = [], tc: number[] = [];
      for (let i = 0; i < blades; i++) {
        const bx = cx + (Math.sin(i * 3.7 + ci) * 0.15);
        const h = 0.20 + (i % 3) * 0.08;
        ribbon(tp, tc, [[cx + bx * 0.9, grp.position.y + h * 0.62], [cx + bx, grp.position.y + h]], 0.012, 0.004,
          [0.55, 0.50, 0.30]);
      }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tp), 3));
      tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tc), 3));
      const tmat = st.lifeMat.clone(); tmat.uniforms.uA!.value = 0;
      const tm = new THREE.Mesh(tg, tmat);
      tm.position.z = 0.06;
      tm.frustumCulled = false;
      ctx.scene3D.add(tm);
      st.grassTips.push({ mat: tmat, x: cx, y: grp.position.y + 0.25 });
    }

    // --- the one close blade — bigger, sways wide on gusts --------------------
    {
      const p: number[] = [], c: number[] = [];
      ribbon(p, c, [[0, 0], [0.10, 0.5], [0.26, 0.95]], 0.030, 0.006, [0.05, 0.06, 0.045]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.blade = new THREE.Mesh(g, st.lifeMat);
      st.blade.position.set(-2.05, -1.10, 0.12);
      st.blade.frustumCulled = false;
      ctx.scene3D.add(st.blade);
    }

    // --- the beam — additive wedge pivoting on the lamp; faint counter-beam ---
    {
      const mk = () => {
        const geo = new THREE.PlaneGeometry(3.8, 0.9);
        geo.translate(1.9, 0, 0);   // left edge at the pivot
        return geo;
      };
      st.beamMat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
        uniforms: { uA: { value: 0 } }, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      st.beam = new THREE.Mesh(mk(), st.beamMat);
      st.beam.position.set(LAMP.x, LAMP.y, -2.4);
      st.beam.frustumCulled = false;
      ctx.scene3D.add(st.beam);
      st.beam2Mat = st.beamMat.clone();
      const geo2 = mk(); geo2.scale(0.62, 0.55, 1);   // fainter, shorter back beam
      st.beam2 = new THREE.Mesh(geo2, st.beam2Mat);
      st.beam2.position.set(LAMP.x, LAMP.y, -2.4);
      st.beam2.frustumCulled = false;
      ctx.scene3D.add(st.beam2);
    }

    // --- lamp glow — warm halo on the lamp room, swells as the beam passes ----
    {
      const p: number[] = [], c: number[] = [];
      // octagon so the glow reads round, not a hard square
      const oct: number[][] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        oct.push([Math.cos(a) * 0.075, Math.sin(a) * 0.075]);
      }
      poly(p, c, oct, [1.0, 0.85, 0.45]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.lampMat = st.lifeMat.clone(); st.lampMat.uniforms.uA!.value = 0.35;
      const m = new THREE.Mesh(g, st.lampMat);
      m.position.set(LAMP.x, LAMP.y + 0.02, 0.03);
      m.frustumCulled = false;
      ctx.scene3D.add(m);
    }

    // --- curlew — wading silhouette on the near channel -----------------------
    {
      st.curlewMat = st.lifeMat.clone(); st.curlewMat.uniforms.uA!.value = 0;
      st.curlew = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const cc = [0.022, 0.022, 0.026];
      poly(p, c, [[-0.075, 0.0], [0.05, 0.0], [0.075, 0.035], [0.05, 0.055], [-0.06, 0.05], [-0.09, 0.02]], cc); // body
      ribbon(p, c, [[0.05, 0.045], [0.075, 0.09], [0.085, 0.11]], 0.020, 0.014, cc);                          // neck
      poly(p, c, [[0.075, 0.095], [0.105, 0.095], [0.108, 0.115], [0.078, 0.115]], cc);                        // head
      // decurved bill — curves down from the head
      ribbon(p, c, [[0.105, 0.102], [0.150, 0.085], [0.175, 0.055]], 0.006, 0.002, cc);
      ribbon(p, c, [[-0.03, 0.0], [-0.032, -0.075]], 0.010, 0.004, cc);                                        // legs
      ribbon(p, c, [[0.025, 0.0], [0.022, -0.075]], 0.010, 0.004, cc);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.curlewBill = new THREE.Mesh(g, st.curlewMat);
      st.curlewBill.frustumCulled = false;
      st.curlew.add(st.curlewBill);
      st.curlew.position.set(-1.7, -0.72, 0.06);
      ctx.scene3D.add(st.curlew);
    }

    // --- bat — one flicker past the lamp head ---------------------------------
    {
      st.batMat = st.lifeMat.clone(); st.batMat.uniforms.uA!.value = 0;
      st.bat = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const cc = [0.016, 0.016, 0.02];
      poly(p, c, [[-0.02, -0.004], [-0.09, 0.02], [-0.03, 0.03]], cc);
      poly(p, c, [[0.02, -0.004], [0.03, 0.03], [0.09, 0.02]], cc);
      poly(p, c, [[-0.022, 0.0], [0.022, 0.0], [0, -0.022]], cc);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.batMat);
      m.frustumCulled = false;
      st.bat.add(m);
      ctx.scene3D.add(st.bat);
    }

    // --- rabbit — small hops between the foreground clumps ---------------------
    {
      st.rabbitMat = st.lifeMat.clone(); st.rabbitMat.uniforms.uA!.value = 0;
      st.rabbit = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const cc = [0.030, 0.030, 0.032];
      poly(p, c, [[-0.05, 0.0], [0.04, 0.0], [0.05, 0.032], [-0.045, 0.04]], cc);
      poly(p, c, [[0.025, 0.032], [0.06, 0.032], [0.065, 0.055], [0.035, 0.055]], cc);
      ribbon(p, c, [[0.04, 0.05], [0.032, 0.09], [0.028, 0.105]], 0.011, 0.005, cc);
      ribbon(p, c, [[0.05, 0.05], [0.045, 0.09], [0.044, 0.10]], 0.009, 0.004, cc);
      poly(p, c, [[-0.05, 0.0], [-0.07, 0.0], [-0.075, 0.018], [-0.052, 0.018]], cc);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      const m = new THREE.Mesh(g, st.rabbitMat);
      m.frustumCulled = false;
      st.rabbit.add(m);
      ctx.scene3D.add(st.rabbit);
    }

    // --- seed head — detaches once and drifts off right ------------------------
    {
      const p: number[] = [], c: number[] = [];
      const r = 0.010;
      poly(p, c, [[-r, r], [r, r], [r, -r], [-r, -r]], [0.42, 0.40, 0.28]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(p), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c), 3));
      st.seedMat = st.lifeMat.clone(); st.seedMat.uniforms.uA!.value = 0;
      st.seed = new THREE.Mesh(g, st.seedMat);
      st.seed.position.set(-1.55, -0.42, 0.07);
      st.seed.frustumCulled = false;
      ctx.scene3D.add(st.seed);
    }
  },

  render: (ctx, f, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;
    st.back.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.lampMat.uniforms.uT!.value = t;
    st.curlewMat.uniforms.uT!.value = t;
    st.batMat.uniforms.uT!.value = t;
    st.rabbitMat.uniforms.uT!.value = t;
    st.seedMat.uniforms.uT!.value = t;
    st.shimmerMat.uniforms.uT!.value = t;

    // --- beam — azimuth sweep every BEAM_PERIOD; a faint counter-beam --------
    const ang = beamSweep(t);
    const env = beamEnv(t);
    st.beam.rotation.z = ang;
    st.beamMat.uniforms.uA!.value = 0.55 * env;
    st.beam2.rotation.z = ang + Math.PI;
    st.beam2Mat.uniforms.uA!.value = 0.09 * env;
    // sky glow drifts with the beam azimuth
    st.back.uniforms.uBeamX!.value = LAMP.x * 1.6 + Math.cos(ang) * 3.0;
    st.back.uniforms.uBeamA!.value = 0.6 * env;
    // lamp halo swells while the shaft is up
    st.lampMat.uniforms.uA!.value = 0.30 + 0.45 * env;

    // --- creek glints — each lights as the shaft crosses its bearing ---------
    for (const g of st.glints) {
      g.mat.uniforms.uA!.value = Math.min(0.55, beamHit(t, g.x, g.y) * 1.2);
      g.mat.uniforms.uT!.value = t;
    }

    // --- grass tips — same gate, dimmer, so the tops catch the sweep ---------
    for (const g of st.grassTips) {
      g.mat.uniforms.uA!.value = Math.min(1, beamHit(t, g.x, g.y) * 0.9);
      g.mat.uniforms.uT!.value = t;
    }

    // --- grass sway — clumps lean in 3 phases; the close blade gusts wide ----
    for (const cl of st.clumps) {
      const ud = cl.userData as { ph: number; amp: number };
      cl.rotation.z = ud.amp * Math.sin(t * 1.4 + ud.ph) + 0.02 * Math.sin(t * 3.1 + ud.ph * 2.0);
    }
    st.blade.rotation.z = 0.10 * Math.sin(t * 1.1) + 0.22 * Math.sin(Math.PI * sstep(4.0, 8.0, t % 9.0)) * Math.sin(t * 0.8);

    // --- curlew — walks the channel edge, pauses, probes twice --------------
    {
      const u = clamp01((t - CURLEW.t0) / (CURLEW.t1 - CURLEW.t0));
      const inWin = t >= CURLEW.t0 && t <= CURLEW.t1 + 1.0;
      // walk→pause→walk: progress stalls near the probe point
      const walkU = u < 0.42 ? u / 0.42 * 0.5 : u < 0.68 ? 0.5 : 0.5 + (u - 0.68) / 0.32 * 0.5;
      const x = mix(-1.75, -0.85, sCurve(clamp01(walkU)));
      const stepping = walkU < 0.5 || walkU > 0.62;
      const bob = stepping ? 0.010 * Math.sin(t * 9.0) : 0;
      st.curlew.position.set(x, -0.72 + bob, 0.06);
      // probe — the bill/neck dips toward the water twice around PROBE_T
      const pr = Math.exp(-(t - PROBE_T) * (t - PROBE_T) * 6) + 0.7 * Math.exp(-(t - PROBE_T - 0.7) * (t - PROBE_T - 0.7) * 8);
      st.curlewBill.rotation.z = -1.1 * Math.min(1, pr);
      st.curlewMat.uniforms.uA!.value = inWin ? 0.95 : 0;
    }

    // --- seed head — detaches once and drifts off on the breeze ---------------
    {
      const u = clamp01((t - SEED_T) / 2.6);
      const on = u > 0 && u < 1;
      st.seed.position.set(-1.55 + 1.1 * u, -0.42 + 0.18 * u + 0.05 * Math.sin(u * 12.0), 0.07);
      st.seedMat.uniforms.uA!.value = on ? 0.8 * Math.sin(Math.PI * u) : 0;
    }

    // --- bat — flickers across near the lamp once ----------------------------
    {
      const u = clamp01((t - BAT.t0) / (BAT.t1 - BAT.t0));
      const on = u > 0 && u < 1;
      const x = mix(2.6, 0.1, u);
      const y = LAMP.y + 0.15 + 0.20 * Math.sin(u * 14.0) + 0.05 * Math.sin(t * 9.0);
      st.bat.position.set(x, y, 0.05);
      const m = st.bat.children[0] as THREE.Mesh;
      m.scale.y = 0.5 + 0.5 * Math.abs(Math.sin(t * 11.0));
      st.batMat.uniforms.uA!.value = on ? 0.9 : 0;
    }

    // --- rabbit — hops between the foreground clumps ---------------------------
    {
      const u = clamp01((t - RABBIT.t0) / (RABBIT.t1 - RABBIT.t0));
      const inWin = t >= RABBIT.t0 && t <= RABBIT.t1;
      const x = mix(-0.45, 0.55, sCurve(u));
      const hop = 0.06 * Math.abs(Math.sin(u * Math.PI * 4.0)) * Math.sin(Math.PI * u);
      st.rabbit.position.set(x, -0.76 + hop, 0.09);
      st.rabbitMat.uniforms.uA!.value = inWin ? 0.9 : 0;
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

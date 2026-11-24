// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// dryfall — a dry waterfall ledge in a canyon at noon. A dark mineral stain
// runs down the sandstone face where water used to fall; a fallen log spans
// the gap at mid-height and a hiker silhouette crosses it with one stumble.
// Ravens circle the rim, a lizard darts, a tumbleweed rolls the floor, a dust
// devil wisp drifts through, a pigeon bobs on the rim. Flat silhouettes on
// the z=-2 picture plane; canyon a shader backdrop at z=-4. All motion f(t).
// ---------------------------------------------------------------------------

const DUR = 19.0;
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
const HIKER = { in: 3.6, step: 4.2, stumble0: 6.0, stumble1: 6.8, far: 8.8, gone: 9.6 };
const RAVEN_LAND = { down: 10.2, sit: 10.9, up: 12.2 };          // raven 2 visits the log end
const LIZARD = { t0: 13.0, t1: 14.1 };
const TUMBLE = { t0: 13.6, t1: 15.6 };
const DUST = { t0: 15.0, t1: 18.0 };

// ledge/log geometry
const LOG_Y = 0.32, LOG_X0 = -0.85, LOG_X1 = 1.05;
const LEDGE_Y = 0.30;                                          // shelf top the log rests on
const RIM_Y = 1.35;                                            // canyon rim — inside the frame
const FLOOR_Y = -1.55;                                         // canyon floor line

// ---------------------------------------------------------------------------
// geometry helpers — flat polys / ribbons in the z=-2 picture plane
// ---------------------------------------------------------------------------

function poly(p: number[], c: number[], pts: readonly (readonly number[])[], col: readonly number[]) {
  for (let i = 1; i < pts.length - 1; i++) {
    for (const k of [0, i, i + 1]) {
      p.push(pts[k][0], pts[k][1], -2);
      c.push(col[0], col[1], col[2]);
    }
  }
}

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

function fanDisk(p: number[], c: number[], cx: number, cy: number, r: number,
                 segs: number, col: readonly number[], squash = 1) {
  for (let i = 0; i < segs; i++) {
    const a0 = (2 * Math.PI * i) / segs, a1 = (2 * Math.PI * (i + 1)) / segs;
    p.push(cx, cy, -2);
    c.push(col[0], col[1], col[2]);
    p.push(cx + r * Math.cos(a0), cy + r * squash * Math.sin(a0), -2);
    c.push(col[0], col[1], col[2]);
    p.push(cx + r * Math.cos(a1), cy + r * squash * Math.sin(a1), -2);
    c.push(col[0], col[1], col[2]);
  }
}

// ---------------------------------------------------------------------------
// backdrop — noon sky band, layered sandstone, the dry-fall stain, the ledge
// shelves with their hard shadow band, pale gravel floor with heat shimmer.
// Clip-space PlaneGeometry(2,2) so uv maps 1:1 to the frame.
// ---------------------------------------------------------------------------
const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`;

const BACK_FRAG = /* glsl */ `
precision mediump float;
uniform float uT;
varying vec2 vUv;
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 q = vec2(vUv.x * 8.89 - 4.445, vUv.y * 5.0 - 2.5);
  float rim = 1.35, ledgeY = 0.30, floorY = -1.55;

  // noon sky — pale bleached blue with a warm haze at the rim
  vec3 sky = mix(vec3(0.62, 0.68, 0.72), vec3(0.78, 0.80, 0.76), 1.0 - smoothstep(1.35, 2.3, q.y));
  sky += vec3(0.10, 0.07, 0.02) * exp(-(q.y - rim) * (q.y - rim) * 3.0);

  // sandstone — horizontal strata bands, warmer near the lit top
  float band = floor(q.y * 7.0);
  float bh = hash21(vec2(band, 3.0));
  vec3 rock = mix(vec3(0.30, 0.215, 0.145), vec3(0.38, 0.28, 0.185), bh);
  rock *= 1.0 + 0.10 * smoothstep(-2.5, 1.8, q.y);            // lit crown
  // stratum seams — a hairline shadow at each band edge
  float seam = 1.0 - smoothstep(0.0, 0.012, abs(fract(q.y * 7.0) - 0.5) * 0.14);
  rock *= 1.0 - 0.18 * seam;
  // grit speckle
  rock += vec3(0.03, 0.02, 0.01) * (hash21(floor(q * vec2(28.0, 22.0))) - 0.5);
  // vertical shading — slight concavity variation across the face
  rock *= 0.94 + 0.06 * sin(q.x * 2.1 + q.y * 0.8);

  // the dry waterfall — dark mineral stain from the rim notch to the floor
  float stainX = 0.30 + 0.12 * sin(q.y * 1.55 + 0.4) + 0.05 * sin(q.y * 4.2);
  float stain = 1.0 - smoothstep(0.10, 0.55, abs(q.x - stainX));
  stain *= smoothstep(rim + 0.15, rim - 0.35, q.y) * smoothstep(floorY - 0.4, floorY + 0.6, q.y);
  float mottle = 0.6 + 0.4 * hash21(floor(q * vec2(9.0, 13.0)));
  rock = mix(rock, vec3(0.115, 0.095, 0.075), stain * mottle * 0.85);
  // wet-look sheen strip dead centre of the stain
  float sheen = (1.0 - smoothstep(0.0, 0.10, abs(q.x - stainX))) * stain;
  rock += vec3(0.05, 0.05, 0.045) * sheen;

  // ledge shelves — left slab x<-0.85, right slab x>1.05, lit top face
  float onLeft = (1.0 - smoothstep(-0.86, -0.84, q.x));
  float onRight = smoothstep(1.04, 1.06, q.x);
  float inShelf = step(q.y, ledgeY) * step(ledgeY - 0.16, q.y) * max(onLeft, onRight);
  rock = mix(rock, rock * 1.22 + vec3(0.05, 0.04, 0.02), inShelf * smoothstep(ledgeY - 0.10, ledgeY, q.y));
  // hard shadow band under the ledge lip
  float lip = step(q.y, ledgeY - 0.14) * step(ledgeY - 0.55, q.y) * max(onLeft, onRight);
  rock = mix(rock, rock * 0.42, lip * smoothstep(ledgeY - 0.55, ledgeY - 0.16, q.y));

  // canyon floor — pale gravel, heat shimmer wobble in the lowest strip
  vec3 floor0 = mix(vec3(0.36, 0.30, 0.22), vec3(0.30, 0.245, 0.18), smoothstep(floorY + 0.2, -2.5, q.y));
  floor0 += vec3(0.025, 0.02, 0.012) * (hash21(floor(q * vec2(34.0, 18.0))) - 0.5);
  float belowFloor = 1.0 - smoothstep(floorY - 0.02, floorY + 0.02, q.y);
  vec3 col = mix(rock, floor0, belowFloor);
  col = mix(col, sky, smoothstep(rim - 0.03, rim + 0.03, q.y));

  // faint heat shimmer — a slowly crawling distortion band just off the floor
  float shimmer = (1.0 - smoothstep(0.0, 0.45, abs(q.y - (floorY + 0.28)))) *
                  (0.5 + 0.5 * sin(q.x * 26.0 + uT * 2.6 + sin(q.x * 9.0)));
  col += vec3(0.05, 0.045, 0.03) * shimmer * 0.5;

  // noon exposure — warm cast over the whole face
  col += vec3(0.045, 0.03, 0.012);
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

// dust devil — additive wisp stack, alpha breathing
const DUST_VERT = /* glsl */ `
uniform float uT;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // corkscrew wobble that tightens with height
  float h = uv.y;
  p.x += sin(h * 9.0 - uT * 5.0) * 0.12 * (1.0 - h * 0.55);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const DUST_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec2 vUv;
void main() {
  float edge = pow(1.0 - abs(2.0 * vUv.x - 1.0), 1.6);
  float len = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
  gl_FragColor = vec4(vec3(0.42, 0.36, 0.26), edge * len * uA);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial;
  lifeMat: THREE.ShaderMaterial;          // shared for most silhouettes
  log: THREE.Mesh;
  hiker: THREE.Group; hikerMat: THREE.ShaderMaterial; hikerArm: THREE.Mesh; hikerLeg: THREE.Mesh;
  ravens: { mesh: THREE.Group; mat: THREE.ShaderMaterial; cx: number; cy: number; r: number; w: number; ph: number; wing: THREE.Mesh }[];
  lizard: THREE.Mesh; lizMat: THREE.ShaderMaterial;
  tumble: THREE.Mesh; tumMat: THREE.ShaderMaterial;
  dust: THREE.Mesh; dustMat: THREE.ShaderMaterial;
  pigeon: THREE.Group; pigMat: THREE.ShaderMaterial; pigHead: THREE.Mesh;
}
const STATE = new WeakMap<object, St>();

export default defineScene({
  id: "dryfall",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(9117);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — near-static, slight push-in toward the log while the hiker
    // crosses, easing back out once he reaches the far side
    ctx.rig.setLensMm(55);
    ctx.rig.setPath([
      { t: 0.00, pos: [0.0, 0.30, 5.05], target: [0.10, 0.20, -2.0] },
      { t: 0.42, pos: [0.0, 0.28, 4.80], target: [0.10, 0.28, -2.0] },
      { t: 0.70, pos: [0.0, 0.28, 4.82], target: [0.12, 0.26, -2.0] },
      { t: 1.00, pos: [0.0, 0.30, 4.95], target: [0.15, 0.22, -2.0] },
    ]);

    // --- backdrop ------------------------------------------------------------
    st.back = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: { uT: { value: 0 } }, depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), st.back);
    back.renderOrder = -10; back.frustumCulled = false;
    ctx.scene3D.add(back);

    // --- shared silhouette material ------------------------------------------
    st.lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.5 }, uA: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false,
    });

    // --- the log — weathered grey, sagging slightly, broken jagged ends ------
    {
      const p: number[] = [], c: number[] = [];
      const logC = [0.24, 0.21, 0.17], darkC = [0.16, 0.135, 0.105];
      // main span — slight sag toward the middle
      ribbon(p, c, [[LOG_X0, LOG_Y], [0.05, LOG_Y - 0.05]], 0.075, 0.075, logC);
      ribbon(p, c, [[0.05, LOG_Y - 0.05], [LOG_X1, LOG_Y]], 0.075, 0.075, logC);
      // bark striations
      for (let i = 0; i < 12; i++) {
        const x = LOG_X0 + 0.12 + (i / 12) * (LOG_X1 - LOG_X0 - 0.24);
        const y = LOG_Y - 0.05 * Math.sin(Math.PI * (x - LOG_X0) / (LOG_X1 - LOG_X0));
        ribbon(p, c, [[x, y + 0.03], [x + 0.08, y + 0.028]], 0.004, 0.004, darkC);
      }
      // broken ends — splinter fans
      poly(p, c, [[LOG_X0, LOG_Y + 0.045], [LOG_X0 - 0.09, LOG_Y + 0.06], [LOG_X0 - 0.02, LOG_Y - 0.02]], darkC);
      poly(p, c, [[LOG_X1, LOG_Y + 0.04], [LOG_X1 + 0.10, LOG_Y + 0.055], [LOG_X1 + 0.02, LOG_Y - 0.03]], darkC);
      // a stub branch on the left third
      ribbon(p, c, [[LOG_X0 + 0.35, LOG_Y + 0.03], [LOG_X0 + 0.42, LOG_Y + 0.17]], 0.022, 0.008, darkC);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.log = new THREE.Mesh(geo, st.lifeMat);
      st.log.frustumCulled = false;
      ctx.scene3D.add(st.log);
    }

    // --- hiker — body + pack + a balancing arm + a stepping leg --------------
    {
      st.hikerMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.3 }, uA: { value: 0 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      st.hiker = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const hkC = [0.10, 0.08, 0.06];
      // torso leaning slightly forward, head, pack hump
      poly(p, c, [[-0.030, 0.00], [0.035, 0.00], [0.045, 0.115], [0.030, 0.155], [-0.025, 0.150], [-0.045, 0.10]], hkC);
      poly(p, c, [[0.010, 0.150], [0.045, 0.155], [0.048, 0.185], [0.015, 0.185]], hkC);          // head
      poly(p, c, [[-0.045, 0.115], [-0.075, 0.125], [-0.070, 0.065], [-0.040, 0.060]], hkC);      // pack
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, st.hikerMat);
      body.frustumCulled = false;
      st.hiker.add(body);

      // balancing arm — pivots at the shoulder, raised during the stumble
      const ap: number[] = [], ac: number[] = [];
      poly(ap, ac, [[0, 0], [0.085, 0.012], [0.085, -0.010], [0, -0.014]], hkC);
      const ageo = new THREE.BufferGeometry();
      ageo.setAttribute("position", new THREE.Float32BufferAttribute(ap, 3));
      ageo.setAttribute("color", new THREE.Float32BufferAttribute(ac, 3));
      st.hikerArm = new THREE.Mesh(ageo, st.hikerMat);
      st.hikerArm.position.set(0.040, 0.120, 0.001);
      st.hikerArm.frustumCulled = false;
      st.hiker.add(st.hikerArm);

      // stepping leg — pivots at the hip
      const lp: number[] = [], lc: number[] = [];
      poly(lp, lc, [[-0.012, 0], [0.012, 0], [0.016, -0.075], [-0.010, -0.075]], hkC);
      const lgeo = new THREE.BufferGeometry();
      lgeo.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
      lgeo.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
      st.hikerLeg = new THREE.Mesh(lgeo, st.hikerMat);
      st.hikerLeg.position.set(0.005, 0.005, 0.001);
      st.hikerLeg.frustumCulled = false;
      st.hiker.add(st.hikerLeg);

      st.hiker.scale.setScalar(1.0);
      ctx.scene3D.add(st.hiker);
    }

    // --- ravens — three orbiters above the rim -------------------------------
    st.ravens = [];
    const orbits = [
      { cx: 0.9, cy: 1.62, r: 0.42, w: 0.42, ph: 0.0 },
      { cx: -0.7, cy: 1.52, r: 0.62, w: -0.31, ph: 2.2 },   // raven 2 — lands on the log end
      { cx: 1.7, cy: 1.72, r: 0.30, w: 0.55, ph: 4.4 },
    ];
    for (const o of orbits) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.2 }, uA: { value: 0.9 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const g = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const rvC = [0.028, 0.026, 0.030];
      poly(p, c, [[-0.055, 0], [0.05, 0.012], [0.075, -0.005], [0.05, -0.020], [-0.05, -0.015]], rvC);  // body+head
      poly(p, c, [[0.075, 0.005], [0.105, -0.002], [0.075, -0.010]], rvC);                             // beak
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, mat);
      body.frustumCulled = false;
      g.add(body);
      // wing — a triangle fanning open/shut in a slow flap
      const wp: number[] = [], wc: number[] = [];
      poly(wp, wc, [[0, 0], [-0.14, 0.05], [-0.10, -0.015]], rvC);
      const wgeo = new THREE.BufferGeometry();
      wgeo.setAttribute("position", new THREE.Float32BufferAttribute(wp, 3));
      wgeo.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3));
      const wing = new THREE.Mesh(wgeo, mat);
      wing.position.set(-0.02, 0.005, 0.001);
      wing.frustumCulled = false;
      g.add(wing);
      st.ravens.push({ mesh: g, mat, cx: o.cx, cy: o.cy, r: o.r, w: o.w, ph: o.ph, wing });
      ctx.scene3D.add(g);
    }

    // --- lizard — one dart across the left shelf ------------------------------
    {
      st.lizMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 0 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const p: number[] = [], c: number[] = [];
      const lzC = [0.075, 0.065, 0.045];
      poly(p, c, [[-0.08, 0], [0.07, 0.006], [0.08, -0.006], [-0.07, -0.009]], lzC);       // body
      poly(p, c, [[-0.08, 0.0], [-0.15, -0.003], [-0.135, -0.012]], lzC);                   // tail
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.lizard = new THREE.Mesh(geo, st.lizMat);
      st.lizard.frustumCulled = false;
      ctx.scene3D.add(st.lizard);
    }

    // --- tumbleweed — dry sphere rolling across the bottom --------------------
    {
      st.tumMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.3 }, uA: { value: 0 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      const p: number[] = [], c: number[] = [];
      const twC = [0.22, 0.175, 0.11];
      fanDisk(p, c, 0, 0, 0.16, 14, twC);
      // sparse twig spikes
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rng() * 0.4;
        const r0 = 0.10 + rng() * 0.03;
        poly(p, c, [
          [Math.cos(a) * r0, Math.sin(a) * r0],
          [Math.cos(a + 0.15) * (r0 + 0.045), Math.sin(a + 0.15) * (r0 + 0.045)],
          [Math.cos(a - 0.10) * (r0 + 0.02), Math.sin(a - 0.10) * (r0 + 0.02)]
        ], twC);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      st.tumble = new THREE.Mesh(geo, st.tumMat);
      st.tumble.frustumCulled = false;
      ctx.scene3D.add(st.tumble);
    }

    // --- dust devil — wisp column crossing the canyon floor -------------------
    {
      st.dustMat = new THREE.ShaderMaterial({
        vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
        uniforms: { uT: { value: 0 }, uA: { value: 0 } },
        transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      });
      st.dust = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.3, 1, 16), st.dustMat);
      st.dust.frustumCulled = false;
      st.dust.position.set(-3.5, FLOOR_Y + 0.6, 0.05);
      ctx.scene3D.add(st.dust);
    }

    // --- rock pigeon — bobbing on the right rim --------------------------------
    {
      st.pigMat = new THREE.ShaderMaterial({
        vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0.2 }, uA: { value: 0.9 } },
        transparent: true, depthTest: false, depthWrite: false,
      });
      st.pigeon = new THREE.Group();
      const p: number[] = [], c: number[] = [];
      const pgC = [0.10, 0.09, 0.085];
      poly(p, c, [[-0.045, 0], [0.04, 0.005], [0.055, 0.03], [0.01, 0.05], [-0.04, 0.045]], pgC);   // body
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
      const body = new THREE.Mesh(geo, st.pigMat);
      body.frustumCulled = false;
      st.pigeon.add(body);
      // head — dips forward on the bob
      const hp: number[] = [], hc: number[] = [];
      poly(hp, hc, [[0, 0], [0.028, 0.004], [0.030, 0.026], [0.002, 0.028]], pgC);
      const hgeo = new THREE.BufferGeometry();
      hgeo.setAttribute("position", new THREE.Float32BufferAttribute(hp, 3));
      hgeo.setAttribute("color", new THREE.Float32BufferAttribute(hc, 3));
      st.pigHead = new THREE.Mesh(hgeo, st.pigMat);
      st.pigHead.position.set(0.048, 0.045, 0.001);
      st.pigHead.frustumCulled = false;
      st.pigeon.add(st.pigHead);
      st.pigeon.position.set(2.1, RIM_Y + 0.02, 0.05);
      ctx.scene3D.add(st.pigeon);
    }
  },

  render: (ctx: SceneContext, f: { t: number }, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;

    st.back.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    st.dustMat.uniforms.uT!.value = t;

    // --- hiker — in at the left shelf, steps across the log, one stumble,
    //     reaches the far shelf and walks off frame --------------------------
    {
      const mid = (LOG_X0 + LOG_X1) / 2;
      let hx = -3.2, hy = LEDGE_Y + 0.06, a = 0;
      let legSwing = 0, armSwing = 0.15, bodyPitch = 0;
      if (t >= HIKER.in && t < HIKER.step) {                       // walks left shelf to the log
        const u = sCurve((t - HIKER.in) / (HIKER.step - HIKER.in));
        hx = mix(-1.9, LOG_X0 + 0.06, u);
        a = 0.95;
        legSwing = 0.5 * Math.sin(u * Math.PI * 5);
      } else if (t < HIKER.stumble0) {                             // on the log, careful steps
        const u = (t - HIKER.step) / (HIKER.stumble0 - HIKER.step);
        hx = mix(LOG_X0 + 0.06, mid - 0.06, sCurve(u));
        hy = LOG_Y + 0.10 - 0.05 * Math.sin(Math.PI * (hx - LOG_X0) / (LOG_X1 - LOG_X0));
        a = 0.95;
        legSwing = 0.35 * Math.sin(t * 4.5);
        armSwing = 0.30 + 0.08 * Math.sin(t * 2.0);                // arm held out for balance
      } else if (t < HIKER.stumble1) {                             // the stumble — dip + recover
        const u = (t - HIKER.stumble0) / (HIKER.stumble1 - HIKER.stumble0);
        hx = mid - 0.06 + 0.10 * sCurve(u);
        const dip = Math.sin(Math.PI * clamp01(u * 1.15));
        hy = LOG_Y + 0.10 - 0.05 - 0.16 * dip;
        a = 0.95;
        bodyPitch = 0.38 * dip;                                    // lurch forward
        armSwing = 0.30 + 2.2 * Math.sin(u * Math.PI * 3.0);       // windmill
        legSwing = 0.6 * Math.sin(u * Math.PI * 2);
      } else if (t < HIKER.far) {                                  // steady across to the far end
        const u = sCurve((t - HIKER.stumble1) / (HIKER.far - HIKER.stumble1));
        hx = mix(mid + 0.04, LOG_X1 - 0.04, u);
        hy = LOG_Y + 0.10 - 0.05 * Math.sin(Math.PI * (hx - LOG_X0) / (LOG_X1 - LOG_X0));
        a = 0.95;
        legSwing = 0.35 * Math.sin(t * 4.5);
        armSwing = 0.30 + 0.06 * Math.sin(t * 1.8);
      } else if (t < HIKER.gone) {                                 // steps onto the far shelf, exits
        const u = sCurve((t - HIKER.far) / (HIKER.gone - HIKER.far));
        hx = mix(LOG_X1 - 0.04, 3.1, u);
        hy = mix(LOG_Y + 0.08, LEDGE_Y + 0.06, sCurve(clamp01(u * 2.5)));
        a = 0.95 * (1 - sstep(HIKER.gone - 0.35, HIKER.gone, t));
        legSwing = 0.5 * Math.sin(u * Math.PI * 6);
      }
      st.hiker.position.set(hx, hy + 0.004 * Math.abs(Math.sin(t * 9)), 0.04);
      st.hiker.rotation.z = bodyPitch;
      st.hikerMat.uniforms.uA!.value = a;
      st.hikerLeg.rotation.z = -0.8 * legSwing;
      st.hikerArm.rotation.z = armSwing;
    }

    // --- ravens — orbits; raven 2 peels off to the log end and back ----------
    st.ravens.forEach((rv, i) => {
      let flap = 0.55 * Math.sin(t * (5.2 + i));
      if (i === 1) {
        // land window: down to the log end, sit, lift back into the orbit
        const land = sstep(RAVEN_LAND.down, RAVEN_LAND.sit, t) * (1 - sstep(RAVEN_LAND.up - 0.6, RAVEN_LAND.up, t));
        const a = rv.w * (t - 0) + rv.ph;
        const ox = rv.cx + rv.r * Math.cos(a), oy = rv.cy + 0.38 * rv.r * Math.sin(a);
        const lx = LOG_X1 - 0.02, ly = LOG_Y + 0.10;
        const u = clamp01(land);
        const px = mix(ox, lx, u), py = mix(oy, ly, sCurve(u));
        rv.mesh.position.set(px, py, 0.06);
        rv.mesh.rotation.z = mix(a + Math.PI / 2 - rv.w * 0.9, 0.1, u);
        rv.mat.uniforms.uA!.value = 0.9;
        rv.wing.rotation.z = (1 - u) * flap * 0.9 + u * 0.15;
        return;
      }
      const a = rv.w * t + rv.ph;
      const x = rv.cx + rv.r * Math.cos(a), y = rv.cy + 0.38 * rv.r * Math.sin(a);
      rv.mesh.position.set(x, y, 0.06);
      rv.mesh.rotation.z = a + Math.PI / 2 - rv.w * 0.9;
      rv.mat.uniforms.uA!.value = 0.9;
      rv.wing.rotation.z = flap * 0.9;
    });

    // --- lizard — a quick dart, pause, dart ----------------------------------
    {
      const u = clamp01((t - LIZARD.t0) / (LIZARD.t1 - LIZARD.t0));
      const on = u > 0 && u < 1;
      // two dashes with a freeze between
      const leg = u < 0.45 ? sCurve(u / 0.45) : u < 0.6 ? 1 : 1 + sCurve((u - 0.6) / 0.4);
      const x = mix(-1.62, -1.02, Math.min(leg, 2) / 2);
      st.lizard.position.set(x, LEDGE_Y + 0.016, 0.05);
      st.lizMat.uniforms.uA!.value = on ? 0.85 : 0;
    }

    // --- tumbleweed — rolls across the floor with little hops -----------------
    {
      const u = clamp01((t - TUMBLE.t0) / (TUMBLE.t1 - TUMBLE.t0));
      const on = u > 0 && u < 1;
      const x = mix(-4.3, 4.4, u);
      const hop = Math.abs(Math.sin(u * Math.PI * 5)) * 0.09;
      st.tumble.position.set(x, FLOOR_Y + 0.16 + hop, 0.05);
      st.tumble.rotation.z = -u * 16;
      st.tumMat.uniforms.uA!.value = on ? 0.8 * sstep(TUMBLE.t0, TUMBLE.t0 + 0.4, t) * (1 - sstep(TUMBLE.t1 - 0.4, TUMBLE.t1, t)) : 0;
    }

    // --- dust devil — a wisp crossing the floor -------------------------------
    {
      const u = clamp01((t - DUST.t0) / (DUST.t1 - DUST.t0));
      const on = u > 0 && u < 1;
      const x = mix(-3.6, 3.8, u);
      st.dust.position.set(x, FLOOR_Y + 0.6 + 0.04 * Math.sin(t * 1.3), 0.05);
      st.dustMat.uniforms.uA!.value = on ? 0.55 * sstep(DUST.t0, DUST.t0 + 0.8, t) * (1 - sstep(DUST.t1 - 0.9, DUST.t1, t)) : 0;
    }

    // --- pigeon — head-bob walk a step or two along the rim -------------------
    {
      const bobT = t * 2.2;
      const step = Math.floor(bobT) % 4 < 2 ? 1 : 0;
      const px = 2.1 + 0.05 * Math.sin(t * 0.4) + (step ? 0.0 : 0.0);
      st.pigeon.position.set(px, RIM_Y + 0.02, 0.05);
      st.pigHead.rotation.z = -0.5 * Math.max(0, Math.sin(bobT * Math.PI));
      st.pigHead.position.y = 0.045 - 0.006 * Math.max(0, Math.sin(bobT * Math.PI));
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});

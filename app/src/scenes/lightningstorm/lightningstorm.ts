// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

function smooth01(x: number) {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
}

// camera: slow push toward the storm + slight lateral drift
function camPos(t: number): [number, number, number] {
  return [2.0 * Math.sin(0.04 * t), 2.6 + 0.8 * smooth01(t / 20), 36 - 0.4 * t];
}
function camTarget(t: number): [number, number, number] {
  return [0.5 * Math.sin(0.03 * t + 2.0), 2.0, -2.0];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- wall cloud: stacked fbm masses, internally lit by strike flashes --------
const CLOUD_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uSeed;
uniform float uFlash;   // 0..1 afterglow from lightning
void main() {
  vec2 c = (vUv - 0.5) * 2.0;
  float n = fbm3(vec3(c * 2.2 + uSeed * 11.0, uT * 0.06 + uSeed * 3.0), 5, 2.0, 0.55);
  float d = sat(n * 0.85 + 0.55 - length(c * vec2(0.85, 1.4)) * 0.5);
  float a = d;
  // dark slate mass; flash lights the interior and silver-lights the edges
  vec3 base = mix(vec3(0.015, 0.015, 0.028), vec3(0.05, 0.05, 0.08), d);
  vec3 lit = mix(base, vec3(0.65, 0.7, 0.95), uFlash * (0.35 + 0.65 * d));
  gl_FragColor = vec4(lit, a);
}
`;

// --- rain shafts: vertical streaked curtains ---------------------------------
const RAIN_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uSeed;
uniform float uAmp;
void main() {
  // narrow vertical streaks scrolling downward
  float n = fbm3(vec3(vUv.x * 24.0 + uSeed * 17.0, vUv.y * 1.5 - uT * 0.7, uSeed), 3, 2.0, 0.5);
  float d = sat(n * 0.9 + 0.15);
  float a = d * 0.3 * uAmp
          * smoothstep(0.0, 0.25, vUv.y)
          * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  vec3 col = vec3(0.10, 0.12, 0.16);
  gl_FragColor = vec4(col, a);
}
`;

// --- lightning: additive line channels, envelope = flash -> decay ------------
const BOLT_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const BOLT_FRAG = /* glsl */ `
uniform float uEnv;
uniform float uGhost;
void main() {
  float a = uEnv * uGhost;
  gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * 2.2, a);
}
`;

// --- town lights: warm dots along the horizon --------------------------------
const TOWN_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = 0.5 + 0.5 * sin(uT * (0.5 + fract(aSeed * 5.0)) + aSeed * 40.0);
  gl_PointSize = min(2.2 * 240.0 / max(1.0, -mv.z), 4.0);
  gl_Position = projectionMatrix * mv;
}
`;
const TOWN_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.65, 0.3) * a, a);
}
`;

// --- ground: near-black plain ------------------------------------------------
const GROUND_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec2 vUv;
uniform float uFlash;
void main() {
  vec3 col = mix(vec3(0.004, 0.004, 0.008), vec3(0.05, 0.05, 0.07), uFlash * 0.6)
           + vec3(0.007, 0.008, 0.013) * (1.0 - smoothstep(0.5, 0.98, vUv.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

interface LsState {
  cloudMats: THREE.ShaderMaterial[];
  rainMats: THREE.ShaderMaterial[];
  bolts: { mat: THREE.ShaderMaterial; t0: number }[];
  flashLight: THREE.ShaderMaterial; // ground mat
  townMat: THREE.ShaderMaterial;
}
const lsStates = new WeakMap<SceneContext, LsState>();

// hash-seeded recursive branch: main channel + side forks as line segments
function buildBolt(rng: () => number, x0: number, y0: number, z0: number): Float32Array {
  const segs: number[] = [];
  const trace = (x: number, y: number, z: number, vy: number, wob: number, depth: number, len: number) => {
    let px = x, py = y, pz = z;
    const n = Math.max(4, Math.floor(len * 2.2));
    for (let i = 0; i < n; i++) {
      const nx = px + (rng() - 0.5) * wob;
      const ny = py + vy * (0.9 + rng() * 0.3);
      const nz = pz + (rng() - 0.5) * wob * 0.3;
      segs.push(px, py, pz, nx, ny, nz);
      // fork: ~22% per node, depth-limited, half energy
      if (depth < 2 && rng() < 0.22) trace(nx, ny, nz, vy * 0.6, wob * 0.8, depth + 1, len * 0.45);
      px = nx; py = ny; pz = nz;
      if (py < -4.2) break;
    }
  };
  trace(x0, y0, z0, -0.55, 0.9, 0, Math.abs(y0 + 4.2) / 0.55 + 2);
  return new Float32Array(segs);
}

// strike envelope f(t): sharp attack, ~1.5s decay, secondary re-strike flicker
function strikeEnv(t: number, t0: number, dt0: number): number {
  const x = t - t0;
  if (x < 0 || x > 4) return 0;
  const main = Math.exp(-x * 2.2);
  const restrike = Math.exp(-Math.pow((x - 0.28) / 0.09, 2)) * 0.6 * dt0;
  return Math.min(1.2, main + restrike);
}

export default defineScene({
  id: 'lightningstorm/cell',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x030309);

    const rng = mulberry32(9021);

    // --- wall cloud: 3 stacked fbm billboards
    const cloudMats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: CLOUD_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uSeed: { value: i * 1.3 + 1 }, uFlash: { value: 0 } },
      });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(60 + i * 14, 16 + i * 5), m);
      q.position.set((i - 1) * 5, 8.0 + i * 2.4, -14 - i * 3);
      q.renderOrder = 2 + i;
      sc.add(q);
      cloudMats.push(m);
    }

    // --- rain shafts: 3 curtains mid-ground
    const rainMats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.ShaderMaterial({
        vertexShader: QUAD_VERT,
        fragmentShader: RAIN_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uSeed: { value: i * 2.1 + 4 }, uAmp: { value: 0.6 } },
      });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(7 + i * 2, 14), m);
      q.position.set(-9 + i * 9 + (rng() - 0.5) * 3, -0.5, -10 - i * 2);
      q.renderOrder = 5;
      sc.add(q);
      rainMats.push(m);
    }

    // --- lightning strikes: hash-seeded channels, gated by f(t) envelopes
    const strikeTimes = [11.7, 14.3, 17.5, 18.8, 20.9, 22.3];
    const bolts: LsState['bolts'] = [];
    for (let k = 0; k < strikeTimes.length; k++) {
      const brng = mulberry32(4000 + k * 977);
      const x0 = -7 + brng() * 14;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(buildBolt(brng, x0, 7.5, -11), 3));
      const m = new THREE.ShaderMaterial({
        vertexShader: BOLT_VERT,
        fragmentShader: BOLT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uEnv: { value: 0 }, uGhost: { value: 0.85 + brng() * 0.3 } },
      });
      const lines = new THREE.LineSegments(geo, m);
      lines.renderOrder = 7;
      sc.add(lines);
      bolts.push({ mat: m, t0: strikeTimes[k]! });
    }

    // --- town lights on the horizon
    const NT = 70;
    const tpos = new Float32Array(NT * 3);
    const tseed = new Float32Array(NT);
    for (let i = 0; i < NT; i++) {
      tpos[i * 3] = -24 + rng() * 48;
      tpos[i * 3 + 1] = -3.85 + rng() * 0.5;
      tpos[i * 3 + 2] = -16 + rng() * 2;
      tseed[i] = rng() * 100;
    }
    const townGeo = new THREE.BufferGeometry();
    townGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
    townGeo.setAttribute('aSeed', new THREE.BufferAttribute(tseed, 1));
    const townMat = new THREE.ShaderMaterial({
      vertexShader: TOWN_VERT,
      fragmentShader: TOWN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const town = new THREE.Points(townGeo, townMat);
    town.renderOrder = 4;
    sc.add(town);

    // --- ground plain
    const groundMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: { uFlash: { value: 0 } },
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 3), groundMat);
    ground.position.set(0, -6.0, -14);
    ground.renderOrder = 1;
    sc.add(ground);

    ctx.rig.setLensMm(38);
    // dense keys keyed to this entry's absolute-time window so evalPath(u)
    // and God-View sampling both land on camPos(t)
    const wps = [];
    for (let i = 0; i <= 24; i++) {
      const wt = ctx.sceneCtx.start + (i / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: i / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.rig.position = camPos(0);
    ctx.rig.target = camTarget(0);
    ctx.updateCamera(0, 0);
    lsStates.set(ctx, { cloudMats, rainMats, bolts, flashLight: groundMat, townMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const S = lsStates.get(ctx)!;

    // gather: ambient flicker builds before the first strike
    const gather = smooth01((t - 4) / 6);
    // strike envelopes: dt0 term re-strikes the stronger later strikes
    let flash = 0;
    for (const b of S.bolts) {
      const env = strikeEnv(t, b.t0, b.t0 > 16 ? 1 : 0.3);
      b.mat.uniforms.uEnv.value = env;
      flash += env;
    }
    flash = Math.min(1, flash * 0.8);
    const ambient = 0.04 + gather * 0.05;

    for (const m of S.cloudMats) {
      m.uniforms.uT.value = t;
      m.uniforms.uFlash.value = ambient + flash * 0.9;
    }
    for (const m of S.rainMats) {
      m.uniforms.uT.value = t;
      m.uniforms.uAmp.value = 0.35 + gather * 0.4 + flash * 0.5;
    }
    S.flashLight.uniforms.uFlash.value = flash;
    S.townMat.uniforms.uT.value = t;

    // evalPath(f.p) drives the pose via the per-entry waypoint window
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

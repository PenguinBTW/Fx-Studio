// Shared building blocks for the Bird Odyssey worlds: GLSL noise, time splines,
// sky domes, terrains, floating islands, camera-wrapped motes and billboard puffs.
// Everything animated is a closed-form function of the uniform `t`.
import * as THREE from 'three';
import { PH } from '../../engine/gl';
import { mulberry32, noise2 } from '../../engine/util';

export type V3 = [number, number, number];

// ---------------------------------------------------------------------------- GLSL
export const GLSL_NOISE = /* glsl */ `
float bh31(vec3 p) { p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float bh21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh31(i), bh31(i + vec3(1,0,0)), f.x), mix(bh31(i + vec3(0,1,0)), bh31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh31(i + vec3(0,0,1)), bh31(i + vec3(1,0,1)), f.x), mix(bh31(i + vec3(0,1,1)), bh31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(bh21(i), bh21(i + vec2(1,0)), f.x), mix(bh21(i + vec2(0,1)), bh21(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm2(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; } return s; }
`;

export const CLIP_V_PARS = '#include <clipping_planes_pars_vertex>';
export const CLIP_V = '#include <clipping_planes_vertex>';
export const CLIP_F_PARS = '#include <clipping_planes_pars_fragment>';
export const CLIP_F = '#include <clipping_planes_fragment>';

export const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFogHeight; uniform float uFogFalloff;
vec3 applyFog(vec3 col, vec3 wp) {
  float d = distance(wp, cameraPosition);
  float hf = exp(-max(wp.y - uFogHeight, 0.0) * uFogFalloff);
  float f = 1.0 - exp(-pow(d * uFogDensity, 1.6) * mix(0.35, 1.0, hf));
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}`;

export interface FogSpec { color: THREE.Color; density: number; height: number; falloff: number }
export const fogUniforms = (f: FogSpec) => ({
  uFogColor: { value: f.color }, uFogDensity: { value: f.density }, uFogHeight: { value: f.height }, uFogFalloff: { value: f.falloff },
});

/** Patch a built-in material so it uses the same height fog as the custom shaders. */
/** World-space surface grain (two octaves of value noise) + its gradient, so flat fills read as weathered stone/soil. */
const DETAIL_GLSL = /* glsl */ `
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float grain(vec3 p) { return vn3(p * 0.33) * 0.55 + vn3(p * 1.7) * 0.3 + vn3(p * 6.1) * 0.15; }
vec3 grainGrad(vec3 p) { const float e = 0.08; float g = grain(p);
  return vec3(grain(p + vec3(e,0,0)) - g, grain(p + vec3(0,e,0)) - g, grain(p + vec3(0,0,e)) - g) / e * 0.12; }`;

export function withFog<M extends THREE.Material>(m: M, f: FogSpec, detail = true): M {
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, fogUniforms(f));
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogWP;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvFogWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#ifdef USE_INSTANCING\nvFogWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFogWP;\n' + FOG_GLSL)
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = applyFog(gl_FragColor.rgb, vFogWP);');
    if (detail) s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DETAIL_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\n{ float g = grain(vFogWP); diffuseColor.rgb *= mix(0.72, 1.14, g); }')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n{ vec3 gr = grainGrad(vFogWP); normal = normalize(normal - (viewMatrix * vec4(gr, 0.0)).xyz * 0.55); }');
  };
  m.customProgramCacheKey = () => `bofog${f.density}${f.height}${detail ? 'd' : ''}`;
  return m;
}

// ---------------------------------------------------------------------------- time splines
/** C1 Hermite spline over time-stamped keys (non-uniform Catmull-Rom tangents). */
export class TimeSpline {
  constructor(public keys: { t: number; p: V3 }[]) {}
  private tan(i: number): V3 {
    const k = this.keys, n = k.length;
    const a = k[Math.max(0, i - 1)]!, b = k[Math.min(n - 1, i + 1)]!;
    const dt = b.t - a.t || 1;
    return [(b.p[0] - a.p[0]) / dt, (b.p[1] - a.p[1]) / dt, (b.p[2] - a.p[2]) / dt];
  }
  at(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const k = this.keys, n = k.length;
    if (t <= k[0]!.t) { const m = this.tan(0); const d = t - k[0]!.t; return out.set(k[0]!.p[0] + m[0] * d, k[0]!.p[1] + m[1] * d, k[0]!.p[2] + m[2] * d); }
    if (t >= k[n - 1]!.t) { const m = this.tan(n - 1); const d = t - k[n - 1]!.t; return out.set(k[n - 1]!.p[0] + m[0] * d, k[n - 1]!.p[1] + m[1] * d, k[n - 1]!.p[2] + m[2] * d); }
    let i = 0; while (i < n - 2 && t > k[i + 1]!.t) i++;
    const a = k[i]!, b = k[i + 1]!, h = b.t - a.t, u = (t - a.t) / h;
    const m0 = this.tan(i), m1 = this.tan(i + 1);
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return out.set(
      h00 * a.p[0] + h10 * h * m0[0] + h01 * b.p[0] + h11 * h * m1[0],
      h00 * a.p[1] + h10 * h * m0[1] + h01 * b.p[1] + h11 * h * m1[1],
      h00 * a.p[2] + h10 * h * m0[2] + h01 * b.p[2] + h11 * h * m1[2],
    );
  }
  vel(t: number, out = new THREE.Vector3(), e = 1 / 240): THREE.Vector3 {
    const a = this.at(t - e, new THREE.Vector3()), b = this.at(t + e, new THREE.Vector3());
    return out.subVectors(b, a).multiplyScalar(1 / (2 * e));
  }
}

/** Smooth scalar keyframes (C1, same Hermite scheme). */
export class ScalarSpline {
  private s: TimeSpline;
  constructor(keys: [number, number][]) { this.s = new TimeSpline(keys.map(([t, v]) => ({ t, p: [v, 0, 0] as V3 }))); }
  at(t: number) { return this.s.at(t, TMP).x; }
}
const TMP = new THREE.Vector3();

export const rng = (seed: number) => mulberry32(seed);

// ---------------------------------------------------------------------------- sky dome
/** `glsl` must define `vec3 skyColor(vec3 dir)` (linear HDR). The dome follows the camera. */
export function makeSky(glsl: string, uniforms: Record<string, THREE.IUniform> = {}): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, ...uniforms },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }`,
    fragmentShader: /* glsl */ `
      uniform float t; varying vec3 vDir;
      ${GLSL_NOISE}
      ${glsl}
      void main() { gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.onBeforeRender = (_r, _s, cam) => { m.position.copy(cam.position); m.updateMatrixWorld(); };
  return m;
}

/** Prefiltered environment map from a sky glsl (for PBR reflections). */
export function envFromSky(renderer: THREE.WebGLRenderer, glsl: string, uniforms: Record<string, THREE.IUniform> = {}): THREE.Texture {
  const s = new THREE.Scene();
  const sky = makeSky(glsl, uniforms);
  sky.onBeforeRender = () => {};
  s.add(sky);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0, 0.1, 6000);
  pm.dispose();
  (sky.material as THREE.Material).dispose(); sky.geometry.dispose();
  renderer.resetState();
  ENV_RT.set(rt.texture, rt);
  return rt.texture;
}
const ENV_RT = new WeakMap<THREE.Texture, THREE.WebGLRenderTarget>();
/** Free a scene's PMREM environment (the render target that owns the texture). */
export function disposeEnv(scene: THREE.Scene) {
  const tex = scene.environment;
  if (!tex) return;
  const rt = ENV_RT.get(tex);
  if (rt) rt.dispose(); else tex.dispose();
  scene.environment = null;
}

// ---------------------------------------------------------------------------- terrain
export interface TerrainOpts {
  x0: number; z0: number; x1: number; z1: number; nx: number; nz: number;
  height: (x: number, z: number) => number;
  color: (x: number, y: number, z: number, slope: number, out: THREE.Color) => void;
}
export function terrainGeometry(o: TerrainOpts): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(o.x1 - o.x0, o.z1 - o.z0, o.nx, o.nz);
  g.rotateX(-Math.PI / 2);
  g.translate((o.x0 + o.x1) / 2, 0, (o.z0 + o.z1) / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, o.height(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    o.color(pos.getX(i), pos.getY(i), pos.getZ(i), 1 - nrm.getY(i), c);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export interface IslandOpts {
  radius: number; depth: number; rings?: number; segs?: number; seed: number;
  /** Top-cap height at (x, z); r01 is 0 at the centre and 1 at the rim. Default: a low dome. */
  top?: (x: number, z: number, r01: number) => number;
  /** Vertex colour; `under` is true on the rock underside. Default: grass top, grey-brown rock. */
  color?: (x: number, y: number, z: number, slope: number, under: boolean, out: THREE.Color) => void;
}
const ISLAND_TOP = (_x: number, _z: number, r01: number) => 0.6 * (1 - r01 * r01);
const ISLAND_COLOR = (_x: number, _y: number, _z: number, _slope: number, under: boolean, out: THREE.Color) => { out.set(under ? '#6e6458' : '#7d9a5c'); };
/** A floating island: noisy top cap plus a craggy inverted-cone underside, centred on the origin. */
export function islandGeometry(o: IslandOpts): THREE.BufferGeometry {
  const R = o.rings ?? 48, S = o.segs ?? 96;
  const r1 = rng(o.seed), ph = [r1() * 9, r1() * 9, r1() * 9];
  const rows = R * 2 + 1;
  const P = new Float32Array(rows * (S + 1) * 3), U = new Uint8Array(rows * (S + 1));
  const edge = (a: number) => 1 + 0.16 * Math.sin(3 * a + ph[0]!) + 0.09 * Math.sin(5 * a + ph[1]!) + 0.05 * Math.sin(11 * a + ph[2]!);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= S; i++) {
      const a = (i / S) * Math.PI * 2, e = edge(a);
      let x: number, y: number, z: number, under = 0;
      if (j <= R) {
        const s = j / R, r = s * o.radius * e;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        const lip = Math.pow(s, 8);
        y = (o.top ?? ISLAND_TOP)(x, z, s) * (1 - lip) - lip * 0.6;
      } else {
        under = 1;
        // stepped rock strata: ledges every ~1/9 of the depth, plus vertical fluting
        const s = (j - R) / R, ledge = 1 + 0.045 * Math.tanh(4 * Math.sin(s * 28 + ph[0]! + 0.6 * Math.sin(3 * a)));
        const r = (1 - Math.pow(s, 1.35)) * o.radius * e * (1 - 0.05 * Math.abs(Math.sin(17 * a + 9 * s))) * ledge;
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        const crag = 0.5 + 0.55 * Math.pow(Math.abs(Math.sin(3 * a + ph[1]! + s * 2)), 3) + 0.45 * Math.abs(Math.sin(7 * a + ph[2]! + s * 3)) * Math.abs(Math.sin(4 * a + ph[0]!));  // hanging spurs, not a single cone
        y = -0.6 - o.depth * Math.pow(s, 1.25) * crag;
      }
      const k = j * (S + 1) + i;
      P[k * 3] = x; P[k * 3 + 1] = y; P[k * 3 + 2] = z; U[k] = under;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < S; i++) {
    const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(P.length), c = new THREE.Color();
  for (let k = 0; k < rows * (S + 1); k++) {
    (o.color ?? ISLAND_COLOR)(P[k * 3]!, P[k * 3 + 1]!, P[k * 3 + 2]!, 1 - n.getY(k), U[k] === 1, c);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// ---------------------------------------------------------------------------- motes
export interface MoteOpts {
  count: number; box: V3; color: THREE.Color; size: number; vel: V3; swirl?: number; seed?: number;
  flicker?: number; additive?: boolean; color2?: THREE.Color;
}
/** Camera-wrapped ambient particles (embers, ash, pollen, sand). Position = f(seed, t). */
export function makeMotes(o: MoteOpts): THREE.Points {
  const r = rng(o.seed ?? 7);
  const a = new Float32Array(o.count * 4);
  for (let i = 0; i < o.count * 4; i++) a[i] = r();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.count * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(a, 4));
  const additive = o.additive !== false;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 }, uBox: { value: new THREE.Vector3(...o.box) }, uVel: { value: new THREE.Vector3(...o.vel) },
      uCol: { value: o.color }, uCol2: { value: o.color2 ?? o.color }, uSize: { value: o.size }, uSwirl: { value: o.swirl ?? 0.5 },
      uFlicker: { value: o.flicker ?? 0.5 }, uPx: { value: PH / 1080 }, uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float t, uSize, uSwirl, uPx; uniform vec3 uBox, uVel;
      attribute vec4 aSeed; varying float vA; varying float vS; varying float vMix;
      ${CLIP_V_PARS}
      void main() {
        vec3 p = aSeed.xyz * uBox + uVel * (0.6 + 0.8 * aSeed.w) * t;
        p += uSwirl * vec3(sin(t * 0.7 + aSeed.w * 40.0), sin(t * 0.53 + aSeed.x * 31.0), cos(t * 0.61 + aSeed.y * 23.0));
        vec3 rel = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 wp = cameraPosition + rel;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        ${CLIP_V}
        float d = -mvPosition.z;
        vec3 e = abs(rel) / (uBox * 0.5);
        vA = (1.0 - smoothstep(0.7, 1.0, max(e.x, max(e.y, e.z)))) * smoothstep(0.3, 1.5, d);
        vS = aSeed.w; vMix = aSeed.x;
        gl_PointSize = clamp(uSize * (0.4 + aSeed.w) * uPx * 540.0 / max(d, 0.1), 1.0, 64.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float t, uFlicker, uAlpha; uniform vec3 uCol, uCol2; varying float vA; varying float vS; varying float vMix;
      ${CLIP_F_PARS}
      void main() {
        ${CLIP_F}
        vec2 q = gl_PointCoord * 2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard;
        float fl = 1.0 - uFlicker + uFlicker * (0.5 + 0.5 * sin(t * (3.0 + 6.0 * vS) + vS * 60.0));
        float a = exp(-r2 * 3.5) * vA * fl * uAlpha;
        gl_FragColor = vec4(mix(uCol, uCol2, vMix) * a, ${additive ? '0.0' : 'a'});
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
  mat.clipping = true;
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---------------------------------------------------------------------------- billboard puffs
export interface PuffItem { p: V3; s: number; seed?: number; tint?: number }
export interface PuffOpts {
  lit: THREE.Color; shade: THREE.Color; sunDir: THREE.Vector3; fog: FogSpec;
  opacity?: number; emissive?: THREE.Color; drift?: V3; soft?: number; spin?: number; nearFade?: number;
}
/** Instanced, camera-facing volumetric-looking puffs (clouds, smoke, sand storms). */
export function makePuffs(items: PuffItem[], o: PuffOpts): THREE.Mesh {
  const base = new THREE.PlaneGeometry(2, 2);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.attributes.position!); g.setAttribute('uv', base.attributes.uv!);
  const ip = new Float32Array(items.length * 4), is = new Float32Array(items.length * 2);
  items.forEach((it, i) => { ip.set([...it.p, it.s], i * 4); is.set([it.seed ?? i * 1.37, it.tint ?? 0], i * 2); });
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 4));
  g.setAttribute('iSeed', new THREE.InstancedBufferAttribute(is, 2));
  g.instanceCount = items.length;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 }, uLit: { value: o.lit }, uShade: { value: o.shade }, uSun: { value: o.sunDir }, uOpacity: { value: o.opacity ?? 1 },
      uEmis: { value: o.emissive ?? new THREE.Color(0, 0, 0) }, uDrift: { value: new THREE.Vector3(...(o.drift ?? [0, 0, 0])) },
      uSoft: { value: o.soft ?? 1 }, uSpin: { value: o.spin ?? 0.02 }, uNear: { value: o.nearFade ?? 9 }, ...fogUniforms(o.fog),
    },
    vertexShader: /* glsl */ `
      uniform float t, uSpin; uniform vec3 uDrift;
      attribute vec4 iPos; attribute vec2 iSeed;
      varying vec2 vUv; varying vec3 vWP; varying float vSeed; varying float vTint; varying vec3 vR; varying vec3 vU; varying vec3 vF;
      ${CLIP_V_PARS}
      void main() {
        vec3 c = iPos.xyz + uDrift * t;
        vec3 R = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 U = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float a = iSeed.x * 6.2831 + t * uSpin * (fract(iSeed.x * 7.1) - 0.5);
        vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
        vec3 wp = c + (R * q.x + U * q.y) * iPos.w;
        vUv = q; vWP = wp; vSeed = iSeed.x; vTint = iSeed.y; vR = R; vU = U; vF = normalize(cameraPosition - c);
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        ${CLIP_V}
      }`,
    fragmentShader: /* glsl */ `
      uniform float t, uOpacity, uSoft, uNear; uniform vec3 uLit, uShade, uSun, uEmis;
      varying vec2 vUv; varying vec3 vWP; varying float vSeed; varying float vTint; varying vec3 vR; varying vec3 vU; varying vec3 vF;
      ${GLSL_NOISE}
      ${FOG_GLSL}
      ${CLIP_F_PARS}
      void main() {
        ${CLIP_F}
        float d = length(vUv);
        float n = fbm(vec3(vUv * 1.6, vSeed * 3.7 + t * 0.03));
        float a = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.9 * uSoft);
        if (a < 0.003) discard;
        vec3 nrm = normalize(vR * vUv.x + vU * vUv.y + vF * sqrt(max(1.0 - d * d, 0.05)) + 0.6 * (n - 0.5) * vU);
        float l = clamp(dot(nrm, uSun) * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uShade, uLit, smoothstep(0.1, 0.95, l)) * (0.85 + 0.3 * n) + uEmis * (1.0 - d) * (0.6 + vTint);
        float cd = distance(cameraPosition, vWP);
        a *= smoothstep(uNear * 0.15, uNear, cd) * uOpacity;
        col = applyFog(col, vWP);
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  mat.clipping = true;
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------------------- misc helpers
/** A shader-surfaced mesh; `frag` must define `vec4 surface(vec3 wp, vec3 n, vec2 uv)` (premultiplied rgb + alpha). */
export function makeSurface(geo: THREE.BufferGeometry, frag: string, uniforms: Record<string, THREE.IUniform>, fog: FogSpec,
  opts: { transparent?: boolean; additive?: boolean; side?: THREE.Side; noFog?: boolean } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, ...fogUniforms(fog), ...uniforms },
    vertexShader: /* glsl */ `
      varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      ${CLIP_V_PARS}
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        ${CLIP_V}
      }`,
    fragmentShader: /* glsl */ `
      uniform float t; varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
      ${GLSL_NOISE}
      ${FOG_GLSL}
      ${CLIP_F_PARS}
      ${frag}
      void main() {
        ${CLIP_F}
        vec4 s = surface(vWP, normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), vUv);
        ${opts.noFog ? '' : 's.rgb = s.a > 0.0 ? applyFog(s.rgb / max(s.a, 1e-4), vWP) * s.a : s.rgb;'}
        gl_FragColor = vec4(s.rgb, ${opts.additive ? '0.0' : 's.a'});
      }`,
    transparent: !!(opts.transparent || opts.additive), side: opts.side ?? THREE.FrontSide,
    depthWrite: !(opts.transparent || opts.additive),
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor,
    blendDst: opts.additive ? THREE.OneFactor : opts.transparent ? THREE.OneMinusSrcAlphaFactor : THREE.ZeroFactor,
  });
  mat.clipping = true;
  return new THREE.Mesh(geo, mat);
}

export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], colors?: THREE.Color[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
  m.count = mats.length;
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  if (colors) colors.forEach((c, i) => m.setColorAt(i, c));
  m.instanceMatrix.needsUpdate = true;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export const mat4 = (p: V3, s: V3 | number = 1, rot: V3 = [0, 0, 0]) => {
  const sv = typeof s === 'number' ? [s, s, s] as V3 : s;
  return new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...sv));
};

/** Update every shader uniform named `t` in a subtree. */
export function setTime(root: THREE.Object3D, t: number) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
    if (m && (m as any).uniforms?.t) m.uniforms.t!.value = t;
  });
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    (o as THREE.DirectionalLight).shadow?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const x of mats) {
      for (const v of Object.values(x as any)) if (v instanceof THREE.Texture) v.dispose();
      x.dispose();
    }
  });
}

/** Standard PBR material with vertex colours and the shared height fog. */
export const pbr = (fog: FogSpec, p: THREE.MeshStandardMaterialParameters = {}) =>
  withFog(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...p }), fog);

/** CPU fbm in [-1,1]-ish over value noise. */
export function fbm2c(x: number, z: number, oct = 5, seed = 0) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f, seed + i * 13); f *= 2.03; a *= 0.5; }
  return s;
}
export const ridged = (x: number, z: number, oct = 5, seed = 0) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * f, z * f, seed + i * 7)); s += a * n * n; f *= 2.1; a *= 0.5; }
  return s;
};
export const sstep = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

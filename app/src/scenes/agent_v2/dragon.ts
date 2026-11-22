// The serpentine dragon: one straight Blender mesh (tail x=0 .. nose x~10.5, y up) bent along a path in the vertex
// shader. Each frame the path is sampled into a float texture of frames (P, T, N, B); the body follows the head.
import * as THREE from 'three';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import type { SceneCtx } from '../../engine/scene';

export type PathFn = (p: number, out: THREE.Vector3) => THREE.Vector3;
const NS = 256, LEN = 10.6;

const DEFORM_V = /* glsl */ `
uniform sampler2D uFr; uniform float uScale; uniform float uJaw;
varying vec3 vLoc;
vec3 dfr(float row, float u) {
  float x = clamp(u, 0.0, 1.0) * ${NS - 1}.0; float i = floor(x);
  vec3 a = texelFetch(uFr, ivec2(int(i), int(row)), 0).xyz;
  vec3 b = texelFetch(uFr, ivec2(int(min(i + 1.0, ${NS - 1}.0)), int(row)), 0).xyz;
  return mix(a, b, x - i);
}`;

export const JAW_HINGE = new THREE.Vector2(9.32, -0.04);
export function deform<M extends THREE.Material>(m: M, fr: THREE.DataTexture, scale: { value: number }, frag?: (s: THREE.WebGLProgramParametersWithUniforms) => void, jaw?: { value: number }): M {
  m.onBeforeCompile = (s) => {
    s.uniforms.uFr = { value: fr }; s.uniforms.uScale = scale; s.uniforms.uJaw = jaw ?? { value: 0 };
    const hx = JAW_HINGE.x.toFixed(2), hy = JAW_HINGE.y.toFixed(2), len = LEN.toFixed(2);
    const pre = `vec3 P0 = position, N0 = normal; { vec2 q = P0.xy - vec2(${hx}, ${hy}); float c = cos(-uJaw), sn = sin(-uJaw);
      P0.xy = vec2(${hx}, ${hy}) + mat2(c, sn, -sn, c) * q; N0.xy = mat2(c, sn, -sn, c) * N0.xy; }`;
    const hasN = s.vertexShader.includes('#include <beginnormal_vertex>');
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + DEFORM_V).replace('void main() {', 'void main() {\n' + pre);
    if (hasN) s.vertexShader = s.vertexShader.replace('#include <beginnormal_vertex>', `
      vec3 objectNormal; { float du = P0.x / ${len};
        objectNormal = normalize(normalize(dfr(1.0, du)) * N0.x + normalize(dfr(2.0, du)) * N0.y + normalize(dfr(3.0, du)) * N0.z); }`);
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `
      float du = P0.x / ${len}; vec3 dT = normalize(dfr(1.0, du)), dN = normalize(dfr(2.0, du)), dB = normalize(dfr(3.0, du));
      vec3 transformed = dfr(0.0, du) + (dN * P0.y + dB * P0.z + dT * max(P0.x - ${len}, 0.0)) * uScale; vLoc = P0;`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;');
    frag?.(s);
  };
  return m;
}

/** Scales: overlapping rows of rounded plates in body space (along x, around the barrel), darker in the seams. */
export const SEAM = { value: 0.8 };
const SCALE_GLSL = `uniform float uSeam;
float shash(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
// overlapping shingle scales in the body's local (length, angle) space: x = height, y = cell id, z = crease
vec3 scl(vec3 p) {
  float hd = smoothstep(9.1, 9.3, p.x); float ang = atan(p.z, p.y) / 6.28318;
  vec2 g = vec2(p.x * mix(26.0, 42.0, hd), ang * mix(56.0, 88.0, hd));
  vec2 c0 = floor(g); float h1 = 0.0, h2 = 0.0, id = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    vec2 c = c0 + vec2(float(i), float(j)); vec2 q = (g - c - vec2(0.5, 0.5 + 0.5 * mod(c.x, 2.0))) * vec2(1.0, 1.2);
    float h = clamp(1.0 - length(q) / 0.85, 0.0, 1.0) * (0.6 + 0.4 * clamp(0.5 - q.x, 0.0, 1.0));
    if (h > h1) { h2 = h1; h1 = h; id = shash(c); } else if (h > h2) h2 = h;
  }
  float fade = 1.0 - smoothstep(10.45, 10.7, p.x);
  return vec3(mix(0.7, h1, fade), id, fade * (1.0 - smoothstep(0.0, 0.07, h1 - h2)));
}`;
export function scaleFrag(s: THREE.WebGLProgramParametersWithUniforms) {
  s.uniforms.uSeam = SEAM;
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + SCALE_GLSL).replace('#include <color_fragment>', `#include <color_fragment>
    vec3 sc_ = scl(vLoc);
    { float belly = smoothstep(-0.1, -0.24, vLoc.y) * (1.0 - smoothstep(9.0, 9.3, vLoc.x));
      float lf_ = 0.5 + 0.5 * sin(vLoc.x * 1.7 + 2.0 * sin(vLoc.x * 0.43) + vLoc.z * 2.0); float dor_ = smoothstep(0.0, 0.3, vLoc.y);
      diffuseColor.rgb *= mix(0.45, 1.0, sc_.x) * (0.8 + 0.4 * sc_.y) * (1.0 - 0.75 * sc_.z) * (0.7 + 0.55 * lf_) * mix(1.0, 0.7, dor_);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.25, 0.16) * (0.7 + 0.3 * sc_.x), belly * 0.8); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    totalEmissiveRadiance += sc_.z * uSeam * vec3(1.0, 0.28, 0.05) * (0.3 + 0.7 * smoothstep(-0.1, 0.3, vLoc.y));`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
    roughnessFactor = mix(0.7, roughnessFactor, sc_.x);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
    { float hgt = sc_.x * 0.02; vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition); float hx = dFdx(hgt), hy = dFdy(hgt);
      vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
      normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2)); }`);
}

export class Dragon {
  readonly group = new THREE.Group();
  readonly frames: THREE.DataTexture;
  readonly scale = { value: 1 };
  readonly mats: THREE.Material[] = [];
  private data = new Float32Array(NS * 4 * 4);
  private P: THREE.Vector3[] = Array.from({ length: NS }, () => new THREE.Vector3());

  constructor() {
    this.frames = new THREE.DataTexture(this.data, NS, 4, THREE.RGBAFormat, THREE.FloatType);
    this.frames.needsUpdate = true;
  }

  async load(ctx: SceneCtx, make: (name: string, mesh: string) => THREE.Material) {
    const inst = await GLTFManager.instantiate(resolveAsset('dragon', ctx.project ?? 'agent_v2').url, {});
    inst.root.updateMatrixWorld(true);
    inst.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const mat = make((m.material as THREE.Material).name, m.name || m.parent?.name || "");
      this.mats.push(mat);
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.name = m.name;
      this.group.add(mesh);
    });
  }

  /** Lay the body along path(head - (1-u) * len * scale) for u in 0..1 (tail..nose). */
  pose(path: PathFn, head: number, len = LEN) {
    const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (let i = 0; i < NS; i++) path(head - (1 - i / (NS - 1)) * len * this.scale.value, this.P[i]!);
    const d = this.data;
    for (let i = 0; i < NS; i++) {
      const a = this.P[Math.max(0, i - 1)]!, b = this.P[Math.min(NS - 1, i + 1)]!;
      T.subVectors(b, a).normalize();
      N.copy(up).addScaledVector(T, -up.dot(T)); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
      B.crossVectors(T, N);
      const p = this.P[i]!;
      d.set([p.x, p.y, p.z, 1], (0 * NS + i) * 4); d.set([T.x, T.y, T.z, 0], (1 * NS + i) * 4);
      d.set([N.x, N.y, N.z, 0], (2 * NS + i) * 4); d.set([-B.x, -B.y, -B.z, 0], (3 * NS + i) * 4);
    }
    this.frames.needsUpdate = true;
  }

  dispose() { this.frames.dispose(); for (const m of this.mats) m.dispose(); this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
}

// Procedural materials (no textures): strip-lit brushed metal / ridged knob / rubber, and a
// barycentric CAD wireframe-solid with a world-space noise dissolve front.
import * as THREE from 'three';
import { LIN, GLOW } from './palette';

const bone = new THREE.Vector3(...LIN.bone);
const red = new THREE.Vector3(...GLOW.signal);

export interface LitUniforms {
  uKey: { value: number };
  uSweep: { value: number };
  uRim: { value: number };
}

/** One strip key light from the upper left (a sweeping highlight band) plus a thin rim from behind. */
export function litMaterial(o: { base: number; brushed?: number; ridge?: number; ridgeF?: number; metal?: number; emissive?: THREE.Vector3 }): THREE.ShaderMaterial & { uniforms: LitUniforms & Record<string, THREE.IUniform> } {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uBase: { value: bone.clone().multiplyScalar(o.base) },
      uKey: { value: 0 },
      uSweep: { value: 0 },
      uRim: { value: 0 },
      uBrushed: { value: o.brushed ?? 0 },
      uRidge: { value: o.ridge ?? 0 },
      uRidgeF: { value: o.ridgeF ?? 1500 },
      uMetal: { value: o.metal ?? 0.5 },
      uEmis: { value: o.emissive ?? new THREE.Vector3() },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      out vec3 vWP; out vec3 vN; out vec3 vL;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vWP; in vec3 vN; in vec3 vL;
      uniform vec3 uBase; uniform float uKey, uSweep, uRim, uBrushed, uRidge, uRidgeF, uMetal; uniform vec3 uEmis;
      out vec4 fragColor;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWP);
        // anisotropic noise: stretched ~60:1 along x
        float n = mix(vnoise(vec2(vWP.x * 55.0, vWP.y * 5200.0)), vnoise(vec2(vWP.x * 190.0, vWP.y * 11000.0)), 0.5);
        vec3 Np = normalize(N + uBrushed * vec3(0.0, (n - 0.5) * 0.5, 0.0));
        // grip ridges: sine displacement of the normal across the knob top
        float ridge = cos(vL.x * uRidgeF) * uRidge * step(0.6, N.z);
        Np = normalize(Np + vec3(ridge * 0.9, 0.0, 0.0));
        vec3 L = normalize(vec3(-0.55, 0.65, 0.75));
        vec3 H = normalize(L + V);
        float band = exp(-pow((vWP.x - uSweep) / 0.024, 2.0));
        float key = uKey * (0.10 + 0.95 * band);
        float diff = max(dot(Np, L), 0.0);
        float tx = H.x;
        float aniso = pow(sqrt(max(0.0, 1.0 - tx * tx)), mix(40.0, 160.0, band));
        float sp = pow(max(dot(Np, H), 0.0), 18.0) * 0.35 + aniso * 0.9;
        vec3 col = uBase * (0.03 + 0.95 * key * diff) + vec3(0.92, 0.90, 0.86) * sp * key * uMetal * (0.65 + 0.35 * n);
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col += uBase * fr * uRim * (0.4 + 0.6 * smoothstep(-0.2, 0.9, -N.z + 0.7 * N.y));
        col += uEmis;
        fragColor = vec4(col, 1.0);
      }`,
  });
  return m as any;
}

/** Add `bary` + `hid` attributes: hid hides triangulation diagonals (edges between near-coplanar faces). */
export function withBary(src: THREE.BufferGeometry, hideCos = 0.77): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nTri = pos.count / 3;
  const nrm: THREE.Vector3[] = [];
  const key = (i: number) => `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
  const edges = new Map<string, number[]>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    nrm.push(new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize());
    for (let e = 0; e < 3; e++) {
      const k0 = key(t * 3 + ((e + 1) % 3)), k1 = key(t * 3 + ((e + 2) % 3));
      const ek = k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`;
      const l = edges.get(ek); if (l) l.push(t); else edges.set(ek, [t]);
    }
  }
  const bary = new Float32Array(pos.count * 3), hid = new Float32Array(pos.count * 3);
  for (let t = 0; t < nTri; t++) {
    for (let e = 0; e < 3; e++) {
      const k0 = key(t * 3 + ((e + 1) % 3)), k1 = key(t * 3 + ((e + 2) % 3));
      const l = edges.get(k0 < k1 ? `${k0}|${k1}` : `${k1}|${k0}`)!;
      let hide = 0;
      if (l.length >= 2) { for (const o of l) if (o !== t && nrm[o]!.dot(nrm[t]!) > hideCos) hide = 1; }
      for (let v = 0; v < 3; v++) hid[(t * 3 + v) * 3 + e] = hide;
    }
    for (let v = 0; v < 3; v++) bary[(t * 3 + v) * 3 + v] = 1;
  }
  g.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
  g.setAttribute('hid', new THREE.BufferAttribute(hid, 3));
  g.computeVertexNormals();
  return g;
}

export interface WireUniforms { uFront: { value: number }; uRedMix: { value: number }; uDim: { value: number }; uKeep: { value: number }; uFade: { value: number }; uSolid: { value: number } }

/**
 * Solid --bone surface with barycentric edge glow and a world-space dissolve front (sweeps along -x,
 * noise-thresholded per fragment). Behind the front: solid fades to wireframe, wireframe resolves to
 * flat line art (z collapses). uKeep=1 parts persist as line art (the glyph); uKeep=0 parts vanish.
 */
export function wireSolidMaterial(o: { solid?: number; keep?: number; red?: boolean } = {}): THREE.ShaderMaterial & { uniforms: WireUniforms & Record<string, THREE.IUniform> } {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uBone: { value: new THREE.Vector3(...GLOW.bone) },
      uRed: { value: red.clone() },
      uSolid: { value: o.solid ?? 1 },
      uFront: { value: 10 }, uRedMix: { value: o.red ? 1 : 0 }, uDim: { value: 0 }, uKeep: { value: o.keep ?? 0 }, uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      in vec3 bary; in vec3 hid;
      out vec3 vB; out vec3 vH; out vec3 vWP; out vec3 vN; out float vX0;
      uniform float uFront;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vX0 = wp.x;
        float flat1 = smoothstep(0.03, 0.10, wp.x - uFront);
        wp.z *= 1.0 - flat1;
        vWP = wp.xyz; vB = bary; vH = hid; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      in vec3 vB; in vec3 vH; in vec3 vWP; in vec3 vN; in float vX0;
      uniform vec3 uBone, uRed; uniform float uSolid, uRedMix, uDim, uFade, uKeep, uFront;
      out vec4 fragColor;
      float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h12(i), h12(i + vec2(1, 0)), f.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 b = vB + vH * 10.0;
        vec3 d3 = fwidth(b);
        vec3 a3 = smoothstep(d3 * 0.6, d3 * 1.9, b);
        float edge = 1.0 - min(min(a3.x, a3.y), a3.z);
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        float lam = 0.5 + 0.5 * dot(N, normalize(vec3(-0.5, 0.7, 0.6)));
        float nz = vnoise(vWP.xy * 160.0) * 0.6 + vnoise(vWP.xy * 420.0) * 0.4;
        float d = vX0 - uFront + (nz - 0.5) * 0.045;
        float solidA = 1.0 - smoothstep(0.0, 0.03, d);
        float wireA = mix(1.0 - smoothstep(0.07, 0.17, d), 1.0, uKeep);
        vec3 tint = mix(uBone, uRed, uRedMix);
        float rim = pow(1.0 - abs(N.z), 2.0);
        vec3 col = tint * (0.05 + 0.17 * lam + 0.25 * rim) * uSolid * solidA;
        col += tint * edge * 1.5 * wireA;
        float fe = exp(-pow(d / 0.0045, 2.0)) * step(-0.012, d) * step(d, 0.25) * (1.0 - step(9.0, uFront));
        col += uBone * fe * 1.5 * (0.4 + 0.6 * edge);
        float g = dot(col, vec3(0.34, 0.33, 0.33));
        col = mix(col, vec3(g), uDim * 0.7 * (1.0 - uRedMix)) * mix(1.0, 0.6, uDim * (1.0 - uRedMix));
        float vis = mix(1.0, smoothstep(0.17, 0.07, d), 1.0 - uKeep);
        if (uKeep < 0.5 && vis < 0.01) discard;
        fragColor = vec4(col * uFade * max(vis, uKeep), 1.0);
      }`,
  });
  return m as any;
}

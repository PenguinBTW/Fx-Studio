// The human figure: 20,000 --bone points sampled analytically from a seeded skeleton
// (ellipsoid head and torso, capsule legs, a reaching arm). Static attribute buffers are built
// once; pose, drift, shimmer and the 4% "leak" are closed-form functions of t in the vertex shader.
import * as THREE from 'three';
import { mulberry32 } from '../../engine/util';
import { GLOW } from './palette';

export const N_PARTICLES = 20000;
export const LEAK_FRAC = 0.04;

type Part = { w: number; sample: (r: () => number) => [number, number] };

const ell = (cx: number, cy: number, rx: number, ry: number) => (r: () => number): [number, number] => {
  const a = r() * Math.PI * 2, d = Math.sqrt(r());
  return [cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d];
};
const cap = (ax: number, ay: number, bx: number, by: number, rad: number) => (r: () => number): [number, number] => {
  const s = r(), a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad;
  return [ax + (bx - ax) * s + Math.cos(a) * d, ay + (by - ay) * s + Math.sin(a) * d];
};

/** Figure units: ring-centre relative px at ring close-up; y up; facing right. Height ~ 360 px. */
export const SHOULDER: [number, number] = [8, 78];
export const ARM_LEN = 168;

export class HumanFigure {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;

  constructor() {
    const rnd = mulberry32(0x1f0c4);
    const parts: Part[] = [
      { w: 2.4, sample: ell(0, 118, 30, 38) },            // head
      { w: 1.9, sample: cap(-2, 96, 0, 78, 11) },          // neck
      { w: 9.0, sample: ell(-4, 30, 44, 78) },             // torso
      { w: 3.4, sample: cap(-16, -34, -26, -128, 22) },    // back leg
      { w: 3.4, sample: cap(12, -34, 30, -128, 22) },      // front leg
      { w: 2.2, sample: cap(-26, 66, -44, -22, 13) },      // idle arm (hangs back)
    ];
    const armW = 4.6;
    const totalW = parts.reduce((s, p) => s + p.w, 0) + armW;
    const pos = new Float32Array(N_PARTICLES * 3);   // x, y, arm s (-1 when not arm)
    const aux = new Float32Array(N_PARTICLES * 4);   // seed, perp offset, leak flag, size
    for (let i = 0; i < N_PARTICLES; i++) {
      let pick = rnd() * totalW;
      let x = 0, y = 0, s = -1, off = 0;
      let done = false;
      for (const p of parts) {
        if (pick < p.w) { [x, y] = p.sample(rnd); done = true; break; }
        pick -= p.w;
      }
      if (!done) { s = rnd(); off = (rnd() * 2 - 1) * (11 - 5 * s) * Math.sqrt(rnd()); }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = s;
      aux[i * 4] = rnd();
      aux[i * 4 + 1] = off;
      aux[i * 4 + 3] = 0.7 + 0.6 * rnd();
    }
    // leak set: the ~4% of the particles nearest the hand (largest arm s)
    const arm: { i: number; s: number }[] = [];
    for (let i = 0; i < N_PARTICLES; i++) if (pos[i * 3 + 2]! >= 0) arm.push({ i, s: pos[i * 3 + 2]! });
    arm.sort((a, b) => b.s - a.s);
    for (let k = 0; k < Math.min(arm.length, Math.round(N_PARTICLES * LEAK_FRAC)); k++) aux[arm[k]!.i * 4 + 2] = 1;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aux', new THREE.BufferAttribute(aux, 4));
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 0 }, uC: { value: new THREE.Vector2(700, 540) }, uK: { value: 1 }, uAlpha: { value: 0 },
        uReach: { value: 0 }, uLeakT: { value: 99 }, uBone: { value: new THREE.Vector3(...GLOW.bone) }, uPx: { value: 1 },
      },
      vertexShader: /* glsl */ `
        precision highp float;
        in vec4 aux;
        uniform float uT, uK, uAlpha, uReach, uLeakT, uPx; uniform vec2 uC;
        out float vA;
        void main() {
          float seed = aux.x;
          vec2 p = position.xy;
          float s = position.z;
          if (s >= 0.0) {
            // the arm swings from hanging to extended toward the lever
            float ang = mix(-1.15, 0.0, uReach);
            vec2 dir = vec2(cos(ang), sin(ang));
            vec2 prp = vec2(-dir.y, dir.x);
            p = vec2(8.0, 78.0) + dir * (s * 168.0) + prp * aux.y;
          }
          // idle drift: slow, layered sine fields (a breathing cloud, never static)
          float ph = seed * 6.2831;
          p += vec2(sin(uT * 0.7 + ph * 3.0 + p.y * 0.04), cos(uT * 0.55 + ph * 2.0 + p.x * 0.05)) * 2.4;
          p.y += sin(uT * 0.9) * 1.2;
          // leak: peel off the hand and drift away after impact
          float lt = uT - uLeakT;
          float leak = 0.0;
          if (aux.z > 0.5 && lt > 0.0) {
            float h1 = fract(seed * 91.7), h2 = fract(seed * 37.3);
            vec2 v = vec2(70.0 + 160.0 * h1, 60.0 * (h2 - 0.35));
            p += v * lt * (1.0 - 0.18 * lt) + vec2(0.0, 12.0 * lt * lt);
            leak = smoothstep(2.4, 0.0, lt * (0.6 + h1));
          }
          float shimmer = 0.62 + 0.38 * sin(uT * (1.6 + 2.0 * seed) + ph * 5.0);
          vA = shimmer * (aux.z > 0.5 && lt > 0.0 ? leak : 1.0) * uAlpha;
          vec2 px = uC + vec2(p.x, -p.y) * uK;
          gl_Position = vec4(px.x / 960.0 - 1.0, 1.0 - px.y / 540.0, 0.0, 1.0);
          gl_PointSize = max(1.2, 2.3 * aux.w * uK) * uPx;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        in float vA; uniform vec3 uBone; out vec4 fragColor;
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float d = 1.0 - smoothstep(0.15, 0.5, length(q));
          fragColor = vec4(uBone * 0.55 * d * vA, d * vA);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }

  /** Hand position (screen px, y down) for a given ring-centre c, scale k and reach 0..1. */
  hand(cx: number, cy: number, k: number, reach: number): [number, number] {
    const ang = -1.15 + 1.15 * reach;
    return [cx + (SHOULDER[0] + Math.cos(ang) * ARM_LEN) * k, cy - (SHOULDER[1] + Math.sin(ang) * ARM_LEN) * k];
  }

  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

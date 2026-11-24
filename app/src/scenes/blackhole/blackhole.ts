// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene: 'blackhole' — a lensed accretion disk: dark sphere silhouetting a
// warped ring of hot plasma. Analytic fake for the warp (no raytracer):
// the disk's far side is bent over/under the sphere via deformed ring arcs,
// doppler-hot blue-white on the approaching side, dim amber receding.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';
import type { Frame } from '../../engine/scene';

function smooth01(x: number): number {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
}

// camera: slow approach + dip that reveals the warp late
function camPos(t: number): [number, number, number] {
  const p = smooth01((t - 14) / 6);
  return [1.2 * Math.sin(0.05 * t), 5.5 - 2.6 * p + 0.3 * Math.sin(0.07 * t + 2.0), 26 - 0.45 * t];
}
function camTarget(t: number): [number, number, number] {
  return [0.4 * Math.sin(0.04 * t + 1.0), -0.5, 0];
}

// --- disk / arcs shader: azimuthal fbm streaks, doppler gradient ------------
// attributes: aRad (0..1 across the band), aAng (radians around the ring)
const DISK_VERT = /* glsl */ `
attribute float aRad;
attribute float aAng;
varying float vRad;
varying float vAng;
varying float vX;   // world x → doppler side
varying float vExt; // radial extent for side normalization
uniform float uT;
uniform float uWobble;
void main() {
  vRad = aRad;
  vAng = aAng;
  vX = position.x;
  vExt = length(position.xz);
  vec3 pos = position;
  pos.y += uWobble * sin(aAng * 5.0 + uT * 0.5) * 0.15;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const DISK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying float vRad;
varying float vAng;
varying float vX;
varying float vExt;
uniform float uT;
uniform float uBright;
uniform float uGhost;   // dimmer factor for the under-arc
uniform float uInnerR;  // ring inner radius (world units)
uniform float uOuterR;

void main() {
  float r = mix(uInnerR, uOuterR, vRad);
  // differential rotation: inner edge orbits faster — streaks shear over time
  float ang = vAng - uT * (0.55 + 2.2 / (0.6 + r * 0.55));
  // stretched azimuthal fbm = circular plasma streaks
  float n = fbm3(vec3(cos(ang) * 3.5, sin(ang) * 3.5, vRad * 5.0 - uT * 0.15), 4, 2.05, 0.55);
  float n2 = fbm3(vec3(cos(ang) * 9.0, sin(ang) * 9.0, vRad * 11.0 + 3.0), 3, 2.1, 0.5);
  float d = sat(n * 0.75 + n2 * 0.4 + 0.2);

  // temperature: hotter (brighter) toward inner edge
  float temp = 1.0 - vRad;
  temp = temp * temp * (0.55 + 0.45 * d);
  // soft band edges
  float edge = smoothstep(0.0, 0.12, vRad) * (1.0 - smoothstep(0.85, 1.0, vRad));

  // doppler beaming: +x side approaches (blue-white, brighter), −x recedes
  float dop = vX / max(0.001, vExt);
  float boost = 1.0 + 1.4 * dop;

  vec3 hot = vec3(0.62, 0.78, 1.0);   // blue-white
  vec3 mid = vec3(1.0, 0.55, 0.18);   // amber
  vec3 tint = mix(mid, hot, sat(dop * 0.5 + 0.5));
  vec3 col = tint * (0.5 + 0.5 * d);
  // inner-edge plasma burns near-white regardless of side
  col += vec3(1.0, 0.93, 0.8) * pow(temp, 2.5) * 0.55;

  float a = edge * sat(d * 1.6) * (0.3 + temp) * boost * uBright * uGhost;
  gl_FragColor = vec4(col * a, a);
}
`;

// --- photon ring: thin fresnel edge on the black sphere ----------------------
const RING_VERT = /* glsl */ `
varying vec3 vNrm;
varying vec3 vView;
void main() {
  vNrm = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const RING_FRAG = /* glsl */ `
${GLSL_COMMON}
varying vec3 vNrm;
varying vec3 vView;
uniform float uBright;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vNrm), normalize(vView))), 9.0);
  vec3 col = vec3(1.0, 0.9, 0.7) * f * 2.2 * uBright;
  gl_FragColor = vec4(col, f * uBright);
}
`;

// --- star points, bent toward the lens axis near the silhouette --------------
const STAR_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
varying float vA;
void main() {
  vec3 p = position;
  // pull stars near the y-axis limb inward — cheap lens distortion
  float r = length(p.xy);
  p.xy *= 1.0 - 0.10 * exp(-(r * r) / 90.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = 0.4 + 0.6 * sin(uT * (0.7 + 1.8 * fract(aSeed * 7.0)) + aSeed * 50.0);
  gl_PointSize = min(1.5 * 240.0 / max(1.0, -mv.z), 4.5);
  gl_Position = projectionMatrix * mv;
}
`;
const STAR_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.72, 0.8, 1.0) * a, a);
}
`;

interface BhState {
  diskMats: THREE.ShaderMaterial[];
  ringMat: THREE.ShaderMaterial;
  starMat: THREE.ShaderMaterial;
}
// Per-SceneContext state: each project entry instantiates its own scene.
const bhStates = new WeakMap<SceneContext, BhState>();

// build a ring band; warp bends the far half up (warp>0) or down (warp<0)
function buildArc(
  innerR: number, outerR: number, segs: number, warp: number,
): THREE.BufferGeometry {
  const rows = 6;
  const pos = new Float32Array((segs + 1) * rows * 3);
  const aRad = new Float32Array((segs + 1) * rows);
  const aAng = new Float32Array((segs + 1) * rows);
  let k = 0;
  for (let i = 0; i <= segs; i++) {
    const ang = (i / segs) * Math.PI * 2;
    // far side is the −z half (camera at +z): bend there
    const far = Math.exp(-Math.pow((Math.cos(ang) + 1.0) / 0.42, 2)); // tight around ang=π (−z)
    for (let j = 0; j < rows; j++) {
      const t = j / (rows - 1);
      const r = innerR + (outerR - innerR) * t;
      pos[k * 3] = Math.cos(ang) * r;
      pos[k * 3 + 1] = warp * far * (1.2 + t * 0.8);
      pos[k * 3 + 2] = Math.sin(ang) * r * (1.0 - 0.35 * Math.abs(warp) * far * 0.1);
      aRad[k] = t;
      aAng[k] = ang;
      k++;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < rows - 1; j++) {
      const a = i * rows + j, b = a + rows;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRad', new THREE.BufferAttribute(aRad, 1));
  g.setAttribute('aAng', new THREE.BufferAttribute(aAng, 1));
  g.setIndex(idx);
  return g;
}

function diskMat(uniforms: Record<string, number>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uT: { value: 0 },
      uWobble: { value: 0 },
      uBright: { value: 0.6 },
      uGhost: { value: uniforms.uGhost ?? 1 },
      uInnerR: { value: uniforms.uInnerR },
      uOuterR: { value: uniforms.uOuterR },
    },
  });
}

export default defineScene({
  id: 'blackhole/lens',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x010204);

    // event horizon silhouette + photon ring
    const hole = new THREE.Mesh(
      new THREE.SphereGeometry(3.0, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    hole.renderOrder = 4;
    sc.add(hole);
    const ringMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uBright: { value: 0.7 } },
    });
    const photon = new THREE.Mesh(new THREE.SphereGeometry(3.06, 64, 48), ringMat);
    photon.renderOrder = 5;
    sc.add(photon);

    const diskMats: THREE.ShaderMaterial[] = [];

    // main disk: ring in x-z plane, tilted ~12° toward camera
    const diskGeo = buildArc(3.6, 12.5, 220, 0);
    const dMat = diskMat({ uInnerR: 3.6, uOuterR: 12.5, uGhost: 1.0 });
    const disk = new THREE.Mesh(diskGeo, dMat);
    disk.rotation.x = 0.21; // tilt toward camera
    disk.renderOrder = 3;
    sc.add(disk);
    diskMats.push(dMat);

    // upper arc: far side bent over the top of the sphere
    const upGeo = buildArc(3.9, 10.5, 220, 5.0);
    const uMat = diskMat({ uInnerR: 3.9, uOuterR: 10.5, uGhost: 1.0 });
    const upArc = new THREE.Mesh(upGeo, uMat);
    upArc.rotation.x = 0.21;
    upArc.renderOrder = 6;
    sc.add(upArc);
    diskMats.push(uMat);

    // under-arc ghost: dimmer arc beneath the sphere
    const loGeo = buildArc(3.8, 9.0, 200, -3.2);
    const lMat = diskMat({ uInnerR: 3.8, uOuterR: 9.0, uGhost: 0.4 });
    const loArc = new THREE.Mesh(loGeo, lMat);
    loArc.rotation.x = 0.21;
    loArc.renderOrder = 2;
    sc.add(loArc);
    diskMats.push(lMat);

    // star field behind the hole
    const NS = 900;
    const sp = new Float32Array(NS * 3);
    const ss = new Float32Array(NS);
    const rng = mulberry32(4242);
    for (let i = 0; i < NS; i++) {
      ss[i] = rng();
      sp[i * 3] = (rng() - 0.5) * 170;
      sp[i * 3 + 1] = (rng() - 0.5) * 110;
      sp[i * 3 + 2] = -45 - rng() * 80;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starGeo.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.renderOrder = 1;
    sc.add(stars);

    ctx.rig.setLensMm(48);
    // seed the rig so non-rendering samplers see the path
    ctx.rig.position = camPos(0);
    ctx.rig.target = camTarget(0);
    ctx.updateCamera(0, 0);
    bhStates.set(ctx, { diskMats, ringMat, starMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const bright = 0.55 + 0.75 * smooth01((t - 5) / 5);  // disk brightens ~t5→10
    const reveal = smooth01((t - 14) / 6);              // warp reveal ~t14→20

    const S = bhStates.get(ctx)!;
    for (const m of S.diskMats) {
      m.uniforms.uT.value = t;
      m.uniforms.uBright.value = bright * (1.0 + reveal * 0.25);
    }
    S.ringMat.uniforms.uBright.value = 0.5 + bright * 0.7;
    S.starMat.uniforms.uT.value = t;

    ctx.rig.position = camPos(t);
    ctx.rig.target = camTarget(t);
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// hummingbird — a hummingbird feeding on trumpet flowers at dawn, macro
// garden shot. A drooping vine (TubeGeometry on a Catmull-Rom spline) bears
// 8 seeded lathe trumpet blooms with coral gradient lips and leaf cards;
// a deep-green bokeh backdrop plane carries dawn shafts and dust motes.
// The bird is a small mesh group (body, beak, tail fan, additive wing-blur
// arc sectors, folding perch wings) riding a piecewise closed-form
// schedule: dart → hover (Lissajous jitter + sip dips into the corolla) →
// dart across four blooms, a jostle beat that shakes dew drops off a
// bloom, a preening perch on a twig, and an exit dart. A bee orbits the
// cluster and flees on the entry dart; dew glints sparkle on leaf edges.
// All closed-form f(t), hash seeds, no sim.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

// ---- world layout ---------------------------------------------------------
const rng = mulberry32(71173);
const VINE_PTS: [number, number, number][] = [
  [-5.0, 4.4, -2.6],
  [-2.5, 4.0, -2.2],
  [0.2, 3.6, -2.8],
  [2.6, 3.0, -2.2],
  [4.8, 2.6, -2.6],
];
const CLUSTER = new THREE.Vector3(0.4, 2.5, -2.2);   // establishing anchor
const PERCH = new THREE.Vector3(-2.9, 0.85, -0.4);   // twig perch
const ENTER = new THREE.Vector3(7.6, 4.8, 1.5);      // entry dart start
const EXIT = new THREE.Vector3(-9.0, 5.4, 1.0);      // exit dart end
const BEE_FLEE_T = 4.2;                              // bee flees on entry dart
const JOSTLE_T = 10.75;                              // arrival jostle on bloom C

// feeding chain: which bloom indices the bird visits, in order
const CHAIN = [6, 4, 2, 0];

// piecewise bird schedule — kinds: dart | hover | perch
type SegKind = 'dart' | 'hover' | 'perch';
const SEGS: { t0: number; t1: number; kind: SegKind; to?: number }[] = [
  { t0: 3.5, t1: 4.3, kind: 'dart', to: 0 },        // ENTER → site 0
  { t0: 4.3, t1: 7.2, kind: 'hover', to: 0 },
  { t0: 7.2, t1: 7.8, kind: 'dart', to: 1 },
  { t0: 7.8, t1: 10.2, kind: 'hover', to: 1 },
  { t0: 10.2, t1: 10.8, kind: 'dart', to: 2 },      // jostle on arrival
  { t0: 10.8, t1: 13.2, kind: 'hover', to: 2 },
  { t0: 13.2, t1: 13.8, kind: 'dart', to: 3 },
  { t0: 13.8, t1: 16.2, kind: 'hover', to: 3 },
  { t0: 16.2, t1: 17.0, kind: 'dart', to: -1 },     // to perch
  { t0: 17.0, t1: 20.6, kind: 'perch' },
  { t0: 20.6, t1: 21.4, kind: 'dart', to: -2 },     // exit
];
const GONE_T = 21.4;

const smooth01 = (x: number) => { const s = Math.min(1, Math.max(0, x)); return s * s * (3 - 2 * s); };
const gauss = (t: number, c: number, w: number) => Math.exp(-(t - c) * (t - c) / (2 * w * w));

// ---- bird closed-form motion ---------------------------------------------
// hover site = bloom mouth + outward direction; sip dips toward the mouth.
interface BirdState {
  pos: THREE.Vector3; vel: THREE.Vector3;
  pitch: number; yaw: number; wingOpen: number; tailFan: number; throat: number;
}

function dartPos(from: THREE.Vector3, to: THREE.Vector3, p: number, out: THREE.Vector3) {
  const s = smooth01(p);
  out.lerpVectors(from, to, s);
  // bow the path perpendicular in xz + a slight dip so darts read as arcs
  const dx = to.x - from.x, dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  out.x += (-dz / len) * Math.sin(Math.PI * s) * 0.5;
  out.z += (dx / len) * Math.sin(Math.PI * s) * 0.5;
  out.y += Math.sin(Math.PI * s) * 0.28 * Math.min(1, len * 0.4);
}

export function birdAt(t: number, sites: THREE.Vector3[], mouths: THREE.Vector3[], st: BirdState) {
  const seg = SEGS.find(s => t >= s.t0 && t < s.t1) ?? SEGS[SEGS.length - 1]!;
  const p = Math.min(1, Math.max(0, (t - seg.t0) / (seg.t1 - seg.t0)));
  const siteOf = (k: number) => (k === -1 ? PERCH : k === -2 ? EXIT : sites[k]!);
  const prevSeg = SEGS[SEGS.indexOf(seg) - 1];
  const nextSeg = SEGS[SEGS.indexOf(seg) + 1];
  const from = prevSeg ? siteOf(prevSeg.to ?? 0) : ENTER;
  const to = seg.to === -2 ? EXIT : siteOf(seg.to ?? 0);

  if (seg.kind === 'dart') {
    dartPos(from, to, p, st.pos);
    const eps = 0.03;
    const tmp = new THREE.Vector3();
    dartPos(from, to, Math.min(1, p + eps / (seg.t1 - seg.t0)), tmp);
    st.vel.subVectors(tmp, st.pos);
    st.yaw = Math.atan2(-st.vel.x, -st.vel.z);
    st.pitch = 0.18;
    st.wingOpen = 1;
    // tail fan splays on the braking half of the dart
    st.tailFan = 0.35 + 0.65 * smooth01((p - 0.6) / 0.4);
    st.throat = 0;
  } else if (seg.kind === 'hover') {
    const site = siteOf(seg.to ?? 0);
    st.pos.copy(site);
    st.pos.x += 0.035 * Math.sin(t * 8.1) + 0.02 * Math.sin(t * 13.7);
    st.pos.y += 0.025 * Math.sin(t * 11.3 + 1.7);
    st.pos.z += 0.03 * Math.sin(t * 9.4 + 0.9);
    // sip dips: repeated pulses driving the beak toward the corolla
    const mouth = mouths[seg.to ?? 0];
    let throat = 0;
    if (mouth) {
      const dipDir = new THREE.Vector3().subVectors(mouth, site).normalize();
      for (let k = 0; k < 3; k++) {
        const sT = seg.t0 + 0.7 + k * 1.4;
        const w = gauss(t, sT, 0.16);
        st.pos.addScaledVector(dipDir, w * 0.42 * site.distanceTo(mouth));
        throat += w;
      }
    }
    st.vel.set(0, 0, 0);
    st.yaw = mouth ? Math.atan2(-(mouth.x - site.x), -(mouth.z - site.z)) : 2.6;
    st.pitch = 0.72 + 0.08 * Math.sin(t * 1.3);
    st.wingOpen = 1;
    st.tailFan = 0.3;
    st.throat = throat;
  } else {
    // perch: sit on the twig, breathing; preen flicks handled by caller
    st.pos.copy(PERCH);
    st.pos.y += 0.008 * Math.sin(t * 4.2);
    st.vel.set(0, 0, 0);
    st.yaw = -0.9;                       // faces back toward the cluster
    st.pitch = 0.10;
    st.wingOpen = Math.max(0, 1 - (t - seg.t0) / 0.45);
    st.tailFan = 0.15;
    st.throat = 0;
  }
}

// camera anchor track: the rig eases to each site just before the bird lands
const ANCH: { t: number; p: THREE.Vector3; o: THREE.Vector3 }[] = [
  { t: -1, p: CLUSTER, o: new THREE.Vector3(1.0, 0.6, 6.4) },
  { t: 3.8, p: new THREE.Vector3(), o: new THREE.Vector3(1.5, 0.5, 5.4) }, // site 0 (bound in setup)
  { t: 7.3, p: new THREE.Vector3(), o: new THREE.Vector3(1.35, 0.5, 5.2) },
  { t: 10.3, p: new THREE.Vector3(), o: new THREE.Vector3(1.4, 0.5, 5.3) },
  { t: 13.4, p: new THREE.Vector3(), o: new THREE.Vector3(1.4, 0.45, 5.2) },
  { t: 16.4, p: PERCH, o: new THREE.Vector3(1.6, 0.6, 5.2) },
  { t: 20.7, p: CLUSTER, o: new THREE.Vector3(1.1, 0.7, 6.6) },
];

function anchorAt(t: number, pos: THREE.Vector3, off: THREE.Vector3) {
  let i = 0;
  for (let k = 0; k < ANCH.length; k++) if (t >= ANCH[k]!.t) i = k;
  const cur = ANCH[i]!;
  const blendT = cur.t - 0.8;
  const w = i === 0 ? 1 : smooth01((t - blendT) / 1.0);
  const prev = ANCH[Math.max(0, i - 1)]!;
  pos.lerpVectors(prev.p, cur.p, w);
  off.lerpVectors(prev.o, cur.o, w);
}

// ---- shaders ---------------------------------------------------------------
const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// backdrop: deep-green bokeh wall + dawn shafts + dust motes
const BACK_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uDawn;
float hashg(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
void main() {
  vec2 q = vUv;
  // deep foliage gradient with organic darkening
  vec3 col = mix(vec3(0.018, 0.045, 0.028), vec3(0.045, 0.095, 0.055), q.y);
  float fol = nzSimplex(vec3(q * 4.0, 0.35)) * 0.5 + 0.5;
  col *= 0.6 + 0.75 * fol;

  // 14 hash-seeded bokeh discs — teal/olive/pale-gold, soft dreamy edges
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 c = vec2(hashg(vec2(fi, 3.1)), hashg(vec2(fi, 7.7)));
    c.x += 0.03 * sin(uT * 0.05 + fi);
    float r = 0.04 + 0.10 * hashg(vec2(fi, 1.7));
    float d = length((q - c) * vec2(1.8, 1.0));
    float m = exp(-d * d / (r * r));
    float pick = hashg(vec2(fi, 9.3));
    vec3 bc = pick < 0.45 ? vec3(0.16, 0.30, 0.22)
            : pick < 0.75 ? vec3(0.32, 0.34, 0.14)
            : vec3(0.55, 0.42, 0.18);
    col += bc * m * (0.16 + 0.22 * hashg(vec2(fi, 5.5)));
  }

  // dawn shafts slanting from upper-right; open with uDawn
  vec2 sc = q - vec2(0.86, 0.95);
  float ang = atan(sc.y, sc.x);
  float rr = length(sc);
  float shaft = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float c0 = 0.65 - fk * 0.28 + 0.03 * sin(uT * 0.07 + fk * 2.0);
    float bw = 0.045 + 0.02 * fk;
    shaft += (1.0 - smoothstep(0.0, bw, abs(ang - c0)))
           * (0.55 + 0.45 * sin(uT * 0.12 + fk * 1.9));
  }
  shaft *= (1.0 - smoothstep(0.0, 0.85, rr));
  col += vec3(0.95, 0.72, 0.35) * shaft * (0.10 + 0.38 * uDawn);

  // dust motes twinkling inside the shaft band
  vec2 cell = floor(q * vec2(60.0, 34.0));
  float ds = hashg(cell);
  vec2 fpos = fract(q * vec2(60.0, 34.0)) - 0.5;
  float speck = exp(-dot(fpos, fpos) * 30.0) * step(0.94, ds);
  float tw = 0.5 + 0.5 * sin(uT * (0.6 + ds) + ds * 40.0);
  col += vec3(0.9, 0.75, 0.4) * speck * tw * uDawn * (1.0 - smoothstep(0.0, 0.7, rr)) * 0.5;

  // vignette
  col *= 0.55 + 0.45 * (1.0 - smoothstep(0.45, 1.05, length(q - vec2(0.5))));
  gl_FragColor = vec4(col, 1.0);
}
`;

// points: dew glints, dust motes, dew drops, bee
const PT_VERT = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;      // t0, rate, amp, phase
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;
uniform float uT;
uniform float uPx;
uniform float uDawn;
uniform float uFleeT;

void main() {
  float t0 = aAux.x;
  float rate = aAux.y;
  float amp = aAux.z;
  float ph = aAux.w;
  vec3 pos = position;
  float alpha = 1.0;
  float size = 1.0;
  vFlap = 0.0;

  if (aKind < 0.5) {
    // dew glint: fixed sparkle point on leaf edges, sharp twinkle at dawn
    float tw = pow(0.5 + 0.5 * sin(uT * (1.4 + amp) + ph * 40.0), 8.0);
    alpha = tw * (0.25 + 0.75 * uDawn);
    size = 0.05 + 0.10 * tw;
  } else if (aKind < 1.5) {
    // dust mote drifting inside the dawn shaft band
    pos.x += 0.18 * sin(uT * 0.14 + ph * 6.28) + 0.05 * sin(uT * 0.5 + ph);
    pos.y += 0.12 * sin(uT * 0.11 + ph * 4.1) - 0.015 * uT;
    pos.z += 0.10 * sin(uT * 0.09 + ph * 2.3);
    float tw = 0.5 + 0.5 * sin(uT * (0.7 + amp) + ph * 30.0);
    alpha = (0.15 + 0.35 * tw) * (0.3 + 0.7 * uDawn);
    size = 0.035 + 0.03 * fract(aSeed * 3.1);
  } else if (aKind < 2.5) {
    // dew drop: gathers at the jostled bloom lip, then falls and fades
    float ot = uT - t0;
    float gather = 0.35;
    if (ot < 0.0) { alpha = 0.0; size = 0.01; }
    else if (ot < gather) {
      alpha = 0.7 * ot / gather;
      size = 0.05 + 0.08 * ot / gather;
    } else {
      float ft = ot - gather;
      pos.y = position.y - 2.4 * ft * ft;
      alpha = (1.0 - smoothstep(0.55, 0.85, ft)) * 0.95;
      size = 0.10;
    }
  } else {
    // bee: orbits the cluster until the bird darts in, then flees off-frame
    float ot = uT;
    float otF = min(ot, uFleeT);
    vec3 orbit = position;
    orbit.x += amp * cos(otF * rate + ph);
    orbit.y += 0.25 * amp * sin(otF * rate * 2.0 + ph);
    orbit.z += 0.6 * amp * sin(otF * rate + ph);
    if (uT > uFleeT) {
      float ft = uT - uFleeT;
      // flee: accelerates up-left out of frame
      orbit.x -= (1.6 * ft + 1.8 * ft * ft) * 0.8;
      orbit.y += (1.2 * ft + 0.9 * ft * ft);
      alpha = 1.0 - smoothstep(1.2, 2.0, ft);
    }
    pos = orbit;
    vFlap = sin(uT * 60.0 + ph * 10.0);   // fast wing shimmer
    size = 0.16;
  }

  vA = alpha;
  vKind = aKind;
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 300.0 * uPx / max(1.0, -mv.z), 240.0 * uPx);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
}
`;

const PT_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;
varying float vFlap;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  vec3 col; float a;
  if (vKind < 0.5) {
    // dew glint: bright core + cross streaks
    float core = exp(-d * d * 320.0);
    float streak = max(0.0, 1.0 - abs(q.x) * 18.0) * max(0.0, 1.0 - abs(q.y) * 4.0)
                 + max(0.0, 1.0 - abs(q.y) * 18.0) * max(0.0, 1.0 - abs(q.x) * 4.0);
    col = vec3(1.0, 0.9, 0.62);
    a = (core + 0.5 * streak) * vA;
  } else if (vKind < 1.5) {
    float body = exp(-d * d * 200.0);
    col = vec3(0.85, 0.72, 0.42);
    a = body * vA;
  } else if (vKind < 2.5) {
    vec2 e = vec2(q.x * 1.6, q.y * 0.9);
    float body = exp(-dot(e, e) * 240.0);
    float core = exp(-d * d * 500.0);
    col = vec3(0.80, 0.88, 0.95) * (body * 0.7 + core);
    a = body * vA;
  } else {
    // bee: fuzzy amber body + shimmering wing halo
    vec2 eb = vec2(q.x * 1.25, q.y * 0.85);
    float body = exp(-dot(eb, eb) * 90.0);
    vec3 amber = mix(vec3(0.85, 0.62, 0.18), vec3(0.20, 0.14, 0.05),
                     smoothstep(-0.2, 0.2, q.y + 0.1 * sin(vSeed * 20.0)));
    float halo = exp(-d * d * 30.0) * (0.4 + 0.6 * vFlap * vFlap);
    col = amber * body + vec3(0.85, 0.88, 0.9) * halo * 0.4;
    a = (body + 0.5 * halo) * vA;
  }
  if (a <= 0.003) discard;
  gl_FragColor = vec4(col * a, a);
}
`;

// ---- scene ------------------------------------------------------------------
interface HbState {
  backMat: THREE.ShaderMaterial;
  ptMat: THREE.ShaderMaterial;
  bird: THREE.Group;
  wings: { blurL: THREE.Mesh; blurR: THREE.Mesh; blurMat: THREE.MeshBasicMaterial;
           foldL: THREE.Mesh; foldR: THREE.Mesh; foldMat: THREE.MeshStandardMaterial };
  tail: THREE.Mesh;
  throat: THREE.MeshStandardMaterial;
  head: THREE.Group;
  sites: THREE.Vector3[];
  mouths: THREE.Vector3[];
  jostleBloom: THREE.Group;
  webMat: THREE.LineBasicMaterial;
  hemi: THREE.HemisphereLight;
  dir: THREE.DirectionalLight;
  bs: BirdState;
}
const hbStates = new WeakMap<SceneContext, HbState>();

// trumpet bloom: lathe tube flaring at the lip, coral gradient via uv.y
function buildBloom(): THREE.Group {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    let r = 0.045 + 0.02 * Math.sin(Math.PI * Math.min(u / 0.6, 1));
    if (u > 0.62) r += 0.22 * Math.pow((u - 0.62) / 0.38, 1.5);
    prof.push(new THREE.Vector2(r, u * 1.05));
  }
  const geo = new THREE.LatheGeometry(prof, 14);
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 64;
  const c2 = canvas.getContext('2d')!;
  const grad = c2.createLinearGradient(0, 64, 0, 0);
  grad.addColorStop(0, '#5e1626');
  grad.addColorStop(0.6, '#a52a41');
  grad.addColorStop(1, '#ff8468');
  c2.fillStyle = grad; c2.fillRect(0, 0, 1, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide,
    emissive: 0x30060c, emissiveIntensity: 0.35,
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  return g;
}

// leaf card: simple two-sided pointed-oval shape
function leafGeo(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.28, 0.12, 0.42, 0.42, 0.0, 0.95);
  s.bezierCurveTo(-0.42, 0.42, -0.28, 0.12, 0, 0);
  return new THREE.ShapeGeometry(s, 8);
}

// hummingbird: forward is -z
function buildBird() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x0f6b45, metalness: 0.55, roughness: 0.3,
    emissive: 0x053322, emissiveIntensity: 0.4,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.30, 20, 14), bodyMat);
  body.scale.set(0.55, 0.5, 1.5);
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xa8c9ae, roughness: 0.6 }));
  belly.position.set(0, -0.06, -0.02); belly.scale.set(0.5, 0.42, 1.3);
  g.add(body, belly);

  const head = new THREE.Group();
  head.position.set(0, 0.11, -0.34);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), bodyMat);
  head.add(skull);
  const throatMat = new THREE.MeshStandardMaterial({
    color: 0xc2185b, emissive: 0xc2185b, emissiveIntensity: 0.4,
    metalness: 0.7, roughness: 0.25 });
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), throatMat);
  throat.position.set(0, -0.07, -0.08); throat.scale.set(1, 0.7, 0.9);
  head.add(throat);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.022, 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.4 }));
  beak.rotation.x = Math.PI / 2;            // cone +y → -z
  beak.position.set(0, 0.0, -0.34);
  head.add(beak);
  g.add(head);

  // tail fan: dark wedge behind
  const tailGeo = new THREE.CircleGeometry(0.34, 10, -0.55, 1.1);
  const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({
    color: 0x14382a, roughness: 0.5, side: THREE.DoubleSide }));
  tail.position.set(0, -0.02, 0.40);
  tail.rotation.x = Math.PI / 2 + 0.35;     // lies back, slightly spread down
  tail.scale.set(1.0, 1.0, 1.0);
  g.add(tail);

  // wing blur: additive arc sectors at the shoulders
  const blurMat = new THREE.MeshBasicMaterial({
    color: 0x9fd8c8, transparent: true, opacity: 0.0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const mkFan = (side: number) => {
    const fan = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 18, side > 0 ? -0.4 : Math.PI - 2.74, 2.74),
      blurMat);
    fan.position.set(0.09 * side, 0.10, -0.08);
    fan.rotation.x = -Math.PI / 2 + 0.25;   // roughly horizontal spread
    fan.renderOrder = 6;
    return fan;
  };
  const blurL = mkFan(-1), blurR = mkFan(1);
  g.add(blurL, blurR);

  // folded wings for the perch
  const foldMat = new THREE.MeshStandardMaterial({
    color: 0x0d4a33, roughness: 0.5, transparent: true, opacity: 0 });
  const mkFold = (side: number) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.42), foldMat);
    w.position.set(0.15 * side, 0.05, 0.10);
    w.rotation.set(-0.5, 0, 0.5 * side);
    return w;
  };
  const foldL = mkFold(-1), foldR = mkFold(1);
  g.add(foldL, foldR);

  return { g, head, tail, throat: throatMat,
           wings: { blurL, blurR, blurMat, foldL, foldR, foldMat } };
}

export default defineScene({
  id: 'hummingbird/garden',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x0a140c);

    // --- backdrop: bokeh + dawn shafts
    const backMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BACK_FRAG,
      depthWrite: false, uniforms: { uT: { value: 0 }, uDawn: { value: 0 } },
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(42, 22), backMat);
    back.position.set(1.5, 3.6, -9.5);
    back.renderOrder = 0;
    sc.add(back);

    // --- lights
    const hemi = new THREE.HemisphereLight(0xffd9a0, 0x0f2417, 0.5);
    const dir = new THREE.DirectionalLight(0xffd9a8, 0.7);
    dir.position.set(6, 9, 3);
    sc.add(hemi, dir);

    // --- vine + leaves + blooms
    const vineCurve = new THREE.CatmullRomCurve3(
      VINE_PTS.map(p => new THREE.Vector3(...p)));
    const vine = new THREE.Mesh(
      new THREE.TubeGeometry(vineCurve, 40, 0.055, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.85 }));
    sc.add(vine);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x1d4628, roughness: 0.6, side: THREE.DoubleSide,
      emissive: 0x2e5c33, emissiveIntensity: 0.25 });
    const lg = leafGeo();
    const glintSpots: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) {
      const u = 0.06 + 0.9 * rng();
      const leaf = new THREE.Mesh(lg, leafMat);
      const vp = vineCurve.getPoint(u);
      const side = rng() > 0.5 ? 1 : -1;
      leaf.position.set(vp.x + side * 0.12, vp.y + 0.02, vp.z + (rng() - 0.5) * 0.3);
      leaf.scale.setScalar(0.7 + rng() * 0.7);
      leaf.rotation.set(-0.6 - rng() * 0.5, rng() * 0.8 - 0.4, side * (0.9 + rng() * 0.6));
      sc.add(leaf);
      // dew glint at the leaf tip
      const tip = new THREE.Vector3(0, 0.95, 0).applyEuler(leaf.rotation)
        .multiplyScalar(leaf.scale.x).add(leaf.position);
      glintSpots.push(tip);
    }
    // extra glints along the vine edge
    for (let i = 0; i < 8; i++) {
      const vp = vineCurve.getPoint(0.05 + 0.9 * rng());
      glintSpots.push(new THREE.Vector3(
        vp.x + (rng() - 0.5) * 0.1, vp.y + 0.04 + rng() * 0.03, vp.z + (rng() - 0.5) * 0.1));
    }

    const sites: THREE.Vector3[] = [];
    const mouths: THREE.Vector3[] = [];
    const blooms: THREE.Group[] = [];
    const mouthDirBase = new THREE.Vector3(0.10, -0.85, 0.52).normalize();
    for (let i = 0; i < 8; i++) {
      const b = buildBloom();
      const u = 0.07 + i * 0.125;
      const vp = vineCurve.getPoint(u);
      b.position.set(vp.x + (rng() - 0.5) * 0.3, vp.y - 0.12, vp.z + (rng() - 0.5) * 0.4);
      // hang down, mouth tilted toward the camera side
      // lateral roll tips each mouth outward so the flare silhouettes
      const roll = (rng() > 0.5 ? 1 : -1) * (0.30 + rng() * 0.35);
      b.rotation.set(Math.PI * 0.56 + (rng() - 0.5) * 0.22,
                     (rng() - 0.5) * 0.6, roll);
      b.scale.setScalar(0.7);
      sc.add(b);
      blooms.push(b);
      // mouth (lathe tip) in world space
      const mouth = new THREE.Vector3(0, 1.05, 0).applyEuler(b.rotation).add(b.position);
      mouths.push(mouth);
      // hover site: just in front of the mouth, slightly toward camera
      // hover site hangs just below the mouth — the bird reaches up in
    sites.push(mouth.clone().addScaledVector(mouthDirBase, 0.30));
    }
    const jostleBloom = blooms[CHAIN[2]!]!;

    // --- perch twig
    const twigCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.6, 0.95, -0.5),
      new THREE.Vector3(-3.0, 0.88, -0.35),
      new THREE.Vector3(-2.3, 0.78, -0.55),
    ]);
    sc.add(new THREE.Mesh(
      new THREE.TubeGeometry(twigCurve, 12, 0.028, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x41382c, roughness: 0.9 })));

    // --- cobweb strands catching light (additive hairlines)
    const webPts: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = vineCurve.getPoint(0.15 + 0.7 * rng());
      const b2 = a.clone().add(new THREE.Vector3(
        (rng() - 0.3) * 2.2, 0.6 + rng() * 1.4, (rng() - 0.5) * 1.2));
      webPts.push(a.x, a.y + 0.05, a.z, b2.x, b2.y, b2.z);
      if (rng() > 0.5) {
        const c = b2.clone().add(new THREE.Vector3(
          (rng() - 0.5) * 1.4, -(0.4 + rng() * 0.7), (rng() - 0.5) * 0.8));
        webPts.push(b2.x, b2.y, b2.z, c.x, c.y, c.z);
      }
    }
    const webGeo = new THREE.BufferGeometry();
    webGeo.setAttribute('position', new THREE.Float32BufferAttribute(webPts, 3));
    const webMat = new THREE.LineBasicMaterial({
      color: 0xd8e8dc, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false });
    const web = new THREE.LineSegments(webGeo, webMat);
    web.renderOrder = 4;
    sc.add(web);

    // --- points: glints, dust, dew drops, bee
    const NG = glintSpots.length, NM = 26, ND = 4;
    const pos = new Float32Array((NG + NM + ND + 1) * 3);
    const seed = new Float32Array(NG + NM + ND + 1);
    const kind = new Float32Array(NG + NM + ND + 1);
    const aux = new Float32Array((NG + NM + ND + 1) * 4);
    let i = 0;
    const put = (p: THREE.Vector3, k: number, s: number,
                 t0 = 0, v = 0, amp = 0, ph = 0) => {
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = amp; aux[i * 4 + 3] = ph;
      i++;
    };
    for (const g2 of glintSpots) put(g2, 0, rng() * 100, 0, 0, 0.5 + rng(), rng() * 6.28);
    for (let m = 0; m < NM; m++) {
      put(new THREE.Vector3(0.5 + rng() * 5.5, 1.8 + rng() * 3.4, -5 + rng() * 4.5),
          1, rng() * 100, 0, 0, 0.3 + rng() * 0.7, rng() * 6.28);
    }
    // dew drops fall off the jostled bloom's lip
    const jm = mouths[CHAIN[2]!]!;
    for (let d = 0; d < ND; d++) {
      put(new THREE.Vector3(jm.x + (rng() - 0.5) * 0.15, jm.y - 0.05, jm.z + (rng() - 0.5) * 0.15),
          2, rng() * 100, JOSTLE_T + d * 0.09 + rng() * 0.05, 0, 0, 0);
    }
    // the bee orbits the cluster center
    put(new THREE.Vector3(0.9, 2.35, -1.6), 3, rng() * 100, 0, 0.9 + rng() * 0.4, 0.5 + rng() * 0.3, rng() * 6.28);

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ptGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    ptGeo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    ptGeo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const ptMat = new THREE.ShaderMaterial({
      vertexShader: PT_VERT, fragmentShader: PT_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uPx: { value: 1 }, uDawn: { value: 0 }, uFleeT: { value: BEE_FLEE_T } },
    });
    const pts = new THREE.Points(ptGeo, ptMat);
    pts.frustumCulled = false;
    pts.renderOrder = 5;
    sc.add(pts);

    // --- the bird
    const bb = buildBird();
    bb.g.scale.setScalar(0.5);
    bb.g.renderOrder = 6;
    sc.add(bb.g);

    // bind the camera anchor sites now that bloom mouths are known
    ANCH[1]!.p.copy(sites[0]!);
    ANCH[2]!.p.copy(sites[1]!);
    ANCH[3]!.p.copy(sites[2]!);
    ANCH[4]!.p.copy(sites[3]!);

    // --- camera: macro tracking — arrives at each hover site just ahead
    ctx.rig.setLensMm(62);
    // keyed timing: sampled waypoints carry their own t
    ctx.rig.pathTiming = 'keyed';
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    const ap = new THREE.Vector3(), ao = new THREE.Vector3();
    const dur = ctx.sceneCtx.end - ctx.sceneCtx.start;
    for (let w = 0; w <= 60; w++) {
      const wt = ctx.sceneCtx.start + (w / 60) * dur;
      anchorAt(wt, ap, ao);
      wps.push({
        t: w / 60,
        pos: [ap.x + ao.x, ap.y + ao.y, ap.z + ao.z],
        target: [ap.x, ap.y - 0.15, ap.z],
      });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    hbStates.set(ctx, {
      backMat, ptMat,
      bird: bb.g, wings: bb.wings, tail: bb.tail, throat: bb.throat, head: bb.head,
      sites, mouths, jostleBloom, webMat, hemi, dir,
      bs: { pos: new THREE.Vector3(), vel: new THREE.Vector3(), pitch: 0, yaw: 0, wingOpen: 0, tailFan: 0, throat: 0 },
    });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const st = hbStates.get(ctx)!;
    // dawn grows through the piece
    const dawn = smooth01((t - 1.0) / 21.0);
    st.backMat.uniforms.uT.value = t;
    st.backMat.uniforms.uDawn.value = dawn;
    st.ptMat.uniforms.uT.value = t;
    st.ptMat.uniforms.uDawn.value = dawn;
    st.ptMat.uniforms.uPx.value = out.height / 1080;
    st.hemi.intensity = 0.5 + 0.55 * dawn;
    st.dir.intensity = 0.7 + 0.8 * dawn;
    st.webMat.opacity = 0.12 + 0.20 * dawn;
    ctx.updateCamera(t, f.p);

    // ---- bird pose
    const B = st.bs;
    st.bird.visible = t >= 3.45 && t <= GONE_T;
    if (st.bird.visible) {
      birdAt(t, st.sites, st.mouths, B);
      st.bird.position.copy(B.pos);
      st.bird.rotation.set(B.pitch, B.yaw, 0, 'YXZ');
      // wing blur envelope: fan shimmer while flying, folds on the perch
      const wo = B.wingOpen;
      st.wings.blurMat.opacity = wo * (0.17 + 0.05 * Math.sin(t * 49));
      st.wings.blurL.rotation.z = 0.10 * Math.sin(t * 27) * wo;
      st.wings.blurR.rotation.z = -0.10 * Math.sin(t * 27) * wo;
      st.wings.foldMat.opacity = (1 - wo) * 0.95;
      // tail fan splays on braking darts
      st.tail.scale.x = 0.7 + 0.8 * B.tailFan;
      st.tail.rotation.x = Math.PI / 2 + 0.35 + 0.25 * B.tailFan;
      // gorget pulses during sips
      st.throat.emissiveIntensity = 0.4 + 1.8 * Math.min(1, B.throat);
      // preen flicks during the perch beat: head dips toward the wing
      let preen = 0;
      for (let k = 0; k < 3; k++) {
        const pT = 17.4 + k * 1.15 + 0.15 * Math.sin(k * 7.0);
        preen += gauss(t, pT, 0.3) * (k % 2 === 0 ? 1 : -1);
      }
      st.head.rotation.y = preen * 1.15;
      st.head.rotation.x = Math.abs(preen) * 0.5;
    }

    // ---- bloom jostle after the dart-in at bloom C
    const jw = gauss(t, JOSTLE_T, 0.5);
    st.jostleBloom.rotation.z = (st.jostleBloom.userData.rz0 as number ?? st.jostleBloom.rotation.z);
    if (!(st.jostleBloom.userData.rz0 as number)) st.jostleBloom.userData.rz0 = st.jostleBloom.rotation.z;
    st.jostleBloom.rotation.z = (st.jostleBloom.userData.rz0 as number) +
      jw * 0.09 * Math.sin(t * 13.0);

    ctx.flush(out, true);
  },
});

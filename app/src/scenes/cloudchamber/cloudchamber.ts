// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// cloudchamber — a supersaturated-vapor chamber seen from above at a slight
// oblique. Charged particles condense thin bone-white trails that arc in the
// chamber's magnetic field: each track's entry point, energy (radius), curl
// direction, birth and decay are pure functions of hash(trackIndex), so the
// whole field is stateless f(t) — no accumulators, no Math.random in the
// frame path. Some seeds emit a shorter daughter arc at a fork point for the
// pair-production V. Rare analytic-noise mist drifts through; the camera
// dollies in very slowly. Track 6 burns warm gold — the only colour event.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { orbitPosition } from '../../engine/rig';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// --- shaders -----------------------------------------------------------------
const CHAMBER_VERT = `out vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Arc SDF: distance to a circular trail segment centred at c, radius R,
// starting at angle a0 and sweeping `extent` radians in direction k (±1).
// Inside the swept sector the distance is to the ring; beyond the tip it is
// the distance to the tip point, so the head of the trail stays round.
const CHAMBER_FRAG = `${GLSL_COMMON}
uniform float uT;
in vec3 vW; out vec4 fragColor;

const int N_TRACKS = 14;
const float GOLD_I = 6.0;

float hash1(float n){ return fract(sin(n * 127.1) * 43758.5453123); }

float arcDist(vec2 p, vec2 c, float R, float a0, float k, float extent, out vec2 tip) {
  vec2 q = p - c;
  float ang = mod(k * (atan(q.y, q.x) - a0), TAU);
  tip = c + R * vec2(cos(a0 + k * extent), sin(a0 + k * extent));
  vec2 src = c + R * vec2(cos(a0), sin(a0));
  float d = ang <= extent ? abs(length(q) - R) : length(p - tip);
  // condensation clump at the entry point; unweighted so no amplitude seam
  return min(d, length(p - src));
}

// One track: parent arc + optional daughter fork. Returns rgb contribution.
vec3 trackGlow(vec2 p, float fi, float t, vec3 coreCol, vec3 haloCol) {
  float birth = 0.5 + hash1(fi * 7.31 + 1.7) * 15.0;
  float age = t - birth;
  if (age <= 0.0) return vec3(0.0);

  float h2 = hash1(fi * 11.17 + 4.2), h3 = hash1(fi * 5.93 + 2.1);
  float h4 = hash1(fi * 9.77 + 7.9), h5 = hash1(fi * 3.37 + 5.5);
  float h6 = hash1(fi * 13.7 + 3.3), h7 = hash1(fi * 17.3 + 9.1);
  float h8 = hash1(fi * 23.7 + 6.7), h9 = hash1(fi * 29.1 + 8.8);

  vec2 s = vec2(mix(-7.5, 7.5, h2), mix(-4.4, 4.4, hash1(fi * 6.13 + 2.9)));
  float phi = h3 * TAU;
  float k = h4 < 0.5 ? -1.0 : 1.0;        // field bends some tracks each way
  float R = mix(1.4, 5.2, pow(h5, 0.75)); // radius ⇐ seed energy
  float thetaMax = mix(0.9, 2.8, h7);
  float grow = mix(0.7, 1.7, h6);
  float tau = mix(3.5, 7.5, h8);

  vec2 c = s + k * R * vec2(-sin(phi), cos(phi));
  float a0 = atan(s.y - c.y, s.x - c.x);

  float prog = clamp(age / grow, 0.0, 1.0);
  vec2 tip;
  float d = arcDist(p, c, R, a0, k, prog * thetaMax, tip);
  // condensate glows on formation, then decays like the real cloud trail
  float env = smoothstep(0.0, 0.10, age) * exp(-age / tau);
  float w = 0.030 + 0.018 * prog;
  vec3 acc = env * (1.5 * exp(-d / (w * 0.4)) * coreCol
                  + 0.32 * exp(-d / (w * 6.0)) * haloCol
                  + 0.45 * exp(-length(p - tip) / (w * 2.5)) * coreCol);

  // pair production: some seeds throw a shorter, counter-curving daughter
  // from a fork point part-way along the parent's extent.
  if (h9 > 0.74) {
    float uf = 0.3 + 0.35 * hash1(fi * 31.7 + 1.3);
    float dAge = t - (birth + grow * uf);
    if (dAge > 0.0) {
      float thD = uf * thetaMax;
      vec2 sd = c + R * vec2(cos(a0 + k * thD), sin(a0 + k * thD));
      vec2 tang = vec2(-sin(a0 + k * thD), cos(a0 + k * thD)) * k;
      float phi2 = atan(tang.y, tang.x)
                 + mix(0.7, 1.1, hash1(fi * 37.9 + 4.4)) * (h9 > 0.87 ? 1.0 : -1.0);
      float k2 = -k;
      float R2 = R * (0.25 + 0.3 * hash1(fi * 41.3 + 7.7));
      vec2 c2 = sd + k2 * R2 * vec2(-sin(phi2), cos(phi2));
      float a02 = atan(sd.y - c2.y, sd.x - c2.x);
      float prog2 = clamp(dAge / (grow * 0.7), 0.0, 1.0);
      vec2 tip2;
      float d2 = arcDist(p, c2, R2, a02, k2, prog2 * thetaMax * 0.8, tip2);
      float env2 = smoothstep(0.0, 0.08, dAge) * exp(-dAge / (tau * 0.7));
      float w2 = 0.024 + 0.014 * prog2;
      acc += env2 * (1.2 * exp(-d2 / (w2 * 0.4)) * coreCol
                   + 0.26 * exp(-d2 / (w2 * 6.0)) * haloCol
                   + 0.3 * exp(-length(p - tip2) / (w2 * 2.5)) * coreCol);
    }
  }
  return acc;
}

void main(){
  vec2 p = vW.xz; // chamber-plane coordinates
  vec3 bone = vec3(0.90, 0.91, 0.95);
  vec3 cool = vec3(0.42, 0.58, 0.86);
  vec3 gold = vec3(1.0, 0.78, 0.48);

  // near-black chamber floor: faint cold mottling + rare drifting mist so the
  // dark is alive but the trails stay the event
  float mot = fbm(p * 0.4 + vec2(uT * 0.008, -uT * 0.005), 3) * 0.5 + 0.5;
  vec3 base = mix(vec3(0.003, 0.005, 0.010), vec3(0.009, 0.014, 0.026), mot * 0.55);
  float mist = fbm(p * 0.55 + vec2(uT * 0.015, uT * 0.009), 3);
  base += vec3(0.020, 0.030, 0.048) * max(mist, 0.0) * 0.55;

  // chamber wall vignette: corners fall off so the field reads bounded
  // (smoothstep edge0 must stay < edge1 — reversed edges are undefined in GLSL)
  float wall = (1.0 - smoothstep(5.4, 9.2, abs(p.x))) * (1.0 - smoothstep(3.8, 7.2, abs(p.y)));
  base *= 0.35 + 0.65 * wall;

  vec3 acc = vec3(0.0);
  for (int i = 0; i < N_TRACKS; i++) {
    float fi = float(i);
    vec3 core = abs(fi - GOLD_I) < 0.5 ? gold : bone;
    vec3 halo = abs(fi - GOLD_I) < 0.5 ? gold * 0.75 : cool;
    acc += trackGlow(p, fi, uT, core, halo);
  }

  fragColor = vec4(base + acc, 1.0);
}`;

export default class CloudChamberScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private chamberU = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(42, ctx.W / ctx.H, 0.1, 80);
    // wide floor: ultrawide exports (2.37:1) must not expose clear-colour corners
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 26),
      new THREE.ShaderMaterial({ uniforms: this.chamberU, vertexShader: CHAMBER_VERT, fragmentShader: CHAMBER_FRAG, glslVersion: THREE.GLSL3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.three.add(floor);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    this.chamberU.uT.value = t;

    // very slow dolly-in at a slight oblique through the shared camera rig:
    // shrinking orbit radius descends toward the chamber; slow yaw drift keeps
    // the parallax alive.
    const r = 12.6 - 2.8 * smooth(1.0, 18.0, t);
    const pitch = 0.88 + 0.04 * smooth(1.0, 18.0, t) + 0.02 * Math.sin(t * 0.07);
    const yaw = 0.06 * Math.sin(t * 0.09); // centred on +z: front-on with a slow drift
    const target: [number, number, number] = [0.4 * Math.sin(t * 0.045), 0, -0.5];
    const pos = orbitPosition(target, r, pitch, yaw);
    this.cam.position.set(pos[0], pos[1], pos[2]);
    this.cam.lookAt(target[0], target[1], target[2]);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.three, this.cam);
    rr.resetState();

    const fade = t < 0.9 ? 1 - t / 0.9 : t > 19.1 ? (t - 19.1) / 0.9 : 0;
    return {
      exposure: 1.0, bloom: 1.35, bloomThreshold: 0.28, bloomRadius: 0.85,
      ca: 0.3, grain: 0.05, vignette: 0.5, fade: clamp01(fade), toneMap: 'agx',
    };
  }

  override dispose(): void {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

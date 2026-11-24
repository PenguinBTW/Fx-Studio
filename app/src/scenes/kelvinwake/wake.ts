// kelvinwake (~20 s): top-down oblique view of night water. An unseen vessel travels
// left -> right at constant speed; the surface carries a true Kelvin wake — the V
// cusp locus at ~19.47 degrees with feathered divergent-wave crests on the arms and
// nested transverse waves inside. Fully closed form: stationary-phase condition for
// deep-water waves from a source moving at constant v gives, for each pixel behind
// the source, a quadratic in u = tan(theta): 2m*u^2 + u + m = 0 (m = z/xb), whose
// discriminant 1 - 8m^2 vanishes exactly on the Kelvin wedge |m| = 1/(2*sqrt(2)).
// The two roots are the transverse (u ~ -m) and divergent (u ~ -1/(2m)) systems;
// phase psi = -(g/v^2) * xb / (cos(theta)*(2 - cos^2(theta))).
// No Math.random, no accumulators — everything is a function of f.t and position.
import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;      // scene-local seconds
uniform vec3 uRo;      // camera origin
uniform vec3 uFw;      // camera forward (normalized)
uniform vec3 uRt;      // camera right
uniform vec3 uUp;      // camera up
uniform vec2 uSrc;     // vessel position on the water plane (world xz)
uniform float uTan;    // tan(fov/2)
uniform float uAsp;    // aspect w/h
uniform float uFade;   // global fade 0..1

const float GRAV = 9.8;
const float VEL  = 3.3;          // vessel speed, world units/s
const float K0   = GRAV / (VEL * VEL); // phase rate per unit behind-source distance
const float LAMB = 6.2831853 / K0;     // transverse wavelength ~7 units

// Total surface height field at world-xz point p (deterministic in p and uT).
float heightAt(vec2 p) {
  vec2 rel = p - uSrc;
  float xb = -rel.x;                    // distance behind the vessel
  float h = 0.18 * fbm(p * 0.13 + vec2(uT * 0.10, uT * 0.03), 3)
          + 0.06 * fbm(p * 0.55 + vec2(-uT * 0.23, uT * 0.11), 3); // ambient chop
  if (xb <= 0.35) return h;
  float m = rel.y / xb;
  float disc = 1.0 - 8.0 * m * m;
  if (disc <= 0.0) return h;            // outside the Kelvin wedge

  float sd = sqrt(disc);
  float q = abs(m) * 2.8284271;         // 0 at track, 1 at the cusp locus

  // small root u1 = -2m/(1+sqrt(disc)) -> transverse system; u2 = 1/(2u1) -> divergent.
  float u1 = -2.0 * m / (1.0 + sd);
  float c1 = inversesqrt(1.0 + u1 * u1);
  float psi1 = -K0 * xb / (c1 * (2.0 - c1 * c1));

  // amplitude envelopes
  float env = smoothstep(0.0, 1.5 * LAMB, xb) * pow(1.0 + xb / (30.0 * LAMB), -0.8);
  float cuspBoost = 0.8 + 0.9 * smoothstep(0.55, 0.97, q);
  float edge = 1.0 - smoothstep(0.93, 1.0, q);    // fade out just inside the locus

  float w1 = env * (1.0 - 0.40 * q * q) * edge;
  float h1 = w1 * cos(psi1);

  float h2 = 0.0;
  float absm = abs(m);
  if (absm > 0.015) {
    float u2 = 1.0 / (2.0 * u1);
    float c2 = inversesqrt(1.0 + u2 * u2);
    float psi2 = -K0 * xb / (c2 * (2.0 - c2 * c2));
    // divergent waves: zero on the track, strongest toward the arms; the sin term
    // feathers the crests into dashes along each arm.
    float w2 = env * (0.30 + 0.70 * smoothstep(0.2, 0.95, q)) * smoothstep(0.015, 0.12, absm) * edge;
    w2 *= 1.0 / (1.0 + u2 * u2 * 0.02);              // damp the very-high-k tail toward the track
    w2 *= 0.72 + 0.28 * sin(xb * 0.55 + u2 * 3.0);
    h2 = w2 * cos(psi2);
  }
  return h + 0.55 * (h1 + h2) * cuspBoost;
}

// crest intensity (separate from height so shading can feather independently)
float crestAt(vec2 p) {
  vec2 rel = p - uSrc;
  float xb = -rel.x;
  if (xb <= 0.35) return 0.0;
  float m = rel.y / xb;
  float disc = 1.0 - 8.0 * m * m;
  if (disc <= 0.0) return 0.0;
  float sd = sqrt(disc);
  float q = abs(m) * 2.8284271;
  float u1 = -2.0 * m / (1.0 + sd);
  float c1 = inversesqrt(1.0 + u1 * u1);
  float psi1 = -K0 * xb / (c1 * (2.0 - c1 * c1));
  float env = smoothstep(0.0, 1.5 * LAMB, xb) * pow(1.0 + xb / (30.0 * LAMB), -0.8);
  float cuspBoost = 0.8 + 0.9 * smoothstep(0.55, 0.97, q);
  float edge = 1.0 - smoothstep(0.93, 1.0, q);
  float c = (1.0 - 0.40 * q * q) * max(cos(psi1), 0.0);
  float absm = abs(m);
  if (absm > 0.015) {
    float u2 = 1.0 / (2.0 * u1);
    float c2 = inversesqrt(1.0 + u2 * u2);
    float psi2 = -K0 * xb / (c2 * (2.0 - c2 * c2));
    float w2 = (0.30 + 0.70 * smoothstep(0.2, 0.95, q)) * smoothstep(0.015, 0.12, absm);
    w2 *= 1.0 / (1.0 + u2 * u2 * 0.02);
    w2 *= 0.72 + 0.28 * sin(xb * 0.55 + u2 * 3.0);
    c += w2 * max(cos(psi2), 0.0);
  }
  float spark = 0.75 + 0.5 * fbm(p * 1.4 + psi1 * 0.11, 2); // per-crest texture
  return env * edge * cuspBoost * smoothstep(0.30, 0.95, c) * spark;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 rd = normalize(uFw + uTan * (ndc.x * uAsp * uRt + ndc.y * uUp));

  // night sky / horizon void above the water
  vec3 C = vec3(0.003, 0.005, 0.009) + vec3(0.010, 0.014, 0.022) * pow(max(rd.y, 0.0), 0.6);
  C += vec3(0.5, 0.55, 0.7) * 0.35 * step(0.9985, hash13(floor(rd * 900.0))); // sparse stars

  if (rd.y < -0.005) {
    float tH = -uRo.y / rd.y;
    vec2 p = uRo.xz + rd.xz * tH;

    // numeric normal from the analytic height field
    float e = 0.09;
    float h0 = heightAt(p);
    float hx = heightAt(p + vec2(e, 0.0));
    float hz = heightAt(p + vec2(0.0, e));
    vec3 n = normalize(vec3((h0 - hx) / e, 1.0, (h0 - hz) / e));

    // near-black water body
    float fres = pow(1.0 - max(dot(-rd, n), 0.0), 4.0);
    vec3 base = vec3(0.005, 0.009, 0.015);
    base += vec3(0.010, 0.018, 0.030) * fres;
    base *= exp(-tH * 0.0035); // darker toward the far field

    // faint bone glint on crests: cold key from upper-left + crest luminance
    vec3 L = normalize(vec3(-0.42, 0.38, 0.82));
    float spec = pow(max(dot(reflect(rd, n), L), 0.0), 60.0);
    float crest = crestAt(p);
    vec3 bone = vec3(0.93, 0.89, 0.79);
    base += bone * crest * (0.22 + 1.6 * spec);
    base += bone * 0.10 * max(h0, 0.0); // gentle lift on swell faces

    // one subtle warm reflection path under the source track, fading astern
    vec2 rel = p - uSrc;
    float xb = -rel.x;
    float w = 2.0 + max(xb, 0.0) * 0.03;
    float path = exp(-rel.y * rel.y / (2.0 * w * w));
    float along = smoothstep(-6.0, 2.0, xb) * exp(-max(xb, 0.0) / 70.0);
    along *= 0.7 + 0.3 * sin(xb * 0.45 + 1.7);
    float hot = exp(-dot(rel, rel) / 7.0); // dim hot spot under the hull
    vec3 warm = vec3(1.0, 0.42, 0.15);
    base += warm * (0.045 * path * along + 0.05 * hot);

    C = base;
  }

  C *= uFade;
  fragColor = vec4(C, 1.0);
}
`;

export default class KelvinWake extends Scene {
  override stateful = false;
  override prerollMax = 0;
  override handlesTransition = false;

  private pass = new FSPass(FRAG, {
    uT: { value: 0 },
    uRo: { value: new THREE.Vector3() },
    uFw: { value: new THREE.Vector3(0, -0.6, 1) },
    uRt: { value: new THREE.Vector3(1, 0, 0) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uSrc: { value: new THREE.Vector2() },
    uTan: { value: 0.45 },
    uAsp: { value: 16 / 9 },
    uFade: { value: 0 },
  });

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init() {}
  override reset() {}

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt; // scene-local time
    const v = 3.3;
    const srcX = v * t;

    // slow descending push that follows the source: height 46 -> 30 over the shot,
    // a slight closing of the z standoff for the push feel.
    const p = Math.min(1, t / END);
    const h = 46 - 16 * p;
    const zoff = 52 - 5 * p; // camera sits +z looking back -z so screen-right is +x
    const ro = new THREE.Vector3(srcX - 8, h, zoff);
    // look-at drifts further astern of the source over the shot, so the vessel
    // visibly crosses the frame left -> right while the camera still tracks it.
    // The offset is capped to ~80% of the visible half-width so portrait
    // exports keep the source on screen.
    const asp = out.width / out.height;
    const offsetCap = Math.abs(zoff) * 0.45 * asp * 0.8;
    // tanh is a soft cap: the raw drift passes through almost untouched in
    // landscape and eases asymptotically toward the cap in portrait instead of
    // slamming to a stop when it binds.
    const target = new THREE.Vector3(
      srcX - offsetCap * Math.tanh((2 + 22 * p) / offsetCap),
      0,
      -4
    );
    const fw = target.clone().sub(ro).normalize();
    const rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(rt, fw).normalize();

    const u = this.pass.u;
    u.uT!.value = t;
    (u.uRo!.value as THREE.Vector3).copy(ro);
    (u.uFw!.value as THREE.Vector3).copy(fw);
    (u.uRt!.value as THREE.Vector3).copy(rt);
    (u.uUp!.value as THREE.Vector3).copy(up);
    (u.uSrc!.value as THREE.Vector2).set(srcX, 0);
    u.uAsp!.value = out.width / out.height;
    // Two-phase fades keep the near-black run under F16's 0.3 s threshold in
    // both orientations: in, snap up to ~80% within 0.3 s then settle exposure
    // slowly for the cinematic reveal; out, dim gradually to 55% over the last
    // second then dip to black inside the final 0.25 s.
    const fadeIn =
      0.8 * Math.min(1, t / 0.3) + 0.2 * Math.min(1, Math.max(0, t - 0.3) / 1.5);
    const rem = END - t;
    const fadeOut =
      rem > 0.25
        ? 0.55 + 0.45 * Math.min(1, (rem - 0.25) / 0.75)
        : 0.55 * (rem / 0.25);
    u.uFade!.value = fadeIn * fadeOut;

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x000000, 1);
    rr.clear(true, true, true);
    this.pass.render(rr, out);
    rr.setRenderTarget(null);
    rr.resetState();

    return {
      toneMap: 'aces',
      exposure: 1.05,
      bloom: 0.55,
      bloomThreshold: 0.55,
      halation: 0.25,
      vignette: 0.32,
      grain: 0.02,
      ca: 0.0,
    };
  }

  override dispose() {
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}

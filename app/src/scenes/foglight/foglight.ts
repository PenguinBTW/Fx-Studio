// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// foglight (~20 s): a lighthouse beam sweeping through night fog — a slim
// lighthouse silhouette on a dark rocky point; a rotating volumetric beam
// cone (closed-form azimuth f(t)); layered fbm fog the beam lights from
// within, warm bone-white at the lamp fading to cold blue at reach; faint
// sea shimmer when the beam crosses the waterline; stars pricking through
// as the fog thins ~t=14; one cold accent (ice-blue beam rim).
//
// Determinism: everything is closed-form f(t) — the sweep angle, fog drift,
// shimmer, twinkle and camera offsets are analytic. No Math.random, no
// accumulators.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const vec2 LAMP = vec2(0.735, 0.545); // lamp room, normalized (u,v)
const float SEA = 0.295;              // waterline
const int STARS = 30;

// --- beam azimuth: steady rotation, 6.5 s per sweep -----------------------
// Screen projection: cos(beta) gives the in-plane direction sign/magnitude;
// sin(beta) > 0 means the cone points toward the camera (foreshortened fan).
float beamBeta(float t) { return 6.2831853 * (t / 6.5) + 1.1; }

// fog veil: dense early, thins around t=14 so stars prick through
float fogVeil(float t) {
  float thin = exp(-pow((t - 14.0) / 2.6, 2.0));
  return 0.85 * (1.0 - 0.7 * thin);
}

// layered fbm density field drifting slowly left
float fogD(vec2 p, float t) {
  vec2 q = p * vec2(7.0, 11.0);
  float f = fbm(q + vec2(-t * 0.11, 0.0), 4);
  f += 0.5 * fbm(q * 2.3 + vec2(-t * 0.23, t * 0.015), 3);
  f /= 1.5;
  // milkier fog: compress the field so it reads as haze, not cloud blobs
  f = 0.22 + 0.55 * f;
  // fog sits heavier near the water, thins upward
  return f * mix(1.0, 0.45, smoothstep(SEA, 0.95, p.y));
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  float t = uT;

  // --- camera: slow lateral drift + slight push-in, closed-form -----------
  p = (p - 0.5) / (1.0 - 0.035 * smoothstep(0.0, 20.0, t)) + 0.5;
  p.x += 0.011 * sin(t * 0.12 + 0.4);

  vec2 asp = vec2(uRes.x / uRes.y, 1.0);

  // ---- sky: near-black gradient ----
  vec3 c = mix(vec3(0.008, 0.011, 0.020), vec3(0.016, 0.022, 0.042),
               smoothstep(1.0, 0.35, p.y));

  // ---- fog field ----
  float F = fogD(p, t) * fogVeil(t);
  vec3 fogCol = mix(vec3(0.030, 0.038, 0.052), vec3(0.055, 0.066, 0.085), F);

  // ---- stars: prick through as the veil thins ----
  float starVis = 1.0 - F * 1.1;
  for (int i = 0; i < STARS; i++) {
    float si = float(i);
    vec2 sp = vec2(hash11(si * 7.31), 0.55 + 0.42 * hash11(si * 19.7));
    vec2 d = (p - sp) * asp;
    float tw = 0.5 + 0.5 * sin(t * (0.4 + 0.5 * hash11(si * 3.7)) + si);
    float g = 1.0 - smoothstep(0.0, 0.0022 + 0.0013 * hash11(si * 5.1), length(d));
    c += vec3(0.70, 0.78, 0.95) * g * 0.22 * tw * max(0.0, starVis);
  }

  // ---- rotating beam ------------------------------------------------------
  float beta = beamBeta(t);
  vec2 beamDir = normalize(vec2(cos(beta), 0.16));        // sweeps L<->R, tips slightly down
  float toward = smoothstep(0.35, 0.95, sin(beta));       // pointing at camera

  vec2 v = p - LAMP;
  vec2 vn = v * asp;
  float r = length(vn);

  // in-plane wedge: pixel angle vs beam direction — one lamp, one beam.
  // A sharp core cone + a faint broad halo — the cone must read as a shaft.
  float wSide = dot(normalize(vn + 1e-5), beamDir);
  float core = pow(max(wSide, 0.0), 90.0);
  float halo = pow(max(wSide, 0.0), 10.0) * 0.18;
  float wedge = (core + halo) * (1.0 - toward);
  float dist = exp(-r * mix(8.0, 2.4, 1.0 - toward));
  // foreshortened fan when the cone swings toward the camera: a soft bloom
  // expanding around the lamp through the fog
  float fan = toward * exp(-r * 3.4) * 0.8;

  // beam brightness is modulated by local fog density: the cone lights
  // fog from within
  float lit = (wedge * dist + fan) * (0.35 + 1.6 * min(F * 1.6, 1.0));
  // ice-blue rim on the wedge edges — the one cold accent
  float rim = wedge * dist * (1.0 - wedge) * 1.4;

  vec3 warmBone = vec3(0.98, 0.90, 0.72);
  vec3 coldBlue = vec3(0.38, 0.52, 0.78);
  vec3 beamCol = mix(warmBone, coldBlue, clamp(r * 1.4 + F * 0.25, 0.0, 1.0));
  c += beamCol * lit * 1.9;
  c += coldBlue * rim * 0.5;
  // lamp point glow
  c += warmBone * exp(-length((p - LAMP) * asp) * 90.0) * 1.1;
  c += warmBone * exp(-length((p - LAMP) * asp) * 22.0) * 0.22 * (1.0 + toward);

  // ---- sea: dark swell + shimmer where the beam crosses the waterline ----
  if (p.y < SEA) {
    vec3 sea = vec3(0.006, 0.009, 0.016);
    sea += fbm(vec2(p.x * 30.0, p.y * 60.0 - t * 0.35), 3) * vec3(0.008, 0.010, 0.016);
    // reflection column under the beam's in-plane direction
    float refx = LAMP.x + beamDir.x * (SEA - p.y) * 1.9;
    float shim = exp(-pow((p.x - refx) * 26.0, 2.0));
    shim *= 0.5 + 0.5 * fbm(vec2(p.x * 90.0, p.y * 140.0 - t * 1.7), 3);
    // only shimmer while the beam tips downward enough to graze the water
    float graze = wedge * (0.4 + 0.6 * beamDir.y * 4.0);
    sea += beamCol * shim * graze * dist * 0.9;
    // faint phosphor sheen along the waterline (cold accent companion)
    sea += vec3(0.03, 0.09, 0.12) * exp(-abs(p.y - SEA) * 26.0)
         * (0.45 + 0.55 * fbm(vec2(p.x * 18.0, t * 0.2), 3));
    c = mix(c, sea, smoothstep(SEA + 0.004, SEA - 0.004, p.y));
  }

  // ---- rocky point + lighthouse silhouette ----
  float rock = 0.30 + fbm(vec2(p.x * 9.0, 2.0), 4) * 0.045 - abs(p.x - 0.735) * 0.5;
  float onRock = smoothstep(rock + 0.006, rock - 0.006, p.y) * step(SEA - 0.02, p.y);
  // tower: tapered column, gallery, lamp room, dome
  float lx = abs(p.x - LAMP.x);
  float taper = mix(0.0125, 0.0075, clamp((p.y - 0.34) / 0.19, 0.0, 1.0));
  float tower = step(lx, taper) * step(0.34, p.y) * step(p.y, 0.53);
  float gallery = step(lx, 0.0145) * step(0.53, p.y) * step(p.y, 0.545);
  float room = step(lx, 0.0105) * step(0.545, p.y) * step(p.y, 0.568);
  float dome = step(lx, 0.007) * step(0.568, p.y) * step(p.y, 0.574);
  float silhouette = max(onRock, max(max(tower, gallery), max(room, dome)));
  // silhouette occludes the beam glow behind it
  c = mix(c, vec3(0.004, 0.005, 0.009), silhouette * 0.96);
  // lamp room window: tiny bright slot that survives the silhouette
  c += warmBone * step(lx, 0.006) * step(0.548, p.y) * step(p.y, 0.562) * 1.6;

  // ---- fog veil over everything (in front of the beam it deepens) ----
  c = mix(c, fogCol, F * 0.55 * (1.0 - min(lit * 2.2, 0.75)));

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class FogLight extends Scene {
  override stateful = false;
  override prerollMax = 0;
  override handlesTransition = false;

  private pass = new FSPass(FRAG, {
    uT: { value: 0 },
    uRes: { value: new THREE.Vector2(W, H) },
    uFade: { value: 0 },
  });

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init() {}
  override reset() {}

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const u = this.pass.u;
    u.uT!.value = t;
    (u.uRes!.value as THREE.Vector2).set(out.width, out.height);

    const fadeIn = 0.8 * Math.min(1, t / 0.3) + 0.2 * Math.min(1, Math.max(0, t - 0.3) / 1.5);
    const rem = END - t;
    const fadeOut = rem > 0.25 ? 0.55 + 0.45 * Math.min(1, (rem - 0.25) / 0.75) : 0.55 * (rem / 0.25);
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
    };
  }
}

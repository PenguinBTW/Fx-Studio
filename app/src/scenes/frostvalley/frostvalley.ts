// frostvalley — a high alpine valley at first light: steep rock walls with
// pink-lit snow caps, a frost-glittered meadow, a misted silver stream, and a
// red fox trotting left→right — pause, listen, one pounce, trot on.
// All motion is closed-form f(t). Authored uv [0,1] is remapped into the
// camera-visible vUv band (x~[0.27,0.73], y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const listenT = (t: number) => ss(7.8, 8.4, t) * (1 - ss(9.6, 10.1, t));   // ears up, head cocked
const pounceW = (t: number) => ss(9.9, 10.3, t) * (1 - ss(11.2, 11.7, t)); // pounce window (tail tip-up)
const pounceU = (t: number) => Math.min(1, Math.max(0, (t - 10.0) / 1.3));  // hop arc param
const finchW = (t: number) => ss(13.0, 13.4, t) * (1 - ss(14.6, 15.4, t));  // finch burst
const ravenW = (t: number) => ss(15.2, 15.8, t) * (1 - ss(19.0, 19.8, t));  // one high circle
const dawnT = (t: number) => ss(0.5, 4.0, t);                              // alpenglow arrives

// Fox progress — trot in, hold for the listen/pounce, trot out.
const foxX = (t: number) =>
  -0.14 + 0.58 * ss(3.0, 7.8, t) + 0.035 * pounceU(t) + 0.72 * ss(12.0, 18.0, t);
const foxY = (t: number) =>
  0.30 + 0.05 * Math.sin(Math.PI * pounceU(t)) * Math.abs(Math.sin(Math.PI * pounceU(t)))
  + 0.004 * Math.sin(t * 14) * (ss(3, 3.5, t) * (1 - listenT(t)) * (1 - pounceW(t)));

// Sun-glitter band sweeping the meadow (matches GLSL uBand).
const bandX = (t: number) => 0.12 + 0.55 * ss(2.0, 18.0, t);

const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);
const aToV = (ux: number, uy: number, out: THREE.Vector3) =>
  uvToWorld(0.269 + ux * 0.462, 0.159 + (uy - 0.03) / 1.107, out);

const BACK_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uFx;      // fox authored x
uniform float uFy;      // fox authored y
uniform float uListen;  // listen beat 0..1
uniform float uPounce;  // pounce window 0..1
uniform float uFinch;   // finch burst window 0..1
uniform float uRaven;   // raven circle window 0..1
uniform float uDawn;    // alpenglow 0..1
uniform float uBand;    // sun-glitter band x
out vec4 fragColor;

float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * n2(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}
float ellip(vec2 p, vec2 r) { return length(p / r) - 1.0; }

// --- fox silhouette ----------------------------------------------------------
float foxMask(vec2 uv, float t) {
  vec2 fp = uv - vec2(uFx, uFy);
  float on = smoothstep(-0.08, -0.02, uFx) * (1.0 - smoothstep(1.01, 1.07, uFx));
  // body ellipse; slight crouch at pounce peak
  vec2 b = fp - vec2(0.0, 0.016 - 0.007 * uPounce);
  float body = (1.0 - smoothstep(0.0, 0.006, ellip(b, vec2(0.052, 0.020))));
  // head, tilts down-forward during pounce, cocks sideways during listen
  vec2 hd = fp - vec2(0.046 + 0.010 * uPounce, 0.036 - 0.010 * uPounce);
  hd.y -= 0.008 * uListen * (hd.x - 0.05) * 2.0;  // head cock: rotate muzzle tip
  float head = (1.0 - smoothstep(0.0, 0.005, ellip(hd, vec2(0.018, 0.014))));
  // muzzle
  vec2 mz = hd - vec2(0.016, -0.002);
  float muzz = (1.0 - smoothstep(0.0, 0.004, ellip(mz, vec2(0.012, 0.007))));
  // ears: perk tall during listen, half-flattened otherwise
  float earH = 0.006 + 0.007 * uListen;
  vec2 e1 = fp - vec2(0.038 + 0.008 * uPounce, 0.046 - 0.014 * uPounce);
  vec2 e2 = fp - vec2(0.052 + 0.010 * uPounce, 0.048 - 0.014 * uPounce);
  float ear = (1.0 - smoothstep(0.0, 0.004, ellip(e1, vec2(0.0045, earH))))
            + (1.0 - smoothstep(0.0, 0.004, ellip(e2, vec2(0.0045, earH))));
  // tail: sweeps back; tips up during the pounce
  vec2 tp = fp - vec2(-0.050, 0.014 + 0.010 * uPounce);
  tp.y -= 0.010 * uPounce * (1.0 - smoothstep(-0.078, -0.050, tp.x));  // tip-up
  float tail = (1.0 - smoothstep(0.0, 0.005, ellip(tp, vec2(0.028, 0.013))));
  // legs: trot gait — two diagonal pairs alternate while moving; all still
  // during listen, front pair lifted during pounce
  float move = 1.0 - uListen - 0.6 * uPounce;
  float gait = sin(t * 11.0) * 0.010 * clamp(move, 0.0, 1.0);
  float legY = fp.y + 0.006;
  float legMask = step(legY, 0.010) * step(-0.008, legY);
  float l1 = (1.0 - smoothstep(0.002, 0.005, abs(fp.x - (0.028 + gait)))) * legMask;
  float l2 = (1.0 - smoothstep(0.002, 0.005, abs(fp.x - (-0.024 - gait)))) * legMask;
  float frontLift = uPounce * 0.010;
  float l3 = (1.0 - smoothstep(0.002, 0.005, abs(fp.x - (0.040 + frontLift)))) * legMask * (1.0 - uPounce);
  float legs = max(max(l1, l2), l3);
  return clamp(body + head + muzz + ear + tail + legs, 0.0, 1.0) * on;
}

float bandXish(vec2 uv, float band) { float d = uv.x - band; return exp(-d * d / 0.03); }

// --- backdrop -----------------------------------------------------------------
vec3 valley(vec2 uv, float t) {
  // sky: pale pre-dawn grey-violet warming to peach at the horizon
  vec3 col = mix(vec3(0.86, 0.74, 0.74), vec3(0.58, 0.55, 0.70), smoothstep(0.42, 0.85, uv.y));
  col += vec3(0.9, 0.6, 0.45) * exp(-9.0 * length(uv - vec2(0.20, 0.34))) * 0.45;
  // one thin lenticular cloud
  float lc = 1.0 - smoothstep(0.012, 0.05, ellip(uv - vec2(0.62, 0.80), vec2(0.085, 0.009)));
  col = mix(col, vec3(0.72, 0.66, 0.78), lc * 0.45);

  // mountain walls both sides: dark rock + snow caps catching first pink light
  // crest = the walls' top edge: tall at the frame edges (~0.95, exiting top),
  // dipping to a distant headwall ~0.60 at the valley throat — sky above it.
  // Walls fill from the ground up; the headwall rises only from the meadow top.
  float crest = 0.60
    + 0.38 * (1.0 - smoothstep(0.02, 0.30, uv.x))
    + 0.38 * smoothstep(0.64, 0.97, uv.x)
    + 0.05 * fbm(vec2(uv.x * 6.0, 3.7)) - 0.03;
  float floorY = 0.05 + 0.45 * (1.0 - smoothstep(0.60, 0.70, crest));
  float mtn = step(uv.y, crest) * smoothstep(floorY - 0.02, floorY + 0.07, uv.y);
  if (mtn > 0.0) {
    float rock = fbm(vec2(uv.x * 9.0, uv.y * 7.0));
    vec3 mcol = mix(vec3(0.13, 0.12, 0.16), vec3(0.22, 0.20, 0.26), rock);
    // snow cap above a jittered snowline
    float snow = smoothstep(crest - 0.16 - 0.04 * n2(vec2(uv.x * 14.0, 1.0)), crest - 0.06, uv.y)
               * smoothstep(0.58, 0.72, crest);  // caps on the tall walls only, not the throat
    vec3 snowCol = mix(vec3(0.72, 0.74, 0.82), vec3(1.0, 0.78, 0.70), 0.55 * uDawn);
    mcol = mix(mcol, snowCol, snow);
    // pink light on east-facing rock too
    mcol += vec3(0.35, 0.14, 0.08) * uDawn * (1.0 - snow) * 0.35;
    // aerial haze: the low distant throat rock sits much farther back
    mcol = mix(mcol, col, 0.45 * (1.0 - smoothstep(0.60, 0.75, crest)));
    col = mix(col, mcol, mtn);
  }
  // distant inner ridge silhouette at the valley throat
  float farR = 0.52 + 0.03 * fbm(vec2(uv.x * 8.0, 9.0));
  float farM = step(farR, uv.y) * step(uv.y, farR + 0.05) * (1.0 - mtn);
  col = mix(col, vec3(0.45, 0.42, 0.55), farM * 0.8);

  // meadow band
  float meadow = 1.0 - step(0.50, uv.y);
  if (meadow > 0.0) {
    vec3 mbase = mix(vec3(0.52, 0.55, 0.58), vec3(0.62, 0.62, 0.62), n2(uv * vec2(60.0, 30.0)));
    // frost sheen: cooler + brighter toward the sun band
    float bd = uv.x - uBand; float band = exp(-bd * bd / 0.02);
    mbase += vec3(0.22, 0.19, 0.14) * band * uDawn;
    // grass strokes
    float blade = n2(vec2(uv.x * 240.0, uv.y * 90.0)) * 0.08;
    mbase -= blade * (0.4 + 0.6 * (1.0 - band));
    // frost glitter: sparse twinkling crystals, dense inside the sun band
    vec2 cell = floor(uv * vec2(700.0, 300.0));
    float glint = step(0.9965 - 0.0028 * band, h2(cell + floor(t * 4.0)));
    mbase += vec3(1.0, 0.95, 0.85) * glint * (0.25 + 0.75 * band);
    col = mix(col, mbase, meadow * (1.0 - mtn));
  }

  // thin silver stream meandering the meadow floor
  float sx = 0.48 + 0.07 * sin(uv.y * 9.5 + 1.3) + 0.03 * sin(uv.y * 23.0);
  float strm = (1.0 - smoothstep(0.0035, 0.010, abs(uv.x - sx))) * (1.0 - step(0.50, uv.y)) * step(0.10, uv.y);
  vec3 wcol = mix(vec3(0.78, 0.82, 0.88), vec3(1.0, 0.85, 0.70), bandXish(uv, uBand) * uDawn);
  col = mix(col, wcol, strm * (0.55 + 0.45 * n2(vec2(uv.y * 200.0, t * 0.5))));

  // mist: thin fbm bands hugging the stream line + pooled drift, splitting
  // around the fox's passing
  float md = (uv.x - sx) * 3.0, pd = (uv.y - 0.38) * 14.0;
  float mistBand = exp(-md * md) * (1.0 - step(0.52, uv.y)) * step(0.12, uv.y)
                 + exp(-pd * pd);
  float drift = n2(vec2(uv.x * 8.0 - t * 0.08, uv.y * 30.0));
  float mist = mistBand * smoothstep(0.35, 0.75, drift + 0.25 * n2(vec2(uv.x * 20.0 + t * 0.05, uv.y * 60.0)));
  float fxd = uv.x - uFx;
  mist *= 1.0 - 0.75 * exp(-fxd * fxd / 0.004) * step(abs(uv.y - uFy), 0.07); // splits for the fox
  col = mix(col, vec3(0.80, 0.80, 0.86), clamp(mist, 0.0, 1.0) * 0.55);

  // raven: one high circle
  float ra = uRaven;
  if (ra > 0.001) {
    float ang = t * 1.4;
    vec2 rc = vec2(0.50, 0.82) + vec2(cos(ang), 0.35 * sin(ang)) * 0.10;
    vec2 rd = uv - rc;
    float flap = sin(t * 9.0) * 0.004;
    float rav = (1.0 - smoothstep(0.0, 0.004, ellip(rd, vec2(0.010, 0.004))))
              + (1.0 - smoothstep(0.0, 0.003, ellip(rd - vec2(0.0, flap + 0.004), vec2(0.016, 0.0025))));
    col = mix(col, vec3(0.05, 0.05, 0.08), clamp(rav, 0.0, 1.0) * 0.9 * ra);
  }

  // finch flock: 7 birds erupt from the far-right bush
  if (uFinch > 0.001) {
    vec2 bush = vec2(0.88, 0.33);
    float dt = t - 13.1;
    for (int i = 0; i < 7; i++) {
      float fi = float(i);
      vec2 v = vec2(0.10 + 0.05 * h2(vec2(fi, 1.0)), 0.16 + 0.08 * h2(vec2(fi, 7.0)))
             + vec2(-0.22 * h2(vec2(fi, 3.0)), 0.0);
      vec2 bp = bush + v * dt + vec2(0.0, -0.04 * dt * dt);
      bp.y += 0.006 * sin(t * 18.0 + fi * 2.1);
      float b = 1.0 - smoothstep(0.0, 0.0035, length((uv - bp) * vec2(1.0, 2.0)));
      col = mix(col, vec3(0.10, 0.09, 0.10), b * 0.85 * uFinch);
    }
  }
  // the bush itself (always present)
  float bush = 1.0 - smoothstep(0.0, 0.02, ellip(uv - vec2(0.88, 0.315), vec2(0.030, 0.020)));
  col = mix(col, vec3(0.16, 0.18, 0.15), bush * 0.8 * step(uv.y, 0.50));

  // the fox
  float fmask = foxMask(uv, t);
  if (fmask > 0.0) {
    // dark rust silhouette; pale underfur on belly + tail tip
    vec3 foxCol = vec3(0.30, 0.11, 0.05);
    float belly = fmask * (1.0 - smoothstep(0.006, 0.020, uv.y - (uFy - 0.004))) * step(uv.y, uFy + 0.016);
    foxCol = mix(foxCol, vec3(0.82, 0.74, 0.62), belly * 0.85);
    col = mix(col, foxCol, clamp(fmask, 0.0, 1.0) * 0.95);
  }
  return col;
}

void main() {
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 col = valley(uv, uT);
  fragColor = vec4(col, 1.0);
}`;

export default class FrostvalleyScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uFx: { value: 0 }, uFy: { value: 0.3 },
    uListen: { value: 0 }, uPounce: { value: 0 }, uFinch: { value: 0 },
    uRaven: { value: 0 }, uDawn: { value: 0 }, uBand: { value: 0.12 },
  };
  private p = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.bu, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);
    this.cam.position.set(0, 4.5, 30);
    this.cam.lookAt(0, 7, PZ + 10);
  }

  override render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const r = this.ctx.renderer;
    const t = _f.t;
    const listen = listenT(t);
    const pounce = pounceW(t);
    const dawn = dawnT(t);
    const fx = foxX(t), fy = foxY(t);

    this.bu.uT.value = t;
    this.bu.uFx.value = fx;
    this.bu.uFy.value = fy;
    this.bu.uListen.value = listen;
    this.bu.uPounce.value = pounce;
    this.bu.uFinch.value = finchW(t);
    this.bu.uRaven.value = ravenW(t);
    this.bu.uDawn.value = dawn;
    this.bu.uBand.value = bandX(t);

    // near-static: slight drift tracking the fox's trot, tiny push on the pounce
    const drift = Math.min(1, Math.max(0, fx)) - 0.5;
    this.cam.position.set(drift * 1.6, 4.5, 30 - 1.4 * pounce);
    this.cam.lookAt(0.5 + drift * 1.1, 7, PZ + 10);

    // diagnostics: fox + glitter-band probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        if (fx > -0.05 && fx < 1.05) {
          aToV(fx, fy + 0.03, this.p).project(this.cam);
          const fpx = (this.p.x * 0.5 + 0.5) * W, fpy = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'fox',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#c96a3a', globalAlpha: 0.9, layerId: 'frostvalley',
            bbox: [fpx - 30, fpy - 22, fpx + 30, fpy + 14],
            w: 60, h: 36, cx: fpx, cy: fpy, hPct: (36 / H) * 100, isStroke: false,
          });
        }
        aToV(Math.min(0.95, bandX(t)), 0.30, this.p).project(this.cam);
        const bx = (this.p.x * 0.5 + 0.5) * W, by = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'sun band',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#f0d8a8', globalAlpha: 0.75, layerId: 'frostvalley',
          bbox: [bx - 44, by - 20, bx + 44, by + 16],
          w: 88, h: 36, cx: bx, cy: by, hPct: (36 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.03 * pounce,
      bloom: 0.16 + 0.06 * dawn,
      bloomThreshold: 0.72,
      bloomRadius: 0.5,
      grade: { saturation: 1.06, gamma: 0.99 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      (m.material as THREE.Material | undefined)?.dispose?.();
      (m.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
    });
    super.dispose();
  }
}

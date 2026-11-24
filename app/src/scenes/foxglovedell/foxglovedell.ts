// foxglovedell — a shaded woodland dell at noon: foxglove spikes ringing a
// sunlit clearing, speckle-dapple, a lone wren working the mossy log edge.
// All motion is closed-form f(t). Authored uv [0,1] is remapped into the
// camera-visible vUv band (x~[0.27,0.73], y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const wrenT = (t: number) => ss(2.5, 8.6, t);           // patrol progress along the log 0→1 — done before the song
const songT = (t: number) => ss(9.0, 9.8, t) * (1 - ss(11.5, 12.6, t));  // song beat
const beeT = (t: number) => ss(12.5, 13.5, t) * (1 - ss(18.5, 19.5, t)); // bee visit window
const beeProg = (t: number) => ss(12.5, 18.5, t);       // bees climbing the lit spike 0→1
const shaftT = (t: number) => 0.55 + 0.45 * ss(1.5, 3.0, t); // shaft settles in after dawn-fade
const swayT = (t: number) => 0.5 + 0.5 * Math.sin(t * 0.5);  // gentle breeze

// Mirror of the wren's piecewise GLSL path — for the tracking probe.
const wrenXY = (p: number): [number, number] => {
  if (p < 0.45) return [0.04 + 0.18 * (p / 0.45), 0.315];
  if (p < 0.55) {
    const h = (p - 0.45) / 0.10;
    return [0.22 + 0.10 * h, 0.315 + 0.02 * Math.sin(h * Math.PI)];
  }
  return [0.32 - 0.20 * ((p - 0.55) / 0.45), 0.315];
};

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
uniform float uWren;    // patrol progress 0..1
uniform float uSong;    // singing beat 0..1
uniform float uBee;     // bee visit window 0..1
uniform float uBeeProg; // bee climb progress 0..1
uniform float uShaft;   // sun-shaft intensity
uniform float uSway;    // breeze amount
out vec4 fragColor;

float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x),
             mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * n2(p); p *= 2.03; a *= 0.5; }
  return v;
}

// --- foxglove spike layout: 7 spikes ringing the clearing
const int NS = 7;
vec2 spikeBase(int i) {
  float xs[7] = float[7](0.28, 0.355, 0.425, 0.500, 0.575, 0.645, 0.715);
  return vec2(xs[i], 0.30 + 0.045 * h2(vec2(float(i), 3.0)));
}
float spikeH(int i) { return 0.34 + 0.10 * h2(vec2(float(i), 7.0)); }
float spikeLean(int i, float t) {
  return 0.028 * sin(t * 0.6 + float(i) * 1.9) * uSway + (h2(vec2(float(i), 5.0)) - 0.5) * 0.05;
}

vec3 dell(vec2 uv, float t) {
  // --- deep shade backdrop: canopy wall behind the clearing
  vec3 col = mix(vec3(0.020, 0.045, 0.028), vec3(0.035, 0.075, 0.045), uv.y);
  // pale sky only through small canopy gaps at the very top
  {
    float gaps = smoothstep(0.60, 0.78, n2(vec2(uv.x * 9.0, 2.0)) - abs(uv.x - 0.5) * 0.9);
    // authored uv.y tops out near 0.78 — gaps live just under the visible rim
    col = mix(col, vec3(0.55, 0.68, 0.72), gaps * smoothstep(0.70, 0.77, uv.y) * 0.85);
    // leaf masses closing the frame
    float leaf = fbm(uv * vec2(14.0, 8.0) + vec2(0.0, t * 0.02));
    col *= 1.0 - 0.5 * smoothstep(0.45, 0.75, leaf) * smoothstep(0.55, 0.85, uv.y);
  }

  // --- sunlit grass clearing (bright ellipse, soft rim)
  vec2 cq = (uv - vec2(0.50, 0.30)) * vec2(1.0, 2.1);
  float clearing = 1.0 - smoothstep(0.16, 0.34, length(cq));
  {
    vec3 grass = mix(vec3(0.10, 0.20, 0.07), vec3(0.24, 0.34, 0.10), n2(uv * vec2(80.0, 160.0)));
    grass *= 0.85 + 0.3 * fbm(uv * vec2(40.0, 90.0));
    col = mix(col, grass * 1.9, clearing);
    // darker shade floor outside the clearing
    vec3 shade = mix(vec3(0.03, 0.06, 0.03), vec3(0.05, 0.10, 0.045), n2(uv * vec2(30.0, 70.0)));
    float floorZone = 1.0 - smoothstep(0.42, 0.58, uv.y);
    col = mix(col, shade, floorZone * (1.0 - clearing));
  }
  // moving canopy dapple on the clearing floor
  {
    float dp = fbm(uv * vec2(9.0, 16.0) + vec2(t * 0.045, -t * 0.02));
    float spots = smoothstep(0.55, 0.72, dp);
    col += vec3(0.55, 0.60, 0.22) * spots * clearing * 0.5;
  }

  // --- sun shaft: one diagonal beam from upper-left gap down to spike 3
  vec2 shaftDir = normalize(vec2(0.30, -0.95));
  vec2 shaftOrg = vec2(0.44, 0.98);
  vec2 sv = uv - shaftOrg;
  float along = dot(sv, shaftDir);
  float across = abs(sv.x * shaftDir.y - sv.y * shaftDir.x);
  float shaft = exp(-across * across * 900.0) * smoothstep(-0.02, 0.05, along) * (1.0 - smoothstep(0.55, 0.90, along));
  col += vec3(0.95, 0.85, 0.45) * shaft * 0.16 * uShaft;
  // pollen / dust motes drifting inside the shaft
  for (int m = 0; m < 9; m++) {
    float fm = float(m);
    vec2 mp = shaftOrg + shaftDir * fract(h2(vec2(fm, 31.0)) + t * (0.010 + 0.008 * h2(vec2(fm, 9.0))));
    mp.x += sin(t * 0.7 + fm * 2.4) * 0.012;
    float mot = 1.0 - smoothstep(0.0018, 0.0032, length(uv - mp));
    col += vec3(1.0, 0.92, 0.6) * mot * shaft * 0.8 * uShaft;
  }

  // --- mossy log edge, lower-left
  {
    float logZone = (1.0 - smoothstep(0.25, 0.255, uv.y)) * (1.0 - smoothstep(0.305, 0.315, uv.y))
      * (1.0 - smoothstep(0.24, 0.26, uv.x));
    vec3 bark = mix(vec3(0.06, 0.045, 0.03), vec3(0.09, 0.10, 0.05), n2(uv * vec2(120.0, 40.0)));
    bark += vec3(0.02, 0.08, 0.02) * smoothstep(0.5, 0.75, n2(uv * vec2(60.0, 25.0))); // moss
    col = mix(col, bark, logZone);
    // worn top edge highlight
    float rim = (1.0 - smoothstep(0.0, 0.006, abs(uv.y - 0.303))) * (1.0 - smoothstep(0.24, 0.26, uv.x));
    col += vec3(0.10, 0.12, 0.05) * rim * 0.7;
  }

  // --- fern undergrowth, lower-right fronds
  {
    float fz = step(0.72, uv.x) * (1.0 - smoothstep(0.30, 0.36, uv.y));
    float frond = smoothstep(0.35, 0.65, n2(vec2(uv.x * 26.0 - uv.y * 40.0, uv.y * 55.0)));
    col = mix(col, vec3(0.03, 0.09, 0.03), fz * frond * 0.85);
  }

  // --- foxglove spikes ringing the clearing
  for (int i = 0; i < NS; i++) {
    float fi = float(i);
    vec2 base = spikeBase(i);
    float hgt = spikeH(i);
    float lean = spikeLean(i, t);
    float topY = base.y + hgt;
    // stem: x bends with height (arching tip) + sway
    float stemX = base.x + lean * smoothstep(base.y, topY, uv.y) * 2.4;
    float stem = (1.0 - smoothstep(0.0018, 0.0030, abs(uv.x - stemX)))
      * step(base.y, uv.y) * (1.0 - smoothstep(topY - 0.01, topY + 0.005, uv.y));
    col = mix(col, vec3(0.05, 0.16, 0.05), stem * 0.9);
    // leaves at the base
    float lv = (1.0 - smoothstep(0.014, 0.020, length((uv - base) * vec2(1.0, 2.6)))) ;
    col = mix(col, vec3(0.04, 0.13, 0.04), lv * 0.85);
    // bells: drooping tubes along the upper two-thirds, one side
    for (int k = 0; k < 7; k++) {
      float fk = float(k);
      float v = 0.35 + 0.60 * (fk / 6.0);              // along-stem param (lower→tip)
      float by = base.y + hgt * v;
      float bx = base.x + lean * v * 2.4 + 0.011 + 0.004 * sin(fi * 3.0 + fk);
      float br = 0.0105 * (1.0 - 0.45 * fk / 6.0);      // smaller bells toward the tip
      vec2 bp = uv - vec2(bx, by);
      // tube + flared lip below it
      float tube = 1.0 - smoothstep(br * 0.7, br, length(bp * vec2(1.5, 1.0)));
      vec2 lp2 = bp - vec2(0.0, -br * 0.9);
      float lip = 1.0 - smoothstep(br * 0.8, br * 1.25, length(lp2 * vec2(1.0, 1.7)));
      float bell = max(tube, lip * step(lp2.y, 0.0));
      // seeded pink-purple shade per bell
      vec3 bellCol = mix(vec3(0.55, 0.20, 0.42), vec3(0.78, 0.42, 0.62), h2(vec2(fi, fk)));
      // interior speckle — dark spots inside the bell mouth
      float speck = step(0.82, h2(floor(uv * vec2(700.0, 700.0)) + vec2(fi, fk)));
      bellCol = mix(bellCol, vec3(0.30, 0.08, 0.25), speck * 0.8);
      // translucency: the lit spike glows from inside the shaft
      float lit = (i == 3) ? 1.0 : 0.0;
      bellCol += vec3(0.85, 0.45, 0.55) * lit * uShaft * 0.9;
      col = mix(col, bellCol, bell * 0.95);
      // darker bell mouth shadow
      col = mix(col, bellCol * 0.55, lip * step(lp2.y, 0.0) * smoothstep(br * 0.45, br * 0.8, length(lp2 * vec2(1.0, 1.7))) * 0.6);
    }
  }

  // --- fallen foxglove flower at the clearing edge
  {
    vec2 fp = uv - vec2(0.585, 0.185);
    float fl = 1.0 - smoothstep(0.006, 0.009, length(fp * vec2(1.0, 1.9)));
    col = mix(col, vec3(0.60, 0.25, 0.48), fl * 0.85);
  }

  // --- the wren: patrol along the log with tail flicks, dart to spike base,
  //     then pause to sing once
  {
    // piecewise progress: log walk → hop to spike-2 base → back, pauses
    float p = uWren;
    float wx;
    float wy = 0.315;
    if (p < 0.45) {
      wx = 0.04 + 0.18 * (p / 0.45);
    } else if (p < 0.55) {
      float h = (p - 0.45) / 0.10;
      wx = 0.22 + 0.10 * h;
      wy = 0.315 + 0.02 * sin(h * 3.1416);   // little hop arc
    } else {
      wx = 0.32 - 0.20 * ((p - 0.55) / 0.45);
      wy = 0.315 + 0.012 * sin((p - 0.55) * 25.0);
    }
    wx = clamp(wx, 0.03, 0.34);
    float bob = 0.004 * sin(t * 9.0) * (1.0 - uSong);
    vec2 wp = uv - vec2(wx, wy + bob);
    // body
    float wren = 1.0 - smoothstep(0.0075, 0.0095, length(wp * vec2(1.0, 1.35)));
    // head
    wren = max(wren, 1.0 - smoothstep(0.0042, 0.0055, length(wp - vec2(0.006, 0.008))));
    // tail: thin wedge flicking up (flickers)
    float flick = 0.5 + 0.5 * sin(t * 11.0);
    vec2 tp = wp - vec2(-0.008, 0.004 + 0.003 * flick);
    float tail = (1.0 - smoothstep(0.0015, 0.003, abs(tp.x - tp.y * 0.7))) * (1.0 - smoothstep(0.010, 0.014, tp.y)) * step(0.0, tp.y);
    wren = max(wren, tail);
    // beak: during the song it tilts up and opens (two diverging slivers)
    vec2 bk = wp - vec2(0.011, 0.010 + 0.004 * uSong);
    // slivers open AND tilt upward for the song: the upper slope steepens
    // more than the lower (~+13° centerline at full song)
    float openUp = 0.2 + 1.3 * uSong;
    float openDn = 0.2 + 0.5 * uSong;
    float beakUp = 1.0 - smoothstep(0.0012, 0.0020, abs(bk.y - bk.x * openUp));
    float beakDn = 1.0 - smoothstep(0.0012, 0.0020, abs(bk.y + bk.x * openDn));
    float beak = max(beakUp, beakDn) * step(abs(bk.x), 0.008) * step(abs(bk.y), 0.006);
    wren = max(wren, beak);
    // throat feathers puff during song
    float throat = (1.0 - smoothstep(0.004, 0.006, length(wp - vec2(0.005, 0.003)))) * uSong;
    col = mix(col, vec3(0.05, 0.035, 0.02), clamp(wren + throat, 0.0, 1.0) * 0.95);
  }

  // --- two bees working up the lit spike; one crawls into a bell
  {
    float lit3x = spikeBase(3).x + spikeLean(3, t);
    for (int b = 0; b < 2; b++) {
      float fb = float(b);
      // bee 0 leads the climb and reaches the top bell (>0.85) — bee 1 trails
      float v = clamp(uBeeProg * (0.55 + 0.45 * (1.0 - fb)) + 0.10 * fb, 0.0, 1.0);
      // wobble around the stem while climbing
      // wobble eases out as the bee commits to the bell — no step jump
      float commit = smoothstep(0.78, 0.88, v);
      vec2 bp2 = vec2(lit3x + 0.011 + 0.014 * sin(t * 6.0 + fb * 4.0) * (1.0 - 0.9 * commit),
                      spikeBase(3).y + spikeH(3) * (0.35 + 0.60 * v) + 0.006 * sin(t * 9.0 + fb) * (1.0 - 0.9 * commit));
      // bee 0 crawls INTO the top bell late: tucks to the bell mouth and shrinks
      float into = (b == 0) ? smoothstep(0.85, 1.0, v) : 0.0;
      bp2 = mix(bp2, vec2(spikeBase(3).x + spikeLean(3, t) * 2.4 + 0.011, spikeBase(3).y + spikeH(3) * 0.95 - 0.008), into);
      vec2 bd = (uv - bp2) / (1.0 - 0.55 * into);
      float bee = 1.0 - smoothstep(0.0035, 0.0050, length(bd * vec2(1.0, 1.5)));
      bee *= 1.0 - into;
      // wing shimmer
      bee *= 0.75 + 0.25 * sin(t * 46.0 + fb * 7.0);
      col = mix(col, vec3(0.45, 0.30, 0.06), bee * uBee * 0.95);
    }
  }

  // heavy shade vignette: canopy presses in at all edges
  col *= 1.0 - 0.62 * smoothstep(0.42, 0.95, length((uv - vec2(0.5, 0.45)) * vec2(1.0, 1.15)));
  return col;
}

void main() {
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 col = dell(uv, uT);
  fragColor = vec4(col, 1.0);
}`;

export default class FoxglovedellScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uWren: { value: 0 }, uSong: { value: 0 },
    uBee: { value: 0 }, uBeeProg: { value: 0 }, uShaft: { value: 0.55 },
    uSway: { value: 0.5 },
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
    const song = songT(t);

    this.bu.uT.value = t;
    this.bu.uWren.value = wrenT(t);
    this.bu.uSong.value = song;
    this.bu.uBee.value = beeT(t);
    this.bu.uBeeProg.value = beeProg(t);
    this.bu.uShaft.value = shaftT(t);
    this.bu.uSway.value = swayT(t);

    // very low, near-static: slight drift around the log's focal line so the
    // spike ring slowly re-frames; a barely-there lean-in when the wren sings
    this.cam.position.set(-1 + Math.sin(t * 0.06) * 1.3, 4.5, 30 - 0.9 * song);
    this.cam.lookAt(0.5 + Math.sin(t * 0.06) * 0.7, 7, PZ + 10);

    // diagnostics: wren + lit-spike probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const [wpx, wpy] = wrenXY(wrenT(t));
        aToV(wpx, wpy, this.p).project(this.cam);
        const wx = (this.p.x * 0.5 + 0.5) * W, wy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'wren',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#d8b98a', globalAlpha: 0.9, layerId: 'foxglovedell',
          bbox: [wx - 30, wy - 22, wx + 30, wy + 14],
          w: 60, h: 36, cx: wx, cy: wy, hPct: (36 / H) * 100, isStroke: false,
        });
        aToV(0.512, 0.62, this.p).project(this.cam);
        const sx = (this.p.x * 0.5 + 0.5) * W, sy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'lit spike',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#f0a8cc', globalAlpha: 0.75, layerId: 'foxglovedell',
          bbox: [sx - 38, sy - 20, sx + 38, sy + 16],
          w: 76, h: 36, cx: sx, cy: sy, hPct: (36 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.04 * song,
      bloom: 0.16 + 0.10 * song,
      bloomThreshold: 0.72,
      bloomRadius: 0.5,
      grade: { saturation: 1.08, gamma: 0.99 },
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

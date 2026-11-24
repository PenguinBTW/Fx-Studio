// venetianmoor — a narrow Venice canal at blue hour: wet marble steps, a moored
// gondola, lamplight smearing on the water. All motion is closed-form f(t).
// Authored uv [0,1] is remapped into the camera-visible vUv band
// (x~[0.27,0.73], y~[0.16,0.84]) at the BACK_FRAG call site.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const flareT = (t: number) => ss(3.5, 4.3, t) * (1 - ss(6.0, 7.5, t));     // lamp flare beat
const swingE = (t: number) => 0.30 + 0.70 * ss(7.0, 8.0, t) * (1 - ss(10.5, 12.0, t)); // gondola swing energy
const crossT = (t: number) => ss(11.5, 14.5, t);                            // gondolier bridge crossing 0→1
const ratT = (t: number) => ss(15.0, 16.2, t);                              // rat scuttle across steps
const pigeonT = (t: number) => ss(5.0, 5.8, t) * (1 - ss(9.0, 9.8, t));     // pigeon on the lamp
const catT = (t: number) => ss(17.5, 18.6, t);                              // cat tail-tip slips away
const debrisT = (t: number) => 0.55 + 0.45 * ss(16.0, 19.0, t);            // drift speed eases late

const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);
// authored [0,1] → camera-visible vUv band (exact inverse of the remap)
const aToV = (ux: number, uy: number, out: THREE.Vector3) =>
  uvToWorld(0.269 + ux * 0.462, 0.159 + (uy - 0.03) / 1.107, out);

// --- backdrop --------------------------------------------------------------
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
uniform float uFlare;   // lamp flare pulse
uniform float uSwing;   // gondola swing energy 0..1
uniform float uCross;   // gondolier bridge crossing 0..1
uniform float uRat;     // rat scuttle 0..1
uniform float uPigeon;  // pigeon perched on lamp 0..1
uniform float uCat;     // cat tail slip 0..1
uniform float uDrift;   // debris drift speed factor
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

// canal wall edges converge with height (corridor recedes upward)
float wallL(float y) { return 0.30 + 0.13 * smoothstep(0.0, 0.62, y); }
float wallR(float y) { return 0.70 - 0.13 * smoothstep(0.0, 0.62, y); }

vec3 canalScene(vec2 uv, float t) {
  // --- dusk sky sliver above the corridor
  vec3 col = mix(vec3(0.10, 0.13, 0.20), vec3(0.16, 0.20, 0.30), uv.y);
  col += vec3(0.30, 0.22, 0.18) * 0.4 * (1.0 - smoothstep(0.70, 0.92, uv.y));

  // --- facades: weathered brick + plaster, left and right converging walls
  float inL = 1.0 - smoothstep(wallL(uv.y) - 0.004, wallL(uv.y), uv.x);
  float inR = smoothstep(wallR(uv.y), wallR(uv.y) + 0.004, uv.x);
  float wall = max(inL, inR);
  {
    vec3 brick = mix(vec3(0.15, 0.10, 0.085), vec3(0.20, 0.13, 0.10), n2(uv * vec2(60.0, 44.0)));
    brick *= 0.85 + 0.15 * n2(uv * vec2(140.0, 9.0));      // horizontal coursing
    brick *= 1.0 - 0.35 * fbm(uv * vec2(8.0, 18.0));       // damp streaks
    // window grid: small dark barred recesses on both walls
    vec2 gw = vec2(inL > 0.5 ? uv.x / max(wallL(uv.y), 0.05) : uv.x, uv.y);
    vec2 cell = vec2(fract(gw.x * 7.0 + floor(gw.y * 5.0) * 0.37), fract(gw.y * 5.0));
    float win = step(0.30, cell.x) * (1.0 - step(0.62, cell.x)) * step(0.25, cell.y) * (1.0 - step(0.58, cell.y));
    win *= step(0.62, uv.y) * wall;
    brick = mix(brick, vec3(0.02, 0.02, 0.04), win * 0.95);
    // bars on the windows
    float bar = step(abs(cell.x - 0.46), 0.012) + step(abs(cell.y - 0.42), 0.010);
    brick += vec3(0.12, 0.11, 0.11) * min(bar, 1.0) * win;
    col = mix(col, brick, wall);
  }
  // shuttered balcony, left wall
  {
    float b = (1.0 - smoothstep(0.050, 0.054, abs(uv.x - 0.115))) * (1.0 - smoothstep(0.026, 0.030, abs(uv.y - 0.80)));
    float slats = 0.5 + 0.5 * sin(uv.y * 900.0);
    col = mix(col, vec3(0.05, 0.04, 0.06), b * (0.6 + 0.3 * slats) * inL);
    float rail = (1.0 - smoothstep(0.002, 0.004, abs(uv.y - 0.771))) * (1.0 - smoothstep(0.058, 0.062, abs(uv.x - 0.115)));
    col = mix(col, vec3(0.02, 0.02, 0.03), rail * inL);
  }
  // faint blue wash from an upper-left window
  {
    float w = (1.0 - smoothstep(0.030, 0.034, abs(uv.x - 0.10))) * (1.0 - smoothstep(0.022, 0.026, abs(uv.y - 0.875)));
    col += vec3(0.30, 0.45, 0.60) * w * 0.5 * inL;
    col += vec3(0.20, 0.30, 0.45) * exp(-length((uv - vec2(0.10, 0.875)) * vec2(1.0, 1.6)) * 18.0) * 0.22 * inL;
  }

  // --- distant arch bridge + hanging lantern under it
  float deckY = 0.640 + 0.010 * sin(uv.x * 4.0);
  vec2 ap = (uv - vec2(0.545, 0.575)) * vec2(1.0, 2.6);
  float arch = (1.0 - smoothstep(0.075, 0.082, length(ap))) * step(0.345, uv.x) * step(uv.x, 0.745);
  {
    float deck = smoothstep(0.42, 0.50, uv.y) * (1.0 - smoothstep(deckY - 0.002, deckY + 0.002, uv.y)) * (1.0 - wall);
    float stone = clamp(deck - arch, 0.0, 1.0);
    col = mix(col, vec3(0.07, 0.06, 0.09), stone * 0.95);
    // dark canal visible through the arch opening (not sky)
    vec3 under = mix(vec3(0.04, 0.06, 0.09), vec3(0.06, 0.09, 0.12), n2(uv * vec2(40.0, 160.0)));
    col = mix(col, under, arch * (1.0 - wall));
    // parapet posts on the deck line
    float posts = step(0.94, h2(vec2(floor(uv.x * 60.0), 3.0))) * smoothstep(deckY, deckY + 0.004, uv.y) * (1.0 - smoothstep(deckY + 0.018, deckY + 0.024, uv.y)) * (1.0 - wall);
    col = mix(col, vec3(0.06, 0.05, 0.08), posts * 0.9);
    // lantern hanging under the arch — one warm dot
    float lant = exp(-dot(uv - vec2(0.545, 0.558), uv - vec2(0.545, 0.558)) * 26000.0);
    col += vec3(1.0, 0.65, 0.30) * lant * (0.8 + 0.2 * sin(t * 7.0));
  }

  // --- gondolier crossing the bridge once (brief)
  {
    float gx = 0.40 + 0.28 * uCross;
    vec2 gp = uv - vec2(gx, deckY + 0.012);
    float figure = (1.0 - smoothstep(0.004, 0.007, abs(gp.x))) * (1.0 - smoothstep(0.012, 0.016, gp.y)) * step(0.0, gp.y);
    figure += 1.0 - smoothstep(0.0035, 0.0060, length(gp - vec2(0.0, 0.017)));
    // oar pole angled forward from the figure's shoulder
    float pole = (1.0 - smoothstep(0.0012, 0.0025, abs(gp.x - 0.004 - gp.y * 0.9))) * step(0.004, gp.y) * (1.0 - smoothstep(0.020, 0.026, gp.y));
    float crossing = step(0.004, uCross) * step(uCross, 0.995);
    col = mix(col, vec3(0.02, 0.015, 0.03), clamp(figure + pole, 0.0, 1.0) * crossing * 0.95);
  }

  // --- marble steps descending into the water, near-left
  {
    float stepsZone = (1.0 - smoothstep(0.335, 0.345, uv.x)) * (1.0 - smoothstep(0.30, 0.32, uv.y));
    float band = floor((0.30 - uv.y) / 0.055);
    float shade = 0.85 - band * 0.14;
    vec3 marble = vec3(0.46, 0.44, 0.43) * shade;
    marble *= 0.85 + 0.15 * n2(uv * vec2(90.0, 160.0));
    // worn nosing line on each step edge
    float edge = 1.0 - smoothstep(0.0, 0.008, fract((0.30 - uv.y) / 0.055));
    marble = mix(marble, vec3(0.22, 0.20, 0.21), edge * 0.65);
    col = mix(col, marble, stepsZone);
  }

  // --- canal water between the walls
  float water = (1.0 - smoothstep(0.545, 0.555, uv.y)) * (1.0 - wall);
  {
    // slow rolling ripple wobble
    vec2 wq = uv;
    wq.x += sin(uv.y * 140.0 + t * 1.8) * 0.004 + sin(uv.y * 55.0 - t * 1.1) * 0.006;
    vec3 wc = mix(vec3(0.05, 0.09, 0.13), vec3(0.09, 0.15, 0.20), smoothstep(0.0, 0.55, wq.y));
    wc *= 0.9 + 0.1 * n2(wq * vec2(30.0, 200.0));
    // sky reflection hint near the top of the water band
    wc += vec3(0.10, 0.12, 0.18) * smoothstep(0.42, 0.54, wq.y) * 0.6;
    col = mix(col, wc, water);

    // lamplight smear: long golden band below the lamp, swaying with the ripples
    float smearX = 0.655 + sin(uv.y * 34.0 + t * 1.6) * 0.012 + sin(uv.y * 90.0 - t * 2.3) * 0.004;
    float smear = exp(-(uv.x - smearX) * (uv.x - smearX) * 5200.0) * (1.0 - smoothstep(0.06, 0.50, uv.y));
    smear *= 0.78 + 0.22 * sin(uv.y * 170.0 + t * 2.6);
    col += vec3(1.0, 0.62, 0.22) * smear * water * (0.45 + 0.55 * (0.35 + 0.65 * uFlare));

    // lapping rings where water meets the steps' bottom corner
    vec2 rp = uv - vec2(0.24, 0.265);
    float rings = sin(length(rp * vec2(1.0, 2.0)) * 120.0 - t * 4.0);
    float ringA = exp(-length(rp * vec2(1.0, 2.0)) * 9.0) * smoothstep(-0.2, 0.4, rings);
    col += vec3(0.30, 0.35, 0.40) * ringA * water * 0.30;

    // floating debris drifting past the gondola
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      // decelerating drift: speed eases off during the settle act (integral of 1-0.45*ss(16,19))
      float du = clamp((t - 16.0) / 3.0, 0.0, 1.0);
      float iss = du * du * du * (3.0 - 1.5 * du) + max(t - 19.0, 0.0);
      float dx = fract(h2(vec2(fi, 7.0)) + 0.016 * (t - 0.45 * iss) * (0.6 + 0.4 * fi));
      vec2 dp = uv - vec2(0.30 + dx * 0.35, 0.30 + 0.045 * fi + 0.004 * sin(t * 2.0 + fi * 3.0));
      float deb = 1.0 - smoothstep(0.0025, 0.0045, length(dp * vec2(1.0, 1.8)));
      col = mix(col, vec3(0.10, 0.10, 0.08), deb * water * 0.8);
    }
  }

  // --- moored gondola: black hull swinging on its rope
  {
    vec2 gp = vec2(0.475 + 0.010 * uSwing * sin(t * 0.9), 0.335);
    // hull: long shallow crescent, ~15% of the corridor width
    vec2 hq = (uv - gp) * vec2(1.0, 3.0);
    float hull = 1.0 - smoothstep(0.082, 0.088, length(hq));
    hull *= smoothstep(0.012, 0.016, hq.y) * step(hq.y, 0.022); // shallow waist band
    col = mix(col, vec3(0.012, 0.010, 0.018), hull * water);
    // upturned prow at the right tip
    vec2 pp = uv - (gp + vec2(0.070, 0.020));
    float prow = 1.0 - smoothstep(0.005, 0.007, length(pp * vec2(1.0, 0.55)));
    col = mix(col, vec3(0.012, 0.010, 0.018), prow * water);
    // mooring rope from bow to a cleat on the right wall
    vec2 r0 = gp + vec2(0.055, 0.008), r1 = vec2(0.615, 0.42);
    vec2 rq = uv - r0;
    float rl = length(rq - clamp(dot(rq, r1 - r0) / dot(r1 - r0, r1 - r0), 0.0, 1.0) * (r1 - r0));
    float rope = 1.0 - smoothstep(0.0008, 0.0016, rl);
    col = mix(col, vec3(0.14, 0.11, 0.08), rope * 0.7);
    // hull reflection streak
    float refl = exp(-(uv.x - gp.x) * (uv.x - gp.x) * 3000.0) * smoothstep(gp.y - 0.10, gp.y - 0.02, uv.y) * (1.0 - smoothstep(gp.y - 0.004, gp.y, uv.y));
    col += vec3(0.02, 0.03, 0.05) * refl * water;
  }

  // --- wrought-iron lamp on the right corner + glow
  {
    vec2 lp = vec2(0.662, 0.545);
    float post = (1.0 - smoothstep(0.0018, 0.0032, abs(uv.x - lp.x - (uv.y - lp.y) * 0.06))) * (1.0 - smoothstep(0.02, 0.035, lp.y - uv.y)) * step(lp.y - 0.14, uv.y) * step(uv.y, lp.y);
    col = mix(col, vec3(0.03, 0.02, 0.03), post * 0.9);
    // bracket + lantern head
    vec2 lh = uv - (lp + vec2(0.012, -0.028));
    float head = 1.0 - smoothstep(0.010, 0.013, max(abs(lh.x) * 1.4, abs(lh.y)));
    col = mix(col, vec3(0.05, 0.03, 0.03), head * 0.9);
    // warm glow — breathes with the flare beat
    float glow = exp(-dot(uv - (lp + vec2(0.012, -0.028)), uv - (lp + vec2(0.012, -0.028))) * 2200.0);
    col += vec3(1.0, 0.60, 0.24) * glow * (0.50 + 0.85 * uFlare);
    // pigeon silhouette perched on the head
    vec2 pg = uv - (lp + vec2(0.012, -0.012));
    float pig = 1.0 - smoothstep(0.0045, 0.0065, length(pg * vec2(1.3, 1.0)));
    pig += 1.0 - smoothstep(0.002, 0.003, length(pg - vec2(0.005, 0.006)));
    col = mix(col, vec3(0.04, 0.03, 0.05), clamp(pig, 0.0, 1.0) * uPigeon * 0.95);
  }

  // --- rat scuttling the steps once (dart-pause-dart profile)
  {
    // dart - pause - dart: progress plateaus mid-run before the second dart
    float rr = uRat < 0.42 ? uRat * 1.2 : (uRat < 0.58 ? 0.504 : 0.504 + (uRat - 0.58) * 1.2);
    float moving = 1.0 - step(0.42, uRat) * (1.0 - step(0.58, uRat));
    float rx = 0.04 + 0.24 * (rr + 0.04 * (0.5 + 0.5 * sin(uRat * 21.0)) * uRat * (1.0 - uRat) * moving);
    vec2 rpp = uv - vec2(rx, 0.235);
    float rat = 1.0 - smoothstep(0.005, 0.008, length(rpp * vec2(1.0, 1.9)));
    rat += 1.0 - smoothstep(0.003, 0.004, length(rpp - vec2(-0.009, 0.004) * vec2(1.0, 1.9)));
    float show = step(0.004, uRat) * step(uRat, 0.995);
    col = mix(col, vec3(0.04, 0.03, 0.04), clamp(rat, 0.0, 1.0) * show * 0.9);
  }

  // --- cat tail-tip vanishing down the right alley edge
  {
    vec2 cp = uv - vec2(0.652 - 0.03 * uCat, 0.300 - 0.07 * uCat);
    float tail = (1.0 - smoothstep(0.0025, 0.0045, abs(cp.x - cp.y * 0.5))) * (1.0 - smoothstep(0.016, 0.022, cp.y)) * step(0.0, cp.y);
    col = mix(col, vec3(0.03, 0.02, 0.04), tail * (1.0 - uCat) * step(0.004, uCat) * 0.9);
  }

  // vignette + cool air at the edges
  col *= 1.0 - 0.35 * smoothstep(0.55, 1.05, length(uv - vec2(0.5, 0.42)));
  return col;
}

void main() {
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 col = canalScene(uv, uT);
  fragColor = vec4(col, 1.0);
}`;

export default class VenetianmoorScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uFlare: { value: 0 }, uSwing: { value: 0.3 },
    uCross: { value: 0 }, uRat: { value: 0 }, uPigeon: { value: 0 },
    uCat: { value: 0 }, uDrift: { value: 0.55 },
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
    const flare = flareT(t);

    this.bu.uT.value = t;
    this.bu.uFlare.value = flare;
    this.bu.uSwing.value = swingE(t);
    this.bu.uCross.value = crossT(t);
    this.bu.uRat.value = ratT(t);
    this.bu.uPigeon.value = pigeonT(t);
    this.bu.uCat.value = catT(t);
    this.bu.uDrift.value = debrisT(t);

    // very low, near-static: slight drift down-canal so the facades parallax;
    // subtle push-in during the lamp flare
    this.cam.position.set(-1 + Math.sin(t * 0.07) * 1.4, 4.5, 30 - 1.6 * flare);
    this.cam.lookAt(1 + Math.sin(t * 0.07) * 0.8, 7, PZ + 10);

    // diagnostics: gondola + lamp probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        aToV(0.475 + 0.010 * swingE(t) * Math.sin(t * 0.9), 0.335, this.p).project(this.cam);
        const gx = (this.p.x * 0.5 + 0.5) * W, gy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'gondola',
          fontFamily: 'Archivo, sans-serif', fontPx: 22,
          fillStyle: '#9db4d8', globalAlpha: 0.9, layerId: 'venetianmoor',
          bbox: [gx - 40, gy - 24, gx + 40, gy + 16],
          w: 80, h: 40, cx: gx, cy: gy, hPct: (40 / H) * 100, isStroke: false,
        });
        aToV(0.674, 0.517, this.p).project(this.cam);
        const lx = (this.p.x * 0.5 + 0.5) * W, ly = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'lamp',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#ffc98a', globalAlpha: 0.75, layerId: 'venetianmoor',
          bbox: [lx - 26, ly - 20, lx + 26, ly + 16],
          w: 52, h: 36, cx: lx, cy: ly, hPct: (36 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.05 * flare,
      bloom: 0.22 + 0.20 * flare,
      bloomThreshold: 0.70,
      bloomRadius: 0.55,
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

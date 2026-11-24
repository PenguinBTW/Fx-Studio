// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// porchlight — a wall lamp at night drawing a circling moth swarm, a cat
// watching from the step. One fullscreen GLSL pass holds the shot: dark brick
// wall, warm lamp top-right with falloff cone + breathing hotspot, porch step
// edge low in frame, a door seam with an inner crack glow left. ~26 moths
// orbit the lamp on noisy ellipses (radius jitter, pendulum direction flips,
// epoch re-seeds so despawned moths return fresh; a third rest on the shade
// mid-cycle). Moths over the glass read as dark cut-outs and dapple the wall
// hotspot. The cat's head tracks the nearest moth, ears perk, one paw swipe;
// a beetle climbs the wall, a stray moth visits the door crack, a spider
// descends once at the frame edge. All closed-form f(t), hash seeds only.
// CameraRig is near-static with a slight push-in toward the lamp; Layer2D
// holds anchored captions (the canvas probe hook records them).
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { CameraRig } from '../../engine/rig';
import { Layer2D, W, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const VERT = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

const float ASPECT = 320.0 / 140.0;
// beats
const float SWARM = 1.5;   // swarm thickens
const float TRACK = 4.0;   // cat begins tracking
const float SWIPE = 8.4;   // paw swipe at a low pass
const float STRAY = 11.5;  // stray moth visits the door crack
const float SPIDER = 13.5; // spider descends at the frame edge
const float SETTLE = 16.0;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 h2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h2(i).x, h2(i + vec2(1.0, 0.0)).x, u.x),
    mix(h2(i + vec2(0.0, 1.0)).x, h2(i + vec2(1.0, 1.0)).x, u.x),
    u.y);
}
float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float sdist(vec2 a, vec2 b, vec2 r) {
  vec2 d = (a - b) / r;
  return dot(d, d);
}
float sbox(vec2 p, vec2 c, vec2 b) {
  vec2 d = abs(p - c) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}

// ---------- porch geometry ----------
const vec2 LP = vec2(0.700, 0.820); // lamp center
const float LR = 0.030;             // shade radius (uv y-units)
const float DOORX = 0.235;          // door seam on the left
const float STEPY = 0.380;          // porch step edge across the lower frame
const vec2 CAT = vec2(0.390, STEPY + 0.028); // cat seated on the step

// warm falloff of the lamplight on the wall
float lampFall(vec2 uv) {
  vec2 d = uv - LP; d.x *= ASPECT;
  return exp(-dot(d, d) * 90.0) + 0.35 * exp(-dot(d, d) * 18.0);
}
// one moth orbit: noisy ellipse around LP, direction drifts (pendulum term);
// each epoch re-seeds radius/phase so a despawned moth "respawns" fresh
vec2 mothPos(float i, float t, out float alive, out float landed) {
  float ph0 = h1(i * 9.7);
  float per = 3.5 + 2.0 * h1(i * 3.1);
  float cyc = (t + ph0 * per) / per;
  float epoch = floor(cyc);
  float fr = fract(cyc);
  float sd = i * 17.0 + epoch * 31.0;
  alive = sstep(0.0, 0.08, fr) * (1.0 - sstep(0.90, 1.0, fr));
  // a third of the moths rest on the shade mid-epoch, then lift off again
  landed = step(0.66, h1(sd + 2.0)) * sstep(0.35, 0.42, fr) * (1.0 - sstep(0.55, 0.62, fr));
  float rx = (0.024 + 0.070 * h1(sd)) / ASPECT;
  float ry = 0.018 + 0.058 * h1(sd + 1.0);
  float w = (1.2 + 2.4 * h1(sd + 3.0)) * (h1(sd + 4.0) < 0.5 ? -1.0 : 1.0);
  float ph = h1(sd + 5.0) * 6.2832;
  // pendulum reversals: orbit direction flips without discontinuity
  float a = ph + w * t + 1.5 * sin(t * (0.7 + 0.5 * h1(sd + 6.0)) + sd);
  vec2 p = LP + vec2(rx * cos(a), ry * sin(a));
  p += vec2(0.006 * sin(t * (9.0 + i) + i), 0.005 * sin(t * (11.0 + i * 0.7) + i * 2.0)) / vec2(ASPECT, 1.0);
  vec2 land = LP + vec2((h1(sd + 7.0) - 0.5) * 1.8 * LR / ASPECT, -LR * (0.3 + 0.6 * h1(sd + 8.0)));
  p = mix(p, land, landed);
  if (i < 0.5) {
    // moth 0 makes the low pass the cat swipes at
    float dip = sstep(SWIPE - 0.9, SWIPE + 0.1, t) * (1.0 - sstep(SWIPE + 0.35, SWIPE + 1.15, t));
    p = mix(p, CAT + vec2(-0.028, 0.048) + vec2(0.008 * sin(t * 18.0) / ASPECT, 0.005 * sin(t * 23.0)), dip);
    alive = max(alive, dip);
    landed *= 1.0 - dip;
  }
  return p;
}
// moth silhouette: body + wings fluttering as a fast scale flicker
float mothAt(vec2 uv, vec2 p, float i, float t) {
  vec2 dd = uv - p; dd.x *= ASPECT;
  float flap = abs(sin(t * (26.0 + i * 1.7) + i * 2.0));
  float wings = 1.0 - sstep(0.0, 0.0042, length(dd / vec2(0.8 + 0.9 * flap, 0.35 + 0.45 * (1.0 - flap))));
  float body = 1.0 - sstep(0.0, 0.0022, length(dd / vec2(0.45, 1.0)));
  return max(wings, body);
}
// cat: seated silhouette — haunches, chest, tracking head, ears, tail, paw
float catAt(vec2 uv, vec2 headP, float tailFlick, float paw, float ear) {
  float m = 0.0;
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, CAT + vec2(-0.010, -0.012), vec2(0.030 / ASPECT, 0.028)));
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, CAT + vec2(0.010, 0.015), vec2(0.020 / ASPECT, 0.034)));
  vec2 hp = CAT + vec2(0.012, 0.048) + headP;
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, hp, vec2(0.014 / ASPECT, 0.012)));
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, hp + vec2(-0.008, 0.011 + 0.003 * ear), vec2(0.004 / ASPECT, 0.005 + 0.003 * ear)));
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, hp + vec2(0.007, 0.011 + 0.003 * ear), vec2(0.004 / ASPECT, 0.005 + 0.003 * ear)));
  float tx = CAT.x - 0.030 + 0.010 * sin(tailFlick * 3.0);
  m += sstep(0.0035, 0.0, seg(uv, CAT + vec2(-0.028, -0.030), vec2(tx, CAT.y - 0.032 + 0.006 * tailFlick)));
  if (paw > 0.0) {
    vec2 pb = CAT + vec2(-0.002 - 0.028 * paw, 0.012 + 0.030 * paw);
    m += sstep(0.004, 0.0, seg(uv, CAT + vec2(0.004, 0.010), pb)) * paw;
    m += (1.0 - sstep(0.4, 1.0, sdist(uv, pb, vec2(0.007 / ASPECT, 0.006)))) * paw;
  }
  return clamp(m, 0.0, 1.0);
}
// beetle climbing the wall slowly near the lamp
vec2 beetleAt(float t) {
  float u = clamp(t / 18.0, 0.0, 1.0);
  return vec2(0.575 + 0.012 * sin(u * 9.0), 0.60 + u * 0.16);
}
// spider descending on a thread at the frame edge, once
vec2 spiderAt(float t, out float th) {
  float u = clamp((t - 13.5) / 3.2, 0.0, 1.0);
  float y = 0.95 - u * 0.42;
  th = sstep(0.0, 0.1, u) * (1.0 - sstep(0.92, 1.0, u));
  return vec2(0.212, y);
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // deep-night wall: cool dark brick, mortar coursing, faint noise grain
  vec3 col = vec3(0.055, 0.058, 0.072);
  col *= 0.9 + 0.2 * vn(uv * vec2(160.0, 120.0));
  float mortar = step(0.5, fract(uv.y * 36.0)) * 0.022 + step(0.5, fract(uv.x * 26.0 + floor(uv.y * 36.0) * 0.5)) * 0.013;
  col -= vec3(mortar * 0.4);
  col *= 0.75 + 0.5 * sstep(0.0, 1.0, uv.x);

  // porch step: darker slab below the edge line, worn lip catching lamplight
  float stepMask = sstep(STEPY + 0.004, STEPY, uv.y);
  col = mix(col, vec3(0.038, 0.040, 0.050), stepMask * 0.9);
  float lip = sstep(0.003, 0.0, abs(uv.y - STEPY)) * sstep(0.30, 0.62, uv.x);
  col += vec3(0.22, 0.15, 0.08) * lip * (0.4 + 0.6 * lampFall(vec2(uv.x, STEPY)));

  // door seam left + warm inner crack glow (a sliver of hallway light)
  float seam = sstep(0.0035, 0.0, abs(uv.x - DOORX)) * sstep(0.36, 0.40, uv.y);
  col = mix(col, vec3(0.02, 0.02, 0.026), seam * 0.9);
  float crack = sstep(0.0016, 0.0, abs(uv.x - (DOORX + 0.006))) * sstep(0.40, 0.42, uv.y) * sstep(0.70, 0.66, uv.y);
  float crackGlow = 0.75 + 0.25 * sin(t * 1.3);
  col += vec3(0.55, 0.30, 0.10) * crack * crackGlow;

  // lamplight: halo + wall hotspot, breathing very slightly
  float pulse = 0.94 + 0.06 * sin(t * 0.9) * sin(t * 0.37);
  vec2 ld = uv - LP; ld.x *= ASPECT;
  col += vec3(0.90, 0.55, 0.22) * lampFall(uv) * 0.55 * pulse;
  col += vec3(1.0, 0.72, 0.34) * exp(-dot(ld, ld) * 700.0) * pulse * 1.4;

  // the lamp itself: metal bracket + glowing glass shade
  float bracket = sstep(0.004, 0.0, seg(uv, LP + vec2(0.020 / ASPECT, 0.035), LP + vec2(0.004 / ASPECT, 0.010)))
                + sstep(0.004, 0.0, seg(uv, LP + vec2(0.020 / ASPECT, 0.035), vec2(0.745, 0.925)));
  col = mix(col, vec3(0.10, 0.09, 0.08), clamp(bracket, 0.0, 1.0) * 0.9);
  float shade = sdist(uv, LP, vec2(LR / ASPECT, LR));
  float glass = 1.0 - sstep(0.6, 1.0, shade);
  col = mix(col, vec3(1.0, 0.80, 0.45) * pulse, glass * 0.92);
  col *= 1.0 - 0.25 * glass * step(0.6, fract(atan(uv.y - LP.y, (uv.x - LP.x) * ASPECT) * 3.82));

  // swarm: 26 moths — masks for cut-outs, wall dapple, cat tracking
  float moths = 0.0;
  float mothsOnLamp = 0.0;
  vec2 nearP = vec2(0.0); float nearD = 1e9;
  float thick = sstep(1.5, 5.0, t); // swarm thickens after the quiet open
  for (int i = 0; i < 26; i++) {
    float fi = float(i);
    if (h1(fi * 5.3) > thick) continue;
    float alive, landed;
    vec2 p = mothPos(fi, t, alive, landed);
    if (alive <= 0.01) continue;
    float m = mothAt(uv, p, fi, t) * alive;
    moths += m;
    mothsOnLamp += m * (1.0 - sstep(0.7, 1.0, sdist(uv, LP, vec2(LR * 1.6 / ASPECT, LR * 1.6))));
    vec2 cp = p - (CAT + vec2(0.012, 0.048)); cp.x *= ASPECT;
    float cd = dot(cp, cp);
    if (cd < nearD && p.y < 0.78) { nearD = cd; nearP = p; }
  }
  col -= vec3(0.35, 0.22, 0.10) * clamp(moths, 0.0, 1.0) * lampFall(uv) * 0.35;
  col = mix(col, vec3(0.05, 0.045, 0.04), clamp(mothsOnLamp, 0.0, 1.0) * glass * 0.85);
  col = mix(col, vec3(0.045, 0.040, 0.035), clamp(moths - mothsOnLamp * 0.5, 0.0, 1.0) * 0.9);

  // stray moth: drifts to the door-crack glow and back, 11.5→14.8s
  if (t > 11.5 && t < 14.8) {
    float u = (t - 11.5) / 3.3;
    vec2 a = LP + vec2(-0.05 / ASPECT, -0.03);
    vec2 b = vec2(DOORX + 0.012, 0.55);
    float sw = sin(u * 3.1416);
    vec2 p = mix(a, b, sw * sw) + vec2(0.02 * sin(t * 7.0) / ASPECT, 0.015 * sin(t * 9.0));
    col = mix(col, vec3(0.05, 0.045, 0.04), mothAt(uv, p, 9.0, t) * sstep(0.0, 0.1, u) * (1.0 - sstep(0.94, 1.0, u)));
  }

  // beetle climbing the wall
  vec2 bp = beetleAt(t);
  float beetle = 1.0 - sstep(0.4, 1.0, sdist(uv, bp, vec2(0.0045 / ASPECT, 0.006)));
  beetle += sstep(0.0015, 0.0, seg(uv, bp + vec2(0.0, 0.005), bp + vec2(0.0, 0.009)));
  col = mix(col, vec3(0.03, 0.028, 0.026), clamp(beetle, 0.0, 1.0) * 0.9);

  // spider on its thread at the frame edge
  float th;
  vec2 sp = spiderAt(t, th);
  if (th > 0.0) {
    col += vec3(0.10, 0.10, 0.11) * sstep(0.0009, 0.0, abs(uv.x - sp.x)) * sstep(sp.y, 0.98, uv.y) * th * 0.5;
    float bd = 1.0 - sstep(0.4, 1.0, sdist(uv, sp, vec2(0.0045 / ASPECT, 0.005)));
    col = mix(col, vec3(0.03, 0.028, 0.026), bd * th * 0.95);
  }

  // cat: head eases toward the nearest moth; ears perk ~7s; paw swipe 8.4s
  vec2 hp = vec2(0.0);
  if (nearD < 1e9) {
    vec2 dir = normalize(nearP - (CAT + vec2(0.012, 0.048)));
    hp = dir * min(0.010, sqrt(nearD) * 0.04) * sstep(4.0, 5.0, t);
  }
  float ear = 0.3 + 0.7 * (0.5 + 0.5 * sin(t * 0.6)) * sstep(6.8, 7.2, t);
  float paw = (t > 8.4 && t < 9.1) ? sin((t - 8.4) / 0.7 * 3.1416) : 0.0;
  float flick = 0.5 + 0.5 * sin(t * 1.1 + sin(t * 0.43) * 2.0);
  col = mix(col, vec3(0.028, 0.026, 0.030), catAt(uv, hp, flick, paw, ear) * 0.95);
  float catTop = sstep(0.002, 0.0, abs(uv.y - (CAT.y + 0.045 + hp.y))) * sstep(0.35, 0.42, uv.x) * sstep(0.46, 0.40, uv.x);
  col += vec3(0.30, 0.18, 0.07) * catTop * lampFall(uv) * 0.6;

  // corner falloff for the night close-up
  vec2 vc = uv - vec2(0.5, 0.62); vc.x *= ASPECT;
  col *= 1.0 - 0.30 * sstep(0.25, 0.75, dot(vc, vc));

  fragColor = vec4(col, 1.0);
}
`;

const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 2.8, 'the lamp keeps its own weather', [0.5, 0.28]],
  [4.6, 6.4, 'the cat watches', [0.42, 0.30]],
  [8.2, 9.6, 'a low pass', [0.5, 0.30]],
  [11.6, 13.4, 'the door leaks light', [0.38, 0.34]],
  [14.8, 17.0, 'the porch holds the night', [0.5, 0.28]],
];

export default class PorchlightScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private u = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    const geo = new THREE.PlaneGeometry(PW, PH);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(geo, mat);
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      swarm: t >= 1.5 && t <= 18 ? 1 : 0,
      swipe: t >= 8.4 && t <= 9.1 ? 1 : 0,
      settle: t >= 16.0 && t <= 18.0 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: near-static close-up — a slight push-in toward the lamp as
    // the swarm thickens, easing back for the settle.
    const push = ss(2.0, 10.0, t) * (1 - ss(15.5, 17.5, t));
    this.rig.position = [
      8.0 + 0.6 * Math.sin(t * 0.05),
      12.0 + 0.3 * Math.sin(t * 0.06 + 1.0),
      76.0 - 2.5 * push,
    ];
    this.rig.target = [
      10.0 + 0.5 * Math.sin(t * 0.045),
      13.5 + 0.3 * ss(4.0, 8.0, t),
      PZ,
    ];
    this.rig.roll = 0.001 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text, auv] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        const [awx, awy] = uv2w(auv[0], auv[1]);
        const ndc = this.v.set(awx, awy, PZ + 0.4).project(this.cam);
        if (ndc.z > 1) continue;
        const cx0 = (ndc.x * 0.5 + 0.5) * W;
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(10, 14, 20, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e8edf3';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.4,
      bloomThreshold: 0.65,
      bloomRadius: 0.7,
      ca: 0.08,
      grain: 0.07,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

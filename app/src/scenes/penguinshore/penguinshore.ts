// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// penguinshore — gentoo penguins porpoising ashore onto a pebble beach at
// polar dusk. Backdrop shader: pale pink-blue polar sky with a low sun
// smear, layered sea swell advancing shoreward with whitecap stripes, a
// dark pebble beach band receding right, distant bergs catching pink
// tops, and thin blowing-snow streaks at the horizon. All life is drawn
// in-shader on closed-form f(t): a 12-penguin porpoise chain (breach →
// dive arcs with spray fans that catch the sun), a seal shadow crossing
// the shallows once (breaches hesitate while it passes), 4–5 waddlers
// climbing the beach pause-look-waddle with a water-shake on landing, a
// skua diving once over the colony edge, and a gathering colony of
// standing birds. CameraRig pans along the landing zone and pushes in
// for the gather beat. World-anchored probe captions ride the pan.
// Everything is f(t) — no accumulators.
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
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Waterline between sea and pebble beach — recedes up to the right.
float beachY(float x) {
  return 0.295 + 0.135 * smoothstep(0.35, 0.95, x);
}

// Penguin silhouette: plump body ellipse + head bump, rotated by rot
// (radians; +y body axis, so rot = travelAngle - PI/2 for swimming).
float peng(vec2 p, vec2 c, float rot, float s) {
  vec2 q = p - c;
  float cr = cos(rot), sr = sin(rot);
  q = vec2(q.x * cr + q.y * sr, -q.x * sr + q.y * cr);
  // lengths below are normalized by the ellipse radii — edges in units
  // of body radius, not uv
  float body = 1.0 - smoothstep(0.55, 0.85, length(q / vec2(s * 0.62, s)));
  vec2 hd = q - vec2(0.0, s * 0.78);
  float head = 1.0 - smoothstep(0.45, 0.75, length(hd / vec2(s * 0.34, s * 0.32)));
  return max(body, head);
}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;
  float wl = beachY(x);

  // --- pale pink-blue polar sky ---------------------------------------------
  vec3 col = mix(vec3(0.86, 0.70, 0.66), vec3(0.52, 0.60, 0.78), smoothstep(0.46, 0.85, y));
  col = mix(col, vec3(0.94, 0.76, 0.62), smoothstep(0.40, 0.50, y) * (1.0 - smoothstep(0.50, 0.62, y)) * 0.7);
  // faint high cloud bands
  float cl = smoothstep(0.70, 0.85, sin(y * 60.0 + x * 8.0 + 1.0));
  col += vec3(0.05, 0.04, 0.06) * cl * smoothstep(0.55, 0.75, y);

  // dusk cooling: the palette slides cooler and dims late in the scene
  float cool = smoothstep(15.5, 19.5, t);
  col = mix(col, col * vec3(0.82, 0.88, 1.04), cool * 0.40);

  // --- distant bergs catching pink tops -------------------------------------
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float bx = 0.14 + fk * 0.34 + 0.002 * sin(t * 0.05 + fk);
    float bw = 0.075 + 0.035 * hash1(fk * 7.7);
    float by = 0.470 + 0.028 * sin((x - bx) * 42.0 + fk * 4.0) + 0.008 * sin(x * 130.0 + fk);
    float berg = (1.0 - smoothstep(bw, bw + 0.01, abs(x - bx))) * (1.0 - smoothstep(by, by + 0.002, y)) * step(0.468, y);
    vec3 bergCol = mix(vec3(0.72, 0.78, 0.88), vec3(0.95, 0.70, 0.62), smoothstep(by - 0.016, by - 0.004, y));
    col = mix(col, bergCol, berg * 0.9);
  }

  // --- sea: layered swell advancing shoreward + whitecap stripes ------------
  float sea = (1.0 - smoothstep(0.464, 0.468, y)) * step(wl - 0.012, y);
  vec3 water = mix(vec3(0.10, 0.14, 0.21), vec3(0.17, 0.24, 0.33), smoothstep(0.30, 0.47, y));
  // swell crests: discrete foam lines advancing shoreward, broken up so
  // they read as wavelets rather than continuous blinds
  float crestPh = y * 95.0 - x * 22.0 + t * 1.4
                + 3.0 * sin(x * 15.0) + 1.5 * sin(x * 41.0 + y * 30.0);
  float crest = smoothstep(0.55, 0.95, sin(crestPh));
  float crestDark = smoothstep(0.5, 0.95, -sin(crestPh));
  // wavelets break up and die near the horizon
  float choppy = 0.45 + 0.55 * sin(x * 57.0 + y * 110.0 + t * 0.3);
  float calm = 1.0 - 0.55 * cool; // the sea settles late
  water += vec3(0.16, 0.19, 0.22) * crest * choppy * calm;
  water -= vec3(0.05, 0.05, 0.06) * crestDark * calm;
  // whitecap stripes, strongest near the breaking zone
  float bz = 1.0 - smoothstep(0.005, 0.075, abs(y - wl - 0.045));
  float caps = smoothstep(0.55, 0.92, sin(x * 80.0 - t * 2.2 + y * 24.0)) * bz;
  water += vec3(0.55, 0.60, 0.66) * caps * 0.55;
  // foam at the waterline, pulsing with the swell
  float foam = 1.0 - smoothstep(0.002, 0.018, abs(y - wl - 0.004 * sin(t * 1.6 + x * 9.0)));
  water += vec3(0.60, 0.64, 0.68) * foam * 0.7;
  // low sun smear on the water — a warm pink lane under the glow
  float lane = exp(-((x - 0.30) * 10.0) * ((x - 0.30) * 10.0));
  float laneMask = (1.0 - smoothstep(0.455, 0.465, y)) * smoothstep(wl - 0.01, wl + 0.02, y);
  water += vec3(0.55, 0.32, 0.22) * lane * laneMask * 0.5;
  col = mix(col, water, sea);

  // --- low sun smear at the horizon -----------------------------------------
  vec2 sd = vec2((x - 0.30) * 3.0, (y - 0.452) * 18.0);
  float smear = exp(-dot(sd, sd) * 1.4);
  col += vec3(1.05, 0.60, 0.36) * smear * (1.0 - cool * 0.45);

  // --- thin blowing-snow streaks at the horizon ------------------------------
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float sy = 0.456 + 0.006 * fk + 0.004 * sin(t * 0.2 + fk);
    float sx = fract(0.15 + fk * 0.19 + t * (0.008 + 0.004 * hash1(fk * 3.3)));
    float dxs = (x - sx) * 26.0, dys = (y - sy) * 240.0;
    col += vec3(0.85, 0.88, 0.95) * exp(-dxs * dxs) * exp(-dys * dys) * 0.22;
  }

  // --- pebble beach: dark gravel band below the waterline --------------------
  float beach = 1.0 - smoothstep(wl - 0.002, wl + 0.002, y);
  vec3 peb = vec3(0.085, 0.075, 0.085);
  float spk = hash1(floor(x * 320.0) * 0.31 + floor(y * 320.0) * 7.77);
  peb += vec3(0.030, 0.027, 0.030) * spk;
  peb *= 0.80 + 0.3 * smoothstep(0.0, wl, y);
  // cold rim + wet sheen right at the waterline
  float wetd = (wl - y) * 30.0;
  float wetEdge = exp(-wetd * wetd) * 0.45;
  peb += vec3(0.10, 0.13, 0.18) * wetEdge;
  col = mix(col, peb, beach);

  // --- seal shadow cruising the shallows (breaches hesitate) -----------------
  float sealGate = 1.0 - smoothstep(12.0, 12.6, t) * (1.0 - smoothstep(14.2, 15.2, t));
  if (t > 11.6 && t < 15.8) {
    float sp = smoothstep(11.8, 15.4, t);
    float sx2 = mix(0.06, 0.94, sp);
    float sy2 = beachY(sx2) + 0.018 + 0.004 * sin(t * 2.0);
    // ellipse lengths are normalized by their radii — edges in body-radius units
    float seal = 1.0 - smoothstep(0.55, 0.9, length((vUv - vec2(sx2, sy2)) / vec2(0.050, 0.011)));
    // slight head bump at the leading edge
    float shead = 1.0 - smoothstep(0.45, 0.8, length((vUv - vec2(sx2 + 0.048, sy2 + 0.006)) / vec2(0.016, 0.010)));
    col = mix(col, vec3(0.07, 0.09, 0.12), max(seal, shead) * 0.85);
  }

  // --- porpoise chain: ~12 penguins, breach → dive arcs with spray -----------
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float h1 = hash1(fi * 7.13), h2 = hash1(fi * 3.77), h3 = hash1(fi * 11.9);
    float t0 = 4.0 + fi * 0.45 + h1 * 0.5;
    float dur = 5.0 + h2 * 1.5;
    float pr = (t - t0) / dur;
    if (pr <= 0.0) continue;
    float x0 = 0.05 + 0.08 * h3;
    float x1 = 0.56 + 0.10 * h1;
    float px = mix(x0, x1, min(pr, 1.0)) + 0.010 * sin(t * 1.7 + h1 * 6.0);
    float r = 0.8 + 0.5 * h2; // arcs per second
    float ph = fract((t - t0) * r);
    float pwl = beachY(px) + 0.006;
    if (ph < 0.55 && sealGate > 0.02 && pr < 1.0) {
      float bp = ph / 0.55;
      float bh = 0.055 + 0.028 * h1;
      float py = pwl + bh * sin(bp * 3.1416);
      // body aligned to the arc's velocity direction
      float vx = (x1 - x0) / dur;
      float vy = bh * 3.1416 * cos(bp * 3.1416) * r / 0.55;
      float rot = atan(vy, vx) - 1.5708;
      float sz = 0.034 + 0.012 * h2;
      float pg = peng(vUv, vec2(px, py), rot, sz) * sealGate;
      col = mix(col, vec3(0.08, 0.08, 0.11), pg * 0.95);
      // white belly flash on the breach
      float belly = peng(vUv, vec2(px, py), rot, sz * 0.55) * step(0.15, bp) * (1.0 - step(0.75, bp));
      col = mix(col, vec3(0.82, 0.84, 0.88), belly * 0.5 * sealGate);
      // spray fan on the first fraction of the breach; sun-side rays glint
      if (bp < 0.16) {
        float fade = (1.0 - bp / 0.16) * sealGate;
        for (int k = 0; k < 5; k++) {
          float ka = 0.9 + (float(k) - 2.0) * 0.38;
          vec2 dir = vec2(cos(ka), abs(sin(ka)));
          float dl = segDist(vUv, vec2(px, pwl), vec2(px, pwl) + dir * 0.055);
          float streak = (1.0 - smoothstep(0.0025, 0.0055, dl)) * fade;
          vec3 scol = mix(vec3(0.75, 0.80, 0.88), vec3(0.98, 0.72, 0.50), step(dir.x, 0.0));
          col = mix(col, scol, streak * 0.8);
        }
      }
    }
    // landed penguin stays upright at the waterline (no upper bound on the
    // stand window — it keeps standing once the crossing is done)
    if ((pr > 0.92 && ph >= 0.55) || pr >= 1.0) {
      float stand = peng(vUv, vec2(px, pwl + 0.014), 0.0, 0.030);
      col = mix(col, vec3(0.08, 0.08, 0.11), stand * 0.9);
    }
  }

  // --- waddlers: pause-look-waddle up the beach toward the colony ------------
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float h1 = hash1(fi * 5.31 + 2.0), h2 = hash1(fi * 9.7 + 1.0);
    float t0 = 9.5 + fi * 1.2 + h1 * 0.6;
    float steps = (t - t0) / 1.5;
    if (steps <= 0.0) continue;
    float si = floor(steps), sf = fract(steps);
    float adv = clamp((si + min(sf / 0.60, 1.0)) / 4.0, 0.0, 1.0);
    float wx = mix(0.60 + 0.05 * h1, 0.82 + 0.028 * fi + 0.012 * h2, adv)
             + 0.010 * sin(adv * 9.0 + fi); // curved path wander
    float wy = beachY(wx) - 0.014;
    // waddle lean during steps, upright look during pauses
    float lean = sin(steps * 6.2832) * 0.12 * step(sf, 0.60);
    // water shake right after landing
    float shake = sin(t * 22.0) * 0.18 * step(0.0, t - t0) * step(t - t0, 0.7);
    float wsize = 0.030 + 0.008 * h2;
    float wadd = peng(vUv, vec2(wx, wy), lean + shake, wsize);
    col = mix(col, vec3(0.08, 0.08, 0.11), wadd * 0.95);
    // shed-droplets sparkle during the shake
    if (t - t0 < 0.7 && t - t0 > 0.0) {
      for (int k = 0; k < 3; k++) {
        vec2 dp = vec2(wx + (float(k) - 1.0) * 0.010 + 0.004 * sin(t * 30.0 + float(k)),
                       wy + 0.004 + float(k) * 0.008 - (t - t0) * 0.010);
        float drop = 1.0 - smoothstep(0.0012, 0.0028, length(vUv - dp));
        col += vec3(0.7, 0.75, 0.85) * drop * 0.5;
      }
    }
  }

  // --- colony: standing birds gathering at the right edge --------------------
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h1 = hash1(fi * 4.51 + 7.0), h2 = hash1(fi * 6.13 + 3.0);
    float arrive = 10.5 + fi * 0.9 + h1 * 0.4;
    float a = smoothstep(arrive, arrive + 0.8, t);
    if (a <= 0.0) continue;
    float cxx = 0.84 + 0.016 * fi + 0.020 * h1;
    float cyy = beachY(cxx) - 0.013 - 0.006 * h2;
    // tiny idle shuffle
    float shuf = 0.05 * sin(t * (0.8 + h1) + fi * 2.0);
    float cpen = peng(vUv, vec2(cxx, cyy), shuf, 0.030 + 0.006 * h2) * a;
    col = mix(col, vec3(0.08, 0.08, 0.11), cpen * 0.95);
  }

  // --- skua diving once over the colony edge (timed to the second pan leg
  // so both wide and narrow exports keep it in frame) -------------------------
  if (t > 13.0 && t < 14.0) {
    float sp = (t - 13.0) / 1.0;
    float kx = mix(0.80, 0.58, sp);
    float ky = 0.60 - 0.11 * sin(sp * 3.1416);
    vec2 bd = (vUv - vec2(kx, ky)) * vec2(2.2, 5.0);
    float skua = 1.0 - smoothstep(0.010, 0.017, length(bd));
    col = mix(col, vec3(0.06, 0.06, 0.09), skua * 0.9);
  }

  fragColor = vec4(col, 1.0);
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;
const uv2w = (ux: number, uy: number): [number, number] => [(ux - 0.5) * PW, PY + (uy - 0.5) * PH];

// [tin, tout, text, anchorUv] — captions are anchored to points on the
// backdrop and projected through the camera, so they travel with the pan
const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.8, 'polar dusk — empty shore', [0.30, 0.42]],
  [5.5, 9.5, 'porpoising through the break', [0.35, 0.37]],
  [11.0, 15.0, 'first ashore', [0.68, 0.44]],
  [15.2, 19.0, 'the colony gathers', [0.88, 0.50]],
];

export default class PenguinshoreScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private rig = new CameraRig();
  private layer = new Layer2D(W, H);
  private u = { uT: { value: 0 } };
  private v = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low pan tracking the landing zone (uv 0.40 → ~0.74 in
    // world x), with a slight push toward the colony for the gather beat.
    // Narrow frames pan FURTHER so the colony still lands in frame; the
    // path dwells on the surf break while the porpoise chain crosses.
    const halfW = 104.0 * Math.tan(0.5 * 40 * Math.PI / 180) * (this.ctx.W / this.ctx.H);
    // cap the end point so the backdrop's right edge never enters frame:
    // right frame edge ≈ targetX + halfW + 4.7 (pos offset), backdrop ends at 160
    const targetEnd = Math.min(Math.max(76.8, 121.6 - 0.75 * halfW), Math.max(30.0, 154.0 - halfW));
    let targetX: number;
    if (halfW >= 60.0) {
      const pan = ss(2, 16, t) * ((targetEnd + 32.0) / 108.8);
      targetX = -32.0 + 108.8 * pan;
    } else {
      // narrow path: hold the surf zone through the chain, then continue
      // right so the colony + gathered birds close the scene
      const tMid = 6.0 + 0.55 * halfW;
      targetX = -32.0 + (tMid + 32.0) * ss(2, 8, t)
              + (targetEnd - tMid) * ss(10.5, 16.5, t);
    }
    // never let either frame edge leave the backdrop (160 units each side,
    // minus margin); on frames wider than the backdrop, hold the centre
    const lo = -155.0 + halfW;
    const hi = 155.0 - halfW;
    targetX = lo < hi ? Math.min(Math.max(targetX, lo), hi) : 0.0;
    const push = ss(12, 17, t);
    this.rig.position = [targetX + 4.0 + 0.7 * Math.sin(t * 0.05), 7.0, 24.0 - 3.5 * push];
    this.rig.target = [targetX, 4.0 + 2.0 * push, PZ];
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // probe captions (textProbes auto-emit via the main.ts canvas hook)
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
        const cy = (0.5 - ndc.y * 0.5) * H + H * 0.18;
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(5, 6, 10, 0.9)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f2ecea';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.5,
      bloom: 0.3,
      bloomThreshold: 0.72,
      bloomRadius: 0.7,
      ca: 0.08,
      grain: 0.05,
      vignette: 0.5,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

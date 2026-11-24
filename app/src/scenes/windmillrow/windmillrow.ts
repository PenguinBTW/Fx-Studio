// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// windmillrow — three old windmills turning over golden farmland at last
// light. Backdrop shader: layered dusk-band sky on a warm→cool arc, a low
// sun at the horizon edge, thin lit cloud streaks, rolling wheat-field
// contours with wind waves passing through the rows, a ridge silhouette,
// three mill bodies (tapered tower + cap + tail vane, nearest partial at
// frame left), a hare bounding the near row once, a crow resting on the
// tail vane briefly, birds crossing on a long diagonal, long shadows as
// the sky cools. Rotors are instanced quads with a 4-blade silhouette,
// closed-form rotation per mill (different rates + yaw wobble), warm rim
// when a blade crosses the sun lane. CameraRig pans along the ridge and
// settles on the near mill. Everything is f(t) — no accumulators.
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
const frac = (x: number) => x - Math.floor(x);

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
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), u);
}

// mill silhouette helper: tapered tower + cap + tail vane, in uv space
float millBody(vec2 uv, float mx, float base, float h, float w) {
  float dy = uv.y - base;
  if (dy < 0.0 || dy > h * 1.22) return 0.0;
  float taper = 1.0 - 0.55 * smoothstep(0.0, h, dy);
  float body = (1.0 - smoothstep(w * taper, w * taper + 0.004, abs(uv.x - mx)))
             * step(dy, h);
  // cap: rounded roof just above the tower
  vec2 cd = vec2((uv.x - mx) * 1.6, (dy - h * 1.06) * 1.1);
  float cap = 1.0 - smoothstep(0.028, 0.040, length(cd));
  // tail vane: thin stick + small flag behind the cap (right side)
  float vane = (1.0 - smoothstep(0.0035, 0.006, abs(dy - h * 1.10)))
             * step(mx + 0.010, uv.x) * step(uv.x, mx + 0.045);
  float flag = (1.0 - smoothstep(0.010, 0.016, abs(dy - h * 1.10)))
             * step(mx + 0.042, uv.x) * step(uv.x, mx + 0.062);
  return max(max(body, cap), max(vane, flag));
}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;

  // --- sky: layered dusk bands on a warm→cool arc --------------------------
  vec3 low   = vec3(0.55, 0.30, 0.12);
  vec3 gold  = vec3(0.72, 0.42, 0.16);
  vec3 rose  = vec3(0.45, 0.22, 0.22);
  vec3 indig = vec3(0.10, 0.10, 0.24);
  vec3 col = mix(low, gold, smoothstep(0.36, 0.50, y));
  col = mix(col, rose,  smoothstep(0.52, 0.68, y));
  col = mix(col, indig, smoothstep(0.70, 0.96, y));

  // dusk cooling: the whole scene desaturates blue through the last beats
  float cool = smoothstep(13.0, 18.5, t);
  col = mix(col, col * vec3(0.72, 0.82, 1.10) + vec3(0.0, 0.0, 0.03), cool * 0.55);

  // --- sun low at the right horizon edge, fading as it sets ----------------
  float sunY = 0.455 - 0.05 * cool;
  vec2 sd = vec2((x - 0.80) * 1.5, (y - sunY) * 1.5);
  float sunD = length(sd);
  float sunGlow = exp(-sunD * sunD * 14.0);
  float sunDisc = 1.0 - smoothstep(0.018, 0.026, sunD);
  col += vec3(1.0, 0.62, 0.22) * sunGlow * (1.0 - cool * 0.55);
  col += vec3(1.0, 0.78, 0.42) * sunDisc * (1.0 - cool * 0.7);

  // --- thin cloud streaks catching the light -------------------------------
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    float cy = 0.62 + fk * 0.075 + 0.02 * sin(t * 0.04 + fk);
    float cx = fract(0.15 + fk * 0.27 + t * 0.006);
    float w = 0.10 + 0.08 * hash1(fk * 3.7);
    float cwx = (x - cx) / w, cwy = (y - cy) * 90.0;
    float cstr = exp(-cwx * cwx) * exp(-cwy * cwy);
    float lit = 0.5 + 0.5 * smoothstep(0.55, 0.85, cy); // upper streaks colder
    col += mix(vec3(0.65, 0.38, 0.20), vec3(0.30, 0.28, 0.40), lit) * cstr * 0.35;
  }

  // --- ridge silhouette ----------------------------------------------------
  float ridgeY = 0.415 + 0.012 * sin(x * 9.0 + 1.3) + 0.006 * sin(x * 23.0);
  float ridge = 1.0 - smoothstep(0.0, 0.004, y - ridgeY);
  col = mix(col, vec3(0.16, 0.11, 0.10), ridge * 0.9);

  // --- rolling wheat-field contours -----------------------------------------
  float rows = 0.5 + 0.5 * sin(y * 96.0 + 2.4 * sin(x * 21.0) + 1.1 * sin(x * 55.0));
  vec3 wheatA = vec3(0.46, 0.33, 0.14);
  vec3 wheatB = vec3(0.62, 0.46, 0.19);
  vec3 field = mix(wheatA, wheatB, rows);
  // far field lighter in the haze, near field deeper
  field = mix(field, col, 0.55 * smoothstep(0.30, 0.415, y));
  // wind waves: a brightness front sweeping left→right while the wind blows
  float wind = smoothstep(5.0, 9.0, t) * (1.0 - smoothstep(17.0, 19.5, t));
  float wave = sin(x * 34.0 - t * 2.3 + y * 16.0) * wind;
  field += vec3(0.10, 0.08, 0.03) * max(0.0, wave) * (0.6 + 0.4 * rows);
  field -= vec3(0.06, 0.05, 0.03) * max(0.0, -wave) * 0.7;
  // long shadows stretching late: slanted bands thrown left-down from
  // each mill's base, lengthening as the sun drops
  float shadow = 0.0;
  for (int m = 0; m < 3; m++) {
    float mx = m == 0 ? 0.28 : (m == 1 ? 0.55 : 0.78);
    float ms = m == 0 ? 1.0 : (m == 1 ? 0.6 : 0.35);
    float d = x - mx; // shadow reaches left of the tower (sun is right)
    if (d < 0.0 && y < ridgeY) {
      float reach = 0.10 + 0.16 * cool;
      float lane = ridgeY + d * (0.28 + 0.22 * cool);
      shadow += ms * exp(-pow((y - lane) * 90.0, 2.0)) * smoothstep(-reach, -0.01, d);
    }
  }
  field *= 1.0 - clamp(shadow, 0.0, 1.0) * cool * 0.5;
  float inField = 1.0 - smoothstep(ridgeY - 0.002, ridgeY + 0.002, y);
  col = mix(col, field, inField);

  // --- hare bounding through the near wheat row, once -----------------------
  float hph = (t - 10.0) / 6.0;
  if (hph > 0.0 && hph < 1.0) {
    float hops = hph * 5.0;
    float hi = floor(hops), hf = fract(hops);
    float pause = step(hf, 0.55); // bound 55%, pause 45%
    // x advances only during the bound phase — the hare crouches still
    // between hops instead of gliding
    float bound = min(hf / 0.55, 1.0);
    float hx = 0.30 + 0.048 * (hi + bound) / 5.0;
    float hb = 0.020 * max(0.0, sin(bound * 3.1416)) * pause;
    vec2 hd = (vUv - vec2(hx, 0.335 + hb)) * vec2(2.2, 3.2);
    float hare = 1.0 - smoothstep(0.012, 0.020, length(hd));
    // ears
    vec2 he = (vUv - vec2(hx + 0.004, 0.335 + hb + 0.016)) * vec2(9.0, 3.0);
    float ears = 1.0 - smoothstep(0.006, 0.012, length(he));
    col = mix(col, vec3(0.10, 0.07, 0.05), max(hare, ears * 0.9) * 0.9);
  }

  // --- birds crossing once on a long diagonal ------------------------------
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float bph = (t - 8.0) / 5.5 - fk * 0.02;
    if (bph > 0.0 && bph < 1.0) {
      float bx = 0.10 + 0.80 * bph;
      float by = 0.64 - 0.18 * bph + 0.016 * fk + 0.008 * sin(t * 3.0 + fk * 2.0);
      float flap = sin(t * 7.0 + fk * 1.7);
      vec2 bd = (vUv - vec2(bx, by)) * vec2(3.0, 5.0 + 2.0 * flap);
      float bird = 1.0 - smoothstep(0.006, 0.012, length(bd));
      col = mix(col, vec3(0.08, 0.06, 0.08), bird * 0.85);
    }
  }

  // --- three mill bodies on the ridge --------------------------------------
  // (rotors are instanced quads in front; only the static bodies live here)
  col = mix(col, vec3(0.10, 0.07, 0.09), millBody(vUv, 0.28, ridgeY - 0.002, 0.150, 0.016));
  col = mix(col, vec3(0.11, 0.08, 0.10), millBody(vUv, 0.55, ridgeY + 0.004, 0.105, 0.011));
  col = mix(col, vec3(0.12, 0.09, 0.11), millBody(vUv, 0.78, ridgeY + 0.006, 0.075, 0.008));

  // --- crow resting on the near mill's tail vane ---------------------------
  float cph = (t - 15.0) / 3.0;
  if (cph > 0.0 && cph < 1.0) {
    float fade = smoothstep(15.0, 15.4, t) * (1.0 - smoothstep(17.6, 18.0, t));
    vec2 cd2 = (vUv - vec2(0.335, 0.415 + 0.150 * 1.10 + 0.004)) * vec2(4.0, 6.0);
    float crow = (1.0 - smoothstep(0.008, 0.014, length(cd2))) * fade;
    col = mix(col, vec3(0.05, 0.04, 0.05), crow);
  }

  fragColor = vec4(col, 1.0);
}`;

// Rotor instance shader: 4 tapered blades + hub, silhouette; aRim carries
// the warm edge-light when a blade crosses the sun lane.
const ROTOR_VERT = /* glsl */ `
out vec2 vUv;
out float vRim;
out float vSunAngle;
attribute float aRim;
attribute float aSunAngle;
void main() {
  vUv = uv;
  vRim = aRim;
  vSunAngle = aSunAngle;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;

const ROTOR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vRim;
in float vSunAngle;
out vec4 fragColor;
#define aSunAngle vSunAngle

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float blade = 0.0;
  for (int k = 0; k < 4; k++) {
    float a = float(k) * 1.5707963;
    vec2 dir = vec2(cos(a), sin(a));
    // tapered blade: wider at root, narrowing to the tip
    float d = segDist(p, dir * 0.10, dir * 0.94);
    float w = mix(0.055, 0.018, clamp(r / 0.94, 0.0, 1.0));
    blade = max(blade, 1.0 - smoothstep(w, w + 0.015, d));
  }
  float hub = 1.0 - smoothstep(0.07, 0.10, r);
  float shape = max(blade, hub);
  if (shape < 0.01) discard;
  vec3 col = vec3(0.07, 0.05, 0.06);
  // warm rim on the sun-side blade edge — only the blade pointing at the
  // sun catches light (aSunAngle is the sun azimuth in rotor-local space)
  vec2 sunDir = vec2(cos(aSunAngle), sin(aSunAngle));
  float facing = pow(max(dot(normalize(p + vec2(1e-4)), sunDir), 0.0), 6.0);
  float rim = smoothstep(0.55, 0.95, r) * facing * shape;
  col = mix(col, vec3(0.95, 0.60, 0.22), rim * vRim);
  fragColor = vec4(col, shape * 0.96);
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;
const uv2w = (ux: number, uy: number): [number, number] => [(ux - 0.5) * PW, PY + (uy - 0.5) * PH];

// Mill rotors: uv of hub, radius (world), base rate (rad/s), phase, dir.
// Near mill's rotor sweeps past the left frame edge on purpose.
// ridgeAt mirrors the shader's wiggled ridge so hubs sit on the cap center.
const ridgeAt = (x: number) => 0.415 + 0.012 * Math.sin(x * 9.0 + 1.3) + 0.006 * Math.sin(x * 23.0);
const MILLS = [
  { ux: 0.28, hubY: ridgeAt(0.28) - 0.002 + 0.150 * 1.06, radius: 17.0, rate: 1.35, phase: 0.4, dir: 1 },
  { ux: 0.55, hubY: ridgeAt(0.55) + 0.004 + 0.105 * 1.06, radius: 11.0, rate: 1.05, phase: 2.3, dir: -1 },
  { ux: 0.78, hubY: ridgeAt(0.78) + 0.006 + 0.075 * 1.06, radius: 7.5, rate: 0.85, phase: 4.1, dir: 1 },
];

// Wind envelope shared by rotor speed and the shader's wheat waves.
const wind = (t: number) => ss(5, 9, t) * (1 - ss(17, 19.5, t));
// Monotone-increasing stand-in for the wind integral — the rotor angle
// must never decrease, so spin-up/slow-down ride this accumulated curve
// instead of multiplying t by the (decaying) envelope directly.
const windInt = (t: number) => 4.0 * ss(5, 9, t) + 8.0 * ss(9, 17, t) + 5.0 * ss(17, 19.5, t);

// Sun azimuth from the near-mill hub (for the rim-light computation).
const SUN = uv2w(0.80, 0.455);

// [tin, tout, text, anchorUv] — captions are anchored to points on the
// backdrop and projected through the camera, so they travel with the pan
const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 4.2, 'last light on the wheat', [0.45, 0.30]],
  [5.5, 9.5, 'wind comes over the ridge', [0.55, 0.47]],
  [12.0, 16.0, 'the mills run hard before dark', [0.28, 0.40]],
];

export default class WindmillRowScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private rig = new CameraRig();
  private layer = new Layer2D(W, H);
  private u = { uT: { value: 0 } };
  private rotors: THREE.InstancedMesh;
  private aRim: THREE.InstancedBufferAttribute;
  private aSun: THREE.InstancedBufferAttribute;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private scl = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // one instanced quad per mill — the quad rotates, blades stay fixed
    const geo = new THREE.PlaneGeometry(2, 2);
    this.aRim = new THREE.InstancedBufferAttribute(new Float32Array(3), 1);
    this.aRim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aRim', this.aRim);
    this.aSun = new THREE.InstancedBufferAttribute(new Float32Array(3), 1);
    this.aSun.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSunAngle', this.aSun);
    const mat = new THREE.ShaderMaterial({
      vertexShader: ROTOR_VERT,
      fragmentShader: ROTOR_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.rotors = new THREE.InstancedMesh(geo, mat, 3);
    this.rotors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rotors.frustumCulled = false;
    this.three.add(this.rotors);
  }

  // Closed-form rotor state: angle integrates the wind envelope with a
  // per-mill rate; yaw wobble squashes the disc on a slow sine; rim peaks
  // when a blade direction aligns with the sun's azimuth from the hub.
  private place(i: number, t: number): void {
    const mill = MILLS[i]!;
    const [wx, wy] = uv2w(mill.ux, mill.hubY);
    const w = wind(t);
    // angle rides the monotone wind-integral (never reverses on die-down);
    // the small sine term is a gust surge, not direction
    const ang = mill.dir * (mill.phase + mill.rate * (0.5 * t + 0.85 * windInt(t)) + 0.7 * w * mill.rate * Math.sin(t * 0.6 + mill.phase));
    // yaw wobble: slight elliptical squash as the rotor yaws
    const yaw = 0.92 + 0.08 * Math.sin(t * 0.35 + mill.phase * 2.0);
    this.e.set(0, 0, ang);
    this.q.setFromEuler(this.e);
    this.scl.set(mill.radius * yaw, mill.radius, 1);
    // sit just in front of the backdrop plane so the hub tracks its cap
    // through the pan (deep z offsets would parallax the rotor off the mill)
    this.v.set(wx, wy, PZ + 0.4);
    this.m.compose(this.v, this.q, this.scl);
    this.rotors.setMatrixAt(i, this.m);

    // rim: fades as the sky cools; the shader lights whichever blade is
    // currently turned toward the sun (aSunAngle = sun azimuth in the
    // rotor's local frame, i.e. world azimuth minus the rotor's angle)
    const cool = ss(13, 18.5, t);
    const sunAz = Math.atan2(SUN[1] - wy, SUN[0] - wx);
    this.aSun.setX(i, sunAz - ang);
    this.aRim.setX(i, (1 - cool) * 0.9 + 0.05);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    for (let i = 0; i < 3; i++) this.place(i, t);
    this.rotors.instanceMatrix.needsUpdate = true;
    this.aRim.needsUpdate = true;
    this.aSun.needsUpdate = true;

    // CameraRig: establishing frame holds the far mill + low sun at the
    // right edge, pans left along the ridge, then settles on the near mill.
    // In narrow/vertical exports the pan shortens and anchors on the near
    // mill so the focal mills stay in frame
    const span = Math.min(1, (this.ctx.W / this.ctx.H) / (16 / 9));
    const pan = ss(1, 14, t) * span;
    this.rig.position = [45.0 - 63.0 * pan + 0.8 * Math.sin(t * 0.06), 6.5, 24.0];
    this.rig.target = [40.0 - 62.0 * pan, -2.0 + 1.5 * pan, PZ];
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
        // world-anchored: project the caption's backdrop point to screen
        const [awx, awy] = uv2w(auv[0], auv[1]);
        const ndc = this.v.set(awx, awy, PZ + 0.4).project(this.cam);
        const cx = (ndc.x * 0.5 + 0.5) * W;
        const cy = (0.5 - ndc.y * 0.5) * H + H * 0.18; // sit below the anchor
        if (ndc.z > 1 || cx < -W * 0.4 || cx > W * 1.4) continue;
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // knockout halo: 12px stroke = ~6px outside glyph edges
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
      exposure: 0.55,
      bloom: 0.3,
      bloomThreshold: 0.7,
      bloomRadius: 0.7,
      ca: 0.1,
      grain: 0.05,
      vignette: 0.55,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.rotors.dispose();
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

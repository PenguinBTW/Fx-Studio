// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// neonrain — a rain-slicked city alley at night.
// Two angled facade walls form the canyon (hashed window grids + 5 seeded
// neon signs, one stuttering); the far backdrop carries the sky, sagging
// cables, the far wall and a doorway light that opens once. A wet-asphalt
// plane mirrors each sign as a wobble-distorted reflection column with
// expanding splash arcs. Rain is two transparent streak layers at different
// depths; two umbrella silhouettes cross on shader quads. CameraRig pushes
// slowly down the alley. All motion is f(t); every random is a hash seed.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
import { F } from '../../engine/type';
import { GLSL_NOISE } from '../../engine/glsl/noise';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const PW = 240, PH = 120, PY = 22, PZ = -60;

// 5 signs: x (world), y, z, hue rgb — sign 2 (gold) is the faulty one.
const SIGNS: { x: number; y: number; z: number; c: [number, number, number] }[] = [
  { x: -14, y: 9.0, z: -22, c: [0.10, 0.90, 0.85] },   // cyan, left wall
  { x: -14, y: 13.0, z: -38, c: [0.95, 0.15, 0.65] },  // magenta, left wall
  { x: 14, y: 11.0, z: -30, c: [1.00, 0.72, 0.18] },   // gold, right wall — faulty
  { x: -14, y: 8.0, z: -50, c: [0.90, 0.30, 0.75] },   // pink, left wall deep
  { x: 14, y: 14.0, z: -52, c: [0.25, 0.50, 1.00] },   // blue, right wall deep
];

/* ---------------- wall shader: facade + neon signs ---------------------- */

const WALL_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
in vec3 vWorld;
out vec4 fragColor;
uniform float uT;
uniform float uFlicker;  // faulty-sign strobe envelope
uniform float uAwake;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  float t = uT;
  vec2 p = vec2(vWorld.z, vWorld.y); // wall-local: z along alley, y up

  // concrete facade: dark, faint vertical grime streaks
  vec3 c = vec3(0.016, 0.017, 0.024) * (0.7 + 0.5 * fbm3(vec3(p * vec2(0.3, 1.2), 4.0), 3));

  // lit windows: hashed grid, sparse and dim
  vec2 cell = floor(p / vec2(3.4, 4.2));
  vec2 fr = fract(p / vec2(3.4, 4.2));
  float lit = step(0.78, h21(cell)) * step(0.15, fr.x) * step(fr.x, 0.55) * step(0.3, fr.y) * step(fr.y, 0.7);
  c += vec3(0.14, 0.12, 0.08) * lit * (0.5 + 0.5 * h21(cell + 9.0)) * (0.4 + 0.6 * uAwake);

  // neon signs — 5 discs with hot cores and wide bloom
  vec3 sc[5] = vec3[](
    vec3(0.10, 0.90, 0.85), vec3(0.95, 0.15, 0.65), vec3(1.00, 0.72, 0.18),
    vec3(0.90, 0.30, 0.75), vec3(0.25, 0.50, 1.00));
  float sz[5] = float[](-22.0, -38.0, -30.0, -50.0, -52.0);
  float sy[5] = float[](9.0, 13.0, 11.0, 8.0, 14.0);
  float sx[5] = float[](-14.0, -14.0, 14.0, -14.0, 14.0);
  float side = sign(vWorld.x);
  for (int i = 0; i < 5; i++) {
    if (side * sx[i] < 0.0) continue; // sign lives on the other wall
    vec2 d = p - vec2(sz[i], sy[i]);
    d.x *= 0.55; // signs are taller than wide on the wall
    float r = length(d);
    float core = 1.0 - smoothstep(1.1, 1.6, r);
    float glow = exp(-r * r * 0.22);
    float en = 1.0;
    if (i == 2) {
      // faulty sign: hashed strobe bursts inside the flicker window
      float burst = step(0.55, h1(floor(t * 9.0) * 0.37));
      en = 0.25 + 0.75 * mix(1.0, burst, uFlicker);
    }
    c += sc[i] * (core * 0.9 + glow * 0.30) * en;
  }

  // sign mounting bars
  c *= 1.0 - 0.3 * step(abs(fract(vWorld.y * 0.5) - 0.5), 0.02);

  fragColor = vec4(c, 1.0);
}`;

/* ---------------- far backdrop: sky, cables, far wall, door ------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uDoor;   // door-open envelope
uniform float uAwake;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  vec2 su = vec2(uv.x * 2.0, uv.y);
  float t = uT;

  // night sky: near-black blue with faint cloud murk
  vec3 c = mix(vec3(0.012, 0.014, 0.030), vec3(0.030, 0.035, 0.055), fbm3(vec3(su * 2.0, t * 0.03), 3));
  c += vec3(0.04, 0.035, 0.05) * (1.0 - uv.y) * 0.4; // city glow low on the horizon

  // far wall: dark silhouette filling lower half behind the alley mouth
  float wall = 1.0 - smoothstep(0.30, 0.42, uv.y + 0.04 * fbm3(vec3(su.x * 8.0, 2.0, 0.0), 3));
  c = mix(c, vec3(0.015, 0.016, 0.022) * (0.8 + 0.4 * fbm3(vec3(su * 6.0, 1.0), 3)), wall);

  // doorway: warm slit of light that opens and closes once
  vec2 dd = uv - vec2(0.5, 0.16);
  float door = (1.0 - smoothstep(0.012, 0.028, abs(dd.x))) * (1.0 - smoothstep(0.03, 0.075, abs(dd.y)));
  c += vec3(1.0, 0.80, 0.45) * door * (0.25 + 1.8 * uDoor);
  c += vec3(1.0, 0.80, 0.45) * exp(-dd.x * dd.x * 900.0) * exp(-dd.y * dd.y * 160.0) * uDoor * 0.8;

  // overhead cables: 3 sagging dark curves crossing the frame
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float y0 = 0.86 - fi * 0.07 + 0.02 * sin(su.x * 4.0 + fi);
    float sag = y0 - 0.06 * sin(su.x * 3.14159);
    float line = 1.0 - smoothstep(0.0, 0.006, abs(uv.y - sag));
    c *= 1.0 - 0.75 * line;
  }

  // curb-level mist band drifting
  float mist = (1.0 - smoothstep(0.02, 0.16, uv.y)) * fbm3(vec3(su.x * 4.0 - t * 0.05, 7.0, t * 0.08), 3);
  c += vec3(0.07, 0.09, 0.11) * mist * (0.3 + 0.3 * uAwake);

  fragColor = vec4(c, 1.0);
}`;

/* ---------------- wet asphalt ------------------------------------------- */

const GROUND_FRAG = /* glsl */ `${GLSL_NOISE}
in vec3 vWorld;
out vec4 fragColor;
uniform float uT;
uniform float uRain;   // splash + sheen intensity
uniform float uFlicker;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  float t = uT;
  vec2 p = vWorld.xz;

  // asphalt: near-black blue, faint aggregate sparkle
  vec3 c = vec3(0.014, 0.015, 0.022) * (0.7 + 0.6 * fbm3(vec3(p * 1.4, 3.0), 3));
  c += vec3(0.05) * step(0.93, h21(floor(p * 9.0))) * 0.4;

  // mirrored neon columns: smear from each sign's z toward the camera,
  // wobble-distorted and fading with distance
  vec3 sc[5] = vec3[](
    vec3(0.10, 0.90, 0.85), vec3(0.95, 0.15, 0.65), vec3(1.00, 0.72, 0.18),
    vec3(0.90, 0.30, 0.75), vec3(0.25, 0.50, 1.00));
  float sz[5] = float[](-22.0, -38.0, -30.0, -50.0, -52.0);
  float sx[5] = float[](-14.0, -14.0, 14.0, -14.0, 14.0);
  for (int i = 0; i < 5; i++) {
    // column sits near the wall, smeared forward from the sign's z
    float along = p.y - sz[i];                       // >0 toward camera
    float infront = smoothstep(-2.0, 2.0, along);
    float wob = sin(p.y * 0.55 + t * (0.8 + float(i) * 0.13) + float(i) * 4.0) * 0.9;
    wob += fbm3(vec3(p.x * 0.4 + float(i), p.y * 0.15, t * 0.35 + float(i)), 3) * 2.2 - 1.1;
    float lat = abs(p.x - (sx[i] * 0.92 + wob)) / (2.2 + along * 0.06);
    float col = exp(-lat * lat) * infront * exp(-max(along, 0.0) * 0.045);
    float en = (i == 2) ? 0.25 + 0.75 * mix(1.0, step(0.55, h1(floor(t * 9.0) * 0.37)), uFlicker) : 1.0;
    c += sc[i] * col * 0.55 * en;
  }

  // splashes: tiny expanding arcs where drops land (hashed grid-time cells)
  vec2 cell = floor(p / vec2(1.7, 2.2));
  float rnd = h21(cell);
  float period = 0.9 + rnd;
  float ph = fract(t / period + rnd * 7.0);
  vec2 fr = fract(p / vec2(1.7, 2.2)) - 0.5;
  float ring = abs(length(fr) - ph * 0.18) / 0.035;
  float splash = (1.0 - smoothstep(0.6, 1.4, ring)) * (1.0 - ph) * step(rnd, 0.40 * uRain);
  c += vec3(0.30, 0.34, 0.38) * splash * 0.22;

  // curb mist hugging the walls
  float curb = smoothstep(11.0, 14.5, abs(p.x)) * fbm3(vec3(p * vec2(0.3, 0.5), 6.0) - vec3(t * 0.05, 0.0, 0.0), 3);
  c += vec3(0.08, 0.10, 0.12) * curb;

  // far fade into darkness
  c = mix(c, vec3(0.006, 0.007, 0.012), smoothstep(-30.0, -58.0, p.y));
  fragColor = vec4(c, 1.0);
}`;

/* ---------------- rain streak layers ------------------------------------- */

const RAIN_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uInt;
uniform float uSeed;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float t = uT;
  vec2 su = vec2(vUv.x * 2.0, vUv.y);
  // diagonal streaks: hashed columns falling fast, slight lean
  vec2 q = su * vec2(44.0, 1.0);
  q.x += vUv.y * 7.0;              // lean
  float col = floor(q.x);
  float speed = 0.9 + h21(vec2(col, uSeed)) * 0.8;
  float fy = fract(vUv.y * 1.0 + t * speed * 1.6 + h21(vec2(col, uSeed + 2.0)) * 7.0);
  float head = smoothstep(0.0, 0.10, fy) * (1.0 - smoothstep(0.10, 0.30, fy));
  float xmask = step(0.42, h21(vec2(col, uSeed + 5.0))) * (1.0 - smoothstep(0.0, 0.10, abs(fract(q.x) - 0.5)));
  float a = head * xmask * uInt;
  fragColor = vec4(vec3(0.48, 0.56, 0.64) * a, a * 0.28);
}`;

/* ---------------- umbrella passersby -------------------------------------- */

const WALK_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uSeed;   // which walker
uniform float uFade;

float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  float t = uT;
  // uv.x 0..1 across the quad maps to world x -26..26; figure walks across once
  float dir = uSeed < 0.5 ? 1.0 : -1.0;
  float speed = 0.055 + uSeed * 0.02;
  float cyc = fract(t * speed + uSeed * 0.6);
  float wx = mix(-0.15, 1.15, uSeed < 0.5 ? cyc : 1.0 - cyc);   // figure center uv.x
  vec2 p = vUv;
  p.x = (p.x - wx) * 8.0;   // figure-local space
  p.y = p.y;

  float bob = abs(sin(t * 3.4 + uSeed * 9.0)) * 0.02;
  float a = 0.0;
  // umbrella canopy: arc
  vec2 uc = vec2(p.x + dir * 0.02, p.y - (0.78 + bob));
  float canopy = smoothstep(0.20, 0.16, length(vec2(uc.x / 1.9, uc.y))) * step(uc.y, 0.02);
  a = max(a, canopy);
  // head + body capsule
  float head = smoothstep(0.055, 0.04, length(vec2(p.x, p.y - (0.60 + bob))));
  float body = smoothstep(0.10, 0.07, abs(p.x)) * step(0.18 + bob, p.y) * step(p.y, 0.60 + bob);
  a = max(a, max(head, body));
  // legs: two strobing strides
  float leg = smoothstep(0.05, 0.035, abs(p.x - sin(t * 3.4) * 0.05)) * step(0.0, p.y) * step(p.y, 0.20 + bob);
  float leg2 = smoothstep(0.05, 0.035, abs(p.x + sin(t * 3.4) * 0.05)) * step(0.0, p.y) * step(p.y, 0.20 + bob);
  a = max(a, max(leg, leg2) * 0.9);
  a *= uFade * (1.0 - smoothstep(0.85, 1.0, cyc) * smoothstep(0.15, 0.0, cyc));
  if (a < 0.01) discard;
  fragColor = vec4(vec3(0.004, 0.005, 0.010), a);
}`;

/* ---------------- scene --------------------------------------------------- */

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.0, end: 5.0, s: 'rain finds the neon' },
  { at: 8.0, end: 12.0, s: "one sign can't decide" },
  { at: 13.0, end: 18.0, s: "someone's still out" },
];

export default class NeonRainScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private wallMat: THREE.ShaderMaterial;
  private backMat: THREE.ShaderMaterial;
  private groundMat: THREE.ShaderMaterial;
  private rainMats: THREE.ShaderMaterial[] = [];
  private walkMats: THREE.ShaderMaterial[] = [];
  private layer = new Layer2D();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 400);
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    const wallVert = /* glsl */ `
      out vec2 vUv;
      out vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`;

    // facade walls: two planes angled slightly inward, converging down-alley
    this.wallMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uFlicker: { value: 0 }, uAwake: { value: 0 } },
      vertexShader: wallVert,
      fragmentShader: WALL_FRAG,
      glslVersion: THREE.GLSL3,
      side: THREE.DoubleSide,
    });
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(95, 55), this.wallMat);
      wall.position.set(side * 14, 9, -16);
      wall.rotation.y = -side * (Math.PI / 2 - 0.12); // face inward, slight splay
      this.three.add(wall);
    }

    // far backdrop
    this.backMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uDoor: { value: 0 }, uAwake: { value: 0 } },
      vertexShader: /* glsl */ `
        out vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), this.backMat);
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // wet asphalt
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uRain: { value: 0 }, uFlicker: { value: 0 } },
      vertexShader: wallVert,
      fragmentShader: GROUND_FRAG,
      glslVersion: THREE.GLSL3,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 130), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -6, -35);
    this.three.add(ground);

    // rain layers: near fast + far slow
    for (const [z, seed, amp] of [[-8, 1.7, 1.0], [-30, 4.9, 0.7]] as const) {
      const m = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uInt: { value: amp }, uSeed: { value: seed } },
        vertexShader: /* glsl */ `
          out vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: RAIN_FRAG,
        glslVersion: THREE.GLSL3,
        transparent: true,
        depthWrite: false,
      });
      this.rainMats.push(m);
      const rain = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), m);
      rain.position.set(0, 4, z);
      this.three.add(rain);
    }

    // walkers: two silhouette quads at different depths
    for (const [z, seed, w] of [[-14, 0.0, 5.2], [-30, 0.75, 7.0]] as const) {
      const m = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSeed: { value: seed }, uFade: { value: 0 } },
        vertexShader: /* glsl */ `
          out vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: WALK_FRAG,
        glslVersion: THREE.GLSL3,
        transparent: true,
        depthWrite: false,
      });
      this.walkMats.push(m);
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(52, 8), m);
      quad.position.set(0, -2.1, z);
      quad.scale.set(w / 5.2, 1, 1);
      this.three.add(quad);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    const end = this.ctx.end - this.ctx.start;

    const awake = ss(0.5, 4.0, t);
    const rain = 0.35 + 0.65 * ss(1.5, 7.0, t) * (1.0 - 0.45 * ss(15.5, 19.5, t));
    const flicker = ss(7.8, 8.6, t) * (1.0 - ss(11.4, 12.4, t));
    const walkers = ss(11.5, 13.5, t) * (1.0 - ss(16.5, 18.5, t));
    const door = ss(13.0, 13.8, t) * (1.0 - ss(15.2, 16.2, t));

    this.wallMat.uniforms.uT!.value = t;
    this.wallMat.uniforms.uFlicker!.value = flicker;
    this.wallMat.uniforms.uAwake!.value = awake;
    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uDoor!.value = door;
    this.backMat.uniforms.uAwake!.value = awake;
    this.groundMat.uniforms.uT!.value = t;
    this.groundMat.uniforms.uRain!.value = rain;
    this.groundMat.uniforms.uFlicker!.value = flicker;
    this.rainMats[0]!.uniforms.uT!.value = t;
    this.rainMats[0]!.uniforms.uInt!.value = rain * 1.0;
    this.rainMats[1]!.uniforms.uT!.value = t;
    this.rainMats[1]!.uniforms.uInt!.value = rain * 0.7;
    this.walkMats[0]!.uniforms.uT!.value = t;
    this.walkMats[0]!.uniforms.uFade!.value = walkers;
    this.walkMats[1]!.uniforms.uT!.value = t;
    this.walkMats[1]!.uniforms.uFade!.value = walkers * 0.85;

    // slow push down the alley, faint roll
    const push = ss(0, end, t);
    this.rig.position = [1.2 * Math.sin(t * 0.05), 0.4, 24.0 - 15.0 * push];
    this.rig.target = [0, 2.5, -45];
    this.rig.roll = 0.005 * Math.sin(t * 0.17);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      g.save();
      g.globalAlpha = a;
      const text = c.s.toUpperCase();
      const maxW = this.ctx.W - 48;
      let fs = 46;
      let ls = 7;
      const setFont = () => {
        g.font = `${fs}px "${F.archivo(112, 500)}"`;
        (g as unknown as { letterSpacing: string }).letterSpacing = `${ls}px`;
      };
      setFont();
      const w = g.measureText(text).width;
      if (w > maxW) {
        fs = Math.max(14, Math.floor((fs * maxW) / w));
        ls = Math.max(1, Math.floor((ls * maxW) / w));
        setFont();
      }
      g.textAlign = 'center';
      g.shadowColor = 'rgba(0,0,0,0.9)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(235,240,248,0.95)';
      g.fillText(text, this.ctx.W / 2, this.ctx.H - 120);
      g.restore();
    }
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 1.0,
      bloom: 1.35,
      bloomThreshold: 0.30,
      bloomRadius: 1.0,
      ca: 0.08,
      grain: 0.07,
      vignette: 0.55,
      level: ss(0, 1.2, t),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.texture.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

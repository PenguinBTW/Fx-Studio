// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// lighthouse — a beam sweeping a foggy rocky headland at night.
// One backdrop shader renders sky (moon + halo, stars in cloud breaks,
// drifting mist), the cliff + tower silhouette with a warm lamp room, the
// rotating 360° light wedge with a synchronized moving beamPatch on cliff and
// swell, undulating swell bands with white-cap glints, and a vessel light
// crossing once. A separate transparent quad carries the rain-squall streaks
// that gate on their own envelope and faintly refract the beam. CameraRig
// pushes toward the headland. All motion is f(t); every random is a hash.
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

// Backdrop plane: world y = PY + (uv.y - 0.5) * PH
const PW = 240, PH = 120, PY = 22, PZ = -60;

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.0, end: 5.0, s: "the light keeps its own time" },
  { at: 11.0, end: 15.0, s: "weather moves through" },
  { at: 16.0, end: 19.5, s: "and out the other side" },
];

/* ---------------- backdrop: sky, headland, beam, sea -------------------- */

const FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uAwake;    // establishing fade-in
uniform float uSweep;    // beam enable
uniform float uSquall;   // rain squall gate
uniform float uClear;    // clear-star reveal (mist thins)

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

// beam rotation: one full turn ~9s, eases in with uSweep
float beamAngle(float t) { return t * 0.70; }

void main() {
  vec2 uv = vUv;
  float t = uT;
  float wy = ${PY.toFixed(1)} + (uv.y - 0.5) * ${PH.toFixed(1)};   // world y
  float wx = (uv.x - 0.5) * ${PW.toFixed(1)};                     // world x

  /* ---------- sky ---------- */
  vec3 c = mix(vec3(0.006, 0.010, 0.020), vec3(0.012, 0.020, 0.038),
               clamp(wy / 40.0 + 0.5, 0.0, 1.0));

  // stars: hashed cells host soft round dots, only above horizon, gated by cloud breaks
  vec2 sc = uv * vec2(90.0, 48.0);
  vec2 cell = floor(sc);
  vec2 cp = fract(sc) - 0.5 - (vec2(h21(cell), h21(cell + 1.7)) - 0.5) * 0.6;
  float star = step(0.92, h21(cell + 9.3))
             * (1.0 - smoothstep(0.05, 0.16, length(cp))) * step(0.3, wy);
  float cloudMask = fbm3(vec3(uv * 3.0 + vec2(t * 0.008, 0.0), 7.0), 3);
  float breaks = smoothstep(0.35, 0.62, cloudMask + 0.5 * uClear - 0.35);
  float tw = 0.6 + 0.4 * sin(t * (2.0 + 4.0 * h21(cell + 3.0)) + h21(cell) * 40.0);
  c += vec3(0.9, 0.95, 1.0) * star * tw * breaks * 2.2;

  // moon low right with halo
  vec2 mp = uv - vec2(0.62, 0.57); mp.x *= 2.0; // plane is 2x wider in uv-x: keep the disc round
  float mr = length(mp * vec2(1.0, 1.4));
  float moon = 1.0 - smoothstep(0.018, 0.026, mr);
  float halo = exp(-mr * mr * 60.0);
  vec3 moonC = vec3(0.85, 0.90, 0.98);
  c += moonC * (moon * 2.4 + halo * 0.40) * (0.5 + 0.5 * breaks);

  /* ---------- lighthouse geometry (uv space) ---------- */
  // tower on the headland at left-of-center
  float twX = 0.34;              // tower x in uv
  float headlandTop = 0.42;      // cliff crest uv.y
  float lampY = 0.56;            // lamp room uv.y
  vec2 lamp = vec2(twX, lampY);

  /* ---------- beam (drawn behind silhouette, clipped by it) ---------- */
  float ang = beamAngle(t);
  vec2 bd = vec2(cos(ang), sin(ang) * 0.55 - 0.06); // slight downward pitch
  vec2 rel = uv - lamp;
  float rr = length(rel);
  float ca = dot(normalize(rel + vec2(1e-5)), normalize(bd));
  float cb = dot(normalize(rel + vec2(1e-5)), -normalize(bd));
  // forward wedge + faint back lobe
  float wedge = smoothstep(0.962, 0.999, ca) + 0.25 * smoothstep(0.975, 0.999, cb);
  // mist attenuation: beam fades through banks, flares when clean
  float mist = fbm3(vec3(uv * vec2(2.0, 4.0) + vec2(t * 0.02, t * 0.004), 11.0), 3);
  float fogFade = 1.0 - 0.65 * smoothstep(0.45, 0.85, mist * (1.0 - uClear * 0.5));
  // distance falloff + origin glow
  float dist = exp(-rr * 3.5) + exp(-rr * 1.2) * 0.12;
  float flare = 1.0 + 1.4 * smoothstep(0.990, 0.9995, ca); // flare pointing at viewer
  vec3 beamC = vec3(1.0, 0.94, 0.78);
  float beam = wedge * dist * fogFade * flare * uSweep;
  // squall: beam dims + refracts through rain curtain
  beam *= 1.0 - 0.5 * uSquall * smoothstep(0.3, 0.8, mist);

  /* ---------- cliff silhouette ---------- */
  // hashed ridge line descending from left to the tower base
  float ridge = headlandTop + 0.10 * fbm3(vec3(uv.x * 6.0, 3.0, 5.0), 3)
              - 0.22 * smoothstep(twX + 0.02, 0.85, uv.x);
  float cliff = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, uv.y);
  // tower: narrow silhouette rising from the headland
  float tower = step(abs(uv.x - twX), 0.020) * step(uv.y, lampY + 0.015) * step(ridge - 0.02, uv.y);
  // lamp room: slightly wider cap + warm glass
  float lampRoom = step(abs(uv.x - twX), 0.024) * step(abs(uv.y - lampY), 0.018);

  /* ---------- sea ---------- */
  float seaLevel = 0.30;
  float sea = 1.0 - smoothstep(seaLevel - 0.004, seaLevel + 0.004, uv.y);

  // swell bands: horizontal sine field, deeper bands slower
  float sw = sin(wy * 1.15 - t * 0.9 + 1.6 * sin(uv.x * 9.0 + t * 0.35));
  float sw2 = sin(wy * 2.6 - t * 1.35 + uv.x * 14.0);
  float swell = (0.5 + 0.5 * sw) * 0.6 + (0.5 + 0.5 * sw2) * 0.4;
  vec3 seaC = mix(vec3(0.004, 0.010, 0.016), vec3(0.010, 0.024, 0.034), swell);

  // beam light beamPatch on the water: beamPatch x follows the beam azimuth
  float beamPatchX = twX + bd.x * 0.55;
  float beamPatch = exp(-((uv.x - beamPatchX) * 5.0) * ((uv.x - beamPatchX) * 5.0)) * exp(-((uv.y - seaLevel + 0.10) * 14.0) * ((uv.y - seaLevel + 0.10) * 14.0));
  beamPatch *= smoothstep(0.2, 0.9, abs(bd.x)) * uSweep * fogFade;

  // white-cap glints where the beam passes
  float glint = step(0.985, h21(floor(uv * vec2(300.0, 140.0)) + floor(t * 8.0)))
              * beamPatch * (0.5 + 0.5 * swell);
  seaC += beamC * (beamPatch * 0.55 + glint * 2.5);

  // faint moon lane on the sea
  float lane = exp(-((uv.x - 0.68) * 9.0) * ((uv.x - 0.68) * 9.0)) * exp(-((uv.y - seaLevel) * 8.0) * ((uv.y - seaLevel) * 8.0));
  seaC += moonC * lane * 0.10 * (0.5 + 0.5 * breaks) * (0.6 + 0.4 * sw2);

  // vessel light crossing once, far right horizon
  float vx = 0.56 + 0.18 * smoothstep(9.0, 16.0, t);
  float vessel = exp(-((uv.x - vx) * 260.0) * ((uv.x - vx) * 260.0)) * exp(-((uv.y - (seaLevel + 0.012)) * 700.0) * ((uv.y - (seaLevel + 0.012)) * 700.0));

  /* ---------- compose ---------- */
  // sky above, sea below horizon
  vec3 base = mix(c, seaC, sea);
  base += vec3(1.0, 0.75, 0.45) * vessel * 2.0 * (1.0 - smoothstep(17.0, 18.0, t));

  // beam behind silhouette
  base += beamC * beam * (1.0 - cliff) * (1.0 - tower) * 0.45;

  // beam light beamPatch sliding across the cliff face when angle points left
  float cliffPatch = exp(-((uv.x - (twX - 0.28 - bd.x * 0.2)) * 4.0) * ((uv.x - (twX - 0.28 - bd.x * 0.2)) * 4.0))
                   * exp(-((uv.y - ridge + 0.05) * 10.0) * ((uv.y - ridge + 0.05) * 10.0))
                   * uSweep * fogFade;
  vec3 cliffC = vec3(0.010, 0.011, 0.014);
  cliffC += beamC * cliffPatch * 0.5 * (1.0 - smoothstep(-0.2, 0.4, bd.x));
  // faint granite variation
  cliffC *= 0.7 + 0.6 * fbm3(vec3(uv * vec2(30.0, 12.0), 9.0), 2);
  base = mix(base, cliffC, cliff);

  // tower silhouette + lamp room
  base = mix(base, vec3(0.008, 0.009, 0.012), tower);
  vec3 lampGlow = vec3(1.0, 0.82, 0.45);
  float lampGlass = exp(-((uv.x - twX) * 90.0) * ((uv.x - twX) * 90.0)) * step(abs(uv.y - lampY), 0.014);
  base = mix(base, lampGlow * (1.2 + 0.6 * uSweep), max(lampRoom * 0.0 + lampGlass, 0.0));

  // lamp bloom dot
  float lampBloom = exp(-rr * rr * 900.0);
  base += lampGlow * lampBloom * 1.0;

  /* ---------- drifting mist layers ---------- */
  float m1 = fbm3(vec3(uv * vec2(2.2, 5.0) + vec2(t * 0.015, 0.0), 13.0), 3);
  float m2 = fbm3(vec3(uv * vec2(1.4, 3.0) - vec2(t * 0.010, 0.0), 17.0), 3);
  float mistAmt = (m1 * 0.5 + m2 * 0.5) * (1.0 - 0.65 * uClear);
  vec3 mistC = vec3(0.022, 0.032, 0.050);
  base = mix(base, mistC, clamp(mistAmt * 0.50, 0.0, 0.26));

  /* ---------- rain squall refracting the beam ---------- */
  // faint vertical sheen where squall curtain crosses the beam
  float sqStreak = step(0.93, h1(floor((uv.x * 180.0 + uv.y * 4.0) + floor(t * 18.0) * 0.31)));
  base += beamC * sqStreak * uSquall * beam * (1.0 - cliff) * (1.0 - tower) * 2.0;

  fragColor = vec4(base * uAwake, 1.0);
}`;

/* ---------------- squall: diagonal rain streaks on a quad ---------------- */

const SQUALL_FRAG = /* glsl */ `${GLSL_NOISE}
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uInt;

float h1(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  float t = uT;
  vec2 p = vUv;
  // two layers of diagonal streaks, wind-driven
  float a = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float speed = 1.1 + fi * 0.7;
    float cols = 90.0 + fi * 60.0;
    vec2 q = p;
    q.x += p.y * 0.35;                    // diagonal lean
    float col = floor(q.x * cols);
    float y = fract(q.y * (1.2 + fi * 0.4) + t * speed + h1(col) * 7.0);
    float x = fract(q.x * cols);
    float streak = step(0.94, x) * smoothstep(0.85, 0.98, y);
    a += streak * (0.05 + 0.05 * h1(col + 4.0)) * (1.0 - fi * 0.35);
  }
  vec3 c = vec3(0.55, 0.65, 0.80);
  fragColor = vec4(c, a * uInt);
}`;

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class LighthouseScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private backMat: THREE.ShaderMaterial;
  private squallMat: THREE.ShaderMaterial;
  private layer = new Layer2D();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 400);
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    this.backMat = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uAwake: { value: 0 },
        uSweep: { value: 0 }, uSquall: { value: 0 }, uClear: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), this.backMat);
    back.position.set(0, PY, PZ);
    this.three.add(back);

    this.squallMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uInt: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: SQUALL_FRAG,
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
    });
    const sq = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), this.squallMat);
    sq.position.set(0, 4, -20);
    this.three.add(sq);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    const end = this.ctx.end - this.ctx.start;

    // beats: establish -> first sweep -> squall -> clear-star reveal
    const awake = ss(0, 2.5, t);
    const sweep = ss(2.0, 5.0, t) * (1.0 - ss(19.0, 20.0, t));
    const squall = ss(12.0, 13.0, t) * (1.0 - ss(15.5, 16.5, t));
    const clear = ss(16.0, 18.5, t);

    this.backMat.uniforms.uT!.value = t;
    this.backMat.uniforms.uAwake!.value = awake;
    this.backMat.uniforms.uSweep!.value = sweep;
    this.backMat.uniforms.uSquall!.value = squall;
    this.backMat.uniforms.uClear!.value = clear;
    this.squallMat.uniforms.uT!.value = t;
    this.squallMat.uniforms.uInt!.value = squall;

    // slow push toward the headland, slight lift for the corona of the sweep
    const push = ss(0, end, t);
    this.rig.position = [0.8 * Math.sin(t * 0.04), 1.0 + 0.6 * clear, 24.0 - 13.0 * push];
    this.rig.target = [-6, 8.0, -60];
    this.rig.roll = 0.004 * Math.sin(t * 0.13);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    let anyVis = false;
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      anyVis = true;
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
    if (anyVis) this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.75,
      bloom: 0.7,
      bloomThreshold: 0.28,
      bloomRadius: 1.1,
      ca: 0.07,
      grain: 0.08,
      vignette: 0.6,
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

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// heatwave — sun-baked desert highway mirage. One fullscreen GLSL pass holds
// the whole environment: bleached noon sky, low tarmac receding to a haze
// line, receding pylons, and the mirage itself — screen-space sine/fbm
// displacement that wobbles the road band and sky just above the horizon,
// plus sky-coloured pools laid onto the tarmac. A hash-seeded tumbleweed
// rolls across the near road at a gust beat. Shimmer intensity is a
// closed-form envelope that swells mid-take and releases at the end.
// Everything is f(t) — no accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { CameraRig } from '../../engine/rig';
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

// HZ = horizon line in uv space. The road occupies uv.y < HZ, compressed
// perspective: z = HZ / (HZ - y) gives world depth, road half-width is RW/z
// so the tarmac narrows to a vanishing point at the horizon. Mirage =
// resample the scene at uv + wobble where the wobble is masked to the road
// band + a thin sky sliver above the horizon.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT, uAmp, uGust;
out vec4 fragColor;
const float HZ = 0.42;
const float RW = 0.34;   // road half-width in uv at z=1 — pole cx derives from it
const float ASPECT = ${(16 / 9).toFixed(4)};

float h1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vn1(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), u);
}
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i.x + i.y * 57.0), h1(i.x + 1.0 + i.y * 57.0), u.x),
             mix(h1(i.x + (i.y + 1.0) * 57.0), h1(i.x + 1.0 + (i.y + 1.0) * 57.0), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
// GLSL ES leaves smoothstep(edge0>edge1) undefined; sstep keeps the same
// semantics on every driver by flipping to the descending complement.
float sstep(float e0, float e1, float x) {
  return e0 < e1 ? smoothstep(e0, e1, x) : 1.0 - smoothstep(e1, e0, x);
}

vec3 skyCol(vec2 uv, float t) {
  // bleached noon: pale steel-blue zenith washing to hot white-amber haze
  vec3 c = mix(vec3(0.95, 0.84, 0.62), vec3(0.32, 0.47, 0.70), sstep(HZ, 0.72, uv.y));
  float sunD = length((uv - vec2(0.68, 0.70)) * vec2(ASPECT, 1.0));
  c += vec3(1.0, 0.85, 0.55) * (0.0012 / (sunD * sunD + 0.0012));          // blinding disc
  c += vec3(1.0, 0.90, 0.65) * 0.12 * exp(-sunD * 6.0);                    // halo
  // faint cirrus streaks, drifting
  c += vec3(0.10) * sstep(0.55, 0.85, fbm2(vec2(uv.x * 5.0 + t * 0.008, uv.y * 18.0))) * sstep(0.9, 0.55, uv.y) * step(HZ, uv.y);
  return c;
}

// pylon silhouette at world z: receding power-line poles beside the road
float pylon(vec2 uv, float z, float side) {
  float y0 = HZ - HZ / z;                          // ground y at this depth
  float hgt = 0.30 / z;                            // pylon height shrinks with depth
  // roadside pole: constant world offset from centreline → screen x ∝ 1/z,
  // always outside the road edge (RW/z) so poles never stand on tarmac.
  float cx = 0.5 + side * (0.46 / z + 0.004);
  float dx = uv.x - cx;
  float wdt = 0.0016 * (10.0 / z);                  // pole width shrinks with depth
  float pole = step(abs(dx), wdt) * step(y0, uv.y) * step(uv.y, y0 + hgt);
  float arm = step(abs(uv.y - y0 - hgt * 0.82), hgt * 0.03)
            * step(abs(dx), 5.5 * wdt);
  return max(pole, arm);
}

vec3 sceneCol(vec2 uv, float t) {
  if (uv.y >= HZ) return skyCol(uv, t);
  // road: perspective depth — near bottom edge = close tarmac. Screen
  // half-width is RW/z, so the tarmac narrows to the vanishing point at HZ.
  float z = HZ / (HZ - uv.y + 1e-5);
  float xw = (uv.x - 0.5) * z / RW;                  // lateral pos in road-half-widths
  float road = 1.0 - sstep(0.95, 1.05, abs(xw));
  float verge = 1.0 - road;
  // tarmac: dark asphalt, finer grain near, washed by distance haze
  float grain = fbm2(vec2(xw * 6.0, z * 2.0)) * 0.5 + vn1(z * 40.0) * 0.1;
  vec3 c = mix(vec3(0.16, 0.14, 0.12), vec3(0.34, 0.30, 0.26), grain);
  // centre dashes: bright segments at z intervals, converging
  float dash = step(abs(xw), 0.02) * step(0.5, fract(z * 0.35));
  c = mix(c, vec3(0.95, 0.88, 0.62), dash * 0.8 * road);
  // edge lines
  float edge = sstep(0.055, 0.03, abs(abs(xw) - 0.92));
  c = mix(c, vec3(0.9, 0.85, 0.68), edge * 0.65 * road);
  // gravel shoulders + bleached dirt, then baked earth to the haze line
  vec3 dirt = mix(vec3(0.62, 0.50, 0.34), vec3(0.78, 0.66, 0.46), fbm2(vec2(xw * 0.5 + z * 0.15, z * 0.7)));
  c = mix(c, dirt, verge);
  // heat-haze mirage pools on the tarmac: sky-bright patches shimmering
  float pool = sstep(0.62, 0.85, fbm2(vec2(uv.x * 9.0, z * 0.55 + t * 0.30)))
             * sstep(1.5, 4.0, z) * (1.0 - sstep(18.0, 40.0, z)) * road;
  c = mix(c, skyCol(vec2(uv.x, HZ + 0.02), t), pool * (0.35 + 0.55 * uAmp));
  // receding pylons silhouetted against the haze
  for (int i = 0; i < 5; i++) {
    float zz = 6.0 + float(i) * 11.0;
    float p = pylon(uv, zz, 1.0);
    c = mix(c, vec3(0.12, 0.10, 0.09), p * sstep(55.0, 12.0, zz));
  }
  // distance haze swallows everything at the horizon
  float haze = sstep(9.0, 60.0, z);
  c = mix(c, mix(vec3(0.95, 0.85, 0.64), vec3(0.90, 0.78, 0.55), 0.5), haze * 0.65);
  return c;
}

void main() {
  vec2 uv = vUv;
  // shimmer displacement: lateral wobble strongest in the mirage band —
  // road near horizon + thin sky sliver above it. Two travelling modes +
  // fbm breakup; the envelope uAmp is computed on CPU f(t).
  float band = sstep(HZ, HZ - 0.10, uv.y) * sstep(HZ - 0.30, HZ - 0.06, uv.y)
             + sstep(HZ, HZ + 0.05, uv.y) * sstep(HZ + 0.16, HZ + 0.02, uv.y);
  // horizon spike: band is engineered to be ~0 exactly at uv.y=HZ, so a
  // separate narrow mask wobbles the road/sky boundary itself — without it
  // the horizon never refracts and stays razor straight at peak shimmer.
  float hb = 1.0 - sstep(0.0, 0.035, abs(uv.y - HZ));
  float rise = fract(uv.y * 3.0 - uT * 0.9);                    // waves climb with time
  float wob = sin(uv.y * 160.0 - uT * 7.0 + fbm2(uv * 8.0 + uT * 0.25) * 9.0)
            + 0.6 * sin(uv.y * 70.0 - uT * 4.3 + uv.x * 12.0);
  vec2 q = uv + vec2(wob * 0.0022 * band * uAmp, 0.0);
  // vertical refraction right at the horizon line — strong enough that
  // pixels within ~0.006 uv of HZ sample across the road/sky boundary
  q.y += (0.0015 * band + 0.006 * hb) * uAmp * sin(uv.x * 90.0 + uT * 5.0);
  vec3 c = sceneCol(q, uT);
  // rising shimmer ghost: faint brightening where the wobble is strongest
  c += vec3(1.0, 0.9, 0.7) * abs(wob) * 0.010 * band * uAmp * (0.5 + 0.5 * rise);
  // overall hot white-out lift near the horizon as intensity peaks
  c = mix(c, vec3(1.0, 0.93, 0.78), sstep(HZ - 0.06, HZ, uv.y) * sstep(HZ + 0.08, HZ, uv.y) * uAmp * 0.06);
  fragColor = vec4(c, 1.0);
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 300, PH = 170, PY = 14, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

// Shimmer envelope: baseline haze, swelling at ~8s (gust beat), peak 13–15,
// release to stillness at 18 — matches the caption beats.
const amp = (t: number) =>
  0.22 + 0.08 * Math.sin(t * 0.6)
  + 0.55 * ss(6.5, 9.0, t) * (1 - ss(15.0, 18.5, t));
const gust = (t: number) => 0.3 + 0.7 * ss(6.5, 9.0, t) * (1 - ss(14.0, 17.5, t));

const CAPTIONS: { at: number; end: number; s: string }[] = [
  { at: 1.2, end: 4.6, s: 'asphalt, 46\u00b0C' },
  { at: 7.0, end: 11.0, s: 'the road starts to move' },
  { at: 15.5, end: 18.6, s: 'then the heat lets go' },
];

export default class HeatwaveScene extends Scene {
  private three = new THREE.Scene();
  private rig = new CameraRig();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 }, uAmp: { value: 0 }, uGust: { value: 0 } };
  private weed: THREE.Mesh;
  private weedBase: Float32Array;
  private layer = new Layer2D();
  private p = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 500);
    // keep the 38° vfov look: camToThreeCamera derives fov from rig.f with
    // the same logical H, so pinning focalLengthPx reproduces it exactly.
    this.rig.focalLengthPx = (H / 2) / Math.tan(THREE.MathUtils.degToRad(38 / 2));

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // tumbleweed: tangled knot — a displaced icosphere, dry ochre
    const geo = new THREE.IcosahedronGeometry(1.0, 2);
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = Math.sin(x * 12.3) * Math.cos(y * 9.7) * Math.sin(z * 11.1);
      const r = 1 + 0.35 * n;
      pos.setXYZ(i, x * r, y * r, z * r);
    }
    geo.computeVertexNormals();
    this.weedBase = new Float32Array(pos.array);
    this.weed = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x4a3520 }),
    );
    const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
    key.position.set(3, 5, 2);
    this.three.add(key, new THREE.AmbientLight(0xffe0b0, 0.8), this.weed);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uAmp.value = amp(t);
    this.u.uGust.value = gust(t);

    // tumbleweed crossing: enters ~t 5 with the gust swell, rolls right →
    // left along the near road band, closed-form x + bounce + spin.
    const wu = frac(t * 0.045);
    const wx = frac(wu + 0.15);                            // crossing u 0→1
    const wy = 0.32 + 0.008 * Math.abs(Math.sin(t * 6.1));  // contact bounce
    uvToWorld(wx, wy, this.p);
    this.weed.position.copy(this.p);
    this.weed.scale.setScalar(5.5);
    this.weed.rotation.set(t * 2.6, t * 0.9, -t * 3.4);
    this.weed.visible = wx < 0.97;

    // low dolly over the tarmac: gentle sway + slow push, slight roll —
    // evaluated through the rig (closed-form position/target, f(t) only).
    const push = ss(0, this.ctx.end, t);
    this.rig.position = [
      1.4 * Math.sin(t * 0.05),
      6.0 - 1.6 * push,
      24.0 - 2.5 * push,
    ];
    this.rig.target = [0, 13.5, PZ];
    this.rig.roll = 0.018 * Math.sin(t * 0.31);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // captions — low third, duck with the scene's own fade in/out
    const g = this.layer.ctx;
    this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    for (const c of CAPTIONS) {
      const a = ss(c.at, c.at + 0.5, t) * (1 - ss(c.end - 0.5, c.end, t)) * duck;
      if (a <= 0) continue;
      g.save();
      g.globalAlpha = a;
      // shrink-to-fit: at portrait widths a 52px caption overflows the
      // frame, so measure and scale the font down to a safe margin.
      const text = c.s.toUpperCase();
      const maxW = this.ctx.W - 48;
      let fs = 52;
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
      const tw = g.measureText(text).width;
      const tx = this.ctx.W / 2;
      const ty = this.ctx.H - 120;
      g.textAlign = 'center';
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 14;
      g.fillStyle = 'rgba(255,244,225,0.95)';
      g.fillText(text, tx, ty);
      g.restore();

      // telemetry: publish the caption's screen-space bbox so export
      // diagnostics (window.__motion.textProbes) sees the text.
      type Probe = {
        textProbes?: unknown[]; recordText?: boolean; probe?: boolean; currentFrameIdx?: number;
      };
      const P = (globalThis as { __motion?: Probe }).__motion
        ?? (globalThis as { __pdoom?: Probe }).__pdoom;
      // same gate as engine text.ts/scenegraph: only while diagnostics are
      // actually probing — otherwise a paused preview would keep appending
      // records every frame and grow the array without bound.
      if (P && P.probe && P.textProbes && P.recordText) {
        const bh = fs * 1.2;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0,
          t: f.t,
          text,
          fontFamily: F.archivo(112, 500),
          fontPx: fs,
          fillStyle: 'rgba(255,244,225,0.95)',
          globalAlpha: a,
          layerId: 'heatwave-captions',
          bbox: [tx - tw / 2, ty - fs, tx + tw / 2, ty - fs + bh],
          w: tw,
          h: bh,
          cx: tx,
          cy: ty - fs + bh / 2,
          hPct: (fs / 1080) * 100,
          isStroke: false,
        });
      }
    }
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    r.resetState();

    return {
      exposure: 0.75,
      bloom: 0.45,
      bloomThreshold: 0.62,
      bloomRadius: 0.8,
      ca: 0.1,
      grain: 0.05,
      vignette: 0.35,
      level: ss(0, 0.8, t) * (1 - ss(this.ctx.end - 0.8, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.texture.dispose();
    this.weed.geometry.dispose();
    (this.weed.material as THREE.Material).dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

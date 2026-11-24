// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// SCENE: AURORA (0.0s – 20.0s)
// Layered auroral curtains hanging over a dark starfield horizon: four tall
// translucent Bishop-RMF ribbons rippling in closed-form phase, feathered at
// every edge, ray striations streaming along their length. Colour story:
// near-black sky, pale green→bone curtains, a warm magenta fringe at the
// lower edge. Intensity breathes once mid-take then settles.
// Camera: near-static low tilt with a very slow push-in. f(t) closed-form only.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { RibbonGeometry } from '../../engine/ribbon';
import { ease, prog } from '../../engine/util';
import { SCALE } from '../../engine/scale';

const TAU = Math.PI * 2;

// ── Deterministic hash (no Math.random anywhere at frame time) ─────────────
const hash = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ── Curtain specifications: spine sweeps + per-curtain tint offset ─────────
interface CurtainSpec {
  x0: number;      // left end x
  span: number;    // horizontal extent
  yBase: number;   // vertical centre of the ribbon spine
  zBase: number;   // depth layer
  height: number;  // full ribbon width (curtain drop)
  phase: number;   // phase offset so curtains never march in step
  drift: number;   // lateral drift speed
  bright: number;  // base intensity scale
}
const CURTAINS: CurtainSpec[] = [
  { x0: -26, span: 52, yBase: 28.0, zBase: -30, height: 36.0, phase: 0.0, drift: 0.055, bright: 1.00 },
  { x0: -22, span: 46, yBase: 26.0, zBase: -24, height: 32.0, phase: 1.9, drift: 0.075, bright: 0.82 },
  { x0: -30, span: 60, yBase: 32.0, zBase: -40, height: 44.0, phase: 3.7, drift: 0.038, bright: 0.60 },
  { x0: -18, span: 38, yBase: 24.0, zBase: -19, height: 30.0, phase: 5.1, drift: 0.095, bright: 0.72 },
];

// Spine f(t, s): a meandering ribbon-top path. Low-frequency waves give the
// curtain its fold shape; a faster incommensurate term keeps it alive.
function curtainSpine(c: CurtainSpec) {
  return (t: number, s: number): [number, number, number] => {
    const tt = t * c.drift;
    const x = c.x0 + s * c.span
      + 1.6 * Math.sin(TAU * (0.31 * s + tt * 0.9) + c.phase)
      + 0.35 * Math.sin(TAU * (1.9 * s - tt * 1.7) + c.phase * 2.0);
    const y = c.yBase
      + 0.9 * Math.sin(TAU * (0.42 * s + tt * 0.7) + c.phase * 1.3)
      + 0.22 * Math.sin(TAU * (3.1 * s - tt * 2.3) + c.phase * 0.6);
    const z = c.zBase
      + 2.2 * Math.sin(TAU * (0.24 * s - tt * 0.5) + c.phase * 0.8)
      + 0.5 * Math.sin(TAU * (1.4 * s + tt * 1.1) + c.phase * 1.9);
    return [x, y, z];
  };
}

// Ribbon drop width tapers gently toward both ends of the sweep.
function curtainWidth(c: CurtainSpec) {
  return (s: number, t = 0) => {
    const taper = 0.72 + 0.28 * Math.sin(Math.PI * s);
    const breatheW = 1.0 + 0.05 * Math.sin(TAU * (0.7 * s - t * 0.11) + c.phase);
    return c.height * taper * breatheW;
  };
}

const RIBBON_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Aurora fragment: ray striations streaming along the curtain (v = s along
// the spine), green→bone body, warm magenta fringe at the lower edge,
// feathered at every boundary. uv.x = 0 top edge → 1 bottom edge.
const RIBBON_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;      // local scene time
  uniform float uPhase;     // curtain phase offset
  uniform float uBright;    // curtain base brightness
  uniform float uBreath;    // global breathing intensity
  uniform float uSeed;      // per-curtain noise seed

  float aur_hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float aur_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(aur_hash(i), aur_hash(i + vec2(1, 0)), f.x),
               mix(aur_hash(i + vec2(0, 1)), aur_hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    float u = vUv.x;          // 0 top → 1 bottom (across ribbon width)
    float v = vUv.y;          // along the spine

    // Ray striations: layered sines + 2-octave value noise, all drifting
    // laterally so the rays stream along the curtain (the "shimmer").
    float drift = uTime * 0.16;
    float rays =
        0.55 * sin(v * 95.0 - drift * 6.0 + uPhase * 7.0)
      + 0.30 * sin(v * 41.0 + drift * 3.4 - uPhase * 3.0)
      + 0.55 * aur_noise(vec2(v * 60.0 - drift * 8.0, uSeed * 17.0))
      + 0.40 * aur_noise(vec2(v * 23.0 + drift * 2.0, uSeed * 31.0 + 7.0));
    float rayMask = smoothstep(0.35, 1.15, rays * 0.5 + 0.5);

    // Vertical profile: soft top edge, bright body, fringe at the foot.
    float topFade   = smoothstep(0.00, 0.14, u);
    float footFade  = 1.0 - smoothstep(0.72, 1.00, u);
    float body      = topFade * footFade;

    // Curtain ends feather out along the sweep.
    float endFade = smoothstep(0.0, 0.06, v) * (1.0 - smoothstep(0.94, 1.0, v));

    // Palette: pale aurora green rising to bone in the upper body, a warm
    // magenta fringe bleeding into the lowest band — muted, not neon.
    vec3 green   = vec3(0.30, 0.86, 0.48);
    vec3 bone    = vec3(0.82, 0.92, 0.72);
    vec3 magenta = vec3(0.84, 0.30, 0.55);
    vec3 col = mix(green, bone, smoothstep(0.05, 0.55, u) * 0.55);
    float fringe = smoothstep(0.80, 0.97, u);
    col = mix(col, magenta, fringe * 0.72);

    // Brightness breathes along the curtain length as well as globally.
    float pulse = 0.82 + 0.18 * sin(v * 9.0 - uTime * 0.45 + uPhase);

    float a = body * endFade * (0.22 + 0.78 * rayMask) * pulse * uBright * uBreath;
    gl_FragColor = vec4(col * (0.5 + 0.5 * rayMask), a * 0.78);
  }
`;

export default class AuroraScene extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private ribbons: { geo: RibbonGeometry; mesh: THREE.Mesh; spec: CurtainSpec }[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private stars: THREE.Points;
  private ground: THREE.Mesh;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.camera = new THREE.PerspectiveCamera(55, ctx.W / ctx.H, 0.1, 300);
    this.threeScene.background = new THREE.Color(0x020409);
    this.threeScene.fog = new THREE.Fog(0x020409, 30, 95);

    // ── Starfield: deterministic hash-of-index placement on a dome cap
    //    behind and beneath the curtains — no Math.random. ──
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const az = (hash(i, 1) - 0.5) * 2.6;                    // azimuth spread
      const el = hash(i, 2) * 1.15 - 0.06;                    // elevation ~ -3°..66°
      const r = 58 + hash(i, 3) * 30;
      pos[i * 3] = Math.sin(az) * Math.cos(el) * r;
      pos[i * 3 + 1] = Math.sin(el) * r - 2;
      pos[i * 3 + 2] = -Math.cos(az) * Math.cos(el) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xd8d9cf,
      // PointsMaterial fixed sizes are in framebuffer px: multiply by the
      // export scale so stars keep their logical size on high-DPI renders.
      size: 1.5 * SCALE,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.8,
      fog: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.threeScene.add(this.stars);

    // ── Horizon: near-black ground plane closing the lower frame. ──
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshBasicMaterial({ color: 0x03060b })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -6;
    this.threeScene.add(this.ground);

    // ── Curtains: Bishop-RMF ribbons, binormal ≈ -Y so each sheet hangs
    //    vertically from its meandering spine. ──
    for (const c of CURTAINS) {
      const geo = new RibbonGeometry({
        segments: 128,
        width: curtainWidth(c),
        spine: curtainSpine(c),
        initialNormal: [0, 0, 1],
        time: 0,
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uPhase: { value: c.phase },
          uBright: { value: c.bright },
          uBreath: { value: 1 },
          uSeed: { value: c.phase * 10.0 + 3.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.materials.push(mat);
      this.ribbons.push({ geo, mesh, spec: c });
      this.threeScene.add(mesh);
    }
  }

  render(frame: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { lt } = frame;
    const { renderer } = this.ctx;

    // Ribbons re-evaluate their closed-form spine at t.
    for (const r of this.ribbons) r.geo.updateFromTime(lt);

    // One breathing hump mid-take (≈ t = 11), settling back to baseline.
    const breath = 0.9 + 0.35 * Math.exp(-((lt - 11) * (lt - 11)) / 7.0);
    for (const m of this.materials) {
      m.uniforms.uTime!.value = lt;
      m.uniforms.uBreath!.value = breath;
    }

    // Camera: low near-static tilt, very slow push-in, whisper of yaw drift.
    const push = prog(lt, 0, 20, ease.inOutCubic);
    const z = 26 - 4.5 * push;
    this.camera.position.set(
      0.4 * Math.sin(lt * 0.06),
      0.9 + 0.3 * Math.sin(lt * 0.045 + 1.0),
      z
    );
    this.camera.lookAt(0, 12.5, -14);

    renderer.setRenderTarget(out);
    renderer.setClearColor(0x020409, 1.0);
    renderer.clear(true, true, true);
    renderer.render(this.threeScene, this.camera);
    renderer.resetState();

    return {
      bloom: 0.22 + 0.10 * (breath - 0.9),
      bloomThreshold: 0.55,
      vignette: 0.24,
      grain: 0.014,
      exposure: 1.02,
    };
  }

  override dispose(): void {
    for (const r of this.ribbons) r.geo.dispose();
    for (const m of this.materials) m.dispose();
    this.stars.geometry.dispose();
    (this.stars.material as THREE.Material).dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
  }
}

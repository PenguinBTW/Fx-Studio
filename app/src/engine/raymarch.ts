// Raymarch helpers: GLSL chunk composition (buildMarcher) and a fullscreen RaymarchPass that wires
// camera uniforms, quality tiers, optional linear-depth output and optional half-resolution
// rendering with a depth-aware upsample. API and limits: docs/engine/raymarch.md.
import * as THREE from 'three';
import { GLSL_COMMON } from './glsl/common';
import { GLSL_NOISE } from './glsl/noise';
import { GLSL_SPECTRUM } from './glsl/spectrum';
import { GLSL_RM_CORE, GLSL_RM_MARCH, GLSL_RM_VOLUME, GLSL_RM_VOLUME_UNIFORMS, RM_TIERS } from './glsl/raymarch';
import { SS_TAP, SS_TAP_GLSL, PW, PH, FSPass } from './gl';

export { RM_TIERS };
export type RmQuality = 0 | 1 | 2;

export interface VolumeSource {
  /** GLSL: `float volDensity(vec3 p, int lod)`, extinction per world unit. lod 0 = view march, 1 = light march (cheaper). */
  density: string;
  /** GLSL: `vec3 volEmission(vec3 p, float sigma)`, emitted radiance per world unit (linear HDR). Enables emission. */
  emission?: string;
  /** GLSL: `vec3 volAmbient(vec3 p)`, unscattered sky light added to in-scatter. Only used with scatter. */
  ambient?: string;
  /** Light-march in-scatter from `rmSunDir`/`rmSunColor` (clouds). Default false. */
  scatter?: boolean;
}

export interface MarcherOpts {
  /** GLSL declaring `float map(vec3 p)` (any helper functions it needs come first in the same string). */
  map?: string;
  volume?: VolumeSource;
  /** GLSL placed after the chunks (shading, main helpers). */
  after?: string;
  /** Include GLSL_NOISE (default true; set false if `map` text already pulls it in). */
  noise?: boolean;
  /** Include GLSL_SPECTRUM (blackbodyToLinearSRGB etc). Default false. */
  spectrum?: boolean;
}

/**
 * Compose the raymarch GLSL: [ssTap uniform][noise][spectrum][core uniforms/ray setup][your map][RM_MAP
 * bound to map()][march/normal/AO/shadow][volume]. Assumes GLSL_COMMON precedes it (FSPass and
 * RaymarchPass both prepend it). Quality is the runtime uniform `rmQuality` (0, 1, 2).
 */
export function buildMarcher(o: MarcherOpts = {}): string {
  const v = o.volume;
  const parts: string[] = [SS_TAP_GLSL];
  if (o.noise !== false) parts.push(GLSL_NOISE);
  if (o.spectrum) parts.push(GLSL_SPECTRUM);
  parts.push(GLSL_RM_CORE);
  if (v) {
    parts.push(GLSL_RM_VOLUME_UNIFORMS);
    parts.push(v.density);
    parts.push(v.emission ?? 'vec3 volEmission(vec3 p, float s) { return vec3(0.0); }');
    parts.push(v.ambient ?? 'vec3 volAmbient(vec3 p) { return vec3(0.0); }');
    parts.push(`#define RM_VOL_EMIT ${v.emission ? 1 : 0}\n#define RM_VOL_SCATTER ${v.scatter ? 1 : 0}`);
  }
  parts.push(o.map ?? 'float map(vec3 p) { return length(p) - 1.0; }');
  parts.push('#define RM_MAP(p) map(p)');
  parts.push(GLSL_RM_MARCH);
  if (v) parts.push(GLSL_RM_VOLUME);
  if (o.after) parts.push(o.after);
  return parts.join('\n');
}

const OUT_GLSL = /* glsl */ `
layout(location = 0) out vec4 fragColor;
#ifdef RM_MRT
layout(location = 1) out vec4 fragDepth;
#endif
`;

const MAIN_GLSL = /* glsl */ `
void main() {
  int cnt = ssTap >= 0 ? 1 : (rmQuality >= 2 ? 4 : 1);
  int t0 = ssTap >= 0 ? ssTap : (rmQuality >= 2 ? 0 : -1);
  vec4 acc = vec4(0.0);
  float dAcc = 0.0;
  for (int j = 0; j < 4; j++) {
    if (j >= cnt) break;
    rmTapIdx = t0 < 0 ? -1 : t0 + j;
    vec3 ro, rd;
    rmRay(ro, rd);
    float d = rmNearFar.y;
    vec4 c = rmShade(ro, rd, d);
    acc += c;
    dAcc += rmViewDepth(min(d, rmNearFar.y), rd) * c.a;
  }
  acc /= float(cnt);
  float cov = acc.a;
  float depth = cov > 1e-4 ? dAcc / (float(cnt) * cov) : rmNearFar.y;
  fragColor = acc;
#ifdef RM_MRT
  fragDepth = vec4(depth, cov, 0.0, 1.0);
#endif
}
`;

export interface RaymarchPassOpts extends MarcherOpts {
  /**
   * GLSL: `vec4 rmShade(vec3 ro, vec3 rd, out float viewDepth)` returning PREMULTIPLIED linear HDR rgba.
   * `viewDepth` is the distance along the ray (converted to view-axis depth for you); leave it at the
   * default (far) for sky. It runs once per pixel (tier 0/1) or once per rotated-grid tap (tier 2 stills).
   */
  shade: string;
  quality?: RmQuality;
  /** Over-relaxation factor for sphere tracing, 1 = off, 1.2..1.6 typical. Default 1. */
  relax?: number;
  /** Extra uniforms for map/shade. */
  uniforms?: Record<string, THREE.IUniform>;
  /** Also render linear view depth (r) and coverage (g) to `depthTexture`. */
  depth?: boolean;
  /** Render at half resolution and upsample (bilinear, or depth-aware if `guide` is set). */
  halfRes?: boolean;
}

const UP_FRAG = /* glsl */ `
uniform sampler2D src; uniform sampler2D dep; uniform sampler2D guide;
uniform vec2 lowRes; uniform float useGuide;
void main() {
  vec2 p = vUv * lowRes - 0.5;
  ivec2 i0 = ivec2(floor(p));
  vec2 f = p - floor(p);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  float gd = useGuide > 0.5 ? texture(guide, vUv).r : 0.0;
  ivec2 lim = ivec2(lowRes) - 1;
  for (int k = 0; k < 4; k++) {
    ivec2 o = ivec2(k & 1, k >> 1);
    ivec2 q = clamp(i0 + o, ivec2(0), lim);
    float w = (o.x == 1 ? f.x : 1.0 - f.x) * (o.y == 1 ? f.y : 1.0 - f.y);
    if (useGuide > 0.5) {
      float d = texelFetch(dep, q, 0).r;
      w *= 1.0 / (0.02 + abs(d - gd) / max(gd, 1e-3) * 8.0);
    }
    acc += texelFetch(src, q, 0) * w;
    wsum += w;
  }
  fragColor = acc / max(wsum, 1e-6);
}`;

const COPY_FRAG = /* glsl */ `uniform sampler2D src; void main() { fragColor = texelFetch(src, ivec2(gl_FragCoord.xy), 0); }`;

export class RaymarchPass {
  readonly mat: THREE.RawShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mesh: THREE.Mesh;
  private rt: THREE.WebGLRenderTarget | null = null;
  private up: FSPass | null = null;
  private copy: FSPass | null = null;
  private opts: RaymarchPassOpts;
  private baseAngle = 0.001 * PH;
  private pcam = new THREE.PerspectiveCamera(50, PW / PH, 0.05, 400);
  /** Linear view depth (r, world units along the camera axis) and coverage (g). Half-res if `halfRes`. Null unless `depth` or `halfRes`. */
  depthTexture: THREE.Texture | null = null;
  /** Optional full-res linear-depth texture (r) that steers the half-res upsample. */
  guide: THREE.Texture | null = null;

  constructor(opts: RaymarchPassOpts) {
    this.opts = opts;
    const mrt = !!opts.depth || !!opts.halfRes;
    const body = buildMarcher(opts) + '\n' + opts.shade + '\n' + MAIN_GLSL;
    const u: Record<string, THREE.IUniform> = {
      rmInvVP: { value: new THREE.Matrix4() },
      rmCamPos: { value: new THREE.Vector3() },
      rmCamFwd: { value: new THREE.Vector3(0, 0, -1) },
      rmNearFar: { value: new THREE.Vector2(0.05, 400) },
      rmRes: { value: new THREE.Vector2(PW, PH) },
      rmTime: { value: 0 },
      rmFrame: { value: 0 },
      rmPixelAngle: { value: 0.001 },
      rmRelax: { value: opts.relax ?? 1 },
      rmEpsMin: { value: 0.0005 },
      rmStepsOverride: { value: 0 },
      rmQuality: { value: opts.quality ?? 0 },
      ssTap: SS_TAP,
      rmVolDt: { value: 0 },
      rmVolGrow: { value: 0.0 },
      rmVolCutoff: { value: 0.01 },
      rmLightDist: { value: 2.0 },
      rmPowder: { value: 0.0 },
      rmSunDir: { value: new THREE.Vector3(0, 1, 0) },
      rmSunColor: { value: new THREE.Vector3(1, 1, 1) },
      rmSkyColor: { value: new THREE.Vector3(0.3, 0.4, 0.6) },
      rmAlbedo: { value: new THREE.Vector3(1, 1, 1) },
      rmPhase: { value: new THREE.Vector3(0.6, 0.3, 0.7) },
      ...opts.uniforms,
    };
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `precision highp float;\nin vec3 position;\nout vec2 vUv;\nvoid main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `${mrt ? '#define RM_MRT 1\n' : ''}precision highp float;\nprecision highp int;\nin vec2 vUv;\n${OUT_GLSL}\n${GLSL_COMMON}\n${body}`,
      uniforms: u,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    if (opts.halfRes) {
      this.up = new FSPass(UP_FRAG, { src: { value: null }, dep: { value: null }, guide: { value: null }, lowRes: { value: new THREE.Vector2() }, useGuide: { value: 0 } });
    } else if (mrt) {
      this.copy = new FSPass(COPY_FRAG, { src: { value: null } });
    }
  }

  get u() { return this.mat.uniforms; }

  setQuality(q: RmQuality) { this.u.rmQuality!.value = q; return this; }
  setTime(t: number) { this.u.rmTime!.value = t; return this; }
  /** Integer frame index for the start jitter (0 = static pattern; never derive it from time). */
  setFrame(i: number) { this.u.rmFrame!.value = i | 0; return this; }
  /** Override the march step budget for this pass (0 = tier default). */
  setSteps(n: number) { this.u.rmStepsOverride!.value = n | 0; return this; }
  setSun(dir: [number, number, number], color: [number, number, number]) {
    (this.u.rmSunDir!.value as THREE.Vector3).set(...dir).normalize();
    (this.u.rmSunColor!.value as THREE.Vector3).set(...color);
    return this;
  }

  /** Camera from a position, a look-at target and a vertical FOV in degrees (roll in radians about the view axis). */
  lookAt(pos: [number, number, number], target: [number, number, number], fovDeg = 50, roll = 0, near = 0.05, far = 400, up: [number, number, number] = [0, 1, 0]) {
    const c = this.pcam;
    c.fov = fovDeg; c.near = near; c.far = far;
    c.position.set(...pos);
    c.up.set(...up);
    c.lookAt(target[0], target[1], target[2]);
    if (roll) c.rotateZ(roll);
    return this.setCamera(c);
  }

  /** Any three camera (e.g. `ctx.threeCam` after `ctx.updateCamera`). */
  setCamera(cam: THREE.Camera) {
    cam.updateMatrixWorld(true);
    const pc = cam as THREE.PerspectiveCamera;
    if (pc.updateProjectionMatrix && (cam as any).isPerspectiveCamera) { pc.aspect = PW / PH; pc.updateProjectionMatrix(); }
    const inv = new THREE.Matrix4().multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
    (this.u.rmInvVP!.value as THREE.Matrix4).copy(inv);
    const pos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    (this.u.rmCamPos!.value as THREE.Vector3).copy(pos);
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    (this.u.rmCamFwd!.value as THREE.Vector3).copy(fwd);
    (this.u.rmNearFar!.value as THREE.Vector2).set(pc.near, pc.far);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(pc.fov ?? 50) / 2);
    this.baseAngle = 2 * tanHalf;
    return this;
  }

  private ensureRT(w: number, h: number, mrt: boolean) {
    if (this.rt && this.rt.width === w && this.rt.height === h) return this.rt;
    this.rt?.dispose();
    const rt = new THREE.WebGLRenderTarget(w, h, {
      count: mrt ? 2 : 1, type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    });
    if (mrt) {
      rt.textures[1]!.type = THREE.FloatType;
      rt.textures[1]!.minFilter = THREE.NearestFilter;
      rt.textures[1]!.magFilter = THREE.NearestFilter;
    }
    this.rt = rt;
    this.depthTexture = mrt ? rt.textures[1]! : null;
    return rt;
  }

  /** Render into `out` (HalfFloat, PW x PH). Resets GL state afterwards. */
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget) {
    const o = this.opts;
    const mrt = !!o.depth || !!o.halfRes;
    const res = this.u.rmRes!.value as THREE.Vector2;
    if (!mrt) {
      res.set(out.width, out.height);
      this.u.rmPixelAngle!.value = this.baseAngle / out.height;
      renderer.setRenderTarget(out);
      renderer.render(this.scene, this.cam);
    } else {
      const w = o.halfRes ? Math.ceil(out.width / 2) : out.width;
      const h = o.halfRes ? Math.ceil(out.height / 2) : out.height;
      const rt = this.ensureRT(w, h, true);
      res.set(w, h);
      this.u.rmPixelAngle!.value = this.baseAngle / h;
      renderer.setRenderTarget(rt);
      renderer.render(this.scene, this.cam);
      if (this.up) {
        this.up.u.src!.value = rt.textures[0];
        this.up.u.dep!.value = rt.textures[1];
        this.up.u.guide!.value = this.guide;
        this.up.u.useGuide!.value = this.guide ? 1 : 0;
        (this.up.u.lowRes!.value as THREE.Vector2).set(w, h);
        this.up.render(renderer, out);
      } else if (this.copy) {
        this.copy.u.src!.value = rt.textures[0];
        this.copy.render(renderer, out);
      }
    }
    renderer.setRenderTarget(null);
    renderer.resetState();
  }

  dispose() {
    this.mat.dispose();
    this.mesh.geometry.dispose();
    this.rt?.dispose();
    this.up?.dispose();
    this.copy?.dispose();
  }
}

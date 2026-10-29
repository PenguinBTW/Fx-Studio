// Global post-processing: bloom + halation, chromatic aberration, tone shoulder,
// film grain, vignette, fades/flash. Operates on the composited HDR (linear) frame.
import * as THREE from 'three';
import { FSPass, makeRT, W, H, SCALE } from './gl';
import { OpticsPass, DEFAULT_OPTICS, type OpticsParams } from './post_optics';
import { DepthDoFPass, DEFAULT_DEPTH_DOF, type DepthDoFParams } from './dof';

export { DEFAULT_OPTICS, type OpticsParams, DepthDoFPass, DEFAULT_DEPTH_DOF, type DepthDoFParams };

/** The tone shoulder (linear HDR -> 0..1 linear), shared with the engine's sampling error estimate. */
export const SHOULDER_GLSL = /* glsl */ `
vec3 shoulder(vec3 x) {
  // identity below k, smooth exponential shoulder above; very bright values desaturate toward white
  const float k = 0.72;
  vec3 y = mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
  float over = max(max(x.r, x.g), x.b);
  return mix(y, vec3(1.0), smoothstep(2.0, 12.0, over) * 0.85);
}`;

/** Optional alternative tone maps (linear HDR -> 0..1 linear). Mode 0 (legacy) is handled by `shoulder` in the final pass, not here. */
export const TONEMAP_GLSL = /* glsl */ `
vec3 tmAcesFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 tmAces(vec3 c) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  return clamp(OUT * tmAcesFit(IN * (c / 0.6)), 0.0, 1.0);
}
vec3 tmAgxContrast(vec3 x) {
  vec3 x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 tmAgx(vec3 c) {
  const mat3 TO2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 FROM2020 = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 INSET = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 OUTSET = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float MIN_EV = -12.47393, MAX_EV = 4.026069;
  c = INSET * (TO2020 * c);
  c = clamp((log2(max(c, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV), 0.0, 1.0);
  c = pow(max(OUTSET * tmAgxContrast(c), 0.0), vec3(2.2));
  return clamp(FROM2020 * c, 0.0, 1.0);
}
vec3 tmCurve(vec3 c, int mode) { return mode == 1 ? tmAces(c) : tmAgx(c); }
// mode 1 = aces, 2 = agx. hue > 0 blends toward a version that tone-maps the max channel only and rescales RGB
// (channel ratios, hence hue, are kept; very bright values still desaturate toward white like the legacy shoulder).
vec3 toneMapAlt(vec3 c, int mode, float hue) {
  c = max(c, vec3(0.0));
  vec3 y = tmCurve(c, mode);
  if (hue <= 0.0) return y;
  float m = max(max(c.r, c.g), max(c.b, 1e-6));
  float tm = tmCurve(vec3(m), mode).g;
  vec3 yh = c * (tm / m);
  yh = mix(yh, vec3(tm), smoothstep(2.0, 12.0, m) * 0.85);
  return mix(y, yh, hue);
}`;

export interface PostParams {
  exposure: number;
  bloom: number; // bloom strength
  bloomIntensity?: number; // Ergonomic alias for bloom
  bloomThreshold: number; // linear luminance where bloom starts
  bloomKnee: number; // soft knee width
  bloomRadius: number; // 0..1 upsample spread
  halation: number; // red-orange film halation around highlights
  ca: number; // chromatic aberration in px at the frame edge
  grain: number; // grain amplitude (sRGB units), ~0.04-0.1
  filmGrain?: number; // Ergonomic alias for grain
  vignette: number; // 0..1
  hud: number; // HUD opacity multiplier (crop marks, readout)
  /** 0..1: the crop-mark frame (1 = in place, 0 = flown out past the edges). */
  frame: number;
  /** Opacity of the corner metric/technical readout — 0 by default. */
  metricReadout?: number;
  pdoom: number; // Backwards-compatible alias for metricReadout
  /** 0..1: the frame is light (bone paper) — the HUD switches captions and crop marks to ink. */
  paper: number;
  fade: number; // fade to black 0..1 (1 = exactly black: grain, dither, bloom and vignette all go to 0 with it)
  flash: number; // additive bone-white flash 0..1+
  shake: [number, number]; // frame offset in px
  zoom: number; // frame zoom (1 = none), for punch-ins on hits
  invert: number; // 0..1 invert (ink <-> bone), applied before grain
  /** Whether to output transparent alpha channel (for WebM/ProRes overlays). */
  transparent?: boolean;
  /** Replace the HUD metric digits (e.g. '0.85', 'LIVE', 'NaN'). */
  metricText?: string;
  pdoomText?: string; // Backwards-compatible alias
  /** 0..1 glitch the HUD readout. */
  hudCorruption?: number;

  // Radial screen-space depth of field (legacy mode). NOT scene depth: the blur grows with the
  // distance of the pixel from the screen centre (0 = centre, ~0.5 = mid-edge, ~0.9 = corner).
  // A world-depth mode (`depthFocusDist` in scene units, plus an aperture) will arrive with the depth DoF pass;
  // `dof`, `focusDist`, `focalRange`, `dofRadius` will keep their radial meaning for existing projects.
  dof?: number; // 0 = off, 1 = full
  focusDist?: number; // Radius from the screen centre (screen-space, aspect-corrected, 0..~0.9) that stays sharp. Not a world depth.
  focalRange?: number; // Width of the in-focus ring around focusDist (same screen-radius units, default 0.15)
  dofRadius?: number; // Max blur radius in px (default 4.0)

  // Physical Depth-Based Depth of Field & Bokeh (P7b)
  depthDof?: Partial<DepthDoFParams>;
  depthFocusDist?: number; // Ergonomic alias for depthDof.focusDistance
  depthAperture?: number;  // Ergonomic alias for depthDof.aperture

  // Volumetric Atmospheric Light Scatter / God Rays
  volumetric?: number; // 0 = off, 1 = maximum atmospheric haze
  volumetricLightPos?: [number, number]; // Normalized screen pos [x, y], default [0.5, 0.2]
  volumetricDecay?: number; // Falloff per step at 10 steps (other tiers rescale it so the ray looks the same), default 0.94
  /** Ray-march steps (quality tier): 10 = default/legacy, GODRAY_TIERS.high = 24, .ultra = 48. Max 64. Brightness is step-count independent. */
  volumetricSteps?: number;
  /** 0..1 per-pixel IGN start-offset jitter that trades step banding for fine noise. Default: 0 at 10 steps, 1 above. */
  volumetricJitter?: number;

  // Cinematic Color Grading
  /** Enum look (legacy), or a per-frame lift/gamma/gain/saturation/tint grade (values, or `(t) => values`). */
  grade?: GradeEnum | GradeParams | ((t: number) => GradeParams);
  colorTint?: [number, number, number]; // [r, g, b] global color bias

  /** Output black level in display (sRGB-encoded) units: out = max(out - blackPoint, 0) / (1 - blackPoint), after grain. Default 0 (off). */
  blackPoint?: number;
  /** Multiplicative output level, applied last together with `fade` (level * (1 - fade)). 1 = normal, 0 = exact black. Default 1. */
  level?: number;
  /** Highlight tone map. 'legacy' (default) is the original exponential shoulder. */
  toneMap?: 'legacy' | 'aces' | 'agx';
  /** 0..1: for 'aces'/'agx', blend toward a hue-preserving version (curve applied to max channel, RGB rescaled). Default 0. */
  toneMapHue?: number;
  /** Photon optics (airy disk + diffraction spikes on HDR highlights). Off unless this object is given with intensity > 0. */
  optics?: Partial<OpticsParams>;
}

export type GradeEnum = 'none' | 'industrial' | 'warm_editorial' | 'monochrome_blueprint' | 'infrared';
type V3 = [number, number, number];
export interface GradeParams {
  /** Linear-light offset added after gain (scalar or [r,g,b]); default 0. */
  lift?: number | V3;
  /** Power: out = in^(1/gamma) in linear light; default 1. */
  gamma?: number | V3;
  /** Linear multiplier; default 1. */
  gain?: number | V3;
  /** 1 = unchanged, 0 = luma only; default 1. */
  saturation?: number;
  /** Linear RGB multiplier; default [1,1,1]. */
  tint?: number | V3;
}
export interface ResolvedGrade { lift: V3; gamma: V3; gain: V3; saturation: number; tint: V3 }

export const GODRAY_TIERS = { draft: 10, high: 24, ultra: 48 } as const;

const toV3 = (v: number | V3 | undefined, d: number): V3 => (v === undefined ? [d, d, d] : typeof v === 'number' ? [v, v, v] : [v[0], v[1], v[2]]);

/** Fill a partial grade with identity defaults. */
export function resolveGrade(g: GradeParams): ResolvedGrade {
  return { lift: toV3(g.lift, 0), gamma: toV3(g.gamma, 1), gain: toV3(g.gain, 1), saturation: g.saturation ?? 1, tint: toV3(g.tint, 1) };
}

/**
 * Smooth blend of two grades, k clamped to 0..1 (ease k yourself for non-linear timing).
 * lift and saturation blend linearly; gamma, gain and tint blend in log space (multiplicative), so
 * a 0.5 mix of gain 0.5 and gain 2 is 1.0, not 1.25.
 */
export function gradeMix(a: GradeParams, b: GradeParams, k: number): ResolvedGrade {
  const x = resolveGrade(a), y = resolveGrade(b);
  const t = Math.min(1, Math.max(0, k));
  const lin = (p: number, q: number) => p + (q - p) * t;
  const geo = (p: number, q: number) => (p > 0 && q > 0 ? Math.exp(Math.log(p) + (Math.log(q) - Math.log(p)) * t) : lin(p, q));
  const v = (f: (p: number, q: number) => number, p: V3, q: V3): V3 => [f(p[0], q[0]), f(p[1], q[1]), f(p[2], q[2])];
  return { lift: v(lin, x.lift, y.lift), gamma: v(geo, x.gamma, y.gamma), gain: v(geo, x.gain, y.gain), saturation: lin(x.saturation, y.saturation), tint: v(geo, x.tint, y.tint) };
}

export const DEFAULT_POST: PostParams = {
  exposure: 1,
  bloom: 0.55,
  bloomThreshold: 0.85,
  bloomKnee: 0.5,
  bloomRadius: 0.75,
  halation: 0.25,
  ca: 1.2,
  grain: 0.055,
  vignette: 0.35,
  hud: 1,
  frame: 0,
  transparent: false,
  metricReadout: 0,
  pdoom: 0,
  paper: 0,
  fade: 0,
  flash: 0,
  shake: [0, 0],
  zoom: 1,
  invert: 0,
  dof: 0,
  focusDist: 0.5,
  focalRange: 0.15,
  dofRadius: 4.0,
  depthDof: undefined,
  depthFocusDist: undefined,
  depthAperture: undefined,
  volumetric: 0,
  volumetricLightPos: [0.5, 0.2],
  volumetricDecay: 0.94,
  volumetricSteps: 10,
  grade: 'none',
  colorTint: [1, 1, 1],
  blackPoint: 0,
  level: 1,
  toneMap: 'legacy',
  toneMapHue: 0,
};

const MIPS = 7;

function unpackGradeV3(val: number | V3 | undefined, defaultVal: number, out: THREE.Vector3): void {
  if (val === undefined) out.set(defaultVal, defaultVal, defaultVal);
  else if (typeof val === 'number') out.set(val, val, val);
  else out.set(val[0], val[1], val[2]);
}

export class Post {
  private prefilter: FSPass;
  private down: FSPass;
  private up: FSPass;
  private final: FSPass;
  private optics: OpticsPass | null = null;
  private depthDofPass: DepthDoFPass | null = null;
  private scratchDofParams: Partial<DepthDoFParams> = {};
  private scratchOpticsParams: OpticsParams = { ...DEFAULT_OPTICS };
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];

  constructor() {
    // the bloom pyramid stays at the logical resolution at every output scale (same radii, same look)
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < MIPS; i++) {
      this.mips.push(makeRT(Math.max(2, w), Math.max(2, h), { depthBuffer: false, pxScale: 1 }));
      this.ups.push(makeRT(Math.max(2, w), Math.max(2, h), { depthBuffer: false, pxScale: 1 }));
      w >>= 1; h >>= 1;
    }
    this.prefilter = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform vec2 texel; uniform float threshold, knee;
      void main() {
        // 4-tap box downsample + soft threshold on luminance
        vec3 c = vec3(0.0);
${SCALE === 1 ? `        c += texture(src, vUv + texel * vec2(-1, -1)).rgb; c += texture(src, vUv + texel * vec2(1, -1)).rgb;
        c += texture(src, vUv + texel * vec2(-1, 1)).rgb;  c += texture(src, vUv + texel * vec2(1, 1)).rgb;
        c *= 0.25;` : `        // output scale > 1: the same 4x4-logical-px box from a SCALE x larger source, as 2x2-texel bilinear taps
        const int N = ${SCALE * 2};
        for (int j = 0; j < N; j++) for (int i = 0; i < N; i++)
          c += texture(src, vUv + texel * (vec2(float(i), float(j)) * 2.0 - float(N - 1)) / PX_SCALE).rgb;
        c /= float(N * N);`}
        c = min(c, vec3(40.0));
        float l = max(c.r, max(c.g, c.b));
        float rq = clamp(l - threshold + knee, 0.0, 2.0 * knee);
        rq = rq * rq / (4.0 * knee + 1e-5);
        float w = max(rq, l - threshold) / max(l, 1e-5);
        fragColor = vec4(c * w, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } });
    this.down = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform vec2 texel;
      void main() {
        // 13-tap downsample (Jimenez 2014)
        vec3 a = texture(src, vUv + texel * vec2(-2, -2)).rgb, b = texture(src, vUv + texel * vec2(0, -2)).rgb, c = texture(src, vUv + texel * vec2(2, -2)).rgb;
        vec3 d = texture(src, vUv + texel * vec2(-1, -1)).rgb, e = texture(src, vUv + texel * vec2(1, -1)).rgb;
        vec3 f = texture(src, vUv + texel * vec2(-2, 0)).rgb, g = texture(src, vUv).rgb, h = texture(src, vUv + texel * vec2(2, 0)).rgb;
        vec3 i = texture(src, vUv + texel * vec2(-1, 1)).rgb, j = texture(src, vUv + texel * vec2(1, 1)).rgb;
        vec3 k = texture(src, vUv + texel * vec2(-2, 2)).rgb, l = texture(src, vUv + texel * vec2(0, 2)).rgb, m = texture(src, vUv + texel * vec2(2, 2)).rgb;
        vec3 o = (d + e + i + j) * 0.125 + (a + b + g + f) * 0.03125 + (b + c + h + g) * 0.03125 + (f + g + l + k) * 0.03125 + (g + h + m + l) * 0.03125;
        fragColor = vec4(o, 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform sampler2D prev; uniform vec2 texel; uniform float radius;
      void main() {
        // 9-tap tent upsample of the smaller level, added to this level
        vec2 o = texel * radius;
        vec3 s = texture(src, vUv - o).rgb + 2.0 * texture(src, vUv + vec2(0, -o.y)).rgb + texture(src, vUv + vec2(o.x, -o.y)).rgb
          + 2.0 * texture(src, vUv + vec2(-o.x, 0)).rgb + 4.0 * texture(src, vUv).rgb + 2.0 * texture(src, vUv + vec2(o.x, 0)).rgb
          + texture(src, vUv + vec2(-o.x, o.y)).rgb + 2.0 * texture(src, vUv + vec2(0, o.y)).rgb + texture(src, vUv + o).rgb;
        fragColor = vec4(texture(prev, vUv).rgb + s / 16.0, 1.0);
      }`, { src: { value: null }, prev: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });
    this.final = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform sampler2D bloomTex; uniform sampler2D haloTex; uniform sampler2D hudTex;
      uniform float exposure, bloom, halation, ca, grain, vignette, hud, fade, flash, time, zoom, invert;
      uniform bool transparent;
      uniform vec2 shake; uniform vec2 res;
      uniform float dof, focusDist, focalRange, dofRadius;
      uniform float volumetric, volumetricDecay;
      uniform vec2 volumetricLightPos;
      uniform int volSteps; uniform float rayStep, rayNorm, volJitter;
      uniform int grade;
      uniform vec3 colorTint;
      uniform vec3 gradeLift, gradeGain, gradeInvGamma, gradeTint; uniform float gradeSat;
      uniform int toneMap; uniform float toneMapHue;
      uniform float blackPoint, level;
      uniform sampler2D opticsTex; uniform vec3 opticsGain; uniform bool opticsOn;
      ${SHOULDER_GLSL}
      ${TONEMAP_GLSL}
      void main() {
        vec2 uv = (vUv - 0.5) / max(zoom, 1e-4) + 0.5 - shake / res;
        vec2 dc = uv - 0.5;
        float r2 = dot(dc * vec2(res.x / res.y, 1.0), dc * vec2(res.x / res.y, 1.0));
        vec2 off = dc * r2 * ca / res.x * 4.0;
        vec4 srcCol = texture(src, uv);
        float srcAlpha = srcCol.a;
        // Un-premultiply src color for tone-mapping and color grading if translucent
        vec3 straightCol = srcCol.rgb / max(srcAlpha, 1e-4);

        vec3 col;
        col.r = texture(src, uv + off).r / max(texture(src, uv + off).a, 1e-4);
        col.g = straightCol.g;
        col.b = texture(src, uv - off).b / max(texture(src, uv - off).a, 1e-4);
        vec3 bl = texture(bloomTex, uv).rgb;
        vec3 ha = texture(haloTex, uv).rgb;
        col += bl * bloom;
        col += vec3(1.0, 0.18, 0.04) * luma(ha) * halation;
        if (opticsOn) col += texture(opticsTex, uv).rgb * opticsGain;
        col *= exposure;

        // Optical Depth of Field (DoF Bokeh Disc)
        if (dof > 0.005) {
          float coc = clamp((abs(length(uv - vec2(0.5)) - focusDist) - focalRange) / max(focalRange, 0.01), 0.0, 1.0) * dofRadius * dof;
          if (coc > 0.15) {
            vec2 dofTexel = (1.0 / res) * coc;
            vec3 dofAccum = col * 0.28;
            vec4 t1 = texture(src, uv + dofTexel * vec2(0.0, 1.2));
            vec4 t2 = texture(src, uv - dofTexel * vec2(0.0, 1.2));
            vec4 t3 = texture(src, uv + dofTexel * vec2(1.2, 0.0));
            vec4 t4 = texture(src, uv - dofTexel * vec2(1.2, 0.0));
            dofAccum += (t1.rgb / max(t1.a, 1e-4)) * exposure * 0.18;
            dofAccum += (t2.rgb / max(t2.a, 1e-4)) * exposure * 0.18;
            dofAccum += (t3.rgb / max(t3.a, 1e-4)) * exposure * 0.18;
            dofAccum += (t4.rgb / max(t4.a, 1e-4)) * exposure * 0.18;
            col = mix(col, dofAccum, min(1.0, coc / 1.5));
          }
        }

        // Volumetric Light Scattering (Atmospheric God Rays)
        if (volumetric > 0.005) {
          // volSteps = 10 is the legacy march; other tiers keep the same ray length and brightness
          // (rayStep = 1/N, volumetricDecay already per-step, rayNorm = 10/N)
          vec2 deltaRay = (uv - volumetricLightPos) * rayStep * 0.5;
          // start jitter from pixel coords only (IGN), a fraction of one step either way
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          vec2 curRayUv = uv - deltaRay * ((ign - 0.5) * volJitter);
          float falloff = 1.0;
          vec3 scatter = vec3(0.0);
          for (int s = 0; s < 64; s++) {
            if (s >= volSteps) break;
            curRayUv -= deltaRay;
            vec3 sCol = texture(src, curRayUv).rgb;
            float sLum = sat(luma(sCol) - 0.7);
            scatter += sCol * sLum * falloff;
            falloff *= volumetricDecay;
          }
          col += scatter * (volumetric * 0.35 * rayNorm);
        }

        // Cinematic Color Grading & Tone Split
        if (grade == 1) { // industrial
          col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), 0.22);
          col = pow(max(vec3(0.0), col), vec3(1.12));
          col *= vec3(0.96, 0.98, 1.02);
        } else if (grade == 2) { // warm_editorial
          col += vec3(0.03, 0.02, 0.01) * sat(1.0 - luma(col));
          col *= vec3(1.05, 1.0, 0.93);
        } else if (grade == 3) { // monochrome_blueprint
          float lVal = sat(luma(col));
          col = mix(vec3(0.02, 0.04, 0.08), vec3(0.91, 0.93, 0.95), lVal);
        } else if (grade == 4) { // infrared
          float lVal = sat(luma(col));
          col = mix(vec3(0.0, 0.05, 0.2), vec3(1.0, 0.18, 0.1), lVal);
        } else if (grade == 5) { // per-frame lift / gamma / gain / saturation / tint (linear light)
          col = mix(vec3(luma(col)), col, gradeSat);
          col = col * gradeGain + gradeLift;
          col = pow(max(col, vec3(0.0)), gradeInvGamma) * gradeTint;
        }
        col *= colorTint;
        // HUD is composited in linear space before the shoulder so it gets grain & vignette too
        vec4 h = texture(hudTex, vUv);
        if (toneMap == 0) {
          col = mix(col, h.rgb / max(h.a, 1e-4), h.a * hud);
          col = shoulder(col);
        } else {
          // aces/agx are not identity below 1, so the HUD goes on after them (display-linear, unshifted)
          col = toneMapAlt(col, toneMap, toneMapHue);
          col = mix(col, h.rgb / max(h.a, 1e-4), h.a * hud);
        }
        col = mix(col, vec3(0.8515) - col * 0.84, invert); // ink<->bone in linear-ish space
        col += C_BONE * flash;
        // vignette (gated by alpha when transparent)
        float v = smoothstep(0.95, 0.25, length(dc * vec2(1.0, 0.8)));
        float vAmt = transparent ? (vignette * srcAlpha) : vignette;
        col *= mix(1.0, v, vAmt);
        col *= (1.0 - fade);
        // Compute composite alpha factoring HUD, bloom, volumetric luminosity
        float hudA = h.a * hud;
        float bloomA = clamp(luma(bl * bloom) * 0.5, 0.0, 1.0);
        float volA = (volumetric > 0.005) ? clamp(volumetric * 0.35, 0.0, 1.0) : 0.0;
        float finalAlpha = clamp(srcAlpha + hudA * (1.0 - srcAlpha) + bloomA * (1.0 - srcAlpha) + volA * (1.0 - srcAlpha), 0.0, 1.0);

        vec3 colLinear = sat(col);
        if (transparent) {
          colLinear *= finalAlpha;
        }
        vec3 s = toSRGB(colLinear);

        // film grain: two scales, stronger in mid-tones
${SCALE === 1 ? `        float g1 = hash12(gl_FragCoord.xy + fract(time * 13.37) * 1000.0) - 0.5;
        float g2 = hash12(floor(gl_FragCoord.xy / 2.0) + fract(time * 7.13) * 1000.0) - 0.5;` : `        // output scale > 1: the fine grain is per physical px with its amplitude raised by PX_SCALE so its
        // power per logical px (what survives a downscale) matches 1x; the coarse grain keeps 2x2-logical-px cells
        float g1 = (hash12(gl_FragCoord.xy + fract(time * 13.37) * 1000.0) - 0.5) * PX_SCALE;
        float g2 = hash12(floor(FRAG_PX / 2.0) + fract(time * 7.13) * 1000.0) - 0.5;`}
        float lm = luma(s);
        float amt = grain * (0.55 + 1.2 * lm * (1.0 - lm));
        // noise follows the output level so fade = 1 / level = 0 is exactly black (no grain or dither floor)
        float grainScale = (transparent ? finalAlpha : 1.0) * (1.0 - fade) * level;
        s += (g1 * 0.6 + g2 * 0.4) * amt * grainScale;
        s += ((hash12(gl_FragCoord.xy * 1.37 + time) - 0.5) / 255.0) * grainScale; // dither
        s = (s - blackPoint) / (1.0 - blackPoint);
        // fade already scaled linear light above (legacy look); the last multiply makes fade >= 1 and level = 0 exact zero
        s *= level;
        if (fade >= 1.0 || level <= 0.0) s = vec3(0.0); // also kills any NaN/Inf from upstream passes
        if (transparent) {
          fragColor = vec4(sat(s), finalAlpha);
        } else {
          fragColor = vec4(sat(s), 1.0);
        }
      }`, {
      src: { value: null }, bloomTex: { value: null }, haloTex: { value: null }, hudTex: { value: null },
      exposure: { value: 1 }, bloom: { value: 0.5 }, halation: { value: 0.2 }, ca: { value: 1 }, grain: { value: 0.05 },
      vignette: { value: 0.3 }, hud: { value: 1 }, fade: { value: 0 }, flash: { value: 0 }, time: { value: 0 },
      zoom: { value: 1 }, invert: { value: 0 }, transparent: { value: false }, shake: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2(W, H) },
      dof: { value: 0 }, focusDist: { value: 0.5 }, focalRange: { value: 0.15 }, dofRadius: { value: 4.0 },
      volumetric: { value: 0 }, volumetricDecay: { value: 0.94 }, volumetricLightPos: { value: new THREE.Vector2(0.5, 0.2) },
      grade: { value: 0 }, colorTint: { value: new THREE.Vector3(1, 1, 1) },
      volSteps: { value: 10 }, rayStep: { value: 0.1 }, rayNorm: { value: 1 }, volJitter: { value: 0 },
      gradeLift: { value: new THREE.Vector3() }, gradeGain: { value: new THREE.Vector3(1, 1, 1) }, gradeInvGamma: { value: new THREE.Vector3(1, 1, 1) },
      gradeTint: { value: new THREE.Vector3(1, 1, 1) }, gradeSat: { value: 1 },
      toneMap: { value: 0 }, toneMapHue: { value: 0 }, blackPoint: { value: 0 }, level: { value: 1 },
      opticsTex: { value: null }, opticsGain: { value: new THREE.Vector3() }, opticsOn: { value: false },
    });
  }

  /** Apply the chain: src (HDR linear) -> out (sRGB 8-bit target or screen). */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, hud: THREE.Texture, out: THREE.WebGLRenderTarget | null, p: PostParams, time: number, depthTex?: THREE.Texture | null) {
    let effectiveSrc = src;
    const hasDepthDof = Boolean(
      (p.depthDof && (p.depthDof.enabled ?? true) && (p.depthDof.aperture ?? 0) > 0.001) ||
      (p.depthAperture !== undefined && p.depthAperture > 0.001)
    );
    if (depthTex && hasDepthDof) {
      this.depthDofPass ??= new DepthDoFPass();
      const dp = this.scratchDofParams;
      dp.enabled = true;
      dp.focusDistance = p.depthFocusDist !== undefined ? p.depthFocusDist : p.depthDof?.focusDistance;
      dp.aperture = p.depthAperture !== undefined ? p.depthAperture : p.depthDof?.aperture;
      dp.maxRadius = p.depthDof?.maxRadius;
      dp.blades = p.depthDof?.blades;
      dp.anamorphicRatio = p.depthDof?.anamorphicRatio;
      dp.near = p.depthDof?.near;
      dp.far = p.depthDof?.far;
      dp.samples = p.depthDof?.samples;
      effectiveSrc = this.depthDofPass.render(renderer, src, depthTex, dp);
    }

    const bloomVal = p.bloomIntensity !== undefined ? p.bloomIntensity : p.bloom;
    const runBloom = bloomVal > 0.001 || p.halation > 0.001;

    if (runBloom) {
      // bloom pyramid
      this.prefilter.u.src!.value = effectiveSrc;
      (this.prefilter.u.texel!.value as THREE.Vector2).set(1 / W, 1 / H);
      this.prefilter.u.threshold!.value = p.bloomThreshold;
      this.prefilter.u.knee!.value = p.bloomKnee;
      this.prefilter.render(renderer, this.mips[0]!);
      for (let i = 1; i < MIPS; i++) {
        const s = this.mips[i - 1]!;
        this.down.u.src!.value = s.texture;
        (this.down.u.texel!.value as THREE.Vector2).set(1 / s.width, 1 / s.height);
        this.down.render(renderer, this.mips[i]!);
      }
      // upsample: ups[i] = mips[i] + up(ups[i+1])
      let prevTex = this.mips[MIPS - 1]!.texture;
      for (let i = MIPS - 2; i >= 0; i--) {
        const small = i === MIPS - 2 ? this.mips[MIPS - 1]! : this.ups[i + 1]!;
        this.up.u.src!.value = prevTex;
        this.up.u.prev!.value = this.mips[i]!.texture;
        (this.up.u.texel!.value as THREE.Vector2).set(1 / small.width, 1 / small.height);
        this.up.u.radius!.value = 0.5 + p.bloomRadius;
        this.up.render(renderer, this.ups[i]!);
        prevTex = this.ups[i]!.texture;
      }
    }
    const f = this.final.u;
    f.src!.value = effectiveSrc;
    f.bloomTex!.value = this.ups[0]!.texture;
    f.haloTex!.value = this.ups[3]!.texture;
    f.hudTex!.value = hud;
    f.exposure!.value = p.exposure;
    f.bloom!.value = runBloom ? (bloomVal / 3) : 0; // pyramid sums ~MIPS levels; normalize
    f.halation!.value = runBloom ? p.halation : 0;
    f.ca!.value = p.ca;
    const grainVal = p.filmGrain !== undefined ? p.filmGrain : p.grain;
    f.grain!.value = grainVal;
    f.vignette!.value = p.vignette;
    f.hud!.value = p.hud;
    f.fade!.value = p.fade;
    f.flash!.value = p.flash;
    f.time!.value = time;
    f.zoom!.value = p.zoom;
    f.invert!.value = p.invert;
    f.transparent!.value = Boolean(p.transparent);
    const sx = Array.isArray(p.shake) ? (p.shake[0] ?? 0) : (typeof p.shake === 'number' ? (p.shake as number) : 0);
    const sy = Array.isArray(p.shake) ? (p.shake[1] ?? 0) : 0;
    (f.shake!.value as THREE.Vector2).set(sx, sy);

    f.dof!.value = p.dof ?? 0;
    f.focusDist!.value = p.focusDist ?? 0.5;
    f.focalRange!.value = p.focalRange ?? 0.15;
    f.dofRadius!.value = p.dofRadius ?? 4.0;
    f.volumetric!.value = p.volumetric ?? 0;
    const vlx = p.volumetricLightPos ? p.volumetricLightPos[0] : 0.5;
    const vly = p.volumetricLightPos ? p.volumetricLightPos[1] : 0.2;
    (f.volumetricLightPos!.value as THREE.Vector2).set(vlx, vly);
    // N-step tiers keep the 10-step ray length, brightness and falloff; jitter hides the remaining step structure
    const vsteps = Math.max(1, Math.min(64, Math.round(p.volumetricSteps ?? 10)));
    f.volSteps!.value = vsteps;
    f.rayStep!.value = 1 / vsteps;
    f.rayNorm!.value = 10 / vsteps;
    f.volumetricDecay!.value = Math.pow(p.volumetricDecay ?? 0.94, 10 / vsteps);
    f.volJitter!.value = p.volumetricJitter ?? (vsteps > 10 ? 1 : 0);

    let gradeIdx = 0;
    if (p.grade === 'industrial') gradeIdx = 1;
    else if (p.grade === 'warm_editorial') gradeIdx = 2;
    else if (p.grade === 'monochrome_blueprint') gradeIdx = 3;
    else if (p.grade === 'infrared') gradeIdx = 4;
    const gp = typeof p.grade === 'function' ? p.grade(time) : typeof p.grade === 'object' && p.grade ? p.grade : null;
    if (gp) {
      gradeIdx = 5;
      unpackGradeV3(gp.lift, 0, f.gradeLift!.value as THREE.Vector3);
      unpackGradeV3(gp.gain, 1, f.gradeGain!.value as THREE.Vector3);
      unpackGradeV3(gp.tint, 1, f.gradeTint!.value as THREE.Vector3);
      const gGamma = f.gradeInvGamma!.value as THREE.Vector3;
      unpackGradeV3(gp.gamma, 1, gGamma);
      gGamma.set(1 / Math.max(gGamma.x, 1e-4), 1 / Math.max(gGamma.y, 1e-4), 1 / Math.max(gGamma.z, 1e-4));
      f.gradeSat!.value = gp.saturation ?? 1;
    }
    f.grade!.value = gradeIdx;
    f.toneMap!.value = p.toneMap === 'aces' ? 1 : p.toneMap === 'agx' ? 2 : 0;
    f.toneMapHue!.value = p.toneMapHue ?? 0;
    f.blackPoint!.value = Math.min(0.99, Math.max(0, p.blackPoint ?? 0));
    f.level!.value = Math.max(0, p.level ?? 1);

    const op = p.optics;
    if (op && (op.intensity ?? DEFAULT_OPTICS.intensity) > 0 && p.fade < 1) {
      Object.assign(this.scratchOpticsParams, DEFAULT_OPTICS, op);
      const o = this.scratchOpticsParams;
      this.optics ??= new OpticsPass();
      f.opticsTex!.value = this.optics.render(renderer, effectiveSrc, o);
      (f.opticsGain!.value as THREE.Vector3).set(o.tint[0] * o.intensity, o.tint[1] * o.intensity, o.tint[2] * o.intensity);
      f.opticsOn!.value = true;
    } else {
      f.opticsOn!.value = false;
    }

    if (p.colorTint) {
      (f.colorTint!.value as THREE.Vector3).set(p.colorTint[0], p.colorTint[1], p.colorTint[2]);
    } else {
      (f.colorTint!.value as THREE.Vector3).set(1, 1, 1);
    }

    this.final.render(renderer, out);
    renderer.resetState();
  }

  dispose() {
    for (const rt of this.mips) rt.dispose();
    for (const rt of this.ups) rt.dispose();
    this.prefilter.dispose();
    this.down.dispose();
    this.up.dispose();
    this.final.dispose();
    this.optics?.dispose();
    this.depthDofPass?.dispose();
  }
}

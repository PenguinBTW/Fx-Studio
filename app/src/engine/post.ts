// Global post-processing: bloom + halation, chromatic aberration, tone shoulder,
// film grain, vignette, fades/flash. Operates on the composited HDR (linear) frame.
import * as THREE from 'three';
import { FSPass, makeRT, W, H, SCALE } from './gl';

/** The tone shoulder (linear HDR -> 0..1 linear), shared with the engine's sampling error estimate. */
export const SHOULDER_GLSL = /* glsl */ `
vec3 shoulder(vec3 x) {
  // identity below k, smooth exponential shoulder above; very bright values desaturate toward white
  const float k = 0.72;
  vec3 y = mix(x, k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k))), step(k, x));
  float over = max(max(x.r, x.g), x.b);
  return mix(y, vec3(1.0), smoothstep(2.0, 12.0, over) * 0.85);
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
  fade: number; // fade to black 0..1
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

  // Optical Depth of Field & Bokeh
  dof?: number; // 0 = off, 1 = full
  focusDist?: number; // Distance of sharp focal plane [0..1]
  focalRange?: number; // Depth of in-focus window [0..1] (default 0.15)
  dofRadius?: number; // Blur radius in px (default 4.0)

  // Volumetric Atmospheric Light Scatter / God Rays
  volumetric?: number; // 0 = off, 1 = maximum atmospheric haze
  volumetricLightPos?: [number, number]; // Normalized screen pos [x, y], default [0.5, 0.2]
  volumetricDecay?: number; // Falloff per step, default 0.94

  // Cinematic Color Grading
  grade?: 'none' | 'industrial' | 'warm_editorial' | 'monochrome_blueprint' | 'infrared';
  colorTint?: [number, number, number]; // [r, g, b] global color bias
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
  volumetric: 0,
  volumetricLightPos: [0.5, 0.2],
  volumetricDecay: 0.94,
  grade: 'none',
  colorTint: [1, 1, 1],
};

const MIPS = 7;

export class Post {
  private prefilter: FSPass;
  private down: FSPass;
  private up: FSPass;
  private final: FSPass;
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
      uniform int grade;
      uniform vec3 colorTint;
      ${SHOULDER_GLSL}
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
          vec2 deltaRay = (uv - volumetricLightPos) * (1.0 / 10.0) * 0.5;
          vec2 curRayUv = uv;
          float falloff = 1.0;
          vec3 scatter = vec3(0.0);
          for (int s = 0; s < 10; s++) {
            curRayUv -= deltaRay;
            vec3 sCol = texture(src, curRayUv).rgb;
            float sLum = sat(luma(sCol) - 0.7);
            scatter += sCol * sLum * falloff;
            falloff *= volumetricDecay;
          }
          col += scatter * (volumetric * 0.35);
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
        }
        col *= colorTint;
        // HUD is composited in linear space before the shoulder so it gets grain & vignette too
        vec4 h = texture(hudTex, vUv);
        col = mix(col, h.rgb / max(h.a, 1e-4), h.a * hud);
        col = shoulder(col);
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
        float grainScale = transparent ? finalAlpha : 1.0;
        s += (g1 * 0.6 + g2 * 0.4) * amt * grainScale;
        s += ((hash12(gl_FragCoord.xy * 1.37 + time) - 0.5) / 255.0) * grainScale; // dither
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
    });
  }

  /** Apply the chain: src (HDR linear) -> out (sRGB 8-bit target or screen). */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, hud: THREE.Texture, out: THREE.WebGLRenderTarget | null, p: PostParams, time: number) {
    const bloomVal = p.bloomIntensity !== undefined ? p.bloomIntensity : p.bloom;
    const runBloom = bloomVal > 0.001 || p.halation > 0.001;

    if (runBloom) {
      // bloom pyramid
      this.prefilter.u.src!.value = src;
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
    f.src!.value = src;
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
    f.volumetricDecay!.value = p.volumetricDecay ?? 0.94;

    let gradeIdx = 0;
    if (p.grade === 'industrial') gradeIdx = 1;
    else if (p.grade === 'warm_editorial') gradeIdx = 2;
    else if (p.grade === 'monochrome_blueprint') gradeIdx = 3;
    else if (p.grade === 'infrared') gradeIdx = 4;
    f.grade!.value = gradeIdx;

    const ct = p.colorTint ?? [1, 1, 1];
    (f.colorTint!.value as THREE.Vector3).set(ct[0], ct[1], ct[2]);

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
  }
}

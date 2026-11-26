// Shared shader compositor for THRESHOLD engine transitions.
// Each transition gets a distinct fragment body but the same strict full-frame contract.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export type ThresholdTransitionMode = 'blackout' | 'exposure' | 'tunnel' | 'ink' | 'pageSlam' | 'staticFelt' | 'doorPush' | 'lightFall';

const BODY: Record<ThresholdTransitionMode, string> = {
  blackout: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float cut = 1.0 - smoothstep(0.02, 0.24, u);
    vec3 darkA = ca * cut;
    float ignite = smoothstep(0.46, 0.57, u);
    float lumB = dot(cb, vec3(0.2126, 0.7152, 0.0722));
    float tubeLead = smoothstep(0.025, 0.24, lumB);
    float broad = smoothstep(0.60, 0.94, u);
    float starter = 0.68 + 0.32 * smoothstep(0.47, 0.60, u) + 0.10 * sin(u * 91.0) * (1.0 - broad);
    float spatialReveal = clamp(tubeLead * 1.18 + broad, 0.0, 1.0);
    vec3 incoming = cb * (0.10 + 0.90 * broad) * spatialReveal * ignite * starter;
    vec3 c = u < 0.46 ? darkA : incoming;
    fragColor = vec4(c, 1.0);`,
  exposure: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float blast = smoothstep(0.0, 0.22, u) * (1.0 - smoothstep(0.68, 0.98, u));
    vec2 q = (vUv - vec2(0.5, 0.47)) * vec2(1.7778, 1.0);
    float width = mix(0.035, 0.92, smoothstep(0.10, 0.88, u));
    float height = mix(0.24, 0.86, smoothstep(0.08, 0.92, u));
    float rect = max(abs(q.x) / width, abs(q.y) / height);
    float doorway = 1.0 - smoothstep(0.88, 1.04, rect);
    float edge = (1.0 - smoothstep(0.0, 0.09, abs(rect - 1.0))) * (1.0 - smoothstep(0.78, 1.0, u));
    float eyeAdapt = smoothstep(0.30, 0.88, u);
    float centerLead = doorway * smoothstep(0.28, 0.64, u);
    float revealB = clamp(eyeAdapt * (0.52 + 0.48 * doorway) + centerLead * 0.48, 0.0, 1.0);
    revealB = max(revealB, smoothstep(0.78, 0.94, u));
    vec3 daylight = vec3(5.8, 5.45, 4.8) * (0.32 + 0.68 * blast);
    vec3 c = mix(daylight, cb, revealB);
    float crack = (1.0 - smoothstep(0.018, 0.048, abs(q.x))) * (1.0 - smoothstep(0.55, 0.86, abs(q.y)));
    float doorStile = (1.0 - smoothstep(0.012, 0.04, abs(abs(q.x) - width * 0.72))) * (1.0 - smoothstep(0.46, 0.82, abs(q.y)));
    float darkEdge = clamp(crack + doorStile * 0.45, 0.0, 1.0) * (1.0 - eyeAdapt) * smoothstep(0.04, 0.18, u) * (1.0 - smoothstep(0.30, 0.46, u));
    c = mix(c, vec3(0.006, 0.004, 0.003), darkEdge * 0.92);
    c += vec3(1.0, 0.78, 0.42) * edge * 0.18;
    c = mix(ca, c, smoothstep(0.0, 0.10, u));
    fragColor = vec4(c, 1.0);`,
  tunnel: `
    vec2 q = (vUv - 0.5) * vec2(1.7778, 1.0);
    float r = length(q);
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // Material morph rather than a ghosted dissolve: the outgoing playroom surface
    // ceramicizes into pool tile in a ragged expanding shell, then the incoming pool
    // is revealed behind the shell's hard leading edge.
    float openRadius = mix(-0.18, 1.28, smoothstep(0.02, 0.98, u));
    float rag = (fbm(vUv * vec2(7.0, 5.0) + vec2(u * 0.27, -u * 0.18), 4) - 0.5) * 0.115;
    float rn = r + rag;
    float inside = 1.0 - smoothstep(openRadius, openRadius + 0.014, rn);
    float morphK = mix(1.0, smoothstep(openRadius, openRadius + 0.26, rn), smoothstep(0.02, 0.12, u));
    vec2 tileUv = q * vec2(8.0, 10.0) + vec2(0.0, u * 0.32);
    vec2 cell = floor(tileUv);
    vec2 cellUv = fract(tileUv);
    float edgeDist = min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y));
    float groutLine = 1.0 - smoothstep(0.026, 0.055, edgeDist);
    float lum = dot(ca, vec3(0.2126, 0.7152, 0.0722));
    float shade = hash12(cell) * 0.24 + lum * 0.58;
    vec3 tileCol = mix(vec3(0.010, 0.040, 0.052), vec3(0.032, 0.205, 0.245), shade);
    vec3 groutCol = vec3(0.006, 0.015, 0.018);
    vec3 tile = mix(tileCol, groutCol, groutLine);
    float caustic = pow(0.5 + 0.5 * sin((q.x * 5.2 + q.y * 8.4 + u * 2.8) * TAU), 3.0) * 0.11;
    tile += vec3(0.015, 0.11, 0.13) * caustic;
    vec3 morphedA = mix(tile, ca, morphK);
    vec3 c = mix(morphedA, cb, inside);
    float lip = (1.0 - smoothstep(0.0, 0.026, abs(rn - openRadius))) * smoothstep(0.02, 0.12, u) * (1.0 - smoothstep(0.88, 1.0, u));
    c = mix(c, groutCol * 1.8, lip * 0.62);
    fragColor = vec4(c, 1.0);`,
  ink: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    vec2 q = vUv - 0.5;
    float n = fbm(vUv * 5.0 + vec2(u * 1.7, -u * 0.8), 5) * 0.5 + 0.5;
    float spread = smoothstep(1.0 - u * 1.25, 1.0 - u * 1.25 + 0.25, n + length(q) * 0.42);
    vec3 ink = vec3(0.002, 0.004, 0.006);
    vec3 a = mix(ca, ink, spread);
    float paperLines = smoothstep(0.46, 0.5, fract((vUv.y + n * 0.04) * 42.0)) * 0.08;
    vec3 b = mix(ink, cb + vec3(paperLines), smoothstep(0.52, 0.95, u));
    vec3 c = u < 0.5 ? a : b;
    fragColor = vec4(c, 1.0);`,
  pageSlam: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // Real-page timing compressed into the 0.6 s seam: slam in 0.12 s,
    // hold true black for 0.08 s, then three neon ignition flickers over 0.4 s.
    float close = smoothstep(0.0, 0.20, u);
    float bow = (vUv.y - 0.5) * (vUv.y - 0.5) * 0.11;
    float edgeL = mix(-0.16, 0.505, close) + bow;
    float edgeR = mix(1.16, 0.495, close) - bow;
    float pageL = 1.0 - smoothstep(edgeL - 0.006, edgeL + 0.006, vUv.x);
    float pageR = smoothstep(edgeR - 0.006, edgeR + 0.006, vUv.x);
    float page = sat(pageL + pageR);
    float grain = hash12(floor(vUv * vec2(240.0, 180.0)));
    float fibre = fbm(vUv * vec2(95.0, 18.0), 4) * 0.5 + 0.5;
    vec3 paper = vec3(0.31, 0.255, 0.175) * (0.68 + grain * 0.16 + fibre * 0.18);
    float deckle = max(
      1.0 - smoothstep(0.0, 0.028, abs(vUv.x - edgeL)),
      1.0 - smoothstep(0.0, 0.028, abs(vUv.x - edgeR))
    ) * (1.0 - close * 0.35);
    paper = mix(paper, vec3(0.10, 0.065, 0.035), deckle * 0.62);
    float pageShade = max(
      smoothstep(edgeL - 0.11, edgeL, vUv.x) * pageL,
      (1.0 - smoothstep(edgeR, edgeR + 0.11, vUv.x)) * pageR
    );
    paper *= 1.0 - pageShade * 0.42;
    vec3 slammed = mix(ca, paper, page);
    float neonU = clamp((u - 0.333) / 0.667, 0.0, 1.0);
    float pulse = pow(abs(sin(neonU * 3.0 * 3.14159)), 2.0);
    float starter = neonU <= 0.0 ? 0.0 : mix(0.22, 1.0, pulse) * smoothstep(0.0, 0.08, neonU);
    starter = max(starter, smoothstep(0.88, 1.0, neonU));
    vec3 neonScene = cb * (0.72 + 0.58 * starter) + vec3(0.55, 0.06, 0.025) * starter * 0.10;
    vec3 c = mix(slammed, vec3(0.0), smoothstep(0.18, 0.20, u));
    c = mix(c, neonScene, smoothstep(0.333, 0.39, u) * starter);
    fragColor = vec4(c, 1.0);`,
  staticFelt: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // CRT grain first enlarges into directional felt fibres; scanline/curvature
    // structure dies away rather than surviving as a screen overlay.
    float grainCell = mix(300.0, 34.0, smoothstep(0.0, 0.42, u));
    vec2 id = floor(vUv * grainCell);
    float n = hash12(id + floor(u * 18.0));
    float scan = (0.5 + 0.5 * sin(vUv.y * 900.0)) * (1.0 - smoothstep(0.12, 0.48, u));
    vec3 stat = vec3(n) * (0.13 + 0.24 * scan + 0.08 * (1.0 - scan));
    vec3 a = mix(ca, stat, smoothstep(0.0, 0.36, u));
    float fibreLong = fbm(vec2(vUv.x * 34.0, vUv.y * 7.0), 5) * 0.5 + 0.5;
    float fibreFine = fbm(vec2(vUv.x * 190.0, vUv.y * 20.0), 3) * 0.5 + 0.5;
    float strand = 0.5 + 0.5 * sin(vUv.x * 620.0 + fibreLong * 8.0);
    vec3 felt = vec3(0.105, 0.027, 0.020) * (0.48 + fibreLong * 0.34 + fibreFine * 0.18 + strand * 0.11);
    vec3 m = mix(a, felt, smoothstep(0.22, 0.52, u));
    // The curtain parts from the center outward, with an irregular fibrous leading edge.
    float open = smoothstep(0.56, 0.98, u);
    float ragged = (fbm(vUv * vec2(18.0, 5.0), 4) - 0.5) * 0.075;
    float centerDist = abs(vUv.x - 0.5);
    float part = 1.0 - smoothstep(open * 0.54 + ragged - 0.025, open * 0.54 + ragged + 0.025, centerDist);
    part *= smoothstep(0.54, 0.62, u);
    float edgeGlow = (1.0 - smoothstep(0.0, 0.045, abs(centerDist - open * 0.54))) * smoothstep(0.54, 0.68, u) * (1.0 - open);
    vec3 c = mix(m, cb, part);
    // Loose fibres overlap both sides of the parting line so the reveal keeps a physical
    // textile fringe instead of cutting directly into the theatre's geometric seat grid.
    float fringeBand = 1.0 - smoothstep(0.0, 0.085, abs(centerDist - open * 0.54 + ragged * 0.55));
    float strandLines = 0.5 + 0.5 * sin(vUv.x * 430.0 + fibreLong * 24.0 + vUv.y * 18.0);
    float fringe = fringeBand * smoothstep(0.56, 0.72, u) * (1.0 - smoothstep(0.91, 1.0, u)) * (0.35 + strandLines * 0.65);
    c = mix(c, felt * 1.35 + vec3(0.055, 0.008, 0.004), fringe * 0.48);
    c += vec3(0.24, 0.055, 0.025) * edgeGlow;
    fragColor = vec4(c, 1.0);`,
  doorPush: `
    vec3 ca = texture(texA, vUv).rgb;
    // Incoming cathedral is slightly magnified and lowered at first, then settles:
    // a small scale/eye-height jump rather than a flat lateral wipe.
    float settle = smoothstep(0.30, 0.92, u);
    float zoom = mix(1.075, 1.0, settle);
    vec2 buv = (vUv - vec2(0.5, 0.5)) / zoom + vec2(0.5, mix(0.535, 0.5, settle));
    vec3 cb = texture(texB, clamp(buv, 0.0, 1.0)).rgb;
    float whip = smoothstep(0.0, 0.30, u);
    float edgePos = mix(1.18, -0.16, whip);
    float open = 1.0 - smoothstep(edgePos - 0.018, edgePos + 0.018, vUv.x);
    float blur = 0.018 * (1.0 - whip);
    vec3 aa = texture(texA, vUv + vec2(blur, 0.0)).rgb * 0.5 + texture(texA, vUv - vec2(blur, 0.0)).rgb * 0.5;
    float fibre = fbm(vUv * vec2(150.0, 26.0), 4) * 0.5 + 0.5;
    aa *= 0.74 + fibre * 0.18;
    float edgeBand = (1.0 - smoothstep(0.0, 0.055, abs(vUv.x - edgePos))) * (1.0 - smoothstep(0.28, 0.38, u));
    float shadow = smoothstep(edgePos, edgePos + 0.24, vUv.x) * (1.0 - smoothstep(0.2, 0.42, u));
    vec3 edgeCol = vec3(0.09, 0.018, 0.012) * (0.65 + fibre * 0.5);
    vec3 c = mix(cb, aa, open);
    c = mix(c, edgeCol, edgeBand * 0.92);
    c *= 1.0 - shadow * 0.38;
    fragColor = vec4(c, 1.0);`,
  lightFall: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // Several machine-light streaks decelerate, lengthen, and warm into hallway god-rays.
    float warm = smoothstep(0.12, 0.88, u);
    float lenBoost = mix(0.45, 1.45, smoothstep(0.18, 0.9, u));
    vec3 streakCol = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float lane = -0.34 + fi * 0.23 + (hash12(vec2(fi, 3.7)) - 0.5) * 0.08;
      float travel = fract(vUv.y * 0.32 + u * (1.0 - 0.32 * u) * 0.42 + fi * 0.29);
      float x = vUv.x - 0.5 - lane - (vUv.y - 0.5) * mix(0.11, 0.28, warm);
      float core = pow(max(0.0, 1.0 - abs(x) * mix(18.0, 8.0, warm)), 5.0);
      float lengthMask = smoothstep(0.0, 0.12 * lenBoost, travel) * (1.0 - smoothstep(0.52 * lenBoost, 0.92 * lenBoost, travel));
      lengthMask *= smoothstep(0.0, 0.035, travel) * (1.0 - smoothstep(0.965, 1.0, travel));
      streakCol += mix(vec3(0.28, 0.56, 1.25), vec3(1.35, 0.73, 0.31), warm) * core * lengthMask;
    }
    float sustain = smoothstep(0.02, 0.18, u) * (1.0 - smoothstep(0.58, 0.88, u));
    vec3 c = mix(ca, cb, smoothstep(0.22, 0.90, u));
    c += streakCol * max(0.0, sustain) * 0.72;
    fragColor = vec4(c, 1.0);`,
};

export class ThresholdShaderTransition implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx, mode: ThresholdTransitionMode) {
    this.pass = new FSPass(`
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float u;
      void main() {
        ${BODY[mode]}
        vec3 endB = texture(texB, vUv).rgb;
        fragColor = vec4(mix(fragColor.rgb, endB, smoothstep(0.965, 1.0, u)), 1.0);
      }
    `, {
      texA: { value: null },
      texB: { value: null },
      u: { value: 0 },
    });
  }

  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.u!.value = Math.min(1, Math.max(0, api.u));
    this.pass.render(this.ctx.renderer, out, true);
    this.ctx.renderer.resetState();
    // Scene post fades/flashes are global post parameters, not per-texture effects. Suppress them
    // inside the seam; each THRESHOLD transition owns its black/white/fibre treatment here.
    return { flash: 0, fade: 0 };
  }
}

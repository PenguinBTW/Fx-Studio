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
    vec3 c = u < 0.22 ? ca * (1.0 - smoothstep(0.0, 0.22, u)) : u < 0.48 ? vec3(0.0) : cb * smoothstep(0.48, 0.62, u);
    fragColor = vec4(c, 1.0);`,
  exposure: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float blow = smoothstep(0.0, 0.32, u);
    float adapt = smoothstep(0.28, 1.0, u);
    vec3 aw = mix(ca * (1.0 + 15.0 * blow), vec3(6.0), blow);
    vec3 bw = mix(vec3(6.0), cb, adapt);
    vec3 c = u < 0.42 ? aw : bw;
    fragColor = vec4(c, 1.0);`,
  tunnel: `
    vec2 q = (vUv - 0.5) * vec2(1.7778, 1.0);
    float r = length(q);
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float ribs = 0.5 + 0.5 * sin((r * 34.0 - u * 18.0) * TAU);
    float portal = smoothstep(u * 0.72 - 0.08, u * 0.72 + 0.08, r);
    vec3 grout = vec3(0.04, 0.16, 0.20) * (0.45 + 0.55 * ribs);
    vec3 c = mix(cb, ca, portal);
    c = mix(c, grout, (1.0 - smoothstep(0.0, 1.0, abs(u - 0.5) * 2.0)) * 0.35);
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
    float close = smoothstep(0.0, 0.48, u);
    float edgeL = mix(-0.08, 0.52, close);
    float edgeR = mix(1.08, 0.48, close);
    float page = step(vUv.x, edgeL) + step(edgeR, vUv.x);
    vec3 paper = vec3(0.28, 0.23, 0.16) * (0.75 + 0.25 * hash12(floor(vUv * 180.0)));
    vec3 a = mix(ca, paper, sat(page));
    float black = smoothstep(0.44, 0.5, u) * (1.0 - smoothstep(0.57, 0.64, u));
    float flick = floor((u - 0.64) / 0.08);
    float neonOn = u < 0.64 ? 0.0 : mod(max(flick, 0.0), 2.0) < 1.0 ? smoothstep(0.64, 0.74, u) : 0.18;
    vec3 c = mix(a, cb, neonOn);
    c *= 1.0 - black;
    fragColor = vec4(c, 1.0);`,
  staticFelt: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float cell = mix(260.0, 18.0, u);
    vec2 id = floor(vUv * cell);
    float n = hash12(id + floor(u * 24.0));
    float scan = 0.5 + 0.5 * sin(vUv.y * 900.0);
    vec3 stat = vec3(n) * (0.18 + 0.25 * scan);
    vec3 a = mix(ca, stat, smoothstep(0.0, 0.42, u));
    float fibre = fbm(vUv * vec2(110.0, 22.0), 4) * 0.5 + 0.5;
    vec3 felt = vec3(0.12, 0.035, 0.025) * (0.6 + fibre);
    vec3 m = mix(a, felt, smoothstep(0.28, 0.68, u));
    float part = smoothstep(0.62, 1.0, u) * smoothstep(0.32, 0.5, abs(vUv.x - 0.5) + (fbm(vUv * 8.0, 3) * 0.06));
    vec3 c = mix(m, cb, part);
    fragColor = vec4(c, 1.0);`,
  doorPush: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float whip = smoothstep(0.0, 0.3, u);
    float x = vUv.x + (1.0 - whip) * 0.8;
    float edge = smoothstep(0.0, 0.035, x - u * 1.05);
    float blur = 0.018 * (1.0 - u);
    vec3 aa = texture(texA, vUv + vec2(blur, 0.0)).rgb * 0.5 + texture(texA, vUv - vec2(blur, 0.0)).rgb * 0.5;
    vec3 c = mix(cb, aa, edge);
    c *= 0.82 + 0.18 * smoothstep(0.25, 1.0, u);
    fragColor = vec4(c, 1.0);`,
  lightFall: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    vec2 q = vUv - vec2(0.5, 0.15);
    float streak = pow(max(0.0, 1.0 - abs(q.x * 8.0 + q.y * 1.5)), 5.0);
    float warm = smoothstep(0.15, 0.9, u);
    vec3 streakCol = mix(vec3(0.35, 0.65, 1.3), vec3(1.3, 0.72, 0.32), warm) * streak * (1.0 - abs(u - 0.5));
    vec3 c = mix(ca, cb, smoothstep(0.18, 0.92, u)) + streakCol;
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

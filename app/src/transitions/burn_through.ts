// Burn-through: film-style exposure transition. The outgoing scene overexposes
// exponentially into white (film bleach-bypass burn), the brightest areas burning
// first — and the incoming scene emerges FROM the white in the same luminance order,
// so the burn front is continuous across the handoff. Physically motivated by film
// gate overexposure: no wipes, no geometric masks — light itself carries the seam.
//
// Seam conventions honored:
// - coverage completes by u = 0.85 (end-exclusive windows never sample u = 1)
// - post-effect envelope peaks at seam centre and dies with the burn
// - resolution/aspect independent (no hardcoded frame constants)
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class BurnThrough implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      float luma709(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

      void main() {
        vec4 a = texture(texA, vUv);
        vec4 b = texture(texB, vUv);
        float u = clamp(progress, 0.0, 1.0);

        // coverage: end-exclusive windows never sample u=1, so the burn must
        // complete by 0.85 — the tail of the window is already pure B
        float coverU = min(1.0, u / 0.85);
        float cover = coverU * coverU * (3.0 - 2.0 * coverU);

        // exponential overexposure of A: film gate style, 2^(6·u) — at u=0 exactly 1
        // (pure A untouched), blowing out toward white through the seam
        float exposure = exp2(6.0 * coverU);
        vec3 burnedA = a.rgb * exposure;

        // luminance-ordered burn: bright areas bleach first, so the burn FRONT is
        // the iso-luminance contour of A — physically how silver-halide bleaches.
        // burn amount per pixel: coverage minus the pixel's resistance (its inverse
        // luminance, headroom-scaled)
        float lumA = luma709(a.rgb);
        float order = clamp(lumA, 0.0, 1.0);       // bright = burns early
        float burn = clamp(cover * 1.6 - (1.0 - order) * 0.6, 0.0, 1.0);

        // whiten toward full bleach as burn progresses
        vec3 bleach = mix(burnedA, vec3(1.0), smoothstep(0.3, 0.9, burn));

        // heat rim at the burn front: signal-orange photochemical edge where the
        // bleach is actively advancing (burn strictly between floor and ceiling)
        float front = smoothstep(0.02, 0.15, burn) * (1.0 - smoothstep(0.55, 0.9, burn));
        bleach += vec3(1.0, 0.42, 0.1) * front * 1.4;

        // B emerges FROM the white in the same luminance order — the burn front is
        // continuous: where A finished bleaching first, B appears first
        float emerge = clamp(cover * 1.6 - (1.0 - order) * 0.6 - 0.45, 0.0, 1.0);
        float maskB = smoothstep(0.0, 0.5, emerge);

        vec3 col = mix(bleach, b.rgb, maskB);
        // hard coverage guarantee: past completion the frame is exactly B
        col = mix(col, b.rgb, step(0.995, cover));

        fragColor = vec4(col, 1.0);
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
    });
  }

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    const { renderer } = this.ctx;

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.progress!.value = u;
    this.pass.render(renderer, out);
    renderer.resetState();

    // bloom rides the burn: peaks at seam centre (the white bleach maximum) and
    // dies with coverage completion — no snap-off at the seam end
    const x = Math.min(1, Math.max(0, (u - 0.7) / 0.15));
    const tail = x * x * (3 - 2 * x);
    const peak = Math.sin(u * Math.PI) * (1 - tail);
    return {
      bloom: 0.55 + peak * 0.85,
      exposure: 1.0 + peak * 0.1,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}

// lens_settle: Beat 1 -> 2 handoff. Both scenes render the same mechanism world, so this is a near-identity crossfade whose only job is to bring the DoF off smoothly as the dissolve front starts; luma-preserving so no dip occurs.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class LensSettle implements Transition {
  private pass: FSPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new FSPass(`uniform sampler2D texA; uniform sampler2D texB; uniform float progress; uniform vec2 aspect;
void main() {
  float e = smoothstep(0.0, 1.0, progress);
  vec3 A = texture(texA, vUv).rgb, B = texture(texB, vUv).rgb;
  fragColor = vec4(mix(A, B, e), 1.0);
}`, {
      texA: { value: null }, texB: { value: null }, progress: { value: 0 }, aspect: { value: new THREE.Vector2(16 / 9, 1) },
    });
  }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    this.pass.u.texA!.value = a; this.pass.u.texB!.value = b; this.pass.u.progress!.value = u;
    this.pass.render(this.ctx.renderer, out, true);
    this.ctx.renderer.resetState();
    return;
  }
  dispose(): void { this.pass.dispose(); }
}

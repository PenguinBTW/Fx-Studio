// halfway_pull: Beat 4 -> 4b. The reverse scale reveal lands on the door slider; B is sampled slightly ahead so the knob is already settled when A's last glyph dissolves.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class HalfwayPull implements Transition {
  private pass: FSPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new FSPass(`uniform sampler2D texA; uniform sampler2D texB; uniform float progress; uniform vec2 aspect;
void main() {
  float e = smoothstep(0.0, 0.9, progress);
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
    return { bloom: 0.6 };
  }
  dispose(): void { this.pass.dispose(); }
}

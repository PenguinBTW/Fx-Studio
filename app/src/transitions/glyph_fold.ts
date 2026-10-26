// glyph_fold: Beat 2 -> 3. The flat glyph is folded into the self-similar field: scene B is sampled slightly zoomed-in and the cells cross-fade from the centre outward, so the glyph seems to inhale the lattice.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class GlyphFold implements Transition {
  private pass: FSPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new FSPass(`uniform sampler2D texA; uniform sampler2D texB; uniform float progress; uniform vec2 aspect;
void main() {
  float e = progress * progress * (3.0 - 2.0 * progress);
  vec2 p = (vUv - 0.5) * aspect;
  float r = length(p);
  vec2 uvB = (vUv - 0.5) * mix(0.92, 1.0, e) + 0.5;
  vec3 A = texture(texA, vUv).rgb, B = texture(texB, uvB).rgb;
  float k = smoothstep(r * 0.9 - 0.12, r * 0.9 + 0.12, e * 1.3);
  fragColor = vec4(mix(A, B, k), 1.0);
}`, {
      texA: { value: null }, texB: { value: null }, progress: { value: 0 }, aspect: { value: new THREE.Vector2(16 / 9, 1) },
    });
  }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    this.pass.u.texA!.value = a; this.pass.u.texB!.value = b; this.pass.u.progress!.value = u;
    this.pass.render(this.ctx.renderer, out, true);
    this.ctx.renderer.resetState();
    return { bloom: 0.6 + Math.sin(u * Math.PI) * 0.1 };
  }
  dispose(): void { this.pass.dispose(); }
}

// slot_breach: the camera pushes into the child-lock slot (Beat 0 -> 1). The slot's dark mouth irises open as a stadium-shaped portal onto the x-ray interior; outside the portal, the door edge keeps pushing in and falls to black.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class SlotBreach implements Transition {
  private pass: FSPass;
  constructor(private ctx: TransitionCtx) {
    this.pass = new FSPass(`uniform sampler2D texA; uniform sampler2D texB; uniform float progress; uniform vec2 aspect;
float sdStadium(vec2 p, float hl, float r) { p = abs(p); p.x = max(p.x - hl, 0.0); return length(p) - r; }
void main() {
  float e = progress * progress * (3.0 - 2.0 * progress);
  vec2 p = (vUv - 0.5) * aspect;
  // A: continue the push-in toward the slot centre (scale up), darkening toward the cut
  vec2 uvA = (vUv - 0.5) / (1.0 + 2.4 * e) + 0.5;
  vec3 A = texture(texA, uvA).rgb * (1.0 - 0.8 * smoothstep(0.2, 1.0, e));
  // B: settles from slightly enlarged
  vec2 uvB = (vUv - 0.5) / (1.0 + 0.35 * (1.0 - e)) + 0.5;
  vec3 B = texture(texB, uvB).rgb;
  // stadium portal (the slot) grows from its own size to cover the frame
  float r = mix(0.05, 1.3, e * e);
  float d = sdStadium(p, mix(0.19, 1.6, e), r);
  float aa = fwidth(d) * 1.5;
  float m = 1.0 - smoothstep(-aa, aa, d);
  fragColor = vec4(mix(A, B, m), 1.0);
}`, {
      texA: { value: null }, texB: { value: null }, progress: { value: 0 }, aspect: { value: new THREE.Vector2(16 / 9, 1) },
    });
  }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    this.pass.u.texA!.value = a; this.pass.u.texB!.value = b; this.pass.u.progress!.value = u;
    this.pass.render(this.ctx.renderer, out, true);
    this.ctx.renderer.resetState();
    return { bloom: 0.6, ca: 0.6 + Math.sin(u * Math.PI) * 0.6 };
  }
  dispose(): void { this.pass.dispose(); }
}

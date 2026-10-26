// P7 demo: a violet-white HDR point (photon optics, 6 spikes) over a neutral ramp, a lift/gamma/gain grade sweep over
// t = 0..4 (gradeMix), and a fade to exact black at t = 5..5.5. Pure function of t.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../../engine/scene';
import { FSPass, clearRT } from '../../../engine/gl';
import { gradeMix, type GradeParams } from '../../../engine/post';

const WARM: GradeParams = { gain: [1.15, 1.0, 0.8], lift: 0.01, saturation: 1.1 };
const COOL: GradeParams = { gain: [0.8, 0.95, 1.2], gamma: 1.15, saturation: 0.7, tint: [0.9, 1, 1.1] };
const sm = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };

export default class PostFxDemo extends Scene {
  private pass: FSPass;
  constructor(ctx: SceneCtx) {
    super(ctx);
    this.pass = new FSPass(/* glsl */ `
      uniform vec2 res; uniform vec3 hot;
      void main() {
        vec2 px = vUv * res;
        vec3 c = vec3(0.012, 0.012, 0.02) * (0.6 + 0.4 * vUv.y);
        // neutral ramp (bottom strip, linear 0..1) and tint-probe patches
        if (vUv.y < 0.1) c = vec3(vUv.x);
        else if (vUv.y < 0.16) c = vec3(0.18);
        float d = length(px - res * vec2(0.5, 0.56));
        c += hot * (exp(-d * d / 6.0) * 1.0 + 0.0);
        fragColor = vec4(c, 1.0);
      }`, { res: { value: new THREE.Vector2(1920, 1080) }, hot: { value: new THREE.Vector3(30 * 0.72, 30 * 0.5, 30) } });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    clearRT(this.ctx.renderer, out);
    this.pass.render(this.ctx.renderer, out);
    const t = f.t;
    const k = sm(t / 4);
    return {
      grade: gradeMix(WARM, COOL, k) as any,
      bloom: 0.5, vignette: 0.2, grain: 0.04, ca: 0,
      toneMap: 'legacy',
      optics: { threshold: 2, spikes: 6, spikeLength: 200, airyRadius: 5, intensity: 0.8 },
      fade: sm((t - 5) / 0.5),
    };
  }
}

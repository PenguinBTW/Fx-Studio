// Shared full-screen shader pass for the agent_promo custom transitions (agp_*). Every pass clears and fully
// overwrites `out`, then restores renderer state.
import * as THREE from 'three';
import type { TransitionCtx } from '../../engine/transition';

export const TGLSL = `
float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(th(i), th(i + vec2(1.0, 0.0)), f.x), mix(th(i + vec2(0.0, 1.0)), th(i + vec2(1.0, 1.0)), f.x), f.y); }
float tfbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * tn(p); p *= 2.03; a *= 0.5; } return s; }
const vec3 SIGNAL = vec3(1.0, 0.102, 0.0123);
`;

export class ShaderPass {
  readonly mat: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private quad!: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(private ctx: TransitionCtx, frag: string, uniforms: Record<string, THREE.IUniform> = {}) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { texA: { value: null }, texB: { value: null }, u: { value: 0 }, uAsp: { value: 16 / 9 }, ...uniforms },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D texA; uniform sampler2D texB; uniform float u; uniform float uAsp; varying vec2 vUv;${TGLSL}\n${frag}`,
      depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.scene.add(this.quad);
  }
  draw(out: THREE.WebGLRenderTarget, a: THREE.Texture | null, b: THREE.Texture | null, u: number, set: Record<string, unknown> = {}) {
    const U = this.mat.uniforms;
    U.texA!.value = a; U.texB!.value = b; U.u!.value = u;
    for (const k in set) U[k]!.value = set[k];
    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(0x07070a, 1);
    r.clear(true, true, true);
    r.render(this.scene, this.cam);
    r.resetState();
  }
  dispose() { this.mat.dispose(); this.quad.geometry.dispose(); }
}

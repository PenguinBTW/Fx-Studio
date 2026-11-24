// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// SCENE: INTERFERENCE (0.0s – 20.0s)
// Two circular wave sources on a near-black water field emitting expanding
// ripple rings; where wavefronts cross, interference fringes form. Mid-take
// the second source's frequency steps up and the fringe lattice reorganizes.
// Camera: gentle oblique tilt reveal settling into a slow overhead drift.
// Palette: near-black field, bone-white wavefronts, one warm amber accent.
// Fully deterministic — every uniform is a closed-form f(t).

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { orbitPosition } from '../../engine/rig';
import { ease, prog, TAU } from '../../engine/util';

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  varying vec3 vWorld;

  uniform float uTime;       // local scene time (s)
  uniform float uLambda2;    // source B wavelength (steps up in frequency)
  uniform float uStepPulse;  // 0..1 bloom pulse while the pattern reorganizes

  const float TAU_F = 6.28318530718;

  // Wave parameters (world units, seconds)
  const float LAMBDA_A = 1.15;
  const float SPEED    = 1.35;
  const float DECAY    = 0.16;
  const float FRONT_SOFT = 0.9;

  const vec2 SRC_A = vec2(-1.7, 0.0);
  const vec2 SRC_B = vec2( 1.7, 0.0);

  // One expanding ripple train: phase k(r - vt), radial decay, soft leading
  // wavefront and a suppressed singularity at the emitter.
  float wavePhase(vec2 p, vec2 src, float lambda, float t) {
    float r = length(p - src);
    return (TAU_F / lambda) * (r - SPEED * t);
  }
  float waveEnv(vec2 p, vec2 src, float t) {
    float r = length(p - src);
    float front = 1.0 - smoothstep(SPEED * t - FRONT_SOFT, SPEED * t + FRONT_SOFT, r);
    return exp(-r * DECAY) * front * smoothstep(0.0, 0.55, r);
  }

  // Cheap deterministic micro-chop so the field reads as water, not graph paper.
  float chop(vec2 p, float t) {
    return 0.012 * sin(p.x * 3.1 + t * 0.7) * sin(p.y * 2.6 - t * 0.5)
         + 0.008 * sin(p.x * 6.7 - t * 0.4) * sin(p.y * 5.9 + t * 0.6);
  }

  float field(vec2 p) {
    return waveEnv(p, SRC_A, uTime) * cos(wavePhase(p, SRC_A, LAMBDA_A, uTime))
         + waveEnv(p, SRC_B, uTime) * cos(wavePhase(p, SRC_B, uLambda2, uTime))
         + chop(p, uTime);
  }

  void main() {
    vec2 p = vWorld.xz;
    float h = field(p);

    // Thin rings per source, killed where the superposition cancels — the
    // surviving ring segments ARE the interference fringes.
    float lineA = pow(0.5 + 0.5 * cos(wavePhase(p, SRC_A, LAMBDA_A, uTime)), 9.0) * waveEnv(p, SRC_A, uTime);
    float lineB = pow(0.5 + 0.5 * cos(wavePhase(p, SRC_B, uLambda2, uTime)), 9.0) * waveEnv(p, SRC_B, uTime);
    float rings = lineA + lineB;
    float energy = pow(clamp(h * h * 0.34, 0.0, 1.0), 1.6);

    // Pseudo-normal from the field gradient for water specular.
    float e = 0.06;
    float hx = field(p + vec2(e, 0.0)) - h;
    float hz = field(p + vec2(0.0, e)) - h;
    vec3 n = normalize(vec3(-hx / e, 1.0, -hz / e));

    // Near-black field with a faint blue-green depth falloff.
    float r = length(p);
    vec3 base = mix(vec3(0.008, 0.014, 0.018), vec3(0.002, 0.004, 0.006), smoothstep(1.0, 11.0, r));

    float crest = energy;
    vec3 bone = vec3(0.929, 0.909, 0.863);

    // Warm accent: the two emitters + constructive maxima during the step-up.
    vec3 amber = vec3(0.851, 0.604, 0.329);
    float gA = exp(-length(p - SRC_A) * 4.0);
    float gB = exp(-length(p - SRC_B) * 4.0);
    float emit = gA * (0.75 + 0.25 * cos(TAU_F * uTime * SPEED / LAMBDA_A))
               + gB * (0.75 + 0.25 * cos(TAU_F * uTime * SPEED / uLambda2));
    float hotZone = pow(clamp(abs(h), 0.0, 1.4) / 1.4, 3.0) * uStepPulse;

    // Grazing specular from a low warm key light, upper-left of frame.
    vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
    vec3 V = normalize(cameraPosition - vWorld);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 24.0) * 0.35;

    vec3 col = base
      + bone * (rings * 0.45 + crest * 0.95)
      + amber * (emit * 0.55 + hotZone * 0.6 + spec * (0.4 + crest));

    // Gentle HDR headroom at crest cores so bloom can pick them out.
    col += bone * pow(crest, 3.0) * 0.45;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default class InterferenceScene extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;

  constructor(ctx: SceneCtx) {
    super(ctx);

    this.camera = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 200);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uLambda2: { value: 1.15 },
        uStepPulse: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.threeScene.add(this.mesh);
    this.threeScene.background = new THREE.Color(0x030507);
  }

  render(frame: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { lt } = frame;
    const { renderer } = this.ctx;

    // ── Source B frequency step: wavelength 1.15 -> 0.62 over ~1.4s at t=12 ──
    const step = prog(lt, 11.6, 13.0, ease.inOutCubic);
    const lambda2 = 1.15 + (0.62 - 1.15) * step;
    const stepPulse = Math.exp(-Math.pow(lt - 12.3, 2) * 1.6);

    this.material.uniforms.uTime.value = lt;
    this.material.uniforms.uLambda2.value = lambda2;
    this.material.uniforms.uStepPulse.value = stepPulse;

    // ── Camera: oblique tilt reveal (0–4.5s) easing to near-overhead,
    //    then a slow orbital drift for the rest of the take. ──
    const reveal = prog(lt, 0, 4.5, ease.outCubic);
    const pitch = 0.52 + (1.18 - 0.52) * reveal + 0.03 * Math.sin(lt * 0.35);
    const yaw = -0.55 + 0.20 * lt + 0.05 * Math.sin(lt * 0.22);
    const radius = 9.6 - 1.6 * reveal + 0.25 * Math.sin(lt * 0.3);
    const pos = orbitPosition([0, 0, 0], radius, pitch, yaw);
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.camera.lookAt(0, 0, 0);

    renderer.setRenderTarget(out);
    renderer.setClearColor(0x030507, 1.0);
    renderer.clear(true, true, true);
    renderer.render(this.threeScene, this.camera);

    return {
      bloom: 0.18 + 0.22 * stepPulse,
      bloomThreshold: 0.80,
      vignette: 0.19,
      grain: 0.016,
      exposure: 1.04,
    };
  }

  override dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

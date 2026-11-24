// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// caustics — a camera drifts down toward a dark pool floor while an invisible
// water surface above refracts sunlight into a web of caustic filaments. The
// pattern is the classic iterated sine-fold field (each fold perturbs the
// next, so lines fold, merge and dissolve) — fully deterministic f(t). Mid-take
// a slow swell raises the wave amplitude so the web breathes, then briefly
// calms into a soft wide wash before the filaments re-form.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number) => Math.exp(-x * x);

// --- tuneables ---------------------------------------------------------------
// Swell envelope: broad lift around t≈10 (waves grow, filaments fatten and
// intensify) with a brief calm notch at its crest, then re-form and settle.
const ampAt = (t: number) => 1.0 + 1.15 * gauss((t - 10.0) / 2.6) - 0.75 * gauss((t - 10.4) / 0.85);
const gainAt = (t: number) => smooth(0.3, 1.6, t) * (0.85 + 0.55 * gauss((t - 10.0) / 3.0) - 0.45 * gauss((t - 10.4) / 0.8));

// --- shaders -----------------------------------------------------------------
const FLOOR_VERT = `out vec3 vW;
void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Iterated sine-fold caustics (Hoskins-style): each of 4 folds displaces the
// sampling point of the next, which is what makes the bright web fold, merge
// and dissolve instead of drifting like plain noise. uAmp scales the fold
// strength and uGain the final brightness; uWarm lifts one faint sun tint.
const FLOOR_FRAG = `${GLSL_COMMON}
uniform float uT, uAmp, uGain;
in vec3 vW; out vec4 fragColor;

float caustic(vec2 p, float t, float amp) {
  // Wrap into a large-offset tile (Hoskins' tileable domain): the numerators
  // must stay far from 0 or 1/length explodes to Inf and the frame goes NaN.
  p = mod(p * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float ft = t * (1.0 - 3.5 / float(n + 1)) * amp;
    i = p + vec2(cos(ft - i.x) + sin(ft + i.y), sin(ft - i.y) + cos(ft + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + ft) / inten), p.y / (cos(i.y + ft) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  // high exponent → thin bright filaments, dark gaps (not a soft grey wash)
  return pow(abs(c), 13.0);
}

void main(){
  // world-space pool coordinates; slight anisotropy reads as perspective stretch
  vec2 p = vW.xz * 0.55;
  float t = uT * 0.55;

  // main filament web + a second, finer layer drifting the other way for shimmer
  float c1 = caustic(p, t, uAmp);
  float c2 = caustic(p * 1.7 + 31.7, -t * 0.8 + 4.0, uAmp * 0.85);
  float web = c1 * 1.5 + 0.22 * c2;
  // damp the low fog so dark water reads between the filaments
  web *= smoothstep(0.01, 0.16, web);

  // deep blue-black floor with slow large-scale mottling so the dark is alive
  float mot = fbm(p * 0.35 + vec2(0.0, uT * 0.02), 3) * 0.5 + 0.5;
  vec3 base = mix(vec3(0.002, 0.004, 0.008), vec3(0.006, 0.011, 0.019), mot);

  // water absorbs red: dim spill reads deep blue, filament cores go bone with
  // a faint warm sun tint at the brightest intersections
  vec3 spill = vec3(0.05, 0.11, 0.20);
  vec3 bone = vec3(0.93, 0.92, 0.86);
  vec3 warm = vec3(1.0, 0.78, 0.52);
  vec3 fil = mix(spill, bone, smoothstep(0.0, 0.8, web)) + warm * 0.25 * web * web;

  // gentle radial falloff — the pool edge sinks into darkness
  float vig = exp(-dot(vW.xz, vW.xz) * 0.012);

  vec3 col = base + fil * web * uGain * vig;
  fragColor = vec4(col, 1.0);
}`;

export default class CausticsScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private floorU = {
    uT: { value: 0 },
    uAmp: { value: 1 },
    uGain: { value: 0 },
  };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(45, ctx.W / ctx.H, 0.1, 60);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.ShaderMaterial({ uniforms: this.floorU, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, glslVersion: THREE.GLSL3 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.three.add(floor);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    this.floorU.uT.value = t;
    this.floorU.uAmp.value = ampAt(t);
    this.floorU.uGain.value = gainAt(t);

    // slow descend + slight drift; keeps the web readable but never static
    const h = 8.2 - 2.6 * smooth(1.0, 17.0, t);
    this.cam.position.set(
      0.9 * Math.sin(t * 0.11),
      h,
      2.6 + 0.4 * Math.sin(t * 0.07 + 2.0),
    );
    this.cam.lookAt(0.3 * Math.sin(t * 0.05), 0, -0.4);

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    const fade = t < 0.9 ? 1 - t / 0.9 : t > 19.1 ? (t - 19.1) / 0.9 : 0;
    return {
      exposure: 1.0, bloom: 1.1, bloomThreshold: 0.35, bloomRadius: 0.9,
      ca: 0.35, grain: 0.05, vignette: 0.55, fade: clamp01(fade), toneMap: 'agx',
    };
  }

  override dispose(): void {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

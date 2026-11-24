// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
//
// ripple — a macro shot of a black mirror-still surface. A droplet falls at
// t≈3 and concentric rings expand from the impact, each crest catching a
// bone rim-light while the surface distorts a dim environment reflection.
// A second, smaller drop lands offset at t≈12; its wave train crosses the
// first and the crossings interfere. Everything is a closed-form radial
// wave field evaluated in the fragment shader — no simulation, no
// Math.random. Analytic ring geometry with finite-difference normals.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

// Impact choreography — all times/places fixed so the whole take is f(t).
const IMPACT_1 = { x: 0.0, z: -2.0, t0: 3.0, amp: 1.0 };
const IMPACT_2 = { x: 9.5, z: 5.0, t0: 12.0, amp: 0.72 };
// Each drop is visible only while falling.
const FALL_START = 0.75; // seconds before impact the droplet appears overhead
const FALL_HEIGHT = 8.0;

const FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uCamPos;
uniform vec2 uImpact1;
uniform vec2 uImpact2;
uniform float uT0_1;
uniform float uT0_2;
uniform float uAmp1;
uniform float uAmp2;

varying vec3 vWorld;

// One expanding wave train. phase moves outward at V units/s so crests are
// rings centred on the impact; the causal front eats the field ahead of
// V*age and amplitude decays with distance, age and behind the leading edge.
float waveTrain(vec2 p, vec2 c, float t0, float amp, float k, float v, float att) {
  float age = uTime - t0;
  if (age <= 0.0) return 0.0;
  float r = length(p - c);
  float lead = v * age;
  float mask = 1.0 - smoothstep(lead - 2.4, lead, r);
  float decay = exp(-att * r) * exp(-0.10 * age);
  // Slightly dispersive: rings tighten toward the front, lag behind it.
  float phase = k * (r - lead) + 0.35 * (r - lead) * (r - lead) / max(lead, 1.0);
  return amp * decay * mask * sin(phase);
}

float surfHeight(vec2 p) {
  float h = waveTrain(p, uImpact1, uT0_1, uAmp1, 2.1, 7.5, 0.055);
  h += waveTrain(p, uImpact2, uT0_2, uAmp2, 2.7, 7.0, 0.075);
  return h;
}

// Dim, cool environment: a low sky gradient with a faint horizon band the
// rings visibly shear. Not a real envmap — a closed-form stand-in lit by n.
vec3 envColor(vec3 dir) {
  float up = clamp(dir.y, 0.0, 1.0);
  vec3 sky = mix(vec3(0.028, 0.034, 0.045), vec3(0.10, 0.12, 0.14), pow(up, 0.7));
  float band = exp(-pow((dir.y - 0.10) * 6.5, 2.0));
  sky += vec3(0.030, 0.036, 0.045) * band;
  return sky;
}

void main() {
  vec2 p = vWorld.xz;
  float e = 0.14;
  float h  = surfHeight(p);
  float hx = surfHeight(p + vec2(e, 0.0));
  float hz = surfHeight(p + vec2(0.0, e));
  vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));

  vec3 viewDir = normalize(uCamPos - vWorld);
  vec3 refl = reflect(-viewDir, n);

  // Base: near-black mirror. Reflection gain falls toward steep normals so
  // the field reads as distortion passing through a dim env, not light.
  vec3 col = envColor(refl) * 0.38 * (0.55 + 0.45 * clamp(refl.y * 1.6, 0.0, 1.0));

  // Ring-crest rim light: bone where the summed field peaks, weighted by
  // grazing angle so crests flare at the silhouette of each wavefront.
  float crest = smoothstep(0.14, 0.42, h);
  float rim = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 2.0);
  col += vec3(0.78, 0.80, 0.74) * crest * (0.45 + 1.6 * rim);

  // One thin warm glint riding the main drop's crests — gated by the crest
  // factor so a flat surface stays cold.
  float lead = max(7.5 * (uTime - uT0_1), 0.0);
  float leadBand = exp(-pow(length(p - uImpact1) - lead, 2.0) / 1.6) * step(0.0, uTime - uT0_1);
  vec3 warmDir = normalize(vec3(-0.42, 0.55, 0.72));
  float spec = pow(max(dot(refl, warmDir), 0.0), 160.0);
  col += vec3(0.95, 0.55, 0.30) * spec * crest * (0.5 + 1.1 * leadBand);

  // Trough shading keeps the field dimensional between crests.
  col *= 1.0 - 0.28 * smoothstep(0.10, 0.34, -h);

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export default class RippleScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private water: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;
  private drop1: THREE.Mesh;
  private drop2: THREE.Mesh;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uImpact1: { value: new THREE.Vector2(IMPACT_1.x, IMPACT_1.z) },
        uImpact2: { value: new THREE.Vector2(IMPACT_2.x, IMPACT_2.z) },
        uT0_1: { value: IMPACT_1.t0 },
        uT0_2: { value: IMPACT_2.t0 },
        uAmp1: { value: IMPACT_1.amp },
        uAmp2: { value: IMPACT_2.amp },
      },
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.threeScene.add(this.water);

    const dropGeo = new THREE.SphereGeometry(0.34, 20, 16);
    dropGeo.scale(1, 1.35, 1); // falling drop elongates slightly
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xd8ddd2 });
    this.drop1 = new THREE.Mesh(dropGeo, dropMat);
    this.drop2 = new THREE.Mesh(dropGeo.clone(), dropMat.clone());
    (this.drop2.material as THREE.MeshBasicMaterial).color.setHex(0xc9cec2);
    this.drop2.scale.setScalar(0.72);
    this.threeScene.add(this.drop1, this.drop2);
  }

  private static fallY(t: number, t0: number): number {
    // y(t): closed-form ease-in descent reaching the surface exactly at t0.
    const u = (t - (t0 - FALL_START)) / FALL_START;
    if (u <= 0 || u >= 1) return -1;
    return FALL_HEIGHT * (1 - u * u);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;

    // Slow orbit around the main impact, low macro tilt, near-static push-in.
    const ang = -0.62 + 0.055 * lt;
    const rad = 24.5 - 0.22 * lt;
    const cx = IMPACT_1.x + rad * Math.cos(ang);
    const cz = IMPACT_1.z + rad * Math.sin(ang);
    const cy = 12.5 - 0.14 * lt;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(IMPACT_1.x + 1.5, 0.4, IMPACT_1.z + 1.0);
    this.camera.updateMatrixWorld();

    const y1 = RippleScene.fallY(lt, IMPACT_1.t0);
    this.drop1.visible = y1 >= 0;
    this.drop1.position.set(IMPACT_1.x, Math.max(0, y1), IMPACT_1.z);
    const y2 = RippleScene.fallY(lt, IMPACT_2.t0);
    this.drop2.visible = y2 >= 0;
    this.drop2.position.set(IMPACT_2.x, Math.max(0, y2), IMPACT_2.z);

    this.waterMat.uniforms.uTime!.value = lt;
    (this.waterMat.uniforms.uCamPos!.value as THREE.Vector3).copy(this.camera.position);

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.30,
      bloomThreshold: 0.55,
      vignette: 0.34,
      grain: 0.013,
      exposure: 1.05,
    };
  }

  override dispose(): void {
    this.water.geometry.dispose();
    this.waterMat.dispose();
    this.drop1.geometry.dispose();
    (this.drop1.material as THREE.Material).dispose();
    this.drop2.geometry.dispose();
    (this.drop2.material as THREE.Material).dispose();
  }
}

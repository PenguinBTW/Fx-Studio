// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// rainfall — hydrology register: night rain arriving on a dark puddle surface.
// The surface is the instrument: every impact writes an expanding ring, rings
// interfere, the streetlight out of frame ignites them as brief amber arcs.
// Fully closed-form: the ripple field is an analytic sum of ring wavelets in
// the surface shader (each drop's spawn time + position hash-determined by
// index — no state), rain streaks wrap modulo fall height. The storm's
// intensity envelope is a smoothstep ladder — drizzle, downpour, easing.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

const N_RINGS = 48;   // simultaneous ripple sources evaluated per pixel
const N_DROPS = 420;  // instanced rain streaks

const SURF_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SURF_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
uniform float uIntensity;  // 0..1 storm envelope — scales active ring count + spawn rate
uniform vec3 uLightPos;
uniform vec3 uCamPos;

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 hash2(float n) { return fract(sin(vec2(n * 127.1, n * 311.7)) * 43758.5453); }

// ring wavelet height contribution of drop i at world xz position p, time t
float ringH(vec2 p, float i, float t) {
  float life = 2.6;
  // each drop recycles: generation g = floor((t + offset) / life)
  float cyc = t / life + hash1(i * 3.7) * 5.0;
  float g = floor(cyc);
  float birth = (g - hash1(i * 3.7) * 5.0) * life;
  float age = t - birth;
  if (age < 0.0 || age > life) return 0.0;
  // spawn gate: only a fraction of drops active, scaled by intensity
  float gate = hash1(i + g * 17.0);
  if (gate > uIntensity * 0.85 + 0.1) return 0.0;
  vec2 c = (hash2(i + g * 31.0) - 0.5) * 14.0;
  float d = length(p - c);
  float r = age * 1.9;                    // ring expansion speed
  float w = 0.09 + age * 0.16;            // ring width grows as it expands
  float x = (d - r) / w;
  float envelope = exp(-x * x);
  float decay = (1.0 - age / life);
  decay *= decay;
  float size = 0.6 + 0.7 * hash1(i * 7.0 + g);  // drop momentum → ring scale
  return envelope * decay * size * 0.085 * sin((d - r) * 34.0 / (1.0 + age * 2.0));
}

float heightAt(vec2 p, float t) {
  float h = 0.0;
  for (int i = 0; i < ${N_RINGS}; i++) {
    h += ringH(p, float(i), t);
  }
  return h;
}

void main() {
  vec2 p = vWorld.xz;
  float e = 0.06;
  float h0 = heightAt(p, uTime);
  float hx = heightAt(p + vec2(e, 0.0), uTime);
  float hz = heightAt(p + vec2(0.0, e), uTime);
  vec3 n = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));

  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uLightPos - vWorld);
  // wet asphalt: dark base, specular from the streetlight — rings catch it as moving arcs
  vec3 base = vec3(0.006, 0.007, 0.011);
  vec3 R = reflect(-L, n);
  float spec = pow(max(dot(R, V), 0.0), 60.0);
  vec3 warm = vec3(1.0, 0.72, 0.38);
  // broad sheen where the surface faces the light
  float sheen = pow(max(dot(R, V), 0.0), 8.0) * 0.10;
  vec3 col = base + warm * (spec * 3.5 + sheen);
  // faint cool ambient sky reflection on flat water
  col += vec3(0.004, 0.005, 0.009) * max(n.y, 0.0);
  float dist = length(uCamPos - vWorld);
  col *= exp(-dist * 0.09) * 1.35;
  gl_FragColor = vec4(col, 1.0);
}
`;

const RAIN_VERT = /* glsl */ `
attribute vec3 aSeed;   // x,z spawn plane position seed; y phase
uniform float uTime;
uniform float uIntensity;
uniform float uSlant;
varying float vFade;
void main() {
  float fallH = 9.0;
  float speed = 7.0 + aSeed.y * 3.0;
  float phase = aSeed.y * 91.7;
  float y = mod(aSeed.x * 13.0 + phase - uTime * speed, fallH) ;
  // wind slant: x drifts with fall distance
  float x = aSeed.x * 12.0 - (fallH - y) * uSlant;
  float z = aSeed.z * 12.0;
  // intensity gates visibility: fraction of streaks active
  vFade = step(fract(aSeed.y * 7.31), uIntensity * 0.8 + 0.15);
  vec3 off = vec3(x - 6.0, y - 1.0, z - 6.0);
  vec4 mv = modelViewMatrix * vec4(off + position * vec3(0.02, 0.42, 0.02), 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const RAIN_FRAG = /* glsl */ `
precision highp float;
varying float vFade;
uniform vec3 uTint;
void main() {
  if (vFade < 0.5) discard;
  gl_FragColor = vec4(uTint, 0.55);
}
`;

export default class Rainfall extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 120);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private surfMat: THREE.ShaderMaterial | null = null;
  private rainMat: THREE.ShaderMaterial | null = null;
  private focusDist = 7;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    this.world.background = new THREE.Color(0x050608);

    // --- puddle surface: shader plane, ring wavelets evaluated analytically ---
    const surfGeo = new THREE.PlaneGeometry(30, 30, 1, 1);
    surfGeo.rotateX(-Math.PI / 2);
    this.disposables.push(surfGeo);
    this.surfMat = new THREE.ShaderMaterial({
      vertexShader: SURF_VERT,
      fragmentShader: SURF_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
        uLightPos: { value: new THREE.Vector3(-5, 7, 3) },
        uCamPos: { value: new THREE.Vector3() },
      },
    });
    this.disposables.push(this.surfMat);
    const surf = new THREE.Mesh(surfGeo, this.surfMat);
    this.world.add(surf);

    // --- rain streaks: instanced thin quads, closed-form fall in the vertex shader ---
    const dropGeo = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(dropGeo);
    const seeds = new Float32Array(N_DROPS * 3);
    const h1 = (i: number, s: number) => {
      const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < N_DROPS; i++) {
      seeds[i * 3] = h1(i, 1);
      seeds[i * 3 + 1] = h1(i, 2);
      seeds[i * 3 + 2] = h1(i, 3);
    }
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = dropGeo.index;
    inst.attributes.position = dropGeo.attributes.position;
    inst.attributes.uv = dropGeo.attributes.uv;
    inst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
    inst.instanceCount = N_DROPS;
    this.disposables.push(inst);
    this.rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
        uSlant: { value: 0.35 },
        uTint: { value: new THREE.Color(0.55, 0.62, 0.72) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(this.rainMat);
    const rain = new THREE.Mesh(inst, this.rainMat);
    rain.frustumCulled = false;
    this.world.add(rain);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    // storm envelope: drizzle -> downpour -> easing, all smoothstep ladder
    const build = smoothstep(2, 9, lt);
    const ease = smoothstep(20, 28, lt);
    const intensity = 0.25 + 0.75 * build * (1 - ease) - 0.1 * ease;

    if (this.surfMat) {
      this.surfMat.uniforms.uTime.value = lt;
      this.surfMat.uniforms.uIntensity.value = intensity;
      this.surfMat.uniforms.uCamPos.value.copy(this.cam.position);
    }
    if (this.rainMat) {
      this.rainMat.uniforms.uTime.value = lt;
      this.rainMat.uniforms.uIntensity.value = intensity;
    }

    // camera: low glancing push-in over the pool, very slow yaw
    const radius = 7 - 1.5 * smoothstep(0, 30, lt);
    const yaw = 0.5 + lt * 0.02;
    this.rig.setLensMm(50);
    this.rig.orbit([0.5, 0.2, 0.5], radius, 0.24, yaw);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);
    this.focusDist = this.cam.position.distanceTo(new THREE.Vector3(0.5, 0.2, 0.5));

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x050608, 1);
    rr.clear();
    rr.render(this.world, this.cam);
    rr.setRenderTarget(null);

    return {
      depthFocusDist: this.focusDist,
      depthAperture: 5,
      depthDof: { near: 0.1, far: 120 },
      bloomStrength: 0.35,
      grain: 0.02,
      vignette: 0.4,
    };
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}

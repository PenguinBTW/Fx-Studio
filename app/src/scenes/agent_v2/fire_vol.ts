// Raymarched flame volume: a box along local +x, density = expanding cone * domain-warped fbm advected down the
// stream, emission = blackbody of (density x falloff), soot absorption in the tail. Premultiplied over the scene.
import * as THREE from 'three';
import { PNOISE } from './planet_glsl';

const V = /* glsl */ `varying vec3 vL; void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const Fr = /* glsl */ `${PNOISE}
uniform vec3 uCamL; uniform float uT, uFront, uOn, uLen, uRad, uGain; varying vec3 vL;
vec3 bb(float k) { return vec3(1.0, 0.22 + 0.62 * k, 0.03 + 0.55 * k * k) * (0.25 + 2.4 * k * k * k); }
float dens(vec3 p, out float x01) { x01 = p.x / uLen; float r = 0.1 + uRad * pow(x01, 0.8);
  vec2 c = vec2(0.35 * uRad * x01 * x01, 0.0); float d = length(p.yz - c) / r;
  vec3 q = p * vec3(0.8, 1.5, 1.5) - vec3(uT * 9.0, uT * 2.0, 0.0); q += 1.1 * vec3(pfbm(q * 0.7 + 3.1, 3), pfbm(q * 0.7 + 8.3, 3), pfbm(q * 0.7 + 1.7, 3));
  float n = mix(0.6, smoothstep(0.3, 0.75, pfbm(q, 5) * 0.5 + 0.5), smoothstep(0.0, 0.3, x01)); float sh = smoothstep(1.0, 0.15, d + 0.55 * (n - 0.5));
  float front = smoothstep(uFront, uFront - 0.18, x01) * smoothstep(0.0, 0.02, x01);
  return clamp(sh * front * n * 2.2 * uOn, 0.0, 1.0); }
void main() { vec3 ro = uCamL, rd = normalize(vL - ro);
  vec3 bmin = vec3(0.0, -uRad * 1.6, -uRad * 1.6), bmax = vec3(uLen, uRad * 1.6, uRad * 1.6);
  vec3 t0 = (bmin - ro) / rd, t1 = (bmax - ro) / rd; vec3 tn = min(t0, t1), tf = max(t0, t1);
  float a = max(max(max(tn.x, tn.y), tn.z), 0.0), b = min(min(tf.x, tf.y), tf.z); if (b <= a) discard;
  const int S = 64; float dt = (b - a) / float(S); float tr = 1.0; vec3 col = vec3(0.0);
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); float t = a + dt * j;
  for (int i = 0; i < S; i++) { vec3 p = ro + rd * t; float x01; float de = dens(p, x01);
    if (de > 0.003) { float heat = clamp(de * (1.3 - x01 * 1.05), 0.0, 1.0); float soot = smoothstep(0.45, 1.0, x01) * (1.0 - heat);
      vec3 e = bb(heat) * heat * uGain; col += tr * e * dt * 1.5; tr *= exp(-de * dt * (0.9 + 2.5 * soot)); if (tr < 0.02) break; }
    t += dt; }
  gl_FragColor = vec4(col, 1.0 - tr); }`;

export class FlameVolume {
  readonly mesh: THREE.Mesh; readonly u = { uCamL: { value: new THREE.Vector3() }, uT: { value: 0 }, uFront: { value: 0 }, uOn: { value: 0 }, uLen: { value: 11 }, uRad: { value: 2.6 }, uGain: { value: 1 } };
  constructor(len = 11, rad = 2.6) {
    this.u.uLen.value = len; this.u.uRad.value = rad;
    const g = new THREE.BoxGeometry(len, rad * 3.2, rad * 3.2).translate(len / 2, 0, 0);
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: V, fragmentShader: Fr, side: THREE.BackSide, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  /** place at mouth along dir; front 0..1 = how far down the stream the flame has reached; on = breath envelope */
  update(cam: THREE.Camera, mouth: THREE.Vector3, dir: THREE.Vector3, t: number, front: number, on: number) {
    this.mesh.position.copy(mouth); this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir); this.mesh.updateMatrixWorld();
    this.u.uCamL.value.copy(cam.position); this.mesh.worldToLocal(this.u.uCamL.value); this.u.uT.value = t; this.u.uFront.value = front; this.u.uOn.value = on;
    this.mesh.visible = on > 0.002;
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

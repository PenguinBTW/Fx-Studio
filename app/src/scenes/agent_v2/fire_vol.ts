// Raymarched flame volume: a box along local +x, density = expanding cone * domain-warped fbm advected down the
// stream, emission = blackbody of (density x falloff), soot absorption in the tail. Premultiplied over the scene.
import * as THREE from 'three';
import { PNOISE } from './planet_glsl';

const V = /* glsl */ `varying vec3 vL; void main() { vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const Fr = /* glsl */ `${PNOISE}
uniform vec3 uCamL; uniform float uT, uFront, uOn, uLen, uRad, uGain; varying vec3 vL;
vec3 bb(float k) { vec3 c = mix(vec3(0.45, 0.02, 0.0), vec3(1.0, 0.26, 0.02), smoothstep(0.0, 0.4, k)); c = mix(c, vec3(1.0, 0.66, 0.16), smoothstep(0.4, 0.75, k)); c = mix(c, vec3(1.0, 0.95, 0.82), smoothstep(0.75, 1.0, k)); return c * (0.15 + 3.2 * k * k); }
float gRi, gD;
float dens(vec3 p, out float x01) { x01 = p.x / uLen; float r = 0.15 + 1.3 * uRad * pow(x01, 0.55);
  vec2 c = vec2(0.35 * uRad * x01 * x01, 0.0); float d = length(p.yz - c) / r; gD = d;
  vec3 q = p * vec3(0.8, 1.5, 1.5) - vec3(uT * 9.0, uT * 2.0, 0.0); q += 1.1 * vec3(pfbm(q * 0.7 + 3.1, 3), pfbm(q * 0.7 + 8.3, 3), pfbm(q * 0.7 + 1.7, 3));
  float hf = pfbm(q * 3.3 + 5.7, 3); float ri = pow(1.0 - abs(pfbm(q * 1.6 + 2.0, 4)), 3.0); gRi = ri; float n = mix(0.6, smoothstep(0.34, 0.68, pfbm(q, 5) * 0.5 + 0.5 + 0.22 * hf) * (0.35 + 0.95 * ri), smoothstep(0.0, 0.3, x01)); float sh = smoothstep(0.9, 0.5, d + 0.7 * (n - 0.5) + 0.4 * hf * x01);
  float front = smoothstep(uFront, uFront - 0.18, x01) * smoothstep(0.0, 0.02, x01);
  float st = pfbm(vec3(p.x * 0.35 - uT * 16.0, p.y * 5.0, p.z * 5.0), 2); float mid = smoothstep(0.12, 0.3, x01); float gap = mix(1.0, 0.06 + 0.94 * smoothstep(0.34, 0.6, ri + 0.3 * st), mid);
  return clamp(sh * front * n * gap * (0.85 + 0.3 * st) * 2.4 * uOn, 0.0, 1.0); }
void main() { vec3 ro = uCamL, rd = normalize(vL - ro);
  vec3 bmin = vec3(0.0, -uRad * 2.4, -uRad * 2.4), bmax = vec3(uLen, uRad * 2.4, uRad * 2.4);
  vec3 t0 = (bmin - ro) / rd, t1 = (bmax - ro) / rd; vec3 tn = min(t0, t1), tf = max(t0, t1);
  float a = max(max(max(tn.x, tn.y), tn.z), 0.0), b = min(min(tf.x, tf.y), tf.z); if (b <= a) discard;
  const int S = 64; float dt = (b - a) / float(S); float tr = 1.0; vec3 col = vec3(0.0);
  float j = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453); float t = a + dt * j;
  for (int i = 0; i < S; i++) { vec3 p = ro + rd * t; float x01; float de = dens(p, x01);
    if (de > 0.003) { float heat = clamp(de * (1.1 - x01 * 1.15) * (0.25 + 1.1 * gRi * gRi), 0.0, 1.0); float soot = smoothstep(0.5, 1.0, x01) * (1.0 - heat) * smoothstep(0.35, 0.9, gD);
      float core = smoothstep(0.4, 0.0, gD) * smoothstep(0.16, 0.0, x01) * smoothstep(uFront, uFront - 0.3, x01); float tongue = smoothstep(0.68, 0.8, gRi) * smoothstep(0.25, 0.75, gD) * smoothstep(0.85, 0.15, x01);
      vec3 e = bb(heat) * (0.15 + heat) * 0.7 * uGain * smoothstep(0.28, 0.7, de) * (0.12 + 0.88 * smoothstep(0.4, 0.82, gRi)) + vec3(1.0, 0.92, 0.7) * core * de * 3.2 * uGain + vec3(1.0, 0.55, 0.12) * tongue * de * 3.6 * uGain; col += tr * e * dt * 1.5; tr *= exp(-de * dt * (0.25 + 1.4 * soot)); if (tr < 0.02) break; }
    t += dt; }
  gl_FragColor = vec4(col, 1.0 - tr); }`;

export class FlameVolume {
  readonly mesh: THREE.Mesh; readonly u = { uCamL: { value: new THREE.Vector3() }, uT: { value: 0 }, uFront: { value: 0 }, uOn: { value: 0 }, uLen: { value: 11 }, uRad: { value: 2.6 }, uGain: { value: 1 } };
  constructor(len = 11, rad = 2.6) {
    this.u.uLen.value = len; this.u.uRad.value = rad;
    const g = new THREE.BoxGeometry(len, rad * 4.8, rad * 4.8).translate(len / 2, 0, 0);
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

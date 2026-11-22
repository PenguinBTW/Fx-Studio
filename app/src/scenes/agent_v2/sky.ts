// Dusk sky world shared by the dragon acts: gradient dome + sun, a sea of clouds below, distant cloud banks.
import * as THREE from 'three';

const NZ = /* glsl */ `
float hh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }`;

export interface SkyLook { zen: number; mid: number; hor: number; sun: THREE.Vector3; sunCol: number; lit: number; shade: number }
export const DUSK: SkyLook = { zen: 0x120a26, mid: 0x4a2050, hor: 0xff8a4a, sun: new THREE.Vector3(-0.55, 0.1, -0.83).normalize(), sunCol: 0xffc68a, lit: 0xffb27a, shade: 0x3b2a5e };

export const STORM: SkyLook = { zen: 0x04050a, mid: 0x0f1424, hor: 0x5a2a3a, sun: new THREE.Vector3(-0.6, 0.06, -0.8).normalize(), sunCol: 0xff6a3a, lit: 0xff7a4a, shade: 0x1a2240 };

export function skyWorld(look: SkyLook, time: { value: number }) {
  const g = new THREE.Group();
  const u = { uZ: { value: new THREE.Color(look.zen) }, uM: { value: new THREE.Color(look.mid) }, uH: { value: new THREE.Color(look.hor) },
    uS: { value: look.sun }, uSC: { value: new THREE.Color(look.sunCol) }, uL: { value: new THREE.Color(look.lit) }, uD: { value: new THREE.Color(look.shade) }, uT: time };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: u,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uZ, uM, uH, uS, uSC; varying vec3 vD; void main(){ float h = vD.y;
      vec3 c = mix(uH, uM, smoothstep(-0.02, 0.28, h)); c = mix(c, uZ, smoothstep(0.35, 1.0, h));
      float d = max(dot(vD, uS), 0.0); c += uSC * (pow(d, 900.0) * 30.0 + pow(d, 40.0) * 1.2 + pow(d, 6.0) * 0.35);
      gl_FragColor = vec4(c, 1.0); }` }));
  dome.frustumCulled = false; dome.renderOrder = -2; g.add(dome);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: u,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uS, uL, uD, uH, uSC; uniform float uT; varying vec3 vW; ${NZ}
      void main(){ vec2 p = vW.xz * 0.045 + vec2(uT * 0.02, 0.0); float d = fbm(p); float d2 = fbm(p + uS.xz * 0.06);
        float lit = clamp((d - d2) * 4.0 + 0.55, 0.0, 1.0); float cov = smoothstep(0.38, 0.62, d);
        float far = length(vW.xz) / 400.0; vec3 c = mix(uD, uL, lit) * (0.55 + 0.6 * d);
        vec3 v = normalize(vW - cameraPosition); c += uSC * pow(max(dot(v, uS), 0.0), 12.0) * 0.6 * cov;
        c = mix(c, uH, smoothstep(0.05, 0.6, far)); gl_FragColor = vec4(c, cov * smoothstep(1.0, 0.7, far)); }` }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -4; sea.renderOrder = -1; g.add(sea);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ...u, uI: { value: i } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uL, uD, uH; uniform float uI, uT; varying vec2 vU; ${NZ}
        void main(){ vec2 p = vU * vec2(9.0, 2.2) + uI * 7.3 + vec2(uT * 0.01, 0.0); float d = fbm(p) * smoothstep(0.0, 0.35, vU.y) * smoothstep(1.0, 0.25, vU.y);
          float a = smoothstep(0.22, 0.5, d); vec3 c = mix(uD, uL, smoothstep(0.3, 0.7, vU.y + d * 0.4)); c = mix(c, uH, 0.25 + 0.15 * uI);
          gl_FragColor = vec4(c, a * (0.9 - uI * 0.15)); }` }));
    const a = -0.9 + i * 0.55; m.position.set(Math.sin(a) * (120 + i * 40), 2 + i * 3, -Math.cos(a) * (120 + i * 40)); m.lookAt(0, 2 + i * 3, 0);
    m.renderOrder = -1; g.add(m);
  }
  return g;
}

/** PMREM environment captured from the sky world, so reflections carry the same dusk. */
export function skyEnv(r: THREE.WebGLRenderer, world: THREE.Object3D) {
  const s = new THREE.Scene(); s.add(world.clone());
  const pm = new THREE.PMREMGenerator(r); const tex = pm.fromScene(s, 0.02, 0.1, 1000).texture; pm.dispose(); r.resetState();
  return tex;
}

/** Frees the geometry and materials of every mesh under root. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.geometry.dispose(); for (const x of ([] as THREE.Material[]).concat(m.material)) x.dispose(); });
}

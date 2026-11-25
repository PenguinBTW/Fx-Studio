// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// inkwell — diffusion register: a drop of black ink in still backlit water.
// The plume descends, mushrooms, and blooms into domain-warped veining until
// the water itself is ink — entropy as lace. The catalog has fluid as material
// (mercury) but nothing about mixing: the interface where order dissolves.
// Two parallax ink slabs with domain-warped fbm density, luminous backlight,
// all closed-form in t. Zero Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

const NOISE_GLSL = `
vec3 mod289v3(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289v2(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute3(vec3 x){ return mod289v3(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ f += a * snoise(p); p = p * 2.03 + vec2(17.3, 9.1); a *= 0.5; }
  return f;
}`;

export default class Inkwell extends Scene {
  private cam = new THREE.PerspectiveCamera(36, W / H, 0.02, 60);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private slabs: THREE.ShaderMaterial[] = [];
  private slabMeshes: THREE.Mesh[] = [];
  private bgMat: THREE.ShaderMaterial | null = null;
  private bgMesh: THREE.Mesh | null = null;

  override async init() {
    // luminous backlight volume behind the water
    this.bgMat = new THREE.ShaderMaterial({
      uniforms: { uDensity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv;
        uniform float uDensity;
        uniform float uTime;
        void main(){
          // luminous teal-white water, dimming as ink density grows
          float glow = 1.0 - length(vUv - 0.5) * 0.9;
          vec3 water = mix(vec3(0.10, 0.16, 0.19), vec3(0.55, 0.72, 0.75), glow);
          // faint surface glint band at the top, gone once ink rises
          float glint = (1.0 - smoothstep(0.86, 0.98, vUv.y)) * smoothstep(0.80, 0.88, vUv.y);
          water += glint * 0.2 * (1.0 - uDensity) * (0.7 + 0.3 * sin(uTime * 0.9 + vUv.x * 20.0));
          water *= 1.0 - uDensity * 0.75;
          gl_FragColor = vec4(water, 1.0);
        }`,
    });
    this.bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), this.bgMat);
    this.bgMesh.position.z = -2.4;
    this.world.add(this.bgMesh);

    // two parallax ink slabs — domain-warped fbm density, closed-form bloom
    for (let layer = 0; layer < 2; layer++) {
      const zOff = -0.7 - layer * 0.8;
      const scale = 1.0 + layer * 0.35;
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uLayer: { value: layer },
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `${NOISE_GLSL}
        varying vec2 vUv;
        uniform float uTime;
        uniform float uLayer;
        void main(){
          // aspect-corrected centered coords, y down-positive for the plume
          vec2 p = (vUv - 0.5) * vec2(2.6, 1.5) * ${scale.toFixed(2)};
          p.y = -p.y;
          float t = uTime;

          // ---- plume envelope: drop strikes at t=3, descends, mushrooms, blooms ----
          float strike = 3.0;
          // plume head depth: descends fast then slows to rest
          float fallT = max(0.0, t - strike);
          float headY = -0.75 + 1.35 * (1.0 - exp(-fallT * 0.55));
          // radial spread grows after the fall slows; bloom lace beyond 15s
          float spread = 0.10 + 0.30 * smoothstep(0.0, 6.0, fallT) + 0.75 * smoothstep(6.0, 20.0, fallT);
          // density source center drifts downward slightly with layer parallax
          vec2 c = vec2(0.0, headY - uLayer * 0.05);
          vec2 q = p - c;
          float r = length(q);

          // ---- domain-warped lace: warp amplitude grows with bloom ----
          float warpAmp = 0.25 + 0.85 * smoothstep(4.0, 16.0, fallT);
          // closed-form slow turbulent advection — swirl around the plume center
          float ang = atan(q.y, q.x);
          float swirl = 0.22 * smoothstep(3.0, 10.0, fallT) * exp(-r * 1.6) * fallT * 0.35;
          vec2 q2 = vec2(cos(ang + swirl), sin(ang + swirl)) * r;
          vec2 warp = vec2(fbm(q2 * 2.6 + vec2(0.0, fallT * 0.13)), fbm(q2 * 2.6 + vec2(5.2, -fallT * 0.11)));
          vec2 lac = q2 * (3.1 + uLayer * 0.7) + warp * warpAmp;

          float lace = fbm(lac * 1.7 + vec2(uLayer * 3.7, fallT * 0.05));
          // vein thresholding — sharper edges as the bloom matures
          float vein = smoothstep(0.12, 0.42, lace + 0.5);

          // plume envelope: radial falloff around center, denser core early
          float env = (1.0 - smoothstep(spread * 0.25, spread, r));
          // mushroom cap: toroidal density enhancement during 5-12s
          float capT = smoothstep(2.0, 5.0, fallT) * (1.0 - smoothstep(6.0, 12.0, fallT));
          float ring = exp(-pow((r - spread * 0.55) * 7.0, 2.0)) * capT * step(0.0, q.y + 0.1);
          float density = clamp(env * (0.3 + vein * 1.15) + ring * vein * 1.1, 0.0, 1.0);

          // overall fade-in from the strike, plus global saturation at the end
          density *= smoothstep(0.0, 0.5, fallT + 0.001);
          // ink is near-black against the light; alpha is occlusion
          float alpha = clamp(density * (0.9 + uLayer * 0.1), 0.0, 0.96);
          gl_FragColor = vec4(vec3(0.012, 0.015, 0.02), alpha);
        }`,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 3.7), mat);
      mesh.position.z = zOff;
      mesh.renderOrder = 1 + layer;
      this.slabs.push(mat);
      this.slabMeshes.push(mesh);
      this.world.add(mesh);
    }

    this.rig.setLensMm(36);
    this.rig.handheld({ weight: 0.3, posAmp: 0.008, rotAmp: 0.0018, seed: 5 });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // camera first — frame-order independence: near-static, slow push-in
    const push = smoothstep(0, 28, lt) * 0.5;
    this.rig.orbit([0, -0.05, -1.2], 3.6 - push, 0.1 + lt * 0.002, 0.02 + lt * 0.004);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);

    const fallT = Math.max(0, lt - 3);
    const density = smoothstep(4, 24, fallT);
    for (const m of this.slabs) m.uniforms.uTime.value = lt;
    this.bgMat!.uniforms.uDensity.value = density;
    this.bgMat!.uniforms.uTime.value = lt;

    // nothing writes depth — render direct (documented all-additive/alpha pattern)
    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    // exposure falls as the water inks over
    return { exposure: 1.05 - density * 0.3, bloom: 0.15, vignette: 0.42 } as PostOverrides;
  }

  override dispose() {
    for (const m of this.slabs) m.dispose();
    for (const mm of this.slabMeshes) mm.geometry.dispose();
    this.bgMat?.dispose();
    this.bgMesh?.geometry.dispose();
  }
}

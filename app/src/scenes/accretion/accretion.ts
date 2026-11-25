// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// accretion — celestial/orbital register: a proto-planetary disk in honest
// Keplerian shear. 20,000 dust grains orbit a white-hot core, each on a
// closed-form orbit with ω ∝ r^-1.5 — inner bands visibly lap outer ones.
// Mid-scene a clump coalesces at mid-radius and shepherds a gap in its lane.
// The catalog has nothing at cosmic scale; here gravity itself is the
// choreographer. Zero Math.random — every grain seeded by deterministic hash.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

const CLUMP_R = 2.3;      // clump orbital radius
const CLUMP_W = Math.pow(CLUMP_R, -1.5) * 2.2; // its angular velocity

export default class Accretion extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 200);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private dustMat: THREE.ShaderMaterial | null = null;
  private dustGeo: THREE.BufferGeometry | null = null;
  private coreMat: THREE.ShaderMaterial | null = null;
  private coreMesh: THREE.Mesh | null = null;
  private clumpMat: THREE.ShaderMaterial | null = null;
  private clumpMesh: THREE.Mesh | null = null;

  override async init() {
    // ---- dust: 20k grains, positions fully GPU-computed closed-form ----
    const N = 20000;
    const seeds = new Float32Array(N * 4);
    const pos = new Float32Array(N * 3); // dummy — real position in shader
    for (let i = 0; i < N; i++) {
      const h1 = Math.sin(i * 127.1 + 11.3) * 43758.5453; const r1 = h1 - Math.floor(h1);
      const h2 = Math.sin(i * 269.5 + 31.7) * 28001.8384; const r2 = h2 - Math.floor(h2);
      const h3 = Math.sin(i * 419.2 + 57.1) * 31741.2961; const r3 = h3 - Math.floor(h3);
      const h4 = Math.sin(i * 587.9 + 83.9) * 19217.2741; const r4 = h4 - Math.floor(h4);
      // radius: concentrate in bands — base radius 1.2..4.2 with banding modulation
      seeds[i * 4] = r1;          // radius fraction
      seeds[i * 4 + 1] = r2;      // initial angle
      seeds[i * 4 + 2] = r3;      // vertical offset / thickness fraction
      seeds[i * 4 + 3] = r4;      // brightness / size variation
    }
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGap: { value: 0 },   // gap-opening progress 0..1
      },
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uGap;
        varying float vBright;
        varying float vFade;
        void main() {
          // radius 1.2..4.2 with banding: grains cluster into lanes
          float banded = aSeed.x + 0.08 * sin(aSeed.x * 40.0);
          float r = 1.2 + banded * 3.0;
          // Keplerian angular velocity — inner lanes lap outer ones
          float w = 2.2 * pow(r, -1.5);
          float theta = aSeed.y * 6.28318 + w * uTime;
          // disk thickness: vertical offset scaling with radius, plus slow bob
          float thick = 0.04 + r * 0.03;
          float y = (aSeed.z - 0.5) * 2.0 * thick * sin(theta * 0.5 + aSeed.z * 9.0);
          vec3 p = vec3(cos(theta) * r, y, sin(theta) * r);
          // shepherd gap: grains near the clump's lane fade as the gap opens
          float gapDist = abs(r - ${CLUMP_R.toFixed(2)});
          float gapWidth = 0.16 + uGap * 0.1;
          float inGap = 1.0 - smoothstep(gapWidth, gapWidth + 0.12, gapDist);
          vFade = 1.0 - inGap * uGap * 0.92;
          // illumination: 1/r² starlight with per-grain variation
          vBright = (0.35 + aSeed.w * 0.65) * 1.5 / (r * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min((1.1 + aSeed.w * 1.8) * 320.0 / max(1.0, -mv.z * 60.0), 7.0);
        }`,
      fragmentShader: `
        varying float vBright;
        varying float vFade;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float a = (1.0 - smoothstep(0.12, 0.5, d)) * vBright * vFade;
          if (a < 0.004) discard;
          // starlight-white warming to dust-amber at radius
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.6) * a, a);
        }`,
    });
    const dust = new THREE.Points(this.dustGeo, this.dustMat);
    dust.frustumCulled = false; // GPU-computed positions — bounding sphere is meaningless
    dust.renderOrder = 1;
    this.world.add(dust);

    // ---- core: layered additive glow billboards — the star itself ----
    this.coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv * 2.0 - 1.0;
          // camera-facing billboard
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec4 w = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          w.xyz += right * position.x + up * position.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          float d = length(vUv);
          float core = exp(-d * d * 38.0) * 1.5;
          float halo = exp(-d * 3.2) * 0.35;
          float flicker = 1.0 + 0.05 * sin(uTime * 7.3) * sin(uTime * 3.1);
          vec3 col = (core * vec3(1.0, 0.97, 0.92) + halo * vec3(1.0, 0.72, 0.42)) * flicker;
          gl_FragColor = vec4(col, min(1.0, core + halo));
        }`,
    });
    this.coreMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), this.coreMat);
    this.coreMesh.frustumCulled = false;
    this.coreMesh.renderOrder = 2;
    this.world.add(this.coreMesh);

    // ---- the clump: a bright knot coalescing at mid-radius ----
    this.clumpMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uForm: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          vUv = uv * 2.0 - 1.0;
          float theta = 1.8 + ${CLUMP_W.toFixed(4)} * uTime;
          vec3 center = vec3(cos(theta) * ${CLUMP_R.toFixed(2)}, 0.02, sin(theta) * ${CLUMP_R.toFixed(2)});
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
          vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec4 w = vec4(center, 1.0);
          w.xyz += right * position.x * 0.5 + up * position.y * 0.5;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uForm;
        void main() {
          float d = length(vUv);
          float body = exp(-d * d * 20.0) * 1.6;
          float haze = exp(-d * 2.6) * 0.3;
          vec3 col = (body * vec3(1.0, 0.85, 0.62) + haze * vec3(0.9, 0.6, 0.35)) * uForm;
          gl_FragColor = vec4(col, min(1.0, (body + haze) * uForm));
        }`,
    });
    this.clumpMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.clumpMat);
    this.clumpMesh.frustumCulled = false;
    this.clumpMesh.renderOrder = 2;
    this.world.add(this.clumpMesh);

    this.rig.handheld({ weight: 0.25, posAmp: 0.01, rotAmp: 0.0015, seed: 11 });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // camera first — frame-order independence
    const form = smoothstep(15, 24, lt);
    const pitch = 0.55 - lt * 0.005;
    const yaw = 0.4 + lt * 0.017;
    this.rig.orbit([0, 0, 0], 5.6, pitch, yaw);
    const camSpec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(camSpec, this.cam);

    this.dustMat!.uniforms.uTime.value = lt;
    this.dustMat!.uniforms.uGap.value = form;
    this.coreMat!.uniforms.uTime.value = lt;
    this.clumpMat!.uniforms.uTime.value = lt;
    this.clumpMat!.uniforms.uForm.value = form;

    // focus: the clump once formed, the bright mid-band before
    const ctheta = 1.8 + CLUMP_W * lt;
    const focusPt: [number, number, number] = form > 0.4
      ? [Math.cos(ctheta) * CLUMP_R, 0, Math.sin(ctheta) * CLUMP_R]
      : [CLUMP_R * 0.7, 0, 0];
    const focusD = this.rig.focusDistance(focusPt);

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: false,
      focusDistance: Math.max(0.5, focusD),
      aperture: 4,
      maxRadius: 8,
      samples: 16,
      near: 0.05,
      far: 200,
    }, out);
    rr.resetState();
    return { exposure: 1.05, bloom: 0.0, vignette: 0.35 } as PostOverrides;
  }

  override dispose() {
    this.dustGeo?.dispose();
    this.dustMat?.dispose();
    this.coreMesh?.geometry.dispose();
    this.coreMat?.dispose();
    this.clumpMesh?.geometry.dispose();
    this.clumpMat?.dispose();
    this.main?.dispose();
    this.dof.dispose?.();
  }
}

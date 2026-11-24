// brookside — an autumn woodland brook sliding under a mossy stone
// footbridge. The water is the actor: flowing streak normals catch the low
// sun, foam traces around the hero bed stones, leaves ride the current.
// All motion closed-form f(t): drift, spin, shafts, mist, camera. No sim.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp, lerp } from '../../engine/util';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';

const TAU = Math.PI * 2;

// hero bed stones (positions match build.py) — the water shader foams here
const HERO_STONES = [
  new THREE.Vector3(-1.1, 0, -4.5),
  new THREE.Vector3(1.4, 0, -1.0),
  new THREE.Vector3(-0.4, 0, 2.8),
  new THREE.Vector3(0.9, 0, 6.2),
];

// sun direction: low warm light from the right bank, raking downstream
const SUN_DIR = new THREE.Vector3(0.55, 0.42, -0.35).normalize();

// dappled shafts through the canopy — narrower than vaulted's, tilted
const SHAFT_DIR = new THREE.Vector3(-0.35, -1.0, 0.18).normalize();
const SHAFTS = [
  { apex: new THREE.Vector3(-2.6, 8.5, -7.5), len: 10.5, r0: 0.22, r1: 0.9, ph: 0.0 },
  { apex: new THREE.Vector3(1.8, 8.8, -3.0), len: 11.0, r0: 0.30, r1: 1.1, ph: 1.7 },
  { apex: new THREE.Vector3(-1.2, 8.6, 2.5), len: 10.5, r0: 0.24, r1: 0.85, ph: 3.1 },
  { apex: new THREE.Vector3(2.8, 8.4, 7.0), len: 10.0, r0: 0.18, r1: 0.7, ph: 4.6 },
];

// camera: low over the brook, slow drift toward the arch — gaze under the
// keystone so the far glow holds the depth cue
const camAt = (t: number) => {
  const z = -14.5 + t * 0.28;
  const x = -1.4 + Math.sin(t * 0.13) * 0.35;
  const y = 1.55 + t * 0.025 + Math.sin(t * 0.4) * 0.03;
  const aim = new THREE.Vector3(
    0.3 + Math.sin(t * 0.1) * 0.25,
    2.6 + clamp((t - 3) / 12, 0, 1) * 1.0,
    0.5,
  );
  return { pos: new THREE.Vector3(x, y, z), target: aim, fov: 44 };
};

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHAFT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vN;
out vec4 fragColor;
uniform float uI;
void main() {
  float along = vUv.y;                          // 1 at the canopy gap, 0 at water
  float body = pow(along, 1.4);
  body *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
  float rim = pow(abs(normalize(vN).z), 0.7);
  float striae = 0.55 + 0.45 * sin(vUv.x * 22.0 + vUv.y * 9.0);
  float a = body * rim * striae * uI;
  vec3 col = vec3(0.98, 0.82, 0.52) * a;        // warm late-day gold
  fragColor = vec4(col, a);
}`;

// water surface: streaked flow normals + sun specular + fresnel sky +
// foam traced around hero stones + lace at the banks + bed show-through
const WATER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vWp;
in vec3 vNv;
out vec4 fragColor;
uniform float uT;
uniform vec3 uSunDir;
uniform vec3 uSky;
uniform vec3 uStone[4];

float streak(vec2 p, float f, float sp) {
  // pattern axis along p.y (world -z): +uT slides the field down-brook
  return sin(p.y * f + sin(p.x * 2.0 + uT * sp * 0.35) * 2.2 + uT * sp);
}

void main() {
  // world-plane coords; flow toward -z (down-brook, toward camera)
  vec2 p = vec2(vWp.x * 0.35, vWp.z * 1.7);
  float s1 = streak(p, 6.0, 1.15);
  float s2 = streak(p + vec2(3.7, 9.2), 11.0, 1.8);
  float s3 = sin(p.y * 2.2 + uT * 0.5 + sin(p.x * 5.0) ) * 0.5;
  // pseudo-normal from the streak field: tilt the surface normal
  vec2 g = vec2(s1 * 0.35 + s2 * 0.22, s1 * 0.12 + s3 * 0.3);
  vec3 n = normalize(vec3(g.x, 1.0, g.y));

  vec3 viewDir = normalize(cameraPosition - vWp);
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);
  vec3 deep = vec3(0.028, 0.048, 0.038);        // peaty bed water
  vec3 col = mix(deep, uSky, fres * 0.30);

  // sun specular dancing on the streaks
  vec3 hv = normalize(viewDir + uSunDir);
  float spec = pow(max(dot(n, hv), 0.0), 90.0);
  col += vec3(1.0, 0.82, 0.5) * spec * (0.55 + 0.45 * s1) * 1.3;

  // foam lace traced around each hero stone + bank edges
  float foam = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = distance(vWp.xz, uStone[i].xz);
    float ring = (1.0 - smoothstep(0.55, 0.85, d)) * smoothstep(0.18, 0.45, d);
    // stretch the ring downstream — wake reads flow
    ring *= 0.6 + 0.4 * sin(vWp.z * 14.0 + uT * 2.2 + float(i) * 2.0);
    foam += ring;
  }
  float lace = (1.0 - smoothstep(0.0, 0.7, abs(abs(vWp.x) - 3.55)))
             * (0.5 + 0.5 * sin(vWp.z * 9.0 + uT * 1.6 + vWp.x * 5.0));
  foam += lace * 0.35;
  foam = clamp(foam, 0.0, 1.0);
  col = mix(col, vec3(0.75, 0.78, 0.72), foam * 0.55);

  // bed show-through: near stones + shallow edges the water goes clearer
  float shallow = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = distance(vWp.xz, uStone[i].xz);
    shallow += 1.0 - smoothstep(0.3, 1.3, d);
  }
  shallow += smoothstep(2.9, 3.7, abs(vWp.x));
  float alpha = clamp(0.88 - clamp(shallow, 0.0, 1.0) * 0.45, 0.42, 0.92);
  fragColor = vec4(col, alpha);
}`;

const WATER_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWp;
varying vec3 vNv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vNv = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export default class BrooksideScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(44, W / H, 0.05, 400);
  private brook!: GLTFInstance;
  private ownMats!: Map<THREE.Material, THREE.Material>;
  private shaftGroup = new THREE.Group();
  private shaftMats: THREE.ShaderMaterial[] = [];
  private poolMats: THREE.ShaderMaterial[] = [];
  private waterMat!: THREE.ShaderMaterial;
  private waterMesh!: THREE.Mesh;
  private leaves!: THREE.InstancedMesh;
  private leafSeed!: Float32Array;
  private leafShadows!: THREE.InstancedMesh;
  private leafTex!: THREE.Texture;
  private motes!: THREE.Points;
  private moteSeed!: Float32Array;
  private moteSprite!: THREE.Texture;
  private mistMats: THREE.ShaderMaterial[] = [];
  private mistMeshes: THREE.Mesh[] = [];
  private skyGlow!: THREE.Mesh;
  private p = new THREE.Vector3();

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(0x0a0e08), 0.020);
    this.scene3D.background = new THREE.Color(0x0a0d07);

    // --- Blender-built brook kit (assets/brook)
    this.brook = await GLTFManager.instantiate(resolveAsset('brook', 'brookside').url, {});
    this.ownMats = new Map();
    const own = this.ownMats;
    this.brook.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mine = (x: THREE.Material) => {
          let c = own.get(x);
          if (!c) own.set(x, (c = x.clone()));
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(mine) : mine(m.material);
      }
    });
    this.scene3D.add(this.brook.root);
    // hard facets sell the stonework
    for (const part of ['bridge', 'bed', 'stones']) {
      const node = this.brook.node(part);
      if (node) {
        node.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && m.material instanceof THREE.MeshStandardMaterial) {
            const fm = m.material.clone();
            fm.flatShading = true;
            m.material = fm;
            this.ownMats.set(fm, fm);
          }
        });
      }
    }

    // --- lighting: warm low sun + cool shade fills
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(0x2a2e20), 0.6));
    const sun = new THREE.DirectionalLight(
      new THREE.Color(...blackbodyToLinearSRGB(3400)), 3.2);
    sun.position.copy(SUN_DIR).multiplyScalar(30);
    this.scene3D.add(sun);
    const bounce = new THREE.DirectionalLight(new THREE.Color(0x2e3626), 0.4);
    bounce.position.set(0, -8, 4);
    this.scene3D.add(bounce);
    const fill = new THREE.DirectionalLight(new THREE.Color(0x3a4430), 0.5);
    fill.position.set(-12, 4, -10);
    this.scene3D.add(fill);
    // warm edge from beyond the far canopy — rim on the arch
    const edge = new THREE.DirectionalLight(new THREE.Color(0x8a7a4a), 0.9);
    edge.position.set(-2, 8, 30);
    this.scene3D.add(edge);
    // low warm graze inside the arch mouth — defines the intrados curve
    // against the pale gap behind
    const mouth = new THREE.PointLight(
      new THREE.Color(...blackbodyToLinearSRGB(3000)), 26, 14, 1.6);
    mouth.position.set(0.5, 2.4, 5.0);
    this.scene3D.add(mouth);
    // dark underpass behind the arch — the opening reads as a tunnel
    // mouth, not a bright gap
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 6.5),
      new THREE.MeshBasicMaterial({ color: 0x080906 }));
    under.position.set(0, 3.0, 6.5);
    under.rotation.y = Math.PI;
    this.scene3D.add(under);

    // --- water surface
    const waterGeo = new THREE.PlaneGeometry(8.4, 46, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uT: { value: 0 },
        uSunDir: { value: SUN_DIR },
        uSky: { value: new THREE.Color(0.16, 0.15, 0.10) },
        uStone: { value: HERO_STONES },
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh.position.y = 0.12;
    this.scene3D.add(this.waterMesh);

    // --- dappled shafts through the canopy (dual shell, warm gold)
    for (const s of SHAFTS) {
      const geo = new THREE.CylinderGeometry(s.r0, s.r1, s.len, 20, 1, true);
      geo.translate(0, -s.len / 2, 0);
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.3 } },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.copy(s.apex);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), SHAFT_DIR);
      this.shaftGroup.add(cone);
      this.shaftMats.push(mat);
      const coreGeo = new THREE.CylinderGeometry(s.r0 * 0.5, s.r1 * 0.45, s.len * 0.96, 16, 1, true);
      coreGeo.translate(0, -s.len * 0.48, 0);
      const coreMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.3 } },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(s.apex);
      core.quaternion.copy(cone.quaternion);
      this.shaftGroup.add(core);
      this.shaftMats.push(coreMat);
    }
    this.scene3D.add(this.shaftGroup);

    // --- light pools where the shafts land (fixed on the water/bank)
    for (const s of SHAFTS) {
      const poolGeo = new THREE.CircleGeometry(s.r1 * 0.9, 20);
      poolGeo.rotateX(-Math.PI / 2);
      const poolMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.4 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          in vec2 vUv;
          out vec4 fragColor;
          uniform float uI;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            // dappled edge — the pool breaks up like light through leaves
            float dap = 0.65 + 0.35 * sin(vUv.x * 30.0) * sin(vUv.y * 27.0);
            float a = (1.0 - smoothstep(0.15, 1.0, d)) * uI * dap;
            fragColor = vec4(vec3(0.95, 0.78, 0.45) * a, a);
          }`,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false,
      });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.copy(s.apex).addScaledVector(SHAFT_DIR, s.len);
      pool.position.y = Math.max(pool.position.y, 0.16);
      this.scene3D.add(pool);
      this.poolMats.push(poolMat);
    }

    // --- maple leaves riding the current: instanced quads + faked shadows
    const leafN = 20;
    this.leafSeed = new Float32Array(leafN * 4);  // lane x, z-phase, spin, hue
    for (let i = 0; i < leafN; i++) {
      this.leafSeed[i * 4] = Math.sin(i * 7.3) * 2.4;
      this.leafSeed[i * 4 + 1] = (i * 0.618) % 1;
      this.leafSeed[i * 4 + 2] = 1.5 + (i % 5) * 0.7;
      this.leafSeed[i * 4 + 3] = (i % 4) / 3;
    }
    const lcv = document.createElement('canvas');
    lcv.width = lcv.height = 32;
    const lctx = lcv.getContext('2d')!;
    // simple maple-ish star leaf
    lctx.translate(16, 16);
    lctx.fillStyle = '#b4551e';
    lctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = k * Math.PI / 5;
      const r = k % 2 === 0 ? 14 : 6;
      lctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    lctx.closePath(); lctx.fill();
    this.leafTex = new THREE.CanvasTexture(lcv);
    const leafGeo = new THREE.PlaneGeometry(0.75, 0.75);
    leafGeo.rotateX(-Math.PI / 2);
    const leafMat = new THREE.MeshBasicMaterial({
      map: this.leafTex, transparent: true, alphaTest: 0.35,
      side: THREE.DoubleSide, fog: true,
    });
    this.leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafN);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // instanceMatrix updates every frame — cached bounds would go stale
    this.leaves.frustumCulled = false;
    for (let i = 0; i < leafN; i++) {
      const hue = this.leafSeed[i * 4 + 3];
      const c = new THREE.Color().setHSL(0.06 + hue * 0.05, 0.75, 0.32 + hue * 0.15);
      this.leaves.setColorAt(i, c);
    }
    this.scene3D.add(this.leaves);
    // dark shadow discs on the bed under each leaf — sells the shallow water
    const shGeo = new THREE.CircleGeometry(0.2, 10);
    shGeo.rotateX(-Math.PI / 2);
    const shMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.4,
      depthWrite: false,
    });
    this.leafShadows = new THREE.InstancedMesh(shGeo, shMat, leafN);
    this.leafShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.leafShadows.frustumCulled = false;
    this.scene3D.add(this.leafShadows);

    // --- sun-lit motes inside the shafts
    const moteN = 80;
    const motePos = new Float32Array(moteN * 3);
    this.moteSeed = new Float32Array(moteN * 4);
    for (let i = 0; i < moteN; i++) {
      this.moteSeed[i * 4] = i % SHAFTS.length;
      this.moteSeed[i * 4 + 1] = (i * 7.31) % 1;
      this.moteSeed[i * 4 + 2] = Math.abs(Math.sin(i * 3.7)) * 0.8;
      this.moteSeed[i * 4 + 3] = i * 2.399;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    const mcv = document.createElement('canvas');
    mcv.width = mcv.height = 16;
    const mctx = mcv.getContext('2d')!;
    const grd = mctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grd.addColorStop(0, 'rgba(255,240,210,1)');
    grd.addColorStop(1, 'rgba(255,240,210,0)');
    mctx.fillStyle = grd; mctx.fillRect(0, 0, 16, 16);
    this.moteSprite = new THREE.CanvasTexture(mcv);
    const moteMat = new THREE.PointsMaterial({
      map: this.moteSprite, size: 0.05, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      color: new THREE.Color(0xffe6b0),
    });
    this.motes = new THREE.Points(moteGeo, moteMat);
    this.motes.frustumCulled = false;
    this.scene3D.add(this.motes);

    // --- mist ribbons hugging the water downstream
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(9, 2.2, 1, 1);
      geo.rotateX(-Math.PI / 2 - 0.15);
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uT: { value: 0 }, uPh: { value: i * 2.1 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          in vec2 vUv;
          out vec4 fragColor;
          uniform float uT;
          uniform float uPh;
          void main() {
            float w = sin(vUv.x * 9.0 + uT * 0.3 + uPh) * 0.5 + 0.5;
            float a = (1.0 - abs(vUv.y - 0.5) * 2.0)
                    * smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x))
                    * (0.10 + 0.08 * w);
            fragColor = vec4(vec3(0.75, 0.8, 0.72) * a, a);
          }`,
        transparent: true, blending: THREE.NormalBlending,
        depthWrite: false, fog: false,
      });
      const mist = new THREE.Mesh(geo, mat);
      mist.position.set(i - 1, 0.7 + i * 0.25, 8 + i * 6);
      this.scene3D.add(mist);
      this.mistMats.push(mat);
      this.mistMeshes.push(mist);
    }

    // --- warm sky glow behind the far canopy
    const skyGeo = new THREE.PlaneGeometry(60, 20);
    const skyMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;
        void main() {
          vec3 top = vec3(0.38, 0.30, 0.15);
          vec3 bot = vec3(0.12, 0.10, 0.06);
          vec3 c = mix(bot, top, pow(vUv.y, 1.5));
          float edge = smoothstep(0.0, 0.2, vUv.x) * (1.0 - smoothstep(0.8, 1.0, vUv.x));
          fragColor = vec4(c * edge, edge);
        }`,
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    this.skyGlow = new THREE.Mesh(skyGeo, skyMat);
    this.skyGlow.position.set(0, 11, 26);
    this.scene3D.add(this.skyGlow);

    // dark backdrop low behind the bridge — the under-arch view reads as
    // shadowed channel running on, not pale sky
    const backGeo = new THREE.PlaneGeometry(50, 7);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x0b0d08, fog: false });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, 2.2, 25.5);
    this.scene3D.add(back);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;

    const cam = camAt(t);
    this.camera3D.aspect = out.width / out.height;
    this.camera3D.fov = cam.fov;
    this.camera3D.position.copy(cam.pos);
    this.camera3D.lookAt(cam.target);
    this.camera3D.updateProjectionMatrix();

    // shaft intensity arc: faint → dappled (6-14) → ease back
    const env = clamp(t / 6, 0, 1) * (1 - clamp((t - 15) / 5, 0, 1) * 0.4);
    for (let i = 0; i < this.shaftMats.length; i++) {
      const isCore = i % 2 === 1;
      const ph = SHAFTS[Math.floor(i / 2)].ph;
      this.shaftMats[i].uniforms.uI.value =
        ((isCore ? 0.34 : 0.14) + 0.05 * Math.sin(t * 0.5 + ph)) * (0.5 + 0.5 * env);
    }
    for (let i = 0; i < this.poolMats.length; i++) {
      this.poolMats[i].uniforms.uI.value =
        (0.34 + 0.05 * Math.sin(t * 0.5 + SHAFTS[i].ph)) * (0.4 + 0.6 * env);
    }
    this.shaftGroup.rotation.z = 0.018 * Math.sin(t * 0.35);
    this.shaftGroup.rotation.x = 0.013 * Math.sin(t * 0.27 + 1.3);

    // water flow
    this.waterMat.uniforms.uT.value = t;

    // leaves: closed-form drift toward camera (-z), wobble + spin + bob
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3(1, 1, 1);
    const leafN = this.leafSeed.length / 4;
    for (let i = 0; i < leafN; i++) {
      const lx = this.leafSeed[i * 4];
      const ph = this.leafSeed[i * 4 + 1];
      const spin = this.leafSeed[i * 4 + 2];
      const u = (ph + t * 0.045) % 1;                    // one traverse ≈ 22s
      const z = 14 - u * 34;                             // +z → -z flow
      const x = lx + Math.sin(u * 9 + i) * 0.55;
      const y = 0.16 + Math.sin(u * 30 + i * 2) * 0.025;
      e.set(0.06 * Math.sin(u * 12 + i), u * spin * TAU + i, 0.05 * Math.sin(u * 15 + i * 3));
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, sc);
      this.leaves.setMatrixAt(i, m);
      // shadow on the bed, offset slightly upstream (low sun from +z side)
      m.compose(new THREE.Vector3(x + 0.1, 0.135, z + 0.18), new THREE.Quaternion(), sc);
      this.leafShadows.setMatrixAt(i, m);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    this.leafShadows.instanceMatrix.needsUpdate = true;

    // motes drifting down inside the shafts
    const dp = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.moteSeed.length / 4; i++) {
      const s = SHAFTS[this.moteSeed[i * 4]];
      const ph = this.moteSeed[i * 4 + 1];
      const rr = this.moteSeed[i * 4 + 2];
      const ang = this.moteSeed[i * 4 + 3];
      const u = (ph + t * 0.04) % 1;
      const spread = s.r0 + (s.r1 - s.r0) * u * 0.85;
      const off = new THREE.Vector3(
        Math.cos(ang + t * 0.3) * rr * spread, 0,
        Math.sin(ang + t * 0.3) * rr * spread);
      const base = s.apex.clone().addScaledVector(SHAFT_DIR, u * s.len);
      dp.setXYZ(i, base.x + off.x, base.y + off.y, base.z + off.z);
    }
    dp.needsUpdate = true;

    // mist breathing + slow slide downstream (-z, with the current)
    for (let i = 0; i < this.mistMats.length; i++) {
      this.mistMats[i].uniforms.uT.value = t;
      this.mistMeshes[i].position.z =
        (8 + i * 6) + Math.sin(t * 0.12 + i * 2.1) * 1.8 - (t * 0.05 % 2.0);
    }

    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    // probes: the arch + a hero stone on the water, world-projected
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const Wd = P.width || 1920, Hd = P.height || 1080;
        const boxAt = (c: THREE.Vector3, sx: number, sy: number) => {
          this.p.copy(c).project(this.camera3D);
          const cx = (this.p.x * 0.5 + 0.5) * Wd, cy = (0.5 - this.p.y * 0.5) * Hd;
          return { bbox: [cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2] as number[], w: sx, h: sy, cx, cy };
        };
        const ab = boxAt(new THREE.Vector3(0, 4.2, 0), 340, 160);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'bridge arch',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#d8c9a0', globalAlpha: 0.85, layerId: 'brookside',
          bbox: ab.bbox, w: ab.w, h: ab.h, cx: ab.cx, cy: ab.cy,
          hPct: (ab.h / Hd) * 100, isStroke: false,
        });
        const wb = boxAt(HERO_STONES[1], 110, 70);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'foam line',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#cfd8c8', globalAlpha: 0.85, layerId: 'brookside',
          bbox: wb.bbox, w: wb.w, h: wb.h, cx: wb.cx, cy: wb.cy,
          hPct: (wb.h / Hd) * 100, isStroke: false,
        });
      }
    }

    return {
      exposure: 1.02,
      bloom: 0.42,
      bloomThreshold: 0.7,
      bloomRadius: 0.55,
      vignette: 0.34,
      grain: 0.05,
      ca: 0.2,
      fade: lerp(1, 0, clamp(t / 0.5)),
    } as PostOverrides;
  }

  override dispose(): void {
    this.brook.dispose();
    for (const m of this.ownMats.values()) m.dispose();
    for (const m of this.shaftMats) m.dispose();
    for (const m of this.poolMats) m.dispose();
    for (const m of this.mistMats) m.dispose();
    this.motes.geometry.dispose();
    (this.motes.material as THREE.Material).dispose();
    this.moteSprite.dispose();
    // InstancedMesh.dispose() frees the instanceMatrix/instanceColor buffers
    this.leaves.dispose();
    this.leaves.geometry.dispose();
    (this.leaves.material as THREE.Material).dispose();
    this.leafShadows.dispose();
    this.leafShadows.geometry.dispose();
    (this.leafShadows.material as THREE.Material).dispose();
    this.leafTex.dispose();
    this.waterMesh.geometry.dispose();
    this.waterMat.dispose();
    this.scene3D.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
      }
    });
  }
}

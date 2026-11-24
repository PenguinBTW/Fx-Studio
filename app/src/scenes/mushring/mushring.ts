// mushring — forest-floor macro at dusk: a fairy ring of mushrooms in one
// raking shaft of last light. Macro lens: shallow real DoF, slow lateral
// dolly, fireflies through the beam.
//
// The floor kit is Blender-built (assets/floor): lathed agaric/boletus caps
// with gill slats + wart speckles, an oyster-free ring, dew spider web,
// mossy log + snail, ferns, blades, litter.
import * as THREE from 'three';
import { Scene, PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { GLTFManager, GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';

const TAU = Math.PI * 2;
const hash1 = (i: number) => {
  let s = (i * 2654435761) % 4294967296;
  s = (s ^ (s >> 15)) * 2654435761 % 4294967296;
  return ((s ^ (s >> 15)) >>> 0) / 4294967296;
};
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// one warm shaft from canopy-right, raking low across the ring
const SHAFT_APEX = new THREE.Vector3(3.6, 6.8, -1.2);
const SHAFT_DIR = new THREE.Vector3(-0.42, -1, -0.18).normalize();
const SHAFT_LEN = 7.4;

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SHAFT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uI;
void main() {
  float along = vUv.y;                       // 1 at apex
  float edge = sin(vUv.x * 3.14159);
  float a = uI * edge * mix(0.35, 1.0, along) * smoothstep(0.0, 0.08, vUv.y);
  fragColor = vec4(vec3(0.98, 0.80, 0.50) * a, a);
}`;

const POOL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uI;
void main() {
  vec2 d = vUv - 0.5;
  float r = length(d) * 2.0;
  // dappled pool: leaf-gap noise baked into the falloff
  float n = sin(vUv.x * 21.0) * sin(vUv.y * 17.0) * 0.5 + 0.5;
  float a = uI * (1.0 - smoothstep(0.15, 1.0, r)) * (0.45 + 0.55 * n);
  fragColor = vec4(vec3(0.95, 0.72, 0.42) * a, a);
}`;

export default class MushringScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(38, W / H, 0.02, 120);
  private floor!: GLTFInstance;
  private ownMats!: Map<THREE.Material, THREE.Material>;
  private shaftGroup = new THREE.Group();
  private shaftMats: THREE.ShaderMaterial[] = [];
  private motes!: THREE.Points;
  private moteSeed!: Float32Array;
  private moteSprite!: THREE.Texture;
  private fireflies!: THREE.Points;
  private flySeed!: Float32Array;
  private flySprite!: THREE.Texture;
  private focus = { dist: 5.0 };
  private p = new THREE.Vector3();

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(0x070a06), 0.055);
    this.scene3D.background = new THREE.Color(0x070906);

    this.floor = await GLTFManager.instantiate(resolveAsset('floor', 'mushring').url, {});
    this.ownMats = new Map();
    const own = this.ownMats;
    this.floor.root.traverse((o) => {
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
    this.scene3D.add(this.floor.root);

    // dew beads read as glass, not stone — drop roughness hard
    const dewNode = this.floor.node('web');
    dewNode?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material instanceof THREE.MeshStandardMaterial &&
          m.material.name.includes('Dew')) {
        const dm = m.material.clone();
        dm.roughness = 0.04;
        dm.metalness = 0.1;
        m.material = dm;
        this.ownMats.set(dm, dm);
      }
    });

    // --- dusk ambient + one warm raking sun
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(0x1a2018), 0.45));
    const sun = new THREE.DirectionalLight(
      new THREE.Color(...blackbodyToLinearSRGB(2700)), 2.6);
    sun.position.copy(SHAFT_APEX).multiplyScalar(4);
    sun.target.position.set(0, 0.4, 0);
    this.scene3D.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(new THREE.Color(0x24352c), 0.35);
    fill.position.set(-10, 3, -8);
    this.scene3D.add(fill);
    // cool rim from behind the web — edge light on caps + silk
    const rim = new THREE.DirectionalLight(new THREE.Color(0x44586a), 1.1);
    rim.position.set(-3, 5, 8);
    this.scene3D.add(rim);
    // warm kiss from the shaft on the ring caps — localizes the last light
    const kiss = new THREE.PointLight(
      new THREE.Color(...blackbodyToLinearSRGB(2400)), 14, 6.5, 1.8);
    kiss.position.set(1.2, 1.6, -1.6);
    this.scene3D.add(kiss);

    // --- the shaft: dual-shell cone + dappled pool + dust
    const mkShaft = (r0: number, r1: number, gain: number) => {
      const geo = new THREE.CylinderGeometry(r0, r1, SHAFT_LEN, 24, 1, true);
      geo.translate(0, -SHAFT_LEN / 2, 0);
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: gain } },
        vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.copy(SHAFT_APEX);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), SHAFT_DIR);
      this.shaftGroup.add(cone);
      this.shaftMats.push(mat);
    };
    mkShaft(0.22, 1.05, 0.34);   // veil
    mkShaft(0.10, 0.45, 0.62);   // hot core
    this.scene3D.add(this.shaftGroup);

    const poolGeo = new THREE.CircleGeometry(2.6, 32);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uI: { value: 0.5 } },
      vertexShader: SHAFT_VERT, fragmentShader: POOL_FRAG,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false,
    });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(SHAFT_APEX.x + SHAFT_DIR.x * 6.6, 0.03,
                      SHAFT_APEX.z + SHAFT_DIR.z * 6.6);
    this.scene3D.add(pool);
    this.shaftMats.push(poolMat);

    // dust motes seeded inside the shaft volume
    const moteN = 90;
    const motePos = new Float32Array(moteN * 3);
    this.moteSeed = new Float32Array(moteN * 4);
    for (let i = 0; i < moteN; i++) {
      this.moteSeed[i * 4] = hash1(i * 4 + 1);
      this.moteSeed[i * 4 + 1] = hash1(i * 7 + 2);
      this.moteSeed[i * 4 + 2] = hash1(i * 11 + 3);
      this.moteSeed[i * 4 + 3] = hash1(i * 13 + 5);
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
      map: this.moteSprite, size: 0.035, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      color: new THREE.Color(0xffe2ae),
    });
    this.motes = new THREE.Points(moteGeo, moteMat);
    this.motes.frustumCulled = false;
    this.scene3D.add(this.motes);

    // fireflies: warm points on slow closed-form paths above the litter
    const flyN = 14;
    const flyPos = new Float32Array(flyN * 3);
    this.flySeed = new Float32Array(flyN * 4);
    for (let i = 0; i < flyN; i++) {
      this.flySeed[i * 4] = hash1(i * 17 + 7);
      this.flySeed[i * 4 + 1] = hash1(i * 23 + 3);
      this.flySeed[i * 4 + 2] = hash1(i * 29 + 11);
      this.flySeed[i * 4 + 3] = hash1(i * 31 + 5);
    }
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
    const fcv = document.createElement('canvas');
    fcv.width = fcv.height = 32;
    const fctx = fcv.getContext('2d')!;
    const fgrd = fctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    fgrd.addColorStop(0, 'rgba(255,230,140,1)');
    fgrd.addColorStop(0.35, 'rgba(255,200,80,0.55)');
    fgrd.addColorStop(1, 'rgba(255,180,60,0)');
    fctx.fillStyle = fgrd; fctx.fillRect(0, 0, 32, 32);
    this.flySprite = new THREE.CanvasTexture(fcv);
    const flyMat = new THREE.PointsMaterial({
      map: this.flySprite, size: 0.16, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      color: new THREE.Color(0xffc86e),
    });
    this.fireflies = new THREE.Points(flyGeo, flyMat);
    this.fireflies.frustumCulled = false;
    this.scene3D.add(this.fireflies);
  }

  private camAt(t: number) {
    // macro dolly: low over the litter, slow lateral track + gentle push;
    // the camera is a small animal skirting the ring
    const pos = new THREE.Vector3(
      -1.6 + t * 0.16 + Math.sin(t * 0.9) * 0.08,
      0.62 + Math.sin(t * 0.5) * 0.05,
      -5.6 + t * 0.045 + Math.sin(t * 0.33) * 0.10);
    const aim = new THREE.Vector3(
      0.4 - t * 0.10,
      0.55 + smooth(5, 9, t) * 0.15,
      -0.6 + t * 0.03);
    return { pos, aim };
  }

  override render(f: FrameInfo, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { pos, aim } = this.camAt(t);
    this.camera3D.position.copy(pos);
    this.camera3D.lookAt(aim);
    this.camera3D.updateMatrixWorld();

    // shaft sways a touch as the canopy breathes
    this.shaftGroup.rotation.z = Math.sin(t * 0.4) * 0.03;
    this.shaftGroup.rotation.x = Math.sin(t * 0.27) * 0.02;
    const glow = 0.85 + 0.15 * Math.sin(t * 0.8) * Math.sin(t * 0.31);
    this.shaftMats[0].uniforms.uI.value = 0.34 * glow;
    this.shaftMats[1].uniforms.uI.value = 0.62 * glow;
    this.shaftMats[2].uniforms.uI.value = 0.5 * glow;

    // dust motes drifting down the shaft
    const dp = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.moteSeed.length / 4; i++) {
      const u = (this.moteSeed[i * 4] + t * 0.05) % 1;
      const spread = 0.2 + 0.75 * u;
      const ang = this.moteSeed[i * 4 + 3] * TAU + t * 0.25;
      const rr = this.moteSeed[i * 4 + 2] * spread;
      const base = this.p.copy(SHAFT_APEX).addScaledVector(SHAFT_DIR, u * SHAFT_LEN);
      dp.setXYZ(i,
        base.x + Math.cos(ang) * rr * 0.5,
        base.y,
        base.z + Math.sin(ang) * rr * 0.5);
    }
    dp.needsUpdate = true;

    // fireflies: slow lissajous paths, a few routed through the shaft
    const fp = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.flySeed.length / 4; i++) {
      const a = this.flySeed[i * 4], b = this.flySeed[i * 4 + 1];
      const c = this.flySeed[i * 4 + 2], d = this.flySeed[i * 4 + 3];
      const cx = -2 + a * 5 + Math.sin(t * 0.23 + b * TAU) * 1.1;
      const cy = 0.35 + b * 1.2 + Math.sin(t * 0.31 + c * TAU) * 0.35;
      const cz = -3 + c * 4.5 + Math.cos(t * 0.19 + d * TAU) * 0.9;
      fp.setXYZ(i, cx, cy, cz);
    }
    fp.needsUpdate = true;
    // blink: closed-form pulse per fly, gated so they never all light at once
    const fm = this.fireflies.material as THREE.PointsMaterial;
    fm.opacity = 0.55 + 0.35 * Math.sin(t * 1.4) * Math.sin(t * 0.53);

    // focus racks: ring edge → dew web → log, smoothed
    const target =
      t < 5 ? new THREE.Vector3(0.4, 0.6, -2.3)
      : t < 11 ? new THREE.Vector3(1.95, 0.78, -1.55)
      : t < 16 ? new THREE.Vector3(0.0, 0.55, -0.5)
      : new THREE.Vector3(-2.3, 1.0, 0.9);
    const d = pos.distanceTo(target);
    this.focus.dist += (d - this.focus.dist) * Math.min(1, f.dt * 1.2);

    const renderer = this.ctx.renderer;
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    // probes: ring + web, world-projected
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const Wd = P.width || 1920, Hd = P.height || 1080;
        const boxAt = (c: THREE.Vector3, sx: number, sy: number) => {
          this.p.copy(c).project(this.camera3D);
          const cx = (this.p.x * 0.5 + 0.5) * Wd, cy = (0.5 - this.p.y * 0.5) * Hd;
          return { bbox: [cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2] as number[], w: sx, h: sy, cx, cy };
        };
        const rb = boxAt(new THREE.Vector3(0, 0.6, -1.5), 420, 220);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'fairy ring',
          x: rb.cx, y: rb.cy, bbox: rb.bbox, w: rb.w, h: rb.h,
        });
        const wb = boxAt(new THREE.Vector3(1.95, 0.78, -1.55), 120, 110);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'dew web',
          x: wb.cx, y: wb.cy, bbox: wb.bbox, w: wb.w, h: wb.h,
        });
      }
    }

    return {
      toneMap: 'aces',
      exposure: 0.92,
      bloom: 0.55,
      bloomThreshold: 0.6,
      halation: 0.3,
      vignette: 0.36,
      grain: 0.035,
      depthDof: {
        enabled: true,
        focusDistance: this.focus.dist,
        aperture: 26,
        maxRadius: 20,
        samples: 40,
      },
    } as PostOverrides;
  }

  override dispose(): void {
    this.floor.dispose();
    for (const m of this.ownMats.values()) m.dispose();
    for (const m of this.shaftMats) m.dispose();
    this.motes.geometry.dispose();
    (this.motes.material as THREE.Material).dispose();
    this.moteSprite.dispose();
    this.fireflies.geometry.dispose();
    (this.fireflies.material as THREE.Material).dispose();
    this.flySprite.dispose();
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

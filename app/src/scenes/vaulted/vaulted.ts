// vaulted — a ruined abbey nave at night. The roof is breached: three cool
// moon shafts fall through the gap onto the flagstones while a single
// candle burns in a wall sconce. All motion is closed-form f(t) — shaft
// sway/intensity, drifting dust, candle flicker, camera dolly. No sim state.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp, lerp } from '../../engine/util';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';

const TAU = Math.PI * 2;
const CANDLE = new THREE.Vector3(4.0, 2.82, 6.0);   // flame position in the GLB

// light-shaft direction: moonlight angling through the roof breach
const SHAFT_DIR = new THREE.Vector3(-0.28, -1.0, 0.12).normalize();
const SHAFTS = [
  { apex: new THREE.Vector3(2.2, 9.6, -6.0), len: 12.5, r0: 0.30, r1: 1.9, ph: 0.0 },
  { apex: new THREE.Vector3(0.4, 9.8, 0.5), len: 12.5, r0: 0.40, r1: 2.0, ph: 2.1 },
  { apex: new THREE.Vector3(-1.6, 9.5, 6.5), len: 12.5, r0: 0.26, r1: 1.6, ph: 4.4 },
];

// camera: low dolly down the nave, gaze lifting toward the shafts mid-scene
const camAt = (t: number) => {
  const z = -15.2 + t * 0.34;
  const x = -1.2 + Math.sin(t * 0.15) * 0.4;
  const y = 1.75 + t * 0.03;
  // gaze rises from the floor line toward the breach as the dolly advances
  const aim = new THREE.Vector3(
    0.5 + Math.sin(t * 0.1) * 0.2,
    2.4 + clamp((t - 4) / 10, 0, 1) * 2.4,
    4.0,
  );
  return { pos: new THREE.Vector3(x, y, z), target: aim, fov: 42 };
};

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWp;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 wp = modelViewMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * wp;
}`;

// volumetric moon-shaft cone: brightest at the apex, feathered along its
// length and across the silhouette edge (view·normal rim fade)
const SHAFT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vN;
in vec3 vWp;
out vec4 fragColor;
uniform float uI;
void main() {
  float along = 1.0 - vUv.y;                    // 1 at the apex, 0 at the floor
  float body = pow(along, 1.5);
  body *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
  float rim = pow(abs(normalize(vN).z), 0.7);
  // subtle curtain striations inside the shaft — light through broken ribs
  float striae = 0.6 + 0.4 * sin(vUv.x * 28.0 + vUv.y * 6.0);
  float a = body * rim * striae * uI;
  vec3 col = vec3(0.58, 0.68, 0.90) * a;
  fragColor = vec4(col, a);
}`;

export default class VaultedScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(42, W / H, 0.05, 400);
  private abbey!: GLTFInstance;
  private ownMats!: Map<THREE.Material, THREE.Material>;
  private shaftGroup = new THREE.Group();
  private shaftMats: THREE.ShaderMaterial[] = [];
  private poolMats: THREE.ShaderMaterial[] = [];
  private dust!: THREE.Points;
  private dustSeed!: Float32Array;
  private candleLight!: THREE.PointLight;
  private flameMat!: THREE.MeshStandardMaterial;
  private p = new THREE.Vector3();

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(0x04060c), 0.016);
    this.scene3D.background = new THREE.Color(0x03050c);

    // --- Blender-built abbey (assets/abbey)
    this.abbey = await GLTFManager.instantiate(resolveAsset('abbey', 'vaulted').url, {});
    this.ownMats = new Map();
    const own = this.ownMats;
    this.abbey.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mine = (x: THREE.Material) => {
          let c = own.get(x);
          if (!c) own.set(x, (c = x.clone()));
          return c;
        };
        m.material = Array.isArray(m.material) ? m.material.map(mine) : mine(m.material);
        if (m.material instanceof THREE.MeshStandardMaterial && m.material.name === 'FlameCore') {
          this.flameMat = m.material;
        }
      }
    });
    this.scene3D.add(this.abbey.root);
    // rubble reads as stone when it keeps hard facets — flat-shade its clone
    const rubble = this.abbey.node('rubble');
    if (rubble) {
      rubble.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material instanceof THREE.MeshStandardMaterial) {
          const fm = m.material.clone();
          fm.flatShading = true;
          m.material = fm;
          this.ownMats.set(fm, fm);
        }
      });
    }

    // --- lighting: cold ambient + moon key along the shaft direction
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(0x1c2436), 0.55));
    const moon = new THREE.DirectionalLight(new THREE.Color(0x93a9d4), 2.4);
    moon.position.set(9, 20, -4);               // comes through the breach
    this.scene3D.add(moon);
    // faint cool floor bounce so flagstones don't clip to black
    const bounce = new THREE.DirectionalLight(new THREE.Color(0x243048), 0.35);
    bounce.position.set(0, -10, 6);
    this.scene3D.add(bounce);
    // low cool fill from the west end so shadow faces keep form
    const fill = new THREE.DirectionalLight(new THREE.Color(0x2e3c55), 0.5);
    fill.position.set(-14, 3, -12);
    this.scene3D.add(fill);
    // dim rim from the lancet opening behind
    const rim = new THREE.DirectionalLight(new THREE.Color(0x36455e), 0.5);
    rim.position.set(0, 6, -30);
    this.scene3D.add(rim);
    // pale edge light from beyond the far wall — silhouettes the lancet
    const edge = new THREE.DirectionalLight(new THREE.Color(0x5a6f9d), 0.8);
    edge.position.set(3, 14, 34);
    this.scene3D.add(edge);

    // the candle: warm point + the flame's own emissive flicker
    const [cr, cg, cb] = blackbodyToLinearSRGB(2600);
    this.candleLight = new THREE.PointLight(new THREE.Color(cr, cg, cb), 9, 5.5, 2.0);
    this.candleLight.position.copy(CANDLE);
    this.scene3D.add(this.candleLight);

    // --- moon shafts: additive cones from the breach to the floor
    const coneAxis = new THREE.Vector3(0, 1, 0);
    for (const s of SHAFTS) {
      const geo = new THREE.CylinderGeometry(s.r0, s.r1, s.len, 24, 1, true);
      geo.translate(0, -s.len / 2, 0);          // apex at local origin, opens downward
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.3 } },
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const cone = new THREE.Mesh(geo, mat);
      cone.position.copy(s.apex);
      // align the cone's -y (down) with SHAFT_DIR
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), SHAFT_DIR);
      cone.userData.ph = s.ph;
      this.shaftGroup.add(cone);
      this.shaftMats.push(mat);
      // bright inner core — the god-ray read comes from a hot centre fading out
      const coreGeo = new THREE.CylinderGeometry(s.r0 * 0.5, s.r1 * 0.45, s.len * 0.96, 20, 1, true);
      coreGeo.translate(0, -s.len * 0.48, 0);
      const coreMat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.3 } },
        vertexShader: SHAFT_VERT,
        fragmentShader: SHAFT_FRAG,
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

    // --- floor light-pools where each shaft lands: grounding the rays
    for (const s of SHAFTS) {
      const poolGeo = new THREE.CircleGeometry(s.r1 * 0.85, 24);
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
            float a = (1.0 - smoothstep(0.1, 1.0, d)) * uI;
            fragColor = vec4(vec3(0.55, 0.66, 0.88) * a, a);
          }`,
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false,
      });
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.copy(s.apex).addScaledVector(SHAFT_DIR, s.len);
      pool.position.y = 0.05;
      pool.userData.ph = s.ph;
      this.shaftGroup.add(pool);
      this.poolMats.push(poolMat);
    }

    // --- dust motes: one points field seeded inside all three shafts
    const dustN = 96;
    const dustPos = new Float32Array(dustN * 3);
    this.dustSeed = new Float32Array(dustN * 4); // shaft idx, t-phase, r, angle
    for (let i = 0; i < dustN; i++) {
      this.dustSeed[i * 4] = i % 3;
      this.dustSeed[i * 4 + 1] = (i * 7.31) % 1;             // phase along the shaft
      this.dustSeed[i * 4 + 2] = Math.abs(Math.sin(i * 3.7)) * 0.8; // radial
      this.dustSeed[i * 4 + 3] = i * 2.399;                  // golden-angle spin
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const cv = document.createElement('canvas');
    cv.width = cv.height = 16;
    const cx = cv.getContext('2d')!;
    const grad = cx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 16, 16);
    this.dustSprite = new THREE.CanvasTexture(cv);
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0x9db4dd, size: 0.06, map: this.dustSprite, transparent: true,
      opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false,
      sizeAttenuation: true, fog: false,
    }));
    this.scene3D.add(this.dust);

    // --- stars: a fixed field overhead, visible through the roof breach
    const starN = 240;
    const sp = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const az = i * 2.39996, ph2 = ((i * 7.13) % 97) / 97;
      const el = 0.18 + ph2 * 1.35;                        // elevation above horizon
      const r = 260;
      sp[i * 3] = Math.cos(az) * Math.cos(el) * r;
      sp[i * 3 + 1] = Math.sin(el) * r;
      sp[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starCol = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const b = 0.35 + 0.65 * Math.abs(Math.sin(i * 5.31));
      starCol[i * 3] = b * 0.85; starCol[i * 3 + 1] = b * 0.9; starCol[i * 3 + 2] = b;
    }
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 0.9, vertexColors: true, transparent: true, opacity: 0.8,
      depthWrite: false, sizeAttenuation: false, fog: false,
    }));
    this.scene3D.add(this.stars);

    // --- the moon itself: a soft disc far up the shaft direction, so the
    // rays have a visible source through the breach
    const mcv = document.createElement('canvas');
    mcv.width = mcv.height = 64;
    const mx = mcv.getContext('2d')!;
    const mg = mx.createRadialGradient(32, 32, 0, 32, 32, 32);
    mg.addColorStop(0, 'rgba(235,242,255,1)');
    mg.addColorStop(0.25, 'rgba(200,215,245,0.55)');
    mg.addColorStop(1, 'rgba(160,180,230,0)');
    mx.fillStyle = mg;
    mx.fillRect(0, 0, 64, 64);
    this.moonSprite = new THREE.CanvasTexture(mcv);
    const moonBill = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.moonSprite, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    // hung inside the lancet opening — the moon framed by the ruin
    moonBill.position.set(0.3, 5.9, 22.2);   // in front of the glow plane
    moonBill.scale.setScalar(5.5);
    this.scene3D.add(moonBill);

    // --- night-glow behind the far wall: a soft sky gradient so the lancet
    // opening reads as a luminous slit, not a dark hole
    const skyGeo = new THREE.PlaneGeometry(14, 11);
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
          vec3 top = vec3(0.10, 0.15, 0.30);
          vec3 bot = vec3(0.03, 0.05, 0.12);
          float h = smoothstep(0.0, 1.0, vUv.y);
          vec3 c = mix(bot, top, pow(h, 1.4));
          float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
          fragColor = vec4(c * edge * 0.9, edge);
        }`,
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    const skyGlow = new THREE.Mesh(skyGeo, skyMat);
    skyGlow.position.set(0, 4.5, 22.5);
    this.scene3D.add(skyGlow);
  }

  private moonSprite!: THREE.Texture;

  private stars!: THREE.Points;

  private dustSprite!: THREE.Texture;

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;

    const cam = camAt(t);
    this.camera3D.aspect = out.width / out.height;
    this.camera3D.fov = cam.fov;
    this.camera3D.position.copy(cam.pos);
    this.camera3D.lookAt(cam.target);
    this.camera3D.updateProjectionMatrix();

    // shaft intensity arc: pale → strong (5-10s) → ease back (15-20s)
    const env = clamp(t / 6, 0, 1) * (1 - clamp((t - 15) / 5, 0, 1) * 0.45);
    for (let i = 0; i < this.shaftMats.length; i++) {
      const isCore = i % 2 === 1;
      const ph = SHAFTS[Math.floor(i / 2)].ph;
      this.shaftMats[i].uniforms.uI.value =
        ((isCore ? 0.5 : 0.2) + 0.06 * Math.sin(t * 0.5 + ph)) * (0.55 + 0.45 * env);
    }
    for (let i = 0; i < this.poolMats.length; i++) {
      this.poolMats[i].uniforms.uI.value =
        (0.35 + 0.05 * Math.sin(t * 0.5 + SHAFTS[i].ph)) * (0.4 + 0.6 * env);
    }
    // shafts sway a degree as if cloud thins at the gap
    this.shaftGroup.rotation.z = 0.02 * Math.sin(t * 0.35);
    this.shaftGroup.rotation.x = 0.015 * Math.sin(t * 0.27 + 1.3);

    // dust drifting down inside the shafts
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.dustSeed.length / 4; i++) {
      const s = SHAFTS[this.dustSeed[i * 4]];
      const ph = this.dustSeed[i * 4 + 1];
      const rr = this.dustSeed[i * 4 + 2];
      const ang = this.dustSeed[i * 4 + 3];
      const u = (ph + t * 0.035) % 1;                        // slow descent
      const spread = s.r0 + (s.r1 - s.r0) * u * 0.85;
      const off = new THREE.Vector3(
        Math.cos(ang + t * 0.25) * rr * spread,
        0,
        Math.sin(ang + t * 0.25) * rr * spread,
      );
      const base = s.apex.clone().addScaledVector(SHAFT_DIR, u * s.len);
      dp.setXYZ(i, base.x + off.x, base.y + off.y, base.z + off.z);
    }
    dp.needsUpdate = true;

    // candle: strong deterministic flicker (fresnel-like wobble + draught dip)
    const flick = 0.75 + 0.18 * Math.sin(t * 11.0) * Math.sin(t * 4.3)
      + 0.07 * Math.sin(t * 23.0);
    const draught = 1 - 0.35 * clamp(Math.sin(t * 0.9 - 1.2), 0, 1) ** 4;
    this.candleLight.intensity = 9 * flick * draught;
    if (this.flameMat) this.flameMat.emissiveIntensity = 9 * flick * draught;

    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    // probes: a shaft + the candle, world-projected
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const Wd = P.width || 1920, Hd = P.height || 1080;
        const boxAt = (c: THREE.Vector3, sx: number, sy: number) => {
          this.p.copy(c).project(this.camera3D);
          const cx = (this.p.x * 0.5 + 0.5) * Wd, cy = (0.5 - this.p.y * 0.5) * Hd;
          return { bbox: [cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2] as number[], w: sx, h: sy, cx, cy };
        };
        const sb = boxAt(SHAFTS[1].apex.clone().addScaledVector(SHAFT_DIR, 5), 140, 400);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'moon shaft',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#9db4dd', globalAlpha: 0.85, layerId: 'vaulted',
          bbox: sb.bbox, w: sb.w, h: sb.h, cx: sb.cx, cy: sb.cy,
          hPct: (sb.h / Hd) * 100, isStroke: false,
        });
        const cb2 = boxAt(CANDLE, 90, 90);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'candle',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#f0b96a', globalAlpha: 0.9, layerId: 'vaulted',
          bbox: cb2.bbox, w: cb2.w, h: cb2.h, cx: cb2.cx, cy: cb2.cy,
          hPct: (cb2.h / Hd) * 100, isStroke: false,
        });
      }
    }

    return {
      exposure: 1.06,
      bloom: 0.5,
      bloomThreshold: 0.68,
      bloomRadius: 0.6,
      vignette: 0.36,
      grain: 0.05,
      ca: 0.2,
      fade: lerp(1, 0, clamp(t / 0.5)),
    } as PostOverrides;
  }

  override dispose(): void {
    this.abbey.dispose();
    for (const m of this.ownMats.values()) m.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.dustSprite.dispose();
    for (const m of this.shaftMats) m.dispose();
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

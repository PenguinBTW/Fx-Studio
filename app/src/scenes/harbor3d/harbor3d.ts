// harborlight — a stone lighthouse on a sea stack at deep dusk, built as a
// real 3D scene: Blender GLB tower + gallery rail + glazed lantern, a
// displaced PBR water plane the beam's SpotLight streaks across, a rotating
// volumetric beam cone, and hinged-wing gulls wheeling the lamp. Every
// transform is closed-form f(t); no accumulators.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp, lerp } from '../../engine/util';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';

const TAU = Math.PI * 2;
const LAMP = new THREE.Vector3(0, 9.85, 0);      // lamp drum inside the GLB lantern
const WATER_Y = -0.9;
const BEAM_PERIOD = 8;                            // seconds per beam rotation
const beamYaw = (t: number) => (t / BEAM_PERIOD) * TAU;

// camera: low slow orbit, drifting in and rising a touch
const camAt = (t: number) => {
  const yaw = -0.65 + t * 0.055;
  const radius = 30 - t * 0.28;
  const y = 2.6 + t * 0.07 + Math.sin(t * 0.21) * 0.35;
  // look past the tower so it holds the left third and the beam sweeps open sea
  const target = new THREE.Vector3(5.5, 5.0 + t * 0.05, 0);
  return { pos: new THREE.Vector3(Math.cos(yaw) * radius, y, Math.sin(yaw) * radius), target, fov: 38 };
};

// swell: closed-form sum of three directional waves + a chop term — no sim
const waveY = (x: number, z: number, t: number) =>
  0.55 * Math.sin(x * 0.10 + t * 0.9)
  + 0.38 * Math.sin(z * 0.14 - t * 0.7 + 1.7)
  + 0.24 * Math.sin((x + z) * 0.21 + t * 1.3)
  + 0.13 * Math.sin(x * 0.46 - t * 1.9)
  + 0.10 * Math.sin(z * 0.53 + x * 0.21 + t * 1.55)
  + 0.08 * Math.sin(x * 0.9 - z * 0.7 + t * 2.6);

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
in vec3 vDir;
out vec4 fragColor;
uniform float uT;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  float h = clamp(vDir.y, -0.05, 1.0);
  // deep dusk: steel blue overhead, a dying warm band at the horizon
  vec3 col = mix(vec3(0.115, 0.115, 0.155), vec3(0.016, 0.023, 0.042), smoothstep(0.02, 0.55, h));
  col += vec3(0.30, 0.16, 0.09) * exp(-abs(vDir.y - 0.015) * 16.0) * 0.55;
  // faint stars near the zenith, hashed on direction and twinkling slowly
  vec2 g = vec2(atan(vDir.x, vDir.z) * 60.0, vDir.y * 140.0);
  vec2 cell = floor(g);
  float s = step(0.992, h1(cell.x * 17.31 + cell.y * 91.7));
  float tw = 0.5 + 0.5 * sin(uT * 1.3 + cell.x * 3.0 + cell.y * 7.0);
  col += vec3(0.75, 0.80, 0.9) * s * tw * smoothstep(0.30, 0.7, vDir.y) * 0.8;
  fragColor = vec4(col, 1.0);
}`;

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// volumetric-looking cone: additive, brightest at the lamp, feathered both
// along its length and across its silhouette edge (view·normal rim fade)
const BEAM_VERT2 = /* glsl */ `
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

const BEAM_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vN;
in vec3 vWp;
out vec4 fragColor;
uniform float uI;
void main() {
  float along = 1.0 - vUv.y;                    // 1 at the lamp, 0 at the far end
  float body = pow(along, 2.0);
  // fade both ends so the cone's open rim never draws a hard edge
  body *= smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.90, 1.0, vUv.y));
  // edge feather: strongest where the surface faces the camera
  float rim = pow(abs(normalize(vN).z), 0.8);
  float a = body * rim * uI;
  vec3 col = vec3(1.0, 0.80, 0.48) * a;
  fragColor = vec4(col, a);
}`;

function makeGull(): { g: THREE.Group; wings: [THREE.Mesh, THREE.Mesh] } {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.9, metalness: 0 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.42, 8), mat);
  body.rotation.z = -Math.PI / 2;               // nose +x
  g.add(body);
  const wingGeo = (side: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(0.16, 0.62);
    geo.rotateX(-Math.PI / 2);                  // flat, span along z
    geo.translate(0, 0.02, side * 0.33);        // hinge at the body
    return geo;
  };
  const wl = new THREE.Mesh(wingGeo(1), mat);
  const wr = new THREE.Mesh(wingGeo(-1), mat);
  wl.material.side = THREE.DoubleSide;
  wr.material.side = THREE.DoubleSide;
  g.add(wl, wr);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.14), mat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.x = -0.24;
  g.add(tail);
  return { g, wings: [wl, wr] };
}

export default class HarborlightScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(38, W / H, 0.05, 600);
  private house!: GLTFInstance;
  private ownMats!: Map<THREE.Material, THREE.Material>;
  private water!: THREE.Mesh;
  private waterPos!: THREE.BufferAttribute;
  private beamGroup = new THREE.Group();
  private spot!: THREE.SpotLight;
  private gulls: { g: THREE.Group; wings: [THREE.Mesh, THREE.Mesh] }[] = [];
  private p = new THREE.Vector3();

  override async init(): Promise<void> {
    await document.fonts.ready;
    this.scene3D.fog = new THREE.FogExp2(new THREE.Color(0x060a12), 0.0125);

    // --- Blender-built lighthouse (assets/lighthouse)
    this.house = await GLTFManager.instantiate(resolveAsset('lighthouse', 'harbor3d').url, {});
    this.ownMats = new Map();
    const own = this.ownMats;
    this.house.root.traverse((o) => {
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
    this.scene3D.add(this.house.root);

    // --- sky dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(420, 32, 16),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uT: { value: 0 } },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    sky.name = 'sky';
    this.scene3D.add(sky);
    this.skyMat = sky.material as THREE.ShaderMaterial;

    // --- water: displaced PBR plane, waves evaluated f(t) per vertex
    const wg = new THREE.PlaneGeometry(520, 520, 110, 110);
    wg.rotateX(-Math.PI / 2);
    this.waterPos = wg.attributes.position as THREE.BufferAttribute;
    this.water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x1a3547),
      roughness: 0.2,
      metalness: 0.0,
      envMapIntensity: 0,
    }));
    this.water.position.y = WATER_Y;
    this.scene3D.add(this.water);

    // --- lighting: cold ambient + moon fill + the lamp's warm spot
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(0x24344a), 0.85));
    const moon = new THREE.DirectionalLight(new THREE.Color(0x50688c), 0.7);
    moon.position.set(-60, 50, -40);
    this.scene3D.add(moon);
    // low sea-light kick so the swell picks up silhouettes and faint glints
    const seaKick = new THREE.DirectionalLight(new THREE.Color(0x2e4460), 0.45);
    seaKick.position.set(40, 6, 60);
    this.scene3D.add(seaKick);
    // cool rim from behind-left to separate the tower from the sky
    const rim = new THREE.DirectionalLight(new THREE.Color(0x4a5f80), 0.4);
    rim.position.set(-30, 20, -55);
    this.scene3D.add(rim);
    // grazing horizon sheen so the swell catches specular crests
    const sheen = new THREE.DirectionalLight(new THREE.Color(0x3a5570), 0.3);
    sheen.position.set(25, 3, -60);
    this.scene3D.add(sheen);
    // soft camera-side fill so the whitewash reads instead of clipping to black
    const fill = new THREE.DirectionalLight(new THREE.Color(0x3a4a60), 0.55);
    fill.position.set(45, 8, 30);
    this.scene3D.add(fill);
    const [br, bg, bb] = blackbodyToLinearSRGB(3000);
    const lampGlow = new THREE.PointLight(new THREE.Color(br, bg, bb), 45, 26, 1.6);
    lampGlow.position.copy(LAMP);
    this.scene3D.add(lampGlow);

    this.spot = new THREE.SpotLight(new THREE.Color(br, bg, bb), 12000, 320, 0.14, 0.5, 1.2);
    this.spot.position.copy(LAMP);
    this.scene3D.add(this.spot, this.spot.target);

    // --- the beam: faint additive cone inside the spot cone
    const cone = new THREE.Mesh(
      // narrow end at the lamp, spreading offshore — radiusTop is the far end
      new THREE.CylinderGeometry(5.5, 0.14, 66, 24, 1, true),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        uniforms: { uI: { value: 0.5 } },
        vertexShader: BEAM_VERT2,
        fragmentShader: BEAM_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    cone.position.set(33, 0, 0);
    cone.rotation.z = Math.PI / 2;              // +x is the beam direction
    // cylinder uv: v=0 at top(small end, near lamp after rotation?) — orient so
    // apex meets the lamp; flip if needed via scale
    cone.scale.y = -1;                          // wide end outward
    cone.position.set(33, 0, 0);
    this.beamGroup.position.copy(LAMP);
    this.beamGroup.add(cone);
    this.scene3D.add(this.beamGroup);

    // --- gulls wheeling the lantern
    for (let i = 0; i < 5; i++) {
      const gu = makeGull();
      this.scene3D.add(gu.g);
      this.gulls.push(gu);
    }
  }

  private skyMat!: THREE.ShaderMaterial;

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;

    // camera
    const cam = camAt(t);
    this.camera3D.aspect = out.width / out.height;
    this.camera3D.fov = cam.fov;
    this.camera3D.position.copy(cam.pos);
    this.camera3D.lookAt(cam.target);
    this.camera3D.updateProjectionMatrix();

    // water swell — closed-form displacement
    const pos = this.waterPos;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, waveY(pos.getX(i), pos.getZ(i), t));
    }
    pos.needsUpdate = true;
    this.water.geometry.computeVertexNormals();

    // beam sweep + its real spotlight
    const yaw = beamYaw(t);
    this.beamGroup.rotation.y = -yaw;
    this.beamGroup.rotation.z = -0.16;          // same downward tilt as the spot target
    const bd = new THREE.Vector3(Math.cos(yaw), -0.16, Math.sin(yaw)).normalize();
    this.spot.target.position.copy(LAMP).addScaledVector(bd, 90);
    // the lamp breathes faintly — the Fresnel shutter wobble
    const flick = 0.9 + 0.1 * Math.sin(t * 13.0) * Math.sin(t * 3.7);

    this.skyMat.uniforms.uT.value = t;
    const beamMat = (this.beamGroup.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    beamMat.uniforms.uI.value = 0.5 * flick;
    this.spot.intensity = 12000 * flick;

    // gulls: circular orbits around the lamp, banking into the turn, flapping
    for (let i = 0; i < this.gulls.length; i++) {
      const gu = this.gulls[i];
      const r = 3.4 + i * 0.85;
      const sp = (0.55 + i * 0.07) * (i % 2 ? 1 : -1);
      const ph = i * 1.9;
      const a = ph + t * sp;
      const gy = LAMP.y + 0.6 + Math.sin(t * 0.6 + ph) * 0.9 + i * 0.35;
      gu.g.position.set(Math.cos(a) * r, gy, Math.sin(a) * r);
      // face along the orbit tangent; bank into the turn
      gu.g.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2);
      gu.g.rotation.z = -0.25 * Math.sign(sp);
      const flap = Math.sin(t * 9.0 + ph) * 0.55 + 0.25;
      gu.wings[0].rotation.x = flap;
      gu.wings[1].rotation.x = -flap;
    }

    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    // probes: lantern + tower + beam tip, world-projected
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const Wd = P.width || 1920, Hd = P.height || 1080;
        const boxAt = (c: THREE.Vector3, sx: number, sy: number) => {
          this.p.copy(c).project(this.camera3D);
          const cx = (this.p.x * 0.5 + 0.5) * Wd, cy = (0.5 - this.p.y * 0.5) * Hd;
          return { bbox: [cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2] as number[], w: sx, h: sy, cx, cy };
        };
        const lb = boxAt(LAMP, 120, 200);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'lantern',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#f5c96b', globalAlpha: 0.9, layerId: 'harbor3d',
          bbox: lb.bbox, w: lb.w, h: lb.h, cx: lb.cx, cy: lb.cy,
          hPct: (lb.h / Hd) * 100, isStroke: false,
        });
        const tb = boxAt(new THREE.Vector3(0, 4.5, 0), 160, 500);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'tower',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#8ea3bd', globalAlpha: 0.8, layerId: 'harbor3d',
          bbox: tb.bbox, w: tb.w, h: tb.h, cx: tb.cx, cy: tb.cy,
          hPct: (tb.h / Hd) * 100, isStroke: false,
        });
      }
    }

    return {
      exposure: 0.92,
      bloom: 0.42,
      bloomThreshold: 0.72,
      bloomRadius: 0.55,
      vignette: 0.34,
      grain: 0.045,
      ca: 0.18,
      fade: lerp(1, 0, clamp(t / 0.5)),
    } as PostOverrides;
  }

  override dispose(): void {
    this.house.dispose();
    for (const m of this.ownMats.values()) m.dispose();
    this.water.geometry.dispose();
    (this.water.material as THREE.Material).dispose();
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

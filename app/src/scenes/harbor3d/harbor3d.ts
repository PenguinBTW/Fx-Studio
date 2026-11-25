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

// camera: low slow orbit, drifting in and rising a touch. The look-at is
// shifted along the CAMERA's right vector so the tower holds the left third
// of frame throughout the orbit (a fixed world offset slides as we circle).
const camAt = (t: number) => {
  const yaw = -0.65 + t * 0.055;
  const radius = 30 - t * 0.28;
  const y = 2.6 + t * 0.07 + Math.sin(t * 0.21) * 0.35;
  const pos = new THREE.Vector3(Math.cos(yaw) * radius, y, Math.sin(yaw) * radius);
  const aim = new THREE.Vector3(0, 5.0 + t * 0.05, 0);
  const fwd = aim.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const target = aim.addScaledVector(right, pos.distanceTo(aim) * 0.22);
  return { pos, target, fov: 38 };
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
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5262, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const g = new THREE.Group();
  // plump ellipsoid body + head, nose +x
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat);
  body.scale.set(2.2, 0.85, 0.9);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mat);
  head.position.set(0.22, 0.04, 0);
  g.add(head);
  // swept-back tapered wings, hinged at the body sides
  const wingGeo = (side: 1 | -1) => {
    const s = side;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0.04, 0, s * 0.06,      // root leading
      -0.16, 0, s * 0.08,     // root trailing
      -0.34, 0, s * 0.64,     // tip trailing (swept back)
      -0.08, 0, s * 0.62,     // tip leading
    ]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    return geo;
  };
  const wl = new THREE.Mesh(wingGeo(1), mat);
  const wr = new THREE.Mesh(wingGeo(-1), mat);
  g.add(wl, wr);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), mat);
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
  private foamMat!: THREE.ShaderMaterial;
  private foamMeshes: THREE.Mesh[] = [];
  private crest!: THREE.Points;
  private crestSprite!: THREE.Texture;
  private dust!: THREE.Points;
  private dustSeed!: Float32Array;
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
      color: new THREE.Color(0x234a63),
      roughness: 0.15,
      metalness: 0.0,
      envMapIntensity: 0,
    }));
    this.water.position.y = WATER_Y;
    this.scene3D.add(this.water);

    // --- foam: additive flecks ringing the rock waterline + skerries,
    // pulsing on the same swell terms so they read as wash, not snow
    const FOAM_FRAG = /* glsl */ `
      precision highp float;
      in vec2 vUv;
      in vec3 vWp;
      out vec4 fragColor;
      uniform float uT;
      float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float blob = 1.0 - smoothstep(0.15, 1.0, d);
        float ph = h1(floor(vWp.x * 3.7) + floor(vWp.z * 2.9) * 57.0);
        float pulse = 0.30 + 0.70 * pow(0.5 + 0.5 * sin(uT * 0.9 + ph * 6.28), 2.0);
        float a = blob * pulse * 0.55;
        fragColor = vec4(vec3(0.62, 0.66, 0.68) * a, a);
      }`;
    const foamMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: { uT: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vWp;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWp = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: FOAM_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.foamMat = foamMat;
    const foamGeo = new THREE.PlaneGeometry(1.4, 0.9);
    const foamAt = (cx: number, cz: number, r0: number, n: number, seed: number) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + seed;
        const rr = r0 + Math.sin(i * 12.9898 + seed) * 0.5;
        const m = new THREE.Mesh(foamGeo, foamMat);
        m.position.set(cx + Math.cos(a) * rr, WATER_Y + 0.22, cz + Math.sin(a) * rr);
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = a + Math.sin(seed + i) * 0.6;
        const s = 0.8 + 0.5 * Math.sin(i * 7.13 + seed * 2.1);
        m.scale.setScalar(s);
        this.foamMeshes.push(m);
        this.scene3D.add(m);
      }
    };
    foamAt(0, 0, 4.1, 16, 0.4);
    foamAt(-13.5, 11.0, 1.7, 7, 2.1);
    foamAt(11.0, -9.5, 1.5, 6, 4.6);

    // --- crest foam: a points field riding the swell — points darken to
    // nothing in the troughs and flash pale on the crest faces (colour fades
    // act as per-point alpha under additive blending)
    const crestN = 32;
    const crestPos = new Float32Array(crestN * crestN * 3);
    const crestCol = new Float32Array(crestN * crestN * 3);
    for (let i = 0; i < crestN; i++)
      for (let k = 0; k < crestN; k++) {
        const idx = i * crestN + k;
        // jitter off the lattice so flecks don't read as rows
        const jx = Math.sin(idx * 12.9898) * 1.4, jz = Math.sin(idx * 78.233) * 1.4;
        crestPos[idx * 3] = -50 + (i / (crestN - 1)) * 100 + jx;
        crestPos[idx * 3 + 2] = -50 + (k / (crestN - 1)) * 100 + jz;
        crestPos[idx * 3 + 1] = WATER_Y;
      }
    const crestGeo = new THREE.BufferGeometry();
    crestGeo.setAttribute('position', new THREE.BufferAttribute(crestPos, 3));
    crestGeo.setAttribute('color', new THREE.BufferAttribute(crestCol, 3));
    // soft round sprite so points read as foam blobs, not squares
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const cx = cv.getContext('2d')!;
    const grad = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(cv);
    this.crestSprite = sprite;
    this.crest = new THREE.Points(crestGeo, new THREE.PointsMaterial({
      size: 0.42, map: sprite, vertexColors: true, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      fog: false,   // additive points: fog would lift dark trough sprites to fog colour
    }));
    this.scene3D.add(this.crest);

    // --- lighting: cold ambient + moon fill + the lamp's warm spot
    this.scene3D.add(new THREE.AmbientLight(new THREE.Color(0x24344a), 0.85));
    const moon = new THREE.DirectionalLight(new THREE.Color(0x50688c), 0.7);
    moon.position.set(-60, 50, -40);
    this.scene3D.add(moon);
    // low sea-light kick so the swell picks up silhouettes and faint glints
    const seaKick = new THREE.DirectionalLight(new THREE.Color(0x2e4460), 0.6);
    seaKick.position.set(40, 6, 60);
    this.scene3D.add(seaKick);
    // cool rim from behind-left to separate the tower from the sky
    const rim = new THREE.DirectionalLight(new THREE.Color(0x4a5f80), 0.4);
    rim.position.set(-30, 20, -55);
    this.scene3D.add(rim);
    // grazing horizon sheen so the swell catches specular crests
    const sheen = new THREE.DirectionalLight(new THREE.Color(0x3a5570), 0.5);
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
    // a tighter, brighter core shaft nested inside the outer wash
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 0.07, 62, 16, 1, true),
      (cone.material as THREE.ShaderMaterial).clone(),
    );
    core.position.set(31, 0, 0);
    core.rotation.z = Math.PI / 2;
    core.scale.y = -1;
    this.beamGroup.position.copy(LAMP);
    this.beamGroup.add(cone, core);
    // dust motes drifting through the shaft — points in beam-local space
    const dustN = 42;
    const dustPos = new Float32Array(dustN * 3);
    this.dustSeed = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      this.dustSeed[i * 3] = (i * 7.37) % 60;              // x phase along beam
      this.dustSeed[i * 3 + 1] = Math.sin(i * 12.9) * 1.6; // y
      this.dustSeed[i * 3 + 2] = Math.sin(i * 4.7 + 1.3) * 1.6; // z
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffd9a0, size: 0.32, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.beamGroup.add(this.dust);
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
    // shoreline flecks ride the swell instead of floating fixed
    for (const m of this.foamMeshes) {
      m.position.y = WATER_Y + waveY(m.position.x, m.position.z, t) + 0.16;
    }
    // crest foam points follow the surface and fade by crest height
    const cp = this.crest.geometry.attributes.position as THREE.BufferAttribute;
    const cc = this.crest.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) {
      const h = waveY(cp.getX(i), cp.getZ(i), t);
      cp.setY(i, WATER_Y + h + 0.12);
      const c = clamp((h - 0.55) / 0.45, 0, 1);
      cc.setXYZ(i, 0.55 * c, 0.60 * c, 0.62 * c);
    }
    cp.needsUpdate = true;
    cc.needsUpdate = true;

    // beam sweep + its real spotlight
    const yaw = beamYaw(t);
    this.beamGroup.rotation.y = -yaw;
    this.beamGroup.rotation.z = -0.16;          // same downward tilt as the spot target
    const bd = new THREE.Vector3(Math.cos(yaw), -0.16, Math.sin(yaw)).normalize();
    this.spot.target.position.copy(LAMP).addScaledVector(bd, 90);
    // the lamp breathes faintly — the Fresnel shutter wobble
    const flick = 0.9 + 0.1 * Math.sin(t * 13.0) * Math.sin(t * 3.7);

    this.skyMat.uniforms.uT.value = t;
    this.foamMat.uniforms.uT.value = t;
    const beamMat = (this.beamGroup.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    const coreMat = (this.beamGroup.children[1] as THREE.Mesh).material as THREE.ShaderMaterial;
    beamMat.uniforms.uI.value = 0.9 * flick;
    coreMat.uniforms.uI.value = 1.7 * flick;
    this.spot.intensity = 12000 * flick;
    // dust motes drifting down the shaft and slowly swirling
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < this.dustSeed.length / 3; i++) {
      const x0 = this.dustSeed[i * 3], y0 = this.dustSeed[i * 3 + 1], z0 = this.dustSeed[i * 3 + 2];
      const x = ((x0 + t * 2.4) % 62) + 2;
      const spread = 0.12 + x * 0.08;                    // cone widens along +x
      const m = Math.hypot(y0, z0) || 1;
      const k = Math.min(1, 0.8 / m);                    // keep motes inside the cone
      dp.setXYZ(i, x, y0 * k * spread + Math.sin(t * 0.8 + i) * 0.15 * spread, z0 * k * spread);
    }
    dp.needsUpdate = true;

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
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.crest.geometry.dispose();
    (this.crest.material as THREE.Material).dispose();
    this.crestSprite.dispose();
    this.foamMat.dispose();
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

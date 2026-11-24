// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// millridget — a 3D smock windmill on a low ridge at dusk. Blender-built mill
// (assets/mill/model.glb: tapered timber body, slate cap, lattice sails), real
// 3D ridge terrain + instanced grass, raking 2600K sun, a starling flock
// crossing the sky, warm window light. All motion closed-form f(t): sails turn
// slowly, flock sweeps once, light cools into night. Layer2D captions anchored
// to world points (the canvas probe hook records them).
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { CameraRig, orbitPosition } from '../../engine/rig';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { Layer2D, W, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

// beats
const FLOCK = 6.0;    // starlings cross the sky
const GUST = 11.5;    // a gust swings the sails a touch faster
const SETTLE = 16.0;

// ridge heightfield — shared by terrain + object placement
const ridgeH = (x: number, z: number) =>
  3.0 * Math.exp(-(x * x + z * z) / 320) +
  0.9 * Math.exp(-((x - 26) * (x - 26) + (z + 20) * (z + 20)) / 500) +
  0.35 * Math.sin(x * 0.06 + 1.0) * Math.cos(z * 0.05) +
  0.15 * Math.sin(x * 0.4) * Math.sin(z * 0.35);

const MILL_TOP = ridgeH(0, 0);

const CAPTIONS: Array<[number, number, string, [number, number, number]]> = [
  [0.8, 3.0, 'the mill still turns on the ridge', [0, MILL_TOP + 1.0, 0]],
  [4.6, 6.6, 'grass remembers the day', [4, MILL_TOP - 1.5, 4]],
  [8.6, 10.8, 'a murmuration moves through', [0, MILL_TOP + 9.0, -6]],
  [11.2, 13.2, 'one gust finds the sails', [0, MILL_TOP + 5.0, 0]],
  [15.0, 17.4, 'dusk holds the ridge', [0, MILL_TOP + 3.0, 0]],
];

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// dusk sky dome: warm band low toward the sun azimuth (-x), deep blue above
const SKY_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uT;
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.1, 1.0);
    vec3 col = mix(vec3(0.30, 0.16, 0.13), vec3(0.025, 0.035, 0.09), smoothstep(0.0, 0.55, h));
    // sun-side warmth: band tightens toward azimuth of the set sun (-x, slightly -z)
    float sunAmt = smoothstep(0.6, 1.0, dot(normalize(d.xz), normalize(vec2(-1.0, -0.35))));
    col += vec3(0.55, 0.22, 0.06) * sunAmt * exp(-h * 4.5) * 1.4;
    // faint stars high up, twinkling
    vec2 sp = vec2(atan(d.x, d.z) * 30.0, d.y * 60.0);
    float star = step(0.997, h21(floor(sp))) * smoothstep(0.45, 0.8, d.y)
               * (0.4 + 0.6 * sin(uT * 2.0 + h21(floor(sp) + 7.0) * 40.0));
    col += vec3(0.8, 0.85, 1.0) * star;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default class MillridgetScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private skyMat!: THREE.ShaderMaterial;
  private mill!: GLTFInstance;
  private sails!: THREE.Object3D;
  private windowLight = new THREE.PointLight(0xff9a3c, 0.9, 9, 2);
  private starlings!: THREE.InstancedMesh;
  private grass!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();

  override async init() {
    const scene = this.three;

    // ---- lighting: raking 2600K dusk sun from the west, cool ambient sky ----
    const [kr, kg, kb] = blackbodyToLinearSRGB(2600);
    const sun = new THREE.DirectionalLight(new THREE.Color(kr, kg, kb), 3.0);
    sun.position.set(-30, 9, -12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const [cr, cg, cb] = blackbodyToLinearSRGB(7500);
    const hemi = new THREE.HemisphereLight(new THREE.Color(cr, cg, cb), 0x1a1410, 0.5);
    scene.add(hemi);

    // ---- sky dome ----
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: { uT: { value: 0 } },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), this.skyMat);
    scene.add(sky);

    // ---- ridge terrain: displaced grid, grass-scrub PBR ----
    const geo = new THREE.PlaneGeometry(240, 160, 160, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, ridgeH(x, z) - 0.4);
      const g = 0.32 + 0.16 * hash(x * 3.7 + z * 9.1) + 0.08 * Math.sin(x * 0.8);
      colors[i * 3] = g * 0.55;
      colors[i * 3 + 1] = g * 0.62;
      colors[i * 3 + 2] = g * 0.28;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
    }));
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- instanced grass tufts on the slope ----
    const blade = new THREE.ConeGeometry(0.05, 0.5, 4);
    blade.translate(0, 0.25, 0);
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2e3a18, roughness: 0.9 });
    this.grass = new THREE.InstancedMesh(blade, grassMat, 3500);
    let gi = 0;
    for (let i = 0; i < 3500; i++) {
      const a = hash(i * 2.17) * Math.PI * 2;
      const r = 2.5 + Math.sqrt(hash(i * 5.71)) * 42;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
      this.dummy.position.set(x, ridgeH(x, z) - 0.45, z);
      this.dummy.rotation.set((hash(i * 7.3) - 0.5) * 0.5, hash(i * 3.9) * Math.PI * 2, (hash(i * 11.7) - 0.5) * 0.5);
      const s = 0.6 + hash(i * 13.3) * 1.1;
      this.dummy.scale.set(s, s * (0.7 + hash(i * 17.1) * 0.9), s);
      this.dummy.updateMatrix();
      this.grass.setMatrixAt(gi++, this.dummy.matrix);
    }
    scene.add(this.grass);

    // ---- the mill (Blender GLB) ----
    this.mill = await GLTFManager.instantiate(resolveAsset('mill', this.ctx.project ?? 'millridget').url, {
      castShadow: true,
      receiveShadow: true,
    });
    this.mill.root.position.set(0, MILL_TOP - 0.4, 0);
    this.mill.root.rotation.y = 0.35; // face the sails three-quarter to camera
    scene.add(this.mill.root);
    const sails = this.mill.part('sails');
    this.sails = sails ?? this.mill.root;
    this.windowLight.position.set(0, MILL_TOP + 3.2, -2.4);
    scene.add(this.windowLight);

    // ---- starlings: instanced bird silhouettes on a closed-form murmuration ----
    const birdGeo = new THREE.BufferGeometry();
    birdGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.9, 0, 0, 0, 0.12, 0.28, 0, -0.05, 0.02,
      0, 0.12, 0.28, 0.9, 0, 0, 0, -0.05, 0.02,
      0, -0.05, 0.02, 0, 0, -0.28, 0.9, 0, 0,
      0, -0.05, 0.02, -0.9, 0, 0, 0, 0, -0.28,
    ]), 3));
    birdGeo.computeVertexNormals();
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x06070c, side: THREE.DoubleSide });
    this.starlings = new THREE.InstancedMesh(birdGeo, birdMat, 160);
    scene.add(this.starlings);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      sails: t >= 0 && t <= 18 ? 1 : 0,
      flock: t >= FLOCK && t <= FLOCK + 6.5 ? 1 : 0,
      gust: t >= GUST && t <= GUST + 1.4 ? 1 : 0,
      settle: t >= SETTLE && t <= 18.0 ? 1 : 0,
    };
  }

  // closed-form starling position: the flock sweeps left→right past the mill,
  // a thick murmuration ribbon; before/after the window birds rest off-frame
  private starling(i: number, t: number, out: THREE.Vector3): void {
    const u = clamp01((t - FLOCK) / 7.0);
    const ph = hash(i * 7.77);
    const w = ph * Math.PI * 2;
    // flock centroid: arcs across the sky left→right, swelling at mid-pass
    const cx = -40 + 82 * u;
    const cy = MILL_TOP + 9.5 + 2.0 * Math.sin(u * Math.PI) + 0.6 * Math.sin(t * 0.9 + 1.0);
    const cz = -8 + 6 * Math.sin(u * 2.4);
    // murmuration ribbon: birds ride a slow wave around the centroid
    const s = i / 160;
    const ribbon = Math.sin(u * Math.PI * 3 + s * 9.0);
    out.set(
      cx + (ph - 0.5) * 9 + Math.sin(w + t * 2.1 + u * 14.0) * (1.4 + 2.4 * Math.sin(u * Math.PI)),
      cy + Math.sin(w * 2.0 + t * 2.7) * 1.3 + ribbon * 2.2 * (ph - 0.3),
      cz + (hash(i * 3.3) - 0.5) * 5 + Math.cos(w + t * 1.9) * 1.6,
    );
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.skyMat.uniforms.uT.value = t;

    // sails: slow turn, eased harder by the gust — one clock for the mill
    const gust = ss(GUST, GUST + 0.4, t) * (1 - ss(GUST + 1.0, GUST + 1.8, t));
    this.sails.rotation.z = t * 0.42 + 0.9 * gust * (t - GUST);

    // window light breathes faintly; dusk deepens at settle
    const settle = ss(SETTLE, 17.6, t);
    this.windowLight.intensity = 0.8 + 0.2 * Math.sin(t * 5.0) + 0.4 * settle;

    // starlings only during their crossing window
    this.starlings.count = t > FLOCK - 0.5 && t < FLOCK + 7.2 ? 160 : 0;
    for (let i = 0; i < this.starlings.count; i++) {
      this.starling(i, t, this.v);
      this.dummy.position.copy(this.v);
      const flap = Math.sin(t * (14 + hash(i * 2.2) * 6) + i * 1.7);
      this.dummy.rotation.set(0, Math.atan2(1, 0) , flap * 0.9); // banked sweep + wing flap
      const s = 0.5 + hash(i * 9.4) * 0.5;
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.starlings.setMatrixAt(i, this.dummy.matrix);
    }
    this.starlings.instanceMatrix.needsUpdate = true;

    // CameraRig: slow orbit drift holding the mill at mid-frame
    const yaw = -0.35 + t * 0.035 + 0.05 * Math.sin(t * 0.07);
    const rad = 24 - 3.5 * ss(2, 9, t) + 1.5 * settle;
    const pos = orbitPosition([0, MILL_TOP + 4.4, 0], rad, 0.16 + 0.03 * Math.sin(t * 0.05), yaw);
    this.rig.position = pos;
    this.rig.target = [0, MILL_TOP + 4.4 + 0.4 * Math.sin(t * 0.06), 0];
    this.rig.roll = 0.004 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 42 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text, anchor] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        const ndc = this.v.set(anchor[0], anchor[1], anchor[2]).project(this.cam);
        if (ndc.z > 1) continue;
        const cx0 = (ndc.x * 0.5 + 0.5) * W;
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.16, 72), H - 72);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(8, 8, 14, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#ece6d8';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.3,
      bloomThreshold: 0.72,
      bloomRadius: 0.65,
      ca: 0.06,
      grain: 0.06,
      vignette: 0.4,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.mill?.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}

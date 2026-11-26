// THRESHOLD Z7 grey-box blockout. Vending cathedral, 150-195 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; roll: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 149.5, p: [0, 1.65, 1.5], yaw: 0, pitch: 0, roll: 0, fov: 80 },
  { t: 154.0, p: [0, 1.65, 1.5], yaw: 0, pitch: 31, roll: 0, fov: 80 },
  { t: 158.0, p: [0, 1.65, 1.5], yaw: 0, pitch: 6, roll: 0, fov: 78 },
  { t: 160.5, p: [-5.8, 1.65, -5.8], yaw: -66, pitch: 0, roll: 0, fov: 66 },
  { t: 163.0, p: [-7.6, 1.65, -9.2], yaw: -18, pitch: 0, roll: 0, fov: 68 },
  { t: 165.5, p: [-3.6, 1.65, -11.0], yaw: 18, pitch: 0, roll: 0, fov: 70 },
  { t: 168.0, p: [0, 1.6, -13.0], yaw: 0, pitch: 0, roll: 0, fov: 84 },
  { t: 170.0, p: [0, 1.6, -24.0], yaw: 0, pitch: 0, roll: 2, fov: 84 },
  { t: 172.0, p: [0, 1.15, -33.5], yaw: 163, pitch: -12, roll: 12, fov: 86 },
  { t: 173.4, p: [0, 0.35, -34.6], yaw: 184, pitch: -5, roll: 70, fov: 90 },
  { t: 175.0, p: [0, 0.48, -34.6], yaw: 174, pitch: 2, roll: 58, fov: 86 },
  { t: 176.0, p: [0, 1.6, -35.8], yaw: 0, pitch: 0, roll: 0, fov: 86 },
  { t: 181.0, p: [0, 1.6, -63.0], yaw: 0, pitch: 0, roll: -2, fov: 88 },
  { t: 186.0, p: [0, 1.35, -89.0], yaw: 0, pitch: -8, roll: 0, fov: 92 },
  { t: 189.0, p: [0, -11.5, -96.0], yaw: 0, pitch: 38, roll: 180, fov: 95 },
  { t: 192.0, p: [0, -27.5, -101.0], yaw: 0, pitch: -65, roll: 360, fov: 95 },
  { t: 193.5, p: [0, -29.1, -101.5], yaw: 0, pitch: 8, roll: 360, fov: 82 },
  { t: 195.6, p: [0, -28.35, -101.5], yaw: 0, pitch: 0, roll: 360, fov: 76 },
];

function poseAt(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1]!.t) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const u = smooth((t - a.t) / (b.t - a.t));
  return {
    p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)] as [number, number, number],
    yaw: lerp(a.yaw, b.yaw, u),
    pitch: lerp(a.pitch, b.pitch, u),
    roll: lerp(a.roll, b.roll, u),
    fov: lerp(a.fov, b.fov, u),
  };
}

function lookDir(yawDeg: number, pitchDeg: number) {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

export default class ThresholdZ7Cathedral extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.08, 280);
  private flash = new THREE.SpotLight(0xffc98a, 1.6, 26, 22 * Math.PI / 180, 0.58, 1.35);
  private flashTarget = new THREE.Object3D();
  private beamCone!: THREE.Mesh;
  private machineBodies!: THREE.InstancedMesh;
  private machineFronts!: THREE.InstancedMesh;
  private machineData: { x: number; y: number; z: number; seed: number }[] = [];
  private tenant = new THREE.Group();
  private reachArm = new THREE.Group();
  private lint = new THREE.Group();
  private assembly: { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; seed: number }[] = [];
  private rift!: THREE.Mesh;
  private riftEdges: THREE.Mesh[] = [];
  private shaftLights: THREE.MeshBasicMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3(1, 1, 1);
  private tmpP = new THREE.Vector3();

  private mat(color: number, roughness = 0.55, metalness = 0, emissive = 0, emissiveIntensity = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.disposables.push(m);
    return m;
  }

  private box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], mat: THREE.Material, rot: [number, number, number] = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  private cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, pos: [number, number, number], mat: THREE.Material, seg = 10) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  private sphere(parent: THREE.Object3D, r: number, pos: [number, number, number], mat: THREE.Material, scale: [number, number, number] = [1, 1, 1]) {
    const g = new THREE.SphereGeometry(r, 12, 8);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  private buildTenant() {
    const tile = this.mat(0xb9d9d7, 0.24);
    const grout = this.mat(0x1a2224, 0.65);
    const paper = this.mat(0xd8c69d, 0.82);
    const felt = this.mat(0x6b3f24, 0.94);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);
    const red = this.mat(0xa82d27, 0.28);
    const yellow = this.mat(0xd0aa35, 0.3);
    const blue = this.mat(0x2e5fa8, 0.28);
    const glass = new THREE.MeshStandardMaterial({ color: 0x25333a, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.64 });
    this.disposables.push(glass);

    this.box(this.tenant, [0.28, 0.34, 0.24], [0, 3.96, 0], tile);
    this.box(this.tenant, [0.3, 0.035, 0.25], [0, 3.96, 0.01], grout);
    for (let i = 0; i < 4; i++) this.cyl(this.tenant, 0.07, 0.085, 0.2, [0, 3.66 - i * 0.14, 0], felt, 8);
    this.box(this.tenant, [0.78, 1.05, 0.34], [0, 2.82, 0], glass);
    for (let i = 0; i < 6; i++) this.box(this.tenant, [0.66, 0.035, 0.37], [0, 2.42 + i * 0.16, 0.01], chrome);
    this.box(this.tenant, [0.58, 0.46, 0.34], [0, 2.02, 0], paper, [0, 0, 0.1]);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const ballMat = i % 3 === 0 ? red : i % 3 === 1 ? yellow : blue;
        this.sphere(this.tenant, 0.13 - i * 0.006, [side * (0.47 + i * 0.15), 3.18 - i * 0.13, 0], ballMat, [1, 0.9, 1]);
      }
      for (let i = 0; i < 4; i++) this.cyl(this.tenant, 0.025, 0.036, 0.5, [side * (1.18 + i * 0.05), 2.35 - i * 0.07, 0.02 * i], chrome, 8).rotation.z = side * (1.1 + i * 0.18);
      for (let i = 0; i < 5; i++) this.box(this.tenant, [0.035, 0.42, 0.07], [side * (0.9 + i * 0.04), 2.25 - i * 0.03, 0.1], paper, [0, 0, side * (-0.3 - i * 0.1)]);
      for (let i = 0; i < 5; i++) {
        this.box(this.tenant, [0.22, 0.28, 0.2], [side * 0.3, 1.7 - i * 0.29, 0], i % 2 ? tile : paper, [0, 0, side * 0.06 * i]);
      }
      this.box(this.tenant, [0.34, 0.16, 0.48], [side * 0.32, 0.12, 0.06], grout);
    }
    for (let i = 0; i < 7; i++) this.cyl(this.tenant, 0.035, 0.045, 0.36, [0, 2.3 - i * 0.22, -0.22], chrome, 8).rotation.x = 0.25;
    this.tenant.visible = false;
    this.s.add(this.tenant);
  }

  private buildReachArm() {
    const paper = this.mat(0xd8c69d, 0.82);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);
    const red = this.mat(0xa82d27, 0.28);
    const tile = this.mat(0xb9d9d7, 0.26);
    // Overscaled grey-box reach: a patchwork upper arm extending toward the fallen camera.
    for (let i = 0; i < 7; i++) {
      const mat = [red, chrome, paper, tile][i % 4]!;
      this.box(this.reachArm, [0.34 - i * 0.018, 0.28 - i * 0.012, 0.68], [0, 2.95 - i * 0.11, -0.35 - i * 0.58], mat, [0.06 * i, 0.03 * (i % 2 ? 1 : -1), 0.04 * i]);
    }
    for (let f = 0; f < 5; f++) {
      const x = (f - 2) * 0.095;
      this.box(this.reachArm, [0.055, 0.055, 0.78], [x, 2.18 - Math.abs(f - 2) * 0.025, -4.35 - 0.08 * Math.abs(f - 2)], f % 2 ? chrome : paper, [0.12 * (f - 2), 0.05 * (f - 2), 0]);
      this.box(this.reachArm, [0.07, 0.04, 0.16], [x, 2.15 - Math.abs(f - 2) * 0.025, -4.78 - 0.08 * Math.abs(f - 2)], chrome, [0.3, 0, 0]);
    }
    const armLight = new THREE.PointLight(0xffc98a, 2.4, 7, 1.35);
    armLight.position.set(0, 2.55, -3.0);
    this.reachArm.add(armLight);
    this.reachArm.visible = false;
    this.s.add(this.reachArm);
  }

  override init() {
    this.s.background = new THREE.Color(0x020407);
    this.s.fog = new THREE.FogExp2(0x020407, 0.012);

    const floorMat = this.mat(0x05070a, 0.18, 0.42);
    const darkMetal = this.mat(0x111820, 0.42, 0.55);
    const productRed = this.mat(0xa22a28, 0.35);
    const productTeal = this.mat(0x2aa9a4, 0.35);
    const paper = this.mat(0xd8c69d, 0.82);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);

    // Polished black nave floor and central aisle slab.
    this.box(this.s, [31, 0.12, 210], [0, -0.06, -98], floorMat);
    this.box(this.s, [5.4, 0.025, 210], [0, 0.015, -98], this.mat(0x090c11, 0.12, 0.55));

    // Stacked vending-machine walls as instanced hard-surface bodies plus glowing glass fronts.
    const rows = 62;
    const levels = 18;
    const count = rows * levels * 2;
    const bodyGeo = new THREE.BoxGeometry(0.86, 2.2, 2.55);
    const frontGeo = new THREE.BoxGeometry(0.08, 1.65, 1.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.38, metalness: 0.6 });
    const frontMat = new THREE.MeshStandardMaterial({ color: 0x93c9ff, roughness: 0.22, metalness: 0.05, emissive: 0x5aa8ff, emissiveIntensity: 0.25 });
    this.disposables.push(bodyGeo, frontGeo, bodyMat, frontMat);
    this.machineBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.machineFronts = new THREE.InstancedMesh(frontGeo, frontMat, count);
    this.machineBodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.machineFronts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    let k = 0;
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        for (let lev = 0; lev < levels; lev++) {
          const z = -2.5 - r * 3.25 + (hash(r * 7 + lev) - 0.5) * 0.12;
          const y = 1.1 + lev * 2.45;
          const x = side * (14.4 + 0.25 * hash(lev * 13 + r));
          this.tmpP.set(x, y, z);
          this.tmpQ.identity();
          this.tmpS.set(1 + 0.05 * hash(k), 1, 0.9 + 0.14 * hash(k * 2));
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineBodies.setMatrixAt(k, this.tmpM);
          this.tmpP.set(x - side * 0.48, y + 0.05, z);
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineFronts.setMatrixAt(k, this.tmpM);
          this.machineData.push({ x, y, z, seed: hash(k * 3.7) });
          k++;
        }
      }
    }
    this.machineBodies.instanceMatrix.needsUpdate = true;
    this.machineFronts.instanceMatrix.needsUpdate = true;
    this.s.add(this.machineBodies, this.machineFronts);

    // Upside-down ceiling machine hints 60 m overhead.
    for (let z = -12; z > -190; z -= 9) {
      for (let x = -10; x <= 10; x += 5) {
        this.box(this.s, [2.2, 0.75, 1.4], [x, 57 + 1.5 * hash(z + x), z], darkMetal, [Math.PI, 0, 0]);
        const lm = new THREE.MeshBasicMaterial({ color: 0x315070 });
        this.disposables.push(lm);
        this.box(this.s, [1.4, 0.04, 0.9], [x, 56.4 + 1.5 * hash(z + x), z], lm);
      }
    }

    // Close-up product shelf items named in the storyboard: phone, ball, tile, page, puppet, flashlight price 0.
    const beige = this.mat(0xcdbd97, 0.5);
    this.box(this.s, [0.24, 0.16, 0.18], [-13.75, 1.25, -5.0], beige);
    this.sphere(this.s, 0.13, [-13.75, 1.3, -6.0], productRed);
    this.box(this.s, [0.22, 0.22, 0.04], [-13.75, 1.3, -7.0], this.mat(0xb9d9d7, 0.28));
    this.box(this.s, [0.25, 0.32, 0.025], [-13.75, 1.3, -8.0], paper, [0, 0, 0.15]);
    this.box(this.s, [0.18, 0.3, 0.12], [-13.75, 1.3, -9.0], this.mat(0x704222, 0.95));
    this.box(this.s, [0.09, 0.38, 0.09], [-13.75, 1.32, -10.0], chrome);
    this.box(this.s, [0.28, 0.08, 0.02], [-13.72, 1.7, -10.0], new THREE.MeshBasicMaterial({ color: 0xd8f2ff }));

    // Assembly debris pieces that converge into the Tenant silhouette.
    const pieceMats = [productRed, productTeal, paper, chrome, beige];
    for (let i = 0; i < 28; i++) {
      const m = pieceMats[i % pieceMats.length]!;
      const piece = i % 3 === 0
        ? this.sphere(this.s, 0.09 + 0.04 * hash(i), [0, -20, 0], m)
        : this.box(this.s, [0.16 + 0.1 * hash(i), 0.12 + 0.12 * hash(i * 2), 0.1 + 0.1 * hash(i * 3)], [0, -20, 0], m);
      const side = i % 2 ? -1 : 1;
      const start = new THREE.Vector3(side * (11 + hash(i) * 2), 0.7 + hash(i * 2) * 1.6, -8 - hash(i * 3) * 16);
      const end = new THREE.Vector3((hash(i * 4) - 0.5) * 0.9, 0.5 + hash(i * 5) * 3.0, -18 + (hash(i * 6) - 0.5) * 0.5);
      this.assembly.push({ mesh: piece, start, end, seed: hash(i * 9) });
      piece.visible = false;
    }
    this.buildTenant();
    this.buildReachArm();

    // Central floor rift, initially hairline and invisible, then widening.
    const riftMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.disposables.push(riftMat);
    this.rift = this.box(this.s, [1, 0.025, 92], [0, 0.04, -92], riftMat);
    this.rift.visible = false;
    const edgeMat = this.mat(0x25313b, 0.28, 0.55, 0x365d78, 0.4);
    for (const side of [-1, 1]) {
      const e = this.box(this.s, [0.18, 0.12, 92], [side * 0.55, 0.06, -92], edgeMat, [0, 0, side * 0.06]);
      e.visible = false;
      this.riftEdges.push(e);
    }

    // Vertical fall shaft below the rift: repeating machine-light streaks and warm home glow below.
    for (let i = 0; i < 52; i++) {
      const lm = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6fbaff : 0xbfe8ff, transparent: true, opacity: 0.45 });
      this.disposables.push(lm);
      this.shaftLights.push(lm);
      const side = i % 2 ? -1 : 1;
      this.box(this.s, [0.06, 1.4 + hash(i) * 2.5, 0.18], [side * (4 + hash(i * 2) * 6), -2 - i * 0.62, -98 - hash(i * 3) * 9], lm);
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1;
      const y = -4.0 - i * 1.45;
      const z = -96.5 - (i % 5) * 2.2;
      const x = side * (3.7 + hash(i * 4) * 2.3);
      this.box(this.s, [1.15, 1.8, 0.82], [x, y, z], darkMetal, [0.08 * hash(i), 0.15 * side, 0.05 * side]);
      const fm = new THREE.MeshBasicMaterial({ color: i % 3 ? 0x5aa8ff : 0xbfe8ff });
      this.disposables.push(fm);
      this.box(this.s, [0.9, 1.15, 0.045], [x - side * 0.43, y + 0.05, z], fm, [0.08 * hash(i), 0.15 * side, 0.05 * side]);
    }

    const warmGlow = this.mat(0xffbd65, 0.6, 0, 0xff9b38, 2.8);
    this.box(this.s, [7.5, 0.08, 7.5], [0, -30.05, -101.5], warmGlow);
    this.box(this.s, [5.5, 0.025, 5.5], [0, -29.98, -101.5], this.mat(0x8a5b35, 0.7));

    // Cathedral dressing: coin piles, toppled machine, cables/chains, receipt strips, altar-like change machine.
    for (let i = 0; i < 9; i++) {
      this.cyl(this.s, 0.28 + 0.1 * hash(i), 0.34 + 0.1 * hash(i), 0.05 + 0.08 * hash(i * 2), [(hash(i * 3) - 0.5) * 6, 0.04, -12 - i * 9], chrome, 16);
    }
    this.box(this.s, [1.3, 2.2, 0.8], [5.4, 0.55, -48], darkMetal, [0.25, 0.2, 1.25]);
    for (let i = 0; i < 12; i++) this.cyl(this.s, 0.015, 0.02, 5 + hash(i) * 4, [-9 + hash(i * 2) * 18, 28, -30 - i * 11], darkMetal, 6);
    for (let i = 0; i < 10; i++) this.box(this.s, [0.08, 0.01, 0.55], [(hash(i * 5) - 0.5) * 4, 0.04, -15 - i * 6], paper, [0, hash(i) * 3, 0]);
    this.box(this.s, [1.7, 2.3, 1.0], [0, 1.15, -170], chrome);
    this.box(this.s, [1.1, 0.18, 0.04], [0, 1.65, -169.45], new THREE.MeshBasicMaterial({ color: 0x9fdcff }));

    // Lint with warm relight glow.
    const lintBody = this.mat(0x704222, 0.98);
    const lintWing = this.mat(0x9a6035, 0.98);
    const glow = this.mat(0xff8c2a, 0.5, 0, 0xff7418, 2.8);
    this.cyl(this.lint, 0.032, 0.045, 0.14, [0, 0, 0], lintBody, 10).rotation.x = Math.PI / 2;
    this.box(this.lint, [0.17, 0.02, 0.09], [-0.085, 0, 0.005], lintWing, [0, 0, 0.35]);
    this.box(this.lint, [0.17, 0.02, 0.09], [0.085, 0, 0.005], lintWing, [0, 0, -0.35]);
    this.cyl(this.lint, 0.03, 0.035, 0.05, [0, -0.005, -0.07], glow, 10).rotation.x = Math.PI / 2;
    this.lint.visible = false;
    this.s.add(this.lint);

    // Flashlight and beam cone.
    this.flash.castShadow = false;
    this.flash.target = this.flashTarget;
    this.s.add(this.flash, this.flashTarget);
    const coneGeo = new THREE.ConeGeometry(1, 8, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beamCone = new THREE.Mesh(coneGeo, coneMat);
    this.disposables.push(coneGeo, coneMat);
    this.s.add(this.beamCone);

    this.s.add(new THREE.AmbientLight(0x152033, 0.18));
  }

  private flicker(t: number) {
    const active = (t >= 163 && t < 173.4);
    if (!active) return 1;
    const step = Math.floor(t * 14);
    return hash(step) < 0.42 ? 0.2 + 0.35 * hash(step + 4) : 0.82 + 0.18 * hash(step + 9);
  }

  private gait(t: number): [number, number, number] {
    const running = (t >= 168 && t < 172) || (t >= 176 && t < 186);
    const walking = t >= 158 && t < 163;
    if (!running && !walking) return [0.003 * Math.sin(t * 1.57), 0.006 * Math.sin(t * 1.57), 0];
    const rate = running ? 3 : 1.9;
    const amp = running ? 0.045 : 0.02;
    const ph = t * rate * Math.PI * 2;
    return [Math.sin(ph) * amp * 0.6, Math.abs(Math.sin(ph)) * amp, Math.sin(ph * 0.5) * amp * 0.25];
  }

  private updateMachineWave(t: number, camZ: number) {
    const frontColor = new THREE.Color();
    const bodyColor = new THREE.Color();
    for (let i = 0; i < this.machineData.length; i++) {
      const d = this.machineData[i]!;
      const activation = 154 + 3 * clamp((-d.z - 2) / 198);
      let on = smooth((t - activation) / 0.22);
      // During the chase, machines behind the runner thunk off in a wave moving toward camera.
      if (t >= 168 && t < 176) {
        const chaseOff = 168 + clamp((-camZ + d.z) / 34) * 4;
        if (d.z > camZ - 2) on *= 1 - smooth((t - chaseOff) / 0.28);
      }
      const flick = 0.88 + 0.12 * hash(Math.floor(t * 8) + i);
      frontColor.setRGB(0.08 + on * 0.55 * flick, 0.12 + on * 0.75 * flick, 0.18 + on * 1.0 * flick);
      bodyColor.setRGB(0.05 + on * 0.08, 0.065 + on * 0.1, 0.085 + on * 0.14);
      this.machineFronts.setColorAt(i, frontColor);
      this.machineBodies.setColorAt(i, bodyColor);
    }
    this.machineFronts.instanceColor!.needsUpdate = true;
    this.machineBodies.instanceColor!.needsUpdate = true;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = poseAt(t);
    const bob = this.gait(t);
    this.cam.position.set(pose.p[0] + bob[0], pose.p[1] + bob[1], pose.p[2] + bob[2]);
    const dir = lookDir(pose.yaw, pose.pitch);
    this.cam.fov = pose.fov;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(this.cam.position.clone().add(dir.clone().multiplyScalar(7)));
    this.cam.rotateZ(pose.roll * Math.PI / 180);

    // Machine wave and chase darkness are pure timeline functions.
    this.updateMachineWave(t, this.cam.position.z);

    // Assembly cascade: debris rolls inward and stacks into the full Tenant.
    const asm = smooth((t - 163) / 5);
    const showPieces = t >= 163 && t < 167.5;
    for (const a of this.assembly) {
      a.mesh.visible = showPieces;
      if (!showPieces) continue;
      const u = clamp(asm * 1.25 - a.seed * 0.25);
      const arc = Math.sin(Math.PI * u) * (1.5 + a.seed);
      a.mesh.position.copy(a.start).lerp(a.end, u);
      a.mesh.position.y += arc;
      a.mesh.rotation.set(t * (1 + a.seed), t * 1.7, t * 0.8);
    }

    // Tenant stop-start motion and pursuit position.
    const tenantVisible = t >= 167.2 && t < 186;
    this.tenant.visible = tenantVisible;
    if (tenantVisible) {
      let z = -18;
      if (t >= 168) z = this.cam.position.z + 4.8 + 0.4 * Math.sin(Math.floor(t * 3.3) * 2.1);
      const burst = hash(Math.floor(t * 3.3)) > 0.45 ? 1 : 0;
      this.tenant.position.set(0.15 * Math.sin(t * 1.7), 0, z);
      this.tenant.rotation.z = 0.12 * burst + 0.05 * Math.sin(t * 2.2);
      this.tenant.rotation.y = t >= 168 ? Math.PI : 0;
      const reach = smooth((t - 172.4) / 0.8) * (1 - smooth((t - 174.0) / 0.5));
      this.tenant.scale.set(1 + reach * 0.12, 1, 1 + reach * 0.35);
    }

    const reachOn = t >= 171.65 && t < 174.2;
    this.reachArm.visible = reachOn;
    if (reachOn) {
      const z = this.cam.position.z + 4.8;
      const ext = smooth((t - 171.65) / 0.9);
      this.reachArm.position.set(0.08 * Math.sin(t * 2), -0.15, z + 0.15);
      this.reachArm.rotation.x = -0.08 + 0.05 * Math.sin(t * 5);
      this.reachArm.rotation.y = 0.04 * Math.sin(t * 3);
      this.reachArm.scale.set(1.25, 1.25, 0.45 + ext * 0.75);
    }

    // Lint lands on the dead flashlight and relights it warm.
    const lintOn = t >= 174.0 && t < 176.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const lp = this.cam.position.clone().add(dir.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0.08, -0.12, 0));
      this.lint.position.copy(lp);
      this.lint.scale.setScalar(1.55);
      this.flash.position.copy(lp);
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.42;
      this.lint.children[1]!.rotation.z = 0.35 + flap;
      this.lint.children[2]!.rotation.z = -0.35 - flap;
    }

    // Rift opens ahead after the relit run, with edge slabs tipping outward.
    const riftOpen = smooth((t - 176) / 7.5);
    this.rift.visible = riftOpen > 0;
    this.rift.scale.x = Math.max(0.02, riftOpen * 7.5);
    this.riftEdges.forEach((e, i) => {
      e.visible = riftOpen > 0;
      e.position.x = (i === 0 ? -1 : 1) * (0.4 + riftOpen * 3.7);
      e.rotation.z = (i === 0 ? 1 : -1) * riftOpen * 0.24;
    });

    // Falling streaks slide upward past the camera as a pure function of time.
    this.shaftLights.forEach((m, i) => {
      const fall = t >= 186 && t < 192 ? (t - 186) * 4 : 0;
      m.opacity = 0.25 + 0.35 * hash(i + Math.floor((t + fall) * 5));
    });

    // Flashlight: 25%, dies at 173.4, returns warm at 40% after Lint.
    const dead = t >= 173.35 && t < 174.55;
    const relit = t >= 174.55;
    const lag = poseAt(Math.max(149.5, t - 0.08));
    const lagDir = lookDir(lag.yaw, lag.pitch);
    const right = new THREE.Vector3(Math.cos(lag.yaw * Math.PI / 180), 0, Math.sin(lag.yaw * Math.PI / 180));
    const lp = new THREE.Vector3(...lag.p).add(right.multiplyScalar(0.25)).add(new THREE.Vector3(0, -0.2, 0)).add(lagDir.clone().multiplyScalar(0.1));
    const lt = lp.clone().add(lagDir.clone().multiplyScalar(8));
    this.flash.position.copy(lp);
    this.flashTarget.position.copy(lt);
    this.flash.color.setHex(relit ? 0xff9a42 : 0xffc98a);
    this.flash.intensity = dead ? 0 : (relit ? 1.4 : 1.1) * this.flicker(t);
    const cm = this.beamCone.material as THREE.MeshBasicMaterial;
    cm.color.setHex(relit ? 0xff9a42 : 0xffc98a);
    cm.opacity = 0;
    this.beamCone.position.copy(lp.clone().lerp(lt, 0.5));
    this.beamCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lagDir.clone().negate().normalize());

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(dead ? 0x000000 : 0x020407, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return { exposure: dead ? 0.15 : 0.92, bloom: 0.28, bloomThreshold: 0.8, vignette: 0.32, grain: 0.035, ca: 0.1 };
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
    this.machineBodies?.dispose();
    this.machineFronts?.dispose();
  }
}

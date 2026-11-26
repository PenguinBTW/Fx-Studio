// THRESHOLD Z5 grey-box blockout. Motel corridor at night, 105-130 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 104.7, p: [0, 1.65, 1.8], yaw: 0, pitch: 0, fov: 72 },
  { t: 108.5, p: [0, 1.65, -3.8], yaw: 0, pitch: 0, fov: 72 },
  { t: 110.0, p: [0, 1.65, -5.7], yaw: 33, pitch: -2, fov: 70 },
  { t: 111.5, p: [0, 1.65, -7.2], yaw: 18, pitch: 0, fov: 72 },
  { t: 113.0, p: [0, 1.65, -9.4], yaw: -34, pitch: 1, fov: 72 },
  { t: 114.5, p: [0, 1.65, -12.7], yaw: 18, pitch: 0, fov: 66 },
  { t: 117.0, p: [0, 1.65, -14.2], yaw: 31, pitch: 0, fov: 62 },
  { t: 120.0, p: [0, 1.65, -14.2], yaw: 211, pitch: 1, fov: 66 },
  { t: 120.6, p: [0, 1.65, -14.2], yaw: 4, pitch: 0, fov: 68 },
  { t: 121.5, p: [0, 1.65, -14.2], yaw: 0, pitch: 0, fov: 70 },
  { t: 122.4, p: [1.6, 1.25, -16.6], yaw: -75, pitch: -5, fov: 70 },
  { t: 124.0, p: [2.15, 1.05, -17.2], yaw: -92, pitch: 0, fov: 70 },
  { t: 128.0, p: [2.15, 1.05, -17.2], yaw: -82, pitch: 2, fov: 66 },
  { t: 130.6, p: [2.05, 1.35, -17.2], yaw: -80, pitch: 0, fov: 66 },
];

function poseAt(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && t >= KEYS[i + 1]!.t) i++;
  const a = KEYS[i]!, b = KEYS[i + 1]!;
  const u = smooth((t - a.t) / (b.t - a.t));
  let dyaw = b.yaw - a.yaw;
  if (dyaw > 180) dyaw -= 360;
  if (dyaw < -180) dyaw += 360;
  return {
    p: [lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u)] as [number, number, number],
    yaw: a.yaw + dyaw * u,
    pitch: lerp(a.pitch, b.pitch, u),
    fov: lerp(a.fov, b.fov, u),
  };
}

function lookDir(yawDeg: number, pitchDeg: number) {
  const y = yawDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  return new THREE.Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p));
}

export default class ThresholdZ5Motel extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 90);
  private flash = new THREE.SpotLight(0xffc98a, 3.5, 24, 22 * Math.PI / 180, 0.55, 1.4);
  private flashTarget = new THREE.Object3D();
  private beamCone!: THREE.Mesh;
  private tenant = new THREE.Group();
  private lint = new THREE.Group();
  private tvScreens: THREE.MeshStandardMaterial[] = [];
  private neonMats: THREE.MeshStandardMaterial[] = [];
  private rainLines: THREE.Mesh[] = [];
  private footprintMats: THREE.MeshStandardMaterial[] = [];
  private disposables: { dispose(): void }[] = [];

  private mat(color: number, roughness = 0.7, metalness = 0, emissive = 0, emissiveIntensity = 0) {
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

  private cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, pos: [number, number, number], mat: THREE.Material, seg = 12) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  override init() {
    this.s.background = new THREE.Color(0x050608);
    this.s.fog = new THREE.FogExp2(0x050608, 0.035);

    const carpet = this.mat(0x351820, 0.32);
    const carpetTeal = this.mat(0x153a38, 0.42);
    const wall = this.mat(0x5c4a39, 0.78);
    const ceiling = this.mat(0x403b35, 0.82);
    const doorMat = this.mat(0x4b2418, 0.55);
    const trim = this.mat(0x241912, 0.65);
    const brass = this.mat(0xa57328, 0.38, 0.65);
    const dark = this.mat(0x070808, 0.8);
    const orange = this.mat(0xff8a26, 0.35, 0, 0xff6a18, 1.8);
    const neonPink = this.mat(0xff2e8f, 0.3, 0, 0xff2e8f, 4.5);
    const neonTeal = this.mat(0x25e7dc, 0.3, 0, 0x25e7dc, 4.0);
    this.neonMats.push(neonPink, neonTeal);

    // Corridor shell: wet carpet, walls, low ceiling, skirting and end window.
    this.box(this.s, [3.2, 0.08, 43], [0, -0.04, -18.8], carpet);
    this.box(this.s, [0.12, 2.7, 43], [-1.66, 1.35, -18.8], wall);
    this.box(this.s, [0.12, 2.7, 43], [1.66, 1.35, -18.8], wall);
    this.box(this.s, [3.3, 0.1, 43], [0, 2.72, -18.8], ceiling);
    this.box(this.s, [0.08, 0.16, 43], [-1.58, 0.08, -18.8], trim);
    this.box(this.s, [0.08, 0.16, 43], [1.58, 0.08, -18.8], trim);
    this.box(this.s, [3.3, 2.7, 0.14], [0, 1.35, -40.2], wall);

    // Wet carpet pattern: alternating dim teal/burgundy woven diamonds.
    for (let zi = 0; zi < 34; zi++) {
      for (let xi = -1; xi <= 1; xi++) {
        const z = 0.5 - zi * 1.15;
        const m = (zi + xi) % 2 === 0 ? carpetTeal : carpet;
        this.box(this.s, [0.32, 0.012, 0.18], [xi * 0.75 + 0.1 * hash(zi + xi), 0.012, z], m, [0, 0.5 * (xi % 2), 0]);
      }
    }

    // Doors every 4 m; right side even numbers, left odd. Room 217 is the open hero room.
    for (let i = 0; i < 10; i++) {
      const z = -4 - i * 4;
      for (const side of [-1, 1]) {
        const x = side * 1.58;
        this.box(this.s, [0.16, 2.1, 1.02], [x, 1.05, z], trim);
        const is217 = side === 1 && i === 4;
        const ajar = side === 1 && i >= 1 && i <= 4;
        if (!is217) {
          const door = this.box(this.s, [0.08, 1.95, 0.82], [x - side * 0.02, 1.02, z], doorMat, [0, ajar ? side * 0.42 : 0, 0]);
          door.position.x += ajar ? side * 0.22 : 0;
        }
        this.box(this.s, [0.025, 0.12, 0.18], [x - side * 0.09, 1.62, z - 0.28], brass);
        this.box(this.s, [0.035, 0.05, 0.18], [x - side * 0.12, 1.0, z + 0.25], brass);
      }
    }

    // CRTs glow inside the ajar rooms; screen geometry stands in for low-res CCTV feeds.
    const crtBody = this.mat(0x151719, 0.45);
    for (let i = 1; i <= 4; i++) {
      const z = -4 - i * 4 - 0.35;
      this.box(this.s, [0.72, 0.52, 0.55], [2.25, 0.85, z], crtBody, [0, -0.35, 0]);
      const smat = this.mat(0x6ca8ff, 0.25, 0, 0x6ca8ff, 2.2);
      this.tvScreens.push(smat);
      this.box(this.s, [0.5, 0.34, 0.025], [1.98, 0.9, z + 0.02], smat, [0, -1.18, 0]);
    }

    // Room 217 interior blockout: bed, lamp, dresser, curtain and TV.
    this.box(this.s, [3.7, 0.08, 4.4], [3.35, -0.04, -18.2], this.mat(0x2a1518, 0.55));
    this.box(this.s, [3.7, 2.7, 0.1], [3.35, 1.35, -20.35], wall);
    this.box(this.s, [0.1, 2.7, 4.4], [5.15, 1.35, -18.2], wall);
    this.box(this.s, [1.8, 0.48, 0.95], [4.05, 0.24, -19.25], this.mat(0x6a4c3a, 0.75));
    this.box(this.s, [1.7, 0.16, 0.8], [4.05, 0.58, -19.25], this.mat(0xb7a893, 0.8));
    this.box(this.s, [0.75, 0.75, 0.55], [2.35, 0.38, -19.45], this.mat(0x3a2419, 0.6));
    this.cyl(this.s, 0.09, 0.12, 0.58, [2.35, 1.05, -19.45], brass, 10);
    this.cyl(this.s, 0.26, 0.18, 0.28, [2.35, 1.4, -19.45], orange, 16);
    this.box(this.s, [1.0, 0.68, 0.64], [2.6, 0.85, -17.2], crtBody, [0, 0.85, 0]);
    const heroTvMat = this.mat(0x7daaff, 0.2, 0, 0x7daaff, 2.7);
    this.tvScreens.push(heroTvMat);
    this.box(this.s, [0.72, 0.47, 0.025], [2.26, 0.9, -17.55], heroTvMat, [0, 0.85, 0]);
    this.box(this.s, [0.08, 1.8, 1.1], [4.95, 1.1, -17.15], this.mat(0x381f2d, 0.9));

    // Window and rain-streaked neon vacancy sign at the corridor end.
    this.box(this.s, [2.15, 1.5, 0.04], [0, 1.35, -40.1], this.mat(0x0a1018, 0.2, 0, 0x071a24, 0.25));
    this.box(this.s, [1.65, 0.18, 0.04], [0, 1.72, -39.95], neonPink);
    this.box(this.s, [1.25, 0.14, 0.04], [0, 1.38, -39.94], neonTeal);
    this.box(this.s, [0.16, 0.75, 0.04], [-0.65, 1.15, -39.93], neonPink, [0, 0, 0.18]);
    this.box(this.s, [0.16, 0.75, 0.04], [0.65, 1.15, -39.93], neonTeal, [0, 0, -0.18]);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x9bd8ff, transparent: true, opacity: 0.38 });
    this.disposables.push(rainMat);
    for (let i = 0; i < 34; i++) {
      const line = this.box(this.s, [0.012, 0.28 + 0.2 * hash(i), 0.012], [-0.95 + 1.9 * hash(i * 2), 0.75 + 1.3 * hash(i * 3), -39.88], rainMat);
      line.userData.seed = hash(i * 7);
      this.rainLines.push(line);
    }

    // Sodium sconces, one broken/dark near room 217.
    for (let i = 0; i < 6; i++) {
      const z = -3.5 - i * 6.5;
      const side = i % 2 ? -1 : 1;
      this.box(this.s, [0.14, 0.32, 0.22], [side * 1.5, 1.85, z], brass);
      const on = i !== 4;
      this.box(this.s, [0.2, 0.18, 0.28], [side * 1.44, 1.82, z], on ? orange : dark);
      if (on) {
        const l = new THREE.PointLight(0xff8a2a, 0.9, 7, 1.8);
        l.position.set(side * 1.25, 1.75, z);
        this.s.add(l);
      }
    }

    // Motel dressing blockout: ice machine, housekeeping cart, payphone, small vending machine, tray, umbrella.
    this.box(this.s, [0.9, 1.45, 0.75], [-1.05, 0.72, -30], this.mat(0x5d666c, 0.4, 0.35));
    this.box(this.s, [0.65, 0.16, 0.08], [-1.05, 1.12, -29.6], this.mat(0x9fb5c2, 0.28, 0.5));
    this.box(this.s, [0.9, 0.7, 0.55], [1.0, 0.36, -11.6], this.mat(0x4c4a42, 0.7));
    this.box(this.s, [0.8, 0.08, 0.5], [1.0, 0.78, -11.6], this.mat(0xb8a37f, 0.65));
    this.box(this.s, [0.46, 1.3, 0.28], [-1.35, 0.75, -7.4], this.mat(0x1f2d36, 0.45, 0.2));
    this.box(this.s, [0.52, 1.35, 0.55], [1.25, 0.68, -27.5], this.mat(0x243b54, 0.42, 0.2));
    this.box(this.s, [0.4, 0.52, 0.04], [1.22, 0.95, -27.2], this.mat(0x7db4ff, 0.2, 0, 0x497aff, 0.9));
    this.box(this.s, [0.58, 0.035, 0.42], [-0.6, 0.05, -13.5], this.mat(0x806f54, 0.65));
    this.cyl(this.s, 0.025, 0.025, 0.9, [-1.42, 0.45, -19.3], this.mat(0x1c1c20, 0.7), 8).rotation.z = 0.25;

    // Wet footprint decals leading to where the viewer stands.
    const fpMat = this.mat(0x090b0c, 0.18);
    this.footprintMats.push(fpMat);
    for (let i = 0; i < 10; i++) {
      const fp = this.box(this.s, [0.16, 0.006, 0.34], [(i % 2 ? 0.18 : -0.18), 0.025, -8.5 - i * 0.62], fpMat, [0, 0.08 * (i % 2 ? 1 : -1), 0]);
      fp.castShadow = false;
    }

    // Lint blockout at the sconce: small brown felt body and two wings.
    const felt = this.mat(0x6b3f24, 0.95);
    const wing = this.mat(0x8a5631, 0.96);
    const glow = this.mat(0xff8c2a, 0.55, 0, 0xff7a18, 2.8);
    this.cyl(this.lint, 0.025, 0.035, 0.1, [0, 0, 0], felt, 10).rotation.x = Math.PI / 2;
    this.box(this.lint, [0.14, 0.018, 0.07], [-0.07, 0, 0], wing, [0, 0, 0.35]);
    this.box(this.lint, [0.14, 0.018, 0.07], [0.07, 0, 0], wing, [0, 0, -0.35]);
    this.cyl(this.lint, 0.025, 0.025, 0.035, [0, 0, 0.06], glow, 10).rotation.x = Math.PI / 2;
    this.lint.position.set(-1.25, 1.9, -10.0);
    this.s.add(this.lint);

    // Tenant upper-body blockout: small tile head, vending-glass ribcage, ball arm and coil hand.
    const tile = this.mat(0xb9d9d7, 0.26);
    const paper = this.mat(0xd8c69d, 0.82);
    const plasticRed = this.mat(0xa92624, 0.28);
    const chrome = this.mat(0x8c9296, 0.22, 0.8);
    const glass = new THREE.MeshStandardMaterial({ color: 0x25333a, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.62 });
    this.disposables.push(glass);
    this.box(this.tenant, [0.28, 0.34, 0.24], [0, 2.45, 0], tile);
    for (let i = 0; i < 4; i++) this.cyl(this.tenant, 0.07, 0.08, 0.18, [0, 2.18 - i * 0.14, 0], this.mat(0x5a342b, 0.9), 8);
    this.box(this.tenant, [0.72, 0.92, 0.32], [0, 1.48, 0], glass);
    for (let i = 0; i < 5; i++) this.box(this.tenant, [0.62, 0.035, 0.36], [0, 1.16 + i * 0.16, 0.01], chrome);
    for (let i = 0; i < 6; i++) this.cyl(this.tenant, 0.09, 0.1, 0.24, [-0.47 - i * 0.13, 1.78 - i * 0.08, 0], i % 2 ? plasticRed : this.mat(0xd1a62c, 0.3), 10).rotation.z = Math.PI / 2;
    for (let i = 0; i < 5; i++) this.cyl(this.tenant, 0.025, 0.035, 0.46, [0.45 + i * 0.08, 1.55 - i * 0.08, 0.04 * i], chrome, 8).rotation.z = 1.2 + i * 0.2;
    for (let i = 0; i < 4; i++) this.box(this.tenant, [0.035, 0.38, 0.07], [0.72 + i * 0.045, 1.05 - i * 0.03, 0.06], paper, [0, 0, -0.4 - i * 0.12]);
    this.tenant.position.set(0.05, 0, -17.6);
    this.tenant.visible = false;
    this.s.add(this.tenant);

    // Flashlight and its faint visible cone.
    this.flash.castShadow = false;
    this.flash.target = this.flashTarget;
    this.s.add(this.flash, this.flashTarget);
    const coneGeo = new THREE.ConeGeometry(1, 7, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beamCone = new THREE.Mesh(coneGeo, coneMat);
    this.disposables.push(coneGeo, coneMat);
    this.s.add(this.beamCone);

    const ambient = new THREE.AmbientLight(0x273040, 0.42);
    this.s.add(ambient);
  }

  private gaitOffset(t: number): [number, number, number] {
    let rate = 0, amp = 0;
    if ((t >= 105 && t < 114.5) || (t >= 120.6 && t < 122.4)) { rate = 1.9; amp = 0.022; }
    if (t >= 121.3 && t < 122.5) { rate = 3.0; amp = 0.045; }
    if (!rate) return [0.003 * Math.sin(t * 1.57), 0.006 * Math.sin(t * 1.57), 0];
    const ph = t * rate * Math.PI * 2;
    return [Math.sin(ph) * amp, Math.abs(Math.sin(ph)) * amp, Math.sin(ph * 0.5) * amp * 0.35];
  }

  private flicker(t: number) {
    const inFlicker = (t >= 114.2 && t < 124.0) || (t >= 206 && t < 218);
    if (!inFlicker) return 1;
    const step = Math.floor(t * 13);
    return hash(step) < 0.34 ? 0.25 + 0.35 * hash(step + 4) : 0.82 + 0.18 * hash(step + 9);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = poseAt(t);
    const bob = this.gaitOffset(t);
    this.cam.position.set(pose.p[0] + bob[0], pose.p[1] + bob[1], pose.p[2] + bob[2]);
    const dir = lookDir(pose.yaw, pose.pitch);
    const target = this.cam.position.clone().add(dir.multiplyScalar(5));
    this.cam.fov = pose.fov;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(target);

    // Beam state: 50% battery in Z5, hard off while hiding, lagged 80 ms behind the head.
    const beamOn = t < 124.0 || t >= 130.0;
    const lag = poseAt(Math.max(104.7, t - 0.08));
    const lagDir = lookDir(lag.yaw, lag.pitch);
    const right = new THREE.Vector3(Math.cos(lag.yaw * Math.PI / 180), 0, Math.sin(lag.yaw * Math.PI / 180));
    const lp = new THREE.Vector3(...lag.p).add(right.multiplyScalar(0.25)).add(new THREE.Vector3(0, -0.2, 0)).add(lagDir.clone().multiplyScalar(0.1));
    const lt = lp.clone().add(lagDir.clone().multiplyScalar(7));
    this.flash.position.copy(lp);
    this.flashTarget.position.copy(lt);
    this.flash.intensity = beamOn ? 4.8 * 0.5 * this.flicker(t) : 0;
    const coneMat = this.beamCone.material as THREE.MeshBasicMaterial;
    coneMat.opacity = 0;
    this.beamCone.position.copy(lp.clone().lerp(lt, 0.5));
    this.beamCone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lagDir.clone().negate().normalize());
    this.beamCone.scale.set(1, 1, 1);

    // Tenant partial reveal and head-tilt tell.
    this.tenant.visible = t >= 120.45 && t < 121.65;
    if (this.tenant.visible) this.tenant.rotation.z = 0.12 * smooth((t - 120.45) / 0.8);

    // Lint bats at the sconce for 0.6 s during beat 5.3.
    const lintOn = t >= 112.3 && t <= 113.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.45;
      this.lint.children[1]!.rotation.z = 0.35 + flap;
      this.lint.children[2]!.rotation.z = -0.35 - flap;
      this.lint.position.y = 1.9 + 0.05 * Math.sin(t * 31);
    }

    // TVs and neon are alive; TV glow remains as the only hiding light after beam-off.
    this.tvScreens.forEach((m, i) => {
      const n = hash(Math.floor(t * (9 + i)) + i * 31);
      m.emissiveIntensity = (t >= 124 && i === this.tvScreens.length - 1 ? 3.2 : 1.4) + n * 1.2;
    });
    this.neonMats.forEach((m, i) => { m.emissiveIntensity = 3.1 + 1.6 * (hash(Math.floor(t * 7) + i * 17) > 0.72 ? 0.25 : 1); });

    // Rain streaks slide down the window as pure f(t).
    for (const line of this.rainLines) {
      const seed = line.userData.seed as number;
      line.position.y = 0.65 + ((seed + t * (0.25 + seed * 0.2)) % 1.45);
    }

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x050608, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return { exposure: 1.14, bloom: 0.22, bloomThreshold: 0.9, vignette: 0.28, grain: 0.035, ca: 0.08 };
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

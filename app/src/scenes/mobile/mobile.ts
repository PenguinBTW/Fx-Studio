// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// mobile — kinetic-sculpture register: a Calder-style hanging mobile in a dark
// gallery void. The subject is equilibrium itself: nested arms in slow,
// incommensurate rotation, painted paddles sweeping through a single museum
// spot. All motion closed-form in t — rotation angles are analytic functions,
// pendulum sway is sinusoidal, nothing integrates. Hierarchy is real
// (child arms inherit parent rotation), so the composition never repeats
// inside the window: periods 17/23/29/37s are pairwise coprime-ish.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

function blobShape(seed: number, scale: number): THREE.Shape {
  // organic Calder-ish blob: a lumpy closed spline, deterministic per seed
  const h1 = (i: number, s: number) => {
    const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const pts: THREE.Vector2[] = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = scale * (0.7 + 0.5 * h1(i, seed));
    pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * (0.65 + 0.3 * h1(i, seed + 9))));
  }
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mid = new THREE.Vector2((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
    shape.quadraticCurveTo(p0.x, p0.y, mid.x, mid.y);
  }
  shape.closePath();
  return shape;
}

interface Tier {
  group: THREE.Group;      // rotates about Y at the hang point
  period: number;          // seconds per revolution (rotation)
  phase: number;
  swayAmp: number;
  swayPeriod: number;
}

const TIERS: Tier[] = [];

export default class Mobile extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private focusDist = 9;
  private disposables: { dispose(): void }[] = [];
  private redPaddlePos = new THREE.Vector3();
  private centroid = new THREE.Vector3();
  private paddleMeshes: THREE.Mesh[] = [];
  private redPaddle: THREE.Mesh | null = null;

  override async init() {
    this.world.background = new THREE.Color(0x060607);

    const rodMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.55, metalness: 0.8 });
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x232326 });
    const paddleMat = (c: number) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.3, metalness: 0.15,
      side: THREE.DoubleSide,
    });
    this.disposables.push(rodMat, wireMat);

    // museum spot: key light high-left, faint cool fill so blacks don't crush to zero
    const spot = new THREE.SpotLight(0xfff2e0, 400, 80, Math.PI / 3.8, 0.5, 1.1);
    spot.position.set(-5, 11, 5);
    spot.target.position.set(0, 2.5, 0);
    this.world.add(spot, spot.target);
    const fill = new THREE.HemisphereLight(0x3a4356, 0x08080a, 1.1);
    this.world.add(fill);
    const rim = new THREE.DirectionalLight(0xdde4f0, 1.8);
    rim.position.set(6, 4, -7);
    this.world.add(rim);

    // wire meshes are centered at origin; placement must hang them DOWN len/2 from the attachment point
    const mkWire = (len: number): THREE.Mesh => {
      const g = new THREE.CylinderGeometry(0.012, 0.012, len, 5);
      this.disposables.push(g);
      return new THREE.Mesh(g, wireMat);
    };

    // palette: red, yellow, blue, black, white — Calder primaries
    const palette = [0xc22215, 0xe8a812, 0x1c4d8f, 0x111114, 0xb8b4aa];
    const scales = [1.05, 0.8, 0.9, 0.7, 0.6];

    // build 4 tiers, bottom-up assembly: each tier = horizontal rod,
    // paddle hanging off the left end, next sub-mobile off the right end
    const tierSpec = [
      { len: 4.2, period: 17, drop: 0.55 },
      { len: 3.4, period: 23, drop: 0.5 },
      { len: 2.7, period: 29, drop: 0.45 },
      { len: 2.1, period: 37, drop: 0.4 },
      { len: 1.5, period: 43, drop: 0.35 },
    ];

    let childGroup: THREE.Group | null = null;
    let childDrop = 0;
    const tiersTopDown: Tier[] = [];
    for (let i = tierSpec.length - 1; i >= 0; i--) {
      const { len, period, drop } = tierSpec[i];
      const group = new THREE.Group();

      // rod: pivot at 40% from left — asymmetric balance
      const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, len, 8);
      this.disposables.push(rodGeo);
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.x = len * 0.1; // shift so pivot sits off-center
      group.add(rod);

      // paddle hangs from LEFT end of rod
      const leftX = rod.position.x - len / 2;
      const wireL = mkWire(drop);
      wireL.position.set(leftX, -drop / 2, 0);
      group.add(wireL);

      const shape = blobShape(i * 3 + 1, scales[i]);
      const pGeo = new THREE.ShapeGeometry(shape, 24);
      this.disposables.push(pGeo);
      const mat = paddleMat(palette[i]);
      this.disposables.push(mat);
      const paddle = new THREE.Mesh(pGeo, mat);
      paddle.position.set(leftX, -drop - scales[i] * 0.55, 0);
      // paddles tilt slightly off-plane so rotation sweeps their normals through the light
      paddle.rotation.x = 0.12 + i * 0.05;
      group.add(paddle);
      this.paddleMeshes.push(paddle);
      if (i === 0) this.redPaddle = paddle;

      // child sub-mobile hangs from RIGHT end
      if (childGroup) {
        const rightX = rod.position.x + len / 2;
        const wireR = mkWire(childDrop);
        wireR.position.set(rightX, -childDrop / 2, 0);
        group.add(wireR);
        childGroup.position.set(rightX, -childDrop, 0);
        group.add(childGroup);
      }

      tiersTopDown.unshift({ group, period, phase: i * 1.7, swayAmp: 0.05 + i * 0.02, swayPeriod: 11 + i * 6 });
      childGroup = group;
      childDrop = drop + scales[i] * 0.9;
    }

    // ceiling suspension wire
    const topWire = mkWire(3.0);
    topWire.position.set(0, 7.8 - 1.5, 0);
    this.world.add(topWire);
    childGroup!.position.set(0, 4.6, 0);
    this.world.add(childGroup!);
    TIERS.length = 0;
    TIERS.push(...tiersTopDown);

    // floor: barely-visible dark plane catching a whisper of spot spill
    const floorGeo = new THREE.CircleGeometry(20, 48);
    this.disposables.push(floorGeo);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0 });
    this.disposables.push(floorMat);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.5;
    this.world.add(floor);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    // closed-form tier rotations: base rotation + pendulum sway, all analytic
    for (const tier of TIERS) {
      tier.group.rotation.y = tier.phase + (lt * Math.PI * 2) / tier.period
        + tier.swayAmp * Math.sin((lt * Math.PI * 2) / tier.swayPeriod + tier.phase * 2.3);
    }

    // measure hero points in world space for camera targeting
    this.world.updateMatrixWorld(true);
    (this.redPaddle ?? this.paddleMeshes[0]).getWorldPosition(this.redPaddlePos);
    this.centroid.set(0, 0, 0);
    for (const p of this.paddleMeshes) {
      const wp = new THREE.Vector3();
      p.getWorldPosition(wp);
      this.centroid.add(wp);
    }
    this.centroid.multiplyScalar(1 / this.paddleMeshes.length);

    // camera choreography: tight on red paddle -> drift to whole-sculpture orbit -> settle
    const rev = smoothstep(0, 6, lt);
    const settle = smoothstep(22, 27, lt);
    const target = new THREE.Vector3().lerpVectors(this.redPaddlePos, this.centroid, rev);
    target.y += 0.6 * rev;
    const radius = 4.5 + 6.5 * rev - 0.5 * settle;
    const yaw = 0.35 + lt * 0.028;
    const pitch = -0.06 + 0.04 * Math.sin(lt * 0.11);
    this.rig.setLensMm(52);
    this.rig.orbit([target.x, target.y - 0.25 * (1 - rev), target.z], radius, pitch, yaw);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);
    const fwd = new THREE.Vector3();
    this.cam.getWorldDirection(fwd);
    this.focusDist = Math.max(0.5, target.clone().sub(this.cam.position).dot(fwd));

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x060607, 1);
    rr.clear();
    rr.render(this.world, this.cam);
    rr.setRenderTarget(null);

    return {
      depthFocusDist: this.focusDist,
      depthAperture: 6,
      depthDof: { near: 0.1, far: 100 },
      bloomStrength: 0.25,
      grain: 0.015,
      vignette: 0.35,
    };
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.paddleMeshes = [];
  }
}

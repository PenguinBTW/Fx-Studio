// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// paperfold — transformation register: a flat sheet folds itself, crease by
// crease, into a dart airplane, hesitates, then lifts off into a climbing
// spiral and dwindles into the dark. The catalog has growth (verdant, geode)
// and motion (pennant, murmuration) but nothing where topology itself is the
// subject: flatness becoming flight. The folds are real kinematic rotations
// about real crease lines — each material point classified once in flat space
// (the origami insight: crease-side membership is a property of the material,
// not of the current 3D position), then composed hierarchically. All
// closed-form in t; zero Math.random anywhere.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';

// ---------- flat-space fold machinery ----------
// A fold is a crease line in the sheet's flat material coordinates plus a
// time-varying rotation angle. Moving-side membership is tested in FLAT
// coordinates: material never crosses a crease, so classification is fixed.
// Rotation happens about the crease line as transformed by all EARLIER folds.
type Fold = {
  cx: number; cy: number;  // a point on the crease (flat coords)
  dx: number; dy: number;  // crease direction (flat, normalized)
  side: number;            // +1: moving side is cross2(d, v-c) > 0; -1 the other
  angle: (t: number) => number;
};

function cross2(dx: number, dy: number, rx: number, ry: number): number {
  return dx * ry - dy * rx;
}

function rotateAboutLine(
  p: [number, number, number],
  a: [number, number, number],
  dir: [number, number, number],
  theta: number,
): [number, number, number] {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const ux = dir[0] / len, uy = dir[1] / len, uz = dir[2] / len;
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2];
  const c = Math.cos(theta), s = Math.sin(theta), oc = 1 - c;
  const dot = ux * px + uy * py + uz * pz;
  const cx = uy * pz - uz * py, cy = uz * px - ux * pz, cz = ux * py - uy * px;
  return [
    a[0] + px * c + cx * s + ux * dot * oc,
    a[1] + py * c + cy * s + uy * dot * oc,
    a[2] + pz * c + cz * s + uz * dot * oc,
  ];
}

// Transform a flat material point through the first n folds at time t.
function transformPoint(
  vx: number, vy: number, t: number, folds: Fold[], n: number,
): [number, number, number] {
  let p: [number, number, number] = [vx, vy, 0];
  let layers = 0;
  for (let k = 0; k < n; k++) {
    const f = folds[k]!;
    const membership = cross2(f.dx, f.dy, vx - f.cx, vy - f.cy) * f.side;
    if (membership <= 0) continue;
    const ang = f.angle(t);
    if (Math.abs(ang) < 1e-5) continue;
    // the crease line itself, carried through the folds before it
    const a = transformPoint(f.cx, f.cy, t, folds, k);
    const b = transformPoint(f.cx + f.dx, f.cy + f.dy, t, folds, k);
    const dir: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    p = rotateAboutLine(p, a, dir, ang);
    layers += (k + 1);
  }
  // paper has thickness: each fold layer rides slightly above the one beneath,
  // along the sheet normal — kills the z-fighting shimmer in stacked regions
  p[2] += layers * 0.0007;
  return p;
}

function norm2(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

export default class Paperfold extends Scene {
  private cam = new THREE.PerspectiveCamera(35, W / H, 0.02, 80);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private sheetGeo: THREE.BufferGeometry | null = null;
  private sheetMesh: THREE.Mesh | null = null;
  private sheetMat: THREE.MeshStandardMaterial | null = null;
  private floorMesh: THREE.Mesh | null = null;
  private floorMat: THREE.MeshStandardMaterial | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private paperTex: THREE.CanvasTexture | null = null;
  private flatXY: Float32Array | null = null; // original flat coords per vertex
  private folds: Fold[] = [];
  private shadowWasEnabled = false;

  override async init() {
    // ---- fold choreography: angles closed-form in t ----
    const up = (t0: number, t1: number, t: number) => smoothstep(t0, t1, t);
    const down = (t0: number, t1: number, t: number) => 1 - smoothstep(t0, t1, t);
    // F1: spine crease rehearsal — right half rises and settles back (4–8s)
    const a1 = (t: number) => 2.4 * up(4, 5.5, t) * down(6.5, 8, t) * 0; // placeholder replaced below
    void a1;
    const spineRehearse = (t: number) => -2.4 * (smoothstep(4, 5.5, t) - smoothstep(6.5, 8, t));
    // corner folds 1: crease nose(0,0.7) -> edge(±0.5, 0.1), flat fold π
    const corner1 = (t: number) => Math.PI * smoothstep(8, 10.5, t);
    const corner1L = (t: number) => -Math.PI * smoothstep(8, 10.5, t);
    void corner1;
    // halving backward along spine (18–20.5s)
    const halve = (t: number) => -Math.PI * smoothstep(14, 16.5, t);

    const dR1 = norm2(0.5, -0.5), dL1 = norm2(-0.5, -0.5);
    this.folds = [
      // spine rehearsal — crease x=0, right half (cross>0 with d=(0,1) means x<0... test: cross2((0,1), v) = -vx → positive side is x<0) so side=-1 moves x>0
      { cx: 0, cy: 0, dx: 0, dy: 1, side: -1, angle: spineRehearse },
      // right corner 1: corner point (0.5, 0.7) — cross2(dR1, v-c) at that point: d=(0.64,-0.77), r=(0.5,0): 0.64*0+0.77*0.5 > 0 → positive side moves
      { cx: 0, cy: 0.7, dx: dR1[0], dy: dR1[1], side: 1, angle: corner1 },
      // left corner 1: mirror — corner (-0.5, 0.7): d=(-0.64,-0.77), r=(-0.5,0): cross = (-0.64)*0 - (-0.77)(-0.5) < 0 → negative side moves
      { cx: 0, cy: 0.7, dx: dL1[0], dy: dL1[1], side: -1, angle: corner1L },
      // halve backward: same crease as spine, x>0 moves (side -1)
      { cx: 0, cy: 0, dx: 0, dy: 1, side: -1, angle: halve },
    ];

    // ---- sheet mesh: grid in local XY (x across [-0.5,0.5], y along [-0.7,0.7]) ----
    const SX = 52, SY = 72;
    const geo = new THREE.PlaneGeometry(1.0, 1.4, SX, SY);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    this.flatXY = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      this.flatXY[i * 2] = posAttr.getX(i);
      this.flatXY[i * 2 + 1] = posAttr.getY(i);
    }
    this.sheetGeo = geo;

    // deterministic paper-grain texture
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 256;
    const ctx2 = cvs.getContext('2d')!;
    const img = ctx2.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        const h1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const n1 = h1 - Math.floor(h1);
        const fiber = Math.sin(y * 0.9 + n1 * 2.0) * 4;
        const v = 246 + (n1 - 0.5) * 14 + fiber;
        img.data[i] = v; img.data[i + 1] = v - 3; img.data[i + 2] = v - 9; img.data[i + 3] = 255;
      }
    }
    ctx2.putImageData(img, 0, 0);
    this.paperTex = new THREE.CanvasTexture(cvs);
    this.paperTex.wrapS = this.paperTex.wrapT = THREE.RepeatWrapping;

    this.sheetMat = new THREE.MeshStandardMaterial({
      map: this.paperTex,
      side: THREE.DoubleSide,
      roughness: 0.82,
      metalness: 0.0,
    });
    this.sheetMesh = new THREE.Mesh(this.sheetGeo, this.sheetMat);
    this.sheetMesh.castShadow = true;
    this.sheetMesh.frustumCulled = false; // vertices are GPU-agnostic — CPU-folded per frame
    // local XY sheet lies flat on the world XZ table: rotate -90° about X
    this.sheetMesh.rotation.x = -Math.PI / 2;
    this.world.add(this.sheetMesh);

    // ---- table / void floor ----
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95, metalness: 0 });
    this.floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), this.floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -0.005;
    this.floorMesh.receiveShadow = true;
    this.world.add(this.floorMesh);

    // ---- lights: 3200K tungsten key, spectral per fx-scenes ----
    const [kr, kg, kb] = blackbodyToLinearSRGB(3200);
    this.keyLight = new THREE.DirectionalLight(new THREE.Color(kr, kg, kb), 1.5);
    this.keyLight.position.set(-1.6, 2.4, 1.1);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -1.5;
    this.keyLight.shadow.camera.right = 1.5;
    this.keyLight.shadow.camera.top = 1.5;
    this.keyLight.shadow.camera.bottom = -1.5;
    this.keyLight.shadow.camera.far = 8;
    this.keyLight.shadow.bias = -0.0005;
    this.world.add(this.keyLight);
    this.hemi = new THREE.HemisphereLight(0x36405a, 0x141008, 0.85);
    this.world.add(this.hemi);

    // handheld operator layer per the scene-optics rule
    this.rig.handheld({ weight: 0.55, posAmp: 0.012, rotAmp: 0.0028, seed: 7 });
  }

  // glide path: position of the plane's center in world for t >= 22 — closed-form
  private glideState(t: number): { pos: THREE.Vector3; quat: THREE.Quaternion; lift: number } {
    const g = smoothstep(22, 24.5, t);
    const gt = Math.max(0, t - 22);
    // climbing spiral: angular advance, expanding radius, steady climb
    const phi = gt * 0.8 * g;
    const r = 1.5 * g * smoothstep(0, 2.5, gt);
    const climb = gt * gt * 0.07 * g;
    const px = Math.sin(phi) * r;
    const pz = (1 - Math.cos(phi)) * r * 0.8 - gt * 0.4 * g;
    const py = climb + Math.sin(gt * 2.2) * 0.03 * g;
    const pos = new THREE.Vector3(px, py, pz);
    // orientation: nose along velocity (finite difference of the closed form — still deterministic)
    const eps = 0.02;
    const posAt = (tt: number): THREE.Vector3 => {
      const gg = smoothstep(22, 24.5, tt);
      const tg = Math.max(0, tt - 22);
      const ph = tg * 0.8 * gg;
      const rr2 = 1.5 * gg * smoothstep(0, 2.5, tg);
      const cl = tg * tg * 0.07 * gg;
      return new THREE.Vector3(
        Math.sin(ph) * rr2,
        cl + Math.sin(tg * 2.2) * 0.03 * gg,
        (1 - Math.cos(ph)) * rr2 * 0.8 - tg * 0.4 * gg,
      );
    };
    const ahead = posAt(t + eps);
    const vel = ahead.sub(pos);
    const quat = new THREE.Quaternion();
    if (vel.lengthSq() > 1e-8 && g > 0.001) {
      const nose = vel.clone().normalize(); // local +y maps here
      const upRef = new THREE.Vector3(0, 1, 0);
      const span = new THREE.Vector3().crossVectors(nose, upRef).normalize(); // local +x
      const thick = new THREE.Vector3().crossVectors(span, nose).normalize(); // local +z
      const m = new THREE.Matrix4().makeBasis(span, nose, thick);
      quat.setFromRotationMatrix(m);
      // bank into the turn around the nose axis
      const bank = new THREE.Quaternion().setFromAxisAngle(nose, -0.45 * g * Math.min(1, gt / 2));
      quat.premultiply(bank);
    }
    return { pos, quat, lift: g };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // ---- camera FIRST (frame-order independence) ----
    const gs = this.glideState(lt);
    const chase = smoothstep(22, 25, lt) * 0.55;
    const targetY = 0.06 + gs.pos.y * chase;
    const orbitT: [number, number, number] = [gs.pos.x * chase, targetY, 0.1 + gs.pos.z * chase];
    const pitch = 0.42 + 0.05 * Math.sin(lt * 0.11);
    const yaw = 0.6 + lt * 0.035;
    const radius = 2.0 - smoothstep(0, 20, lt) * 0.35 + smoothstep(22, 28, lt) * 1.3;
    this.rig.orbit(orbitT, radius, pitch, yaw);
    const camSpec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(camSpec, this.cam);

    // ---- sheet deformation: CPU recompute of the small grid — closed-form f(t) ----
    const posAttr = this.sheetGeo!.getAttribute('position') as THREE.BufferAttribute;
    const flat = this.flatXY!;
    const n = posAttr.count;
    for (let i = 0; i < n; i++) {
      const vx = flat[i * 2]!, vy = flat[i * 2 + 1]!;
      const p = transformPoint(vx, vy, lt, this.folds, this.folds.length);
      posAttr.setXYZ(i, p[0], p[1], p[2]);
    }
    posAttr.needsUpdate = true;
    this.sheetGeo!.computeVertexNormals();

    // ---- glide transform: rigid, applied to the whole mesh ----
    const { pos, quat, lift } = this.glideState(lt);
    // pre-liftoff tremor — a breath of instability before flight
    const tremor = smoothstep(20, 21.5, lt) * (1 - smoothstep(21.8, 22.2, lt));
    const baseQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    if (lift > 0.001) {
      // blend flat-on-table orientation into the nose-first flight basis
      baseQuat.slerp(quat, lift);
      this.sheetMesh!.position.copy(pos);
    } else {
      this.sheetMesh!.position.set(0, 0, 0);
    }
    if (tremor > 0) {
      const tr = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        Math.sin(lt * 31) * 0.006 * tremor,
      );
      baseQuat.multiply(tr);
    }
    this.sheetMesh!.quaternion.copy(baseQuat);

    // ---- focus: nose tip during rest/folds, plane center during glide ----
    const noseFlat = transformPoint(0, 0.7, lt, this.folds, this.folds.length);
    const noseWorld = new THREE.Vector3(noseFlat[0], noseFlat[1], noseFlat[2])
      .applyQuaternion(this.sheetMesh!.quaternion).add(this.sheetMesh!.position);
    const focusD = this.rig.focusDistance([noseWorld.x, noseWorld.y, noseWorld.z]);

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    if (!this.shadowWasEnabled) {
      this.shadowWasEnabled = rr.shadowMap.enabled;
    }
    rr.shadowMap.enabled = true;
    rr.shadowMap.needsUpdate = true;

    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: Math.max(0.3, focusD),
      aperture: 6,
      maxRadius: 10,
      samples: 24,
      near: 0.02,
      far: 80,
    }, out);
    rr.resetState();
    return { exposure: 0.85, bloom: 0.2, vignette: 0.5 } as PostOverrides;
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = this.shadowWasEnabled;
    this.sheetGeo?.dispose();
    this.sheetMat?.dispose();
    this.paperTex?.dispose();
    this.floorMesh?.geometry.dispose();
    this.floorMat?.dispose();
    this.keyLight?.dispose();
    this.hemi?.dispose();
    this.main?.dispose();
    this.dof.dispose?.();
  }
}

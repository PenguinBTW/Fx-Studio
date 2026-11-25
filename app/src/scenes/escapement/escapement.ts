// escapement — a mechanical watch movement at extreme macro. The balance wheel breathes
// at 2.5 Hz, the escape wheel steps tooth by tooth with recoil, the pallet fork rocks
// between them, and the brass train turns slow and continuous beneath. Register the
// catalog lacks: precision mechanics. All motion closed-form f(t); geometry Blender-built.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { smoothstep } from '../../engine/util';

// --- horology ----------------------------------------------------------------
const BEAT_HZ = 2.5;              // balance frequency — the heartbeat of the piece
const BALANCE_AMP = 4.2;          // ~240 deg amplitude in radians
const ESC_TEETH = 15;
const TOOTH = (2 * Math.PI) / ESC_TEETH;

// balance: pure sinusoid — the physical oscillator
function balanceAngle(t: number): number {
  return BALANCE_AMP * Math.sin(2 * Math.PI * BEAT_HZ * t);
}
// escape wheel: one tooth per half-beat, stepped with a fast impulse and a small
// recoil beforehand — the signature of a swiss lever. phase n = half-beat index.
function escapeAngle(t: number): number {
  const ph = 2 * BEAT_HZ * t;            // half-beat phase, 1 per step
  const n = Math.floor(ph);
  const frac = ph - n;
  // step happens in the first 18% of the half-beat with an easing snap;
  // 4% recoil in the 8% before the snap (the lever drawing back)
  let adv: number;
  if (frac > 10 / 12) {
    adv = -0.04 * Math.sin((frac - 10 / 12) / (2 / 12) * Math.PI); // recoil (negative)
  } else if (frac < 0.18) {
    const k = frac / 0.18;
    adv = 1 - (1 - k) * (1 - k) * (1 - k); // ease-out cubic snap
  } else {
    adv = 1;
  }
  return -(n - 1 + adv) * TOOTH;
}
// pallet fork: rocks between its two banking pins, locked to the beat — a smoothed
// square wave in phase with the escape steps
function palletAngle(t: number): number {
  const s = Math.sin(2 * Math.PI * BEAT_HZ * t + Math.PI / 2);
  return 0.14 * Math.tanh(5.5 * s);
}
// gear train: upstream of the escapement the stepping blurs into continuous rotation
// (physically true — the step amplitude divides by the gear ratio). mean escape rate
// is one tooth per half-beat; fourth wheel geared 1:10, third 1:12, center 1:12 again.
function meanEscapeRate(): number { return -TOOTH * 2 * BEAT_HZ; } // rad/s
function trainAngle(t: number, ratio: number, phase: number): number {
  const base = meanEscapeRate() * ratio * t + phase;
  // faint residual stepping — the tick shivers up the train at 1/ratio amplitude
  const ph = 2 * BEAT_HZ * t;
  const frac = ph - Math.floor(ph);
  const step = frac < 0.18 ? Math.sin((frac / 0.18) * Math.PI) : 0;
  return base + step * 0.004 * ratio * 40;
}

// --- camera choreography ------------------------------------------------------
// one slow drift across the plate: wide establish of the train, then in toward the
// escapement — escape wheel, pallet, balance — and a final hold on the breathing
// hairspring. never cuts.
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  // one move: wide high establish of the whole movement, pushing in toward the
  // escapement cluster (balance + escape wheel + pallet at x -0.85..0.3, y ~0.95).
  // ends on a 3/4 high close-up of the beating balance — never crosses the gear field.
  const k = smoothstep(2, 27, lt);
  const e = k * k * (3 - 2 * k); // smooth already; keep for clarity
  const x = 0.55 - 0.90 * e;
  const y = -1.35 + 1.50 * e;
  const z = 4.6 - 2.10 * e;
  out.set(x, y, z);
  return out;
}
function camTarget(lt: number, out: THREE.Vector3): THREE.Vector3 {
  // gaze starts at the plate center, then locks onto the escapement cluster and holds
  const k = smoothstep(3, 12, lt);
  out.set(
    -0.05 - 0.25 * k,
    0.1 + 0.72 * k,
    0.08 + 0.1 * k,
  );
  return out;
}
export default class Escapement extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private inst: any = null;
  private pivots: Record<string, THREE.Group> = {};
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };

  override async init() {
    const project = this.ctx.project ?? 'escapement';
    const rr = this.ctx.renderer;
    const prevShadow = rr.shadowMap.enabled;
    const prevType = rr.shadowMap.type;
    (this as any)._prevShadow = prevShadow;
    (this as any)._prevType = prevType;
    rr.shadowMap.enabled = true;
    rr.shadowMap.type = THREE.PCFShadowMap;

    // lighting: warm key like a watchmaker's lamp, cool steel rim from behind,
    // everything else falls to black — the movement floats in the void
    const key = new THREE.SpotLight(0xffd9a0, 13, 30, 0.8, 0.7, 1.25);
    key.position.set(3.1, 1.6, 6.0);
    key.target.position.set(-0.4, -0.3, 0.1);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005;
    const rim = new THREE.DirectionalLight(0x86a8ff, 2.4);
    rim.position.set(-2.5, -3.5, 1.5);
    const fill = new THREE.HemisphereLight(0x39445c, 0x201a12, 1.7);
    this.world.add(key, key.target, rim, fill);

    const asset = resolveAsset('movement', project);
    this.inst = await GLTFManager.instantiate(asset.url, {});
    const root: THREE.Object3D = this.inst.root;
    // export_yup maps Blender (x,y,z) -> glTF (x,z,-y); rotating +90deg about X exactly
    // inverts it, so the movement lies flat in the world XY plane with axles along +z
    root.rotation.x = Math.PI / 2;
    root.traverse((o: any) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material) { o.material.envMapIntensity = 1.2; }
      }
    });

    // --- build rotation pivots: re-parent moving parts around their true axles.
    // parts sharing an fx_part id collapse in the registry, so we collect by traversal.
    const centers: Record<string, [number, number, number]> = {
      center_wheel: [-0.55, -0.45, 0.05],
      third_wheel: [1.05, -0.15, 0.09],
      fourth_wheel: [1.08, 1.00, 0.13],
      escape_wheel: [0.30, 0.95, 0.16],
      balance: [-0.85, 0.95, 0.30],
      pallet: [0.06, 1.02, 0.17],
    };
    const members: Record<string, string[]> = {
      center_wheel: ['center_wheel'],
      third_wheel: ['third_wheel'],
      fourth_wheel: ['fourth_wheel'],
      escape_wheel: ['escape_wheel'],
      balance: ['balance', 'hairspring'],
      pallet: ['pallet'],
    };
    // detach hairspring from the rigid balance group? no — it breathes with the wheel.
    for (const [pid, partIds] of Object.entries(members)) {
      const c = centers[pid];
      const pivot = new THREE.Group();
      pivot.position.set(c[0], c[1], c[2]);
      this.world.add(pivot);
      this.pivots[pid] = pivot;
      const collected: THREE.Object3D[] = [];
      root.traverse((o: any) => {
        const fp = o.userData?.fx_part;
        if (fp && partIds.includes(fp)) collected.push(o);
      });
      for (const o of collected) {
        // preserve world transform while re-parenting under the pivot
        pivot.attach(o);
      }
    }
    this.world.add(root);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // mechanics
    if (this.pivots.balance) {
      this.pivots.balance.rotation.z = balanceAngle(lt);
      // hairspring breathing rides the same pivot; the spiral visually opens/closes —
      // a subtle radial pulse synced to the swing, applied to the whole group is wrong
      // physically but reads as the spring "living"; keep it minute (2.5%)
      const breathe = 1 + 0.025 * Math.sin(2 * Math.PI * BEAT_HZ * lt);
      this.pivots.balance.scale.setScalar(breathe);
    }
    if (this.pivots.escape_wheel) this.pivots.escape_wheel.rotation.z = escapeAngle(lt);
    if (this.pivots.pallet) this.pivots.pallet.rotation.z = palletAngle(lt);
    if (this.pivots.fourth_wheel) this.pivots.fourth_wheel.rotation.z = trainAngle(lt, -0.5, 0.4);
    if (this.pivots.third_wheel) this.pivots.third_wheel.rotation.z = trainAngle(lt, 5 / 12, 1.1);
    if (this.pivots.center_wheel) this.pivots.center_wheel.rotation.z = trainAngle(lt, -5 / 16, 2.0);

    // camera
    camPos(lt, this.tmp.a);
    camTarget(lt, this.tmp.b);
    this.cam.position.copy(this.tmp.a);
    this.cam.up.set(0, 0, 1);
    this.cam.lookAt(this.tmp.b);

    // focus: measured axial distance to the current subject — the point the
    // camera is looking at is the subject by choreography
    const focusD = this.tmp.c.copy(this.tmp.b).sub(this.tmp.a).length();
    const aperture = lt < 4 ? 0.045 : 0.055; // shallow throughout; the macro look

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(W, H, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(W, H, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);

    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: focusD,
      aperture,
      maxRadius: 18,
      samples: 40,
    }, out);
    rr.resetState();
    return {};
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    rr.shadowMap.type = (this as any)._prevType ?? THREE.PCFShadowMap;
    this.main?.dispose();
    this.dof.dispose();
    this.inst?.dispose?.();
    super.dispose();
  }
}

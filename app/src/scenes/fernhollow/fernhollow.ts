// fernhollow — a forest-floor hollow at golden hour, staged at snail scale. A snail glides
// along a mossy log beneath arching fern fronds while spores drift through volumetric
// canopy shafts; physical thin-lens depth of field is the primary compositional force.
// All motion is closed-form f(t); assets are Blender-pipeline GLBs (see assets/*/build.py).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { AnalyticalParticles } from '../../engine/particles';
import { smoothstep } from '../../engine/util';

const TAU = Math.PI * 2;

// --- closed-form choreography -------------------------------------------------
// camera: one slow creeping dolly at snail height along the log (x axis), slight sway
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const k = smoothstep(0, 30, lt);
  out.set(
    -1.6 + 2.6 * k,
    0.22 + 0.05 * Math.sin(lt * 0.21),
    0.9 - 0.35 * k + 0.04 * Math.sin(lt * 0.13 + 1.0),
  );
  return out;
}
function camTarget(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const k = smoothstep(2, 28, lt);
  out.set(-0.5 + 1.3 * k, 0.13 + 0.03 * Math.sin(lt * 0.17 + 2.0), -0.15);
  return out;
}
// rack focus weights: deep → snail → spore field → snail (storyboard beats).
// When the snail is the subject the focus distance is MEASURED closed-form from the
// camera/snail positions — both are f(lt), so the composition of the two is still
// closed-form; a constant nominal distance defocuses the snail as the dolly creeps.
function snailWeight(lt: number): number {
  if (lt < 4) return 0;
  if (lt < 10) return smoothstep(4, 9, lt);
  if (lt < 18) return 1;
  if (lt < 24) return 1 - smoothstep(18, 21.5, lt);
  return smoothstep(24, 27, lt);
}
const DEEP_FOCUS = 3.2;

// snail glide along the log: pauses at the end, closed-form position
function snailX(lt: number): number {
  const go = smoothstep(4.5, 24, lt);
  return -0.85 + 1.55 * go;
}

export default class Fernhollow extends Scene {
  private cam = new THREE.PerspectiveCamera(46, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private snail: THREE.Group | null = null;
  private snailInst: any = null;
  private spores: AnalyticalParticles | null = null;
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private fronds: { obj: THREE.Object3D; phase: number; amp: number }[] = [];
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const project = this.ctx.project ?? 'fernhollow';
    const r = this.ctx.renderer;

    // lighting: low warm key (canopy sun), cool shade fill, faint green bounce
    const key = new THREE.DirectionalLight(0xffc25e, 3.4);
    key.position.set(-2.5, 3.2, 1.4);
    const fill = new THREE.DirectionalLight(0x2e4147, 0.8);
    fill.position.set(2.0, 1.2, -1.5);
    const bounce = new THREE.HemisphereLight(0x4a6b3a, 0x1c2418, 0.7);
    this.world.add(key, fill, bounce);

    // ground: damp soil plane with procedural moss-tone vertex tinting
    const groundGeo = new THREE.PlaneGeometry(14, 8, 64, 32);
    const gp = groundGeo.attributes.position!;
    const col = new Float32Array(gp.count * 3);
    const moss = new THREE.Color(0x243d20), soil = new THREE.Color(0x1d150e);
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), y = gp.getY(i);
      const n = 0.5 + 0.5 * Math.sin(x * 3.1 + Math.sin(y * 2.3) * 1.7) * Math.cos(y * 4.3 + x);
      const c = soil.clone().lerp(moss, n * n);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.world.add(ground);

    // the mossy log: bark cylinder along X with green-tinted top
    const logGeo = new THREE.CylinderGeometry(0.09, 0.11, 3.4, 20, 8);
    const lp = logGeo.attributes.position!;
    const lc = new Float32Array(lp.count * 3);
    const bark = new THREE.Color(0x2e2015), mossTop = new THREE.Color(0x2a4420);
    for (let i = 0; i < lp.count; i++) {
      const ny = lp.getY(i), nz = lp.getZ(i);
      const up = Math.max(0, nz / 0.1);
      const n = 0.5 + 0.5 * Math.sin(ny * 13.0 + nz * 31.0) * Math.sin(ny * 5.0 - nz * 17.0);
      const c = bark.clone().lerp(mossTop, up * (0.4 + 0.6 * n));
      lc[i * 3] = c.r; lc[i * 3 + 1] = c.g; lc[i * 3 + 2] = c.b;
    }
    logGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    const log = new THREE.Mesh(logGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    log.rotation.z = Math.PI / 2; // cylinder Y axis → X axis
    log.position.set(0, 0.075, -0.1);
    this.world.add(log);

    // fern fronds: instanced GLB variants arcing overhead, analytic sway
    const fernAsset = resolveAsset('fern', project);
    const fernInst = await GLTFManager.instantiate(fernAsset.url, {});
    const placements: [number, number, number, number, number][] = [
      // x, z, scale, yaw, phase
      [-1.2, -0.9, 0.62, 0.4, 0.0], [-0.4, -1.3, 0.72, 1.1, 1.3], [0.6, -1.1, 0.58, 2.2, 2.6],
      [1.4, -0.8, 0.66, 2.9, 0.7], [-0.9, 0.6, 0.5, -0.6, 1.9], [0.9, 0.55, 0.55, -2.4, 3.1],
      [0.0, -1.6, 0.8, 1.7, 4.2],
    ];
    for (const [x, z, s, yaw, phase] of placements) {
      const obj: THREE.Object3D = fernInst.root.clone(true);
      obj.position.set(x, 0, z);
      obj.scale.setScalar(s);
      obj.rotation.y = yaw;
      // fronds grow toward -Z base then arch: tilt outward slightly
      obj.rotation.x = -0.15;
      this.world.add(obj);
      this.fronds.push({ obj, phase, amp: 0.03 + 0.02 * ((phase * 7) % 1) });
    }

    // snail: rigged GLB, glide clip
    const snailAsset = resolveAsset('snail', project);
    this.snailInst = await GLTFManager.instantiate(snailAsset.url, {});
    this.snail = this.snailInst.root as THREE.Group;
    this.snail.rotation.y = -Math.PI / 2;
    if (this.snail) this.world.add(this.snail);

    // spores: analytical particle emitters scattered through the hollow — the GPU
    // evaluates positions closed-form in the vertex shader (zero CPU per-frame state)
    this.spores = new AnalyticalParticles(4096, 4242, { depthWrite: true });
    const spots: [number, number, number][] = [
      [-1.1, 0.35, -0.7], [-0.2, 0.5, -1.0], [0.8, 0.4, -0.8], [1.3, 0.55, -0.5],
      [-0.5, 0.3, 0.3], [0.5, 0.45, 0.25], [0.0, 0.7, -0.4],
    ];
    for (const [sx, sy, sz] of spots) {
      this.spores.addEmitter(`spore_${sx}_${sz}`, {
        capacity: 128,
        origin: [sx, sy, sz],
        direction: [0.05, 0.35, 0.02],
        speed: 0.045,
        spread: 1.1,
        lifetime: 7.0,
        gravity: [0, 0.004, 0],
        turbulence: 0.5,
        size: 0.006,
        color: [1.0, 0.82, 0.5, 0.5],
        glow: 2.2,
      });
    }

    // volumetric canopy shafts: additive analytic light planes slanted with the key light
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xf5c873, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    for (let i = 0; i < 3; i++) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + i * 0.2, 3.2), shaftMat.clone());
      shaft.position.set(-0.7 + i * 0.85, 1.4, -0.7 - i * 0.2);
      shaft.rotation.z = 0.5; // slant matching key direction
      shaft.rotation.y = 0.25;
      this.world.add(shaft);
    }

    // backdrop canopy: dark blurred mass far behind
    const canopy = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7),
      new THREE.MeshBasicMaterial({ color: 0x1d2b14 }),
    );
    canopy.position.set(0, 2.2, -4.5);
    this.world.add(canopy);
  }

  private mainRT(out: THREE.WebGLRenderTarget) {
    if (this.main && this.main.width === out.width && this.main.height === out.height) return this.main;
    this.main?.dispose();
    this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
      type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(out.width, out.height),
    });
    return this.main;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt, r = this.ctx.renderer;

    // camera — closed-form creeping dolly
    camPos(lt, this.tmp.a);
    camTarget(lt, this.tmp.b);
    this.cam.position.copy(this.tmp.a);
    this.cam.lookAt(this.tmp.b);
    this.cam.updateMatrixWorld();

    // snail — glide clip + closed-form travel along the log top
    if (this.snail) {
      this.snailInst.setTime?.(lt * 0.5, 'glide');
      this.snail.position.set(snailX(lt), 0.165, -0.1);
    }

    // fern sway — phase-offset analytic rock
    for (const fr of this.fronds) {
      fr.obj.rotation.z = fr.amp * Math.sin(lt * 0.7 + fr.phase);
    }


    // present: world into depth RT, physical DoF into out
    const rt = this.mainRT(out);
    r.setRenderTarget(rt);
    r.setClearColor(0x101608, 1);
    r.clear();
    r.render(this.world, this.cam);
    // spores composite additively into the same HDR target so the DoF pass resolves
    // near motes into discs of confusion and far ones stay sharp
    this.spores?.render(r, this.cam, rt, lt);
    this.dof.render(r, rt.texture, rt.depthTexture!, {
      enabled: true,
      focusDistance: (() => {
        const w = snailWeight(lt);
        if (w < 0.001 || !this.snail) return DEEP_FOCUS;
        // DoF depth is along the camera forward axis, not Euclidean range
        const fwd = new THREE.Vector3();
        this.cam.getWorldDirection(fwd);
        const off = this.snail.position.clone().sub(this.cam.position);
        const d = off.dot(fwd);
        return DEEP_FOCUS + (d - DEEP_FOCUS) * w;
      })(),
      aperture: 10.0,
      maxRadius: 18,
      near: this.cam.near,
      far: this.cam.far,
      samples: 12,
    }, out);
    r.resetState();
    return { bloom: 0.35, vignette: 0.3 };
  }

  override dispose() {
    this.main?.dispose();
    this.dof.dispose();
    this.spores?.dispose();
    this.snailInst?.dispose?.();
    this.world.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    });
  }
}

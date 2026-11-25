// atrium — a brutalist concrete spiral interior. Sun descends through a rooftop oculus as
// a physical shaft; dust drifts through it; the camera rises one slow helical arc, never
// cutting. Architecture as the subject: hard-surface Blender shell, warm concrete in sun,
// cool shade, negative space. All motion closed-form f(t).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { GLTFManager } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { AnalyticalParticles } from '../../engine/particles';
import { smoothstep } from '../../engine/util';

// --- closed-form choreography ------------------------------------------------
// helical rise: half a turn over 28s, radius breathing toward/away from the shaft
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const k = smoothstep(0.5, 28.5, lt);
  const angle = 2.2 + k * Math.PI * 1.05;
  // inside the open well — the tread band spans r 1.9..3.55, so the camera must stay
  // within r_in or it slices through slabs as it rises
  const radius = 1.62 - 0.28 * Math.sin(k * Math.PI);
  out.set(
    radius * Math.cos(angle),
    0.9 + 5.6 * k,
    radius * Math.sin(angle),
  );
  return out;
}
function camTarget(lt: number, camY: number, out: THREE.Vector3): THREE.Vector3 {
  // gaze tangent to the helix: the shaft sits at frame edge while treads sweep in
  // parallax; late, tilt up into the oculus
  const k = smoothstep(0.5, 28.5, lt);
  const angle = 2.2 + k * Math.PI * 1.05 + 0.9; // ahead of the camera around the curve
  const radius = 1.4;
  out.set(
    radius * Math.cos(angle) * (1 - 0.55 * smoothstep(20, 28, lt)),
    camY + 0.6 + 2.6 * smoothstep(16, 28, lt),
    radius * Math.sin(angle) * (1 - 0.55 * smoothstep(20, 28, lt)),
  );
  return out;
}
function focusAt(lt: number): number {
  // near treads early, deep into the shaft mid; the finale is measured in render()
  if (lt < 12) return 2.2;
  if (lt < 22) return 2.2 + (4.5 - 2.2) * smoothstep(12, 18, lt);
  return 4.5;
}
// finale focus weight — 0 until the oculus becomes the subject
function ringWeight(lt: number): number {
  return smoothstep(22, 27, lt);
}

export default class Atrium extends Scene {
  private cam = new THREE.PerspectiveCamera(52, W / H, 0.08, 80);
  private world = new THREE.Scene();
  private dust: AnalyticalParticles | null = null;
  private shellInst: any = null;
  private shellRoot: THREE.Object3D | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const project = this.ctx.project ?? 'atrium';
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = true;
    rr.shadowMap.type = THREE.PCFShadowMap;

    // lighting: sun through the oculus is a steep warm key, shade is cool and low
    const key = new THREE.DirectionalLight(0xffe4b8, 4.5);
    this.keyLight = key;
    key.position.set(1.6, 12, 0.9);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.001;

    key.target.position.set(0, 0, 0);
    const fill = new THREE.HemisphereLight(0x7a8698, 0x453c32, 1.05);
    const bounce = new THREE.DirectionalLight(0x9a8a6e, 0.95);
    bounce.position.set(-3, 2, -2);
    this.world.add(key, key.target, fill, bounce);

    // architecture shell (Blender-built)
    const shellAsset = resolveAsset('atrium_shell', project);
    const shell = await GLTFManager.instantiate(shellAsset.url, {});
    shell.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.shellInst = shell;
    this.shellRoot = shell.root;
    this.world.add(shell.root);


    // the light shaft: a slanted additive volume column under the oculus,
    // brighter core + softer sheath, both analytic closed-form geometry
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfff3dd, transparent: true, opacity: 0.045,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    });
    const sheathMat = coreMat.clone();
    sheathMat.opacity = 0.018;
    for (const [rad, mat] of [[0.55, coreMat], [1.15, sheathMat]] as [number, THREE.MeshBasicMaterial][]) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.15, rad * 0.8, 9.2, 24, 1, true), mat);
      cyl.position.set(0, 4.6, 0);
      cyl.rotation.z = 0.12; // slight sun slant
      cyl.rotation.x = 0.06;
      this.world.add(cyl);
    }

    // dust motes inside the shaft volume
    this.dust = new AnalyticalParticles(2048, 9091);
    const cols: [number, number, number][] = [[0, 2.0, 0], [0.3, 4.2, -0.2], [-0.25, 6.0, 0.25], [0.1, 7.6, 0.1]];
    for (const [ox, oy, oz] of cols) {
      this.dust.addEmitter(`dust_${oy}`, {
        capacity: 200,
        origin: [ox, oy, oz],
        direction: [0.02, -0.12, 0.01],
        speed: 0.05,
        spread: 0.9,
        lifetime: 9.0,
        gravity: [0, -0.004, 0],
        turbulence: 0.35,
        size: 0.008,
        color: [1.0, 0.93, 0.78, 0.4],
        glow: 2.4,
      });
    }

    // faint ambient haze outside the shaft
    this.dust.addEmitter('haze', {
      capacity: 256,
      origin: [0, 3.0, 0],
      direction: [0.05, 0.01, 0.03],
      speed: 0.03,
      spread: 2.6,
      lifetime: 12.0,
      gravity: [0, -0.004, 0],
      turbulence: 0.5,
      size: 0.006,
      color: [0.7, 0.68, 0.6, 0.14],
      glow: 1.2,
    });
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

    camPos(lt, this.tmp.a);
    this.cam.position.copy(this.tmp.a);
    camTarget(lt, this.tmp.a.y, this.tmp.b);
    this.cam.lookAt(this.tmp.b);
    this.cam.updateMatrixWorld();

    const rt = this.mainRT(out);
    r.setRenderTarget(rt);
    r.setClearColor(0x191611, 1);
    r.clear();
    r.render(this.world, this.cam);
    // motes into the same HDR target so the DoF pass resolves them physically
    this.dust?.render(r, this.cam, rt, lt);
    this.dof.render(r, rt.texture, rt.depthTexture!, {
      enabled: true,
      focusDistance: (() => {
        const base = focusAt(lt);
        const w = ringWeight(lt);
        if (w < 0.001) return base;
        // closed-form measured distance to the oculus rim nearest the camera —
        // both positions are f(lt), so the composition is still closed-form
        const cx = this.cam.position.x, cy = this.cam.position.y, cz = this.cam.position.z;
        const horiz = Math.hypot(cx, cz);
        const rimX = cx / Math.max(horiz, 1e-6) * 1.35, rimZ = cz / Math.max(horiz, 1e-6) * 1.35;
        // DoF depth is along the camera's forward axis, not Euclidean range —
        // project the rim offset onto the view direction
        const fwd = new THREE.Vector3();
        this.cam.getWorldDirection(fwd);
        const d = (rimX - cx) * fwd.x + (9.0 - cy) * fwd.y + (rimZ - cz) * fwd.z;
        return base + (d - base) * w;
      })(),
      aperture: 5.0,
      maxRadius: 14,
      near: this.cam.near,
      far: this.cam.far,
      samples: 12,
    }, out);
    r.resetState();
    return { bloom: 0.3, vignette: 0.35 };
  }

  override dispose() {
    this.main?.dispose();
    this.dof.dispose();
    this.dust?.dispose();
    // cache-shared shell resources are owned by the GLTF cache, not the scene —
    // instance teardown only; disposing them here would fight other/future instances
    if (this.shellRoot) this.world.remove(this.shellRoot);
    this.shellInst?.dispose?.();
    // the renderer outlives the scene (engine.reload) — release the shadow target explicitly
    const sm: any = this.keyLight?.shadow?.map;
    sm?.dispose?.();
    this.world.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
      else m?.dispose?.();
    });
  }
}

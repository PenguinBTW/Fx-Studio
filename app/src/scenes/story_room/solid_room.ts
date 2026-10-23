// SCENE 2: SOLID ROOM & THE ELASTIC POP (4.5s - 9.0s)
// Objects in the room pop one by one from wireframes into full solid matte sculptural objects.
// Physical under-damped harmonic pop oscillator (zeta = 0.52) with true volume squash-and-stretch.
// Strictly Closed-Form Frame = f(t), Zero State Leaks

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { buildDetailedRoomProps, StoryRoomGeometry, type PropDef } from './room_assets';

interface SolidMeshRecord {
  mesh: THREE.Mesh;
  def: PropDef;
  baseScale: THREE.Vector3;
  basePos: THREE.Vector3;
  popDelay: number;
}

export default class SolidRoom extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private meshes: SolidMeshRecord[] = [];
  private heroBookMesh: THREE.Mesh;

  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);

    // Architectural studio ambient background
    this.scene.background = new THREE.Color(0x0a0f18);

    // Sculptural Studio Lighting
    this.keyLight = new THREE.DirectionalLight(0xfff7ed, 2.0);
    this.keyLight.position.set(-2.5, 4.5, 2.5);
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.9);
    this.fillLight.position.set(3.0, 3.0, 1.0);
    this.scene.add(this.fillLight);

    this.ambLight = new THREE.AmbientLight(0x334155, 0.9);
    this.scene.add(this.ambLight);

    // Build 3D Solid Matte Meshes for all props
    const props = buildDetailedRoomProps();

    for (const p of props) {
      let geom: THREE.BufferGeometry;

      if (p.geomType === 'box') {
        const [w, h, d] = p.geomParams;
        geom = new THREE.BoxGeometry(w, h, d);
      } else if (p.geomType === 'cylinder') {
        const [rt, rb, h, segs] = p.geomParams;
        geom = new THREE.CylinderGeometry(rt, rb, h, segs || 16);
      } else if (p.geomType === 'cone') {
        const [r, h, segs] = p.geomParams;
        geom = new THREE.ConeGeometry(r, h, segs || 16);
      } else if (p.geomType === 'sphere') {
        const [r, wSegs, hSegs] = p.geomParams;
        geom = new THREE.SphereGeometry(r, wSegs || 16, hSegs || 16);
      } else if (p.geomType === 'torus') {
        const [r, tube, radSegs, tubSegs] = p.geomParams;
        geom = new THREE.TorusGeometry(r, tube, radSegs || 12, tubSegs || 24);
      } else {
        geom = new THREE.BoxGeometry(1, 1, 1);
      }

      // Sculptural chalk/clay material
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf1f5f9), // Solid chalk/clay white
        roughness: 0.88,
        metalness: 0.02,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(p.pos);
      mesh.rotation.copy(p.rot);
      mesh.scale.set(0.001, 0.001, 0.001); // Starts unpopped

      this.scene.add(mesh);
      this.meshes.push({
        mesh,
        def: p,
        baseScale: p.scale.clone(),
        basePos: p.pos.clone(),
        popDelay: p.popDelay,
      });
    }

    // Hero Book on Shelf (Sitting on Shelf 3)
    const heroBookGeo = new THREE.BoxGeometry(0.095, 0.34, 0.26);
    const heroMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf8fafc),
      roughness: 0.85,
      metalness: 0.0,
    });
    this.heroBookMesh = new THREE.Mesh(heroBookGeo, heroMat);
    this.heroBookMesh.position.set(0.96, 1.62, -0.96);
    this.heroBookMesh.rotation.set(0, 0.22, 0);
    this.heroBookMesh.scale.set(0.001, 0.001, 0.001);
    this.scene.add(this.heroBookMesh);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;

    // Camera choreography: sweeps low following the popping objects on the desk
    // and rises gracefully to frame the newly solid room and bookcase.
    const u = Math.min(1.0, Math.max(0.0, (t - 4.5) / 4.2));
    const camPos = new THREE.Vector3(
      THREE.MathUtils.lerp(0.35, 0.55, u),
      THREE.MathUtils.lerp(1.48, 1.55, u),
      THREE.MathUtils.lerp(1.55, 1.65, u)
    );
    const lookTarget = new THREE.Vector3(
      THREE.MathUtils.lerp(0.45, 0.65, u),
      THREE.MathUtils.lerp(1.35, 1.45, u),
      THREE.MathUtils.lerp(-0.65, -0.85, u)
    );

    this.camera.position.copy(camPos);
    this.camera.lookAt(lookTarget);

    // Evaluate Staggered Under-Damped Pop for each object
    for (const rec of this.meshes) {
      const tau = t - (4.5 + rec.popDelay * 0.95);
      const { sy, sxz } = StoryRoomGeometry.evalPop(tau);

      rec.mesh.scale.set(
        rec.baseScale.x * sxz,
        rec.baseScale.y * sy,
        rec.baseScale.z * sxz
      );

      // Minor squash compensation on position baseline
      if (tau >= 0 && tau < 1.5) {
        rec.mesh.position.y = rec.basePos.y + (sy - 1.0) * 0.04;
      } else {
        rec.mesh.position.copy(rec.basePos);
      }
    }

    // Hero Book pop on shelf
    const tauHero = t - (4.5 + 1.36);
    const popHero = StoryRoomGeometry.evalPop(tauHero);
    this.heroBookMesh.scale.set(popHero.sxz, popHero.sy, popHero.sxz);

    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      exposure: 1.1,
      bloom: 0.25,
      bloomRadius: 0.35,
      vignette: 0.32,
    };
  }
}

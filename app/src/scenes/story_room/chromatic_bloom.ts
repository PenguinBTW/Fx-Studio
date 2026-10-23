// SCENE 2: CHROMATIC BLOOM & THE FLYING TOME (4.5s - 13.5s)
// Elastic Pop into solid clay -> Chromatic Bloom into rich PBR materials ->
// Upward crane tilt -> Hero Book ballistic flight & cushioned desk impact.
// Strictly Closed-Form Frame = f(t)

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { buildRoomProps, StoryRoomGeometry, type PropDef } from './room_assets';

interface MeshRecord {
  mesh: THREE.Mesh;
  def: PropDef;
  baseScale: THREE.Vector3;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  targetColor: THREE.Color;
  targetRoughness: number;
  targetMetalness: number;
}

export default class ChromaticBloom extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private meshes: MeshRecord[] = [];
  private heroBookGroup: THREE.Group;
  private heroBookSpineRibs: THREE.Group;
  private heroBookCover: THREE.Mesh;

  private keyLight: THREE.DirectionalLight;
  private lampLight: THREE.PointLight;
  private ambLight: THREE.AmbientLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    this.scene.background = new THREE.Color(0x0c0f16);

    // 1. Lighting Setup
    this.keyLight = new THREE.DirectionalLight(0xffecd2, 2.2);
    this.keyLight.position.set(-2.5, 4.0, 2.0);
    this.scene.add(this.keyLight);

    this.lampLight = new THREE.PointLight(0xffa726, 1.8, 4.2);
    this.lampLight.position.set(-0.42, 1.25, 0.02);
    this.scene.add(this.lampLight);

    this.ambLight = new THREE.AmbientLight(0x283344, 0.85);
    this.scene.add(this.ambLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.85);
    fillLight.position.set(2.5, 3.5, 1.5);
    this.scene.add(fillLight);

    // 2. Build 3D Solid Meshes for all room props
    const props = buildRoomProps();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (const p of props) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf1f5f9), // Starts as matte chalk/clay
        roughness: 0.9,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.position.copy(p.pos);
      mesh.rotation.copy(p.rot);
      mesh.scale.copy(p.scale);

      this.scene.add(mesh);
      this.meshes.push({
        mesh,
        def: p,
        baseScale: p.scale.clone(),
        basePos: p.pos.clone(),
        baseRot: p.rot.clone(),
        targetColor: p.color.clone(),
        targetRoughness: p.roughness,
        targetMetalness: p.metalness,
      });
    }

    // 3. Hero Book Model (Embossed Leather Spine, Gold Filigree, Gilded Pages)
    this.heroBookGroup = new THREE.Group();

    // Main Leather Volume
    const bookBodyGeo = new THREE.BoxGeometry(0.095, 0.34, 0.26);
    const bookBodyMat = new THREE.MeshStandardMaterial({
      color: 0x821515, // Rich crimson calfskin
      roughness: 0.3,
      metalness: 0.12,
    });
    const bookBody = new THREE.Mesh(bookBodyGeo, bookBodyMat);
    this.heroBookGroup.add(bookBody);

    // Gilded Page Edges
    const pagesGeo = new THREE.BoxGeometry(0.084, 0.32, 0.245);
    const pagesMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Rich burnished gold leaf
      roughness: 0.28,
      metalness: 0.8,
    });
    const pages = new THREE.Mesh(pagesGeo, pagesMat);
    pages.position.set(0.008, 0, 0.006);
    this.heroBookGroup.add(pages);

    // Embossed Gold Spine Ribs (5 decorative raised bands along spine)
    this.heroBookSpineRibs = new THREE.Group();
    const ribGeo = new THREE.BoxGeometry(0.012, 0.012, 0.252);
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Gold foil
      roughness: 0.22,
      metalness: 0.88,
    });
    for (let r = -2; r <= 2; r++) {
      const rib = new THREE.Mesh(ribGeo, ribMat);
      rib.position.set(-0.048, r * 0.062, 0);
      this.heroBookSpineRibs.add(rib);
    }
    this.heroBookGroup.add(this.heroBookSpineRibs);

    // Hinged Front Cover
    const coverGeo = new THREE.BoxGeometry(0.01, 0.342, 0.262);
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.28,
      metalness: 0.15,
    });
    this.heroBookCover = new THREE.Mesh(coverGeo, coverMat);
    this.heroBookCover.position.set(-0.05, 0, 0);
    this.heroBookGroup.add(this.heroBookCover);

    this.scene.add(this.heroBookGroup);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;

    // -------------------------------------------------------------------------
    // Phase 1: Elastic Squash-and-Stretch Pop Wave (t = 4.5s -> 6.0s)
    // Phase 2: Chromatic Bloom Wave (t = 6.0s -> 9.0s)
    // -------------------------------------------------------------------------
    const chalkColor = new THREE.Color(0xf1f5f9);

    for (const rec of this.meshes) {
      const popT0 = 4.5 + rec.def.delayOffset * 0.8;
      const tau = t - popT0;
      const { sy, sxz, alpha } = StoryRoomGeometry.evalPop(tau);

      rec.mesh.scale.set(
        rec.baseScale.x * sxz,
        rec.baseScale.y * sy,
        rec.baseScale.z * sxz
      );
      rec.mesh.visible = alpha > 0.001;

      // Chromatic Bloom wave across t = 6.0s..9.0s
      const bloomT0 = 6.0 + rec.def.delayOffset * 1.4;
      const uBloom = Math.min(1.0, Math.max(0.0, (t - bloomT0) / 1.5));
      const easeBloom = uBloom * uBloom * (3 - 2 * uBloom);

      const mat = rec.mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(chalkColor).lerp(rec.targetColor, easeBloom);
      mat.roughness = THREE.MathUtils.lerp(0.9, rec.targetRoughness, easeBloom);
      mat.metalness = THREE.MathUtils.lerp(0.0, rec.targetMetalness, easeBloom);
    }

    // -------------------------------------------------------------------------
    // Phase 3: Hero Book Kinematics (Shelf -> Ballistic Arc -> Desk Impact)
    // -------------------------------------------------------------------------
    const heroPopT0 = 4.5 + 0.7 * 0.8;
    const heroTau = t - heroPopT0;
    const { sy: heroSy, sxz: heroSxz, alpha: heroAlpha } = StoryRoomGeometry.evalPop(heroTau);

    const bookKin = StoryRoomGeometry.evalHeroBook(t);
    this.heroBookGroup.position.copy(bookKin.pos);
    this.heroBookGroup.rotation.copy(bookKin.rot);

    if (t < 6.0) {
      this.heroBookGroup.scale.set(heroSxz, heroSy, heroSxz);
      this.heroBookGroup.visible = heroAlpha > 0.001;
    } else {
      this.heroBookGroup.scale.set(1, 1, 1);
      this.heroBookGroup.visible = true;
    }

    this.heroBookCover.rotation.z = bookKin.openAngle;

    // Lighting modulation
    const bloomProgress = Math.min(1.0, Math.max(0.0, (t - 6.0) / 3.0));
    this.keyLight.intensity = THREE.MathUtils.lerp(1.2, 2.6, bloomProgress);
    this.lampLight.intensity = THREE.MathUtils.lerp(0.4, 2.0, bloomProgress);

    // -------------------------------------------------------------------------
    // Camera Choreography across the sequence
    // -------------------------------------------------------------------------
    if (t < 6.0) {
      // 4.5s..6.0s: Low-angle tracking sweep following the radial wave of popping objects
      const uPopCam = (t - 4.5) / 1.5;
      const easePopCam = uPopCam * uPopCam * (3 - 2 * uPopCam);
      this.camera.position.set(
        THREE.MathUtils.lerp(-0.4, 0.45, easePopCam),
        THREE.MathUtils.lerp(0.98, 0.82, easePopCam),
        THREE.MathUtils.lerp(1.5, 1.3, easePopCam)
      );
      this.camera.lookAt(0.1, 0.85, 0.0);
    } else if (t < 10.0) {
      // 6.0s..10.0s: Upward crane tilt framing bookshelf and room from an elegant perspective
      const uCrane = (t - 6.0) / 4.0;
      const easeCrane = uCrane * uCrane * (3 - 2 * uCrane);
      this.camera.position.set(
        THREE.MathUtils.lerp(0.35, 0.12, easeCrane),
        THREE.MathUtils.lerp(0.85, 1.32, easeCrane),
        THREE.MathUtils.lerp(1.45, 1.65, easeCrane)
      );
      // Focuses across room from desk towards bookshelf
      const targetLook = new THREE.Vector3(
        THREE.MathUtils.lerp(0.10, 0.65, easeCrane),
        THREE.MathUtils.lerp(0.82, 1.32, easeCrane),
        THREE.MathUtils.lerp(0.05, -0.65, easeCrane)
      );
      this.camera.lookAt(targetLook);
    } else {
      // 10.0s..13.5s: Dynamic cinematic chase camera tracking the flying book!
      const uFlight = (t - 10.0) / 3.5;
      const bookP = bookKin.pos;

      if (uFlight < 0.14) {
        // 10.0s..10.5s: Camera zooms directly into the book on the shelf as it slides forward
        const uIn = uFlight / 0.14;
        const easeIn = uIn * uIn * (3 - 2 * uIn);
        this.camera.position.set(
          THREE.MathUtils.lerp(0.12, 0.55, easeIn),
          THREE.MathUtils.lerp(1.32, 1.65, easeIn),
          THREE.MathUtils.lerp(1.65, -0.35, easeIn)
        );
        this.camera.lookAt(bookP);
      } else if (uFlight < 0.76) {
        // Sweeping chase camera tracking the ballistic arc through room air
        const uMid = (uFlight - 0.14) / 0.62;
        this.camera.position.set(
          THREE.MathUtils.lerp(0.55, -0.05, uMid),
          THREE.MathUtils.lerp(1.65, 1.38, uMid),
          THREE.MathUtils.lerp(-0.35, 0.78, uMid)
        );
        this.camera.lookAt(bookP.x, bookP.y, bookP.z);
      } else {
        // Tight macro landing framing desk impact bounce right in front of the lens
        const uEnd = (uFlight - 0.76) / 0.24;
        const easeEnd = uEnd * uEnd * (3 - 2 * uEnd);
        this.camera.position.set(
          THREE.MathUtils.lerp(-0.05, 0.12, easeEnd),
          THREE.MathUtils.lerp(1.38, 1.22, easeEnd),
          THREE.MathUtils.lerp(0.78, 0.48, easeEnd)
        );
        this.camera.lookAt(0.12, 0.76, 0.08);
      }
    }

    // Render 3D Scene
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      bloomRadius: 0.55,
      bloomThreshold: 0.38,
      bloomIntensity: 0.95,
      exposure: 1.12,
      vignette: 0.38,
    };
  }
}

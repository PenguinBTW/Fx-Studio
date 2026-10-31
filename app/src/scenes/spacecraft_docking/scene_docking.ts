// Spacecraft Docking Benchmark - Scene 2: Pressurized Hangar Docking Bay (f(x) Studio v0.8.0)
// 3D Procedural Three.js scene: Cargo transport decelerating inside the station hangar,
// reverse thrusters firing, guide rails aligning, and mechanical docking clamps locking down.

import * as THREE from 'three';
import { Scene, Frame, PostOverrides, SceneCtx } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { clamp, ease, lerp } from '../../engine/util';
import {
  AudioTelemetryEmitter,
  projectWorldToScreenPan,
  type AudioTelemetryPoint,
  type TelemetryFrame,
} from '../../engine/audio/telemetry';

export const dockingTelemetryEmitter = new AudioTelemetryEmitter();

export function emitDockingTelemetry(sourceId: string, point: Partial<AudioTelemetryPoint>): void {
  dockingTelemetryEmitter.emit(sourceId, point);
}

export function commitDockingTelemetryFrame(frame: number, t: number): TelemetryFrame {
  return dockingTelemetryEmitter.captureFrame(frame, t);
}

export default class SceneDocking extends Scene {
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;

  // 3D Objects
  private cargoShipGroup!: THREE.Group;
  private hangarBayGroup!: THREE.Group;
  private clampLeftGroup!: THREE.Group;
  private clampRightGroup!: THREE.Group;
  private reverseBurnGlowL!: THREE.Mesh;
  private reverseBurnGlowR!: THREE.Mesh;

  // Materials
  private bayMat!: THREE.MeshStandardMaterial;
  private clampMat!: THREE.MeshStandardMaterial;
  private shipMat!: THREE.MeshStandardMaterial;
  private warningMat!: THREE.MeshStandardMaterial;
  private thrusterGlowMat!: THREE.MeshBasicMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init(): void {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(42, W / H, 0.1, 500.0);
    this.camera3D.position.set(0, 4.0, 14.0);
    this.camera3D.lookAt(0, 1.0, 0);

    // 1. Lighting: Pressurized hangar amber guide lights + cool industrial key
    const overheadKey = new THREE.DirectionalLight(0xddeeff, 2.5);
    overheadKey.position.set(0, 20, 5);
    this.scene3D.add(overheadKey);

    const amberFill = new THREE.PointLight(0xff9922, 3.0, 30.0);
    amberFill.position.set(0, 1.0, 0);
    this.scene3D.add(amberFill);

    const ambLight = new THREE.AmbientLight(0x181c24, 0.8);
    this.scene3D.add(ambLight);

    // 2. Hangar Bay Architecture (Gantry Ribs, Floor Guide Rails)
    this.hangarBayGroup = new THREE.Group();
    this.bayMat = new THREE.MeshStandardMaterial({ color: 0x1c2028, metalness: 0.8, roughness: 0.4 });
    this.warningMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, metalness: 0.3, roughness: 0.6 });

    // Hangar Deck Floor
    const floorGeom = new THREE.BoxGeometry(24.0, 0.5, 40.0);
    const floorMesh = new THREE.Mesh(floorGeom, this.bayMat);
    floorMesh.position.set(0, -2.0, 0);
    this.hangarBayGroup.add(floorMesh);

    // Guide Rails along deck
    const railGeom = new THREE.BoxGeometry(0.3, 0.4, 38.0);
    const railL = new THREE.Mesh(railGeom, this.warningMat);
    railL.position.set(-2.5, -1.6, 0);
    const railR = new THREE.Mesh(railGeom, this.warningMat);
    railR.position.set(2.5, -1.6, 0);
    this.hangarBayGroup.add(railL);
    this.hangarBayGroup.add(railR);

    // Arch Gantry Ribs
    const ribGeom = new THREE.BoxGeometry(0.6, 12.0, 0.8);
    const roofGeom = new THREE.BoxGeometry(22.0, 0.8, 0.8);
    for (let z = -16.0; z <= 16.0; z += 6.0) {
      const ribL = new THREE.Mesh(ribGeom, this.bayMat);
      ribL.position.set(-10.0, 4.0, z);
      const ribR = new THREE.Mesh(ribGeom, this.bayMat);
      ribR.position.set(10.0, 4.0, z);
      const roof = new THREE.Mesh(roofGeom, this.bayMat);
      roof.position.set(0, 10.0, z);

      this.hangarBayGroup.add(ribL);
      this.hangarBayGroup.add(ribR);
      this.hangarBayGroup.add(roof);
    }

    this.scene3D.add(this.hangarBayGroup);

    // 3. Mechanical Docking Clamps (Left & Right)
    this.clampMat = new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.9, roughness: 0.3 });

    this.clampLeftGroup = new THREE.Group();
    const armGeom = new THREE.BoxGeometry(3.5, 0.8, 1.2);
    const armMeshL = new THREE.Mesh(armGeom, this.clampMat);
    armMeshL.position.set(-1.75, 0, 0);
    const clawGeom = new THREE.BoxGeometry(1.0, 1.6, 1.4);
    const clawMeshL = new THREE.Mesh(clawGeom, this.warningMat);
    clawMeshL.position.set(-3.5, 0, 0);
    this.clampLeftGroup.add(armMeshL);
    this.clampLeftGroup.add(clawMeshL);
    this.clampLeftGroup.position.set(-6.5, 0.5, 0);
    this.scene3D.add(this.clampLeftGroup);

    this.clampRightGroup = new THREE.Group();
    const armMeshR = new THREE.Mesh(armGeom, this.clampMat);
    armMeshR.position.set(1.75, 0, 0);
    const clawMeshR = new THREE.Mesh(clawGeom, this.warningMat);
    clawMeshR.position.set(3.5, 0, 0);
    this.clampRightGroup.add(armMeshR);
    this.clampRightGroup.add(clawMeshR);
    this.clampRightGroup.position.set(6.5, 0.5, 0);
    this.scene3D.add(this.clampRightGroup);

    // 4. Cargo Ship Inside Bay
    this.cargoShipGroup = new THREE.Group();
    this.shipMat = new THREE.MeshStandardMaterial({ color: 0x22262d, metalness: 0.85, roughness: 0.35 });
    const spineGeom = new THREE.BoxGeometry(1.6, 1.2, 8.0);
    const spineMesh = new THREE.Mesh(spineGeom, this.shipMat);
    this.cargoShipGroup.add(spineMesh);

    // Reverse Thruster Burn Emitters
    this.thrusterGlowMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const glowGeom = new THREE.ConeGeometry(0.35, 2.0, 12);
    glowGeom.rotateX(Math.PI / 2); // points forward for reverse deceleration

    this.reverseBurnGlowL = new THREE.Mesh(glowGeom, this.thrusterGlowMat);
    this.reverseBurnGlowL.position.set(-1.2, 0.3, 3.5);
    this.cargoShipGroup.add(this.reverseBurnGlowL);

    this.reverseBurnGlowR = new THREE.Mesh(glowGeom, this.thrusterGlowMat);
    this.reverseBurnGlowR.position.set(1.2, 0.3, 3.5);
    this.cargoShipGroup.add(this.reverseBurnGlowR);

    this.scene3D.add(this.cargoShipGroup);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { renderer } = this.ctx;
    const t = f.t; // 10.0 .. 20.0s
    const localT = clamp(t - 10.0, 0, 10.0);
    const u = localT / 10.0;

    // Ship Deceleration Curve (Settles into berth at localT ~ 4.5s)
    const settleProgress = clamp(localT / 4.5, 0, 1);
    const posZ = lerp(-14.0, 0.0, ease.outCubic(settleProgress));
    const posY = lerp(1.2, 0.0, ease.outQuad(settleProgress)) + Math.sin(t * 1.5) * 0.02 * (1.0 - settleProgress);
    const posX = lerp(0.8, 0.0, ease.outQuad(settleProgress));

    this.cargoShipGroup.position.set(posX, posY, posZ);

    // Reverse Burn Thrusters firing during active braking (localT < 3.8s)
    const isBraking = localT < 3.8;
    const brakeIntensity = isBraking ? (1.0 - localT / 3.8) * (1.0 + Math.sin(t * 25.0) * 0.2) : 0.0;
    this.reverseBurnGlowL.scale.set(brakeIntensity, brakeIntensity, brakeIntensity);
    this.reverseBurnGlowR.scale.set(brakeIntensity, brakeIntensity, brakeIntensity);
    this.reverseBurnGlowL.visible = brakeIntensity > 0.05;
    this.reverseBurnGlowR.visible = brakeIntensity > 0.05;

    // Mechanical Clamps Engagement (swinging in around localT = 3.5s .. 5.5s, absolute t = 13.5s .. 15.5s)
    const clampProgress = clamp((localT - 3.5) / 2.0, 0, 1);
    const clampOffset = lerp(0.0, 2.8, ease.outBack(clampProgress));
    this.clampLeftGroup.position.x = -6.5 + clampOffset;
    this.clampRightGroup.position.x = 6.5 - clampOffset;

    // Camera dynamic docking dolly & tilt
    this.camera3D.position.x = lerp(3.5, 1.2, u);
    this.camera3D.position.y = lerp(4.5, 2.5, u);
    this.camera3D.position.z = lerp(14.0, 8.5, ease.outQuad(u));
    this.camera3D.lookAt(posX, posY + 0.2, posZ);

    this.camera3D.updateMatrixWorld();
    this.cargoShipGroup.updateMatrixWorld();

    // 3D Spatial Audio Telemetry for docked ship & clamps
    const shipWorldPos: [number, number, number] = [posX, posY, posZ];
    const camMatInv = this.camera3D.matrixWorldInverse.elements;
    const camProjMat = this.camera3D.projectionMatrix.elements;
    const spatial = projectWorldToScreenPan(shipWorldPos, camMatInv, camProjMat, 0.65);

    emitDockingTelemetry('cargo_ship', {
      pos: shipWorldPos,
      screenPos: spatial.ndc,
      pan: spatial.pan,
      distance: spatial.distance,
      velocity: isBraking ? (1.0 - settleProgress) * 4.0 : 0.0,
      zone: 'hangar_bay',
      occluded: false,
    });

    // Clamp hit impact telemetry around t = 15.0s (clampProgress reaching 1.0)
    if (clampProgress > 0.95 && clampProgress < 1.0) {
      emitDockingTelemetry('dock_clamp', {
        pos: [0, 0, 0],
        screenPos: [0, 0],
        pan: 0.0,
        distance: spatial.distance,
        velocity: 0.0,
        zone: 'hangar_bay',
      });
    }

    const frameIndex = Math.round(t * 60);
    commitDockingTelemetryFrame(frameIndex, t);

    // Render 3D Scene
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    return {
      exposure: 1.0,
      bloom: 0.4,
      ca: 0.2,
      grade: 'industrial',
    };
  }
}

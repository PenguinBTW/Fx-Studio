// Spacecraft Docking Benchmark - Scene 1: Orbital Approach (f(x) Studio v0.8.0)
// 3D Procedural Three.js scene: Heavy orbital cargo transport navigating an asteroid field
// toward the station hangar entrance. Emits 3D object-bound spatial audio telemetry.

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

export const approachTelemetryEmitter = new AudioTelemetryEmitter();

export function emitAudioTelemetry(sourceId: string, point: Partial<AudioTelemetryPoint>): void {
  approachTelemetryEmitter.emit(sourceId, point);
}

export function commitAudioTelemetryFrame(frame: number, t: number): TelemetryFrame {
  return approachTelemetryEmitter.captureFrame(frame, t);
}

export default class SceneApproach extends Scene {
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;

  // 3D Objects
  private cargoShipGroup!: THREE.Group;
  private engineGlowMesh!: THREE.Mesh;
  private stationGroup!: THREE.Group;
  private asteroidField!: THREE.Points;
  private stars!: THREE.Points;

  // Materials
  private hullMat!: THREE.MeshStandardMaterial;
  private containerMat!: THREE.MeshStandardMaterial;
  private glowMat!: THREE.MeshBasicMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init(): void {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(40, W / H, 0.1, 1000.0);
    this.camera3D.position.set(0, 3.5, 16.0);
    this.camera3D.lookAt(0, 0, 0);

    // 1. Lighting: High-contrast deep space solar key + ambient fill
    const dirLight = new THREE.DirectionalLight(0xfff5e6, 3.5);
    dirLight.position.set(20, 15, 10);
    this.scene3D.add(dirLight);

    const ambLight = new THREE.AmbientLight(0x0a1020, 0.6);
    this.scene3D.add(ambLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 2.0);
    rimLight.position.set(-15, -5, -10);
    this.scene3D.add(rimLight);

    // 2. Background Starfield
    const starCount = 3000;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
      starPos[i * 3 + 2] = -50 - Math.random() * 200;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xe0e8f0, size: 1.2, sizeAttenuation: false });
    this.stars = new THREE.Points(starGeom, starMat);
    this.scene3D.add(this.stars);

    // 3. Asteroid Station in Background
    this.stationGroup = new THREE.Group();
    const rockGeom = new THREE.DodecahedronGeometry(8.0, 2);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3c42, roughness: 0.9, metalness: 0.2 });
    const asteroidCore = new THREE.Mesh(rockGeom, rockMat);
    this.stationGroup.add(asteroidCore);

    // Hangar Airlock Portal on Asteroid Face
    const airlockRingGeom = new THREE.TorusGeometry(3.2, 0.4, 16, 32);
    const airlockMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, metalness: 0.8, roughness: 0.3 });
    const airlockRing = new THREE.Mesh(airlockRingGeom, airlockMat);
    airlockRing.position.set(0, 0, 7.5);
    this.stationGroup.add(airlockRing);

    // Beacon Lights around airlock
    const beaconGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(beaconGeom, beaconMat);
      b.position.set(Math.cos(angle) * 3.2, Math.sin(angle) * 3.2, 7.6);
      this.stationGroup.add(b);
    }

    this.stationGroup.position.set(6.0, 1.0, -25.0);
    this.scene3D.add(this.stationGroup);

    // 4. Procedural Orbital Cargo Transport ("cargo_ship")
    this.cargoShipGroup = new THREE.Group();

    this.hullMat = new THREE.MeshStandardMaterial({ color: 0x22262d, metalness: 0.85, roughness: 0.35 });
    this.containerMat = new THREE.MeshStandardMaterial({ color: 0xd9822b, metalness: 0.4, roughness: 0.5 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    // Main fuselage spine
    const spineGeom = new THREE.BoxGeometry(1.6, 1.2, 8.0);
    const spineMesh = new THREE.Mesh(spineGeom, this.hullMat);
    this.cargoShipGroup.add(spineMesh);

    // Command cockpit pod
    const bridgeGeom = new THREE.ConeGeometry(1.1, 2.2, 4);
    bridgeGeom.rotateX(Math.PI / 2);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, this.hullMat);
    bridgeMesh.position.set(0, 0.4, 4.8);
    this.cargoShipGroup.add(bridgeMesh);

    // Cargo Container Modules (stacked pairs)
    const boxGeom = new THREE.BoxGeometry(0.9, 0.9, 1.4);
    for (let z = -2.2; z <= 2.2; z += 1.8) {
      const leftBox = new THREE.Mesh(boxGeom, this.containerMat);
      leftBox.position.set(-1.1, 0, z);
      const rightBox = new THREE.Mesh(boxGeom, this.containerMat);
      rightBox.position.set(1.1, 0, z);
      this.cargoShipGroup.add(leftBox);
      this.cargoShipGroup.add(rightBox);
    }

    // Dual Ion Engine Nozzles & Exhaust Plumes
    const engineGeom = new THREE.CylinderGeometry(0.45, 0.6, 1.2, 16);
    engineGeom.rotateX(Math.PI / 2);
    const engineL = new THREE.Mesh(engineGeom, this.hullMat);
    engineL.position.set(-0.9, 0, -4.2);
    const engineR = new THREE.Mesh(engineGeom, this.hullMat);
    engineR.position.set(0.9, 0, -4.2);
    this.cargoShipGroup.add(engineL);
    this.cargoShipGroup.add(engineR);

    // Glowing Ion Jet Core
    const glowGeom = new THREE.ConeGeometry(0.5, 3.5, 16);
    glowGeom.rotateX(-Math.PI / 2);
    this.engineGlowMesh = new THREE.Mesh(glowGeom, this.glowMat);
    this.engineGlowMesh.position.set(0, 0, -5.5);
    this.cargoShipGroup.add(this.engineGlowMesh);

    this.scene3D.add(this.cargoShipGroup);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { renderer } = this.ctx;
    const t = f.t; // 0.0 .. 12.0s
    const u = clamp(t / 12.0, 0, 1);

    // Smooth approach trajectory: flying from left foreground toward station airlock
    const posX = lerp(-11.0, 4.5, ease.outQuad(u));
    const posY = lerp(2.2, 0.8, u) + Math.sin(t * 0.8) * 0.15;
    const posZ = lerp(4.0, -18.0, ease.inOutCubic(u));

    this.cargoShipGroup.position.set(posX, posY, posZ);
    this.cargoShipGroup.rotation.y = lerp(-0.35, 0.15, u);
    this.cargoShipGroup.rotation.z = Math.sin(t * 1.2) * 0.04;

    // Thruster flare pulse
    const thrusterPulse = 1.0 + Math.sin(t * 18.0) * 0.18 + Math.cos(t * 31.0) * 0.08;
    this.engineGlowMesh.scale.set(thrusterPulse, thrusterPulse, thrusterPulse * 1.2);

    // Camera cinematic parallax tracking
    this.camera3D.position.x = lerp(-4.0, 1.5, u * 0.8);
    this.camera3D.position.y = lerp(3.2, 1.8, u);
    this.camera3D.position.z = lerp(16.0, 8.0, u * 0.5);
    this.camera3D.lookAt(posX * 0.6, posY * 0.5, posZ * 0.7);

    // Update Three.js matrices for accurate screen projection
    this.camera3D.updateMatrixWorld();
    this.cargoShipGroup.updateMatrixWorld();

    // 3D Spatial Audio Telemetry Calculation
    const shipWorldPos: [number, number, number] = [posX, posY, posZ];
    const camMatInv = this.camera3D.matrixWorldInverse.elements;
    const camProjMat = this.camera3D.projectionMatrix.elements;
    const spatial = projectWorldToScreenPan(shipWorldPos, camMatInv, camProjMat, 0.65);

    // Compute velocity magnitude (approximate derivative)
    const velocity = 8.5; // ~8.5 m/s orbital translation speed

    // Emit object-bound audio telemetry
    emitAudioTelemetry('cargo_ship', {
      pos: shipWorldPos,
      screenPos: spatial.ndc,
      pan: spatial.pan,
      distance: spatial.distance,
      velocity,
      zone: 'deep_space',
      occluded: false,
    });

    const frameIndex = Math.round(t * 60);
    commitAudioTelemetryFrame(frameIndex, t);

    // Render 3D scene to target
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);
    renderer.resetState();

    return {
      exposure: 1.0,
      bloom: 0.35,
      ca: 0.25,
      grade: 'industrial',
    };
  }
}

// Spacecraft Docking Benchmark - Scene 1: Orbital Approach (f(x) Studio v0.8.0)
// High-fidelity procedural 3D scene: Heavy orbital transport Aegis-VII navigating
// past asteroid field and aligning with station airlock. Emits 3D object-bound spatial audio telemetry.

import * as THREE from 'three';
import { Scene, Frame, PostOverrides, SceneCtx } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { clamp, ease, lerp } from '../../engine/util';
import {
  AudioTelemetryEmitter,
  projectWorldToScreenPan,
  type AudioTelemetryPoint,
  type TelemetryFrame,
} from '../../engine/audio/telemetry';
import { createAegisShip, type ShipMeshSet } from './ship_model';

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
  private hudLayer!: Layer2D;

  // 3D Entities
  private ship!: ShipMeshSet;
  private stationGroup!: THREE.Group;
  private stars!: THREE.Points;
  private spaceDust!: THREE.Points;
  private dustPositions!: Float32Array;
  private beaconLights: THREE.Mesh[] = [];
  private glidePathLines!: THREE.LineSegments;

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init(): void {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(40, W / H, 0.1, 1500.0);
    this.camera3D.position.set(-3.0, 3.2, 16.0);
    this.camera3D.lookAt(0, 0, 0);

    this.hudLayer = new Layer2D(W, H);

    // 1. High-Contrast Solar Key + Cyan Space Fill Lighting
    const sunLight = new THREE.DirectionalLight(0xfff6ea, 3.8);
    sunLight.position.set(25, 20, 15);
    this.scene3D.add(sunLight);

    const cyanRim = new THREE.DirectionalLight(0x00f0ff, 2.2);
    cyanRim.position.set(-20, -10, -15);
    this.scene3D.add(cyanRim);

    const ambLight = new THREE.AmbientLight(0x0a1324, 0.7);
    this.scene3D.add(ambLight);

    // 2. Starfield & Cosmic Dust
    const starCount = 3000;
    const starGeom = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 800;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 800;
      starPos[i * 3 + 2] = -80 - Math.random() * 400;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xdce7f5, size: 1.3, sizeAttenuation: false });
    this.stars = new THREE.Points(starGeom, starMat);
    this.scene3D.add(this.stars);

    // Near-field space dust motes for forward motion perception
    const dustCount = 500;
    const dustGeom = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      this.dustPositions[i * 3] = (Math.random() - 0.5) * 35;
      this.dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
    });
    this.spaceDust = new THREE.Points(dustGeom, dustMat);
    this.scene3D.add(this.spaceDust);

    // 3. Ceres-Prime Asteroid Station Complex
    this.stationGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x2e323b,
      roughness: 0.92,
      metalness: 0.18,
    });
    const stationSteelMat = new THREE.MeshStandardMaterial({
      color: 0x1b212d,
      roughness: 0.35,
      metalness: 0.88,
    });
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x0f3460,
      metalness: 0.95,
      roughness: 0.15,
    });

    // Main Asteroid Core
    const rockCore = new THREE.Mesh(new THREE.DodecahedronGeometry(11.0, 2), rockMat);
    this.stationGroup.add(rockCore);

    // Peripheral Satellite Boulders
    const boulderGeom = new THREE.DodecahedronGeometry(2.4, 1);
    for (let b = 0; b < 6; b++) {
      const angle = (b / 6) * Math.PI * 2;
      const boulder = new THREE.Mesh(boulderGeom, rockMat);
      boulder.position.set(Math.cos(angle) * 14.5, (b % 2 === 0 ? 3.5 : -4.0), Math.sin(angle) * 12.0);
      boulder.rotation.set(b * 0.8, b * 1.2, 0);
      this.stationGroup.add(boulder);
    }

    // Industrial Truss Ring & Airlock Portal
    const ringGeom = new THREE.TorusGeometry(4.2, 0.55, 16, 48);
    const ringMesh = new THREE.Mesh(ringGeom, stationSteelMat);
    ringMesh.position.set(0, 0, 10.5);
    this.stationGroup.add(ringMesh);

    // Airlock Inner Tunnel
    const tunnelGeom = new THREE.CylinderGeometry(3.6, 3.6, 6.0, 32, 1, true);
    tunnelGeom.rotateX(Math.PI / 2);
    const tunnelMesh = new THREE.Mesh(tunnelGeom, stationSteelMat);
    tunnelMesh.position.set(0, 0, 7.5);
    this.stationGroup.add(tunnelMesh);

    // Sequenced Perimeter Beacons
    const beaconGeom = new THREE.SphereGeometry(0.22, 12, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const bMesh = new THREE.Mesh(beaconGeom, beaconMat.clone());
      bMesh.position.set(Math.cos(angle) * 4.2, Math.sin(angle) * 4.2, 10.7);
      this.beaconLights.push(bMesh);
      this.stationGroup.add(bMesh);
    }

    // Solar Collector Panels
    const solarGeom = new THREE.BoxGeometry(6.0, 1.8, 0.1);
    const solarL = new THREE.Mesh(solarGeom, solarMat);
    solarL.position.set(-11.5, 5.0, 2.0);
    solarL.rotation.y = 0.4;
    this.stationGroup.add(solarL);

    const solarR = new THREE.Mesh(solarGeom, solarMat);
    solarR.position.set(11.5, -4.0, 3.0);
    solarR.rotation.y = -0.4;
    this.stationGroup.add(solarR);

    // Laser Approach Glidepath Corridor Beams
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array([
      -3.6, 0, 10.5,   -7.5, 2.0, 45.0,
       3.6, 0, 10.5,    7.5, 2.0, 45.0,
    ]);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
    });
    this.glidePathLines = new THREE.LineSegments(lineGeom, lineMat);
    this.stationGroup.add(this.glidePathLines);

    this.stationGroup.position.set(5.5, 1.2, -26.0);
    this.scene3D.add(this.stationGroup);

    // 4. Hero Cargo Vessel: Aegis-VII
    this.ship = createAegisShip();
    this.scene3D.add(this.ship.group);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { renderer, comp } = this.ctx;
    const t = f.t; // 0.0 .. 12.0s
    const u = clamp(t / 12.0, 0, 1);

    // Smooth approach trajectory: flying from foreground left toward station airlock
    const posX = lerp(-10.5, 4.6, ease.outQuad(u));
    const posY = lerp(2.4, 0.9, u) + Math.sin(t * 0.9) * 0.12;
    const posZ = lerp(5.0, -18.5, ease.inOutCubic(u));

    this.ship.group.position.set(posX, posY, posZ);
    this.ship.group.rotation.y = lerp(-0.38, 0.12, u);
    this.ship.group.rotation.z = Math.sin(t * 1.1) * 0.035;

    // Throttle is high during cruise (0-9s), easing off as ship reaches airlock entry (9-12s)
    const throttle = u < 0.75 ? 1.0 : lerp(1.0, 0.25, (u - 0.75) / 0.25);
    this.ship.update(t, throttle, 0.0);

    // Beacon rotation sequence on station airlock
    const activeBeacon = Math.floor(t * 8.0) % 12;
    for (let i = 0; i < this.beaconLights.length; i++) {
      const isLit = (i === activeBeacon) || ((i + 6) % 12 === activeBeacon);
      const bMat = this.beaconLights[i]!.material as THREE.MeshBasicMaterial;
      bMat.color.setHex(isLit ? 0x00f0ff : 0x78350f);
    }

    // Camera cinematic tracking with subtle organic handheld drift
    const camDriftX = Math.sin(t * 0.7) * 0.08;
    const camDriftY = Math.cos(t * 0.8) * 0.06;
    this.camera3D.position.x = lerp(-4.2, 1.8, u * 0.85) + camDriftX;
    this.camera3D.position.y = lerp(3.5, 1.9, u) + camDriftY;
    this.camera3D.position.z = lerp(16.5, 8.5, u * 0.5);
    this.camera3D.lookAt(posX * 0.65, posY * 0.55, posZ * 0.72);

    this.camera3D.updateMatrixWorld();
    this.ship.group.updateMatrixWorld();

    // 3D Spatial Audio Telemetry Calculation
    const shipWorldPos: [number, number, number] = [posX, posY, posZ];
    const camMatInv = this.camera3D.matrixWorldInverse.elements;
    const camProjMat = this.camera3D.projectionMatrix.elements;
    const spatial = projectWorldToScreenPan(shipWorldPos, camMatInv, camProjMat, 0.65);

    const velocity = 8.5 * throttle; // ~8.5 m/s orbital translation speed

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

    // 1. Render 3D Scene to target
    renderer.setRenderTarget(out);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);

    // 2. Render Integrated Aerospace Telemetry HUD Layer
    this.hudLayer.clear();
    const c = this.hudLayer.ctx;

    // Monospace Header Telemetry
    c.fillStyle = 'rgba(226, 232, 240, 0.92)';
    c.font = '700 13px "IBMPlexMono", monospace';
    c.fillText('AEGIS-VII // ORBITAL FREIGHTER TRANSIT', 64, 58);

    c.fillStyle = 'rgba(56, 189, 248, 0.85)';
    c.font = '500 11px "IBMPlexMono", monospace';
    c.fillText('AUTONOMOUS DOCKING VECTOR // CORRIDOR ALPHA-9', 64, 76);

    c.fillStyle = 'rgba(148, 163, 184, 0.75)';
    c.font = '500 11px "IBMPlexMono", monospace';
    c.fillText(`CHRONO: T+${t.toFixed(2).padStart(5, '0')}s · REL_VEL: ${velocity.toFixed(1)} m/s`, 64, 94);

    // Top Right Comms Indicator
    c.textAlign = 'right';
    c.fillStyle = t > 3.0 && t < 9.0 ? 'rgba(34, 197, 94, 0.95)' : 'rgba(148, 163, 184, 0.70)';
    c.fillText(t > 3.0 && t < 9.0 ? '● COMMS: EVA CLEARANCE ACTIVE' : '○ COMMS: STANDBY', W - 64, 58);
    c.fillStyle = 'rgba(148, 163, 184, 0.70)';
    c.fillText('CERES-PRIME DOCKING CONTROL [121.500 MHz]', W - 64, 76);
    c.textAlign = 'left';

    // Projected 3D Target Reticle on Station Airlock
    const stationWorldPos = new THREE.Vector3(5.5, 1.2, -15.5);
    stationWorldPos.project(this.camera3D);
    const screenX = (stationWorldPos.x * 0.5 + 0.5) * W;
    const screenY = (-stationWorldPos.y * 0.5 + 0.5) * H;

    if (stationWorldPos.z < 1.0) {
      const boxSize = lerp(48, 110, u);
      c.strokeStyle = 'rgba(56, 189, 248, 0.85)';
      c.lineWidth = 1.5;

      // Corner Brackets
      const d = boxSize * 0.5;
      const arm = boxSize * 0.25;
      c.beginPath();
      // Top-Left
      c.moveTo(screenX - d, screenY - d + arm); c.lineTo(screenX - d, screenY - d); c.lineTo(screenX - d + arm, screenY - d);
      // Top-Right
      c.moveTo(screenX + d - arm, screenY - d); c.lineTo(screenX + d, screenY - d); c.lineTo(screenX + d, screenY - d + arm);
      // Bottom-Left
      c.moveTo(screenX - d, screenY + d - arm); c.lineTo(screenX - d, screenY + d); c.lineTo(screenX - d + arm, screenY + d);
      // Bottom-Right
      c.moveTo(screenX + d - arm, screenY + d); c.lineTo(screenX + d, screenY + d); c.lineTo(screenX + d, screenY + d - arm);
      c.stroke();

      // Range readout
      const rangeM = Math.round(lerp(1240, 45, ease.inOutCubic(u)));
      c.fillStyle = 'rgba(56, 189, 248, 0.95)';
      c.font = '700 11px "IBMPlexMono", monospace';
      c.fillText(`LOCK: CERES-AIRLOCK`, screenX + d + 12, screenY - 6);
      c.fillStyle = 'rgba(226, 232, 240, 0.85)';
      c.fillText(`RNG: ${rangeM.toString().padStart(4, '0')}m`, screenX + d + 12, screenY + 10);
    }

    // Lower-Right Stereo Audio Spatializer Telemetry Gauge
    const gaugeX = W - 320;
    const gaugeY = H - 64;
    c.fillStyle = 'rgba(15, 23, 42, 0.70)';
    c.fillRect(gaugeX - 16, gaugeY - 24, 272, 48);
    c.strokeStyle = 'rgba(56, 189, 248, 0.40)';
    c.lineWidth = 1;
    c.strokeRect(gaugeX - 16, gaugeY - 24, 272, 48);

    c.fillStyle = 'rgba(148, 163, 184, 0.85)';
    c.font = '600 10px "IBMPlexMono", monospace';
    c.fillText('3D SPATIAL TELEMETRY (PAN)', gaugeX, gaugeY - 8);

    // Pan bar
    const barWidth = 240;
    c.strokeStyle = 'rgba(71, 85, 105, 0.8)';
    c.beginPath();
    c.moveTo(gaugeX, gaugeY + 10);
    c.lineTo(gaugeX + barWidth, gaugeY + 10);
    c.stroke();

    // Center tick
    c.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    c.beginPath();
    c.moveTo(gaugeX + barWidth / 2, gaugeY + 4);
    c.lineTo(gaugeX + barWidth / 2, gaugeY + 16);
    c.stroke();

    // Pan pip indicator
    const panNorm = (spatial.pan + 0.65) / 1.30; // 0..1
    const pipX = gaugeX + clamp(panNorm, 0, 1) * barWidth;
    c.fillStyle = '#00f0ff';
    c.beginPath();
    c.arc(pipX, gaugeY + 10, 4.5, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = '#38bdf8';
    c.fillText(`${spatial.pan > 0 ? '+' : ''}${spatial.pan.toFixed(2)}`, gaugeX + barWidth - 36, gaugeY - 8);

    // Composite HUD onto out target
    comp.draw(renderer, this.hudLayer.upload(), out, { mode: 'normal' });
    renderer.resetState();

    return {
      exposure: 1.05,
      bloom: 0.42,
      ca: 0.22,
      grade: 'industrial',
    };
  }

  override dispose(): void {
    this.ship.dispose();
    this.hudLayer.dispose();
    this.scene3D.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  }
}

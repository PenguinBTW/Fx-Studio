// Spacecraft Docking Benchmark - Scene 2: Pressurized Hangar Docking Bay (f(x) Studio v0.8.0)
// High-fidelity procedural 3D scene: Heavy orbital transport Aegis-VII entering
// the pressurized station hangar, reverse RCS braking, rail alignment, and hydraulic clamp lockdown.

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
  private hudLayer!: Layer2D;

  // 3D Objects
  private ship!: ShipMeshSet;
  private hangarBayGroup!: THREE.Group;
  private clampLeftGroup!: THREE.Group;
  private clampRightGroup!: THREE.Group;
  private clampLightL!: THREE.Mesh;
  private clampLightR!: THREE.Mesh;
  private steamParticles!: THREE.Points;
  private steamPos!: Float32Array;

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init(): void {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(42, W / H, 0.1, 800.0);
    this.camera3D.position.set(2.8, 3.8, 14.5);
    this.camera3D.lookAt(0, 0.8, 0);

    this.hudLayer = new Layer2D(W, H);

    // 1. Pressurized Hangar Lighting: Overhead industrial floodlights + warm amber accents
    const overheadKey = new THREE.DirectionalLight(0xdbeafe, 3.2);
    overheadKey.position.set(0, 25, 4);
    this.scene3D.add(overheadKey);

    const amberFill = new THREE.PointLight(0xf59e0b, 3.5, 35.0);
    amberFill.position.set(0, 2.0, 0);
    this.scene3D.add(amberFill);

    const floorRim = new THREE.DirectionalLight(0x00f0ff, 1.4);
    floorRim.position.set(0, -5, -10);
    this.scene3D.add(floorRim);

    const ambLight = new THREE.AmbientLight(0x131a26, 0.75);
    this.scene3D.add(ambLight);

    // 2. Hangar Bay Architecture (Gantry Ribs, Floor Deck, Guide Rails)
    this.hangarBayGroup = new THREE.Group();

    const deckSteelMat = new THREE.MeshStandardMaterial({
      color: 0x181e28,
      metalness: 0.85,
      roughness: 0.38,
    });
    const gantrySteelMat = new THREE.MeshStandardMaterial({
      color: 0x242c38,
      metalness: 0.80,
      roughness: 0.45,
    });
    const cautionMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.40,
      roughness: 0.50,
    });
    const railGlowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    // Landing Deck Floor
    const floorGeom = new THREE.BoxGeometry(26.0, 0.8, 48.0);
    const floorMesh = new THREE.Mesh(floorGeom, deckSteelMat);
    floorMesh.position.set(0, -2.4, 0);
    this.hangarBayGroup.add(floorMesh);

    // Floor Guide Rails (Recessed illuminated neon tracks)
    const railGeom = new THREE.BoxGeometry(0.25, 0.15, 44.0);
    const railL = new THREE.Mesh(railGeom, railGlowMat);
    railL.position.set(-2.8, -1.98, 0);
    const railR = new THREE.Mesh(railGeom, railGlowMat);
    railR.position.set(2.8, -1.98, 0);
    this.hangarBayGroup.add(railL);
    this.hangarBayGroup.add(railR);

    // Hazard Stripes alongside rails
    const hazardGeom = new THREE.BoxGeometry(0.5, 0.05, 40.0);
    const hazL = new THREE.Mesh(hazardGeom, cautionMat);
    hazL.position.set(-3.4, -1.97, 0);
    const hazR = new THREE.Mesh(hazardGeom, cautionMat);
    hazR.position.set(3.4, -1.97, 0);
    this.hangarBayGroup.add(hazL);
    this.hangarBayGroup.add(hazR);

    // Arch Gantry Truss Ribs (8 ribbed arches)
    const ribColGeom = new THREE.BoxGeometry(0.8, 14.0, 1.0);
    const ribRoofGeom = new THREE.BoxGeometry(26.0, 1.2, 1.0);
    const lightFixtureGeom = new THREE.BoxGeometry(2.2, 0.4, 0.6);
    const lightGlowMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe });

    for (let z = -20.0; z <= 20.0; z += 5.5) {
      // Left pillar
      const pL = new THREE.Mesh(ribColGeom, gantrySteelMat);
      pL.position.set(-12.0, 4.5, z);
      this.hangarBayGroup.add(pL);

      // Right pillar
      const pR = new THREE.Mesh(ribColGeom, gantrySteelMat);
      pR.position.set(12.0, 4.5, z);
      this.hangarBayGroup.add(pR);

      // Overhead crossbeam
      const cross = new THREE.Mesh(ribRoofGeom, gantrySteelMat);
      cross.position.set(0, 11.5, z);
      this.hangarBayGroup.add(cross);

      // Overhead floodlight fixture
      const fixture = new THREE.Mesh(lightFixtureGeom, lightGlowMat);
      fixture.position.set(0, 10.8, z);
      this.hangarBayGroup.add(fixture);
    }

    this.scene3D.add(this.hangarBayGroup);

    // 3. Multi-Segment Articulated Hydraulic Clamps (Left & Right)
    const clampBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1f2632,
      metalness: 0.88,
      roughness: 0.35,
    });
    const pistonChromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.10,
    });
    const jawRubberMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.10,
    });
    const warningAmberMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    // Left Clamp Assembly
    this.clampLeftGroup = new THREE.Group();

    const pedestalL = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 2.4), clampBaseMat);
    pedestalL.position.set(-0.8, 0, 0);
    this.clampLeftGroup.add(pedestalL);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.4), clampBaseMat);
    armL.position.set(1.6, 0.8, 0);
    this.clampLeftGroup.add(armL);

    const pistonL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.8, 12), pistonChromeMat);
    pistonL.rotateZ(Math.PI / 2);
    pistonL.position.set(2.8, 0.8, 0);
    this.clampLeftGroup.add(pistonL);

    const jawL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.8), jawRubberMat);
    jawL.position.set(4.2, 0.8, 0);
    this.clampLeftGroup.add(jawL);

    this.clampLightL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), warningAmberMat);
    this.clampLightL.position.set(-0.8, 1.8, 0);
    this.clampLeftGroup.add(this.clampLightL);

    this.clampLeftGroup.position.set(-8.2, -0.6, 0);
    this.scene3D.add(this.clampLeftGroup);

    // Right Clamp Assembly
    this.clampRightGroup = new THREE.Group();

    const pedestalR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.2, 2.4), clampBaseMat);
    pedestalR.position.set(0.8, 0, 0);
    this.clampRightGroup.add(pedestalR);

    const armR = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 1.4), clampBaseMat);
    armR.position.set(-1.6, 0.8, 0);
    this.clampRightGroup.add(armR);

    const pistonR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 2.8, 12), pistonChromeMat);
    pistonR.rotateZ(Math.PI / 2);
    pistonR.position.set(-2.8, 0.8, 0);
    this.clampRightGroup.add(pistonR);

    const jawR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.8), jawRubberMat);
    jawR.position.set(-4.2, 0.8, 0);
    this.clampRightGroup.add(jawR);

    this.clampLightR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), warningAmberMat);
    this.clampLightR.position.set(0.8, 1.8, 0);
    this.clampRightGroup.add(this.clampLightR);

    this.clampRightGroup.position.set(8.2, -0.6, 0);
    this.scene3D.add(this.clampRightGroup);

    // 4. Atmospheric Steam / Dust Motes
    const steamCount = 400;
    const steamGeom = new THREE.BufferGeometry();
    this.steamPos = new Float32Array(steamCount * 3);
    for (let i = 0; i < steamCount; i++) {
      this.steamPos[i * 3] = (Math.random() - 0.5) * 22;
      this.steamPos[i * 3 + 1] = Math.random() * 8 - 1;
      this.steamPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    }
    steamGeom.setAttribute('position', new THREE.BufferAttribute(this.steamPos, 3));
    const steamMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 1.8,
      transparent: true,
      opacity: 0.35,
    });
    this.steamParticles = new THREE.Points(steamGeom, steamMat);
    this.scene3D.add(this.steamParticles);

    // 5. Hero Cargo Vessel: Aegis-VII
    this.ship = createAegisShip();
    this.scene3D.add(this.ship.group);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { renderer, comp } = this.ctx;
    const t = f.t; // 10.0 .. 20.0s
    const localT = clamp(t - 10.0, 0, 10.0);
    const u = localT / 10.0;

    // Ship Deceleration & Docking Alignment Curve (smooth settle at localT ~ 4.8s)
    const settleProgress = clamp(localT / 4.8, 0, 1);
    const posZ = lerp(-14.5, 0.0, ease.outCubic(settleProgress));
    const posY = lerp(1.4, -0.2, ease.outQuad(settleProgress));
    const posX = lerp(0.85, 0.0, ease.outQuad(settleProgress));

    this.ship.group.position.set(posX, posY, posZ);

    // Active Braking: Reverse RCS thrusters firing during localT < 3.8s
    const isBraking = localT < 3.8;
    const brakeIntensity = isBraking ? (1.0 - localT / 3.8) : 0.0;
    this.ship.update(t, 0.05, brakeIntensity); // main thrusters idle, RCS braking

    // Hydraulic Clamps Engagement Sequence
    // Swing in around localT = 3.6s .. 5.2s (t = 13.6s .. 15.2s)
    const clampProgress = clamp((localT - 3.6) / 1.6, 0, 1);
    const clampOffset = lerp(0.0, 2.75, ease.outBack(clampProgress));
    this.clampLeftGroup.position.x = -8.2 + clampOffset;
    this.clampRightGroup.position.x = 8.2 - clampOffset;

    // Clamps Amber Strobes Flash while moving
    const clampStrobeOn = clampProgress > 0 && clampProgress < 1.0 && ((t * 4.0) % 1.0 < 0.5);
    this.clampLightL.visible = clampStrobeOn;
    this.clampLightR.visible = clampStrobeOn;

    // Camera dynamic docking dolly & tilt
    // Sudden impact tremor pulse at t = 15.0s (clampProgress reaching 1.0)
    let impactShake = 0.0;
    if (localT >= 5.0 && localT < 5.6) {
      const shakeDecay = 1.0 - (localT - 5.0) / 0.6;
      impactShake = Math.sin((localT - 5.0) * 55.0) * 0.08 * shakeDecay;
    }

    this.camera3D.position.x = lerp(3.2, 1.4, u) + impactShake;
    this.camera3D.position.y = lerp(4.0, 2.6, u) + impactShake * 0.7;
    this.camera3D.position.z = lerp(14.5, 9.2, ease.outQuad(u));
    this.camera3D.lookAt(posX, posY + 0.3, posZ);

    this.camera3D.updateMatrixWorld();
    this.ship.group.updateMatrixWorld();

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

    // Clamp hit impact telemetry around t = 15.0s (localT = 5.0s)
    if (localT >= 4.95 && localT <= 5.15) {
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
    c.fillText('CERES-PRIME // PRESSURIZED HANGAR BAY 04', 64, 58);

    c.fillStyle = 'rgba(56, 189, 248, 0.85)';
    c.font = '500 11px "IBMPlexMono", monospace';
    const statusText = localT < 3.8
      ? 'STATUS: RCS ACTIVE BRAKING // LATERAL GUIDE ALIGNED'
      : clampProgress < 0.98
      ? 'STATUS: HYDRAULIC CLAMPS ARTICULATING // PRE-CAPTURE'
      : 'STATUS: MAG-LOCK 100% SECURED // EQUALIZATION COMPLETE';
    c.fillText(statusText, 64, 76);

    c.fillStyle = 'rgba(148, 163, 184, 0.75)';
    c.font = '500 11px "IBMPlexMono", monospace';
    c.fillText(`CHRONO: T+${t.toFixed(2).padStart(5, '0')}s · PRESSURE: 101.3 kPa [N2/O2]`, 64, 94);

    // Top Right Status
    c.textAlign = 'right';
    const isLocked = clampProgress >= 0.98;
    c.fillStyle = isLocked ? 'rgba(34, 197, 94, 0.95)' : 'rgba(245, 158, 11, 0.95)';
    c.fillText(isLocked ? '● BERTH 04: CAPTURE COMPLETE' : '▲ BERTH 04: CAPTURE ACTIVE', W - 64, 58);
    c.fillStyle = 'rgba(148, 163, 184, 0.70)';
    c.fillText('GUIDE RAILS: ENERGIZED // MAG-FIELD 4.2T', W - 64, 76);
    c.textAlign = 'left';

    // Center-Bottom Docking Alignment Crosshair
    const midX = W * 0.5;
    const midY = H * 0.82;
    c.strokeStyle = isLocked ? 'rgba(34, 197, 94, 0.85)' : 'rgba(56, 189, 248, 0.75)';
    c.lineWidth = 1.5;

    // Reticle circle
    c.beginPath();
    c.arc(midX, midY, 28, 0, Math.PI * 2);
    c.stroke();

    // Crosshairs
    c.beginPath();
    c.moveTo(midX - 42, midY); c.lineTo(midX - 32, midY);
    c.moveTo(midX + 32, midY); c.lineTo(midX + 42, midY);
    c.moveTo(midX, midY - 42); c.lineTo(midX, midY - 32);
    c.moveTo(midX, midY + 32); c.lineTo(midX, midY + 42);
    c.stroke();

    // Alignment label
    c.textAlign = 'center';
    c.font = '600 10px "IBMPlexMono", monospace';
    c.fillStyle = isLocked ? 'rgba(34, 197, 94, 0.95)' : 'rgba(56, 189, 248, 0.85)';
    c.fillText(isLocked ? 'BERTH LOCK: 100%' : `CLAMP PROGRESS: ${Math.round(clampProgress * 100)}%`, midX, midY + 46);
    c.textAlign = 'left';

    // Lower-Right DSP Engine Status Indicator
    const dspX = W - 320;
    const dspY = H - 64;
    c.fillStyle = 'rgba(15, 23, 42, 0.75)';
    c.fillRect(dspX - 16, dspY - 24, 272, 48);
    c.strokeStyle = isLocked ? 'rgba(34, 197, 94, 0.50)' : 'rgba(56, 189, 248, 0.40)';
    c.lineWidth = 1;
    c.strokeRect(dspX - 16, dspY - 24, 272, 48);

    c.fillStyle = 'rgba(148, 163, 184, 0.85)';
    c.font = '600 10px "IBMPlexMono", monospace';
    c.fillText('DSP SUITE TELEMETRY', dspX, dspY - 8);

    // Highlight split-band ducking at clamp impact
    const isDucking = (localT >= 4.8 && localT <= 5.8);
    c.fillStyle = isDucking ? '#f59e0b' : '#38bdf8';
    c.font = '700 11px "IBMPlexMono", monospace';
    c.fillText(
      isDucking ? '⚡ SPLIT-BAND DUCK: -4.5dB [250Hz]' : 'SPLIT-BAND DUCK: PASSIVE (UNITY)',
      dspX,
      dspY + 12,
    );

    // Composite HUD onto out target
    comp.draw(renderer, this.hudLayer.upload(), out, { mode: 'normal' });
    renderer.resetState();

    return {
      exposure: 1.05,
      bloom: 0.45,
      ca: 0.20,
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

// =============================================================================
// MASTER PROCEDURAL SCENE: "THE AIR-GAP CATHEDRAL"
//
// Continuous 60.0-Second Procedural Point-Cloud Masterpiece
//
// Palette:
//   --void:   #050506 (velvet ink black)
//   --bone:   #E8E4DA (warm living calcium stippling)
//   --ash:    #6B6A66 (subdued architectural structure)
//   --signal: #FF2A1F (conscious panic / neural shockwave / tachycardia)
//   --laser:  #00F0FF (autonomic Sinoatrial node / radar scan / capsule payload)
//   --gold:   #E5C07B (phrenic voluntary override & sacral bypass bridges)
//
// Invariants:
// - 100% procedural, strictly closed-form O(1): Frame = f(t)
// - Zero imported 3D models or textures
// - Custom GPU circular Gaussian splatting (no square pixels)
// - Over 250,000 active points
// - Hard clean cut to pure black at exactly 60.0s
// =============================================================================

import * as THREE from 'three';
import { Scene, Frame, PostOverrides } from '../../engine/scene';
import { W, H, Layer2D } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { rgba } from '../../engine/palette';
import { clamp, ease, lerp, prog } from '../../engine/util';

import { createPointCloudMaterial } from './cloud_shader';
import { CloudAnatomy } from './cloud_anatomy';
import { CloudCathedral } from './cloud_cathedral';
import { CloudDynamics } from './cloud_dynamics';

export default class AirgapScene extends Scene {
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;

  // Visual subsystems
  private anatomy!: CloudAnatomy;
  private cathedral!: CloudCathedral;
  private dynamics!: CloudDynamics;

  // Custom Shader Materials
  private anatomyMat!: THREE.ShaderMaterial;
  private cathedralMat!: THREE.ShaderMaterial;
  private capsuleMat!: THREE.ShaderMaterial;
  private neuralMat!: THREE.ShaderMaterial;
  private sparksMat!: THREE.ShaderMaterial;

  // 2D Minimalist Swiss HUD Telemetry
  private hudLayer!: Layer2D;

  override async init(): Promise<void> {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(34, W / H, 0.02, 50.0);

    // 1. Create Point Cloud Materials
    this.anatomyMat = createPointCloudMaterial();
    this.cathedralMat = createPointCloudMaterial();
    this.capsuleMat = createPointCloudMaterial();
    this.neuralMat = createPointCloudMaterial();
    this.sparksMat = createPointCloudMaterial();

    // 2. Instantiate Procedural Point Clouds
    this.anatomy = new CloudAnatomy();
    this.cathedral = new CloudCathedral();
    this.dynamics = new CloudDynamics();

    // 3. Assemble 3D Scene
    const anatomyMesh = new THREE.Points(this.anatomy.geometry, this.anatomyMat);
    const cathedralMesh = new THREE.Points(this.cathedral.geometry, this.cathedralMat);
    const capsuleMesh = new THREE.Points(this.dynamics.capsuleGeom, this.capsuleMat);
    const neuralMesh = new THREE.Points(this.dynamics.neuralGeom, this.neuralMat);
    const sparksMesh = new THREE.Points(this.dynamics.sparksGeom, this.sparksMat);

    this.scene3D.add(cathedralMesh);
    this.scene3D.add(anatomyMesh);
    this.scene3D.add(capsuleMesh);
    this.scene3D.add(neuralMesh);
    this.scene3D.add(sparksMesh);

    // 4. Initialize Swiss Telemetry Layer
    this.hudLayer = new Layer2D();
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer, comp } = this.ctx;

    // Hard clean cut to pure black at exactly 60.0s
    if (t >= 60.0) {
      renderer.setRenderTarget(out);
      renderer.setClearColor(0x050506, 1.0);
      renderer.clear();
      return {
        bloom: 0,
        bloomThreshold: 1.0,
        ca: 0,
        vignette: 0,
        filmGrain: 0,
      };
    }

    // -------------------------------------------------------------------------
    // 1. UPDATE DYNAMICS & ANATOMY KINEMATICS
    // -------------------------------------------------------------------------
    const dyn = this.dynamics.update(t);
    this.anatomy.update(t, dyn.heartRateHz);
    this.cathedral.update(t);

    // Update Shader Uniforms
    const uGlobalAlpha = clamp(1.0 - prog(t, 59.4, 60.0, ease.linear));

    this.anatomyMat.uniforms.t!.value = t;
    this.anatomyMat.uniforms.uGlobalAlpha!.value = uGlobalAlpha;
    this.anatomyMat.uniforms.uSizeMultiplier!.value = 1.0;
    this.anatomyMat.uniforms.uFlowTime!.value = t;
    this.anatomyMat.uniforms.uFlowSpeed!.value = 1.0;
    this.anatomyMat.uniforms.uUnravel!.value = dyn.dispersionAmount;
    this.anatomyMat.uniforms.uPulseIntensity!.value = dyn.pulseIntensity;
    this.anatomyMat.uniforms.uPulseOrigin!.value.copy(this.anatomy.heartPos);
    this.anatomyMat.uniforms.uPulseRadius!.value = dyn.pulseRadius;

    this.cathedralMat.uniforms.t!.value = t;
    this.cathedralMat.uniforms.uGlobalAlpha!.value = uGlobalAlpha * 0.95;
    this.cathedralMat.uniforms.uSizeMultiplier!.value = 1.65;
    this.cathedralMat.uniforms.uFlowTime!.value = t;
    this.cathedralMat.uniforms.uFlowSpeed!.value = 1.0;
    this.cathedralMat.uniforms.uUnravel!.value = dyn.dispersionAmount * 0.35;
    this.cathedralMat.uniforms.uPulseIntensity!.value = dyn.pulseIntensity * 0.25;
    this.cathedralMat.uniforms.uPulseOrigin!.value.copy(this.anatomy.heartPos);
    this.cathedralMat.uniforms.uPulseRadius!.value = dyn.pulseRadius;

    this.capsuleMat.uniforms.t!.value = t;
    this.capsuleMat.uniforms.uGlobalAlpha!.value = uGlobalAlpha;
    this.capsuleMat.uniforms.uSizeMultiplier!.value = 1.4;

    this.neuralMat.uniforms.t!.value = t;
    this.neuralMat.uniforms.uGlobalAlpha!.value = uGlobalAlpha;
    this.neuralMat.uniforms.uSizeMultiplier!.value = 1.6;

    this.sparksMat.uniforms.t!.value = t;
    this.sparksMat.uniforms.uGlobalAlpha!.value = uGlobalAlpha;
    this.sparksMat.uniforms.uSizeMultiplier!.value = 1.5;

    // -------------------------------------------------------------------------
    // 2. CINEMATIC 3D CAMERA TRAJECTORY (60.0s CONTINUUM)
    // -------------------------------------------------------------------------
    let camPos = new THREE.Vector3(0.42, 0.65, 2.7);
    let camTarget = new THREE.Vector3(0.06, 1.18, 0.1);
    let fov = 34.0;

    // Act I: The Flowing Manifold & Ingestion (0.0s - 12.0s)
    if (t < 4.0) {
      // Dynamic low-angle sweeping crane push framing the heroic 3/4 reaching silhouette
      const u = prog(t, 0.0, 4.0, ease.outCubic);
      camPos.set(
        lerp(0.68, 0.45, u),
        lerp(0.65, 1.15, u),
        lerp(2.8, 2.1, u)
      );
      camTarget.set(
        lerp(0.14, 0.06, u),
        lerp(1.18, 1.30, u),
        lerp(0.14, 0.08, u)
      );
      fov = 34.0;
    } else if (t < 8.5) {
      // Macro tracking toxic capsule & swirling fluid wake down esophageal conduit
      const u = prog(t, 4.0, 8.5, ease.inOutCubic);
      camPos.set(
        lerp(0.45, 0.32, u),
        lerp(1.15, 1.45, u),
        lerp(2.1, 1.25, u)
      );
      camTarget.set(0.02, lerp(1.58, 1.26, u), 0.04);
      fov = 30.0;
    } else if (t < 12.0) {
      // Lateral orbital swing tracking conscious neural shockwave down cervical spine
      const u = prog(t, 8.5, 12.0, ease.inOutCubic);
      camPos.set(
        lerp(0.32, -0.28, u),
        lerp(1.45, 1.45, u),
        lerp(1.25, 1.12, u)
      );
      camTarget.set(0.0, 1.40, 0.0);
      fov = 32.0;
    }

    // Act II: The Air-Gap Chasm (12.0s - 28.0s)
    else if (t < 18.0) {
      // Macro dive into Air-Gap precipice at cervical level (y = 1.40); impact at 14.2s
      const u = prog(t, 12.0, 18.0, ease.inOutCubic);
      camPos.set(
        lerp(-0.28, -0.22, u),
        lerp(1.45, 1.42, u),
        lerp(1.12, 0.95, u)
      );
      camTarget.set(0.0, 1.40, 0.0);
      fov = 30.0;

      // Dynamic recoil shudder on chasm impact
      if (dyn.chasmImpactFlare > 0.01) {
        camPos.y += 0.007 * Math.sin(t * 40.0) * dyn.chasmImpactFlare;
        camPos.x += 0.004 * Math.cos(t * 32.0) * dyn.chasmImpactFlare;
      }
    } else if (t < 28.0) {
      // Smooth sweeping pan across chasm to beating heart & laser cyan pacemaker
      const u = prog(t, 18.0, 28.0, ease.inOutCubic);
      camPos.set(
        lerp(-0.24, 0.24, u),
        lerp(1.26, 1.28, u),
        lerp(0.95, 1.05, u)
      );
      camTarget.set(
        lerp(0.0, -0.03, u),
        1.28,
        lerp(0.0, 0.04, u)
      );
      fov = 30.0;
    }

    // Act III: Somatic Arrival & Cellular Alarm (28.0s - 44.0s)
    else if (t < 44.0) {
      // Sweeping continuous 3D orbital banking flight around thoracic cavity
      const u = prog(t, 28.0, 44.0, ease.inOutCubic);
      const orbitAngle = lerp(0.22, -0.48, u); // Smooth orbital bank from right to left across chest
      const radius = lerp(1.08, 1.38, ease.inOutQuad(u));

      // Subtle tachycardic shockwave tremor on camera when heart panics
      const panicTremor = (t >= 34.0) ? (0.005 * Math.sin(t * 35.0) * prog(t, 34.0, 38.0, ease.outCubic)) : 0.0;

      camPos.set(
        Math.sin(orbitAngle) * radius,
        lerp(1.28, 1.38, u) + panicTremor,
        Math.cos(orbitAngle) * radius
      );
      camTarget.set(
        lerp(-0.02, 0.0, u),
        lerp(1.28, 1.34, u),
        lerp(0.04, 0.02, u)
      );
      fov = lerp(30.0, 32.0, u);
    }

    // Act IV: Monumental Cathedral Pullback & Celestial Ribbon Ascension (44.0s - 60.0s)
    else if (t < 54.0) {
      // Monumental crane pullback soaring through Gothic cathedral nave
      const u = prog(t, 44.0, 54.0, ease.inOutCubic);
      const startX = Math.sin(-0.48) * 1.38; // matches end of Act III
      const startZ = Math.cos(-0.48) * 1.38;
      camPos.set(
        lerp(startX, 0.15, u),
        lerp(1.38, 1.55, u),
        lerp(startZ, 3.60, u)
      );
      camTarget.set(
        0.0,
        lerp(1.34, 1.50, u),
        0.0
      );
      fov = lerp(32.0, 44.0, u);
    } else {
      // Celestial fluid ribbon dissolution: camera tilts up toward vault apex as stardust soars
      const u = prog(t, 54.0, 59.8, ease.outCubic);
      camPos.set(
        lerp(0.15, 0.05, u),
        lerp(1.55, 1.85, u),
        lerp(3.60, 4.20, u)
      );
      camTarget.set(
        0.0,
        lerp(1.50, 2.10, u),
        0.0
      );
      fov = lerp(44.0, 50.0, u);
    }

    this.camera3D.position.copy(camPos);
    this.camera3D.lookAt(camTarget);
    this.camera3D.fov = fov;
    this.camera3D.updateProjectionMatrix();

    // -------------------------------------------------------------------------
    // 3. RENDER 3D POINT CLOUD SCENE
    // -------------------------------------------------------------------------
    renderer.setRenderTarget(out);
    renderer.setClearColor(0x050506, 1.0);
    renderer.clear(true, true, true);
    renderer.render(this.scene3D, this.camera3D);

    // -------------------------------------------------------------------------
    // 4. DRAW 2D MINIMALIST SWISS HUD TELEMETRY
    // -------------------------------------------------------------------------
    this.hudLayer.clear();
    const c = this.hudLayer.ctx;
    this.drawHudTelemetry(c, t, dyn);
    c.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, this.hudLayer.upload(), out);

    // -------------------------------------------------------------------------
    // 5. POST-PROCESSING OVERRIDES (Optical Comfort & Bloom)
    // -------------------------------------------------------------------------
    const bloomImpact = dyn.chasmImpactFlare * 0.45;
    return {
      bloom: 0.55 + bloomImpact,
      bloomThreshold: 0.72,
      ca: 0.25 + 0.15 * dyn.chasmImpactFlare,
      vignette: 0.28,
      filmGrain: 0.035,
    };
  }

  /**
   * Minimalist Swiss Telemetry:
   * - Top-left: System state / Act marker
   * - Bottom-left: Biological latency & hardware status
   * - Bottom-right: Procedural point count & heart rate readout
   */
  private drawHudTelemetry(
    c: CanvasRenderingContext2D,
    t: number,
    dyn: { heartRateHz: number; chasmImpactFlare: number }
  ): void {
    c.save();

    const bpm = Math.round(dyn.heartRateHz * 60);

    // Top-Left: System Phase
    c.textAlign = 'left';
    c.font = font(F.mono(500), 13);
    c.fillStyle = rgba('ash', 0.85);
    c.letterSpacing = '0.14em';
    c.shadowColor = '#050506';
    c.shadowBlur = 8;

    let phaseLabel = 'ACT I // CONSCIOUS_INPUT [TOXIN_INGESTION]';
    if (t >= 44.0) {
      phaseLabel = 'ACT IV // MONUMENTAL_FORK [CELESTIAL_ASCENSION]';
    } else if (t >= 28.0) {
      phaseLabel = 'ACT III // SOMATIC_RECEPTOR_BIND [ALARM_CASCADE]';
    } else if (t >= 12.0) {
      phaseLabel = 'ACT II // HARDWARE_AIR_GAP [UNCONNECTED_CHASM]';
    }
    c.fillText(phaseLabel, 96, 80);

    // Bottom-Left: Biological Hardware Latency
    c.font = font(F.mono(400), 12);
    c.fillStyle = rgba('ash', 0.75);
    let latencyText = 'LATENCY: 0.00s // CONSCIOUS_RECOGNITION: INSTANT';
    if (t >= 34.0) {
      latencyText = 'LATENCY: 14.20s // RECEPTOR_TRIP: SOMATIC_PANIC';
    } else if (t >= 14.2) {
      latencyText = 'LATENCY: 6.20s // AIR_GAP: NO_CONSCIOUS_ACCESS';
    }
    c.fillText(latencyText, 96, H - 70);

    // Bottom-Right: Heart Rate & Point Count Readout
    c.textAlign = 'right';
    c.font = font(F.mono(500), 14);
    c.fillStyle = (bpm > 100) ? rgba('signal', 0.90) : rgba('ash', 0.85);
    c.fillText(`CARDIAC: ${bpm} BPM`, W - 96, H - 90);

    c.font = font(F.mono(400), 12);
    c.fillStyle = rgba('ash', 0.65);
    c.fillText(`LIDAR_PTS: 254,000  //  O(1) CLOSED-FORM`, W - 96, H - 70);

    c.restore();
  }
}

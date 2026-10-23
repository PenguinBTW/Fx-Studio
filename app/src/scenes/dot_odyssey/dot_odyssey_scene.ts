// =============================================================================
// MASTER PROCEDURAL SCENE: "CHROMA: THE DOT ODYSSEY"
//
// Continuous 180.0-Second (3-Minute) Point-Cloud Tour-de-Force
//
// 7 Seamless Movements:
//   Movement 1 (0.0s - 26.0s):   Celestial Chinese Dragon & Flaming Pearl
//   Movement 2 (26.0s - 52.0s):  Bioluminescent Ocean & Manta Leviathan
//   Movement 3 (52.0s - 78.0s):  Synchronized Drone Metamorphosis Symphony
//   Movement 4 (78.0s - 104.0s): Cyberpunk Megacity & LiDAR Matrix
//   Movement 5 (104.0s - 130.0s): Kerr Black Hole & Relativistic Plasma Jets
//   Movement 6 (130.0s - 156.0s): Sacred 4D Tesseract & Metatron's Matrix
//   Movement 7 (156.0s - 180.0s): Big Bang Detonation & Twin-Arm Spiral Galaxy
//
// Invariants:
// - 100% procedural, strictly closed-form O(1): Frame = f(t)
// - Zero imported 3D models or textures
// - Custom GPU circular Gaussian splatting (zero square pixels)
// - Up to 120,000 simultaneous active points per subsystem
// - Hard clean cut to pure black at exactly 180.0s
// =============================================================================

import * as THREE from 'three';
import { Scene, Frame, PostOverrides } from '../../engine/scene';
import { W, H, Layer2D } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { rgba } from '../../engine/palette';
import { clamp, ease, lerp, prog } from '../../engine/util';

import { createDotOdysseyMaterial } from './dot_shader';
import { DotDragon } from './dot_dragon';
import { DotOcean } from './dot_ocean';
import { DotDroneShow } from './dot_drone_show';
import { DotCity } from './dot_city';
import { DotCosmos } from './dot_cosmos';
import { HEX } from './dot_palette';

export default class DotOdysseyScene extends Scene {
  private scene3D!: THREE.Scene;
  private camera3D!: THREE.PerspectiveCamera;

  // Subsystem Engines
  private dragon!: DotDragon;
  private ocean!: DotOcean;
  private droneShow!: DotDroneShow;
  private city!: DotCity;
  private cosmos!: DotCosmos;

  // GPU Meshes
  private dragonMesh!: THREE.Points;
  private oceanMesh!: THREE.Points;
  private droneMesh!: THREE.Points;
  private cityMesh!: THREE.Points;
  private cosmosMesh!: THREE.Points;

  // Custom Shader Materials
  private dragonMat!: THREE.ShaderMaterial;
  private oceanMat!: THREE.ShaderMaterial;
  private droneMat!: THREE.ShaderMaterial;
  private cityMat!: THREE.ShaderMaterial;
  private cosmosMat!: THREE.ShaderMaterial;

  // 2D Swiss Minimalist HUD Telemetry
  private hudLayer!: Layer2D;

  override async init(): Promise<void> {
    this.scene3D = new THREE.Scene();
    this.camera3D = new THREE.PerspectiveCamera(38, W / H, 0.02, 60.0);

    // 1. Create GPU Shader Materials
    this.dragonMat = createDotOdysseyMaterial();
    this.oceanMat = createDotOdysseyMaterial();
    this.droneMat = createDotOdysseyMaterial();
    this.cityMat = createDotOdysseyMaterial();
    this.cosmosMat = createDotOdysseyMaterial();

    // 2. Instantiate Subsystems
    this.dragon = new DotDragon();
    this.ocean = new DotOcean();
    this.droneShow = new DotDroneShow();
    this.city = new DotCity();
    this.cosmos = new DotCosmos();

    // 3. Assemble Meshes
    this.dragonMesh = new THREE.Points(this.dragon.geometry, this.dragonMat);
    this.oceanMesh = new THREE.Points(this.ocean.geometry, this.oceanMat);
    this.droneMesh = new THREE.Points(this.droneShow.geometry, this.droneMat);
    this.cityMesh = new THREE.Points(this.city.geometry, this.cityMat);
    this.cosmosMesh = new THREE.Points(this.cosmos.geometry, this.cosmosMat);

    this.scene3D.add(this.dragonMesh);
    this.scene3D.add(this.oceanMesh);
    this.scene3D.add(this.droneMesh);
    this.scene3D.add(this.cityMesh);
    this.scene3D.add(this.cosmosMesh);

    // 4. Initialize Swiss Telemetry
    this.hudLayer = new Layer2D();
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer, comp } = this.ctx;

    // Hard clean cut to pure black at exactly 180.0s
    if (t >= 180.0) {
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
    // 1. SUBSYSTEM VISIBILITY & KINEMATICS UPDATES
    // -------------------------------------------------------------------------
    const showDragon = (t < 28.0);
    const showOcean = (t >= 24.0 && t < 54.0);
    const showDrone = (t >= 50.0 && t < 80.0);
    const showCity = (t >= 76.0 && t < 106.0);
    const showCosmos = (t >= 102.0);

    this.dragonMesh.visible = showDragon;
    this.oceanMesh.visible = showOcean;
    this.droneMesh.visible = showDrone;
    this.cityMesh.visible = showCity;
    this.cosmosMesh.visible = showCosmos;

    // Global fade-out over last 1.5 seconds
    const uGlobalAlpha = clamp(1.0 - prog(t, 178.5, 180.0, ease.linear));

    if (showDragon) {
      this.dragon.update(t);
      const alpha = (t < 22.0) ? 1.0 : clamp(1.0 - prog(t, 22.0, 26.5, ease.outCubic));
      this.dragonMat.uniforms.t!.value = t;
      this.dragonMat.uniforms.uGlobalAlpha!.value = alpha * uGlobalAlpha;
      this.dragonMat.uniforms.uSizeMultiplier!.value = 1.0;
      this.dragonMat.uniforms.uTurbulence!.value = (t > 22.0) ? 3.0 : 1.0;
    }

    if (showOcean) {
      this.ocean.update(t);
      const alphaIn = prog(t, 24.0, 26.5, ease.inOutCubic);
      const alphaOut = (t < 48.0) ? 1.0 : clamp(1.0 - prog(t, 48.0, 52.5, ease.inOutCubic));
      this.oceanMat.uniforms.t!.value = t;
      this.oceanMat.uniforms.uGlobalAlpha!.value = alphaIn * alphaOut * uGlobalAlpha;
      this.oceanMat.uniforms.uSizeMultiplier!.value = 1.05;
      this.oceanMat.uniforms.uTurbulence!.value = 0.8;
    }

    if (showDrone) {
      this.droneShow.update(t);
      const alphaIn = prog(t, 50.0, 52.5, ease.inOutCubic);
      const alphaOut = (t < 76.0) ? 1.0 : clamp(1.0 - prog(t, 76.0, 78.5, ease.inOutCubic));
      const warpSpeed = (t >= 76.0 && t <= 78.0) ? prog(t, 76.0, 78.0, ease.inQuad) : 0.0;
      this.droneMat.uniforms.t!.value = t;
      this.droneMat.uniforms.uGlobalAlpha!.value = alphaIn * alphaOut * uGlobalAlpha;
      this.droneMat.uniforms.uSizeMultiplier!.value = 1.15;
      this.droneMat.uniforms.uWarpSpeed!.value = warpSpeed;
      this.droneMat.uniforms.uTurbulence!.value = (warpSpeed > 0) ? 2.5 : 0.5;
    }

    if (showCity) {
      this.city.update(t);
      const alphaIn = prog(t, 76.0, 78.5, ease.inOutCubic);
      const alphaOut = (t < 100.0) ? 1.0 : clamp(1.0 - prog(t, 100.0, 104.5, ease.inOutCubic));
      this.cityMat.uniforms.t!.value = t;
      this.cityMat.uniforms.uGlobalAlpha!.value = alphaIn * alphaOut * uGlobalAlpha;
      this.cityMat.uniforms.uSizeMultiplier!.value = 1.0;
      this.cityMat.uniforms.uTurbulence!.value = 0.6;
    }

    if (showCosmos) {
      this.cosmos.update(t);
      const alphaIn = prog(t, 102.0, 104.5, ease.inOutCubic);
      this.cosmosMat.uniforms.t!.value = t;
      this.cosmosMat.uniforms.uGlobalAlpha!.value = alphaIn * uGlobalAlpha;
      this.cosmosMat.uniforms.uSizeMultiplier!.value = (t >= 156.0 && t <= 158.0) ? 1.5 : 1.1;
      this.cosmosMat.uniforms.uTurbulence!.value = (t >= 156.0 && t <= 160.0) ? 2.0 : 0.8;
    }

    // -------------------------------------------------------------------------
    // 2. CINEMATIC 3D CAMERA TRAJECTORY (180.0s CONTINUOUS C1 FLIGHT)
    // -------------------------------------------------------------------------
    const camPos = new THREE.Vector3(0, 2.0, 6.0);
    const camTarget = new THREE.Vector3(0, 1.0, 0);
    let fov = 38.0;

    // -------------------------------------------------------------------------
    // MOVEMENT 1: CELESTIAL DRAGON & FLAMING PEARL (0.0s - 26.0s)
    // -------------------------------------------------------------------------
    if (t < 8.0) {
      // Dynamic wide tracking shot following the dragon's sinuous flight through mountain mist
      const u = prog(t, 0.0, 8.0, ease.inOutCubic);
      const head = this.dragon.headPos;
      const pearl = this.dragon.pearlPos;
      camPos.set(
        head.x + lerp(3.2, 2.0, u),
        head.y + lerp(2.2, 1.4, u),
        head.z + lerp(5.8, 4.2, u)
      );
      camTarget.set(
        lerp(head.x, pearl.x, 0.4),
        lerp(head.y, pearl.y, 0.4),
        lerp(head.z, pearl.z, 0.4)
      );
      fov = 38.0;
    } else if (t < 16.0) {
      // Intimate banking shot flying alongside the dragon's undulating jade scales and snout
      const u = prog(t, 8.0, 16.0, ease.inOutCubic);
      const head = this.dragon.headPos;
      const pearl = this.dragon.pearlPos;
      camPos.set(
        head.x + lerp(2.0, -2.4, u),
        head.y + lerp(1.4, 0.9, u),
        head.z + lerp(4.2, 3.2, u)
      );
      camTarget.set(
        lerp(head.x, pearl.x, 0.6),
        lerp(head.y, pearl.y, 0.6),
        lerp(head.z, pearl.z, 0.6)
      );
      fov = 36.0;
    } else if (t < 22.0) {
      // Macro orbit around the flaming pearl darting ahead of the dragon snout
      const angle = t * 1.2;
      const pearl = this.dragon.pearlPos;
      camPos.set(
        pearl.x + 2.0 * Math.cos(angle),
        pearl.y + 0.4 + 0.25 * Math.sin(t * 2.0),
        pearl.z + 2.0 * Math.sin(angle)
      );
      camTarget.copy(pearl);
      fov = 32.0;
    } else if (t < 26.0) {
      // Supernova dissolution: dramatic pullback as particles explode
      const u = prog(t, 22.0, 26.0, ease.outCubic);
      const head = this.dragon.headPos;
      camPos.set(
        head.x,
        head.y + lerp(0.4, 1.2, u),
        head.z + lerp(2.0, 8.2, u)
      );
      camTarget.copy(head);
      fov = lerp(32.0, 46.0, u);
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 2: BIOLUMINESCENT OCEAN & MANTA LEVIATHAN (26.0s - 52.0s)
    // -------------------------------------------------------------------------
    else if (t < 34.0) {
      // Skimming down across glowing Gerstner wave crests toward the surfacing manta
      const u = prog(t, 26.0, 34.0, ease.inOutCubic);
      camPos.set(
        lerp(2.5, 1.2, u),
        lerp(3.8, 1.4, u),
        lerp(6.5, 4.2, u)
      );
      camTarget.set(0.0, lerp(-0.2, -0.4, u), lerp(1.5, 0.2, u));
      fov = 38.0;
    } else if (t < 42.0) {
      // Diving underwater, banking beneath the 6m giant Manta Leviathan as it flaps
      const u = prog(t, 34.0, 42.0, ease.inOutCubic);
      camPos.set(
        lerp(1.2, -1.4, u),
        lerp(1.4, -1.2, u),
        lerp(4.2, 3.2, u)
      );
      camTarget.copy(this.ocean.mantaPos);
      fov = 36.0;
    } else if (t < 48.0) {
      // Gliding through deep-sea pulsing jellyfish blooms and bait-ball vortex
      const u = prog(t, 42.0, 48.0, ease.inOutCubic);
      camPos.set(
        lerp(-1.4, 0.8, u),
        lerp(-1.2, -0.6, u),
        lerp(3.2, 3.8, u)
      );
      camTarget.set(0.0, -0.8, 0.0);
      fov = 38.0;
    } else if (t < 52.0) {
      // Sucked down into the cosmic maelstrom whirlpool funnel
      const u = prog(t, 48.0, 52.0, ease.inQuad);
      const spinAngle = t * 2.5;
      const r = lerp(3.8, 1.2, u);
      camPos.set(
        r * Math.cos(spinAngle),
        lerp(-0.6, -2.8, u),
        r * Math.sin(spinAngle)
      );
      camTarget.set(0.0, -2.5, 0.0);
      fov = lerp(38.0, 48.0, u);
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 3: SYNCHRONIZED DRONE SHOW METAMORPHOSIS (52.0s - 78.0s)
    // -------------------------------------------------------------------------
    else if (t < 61.0) {
      // Formation 1: High orbital view tracking the rotating 3D Earth globe and satellite rings
      const u = prog(t, 52.0, 61.0, ease.inOutCubic);
      const angle = t * 0.40;
      camPos.set(
        7.6 * Math.cos(angle),
        lerp(2.8, 1.6, u),
        7.6 * Math.sin(angle)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = 38.0;
    } else if (t < 70.0) {
      // Formation 2: Fast swoop framing the anatomical beating heart and ventricular chambers
      const u = prog(t, 61.0, 70.0, ease.inOutCubic);
      camPos.set(
        lerp(6.8, 5.2, u),
        lerp(2.2, 1.4, u),
        lerp(6.2, 5.0, u)
      );
      camTarget.set(0.0, 0.1, 0.0);
      fov = 36.0;
    } else if (t < 76.0) {
      // Formation 3: High majestic aerial view framing soaring phoenix wings, head, and trailing tail
      const u = prog(t, 70.0, 76.0, ease.inOutCubic);
      camPos.set(
        lerp(3.2, -2.8, u),
        lerp(6.8, 6.2, u),
        lerp(4.5, 3.8, u)
      );
      camTarget.set(0.0, 0.0, -0.8);
      fov = 40.0;
    } else if (t < 78.0) {
      // Relativistic warp speed streak punch-through
      const u = prog(t, 76.0, 78.0, ease.inQuad);
      camPos.set(
        0.0,
        lerp(3.2, 0.0, u),
        lerp(5.0, 0.5, u)
      );
      camTarget.set(0.0, 0.0, -12.0);
      fov = lerp(38.0, 75.0, u);
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 4: CYBERPUNK MEGACITY & LIDAR MATRIX (78.0s - 104.0s)
    // -------------------------------------------------------------------------
    else if (t < 88.0) {
      // High-speed canyon dive between 80+ glowing neon skyscrapers framing lotus ahead
      const u = prog(t, 78.0, 88.0, ease.inOutCubic);
      camPos.set(
        lerp(0.2, -0.3, u),
        lerp(5.8, 2.6, u),
        lerp(12.0, 4.8, u)
      );
      camTarget.set(0.0, 3.0, 0.0);
      fov = 42.0;
    } else if (t < 96.0) {
      // Flying along the avenue toward the plaza beneath skybridges
      const u = prog(t, 88.0, 96.0, ease.inOutCubic);
      camPos.set(
        lerp(-0.3, 0.0, u),
        lerp(2.4, 3.2, u),
        lerp(-1.5, 4.8, u)
      );
      camTarget.set(0.0, 3.2, 0.0);
      fov = 38.0;
    } else if (t < 100.0) {
      // Orbiting the giant holographic lotus mandala floating between towers
      const u = prog(t, 96.0, 100.0, ease.inOutCubic);
      const angle = t * 0.85;
      camPos.set(
        4.8 * Math.cos(angle),
        3.8 + 0.4 * Math.sin(t * 1.5),
        4.8 * Math.sin(angle)
      );
      camTarget.set(0.0, 3.2, 0.0);
      fov = 36.0;
    } else if (t < 104.0) {
      // EMP blackout and zero-g particle levitation
      const u = prog(t, 100.0, 104.0, ease.outCubic);
      camPos.set(
        lerp(4.8, 0.0, u),
        lerp(3.8, 5.8, u),
        lerp(4.8, 7.5, u)
      );
      camTarget.set(0.0, 3.2, 0.0);
      fov = lerp(36.0, 48.0, u);
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 5: KERR BLACK HOLE & PLASMA JETS (104.0s - 130.0s)
    // -------------------------------------------------------------------------
    else if (t < 116.0) {
      // Approaching event horizon: dive toward Doppler-boosted accretion disk
      const u = prog(t, 104.0, 116.0, ease.inOutCubic);
      camPos.set(
        lerp(4.5, 2.4, u),
        lerp(3.2, 1.1, u),
        lerp(5.5, 3.2, u)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = 38.0;
    } else if (t < 124.0) {
      // Orbiting through the photon ring and gravitational lens Einstein rings
      const u = prog(t, 116.0, 124.0, ease.inOutCubic);
      const angle = t * 0.6;
      camPos.set(
        3.0 * Math.cos(angle),
        0.8 + 0.4 * Math.sin(t * 1.2),
        3.0 * Math.sin(angle)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = 36.0;
    } else if (t < 130.0) {
      // Flying upward through the vertical relativistic plasma jet
      const u = prog(t, 124.0, 130.0, ease.inOutCubic);
      camPos.set(
        lerp(1.8, 0.3, u),
        lerp(0.8, 4.2, u),
        lerp(2.2, 1.2, u)
      );
      camTarget.set(0.0, lerp(0.0, 3.8, u), 0.0);
      fov = 36.0;
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 6: SACRED 4D TESSERACT & METATRON'S MATRIX (130.0s - 156.0s)
    // -------------------------------------------------------------------------
    else if (t < 144.0) {
      // Floating inside the hyperdimensional 4D tesseract as it inverts inside-out
      const u = prog(t, 130.0, 144.0, ease.inOutCubic);
      const angle = t * 0.4;
      camPos.set(
        3.2 * Math.cos(angle),
        lerp(1.5, 0.4, u),
        3.2 * Math.sin(angle)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = 38.0;
    } else if (t < 156.0) {
      // Rotating through Metatron's sacred geometric matrix as it collapses toward the singularity point
      const u = prog(t, 144.0, 156.0, ease.inOutCubic);
      const angle = t * 0.55;
      const r = lerp(3.2, 1.6, u);
      camPos.set(
        r * Math.cos(angle),
        lerp(0.4, 0.1, u),
        r * Math.sin(angle)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = lerp(38.0, 32.0, u);
    }

    // -------------------------------------------------------------------------
    // MOVEMENT 7: BIG BANG & TWIN-ARM SPIRAL GALAXY (156.0s - 180.0s)
    // -------------------------------------------------------------------------
    else if (t < 162.0) {
      // Big Bang explosive detonation: rapid backward camera surge
      const u = prog(t, 156.0, 162.0, ease.outCubic);
      camPos.set(
        0.0,
        lerp(0.5, 3.2, u),
        lerp(1.6, 6.5, u)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = lerp(48.0, 40.0, u);
    } else if (t < 174.0) {
      // Majestic ascending crane orbit over the 100,000-point twin-arm spiral galaxy
      const u = prog(t, 162.0, 174.0, ease.inOutCubic);
      const angle = t * 0.25;
      camPos.set(
        5.2 * Math.cos(angle),
        lerp(3.2, 4.8, u),
        5.2 * Math.sin(angle)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = 38.0;
    } else {
      // Deep space pullback, fading to pure black at exactly 180.0s
      const u = prog(t, 174.0, 180.0, ease.inOutCubic);
      camPos.set(
        lerp(5.2, 7.5, u),
        lerp(4.8, 6.8, u),
        lerp(5.2, 7.5, u)
      );
      camTarget.set(0.0, 0.0, 0.0);
      fov = lerp(38.0, 34.0, u);
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
    this.drawHudTelemetry(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    comp.draw(renderer, this.hudLayer.upload(), out);

    // -------------------------------------------------------------------------
    // 5. POST-PROCESSING OVERRIDES (Optical Comfort & Dynamic Bloom)
    // -------------------------------------------------------------------------
    let bloom = 0.55;
    let bloomThresh = 0.70;
    let ca = 0.22;

    // Movement-specific bloom flares
    if (t >= 22.0 && t <= 25.5) {
      // Dragon supernova flare
      const flare = Math.sin(prog(t, 22.0, 25.5, ease.linear) * Math.PI);
      bloom += flare * 0.45;
      ca += flare * 0.25;
    } else if (t >= 76.0 && t <= 78.5) {
      // Drone warp punch flare
      const flare = Math.sin(prog(t, 76.0, 78.5, ease.linear) * Math.PI);
      bloom += flare * 0.50;
      ca += flare * 0.35;
    } else if (t >= 156.0 && t <= 159.0) {
      // Big Bang detonation shockwave
      const flare = Math.sin(prog(t, 156.0, 159.0, ease.linear) * Math.PI);
      bloom += flare * 0.65;
      ca += flare * 0.40;
    }

    return {
      bloom,
      bloomThreshold: bloomThresh,
      ca,
      vignette: 0.26,
      filmGrain: 0.032,
    };
  }

  /**
   * Minimalist Swiss Telemetry:
   * - Top-left: Movement title, subsystem code, and timecode
   * - Bottom-left: Real-time mathematical and physical parameters
   * - Bottom-right: Procedural point count & deterministic O(1) certification
   */
  private drawHudTelemetry(c: CanvasRenderingContext2D, t: number): void {
    c.save();

    // Top-Left: Movement & Sequence Header
    c.textAlign = 'left';
    c.font = font(F.mono(500), 13);
    c.fillStyle = rgba('ash', 0.88);
    c.letterSpacing = '0.14em';
    c.shadowColor = '#050506';
    c.shadowBlur = 8;

    let movementTitle = 'MVT 01 // CELESTIAL_DRAGON [HELICAL_SPINE]';
    let metricLeft = 'SPINE_CURVATURE: 1.48 // FLAMING_PEARL: TRACKING';
    let pointCount = '95,000 PTS';

    if (t >= 156.0) {
      movementTitle = 'MVT 07 // BIG_BANG_&_SPIRAL_GALAXY [TWIN_ARM_LOG]';
      metricLeft = 'ROTATION_CURVE: FLAT // ARMS: 2 // CORE_DENSITY: 1.84e9';
      pointCount = '120,000 PTS';
    } else if (t >= 130.0) {
      movementTitle = 'MVT 06 // SACRED_4D_TESSERACT [METATRON_MATRIX]';
      metricLeft = 'DIMENSION: 4D // ISOMORPHISM: SO(4) // ROTATION_ZW: 1.25 rad/s';
      pointCount = '120,000 PTS';
    } else if (t >= 104.0) {
      movementTitle = 'MVT 05 // KERR_BLACK_HOLE [GRAVITATIONAL_LENS]';
      metricLeft = 'SPIN_PARAM_a: 0.98c // DOPPLER_FACTOR: 2.14 // PHOTON_RING';
      pointCount = '120,000 PTS';
    } else if (t >= 78.0) {
      movementTitle = 'MVT 04 // CYBERPUNK_MEGACITY [LIDAR_SKYLINES]';
      metricLeft = 'TOWERS: 84 // SKYWAYS: 3_TIER // LOTUS_MANDALA: ACTIVE';
      pointCount = '98,000 PTS';
    } else if (t >= 52.0) {
      movementTitle = 'MVT 03 // DRONE_METAMORPHOSIS [COORDINATED_FLEET]';
      const form = (t < 61.0) ? 'EARTH_SPHERE' : (t < 70.0) ? 'ANATOMICAL_HEART' : 'FIRE_PHOENIX';
      metricLeft = `FORMATION: ${form} // SYNC_HERTZ: 60Hz`;
      pointCount = '75,000 PTS';
    } else if (t >= 26.0) {
      movementTitle = 'MVT 02 // BIOLUMINESCENT_OCEAN [GERSTNER_SURFACE]';
      metricLeft = 'GERSTNER_HARMONICS: 4 // MANTA_WINGSPAN: 6.2m // MAELSTROM';
      pointCount = '90,000 PTS';
    }

    // Render Movement Header
    c.fillText(movementTitle, 96, 80);

    // Render Timecode
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    const tc = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    c.font = font(F.mono(400), 12);
    c.fillStyle = rgba('ash', 0.65);
    c.fillText(`TC: ${tc} / 03:00.00 // 60 FPS`, 96, 102);

    // Bottom-Left: Real-time Mathematical Telemetry
    c.fillText(metricLeft, 96, H - 70);

    // Bottom-Right: Point Count & O(1) Guarantee
    c.textAlign = 'right';
    c.font = font(F.mono(500), 14);
    c.fillStyle = rgba('bone', 0.90);
    c.fillText(`CHROMA: ${pointCount}`, W - 96, H - 90);

    c.font = font(F.mono(400), 12);
    c.fillStyle = rgba('ash', 0.65);
    c.fillText(`PROCEDURAL POINT CLOUD // O(1) CLOSED-FORM`, W - 96, H - 70);

    c.restore();
  }
}

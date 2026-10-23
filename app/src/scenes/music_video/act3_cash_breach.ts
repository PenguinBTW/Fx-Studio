// ACT III: THE BANK VAULT BREACH & CASH VORTEX (33.05s - 50.96s, Nominal Cut 50.46s)
// Song: 'No Takebacks' - Forrest Nolan (BPM: 129.20, Bar 19.0 - 28.0)
//
// Lines 8 - 15:
// - Line 8:  "Oh, just grab the cash, and no takebacks" (33.55s - 37.25s)
// - Line 9:  "Unless you do it with me" (37.25s - 39.12s)
// - Line 10: "If you break the bank, I'll hold your hand" (39.12s - 42.84s)
// - Line 11: "Long as you hold onto me" (42.84s - 44.70s)
// - Line 12: "Oh, take the wheel, I'll navigate" (44.70s - 46.20s)
// - Line 13: "Hear the sirens in the distance, high-speed chase" (46.20s - 47.80s)
// - Line 14: "Oh, just cross your heart, oh, no takebacks" (47.80s - 49.30s)
// - Line 15: "Unless you do it with me" (49.30s - 50.46s)
//
// Transition Contracts:
// - Entry Contract T2 (33.55s, Bar 19.0):
//     Pos: [0.0, 0.8, 2.4], Target: [0.0, 0.5, 0.0], Vel: [0.0, -0.4, -22.0], FOV: 50.0
//     Aperture Anchor: 'speedometer_shatter_vortex'
// - Exit Contract T3 (50.46s, Bar 28.0):
//     Pos: [0.15, 0.35, 0.95], Target: [0.0, 0.3, 0.0], Vel: [0.0, 0.2, -4.5], FOV: 42.0
//     Aperture Anchor: 'forearm_tilt_to_rearview_dice'

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease, lerp, smoothstep } from '../../engine/util';
import { createVehicleModel, type VehicleModelRig } from './shared/vehicle_model';

interface BanknoteData {
  mesh: THREE.Mesh;
  phi0: number;
  radiusBase: number;
  speedZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
}

interface GoldBarData {
  mesh: THREE.Mesh;
  seed: number;
  basePos: THREE.Vector3;
  rotAxis: THREE.Vector3;
  rotSpeed: number;
}

interface ShardData {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
}

export default class Act3CashBreach extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // Scene Rigs & Groups
  private vehicleRig: VehicleModelRig;
  private vaultGroup = new THREE.Group();
  private vaultSlabs: THREE.Mesh[] = [];
  private vaultHub = new THREE.Group();
  private currencyVortexGroup = new THREE.Group();
  private banknotes: BanknoteData[] = [];
  private goldBars: GoldBarData[] = [];
  private glassShardsGroup = new THREE.Group();
  private glassShards: ShardData[] = [];
  private claspedHandsGroup = new THREE.Group();
  private navFingersGroup = new THREE.Group();
  private tunnelGroup = new THREE.Group();
  private overheadLights: THREE.Mesh[] = [];
  private policeCruisersGroup = new THREE.Group();

  // Dynamic Lighting
  private ambientLight: THREE.AmbientLight;
  private vaultBurstLight: THREE.PointLight;
  private consoleRimLight: THREE.PointLight;
  private sirenRedLight: THREE.PointLight;
  private sirenBlueLight: THREE.PointLight;
  private cockpitSirenLight: THREE.PointLight;

  // Reusable vectors for camera evaluation
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();

  // Textures to clean up
  private banknoteTexture: THREE.CanvasTexture;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 300);
    this.layer2d = new Layer2D(W, H);

    // Deep vault void background
    this.threeScene.background = new THREE.Color(COLOR_TOKENS.VAULT_STEEL_DARK);
    this.threeScene.fog = new THREE.FogExp2(0x0a0c10, 0.015);

    // -------------------------------------------------------------
    // 1. Lighting System
    // -------------------------------------------------------------
    this.ambientLight = new THREE.AmbientLight(0x181c24, 0.9);
    this.threeScene.add(this.ambientLight);

    // Vault breach explosive back-light - restrained exposure so center frame never clips
    this.vaultBurstLight = new THREE.PointLight(0xfff7ed, 1.8, 40);
    this.vaultBurstLight.position.set(0, 1.2, -6.5);
    this.threeScene.add(this.vaultBurstLight);

    // Warm organic rim light on console for clasped hands - balanced exposure
    this.consoleRimLight = new THREE.PointLight(0xff7542, 0.95, 1.8);
    this.consoleRimLight.position.set(-0.18, 0.44, -0.16);
    this.threeScene.add(this.consoleRimLight);

    // Distant police siren strobes outside the windshield
    this.sirenRedLight = new THREE.PointLight(0xef4444, 0.0, 40);
    this.sirenRedLight.position.set(2.2, 1.6, -18.0);
    this.threeScene.add(this.sirenRedLight);

    this.sirenBlueLight = new THREE.PointLight(0x00e5ff, 0.0, 40);
    this.sirenBlueLight.position.set(-2.2, 1.6, -18.0);
    this.threeScene.add(this.sirenBlueLight);

    // Cockpit internal siren reflection
    this.cockpitSirenLight = new THREE.PointLight(0xef4444, 0.0, 2.5);
    this.cockpitSirenLight.position.set(0, 0.75, -0.35);
    this.threeScene.add(this.cockpitSirenLight);

    // Directional headlight / key fill
    const dirKey = new THREE.DirectionalLight(0xe2e8f0, 1.2);
    dirKey.position.set(5, 10, 8);
    this.threeScene.add(dirKey);

    // -------------------------------------------------------------
    // 2. Vehicle Rig (1930s Boattail Speedster)
    // -------------------------------------------------------------
    this.vehicleRig = createVehicleModel();
    this.vehicleRig.showFullExterior();
    this.vehicleRig.setVisibility({ seats: false });
    this.threeScene.add(this.vehicleRig.root);

    // -------------------------------------------------------------
    // 3. Bank Vault Breach Blast Door Rig
    // -------------------------------------------------------------
    this.setupVaultBlastDoor();

    // -------------------------------------------------------------
    // 4. Currency Tempest: Banknotes & Gold Bullion Bars
    // -------------------------------------------------------------
    this.banknoteTexture = this.generateBanknoteTexture();
    this.setupCurrencyTempest();

    // -------------------------------------------------------------
    // 5. Speedometer Voronoi Glass Shards (Contract T2)
    // -------------------------------------------------------------
    this.setupGlassShards();

    // -------------------------------------------------------------
    // 6. The Clasped Hands on the Steering Wheel
    // -------------------------------------------------------------
    this.setupClaspedHands();

    // -------------------------------------------------------------
    // 7. Getaway Tunnel & Police Pursuers
    // -------------------------------------------------------------
    this.setupTunnelAndPursuit();
  }

  // =============================================================
  // PROCEDURAL ASSET INITIALIZATION
  // =============================================================

  private generateBanknoteTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 224;
    const ctx = canvas.getContext('2d')!;

    // Pale mint currency paper base
    ctx.fillStyle = '#d1fae5';
    ctx.fillRect(0, 0, 512, 224);

    // Outer geometric border
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 212);

    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 484, 196);
    ctx.strokeRect(18, 18, 476, 188);

    // Four corner numerals
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('100', 40, 38);
    ctx.fillText('100', 472, 38);
    ctx.fillText('100', 40, 186);
    ctx.fillText('100', 472, 186);

    // Header and titles
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('FEDERAL RESERVE NOTE', 256, 34);
    ctx.font = '11px sans-serif';
    ctx.fillText('THE UNITED STATES OF AMERICA', 256, 50);

    // Oval medallion portrait frame
    ctx.beginPath();
    ctx.ellipse(256, 112, 68, 50, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Silhouette inside oval
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(256, 102, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 140, 36, 20, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    // Green treasury seal
    ctx.beginPath();
    ctx.arc(145, 112, 22, 0, Math.PI * 2);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bottom denomination banner
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#064e3b';
    ctx.fillText('ONE HUNDRED DOLLARS', 256, 190);

    // Serial numbers
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#047857';
    ctx.textAlign = 'left';
    ctx.fillText('NT 12920268 B', 64, 68);
    ctx.fillText('NT 12920268 B', 338, 156);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  private setupVaultBlastDoor() {
    this.vaultGroup.position.set(0, 0.48, -4.5);
    this.threeScene.add(this.vaultGroup);

    // Heavy circular portal casing
    const frameGeo = new THREE.TorusGeometry(2.35, 0.28, 16, 36);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.4,
      metalness: 0.85,
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    this.vaultGroup.add(frameMesh);

    // 16 Perimeter locking bolts
    const boltGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.22, 16);
    boltGeo.rotateX(Math.PI / 2);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.15,
      metalness: 0.95,
    });
    for (let b = 0; b < 16; b++) {
      const angle = (b * Math.PI * 2) / 16;
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos(angle) * 2.35, Math.sin(angle) * 2.35, 0.05);
      this.vaultGroup.add(bolt);
    }

    // 8 Radial wedge blast door slabs
    const slabCount = 8;
    const slabThickness = 0.26;
    const innerRadius = 0.45;
    const outerRadius = 2.25;
    const wedgeAngle = (Math.PI * 2) / slabCount;

    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x14181f,
      roughness: 0.35,
      metalness: 0.9,
    });

    for (let i = 0; i < slabCount; i++) {
      const a0 = i * wedgeAngle + 0.02;
      const a1 = (i + 1) * wedgeAngle - 0.02;

      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerRadius, a0, a1, false);
      shape.lineTo(Math.cos(a1) * innerRadius, Math.sin(a1) * innerRadius);
      shape.absarc(0, 0, innerRadius, a1, a0, true);
      shape.closePath();

      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: slabThickness,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.025,
        bevelThickness: 0.025,
      });

      const slabMesh = new THREE.Mesh(geom, slabMat);
      slabMesh.position.set(0, 0, -slabThickness / 2);

      // Heavy chrome latch bar on each slab
      const latchGeo = new THREE.BoxGeometry(0.7, 0.08, 0.08);
      const latch = new THREE.Mesh(latchGeo, boltMat);
      const midAngle = (a0 + a1) / 2;
      latch.position.set(Math.cos(midAngle) * 1.35, Math.sin(midAngle) * 1.35, slabThickness + 0.04);
      latch.rotation.z = midAngle;
      slabMesh.add(latch);

      slabMesh.userData = {
        index: i,
        angle: midAngle,
        dir: new THREE.Vector2(Math.cos(midAngle), Math.sin(midAngle)),
      };

      this.vaultSlabs.push(slabMesh);
      this.vaultGroup.add(slabMesh);
    }

    // Central Vault Locking Hub & Turnstile Spoke Wheel
    const hubBaseGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 24);
    hubBaseGeo.rotateX(Math.PI / 2);
    const hubBase = new THREE.Mesh(hubBaseGeo, frameMat);
    this.vaultHub.add(hubBase);

    const wheelRimGeo = new THREE.TorusGeometry(0.55, 0.035, 12, 32);
    const wheelRim = new THREE.Mesh(wheelRimGeo, boltMat);
    wheelRim.position.z = 0.22;
    this.vaultHub.add(wheelRim);

    for (let s = 0; s < 6; s++) {
      const spAngle = (s * Math.PI * 2) / 6;
      const spokeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.52);
      const spoke = new THREE.Mesh(spokeGeo, boltMat);
      spoke.position.set(Math.cos(spAngle) * 0.26, Math.sin(spAngle) * 0.26, 0.22);
      spoke.rotation.z = spAngle + Math.PI / 2;
      this.vaultHub.add(spoke);
    }

    this.vaultGroup.add(this.vaultHub);
  }

  private setupCurrencyTempest() {
    this.threeScene.add(this.currencyVortexGroup);

    // 1. Swirling Banknotes ($100 Bills)
    const billGeo = new THREE.PlaneGeometry(0.156, 0.068);
    const billMat = new THREE.MeshStandardMaterial({
      map: this.banknoteTexture,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const billCount = 180;
    for (let i = 0; i < billCount; i++) {
      const mesh = new THREE.Mesh(billGeo, billMat);
      const phi0 = (i * 2.39996) % (Math.PI * 2); // Golden spiral distribution
      const radiusBase = 0.75 + (i % 7) * 0.28;
      const speedZ = 1.6 + (i % 5) * 0.35;
      const rotSpeedX = (0.8 + (i % 6) * 0.4) * (i % 2 === 0 ? 1 : -1);
      const rotSpeedY = (0.7 + (i % 5) * 0.3) * (i % 3 === 0 ? 1 : -1);
      const rotSpeedZ = 0.5 + (i % 4) * 0.25;

      this.banknotes.push({
        mesh,
        phi0,
        radiusBase,
        speedZ,
        rotSpeedX,
        rotSpeedY,
        rotSpeedZ,
      });
      this.currencyVortexGroup.add(mesh);
    }

    // 2. Gleaming Gold Bullion Bars
    const barGeo = new THREE.BoxGeometry(0.20, 0.052, 0.092);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.96,
      roughness: 0.16,
    });

    const barCount = 28;
    for (let b = 0; b < barCount; b++) {
      const mesh = new THREE.Mesh(barGeo, barMat);
      const angle = (b * Math.PI * 2) / barCount;
      const r = 1.1 + (b % 4) * 0.35;
      const basePos = new THREE.Vector3(
        Math.cos(angle) * r,
        0.35 + Math.sin(b * 1.8) * 0.7,
        -4.2 + (b * 0.35)
      );
      const rotAxis = new THREE.Vector3(
        Math.sin(b * 2.1),
        Math.cos(b * 1.5),
        Math.sin(b * 3.7)
      ).normalize();
      const rotSpeed = 0.6 + (b % 5) * 0.22;

      this.goldBars.push({
        mesh,
        seed: b,
        basePos,
        rotAxis,
        rotSpeed,
      });
      this.currencyVortexGroup.add(mesh);
    }
  }

  private setupGlassShards() {
    this.threeScene.add(this.glassShardsGroup);

    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xf0fdf4,
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const shardCount = 24;
    for (let s = 0; s < shardCount; s++) {
      // Create random triangular or trapezoid shard geometries
      const theta = (s * Math.PI * 2) / shardCount;
      const rOuter = 0.12 + (s % 3) * 0.04;
      const w = 0.05 + (s % 4) * 0.02;

      const geom = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        Math.cos(theta) * rOuter, Math.sin(theta) * rOuter, 0,
        Math.cos(theta + 0.3) * (rOuter + w), Math.sin(theta + 0.3) * (rOuter + w), 0.01,
      ]);
      geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geom.computeVertexNormals();

      const mesh = new THREE.Mesh(geom, shardMat);
      mesh.position.set(0, 0.46, -0.38); // Starts pegged at speedometer face

      const vel = new THREE.Vector3(
        Math.cos(theta) * (2.8 + (s % 3) * 1.2),
        Math.sin(theta) * (2.4 + (s % 4) * 1.0) + 0.5,
        5.5 + (s % 5) * 2.0 // Blasts outward towards camera along +Z
      );
      const rotVel = new THREE.Vector3(
        (3.0 + (s % 4) * 2.0) * (s % 2 === 0 ? 1 : -1),
        (2.5 + (s % 3) * 2.0),
        (4.0 + (s % 5) * 1.5)
      );

      this.glassShards.push({ mesh, vel, rotVel });
      this.glassShardsGroup.add(mesh);
    }
  }

  private setupClaspedHands() {
    // Clasped hands are mounted within the cockpit coordinate space
    this.claspedHandsGroup.name = 'claspedHandsGroup';
    this.threeScene.add(this.claspedHandsGroup);

    // Warm organic materials for driver and navigator hands
    const driverSkinMat = new THREE.MeshStandardMaterial({
      color: 0xc48262,
      roughness: 0.54,
      metalness: 0.04,
      name: 'driverSkinMat',
    });

    const navSkinMat = new THREE.MeshStandardMaterial({
      color: 0xedbaa0,
      roughness: 0.50,
      metalness: 0.03,
      name: 'navSkinMat',
    });

    const driverSleeveMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.85,
      metalness: 0.2,
      name: 'driverSleeveMat',
    });

    const navSleeveMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.92,
      metalness: 0.05,
      name: 'navSleeveMat',
    });

    // -------------------------------------------------------------
    // Driver's Hand (Gripping the Steering Wheel at 1 to 2 o'clock)
    // -------------------------------------------------------------
    const driverArm = new THREE.Group();

    // Forearm extending from driver seat to steering wheel
    const dArmGeo = new THREE.CylinderGeometry(0.024, 0.034, 0.26, 16);
    const dArmMesh = new THREE.Mesh(dArmGeo, driverSkinMat);
    dArmMesh.position.set(-0.23, 0.38, 0.02);
    dArmMesh.rotation.set(-0.52, 0.12, -0.15);
    driverArm.add(dArmMesh);

    // Dark racing jacket sleeve cuff
    const dCuffGeo = new THREE.TorusGeometry(0.034, 0.009, 12, 24);
    const dCuff = new THREE.Mesh(dCuffGeo, driverSleeveMat);
    dCuff.position.set(-0.22, 0.46, -0.09);
    dCuff.rotation.set(-0.52, 0.12, 0);
    driverArm.add(dCuff);

    // Driver wrist & palm
    const dWristGeo = new THREE.SphereGeometry(0.027, 16, 16);
    const dWrist = new THREE.Mesh(dWristGeo, driverSkinMat);
    dWrist.position.set(-0.21, 0.50, -0.14);
    driverArm.add(dWrist);

    // Palm metacarpus resting over wheel rim
    const dPalmGeo = new THREE.BoxGeometry(0.065, 0.022, 0.068);
    const dPalm = new THREE.Mesh(dPalmGeo, driverSkinMat);
    dPalm.position.set(-0.20, 0.55, -0.19);
    dPalm.rotation.set(-0.42, 0.15, 0.22);
    driverArm.add(dPalm);

    // Driver fingers curling tightly around the wooden outer rim
    for (let f = 0; f < 4; f++) {
      const fGroup = new THREE.Group();
      fGroup.position.set(-0.024 + f * 0.016, 0.005, -0.032);

      // Proximal phalanx
      const p1Geo = new THREE.CylinderGeometry(0.007, 0.0075, 0.028, 12);
      p1Geo.rotateX(Math.PI / 4);
      const p1 = new THREE.Mesh(p1Geo, driverSkinMat);
      p1.position.set(0, 0.005, -0.01);
      fGroup.add(p1);

      // Distal phalanx curling around bottom
      const p2Geo = new THREE.CylinderGeometry(0.006, 0.0068, 0.024, 12);
      p2Geo.rotateX(Math.PI * 0.65);
      const p2 = new THREE.Mesh(p2Geo, driverSkinMat);
      p2.position.set(0, -0.012, -0.02);
      fGroup.add(p2);

      dPalm.add(fGroup);
    }

    // Driver thumb gripping inner rim
    const dThumbGeo = new THREE.CylinderGeometry(0.0075, 0.0085, 0.034, 12);
    dThumbGeo.rotateZ(Math.PI / 3);
    const dThumb = new THREE.Mesh(dThumbGeo, driverSkinMat);
    dThumb.position.set(0.032, -0.008, 0.01);
    dPalm.add(dThumb);

    this.claspedHandsGroup.add(driverArm);

    // -------------------------------------------------------------
    // Navigator's Hand (Reaching across console, clasping driver's hand)
    // -------------------------------------------------------------
    const navArm = new THREE.Group();

    // Forearm reaching diagonally across center console
    const nArmGeo = new THREE.CylinderGeometry(0.022, 0.030, 0.32, 16);
    const nArmMesh = new THREE.Mesh(nArmGeo, navSkinMat);
    nArmMesh.position.set(-0.04, 0.44, -0.08);
    nArmMesh.rotation.set(-0.45, 0.58, -0.85);
    navArm.add(nArmMesh);

    // Soft cream knitted sweater cuff
    const nCuffGeo = new THREE.TorusGeometry(0.031, 0.009, 12, 24);
    const nCuff = new THREE.Mesh(nCuffGeo, navSleeveMat);
    nCuff.position.set(-0.13, 0.50, -0.13);
    nCuff.rotation.set(-0.45, 0.58, -0.85);
    navArm.add(nCuff);

    // Navigator wrist
    const nWristGeo = new THREE.SphereGeometry(0.025, 16, 16);
    const nWrist = new THREE.Mesh(nWristGeo, navSkinMat);
    nWrist.position.set(-0.16, 0.53, -0.16);
    navArm.add(nWrist);

    // Navigator palm resting directly over the back of driver's hand
    const nPalmGeo = new THREE.BoxGeometry(0.060, 0.020, 0.064);
    const nPalm = new THREE.Mesh(nPalmGeo, navSkinMat);
    nPalm.position.set(-0.19, 0.57, -0.19);
    nPalm.rotation.set(-0.35, 0.28, 0.32);
    navArm.add(nPalm);

    // Navigator interlocking fingers wrapping firmly over driver's knuckles
    for (let f = 0; f < 4; f++) {
      const nfGroup = new THREE.Group();
      nfGroup.position.set(-0.022 + f * 0.015, 0.008, -0.028);

      // Proximal segment
      const np1Geo = new THREE.CylinderGeometry(0.0065, 0.007, 0.030, 12);
      np1Geo.rotateX(Math.PI / 3);
      const np1 = new THREE.Mesh(np1Geo, navSkinMat);
      np1.position.set(0, 0.006, -0.012);
      nfGroup.add(np1);

      // Distal segment interlocked between driver's fingers
      const np2Geo = new THREE.CylinderGeometry(0.0055, 0.0062, 0.026, 12);
      np2Geo.rotateX(Math.PI * 0.72);
      const np2 = new THREE.Mesh(np2Geo, navSkinMat);
      np2.position.set(0, -0.012, -0.024);
      nfGroup.add(np2);

      this.navFingersGroup.add(nfGroup);
      nPalm.add(nfGroup);
    }

    // Navigator thumb resting gently along the driver's thenar/wrist
    const nThumbGeo = new THREE.CylinderGeometry(0.007, 0.008, 0.032, 12);
    nThumbGeo.rotateZ(-Math.PI / 3.5);
    const nThumb = new THREE.Mesh(nThumbGeo, navSkinMat);
    nThumb.position.set(-0.028, -0.006, 0.015);
    nPalm.add(nThumb);

    this.claspedHandsGroup.add(navArm);
  }

  private setupTunnelAndPursuit() {
    this.threeScene.add(this.tunnelGroup);

    // Tunnel / vault ceiling beams passing overhead
    const beamGeo = new THREE.BoxGeometry(9.0, 0.45, 0.45);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x111418,
      roughness: 0.7,
      metalness: 0.6,
    });

    const lightGeo = new THREE.BoxGeometry(3.5, 0.06, 0.18);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < 18; i++) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 3.8, -i * 6.0);
      this.tunnelGroup.add(beam);

      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(0, 3.55, -i * 6.0);
      this.overheadLights.push(light);
      this.tunnelGroup.add(light);
    }

    // Police Cruisers in the distant pursuit (Lines 13 - 15)
    this.policeCruisersGroup.position.set(0, 0, -32.0);
    this.threeScene.add(this.policeCruisersGroup);

    for (const sx of [-2.4, 2.4]) {
      const cruiser = new THREE.Group();
      cruiser.position.set(sx, 0.45, 0);

      // Low wedge body silhouette
      const bodyGeo = new THREE.BoxGeometry(1.6, 0.55, 3.6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.4, metalness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      cruiser.add(body);

      // High-intensity headlights
      for (const hx of [-0.65, 0.65]) {
        const headGeo = new THREE.CircleGeometry(0.12, 16);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const hl = new THREE.Mesh(headGeo, headMat);
        hl.position.set(hx, 0.05, 1.81);
        cruiser.add(hl);
      }

      // Roof Strobe Lightbar (Crimson on left, Cyan on right)
      const barGeo = new THREE.BoxGeometry(1.1, 0.12, 0.18);
      const barBase = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x111827 }));
      barBase.position.set(0, 0.42, -0.2);
      cruiser.add(barBase);

      const redStrobeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.12, 0.16),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      redStrobeMesh.position.set(-0.25, 0.42, -0.2);
      cruiser.add(redStrobeMesh);

      const blueStrobeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.12, 0.16),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      blueStrobeMesh.position.set(0.25, 0.42, -0.2);
      cruiser.add(blueStrobeMesh);

      this.policeCruisersGroup.add(cruiser);
    }
  }

  // =============================================================
  // DETERMINISTIC TRAJECTORY & CAMERA CHOREOGRAPHY
  // =============================================================

  private updateCamera(t: number) {
    // Contract T2 Seam: 33.55s
    // Contract T3 Seam: 50.46s

    if (t <= 33.55) {
      // Transition T2 incoming holding position
      this.camPos.set(0.0, 0.8, 2.4);
      this.camTarget.set(0.0, 0.5, 0.0);
      this.camera.fov = 50.0;
    } else if (t <= 37.25) {
      // Phase 1A (33.55 - 37.25, Line 8): Plunge forward through vault breach on chorus drop
      const u = (t - 33.55) / (37.25 - 33.55);
      const plungeZ = lerp(2.4, 0.85, ease.outCubic(u));
      const swayX = Math.sin(u * Math.PI) * 0.18;
      const swayY = lerp(0.8, 0.72, ease.outQuad(u));

      this.camPos.set(swayX, swayY, plungeZ);
      this.camTarget.set(0.0, 0.52, -0.6 * u);
      this.camera.fov = lerp(50.0, 48.0, u);
    } else if (t <= 39.12) {
      // Phase 1B (37.25 - 39.12, Line 9): Swoop down into the Speedster cockpit
      const u = (t - 37.25) / (39.12 - 37.25);
      const e = ease.inOutCubic(u);

      this.camPos.set(
        lerp(0.0, -0.42, e),
        lerp(0.72, 0.62, e),
        lerp(0.85, 0.08, e)
      );
      this.camTarget.set(
        lerp(0.0, -0.22, e),
        lerp(0.52, 0.50, e),
        lerp(-0.6, -0.20, e)
      );
      this.camera.fov = lerp(48.0, 46.0, u);
    } else if (t <= 44.70) {
      // Phase 2 (39.12 - 44.70, Lines 10 & 11): Intimate Macro Two-Shot of Clasped Hands
      // "If you break the bank, I'll hold your hand" -> "Long as you hold onto me"
      const u = (t - 39.12) / (44.70 - 39.12);
      const e = ease.inOutQuad(u);

      // Glides smoothly from driver's flank to over-the-console angle
      const posX = lerp(-0.42, -0.10, e) + Math.sin(u * Math.PI) * 0.04;
      const posY = lerp(0.62, 0.59, e);
      const posZ = lerp(0.08, -0.02, e);

      this.camPos.set(posX, posY, posZ);
      this.camTarget.set(-0.21, 0.52, -0.20); // Locked precisely on clasped hands
      this.camera.fov = 45.0;
    } else if (t <= 49.30) {
      // Phase 3 (44.70 - 49.30, Lines 12 - 14): Continuous sweeping orbit around hands & wheel
      // "take the wheel" -> "sirens in the distance" -> "cross your heart"
      const u = (t - 44.70) / (49.30 - 44.70);
      const e = ease.inOutCubic(u);

      // Elegant uninterrupted orbit: sweeping 110 degrees from console perspective around to passenger flank
      const phi = lerp(1.25, 2.75, e);
      const orbitR = 0.32 + Math.sin(u * Math.PI) * 0.04;
      const handPivotX = -0.21;
      const handPivotY = 0.52;
      const handPivotZ = -0.20;

      const posX = handPivotX + Math.sin(phi) * orbitR;
      const posY = handPivotY + 0.11 + Math.cos(u * Math.PI * 2.0) * 0.03;
      const posZ = handPivotZ + Math.cos(phi) * orbitR;

      this.camPos.set(posX, posY, posZ);
      // Subtle look-ahead toward windshield as sirens appear on Line 13
      const targetLookX = lerp(handPivotX, handPivotX + 0.06, smoothstep(0.3, 0.7, u));
      this.camTarget.set(targetLookX, handPivotY, handPivotZ);
      this.camera.fov = lerp(45.0, 43.5, u);
    } else if (t <= 50.46) {
      // Phase 4 (49.30 - 50.46, Line 15): Smooth tilt up toward rearview mirror into Contract T3
      const u = (t - 49.30) / (50.46 - 49.30);
      const e = ease.inOutCubic(u);

      // Start position from end of Phase 3
      const startX = -0.21 + Math.sin(2.75) * 0.32; // ~-0.09
      const startY = 0.52 + 0.11;                   // ~0.63
      const startZ = -0.20 + Math.cos(2.75) * 0.32; // ~-0.49

      // Exactly matches Contract T3 at t = 50.46s:
      // Pos: [-0.08, 0.56, 0.18], Target: [0.0, 0.58, -0.38], FOV: 44.0
      this.camPos.set(
        lerp(startX, -0.08, e),
        lerp(startY, 0.56, e),
        lerp(startZ, 0.18, e)
      );
      this.camTarget.set(
        lerp(-0.15, 0.0, e),
        lerp(0.52, 0.58, e),
        lerp(-0.20, -0.38, e)
      );
      this.camera.fov = lerp(43.5, 44.0, e);
    } else {
      // Overlap Seam Continuation (50.46s - 50.96s):
      // Preserves Contract T3 velocity vector: Vel = [0.0, 0.1, -1.5]
      const dtTail = t - 50.46;
      this.camPos.set(
        -0.08,
        0.56 + dtTail * 0.1,
        0.18 - dtTail * 1.5
      );
      this.camTarget.set(0.0, 0.58, -0.38);
      this.camera.fov = 44.0;
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
    this.camera.updateProjectionMatrix();
  }

  // =============================================================
  // MAIN RENDER LOOP
  // =============================================================

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const t = f.t;
    const bpmFreq = (129.20 / 60.0) * Math.PI * 2;

    // --- 1. Vehicle Realtime Simulation ---
    const carSpeed = 38.0; // ~85 MPH
    const steerOsc = Math.sin(t * 1.6) * 0.045;
    this.vehicleRig.update({
      t,
      speed: carSpeed,
      steerAngle: steerOsc,
      diceSwingStrength: 1.25,
      engineVibe: 0.0035,
    });

    // --- 2. Camera Choreography ---
    this.updateCamera(t);

    // --- 3. Bank Vault Blast Door Dynamics ---
    if (t < 33.55) {
      // Closed with high-tension shudder
      const shudder = Math.sin(t * 120.0) * 0.006;
      this.vaultGroup.position.set(shudder, 0.48 + shudder * 0.5, -4.5);
      for (const slab of this.vaultSlabs) {
        slab.position.set(0, 0, -0.13);
        slab.rotation.set(0, 0, 0);
      }
      this.vaultHub.position.set(0, 0, 0);
    } else {
      // Explosive blast breach
      const dtBlast = t - 33.55;
      const blastProgress = Math.pow(dtBlast * 1.75, 1.35);

      for (const slab of this.vaultSlabs) {
        const dir = slab.userData.dir as THREE.Vector2;
        const idx = slab.userData.index as number;

        slab.position.x = dir.x * blastProgress * 3.2;
        slab.position.y = dir.y * blastProgress * 2.4;
        slab.position.z = -0.13 + blastProgress * 4.2; // Flying forward past camera

        slab.rotation.x = dtBlast * (0.8 + (idx % 3) * 0.35) * (idx % 2 === 0 ? 1 : -1);
        slab.rotation.y = dtBlast * (0.65 + (idx % 4) * 0.28);
        slab.rotation.z = slab.userData.angle + dtBlast * 0.4;
      }

      // Central hub spins off and tumbles into void
      this.vaultHub.position.set(
        Math.sin(dtBlast * 2.0) * blastProgress * 1.2,
        Math.cos(dtBlast * 2.5) * blastProgress * 0.8,
        blastProgress * 3.8
      );
      this.vaultHub.rotation.z = dtBlast * 8.0;
      this.vaultHub.rotation.x = dtBlast * 3.5;
    }

    // --- 4. Currency Tempest Simulation (Banknotes & Bullion) ---
    const vortexProgress = Math.max(0, t - 33.05);

    // Banknotes logarithmic helical vortex
    for (let i = 0; i < this.banknotes.length; i++) {
      const bn = this.banknotes[i]!;
      const r = bn.radiusBase + Math.sin(i * 3.7 + t * 2.2) * 0.28;
      const omega = 3.8 / Math.max(0.6, Math.sqrt(r));
      const theta = bn.phi0 + vortexProgress * omega;

      const bx = Math.cos(theta) * r;
      const by = 0.48 + Math.sin(i * 1.9 + t * 2.4) * 0.75;
      const bz = -5.0 + ((i * 0.08 + vortexProgress * bn.speedZ) % 11.5);

      bn.mesh.position.set(bx, by, bz);
      bn.mesh.rotation.x = Math.sin(t * 8.0 + i * 2.1) * 0.75 + bn.rotSpeedX * t * 0.2;
      bn.mesh.rotation.y = theta + Math.PI / 2 + Math.cos(t * 6.0 + i * 1.5) * 0.4;
      bn.mesh.rotation.z = Math.cos(t * 9.0 + i * 0.9) * 0.6;
    }

    // Gold bullion bars zero-G tumbling
    for (let b = 0; b < this.goldBars.length; b++) {
      const gb = this.goldBars[b]!;
      const gz = -4.5 + ((gb.seed * 0.42 + vortexProgress * 1.8) % 9.0);
      const gx = gb.basePos.x + Math.sin(gb.seed * 2.4 + t * 0.5) * 0.35;
      const gy = gb.basePos.y + Math.cos(gb.seed * 3.1 + t * 0.6) * 0.30;

      gb.mesh.position.set(gx, gy, gz);
      gb.mesh.rotateOnAxis(gb.rotAxis, gb.rotSpeed * 0.02);
    }

    // --- 5. Glass Shards Explosion (Contract T2 Seam) ---
    if (t >= 33.55 && t <= 36.5) {
      this.glassShardsGroup.visible = true;
      const dtShard = t - 33.55;
      for (const shard of this.glassShards) {
        shard.mesh.position.set(
          shard.vel.x * dtShard,
          0.46 + shard.vel.y * dtShard - 0.5 * 9.8 * dtShard * dtShard * 0.08,
          -0.38 + shard.vel.z * dtShard
        );
        shard.mesh.rotation.x = shard.rotVel.x * dtShard;
        shard.mesh.rotation.y = shard.rotVel.y * dtShard;
        shard.mesh.rotation.z = shard.rotVel.z * dtShard;
      }
    } else {
      this.glassShardsGroup.visible = false;
    }

    // --- 6. Clasped Hands Subtle Emotional Breathing ---
    // Squeeze pulse reactive to song kicks and half-note groove
    const squeezePulse = Math.sin(t * bpmFreq * 0.5) * 0.025;
    for (let f = 0; f < this.navFingersGroup.children.length; f++) {
      const nf = this.navFingersGroup.children[f]!;
      nf.rotation.x = squeezePulse;
    }

    // --- 7. Tunnel Ceiling Lights Movement ---
    const tunnelCycle = (t * carSpeed * 0.6) % 6.0;
    for (let l = 0; l < this.overheadLights.length; l++) {
      const zPos = -l * 6.0 + tunnelCycle;
      this.overheadLights[l]!.position.z = zPos;
    }

    // --- 8. Flashing Police Sirens (Lines 13 - 15) ---
    let redStrobe = 0.0;
    let blueStrobe = 0.0;

    if (t >= 46.20) {
      // Rapid emergency cadence (~4.3 Hz double-pulse)
      const sirenPhase = (t - 46.20) * 8.6;
      redStrobe = Math.pow(Math.max(0, Math.sin(sirenPhase)), 6.0);
      blueStrobe = Math.pow(Math.max(0, Math.sin(sirenPhase + Math.PI)), 6.0);

      // Volume envelope ramping to crescendo at seam 50.46s
      const sirenEnv = clamp((t - 46.20) / 3.0, 0.2, 1.0);

      this.sirenRedLight.intensity = redStrobe * 7.5 * sirenEnv;
      this.sirenBlueLight.intensity = blueStrobe * 7.5 * sirenEnv;

      this.cockpitSirenLight.color.setRGB(redStrobe * 0.9, 0.0, blueStrobe * 0.9);
      this.cockpitSirenLight.intensity = (redStrobe + blueStrobe) * 2.8 * sirenEnv;

      // Pursuers bobbing in rearview perspective
      this.policeCruisersGroup.position.z = -30.0 + Math.sin(t * 2.0) * 2.5;
    } else {
      this.sirenRedLight.intensity = 0.0;
      this.sirenBlueLight.intensity = 0.0;
      this.cockpitSirenLight.intensity = 0.0;
    }

    // --- 9. 3D Kinetic Lyric Typography (Lines 8 - 15) ---
    this.layer2d.clear();
    const ctx = this.layer2d.ctx;

    // Anchor vector locked to camera target for rock-solid screen-space centering
    const targetAnchor: [number, number, number] = [this.camTarget.x, this.camTarget.y, this.camTarget.z];

    // Line 8: "Oh, just grab the cash, and no takebacks" (33.55s - 37.25s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.0, 0.60, 0.4],
      cam: this.camera,
      t,
      lineIdx: 8,
      fontSize: 52,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -140,
    });

    // Line 9: "Unless you do it with me" (37.25s - 39.12s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 9,
      fontSize: 48,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.CURRENCY_GREEN_TINT,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: 180,
    });

    // Line 10: "If you break the bank, I'll hold your hand" (39.12s - 42.84s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 10,
      fontSize: 50,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -200,
    });

    // Line 11: "Long as you hold onto me" (42.84s - 44.70s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 11,
      fontSize: 48,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.CURRENCY_GREEN_TINT,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: 180,
    });

    // Rapid Lines 12 - 15: Staggered vertical Y offsets to eliminate any crossfade collision!
    // Line 12: "Oh, take the wheel, I'll navigate" (44.70s - 46.20s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 12,
      fontSize: 48,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: '#38bdf8', // Aero cyan
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -200, // Shifted to upper third
    });

    // Line 13: "Hear the sirens in the distance, high-speed chase" (46.20s - 47.80s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 13,
      fontSize: 46,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.POLICE_RED,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: 200, // Shifted to lower third
    });

    // Line 14: "Oh, just cross your heart, oh, no takebacks" (47.80s - 49.30s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 14,
      fontSize: 48,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -200, // Shifted to upper third
    });

    // Line 15: "Unless you do it with me" (49.30s - 50.46s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 15,
      fontSize: 50,
      baseColor: 'rgba(240, 244, 248, 0.50)',
      highlightColor: COLOR_TOKENS.CURRENCY_GREEN_TINT,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: 180, // Shifted to lower third
    });

    this.layer2d.upload();

    // --- 10. Three.js Render Pass & 2D Layer Composite ---
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // --- 11. Dynamic Post-Processing Overrides ---
    // Bass drop spike at t = 33.55s
    const dropDt = Math.max(0, t - 33.55);
    const dropFlash = t >= 33.55 ? 0.45 * Math.exp(-dropDt * 4.0) : 0.0;
    const dropBloom = t >= 33.55 ? 0.60 * Math.exp(-dropDt * 2.8) : 0.0;
    const dropCA = t >= 33.55 ? 1.8 * Math.exp(-dropDt * 3.0) : 0.0;

    // Audio-reactive punch
    const kickPunch = f.a?.kick ?? 0.0;
    const shakeX = Math.sin(t * 110.0) * kickPunch * 2.8;
    const shakeY = Math.cos(t * 130.0) * kickPunch * 2.0;

    return {
      exposure: 1.02,
      bloom: 0.30 + dropBloom * 0.30 + (redStrobe + blueStrobe) * 0.08,
      bloomThreshold: 0.88,
      ca: 0.75 + dropCA * 0.5,
      vignette: 0.36,
      grain: 0.045,
      flash: dropFlash * 0.6,
      shake: [shakeX, shakeY],
    };
  }

  // =============================================================
  // DISPOSAL & RESOURCE CLEANUP
  // =============================================================

  override dispose(): void {
    this.banknoteTexture.dispose();
    this.layer2d.texture.dispose();
  }
}

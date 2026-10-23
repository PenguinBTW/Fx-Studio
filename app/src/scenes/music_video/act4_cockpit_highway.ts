// ACT IV: THE COCKPIT MIRROR & NEON HIGHWAY (49.96s - 67.63s, Nominal Cut 67.13s)
// Lines 16 - 19:
// - Line 16: "Can you feel the heat? 5-0 on our feet" (50.46s - 54.50s)
// - Line 17: "Dice up in the mirror, lucky charms" (54.50s - 58.60s)
// - Line 18: "Said we'd go down swinging, time to show 'em what we're thinking" (58.60s - 63.00s)
// - Line 19: "Do or die, I'll be in your arms" (63.00s - 67.13s)
//
// Entry Transition Contract T3 (50.46s):
// - Pos: [0.15, 0.35, 0.95], Target: [0.0, 0.3, 0.0], Vel: [0.0, 0.2, -4.5], FOV: 42.0
// - Camera tilts up from driver's forearm gripping steering wheel to frame chrome fuzzy dice.
//
// Exit Transition Contract T4 (67.13s):
// - Pos: [0.0, 2.2, 7.5], Target: [0.0, 1.0, -15.0], Vel: [0.0, 1.2, 18.0], FOV: 55.0
// - Reverse whip pullout between bucket seats through rear window into airborne chase cam.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease, lerp } from '../../engine/util';
import { createVehicleModel, type VehicleModelRig } from './shared/vehicle_model';

export default class Act4CockpitHighway extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // Vehicle & Interior
  private vehicle: VehicleModelRig;
  private mirrorCanvas: HTMLCanvasElement;
  private mirrorCtx: CanvasRenderingContext2D;
  private mirrorTexture: THREE.CanvasTexture;
  private driverForearmGroup = new THREE.Group();

  // Highway & Environment (Moving World Convention)
  private roadGroup = new THREE.Group();
  private laneDashesGroup = new THREE.Group();
  private guardrailsGroup = new THREE.Group();
  private gantriesGroup = new THREE.Group();
  private streetLampsGroup = new THREE.Group();
  private cityBuildingsGroup = new THREE.Group();
  private neonSignsGroup = new THREE.Group();
  private roadblockGroup = new THREE.Group();
  private rampMesh!: THREE.Mesh;

  // 3D Pursuit Police Cruisers (Behind Vehicle)
  private cruiser1Group = new THREE.Group();
  private cruiser2Group = new THREE.Group();

  // Atmospheric Particles & Lighting
  private rainParticles!: THREE.Points;
  private sparksParticles!: THREE.Points;
  private dashPointLight: THREE.PointLight;
  private policeRedLight: THREE.PointLight;
  private policeBlueLight: THREE.PointLight;
  private streetLampOverheadLight: THREE.SpotLight;
  private speedsterHeadlightsGroup = new THREE.Group();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 350);
    this.layer2d = new Layer2D(W, H);

    // Deep Neo-Noir midnight highway atmosphere
    this.threeScene.background = new THREE.Color(0x06080d);
    this.threeScene.fog = new THREE.FogExp2(0x06080e, 0.016);

    // -------------------------------------------------------------
    // 1. Vehicle Model & Custom Mirror / Cockpit Detailing
    // -------------------------------------------------------------
    this.vehicle = createVehicleModel();
    this.threeScene.add(this.vehicle.root);

    // Centerpiece: Dynamic Rearview Mirror Feed (Police pursuit in reflection)
    this.mirrorCanvas = document.createElement('canvas');
    this.mirrorCanvas.width = 512;
    this.mirrorCanvas.height = 256;
    this.mirrorCtx = this.mirrorCanvas.getContext('2d')!;
    this.mirrorTexture = new THREE.CanvasTexture(this.mirrorCanvas);
    this.mirrorTexture.colorSpace = THREE.SRGBColorSpace;
    this.mirrorTexture.minFilter = THREE.LinearFilter;
    this.mirrorTexture.magFilter = THREE.LinearFilter;

    // Apply mirror reflection texture to the rearview mirror face
    const mirrorFaceMesh = this.vehicle.rearviewMirror.children.find(
      (c) => c instanceof THREE.Mesh && (c.geometry instanceof THREE.CircleGeometry || (c as any).isMesh),
    ) as THREE.Mesh | undefined;

    const mirrorDynamicMat = new THREE.MeshStandardMaterial({
      map: this.mirrorTexture,
      emissiveMap: this.mirrorTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.95,
      roughness: 0.05,
      metalness: 0.9,
    });

    if (mirrorFaceMesh) {
      mirrorFaceMesh.material = mirrorDynamicMat;
    } else {
      this.vehicle.materials.mirrorGlass = mirrorDynamicMat;
    }

    // Stylized Noir Driver Forearms gripping steering wheel (Contract T3 anchor)
    this.buildDriverForearmRig();

    // -------------------------------------------------------------
    // 2. Cockpit Lighting & Flashing Police Sirens
    // -------------------------------------------------------------
    // Ambient Indigo Fill
    const ambientLight = new THREE.AmbientLight(0x0a101d, 1.2);
    this.threeScene.add(ambientLight);

    // Warm Analog Dashboard Illumination (Speedo & Brass bezels)
    this.dashPointLight = new THREE.PointLight(0xd4a359, 1.1, 1.8);
    this.dashPointLight.position.set(0, 0.48, -0.32);
    this.threeScene.add(this.dashPointLight);

    // Flashing Crimson & Cobalt Police Siren Point Lights (Mounted behind cockpit)
    this.policeRedLight = new THREE.PointLight(0xef4444, 0.0, 22);
    this.policeRedLight.position.set(-0.85, 1.1, 5.0);
    this.threeScene.add(this.policeRedLight);

    this.policeBlueLight = new THREE.PointLight(0x3b82f6, 0.0, 22);
    this.policeBlueLight.position.set(0.85, 1.1, 5.0);
    this.threeScene.add(this.policeBlueLight);

    // Overhead Passing Highway Streetlamp Spotlight
    this.streetLampOverheadLight = new THREE.SpotLight(0xfef08a, 0.0, 35, Math.PI / 4, 0.5);
    this.streetLampOverheadLight.position.set(0, 8, -4);
    this.streetLampOverheadLight.target.position.set(0, 0.4, 0);
    this.threeScene.add(this.streetLampOverheadLight);
    this.threeScene.add(this.streetLampOverheadLight.target);

    // Speedster Front Headlight Cones (Halogen forward projectors)
    this.buildSpeedsterHeadlights();

    // -------------------------------------------------------------
    // 3. Moving World Highway Environment
    // -------------------------------------------------------------
    this.buildHighwayEnvironment();
    this.buildCityNeonFacades();
    this.buildPursuitPoliceCruisers();
    this.buildRoadblockAndRamp();
    this.buildRainParticleSystem();
    this.buildSparksEmitter();
  }

  // ---------------------------------------------------------------------------
  // Build: Driver's Forearm Rig (Aligned with T3 Forearm Tilt)
  // ---------------------------------------------------------------------------
  private buildDriverForearmRig() {
    this.driverForearmGroup.name = 'driver_forearm_rig';

    const leatherSleeveMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.85,
      metalness: 0.1,
    });
    const gloveMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.6,
      metalness: 0.25,
    });

    // Left Driver Arm (Gripping steering wheel rim at ~10 o'clock)
    const leftArmGeo = new THREE.CylinderGeometry(0.038, 0.046, 0.42, 12);
    leftArmGeo.rotateX(Math.PI / 3.2);
    leftArmGeo.rotateZ(-0.25);
    const leftArmMesh = new THREE.Mesh(leftArmGeo, leatherSleeveMat);
    leftArmMesh.position.set(-0.24, 0.32, 0.28);
    this.driverForearmGroup.add(leftArmMesh);

    // Left Glove
    const leftGloveGeo = new THREE.SphereGeometry(0.042, 12, 12);
    leftGloveGeo.scale(1.2, 0.8, 1.5);
    const leftGloveMesh = new THREE.Mesh(leftGloveGeo, gloveMat);
    leftGloveMesh.position.set(-0.38, 0.56, -0.16);
    this.driverForearmGroup.add(leftGloveMesh);

    // Right Driver Arm (Gripping wheel at ~2 o'clock)
    const rightArmGeo = new THREE.CylinderGeometry(0.038, 0.046, 0.42, 12);
    rightArmGeo.rotateX(Math.PI / 3.0);
    rightArmGeo.rotateZ(0.28);
    const rightArmMesh = new THREE.Mesh(rightArmGeo, leatherSleeveMat);
    rightArmMesh.position.set(-0.06, 0.32, 0.26);
    this.driverForearmGroup.add(rightArmMesh);

    // Right Glove
    const rightGloveGeo = new THREE.SphereGeometry(0.042, 12, 12);
    rightGloveGeo.scale(1.2, 0.8, 1.5);
    const rightGloveMesh = new THREE.Mesh(rightGloveGeo, gloveMat);
    rightGloveMesh.position.set(-0.16, 0.56, -0.16);
    this.driverForearmGroup.add(rightGloveMesh);

    this.threeScene.add(this.driverForearmGroup);
  }

  // ---------------------------------------------------------------------------
  // Build: Speedster Headlights Cones
  // ---------------------------------------------------------------------------
  private buildSpeedsterHeadlights() {
    const beamGeo = new THREE.ConeGeometry(3.5, 35, 16, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, -17.5);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    for (const sx of [-0.62, 0.62]) {
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(sx, 0.46, -2.4);
      this.speedsterHeadlightsGroup.add(beamMesh);
    }
    this.threeScene.add(this.speedsterHeadlightsGroup);
  }

  // ---------------------------------------------------------------------------
  // Build: Highway Asphalt & Guardrails
  // ---------------------------------------------------------------------------
  private buildHighwayEnvironment() {
    // Wet Highway Asphalt Roadbed (-80m to +50m)
    const roadGeo = new THREE.PlaneGeometry(24, 150, 1, 32);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      roughness: 0.22,
      metalness: 0.65,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, -0.01, -15);
    roadMesh.receiveShadow = true;
    this.roadGroup.add(roadMesh);

    // Continuous Shoulder Edge Lines (Yellow Left, White Right)
    const edgeLineGeo = new THREE.PlaneGeometry(0.22, 150);
    edgeLineGeo.rotateX(-Math.PI / 2);
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

    const leftEdge = new THREE.Mesh(edgeLineGeo, yellowMat);
    leftEdge.position.set(-8.8, 0.01, -15);
    this.roadGroup.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeLineGeo, whiteMat);
    rightEdge.position.set(8.8, 0.01, -15);
    this.roadGroup.add(rightEdge);

    // Streaming Dashed Center Lane Dividers (Modulo Wrapped along +Z)
    // 3 lane lines across 4 lanes (at X = -4.4, 0.0, +4.4)
    const dashLength = 3.6;
    const dashSpacing = 8.0;
    const dashCountPerLane = 18;
    const dashGeo = new THREE.PlaneGeometry(0.18, dashLength);
    dashGeo.rotateX(-Math.PI / 2);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const laneX of [-4.4, 0.0, 4.4]) {
      for (let i = 0; i < dashCountPerLane; i++) {
        const dashMesh = new THREE.Mesh(dashGeo, dashMat);
        dashMesh.userData = { laneX, baseZ: -60 + i * dashSpacing };
        dashMesh.position.set(laneX, 0.01, dashMesh.userData.baseZ);
        this.laneDashesGroup.add(dashMesh);
      }
    }
    this.threeScene.add(this.roadGroup);
    this.threeScene.add(this.laneDashesGroup);

    // Corrugated Steel Armco Guardrails (Left & Right Shoulders)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.85,
    });
    const railGeo = new THREE.BoxGeometry(0.12, 0.38, 150);
    for (const gx of [-9.4, 9.4]) {
      const railMesh = new THREE.Mesh(railGeo, railMat);
      railMesh.position.set(gx, 0.42, -15);
      this.guardrailsGroup.add(railMesh);

      // Support posts every 6m
      for (let pz = -80; pz <= 40; pz += 6) {
        const postGeo = new THREE.BoxGeometry(0.1, 0.52, 0.1);
        const postMesh = new THREE.Mesh(postGeo, railMat);
        postMesh.position.set(gx, 0.24, pz);
        this.guardrailsGroup.add(postMesh);
      }
    }
    this.threeScene.add(this.guardrailsGroup);

    // Highway Overhead Gantries & Street Lamps
    this.buildGantriesAndLamps();
  }

  // ---------------------------------------------------------------------------
  // Build: Gantries & Street Lamps
  // ---------------------------------------------------------------------------
  private buildGantriesAndLamps() {
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.6,
      metalness: 0.8,
    });
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b, // Deep Highway Green
      roughness: 0.3,
      metalness: 0.2,
      emissive: 0x022c22,
      emissiveIntensity: 0.4,
    });

    // 3 Overhead Gantries spaced along the highway
    for (let gi = 0; gi < 3; gi++) {
      const gantryGroup = new THREE.Group();
      gantryGroup.userData = { baseZ: -gi * 50 - 10 };

      // Left & Right Towers
      for (const tx of [-10.5, 10.5]) {
        const towerGeo = new THREE.BoxGeometry(0.4, 7.5, 0.4);
        const towerMesh = new THREE.Mesh(towerGeo, trussMat);
        towerMesh.position.set(tx, 3.75, 0);
        gantryGroup.add(towerMesh);
      }

      // Cross Truss Beam
      const crossBeamGeo = new THREE.BoxGeometry(22, 0.6, 0.6);
      const crossBeam = new THREE.Mesh(crossBeamGeo, trussMat);
      crossBeam.position.set(0, 7.2, 0);
      gantryGroup.add(crossBeam);

      // Highway Overhead Sign
      const signGeo = new THREE.BoxGeometry(7.5, 2.2, 0.12);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(-1.5, 6.2, 0.3);
      gantryGroup.add(signMesh);

      // Reflective Sign Perimeter Trim Frame
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.35,
        metalness: 0.2,
      });
      // Top and bottom frame bars
      for (const fy of [-1.1, 1.1]) {
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.06, 0.14), trimMat);
        hBar.position.set(-1.5, 6.2 + fy, 0.3);
        gantryGroup.add(hBar);
      }
      // Left and right frame bars
      for (const fx of [-3.75, 3.75]) {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.14), trimMat);
        vBar.position.set(-1.5 + fx, 6.2, 0.3);
        gantryGroup.add(vBar);
      }

      gantryGroup.position.set(0, 0, gantryGroup.userData.baseZ);
      this.gantriesGroup.add(gantryGroup);
    }
    this.threeScene.add(this.gantriesGroup);

    // Curved Highway Cobra-Head Lamp Posts (Left & Right shoulders)
    for (let li = 0; li < 10; li++) {
      const lampGroup = new THREE.Group();
      const lSide = li % 2 === 0 ? -1 : 1;
      const lx = lSide * 9.8;
      lampGroup.userData = { baseZ: -80 + li * 14, side: lSide };

      // Vertical mast
      const mastGeo = new THREE.CylinderGeometry(0.08, 0.12, 7.5, 8);
      const mast = new THREE.Mesh(mastGeo, trussMat);
      mast.position.set(lx, 3.75, 0);
      lampGroup.add(mast);

      // Curved overhang arm
      const armGeo = new THREE.BoxGeometry(2.4, 0.08, 0.08);
      const arm = new THREE.Mesh(armGeo, trussMat);
      arm.position.set(lx - lSide * 1.1, 7.4, 0);
      lampGroup.add(arm);

      // Glowing Lamp Fixture
      const lampHeadGeo = new THREE.BoxGeometry(0.5, 0.12, 0.35);
      const lampHead = new THREE.Mesh(
        lampHeadGeo,
        new THREE.MeshBasicMaterial({ color: 0xfef08a }),
      );
      lampHead.position.set(lx - lSide * 2.1, 7.3, 0);
      lampGroup.add(lampHead);

      lampGroup.position.set(0, 0, lampGroup.userData.baseZ);
      this.streetLampsGroup.add(lampGroup);
    }
    this.threeScene.add(this.streetLampsGroup);
  }

  // ---------------------------------------------------------------------------
  // Build: City Neon Facades & Skyline (Neo-Noir Brutalism)
  // ---------------------------------------------------------------------------
  private buildCityNeonFacades() {
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e14,
      roughness: 0.7,
      metalness: 0.4,
    });

    const neonConfigs = [
      { text: 'NO TAKEBACKS', color: 0x00e5ff, width: 8.5, height: 1.8, y: 14, x: -22, z: -25 },
      { text: 'LUCKY CHARMS', color: 0xe11d48, width: 7.8, height: 1.6, y: 12, x: 22, z: -15 },
      { text: '5-0 HEAT', color: 0xf59e0b, width: 6.5, height: 1.5, y: 16, x: -24, z: -55 },
      { text: 'HARBOR BRIDGE', color: 0x3b82f6, width: 9.0, height: 1.8, y: 15, x: 23, z: -65 },
      { text: 'REDLINE 100', color: 0xef4444, width: 7.0, height: 1.5, y: 11, x: -21, z: 10 },
    ];

    // High-Rise Brutalist Monoliths
    for (let b = 0; b < 12; b++) {
      const bSide = b % 2 === 0 ? -1 : 1;
      const bWidth = 14 + (b % 3) * 6;
      const bHeight = 24 + (b % 4) * 12;
      const bDepth = 22 + (b % 2) * 8;
      const bx = bSide * (22 + (b % 3) * 4);
      const bz = -80 + b * 12;

      const towerGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
      const towerMesh = new THREE.Mesh(towerGeo, buildingMat);
      towerMesh.position.set(bx, bHeight / 2, bz);
      this.cityBuildingsGroup.add(towerMesh);
    }
    this.threeScene.add(this.cityBuildingsGroup);

    // Glowing Neon Signs
    neonConfigs.forEach((nc, idx) => {
      const neonGroup = new THREE.Group();
      neonGroup.userData = { baseZ: nc.z };

      // Outer Glow Box
      const signBackGeo = new THREE.BoxGeometry(nc.width, nc.height, 0.2);
      const signBack = new THREE.Mesh(
        signBackGeo,
        new THREE.MeshBasicMaterial({ color: 0x050508 }),
      );
      neonGroup.add(signBack);

      // Neon Tube Emissive Strips
      const tubeMat = new THREE.MeshStandardMaterial({
        color: nc.color,
        emissive: nc.color,
        emissiveIntensity: 2.8,
        roughness: 0.1,
      });

      // Frame outline
      const frameGeo = new THREE.BoxGeometry(nc.width * 0.94, nc.height * 0.88, 0.05);
      const frameMesh = new THREE.Mesh(frameGeo, tubeMat);
      frameMesh.position.z = 0.12;
      neonGroup.add(frameMesh);

      neonGroup.position.set(nc.x, nc.y, nc.z);
      this.neonSignsGroup.add(neonGroup);
    });
    this.threeScene.add(this.neonSignsGroup);
  }

  // ---------------------------------------------------------------------------
  // Build: 3D Pursuit Police Cruisers (Cruiser 1 & Cruiser 2 behind the car)
  // ---------------------------------------------------------------------------
  private buildPursuitPoliceCruisers() {
    const cruiserBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10, // Police Cruiser Midnight Black
      roughness: 0.35,
      metalness: 0.85,
    });
    const cruiserWhiteDoorMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // White Door Panel
      roughness: 0.4,
      metalness: 0.5,
    });
    const bullBarMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.25,
      metalness: 0.95,
    });

    const createCruiserMesh = (isLeft: boolean): THREE.Group => {
      const cg = new THREE.Group();

      // Main Sedan Fuselage (Z extends forward into -Z)
      const bodyGeo = new THREE.BoxGeometry(1.65, 0.62, 3.4);
      const bodyMesh = new THREE.Mesh(bodyGeo, cruiserBodyMat);
      bodyMesh.position.set(0, 0.44, 0);
      cg.add(bodyMesh);

      // White Door Decal Panels
      for (const s of [-0.835, 0.835]) {
        const doorGeo = new THREE.BoxGeometry(0.02, 0.52, 1.4);
        const doorMesh = new THREE.Mesh(doorGeo, cruiserWhiteDoorMat);
        doorMesh.position.set(s, 0.44, 0);
        cg.add(doorMesh);
      }

      // Cabin Glass Greenhouse
      const cabinGeo = new THREE.BoxGeometry(1.4, 0.45, 1.6);
      const cabinMesh = new THREE.Mesh(
        cabinGeo,
        new THREE.MeshStandardMaterial({ color: 0x05070a, roughness: 0.1, metalness: 0.9 }),
      );
      cabinMesh.position.set(0, 0.88, 0.1);
      cg.add(cabinMesh);

      // Heavy Front Bull-Bar Push Bumper (at front of cruiser, Z = -1.75)
      const pushBarGeo = new THREE.BoxGeometry(1.35, 0.38, 0.14);
      const pushBar = new THREE.Mesh(pushBarGeo, bullBarMat);
      pushBar.position.set(0, 0.42, -1.75);
      cg.add(pushBar);

      // High-Beam Headlights (facing forward towards the speedster)
      for (const hx of [-0.62, 0.62]) {
        const headGeo = new THREE.CircleGeometry(0.12, 16);
        const headMesh = new THREE.Mesh(
          headGeo,
          new THREE.MeshBasicMaterial({ color: 0xfffbeb }),
        );
        headMesh.rotation.y = Math.PI;
        headMesh.position.set(hx, 0.46, -1.72);
        cg.add(headMesh);
      }

      // Roof Emergency Strobe Lightbar (Z = 0.1, Y = 1.15)
      const barMountGeo = new THREE.BoxGeometry(0.88, 0.04, 0.12);
      const barMount = new THREE.Mesh(barMountGeo, bullBarMat);
      barMount.position.set(0, 1.12, 0.1);
      cg.add(barMount);

      // Left Pod (Red) & Right Pod (Blue)
      const redPodGeo = new THREE.BoxGeometry(0.38, 0.08, 0.14);
      const redPod = new THREE.Mesh(
        redPodGeo,
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 3.5,
        }),
      );
      redPod.name = 'redStrobe';
      redPod.position.set(-0.24, 1.17, 0.1);
      cg.add(redPod);

      const bluePodGeo = new THREE.BoxGeometry(0.38, 0.08, 0.14);
      const bluePod = new THREE.Mesh(
        bluePodGeo,
        new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          emissive: 0x3b82f6,
          emissiveIntensity: 3.5,
        }),
      );
      bluePod.name = 'blueStrobe';
      bluePod.position.set(0.24, 1.17, 0.1);
      cg.add(bluePod);

      return cg;
    };

    // Cruiser 1: Close tailgater on Left (X = -1.6m, Z = +7.2m)
    this.cruiser1Group = createCruiserMesh(true);
    this.cruiser1Group.position.set(-1.6, 0, 7.2);
    this.threeScene.add(this.cruiser1Group);

    // Cruiser 2: Following tailgater on Right (X = +2.1m, Z = +12.0m)
    this.cruiser2Group = createCruiserMesh(false);
    this.cruiser2Group.position.set(2.1, 0, 12.0);
    this.threeScene.add(this.cruiser2Group);
  }

  // ---------------------------------------------------------------------------
  // Build: Bridge Roadblock & Launch Ramp (Exit Contract T4)
  // ---------------------------------------------------------------------------
  private buildRoadblockAndRamp() {
    this.roadblockGroup.name = 'roadblock_bridge_ramp';

    // Approaching steel approach ramp (hits around t = 67.0s - 67.13s)
    const rampWidth = 9.0;
    const rampLength = 14.0;
    const rampHeight = 1.6;

    // Wedge Geometry for the Bridge Approach Ramp
    const rampGeo = new THREE.BoxGeometry(rampWidth, 0.25, rampLength);
    rampGeo.rotateX(-0.11); // Incline ramp
    rampGeo.translate(0, 0.8, -rampLength / 2);

    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x22272e,
      roughness: 0.45,
      metalness: 0.85,
    });
    this.rampMesh = new THREE.Mesh(rampGeo, rampMat);
    this.roadblockGroup.add(this.rampMesh);

    // Flashing Yellow Construction Barricades flanking ramp
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
      metalness: 0.2,
    });
    for (const bx of [-5.2, 5.2]) {
      const bGeo = new THREE.BoxGeometry(0.8, 1.1, rampLength);
      const bMesh = new THREE.Mesh(bGeo, barrierMat);
      bMesh.position.set(bx, 0.6, -rampLength / 2);
      this.roadblockGroup.add(bMesh);

      // Warning strobe beacons
      for (let fz = 0; fz < rampLength; fz += 3.5) {
        const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 12);
        const beacon = new THREE.Mesh(
          beaconGeo,
          new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
        );
        beacon.position.set(bx, 1.25, -fz);
        this.roadblockGroup.add(beacon);
      }
    }

    // Position roadblock far ahead (-Z) initially, streams into place as t -> 67.13s
    this.roadblockGroup.position.set(0, 0, -280);
    this.threeScene.add(this.roadblockGroup);
  }

  // ---------------------------------------------------------------------------
  // Build: Rain Particle System (Windshield & High-Speed Stream)
  // ---------------------------------------------------------------------------
  private buildRainParticleSystem() {
    const rainCount = 2200;
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 22; // X
      positions[i * 3 + 1] = Math.random() * 8.5; // Y
      positions[i * 3 + 2] = -40 + Math.random() * 65; // Z
    }

    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.065,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.threeScene.add(this.rainParticles);
  }

  // ---------------------------------------------------------------------------
  // Build: Sparks Emitter (Triggered when chassis hits bridge ramp threshold)
  // ---------------------------------------------------------------------------
  private buildSparksEmitter() {
    const sparkCount = 350;
    const positions = new Float32Array(sparkCount * 3);

    for (let i = 0; i < sparkCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 1.6;
      positions[i * 3 + 1] = 0.08 + Math.random() * 0.4;
      positions[i * 3 + 2] = 0.5 + Math.random() * 2.5;
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.09,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });

    this.sparksParticles = new THREE.Points(sparkGeo, sparkMat);
    this.threeScene.add(this.sparksParticles);
  }

  // ---------------------------------------------------------------------------
  // Realtime Mirror Texture Canvas Painter
  // ---------------------------------------------------------------------------
  private updateMirrorCanvas(t: number, steerAngle: number) {
    const ctx = this.mirrorCtx;
    const w = 512;
    const h = 256;

    // Background: Dark rain-soaked highway receding behind car
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, w, h);

    // Vignette and convex mirror curvature gradient
    const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.6);
    grad.addColorStop(0, '#0c1322');
    grad.addColorStop(0.7, '#07090f');
    grad.addColorStop(1, '#020305');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Highway Lane Markings in Rearview Perspective
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Center divider receding to vanishing point (w/2, h*0.42)
    const vpX = w / 2 - steerAngle * 140;
    const vpY = h * 0.44;

    ctx.moveTo(vpX, vpY);
    ctx.lineTo(w / 2 - 120, h);
    ctx.stroke();

    ctx.moveTo(vpX, vpY);
    ctx.lineTo(w / 2 + 120, h);
    ctx.stroke();

    // Alternating Police Siren Flash Calculations (129.20 BPM sync)
    // BPM = 129.20 -> 2.153 Hz, 8th note strobe pulses (~4.3 Hz)
    const bpmFreq = (129.20 / 60.0) * Math.PI * 2;
    const strobePhase = Math.sin(t * bpmFreq * 4.0);
    const wigWag = Math.sin(t * bpmFreq);

    const redFlash = wigWag > 0 ? (strobePhase > 0.1 ? 1.0 : 0.05) : 0.02;
    const blueFlash = wigWag <= 0 ? (strobePhase > 0.1 ? 1.0 : 0.05) : 0.02;

    // Update 3D Point Lights intensity in cockpit in sync with mirror strobes
    this.policeRedLight.intensity = redFlash * 5.5;
    this.policeBlueLight.intensity = blueFlash * 5.5;

    // CRUISER 1 in Mirror (Close left lane, aggressive tailgater)
    const c1X = w * 0.38 + Math.sin(t * 2.8) * 35 - steerAngle * 90;
    const c1Y = h * 0.62;
    const c1Scale = 1.35;

    // Cruiser 1 Grille & Push Bumper silhouette
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(c1X - 44 * c1Scale, c1Y - 14 * c1Scale, 88 * c1Scale, 28 * c1Scale);

    // Cruiser 1 Headlights (Twin Blinding Halogens)
    const drawHeadlight = (x: number, y: number) => {
      const hGrad = ctx.createRadialGradient(x, y, 2, x, y, 22 * c1Scale);
      hGrad.addColorStop(0, '#ffffff');
      hGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.85)');
      hGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.arc(x, y, 22 * c1Scale, 0, Math.PI * 2);
      ctx.fill();
    };
    drawHeadlight(c1X - 30 * c1Scale, c1Y + 2);
    drawHeadlight(c1X + 30 * c1Scale, c1Y + 2);

    // Cruiser 1 Rooftop Strobe Lightbar (Intense Flashing Crimson & Cobalt)
    const barY = c1Y - 26 * c1Scale;

    // Red Left Strobe
    ctx.fillStyle = `rgba(239, 68, 68, ${redFlash})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = redFlash * 25;
    ctx.fillRect(c1X - 28 * c1Scale, barY, 24 * c1Scale, 9 * c1Scale);

    // Blue Right Strobe
    ctx.fillStyle = `rgba(59, 130, 246, ${blueFlash})`;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = blueFlash * 25;
    ctx.fillRect(c1X + 4 * c1Scale, barY, 24 * c1Scale, 9 * c1Scale);
    ctx.shadowBlur = 0;

    // CRUISER 2 in Mirror (Trailing in right lane)
    const c2X = w * 0.68 + Math.cos(t * 2.3) * 28 - steerAngle * 70;
    const c2Y = h * 0.52;
    const c2Scale = 0.85;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(c2X - 36 * c2Scale, c2Y - 10 * c2Scale, 72 * c2Scale, 22 * c2Scale);

    drawHeadlight(c2X - 24 * c2Scale, c2Y + 2);
    drawHeadlight(c2X + 24 * c2Scale, c2Y + 2);

    // Cruiser 2 Strobe Lightbar (Alternating opposite pattern)
    const bar2Y = c2Y - 20 * c2Scale;
    ctx.fillStyle = `rgba(59, 130, 246, ${redFlash})`; // inverted for wig-wag realism
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = redFlash * 18;
    ctx.fillRect(c2X - 22 * c2Scale, bar2Y, 18 * c2Scale, 7 * c2Scale);

    ctx.fillStyle = `rgba(239, 68, 68, ${blueFlash})`;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = blueFlash * 18;
    ctx.fillRect(c2X + 4 * c2Scale, bar2Y, 18 * c2Scale, 7 * c2Scale);
    ctx.shadowBlur = 0;

    // Mirror Glass Rain Droplets & Streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let r = 0; r < 24; r++) {
      const rx = (r * 37 + t * 40) % w;
      const ry = (r * 19 + Math.sin(r + t * 3) * 15) % h;
      ctx.beginPath();
      ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mirror Edge Bezel Darkness
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, w, h);

    this.mirrorTexture.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // Continuous Deterministic Camera Trajectory Solver
  // ---------------------------------------------------------------------------
  private getCameraState(t: number): {
    pos: [number, number, number];
    target: [number, number, number];
    fov: number;
  } {
    // T3 Entry Anchor: 50.46s -> pos: [-0.08, 0.56, 0.18], target: [0.0, 0.58, -0.38], fov: 44.0
    // T4 Exit Anchor: 67.13s -> pos: [0.0, 2.2, 7.5], target: [0.0, 1.0, -15.0], fov: 55.0

    // Phase 0: Incoming Overlap (49.96s <= t < 50.46s)
    // Continuous backward extrapolation along velocity [0.0, 0.1, -1.5]
    if (t < 50.46) {
      const dt = t - 50.46; // negative
      return {
        pos: [-0.08, 0.56 + 0.1 * dt, 0.18 - 1.5 * dt],
        target: [0.0, 0.58, -0.38],
        fov: 44.0,
      };
    }

    // Phase 1: Line 16 ("Can you feel the heat? 5-0 on our feet", 50.46s - 54.50s)
    // Camera tilts up from driver's forearm gripping steering wheel to frame rearview mirror & dice
    if (t <= 54.5) {
      const u = ease.inOutCubic((t - 50.46) / (54.5 - 50.46));
      return {
        pos: [
          lerp(-0.08, -0.06, u),
          lerp(0.56, 0.65, u),
          lerp(0.18, 0.25, u),
        ],
        target: [
          0.0,
          lerp(0.58, 0.64, u),
          -0.38,
        ],
        fov: lerp(44.0, 42.0, u),
      };
    }

    // Phase 2: Line 17 ("Dice up in the mirror, lucky charms", 54.50s - 58.60s)
    // Macro close-up on swinging fuzzy dice in harmonic resonance with mirror sirens in background
    if (t <= 58.6) {
      const u = ease.inOutCubic((t - 54.5) / (58.6 - 54.5));
      return {
        pos: [
          lerp(-0.06, 0.04, u),
          lerp(0.65, 0.65, u),
          lerp(0.25, 0.10, u),
        ],
        target: [
          0.0,
          lerp(0.64, 0.63, u),
          lerp(-0.38, -0.39, u),
        ],
        fov: lerp(42.0, 38.0, u),
      };
    }

    // Phase 3: Line 18 ("Said we'd go down swinging...", 58.60s - 63.00s)
    // Action driving camera: pulls back slightly to show dynamic counter-steering & rain on glass
    if (t <= 63.0) {
      const u = ease.inOutCubic((t - 58.6) / (63.0 - 58.6));
      return {
        pos: [
          lerp(0.04, -0.16, u),
          lerp(0.65, 0.62, u),
          lerp(0.10, 0.38, u),
        ],
        target: [
          0.0,
          lerp(0.63, 0.54, u),
          lerp(-0.39, -0.52, u),
        ],
        fov: lerp(38.0, 45.0, u),
      };
    }

    // Phase 4: Line 19 ("Do or die, I'll be in your arms", 63.00s - 65.20s)
    // Centering between bucket seats as car accelerates towards bridge approach
    if (t <= 65.2) {
      const u = ease.inOutCubic((t - 63.0) / (65.2 - 63.0));
      return {
        pos: [
          lerp(-0.16, 0.0, u),
          lerp(0.62, 0.68, u),
          lerp(0.38, 0.55, u),
        ],
        target: [
          0.0,
          lerp(0.54, 0.52, u),
          lerp(-0.52, -2.5, u),
        ],
        fov: lerp(45.0, 48.0, u),
      };
    }

    // Phase 5: Reverse Whip Pullout towards T4 Exit Contract (65.20s - 67.13s)
    // Reverse whip pullout between bucket seats, through rear window, soaring above boattail deck!
    if (t <= 67.13) {
      const u = ease.inCubic((t - 65.2) / (67.13 - 65.2));
      return {
        pos: [
          0.0,
          lerp(0.68, 2.2, u),
          lerp(0.55, 7.5, u),
        ],
        target: [
          0.0,
          lerp(0.52, 1.0, u),
          lerp(-2.5, -15.0, u),
        ],
        fov: lerp(48.0, 55.0, u),
      };
    }

    // Phase 6: Outgoing Overlap (67.13s <= t <= 67.63s)
    // Continuous extrapolation along exit velocity [0.0, 1.2, 18.0]
    const dt = t - 67.13;
    return {
      pos: [0.0, 2.2 + 1.2 * dt, 7.5 + 18.0 * dt],
      target: [0.0, 1.0, -15.0],
      fov: 55.0,
    };
  }

  // ---------------------------------------------------------------------------
  // Main Render Pass (Deterministic f(t))
  // ---------------------------------------------------------------------------
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const t = f.t;

    // -------------------------------------------------------------
    // A. Vehicle Physics & Motion Kinematics
    // -------------------------------------------------------------
    // Speed increases from 32 m/s (~72 MPH) to 52 m/s (~116 MPH)
    const speedProgress = clamp((t - 49.96) / (67.13 - 49.96), 0, 1);
    const speed = lerp(32.0, 52.0, speedProgress);

    // Dynamic Counter-Steering Angle
    let steerAngle = 0.0;
    if (t < 54.5) {
      steerAngle = Math.sin(t * 1.8) * 0.04;
    } else if (t < 58.6) {
      steerAngle = Math.sin(t * 2.2) * 0.08;
    } else if (t < 63.0) {
      // Violent chicane evasion ("go down swinging")
      steerAngle =
        Math.sin((t - 58.6) * 3.6) * 0.28 + Math.cos((t - 58.6) * 1.8) * 0.12;
    } else {
      // Line up with bridge ramp center
      const rampAlign = clamp((t - 63.0) / 2.0, 0, 1);
      steerAngle = Math.sin(t * 3.0) * 0.1 * (1.0 - rampAlign);
    }

    // Enhanced Dice Swing Strength during Line 17 ("Dice up in the mirror")
    let diceSwingStrength = 1.0;
    if (t >= 54.5 && t <= 58.6) {
      diceSwingStrength = 1.65;
    } else if (t > 58.6 && t <= 63.0) {
      diceSwingStrength = 2.2; // violent swings during chicane
    }

    // Update Speedster Vehicle Model Rig
    this.vehicle.setVisibility({ seats: t >= 65.2 });
    this.vehicle.update({
      t,
      speed,
      steerAngle,
      diceSwingStrength,
      engineVibe: 0.0035 + (speed / 50.0) * 0.003,
      headlightsOn: true,
    });

    // Update Forearm Rig slightly following steering wheel rotation
    this.driverForearmGroup.rotation.z = -steerAngle * 0.85;

    // Bridge Ramp Impact & Suspension Pitch (as t -> 67.13s)
    let rampPitch = 0.0;
    let rampY = 0.0;
    if (t >= 66.8 && t <= 67.3) {
      const rampHit = (t - 66.8) / 0.33;
      rampPitch = -Math.sin(rampHit * Math.PI) * 0.14; // nose rises
      rampY = Math.sin(rampHit * Math.PI) * 0.35;
      this.vehicle.root.position.set(0, rampY, 0);
      this.vehicle.root.rotation.x = rampPitch;

      // Ignite golden sparks under chassis
      (this.sparksParticles.material as THREE.PointsMaterial).opacity = 0.95;
    } else {
      this.vehicle.root.position.set(0, 0, 0);
      this.vehicle.root.rotation.x = 0;
      (this.sparksParticles.material as THREE.PointsMaterial).opacity = 0.0;
    }

    // -------------------------------------------------------------
    // B. Moving World Highway & Environment Streaming (+Z direction)
    // -------------------------------------------------------------
    // Continuous distance integral for jitter-free modulo wrapping
    const dist = t * speed;

    // 1. Streaming Lane Dashes
    const dashSpacing = 8.0;
    const laneDashTotalLength = 18 * dashSpacing;
    this.laneDashesGroup.children.forEach((c) => {
      const mesh = c as THREE.Mesh;
      const baseZ = mesh.userData.baseZ as number;
      const wrappedZ = (((baseZ + dist) % laneDashTotalLength) + laneDashTotalLength) % laneDashTotalLength - 80;
      mesh.position.z = wrappedZ;
    });

    // 2. Streaming Gantries
    const gantryTotalSpan = 150.0;
    this.gantriesGroup.children.forEach((c) => {
      const g = c as THREE.Group;
      const baseZ = g.userData.baseZ as number;
      const wrappedZ = (((baseZ + dist * 0.85) % gantryTotalSpan) + gantryTotalSpan) % gantryTotalSpan - 120;
      g.position.z = wrappedZ;
    });

    // 3. Streaming Street Lamps
    const lampTotalSpan = 140.0;
    this.streetLampsGroup.children.forEach((c) => {
      const lg = c as THREE.Group;
      const baseZ = lg.userData.baseZ as number;
      const wrappedZ = (((baseZ + dist) % lampTotalSpan) + lampTotalSpan) % lampTotalSpan - 90;
      lg.position.z = wrappedZ;
    });

    // Overhead streetlamp spotlight sweep across cockpit
    const nearestLampZ = (dist % 24) - 12;
    if (Math.abs(nearestLampZ) < 6.0) {
      const lampPulse = 1.0 - Math.abs(nearestLampZ) / 6.0;
      this.streetLampOverheadLight.intensity = lampPulse * 2.8;
      this.streetLampOverheadLight.position.z = nearestLampZ;
    } else {
      this.streetLampOverheadLight.intensity = 0.0;
    }

    // 4. Moving Rain Particles
    const rainPositions = this.rainParticles.geometry.attributes.position.array as Float32Array;
    const rainCount = rainPositions.length / 3;
    const rainSpeedZ = speed * 1.8;
    for (let i = 0; i < rainCount; i++) {
      let rz = rainPositions[i * 3 + 2]! + f.dt * rainSpeedZ;
      let ry = rainPositions[i * 3 + 1]! - f.dt * 14.0;
      if (rz > 35) rz -= 80;
      if (ry < 0) ry += 8.5;
      rainPositions[i * 3 + 2] = rz;
      rainPositions[i * 3 + 1] = ry;
    }
    this.rainParticles.geometry.attributes.position.needsUpdate = true;

    // 5. Approaching Bridge Roadblock & Ramp (Active towards end of scene)
    if (t >= 63.5) {
      // Streams from -200 towards Z = 0 at t = 67.13s
      const timeToCut = 67.13 - t;
      const rampZ = -timeToCut * speed;
      this.roadblockGroup.position.z = rampZ;
    } else {
      this.roadblockGroup.position.z = -280;
    }

    // 6. Pursuit Police Cruisers Dynamic Swerving (Behind car at +Z)
    this.cruiser1Group.position.x = -1.6 + Math.sin(t * 2.8) * 0.6 + steerAngle * 0.4;
    this.cruiser1Group.position.z = 7.2 + Math.cos(t * 1.5) * 0.5;
    this.cruiser1Group.rotation.y = -Math.sin(t * 2.8) * 0.08;

    this.cruiser2Group.position.x = 2.1 + Math.cos(t * 2.3) * 0.8 + steerAngle * 0.3;
    this.cruiser2Group.position.z = 12.0 + Math.sin(t * 1.9) * 0.8;
    this.cruiser2Group.rotation.y = Math.cos(t * 2.3) * 0.07;

    // -------------------------------------------------------------
    // C. Dynamic Rearview Mirror Update
    // -------------------------------------------------------------
    this.updateMirrorCanvas(t, steerAngle);

    // -------------------------------------------------------------
    // D. Camera Positioning (Contract T3 -> T4)
    // -------------------------------------------------------------
    const camState = this.getCameraState(t);
    this.camera.position.set(...camState.pos);
    this.camera.lookAt(camState.target[0], camState.target[1], camState.target[2]);
    this.camera.fov = camState.fov;
    this.camera.updateProjectionMatrix();

    // -------------------------------------------------------------
    // E. 3D Kinetic Typography (HUD Windshield Projection)
    // -------------------------------------------------------------
    this.layer2d.clear();
    const ctx2d = this.layer2d.ctx;

    // Line 16: "Can you feel the heat? 5-0 on our feet" (50.46s - 54.50s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.66, -0.42],
      cam: this.camera,
      t,
      lineIdx: 16,
      fontSize: 44,
      fontFamily: 'GeistMono, Space Mono, Archivo, monospace, sans-serif',
      baseColor: 'rgba(186, 230, 253, 0.42)',
      highlightColor: '#00e5ff',
      haloColor: 'rgba(4, 9, 20, 0.92)',
      yOffsetPx: -35,
    });

    // Line 17: "Dice up in the mirror, lucky charms" (54.50s - 58.60s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.72, -0.40],
      cam: this.camera,
      t,
      lineIdx: 17,
      fontSize: 46,
      fontFamily: 'GeistMono, Space Mono, Archivo, monospace, sans-serif',
      baseColor: 'rgba(254, 240, 138, 0.45)',
      highlightColor: '#fbbf24',
      haloColor: 'rgba(4, 9, 20, 0.92)',
      yOffsetPx: -45,
    });

    // Line 18: "Said we'd go down swinging, time to show 'em what we're thinking" (58.60s - 63.00s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.65, -0.44],
      cam: this.camera,
      t,
      lineIdx: 18,
      fontSize: 40,
      fontFamily: 'Archivo, system-ui, sans-serif',
      baseColor: 'rgba(186, 230, 253, 0.45)',
      highlightColor: '#38bdf8',
      haloColor: 'rgba(4, 9, 20, 0.95)',
      yOffsetPx: -20,
    });

    // Line 19: "Do or die, I'll be in your arms" (63.00s - 67.13s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.68, -0.44],
      cam: this.camera,
      t,
      lineIdx: 19,
      fontSize: 46,
      fontFamily: 'Archivo, system-ui, sans-serif',
      baseColor: 'rgba(244, 114, 182, 0.45)',
      highlightColor: '#f43f5e',
      haloColor: 'rgba(4, 9, 20, 0.95)',
      yOffsetPx: -30,
    });

    this.layer2d.upload();

    // -------------------------------------------------------------
    // F. Render Passes & 2D Compositing
    // -------------------------------------------------------------
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    // Composite HUD kinetic lyric layer over 3D cockpit
    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // -------------------------------------------------------------
    // G. Optical Post-Processing Overrides
    // -------------------------------------------------------------
    return {
      exposure: 1.10,
      bloom: 0.42,
      bloomRadius: 0.60,
      bloomThreshold: 0.85,
      halation: 0.22,
      ca: 1.1,
      grain: 0.05,
      vignette: 0.38,
    };
  }
}

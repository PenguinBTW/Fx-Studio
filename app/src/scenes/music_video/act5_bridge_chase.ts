// ACT V: THE CANYON BRIDGE CHASE & ABYSS LEAP (66.63s - 97.61s, Nominal Cut: 97.11s)
// Music Video: "No Takebacks" (Forrest Nolan)
// BPM: 129.20 | Bar 37.0 - 53.0 | Lines 20 - 29
//
// Entry Transition Contract T4 (67.13s):
//   pos: [0.0, 2.2, 7.5], target: [0.0, 1.0, -15.0], velocity: [0.0, 1.2, 18.0], fov: 55.0
//   apertureAnchor: 'cockpit_rear_window_pullout'
//
// Exit Transition Contract T5 (Nominal Seam: 97.11s):
//   pos: [-8.0, 2.0, 0.0], target: [0.0, 1.5, 0.0], velocity: [0.0, 0.0, -38.0], fov: 48.0
//   apertureAnchor: 'barricade_splinter_wipe'
//
// Visual Mechanics & Moving World:
//   - Roadster physics anchored with realistic aerodynamic pitch, roll, and suspension dynamics
//   - Canyon walls, bridge trusses, gantry arches, and volumetric fog stream past at high speed (~48 m/s)
//   - 36-spoke wire wheels spinning furiously with trailing hot magnesium sparks
//   - Aerodynamic twin-vortex cash storm: 320 swirling banknotes streaming from cockpit into the abyss
//   - 4 sweeping volumetric searchlight cones cutting through dark blue mist with police strobes
//   - Highway gantry typography with LyricRig, optical size clamping, and knockout halos

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { createVehicleModel, type VehicleModelRig } from './shared/vehicle_model';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease, lerp, smoothstep } from '../../engine/util';

// Constant parameters
const SPEED_MPS = 48.0; // Forward roadster speed (~107 mph)
const LAUNCH_TIME = 67.13;
const LAND_TIME = 97.11;
const LEAP_DUR = LAND_TIME - LAUNCH_TIME; // 29.98s
const CANYON_PERIOD = 240.0; // Looping period for streamed canyon environment

interface SplinterData {
  mesh: THREE.Mesh;
  v0: THREE.Vector3;
  rotAxis: THREE.Vector3;
  rotSpeed: number;
}

interface BanknoteData {
  baseOffset: THREE.Vector3;
  spiralRadius: number;
  spiralPhase: number;
  spiralFreq: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export default class Act5BridgeChase extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // Vehicle Rig
  private vehicle: VehicleModelRig;
  private carGroup = new THREE.Group();

  // Moving World Groups
  private canyonWorldGroup = new THREE.Group();
  private bridgeApproachGroup = new THREE.Group();
  private saltFlatsGroup = new THREE.Group();

  // Modular streamed structures
  private cliffMeshes: THREE.Mesh[] = [];
  private trussTowers: THREE.Group[] = [];
  private gantryArches: THREE.Group[] = [];
  private fogPlanes: THREE.Mesh[] = [];

  // Searchlights
  private searchlightBeams: THREE.Mesh[] = [];
  private searchlightTargets: THREE.Vector3[] = [];
  private policeLightRed: THREE.PointLight;
  private policeLightBlue: THREE.PointLight;
  private canyonMoonLight: THREE.DirectionalLight;
  private horizonRimLight: THREE.DirectionalLight;
  private carHeadlightL: THREE.SpotLight;
  private carHeadlightR: THREE.SpotLight;

  // Particle Systems
  private barricadeSplinters: SplinterData[] = [];
  private splintersGroup = new THREE.Group();

  // Swirling Banknotes Vortex (Instanced)
  private banknoteMesh: THREE.InstancedMesh;
  private banknoteCount = 320;
  private banknoteData: BanknoteData[] = [];
  private dummyObj = new THREE.Object3D();

  // Friction Sparks (Points)
  private sparkPoints: THREE.Points;
  private sparkCount = 420;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkLifeOffsets: Float32Array;

  // Taillight streak planes
  private taillightStreakGroup = new THREE.Group();
  private taillightLeftRibbon: THREE.Mesh;
  private taillightRightRibbon: THREE.Mesh;

  // Distant Neon Horizon & Sky Dome
  private horizonDome: THREE.Mesh;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 2500);
    this.layer2d = new Layer2D(W, H);

    // Deep volumetric night abyss background
    this.threeScene.background = new THREE.Color(COLOR_TOKENS.VOLUMETRIC_FOG);
    this.threeScene.fog = new THREE.FogExp2(0x0c111a, 0.0075);

    // -------------------------------------------------------------
    // 1. Lighting Setup
    // -------------------------------------------------------------
    // Ambient canyon fill - lifted so canyon rock walls, abyss, and bridge trusses silhouette clearly
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
    this.threeScene.add(ambientLight);

    // Moonlight key light from high above
    this.canyonMoonLight = new THREE.DirectionalLight(0xcfd8dc, 2.2);
    this.canyonMoonLight.position.set(-30, 60, 20);
    this.threeScene.add(this.canyonMoonLight);

    // Electric cyan horizon rim backlight from far -Z
    this.horizonRimLight = new THREE.DirectionalLight(0x38bdf8, 2.6);
    this.horizonRimLight.position.set(0, 15, -120);
    this.threeScene.add(this.horizonRimLight);

    // Police strobe beacon lights
    this.policeLightRed = new THREE.PointLight(0xef4444, 0, 80);
    this.policeLightRed.position.set(-6, 8, 25);
    this.threeScene.add(this.policeLightRed);

    this.policeLightBlue = new THREE.PointLight(0x3b82f6, 0, 80);
    this.policeLightBlue.position.set(6, 8, 25);
    this.threeScene.add(this.policeLightBlue);

    // -------------------------------------------------------------
    // 2. Roadster Vehicle Rig
    // -------------------------------------------------------------
    this.vehicle = createVehicleModel();
    this.vehicle.showFullExterior();

    this.carGroup.add(this.vehicle.root);
    this.threeScene.add(this.carGroup);

    // Vehicle Headlight Spotlights
    const spotTargetL = new THREE.Object3D();
    spotTargetL.position.set(-0.65, 0.3, -40);
    this.carGroup.add(spotTargetL);

    this.carHeadlightL = new THREE.SpotLight(0xfef08a, 4.0, 80, Math.PI / 7, 0.4, 1.0);
    this.carHeadlightL.position.set(-0.65, 0.44, -2.4);
    this.carHeadlightL.target = spotTargetL;
    this.carGroup.add(this.carHeadlightL);

    const spotTargetR = new THREE.Object3D();
    spotTargetR.position.set(0.65, 0.3, -40);
    this.carGroup.add(spotTargetR);

    this.carHeadlightR = new THREE.SpotLight(0xfef08a, 4.0, 80, Math.PI / 7, 0.4, 1.0);
    this.carHeadlightR.position.set(0.65, 0.44, -2.4);
    this.carHeadlightR.target = spotTargetR;
    this.carGroup.add(this.carHeadlightR);

    // Taillight streak ribbons
    const ribbonGeo = new THREE.PlaneGeometry(0.18, 14.0);
    ribbonGeo.rotateX(-Math.PI / 2);
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.taillightLeftRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.taillightLeftRibbon.position.set(-0.55, 0.45, 9.5);
    this.carGroup.add(this.taillightLeftRibbon);

    this.taillightRightRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.taillightRightRibbon.position.set(0.55, 0.45, 9.5);
    this.carGroup.add(this.taillightRightRibbon);

    // -------------------------------------------------------------
    // 3. Moving World Architecture (Canyon, Bridge, Gantries)
    // -------------------------------------------------------------
    this.threeScene.add(this.canyonWorldGroup);

    // Distant Neon Horizon Backdrop (Full panoramic sphere dome)
    const horizonGeo = new THREE.SphereGeometry(700, 32, 16);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x070b14,
      side: THREE.BackSide,
    });
    this.horizonDome = new THREE.Mesh(horizonGeo, horizonMat);
    this.horizonDome.position.set(0, 0, 0);
    this.threeScene.add(this.horizonDome);

    // Monumental Canyon Cliffs (Modular stepped basalt columns)
    const cliffMatLeft = new THREE.MeshStandardMaterial({
      color: 0x151b23,
      roughness: 0.9,
      metalness: 0.15,
      flatShading: true,
    });
    const cliffMatRight = new THREE.MeshStandardMaterial({
      color: 0x11161d,
      roughness: 0.92,
      metalness: 0.12,
      flatShading: true,
    });

    const cliffCount = 14;
    for (let i = 0; i < cliffCount; i++) {
      const zBase = (i / cliffCount) * CANYON_PERIOD - CANYON_PERIOD / 2;
      const h = 70 + Math.sin(i * 1.7) * 20;

      // Left cliff tower
      const geoL = new THREE.BoxGeometry(22, h, 20 + Math.sin(i * 2.3) * 6);
      const meshL = new THREE.Mesh(geoL, cliffMatLeft);
      meshL.position.set(-36 - Math.cos(i * 0.8) * 6, -20 + h / 2 - 40, zBase);
      this.canyonWorldGroup.add(meshL);
      this.cliffMeshes.push(meshL);

      // Right cliff tower
      const geoR = new THREE.BoxGeometry(22, h + 10, 20 + Math.cos(i * 1.9) * 6);
      const meshR = new THREE.Mesh(geoR, cliffMatRight);
      meshR.position.set(36 + Math.sin(i * 0.9) * 6, -20 + (h + 10) / 2 - 40, zBase);
      this.canyonWorldGroup.add(meshR);
      this.cliffMeshes.push(meshR);
    }

    // Steel Bridge Truss Towers (Brutalist rust steel)
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.8,
      metalness: 0.45,
    });

    for (let i = 0; i < 6; i++) {
      const trussGroup = new THREE.Group();
      const zBase = (i / 6) * CANYON_PERIOD - CANYON_PERIOD / 2;

      // Left & right pylon columns
      for (const s of [-1, 1]) {
        const colGeo = new THREE.BoxGeometry(2.4, 90, 2.4);
        const colMesh = new THREE.Mesh(colGeo, trussMat);
        colMesh.position.set(s * 15.0, 10, 0);
        trussGroup.add(colMesh);

        // Diagonal cross braces
        for (let b = 0; b < 4; b++) {
          const braceGeo = new THREE.BoxGeometry(0.8, 18, 0.8);
          const brace = new THREE.Mesh(braceGeo, trussMat);
          brace.position.set(s * 15.0, -15 + b * 16, 0);
          brace.rotation.z = s * 0.55 * (b % 2 === 0 ? 1 : -1);
          trussGroup.add(brace);
        }

        // Red aviation warning beacon at tower tip
        const beaconGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(s * 15.0, 55, 0);
        trussGroup.add(beacon);
      }

      // Arch cross-beam spanning the abyss
      const archGeo = new THREE.BoxGeometry(32.4, 3.2, 3.2);
      const arch = new THREE.Mesh(archGeo, trussMat);
      arch.position.set(0, 52, 0);
      trussGroup.add(arch);

      // Hanging severed suspension cables
      for (let c = -10; c <= 10; c += 5) {
        const cableGeo = new THREE.CylinderGeometry(0.06, 0.06, 35, 6);
        const cable = new THREE.Mesh(cableGeo, trussMat);
        cable.position.set(c, 25, 0);
        cable.rotation.z = Math.sin(c * 1.5) * 0.12;
        trussGroup.add(cable);
      }

      trussGroup.position.set(0, 0, zBase);
      this.canyonWorldGroup.add(trussGroup);
      this.trussTowers.push(trussGroup);
    }

    // Overhead Highway Gantries with Digital Directional Signage
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x272a30,
      metalness: 0.7,
      roughness: 0.35,
    });
    const signMat = new THREE.MeshBasicMaterial({
      color: 0x064e3b,
    });

    for (let i = 0; i < 4; i++) {
      const gantryGroup = new THREE.Group();
      const zBase = (i / 4) * CANYON_PERIOD - CANYON_PERIOD / 2;

      // Two side posts
      for (const s of [-1, 1]) {
        const postGeo = new THREE.CylinderGeometry(0.3, 0.3, 11, 8);
        const post = new THREE.Mesh(postGeo, gantryMat);
        post.position.set(s * 9.5, 5.0, 0);
        gantryGroup.add(post);
      }

      // Overhead truss bar
      const barGeo = new THREE.BoxGeometry(20.0, 1.2, 1.2);
      const bar = new THREE.Mesh(barGeo, gantryMat);
      bar.position.set(0, 10.0, 0);
      gantryGroup.add(bar);

      // Highway Signboard
      const boardGeo = new THREE.BoxGeometry(9.0, 2.4, 0.2);
      const board = new THREE.Mesh(boardGeo, signMat);
      board.position.set(0, 9.8, 0.6);
      gantryGroup.add(board);

      // Amber flasher on sign corner
      const flasherGeo = new THREE.SphereGeometry(0.2, 8, 8);
      const flasherMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
      const flasher = new THREE.Mesh(flasherGeo, flasherMat);
      flasher.position.set(-4.2, 11.2, 0.6);
      gantryGroup.add(flasher);

      gantryGroup.position.set(0, 0, zBase);
      this.canyonWorldGroup.add(gantryGroup);
      this.gantryArches.push(gantryGroup);
    }

    // Deep Canyon Volumetric Fog Sheets
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0x101726,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (let i = 0; i < 8; i++) {
      const planeGeo = new THREE.PlaneGeometry(120, 45);
      planeGeo.rotateX(-Math.PI / 2);
      const fogMesh = new THREE.Mesh(planeGeo, fogMat);
      fogMesh.position.set(
        (Math.sin(i * 1.4) - 0.5) * 20,
        -16 - i * 4.5,
        (i / 8) * CANYON_PERIOD - CANYON_PERIOD / 2,
      );
      this.canyonWorldGroup.add(fogMesh);
      this.fogPlanes.push(fogMesh);
    }

    // -------------------------------------------------------------
    // 4. Broken Bridge Approach & Barricade (Launch Ramp at 67.13s)
    // -------------------------------------------------------------
    this.threeScene.add(this.bridgeApproachGroup);

    // Bridge deck roadbed (stretches backwards from Z = 0)
    const roadGeo = new THREE.BoxGeometry(16.0, 2.2, 120.0);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      roughness: 0.9,
      metalness: 0.1,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, -1.1, 60.0);
    this.bridgeApproachGroup.add(roadMesh);

    // Asphalt hazard yellow double line
    const stripeGeo = new THREE.PlaneGeometry(0.3, 120.0);
    stripeGeo.rotateX(-Math.PI / 2);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const stripeL = new THREE.Mesh(stripeGeo, stripeMat);
    stripeL.position.set(-0.25, 0.02, 60.0);
    this.bridgeApproachGroup.add(stripeL);
    const stripeR = new THREE.Mesh(stripeGeo, stripeMat);
    stripeR.position.set(0.25, 0.02, 60.0);
    this.bridgeApproachGroup.add(stripeR);

    // Guardrails with twisted fracture at the precipice (Z = 0)
    for (const s of [-1, 1]) {
      const railGeo = new THREE.BoxGeometry(0.4, 0.9, 120.0);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(s * 7.6, 0.65, 60.0);
      this.bridgeApproachGroup.add(rail);

      // Twisted bent section at launch edge
      const twistedGeo = new THREE.BoxGeometry(0.4, 0.9, 8.0);
      const twisted = new THREE.Mesh(twistedGeo, railMat);
      twisted.position.set(s * 8.2, 1.4, 2.0);
      twisted.rotation.y = s * 0.35;
      twisted.rotation.x = -0.25;
      this.bridgeApproachGroup.add(twisted);
    }

    // Fractured jagged steel I-beams sticking out into abyss
    for (let b = -6; b <= 6; b += 2) {
      const beamGeo = new THREE.BoxGeometry(0.5, 0.8, 4.0 + Math.abs(b) * 0.5);
      const beam = new THREE.Mesh(beamGeo, trussMat);
      beam.position.set(b, -0.6, -1.0);
      beam.rotation.x = 0.15;
      this.bridgeApproachGroup.add(beam);
    }

    // Exploding Wooden Barricade Splinters
    this.threeScene.add(this.splintersGroup);
    const splinterMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      metalness: 0.1,
    });
    const stripeSplinterMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.6,
      metalness: 0.2,
    });

    const splinterCount = 42;
    for (let i = 0; i < splinterCount; i++) {
      const w = 0.12 + (i % 3) * 0.08;
      const h = 0.15 + (i % 4) * 0.12;
      const d = 0.8 + (i % 5) * 0.45;
      const sGeo = new THREE.BoxGeometry(w, h, d);
      const sMesh = new THREE.Mesh(sGeo, i % 2 === 0 ? splinterMat : stripeSplinterMat);

      // Initial resting position at the barricade gate (Z = 0.5)
      sMesh.position.set((Math.random() - 0.5) * 8.0, 0.3 + Math.random() * 1.5, 0.5);
      this.splintersGroup.add(sMesh);

      // Explosive dispersal velocity
      const ang = Math.random() * Math.PI * 2;
      const spd = 14.0 + Math.random() * 26.0;
      const v0 = new THREE.Vector3(
        Math.cos(ang) * (spd * 0.75),
        3.0 + Math.random() * 16.0,
        -15.0 - Math.random() * 28.0, // Blown forward along leap path
      );
      const rotAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const rotSpeed = 8.0 + Math.random() * 18.0;

      this.barricadeSplinters.push({ mesh: sMesh, v0, rotAxis, rotSpeed });
    }

    // -------------------------------------------------------------
    // 5. Volumetric Additive Searchlight Cones
    // -------------------------------------------------------------
    const coneGeo = new THREE.CylinderGeometry(0.8, 18.0, 120.0, 32, 1, true);
    coneGeo.rotateX(Math.PI / 2); // Orient forward along Z
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const searchlightConfigs = [
      { x: -32, y: 35, z: -25 }, // Left canyon rim tower
      { x: 30, y: 38, z: -10 },  // Right canyon rim tower
      { x: -8, y: 22, z: 45 },   // Trailing police pursuit helicopter
      { x: 12, y: -45, z: -35 }, // Bottom canyon abyss battery
    ];

    for (let i = 0; i < searchlightConfigs.length; i++) {
      const cfg = searchlightConfigs[i]!;
      const beam = new THREE.Mesh(coneGeo, coneMat);
      beam.position.set(cfg.x, cfg.y, cfg.z);
      this.threeScene.add(beam);
      this.searchlightBeams.push(beam);
      this.searchlightTargets.push(new THREE.Vector3(0, 1.5, 0));
    }

    // -------------------------------------------------------------
    // 6. Swirling Banknotes Vortex (Currency Green Bill InstancedMesh)
    // -------------------------------------------------------------
    const billGeo = new THREE.PlaneGeometry(0.32, 0.16);
    const billMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    this.banknoteMesh = new THREE.InstancedMesh(billGeo, billMat, this.banknoteCount);
    this.banknoteMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.threeScene.add(this.banknoteMesh);

    for (let i = 0; i < this.banknoteCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      this.banknoteData.push({
        baseOffset: new THREE.Vector3(side * (0.35 + Math.random() * 0.4), 0.45 + Math.random() * 0.35, 1.2),
        spiralRadius: 0.6 + Math.random() * 2.2,
        spiralPhase: Math.random() * Math.PI * 2,
        spiralFreq: 2.2 + Math.random() * 3.4,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
      });
    }

    // -------------------------------------------------------------
    // 7. Friction Sparks Particle System
    // -------------------------------------------------------------
    this.sparkPositions = new Float32Array(this.sparkCount * 3);
    this.sparkVelocities = new Float32Array(this.sparkCount * 3);
    this.sparkLifeOffsets = new Float32Array(this.sparkCount);

    for (let i = 0; i < this.sparkCount; i++) {
      this.sparkLifeOffsets[i] = Math.random() * 2.0;
      this.sparkVelocities[i * 3 + 0] = (Math.random() - 0.5) * 5.0;
      this.sparkVelocities[i * 3 + 1] = Math.random() * 4.5 + 0.5;
      this.sparkVelocities[i * 3 + 2] = 25.0 + Math.random() * 25.0; // Stream backwards
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.28,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.sparkPoints = new THREE.Points(sparkGeo, sparkMat);
    this.threeScene.add(this.sparkPoints);

    // -------------------------------------------------------------
    // 8. Salt Flats Touchdown Landing Zone (Emerges near 97.11s)
    // -------------------------------------------------------------
    this.threeScene.add(this.saltFlatsGroup);
    const saltGeo = new THREE.PlaneGeometry(160, 240);
    saltGeo.rotateX(-Math.PI / 2);
    const saltMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
      metalness: 0.2,
    });
    const saltMesh = new THREE.Mesh(saltGeo, saltMat);
    saltMesh.position.set(0, 0, -60);
    this.saltFlatsGroup.add(saltMesh);

    // Runway approach marker beacons
    for (let b = 0; b < 10; b++) {
      for (const s of [-1, 1]) {
        const beaconGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
        const bMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const bm = new THREE.Mesh(beaconGeo, bMat);
        bm.position.set(s * 7.5, 0.2, -b * 20);
        this.saltFlatsGroup.add(bm);
      }
    }

    // Broken sawhorse stanchions at Z = 0 (matching Act 6 entry barricade 1:1)
    const sawhorsePostMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
    });
    const sawhorseHazardMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.5,
    });

    for (const sx of [-3.2, 3.2]) {
      const postA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), sawhorsePostMat);
      postA.position.set(sx, 0.7, 19.2);
      postA.rotation.z = (sx > 0 ? 0.35 : -0.35);
      this.saltFlatsGroup.add(postA);

      const postB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), sawhorsePostMat);
      postB.position.set(sx + (sx > 0 ? 0.5 : -0.5), 0.7, 18.8);
      postB.rotation.z = (sx > 0 ? -0.25 : 0.25);
      this.saltFlatsGroup.add(postB);

      // Broken hazard plank remnant
      const plankRemnant = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.06), sawhorseHazardMat);
      plankRemnant.position.set(sx + (sx > 0 ? -0.4 : 0.4), 0.9, 19.0);
      plankRemnant.rotation.z = (sx > 0 ? -0.4 : 0.4);
      this.saltFlatsGroup.add(plankRemnant);
    }
  }

  // -------------------------------------------------------------
  // Camera Choreography: Exact T4 Seam -> Orbit -> Exact T5 Seam
  // -------------------------------------------------------------
  private computeCameraState(t: number, carY = 0.0): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    let fov = 55.0;

    // T4 Contract values at t = 67.13s:
    // pos: [0.0, 2.2, 7.5], target: [0.0, 1.0, -15.0], velocity: [0.0, 1.2, 18.0], fov: 55.0
    // T5 Contract values at t = 97.11s:
    // pos: [-8.0, 2.0, 0.0], target: [0.0, 1.5, 0.0], velocity: [0.0, 0.0, -38.0], fov: 48.0

    if (t <= LAUNCH_TIME) {
      // Entry whip pullout through rear window (Contract T4 exact seam)
      const dt = t - LAUNCH_TIME; // -0.50 to 0.0
      pos.set(0.0, 2.2 + 1.2 * dt, 7.5 + 18.0 * dt);
      target.set(0.0, 1.0, -15.0);
      fov = 55.0;
      return { pos, target, fov };
    }

    if (t >= LAND_TIME) {
      // Exit side tracking on salt flats (Contract T5 exact seam)
      const dt = t - LAND_TIME; // 0.0 to 0.50
      pos.set(-8.0, 2.0, 0.0 + -38.0 * dt);
      target.set(0.0, 1.5, 0.0 + -38.0 * dt);
      fov = 48.0;
      return { pos, target, fov };
    }

    // -----------------------------------------------------------
    // The Epic 30-Second Airborne Flight across the Canyon Abyss
    // (67.13s to 97.11s, divided into 5 expressive musical phases)
    // Dynamic tracking follows car elevation (carY) to lock roadster as hero centerpiece!
    // -----------------------------------------------------------
    if (t < 75.0) {
      // Phase 1 (67.13 - 75.0s, Lines 20-21: "So if we die young... dumb if it ends tonight")
      // Low-angle trailing chase cam observing car clearing bridge edge into the void
      const u = ease.outCubic((t - LAUNCH_TIME) / (75.0 - LAUNCH_TIME));
      pos.x = lerp(0.0, 2.4, u);
      pos.y = lerp(2.2, 1.6, u) + carY * 0.85;
      pos.z = lerp(7.5, 6.2, u);

      target.x = lerp(0.0, 0.2, u);
      target.y = lerp(1.0, 0.8, u) + carY;
      target.z = lerp(-15.0, -4.0, u);
      fov = 55.0;
    } else if (t < 83.0) {
      // Phase 2 (75.0 - 83.0s, Lines 22-23: "Never gone a hundred... no such thing as ninety-fives")
      // Dynamic orbit sweeping from rear-right around to low 3/4 front profile
      const u = ease.inOutCubic((t - 75.0) / 8.0);
      pos.x = lerp(2.4, 5.4, u);
      pos.y = lerp(1.6, 1.2, u) + carY * 0.85;
      pos.z = lerp(6.2, -2.8, u);

      target.x = lerp(0.2, 0.0, u);
      target.y = lerp(0.8, 0.7, u) + carY;
      target.z = lerp(-4.0, -1.2, u);
      fov = lerp(55.0, 52.0, u);
    } else if (t < 88.8) {
      // Phase 3 (83.0 - 88.8s, Lines 24-25: "Oh, just grab the cash... Unless you do it with me")
      // Cinematic wide silhouette profile framed against distant neon horizon
      const u = ease.inOutQuad((t - 83.0) / 5.8);
      pos.x = lerp(5.4, 6.8, u);
      pos.y = lerp(1.2, 2.6, u) + carY * 0.85;
      pos.z = lerp(-2.8, 1.4, u);

      target.x = 0.0;
      target.y = lerp(0.7, 1.2, u) + carY;
      target.z = 0.0;
      fov = lerp(52.0, 56.0, u);
    } else if (t < 94.5) {
      // Phase 4 (88.8 - 94.5s, Lines 26-27: "Break the bank, I'll hold your hand... Long as you hold onto me")
      // Intimate tracking sweep over cockpit: driver, steering wheel, and swinging fuzzy dice
      const u = ease.inOutCubic((t - 88.8) / 5.7);
      pos.x = lerp(6.8, -4.2, u);
      pos.y = lerp(2.6, 1.8, u) + carY * 0.85;
      pos.z = lerp(1.4, 0.4, u);

      target.x = 0.0;
      target.y = lerp(1.2, 1.1, u) + carY;
      target.z = 0.0;
      fov = lerp(56.0, 50.0, u);
    } else {
      // Phase 5 (94.5 - 97.11s, Lines 28-29: "Oh, take the wheel... Hear the sirens in the distance")
      // Camera swoops smoothly into exact Contract T5 alignment for salt flats touchdown
      const u = ease.inOutQuad((t - 94.5) / (LAND_TIME - 94.5));
      pos.x = lerp(-4.2, -8.0, u);
      pos.y = lerp(1.8, 2.0, u) + carY * 0.85;
      pos.z = lerp(0.4, 0.0, u);

      target.x = 0.0;
      target.y = lerp(1.1, 1.5, u) + carY;
      target.z = 0.0;
      fov = lerp(50.0, 48.0, u);
    }

    return { pos, target, fov };
  }

  // -------------------------------------------------------------
  // Render Loop
  // -------------------------------------------------------------
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const t = f.t;

    // 1. Roadster Ballistic Aerodynamic Physics (Evaluated First for Camera Cohesion)
    let carY = 0.0;
    let carPitch = 0.0;
    let carRoll = 0.0;
    let carYaw = 0.0;
    const steerAngle = Math.sin(t * 1.6) * 0.08 + Math.cos(t * 2.8) * 0.03;

    if (t < LAUNCH_TIME) {
      // Approaching bridge edge on asphalt deck
      carY = 0.0;
      carPitch = 0.02;
    } else if (t < LAND_TIME) {
      // Airborne trajectory across the abyss
      const u = (t - LAUNCH_TIME) / LEAP_DUR; // 0 to 1
      // Parabolic flight arc with extended float at apex
      carY = 4.2 * Math.sin(Math.PI * Math.pow(u, 0.75));

      // Aerodynamic pitch: nose up at launch (+0.14), leveling at apex, diving (-0.16)
      carPitch = 0.14 * (1.0 - u * 2.15);
      if (u > 0.92) {
        // Landing flare right before touchdown
        carPitch += smoothstep(0.92, 1.0, u) * 0.12;
      }

      // Wind turbulence oscillation
      carRoll = Math.sin(t * 2.4) * 0.035 + Math.cos(t * 1.3) * 0.02;
      carYaw = Math.sin(t * 1.1) * 0.025;
    } else {
      // Touchdown on salt flats
      const impactDt = t - LAND_TIME;
      // High-G suspension compression and rebound
      carY = Math.sin(impactDt * 24.0) * Math.exp(-impactDt * 6.0) * 0.12;
      carPitch = -0.02;
    }

    this.carGroup.position.set(0, carY, 0);
    this.carGroup.rotation.set(carPitch, carYaw, carRoll);

    // 2. Camera Animation (Tracking Car Elevation & Position)
    const camState = this.computeCameraState(t, carY);
    this.camera.position.copy(camState.pos);
    this.camera.lookAt(camState.target);
    this.camera.fov = camState.fov;
    this.camera.updateProjectionMatrix();

    // Center panoramic sky dome on camera so it stays infinite from all angles
    this.horizonDome.position.copy(this.camera.position);

    // Update vehicle internal rig (wheel roll, speedometer needle, swinging dice)
    this.vehicle.update({
      t,
      speed: SPEED_MPS,
      steerAngle,
      diceSwingStrength: 1.4,
      engineVibe: 0.005,
      headlightsOn: true,
    });

    // Taillight streak ribbons length pulse
    const ribbonLen = 12.0 + Math.sin(t * 18.0) * 2.5;
    this.taillightLeftRibbon.scale.set(1.0, ribbonLen / 14.0, 1.0);
    this.taillightRightRibbon.scale.set(1.0, ribbonLen / 14.0, 1.0);

    // 3. Moving World Streaming (Anchored Roadster convention)
    const worldOffsetZ = (t * SPEED_MPS) % CANYON_PERIOD;

    // As the airborne leap approaches touchdown (t >= 94.5s), the canyon gorge drops away behind,
    // seamlessly revealing the open expanse of the salt flat landing zone matching Act 6
    if (t >= 94.5) {
      const uExit = clamp((t - 94.5) / 2.0, 0, 1);
      this.canyonWorldGroup.position.y = -uExit * 80.0;
      this.canyonWorldGroup.visible = uExit < 1.0;
    } else {
      this.canyonWorldGroup.position.y = 0.0;
      this.canyonWorldGroup.visible = true;
    }

    // Stream canyon walls & basalt columns
    for (let i = 0; i < this.cliffMeshes.length; i++) {
      const mesh = this.cliffMeshes[i]!;
      const zInit = (Math.floor(i / 2) / (this.cliffMeshes.length / 2)) * CANYON_PERIOD - CANYON_PERIOD / 2;
      mesh.position.z = ((zInit + worldOffsetZ + CANYON_PERIOD) % CANYON_PERIOD) - CANYON_PERIOD / 2;
    }

    // Stream bridge truss towers
    for (let i = 0; i < this.trussTowers.length; i++) {
      const truss = this.trussTowers[i]!;
      const zInit = (i / this.trussTowers.length) * CANYON_PERIOD - CANYON_PERIOD / 2;
      truss.position.z = ((zInit + worldOffsetZ + CANYON_PERIOD) % CANYON_PERIOD) - CANYON_PERIOD / 2;
    }

    // Stream overhead highway gantries
    for (let i = 0; i < this.gantryArches.length; i++) {
      const gantry = this.gantryArches[i]!;
      const zInit = (i / this.gantryArches.length) * CANYON_PERIOD - CANYON_PERIOD / 2;
      gantry.position.z = ((zInit + worldOffsetZ + CANYON_PERIOD) % CANYON_PERIOD) - CANYON_PERIOD / 2;
    }

    // Stream volumetric fog sheets
    for (let i = 0; i < this.fogPlanes.length; i++) {
      const fog = this.fogPlanes[i]!;
      const zInit = (i / this.fogPlanes.length) * CANYON_PERIOD - CANYON_PERIOD / 2;
      fog.position.z = ((zInit + worldOffsetZ + CANYON_PERIOD) % CANYON_PERIOD) - CANYON_PERIOD / 2;
      fog.position.y = -18 - i * 4.0 + Math.sin(t * 1.5 + i) * 1.5;
    }

    // Bridge approach ramp position (moves away backwards after launch)
    if (t < LAUNCH_TIME) {
      const dt = LAUNCH_TIME - t;
      this.bridgeApproachGroup.position.z = -dt * SPEED_MPS;
      this.bridgeApproachGroup.visible = true;
    } else {
      const dt = t - LAUNCH_TIME;
      this.bridgeApproachGroup.position.z = dt * SPEED_MPS;
      this.bridgeApproachGroup.visible = dt < 3.5; // Hide once far behind
    }

    // Salt flats touchdown zone (approaches near 97.11s)
    if (t >= 93.0) {
      this.saltFlatsGroup.visible = true;
      const distToLanding = (LAND_TIME - t) * SPEED_MPS;
      this.saltFlatsGroup.position.z = -distToLanding;
    } else {
      this.saltFlatsGroup.visible = false;
    }

    // 4. Barricade Smash Splinters Physics (67.13s launch breach)
    if (t >= LAUNCH_TIME) {
      const dt = t - LAUNCH_TIME;
      this.splintersGroup.visible = dt < 6.0;
      for (let i = 0; i < this.barricadeSplinters.length; i++) {
        const s = this.barricadeSplinters[i]!;
        // Parabolic ballistics: P(t) = P0 + V0*dt + 0.5*g*dt^2
        s.mesh.position.x = s.v0.x * dt;
        s.mesh.position.y = 0.8 + s.v0.y * dt - 0.5 * 9.8 * dt * dt;
        s.mesh.position.z = 0.5 + (s.v0.z + SPEED_MPS * 0.4) * dt;

        s.mesh.rotateOnAxis(s.rotAxis, s.rotSpeed * f.dt);
      }
    } else {
      this.splintersGroup.visible = true;
      for (let i = 0; i < this.barricadeSplinters.length; i++) {
        const s = this.barricadeSplinters[i]!;
        s.mesh.position.set((Math.sin(i * 1.7) - 0.5) * 8.0, 0.4 + (i % 3) * 0.4, 0.5);
      }
    }

    // 5. Searchlight Cones Aiming & Police Sirens
    const searchlightFade = t >= 94.5 ? Math.max(0, 1.0 - (t - 94.5) / 1.8) : 1.0;
    for (let i = 0; i < this.searchlightBeams.length; i++) {
      const beam = this.searchlightBeams[i]!;
      const tgt = this.searchlightTargets[i]!;

      // Dynamic sweeping Lissajous motion across the abyss
      tgt.x = Math.sin(t * 1.4 + i * 1.6) * 8.0;
      tgt.y = carY + Math.cos(t * 1.8 + i * 1.2) * 3.5;
      tgt.z = Math.sin(t * 0.9 + i) * 12.0;

      beam.lookAt(tgt);
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.35 * searchlightFade;
      beam.visible = searchlightFade > 0.01;
    }

    // Police flashing red & blue sirens
    const sirenPhase = (t * 6.5) % 1.0;
    const isRed = sirenPhase < 0.5;
    this.policeLightRed.intensity = isRed ? 4.5 : 0.2;
    this.policeLightBlue.intensity = isRed ? 0.2 : 4.5;

    // 6. Swirling Banknotes Vortex Simulation
    for (let i = 0; i < this.banknoteCount; i++) {
      const b = this.banknoteData[i]!;
      // Banknotes cycle through slipstream behind roadster
      const zSlip = ((t * 22.0 + i * 0.35) % 45.0) + 1.2;
      const progress = zSlip / 45.0; // 0 (near boattail) to 1 (far behind in mist)

      // Expanding spiral vortex
      const r = b.spiralRadius * (1.0 + progress * 2.2);
      const angle = t * b.spiralFreq + b.spiralPhase + zSlip * 0.25;

      const x = b.baseOffset.x + Math.cos(angle) * r;
      const y = carY + b.baseOffset.y + Math.sin(angle) * r * 0.65;
      const z = b.baseOffset.z + zSlip;

      this.dummyObj.position.set(x, y, z);
      this.dummyObj.rotation.set(
        b.rotX + t * 4.2 + i,
        b.rotY + t * 5.1 + i * 0.5,
        b.rotZ + t * 3.7,
      );
      this.dummyObj.updateMatrix();
      this.banknoteMesh.setMatrixAt(i, this.dummyObj.matrix);
    }
    this.banknoteMesh.instanceMatrix.needsUpdate = true;

    // 7. Friction Sparks Simulation
    const p = this.sparkPositions;
    for (let i = 0; i < this.sparkCount; i++) {
      const life = ((t * 4.0 + this.sparkLifeOffsets[i]!) % 1.0);
      const wheelIdx = i % 4;
      const wheelX = wheelIdx % 2 === 0 ? -0.85 : 0.85;
      const wheelZ = wheelIdx < 2 ? -1.8 : 1.4;

      // Spawn at wheels/undercarriage and spray backwards
      p[i * 3 + 0] = wheelX + this.sparkVelocities[i * 3 + 0]! * life * 0.4;
      p[i * 3 + 1] = carY + 0.15 + this.sparkVelocities[i * 3 + 1]! * life - 0.5 * 9.8 * life * life;
      p[i * 3 + 2] = wheelZ + this.sparkVelocities[i * 3 + 2]! * life;
    }
    this.sparkPoints.geometry.attributes.position!.needsUpdate = true;

    // -------------------------------------------------------------
    // 8. Kinetic Typography (Lines 20 - 29 via LyricRig)
    // Anchored to dynamic camera look target for rock-solid screen-space centering and upper-third sky legibility
    // -------------------------------------------------------------
    this.layer2d.clear();
    const ctx = this.layer2d.ctx;
    const targetAnchor: [number, number, number] = [camState.target.x, camState.target.y, camState.target.z];

    // Line 20: "So if we die young, would that be alright?" (67.13s - 71.00s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 20,
      fontSize: 50,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.CAD_HAIRLINE_CYAN,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -180,
    });

    // Line 21: "Or would it feel dumb if it ends tonight?" (71.00s - 75.00s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 21,
      fontSize: 52,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.AMBER_REDLINE,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -140,
    });

    // Line 22: "I've never gone a hundred in my life" (75.00s - 79.00s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 22,
      fontSize: 48,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.GAUGE_NEEDLE_RED,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -240,
      leadOutTime: 0.12,
    });

    // Line 23: "There's no such thing as ninety-fives this time" (79.00s - 83.00s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 23,
      fontSize: 50,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.AMBER_REDLINE,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -90,
      leadInTime: 0.12,
    });

    // Line 24: "Oh, just grab the cash, and no takebacks" (83.00s - 86.80s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 24,
      fontSize: 54,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.CURRENCY_GREEN_TINT,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -180,
    });

    // Line 25: "Unless you do it with me" (86.80s - 88.80s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 25,
      fontSize: 52,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.SHATTER_WHITE_GLOW,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -140,
    });

    // Line 26: "If you break the bank, I'll hold your hand" (88.80s - 92.50s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 26,
      fontSize: 48,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -180,
    });

    // Line 27: "Long as you hold onto me" (92.50s - 94.50s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 27,
      fontSize: 50,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.DAWN_SKY_MAGENTA,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -140,
      leadOutTime: 0.1,
    });

    // Line 28: "Oh, take the wheel, I'll navigate" (94.50s - 95.80s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 28,
      fontSize: 52,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: COLOR_TOKENS.CAD_HAIRLINE_CYAN,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -240,
      leadInTime: 0.1,
      leadOutTime: 0.1,
    });

    // Line 29: "Hear the sirens in the distance, high-speed chase" (95.80s - 97.11s)
    LyricRig.renderLine(ctx, {
      worldPos: targetAnchor,
      cam: this.camera,
      t,
      lineIdx: 29,
      fontSize: 54,
      baseColor: 'rgba(241, 245, 249, 0.45)',
      highlightColor: isRed ? COLOR_TOKENS.POLICE_RED : COLOR_TOKENS.POLICE_BLUE,
      haloColor: 'rgba(10, 13, 18, 0.95)',
      yOffsetPx: -90,
      leadInTime: 0.1,
      leadOutTime: 0.02,
    });

    this.layer2d.upload();

    // -------------------------------------------------------------
    // 10. Three.js Render Pass & 2D Composite
    // -------------------------------------------------------------
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // -------------------------------------------------------------
    // 11. Post-Processing Overrides
    // -------------------------------------------------------------
    // Subtle camera shake on Barricade breach (67.13s) and Salt flats landing (97.11s)
    let cameraShake = 0.0;
    let impactBloom = 0.0;

    if (t >= LAUNCH_TIME && t < LAUNCH_TIME + 0.3) {
      const u = (t - LAUNCH_TIME) / 0.3;
      cameraShake = (1.0 - u) * 4.0;
      impactBloom = (1.0 - u) * 0.12;
    } else if (t >= LAND_TIME && t < LAND_TIME + 0.25) {
      const dt = t - LAND_TIME;
      const u = clamp(dt / 0.25, 0, 1);
      cameraShake = Math.pow(1.0 - u, 1.5) * 8.0;
      impactBloom = Math.pow(1.0 - u, 2.0) * 0.20;
    }

    const shakeX = (Math.sin(t * 120.0) * cameraShake);
    const shakeY = (Math.cos(t * 140.0) * cameraShake);

    return {
      exposure: 1.05,
      bloom: 0.58 + impactBloom,
      bloomThreshold: 0.82,
      ca: 1.1,
      halation: 0.25,
      vignette: 0.38,
      grain: 0.04,
      flash: 0.0,
      shake: [shakeX, shakeY],
    };
  }

  override dispose(): void {
    this.layer2d.canvas.remove();
  }
}

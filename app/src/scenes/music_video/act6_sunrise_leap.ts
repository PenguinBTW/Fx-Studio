// ACT VI: THE BARRICADE SMASH & SUNRISE LEAP (96.61s - 125.0s, Nominal Seam 125.0s)
// Forrest Nolan - 'No Takebacks'
// BPM: 129.20, Bar 53.0 - 67.0+
//
// Lyrics to render via LyricRig:
// - Line 30: "Do or die, I'll be in your arms" (97.11s - 101.50s)
// - Line 31: "Oh, just cross your heart, oh, no takebacks" (101.50s - 106.50s)
// - Line 32: "Unless you do it, do it with me" (106.50s - 111.50s)
// - Line 33: "No takebacks" (111.50s - 116.50s)
// - Outro: 116.50s - 125.0s (Instrumental guitar and drum resolution into golden sunrise)
//
// Entry Transition Contract T5 (97.11s):
// - Entry camera: pos: [-8.0, 2.0, 0.0], target: [0.0, 1.5, 0.0], velocity: [0.0, 0.0, -38.0], fov: 48.0
// - Snaps into low 70mm side tracking rig running parallel to the car as it slams down onto the salt flats!

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease } from '../../engine/util';
import { createVehicleModel, type VehicleModelRig } from './shared/vehicle_model';
import { ViewportSpace } from '../../engine/viewport';

export default class Act6SunriseLeap extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // 1930s Boattail Speedster & Mirror Salt Flat Reflection
  private vehicle: VehicleModelRig;
  private vehicleReflection: VehicleModelRig;

  // Environment & Salt Flat Geometry
  private groundMesh: THREE.Mesh;
  private groundGeo: THREE.PlaneGeometry;
  private saltGrid: THREE.GridHelper;
  private skyMesh: THREE.Mesh;
  private skyGeo: THREE.SphereGeometry;

  // Golden Sunrise Disc & Volumetric Rays
  private sunGroup = new THREE.Group();
  private sunCore: THREE.Mesh;
  private sunCorona: THREE.Mesh;
  private sunHalo: THREE.Mesh;
  private sunBeamsGroup = new THREE.Group();
  private dirSunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private rimFill: THREE.DirectionalLight;

  // Smashed Barricade & Flying Splinters (96.61s - 99.5s)
  private barricadeGroup = new THREE.Group();
  private splintersMesh: THREE.InstancedMesh;
  private splinterDummy = new THREE.Object3D();
  private splinterCount = 80;

  // Crystalline Salt Spray Particle System (Rooster Tails)
  private saltSprayPoints: THREE.Points;
  private saltSprayGeo: THREE.BufferGeometry;
  private saltSprayPositions: Float32Array;
  private saltSprayColors: Float32Array;
  private saltSprayCount = 1200;

  // Monumental 3D Horizon Typography: "NO TAKEBACKS" (111.5s - 116.5s)
  private monumentGroup = new THREE.Group();
  private monumentGeometries: THREE.BufferGeometry[] = [];
  private shockwaveRing: THREE.Mesh;

  // Distant Mountain Ridges
  private mountainsGroup = new THREE.Group();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(48, W / H, 0.2, 3200);
    this.layer2d = new Layer2D(W, H);

    // Deep midnight atmosphere transitioning to sunrise gold
    this.threeScene.background = new THREE.Color(0x0a0c14);
    this.threeScene.fog = new THREE.FogExp2(0x1a0f2b, 0.00065);

    // -------------------------------------------------------------
    // 1. Vehicle Model Rig & Salt Flat Mirror Reflection Rig
    // -------------------------------------------------------------
    this.vehicle = createVehicleModel();
    this.vehicle.showFullExterior();
    // Soften windshield glass to prevent specular transmission burn-in against low horizon sun
    const act6Windshield = (this.vehicle.materials.windshieldGlass as THREE.MeshPhysicalMaterial).clone();
    act6Windshield.roughness = 0.35;
    act6Windshield.metalness = 0.02;
    act6Windshield.transmission = 0.12;
    act6Windshield.opacity = 0.40;
    this.vehicle.materials.windshieldGlass = act6Windshield;
    this.threeScene.add(this.vehicle.root);

    // Secondary inverted vehicle rig for mirror-smooth salt flat reflection
    this.vehicleReflection = createVehicleModel();
    this.vehicleReflection.showFullExterior();
    this.vehicleReflection.materials.windshieldGlass = act6Windshield;
    for (const mat of Object.values(this.vehicleReflection.materials)) {
      mat.side = THREE.DoubleSide;
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.roughness = Math.min(1.0, mat.roughness + 0.15);
        mat.metalness = Math.max(0.0, mat.metalness - 0.1);
      }
    }
    this.threeScene.add(this.vehicleReflection.root);

    // -------------------------------------------------------------
    // 2. Lighting Rig: Golden Dawn Sun, Skylight & Vehicle Beams
    // -------------------------------------------------------------
    this.ambientLight = new THREE.AmbientLight(0x524058, 1.4);
    this.threeScene.add(this.ambientLight);

    // Blazing directional sunlight coming from the dawn horizon
    this.dirSunLight = new THREE.DirectionalLight(0xfef08a, 3.4);
    this.dirSunLight.position.set(0, 75, -1350);
    this.dirSunLight.target.position.set(0, 1.0, 0);
    this.threeScene.add(this.dirSunLight);
    this.threeScene.add(this.dirSunLight.target);

    // Warm dawn side fill tracking vehicle trajectory
    this.rimFill = new THREE.DirectionalLight(0xfde68a, 2.4);
    this.rimFill.position.set(-28, 14, -200);
    this.threeScene.add(this.rimFill);
    this.threeScene.add(this.rimFill.target);

    // Headlight forward spot illumination
    for (const sx of [-0.52, 0.52]) {
      const hLight = new THREE.SpotLight(0xfef08a, 2.8, 45, Math.PI / 6, 0.45);
      hLight.position.set(sx, 0.55, -2.4);
      const hTarget = new THREE.Object3D();
      hTarget.position.set(sx * 1.5, 0.1, -25.0);
      this.vehicle.root.add(hLight);
      this.vehicle.root.add(hTarget);
      hLight.target = hTarget;
    }

    // -------------------------------------------------------------
    // 3. The Bonneville Mirror Salt Flat Ground Plane
    // -------------------------------------------------------------
    this.groundGeo = new THREE.PlaneGeometry(1600, 3200, 1, 1);
    this.groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.12,
      metalness: 0.38,
      transparent: true,
      opacity: 0.86,
    });
    this.groundMesh = new THREE.Mesh(this.groundGeo, groundMat);
    this.groundMesh.position.set(0, 0.0, -900);
    this.threeScene.add(this.groundMesh);

    // Hexagonal / quad geometric salt crust drying cracks
    this.saltGrid = new THREE.GridHelper(3200, 320, 0xd4a359, 0xe2e8f0);
    this.saltGrid.position.set(0, 0.002, -900);
    (this.saltGrid.material as THREE.Material).transparent = true;
    (this.saltGrid.material as THREE.Material).opacity = 0.08;
    // Keep saltGrid subtle and non-intrusive

    // -------------------------------------------------------------
    // 4. Panoramic Dawn Sky Hemisphere & Sun Disc
    // -------------------------------------------------------------
    this.skyGeo = new THREE.SphereGeometry(2200, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const count = this.skyGeo.attributes.position!.count;
    const colors = new Float32Array(count * 3);
    const pos = this.skyGeo.attributes.position!;

    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      const u = clamp(y / 2200, 0, 1);

      // Gradient from horizon gold -> morning magenta -> deep navy zenith
      let r = 0, g = 0, b = 0;
      if (u < 0.2) {
        const f = u / 0.2;
        r = THREE.MathUtils.lerp(1.0, 0.88, f);
        g = THREE.MathUtils.lerp(0.85, 0.11, f);
        b = THREE.MathUtils.lerp(0.35, 0.28, f);
      } else if (u < 0.6) {
        const f = (u - 0.2) / 0.4;
        r = THREE.MathUtils.lerp(0.88, 0.18, f);
        g = THREE.MathUtils.lerp(0.11, 0.09, f);
        b = THREE.MathUtils.lerp(0.28, 0.32, f);
      } else {
        const f = (u - 0.6) / 0.4;
        r = THREE.MathUtils.lerp(0.18, 0.04, f);
        g = THREE.MathUtils.lerp(0.09, 0.05, f);
        b = THREE.MathUtils.lerp(0.32, 0.10, f);
      }

      colors[i * 3 + 0] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    this.skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const skyMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
    });
    this.skyMesh = new THREE.Mesh(this.skyGeo, skyMat);
    this.threeScene.add(this.skyMesh);

    // -------------------------------------------------------------
    // Golden Sun Disc & Coronal Rays at Horizon
    // -------------------------------------------------------------
    this.sunGroup.position.set(0, 68, -1350);

    const sunCoreGeo = new THREE.CircleGeometry(52, 32);
    const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.sunCore = new THREE.Mesh(sunCoreGeo, sunCoreMat);
    this.sunGroup.add(this.sunCore);

    const coronaGeo = new THREE.RingGeometry(50, 130, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    this.sunGroup.add(this.sunCorona);

    const haloGeo = new THREE.RingGeometry(125, 280, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });
    this.sunHalo = new THREE.Mesh(haloGeo, haloMat);
    this.sunGroup.add(this.sunHalo);

    // 12 Volumetric Radial Sunbeams
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (let b = 0; b < 12; b++) {
      const angle = (b * Math.PI * 2) / 12;
      const beamGeo = new THREE.BufferGeometry();
      const bPos = new Float32Array([
        0, 0, 0,
        Math.cos(angle - 0.08) * 650, Math.sin(angle - 0.08) * 650, 0,
        Math.cos(angle + 0.08) * 650, Math.sin(angle + 0.08) * 650, 0,
      ]);
      beamGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      this.sunBeamsGroup.add(beamMesh);
    }
    this.sunGroup.add(this.sunBeamsGroup);
    this.threeScene.add(this.sunGroup);

    // -------------------------------------------------------------
    // Distant Mountain Ridges on Horizon
    // -------------------------------------------------------------
    const mtnMat = new THREE.MeshStandardMaterial({
      color: 0x1e1838,
      roughness: 0.9,
      metalness: 0.1,
    });
    for (let m = 0; m < 26; m++) {
      const u = (m - 13) / 13;
      const x = u * 1100 + (Math.sin(m * 3.4) * 50);
      const radius = 60 + ((m * 17) % 55);
      const height = 75 + ((m * 31) % 85);
      const coneGeo = new THREE.ConeGeometry(radius, height, 4);
      coneGeo.rotateY(m * 0.7);
      const cone = new THREE.Mesh(coneGeo, mtnMat);
      cone.position.set(x, height / 2 - 2, -1380);
      this.mountainsGroup.add(cone);
    }
    this.threeScene.add(this.mountainsGroup);

    // -------------------------------------------------------------
    // 5. Shattered Barricade & Flying Splinters (Smash at t = 96.61s)
    // -------------------------------------------------------------
    this.barricadeGroup.position.set(0, 0, 0);

    // Left and Right broken sawhorse stanchions
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      roughness: 0.5,
    });

    for (const sx of [-3.2, 3.2]) {
      const postA = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), postMat);
      postA.position.set(sx, 0.7, 0.2);
      postA.rotation.z = (sx > 0 ? 0.35 : -0.35);
      this.barricadeGroup.add(postA);

      const postB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), postMat);
      postB.position.set(sx + (sx > 0 ? 0.5 : -0.5), 0.7, -0.2);
      postB.rotation.z = (sx > 0 ? -0.25 : 0.25);
      this.barricadeGroup.add(postB);

      // Broken hazard plank remnant
      const plankRemnant = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.06), stripeMat);
      plankRemnant.position.set(sx + (sx > 0 ? -0.4 : 0.4), 0.9, 0);
      plankRemnant.rotation.z = (sx > 0 ? -0.4 : 0.4);
      this.barricadeGroup.add(plankRemnant);
    }
    this.threeScene.add(this.barricadeGroup);

    // 80 Instanced Splinters tumbling through the air
    const splinterGeo = new THREE.BoxGeometry(0.12, 0.035, 0.55);
    const splinterMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      metalness: 0.1,
    });
    this.splintersMesh = new THREE.InstancedMesh(splinterGeo, splinterMat, this.splinterCount);
    this.threeScene.add(this.splintersMesh);

    // -------------------------------------------------------------
    // 6. Crystalline Salt Spray Particle System (Rooster Tails)
    // -------------------------------------------------------------
    this.saltSprayPositions = new Float32Array(this.saltSprayCount * 3);
    this.saltSprayColors = new Float32Array(this.saltSprayCount * 3);

    for (let i = 0; i < this.saltSprayCount; i++) {
      this.saltSprayPositions[i * 3 + 0] = 0;
      this.saltSprayPositions[i * 3 + 1] = -50;
      this.saltSprayPositions[i * 3 + 2] = 0;

      this.saltSprayColors[i * 3 + 0] = 1.0;
      this.saltSprayColors[i * 3 + 1] = 0.88;
      this.saltSprayColors[i * 3 + 2] = 0.5;
    }

    this.saltSprayGeo = new THREE.BufferGeometry();
    this.saltSprayGeo.setAttribute('position', new THREE.BufferAttribute(this.saltSprayPositions, 3));
    this.saltSprayGeo.setAttribute('color', new THREE.BufferAttribute(this.saltSprayColors, 3));

    const sprayMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.saltSprayPoints = new THREE.Points(this.saltSprayGeo, sprayMat);
    this.threeScene.add(this.saltSprayPoints);

    // -------------------------------------------------------------
    // 7. Monumental 3D Horizon Typography: "NO TAKEBACKS"
    // -------------------------------------------------------------
    this.buildMonumentTypography();
    this.threeScene.add(this.monumentGroup);

    // Expanding salt dust shockwave ring when letters breach horizon
    const ringGeo = new THREE.RingGeometry(0.5, 3.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.position.set(0, 0.05, -760);
    this.threeScene.add(this.shockwaveRing);
  }

  // -------------------------------------------------------------
  // Construct Brutalist 3D Architectural Letter Monoliths
  // -------------------------------------------------------------
  private buildMonumentTypography() {
    this.monumentGroup.position.set(0, -18, -760);

    const letterMat = new THREE.MeshStandardMaterial({
      color: 0x1c2026,
      roughness: 0.25,
      metalness: 0.92,
      emissive: 0x78350f,
      emissiveIntensity: 0.22,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.08,
      metalness: 0.98,
      emissive: 0xd4a359,
      emissiveIntensity: 0.35,
    });

    const H = 14.0;
    const W = 7.2;
    const D = 2.4;
    const T = 1.6;

    const self = this;
    function addBox(parent: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) {
      const geo = new THREE.BoxGeometry(w, h, d);
      self.monumentGeometries.push(geo);
      const m = new THREE.Mesh(geo, letterMat);
      m.position.set(x, y, z);
      m.rotation.z = rz;
      m.castShadow = true;
      parent.add(m);

      const trimGeo = new THREE.BoxGeometry(w * 0.96, h * 0.96, 0.08);
      self.monumentGeometries.push(trimGeo);
      const tm = new THREE.Mesh(trimGeo, trimMat);
      tm.position.set(x, y, z + d / 2 + 0.04);
      tm.rotation.z = rz;
      parent.add(tm);
    }

    function createLetter(char: string): THREE.Group {
      const g = new THREE.Group();
      switch (char) {
        case 'N':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, T, H, D, W/2 - T/2, H/2, 0);
          const diagLen = Math.hypot(W - T, H - T);
          const angle = -Math.atan2(W - T, H - T);
          addBox(g, T, diagLen, D, 0, H/2, 0, angle);
          break;
        case 'O':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, T, H, D, W/2 - T/2, H/2, 0);
          addBox(g, W - 2*T, T, D, 0, H - T/2, 0);
          addBox(g, W - 2*T, T, D, 0, T/2, 0);
          break;
        case 'T':
          addBox(g, T, H - T, D, 0, (H - T)/2, 0);
          addBox(g, W + 1.6, T, D, 0, H - T/2, 0);
          break;
        case 'A':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, T, H, D, W/2 - T/2, H/2, 0);
          addBox(g, W - 2*T, T, D, 0, H - T/2, 0);
          addBox(g, W - 2*T, T * 0.85, D, 0, H * 0.45, 0);
          break;
        case 'K':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, T, 7.8, D, 0.9, H * 0.72, 0, -0.68);
          addBox(g, T, 7.8, D, 0.9, H * 0.28, 0, 0.68);
          break;
        case 'E':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, W - T, T, D, T/2, H - T/2, 0);
          addBox(g, W * 0.75 - T, T, D, T/2 - (W * 0.25)/2, H/2, 0);
          addBox(g, W - T, T, D, T/2, T/2, 0);
          break;
        case 'B':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, W - 2*T, T, D, 0, H - T/2, 0);
          addBox(g, W - 2*T, T, D, 0, H/2, 0);
          addBox(g, W - 2*T, T, D, 0, T/2, 0);
          addBox(g, T, (H - 3*T)/2, D, W/2 - T/2, H * 0.72, 0);
          addBox(g, T, (H - 3*T)/2, D, W/2 - T/2, H * 0.28, 0);
          break;
        case 'C':
          addBox(g, T, H, D, -W/2 + T/2, H/2, 0);
          addBox(g, W - T, T, D, T/2, H - T/2, 0);
          addBox(g, W - T, T, D, T/2, T/2, 0);
          break;
        case 'S':
          addBox(g, W, T, D, 0, H - T/2, 0);
          addBox(g, T, (H - 3*T)/2, D, -W/2 + T/2, H * 0.72, 0);
          addBox(g, W, T, D, 0, H/2, 0);
          addBox(g, T, (H - 3*T)/2, D, W/2 - T/2, H * 0.28, 0);
          addBox(g, W, T, D, 0, T/2, 0);
          break;
      }
      return g;
    }

    // "NO" on left flank (X = -24, -14), wide 24-meter gateway at center (X = 0),
    // and "TAKEBACKS" spanning X = 10 through X = 82
    const letterPositions: [string, number][] = [
      ['N', -24],
      ['O', -14],
      ['T', 10],
      ['A', 19],
      ['K', 28],
      ['E', 37],
      ['B', 46],
      ['A', 55],
      ['C', 64],
      ['K', 73],
      ['S', 82],
    ];

    for (const [char, posX] of letterPositions) {
      const letGroup = createLetter(char);
      letGroup.position.set(posX, 0, 0);
      this.monumentGroup.add(letGroup);
    }
  }

  // -------------------------------------------------------------
  // Render Execution (f(t) Closed-Form Deterministic Frame)
  // -------------------------------------------------------------
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;
    const { T5 } = TRANSITION_CONTRACTS;

    // --- 1. Vehicle Trajectory, Leap & Suspension Compression ---
    const forwardSpeed = 38.0; // m/s (~85-107 MPH across salt flat)
    const zCar = -forwardSpeed * (t - 97.11);

    let yCar = 0.0;
    let carPitch = 0.0;
    let carRoll = 0.0;
    let touchdownImpact = 0.0;

    if (t < 97.11) {
      // Freefall leap before impact (96.61s to 97.11s)
      const leapProgress = clamp((t - 96.61) / 0.50, 0, 1);
      // Arcing trajectory down to salt flats
      yCar = (1.0 - leapProgress) * 1.6 + Math.sin(leapProgress * Math.PI) * 0.35;
      carPitch = -0.06 * (1.0 - leapProgress);
    } else {
      // Touchdown at t = 97.11s with suspension compression bounce
      const dtTouch = t - 97.11;
      const bounce = -0.22 * Math.exp(-dtTouch * 3.8) * Math.cos(dtTouch * 15.0);
      const pitchOsc = 0.05 * Math.exp(-dtTouch * 4.2) * Math.sin(dtTouch * 17.0);
      const rollOsc = 0.02 * Math.exp(-dtTouch * 3.5) * Math.sin(dtTouch * 12.0);
      yCar = Math.max(-0.08, bounce);
      carPitch = pitchOsc;
      carRoll = rollOsc;

      if (dtTouch < 2.0) {
        touchdownImpact = Math.exp(-dtTouch * 3.5);
      }
    }

    // Update 3D Vehicle Models (Top Roadster & Bottom Mirror Reflection)
    this.vehicle.root.position.set(0.0, yCar, zCar);
    this.vehicle.root.rotation.set(carPitch, 0.0, carRoll);
    this.vehicle.update({
      t,
      speed: forwardSpeed,
      steerAngle: carRoll * 1.5,
      diceSwingStrength: 1.35 + touchdownImpact * 1.8,
      engineVibe: 0.0035,
      headlightsOn: true,
    });

    // Inverted mirror reflection beneath salt crust
    this.vehicleReflection.root.position.set(0.0, -yCar, zCar);
    this.vehicleReflection.root.rotation.set(-carPitch, 0.0, -carRoll);
    this.vehicleReflection.root.scale.set(1, -1, 1);
    this.vehicleReflection.update({
      t,
      speed: forwardSpeed,
      steerAngle: carRoll * 1.5,
      diceSwingStrength: 1.35 + touchdownImpact * 1.8,
      engineVibe: 0.0035,
      headlightsOn: true,
    });

    // Keep ground plane, sky, mountains, and sun centered with car travel
    this.groundMesh.position.z = zCar - 300;
    this.saltGrid.position.z = zCar - 300;
    this.skyMesh.position.z = zCar;
    this.sunGroup.position.z = zCar - 1350;
    this.mountainsGroup.position.z = zCar - 1200;

    // Track rim fill light with car travel to provide warm dawn metallic definition
    this.rimFill.position.set(-28, 14, zCar + 12);
    this.rimFill.target.position.set(0, 0.6, zCar);

    // --- 2. Camera Rig Choreography (5 Seamless Phases) ---
    // Start strictly compliant with T5 at t = 97.11s:
    // pos: [-8.0, 2.0, 0.0], target: [0.0, 1.5, 0.0], velocity: [0.0, 0.0, -38.0], fov: 48.0
    let camRelX = -8.0;
    let camRelY = 2.0;
    let camRelZ = 0.0;
    let targetRelX = 0.0;
    let targetRelY = 1.5;
    let targetRelZ = 0.0;
    let fov = 48.0;
    let camShake = 0.0;

    if (t < 97.11) {
      // Leap approach: camera runs strictly parallel to car at T5 vector
      camRelX = T5.pos[0];
      camRelY = T5.pos[1];
      camRelZ = T5.pos[2];
      targetRelX = T5.target[0];
      targetRelY = T5.target[1];
      targetRelZ = T5.target[2];
      fov = T5.fov;
    } else if (t < 101.50) {
      // Phase 1: Low 70mm Parallel Side Tracking (97.11s - 101.50s)
      const p1 = clamp((t - 97.11) / (101.50 - 97.11), 0, 1);
      const e1 = ease.outCubic(p1);
      camRelX = THREE.MathUtils.lerp(-8.0, -6.6, e1);
      camRelY = THREE.MathUtils.lerp(2.0, 0.92, e1);
      camRelZ = THREE.MathUtils.lerp(0.0, 0.6, e1);
      targetRelX = THREE.MathUtils.lerp(0.0, 0.0, e1);
      targetRelY = THREE.MathUtils.lerp(1.5, 0.65, e1);
      targetRelZ = THREE.MathUtils.lerp(0.0, 0.0, e1);
      fov = THREE.MathUtils.lerp(48.0, 44.0, e1);

      // Camera impact impulse on touchdown
      const dtTouch = t - 97.11;
      if (dtTouch < 1.4) {
        camShake = Math.sin(dtTouch * 48.0) * Math.exp(-dtTouch * 4.5) * 0.14;
      }
    } else if (t < 106.50) {
      // Phase 2: Flank Glide & Cockpit Reveal (101.50s - 106.50s)
      const p2 = clamp((t - 101.50) / 5.0, 0, 1);
      const e2 = ease.inOutCubic(p2);
      camRelX = THREE.MathUtils.lerp(-6.6, -3.2, e2);
      camRelY = THREE.MathUtils.lerp(0.92, 1.35, e2);
      camRelZ = THREE.MathUtils.lerp(0.6, -2.6, e2);
      targetRelX = THREE.MathUtils.lerp(0.0, -0.2, e2);
      targetRelY = THREE.MathUtils.lerp(0.65, 0.85, e2);
      targetRelZ = THREE.MathUtils.lerp(0.0, -0.4, e2);
      fov = THREE.MathUtils.lerp(44.0, 42.0, e2);
    } else if (t < 111.50) {
      // Phase 3: Flank to Rear Three-Quarter Orbit & Dawn Horizon Reveal (106.50s - 111.50s)
      const p3 = clamp((t - 106.50) / 5.0, 0, 1);
      const e3 = ease.inOutCubic(p3);
      camRelX = THREE.MathUtils.lerp(-3.2, -4.2, e3);
      camRelY = THREE.MathUtils.lerp(1.35, 1.85, e3);
      camRelZ = THREE.MathUtils.lerp(-2.6, 6.2, e3);
      targetRelX = 0.0;
      targetRelY = 0.85;
      targetRelZ = THREE.MathUtils.lerp(-0.4, -6.0, e3);
      fov = THREE.MathUtils.lerp(42.0, 48.0, e3);
    } else if (t < 116.50) {
      // Phase 4: Dynamic Trailing Pursuit & Monumental Horizon Typography Reveal (111.50s - 116.50s)
      const p4 = clamp((t - 111.50) / 5.0, 0, 1);
      const e4 = ease.inOutCubic(p4);
      camRelX = THREE.MathUtils.lerp(-4.2, 2.6, e4);
      camRelY = THREE.MathUtils.lerp(1.85, 2.1, e4);
      camRelZ = THREE.MathUtils.lerp(6.2, 7.8, e4);
      targetRelX = THREE.MathUtils.lerp(0.0, -0.3, e4);
      targetRelY = 0.85;
      targetRelZ = -18.0;
      fov = THREE.MathUtils.lerp(48.0, 52.0, e4);
    } else {
      // Outro: Majestic Low Tracking Chase into Rising Sun (116.50s - 125.0s)
      const p5 = clamp((t - 116.50) / 8.5, 0, 1);
      const e5 = ease.inOutCubic(p5);
      camRelX = THREE.MathUtils.lerp(2.6, 0.4, e5);
      camRelY = THREE.MathUtils.lerp(2.1, 1.25, e5);
      camRelZ = THREE.MathUtils.lerp(7.8, 9.2, e5);
      targetRelX = 0.0;
      targetRelY = 0.75;
      targetRelZ = -15.0;
      fov = THREE.MathUtils.lerp(52.0, 46.0, e5);
    }

    const camWorldX = camRelX;
    const camWorldY = yCar + camRelY + camShake;
    const camWorldZ = zCar + camRelZ;

    const targetWorldX = targetRelX;
    const targetWorldY = yCar + targetRelY;
    const targetWorldZ = zCar + targetRelZ;

    this.camera.position.set(camWorldX, camWorldY, camWorldZ);
    this.camera.lookAt(targetWorldX, targetWorldY, targetWorldZ);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    // --- 3. Flying Barricade Splinters Simulation ---
    if (t >= 96.61 && t <= 101.0) {
      const dtSplinter = t - 96.61;
      for (let i = 0; i < this.splinterCount; i++) {
        const s1 = Math.abs(Math.sin(i * 12.9898 + 0.12));
        const s2 = Math.abs(Math.sin(i * 78.233 + 0.45));
        const s3 = Math.abs(Math.sin(i * 45.164 + 0.89));

        const x0 = (s1 - 0.5) * 4.2;
        const y0 = 0.4 + s2 * 1.4;
        const z0 = (s3 - 0.5) * 1.5;

        const vx = (s1 - 0.5) * 28.0;
        const vy = 6.0 + s2 * 14.0;
        const vz = -14.0 - s3 * 22.0;

        const px = x0 + vx * dtSplinter;
        const py = Math.max(0.04, y0 + vy * dtSplinter - 0.5 * 9.8 * dtSplinter * dtSplinter);
        const pz = z0 + vz * dtSplinter;

        this.splinterDummy.position.set(px, py, pz);
        this.splinterDummy.rotation.set(
          (s1 - 0.5) * 25 * dtSplinter,
          (s2 - 0.5) * 25 * dtSplinter,
          (s3 - 0.5) * 25 * dtSplinter,
        );
        const sScale = Math.max(0.01, 1.0 - clamp((dtSplinter - 2.5) / 1.5, 0, 1));
        this.splinterDummy.scale.setScalar(sScale);
        this.splinterDummy.updateMatrix();
        this.splintersMesh.setMatrixAt(i, this.splinterDummy.matrix);
      }
      this.splintersMesh.instanceMatrix.needsUpdate = true;
      this.splintersMesh.visible = true;
    } else {
      this.splintersMesh.visible = false;
    }

    // --- 4. Crystalline Salt Spray Rooster Tails (Points) ---
    if (t >= 97.11) {
      const pArr = this.saltSprayPositions;
      const cArr = this.saltSprayColors;

      for (let i = 0; i < this.saltSprayCount; i++) {
        const wheelIdx = i % 4;
        let wx = 0;
        let wz = 0;
        if (wheelIdx === 0) { wx = -0.88; wz = -1.8; }
        else if (wheelIdx === 1) { wx = 0.88; wz = -1.8; }
        else if (wheelIdx === 2) { wx = -0.88; wz = 1.4; }
        else { wx = 0.88; wz = 1.4; }

        const seed = ((i * 17.31) % 1.0);
        const lifespan = 0.45 + ((i * 37.19) % 1.0) * 0.42;
        const tRel = ((t - 97.11 + i * 0.013) % lifespan);
        const alpha = tRel / lifespan;

        const burst = 1.0 + touchdownImpact * 2.5;
        const vzRel = (24.0 + seed * 22.0) * burst;
        const vxRel = (Math.sign(wx) * (3.8 + seed * 4.5) + ((seed * 7) % 2 - 1) * 1.8) * burst;
        const vyRel = (3.5 + seed * 5.2) * burst;

        const deltaZ = vzRel * tRel;
        const deltaX = vxRel * tRel;
        const deltaY = Math.max(0.01, vyRel * tRel - 0.5 * 11.5 * tRel * tRel);

        const tBirth = t - tRel;
        const zBirth = -forwardSpeed * (tBirth - 97.11);

        pArr[i * 3 + 0] = wx + deltaX;
        pArr[i * 3 + 1] = deltaY;
        pArr[i * 3 + 2] = zBirth + wz + deltaZ;

        const fade = (1.0 - alpha) * Math.min(1.0, (t - 97.11) * 6.0);
        cArr[i * 3 + 0] = 0.98 * fade;
        cArr[i * 3 + 1] = (0.75 + 0.22 * (1.0 - alpha)) * fade;
        cArr[i * 3 + 2] = (0.35 + 0.55 * (1.0 - alpha)) * fade;
      }
      this.saltSprayGeo.attributes.position!.needsUpdate = true;
      this.saltSprayGeo.attributes.color!.needsUpdate = true;
      this.saltSprayPoints.visible = true;
    } else {
      this.saltSprayPoints.visible = false;
    }

    // --- 5. Monumental 3D Typography Elevation & Horizon Shockwave ---
    if (t >= 109.5) {
      const riseU = clamp((t - 109.8) / 1.7, 0, 1);
      const riseEase = ease.outCubic(riseU);
      const monumentY = THREE.MathUtils.lerp(-18.0, 0.0, riseEase);
      this.monumentGroup.position.set(0, monumentY, -760);

      // Dust shockwave expansion ring
      if (t >= 110.5 && t <= 114.5) {
        const shockU = (t - 110.5) / 4.0;
        this.shockwaveRing.position.set(0, 0.05, -760);
        this.shockwaveRing.scale.setScalar(1.0 + shockU * 45.0);
        (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = (1.0 - shockU) * 0.45;
        this.shockwaveRing.visible = true;
      } else {
        this.shockwaveRing.visible = false;
      }
    }

    // Gentle sunbeam pulsing with audio energy
    const beamPulse = (f.a?.kick ?? 0.0) * 0.25;
    this.sunBeamsGroup.rotation.z = t * 0.02;
    this.sunBeamsGroup.scale.setScalar(1.0 + beamPulse);

    // --- 6. 2D Canvas Kinetic Typography, HUD & Optical Flares ---
    this.layer2d.clear();
    const ctx = this.layer2d.ctx;

    // Line 30: "Do or die, I'll be in your arms" (97.11s - 101.50s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.0, yCar + 1.85, zCar + 0.4],
      cam: this.camera,
      t,
      lineIdx: 30,
      fontSize: 56,
      baseColor: 'rgba(254, 243, 199, 0.55)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.94)',
      leadInTime: 0.04,
    });

    // Line 31: "Oh, just cross your heart, oh, no takebacks" (101.50s - 106.50s)
    LyricRig.renderLine(ctx, {
      worldPos: [-0.4, yCar + 1.85, zCar - 1.2],
      cam: this.camera,
      t,
      lineIdx: 31,
      fontSize: 54,
      baseColor: 'rgba(254, 243, 199, 0.55)',
      highlightColor: COLOR_TOKENS.DAWN_SUNRISE_AMBER,
      haloColor: 'rgba(10, 13, 18, 0.94)',
    });

    // Line 32: "Unless you do it, do it with me" (106.50s - 111.50s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.0, yCar + 1.95, zCar - 0.4],
      cam: this.camera,
      t,
      lineIdx: 32,
      fontSize: 54,
      baseColor: 'rgba(254, 243, 199, 0.55)',
      highlightColor: COLOR_TOKENS.DAWN_SKY_MAGENTA,
      haloColor: 'rgba(10, 13, 18, 0.94)',
    });

    // Line 33: "No takebacks" (111.50s - 116.50s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.0, yCar + 2.8, zCar - 15.0],
      cam: this.camera,
      t,
      lineIdx: 33,
      fontSize: 66,
      baseColor: 'rgba(255, 255, 255, 0.95)',
      highlightColor: COLOR_TOKENS.GOLD_BULLION,
      haloColor: 'rgba(10, 13, 18, 0.96)',
    });

    // Anamorphic Sun Flare
    this.renderSunFlare(ctx, t);

    // Outro Golden Silence Fade (122.5s - 125.0s)
    if (t >= 122.5) {
      const whiteU = clamp((t - 122.5) / 2.5, 0, 1);
      const whiteEase = ease.inQuad(whiteU);
      ctx.save();
      ctx.fillStyle = `rgba(254, 243, 199, ${whiteEase * 0.96})`;
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.restore();
    }

    this.layer2d.upload();

    // --- 7. Render Passes & Composite ---
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // Dynamic Post-Processing Overrides
    let goldenBloom = 0.32;
    let extraExposure = 0.0;

    if (t >= 116.5) {
      const outroU = clamp((t - 116.5) / 8.5, 0, 1);
      goldenBloom = 0.32 + outroU * 0.16;
    }
    if (t >= 122.5) {
      const silenceU = clamp((t - 122.5) / 2.5, 0, 1);
      extraExposure = silenceU * 0.25;
    }

    return {
      exposure: 1.08 + extraExposure + touchdownImpact * 0.12,
      bloom: goldenBloom + (f.a?.kick ?? 0.0) * 0.08,
      ca: 0.45 + Math.sin(t * 2.0) * 0.05,
      vignette: 0.32,
      grain: 0.03,
    };
  }

  // -------------------------------------------------------------
  // Anamorphic Sun Flare & Horizon Radiance
  // -------------------------------------------------------------
  private renderSunFlare(ctx: CanvasRenderingContext2D, _t: number) {
    const proj = ViewportSpace.worldToScreen([0, 68, this.sunGroup.position.z], this.camera);
    if (!proj) return;
    const [sx, sy, sz] = proj;
    if (sz <= 0) return;
    if (sx < -200 || sx > 2120 || sy < -200 || sy > 1280) return;

    ctx.save();
    // 1. Soft coronal glow
    const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 220);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    coreGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.28)');
    coreGrad.addColorStop(0.5, 'rgba(245, 158, 11, 0.12)');
    coreGrad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, 220, 0, Math.PI * 2);
    ctx.fill();

    // 2. Subtle Anamorphic Horizontal Flare Streak
    const streakGrad = ctx.createLinearGradient(0, sy, 1920, sy);
    streakGrad.addColorStop(0, 'rgba(225, 29, 72, 0.0)');
    streakGrad.addColorStop(0.35, 'rgba(245, 158, 11, 0.08)');
    streakGrad.addColorStop(0.48, 'rgba(254, 240, 138, 0.35)');
    streakGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
    streakGrad.addColorStop(0.52, 'rgba(254, 240, 138, 0.35)');
    streakGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.08)');
    streakGrad.addColorStop(1, 'rgba(225, 29, 72, 0.0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(0, sy - 4, 1920, 8);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, sy - 1, 1920, 2);
    ctx.restore();
  }

  // -------------------------------------------------------------
  // Resource Cleanup
  // -------------------------------------------------------------
  override dispose(): void {
    this.groundGeo.dispose();
    this.saltGrid.geometry.dispose();
    this.skyGeo.dispose();
    this.saltSprayGeo.dispose();
    this.splintersMesh.geometry.dispose();
    for (const geo of this.monumentGeometries) {
      geo.dispose();
    }
    this.layer2d.texture.dispose();
  }
}

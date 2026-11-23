// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene 1: The Core Crucible (0.0s – 11.8s)
// Viopls Flagship Video Essay Chapter: 'The Memory Wall'
// Production standard: True 3D staging, PBR materiality, physical thin-lens DoF, motivated lighting,
// 60/30/10 token palette discipline, diegetic 3D typography, GPU volumetrics, and 3D spatial audio telemetry.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame, PostOverrides } from '../../engine/scene';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { springStep, clamp } from '../../engine/util';
import { createInWorldText, createInWorldText2D } from '../../engine/text_lighting';
import { AudioTelemetryEmitter, projectWorldToScreenPan } from '../../engine/audio';
import { LargeParticles } from '../../engine/particles_large';

export const coreTelemetry = new AudioTelemetryEmitter();

export default defineScene({
  id: 'core_crucible',

  setup: async (ctx: SceneContext) => {
    const scene = ctx.scene3D;

    // ────────────────────────────── 1. Motivated Lighting ──────────────────────────────
    // Key Light: 3200K Warm Tungsten Planckian Blackbody Radiator
    const [kr, kg, kb] = blackbodyToLinearSRGB(3200);
    const keyLight = new THREE.DirectionalLight(new THREE.Color(kr, kg, kb), 3.4);
    keyLight.position.set(3.8, 5.2, 3.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 28.0;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Rim/Fill Light: 6500K Cool Daylight Rim Luminaire
    const [dr, dg, db] = blackbodyToLinearSRGB(6500);
    const rimLight = new THREE.DirectionalLight(new THREE.Color(dr, dg, db), 1.8);
    rimLight.position.set(-4.5, 4.0, -4.2);
    scene.add(rimLight);

    // Ambient Ground Bounce (strictly non-flat)
    const ambientLight = new THREE.AmbientLight(0x0c0b0a, 0.45);
    scene.add(ambientLight);

    // Motivated Alert Strobe Point Light (activates during stall on downbeat 9.11s)
    const alertLight = new THREE.PointLight(0xff2a1f, 0, 8.5);
    alertLight.name = 'alertLight';
    alertLight.position.set(1.2, 1.8, 1.0);
    scene.add(alertLight);

    // ────────────────────────────── 2. PBR Materials ──────────────────────────────
    // 60% --void: Deep Cast Basalt Chassis (#050506)
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x080809,
      roughness: 0.86,
      metalness: 0.14,
    });

    // 30% --ash: Cold-Rolled Structural Titanium & Steel (#6B6A66)
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x6b6a66,
      roughness: 0.30,
      metalness: 0.82,
    });

    // 10% --bone: High-Purity Specular Finish Titanium (#E8E4DA)
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4da,
      roughness: 0.16,
      metalness: 0.94,
    });

    // Mirror-Polished Chrome for Hydraulic Guide Shafts
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f2,
      roughness: 0.04,
      metalness: 1.0,
    });

    // Beryllium-Copper Bus & Manifold Striking Plates
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xc87545,
      roughness: 0.32,
      metalness: 0.78,
    });

    // Optical Quartz Crystal Prisms (True Physical Transmission & Refraction)
    const quartzMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.06,
      metalness: 0.04,
      transmission: 0.92,
      ior: 1.54,
      thickness: 0.8,
      transparent: true,
      opacity: 0.96,
    });

    // Incandescent Tungsten Filaments
    const filamentMat = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      emissive: new THREE.Color(kr, kg, kb),
      emissiveIntensity: 5.2,
      roughness: 0.1,
    });

    // Alert Pin Material (--signal #FF2A1F)
    const alertMat = new THREE.MeshStandardMaterial({
      color: 0x331010,
      emissive: 0x220505,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.5,
    });

    // ────────────────────────────── 3. Segmented Substrate & Foundry Bulkhead ──────────────────────────────
    // Modular Floor Tiles with Recessed Expansion Joints
    const floorGroup = new THREE.Group();
    const tileGeo = new THREE.BoxGeometry(2.8, 0.1, 2.8);
    for (let x = -4; x <= 4; x++) {
      for (let z = -4; z <= 4; z++) {
        const tile = new THREE.Mesh(tileGeo, basaltMat);
        tile.position.set(x * 2.9, -0.05, z * 2.9);
        tile.receiveShadow = true;
        floorGroup.add(tile);
      }
    }
    scene.add(floorGroup);

    // Rear Monolithic Foundry Bulkhead with Cable Trays
    const wallGeo = new THREE.BoxGeometry(26, 14, 1.5);
    const wallMesh = new THREE.Mesh(wallGeo, basaltMat);
    wallMesh.position.set(0, 6.0, -5.5);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    // Structural Perimeter Stanchions
    const stanchionGeo = new THREE.BoxGeometry(0.8, 12, 0.8);
    for (const sx of [-9.0, 9.0]) {
      const stanchion = new THREE.Mesh(stanchionGeo, steelMat);
      stanchion.position.set(sx, 5.0, -5.0);
      stanchion.castShadow = true;
      scene.add(stanchion);
    }

    // ────────────────────────────── 4. Machined Multi-Tier Titanium Turbine Rotor ──────────────────────────────
    const spindleGroup = new THREE.Group();
    spindleGroup.name = 'spindleGroup';

    // 4.1 Stepped Central Hub Core
    const hubBaseGeo = new THREE.CylinderGeometry(0.95, 1.1, 0.45, 32);
    const hubBase = new THREE.Mesh(hubBaseGeo, titaniumMat);
    hubBase.position.y = -0.3;
    hubBase.castShadow = true;
    spindleGroup.add(hubBase);

    const hubCenterGeo = new THREE.CylinderGeometry(0.72, 0.85, 1.4, 32);
    const hubCenter = new THREE.Mesh(hubCenterGeo, titaniumMat);
    hubCenter.castShadow = true;
    spindleGroup.add(hubCenter);

    const hubCapGeo = new THREE.CylinderGeometry(0.35, 0.55, 0.35, 32);
    const hubCap = new THREE.Mesh(hubCapGeo, steelMat);
    hubCap.position.y = 0.85;
    hubCap.castShadow = true;
    spindleGroup.add(hubCap);

    // 4.2 Hexagonal Bolt Pattern Circle around Hub
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6);
    for (let b = 0; b < 8; b++) {
      const bAngle = (b / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(boltGeo, steelMat);
      bolt.position.set(Math.cos(bAngle) * 0.55, 0.72, Math.sin(bAngle) * 0.55);
      bolt.castShadow = true;
      spindleGroup.add(bolt);
    }

    // 4.3 16 Cambered, Swept Aerodynamic Blades with Root Cowlings
    const bladeCount = 16;
    const bladeCuffGeo = new THREE.BoxGeometry(0.14, 0.22, 0.35);
    const bladeBodyGeo = new THREE.BoxGeometry(0.065, 0.52, 1.35);

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      const bladeSubgroup = new THREE.Group();
      bladeSubgroup.position.set(Math.cos(angle) * 0.78, 0, Math.sin(angle) * 0.78);
      bladeSubgroup.rotation.y = -angle;

      // Root Cuff Collar
      const cuff = new THREE.Mesh(bladeCuffGeo, steelMat);
      cuff.position.set(0, 0, 0.15);
      cuff.castShadow = true;
      bladeSubgroup.add(cuff);

      // Aerodynamic Blade Fin with Compound Pitch Twist
      const bladeFin = new THREE.Mesh(bladeBodyGeo, titaniumMat);
      bladeFin.position.set(0, 0, 0.82);
      bladeFin.rotation.x = 0.32; // Aerodynamic pitch angle
      bladeFin.castShadow = true;
      bladeSubgroup.add(bladeFin);

      spindleGroup.add(bladeSubgroup);
    }

    spindleGroup.position.set(0, 1.25, 0);
    scene.add(spindleGroup);

    // 4.4 Stationary Outer Stator Cowling & Guide Vanes (Surrounding Rotor)
    const statorGroup = new THREE.Group();
    const statorRingGeo = new THREE.TorusGeometry(2.35, 0.10, 16, 64);
    const statorRingUpper = new THREE.Mesh(statorRingGeo, steelMat);
    statorRingUpper.rotation.x = Math.PI / 2;
    statorRingUpper.position.y = 1.85;
    statorGroup.add(statorRingUpper);

    const statorRingLower = new THREE.Mesh(statorRingGeo, steelMat);
    statorRingLower.rotation.x = Math.PI / 2;
    statorRingLower.position.y = 0.65;
    statorGroup.add(statorRingLower);

    // 24 Radial Stator Guide Vanes
    const statorVaneGeo = new THREE.BoxGeometry(0.05, 1.1, 0.45);
    for (let v = 0; v < 24; v++) {
      const vAngle = (v / 24) * Math.PI * 2;
      const vane = new THREE.Mesh(statorVaneGeo, steelMat);
      vane.position.set(Math.cos(vAngle) * 2.35, 1.25, Math.sin(vAngle) * 2.35);
      vane.rotation.y = -vAngle + Math.PI / 2;
      vane.castShadow = true;
      statorGroup.add(vane);
    }

    // Heavy Stator Mounting Pedestals
    const pedestalGeo = new THREE.BoxGeometry(0.35, 1.3, 0.5);
    for (let p = 0; p < 4; p++) {
      const pAngle = (p / 4) * Math.PI * 2 + Math.PI / 4;
      const pedestal = new THREE.Mesh(pedestalGeo, basaltMat);
      pedestal.position.set(Math.cos(pAngle) * 2.5, 0.65, Math.sin(pAngle) * 2.5);
      pedestal.castShadow = true;
      statorGroup.add(pedestal);
    }
    scene.add(statorGroup);

    // ────────────────────────────── 5. Hexagonal Quartz Heat Exchanger Towers ──────────────────────────────
    const heatPlinthGeo = new THREE.BoxGeometry(0.9, 0.4, 0.9);
    const heatFinGeo = new THREE.BoxGeometry(0.85, 0.04, 0.85);
    const quartzCoreGeo = new THREE.CylinderGeometry(0.24, 0.24, 3.8, 6); // Hexagonal prism
    const filamentGeo = new THREE.CylinderGeometry(0.035, 0.035, 3.6, 16);
    const heatpipeGeo = new THREE.TorusGeometry(0.35, 0.04, 12, 16, Math.PI);

    const towerCoords: [number, number, number][] = [
      [-3.4, 2.2, -1.8],
      [-3.4, 2.2, 1.8],
      [3.4, 2.2, -1.8],
      [3.4, 2.2, 1.8],
      [-4.6, 2.2, 0.0],
      [4.6, 2.2, 0.0],
    ];

    towerCoords.forEach((pos) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(...pos);

      // Base Mounting Plinth
      const plinth = new THREE.Mesh(heatPlinthGeo, basaltMat);
      plinth.position.y = -1.95;
      plinth.receiveShadow = true;
      towerGroup.add(plinth);

      // Curved Copper Heatpipe Exhausts into Floor
      const pipeL = new THREE.Mesh(heatpipeGeo, copperMat);
      pipeL.rotation.z = Math.PI / 2;
      pipeL.position.set(-0.35, -1.75, 0);
      towerGroup.add(pipeL);

      const pipeR = new THREE.Mesh(heatpipeGeo, copperMat);
      pipeR.rotation.z = -Math.PI / 2;
      pipeR.position.set(0.35, -1.75, 0);
      towerGroup.add(pipeR);

      // Stacked Cooling Fins (12 horizontal plates per tower)
      for (let f = 0; f < 12; f++) {
        const fin = new THREE.Mesh(heatFinGeo, steelMat);
        fin.position.y = -1.4 + f * 0.26;
        fin.castShadow = true;
        towerGroup.add(fin);
      }

      // Optical Quartz Crystal Core (True Transmission PBR)
      const quartzPrism = new THREE.Mesh(quartzCoreGeo, quartzMat);
      quartzPrism.castShadow = true;
      towerGroup.add(quartzPrism);

      // Glowing Incandescent Tungsten Filament
      const filament = new THREE.Mesh(filamentGeo, filamentMat);
      towerGroup.add(filament);

      scene.add(towerGroup);
    });

    // ────────────────────────────── 6. Heavy Hydraulic Diverter Manifold ──────────────────────────────
    const diverterGroup = new THREE.Group();
    diverterGroup.name = 'diverterGroup';
    diverterGroup.position.set(2.8, 0, 0.6);

    // 6.1 Vertical Structural Gantry Frame
    const gantryColGeo = new THREE.BoxGeometry(0.35, 3.4, 0.35);
    const colL = new THREE.Mesh(gantryColGeo, basaltMat);
    colL.position.set(-0.3, 1.7, -1.2);
    colL.castShadow = true;
    diverterGroup.add(colL);

    const colR = new THREE.Mesh(gantryColGeo, basaltMat);
    colR.position.set(-0.3, 1.7, 1.2);
    colR.castShadow = true;
    diverterGroup.add(colR);

    const crownBeamGeo = new THREE.BoxGeometry(0.45, 0.4, 2.8);
    const crownBeam = new THREE.Mesh(crownBeamGeo, steelMat);
    crownBeam.position.set(-0.3, 3.3, 0);
    crownBeam.castShadow = true;
    diverterGroup.add(crownBeam);

    // 6.2 Dual Polished Chrome Guide Shafts
    const shaftGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 24);
    const shaftL = new THREE.Mesh(shaftGeo, chromeMat);
    shaftL.position.set(0, 1.7, -0.75);
    diverterGroup.add(shaftL);

    const shaftR = new THREE.Mesh(shaftGeo, chromeMat);
    shaftR.position.set(0, 1.7, 0.75);
    diverterGroup.add(shaftR);

    // 6.3 Interlocking Guillotine Jaw Blocks
    const jawBlockGeo = new THREE.BoxGeometry(0.28, 1.5, 0.44);
    const toothGeo = new THREE.BoxGeometry(0.24, 0.14, 0.20);

    // Moving Left Jaw
    const gateLeft = new THREE.Group();
    gateLeft.name = 'gateLeft';
    gateLeft.position.set(0, 1.5, -0.55);

    const leftBody = new THREE.Mesh(jawBlockGeo, copperMat);
    leftBody.position.set(0, 0, -0.32);
    leftBody.castShadow = true;
    gateLeft.add(leftBody);

    // 4 Interlocking Teeth on Left Jaw
    const leftToothY = [-0.54, -0.18, 0.18, 0.54];
    for (const yPos of leftToothY) {
      const tooth = new THREE.Mesh(toothGeo, titaniumMat);
      tooth.position.set(0, yPos, 0.0);
      tooth.castShadow = true;
      gateLeft.add(tooth);
    }
    diverterGroup.add(gateLeft);

    // Moving Right Jaw
    const gateRight = new THREE.Group();
    gateRight.name = 'gateRight';
    gateRight.position.set(0, 1.5, 0.55);

    const rightBody = new THREE.Mesh(jawBlockGeo, copperMat);
    rightBody.position.set(0, 0, 0.32);
    rightBody.castShadow = true;
    gateRight.add(rightBody);

    // 3 Interlocking Teeth on Right Jaw (Interlacing with Left)
    const rightToothY = [-0.36, 0.0, 0.36];
    for (const yPos of rightToothY) {
      const tooth = new THREE.Mesh(toothGeo, titaniumMat);
      tooth.position.set(0, yPos, 0.0);
      tooth.castShadow = true;
      gateRight.add(tooth);
    }
    diverterGroup.add(gateRight);

    // 6.4 Hydraulic Piston Cylinders
    const pistonCylGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.1, 24);
    const cylL = new THREE.Mesh(pistonCylGeo, steelMat);
    cylL.position.set(0, 2.6, -0.75);
    diverterGroup.add(cylL);

    const cylR = new THREE.Mesh(pistonCylGeo, steelMat);
    cylR.position.set(0, 2.6, 0.75);
    diverterGroup.add(cylR);

    // 6.5 Warning Chevrons & Alert Pin
    const alertPinGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 16);
    const alertPin = new THREE.Mesh(alertPinGeo, alertMat);
    alertPin.name = 'alertPin';
    alertPin.rotation.x = Math.PI / 2;
    alertPin.position.set(0.15, 2.8, 0);
    diverterGroup.add(alertPin);

    scene.add(diverterGroup);

    // ────────────────────────────── 7. Atmospheric Convective GPU Particles ──────────────────────────────
    ctx.largeParticles.configure({
      count: 3200,
      mode: 'free',
      style: 'streak',
      seed: 77,
      size: [0.0015, 0.0045],
      life: [2.5, 5.5],
      color: { mode: 'blackbody', range: [2600, 3800] },
      intensity: 0.45,
      turbulence: { amp: 0.6, freq: 0.4, drift: 0.12 },
      free: {
        center: [0, 1.5, 0],
        shell: [1.8, 5.2],
        dir: [0, 1, 0],
        speed: 0.65,
        spread: 0.30,
      },
    });

    // ────────────────────────────── 8. Diegetic 3D Typography ──────────────────────────────
    // Hero Architectural Header: THE MEMORY WALL (Mounted proud on upper basalt monolith)
    const titleGroup = createInWorldText('THE MEMORY WALL', {
      size: 0.54,
      depth: 0.14,
      color: 0xe8e4da,
      roughness: 0.18,
      metalness: 0.92,
      castShadow: true,
      receiveShadow: true,
    });
    titleGroup.position.set(-3.2, 3.8, -4.8);
    scene.add(titleGroup);

    // Dedicated Motivated Luminaire for Hero Title Typography
    const titleLight = new THREE.DirectionalLight(0xe8e4da, 2.4);
    titleLight.position.set(-1.0, 5.5, -1.0);
    titleLight.target.position.set(-3.2, 3.8, -4.8);
    scene.add(titleLight);
    scene.add(titleLight.target);

    // Technical Baseline Metric
    const labelGroup = createInWorldText2D('CORE CLOCK: 4.2 GHz // L1 CACHE INTAKE // 64-BYTE LINE', {
      size: 0.18,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0x9c978f,
        roughness: 0.35,
        metalness: 0.65,
      }),
    });
    labelGroup.position.set(-3.2, 0.02, 2.2);
    labelGroup.rotation.x = -Math.PI / 2;
    scene.add(labelGroup);

    // Stamped Stall Alert Text
    const stallGroup = createInWorldText2D('STALL // CACHE MISS // LATENCY BOTTLENECK', {
      size: 0.22,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0xff2a1f,
        emissive: 0x880a06,
        roughness: 0.22,
      }),
    });
    stallGroup.name = 'stallGroup';
    stallGroup.position.set(0.6, 0.02, 1.8);
    stallGroup.rotation.x = -Math.PI / 2;
    stallGroup.visible = false;
    scene.add(stallGroup);
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides => {
    const scene = ctx.scene3D;
    const t = f.t;
    const p = f.p; // 0..1 across scene window

    // ────────────────────────────── 1. Camera Choreography ──────────────────────────────
    // Base trajectory for Shot 1 (Turbine Core Vortex):
    const shot1CamX = Math.sin(p * Math.PI * 0.7) * 1.8;
    const shot1CamY = 2.4 - 0.6 * p + 0.35 * Math.sin(p * Math.PI);
    const shot1CamZ = 6.4 - 4.2 * p;

    // Shot 2 framing for Gate Slam (p > 0.62):
    // C1 smoothstep transition from Shot 1 wide to Shot 2 three-quarter macro perspective
    // Positioned at (2.05, 2.25, 4.25) looking at (2.80, 1.45, 0.60) to completely clear stator guide vanes
    let camX = shot1CamX;
    let camY = shot1CamY;
    let camZ = shot1CamZ;

    let targetX = 0;
    let targetY = 1.15 - 0.3 * p;
    let targetZ = 0;
    let smoothU = 0;

    if (p > 0.62) {
      const uGate = clamp((p - 0.62) / 0.13, 0, 1);
      smoothU = uGate * uGate * (3.0 - 2.0 * uGate);

      camX = shot1CamX * (1.0 - smoothU) + 4.60 * smoothU;
      camY = shot1CamY * (1.0 - smoothU) + 1.95 * smoothU;
      camZ = shot1CamZ * (1.0 - smoothU) + 1.30 * smoothU;

      targetX = 0 * (1.0 - smoothU) + 2.80 * smoothU;
      targetY = (1.15 - 0.3 * p) * (1.0 - smoothU) + 1.45 * smoothU;
      targetZ = 0 * (1.0 - smoothU) + 0.60 * smoothU;
    }

    // Downbeat Hit Impulse (pulses on downbeats: 0.43s, 2.60s, 4.77s, 6.94s, 9.11s)
    const downbeats = [0.43, 2.6, 4.77, 6.94, 9.11];
    let hitOffset = 0;
    for (const db of downbeats) {
      if (t >= db && t < db + 0.35) {
        hitOffset += 0.06 * Math.exp(-(t - db) * 12.0) * Math.sin((t - db) * 45.0);
      }
    }

    // High-Frequency Frame Tremor
    const frameIdx = Math.floor(t * 60);
    const tremorX = ((frameIdx * 9301 + 49297) % 233280) / 233280 - 0.5;
    const tremorY = ((frameIdx * 49297 + 9301) % 233280) / 233280 - 0.5;
    const tremorAmt = 0.0032;

    ctx.threeCam.position.set(
      camX + hitOffset + tremorX * tremorAmt,
      camY + tremorY * tremorAmt,
      camZ
    );
    ctx.threeCam.lookAt(targetX, targetY, targetZ);
    ctx.threeCam.updateMatrixWorld();

    // ────────────────────────────── 2. Dynamic Object Mechanics ──────────────────────────────
    // Spindle Rotor Rotation: Closed-form analytical angle integration (zero retro-rotational shudder)
    const spindle = scene.getObjectByName('spindleGroup');
    let rotorSpeed = 42.0;
    if (spindle) {
      if (t <= 8.5) {
        spindle.rotation.y = t * 42.0;
      } else {
        const u = clamp((t - 8.5) / 2.5, 0, 1);
        rotorSpeed = 42.0 * Math.pow(1.0 - u, 2.5) + 0.8;
        spindle.rotation.y = 357.0 + 30.0 * (1.0 - Math.pow(1.0 - u, 3.5)) + 2.0 * u;
      }
    }

    // Hydraulic Gate Slam on Downbeat 9.11s & Alert Strobe
    const gateLeft = scene.getObjectByName('gateLeft');
    const gateRight = scene.getObjectByName('gateRight');
    const alertPin = scene.getObjectByName('alertPin') as THREE.Mesh;
    const alertLight = scene.getObjectByName('alertLight') as THREE.PointLight;
    const stallGroup = scene.getObjectByName('stallGroup');

    if (t >= 9.11) {
      const gateSettle = springStep(t - 9.11, 18.0, 0.68);
      // Gates snap together from open (0.55) to shut (0.00)
      const currentSpan = 0.55 * (1.0 - gateSettle);
      if (gateLeft) gateLeft.position.z = -currentSpan;
      if (gateRight) gateRight.position.z = currentSpan;

      // Indicator LED pin turns from dark to high-contrast alert #FF2A1F
      if (alertPin && alertPin.material instanceof THREE.MeshStandardMaterial) {
        alertPin.material.color.set(0xff2a1f);
        alertPin.material.emissive.set(0xff1812);
        alertPin.material.emissiveIntensity = 3.2;
      }

      // Motivated alert strobe light illuminating quartz heatsinks
      if (alertLight) {
        const strobePulse = Math.sin((t - 9.11) * 9.0) * 0.5 + 0.5;
        alertLight.intensity = 3.2 * strobePulse;
      }

      if (stallGroup) stallGroup.visible = true;
    } else {
      if (gateLeft) gateLeft.position.z = -0.55;
      if (gateRight) gateRight.position.z = 0.55;
      if (alertLight) alertLight.intensity = 0;
      if (stallGroup) stallGroup.visible = false;
    }

    // ────────────────────────────── 3. 3D Spatial Audio Telemetry ──────────────────────────────
    const spindleWorldPos: [number, number, number] = [0, 1.25, 0];
    const { pan, distance, ndc } = projectWorldToScreenPan(
      spindleWorldPos,
      ctx.threeCam.matrixWorldInverse.elements,
      ctx.threeCam.projectionMatrix.elements,
      0.65
    );

    coreTelemetry.emit('core_spindle', {
      sourceId: 'core_spindle',
      pos: spindleWorldPos,
      screenPos: ndc,
      pan,
      distance,
      velocity: rotorSpeed * 0.15,
      zone: 'crucible_chamber',
      occluded: false,
    });
    coreTelemetry.captureFrame(frameIdx, t);

    // ────────────────────────────── 4. Flush GPU Draw Pipeline ──────────────────────────────
    ctx.flush(out, true);

    // 4.1 Composite GPU Instanced Convective Thermal Embers
    ctx.largeParticles.render(ctx.renderer, ctx.threeCam, out, t);

    // ────────────────────────────── 5. Physical Optics Post-Processing ──────────────────────────────
    const baseFocus = 4.8 - 1.8 * p;
    const focusDist = p < 0.62 ? baseFocus : (baseFocus * (1.0 - smoothU) + 2.00 * smoothU);

    return {
      exposure: 1.10,
      bloom: 0.38,
      bloomThreshold: 0.82,
      halation: 0.18,
      ca: 1.4,
      grain: 0.05,
      vignette: 0.36,
      depthDof: {
        enabled: true,
        focusDistance: focusDist,
        aperture: 18.0,
        blades: 9,
        anamorphicRatio: 1.0,
      },
    };
  },
});

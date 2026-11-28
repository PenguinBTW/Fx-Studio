// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene 2: The Interconnect Chasm (10.8s – 20.5s)
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

export const chasmTelemetry = new AudioTelemetryEmitter();

export default defineScene({
  id: 'interconnect_chasm',

  setup: async (ctx: SceneContext) => {
    const scene = ctx.scene3D;

    // ────────────────────────────── 1. Motivated Lighting ──────────────────────────────
    // Key Rim Light: 6500K Cool Daylight Rim Luminaire (Raking across canyon rails)
    const [dr, dg, db] = blackbodyToLinearSRGB(6500);
    const keyLight = new THREE.DirectionalLight(new THREE.Color(dr, dg, db), 3.6);
    keyLight.position.set(-5.5, 7.5, -8.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 48.0;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Warm Secondary Fill Light: 3200K Tungsten Core Spillover from outgoing origin
    const [kr, kg, kb] = blackbodyToLinearSRGB(3200);
    const fillLight = new THREE.DirectionalLight(new THREE.Color(kr, kg, kb), 1.4);
    fillLight.position.set(4.5, 3.5, 8.0);
    scene.add(fillLight);

    // Subtle Ambient Void Tone
    const ambientLight = new THREE.AmbientLight(0x0a0a0c, 0.45);
    scene.add(ambientLight);

    // ────────────────────────────── 2. PBR Materials ──────────────────────────────
    // 60% --void: Cast Basalt Canyon Walls (#050506)
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x070708,
      roughness: 0.88,
      metalness: 0.12,
    });

    // 30% --ash: Structural Industrial Steel Pylons & Arches (#6B6A66)
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x6b6a66,
      roughness: 0.32,
      metalness: 0.84,
    });

    // 10% --bone: High-Purity Titanium Carrier Capsule Fuselage (#E8E4DA)
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4da,
      roughness: 0.18,
      metalness: 0.92,
    });

    // Mirror-Polished Chrome for Hydraulic Buffers
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f2,
      roughness: 0.04,
      metalness: 1.0,
    });

    // Precision Copper Bus Rails & Inductor Shoes
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xdf8450,
      roughness: 0.24,
      metalness: 0.88,
    });

    // Ceramic Standoff Insulator Material (Glazed Porcelain)
    const ceramicMat = new THREE.MeshStandardMaterial({
      color: 0x2e3034,
      roughness: 0.15,
      metalness: 0.40,
    });

    // Optical Waveguide Core & Sensor Lens Material (Physical Transmission)
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.04,
      metalness: 0.05,
      transmission: 0.95,
      ior: 1.54,
      thickness: 0.5,
      transparent: true,
      opacity: 0.98,
    });

    // Waveguide Optic Core Emission
    const opticMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(kr, kg, kb),
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    // Rear Plasma Jet Glow Material
    const plasmaMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      emissive: 0x2266ff,
      emissiveIntensity: 4.0,
      roughness: 0.2,
    });

    // ────────────────────────────── 3. Architectural Tiered Basalt Canyon ──────────────────────────────
    const canyonGroup = new THREE.Group();

    // 3.1 Tiered Basalt Monolith Blocks (12 modular segments along each canyon wall)
    const blockGeo = new THREE.BoxGeometry(1.6, 14, 3.8);
    const ductGeo = new THREE.BoxGeometry(0.3, 10, 0.4);
    const strutGeo = new THREE.BoxGeometry(0.2, 0.2, 3.5);

    for (let i = 0; i < 12; i++) {
      const zPos = 6 - i * 4.0;

      // Left Wall Monolith Block
      const blockL = new THREE.Mesh(blockGeo, basaltMat);
      blockL.position.set(-5.4, 5.5, zPos);
      blockL.receiveShadow = true;
      canyonGroup.add(blockL);

      // Recessed High-Voltage Utility Duct
      const ductL = new THREE.Mesh(ductGeo, steelMat);
      ductL.position.set(-4.5, 5.0, zPos);
      canyonGroup.add(ductL);

      // Right Wall Monolith Block
      const blockR = new THREE.Mesh(blockGeo, basaltMat);
      blockR.position.set(5.4, 5.5, zPos);
      blockR.receiveShadow = true;
      canyonGroup.add(blockR);

      const ductR = new THREE.Mesh(ductGeo, steelMat);
      ductR.position.set(4.5, 5.0, zPos);
      canyonGroup.add(ductR);

      // Diagonal Seismic Steel Shoring Struts every 8 meters
      if (i % 2 === 0) {
        const strutL = new THREE.Mesh(strutGeo, steelMat);
        strutL.position.set(-3.2, 2.2, zPos);
        strutL.rotation.y = 0.4;
        strutL.rotation.z = -0.3;
        canyonGroup.add(strutL);

        const strutR = new THREE.Mesh(strutGeo, steelMat);
        strutR.position.set(3.2, 2.2, zPos);
        strutR.rotation.y = -0.4;
        strutR.rotation.z = 0.3;
        canyonGroup.add(strutR);
      }
    }

    // Substrate Floor Trench
    const floorGeo = new THREE.PlaneGeometry(12, 60, 4, 16);
    const floorMesh = new THREE.Mesh(floorGeo, basaltMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.05, -15);
    floorMesh.receiveShadow = true;
    canyonGroup.add(floorMesh);

    scene.add(canyonGroup);

    // ────────────────────────────── 4. Copper Bus Rails & Ceramic Standoffs ──────────────────────────────
    // Dual Precision Copper Bus Rails along Z-axis
    const railHeadGeo = new THREE.BoxGeometry(0.14, 0.12, 52);
    const leftRail = new THREE.Mesh(railHeadGeo, copperMat);
    leftRail.position.set(-0.85, 0.16, -15);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    scene.add(leftRail);

    const rightRail = new THREE.Mesh(railHeadGeo, copperMat);
    rightRail.position.set(0.85, 0.16, -15);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;
    scene.add(rightRail);

    // Center Optical Waveguide Conduit
    const conduitGeo = new THREE.CylinderGeometry(0.045, 0.045, 52, 16);
    const centerConduit = new THREE.Mesh(conduitGeo, opticMat);
    centerConduit.rotation.x = Math.PI / 2;
    centerConduit.position.set(0, 0.08, -15);
    scene.add(centerConduit);

    // Structural Cross Ties & Ceramic Standoff Insulators (every 1.5 meters)
    const tieGeo = new THREE.BoxGeometry(2.6, 0.08, 0.32);
    const insulatorGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.10, 12);

    for (let z = 6; z >= -36; z -= 1.5) {
      const tie = new THREE.Mesh(tieGeo, steelMat);
      tie.position.set(0, 0.02, z);
      tie.receiveShadow = true;
      scene.add(tie);

      // Left Standoff Insulator
      const insL = new THREE.Mesh(insulatorGeo, ceramicMat);
      insL.position.set(-0.85, 0.08, z);
      scene.add(insL);

      // Right Standoff Insulator
      const insR = new THREE.Mesh(insulatorGeo, ceramicMat);
      insR.position.set(0.85, 0.08, z);
      scene.add(insR);
    }

    // Overhead Brutalist Cantilever Arches with Guy-Wires & Beacon Lights (every 8 meters)
    const archPillarGeo = new THREE.BoxGeometry(0.65, 6.5, 0.65);
    const archBeamGeo = new THREE.BoxGeometry(9.8, 0.85, 0.65);
    const guyWireGeo = new THREE.CylinderGeometry(0.015, 0.015, 4.2, 8);
    const beaconGeo = new THREE.SphereGeometry(0.08, 12, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffbb44,
      emissive: 0xff8811,
      emissiveIntensity: 3.5,
    });

    for (let z = 0; z >= -32; z -= 8.0) {
      const archGroup = new THREE.Group();

      const archPillarL = new THREE.Mesh(archPillarGeo, basaltMat);
      archPillarL.position.set(-4.6, 3.25, z);
      archGroup.add(archPillarL);

      const archPillarR = new THREE.Mesh(archPillarGeo, basaltMat);
      archPillarR.position.set(4.6, 3.25, z);
      archGroup.add(archPillarR);

      const archBeam = new THREE.Mesh(archBeamGeo, steelMat);
      archBeam.position.set(0, 6.2, z);
      archBeam.castShadow = true;
      archGroup.add(archBeam);

      // Diagonal Catenary Guy-Wires
      const wireL = new THREE.Mesh(guyWireGeo, chromeMat);
      wireL.position.set(-2.8, 4.6, z);
      wireL.rotation.z = 0.55;
      archGroup.add(wireL);

      const wireR = new THREE.Mesh(guyWireGeo, chromeMat);
      wireR.position.set(2.8, 4.6, z);
      wireR.rotation.z = -0.55;
      archGroup.add(wireR);

      // Status Beacon Lights
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 5.65, z + 0.35);
      archGroup.add(beacon);

      scene.add(archGroup);
    }

    // ────────────────────────────── 5. Hero Aerodynamic Titanium Carrier Capsule ──────────────────────────────
    const capsuleGroup = new THREE.Group();
    capsuleGroup.name = 'capsuleGroup';

    // 5.1 Main Sculpted Fuselage Hull
    const mainHullGeo = new THREE.BoxGeometry(1.35, 0.48, 2.7);
    const mainHull = new THREE.Mesh(mainHullGeo, titaniumMat);
    mainHull.castShadow = true;
    mainHull.receiveShadow = true;
    capsuleGroup.add(mainHull);

    // Lateral Chamfer Flanks (Tumblehome Aerospace Aerodynamics)
    const flankGeo = new THREE.BoxGeometry(0.22, 0.32, 2.4);
    const flankL = new THREE.Mesh(flankGeo, steelMat);
    flankL.position.set(-0.68, -0.05, 0);
    flankL.rotation.z = 0.25;
    flankL.castShadow = true;
    capsuleGroup.add(flankL);

    const flankR = new THREE.Mesh(flankGeo, steelMat);
    flankR.position.set(0.68, -0.05, 0);
    flankR.rotation.z = -0.25;
    flankR.castShadow = true;
    capsuleGroup.add(flankR);

    // 5.2 Stealth Chisel Nose Cone
    const noseGeo = new THREE.ConeGeometry(0.68, 0.95, 4);
    const noseMesh = new THREE.Mesh(noseGeo, titaniumMat);
    noseMesh.rotation.x = -Math.PI / 2;
    noseMesh.rotation.y = Math.PI / 4;
    noseMesh.position.set(0, 0, -1.8);
    noseMesh.castShadow = true;
    capsuleGroup.add(noseMesh);

    // Forward Optical Rangefinder Sensor Lenses
    const sensorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.12, 16);
    const sensorL = new THREE.Mesh(sensorGeo, lensMat);
    sensorL.rotation.x = Math.PI / 2;
    sensorL.position.set(-0.25, 0.05, -1.9);
    capsuleGroup.add(sensorL);

    const sensorR = new THREE.Mesh(sensorGeo, lensMat);
    sensorR.rotation.x = Math.PI / 2;
    sensorR.position.set(0.25, 0.05, -1.9);
    capsuleGroup.add(sensorR);

    // Forward Daylight Laser Guide Slits (6500K Beams)
    const guideGeo = new THREE.BoxGeometry(0.08, 0.04, 0.18);
    const guideMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(dr, dg, db),
      emissiveIntensity: 4.8,
      roughness: 0.1,
    });
    const guideL = new THREE.Mesh(guideGeo, guideMat);
    guideL.position.set(-0.48, 0.05, -1.65);
    capsuleGroup.add(guideL);

    const guideR = new THREE.Mesh(guideGeo, guideMat);
    guideR.position.set(0.48, 0.05, -1.65);
    capsuleGroup.add(guideR);

    // 5.3 Cryo-Cooled Maglev Runner Skates with Dynamic Dissipation
    const runnerGeo = new THREE.BoxGeometry(0.18, 0.16, 2.5);
    const runnerLMat = copperMat.clone();
    const runnerRMat = copperMat.clone();

    const runnerL = new THREE.Mesh(runnerGeo, runnerLMat);
    runnerL.name = 'runnerL';
    runnerL.position.set(-0.85, -0.28, 0);
    runnerL.castShadow = true;
    capsuleGroup.add(runnerL);

    const runnerR = new THREE.Mesh(runnerGeo, runnerRMat);
    runnerR.name = 'runnerR';
    runnerR.position.set(0.85, -0.28, 0);
    runnerR.castShadow = true;
    capsuleGroup.add(runnerR);

    // 5.4 Rear Twin Reaction Nozzles with Internal Plasma Glow
    const nozzleGeo = new THREE.CylinderGeometry(0.16, 0.24, 0.35, 16);
    const nozzleL = new THREE.Mesh(nozzleGeo, steelMat);
    nozzleL.rotation.x = Math.PI / 2;
    nozzleL.position.set(-0.42, 0, 1.45);
    capsuleGroup.add(nozzleL);

    const nozzleR = new THREE.Mesh(nozzleGeo, steelMat);
    nozzleR.rotation.x = Math.PI / 2;
    nozzleR.position.set(0.42, 0, 1.45);
    capsuleGroup.add(nozzleR);

    const plasmaGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16);
    const plasmaL = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaL.rotation.x = Math.PI / 2;
    plasmaL.position.set(-0.42, 0, 1.55);
    capsuleGroup.add(plasmaL);

    const plasmaR = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaR.rotation.x = Math.PI / 2;
    plasmaR.position.set(0.42, 0, 1.55);
    capsuleGroup.add(plasmaR);

    // 5.5 Recessed Top Avionics Deck for Stamped Typography
    const deckPlinthGeo = new THREE.BoxGeometry(1.05, 0.02, 1.4);
    const deckPlinth = new THREE.Mesh(deckPlinthGeo, steelMat);
    deckPlinth.position.set(0, 0.25, 0.32);
    capsuleGroup.add(deckPlinth);

    // Laser-Engraved Primary Metric Stamped on Capsule Top Plate
    const metricLabelGroup = createInWorldText2D('180ns', {
      size: 0.22,
      letterSpacing: 0.12,
      material: new THREE.MeshStandardMaterial({
        color: 0x050508,
        roughness: 0.12,
        metalness: 0.98,
      }),
    });
    metricLabelGroup.position.set(0, 0.265, 0.18);
    metricLabelGroup.rotation.x = -Math.PI / 2;
    capsuleGroup.add(metricLabelGroup);

    // Laser-Engraved Secondary Sub-Label on Capsule Top Plate
    const subLabelGroup = createInWorldText2D('LATENCY BOUNDARY', {
      size: 0.11,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0x18181c,
        roughness: 0.20,
        metalness: 0.90,
      }),
    });
    subLabelGroup.position.set(0, 0.265, 0.46);
    subLabelGroup.rotation.x = -Math.PI / 2;
    capsuleGroup.add(subLabelGroup);

    capsuleGroup.position.set(0, 0.44, 0);
    scene.add(capsuleGroup);

    // Motivated Macro Examination Luminaire for 512-bit DRAM Dock & Stamped Plate
    const macroLight = new THREE.DirectionalLight(0xe8e4da, 3.2);
    macroLight.position.set(2.4, 4.5, -12.0);
    macroLight.target.position.set(0, 0.44, -13.8);
    scene.add(macroLight);
    scene.add(macroLight.target);

    // ────────────────────────────── 6. Massive 512-bit DRAM Bulkhead Terminal & Arrestors ──────────────────────────────
    const dockGroup = new THREE.Group();
    dockGroup.name = 'dockGroup';
    dockGroup.position.set(0, 0.44, -14.0);

    // Heavy Bulkhead Endplate
    const bulkheadGeo = new THREE.BoxGeometry(4.8, 3.2, 0.8);
    const bulkheadMesh = new THREE.Mesh(bulkheadGeo, basaltMat);
    bulkheadMesh.position.set(0, 1.2, -0.6);
    bulkheadMesh.receiveShadow = true;
    dockGroup.add(bulkheadMesh);

    // 6 Horizontal Structural Steel Cooling Fins on Bulkhead Face
    const bulkheadFinGeo = new THREE.BoxGeometry(4.4, 0.06, 0.25);
    for (let f = 0; f < 6; f++) {
      const fin = new THREE.Mesh(bulkheadFinGeo, steelMat);
      fin.position.set(0, 0.4 + f * 0.42, -0.15);
      fin.castShadow = true;
      dockGroup.add(fin);
    }

    // Interconnect Copper Bus Terminal Blocks
    const busBlockGeo = new THREE.BoxGeometry(0.65, 1.8, 0.35);
    const busBlockL = new THREE.Mesh(busBlockGeo, copperMat);
    busBlockL.position.set(-1.8, 1.2, -0.2);
    dockGroup.add(busBlockL);

    const busBlockR = new THREE.Mesh(busBlockGeo, copperMat);
    busBlockR.position.set(1.8, 1.2, -0.2);
    dockGroup.add(busBlockR);

    // Telescoping Chrome Hydraulic Buffers
    const bufferGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 24);
    const buffL = new THREE.Mesh(bufferGeo, chromeMat);
    buffL.rotation.x = Math.PI / 2;
    buffL.position.set(-0.85, 0, -0.1);
    dockGroup.add(buffL);

    const buffR = new THREE.Mesh(bufferGeo, chromeMat);
    buffR.rotation.x = Math.PI / 2;
    buffR.position.set(0.85, 0, -0.1);
    dockGroup.add(buffR);

    // Lateral Arrestor Caliper Clamps
    const dockClampGeo = new THREE.BoxGeometry(0.38, 0.65, 0.95);
    const dockClampL = new THREE.Mesh(dockClampGeo, steelMat);
    dockClampL.name = 'dockClampL';
    dockClampL.position.set(-1.15, 0, 0);
    dockClampL.castShadow = true;
    dockGroup.add(dockClampL);

    const dockClampR = new THREE.Mesh(dockClampGeo, steelMat);
    dockClampR.name = 'dockClampR';
    dockClampR.position.set(1.15, 0, 0);
    dockClampR.castShadow = true;
    dockGroup.add(dockClampR);

    scene.add(dockGroup);

    // ────────────────────────────── 7. Atmospheric High-Speed Slipstream GPU Particles ──────────────────────────────
    ctx.largeParticles.configure({
      count: 14000,
      mode: 'fall',
      style: 'streak',
      seed: 88,
      size: [0.002, 0.008],
      life: [1.2, 3.0],
      color: { mode: 'blackbody', range: [5500, 7500] },
      intensity: 0.85,
      streak: 0.08,
      fall: {
        center: [0, 2.0, -14],
        box: [8, 10, 48],
        velocity: [0, 0, 18], // Streams along Z toward camera
        drag: 0.05,
      },
    });

    // ────────────────────────────── 8. Diegetic 3D Typography ──────────────────────────────
    // Overhead Architectural Header on Arch at z = -8.0
    const archTitleGroup = createInWorldText('OFF-CHIP LATENCY CHASM', {
      size: 0.44,
      depth: 0.10,
      color: 0xe8e4da,
      roughness: 0.22,
      metalness: 0.88,
      castShadow: true,
    });
    archTitleGroup.position.set(0, 5.95, -7.68);
    scene.add(archTitleGroup);

    // Stamped Technical Label on Docking Bulkhead
    const dockLabelGroup = createInWorldText2D('BUS WIDTH: 512-BIT // DRAM LATENCY PENALTY', {
      size: 0.16,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0x9c978f,
        roughness: 0.4,
      }),
    });
    dockLabelGroup.position.set(0, 0.02, -12.5);
    dockLabelGroup.rotation.x = -Math.PI / 2;
    scene.add(dockLabelGroup);
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides => {
    const scene = ctx.scene3D;
    const t = f.t;

    // ────────────────────────────── 1. Dynamic Capsule Motion ──────────────────────────────
    const capsule = scene.getObjectByName('capsuleGroup');
    const dockClampL = scene.getObjectByName('dockClampL');
    const dockClampR = scene.getObjectByName('dockClampR');

    let capsuleZ = 0;
    let capsuleVel = 0;
    const vCruise = 4.1775; // Cruising velocity across basalt canyon (m/s)

    if (t < 13.63) {
      // Phase 1 (10.8s - 13.63s): High-speed cruising transit along copper bus rails
      capsuleZ = 2.0 - (t - 10.8) * vCruise;
      capsuleVel = vCruise;
    } else if (t < 15.63) {
      // Phase 2 (13.63s - 15.63s): Constant eddy-current braking (C1 continuous match)
      const u = (t - 13.63) / 2.0;
      capsuleZ = -9.822 - vCruise * (2.0 * u - u * u);
      capsuleVel = vCruise * (1.0 - u);
    } else {
      // Phase 3 (15.63s+): Locked into 512-bit DRAM bulkhead with spring rebound
      const settle = springStep(t - 15.63, 16.0, 0.72);
      capsuleZ = -14.0 + 0.10 * (1.0 - settle);
      capsuleVel = 0;

      // Clamps lock onto the capsule
      const clampSettle = springStep(t - 15.63, 18.0, 0.75);
      const clampOffset = 1.15 - 0.28 * clampSettle;
      if (dockClampL) dockClampL.position.x = -clampOffset;
      if (dockClampR) dockClampR.position.x = clampOffset;
    }

    if (capsule) {
      capsule.position.z = capsuleZ;
    }

    // Dynamic eddy-current thermal dissipation on copper runner skates
    const runnerL = scene.getObjectByName('runnerL') as THREE.Mesh;
    const runnerR = scene.getObjectByName('runnerR') as THREE.Mesh;
    if (runnerL && runnerL.material instanceof THREE.MeshStandardMaterial) {
      if (t >= 13.63 && t < 16.2) {
        const brakeGlow = Math.sin(clamp((t - 13.63) / 2.0, 0, 1) * Math.PI);
        runnerL.material.emissive.set(0xdf5515);
        runnerL.material.emissiveIntensity = brakeGlow * 3.4;
      } else {
        runnerL.material.emissiveIntensity = 0;
      }
    }
    if (runnerR && runnerR.material instanceof THREE.MeshStandardMaterial) {
      if (t >= 13.63 && t < 16.2) {
        const brakeGlow = Math.sin(clamp((t - 13.63) / 2.0, 0, 1) * Math.PI);
        runnerR.material.emissive.set(0xdf5515);
        runnerR.material.emissiveIntensity = brakeGlow * 3.4;
      } else {
        runnerR.material.emissiveIntensity = 0;
      }
    }

    // ────────────────────────────── 2. Camera Choreography ──────────────────────────────
    // Downbeat hit pulses on downbeats: 11.29s, 13.46s, 15.63s, 17.80s, 19.97s
    const downbeats = [11.29, 13.46, 15.63, 17.8, 19.97];
    let hitPulse = 0;
    for (const db of downbeats) {
      if (t >= db && t < db + 0.35) {
        hitPulse += 0.05 * Math.exp(-(t - db) * 10.0) * Math.sin((t - db) * 40.0);
      }
    }

    // High-frequency frame tremor
    const frameIdx = Math.floor(t * 60);
    const tremorX = ((frameIdx * 9301 + 49297) % 233280) / 233280 - 0.5;
    const tremorY = ((frameIdx * 49297 + 9301) % 233280) / 233280 - 0.5;
    const tremorAmt = 0.003;

    let camPos: [number, number, number];
    let camTarget: [number, number, number];

    if (t < 15.8) {
      // Phase 1 (10.8s - 15.8s): Dynamic chase tracking alongside capsule
      const chaseU = clamp((t - 10.8) / 5.0, 0, 1);
      camPos = [
        1.8 - 0.6 * chaseU + tremorX * tremorAmt,
        1.6 - 0.4 * chaseU + hitPulse + tremorY * tremorAmt,
        capsuleZ + 4.8 - 1.2 * chaseU,
      ];
      camTarget = [0, 0.45, capsuleZ - 0.5];
    } else {
      // Phase 2 (15.8s - 20.5s): Macro inspection punch-in locked onto stamped letters
      const inspectU = clamp((t - 15.8) / 4.2, 0, 1);
      const smoothU = inspectU * inspectU * (3.0 - 2.0 * inspectU);
      camPos = [
        (0.28 - 0.10 * smoothU) + tremorX * tremorAmt,
        (1.38 - 0.15 * smoothU) + hitPulse + tremorY * tremorAmt,
        (-14.0 + 1.58 - 0.22 * smoothU),
      ];
      camTarget = [0, 0.68, -13.78];
    }

    ctx.threeCam.position.set(...camPos);
    ctx.threeCam.lookAt(...camTarget);
    ctx.threeCam.updateMatrixWorld();

    // ────────────────────────────── 3. 3D Spatial Audio Telemetry ──────────────────────────────
    const capsuleWorldPos: [number, number, number] = [0, 0.44, capsuleZ];
    const { pan, distance, ndc } = projectWorldToScreenPan(
      capsuleWorldPos,
      ctx.threeCam.matrixWorldInverse.elements,
      ctx.threeCam.projectionMatrix.elements,
      0.65
    );

    chasmTelemetry.emit('carrier_capsule', {
      sourceId: 'carrier_capsule',
      pos: capsuleWorldPos,
      screenPos: ndc,
      pan,
      distance,
      velocity: capsuleVel,
      zone: 'subterranean_canyon',
      occluded: false,
    });
    chasmTelemetry.captureFrame(frameIdx, t);

    // ────────────────────────────── 4. Flush GPU Draw Pipeline ──────────────────────────────
    ctx.flush(out, true);

    // 4.1 Composite GPU Instanced High-Speed Slipstream Particles
    ctx.largeParticles.render(ctx.renderer, ctx.threeCam, out, t);

    // ────────────────────────────── 5. Physical Optics Post-Processing ──────────────────────────────
    const macroDist = Math.hypot(camPos[0], camPos[1] - 0.68, camPos[2] - (-13.78));
    const focusDist = t < 15.8 ? distance : macroDist;

    return {
      exposure: 1.08,
      bloom: 0.34,
      bloomThreshold: 0.84,
      halation: 0.15,
      ca: 1.5,
      grain: 0.05,
      vignette: 0.34,
      depthDof: {
        enabled: true,
        focusDistance: focusDist,
        aperture: t < 15.8 ? 16.0 : 28.0,
        blades: 9,
        anamorphicRatio: 1.0,
      },
    };
  },
});

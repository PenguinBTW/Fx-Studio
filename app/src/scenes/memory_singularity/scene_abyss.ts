// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene 2: The Latency Abyss // The 100ns Void & The Memory Wall (11.0s – 26.8s)
// Flagship Viopls Production: 'The Memory Singularity'
// Subterranean copper conductor chasm, high-energy dielectric charge packet with Bishop ribbon trail,
// monumental DRAM Cathedral with 192-cell capacitor blade matrix, 808 shockwave detonation, and diegetic thesis typography.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame, PostOverrides } from '../../engine/scene';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { springStep, clamp, smoothstep } from '../../engine/util';
import { createInWorldText, createInWorldText2D } from '../../engine/text_lighting';
import { AudioTelemetryEmitter, projectWorldToScreenPan } from '../../engine/audio';
import { LargeParticles } from '../../engine/particles_large';
import { RibbonGeometry, RibbonMesh } from '../../engine/ribbon';
import {
  createSiliconWaferMaterial,
  createBasaltMaterial,
  createBrushedTitaniumMaterial,
  createCopperMaterial,
  createChromeMaterial,
} from './materials';

export const abyssTelemetry = new AudioTelemetryEmitter();

// Module-level scene handles
let waferMat: THREE.ShaderMaterial;
let basaltMat: THREE.MeshStandardMaterial;
let titaniumMat: THREE.MeshStandardMaterial;
let copperMat: THREE.MeshStandardMaterial;
let chromeMat: THREE.MeshStandardMaterial;

let packetGroup: THREE.Group;
let packetCore: THREE.Mesh;
let packetRings: THREE.Mesh[] = [];
let packetArcs: THREE.LineSegments;
let packetArcGeo: THREE.BufferGeometry;
let packetRibbonMesh: RibbonMesh;
let packetPointLight: THREE.PointLight;

let cathedralMonolith: THREE.Group;
let dielectricNexusCore: THREE.Mesh;
let dielectricNexusMat: THREE.MeshBasicMaterial;
let instancedCapacitors: THREE.InstancedMesh;
let capPositions: THREE.Vector3[] = [];
let shockwaveRing: THREE.Mesh;
let shockwaveMat: THREE.MeshBasicMaterial;
let shockwaveRing2: THREE.Mesh;
let shockwaveMat2: THREE.MeshBasicMaterial;
let terminalImpactLight: THREE.PointLight;
let cathedralFaultArcs: THREE.LineSegments;
let cathedralFaultGeo: THREE.BufferGeometry;

let particles: LargeParticles;
let busWaveguides: THREE.MeshBasicMaterial[] = [];
let beaconMaterials: THREE.MeshBasicMaterial[] = [];

export default defineScene({
  id: 'latency_abyss',

  setup: async (ctx: SceneContext) => {
    const scene = ctx.scene3D;
    packetRings = [];
    busWaveguides = [];
    beaconMaterials = [];
    capPositions = [];

    // Deep inky atmospheric void
    scene.background = new THREE.Color(0x020204);
    scene.fog = new THREE.FogExp2(0x020204, 0.022);

    // ────────────────────────────── 1. Material Grammar ──────────────────────────────
    waferMat = createSiliconWaferMaterial({
      baseColor: 0x050608,
      traceColor: 0x141820,
      pulseColor: 0x00e5ff,
      scale: 36.0,
      iridescence: 0.32,
    });

    basaltMat = createBasaltMaterial();
    titaniumMat = createBrushedTitaniumMaterial();
    copperMat = createCopperMaterial();
    chromeMat = createChromeMaterial();

    // ────────────────────────────── 2. Subterranean Chasm Architecture ──────────────────────────────
    // 2.1 Deep Basalt Canyon Floor & Infinite Dark Trench with Cross-Tie Track Sleepers
    const floorL = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 64), basaltMat);
    floorL.position.set(-8.2, -0.6, -8.0);
    floorL.receiveShadow = true;
    scene.add(floorL);

    const floorR = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 64), basaltMat);
    floorR.position.set(8.2, -0.6, -8.0);
    floorR.receiveShadow = true;
    scene.add(floorR);

    // Deep Subterranean Conduit Trench under rails
    const trenchVoid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 64), basaltMat);
    trenchVoid.position.set(0, -2.1, -8.0);
    trenchVoid.receiveShadow = true;
    scene.add(trenchVoid);

    // Cross-Tie Magnetic Stators / Sleepers along track (Every 0.8m)
    for (let sl = 0; sl < 80; sl++) {
      const zSl = 14.0 - sl * 0.8;
      const sleeper = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.08, 0.32), titaniumMat);
      sleeper.position.set(0, 0.02, zSl);
      sleeper.receiveShadow = true;
      scene.add(sleeper);

      // Center fiber groove
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.32), copperMat);
      groove.position.set(0, 0.065, zSl);
      scene.add(groove);
    }

    // Heavy transverse floor expansion joint grates along basalt walkway (Every 3.2m)
    for (let fj = 0; fj < 20; fj++) {
      const zFj = 14.0 - fj * 3.2;
      for (const fx of [-3.2, 3.2]) {
        const grate = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.04, 0.45), titaniumMat);
        grate.position.set(fx, 0.02, zFj);
        scene.add(grate);
      }
    }
    scene.add(trenchVoid);

    // 2.2 Suspended Superconductor Copper Busbars with Embedded Optical Waveguides
    for (const xOff of [-0.68, 0.68]) {
      const bus = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 64), copperMat);
      bus.position.set(xOff, 0.08, -8.0);
      scene.add(bus);

      // Embedded pulsing cyan optical core
      const fiberMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const fiber = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 64), fiberMat);
      fiber.position.set(xOff, 0.135, -8.0);
      scene.add(fiber);
      busWaveguides.push(fiberMat);
    }

    // Bus Standoff Insulator Stanchions every 3.2m
    for (let s = 0; s < 20; s++) {
      const zS = 14.0 - s * 3.2;
      for (const xOff of [-0.68, 0.68]) {
        const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.45, 12), titaniumMat);
        insulator.position.set(xOff, -0.15, zS);
        scene.add(insulator);
      }
    }

    // 2.3 Cantilevered Brutalist Gantry Portals (Stop at z = -5.2m for grand open cathedral forecourt)
    for (let i = 0; i < 5; i++) {
      const zP = 14.0 - i * 4.8;

      // Tiered Basalt Pylon Buttresses with Recessed Expansion Joints
      const pL = new THREE.Mesh(new THREE.BoxGeometry(3.8, 12.0, 2.6), basaltMat);
      pL.position.set(-6.2, 6.0, zP);
      pL.castShadow = true;
      pL.receiveShadow = true;
      scene.add(pL);

      const pR = new THREE.Mesh(new THREE.BoxGeometry(3.8, 12.0, 2.6), basaltMat);
      pR.position.set(6.2, 6.0, zP);
      pR.castShadow = true;
      pR.receiveShadow = true;
      scene.add(pR);

      // Stepped Horizontal Ledges on Canyon Walls
      const ledgeL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 4.4), titaniumMat);
      ledgeL.position.set(-4.1, 4.2, zP);
      scene.add(ledgeL);

      const ledgeR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 4.4), titaniumMat);
      ledgeR.position.set(4.1, 4.2, zP);
      scene.add(ledgeR);

      // Heavy Structural Titanium Cross-Tie Gantry Truss
      const truss = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.75, 1.1), titaniumMat);
      truss.position.set(0, 8.4, zP);
      scene.add(truss);

      // Vertical Shoring Struts
      for (const cx of [-2.8, 2.8]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8), titaniumMat);
        strut.position.set(cx, 6.2, zP);
        scene.add(strut);
      }

      // Pulsing Status Beacon on Gantry Header
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.15), beaconMat);
      beacon.position.set(0, 8.85, zP);
      scene.add(beacon);
      beaconMaterials.push(beaconMat);
    }

    // Dense Architectural Vertical Wall Ribs along canyon walls (Stop before cathedral forecourt)
    for (let r = 0; r < 9; r++) {
      const zR = 14.0 - r * 2.4;
      for (const side of [-4.2, 4.2]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.25, 9.5, 0.35), titaniumMat);
        rib.position.set(side, 4.8, zR);
        scene.add(rib);
      }
    }

    // Continuous Conduit Pipe Bundles Running Along Canyon Walls
    for (const side of [-4.15, 4.15]) {
      for (const py of [1.4, 2.8, 5.6]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 64, 12), copperMat);
        pipe.rotation.x = Math.PI * 0.5;
        pipe.position.set(side, py, -8.0);
        scene.add(pipe);
      }
    }

    // ────────────────────────────── 3. High-Energy Dielectric Charge Packet ──────────────────────────────
    packetGroup = new THREE.Group();
    packetGroup.position.set(0, 0.42, 8.0);

    // Hyper-Luminous Plasma Core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    packetCore = new THREE.Mesh(new THREE.SphereGeometry(0.20, 24, 24), coreMat);
    packetGroup.add(packetCore);

    // Refractive Dielectric Mantle
    const mantleMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xaae8ff),
      roughness: 0.04,
      metalness: 0.08,
      transmission: 0.90,
      ior: 1.48,
      thickness: 0.42,
    });
    const packetMantle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.30, 2), mantleMat);
    packetGroup.add(packetMantle);

    // Triple Counter-Rotating Titanium, Chrome, and Copper Magnetic Confinement Gimbal Rings
    for (let r = 0; r < 3; r++) {
      const ringMat = r === 0 ? titaniumMat : r === 1 ? chromeMat : copperMat;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.40 + r * 0.12, 0.022, 16, 36),
        ringMat
      );
      packetGroup.add(ring);
      packetRings.push(ring);
    }

    packetPointLight = new THREE.PointLight(0x00e5ff, 4.8, 12.0, 1.8);
    packetGroup.add(packetPointLight);

    // Dynamic Electrical Arc Segments branching to copper rails
    const arcPoints = new Float32Array(32 * 6);
    packetArcGeo = new THREE.BufferGeometry();
    packetArcGeo.setAttribute('position', new THREE.BufferAttribute(arcPoints, 3));
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    packetArcs = new THREE.LineSegments(packetArcGeo, arcMat);
    packetGroup.add(packetArcs);

    // High-Energy Bishop Ribbon Plasma Trail (Additive Energy Stream)
    const initialTrailPoints: [number, number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      initialTrailPoints.push([0, 0.42, 8.0 + (i / 32) * 3.2]);
    }
    const ribbonGeo = new RibbonGeometry({
      segments: 32,
      width: (s) => (1.0 - s) * 0.16,
      twist: (s) => s * 4.0,
      spine: initialTrailPoints,
    });
    const ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    packetRibbonMesh = new RibbonMesh(ribbonGeo, ribbonMat);
    scene.add(packetRibbonMesh);

    scene.add(packetGroup);

    // ────────────────────────────── 4. The Colossal DRAM Cathedral // The Memory Wall (z = -20.5m) ──────────────────────────────
    cathedralMonolith = new THREE.Group();
    cathedralMonolith.position.set(0, 0, -20.5);

    // 4.1 Heavy Brutalist Basalt Plinth Base
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(18.0, 1.4, 4.2), basaltMat);
    plinth.position.set(0, 0.7, 0);
    plinth.receiveShadow = true;
    cathedralMonolith.add(plinth);

    // 4.2 Flanking Heavy Brutalist Blade Rack Towers
    for (const sx of [-6.2, 6.2]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3.6, 11.0, 2.4), basaltMat);
      tower.position.set(sx, 5.5, -0.6);
      tower.castShadow = true;
      tower.receiveShadow = true;
      cathedralMonolith.add(tower);

      // Recessed Titanium Blade Bay
      const bay = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.0, 0.8), titaniumMat);
      bay.position.set(sx, 5.5, 0.5);
      cathedralMonolith.add(bay);

      // Structural Diagonal Corner Braces Anchoring Tower to Plinth
      const braceDir = sx < 0 ? 1 : -1;
      const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 12), titaniumMat);
      brace.position.set(sx + braceDir * 1.2, 1.8, 0.8);
      brace.rotation.z = braceDir * 0.55;
      cathedralMonolith.add(brace);
    }

    // 4.3 Central Brutalist Recessed Bay
    const centralBay = new THREE.Mesh(new THREE.BoxGeometry(8.6, 10.4, 2.4), basaltMat);
    centralBay.position.set(0, 5.2, -1.2);
    centralBay.receiveShadow = true;
    cathedralMonolith.add(centralBay);

    // Heavy Titanium Stepped Collar Frame
    const collarFrame = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.0, 0.3), titaniumMat);
    collarFrame.position.set(0, 3.0, 0.15);
    cathedralMonolith.add(collarFrame);

    // Recessed Silicon Wafer Die Array Behind Terminal Nexus
    const coreDie = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 0.1), waferMat);
    coreDie.position.set(0, 3.0, 0.25);
    cathedralMonolith.add(coreDie);

    // Busbar Terminal Clamps (Superconductor rails connect into cathedral)
    for (const xOff of [-0.68, 0.68]) {
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.8), chromeMat);
      lug.position.set(xOff, 1.0, 0.6);
      cathedralMonolith.add(lug);
    }

    // Circular Concentric Heavy Inductive Choke Collar
    const chokeCollar = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.14, 24, 48),
      titaniumMat
    );
    chokeCollar.position.set(0, 3.0, 0.45);
    cathedralMonolith.add(chokeCollar);

    // 16 Radial Copper Heat-Sink Blades
    for (let b = 0; b < 16; b++) {
      const angle = (b / 16) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.30, 0.14), copperMat);
      blade.position.set(
        Math.cos(angle) * 0.96,
        3.0 + Math.sin(angle) * 0.96,
        0.45
      );
      blade.rotation.z = angle;
      cathedralMonolith.add(blade);
    }

    // Concentric Polished Chrome Bezel Ring
    const innerChromeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.04, 16, 36),
      chromeMat
    );
    innerChromeRing.position.set(0, 3.0, 0.50);
    cathedralMonolith.add(innerChromeRing);

    // Glowing Central Dielectric Nexus Core
    dielectricNexusMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    dielectricNexusCore = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.10, 32), dielectricNexusMat);
    dielectricNexusCore.rotation.x = Math.PI * 0.5;
    dielectricNexusCore.position.set(0, 3.0, 0.52);
    cathedralMonolith.add(dielectricNexusCore);

    // Stepped Architectural Louvers & Expansion Relief Across Central Bay Facade
    for (let ly = 4.7; ly <= 6.6; ly += 0.42) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.10, 0.22), titaniumMat);
      louver.position.set(0, ly, 0.10);
      louver.castShadow = true;
      louver.receiveShadow = true;
      cathedralMonolith.add(louver);
    }

    // Heavy Vertical Copper Current-Feed Conduits (Nexus to Gantry)
    for (const cx of [-2.2, -1.1, 1.1, 2.2]) {
      const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 3.6, 12), copperMat);
      conduit.position.set(cx, 5.3, 0.16);
      cathedralMonolith.add(conduit);
    }

    // 4.4 Instanced DRAM Capacitor Blade Matrix (192 Standing Cylinders)
    const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.58, 16);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.20,
      metalness: 0.85,
    });
    const totalCaps = 192;
    instancedCapacitors = new THREE.InstancedMesh(capGeo, capMat, totalCaps);
    instancedCapacitors.castShadow = true;
    instancedCapacitors.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let capIdx = 0;

    // Flanking Left Blade Rack: 12 rows x 8 cols = 96
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        const x = -7.1 + (c % 4) * 0.32 + Math.floor(c / 4) * 1.0;
        const y = 1.8 + r * 0.66;
        const z = 1.15;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        instancedCapacitors.setMatrixAt(capIdx, dummy.matrix);
        instancedCapacitors.setColorAt(capIdx, new THREE.Color(0x141a22));
        capPositions.push(new THREE.Vector3(x, y, z));
        capIdx++;
      }
    }

    // Flanking Right Blade Rack: 12 rows x 8 cols = 96
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 8; c++) {
        const x = 5.2 + (c % 4) * 0.32 + Math.floor(c / 4) * 1.0;
        const y = 1.8 + r * 0.66;
        const z = 1.15;
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        instancedCapacitors.setMatrixAt(capIdx, dummy.matrix);
        instancedCapacitors.setColorAt(capIdx, new THREE.Color(0x141a22));
        capPositions.push(new THREE.Vector3(x, y, z));
        capIdx++;
      }
    }

    instancedCapacitors.instanceMatrix.needsUpdate = true;
    instancedCapacitors.instanceColor!.needsUpdate = true;
    cathedralMonolith.add(instancedCapacitors);

    // 4.5 Heavy Cantilever Header Gantry & Centered Diegetic Thesis Typography
    const headerGantry = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.6, 1.4), titaniumMat);
    headerGantry.position.set(0, 7.6, 0.4);
    cathedralMonolith.add(headerGantry);

    // Perfectly Centered Diegetic Architectural Thesis Inscription
    const thesisTitle = createInWorldText('THE MEMORY WALL', {
      size: 0.36,
      depth: 0.12,
      color: 0xe8e4da,
      roughness: 0.20,
      metalness: 0.88,
      castShadow: true,
      receiveShadow: true,
    });
    thesisTitle.position.set(0, 7.72, 1.15);
    cathedralMonolith.add(thesisTitle);

    const latencyMetric = createInWorldText2D('100ns LATENCY ABYSS // 800 CLOCK CYCLES BURNED WAITING FOR 64 BYTES', {
      size: 0.082,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0x9c978f,
        roughness: 0.35,
        metalness: 0.65,
      }),
    });
    latencyMetric.position.set(0, 7.15, 1.15);
    cathedralMonolith.add(latencyMetric);

    // 4.6 Expanding Additive Electromagnetic Shockwave Rings
    shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    shockwaveRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.35, 64), shockwaveMat);
    shockwaveRing.position.set(0, 3.0, 0.65);
    cathedralMonolith.add(shockwaveRing);

    shockwaveMat2 = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    shockwaveRing2 = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.45, 64), shockwaveMat2);
    shockwaveRing2.position.set(0, 3.0, 0.67);
    cathedralMonolith.add(shockwaveRing2);

    // 4.7 Cathedral High-Voltage Fault Arcs
    const faultArcPoints = new Float32Array(24 * 6);
    cathedralFaultGeo = new THREE.BufferGeometry();
    cathedralFaultGeo.setAttribute('position', new THREE.BufferAttribute(faultArcPoints, 3));
    const faultArcMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, linewidth: 2 });
    cathedralFaultArcs = new THREE.LineSegments(cathedralFaultGeo, faultArcMat);
    cathedralMonolith.add(cathedralFaultArcs);

    terminalImpactLight = new THREE.PointLight(0x00e5ff, 0, 26.0, 1.4);
    terminalImpactLight.position.set(0, 3.0, -19.8);
    scene.add(terminalImpactLight);

    scene.add(cathedralMonolith);

    // ────────────────────────────── 5. Chiaroscuro Raking Optics ──────────────────────────────
    const [dr, dg, db] = blackbodyToLinearSRGB(6000);
    const keySun = new THREE.DirectionalLight(new THREE.Color(dr, dg, db), 6.5);
    keySun.position.set(13.0, 12.0, -8.0);
    keySun.castShadow = true;
    keySun.shadow.mapSize.width = 2048;
    keySun.shadow.mapSize.height = 2048;
    keySun.shadow.bias = -0.0003;
    keySun.target.position.set(0, 2.5, -17.0);
    scene.add(keySun);
    scene.add(keySun.target);

    // Subterranean Cold Fill Light
    const fillLight = new THREE.DirectionalLight(0x0a1420, 1.2);
    fillLight.position.set(-9.0, 3.5, -12.0);
    scene.add(fillLight);

    // Deep inky ambient (strictly non-flat)
    const ambient = new THREE.AmbientLight(0x030406, 0.16);
    scene.add(ambient);

    // ────────────────────────────── 6. Atmospheric GPU Particles (LargeParticles) ──────────────────────────────
    particles = new LargeParticles(2200, 77);
    particles.configure({
      count: 2200,
      mode: 'free',
      style: 'streak',
      size: [0.004, 0.012],
      streak: 0.12,
      intensity: 0.16,
      turbulence: { amp: 0.6, freq: 0.4, drift: 0.25 },
      color: { mode: 'blackbody', range: [3800, 6200] },
      free: {
        center: [0, 2.0, -8.0],
        shell: [1.5, 9.0],
        dir: [0, 0, -1],
        speed: 2.8,
        spread: 0.22,
      },
    });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides => {
    const t = f.t;

    // ────────────────────────────── 1. Physical Trajectory & Time Dilation ──────────────────────────────
    const tImpact = 21.570;
    let packetZ: number;
    let packetVel: number;

    if (t < tImpact) {
      const u = clamp((t - 11.0) / (tImpact - 11.0), 0, 1);
      // Deterministic physical progression: starts at z = 8.0, reaches terminal nexus at z = -19.9m
      const easeU = Math.pow(u, 1.15);
      packetZ = 8.0 - easeU * 27.9;
      packetVel = 2.8 * (1.0 - u * 0.35);
    } else {
      packetZ = -19.9;
      packetVel = 0;
    }

    if (packetGroup) {
      packetGroup.position.z = packetZ;
      packetGroup.visible = t < tImpact + 0.12; // Core detonates on impact
    }

    // Counter-rotating titanium, chrome, and copper confinement rings
    for (let r = 0; r < packetRings.length; r++) {
      const ring = packetRings[r]!;
      ring.rotation.x = t * (3.2 + r * 1.5);
      ring.rotation.y = t * (2.4 - r * 1.1);
    }

    // Dynamic Electrical Arc Crackle from packet to copper busbars
    const arcPos = packetArcGeo.attributes.position! as THREE.BufferAttribute;
    const posArr = arcPos.array as Float32Array;
    const isFlying = t < tImpact;
    for (let k = 0; k < 32; k++) {
      if (isFlying && Math.random() > 0.32) {
        const railX = k % 2 === 0 ? -0.68 : 0.68;
        posArr[k * 6 + 0] = 0;
        posArr[k * 6 + 1] = 0;
        posArr[k * 6 + 2] = 0;
        posArr[k * 6 + 3] = railX + (Math.random() - 0.5) * 0.12;
        posArr[k * 6 + 4] = -0.34;
        posArr[k * 6 + 5] = (Math.random() - 0.5) * 0.42;
      } else {
        posArr[k * 6 + 0] = 0;
        posArr[k * 6 + 1] = -10;
        posArr[k * 6 + 2] = 0;
        posArr[k * 6 + 3] = 0;
        posArr[k * 6 + 4] = -10;
        posArr[k * 6 + 5] = 0;
      }
    }
    arcPos.needsUpdate = true;

    // High-Energy Bishop Ribbon Plasma Wake Update
    if (packetRibbonMesh) {
      if (isFlying) {
        packetRibbonMesh.visible = true;
        const trailPoints: [number, number, number][] = [];
        for (let i = 0; i <= 32; i++) {
          const s = i / 32;
          const trZ = packetZ + s * 3.4;
          const trX = Math.sin(s * 8.0 - t * 16.0) * 0.08 * (1.0 - s * 0.5);
          const trY = 0.42 + Math.cos(s * 6.0 - t * 12.0) * 0.05 * (1.0 - s * 0.5);
          trailPoints.push([trX, trY, trZ]);
        }
        packetRibbonMesh.geometry.updateFromSpine(
          trailPoints,
          (s) => (1.0 - s) * 0.16,
          (s) => s * 4.0 + t * 6.0,
          t
        );
      } else {
        packetRibbonMesh.visible = false;
      }
    }

    // Update Waveguide Pulse and Gantry Beacon Materials
    const wavePulse = 0.5 + 0.5 * Math.sin(t * 12.0);
    for (const fiber of busWaveguides) {
      fiber.color.setRGB(0.0, 0.9 * wavePulse, 1.0 * wavePulse);
    }
    for (let b = 0; b < beaconMaterials.length; b++) {
      const bPulse = 0.4 + 0.6 * Math.sin(t * 8.0 + b * 0.45);
      beaconMaterials[b]!.color.setRGB(0.0, 0.85 * bPulse, 1.0 * bPulse);
    }

    // ────────────────────────────── 2. Downbeat 21.570s Colossal 808 Detonation ──────────────────────────────
    let impactFlash = 0;
    const cameraTremor = new THREE.Vector3();

    if (t >= tImpact) {
      const age = t - tImpact;

      // Seismic Bulkhead Spring Recoil
      const recoilSettle = springStep(age, 14.0, 0.42);
      const recoilOffset = -0.42 * recoilSettle;
      if (cathedralMonolith) cathedralMonolith.position.z = -20.5 + recoilOffset;

      // High-Frequency Camera Tremor
      const shockDecay = Math.exp(-age * 3.6);
      cameraTremor.set(
        Math.sin(age * 42.0) * 0.14 * shockDecay,
        Math.cos(age * 48.0) * 0.16 * shockDecay,
        Math.sin(age * 56.0) * 0.09 * shockDecay
      );

      // Optical Flash Burst
      impactFlash = Math.exp(-age * 2.8) * 3.5;

      // Dielectric Nexus Core Detonation Glow
      const coreBurst = Math.exp(-age * 2.2);
      dielectricNexusMat.color.setRGB(coreBurst, 0.8 + 0.2 * coreBurst, 1.0);

      // Expanding Additive Electromagnetic Shockwave Rings (Rapid 0.8s burst)
      if (age < 0.9) {
        const waveProgress = age / 0.9;
        const waveRadius = waveProgress * 7.5;
        shockwaveRing.visible = true;
        shockwaveRing.scale.set(waveRadius, waveRadius, 1);
        shockwaveMat.opacity = Math.max(0, (1.0 - waveProgress) * 0.88);

        const waveRadius2 = waveProgress * 6.2;
        shockwaveRing2.visible = true;
        shockwaveRing2.scale.set(waveRadius2, waveRadius2, 1);
        shockwaveMat2.opacity = Math.max(0, (1.0 - waveProgress) * 0.75);
      } else {
        shockwaveRing.visible = false;
        shockwaveRing2.visible = false;
      }

      // Cascading Capacitor Storage Cell Ignition Ripple Across Blade Racks
      const waveFront = age * 11.0;
      const epicenter = new THREE.Vector3(0, 2.8, 1.98);
      for (let c = 0; c < capPositions.length; c++) {
        const capPos = capPositions[c]!;
        const dist = capPos.distanceTo(epicenter);
        const waveDelta = dist - waveFront;

        if (waveDelta <= 0) {
          const igniteAge = -waveDelta / 11.0;
          const decay = Math.exp(-igniteAge * 2.2);
          const refresh = 0.45 + 0.35 * Math.sin(t * 7.0 + c * 0.5);
          const r = 0.04 + 0.15 * decay;
          const g = (0.35 * refresh) + 0.85 * decay;
          const b = (0.75 * refresh) + 1.00 * decay;
          instancedCapacitors.setColorAt(c, new THREE.Color(r, g, b));
        } else if (waveDelta < 1.2) {
          instancedCapacitors.setColorAt(c, new THREE.Color(1.0, 1.0, 1.0));
        } else {
          const refresh = 0.25 + 0.15 * Math.sin(t * 5.0 + c * 0.3);
          instancedCapacitors.setColorAt(c, new THREE.Color(0.02, 0.15 * refresh, 0.35 * refresh));
        }
      }
      instancedCapacitors.instanceColor!.needsUpdate = true;

      // Dynamic Cathedral Facade Fault Arcs
      const faultPos = cathedralFaultGeo.attributes.position! as THREE.BufferAttribute;
      const faultArr = faultPos.array as Float32Array;
      const isArcing = age < 1.4;
      for (let fa = 0; fa < 24; fa++) {
        if (isArcing && Math.random() > 0.40) {
          const side = fa % 2 === 0 ? -1 : 1;
          faultArr[fa * 6 + 0] = side * (0.8 + Math.random() * 3.8);
          faultArr[fa * 6 + 1] = 1.2 + Math.random() * 5.2;
          faultArr[fa * 6 + 2] = 1.8 + Math.random() * 0.4;
          faultArr[fa * 6 + 3] = side * (1.2 + Math.random() * 4.6);
          faultArr[fa * 6 + 4] = 1.0 + Math.random() * 5.8;
          faultArr[fa * 6 + 5] = 1.9 + Math.random() * 0.4;
        } else {
          faultArr[fa * 6 + 0] = 0;
          faultArr[fa * 6 + 1] = -10;
          faultArr[fa * 6 + 2] = 0;
          faultArr[fa * 6 + 3] = 0;
          faultArr[fa * 6 + 4] = -10;
          faultArr[fa * 6 + 5] = 0;
        }
      }
      faultPos.needsUpdate = true;
    }

    if (terminalImpactLight) terminalImpactLight.intensity = impactFlash * 3.2;

    // ────────────────────────────── 3. Cinematic Camera Choreography ──────────────────────────────
    // Shot 3A (11.0s – 15.5s): Wide high-angle vertigo descent down subterranean chasm
    // Shot 3B (15.5s – 21.0s): Low-angle high-speed chase camera tracking beside copper bus
    // Shot 4 (21.0s – 26.8s): Heroic, balanced 3/4 low angle framing the towering DRAM Cathedral & stamped thesis
    const camPos = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    let focusTarget = new THREE.Vector3();

    if (t < 15.5) {
      // Shot 3A: High-angle canyon tracking
      const u = smoothstep(11.0, 15.5, t);
      const p0 = new THREE.Vector3(1.4, 3.2, packetZ + 4.8);
      const p1 = new THREE.Vector3(0.95, 2.2, packetZ + 3.8);
      camPos.lerpVectors(p0, p1, u);
      lookAt.set(-0.08, 0.42, packetZ - 4.5);
      focusTarget.set(0, 0.42, packetZ);
    } else if (t < 21.0) {
      // Shot 3B: Low-angle high-speed chase
      const u = smoothstep(15.5, 21.0, t);
      const p0 = new THREE.Vector3(0.95, 2.2, packetZ + 3.8);
      const p1 = new THREE.Vector3(0.58, 0.65, packetZ + 2.6);
      camPos.lerpVectors(p0, p1, u);
      lookAt.set(-0.08, 0.42, packetZ - 4.5);
      focusTarget.set(0, 0.42, packetZ);
    } else {
      // Shot 4: Hero 3/4 low angle framing DRAM Cathedral
      const u = smoothstep(21.0, 21.57, t);
      const p3 = new THREE.Vector3(0.58, 0.65, packetZ + 2.6);
      const driftAge = Math.max(0, t - 21.570);
      // Balanced composition framing entire cathedral and centered header typography
      const p4 = new THREE.Vector3(
        0.0,
        3.5 + driftAge * 0.02,
        -6.8 + driftAge * 0.02
      );
      camPos.lerpVectors(p3, p4, u);

      const l3 = new THREE.Vector3(-0.08, 0.42, packetZ - 4.5);
      const l4 = new THREE.Vector3(0.0, 4.4, -20.2);
      lookAt.lerpVectors(l3, l4, u);

      // Rack focus from impact point (z = -19.9m, y = 3.0m) to architectural thesis title (z = -19.35m, y = 7.72m)
      const uRack = smoothstep(21.570, 22.800, t);
      const impactPos = new THREE.Vector3(0, 3.0, -19.9);
      const titlePos = new THREE.Vector3(0, 7.72, -19.35);
      focusTarget.lerpVectors(impactPos, titlePos, uRack);
    }

    camPos.add(cameraTremor);
    lookAt.add(cameraTremor.clone().multiplyScalar(0.4));

    ctx.threeCam.position.copy(camPos);
    ctx.threeCam.lookAt(lookAt.x, lookAt.y, lookAt.z);
    ctx.threeCam.updateMatrixWorld();

    // ────────────────────────────── 4. 3D Spatial Audio Telemetry ──────────────────────────────
    const packetWorldPos: [number, number, number] = [0, 0.42, packetZ];
    const { pan, distance, ndc } = projectWorldToScreenPan(
      packetWorldPos,
      ctx.threeCam.matrixWorldInverse.elements,
      ctx.threeCam.projectionMatrix.elements,
      0.65
    );

    const frameIdx = Math.floor(t * 60);
    abyssTelemetry.emit('charge_packet', {
      sourceId: 'charge_packet',
      pos: packetWorldPos,
      screenPos: ndc,
      pan,
      distance,
      velocity: packetVel,
      zone: 'latency_abyss',
      occluded: false,
    });
    abyssTelemetry.captureFrame(frameIdx, t);

    // ────────────────────────────── 5. Flush GPU Draw Pipeline ──────────────────────────────
    ctx.flush(out, true);
    particles.render(ctx.renderer, ctx.threeCam, out, t);

    const isImpact = t >= 21.570;
    const flash = isImpact ? Math.exp(-(t - 21.570) * 2.8) : 0;

    return {
      flash: flash * 0.08,
      bloom: 0.20 + flash * 0.22,
      toneMap: 'agx',
      ca: 0.8 + flash * 1.4,
      grain: 0.035,
      depthDof: {
        enabled: true,
        focusDistance: camPos.distanceTo(focusTarget),
        aperture: 6.5,
        maxRadius: 12.0,
        blades: 9,
        anamorphicRatio: 1.0,
      },
    };
  },
});

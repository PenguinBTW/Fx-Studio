// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Scene 1: The Silicon Monolith // Picosecond Inferno (0.0s – 12.2s)
// Flagship Viopls Production: 'The Memory Singularity'
// Procedural micro-circuit greebles, 80k GPU curl particles, multi-tiered wafer strata,
// pulsating compute core, dynamic macro camera choreography, and tectonic phase collapse.

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame, PostOverrides } from '../../engine/scene';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';
import { springStep, clamp, smoothstep } from '../../engine/util';
import { createInWorldText, createInWorldText2D } from '../../engine/text_lighting';
import { AudioTelemetryEmitter, projectWorldToScreenPan } from '../../engine/audio';
import { LargeParticles } from '../../engine/particles_large';
import {
  createSiliconWaferMaterial,
  createBasaltMaterial,
  createBrushedTitaniumMaterial,
  createCopperMaterial,
  createChromeMaterial,
} from './materials';

export const monolithTelemetry = new AudioTelemetryEmitter();

// Module-level scene handles
let waferMat: THREE.ShaderMaterial;
let coreGlowMesh: THREE.Mesh;
let coreGlowMat: THREE.MeshBasicMaterial;
let corePointLight: THREE.PointLight;
let faultArcGeo: THREE.BufferGeometry;
let faultArcs: THREE.LineSegments;
let particles: LargeParticles;
let clusterMeshes: THREE.InstancedMesh;
let finMeshes: THREE.InstancedMesh;
let wireMeshes: THREE.InstancedMesh;
let waveguideMaterials: THREE.MeshBasicMaterial[] = [];
let busbars: THREE.Mesh[] = [];

// Spring state for camera recoil & core pulse
let camSpringPos = new THREE.Vector3();
let camSpringVel = new THREE.Vector3();
let coreEnergy = 1.0;

export default defineScene({
  id: 'silicon_monolith',

  setup: async (ctx: SceneContext) => {
    const scene = ctx.scene3D;
    waveguideMaterials = [];
    busbars = [];

    // Deep obsidian void atmosphere
    scene.background = new THREE.Color(0x020204);
    scene.fog = new THREE.FogExp2(0x020204, 0.035);

    // ────────────────────────────── 1. Materials ──────────────────────────────
    waferMat = createSiliconWaferMaterial({
      baseColor: 0x07080b,
      traceColor: 0x181c24,
      pulseColor: 0x00e5ff,
      scale: 36.0,
      iridescence: 0.95,
    });

    const basaltMat = createBasaltMaterial();
    const titaniumMat = createBrushedTitaniumMaterial();
    const copperMat = createCopperMaterial();
    const chromeMat = createChromeMaterial();

    // ────────────────────────────── 2. Silicon Megastructure ──────────────────────────────
    // 2.1 Subterranean Base Platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(32, 1.2, 38), basaltMat);
    platform.position.set(0, -0.6, -4);
    platform.receiveShadow = true;
    scene.add(platform);

    // 2.2 Quad Superconductor Copper Busbars
    for (const xOff of [-1.1, -0.38, 0.38, 1.1]) {
      const bus = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 36), copperMat);
      bus.position.set(xOff, 0.06, -4);
      scene.add(bus);
      busbars.push(bus);

      // Embedded glowing optical core inside busbar
      const fiberMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const fiber = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 36), fiberMat);
      fiber.position.set(xOff, 0.125, -4);
      scene.add(fiber);
      waveguideMaterials.push(fiberMat);
    }

    // 2.3 Instanced 16-Core Compute Clusters (Micro-Architecture)
    const clusterGeo = new THREE.BoxGeometry(0.72, 0.14, 0.72);
    const clusterMat = waferMat;
    const numClusters = 48; // 4 rows x 12 cols
    clusterMeshes = new THREE.InstancedMesh(clusterGeo, clusterMat, numClusters);
    clusterMeshes.castShadow = true;
    clusterMeshes.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let idx = 0;
    for (let row = -3; row <= 3; row++) {
      for (let col = -3; col <= 3; col++) {
        if (Math.abs(col) <= 1 && Math.abs(row) <= 1) continue; // leave center open for compute core
        if (idx >= numClusters) break;
        const x = col * 1.05;
        const z = row * 1.05 - 3.5;
        dummy.position.set(x, 0.07, z);
        dummy.scale.set(1, 0.8 + Math.abs(Math.sin(col * 2.1 + row * 1.3)) * 0.4, 1);
        dummy.updateMatrix();
        clusterMeshes.setMatrixAt(idx++, dummy.matrix);
      }
    }
    clusterMeshes.instanceMatrix.needsUpdate = true;
    scene.add(clusterMeshes);

    // 2.4 Instanced Heatsink Micro-Fins (Surrounding the core)
    const finGeo = new THREE.BoxGeometry(0.025, 0.45, 0.65);
    const numFins = 64;
    finMeshes = new THREE.InstancedMesh(finGeo, titaniumMat, numFins);
    let fIdx = 0;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 32; i++) {
        dummy.position.set(s * (1.8 + (i % 4) * 0.12), 0.22, -8.0 + i * 0.3);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        finMeshes.setMatrixAt(fIdx++, dummy.matrix);
      }
    }
    finMeshes.instanceMatrix.needsUpdate = true;
    scene.add(finMeshes);

    // 2.5 Instanced Gold Wirebond Arches
    const wireGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.35, 8);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.98,
      roughness: 0.12,
    });
    const numWires = 96;
    wireMeshes = new THREE.InstancedMesh(wireGeo, goldMat, numWires);
    let wIdx = 0;
    for (let w = 0; w < numWires; w++) {
      const angle = (w / numWires) * Math.PI * 2;
      const radius = 1.35 + (w % 3) * 0.08;
      dummy.position.set(Math.cos(angle) * radius, 0.18, -3.5 + Math.sin(angle) * radius);
      dummy.rotation.set(0.3 * Math.sin(angle), angle, 0.4);
      dummy.updateMatrix();
      wireMeshes.setMatrixAt(wIdx++, dummy.matrix);
    }
    wireMeshes.instanceMatrix.needsUpdate = true;
    scene.add(wireMeshes);

    // 2.6 The Central Compute Core // Thermal Reactor (The 5.2 GHz CPU Heart)
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0.25, -3.5);

    const coreBase = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.3, 32), titaniumMat);
    coreGroup.add(coreBase);

    // Glowing Thermal Ingot Core
    coreGlowMat = new THREE.MeshBasicMaterial({ color: 0xff8811 });
    coreGlowMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.32, 24), coreGlowMat);
    coreGroup.add(coreGlowMesh);

    // Chrome Magnetic Confinement Rings
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 + r * 0.16, 0.022, 16, 36), chromeMat);
      ring.position.y = 0.05 + r * 0.06;
      coreGroup.add(ring);
    }

    corePointLight = new THREE.PointLight(0xff7711, 6.5, 14.0, 1.8);
    corePointLight.position.set(0, 0.4, 0);
    coreGroup.add(corePointLight);

    scene.add(coreGroup);

    // 2.7 Flanking Tectonic Silicon Monolith Cliffs (Wafer Strata)
    for (const side of [-1, 1]) {
      for (let p = 0; p < 6; p++) {
        const zP = 4 - p * 4.8;
        const h = 6.5 + (p % 3) * 2.5;
        const cliff = new THREE.Mesh(new THREE.BoxGeometry(4.5, h, 4.2), waferMat);
        cliff.position.set(side * 5.2, h * 0.5, zP);
        cliff.castShadow = true;
        cliff.receiveShadow = true;
        scene.add(cliff);

        // Tiered cantilever ledges
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 3.8), titaniumMat);
        ledge.position.set(side * 2.6, h * 0.65, zP);
        scene.add(ledge);
      }
    }

    // ────────────────────────────── 3. 2,000 High-Fidelity GPU Sparks (LargeParticles) ──────────────────────────────
    particles = new LargeParticles(2000, 42);
    particles.configure({
      count: 2000,
      mode: 'press',
      style: 'streak',
      size: [0.006, 0.018],
      streak: 0.08,
      intensity: 0.16,
      turbulence: { amp: 0.8, freq: 0.5, drift: 0.2 },
      color: { mode: 'blackbody', range: [3200, 6500] },
      press: {
        center: [0, 0.6, -3.5],
        shell: [1.2, 6.5],
        shellPow: 1.4,
        falloff: 0.6,
      },
    });

    // ────────────────────────────── 4. Dynamic Fault Arcs ──────────────────────────────
    const arcCount = 32;
    const arcPoints = new Float32Array(arcCount * 6);
    faultArcGeo = new THREE.BufferGeometry();
    faultArcGeo.setAttribute('position', new THREE.BufferAttribute(arcPoints, 3));
    const arcMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    faultArcs = new THREE.LineSegments(faultArcGeo, arcMat);
    faultArcs.visible = false;
    scene.add(faultArcs);

    // ────────────────────────────── 5. Diegetic Architectural Typography ──────────────────────────────
    const heroTitle = createInWorldText('5.2 GHz SILICON DIE', {
      size: 0.42,
      depth: 0.12,
      color: 0xe8e4da,
      roughness: 0.18,
      metalness: 0.92,
      castShadow: true,
      receiveShadow: true,
    });
    heroTitle.position.set(-2.6, 4.2, -4.5);
    heroTitle.rotation.y = 0.25;
    scene.add(heroTitle);

    const subTitle = createInWorldText2D('PICOSECOND COMPUTE ENGINE // 0.19ns CLOCK CYCLE // 32MB L3 CACHE HIT', {
      size: 0.14,
      letterSpacing: 0.08,
      material: new THREE.MeshStandardMaterial({
        color: 0xa8a49c,
        roughness: 0.35,
        metalness: 0.65,
      }),
    });
    subTitle.position.set(-2.8, 0.16, 1.2);
    subTitle.rotation.x = -Math.PI / 2;
    scene.add(subTitle);

    // ────────────────────────────── 6. Cinematic Stage Lighting ──────────────────────────────
    // Searing Grazing Key Light (Sharp architectural rim highlights)
    const [kr, kg, kb] = blackbodyToLinearSRGB(6800);
    const keyLight = new THREE.DirectionalLight(new THREE.Color(kr, kg, kb), 3.2);
    keyLight.position.set(8.0, 14.0, 6.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0002;
    keyLight.target.position.set(0, 0.5, -3.5);
    scene.add(keyLight);
    scene.add(keyLight.target);

    // Low-angle cool fill from opposite side
    const fillLight = new THREE.DirectionalLight(0x1a2638, 1.2);
    fillLight.position.set(-8.0, 4.0, -2.0);
    scene.add(fillLight);
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides => {
    const t = f.t;
    const postOverrides: PostOverrides = {};

    // ────────────────────────────── 1. Rhythmic Beat & Compute Dynamics ──────────────────────────────
    // Downbeat timings from Lorn 'Anvil':
    // Downbeat 1: 2.396s, Downbeat 2: 4.793s, Downbeat 3: 7.191s, Downbeat 4: 9.589s
    // Cache Miss Freeze: 11.20s - 12.20s
    const isCacheMiss = t >= 11.20;

    let beatKick = 0;
    if (!isCacheMiss) {
      const beatPhase = (t * (100.16 / 60)) % 1.0;
      beatKick = Math.pow(Math.max(0, 1.0 - beatPhase * 3.2), 2.5);
    }

    // Thermal energy decay on cache miss
    if (isCacheMiss) {
      coreEnergy = Math.max(0.0, coreEnergy - f.dt * 4.5);
    } else {
      coreEnergy = 1.0;
    }

    // Update wafer shader
    if (waferMat) {
      waferMat.uniforms.uTime.value = t;
      waferMat.uniforms.uPulseIntensity.value = isCacheMiss ? 0.05 : 0.85 + beatKick * 1.5;
    }

    // Core thermal glow: Gold/amber inferno during compute, collapsing to frozen blue on cache miss
    if (coreGlowMesh && corePointLight) {
      if (!isCacheMiss) {
        const warmR = 1.0;
        const warmG = 0.45 + beatKick * 0.25;
        const warmB = 0.08;
        coreGlowMat.color.setRGB(warmR, warmG, warmB);
        corePointLight.color.setRGB(warmR, warmG, warmB);
        corePointLight.intensity = 5.0 + beatKick * 4.5;
      } else {
        // Cold blue stall state
        coreGlowMat.color.setRGB(0.05, 0.45 * coreEnergy, 0.85 * coreEnergy);
        corePointLight.color.setRGB(0.05, 0.4, 0.9);
        corePointLight.intensity = 1.2 * coreEnergy;
      }
    }

    // Waveguides pulse on compute beats
    const wgCol = isCacheMiss ? 0x052030 : (beatKick > 0.4 ? 0xffffff : 0x00e5ff);
    for (const wm of waveguideMaterials) {
      wm.color.setHex(wgCol);
    }

    // ────────────────────────────── 2. Dynamic Electrical Fault Arcs ──────────────────────────────
    if (faultArcs) {
      if (isCacheMiss && Math.random() < 0.8) {
        faultArcs.visible = true;
        const pos = faultArcGeo.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < 32; i++) {
          const idx = i * 6;
          const x0 = (Math.random() - 0.5) * 1.8;
          const y0 = 0.15 + Math.random() * 0.6;
          const z0 = -3.5 + (Math.random() - 0.5) * 2.2;
          arr[idx] = x0; arr[idx + 1] = y0; arr[idx + 2] = z0;
          arr[idx + 3] = x0 + (Math.random() - 0.5) * 0.45;
          arr[idx + 4] = y0 + (Math.random() - 0.5) * 0.35;
          arr[idx + 5] = z0 + (Math.random() - 0.5) * 0.45;
        }
        pos.needsUpdate = true;
      } else {
        faultArcs.visible = false;
      }
    }

    // ────────────────────────────── 3. Flush 3D Megastructure & Render GPU Particles ──────────────────────────────
    ctx.flush(out, true);

    if (particles) {
      particles.render(ctx.renderer, ctx.threeCam, out, t);
    }

    // ────────────────────────────── 4. Heroic Camera Choreography ──────────────────────────────
    const cam = ctx.threeCam;
    const target = new THREE.Vector3();
    let focalDist = 3.5;
    let aperture = 0.032;

    if (t < 5.2) {
      // ────────────────── Shot 1 (0.0s – 5.2s): Macro Surface Skim ──────────────────
      // Dynamic raking camera skimming just above the glowing silicon wafer clusters
      const p = t / 5.2;
      const easeP = smoothstep(0, 1, p);
      const camX = 1.65 - easeP * 1.1;
      const camY = 0.42 + easeP * 0.28;
      const camZ = 1.2 - easeP * 4.2;

      cam.position.set(camX, camY, camZ);
      target.set(0, 0.25, camZ - 3.2);
      cam.lookAt(target);

      focalDist = 2.4;
      aperture = 0.045; // Shallow DoF macro feel
    } else if (t < 10.8) {
      // ────────────────── Shot 2 (5.2s – 10.8s): Ascending Orbital Crane ──────────────────
      // Camera rises high and orbits the pulsating compute core, showing the full megastructure
      const p = (t - 5.2) / 5.6;
      const angle = 0.2 + p * 0.85;
      const radius = 5.2 - p * 0.8;
      const camX = Math.sin(angle) * radius;
      const camY = 1.2 + p * 2.4;
      const camZ = -3.5 + Math.cos(angle) * radius;

      cam.position.set(camX, camY, camZ);
      target.set(0, 0.35, -3.5);
      cam.lookAt(target);

      focalDist = radius;
      aperture = 0.022;
    } else {
      // ────────────────── Shot 3 (10.8s – 12.2s): The Stall / Cache Miss ──────────────────
      // Dramatic Dutch-angle macro freeze right as the clock stops
      const p = Math.min(1, (t - 10.8) / 1.4);
      const camX = -1.15 + p * 0.25;
      const camY = 0.65 - p * 0.15;
      const camZ = -1.8 - p * 0.45;

      cam.position.set(camX, camY, camZ);
      target.set(0, 0.25, -3.5);
      cam.lookAt(target);
      cam.rotation.z = -0.15 + p * 0.10; // Dutch tilt

      focalDist = 1.9;
      aperture = 0.040;
    }

    // ────────────────────────────── 5. Depth of Field & Post-Processing ──────────────────────────────
    postOverrides.depthDof = {
      enabled: true,
      focusDistance: focalDist,
      aperture: 6.0,
      maxRadius: 10.0,
      blades: 6,
    };
    postOverrides.toneMap = 'agx';

    // ────────────────────────────── 6. Spatial Audio Telemetry ──────────────────────────────
    const panData = projectWorldToScreenPan(
      [0, 0.25, -3.5],
      cam.matrixWorldInverse.elements,
      cam.projectionMatrix.elements
    );
    monolithTelemetry.emit('monolith_core', {
      pos: [0, 0.25, -3.5],
      pan: panData.pan,
      distance: panData.distance,
      data: {
        gain: isCacheMiss ? 0.15 : 0.95,
        frequencyHz: isCacheMiss ? 120 : (440 + beatKick * 300),
      },
    });

    if (isCacheMiss) {
      const missRel = (t - 11.20) / 1.0;
      postOverrides.bloom = 0.40 + missRel * 0.3;
      postOverrides.ca = 6.0 + missRel * 8.0;
      postOverrides.vignette = 0.45 + missRel * 0.25;
    } else {
      postOverrides.bloom = 0.22 + beatKick * 0.22;
      postOverrides.ca = 2.0;
      postOverrides.vignette = 0.35;
    }

    return postOverrides;
  },
});

// High-Detail Procedural Spacecraft Model: Orbital Hauler Aegis-VII (f(x) Studio v0.8.0)
// Shared across SceneApproach and SceneDocking for 100% intra-video visual cohesion.

import * as THREE from 'three';

export interface ShipMeshSet {
  group: THREE.Group;
  cockpitGlow: THREE.Mesh;
  mainThrustL: THREE.Mesh;
  mainThrustR: THREE.Mesh;
  rcsFlames: THREE.Mesh[];
  strobeL: THREE.Mesh;
  strobeR: THREE.Mesh;
  beaconWhite: THREE.Mesh;
  update: (t: number, throttle: number, rcsBrake: number) => void;
  dispose: () => void;
}

export function createAegisShip(): ShipMeshSet {
  const group = new THREE.Group();

  // Materials adhering to Viopls Industrial Sci-Fi palette:
  // Graphite hull (#1e2430), Bone superstructure (#d8dce6), Caution Orange (#ea580c),
  // Titanium metal (#2d3748), Glow Cyan (#00f0ff), Visor Gold (#fbbf24)
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.85,
    roughness: 0.32,
  });

  const armorPlateMat = new THREE.MeshStandardMaterial({
    color: 0x2b3342,
    metalness: 0.75,
    roughness: 0.40,
  });

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.90,
    roughness: 0.25,
  });

  const orangeContainerMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    metalness: 0.45,
    roughness: 0.40,
  });

  const graphiteContainerMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.60,
    roughness: 0.45,
  });

  const chromePistonMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.98,
    roughness: 0.12,
  });

  const goldVisorMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.92,
    roughness: 0.18,
    emissive: 0x78350f,
    emissiveIntensity: 0.4,
  });

  const cyanPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.85,
  });

  const rcsPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.0,
  });

  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const whiteLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 1. Main Fuselage Center Spine
  const spineGeom = new THREE.BoxGeometry(1.8, 1.4, 9.5);
  const spineMesh = new THREE.Mesh(spineGeom, hullMat);
  group.add(spineMesh);

  // Upper Armor Ridge
  const ridgeGeom = new THREE.BoxGeometry(1.2, 0.4, 8.0);
  const ridgeMesh = new THREE.Mesh(ridgeGeom, armorPlateMat);
  ridgeMesh.position.set(0, 0.9, -0.4);
  group.add(ridgeMesh);

  // 2. Cockpit Command Module (Forward)
  const cockpitGroup = new THREE.Group();
  cockpitGroup.position.set(0, 0.4, 5.2);

  // Wedge Nose Cone
  const noseGeom = new THREE.CylinderGeometry(0.5, 1.6, 2.6, 6);
  noseGeom.rotateX(Math.PI / 2);
  const noseMesh = new THREE.Mesh(noseGeom, armorPlateMat);
  cockpitGroup.add(noseMesh);

  // Reflective Canopy Visor Glass
  const visorGeom = new THREE.BoxGeometry(0.9, 0.5, 1.2);
  const visorMesh = new THREE.Mesh(visorGeom, goldVisorMat);
  visorMesh.position.set(0, 0.45, 0.3);
  cockpitGroup.add(visorMesh);

  // Sensor array / antenna
  const antGeom = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8);
  const antMesh = new THREE.Mesh(antGeom, trussMat);
  antMesh.position.set(0, 0.8, -0.6);
  cockpitGroup.add(antMesh);

  group.add(cockpitGroup);

  // 3. Modular Cargo Containers (3 pairs stacked along spine)
  const boxGeom = new THREE.BoxGeometry(1.0, 1.1, 1.8);
  const zOffsets = [-2.4, -0.3, 1.8];

  for (let i = 0; i < zOffsets.length; i++) {
    const z = zOffsets[i]!;
    const mat = (i === 1) ? orangeContainerMat : graphiteContainerMat;

    // Left container
    const cL = new THREE.Mesh(boxGeom, mat);
    cL.position.set(-1.35, 0.0, z);
    group.add(cL);

    // Right container
    const cR = new THREE.Mesh(boxGeom, mat);
    cR.position.set(1.35, 0.0, z);
    group.add(cR);

    // Container locking clamps / rails
    const clampBar = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 0.25), trussMat);
    clampBar.position.set(0, 0.65, z);
    group.add(clampBar);
  }

  // 4. Lateral Radiator Fins (angled deployable panels)
  const radGeom = new THREE.BoxGeometry(1.6, 0.08, 3.2);
  const radL = new THREE.Mesh(radGeom, armorPlateMat);
  radL.position.set(-2.2, 0.4, -1.0);
  radL.rotation.z = 0.35;
  group.add(radL);

  const radR = new THREE.Mesh(radGeom, armorPlateMat);
  radR.position.set(2.2, 0.4, -1.0);
  radR.rotation.z = -0.35;
  group.add(radR);

  // 5. Dual Ion Engines (Aft)
  const engineBellGeom = new THREE.CylinderGeometry(0.55, 0.85, 1.8, 16);
  engineBellGeom.rotateX(Math.PI / 2);

  const engineBellL = new THREE.Mesh(engineBellGeom, trussMat);
  engineBellL.position.set(-1.0, 0.0, -5.3);
  group.add(engineBellL);

  const engineBellR = new THREE.Mesh(engineBellGeom, trussMat);
  engineBellR.position.set(1.0, 0.0, -5.3);
  group.add(engineBellR);

  // Glowing Ion Plasma Cones
  const thrustGeom = new THREE.ConeGeometry(0.55, 4.2, 16);
  thrustGeom.rotateX(-Math.PI / 2);

  const mainThrustL = new THREE.Mesh(thrustGeom, cyanPlasmaMat);
  mainThrustL.position.set(-1.0, 0.0, -7.4);
  group.add(mainThrustL);

  const mainThrustR = new THREE.Mesh(thrustGeom, cyanPlasmaMat);
  mainThrustR.position.set(1.0, 0.0, -7.4);
  group.add(mainThrustR);

  // 6. Forward-Facing RCS Deceleration Thrusters (4 nozzles)
  const rcsGeom = new THREE.ConeGeometry(0.25, 1.4, 12);
  rcsGeom.rotateX(Math.PI / 2); // points forward

  const rcsFlames: THREE.Mesh[] = [];
  const rcsPositions = [
    [-1.2, 0.6, 4.0],
    [1.2, 0.6, 4.0],
    [-1.2, -0.6, 4.0],
    [1.2, -0.6, 4.0],
  ];

  for (const pos of rcsPositions) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.4, 8), chromePistonMat);
    nozzle.rotateX(Math.PI / 2);
    nozzle.position.set(pos[0]!, pos[1]!, pos[2]!);
    group.add(nozzle);

    const flame = new THREE.Mesh(rcsGeom, rcsPlasmaMat.clone());
    flame.position.set(pos[0]!, pos[1]!, pos[2]! + 0.9);
    flame.visible = false;
    rcsFlames.push(flame);
    group.add(flame);
  }

  // 7. Navigation Strobe Beacons
  const strobeGeom = new THREE.SphereGeometry(0.08, 8, 8);

  const strobeL = new THREE.Mesh(strobeGeom, redLightMat);
  strobeL.position.set(-3.0, 0.4, -1.0);
  group.add(strobeL);

  const strobeR = new THREE.Mesh(strobeGeom, greenLightMat);
  strobeR.position.set(3.0, 0.4, -1.0);
  group.add(strobeR);

  const beaconWhite = new THREE.Mesh(strobeGeom, whiteLightMat);
  beaconWhite.position.set(0, 1.15, -4.5);
  group.add(beaconWhite);

  const update = (t: number, throttle: number, rcsBrake: number) => {
    // Main thruster flare pulsing
    const pulse = throttle * (1.0 + Math.sin(t * 22.0) * 0.12 + Math.cos(t * 37.0) * 0.06);
    mainThrustL.scale.set(pulse, pulse, pulse * 1.2);
    mainThrustR.scale.set(pulse, pulse, pulse * 1.2);
    mainThrustL.visible = throttle > 0.05;
    mainThrustR.visible = throttle > 0.05;

    // RCS brake thrusters (during deceleration)
    const isBraking = rcsBrake > 0.05;
    for (const flame of rcsFlames) {
      flame.visible = isBraking;
      if (isBraking) {
        const rcsFlicker = rcsBrake * (0.8 + Math.sin(t * 45.0) * 0.25);
        flame.scale.set(rcsFlicker, rcsFlicker, rcsFlicker);
        (flame.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, rcsFlicker);
      }
    }

    // Strobe blinking (1.0 Hz square pulse)
    const strobeOn = (t % 1.0) < 0.15;
    strobeL.visible = strobeOn;
    strobeR.visible = strobeOn;
    beaconWhite.visible = ((t + 0.5) % 1.0) < 0.15;
  };

  const dispose = () => {
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material.dispose();
      }
    });
  };

  return {
    group,
    cockpitGlow: visorMesh,
    mainThrustL,
    mainThrustR,
    rcsFlames,
    strobeL,
    strobeR,
    beaconWhite,
    update,
    dispose,
  };
}

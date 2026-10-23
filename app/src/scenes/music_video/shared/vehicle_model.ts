// 1930s Boattail Speedster Procedural Vehicle Model & Rig
// Brutalist Swiss-Grid Neo-Noir aesthetic: brushed tungsten steel, polished chrome,
// brass analog instrumentation, wire-spoke wheels, and tempo-reactive rearview fuzzy dice.

import * as THREE from 'three';

export interface VehicleVisibilityConfig {
  chassis?: boolean;
  cockpit?: boolean;
  seats?: boolean;
  dashboard?: boolean;
  steeringWheel?: boolean;
  rearviewMirror?: boolean;
  dice?: boolean;
  frontWheels?: boolean;
  rearWheels?: boolean;
  exhausts?: boolean;
  headlights?: boolean;
}

export interface VehicleUpdateOpts {
  t: number;
  speed?: number; // Forward velocity in m/s (drives wheel rotation and vibration)
  steerAngle?: number; // Steering angle in radians (-0.4 to 0.4)
  diceSwingStrength?: number; // Multiplier for dice swinging amplitude
  engineVibe?: number; // Amplitude of idle/rev vibration
  headlightsOn?: boolean;
}

export interface VehicleModelRig {
  root: THREE.Group;
  chassis: THREE.Group;
  cockpit: THREE.Group;
  seats: THREE.Group;
  dashboard: THREE.Group;
  steeringWheel: THREE.Group;
  rearviewMirror: THREE.Group;
  dice: THREE.Group;
  frontWheels: THREE.Group;
  rearWheels: THREE.Group;
  leftFrontWheel: THREE.Group;
  rightFrontWheel: THREE.Group;
  leftRearWheel: THREE.Group;
  rightRearWheel: THREE.Group;
  exhausts: THREE.Group;
  headlights: THREE.Group;
  speedometerNeedle: THREE.Mesh;
  diceCords: THREE.LineSegments;
  die1: THREE.Group;
  die2: THREE.Group;
  materials: Record<string, THREE.Material>;

  setVisibility: (config: VehicleVisibilityConfig) => void;
  isolateCockpit: () => void;
  showFullExterior: () => void;
  update: (opts: VehicleUpdateOpts) => void;
}

export function createVehicleModel(): VehicleModelRig {
  const root = new THREE.Group();
  root.name = 'speedster_root';

  // -------------------------------------------------------------
  // Materials Library (Brutalist Neo-Noir: Tungsten, Chrome, Brass)
  // -------------------------------------------------------------
  const materials: Record<string, THREE.Material> = {
    bodyTungsten: new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.28,
      metalness: 0.84,
      name: 'mat_body_tungsten',
    }),
    bodyTrimBlack: new THREE.MeshStandardMaterial({
      color: 0x0a0c0e,
      roughness: 0.55,
      metalness: 0.7,
      name: 'mat_trim_black',
    }),
    polishedChrome: new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.08,
      metalness: 0.98,
      name: 'mat_polished_chrome',
    }),
    brassBezel: new THREE.MeshStandardMaterial({
      color: 0xd4a359,
      roughness: 0.25,
      metalness: 0.92,
      name: 'mat_brass_bezel',
    }),
    gaugeFace: new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.6,
      metalness: 0.2,
      name: 'mat_gauge_face',
    }),
    needleRed: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      roughness: 0.2,
      metalness: 0.8,
      name: 'mat_needle_red',
    }),
    leatherBlack: new THREE.MeshStandardMaterial({
      color: 0x16181b,
      roughness: 0.75,
      metalness: 0.15,
      name: 'mat_leather_black',
    }),
    woodSteering: new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      roughness: 0.4,
      metalness: 0.1,
      name: 'mat_wood_steering',
    }),
    mirrorGlass: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.0,
      metalness: 1.0,
      name: 'mat_mirror_glass',
    }),
    windshieldGlass: new THREE.MeshPhysicalMaterial({
      color: 0xa5c4d4,
      transparent: true,
      opacity: 0.35,
      roughness: 0.04,
      metalness: 0.1,
      transmission: 0.85,
      ior: 1.52,
      name: 'mat_windshield_glass',
    }),
    tireRubber: new THREE.MeshStandardMaterial({
      color: 0x121417,
      roughness: 0.88,
      metalness: 0.05,
      name: 'mat_tire_rubber',
    }),
    headlightGlass: new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.1,
      name: 'mat_headlight_glass',
    }),
    diceWhite: new THREE.MeshStandardMaterial({
      color: 0xededed,
      roughness: 0.3,
      metalness: 0.7,
      name: 'mat_dice_white',
    }),
    diceDotBlack: new THREE.MeshBasicMaterial({
      color: 0x090a0c,
      name: 'mat_dice_dot',
    }),
    cordLine: new THREE.LineBasicMaterial({
      color: 0x8892b0,
      transparent: true,
      opacity: 0.75,
      name: 'mat_cord_line',
    }),
  };

  // -------------------------------------------------------------
  // 1. Chassis (Streamlined 1930s Boattail Torpedo Body)
  // -------------------------------------------------------------
  const chassis = new THREE.Group();
  chassis.name = 'chassis';
  root.add(chassis);

  // Main Torpedo Fuselage: runs from Z = -2.4 (grille) to Z = 2.6 (boattail tip)
  // Long sculpted hood (streamlined cowl at Y = 0.48, crowned by windshield and cowl brow)
  const hoodGeo = new THREE.BoxGeometry(1.20, 0.38, 1.95);
  const hoodMesh = new THREE.Mesh(hoodGeo, materials.bodyTungsten);
  hoodMesh.position.set(0, 0.33, -1.38);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  chassis.add(hoodMesh);

  // Radiator Grille Bezel (1930s vertical slatted rounded prow)
  const grilleSurroundGeo = new THREE.CylinderGeometry(0.40, 0.36, 0.54, 24);
  grilleSurroundGeo.scale(1.12, 1.0, 0.38);
  const grilleMesh = new THREE.Mesh(grilleSurroundGeo, materials.polishedChrome);
  grilleMesh.position.set(0, 0.38, -2.40);
  chassis.add(grilleMesh);

  // Grille slat mesh texture / dark core recessed within bezel
  const grilleCoreGeo = new THREE.CylinderGeometry(0.38, 0.34, 0.50, 24);
  grilleCoreGeo.scale(1.10, 1.0, 0.34);
  const grilleCoreMesh = new THREE.Mesh(grilleCoreGeo, materials.bodyTrimBlack);
  grilleCoreMesh.position.set(0, 0.38, -2.39);
  chassis.add(grilleCoreMesh);

  // Louver cooling vents on hood flanks
  for (let s = -1; s <= 1; s += 2) {
    for (let l = 0; l < 8; l++) {
      const louverGeo = new THREE.BoxGeometry(0.02, 0.02, 0.12);
      const louver = new THREE.Mesh(louverGeo, materials.polishedChrome);
      louver.position.set(s * 0.63, 0.48, -1.8 + l * 0.16);
      louver.rotation.z = s * 0.2;
      chassis.add(louver);
    }
  }

  // Boattail Tapered Rear Deck (Signature teardrop spine)
  // Using a custom tapered swept geometry
  const boattailLoft = new THREE.CylinderGeometry(0.04, 0.68, 2.1, 16);
  boattailLoft.scale(1.9, 1.0, 0.7);
  boattailLoft.rotateX(-Math.PI / 2);
  const boattailMesh = new THREE.Mesh(boattailLoft, materials.bodyTungsten);
  boattailMesh.position.set(0, 0.38, 1.55);
  boattailMesh.castShadow = true;
  chassis.add(boattailMesh);

  // Center Aerodynamic Fin / Spine on Boattail
  const finGeo = new THREE.BoxGeometry(0.025, 0.1, 1.9);
  const finMesh = new THREE.Mesh(finGeo, materials.polishedChrome);
  finMesh.position.set(0, 0.65, 1.5);
  chassis.add(finMesh);

  // Cockpit Flank Body Panels (Enclosing cockpit tub between hood and boattail)
  for (const s of [-1, 1]) {
    // Sculpted door flank panel bridging hood (Z = -0.4) to boattail (Z = 0.5)
    // Extended downward to Y = 0.25 (height 0.44) so bottom edge at Y = 0.03 seats seamlessly below running board
    const flankGeo = new THREE.BoxGeometry(0.06, 0.44, 1.05);
    const flankMesh = new THREE.Mesh(flankGeo, materials.bodyTungsten);
    flankMesh.position.set(s * 0.60, 0.25, 0.08);
    flankMesh.castShadow = true;
    flankMesh.receiveShadow = true;
    chassis.add(flankMesh);

    // Polished chrome cockpit sill bead capping
    const sillBeadGeo = new THREE.BoxGeometry(0.04, 0.03, 1.05);
    const sillBead = new THREE.Mesh(sillBeadGeo, materials.polishedChrome);
    sillBead.position.set(s * 0.60, 0.48, 0.08);
    chassis.add(sillBead);
  }

  // Dual Vintage Ruby Bullet Taillights at Boattail Flanks
  const rubyGlassMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.85,
    roughness: 0.1,
    metalness: 0.2,
    name: 'mat_ruby_taillight',
  });
  for (const s of [-1, 1]) {
    const tailPodGeo = new THREE.CylinderGeometry(0.035, 0.06, 0.16, 16);
    tailPodGeo.rotateX(Math.PI / 2);
    const tailPod = new THREE.Mesh(tailPodGeo, materials.polishedChrome);
    tailPod.position.set(s * 0.38, 0.45, 2.22);
    chassis.add(tailPod);

    const rubyLensGeo = new THREE.SphereGeometry(0.036, 16, 16);
    const rubyLens = new THREE.Mesh(rubyLensGeo, rubyGlassMat);
    rubyLens.position.set(s * 0.38, 0.45, 2.30);
    chassis.add(rubyLens);
  }

  // Sweeping Pontoon Cycle Fenders (Streamlined 1930s Teardrop Arches)
  for (const s of [-1, 1]) {
    // Front Fender Arch
    const frontFenderGeo = new THREE.TorusGeometry(0.52, 0.045, 8, 24, Math.PI * 0.80);
    frontFenderGeo.scale(1.0, 1.0, 2.5);
    const frontFender = new THREE.Mesh(frontFenderGeo, materials.bodyTungsten);
    frontFender.rotation.y = Math.PI / 2;
    frontFender.rotation.z = -0.28;
    frontFender.position.set(s * 0.85, 0.40, -1.8);
    chassis.add(frontFender);

    // Chrome bead trim along front fender crest
    const frontBeadGeo = new THREE.TorusGeometry(0.53, 0.012, 6, 24, Math.PI * 0.80);
    frontBeadGeo.scale(1.0, 1.0, 2.5);
    const frontBead = new THREE.Mesh(frontBeadGeo, materials.polishedChrome);
    frontBead.rotation.y = Math.PI / 2;
    frontBead.rotation.z = -0.28;
    frontBead.position.set(s * 0.85, 0.40, -1.8);
    chassis.add(frontBead);

    // Rear Fender Arch
    const rearFenderGeo = new THREE.TorusGeometry(0.52, 0.045, 8, 24, Math.PI * 0.80);
    rearFenderGeo.scale(1.0, 1.0, 2.5);
    const rearFender = new THREE.Mesh(rearFenderGeo, materials.bodyTungsten);
    rearFender.rotation.y = Math.PI / 2;
    rearFender.rotation.z = -0.22;
    rearFender.position.set(s * 0.85, 0.40, 1.4);
    chassis.add(rearFender);

    // Chrome bead trim along rear fender crest
    const rearBeadGeo = new THREE.TorusGeometry(0.53, 0.012, 6, 24, Math.PI * 0.80);
    rearBeadGeo.scale(1.0, 1.0, 2.5);
    const rearBead = new THREE.Mesh(rearBeadGeo, materials.polishedChrome);
    rearBead.rotation.y = Math.PI / 2;
    rearBead.rotation.z = -0.22;
    rearBead.position.set(s * 0.85, 0.40, 1.4);
    chassis.add(rearBead);

    // Running board connecting front and rear fenders (widen to 0.36 to seat flush against body flank at X = 0.60)
    const stepGeo = new THREE.BoxGeometry(0.36, 0.04, 1.8);
    const stepMesh = new THREE.Mesh(stepGeo, materials.bodyTrimBlack);
    stepMesh.position.set(s * 0.78, 0.12, -0.2);
    chassis.add(stepMesh);

    // Polished chrome outer edge trim along running board
    const stepTrimGeo = new THREE.BoxGeometry(0.02, 0.044, 1.8);
    const stepTrim = new THREE.Mesh(stepTrimGeo, materials.polishedChrome);
    stepTrim.position.set(s * 0.96, 0.12, -0.2);
    chassis.add(stepTrim);
  }

  // -------------------------------------------------------------
  // 2. Cockpit Tub & Interior Details
  // -------------------------------------------------------------
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  root.add(cockpit);

  // Cockpit tub cutout floor and walls
  const tubFloorGeo = new THREE.BoxGeometry(1.06, 0.04, 1.15);
  const tubFloor = new THREE.Mesh(tubFloorGeo, materials.leatherBlack);
  tubFloor.position.set(0, 0.14, 0.05);
  cockpit.add(tubFloor);

  // Twin vintage bucket seats with ribbed upholstery (grouped for visibility control)
  const seats = new THREE.Group();
  seats.name = 'seats';
  cockpit.add(seats);

  for (const s of [-0.27, 0.27]) {
    const seatBaseGeo = new THREE.BoxGeometry(0.44, 0.14, 0.46);
    const seatBase = new THREE.Mesh(seatBaseGeo, materials.leatherBlack);
    seatBase.position.set(s, 0.22, 0.22);
    seats.add(seatBase);

    const seatBackGeo = new THREE.BoxGeometry(0.44, 0.48, 0.12);
    const seatBack = new THREE.Mesh(seatBackGeo, materials.leatherBlack);
    seatBack.position.set(s, 0.48, 0.44);
    seatBack.rotation.x = 0.22; // Raked sport angle
    seats.add(seatBack);
  }

  // Gear shifter on central tunnel
  const shifterStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.24);
  const shifterStem = new THREE.Mesh(shifterStemGeo, materials.polishedChrome);
  shifterStem.position.set(0, 0.28, 0.0);
  shifterStem.rotation.x = -0.2;
  cockpit.add(shifterStem);

  const shiftKnobGeo = new THREE.SphereGeometry(0.03, 12, 12);
  const shiftKnob = new THREE.Mesh(shiftKnobGeo, materials.brassBezel);
  shiftKnob.position.set(0, 0.38, -0.025);
  cockpit.add(shiftKnob);

  // Low Split-Aero Windshield with Chrome Frame
  const windshieldFrameGeo = new THREE.TorusGeometry(0.48, 0.022, 8, 24, Math.PI * 0.85);
  const leftScreenFrame = new THREE.Mesh(windshieldFrameGeo, materials.polishedChrome);
  leftScreenFrame.position.set(-0.27, 0.62, -0.42);
  leftScreenFrame.rotation.x = 0.35;
  cockpit.add(leftScreenFrame);

  const rightScreenFrame = leftScreenFrame.clone();
  rightScreenFrame.position.set(0.27, 0.62, -0.42);
  cockpit.add(rightScreenFrame);

  // Windshield Glass Panes
  const glassGeo = new THREE.CircleGeometry(0.46, 24, 0, Math.PI * 0.85);
  const leftGlass = new THREE.Mesh(glassGeo, materials.windshieldGlass);
  leftGlass.position.copy(leftScreenFrame.position);
  leftGlass.rotation.copy(leftScreenFrame.rotation);
  cockpit.add(leftGlass);

  const rightGlass = new THREE.Mesh(glassGeo, materials.windshieldGlass);
  rightGlass.position.copy(rightScreenFrame.position);
  rightGlass.rotation.copy(rightScreenFrame.rotation);
  cockpit.add(rightGlass);

  // -------------------------------------------------------------
  // 3. Dashboard & Precision Instruments
  // -------------------------------------------------------------
  const dashboard = new THREE.Group();
  dashboard.name = 'dashboard';
  root.add(dashboard);

  // Curved Dash Panel Cowl (Tungsten/Walnut)
  const dashPanelGeo = new THREE.BoxGeometry(1.08, 0.26, 0.08);
  const dashPanel = new THREE.Mesh(dashPanelGeo, materials.bodyTrimBlack);
  dashPanel.position.set(0, 0.44, -0.44);
  dashboard.add(dashPanel);

  // Large Central Analog Speedometer (0 - 100+ MPH)
  const speedoBezelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 32);
  speedoBezelGeo.rotateX(Math.PI / 2);
  const speedoBezel = new THREE.Mesh(speedoBezelGeo, materials.brassBezel);
  speedoBezel.position.set(0, 0.46, -0.4);
  dashboard.add(speedoBezel);

  const speedoFaceGeo = new THREE.CircleGeometry(0.108, 32);
  const speedoFace = new THREE.Mesh(speedoFaceGeo, materials.gaugeFace);
  speedoFace.position.set(0, 0.46, -0.384);
  dashboard.add(speedoFace);

  // Speedometer Needle (Articulated on pivot)
  const needleGeo = new THREE.BoxGeometry(0.008, 0.085, 0.004);
  needleGeo.translate(0, 0.035, 0); // Pivot at base
  const speedometerNeedle = new THREE.Mesh(needleGeo, materials.needleRed);
  speedometerNeedle.position.set(0, 0.46, -0.38);
  speedometerNeedle.rotation.z = 1.6; // Starts at ~0 MPH
  dashboard.add(speedometerNeedle);

  // Auxiliary Gauges (Tachometer on left, Oil Pressure/Temp on right)
  for (const [gx, gy, gr] of [
    [-0.26, 0.46, 0.085], // Tachometer
    [0.26, 0.46, 0.085],  // Pressure/Temp
    [-0.42, 0.44, 0.055], // Amps
    [0.42, 0.44, 0.055],  // Fuel
  ]) {
    const auxBezelGeo = new THREE.CylinderGeometry(gr, gr, 0.02, 24);
    auxBezelGeo.rotateX(Math.PI / 2);
    const auxBezel = new THREE.Mesh(auxBezelGeo, materials.brassBezel);
    auxBezel.position.set(gx, gy, -0.41);
    dashboard.add(auxBezel);

    const auxFaceGeo = new THREE.CircleGeometry(gr * 0.9, 24);
    const auxFace = new THREE.Mesh(auxFaceGeo, materials.gaugeFace);
    auxFace.position.set(gx, gy, -0.398);
    dashboard.add(auxFace);
  }

  // -------------------------------------------------------------
  // 4. Steering Wheel (Banjo 3-Spoke Wire Rig)
  // -------------------------------------------------------------
  const steeringWheel = new THREE.Group();
  steeringWheel.name = 'steeringWheel';
  root.add(steeringWheel);

  // Driver side positioning (left side: X = -0.27)
  const steerCenterX = -0.27;
  const steerCenterY = 0.48;
  const steerCenterZ = -0.22;
  steeringWheel.position.set(steerCenterX, steerCenterY, steerCenterZ);
  steeringWheel.rotation.x = -0.42; // Raked column

  // Steering Column Stem
  const columnGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.34);
  const columnMesh = new THREE.Mesh(columnGeo, materials.polishedChrome);
  columnMesh.position.set(0, -0.12, -0.12);
  columnMesh.rotation.x = Math.PI / 2;
  steeringWheel.add(columnMesh);

  // Outer Rim (Dark Walnut / Polished metal)
  const rimGeo = new THREE.TorusGeometry(0.19, 0.016, 12, 32);
  const rimMesh = new THREE.Mesh(rimGeo, materials.woodSteering);
  steeringWheel.add(rimMesh);

  // Center Hub
  const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.025, 24);
  hubGeo.rotateX(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, materials.polishedChrome);
  steeringWheel.add(hubMesh);

  // Banjo Wire Spokes (3 sets of grouped wires at 120-degree intervals)
  for (let spokeIdx = 0; spokeIdx < 3; spokeIdx++) {
    const angle = (spokeIdx * Math.PI * 2) / 3;
    for (const offset of [-0.012, 0, 0.012]) {
      const spokeGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.16);
      const spoke = new THREE.Mesh(spokeGeo, materials.polishedChrome);
      spoke.position.set(
        Math.sin(angle) * 0.095 + Math.cos(angle) * offset,
        Math.cos(angle) * 0.095 - Math.sin(angle) * offset,
        0,
      );
      spoke.rotation.z = -angle;
      steeringWheel.add(spoke);
    }
  }

  // -------------------------------------------------------------
  // 5. Rearview Mirror & Swinging Chrome Fuzzy Dice
  // -------------------------------------------------------------
  const rearviewMirror = new THREE.Group();
  rearviewMirror.name = 'rearviewMirror';
  root.add(rearviewMirror);

  // Mirror Stalk (Mounted on cowl center at X = 0, Y = 0.58, Z = -0.44)
  const mirrorStalkGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.14);
  const mirrorStalk = new THREE.Mesh(mirrorStalkGeo, materials.polishedChrome);
  mirrorStalk.position.set(0, 0.56, -0.42);
  mirrorStalk.rotation.x = 0.28;
  rearviewMirror.add(mirrorStalk);

  // Mirror Bezel & Casing (Art deco elliptical capsule)
  const mirrorHousingGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.025, 24);
  mirrorHousingGeo.scale(1.8, 1.0, 0.8);
  mirrorHousingGeo.rotateX(Math.PI / 2);
  const mirrorHousing = new THREE.Mesh(mirrorHousingGeo, materials.polishedChrome);
  mirrorHousing.position.set(0, 0.63, -0.39);
  rearviewMirror.add(mirrorHousing);

  // Reflective Mirror Glass (Facing driver / rear at +Z)
  const mirrorFaceGeo = new THREE.CircleGeometry(0.048, 24);
  mirrorFaceGeo.scale(1.75, 0.95, 1.0);
  const mirrorFace = new THREE.Mesh(mirrorFaceGeo, materials.mirrorGlass);
  mirrorFace.position.set(0, 0.63, -0.376);
  rearviewMirror.add(mirrorFace);

  // -------------------------------------------------------------
  // Dynamic Hanging Fuzzy Dice (Suspended from mirror anchor)
  // -------------------------------------------------------------
  const dice = new THREE.Group();
  dice.name = 'dice';
  // Anchor dice pivot at mirror housing ball joint
  dice.position.set(0, 0.62, -0.37);
  root.add(dice);

  // Helper to create a single beveled die with 6 pip faces
  function createDieMesh(): THREE.Group {
    const dGroup = new THREE.Group();
    const dieCubeGeo = new THREE.BoxGeometry(0.048, 0.048, 0.048);
    const dieCube = new THREE.Mesh(dieCubeGeo, materials.diceWhite);
    dGroup.add(dieCube);

    // Pip dots (black circles slightly offset on faces)
    const pipGeo = new THREE.CircleGeometry(0.005, 12);
    // Face +Z (1 dot: center)
    const pip1 = new THREE.Mesh(pipGeo, materials.diceDotBlack);
    pip1.position.set(0, 0, 0.0245);
    dGroup.add(pip1);

    // Face -Z (6 dots)
    for (const [px, py] of [
      [-0.014, -0.014], [-0.014, 0], [-0.014, 0.014],
      [0.014, -0.014], [0.014, 0], [0.014, 0.014],
    ]) {
      const p = new THREE.Mesh(pipGeo, materials.diceDotBlack);
      p.position.set(px, py, -0.0245);
      p.rotation.y = Math.PI;
      dGroup.add(p);
    }

    // Face +X (2 dots)
    for (const [py, pz] of [[-0.012, -0.012], [0.012, 0.012]]) {
      const p = new THREE.Mesh(pipGeo, materials.diceDotBlack);
      p.position.set(0.0245, py, pz);
      p.rotation.y = Math.PI / 2;
      dGroup.add(p);
    }

    // Face -X (5 dots)
    for (const [py, pz] of [
      [-0.013, -0.013], [0.013, -0.013], [0, 0],
      [-0.013, 0.013], [0.013, 0.013],
    ]) {
      const p = new THREE.Mesh(pipGeo, materials.diceDotBlack);
      p.position.set(-0.0245, py, pz);
      p.rotation.y = -Math.PI / 2;
      dGroup.add(p);
    }

    return dGroup;
  }

  const die1 = createDieMesh();
  die1.position.set(-0.028, -0.15, 0.02);
  die1.rotation.set(0.15, 0.35, 0.1);
  dice.add(die1);

  const die2 = createDieMesh();
  die2.position.set(0.032, -0.17, -0.01);
  die2.rotation.set(-0.25, -0.4, -0.15);
  dice.add(die2);

  // Cord lines connecting anchor (0,0,0) to each die
  const cordPositions = new Float32Array([
    0, 0, 0,  -0.028, -0.126, 0.02,
    0, 0, 0,   0.032, -0.146, -0.01,
  ]);
  const cordGeo = new THREE.BufferGeometry();
  cordGeo.setAttribute('position', new THREE.BufferAttribute(cordPositions, 3));
  const diceCords = new THREE.LineSegments(cordGeo, materials.cordLine);
  dice.add(diceCords);

  // -------------------------------------------------------------
  // 6. Wire-Spoke Wheels (Vintage 1930s Racing Wheels)
  // -------------------------------------------------------------
  const frontWheels = new THREE.Group();
  frontWheels.name = 'frontWheels';
  root.add(frontWheels);

  const rearWheels = new THREE.Group();
  rearWheels.name = 'rearWheels';
  root.add(rearWheels);

  function createWireWheel(): THREE.Group {
    const wGroup = new THREE.Group();

    // Tire Rubber
    const tireGeo = new THREE.TorusGeometry(0.44, 0.11, 16, 32);
    const tireMesh = new THREE.Mesh(tireGeo, materials.tireRubber);
    tireMesh.castShadow = true;
    wGroup.add(tireMesh);

    // Stepped Deep-Dish Chrome Rim
    const rimGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.18, 32, 1, true);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, materials.polishedChrome);
    wGroup.add(rimMesh);

    // Center Hub & 3-Wing Knock-off Spinner
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 24);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, materials.polishedChrome);
    wGroup.add(hubMesh);

    for (let wing = 0; wing < 3; wing++) {
      const angle = (wing * Math.PI * 2) / 3;
      const wingGeo = new THREE.BoxGeometry(0.04, 0.12, 0.02);
      const wingMesh = new THREE.Mesh(wingGeo, materials.polishedChrome);
      wingMesh.position.set(0.12, Math.cos(angle) * 0.08, Math.sin(angle) * 0.08);
      wingMesh.rotation.x = angle;
      wGroup.add(wingMesh);
    }

    // High-Density Radial Wire Spokes (36 spokes)
    const spokeCount = 36;
    for (let s = 0; s < spokeCount; s++) {
      const a = (s * Math.PI * 2) / spokeCount;
      const zOffset = (s % 2 === 0 ? 1 : -1) * 0.045;
      const spokeGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.32);
      const spoke = new THREE.Mesh(spokeGeo, materials.polishedChrome);
      spoke.position.set(zOffset, Math.cos(a) * 0.18, Math.sin(a) * 0.18);
      spoke.rotation.x = -a;
      wGroup.add(spoke);
    }

    return wGroup;
  }

  // Left Front Wheel
  const leftFrontWheel = new THREE.Group();
  leftFrontWheel.position.set(-0.88, 0.44, -1.8);
  const lfwMesh = createWireWheel();
  leftFrontWheel.add(lfwMesh);
  frontWheels.add(leftFrontWheel);

  // Right Front Wheel
  const rightFrontWheel = new THREE.Group();
  rightFrontWheel.position.set(0.88, 0.44, -1.8);
  const rfwMesh = createWireWheel();
  rfwMesh.rotation.y = Math.PI; // Face outwards
  rightFrontWheel.add(rfwMesh);
  frontWheels.add(rightFrontWheel);

  // Left Rear Wheel
  const leftRearWheel = new THREE.Group();
  leftRearWheel.position.set(-0.88, 0.44, 1.4);
  const lrwMesh = createWireWheel();
  leftRearWheel.add(lrwMesh);
  rearWheels.add(leftRearWheel);

  // Right Rear Wheel
  const rightRearWheel = new THREE.Group();
  rightRearWheel.position.set(0.88, 0.44, 1.4);
  const rrwMesh = createWireWheel();
  rrwMesh.rotation.y = Math.PI; // Face outwards
  rightRearWheel.add(rrwMesh);
  rearWheels.add(rightRearWheel);

  // -------------------------------------------------------------
  // 7. Dual Chrome Flank Exhausts & Rear Tailpipes
  // -------------------------------------------------------------
  const exhausts = new THREE.Group();
  exhausts.name = 'exhausts';
  root.add(exhausts);

  for (const s of [-1, 1]) {
    // 4 curved external manifold headers exiting hood side
    for (let h = 0; h < 4; h++) {
      const headerGeo = new THREE.TorusGeometry(0.12, 0.024, 8, 16, Math.PI / 2);
      headerGeo.rotateZ(s === 1 ? -Math.PI / 2 : Math.PI / 2);
      const headerMesh = new THREE.Mesh(headerGeo, materials.polishedChrome);
      headerMesh.position.set(s * 0.64, 0.32, -1.7 + h * 0.18);
      exhausts.add(headerMesh);
    }

    // Long collector pipe along running board into rear trumpet tailpipe
    const pipeGeo = new THREE.CylinderGeometry(0.038, 0.048, 2.6, 16);
    pipeGeo.rotateX(Math.PI / 2);
    const pipeMesh = new THREE.Mesh(pipeGeo, materials.polishedChrome);
    pipeMesh.position.set(s * 0.72, 0.18, 0.1);
    exhausts.add(pipeMesh);

    // Flared trumpet exhaust tip at boattail flank
    const tipGeo = new THREE.CylinderGeometry(0.065, 0.044, 0.28, 16);
    tipGeo.rotateX(Math.PI / 2);
    const tipMesh = new THREE.Mesh(tipGeo, materials.polishedChrome);
    tipMesh.position.set(s * 0.68, 0.2, 1.48);
    exhausts.add(tipMesh);
  }

  // -------------------------------------------------------------
  // 8. Front Headlights (Art Deco Chrome Pods with Halogen/Xenon Core)
  // -------------------------------------------------------------
  const headlights = new THREE.Group();
  headlights.name = 'headlights';
  root.add(headlights);

  for (const s of [-1, 1]) {
    // Chrome bullet housing
    const podGeo = new THREE.CylinderGeometry(0.16, 0.04, 0.26, 24);
    podGeo.rotateX(Math.PI / 2);
    const podMesh = new THREE.Mesh(podGeo, materials.polishedChrome);
    podMesh.position.set(s * 0.52, 0.54, -2.25);
    headlights.add(podMesh);

    // Glowing front glass lens
    const lensGeo = new THREE.CircleGeometry(0.15, 24);
    const lensMesh = new THREE.Mesh(lensGeo, materials.headlightGlass);
    lensMesh.position.set(s * 0.52, 0.54, -2.382);
    headlights.add(lensMesh);

    // Mounting bar to radiator
    const barGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.22);
    barGeo.rotateZ(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeo, materials.polishedChrome);
    barMesh.position.set(s * 0.38, 0.46, -2.24);
    headlights.add(barMesh);
  }

  // -------------------------------------------------------------
  // Visibility Configuration Methods
  // -------------------------------------------------------------
  function setVisibility(config: VehicleVisibilityConfig) {
    if (config.chassis !== undefined) chassis.visible = config.chassis;
    if (config.cockpit !== undefined) cockpit.visible = config.cockpit;
    if (config.seats !== undefined) seats.visible = config.seats;
    if (config.dashboard !== undefined) dashboard.visible = config.dashboard;
    if (config.steeringWheel !== undefined) steeringWheel.visible = config.steeringWheel;
    if (config.rearviewMirror !== undefined) rearviewMirror.visible = config.rearviewMirror;
    if (config.dice !== undefined) dice.visible = config.dice;
    if (config.frontWheels !== undefined) frontWheels.visible = config.frontWheels;
    if (config.rearWheels !== undefined) rearWheels.visible = config.rearWheels;
    if (config.exhausts !== undefined) exhausts.visible = config.exhausts;
    if (config.headlights !== undefined) headlights.visible = config.headlights;
  }

  function isolateCockpit() {
    setVisibility({
      chassis: false,
      frontWheels: false,
      rearWheels: false,
      exhausts: false,
      cockpit: true,
      seats: false,
      dashboard: true,
      steeringWheel: true,
      rearviewMirror: true,
      dice: true,
      headlights: false,
    });
  }

  function showFullExterior() {
    setVisibility({
      chassis: true,
      frontWheels: true,
      rearWheels: true,
      exhausts: true,
      cockpit: true,
      seats: true,
      dashboard: true,
      steeringWheel: true,
      rearviewMirror: true,
      dice: true,
      headlights: true,
    });
  }

  // -------------------------------------------------------------
  // Realtime Animation & Physics Update
  // -------------------------------------------------------------
  function update(opts: VehicleUpdateOpts) {
    const t = opts.t;
    const speed = opts.speed ?? 30.0; // m/s (approx 67 mph)
    const steer = opts.steerAngle ?? 0.0;
    const diceAmp = opts.diceSwingStrength ?? 1.0;
    const vibe = opts.engineVibe ?? 0.003;

    // 1. Wheel Rolling (Circumference ~ 2.76m)
    const rollRate = speed / 0.44; // rad/s
    lfwMesh.rotation.x = t * rollRate;
    rfwMesh.rotation.x = -t * rollRate;
    lrwMesh.rotation.x = t * rollRate;
    rrwMesh.rotation.x = -t * rollRate;

    // 2. Front Wheel Steering & Steering Wheel Articulation
    leftFrontWheel.rotation.y = steer;
    rightFrontWheel.rotation.y = steer;
    steeringWheel.rotation.z = -steer * 2.8;

    // 3. Engine Manifold & Chassis Micro-Vibration (Engine dyno rumble)
    const vibeX = Math.sin(t * 140.0) * vibe;
    const vibeY = Math.cos(t * 160.0) * vibe * 0.7;
    chassis.position.set(vibeX, vibeY, 0);

    // 4. Speedometer needle deflection (0 to 120 MPH mapped to 1.6 rad down to -1.8 rad)
    const mph = Math.min(115, Math.max(0, speed * 2.23694));
    const targetNeedleRot = 1.6 - (mph / 100.0) * 3.1;
    // Micro jitter on needle
    const needleJitter = Math.sin(t * 80.0) * 0.035 * (mph / 100.0);
    speedometerNeedle.rotation.z = targetNeedleRot + needleJitter;

    // 5. Rearview Fuzzy Dice Tempo-Synchronized Pendulum Swing
    // Song BPM: 129.20 -> frequency ~ 2.153 Hz (omega ~ 13.53 rad/s)
    const bpmFreq = (129.20 / 60.0) * Math.PI * 2;
    // Lateral sway driven by road curve and beat pulse
    const swingX = Math.sin(t * bpmFreq) * 0.18 * diceAmp + steer * 0.4;
    // Fore-aft acceleration bounce
    const swingZ = Math.cos(t * (bpmFreq * 0.5)) * 0.12 * diceAmp;
    // Torsional twist
    const twistY = Math.sin(t * bpmFreq * 0.7) * 0.22 * diceAmp;

    dice.rotation.set(swingZ, twistY, swingX);

    // Secondary lag on die2 relative to die1
    die1.rotation.x = 0.15 + Math.sin(t * bpmFreq + 0.3) * 0.15;
    die2.rotation.z = -0.15 + Math.cos(t * bpmFreq - 0.2) * 0.18;
  }

  return {
    root,
    chassis,
    cockpit,
    seats,
    dashboard,
    steeringWheel,
    rearviewMirror,
    dice,
    frontWheels,
    rearWheels,
    leftFrontWheel,
    rightFrontWheel,
    leftRearWheel,
    rightRearWheel,
    exhausts,
    headlights,
    speedometerNeedle,
    diceCords,
    die1,
    die2,
    materials,
    setVisibility,
    isolateCockpit,
    showFullExterior,
    update,
  };
}

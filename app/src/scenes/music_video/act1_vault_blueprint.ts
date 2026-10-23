// ACT I: THE HEIST BLUEPRINTS & TRIGGER (0.0s - 19.31s, Nominal Cut: 18.81s)
// Forrest Nolan - 'No Takebacks' (BPM: 129.20, Bar 1.0 - 11.0)
//
// Lines 0 - 3:
// - Line 0: "This could crash and burn and maybe it'll work" (3.71s - 7.42s)
// - Line 1: "Let's just pull the trigger on the plan" (7.42s - 11.14s)
// - Line 2: "'Cause if we jump the gun, it's over and it's done" (11.14s - 14.86s)
// - Line 3: "But it would all be worth it if it lands" (14.86s - 18.58s)
//
// Aesthetic: Brutalist CAD drafting table / neo-noir technical architecture:
// - Blueprint drafting paper base plane with coordinate grid lines and technical registration marks
// - Holographic 3D bank vault wireframe schematics and laser measurement calipers
// - Interlocking mechanical chronometer brass gears ticking with 129.20 BPM tempo
// - Centerpiece: Multi-tiered circular Bank Vault Combination Dial at [0, 0, 0]
// - Exit Transition Contract T1 (18.81s): Crash-zoom into dial spindle matching Act 2 speedometer bezel

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease, lerp, smoothstep, TAU } from '../../engine/util';

const BPM = 129.20;
const BPS = BPM / 60.0; // ~2.1533 beats per second
const BEAT_DUR = 1.0 / BPS; // ~0.4644s per beat

interface GearDef {
  mesh: THREE.Mesh;
  edgeLines: THREE.LineSegments;
  radius: number;
  teeth: number;
  ratio: number;
  initialPhase: number;
}

export default class Act1VaultBlueprint extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // Visual Groups
  private blueprintTableGroup = new THREE.Group();
  private vaultSchematicGroup = new THREE.Group();
  private dialCenterpieceGroup = new THREE.Group();
  private gearTrainGroup = new THREE.Group();
  private caliperGroup = new THREE.Group();
  private holographicWireGroup = new THREE.Group();

  // Dial Sub-components
  private dialOuterBezelMesh!: THREE.Mesh;
  private dialKnurledRingMesh!: THREE.Group;
  private dialFaceGradMesh!: THREE.Mesh;
  private dialMiddleTumblerGroup = new THREE.Group();
  private dialInnerTumblerGroup = new THREE.Group();
  private dialCenterSpindleHub!: THREE.Group;
  private dialPointerMesh!: THREE.Mesh;
  private dialTexture!: THREE.CanvasTexture;

  // Vault Door Radial Bolts & Structural Geometry
  private boltMeshes: THREE.Mesh[] = [];
  private boltHousings: THREE.Mesh[] = [];
  private vaultOuterRimMesh!: THREE.LineSegments;
  private vaultHingeGroup = new THREE.Group();

  // Caliper & Laser Guides
  private caliperMainBeam!: THREE.Mesh;
  private caliperSlidingJaw!: THREE.Group;
  private laserDimensionLine!: THREE.LineSegments;
  private laserScanLine!: THREE.Line;

  // Interlocking Gears
  private gears: GearDef[] = [];

  // Dynamic Lighting
  private keySpotLight!: THREE.SpotLight;
  private cyanRimLight!: THREE.PointLight;
  private amberDialLight!: THREE.PointLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 120);
    this.layer2d = new Layer2D(W, H);

    // Deep architectural neo-noir blueprint void background
    this.threeScene.background = new THREE.Color(0x06090e);
    this.threeScene.fog = new THREE.FogExp2(0x06090e, 0.015);

    this.setupLighting();
    this.buildBlueprintBaseTable();
    this.buildBankVaultDialCenterpiece();
    this.buildVaultDoorSchematics();
    this.buildChronometerGearTrain();
    this.buildLaserCaliperSystem();
    this.buildHolographicSchematicOverlays();
  }

  // =========================================================================
  // 1. LIGHTING
  // =========================================================================
  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x0f172a, 1.4);
    this.threeScene.add(ambient);

    // Overhead drafting examination spotlight focused on combination dial [0, 0, 0]
    this.keySpotLight = new THREE.SpotLight(0xf8fafc, 3.5, 30, Math.PI / 4, 0.4, 1.2);
    this.keySpotLight.position.set(0.5, 2.5, 7.0);
    this.keySpotLight.target.position.set(0, 0, 0);
    this.threeScene.add(this.keySpotLight);
    this.threeScene.add(this.keySpotLight.target);

    // Technical blueprint rim illumination - restrained architectural slate cyan
    this.cyanRimLight = new THREE.PointLight(0x0284c7, 1.2, 16);
    this.cyanRimLight.position.set(-3.5, 2.0, 2.5);
    this.threeScene.add(this.cyanRimLight);

    // Amber mechanical brass warmth
    this.amberDialLight = new THREE.PointLight(0xf59e0b, 1.8, 10);
    this.amberDialLight.position.set(2.5, -2.0, 2.0);
    this.threeScene.add(this.amberDialLight);
  }

  // =========================================================================
  // 2. BLUEPRINT BASE TABLE & TECHNICAL REGISTRATION MARKS
  // =========================================================================
  private buildBlueprintBaseTable(): void {
    // Drafting table surface plane
    const tableGeo = new THREE.PlaneGeometry(24, 16);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      roughness: 0.88,
      metalness: 0.12,
    });
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.position.set(0, 0, -0.06);
    this.blueprintTableGroup.add(tableMesh);

    // High-precision CAD Grid Hairlines (0.2m minor, 1.0m major)
    const gridMinorPts: number[] = [];
    const gridMajorPts: number[] = [];
    const width = 20;
    const height = 14;

    for (let x = -width / 2; x <= width / 2; x += 0.2) {
      const isMajor = Math.abs(Math.round(x) - x) < 0.001;
      const arr = isMajor ? gridMajorPts : gridMinorPts;
      arr.push(x, -height / 2, -0.05, x, height / 2, -0.05);
    }
    for (let y = -height / 2; y <= height / 2; y += 0.2) {
      const isMajor = Math.abs(Math.round(y) - y) < 0.001;
      const arr = isMajor ? gridMajorPts : gridMinorPts;
      arr.push(-width / 2, y, -0.05, width / 2, y, -0.05);
    }

    const minorGeo = new THREE.BufferGeometry();
    minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridMinorPts, 3));
    const minorMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.16,
    });
    const minorLines = new THREE.LineSegments(minorGeo, minorMat);
    this.blueprintTableGroup.add(minorLines);

    const majorGeo = new THREE.BufferGeometry();
    majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridMajorPts, 3));
    const majorMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.42,
    });
    const majorLines = new THREE.LineSegments(majorGeo, majorMat);
    this.blueprintTableGroup.add(majorLines);

    // 4 Corner Registration Brackets and Alignment Crosshairs
    const regPts: number[] = [];
    const cornerX = 6.2;
    const cornerY = 4.0;
    const bLen = 0.55;

    // Corner brackets
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * cornerX;
        const cy = sy * cornerY;
        regPts.push(cx, cy, -0.04, cx - sx * bLen, cy, -0.04);
        regPts.push(cx, cy, -0.04, cx, cy - sy * bLen, -0.04);

        // Precision registration tick
        regPts.push(cx - sx * 0.15, cy - sy * 0.15, -0.04, cx - sx * 0.35, cy - sy * 0.15, -0.04);
        regPts.push(cx - sx * 0.15, cy - sy * 0.15, -0.04, cx - sx * 0.15, cy - sy * 0.35, -0.04);
      }
    }

    // Mid-edge alignment marks
    for (const sx of [-1, 1]) {
      regPts.push(sx * cornerX, -0.2, -0.04, sx * cornerX, 0.2, -0.04);
      regPts.push(sx * (cornerX - 0.2), 0, -0.04, sx * (cornerX + 0.2), 0, -0.04);
    }
    for (const sy of [-1, 1]) {
      regPts.push(-0.2, sy * cornerY, -0.04, 0.2, sy * cornerY, -0.04);
      regPts.push(0, sy * (cornerY - 0.2), -0.04, 0, sy * (cornerY + 0.2), -0.04);
    }

    const regGeo = new THREE.BufferGeometry();
    regGeo.setAttribute('position', new THREE.Float32BufferAttribute(regPts, 3));
    const regMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
    });
    this.blueprintTableGroup.add(new THREE.LineSegments(regGeo, regMat));

    // Concentric registration target around [0, 0, 0]
    const centerTargGeo = new THREE.RingGeometry(3.18, 3.20, 64);
    const centerTargMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const centerTarg = new THREE.Mesh(centerTargGeo, centerTargMat);
    centerTarg.position.set(0, 0, -0.045);
    this.blueprintTableGroup.add(centerTarg);

    this.threeScene.add(this.blueprintTableGroup);
  }

  // =========================================================================
  // 3. CENTERPIECE: MULTI-TIERED BANK VAULT COMBINATION DIAL AT [0, 0, 0]
  // =========================================================================
  private buildBankVaultDialCenterpiece(): void {
    this.dialCenterpieceGroup.position.set(0, 0, 0);

    // 1. Heavy Outer Circular Brass Bezel
    // Outer radius 1.35 matches the speedometer outer brass bezel in Act 2
    const bezelGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.08, 64, 1, true);
    bezelGeo.rotateX(Math.PI / 2);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0xd4a359, // COLOR_TOKENS.BRASS_BEZEL
      metalness: 0.92,
      roughness: 0.22,
    });
    this.dialOuterBezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    this.dialOuterBezelMesh.position.set(0, 0, 0.02);
    this.dialCenterpieceGroup.add(this.dialOuterBezelMesh);

    // Bezel Rim Ring
    const rimRingGeo = new THREE.RingGeometry(1.28, 1.36, 64);
    const rimRingMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    const rimRingMesh = new THREE.Mesh(rimRingGeo, rimRingMat);
    rimRingMesh.position.set(0, 0, 0.061);
    this.dialCenterpieceGroup.add(rimRingMesh);

    // 2. Knurled Grip Ring (60 radial knurled flutes)
    this.dialKnurledRingMesh = new THREE.Group();
    const fluteGeo = new THREE.BoxGeometry(0.022, 0.065, 0.06);
    const fluteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
    });
    const knurlCount = 60;
    const knurlRadius = 1.25;
    for (let k = 0; k < knurlCount; k++) {
      const angle = (k / knurlCount) * TAU;
      const flute = new THREE.Mesh(fluteGeo, fluteMat);
      flute.position.set(Math.cos(angle) * knurlRadius, Math.sin(angle) * knurlRadius, 0.035);
      flute.rotation.z = angle;
      this.dialKnurledRingMesh.add(flute);
    }
    this.dialCenterpieceGroup.add(this.dialKnurledRingMesh);

    // 3. Etched Dial Face (00 to 99 graduations)
    // Procedural high-resolution dial face CanvasTexture
    this.dialTexture = this.generateDialFaceTexture();
    const dialFaceGeo = new THREE.RingGeometry(0.74, 1.22, 64);
    const dialFaceMat = new THREE.MeshStandardMaterial({
      map: this.dialTexture,
      roughness: 0.3,
      metalness: 0.7,
      side: THREE.DoubleSide,
    });
    this.dialFaceGradMesh = new THREE.Mesh(dialFaceGeo, dialFaceMat);
    this.dialFaceGradMesh.position.set(0, 0, 0.05);
    this.dialCenterpieceGroup.add(this.dialFaceGradMesh);

    // 4. Middle Tumbler Ring Assembly
    // Inner rotating tumblers with locking gate cutouts
    const midTumblerGeo = new THREE.RingGeometry(0.48, 0.73, 48);
    const midTumblerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const midTumblerMesh = new THREE.Mesh(midTumblerGeo, midTumblerMat);
    midTumblerMesh.position.set(0, 0, 0.06);
    this.dialMiddleTumblerGroup.add(midTumblerMesh);

    // Tumbler locking gate slots (3 radial brass pins)
    const pinGeo = new THREE.BoxGeometry(0.05, 0.12, 0.04);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, metalness: 0.9, roughness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const pAngle = (i / 3) * TAU;
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(Math.cos(pAngle) * 0.61, Math.sin(pAngle) * 0.61, 0.08);
      pin.rotation.z = pAngle;
      this.dialMiddleTumblerGroup.add(pin);
    }
    this.dialCenterpieceGroup.add(this.dialMiddleTumblerGroup);

    // 5. Inner Tumbler Ring Assembly
    const innerTumblerGeo = new THREE.RingGeometry(0.28, 0.47, 48);
    const innerTumblerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.92,
      roughness: 0.3,
      side: THREE.DoubleSide,
    });
    const innerTumblerMesh = new THREE.Mesh(innerTumblerGeo, innerTumblerMat);
    innerTumblerMesh.position.set(0, 0, 0.07);
    this.dialInnerTumblerGroup.add(innerTumblerMesh);

    // Inner brass keyway dog
    const innerDogGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16);
    innerDogGeo.rotateX(Math.PI / 2);
    const innerDog = new THREE.Mesh(innerDogGeo, pinMat);
    innerDog.position.set(0.38, 0, 0.09);
    this.dialInnerTumblerGroup.add(innerDog);
    this.dialCenterpieceGroup.add(this.dialInnerTumblerGroup);

    // 6. Central Spindle Hub at [0, 0, 0]
    // The exact concentric morph anchor into Act 2 speedometer spindle
    this.dialCenterSpindleHub = new THREE.Group();
    this.dialCenterSpindleHub.position.set(0, 0, 0);

    const spindleOuterKnobGeo = new THREE.CylinderGeometry(0.26, 0.27, 0.09, 36);
    spindleOuterKnobGeo.rotateX(Math.PI / 2);
    const spindleKnobMat = new THREE.MeshStandardMaterial({
      color: 0xd4a359,
      metalness: 0.94,
      roughness: 0.15,
    });
    const spindleKnob = new THREE.Mesh(spindleOuterKnobGeo, spindleKnobMat);
    spindleKnob.position.set(0, 0, 0.095);
    this.dialCenterSpindleHub.add(spindleKnob);

    // Deep center bore keyway (radius 0.12)
    const boreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 32);
    boreGeo.rotateX(Math.PI / 2);
    const boreMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.95,
      metalness: 0.2,
    });
    const bore = new THREE.Mesh(boreGeo, boreMat);
    bore.position.set(0, 0, 0.12);
    this.dialCenterSpindleHub.add(bore);

    // Central crosshair optic indicator inside spindle bore
    const reticlePts = [-0.09, 0, 0.14, 0.09, 0, 0.14, 0, -0.09, 0.14, 0, 0.09, 0.14];
    const reticleGeo = new THREE.BufferGeometry();
    reticleGeo.setAttribute('position', new THREE.Float32BufferAttribute(reticlePts, 3));
    const reticleMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.95,
    });
    const reticle = new THREE.LineSegments(reticleGeo, reticleMat);
    this.dialCenterSpindleHub.add(reticle);

    this.dialCenterpieceGroup.add(this.dialCenterSpindleHub);

    // 7. Fixed Top Calibration Index Pointer (at 12 o'clock, y = 1.38)
    const pointerShape = new THREE.Shape();
    pointerShape.moveTo(0, 1.25);
    pointerShape.lineTo(-0.06, 1.40);
    pointerShape.lineTo(0.06, 1.40);
    pointerShape.closePath();

    const pointerGeo = new THREE.ShapeGeometry(pointerShape);
    const pointerMat = new THREE.MeshBasicMaterial({
      color: 0xef4444, // GAUGE_NEEDLE_RED
      side: THREE.DoubleSide,
    });
    this.dialPointerMesh = new THREE.Mesh(pointerGeo, pointerMat);
    this.dialPointerMesh.position.set(0, 0, 0.09);
    this.dialCenterpieceGroup.add(this.dialPointerMesh);

    this.threeScene.add(this.dialCenterpieceGroup);
  }

  /**
   * Generates a 2048x2048 procedural canvas texture for the combination dial graduations
   * with numbers 00 to 90, major/medium/minor ticks, and MIL-SPEC engineering labeling.
   */
  private generateDialFaceTexture(): THREE.CanvasTexture {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.48;
    const innerR = size * 0.31;

    // Background dial disc: dark tungsten steel
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, TAU);
    ctx.arc(cx, cy, innerR, TAU, 0, true);
    ctx.fillStyle = '#1a1d22';
    ctx.fill();

    // Concentric guide hairlines
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 8, 0, TAU);
    ctx.arc(cx, cy, innerR + 14, 0, TAU);
    ctx.stroke();

    // 100 Graduation Tick Marks
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * TAU - Math.PI / 2;
      const isMajor = i % 10 === 0;
      const isMedium = i % 5 === 0 && !isMajor;

      const tickOuter = outerR - 12;
      const tickLen = isMajor ? 52 : isMedium ? 34 : 20;
      const tickInner = tickOuter - tickLen;

      const x1 = cx + Math.cos(angle) * tickInner;
      const y1 = cy + Math.sin(angle) * tickInner;
      const x2 = cx + Math.cos(angle) * tickOuter;
      const y2 = cy + Math.sin(angle) * tickOuter;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = isMajor ? 6 : isMedium ? 4 : 2.5;
      ctx.strokeStyle = isMajor ? '#00e5ff' : isMedium ? '#f59e0b' : 'rgba(226, 232, 240, 0.5)';
      ctx.stroke();

      // Render Numbering (00, 10, 20... 90) on major ticks
      if (isMajor) {
        const textR = tickInner - 40;
        const tx = cx + Math.cos(angle) * textR;
        const ty = cy + Math.sin(angle) * textR;

        ctx.save();
        ctx.translate(tx, ty);
        // Rotate text upright relative to center
        ctx.rotate(angle + Math.PI / 2);
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const numStr = i < 10 ? `0${i}` : `${i}`;
        ctx.fillText(numStr, 0, 0);
        ctx.restore();
      }
    }

    // Inner dial perimeter text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.65)';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

  // =========================================================================
  // 4. HOLOGRAPHIC 3D BANK VAULT DOOR SCHEMATICS & RADIAL LOCKING BOLTS
  // =========================================================================
  private buildVaultDoorSchematics(): void {
    // Heavy Circular Vault Door Outer Perimeter Wireframe (Radius 2.55)
    const rimPts: number[] = [];
    const segs = 96;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      rimPts.push(Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0.01);
    }
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPts, 3));
    const rimMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.7,
    });
    this.vaultOuterRimMesh = new THREE.LineSegments(rimGeo, rimMat);
    this.vaultSchematicGroup.add(this.vaultOuterRimMesh);

    // 8 Radial Locking Bolts Array
    const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 24);
    boltGeo.rotateZ(Math.PI / 2);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8, // CHROME_POLISHED
      metalness: 0.95,
      roughness: 0.12,
    });

    const housingGeo = new THREE.BoxGeometry(0.45, 0.12, 0.12);
    const housingMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      metalness: 0.8,
      roughness: 0.4,
    });

    for (let b = 0; b < 8; b++) {
      const angle = (b / 8) * TAU;

      // Housing block affixed at r = 1.65
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(Math.cos(angle) * 1.65, Math.sin(angle) * 1.65, 0.06);
      housing.rotation.z = angle;
      this.boltHousings.push(housing);
      this.vaultSchematicGroup.add(housing);

      // Radial locking bolt sliding through housing toward r = 2.45
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(Math.cos(angle) * 2.1, Math.sin(angle) * 2.1, 0.06);
      bolt.rotation.z = angle;
      bolt.userData = { angle, baseR: 2.1 };
      this.boltMeshes.push(bolt);
      this.vaultSchematicGroup.add(bolt);
    }

    // Vault Door Massive Left Hinges Assembly
    const hingeMat = new THREE.MeshStandardMaterial({
      color: 0x272a30,
      metalness: 0.9,
      roughness: 0.25,
    });
    const hingeLugs = [-1.4, 1.4];
    for (const hy of hingeLugs) {
      const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.35, 24), hingeMat);
      lug.position.set(-2.85, hy, 0.12);
      this.vaultHingeGroup.add(lug);

      // Hinge connecting bracket arm to vault frame
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.12), hingeMat);
      arm.position.set(-2.55, hy, 0.12);
      this.vaultHingeGroup.add(arm);
    }
    this.vaultSchematicGroup.add(this.vaultHingeGroup);

    this.threeScene.add(this.vaultSchematicGroup);
  }

  // =========================================================================
  // 5. INTERLOCKING MECHANICAL CHRONOMETER BRASS GEARS
  // =========================================================================
  private buildChronometerGearTrain(): void {
    // Construct 5 interlocking gears meshed around the combination dial
    const gearConfigs = [
      { id: 'drive_gear', pos: [-2.15, 0.95, 0.03], radius: 0.85, teeth: 28, ratio: 1.0, phase: 0 },
      { id: 'idler_gear', pos: [-1.22, 1.82, 0.03], radius: 0.46, teeth: 15, ratio: -(28 / 15), phase: 0.12 },
      { id: 'planetary_gear', pos: [1.82, 1.25, 0.03], radius: 0.65, teeth: 22, ratio: 28 / 22, phase: 0.24 },
      { id: 'rack_pinion', pos: [1.95, -1.18, 0.03], radius: 0.72, teeth: 24, ratio: -(28 / 24), phase: 0.05 },
      { id: 'escapement_wheel', pos: [-1.75, -1.45, 0.03], radius: 0.52, teeth: 18, ratio: 28 / 18, phase: 0.18 },
    ];

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a359, // BRASS_BEZEL
      metalness: 0.88,
      roughness: 0.22,
    });
    const gearLineMat = new THREE.LineBasicMaterial({
      color: 0xfef08a, // HEADLIGHT_HALOGEN / Pale Gold Edge
      transparent: true,
      opacity: 0.7,
    });

    for (const cfg of gearConfigs) {
      const shape = this.createSpurGearShape(cfg.radius, cfg.teeth, 0.07, 4);
      const extrudeSettings: THREE.ExtrudeGeometryOptions = {
        depth: 0.035,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.008,
        bevelThickness: 0.008,
      };
      const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geom.center();

      const mesh = new THREE.Mesh(geom, brassMat);
      mesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);

      const edges = new THREE.EdgesGeometry(geom, 25);
      const edgeLines = new THREE.LineSegments(edges, gearLineMat);
      mesh.add(edgeLines);

      // Central axle jewel pin
      const axle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.1, metalness: 0.9 }),
      );
      axle.rotateX(Math.PI / 2);
      mesh.add(axle);

      this.gearTrainGroup.add(mesh);
      this.gears.push({
        mesh,
        edgeLines,
        radius: cfg.radius,
        teeth: cfg.teeth,
        ratio: cfg.ratio,
        initialPhase: cfg.phase,
      });
    }

    this.threeScene.add(this.gearTrainGroup);
  }

  /**
   * Generates a 2D spur gear profile with trapezoidal involute teeth and weight-reduction spoke holes.
   */
  private createSpurGearShape(radius: number, teeth: number, toothDepth: number, spokes: number): THREE.Shape {
    const shape = new THREE.Shape();
    const rBase = radius - toothDepth * 0.55;
    const rTip = radius + toothDepth * 0.55;
    const totalPts = teeth * 4;

    for (let i = 0; i < totalPts; i++) {
      const angle = (i / totalPts) * TAU;
      const step = i % 4;
      const r = step === 1 || step === 2 ? rTip : rBase;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    // Spoke cutouts for vintage horology aesthetic
    if (spokes > 0 && radius > 0.4) {
      const spokeRadius = radius * 0.22;
      const spokeDist = radius * 0.54;
      for (let s = 0; s < spokes; s++) {
        const sa = (s / spokes) * TAU;
        const hole = new THREE.Path();
        const hx = Math.cos(sa) * spokeDist;
        const hy = Math.sin(sa) * spokeDist;
        hole.absarc(hx, hy, spokeRadius, 0, TAU, false);
        shape.holes.push(hole);
      }
    }
    return shape;
  }

  // =========================================================================
  // 6. LASER MEASUREMENT CALIPERS & DIMENSION GUIDES
  // =========================================================================
  private buildLaserCaliperSystem(): void {
    // Caliper main horizontal beam (positioned above the dial)
    const beamGeo = new THREE.BoxGeometry(4.2, 0.12, 0.04);
    const beamMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.2,
    });
    this.caliperMainBeam = new THREE.Mesh(beamGeo, beamMat);
    this.caliperMainBeam.position.set(0, 2.05, 0.08);
    this.caliperGroup.add(this.caliperMainBeam);

    // Fixed Reference Jaw (left jaw at x = -1.35)
    const fixedJawGeo = new THREE.BoxGeometry(0.1, 0.95, 0.04);
    const jawMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.15,
    });
    const fixedJaw = new THREE.Mesh(fixedJawGeo, jawMat);
    fixedJaw.position.set(-1.35, 1.58, 0.08);
    this.caliperGroup.add(fixedJaw);

    // Sliding Vernier Jaw (right jaw at x = 1.35)
    this.caliperSlidingJaw = new THREE.Group();
    const slideBlock = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.05), jawMat);
    const slidingJaw = new THREE.Mesh(fixedJawGeo, jawMat);
    slidingJaw.position.set(0, -0.47, 0);
    this.caliperSlidingJaw.add(slideBlock);
    this.caliperSlidingJaw.add(slidingJaw);
    this.caliperSlidingJaw.position.set(1.35, 2.05, 0.08);
    this.caliperGroup.add(this.caliperSlidingJaw);

    // Cyan Laser Dimension Caliper Guideline
    const laserDimPts = [-1.35, 1.15, 0.1, 1.35, 1.15, 0.1];
    const laserDimGeo = new THREE.BufferGeometry();
    laserDimGeo.setAttribute('position', new THREE.Float32BufferAttribute(laserDimPts, 3));
    const laserDimMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.9,
    });
    this.laserDimensionLine = new THREE.LineSegments(laserDimGeo, laserDimMat);
    this.caliperGroup.add(this.laserDimensionLine);

    // Vertical Laser Scanline traversing across the drafting plane
    const scanPts = [0, -6.0, 0.05, 0, 6.0, 0.05];
    const scanGeo = new THREE.BufferGeometry();
    scanGeo.setAttribute('position', new THREE.Float32BufferAttribute(scanPts, 3));
    const scanMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.45,
    });
    this.laserScanLine = new THREE.Line(scanGeo, scanMat);
    this.caliperGroup.add(this.laserScanLine);

    this.threeScene.add(this.caliperGroup);
  }

  // =========================================================================
  // 7. HOLOGRAPHIC SCHEMATIC OVERLAYS & STRUCTURAL VECTORS
  // =========================================================================
  private buildHolographicSchematicOverlays(): void {
    // 3D Concentric Holographic Cones & Altitude Rings
    const holoRingGeo = new THREE.RingGeometry(1.95, 1.98, 64);
    const holoRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const holoRing = new THREE.Mesh(holoRingGeo, holoRingMat);
    holoRing.position.set(0, 0, 0.22);
    this.holographicWireGroup.add(holoRing);

    // Radial measurement spokes (45-degree angle rays)
    const spokePts: number[] = [];
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * TAU;
      spokePts.push(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.15);
      spokePts.push(Math.cos(a) * 2.8, Math.sin(a) * 2.8, 0.15);
    }
    const spokeGeo = new THREE.BufferGeometry();
    spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePts, 3));
    const spokeMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
    });
    this.holographicWireGroup.add(new THREE.LineSegments(spokeGeo, spokeMat));

    // North Azimuth Rose Compass at [-5.0, 2.5]
    const roseGroup = new THREE.Group();
    roseGroup.position.set(-5.0, 2.5, 0.02);
    const roseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.50, 36),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
    );
    roseGroup.add(roseRing);

    const roseNeedlePts = [0, -0.45, 0.01, 0, 0.45, 0.01, -0.45, 0, 0.01, 0.45, 0, 0.01];
    const roseNeedleGeo = new THREE.BufferGeometry();
    roseNeedleGeo.setAttribute('position', new THREE.Float32BufferAttribute(roseNeedlePts, 3));
    roseGroup.add(new THREE.LineSegments(roseNeedleGeo, new THREE.LineBasicMaterial({ color: 0x38bdf8 })));
    this.holographicWireGroup.add(roseGroup);

    this.threeScene.add(this.holographicWireGroup);
  }

  // =========================================================================
  // 8. FRAME UPDATE & RENDER LOOP (Deterministic f(t))
  // =========================================================================
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;
    const { T1 } = TRANSITION_CONTRACTS;

    // --- Audio Reactive Fallbacks ---
    const bass = f.a?.bass ?? (0.35 + 0.15 * Math.sin(t * BPS * Math.PI));
    const kick = f.a?.kick ?? (Math.max(0, Math.sin(t * BPS * TAU)) > 0.85 ? 0.8 : 0.0);

    // --- 1. Camera Trajectory & Continuous Velocity Handoff (Exit Contract T1) ---
    // Smooth flight choreography leading up to exact crash zoom into spindle [0, 0, 2.2] at 18.81s:
    // Phase 0 (0.0s - 3.71s): Wide establishing drift over technical drafting table
    // Phase 1 (3.71s - 7.42s): Glide across left schematics & gear train (Line 0)
    // Phase 2 (7.42s - 11.14s): Crane across to trigger & combination dial (Line 1)
    // Phase 3 (11.14s - 14.86s): High-angle framing over interlocking tumblers (Line 2)
    // Phase 4 (14.86s - 18.81s): Crash-zoom accelerating directly into spindle bore (Line 3 -> T1)

    let camX = 0.0;
    let camY = 0.0;
    let camZ = 2.2;
    let lookX = 0.0;
    let lookY = 0.0;
    let lookZ = 0.0;

    const T_ZOOM_START = 16.5; // Final crash zoom begins
    const T_SEAM = T1.t; // 18.81s

    if (t < 3.71) {
      const u = clamp(t / 3.71, 0, 1);
      const eu = ease.outCubic(u);
      camX = lerp(1.15, -0.65, eu);
      camY = lerp(1.85, 1.15, eu);
      camZ = lerp(7.8, 6.2, eu);
      lookX = lerp(0.15, -0.25, eu);
      lookY = lerp(0.2, 0.1, eu);
      lookZ = 0.0;
    } else if (t < 7.42) {
      const u = clamp((t - 3.71) / (7.42 - 3.71), 0, 1);
      const eu = ease.inOutCubic(u);
      camX = lerp(-0.65, -1.35, eu);
      camY = lerp(1.15, -0.55, eu);
      camZ = lerp(6.2, 5.1, eu);
      lookX = lerp(-0.25, -0.3, eu);
      lookY = lerp(0.1, 0.0, eu);
      lookZ = 0.0;
    } else if (t < 11.14) {
      const u = clamp((t - 7.42) / (11.14 - 7.42), 0, 1);
      const eu = ease.inOutCubic(u);
      camX = lerp(-1.35, 1.1, eu);
      camY = lerp(-0.55, 0.45, eu);
      camZ = lerp(5.1, 4.4, eu);
      lookX = lerp(-0.3, 0.15, eu);
      lookY = lerp(0.0, 0.0, eu);
      lookZ = 0.0;
    } else if (t < T_ZOOM_START) {
      const u = clamp((t - 11.14) / (T_ZOOM_START - 11.14), 0, 1);
      const eu = ease.inOutCubic(u);
      camX = lerp(1.1, 0.0, eu);
      camY = lerp(0.45, 0.0, eu);
      camZ = lerp(4.4, 3.65, eu);
      lookX = lerp(0.15, 0.0, eu);
      lookY = 0.0;
      lookZ = 0.0;
    } else if (t <= T_SEAM) {
      // Hermite Spline Crash-Zoom into [0, 0, 2.2] with instantaneous velocity [0, 0, -14.0]
      const dtZoom = T_SEAM - T_ZOOM_START; // 2.31s
      const u = clamp((t - T_ZOOM_START) / dtZoom, 0, 1);

      camX = lerp(camX, 0.0, ease.outCubic(u));
      camY = lerp(camY, 0.0, ease.outCubic(u));

      const z0 = 3.65;
      const v0 = -0.4;
      const z1 = T1.pos[2]; // 2.2
      const v1 = T1.velocity[2]; // -14.0

      const h00 = 2 * u * u * u - 3 * u * u + 1;
      const h10 = u * u * u - 2 * u * u + u;
      const h01 = -2 * u * u * u + 3 * u * u;
      const h11 = u * u * u - u * u;

      camZ = h00 * z0 + h10 * (dtZoom * v0) + h01 * z1 + h11 * (dtZoom * v1);
      lookX = 0.0;
      lookY = 0.0;
      lookZ = 0.0;
    } else {
      // Past 18.81s up to 19.31s: continue continuous linear velocity trajectory past spindle
      const dtPast = t - T_SEAM;
      camX = T1.pos[0];
      camY = T1.pos[1];
      camZ = T1.pos[2] + dtPast * T1.velocity[2]; // 2.2 - 14.0 * dtPast
      lookX = T1.target[0];
      lookY = T1.target[1];
      lookZ = T1.target[2];
    }

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(lookX, lookY, lookZ);
    this.camera.fov = T1.fov;
    this.camera.updateProjectionMatrix();

    // --- 2. Kinetic Mechanics: Safecracker Dialing Choreography ---
    // Safecracker combination rotation stages:
    // 0.0s - 3.71s: resting calibration (rotates clockwise to 42)
    // 3.71s - 7.42s: counter-clockwise spin past 0 to 76
    // 7.42s - 11.14s: rapid clockwise spin to 18
    // 11.14s - 14.86s: counter-clockwise spin to 94
    // 14.86s - 17.4s: final slow clockwise lock-in alignment to 00 (click!)
    // 17.4s - 19.31s: locking bolt retraction and trigger tripped!

    let dialAngle = 0.0;
    if (t < 3.71) {
      dialAngle = ease.inOutCubic(t / 3.71) * (TAU * 0.42);
    } else if (t < 7.42) {
      const u = ease.inOutCubic((t - 3.71) / 3.71);
      dialAngle = TAU * 0.42 - u * (TAU * 1.34);
    } else if (t < 11.14) {
      const u = ease.inOutCubic((t - 7.42) / 3.72);
      dialAngle = TAU * 0.42 - TAU * 1.34 + u * (TAU * 1.76);
    } else if (t < 14.86) {
      const u = ease.inOutCubic((t - 11.14) / 3.72);
      dialAngle = TAU * 0.42 - TAU * 1.34 + TAU * 1.76 - u * (TAU * 1.24);
    } else {
      const u = ease.outCubic(clamp((t - 14.86) / 2.54, 0, 1));
      dialAngle = TAU * 0.42 - TAU * 1.34 + TAU * 1.76 - TAU * 1.24 + u * (TAU * 0.88);
    }

    this.dialFaceGradMesh.rotation.z = dialAngle;
    this.dialKnurledRingMesh.rotation.z = dialAngle * 0.5;
    this.dialMiddleTumblerGroup.rotation.z = -dialAngle * 0.72;
    this.dialInnerTumblerGroup.rotation.z = dialAngle * 1.35;
    this.dialCenterSpindleHub.rotation.z = dialAngle * 0.25;

    // --- 3. Kinetic Mechanics: Chronometer Gear Train Meshing ---
    // Stepped ticking on each beat of 129.20 BPM plus continuous rotation
    const beatFraction = (t * BPS) % 1.0;
    const beatTick = Math.floor(t * BPS) + ease.outBack(clamp(beatFraction * 3.8, 0, 1));
    const baseGearRotation = beatTick * 0.18 + t * 0.35;

    for (const g of this.gears) {
      g.mesh.rotation.z = baseGearRotation * g.ratio + g.initialPhase;
    }

    // --- 4. Vault Door Locking Bolts Retraction Sequence ---
    // At t >= 17.2s, tumblers align: bolts retract inward from r = 2.1 to r = 1.6
    const boltUnlockProgress = ease.inOutCubic(clamp((t - 17.2) / 0.95, 0, 1));
    for (const bolt of this.boltMeshes) {
      const bAngle = bolt.userData.angle as number;
      const curR = lerp(2.1, 1.58, boltUnlockProgress);
      bolt.position.set(Math.cos(bAngle) * curR, Math.sin(bAngle) * curR, 0.06);
    }

    // --- 5. Laser Measurement Calipers Scanning ---
    // Sliding jaw responds dynamically to measurement envelope
    const caliperMeasureWidth = 1.35 + Math.sin(t * 3.5) * 0.08 * (1.0 - boltUnlockProgress);
    this.caliperSlidingJaw.position.x = caliperMeasureWidth;

    // Laser scanline sweeping across the drafting plane
    const scanX = -5.5 + ((t * 2.2) % 11.0);
    this.laserScanLine.position.x = scanX;

    // Laser Dimension line update
    const laserPos = this.laserDimensionLine.geometry.attributes.position as THREE.BufferAttribute;
    laserPos.setXYZ(0, -1.35, 1.15, 0.1);
    laserPos.setXYZ(1, caliperMeasureWidth, 1.15, 0.1);
    laserPos.needsUpdate = true;

    // Dynamic light pulsing
    this.amberDialLight.intensity = 1.8 + kick * 1.2;
    this.cyanRimLight.intensity = 1.2 + bass * 0.4;

    // --- 6. 2D Kinetic Typography Overlay (`Layer2D`) ---
    this.layer2d.clear();
    const ctx = this.layer2d.ctx;

    // --- 7. Kinetic Lyric Rendering via LyricRig (Lines 0 - 3) ---
    // Line 0: "This could crash and burn and maybe it'll work" (3.71s - 7.42s)
    LyricRig.renderLine(ctx, {
      worldPos: [-0.65, 1.85, 0.25],
      cam: this.camera,
      t,
      lineIdx: 0,
      fontSize: 48,
      baseColor: 'rgba(203, 213, 225, 0.55)',
      highlightColor: COLOR_TOKENS.CAD_HAIRLINE_CYAN,
      haloColor: 'rgba(3, 7, 18, 0.95)',
      yOffsetPx: -30,
    });

    // Line 1: "Let's just pull the trigger on the plan" (7.42s - 11.14s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.85, 1.5, 0.2],
      cam: this.camera,
      t,
      lineIdx: 1,
      fontSize: 46,
      baseColor: 'rgba(203, 213, 225, 0.55)',
      highlightColor: COLOR_TOKENS.CAD_HAIRLINE_CYAN,
      haloColor: 'rgba(3, 7, 18, 0.95)',
      yOffsetPx: -20,
    });

    // Line 2: "'Cause if we jump the gun, it's over and it's done" (11.14s - 14.86s)
    LyricRig.renderLine(ctx, {
      worldPos: [-0.55, -1.65, 0.2],
      cam: this.camera,
      t,
      lineIdx: 2,
      fontSize: 46,
      baseColor: 'rgba(203, 213, 225, 0.55)',
      highlightColor: '#38bdf8',
      haloColor: 'rgba(3, 7, 18, 0.95)',
      align: 'left',
      yOffsetPx: 25,
    });

    // Line 3: "But it would all be worth it if it lands" (14.86s - 18.58s)
    LyricRig.renderLine(ctx, {
      worldPos: [0.0, -1.35, 0.15],
      cam: this.camera,
      t,
      lineIdx: 3,
      fontSize: 50,
      baseColor: 'rgba(203, 213, 225, 0.55)',
      highlightColor: '#f59e0b', // AMBER_REDLINE accent
      haloColor: 'rgba(3, 7, 18, 0.95)',
      yOffsetPx: 35,
    });

    this.layer2d.upload();

    // --- 8. Render Passes & Composite ---
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    // Composite 2D kinetic typography layer over 3D CAD schematic
    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // Optical post-processing overrides for neo-noir brutalist blueprint
    return {
      exposure: 1.15,
      bloom: 0.45,
      bloomRadius: 0.42,
      bloomThreshold: 0.75,
      vignette: 0.28,
      ca: 0.5,
      grain: 0.045,
    };
  }

  // =========================================================================
  // 9. DISPOSAL & CLEANUP
  // =========================================================================
  override dispose(): void {
    this.dialTexture.dispose();

    this.threeScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      }
    });

    super.dispose();
  }
}

// ACT II: THE ENGINE DYNO REDLINE & SPEEDOMETER (18.31s - 34.05s, Nominal Cut 33.55s)
// Lines 4 - 7:
// - "I wonder if we die young, would that be alright?" (18.81s - 22.50s)
// - "Or would it feel dumb if it ends tonight?" (22.50s - 26.20s)
// - "I've never gone a hundred in my life" (26.20s - 29.90s)
// - "There's no such thing as ninety-fives this time" (29.90s - 33.55s)
//
// Entry Transition Contract T1 (18.81s):
// - Pos=[0.0, 0.0, 2.2], Target=[0.0, 0.0, 0.0], Vel=[0.0, 0.0, -14.0], FOV=45.0
// - Aligned squarely with the outer circular brass bezel of the speedometer gauge at [0, 0, 0].
//
// Exit Transition Contract T2 (Nominal Seam: 33.55s):
// - Pos=[0.0, 0.8, 2.4], Target=[0.0, 0.5, 0.0], Vel=[0.0, -0.4, -22.0], FOV=50.0
// - At t = 33.55s, the glass dial crystal shatters into flying Voronoi shards
//   as the camera breaches forward through into the Act 3 bank vault vortex!

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LyricRig } from './lyrics_rig';
import { COLOR_TOKENS, TRANSITION_CONTRACTS } from './contracts';
import { clamp, ease } from '../../engine/util';
import { createVehicleModel, type VehicleModelRig } from './shared/vehicle_model';

interface VoronoiShard {
  mesh: THREE.Mesh;
  cx: number;
  cy: number;
  dir: THREE.Vector2;
  speedR: number;
  speedZ: number;
  rotSpeed: THREE.Vector3;
}

export default class Act2Speedometer extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private layer2d: Layer2D;

  // 1930s Boattail Speedster Rig
  private vehicle: VehicleModelRig;

  // Macro Speedometer Assembly at [0, 0, 0]
  private gaugeGroup = new THREE.Group();
  private needleGroup = new THREE.Group();
  private solidGlassLens!: THREE.Mesh;
  private dialTexture: THREE.CanvasTexture | null = null;
  private faceMat!: THREE.MeshStandardMaterial;
  private tachNeedleGroup = new THREE.Group();

  // Voronoi Glass Shatter Assembly (active at t >= 33.55s)
  private voronoiShardsGroup = new THREE.Group();
  private shards: VoronoiShard[] = [];
  private shockwaveRing!: THREE.Mesh;

  // Moving Asphalt Road & Streaming Markings
  private roadGroup = new THREE.Group();
  private roadDashes: THREE.Mesh[] = [];

  // Exhaust Flames & Dynamic Lights
  private leftExhaustFlame: THREE.Mesh;
  private rightExhaustFlame: THREE.Mesh;
  private leftExhaustLight: THREE.PointLight;
  private rightExhaustLight: THREE.PointLight;
  private redlineAlarmLight: THREE.PointLight;
  private keyLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 300);
    this.layer2d = new Layer2D(W, H);

    // Deep Neo-Noir highway atmosphere
    this.threeScene.background = new THREE.Color(COLOR_TOKENS.HIGHWAY_ASPHALT);
    this.threeScene.fog = new THREE.FogExp2(0x090b0e, 0.015);

    // -------------------------------------------------------------
    // 1. Dynamic Lighting
    // -------------------------------------------------------------
    this.ambientLight = new THREE.AmbientLight(0x181c24, 0.9);
    this.threeScene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xf1f5f9, 1.4);
    this.keyLight.position.set(10, 20, 15);
    this.keyLight.castShadow = true;
    this.threeScene.add(this.keyLight);

    // Redline flashing alarm light positioned over the 100+ sector
    this.redlineAlarmLight = new THREE.PointLight(0xef4444, 0.0, 15.0);
    this.redlineAlarmLight.position.set(0.5, 0.4, 0.35);
    this.threeScene.add(this.redlineAlarmLight);

    // Instrument gauge warm fill light (offset to illuminate face evenly without glare)
    const dashBacklight = new THREE.PointLight(0xfef08a, 0.8, 10.0);
    dashBacklight.position.set(-0.5, 0.8, 1.8);
    this.threeScene.add(dashBacklight);

    // -------------------------------------------------------------
    // 2. Shared 1930s Boattail Speedster Model
    // -------------------------------------------------------------
    this.vehicle = createVehicleModel();
    // In Act 2 (Macro Speedometer & Dashboard Study), keep the vehicle exterior hidden
    // so seats and chassis do not occlude the macro gauge cluster from [0, 0, 2.2].
    this.vehicle.root.visible = false;

    // -------------------------------------------------------------
    // 3. Macro Dashboard & Speedometer Gauge at [0, 0, 0]
    // -------------------------------------------------------------
    this.buildMacroDashboard();
    this.buildMacroSpeedometer();
    this.buildVoronoiGlassShatter();

    // -------------------------------------------------------------
    // 4. Asphalt Highway Surface & Exhaust Flames
    // -------------------------------------------------------------
    this.buildStreamingHighway();
    const exhaustSetup = this.buildExhaustFlames();
    this.leftExhaustFlame = exhaustSetup.leftFlame;
    this.rightExhaustFlame = exhaustSetup.rightFlame;
    this.leftExhaustLight = exhaustSetup.leftLight;
    this.rightExhaustLight = exhaustSetup.rightLight;
  }

  /**
   * Builds the curved brushed graphite dashboard with leather roll
   * and dual auxiliary gauges (Tachometer and Oil/Temp).
   */
  private buildMacroDashboard(): void {
    const dashPanelGroup = new THREE.Group();
    dashPanelGroup.name = 'macro_dashboard_panel';

    // Machine-turned brushed graphite cowl plate behind dials
    const cowlGeo = new THREE.BoxGeometry(4.4, 1.6, 0.14);
    const cowlMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.38,
      metalness: 0.82,
    });
    const cowlMesh = new THREE.Mesh(cowlGeo, cowlMat);
    cowlMesh.position.set(0.0, 0.0, -0.16);
    cowlMesh.visible = false;
    dashPanelGroup.add(cowlMesh);

    // Stitched black leather top brow
    const leatherBrowGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.22, 48, 1, true, 0, Math.PI);
    leatherBrowGeo.rotateZ(Math.PI / 2);
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.8,
      metalness: 0.15,
    });
    const leatherBrow = new THREE.Mesh(leatherBrowGeo, leatherMat);
    leatherBrow.position.set(0.0, 0.72, -0.18);
    leatherBrow.visible = false;
    dashPanelGroup.add(leatherBrow);

    // Vintage brass toggle switches
    for (const sx of [-0.35, 0.0, 0.35]) {
      const stemGeo = new THREE.CylinderGeometry(0.014, 0.016, 0.08, 12);
      stemGeo.rotateX(0.4);
      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xd4a359,
        roughness: 0.2,
        metalness: 0.95,
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(sx, -0.62, -0.09);
      dashPanelGroup.add(stem);

      const collarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 16);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, stemMat);
      collar.position.set(sx, -0.62, -0.1);
      dashPanelGroup.add(collar);
    }

    // Left Auxiliary Gauge: Vintage 0-6000 RPM Tachometer
    const auxTachGroup = this.buildAuxGauge('TACHOMETER', [-1.42, 0.04, -0.12], 0.42);
    this.tachNeedleGroup = auxTachGroup.needleGroup;
    dashPanelGroup.add(auxTachGroup.root);

    // Right Auxiliary Gauge: Manifold Boost & Oil Pressure
    const auxOilGroup = this.buildAuxGauge('OIL / BOOST', [1.42, 0.04, -0.12], 0.42);
    dashPanelGroup.add(auxOilGroup.root);

    this.threeScene.add(dashPanelGroup);
  }

  /**
   * Helper to build a secondary instrument gauge (Tachometer / Pressure).
   */
  private buildAuxGauge(label: string, pos: [number, number, number], radius: number): {
    root: THREE.Group;
    needleGroup: THREE.Group;
  } {
    const root = new THREE.Group();
    root.position.set(pos[0], pos[1], pos[2]);

    // Polished brass bezel
    const bezelGeo = new THREE.TorusGeometry(radius, 0.032, 16, 48);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a359,
      roughness: 0.22,
      metalness: 0.94,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, brassMat);
    root.add(bezelMesh);

    // Dark dial face
    const faceGeo = new THREE.CircleGeometry(radius * 0.96, 36);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.5,
      metalness: 0.3,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = -0.005;
    root.add(faceMesh);

    // Ivory tick marks
    const ticksCount = 12;
    for (let i = 0; i <= ticksCount; i++) {
      const angle = 2.35 - (i / ticksCount) * 4.7;
      const tickGeo = new THREE.BoxGeometry(0.008, 0.035, 0.002);
      tickGeo.translate(0, radius * 0.78, 0);
      const tickMat = new THREE.MeshBasicMaterial({
        color: i >= 9 ? 0xef4444 : 0xf1f5f9,
      });
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.rotation.z = angle;
      tick.position.z = 0.002;
      root.add(tick);
    }

    // Articulated needle
    const needleGroup = new THREE.Group();
    needleGroup.position.z = 0.01;
    const needleBladeGeo = new THREE.BoxGeometry(0.008, radius * 0.72, 0.004);
    needleBladeGeo.translate(0, (radius * 0.72) / 2, 0);
    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.4,
    });
    const needleBlade = new THREE.Mesh(needleBladeGeo, needleMat);
    needleGroup.add(needleBlade);

    // Center hub cap
    const capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 20);
    capGeo.rotateX(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, brassMat);
    needleGroup.add(cap);

    needleGroup.rotation.z = 2.1;
    root.add(needleGroup);

    return { root, needleGroup };
  }

  /**
   * Generates the high-resolution 1024x1024 CanvasTexture for the dark tungsten
   * gauge face, complete with ivory numerals (0 - 140), amber 95 mark, and crimson redline.
   */
  private createSpeedometerFaceTexture(): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const cx = 512;
    const cy = 512;
    const rFace = 480;

    // 1. Deep brushed tungsten radial gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 60, cx, cy, rFace);
    bgGrad.addColorStop(0, '#1c2027');
    bgGrad.addColorStop(0.7, '#13161b');
    bgGrad.addColorStop(1, '#0b0d10');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, rFace, 0, Math.PI * 2);
    ctx.fill();

    // 2. Lathe micro-groove drafting rings (Brutalist CAD style)
    ctx.strokeStyle = 'rgba(240, 244, 248, 0.12)';
    ctx.lineWidth = 1.5;
    for (const r of [450, 420, 380, 360, 260, 240, 160]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Crimson Redline Arc Background Sector (100 - 140 MPH)
    // Angles in canvas coordinates: 0 MPH = -220°, 140 MPH = +40°
    const ang100 = ((-220 + (100 / 140) * 260) * Math.PI) / 180;
    const ang140 = ((-220 + (140 / 140) * 260) * Math.PI) / 180;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 420, ang100, ang140);
    ctx.arc(cx, cy, 375, ang140, ang100, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Diagonal hazard hatch stripes across the redline arc
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 2.5;
    for (let s = 100; s <= 140; s += 2.5) {
      const a = ((-220 + (s / 140) * 260) * Math.PI) / 180;
      const x1 = cx + Math.cos(a) * 378;
      const y1 = cy + Math.sin(a) * 378;
      const x2 = cx + Math.cos(a + 0.02) * 418;
      const y2 = cy + Math.sin(a + 0.02) * 418;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Calibrated Ticks & Etched Ivory Numerals (0 to 140 MPH)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let s = 0; s <= 140; s += 2.5) {
      const deg = -220 + (s / 140) * 260;
      const rad = (deg * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      const isMajor = s % 10 === 0;
      const isAmber95 = s === 95;
      const isRedline = s >= 100;

      let tickLen = 14;
      let tickWidth = 1.5;
      let strokeColor = isRedline ? 'rgba(239, 68, 68, 0.55)' : 'rgba(240, 244, 248, 0.35)';

      if (isMajor) {
        tickLen = 30;
        tickWidth = 4.0;
        strokeColor = isRedline ? '#ef4444' : '#f8fafc';
      } else if (isAmber95) {
        tickLen = 38;
        tickWidth = 5.5;
        strokeColor = '#f59e0b'; // COLOR_TOKENS.AMBER_REDLINE
      } else if (s % 5 === 0) {
        tickLen = 20;
        tickWidth = 2.2;
        strokeColor = isRedline ? '#ef4444' : 'rgba(240, 244, 248, 0.7)';
      }

      const rOuter = 420;
      const rInner = rOuter - tickLen;

      ctx.beginPath();
      ctx.moveTo(cx + cosA * rInner, cy + sinA * rInner);
      ctx.lineTo(cx + cosA * rOuter, cy + sinA * rOuter);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = tickWidth;
      ctx.stroke();

      // Major Numerals: 0, 10, 20 ... 140
      if (isMajor) {
        const rNum = 335;
        const nx = cx + cosA * rNum;
        const ny = cy + sinA * rNum;
        ctx.font = 'bold 30px Geist, Archivo, sans-serif';
        ctx.fillStyle = isRedline ? '#ef4444' : '#f1f5f9';
        ctx.fillText(`${s}`, nx, ny);
      } else if (isAmber95) {
        const rNum = 332;
        const nx = cx + cosA * rNum;
        const ny = cy + sinA * rNum;
        ctx.font = 'bold 28px Geist, Archivo, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('95', nx, ny);
      }
    }

    // 5. Typography & Horological Badging
    ctx.font = 'bold 24px Geist, Archivo, sans-serif';
    ctx.fillStyle = '#d4a359'; // Brass gold
    ctx.fillText('NO TAKEBACKS', cx, 320);

    ctx.font = '600 13px monospace';
    ctx.fillStyle = 'rgba(240, 244, 248, 0.65)';
    ctx.fillText('CHRONOMETRIC SPEEDOMETER', cx, 348);

    ctx.font = 'bold 38px Geist, Archivo, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MPH', cx, 400);

    ctx.font = '700 12px Geist, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('MAX SAFE 95 MPH', cx, 428);

    // 6. Recessed Mechanical Odometer Window ("0 0 1 9 3 2")
    const odoX = cx - 96;
    const odoY = 605;
    const odoW = 192;
    const odoH = 46;

    ctx.fillStyle = '#0a0c0e';
    ctx.fillRect(odoX, odoY, odoW, odoH);
    ctx.strokeStyle = '#d4a359';
    ctx.lineWidth = 3;
    ctx.strokeRect(odoX, odoY, odoW, odoH);

    const digits = ['0', '0', '1', '9', '3', '2'];
    const drumW = odoW / digits.length;
    ctx.font = 'bold 24px monospace';
    for (let i = 0; i < digits.length; i++) {
      const dx = odoX + i * drumW;
      ctx.fillStyle = i === 5 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(dx + 2, odoY + 2, drumW - 4, odoH - 4);
      ctx.fillStyle = '#0a0c0e';
      ctx.fillText(digits[i]!, dx + drumW / 2, odoY + odoH / 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Builds the Macro Speedometer Assembly centered directly at [0, 0, 0].
   */
  private buildMacroSpeedometer(): void {
    this.gaugeGroup = new THREE.Group();
    this.gaugeGroup.name = 'macro_speedometer_gauge';

    // 1. Polished Stepped Circular Brass Bezel
    // Outer knurled fluted rim (radius 0.98)
    const knurlBezelGeo = new THREE.TorusGeometry(0.97, 0.048, 20, 64);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a359,
      roughness: 0.22,
      metalness: 0.94,
    });
    const knurlMesh = new THREE.Mesh(knurlBezelGeo, brassMat);
    this.gaugeGroup.add(knurlMesh);

    // Inner stepped collar (openEnded = true so no solid end caps occlude dial face)
    const collarGeo = new THREE.CylinderGeometry(0.91, 0.96, 0.065, 64, 1, true);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, brassMat);
    this.gaugeGroup.add(collarMesh);

    // Chrome retaining ring (radius 0.88)
    const chromeRingGeo = new THREE.TorusGeometry(0.88, 0.022, 16, 64);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.08,
      metalness: 0.98,
    });
    const chromeMesh = new THREE.Mesh(chromeRingGeo, chromeMat);
    this.gaugeGroup.add(chromeMesh);

    // 2. Dark Tungsten Gauge Face with Canvas Texture
    this.dialTexture = this.createSpeedometerFaceTexture();
    const faceGeo = new THREE.CircleGeometry(0.875, 64);
    const faceMat = new THREE.MeshStandardMaterial({
      map: this.dialTexture ?? undefined,
      emissive: 0xffffff,
      emissiveMap: this.dialTexture ?? undefined,
      emissiveIntensity: 0.92,
      roughness: 0.35,
      metalness: 0.25,
    });
    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.position.z = -0.005;
    this.gaugeGroup.add(faceMesh);

    // 3. Speedometer Face & Dial Lighting
    // Canvas texture already renders the precision redline sector (100 - 140 MPH) and amber 95 mark
    this.faceMat = faceMat;

    // 5. Tapered Crimson Speedometer Needle with Pivot & Hub
    this.needleGroup = new THREE.Group();
    this.needleGroup.name = 'macro_speedometer_needle';
    this.needleGroup.position.set(0.0, 0.0, 0.02);

    // Tapered needle blade (bold, prominent, Art Deco profile)
    const bladeGeo = new THREE.BufferGeometry();
    const bladeVerts = new Float32Array([
      // Front tapered ridge (two triangles)
      -0.026, 0.0, 0.0,
      0.026, 0.0, 0.0,
      0.0, 0.75, 0.008,

      // Counterweight teardrop tail
      -0.028, 0.0, 0.0,
      0.028, 0.0, 0.0,
      0.0, -0.22, 0.004,
    ]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(bladeVerts, 3));
    bladeGeo.computeVertexNormals();

    const needleMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.95,
      roughness: 0.22,
      metalness: 0.65,
      side: THREE.DoubleSide,
    });
    const needleMesh = new THREE.Mesh(bladeGeo, needleMat);
    this.needleGroup.add(needleMesh);

    // Center brass collar hub
    const hubCollarGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.024, 32);
    hubCollarGeo.rotateX(Math.PI / 2);
    const hubCollar = new THREE.Mesh(hubCollarGeo, brassMat);
    this.needleGroup.add(hubCollar);

    // Center polished chrome domed cap
    const hubCapGeo = new THREE.SphereGeometry(0.055, 24, 16);
    const hubCap = new THREE.Mesh(hubCapGeo, chromeMat);
    hubCap.position.z = 0.014;
    this.needleGroup.add(hubCap);

    this.gaugeGroup.add(this.needleGroup);

    // 6. Solid Glass Crystal Lens (clear transparent glass)
    const lensGeo = new THREE.CircleGeometry(0.88, 48);
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    this.solidGlassLens = new THREE.Mesh(lensGeo, lensMat);
    this.solidGlassLens.position.z = 0.045;
    this.gaugeGroup.add(this.solidGlassLens);

    this.threeScene.add(this.gaugeGroup);
  }

  /**
   * Builds the 32-piece Voronoi Shatter Glass Rig.
   * Completely hidden before 33.55s; violently bursts outwards at t >= 33.55s.
   */
  private buildVoronoiGlassShatter(): void {
    this.voronoiShardsGroup = new THREE.Group();
    this.voronoiShardsGroup.name = 'voronoi_glass_shards';
    this.voronoiShardsGroup.visible = false;

    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xf0fdf4,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Subdivide the dial lens disc (radius 0.88) into 32 deterministic shards:
    // - Core: 6 wedges (r: 0 to 0.28)
    // - Mid: 10 sectors (r: 0.28 to 0.58)
    // - Outer: 16 sectors (r: 0.58 to 0.88)
    const rings = [
      { r0: 0.0, r1: 0.28, count: 6 },
      { r0: 0.28, r1: 0.58, count: 10 },
      { r0: 0.58, r1: 0.88, count: 16 },
    ];

    let shardIdx = 0;
    for (const ring of rings) {
      const step = (Math.PI * 2) / ring.count;
      for (let i = 0; i < ring.count; i++) {
        const a0 = i * step;
        const a1 = (i + 1) * step;

        // Slight deterministic vertex jitter for natural fracture lines
        const j0 = Math.sin(shardIdx * 13.7) * 0.012;
        const j1 = Math.cos(shardIdx * 19.3) * 0.012;

        const p0 = new THREE.Vector2(ring.r0 * Math.cos(a0), ring.r0 * Math.sin(a0));
        const p1 = new THREE.Vector2((ring.r1 + j0) * Math.cos(a0), (ring.r1 + j0) * Math.sin(a0));
        const p2 = new THREE.Vector2((ring.r1 + j1) * Math.cos(a1), (ring.r1 + j1) * Math.sin(a1));
        const p3 = new THREE.Vector2(ring.r0 * Math.cos(a1), ring.r0 * Math.sin(a1));

        const shape = new THREE.Shape();
        shape.moveTo(p0.x, p0.y);
        shape.lineTo(p1.x, p1.y);
        shape.lineTo(p2.x, p2.y);
        if (ring.r0 > 0.01) {
          shape.lineTo(p3.x, p3.y);
        }
        shape.closePath();

        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.008,
          bevelEnabled: true,
          bevelSegments: 1,
          steps: 1,
          bevelSize: 0.002,
          bevelThickness: 0.002,
        });

        // Compute local centroid
        const cx = (p0.x + p1.x + p2.x + (ring.r0 > 0.01 ? p3.x : 0)) / (ring.r0 > 0.01 ? 4 : 3);
        const cy = (p0.y + p1.y + p2.y + (ring.r0 > 0.01 ? p3.y : 0)) / (ring.r0 > 0.01 ? 4 : 3);

        // Center geometry around its centroid so it tumbles realistically
        extrudeGeo.translate(-cx, -cy, -0.004);

        const mesh = new THREE.Mesh(extrudeGeo, shardMat);
        mesh.position.set(cx, cy, 0.045);
        this.voronoiShardsGroup.add(mesh);

        const dir = new THREE.Vector2(cx, cy).normalize();
        if (dir.lengthSq() < 0.0001) dir.set(0, 1);

        const hash = Math.sin(shardIdx * 37.11);
        const speedR = 4.5 + Math.abs(hash) * 7.0;
        const speedZ = 6.0 + Math.abs(Math.cos(shardIdx * 29.5)) * 9.0;
        const rotSpeed = new THREE.Vector3(
          Math.sin(shardIdx * 17.3) * 22.0,
          Math.cos(shardIdx * 23.1) * 22.0,
          Math.sin(shardIdx * 31.7) * 16.0,
        );

        this.shards.push({
          mesh,
          cx,
          cy,
          dir,
          speedR,
          speedZ,
          rotSpeed,
        });

        shardIdx++;
      }
    }

    // Additive Expanding Shatter Shockwave Ring
    const ringGeo = new THREE.RingGeometry(0.04, 0.12, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, ringMat);
    this.shockwaveRing.position.set(0, 0, 0.05);
    this.voronoiShardsGroup.add(this.shockwaveRing);

    this.threeScene.add(this.voronoiShardsGroup);
  }

  /**
   * Builds the streaming asphalt highway underneath with glowing lane dashes.
   */
  private buildStreamingHighway(): void {
    this.roadGroup = new THREE.Group();
    this.roadGroup.position.set(0, -1.65, 0);

    // Main asphalt ground plane
    const roadGeo = new THREE.PlaneGeometry(50, 180, 16, 32);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x090b0e,
      roughness: 0.88,
      metalness: 0.08,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0, -40);
    this.roadGroup.add(roadMesh);

    // Center halogen yellow dashed markers
    const dashCount = 24;
    const dashGeo = new THREE.BoxGeometry(0.18, 0.02, 3.2);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a, // Halogen road yellow
    });

    for (let i = 0; i < dashCount; i++) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(0, 0.015, 20.0 - i * 6.5);
      this.roadDashes.push(dash);
      this.roadGroup.add(dash);
    }

    this.threeScene.add(this.roadGroup);
  }

  /**
   * Builds twin pulsating engine exhaust flame reflections on the car flanks.
   */
  private buildExhaustFlames(): {
    leftFlame: THREE.Mesh;
    rightFlame: THREE.Mesh;
    leftLight: THREE.PointLight;
    rightLight: THREE.PointLight;
  } {
    const flameGeo = new THREE.ConeGeometry(0.07, 0.45, 8);
    flameGeo.rotateX(Math.PI / 2); // Point backward (+Z)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
    });

    const leftFlame = new THREE.Mesh(flameGeo, flameMat);
    leftFlame.position.set(-0.72, -0.22, -1.1);
    this.threeScene.add(leftFlame);

    const rightFlame = new THREE.Mesh(flameGeo, flameMat);
    rightFlame.position.set(0.72, -0.22, -1.1);
    this.threeScene.add(rightFlame);

    const leftLight = new THREE.PointLight(0xf97316, 1.5, 6.0);
    leftLight.position.set(-0.72, -0.22, -1.0);
    this.threeScene.add(leftLight);

    const rightLight = new THREE.PointLight(0xf97316, 1.5, 6.0);
    rightLight.position.set(0.72, -0.22, -1.0);
    this.threeScene.add(rightLight);

    return { leftFlame, rightFlame, leftLight, rightLight };
  }

  // -------------------------------------------------------------
  // Deterministic Closed-Form Functions f(t)
  // -------------------------------------------------------------

  /**
   * Closed-form deterministic vehicle speed in MPH as a function of song time.
   */
  private getSpeedMPH(t: number): number {
    if (t < 18.81) {
      // 18.31s - 18.81s: Lead-in settling into initial rev
      const u = clamp((t - 18.31) / 0.5, 0, 1);
      return 38.0 + 4.0 * Math.sin(t * 12.0) + u * 4.0;
    }
    if (t < 22.5) {
      // 18.81s - 22.50s (Line 4): Cruises & revs between 42 and 58 MPH
      const beatOmega = (129.2 / 60.0) * Math.PI * 2.0;
      const revPulse = Math.pow(Math.sin((t - 18.81) * beatOmega * 0.5), 2.0);
      return 44.0 + revPulse * 12.0 + Math.sin(t * 2.5) * 2.5;
    }
    if (t < 26.2) {
      // 22.50s - 26.20s (Line 5): Throttle builds, revving 52 to 65 MPH
      const u = (t - 22.5) / (26.2 - 22.5);
      const beatOmega = (129.2 / 60.0) * Math.PI * 2.0;
      const revPulse = Math.pow(Math.sin((t - 22.5) * beatOmega * 0.5), 2.0);
      const base = THREE.MathUtils.lerp(50.0, 64.0, ease.inOutQuad(u));
      return base + revPulse * 4.5;
    }
    if (t < 29.9) {
      // 26.20s - 29.90s (Line 6: "never gone a hundred"): Sweeps aggressively 65 -> 80 -> 95 MPH
      const u = (t - 26.2) / (29.9 - 26.2);
      const base = 65.0 + 30.0 * (0.75 * u + 0.25 * (u * u));
      const engineSurge = Math.sin((t - 26.2) * 28.0) * (0.8 + u * 1.2);
      return Math.min(95.0, base + engineSurge * (1.0 - u * 0.5));
    }
    if (t < 33.55) {
      // 29.90s - 33.55s (Line 7: "no such thing as ninety-fives this time"):
      // Surges past 95, slamming deep into 100+ crimson redline zone with intense dyno tremor!
      const u = (t - 29.9) / (33.55 - 29.9);
      // Climbs rapidly past 95 to 100+ by ~30.7s, slamming to 130 MPH at chorus drop
      const surgeCurve = 0.38 * u + 0.62 * Math.pow(u, 1.8);
      return 95.0 + 35.0 * surgeCurve;
    }
    // t >= 33.55s: Burst into breach vortex
    const dt = t - 33.55;
    return 130.0 + dt * 20.0;
  }

  /**
   * Deterministic needle micro-jitter and high-RPM redline tremor.
   */
  private getNeedleTremor(t: number, mph: number): number {
    if (mph < 65) {
      return Math.sin(t * 70.0) * 0.015 + Math.cos(t * 95.0) * 0.008;
    }
    if (mph < 95) {
      const u = (mph - 65.0) / 30.0;
      return (Math.sin(t * 85.0) * 0.022 + Math.cos(t * 115.0) * 0.014) * (1.0 + u * 0.8);
    }
    // mph >= 95: Violent engine dyno tremor!
    const redlineFactor = clamp((mph - 95.0) / 30.0, 0, 1.5);
    const fastShake = Math.sin(t * 135.0) * 0.048 + Math.cos(t * 190.0) * 0.038;
    const kickTremor = Math.sin(t * 260.0) * 0.022;
    return (fastShake + kickTremor) * (1.2 + redlineFactor * 1.9);
  }

  /**
   * Continuous camera trajectory matching Contract T1 at 18.81s and Contract T2 at 33.55s.
   */
  private getCameraState(t: number, speedMPH: number): {
    pos: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  } {
    const { T1, T2 } = TRANSITION_CONTRACTS;

    // Case 1: Entry Deceleration (18.31s - 18.81s)
    if (t < 18.81) {
      const dtT1 = 18.81 - t; // 0.5 down to 0
      const uIn = clamp((t - 18.31) / 0.5, 0, 1);
      // Continuous smooth landing into T1 [0, 0, 2.2]
      const zPos = T1.pos[2] + dtT1 * 14.0 * (1.0 - 0.5 * uIn);
      return {
        pos: new THREE.Vector3(0.0, 0.0, zPos),
        target: new THREE.Vector3(0.0, 0.0, 0.0),
        fov: T1.fov,
      };
    }

    // Case 2: Main Act 2 Macro Dashboard Framing (18.81s - 31.5s)
    if (t <= 31.5) {
      // Subtle organic breathing and engine rumble drift
      const driftX = Math.sin((t - 18.81) * 1.6) * 0.032;
      const driftY = Math.sin((t - 18.81) * 2.1) * 0.022;
      const driftZ = Math.sin((t - 18.81) * 0.9) * 0.028;

      // Line 6 throttle pullback (26.20s - 29.90s)
      const uLine6 = clamp((t - 26.2) / (29.9 - 26.2), 0, 1);
      const pullZ = 0.12 * ease.inOutCubic(uLine6);
      const pullY = 0.08 * ease.inOutCubic(uLine6);

      // Line 7 redline tremor shake
      let shakeX = 0;
      let shakeY = 0;
      if (speedMPH > 95.0) {
        const redlineFactor = clamp((speedMPH - 95.0) / 30.0, 0, 1.2);
        shakeX = Math.sin(t * 115.0) * 0.012 * redlineFactor;
        shakeY = Math.cos(t * 135.0) * 0.014 * redlineFactor;
      }

      return {
        pos: new THREE.Vector3(driftX + shakeX, driftY + pullY + shakeY, T1.pos[2] + driftZ + pullZ),
        target: new THREE.Vector3(0.0, pullY * 0.5, 0.0),
        fov: T1.fov + 1.5 * uLine6,
      };
    }

    // Case 3: Approach to Seam T2 (31.5s - 33.55s)
    if (t <= 33.55) {
      const uT2 = clamp((t - 31.5) / (33.55 - 31.5), 0, 1);
      const easeU = ease.inOutCubic(uT2);

      // Tremor escalates as needle slams into glowing redline
      const redlineFactor = clamp((speedMPH - 95.0) / 30.0, 0, 1.2);
      const tremorX = Math.sin(t * 125.0) * 0.015 * redlineFactor;
      const tremorY = Math.cos(t * 145.0) * 0.018 * redlineFactor;

      const startPos = new THREE.Vector3(0.0, 0.08, 2.32);
      const endPos = new THREE.Vector3(T2.pos[0], T2.pos[1], T2.pos[2]);

      const startTarget = new THREE.Vector3(0.0, 0.04, 0.0);
      const endTarget = new THREE.Vector3(T2.target[0], T2.target[1], T2.target[2]);

      const pos = new THREE.Vector3().lerpVectors(startPos, endPos, easeU);
      pos.x += tremorX;
      pos.y += tremorY;

      const target = new THREE.Vector3().lerpVectors(startTarget, endTarget, easeU);
      const fov = THREE.MathUtils.lerp(46.5, T2.fov, easeU);

      return { pos, target, fov };
    }

    // Case 4: Exit Breach Vortex into Act 3 (33.55s - 34.05s)
    // Forward velocity along T2.velocity = [0.0, -0.4, -22.0]
    const dtExit = t - 33.55; // 0 to 0.5s
    const zPos = T2.pos[2] + T2.velocity[2] * dtExit - 12.0 * dtExit * dtExit;
    const yPos = T2.pos[1] + T2.velocity[1] * dtExit;
    const targetY = T2.target[1] + T2.velocity[1] * dtExit;
    const targetZ = T2.target[2] + T2.velocity[2] * dtExit;
    const fov = T2.fov + 8.0 * (dtExit / 0.5);

    return {
      pos: new THREE.Vector3(0.0, yPos, zPos),
      target: new THREE.Vector3(0.0, targetY, targetZ),
      fov,
    };
  }

  // -------------------------------------------------------------
  // Render Cycle
  // -------------------------------------------------------------

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;

    // 1. Vehicle Speed & Dyno Mechanics
    const speedMPH = this.getSpeedMPH(t);
    const speedMPS = speedMPH / 2.23694;
    const redlineFactor = clamp((speedMPH - 95.0) / 30.0, 0, 1.2);

    // 2. Camera Positioning & Continuous Transitions
    const camState = this.getCameraState(t, speedMPH);
    this.camera.position.copy(camState.pos);
    this.camera.lookAt(camState.target);
    this.camera.fov = camState.fov;
    this.camera.updateProjectionMatrix();

    // 3. Update Shared Boattail Speedster Rig
    this.vehicle.update({
      t,
      speed: speedMPS,
      engineVibe: 0.003 + 0.009 * redlineFactor,
      diceSwingStrength: 1.25,
      headlightsOn: true,
    });

    // 4. Macro Speedometer Needle Articulation
    // 0 to 140 MPH maps from +2.2689 rad down to -2.2689 rad
    const targetAngle = 2.2689 - (speedMPH / 140.0) * 4.5378;
    const jitter = this.getNeedleTremor(t, speedMPH);
    this.needleGroup.rotation.z = targetAngle + jitter;

    // Shudder center position during redline
    if (speedMPH > 95.0) {
      const shakeX = Math.sin(t * 140.0) * 0.004 * redlineFactor;
      const shakeY = Math.cos(t * 165.0) * 0.004 * redlineFactor;
      this.needleGroup.position.set(shakeX, shakeY, 0.02);
    } else {
      this.needleGroup.position.set(0.0, 0.0, 0.02);
    }

    // Tachometer auxiliary needle tracking engine RPM
    const rpm = 1200 + (speedMPH / 140.0) * 4600 + Math.sin(t * 70.0) * 60;
    const tachAngle = 2.1 - (rpm / 6000.0) * 4.2;
    this.tachNeedleGroup.rotation.z = tachAngle;

    // 5. Flashing Crimson Redline Arc & Alarm Illumination
    if (speedMPH >= 98.0) {
      const flashStrobe = Math.sin(t * 22.0) * 0.5 + 0.5;
      const redlineGlow = (0.6 + 1.8 * flashStrobe) * redlineFactor;
      if (this.faceMat) this.faceMat.emissiveIntensity = 0.92 + redlineGlow * 0.35;
      this.redlineAlarmLight.intensity = redlineGlow * 3.5;
    } else {
      if (this.faceMat) this.faceMat.emissiveIntensity = 0.92;
      this.redlineAlarmLight.intensity = 0.0;
    }

    // 6. Voronoi Glass Shatter Mechanics (t >= 33.55s)
    if (t < 33.55) {
      this.solidGlassLens.visible = true;
      this.voronoiShardsGroup.visible = false;
    } else {
      this.solidGlassLens.visible = false;
      this.voronoiShardsGroup.visible = true;

      const tau = t - 33.55; // 0.0 to 0.5s

      // Explode each Voronoi shard outward along its velocity vector
      for (const shard of this.shards) {
        const rDisp = shard.speedR * tau + 12.0 * tau * tau;
        const zDisp = shard.speedZ * tau + 18.0 * tau * tau;
        const yGravity = -3.5 * tau * tau;

        shard.mesh.position.set(
          shard.cx + shard.dir.x * rDisp,
          shard.cy + shard.dir.y * rDisp + yGravity,
          0.045 + zDisp,
        );

        shard.mesh.rotation.set(
          shard.rotSpeed.x * tau,
          shard.rotSpeed.y * tau,
          shard.rotSpeed.z * tau,
        );
      }

      // Additive expanding impact shockwave ring
      const shockScale = 1.0 + tau * 24.0;
      this.shockwaveRing.scale.set(shockScale, shockScale, 1.0);
      (this.shockwaveRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1.0 - tau * 2.8);
    }

    // 7. Streaming Asphalt Highway Markings
    const roadSpeed = speedMPS;
    const scrollZ = (t * roadSpeed * 2.2) % 6.5;
    for (let i = 0; i < this.roadDashes.length; i++) {
      const baseZ = 20.0 - i * 6.5;
      let curZ = baseZ + scrollZ;
      if (curZ > 24.0) curZ -= this.roadDashes.length * 6.5;
      this.roadDashes[i]!.position.z = curZ;
    }

    // 8. Pulsating Exhaust Flame Reflections
    const flameLength = 0.15 + (speedMPH / 140.0) * 0.5 + Math.sin(t * 40.0) * 0.08;
    this.leftExhaustFlame.scale.set(1.0, flameLength, 1.0);
    this.rightExhaustFlame.scale.set(1.0, flameLength, 1.0);

    const exhaustIntensity = 1.2 + (speedMPH / 100.0) * 2.5 + Math.sin(t * 35.0) * 1.2;
    this.leftExhaustLight.intensity = exhaustIntensity;
    this.rightExhaustLight.intensity = exhaustIntensity;

    // -------------------------------------------------------------
    // 9. Kinetic 3D Typography Overlay (Lines 4 - 7) via LyricRig
    // -------------------------------------------------------------
    this.layer2d.clear();
    const ctx2d = this.layer2d.ctx;

    // Line 4: "I wonder if we die young, would that be alright?" (18.81s - 22.50s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.74, 0.05],
      cam: this.camera,
      t,
      lineIdx: 4,
      fontSize: 44,
      baseColor: 'rgba(240, 244, 248, 0.45)',
      highlightColor: COLOR_TOKENS.BRASS_BEZEL, // #d4a359
      haloColor: 'rgba(5, 7, 10, 0.94)',
      yOffsetPx: -32,
    });

    // Line 5: "Or would it feel dumb if it ends tonight?" (22.50s - 26.20s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, -0.72, 0.05],
      cam: this.camera,
      t,
      lineIdx: 5,
      fontSize: 44,
      baseColor: 'rgba(240, 244, 248, 0.45)',
      highlightColor: COLOR_TOKENS.AMBER_REDLINE, // #f59e0b
      haloColor: 'rgba(5, 7, 10, 0.94)',
      yOffsetPx: 32,
    });

    // Line 6: "I've never gone a hundred in my life" (26.20s - 29.90s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, 0.76, 0.05],
      cam: this.camera,
      t,
      lineIdx: 6,
      fontSize: 48,
      baseColor: 'rgba(240, 244, 248, 0.45)',
      highlightColor: '#fbbf24', // Surge amber gold
      haloColor: 'rgba(5, 7, 10, 0.95)',
      yOffsetPx: -32,
    });

    // Line 7: "There's no such thing as ninety-fives this time" (29.90s - 33.55s)
    LyricRig.renderLine(ctx2d, {
      worldPos: [0.0, -0.72, 0.05],
      cam: this.camera,
      t,
      lineIdx: 7,
      fontSize: 50,
      baseColor: 'rgba(240, 244, 248, 0.45)',
      highlightColor: COLOR_TOKENS.GAUGE_NEEDLE_RED, // #ef4444
      haloColor: 'rgba(5, 7, 10, 0.96)',
      yOffsetPx: 32,
    });

    this.layer2d.upload();

    // -------------------------------------------------------------
    // 10. Composite & Post-Processing Overrides
    // -------------------------------------------------------------
    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.threeScene, this.camera);

    this.ctx.comp.draw(this.ctx.renderer, this.layer2d.texture, out, {
      mode: 'normal',
      opacity: 1.0,
    });

    // Post-processing spike calculation
    const redlineFlash = speedMPH >= 98.0 ? Math.pow(Math.sin(t * 22.0), 2.0) * redlineFactor : 0.0;
    const isShatter = t >= 33.55;
    const shatterDt = isShatter ? t - 33.55 : 0;
    const shatterSpike = isShatter ? Math.max(0, 1.0 - shatterDt / 0.22) : 0;

    return {
      exposure: 1.05 + redlineFactor * 0.14 + shatterSpike * 0.22,
      bloom: 0.36 + redlineFlash * 0.25 + shatterSpike * 0.40,
      bloomThreshold: 0.82,
      ca: 0.7 + redlineFactor * 1.5 + shatterSpike * 4.5,
      grain: 0.045 + redlineFactor * 0.02,
      vignette: 0.42 + redlineFactor * 0.10,
      flash: shatterSpike * 0.35,
      shake: [
        (Math.sin(t * 125.0) * 3.5 + Math.cos(t * 180.0) * 2.0) * redlineFactor,
        (Math.cos(t * 145.0) * 4.0 + Math.sin(t * 195.0) * 2.5) * redlineFactor,
      ],
    };
  }

  override dispose(): void {
    if (this.dialTexture) {
      this.dialTexture.dispose();
      this.dialTexture = null;
    }
  }
}

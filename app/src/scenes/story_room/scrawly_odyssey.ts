// SCENE 5: SCRAWLY ODYSSEY (16.0s - 77.0s)
// 60-Second Elite Physical Flipbook Stop-Motion Animation
// Synchronized to Forrest Nolan's "no_takebacks.mp3".
//
// HIGH-ART HAND-DRAWN INK & GRAPHITE ARCHITECTURE:
// 1. Procedural 2B Graphite Under-Drawings:
//    - Pre-ink loose gesture lines of action, construction spheres with 3D facial crosshairs,
//      ribcage/pelvis ovals, and animator's search marks in faint textured graphite (rgba(60, 48, 36, 0.22)).
// 2. Multi-Frequency Spline Inking (Zero Straight Vectors):
//    - Every stroke evaluates a 5-tap spline with low-frequency hand drift (3.5px) and high-frequency nib tremor (1.6px).
//    - Dynamic pressure tapering: strokes swell at the core (4.5px - 5.5px) and taper to razor flick tips.
//    - Endpoint overshoots & whisker marks where the pen flicked past vertices.
// 3. Volumetric Expressive Characters (Height ~185px):
//    - Character A (Firebrand): Volumetric torso, dynamic knee/boot anatomy, expressive face with jawline
//      and shouting mouth, wind-blown anime hair tufts (multi-stroke clumps with inner fold lines),
//      and a 3D cloth scarf with dual-tone face/underside, ink cross-hatch fold shading, and frayed tassel whiskers.
//    - Character B (Pilot): Heavy leather bomber jacket with lapels, zipper teeth, and crease cross-hatching,
//      tilted newsboy cap with shaded visor, aviator goggles with glare slashes, hands gripping the wheel.
// 4. Textured Vintage Props & Environment:
//    - 1930s Boattail Hot Rod: Sculpted fenders, hood louvers, chrome side-pipes, dual-tone body shading,
//      wire-spoke wheels with rubber tread ticks, pendulum fuzzy dice with hand-drawn pips, billowing cel-shaded smoke puffs.
//    - Lattice steel highway gantry sign with hand-drawn X-bracing & stencil asphalt skid tracks.
//    - Act III Metropolis: Hand-inked skyscrapers, illuminated window matrices, wooden water towers, and soaring leaps.
//    - Act IV: Japanese woodblock-style dynamic curling ocean waves with foam crests, radiant golden sun & wax seal FIN stamp.
// 5. Zero Tech-Demo Metadata Headers: Pure immersive storytelling without scene-tracker watermarks.
// 6. Flipbook Physicality: 24 FPS flip clock, micro-registration paper jitter, fanned strata with thumb notch, page numbers (P. 100+).
// Strictly Closed-Form Frame = f(t), Zero State Leaks.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

export default class ScrawlyOdyssey extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  // 3D Environment elements for realistic pullbacks
  private deskMesh: THREE.Mesh;
  private matMesh: THREE.Mesh;
  private lampGroup: THREE.Group;
  private toolsGroup: THREE.Group;
  private bookGroup: THREE.Group;
  private bookSpreadMesh: THREE.Mesh;
  private bookCover: THREE.Mesh;
  private turningPageGroup: THREE.Group;
  private turningPagePivot: THREE.Group;
  private turningPageMesh: THREE.Mesh;
  private turningPageShadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private origPagePositions!: Float32Array;

  // 2D Animation Canvas & Texture
  private animCanvas: HTMLCanvasElement;
  private animCtx: CanvasRenderingContext2D;
  private animTexture: THREE.CanvasTexture;

  // Cinematic Lighting
  private keyLight: THREE.DirectionalLight;
  private warmLampLight: THREE.PointLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);
    this.scene.background = new THREE.Color(0x0a0e16);

    // 1. Balanced Studio Lighting (Crisp paper without blowing out ink contrast)
    this.keyLight = new THREE.DirectionalLight(0xfff7ee, 1.0);
    this.keyLight.position.set(-1.0, 3.5, 2.0);
    this.scene.add(this.keyLight);

    // Warm Desk Lamp Light
    this.warmLampLight = new THREE.PointLight(0xffa726, 1.2, 5.0, 1.2);
    this.warmLampLight.position.set(-0.31, 1.25, 0.05);
    this.scene.add(this.warmLampLight);

    const amb = new THREE.AmbientLight(0xdde1e8, 0.65);
    this.scene.add(amb);

    // 2. 3D Polished Mahogany Desk (Visible during 3D pullbacks)
    const deskGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x361c12,
      roughness: 0.28,
      metalness: 0.08,
    });
    this.deskMesh = new THREE.Mesh(deskGeo, deskMat);
    this.deskMesh.rotation.x = -Math.PI / 2;
    this.deskMesh.position.y = 0.76;
    this.scene.add(this.deskMesh);

    // 2. Green Self-Healing Drafting Cutting Mat (underneath book on desk)
    const matTexture = this.createCuttingMatTexture();
    const matGeo = new THREE.PlaneGeometry(2.5, 1.6);
    const matMaterial = new THREE.MeshStandardMaterial({
      map: matTexture,
      roughness: 0.55,
      metalness: 0.05,
    });
    this.matMesh = new THREE.Mesh(matGeo, matMaterial);
    this.matMesh.rotation.x = -Math.PI / 2;
    this.matMesh.position.set(0, 0.761, 0);
    this.scene.add(this.matMesh);

    // Desk Props for Pullbacks: Anglepoise Lamp & Drafting Instruments
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 });
    const darkBrassMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.35, metalness: 0.8 });

    this.lampGroup = new THREE.Group();
    this.lampGroup.position.set(-1.05, 0.762, -0.42);

    const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.035, 24), brassMat);
    lBase.position.y = 0.018;
    this.lampGroup.add(lBase);

    const lArm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 12), brassMat);
    lArm1.position.set(0.12, 0.28, 0.05);
    lArm1.rotation.z = -0.42;
    this.lampGroup.add(lArm1);

    const lJoint = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 16), darkBrassMat);
    lJoint.position.set(0.24, 0.52, 0.1);
    this.lampGroup.add(lJoint);

    const lArm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.52, 12), brassMat);
    lArm2.position.set(0.44, 0.62, 0.18);
    lArm2.rotation.z = 0.65;
    this.lampGroup.add(lArm2);

    const lShade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.18, 20, 1, true), darkBrassMat);
    lShade.position.set(0.65, 0.68, 0.25);
    lShade.rotation.set(0.2, 0, -1.2);
    this.lampGroup.add(lShade);

    const lBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffedd5 })
    );
    lBulb.position.set(0.65, 0.66, 0.25);
    this.lampGroup.add(lBulb);
    this.scene.add(this.lampGroup);

    // Drafting Tools Group
    this.toolsGroup = new THREE.Group();
    const tBlade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 0.06), brassMat);
    tBlade.position.set(-0.2, 0.768, -0.65);
    this.toolsGroup.add(tBlade);

    const tHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.022, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x3e2014, roughness: 0.35, metalness: 0.2 })
    );
    tHead.position.set(-1.0, 0.768, -0.65);
    this.toolsGroup.add(tHead);

    const tri = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.01, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.85 })
    );
    tri.position.set(0.85, 0.768, 0.42);
    tri.rotation.y = -0.35;
    this.toolsGroup.add(tri);

    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.05, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2, metalness: 0.1 })
    );
    cup.position.set(1.05, 0.835, -0.45);
    this.toolsGroup.add(cup);
    this.scene.add(this.toolsGroup);

    // 3. 3D Open Hardcover Book (16:9)
    this.bookGroup = new THREE.Group();
    this.bookGroup.position.set(0.0, 0.765, 0.0);

    const coverOuterMat = new THREE.MeshStandardMaterial({
      map: this.createCoverTexture(),
      roughness: 0.28,
      metalness: 0.15,
    });
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x6b1122,
      roughness: 0.35,
      metalness: 0.12,
    });
    const coverGeo = new THREE.BoxGeometry(1.48, 0.016, 0.86);
    this.bookCover = new THREE.Mesh(coverGeo, [
      coverMat,
      coverMat,
      coverOuterMat, // Bottom face
      coverMat,
      coverMat,
      coverMat,
    ]);
    this.bookCover.position.set(0, -0.01, 0);
    this.bookGroup.add(this.bookCover);

    // 2D Animation Canvas (2048 x 1152)
    this.animCanvas = document.createElement('canvas');
    this.animCanvas.width = 2048;
    this.animCanvas.height = 1152;
    this.animCtx = this.animCanvas.getContext('2d')!;

    this.animTexture = new THREE.CanvasTexture(this.animCanvas);
    this.animTexture.minFilter = THREE.LinearFilter;
    this.animTexture.magFilter = THREE.LinearFilter;
    this.animTexture.colorSpace = THREE.SRGBColorSpace;

    const spreadGeo = new THREE.PlaneGeometry(1.44, 0.81);
    spreadGeo.rotateX(-Math.PI / 2);
    const spreadMat = new THREE.MeshStandardMaterial({
      map: this.animTexture,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.bookSpreadMesh = new THREE.Mesh(spreadGeo, spreadMat);
    this.bookSpreadMesh.position.set(0, 0.002, 0);
    this.bookGroup.add(this.bookSpreadMesh);

    // 4. Physical 3D Turning Page Mesh for Seam Pullbacks
    this.turningPageGroup = new THREE.Group();
    this.turningPageGroup.position.set(0.0, 0.004, 0.0);

    this.turningPagePivot = new THREE.Group();
    this.turningPageGroup.add(this.turningPagePivot);

    const pageGeo = new THREE.PlaneGeometry(0.72, 0.81, 16, 8);
    pageGeo.rotateX(-Math.PI / 2);
    pageGeo.translate(0.36, 0, 0);

    // Map UVs to the right half [0.5, 1.0] so the turning page carries the chapter artwork
    const pageUv = pageGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pageUv.count; i++) {
      pageUv.setX(i, 0.5 + pageUv.getX(i) * 0.5);
    }
    pageUv.needsUpdate = true;

    const pageMat = new THREE.MeshStandardMaterial({
      map: this.animTexture,
      roughness: 0.86,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.turningPageMesh = new THREE.Mesh(pageGeo, pageMat);
    this.origPagePositions = new Float32Array(pageGeo.attributes.position.array);
    this.turningPagePivot.add(this.turningPageMesh);

    const shadowGeo = new THREE.PlaneGeometry(0.72, 0.81);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x110e0c,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.turningPageShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.turningPageShadow.position.set(0.36, -0.001, 0.0);
    this.turningPageGroup.add(this.turningPageShadow);

    this.turningPageGroup.visible = false;
    this.bookGroup.add(this.turningPageGroup);

    this.scene.add(this.bookGroup);
  }

  // Cutting Mat 2D Texture Generator (Dark forest green vinyl with millimeter grid)
  private createCuttingMatTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;

    // Dark forest green self-healing vinyl
    g.fillStyle = '#16382a';
    g.fillRect(0, 0, 1024, 1024);

    // Fine grid lines (every 32px)
    g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    g.lineWidth = 1;
    for (let x = 32; x < 1024; x += 32) {
      g.beginPath();
      g.moveTo(x, 32); g.lineTo(x, 992);
      g.stroke();
    }
    for (let y = 32; y < 1024; y += 32) {
      g.beginPath();
      g.moveTo(32, y); g.lineTo(992, y);
      g.stroke();
    }

    // Major grid lines (every 160px)
    g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    g.lineWidth = 2;
    for (let x = 160; x < 1024; x += 160) {
      g.beginPath();
      g.moveTo(x, 32); g.lineTo(x, 992);
      g.stroke();
    }
    for (let y = 160; y < 1024; y += 160) {
      g.beginPath();
      g.moveTo(32, y); g.lineTo(992, y);
      g.stroke();
    }

    // Angle guide diagonals (30, 45, 60 deg)
    g.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(160, 832); g.lineTo(832, 160);
    g.moveTo(160, 832); g.lineTo(940, 380);
    g.moveTo(160, 832); g.lineTo(550, 160);
    g.stroke();

    // Border Frame & Metric Numbers
    g.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    g.lineWidth = 3;
    g.strokeRect(32, 32, 960, 960);

    g.fillStyle = 'rgba(255, 255, 255, 0.65)';
    g.font = 'bold 14px monospace';
    g.textAlign = 'center';
    for (let x = 160; x < 1024; x += 160) {
      g.fillText(`${(x / 16).toFixed(0)}`, x, 24);
      g.fillText(`${(x / 16).toFixed(0)}`, x, 1012);
    }
    g.textAlign = 'right';
    for (let y = 160; y < 1024; y += 160) {
      g.fillText(`${(y / 16).toFixed(0)}`, 26, y + 5);
      g.fillText(`${(y / 16).toFixed(0)}`, 1020, y + 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Book Cover 2D Texture Generator (Calfskin leather with gold foil embossing)
  private createCoverTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;

    // Rich antique crimson calfskin leather
    g.fillStyle = '#6b1122';
    g.fillRect(0, 0, 1024, 1024);

    // Leather grain texture
    for (let i = 0; i < 1800; i++) {
      const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const ry = (Math.sin(i * 78.233) * 43758.5453) % 1;
      const x = Math.abs(rx) * 1024;
      const y = Math.abs(ry) * 1024;
      const light = ((i % 2 === 0) ? 1 : -1) * (0.03 + Math.abs(rx) * 0.04);
      g.fillStyle = light > 0 ? `rgba(255, 200, 200, ${light})` : `rgba(0, 0, 0, ${-light})`;
      g.beginPath();
      g.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      g.fill();
    }

    // Outer Gilded Ornamental Border (Burnished gold foil)
    g.strokeStyle = '#d4af37';
    g.lineWidth = 6;
    g.strokeRect(50, 50, 924, 924);
    g.lineWidth = 2;
    g.strokeRect(65, 65, 894, 894);
    g.strokeRect(75, 75, 874, 874);

    // Corner Filigree Ornaments
    const corners = [[75, 75], [949, 75], [75, 949], [949, 949]];
    for (const [cx, cy] of corners) {
      g.fillStyle = '#d4af37';
      g.beginPath();
      g.arc(cx, cy, 18, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fef08a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, 28, 0, Math.PI * 2);
      g.stroke();
    }

    // Central Gold-Embossed Cartouche
    const mx = 512, my = 512;
    g.strokeStyle = '#d4af37';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(mx, my, 320, 240, 0, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(mx, my, 305, 225, 0, 0, Math.PI * 2);
    g.stroke();

    // Embossed Gold Typography
    g.fillStyle = '#fef08a';
    g.font = 'bold 24px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('HISTORIA ET CHRONICA', mx, my - 60);

    g.font = 'bold 52px Georgia, serif';
    g.fillText('NO TAKEBACKS', mx, my + 15);

    g.strokeStyle = '#d4af37';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(mx - 180, my + 45); g.lineTo(mx + 180, my + 45);
    g.stroke();

    g.fillStyle = '#d4af37';
    g.font = 'italic 26px Georgia, serif';
    g.fillText('— LIBER PRIMUS —', mx, my + 95);

    // Spine edge band tool marks
    g.strokeStyle = '#854d0e';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(50, 0); g.lineTo(50, 1024);
    g.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Pure deterministic pseudorandom hash
  private hash(n: number, seed = 0): number {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  // =========================================================================
  // HIGH-ART PROCEDURAL INK & GRAPHITE DRAWING ENGINE
  // =========================================================================

  // Evaluates an organic hand-drawn stroke with multi-frequency tremor & graphite under-sketch
  private strokeOrganicLine(
    g: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number,
    kFlip: number,
    color = '#110e0c',
    baseWidth = 3.6,
    overshoot = 8.0,
    withGraphite = true
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return;
    const nx = -dy / len;
    const ny = dx / len;
    const ux = dx / len;
    const uy = dy / len;

    g.save();

    // 1. Faint 2B Graphite Under-Sketch (Animator's rough guide)
    if (withGraphite) {
      g.strokeStyle = 'rgba(65, 50, 36, 0.22)';
      g.lineWidth = Math.max(1.2, baseWidth * 0.75);
      g.lineCap = 'round';
      g.beginPath();
      const gOver = overshoot * 1.8;
      g.moveTo(x1 - ux * gOver, y1 - uy * gOver);
      const gJitter1 = (this.hash(seed * 7, kFlip) - 0.5) * 5.0;
      const gJitter2 = (this.hash(seed * 11, kFlip) - 0.5) * 4.0;
      g.bezierCurveTo(
        x1 + dx * 0.33 + nx * gJitter1 + 1.5,
        y1 + dy * 0.33 + ny * gJitter1 + 1.0,
        x1 + dx * 0.66 + nx * gJitter2 + 1.0,
        y1 + dy * 0.66 + ny * gJitter2 + 0.8,
        x2 + ux * gOver,
        y2 + uy * gOver
      );
      g.stroke();
    }

    // 2. Primary Hand-Inked Stroke with 5-Tap Spline & Tremor
    g.strokeStyle = color;
    g.lineWidth = baseWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const taps = Math.max(4, Math.min(8, Math.floor(len / 35)));
    const pts: [number, number][] = [];
    pts.push([x1 - ux * overshoot, y1 - uy * overshoot]);

    for (let i = 1; i < taps; i++) {
      const u = i / taps;
      const px = x1 + dx * u;
      const py = y1 + dy * u;
      // Low-frequency hand drift + high-frequency nib tremor
      const drift = Math.sin(u * Math.PI) * (this.hash(seed * 13 + i * 3, kFlip) - 0.5) * 3.6;
      const tremor = (this.hash(seed * 31 + i * 17, kFlip) - 0.5) * 1.5;
      pts.push([px + nx * (drift + tremor), py + ny * (drift + tremor)]);
    }
    pts.push([x2 + ux * overshoot, y2 + uy * overshoot]);

    // Draw smooth quadratic curve through jittered taps
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i]![0] + pts[i + 1]![0]) * 0.5;
      const my = (pts[i]![1] + pts[i + 1]![1]) * 0.5;
      g.quadraticCurveTo(pts[i]![0], pts[i]![1], mx, my);
    }
    g.lineTo(pts[pts.length - 1]![0], pts[pts.length - 1]![1]);
    g.stroke();

    g.restore();
  }

  // Segmented Hand-Drawn Arc / Circle with Organic Loop Overlap & Guide Ring
  private strokeOrganicArc(
    g: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
    seed: number,
    kFlip: number,
    color = '#110e0c',
    baseWidth = 3.6,
    isClosed = false,
    withGraphite = true
  ) {
    if (r <= 0.5) return;
    g.save();

    // 1. Graphite Guide Circle with Animator's Crosshair
    if (withGraphite && isClosed) {
      g.strokeStyle = 'rgba(65, 50, 36, 0.2)';
      g.lineWidth = Math.max(1.2, baseWidth * 0.65);
      g.beginPath();
      g.arc(cx + 1.2, cy + 0.9, r + 0.8, 0, Math.PI * 2);
      g.stroke();

      // Faint construction crosshairs through the circle
      g.lineWidth = 1.0;
      g.beginPath();
      g.moveTo(cx - r * 1.2, cy); g.lineTo(cx + r * 1.2, cy);
      g.moveTo(cx, cy - r * 1.2); g.lineTo(cx, cy + r * 1.2);
      g.stroke();
    }

    // 2. Segmented Hand-Inked Arc with Radius Tremor & Loop Overlap
    g.strokeStyle = color;
    g.lineWidth = baseWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const totalAngle = isClosed ? Math.PI * 2 + 0.32 : endAngle - startAngle;
    const steps = Math.max(14, Math.floor(r * 0.45));
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (totalAngle * i) / steps;
      const rJitter = (this.hash(seed * 19 + i * 7, kFlip) - 0.5) * (baseWidth > 2.5 ? 2.6 : 1.5);
      const px = cx + Math.cos(a) * (r + rJitter);
      const py = cy + Math.sin(a) * (r + rJitter);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();

    g.restore();
  }

  // Segmented Hand-Drawn Cubic Bezier Curve with multi-frequency tremor
  private strokeOrganicBezier(
    g: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number,
    x2: number,
    y2: number,
    seed: number,
    kFlip: number,
    color = '#110e0c',
    baseWidth = 3.6,
    withGraphite = true
  ) {
    g.save();

    // Graphite Under-Sketch Guide
    if (withGraphite) {
      g.strokeStyle = 'rgba(65, 50, 36, 0.2)';
      g.lineWidth = Math.max(1.2, baseWidth * 0.7);
      g.beginPath();
      g.moveTo(x1, y1);
      g.bezierCurveTo(cx1 + 1.8, cy1 + 1.0, cx2 + 1.8, cy2 + 1.0, x2, y2);
      g.stroke();
    }

    // Primary Jittered Bezier
    g.strokeStyle = color;
    g.lineWidth = baseWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const steps = 18;
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const inv = 1 - u;
      const bx = inv * inv * inv * x1 + 3 * inv * inv * u * cx1 + 3 * inv * u * u * cx2 + u * u * u * x2;
      const by = inv * inv * inv * y1 + 3 * inv * inv * u * cy1 + 3 * inv * u * u * cy2 + u * u * u * y2;
      const jX = (this.hash(seed * 23 + i * 11, kFlip) - 0.5) * 2.8;
      const jY = (this.hash(seed * 29 + i * 17, kFlip) - 0.5) * 2.8;
      g.lineTo(bx + jX, by + jY);
    }
    g.stroke();

    g.restore();
  }

  // Hand-Drawn Rectangle with Drafting Corner Cross Overshoots
  private drawOrganicRect(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    rw: number,
    rh: number,
    seed: number,
    kFlip: number,
    strokeColor = '#110e0c',
    fillColor?: string,
    width = 3.6,
    overshoot = 8.0,
    withGraphite = true
  ) {
    if (fillColor) {
      g.fillStyle = fillColor;
      g.fillRect(x, y, rw, rh);
    }
    this.strokeOrganicLine(g, x, y, x + rw, y, seed, kFlip, strokeColor, width, overshoot, withGraphite);
    this.strokeOrganicLine(g, x + rw, y, x + rw, y + rh, seed + 1, kFlip, strokeColor, width, overshoot, withGraphite);
    this.strokeOrganicLine(g, x + rw, y + rh, x, y + rh, seed + 2, kFlip, strokeColor, width, overshoot, withGraphite);
    this.strokeOrganicLine(g, x, y + rh, x, y, seed + 3, kFlip, strokeColor, width, overshoot, withGraphite);
  }

  // Organic Watercolor Wash Polygon with 2B Graphite Guides & Optional Form Hatching
  private fillOrganicWash(
    g: CanvasRenderingContext2D,
    pts: [number, number][],
    seed: number,
    kFlip: number,
    washColor: string,
    strokeColor?: string,
    lineWidth = 3.2,
    withHatching = false
  ) {
    if (pts.length < 3) return;
    g.save();

    // 1. Faint 2B graphite / Col-Erase blue under-drawing
    g.strokeStyle = 'rgba(50, 75, 120, 0.18)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(pts[0]![0] + 1.2, pts[0]![1] + 1.0);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i]![0] + 1.2, pts[i]![1] + 1.0);
    }
    g.closePath();
    g.stroke();

    // 2. Watercolor wash fill with subtle edge tremor
    g.fillStyle = washColor;
    g.beginPath();
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) {
      const jX = (this.hash(seed * 17 + i * 7, kFlip) - 0.5) * 1.5;
      const jY = (this.hash(seed * 23 + i * 11, kFlip) - 0.5) * 1.5;
      g.lineTo(pts[i]![0] + jX, pts[i]![1] + jY);
    }
    g.closePath();
    g.fill();

    // 3. Optional form cross-hatching (///)
    if (withHatching) {
      g.strokeStyle = 'rgba(20, 15, 10, 0.45)';
      g.lineWidth = 1.6;
      let minX = pts[0]![0], maxX = pts[0]![0], minY = pts[0]![1], maxY = pts[0]![1];
      for (const p of pts) {
        if (p[0] < minX) minX = p[0];
        if (p[0] > maxX) maxX = p[0];
        if (p[1] < minY) minY = p[1];
        if (p[1] > maxY) maxY = p[1];
      }
      g.save();
      g.clip();
      const step = 8;
      for (let x = minX - (maxY - minY); x < maxX; x += step) {
        g.beginPath();
        g.moveTo(x, minY);
        g.lineTo(x + (maxY - minY) * 0.7, maxY);
        g.stroke();
      }
      g.restore();
    }

    // 4. Inked contour with hand tremor
    if (strokeColor) {
      for (let i = 0; i < pts.length; i++) {
        const next = (i + 1) % pts.length;
        this.strokeOrganicLine(
          g,
          pts[i]![0],
          pts[i]![1],
          pts[next]![0],
          pts[next]![1],
          seed + i * 5,
          kFlip,
          strokeColor,
          lineWidth,
          4.0,
          false
        );
      }
    }

    g.restore();
  }

  // Hand-Drawn Anatomical Contoured Limb (Curved muscles, 2B graphite under-lines & fold cross-hatching)
  private drawAnatomicalLimb(
    g: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    w1: number,
    w2: number,
    seed: number,
    kFlip: number,
    fillColor: string,
    strokeColor = '#110e0c',
    withHatching = true,
    curveOffset = 0
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-2) return;
    const nx = -dy / len;
    const ny = dx / len;

    // 4 Corner boundary points with width tapering
    const p1x = x1 + nx * (w1 * 0.5);
    const p1y = y1 + ny * (w1 * 0.5);
    const p2x = x2 + nx * (w2 * 0.5);
    const p2y = y2 + ny * (w2 * 0.5);
    const p3x = x2 - nx * (w2 * 0.5);
    const p3y = y2 - ny * (w2 * 0.5);
    const p4x = x1 - nx * (w1 * 0.5);
    const p4y = y1 - ny * (w1 * 0.5);

    // Midpoints with organic muscle curvature
    const mid1x = (p1x + p2x) * 0.5 + nx * curveOffset;
    const mid1y = (p1y + p2y) * 0.5 + ny * curveOffset;
    const mid2x = (p3x + p4x) * 0.5 - nx * (curveOffset * 0.35);
    const mid2y = (p3y + p4y) * 0.5 - ny * (curveOffset * 0.35);

    g.save();

    // 1. Faint 2B Graphite gesture under-sketch
    g.strokeStyle = 'rgba(65, 50, 36, 0.22)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();

    // 2. Hand-applied watercolor wash fill with edge tremor
    g.fillStyle = fillColor;
    g.beginPath();
    g.moveTo(p1x, p1y);
    g.quadraticCurveTo(mid1x, mid1y, p2x, p2y);
    g.lineTo(p3x, p3y);
    g.quadraticCurveTo(mid2x, mid2y, p4x, p4y);
    g.closePath();
    g.fill();

    // 3. Form Cross-Hatching (///) in shaded volume zone
    if (withHatching) {
      g.save();
      g.beginPath();
      g.moveTo(p1x, p1y);
      g.quadraticCurveTo(mid1x, mid1y, p2x, p2y);
      g.lineTo(p3x, p3y);
      g.quadraticCurveTo(mid2x, mid2y, p4x, p4y);
      g.closePath();
      g.clip();

      g.strokeStyle = 'rgba(17, 14, 12, 0.42)';
      g.lineWidth = 1.6;
      for (let h = 0.2; h <= 0.85; h += 0.16) {
        const hx1 = p4x + (p3x - p4x) * h;
        const hy1 = p4y + (p3y - p4y) * h;
        const hx2 = hx1 + nx * (w1 * 0.48) + (dx / len) * 7;
        const hy2 = hy1 + ny * (w1 * 0.48) + (dy / len) * 7;
        g.beginPath();
        g.moveTo(hx1, hy1);
        g.lineTo(hx2, hy2);
        g.stroke();
      }
      g.restore();
    }

    // 4. Inked contour with hand tremor
    this.strokeOrganicBezier(g, p1x, p1y, mid1x, mid1y, mid1x, mid1y, p2x, p2y, seed, kFlip, strokeColor, 3.4);
    this.strokeOrganicBezier(g, p3x, p3y, mid2x, mid2y, mid2x, mid2y, p4x, p4y, seed + 1, kFlip, strokeColor, 3.4);
    this.strokeOrganicLine(g, p2x, p2y, p3x, p3y, seed + 2, kFlip, strokeColor, 2.6, 0.0);
    this.strokeOrganicLine(g, p4x, p4y, p1x, p1y, seed + 3, kFlip, strokeColor, 2.6, 0.0);

    g.restore();
  }

  // Sculpted Hand with Opposing Thumb & Knuckle Lines
  private drawHandDrawnHand(
    g: CanvasRenderingContext2D,
    hx: number,
    hy: number,
    angle: number,
    seed: number,
    kFlip: number,
    handColor: string,
    isGlove = false
  ) {
    g.save();
    g.translate(hx, hy);
    g.rotate(angle);

    // 1. Palm Mass Oval
    g.fillStyle = handColor;
    g.beginPath();
    g.ellipse(0, 0, 7.5, 6.5, 0, 0, Math.PI * 2);
    g.fill();

    // 2. Thumb
    g.beginPath();
    g.ellipse(4.5, -5.5, 4.2, 3.2, 0.4, 0, Math.PI * 2);
    g.fill();

    // 3. Inked Palm & Fingers Contour
    this.strokeOrganicArc(g, 0, 0, 7.0, 0, Math.PI * 2, seed, kFlip, '#110e0c', 2.8, false);
    this.strokeOrganicArc(g, 4.5, -5.5, 3.8, 0, Math.PI * 2, seed + 1, kFlip, '#110e0c', 2.4, false);

    // Knuckle hatch tick marks
    this.strokeOrganicLine(g, -2, -3, -2, 3, seed + 2, kFlip, '#110e0c', 1.8, 0.0, false);
    this.strokeOrganicLine(g, 2, -3, 2, 3, seed + 3, kFlip, '#110e0c', 1.8, 0.0, false);

    // Stitched glove cuff
    if (isGlove) {
      this.strokeOrganicLine(g, -6, -5, -6, 5, seed + 4, kFlip, '#ca8a04', 2.2, 0.0, false);
    }

    g.restore();
  }

  // Sculpted Hand-Drawn Boot (Curved leather upper, lugged tread sole, laces)
  private drawHandDrawnBoot(
    g: CanvasRenderingContext2D,
    bx: number,
    by: number,
    angle: number,
    scale: number,
    seed: number,
    kFlip: number,
    bootColor: string,
    soleColor = '#110e0c',
    isCombat = true
  ) {
    g.save();
    g.translate(bx, by);
    g.rotate(angle);
    g.scale(scale, scale);

    // 1. 2B Graphite guide box
    g.strokeStyle = 'rgba(65, 50, 36, 0.22)';
    g.lineWidth = 1.2;
    g.strokeRect(-14, -18, 38, 26);

    // 2. Curved Leather Upper Body
    g.fillStyle = bootColor;
    g.beginPath();
    g.moveTo(-12, -18); // Ankle collar rear
    g.lineTo(4, -18);   // Ankle collar front
    g.quadraticCurveTo(8, -8, 16, -4); // Instep curve
    g.quadraticCurveTo(24, -3, 26, 4); // Toe cap curve
    g.lineTo(-12, 4);   // Bottom of upper
    g.closePath();
    g.fill();

    // Upper Inked Contours
    this.strokeOrganicLine(g, -12, -18, 4, -18, seed + 1, kFlip, '#110e0c', 3.2, 0.0);
    this.strokeOrganicBezier(g, 4, -18, 8, -8, 12, -6, 16, -4, seed + 2, kFlip, '#110e0c', 3.4);
    this.strokeOrganicBezier(g, 16, -4, 22, -3, 26, 0, 26, 4, seed + 3, kFlip, '#110e0c', 3.6);
    this.strokeOrganicLine(g, -12, -18, -12, 4, seed + 4, kFlip, '#110e0c', 3.4, 0.0);

    // Laces / Eyelets
    if (isCombat) {
      g.strokeStyle = '#ca8a04';
      g.lineWidth = 1.8;
      for (let l = 0; l < 3; l++) {
        const ly = -14 + l * 4;
        g.beginPath();
        g.moveTo(-1, ly);
        g.lineTo(7, ly + 2);
        g.stroke();
      }
    }

    // 3. Thick Lugged Rubber Tread Sole & Heel Block
    g.fillStyle = soleColor;
    g.beginPath();
    g.moveTo(-14, 4);
    g.lineTo(28, 4);
    g.lineTo(28, 12);
    g.lineTo(-14, 12);
    g.closePath();
    g.fill();

    this.strokeOrganicLine(g, -14, 4, 28, 4, seed + 5, kFlip, '#110e0c', 3.4, 0.0);
    this.strokeOrganicLine(g, -14, 12, 28, 12, seed + 6, kFlip, '#110e0c', 3.6, 0.0);
    this.strokeOrganicLine(g, 28, 4, 28, 12, seed + 7, kFlip, '#110e0c', 3.0, 0.0);
    this.strokeOrganicLine(g, -14, 4, -14, 12, seed + 8, kFlip, '#110e0c', 3.0, 0.0);

    // Deep Tread Ticks
    for (let tr = 0; tr < 4; tr++) {
      const trx = -6 + tr * 8;
      this.strokeOrganicLine(g, trx, 8, trx, 13, seed + 10 + tr, kFlip, '#110e0c', 2.0, 0.0, false);
    }

    g.restore();
  }

  // Hand-Drawn Word Stepping Platform (Pure typography on sketchy baseline, no rectangular box)
  private drawHandWordPlatform(
    g: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    pw: number,
    ph: number,
    seed: number,
    kFlip: number
  ) {
    // Sketchy double baseline and 2B graphite guidelines
    this.strokeOrganicLine(g, x - pw / 2 - 14, y + 6, x + pw / 2 + 14, y + 6, seed, kFlip, '#110e0c', 3.8, 12.0);
    this.strokeOrganicLine(g, x - pw / 2 - 4, y + 12, x + pw / 2 + 6, y + 12, seed + 1, kFlip, 'rgba(65, 50, 36, 0.45)', 2.0, 8.0);

    // Diagonal architectural construction tick marks at baseline ends
    this.strokeOrganicLine(g, x - pw / 2 - 10, y - 2, x - pw / 2 + 4, y + 18, seed + 2, kFlip, '#110e0c', 2.6, 0.0);
    this.strokeOrganicLine(g, x + pw / 2 - 4, y - 2, x + pw / 2 + 10, y + 18, seed + 3, kFlip, '#110e0c', 2.6, 0.0);

    // Stamped Hand-Drawn Lettering with micro-jitter
    g.save();
    const tJitterX = (this.hash(seed * 7, kFlip) - 0.5) * 2.2;
    const tJitterY = (this.hash(seed * 11, kFlip) - 0.5) * 1.8;
    g.translate(x + tJitterX, y - 10 + tJitterY);

    // 2B Graphite search / under-text
    g.fillStyle = 'rgba(65, 50, 36, 0.3)';
    g.font = '900 36px Georgia, serif';
    g.textAlign = 'center';
    g.fillText(text, 1.8, 1.6);

    // Deep carbon ink letterforms
    g.fillStyle = '#110e0c';
    g.fillText(text, 0, 0);
    g.restore();
  }

  // =========================================================================
  // PHYSICAL FLIPBOOK MARGINS, BOUND SPINE & FANNED PAGE-CURL OPTICS
  // =========================================================================
  private drawFlipbookMargins(
    g: CanvasRenderingContext2D,
    t: number,
    kFlip: number,
    phi: number,
    w: number,
    h: number
  ) {
    // 1. Bound Left Spine with Classic Animation Peg Holes
    const spineW = 58;
    g.fillStyle = '#2d1c14';
    g.fillRect(0, 0, spineW, h);

    this.strokeOrganicLine(g, spineW, 0, spineW, h, 80, kFlip, '#150d09', 3.5, 0.0, false);

    // Three Acme Animation Peg Holes
    const pegY = [140, h / 2, h - 140];
    for (let i = 0; i < pegY.length; i++) {
      const py = pegY[i]!;
      g.fillStyle = '#110e0c';
      g.beginPath();
      g.arc(28, py, 11, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#6e5444';
      g.lineWidth = 2.0;
      g.stroke();
    }

    // 2. Right Margin Fanned Paper Strata (Stack of 24 sheets)
    const fanXStart = w - 50;
    const numSheets = 24;

    const fanShadow = g.createLinearGradient(fanXStart - 28, 0, fanXStart, 0);
    fanShadow.addColorStop(0, 'rgba(0,0,0,0)');
    fanShadow.addColorStop(1, 'rgba(45, 30, 18, 0.36)');
    g.fillStyle = fanShadow;
    g.fillRect(fanXStart - 28, 30, 28, h - 60);

    for (let p = 0; p < numSheets; p++) {
      const px = fanXStart + p * 2.0;
      const pTone = 208 + Math.floor(this.hash(p * 11, 0) * 36);
      g.strokeStyle = `rgb(${pTone}, ${pTone - 10}, ${pTone - 22})`;
      g.lineWidth = 1.0;
      g.beginPath();
      g.moveTo(px, 30);
      g.lineTo(px, h - 30);
      g.stroke();
    }

    g.strokeStyle = '#5c1010';
    g.lineWidth = 4.0;
    g.beginPath();
    g.moveTo(w - 2, 24);
    g.lineTo(w - 2, h - 24);
    g.stroke();

    // 3. Thumb Riffle Indentation
    const thumbY = h * 0.63 + Math.sin(t * 1.4) * 12;
    const thumbGrad = g.createRadialGradient(w - 22, thumbY, 8, w - 22, thumbY, 80);
    thumbGrad.addColorStop(0, 'rgba(65, 40, 22, 0.38)');
    thumbGrad.addColorStop(0.5, 'rgba(65, 40, 22, 0.16)');
    thumbGrad.addColorStop(1, 'rgba(65, 40, 22, 0.0)');
    g.fillStyle = thumbGrad;
    g.beginPath();
    g.ellipse(w - 22, thumbY, 75, 52, 0, 0, Math.PI * 2);
    g.fill();

    // 4. Corner Page Number Counter
    const pageNum = 100 + kFlip;
    g.save();
    const pNumJitterX = (this.hash(109, kFlip) - 0.5) * 2.2;
    const pNumJitterY = (this.hash(113, kFlip) - 0.5) * 1.8;
    g.translate(w - 110 + pNumJitterX, h - 55 + pNumJitterY);

    g.fillStyle = 'rgba(70, 50, 35, 0.3)';
    g.font = 'bold 22px "Courier New", monospace';
    g.textAlign = 'right';
    g.fillText(`P. ${pageNum}`, 1.2, 1.2);

    g.fillStyle = '#261b14';
    g.fillText(`P. ${pageNum}`, 0, 0);
    g.restore();

    // 5. Cantilever Page Lift & Release Snap
    if (phi >= 0.70) {
      const curlU = (phi - 0.70) / 0.30;
      const curlSize = 45 + curlU * 120;

      g.save();
      g.fillStyle = `rgba(30, 18, 10, ${0.18 + curlU * 0.38})`;
      g.beginPath();
      g.moveTo(w - 48 - curlSize * 1.15, h - 48);
      g.lineTo(w - 48, h - 48 - curlSize * 1.15);
      g.lineTo(w - 48, h - 48);
      g.closePath();
      g.fill();

      g.fillStyle = `rgb(${228 - Math.floor(curlU * 22)}, ${220 - Math.floor(curlU * 22)}, ${205 - Math.floor(curlU * 22)})`;
      g.strokeStyle = '#261b14';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(w - 48 - curlSize, h - 48);
      g.quadraticCurveTo(w - 48 - curlSize * 0.4, h - 48 - curlSize * 0.4, w - 48, h - 48 - curlSize);
      g.lineTo(w - 48, h - 48);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }

    if (phi < 0.30) {
      const snapU = phi / 0.30;
      const snapAlpha = (1.0 - snapU) * 0.46;
      const sweepWidth = 80 + (1.0 - snapU) * 180;

      const snapGrad = g.createLinearGradient(w - 48 - sweepWidth, 0, w - 48, 0);
      snapGrad.addColorStop(0, 'rgba(0,0,0,0)');
      snapGrad.addColorStop(0.7, `rgba(40, 24, 14, ${snapAlpha * 0.65})`);
      snapGrad.addColorStop(1, `rgba(40, 24, 14, ${snapAlpha})`);
      g.fillStyle = snapGrad;
      g.fillRect(w - 48 - sweepWidth, 30, sweepWidth, h - 60);
    }
  }

  // =========================================================================
  // MAIN RENDER LOOP
  // =========================================================================
  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;
    const w = this.animCanvas.width;
    const h = this.animCanvas.height;
    const g = this.animCtx;

    // 24 FPS Physical Paper-Flip Clock
    const rawFlip = 24.0 * (t - 16.0);
    const kFlip = Math.max(0, Math.floor(rawFlip));
    const phi = rawFlip - Math.floor(rawFlip);

    // Audio reactivity signals
    const audioActive = t >= 17.0;
    const rms = audioActive ? (f.a?.rms ?? 0.3) : 0.0;
    const kick = audioActive ? (f.a?.kick ?? 0.0) : 0.0;
    const snare = audioActive ? (f.a?.snare ?? 0.0) : 0.0;

    // =======================================================================
    // 1. WARM ANTIQUE PARCHMENT WITH BOILING FIBER GRAIN
    // =======================================================================
    const paperLight = 244 + Math.floor(this.hash(1, kFlip) * 5);
    g.fillStyle = `rgb(${paperLight}, ${paperLight - 6}, ${paperLight - 18})`;
    g.fillRect(0, 0, w, h);

    // Aging noise & fiber stains
    for (let i = 0; i < 8; i++) {
      const sx = this.hash(i * 13, kFlip) * w;
      const sy = this.hash(i * 17, kFlip) * h;
      const sr = 140 + this.hash(i * 23, kFlip) * 180;
      g.fillStyle = `rgba(165, 135, 95, ${0.04 + this.hash(i * 31, kFlip) * 0.04})`;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }

    // Outer Hand-Drawn Ink Border
    this.drawOrganicRect(g, 68, 36, w - 128, h - 72, 10, kFlip, '#110e0c', undefined, 4.0, 9.0);
    this.drawOrganicRect(g, 78, 46, w - 148, h - 92, 20, kFlip, '#332318', undefined, 1.8, 5.0);

    // =======================================================================
    // 2. MICRO-REGISTRATION PAPER JITTER & CHAPTER STORYBOARD
    // =======================================================================
    const pJitterX = (this.hash(101, kFlip) - 0.5) * 3.8;
    const pJitterY = (this.hash(103, kFlip) - 0.5) * 2.8;
    const pJitterRot = (this.hash(107, kFlip) - 0.5) * 0.0035;

    g.save();
    g.translate(w / 2 + pJitterX, h / 2 + pJitterY);
    g.rotate(pJitterRot);
    g.translate(-w / 2, -h / 2);

    if (t < 32.5) {
      this.drawChapter1_TheVaultHeist(g, t, kFlip, w, h, rms, kick);
    } else if (t < 47.5) {
      this.drawChapter2_GetawayRoadsterChase(g, t, kFlip, w, h, rms, kick, snare);
    } else if (t < 62.5) {
      this.drawChapter3_RooftopNoirPursuit(g, t, kFlip, w, h, rms, kick, snare);
    } else {
      this.drawChapter4_EndlessHorizonAndFinStamp(g, t, kFlip, w, h, rms, kick);
    }

    g.restore();

    // =======================================================================
    // 3. FLIPBOOK MARGINS & CANTILEVER PAGE-CURL SNAP
    // =======================================================================
    this.drawFlipbookMargins(g, t, kFlip, phi, w, h);

    this.animTexture.needsUpdate = true;

    // =======================================================================
    // 4. CAMERA CHOREOGRAPHY & PERIODIC 3D BOOK PULLBACKS
    // =======================================================================
    let isPullback = false;
    let pullProgress = 0.0;

    const pullIntervals = [
      [31.0, 34.0],
      [46.0, 49.0],
      [61.0, 64.0],
    ];

    let pullbackU = 0.0;
    for (const [pStart, pEnd] of pullIntervals) {
      if (t >= pStart && t <= pEnd) {
        isPullback = true;
        pullbackU = (t - pStart) / (pEnd - pStart);
        pullProgress = Math.sin(pullbackU * Math.PI);
        break;
      }
    }

    if (!isPullback) {
      this.camera.position.set(0.0, 1.83, 0.0);
      this.camera.lookAt(0.0, 0.765, 0.0);
      this.camera.rotation.z = 0;
      this.turningPageGroup.visible = false;
    } else {
      const ease = pullProgress * pullProgress * (3 - 2 * pullProgress);
      this.camera.position.set(
        0.0 + Math.sin(ease * Math.PI) * 0.12,
        THREE.MathUtils.lerp(1.83, 2.75, ease),
        THREE.MathUtils.lerp(0.0, 0.85, ease)
      );
      this.camera.lookAt(0.0, 0.765, 0.0);

      // Physical 3D Page Turn Animation
      const flipProgress = Math.min(1.0, Math.max(0.0, (pullbackU - 0.20) / 0.60));
      const easeFlip = flipProgress * flipProgress * (3 - 2 * flipProgress);

      if (flipProgress > 0.001 && flipProgress < 0.999) {
        this.turningPageGroup.visible = true;
        this.turningPagePivot.rotation.z = easeFlip * Math.PI;
        // Bending arch lift
        this.turningPagePivot.position.y = Math.sin(easeFlip * Math.PI) * 0.045;
        // Ambient contact shadow on the underlying page
        this.turningPageShadow.material.opacity = Math.sin(easeFlip * Math.PI) * 0.35;
        this.turningPageShadow.position.x = THREE.MathUtils.lerp(0.36, -0.36, easeFlip);

        // Deform vertices with aerodynamic cylindrical arch across page width
        const posAttr = this.turningPageMesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
          const origX = this.origPagePositions[i * 3]!;
          const origZ = this.origPagePositions[i * 3 + 2]!;
          const s = Math.min(1.0, Math.max(0.0, origX / 0.72)); // 0 at spine, 1 at outer edge
          // Sinusoidal arch peaking mid-leaf
          const arch = Math.sin(s * Math.PI) * Math.sin(easeFlip * Math.PI) * 0.075;
          posAttr.setXYZ(i, origX, arch, origZ);
        }
        posAttr.needsUpdate = true;
        this.turningPageMesh.geometry.computeVertexNormals();
      } else {
        this.turningPageGroup.visible = false;
      }
    }

    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      exposure: 1.05,
      bloom: 0.14,
      bloomRadius: 0.22,
      vignette: 0.26,
      grain: 0.04,
    };
  }

  // =========================================================================
  // =========================================================================
  // CHAPTER 1: THE BANK VAULT HEIST & WORD LEAP (17.0s - 32.5s)
  // (Zero tech-demo headers: pure visual storytelling & direct environmental interaction)
  // =========================================================================
  private drawChapter1_TheVaultHeist(
    g: CanvasRenderingContext2D,
    t: number,
    kFlip: number,
    w: number,
    h: number,
    rms: number,
    kick: number
  ) {
    const groundY = 860;

    // 1. Grand Art Deco Neoclassical Bank Hall Architecture (Spans Full Width)
    // Massive Continuous Architrave & Frieze across top
    this.drawOrganicRect(g, 70, 130, w - 130, 50, 201, kFlip, '#110e0c', undefined, 4.2, 8.0);
    this.strokeOrganicLine(g, 70, 155, w - 60, 155, 202, kFlip, '#332318', 2.0, 0.0);

    // Neoclassical Fluted Columns across the Bank Hall (x = 80, 580, 1140, 1640)
    const colX = [80, 580, 1140, 1640];
    colX.forEach((cx, cIdx) => {
      // Column Shaft
      this.drawOrganicRect(g, cx, 180, 48, groundY - 180, 205 + cIdx * 10, kFlip, '#110e0c', '#fbf5e8', 3.2, 4.0);
      // Fluting lines
      this.strokeOrganicLine(g, cx + 16, 180, cx + 16, groundY, 207 + cIdx * 10, kFlip, 'rgba(50, 35, 25, 0.45)', 1.8, 0.0);
      this.strokeOrganicLine(g, cx + 32, 180, cx + 32, groundY, 208 + cIdx * 10, kFlip, 'rgba(50, 35, 25, 0.45)', 1.8, 0.0);
      // Ornate Capital on top
      this.drawOrganicRect(g, cx - 6, 180, 60, 18, 209 + cIdx * 10, kFlip, '#110e0c', '#ca8a04', 2.6, 2.0);
    });

    // Grand Arched Windows in Background between Columns (Night City View)
    const winX = [820, 1360];
    winX.forEach((wx, wIdx) => {
      const wy = 230;
      const ww = 190;
      const wh = 360;
      // Arched Window Frame with Dark Night Sky fill
      g.fillStyle = '#111827';
      g.beginPath();
      g.moveTo(wx, wy + wh);
      g.lineTo(wx, wy + 80);
      g.quadraticCurveTo(wx + ww / 2, wy - 30, wx + ww, wy + 80);
      g.lineTo(wx + ww, wy + wh);
      g.closePath();
      g.fill();

      // Window Inked Border
      this.strokeOrganicLine(g, wx, wy + wh, wx, wy + 80, 220 + wIdx * 8, kFlip, '#110e0c', 3.4, 0.0);
      this.strokeOrganicLine(g, wx + ww, wy + wh, wx + ww, wy + 80, 221 + wIdx * 8, kFlip, '#110e0c', 3.4, 0.0);
      this.strokeOrganicBezier(g, wx, wy + 80, wx + 40, wy, wx + ww - 40, wy, wx + ww, wy + 80, 222 + wIdx * 8, kFlip, '#110e0c', 3.4);
      // Mullion Cross Grid (+)
      this.strokeOrganicLine(g, wx + ww / 2, wy + 35, wx + ww / 2, wy + wh, 224 + wIdx * 8, kFlip, '#332318', 2.2, 0.0);
      this.strokeOrganicLine(g, wx, wy + 160, wx + ww, wy + 160, 225 + wIdx * 8, kFlip, '#332318', 2.0, 0.0);
      this.strokeOrganicLine(g, wx, wy + 260, wx + ww, wy + 260, 226 + wIdx * 8, kFlip, '#332318', 2.0, 0.0);

      // Distant Silhouetted City Skyline in window
      g.fillStyle = '#090d16';
      g.fillRect(wx + 10, wy + 280, 45, 80);
      g.fillRect(wx + 65, wy + 240, 55, 120);
      g.fillRect(wx + 130, wy + 295, 45, 65);
    });

    // Spinning Red Emergency Alarm Beacon on Bank Wall (Mounted at x = 340, y = 230)
    const alarmSpin = (t * 12.0) % (Math.PI * 2);
    const alarmFlash = Math.sin(alarmSpin) > 0;
    this.drawOrganicRect(g, 330, 220, 20, 14, 250, kFlip, '#110e0c', '#334155', 2.0, 0.0);
    g.fillStyle = alarmFlash ? '#ef4444' : '#7f1d1d';
    g.beginPath();
    g.arc(340, 214, 12, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, 340, 214, 12, 0, Math.PI * 2, 252, kFlip, '#110e0c', 2.6, true);
    // Translucent Red Emergency Alarm Light Wash across Bank
    if (alarmFlash) {
      const redWash = g.createRadialGradient(340, 214, 20, 340, 214, 600);
      redWash.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
      redWash.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
      g.fillStyle = redWash;
      g.fillRect(70, 130, w - 130, groundY - 130);
    }

    // Continuous Ground Floor with 1-Point Perspective Marble Floor Tiles
    this.strokeOrganicLine(g, 70, groundY, w - 60, groundY, 601, kFlip, '#110e0c', 4.5, 8.0);
    // Floor Tile Perspective Hatching receding to center
    for (let fx = 70; fx <= w - 60; fx += 50) {
      this.strokeOrganicLine(g, fx, groundY, fx + (fx - w / 2) * 0.15, h - 50, 610 + fx, kFlip, 'rgba(40, 30, 20, 0.35)', 1.8, 0.0, false);
    }
    this.strokeOrganicLine(g, 70, groundY + 35, w - 60, groundY + 35, 620, kFlip, 'rgba(40, 30, 20, 0.35)', 1.8, 0.0, false);

    // 2. Bank Vault Door & Interior (vx=340, vy=560)
    const vx = 340, vy = 560;
    const isBlown = t >= 20.4;
    const expT = isBlown ? t - 20.4 : 0;
    const doorOpenAngle = isBlown ? Math.min(1.4, expT * 1.8) : 0;

    // Outer Vault Door Portal Frame (Steel rim on masonry wall)
    this.strokeOrganicArc(g, vx, vy, 190, 0, Math.PI * 2, 301, kFlip, '#110e0c', 5.0, true);
    this.strokeOrganicArc(g, vx, vy, 160, 0, Math.PI * 2, 305, kFlip, '#110e0c', 3.8, true);

    if (isBlown) {
      // OPEN VAULT INTERIOR: Dark Chamber with Stacks of Gold Bullion
      g.fillStyle = '#140d07';
      g.beginPath();
      g.arc(vx, vy, 158, 0, Math.PI * 2);
      g.fill();

      // Stacked Gold Bars inside vault
      const goldY = vy + 40;
      for (let row = 0; row < 3; row++) {
        const numBars = 4 - row;
        const startX = vx - (numBars * 28) / 2;
        for (let b = 0; b < numBars; b++) {
          const bx = startX + b * 28;
          const by = goldY - row * 18;
          this.drawOrganicRect(g, bx, by, 26, 16, 310 + row * 10 + b, kFlip, '#ca8a04', '#fef08a', 2.0, 0.0);
        }
      }
    }

    // The Vault Door Body (Hinged on the left at vx - 165)
    g.save();
    if (isBlown) {
      // Perspective swing open on left hinge
      g.translate(vx - 165, vy);
      g.scale(Math.cos(doorOpenAngle), 1.0);
      g.translate(165, 0);
    } else {
      g.translate(vx, vy);
    }

    // Solid Steel Door Face
    g.fillStyle = '#e2e8f0';
    g.beginPath();
    g.arc(0, 0, 158, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, 0, 0, 158, 0, Math.PI * 2, 320, kFlip, '#110e0c', 4.5, true);
    this.strokeOrganicArc(g, 0, 0, 115, 0, Math.PI * 2, 325, kFlip, '#110e0c', 3.2, true);

    // Locking Bolts around perimeter
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const rx = Math.cos(a) * 135;
      const ry = Math.sin(a) * 135;
      this.strokeOrganicArc(g, rx, ry, 6, 0, Math.PI * 2, 350 + Math.floor(a * 10), kFlip, '#110e0c', 2.4, true);
    }

    // Wheel Spokes & Combination Dial
    const dialRotation = !isBlown ? t * 4.0 : 0;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      this.strokeOrganicLine(g, cosA * 36, sinA * 36, cosA * 115, sinA * 115, 400 + Math.floor(a * 10), kFlip, '#110e0c', 3.6, 2.0);
    }
    this.strokeOrganicArc(g, 0, 0, 36, 0, Math.PI * 2, 450, kFlip, '#110e0c', 4.0, true);
    for (let tick = 0; tick < 12; tick++) {
      const ta = (tick * Math.PI) / 6 + dialRotation;
      this.strokeOrganicLine(g, Math.cos(ta) * 26, Math.sin(ta) * 26, Math.cos(ta) * 34, Math.sin(ta) * 34, 460 + tick, kFlip, '#110e0c', 2.0, 0.0, false);
    }
    g.restore();

    // Sound Text when Safe-Cracking
    if (t < 20.4) {
      g.save();
      g.fillStyle = '#110e0c';
      g.font = 'italic bold 20px Georgia, serif';
      g.textAlign = 'center';
      const tickWord = Math.floor(t * 3) % 2 === 0 ? '*CLICK*' : '*TICK*';
      g.fillText(tickWord, vx + 100, vy - 90);
      this.strokeOrganicBezier(g, vx + 40, vy - 20, vx + 70, vy - 50, vx + 85, vy - 80, vx + 100, vy - 85, 470, kFlip, '#ca8a04', 2.0, false);
      g.restore();
    }

    // 3. Vault Explosion FX on Beat Drop (t >= 20.4s)
    if (isBlown) {
      // Jagged Comic Explosion Starburst
      if (expT < 1.6) {
        const starburstScale = Math.min(1.0, expT * 6.0) * Math.max(0.0, 1.0 - expT / 1.6);
        g.save();
        g.translate(vx, vy);
        g.scale(starburstScale, starburstScale);
        g.fillStyle = '#fef08a';
        g.beginPath();
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 10) {
          const rOut = 320 + (a % (Math.PI / 5) === 0 ? 90 : 0);
          const rIn = 140;
          const x1 = Math.cos(a) * rOut;
          const y1 = Math.sin(a) * rOut;
          const x2 = Math.cos(a + Math.PI / 20) * rIn;
          const y2 = Math.sin(a + Math.PI / 20) * rIn;
          if (a === 0) g.moveTo(x1, y1);
          else { g.lineTo(x1, y1); g.lineTo(x2, y2); }
        }
        g.closePath();
        g.fill();
        g.strokeStyle = '#dc2626';
        g.lineWidth = 5.0;
        g.stroke();
        g.restore();
      }

      // Shockwave Ring
      if (expT < 1.2) {
        const shockR = expT * 550;
        const shockAlpha = (1.0 - expT / 1.2) * 0.7;
        g.save();
        g.strokeStyle = `rgba(220, 38, 38, ${shockAlpha})`;
        g.lineWidth = 4.5;
        g.beginPath();
        g.arc(vx, vy, shockR, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }

      // Swarm of Banknotes Swirling in Dynamic Vortex
      const numBills = Math.min(65, Math.floor(expT * 24));
      for (let b = 0; b < numBills; b++) {
        const angle = this.hash(b * 19, 0) * Math.PI * 2;
        const dist = (expT * 260 + this.hash(b * 23, 0) * 580) % 1200;
        const bx = vx + Math.cos(angle + expT * 1.6) * dist;
        const by = vy + Math.sin(angle + expT * 1.6) * dist * 0.65 - expT * 38;
        const bRot = expT * 5.2 + this.hash(b * 29, 0) * Math.PI * 2;

        if (bx > 80 && bx < w - 70 && by > 60 && by < h - 60) {
          g.save();
          g.translate(bx, by);
          g.rotate(bRot);
          this.drawOrganicRect(g, -26, -14, 52, 28, b * 7, kFlip, '#047857', '#d1fae5', 2.2, 3.0);
          g.fillStyle = '#065f46';
          g.font = 'bold 15px monospace';
          g.textAlign = 'center';
          g.fillText('$', 0, 5);
          g.restore();
        }
      }

      // Golden Coins Bursting in Parabolic Arcs
      const numCoins = Math.min(30, Math.floor(expT * 18));
      for (let c = 0; c < numCoins; c++) {
        const cAngle = this.hash(c * 31, 0) * Math.PI * 2;
        const cSpeed = 180 + this.hash(c * 37, 0) * 340;
        const cx = vx + Math.cos(cAngle) * cSpeed * expT;
        const cy = vy + Math.sin(cAngle) * cSpeed * expT + 0.5 * 460 * expT * expT;
        if (cx > 80 && cx < w - 70 && cy > 60 && cy < h - 60) {
          g.fillStyle = '#fef08a';
          g.beginPath();
          g.arc(cx, cy, 6, 0, Math.PI * 2);
          g.fill();
          this.strokeOrganicArc(g, cx, cy, 6, 0, Math.PI * 2, c * 3, kFlip, '#ca8a04', 2.0, true);
        }
      }
    }

    // 4. Physical Word Platforms (Reactive Flexing & Dust Puffs)
    // Platform 1: "PULL THE TRIGGER"
    const p1LandTime = 26.0;
    const p1Flex = t >= p1LandTime ? Math.exp(-(t - p1LandTime) * 5.0) * Math.sin((t - p1LandTime) * 16.0) * 16.0 : 0;
    const p1Y = groundY - 170 + p1Flex;
    this.drawHandWordPlatform(g, 'PULL THE TRIGGER', 1040, p1Y, 340, 30, 501, kFlip);

    // Platform 2: "ON THE PLAN"
    const p2LandTime = 28.6;
    const p2Flex = t >= p2LandTime ? Math.exp(-(t - p2LandTime) * 5.0) * Math.sin((t - p2LandTime) * 16.0) * 16.0 : 0;
    const p2Y = groundY - 330 + p2Flex;
    this.drawHandWordPlatform(g, 'ON THE PLAN', 1410, p2Y, 280, 30, 502, kFlip);

    // Platform 3: "NO TAKEBACKS"
    const p3LandTime = 31.0;
    const p3Flex = t >= p3LandTime ? Math.exp(-(t - p3LandTime) * 5.0) * Math.sin((t - p3LandTime) * 16.0) * 16.0 : 0;
    const p3Y = groundY - 490 + p3Flex;
    this.drawHandWordPlatform(g, 'NO TAKEBACKS', 1720, p3Y, 300, 30, 503, kFlip);

    // Hand-drawn Impact Dust Clouds on Platform Landings
    const drawDustPuff = (px: number, py: number, dt: number) => {
      if (dt >= 0 && dt < 0.65) {
        const dScale = dt / 0.65;
        const dAlpha = (1.0 - dScale) * 0.7;
        g.save();
        g.fillStyle = `rgba(100, 80, 60, ${dAlpha})`;
        for (let p = 0; p < 6; p++) {
          const side = p % 2 === 0 ? 1 : -1;
          const puffX = px + side * (18 + p * 12 * dScale);
          const puffY = py - 4 - Math.sin(dScale * Math.PI) * 12;
          const puffR = 6 + p * 3 * dScale;
          g.beginPath();
          g.arc(puffX, puffY, puffR, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    };
    drawDustPuff(980, p1Y - 28, t - p1LandTime);
    drawDustPuff(1360, p2Y - 28, t - p2LandTime);
    drawDustPuff(1720, p3Y - 28, t - p3LandTime);

    // 5. CONTINUOUS HERO CHARACTER TRAJECTORIES & INTERACTIONS (Zero Teleport Jank)
    let charX = 440;
    let charY = groundY;
    let charMode: 'safecrack' | 'recoil' | 'sprint' | 'jump' | 'triumph' = 'safecrack';
    let jumpProgress = 0;
    let recoilProgress = 0;

    if (t < 20.4) {
      // Act 1A: Safe-cracking crouch at vault dial
      charX = 440;
      charY = groundY;
      charMode = 'safecrack';
    } else if (t < 22.2) {
      // Act 1B: Vault explosion blast wave pushes characters backward smoothly
      recoilProgress = (t - 20.4) / 1.8;
      charX = 440 + Math.sin(recoilProgress * Math.PI * 0.5) * 160;
      charY = groundY - Math.sin(recoilProgress * Math.PI) * 45;
      charMode = 'recoil';
    } else if (t < 24.8) {
      // Act 1C: Sprint across ground floor to launch point
      const u = (t - 22.2) / 2.6;
      charX = 600 + u * 220;
      charY = groundY;
      charMode = 'sprint';
    } else if (t < 26.0) {
      // Launch & Parabolic Vault 1 onto Platform 1 ("PULL THE TRIGGER")
      jumpProgress = (t - 24.8) / 1.2;
      charX = 820 + jumpProgress * (980 - 820);
      charY = groundY + jumpProgress * ((p1Y - 28) - groundY) - Math.sin(jumpProgress * Math.PI) * 140;
      charMode = 'jump';
    } else if (t < 27.4) {
      // Continuous sprint across Platform 1 letters (Starts at exact landing position 980!)
      const u = (t - 26.0) / 1.4;
      charX = 980 + u * 120;
      charY = p1Y - 28;
      charMode = 'sprint';
    } else if (t < 28.6) {
      // Vault 2 from Platform 1 edge to Platform 2 ("ON THE PLAN")
      jumpProgress = (t - 27.4) / 1.2;
      charX = 1100 + jumpProgress * (1360 - 1100);
      charY = (p1Y - 28) + jumpProgress * ((p2Y - 28) - (p1Y - 28)) - Math.sin(jumpProgress * Math.PI) * 150;
      charMode = 'jump';
    } else if (t < 29.8) {
      // Continuous sprint across Platform 2 letters (Starts at exact landing position 1360!)
      const u = (t - 28.6) / 1.2;
      charX = 1360 + u * 100;
      charY = p2Y - 28;
      charMode = 'sprint';
    } else if (t < 31.0) {
      // Climactic Vault 3 to Platform 3 ("NO TAKEBACKS")
      jumpProgress = (t - 29.8) / 1.2;
      charX = 1460 + jumpProgress * (1720 - 1460);
      charY = (p2Y - 28) + jumpProgress * ((p3Y - 28) - (p2Y - 28)) - Math.sin(jumpProgress * Math.PI) * 160;
      charMode = 'jump';
    } else {
      // Victorious Heroic Stance atop "NO TAKEBACKS"
      charX = 1720;
      charY = p3Y - 28;
      charMode = 'triumph';
    }

    // Render Both Hand-Drawn Characters in Tight Tandem Partnership:
    // Firebrand (Character A) in FRONT at +36, Pilot (Character B) BEHIND at -36
    if (charMode === 'safecrack') {
      this.drawVolumetricCharacterA(g, charX - 35, charY, t, kFlip, 'safecrack', true, jumpProgress, recoilProgress);
      this.drawVolumetricCharacterB(g, charX + 35, charY, t, kFlip, 'safecrack', true, jumpProgress, recoilProgress);
    } else {
      this.drawVolumetricCharacterA(g, charX + 36, charY, t, kFlip, charMode, true, jumpProgress, recoilProgress);
      this.drawVolumetricCharacterB(g, charX - 36, charY, t, kFlip, charMode, true, jumpProgress, recoilProgress);
      // Interlocked clasped hands at midpoint charX
      const claspY = charMode === 'triumph' ? charY - 110 : charY - 78;
      this.drawOrganicClaspedHands(g, charX, claspY, kFlip, t);
    }
  }

  // =========================================================================
  // CHAPTER 2: HIGH-SPEED PARALLAX HIGHWAY CHASE (33.5s - 47.5s)
  // (Zero tech-demo headers: pure visual storytelling & 100 MPH kinetic parallax)
  // =========================================================================
  private drawChapter2_GetawayRoadsterChase(
    g: CanvasRenderingContext2D,
    t: number,
    kFlip: number,
    w: number,
    h: number,
    rms: number,
    kick: number,
    snare: number
  ) {
    const roadY = 760;
    const chaseT = t - 33.5;
    const roadSpeed = 1450.0; // 1450 px/s high-speed travel velocity
    const worldDist = chaseT * roadSpeed;

    // 1. LAYER 0: DISTANT JAGGED MOUNTAIN SILHOUETTE (Slow Parallax v = 90 px/s)
    const mountScroll = (chaseT * 90.0) % 1200;
    g.fillStyle = '#221812';
    g.beginPath();
    g.moveTo(70, roadY - 40);
    for (let mx = 70; mx <= w - 60; mx += 60) {
      const worldMx = mx + mountScroll;
      const peakH = 140 + Math.sin(worldMx * 0.005) * 60 + Math.cos(worldMx * 0.012) * 45;
      g.lineTo(mx, roadY - peakH);
    }
    g.lineTo(w - 60, roadY - 40);
    g.closePath();
    g.fill();
    // Inked mountain ridge line
    for (let mx = 70; mx < w - 60; mx += 60) {
      const w1 = mx + mountScroll;
      const w2 = mx + 60 + mountScroll;
      const h1 = roadY - (140 + Math.sin(w1 * 0.005) * 60 + Math.cos(w1 * 0.012) * 45);
      const h2 = roadY - (140 + Math.sin(w2 * 0.005) * 60 + Math.cos(w2 * 0.012) * 45);
      this.strokeOrganicLine(g, mx, h1, mx + 60, h2, 750 + mx, kFlip, '#110e0c', 3.4, 0.0, false);
    }

    // 2. LAYER 1: RUSHING ROADSIDE TELEGRAPH POLES & CABLES (Mid Parallax v = 850 px/s)
    const poleSpacing = 440;
    const poleOffset = (chaseT * 850.0) % poleSpacing;
    for (let px = -100 - poleOffset; px < w + 200; px += poleSpacing) {
      if (px > 60 && px < w - 50) {
        const poleTopY = roadY - 260;
        // Main wooden pole post
        this.strokeOrganicLine(g, px, roadY + 20, px, poleTopY, 800 + Math.floor(px), kFlip, '#110e0c', 4.8);
        this.strokeOrganicLine(g, px + 10, roadY + 20, px + 8, poleTopY, 801 + Math.floor(px), kFlip, '#110e0c', 3.2);
        // Crossarm beam
        this.strokeOrganicLine(g, px - 35, poleTopY + 25, px + 45, poleTopY + 25, 802 + Math.floor(px), kFlip, '#110e0c', 3.8);
        // Glass insulators (3 green studs)
        for (let ins = 0; ins < 3; ins++) {
          const ix = px - 25 + ins * 30;
          this.drawOrganicRect(g, ix - 4, poleTopY + 16, 8, 10, 805 + ins, kFlip, '#110e0c', '#047857', 2.0, 0.0);
        }
        // Sagging catenary wire connecting to next pole
        const nextPx = px + poleSpacing;
        this.strokeOrganicBezier(g, px + 35, poleTopY + 25, px + 150, poleTopY + 75, px + 280, poleTopY + 75, nextPx - 35, poleTopY + 25, 810 + Math.floor(px), kFlip, '#110e0c', 2.2, false);
      }
    }

    // 3. LAYER 1B: RUSHING HIGHWAY GANTRY BILLBOARD (Approaches, streaks past, exits)
    // Billboard 1 at t=35.5s to 39.5s
    // 3. LAYER 1B: RUSHING HIGHWAY TIMBER BILLBOARD (Approaches, streaks past, exits)
    const bb1WorldX = 5200;
    const bb1ScreenX = bb1WorldX - worldDist * 0.75 + 1100;
    if (bb1ScreenX > -280 && bb1ScreenX < w + 280) {
      const gantryY = roadY - 260;
      // Sturdy Weathered Heavy Timber Posts with X-Braces
      this.strokeOrganicLine(g, bb1ScreenX - 145, roadY + 25, bb1ScreenX - 145, gantryY - 10, 930, kFlip, '#110e0c', 5.0);
      this.strokeOrganicLine(g, bb1ScreenX + 145, roadY - 15, bb1ScreenX + 145, gantryY - 10, 932, kFlip, '#110e0c', 5.0);
      // Diagonal Timber X-Bracing behind board
      this.strokeOrganicLine(g, bb1ScreenX - 140, roadY, bb1ScreenX + 140, gantryY + 30, 933, kFlip, '#3e2719', 3.0, 0.0);
      this.strokeOrganicLine(g, bb1ScreenX + 140, roadY, bb1ScreenX - 140, gantryY + 30, 934, kFlip, '#3e2719', 3.0, 0.0);

      // Weathered Hand-Painted Enamel Billboard Body (#fef3c7 / #fde68a)
      this.drawOrganicRect(g, bb1ScreenX - 155, gantryY, 310, 100, 935, kFlip, '#110e0c', '#fef3c7', 4.5, 6.0);
      this.drawOrganicRect(g, bb1ScreenX - 147, gantryY + 6, 294, 88, 936, kFlip, '#ca8a04', undefined, 2.4, 0.0);

      // Authentic Hand-Stenciled Typography
      g.save();
      g.translate(bb1ScreenX, gantryY);
      g.fillStyle = '#110e0c';
      g.font = '900 28px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('NO 95s ALLOWED', 0, 42);

      g.fillStyle = '#b91c1c';
      g.font = '900 20px Impact, sans-serif';
      g.fillText('100 MPH MINIMUM', 0, 74);
      g.restore();
    }

    // 4. LAYER 2: HIGH-SPEED ASPHALT HIGHWAY RIBBON & STREAKING CENTERLINES
    this.strokeOrganicBezier(g, 70, roadY + 70, 500, roadY - 110, 1150, roadY + 140, w - 60, roadY - 30, 801, kFlip, '#110e0c', 5.5);

    // Fast Streaking Dashed Centerlines (v = 1450 px/s)
    const dashLength = 110;
    const dashSpacing = 85;
    const dashPeriod = dashLength + dashSpacing;
    const dashOffset = worldDist % dashPeriod;

    for (let dx = -dashPeriod + dashOffset; dx < w + dashPeriod; dx += dashPeriod) {
      const tNorm = Math.max(0, Math.min(1, (dx - 70) / (w - 130)));
      const dy = roadY + Math.sin(tNorm * Math.PI * 2.2) * 85;
      const x1 = dx;
      const x2 = dx - dashLength;
      if (x1 > 75 && x2 < w - 65) {
        this.strokeOrganicLine(g, x1, dy, x2, dy, 850 + Math.floor(dx), kFlip, '#ca8a04', 4.2, 0.0, false);
      }
    }

    // Asphalt Stencil Road Lettering Rushing Past: "100 MILES PER HOUR"
    const stencilWorldX = 9800;
    const stencilScreenX = stencilWorldX - worldDist + 900;
    if (stencilScreenX > -300 && stencilScreenX < w + 300) {
      g.save();
      g.translate(stencilScreenX, roadY + 30);
      g.rotate(-0.05);
      g.fillStyle = '#eab308';
      g.font = '900 42px "Impact", sans-serif';
      g.textAlign = 'center';
      g.fillText('100 MILES PER HOUR', 0, 0);
      // Dark rubber tire skid marks screeching across letters
      g.strokeStyle = 'rgba(25, 20, 15, 0.85)';
      g.lineWidth = 7.0;
      g.beginPath();
      g.moveTo(-240, -14); g.lineTo(260, -16);
      g.moveTo(-240, 18); g.lineTo(260, 16);
      g.stroke();
      g.restore();
    }

    // Horizontal Doppler Speed Streaks
    for (let s = 0; s < 16; s++) {
      const sx = ((s * 140 + chaseT * 1200) % (w - 160)) + 80;
      const sy = roadY + 50 + (s % 3) * 18;
      this.strokeOrganicLine(g, sx, sy, sx - 130, sy, 900 + s, kFlip, 'rgba(60, 45, 30, 0.45)', 2.6, 0.0, false);
    }

    // 5. PURSUING 1930s POLICE CRUISER (Swerving Aggressively on Left)
    const copX = 350 + Math.sin(t * 3.5) * 80;
    const copY = roadY + 45 + Math.sin(t * 2.8) * 15;
    this.drawHandPoliceCar(g, copX, copY, kFlip, t);

    // 6. HERO GETAWAY CONVERTIBLE ROADSTER (Auburn 851 Boattail Speedster)
    // Roadster sits in right lane, surging with engine power
    const carX = 1040 + Math.sin(t * 2.2) * 60;
    const carY = roadY + Math.sin(carX * 0.003) * 65;
    this.drawHandGetawayRoadster(g, carX, carY, kFlip, t, rms);
  }

  // =========================================================================
  // CHAPTER 3: NOIR ROOFTOP PARKOUR & CHASM PURSUIT (48.5s - 62.5s)
  // (Zero tech-demo headers: authentic parkour sprint, abyss leap & cable platforms)
  // =========================================================================
  private drawChapter3_RooftopNoirPursuit(
    g: CanvasRenderingContext2D,
    t: number,
    kFlip: number,
    w: number,
    h: number,
    rms: number,
    kick: number,
    snare: number
  ) {
    // 1. BACKGROUND NOIR METROPOLIS SKYLINE SILHOUETTES
    const bgHeights = [360, 480, 520, 390, 610, 430, 550, 460];
    bgHeights.forEach((bh, idx) => {
      const bx = 120 + idx * 210;
      const by = h - 50 - bh;
      g.fillStyle = '#110b08';
      g.fillRect(bx, by, 170, bh);
      this.strokeOrganicLine(g, bx, by, bx + 170, by, 1000 + idx, kFlip, '#0a0604', 3.0, 0.0, false);
      // Faint glowing yellow window slits
      for (let wy = by + 40; wy < by + bh - 60; wy += 55) {
        if (this.hash(idx * 7 + wy, 0) > 0.45) {
          g.fillStyle = 'rgba(254, 240, 138, 0.45)';
          g.fillRect(bx + 25, wy, 16, 22);
          g.fillRect(bx + 75, wy, 16, 22);
          g.fillRect(bx + 125, wy, 16, 22);
        }
      }
    });

    // Sweeping Police Searchlight Beam from Alley Abyss Below (cuts through noir fog)
    const searchAngle = Math.sin(t * 1.6) * 0.42;
    g.save();
    g.translate(680, h - 40);
    g.rotate(searchAngle - 0.25);
    const searchGrad = g.createLinearGradient(0, 0, 0, -1000);
    searchGrad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
    searchGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.22)');
    searchGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
    g.fillStyle = searchGrad;
    g.beginPath();
    g.moveTo(-35, 0);
    g.lineTo(-190, -1000);
    g.lineTo(190, -1000);
    g.lineTo(35, 0);
    g.closePath();
    g.fill();
    g.restore();

    // 2. HERO ROOFTOP 1: ART DECO WAREHOUSE ROOF (x: 70 -> 560, y = 680)
    const r1W = 490;
    const r1Y = 680;
    // Main Brick Facade
    this.drawOrganicRect(g, 70, r1Y, r1W, h - 50 - r1Y, 1020, kFlip, '#110e0c', '#18120e', 4.5, 6.0);
    // Heavy Stone Cornice Ledge
    this.drawOrganicRect(g, 60, r1Y - 15, r1W + 15, 20, 1025, kFlip, '#110e0c', '#2c1e15', 3.8, 3.0);

    // Industrial Chimney Stack puffing coal smoke
    this.drawOrganicRect(g, 150, r1Y - 110, 42, 95, 1030, kFlip, '#110e0c', '#3e2719', 3.2, 0.0);
    // Billowing smoke puffs from chimney
    for (let sm = 0; sm < 4; sm++) {
      const smT = ((t * 1.8 + sm * 0.4) % 1.6);
      const smX = 171 + smT * 45 + Math.sin(smT * 5.0) * 12;
      const smY = r1Y - 120 - smT * 95;
      const smR = 12 + smT * 22;
      g.fillStyle = `rgba(75, 60, 50, ${0.45 * (1.0 - smT / 1.6)})`;
      g.beginPath();
      g.arc(smX, smY, smR, 0, Math.PI * 2);
      g.fill();
    }

    // Lit 4-Pane Industrial Skylight on Roof
    this.drawOrganicRect(g, 240, r1Y - 32, 65, 24, 1040, kFlip, '#110e0c', 'rgba(254, 240, 138, 0.65)', 2.6, 0.0);
    this.strokeOrganicLine(g, 272, r1Y - 32, 272, r1Y - 8, 1042, kFlip, '#110e0c', 2.0, 0.0, false);

    // 4-Legged Staved Wooden Water Tower
    const wtX = 460;
    const wtY = r1Y - 175;
    this.strokeOrganicLine(g, wtX - 34, r1Y - 15, wtX - 22, wtY + 65, 1050, kFlip, '#110e0c', 3.2, 0.0);
    this.strokeOrganicLine(g, wtX + 34, r1Y - 15, wtX + 22, wtY + 65, 1051, kFlip, '#110e0c', 3.2, 0.0);
    this.strokeOrganicLine(g, wtX - 32, r1Y - 15, wtX + 22, wtY + 65, 1052, kFlip, '#110e0c', 2.0, 0.0);
    this.strokeOrganicLine(g, wtX + 32, r1Y - 15, wtX - 22, wtY + 65, 1053, kFlip, '#110e0c', 2.0, 0.0);
    // Slatted Wooden Barrel
    this.drawOrganicRect(g, wtX - 28, wtY, 56, 65, 1055, kFlip, '#110e0c', '#3e2719', 3.6, 2.0);
    this.strokeOrganicLine(g, wtX - 28, wtY + 18, wtX + 28, wtY + 18, 1057, kFlip, '#110e0c', 2.4, 0.0);
    this.strokeOrganicLine(g, wtX - 28, wtY + 46, wtX + 28, wtY + 46, 1058, kFlip, '#110e0c', 2.4, 0.0);
    // Conical Shingle Roof
    g.fillStyle = '#261b14';
    g.beginPath();
    g.moveTo(wtX - 35, wtY);
    g.lineTo(wtX, wtY - 28);
    g.lineTo(wtX + 35, wtY);
    g.closePath();
    g.fill();
    this.strokeOrganicLine(g, wtX - 35, wtY, wtX, wtY - 28, 1060, kFlip, '#110e0c', 3.2, 0.0);
    this.strokeOrganicLine(g, wtX, wtY - 28, wtX + 35, wtY, 1061, kFlip, '#110e0c', 3.2, 0.0);

    // Fluttering Clothesline with Flapping Laundry across Roof 1
    this.strokeOrganicBezier(g, 192, r1Y - 60, 270, r1Y - 35, 360, r1Y - 35, wtX - 30, r1Y - 50, 1070, kFlip, '#3e2719', 2.0, false);
    // Flapping Laundry Items
    const drawCloth = (lx: number, ly: number, col: string, rot: number) => {
      g.save();
      g.translate(lx, ly);
      g.rotate(rot + Math.sin(t * 18.0 + lx) * 0.15);
      g.fillStyle = col;
      g.fillRect(-10, 0, 20, 28);
      this.strokeOrganicLine(g, -10, 0, 10, 0, 1075 + Math.floor(lx), kFlip, '#110e0c', 1.8, 0.0, false);
      this.strokeOrganicLine(g, -10, 0, -10, 28, 1076 + Math.floor(lx), kFlip, '#110e0c', 1.8, 0.0, false);
      this.strokeOrganicLine(g, 10, 0, 10, 28, 1077 + Math.floor(lx), kFlip, '#110e0c', 1.8, 0.0, false);
      g.restore();
    };
    drawCloth(230, r1Y - 42, '#f8fafc', 0.05); // White shirt
    drawCloth(280, r1Y - 38, '#2563eb', -0.08); // Denim pants
    drawCloth(340, r1Y - 40, '#dc2626', 0.12); // Red towel

    // 3. THE 480px ALLEY ABYSS (x: 560 -> 1040)
    // Distant streetlamp glow at bottom of the alley
    g.fillStyle = 'rgba(251, 191, 36, 0.35)';
    g.beginPath();
    g.arc(780, h - 45, 36, 0, Math.PI * 2);
    g.fill();

    // 4. SUSPENSION CABLE PLATFORMS OVER CHASM
    // Platform 1: "DO OR DIE" (x = 840, y = 620)
    const p1Land = t >= 53.4;
    const p1Flex = p1Land ? Math.exp(-(t - 53.4) * 4.5) * Math.sin((t - 53.4) * 16.0) * 22.0 : 0;
    const p1Y = 620 + p1Flex;
    // Thick steel catenary suspension cables holding girder
    this.strokeOrganicLine(g, 560, r1Y - 15, 720, p1Y + 12, 1080, kFlip, '#110e0c', 3.6, 0.0);
    this.strokeOrganicLine(g, 960, p1Y + 12, 1140, 500, 1081, kFlip, '#110e0c', 3.6, 0.0);
    this.drawHandWordPlatform(g, 'DO OR DIE', 840, p1Y, 260, 32, 1085, kFlip);

    // Platform 2: "HOLD ONTO ME" (x = 1260, y = 520)
    const p2Land = t >= 56.6;
    const p2Flex = p2Land ? Math.exp(-(t - 56.6) * 4.5) * Math.sin((t - 56.6) * 16.0) * 22.0 : 0;
    const p2Y = 520 + p2Flex;
    this.strokeOrganicLine(g, 1120, 500, 1160, p2Y + 12, 1090, kFlip, '#110e0c', 3.6, 0.0);
    this.strokeOrganicLine(g, 1360, p2Y + 12, 1480, 625, 1091, kFlip, '#110e0c', 3.6, 0.0);
    this.drawHandWordPlatform(g, 'HOLD ONTO ME', 1260, p2Y, 280, 32, 1095, kFlip);

    // 5. HERO ROOFTOP 2: ART DECO SKYSCRAPER ROOF (x: 1480 -> 1860, y = 640)
    const r2X = 1480;
    const r2W = 380;
    const r2Y = 640;
    this.drawOrganicRect(g, r2X, r2Y, r2W, h - 50 - r2Y, 1110, kFlip, '#110e0c', '#18120e', 4.5, 6.0);
    this.drawOrganicRect(g, r2X - 10, r2Y - 15, r2W + 15, 20, 1112, kFlip, '#110e0c', '#2c1e15', 3.8, 3.0);
    // Green Copper Mansard Stepped Setback
    this.drawOrganicRect(g, r2X + 60, r2Y - 65, 180, 52, 1115, kFlip, '#110e0c', '#065f46', 3.5, 2.0);
    // Radio Spire Antenna with Flashing Red Beacon
    const antX = r2X + 150;
    this.strokeOrganicLine(g, antX, r2Y - 65, antX, r2Y - 180, 1120, kFlip, '#110e0c', 3.8, 0.0);
    this.strokeOrganicLine(g, antX - 16, r2Y - 120, antX + 16, r2Y - 120, 1122, kFlip, '#110e0c', 2.2, 0.0);
    this.strokeOrganicLine(g, antX - 10, r2Y - 155, antX + 10, r2Y - 155, 1123, kFlip, '#110e0c', 2.2, 0.0);
    // Blinking red beacon
    const antBlink = Math.sin(t * 8.0) > 0;
    g.fillStyle = antBlink ? '#ef4444' : '#7f1d1d';
    g.beginPath();
    g.arc(antX, r2Y - 180, 6, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, antX, r2Y - 180, 6, 0, Math.PI * 2, 1125, kFlip, '#110e0c', 2.4, true);

    // Impact Dust Cloud generator
    const drawRooftopDust = (dx: number, dy: number, dt: number) => {
      if (dt >= 0 && dt < 0.65) {
        const dScale = dt / 0.65;
        const dAlpha = (1.0 - dScale) * 0.7;
        g.save();
        g.fillStyle = `rgba(110, 90, 75, ${dAlpha})`;
        for (let p = 0; p < 6; p++) {
          const side = p % 2 === 0 ? 1 : -1;
          const px = dx + side * (16 + p * 12 * dScale);
          const py = dy - 4 - Math.sin(dScale * Math.PI) * 12;
          const pr = 6 + p * 3 * dScale;
          g.beginPath();
          g.arc(px, py, pr, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
    };
    drawRooftopDust(780, p1Y - 28, t - 53.6);
    drawRooftopDust(1200, p2Y - 28, t - 57.2);
    drawRooftopDust(1500, r2Y - 15, t - 59.8);

    // 6. CINEMATIC PARKOUR CHARACTER CHOREOGRAPHY (Continuous C0 Trajectory)
    let charX = 120;
    let charY = r1Y - 15;
    let charMode: 'sprint' | 'jump' | 'roll' | 'triumph' = 'sprint';
    let jumpProgress = 0;

    if (t < 51.5) {
      // Stage 1: Full-tilt sprint across Rooftop 1 towards ledge
      const uSprint = (t - 47.5) / 4.0;
      charX = 120 + uSprint * 400;
      charY = r1Y - 15;
      charMode = 'sprint';
    } else if (t < 53.6) {
      // Stage 2: Leap 1 across Alley Abyss onto "DO OR DIE"
      jumpProgress = (t - 51.5) / 2.1;
      charX = 520 + jumpProgress * (780 - 520);
      charY = (r1Y - 15) + jumpProgress * ((p1Y - 28) - (r1Y - 15)) - Math.sin(jumpProgress * Math.PI) * 160;
      charMode = 'jump';
    } else if (t < 55.2) {
      // Stage 3: Sprint across "DO OR DIE" girder to launch edge
      const u = (t - 53.6) / 1.6;
      charX = 780 + u * 140;
      charY = p1Y - 28;
      charMode = 'sprint';
    } else if (t < 57.2) {
      // Stage 4: Leap 2 across Chasm onto "HOLD ONTO ME" (Mid-Air Hand Clasp)
      jumpProgress = (t - 55.2) / 2.0;
      charX = 920 + jumpProgress * (1200 - 920);
      charY = (p1Y - 28) + jumpProgress * ((p2Y - 28) - (p1Y - 28)) - Math.sin(jumpProgress * Math.PI) * 170;
      charMode = 'jump';
    } else if (t < 58.4) {
      // Stage 5: Sprint across "HOLD ONTO ME" catwalk to vault ledge
      const u = (t - 57.2) / 1.2;
      charX = 1200 + u * 140;
      charY = p2Y - 28;
      charMode = 'sprint';
    } else if (t < 59.8) {
      // Stage 6: High Vault onto Rooftop 2
      jumpProgress = (t - 58.4) / 1.4;
      charX = 1340 + jumpProgress * (1500 - 1340);
      charY = (p2Y - 28) + jumpProgress * ((r2Y - 15) - (p2Y - 28)) - Math.sin(jumpProgress * Math.PI) * 150;
      charMode = 'jump';
    } else if (t < 61.0) {
      // Stage 7: Fluid Combat Roll Recovery upon Landing on Rooftop 2
      const uRoll = (t - 59.8) / 1.2;
      charX = 1500 + uRoll * 110;
      charY = r2Y - 15;
      charMode = 'roll';
      jumpProgress = uRoll;
    } else if (t < 62.2) {
      // Stage 8: Sprint to far parapet of Rooftop 2
      const uSprint2 = (t - 61.0) / 1.2;
      charX = 1610 + uSprint2 * 120;
      charY = r2Y - 15;
      charMode = 'sprint';
    } else {
      // Stage 9: Victorious Heroic Stance at far parapet
      charX = 1730;
      charY = r2Y - 15;
      charMode = 'triumph';
    }

    // Render Both Hand-Drawn Characters in Tight Tandem Partnership
    this.drawVolumetricCharacterA(g, charX + 36, charY, t, kFlip, charMode, true, jumpProgress);
    this.drawVolumetricCharacterB(g, charX - 36, charY, t, kFlip, charMode, true, jumpProgress);

    // Interlocked Clasped Hands
    if (charMode !== 'roll') {
      const claspY = charMode === 'triumph' ? charY - 110 : charY - 78;
      this.drawOrganicClaspedHands(g, charX, claspY, kFlip, t);
    }
  }

  // =========================================================================
  // CHAPTER 4: OPEN HORIZON, RADIANT SUN & THE FIN STAMP (63.5s - 77.0s)
  // (Zero tech-demo headers: pure visual storytelling)
  // =========================================================================
  private drawChapter4_EndlessHorizonAndFinStamp(
    g: CanvasRenderingContext2D,
    t: number,
    kFlip: number,
    w: number,
    h: number,
    rms: number,
    kick: number
  ) {
    const u = Math.min(1.0, Math.max(0.0, (t - 63.5) / 13.5));

    // RADIANT GOLDEN SUN WITH HAND-DRAWN INK RAYS
    const sunX = w / 2, sunY = 460;
    const sunR = 150 + Math.sin(t * 3.0) * 12;

    // Outer Radiating Sun Rays (36 Hand-drawn ink rays)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
      const rayLen = 240 + this.hash(a * 43, kFlip) * 100;
      const x1 = sunX + Math.cos(a) * (sunR + 18);
      const y1 = sunY + Math.sin(a) * (sunR + 18);
      const x2 = sunX + Math.cos(a) * (sunR + rayLen);
      const y2 = sunY + Math.sin(a) * (sunR + rayLen);
      this.strokeOrganicLine(g, x1, y1, x2, y2, 1300 + Math.floor(a * 10), kFlip, '#eab308', 3.4, 0.0);
    }

    // Inner Glowing Sun Disk
    g.fillStyle = '#fef08a';
    g.beginPath();
    g.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, sunX, sunY, sunR, 0, Math.PI * 2, 1401, kFlip, '#ca8a04', 4.5, true);

    // SOARING SEAGULLS (Japanese woodblock ink wash flight across sunrise sky)
    const seagulls = [
      { startX: 200, y: 220, speed: 65, span: 38, phase: 0.0, scale: 1.1 },
      { startX: 550, y: 160, speed: 78, span: 32, phase: 1.8, scale: 0.95 },
      { startX: 880, y: 290, speed: 58, span: 44, phase: 3.4, scale: 1.25 },
      { startX: 1220, y: 190, speed: 82, span: 30, phase: 0.9, scale: 0.85 },
      { startX: 1480, y: 260, speed: 62, span: 36, phase: 4.2, scale: 1.05 },
      { startX: 1750, y: 340, speed: 70, span: 40, phase: 2.5, scale: 1.15 },
    ];

    seagulls.forEach((gull, gIdx) => {
      // Periodic flight across the sky
      const gx = ((gull.startX + (t - 63.5) * gull.speed) % (w + 200)) - 100;
      // Gentle atmospheric thermal bobbing
      const gy = gull.y + Math.sin(t * 1.8 + gull.phase) * 16;
      // Flapping wing cycle (wing tips bend upwards on downstroke, down on upstroke)
      const flap = Math.sin(t * 5.5 + gull.phase);
      const wingTipY = gy + flap * 14 * gull.scale;

      if (gx > 50 && gx < w - 50) {
        g.save();
        // 2B Graphite guide shadow
        g.strokeStyle = 'rgba(70, 50, 35, 0.25)';
        g.lineWidth = 1.2 * gull.scale;
        g.beginPath();
        g.moveTo(gx - gull.span * gull.scale, wingTipY + 2);
        g.quadraticCurveTo(gx - gull.span * 0.4 * gull.scale, gy - 6 * gull.scale + 2, gx, gy + 2);
        g.quadraticCurveTo(gx + gull.span * 0.4 * gull.scale, gy - 6 * gull.scale + 2, gx + gull.span * gull.scale, wingTipY + 2);
        g.stroke();

        // White/cream body wash plumage
        g.fillStyle = '#fef9c3';
        g.beginPath();
        g.ellipse(gx, gy, 12 * gull.scale, 4.5 * gull.scale, 0.05, 0, Math.PI * 2);
        g.fill();

        // Carbon ink wing stroke
        g.strokeStyle = '#110e0c';
        g.lineWidth = 2.4 * gull.scale;
        g.beginPath();
        g.moveTo(gx - gull.span * gull.scale, wingTipY);
        g.quadraticCurveTo(gx - gull.span * 0.4 * gull.scale, gy - 7 * gull.scale, gx, gy);
        g.quadraticCurveTo(gx + gull.span * 0.4 * gull.scale, gy - 7 * gull.scale, gx + gull.span * gull.scale, wingTipY);
        g.stroke();

        // Wingtip ink feather accents
        g.fillStyle = '#110e0c';
        g.beginPath();
        g.arc(gx - gull.span * gull.scale, wingTipY, 2.0 * gull.scale, 0, Math.PI * 2);
        g.arc(gx + gull.span * gull.scale, wingTipY, 2.0 * gull.scale, 0, Math.PI * 2);
        g.fill();

        g.restore();
      }
    });

    // ENERGETIC JAPANESE WOODBLOCK (UKIYO-E) OCEAN SWELLS & CLAW FOAM HOOKS
    // 3 Solid-filled cascading wave tiers with curling claw foam & etched current contours
    const waveTiers = [
      { baseY: 630, amp: 26, freq: 0.009, speed: 1.8, color: '#172554', foamColor: '#fef08a', strokeColor: '#0f172a', hLimit: 740 },
      { baseY: 710, amp: 38, freq: 0.012, speed: 2.4, color: '#1e3a8a', foamColor: '#fef9c3', strokeColor: '#0f172a', hLimit: 840 },
      { baseY: 790, amp: 46, freq: 0.015, speed: 3.0, color: '#0284c7', foamColor: '#ffffff', strokeColor: '#0f172a', hLimit: 910 },
    ];

    waveTiers.forEach((wt, idx) => {
      // 1. Solid Wave Body Fill
      g.fillStyle = wt.color;
      g.beginPath();
      g.moveTo(70, wt.hLimit);
      g.lineTo(70, wt.baseY);

      for (let x = 70; x <= w - 60; x += 30) {
        const phase = x * wt.freq + t * wt.speed + idx * 1.8;
        // Asymmetric ukiyo-e wave shape: steep crest, sweeping trough
        const sinP = Math.sin(phase);
        const crestCurve = Math.pow(Math.max(0, sinP), 1.8) * wt.amp * 1.4 - Math.max(0, -sinP) * wt.amp * 0.7;
        const wy = wt.baseY - crestCurve;
        g.lineTo(x, wy);
      }

      g.lineTo(w - 60, wt.hLimit);
      g.closePath();
      g.fill();

      // 2. Curving Claw Foam Hooks & Etched Woodblock Current Lines
      for (let x = 80; x <= w - 70; x += 55) {
        const phase = x * wt.freq + t * wt.speed + idx * 1.8;
        const sinP = Math.sin(phase);
        if (sinP > 0.65) {
          const crestCurve = Math.pow(sinP, 1.8) * wt.amp * 1.4;
          const peakX = x;
          const peakY = wt.baseY - crestCurve;

          // Curling Claw Foam Fingers (Like Hokusai's Great Wave)
          g.fillStyle = wt.foamColor;
          g.beginPath();
          g.moveTo(peakX - 25, peakY + 8);
          g.quadraticCurveTo(peakX, peakY - 18, peakX + 22, peakY - 8);
          // Claw hook curling backward
          g.quadraticCurveTo(peakX + 10, peakY - 26, peakX - 6, peakY - 14);
          g.quadraticCurveTo(peakX - 16, peakY - 22, peakX - 22, peakY - 6);
          g.closePath();
          g.fill();

          // Hand-drawn claw contour
          this.strokeOrganicBezier(g, peakX - 25, peakY + 8, peakX, peakY - 18, peakX + 10, peakY - 26, peakX - 6, peakY - 14, 1420 + x, kFlip, wt.strokeColor, 2.6, false);
          this.strokeOrganicBezier(g, peakX - 6, peakY - 14, peakX - 16, peakY - 22, peakX - 20, peakY - 14, peakX - 22, peakY - 6, 1421 + x, kFlip, wt.strokeColor, 2.4, false);

          // Airborne Spindrift Spray Droplets
          for (let sp = 0; sp < 4; sp++) {
            const spx = peakX - 12 - this.hash(sp * 7 + x, kFlip) * 28;
            const spy = peakY - 14 - this.hash(sp * 11 + x, kFlip) * 22;
            g.fillStyle = '#93c5fd';
            g.beginPath();
            g.arc(spx, spy, 2.2, 0, Math.PI * 2);
            g.fill();
          }
        }

        // Etched Woodblock Current Hatch Lines in Troughs
        const troughPhase = x * wt.freq + t * wt.speed + idx * 1.8;
        if (Math.sin(troughPhase) < -0.2) {
          const twy = wt.baseY + 12;
          this.strokeOrganicLine(g, x - 18, twy, x + 24, twy - 4, 1450 + x, kFlip, 'rgba(15, 23, 42, 0.45)', 1.8, 0.0, false);
        }
      }

      // Top Inked Wave Contour Line
      g.strokeStyle = wt.strokeColor;
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(70, wt.baseY);
      for (let x = 70; x <= w - 60; x += 30) {
        const phase = x * wt.freq + t * wt.speed + idx * 1.8;
        const sinP = Math.sin(phase);
        const crestCurve = Math.pow(Math.max(0, sinP), 1.8) * wt.amp * 1.4 - Math.max(0, -sinP) * wt.amp * 0.7;
        g.lineTo(x, wt.baseY - crestCurve);
      }
      g.stroke();
    });

    // RUGGED COASTAL SEA CLIFF (Rocky crags, vertical fissure hatching & grass tufts)
    const roadY = 920;
    g.fillStyle = '#2d1e16';
    g.beginPath();
    g.moveTo(70, h - 50);
    g.lineTo(70, roadY);
    g.lineTo(w - 60, roadY);
    g.lineTo(w - 60, h - 50);
    g.closePath();
    g.fill();

    // Cliff face rocky texture & vertical fissures
    for (let rx = 100; rx <= w - 80; rx += 85) {
      this.strokeOrganicLine(g, rx, roadY, rx + 14, h - 50, 1520 + rx, kFlip, '#150d09', 3.0, 0.0);
      // Fissure cross-hatching
      for (let f = roadY + 15; f < h - 60; f += 22) {
        this.strokeOrganicLine(g, rx + 2, f, rx + 22, f + 12, 1530 + f, kFlip, 'rgba(21, 13, 9, 0.65)', 1.8, 0.0, false);
      }
    }

    // Coastal Highway Guardrail & Road Surface
    this.strokeOrganicLine(g, 70, roadY, w - 60, roadY, 1501, kFlip, '#110e0c', 5.0, 8.0);
    this.strokeOrganicLine(g, 70, roadY - 14, w - 60, roadY - 14, 1502, kFlip, '#ca8a04', 3.2, 0.0, false);

    // Swaying Coastal Wild Grass Tufts along Cliff Edge & Road Verge
    for (let gr = 85; gr <= w - 75; gr += 38) {
      const grassH = 22 + this.hash(gr * 13, kFlip) * 24;
      const windSway = Math.sin(t * 4.2 + gr * 0.08) * 14;
      // 3 Blades per clump
      for (let b = -1; b <= 1; b++) {
        const bx = gr + b * 6;
        const bCurve = windSway + b * 5;
        this.strokeOrganicBezier(
          g,
          bx, roadY,
          bx + bCurve * 0.4, roadY - grassH * 0.5,
          bx + bCurve * 0.8, roadY - grassH * 0.85,
          bx + bCurve, roadY - grassH,
          1550 + gr * 3 + b, kFlip,
          b === 0 ? '#4d7c0f' : '#65a30d',
          2.0, false
        );
      }
    }

    // Convertible Roadster driving peacefully into the sunrise
    const carX = 400 + u * 1240;
    this.drawHandGetawayRoadster(g, carX, roadY - 55, kFlip, t, rms, true);

    // =======================================================================
    // FINAL CLIMACTIC ORNATE WAX SEAL / INK STAMP (t >= 74.0s)
    // =======================================================================
    if (t >= 74.0) {
      const stampU = Math.min(1.0, (t - 74.0) / 0.55);
      const stampScale = 1.0 + Math.exp(-stampU * 8.0) * Math.sin(stampU * 16.0) * 0.65;

      g.save();
      g.translate(w / 2, 480);
      g.scale(stampScale, stampScale);

      // Deep Imperial Red Stamp
      g.fillStyle = 'rgba(185, 28, 28, 0.96)';
      g.beginPath();
      g.arc(0, 0, 190, 0, Math.PI * 2);
      g.fill();

      // Scalloped Edge Border
      g.strokeStyle = '#7f1d1d';
      g.lineWidth = 4.5;
      g.beginPath();
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
        const rOuter = 190 + Math.sin(a * 24) * 9;
        const sx = Math.cos(a) * rOuter;
        const sy = Math.sin(a) * rOuter;
        if (a === 0) g.moveTo(sx, sy);
        else g.lineTo(sx, sy);
      }
      g.closePath();
      g.stroke();

      // Inner Gold Ring
      this.strokeOrganicArc(g, 0, 0, 162, 0, Math.PI * 2, 1601, kFlip, '#fef08a', 3.5, true);

      // Gold Embossed Typography
      g.fillStyle = '#fef08a';
      g.textAlign = 'center';
      g.font = 'bold 40px Georgia, serif';
      g.fillText('NO TAKEBACKS', 0, -28);

      g.font = 'bold 22px Georgia, serif';
      g.fillText('FORREST NOLAN', 0, 20);

      g.font = 'italic 26px Georgia, serif';
      g.fillText('— FIN —', 0, 72);

      g.restore();
    }
  }

  // =========================================================================
  // VOLUMETRIC HAND-DRAWN CHARACTER ENGINES (Height ~185px)
  // =========================================================================

  // Analytical 2-Bone Inverse Kinematics Solver (Continuous C-inf closed-form)
  private solve2BoneIK(
    rootX: number,
    rootY: number,
    targetX: number,
    targetY: number,
    len1: number,
    len2: number,
    bendPositive: boolean
  ): { midX: number; midY: number } {
    const dx = targetX - rootX;
    const dy = targetY - rootY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.max(12, Math.min(dist, len1 + len2 - 2.0));
    const baseAngle = Math.atan2(dy, dx);

    const cosAngle = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));
    const internalAngle = Math.acos(clampedCos);

    const jointAngle = baseAngle + (bendPositive ? -internalAngle : internalAngle);
    return {
      midX: rootX + Math.cos(jointAngle) * len1,
      midY: rootY + Math.sin(jointAngle) * len1,
    };
  }

  // Authentic hand-drawn interlocked clasped hands (Dynamic tension lag)
  private drawOrganicClaspedHands(
    g: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    kFlip: number,
    t = 0
  ) {
    g.save();
    g.translate(cx, cy);
    g.scale(1.3, 1.3);
    const tensionBob = Math.sin(t * 18.0) * 1.5;
    const posY = tensionBob;

    // 2B graphite search oval & action lines
    g.strokeStyle = 'rgba(65, 50, 36, 0.28)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(0, posY, 16, 12, 0, 0, Math.PI * 2);
    g.stroke();

    // Character B's leather glove cuff & palm entering from LEFT (-X)
    g.fillStyle = '#78350f';
    g.beginPath();
    g.ellipse(-7, posY, 11, 8, -0.2, 0, Math.PI * 2);
    g.fill();

    // Character A's reaching wrist (warm skin tone) entering from RIGHT (+X)
    g.fillStyle = '#fed7aa';
    g.beginPath();
    g.ellipse(7, posY, 10, 7, 0.2, 0, Math.PI * 2);
    g.fill();

    // Inked finger contours & interlocking clasp
    this.strokeOrganicArc(g, 0, posY - 2, 7.5, 0, Math.PI * 2, 7001, kFlip, '#110e0c', 3.6, false);
    this.strokeOrganicLine(g, -14, posY - 3, 4, posY - 3, 7002, kFlip, '#110e0c', 3.2, 0.0);
    this.strokeOrganicLine(g, -4, posY + 3, 14, posY + 3, 7003, kFlip, '#110e0c', 3.2, 0.0);
    // Knuckle hatch tick marks
    this.strokeOrganicLine(g, -3, posY - 6, -1, posY + 6, 7004, kFlip, '#110e0c', 2.2, 0.0);
    g.restore();
  }

  // CHARACTER A: The Firebrand (Fully articulated skeletal runner, traveling wave scarf, anime volume)
  private drawVolumetricCharacterA(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    kFlip: number,
    mode: 'sprint' | 'jump' | 'safecrack' | 'recoil' | 'car_stand' | 'car_passenger' | 'triumph' | 'roll' = 'sprint',
    facingRight = true,
    jumpProgress = 0,
    recoilProgress = 0
  ) {
    g.save();
    g.translate(x, y);
    g.scale(facingRight ? 1.3 : -1.3, 1.3);

    // Continuous timeline kinematics
    const strideFreq = 2.4; // 2.4 Hz sprint cycle
    const phi = (t * strideFreq) % 1.0;

    let bodyBob = 0;
    let torsoLean = 0.28;
    let scaleX = 1.0;
    let scaleY = 1.0;

    // Joint Targets (Foot / Ankle positions relative to character root)
    let leadFootX = 0, leadFootY = 0, leadFootAngle = 0;
    let rearFootX = 0, rearFootY = 0, rearFootAngle = 0;
    let leadArmAngle = 0, rearArmAngle = 0;

    // Standard standing hip height is -80px (for 160px tall character)
    let hipBaseY = -80;

    if (mode === 'sprint') {
      // Natural 2-beat body bob per stride cycle (squash on plant, rise on drive)
      bodyBob = Math.sin(phi * Math.PI * 4.0) * 6.5;
      const isSquash = Math.sin(phi * Math.PI * 4.0) > 0.3;
      scaleX = isSquash ? 1.04 : 0.97;
      scaleY = isSquash ? 0.96 : 1.03;
      torsoLean = 0.30 + Math.sin(phi * Math.PI * 2.0) * 0.05;

      // Leg 1 (Phase phi): Stance (plant & drive) vs Swing (high-knee arc)
      const p1 = phi;
      if (p1 < 0.5) {
        const u = p1 / 0.5;
        leadFootX = 36 - u * 76;
        leadFootY = 0;
        leadFootAngle = -0.15 + u * 0.45;
      } else {
        const u = (p1 - 0.5) / 0.5;
        leadFootX = -40 + Math.sin(u * Math.PI * 0.5) * 76;
        leadFootY = -Math.sin(u * Math.PI) * 32.0;
        leadFootAngle = 0.30 - u * 0.45;
      }

      // Leg 2 (Phase phi + 0.5)
      const p2 = (phi + 0.5) % 1.0;
      if (p2 < 0.5) {
        const u = p2 / 0.5;
        rearFootX = 36 - u * 76;
        rearFootY = 0;
        rearFootAngle = -0.15 + u * 0.45;
      } else {
        const u = (p2 - 0.5) / 0.5;
        rearFootX = -40 + Math.sin(u * Math.PI * 0.5) * 76;
        rearFootY = -Math.sin(u * Math.PI) * 32.0;
        rearFootAngle = 0.30 - u * 0.45;
      }

      // Arms swing in exact opposition to legs
      leadArmAngle = Math.sin(phi * Math.PI * 2.0) * 0.85;
      rearArmAngle = -Math.sin(phi * Math.PI * 2.0) * 0.85;
    } else if (mode === 'jump') {
      const u = Math.min(1.0, Math.max(0.0, jumpProgress));
      bodyBob = Math.sin(u * Math.PI) * 18.0;
      scaleX = 0.95; scaleY = 1.06;
      torsoLean = 0.30;
      leadFootX = 34; leadFootY = -28; leadFootAngle = -0.25;
      rearFootX = -42; rearFootY = -18; rearFootAngle = 0.35;
      leadArmAngle = 1.0; rearArmAngle = -0.8;
    } else if (mode === 'roll') {
      const u = Math.min(1.0, Math.max(0.0, jumpProgress));
      hipBaseY = -45 - Math.sin(u * Math.PI) * 20.0;
      torsoLean = u * Math.PI * 2.0;
      scaleX = 0.92; scaleY = 0.92;
      leadFootX = 14; leadFootY = -12; leadFootAngle = 0;
      rearFootX = -14; rearFootY = -12; rearFootAngle = 0;
      leadArmAngle = 0; rearArmAngle = 0;
    } else if (mode === 'safecrack') {
      hipBaseY = -52; // Low athletic crouch
      torsoLean = 0.42; // Leaning into dial
      scaleX = 1.05; scaleY = 0.95;
      leadFootX = 28; leadFootY = 0; leadFootAngle = 0.1;
      rearFootX = -28; rearFootY = -2; rearFootAngle = 0.4;
      leadArmAngle = 0.6; rearArmAngle = -0.2;
    } else if (mode === 'recoil') {
      const u = Math.min(1.0, Math.max(0.0, recoilProgress));
      bodyBob = Math.sin(u * Math.PI) * 25.0;
      torsoLean = -0.32; // Blown backward
      scaleX = 1.06; scaleY = 0.94;
      leadFootX = -36; leadFootY = -26; leadFootAngle = -0.4;
      rearFootX = -18; rearFootY = -16; rearFootAngle = -0.2;
      leadArmAngle = -1.2; rearArmAngle = -1.3;
    } else if (mode === 'car_passenger') {
      hipBaseY = -28;
      bodyBob = Math.sin(t * 22.0) * 2.5;
      torsoLean = 0.14;
      leadFootX = 18; leadFootY = 22; leadFootAngle = 0.1;
      rearFootX = -12; rearFootY = 22; rearFootAngle = 0;
      leadArmAngle = 0.9; rearArmAngle = 1.35; // One hand on windshield rim, other holding money sack up!
    } else if (mode === 'car_stand') {
      hipBaseY = -48;
      bodyBob = Math.sin(t * 22.0) * 3.5;
      torsoLean = 0.22;
      leadFootX = 22; leadFootY = 20; leadFootAngle = 0;
      rearFootX = -18; rearFootY = 20; rearFootAngle = 0;
      leadArmAngle = 1.1; rearArmAngle = 1.35;
    } else if (mode === 'triumph') {
      hipBaseY = -80;
      bodyBob = 0;
      torsoLean = 0.04;
      leadFootX = 24; leadFootY = 0; leadFootAngle = 0.1;
      rearFootX = -24; rearFootY = 0; rearFootAngle = -0.1;
      leadArmAngle = 1.35; rearArmAngle = 1.35;
    }

    const hipX = 0;
    const hipY = hipBaseY - bodyBob;
    const shoulderX = hipX + Math.sin(torsoLean) * 44;
    const shoulderY = hipY - Math.cos(torsoLean) * 44;
    const headX = shoulderX + Math.sin(torsoLean * 0.7) * 20;
    const headY = shoulderY - Math.cos(torsoLean * 0.7) * 20;

    // 1. FAINT 2B GRAPHITE / COL-ERASE GESTURE UNDER-DRAWINGS
    g.save();
    g.strokeStyle = 'rgba(50, 75, 120, 0.22)';
    g.lineWidth = 1.4;
    // Line of action spine
    g.beginPath();
    g.moveTo(headX, headY);
    g.quadraticCurveTo(shoulderX, shoulderY, hipX, hipY);
    g.stroke();
    // Pelvis & chest construction ovals
    g.beginPath();
    g.ellipse(hipX, hipY, 20 * scaleX, 18 * scaleY, torsoLean, 0, Math.PI * 2);
    g.ellipse(shoulderX, shoulderY, 22 * scaleX, 24 * scaleY, torsoLean, 0, Math.PI * 2);
    g.ellipse(headX, headY, 18, 22, torsoLean * 0.5, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 2. ARTICULATED 2-BONE IK LEGS (Hip -> Knee -> Ankle -> Boot)
    const legL1 = 44, legL2 = 42;

    // REAR LEG (Rendered behind body)
    const rKnee = this.solve2BoneIK(hipX - 6, hipY, rearFootX, rearFootY, legL1, legL2, true);
    this.drawAnatomicalLimb(g, hipX - 6, hipY, rKnee.midX, rKnee.midY, 19, 14, 2310, kFlip, '#1e293b', '#110e0c', true, 3);
    this.drawAnatomicalLimb(g, rKnee.midX, rKnee.midY, rearFootX, rearFootY, 14, 10, 2312, kFlip, '#1e293b', '#110e0c', true, -3);
    this.drawHandDrawnBoot(g, rearFootX, rearFootY, rearFootAngle, 1.0, 2314, kFlip, '#1c1917', '#110e0c', true);

    // 3. VOLUMETRIC TORSO & ATHLETIC PUNK VEST
    g.save();
    g.translate(hipX, hipY);
    g.rotate(torsoLean);
    g.scale(scaleX, scaleY);

    // Inner Cream T-Shirt
    g.fillStyle = '#fef9c3';
    g.beginPath();
    g.moveTo(-16, -44);
    g.lineTo(16, -44);
    g.lineTo(12, 0);
    g.lineTo(-12, 0);
    g.closePath();
    g.fill();

    // Denim Blue Vest Over Shirt
    g.fillStyle = '#2563eb';
    g.beginPath();
    g.moveTo(-18, -44);
    g.lineTo(-6, -44);
    g.lineTo(-4, 0);
    g.lineTo(-14, 0);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(18, -44);
    g.lineTo(6, -44);
    g.lineTo(4, 0);
    g.lineTo(14, 0);
    g.closePath();
    g.fill();

    // Inked Torso Contours & Seams
    this.strokeOrganicLine(g, -18, -44, 18, -44, 2201, kFlip, '#110e0c', 4.0, 1.5);
    this.strokeOrganicLine(g, 18, -44, 14, 0, 2202, kFlip, '#110e0c', 3.8, 1.5);
    this.strokeOrganicLine(g, 14, 0, -14, 0, 2203, kFlip, '#110e0c', 3.6, 1.5);
    this.strokeOrganicLine(g, -14, 0, -18, -44, 2204, kFlip, '#110e0c', 3.8, 1.5);

    // Vest Lapels & Form Cross-Hatching (///)
    this.strokeOrganicLine(g, -16, -44, -5, -14, 2205, kFlip, '#1e3a8a', 3.0, 0.0);
    this.strokeOrganicLine(g, 16, -44, 5, -14, 2206, kFlip, '#1e3a8a', 3.0, 0.0);
    this.strokeOrganicLine(g, -10, -30, -2, -22, 2207, kFlip, 'rgba(15, 23, 42, 0.55)', 2.0, 0.0, false);
    this.strokeOrganicLine(g, -9, -18, 0, -10, 2208, kFlip, 'rgba(15, 23, 42, 0.55)', 2.0, 0.0, false);

    // Belt & Brass Buckle
    this.drawOrganicRect(g, -15, -4, 30, 10, 2210, kFlip, '#110e0c', '#ca8a04', 3.0, 1.5);
    this.drawOrganicRect(g, -6, -2, 12, 6, 2211, kFlip, '#110e0c', '#eab308', 2.0, 0.0);
    g.restore();

    // LEAD LEG (Rendered in front of torso)
    const lKnee = this.solve2BoneIK(hipX + 6, hipY, leadFootX, leadFootY, legL1, legL2, true);
    this.drawAnatomicalLimb(g, hipX + 6, hipY, lKnee.midX, lKnee.midY, 20, 15, 2301, kFlip, '#2563eb', '#110e0c', true, 3);
    this.drawAnatomicalLimb(g, lKnee.midX, lKnee.midY, leadFootX, leadFootY, 15, 11, 2304, kFlip, '#2563eb', '#110e0c', true, -3);
    this.drawHandDrawnBoot(g, leadFootX, leadFootY, leadFootAngle, 1.0, 2306, kFlip, '#1c1917', '#110e0c', true);

    // 4. ARMS, HANDS & MONEY SACK (Natural anatomical kinematics)
    const armL1 = 28, armL2 = 26;
    let rArmTargetX = shoulderX - 28;
    let rArmTargetY = shoulderY + 24;
    let lArmTargetX = shoulderX + 26;
    let lArmTargetY = shoulderY + 12;

    if (mode === 'sprint') {
      // Rear arm reaches back towards clasp with Pilot
      rArmTargetX = shoulderX - 32;
      rArmTargetY = shoulderY + 24;
      // Lead arm holds bulging cash sack proudly in the air!
      lArmTargetX = shoulderX + 24 + Math.sin(phi * Math.PI * 2.0) * 8;
      lArmTargetY = shoulderY - 14 - Math.cos(phi * Math.PI * 2.0) * 8;
    } else if (mode === 'jump') {
      rArmTargetX = shoulderX - 28;
      rArmTargetY = shoulderY + 22;
      lArmTargetX = shoulderX + 26;
      lArmTargetY = shoulderY - 20;
    } else if (mode === 'triumph') {
      rArmTargetX = shoulderX - 16;
      rArmTargetY = shoulderY - 36;
      lArmTargetX = shoulderX + 16;
      lArmTargetY = shoulderY - 36;
    } else if (mode === 'safecrack') {
      rArmTargetX = shoulderX - 12;
      rArmTargetY = shoulderY + 18;
      lArmTargetX = shoulderX + 24;
      lArmTargetY = shoulderY - 4;
    } else if (mode === 'car_passenger' || mode === 'car_stand') {
      rArmTargetX = shoulderX - 22;
      rArmTargetY = shoulderY - 32; // Waving sack in wind
      lArmTargetX = shoulderX + 18;
      lArmTargetY = shoulderY + 12; // Resting on car door / windshield
    }

    const rElbow = this.solve2BoneIK(shoulderX - 8, shoulderY, rArmTargetX, rArmTargetY, armL1, armL2, false);
    this.drawAnatomicalLimb(g, shoulderX - 8, shoulderY, rElbow.midX, rElbow.midY, 15, 12, 2401, kFlip, '#fed7aa', '#110e0c', false, 2);
    this.drawAnatomicalLimb(g, rElbow.midX, rElbow.midY, rArmTargetX, rArmTargetY, 12, 9, 2403, kFlip, '#fed7aa', '#110e0c', false, 1);
    this.drawHandDrawnHand(g, rArmTargetX, rArmTargetY, -0.4, 2404, kFlip, '#fed7aa');

    const lElbow = this.solve2BoneIK(shoulderX + 8, shoulderY, lArmTargetX, lArmTargetY, armL1, armL2, true);
    this.drawAnatomicalLimb(g, shoulderX + 8, shoulderY, lElbow.midX, lElbow.midY, 15, 12, 2405, kFlip, '#fed7aa', '#110e0c', false, 2);
    this.drawAnatomicalLimb(g, lElbow.midX, lElbow.midY, lArmTargetX, lArmTargetY, 12, 9, 2407, kFlip, '#fed7aa', '#110e0c', false, 1);
    this.drawHandDrawnHand(g, lArmTargetX, lArmTargetY, 0.6, 2409, kFlip, '#fed7aa');

    // Bulging Cash Sack in Lead Hand
    if (mode === 'sprint' || mode === 'jump' || mode === 'car_stand' || mode === 'car_passenger' || mode === 'triumph') {
      const sackX = mode === 'car_passenger' || mode === 'car_stand' ? rArmTargetX : lArmTargetX + 6;
      const sackY = mode === 'triumph' ? lArmTargetY - 24 : (mode === 'car_passenger' || mode === 'car_stand' ? rArmTargetY - 18 : lArmTargetY + 6);
      this.strokeOrganicArc(g, sackX, sackY, 22, 0, Math.PI * 2, 2505, kFlip, '#110e0c', 3.8, true);
      g.fillStyle = '#3e2719';
      g.beginPath();
      g.arc(sackX, sackY, 21, 0, Math.PI * 2);
      g.fill();
      this.drawOrganicRect(g, sackX - 6, sackY - 26, 12, 8, 2507, kFlip, '#110e0c', '#78350f', 2.4, 0.0);
      g.fillStyle = '#fef08a';
      g.font = 'bold 20px Georgia, serif';
      g.textAlign = 'center';
      g.fillText('$', sackX, sackY + 7);
    }

    // 5. ANATOMICAL HEAD & EXPRESSIVE MANGA FACE
    g.save();
    g.translate(headX, headY);
    g.rotate(torsoLean * 0.35);

    // Cranial Mass & Jawline with Warm Skin Wash
    g.fillStyle = '#fed7aa';
    g.beginPath();
    g.moveTo(-12, -14);
    g.quadraticCurveTo(0, -26, 14, -14);
    g.quadraticCurveTo(20, 0, 16, 10);
    g.lineTo(8, 20); // Chin
    g.lineTo(-4, 16);
    g.quadraticCurveTo(-16, 8, -16, -4);
    g.closePath();
    g.fill();

    // Inked Head Contour
    this.strokeOrganicLine(g, -12, -14, 0, -25, 2001, kFlip, '#110e0c', 3.4, 1.5);
    this.strokeOrganicLine(g, 0, -25, 14, -14, 2002, kFlip, '#110e0c', 3.4, 1.5);
    this.strokeOrganicLine(g, 14, -14, 16, 10, 2003, kFlip, '#110e0c', 3.2, 1.5);
    this.strokeOrganicLine(g, 16, 10, 8, 20, 2004, kFlip, '#110e0c', 3.4, 1.5);
    this.strokeOrganicLine(g, 8, 20, -4, 16, 2005, kFlip, '#110e0c', 3.0, 1.5);
    this.strokeOrganicLine(g, -4, 16, -16, -4, 2006, kFlip, '#110e0c', 3.2, 1.5);

    // Expressive Manga Eye with Specular Gleam
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(9, -3, 6, 7, 0.1, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicLine(g, 3, -9, 16, -5, 2010, kFlip, '#110e0c', 3.8, 0.0);
    g.fillStyle = '#110e0c';
    g.beginPath();
    g.arc(10, -2, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(12, -4, 1.5, 0, Math.PI * 2);
    g.fill();

    // Shouting / Grinning Open Mouth with White Teeth Strip
    g.fillStyle = '#7f1d1d';
    g.beginPath();
    g.moveTo(5, 7);
    g.quadraticCurveTo(15, 8, 14, 16);
    g.quadraticCurveTo(8, 18, 5, 12);
    g.closePath();
    g.fill();
    g.fillStyle = '#f8fafc';
    g.fillRect(6, 7, 6, 2.5);
    this.strokeOrganicLine(g, 5, 7, 15, 8, 2016, kFlip, '#110e0c', 2.6, 0.0);

    // 6. PROPORTIONAL SWEPT-BACK ANIME HAIR CLUMPS (Windswept Spikes)
    g.fillStyle = '#18120e';
    g.beginPath();
    g.moveTo(4, -10);
    g.quadraticCurveTo(14, -12, 18, -6);
    g.quadraticCurveTo(15, -16, 12, -22);
    g.quadraticCurveTo(24, -34, 32, -42); // Front swept spike
    g.quadraticCurveTo(22, -36, 14, -30);
    g.quadraticCurveTo(16, -48, 8, -54);  // Top center spike
    g.quadraticCurveTo(2, -44, -4, -34);
    g.quadraticCurveTo(-14, -48, -24, -44); // Rear high spike
    g.quadraticCurveTo(-18, -36, -12, -28);
    g.quadraticCurveTo(-26, -34, -32, -26); // Rear low spike
    g.quadraticCurveTo(-22, -20, -14, -14);
    g.closePath();
    g.fill();

    this.strokeOrganicBezier(g, 12, -22, 24, -34, 28, -38, 32, -42, 2050, kFlip, '#110e0c', 3.2);
    this.strokeOrganicBezier(g, 14, -30, 16, -48, 12, -52, 8, -54, 2051, kFlip, '#110e0c', 3.2);
    this.strokeOrganicBezier(g, -4, -34, -14, -48, -20, -46, -24, -44, 2052, kFlip, '#110e0c', 3.2);
    this.strokeOrganicBezier(g, -12, -28, -26, -34, -30, -30, -32, -26, 2053, kFlip, '#110e0c', 3.2);

    // Hair Sheen Highlights
    g.strokeStyle = 'rgba(255, 245, 230, 0.45)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(14, -32); g.lineTo(24, -38);
    g.moveTo(6, -40); g.lineTo(8, -48);
    g.stroke();
    g.restore();

    // Stethoscope tubing for safecrack mode
    if (mode === 'safecrack') {
      this.strokeOrganicBezier(g, headX, headY, headX + 25, headY + 15, headX + 45, headY + 35, headX + 65, headY + 30, 2090, kFlip, '#0f172a', 2.8, false);
      this.strokeOrganicArc(g, headX + 65, headY + 30, 5, 0, Math.PI * 2, 2092, kFlip, '#cbd5e1', 2.6, true);
    }

    // 7. 3D FLOWING CRIMSON CLOTH SCARF (Traveling-Wave Aerodynamics)
    const neckX = shoulderX;
    const neckY = shoulderY - 8;

    // Cowl Neck Wrap
    g.fillStyle = '#991b1b';
    g.beginPath();
    g.ellipse(neckX, neckY, 18, 10, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.ellipse(neckX, neckY - 2, 17, 9, -0.05, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, neckX, neckY - 2, 17, 0, Math.PI * 2, 2080, kFlip, '#110e0c', 3.0, true);

    // Continuous Traveling Wave along 8 Nodes (Elevated upward to stream high above trailing character)
    const numNodes = 8;
    const scarfLen = (mode === 'car_passenger' || mode === 'car_stand') ? 175 : (mode === 'sprint' ? 145 : 120);
    const nodes: { x: number; y: number; w: number }[] = [];

    for (let i = 0; i <= numNodes; i++) {
      const s = i / numNodes;
      const wavePhase = t * 24.0 - s * 6.5;
      const microPhase = t * 44.0 - s * 13.0;
      const waveY = Math.sin(wavePhase) * (s * 20.0) + Math.sin(microPhase) * (s * s * 8.0);
      const nx = neckX - s * scarfLen;
      const ny = neckY - s * 38.0 + waveY; // Sweeps upward and back into the sky
      const nw = 14.0 * (1.0 - s * 0.45);
      nodes.push({ x: nx, y: ny, w: nw });
    }

    // Scarf Body Ribbon
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.moveTo(nodes[0]!.x, nodes[0]!.y - nodes[0]!.w * 0.5);
    for (let i = 1; i <= numNodes; i++) {
      g.lineTo(nodes[i]!.x, nodes[i]!.y - nodes[i]!.w * 0.5);
    }
    for (let i = numNodes; i >= 0; i--) {
      g.lineTo(nodes[i]!.x, nodes[i]!.y + nodes[i]!.w * 0.5);
    }
    g.closePath();
    g.fill();

    // Fold Shadow Under-Ribbon
    for (let i = 0; i < numNodes; i++) {
      const isDip = Math.sin(t * 22.0 - (i / numNodes) * 6.5) < -0.25;
      if (isDip) {
        g.fillStyle = '#881337';
        g.beginPath();
        g.moveTo(nodes[i]!.x, nodes[i]!.y - nodes[i]!.w * 0.5);
        g.lineTo(nodes[i + 1]!.x, nodes[i + 1]!.y - nodes[i + 1]!.w * 0.5);
        g.lineTo(nodes[i + 1]!.x, nodes[i + 1]!.y + nodes[i + 1]!.w * 0.5);
        g.lineTo(nodes[i]!.x, nodes[i]!.y + nodes[i]!.w * 0.5);
        g.closePath();
        g.fill();
      }

      this.strokeOrganicLine(
        g,
        nodes[i]!.x,
        nodes[i]!.y - nodes[i]!.w * 0.5,
        nodes[i + 1]!.x,
        nodes[i + 1]!.y - nodes[i + 1]!.w * 0.5,
        2601 + i,
        kFlip,
        '#7f1d1d',
        2.6,
        0.0,
        false
      );
      this.strokeOrganicLine(
        g,
        nodes[i]!.x,
        nodes[i]!.y + nodes[i]!.w * 0.5,
        nodes[i + 1]!.x,
        nodes[i + 1]!.y + nodes[i + 1]!.w * 0.5,
        2610 + i,
        kFlip,
        '#7f1d1d',
        2.6,
        0.0,
        false
      );
    }

    // Frayed Tassel Whiskers
    const tailNode = nodes[numNodes]!;
    for (let th = 0; th < 4; th++) {
      const thx = tailNode.x - 10 - this.hash(th * 7, kFlip) * 16;
      const thy = tailNode.y - 4 + th * 3 + (this.hash(th * 11, kFlip) - 0.5) * 8;
      this.strokeOrganicLine(g, tailNode.x, tailNode.y - 4 + th * 2.5, thx, thy, 2640 + th, kFlip, '#ef4444', 1.8, 0.0, false);
    }

    g.restore();
  }

  // CHARACTER B: The Pilot (Articulated kinematics, leather bomber jacket, newsboy cap with shaded visor)
  private drawVolumetricCharacterB(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    kFlip: number,
    mode: 'sprint' | 'jump' | 'safecrack' | 'recoil' | 'car_drive' | 'triumph' | 'roll' = 'sprint',
    facingRight = true,
    jumpProgress = 0,
    recoilProgress = 0
  ) {
    g.save();
    g.translate(x, y);
    g.scale(facingRight ? 1.3 : -1.3, 1.3);

    const strideFreq = 2.4;
    // Offset phase by 0.5 for natural running partnership
    const phi = (t * strideFreq + 0.5) % 1.0;

    let bodyBob = 0;
    let torsoLean = 0.26;
    let scaleX = 1.0;
    let scaleY = 1.0;

    let leadFootX = 0, leadFootY = 0, leadFootAngle = 0;
    let rearFootX = 0, rearFootY = 0, rearFootAngle = 0;
    let leadArmAngle = 0, rearArmAngle = 0;

    let hipBaseY = -80;

    if (mode === 'sprint') {
      bodyBob = Math.sin(phi * Math.PI * 4.0) * 6.5;
      const isSquash = Math.sin(phi * Math.PI * 4.0) > 0.3;
      scaleX = isSquash ? 1.04 : 0.97;
      scaleY = isSquash ? 0.96 : 1.03;
      torsoLean = 0.28 + Math.sin(phi * Math.PI * 2.0) * 0.05;

      const p1 = phi;
      if (p1 < 0.5) {
        const u = p1 / 0.5;
        leadFootX = 36 - u * 76;
        leadFootY = 0;
        leadFootAngle = -0.15 + u * 0.45;
      } else {
        const u = (p1 - 0.5) / 0.5;
        leadFootX = -40 + Math.sin(u * Math.PI * 0.5) * 76;
        leadFootY = -Math.sin(u * Math.PI) * 32.0;
        leadFootAngle = 0.30 - u * 0.45;
      }

      const p2 = (phi + 0.5) % 1.0;
      if (p2 < 0.5) {
        const u = p2 / 0.5;
        rearFootX = 36 - u * 76;
        rearFootY = 0;
        rearFootAngle = -0.15 + u * 0.45;
      } else {
        const u = (p2 - 0.5) / 0.5;
        rearFootX = -40 + Math.sin(u * Math.PI * 0.5) * 76;
        rearFootY = -Math.sin(u * Math.PI) * 32.0;
        rearFootAngle = 0.30 - u * 0.45;
      }

      leadArmAngle = Math.sin(phi * Math.PI * 2.0) * 0.85;
      rearArmAngle = -Math.sin(phi * Math.PI * 2.0) * 0.85;
    } else if (mode === 'jump') {
      const u = Math.min(1.0, Math.max(0.0, jumpProgress));
      bodyBob = Math.sin(u * Math.PI) * 18.0;
      scaleX = 0.95; scaleY = 1.06;
      torsoLean = 0.28;
      leadFootX = 34; leadFootY = -24; leadFootAngle = -0.25;
      rearFootX = -42; rearFootY = -15; rearFootAngle = 0.35;
      leadArmAngle = 0.9; rearArmAngle = -0.7;
    } else if (mode === 'roll') {
      const u = Math.min(1.0, Math.max(0.0, jumpProgress));
      hipBaseY = -45 - Math.sin(u * Math.PI) * 20.0;
      torsoLean = u * Math.PI * 2.0;
      scaleX = 0.92; scaleY = 0.92;
      leadFootX = 14; leadFootY = -12; leadFootAngle = 0;
      rearFootX = -14; rearFootY = -12; rearFootAngle = 0;
      leadArmAngle = 0; rearArmAngle = 0;
    } else if (mode === 'safecrack') {
      hipBaseY = -80; // Standing alert guard
      bodyBob = 0;
      torsoLean = 0.12;
      leadFootX = 18; leadFootY = 0; leadFootAngle = 0.05;
      rearFootX = -18; rearFootY = 0; rearFootAngle = -0.05;
      leadArmAngle = 0.8; rearArmAngle = 0.5; // Holding flashlight beam
    } else if (mode === 'recoil') {
      const u = Math.min(1.0, Math.max(0.0, recoilProgress));
      bodyBob = Math.sin(u * Math.PI) * 25.0;
      torsoLean = -0.28;
      scaleX = 1.06; scaleY = 0.94;
      leadFootX = -32; leadFootY = -22; leadFootAngle = -0.35;
      rearFootX = -16; rearFootY = -14; rearFootAngle = -0.15;
      leadArmAngle = -1.1; rearArmAngle = -1.2;
    } else if (mode === 'car_drive') {
      hipBaseY = -28;
      bodyBob = Math.sin(t * 22.0) * 2.5;
      torsoLean = 0.16;
      leadFootX = 20; leadFootY = 22; leadFootAngle = 0.1;
      rearFootX = -10; rearFootY = 22; rearFootAngle = 0;
      leadArmAngle = 0.65; rearArmAngle = 0.45; // Hands on steering wheel
    } else if (mode === 'triumph') {
      hipBaseY = -80;
      bodyBob = 0;
      torsoLean = 0.04;
      leadFootX = 22; leadFootY = 0; leadFootAngle = 0.1;
      rearFootX = -22; rearFootY = 0; rearFootAngle = -0.1;
      leadArmAngle = 1.35; rearArmAngle = 1.35;
    }

    const hipX = 0;
    const hipY = hipBaseY - bodyBob;
    const shoulderX = hipX + Math.sin(torsoLean) * 44;
    const shoulderY = hipY - Math.cos(torsoLean) * 44;
    const headX = shoulderX + Math.sin(torsoLean * 0.7) * 20;
    const headY = shoulderY - Math.cos(torsoLean * 0.7) * 20;

    // 1. FAINT 2B GRAPHITE GESTURE UNDER-DRAWINGS
    g.save();
    g.strokeStyle = 'rgba(65, 50, 36, 0.22)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(headX, headY);
    g.quadraticCurveTo(shoulderX, shoulderY, hipX, hipY);
    g.stroke();
    g.beginPath();
    g.ellipse(hipX, hipY, 22 * scaleX, 18 * scaleY, torsoLean, 0, Math.PI * 2);
    g.ellipse(shoulderX, shoulderY, 24 * scaleX, 26 * scaleY, torsoLean, 0, Math.PI * 2);
    g.ellipse(headX, headY, 19, 22, torsoLean * 0.5, 0, Math.PI * 2);
    g.stroke();
    g.restore();

    // 2. ARTICULATED 2-BONE IK LEGS
    const legL1 = 44, legL2 = 42;

    // REAR LEG
    const rKnee = this.solve2BoneIK(hipX - 6, hipY, rearFootX, rearFootY, legL1, legL2, true);
    this.drawAnatomicalLimb(g, hipX - 6, hipY, rKnee.midX, rKnee.midY, 18, 14, 3206, kFlip, '#3f3f46', '#110e0c', true, 3);
    this.drawAnatomicalLimb(g, rKnee.midX, rKnee.midY, rearFootX, rearFootY, 14, 10, 3208, kFlip, '#3f3f46', '#110e0c', true, -3);
    this.drawHandDrawnBoot(g, rearFootX, rearFootY, rearFootAngle, 1.0, 3210, kFlip, '#271b12', '#110e0c', false);

    // 3. HEAVY LEATHER BOMBER JACKET
    g.save();
    g.translate(hipX, hipY);
    g.rotate(torsoLean);
    g.scale(scaleX, scaleY);

    g.fillStyle = '#78350f';
    g.beginPath();
    g.moveTo(-20, -44);
    g.lineTo(20, -44);
    g.lineTo(15, 0);
    g.lineTo(-15, 0);
    g.closePath();
    g.fill();

    this.strokeOrganicLine(g, -20, -44, 20, -44, 3101, kFlip, '#110e0c', 4.0, 1.5);
    this.strokeOrganicLine(g, 20, -44, 15, 0, 3102, kFlip, '#110e0c', 3.8, 1.5);
    this.strokeOrganicLine(g, 15, 0, -15, 0, 3103, kFlip, '#110e0c', 3.8, 1.5);
    this.strokeOrganicLine(g, -15, 0, -20, -44, 3104, kFlip, '#110e0c', 4.0, 1.5);

    // Fluffy Shearling Collar Lapels (#fef3c7)
    g.fillStyle = '#fef3c7';
    g.beginPath();
    g.moveTo(-18, -44);
    g.lineTo(-3, -26);
    g.lineTo(-10, -26);
    g.lineTo(-20, -40);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(18, -44);
    g.lineTo(3, -26);
    g.lineTo(10, -26);
    g.lineTo(20, -40);
    g.closePath();
    g.fill();
    this.strokeOrganicLine(g, -18, -44, -3, -26, 3110, kFlip, '#110e0c', 3.0, 0.0);
    this.strokeOrganicLine(g, 18, -44, 3, -26, 3111, kFlip, '#110e0c', 3.0, 0.0);

    // Center Brass Zipper
    this.strokeOrganicLine(g, 0, -26, 0, -3, 3115, kFlip, '#ca8a04', 2.8, 0.0);
    g.restore();

    // LEAD LEG
    const lKnee = this.solve2BoneIK(hipX + 6, hipY, leadFootX, leadFootY, legL1, legL2, true);
    this.drawAnatomicalLimb(g, hipX + 6, hipY, lKnee.midX, lKnee.midY, 19, 15, 3201, kFlip, '#3f3f46', '#110e0c', true, 3);
    this.drawAnatomicalLimb(g, lKnee.midX, lKnee.midY, leadFootX, leadFootY, 15, 11, 3203, kFlip, '#3f3f46', '#110e0c', true, -3);
    this.drawHandDrawnBoot(g, leadFootX, leadFootY, leadFootAngle, 1.0, 3205, kFlip, '#271b12', '#110e0c', false);

    // 4. VOLUMETRIC ARMS & GLOVES (Natural anatomical kinematics)
    const armL1 = 28, armL2 = 26;
    let rArmTargetX = shoulderX - 16;
    let rArmTargetY = shoulderY + 28;
    let lArmTargetX = shoulderX + 28;
    let lArmTargetY = shoulderY + 22;

    if (mode === 'sprint') {
      // Lead arm reaches forward towards clasp with Character A
      lArmTargetX = shoulderX + 32;
      lArmTargetY = shoulderY + 24;
      // Rear arm pumps naturally with downward-diagonal hang and bent elbow
      rArmTargetX = shoulderX - 12 + Math.sin(phi * Math.PI * 2.0) * 16;
      rArmTargetY = shoulderY + 30 - Math.cos(phi * Math.PI * 2.0) * 10;
    } else if (mode === 'jump') {
      lArmTargetX = shoulderX + 28;
      lArmTargetY = shoulderY + 22;
      rArmTargetX = shoulderX - 22;
      rArmTargetY = shoulderY + 28;
    } else if (mode === 'triumph') {
      lArmTargetX = shoulderX + 16;
      lArmTargetY = shoulderY - 36;
      rArmTargetX = shoulderX - 16;
      rArmTargetY = shoulderY - 36;
    } else if (mode === 'safecrack') {
      lArmTargetX = shoulderX + 26;
      lArmTargetY = shoulderY + 10;
      rArmTargetX = shoulderX - 14;
      rArmTargetY = shoulderY + 22;
    } else if (mode === 'car_drive') {
      lArmTargetX = shoulderX + 26;
      lArmTargetY = shoulderY + 16;
      rArmTargetX = shoulderX + 10;
      rArmTargetY = shoulderY + 18;
    }

    const rElbow = this.solve2BoneIK(shoulderX - 8, shoulderY, rArmTargetX, rArmTargetY, armL1, armL2, false);
    this.drawAnatomicalLimb(g, shoulderX - 8, shoulderY, rElbow.midX, rElbow.midY, 17, 14, 3301, kFlip, '#78350f', '#110e0c', true, 2);
    this.drawAnatomicalLimb(g, rElbow.midX, rElbow.midY, rArmTargetX, rArmTargetY, 14, 11, 3303, kFlip, '#78350f', '#110e0c', true, 1);
    this.drawHandDrawnHand(g, rArmTargetX, rArmTargetY, -0.2, 3305, kFlip, '#271b12', true);

    const lElbow = this.solve2BoneIK(shoulderX + 8, shoulderY, lArmTargetX, lArmTargetY, armL1, armL2, true);
    this.drawAnatomicalLimb(g, shoulderX + 8, shoulderY, lElbow.midX, lElbow.midY, 17, 14, 3306, kFlip, '#78350f', '#110e0c', true, 2);
    this.drawAnatomicalLimb(g, lElbow.midX, lElbow.midY, lArmTargetX, lArmTargetY, 14, 11, 3308, kFlip, '#78350f', '#110e0c', true, 1);
    this.drawHandDrawnHand(g, lArmTargetX, lArmTargetY, 0.4, 3310, kFlip, '#271b12', true);

    // Flashlight Beam for safecrack mode
    if (mode === 'safecrack') {
      g.save();
      const flX = lArmTargetX + 6;
      const flY = lArmTargetY;
      this.drawOrganicRect(g, flX - 6, flY - 5, 22, 10, 3340, kFlip, '#110e0c', '#ca8a04', 2.6, 0.0);
      const coneGrad = g.createRadialGradient(flX + 16, flY, 8, flX + 180, flY + 20, 200);
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
      coneGrad.addColorStop(0.8, 'rgba(254, 240, 138, 0.22)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
      g.fillStyle = coneGrad;
      g.beginPath();
      g.moveTo(flX + 16, flY - 5);
      g.lineTo(flX + 190, flY - 70);
      g.lineTo(flX + 210, flY + 80);
      g.lineTo(flX + 16, flY + 5);
      g.closePath();
      g.fill();
      g.restore();
    }

    // Steering Wheel for car drive mode
    if (mode === 'car_drive') {
      g.save();
      g.translate(lArmTargetX + 12, lArmTargetY + 4);
      const steerRot = Math.sin(t * 4.0) * 0.35;
      g.rotate(steerRot);
      this.strokeOrganicArc(g, 0, 0, 22, 0, Math.PI * 2, 3350, kFlip, '#78350f', 4.2, true);
      this.strokeOrganicLine(g, -20, 0, 20, 0, 3352, kFlip, '#cbd5e1', 2.8, 0.0);
      this.strokeOrganicLine(g, 0, 0, 0, 20, 3354, kFlip, '#cbd5e1', 2.8, 0.0);
      g.restore();
    }

    // 5. HEAD, TWEED NEWSBOY CAP & AVIATOR GOGGLES
    g.save();
    g.translate(headX, headY);
    g.rotate(torsoLean * 0.3);

    // Warm Skin Wash & Comic Jawline
    g.fillStyle = '#fed7aa';
    g.beginPath();
    g.moveTo(-13, -12);
    g.lineTo(13, -12);
    g.lineTo(12, 14);
    g.lineTo(0, 19); // Chin
    g.lineTo(-12, 14);
    g.closePath();
    g.fill();
    this.strokeOrganicLine(g, -13, -12, 13, -12, 3001, kFlip, '#110e0c', 3.2, 1.5);
    this.strokeOrganicLine(g, 13, -12, 12, 14, 3002, kFlip, '#110e0c', 3.2, 1.5);
    this.strokeOrganicLine(g, 12, 14, 0, 19, 3003, kFlip, '#110e0c', 3.2, 1.5);
    this.strokeOrganicLine(g, 0, 19, -12, 14, 3004, kFlip, '#110e0c', 3.2, 1.5);

    // Smirking Mouth
    this.strokeOrganicLine(g, -3, 9, 10, 8, 3010, kFlip, '#110e0c', 2.8, 0.0);
    this.strokeOrganicLine(g, 10, 8, 13, 5, 3011, kFlip, '#110e0c', 2.6, 0.0);

    // Aviator Goggles on Forehead
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.ellipse(7, -2, 7, 6, 0.05, 0, Math.PI * 2);
    g.ellipse(-6, -2, 7, 6, -0.05, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, 7, -2, 7, 0, Math.PI * 2, 3020, kFlip, '#d97706', 2.6, true);
    this.strokeOrganicArc(g, -6, -2, 7, 0, Math.PI * 2, 3021, kFlip, '#d97706', 2.6, true);
    // Glare Slashes
    g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(4, -5); g.lineTo(10, 1);
    g.moveTo(-9, -5); g.lineTo(-3, 1);
    g.stroke();

    // Tweed Newsboy Cap with 4 Panelled Seams & Visor
    g.fillStyle = '#57534e';
    g.beginPath();
    g.moveTo(-18, -10);
    g.quadraticCurveTo(-11, -32, 5, -32);
    g.quadraticCurveTo(22, -32, 20, -12);
    g.lineTo(26, -7); // Visor overhang
    g.lineTo(14, -3);
    g.lineTo(-18, -10);
    g.closePath();
    g.fill();

    this.strokeOrganicBezier(g, -18, -10, -11, -32, 5, -32, 20, -12, 3030, kFlip, '#110e0c', 3.2);
    this.strokeOrganicLine(g, 14, -3, 26, -7, 3035, kFlip, '#110e0c', 3.4, 1.5);
    // Cross-Hatch Visor Shadow (///)
    for (let h = 0; h < 3; h++) {
      this.strokeOrganicLine(g, 12 + h * 4, -3, 15 + h * 4, 3, 3040 + h, kFlip, 'rgba(17, 14, 12, 0.65)', 1.8, 0.0, false);
    }
    // Crown Button
    this.strokeOrganicArc(g, 5, -32, 3, 0, Math.PI * 2, 3050, kFlip, '#ca8a04', 2.4, true);

    g.restore();
    g.restore();
  }

  // GETAWAY CONVERTIBLE ROADSTER (Sculpted 1930s Auburn Boattail Speedster with Sweeping Coachwork & Fenders)
  private drawHandGetawayRoadster(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    kFlip: number,
    t: number,
    rms: number,
    peaceful = false
  ) {
    g.save();
    g.translate(x, y);

    const carBob = Math.sin(t * 22.0) * (peaceful ? 3 : 7);

    // 1. SCULPTED 1930s BOATTAIL COACHWORK (Curved torpedo hood, boattail taper & dual-tone finish)
    // Dark Cobalt / Navy Underbody & Shadow Layer
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.moveTo(-250, 10 + carBob);
    g.quadraticCurveTo(-220, -30 + carBob, -160, -42 + carBob);
    g.lineTo(80, -42 + carBob);
    g.quadraticCurveTo(170, -20 + carBob, 260, -15 + carBob);
    g.quadraticCurveTo(285, 10 + carBob, 280, 35 + carBob);
    g.lineTo(-250, 35 + carBob);
    g.closePath();
    g.fill();

    // Primary Vibrant Deep Sapphire Blue Bodywork (#1e3a8a)
    g.fillStyle = '#1e3a8a';
    g.beginPath();
    g.moveTo(-250, 5 + carBob); // Boattail tip
    g.quadraticCurveTo(-210, -55 + carBob, -140, -68 + carBob); // Rear deck curve
    g.lineTo(60, -68 + carBob); // Cockpit beltline
    g.quadraticCurveTo(150, -68 + carBob, 240, -42 + carBob); // Hood slope
    g.quadraticCurveTo(275, -35 + carBob, 275, 20 + carBob); // Front curved radiator grille
    g.lineTo(-250, 20 + carBob);
    g.closePath();
    g.fill();

    // Sweeping Ivory / Cream Coachline Accent Streak (#fef3c7) along the body contour
    g.fillStyle = '#fef3c7';
    g.beginPath();
    g.moveTo(-220, -10 + carBob);
    g.quadraticCurveTo(-140, -32 + carBob, 60, -32 + carBob);
    g.quadraticCurveTo(150, -32 + carBob, 250, -18 + carBob);
    g.lineTo(246, -10 + carBob);
    g.quadraticCurveTo(150, -24 + carBob, 60, -24 + carBob);
    g.quadraticCurveTo(-140, -24 + carBob, -220, -4 + carBob);
    g.closePath();
    g.fill();

    // Hand-drawn body contours with ink tremor
    this.strokeOrganicBezier(g, -250, 5 + carBob, -210, -55 + carBob, -140, -68 + carBob, 60, -68 + carBob, 4001, kFlip, '#0f172a', 4.5);
    this.strokeOrganicBezier(g, 60, -68 + carBob, 150, -68 + carBob, 240, -42 + carBob, 275, -35 + carBob, 4002, kFlip, '#0f172a', 4.5);
    this.strokeOrganicLine(g, 275, -35 + carBob, 275, 20 + carBob, 4003, kFlip, '#0f172a', 4.5, 0.0);
    this.strokeOrganicLine(g, 275, 20 + carBob, -250, 20 + carBob, 4004, kFlip, '#0f172a', 4.5, 0.0);

    // Front Upright Radiator Grille Shell with Vertical Slats
    this.drawOrganicRect(g, 260, -35 + carBob, 18, 55, 4010, kFlip, '#0f172a', '#e2e8f0', 3.2, 0.0);
    for (let sl = 0; sl < 5; sl++) {
      this.strokeOrganicLine(g, 263 + sl * 3, -32 + carBob, 263 + sl * 3, 16 + carBob, 4015 + sl, kFlip, '#0f172a', 1.8, 0.0, false);
    }

    // 2. CURVED TEARDROP FENDERS OVER WHEELS & RUNNING BOARD
    // Front Teardrop Fender (arching over front wheel at x=155)
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.moveTo(70, 18 + carBob);
    g.quadraticCurveTo(110, -45 + carBob, 155, -45 + carBob);
    g.quadraticCurveTo(210, -45 + carBob, 255, 20 + carBob);
    g.lineTo(240, 20 + carBob);
    g.quadraticCurveTo(200, -32 + carBob, 155, -32 + carBob);
    g.quadraticCurveTo(115, -32 + carBob, 80, 18 + carBob);
    g.closePath();
    g.fill();
    this.strokeOrganicBezier(g, 70, 18 + carBob, 110, -45 + carBob, 200, -45 + carBob, 255, 20 + carBob, 4020, kFlip, '#0f172a', 4.2);

    // Rear Teardrop Fender (arching over rear wheel at x=-135)
    g.beginPath();
    g.moveTo(-220, 20 + carBob);
    g.quadraticCurveTo(-180, -45 + carBob, -135, -45 + carBob);
    g.quadraticCurveTo(-90, -45 + carBob, -50, 18 + carBob);
    g.lineTo(-60, 18 + carBob);
    g.quadraticCurveTo(-95, -32 + carBob, -135, -32 + carBob);
    g.quadraticCurveTo(-175, -32 + carBob, -210, 20 + carBob);
    g.closePath();
    g.fill();
    this.strokeOrganicBezier(g, -220, 20 + carBob, -180, -45 + carBob, -90, -45 + carBob, -50, 18 + carBob, 4025, kFlip, '#0f172a', 4.2);

    // Running board connecting the fenders with rubber tread strips
    this.drawOrganicRect(g, -60, 18 + carBob, 140, 10, 4030, kFlip, '#0f172a', '#1e293b', 3.0, 0.0);

    // 3. MECHANICAL DETAILS (Hood louvers, external flexible exhaust headers, bullet headlights)
    // Quad External Flexible Chrome Exhaust Headers sweeping out from hood louvers
    for (let ex = 0; ex < 4; ex++) {
      const exX = 130 + ex * 24;
      this.strokeOrganicBezier(g, exX, -45 + carBob, exX - 8, -20 + carBob, exX - 16, 5 + carBob, exX - 45, 12 + carBob, 4040 + ex, kFlip, '#e2e8f0', 3.5, false);
    }
    // Chrome side exhaust pipe
    this.strokeOrganicLine(g, 210, 12 + carBob, -60, 12 + carBob, 4048, kFlip, '#cbd5e1', 4.0, 0.0);

    // Bullet-Shaped Vintage Pod Headlights (Chrome with yellow fluted lens)
    this.drawOrganicRect(g, 255, -28 + carBob, 24, 18, 4060, kFlip, '#0f172a', '#e2e8f0', 3.0, 2.0);
    g.fillStyle = '#fef08a';
    g.beginPath();
    g.ellipse(279, -19 + carBob, 4, 8, 0, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicLine(g, 279, -27 + carBob, 279, -11 + carBob, 4062, kFlip, '#ca8a04', 2.0, 0.0, false);

    // Cockpit Interior & Leather Bucket Seats (#451a03)
    g.fillStyle = '#2d1a10';
    g.beginPath();
    g.moveTo(-110, -66 + carBob);
    g.quadraticCurveTo(-30, -54 + carBob, 45, -66 + carBob);
    g.lineTo(45, -20 + carBob);
    g.lineTo(-110, -20 + carBob);
    g.closePath();
    g.fill();

    // Seated Characters inside Cockpit
    this.drawVolumetricCharacterB(g, 10, -38 + carBob, t, kFlip, 'car_drive', true);
    this.drawVolumetricCharacterA(g, -65, -38 + carBob, t, kFlip, peaceful ? 'car_passenger' : 'car_stand', true);

    // Padded Leather Cockpit Coaming Rim (#78350f) over Cockpit Opening
    g.fillStyle = '#78350f';
    g.beginPath();
    g.moveTo(-115, -68 + carBob);
    g.quadraticCurveTo(-30, -56 + carBob, 48, -68 + carBob);
    g.lineTo(48, -62 + carBob);
    g.quadraticCurveTo(-30, -50 + carBob, -115, -62 + carBob);
    g.closePath();
    g.fill();
    this.strokeOrganicBezier(g, -115, -68 + carBob, -30, -56 + carBob, 0, -56 + carBob, 48, -68 + carBob, 4070, kFlip, '#110e0c', 3.4);

    // Dual Brooklands Aero Windscreens with Glass Reflection Streaks
    this.strokeOrganicLine(g, 44, -68 + carBob, 22, -125 + carBob, 4101, kFlip, '#38bdf8', 3.8, 2.0);
    this.strokeOrganicLine(g, 38, -72 + carBob, 26, -116 + carBob, 4102, kFlip, 'rgba(255, 255, 255, 0.85)', 2.2, 0.0, false);

    // Rearview Mirror & Swinging Pendulum Fuzzy Dice with Hand-Drawn Pips
    const diceSwing = Math.sin(t * 14.0) * 16;
    this.strokeOrganicLine(g, 30, -105 + carBob, 30 + diceSwing, -75 + carBob, 4201, kFlip, '#0f172a', 2.4, 0.0, false);
    // Fuzzy Dice Pair with Pips
    this.drawOrganicRect(g, 18 + diceSwing, -75 + carBob, 18, 18, 4210, kFlip, '#0f172a', '#ffffff', 2.6, 1.5);
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.arc(27 + diceSwing, -66 + carBob, 2.4, 0, Math.PI * 2);
    g.fill();
    this.drawOrganicRect(g, 34 + diceSwing, -70 + carBob, 18, 18, 4215, kFlip, '#0f172a', '#ffffff', 2.6, 1.5);
    g.beginPath();
    g.arc(39 + diceSwing, -65 + carBob, 2.0, 0, Math.PI * 2);
    g.arc(47 + diceSwing, -57 + carBob, 2.0, 0, Math.PI * 2);
    g.fill();

    // Big Wire-Spoke Wheels (Radius=46px) with Rubber Tread Ticks
    const wRot = t * 35.0;
    this.drawHandSpokeWheel(g, -135, 32 + carBob, wRot, kFlip);
    this.drawHandSpokeWheel(g, 155, 32 + carBob, wRot, kFlip);

    // 4. BILLOWING CARTOON EXHAUST SMOKE PUFFS (Cel-shaded puffy arcs with inner shadow crescents)
    if (!peaceful) {
      for (let sm = 0; sm < 6; sm++) {
        const smx = -260 - sm * 65 - this.hash(sm, kFlip) * 35;
        const smy = 16 + carBob - sm * 16;
        const smR = 28 + sm * 14;

        // Puffy outline arc
        this.strokeOrganicArc(g, smx, smy, smR, 0, Math.PI * 2, 4300 + sm, kFlip, 'rgba(60, 45, 30, 0.65)', 3.6, true);
        // Inner shadow crescent
        g.fillStyle = 'rgba(120, 95, 75, 0.18)';
        g.beginPath();
        g.arc(smx + 5, smy + 5, smR * 0.75, 0, Math.PI * 2);
        g.fill();
      }
    }

    g.restore();
  }

  // Hand-Drawn Wire Spoke Wheel with Deep Rubber Tread Ticks
  private drawHandSpokeWheel(g: CanvasRenderingContext2D, x: number, y: number, rot: number, kFlip: number) {
    g.save();
    g.translate(x, y);

    // Outer Tire Rim (Deep carbon black rubber)
    this.strokeOrganicArc(g, 0, 0, 46, 0, Math.PI * 2, 5001, kFlip, '#110e0c', 5.5, true);
    g.fillStyle = '#14100d';
    g.beginPath();
    g.arc(0, 0, 45, 0, Math.PI * 2);
    g.fill();

    // Tread Ticks around the perimeter
    for (let tr = 0; tr < 14; tr++) {
      const ta = (tr * Math.PI) / 7 + rot * 0.2;
      const tx1 = Math.cos(ta) * 40;
      const ty1 = Math.sin(ta) * 40;
      const tx2 = Math.cos(ta) * 46;
      const ty2 = Math.sin(ta) * 46;
      this.strokeOrganicLine(g, tx1, ty1, tx2, ty2, 5030 + tr, kFlip, '#475569', 2.0, 0.0, false);
    }

    // Polished Chrome Beauty Ring
    this.strokeOrganicArc(g, 0, 0, 32, 0, Math.PI * 2, 5005, kFlip, '#e2e8f0', 3.8, true);

    // Radial Wire Spokes (12 Cross-laced wire spokes)
    g.rotate(rot);
    for (let s = 0; s < 12; s++) {
      const a = (s * Math.PI) / 6;
      this.strokeOrganicLine(g, 0, 0, Math.cos(a) * 32, Math.sin(a) * 32, 5010 + s, kFlip, '#cbd5e1', 2.2, 0.0, false);
    }

    // Center Chrome Knock-Off Spinner Hubcap with 2 Ears
    this.strokeOrganicArc(g, 0, 0, 11, 0, Math.PI * 2, 5020, kFlip, '#94a3b8', 3.2, true);
    this.strokeOrganicLine(g, -16, 0, 16, 0, 5022, kFlip, '#e2e8f0', 3.0, 0.0, false);

    g.restore();
  }

  // VINTAGE 1930s POLICE PURSUIT SEDAN (Ford V8 Sedan with Police Shield & Gumball Siren)
  private drawHandPoliceCar(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    kFlip: number,
    t: number
  ) {
    g.save();
    g.translate(x, y);

    const copBob = Math.sin(t * 24.0) * 5;

    // 1. VINTAGE SEDAN BODYWORK (Black & White Police Livery)
    // Black Sedan Roof & Cabin
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.moveTo(-110, -30 + copBob);
    g.quadraticCurveTo(-90, -75 + copBob, -40, -75 + copBob);
    g.lineTo(30, -75 + copBob);
    g.quadraticCurveTo(70, -75 + copBob, 85, -30 + copBob);
    g.closePath();
    g.fill();
    this.strokeOrganicBezier(g, -110, -30 + copBob, -90, -75 + copBob, -40, -75 + copBob, 30, -75 + copBob, 6001, kFlip, '#0f172a', 4.0);
    this.strokeOrganicLine(g, 30, -75 + copBob, 85, -30 + copBob, 6002, kFlip, '#0f172a', 4.0, 0.0);

    // Split Windshield & Cabin Interior
    this.drawOrganicRect(g, -35, -70 + copBob, 35, 32, 6005, kFlip, '#0f172a', '#1e293b', 2.6, 0.0);
    this.drawOrganicRect(g, 6, -70 + copBob, 38, 32, 6006, kFlip, '#0f172a', '#1e293b', 2.6, 0.0);

    // Determined Angry Police Officer in Driver Window
    g.save();
    g.fillStyle = '#fed7aa'; // Officer face
    g.beginPath();
    g.ellipse(22, -54 + copBob, 7, 8, 0.1, 0, Math.PI * 2);
    g.fill();
    // Officer Police Cap (#1e3a8a) with Gold Shield
    g.fillStyle = '#1e3a8a';
    g.beginPath();
    g.moveTo(13, -58 + copBob);
    g.lineTo(32, -60 + copBob);
    g.lineTo(34, -54 + copBob);
    g.lineTo(13, -54 + copBob);
    g.closePath();
    g.fill();
    this.strokeOrganicLine(g, 13, -54 + copBob, 36, -55 + copBob, 6008, kFlip, '#110e0c', 2.2, 0.0, false);
    // Dark Aviator Sunglasses
    g.fillStyle = '#0f172a';
    g.fillRect(18, -56 + copBob, 10, 4);
    // Hand gripping steering wheel / Radio mic
    this.strokeOrganicLine(g, 32, -45 + copBob, 38, -50 + copBob, 6009, kFlip, '#110e0c', 2.4, 0.0, false);
    g.restore();

    // Black Body Lower Shell
    this.drawOrganicRect(g, -135, -30 + copBob, 270, 50, 6010, kFlip, '#0f172a', '#0f172a', 4.5, 3.0);

    // White Front & Rear Doors (Classic Police Black-and-White Livery)
    this.drawOrganicRect(g, -50, -30 + copBob, 100, 48, 6015, kFlip, '#0f172a', '#f8fafc', 3.5, 2.0);

    // Hand-drawn Police Star Shield Badge & "POLICE" Lettering
    g.fillStyle = '#ca8a04';
    g.beginPath();
    g.arc(0, -10 + copBob, 12, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, 0, -10 + copBob, 12, 0, Math.PI * 2, 6018, kFlip, '#110e0c', 2.5, true);
    g.fillStyle = '#0f172a';
    g.font = '900 13px sans-serif';
    g.textAlign = 'center';
    g.fillText('POLICE', 0, 10 + copBob);

    // Front Upright Grille & Chrome Bumper
    this.drawOrganicRect(g, 130, -25 + copBob, 12, 45, 6025, kFlip, '#0f172a', '#cbd5e1', 2.8, 0.0);
    this.strokeOrganicLine(g, 138, 15 + copBob, 150, 15 + copBob, 6028, kFlip, '#e2e8f0', 4.5, 0.0);
    this.strokeOrganicLine(g, -135, 15 + copBob, -148, 15 + copBob, 6029, kFlip, '#e2e8f0', 4.5, 0.0);

    // 2. FLASHING RED GUMBALL SIREN WITH SOUND RIPPLES
    const sirenFlicker = Math.sin(t * 30.0) > 0;
    // Siren base mount
    this.drawOrganicRect(g, -8, -82 + copBob, 16, 7, 6030, kFlip, '#0f172a', '#cbd5e1', 2.2, 0.0);
    // Red / Blue Flashing Dome
    g.fillStyle = sirenFlicker ? '#ef4444' : '#3b82f6';
    g.beginPath();
    g.arc(0, -92 + copBob, 14, 0, Math.PI * 2);
    g.fill();
    this.strokeOrganicArc(g, 0, -92 + copBob, 14, 0, Math.PI * 2, 6035, kFlip, '#0f172a', 3.5, true);

    // Radiating Siren Sound Waves / Light Beams ()))
    g.strokeStyle = sirenFlicker ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)';
    g.lineWidth = 3.0;
    g.beginPath();
    g.arc(0, -92 + copBob, 28, -Math.PI * 0.75, Math.PI * 0.25);
    g.stroke();
    g.beginPath();
    g.arc(0, -92 + copBob, 42, -Math.PI * 0.75, Math.PI * 0.25);
    g.stroke();

    // 3. SWEEPING POLICE SPOTLIGHT BEAM CUTTING ACROSS HIGHWAY TOWARD ROADSTER
    const spotOriginX = 42;
    const spotOriginY = -56 + copBob;
    const spotSweepAngle = 0.12 + Math.sin(t * 4.5) * 0.06; // Sweeping downward-forward beam
    const spotLen = 880;

    g.save();
    g.translate(spotOriginX, spotOriginY);
    g.rotate(spotSweepAngle);

    // Warm luminous spotlight cone
    const spotGrad = g.createLinearGradient(0, 0, spotLen, 0);
    spotGrad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
    spotGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.26)');
    spotGrad.addColorStop(0.8, 'rgba(254, 240, 138, 0.10)');
    spotGrad.addColorStop(1.0, 'rgba(254, 240, 138, 0.0)');

    g.fillStyle = spotGrad;
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(spotLen, -110);
    g.lineTo(spotLen, 110);
    g.lineTo(0, 6);
    g.closePath();
    g.fill();

    // Spotlight Lamp Housing (Chrome cylinder on bracket)
    this.drawOrganicRect(g, -6, -8, 14, 16, 6040, kFlip, '#0f172a', '#e2e8f0', 2.2, 0.0);
    g.fillStyle = '#fef08a';
    g.beginPath();
    g.ellipse(8, 0, 3, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    // Wheels
    this.drawHandSpokeWheel(g, -80, 22 + copBob, t * 35.0, kFlip);
    this.drawHandSpokeWheel(g, 80, 22 + copBob, t * 35.0, kFlip);

    g.restore();
  }
}

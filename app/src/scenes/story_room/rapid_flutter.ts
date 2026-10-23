// SCENE 4: THE FLICK-BOOK CASCADE & "NO TAKEBACKS" TITLE SPREAD (13.0s - 17.0s)
// Cover flings open -> 36 folios rapidly flutter with authentic curl and typeset text ->
// Decelerates to slam flat on "NO TAKEBACKS" title page with Character A & B vignette ->
// Macro dive into paper fibers.
// Strictly Closed-Form Frame = f(t), Zero State Leaks

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

export default class RapidFlutter extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  // 3D Table & Desk Props
  private deskMesh: THREE.Mesh;
  private matMesh: THREE.Mesh;
  private lampGroup: THREE.Group;
  private toolsGroup: THREE.Group;

  // 3D Hardcover Book Assembly
  private bookGroup: THREE.Group;
  private frontCoverPivot: THREE.Group;
  private frontCoverMesh: THREE.Mesh;
  private backCover: THREE.Mesh;
  private spineMesh: THREE.Mesh;
  private rightPageBlock: THREE.Group;
  private leftPageBlock: THREE.Group;
  private ribbonMesh: THREE.Mesh;

  // Fluttering Pages Array
  private pages: THREE.Mesh[] = [];
  private readonly NUM_PAGES = 32;

  // Title Spread (Left: Prologus, Right: "NO TAKEBACKS" + Characters Vignette)
  private leftSpreadMesh: THREE.Mesh;
  private rightTitleMesh: THREE.Mesh;

  // Textures
  private folioTextures: THREE.CanvasTexture[] = [];
  private titleTexture: THREE.CanvasTexture;
  private coverTexture: THREE.CanvasTexture;
  private endpaperTexture: THREE.CanvasTexture;
  private matTexture: THREE.CanvasTexture;

  // Lighting
  private keyLight: THREE.DirectionalLight;
  private lampLight: THREE.PointLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(38, W / H, 0.05, 50);

    this.scene.background = new THREE.Color(0x0c0f16);

    // Warm Desk Lamp Lighting
    this.keyLight = new THREE.DirectionalLight(0xfff5ea, 1.6);
    this.keyLight.position.set(-1.2, 3.5, 2.0);
    this.scene.add(this.keyLight);

    this.lampLight = new THREE.PointLight(0xffa726, 2.5, 4.8, 1.2);
    this.lampLight.position.set(-0.24, 1.12, 0.02);
    this.scene.add(this.lampLight);

    const amb = new THREE.AmbientLight(0x2d3748, 0.7);
    this.scene.add(amb);

    // 1. Mahogany Desk Surface
    const deskGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x361c12, // Dark polished mahogany
      roughness: 0.26,
      metalness: 0.08,
    });
    this.deskMesh = new THREE.Mesh(deskGeo, deskMat);
    this.deskMesh.rotation.set(0.08 - Math.PI / 2, 0, 0);
    this.deskMesh.position.set(0, 0.77, 0);
    this.scene.add(this.deskMesh);

    // 2. Green Self-Healing Drafting Cutting Mat (Matches colour_room identically)
    this.matTexture = this.createCuttingMatTexture();
    const matGeo = new THREE.PlaneGeometry(1.1, 0.75);
    const matMaterial = new THREE.MeshStandardMaterial({
      map: this.matTexture,
      roughness: 0.55,
      metalness: 0.05,
    });
    this.matMesh = new THREE.Mesh(matGeo, matMaterial);
    this.matMesh.rotation.set(0.08 - Math.PI / 2, 0, 0);
    this.matMesh.position.set(-0.05, 0.806, -0.02);
    this.scene.add(this.matMesh);

    // 3. Desk Props & Stationery (Matching colour_room 1:1)
    this.lampGroup = new THREE.Group();
    // Weighted brass lamp base
    const lBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.10, 0.03, 16),
      new THREE.MeshStandardMaterial({ color: 0xb89738, roughness: 0.28, metalness: 0.88 })
    );
    lBase.position.set(-0.35, 0.82, -0.22);
    lBase.rotation.set(0.08, 0, 0);
    this.lampGroup.add(lBase);

    // Lower & upper articulated brass arms
    const lArm1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.38, 12),
      new THREE.MeshStandardMaterial({ color: 0xb89738, roughness: 0.28, metalness: 0.88 })
    );
    lArm1.position.set(-0.33, 0.98, -0.16);
    lArm1.rotation.set(0.28, 0, -0.15);
    this.lampGroup.add(lArm1);

    // Lamp shade bell head
    const lShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.13, 16),
      new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.35, metalness: 0.45 })
    );
    lShade.position.set(-0.24, 1.18, 0.02);
    lShade.rotation.set(-Math.PI * 0.85, 0.2, 0);
    this.lampGroup.add(lShade);

    // Filament bulb
    const lBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff3d6 })
    );
    lBulb.position.set(-0.24, 1.15, 0.02);
    this.lampGroup.add(lBulb);
    this.scene.add(this.lampGroup);

    // Drafting Tools Group
    this.toolsGroup = new THREE.Group();
    // Polished Brass T-Square along top of mat
    const tBlade = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.012, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 })
    );
    tBlade.position.set(-0.24, 0.812, -0.14);
    tBlade.rotation.set(0.08, 0.12, 0);
    this.toolsGroup.add(tBlade);

    const tHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.022, 0.30),
      new THREE.MeshStandardMaterial({ color: 0x3e2014, roughness: 0.35, metalness: 0.2 })
    );
    tHead.position.set(-0.82, 0.812, -0.21);
    tHead.rotation.set(0.08, 0.12, 0);
    this.toolsGroup.add(tHead);

    // Cyan Acrylic 30/60 Triangle
    const tri = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.01, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.85 })
    );
    tri.position.set(0.42, 0.812, 0.16);
    tri.rotation.set(0.08, -0.38, 0);
    this.toolsGroup.add(tri);

    // Porcelain Pen Cup with Pencils
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.2, metalness: 0.1 })
    );
    cup.position.set(0.68, 0.88, -0.32);
    cup.rotation.set(0.08, 0, 0);
    this.toolsGroup.add(cup);
    this.scene.add(this.toolsGroup);

    // 4. Generate Textures
    this.folioTextures = [
      this.createFolioTexture(1), // Vault Blueprints & Floorplans
      this.createFolioTexture(2), // Getaway Route Maps & Contours
      this.createFolioTexture(3), // Classical Typeset Prose & Woodcuts
      this.createFolioTexture(4), // Astrolabe & Mechanical Schematics
    ];
    this.coverTexture = this.createCoverTexture();
    this.endpaperTexture = this.createEndpaperTexture();
    this.titleTexture = this.createTitleSpreadTexture();

    // 5. Assemble 3D Hardcover Book on Desk
    this.bookGroup = new THREE.Group();
    this.bookGroup.position.set(0.12, 0.836, 0.08);
    this.bookGroup.rotation.set(0.08, 0.12, 0);

    const coverW = 0.28, coverH = 0.38, coverT = 0.006;
    const pageW = 0.265, pageH = 0.36;
    const pageBlockHeight = 0.026;

    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x6b1122,
      roughness: 0.30,
      metalness: 0.12,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.85,
    });

    // Back cover resting on table
    const backGeo = new THREE.BoxGeometry(coverW, coverT, coverH);
    this.backCover = new THREE.Mesh(backGeo, leatherMat);
    this.backCover.position.set(coverW / 2, coverT / 2, 0);
    this.bookGroup.add(this.backCover);

    // Spine
    const spineGeo = new THREE.BoxGeometry(0.016, coverT * 2 + pageBlockHeight, coverH);
    this.spineMesh = new THREE.Mesh(spineGeo, leatherMat);
    this.spineMesh.position.set(0, (coverT * 2 + pageBlockHeight) / 2, 0);
    this.bookGroup.add(this.spineMesh);

    // Gilded page block edges on right side (outer perimeter rims only so interior page is visible)
    this.rightPageBlock = new THREE.Group();
    const rightEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.005, pageBlockHeight, pageH), goldMat);
    rightEdgeMesh.position.set(pageW - 0.0025, pageBlockHeight / 2, 0);
    this.rightPageBlock.add(rightEdgeMesh);
    const topEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageBlockHeight, 0.005), goldMat);
    topEdgeMesh.position.set(pageW / 2, pageBlockHeight / 2, -pageH / 2 + 0.0025);
    this.rightPageBlock.add(topEdgeMesh);
    const bottomEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageBlockHeight, 0.005), goldMat);
    bottomEdgeMesh.position.set(pageW / 2, pageBlockHeight / 2, pageH / 2 - 0.0025);
    this.rightPageBlock.add(bottomEdgeMesh);
    this.rightPageBlock.position.set(0, coverT, 0);
    this.bookGroup.add(this.rightPageBlock);

    // Left page block edges (outer perimeter rims, thickens as folios flip)
    this.leftPageBlock = new THREE.Group();
    const leftEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.005, pageBlockHeight, pageH), goldMat);
    leftEdgeMesh.position.set(-pageW + 0.0025, pageBlockHeight / 2, 0);
    this.leftPageBlock.add(leftEdgeMesh);
    const leftTopEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageBlockHeight, 0.005), goldMat);
    leftTopEdgeMesh.position.set(-pageW / 2, pageBlockHeight / 2, -pageH / 2 + 0.0025);
    this.leftPageBlock.add(leftTopEdgeMesh);
    const leftBottomEdgeMesh = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageBlockHeight, 0.005), goldMat);
    leftBottomEdgeMesh.position.set(-pageW / 2, pageBlockHeight / 2, pageH / 2 - 0.0025);
    this.leftPageBlock.add(leftBottomEdgeMesh);
    this.leftPageBlock.position.set(0, coverT, 0);
    this.leftPageBlock.scale.y = 0.01;
    this.bookGroup.add(this.leftPageBlock);

    // Scarlet bookmark ribbon trailing out onto cutting mat
    const ribbonGeo = new THREE.BoxGeometry(0.018, 0.002, 0.24);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.35,
      metalness: 0.05,
    });
    this.ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.ribbonMesh.position.set(0.03, coverT + 0.008, coverH / 2 + 0.09);
    this.ribbonMesh.rotation.y = 0.22;
    this.bookGroup.add(this.ribbonMesh);

    // Hinged Front Cover Pivot at Spine (x = 0, y = coverT + pageBlockHeight)
    this.frontCoverPivot = new THREE.Group();
    this.frontCoverPivot.position.set(0, coverT + pageBlockHeight, 0);

    const frontGeo = new THREE.BoxGeometry(coverW, coverT, coverH);
    frontGeo.translate(coverW / 2, coverT / 2, 0);

    const coverOuterMat = new THREE.MeshStandardMaterial({
      map: this.coverTexture,
      roughness: 0.26,
      metalness: 0.15,
    });
    const endpaperMat = new THREE.MeshStandardMaterial({
      map: this.endpaperTexture,
      roughness: 0.85,
      metalness: 0.0,
    });
    this.frontCoverMesh = new THREE.Mesh(frontGeo, [
      leatherMat,
      leatherMat,
      coverOuterMat, // Top face when closed
      endpaperMat,   // Bottom face (swings up when open)
      leatherMat,
      leatherMat,
    ]);
    this.frontCoverPivot.add(this.frontCoverMesh);
    this.bookGroup.add(this.frontCoverPivot);

    // Left Spread Page (Prologus / Frontispiece): UV mapped to [0.0, 0.5]
    const leftGeo = new THREE.PlaneGeometry(pageW, pageH);
    leftGeo.rotateX(-Math.PI / 2);
    const leftUv = leftGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < leftUv.count; i++) {
      leftUv.setX(i, leftUv.getX(i) * 0.5);
    }
    leftUv.needsUpdate = true;
    const leftMat = new THREE.MeshStandardMaterial({
      map: this.titleTexture,
      roughness: 0.75,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.leftSpreadMesh = new THREE.Mesh(leftGeo, leftMat);
    this.leftSpreadMesh.position.set(-pageW / 2, coverT + pageBlockHeight + 0.003, 0);
    this.leftSpreadMesh.visible = false;
    this.bookGroup.add(this.leftSpreadMesh);

    // Right Spread Page ("NO TAKEBACKS" + Characters): UV mapped to [0.5, 1.0]
    const rightGeo = new THREE.PlaneGeometry(pageW, pageH);
    rightGeo.rotateX(-Math.PI / 2);
    const rightUv = rightGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < rightUv.count; i++) {
      rightUv.setX(i, 0.5 + rightUv.getX(i) * 0.5);
    }
    rightUv.needsUpdate = true;
    const rightMat = new THREE.MeshStandardMaterial({
      map: this.titleTexture,
      roughness: 0.75,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.rightTitleMesh = new THREE.Mesh(rightGeo, rightMat);
    this.rightTitleMesh.position.set(pageW / 2, coverT + 0.002, 0);
    this.bookGroup.add(this.rightTitleMesh);

    // 6. Generate 32 Fluttering Folio Planes
    for (let i = 0; i < this.NUM_PAGES; i++) {
      const pageGeo = new THREE.PlaneGeometry(pageW, pageH, 8, 4);
      pageGeo.translate(pageW / 2, 0, 0);
      pageGeo.rotateX(-Math.PI / 2);

      const pageMat = new THREE.MeshStandardMaterial({
        map: this.folioTextures[i % 4],
        roughness: 0.78,
        metalness: 0.0,
        side: THREE.DoubleSide,
      });

      const page = new THREE.Mesh(pageGeo, pageMat);
      page.position.set(0, coverT + pageBlockHeight - i * (pageBlockHeight / this.NUM_PAGES), 0);
      this.pages.push(page);
      this.bookGroup.add(page);
    }

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
    g.moveTo(160, 832); g.lineTo(832, 160); // 45 deg
    g.moveTo(160, 832); g.lineTo(940, 380); // 30 deg
    g.moveTo(160, 832); g.lineTo(550, 160); // 60 deg
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

    // Inner gold fill tint
    g.fillStyle = 'rgba(212, 175, 55, 0.08)';
    g.beginPath();
    g.ellipse(mx, my, 305, 225, 0, 0, Math.PI * 2);
    g.fill();

    // Gold Lettering
    g.fillStyle = '#fef08a';
    g.font = 'bold 28px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('HISTORIA ET CHRONICA', mx, my - 110);

    g.fillStyle = '#ffffff';
    g.shadowColor = '#d4af37';
    g.shadowBlur = 12;
    g.font = '900 64px Georgia, serif';
    g.fillText('NO TAKEBACKS', mx, my + 10);
    g.shadowBlur = 0;

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

  // Endpaper Texture (Inside cover paste-down: cream laid paper with gilded fillet & Ex-Libris bookplate)
  private createEndpaperTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;

    g.save();
    // Rotate 180 degrees around center so text is upright when front cover swings open 180 degrees
    g.translate(512, 512);
    g.rotate(Math.PI);
    g.translate(-512, -512);

    // Antique cream laid paper
    g.fillStyle = '#f6f0df';
    g.fillRect(0, 0, 1024, 1024);

    // Laid paper horizontal waterlines
    g.strokeStyle = 'rgba(70, 50, 30, 0.05)';
    g.lineWidth = 1;
    for (let y = 16; y < 1024; y += 16) {
      g.beginPath();
      g.moveTo(0, y); g.lineTo(1024, y);
      g.stroke();
    }

    // Outer Gilded Fillet Border
    g.strokeStyle = '#c9a030';
    g.lineWidth = 5;
    g.strokeRect(60, 60, 904, 904);
    g.lineWidth = 1.5;
    g.strokeRect(74, 74, 876, 876);

    // Corner Ornaments
    const corners = [[74, 74], [950, 74], [74, 950], [950, 950]];
    for (const [cx, cy] of corners) {
      g.fillStyle = '#c9a030';
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
    }

    // Centered Ex-Libris Bookplate Frame
    g.fillStyle = '#fffdf7';
    g.fillRect(352, 360, 320, 304);
    g.strokeStyle = '#2d1e15';
    g.lineWidth = 2.5;
    g.strokeRect(352, 360, 320, 304);
    g.lineWidth = 1.0;
    g.strokeRect(362, 370, 300, 284);

    // Bookplate Vignette & Latin Inscription
    g.fillStyle = '#1c1511';
    g.font = 'bold 24px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('EX LIBRIS', 512, 435);

    g.strokeStyle = '#854d0e';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(432, 455); g.lineTo(592, 455);
    g.stroke();

    g.font = 'italic 18px Georgia, serif';
    g.fillText('Bibliotheca Secreta', 512, 505);
    g.font = '15px Georgia, serif';
    g.fillText('Nihil Retrorsum in Tempore', 512, 545);
    g.font = 'bold 16px Georgia, serif';
    g.fillText('ANNO DOMINI MCMXXXV', 512, 600);

    g.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Folio 2D Texture Generator with authentic historical layouts
  private createFolioTexture(type: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;

    // Warm Antique Parchment
    g.fillStyle = '#f6f2e9';
    g.fillRect(0, 0, 1024, 1024);

    // Subtle paper age stains
    g.fillStyle = 'rgba(180, 150, 110, 0.06)';
    g.beginPath();
    g.arc(300, 400, 220, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(750, 700, 260, 0, Math.PI * 2);
    g.fill();

    // Decorative Margins
    g.strokeStyle = '#3a2e24';
    g.lineWidth = 3;
    g.strokeRect(60, 60, 904, 904);
    g.lineWidth = 1;
    g.strokeRect(70, 70, 884, 884);

    if (type === 1) {
      // Vault Floorplan Schematic
      g.fillStyle = '#261b14';
      g.font = 'bold 28px Georgia, serif';
      g.fillText('PLANUM I // ARCHITECTURA SECRETA', 100, 120);

      g.strokeStyle = '#4a3b2c';
      g.lineWidth = 2;
      g.strokeRect(120, 180, 784, 480);

      // Floorplan rooms
      for (let rx = 160; rx <= 800; rx += 160) {
        g.beginPath();
        g.moveTo(rx, 180);
        g.lineTo(rx, 660);
        g.stroke();
      }
      // Vault circle
      g.beginPath();
      g.arc(512, 420, 120, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(512, 420, 80, 0, Math.PI * 2);
      g.stroke();

      g.font = '16px monospace';
      g.fillText('SEC-01: HEAVY VAULT DOOR [STEEL REINFORCED]', 280, 425);

      // Typeset Latin notes below
      g.font = '18px Georgia, serif';
      for (let y = 720; y <= 900; y += 32) {
        g.fillText('Omnis actio certitudinis causa oritur. Nihil retrorsum in tempore continuo.', 100, y);
      }
    } else if (type === 2) {
      // Getaway Route Topographic Map
      g.fillStyle = '#261b14';
      g.font = 'bold 28px Georgia, serif';
      g.fillText('ITINERARIUM // THE GETAWAY TRAJECTORY', 100, 120);

      // Topographic contours
      g.strokeStyle = 'rgba(74, 59, 44, 0.4)';
      g.lineWidth = 1.5;
      for (let r = 80; r <= 380; r += 40) {
        g.beginPath();
        g.ellipse(512, 440, r, r * 0.65, 0.3, 0, Math.PI * 2);
        g.stroke();
      }

      // High-speed escape route (crimson dotted line)
      g.strokeStyle = '#b91c1c';
      g.lineWidth = 4;
      g.setLineDash([12, 8]);
      g.beginPath();
      g.moveTo(180, 680);
      g.bezierCurveTo(340, 520, 480, 360, 820, 220);
      g.stroke();
      g.setLineDash([]);

      // Compass Rose
      g.strokeStyle = '#261b14';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(800, 780, 60, 0, Math.PI * 2);
      g.moveTo(800, 700);
      g.lineTo(800, 860);
      g.moveTo(720, 780);
      g.lineTo(880, 780);
      g.stroke();
      g.font = 'bold 20px Georgia, serif';
      g.fillText('N', 793, 695);
    } else if (type === 3) {
      // Two-column classical prose with drop cap
      g.fillStyle = '#261b14';
      g.font = 'bold 72px Georgia, serif';
      g.fillText('N', 100, 180);

      g.font = '19px Georgia, serif';
      // Left column
      for (let y = 140; y <= 880; y += 30) {
        if (y < 210) {
          g.fillText('on est ad astra mollis e terris via.', 180, y);
        } else {
          g.fillText('Fortuna audaces iuvat, timidosque repellit.', 100, y);
        }
      }
      // Right column
      for (let y = 140; y <= 880; y += 30) {
        g.fillText('In omni re vincit imitatio veritatem.', 540, y);
      }
    } else {
      // Astrolabe & Mechanical Epicyclic Gears
      g.fillStyle = '#261b14';
      g.font = 'bold 28px Georgia, serif';
      g.fillText('HOROLOGIUM // CHRONOMETRIC ESCAPEMENT', 100, 120);

      g.strokeStyle = '#4a3b2c';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(512, 450, 220, 0, Math.PI * 2);
      g.stroke();
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        g.beginPath();
        g.moveTo(512 + Math.cos(a) * 200, 450 + Math.sin(a) * 200);
        g.lineTo(512 + Math.cos(a) * 220, 450 + Math.sin(a) * 220);
        g.stroke();
      }

      g.font = '18px Georgia, serif';
      for (let y = 740; y <= 900; y += 32) {
        g.fillText('Figura 4: Ratio motus perpetui in tempore continuo.', 120, y);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Title Double-Spread: "NO TAKEBACKS" + Character A & B Illustration
  private createTitleSpreadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const g = canvas.getContext('2d')!;

    // Warm Antique Parchment Spread
    g.fillStyle = '#f7f3ea';
    g.fillRect(0, 0, 2048, 1024);

    // Central Book Binding Crease Shadow
    const grad = g.createLinearGradient(1024 - 45, 0, 1024 + 45, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(60, 40, 25, 0.45)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(1024 - 50, 0, 100, 1024);

    // =======================================================================
    // LEFT PAGE: ARCHITECTURAL VIGNETTE & PROLOGUE
    // =======================================================================
    g.strokeStyle = '#3a2e24';
    g.lineWidth = 3;
    g.strokeRect(80, 80, 864, 864);
    g.lineWidth = 1;
    g.strokeRect(92, 92, 840, 840);

    g.fillStyle = '#261b14';
    g.font = 'bold 24px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('— LIBER I // ARCHIVUM CHRONICA —', 512, 140);

    g.font = 'italic 20px Georgia, serif';
    g.fillText('"Let\'s just pull the trigger on the plan."', 512, 185);

    // Left Vignette: The Getaway Roadster & Bank Outline
    g.strokeStyle = '#261b14';
    g.lineWidth = 2.5;
    g.beginPath();
    // Bank columns
    for (let cx = 220; cx <= 800; cx += 145) {
      g.strokeRect(cx, 260, 45, 240);
    }
    // Pediment triangle
    g.beginPath();
    g.moveTo(180, 260);
    g.lineTo(512, 180);
    g.lineTo(840, 260);
    g.closePath();
    g.stroke();

    // Vault door below
    g.beginPath();
    g.arc(512, 400, 85, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(512, 400, 55, 0, Math.PI * 2);
    g.stroke();

    // Left Page Prologue Text
    g.font = '18px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('This could crash and burn and maybe it\'ll work.', 512, 580);
    g.fillText('\'Cause if we jump the gun, it\'s over and it\'s done,', 512, 615);
    g.fillText('but it would all be worth it if it lands.', 512, 650);
    g.fillText('I\'ve never gone a hundred in my life.', 512, 700);
    g.fillText('There\'s no such thing as ninety-fives this time.', 512, 735);

    // =======================================================================
    // RIGHT PAGE: HERO TITLE "NO TAKEBACKS" & TWO CHARACTERS
    // =======================================================================
    g.strokeStyle = '#3a2e24';
    g.lineWidth = 3;
    g.strokeRect(1104, 80, 864, 864);
    g.lineWidth = 1;
    g.strokeRect(1116, 92, 840, 840);

    g.fillStyle = '#6b5344';
    g.font = 'bold 22px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('— CHAPTER I —', 1536, 150);

    // HERO TITLE: "NO TAKEBACKS"
    g.fillStyle = '#1c1511';
    g.font = 'bold 54px Georgia, serif';
    g.fillText('NO TAKEBACKS', 1536, 230);

    // Crimson divider
    g.strokeStyle = '#b91c1c';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(1340, 255);
    g.lineTo(1732, 255);
    g.stroke();

    g.fillStyle = '#5c4033';
    g.font = 'italic 21px Georgia, serif';
    g.fillText('Forrest Nolan // Indie Movie Soundtrack', 1536, 295);

    // =======================================================================
    // INK VIGNETTE: TWO CHARACTERS IN VOLUMETRIC HAND-DRAWN STYLE
    // =======================================================================
    const cx = 1536, cy = 540;

    // Ground line with double ink and graphite guide
    g.strokeStyle = 'rgba(65, 50, 36, 0.35)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(1240, cy + 125);
    g.lineTo(1832, cy + 125);
    g.stroke();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(1250, cy + 120);
    g.lineTo(1822, cy + 120);
    g.stroke();

    // CHARACTER A (Left: The Firebrand - Volumetric Anatomy, Scythe Hair, 3D Cloth Scarf)
    const ax = cx - 75, ay = cy + 15;

    // Faint 2B graphite guide line
    g.strokeStyle = 'rgba(65, 50, 36, 0.25)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(ax, ay - 110);
    g.quadraticCurveTo(ax + 5, ay - 40, ax - 10, ay + 118);
    g.stroke();

    // Volumetric Legs & Chunky Combat Boots (Sprint stance)
    // Front Leg (Thigh & Calf)
    g.fillStyle = '#3f3226';
    g.beginPath();
    g.moveTo(ax - 10, ay + 32);
    g.lineTo(ax + 8, ay + 32);
    g.lineTo(ax - 20, ay + 75);
    g.lineTo(ax - 34, ay + 70);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.8;
    g.stroke();
    g.beginPath();
    g.moveTo(ax - 34, ay + 70);
    g.lineTo(ax - 20, ay + 75);
    g.lineTo(ax - 30, ay + 114);
    g.lineTo(ax - 44, ay + 110);
    g.closePath();
    g.fill();
    g.stroke();
    // Front Boot
    g.fillStyle = '#1c1917';
    g.fillRect(ax - 56, ay + 108, 30, 14);
    g.strokeRect(ax - 56, ay + 108, 30, 14);

    // Rear Leg
    g.fillStyle = '#2d2218';
    g.beginPath();
    g.moveTo(ax + 4, ay + 32);
    g.lineTo(ax + 20, ay + 32);
    g.lineTo(ax + 38, ay + 72);
    g.lineTo(ax + 26, ay + 76);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(ax + 26, ay + 76);
    g.lineTo(ax + 38, ay + 72);
    g.lineTo(ax + 36, ay + 112);
    g.lineTo(ax + 24, ay + 114);
    g.closePath();
    g.fill();
    g.stroke();
    // Rear Boot
    g.fillStyle = '#1c1917';
    g.fillRect(ax + 18, ay + 110, 28, 14);
    g.strokeRect(ax + 18, ay + 110, 28, 14);

    // Torso (Tapered athletic comic chest & vest)
    g.fillStyle = '#1e1b18';
    g.beginPath();
    g.moveTo(ax - 18, ay - 42);
    g.lineTo(ax + 18, ay - 42);
    g.lineTo(ax + 12, ay + 32);
    g.lineTo(ax - 12, ay + 32);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 4.0;
    g.stroke();
    // Belt & buckle
    g.fillStyle = '#ca8a04';
    g.fillRect(ax - 5, ay + 26, 10, 8);
    g.strokeRect(ax - 5, ay + 26, 10, 8);

    // Head (Peach skin tone contour & anime jawline)
    g.fillStyle = '#faeed7';
    g.beginPath();
    g.moveTo(ax - 14, ay - 68);
    g.quadraticCurveTo(ax, ay - 84, ax + 16, ay - 68);
    g.quadraticCurveTo(ax + 20, ay - 50, ax + 12, ay - 42);
    g.lineTo(ax - 2, ay - 38);
    g.lineTo(ax - 12, ay - 44);
    g.closePath();
    g.fill();
    g.stroke();
    // Expressive eye
    g.fillStyle = '#110e0c';
    g.beginPath();
    g.ellipse(ax + 4, ay - 62, 3.5, 5, 0.1, 0, Math.PI * 2);
    g.fill();
    // Shouting mouth
    g.fillStyle = '#110e0c';
    g.beginPath();
    g.ellipse(ax + 5, ay - 48, 6, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(ax + 1, ay - 51, 8, 2.5);

    // Sculpted Anime Hair (Solid dark clumps with 5 sweeping scythe locks)
    g.fillStyle = '#14100c';
    g.beginPath();
    g.moveTo(ax - 18, ay - 68);
    g.quadraticCurveTo(ax - 42, ay - 96, ax - 38, ay - 116);
    g.lineTo(ax - 24, ay - 88);
    g.quadraticCurveTo(ax - 22, ay - 118, ax - 10, ay - 126);
    g.lineTo(ax - 2, ay - 94);
    g.quadraticCurveTo(ax + 8, ay - 124, ax + 24, ay - 120);
    g.lineTo(ax + 16, ay - 90);
    g.quadraticCurveTo(ax + 32, ay - 104, ax + 38, ay - 92);
    g.lineTo(ax + 18, ay - 72);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.5;
    g.stroke();
    // Hair highlights
    g.strokeStyle = '#4a3728';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(ax - 26, ay - 90);
    g.lineTo(ax - 32, ay - 108);
    g.moveTo(ax - 10, ay - 94);
    g.lineTo(ax - 14, ay - 114);
    g.moveTo(ax + 8, ay - 92);
    g.lineTo(ax + 14, ay - 110);
    g.stroke();

    // Volumetric Arms
    // Left Arm holding Swag Bag
    g.fillStyle = '#faeed7';
    g.beginPath();
    g.moveTo(ax - 16, ay - 40);
    g.lineTo(ax - 42, ay - 16);
    g.lineTo(ax - 36, ay - 10);
    g.lineTo(ax - 12, ay - 34);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.6;
    g.stroke();
    g.beginPath();
    g.moveTo(ax - 42, ay - 16);
    g.lineTo(ax - 56, ay + 14);
    g.lineTo(ax - 48, ay + 18);
    g.lineTo(ax - 36, ay - 10);
    g.closePath();
    g.fill();
    g.stroke();
    // Swag money bag
    g.fillStyle = '#1c1612';
    g.beginPath();
    g.arc(ax - 56, ay + 38, 22, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#ca8a04';
    g.fillRect(ax - 62, ay + 14, 12, 8);
    g.strokeRect(ax - 62, ay + 14, 12, 8);
    g.fillStyle = '#fef08a';
    g.font = 'bold 18px serif';
    g.textAlign = 'center';
    g.fillText('$', ax - 56, ay + 44);

    // Right Arm reaching to Character B
    g.fillStyle = '#faeed7';
    g.beginPath();
    g.moveTo(ax + 14, ay - 40);
    g.lineTo(ax + 46, ay - 20);
    g.lineTo(ax + 42, ay - 14);
    g.lineTo(ax + 10, ay - 34);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.6;
    g.stroke();
    g.beginPath();
    g.moveTo(ax + 46, ay - 20);
    g.lineTo(ax + 72, ay - 14);
    g.lineTo(ax + 70, ay - 8);
    g.lineTo(ax + 42, ay - 14);
    g.closePath();
    g.fill();
    g.stroke();

    // 3D Layered Cloth Scarf (Cowl Neck Wrap & Dual Billowing Tails)
    g.fillStyle = '#7f1d1d';
    g.beginPath();
    g.ellipse(ax + 2, ay - 44, 20, 11, -0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.ellipse(ax + 2, ay - 47, 19, 9, -0.05, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.0;
    g.stroke();

    // Scarf Tail 1 (Underside dark crimson #881337 + Top face #dc2626)
    g.fillStyle = '#881337';
    g.beginPath();
    g.moveTo(ax - 8, ay - 46);
    g.bezierCurveTo(ax - 60, ay - 58, ax - 110, ay - 38, ax - 180, ay - 70);
    g.lineTo(ax - 180, ay - 58);
    g.bezierCurveTo(ax - 110, ay - 26, ax - 60, ay - 46, ax - 8, ay - 36);
    g.closePath();
    g.fill();
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.moveTo(ax - 8, ay - 50);
    g.bezierCurveTo(ax - 60, ay - 62, ax - 110, ay - 42, ax - 180, ay - 74);
    g.lineTo(ax - 180, ay - 64);
    g.bezierCurveTo(ax - 110, ay - 32, ax - 60, ay - 50, ax - 8, ay - 40);
    g.closePath();
    g.fill();
    g.strokeStyle = '#7f1d1d';
    g.lineWidth = 2.4;
    g.stroke();

    // Scarf Tail 2 (Offset lower ribbon)
    g.fillStyle = '#991b1b';
    g.beginPath();
    g.moveTo(ax - 12, ay - 42);
    g.bezierCurveTo(ax - 50, ay - 36, ax - 95, ay - 60, ax - 150, ay - 44);
    g.lineTo(ax - 150, ay - 34);
    g.bezierCurveTo(ax - 95, ay - 50, ax - 50, ay - 26, ax - 12, ay - 32);
    g.closePath();
    g.fill();
    g.stroke();

    // Fold cross-hatching & frayed whiskers
    g.strokeStyle = 'rgba(30, 15, 10, 0.45)';
    g.lineWidth = 1.6;
    for (let f = 0; f < 4; f++) {
      const fx = ax - 45 - f * 28;
      const fy = ay - 48 + f * 4;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx - 8, fy + 12);
      g.stroke();
    }
    g.strokeStyle = '#ef4444';
    g.lineWidth = 1.8;
    for (let th = 0; th < 4; th++) {
      g.beginPath();
      g.moveTo(ax - 180, ay - 68 + th * 3);
      g.lineTo(ax - 198 - th * 4, ay - 72 + th * 5);
      g.stroke();
    }

    // CHARACTER B (Right: The Pilot - Tweed Newsboy Cap, Aviator Shades, Leather Bomber Jacket)
    const bx = cx + 75, by = cy + 15;

    // Faint 2B graphite guide line
    g.strokeStyle = 'rgba(65, 50, 36, 0.25)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(bx, by - 110);
    g.quadraticCurveTo(bx - 5, by - 40, bx + 10, by + 118);
    g.stroke();

    // Volumetric Trousers & Heavy Work Boots
    // Front Leg
    g.fillStyle = '#334155';
    g.beginPath();
    g.moveTo(bx - 6, by + 32);
    g.lineTo(bx + 12, by + 32);
    g.lineTo(bx + 28, by + 72);
    g.lineTo(bx + 14, by + 76);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.8;
    g.stroke();
    g.beginPath();
    g.moveTo(bx + 14, by + 76);
    g.lineTo(bx + 28, by + 72);
    g.lineTo(bx + 38, ay + 112);
    g.lineTo(bx + 24, ay + 114);
    g.closePath();
    g.fill();
    g.stroke();
    // Front Work Boot
    g.fillStyle = '#150d09';
    g.fillRect(bx + 20, ay + 108, 30, 14);
    g.strokeRect(bx + 20, ay + 108, 30, 14);

    // Rear Leg
    g.fillStyle = '#1e293b';
    g.beginPath();
    g.moveTo(bx - 18, by + 32);
    g.lineTo(bx - 2, by + 32);
    g.lineTo(bx - 20, by + 74);
    g.lineTo(bx - 34, by + 70);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(bx - 34, by + 70);
    g.lineTo(bx - 20, by + 74);
    g.lineTo(bx - 26, by + 112);
    g.lineTo(bx - 40, by + 110);
    g.closePath();
    g.fill();
    g.stroke();
    // Rear Boot
    g.fillStyle = '#150d09';
    g.fillRect(bx - 48, by + 108, 28, 14);
    g.strokeRect(bx - 48, by + 108, 28, 14);

    // Volumetric Leather Bomber Jacket Torso
    g.fillStyle = '#2c1e15';
    g.beginPath();
    g.moveTo(bx - 20, by - 42);
    g.lineTo(bx + 20, by - 42);
    g.lineTo(bx + 15, by + 32);
    g.lineTo(bx - 15, by + 32);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 4.0;
    g.stroke();
    // Silver zipper & shearling lapel notches
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 2.0;
    g.beginPath();
    g.moveTo(bx, by - 42);
    g.lineTo(bx, by + 32);
    g.stroke();
    g.strokeStyle = '#ca8a04';
    g.lineWidth = 3.0;
    g.beginPath();
    g.moveTo(bx - 20, by - 42);
    g.lineTo(bx - 8, by - 24);
    g.moveTo(bx + 20, by - 42);
    g.lineTo(bx + 8, by - 24);
    g.stroke();
    // Elastic waistband
    g.fillStyle = '#1a140e';
    g.fillRect(bx - 16, by + 24, 32, 10);
    g.strokeRect(bx - 16, by + 24, 32, 10);

    // Head & Smirk
    g.fillStyle = '#f5e6ce';
    g.beginPath();
    g.moveTo(bx - 12, by - 68);
    g.quadraticCurveTo(bx, by - 82, bx + 16, by - 68);
    g.quadraticCurveTo(bx + 20, by - 50, bx + 14, by - 42);
    g.lineTo(bx - 4, by - 38);
    g.lineTo(bx - 12, by - 44);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.5;
    g.stroke();
    // Smirk mouth & chin cleft
    g.beginPath();
    g.moveTo(bx, by - 46);
    g.lineTo(bx + 12, by - 50);
    g.stroke();

    // Puffed Tweed Newsboy Cap (4 Panels & Top Button)
    g.fillStyle = '#261b14';
    g.beginPath();
    g.moveTo(bx - 22, by - 66);
    g.quadraticCurveTo(bx - 18, by - 96, bx + 4, by - 96);
    g.quadraticCurveTo(bx + 30, by - 94, bx + 34, by - 72);
    g.lineTo(bx + 14, by - 72);
    g.closePath();
    g.fill();
    g.stroke();
    // Panel seam lines & crown button
    g.strokeStyle = '#110e0c';
    g.lineWidth = 2.0;
    g.beginPath();
    g.moveTo(bx - 6, by - 94);
    g.lineTo(bx + 6, by - 78);
    g.moveTo(bx + 12, by - 94);
    g.lineTo(bx + 22, by - 76);
    g.stroke();
    g.beginPath();
    g.arc(bx + 4, by - 96, 3.5, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Cap Visor & Cross-Hatch Shadow (///)
    g.fillStyle = '#110e0c';
    g.beginPath();
    g.moveTo(bx - 12, by - 68);
    g.lineTo(bx + 36, by - 68);
    g.lineTo(bx + 18, by - 76);
    g.closePath();
    g.fill();
    g.stroke();
    g.strokeStyle = '#4a3828';
    g.lineWidth = 1.6;
    for (let hx = 0; hx <= 28; hx += 7) {
      g.beginPath();
      g.moveTo(bx - 6 + hx, by - 68);
      g.lineTo(bx - 12 + hx, by - 76);
      g.stroke();
    }

    // Aviator Sunglasses with Diagonal Glare Slashes (//)
    g.fillStyle = '#0f172a';
    g.fillRect(bx + 4, by - 66, 18, 10);
    g.strokeRect(bx + 4, by - 66, 18, 10);
    g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(bx + 8, by - 58);
    g.lineTo(bx + 16, by - 64);
    g.moveTo(bx + 12, by - 58);
    g.lineTo(bx + 19, by - 64);
    g.stroke();

    // Volumetric Leather Sleeves & Driving Gloves
    // Left Arm (Reaching back to clasp A's hand)
    g.fillStyle = '#2c1e15';
    g.beginPath();
    g.moveTo(bx - 18, by - 40);
    g.lineTo(bx - 48, by - 22);
    g.lineTo(bx - 44, by - 16);
    g.lineTo(bx - 14, by - 34);
    g.closePath();
    g.fill();
    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.6;
    g.stroke();
    g.beginPath();
    g.moveTo(bx - 48, by - 22);
    g.lineTo(bx - 70, by - 14);
    g.lineTo(bx - 68, by - 8);
    g.lineTo(bx - 44, by - 16);
    g.closePath();
    g.fill();
    g.stroke();

    // Right Arm (Pumping forward into the sprint)
    g.beginPath();
    g.moveTo(bx + 16, by - 40);
    g.lineTo(bx + 44, by - 24);
    g.lineTo(bx + 40, by - 18);
    g.lineTo(bx + 12, by - 34);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(bx + 44, by - 24);
    g.lineTo(bx + 64, by - 20);
    g.lineTo(bx + 62, by - 14);
    g.lineTo(bx + 40, by - 18);
    g.closePath();
    g.fill();
    g.stroke();
    // Driving glove
    g.fillStyle = '#150d09';
    g.fillRect(bx + 62, by - 24, 12, 12);
    g.strokeRect(bx + 62, by - 24, 12, 12);

    // AUTHENTIC INTERLOCKED HAND CLASP AT CENTER (cx, cy - 10)
    g.strokeStyle = 'rgba(65, 50, 36, 0.28)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(cx, cy - 10, 12, 8, 0, 0, Math.PI * 2);
    g.stroke();

    g.fillStyle = '#faeed7';
    g.beginPath();
    g.ellipse(cx - 4, cy - 10, 8, 6, -0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#150d09';
    g.beginPath();
    g.ellipse(cx + 4, cy - 10, 8, 7, 0.2, 0, Math.PI * 2);
    g.fill();

    g.strokeStyle = '#110e0c';
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(cx - 1, cy - 12, 6, 0, Math.PI * 2);
    g.moveTo(cx - 9, cy - 11);
    g.lineTo(cx + 4, cy - 11);
    g.moveTo(cx - 3, cy - 7);
    g.lineTo(cx + 9, cy - 7);
    g.moveTo(cx - 2, cy - 14);
    g.lineTo(cx, cy - 4);
    g.stroke();

    // Centered Quote
    g.fillStyle = '#8b2500';
    g.font = 'italic 23px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('"Every stroke is final. Do or die, I\'ll be in your arms."', 1536, 740);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;

    // 1. Book Cover Opens (t = 13.2s..13.8s)
    if (t < 13.2) {
      this.frontCoverPivot.rotation.z = 0;
      this.frontCoverPivot.position.y = 0.006 + 0.026;
      this.leftSpreadMesh.visible = false;
      for (let i = 0; i < this.NUM_PAGES; i++) this.pages[i]!.visible = true;
    } else if (t < 13.8) {
      const uCover = (t - 13.2) / 0.60;
      const easeCover = uCover * uCover * (3 - 2 * uCover);
      this.frontCoverPivot.rotation.z = easeCover * Math.PI;
      this.frontCoverPivot.position.y = THREE.MathUtils.lerp(0.006 + 0.026, 0.006, easeCover);
      this.leftSpreadMesh.visible = false;
      for (let i = 0; i < this.NUM_PAGES; i++) this.pages[i]!.visible = true;
    } else {
      this.frontCoverPivot.rotation.z = Math.PI;
      this.frontCoverPivot.position.y = 0.006;
      const isSettled = t >= 15.4;
      this.leftSpreadMesh.visible = isSettled;
      for (let i = 0; i < this.NUM_PAGES; i++) {
        this.pages[i]!.visible = !isSettled;
      }
    }

    // 2. High-Speed Flutter Cascade (t = 13.8s..15.5s):
    // 32 folios rapidly cascade open and decelerate to reveal title spread
    const flutterStart = 13.8;
    const flutterEnd = 15.5;
    let flippedCount = 0;

    for (let i = 0; i < this.NUM_PAGES; i++) {
      const pageTStart = flutterStart + (i / this.NUM_PAGES) * 1.35;
      const pageDur = 0.36;

      if (t < pageTStart) {
        // Flat on right side
        this.pages[i]!.rotation.z = 0;
        this.pages[i]!.position.y = 0.006 + 0.003 + (this.NUM_PAGES - 1 - i) * (0.026 / this.NUM_PAGES);
      } else if (t < pageTStart + pageDur) {
        // Flipping open with aerodynamic curve
        const uPage = (t - pageTStart) / pageDur;
        const easePage = uPage * uPage * (3 - 2 * uPage);
        this.pages[i]!.rotation.z = easePage * Math.PI;
        // Bending arch lift
        this.pages[i]!.position.y = 0.006 + Math.sin(easePage * Math.PI) * 0.035;
      } else {
        // Settled open on left stack
        this.pages[i]!.rotation.z = Math.PI;
        this.pages[i]!.position.y = 0.006 + 0.003 + i * (0.026 / this.NUM_PAGES);
        flippedCount++;
      }
    }

    // Dynamic right block shrink and left block growth
    const rightScale = Math.max(0.01, 1.0 - flippedCount / this.NUM_PAGES);
    this.rightPageBlock.scale.y = rightScale;
    const leftScale = Math.max(0.01, flippedCount / this.NUM_PAGES);
    this.leftPageBlock.scale.y = leftScale;

    // 3. Camera Choreography:
    // t = 13.0..13.5: Settled landing framing, holding steady with colour_room
    // t = 13.5..15.6: Overhead angled tracking shot framing the fluttering book
    // t = 15.6..17.0: Dramatic macro plunge diving directly into "NO TAKEBACKS"
    if (t < 13.5) {
      this.camera.position.set(0.12, 1.28, 0.48);
      this.camera.lookAt(0.12, 0.836, 0.08);
    } else if (t < 15.6) {
      const uCam = (t - 13.5) / 2.1;
      this.camera.position.set(
        THREE.MathUtils.lerp(0.12, 0.16, uCam),
        THREE.MathUtils.lerp(1.28, 1.21, uCam),
        THREE.MathUtils.lerp(0.48, 0.42, uCam)
      );
      this.camera.lookAt(0.12, 0.836, 0.08);
    } else {
      // Macro Dive into the Title Spread on Right Page (x = 0.24, y = 0.842, z = 0.08)
      const uDive = Math.min(1.0, (t - 15.6) / 1.4);
      const easeDive = uDive * uDive * (3 - 2 * uDive);

      const titleTarget = new THREE.Vector3(0.24, 0.842, 0.08);
      this.camera.position.set(
        THREE.MathUtils.lerp(0.16, titleTarget.x, easeDive),
        THREE.MathUtils.lerp(1.21, titleTarget.y + 0.12, easeDive),
        THREE.MathUtils.lerp(0.42, titleTarget.z + 0.04, easeDive)
      );
      this.camera.lookAt(titleTarget);
    }

    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      exposure: 1.25,
      bloom: 0.32,
      bloomRadius: 0.38,
      vignette: 0.35,
      grain: 0.05,
    };
  }
}

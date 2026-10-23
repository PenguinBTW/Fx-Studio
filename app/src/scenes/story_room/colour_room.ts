// SCENE 3: COLOUR ROOM & THE FLYING TOME (8.5s - 13.5s)
// Chromatic Bloom into rich PBR materials -> Lamp turns on ->
// Zoom into Hero Book on shelf -> 3D Ballistic Flight across room -> Cushioned desk landing.
// Strictly Closed-Form Frame = f(t), Zero State Leaks

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { buildDetailedRoomProps, StoryRoomGeometry, type PropDef } from './room_assets';

interface ColourMeshRecord {
  mesh: THREE.Mesh;
  def: PropDef;
  targetColor: THREE.Color;
  targetRoughness: number;
  targetMetalness: number;
}

export default class ColourRoom extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private meshes: ColourMeshRecord[] = [];

  // Hero Book Assembly
  private heroBookGroup: THREE.Group;
  private heroBookBody: THREE.Mesh;
  private heroBookPages: THREE.Mesh;
  private heroBookRibbon: THREE.Mesh;

  // Cinematic Lighting
  private keyLight: THREE.DirectionalLight;
  private deskLampLight: THREE.PointLight;
  private fillLight: THREE.DirectionalLight;
  private ambLight: THREE.AmbientLight;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);

    this.scene.background = new THREE.Color(0x0c101a);

    // 1. Lighting Setup
    this.keyLight = new THREE.DirectionalLight(0xfff3e0, 1.8);
    this.keyLight.position.set(-2.5, 4.5, 2.5);
    this.scene.add(this.keyLight);

    // Warm Architect Lamp Light (Turns on at t = 9.2s)
    this.deskLampLight = new THREE.PointLight(0xffb74d, 2.2, 5.0, 1.2);
    this.deskLampLight.position.set(-0.31, 1.21, 0.05);
    this.scene.add(this.deskLampLight);

    this.fillLight = new THREE.DirectionalLight(0xdbeafe, 0.7);
    this.fillLight.position.set(3.0, 3.2, 1.2);
    this.scene.add(this.fillLight);

    this.ambLight = new THREE.AmbientLight(0x2d3748, 0.85);
    this.scene.add(this.ambLight);

    // 2. Build 3D PBR Meshes for all room props
    const props = buildDetailedRoomProps();

    for (const p of props) {
      let geom: THREE.BufferGeometry;

      if (p.geomType === 'box') {
        const [w, h, d] = p.geomParams;
        geom = new THREE.BoxGeometry(w, h, d);
      } else if (p.geomType === 'cylinder') {
        const [rt, rb, h, segs] = p.geomParams;
        geom = new THREE.CylinderGeometry(rt, rb, h, segs || 16);
      } else if (p.geomType === 'cone') {
        const [r, h, segs] = p.geomParams;
        geom = new THREE.ConeGeometry(r, h, segs || 16);
      } else if (p.geomType === 'sphere') {
        const [r, wSegs, hSegs] = p.geomParams;
        geom = new THREE.SphereGeometry(r, wSegs || 16, hSegs || 16);
      } else if (p.geomType === 'torus') {
        const [r, tube, radSegs, tubSegs] = p.geomParams;
        geom = new THREE.TorusGeometry(r, tube, radSegs || 12, tubSegs || 24);
      } else {
        geom = new THREE.BoxGeometry(1, 1, 1);
      }

      const isMat = p.id === 'desk_mat';
      const isTri = p.id === 'tool_triangle30';
      const mat = new THREE.MeshStandardMaterial({
        color: p.color.clone(),
        roughness: p.roughness,
        metalness: p.metalness,
        map: isMat ? this.createCuttingMatTexture() : null,
        transparent: isTri,
        opacity: isTri ? 0.85 : 1.0,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(p.pos);
      mesh.rotation.copy(p.rot);
      mesh.scale.copy(p.scale);

      this.scene.add(mesh);
      this.meshes.push({
        mesh,
        def: p,
        targetColor: isMat ? new THREE.Color(0xffffff) : p.color.clone(),
        targetRoughness: p.roughness,
        targetMetalness: p.metalness,
      });
    }

    // 3. Hero Crimson Book with Gilded Pages & Bookmark Ribbon (0.28 x 0.035 x 0.38)
    this.heroBookGroup = new THREE.Group();

    // Leather cover with gold embossed cartouche matching rapid_flutter
    const bodyGeo = new THREE.BoxGeometry(0.28, 0.035, 0.38);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x6b1122), // Rich royal crimson calfskin
      roughness: 0.30,
      metalness: 0.12,
    });
    const coverOuterMat = new THREE.MeshStandardMaterial({
      map: this.createCoverTexture(),
      roughness: 0.26,
      metalness: 0.15,
    });
    this.heroBookBody = new THREE.Mesh(bodyGeo, [
      bodyMat,
      bodyMat,
      coverOuterMat, // Top face
      bodyMat,       // Bottom face
      bodyMat,
      bodyMat,
    ]);
    this.heroBookGroup.add(this.heroBookBody);

    // Gilded Page Edges
    const pagesGeo = new THREE.BoxGeometry(0.265, 0.028, 0.36);
    const pagesMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xd4af37), // Burnished gold leaf
      roughness: 0.25,
      metalness: 0.85,
    });
    this.heroBookPages = new THREE.Mesh(pagesGeo, pagesMat);
    this.heroBookPages.position.set(0.005, 0, 0);
    this.heroBookGroup.add(this.heroBookPages);

    // Crimson Bookmark Ribbon trailing out
    const ribbonGeo = new THREE.BoxGeometry(0.018, 0.003, 0.18);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xef4444), // Vivid scarlet ribbon
      roughness: 0.35,
      metalness: 0.05,
    });
    this.heroBookRibbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    this.heroBookRibbon.position.set(0.04, 0.015, 0.22);
    this.heroBookGroup.add(this.heroBookRibbon);

    this.scene.add(this.heroBookGroup);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;

    // 1. Chromatic Bloom Transition (t = 8.5s..9.8s):
    // Colors bloom from clay chalk into rich jewel & wood PBR materials
    const bloomProgress = Math.min(1.0, Math.max(0.0, (t - 8.5) / 1.3));
    const chalkColor = new THREE.Color(0xf1f5f9);

    for (const rec of this.meshes) {
      const mat = rec.mesh.material as THREE.MeshStandardMaterial;
      mat.color.lerpColors(chalkColor, rec.targetColor, bloomProgress);
      mat.roughness = THREE.MathUtils.lerp(0.85, rec.targetRoughness, bloomProgress);
      mat.metalness = THREE.MathUtils.lerp(0.02, rec.targetMetalness, bloomProgress);
    }

    // 2. Lamp Light Turn-On (t = 9.2s):
    // Click on with incandescent filament flare
    if (t < 9.2) {
      this.deskLampLight.intensity = 0.0;
    } else {
      const lampWarmup = Math.min(1.0, (t - 9.2) / 0.25);
      this.deskLampLight.intensity = 2.2 * lampWarmup;
    }

    // 3. Hero Book Kinematics:
    // Sitting on shelf -> slides forward -> ballistic flight -> cushioned desk landing
    const bookKin = StoryRoomGeometry.evalHeroBook(t);
    this.heroBookGroup.position.copy(bookKin.pos);
    this.heroBookGroup.rotation.copy(bookKin.rot);

    // Ribbon flutter during flight
    if (t >= 11.0 && t < 13.0) {
      const flutter = Math.sin(t * 24.0) * 0.25;
      this.heroBookRibbon.rotation.z = flutter;
    } else {
      this.heroBookRibbon.rotation.z = 0;
    }

    // 4. Camera Choreography Across Stages:
    // Stage A (8.5s - 9.8s): Establishing shot of room blooming with colour & lamp turning on
    // Stage B (9.8s - 11.0s): Cranes up and zooms tight onto the Hero Book on Shelf 3
    // Stage C (11.0s - 13.0s): Follows the flying book dynamically across the room
    // Stage D (13.0s - 13.5s): Settles above the book on the desk, framing the landing
    if (t < 9.8) {
      const uA = (t - 8.5) / 1.3;
      this.camera.position.set(
        THREE.MathUtils.lerp(0.55, 0.65, uA),
        THREE.MathUtils.lerp(1.55, 1.62, uA),
        THREE.MathUtils.lerp(1.65, 1.55, uA)
      );
      this.camera.lookAt(0.65, 1.45, -0.85);
    } else if (t < 11.0) {
      // Zoom into bookshelf focusing on the hero book
      const uB = (t - 9.8) / 1.2;
      const easeB = uB * uB * (3 - 2 * uB);
      this.camera.position.set(
        THREE.MathUtils.lerp(0.65, 0.72, easeB),
        THREE.MathUtils.lerp(1.62, 1.66, easeB),
        THREE.MathUtils.lerp(1.55, -0.35, easeB)
      );
      this.camera.lookAt(0.96, 1.62, -0.96);
    } else if (t < 12.7) {
      // Dynamic tracking shot following the flying book
      const uC = (t - 11.0) / 1.7;
      this.camera.position.set(
        THREE.MathUtils.lerp(1.15, 0.25, uC) + Math.sin(uC * Math.PI) * 0.35,
        THREE.MathUtils.lerp(1.95, 1.32, uC) + Math.sin(uC * Math.PI) * 0.22,
        THREE.MathUtils.lerp(0.25, 0.72, uC)
      );
      this.camera.lookAt(bookKin.pos);
    } else if (t < 13.0) {
      // Smooth deceleration settling directly into rapid_flutter framing
      const uD = (t - 12.7) / 0.3;
      const easeD = uD * uD * (3 - 2 * uD);
      this.camera.position.set(
        THREE.MathUtils.lerp(0.25, 0.12, easeD),
        THREE.MathUtils.lerp(1.32, 1.28, easeD),
        THREE.MathUtils.lerp(0.72, 0.48, easeD)
      );
      this.camera.lookAt(0.12, 0.836, 0.08);
    } else {
      // Settled landing shot on desk, matching rapid_flutter start 100% bit-identically
      this.camera.position.set(0.12, 1.28, 0.48);
      this.camera.lookAt(0.12, 0.836, 0.08);
    }

    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      exposure: 1.22,
      bloom: 0.38,
      bloomRadius: 0.42,
      vignette: 0.35,
      grain: 0.05,
    };
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
}

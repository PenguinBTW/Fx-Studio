// SCENE: THE EXPANDING CIRCLE (0.0s - 28.0s)
// Master Procedural Impasto Oil-Paint Recreation of "The Expanding Moral Circle"
// High-Fidelity Look-Dev Implementation faithfully matching the reference keyframes (1:57 - 2:25).

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { ease, TAU } from '../../engine/util';

import { PainterlyBrush } from './painterly_brush';
import { PainterlyTypography } from './painterly_typography';
import { WoodMannequin } from './wood_mannequin';
import { ArchitecturalElements } from './architectural_elements';

export default class ExpandingCircleScene extends Scene {
  private threeScene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private c2d: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;

  private brush: PainterlyBrush;
  private typo: PainterlyTypography;
  private mannequin: WoodMannequin;
  private arch: ArchitecturalElements;

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;

    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Failed to acquire 2D context for ExpandingCircleScene');
    this.c2d = context;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture });
    this.mesh = new THREE.Mesh(geo, mat);
    this.threeScene.add(this.mesh);

    // Initialize the specialized painterly engines
    this.brush = new PainterlyBrush(this.c2d);
    this.typo = new PainterlyTypography(this.c2d, this.brush);
    this.mannequin = new WoodMannequin(this.c2d, this.brush);
    this.arch = new ArchitecturalElements(this.c2d, this.brush, this.typo, this.mannequin);
  }

  // =========================================================================
  // MAIN SCENE RENDER LOOP (28.00s @ 60 FPS)
  // =========================================================================
  render(frame: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { t } = frame;
    const { W, H, renderer } = this.ctx;
    const ctx = this.c2d;

    ctx.clearRect(0, 0, W, H);

    // -------------------------------------------------------------------------
    // 1. DYNAMIC ATMOSPHERIC SKY SYSTEM (SEAMLESS CONTINUOUS GRADIENTS)
    // -------------------------------------------------------------------------
    // Base layer: Warm Linen Parchment Canvas (Act I, fades out smoothly into Act II)
    if (t < 4.2) {
      const pAlpha = t < 3.2 ? 1.0 : Math.max(0, 1.0 - (t - 3.2) / 1.0);
      ctx.save();
      ctx.globalAlpha = pAlpha;
      ctx.fillStyle = '#f5efe6';
      ctx.fillRect(0, 0, W, H);

      // Authentic multi-directional woven linen canvas tooth
      ctx.strokeStyle = 'rgba(205, 192, 178, 0.22)';
      ctx.lineWidth = 1.0;
      for (let y = 6; y < H; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(205, 192, 178, 0.18)';
      for (let x = 6; x < W; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let i = 0; i < 350; i++) {
        const fx = ((i * 187.3) % W);
        const fy = ((i * 123.7) % H);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 165, 150, 0.22)' : 'rgba(255, 255, 255, 0.28)';
        ctx.fillRect(fx, fy, 2, 1);
      }
      ctx.restore();
    }

    // Act II: Soft Muted Cerulean/Lavender Sky (blends in at t=2.8, blends out at t=7.2)
    if (t > 2.8 && t < 8.2) {
      const s2Alpha = t < 3.8 ? (t - 2.8) / 1.0 : t > 7.0 ? Math.max(0, 1.0 - (t - 7.0) / 1.2) : 1.0;
      ctx.save();
      ctx.globalAlpha = s2Alpha;
      const skyGrad2 = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad2.addColorStop(0, '#8ea3b8');
      skyGrad2.addColorStop(0.35, '#b4c7d9');
      skyGrad2.addColorStop(0.70, '#d8e4ee');
      skyGrad2.addColorStop(1, '#eee6dc');
      ctx.fillStyle = skyGrad2;
      ctx.fillRect(0, 0, W, H);

      this.brush.paintSkyCloud(W * 0.16 + (t - 3.8) * 3, H * 0.12, 145, 18, 1);
      this.brush.paintSkyCloud(W * 0.54 + (t - 3.8) * 2, H * 0.07, 180, 20, 2);
      this.brush.paintSkyCloud(W * 0.86 + (t - 3.8) * 4, H * 0.15, 155, 18, 3);
      this.brush.paintSkyCloud(W * 0.36 + (t - 3.8) * 2, H * 0.20, 120, 16, 4);
      ctx.restore();
    }

    // Act III: Radiant Mediterranean Azure Blue Sky (blends in at t=6.8, blends out at t=13.0)
    if (t > 6.8 && t < 13.8) {
      const s3Alpha = t < 8.0 ? (t - 6.8) / 1.2 : t > 12.2 ? Math.max(0, 1.0 - (t - 12.2) / 1.6) : 1.0;
      ctx.save();
      ctx.globalAlpha = s3Alpha;
      const skyGrad3 = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad3.addColorStop(0, '#1d4ed8');
      skyGrad3.addColorStop(0.30, '#2563eb');
      skyGrad3.addColorStop(0.65, '#60a5fa');
      skyGrad3.addColorStop(1, '#bfdbfe');
      ctx.fillStyle = skyGrad3;
      ctx.fillRect(0, 0, W, H);

      this.brush.paintSkyCloud(W * 0.18 + (t - 7.5) * 4, H * 0.10, 165, 20, 5);
      this.brush.paintSkyCloud(W * 0.58 + (t - 7.5) * 3, H * 0.06, 210, 22, 6);
      this.brush.paintSkyCloud(W * 0.88 + (t - 7.5) * 5, H * 0.14, 175, 20, 7);
      this.brush.paintSkyCloud(W * 0.38 + (t - 7.5) * 3, H * 0.18, 135, 18, 8);
      ctx.restore();
    }

    // Act IV: Royal Azure Blue Sky with Sweeping Circular Brushstrokes (blends in at t=11.8, shifts to sunset)
    if (t > 11.8 && t < 18.0) {
      const s4Alpha = t < 13.0 ? (t - 11.8) / 1.2 : t > 16.5 ? Math.max(0, 1.0 - (t - 16.5) / 1.5) : 1.0;
      ctx.save();
      ctx.globalAlpha = s4Alpha;

      const sunsetU = t < 15.5 ? 0 : Math.min(1.0, (t - 15.5) / 2.0);
      const skyGrad4 = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad4.addColorStop(0, sunsetU < 0.5 ? '#1d4ed8' : '#312e81');
      skyGrad4.addColorStop(0.40, sunsetU < 0.5 ? '#2563eb' : '#4338ca');
      skyGrad4.addColorStop(0.75, sunsetU < 0.5 ? '#60a5fa' : '#818cf8');
      skyGrad4.addColorStop(1, sunsetU < 0.5 ? '#bfdbfe' : '#fed7aa');
      ctx.fillStyle = skyGrad4;
      ctx.fillRect(0, 0, W, H);

      this.brush.paintSkyCloud(W * 0.14, H * 0.24, 130, 16, 10);
      this.brush.paintSkyCloud(W * 0.24, H * 0.35, 105, 14, 11);
      this.brush.paintSkyCloud(W * 0.65, H * 0.11, 140, 18, 12);
      this.brush.paintSkyCloud(W * 0.92, H * 0.16, 150, 18, 13);
      ctx.restore();
    }

    // Act V: Radiant Twilight Dome with Glowing Violet Horizon (blends in at t=15.8, recedes at t=20.5)
    if (t > 15.8 && t < 21.5) {
      const s5Alpha = t < 17.0 ? (t - 15.8) / 1.2 : t > 20.0 ? Math.max(0, 1.0 - (t - 20.0) / 1.5) : 1.0;
      ctx.save();
      ctx.globalAlpha = s5Alpha;
      const skyGrad5 = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad5.addColorStop(0, '#060814');
      skyGrad5.addColorStop(0.35, '#0f142e');
      skyGrad5.addColorStop(0.65, '#2e1b4d');
      skyGrad5.addColorStop(0.85, '#5b21b6');
      skyGrad5.addColorStop(1, '#7c3aed');
      ctx.fillStyle = skyGrad5;
      ctx.fillRect(0, 0, W, H);

      const cityX = W * 0.50;
      const arcR = H * 0.95;
      const arcCenterY = H * 0.54 + arcR;
      for (let tr = 0; tr < 5; tr++) {
        const r = arcR + 25 + tr * 35;
        const alpha = 0.35 - tr * 0.06;
        ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
        ctx.lineWidth = 35;
        ctx.beginPath();
        ctx.arc(cityX, arcCenterY, r, -Math.PI * 0.88, -Math.PI * 0.12, false);
        ctx.stroke();
      }

      // Concentric circular star trail vortex arched over metropolis
      const poleX = W * 0.50;
      const poleY = -H * 0.08;
      for (let r = 180; r < 1650; r += 26) {
        const trailAlpha = 0.22 + ((r * 11) % 7) * 0.09;
        ctx.strokeStyle = r % 4 === 0 ? `rgba(255, 255, 255, ${trailAlpha})` : r % 4 === 1 ? `rgba(216, 180, 254, ${trailAlpha * 0.85})` : `rgba(192, 132, 252, ${trailAlpha * 0.70})`;
        ctx.lineWidth = 1.4 + ((r % 3) * 0.6);
        const trailSpan = 0.28 + ((r * 13) % 9) * 0.05;
        const startA = (r * 0.18 - t * 0.10) % TAU;
        ctx.beginPath();
        ctx.arc(poleX, poleY, r, startA, startA + trailSpan);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Acts VI & VII: Deep Cosmic Space Void with Multi-Magnitude Stars (present from t=19.8 onward)
    if (t > 19.8) {
      const sSpaceAlpha = Math.min(1.0, (t - 19.8) / 1.0);
      ctx.save();
      ctx.globalAlpha = sSpaceAlpha;
      ctx.fillStyle = '#04060d';
      ctx.fillRect(0, 0, W, H);

      for (let s = 0; s < 250; s++) {
        const sx = ((s * 137.5) % W);
        const sy = ((s * 93.7) % H);
        const sz = 1.0 + ((s % 4) * 0.9);
        const twk = 0.4 + 0.6 * Math.sin(t * 3.5 + s);
        ctx.fillStyle = s % 6 === 0 ? `rgba(254, 240, 138, ${twk})` : `rgba(255, 255, 255, ${twk})`;
        ctx.fillRect(sx, sy, sz, sz);

        if (s % 28 === 0) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${twk * 0.8})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(sx - 6, sy);
          ctx.lineTo(sx + 6, sy);
          ctx.moveTo(sx, sy - 6);
          ctx.lineTo(sx, sy + 6);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // =========================================================================
    // 2. PHASE 1: ACT I & II - PALEOLITHIC HEARTH TO NEOLITHIC VILLAGE (0.0s - 8.2s)
    // =========================================================================
    if (t < 8.2) {
      const groundY = H * 0.75;
      const famX = W * 0.38 + 16;

      // CONTINUOUS CAMERA CHOREOGRAPHY:
      // Act I macro hearth zoom (t < 2.5s: 3.8x zoom on family) smoothly pulls back to
      // village panorama (t = 4.2s: 1.0x scale).
      // Then at t = 6.2s - 8.0s, camera pans right through the timber gate into the coast!
      const uZoom = t < 2.5 ? 0 : Math.min(1.0, (t - 2.5) / 1.7);
      const eZoom = ease.inOutCubic(uZoom);
      const camZoom = 3.8 - eZoom * (3.8 - 1.0);

      const uPan = t < 6.2 ? 0 : Math.min(1.0, (t - 6.2) / 1.8);
      const ePan = ease.inOutCubic(uPan);

      // Target focus when zoomed in on family:
      const initTx = W * 0.50 - famX * 3.8;
      const initTy = H * 0.62 - (groundY - 45) * 3.8;
      const curTx = (1 - eZoom) * initTx - eZoom * (ePan * W);
      const curTy = (1 - eZoom) * initTy + eZoom * (ePan * 18);
      const curRot = -ePan * 0.018;

      ctx.save();
      ctx.translate(curTx, curTy);
      ctx.rotate(curRot);
      ctx.scale(camZoom, camZoom);

      // Olive-green meadow background band
      ctx.fillStyle = '#738a5c';
      ctx.fillRect(-W * 0.20, groundY - 32, W * 1.5, 32);
      this.brush.paintStroke(-W * 0.10, groundY - 30, W * 1.3, groundY - 30, 16, '#8aa370', '#a4be88', '#586b46', false, false, 1, true);

      // Stepped impasto cloud banks rising behind the village on horizon (matching 2-3)
      this.brush.paintSteppedCloud(W * 0.08, groundY, 220, 8, 0, 10);
      this.brush.paintSteppedCloud(W * 0.24, groundY, 280, 9, 0, 11);
      this.brush.paintSteppedCloud(W * 0.38, groundY, 240, 8, 0, 12);
      this.brush.paintSteppedCloud(W * 0.64, groundY, 290, 9, 0, 13);
      this.brush.paintSteppedCloud(W * 0.82, groundY, 260, 8, 0, 14);
      this.brush.paintSteppedCloud(W * 0.96, groundY, 200, 7, 0, 15);

      // Horizontal dry-brush cloud sweeps across upper sky
      this.brush.paintPaletteKnifeSlab(W * 0.16, H * 0.12, W * 0.24, H * 0.12, 10, '#f1f5f9', '#e2e8f0', 21);
      this.brush.paintPaletteKnifeSlab(W * 0.44, H * 0.16, W * 0.54, H * 0.16, 12, '#f1f5f9', '#e2e8f0', 22);
      this.brush.paintPaletteKnifeSlab(W * 0.76, H * 0.11, W * 0.88, H * 0.11, 14, '#f8fafc', '#ede9fe', 23);

      // Continuous rich warm earth ground plane with layered brushstrokes
      ctx.fillStyle = '#5c3e28';
      ctx.fillRect(-W * 0.20, groundY, W * 1.5, H - groundY + 100);
      this.brush.paintStroke(-W * 0.10, groundY + 4, W * 1.3, groundY + 4, 14, '#8c684a', '#aa8463', '#422b1c', false, false, 2, true);
      this.brush.paintStroke(-W * 0.10, groundY + 28, W * 1.3, groundY + 28, 18, '#704f35', '#8c684a', '#3b2516', false, false, 3, true);

      // Wax-seal golden sun with 3 impasto comet tails
      const sunX = W * 0.08 + (t - 3.2) * 18;
      const sunY = H * 0.14;
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 26, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2.0;
      ctx.stroke();
      this.brush.paintStroke(sunX + 24, sunY - 6, sunX + 115, sunY - 6, 11, 'rgba(255, 255, 255, 0.75)', '#ffffff');
      this.brush.paintStroke(sunX + 24, sunY + 6, sunX + 95, sunY + 6, 9, 'rgba(255, 255, 255, 0.55)', '#ffffff');
      this.brush.paintStroke(sunX + 24, sunY + 16, sunX + 75, sunY + 16, 7, 'rgba(255, 255, 255, 0.35)', '#ffffff');

      // Silhouette Birds
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2.0;
      for (let b = 0; b < 4; b++) {
        const bx = W * 0.06 + b * 110 + t * 16;
        const by = H * 0.20 + (b % 2) * 38;
        ctx.beginPath();
        ctx.moveTo(bx - 10, by + 4);
        ctx.quadraticCurveTo(bx - 5, by - 5, bx, by);
        ctx.quadraticCurveTo(bx + 5, by - 5, bx + 10, by + 4);
        ctx.stroke();
      }

      // Four Thatched Roundhouses
      this.arch.paintThatchedHut(W * 0.04, groundY, 150, 180, 1, t);
      this.arch.paintThatchedHut(W * 0.13, groundY, 175, 210, 2, t);
      this.arch.paintThatchedHut(W * 0.28, groundY, 210, 240, 3, t);
      this.arch.paintThatchedHut(W * 0.92, groundY, 185, 215, 4, t);

      // Foliage trees
      this.arch.paintFoliageTree(W * 0.20, groundY);
      this.arch.paintFoliageTree(W * 0.83, groundY);

      // Single Family & Campfire at ground anchor
      this.brush.paintCampfire(famX - 25, groundY, 0.40, t);
      this.mannequin.paintFamily(famX, groundY, 0.40, t);

      // Working villagers with continuous kinematic forward trajectories
      this.mannequin.paintVillagers(groundY, W, t);

      // Four Stepping Wooden Signs
      const signs = [
        { word: 'THEN', x: W * 0.45, h: 58, w: 64, size: 18 },
        { word: 'WE',   x: W * 0.49, h: 82, w: 54, size: 24 },
        { word: 'LET',  x: W * 0.54, h: 108, w: 72, size: 28 },
        { word: 'THE',  x: W * 0.60, h: 134, w: 82, size: 32 },
      ];
      for (const sg of signs) {
        this.arch.paintWeatheredSignboard(sg.x, groundY, sg.h, sg.w, sg.word, sg.size);
      }

      // Monumental Timber Gate with 3D Block Letters IN
      const gateX = W * 0.72;
      this.arch.paintTimberGate(gateX, groundY);
      this.typo.paintBlockLettersIn(gateX, groundY - 60, 68);

      // Act I Close-up Cave Art Calligraphy (fades out as camera pulls back)
      if (eZoom < 0.98) {
        const caveAlpha = Math.max(0, 1.0 - eZoom * 1.35);
        ctx.save();
        ctx.globalAlpha = caveAlpha;
        this.typo.paintText('FIRST WE ONLY CARED FOR', famX, groundY - 142, 13, '#7c2d12', 0, false, '#b91c1c', '#451a03');
        const kinProg = Math.min(1.0, (t - 0.3) / 0.8);
        this.typo.paintMonumentalKin(famX, groundY - 105, 38, kinProg);
        this.brush.paintCaveHandStencil(famX - 28, groundY - 105, 0.40, -0.22, caveAlpha, 1);
        this.brush.paintCaveHandStencil(famX + 28, groundY - 105, 0.40, 0.22, caveAlpha, 2);
        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // 3. PHASE 2: ACT III - MEDITERRANEAN CITADEL & PORT (6.2s - 13.0s)
    // =========================================================================
    if (t > 6.2 && t < 13.0) {
      // Spatial camera pan: rolls in from right as village scrolls off left
      const uEnter = Math.min(1.0, (t - 6.2) / 1.8);
      const eEnter = ease.inOutCubic(uEnter);
      const enterTx = (1 - eEnter) * W;

      // Elevation to Act IV
      const uElev = t < 11.2 ? 0 : Math.min(1.0, (t - 11.2) / 1.6);
      const eElev = ease.inOutCubic(uElev);
      const elevScale = 1.0 - eElev * 0.12;
      const elevTy = eElev * 25;

      ctx.save();
      ctx.translate(enterTx, elevTy);
      ctx.scale(elevScale, elevScale);

      // Wide panoramic horizon curvature
      const arcR = H * 2.2;
      const arcCenterY = H * 0.70 + arcR;

      // Solid Stratified Earth Crust Cross-Section
      ctx.fillStyle = '#3a2012';
      ctx.beginPath();
      ctx.arc(W * 0.50, arcCenterY, arcR, -Math.PI * 0.70, -Math.PI * 0.30, false);
      ctx.lineTo(W + 50, arcCenterY);
      ctx.lineTo(W + 50, H + 20);
      ctx.lineTo(-50, H + 20);
      ctx.lineTo(-50, arcCenterY);
      ctx.closePath();
      ctx.fill();

      // Core gradient
      const coreGrad3 = ctx.createRadialGradient(W * 0.50, arcCenterY, arcR * 0.40, W * 0.50, arcCenterY, arcR);
      coreGrad3.addColorStop(0, '#221208');
      coreGrad3.addColorStop(0.70, '#2d180b');
      coreGrad3.addColorStop(1, '#3a2012');
      ctx.fillStyle = coreGrad3;
      ctx.fill();

      // Concentric curved strata
      const act3Strata = [
        { r: arcR - 10, w: 18, col: '#d4b896', blend: '#baa082' },
        { r: arcR - 26, w: 20, col: '#a37c52', blend: '#8c6239' },
        { r: arcR - 44, w: 22, col: '#8c6239', blend: '#6d4827' },
        { r: arcR - 64, w: 24, col: '#6d4827', blend: '#452c1a' },
      ];
      for (let l = 0; l < act3Strata.length; l++) {
        const lyr = act3Strata[l];
        this.brush.paintImpastoArc(
          W * 0.50, arcCenterY, lyr.r,
          -Math.PI * 0.72, -Math.PI * 0.28,
          lyr.w, lyr.col, lyr.blend, '#221208', l * 23,
        );
      }

      // Left Mediterranean Ocean Basin
      this.arch.paintCurvedImpastoOcean(-30, W * 0.28, W * 0.50, arcCenterY, arcR, 80, t, 11);

      // Two small fishing boats
      const fishingBoats = [
        { x: W * 0.12, sailH: 50 },
        { x: W * 0.23, sailH: 42 },
      ];
      for (const fb of fishingBoats) {
        const fby = this.arch.getArcY(fb.x, W * 0.50, arcCenterY, arcR + 10);
        this.brush.paintStroke(fb.x - 24, fby, fb.x + 24, fby, 10, '#54321b', '#784727');
        this.brush.paintStroke(fb.x, fby, fb.x, fby - fb.sailH, 5, '#3b2210');
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.moveTo(fb.x, fby - fb.sailH);
        ctx.lineTo(fb.x + 22, fby - 8);
        ctx.lineTo(fb.x, fby - 8);
        ctx.closePath();
        ctx.fill();
      }

      // Classical Mediterranean Citadel (smoothly transforms into Capitol colonnade at t > 11.2)
      if (t > 11.2) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1.0 - eElev);
        this.arch.paintCitadel(W * 0.44, arcCenterY, arcR, W, t);
        ctx.restore();
      } else {
        this.arch.paintCitadel(W * 0.44, arcCenterY, arcR, W, t);
      }

      // Right Mediterranean Ocean Basin with Galleons
      this.arch.paintCurvedImpastoOcean(W * 0.59, W * 1.05, W * 0.50, arcCenterY, arcR, 105, t, 12);

      const shipProg = Math.min(1.0, Math.max(0, (t - 7.2) / 5.2));
      const shipTravel = ease.outQuad(shipProg);
      const ships = [
        { x: W * 0.68 - shipTravel * (W * 0.08), size: 0.72, text: 'THEN', col: '#dc2626' },
        { x: W * 0.79 - shipTravel * (W * 0.10), size: 0.85, text: 'THE', col: '#dc2626' },
        { x: W * 0.94 - shipTravel * (W * 0.13), size: 1.15, text: 'STRANGERS', col: '#1d4ed8' },
      ];
      for (const ship of ships) {
        const sy = this.arch.getArcY(ship.x, W * 0.50, arcCenterY, arcR + 10);
        this.arch.paintGalleon(ship.x, sy, ship.size, ship.text, ship.col, t);
      }

      // White oil impasto OVERSEA directly on wave swell with spray foam
      if (t > 8.5) {
        const overseaProg = Math.min(1.0, (t - 8.5) / 1.0);
        ctx.save();
        ctx.globalAlpha = overseaProg * (t > 11.5 ? Math.max(0, 1.0 - (t - 11.5) / 1.0) : 1.0);
        const overseaX = W * 0.80 - shipTravel * (W * 0.06);
        const overseaY = this.arch.getArcY(overseaX, W * 0.50, arcCenterY, arcR) + 54;
        this.typo.paintOverseaWaveText('OVERSEA', overseaX, overseaY, 58, t);
        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // 4. PHASE 3: ACT IV & V - CONTINENTAL BIOSPHERE TO MODERN METROPOLIS (11.2s - 21.0s)
    // =========================================================================
    if (t > 11.2 && t < 21.2) {
      // Entrance settlement
      const uIn = Math.min(1.0, (t - 11.2) / 1.6);
      const eIn = ease.inOutCubic(uIn);

      // Cosmic pullback to Act VI (t > 19.2s)
      const uSpace = t < 19.2 ? 0 : Math.min(1.0, (t - 19.2) / 1.8);
      const eSpace = ease.inOutCubic(uSpace);

      const act5Scale = (0.90 + eIn * 0.10) - eSpace * 0.45;
      const act5Tx = -eSpace * (W * 0.28);
      const act5Ty = (1 - eIn) * 35 + eSpace * (H * 0.22);

      ctx.save();
      ctx.translate(act5Tx, act5Ty);
      ctx.scale(act5Scale, act5Scale);

      const globeArcY = H * 0.56;
      const arcR = H * 0.95;
      const arcCenterY = globeArcY + arcR;
      const cityX = W * 0.50;

      // 1. Solid Stratified Earth Crust Cross-Section (100% PERSISTENT throughout Acts IV & V)
      ctx.fillStyle = '#3a2012';
      ctx.beginPath();
      ctx.arc(cityX, arcCenterY, arcR, -Math.PI, 0, false);
      ctx.lineTo(W + 50, arcCenterY);
      ctx.lineTo(W + 50, H + 20);
      ctx.lineTo(-50, H + 20);
      ctx.lineTo(-50, arcCenterY);
      ctx.closePath();
      ctx.fill();

      // Core gradient
      const coreGrad4 = ctx.createRadialGradient(cityX, arcCenterY, arcR * 0.40, cityX, arcCenterY, arcR);
      coreGrad4.addColorStop(0, '#221208');
      coreGrad4.addColorStop(0.70, '#2d180b');
      coreGrad4.addColorStop(1, '#3a2012');
      ctx.fillStyle = coreGrad4;
      ctx.fill();

      // Concentric curved strata along perimeter
      const strataLayers = [
        { r: arcR - 10, w: 18, col: '#d4b896', blend: '#baa082' },
        { r: arcR - 26, w: 20, col: '#a37c52', blend: '#8c6239' },
        { r: arcR - 44, w: 22, col: '#8c6239', blend: '#6d4827' },
        { r: arcR - 64, w: 24, col: '#6d4827', blend: '#452c1a' },
      ];
      for (let l = 0; l < strataLayers.length; l++) {
        const lyr = strataLayers[l];
        this.brush.paintImpastoArc(
          cityX, arcCenterY, lyr.r,
          -Math.PI * 0.88, -Math.PI * 0.12,
          lyr.w, lyr.col, lyr.blend, '#221208', l * 23,
        );
      }

      // 2. Persistent Left Mountain Bluff with Pine Forest, Stone WOLVES & Howling Wolf Pack
      const wolfX = W * 0.18;
      const wolfY = this.arch.getArcY(wolfX, cityX, arcCenterY, arcR);
      this.arch.paintWolvesRidge(wolfX, wolfY, arcCenterY, arcR, W, t);

      // 3. Persistent Right Ocean Basin with Breaching Blue Whale & Seafoam WHALES
      const ocX1 = W * 0.63;
      const quayY = this.arch.getArcY(ocX1, cityX, arcCenterY, arcR);
      this.brush.paintStroke(ocX1 - 18, quayY + 12, ocX1 + 6, quayY + 12, 16, '#78716c', '#a8a29e', '#44403c');
      this.brush.paintStroke(ocX1 - 6, quayY, ocX1 - 6, quayY - 28, 5.0, '#dc2626', '#ffffff');
      this.arch.paintCurvedImpastoOcean(W * 0.63, W * 1.05, cityX, arcCenterY, arcR, 90, t, 21);

      const whaleX = W * 0.82;
      const whaleY = this.arch.getArcY(whaleX, cityX, arcCenterY, arcR);
      this.arch.paintBreachingWhale(whaleX, whaleY, t);

      // 4. Center Architecture Evolution from Capitol to Modern Metropolis (t = 15.6s - 17.5s)
      const uEvolve = t < 15.6 ? 0 : Math.min(1.0, (t - 15.6) / 1.8);
      const eEvolve = ease.inOutCubic(uEvolve);

      // Neoclassical Capitol Era (Act IV)
      if (eEvolve < 1.0) {
        ctx.save();
        ctx.globalAlpha = (1.0 - eEvolve) * eIn;

        const capY = this.arch.getArcY(cityX, cityX, arcCenterY, arcR);
        this.arch.paintCapitol(cityX, capY);

        // Billboards
        const lbX = cityX - 170;
        const lbY = this.arch.getArcY(lbX, cityX, arcCenterY, arcR);
        const lbAng = Math.asin((lbX - cityX) / arcR);
        this.arch.paintBillboard(lbX, lbY, 'THEN', 'AND', lbAng);

        const rbX = cityX + 170;
        const rbY = this.arch.getArcY(rbX, cityX, arcCenterY, arcR);
        const rbAng = Math.asin((rbX - cityX) / arcR);
        this.arch.paintBillboard(rbX, rbY, 'THE', 'AND', rbAng);

        // Bees & Hot Air Balloon
        this.arch.paintSwarmingBees(cityX, capY, t);

        const balX = W * 0.72;
        const balY = H * 0.22 + Math.sin(t * 1.5) * 12;
        this.arch.paintHotAirBalloon(balX, balY, t);

        ctx.restore();
      }

      // Art Deco Skyscraper Metropolis Era (Act V)
      if (eEvolve > 0) {
        ctx.save();
        ctx.globalAlpha = eEvolve;

        // Stepped Art Deco Skyscraper Metropolis & Viaduct Highway
        this.arch.paintArtDecoMetropolis(cityX, globeArcY, arcCenterY, arcR, t);

        // Crescent Moon
        const moonX = W * 0.16;
        const moonY = H * 0.25;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 30, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#0a0e1a';
        ctx.beginPath();
        ctx.arc(moonX + 13, moonY - 6, 27, 0, TAU);
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();
    }

    // =========================================================================
    // 5. PHASE 4: ACT VI - DEEP SPACE & FLOATING COSMIC DOOR (19.8s - 23.4s)
    // =========================================================================
    if (t > 19.8 && t < 23.4) {
      const doorX = W * 0.72;
      const doorY = H * 0.52;
      const doorAlpha = Math.min(1.0, (t - 19.8) / 0.8);

      // Door swings open between 21.2s and 22.4s
      const doorOpen = t > 21.2 ? Math.min(1.0, (t - 21.2) / 1.2) : 0;

      // Camera Dives into the Golden Door Aperture (t = 22.2s - 23.2s)
      const uDive = t < 22.2 ? 0 : Math.min(1.0, (t - 22.2) / 1.0);
      const eDive = ease.inCubic(uDive);
      const diveScale = 1.0 + eDive * 3.5;
      const diveTx = -eDive * (doorX - W * 0.50) * 3.5;
      const diveTy = -eDive * (doorY - H * 0.50) * 3.5;

      ctx.save();
      ctx.globalAlpha = doorAlpha;
      ctx.translate(diveTx, diveTy);
      ctx.scale(diveScale, diveScale);

      this.arch.paintCosmicDoor(doorX, doorY, doorOpen, t);

      if (doorOpen > 0) {
        for (let st = 0; st < 65; st++) {
          const stX = doorX + (st % 13) * 20 + Math.sin(t * 4.0 + st) * 22;
          const stY = doorY - 140 + st * 7;
          ctx.fillStyle = "rgba(254, 240, 138, " + (doorOpen * (0.4 + 0.6 * Math.sin(st))) + ")";
          ctx.fillRect(stX, stY, 4.5, 4.5);
        }
      }

      ctx.restore();

      // Radiant Golden Portal Bloom Flash over screen
      if (uDive > 0) {
        const flashAlpha = Math.sin(uDive * Math.PI) * 0.92;
        ctx.fillStyle = `rgba(254, 240, 138, ${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // =========================================================================
    // 6. PHASE 5: ACT VII - FULL EARTH GLOBE, CPU CHIP & EXPANDING CIRCLE (22.8s - 28.0s)
    // =========================================================================
    if (t >= 22.8) {
      const act7Alpha = Math.min(1.0, (t - 22.8) / 0.6);
      ctx.save();
      ctx.globalAlpha = act7Alpha;

      const globeX = W * 0.50;
      const globeY = H * 0.56;
      const globeR = 280;

      // North Pole Miniature Gotham Metropolis & CPU Chip
      const poleY = globeY - globeR;
      const cpuY = poleY - 116;

      const miniTowers = [
        { xOff: -44, w: 26, h: 48 },
        { xOff: -22, w: 24, h: 68 },
        { xOff: 0,   w: 34, h: 88 },
        { xOff: 22,  w: 24, h: 66 },
        { xOff: 44,  w: 26, h: 46 },
      ];
      for (const mt of miniTowers) {
        const tx = globeX + mt.xOff;
        const dx = mt.xOff;
        const ty = poleY + (dx * dx) / (2 * globeR);
        const radAng = Math.asin(Math.max(-0.6, Math.min(0.6, dx / globeR)));

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(radAng);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-mt.w * 0.5, -mt.h, mt.w, mt.h);
        ctx.fillStyle = '#334155';
        ctx.fillRect(-mt.w * 0.5, -mt.h, mt.w * 0.22, mt.h);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(mt.w * 0.28, -mt.h, mt.w * 0.22, mt.h);

        // Window grid
        const cols = Math.max(2, Math.floor(mt.w / 8));
        const rows = Math.floor((mt.h - 12) / 10);
        const colStep = (mt.w * 0.70) / (cols - 1 || 1);
        for (let r = 0; r < rows; r++) {
          const wy = -mt.h + 12 + r * 10;
          for (let c = 0; c < cols; c++) {
            const wx = -mt.w * 0.35 + c * colStep;
            ctx.fillStyle = '#090d16';
            ctx.fillRect(wx - 1.5, wy - 2.5, 3, 5);
          }
        }
        this.brush.paintStroke(-mt.w * 0.52, -mt.h, mt.w * 0.52, -mt.h, 3.0, '#475569');
        ctx.restore();
      }

      // Miniature window matrix text
      this.arch.paintWindowMatrixText('MORE', globeX, poleY - 70, 3.4, 0.95);
      this.arch.paintWindowMatrixText('LEARNED SOME', globeX, poleY - 48, 3.0, 0.9);
      this.arch.paintWindowMatrixText('EVERY TIME WE', globeX, poleY - 26, 2.8, 0.85);

      // Flanking miniature Wolves ridge and Whales ocean
      this.brush.paintStroke(globeX - 95, poleY - 6, globeX - 55, poleY - 14, 14, '#452c1a', '#69462b');
      this.typo.paintText('WOLVES', globeX - 95, poleY - 26, 16, '#d1d5db');

      this.brush.paintStroke(globeX + 55, poleY - 14, globeX + 95, poleY - 6, 14, '#1d4ed8', '#2563eb');
      this.typo.paintSeafoamText('WHALES', globeX + 95, poleY - 26, 16);

      // Microprocessor CPU Chip
      this.arch.paintCpuChip(globeX, cpuY, t);

      // Full Procedural Impasto Earth Globe with Day/Night Terminator
      this.arch.paintClimaxEarthGlobe(globeX, globeY, globeR, t, act7Alpha);

      // Crescent Moon in lower right
      ctx.save();
      const moonX = W * 0.81;
      const moonY = H * 0.70;
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 28, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(moonX + 11, moonY - 4, 25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(moonX - 8, moonY + 4, 4, 0, TAU);
      ctx.arc(moonX - 14, moonY - 6, 5, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Curved Orbital Rocket Launch
      const rktT = t - 23.0;
      const rktProg = Math.min(1.0, Math.max(0, rktT / 4.8));
      const launchCurve = ease.inOutCubic(rktProg);
      const rktX = W * 0.09 + launchCurve * (W * 0.15);
      const rktY = H * 0.76 - launchCurve * (H * 0.48);
      const rktAngle = 0.10 + launchCurve * 0.28;

      ctx.save();
      ctx.translate(rktX, rktY);
      ctx.rotate(rktAngle);
      this.arch.paintRocket(0, 0, t);
      ctx.restore();

      // Opening lyrics for Act VII (fades before circle sweeps)
      if (t >= 23.0 && t < 24.2) {
        const textAlpha = t < 23.6 ? 1.0 : Math.max(0, 1.0 - (t - 23.6) / 0.5);
        ctx.save();
        ctx.globalAlpha = textAlpha * act7Alpha;
        this.typo.paintBoneWoodText(
          'SO A MIND\nTHAT KNOWS',
          globeX - 250,
          poleY - 70,
          44,
        );
        this.typo.paintBoneWoodText(
          'THE MORE',
          globeX + 250,
          poleY - 70,
          44,
        );
        ctx.restore();
      }

      // RADIANT EXPANDING COMPASS CIRCLE & CLIMAX HAND-PAINTED LETTERING
      if (t > 24.0) {
        const circleProg = Math.min(1.0, (t - 24.0) / 2.5);
        const compassR = 396;

        const arcExtent = circleProg * (Math.PI * 0.86);
        const pinOffsetAng = 0.106;
        const startLeft = -Math.PI * 0.50 - pinOffsetAng;
        const startRight = -Math.PI * 0.50 + pinOffsetAng;

        // Left arc
        this.brush.paintImpastoArc(
          globeX, globeY, compassR,
          startLeft, startLeft - arcExtent,
          34, '#ea580c', '#fed7aa', '#9a3412', 101,
        );

        // Right arc
        this.brush.paintImpastoArc(
          globeX, globeY, compassR,
          startRight, startRight + arcExtent,
          34, '#ea580c', '#fed7aa', '#9a3412', 202,
        );

        // Radiant knife-edge impasto ridge highlight
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.78)';
        ctx.lineWidth = 3.6;
        ctx.beginPath();
        ctx.arc(globeX, globeY, compassR, startLeft, startLeft - arcExtent, true);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(globeX, globeY, compassR, startRight, startRight + arcExtent, false);
        ctx.stroke();

        if (circleProg > 0.15) {
          const topAlpha = Math.min(1.0, (circleProg - 0.15) / 0.30);
          ctx.save();
          ctx.globalAlpha = topAlpha * act7Alpha;
          this.typo.paintOrangeCompassArcText(
            'MIGHT DRAW',
            globeX, globeY, compassR + 46,
            -Math.PI * 0.88, -Math.PI * 0.58,
            64, false,
          );
          this.typo.paintOrangeCompassArcText(
            'ITS CIRCLE',
            globeX, globeY, compassR + 46,
            -Math.PI * 0.42, -Math.PI * 0.12,
            64, false,
          );
          ctx.restore();
        }
        if (circleProg > 0.45) {
          const btmAlpha = Math.min(1.0, (circleProg - 0.45) / 0.30);
          ctx.save();
          ctx.globalAlpha = btmAlpha * act7Alpha;
          this.typo.paintOrangeCompassArcText(
            'AROUND',
            globeX, globeY, compassR + 48,
            Math.PI * 0.65, Math.PI * 0.35,
            70, true,
          );
          ctx.restore();
        }
      }

      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 9. POST-PROCESSING OVERRIDES & THREE.JS BLIT
    // -------------------------------------------------------------------------
    this.texture.needsUpdate = true;

    renderer.setRenderTarget(out);
    renderer.setClearColor(0x04060d, 1.0);
    renderer.clear(true, true, true);
    renderer.render(this.threeScene, this.camera);

    return {
      bloom: t > 24.5 ? 0.28 : 0.15,
      bloomThreshold: 0.80,
      vignette: 0.16,
      grain: 0.012,
    };
  }
}

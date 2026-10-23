// ARCHITECTURAL & ENVIRONMENTAL CRAFT ENGINE (v3.0 Master Edition)
// Monumental architectural world-building across all 7 metamorphic acts:
// Thatched roundhouses, Mediterranean acropolis & galleons, Beaux-Arts Capitol & campanile,
// craggy wolves mountain bluff, breaching whale, Art Deco metropolis & viaduct,
// rustic cosmic door, and authentic planet Earth with CPU monolith.

import { TAU } from '../../engine/util';
import { PainterlyBrush } from './painterly_brush';
import { PainterlyTypography } from './painterly_typography';
import { WoodMannequin } from './wood_mannequin';

// 3x5 Dot-Matrix Window Font for Act V Skyscraper letterforms
const FONT_3X5: Record<string, number[]> = {
  'A': [0b010, 0b101, 0b111, 0b101, 0b101],
  'B': [0b110, 0b101, 0b110, 0b101, 0b110],
  'C': [0b011, 0b100, 0b100, 0b100, 0b011],
  'D': [0b110, 0b101, 0b101, 0b101, 0b110],
  'E': [0b111, 0b100, 0b110, 0b100, 0b111],
  'F': [0b111, 0b100, 0b110, 0b100, 0b100],
  'G': [0b011, 0b100, 0b101, 0b101, 0b011],
  'H': [0b101, 0b101, 0b111, 0b101, 0b101],
  'I': [0b111, 0b010, 0b010, 0b010, 0b111],
  'J': [0b001, 0b001, 0b001, 0b101, 0b010],
  'K': [0b101, 0b110, 0b100, 0b110, 0b101],
  'L': [0b100, 0b100, 0b100, 0b100, 0b111],
  'M': [0b101, 0b111, 0b101, 0b101, 0b101],
  'N': [0b101, 0b111, 0b111, 0b101, 0b101],
  'O': [0b010, 0b101, 0b101, 0b101, 0b010],
  'P': [0b110, 0b101, 0b110, 0b100, 0b100],
  'R': [0b110, 0b101, 0b110, 0b101, 0b101],
  'S': [0b011, 0b100, 0b010, 0b001, 0b110],
  'T': [0b111, 0b010, 0b010, 0b010, 0b010],
  'U': [0b101, 0b101, 0b101, 0b101, 0b010],
  'V': [0b101, 0b101, 0b101, 0b101, 0b010],
  'W': [0b101, 0b101, 0b101, 0b111, 0b101],
  'Y': [0b101, 0b101, 0b010, 0b010, 0b010],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
  "'": [0b010, 0b010, 0b000, 0b000, 0b000],
};

export class ArchitecturalElements {
  public ctx: CanvasRenderingContext2D;
  public brush: PainterlyBrush;
  public typo: PainterlyTypography;
  public mannequin: WoodMannequin;

  constructor(
    ctx: CanvasRenderingContext2D,
    brush: PainterlyBrush,
    typo: PainterlyTypography,
    mannequin: WoodMannequin,
  ) {
    this.ctx = ctx;
    this.brush = brush;
    this.typo = typo;
    this.mannequin = mannequin;
  }

  // Helper for arc Y along spherical horizon
  public getArcY(x: number, cx: number, cy: number, r: number): number {
    const dx = x - cx;
    if (Math.abs(dx) >= r) return cy;
    return cy - Math.sqrt(r * r - dx * dx);
  }

  // ---------------------------------------------------------------------------
  // 1. ACT II: NEOLITHIC THATCHED ROUNDHOUSE (matching 2-3)
  // ---------------------------------------------------------------------------
  public paintThatchedHut(cx: number, cy: number, w: number, h: number, seed: number = 0, t: number = 0): void {
    const ctx = this.ctx;
    ctx.save();

    // Log walls: stacked notched roundwood logs with chinking
    const logH = 14;
    const logs = 7;
    for (let l = 0; l < logs; l++) {
      const ly = cy - l * logH;
      const lw = w * (0.96 - l * 0.02);
      this.brush.paintStroke(
        cx - lw * 0.50, ly,
        cx + lw * 0.50, ly,
        logH - 1.5,
        '#54321b',
        '#784727',
        '#331c0d',
        false,
        false,
        seed + l * 5,
        true,
      );
      // Chinking mortar line
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.48, ly - logH * 0.45);
      ctx.lineTo(cx + lw * 0.48, ly - logH * 0.45);
      ctx.stroke();
    }

    // Doorway opening with rustic timber jambs and dark interior void (matching 2-3)
    const doorW = 34;
    const doorH = 68;
    ctx.fillStyle = '#140c06';
    ctx.beginPath();
    ctx.rect(cx - doorW * 0.5, cy - doorH, doorW, doorH);
    ctx.fill();
    // Rough hewn jamb logs
    this.brush.paintStroke(cx - doorW * 0.5, cy, cx - doorW * 0.5, cy - doorH - 4, 8, '#3b2210', '#54321b');
    this.brush.paintStroke(cx + doorW * 0.5, cy, cx + doorW * 0.5, cy - doorH - 4, 8, '#3b2210', '#54321b');
    this.brush.paintStroke(cx - doorW * 0.55, cy - doorH - 2, cx + doorW * 0.55, cy - doorH - 2, 9, '#54321b', '#784727');

    // CONICAL THATCH ROOF: 3 Tiered Layered Straw Skirts with Deep Overhangs (matching 2-3)
    const eaveY = cy - 74;
    const apexY = cy - h;
    const roofH = eaveY - apexY;
    const numTiers = 3;

    // Rich dark umber/peat under-thatch shadow volume
    ctx.fillStyle = '#261408';
    ctx.beginPath();
    ctx.moveTo(cx, apexY - 8);
    ctx.quadraticCurveTo(cx + w * 0.45, apexY + roofH * 0.5, cx + w * 0.68, eaveY + 8);
    ctx.lineTo(cx - w * 0.68, eaveY + 8);
    ctx.quadraticCurveTo(cx - w * 0.45, apexY + roofH * 0.5, cx, apexY - 8);
    ctx.closePath();
    ctx.fill();

    for (let tr = 0; tr < numTiers; tr++) {
      const trTopU = tr / numTiers;
      const trBotU = (tr + 1) / numTiers;
      const trTopY = apexY + trTopU * roofH;
      const trBotY = apexY + trBotU * roofH;
      const trTopW = w * 0.58 * (trTopU + 0.22);
      const trBotW = w * 0.66 * (trBotU + 0.22);

      // Deep, dark shadow cavity under tier eave overhang
      this.brush.paintStroke(
        cx - trBotW * 0.98, trBotY + 5,
        cx + trBotW * 0.98, trBotY + 5,
        9.0,
        '#1a0c04',
        '#2a1408',
        '#0f0702',
        false,
        false,
        seed + tr * 23,
        false,
      );

      // Dense layered curving straw bundles in rich ochres and aged golden amber
      const reeds = 36;
      for (let r = 0; r < reeds; r++) {
        const u = r / (reeds - 1);
        const rx1 = cx - trTopW + u * (trTopW * 2);
        const rx2 = cx - trBotW + u * (trBotW * 2) + (this.brush.hash(seed * 31 + tr * 47 + r * 13) - 0.5) * 10;
        
        // Gentle downward convex bowing of the straw bundle
        const midX = (rx1 + rx2) * 0.5 + (this.brush.hash(seed * 7 + r * 19) - 0.5) * 5;
        const midY = (trTopY + trBotY) * 0.5 + 4;

        // Authentic aged thatch color palette (warm ochre, umber, golden wheat, raw sienna - NO neon yellow!)
        const colPalette = ['#78350f', '#92400e', '#b45309', '#a16207', '#854d0e', '#c28833'];
        const blendPalette = ['#a16207', '#b45309', '#d4b996', '#92400e', '#78350f', '#a87940'];
        const col = colPalette[(r + tr * 3) % colPalette.length];
        const blend = blendPalette[(r * 2 + tr) % blendPalette.length];

        this.brush.paintStroke(
          rx1, trTopY,
          midX, midY,
          6.0,
          col,
          blend,
          '#261408',
          true,
          false,
          seed + tr * 50 + r * 7,
          true,
        );
        this.brush.paintStroke(
          midX, midY,
          rx2, trBotY,
          5.5,
          col,
          blend,
          '#381d09',
          false,
          false,
          seed + tr * 50 + r * 11,
          true,
        );
      }

      // Shaggy, irregular fibrous straw fringe along the tier skirt
      const fringes = 26;
      for (let f = 0; f < fringes; f++) {
        const fu = f / (fringes - 1);
        const fx = cx - trBotW + fu * (trBotW * 2);
        const fLen = 9 + this.brush.hash(seed * 71 + tr * 29 + f * 17) * 15;
        const fJitterX = (this.brush.hash(seed * 11 + f * 13) - 0.5) * 8;
        const fringeCol = f % 2 === 0 ? '#b45309' : '#854d0e';
        const fringeBlend = f % 3 === 0 ? '#d4b996' : '#92400e';
        this.brush.paintStroke(
          fx, trBotY - 3,
          fx + fJitterX, trBotY + fLen,
          3.8,
          fringeCol,
          fringeBlend,
          '#261408',
          false,
          true,
          seed + tr * 80 + f * 9,
          true,
        );
      }
    }

    // Hand-turned terracotta pots & amphorae with handles (matching 2-3)
    if (seed % 2 === 0) {
      const pot1X = cx + 28;
      const pot1Y = cy - 8;
      this.brush.paintStroke(pot1X, pot1Y, pot1X, pot1Y - 20, 15, '#b45309', '#d97706', '#78350f');
      this.brush.paintStroke(pot1X - 2, pot1Y - 20, pot1X + 2, pot1Y - 20, 11, '#92400e', '#f59e0b');

      const pot2X = cx + 44;
      const pot2Y = cy - 8;
      this.brush.paintStroke(pot2X, pot2Y, pot2X, pot2Y - 16, 12, '#92400e', '#b45309', '#451a03');
    }

    // Dynamic undulating lavender smoke wisps from chimney apex (matching 2-3)
    for (let sm = 0; sm < 2; sm++) {
      const smPhase = t * 2.4 + seed + sm * 2.5;
      const sx = cx + (sm - 0.5) * 8;
      this.brush.paintCurve(
        sx, apexY - 2,
        sx + Math.sin(smPhase) * 18, apexY - 65,
        sx + Math.cos(smPhase * 0.8) * 12, apexY - 35,
        7.0 - sm * 1.5,
        'rgba(216, 180, 254, 0.45)',
        'rgba(243, 232, 255, 0.65)',
        undefined,
        8,
        seed + sm * 13,
        false,
      );
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 1B. ACT II: FOLK-CARVED WEATHERED TIMBER SIGNBOARD (matching 2-1 & 2-3)
  // ---------------------------------------------------------------------------
  public paintWeatheredSignboard(
    x: number,
    groundY: number,
    postH: number,
    w: number,
    word: string,
    size: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    // 1. Earth contact shadow & small soil mound at post base
    ctx.fillStyle = 'rgba(67, 40, 24, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 4, 16, 5, 0, 0, TAU);
    ctx.fill();

    // 2. Hand-hewn rough wooden post with bark texture & longitudinal striations
    this.brush.paintStroke(
      x, groundY + 2,
      x, groundY - postH,
      9.0,
      '#452715',
      '#633b1e',
      '#261408',
      false,
      false,
      postH * 7,
      true,
    );

    // 3. Hand-carved blonde pine / ash timber plank (irregular paddle lozenge)
    const plankH = 38;
    const plankY = groundY - postH - 18;
    const hw = w * 0.5;

    ctx.save();
    ctx.translate(x, plankY);

    // Deep under-drop shadow of signboard plank on the post
    ctx.fillStyle = 'rgba(38, 20, 8, 0.40)';
    ctx.beginPath();
    ctx.ellipse(2, 22, hw * 0.95, 8, 0, 0, TAU);
    ctx.fill();

    // Plank base contour: warm blonde ash
    ctx.fillStyle = '#dfc7a7';
    ctx.beginPath();
    ctx.moveTo(-hw + 6, -plankH * 0.46);
    ctx.quadraticCurveTo(0, -plankH * 0.52, hw - 5, -plankH * 0.44);
    ctx.quadraticCurveTo(hw + 4, 0, hw - 4, plankH * 0.44);
    ctx.quadraticCurveTo(0, plankH * 0.52, -hw + 5, plankH * 0.46);
    ctx.quadraticCurveTo(-hw - 4, 0, -hw + 6, -plankH * 0.46);
    ctx.closePath();
    ctx.fill();

    // Darker perimeter wood edge / bevel
    ctx.strokeStyle = '#8c6d4f';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Inner lighter blonde timber body
    ctx.fillStyle = '#eddac2';
    ctx.beginPath();
    ctx.moveTo(-hw + 8, -plankH * 0.38);
    ctx.quadraticCurveTo(0, -plankH * 0.42, hw - 7, -plankH * 0.36);
    ctx.quadraticCurveTo(hw + 1, 0, hw - 6, plankH * 0.36);
    ctx.quadraticCurveTo(0, plankH * 0.42, -hw + 7, plankH * 0.38);
    ctx.quadraticCurveTo(-hw - 1, 0, -hw + 8, -plankH * 0.38);
    ctx.closePath();
    ctx.fill();

    // Longitudinal fine woodgrain striations across plank face
    const grains = [
      { y: -plankH * 0.28, col: '#ba9e80', w: 1.4, alpha: 0.55 },
      { y: -plankH * 0.08, col: '#f7ede2', w: 1.2, alpha: 0.65 },
      { y: plankH * 0.12, col: '#a38465', w: 1.5, alpha: 0.50 },
      { y: plankH * 0.28, col: '#7a5a3a', w: 1.3, alpha: 0.60 },
    ];
    for (const g of grains) {
      ctx.strokeStyle = g.col;
      ctx.lineWidth = g.w;
      ctx.globalAlpha = g.alpha;
      ctx.beginPath();
      ctx.moveTo(-hw + 8, g.y);
      ctx.lineTo(hw - 8, g.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Fastening wooden pegs pinning plank to post
    ctx.fillStyle = '#2b1a0d';
    ctx.beginPath();
    ctx.arc(0, -plankH * 0.25, 2.2, 0, TAU);
    ctx.arc(0, plankH * 0.25, 2.2, 0, TAU);
    ctx.fill();

    ctx.restore();

    // 4. Genuine charcoal-brushed folk lettering
    this.typo.paintCharcoalSignboardText(word, x, plankY + 2, size);

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 2. ACT II: MONUMENTAL TIMBER GATE & PALISADE (matching 2-3)
  // ---------------------------------------------------------------------------
  public paintTimberGate(gateX: number, groundY: number): void {
    const ctx = this.ctx;

    // Two heavy vertical timber posts with notched ladder climbing rungs
    this.brush.paintStroke(gateX - 125, groundY, gateX - 125, groundY - 250, 32, '#54321b', '#784727', '#331c0d', false, false, 1, true);
    this.brush.paintStroke(gateX + 125, groundY, gateX + 125, groundY - 250, 32, '#54321b', '#784727', '#331c0d', false, false, 2, true);

    // Ladder climbing rungs on both posts
    for (let r = 0; r < 5; r++) {
      const ry = groundY - 55 - r * 38;
      this.brush.paintStroke(gateX - 145, ry, gateX - 105, ry, 12, '#784727', '#9d5e32');
      this.brush.paintStroke(gateX + 105, ry, gateX + 145, ry, 12, '#784727', '#9d5e32');
    }

    // Gateway opening is clear and inviting, revealing the impasto word "IN" on the ground (matching 2-3)

    // Heavy weathered wooden header plank with jagged saw-cut ends (matching 2-3)
    const plankW = 420;
    const plankH = 58;
    const plankY = groundY - 280;
    const px1 = gateX - plankW * 0.5;
    const px2 = gateX + plankW * 0.5;

    ctx.save();
    // Plank body with rough bark edges
    ctx.fillStyle = '#b8895e';
    ctx.beginPath();
    ctx.moveTo(px1 + 10, plankY);
    ctx.lineTo(px2 - 12, plankY);
    ctx.lineTo(px2, plankY + 18);
    ctx.lineTo(px2 - 8, plankY + plankH);
    ctx.lineTo(px1 + 6, plankY + plankH);
    ctx.lineTo(px1, plankY + 28);
    ctx.closePath();
    ctx.fill();

    // Woodgrain & bark horizontal knife strokes
    this.brush.paintStroke(px1, plankY + 6, px2, plankY + 6, 8, '#d4a373', '#ecd5b8');
    this.brush.paintStroke(px1, plankY + plankH - 6, px2, plankY + plankH - 6, 8, '#6a4325', '#422511');
    ctx.strokeStyle = '#422511';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // Hand-painted carved black lettering "NEIGHBORS" (matching 2-3)
    this.typo.paintCharcoalSignboardText('NEIGHBORS', gateX, groundY - 250, 56);

    // Palisade timber fence to the right (sharpened stakes with organic height jitter)
    for (let p = 0; p < 13; p++) {
      const px = gateX + 145 + p * 18;
      const ph = 155 + (this.brush.hash(p * 23) * 25);
      this.brush.paintStroke(px, groundY, px, groundY - ph, 18, '#54321b', '#784727', '#331c0d', false, false, p, true);
      // Sharpened axe-chopped point
      ctx.fillStyle = '#784727';
      ctx.beginPath();
      ctx.moveTo(px - 9, groundY - ph);
      ctx.lineTo(px, groundY - ph - 24);
      ctx.lineTo(px + 9, groundY - ph);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. ACT II: FOLIAGE TREES (matching 2-3 screenshot.png)
  // ---------------------------------------------------------------------------
  public paintFoliageTree(tx: number, groundY: number): void {
    const ctx = this.ctx;
    // Gnarled wooden trunk & limbs
    this.brush.paintStroke(tx, groundY, tx, groundY - 105, 24, '#422511', '#6a4325', '#241206', false, false, 0, true);
    this.brush.paintStroke(tx, groundY - 95, tx - 28, groundY - 145, 14, '#54321b', '#784727');
    this.brush.paintStroke(tx, groundY - 90, tx + 26, groundY - 140, 14, '#54321b', '#784727');

    // Dense cluster of 36+ organic oil paint leaf dabs (matching 2-3)
    ctx.save();
    const leafPalette = ['#14532d', '#166534', '#15803d', '#16a34a', '#365314', '#4d7c0f', '#84cc16'];
    const leafNodes = [
      // Central crown
      { cx: tx, cy: groundY - 155, count: 18, rad: 36 },
      // Left cluster
      { cx: tx - 26, cy: groundY - 145, count: 12, rad: 28 },
      // Right cluster
      { cx: tx + 24, cy: groundY - 140, count: 12, rad: 28 },
      // Top crown
      { cx: tx - 4, cy: groundY - 180, count: 10, rad: 24 },
    ];

    for (const node of leafNodes) {
      for (let i = 0; i < node.count; i++) {
        const ang = this.brush.hash(i * 17 + node.cx) * TAU;
        const dist = Math.pow(this.brush.hash(i * 29 + node.cy), 0.7) * node.rad;
        const lx = node.cx + Math.cos(ang) * dist;
        const ly = node.cy + Math.sin(ang) * dist * 0.75;
        const col = leafPalette[(i + node.cx) % leafPalette.length];
        const dabW = 16 + this.brush.hash(i * 31) * 12;
        const dabH = 10 + this.brush.hash(i * 47) * 7;
        const dabRot = (this.brush.hash(i * 53) - 0.5) * 0.8;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(dabRot);
        // Thick impasto leaf dab
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(0, 0, dabW * 0.5, dabH * 0.5, 0, 0, TAU);
        ctx.fill();
        // Leaf crest sheen
        if (i % 3 === 0) {
          ctx.strokeStyle = '#a3e635';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(-1, -1, dabW * 0.35, dabH * 0.30, 0, 0, Math.PI);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. ACT III: MEDITERRANEAN CITADEL & PORT (matching 2-4 & 2-6)
  // ---------------------------------------------------------------------------
  public paintCitadel(portX: number, arcCenterY: number, arcR: number, W: number, t: number = 0): void {
    const ctx = this.ctx;

    // --- A. BACKGROUND HILLSIDE TERRACED TOWNHOUSES (matching 2-4 & 2-6) ---
    // Positano/Santorini style Mediterranean townhouses stepping up the hillside
    const townHouses = [
      { x: portX - 235, h: 140, w: 46, roofCol: '#c2410c', wallCol: '#e7d5c7', chim: true, tier: 35 },
      { x: portX - 195, h: 165, w: 50, roofCol: '#b91c1c', wallCol: '#dfc8b8', chim: false, tier: 65 },
      { x: portX - 150, h: 195, w: 52, roofCol: '#c2410c', wallCol: '#e7d5c7', chim: true, tier: 95 },
      { x: portX - 105, h: 225, w: 48, roofCol: '#9a3412', wallCol: '#dfc8b8', chim: false, tier: 115 },
      { x: portX - 60,  h: 190, w: 46, roofCol: '#c2410c', wallCol: '#e7d5c7', chim: true, tier: 85 },
      { x: portX - 20,  h: 165, w: 44, roofCol: '#b91c1c', wallCol: '#dfc8b8', chim: false, tier: 60 },
      { x: portX + 25,  h: 145, w: 42, roofCol: '#9a3412', wallCol: '#e7d5c7', chim: true, tier: 35 },
      { x: portX + 65,  h: 125, w: 40, roofCol: '#c2410c', wallCol: '#dfc8b8', chim: false, tier: 20 },
    ];

    for (const h of townHouses) {
      const hy = this.getArcY(h.x, W * 0.50, arcCenterY, arcR) - h.tier;

      // Solid flat-grounded warm limestone masonry wall (matching 2-4 & 2-6)
      ctx.fillStyle = h.wallCol;
      ctx.fillRect(h.x - h.w * 0.5, hy - h.h, h.w, h.h);

      // Horizontal ashlar stone course striations
      for (let cr = 0; cr < Math.floor(h.h / 16); cr++) {
        const cy = hy - h.h + cr * 16;
        ctx.strokeStyle = '#c4b5a5';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(h.x - h.w * 0.48, cy);
        ctx.lineTo(h.x + h.w * 0.48, cy);
        ctx.stroke();
      }

      // Stone quoins (corner stones) on alternating edges
      for (let q = 0; q < 5; q++) {
        const qy = hy - 12 - q * (h.h * 0.18);
        this.brush.paintStroke(h.x - h.w * 0.48, qy, h.x - h.w * 0.48 + 7, qy, 4.0, '#c4b5a5', '#ebe1d5');
        this.brush.paintStroke(h.x + h.w * 0.48 - 7, qy - 6, h.x + h.w * 0.48, qy - 6, 4.0, '#c4b5a5', '#ebe1d5');
      }

      // Gabled terracotta tile roof with knife-stroke ridges (matching 2-4 & 2-6)
      ctx.fillStyle = h.roofCol;
      ctx.beginPath();
      ctx.moveTo(h.x - h.w * 0.55, hy - h.h);
      ctx.lineTo(h.x, hy - h.h - 26);
      ctx.lineTo(h.x + h.w * 0.55, hy - h.h);
      ctx.closePath();
      ctx.fill();
      this.brush.paintStroke(h.x - h.w * 0.55, hy - h.h, h.x, hy - h.h - 26, 5.0, '#ea580c', '#f97316');
      this.brush.paintStroke(h.x, hy - h.h - 26, h.x + h.w * 0.55, hy - h.h, 5.0, '#ea580c', '#c2410c');

      // Arched windows with stone sills
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(h.x, hy - h.h + 24, 5, Math.PI, TAU);
      ctx.rect(h.x - 5, hy - h.h + 24, 10, 14);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(h.x, hy - h.h + 54, 5, Math.PI, TAU);
      ctx.rect(h.x - 5, hy - h.h + 54, 10, 14);
      ctx.fill();

      // Stone window sills
      this.brush.paintStroke(h.x - 7, hy - h.h + 38, h.x + 7, hy - h.h + 38, 3.2, '#f5ebe1', '#d6cec2');
      this.brush.paintStroke(h.x - 7, hy - h.h + 68, h.x + 7, hy - h.h + 68, 3.2, '#f5ebe1', '#d6cec2');

      // Chimney with living rising smoke puffs drifting in sea wind
      if (h.chim) {
        this.brush.paintStroke(h.x + h.w * 0.22, hy - h.h - 10, h.x + h.w * 0.22, hy - h.h - 38, 9, '#78716c', '#a8a29e');
        for (let sm = 0; sm < 3; sm++) {
          const smProg = ((t * 1.6 + sm * 0.35 + (h.x * 0.01)) % 1.0);
          const smY = hy - h.h - 40 - smProg * 36;
          const smX = h.x + h.w * 0.22 + Math.sin(t * 2.5 + sm) * 5 + smProg * 16;
          const smR = 5 + smProg * 9;
          const smAlpha = (1.0 - smProg) * 0.42;
          ctx.fillStyle = `rgba(235, 230, 245, ${smAlpha})`;
          ctx.beginPath();
          ctx.arc(smX, smY, smR, 0, TAU);
          ctx.fill();
        }
      }
    }

    // --- B. PINK LIMESTONE WATCHTOWER KEEP WITH CRENELLATIONS (matching 2-6) ---
    const keepX = portX - 145;
    const keepY = this.getArcY(keepX, W * 0.50, arcCenterY, arcR);

    // Solid flat-grounded warm pinkish ashlar limestone keep body
    ctx.fillStyle = '#dfc8b8';
    ctx.fillRect(keepX - 36, keepY - 265, 72, 265);

    // Stone courses & textures
    for (let cr = 0; cr < 17; cr++) {
      const cy = keepY - 265 + cr * 15;
      ctx.strokeStyle = '#b89c88';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(keepX - 35, cy);
      ctx.lineTo(keepX + 35, cy);
      ctx.stroke();
    }

    // Stone quoin relief and horizontal molding bands
    this.brush.paintStroke(keepX - 38, keepY - 140, keepX + 38, keepY - 140, 5.0, '#f0e2d8', '#b89c88');
    this.brush.paintStroke(keepX - 38, keepY - 265, keepX + 38, keepY - 265, 6.0, '#f0e2d8', '#a88a76');

    // Crenellated battlements along keep top
    for (let b = -2; b <= 2; b++) {
      const bx = keepX + b * 15;
      ctx.fillStyle = '#dfc8b8';
      ctx.fillRect(bx - 5.5, keepY - 284, 11, 19);
      this.brush.paintStroke(bx, keepY - 265, bx, keepY - 284, 5.5, '#dfc8b8', '#f0e2d8', '#b89c88');
    }

    // Dynamic fluttering red pennant flag in the sea breeze
    const keepFlagPhase = t * 9.5;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(keepX, keepY - 284);
    const kfLen = 52;
    for (let kf = 0; kf <= kfLen; kf += 4) {
      const yf = keepY - 270 + Math.sin(keepFlagPhase + kf * 0.18) * (4.2 * (kf / kfLen));
      ctx.lineTo(keepX + kf, yf);
    }
    for (let kf = kfLen; kf >= 0; kf -= 4) {
      const yf = keepY - 256 + Math.sin(keepFlagPhase + kf * 0.18 + 0.4) * (3.0 * (kf / kfLen));
      ctx.lineTo(keepX + kf, yf);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Arched windows with limestone sills
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(keepX - 9, keepY - 215, 18, 30);
    ctx.fillRect(keepX - 9, keepY - 105, 18, 30);
    this.brush.paintStroke(keepX - 12, keepY - 185, keepX + 12, keepY - 185, 3.5, '#f0e2d8');
    this.brush.paintStroke(keepX - 12, keepY - 75, keepX + 12, keepY - 75, 3.5, '#f0e2d8');

    // --- C. CONICAL-ROOFED CYLINDRICAL TURRET (matching 2-6) ---
    const turX = portX - 235;
    const turY = this.getArcY(turX, W * 0.50, arcCenterY, arcR);
    // Solid flat-grounded turret body
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(turX - 18, turY - 175, 36, 175);
    for (let cr = 0; cr < 12; cr++) {
      const cy = turY - 175 + cr * 14;
      ctx.strokeStyle = '#d6d3d1';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(turX - 17, cy);
      ctx.lineTo(turX + 17, cy);
      ctx.stroke();
    }
    // Blue conical roof
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(turX - 22, turY - 175);
    ctx.lineTo(turX, turY - 220);
    ctx.lineTo(turX + 22, turY - 175);
    ctx.closePath();
    ctx.fill();
    this.brush.paintStroke(turX - 22, turY - 175, turX, turY - 220, 4.0, '#3b82f6');
    this.brush.paintStroke(turX, turY - 220, turX + 22, turY - 175, 4.0, '#1e40af');
    // Fluttering red flag on turret
    const turFlagPhase = t * 10.0 + 1.0;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(turX, turY - 220);
    const tfLen = 28;
    for (let tf = 0; tf <= tfLen; tf += 4) {
      const yf = turY - 210 + Math.sin(turFlagPhase + tf * 0.25) * (3.0 * (tf / tfLen));
      ctx.lineTo(turX + tf, yf);
    }
    ctx.lineTo(turX, turY - 202);
    ctx.closePath();
    ctx.fill();

    // --- D. CLASSICAL GRECO-ROMAN MARBLE TEMPLE (matching 2-6) ---
    const tempX = portX - 20;
    const tempY = this.getArcY(tempX, W * 0.50, arcCenterY, arcR);

    // Stylobate marble steps
    this.brush.paintStroke(tempX - 84, tempY - 10, tempX + 84, tempY - 10, 16, '#e5e5e4', '#ffffff', '#a8a29e');
    this.brush.paintStroke(tempX - 78, tempY - 22, tempX + 78, tempY - 22, 10, '#d6d3d1', '#e5e5e4', '#78716c');

    // Shaded dark cella portico interior
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(tempX - 72, tempY - 145, 144, 119);

    // Fluted marble columns with cast shadows and classical capitals
    for (let c = 0; c < 8; c++) {
      const cx = tempX - 63 + c * 18;
      // Capital top
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 7, tempY - 145, 14, 8);
      // Shaft
      this.brush.paintStroke(cx, tempY - 24, cx, tempY - 137, 10.5, '#f5f5f4', '#ffffff', '#a8a29e', false, false, c, true);
      // Base
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(cx - 6, tempY - 30, 12, 6);
    }

    // Triangular Pediment Relief with Terracotta Roof
    ctx.fillStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.moveTo(tempX - 86, tempY - 145);
    ctx.lineTo(tempX, tempY - 202);
    ctx.lineTo(tempX + 86, tempY - 145);
    ctx.closePath();
    ctx.fill();
    // Terracotta roof edges
    this.brush.paintStroke(tempX - 86, tempY - 145, tempX, tempY - 202, 13, '#c2410c', '#ea580c');
    this.brush.paintStroke(tempX, tempY - 202, tempX + 86, tempY - 145, 13, '#c2410c', '#ea580c');

    // --- E. AUTHENTIC FEATHERY ITALIAN PENCIL CYPRESSES (matching 2-6) ---
    for (const cOff of [-85, 54, 78]) {
      const cx = portX + cOff;
      const cy = this.getArcY(cx, W * 0.50, arcCenterY, arcR);
      const treeH = 138;
      // Slender dark timber trunk base
      this.brush.paintStroke(cx, cy, cx, cy - 22, 6.0, '#29180d', '#3d2514');

      // Sculpted flame-shaped foliage tiers tapering from broad base to sharp pointed tip
      const foliageTiers = 9;
      for (let tr = 0; tr < foliageTiers; tr++) {
        const u = tr / (foliageTiers - 1);
        const ty = cy - 14 - u * (treeH - 14);
        const tw = Math.sin(u * Math.PI) * (18 * (1.0 - u * 0.45)) + (1.0 - u) * 4;

        // Dark forest shadow core
        ctx.fillStyle = '#052e16';
        ctx.beginPath();
        ctx.ellipse(cx, ty, tw * 0.5, 9, 0, 0, TAU);
        ctx.fill();

        // Feathery side impasto dabs with gentle breeze flutter
        const dabs = 4;
        for (let d = 0; d < dabs; d++) {
          const du = (d / (dabs - 1) - 0.5) * 2;
          const dx = cx + du * (tw * 0.55);
          const dy = ty + (this.brush.hash(cOff * 31 + tr * 7 + d * 13) - 0.5) * 4;
          const dabCol = d % 2 === 0 ? '#14532d' : '#166534';
          const hiCol = d === 1 ? '#22c55e' : undefined;
          this.brush.paintStroke(dx, dy + 5, dx + du * 2, dy - 6, 4.5, dabCol, hiCol);
        }
      }
      // Needle-sharp tip
      this.brush.paintStroke(cx, cy - treeH + 12, cx, cy - treeH - 6, 2.4, '#14532d', '#22c55e');
    }

    // --- F. ELEGANT TAPERING WHITE STONE BEACON LIGHTHOUSE WITH ROTATING BEAM (matching 2-6) ---
    // Slender, graceful classical white stone beacon tower with delicate crimson accent rings
    const lhX = W * 0.57;
    const lhY = this.getArcY(lhX, W * 0.50, arcCenterY, arcR);
    const lhH = 265;
    const baseW = 28;
    const topW = 18;

    // 1. Tapering white ashlar stone tower shaft
    ctx.fillStyle = '#f5f5f4';
    ctx.beginPath();
    ctx.moveTo(lhX - baseW * 0.5, lhY);
    ctx.lineTo(lhX - topW * 0.5, lhY - lhH + 35);
    ctx.lineTo(lhX + topW * 0.5, lhY - lhH + 35);
    ctx.lineTo(lhX + baseW * 0.5, lhY);
    ctx.closePath();
    ctx.fill();

    // Longitudinal chisel impasto strokes along tower height
    this.brush.paintStroke(lhX - baseW * 0.25, lhY, lhX - topW * 0.25, lhY - lhH + 35, 7.5, '#ffffff', '#e5e5e4', undefined, false, false, 71, true);
    this.brush.paintStroke(lhX + baseW * 0.28, lhY, lhX + topW * 0.28, lhY - lhH + 35, 7.5, '#d6d3d1', '#a8a29e', undefined, false, false, 73, false);

    // 2. Delicate crimson horizontal ring bands (only 2 thin rings matching 2-6)
    const ring1Y = lhY - lhH * 0.35;
    const ring1W = baseW + (topW - baseW) * 0.35;
    this.brush.paintStroke(lhX - ring1W * 0.5, ring1Y, lhX + ring1W * 0.5, ring1Y, 7.5, '#dc2626', '#ef4444', '#991b1b');

    const ring2Y = lhY - lhH * 0.70;
    const ring2W = baseW + (topW - baseW) * 0.70;
    this.brush.paintStroke(lhX - ring2W * 0.5, ring2Y, lhX + ring2W * 0.5, ring2Y, 7.5, '#dc2626', '#ef4444', '#991b1b');

    // 3. Cast-iron lantern gallery observation platform with corbels
    this.brush.paintStroke(lhX - 18, lhY - lhH + 35, lhX + 18, lhY - lhH + 35, 6.0, '#1c1917', '#44403c');
    // Railing
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(lhX - 16, lhY - lhH + 25);
    ctx.lineTo(lhX + 16, lhY - lhH + 25);
    ctx.stroke();

    // 4. Glowing beacon lantern chamber with open brazier fire & sweeping beam
    const beaconPulse = 0.75 + 0.25 * Math.sin(t * 10.0);
    ctx.fillStyle = `rgba(254, 240, 138, ${beaconPulse})`;
    ctx.beginPath();
    ctx.arc(lhX, lhY - lhH + 16, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(lhX, lhY - lhH + 16, 7, 0, TAU);
    ctx.fill();

    // Sweeping golden searchlight beam across Mediterranean sea
    const beamAng = (t * 1.4) % TAU;
    const beamSpread = 0.24;
    const beamLen = 340;
    const beamGrad = ctx.createRadialGradient(lhX, lhY - lhH + 16, 6, lhX, lhY - lhH + 16, beamLen);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    beamGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.15)');
    beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(lhX, lhY - lhH + 16);
    ctx.arc(lhX, lhY - lhH + 16, beamLen, beamAng - beamSpread, beamAng + beamSpread);
    ctx.closePath();
    ctx.fill();

    // Bronze lantern chamber framing
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(lhX - 10, lhY - lhH + 6, 20, 20);

    // 5. Azure/navy blue conical lantern cap with finial needle (matching 2-6)
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.moveTo(lhX - 14, lhY - lhH + 6);
    ctx.lineTo(lhX, lhY - lhH - 22);
    ctx.lineTo(lhX + 14, lhY - lhH + 6);
    ctx.closePath();
    ctx.fill();
    this.brush.paintStroke(lhX, lhY - lhH - 22, lhX, lhY - lhH - 34, 2.5, '#facc15', '#ffffff');

    // --- G. STONE PIER WITH POPULATION OF CITIZENS (matching 2-6) ---
    this.brush.paintStroke(portX + 38, tempY + 2, lhX + 22, lhY + 2, 24, '#a8a29e', '#d6d3d1', '#78716c', false, false, 5, true);
    this.mannequin.paintPierCitizens(portX + 46, tempY, t);
  }

  // ---------------------------------------------------------------------------
  // 5. ACT III: BILLOWING GALLEON SHIPS WITH OCEAN HEAVE & PITCH (matching 2-6)
  // ---------------------------------------------------------------------------
  public paintGalleon(
    shipX: number,
    shipY: number,
    size: number,
    sailText: string,
    textColor: string,
    t: number = 0,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    const s = size;
    const isHero = sailText === 'STRANGERS';

    // Rhythmic ocean heave and pitch
    const heave = Math.sin(t * 2.4 + shipX * 0.015) * (5.0 * s);
    const pitch = Math.sin(t * 2.0 + shipX * 0.018) * 0.045;

    ctx.translate(shipX, shipY + heave);
    ctx.rotate(pitch);

    // Dynamic foaming bow spray parting at cutwater
    const hullW = isHero ? 95 * s : 62 * s;
    const hullH = isHero ? 28 * s : 22 * s;

    // Bow wave froth
    this.brush.paintStroke(-hullW - 10 * s, 4 * s, -hullW + 14 * s, 8 * s, 5.5 * s, '#ffffff', '#e0f2fe');
    this.brush.paintStroke(-hullW - 16 * s, 2 * s + Math.sin(t * 12.0) * 3, -hullW - 2 * s, 6 * s, 3.5 * s, '#ffffff');

    // Mahogany volumetric hull with carved woodgrain
    this.brush.paintStroke(-hullW, hullH * 0.7, hullW, -hullH * 0.1, hullH, '#54321b', '#784727', '#331c0d', false, false, 0, true);
    // Red / blue gunwale waterline trim
    this.brush.paintStroke(-hullW * 0.95, hullH * 0.15, hullW * 0.95, -hullH * 0.35, 6 * s, isHero ? '#1d4ed8' : '#dc2626');

    // Gunports / portholes along hull
    const numPorts = isHero ? 4 : 2;
    for (let gp = -numPorts; gp <= numPorts; gp++) {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(gp * 18 * s - 3 * s, 6 * s, 6 * s, 6 * s);
    }

    // Little wooden mannequin sailors / crew on deck (matching 2-6)
    const crewPositions = isHero ? [-55, -35, -15, 5, 25, 45, 65] : [-22, 0, 22];
    for (let c = 0; c < crewPositions.length; c++) {
      const cx = crewPositions[c] * s;
      const cy = -4 * s;
      // Body tunic
      ctx.fillStyle = c % 2 === 0 ? '#dc2626' : '#2563eb';
      ctx.fillRect(cx - 2.5 * s, cy - 14 * s, 5 * s, 14 * s);
      // Carved wooden head
      ctx.fillStyle = '#9d5e32';
      ctx.beginPath();
      ctx.arc(cx, cy - 17 * s, 3.2 * s, 0, TAU);
      ctx.fill();
    }

    // Heavy timber main mast and yardarms
    const mastH = isHero ? 255 * s : 185 * s;
    this.brush.paintStroke(0, 0, 0, -mastH, 12 * s, '#3b2210', '#54321b');

    // Topmast pennant flag dynamically fluttering in the sea wind (multi-vertex spline)
    const flagLen = 34 * s;
    const flagPhase = t * 11.0 + shipX * 0.05;
    ctx.fillStyle = isHero ? '#1d4ed8' : '#dc2626';
    ctx.beginPath();
    ctx.moveTo(0, -mastH);
    for (let xf = 0; xf <= flagLen; xf += 4) {
      const yf = -mastH + 4 * s + Math.sin(flagPhase + xf * 0.22) * (3.5 * s) * (xf / flagLen);
      ctx.lineTo(xf, yf);
    }
    ctx.lineTo(flagLen * 0.72, -mastH + 12 * s);
    for (let xf = flagLen * 0.72; xf >= 0; xf -= 4) {
      const yf = -mastH + 15 * s + Math.sin(flagPhase + xf * 0.22 + 0.4) * (2.8 * s) * (xf / flagLen);
      ctx.lineTo(xf, yf);
    }
    ctx.closePath();
    ctx.fill();

    // Standing and running rigging ropes
    ctx.strokeStyle = 'rgba(59, 34, 16, 0.65)';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(-hullW * 0.75, 0);
    ctx.lineTo(0, -mastH * 0.85);
    ctx.lineTo(hullW * 0.75, 0);
    ctx.moveTo(-hullW * 0.55, 0);
    ctx.lineTo(0, -mastH * 0.55);
    ctx.lineTo(hullW * 0.55, 0);
    ctx.stroke();

    // Billowing main canvas sail (matching 2-6)
    const sailW = isHero ? 140 * s : 58 * s;
    const sailTopH = isHero ? 185 * s : 162 * s;
    const sailBotH = isHero ? 50 * s : 45 * s;

    // Mainsail yardarm
    this.brush.paintStroke(-sailW * 1.05, -sailTopH, sailW * 1.05, -sailTopH, 6.5 * s, '#54321b', '#784727');
    // Lower yardarm
    this.brush.paintStroke(-sailW * 0.95, -sailBotH, sailW * 0.95, -sailBotH, 5.5 * s, '#54321b', '#784727');

    // Sail canvas fill with dynamic wind billow
    const billowPulse = Math.sin(t * 3.0 + shipX * 0.02) * (3.0 * s);
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(-sailW, -sailBotH);
    ctx.quadraticCurveTo(0, -sailBotH + 12 * s + billowPulse, sailW, -sailBotH);
    ctx.lineTo(sailW * 0.94, -sailTopH);
    ctx.quadraticCurveTo(0, -sailTopH - 10 * s - billowPulse, -sailW * 0.94, -sailTopH);
    ctx.closePath();
    ctx.fill();

    // Red trim along upper & lower edges of mainsail (matching 2-6)
    if (isHero) {
      this.brush.paintStroke(-sailW * 0.92, -sailTopH + 4 * s, sailW * 0.92, -sailTopH + 4 * s, 4.0 * s, '#dc2626');
      this.brush.paintStroke(-sailW * 0.92, -sailBotH - 4 * s, sailW * 0.92, -sailBotH - 4 * s, 4.0 * s, '#dc2626');
    }

    // Canvas vertical fabric weave folds on mainsail
    const numFolds = isHero ? 7 : 4;
    for (let fold = -numFolds; fold <= numFolds; fold++) {
      const fx = fold * (sailW / (numFolds + 0.5));
      this.brush.paintStroke(fx, -sailBotH, fx, -sailTopH, 4.5 * s, '#fef9c3', '#ffffff', '#e2d9b6', false, false, fold + 10, true);
    }

    // Calligraphic Diegetic Sail Typography ("THEN", "THE", "STRANGERS" - matching 2-4 & 2-6)
    // Painted directly on the billowing canvas cloth, curving with the wind belly
    const textLen = sailText.length;
    const glyphSize = isHero ? 34 * s : 36 * s;
    const charSpacing = glyphSize * 0.72;
    const totalW = (textLen - 1) * charSpacing;
    const startX = -totalW * 0.5;
    const midY = -(sailBotH + sailTopH) * 0.5;

    for (let c = 0; c < textLen; c++) {
      const char = sailText[c];
      const u = textLen > 1 ? (c / (textLen - 1) - 0.5) * 2 : 0; // -1 to 1
      const gx = startX + c * charSpacing;
      // Follow the convex belly of the wind-filled sail
      const gy = midY + Math.cos(u * Math.PI * 0.45) * (7.5 * s + billowPulse * 0.5);
      const rot = u * 0.08; // Slight radial fan with cloth curvature

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(rot);
      this.typo.paintChiselGlyph(
        char,
        0,
        0,
        glyphSize,
        textColor,
        textColor === '#1d4ed8' ? '#60a5fa' : '#f87171',
        c * 17,
      );
      ctx.restore();
    }

    // UPPER TOPSAIL (Only for hero merchant galleon "STRANGERS" - matching 2-6)
    if (isHero) {
      // Upper topmast yardarm
      this.brush.paintStroke(-58 * s, -248 * s, 58 * s, -248 * s, 5.5 * s, '#54321b', '#784727');
      // Billowing topsail canvas
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-52 * s, -196 * s);
      ctx.quadraticCurveTo(0, -188 * s + billowPulse * 0.6, 52 * s, -196 * s);
      ctx.lineTo(46 * s, -245 * s);
      ctx.quadraticCurveTo(0, -252 * s - billowPulse * 0.6, -46 * s, -245 * s);
      ctx.closePath();
      ctx.fill();
      // Topsail vertical folds
      for (let tf = -3; tf <= 3; tf++) {
        const tx = tf * 15 * s;
        this.brush.paintStroke(tx, -196 * s, tx, -245 * s, 4.0 * s, '#fef9c3', '#ffffff', '#e2d9b6', false, false, tf + 30, true);
      }
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5B. ACT III & IV: TACTILE CURVED IMPASTO OCEAN ENGINE (No blue PVC pipes!)
  // ---------------------------------------------------------------------------
  public paintCurvedImpastoOcean(
    x1: number,
    x2: number,
    arcCenterX: number,
    arcCenterY: number,
    arcR: number,
    depth: number = 85,
    t: number = 0,
    seed: number = 10,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    // 1. Deep blue under-bed filling the ocean basin
    const segs = 32;
    ctx.beginPath();
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const x = x1 + u * (x2 - x1);
      const y = this.getArcY(x, arcCenterX, arcCenterY, arcR);
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let s = segs; s >= 0; s--) {
      const u = s / segs;
      const x = x1 + u * (x2 - x1);
      const y = this.getArcY(x, arcCenterX, arcCenterY, arcR) + depth;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // 2. Fluid, continuous maritime impasto wave sweeps (matching 2-4 & 2-6)
    // Long overlapping palette-knife sweeps that blend seamlessly across depth without discrete tile blocks
    const waveCount = 26;
    for (let w = 0; w < waveCount; w++) {
      const wSeed = seed * 50 + w * 17;
      const u1 = this.brush.hash(wSeed * 11) * 0.75;
      const spanU = 0.22 + this.brush.hash(wSeed * 13) * 0.32;
      const u2 = Math.min(1.0, u1 + spanU);

      const wx1 = x1 + u1 * (x2 - x1);
      const wx2 = x1 + u2 * (x2 - x1);
      const wDepth = 4 + Math.pow(this.brush.hash(wSeed * 17), 1.2) * (depth - 12);

      const waveCols = ['#1e3a8a', '#1e40af', '#1d4ed8', '#1e3a8a', '#172554', '#2563eb'];
      const col = waveCols[w % waveCols.length];
      const hiCol = w % 2 === 0 ? '#3b82f6' : '#60a5fa';

      const strokeH = 12 + this.brush.hash(wSeed * 19) * 14;

      // Draw sweeping curved impasto ribbon along the arc
      const arcSegs = 14;
      ctx.beginPath();
      for (let s = 0; s <= arcSegs; s++) {
        const su = s / arcSegs;
        const sx = wx1 + su * (wx2 - wx1);
        const sy = this.getArcY(sx, arcCenterX, arcCenterY, arcR) + wDepth +
                   Math.sin(t * 2.5 + w * 1.2 + su * 8) * 2.5;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }

      ctx.strokeStyle = col;
      ctx.lineWidth = strokeH;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.88;
      ctx.stroke();

      // Inner wet highlight drag
      ctx.strokeStyle = hiCol;
      ctx.lineWidth = strokeH * 0.35;
      ctx.globalAlpha = 0.55;
      ctx.stroke();

      // White seafoam crest along upper edge of near-surface waves
      if (wDepth < depth * 0.45 && this.brush.hash(wSeed * 23) > 0.30) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        for (let s = 0; s <= arcSegs; s += 2) {
          const su = s / arcSegs;
          const sx = wx1 + su * (wx2 - wx1);
          const sy = this.getArcY(sx, arcCenterX, arcCenterY, arcR) + wDepth - strokeH * 0.36 +
                     Math.sin(t * 2.5 + w * 1.2 + su * 8) * 2.5;
          if (s === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
    }

    // Discrete organic impasto seafoam flecks along the top wave crests (matching 2-6)
    const foamFlecks = 16;
    for (let f = 0; f < foamFlecks; f++) {
      const u = (f + 0.5) / foamFlecks;
      const fx = x1 + u * (x2 - x1) + (this.brush.hash(seed * 43 + f * 17) - 0.5) * 16;
      const fy = this.getArcY(fx, arcCenterX, arcCenterY, arcR) + 2 + (this.brush.hash(seed * 47 + f * 19) - 0.5) * 3;
      const tang = Math.atan2(fy - arcCenterY, fx - arcCenterX) + Math.PI * 0.5;
      const cosT = Math.cos(tang);
      const sinT = Math.sin(tang);
      this.brush.paintStroke(fx - cosT * 12, fy - sinT * 12, fx + cosT * 12, fy + sinT * 12, 3.4, '#ffffff', '#e0f2fe', undefined, true, true, seed + f * 7, false);
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 6. ACT IV: NEOCLASSICAL CAPITOL, BILLBOARDS, BEES & FLANKS (matching 2-10)
  // ---------------------------------------------------------------------------
  public paintCapitol(capX: number, capY: number): void {
    const ctx = this.ctx;

    // A. Monumental 3-Story Beaux-Arts Facade (matching 2-10)
    const facadeW = 230;
    const facadeH = 145;
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(capX - facadeW * 0.5, capY - facadeH, facadeW, facadeH);
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(capX - facadeW * 0.5, capY - facadeH, facadeW, facadeH);

    // Rows of arched windows across 3 stories
    for (let floor = 0; floor < 3; floor++) {
      const fy = capY - facadeH + 22 + floor * 40;
      for (let w = -6; w <= 6; w++) {
        const wx = capX + w * 16;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(wx, fy, 4.0, Math.PI, 0);
        ctx.rect(wx - 4.0, fy, 8.0, 16);
        ctx.fill();
      }
    }

    // Central entrance portico: triangular pediment over columns (matching 2-10)
    const porticoW = 90;
    const pedimentH = 26;
    ctx.fillStyle = '#f5f5f4';
    ctx.beginPath();
    ctx.moveTo(capX - porticoW * 0.5, capY - facadeH);
    ctx.lineTo(capX, capY - facadeH - pedimentH);
    ctx.lineTo(capX + porticoW * 0.5, capY - facadeH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Central portico fluted marble columns
    for (let c = -3; c <= 3; c++) {
      const cx = capX + c * 13;
      this.brush.paintStroke(cx, capY, cx, capY - facadeH, 8.0, '#f5f5f4', '#ffffff', '#a8a29e', false, false, c, true);
    }

    // B. Grand Ribbed Verdigris Main Dome on Colonnaded Drum (matching 2-10)
    const drumW = 120;
    const drumH = 38;
    const drumY = capY - facadeH;
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(capX - drumW * 0.5, drumY - drumH, drumW, drumH);
    // Drum arched windows
    for (let dw = -3; dw <= 3; dw++) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(capX + dw * 15 - 3.5, drumY - drumH + 8, 7.0, 22);
    }

    // Ribbed Verdigris Dome
    const domeY = drumY - drumH;
    const domeR = 72;
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(capX, domeY, domeR, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Verdigris ribs radiating to apex
    for (let rib = -4; rib <= 4; rib++) {
      const ra = (rib / 5) * (Math.PI / 2);
      this.brush.paintStroke(
        capX + Math.sin(ra) * (domeR - 2), domeY - Math.cos(ra) * (domeR - 2),
        capX, domeY - domeR,
        5.5,
        '#10b981',
        '#34d399',
      );
    }
    // Lantern cupola & spire with flagpole
    this.brush.paintStroke(capX, domeY - domeR, capX, domeY - domeR - 35, 14, '#047857', '#34d399');
    this.brush.paintStroke(capX, domeY - domeR - 35, capX, domeY - domeR - 60, 3, '#e2e8f0');

    // C. Secondary Verdigris Dome on Left Wing (matching 2-10)
    const secX = capX - 86;
    const secDrumY = capY - facadeH;
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(secX - 32, secDrumY - 24, 64, 24);
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(secX, secDrumY - 24, 30, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    this.brush.paintStroke(secX, secDrumY - 54, secX, secDrumY - 74, 8, '#047857', '#34d399');

    // D. Italianate Clock Campanile Tower on Right (matching 2-10)
    const towerX = capX + 130;
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(towerX - 16, capY - 310, 32, 310);
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(towerX - 16, capY - 310, 32, 310);

    // Round Clock Face
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(towerX, capY - 240, 11, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Belfry arched opening
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(towerX - 6, capY - 280, 12, 22);

    // Verdigris conical roof spire
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.moveTo(towerX - 18, capY - 310);
    ctx.lineTo(towerX, capY - 365);
    ctx.lineTo(towerX + 18, capY - 310);
    ctx.closePath();
    ctx.fill();

    // E. Manicured Terrace, Wrought-Iron Fence & Painterly Landscaped Trees (matching 2-10)
    this.brush.paintStroke(capX - 145, capY + 4, capX + 145, capY + 4, 14, '#78716c', '#a8a29e', '#44403c');
    // Wrought-iron fence
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(capX - 140, capY - 14);
    ctx.lineTo(capX + 140, capY - 14);
    ctx.stroke();
    for (let p = -14; p <= 14; p++) {
      ctx.beginPath();
      ctx.moveTo(capX + p * 10, capY);
      ctx.lineTo(capX + p * 10, capY - 16);
      ctx.stroke();
    }

    // Painterly little trees with brown trunks and lush green leafy canopies
    const treeLocs = [-115, -80, -45, 45, 80, 115];
    const leafCols = ['#14532d', '#166534', '#15803d', '#22c55e'];
    for (let tIdx = 0; tIdx < treeLocs.length; tIdx++) {
      const tx = capX + treeLocs[tIdx];
      this.brush.paintStroke(tx, capY, tx, capY - 26, 5.5, '#54321b', '#784727');
      for (let d = 0; d < 8; d++) {
        const da = (d / 8) * TAU;
        const dr = 8 + (d % 3) * 4;
        const dx = tx + Math.cos(da) * dr;
        const dy = capY - 34 + Math.sin(da) * dr * 0.75;
        ctx.fillStyle = leafCols[(d + tIdx) % leafCols.length];
        ctx.beginPath();
        ctx.arc(dx, dy, 7.0, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Monumental Victorian Wrought-Iron Billboards tilted along globe radial normal ("THEN AND" & "THE AND" - matching 2-10)
  public paintBillboard(bx: number, by: number, word1: string, word2: string, tiltAng: number = 0): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tiltAng);

    const boardW = 138;
    const boardH = 108;
    const boardY = -175;
    const postSpan = boardW * 0.52;

    // 1. Heavy dark wrought-iron scaffolding posts rooted firmly into ground
    this.brush.paintStroke(-postSpan, 0, -postSpan, boardY - 18, 9.5, '#0f172a', '#1e293b', '#020617');
    this.brush.paintStroke(postSpan, 0, postSpan, boardY - 18, 9.5, '#0f172a', '#1e293b', '#020617');

    // Diagonal iron cross-bracing struts beneath the board
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-postSpan, -25);
    ctx.lineTo(postSpan, boardY + boardH);
    ctx.moveTo(postSpan, -25);
    ctx.lineTo(-postSpan, boardY + boardH);
    ctx.stroke();

    // 2. Ornate curved wrought-iron arched crest spanning over board with curled scrolls (matching 2-10)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    // Sweeping top arch
    ctx.moveTo(-postSpan - 12, boardY);
    ctx.quadraticCurveTo(0, boardY - 34, postSpan + 12, boardY);
    ctx.stroke();

    // Curled scrollwork finials at crest apex and corners
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(-postSpan - 6, boardY - 10, 8, 0, TAU);
    ctx.arc(postSpan + 6, boardY - 10, 8, 0, TAU);
    ctx.arc(0, boardY - 26, 7, 0, TAU);
    ctx.stroke();

    // 3. Deep rich forest green enamel paneled board with white border
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(-boardW * 0.5, boardY, boardW, boardH);

    // Thick white outer border rule
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4.0;
    ctx.strokeRect(-boardW * 0.5 + 2, boardY + 2, boardW - 4, boardH - 4);

    // Delicate inner pinstripe
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-boardW * 0.5 + 7, boardY + 7, boardW - 14, boardH - 14);

    // 4. Bold hand-lettered white display typography (matching 2-10)
    this.typo.paintText(word1, 0, boardY + boardH * 0.35, 38, '#ffffff');
    this.typo.paintText(word2, 0, boardY + boardH * 0.75, 36, '#ffffff');

    ctx.restore();
  }

  // Organic Flocking Honeybee Swarm spelling "BEES" (matching 2-10)
  public paintSwarmingBees(capX: number, capY: number, t: number): void {
    const ctx = this.ctx;

    // Define continuous calligraphic stroke paths for "B", "E", "E", "S"
    const letterPaths: { letter: string; cx: number; strokes: [number, number][][] }[] = [
      {
        letter: 'B',
        cx: capX - 135,
        strokes: [
          [[-16, 32], [-16, -32]], // vertical stem
          [[-16, -32], [6, -32], [14, -18], [6, -4], [-16, -4]], // top loop
          [[-16, -4], [8, -4], [18, 14], [8, 32], [-16, 32]],   // bottom loop
        ],
      },
      {
        letter: 'E',
        cx: capX - 45,
        strokes: [
          [[-15, 32], [-15, -32]], // vertical stem
          [[-15, -32], [16, -32]], // top bar
          [[-15, -2], [10, -2]],   // mid bar
          [[-15, 32], [16, 32]],   // bot bar
        ],
      },
      {
        letter: 'E',
        cx: capX + 45,
        strokes: [
          [[-15, 32], [-15, -32]], // vertical stem
          [[-15, -32], [16, -32]], // top bar
          [[-15, -2], [10, -2]],   // mid bar
          [[-15, 32], [16, 32]],   // bot bar
        ],
      },
      {
        letter: 'S',
        cx: capX + 135,
        strokes: [
          [[14, -26], [6, -32], [-10, -32], [-16, -18], [-6, -4], [12, 6], [16, 20], [8, 32], [-10, 32], [-16, 24]],
        ],
      },
    ];

    const swarmBaseY = capY - 335;

    // 1. Swarming bees & golden pollen particles distributed along the strokes
    for (let lpIdx = 0; lpIdx < letterPaths.length; lpIdx++) {
      const lp = letterPaths[lpIdx];
      const lcx = lp.cx;

      for (let sIdx = 0; sIdx < lp.strokes.length; sIdx++) {
        const strokePts = lp.strokes[sIdx];
        const segCount = strokePts.length - 1;

        for (let seg = 0; seg < segCount; seg++) {
          const p1 = strokePts[seg];
          const p2 = strokePts[seg + 1];
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          const segLen = Math.hypot(dx, dy);
          const numBees = Math.max(6, Math.floor(segLen * 0.95));

          for (let b = 0; b < numBees; b++) {
            const u = b / numBees;
            const bSeed = lpIdx * 1000 + sIdx * 100 + seg * 20 + b;
            // Swarm turbulence: bees vibrate and circle rapidly in the cloud
            const orbitR = 3.5 + this.brush.hash(bSeed * 17) * 9.5;
            const orbitAng = t * 14.0 + this.brush.hash(bSeed * 29) * TAU;
            const jx = Math.cos(orbitAng) * orbitR;
            const jy = Math.sin(orbitAng) * (orbitR * 0.75);

            const bx = lcx + p1[0] + dx * u + jx;
            const by = swarmBaseY + p1[1] + dy * u + jy;

            // Golden pollen cloud glow speck
            ctx.fillStyle = 'rgba(251, 191, 36, 0.40)';
            ctx.beginPath();
            ctx.arc(bx, by, 3.8, 0, TAU);
            ctx.fill();

            // Honeybee body (black thorax + yellow abdomen)
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.arc(bx - 1.5, by, 1.8, 0, TAU);
            ctx.fill();

            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.ellipse(bx + 1.8, by, 2.6, 1.6, 0.15, 0, TAU);
            ctx.fill();

            // Translucent buzzing wings
            const wingFlap = Math.sin(t * 45.0 + bSeed) * 4.0;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + 1.5, by - 4.5 + wingFlap);
            ctx.stroke();
          }
        }
      }
    }

    // 2. Swirling loose bees circulating between the letters like a dynamic bee tornado
    for (let f = 0; f < 38; f++) {
      const fSeed = f * 31;
      const progress = ((t * 0.45 + f * 0.035) % 1.0);
      const fx = capX - 165 + progress * 330 + Math.sin(t * 8.0 + f) * 16;
      const fy = swarmBaseY + Math.sin(progress * Math.PI * 4 + f) * 26 + (this.brush.hash(fSeed) - 0.5) * 18;

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 2.2, 1.4, 0.2, 0, TAU);
      ctx.fill();
    }
  }

  // Geological Mountain Bluff with 3D Stone "WOLVES", Pine Forest & Anatomical Howling Wolf Pack (matching 2-10 & 2-14)
  public paintWolvesRidge(wolfX: number, wolfY: number, arcCenterY: number, arcR: number, W: number, t: number = 0): void {
    const ctx = this.ctx;

    // A. Angled geological rock strata following the natural curvature of the globe
    const strataColors = ['#533b29', '#6e5038', '#8a6547', '#3a271a', '#947255'];
    for (let s = 0; s < 5; s++) {
      const sr = arcR - 10 - s * 16;
      ctx.strokeStyle = strataColors[s % strataColors.length];
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(W * 0.50, arcCenterY, sr, -Math.PI * 0.88, -Math.PI * 0.65, false);
      ctx.stroke();
    }

    // Rocky crag shelves along the slope
    for (let c = 0; c < 8; c++) {
      const cx1 = wolfX - 140 + c * 35;
      const cy1 = this.getArcY(cx1, W * 0.50, arcCenterY, arcR) + 2;
      const cx2 = cx1 + 28;
      const cy2 = this.getArcY(cx2, W * 0.50, arcCenterY, arcR) + 2;
      this.brush.paintStroke(cx1, cy1, cx2, cy2, 14, '#452c1a', '#69462b', '#1e1107', false, false, c * 11, true);
    }

    // Evergreen pine forest rooted directly in the curved terrain with subtle wind sway (matching 2-10 & 2-14)
    const pineLocs = [
      { x: wolfX - 145, h: 42 },
      { x: wolfX - 110, h: 54 },
      { x: wolfX - 75,  h: 58 },
      { x: wolfX - 35,  h: 50 },
      { x: wolfX + 5,   h: 56 },
      { x: wolfX + 45,  h: 48 },
      { x: wolfX + 85,  h: 44 },
      { x: wolfX + 120, h: 38 },
      { x: wolfX + 145, h: 34 },
    ];
    for (const pt of pineLocs) {
      const py = this.getArcY(pt.x, W * 0.50, arcCenterY, arcR);
      const pineSway = Math.sin(t * 2.2 + pt.x * 0.04) * 2.5;
      this.brush.paintStroke(pt.x, py, pt.x + pineSway * 0.3, py - 16, 5.0, '#29180d');
      for (let tr = 0; tr < 3; tr++) {
        const ty = py - 10 - tr * (pt.h * 0.28);
        const tw = (pt.h * 0.38) * (1 - tr * 0.22);
        const layerSway = pineSway * (0.4 + tr * 0.3);
        ctx.fillStyle = tr % 2 === 0 ? '#14532d' : '#166534';
        ctx.beginPath();
        ctx.moveTo(pt.x - tw + layerSway, ty);
        ctx.lineTo(pt.x + layerSway, ty - pt.h * 0.38);
        ctx.lineTo(pt.x + tw + layerSway, ty);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }
    }

    // B. Monumental 3D Carved Stone Letters "WOLVES" resting firmly on the slope (matching 2-10)
    const letters = ['W', 'O', 'L', 'V', 'E', 'S'];
    const letterSpacing = 42;
    const startLx = wolfX - 105;

    for (let i = 0; i < letters.length; i++) {
      const lx = startLx + i * letterSpacing;
      const groundAtLx = this.getArcY(lx, W * 0.50, arcCenterY, arcR);
      const ly = groundAtLx - 30;

      // 3D Stone Block Letter
      this.typo.paintGlyph(letters[i], lx, ly, 54, '#f1f5f9', '#ffffff', '#334155', i * 7, true);

      // Anatomical Howling Timber Wolf perched on top of letter with living breathing & howling kinematics (matching 2-10)
      if (i === 0 || i === 2 || i === 4 || i === 5) {
        const wx = lx - 4;
        const wy = ly - 36;

        // Kinematic living rhythms
        const wolfBreath = Math.sin(t * 2.5 + i * 1.6) * 1.4;
        const tailSway = Math.sin(t * 2.8 + i * 1.8) * 4.5;
        const howlHeadRot = Math.sin(t * 2.0 + i * 1.2) * 0.08;

        ctx.save();
        ctx.translate(wx, wy);

        // 1. Muscular hindquarters & torso with breathing heave
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(-6, 8, 12, 7 + wolfBreath * 0.3, -0.2, 0, TAU);
        ctx.fill();

        // 2. Thick fur ruff and arched chest
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.ellipse(6, 2, 10 + wolfBreath * 0.4, 8, -0.4, 0, TAU);
        ctx.fill();

        // 3. Slender front legs planted on letter top
        this.brush.paintStroke(4, 6, 8, 20, 3.2, '#1e293b', '#334155');
        this.brush.paintStroke(10, 6, 12, 20, 3.2, '#1e293b', '#334155');

        // 4. Angled hind legs crouching
        this.brush.paintStroke(-10, 8, -12, 20, 3.5, '#1e293b', '#334155');

        // 5. Long bushy wolf tail hanging down over letter edge with wind sway
        this.brush.paintCurve(-14, 6, -24 + tailSway, 22, -22 + tailSway * 0.5, 12, 5.5, '#475569', '#64748b', '#1e293b', 6, i);

        // 6. Upraised neck thrown back howling skyward
        ctx.save();
        ctx.translate(6, 0);
        ctx.rotate(howlHeadRot);

        this.brush.paintStroke(0, 0, 10, -14, 7.5, '#64748b', '#94a3b8');

        // 7. Sculpted wolf head with pointed ears and open howling muzzle
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(8, -12);
        ctx.lineTo(18, -24); // Upper muzzle
        ctx.lineTo(20, -21); // Nose tip
        ctx.lineTo(14, -16); // Lower jaw
        ctx.closePath();
        ctx.fill();

        // Pointed lupine ears
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(8, -18);
        ctx.lineTo(7, -26);
        ctx.lineTo(11, -19);
        ctx.closePath();
        ctx.fill();

        // Silver throat fur highlight
        this.brush.paintStroke(2, 2, 12, -12, 2.5, '#e2e8f0', '#ffffff');

        ctx.restore();
        ctx.restore();
      }
    }
  }

  // Sculpted Breaching Blue Whale with Dynamic Water Spout Plume & Seafoam "WHALES" (matching 2-10 & 2-14)
  public paintBreachingWhale(whaleX: number, whaleY: number, t: number = 0): void {
    const ctx = this.ctx;

    // Rhythmic breaching heave and pitch
    const breachHeave = Math.sin(t * 1.6) * 12.0;
    const breachPitch = Math.sin(t * 1.6) * 0.045;

    ctx.save();
    ctx.translate(whaleX, whaleY + breachHeave);
    ctx.rotate(breachPitch);

    // 1. Sculpted anatomical blue whale body breaching diagonally from the ocean
    // Massive cobalt/indigo dorsal torso
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(-125, 14);
    // Arched dorsal hump rising up to 55px out of water
    ctx.quadraticCurveTo(-75, -58, 25, -42);
    // Tapering caudal peduncle to tail
    ctx.quadraticCurveTo(85, -28, 130, -6);
    ctx.lineTo(135, 18);
    ctx.lineTo(-125, 18);
    ctx.closePath();
    ctx.fill();

    // Subtle wet oil impasto sheen along dorsal crest
    this.brush.paintCurve(-105, 4, 35, -38, -45, -54, 8.5, '#3b82f6', '#60a5fa', '#1e3a8a', 8, 1);

    // Curved dorsal fin on lower back
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(32, -42);
    ctx.lineTo(46, -58);
    ctx.quadraticCurveTo(48, -46, 56, -38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#172554';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 2. White & pale azure ribbed ventral throat grooves (baleen pleats)
    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.moveTo(-120, 14);
    ctx.quadraticCurveTo(-65, -8, 10, 4);
    ctx.lineTo(10, 18);
    ctx.lineTo(-120, 18);
    ctx.closePath();
    ctx.fill();

    // Individual vertical baleen throat pleats
    for (let p = -110; p < 5; p += 12) {
      this.brush.paintStroke(p, 16, p + 4, 2, 2.0, '#93c5fd', '#bfdbfe');
    }

    // Whale eye & blowhole notch
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-82, -8, 3.2, 0, TAU);
    ctx.fill();

    // 3. Massive bifurcated fluke (tail fins) splashing into water
    ctx.save();
    ctx.translate(130, -6);
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(18, -26, 38, -32);
    ctx.quadraticCurveTo(24, -14, 32, 0);
    ctx.quadraticCurveTo(22, 12, 36, 26);
    ctx.quadraticCurveTo(16, 20, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#172554';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Splash seafoam dabs around whale entry/breach line
    for (let s = -130; s < 145; s += 24) {
      this.brush.paintStroke(s, 16, s + 18, 14, 4.5, '#ffffff', '#e0f2fe');
    }

    ctx.restore();

    // 4. Volumetric dynamic water spout plume expanding upward
    const spoutX = whaleX - 48;
    const spoutY = whaleY - 26 + breachHeave;
    const spoutPulse = 1.0 + Math.sin(t * 8.0) * 0.15;

    // Base high-pressure jet
    this.brush.paintStroke(spoutX, spoutY, spoutX, spoutY - 95 * spoutPulse, 12, 'rgba(255, 255, 255, 0.95)', '#bae6fd');
    this.brush.paintStroke(spoutX - 6, spoutY - 12, spoutX - 12, spoutY - 125 * spoutPulse, 7, 'rgba(255, 255, 255, 0.85)', '#dbeafe');
    this.brush.paintStroke(spoutX + 6, spoutY - 12, spoutX + 12, spoutY - 125 * spoutPulse, 7, 'rgba(255, 255, 255, 0.85)', '#dbeafe');

    // Billowing seafoam froth cloud heads at top of spout
    for (let c = 0; c < 6; c++) {
      const cx = spoutX - 22 + c * 9 + Math.sin(t * 4.0 + c) * 3;
      const cy = spoutY - 135 * spoutPulse + (c % 2) * 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, 9 + (c % 3) * 4, 0, TAU);
      ctx.fill();
    }

    // Dynamic drifting mist droplets from spout
    for (let m = 0; m < 14; m++) {
      const mProg = ((t * 2.0 + m * 0.14) % 1.0);
      const mx = spoutX + mProg * 40 + Math.sin(t * 6.0 + m) * 6;
      const my = spoutY - 95 - mProg * 55;
      const mr = 2.5 + mProg * 5;
      const mAlpha = (1.0 - mProg) * 0.65;
      ctx.fillStyle = `rgba(224, 242, 254, ${mAlpha})`;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.fill();
    }

    // Billowing seafoam froth letters "WHALES" arching in the sky (matching 2-10)
    this.typo.paintSeafoamText('WHALES', whaleX + 135, whaleY - 120, 68);
  }

  // Vintage Blue-and-White Striped Hot Air Balloon with Buoyant Oscillation
  public paintHotAirBalloon(balX: number, balY: number, t: number = 0): void {
    const ctx = this.ctx;
    const basketSway = Math.sin(t * 2.0) * 0.05;

    ctx.save();
    ctx.translate(balX, balY);
    ctx.rotate(basketSway * 0.5);

    // Balloon envelope (blue and white vertical stripes)
    const bR = 26;
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(0, 0, bR, 0, TAU);
    ctx.fill();

    // White stripes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, bR * 0.45, bR, 0, 0, TAU);
    ctx.fill();

    // Rigging & wicker basket with pendular sway
    ctx.save();
    ctx.rotate(basketSway);

    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, bR * 0.9);
    ctx.lineTo(-6, bR * 1.45);
    ctx.moveTo(10, bR * 0.9);
    ctx.lineTo(6, bR * 1.45);
    ctx.stroke();

    // Burner flame glow
    const burnerPulse = 0.5 + 0.5 * Math.sin(t * 12.0);
    ctx.fillStyle = `rgba(245, 158, 11, ${burnerPulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(0, bR * 1.15, 4, 0, TAU);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(-8, bR * 1.45, 16, 10);

    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 7. ACT V: ART DECO SKYSCRAPER METROPOLIS & STREAMING VIADUCT TRAFFIC (matching 2-15)
  // ---------------------------------------------------------------------------
  public paintArtDecoMetropolis(
    cityX: number,
    cityArcY: number,
    arcCenterY: number,
    arcR: number,
    t: number,
  ): void {
    const ctx = this.ctx;

    // Stepped Art Deco Skyscraper Cluster fanning radially along spherical curvature
    // Authentic Gotham-style ziggurat towers with multi-tiered setbacks and 3D relief (matching 2-14)
    const towers = [
      { w: 68, h: 220, xOff: -245, tiers: 2 },
      { w: 76, h: 285, xOff: -175, tiers: 3 },
      { w: 88, h: 360, xOff: -95,  tiers: 3 },
      { w: 145, h: 480, xOff: 0,    tiers: 4 }, // Central monumental tower
      { w: 88, h: 375, xOff: 95,   tiers: 3 },
      { w: 76, h: 295, xOff: 175,  tiers: 3 },
      { w: 68, h: 230, xOff: 245,  tiers: 2 },
    ];

    for (const tow of towers) {
      const tx = cityX + tow.xOff;
      const ty = this.getArcY(tx, cityX, arcCenterY, arcR);
      const radAng = Math.asin(Math.max(-0.85, Math.min(0.85, tow.xOff / arcR)));

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(radAng);

      // Render Multi-Tiered Ziggurat Setbacks (matching 2-14 & 2-15)
      const numTiers = tow.tiers;
      for (let tr = 0; tr < numTiers; tr++) {
        const trU = tr / numTiers;
        const trH = tow.h * (1 - trU * 0.75);
        const trW = tow.w * (1 - tr * 0.22);

        // Front limestone facade (deep twilight slate-indigo)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-trW * 0.5, -trH, trW, trH);

        // Left illuminated bevel facet (light twilight sheen)
        ctx.fillStyle = '#334155';
        ctx.fillRect(-trW * 0.5, -trH, trW * 0.22, trH);

        // Right shadow bevel facet (deep midnight shadow)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(trW * 0.28, -trH, trW * 0.22, trH);

        // DENSE ART DECO ARCHITECTURAL WINDOW FENESTRATION (matching 2-14 & 2-15)
        // Authentic Gotham skyscraper punched-window grid across the entire facade
        const winCols = Math.max(3, Math.floor(trW / 11));
        const winRows = Math.floor((trH - 22) / 14);
        const winColSpacing = (trW * 0.76) / (winCols - 1 || 1);
        const winStartX = -trW * 0.38;

        for (let row = 0; row < winRows; row++) {
          const wy = -trH + 18 + row * 14;
          for (let col = 0; col < winCols; col++) {
            const wx = winStartX + col * winColSpacing;
            const winSeed = tow.xOff * 100 + tr * 50 + row * 10 + col;

            // Unlit window aperture: deep midnight obsidian glass with subtle sill shadow
            ctx.fillStyle = '#090d16';
            ctx.fillRect(wx - 2.5, wy - 4.5, 5.0, 9.0);

            // Fine mullion frame
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(wx - 2.5, wy - 4.5, 5.0, 9.0);

            // Subtle interior office scatter lights (10% of unlit windows have faint ambient glow)
            if (this.brush.hash(winSeed * 31) < 0.12) {
              const ambientAlpha = 0.25 + 0.35 * this.brush.hash(winSeed * 47);
              ctx.fillStyle = `rgba(253, 224, 71, ${ambientAlpha})`;
              ctx.fillRect(wx - 1.8, wy - 3.5, 3.6, 7.0);
            }
          }
        }

        // Art Deco cornice molding at each setback ledge
        this.brush.paintStroke(-trW * 0.54, -trH, trW * 0.54, -trH, 6.0, '#475569', '#64748b', '#0f172a');

        // Vertical fluted limestone pilasters
        const pilasterCount = Math.floor(trW / 14);
        for (let p = 0; p <= pilasterCount; p++) {
          const px = -trW * 0.44 + (p / pilasterCount) * (trW * 0.88);
          ctx.strokeStyle = '#273549';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px, 0);
          ctx.lineTo(px, -trH);
          ctx.stroke();
        }
      }

      // Spire & radio antenna atop crown
      this.brush.paintStroke(0, -tow.h, 0, -tow.h - 52, 4.5, '#64748b', '#94a3b8');

      // Blinking red aviation beacon atop spire
      const beaconAlpha = 0.5 + 0.5 * Math.sin(t * 8.0 + tow.xOff);
      ctx.fillStyle = `rgba(239, 68, 68, ${beaconAlpha})`;
      ctx.beginPath();
      ctx.arc(0, -tow.h - 52, 4.0, 0, TAU);
      ctx.fill();

      ctx.restore();
    }

    // Warm golden street canyon ambient light bounce rising between towers
    const canyonGlow = ctx.createLinearGradient(0, cityArcY + 20, 0, cityArcY - 140);
    canyonGlow.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    canyonGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.10)');
    canyonGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = canyonGlow;
    ctx.fillRect(cityX - 260, cityArcY - 140, 520, 160);

    // Curved Multi-Arched Viaduct Highway Bridge sweeping along globe arc
    const viaductX1 = cityX - 290;
    const viaductX2 = cityX + 290;
    const viaductSegs = 16;
    const bridgeW = viaductX2 - viaductX1;

    // Bridge deck along curvature
    for (let s = 0; s < viaductSegs; s++) {
      const u1 = s / viaductSegs;
      const u2 = (s + 1) / viaductSegs;
      const x1 = viaductX1 + u1 * (viaductX2 - viaductX1);
      const x2 = viaductX1 + u2 * (viaductX2 - viaductX1);
      const y1 = this.getArcY(x1, cityX, arcCenterY, arcR) + 12;
      const y2 = this.getArcY(x2, cityX, arcCenterY, arcR) + 12;

      this.brush.paintStroke(x1, y1, x2, y2, 24, '#334155', '#475569', '#1e293b');
      // Highway roadbed surface
      this.brush.paintStroke(x1, y1 - 4, x2, y2 - 4, 3.5, '#1e293b', '#0f172a');
      this.brush.paintStroke(x1, y1 + 5, x2, y2 + 5, 3.5, '#1e293b', '#0f172a');
    }

    // Dynamic moving traffic along viaduct highway lanes (matching 2-14 & 2-15)
    const carSpeeds = [72, 95, 64, 108, 82, 68, 98, 88];
    for (let c = 0; c < 8; c++) {
      // Eastbound traffic lane (headlights forward, moving right)
      const progE = ((t * carSpeeds[c] + c * 75) % bridgeW) / bridgeW;
      const cxE = viaductX1 + progE * bridgeW;
      const cyE = this.getArcY(cxE, cityX, arcCenterY, arcR) + 8;

      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cxE - 6, cyE - 4, 12, 3.0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cxE + 4, cyE - 4, 3.5, 3.0);

      // Westbound traffic lane (taillights forward, moving left)
      const progW = 1.0 - (((t * carSpeeds[(c + 3) % 8] + c * 85) % bridgeW) / bridgeW);
      const cxW = viaductX1 + progW * bridgeW;
      const cyW = this.getArcY(cxW, cityX, arcCenterY, arcR) + 17;

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cxW - 6, cyW - 4, 12, 3.0);
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(cxW - 7, cyW - 4, 3.5, 3.0);
    }

    // Moving Art Deco passenger train across lower viaduct rail line
    const trainLen = 135;
    const trainSpeed = 75;
    const trainProg = ((t * trainSpeed) % (bridgeW + trainLen * 2)) - trainLen;
    const trainX = viaductX1 + trainProg;
    if (trainX > viaductX1 - trainLen && trainX < viaductX2 + trainLen) {
      const trainY = this.getArcY(trainX, cityX, arcCenterY, arcR) + 18;
      // Streamlined train chassis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(trainX - trainLen * 0.5, trainY, trainLen, 11);
      // Illuminated passenger windows
      for (let w = 0; w < 12; w++) {
        const wx = trainX - trainLen * 0.45 + w * (trainLen * 0.08);
        ctx.fillStyle = 'rgba(253, 224, 71, 0.92)';
        ctx.fillRect(wx - 2.5, trainY + 2.5, 5.0, 5.0);
      }
      // Forward locomotive headlight beam
      ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
      ctx.beginPath();
      ctx.moveTo(trainX + trainLen * 0.5, trainY + 4);
      ctx.lineTo(trainX + trainLen * 0.5 + 40, trainY - 2);
      ctx.lineTo(trainX + trainLen * 0.5 + 40, trainY + 12);
      ctx.closePath();
      ctx.fill();
    }

    // Viaduct stone piers resting on the earth
    for (let p = -4; p <= 4; p++) {
      const px = cityX + p * 62;
      const py = this.getArcY(px, cityX, arcCenterY, arcR) + 12;
      this.brush.paintStroke(px, py, px, py + 24, 14, '#1e293b', '#334155');
    }

    // DIEGETIC ILLUMINATED WINDOW MATRICES (spelling lyrics across facades)
    if (t > 16.8) {
      this.paintWindowMatrixText('EVERY TIME WE', cityX, cityArcY - 110, 8.2, 2.8);
    }
    if (t > 17.5) {
      this.paintWindowMatrixText('LEARNED SOME', cityX, cityArcY - 198, 8.8, 3.0);
    }
    if (t > 18.2) {
      this.paintWindowMatrixText('MORE', cityX, cityArcY - 325, 9.8, 3.4);
    }
  }

  // 3x5 Diegetic Window Matrix Text Renderer (Illuminated Office Windows in Skyscraper Facades)
  public paintWindowMatrixText(
    text: string,
    x: number,
    y: number,
    charW: number,
    dotR: number,
  ): void {
    const ctx = this.ctx;
    const chars = text.split('');
    const charStep = charW * 4.2;
    const totalW = chars.length * charStep;
    let startX = x - totalW * 0.5;

    // Flanking unlit architectural windows on left margin
    for (let c = -2; c < 0; c++) {
      for (let r = 0; r < 5; r++) {
        const px = startX + c * charW;
        const py = y + r * charW;
        ctx.fillStyle = '#080d1a';
        ctx.beginPath();
        ctx.arc(px, py, dotR * 0.90, 0, TAU);
        ctx.fill();
      }
    }

    for (const ch of chars) {
      const pat = FONT_3X5[ch] || FONT_3X5[' '];
      for (let r = 0; r < 5; r++) {
        const bits = pat[r];
        for (let c = 0; c < 3; c++) {
          const px = startX + c * charW;
          const py = y + r * charW;

          if ((bits >> (2 - c)) & 1) {
            // 1. Radiant outer bloom aura (warm amber diffusion)
            ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
            ctx.beginPath();
            ctx.arc(px, py, dotR * 2.5, 0, TAU);
            ctx.fill();

            // 2. Warm cadmium/gold illuminated window pane
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(px, py, dotR * 1.25, 0, TAU);
            ctx.fill();

            // 3. Blinding pure white incandescent filament core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, dotR * 0.60, 0, TAU);
            ctx.fill();
          } else {
            // Dark unlit architectural window pane in facade grid
            ctx.fillStyle = '#080d1a';
            ctx.beginPath();
            ctx.arc(px, py, dotR * 0.90, 0, TAU);
            ctx.fill();
          }
        }
        // Unlit window spacer between characters
        const spacerX = startX + 3.1 * charW;
        const spacerY = y + r * charW;
        ctx.fillStyle = '#080d1a';
        ctx.beginPath();
        ctx.arc(spacerX, spacerY, dotR * 0.90, 0, TAU);
        ctx.fill();
      }
      startX += charStep;
    }

    // Flanking unlit architectural windows on right margin
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < 5; r++) {
        const px = startX + c * charW;
        const py = y + r * charW;
        ctx.fillStyle = '#080d1a';
        ctx.beginPath();
        ctx.arc(px, py, dotR * 0.90, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. ACT VI: COSMIC WOODEN DOOR IN SPACE VOID (Zero-G Floating & Radiant Light)
  // ---------------------------------------------------------------------------
  public paintCosmicDoor(doorX: number, doorY: number, doorOpen: number, t: number = 0): void {
    const ctx = this.ctx;

    // Zero-gravity gentle floating drift & subtle pendular tilt
    const doorFloatY = doorY + Math.sin(t * 1.5) * 8.5;
    const doorFloatTilt = Math.sin(t * 1.2) * 0.035;

    // Hand-painted calligraphic arch above door (matching 2-18)
    this.typo.paintOrangeCompassArcText(
      "WE'D UNLOCK ANOTHER",
      doorX,
      doorFloatY + 240,
      460,
      -Math.PI * 0.67,
      -Math.PI * 0.33,
      42,
      false,
      '#fffef5',
      '#f1f5f9',
    );

    // Weathered Sandstone / Rough-Hewn Timber Frame (matching 2-18)
    const frameW = 208;
    const frameH = 328;
    const topY = doorFloatY - frameH * 0.5;
    const botY = doorFloatY + frameH * 0.5;
    const leftX = doorX - frameW * 0.5;
    const rightX = doorX + frameW * 0.5;

    ctx.save();
    ctx.translate(doorX, doorFloatY);
    ctx.rotate(doorFloatTilt);
    ctx.translate(-doorX, -doorFloatY);

    // Radiant golden starlight shafts streaming through open door aperture into cosmic void
    if (doorOpen > 0.05) {
      ctx.save();
      const rayCount = 14;
      for (let r = 0; r < rayCount; r++) {
        const rayAng = -0.45 + (r / (rayCount - 1)) * 0.90;
        const rayLen = 220 + Math.sin(t * 4.0 + r) * 45;
        const rayAlpha = Math.min(1.0, doorOpen * 1.5) * (0.35 + 0.25 * Math.sin(t * 6.0 + r));
        const rayGrad = ctx.createLinearGradient(doorX, doorFloatY, doorX + Math.cos(rayAng) * rayLen, doorFloatY + Math.sin(rayAng) * rayLen);
        rayGrad.addColorStop(0, `rgba(254, 240, 138, ${rayAlpha})`);
        rayGrad.addColorStop(0.45, `rgba(251, 191, 36, ${rayAlpha * 0.45})`);
        rayGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(doorX - frameW * 0.42, doorFloatY - frameH * 0.42);
        ctx.lineTo(doorX + Math.cos(rayAng) * rayLen, doorFloatY + Math.sin(rayAng) * rayLen);
        ctx.lineTo(doorX + Math.cos(rayAng + 0.09) * rayLen, doorFloatY + Math.sin(rayAng + 0.09) * rayLen);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Threshold (bottom stone step with contact shadow)
    ctx.fillStyle = 'rgba(10, 6, 4, 0.55)';
    ctx.beginPath();
    ctx.ellipse(doorX, botY + 16, frameW * 0.62, 10, 0, 0, TAU);
    ctx.fill();
    this.brush.paintStroke(leftX - 18, botY + 10, rightX + 18, botY + 10, 22, '#d5cfc5', '#e7e5e4', '#a89f91', false, false, 3, true);

    // Left and Right Jambs (weathered ashlar stone / heavy timber posts)
    this.brush.paintStroke(leftX, topY - 10, leftX, botY, 24, '#d5cfc5', '#dfd8cc', '#a89f91', false, false, 5, true);
    this.brush.paintStroke(rightX, topY - 10, rightX, botY, 24, '#d5cfc5', '#dfd8cc', '#a89f91', false, false, 7, true);

    // Lintel (massive horizontal header stone with chiseled bevel)
    this.brush.paintStroke(leftX - 16, topY - 10, rightX + 16, topY - 10, 26, '#e2ddd5', '#f0ece4', '#a89f91', false, false, 9, true);

    // Mortise corner pegs on lintel
    ctx.fillStyle = '#422818';
    ctx.beginPath();
    ctx.arc(leftX, topY - 10, 4.5, 0, TAU);
    ctx.arc(rightX, topY - 10, 4.5, 0, TAU);
    ctx.fill();

    const doorInnerW = frameW - 20;
    const doorInnerH = frameH;

    // Radiant inner door aperture revealed when door opens
    ctx.fillStyle = '#050813';
    ctx.fillRect(doorX - doorInnerW * 0.5, topY + 2, doorInnerW, frameH - 8);
    if (doorOpen > 0.05) {
      const portalGrad = ctx.createRadialGradient(doorX, doorFloatY, 15, doorX, doorFloatY, doorInnerW * 0.75);
      portalGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1.0, doorOpen * 1.3)})`);
      portalGrad.addColorStop(0.35, `rgba(254, 240, 138, ${Math.min(1.0, doorOpen * 0.95)})`);
      portalGrad.addColorStop(0.70, `rgba(245, 158, 11, ${doorOpen * 0.55})`);
      portalGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
      ctx.fillStyle = portalGrad;
      ctx.fillRect(doorX - doorInnerW * 0.5, topY + 2, doorInnerW, frameH - 8);
    }

    // Door leaf swinging open on left hinge
    ctx.save();
    ctx.translate(doorX - frameW * 0.5 + 10, doorFloatY);
    ctx.scale(Math.cos(doorOpen * 1.45), 1.0);

    // Solid dark-walnut door leaf body (matching 2-18)
    ctx.fillStyle = '#3a2012';
    ctx.fillRect(0, -doorInnerH * 0.5, doorInnerW, doorInnerH);

    // 6 Vertical dark-walnut timber planks with grain and authentic rounded tongue scallops
    const plankW = doorInnerW / 6;
    for (let p = 0; p < 6; p++) {
      const px = p * plankW;
      // Plank body shading
      const grad = ctx.createLinearGradient(px, 0, px + plankW, 0);
      grad.addColorStop(0, '#54331e');
      grad.addColorStop(0.48, '#6e442a');
      grad.addColorStop(1, '#3b2010');
      ctx.fillStyle = grad;
      ctx.fillRect(px + 1, -doorInnerH * 0.5, plankW - 2, doorInnerH);

      // Chiseled vertical woodgrain strokes with rich impasto ridges
      this.brush.paintStroke(px + plankW * 0.35, -doorInnerH * 0.5 + 8, px + plankW * 0.35, doorInnerH * 0.5 - 6, 4.8, '#825232', '#99633e', '#452613', false, false, p * 7, true);
      this.brush.paintStroke(px + plankW * 0.72, -doorInnerH * 0.5 + 14, px + plankW * 0.72, doorInnerH * 0.5 - 10, 3.8, '#3d200e', '#593218', undefined, false, false, p * 11, false);

      // Authentic rounded tongue scallop only at bottom of plank (matching 2-18)
      ctx.fillStyle = '#54331e';
      ctx.beginPath();
      ctx.arc(px + plankW * 0.5, doorInnerH * 0.5, plankW * 0.44, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#2e190e';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Bold creamy-white wet-on-wet oil impasto "DOOR" (matching 2-18)
    this.typo.paintBoneWoodText('DOOR', doorInnerW * 0.50, -4, 68);

    // Wrought-iron horizontal lever latch handle on right side
    const latchX = doorInnerW - 28;
    const latchY = 18;
    // Iron backplate with beveled corners
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.roundRect(latchX - 7, latchY - 16, 14, 32, 3);
    ctx.fill();
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Horizontal forged lever handle
    this.brush.paintStroke(latchX, latchY, latchX + 34, latchY, 9.0, '#292524', '#57534e', '#0c0a09');
    // Fastening rivets
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(latchX, latchY - 10, 2.0, 0, TAU);
    ctx.arc(latchX, latchY + 10, 2.0, 0, TAU);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 9. ACT VII: MICROPROCESSOR CPU CHIP PACKAGE (Pulsing Neural Tree Traces)
  // ---------------------------------------------------------------------------
  public paintCpuChip(cpuX: number, cpuY: number, t: number = 0): void {
    const ctx = this.ctx;
    const s = 28; // 56x56 package matching 2-25
    // Ceramic dark package body with copper bevel frame
    ctx.fillStyle = '#060a14';
    ctx.fillRect(cpuX - s, cpuY - s, s * 2, s * 2);

    // Warm copper / cadmium orange beveled outer frame (matching 2-25)
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3.6;
    ctx.strokeRect(cpuX - s, cpuY - s, s * 2, s * 2);

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(cpuX - s + 2, cpuY - s + 2, (s - 2) * 2, (s - 2) * 2);

    // 8 Golden/copper leadframe pins (2 top, 2 bottom, 2 left, 2 right - matching 2-20 & 2-25)
    // Horizontal pins (where the Expanding Moral Circle connects!)
    const pinGlow = 0.7 + 0.3 * Math.sin(t * 8.0);
    for (const p of [-10, 10]) {
      this.brush.paintStroke(cpuX - s, cpuY + p, cpuX - s - 14, cpuY + p, 4.8, '#ea580c', `rgba(251, 191, 36, ${pinGlow})`);
      this.brush.paintStroke(cpuX + s, cpuY + p, cpuX + s + 14, cpuY + p, 4.8, '#ea580c', `rgba(251, 191, 36, ${pinGlow})`);
    }
    // Vertical pins (top & bottom)
    for (const p of [-11, 11]) {
      this.brush.paintStroke(cpuX + p, cpuY - s, cpuX + p, cpuY - s - 12, 4.8, '#ea580c', '#fbbf24');
      this.brush.paintStroke(cpuX + p, cpuY + s, cpuX + p, cpuY + s + 12, 4.8, '#ea580c', '#fbbf24');
    }

    // Glowing copper/gold neural branch / circuit tree with pulsing electrical data flow (matching 2-20 & 2-25)
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    // Central trunk
    ctx.moveTo(cpuX, cpuY + s * 0.72);
    ctx.lineTo(cpuX, cpuY - 4);
    // Left branch
    ctx.lineTo(cpuX - 14, cpuY - 16);
    ctx.lineTo(cpuX - 14, cpuY - s * 0.72);
    // Middle branch
    ctx.moveTo(cpuX, cpuY - 4);
    ctx.lineTo(cpuX, cpuY - s * 0.72);
    // Right branch
    ctx.moveTo(cpuX, cpuY - 4);
    ctx.lineTo(cpuX + 14, cpuY - 16);
    ctx.lineTo(cpuX + 14, cpuY - s * 0.72);
    // Sub-twigs
    ctx.moveTo(cpuX - 7, cpuY - 10);
    ctx.lineTo(cpuX - 7, cpuY - s * 0.65);
    ctx.moveTo(cpuX + 7, cpuY - 10);
    ctx.lineTo(cpuX + 7, cpuY - s * 0.65);
    ctx.stroke();

    // Inner fiery yellow highlight core with dynamic electric pulse
    const electricPulse = 0.5 + 0.5 * Math.sin(t * 10.0);
    ctx.strokeStyle = `rgba(254, 240, 138, ${0.7 + 0.3 * electricPulse})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Glowing neural node dots at tips and intersections pulsing with energy
    ctx.fillStyle = '#fde047';
    const nodes = [
      [cpuX, cpuY + s * 0.72],
      [cpuX, cpuY - 4],
      [cpuX - 14, cpuY - s * 0.72],
      [cpuX, cpuY - s * 0.72],
      [cpuX + 14, cpuY - s * 0.72],
      [cpuX - 7, cpuY - s * 0.65],
      [cpuX + 7, cpuY - s * 0.65],
    ];
    for (let idx = 0; idx < nodes.length; idx++) {
      const pt = nodes[idx];
      const nodePulse = 1.8 + Math.sin(t * 12.0 + idx * 1.5) * 0.8;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], nodePulse, 0, TAU);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------------------
  // 10. ACT VII: PROCEDURAL OIL IMPASTO EARTH GLOBE (matching 2-20 & 2-25)
  // ---------------------------------------------------------------------------
  public paintClimaxEarthGlobe(
    globeX: number,
    globeY: number,
    globeR: number,
    t: number,
    act7Alpha: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    // 1. Clip strictly to the sphere of Earth
    ctx.beginPath();
    ctx.arc(globeX, globeY, globeR, 0, TAU);
    ctx.clip();

    // Helper: Authentic physical oil-paint impasto dab with soft rounded contours and wet blend ridge
    const paintSoftImpastoDab = (
      x: number,
      y: number,
      rx: number,
      ry: number,
      angle: number,
      col: string,
      blend?: string,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // 1. Soft rounded body ellipse (no Minecraft polygon edges!)
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(3, rx), Math.max(2, ry), 0, 0, TAU);
      ctx.fill();

      // 2. Wet blend knife streak along central axis
      if (blend) {
        ctx.strokeStyle = blend;
        ctx.lineWidth = Math.max(1.0, ry * 0.40);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-rx * 0.60, -ry * 0.15);
        ctx.lineTo(rx * 0.60, -ry * 0.10);
        ctx.stroke();
      }
      ctx.restore();
    };

    // ==================== DAYLIGHT HEMISPHERE (LEFT SIDE) ====================
    // Deep fluid cobalt/ultramarine ocean base
    const dayOceanGrad = ctx.createLinearGradient(globeX - globeR, globeY, globeX, globeY);
    dayOceanGrad.addColorStop(0, '#111e48');
    dayOceanGrad.addColorStop(0.35, '#1e3a8a');
    dayOceanGrad.addColorStop(0.70, '#1d4ed8');
    dayOceanGrad.addColorStop(1, '#2563eb');
    ctx.fillStyle = dayOceanGrad;
    ctx.fillRect(globeX - globeR, globeY - globeR, globeR, globeR * 2);

    // Physical horizontal and curved oil-paint knife swaths giving rich continuous oceanic impasto texture (matching 2-20 & 2-25)
    for (let o = 0; o < 38; o++) {
      const u = this.brush.hash(o * 17 + 101);
      const v = this.brush.hash(o * 31 + 202);
      const ox = globeX - globeR * 0.92 + u * (globeR * 0.86);
      const oy = globeY - globeR * 0.85 + v * (globeR * 1.70);
      const dx = ox - globeX;
      const dy = oy - globeY;
      if (dx * dx + dy * dy < (globeR - 8) * (globeR - 8) && ox < globeX - 6) {
        const rx = 28 + this.brush.hash(o * 43) * 40;
        const ry = 8 + this.brush.hash(o * 53) * 12;
        const col = o % 3 === 0 ? '#1e40af' : o % 3 === 1 ? '#1d4ed8' : '#2563eb';
        const blendCol = o % 2 === 0 ? '#3b82f6' : '#60a5fa';
        const rot = (dx / globeR) * 0.12;
        paintSoftImpastoDab(ox, oy, rx, ry, rot, col, blendCol);
      }
    }

    // Dynamic planetary rotation & atmospheric parallax drift
    const rotT = Math.max(0, t - 23.0);
    const continentDriftX = rotT * 4.6;
    const cloudDriftX = rotT * 8.2;

    // Coastal turquoise shallow water shelves along continental margins
    ctx.save();
    ctx.translate(continentDriftX, 0);

    const shelves = [
      { x: globeX - 130, y: globeY - 140, rx: 38, ry: 24, rot: 0.1 },
      { x: globeX - 110, y: globeY - 45,  rx: 44, ry: 75, rot: -0.1 },
      { x: globeX - 25,  y: globeY - 55,  rx: 22, ry: 28, rot: 0.2 },
      { x: globeX - 15,  y: globeY + 12,  rx: 20, ry: 30, rot: -0.1 },
    ];
    for (const sh of shelves) {
      ctx.fillStyle = 'rgba(6, 182, 212, 0.40)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, sh.rx, sh.ry, sh.rot, 0, TAU);
      ctx.fill();
    }

    // ==================== CONTINENTAL LANDMASSES ====================
    // A. EUROPE & EURASIA
    const europePath = new Path2D();
    europePath.moveTo(globeX - 145, globeY - 130); // Iberia
    europePath.quadraticCurveTo(globeX - 135, globeY - 165, globeX - 110, globeY - 180); // France/Germany
    europePath.quadraticCurveTo(globeX - 85, globeY - 215, globeX - 65, globeY - 195); // Scandinavia
    europePath.quadraticCurveTo(globeX - 35, globeY - 185, globeX - 5, globeY - 145);  // Russia to terminator
    europePath.quadraticCurveTo(globeX - 45, globeY - 120, globeX - 75, globeY - 130); // Mediterranean/Balkans
    europePath.closePath();

    ctx.save();
    ctx.clip(europePath);
    ctx.fillStyle = '#15803d';
    ctx.fill(europePath);

    // Natural organic impasto blending across Europe (matching 2-20 & 2-25)
    paintSoftImpastoDab(globeX - 115, globeY - 165, 32, 20, -0.15, '#166534', '#22c55e');
    paintSoftImpastoDab(globeX - 75,  globeY - 170, 36, 22, 0.10,  '#15803d', '#4ade80');
    paintSoftImpastoDab(globeX - 35,  globeY - 155, 34, 18, -0.05, '#166534', '#84cc16');
    paintSoftImpastoDab(globeX - 80,  globeY - 138, 16, 10, 0.40,  '#4d7c0f', '#a3e635'); // Italy
    ctx.restore();

    // B. AFRICA (Sahara Desert Ochres & Congo Rainforest Greens)
    const africaPath = new Path2D();
    africaPath.moveTo(globeX - 155, globeY - 105); // Morocco
    africaPath.quadraticCurveTo(globeX - 95, globeY - 95, globeX - 35, globeY - 82); // Med coast to Egypt
    africaPath.quadraticCurveTo(globeX - 22, globeY - 55, globeX - 5, globeY - 18);  // Horn of Africa
    africaPath.quadraticCurveTo(globeX - 28, globeY + 65, globeX - 58, globeY + 145); // East coast to Cape
    africaPath.quadraticCurveTo(globeX - 95, globeY + 120, globeX - 98, globeY + 55); // Angola
    africaPath.quadraticCurveTo(globeX - 80, globeY + 18, globeX - 150, globeY + 15); // Bight of Benin to West Africa bulge
    africaPath.quadraticCurveTo(globeX - 168, globeY - 35, globeX - 155, globeY - 105); // Atlantic coast
    africaPath.closePath();

    ctx.save();
    ctx.clip(africaPath);
    // Base rich ochre fill
    ctx.fillStyle = '#b45309';
    ctx.fill(africaPath);

    // Sahara Desert: Luminous, warm golden ochre, sand, and amber sweeps (matching 2-20 & 2-25)
    paintSoftImpastoDab(globeX - 105, globeY - 78, 52, 28, 0.05,  '#d97706', '#fbbf24');
    paintSoftImpastoDab(globeX - 65,  globeY - 60, 46, 24, -0.08, '#ca8a04', '#fde047');
    paintSoftImpastoDab(globeX - 125, globeY - 55, 38, 20, 0.12,  '#b45309', '#f59e0b');
    paintSoftImpastoDab(globeX - 40,  globeY - 45, 32, 18, -0.05, '#d97706', '#fbbf24');
    paintSoftImpastoDab(globeX - 85,  globeY - 35, 42, 22, 0.08,  '#ca8a04', '#f59e0b');

    // Central & Southern Africa: Lush Congo rainforest greens and savannas
    paintSoftImpastoDab(globeX - 85, globeY + 25,  42, 26, 0.12,  '#166534', '#22c55e');
    paintSoftImpastoDab(globeX - 52, globeY + 35,  38, 22, -0.08, '#15803d', '#4ade80');
    paintSoftImpastoDab(globeX - 75, globeY + 68,  34, 20, 0.15,  '#14532d', '#16a34a');
    paintSoftImpastoDab(globeX - 50, globeY + 95,  30, 18, -0.05, '#166534', '#22c55e');
    paintSoftImpastoDab(globeX - 62, globeY + 130, 22, 14, 0.08,  '#4d7c0f', '#84cc16'); // Cape
    ctx.restore();

    // C. ARABIAN PENINSULA (Warm amber boot shape)
    const arabiaPath = new Path2D();
    arabiaPath.moveTo(globeX - 32, globeY - 78);
    arabiaPath.lineTo(globeX - 6,  globeY - 64);
    arabiaPath.lineTo(globeX - 2,  globeY - 26);
    arabiaPath.lineTo(globeX - 20, globeY - 44);
    arabiaPath.closePath();
    ctx.save();
    ctx.clip(arabiaPath);
    ctx.fillStyle = '#d97706';
    ctx.fill(arabiaPath);
    paintSoftImpastoDab(globeX - 16, globeY - 50, 16, 12, 0.3, '#b45309', '#fbbf24');
    ctx.restore();

    // D. INDIAN SUBCONTINENT (Emerald green triangular peninsula)
    const indiaPath = new Path2D();
    indiaPath.moveTo(globeX - 16, globeY - 24);
    indiaPath.lineTo(globeX - 1,  globeY - 14);
    indiaPath.lineTo(globeX - 8,  globeY + 45);
    indiaPath.closePath();
    ctx.save();
    ctx.clip(indiaPath);
    ctx.fillStyle = '#166534';
    ctx.fill(indiaPath);
    paintSoftImpastoDab(globeX - 8, globeY + 10, 12, 22, -0.1, '#15803d', '#22c55e');
    ctx.restore();

    ctx.restore(); // end continental drift

    // ==================== AUTHENTIC ORGANIC ATMOSPHERIC CLOUDS (matching 2-20 & 2-25) ====================
    ctx.save();
    ctx.translate(cloudDriftX, 0);
    // Multi-lobed, organic, fluffy oil-painted cloud wisps with soft lavender undertones
    const paintOilCloudWisp = (
      cx: number,
      cy: number,
      w: number,
      h: number,
      angle: number,
      seed: number,
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const lobes = 5;
      const lobeStep = w / (lobes + 1);

      // 1. Soft atmospheric mauve/lavender under-shadow
      ctx.fillStyle = 'rgba(196, 181, 253, 0.45)';
      for (let i = 1; i <= lobes; i++) {
        const lx = -w * 0.5 + i * lobeStep;
        const ly = 2.4 + Math.sin(i * 1.8) * (h * 0.18);
        const lr = (h * 0.55) * Math.sin((i / (lobes + 1)) * Math.PI) * (0.85 + this.brush.hash(seed + i * 7) * 0.3);
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr * 1.45, lr, 0, 0, TAU);
        ctx.fill();
      }

      // 2. Thick creamy titanium white impasto body with undulating fluffy lobes
      ctx.fillStyle = '#f8fafc';
      for (let i = 1; i <= lobes; i++) {
        const lx = -w * 0.5 + i * lobeStep;
        const ly = Math.sin(i * 1.8) * (h * 0.18);
        const lr = (h * 0.50) * Math.sin((i / (lobes + 1)) * Math.PI) * (0.85 + this.brush.hash(seed + i * 7) * 0.3);
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr * 1.35, lr, 0, 0, TAU);
        ctx.fill();
      }

      // 3. Pure titanium white crest highlights
      ctx.fillStyle = '#ffffff';
      for (let i = 1; i <= lobes; i++) {
        const lx = -w * 0.5 + i * lobeStep - 1;
        const ly = -h * 0.12 + Math.sin(i * 1.8) * (h * 0.12);
        const lr = (h * 0.35) * Math.sin((i / (lobes + 1)) * Math.PI) * (0.80 + this.brush.hash(seed + i * 11) * 0.3);
        ctx.beginPath();
        ctx.ellipse(lx, ly, lr * 1.25, lr * 0.75, 0, 0, TAU);
        ctx.fill();
      }

      // 4. Subtle wet knife streak across spine
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2, h * 0.20);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-w * 0.40, 0);
      ctx.quadraticCurveTo(0, -h * 0.08, w * 0.40, 0);
      ctx.stroke();

      ctx.restore();
    };

    // 1. Arctic Ice Cap & Polar Front Cloud Swirls
    paintOilCloudWisp(globeX - 75, globeY - 200, 95, 18, -0.15, 101);
    paintOilCloudWisp(globeX - 45, globeY - 175, 80, 16, 0.08, 102);

    // 2. Mid-Atlantic & Europe Diagonal Fronts (matching 2-25)
    paintOilCloudWisp(globeX - 150, globeY - 140, 90, 18, -0.18, 103);
    paintOilCloudWisp(globeX - 110, globeY - 110, 85, 17, -0.10, 104);

    // 3. Equatorial Atlantic Trade-Wind Cumulus Sweeps (matching 2-25)
    paintOilCloudWisp(globeX - 175, globeY - 45, 80, 15, -0.06, 105);
    paintOilCloudWisp(globeX - 145, globeY - 10, 92, 17, 0.04, 106);
    paintOilCloudWisp(globeX - 165, globeY + 25, 78, 15, 0.08, 107);

    // 4. Central Africa / ITCZ Sweeping Cloud Bands (matching 2-25)
    paintOilCloudWisp(globeX - 60, globeY + 15, 75, 16, 0.05, 108);
    paintOilCloudWisp(globeX - 55, globeY + 60, 68, 15, 0.02, 109);

    // 5. Southern Ocean Cyclonic Fronts
    paintOilCloudWisp(globeX - 150, globeY + 115, 85, 17, 0.18, 110);
    paintOilCloudWisp(globeX - 105, globeY + 165, 80, 16, 0.28, 111);

    ctx.restore(); // end cloud drift

    // 6. GORGEOUS MAUVE / LILAC / LAVENDER TERMINATOR PLUMES (matching 2-20 & 2-25)
    // Feathers gracefully along the vertical center boundary where day meets night
    const termPlumes = [
      { y: globeY - 150, h: 46, w: 24, rot: -0.10 },
      { y: globeY - 80,  h: 58, w: 28, rot: 0.05 },
      { y: globeY - 10,  h: 68, w: 30, rot: -0.05 },
      { y: globeY + 60,  h: 56, w: 26, rot: 0.08 },
      { y: globeY + 130, h: 48, w: 22, rot: -0.06 },
    ];
    for (const tp of termPlumes) {
      paintSoftImpastoDab(globeX - 4, tp.y, tp.w, tp.h * 0.5, tp.rot, 'rgba(192, 132, 252, 0.70)', 'rgba(233, 213, 255, 0.90)');
      paintSoftImpastoDab(globeX - 8, tp.y, tp.w * 0.65, tp.h * 0.35, tp.rot, 'rgba(255, 255, 255, 0.80)', '#ffffff');
    }

    // ==================== NOCTURNAL HEMISPHERE (RIGHT SIDE) ====================
    // Deep pitch-black / charcoal oil paint field (matching 2-20 & 2-25)
    ctx.fillStyle = '#060a14';
    ctx.fillRect(globeX, globeY - globeR, globeR, globeR * 2);

    // Vertical textured impasto brush striations across night hemisphere (matching 2-20 & 2-25)
    ctx.fillStyle = '#050813';
    ctx.fillRect(globeX, globeY - globeR, globeR, globeR * 2);

    for (let d = 0; d < 45; d++) {
      const u = this.brush.hash(d * 19 + 501);
      const v = this.brush.hash(d * 31 + 602);
      const nx = globeX + u * (globeR * 0.95);
      const ny = globeY - globeR * 0.90 + v * (globeR * 1.80);
      const dsq = (nx - globeX) * (nx - globeX) + (ny - globeY) * (ny - globeY);
      if (dsq < (globeR - 6) * (globeR - 6) && nx > globeX + 4) {
        ctx.fillStyle = d % 2 === 0 ? 'rgba(10, 16, 32, 0.40)' : 'rgba(2, 4, 10, 0.50)';
        ctx.beginPath();
        ctx.arc(nx, ny, 2 + this.brush.hash(d * 11) * 5, 0, TAU);
        ctx.fill();
      }
    }

    // DAY/NIGHT TWILIGHT TERMINATOR: Natural photographic day-to-night shadow curve (matching 2-20 & 2-25)
    const termGrad = ctx.createLinearGradient(globeX - 16, 0, globeX + 32, 0);
    termGrad.addColorStop(0, 'rgba(3, 7, 18, 0.0)');
    termGrad.addColorStop(0.25, 'rgba(12, 18, 34, 0.32)');
    termGrad.addColorStop(0.55, 'rgba(5, 10, 24, 0.72)');
    termGrad.addColorStop(0.85, 'rgba(2, 6, 18, 0.92)');
    termGrad.addColorStop(1, 'rgba(2, 4, 12, 0.98)');
    ctx.fillStyle = termGrad;
    ctx.fillRect(globeX - 16, globeY - globeR, 48, globeR * 2);

    // INTRICATE NETWORKS OF GOLDEN CITY LIGHTS (Europe, Nile Corridor, India, East Asia - matching 2-20 & 2-25)
    ctx.save();
    ctx.translate(continentDriftX, 0);
    // Delicate, pinpoint stipples (0.5 to 1.1px radius) tracing authentic geographic coastlines
    const cityConstellations = [
      // Western/Central Europe network
      { cx: globeX + 16,  cy: globeY - 142, count: 55, spreadX: 14, spreadY: 28, rot: 0.10 },
      // Glowing Nile River Corridor & Delta ribbon (slender, elegant vertical thread down Egypt)
      { cx: globeX + 22,  cy: globeY - 32,  count: 45, spreadX: 3.2, spreadY: 26, rot: 0.14 },
      // Eastern Europe / Mediterranean coast
      { cx: globeX + 34,  cy: globeY - 82,  count: 50, spreadX: 16, spreadY: 34, rot: -0.05 },
      // South Asia / Indian Peninsula
      { cx: globeX + 68,  cy: globeY - 16,  count: 65, spreadX: 20, spreadY: 32, rot: -0.15 },
      // Coastal China & Major River Basins
      { cx: globeX + 118, cy: globeY - 58,  count: 75, spreadX: 28, spreadY: 26, rot: 0.12 },
      // Japan Archipelago & Korea (slender curved arc of lights)
      { cx: globeX + 162, cy: globeY - 95,  count: 55, spreadX: 14, spreadY: 30, rot: 0.42 },
      // Southeast Asia / Indonesian Island Arc
      { cx: globeX + 105, cy: globeY + 35,  count: 50, spreadX: 32, spreadY: 16, rot: 0.28 },
      // Coastal Australia (Sydney, Melbourne, Brisbane)
      { cx: globeX + 152, cy: globeY + 110, count: 42, spreadX: 20, spreadY: 22, rot: 0.05 },
    ];

    for (const cc of cityConstellations) {
      ctx.save();
      ctx.translate(cc.cx, cc.cy);
      ctx.rotate(cc.rot);
      for (let i = 0; i < cc.count; i++) {
        const u = (this.brush.hash(i * 19 + cc.cx) - 0.5) * 2;
        const v = (this.brush.hash(i * 37 + cc.cy) - 0.5) * 2;
        const lx = u * cc.spreadX;
        const ly = v * cc.spreadY;
        const r = 0.55 + this.brush.hash(i * 47) * 0.85;
        const twk = 0.65 + 0.35 * Math.sin(t * 3.5 + i * 2.3 + cc.cx);

        // Soft, faint ambient aura
        ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
        ctx.beginPath();
        ctx.arc(lx, ly, r * 1.6, 0, TAU);
        ctx.fill();

        // Brilliant pinpoint starlight core
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#fef08a';
        ctx.globalAlpha = twk * act7Alpha;
        ctx.beginPath();
        ctx.arc(lx, ly, r * 0.85, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore(); // end night city constellation drift

    // Prominent Satellite / Meteor Slit Streaks in Nocturnal Hemisphere (matching 2-20 & 2-25)
    const meteorStreaks = [
      { x1: globeX + 105, y1: globeY - 125, x2: globeX + 128, y2: globeY - 88,  w: 2.8 },
      { x1: globeX + 92,  y1: globeY + 18,  x2: globeX + 110, y2: globeY + 52,  w: 2.4 },
    ];
    for (const ms of meteorStreaks) {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.40)';
      ctx.lineWidth = ms.w * 1.6;
      ctx.beginPath();
      ctx.moveTo(ms.x1, ms.y1);
      ctx.lineTo(ms.x2, ms.y2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = ms.w;
      ctx.beginPath();
      ctx.moveTo(ms.x1, ms.y1);
      ctx.lineTo(ms.x2, ms.y2);
      ctx.stroke();
    }


    ctx.restore(); // Restore Earth spherical clipping

    // ATMOSPHERIC LIMB & IMPASTO RIM (Titanium white/cyan feathered paint stroke - matching 2-20 & 2-25)
    ctx.save();
    for (let g = 0; g < 4; g++) {
      const gw = 2.5 + g * 2.8;
      const gAlpha = 0.32 - g * 0.07;
      ctx.strokeStyle = `rgba(186, 230, 253, ${gAlpha * act7Alpha})`;
      ctx.lineWidth = gw;
      ctx.beginPath();
      ctx.arc(globeX, globeY, globeR + g * 1.5, Math.PI * 0.50, -Math.PI * 0.50, false);
      ctx.stroke();
    }
    // Solid white impasto paint rim around full circumference
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.arc(globeX, globeY, globeR, 0, TAU);
    ctx.stroke();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 11. ACT VII: RETRO-FUTURISTIC MID-CENTURY SPACE ROCKET (matching 2-25)
  // ---------------------------------------------------------------------------
  public paintRocket(rktX: number, rktY: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(rktX, rktY);

    // 1. Supersonic multi-stage thrust plume
    const plumeH = 145 + Math.sin(t * 30.0) * 12;
    // Outer fiery plume
    this.brush.paintStroke(0, 24, 0, 24 + plumeH, 18, 'rgba(255, 255, 255, 0.95)', '#fef08a');
    this.brush.paintStroke(0, 24, 0, 24 + plumeH * 0.75, 12, '#f97316', '#ea580c');
    this.brush.paintStroke(0, 24, 0, 24 + plumeH * 0.45, 7, '#ffffff', '#fde047');

    // Diamond shock wave nodes
    for (let d = 1; d <= 3; d++) {
      const dy = 28 + d * 26;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, dy - 6);
      ctx.lineTo(5, dy);
      ctx.lineTo(0, dy + 6);
      ctx.lineTo(-5, dy);
      ctx.closePath();
      ctx.fill();
    }

    // Billowing smoke condensation puffs along tail
    for (let sm = 0; sm < 4; sm++) {
      const smY = 45 + sm * 28 + Math.sin(t * 12.0 + sm) * 4;
      const smR = 8 + sm * 5;
      ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
      ctx.beginPath();
      ctx.arc((sm % 2 === 0 ? -1 : 1) * 8, smY, smR, 0, TAU);
      ctx.fill();
    }

    // 2. Gimbaled rocket engine nozzle bell (inconel alloy)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-7, 18);
    ctx.lineTo(-12, 26);
    ctx.lineTo(12, 26);
    ctx.lineTo(7, 18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3. Swept stabilizing aerodynamic delta fins (3D beveled)
    // Left fin
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-11, 4);
    ctx.lineTo(-26, 26);
    ctx.lineTo(-10, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(-26, 26);
    ctx.lineTo(-10, 22);
    ctx.lineTo(-10, 25);
    ctx.closePath();
    ctx.fill();

    // Right fin
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(11, 4);
    ctx.lineTo(26, 26);
    ctx.lineTo(10, 22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(11, 4);
    ctx.lineTo(26, 26);
    ctx.lineTo(16, 12);
    ctx.closePath();
    ctx.fill();

    // 4. Cylindrical fuselage with Apollo/Saturn roll pattern
    const fusW = 22;
    const fusH = 46;

    // Main fuselage body (titanium white)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-fusW * 0.5, -fusH * 0.5 + 4, fusW, fusH);

    // Shading on right side of cylinder
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillRect(fusW * 0.15, -fusH * 0.5 + 4, fusW * 0.35, fusH);

    // Black roll pattern quadrants (matching Saturn V / Apollo aesthetic)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-fusW * 0.5, -6, fusW * 0.5, 14);
    ctx.fillRect(0, 8, fusW * 0.5, 12);

    // Interstage corrugated separation rings
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-fusW * 0.5, -7);
    ctx.lineTo(fusW * 0.5, -7);
    ctx.moveTo(-fusW * 0.5, 8);
    ctx.lineTo(fusW * 0.5, 8);
    ctx.stroke();

    // 5. Tapered ogive nosecone fairing
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-fusW * 0.5, -fusH * 0.5 + 4);
    ctx.quadraticCurveTo(-fusW * 0.45, -fusH * 0.5 - 18, 0, -fusH * 0.5 - 28);
    ctx.quadraticCurveTo(fusW * 0.45, -fusH * 0.5 - 18, fusW * 0.5, -fusH * 0.5 + 4);
    ctx.closePath();
    ctx.fill();

    // Red nosecone tip probe
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-3, -fusH * 0.5 - 20);
    ctx.lineTo(0, -fusH * 0.5 - 34);
    ctx.lineTo(3, -fusH * 0.5 - 20);
    ctx.closePath();
    ctx.fill();

    // 6. Circular cockpit / payload observation porthole
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, -12, 4.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }
}

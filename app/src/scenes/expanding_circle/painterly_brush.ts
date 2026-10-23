// PAINTERLY BRUSH & IMPASTO ENGINE (v3.0 Master Edition)
// True procedural physical oil paint simulation with dynamic bristle loading,
// wet-in-wet pigment blending, physical impasto crest relief, and organic canvas bite.

import { TAU } from '../../engine/util';

export class PainterlyBrush {
  public ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  // Deterministic pseudo-random hash for sub-frame f(t) determinism
  public hash(n: number): number {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  // ---------------------------------------------------------------------------
  // 1. DYNAMIC PHYSICAL IMPASTO OIL STROKE
  // ---------------------------------------------------------------------------
  public paintStroke(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    bodyColor: string,
    wetBlendColor?: string,
    shadowColor?: string,
    taperStart: boolean = false,
    taperEnd: boolean = false,
    seed: number = 0,
    hasSheen: boolean = true,
  ): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;

    const nx = -dy / len;
    const ny = dx / len;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = taperEnd || taperStart ? 'butt' : 'round';

    // A. Soft under-stroke contact shadow for pigment depth
    ctx.strokeStyle = shadowColor || 'rgba(25, 15, 8, 0.28)';
    ctx.lineWidth = width * 1.06;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * width * 0.08, y1 + ny * width * 0.08);
    ctx.lineTo(x2 + nx * width * 0.08, y2 + ny * width * 0.08);
    ctx.stroke();

    // B. Rich, opaque oil paint body core
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = width * 0.94;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // C. Dynamic multi-bristle striations (pigment load & brush drag)
    const bristleCount = Math.max(7, Math.min(20, Math.floor(width * 0.70)));
    for (let b = 0; b < bristleCount; b++) {
      const u = (b / (bristleCount - 1) - 0.5) * 2; // -1 to 1
      const offset = u * (width * 0.44);
      const bSeed = seed * 37 + b * 13;
      const jitter = (this.hash(bSeed) - 0.5) * (width * 0.10);

      const startMod = taperStart ? (this.hash(bSeed + 1) * 0.28) : 0;
      const endMod = taperEnd ? (this.hash(bSeed + 2) * 0.28) : 0;
      const bx1 = x1 + dx * startMod + nx * (offset + jitter);
      const by1 = y1 + dy * startMod + ny * (offset + jitter);
      const bx2 = x2 - dx * endMod + nx * (offset + jitter);
      const by2 = y2 - dy * endMod + ny * (offset + jitter);

      let bristleCol = bodyColor;
      let bristleAlpha = 0.55 + this.hash(bSeed + 3) * 0.40;

      if (u > 0.38) {
        bristleCol = shadowColor || 'rgba(30, 15, 5, 0.38)';
      } else if (u < -0.30 && wetBlendColor) {
        bristleCol = wetBlendColor;
      } else if (u < 0.12 && u > -0.28 && wetBlendColor) {
        bristleCol = wetBlendColor;
        bristleAlpha = 0.72;
      }

      ctx.strokeStyle = bristleCol;
      ctx.globalAlpha = bristleAlpha;
      ctx.lineWidth = Math.max(1.1, width * 0.14);
      ctx.beginPath();
      ctx.moveTo(bx1, by1);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
    }

    // D. Specular impasto crest sheen along upper/light-facing ridge
    if (hasSheen && width > 4) {
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(0.8, width * 0.10);
      ctx.beginPath();
      ctx.moveTo(x1 - nx * width * 0.22, y1 - ny * width * 0.22);
      ctx.lineTo(x2 - nx * width * 0.22, y2 - ny * width * 0.22);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 2. CONTINUOUS BEZIER CURVE IMPASTO STROKE (No caterpillar segmentation!)
  // ---------------------------------------------------------------------------
  public paintCurve(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    width: number,
    bodyColor: string,
    wetBlendColor?: string,
    shadowColor?: string,
    steps: number = 16,
    seed: number = 0,
    hasSheen: boolean = true,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Soft under-stroke shadow for pigment relief
    if (shadowColor) {
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = width * 1.05;
      ctx.beginPath();
      ctx.moveTo(x1 + 1.5, y1 + 2.5);
      ctx.quadraticCurveTo(cx + 1.5, cy + 2.5, x2 + 1.5, y2 + 2.5);
      ctx.stroke();
    }

    // 2. Continuous solid body stroke
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = width;
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();

    // 3. Continuous longitudinal bristle streaks (offset curves)
    const bristleCount = Math.max(3, Math.min(8, Math.floor(width * 0.4)));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    for (let b = 0; b < bristleCount; b++) {
      const u = (b / (bristleCount - 1) - 0.5) * 2;
      const offset = u * (width * 0.35);
      const bSeed = seed * 31 + b * 17;
      const jitter = (this.hash(bSeed) - 0.5) * (width * 0.08);

      const off = offset + jitter;
      ctx.strokeStyle = (u > 0.3 && shadowColor) ? shadowColor : (wetBlendColor || bodyColor);
      ctx.globalAlpha = 0.40 + this.hash(bSeed + 3) * 0.35;
      ctx.lineWidth = Math.max(1.0, width * 0.14);
      ctx.beginPath();
      ctx.moveTo(x1 + nx * off, y1 + ny * off);
      ctx.quadraticCurveTo(cx + nx * off, cy + ny * off, x2 + nx * off, y2 + ny * off);
      ctx.stroke();
    }

    // 4. Subtle crest sheen if enabled
    if (hasSheen && width > 6.0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)';
      ctx.lineWidth = Math.max(0.8, width * 0.10);
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(x1 - nx * (width * 0.15), y1 - ny * (width * 0.15));
      ctx.quadraticCurveTo(cx - nx * (width * 0.15), cy - ny * (width * 0.15), x2 - nx * (width * 0.15), y2 - ny * (width * 0.15));
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 3. STEPPED PALETTE-KNIFE IMPASTO CLOUD BANK (Horizon clouds behind village, matching 2-3)
  // ---------------------------------------------------------------------------
  public paintSteppedCloud(
    cx: number,
    cy: number,
    width: number,
    tiers: number = 8,
    drift: number = 0,
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    // Taller tiers so clouds tower majestically 200-350px tall (matching 2-3)
    const tierH = 22;
    ctx.save();
    ctx.translate(drift, 0);

    // Upright Stepped Mountain Terraces: WIDE at ground base, stepping NARROWER to sky peak (matching 2-1 & 2-3)
    for (let k = 0; k < tiers; k++) {
      const u = k / tiers;
      // Wide base at bottom (k=0), tapering inward toward top (k=tiers-1)
      const w = width * (1.0 - u * 0.58) + (this.hash(seed * 19 + k * 7) - 0.5) * (width * 0.06);
      const y = cy - k * tierH;
      const x1 = cx - w * 0.5;
      const x2 = cx + w * 0.5;

      // Soft lilac/periwinkle under-shadow slab with feathered edges (matching 2-3)
      const shadowH = tierH * 1.15;
      this.paintPaletteKnifeSlab(
        x1 + 4,
        y + 6,
        x2 - 4,
        y + 6,
        shadowH,
        'rgba(180, 168, 205, 0.45)', // Authentic soft lilac shadow matching 2-3
        undefined,
        seed + k * 13,
      );

      // Creamy titanium-white impasto body slab with horizontal palette knife drag
      const bodyH = tierH * 1.25;
      this.paintPaletteKnifeSlab(
        x1,
        y,
        x2,
        y,
        bodyH,
        '#ffffff',
        '#f5f0f8',
        seed + k * 23,
      );

      // Heavy impasto crest along top ridge
      this.paintStroke(
        x1 + 6,
        y - bodyH * 0.35,
        x2 - 6,
        y - bodyH * 0.35,
        4.5,
        '#ffffff',
        '#fdfaff',
        'rgba(215, 205, 230, 0.35)',
        true,
        true,
        seed + k * 37,
        true,
      );
    }
    ctx.restore();
  }

  // Authentic organic palette-knife impasto cloud floating in the sky (matching 2-3, 2-4, 2-6, 2-10)
  public paintSkyCloud(
    cx: number,
    cy: number,
    width: number,
    height: number = 22,
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    ctx.save();

    const rot = (this.hash(seed * 19) - 0.5) * 0.08;
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // 1. Soft lilac/periwinkle under-shadow impasto base (matching 2-4 & 2-6)
    ctx.fillStyle = 'rgba(185, 175, 205, 0.45)';
    ctx.beginPath();
    ctx.ellipse(2, height * 0.25, width * 0.46, height * 0.40, 0, 0, TAU);
    ctx.fill();

    // 2. Multi-lobed thick titanium white impasto cloud body
    const lobes = [
      { ox: -width * 0.28, oy: height * 0.05, rx: width * 0.26, ry: height * 0.42 },
      { ox: 0,             oy: -height * 0.12, rx: width * 0.32, ry: height * 0.50 },
      { ox: width * 0.26,  oy: height * 0.08, rx: width * 0.24, ry: height * 0.38 },
    ];

    ctx.fillStyle = '#ffffff';
    for (const lb of lobes) {
      ctx.beginPath();
      ctx.ellipse(lb.ox, lb.oy, lb.rx, lb.ry, 0, 0, TAU);
      ctx.fill();
    }

    // 3. Thick horizontal palette-knife impasto striations across the cloud surface
    const striations = Math.max(3, Math.floor(height / 6));
    for (let s = 0; s < striations; s++) {
      const u = s / (striations - 1);
      const sy = -height * 0.30 + u * (height * 0.60);
      const sw = width * (0.85 - Math.abs(u - 0.5) * 0.35);
      const sSeed = seed * 43 + s * 17;
      const jx = (this.hash(sSeed) - 0.5) * 8;

      ctx.strokeStyle = s === 0 ? '#ffffff' : s === 1 ? '#f8f4fc' : 'rgba(235, 225, 245, 0.65)';
      ctx.lineWidth = Math.max(2.2, height * 0.18);
      ctx.beginPath();
      ctx.moveTo(-sw * 0.46 + jx, sy);
      ctx.lineTo(sw * 0.46 + jx, sy);
      ctx.stroke();
    }

    // 4. Heavy white knife crest ridge along top edge
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-width * 0.32, -height * 0.25);
    ctx.quadraticCurveTo(0, -height * 0.42, width * 0.28, -height * 0.22);
    ctx.stroke();

    ctx.restore();
  }

  // Horizontal palette knife stroke with broken edges and paint build-up
  public paintPaletteKnifeSlab(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    height: number,
    fillColor: string,
    edgeColor?: string,
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const halfH = height * 0.5;
    const steps = Math.max(6, Math.floor(len / 12));

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.beginPath();

    // Top edge with subtle knife chatter
    ctx.moveTo(x1, y1 - halfH);
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const sx = x1 + dx * u;
      const chatter = (this.hash(seed * 43 + s * 11) - 0.5) * (height * 0.15);
      const sy = y1 + dy * u - halfH + chatter;
      ctx.lineTo(sx, sy);
    }

    // Right natural rounded knife end
    const rR = halfH * (0.80 + (this.hash(seed * 59) - 0.5) * 0.2);
    ctx.arcTo(x2 + rR, y2 - halfH * 0.2, x2 + rR * 0.5, y2 + halfH, rR);
    ctx.lineTo(x2, y2 + halfH);

    // Bottom edge with paint drag texture
    for (let s = steps - 1; s >= 0; s--) {
      const u = s / steps;
      const sx = x1 + dx * u;
      const chatter = (this.hash(seed * 71 + s * 17) - 0.5) * (height * 0.15);
      const sy = y1 + dy * u + halfH + chatter;
      ctx.lineTo(sx, sy);
    }

    // Left natural rounded chisel start
    ctx.arcTo(x1 - halfH * 0.6, y1 + halfH * 0.2, x1, y1 - halfH, halfH * 0.5);
    ctx.lineTo(x1, y1 - halfH);
    ctx.closePath();
    ctx.fill();

    if (edgeColor) {
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = Math.max(1.0, height * 0.12);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. VOLUMETRIC CAMPFIRE WITH RUGGED HEARTH & POINTED OIL FLAMES (matching 2-0)
  // ---------------------------------------------------------------------------
  public paintCampfire(
    baseX: number,
    baseY: number,
    scale: number,
    time: number,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    // River stone charcoal hearth ring: chunky irregular flat stones (matching 2-0)
    const stones = [
      { x: -36, y: 4, w: 18, h: 10, rot: -0.1 },
      { x: -24, y: 8, w: 20, h: 11, rot: 0.05 },
      { x: -8, y: 10, w: 22, h: 12, rot: -0.05 },
      { x: 10, y: 9, w: 21, h: 11, rot: 0.1 },
      { x: 26, y: 6, w: 19, h: 10, rot: -0.08 },
      { x: 36, y: 2, w: 17, h: 9, rot: 0.15 },
      { x: -28, y: -4, w: 16, h: 9, rot: -0.2 },
      { x: 28, y: -4, w: 16, h: 9, rot: 0.2 },
      { x: -12, y: -6, w: 18, h: 9, rot: 0.0 },
      { x: 12, y: -6, w: 18, h: 9, rot: 0.0 },
    ];

    for (const st of stones) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.rot);
      // Rough palette-knife charcoal stone
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(0, 0, st.w * 0.5, st.h * 0.5, 0, 0, TAU);
      ctx.fill();
      // Stone top ash highlight
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.ellipse(-1, -2, st.w * 0.35, st.h * 0.30, 0, 0, TAU);
      ctx.fill();
      // Dark under-shadow
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, st.w * 0.5, st.h * 0.5, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // Glowing ember bed in center
    const emberGrad = ctx.createRadialGradient(0, 2, 2, 0, 2, 28);
    emberGrad.addColorStop(0, '#fef08a');
    emberGrad.addColorStop(0.35, '#ea580c');
    emberGrad.addColorStop(0.75, '#991b1b');
    emberGrad.addColorStop(1, 'rgba(69, 10, 10, 0)');
    ctx.fillStyle = emberGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, 32, 12, 0, 0, TAU);
    ctx.fill();

    // Charred crossed logs in fire pit
    this.paintStroke(-26, 6, 26, -4, 10, '#1c1917', '#44403c', '#09090b');
    this.paintStroke(-24, -4, 24, 6, 10, '#1c1917', '#44403c', '#09090b');

    // POINTED OIL BRUSH FLAME TONGUES (matching 2-0 screenshot.png)
    // In 2-0, flames are sharp, fierce pointed impasto brush pulls flicking upwards!
    const flameTongues = [
      // Outer scarlet/crimson tongues
      { bx: -18, bw: 16, h: 78, tipX: -8, col: '#991b1b', spd: 4.5 },
      { bx: 16, bw: 16, h: 84, tipX: 6, col: '#991b1b', spd: 4.2 },
      { bx: -24, bw: 12, h: 52, tipX: -18, col: '#b91c1c', spd: 5.0 },
      { bx: 22, bw: 12, h: 56, tipX: 18, col: '#b91c1c', spd: 4.8 },
      // Mid cadmium vermilion / orange tongues
      { bx: -10, bw: 18, h: 96, tipX: -2, col: '#ea580c', spd: 4.6 },
      { bx: 8, bw: 18, h: 92, tipX: 2, col: '#ea580c', spd: 5.1 },
      { bx: -2, bw: 16, h: 110, tipX: 0, col: '#f97316', spd: 5.5 },
      // Intense bright lemon yellow / white core tongues
      { bx: -6, bw: 12, h: 72, tipX: -1, col: '#fef08a', spd: 6.0 },
      { bx: 4, bw: 12, h: 68, tipX: 1, col: '#fef08a', spd: 6.2 },
      { bx: 0, bw: 8, h: 54, tipX: 0, col: '#ffffff', spd: 7.0 },
    ];

    for (let f = 0; f < flameTongues.length; f++) {
      const fl = flameTongues[f];
      const flutter = Math.sin(time * fl.spd + f * 1.5) * 4.5;
      const flutterH = Math.sin(time * (fl.spd * 1.3) + f) * 8;
      const tx = fl.tipX + flutter;
      const ty = -fl.h - flutterH;

      ctx.fillStyle = fl.col;
      ctx.beginPath();
      ctx.moveTo(fl.bx - fl.bw * 0.5, 4);
      // Left flame curve
      ctx.quadraticCurveTo(fl.bx - fl.bw * 0.35, ty * 0.45, tx, ty);
      // Right flame curve
      ctx.quadraticCurveTo(fl.bx + fl.bw * 0.35, ty * 0.45, fl.bx + fl.bw * 0.5, 4);
      ctx.closePath();
      ctx.fill();

      // Sharp central impasto spine
      ctx.strokeStyle = fl.col === '#ffffff' ? '#ffffff' : '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(fl.bx, 2);
      ctx.quadraticCurveTo((fl.bx + tx) * 0.5, ty * 0.5, tx, ty);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Ascending buoyant glowing ember sparks dancing in updraft
    for (let sp = 0; sp < 14; sp++) {
      const spProg = ((time * 1.8 + sp * 0.17) % 1.0);
      const spX = (Math.sin(sp * 31.0 + time * 3.0) * 18) * (1.0 + spProg);
      const spY = -10 - spProg * 160;
      const spR = 1.2 + (sp % 3) * 0.8;
      const spAlpha = Math.sin(spProg * Math.PI) * 0.85;
      ctx.fillStyle = sp % 2 === 0 ? `rgba(254, 240, 138, ${spAlpha})` : `rgba(249, 115, 22, ${spAlpha})`;
      ctx.beginPath();
      ctx.arc(spX, spY, spR, 0, TAU);
      ctx.fill();
    }

    // DELICATE UNDULATING LAVENDER SMOKE WISPS (matching 2-0 screenshot.png)
    // 4 delicate wisps of lavender/violet paint drifting gently upwards
    ctx.save();
    for (let sm = 0; sm < 4; sm++) {
      const smPhase = time * 2.2 + sm * 1.8;
      const xOffset = (sm - 1.5) * 8;
      const smYTop = -240 - sm * 35;

      ctx.strokeStyle = sm % 2 === 1 ? 'rgba(196, 181, 253, 0.45)' : 'rgba(221, 214, 254, 0.35)';
      ctx.lineWidth = 3.2 - sm * 0.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xOffset, -100);
      const c1x = xOffset + Math.sin(smPhase) * 14;
      const c1y = -140;
      const c2x = xOffset + Math.cos(smPhase * 0.8) * 20;
      const c2y = -185;
      const ex = xOffset + Math.sin(smPhase * 1.1) * 25;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, smYTop);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. AUTHENTIC PREHISTORIC NEGATIVE HAND STENCIL (Chauvet & Lascaux)
  // ---------------------------------------------------------------------------
  public paintCaveHandStencil(
    cx: number,
    cy: number,
    scale: number,
    rot: number,
    alpha: number = 1.0,
    seed: number = 1,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    // Anatomical hand silhouette points for negative cutout (wrist, thumb, 4 fingers)
    const handPoly: [number, number][] = [
      [-14, 45],  // wrist left
      [-18, 20],  // thumb base
      [-36, 12],  // thumb joint
      [-48, -4],  // thumb tip
      [-38, -12], // thumb inner
      [-22, 2],   // index cleft
      [-24, -28], // index joint
      [-22, -48], // index tip
      [-12, -48], // index right
      [-10, -22], // middle cleft
      [-10, -36], // middle joint
      [-4, -58],  // middle tip (longest)
      [4, -58],   // middle right
      [6, -26],   // ring cleft
      [9, -32],   // ring joint
      [14, -50],  // ring tip
      [22, -48],  // ring right
      [20, -20],  // pinky cleft
      [26, -24],  // pinky joint
      [32, -36],  // pinky tip
      [38, -32],  // pinky outer
      [28, 12],   // outer palm
      [22, 45],   // wrist right
    ];

    // Helper: test if point is inside hand polygon
    const isInsideHand = (px: number, py: number): boolean => {
      let inside = false;
      for (let i = 0, j = handPoly.length - 1; i < handPoly.length; j = i++) {
        const xi = handPoly[i][0];
        const yi = handPoly[i][1];
        const xj = handPoly[j][0];
        const yj = handPoly[j][1];
        const intersect =
          yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    // Calculate distance to nearest polygon edge segment for authentic uniform aerosol halo
    const distToHandPerimeter = (px: number, py: number): number => {
      let minDist = 9999;
      for (let i = 0; i < handPoly.length; i++) {
        const j = (i + 1) % handPoly.length;
        const x1 = handPoly[i][0], y1 = handPoly[i][1];
        const x2 = handPoly[j][0], y2 = handPoly[j][1];
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const d = Math.hypot(px - projX, py - projY);
        if (d < minDist) minDist = d;
      }
      return minDist;
    };

    // Authentic Prehistoric Blown-Pigment Aerosol Cloud (Cueva de las Manos technique)
    // 4800 micro-droplets distributed in a 2D bounding field with exponential distance falloff
    const totalDrops = 4800;
    const minX = -65, maxX = 55;
    const minY = -75, maxY = 55;

    for (let d = 0; d < totalDrops; d++) {
      const dSeed = seed * 8000 + d * 13;
      const rx = minX + this.hash(dSeed * 17) * (maxX - minX);
      const ry = minY + this.hash(dSeed * 29) * (maxY - minY);

      if (isInsideHand(rx, ry)) continue;

      const dist = distToHandPerimeter(rx, ry);
      if (dist > 38) continue;

      // Exponential density falloff from perimeter: highest density within 0-16px
      const keepProb = Math.exp(-dist / 12.0);
      if (this.hash(dSeed * 37) > keepProb) continue;

      const dotAlpha = (0.35 + 0.65 * (1.0 - dist / 38.0)) * alpha;
      const sizeRand = this.hash(dSeed * 47);
      const dotR = sizeRand < 0.70 ? (0.9 + sizeRand * 1.6) : (1.8 + (sizeRand - 0.70) * 3.2);

      const colChoice = this.hash(dSeed * 53);
      if (colChoice < 0.65) {
        ctx.fillStyle = `rgba(175, 42, 18, ${dotAlpha})`; // Deep Red Ochre / Iron Oxide
      } else if (colChoice < 0.88) {
        ctx.fillStyle = `rgba(195, 60, 24, ${dotAlpha})`; // Warm Terracotta Pigment
      } else {
        ctx.fillStyle = `rgba(120, 32, 16, ${dotAlpha})`;  // Raw Burnt Umber
      }

      ctx.beginPath();
      ctx.arc(rx, ry, dotR, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5.5 STEPPED IMPASTO CLOUD TERRACES (matching 2-1 & 2-3)
  // ---------------------------------------------------------------------------
  public paintSteppedCloudTerrace(
    cx: number,
    cy: number,
    baseW: number,
    totalH: number,
    tiers: number = 5,
    seed: number = 0,
    opacity: number = 1.0,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = opacity;

    const tierH = totalH / tiers;
    for (let t = 0; t < tiers; t++) {
      // Step inward from bottom to top (like a palette-knife ziggurat)
      const u = t / (tiers - 1);
      const tierW = baseW * (1.0 - u * 0.62) + (this.hash(seed * 19 + t * 7) - 0.5) * (baseW * 0.08);
      const tierY = cy + (totalH * 0.5) - (t + 0.5) * tierH;

      const x1 = cx - tierW * 0.5;
      const x2 = cx + tierW * 0.5;

      // 1. Soft lilac/lavender under-shadow for each impasto slab
      this.paintStroke(
        x1 + 3, tierY + 2.5,
        x2 + 3, tierY + 2.5,
        tierH * 1.05,
        'rgba(216, 180, 254, 0.40)', // Lilac shadow
        undefined,
        undefined,
        true,
        true,
        seed + t * 13,
        false,
      );

      // 2. Pure titanium white impasto slab with horizontal knife drag
      this.paintStroke(
        x1, tierY,
        x2, tierY,
        tierH * 0.92,
        '#ffffff',
        '#f8fafc',
        '#ede9fe',
        true,
        true,
        seed + t * 17,
        true,
      );
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 6. STACKED TIMBER CUT LOGS WITH BARK IMPASTO (matching 2-0 screenshot.png)
  // ---------------------------------------------------------------------------
  public paintStackedLogs(baseX: number, baseY: number, scale: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    // Two massive weathered horizontal split timber slabs (matching 2-0)
    const logs = [
      { y: 0, h: 48, w: 175, seed: 1 },
      { y: -44, h: 42, w: 165, seed: 2 },
    ];

    for (const log of logs) {
      const topY = log.y - log.h;
      const botY = log.y;
      const rx = log.w;

      ctx.save();
      // 1. Dark under-shadow between logs / ground
      ctx.fillStyle = 'rgba(25, 15, 8, 0.45)';
      ctx.fillRect(-20, botY - 3, rx + 24, 6);

      // 2. Weathered log body (warm umber/brown gradient)
      const grad = ctx.createLinearGradient(0, topY, 0, botY);
      grad.addColorStop(0, '#5a3a22');
      grad.addColorStop(0.20, '#8c6239');
      grad.addColorStop(0.50, '#734e2c');
      grad.addColorStop(0.85, '#54361e');
      grad.addColorStop(1, '#3b2210');
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.moveTo(-20, topY);
      ctx.lineTo(rx - 12, topY);
      ctx.lineTo(rx - 12, botY);
      ctx.lineTo(-20, botY);
      ctx.closePath();
      ctx.fill();

      // 3. Horizontal bark striations & wood grain knife drags
      const strata = ['#3b2210', '#634224', '#8c6239', '#a37548', '#2b180a'];
      for (let s = 0; s < 7; s++) {
        const sy = topY + (s / 6) * log.h;
        ctx.strokeStyle = strata[s % strata.length];
        ctx.lineWidth = 2.5 + (s % 3) * 1.5;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(-20, sy);
        ctx.lineTo(rx - 12, sy);
        ctx.stroke();
      }

      // 4. Highlight crest on top bark ridge
      ctx.strokeStyle = 'rgba(215, 185, 150, 0.40)';
      ctx.lineWidth = 2.0;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-20, topY + 2);
      ctx.lineTo(rx - 14, topY + 2);
      ctx.stroke();

      // 5. Cross-section cut end on the right with growth rings (matching 2-0)
      const endCx = rx - 10;
      const endCy = (topY + botY) * 0.5;
      const endR = log.h * 0.48;
      ctx.fillStyle = '#b88960';
      ctx.beginPath();
      ctx.ellipse(endCx, endCy, endR * 0.42, endR, 0, 0, TAU);
      ctx.fill();

      // Concentric growth rings
      ctx.strokeStyle = '#5a381e';
      ctx.lineWidth = 1.2;
      for (let r = 0.28; r <= 0.88; r += 0.28) {
        ctx.beginPath();
        ctx.ellipse(endCx, endCy, endR * 0.42 * r, endR * r, 0, 0, TAU);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 7. MULTI-LAYERED CHURNING OCEAN SURFACE WITH SEAFOAM CRESTS
  // ---------------------------------------------------------------------------
  public paintOceanWaves(
    x: number,
    y: number,
    width: number,
    height: number,
    waveRows: number = 6,
    time: number = 0,
    seed: number = 10,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    const rowH = height / waveRows;

    for (let r = 0; r < waveRows; r++) {
      const ry = y + r * rowH;
      const phase = time * 2.0 + r * 1.5;
      const rowColor = r % 2 === 0 ? '#1d4ed8' : '#1e40af';
      const blendColor = r % 2 === 0 ? '#2563eb' : '#172554';

      // Heavy horizontal impasto wave stroke
      this.paintStroke(
        x,
        ry,
        x + width,
        ry,
        rowH * 1.3,
        rowColor,
        blendColor,
        '#0f172a',
        false,
        false,
        seed + r,
        true,
      );

      // Churning white sea-foam crest along top of wave
      const crestSegs = 12;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
      ctx.lineWidth = Math.max(1.8, rowH * 0.22);
      ctx.beginPath();
      for (let s = 0; s <= crestSegs; s++) {
        const u = s / crestSegs;
        const wx = x + u * width;
        const wy = ry - rowH * 0.35 + Math.sin(phase + u * 12) * (rowH * 0.18);
        if (s === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 8. TACTILE PHYSICAL OIL IMPASTO ARC WITH BRISTLE STRIATIONS & JAGGED TIPS
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 8. TACTILE PHYSICAL OIL IMPASTO ARC (Fiery Compass Ring, matching 2-25)
  // ---------------------------------------------------------------------------
  public paintImpastoArc(
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    strokeWidth: number,
    bodyColor: string,
    highlightColor: string = '#fde047',
    shadowColor: string = '#7c2d12',
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    const sweep = endAngle - startAngle;
    if (Math.abs(sweep) < 0.005) return;

    const arcLen = radius * Math.abs(sweep);
    const steps = Math.max(24, Math.floor(arcLen / 5));

    ctx.save();

    // 1. Burnt umber / deep crimson contact shadow ribbon under the stroke
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = strokeWidth * 1.18;
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const ang = startAngle + u * sweep;
      const jitter = (this.hash(seed * 31 + s * 7) - 0.5) * (strokeWidth * 0.08);
      const r = radius + strokeWidth * 0.12 + jitter;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 2. Thick, juicy cadmium vermilion / orange impasto body core
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = strokeWidth * 0.95;
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const ang = startAngle + u * sweep;
      const wMod = 1.0 + Math.sin(u * 14 + seed) * 0.09;
      const jitter = (this.hash(seed * 47 + s * 11) - 0.5) * (strokeWidth * 0.06);
      const r = radius + jitter;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 3. Dense Hog-Bristle Pigment Filaments (multiple dragging passes)
    const bristleCount = 14;
    for (let b = 0; b < bristleCount; b++) {
      const bFrac = (b / (bristleCount - 1) - 0.5) * 2; // -1 to +1
      const bRadOffset = bFrac * (strokeWidth * 0.40);
      const bWidth = Math.max(1.8, (strokeWidth / bristleCount) * 1.5);

      let bColor = bodyColor;
      let bAlpha = 0.82;
      if (bFrac > -0.06 && bFrac < 0.10) {
        // Fine peach/cream dry-brush bristle highlight (subtle natural sheen)
        bColor = highlightColor;
        bAlpha = 0.50;
      } else if (bFrac < -0.35) {
        // Shadow inner edge
        bColor = shadowColor;
        bAlpha = 0.85;
      } else if (bFrac > 0.40) {
        // Outer vermilion edge
        bColor = bodyColor;
        bAlpha = 0.88;
      }

      ctx.strokeStyle = bColor;
      ctx.lineWidth = bWidth;
      ctx.globalAlpha = bAlpha;

      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const ang = startAngle + u * sweep;
        // Organic hand-drag tremor
        const tremor = Math.sin(u * 24 + b * 2.8 + seed) * (strokeWidth * 0.05) +
                       (this.hash(seed * 71 + b * 19 + s) - 0.5) * 1.5;
        const r = radius + bRadOffset + tremor;
        const px = cx + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;

        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // 4. Subtle Impasto Ridge Crest Sheen along inner arc curve
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(1.2, strokeWidth * 0.10);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let s = 2; s <= steps - 2; s++) {
      const u = s / steps;
      const ang = startAngle + u * sweep;
      const r = radius - strokeWidth * 0.22 + Math.sin(u * 18 + seed) * 1.2;
      const px = cx + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      if (s === 2) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 5. Authentic Splayed Dry-Brush Bristle Tapers at both open terminals (matching 2-25)
    const capEnds = [
      { ang: startAngle, dir: -Math.sign(sweep) },
      { ang: endAngle, dir: Math.sign(sweep) },
    ];
    for (const cap of capEnds) {
      const numFibers = 16;
      for (let f = 0; f < numFibers; f++) {
        const fFrac = (f / (numFibers - 1) - 0.5) * 2;
        const fRad = radius + fFrac * (strokeWidth * 0.48);
        const fLen = 14 + this.hash(f * 29 + seed * 13) * 28;
        const splayAng = (this.hash(f * 37 + seed * 17) - 0.5) * 0.22;

        const basePx = cx + Math.cos(cap.ang) * fRad;
        const basePy = cy + Math.sin(cap.ang) * fRad;

        const baseTangAng = cap.ang + (cap.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + splayAng;
        const tx = Math.cos(baseTangAng);
        const ty = Math.sin(baseTangAng);

        const colChoice = this.hash(f * 43 + seed);
        ctx.strokeStyle = colChoice < 0.45 ? highlightColor : colChoice < 0.80 ? bodyColor : shadowColor;
        ctx.lineWidth = Math.max(1.2, strokeWidth * 0.08);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(basePx, basePy);
        ctx.lineTo(basePx + tx * fLen, basePy + ty * fLen);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}


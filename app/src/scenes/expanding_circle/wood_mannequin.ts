// WOOD MANNEQUIN & FOLK FIGURATIVE CRAFT ENGINE (v3.0 Master Edition)
// Procedural hand-carved wooden folk mannequins with authentic wood grain,
// rich draped impasto fabric tunics, sculpted hair tresses, and loving family anatomy.

import { TAU } from '../../engine/util';
import { PainterlyBrush } from './painterly_brush';

export class WoodMannequin {
  public ctx: CanvasRenderingContext2D;
  public brush: PainterlyBrush;

  constructor(ctx: CanvasRenderingContext2D, brush: PainterlyBrush) {
    this.ctx = ctx;
    this.brush = brush;
  }

  // ---------------------------------------------------------------------------
  // 1. FOLK-CARVED WOODEN LIMB (Pencil/Log Peg with Woodgrain & Shading)
  // ---------------------------------------------------------------------------
  public paintLimb(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;

    const angle = Math.atan2(dy, dx);
    const r = width * 0.5;

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    // 1. Solid warm carved timber body
    ctx.fillStyle = '#8c552e';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(len, -r * 0.85);
    ctx.arc(len, 0, r * 0.85, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, r * 0.95);
    ctx.arc(0, 0, r * 0.95, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // 2. Longitudinal woodgrain brushstrokes along limb length (matching 1-57)
    const grains = [
      { off: -r * 0.55, col: '#5a3319', w: r * 0.35, alpha: 0.65 },
      { off: -r * 0.15, col: '#c48b57', w: r * 0.40, alpha: 0.75 },
      { off: r * 0.25,  col: '#e0ad7b', w: r * 0.30, alpha: 0.60 },
      { off: r * 0.55,  col: '#45230e', w: r * 0.35, alpha: 0.70 },
    ];
    for (const g of grains) {
      ctx.strokeStyle = g.col;
      ctx.lineWidth = Math.max(1.2, g.w);
      ctx.globalAlpha = g.alpha;
      ctx.beginPath();
      ctx.moveTo(r * 0.4, g.off);
      ctx.lineTo(len - r * 0.4, g.off);
      ctx.stroke();
    }

    // 3. Specular crest sheen along upper limb ridge
    ctx.strokeStyle = 'rgba(255, 245, 230, 0.40)';
    ctx.lineWidth = Math.max(0.9, r * 0.22);
    ctx.globalAlpha = 0.50;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.35);
    ctx.lineTo(len - r * 0.5, -r * 0.35);
    ctx.stroke();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 2. HAND-CARVED WOODEN HEAD WITH RICH SCULPTED OIL HAIR
  // ---------------------------------------------------------------------------
  public paintHead(
    x: number,
    y: number,
    radiusW: number,
    radiusH: number,
    hairStyle: 'father' | 'mother' | 'child' | 'villager',
    hairColor: string = '#140d08',
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    // 1. Carved wooden ovoid base
    ctx.fillStyle = '#8c552e';
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusW, radiusH, 0, 0, TAU);
    ctx.fill();

    // 2. Vertical woodgrain hog-bristle brushstrokes across face (matching 1-57)
    const faceGrains = [
      { u: -0.65, col: '#5a3319', w: 3.2, alpha: 0.65 },
      { u: -0.35, col: '#ab7243', w: 4.5, alpha: 0.85 },
      { u: -0.05, col: '#c78f5d', w: 5.0, alpha: 0.90 },
      { u: 0.25,  col: '#dca472', w: 4.2, alpha: 0.80 },
      { u: 0.55,  col: '#703e1a', w: 3.5, alpha: 0.70 },
      { u: 0.75,  col: '#45230e', w: 2.8, alpha: 0.60 },
    ];
    for (const fg of faceGrains) {
      const gx = fg.u * radiusW;
      const gh = Math.sqrt(Math.max(0, 1 - fg.u * fg.u)) * radiusH * 0.92;
      ctx.strokeStyle = fg.col;
      ctx.lineWidth = fg.w;
      ctx.globalAlpha = fg.alpha;
      ctx.beginPath();
      ctx.moveTo(gx, -gh);
      ctx.lineTo(gx, gh);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Contour shadow around lower jaw
    ctx.strokeStyle = '#422511';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusW, radiusH, 0, 0, Math.PI);
    ctx.stroke();

    // Sculpted Impasto Hair Styles (matching 1-57 and 2-0)
    if (hairStyle === 'father') {
      // Swept dark pompadour cap hugging cranium
      this.brush.paintCurve(
        -radiusW * 1.15, -radiusH * 0.25,
        radiusW * 1.15, -radiusH * 0.25,
        0, -radiusH * 1.70,
        radiusH * 0.75,
        hairColor,
        '#352216',
        '#080503',
        12,
        1,
      );
      this.brush.paintStroke(-radiusW * 0.85, -radiusH * 0.20, -radiusW * 0.55, radiusH * 0.40, 9, hairColor);
      this.brush.paintStroke(radiusW * 0.85, -radiusH * 0.20, radiusW * 0.55, radiusH * 0.40, 9, hairColor);
    } else if (hairStyle === 'mother') {
      // Natural sculpted raven-black hair cap covering crown and cranium (matching 1-57 & 2-0)
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.ellipse(0, -radiusH * 0.35, radiusW * 1.08, radiusH * 0.75, 0, Math.PI, TAU);
      ctx.fill();

      // Fluid brushstrokes across crown
      this.brush.paintStroke(-radiusW * 0.95, -radiusH * 0.40, radiusW * 0.95, -radiusH * 0.40, 10, hairColor, '#26160d');

      // Volumetric dark hair tress cascading gracefully over left shoulder down past chest (matching 1-57 & 2-0)
      this.brush.paintCurve(
        -radiusW * 0.75, -radiusH * 0.15,
        -radiusW * 0.95, radiusH * 4.20,
        -radiusW * 1.35, radiusH * 2.00,
        14.0,
        hairColor,
        '#2e1d13',
        '#050302',
        10,
        3,
        true,
      );
      this.brush.paintCurve(
        -radiusW * 0.55, -radiusH * 0.05,
        -radiusW * 0.75, radiusH * 3.80,
        -radiusW * 1.15, radiusH * 1.80,
        10.0,
        '#26160d',
        hairColor,
        '#080503',
        10,
        4,
        true,
      );
    } else if (hairStyle === 'child') {
      // Neat dark hair cap
      this.brush.paintCurve(
        -radiusW * 1.10, -radiusH * 0.20,
        radiusW * 1.10, -radiusH * 0.20,
        0, -radiusH * 1.55,
        radiusH * 0.70,
        hairColor,
        '#352216',
        '#080503',
        10,
        5,
      );
    } else {
      // Villager cap/hair
      this.brush.paintCurve(
        -radiusW * 1.05, -radiusH * 0.20,
        radiusW * 1.05, -radiusH * 0.20,
        0, -radiusH * 1.50,
        radiusH * 0.65,
        hairColor,
        '#3a281a',
        '#0d0805',
        10,
        6,
      );
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 3. ORGANIC DRAPED FABRIC TUNIC (No clipped trapezoids!)
  // ---------------------------------------------------------------------------
  public paintDrapedTunic(
    topX: number,
    topY: number,
    widthTop: number,
    widthBottom: number,
    length: number,
    baseColor: string,
    foldColor: string,
    highlightColor: string,
    beltYOffset: number,
    beltColor: string = '#1c1917',
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    const botY = topY + length;

    ctx.save();

    // 1. Organic body fill with flared, curved hem
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(topX - widthTop * 0.5, topY);
    ctx.lineTo(topX + widthTop * 0.5, topY);
    ctx.quadraticCurveTo(
      topX + widthBottom * 0.55,
      topY + length * 0.5,
      topX + widthBottom * 0.5,
      botY,
    );
    // Scalloped / wavy hemline brush edge
    ctx.quadraticCurveTo(topX, botY + 8, topX - widthBottom * 0.5, botY);
    ctx.quadraticCurveTo(
      topX - widthBottom * 0.55,
      topY + length * 0.5,
      topX - widthTop * 0.5,
      topY,
    );
    ctx.closePath();
    ctx.fill();

    // 2. Multi-layered organic impasto fabric fold shadows and subtle crests
    const foldSpecs = [
      { u: 0.12, w: 3.5, shift: -1.0 },
      { u: 0.28, w: 4.0, shift: 0.5 },
      { u: 0.44, w: 4.5, shift: 1.5 },
      { u: 0.60, w: 4.0, shift: -0.5 },
      { u: 0.76, w: 3.8, shift: 1.0 },
      { u: 0.88, w: 3.2, shift: -0.5 },
    ];

    for (let f = 0; f < foldSpecs.length; f++) {
      const spec = foldSpecs[f];
      const fx1 = topX - widthTop * 0.45 + spec.u * (widthTop * 0.90);
      const fx2 = topX - widthBottom * 0.48 + spec.u * (widthBottom * 0.96) + spec.shift;

      // Dark fold valley shadow
      this.brush.paintCurve(
        fx1,
        topY + 2,
        fx2,
        botY - 2,
        (fx1 + fx2) * 0.5 + spec.shift * 1.5,
        topY + length * 0.52,
        spec.w,
        foldColor,
        foldColor,
        'rgba(20, 10, 5, 0.45)',
        10,
        seed + f * 19,
        false,
      );

      // Subtle fold ridge highlight immediately adjacent
      this.brush.paintCurve(
        fx1 + 2.0,
        topY + 3,
        fx2 + 2.5,
        botY - 4,
        (fx1 + fx2) * 0.5 + spec.shift * 1.5 + 2.0,
        topY + length * 0.52,
        spec.w * 0.65,
        highlightColor,
        baseColor,
        undefined,
        8,
        seed + f * 19 + 7,
        true,
      );
    }

    // 3. Under-hem shadow for depth
    this.brush.paintStroke(
      topX - widthBottom * 0.5,
      botY + 4,
      topX + widthBottom * 0.5,
      botY + 4,
      6.0,
      'rgba(25, 12, 6, 0.42)',
      undefined,
      undefined,
      true,
      true,
      seed + 99,
      false,
    );

    // 4. Tied waist cord belt
    const by = topY + beltYOffset;
    this.brush.paintStroke(
      topX - widthTop * 0.54,
      by,
      topX + widthTop * 0.54,
      by,
      5.5,
      beltColor,
      '#44403c',
      '#0c0a09',
      false,
      false,
      seed + 50,
      true,
    );

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 4. ACT I: PALEOLITHIC FAMILY (Living Breathing Anatomy & Campfire Glow)
  // ---------------------------------------------------------------------------
  public paintFamily(baseX: number, baseY: number, scale: number, t: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(scale, scale);

    // Living subtle organic rhythms
    const breath = Math.sin(t * 2.4) * 1.8;
    const fireFlicker = 0.5 + 0.35 * Math.sin(t * 14.0) + 0.15 * Math.cos(t * 9.2);

    // Soft lavender/purple contact shadows pooling under feet on the baseline (matching 2-0)
    ctx.fillStyle = 'rgba(120, 100, 140, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, -6, 120, 14, 0, 0, TAU);
    ctx.fill();

    // ==================== FATHER (Center) ====================
    const fx = 0;
    const fy = -breath * 0.4;

    // Legs: Natural carved wooden limbs with slight contrapposto stance
    // Left leg (straight)
    this.paintLimb(fx - 14, fy - 140, fx - 16, 0 - 12, 22, 1);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(fx - 16, -6, 18, 9, 0, 0, TAU);
    ctx.fill();

    // Right leg (slightly angled forward)
    this.paintLimb(fx + 16, fy - 140, fx + 18, 0 - 12, 22, 2);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(fx + 22, -6, 18, 9, 0.1, 0, TAU);
    ctx.fill();

    // Volumetric draped light-grey linen tunic with vertical folds (matching 1-57 & 2-0)
    this.paintDrapedTunic(
      fx,
      fy - 265,
      76,
      92,
      130 + breath * 0.5,
      '#9ca3af',
      '#64748b',
      '#e5e7eb',
      62,
      '#1c1917',
      10,
    );

    // Warm amber campfire glow brush along left side of father's tunic (facing fire)
    this.brush.paintCurve(
      fx - 36, fy - 260,
      fx - 44, fy - 140,
      fx - 48, fy - 200,
      8.0,
      `rgba(251, 191, 36, ${0.35 * fireFlicker})`,
      `rgba(245, 158, 11, ${0.20 * fireFlicker})`,
      undefined,
      6,
      15,
      true,
    );

    // Diagonal draped sash across chest (left shoulder to right waist)
    this.brush.paintCurve(
      fx - 34,
      fy - 265,
      fx + 36,
      fy - 195,
      fx,
      fy - 228,
      18,
      '#475569',
      '#64748b',
      '#1e293b',
      12,
      20,
      true,
    );

    // Turned wooden head with dark pompadour cap
    this.paintHead(fx, fy - 298 - breath * 0.3, 20, 26, 'father');

    // Father's left arm reaching around mother's shoulder tenderly (matching 1-57)
    const armTenderFlex = Math.sin(t * 2.4 + 0.5) * 1.5;
    this.brush.paintCurve(
      fx + 30, fy - 250,
      fx + 56, fy - 245 + armTenderFlex,
      fx + 44, fy - 260,
      14,
      '#b88960',
      '#d4a373',
      '#5a381e',
      8,
      25,
      true,
    );

    // ==================== CHILD (Left) ====================
    const cx = -56;
    const cy = 0;
    const childBreath = Math.sin(t * 3.0 + 1.0) * 1.2;

    // Hand grasp point naturally centered between father and child
    const graspX = (fx + cx) * 0.52; // ~ -29px
    const graspY = -136 + breath * 0.3;

    // Father's right arm curving down to hold child's hand
    this.brush.paintCurve(
      fx - 28, fy - 250,
      graspX, graspY,
      fx - 34, fy - 195,
      14,
      '#b88960',
      '#d4a373',
      '#5a381e',
      8,
      26,
      true,
    );

    // Legs & feet
    this.paintLimb(cx - 8, cy - 85, cx - 10, cy - 10, 15, 41);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 5, 12, 6, 0, 0, TAU);
    ctx.fill();

    this.paintLimb(cx + 8, cy - 85, cx + 10, cy - 10, 15, 42);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(cx + 12, cy - 5, 12, 6, 0, 0, TAU);
    ctx.fill();

    // Tan / straw pleated tunic
    this.paintDrapedTunic(
      cx,
      cy - 165 - childBreath,
      50,
      60,
      82,
      '#d4b996',
      '#a88a64',
      '#fde68a',
      40,
      '#3b2210',
      50,
    );

    // Child Head - tilted slightly upward toward the dancing flames
    this.paintHead(cx, cy - 192 - childBreath, 14, 18, 'child');

    // Child's left arm reaching up-right to clasp father's hand
    this.brush.paintCurve(
      cx + 14, cy - 152 - childBreath,
      graspX, graspY,
      cx + 24, cy - 146,
      10,
      '#b88960',
      '#d4a373',
      '#5a381e',
      6,
      60,
      true,
    );
    // Interlocking hand clasp knot
    ctx.fillStyle = '#8a5a36';
    ctx.beginPath();
    ctx.arc(graspX, graspY, 8.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5a381e';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Child's right arm outstretched to left pointing toward campfire with living wonder gesture (matching 1-57)
    const childReachY = -138 + Math.sin(t * 2.8) * 3.5;
    this.brush.paintCurve(
      cx - 14, cy - 152 - childBreath,
      cx - 52, childReachY,
      cx - 34, cy - 150,
      10,
      '#b88960',
      '#d4a373',
      '#5a381e',
      6,
      61,
      true,
    );

    // ==================== MOTHER WITH CRADLED INFANT (Right, matching 1-57 and 2-0) ====================
    const mx = 52;
    const my = 0;
    const momBreath = Math.sin(t * 2.2 + 0.3) * 1.5;

    // Legs & feet (only lower calves visible beneath long rust dress)
    this.paintLimb(mx - 12, my - 62, mx - 12, my - 12, 18, 71);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(mx - 10, my - 6, 16, 8, 0, 0, TAU);
    ctx.fill();

    this.paintLimb(mx + 12, my - 62, mx + 16, my - 12, 18, 72);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(mx + 20, my - 6, 16, 8, 0.1, 0, TAU);
    ctx.fill();

    // Rich terracotta-red draped dress cinched at waist and falling gracefully to mid-calf (matching 1-57 & 2-0)
    this.paintDrapedTunic(
      mx,
      my - 256 - momBreath,
      56,
      68,
      182 + momBreath * 0.4,
      '#9a3412',
      '#5a180c',
      '#b84224',
      68,
      '#381c10',
      80,
    );
    // Raw cream under-hem fringe
    this.brush.paintStroke(
      mx - 34, my - 74, mx + 34, my - 74, 5.0,
      '#fef3c7', '#ffffff', '#e2d9b6', false, false, 82, true
    );

    // Head tilted gently toward father
    ctx.save();
    ctx.translate(mx, my - 288 - momBreath);
    ctx.rotate(-0.08 + Math.sin(t * 1.8) * 0.02);
    this.paintHead(0, 0, 18, 24, 'mother');
    ctx.restore();

    // --- MOTHER TENDERLY CRADLING & SOOTHING ROCKING INFANT (matching 1-57 & 2-0) ---
    // Infant nestled diagonally across mother's chest, lovingly rocked in both arms
    const babyRockAng = 0.32 + Math.sin(t * 2.0) * 0.04;
    const babyBobY = Math.sin(t * 2.0) * 2.5;
    const bx = mx + 14;
    const by = my - 238 - momBreath + babyBobY;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(babyRockAng);

    // Swaddled infant body with warm cream linen tunic
    this.paintDrapedTunic(0, -16, 22, 28, 38, '#ded3c1', '#a89882', '#f5f0e6', 15, '#3b2210', 101);

    // Baby carved wooden head nestled against mother's shoulder
    this.paintHead(0, -28, 8.5, 11, 'child', '#140d08');

    // Baby feet peeking out below swaddle
    this.paintLimb(-4, 22, -6, 38, 5.5, 103);
    this.paintLimb(4, 22, 6, 39, 5.5, 104);
    ctx.fillStyle = '#3a2012';
    ctx.beginPath();
    ctx.ellipse(-5, 40, 5, 3, 0, 0, TAU);
    ctx.ellipse(7, 41, 5, 3, 0, 0, TAU);
    ctx.fill();

    // Baby arm resting gently against mother's chest
    this.paintLimb(-4, -6, -14, 0, 5.0, 105);

    ctx.restore();

    // Mother's left arm curving from shoulder under infant's body to cradle securely (moving with baby)
    this.brush.paintCurve(
      mx - 14, my - 248 - momBreath,
      bx + 18, by + 26,
      mx + 4, my - 212 - momBreath * 0.5,
      14.0,
      '#b88960',
      '#d4a373',
      '#5a381e',
      10,
      95,
      true,
    );

    // Mother's right hand supporting infant from the outer side (moving with baby)
    this.brush.paintCurve(
      mx + 26, my - 245 - momBreath,
      bx + 2, by + 18,
      mx + 22, my - 222 - momBreath * 0.5,
      12.0,
      '#b88960',
      '#d4a373',
      '#5a381e',
      8,
      96,
      true,
    );

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // KINEMATIC WALKING MANNEQUIN (2-Bone Striding Legs, Bobbing Torso, Dynamic Arms)
  // ---------------------------------------------------------------------------
  public paintKinematicMannequin(
    x: number,
    groundY: number,
    scale: number,
    walkPhase: number,
    isWalking: boolean,
    facing: number, // 1 for right, -1 for left
    tunicH: number,
    tunicTopW: number,
    tunicBotW: number,
    tunicBaseCol: string,
    tunicFoldCol: string,
    tunicHiCol: string,
    beltYOff: number,
    beltCol: string,
    headW: number,
    headH: number,
    hairStyle: 'father' | 'mother' | 'child' | 'villager',
    hairColor: string,
    armLMode: 'swing' | 'staff' | 'jar' | 'hoe' | 'reach' | 'carry_pack',
    armRMode: 'swing' | 'staff' | 'jar' | 'hoe' | 'reach' | 'carry_pack',
    seed: number = 0,
    t: number = 0,
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, scale);

    const s = 1.0;
    // Torso bobbing: dips at passing point, peaks at mid-stride
    const torsoBob = isWalking ? -Math.abs(Math.sin(walkPhase)) * 4.5 : Math.sin(t * 2.2 + seed) * 1.2;
    const bodyTilt = isWalking ? facing * 0.05 : 0;

    // Contact shadow beneath mannequin (stretches and shifts with foot plants)
    ctx.fillStyle = 'rgba(110, 95, 125, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, -3, 26, 6, 0, 0, TAU);
    ctx.fill();

    // Hip pivot height
    const hipY = -tunicH * 0.95 + torsoBob;
    const legLen = tunicH * 0.95;

    // Kinematic 2-bone leg calculations
    const phiL = walkPhase;
    const phiR = walkPhase + Math.PI;

    // Left leg
    const angL = isWalking ? Math.sin(phiL) * 0.42 * facing : -0.06;
    const liftL = isWalking ? Math.max(0, Math.sin(phiL)) * 7.5 : 0;
    const kneeBendL = isWalking ? Math.max(0, -Math.sin(phiL * facing)) * 0.40 : 0;

    // Right leg
    const angR = isWalking ? Math.sin(phiR) * 0.42 * facing : 0.08;
    const liftR = isWalking ? Math.max(0, Math.sin(phiR)) * 7.5 : 0;
    const kneeBendR = isWalking ? Math.max(0, -Math.sin(phiR * facing)) * 0.40 : 0;

    const hipOffX = 7;

    // Render back leg (Left if facing right, Right if facing left)
    const renderLeg = (hipX: number, ang: number, lift: number, kneeBend: number, legSeed: number) => {
      const thighLen = legLen * 0.52;
      const calfLen = legLen * 0.50;

      // Hip to knee
      const kx = hipX + Math.sin(ang) * thighLen;
      const ky = hipY + Math.cos(ang) * thighLen;
      this.paintLimb(hipX, hipY, kx, ky, 9.5, legSeed);

      // Knee to foot
      const calfAng = ang - kneeBend * facing;
      const fx = kx + Math.sin(calfAng) * calfLen;
      const fy = Math.min(-3, ky + Math.cos(calfAng) * calfLen - lift);
      this.paintLimb(kx, ky, fx, fy, 8.5, legSeed + 1);

      // Foot ellipse planted or lifted
      ctx.fillStyle = '#3a2012';
      ctx.beginPath();
      ctx.ellipse(fx + facing * 3, fy, 8.5, 4.5, ang * 0.3, 0, TAU);
      ctx.fill();

      return { fx, fy, kx, ky };
    };

    // 1. Back leg
    renderLeg(-hipOffX * facing, angL, liftL, kneeBendL, seed + 1);

    // 2. Torso with Draped Tunic
    ctx.save();
    ctx.translate(0, torsoBob);
    ctx.rotate(bodyTilt);

    const tunicTopY = hipY - tunicH * 0.75;
    this.paintDrapedTunic(
      0,
      tunicTopY,
      tunicTopW,
      tunicBotW,
      tunicH,
      tunicBaseCol,
      tunicFoldCol,
      tunicHiCol,
      beltYOff,
      beltCol,
      seed + 10,
    );

    // 3. Front leg
    renderLeg(hipOffX * facing, angR, liftR, kneeBendR, seed + 3);

    // 4. Head with Hair/Cap
    const headY = tunicTopY - headH * 0.85;
    this.paintHead(0, headY, headW, headH, hairStyle, hairColor);

    // 5. Arms and Props
    const armSwingL = isWalking ? Math.sin(phiR) * 0.38 : 0;
    const armSwingR = isWalking ? Math.sin(phiL) * 0.38 : 0;
    const shoulderY = tunicTopY + 8;

    // Render left arm / prop
    if (armLMode === 'swing') {
      const handX = -tunicTopW * 0.45 + Math.sin(armSwingL) * 22;
      const handY = shoulderY + Math.cos(armSwingL) * 24;
      this.paintLimb(-tunicTopW * 0.40, shoulderY, handX, handY, 7.0, seed + 21);
    } else if (armLMode === 'hoe') {
      // Arm holding hoe resting on shoulder
      const handX = facing * 12;
      const handY = shoulderY - 8;
      this.paintLimb(-tunicTopW * 0.35, shoulderY, handX, handY, 7.5, seed + 22);
      // Wooden hoe shaft resting on shoulder and trailing behind
      const hoeAng = -0.35 * facing + (isWalking ? Math.sin(walkPhase) * 0.08 : 0);
      const hx1 = handX - facing * 32;
      const hy1 = handY + 28;
      const hx2 = handX + facing * 44;
      const hy2 = handY - 38;
      this.brush.paintStroke(hx1, hy1, hx2, hy2, 5.0, '#443425', '#5c4632');
      // Flint/iron blade head at top of hoe
      this.brush.paintStroke(hx2 - 6, hy2 - 4, hx2 + 8, hy2 + 10, 7.5, '#78716c', '#57534e');
    } else if (armLMode === 'jar') {
      // Arm holding terracotta amphora jar balanced on shoulder
      const handX = facing * 14;
      const handY = shoulderY - 14;
      this.paintLimb(-tunicTopW * 0.30, shoulderY, handX, handY, 7.0, seed + 23);
      // Terracotta water amphora
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.ellipse(facing * 12, shoulderY - 16, 11, 15, facing * 0.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(facing * 20, shoulderY - 16, 6, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    } else if (armLMode === 'carry_pack') {
      // Arm gripping shoulder strap of traveler's bedroll / pack
      this.paintLimb(-tunicTopW * 0.35, shoulderY, facing * 8, shoulderY + 8, 7.0, seed + 24);
      // Bedroll / linen traveler's pack strapped across back
      ctx.fillStyle = '#785b3a';
      ctx.beginPath();
      ctx.ellipse(-facing * 16, shoulderY + 6, 14, 18, -facing * 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#4a3520';
      ctx.lineWidth = 2.0;
      ctx.stroke();
    }

    // Render right arm / prop
    if (armRMode === 'swing') {
      const handX = tunicTopW * 0.45 + Math.sin(armSwingR) * 22;
      const handY = shoulderY + Math.cos(armSwingR) * 24;
      this.paintLimb(tunicTopW * 0.40, shoulderY, handX, handY, 7.0, seed + 25);
    } else if (armRMode === 'staff') {
      // Arm holding vertical elder staff
      const handX = tunicTopW * 0.45 + facing * 8;
      const handY = shoulderY + 12;
      this.paintLimb(tunicTopW * 0.30, shoulderY, handX, handY, 7.5, seed + 26);
      // Carved elder staff reaching down to ground
      const staffTopY = shoulderY - 32;
      const staffBotY = hipY + legLen + 4;
      this.brush.paintStroke(handX + facing * 4, staffTopY, handX + facing * 4, staffBotY, 5.0, '#3b2514', '#52341d');
    } else if (armRMode === 'reach') {
      // Arm outstretched forward in running or welcoming gesture
      const handX = facing * 28 + Math.sin(t * 8.0) * 4;
      const handY = shoulderY - 4;
      this.paintLimb(tunicTopW * 0.35, shoulderY, handX, handY, 6.5, seed + 27);
    }

    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. ACT II: POPULATION OF NEOLITHIC VILLAGERS (Kinematic Walking Cycles)
  // ---------------------------------------------------------------------------
  public paintVillagers(groundY: number, screenW: number, t: number = 0): void {
    const act2T = Math.max(0, t - 3.2);

    // Villager 1: Farmer walking steadily carrying hoe over shoulder across fields
    const v1WalkSpeed = 16; // px per second
    const v1Cycle = act2T * 4.2;
    const v1BaseX = screenW * 0.11 + act2T * v1WalkSpeed;
    this.paintKinematicMannequin(
      v1BaseX,
      groundY,
      1.10,
      v1Cycle,
      true,
      1, // facing right
      46, 34, 40,
      '#a89f91', '#6b6459', '#d6cebf',
      22, '#382f25',
      11, 14,
      'villager', '#1c1917',
      'hoe', 'swing',
      201,
      t,
    );

    // Villager 2: Water carrier woman with earthen jar walking with graceful poise
    const v2WalkSpeed = 14;
    const v2Cycle = act2T * 3.8;
    const v2BaseX = screenW * 0.43 + act2T * v2WalkSpeed;
    this.paintKinematicMannequin(
      v2BaseX,
      groundY,
      1.05,
      v2Cycle,
      true,
      1, // facing right towards gate
      42, 30, 36,
      '#b45309', '#78350f', '#d97706',
      20, '#451a03',
      10, 13,
      'villager', '#1c1917',
      'jar', 'swing',
      211,
      t,
    );

    // Villager 3: Running child sprinting joyfully across the village towards the timber gate!
    const v3RunSpeed = 38;
    const v3Cycle = act2T * 9.5;
    const v3BaseX = screenW * 0.47 + act2T * v3RunSpeed;
    this.paintKinematicMannequin(
      v3BaseX,
      groundY,
      0.82,
      v3Cycle,
      true,
      1, // facing right
      30, 22, 26,
      '#4d5b36', '#2d371e', '#6d814d',
      14, '#1b2212',
      7.5, 10,
      'child', '#2d241e',
      'reach', 'swing',
      221,
      t,
    );

    // Villager 4: Gatekeeper elder standing proudly at timber gate with walking staff
    const v4X = screenW * 0.67;
    const v4PaceCycle = Math.sin(t * 1.8) * 0.5;
    this.paintKinematicMannequin(
      v4X,
      groundY,
      1.12,
      v4PaceCycle,
      false, // standing with slight pacing sway
      1,
      48, 34, 40,
      '#7f1d1d', '#450a0a', '#991b1b',
      22, '#290505',
      11, 14,
      'villager', '#e2e8f0', // Silver hair elder
      'swing', 'staff',
      231,
      t,
    );

    // Villager 5: Arriving Neighbor walking into village through gate ("THEN WE LET THE NEIGHBORS IN")
    const v5WalkSpeed = 24;
    const v5Cycle = act2T * 4.4;
    const v5BaseX = screenW * 0.85 - act2T * v5WalkSpeed;
    this.paintKinematicMannequin(
      v5BaseX,
      groundY,
      1.08,
      v5Cycle,
      true,
      -1, // facing left (entering village through gate!)
      44, 32, 38,
      '#7c2d12', '#451a03', '#9a3412',
      21, '#1c1917',
      10.5, 13.5,
      'villager', '#261a10',
      'carry_pack', 'swing',
      241,
      t,
    );

    // Villager 6: Village artisan sitting/working near the second hut
    const v6X = screenW * 0.24;
    const v6WorkCycle = Math.sin(act2T * 3.2) * 0.35;
    this.paintKinematicMannequin(
      v6X,
      groundY,
      0.95,
      v6WorkCycle,
      false,
      1,
      38, 28, 34,
      '#365314', '#1a2e05', '#4d7c0f',
      18, '#141f02',
      9.5, 12,
      'villager', '#3b2210',
      'swing', 'swing',
      251,
      t,
    );
  }

  // ---------------------------------------------------------------------------
  // 6. ACT III: CITIZEN DELEGATION ON HARBOR PIER (Dynamic Arm Waving & Gesturing)
  // ---------------------------------------------------------------------------
  public paintPierCitizens(pierX: number, pierY: number, t: number = 0): void {
    const citizens = [
      { xOff: -28, h: 36, col: '#7f1d1d', fCol: '#450a0a', hCol: '#991b1b', waveType: 'left' },   // Madder red
      { xOff: -14, h: 40, col: '#1e3a8a', fCol: '#172554', hCol: '#2563eb', waveType: 'both' },   // Woad blue
      { xOff: 0,   h: 38, col: '#b45309', fCol: '#78350f', hCol: '#d97706', waveType: 'idle' },   // Saffron ochre
      { xOff: 15,  h: 42, col: '#581c87', fCol: '#3b0764', hCol: '#7e22ce', waveType: 'right' },  // Tyrian purple
      { xOff: 30,  h: 37, col: '#292524', fCol: '#0c0a09', hCol: '#44403c', waveType: 'both' },   // Charcoal philosopher robe
    ];

    for (let i = 0; i < citizens.length; i++) {
      const c = citizens[i];
      const cx = pierX + c.xOff;
      const cy = pierY;

      // Subtle breathing / weight shift
      const bob = Math.sin(t * 3.0 + i * 1.4) * 1.2;

      // Miniature carved wooden legs
      this.paintLimb(cx - 3, cy - c.h * 0.45 + bob, cx - 3, cy, 4.5, i);
      this.paintLimb(cx + 3, cy - c.h * 0.45 + bob, cx + 3, cy, 4.5, i + 1);

      // Classical draped tunic / himation
      this.paintDrapedTunic(
        cx,
        cy - c.h * 0.85 + bob,
        14,
        18,
        c.h * 0.45,
        c.col,
        c.fCol,
        c.hCol,
        c.h * 0.22,
        '#1c1917',
        i * 20,
      );

      // Wooden head with hair/cap
      this.paintHead(cx, cy - c.h * 0.95 + bob, 5.5, 7.5, 'villager');

      // Gesturing arm waving dynamically at arriving merchant ships!
      const wavePhase = t * 4.5 + i * 1.2;
      const waveAngle = Math.sin(wavePhase) * 0.45;

      if (c.waveType === 'left' || c.waveType === 'both') {
        const handX = cx - 8 + Math.cos(waveAngle - 1.2) * 14;
        const handY = cy - c.h * 0.75 + bob + Math.sin(waveAngle - 1.2) * 14;
        this.paintLimb(cx - 5, cy - c.h * 0.75 + bob, handX, handY, 3.5, i + 10);
      }
      if (c.waveType === 'right' || c.waveType === 'both') {
        const handX = cx + 8 + Math.cos(-waveAngle + 1.2) * 14;
        const handY = cy - c.h * 0.75 + bob + Math.sin(-waveAngle + 1.2) * 14;
        this.paintLimb(cx + 5, cy - c.h * 0.75 + bob, handX, handY, 3.5, i + 15);
      }
    }
  }
}

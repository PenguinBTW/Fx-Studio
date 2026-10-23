// PAINTERLY TYPOGRAPHY & CALLIGRAPHIC IMPASTO ENGINE (v3.0 Master Edition)
// Procedural hand-painted oil brush calligraphy with flat-chisel dynamics,
// wet-in-wet pigment ribbons, 3D sculptural block relief, and seafoam froth lettering.

import { TAU } from '../../engine/util';
import { PainterlyBrush } from './painterly_brush';

type LetterSegment =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; widthScale: number }
  | { type: 'curve'; x1: number; y1: number; x2: number; y2: number; cx: number; cy: number; widthScale: number };

const CALLIGRAPHIC_GLYPHS: Record<string, LetterSegment[]> = {
  'A': [
    { type: 'line', x1: 0.18, y1: 0.96, x2: 0.50, y2: 0.04, widthScale: 1.15 },
    { type: 'line', x1: 0.50, y1: 0.04, x2: 0.82, y2: 0.96, widthScale: 1.25 },
    { type: 'line', x1: 0.28, y1: 0.62, x2: 0.72, y2: 0.62, widthScale: 0.75 },
  ],
  'B': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'curve', x1: 0.22, y1: 0.06, x2: 0.22, y2: 0.50, cx: 0.86, cy: 0.26, widthScale: 1.05 },
    { type: 'curve', x1: 0.22, y1: 0.50, x2: 0.22, y2: 0.94, cx: 0.90, cy: 0.72, widthScale: 1.10 },
  ],
  'C': [
    { type: 'curve', x1: 0.82, y1: 0.18, x2: 0.22, y2: 0.50, cx: 0.22, cy: 0.08, widthScale: 1.15 },
    { type: 'curve', x1: 0.22, y1: 0.50, x2: 0.82, y2: 0.82, cx: 0.22, cy: 0.92, widthScale: 1.20 },
  ],
  'D': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'curve', x1: 0.22, y1: 0.06, x2: 0.22, y2: 0.94, cx: 0.95, cy: 0.50, widthScale: 1.25 },
  ],
  'E': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'line', x1: 0.22, y1: 0.06, x2: 0.80, y2: 0.06, widthScale: 0.90 },
    { type: 'line', x1: 0.22, y1: 0.50, x2: 0.68, y2: 0.50, widthScale: 0.75 },
    { type: 'line', x1: 0.22, y1: 0.94, x2: 0.82, y2: 0.94, widthScale: 0.95 },
  ],
  'F': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'line', x1: 0.22, y1: 0.06, x2: 0.80, y2: 0.06, widthScale: 0.90 },
    { type: 'line', x1: 0.22, y1: 0.50, x2: 0.65, y2: 0.50, widthScale: 0.75 },
  ],
  'G': [
    { type: 'curve', x1: 0.82, y1: 0.18, x2: 0.22, y2: 0.50, cx: 0.22, cy: 0.08, widthScale: 1.15 },
    { type: 'curve', x1: 0.22, y1: 0.50, x2: 0.82, y2: 0.82, cx: 0.22, cy: 0.92, widthScale: 1.20 },
    { type: 'line', x1: 0.52, y1: 0.54, x2: 0.82, y2: 0.54, widthScale: 0.85 },
    { type: 'line', x1: 0.82, y1: 0.54, x2: 0.82, y2: 0.82, widthScale: 1.20 },
  ],
  'H': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.25 },
    { type: 'line', x1: 0.78, y1: 0.04, x2: 0.78, y2: 0.96, widthScale: 1.25 },
    { type: 'line', x1: 0.22, y1: 0.50, x2: 0.78, y2: 0.50, widthScale: 0.80 },
  ],
  'I': [
    { type: 'line', x1: 0.50, y1: 0.04, x2: 0.50, y2: 0.96, widthScale: 1.35 },
    { type: 'line', x1: 0.28, y1: 0.06, x2: 0.72, y2: 0.06, widthScale: 0.80 },
    { type: 'line', x1: 0.28, y1: 0.94, x2: 0.72, y2: 0.94, widthScale: 0.85 },
  ],
  'J': [
    { type: 'line', x1: 0.72, y1: 0.04, x2: 0.72, y2: 0.68, widthScale: 1.25 },
    { type: 'curve', x1: 0.72, y1: 0.68, x2: 0.24, y2: 0.68, cx: 0.48, cy: 0.98, widthScale: 1.15 },
  ],
  'K': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'line', x1: 0.26, y1: 0.52, x2: 0.82, y2: 0.06, widthScale: 1.10 },
    { type: 'line', x1: 0.45, y1: 0.38, x2: 0.84, y2: 0.96, widthScale: 1.20 },
  ],
  'L': [
    { type: 'line', x1: 0.24, y1: 0.04, x2: 0.24, y2: 0.96, widthScale: 1.30 },
    { type: 'line', x1: 0.24, y1: 0.94, x2: 0.82, y2: 0.94, widthScale: 0.95 },
  ],
  'M': [
    { type: 'line', x1: 0.18, y1: 0.96, x2: 0.18, y2: 0.04, widthScale: 1.25 },
    { type: 'line', x1: 0.18, y1: 0.04, x2: 0.50, y2: 0.64, widthScale: 1.15 },
    { type: 'line', x1: 0.50, y1: 0.64, x2: 0.82, y2: 0.04, widthScale: 1.15 },
    { type: 'line', x1: 0.82, y1: 0.04, x2: 0.82, y2: 0.96, widthScale: 1.25 },
  ],
  'N': [
    { type: 'line', x1: 0.22, y1: 0.96, x2: 0.22, y2: 0.04, widthScale: 1.25 },
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.78, y2: 0.96, widthScale: 1.35 },
    { type: 'line', x1: 0.78, y1: 0.96, x2: 0.78, y2: 0.04, widthScale: 1.20 },
  ],
  'O': [
    { type: 'curve', x1: 0.50, y1: 0.04, x2: 0.20, y2: 0.50, cx: 0.20, cy: 0.10, widthScale: 1.20 },
    { type: 'curve', x1: 0.20, y1: 0.50, x2: 0.50, y2: 0.96, cx: 0.20, cy: 0.90, widthScale: 1.20 },
    { type: 'curve', x1: 0.50, y1: 0.04, x2: 0.80, y2: 0.50, cx: 0.80, cy: 0.10, widthScale: 1.20 },
    { type: 'curve', x1: 0.80, y1: 0.50, x2: 0.50, y2: 0.96, cx: 0.80, cy: 0.90, widthScale: 1.20 },
  ],
  'P': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'curve', x1: 0.22, y1: 0.06, x2: 0.22, y2: 0.52, cx: 0.86, cy: 0.28, widthScale: 1.15 },
  ],
  'Q': [
    { type: 'curve', x1: 0.50, y1: 0.04, x2: 0.20, y2: 0.50, cx: 0.20, cy: 0.10, widthScale: 1.20 },
    { type: 'curve', x1: 0.20, y1: 0.50, x2: 0.50, y2: 0.96, cx: 0.20, cy: 0.90, widthScale: 1.20 },
    { type: 'curve', x1: 0.50, y1: 0.04, x2: 0.80, y2: 0.50, cx: 0.80, cy: 0.10, widthScale: 1.20 },
    { type: 'curve', x1: 0.80, y1: 0.50, x2: 0.50, y2: 0.96, cx: 0.80, cy: 0.90, widthScale: 1.20 },
    { type: 'line', x1: 0.56, y1: 0.65, x2: 0.88, y2: 0.96, widthScale: 1.30 },
  ],
  'R': [
    { type: 'line', x1: 0.22, y1: 0.04, x2: 0.22, y2: 0.96, widthScale: 1.30 },
    { type: 'curve', x1: 0.22, y1: 0.06, x2: 0.22, y2: 0.52, cx: 0.86, cy: 0.28, widthScale: 1.15 },
    { type: 'line', x1: 0.46, y1: 0.52, x2: 0.84, y2: 0.96, widthScale: 1.25 },
  ],
  'S': [
    { type: 'curve', x1: 0.80, y1: 0.18, x2: 0.22, y2: 0.38, cx: 0.28, cy: 0.08, widthScale: 1.10 },
    { type: 'curve', x1: 0.22, y1: 0.38, x2: 0.78, y2: 0.66, cx: 0.50, cy: 0.52, widthScale: 1.25 },
    { type: 'curve', x1: 0.78, y1: 0.66, x2: 0.20, y2: 0.84, cx: 0.72, cy: 0.94, widthScale: 1.10 },
  ],
  'T': [
    { type: 'line', x1: 0.16, y1: 0.06, x2: 0.84, y2: 0.06, widthScale: 0.95 },
    { type: 'line', x1: 0.50, y1: 0.06, x2: 0.50, y2: 0.96, widthScale: 1.30 },
  ],
  'U': [
    { type: 'line', x1: 0.24, y1: 0.04, x2: 0.24, y2: 0.68, widthScale: 1.25 },
    { type: 'curve', x1: 0.24, y1: 0.68, x2: 0.76, y2: 0.68, cx: 0.50, cy: 0.98, widthScale: 1.20 },
    { type: 'line', x1: 0.76, y1: 0.68, x2: 0.76, y2: 0.04, widthScale: 1.25 },
  ],
  'V': [
    { type: 'line', x1: 0.20, y1: 0.04, x2: 0.50, y2: 0.96, widthScale: 1.25 },
    { type: 'line', x1: 0.50, y1: 0.96, x2: 0.80, y2: 0.04, widthScale: 1.20 },
  ],
  'W': [
    { type: 'line', x1: 0.12, y1: 0.04, x2: 0.32, y2: 0.96, widthScale: 1.20 },
    { type: 'line', x1: 0.32, y1: 0.96, x2: 0.50, y2: 0.40, widthScale: 1.10 },
    { type: 'line', x1: 0.50, y1: 0.40, x2: 0.68, y2: 0.96, widthScale: 1.10 },
    { type: 'line', x1: 0.68, y1: 0.96, x2: 0.88, y2: 0.04, widthScale: 1.20 },
  ],
  'Y': [
    { type: 'line', x1: 0.20, y1: 0.04, x2: 0.50, y2: 0.48, widthScale: 1.15 },
    { type: 'line', x1: 0.80, y1: 0.04, x2: 0.50, y2: 0.48, widthScale: 1.15 },
    { type: 'line', x1: 0.50, y1: 0.48, x2: 0.50, y2: 0.96, widthScale: 1.30 },
  ],
  "'": [
    { type: 'line', x1: 0.50, y1: 0.04, x2: 0.44, y2: 0.30, widthScale: 1.10 },
  ],
};

export class PainterlyTypography {
  public ctx: CanvasRenderingContext2D;
  public brush: PainterlyBrush;

  constructor(ctx: CanvasRenderingContext2D, brush: PainterlyBrush) {
    this.ctx = ctx;
    this.brush = brush;
  }

  // ---------------------------------------------------------------------------
  // 1. RENDER CALLIGRAPHIC LETTER GLYPH (Flat-Chisel Impasto Ribbon Engine)
  // ---------------------------------------------------------------------------
  public paintGlyph(
    char: string,
    x: number,
    y: number,
    size: number,
    bodyColor: string,
    wetBlendColor?: string,
    shadowColor?: string,
    seed: number = 0,
    hasSheen: boolean = false,
  ): void {
    const ctx = this.ctx;
    const segments = CALLIGRAPHIC_GLYPHS[char.toUpperCase()];
    if (!segments) return;

    // Muscular, flat-chisel stroke width (~22% of glyph size, perfectly proportioned impasto)
    const baseWidth = Math.max(4.0, size * 0.22);
    const halfW = size * 0.36;
    const halfH = size * 0.48;

    ctx.save();
    ctx.lineCap = 'butt'; // Crisp flat-chisel terminals!
    ctx.lineJoin = 'miter';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const strokeW = baseWidth * seg.widthScale;

      const getPoints = (ox: number = 0, oy: number = 0) => {
        const x1 = x - halfW + seg.x1 * (halfW * 2) + ox;
        const y1 = y - halfH + seg.y1 * (halfH * 2) + oy;
        const x2 = x - halfW + seg.x2 * (halfW * 2) + ox;
        const y2 = y - halfH + seg.y2 * (halfH * 2) + oy;
        const cx = seg.type === 'curve' ? x - halfW + seg.cx * (halfW * 2) + ox : 0;
        const cy = seg.type === 'curve' ? y - halfH + seg.cy * (halfH * 2) + oy : 0;
        return { x1, y1, x2, y2, cx, cy };
      };

      const strokePath = (ox: number = 0, oy: number = 0) => {
        const pts = getPoints(ox, oy);
        ctx.beginPath();
        ctx.moveTo(pts.x1, pts.y1);
        if (seg.type === 'line') {
          ctx.lineTo(pts.x2, pts.y2);
        } else {
          ctx.quadraticCurveTo(pts.cx, pts.cy, pts.x2, pts.y2);
        }
      };

      // 1. Soft natural directional drop shadow (offset down-right on canvas)
      if (shadowColor) {
        ctx.strokeStyle = shadowColor;
        ctx.lineWidth = strokeW * 1.05;
        ctx.globalAlpha = 0.28;
        strokePath(2.0, 3.0);
        ctx.stroke();
      }

      // 2. Rich, solid opaque oil body core
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = strokeW;
      ctx.globalAlpha = 1.0;
      strokePath(0, 0);
      ctx.stroke();

      // 3. Realistic longitudinal bristle striations (hairline brush drags inside the stroke)
      const bristleCount = Math.max(3, Math.min(6, Math.floor(strokeW * 0.35)));
      for (let b = 0; b < bristleCount; b++) {
        const u = (b / (bristleCount - 1) - 0.5) * 2; // -1 to 1
        const offset = u * (strokeW * 0.32);
        const bSeed = seed * 43 + i * 19 + b * 7;
        const jx = (this.brush.hash(bSeed) - 0.5) * 1.2;
        const jy = (this.brush.hash(bSeed + 1) - 0.5) * 1.2;

        ctx.strokeStyle = u < 0 ? (shadowColor || 'rgba(0,0,0,0.25)') : (wetBlendColor || bodyColor);
        ctx.globalAlpha = 0.40 + this.brush.hash(bSeed + 2) * 0.35;
        ctx.lineWidth = Math.max(0.9, strokeW * 0.16);

        // Compute normal offset
        const pts = getPoints(0, 0);
        const dx = pts.x2 - pts.x1;
        const dy = pts.y2 - pts.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        strokePath(nx * offset + jx, ny * offset + jy);
        ctx.stroke();
      }

      // 4. Subtle wet impasto ridge sheen
      if (hasSheen && strokeW > 6.0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = Math.max(0.8, strokeW * 0.12);
        ctx.globalAlpha = 0.35;
        const pts = getPoints(0, 0);
        const dx = pts.x2 - pts.x1;
        const dy = pts.y2 - pts.y1;
        const len = Math.hypot(dx, dy) || 1;
        strokePath((-dy / len) * (strokeW * 0.22), (dx / len) * (strokeW * 0.22));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 2. RENDER FULL CALLIGRAPHIC TEXT STRING (Linear, Upward Arch, or Smile Arch)
  // ---------------------------------------------------------------------------
  public paintText(
    text: string,
    x: number,
    y: number,
    size: number,
    bodyColor: string,
    archRadius: number = 0,
    isSmileArch: boolean = false,
    wetBlendColor?: string,
    shadowColor?: string,
    hasSheen: boolean = false,
  ): void {
    const ctx = this.ctx;
    const chars = text.split('');
    const charSpacing = size * 0.70;

    if (archRadius === 0) {
      // Linear centered
      const totalW = (chars.length - 1) * charSpacing;
      let startX = x - totalW * 0.5;
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch !== ' ') {
          this.paintGlyph(ch, startX, y, size, bodyColor, wetBlendColor, shadowColor, i * 7, hasSheen);
        }
        startX += charSpacing;
      }
    } else if (!isSmileArch) {
      // Upward Arch (Center of curvature below baseline)
      const arcCenterY = y + archRadius;
      const totalArc = ((chars.length - 1) * charSpacing) / archRadius;

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const u = (i / (chars.length - 1 || 1) - 0.5) * totalArc;
        const px = x + Math.sin(u) * archRadius;
        const py = arcCenterY - Math.cos(u) * archRadius;
        const rot = u;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        if (ch !== ' ') {
          this.paintGlyph(ch, 0, 0, size, bodyColor, wetBlendColor, shadowColor, i * 7, hasSheen);
        }
        ctx.restore();
      }
    } else {
      // Smile Arch (Center of curvature above baseline, rot = -u keeps letters upright)
      const arcCenterY = y - archRadius;
      const totalArc = ((chars.length - 1) * charSpacing) / archRadius;

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const u = (i / (chars.length - 1 || 1) - 0.5) * totalArc;
        const px = x + Math.sin(u) * archRadius;
        const py = arcCenterY + Math.cos(u) * archRadius;
        const rot = -u; // Inward tilt matching smile baseline!

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(rot);
        if (ch !== ' ') {
          this.paintGlyph(ch, 0, 0, size, bodyColor, wetBlendColor, shadowColor, i * 7, hasSheen);
        }
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 3. MONUMENTAL RAW WET-IN-WET IMPASTO "KIN" (matching 2-0 screenshot.png)
  // ---------------------------------------------------------------------------
  public paintMonumentalKin(cx: number, cy: number, size: number, progress: number = 1.0): void {
    const ctx = this.ctx;
    const sw = size * 0.22; // bold ~33px stroke width

    // Render an authentic wet-on-wet solid red-ochre oil brush stroke
    const paintOilStroke = (
      p1x: number,
      p1y: number,
      p2x: number,
      p2y: number,
      width: number,
      seed: number = 0,
      curveOffset: number = 0,
    ) => {
      const dx = p2x - p1x;
      const dy = p2y - p1y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.save();
      ctx.lineCap = 'butt'; // Crisp flat-chisel terminals matching 2-0
      ctx.lineJoin = 'miter';

      const drawPath = () => {
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        if (curveOffset !== 0) {
          ctx.quadraticCurveTo(
            (p1x + p2x) * 0.5 + nx * curveOffset,
            (p1y + p2y) * 0.5 + ny * curveOffset,
            p2x,
            p2y,
          );
        } else {
          ctx.lineTo(p2x, p2y);
        }
      };

      // 1. Main thick, solid, opaque red-ochre / vermilion oil body core (matching 2-0)
      ctx.strokeStyle = '#b91c1c'; // Vibrant cadmium red / iron-oxide core
      ctx.lineWidth = width;
      ctx.globalAlpha = 1.0;
      drawPath();
      ctx.stroke();

      // 2. Rich warm vermilion / orange wet blend in center of stroke
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = width * 0.55;
      ctx.globalAlpha = 0.85;
      drawPath();
      ctx.stroke();

      // 4. Longitudinal bristle striations running along the stroke length
      const bristleCount = 8;
      for (let b = 0; b < bristleCount; b++) {
        const u = (b / (bristleCount - 1) - 0.5) * 2; // -1 to 1
        const offset = u * (width * 0.36);
        const bSeed = seed * 43 + b * 17;
        const jitter = (this.brush.hash(bSeed) - 0.5) * (width * 0.08);

        const bx1 = p1x + nx * (offset + jitter);
        const by1 = p1y + ny * (offset + jitter);
        const bx2 = p2x + nx * (offset + jitter);
        const by2 = p2y + ny * (offset + jitter);

        ctx.strokeStyle = u < 0 ? '#7f1d1d' : '#c2410c';
        ctx.globalAlpha = 0.35 + this.brush.hash(bSeed + 3) * 0.30;
        ctx.lineWidth = Math.max(1.2, width * 0.12);
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        if (curveOffset !== 0) {
          ctx.quadraticCurveTo(
            (bx1 + bx2) * 0.5 + nx * curveOffset,
            (by1 + by2) * 0.5 + ny * curveOffset,
            bx2,
            by2,
          );
        } else {
          ctx.lineTo(bx2, by2);
        }
        ctx.stroke();
      }

      // 5. Feathered dry-brush bristle ends at terminals (natural splayed hairs)
      for (let t = 0; t < 6; t++) {
        const toff = (t / 5 - 0.5) * (width * 0.68);
        const tLen = 6 + (t % 3) * 7;
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.55;
        // Start terminal
        ctx.beginPath();
        ctx.moveTo(p1x + nx * toff, p1y + ny * toff);
        ctx.lineTo(p1x + nx * toff - (dx / len) * tLen, p1y + ny * toff - (dy / len) * tLen);
        ctx.stroke();
        // End terminal
        ctx.beginPath();
        ctx.moveTo(p2x + nx * toff, p2y + ny * toff);
        ctx.lineTo(p2x + nx * toff + (dx / len) * tLen, p2y + ny * toff + (dy / len) * tLen);
        ctx.stroke();
      }

      ctx.restore();
    };

    // --- K ---
    if (progress > 0.05) {
      const kProg = Math.min(1.0, progress / 0.35);
      const kx = cx - size * 0.55;
      const topY = cy - size * 0.48;
      const botY = topY + kProg * (size * 0.96);
      // Left vertical stem (slight organic backward curve)
      paintOilStroke(kx, topY, kx, botY, sw, 1, -4);
      if (kProg > 0.45) {
        const branchU = (kProg - 0.45) / 0.55;
        // Upper diagonal branch (flaring up-right)
        paintOilStroke(kx + size * 0.04, cy - size * 0.05, kx + size * 0.04 + branchU * (size * 0.36), (cy - size * 0.05) - branchU * (size * 0.43), sw * 0.92, 2, 3);
        // Lower diagonal leg (flaring down-right with hook foot)
        paintOilStroke(kx + size * 0.08, cy - size * 0.04, kx + size * 0.08 + branchU * (size * 0.34), (cy - size * 0.04) + branchU * (size * 0.52), sw * 0.95, 3, -3);
      }
    }

    // --- I ---
    if (progress > 0.35) {
      const iProg = Math.min(1.0, (progress - 0.35) / 0.30);
      const ix = cx - size * 0.02;
      const topY = cy - size * 0.48;
      const botY = topY + iProg * (size * 0.96);
      paintOilStroke(ix, topY, ix, botY, sw * 1.10, 4, 2);
    }

    // --- N ---
    if (progress > 0.65) {
      const nProg = Math.min(1.0, (progress - 0.65) / 0.35);
      const nx = cx + size * 0.32;
      const topY = cy - size * 0.48;
      // Left vertical stem
      paintOilStroke(nx, topY, nx, topY + Math.min(1.0, nProg * 1.5) * (size * 0.96), sw * 0.95, 5, -2);
      // Diagonal slash cutting across
      if (nProg > 0.30) {
        const diagU = (nProg - 0.30) / 0.70;
        paintOilStroke(nx, cy - size * 0.44, nx + diagU * (size * 0.40), (cy - size * 0.44) + diagU * (size * 0.92), sw * 1.05, 6, 3);
      }
      // Right vertical stem
      if (nProg > 0.50) {
        const rightU = (nProg - 0.50) / 0.50;
        paintOilStroke(nx + size * 0.40, topY, nx + size * 0.40, topY + rightU * (size * 0.96), sw * 0.95, 7, 2);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. RUSTIC RED OIL BRUSH LETTERS "IN" (under gate, matching 2-3)
  // ---------------------------------------------------------------------------
  public paintBlockLettersIn(cx: number, cy: number, size: number): void {
    const ctx = this.ctx;
    const sw = size * 0.24;

    const paintStrokeSimple = (x1: number, y1: number, x2: number, y2: number, w: number, seed: number) => {
      this.brush.paintStroke(x1, y1, x2, y2, w, '#c2410c', '#ea580c', '#7c2d12', false, false, seed, true);
    };

    ctx.save();
    // I
    const ix = cx - size * 0.22;
    paintStrokeSimple(ix, cy - size * 0.45, ix, cy + size * 0.45, sw * 1.05, 1);

    // N
    const nx = cx + size * 0.12;
    const nw = size * 0.38;
    paintStrokeSimple(nx, cy - size * 0.45, nx, cy + size * 0.45, sw * 0.95, 2);
    paintStrokeSimple(nx, cy - size * 0.42, nx + nw, cy + size * 0.45, sw * 0.98, 3);
    paintStrokeSimple(nx + nw, cy - size * 0.45, nx + nw, cy + size * 0.45, sw * 0.95, 4);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. AUTHENTIC FLAT-CHISEL CALLIGRAPHY GLYPH (Pure Ribbon Swept at 45° Angle)
  // ---------------------------------------------------------------------------
  public paintChiselGlyph(
    char: string,
    x: number,
    y: number,
    size: number,
    bodyColor: string = '#ea580c',
    accentColor: string = '#f97316',
    seed: number = 0,
  ): void {
    const ctx = this.ctx;
    const segments = CALLIGRAPHIC_GLYPHS[char.toUpperCase()];
    if (!segments) return;

    // Muscular flat-chisel nib width
    const nibWidth = Math.max(5.5, size * 0.24);
    const halfW = size * 0.36;
    const halfH = size * 0.48;
    // Nib held at classic 45° calligraphy angle
    const nibAngle = Math.PI * 0.25;
    const nibNx = Math.cos(nibAngle) * (nibWidth * 0.5);
    const nibNy = Math.sin(nibAngle) * (nibWidth * 0.5);

    ctx.save();

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      const x1 = x - halfW + seg.x1 * (halfW * 2);
      const y1 = y - halfH + seg.y1 * (halfH * 2);
      const x2 = x - halfW + seg.x2 * (halfW * 2);
      const y2 = y - halfH + seg.y2 * (halfH * 2);
      const cx = seg.type === 'curve' ? x - halfW + seg.cx * (halfW * 2) : 0;
      const cy = seg.type === 'curve' ? y - halfH + seg.cy * (halfH * 2) : 0;

      const numSteps = seg.type === 'curve' ? 24 : 16;
      const points: { x: number; y: number }[] = [];
      for (let st = 0; st <= numSteps; st++) {
        const u = st / numSteps;
        if (seg.type === 'line') {
          points.push({ x: x1 + u * (x2 - x1), y: y1 + u * (y2 - y1) });
        } else {
          const iu = 1 - u;
          points.push({
            x: iu * iu * x1 + 2 * iu * u * cx + u * u * x2,
            y: iu * iu * y1 + 2 * iu * u * cy + u * u * y2,
          });
        }
      }

      // Draw continuous flat-chisel ribbon connecting consecutive nib footprints
      ctx.fillStyle = bodyColor;
      for (let p = 0; p < points.length - 1; p++) {
        const p1 = points[p];
        const p2 = points[p + 1];

        const w1 = seg.widthScale;
        const w2 = seg.widthScale;

        ctx.beginPath();
        ctx.moveTo(p1.x - nibNx * w1, p1.y - nibNy * w1);
        ctx.lineTo(p1.x + nibNx * w1, p1.y + nibNy * w1);
        ctx.lineTo(p2.x + nibNx * w2, p2.y + nibNy * w2);
        ctx.lineTo(p2.x - nibNx * w2, p2.y - nibNy * w2);
        ctx.closePath();
        ctx.fill();
      }

      // Longitudinal dry-brush bristle striations along the ribbon
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.55;
      for (let b = -1; b <= 1; b += 2) {
        ctx.beginPath();
        for (let p = 0; p < points.length; p++) {
          const pt = points[p];
          const bx = pt.x + nibNx * (b * 0.45 * seg.widthScale);
          const by = pt.y + nibNy * (b * 0.45 * seg.widthScale);
          if (p === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5B. CLIMAX FIERY VERMILION COMPASS CALLIGRAPHY (matching 2-25)
  // "MIGHT DRAW ITS CIRCLE" & "AROUND"
  // ---------------------------------------------------------------------------
  public paintOrangeCompassArcText(
    text: string,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    fontSize: number = 68,
    isUprightConcave: boolean = false,
    bodyColor: string = '#ea580c',
    wetBlendColor: string = '#f97316',
  ): void {
    const ctx = this.ctx;
    const len = text.length;
    if (len === 0) return;

    ctx.save();
    for (let i = 0; i < len; i++) {
      const char = text[i];
      if (char === ' ') continue;
      const u = (i + 0.5) / len;
      const angle = startAngle + u * (endAngle - startAngle);

      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(px, py);
      if (isUprightConcave) {
        // Concave curve at bottom: letters are upright and readable (matching 2-25)
        ctx.rotate(angle - Math.PI / 2);
      } else {
        // Convex arch over top of circle: letters radial to curve
        ctx.rotate(angle + Math.PI / 2);
      }

      // Render flat-chisel calligraphy with custom body & wet blend colors
      this.paintChiselGlyph(
        char,
        0,
        0,
        fontSize,
        bodyColor,
        wetBlendColor,
        i * 17,
      );
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 6. BONE/WOOD IMPASTO CALLIGRAPHY (Act VII Opening: "SO A MIND THAT KNOWS" - matching 2-20)
  // ---------------------------------------------------------------------------
  public paintBoneWoodText(
    text: string,
    x: number,
    y: number,
    size: number,
  ): void {
    const lines = text.split('\n');
    const lineH = size * 1.15;
    const startY = y - ((lines.length - 1) * lineH) * 0.5;

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const chars = line.split('');
      const charSpacing = size * 0.68;
      const totalW = (chars.length - 1) * charSpacing;
      let curX = x - totalW * 0.5;
      const curY = startY + l * lineH;

      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch !== ' ') {
          this.paintGlyph(
            ch,
            curX,
            curY,
            size,
            '#fef3c7', // Cream bone-white core
            '#ffffff', // Wet titanium white highlight
            'rgba(15, 10, 5, 0.65)', // Deep umber drop shadow
            l * 100 + i * 11,
            true,
          );
        }
        curX += charSpacing;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 7. RUSTIC CHARCOAL SIGNBOARD LETTERING (Act II: "NEIGHBORS", "THEN", etc. - matching 2-3)
  // ---------------------------------------------------------------------------
  public paintCharcoalSignboardText(
    text: string,
    x: number,
    y: number,
    size: number,
  ): void {
    const chars = text.split('');
    const charSpacing = size * 0.70;
    const totalW = (chars.length - 1) * charSpacing;
    let curX = x - totalW * 0.5;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch !== ' ') {
        this.paintGlyph(
          ch,
          curX,
          y,
          size,
          '#1c1917', // Carbon black charcoal
          '#44403c', // Soft scumble
          undefined, // No shadow needed (direct on wood)
          i * 13,
          false,
        );
      }
      curX += charSpacing;
    }
  }

  // ---------------------------------------------------------------------------
  // 8. PURE WHITE IMPASTO WAVE TEXT "OVERSEA" (Act III: riding physical wave swells - matching 2-6)
  // ---------------------------------------------------------------------------
  public paintOverseaWaveText(
    text: string,
    x: number,
    y: number,
    size: number,
    t: number = 0,
  ): void {
    const chars = text.split('');
    const charSpacing = size * 0.72;
    const totalW = (chars.length - 1) * charSpacing;
    let curX = x - totalW * 0.5;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch !== ' ') {
        // Physical wave undulation: each letter heaves and pitches on the swell
        const waveBob = Math.sin(t * 2.4 + curX * 0.018) * 6.5;
        const waveTilt = Math.cos(t * 2.4 + curX * 0.018) * 0.06;
        const charY = y + waveBob;

        this.ctx.save();
        this.ctx.translate(curX, charY);
        this.ctx.rotate(waveTilt);
        this.paintChiselGlyph(
          ch,
          0,
          0,
          size,
          '#ffffff', // Pure brilliant titanium white impasto
          '#e0f2fe', // Pale ocean spray bristle highlight
          i * 23,
        );

        // Delicate white wave-crest spray foam around the base of the letter
        const foamBaseY = size * 0.45;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        for (let sp = 0; sp < 4; sp++) {
          const spX = (sp - 1.5) * (size * 0.20) + Math.sin(t * 5.0 + sp * 1.8) * 3;
          const spY = foamBaseY + Math.cos(t * 4.2 + sp * 2.1) * 2.8;
          const spR = 2.4 + (sp % 2) * 1.4;
          this.ctx.beginPath();
          this.ctx.arc(spX, spY, spR, 0, Math.PI * 2);
          this.ctx.fill();
        }

        this.ctx.restore();
      }
      curX += charSpacing;
    }
  }


  // ---------------------------------------------------------------------------
  // 5. SEAFOAM FROTH LETTERS "WHALES" (Sculpted from Billowing Sea Foam Bubbles)
  // ---------------------------------------------------------------------------
  public paintSeafoamText(
    text: string,
    x: number,
    y: number,
    size: number,
    t: number = 0,
  ): void {
    const ctx = this.ctx;
    const chars = text.split('');
    const charSpacing = size * 0.72;
    const totalW = (chars.length - 1) * charSpacing;
    let startX = x - totalW * 0.5;

    const waveBob = Math.sin(t * 1.8 + x * 0.02) * 5.0;

    ctx.save();
    ctx.translate(0, waveBob);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i].toUpperCase();
      const segments = CALLIGRAPHIC_GLYPHS[ch];
      if (segments && ch !== ' ') {
        const halfW = size * 0.36;
        const halfH = size * 0.48;

        for (let s = 0; s < segments.length; s++) {
          const seg = segments[s];
          const x1 = startX - halfW + seg.x1 * (halfW * 2);
          const y1 = y - halfH + seg.y1 * (halfH * 2);
          const x2 = startX - halfW + seg.x2 * (halfW * 2);
          const y2 = y - halfH + seg.y2 * (halfH * 2);
          const cx = seg.type === 'curve' ? startX - halfW + seg.cx * (halfW * 2) : 0;
          const cy = seg.type === 'curve' ? y - halfH + seg.cy * (halfH * 2) : 0;

          const steps = seg.type === 'curve' ? 14 : 10;
          for (let step = 0; step <= steps; step++) {
            const u = step / steps;
            let px: number, py: number;
            if (seg.type === 'line') {
              px = x1 + u * (x2 - x1);
              py = y1 + u * (y2 - y1);
            } else {
              const iu = 1 - u;
              px = iu * iu * x1 + 2 * iu * u * cx + u * u * x2;
              py = iu * iu * y1 + 2 * iu * u * cy + u * u * y2;
            }

            // Dense delicate bubbling seafoam clusters (matching 2-10 & 2-25)
            const puffCount = 2;
            for (let b = 0; b < puffCount; b++) {
              const bSeed = i * 500 + s * 50 + step * 7 + b;
              const r = Math.max(1.4, (size * 0.055) + this.brush.hash(bSeed * 13) * (size * 0.045));
              const ox = (this.brush.hash(bSeed * 17) - 0.5) * (size * 0.06);
              const oy = (this.brush.hash(bSeed * 23) - 0.5) * (size * 0.06);

              // Soft lilac/slate-grey under-shadow for bubble depth
              ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
              ctx.beginPath();
              ctx.arc(px + ox + 0.8, py + oy + 1.2, r * 1.05, 0, TAU);
              ctx.fill();

              // Thick creamy titanium white seafoam bubble body
              ctx.fillStyle = '#f8fafc';
              ctx.beginPath();
              ctx.arc(px + ox, py + oy, r, 0, TAU);
              ctx.fill();

              // Brilliant pure white top highlight
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(px + ox - r * 0.25, py + oy - r * 0.25, r * 0.65, 0, TAU);
              ctx.fill();
            }
          }
        }
      }
      startX += charSpacing;
    }

    ctx.restore();
  }
}

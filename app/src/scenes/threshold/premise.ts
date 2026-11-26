// Shared premise/typewriter utility for THRESHOLD.
// Used only by the Z1 long-form opening and the later Short; Z8 intentionally does not use it.
import { clamp, sm } from './kit';

export const PREMISE_TEXT = 'every room down here is a different world';
export const PREMISE_CHARS_PER_SECOND = 18;
export const PREMISE_SIZE_1080 = 48;

export interface TypeState {
  visibleChars: number;
  cursor: boolean;
  alpha: number;
}

export function premiseTypeAt(
  t: number,
  start: number,
  charsPerSecond = PREMISE_CHARS_PER_SECOND,
  holdSeconds = 2,
  fadeSeconds = 0.6,
): TypeState {
  const local = t - start;
  if (local < 0) return { visibleChars: 0, cursor: false, alpha: 0 };
  const typeDur = PREMISE_TEXT.length / charsPerSecond;
  const visibleChars = clamp(Math.floor(local * charsPerSecond), 0, PREMISE_TEXT.length);
  const fadeIn = sm(0, 0.12, local);
  const fadeOut = 1 - sm(typeDur + holdSeconds, typeDur + holdSeconds + fadeSeconds, local);
  return {
    visibleChars,
    cursor: local < typeDur + holdSeconds && Math.floor(local * 2.2) % 2 === 0,
    alpha: fadeIn * fadeOut,
  };
}

/**
 * Canonical premise typography. Placement, size, colour, speed and shadow are fixed by
 * looks.md §1.6 so the long-form opening and the Short cannot diverge.
 */
export function drawPremiseLine(
  g: CanvasRenderingContext2D,
  t: number,
  start: number,
  x?: number,
  y?: number,
  maxWidth?: number,
): void {
  void maxWidth; // accepted for migration compatibility; canonical type size is never rescaled
  const s = premiseTypeAt(t, start);
  if (s.alpha <= 0) return;
  const width = g.canvas.width;
  const height = g.canvas.height;
  const scale = height / 1080;
  const fontPx = Math.round(PREMISE_SIZE_1080 * scale);
  x ??= Math.round(width * 0.065);
  y ??= Math.round(height * 0.79);
  const text = PREMISE_TEXT.slice(0, s.visibleChars) + (s.cursor ? '▌' : '');
  g.save();
  g.globalAlpha = s.alpha * 0.9;
  g.font = `400 ${fontPx}px "IBM Plex Mono", "Courier Prime", "Courier New", monospace`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.65)';
  g.shadowBlur = Math.max(1, 2 * scale);
  g.shadowOffsetX = 0;
  g.shadowOffsetY = Math.max(1, 2 * scale);
  g.fillStyle = '#EDE8DC';
  g.fillText(text, x, y);
  g.restore();
}

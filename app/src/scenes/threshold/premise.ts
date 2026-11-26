// Shared premise/typewriter utility for THRESHOLD.
// Used only by the Z1 long-form opening and the later Short; Z8 intentionally does not use it.
import { clamp, sm } from './kit';

export const PREMISE_TEXT = 'every room down here is a different world';

export interface TypeState {
  visibleChars: number;
  cursor: boolean;
  alpha: number;
}

export function premiseTypeAt(t: number, start: number, charsPerSecond = 24, holdSeconds = 2, fadeSeconds = 0.6): TypeState {
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

/** Draw in logical Canvas2D pixels. The caller owns clearing/uploading its Layer2D. */
export function drawPremiseLine(
  g: CanvasRenderingContext2D,
  t: number,
  start: number,
  x: number,
  y: number,
  maxWidth = 760,
): void {
  const s = premiseTypeAt(t, start);
  if (s.alpha <= 0) return;
  const text = PREMISE_TEXT.slice(0, s.visibleChars) + (s.cursor ? '▌' : '');
  g.save();
  g.globalAlpha = s.alpha;
  g.font = '500 31px "IBM Plex Mono", "Courier New", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.72)';
  g.shadowBlur = 10;
  g.shadowOffsetY = 2;
  g.fillStyle = 'rgba(229,226,214,0.94)';
  const metrics = g.measureText(text);
  const scale = Math.min(1, maxWidth / Math.max(1, metrics.width));
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillText(text, 0, 0);
  g.restore();
}

// Universal 3D Kinetic Lyric Rig for 'No Takebacks'
// Provides word-level karaoke highlighting, 3D projection anchoring,
// optical size clamping (24px - 72px), knockout halos, and diegetic confidence glitching.

import * as THREE from 'three';
import lyricsJson from '../../data/lyrics.json';
import { ViewportSpace } from '../../engine/viewport';
import { clamp, ease } from '../../engine/util';

export interface WordData {
  w: string;
  start: number;
  end: number;
  conf?: number;
}

export interface LineData {
  i: number;
  text: string;
  start: number;
  end: number;
  words: WordData[];
}

export const ALL_LINES: LineData[] = lyricsJson.lines as LineData[];

export interface LyricRenderOpts {
  worldPos: [number, number, number];
  cam: THREE.Camera;
  t: number;
  lineIdx: number;
  fontFamily?: string;
  fontSize?: number;
  baseColor?: string;
  highlightColor?: string;
  haloColor?: string;
  leadInTime?: number;
  leadOutTime?: number;
  align?: 'left' | 'center' | 'right';
  yOffsetPx?: number;
}

export class LyricRig {
  static getLine(idx: number): LineData | undefined {
    return ALL_LINES[idx];
  }

  static getLinesForAct(startIdx: number, endIdx: number): LineData[] {
    return ALL_LINES.slice(startIdx, endIdx + 1);
  }

  /**
   * Renders a 3D-anchored kinetic lyric line onto a 2D canvas context.
   * Guarantees optical legibility via min/max font clamping and knockout halo.
   */
  static renderLine(
    ctx: CanvasRenderingContext2D,
    opts: LyricRenderOpts,
  ): { visible: boolean; screenX: number; screenY: number; effFontSize: number } | null {
    const line = ALL_LINES[opts.lineIdx];
    if (!line) return null;

    const leadIn = opts.leadInTime ?? 0.45;
    const leadOut = opts.leadOutTime ?? 0.65;
    const t = opts.t;

    // Check temporal visibility
    if (t < line.start - leadIn || t > line.end + leadOut) {
      return null;
    }

    // Ensure camera world matrix is up to date for projection
    opts.cam.updateMatrixWorld(true);

    // 3D to Screen projection: returns [screenX, screenY, viewZ] | null
    const v3Pos: [number, number, number] = [opts.worldPos[0], opts.worldPos[1], opts.worldPos[2]];
    const proj = ViewportSpace.worldToScreen(v3Pos, opts.cam);
    if (!proj) return null;

    const [screenX, rawScreenY, depthZ] = proj;

    // Overall line envelope alpha
    let alpha = 1.0;
    if (t < line.start) {
      const u = (t - (line.start - leadIn)) / leadIn;
      alpha = ease.outCubic(clamp(u, 0, 1));
    } else if (t > line.end) {
      const u = (t - line.end) / leadOut;
      alpha = 1.0 - ease.inQuad(clamp(u, 0, 1));
    }

    if (alpha <= 0.005) return null;

    // Optical clamping: clamp effective font size between 26px and 68px
    const baseFontSize = opts.fontSize ?? 44;
    const depthScale = 14.0 / Math.max(2.0, depthZ);
    const unconstrained = baseFontSize * depthScale;
    const effFontSize = clamp(unconstrained, 26, 68);

    const fontFamily = opts.fontFamily ?? 'Archivo, system-ui, sans-serif';
    const baseColor = opts.baseColor ?? 'rgba(241, 245, 249, 0.45)';
    const highlightColor = opts.highlightColor ?? '#f59e0b';
    const haloColor = opts.haloColor ?? 'rgba(10, 12, 16, 0.95)';
    const align = opts.align ?? 'center';

    ctx.save();
    ctx.font = `700 ${Math.round(effFontSize)}px ${fontFamily}`;
    ctx.textBaseline = 'middle';

    const spaceWidth = ctx.measureText(' ').width;
    const wordWidths = line.words.map((w) => ctx.measureText(w.w).width);

    // Group words into lines that fit within maxWidth (max 1500px)
    const MAX_LINE_WIDTH = 1500;
    interface RenderChunk {
      words: { word: WordData; width: number; idx: number }[];
      totalWidth: number;
    }
    const chunks: RenderChunk[] = [];
    let currentChunk: RenderChunk = { words: [], totalWidth: 0 };

    for (let wi = 0; wi < line.words.length; wi++) {
      const w = line.words[wi]!;
      const wWidth = wordWidths[wi]!;
      const addedWidth = currentChunk.words.length === 0 ? wWidth : spaceWidth + wWidth;

      if (currentChunk.totalWidth + addedWidth > MAX_LINE_WIDTH && currentChunk.words.length > 0) {
        chunks.push(currentChunk);
        currentChunk = { words: [{ word: w, width: wWidth, idx: wi }], totalWidth: wWidth };
      } else {
        currentChunk.words.push({ word: w, width: wWidth, idx: wi });
        currentChunk.totalWidth += addedWidth;
      }
    }
    if (currentChunk.words.length > 0) {
      chunks.push(currentChunk);
    }

    const lineHeight = effFontSize * 1.25;
    const totalBlockHeight = chunks.length * lineHeight;
    const baseY = rawScreenY + (opts.yOffsetPx ?? 0) - (totalBlockHeight / 2) + (lineHeight / 2);

    // Clamp screenX safely inside canvas title-safe bounds [160, 1760]
    const clampedScreenX = clamp(screenX, 200, 1720);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]!;
      const lineY = baseY + ci * lineHeight;

      let curX = clampedScreenX;
      if (align === 'center') curX -= chunk.totalWidth / 2;
      else if (align === 'right') curX -= chunk.totalWidth;

      // Ensure curX doesn't clip off left margin
      if (curX < 120) curX = 120;
      if (curX + chunk.totalWidth > 1800) curX = 1800 - chunk.totalWidth;

      for (let cwi = 0; cwi < chunk.words.length; cwi++) {
        const item = chunk.words[cwi]!;
        const word = item.word;
        const wWidth = item.width;
        const wi = item.idx;

        // Determine word highlight progress
        let wordProgress = 0.0;
        if (t >= word.start) {
          if (t >= word.end) {
            wordProgress = 1.0;
          } else {
            wordProgress = (t - word.start) / Math.max(0.001, word.end - word.start);
          }
        }

        // Word color: interpolate from base to highlight
        let fillColor = baseColor;
        let wordScale = 1.0;
        let wordAlpha = alpha;

        if (t >= word.start && t < word.end) {
          // Active sung word: scale punch and bright highlight
          const punch = Math.sin(wordProgress * Math.PI) * 0.12;
          wordScale += punch;
          fillColor = highlightColor;
        } else if (t >= word.end) {
          // Completed sung word: crisp readable fill
          fillColor = 'rgba(255, 255, 255, 0.95)';
        }

        // Diegetic confidence jitter (words with conf < 0.5 get subtle displacement)
        let jitterX = 0;
        let jitterY = 0;
        if (word.conf && word.conf < 0.5 && t >= word.start && t < word.end + 0.3) {
          const hash = Math.sin(t * 120.0 + wi * 37.1);
          jitterX = hash * 2.0;
          jitterY = Math.cos(t * 90.0) * 1.2;
        }

        // Draw Knockout Understroke (clean, high-contrast, zero clipping)
        ctx.lineWidth = Math.max(4.0, effFontSize * 0.14);
        ctx.strokeStyle = haloColor;
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = wordAlpha;

        ctx.save();
        ctx.translate(curX + wWidth / 2 + jitterX, lineY + jitterY);
        if (wordScale !== 1.0) {
          ctx.scale(wordScale, wordScale);
        }
        ctx.strokeText(word.w, -wWidth / 2, 0);
        ctx.fillText(word.w, -wWidth / 2, 0);
        ctx.restore();

        curX += wWidth + spaceWidth;
      }
    }

    ctx.restore();

    return {
      visible: true,
      screenX: clampedScreenX,
      screenY: baseY,
      effFontSize,
    };
  }
}

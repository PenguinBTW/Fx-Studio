// =============================================================================
// BEAT 3: THE SAME LOCK, EVERYWHERE (30.0s - 58.0s)
//
// Procedural Zoom-Fold recursive fragment shader:
// - Self-similar hierarchy: input node and output node each contain child Gs
// - Grid expansion revealing dense lattice of interlocks (field of stars / city windows)
// - Constant screen-space 2px line thickness (pure mathematical filigree)
// - Tiny red pinpoints at every gap (< 1.5% pixels)
// - 6 Pictograms inside readable nodes: DOOR, PAYMENT, STEERING, FEED, BORDER, BUTTON
// - Monospace label at lower-left, exponential counter at bottom-right
// - Climax at 53-58s: resolves into ONE single, enormous G filling 75% of frame
// - At 58.0s: drops into dim state (lines -> ash, red -> 40% brightness)
// =============================================================================

import * as THREE from 'three';
import { FSPass, W, H } from '../../engine/gl';
import { clamp, lerp, ease, prog } from '../../engine/util';
import { SDF_GLSL } from './sdfs';
import { font, F } from '../../engine/type';
import { rgba } from './palette';

export class Beat3ZoomFold {
  pass: FSPass;

  // The 6 Pictograms metadata
  static readonly PICTOGRAMS = [
    { name: 'DOOR', tCenter: 34.0 },
    { name: 'PAYMENT', tCenter: 38.0 },
    { name: 'STEERING', tCenter: 42.0 },
    { name: 'FEED', tCenter: 46.0 },
    { name: 'BORDER', tCenter: 50.0 },
    { name: 'BUTTON', tCenter: 52.5 },
  ];

  constructor() {
    this.pass = new FSPass(
      /* glsl */ `
      ${SDF_GLSL}

      uniform float t;
      uniform float zoomScale;     // grid zoom scale (1.0 to 18.0)
      uniform float rotationAngle; // slow camera rotation (<= 4 deg)
      uniform float dimState;      // 0.0 (normal) -> 1.0 (dim at t >= 58s)
      uniform float giantGLerp;    // 0.0 -> 1.0 (climax resolution at 53-58s)
      uniform int activePicIdx;    // 0..5 or -1
      uniform float picAlpha;      // 0.0 -> 1.0
      uniform vec2 res;

      // Evaluates a single canonical Interlock Glyph G at coordinate p
      // Returns distance and flags if nearest feature is the red gap blocker
      float sdGlyph(vec2 p, out float outIsRed) {
        outIsRed = 0.0;

        float x0 = 0.44;
        float rNode = 0.16;
        float gapW = 0.055;

        // 1. Input Node on Left (Circle)
        float dInput = abs(length(p - vec2(-x0, 0.0)) - rNode);

        // 2. Output Node on Right (Square)
        vec2 dSqP = abs(p - vec2(x0, 0.0)) - vec2(rNode);
        float dOutput = abs(max(dSqP.x, dSqP.y));

        // 3. Connecting Line Segments
        float dLineL = sdSegment(p, vec2(-x0 + rNode, 0.0), vec2(-gapW, 0.0));
        float dLineR = sdSegment(p, vec2(gapW, 0.0), vec2(x0 - rNode, 0.0));
        float dLines = min(dLineL, dLineR);

        // Inter-cell bus connections to left and right neighbor cells
        float dConnL = sdSegment(p, vec2(-0.62, 0.0), vec2(-x0 - rNode, 0.0));
        float dConnR = sdSegment(p, vec2(x0 + rNode, 0.0), vec2(0.62, 0.0));
        float dConns = min(dConnL, dConnR);

        float dBone = min(min(dInput, dOutput), min(dLines, dConns));

        // 4. Severed Connection: The Red Blocker Bar in the Gap
        // Local half-size in glyph space: 0.0055 wide, 0.038 tall
        float dBlocker = sdBox(p, vec2(0.0055, 0.038));

        if (dBlocker < dBone) {
          outIsRed = 1.0;
          return dBlocker;
        }
        return dBone;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;

        // Subtle camera rotation (<= 4 degrees total = 0.06 rad)
        mat2 rot = rot2(rotationAngle);
        uv = rot * uv;

        vec3 cVoid = C_INK;
        vec3 cBone = C_BONE;
        vec3 cAsh = C_GRAPHITE;
        vec3 cSignal = C_SIGNAL;

        // Dim state transition at 58.0s: lines -> ash, red -> 40% brightness
        vec3 activeBone = mix(cBone, cAsh, dimState);
        vec3 activeSignal = mix(cSignal, cSignal * 0.40, dimState);

        // Smooth continuous exponential zoom-out
        vec2 p = uv * zoomScale * 1.15;

        // Tiled domain repetition for infinite planar circuit of interlocks
        vec2 cellSize = vec2(1.24, 0.62);
        vec2 cellId = floor((p + cellSize * 0.5) / cellSize);
        vec2 cellP = p - cellId * cellSize;

        float isRed = 0.0;
        float d = sdGlyph(cellP, isRed);

        // Sub-nodes inside input circle and output square (if zoomScale < 6.0)
        if (zoomScale < 6.0) {
          vec2 pL = (cellP - vec2(-0.44, 0.0)) * 2.75;
          float isRedL = 0.0;
          float dL = sdGlyph(pL, isRedL) / 2.75;
          if (dL < d) { d = dL; isRed = isRedL; }

          vec2 pR = (cellP - vec2(0.44, 0.0)) * 2.75;
          float isRedR = 0.0;
          float dR = sdGlyph(pR, isRedR) / 2.75;
          if (dR < d) { d = dR; isRed = isRedR; }
        }

        // Screen-space constant 2px line thickness via fwidth
        float px = fwidth(p.x);
        float lineThick = px * 1.0;
        float bThick = max(0.0, px * 0.8 - 0.0055);

        float dist = (isRed > 0.5) ? (d - bThick) : (abs(d) - lineThick);
        float aa = fwidth(dist) * 1.5;
        float stroke = 1.0 - smoothstep(0.0, aa, dist);

        float boneWeight = (isRed > 0.5) ? 0.0 : stroke;
        float redWeight = (isRed > 0.5) ? stroke : 0.0;

        // Active SDF Pictogram and Readable Cell
        // Resolves crisply in foreground during its readable zoom window
        if (activePicIdx >= 0 && picAlpha > 0.001) {
          vec2 pCell = uv * 1.45;
          float isCellRed = 0.0;
          float dCell = sdGlyph(pCell, isCellRed);

          vec2 pPic = (pCell - vec2(-0.44, 0.0)) * 3.6;
          float isPicRed = 0.0;
          float dPic = 100.0;

          if (activePicIdx == 0) dPic = sdPictogramDoor(pPic, isPicRed);
          else if (activePicIdx == 1) dPic = sdPictogramPayment(pPic, isPicRed);
          else if (activePicIdx == 2) dPic = sdPictogramSteering(pPic, isPicRed);
          else if (activePicIdx == 3) dPic = sdPictogramFeed(pPic, isPicRed);
          else if (activePicIdx == 4) dPic = sdPictogramBorder(pPic, isPicRed);
          else if (activePicIdx == 5) dPic = sdPictogramButton(pPic, isPicRed);

          float dPicScaled = dPic / 3.6;
          if (dPicScaled < dCell) {
            dCell = dPicScaled;
            isCellRed = isPicRed;
          }

          float pxC = fwidth(pCell.x);
          float distC = (isCellRed > 0.5) ? (dCell - 0.0035) : (abs(dCell) - pxC * 1.0);
          float aaC = fwidth(distC) * 1.5;
          float strokeC = 1.0 - smoothstep(0.0, aaC, distC);

          float picBone = (isCellRed > 0.5) ? 0.0 : strokeC;
          float picRed = (isCellRed > 0.5) ? strokeC : 0.0;

          // 100% clean knockout of background lattice directly behind readable cell bounds
          float dBox = sdBox(uv, vec2(0.62, 0.30));
          float centerMask = 1.0 - smoothstep(0.0, 0.08, dBox);
          boneWeight = mix(boneWeight, 0.0, centerMask * picAlpha);
          redWeight = mix(redWeight, 0.0, centerMask * picAlpha);

          boneWeight = max(boneWeight, picBone * picAlpha);
          redWeight = max(redWeight, picRed * picAlpha);
        }

        // Climax (53.0s - 58.0s): Whole lattice locks into ONE single enormous G
        if (giantGLerp > 0.001) {
          float isGiantRed = 0.0;
          vec2 pGiant = uv * 1.25; // fills ~75% of frame width
          float dG = sdGlyph(pGiant, isGiantRed);
          float pxG = fwidth(pGiant.x);
          float distG = (isGiantRed > 0.5) ? dG : (abs(dG) - pxG * 1.0);
          float aaG = fwidth(distG) * 1.5;
          float giantStroke = 1.0 - smoothstep(0.0, aaG, distG);

          float gBone = (isGiantRed > 0.5) ? 0.0 : giantStroke;
          float gRed = (isGiantRed > 0.5) ? giantStroke : 0.0;

          boneWeight = mix(boneWeight, gBone, giantGLerp);
          redWeight = mix(redWeight, gRed, giantGLerp);
        }

        // Color Composition
        boneWeight = clamp(boneWeight, 0.0, 1.0);
        redWeight = clamp(redWeight, 0.0, 1.0);

        vec3 col = cVoid;
        col = mix(col, activeBone, boneWeight);
        col = mix(col, activeSignal, redWeight);

        // Soft emissive bloom on red gap
        if (redWeight > 0.05) {
          col += activeSignal * redWeight * 0.40;
        }

        fragColor = vec4(col, 1.0);
      }`,
      {
        t: { value: 0 },
        zoomScale: { value: 1.0 },
        rotationAngle: { value: 0.0 },
        dimState: { value: 0.0 },
        giantGLerp: { value: 0.0 },
        activePicIdx: { value: -1 },
        picAlpha: { value: 0.0 },
        res: { value: new THREE.Vector2(W, H) },
      }
    );
  }

  /**
   * Updates Beat 3 uniforms and computes telemetry.
   */
  update(t: number): {
    zoomScale: number;
    rotationAngle: number;
    dimState: number;
    interlockCount: number;
    activePictogram: { name: string; alpha: number } | null;
  } {
    // 1. Grid Zoom Scale (1.0 to 18.0 over 22s from 30.0 to 52.0s)
    const u = clamp((t - 30.0) / 28.0);
    const easeU = ease.inOutCubic(u);
    const uGrid = ease.inOutCubic(clamp((t - 30.0) / 22.0));
    const zoomScale = lerp(1.0, 18.0, uGrid);

    // 2. Slow Camera Rotation (<= 4 degrees = 0.060 rad)
    const rotationAngle = 0.060 * Math.sin(u * Math.PI);

    // 3. Giant G Climax Lerp (53.5 to 56.5s)
    const giantGLerp = prog(t, 53.5, 56.5, ease.inOutCubic);

    // 4. Dim state at t >= 58.0s
    const dimState = prog(t, 57.8, 58.5, ease.inOutQuad);

    // 5. Active Pictogram Window (fades in 0.3s, holds, fades out 0.3s)
    let activePicIdx = -1;
    let picAlpha = 0.0;
    let activePictogram: { name: string; alpha: number } | null = null;

    for (let i = 0; i < Beat3ZoomFold.PICTOGRAMS.length; i++) {
      const pic = Beat3ZoomFold.PICTOGRAMS[i]!;
      const tIn = pic.tCenter - 0.9;
      const tPeakStart = pic.tCenter - 0.6;
      const tPeakEnd = pic.tCenter + 0.6;
      const tOut = pic.tCenter + 0.9;
      if (t >= tIn && t <= tOut) {
        activePicIdx = i;
        if (t < tPeakStart) {
          picAlpha = prog(t, tIn, tPeakStart, ease.outCubic);
        } else if (t <= tPeakEnd) {
          picAlpha = 1.0;
        } else {
          picAlpha = 1.0 - prog(t, tPeakEnd, tOut, ease.inCubic);
        }
        activePictogram = { name: pic.name, alpha: picAlpha };
        break;
      }
    }

    // Update Uniforms
    const uPass = this.pass.u;
    uPass.t!.value = t;
    uPass.zoomScale!.value = zoomScale;
    uPass.rotationAngle!.value = rotationAngle;
    uPass.giantGLerp!.value = giantGLerp;
    uPass.dimState!.value = dimState;
    uPass.activePicIdx!.value = activePicIdx;
    uPass.picAlpha!.value = picAlpha;

    // 6. Exponential Counter: 1, 6, 36, 216 ... 1,000,000
    const countFloat = Math.min(1000000, Math.round(Math.pow(6.0, easeU * 7.71)));
    const interlockCount = Math.max(1, countFloat);

    return {
      zoomScale,
      rotationAngle,
      dimState,
      interlockCount,
      activePictogram,
    };
  }

  /**
   * Renders the bottom-right running counter and active pictogram label.
   * Monospace, letter-spaced +0.12em, --ash at 60% opacity.
   * Strictly no extra text or decorative headers.
   */
  drawTelemetry(
    c: CanvasRenderingContext2D,
    t: number,
    interlockCount: number,
    activePic: { name: string; alpha: number } | null
  ): void {
    c.save();

    // Bottom-right exponential counter (only the tally, no extra text)
    c.textAlign = 'right';
    c.font = font(F.mono(500), 20);
    c.shadowColor = '#050506';
    c.shadowBlur = 10;
    c.fillStyle = rgba('ash', 0.85);
    c.letterSpacing = '0.12em';
    c.fillText(interlockCount.toLocaleString('en-US'), W - 80, H - 64);

    // Active pictogram monospace tag at lower-left of cell
    if (activePic && activePic.alpha > 0.05) {
      c.textAlign = 'left';
      c.font = font(F.mono(500), 16);
      c.shadowColor = '#050506';
      c.shadowBlur = 10;
      c.letterSpacing = '0.15em';
      c.fillStyle = rgba('bone', 0.90 * activePic.alpha);
      c.fillText(activePic.name, W / 2 - 0.55 * H, H / 2 + 0.24 * H);
    }

    c.restore();
  }
}

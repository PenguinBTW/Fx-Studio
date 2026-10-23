// =============================================================================
// SCENE: "THE INTERLOCK" (Child Lock Video, Act II -> Act IV Bridge)
// 0.0s - 72.0s Continuous Procedural Master Scene
//
// Directed to the strict brief in child-lock-scene-prompt.md:
// - Beat 0 (0.0 - 8.0s): The Switch (Car door edge, brushed metal, 5.2s click, red sliver)
// - Beat 1 (8.0 - 20.0s): The Handle That Still Works (3 pulls, traveling pulse, red flare & sparks)
// - Beat 2 (20.0 - 30.0s): Abstraction (Dissolve front, dolly-zoom to orthographic Interlock Glyph G)
// - Beat 3 (30.0 - 58.0s): The Same Lock, Everywhere (Zoom-fold IFS 10^6 zoom, 6 pictograms, counter)
// - Beat 4 (58.0 - 72.0s): The Inversion (20k-particle human, reach, pulse, reverse to halfway knob, cut)
//
// PALETTE STRICT RULE:
// --void: #050506 (background)
// --bone: #E8E4DA (primary geometry, lines, particles)
// --ash: #6B6A66 (secondary lines, labels, dim states)
// --signal: #FF2A1F (ONLY severed connections / gaps — nowhere else, ever)
// =============================================================================

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, W, H } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { clamp, lerp, ease, prog } from '../../engine/util';
import { HEX, LIN } from './palette';
import { Beat0Switch } from './beat0_switch';
import { Beat1Mechanism } from './beat1_mechanism';
import { Beat3ZoomFold } from './beat3_zoomfold';
import { Beat4Inversion } from './beat4_inversion';

export default class TheInterlockScene extends Scene {
  // Sub-systems
  private beat0 = new Beat0Switch();
  private beat1 = new Beat1Mechanism();
  private beat3 = new Beat3ZoomFold();
  private beat4 = new Beat4Inversion();

  // Three.js 3D rendering setup (used in Beats 0, 1, 2, 4)
  private scene3D = new THREE.Scene();
  private camera3D = new THREE.PerspectiveCamera(26, W / H, 0.005, 100);

  // Line Batches for procedural pulses and sparks (3D and 2D)
  private pulseBatch = new LineBatch(10000, { blend: 'add' });
  private sparkBatch = new LineBatch(10000, { blend: 'add' });
  private lineBatch2D = new LineBatch(10000, { blend: 'max', screen2D: true });

  // 2D Text / Telemetry Layer
  private hudLayer = new Layer2D();

  override async init(): Promise<void> {
    this.scene3D.background = new THREE.Color(HEX.void);

    // Add modular components to 3D scene
    this.scene3D.add(this.beat0.group);
    this.scene3D.add(this.beat1.group);
    this.scene3D.add(this.beat4.group);

    // Initial offsets
    this.beat1.group.position.set(0, 0, -0.02);
    this.beat4.group.position.set(0, 0, 0);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;

    // Hard clean cut to pure black at t >= 72.0s
    if (t >= 72.0) {
      renderer.setRenderTarget(out);
      renderer.setClearColor(0x050506, 1.0);
      renderer.clear();
      return { exposure: 0.0, fade: 1.0, bloom: 0.0 };
    }

    this.pulseBatch.clear();
    this.sparkBatch.clear();
    this.lineBatch2D.clear();

    let postOverrides: PostOverrides = {
      bloom: 0.60,
      bloomThreshold: 0.80,
      bloomRadius: 0.50,
      vignette: 0.25,
      grain: 0.035,
      ca: 0.35,
    };

    // =========================================================================
    // BEAT 0: THE SWITCH (0.0s - 8.0s)
    // =========================================================================
    if (t < 8.0) {
      this.beat0.group.visible = true;
      this.beat1.group.visible = false;
      this.beat4.group.visible = false;

      const { cameraZ } = this.beat0.update(t, false);

      this.camera3D.fov = 26.0; // 85mm-equivalent macro
      this.camera3D.updateProjectionMatrix();
      this.camera3D.position.set(-0.005, 0, cameraZ);
      this.camera3D.lookAt(-0.005, 0, 0);

      renderer.setRenderTarget(out);
      renderer.render(this.scene3D, this.camera3D);

      postOverrides = {
        ...postOverrides,
        exposure: 1.0,
        bloom: 0.55,
        ca: 0.20,
      };
    }

    // =========================================================================
    // BEAT 1 & 2: THE HANDLE & ABSTRACTION (8.0s - 30.0s)
    // =========================================================================
    else if (t < 30.0) {
      // Transition from slot through to interior mechanism at 8.0 - 9.8s
      const uEnter = prog(t, 8.0, 9.8, ease.inOutCubic);
      this.beat0.group.visible = uEnter < 0.99;
      this.beat1.group.visible = true;
      this.beat4.group.visible = false;

      const mech = this.beat1.update(t);

      // Camera flight: glide through slot into mechanism, then orbit and push in
      if (t < 9.8) {
        const camZ = lerp(0.165, 0.02, uEnter);
        const camX = lerp(-0.005, -0.05, uEnter);
        this.camera3D.position.set(camX, 0, camZ);
        this.camera3D.lookAt(-0.04, 0, 0);
        this.camera3D.fov = 34.0;
      } else {
        this.camera3D.position.set(...mech.camPos);
        this.camera3D.lookAt(...mech.camTarget);
        this.camera3D.fov = mech.camFov;
      }
      this.camera3D.updateProjectionMatrix();

      // Render 3D solid mechanism with CAD wireframe edges
      renderer.setRenderTarget(out);
      renderer.render(this.scene3D, this.camera3D);

      // Render traveling pulse and falling sparks via LineBatches
      this.renderPulseAndSparks(mech.activePulse, mech.sparks, mech.gapFlare, mech.rodTipPos);
      this.pulseBatch.render(renderer, out);
      this.sparkBatch.render(renderer, out);

      // Beat 2 Abstraction: As dissolve finishes (t >= 26.0s), draw flat 2D Interlock Glyph G
      if (t >= 26.0) {
        const glyphAlpha = prog(t, 26.0, 27.5, ease.outCubic);
        this.drawInterlockGlyph2D(glyphAlpha, 1.0);
        this.lineBatch2D.render(renderer, out);
      }

      postOverrides = {
        ...postOverrides,
        bloom: 0.60 + 0.30 * mech.gapFlare,
        bloomThreshold: 0.78,
        ca: 0.30 + 0.15 * mech.gapFlare,
      };
    }

    // =========================================================================
    // BEAT 3: THE SAME LOCK, EVERYWHERE (30.0s - 58.0s)
    // =========================================================================
    else if (t < 58.0) {
      this.beat0.group.visible = false;
      this.beat1.group.visible = false;
      this.beat4.group.visible = false;

      const zf = this.beat3.update(t);
      this.beat3.pass.render(renderer, out);

      // Draw bottom-right exponential counter and pictogram tags
      const hCtx = this.hudLayer.ctx;
      this.hudLayer.clear();
      this.beat3.drawTelemetry(hCtx, t, zf.interlockCount, zf.activePictogram);
      hCtx.setTransform(1, 0, 0, 1, 0, 0);
      comp.draw(renderer, this.hudLayer.upload(), out);

      // Radial motion blur and chromatic aberration proportional to zoom speed
      const uMid = prog(t, 30.0, 58.0);
      const zoomSpeed = Math.sin(uMid * Math.PI);

      postOverrides = {
        ...postOverrides,
        bloom: lerp(0.55, 0.40, zf.dimState),
        bloomThreshold: 0.80,
        ca: lerp(0.35, 1.35, zoomSpeed),
        vignette: 0.25 + 0.10 * zoomSpeed,
      };
    }

    // =========================================================================
    // BEAT 4: THE INVERSION (58.0s - 72.0s)
    // =========================================================================
    else {
      const inv = this.beat4.update(t);

      // 58.0 - 67.0s: The 20,000-particle human figure & reach
      if (t < 67.0) {
        this.beat0.group.visible = false;
        this.beat1.group.visible = false;
        this.beat4.group.visible = true;

        // Slow zoom in on input circle resolving into full standing human figure
        const uZoomIn = prog(t, 58.0, 62.5, ease.inOutCubic);
        const camZ = lerp(1.40, 1.05, uZoomIn);
        this.camera3D.position.set(0.18, 0.0, camZ);
        this.camera3D.lookAt(0.18, 0.0, 0);
        this.camera3D.fov = 34.0;
        this.camera3D.updateProjectionMatrix();

        renderer.setRenderTarget(out);
        renderer.render(this.scene3D, this.camera3D);

        // Draw 2D Interlock line from reaching hand to red gap blocker
        this.drawInterlockLineToGap(inv.gapFlare);
        this.lineBatch2D.render(renderer, out);

        // Render traveling pulse and falling sparks
        this.renderPulseAndSparks(inv.activePulse, inv.sparks, inv.gapFlare, this.beat4.gapPos);
        this.pulseBatch.render(renderer, out);
        this.sparkBatch.render(renderer, out);

        postOverrides = {
          ...postOverrides,
          bloom: 0.55 + 0.35 * inv.gapFlare,
          ca: 0.35 + 0.20 * inv.gapFlare,
        };
      }
      // 70.0 - 72.0s: Hold halfway knob. Hard clean cut to pure black at t >= 72.0s
      else if (t >= 72.0) {
        this.beat0.group.visible = false;
        this.beat1.group.visible = false;
        this.beat4.group.visible = false;
        renderer.setRenderTarget(out);
        renderer.setClearColor(HEX.void, 1.0);
        renderer.clear();
        return {
          bloom: 0.0,
          ca: 0.0,
          vignette: 0.0,
        };
      } else {
        this.beat4.group.visible = false;
        this.beat1.group.visible = false;
        this.beat0.group.visible = true;

        // Fast reverse pullback: slider knob resting EXACTLY halfway (0.50)
        this.beat0.update(t, true);

        const uPull = prog(t, 67.0, 70.0, ease.inOutCubic);
        const camZ = lerp(0.04, 0.165, uPull);
        this.camera3D.position.set(-0.005, 0, camZ);
        this.camera3D.lookAt(-0.005, 0, 0);
        this.camera3D.fov = 26.0;
        this.camera3D.updateProjectionMatrix();

        renderer.setRenderTarget(out);
        renderer.render(this.scene3D, this.camera3D);

        postOverrides = {
          ...postOverrides,
          bloom: 0.55,
          ca: 0.20,
        };
      }
    }

    return postOverrides;
  }

  /**
   * Projects and renders pulse & spark segments into LineBatch
   */
  private renderPulseAndSparks(
    pulse: { p0: [number, number, number]; p1: [number, number, number]; intensity: number } | null,
    sparks: { p0: [number, number, number]; p1: [number, number, number]; alpha: number }[],
    gapFlare: number,
    gapCenter: [number, number, number]
  ): void {
    const colBone = LIN.bone;
    const colSignal = LIN.signal;

    // Traveling emissive pulse dash
    if (pulse) {
      const s0 = this.toScreenPx(pulse.p0);
      const s1 = this.toScreenPx(pulse.p1);
      if (s0 && s1) {
        this.pulseBatch.seg2(s0[0], s0[1], s1[0], s1[1], 3.2, colBone, pulse.intensity);
      }
    }

    // Gap flare at impact
    if (gapFlare > 0.02) {
      const gp = this.toScreenPx(gapCenter);
      if (gp) {
        const r = 9.0 * gapFlare;
        this.sparkBatch.seg2(gp[0] - r, gp[1], gp[0] + r, gp[1], 2.8, colSignal, gapFlare);
        this.sparkBatch.seg2(gp[0], gp[1] - r, gp[0], gp[1] + r, 2.8, colSignal, gapFlare);
      }
    }

    // 48 Falling sparks
    for (let i = 0; i < sparks.length; i++) {
      const sp = sparks[i]!;
      const s0 = this.toScreenPx(sp.p0);
      const s1 = this.toScreenPx(sp.p1);
      if (s0 && s1) {
        this.sparkBatch.seg2(s0[0], s0[1], s1[0], s1[1], 1.8, colSignal, sp.alpha);
      }
    }
  }

  /**
   * Projects a 3D world coordinate to 2D screen pixels
   */
  private toScreenPx(p: [number, number, number]): [number, number] | null {
    const v = new THREE.Vector3(p[0], p[1], p[2]);
    v.project(this.camera3D);
    if (v.z > 1.0) return null;
    const x = (v.x * 0.5 + 0.5) * W;
    const y = (1.0 - (v.y * 0.5 + 0.5)) * H;
    return [x, y];
  }

  /**
   * Draws the canonical 2D Interlock Glyph G (centered, ~40% of frame width)
   * Left: input node (circle)
   * Center: gap with small blocker bar glowing --signal red
   * Right: output node (square)
   */
  private drawInterlockGlyph2D(alpha: number, redIntensity: number): void {
    const colBone = LIN.bone;
    const colSignal = LIN.signal;

    const cx = W / 2;
    const cy = H / 2;
    const span = W * 0.40;
    const x0 = span * 0.38;
    const rNode = span * 0.16;
    const gapW = span * 0.06;

    // 1. Input Node on Left (Circle)
    const segs = 40;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const xA = cx - x0 + Math.cos(a0) * rNode;
      const yA = cy + Math.sin(a0) * rNode;
      const xB = cx - x0 + Math.cos(a1) * rNode;
      const yB = cy + Math.sin(a1) * rNode;
      this.lineBatch2D.seg2(xA, yA, xB, yB, 2.0, colBone, alpha);
    }

    // 2. Output Node on Right (Square)
    const sqX0 = cx + x0 - rNode;
    const sqX1 = cx + x0 + rNode;
    const sqY0 = cy - rNode;
    const sqY1 = cy + rNode;
    this.lineBatch2D.seg2(sqX0, sqY0, sqX1, sqY0, 2.0, colBone, alpha);
    this.lineBatch2D.seg2(sqX1, sqY0, sqX1, sqY1, 2.0, colBone, alpha);
    this.lineBatch2D.seg2(sqX1, sqY1, sqX0, sqY1, 2.0, colBone, alpha);
    this.lineBatch2D.seg2(sqX0, sqY1, sqX0, sqY0, 2.0, colBone, alpha);

    // 3. Connecting Line Segments
    this.lineBatch2D.seg2(cx - x0 + rNode, cy, cx - gapW, cy, 2.0, colBone, alpha);
    this.lineBatch2D.seg2(cx + gapW, cy, sqX0, cy, 2.0, colBone, alpha);

    // 4. The Blocker Bar in the Gap (GLOWS --SIGNAL RED ONLY)
    // Small blocker bar sitting in the short break, restrained and elegant
    const bH = rNode * 0.35;
    this.lineBatch2D.seg2(cx, cy - bH, cx, cy + bH, 2.8, colSignal, alpha * redIntensity);
  }

  /**
   * Draws 2D line in Beat 4 from reaching hand to red gap blocker
   */
  private drawInterlockLineToGap(gapFlare: number): void {
    const colBone = LIN.bone;
    const colSignal = LIN.signal;

    const pHand = this.toScreenPx(this.beat4.handPos);
    const pGap = this.toScreenPx(this.beat4.gapPos);

    if (pHand && pGap) {
      // Line from hand to gap
      this.lineBatch2D.seg2(pHand[0], pHand[1], pGap[0] - 14, pGap[1], 2.0, colBone, 0.85);

      // Red gap blocker bar
      const bH = 20.0;
      this.lineBatch2D.seg2(pGap[0], pGap[1] - bH, pGap[0], pGap[1] + bH, 3.2, colSignal, 0.95 + 0.4 * gapFlare);
    }
  }
}

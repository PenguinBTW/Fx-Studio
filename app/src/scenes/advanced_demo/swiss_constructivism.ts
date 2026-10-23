// 02: SWISS CONSTRUCTIVISM — High-Key Editorial Print in Motion / Bauhaus
// Light archival paper backdrop (#F5F3EC), deep carbon ink (#0F0F11), International
// Klein Blue (#002FA7), Vermilion (#FF3B30), Ochre (#EAB308), monumental 12-column
// drafting grid, 4-harmonic Lissajous harmonograph, and single-stroke mathematical plotting.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';
import { strokeText, drawStrokeText, type StrokeText } from '../../engine/stroke';

export default defineScene({
  id: 'swiss_constructivism',
  rigMode: 'perspective',
  particleCapacity: 256,
  lineCapacity: 4096,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(50);
    ctx.rig.setPath([
      { t: 0.0, pos: [0, 0, -10.0], target: [0, 0, 0], roll: 0, focalLength: 50 },
      { t: 1.0, pos: [0, 0, -10.0], target: [0, 0, 0], roll: 0, focalLength: 50 },
    ]);
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.lines.clear();
    ctx.sdf.clear();

    // Palette: Light Archival Paper, Carbon Ink, Klein Blue, Vermilion, Ochre
    const colInk: [number, number, number, number] = [0.06, 0.06, 0.07, 1.0];
    const colKleinBlue: [number, number, number, number] = [0.0, 0.18, 0.65, 0.95];
    const colVermilion: [number, number, number, number] = [1.0, 0.23, 0.19, 0.95];
    const colOchre: [number, number, number, number] = [0.92, 0.70, 0.03, 0.9];
    const colGridRule = 'rgba(15, 15, 17, 0.14)';

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 1. SDF Graphic Constructivism (SDFBatch directly on screen coordinates)
    if (textDuck > 0.01) {
      // Large International Klein Blue Anchor Disk (Bottom Right)
      const diskProgress = ease.outExpo(Math.min(1, progress * 2.5));
      ctx.ring({
        cx: W - 340, cy: H - 340,
        radius: 200 * diskProgress,
        thickness: 18,
        trim: [0, 1],
        color: [colKleinBlue[0], colKleinBlue[1], colKleinBlue[2], colKleinBlue[3] * textDuck],
      });
      ctx.ring({
        cx: W - 340, cy: H - 340,
        radius: 155 * diskProgress,
        thickness: 9,
        trim: [0, Math.min(1, progress * 1.6)],
        color: [colVermilion[0], colVermilion[1], colVermilion[2], colVermilion[3] * textDuck],
      });
      ctx.ring({
        cx: W - 340, cy: H - 340,
        radius: 110 * diskProgress,
        thickness: 5,
        trim: [0, Math.min(1, 0.3 + progress * 0.7)],
        color: [colOchre[0], colOchre[1], colOchre[2], colOchre[3] * textDuck],
      });

      // Vermilion Accent Card Block
      ctx.card('swiss_accent', {
        x: 120, y: H - 280, w: 300, h: 150,
        radius: [0, 0, 0, 0],
        fill: [colVermilion[0], colVermilion[1], colVermilion[2], 0.92 * textDuck],
        role: 'callout',
      });

      // Ochre Architectural Square Stamp
      ctx.card('swiss_ochre', {
        x: 445, y: H - 280, w: 150, h: 150,
        radius: [0, 0, 0, 0],
        fill: [colOchre[0], colOchre[1], colOchre[2], 0.88 * textDuck],
        role: 'callout',
      });

      // Deep Carbon Ink Small Grid Bar
      ctx.card('swiss_black_bar', {
        x: 120, y: H - 305, w: 475, h: 12,
        radius: [0, 0, 0, 0],
        fill: [colInk[0], colInk[1], colInk[2], 0.95 * textDuck],
        role: 'callout',
      });

      // International Klein Blue Vertical Drafting Column Band (Center Column)
      ctx.card('swiss_blue_col', {
        x: 740, y: 140, w: 4, h: H - 240,
        radius: [0, 0, 0, 0],
        fill: [colKleinBlue[0], colKleinBlue[1], colKleinBlue[2], 0.8 * textDuck],
        role: 'callout',
      });
    }

    // 2. 2D Typography & Single-Stroke Formulas on Archival Paper
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      // 12-Column Swiss Modular Drafting Grid
      c2d.save();
      c2d.strokeStyle = colGridRule;
      c2d.lineWidth = 1.0;
      const numCols = 12;
      const marginX = 120;
      const colW = (W - marginX * 2) / numCols;
      for (let c = 0; c <= numCols; c++) {
        const x = marginX + c * colW;
        c2d.beginPath();
        c2d.moveTo(x, 50);
        c2d.lineTo(x, H - 50);
        c2d.stroke();
      }
      for (let y = 130; y < H - 50; y += 110) {
        c2d.beginPath();
        c2d.moveTo(marginX, y);
        c2d.lineTo(W - marginX, y);
        c2d.stroke();
      }

      // Josef Müller-Brockmann Concentric Acoustic Arc Bands (Center-Right)
      c2d.strokeStyle = 'rgba(0, 47, 167, 0.16)';
      c2d.lineWidth = 1.5;
      const arcCx = 740, arcCy = 420;
      for (let aR = 60; aR <= 380; aR += 40) {
        c2d.beginPath();
        c2d.arc(arcCx, arcCy, aR, -Math.PI * 0.45, Math.PI * 0.45);
        c2d.stroke();
      }

      // 4 Precision Crop Registration Marks
      const cropLen = 22;
      const cropOffsets = [
        [marginX - 30, 50], [W - marginX + 30, 50],
        [marginX - 30, H - 50], [W - marginX + 30, H - 50],
      ];
      c2d.strokeStyle = 'rgba(15, 15, 17, 0.45)';
      c2d.lineWidth = 1.2;
      for (const [cx, cy] of cropOffsets) {
        c2d.beginPath();
        c2d.moveTo(cx - cropLen, cy); c2d.lineTo(cx + cropLen, cy);
        c2d.moveTo(cx, cy - cropLen); c2d.lineTo(cx, cy + cropLen);
        c2d.stroke();
      }
      c2d.restore();

      // Monumental Swiss Headline in Carbon Ink
      const title = ctx.text('swiss_main', 'DIE NEUE TYPOGRAPHIE', {
        fontSize: 74, fontWeight: 900, color: `rgba(15, 15, 17, ${0.98 * textDuck})`, letterSpacing: 6, role: 'headline',
      });
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('swiss_main', c2d, t, 120, 160 - (1 - titleEnter) * 35);

      const sub1 = ctx.text('swiss_sub', 'FORM FOLLOWS KINEMATICS · ASYMMETRIC MODULAR GRID · ZERO DECORATION', {
        fontSize: 15, fontWeight: 700, color: `rgba(0, 47, 167, ${0.95 * textDuck})`, letterSpacing: 4, role: 'callout',
      });
      ctx.renderText('swiss_sub', c2d, t, 124, 215);

      const body1 = ctx.text('swiss_body', 'ELEMENTARE GESTALTUNG: DIE FUNKTION BESTIMMT DIE FORM IM RAUM.', {
        fontSize: 18, fontWeight: 800, color: `rgba(15, 15, 17, ${0.88 * textDuck})`, letterSpacing: 2, role: 'callout',
      });
      ctx.renderText('swiss_body', c2d, t, 124, 290);

      // Monumental Swiss Numeral '02' in Klein Blue
      const num2 = ctx.text('swiss_num', '02', {
        fontSize: 170, fontWeight: 900, color: `rgba(0, 47, 167, ${0.88 * textDuck})`, letterSpacing: -5, role: 'headline',
      });
      ctx.renderText('swiss_num', c2d, t, 120, H * 0.5 + 45);

      // Constructivist Design Manifesto Text Columns
      const colA = ctx.text('swiss_col_a', 'DIE FORM MUSS EINE LOGISCHE FOLGE DER INNEREN BEDINGUNGEN SEIN.', {
        fontSize: 14, fontWeight: 700, color: `rgba(15, 15, 17, ${0.85 * textDuck})`, letterSpacing: 2, role: 'callout',
      });
      ctx.renderText('swiss_col_a', c2d, t, 370, H * 0.5 - 25);

      const colB = ctx.text('swiss_col_b', 'ORDNUNG STATT WILLKÜR · REDUKTION STATT DEKORATION · REINE TYPOGRAPHIE.', {
        fontSize: 13, fontWeight: 600, color: `rgba(15, 15, 17, ${0.75 * textDuck})`, letterSpacing: 1.5, role: 'callout',
      });
      ctx.renderText('swiss_col_b', c2d, t, 370, H * 0.5 + 12);

      const colC = ctx.text('swiss_col_c', 'DAS ZIEL ALLER BILDNERISCHEN TÄTIGKEIT IST DER BAU. DIN 476 RATIO 1:√2.', {
        fontSize: 12, fontWeight: 600, color: `rgba(15, 15, 17, ${0.65 * textDuck})`, letterSpacing: 1.2, role: 'callout',
      });
      ctx.renderText('swiss_col_c', c2d, t, 370, H * 0.5 + 46);

      // Single-Stroke Progressive Formula Plotting in Crisp Carbon Ink
      try {
        const formulaStr = '∇ × B = μ₀J + μ₀ε₀(∂E/∂t) · dS/dt = 0';
        const st: StrokeText = strokeText(formulaStr, 'tech', 32, 1.4);
        const maxLen = st.total;
        const penProgress = Math.min(1, progress * 1.8);
        const curLen = maxLen * ease.inOutCubic(penProgress);
        c2d.save();
        c2d.translate(124, 380);
        c2d.strokeStyle = `rgba(15, 15, 17, ${0.92 * textDuck})`;
        c2d.lineWidth = 2.2;
        drawStrokeText(c2d, st, curLen);
        c2d.restore();
      } catch {
        c2d.save();
        c2d.font = '700 28px monospace';
        c2d.fillStyle = `rgba(15, 15, 17, ${0.92 * textDuck})`;
        c2d.fillText('∇ × B = μ₀J + μ₀ε₀(∂E/∂t) · dS/dt = 0', 124, 380);
        c2d.restore();
      }

      // Running Vertical Swiss Marginalia
      c2d.save();
      c2d.translate(70, H - 280);
      c2d.rotate(-Math.PI / 2);
      c2d.font = '700 12px Archivo, sans-serif';
      c2d.fillStyle = `rgba(15, 15, 17, ${0.7 * textDuck})`;
      c2d.letterSpacing = '4px';
      c2d.fillText('INTERNATIONALE KUNSTGEWERBESCHULE · BASEL 1928 - 2026', 0, 0);
      c2d.restore();

      // Technical Spec Text on Vermilion Card
      const cardTitle = ctx.text('swiss_card_t', 'MODUL 02 / 12', {
        fontSize: 16, fontWeight: 800, color: `rgba(255, 255, 255, ${0.98 * textDuck})`, letterSpacing: 2, role: 'hud',
      });
      ctx.renderText('swiss_card_t', c2d, t, 145, H - 235);

      const cardBody = ctx.text('swiss_card_b', 'STANDARDIZED DIN 476 RATIO 1:√2 · GOLDEN RATIO Φ = 1.618', {
        fontSize: 11, fontWeight: 700, color: `rgba(255, 255, 255, ${0.92 * textDuck})`, letterSpacing: 1, role: 'hud',
      });
      ctx.renderText('swiss_card_b', c2d, t, 145, H - 180);

      // Ochre Card Inset Spec
      c2d.save();
      c2d.font = '800 13px Archivo, sans-serif';
      c2d.fillStyle = `rgba(15, 15, 17, ${0.85 * textDuck})`;
      c2d.fillText('A0 FORMAT', 465, H - 230);
      c2d.font = '600 11px Archivo, sans-serif';
      c2d.fillText('841 × 1189 MM', 465, H - 195);
      c2d.fillText('100% RAG VELLUM', 465, H - 165);
      c2d.restore();

      // Multi-Harmonic Lissajous Harmonograph (4 interlaced curves)
      c2d.save();
      const lcx = W - 320, lcy = 310, lrad = 160;

      // Outer Calibration Circle & Phase Ticks
      c2d.strokeStyle = `rgba(15, 15, 17, ${0.25 * textDuck})`;
      c2d.lineWidth = 1.0;
      c2d.beginPath();
      c2d.arc(lcx, lcy, lrad * 1.15, 0, TAU);
      c2d.stroke();
      for (let tk = 0; tk < 24; tk++) {
        const ta = (tk / 24) * TAU;
        const tx1 = lcx + Math.cos(ta) * (lrad * 1.15);
        const ty1 = lcy + Math.sin(ta) * (lrad * 1.15);
        const tx2 = lcx + Math.cos(ta) * (lrad * 1.22);
        const ty2 = lcy + Math.sin(ta) * (lrad * 1.22);
        c2d.beginPath();
        c2d.moveTo(tx1, ty1); c2d.lineTo(tx2, ty2);
        c2d.stroke();
      }

      // Harmonic 1: Carbon Ink (3:2 frequency ratio)
      c2d.lineWidth = 2.4;
      c2d.strokeStyle = `rgba(15, 15, 17, ${0.88 * textDuck})`;
      c2d.beginPath();
      for (let st = 0; st <= 280; st++) {
        const u = (st / 280) * TAU;
        const lx = lcx + Math.sin(3 * u + t * 0.8) * lrad;
        const ly = lcy + Math.cos(2 * u) * (lrad * 0.82);
        if (st === 0) c2d.moveTo(lx, ly);
        else c2d.lineTo(lx, ly);
      }
      c2d.stroke();

      // Harmonic 2: International Klein Blue (5:4 ratio)
      c2d.lineWidth = 2.0;
      c2d.strokeStyle = `rgba(0, 47, 167, ${0.82 * textDuck})`;
      c2d.beginPath();
      for (let st = 0; st <= 280; st++) {
        const u = (st / 280) * TAU;
        const lx = lcx + Math.sin(5 * u - t * 0.5) * (lrad * 0.88);
        const ly = lcy + Math.cos(4 * u) * (lrad * 0.72);
        if (st === 0) c2d.moveTo(lx, ly);
        else c2d.lineTo(lx, ly);
      }
      c2d.stroke();

      // Harmonic 3: Vermilion (7:6 ratio)
      c2d.lineWidth = 1.4;
      c2d.strokeStyle = `rgba(255, 59, 48, ${0.65 * textDuck})`;
      c2d.beginPath();
      for (let st = 0; st <= 280; st++) {
        const u = (st / 280) * TAU;
        const lx = lcx + Math.sin(7 * u + t * 0.3) * (lrad * 0.65);
        const ly = lcy + Math.cos(6 * u) * (lrad * 0.55);
        if (st === 0) c2d.moveTo(lx, ly);
        else c2d.lineTo(lx, ly);
      }
      c2d.stroke();

      c2d.restore();
    }

    // Compositing with WARM ARCHIVAL PAPER BACKGROUND (#F5F3EC)
    ctx.compositor.clear();
    ctx.compositor.createLayer('paper_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0xF5F3EC, 1.0);
        }
        renderer.clear(true, true, true);
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.createLayer('vector_constructs', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.evaluate(renderer, out);

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();

    return { bloom: 0.0, ca: 0.0 };
  },
});

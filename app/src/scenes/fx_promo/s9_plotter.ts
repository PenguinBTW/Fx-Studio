// s9_plotter (bars 83-86, 161.16 - 168.93 s): the palette inverts. Top-down on bone paper, the Blender pen writes
// three words in a real single-stroke script (engine stroke.ts, EMS Allure) — the nib is the stroke head; on the last bar the clock scrubs back and replays — the page is a function of t, so it rewinds clean.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { strokeText, drawStrokeText, type StrokeText } from '../../engine/stroke';
import { clamp, ease, prog } from '../../engine/util';
import type { GLTFInstance } from '../../engine/gltf';
import { C, bar, sceneTime, model, studioEnv, present, typeLine } from './kit';

const LINES: { text: string; y: number; t0: number; dur: number; col: string; size: number }[] = [
  { text: 'deterministic.', y: 360, t0: bar(83) + 0.1, dur: 1.6, col: C.void, size: 150 },
  { text: 'seekable.', y: 560, t0: bar(84) + 0.1, dur: 1.2, col: C.void, size: 150 },
  { text: 'yours.', y: 760, t0: bar(85) + 0.1, dur: 0.9, col: C.signal, size: 170 },
];
const X0 = 300;

/** Writing clock: plays, then scrubs back on bar 86 and replays fast. */
function writeClock(T: number) {
  const a = bar(85.6), b = bar(86.15), c = bar(86.85);
  if (T < a) return T;
  if (T < b) return a + (bar(83) - a) * ease.inOutCubic((T - a) / (b - a));
  return bar(83) + (a - bar(83)) * ease.outCubic(clamp((T - b) / (c - b)));
}

export default class S9Plotter extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-9.6, 9.6, 5.4, -5.4, 0.1, 100);
  private paper = new Layer2D();
  private hud = new Layer2D();
  private pen!: GLTFInstance;
  private sts: StrokeText[] = [];

  override async init() {
    this.pen = await model(this.ctx, 'pen');
    this.pen.root.scale.setScalar(1.3);
    this.scene.add(this.pen.root);
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.8;
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(-4, 10, -3);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.3));
    const tex = this.paper.texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), new THREE.MeshBasicMaterial({ map: tex }));
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);
    this.cam.position.set(0, 20, 0);
    this.cam.up.set(0, 0, -1);
    this.cam.lookAt(0, 0, 0);
    for (const l of LINES) this.sts.push(strokeText(l.text, 'script', l.size * 1.35));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const W = writeClock(T);
    const g = this.paper.ctx;
    g.fillStyle = C.bone;
    g.fillRect(0, 0, 1920, 1080);
    g.strokeStyle = 'rgba(5,5,6,0.07)';
    g.lineWidth = 1;
    for (let x = 0; x <= 1920; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke(); }
    for (let y = 0; y <= 1080; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke(); }

    let penX = X0, penY = LINES[0]!.y;
    LINES.forEach((l, i) => {
      const p = prog(W, l.t0, l.t0 + l.dur, ease.inOutQuad);
      if (p <= 0) return;
      const st = this.sts[i]!;
      const by = l.y + st.capHeight * 0.5;
      g.save();
      g.translate(X0, by);
      g.strokeStyle = l.col;
      g.lineWidth = i === 2 ? 12 : 8.5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const head = drawStrokeText(g, st, st.total * p);
      g.restore();
      if (head && (p < 1 || i === LINES.length - 1 || W < LINES[i + 1]!.t0)) { penX = X0 + head.x; penY = by + head.y; }
    });
    // Rail the plotter rides on.
    g.fillStyle = 'rgba(5,5,6,0.12)';
    g.fillRect(0, penY - 3, 1920, 6);
    this.paper.upload();

    const lift = W > LINES[2]!.t0 + LINES[2]!.dur + 0.2 ? 0.8 : 0;
    this.pen.root.position.set((penX - 960) / 100, 0.02 + lift, (penY - 540) / 100);
    this.pen.root.rotation.set(0.55, 0.0, -0.6);
    const z = 1 + 0.12 * prog(T, bar(83), bar(87), ease.inOutQuad);
    this.cam.zoom = z;
    this.cam.position.x = (penX - 960) / 100 * 0.15;
    this.cam.updateProjectionMatrix();

    const h = this.hud.ctx;
    this.hud.clear();
    const scrub = T > bar(85.6) && T < bar(86.85);
    typeLine(h, `t = ${W.toFixed(2)}${scrub ? '  ◀◀ scrub' : ''}`, 1728, 980, T, bar(83), { size: 28, align: 'right', color: scrub ? C.signal : C.ash, cps: 400, cursor: false });
    present(this.ctx, out, this.scene, this.cam, this.hud, undefined, 0xe8e4da);
    return { exposure: 1.0, bloom: 0.15, bloomThreshold: 0.95, vignette: 0.3, ca: scrub ? 1.5 : 0.2, grain: 0.04 };
  }
}

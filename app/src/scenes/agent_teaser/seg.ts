// Vertical teaser segment: wraps an agent_v2 scene, plays a window of it from a source bar on the song grid
// (so its beat-locked motion stays on the beat), reframes its perspective cameras for the 9:16 canvas and
// replaces the film's terminal narration with short teaser lines.
import * as THREE from 'three';
import { Layer2D, W, H } from '../../engine/gl';
import { F } from '../../engine/type';
import type { Frame, PostOverrides, Scene, SceneCtx } from '../../engine/scene';
import { BAR, BEAT, B0 } from '../agent_promo/kit';
import { term, TERM, type TLine } from '../agent_v2/term';

TERM.off = true;

export interface SegOpts {
  /** Source bar index on the song grid (bar n starts at B0 + n * BAR). */
  bar: number;
  /** The source scene's window in agent_v2/project.json. */
  win: [number, number];
  /** Vertical extent of the 9:16 frame in units of the source frame's height (1.6 keeps subjects about the same width). */
  k?: number;
  /** Horizontal centre of the 9:16 window across the source frame (0 left .. 1 right). */
  cx?: number;
  /** Teaser lines, `at` in seconds from the segment start. */
  lines?: TLine[];
}

type SceneCtor = new (ctx: SceneCtx) => Scene;

function reframe(cam: THREE.PerspectiveCamera, k: number, cx: number) {
  if ((cam as { __teaser?: boolean }).__teaser) return;
  (cam as { __teaser?: boolean }).__teaser = true;
  const orig = cam.updateProjectionMatrix.bind(cam);
  cam.updateProjectionMatrix = () => {
    const f0 = cam.fov, v0 = cam.view, fullW = cam.aspect * H;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(k * Math.tan(THREE.MathUtils.degToRad(f0) / 2)));
    cam.view = { enabled: true, fullWidth: fullW, fullHeight: H, offsetX: cx * Math.max(0, fullW - W), offsetY: 0, width: W, height: H };
    orig();
    cam.fov = f0; cam.view = v0;
  };
  cam.updateProjectionMatrix();
}

export function seg(Base: SceneCtor, o: SegOpts): SceneCtor {
  const k = o.k ?? 1.6, cx = o.cx ?? 0.5, src0 = B0 + o.bar * BAR;
  return class Seg extends (Base as new (ctx: SceneCtx) => Scene & { init(): Promise<void>; render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void }) {
    private tl = new Layer2D();
    private cams() {
      const found: THREE.PerspectiveCamera[] = [];
      for (const v of Object.values(this as object)) {
        if (v instanceof THREE.PerspectiveCamera) found.push(v);
        else if (Array.isArray(v)) for (const c of v) if (c instanceof THREE.PerspectiveCamera) found.push(c);
      }
      return found;
    }
    override async init() { (this.ctx as { project?: string }).project = 'agent_v2'; await super.init(); for (const c of this.cams()) reframe(c, k, cx); }
    override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
      for (const c of this.cams()) reframe(c, k, cx);
      const t = src0 + (f.t - f.start), [s, e] = o.win;
      const r = super.render({ ...f, t, start: s, end: e, lt: t - s, p: (t - s) / (e - s), beat: (t - B0) / BEAT, bar: (t - B0) / BAR,
        beatPhase: (((t - B0) / BEAT) % 1 + 1) % 1, barPhase: (((t - B0) / BAR) % 1 + 1) % 1, under: null, tin: 1, tout: 0 }, out);
      if (o.lines?.length) {
        const g = this.tl.ctx; this.tl.clear();
        term(g, o.lines, f.t - f.start, { force: true, size: 96, x: W / 2, y: H * 0.64, family: F.archivo(100, 800), align: 'center', halo: 'rgba(0,0,0,0.7)', cursor: '#ff4d12' });
        this.ctx.comp.draw(this.ctx.renderer, this.tl.upload(), out, { mode: 'normal', opacity: 1 }); this.ctx.renderer.resetState();
      }
      return r;
    }
    override dispose() { this.tl.texture.dispose(); super.dispose?.(); }
  };
}

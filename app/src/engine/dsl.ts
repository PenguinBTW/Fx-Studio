// Declarative Scene Authoring DSL & Strict Lifecycle (defineScene, SceneContext)
// Protects autonomous coding agents from boilerplate errors by automating:
// 1. Primitive instantiation and registration in SceneGraph
// 2. Zero-annotation telemetry synchronization to window.__motion.textProbes (and __pdoom alias)
// 3. Batched GPU drawing with automatic renderer.resetState() cleanup
// 4. Strict font readiness gating (document.fonts.ready)
import * as THREE from 'three';
import { Scene, type SceneCtx, type Frame, type PostOverrides, type SceneClass } from './scene';
import { CameraRig, type CameraMode } from './rig';
import { SceneGraph, type EntityRole, type EntityMetadata } from './scenegraph';
import { CompositorGraph } from './graph';
import { SDFBatch, type SDFRectOpts } from './sdf';
import { KineticText, type KineticTextOptions } from './text';
import { LineBatch } from './lines';
import { AnalyticalParticles, type ParticleEmitterOpts } from './particles';
import { LayoutNode, TransformNode } from './transform';
import { motion, MotionBus } from './motion';
import { Layer2D, W, H } from './gl';
import { getDesignTokens, type DesignTokens } from './tokens';
import { LIN, rgba } from './palette';
import { overlayTextDuck } from './transition';
import { GLTFManager, GLTFInstance, type GLTFLoadOptions } from './gltf';

export interface SceneContextOptions {
  rigMode?: CameraMode;
  particleCapacity?: number;
  lineCapacity?: number;
  sdfCapacity?: number;
}

export class SceneContext {
  readonly sceneCtx: SceneCtx;
  readonly sceneGraph: SceneGraph;
  readonly compositor: CompositorGraph;
  readonly rig: CameraRig;
  readonly threeCam: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly particles: AnalyticalParticles;
  readonly sdf: SDFBatch;
  readonly lines: LineBatch;
  readonly layer2d: Layer2D;
  readonly motion: MotionBus = motion;

  /** Standard 3D scene container for Three.js meshes, lights, and GLTF models */
  readonly scene3D = new THREE.Scene();
  /** Instantiated GLTF models cataloged by ID */
  readonly models = new Map<string, GLTFInstance>();

  // Cached typography nodes
  private textNodes = new Map<string, KineticText>();
  // Cached layout nodes
  private layoutNodes = new Map<string, LayoutNode>();

  // Current frame state during render pass
  currentFrame: Frame | null = null;

  /**
   * Engine-driven overlay duck (0..1), derived from the frame's tin/tout by
   * the scene wrapper before user render code runs. Multiplies overlay text
   * (renderText) and vector cards so outgoing overlays exit fast and incoming
   * ones enter late across transition seams. Read-only for scenes: raw canvas
   * draws that bypass renderText/card should multiply their text alphas by
   * this value (3D content ignores it).
   */
  overlayDuck = 1;

  /** Set by the engine wrapper only (see DeclarativeScene.render). */
  setOverlayDuck(d: number): void {
    this.overlayDuck = Number.isFinite(d) ? Math.min(1, Math.max(0, d)) : 1;
  }

  constructor(sceneCtx: SceneCtx, opts?: SceneContextOptions) {
    this.sceneCtx = sceneCtx;
    this.sceneGraph = new SceneGraph();
    this.compositor = new CompositorGraph();

    const rigMode = opts?.rigMode ?? 'perspective';
    this.rig = new CameraRig(rigMode);

    if (rigMode === 'perspective') {
      this.threeCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
    } else {
      this.threeCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 2000);
    }

    this.particles = new AnalyticalParticles(opts?.particleCapacity ?? 1024);
    this.lines = new LineBatch(opts?.lineCapacity ?? 2048, { screen2D: false, blend: 'normal' });
    this.sdf = new SDFBatch(opts?.sdfCapacity ?? 2048);
    this.layer2d = new Layer2D();
  }

  get renderer(): THREE.WebGLRenderer {
    return this.sceneCtx.renderer;
  }

  get W(): number {
    return this.sceneCtx.W ?? W;
  }

  get H(): number {
    return this.sceneCtx.H ?? H;
  }

  get tokens(): DesignTokens {
    return getDesignTokens();
  }

  get lin(): typeof LIN {
    return LIN;
  }

  rgba(nameOrHex: string, a = 1): string {
    return rgba(nameOrHex, a);
  }

  /**
   * Asynchronously load and instantiate a GLTF/GLB model into this scene context.
   */
  async loadModel(id: string, url: string, opts?: GLTFLoadOptions): Promise<GLTFInstance> {
    const inst = await GLTFManager.instantiate(url, opts);
    this.models.set(id, inst);
    return inst;
  }

  /**
   * Retrieve a loaded GLTF model instance by ID.
   */
  getModel(id: string): GLTFInstance | undefined {
    return this.models.get(id);
  }

  /**
   * Declare or retrieve a KineticText node, automatically registering into SceneGraph
   */
  text(id: string, content: string, opts?: KineticTextOptions & { role?: EntityRole }): KineticText {
    let kt = this.textNodes.get(id);
    if (!kt) {
      kt = new KineticText(content, opts);
      this.textNodes.set(id, kt);

      this.sceneGraph.register({
        id,
        type: 'text',
        role: opts?.role ?? 'headline',
        opacity: opts?.alpha ?? 1.0,
        text: content,
        fontPx: opts?.fontSize ?? 36,
        fontFamily: opts?.fontFamily ?? 'Archivo, sans-serif',
        fillStyle: opts?.color ?? '#FFFFFF',
      });
    } else {
      if (opts) kt.updateStyle(opts);
      if (kt.text !== content) kt.setText(content);
      const meta = this.sceneGraph.get(id);
      if (meta) {
        meta.text = content;
        if (opts?.fontSize) meta.fontPx = opts.fontSize;
        if (opts?.fontFamily) meta.fontFamily = opts.fontFamily;
        if (opts?.color) meta.fillStyle = opts.color;
        if (opts?.alpha !== undefined) meta.opacity = opts.alpha;
      }
    }
    return kt;
  }

  /**
   * Render text node onto canvas and synchronize exact 2D screen bounds to SceneGraph
   */
  renderText(id: string, c2d: CanvasRenderingContext2D, t: number, x: number, y: number, staggerStates?: any[]): void {
    const kt = this.textNodes.get(id);
    if (!kt) return;
    if (this.overlayDuck < 0.999) {
      c2d.save();
      c2d.globalAlpha *= this.overlayDuck;
      kt.render(c2d, t, x, y, staggerStates);
      c2d.restore();
    } else {
      kt.render(c2d, t, x, y, staggerStates);
    }
    const bounds = kt.getScreenBounds(x, y);
    const meta = this.sceneGraph.get(id);
    if (meta) {
      meta.screenBounds = bounds;
      // Telemetry must see the alpha the canvas actually drew (duck included):
      // the motion probe reads meta.opacity, and an unducked value flags
      // phantom collisions for text that rendered invisibly.
      meta.opacity = kt.baseAlpha * this.overlayDuck;
    }
  }

  /**
   * Declare or retrieve a responsive LayoutNode
   */
  node(id: string, opts?: { role?: EntityRole; size?: [number, number, number] }): LayoutNode {
    let n = this.layoutNodes.get(id);
    if (!n) {
      n = new LayoutNode(id);
      if (opts?.size) n.size = opts.size;
      this.layoutNodes.set(id, n);

      this.sceneGraph.register({
        id,
        type: 'vector',
        role: opts?.role ?? 'callout',
        node: n,
        opacity: 1.0,
      });
    }
    return n;
  }

  /**
   * Draw an analytic rounded rectangle via SDFBatch with automatic SceneGraph bounds registration
   */
  card(id: string, opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    radius?: number | [number, number, number, number];
    fill?: [number, number, number, number];
    stroke?: [number, number, number, number];
    strokeWidth?: number;
    shadow?: { blur?: number; color?: [number, number, number, number]; offset?: [number, number] };
    role?: EntityRole;
    opacity?: number;
  }): void {
    const opacity = (opts.opacity ?? 1.0) * this.overlayDuck;
    if (opacity <= 0.001) {
      const meta = this.sceneGraph.get(id);
      if (meta) meta.opacity = 0;
      return;
    }

    if (opts.shadow) {
      const sBlur = opts.shadow.blur ?? 16;
      // Copy (never mutate the caller's array) and fold the card opacity in
      // so ducked/fading cards don't leave a floating shadow behind.
      const raw = opts.shadow.color ?? [0, 0, 0, 0.4];
      const sCol: [number, number, number, number] = [raw[0], raw[1], raw[2], raw[3] * opacity];
      const sOff = opts.shadow.offset ?? [0, 6];
      this.sdf.shadow(opts.x, opts.y, opts.w, opts.h, sBlur, sCol, sOff);
    }

    const rectOpts: SDFRectOpts = {
      radius: opts.radius,
      fill: opts.fill ? [opts.fill[0], opts.fill[1], opts.fill[2], opts.fill[3] * opacity] : undefined,
      stroke: opts.stroke ? [opts.stroke[0], opts.stroke[1], opts.stroke[2], opts.stroke[3] * opacity] : undefined,
      strokeWidth: opts.strokeWidth,
    };

    this.sdf.rect(opts.x, opts.y, opts.w, opts.h, rectOpts);

    // Update screen bounds in SceneGraph
    let meta = this.sceneGraph.get(id);
    if (!meta) {
      meta = {
        id,
        type: 'vector',
        role: opts.role ?? 'callout',
        screenBounds: [opts.x, opts.y, opts.x + opts.w, opts.y + opts.h],
        opacity,
      };
      this.sceneGraph.register(meta);
    } else {
      meta.screenBounds = [opts.x, opts.y, opts.x + opts.w, opts.y + opts.h];
      meta.opacity = opacity;
    }
  }

  /**
   * Add a circular ring with anti-aliased trim path to SDFBatch
   */
  ring(opts: {
    cx: number;
    cy: number;
    radius: number;
    thickness?: number;
    trim?: [number, number];
    color?: [number, number, number, number];
    glow?: number;
  }): void {
    this.sdf.ring(
      opts.cx,
      opts.cy,
      opts.radius,
      opts.thickness ?? 2.0,
      opts.trim ?? [0, 1],
      opts.color ?? [1, 1, 1, 1],
      opts.glow ?? 1.0,
    );
  }

  /**
   * Add a HUD crosshair reticle to SDFBatch
   */
  reticle(opts: {
    cx: number;
    cy: number;
    size?: number;
    thickness?: number;
    color?: [number, number, number, number];
  }): void {
    this.sdf.reticle(
      opts.cx,
      opts.cy,
      opts.size ?? 12,
      opts.thickness ?? 1.5,
      opts.color ?? [1, 1, 1, 1],
    );
  }

  /**
   * Synchronize camera rig to Three.js camera and update scene graph screen projections
   */
  updateCamera(t: number, progress: number): void {
    this.rig.evalPath(progress);
    const cam = this.rig.evalCam(t);
    this.rig.syncToThreeCamera(cam, this.threeCam);
    this.sceneGraph.updateScreenProjections(this.threeCam, this.W, this.H);
  }

  /**
   * Flush GPU vector batches and 2D canvas layers into out target.
   * NOTE: Automatically renders 3D meshes/models in scene3D, then 3D lines,
   * SDF quads, and 2D typography layers into out.
   */
  flush(out: THREE.WebGLRenderTarget, clear = false): void {
    if (clear) {
      this.renderer.setRenderTarget(out);
      this.renderer.clear(true, true, true);
    }

    // 0. Render 3D Scene if meshes / GLTF models / lights are present
    if (this.scene3D.children.length > 0) {
      this.renderer.setRenderTarget(out);
      this.renderer.render(this.scene3D, this.threeCam);
    }

    // 1. Flush 3D lines if any were queued
    if (this.lines.count > 0) {
      this.lines.render(this.renderer, out, this.threeCam);
    }

    // 2. Flush SDF quads
    this.sdf.flush(this.renderer, out);

    // 3. Upload and composite 2D Canvas Layer
    const layerTex = this.layer2d.upload();
    this.sceneCtx.comp.draw(this.renderer, layerTex, out, { mode: 'normal', opacity: 1.0 });

    // 4. Telemetry sync
    if (this.currentFrame) {
      this.sceneGraph.syncTelemetry(this.currentFrame.t);
    }

    // Invariant: reset WebGL state cache after raw canvas/shader passes
    this.renderer.resetState();
  }

  dispose(): void {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.scene3D.clear();
    this.particles.dispose();
    this.lines.dispose();
    this.sdf.dispose();
    this.compositor.dispose();
    this.layer2d.texture.dispose();
    this.sceneGraph.clear();
    this.textNodes.clear();
    this.layoutNodes.clear();
  }
}

export interface DeclarativeSceneDef {
  id: string;
  duration?: number;
  rigMode?: CameraMode;
  particleCapacity?: number;
  lineCapacity?: number;
  sdfCapacity?: number;
  /** Declarative GLTF/GLB models preloaded and instantiated before setup() */
  models?: Record<string, string | ({ url: string } & GLTFLoadOptions)>;
  /** Asynchronous preloading phase (assets, textures, fonts) */
  preload?: (ctx: SceneCtx) => Promise<void>;
  /** One-time setup phase (configuring rig flight paths, particle emitters) */
  setup?: (ctx: SceneContext) => void | Promise<void>;
  /** Synchronous closed-form evaluation f(t) executed per sub-frame */
  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => PostOverrides | void;
}

/**
 * Fluent factory function that wraps a declarative scene definition into an engine SceneClass.
 */
export function defineScene(def: DeclarativeSceneDef): SceneClass {
  if (def.duration !== undefined && !(globalThis as any).__dslDurationWarned) {
    // duration is informational only — timeline.ts/driver owns `end`. Warn once so agents
    // don't silently tune a dead field (matches driver in demo but still advisory).
    console.warn(`[dsl] defineScene duration is advisory only; timeline driver owns end.`);
    (globalThis as any).__dslDurationWarned = true;
  }
  return class DeclarativeScene extends Scene {
    private sc!: SceneContext;
    private setupDone = false;

    constructor(ctx: SceneCtx) {
      super(ctx);
    }

    override async init(): Promise<void> {
      // 1. Strict font readiness gating to guarantee non-zero glyph bounds
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {}
      }

      // 2. Initialize SceneContext
      this.sc = new SceneContext(this.ctx, {
        rigMode: def.rigMode,
        particleCapacity: def.particleCapacity,
        lineCapacity: def.lineCapacity,
        sdfCapacity: def.sdfCapacity,
      });

      // 3. Automated GLTF models preloading & instancing
      if (def.models) {
        for (const [id, config] of Object.entries(def.models)) {
          const url = typeof config === 'string' ? config : config.url;
          const opts = typeof config === 'object' ? config : undefined;
          await this.sc.loadModel(id, url, opts);
        }
      }

      // 4. User preloading phase
      if (def.preload) {
        await def.preload(this.ctx);
      }

      // 5. User setup phase
      if (def.setup) {
        await def.setup(this.sc);
      }
      this.setupDone = true;
    }

    override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
      if (!this.setupDone) return;
      this.sc.currentFrame = f;
      // Overlay ducking from the entry overlap signals (1 outside overlaps):
      // outgoing overlays exit fast, incoming ones enter late, so transition
      // seams never show text mush. Scenes stay pure — no transition code here.
      this.sc.setOverlayDuck(overlayTextDuck(f.tin, f.tout));

      // Closed-form evaluation
      const overrides = def.render(this.sc, f, out);

      return overrides;
    }

    /**
     * God-view blueprint hook (duck-typed by tooling): pure rig-path pose at
     * song time. Uses the raw path (no smoothing state), so it is safe to
     * call at arbitrary times; returns null before setup.
     */
    evaluateCamera(songT: number): { p: [number, number, number]; F: [number, number, number] } | null {
      if (!this.setupDone) return null;
      const span = Math.max(1e-3, this.ctx.end - this.ctx.start);
      const u = Math.min(1, Math.max(0, (songT - this.ctx.start) / span));
      // NOTE: evalPath mutates rig position/target/roll/lens, but the next
      // updateCamera() re-derives all of them and smoothing state is
      // untouched, so blueprint sampling has no effect on rendering.
      this.sc.rig.evalPath(u);
      const pos = this.sc.rig.position;
      const tgt = this.sc.rig.target;
      const dx = tgt[0] - pos[0];
      const dy = tgt[1] - pos[1];
      const dz = tgt[2] - pos[2];
      const len = Math.hypot(dx, dy, dz) || 1.0;
      return { p: [...pos] as [number, number, number], F: [dx / len, dy / len, dz / len] };
    }

    override dispose(): void {
      if (this.sc) {
        this.sc.dispose();
      }
    }
  };
}

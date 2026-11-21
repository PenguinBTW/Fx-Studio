// Shared kit for the fx_promo advert: palette, the song's bar grid, Blender asset loading/instancing,
// a studio environment for chrome, and Canvas2D kinetic-type helpers (spring slam + knockout halo).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Layer2D } from '../../engine/gl';
import { F, font } from '../../engine/type';
import { clamp, springStep, ease } from '../../engine/util';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import type { SceneCtx } from '../../engine/scene';

export const C = { void: '#050506', bone: '#E8E4DA', signal: '#FF4D12', ice: '#8FD8FF', ash: '#6B6A66' } as const;
export const HALO = 'rgba(5,5,6,0.88)';

/** Song grid (HBFS, 123.45 BPM). Bars are 1-based to match storyboard.md. */
export const BAR = 1.94409;
export const BEAT = BAR / 4;
export const B0 = 1.736;
export const bar = (k: number) => B0 + (k - 1) * BAR;
export const beatAt = (k: number, b = 0) => bar(k) + b * BEAT;

/** Scene time: song time, optionally shifted so recap entries replay a scene's choreography. */
export const sceneTime = (ctx: SceneCtx, t: number) => t + (Number(ctx.params?.shift) || 0);

export async function model(ctx: SceneCtx, id: string): Promise<GLTFInstance> {
  return GLTFManager.instantiate(resolveAsset(id, ctx.project ?? 'fx_promo').url, {});
}

/** Bake each mesh of a Blender asset into an InstancedMesh sharing one set of matrices. */
export class Instanced {
  readonly group = new THREE.Group();
  readonly meshes: THREE.InstancedMesh[] = [];
  private m = new THREE.Matrix4();
  constructor(inst: GLTFInstance, readonly count: number, materialFor?: (name: string, m: THREE.Material) => THREE.Material, only?: (meshName: string) => boolean) {
    inst.root.updateMatrixWorld(true);
    inst.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (only && !only(mesh.name) && !only(mesh.parent?.name ?? '')) return;
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      const src = mesh.material as THREE.Material;
      const mat = materialFor ? materialFor(src.name || mesh.name, src) : src;
      const im = new THREE.InstancedMesh(g, mat, count);
      im.name = mesh.name;
      im.frustumCulled = false;
      this.meshes.push(im);
      this.group.add(im);
    });
  }
  set(i: number, p: THREE.Vector3, q: THREE.Quaternion, s: THREE.Vector3) {
    this.m.compose(p, q, s);
    for (const im of this.meshes) im.setMatrixAt(i, this.m);
  }
  color(i: number, c: THREE.Color, only?: string) {
    for (const im of this.meshes) if (!only || im.name.includes(only)) im.setColorAt(i, c);
  }
  commit(n = this.count) {
    for (const im of this.meshes) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export function studioEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  let tex = envCache.get(renderer);
  if (!tex) {
    const pm = new THREE.PMREMGenerator(renderer);
    tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    renderer.resetState();
    envCache.set(renderer, tex);
  }
  return tex;
}

/** Render a three.js scene into `out` and lay the 2D layer over it. */
export function present(ctx: SceneCtx, out: THREE.WebGLRenderTarget, scene: THREE.Scene, cam: THREE.Camera, layer?: Layer2D, extra?: () => void, clear = 0x050506, layerOpacity = 1) {
  const r = ctx.renderer;
  r.setRenderTarget(out);
  r.setClearColor(clear, 1);
  r.clear();
  r.render(scene, cam);
  if (extra) { extra(); r.setRenderTarget(out); }
  if (layer && layerOpacity > 0.001) ctx.comp.draw(r, layer.upload(), out, { mode: 'normal', opacity: layerOpacity });
  r.resetState();
}

export interface SlamOpts {
  t0: number;
  t1?: number;
  family?: string;
  size: number;
  color?: string;
  halo?: string;
  haloW?: number;
  align?: CanvasTextAlign;
  tracking?: number;
  /** Seconds of snap-out after t1 (vertical collapse + horizontal stretch). */
  out?: number;
  shake?: number;
  /** Starting scale of the slam (mass falling toward the lens). */
  from?: number;
  rot?: number;
}

/** Spring slam: the word falls from `from`x scale onto the glass with an under-damped settle and a decaying shake. */
export function slam(c: CanvasRenderingContext2D, text: string, x: number, y: number, t: number, o: SlamOpts): number {
  if (t < o.t0) return 0;
  const t1 = o.t1 ?? Infinity;
  const out = o.out ?? 0.1;
  if (t > t1 + out) return 0;
  const lt = t - o.t0;
  const s = springStep(lt, 3.4, 0.45);
  const from = o.from ?? 1.7;
  const scale = from + (1 - from) * s;
  const ex = t > t1 ? clamp((t - t1) / out) : 0;
  const sy = 1 - ease.inCubic(ex);
  const sx = 1 + ex * 0.5;
  const a = clamp(lt / 0.04) * (1 - ex * 0.5);
  const sh = (o.shake ?? 6) * Math.exp(-lt * 12);
  c.save();
  c.translate(x + Math.sin(lt * 91) * sh, y + Math.cos(lt * 77) * sh);
  if (o.rot) c.rotate(o.rot * (1 - s));
  c.scale(scale * sx, scale * sy);
  c.font = font(o.family ?? F.archivo(100, 900), o.size);
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  (c as any).letterSpacing = `${o.tracking ?? 0}px`;
  c.globalAlpha = a;
  c.lineJoin = 'round';
  c.strokeStyle = o.halo ?? HALO;
  c.lineWidth = o.haloW ?? Math.max(6, o.size * 0.1);
  c.strokeText(text, 0, 0);
  c.fillStyle = o.color ?? C.bone;
  c.fillText(text, 0, 0);
  c.restore();
  return a;
}

export interface Cue { text: string; t: number; color?: string; size?: number; family?: string }

/** A train of words: each one holds until the next cue, then snaps out. */
export function train(c: CanvasRenderingContext2D, cues: Cue[], t: number, x: number, y: number, base: Omit<SlamOpts, 't0' | 't1'>, end = Infinity) {
  for (let i = 0; i < cues.length; i++) {
    const q = cues[i]!;
    const t1 = i + 1 < cues.length ? cues[i + 1]!.t - (base.out ?? 0.08) : end;
    if (t < q.t || t > t1 + (base.out ?? 0.08)) continue;
    slam(c, q.text, x, y, t, { ...base, t0: q.t, t1, color: q.color ?? base.color, size: q.size ?? base.size, family: q.family ?? base.family });
  }
}

/** Mono typewriter line with a block cursor; returns the drawn width. */
export function typeLine(c: CanvasRenderingContext2D, text: string, x: number, y: number, t: number, t0: number, o: { size?: number; cps?: number; color?: string; align?: CanvasTextAlign; t1?: number; cursor?: boolean; family?: string } = {}) {
  if (t < t0) return 0;
  const size = o.size ?? 30;
  const n = Math.min(text.length, Math.floor((t - t0) * (o.cps ?? 28)));
  const fade = o.t1 !== undefined ? 1 - clamp((t - o.t1) / 0.15) : 1;
  if (fade <= 0) return 0;
  c.save();
  c.font = font(o.family ?? F.mono(400), size);
  c.textBaseline = 'middle';
  const full = c.measureText(text).width;
  const x0 = o.align === 'center' ? x - full / 2 : o.align === 'right' ? x - full : x;
  const shown = text.slice(0, n);
  c.textAlign = 'left';
  c.globalAlpha = fade;
  c.lineWidth = size * 0.3;
  c.strokeStyle = HALO;
  c.strokeText(shown, x0, y);
  c.fillStyle = o.color ?? C.bone;
  c.fillText(shown, x0, y);
  if (o.cursor !== false && (n < text.length || Math.floor(t * 2.06) % 2 === 0)) {
    const w = c.measureText(shown).width;
    c.fillStyle = C.signal;
    c.fillRect(x0 + w + 4, y - size * 0.45, size * 0.55, size * 0.9);
  }
  c.restore();
  return full;
}

export type V3 = [number, number, number];
export interface CamKey { pos: V3; tgt: V3; fov: number; roll?: number }
const mix3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const mixKey = (a: CamKey, b: CamKey, k: number): CamKey => ({ pos: mix3(a.pos, b.pos, k), tgt: mix3(a.tgt, b.tgt, k), fov: a.fov + (b.fov - a.fov) * k, roll: (a.roll ?? 0) + ((b.roll ?? 0) - (a.roll ?? 0)) * k });
/** Apply a camera key; `kick` adds a small FOV punch and downward nod. */
export function applyCam(cam: THREE.PerspectiveCamera, k: CamKey, kick = 0) {
  cam.position.set(k.pos[0], k.pos[1] - kick * 0.04, k.pos[2]);
  cam.up.set(Math.sin(k.roll ?? 0), Math.cos(k.roll ?? 0), 0);
  cam.lookAt(k.tgt[0], k.tgt[1], k.tgt[2]);
  cam.fov = k.fov * (1 - kick * 0.035);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}
/** Linear-space RGB for LineBatch colours. */
export function lin(hex: string, k = 1): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * k, c.g * k, c.b * k];
}

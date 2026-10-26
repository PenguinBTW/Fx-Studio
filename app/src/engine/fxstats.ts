// Debug hook for scripts/smoke_memory.ts: live GL object counts exposed as window.__fxStats() in ?export=1 only.
// Import before the Engine is constructed so the framebuffer/texture/buffer counters see every allocation.
import type * as THREE from 'three';

const live = { framebuffers: 0, textures: 0, buffers: 0, renderbuffers: 0, programs: 0 };

export function installFxStats(): void {
  if (typeof window === 'undefined' || !new URLSearchParams(location.search).has('export')) return;
  const proto = WebGL2RenderingContext.prototype as any;
  const wrap = (create: string, del: string, key: keyof typeof live) => {
    const c = proto[create], d = proto[del];
    proto[create] = function (this: any, ...a: any[]) { const o = c.apply(this, a); if (o) live[key]++; return o; };
    proto[del] = function (this: any, o: any, ...a: any[]) { if (o) live[key]--; return d.call(this, o, ...a); };
  };
  wrap('createFramebuffer', 'deleteFramebuffer', 'framebuffers');
  wrap('createTexture', 'deleteTexture', 'textures');
  wrap('createBuffer', 'deleteBuffer', 'buffers');
  wrap('createRenderbuffer', 'deleteRenderbuffer', 'renderbuffers');
  wrap('createProgram', 'deleteProgram', 'programs');
}

export function exposeFxStats(renderer: THREE.WebGLRenderer): void {
  (window as any).__fxStats = () => ({
    heapMB: ((performance as any).memory?.usedJSHeapSize ?? 0) / 1048576,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length ?? 0,
    drawCalls: renderer.info.render.calls,
    gl: { ...live },
  });
}

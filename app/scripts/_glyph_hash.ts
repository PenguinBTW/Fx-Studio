import * as THREE from 'three';
import { createGlyphShape } from '../src/engine/vectorglyphs';
export const OLD_CHARS = 'I1LTHEFCUO0AP-_:';
export function fnv(chars: string): string {
  let h = 0x811c9dc5;
  const f = new Float32Array(1), u = new Uint32Array(f.buffer);
  for (const ch of chars) {
    const g = createGlyphShape(ch);
    const shapes = Array.isArray(g) ? g : [g!];
    const geom = new THREE.ExtrudeGeometry(shapes, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 3 });
    const p = geom.attributes.position!.array;
    for (let i = 0; i < p.length; i++) { f[0] = p[i]!; h = Math.imul(h ^ u[0]!, 0x01000193) >>> 0; }
    h = Math.imul(h ^ p.length, 0x01000193) >>> 0;
  }
  return h.toString(16);
}
if (import.meta.main) console.log(fnv(OLD_CHARS));

// Voronoi fracture of a sphere into thick wedge shards (outer cap, inner cap, side walls) with per-shard attributes:
// aC cell direction, aR random vector, aK 0 = planet surface / 1 = interior, aD original direction (surface lookup).
import * as THREE from 'three';

export function fractureSphere(radius: number, cells = 150, detail = 36, seed = 11) {
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const seeds: THREE.Vector3[] = [];
  for (let i = 0; i < cells; i++) { const y = 1 - (2 * (i + 0.5)) / cells, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    seeds.push(new THREE.Vector3(r * Math.cos(a) + 0.25 * (rnd() - 0.5), y + 0.25 * (rnd() - 0.5), r * Math.sin(a) + 0.25 * (rnd() - 0.5)).normalize()); }
  const base = new THREE.IcosahedronGeometry(1, detail); const P = base.getAttribute('position') as THREE.BufferAttribute;
  const byCell: number[][] = seeds.map(() => []); const tmp = new THREE.Vector3();
  for (let t = 0; t < P.count / 3; t++) { tmp.set(0, 0, 0); for (let k = 0; k < 3; k++) tmp.add(new THREE.Vector3().fromBufferAttribute(P, t * 3 + k)); tmp.normalize();
    let best = 0, bd = -2; for (let c = 0; c < cells; c++) { const d = seeds[c]!.dot(tmp); if (d > bd) { bd = d; best = c; } } byCell[best]!.push(t); }
  const pos: number[] = [], aC: number[] = [], aR: number[] = [], aK: number[] = [], aD: number[] = [];
  const v = (i: number) => new THREE.Vector3().fromBufferAttribute(P, i);
  const push = (p: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number[], k: number) => { pos.push(p.x, p.y, p.z); aD.push(d.x, d.y, d.z); aC.push(c.x, c.y, c.z); aR.push(...r); aK.push(k); };
  byCell.forEach((tris, c) => {
    if (!tris.length) return; const cd = seeds[c]!, depth = 0.84 + 0.07 * rnd(), r = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1];
    const edges = new Map<string, [number, number, number]>(); const key = (a: THREE.Vector3) => `${a.x.toFixed(4)},${a.y.toFixed(4)},${a.z.toFixed(4)}`;
    for (const t of tris) { const q = [v(t * 3), v(t * 3 + 1), v(t * 3 + 2)];
      for (const p of q) push(p.clone().multiplyScalar(radius), p, cd, r, 0);
      for (let k = 2; k >= 0; k--) push(q[k]!.clone().multiplyScalar(radius * depth), q[k]!, cd, r, 1);
      for (let k = 0; k < 3; k++) { const a = q[k]!, b = q[(k + 1) % 3]!; const ka = key(a), kb = key(b); const id = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const e = edges.get(id); if (e) e[2]++; else edges.set(id, [t * 3 + k, t * 3 + ((k + 1) % 3), 1]); } }
    for (const [ia, ib, n] of edges.values()) { if (n > 1) continue; const a = v(ia), b = v(ib);
      const A = a.clone().multiplyScalar(radius), B = b.clone().multiplyScalar(radius), Ai = a.clone().multiplyScalar(radius * depth), Bi = b.clone().multiplyScalar(radius * depth);
      for (const p of [A, Bi, B, A, Ai, Bi]) push(p, p.clone().normalize(), cd, r, 1 + (p === Ai || p === Bi ? 0.5 : 0)); }
  });
  base.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 3));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(aR, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(aK, 1)); g.setAttribute('aD', new THREE.Float32BufferAttribute(aD, 3));
  return g;
}

/** Closed-form shard transform: separation, outward flight, tumble. Shared by S2 (crumble) and S3 (shards fuse into the dragon). */
export const SHARD_GLSL = /* glsl */ `
attribute vec3 aC, aR, aD; attribute float aK;
mat3 rotAx(vec3 a, float t) { float c = cos(t), s = sin(t), k = 1.0 - c; return mat3(c + a.x * a.x * k, a.y * a.x * k + a.z * s, a.z * a.x * k - a.y * s,
  a.x * a.y * k - a.z * s, c + a.y * a.y * k, a.z * a.y * k + a.x * s, a.x * a.z * k + a.y * s, a.y * a.z * k - a.x * s, c + a.z * a.z * k); }
vec3 shardPos(vec3 p, float tau, float sep, float R, out mat3 M) {
  float delay = 0.5 * fract(aR.x * 13.7 + aR.y * 5.1) * (0.5 + 0.5 * dot(aC, normalize(cameraPosition)));
  float t = max(tau - delay, 0.0); float sp = 0.35 + 0.9 * fract(aR.z * 7.3 + aR.x * 2.9);
  vec3 c = aC * R * 0.94; M = rotAx(normalize(aR + vec3(0.001)), t * (0.5 + 1.6 * abs(aR.z)));
  vec3 dir = normalize(aC + 0.3 * aR);
  return c + dir * (sep * R + t * sp * 0.75 + 0.04 * t * t) + vec3(0.0, -0.05 * t * t, 0.0) + M * (p - c); }
`;

// THE END — a silent violet void. A pale porous island ringed by obsidian spires whose crystals pour light
// into a levitating egg; chorus groves on drifting outer isles; purpur towers guard the glowstone gate.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { World } from './world';
import { Sun } from './world';
import { BIRD } from './path';
import { makeSky, envFromSky, disposeEnv, islandGeometry, pbr, makeMotes, makeSurface, makePuffs, instanced, disposeTree, setTime, fbm2c, sstep, rng, type FogSpec, type PuffItem } from './common';

const SKY = /* glsl */ `
vec3 skyColor(vec3 d) {
  float n = fbm(d * 2.2 + vec3(0.0, 0.0, t * 0.004)), m = fbm(d * 5.0 + n * 1.5);
  vec3 c = vec3(0.006, 0.003, 0.014);
  c += vec3(0.05, 0.016, 0.095) * smoothstep(0.5, 0.9, n) * (0.5 + m);
  c += vec3(0.02, 0.09, 0.10) * smoothstep(0.55, 0.9, m) * smoothstep(0.4, 0.7, n);
  vec3 g = floor(d * 420.0); float h = bh31(g);
  c += vec3(1.4, 1.2, 1.8) * step(0.9975, h) * (0.6 + 0.4 * sin(t * 2.0 + h * 90.0));
  return c;
}`;
const MAIN = new THREE.Vector3(-10, -95, -588), GATE = new THREE.Vector3(0, -78.6, -722), EGG = new THREE.Vector3(-14, -30, -600);
const PATH_PTS: THREE.Vector3[] = [];
for (let t = 31; t <= 49; t += 0.08) PATH_PTS.push(BIRD.at(t));
const nearPath = (x: number, y: number, z: number) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, p.y - y, p.z - z)); return m; };
const nearPathXZ = (x: number, z: number) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, p.z - z)); return m; };

export function theEnd(renderer: THREE.WebGLRenderer): World & { plant(part: (id: string) => THREE.Object3D): void } {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.035, 0.016, 0.06), density: 0.0019, height: -60, falloff: 0.01 };
  scene.add(makeSky(SKY));
  scene.environment = envFromSky(renderer, SKY);
  scene.environmentIntensity = 1.5;
  const key = new Sun(scene, new THREE.Vector3(0.3, 1, 0.25), '#ffe6c4', 3.0, 110);
  scene.add(new THREE.HemisphereLight('#9a8cc0', '#2a2030', 0.9));
  const r = rng(1234);
  const stoneTop = new THREE.Color(1.0, 0.97, 0.72), stonePit = new THREE.Color(0.32, 0.27, 0.18), under = new THREE.Color(0.30, 0.26, 0.24);
  const stoneColor = (x: number, _y: number, z: number, slope: number, u: boolean, c: THREE.Color) => {
    const pits = Math.max(sstep(0.2, 0.5, fbm2c(x * 0.35, z * 0.35, 3, 7)) * 0.7, sstep(0.5, 0.72, fbm2c(x * 1.3, z * 1.3, 2, 9)));
    c.copy(stoneTop).lerp(stonePit, Math.min(1, pits * 1.35 + slope * 0.6));
    if (u) c.copy(under).lerp(stonePit, sstep(-0.2, 0.5, fbm2c(x * 0.1, z * 0.1 + _y * 0.1, 3, 2)) * 0.5);
  };
  const stoneMat = pbr(fog, { roughness: 0.96, side: THREE.DoubleSide });
  const island = (p: THREE.Vector3, radius: number, depth: number, seed: number, bump = 5) => {
    const g = islandGeometry({ radius, depth, seed, rings: 56, segs: 120,
      top: (x, z, s) => bump * (1 - s * s) + fbm2c(x * 0.04 + seed, z * 0.04, 4, seed) * bump * 0.6
        - 1.4 * sstep(0.55, 0.78, fbm2c(x * 0.11, z * 0.11, 2, seed + 5)) + 0.5 * fbm2c(x * 0.6, z * 0.6, 2, seed + 2), color: stoneColor });
    const m = new THREE.Mesh(g, stoneMat); m.position.copy(p); m.castShadow = m.receiveShadow = true; scene.add(m); return m;
  };
  island(MAIN, 108, 80, 3, 7);
  island(GATE, 30, 34, 8, 1.2);
  const outer: THREE.Vector3[] = [];
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = 170 + r() * 260;
    const p = new THREE.Vector3(MAIN.x + Math.cos(a) * d, MAIN.y + (r() - 0.4) * 60, MAIN.z + Math.sin(a) * d);
    if (nearPathXZ(p.x, p.z) < 40) continue;
    island(p, 14 + r() * 26, 14 + r() * 22, 20 + i, 2); outer.push(p);
  }

  // ---- obsidian spires with caged crystals, beams converging on the levitating egg
  const obs = new THREE.MeshPhysicalMaterial({ color: '#0a0710', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.8, iridescenceIOR: 1.8, metalness: 0.3 });
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#ff9ae8', emissive: new THREE.Color('#ff40c8'), emissiveIntensity: 4.5, roughness: 0.1 });
  const cageMat = new THREE.MeshStandardMaterial({ color: '#d0c0ff', emissive: new THREE.Color('#9a70ff'), emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.5 });
  const crystals: THREE.Group[] = [];
  const beamMat = /* glsl */ `vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      float f = 0.6 + 0.4 * sin(uv.y * 40.0 - t * 9.0); float core = pow(1.0 - abs(uv.x - 0.5) * 2.0, 3.0);
      return vec4(vec3(2.2, 0.7, 2.6) * f * core, 0.0); }`;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31, R = 66 + (i % 3) * 6;
    const x = MAIN.x + Math.cos(a) * R, z = MAIN.z + Math.sin(a) * R, h = 46 + ((i * 7) % 5) * 9 + r() * 6, w = 3.6 + (i % 4) * 0.9;
    if (nearPathXZ(x, z) < w + 9) continue;
    const base = MAIN.y - 4, top = MAIN.y + h;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.05, top - base, 8), obs);
    p.position.set(x, (top + base) / 2, z); p.castShadow = p.receiveShadow = true; scene.add(p);
    const g = new THREE.Group(); g.position.set(x, top + 4.5, z);
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), crystalMat));
    const cage = new THREE.Group();
    const bar = new THREE.BoxGeometry(0.16, 4.2, 0.16);
    for (const [px, pz, rx, rz] of [[2, 2, 0, 0], [2, -2, 0, 0], [-2, 2, 0, 0], [-2, -2, 0, 0], [0, 2, 0, Math.PI / 2], [0, -2, 0, Math.PI / 2], [2, 0, Math.PI / 2, 0], [-2, 0, Math.PI / 2, 0]] as const)
      for (const py of [0, 2, -2]) { if (py !== 0 && (rx || rz) === 0) continue; if (py === 0 && (rx || rz)) continue; const b = new THREE.Mesh(bar, cageMat); b.position.set(px, py, pz); b.rotation.set(rx, 0, rz); cage.add(b); }
    g.add(cage); scene.add(g); crystals.push(g);
    const pl = new THREE.PointLight('#ff60e0', 260, 55, 1.6); g.add(pl);
    const from = g.position.clone(), dir = EGG.clone().sub(from), len = dir.length();
    const beam = makeSurface(new THREE.PlaneGeometry(0.9, len).translate(0, len / 2, 0), beamMat, {}, fog, { additive: true, side: THREE.DoubleSide, noFog: true });
    beam.position.copy(from); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    beam.onBeforeRender = (_r, _s, cam) => { // turn the ribbon to face the camera around its own axis
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(beam.quaternion), to = cam.position.clone().sub(beam.position);
      const side = new THREE.Vector3().crossVectors(ax, to).normalize(), nrm = new THREE.Vector3().crossVectors(side, ax);
      beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, ax, nrm)); beam.updateMatrixWorld();
    };
    scene.add(beam);
  }
  const egg = makeSurface(new THREE.SphereGeometry(3.2, 48, 32), /* glsl */ `
    vec4 surface(vec3 wp, vec3 n, vec2 uv) { float s = fbm(wp * 1.4 + t * 0.1); vec3 V = normalize(cameraPosition - wp);
      float rim = pow(1.0 - abs(dot(n, V)), 3.0);
      return vec4(vec3(0.03, 0.0, 0.05) + vec3(1.6, 0.4, 2.4) * smoothstep(0.62, 0.8, s) + vec3(1.2, 0.5, 2.0) * rim, 1.0); }`, {}, fog);
  egg.scale.set(1, 1.3, 1); egg.position.copy(EGG); scene.add(egg);
  const eggL = new THREE.PointLight('#c060ff', 900, 120, 1.5); eggL.position.copy(EGG); scene.add(eggL);

  // ---- chorus groves: branching stalks of rounded segments tipped with pale flowers
  const chorusM: THREE.Matrix4[] = [];
  const grove = (cx: number, cz: number, rad: number, y: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (nearPathXZ(x, z) < 10) continue;
      const k = 14 + r() * 10; chorusM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.4, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(k, k * (0.85 + r() * 0.3), k)));
    }
  };
  grove(MAIN.x, MAIN.z, 95, MAIN.y + 2, 26);
  for (const p of outer) grove(p.x, p.z, 10, p.y + 1, 4);
  grove(GATE.x, GATE.z, 26, GATE.y + 0.5, 8);
  /** Blender chorus plant (assets/chorus) instanced over the grove placements. */
  const plant = (part: (id: string) => THREE.Object3D) => part('chorus').traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const om = m.material as THREE.MeshStandardMaterial;
    const im = instanced(m.geometry, pbr(fog, { vertexColors: false, color: om.color, roughness: om.roughness, emissive: om.emissive, emissiveIntensity: om.emissiveIntensity }), chorusM);
    im.castShadow = true; scene.add(im);
  });

  // ---- purpur towers flanking the gate, lit by end rods
  const purpur = pbr(fog, { vertexColors: false, color: '#a77fa8', roughness: 0.75 });
  const rod = pbr(fog, { vertexColors: false, color: '#ffffff', emissive: new THREE.Color('#fff4ff'), emissiveIntensity: 5 });
  const box = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  for (const s of [-1, 1]) {
    let y = GATE.y, w = 9;
    const x0 = GATE.x + s * 20, z0 = GATE.z + 4;
    for (let k = 0; k < 6; k++) {
      const h = 6 + r() * 5, m = new THREE.Mesh(box, purpur);
      m.scale.set(w, h, w); m.position.set(x0, y + h / 2, z0); m.castShadow = m.receiveShadow = true; scene.add(m);
      const cap = new THREE.Mesh(box, purpur); cap.scale.set(w + 2.4, 0.8, w + 2.4); cap.position.set(x0, y + h, z0); scene.add(cap);
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const rr = new THREE.Mesh(box, rod); rr.scale.set(0.22, 2.6, 0.22); rr.position.set(x0 + dx! * (w / 2 + 1), y + h + 1.6, z0 + dz! * (w / 2 + 1)); scene.add(rr); }
      y += h + 0.8; w *= k % 2 ? 0.92 : 1.06;
    }
    const l = new THREE.PointLight('#f0d8ff', 400, 60, 1.6); l.position.set(x0, GATE.y + 30, z0); scene.add(l);
  }

  // ---- void haze, ender sparks
  const haze: PuffItem[] = [];
  for (let i = 0; i < 70; i++) { const a = r() * 6.283, d = 90 + r() * 220; haze.push({ p: [MAIN.x + Math.cos(a) * d, MAIN.y - 40 - r() * 60, MAIN.z + Math.sin(a) * d], s: 30 + r() * 40, seed: r() * 30 }); }
  scene.add(makePuffs(haze, { lit: new THREE.Color(0.25, 0.1, 0.4), shade: new THREE.Color(0.02, 0.01, 0.04), sunDir: key.dir, fog, opacity: 0.5, drift: [0.2, 0.1, 0], nearFade: 20 }));
  scene.add(makeMotes({ count: 1800, box: [70, 50, 70], color: new THREE.Color(2.2, 0.8, 3.0), color2: new THREE.Color(0.6, 2.0, 1.6), size: 0.05, vel: [0, 0.6, 0], swirl: 1.2, flicker: 0.8 }));

  const lightPos = EGG.clone();
  return {
    name: 'end', scene, fog, plant, lightPos,
    update(t, _cam, bird) {
      key.follow(bird); setTime(scene, t);
      crystals.forEach((g, i) => { g.children[0]!.rotation.set(t * 0.7 + i, t * 1.1, 0); g.children[1]!.rotation.set(t * 0.4, t * 0.6 + i, t * 0.3); g.position.y += 0; });
      egg.position.y = EGG.y + Math.sin(t * 0.8) * 0.8;
      void nearPath;
    },
    post: () => ({ grade: { saturation: 1.25, gamma: 0.85 }, exposure: 1.2, bloom: 0.9, bloomThreshold: 0.9, volumetric: 0.25, volumetricDecay: 0.93, halation: 0.2, ca: 1.0 }),
    dispose() { disposeTree(scene); disposeEnv(scene); },
  };
}

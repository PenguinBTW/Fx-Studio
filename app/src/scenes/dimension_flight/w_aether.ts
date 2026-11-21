// AETHER — high, bright and weightless: an endless sea of cloud, mint-grassed isles of pale holystone,
// waterfalls unspooling into the void and golden skyroot groves; a sandstone ring waits on the last isle.
import * as THREE from 'three';
import type { World } from './world';
import { Sun } from './world';
import { BIRD } from './path';
import { makeSky, envFromSky, disposeEnv, islandGeometry, pbr, makePuffs, makeMotes, makeSurface, instanced, disposeTree, setTime, fbm2c, sstep, rng, type FogSpec, type PuffItem } from './common';

const SUN = new THREE.Vector3(0.45, 0.26, -0.7).normalize();
const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 skyColor(vec3 d) {
  vec3 zen = vec3(0.10, 0.30, 0.95), hor = vec3(0.75, 0.9, 1.25);
  vec3 c = mix(hor, zen, pow(clamp(d.y, 0.0, 1.0), 0.45));
  c = mix(c, vec3(0.95, 0.97, 1.1), smoothstep(0.05, -0.2, d.y));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.4, 1.2, 0.9) * pow(s, 12.0) * 0.6 + vec3(80.0, 70.0, 55.0) * smoothstep(0.9993, 0.9996, s);
  return c;
}`;
const SEA_Y = -112, LAST = new THREE.Vector3(0, -50.2, -961);
const PATH_PTS: THREE.Vector3[] = [];
for (let t = 47.5; t <= 65; t += 0.08) PATH_PTS.push(BIRD.at(t));
const nearPath = (x: number, y: number, z: number) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, (p.y - y) * 1.3, p.z - z)); return m; };

export function aether(renderer: THREE.WebGLRenderer): World & { plant(part: (id: string) => THREE.Object3D): void } {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.66, 0.78, 1.0), density: 0.00017, height: -100, falloff: 0.02 };
  const skyU = { uSun: { value: SUN } };
  scene.add(makeSky(SKY, skyU));
  scene.environment = envFromSky(renderer, SKY, skyU);
  scene.environmentIntensity = 0.7;
  const sun = new Sun(scene, SUN.clone(), '#ffbf6a', 4.4, 90);
  scene.add(new THREE.HemisphereLight('#8fb4ff', '#9a8060', 0.55));
  const r = rng(777);

  // ---- the sea of clouds
  const sea = makeSurface(new THREE.PlaneGeometry(3000, 2400, 1, 1).rotateX(-Math.PI / 2).translate(0, SEA_Y, -900), /* glsl */ `
    uniform vec3 uSun;
    vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      vec2 p = wp.xz * 0.012 + vec2(t * 0.01, 0.0);
      float a = fbm2(p), b = fbm2(p * 3.1 + a * 2.0 + vec2(0.0, t * 0.02));
      float h = a * 0.65 + b * 0.35;
      float lit = smoothstep(0.3, 0.8, h + 0.15 * (fbm2(p * 3.1 + a * 2.0 + vec2(0.06, t * 0.02)) - b) * 8.0);
      vec3 c = mix(vec3(0.42, 0.52, 0.8), vec3(1.25, 1.22, 1.2), lit) * mix(0.8, 1.05, h);
      return vec4(c, 1.0);
    }`, { uSun: { value: SUN } }, fog);
  scene.add(sea);

  // ---- floating isles
  const meadow = new THREE.Color(0.62, 0.72, 0.24), grass = new THREE.Color(0.08, 0.38, 0.15), grass2 = new THREE.Color(0.28, 0.58, 0.2), holy = new THREE.Color(0.62, 0.66, 0.72), holy2 = new THREE.Color(0.28, 0.32, 0.42);
  const mat = pbr(fog, { roughness: 0.9, side: THREE.DoubleSide });
  const isles: { p: THREE.Vector3; rad: number }[] = [];
  const isle = (p: THREE.Vector3, rad: number, seed: number) => {
    const g = islandGeometry({ radius: rad, depth: rad * 1.4, seed, rings: 40, segs: 90,
      top: (x, z, s) => rad * 0.12 * (1 - s * s) + fbm2c(x * 0.08 + seed, z * 0.08, 3, seed) * rad * 0.06,
      color: (x, y, z, sl0, u, c) => { const slope = Math.min(sl0, 2 - sl0);
        if (u) { c.copy(holy).lerp(holy2, sstep(-0.3, 0.5, fbm2c(x * 0.15, y * 0.15 + z * 0.1, 3, 4))); return; }
        c.copy(grass).lerp(grass2, sstep(-0.3, 0.5, fbm2c(x * 0.1, z * 0.1, 3, 2))).lerp(meadow, sstep(0.45, 0.8, fbm2c(x * 0.35, z * 0.35, 2, 5)) * 0.55).lerp(holy, sstep(0.6, 0.85, slope));
      } });
    const m = new THREE.Mesh(g, mat); m.position.copy(p); m.castShadow = m.receiveShadow = true; scene.add(m);
    isles.push({ p, rad });
  };
  isle(LAST, 22, 5);
  for (let i = 0, n = 0; i < 400 && n < 26; i++) {
    const z = -730 - r() * 300, x = (r() - 0.5) * (120 + (z + 730) * -0.4) * 2.4, y = -75 + (r() - 0.5) * 70, rad = 8 + r() * 26;
    if (nearPath(x, y, z) < rad + 14 || isles.some((o) => o.p.distanceTo(new THREE.Vector3(x, y, z)) < o.rad + rad + 10)) continue;
    isle(new THREE.Vector3(x, y, z), rad, 30 + i); n++;
  }

  // ---- skyroot groves (golden and teal) on the isles
  const skyM: THREE.Matrix4[] = [], goldM: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  for (const { p, rad } of isles) {
    const n = Math.floor(rad * 0.35);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad * 0.7, x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      const y = p.y + rad * 0.12 * (1 - (d / rad) ** 2) - 0.3, h = 3 + r() * 3, s = 2.2 + r() * 1.6;
      if (nearPath(x, y + h + s, z) < 6 || (p === LAST && d < 13)) continue;
      const gold = r() < 0.4;
      e.set(0, r() * Math.PI * 2, 0); q.setFromEuler(e); const k = (h + s) * 1.15;
      (gold ? goldM : skyM).push(new THREE.Matrix4().compose(v.set(x, y - 0.2, z), q, s3.set(k, k * (gold ? 1 : 1.2), k)));
    }
  }
  /** Blender Skyroot + Golden Oak (assets/skyroot) instanced over the grove placements. */
  const plant = (part: (id: string) => THREE.Object3D) => {
    for (const [id, ms] of [['skyroot', skyM], ['golden', goldM]] as const) part(id).traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const om = m.material as THREE.MeshStandardMaterial, glow = om.name === 'GoldenLeaves';
      const im = instanced(m.geometry, pbr(fog, { vertexColors: false, color: om.color, roughness: om.roughness, emissive: glow ? new THREE.Color('#6a3a00') : new THREE.Color(0), emissiveIntensity: glow ? 0.6 : 0 }), ms);
      im.castShadow = true; scene.add(im);
    });
  };

  // ---- waterfalls spilling off isle rims into the cloud sea
  const fall = /* glsl */ `vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      float f = fbm(vec3(uv.x * 9.0, uv.y * 2.0 + t * 1.8, 1.0)), g = fbm(vec3(uv.x * 23.0, uv.y * 6.0 + t * 3.0, 4.0));
      float edge = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x) * smoothstep(0.0, 0.15, uv.y);
      vec3 c = mix(vec3(0.45, 0.65, 0.95), vec3(1.7, 1.8, 1.9), smoothstep(0.4, 0.75, f * 0.6 + g * 0.5));
      float a = edge * smoothstep(0.25, 0.55, f + g * 0.3) * 0.9;
      return vec4(c * a, a); }`;
  const mist: PuffItem[] = [];
  isles.slice(1, 9).forEach(({ p, rad }, i) => {
    const a = i * 2.1, x = p.x + Math.cos(a) * rad * 0.95, z = p.z + Math.sin(a) * rad * 0.95, w = 5 + rad * 0.35;
    const top = p.y + 0.2, len = top - SEA_Y + 4;
    const m = makeSurface(new THREE.PlaneGeometry(w, len, 1, 1).translate(0, -len / 2, 0), fall, {}, fog, { transparent: true, side: THREE.DoubleSide });
    m.position.set(x, top, z); m.rotation.y = -a + Math.PI / 2; scene.add(m);
    for (let j = 0; j < 7; j++) mist.push({ p: [x + (r() - 0.5) * 14, SEA_Y + 6 + r() * 10, z + (r() - 0.5) * 14], s: 10 + r() * 9, seed: r() * 40 });
  });

  // ---- billowing cumulus, golden aerclouds
  const cl: PuffItem[] = [...mist];
  for (let c = 0; c < 60; c++) {
    const cx = (r() - 0.5) * 900, cz = -650 - r() * 600, cy = SEA_Y + 10 + r() * 90;
    if (nearPath(cx, cy, cz) < 45) continue;
    const n = 5 + Math.floor(r() * 7), gold = r() < 0.18;
    for (let j = 0; j < n; j++) cl.push({ p: [cx + (r() - 0.5) * 50, cy + r() * 16, cz + (r() - 0.5) * 40], s: 12 + r() * 16, seed: r() * 100, tint: gold ? 1 : 0 });
  }
  scene.add(makePuffs(cl, { lit: new THREE.Color(1.75, 1.62, 1.45), shade: new THREE.Color(0.3, 0.4, 0.72), sunDir: SUN, fog, opacity: 0.95, drift: [1.0, 0, 0], nearFade: 14 }));
  scene.add(makeMotes({ count: 1600, box: [70, 40, 70], color: new THREE.Color(2.6, 2.2, 1.2), color2: new THREE.Color(1.6, 2.2, 2.6), size: 0.04, vel: [0.6, 0.3, 0], swirl: 1.0, flicker: 0.6 }));

  const lightPos = new THREE.Vector3();
  return {
    name: 'aether', scene, fog, lightPos, plant,
    update(t, cam, bird) { sun.follow(bird); setTime(scene, t); lightPos.copy(cam.position).addScaledVector(SUN, 4000); },
    post: () => ({ grade: { saturation: 1.42, gamma: 0.82, gain: 1.0 }, exposure: 0.84, bloom: 0.55, bloomThreshold: 1.3, volumetric: 0.3, volumetricDecay: 0.94, halation: 0.12, ca: 0.6 }),
    dispose() { disposeTree(scene); disposeEnv(scene); },
  };
}

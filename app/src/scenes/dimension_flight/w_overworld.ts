// OVERWORLD — dawn over a terraced river valley: soft-stepped hills, cube-canopied groves, cherry blossom,
// a glassy river and, on a scorched knoll at the valley's end, a ruined obsidian gate.
import * as THREE from 'three';
import type { World } from './world';
import { BIRD } from './path';
import { Sun } from './world';
import { makeSky, envFromSky, disposeEnv, terrainGeometry, pbr, makePuffs, makeMotes, makeSurface, instanced, disposeTree, setTime, fbm2c, ridged, sstep, rng, type FogSpec, type PuffItem } from './common';

const SUN = new THREE.Vector3(-0.75, 0.2, -0.75).normalize();
const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 zen = vec3(0.06, 0.18, 0.55), hor = vec3(1.1, 0.7, 0.48), low = vec3(0.55, 0.42, 0.40);
  vec3 c = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.35));
  c = mix(c, low, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.6, 0.85, 0.42) * pow(s, 8.0) * 0.9 + vec3(2.0, 1.2, 0.6) * pow(s, 64.0) * 1.5;
  c += vec3(60.0, 42.0, 24.0) * smoothstep(0.99935, 0.9997, s);
  // high cirrus catching the dawn
  vec2 p = d.xz / max(d.y + 0.08, 0.03);
  float ci = smoothstep(0.55, 0.95, fbm2(p * 0.35 + vec2(t * 0.004, 0.0))) * smoothstep(0.0, 0.25, h);
  c = mix(c, vec3(1.5, 0.9, 0.7) * (0.6 + 0.8 * pow(s, 3.0)), ci * 0.75);
  return c;
}`;

const riverX = (z: number) => 18 * Math.sin(z * 0.011) + 9 * Math.sin(z * 0.027 + 1.3);
const KNOLL = new THREE.Vector2(0, -236);
export function owHeight(x: number, z: number) {
  const d = Math.abs(x - riverX(z));
  let h = Math.pow(d / 42, 1.5) * 16 + fbm2c(x * 0.012, z * 0.012, 5, 3) * 22 * sstep(8, 70, d);
  h += sstep(140, 420, d) * (70 + 160 * ridged(x * 0.004, z * 0.004, 5, 9));
  h += sstep(120, 300, d) * 7 * ridged(x * 0.028, z * 0.028, 3, 4);  // rocky crags on the high slopes
  // soft terracing: hints of stacked layers without hard voxels
  const L = 3.2, q = h / L, fq = q - Math.floor(q);
  h = THREE.MathUtils.lerp(h, (Math.floor(q) + Math.pow(sstep(0.35, 0.65, fq), 1.0)) * L, 0.55 * sstep(6, 14, d));
  h -= 3.2 * Math.exp(-Math.pow(d / 6, 2));
  const kd = Math.hypot(x - KNOLL.x, (z - KNOLL.y) * 0.8);
  h = Math.max(h, 6.2 - Math.pow(kd / 26, 2) * 6 + fbm2c(x * 0.08, z * 0.08, 3, 5) * 0.6 * sstep(4, 12, kd));
  return h;
}

const PATH_PTS: THREE.Vector3[] = [];
for (let t = -2; t <= 17.5; t += 0.1) PATH_PTS.push(BIRD.at(t));
function nearPath(x: number, y: number, z: number) {
  let m = 1e9;
  for (const p of PATH_PTS) { const d = Math.hypot(p.x - x, Math.max(0, y - p.y) * 1.5, p.z - z); if (d < m) m = d; }
  return m;
}

export function overworld(renderer: THREE.WebGLRenderer): World & { plant(part: (id: string) => THREE.Object3D): void } {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.9, 0.7, 0.52), density: 0.0006, height: 4, falloff: 0.03 };
  const skyU = { uSun: { value: SUN } };
  scene.add(makeSky(SKY, skyU));
  scene.environment = envFromSky(renderer, SKY, skyU);
  scene.environmentIntensity = 0.55;
  const sun = new Sun(scene, SUN.clone(), '#ffd7a8', 3.4, 80);
  scene.add(new THREE.HemisphereLight('#9fb8ff', '#4a5a2a', 0.55));

  // ---- terrain
  const grassA = new THREE.Color(0.10, 0.24, 0.05), grassB = new THREE.Color(0.24, 0.36, 0.07), rock = new THREE.Color(0.30, 0.27, 0.24);
  const snow = new THREE.Color(0.95, 0.93, 0.98), sand = new THREE.Color(0.55, 0.48, 0.33), scorch = new THREE.Color(0.22, 0.035, 0.03);
  const terr = terrainGeometry({
    x0: -900, x1: 900, z0: -1000, z1: 300, nx: 420, nz: 330, height: owHeight,
    color: (x, y, z, slope, c) => {
      c.copy(grassA).lerp(grassB, sstep(-0.4, 0.6, fbm2c(x * 0.03, z * 0.03, 3, 1)));
      c.lerp(rock, sstep(0.18, 0.42, slope + fbm2c(x * 0.1, z * 0.1, 2, 2) * 0.1));
      c.lerp(sand, sstep(1.6, 0.2, y));
      c.lerp(snow, sstep(95, 130, y + fbm2c(x * 0.02, z * 0.02, 3, 4) * 25) * sstep(0.6, 0.3, slope));
      const kd = Math.hypot(x - KNOLL.x, z - KNOLL.y) + fbm2c(x * 0.15, z * 0.15, 3, 6) * 6;
      c.lerp(scorch, sstep(20, 9, kd));
    },
  });
  const ground = new THREE.Mesh(terr, pbr(fog, { roughness: 0.95 }));
  ground.receiveShadow = true; ground.castShadow = true;
  scene.add(ground);

  // ---- river: glassy dawn reflections
  const water = makeSurface(new THREE.PlaneGeometry(1800, 1300, 1, 1).rotateX(-Math.PI / 2).translate(0, 0.3, -350), /* glsl */ `
    uniform vec3 uSun;
    vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      vec2 g = vec2(fbm2(wp.xz * 0.35 + vec2(0.0, t * 0.6)), fbm2(wp.xz * 0.35 + vec2(5.2, t * 0.5))) - 0.5;
      vec2 g2 = vec2(fbm2(wp.xz * vec2(1.6, 0.5) + vec2(0.0, t * 1.4)), fbm2(wp.xz * vec2(1.6, 0.5) + vec2(3.1, t * 1.2))) - 0.5;
      vec3 N = normalize(vec3(g.x * 0.22 + g2.x * 0.1, 1.0, g.y * 0.22 + g2.y * 0.1));
      vec3 V = normalize(cameraPosition - wp), R = reflect(-V, N);
      float fr = 0.12 + 0.88 * pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 sky = mix(vec3(1.2, 0.75, 0.5), vec3(0.15, 0.3, 0.6), pow(clamp(R.y, 0.0, 1.0), 0.5));
      vec3 deep = vec3(0.02, 0.07, 0.08);
      vec3 c = mix(deep, sky, fr) + vec3(30.0, 18.0, 9.0) * pow(max(dot(R, uSun), 0.0), 900.0);
      return vec4(c, 1.0);
    }`, { uSun: { value: SUN } }, fog);
  water.receiveShadow = true;
  scene.add(water);

  // ---- groves: oak, birch and cherry with soft cubic canopies
  const r = rng(42);
  const oakM: THREE.Matrix4[] = [], cherryM: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  for (let i = 0; i < 26000 && oakM.length + cherryM.length < 5200; i++) {
    const x = (r() - 0.5) * 760, z = 160 - r() * 900;
    const y = owHeight(x, z);
    const d = Math.abs(x - riverX(z));
    const slope = Math.abs(owHeight(x + 2, z) - y) + Math.abs(owHeight(x, z + 2) - y);
    const kd = Math.hypot(x - KNOLL.x, z - KNOLL.y);
    const dens = sstep(-0.2, 0.35, fbm2c(x * 0.008, z * 0.008, 3, 77));
    if (y < 1.4 || y > 80 || d < 9 || kd < 26 || slope > 2.6 || r() > dens) continue;
    if (nearPath(x, y + 9, z) < 20) continue;
    const cherry = fbm2c(x * 0.005 + 3, z * 0.005, 2, 12) > 0.18, birch = !cherry && r() < 0.22;
    const hgt = (birch ? 5.5 : 3.6) + r() * 2.5, s = (cherry ? 3.4 : 2.7) + r() * 1.4;
    e.set((r() - 0.5) * 0.2, r() * Math.PI * 2, (r() - 0.5) * 0.2); q.setFromEuler(e); const k = (hgt + s) * (cherry ? 1.05 : 1.0) * (0.65 + r() * 0.75);
    (cherry ? cherryM : oakM).push(new THREE.Matrix4().compose(pos.set(x, y - 0.3, z), q, scl.set(k, k * (birch ? 1.25 : 1), k)));
  }
  /** Blender tree asset (assets/trees: meshes Oak, Cherry) -> one fogged InstancedMesh per material primitive. */
  const plant = (part: (id: string) => THREE.Object3D) => {
    for (const [name, ms] of [['oak', oakM], ['cherry', cherryM]] as const) {
      const node = part(name);
      node.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const om = m.material as THREE.MeshStandardMaterial;
        const im = instanced(m.geometry, withFogStd(fog, { color: om.color, roughness: om.roughness }), ms);
        im.castShadow = im.receiveShadow = true; scene.add(im);
      });
    }
  };

  // ---- clouds: towering dawn cumulus
  const cl: PuffItem[] = [];
  for (let c = 0; c < 46; c++) {
    const cx = (r() - 0.5) * 1100, cz = 200 - r() * 1200, cy = 75 + r() * 45;
    if (Math.abs(cx) < 40 && cz > -260) continue;
    const n = 6 + Math.floor(r() * 8);
    for (let j = 0; j < n; j++) cl.push({ p: [cx + (r() - 0.5) * 70, cy + r() * 22 * (1 - j / n), cz + (r() - 0.5) * 45], s: 16 + r() * 18, seed: r() * 100 });
  }
  scene.add(makePuffs(cl, { lit: new THREE.Color(1.7, 1.15, 0.85), shade: new THREE.Color(0.38, 0.36, 0.5), sunDir: SUN, fog, opacity: 0.95, drift: [0.6, 0, -0.3], nearFade: 14 }));

  // ---- drifting pollen & blossom petals in the low sun
  scene.add(makeMotes({ count: 2200, box: [70, 36, 70], color: new THREE.Color(2.4, 1.7, 0.9), color2: new THREE.Color(2.2, 1.0, 1.3), size: 0.045, vel: [0.5, -0.15, 0.2], swirl: 0.8, flicker: 0.4 }));

  const lightPos = new THREE.Vector3();
  return {
    name: 'overworld', scene, fog, lightPos, plant,
    update(t, cam, bird) {
      sun.follow(bird); setTime(scene, t);
      lightPos.copy(cam.position).addScaledVector(SUN, 4000);
    },
    post: () => ({ grade: { saturation: 1.25, gamma: 0.85, gain: 1.05 }, volumetric: 0.32, volumetricDecay: 0.94, exposure: 1.0, bloom: 0.5, bloomThreshold: 1.2 }),
    dispose() { disposeTree(scene); disposeEnv(scene); },
  };
}

function withFogStd(fog: FogSpec, p: THREE.MeshStandardMaterialParameters) {
  return pbr(fog, { ...p, vertexColors: false });
}

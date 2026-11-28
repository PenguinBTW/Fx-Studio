// THE SIFT — an original dimension: a desert at the end of time. Wind-carved golden dunes under a vast low sun,
// inverted sieve-isles pouring rivers of sand, half-buried colonnades and a colossal hourglass on the horizon.
import * as THREE from 'three';
import type { World } from './world';
import { Sun } from './world';
import { BIRD } from './path';
import { makeSky, envFromSky, disposeEnv, terrainGeometry, islandGeometry, pbr, makePuffs, makeMotes, makeSurface, disposeTree, setTime, fbm2c, sstep, rng, type FogSpec, type PuffItem } from './common';

const SUN = new THREE.Vector3(0.55, 0.08, -0.83).normalize();
const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 skyColor(vec3 d) {
  float h = d.y, s = max(dot(d, uSun), 0.0);
  vec3 c = mix(vec3(1.5, 0.6, 0.24), vec3(0.32, 0.15, 0.36), pow(clamp(h, 0.0, 1.0), 0.5));
  c = mix(c, vec3(0.10, 0.07, 0.16), smoothstep(0.35, 0.9, h));
  c = mix(c, vec3(0.9, 0.45, 0.22), smoothstep(0.0, -0.2, h));
  c += vec3(1.1, 0.45, 0.15) * pow(s, 8.0) + vec3(3.0, 1.6, 0.6) * pow(s, 80.0);
  c += vec3(40.0, 22.0, 9.0) * smoothstep(0.9975, 0.9985, s);
  vec2 p = d.xz / max(d.y + 0.05, 0.02);
  float st = smoothstep(0.5, 0.85, fbm2(vec2(p.x * 0.25, p.y * 0.05) + t * 0.003)) * smoothstep(0.0, 0.12, h) * smoothstep(0.5, 0.15, h);
  c = mix(c, vec3(2.6, 0.9, 0.5) * (0.4 + pow(s, 4.0) * 2.0), st * 0.5);
  return c;
}`;
const HG = new THREE.Vector3(0, -82, -1335);
const PATH_PTS: THREE.Vector3[] = [];
for (let t = 63.5; t <= 84; t += 0.08) PATH_PTS.push(BIRD.at(t));
const nearPath = (x: number, y: number, z: number) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, p.y - y, p.z - z)); return m; };
export const duneH = (x: number, z: number) => {
  const w = fbm2c(x * 0.004, z * 0.004, 3, 3) * 6;
  const u = z * 0.028 + x * 0.011 + w, ridge = 1 - Math.abs(Math.sin(u));
  return -86 + 13 * Math.pow(ridge, 1.6) + 9 * fbm2c(x * 0.006, z * 0.006, 4, 8) + 18 * sstep(150, 420, Math.abs(x));
};

export function sift(renderer: THREE.WebGLRenderer): World {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.62, 0.3, 0.2), density: 0.00045, height: -85, falloff: 0.03 };
  const skyU = { uSun: { value: SUN } };
  scene.add(makeSky(SKY, skyU));
  scene.environment = envFromSky(renderer, SKY, skyU);
  scene.environmentIntensity = 0.5;
  const sun = new Sun(scene, SUN.clone().setY(0.16).normalize(), '#ffb070', 4.2, 90);
  scene.add(new THREE.HemisphereLight('#5a3a80', '#a05a30', 0.4));
  const r = rng(4321);

  // ---- dunes, with wind ripples on the lee faces
  const s1 = new THREE.Color(0.85, 0.52, 0.2), s2 = new THREE.Color(0.6, 0.3, 0.12), s3 = new THREE.Color(0.95, 0.7, 0.36);
  const dunes = new THREE.Mesh(terrainGeometry({
    x0: -900, x1: 900, z0: -1700, z1: -850, nx: 460, nz: 300, height: duneH,
    color: (x, y, z, slope, c) => {
      c.copy(s1).lerp(s2, sstep(0.15, 0.45, slope)).lerp(s3, sstep(0.5, 0.9, fbm2c(x * 0.03, z * 0.03, 2, 1) + 0.4) * 0.5);
      c.multiplyScalar(0.92 + 0.08 * Math.sin(z * 1.3 + x * 0.4 + fbm2c(x * 0.05, z * 0.05, 2, 5) * 6));
    },
  }), pbr(fog, { roughness: 1 }));
  dunes.receiveShadow = dunes.castShadow = true; scene.add(dunes);

  // ---- sieve-isles pouring sand
  const stone = pbr(fog, { roughness: 0.9, side: THREE.DoubleSide });
  const pour = /* glsl */ `vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      float f = fbm(vec3(uv.x * 8.0, uv.y * 3.0 + t * 1.2, 2.0)), g = fbm(vec3(uv.x * 30.0, uv.y * 10.0 + t * 4.0, 7.0));
      float edge = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);
      vec3 c = mix(vec3(0.8, 0.42, 0.15), vec3(2.6, 1.5, 0.6), smoothstep(0.35, 0.75, f * 0.7 + g * 0.4));
      float a = edge * smoothstep(0.2, 0.5, f + g * 0.3) * 0.95; return vec4(c * a, a); }`;
  const dust: PuffItem[] = [];
  const sieves: THREE.Object3D[] = [];
  for (let i = 0, n = 0; i < 300 && n < 11; i++) {
    const x = (r() - 0.5) * 420, z = -1000 - r() * 420, y = -20 + r() * 50, rad = 9 + r() * 14;
    if (nearPath(x, y, z) < rad + 18 || Math.abs(x) < 30 && z < -1240) continue;
    const g = islandGeometry({ radius: rad, depth: rad * 1.9, seed: 70 + i, rings: 30, segs: 72, top: (_x, _z, s) => 0.8 * (1 - s * s),
      color: (x2, y2, z2, _sl, u, c) => c.copy(u ? s2 : s3).lerp(s1, sstep(-0.3, 0.5, fbm2c(x2 * 0.2, y2 * 0.3 + z2 * 0.2, 2, 4))) });
    const m = new THREE.Mesh(g, stone); m.position.set(x, y, z); m.castShadow = true; scene.add(m); sieves.push(m);
    const ground = duneH(x, z), top = y - rad * 1.5, len = top - ground + 2, w = 1.6 + rad * 0.12;
    const f = makeSurface(new THREE.PlaneGeometry(w, len, 1, 1).translate(0, -len / 2, 0), pour, {}, fog, { transparent: true, side: THREE.DoubleSide });
    f.position.set(x, top, z); f.rotation.y = r() * 3; scene.add(f);
    for (let j = 0; j < 7; j++) dust.push({ p: [x + (r() - 0.5) * 14, ground + 2 + r() * 6, z + (r() - 0.5) * 14], s: 7 + r() * 8, seed: r() * 60 });
    n++;
  }

  // ---- half-buried colonnades
  const col = pbr(fog, { vertexColors: false, color: '#d4a46a', roughness: 0.85 });
  const shaft = new THREE.CylinderGeometry(1.6, 1.8, 1, 16), cap = new THREE.BoxGeometry(4.6, 1.4, 4.6);
  for (let k = 0; k < 7; k++) {
    const cx = (k % 2 ? 1 : -1) * (40 + r() * 70), cz = -1010 - k * 50 - r() * 20, ang = r() * 3;
    for (let i = 0; i < 6; i++) {
      const x = cx + Math.cos(ang) * i * 9, z = cz + Math.sin(ang) * i * 9, g = duneH(x, z), h = 6 + r() * 22;
      if (nearPath(x, g + h, z) < 10) continue;
      const m = new THREE.Mesh(shaft, col); m.scale.set(1, h, 1); m.position.set(x, g + h / 2 - 2, z); m.rotation.z = (r() - 0.5) * 0.12; m.castShadow = m.receiveShadow = true; scene.add(m);
      if (r() < 0.7) { const c = new THREE.Mesh(cap, col); c.position.set(x, g + h - 1.4, z); c.castShadow = true; scene.add(c); }
    }
  }

  // ---- the great hourglass
  const hg = new THREE.Group(); hg.position.copy(HG); scene.add(hg);
  const gold = pbr(fog, { vertexColors: false, color: '#e8b048', metalness: 1, roughness: 0.25 });
  const H = 120, Rb = 34;
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 40; i++) { const y = (i / 40) * H, k = Math.abs(y / H - 0.5) * 2; prof.push(new THREE.Vector2(2.4 + (Rb - 2.4) * Math.pow(k, 1.8) * (1 - 0.15 * Math.pow(k, 8)), y)); }
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffe8d0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, envMapIntensity: 2.5 });
  hg.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 64), glass));
  for (const y of [0, H]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(Rb + 6, Rb + 7, 5, 48), gold); d.position.y = y + (y ? 2.5 : -2.5); d.castShadow = true; hg.add(d); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, H, 12), gold); p.position.set(Math.cos(a) * (Rb + 3.5), H / 2, Math.sin(a) * (Rb + 3.5)); p.castShadow = true; hg.add(p); }
  const sandIn = pbr(fog, { vertexColors: false, color: '#e0a050', emissive: new THREE.Color('#ff8a30'), emissiveIntensity: 0.6, roughness: 1 });
  const top = new THREE.Mesh(new THREE.ConeGeometry(Rb * 0.62, H * 0.24, 48, 1, false), sandIn); top.rotation.x = Math.PI; top.position.y = H * 0.62; hg.add(top);
  const bot = new THREE.Mesh(new THREE.ConeGeometry(Rb * 0.85, H * 0.2, 48), sandIn); bot.position.y = H * 0.1; hg.add(bot);
  const stream = makeSurface(new THREE.PlaneGeometry(1.4, H * 0.42, 1, 1), pour, {}, fog, { transparent: true, side: THREE.DoubleSide });
  stream.position.y = H * 0.36; hg.add(stream);
  const hl = new THREE.PointLight('#ffa050', 3000, 160, 1.5); hl.position.set(0, H * 0.4, 0); hg.add(hl);

  // ---- drifting sand haze and grains
  for (let i = 0; i < 90; i++) { const z = -980 - r() * 500; dust.push({ p: [(r() - 0.5) * 500, duneH(0, z) + 3 + r() * 10, z], s: 16 + r() * 18, seed: r() * 80 }); }
  scene.add(makePuffs(dust, { lit: new THREE.Color(2.2, 1.15, 0.55), shade: new THREE.Color(0.45, 0.22, 0.2), sunDir: SUN, fog, opacity: 0.12, drift: [2.0, 0.2, 0], nearFade: 14 }));
  scene.add(makeMotes({ count: 2600, box: [70, 36, 70], color: new THREE.Color(3.0, 1.7, 0.7), color2: new THREE.Color(2.0, 1.0, 0.45), size: 0.035, vel: [3.0, -0.3, 0.4], swirl: 0.6, flicker: 0.5 }));

  const lightPos = new THREE.Vector3();
  return {
    name: 'sift', scene, fog, lightPos,
    update(t, cam, bird) {
      sun.follow(bird); setTime(scene, t); lightPos.copy(cam.position).addScaledVector(SUN, 4000);
      sieves.forEach((s, i) => { s.rotation.y = t * 0.05 * (i % 2 ? 1 : -1); });
      stream.lookAt(cam.position.x, stream.getWorldPosition(new THREE.Vector3()).y, cam.position.z); stream.rotation.x = 0; stream.rotation.z = 0;
    },
    post: () => ({ exposure: 1.0, bloom: 0.5, bloomThreshold: 1.4, volumetric: 0.22, volumetricDecay: 0.93, halation: 0.12, ca: 0.6 }),
    dispose() { disposeTree(scene); disposeEnv(scene); },
  };
}

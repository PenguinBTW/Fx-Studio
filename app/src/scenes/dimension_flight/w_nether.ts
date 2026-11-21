// NETHER — a cathedral cavern over a breathing lava sea: basalt deltas, a crimson grove and a warped grove,
// lavafalls from the roof, glowstone chandeliers and, on an ancient stone pylon, the frame of the End gate.
import * as THREE from 'three';
import { LargeParticles } from '../../engine/particles_large';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { World } from './world';
import { Sun } from './world';
import { BIRD } from './path';
import { makeSky, envFromSky, disposeEnv, terrainGeometry, pbr, makePuffs, makeMotes, makeSurface, instanced, disposeTree, setTime, fbm2c, ridged, sstep, rng, type FogSpec, type PuffItem } from './common';

const SKY = /* glsl */ `vec3 skyColor(vec3 d) { return mix(vec3(0.35, 0.06, 0.03), vec3(0.06, 0.01, 0.01), clamp(d.y * 1.5 + 0.3, 0.0, 1.0)); }`;
const LAVA_Y = -6;
const CRIMSON = new THREE.Vector2(-58, -318), WARPED = new THREE.Vector2(62, -395), PYLON = new THREE.Vector2(0, -470);

const PATH_PTS: THREE.Vector3[] = [];
for (let t = 15.5; t <= 33; t += 0.08) PATH_PTS.push(BIRD.at(t));
const nearPath = (x: number, y: number, z: number) => {
  let m = 1e9; for (const p of PATH_PTS) { const d = Math.hypot(p.x - x, Math.max(0, y - p.y), p.z - z); if (d < m) m = d; } return m;
};

function floorH(x: number, z: number) {
  let h = LAVA_Y - 8 + fbm2c(x * 0.02, z * 0.02, 5, 21) * 14;
  h += sstep(0.15, 0.6, fbm2c(x * 0.006, z * 0.006, 3, 4)) * 22 * (0.6 + 0.4 * ridged(x * 0.03, z * 0.03, 3, 8));
  const ax = Math.abs(x);
  h += sstep(80, 190, ax) * (110 + 120 * ridged(x * 0.008, z * 0.008, 5, 31));
  const mesa = (c: THREE.Vector2, r: number, top: number) => {
    const d = Math.hypot(x - c.x, z - c.y) / r + fbm2c(x * 0.05, z * 0.05, 3, 2) * 0.25;
    return top - Math.pow(Math.max(0, d - 0.65) * 3.2, 2) * 18;
  };
  h = Math.max(h, mesa(CRIMSON, 46, 4), mesa(WARPED, 44, 10));
  // the stronghold rises on its own: carve the lava clear around the pylon
  h = Math.min(h, THREE.MathUtils.lerp(LAVA_Y - 10, h, sstep(18, 50, Math.hypot(x - PYLON.x, z - PYLON.y))));
  // keep the flight corridor open above the lava
  return h;
}
const ceilH = (x: number, z: number) => 150 - 26 * fbm2c(x * 0.012, z * 0.012, 5, 51) - 40 * Math.pow(Math.max(0, ridged(x * 0.03, z * 0.03, 3, 5) - 0.45), 2) * 6 - sstep(60, 200, Math.abs(x)) * 60;

export function nether(renderer: THREE.WebGLRenderer): World & { plant(part: (id: string) => THREE.Object3D): void } {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.16, 0.028, 0.014), density: 0.0014, height: 6, falloff: 0.015 };
  scene.add(makeSky(SKY));
  scene.environment = envFromSky(renderer, SKY);
  scene.environmentIntensity = 0.3;
  const key = new Sun(scene, new THREE.Vector3(0.35, 0.55, -0.8), '#ff8a4a', 1.2, 80);
  scene.add(new THREE.HemisphereLight('#3a0e08', '#ff5a18', 0.75));

  // ---- cavern floor, walls and roof
  const rack = new THREE.Color(0.25, 0.045, 0.035), rack2 = new THREE.Color(0.14, 0.03, 0.03), soul = new THREE.Color(0.17, 0.11, 0.08);
  const basalt = new THREE.Color(0.07, 0.07, 0.08), crimsonNy = new THREE.Color(0.42, 0.02, 0.04), warpedNy = new THREE.Color(0.03, 0.3, 0.27), mag = new THREE.Color(0.9, 0.25, 0.04);
  const floor = new THREE.Mesh(terrainGeometry({
    x0: -500, x1: 500, z0: -800, z1: -120, nx: 400, nz: 280, height: floorH,
    color: (x, y, z, slope, c) => {
      c.copy(rack).lerp(rack2, sstep(-0.3, 0.5, fbm2c(x * 0.05, z * 0.05, 3, 9)));
      c.lerp(soul, sstep(0.25, 0.55, fbm2c(x * 0.01 + 4, z * 0.01, 3, 3)) * sstep(0.4, 0.1, slope));
      c.lerp(basalt, sstep(0.3, 0.6, slope));
      c.lerp(mag, sstep(LAVA_Y + 2, LAVA_Y, y) * 0.8);
      c.lerp(crimsonNy, sstep(40, 30, Math.hypot(x - CRIMSON.x, z - CRIMSON.y)) * sstep(0.35, 0.1, slope));
      c.lerp(warpedNy, sstep(38, 28, Math.hypot(x - WARPED.x, z - WARPED.y)) * sstep(0.35, 0.1, slope));
    },
  }), pbr(fog, { roughness: 0.92 }));
  floor.receiveShadow = floor.castShadow = true; scene.add(floor);
  const roof = new THREE.Mesh(terrainGeometry({ x0: -500, x1: 500, z0: -800, z1: -120, nx: 200, nz: 140, height: ceilH,
    color: (x, _y, z, _s, c) => c.copy(rack2).lerp(rack, sstep(-0.2, 0.5, fbm2c(x * 0.04, z * 0.04, 2, 2))) }),
    pbr(fog, { roughness: 0.95, side: THREE.DoubleSide }));
  scene.add(roof);

  // ---- the lava sea
  const lava = makeSurface(new THREE.PlaneGeometry(1200, 900, 1, 1).rotateX(-Math.PI / 2).translate(0, LAVA_Y, -460), /* glsl */ `
    vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      vec2 p = wp.xz * 0.045;
      float a = fbm2(p + vec2(t * 0.05, t * 0.03)), b = fbm2(p * 2.3 - vec2(t * 0.08, 0.0) + a * 1.7);
      float crack = smoothstep(0.5, 0.36, abs(b - 0.5) * 2.0 + a * 0.45);
      float pulse = 0.75 + 0.25 * sin(t * 1.3 + a * 12.0);
      vec3 crust = vec3(0.05, 0.012, 0.008) * (0.6 + a);
      vec3 hot = mix(vec3(2.2, 0.32, 0.03), vec3(7.0, 2.6, 0.45), smoothstep(0.7, 1.0, crack * b * 1.4));
      vec3 c = mix(crust, hot * pulse, crack);
      c += vec3(0.9, 0.12, 0.015) * (1.0 - crack) * smoothstep(0.45, 0.85, b) * 0.45;
      return vec4(c, 1.0);
    }`, {}, fog);
  scene.add(lava);

  const r = rng(666);
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

  // ---- basalt deltas: hexagonal columns rising from the lava
  const colM: THREE.Matrix4[] = [], colC: THREE.Color[] = [];
  const deltas: [number, number, number][] = [[-30, -255, 26], [28, -290, 30], [-36, -360, 22], [20, -335, 18], [-24, -430, 24], [30, -445, 20], [0, -520, 40], [-60, -470, 30]];
  for (const [cx, cz, rad] of deltas) for (let i = 0; i < 230; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const top = LAVA_Y + (1 - d / rad) * (8 + r() * 26) + r() * 3;
    if (nearPath(x, top + 2.5, z) < 7 || Math.hypot(x - PYLON.x, z - PYLON.y) < 16) continue;
    const w = 0.9 + r() * 1.4, base = LAVA_Y - 4;
    colM.push(M(x, (top + base) / 2, z, w, top - base, w, r() * 1.05));
    const g = 0.05 + r() * 0.05; colC.push(new THREE.Color(g, g, g * 1.15));
  }
  scene.add(instanced(new THREE.CylinderGeometry(1, 1, 1, 6), pbr(fog, { vertexColors: false, roughness: 0.6, metalness: 0.1, color: '#ffffff', flatShading: true }), colM, colC));

  // ---- giant fungi on the two plateaus
  const crimsonM: THREE.Matrix4[] = [], warpedM: THREE.Matrix4[] = [];
  const stemM: THREE.Matrix4[] = [], stemC: THREE.Color[] = [], capM: THREE.Matrix4[] = [], capC: THREE.Color[] = [], lightM: THREE.Matrix4[] = [], lightC: THREE.Color[] = [];
  for (const [c, warped] of [[CRIMSON, false], [WARPED, true]] as const) for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 34, x = c.x + Math.cos(a) * d, z = c.y + Math.sin(a) * d;
    const y = floorH(x, z), h = 7 + r() * 16 + (d < 12 ? 10 : 0), cw = 4 + h * 0.35 + r() * 3;
    if (nearPath(x, y + h + 3, z) < 16 || nearPath(x, y + h, z) < cw + 10) continue;
    const lean = (r() - 0.5) * 0.25;
    stemM.push(M(x, y + h / 2, z, 0.9 + h * 0.04, h, 0.9 + h * 0.04, 0, lean, (r() - 0.5) * 0.25));
    stemC.push(warped ? new THREE.Color(0.06, 0.12, 0.16) : new THREE.Color(0.32, 0.06, 0.09));
    (warped ? warpedM : crimsonM).push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, lean)), new THREE.Vector3(cw / 0.62, h, cw / 0.62)));
    const cy = y + h + cw * 0.08;
    capM.push(M(x, cy, z, cw, cw * (0.45 + r() * 0.2), cw, r() * 6));
    capC.push(warped ? new THREE.Color(0.02, 0.32 + r() * 0.1, 0.3) : new THREE.Color(0.26 + r() * 0.1, 0.008, 0.018));
    for (let j = 0; j < 5; j++) {
      const b = r() * Math.PI * 2, rr = cw * (0.35 + r() * 0.5);
      lightM.push(M(x + Math.cos(b) * rr, cy - 0.3 + r() * 0.5, z + Math.sin(b) * rr, 1, 1, 1, r() * 3, r() * 3));
      lightC.push(warped ? new THREE.Color(1.0, 0.7, 0.35) : new THREE.Color(1.0, 0.55, 0.22));
    }
  }
  for (const c of [CRIMSON, WARPED]) { const l = new THREE.PointLight(c === CRIMSON ? '#ff5030' : '#30ffd8', 900, 90, 1.6); l.position.set(c.x, 30, c.y); scene.add(l); }

  // ---- glowstone chandeliers hanging from the roof
  const gsM: THREE.Matrix4[] = [], gsC: THREE.Color[] = [];
  for (let i = 0; i < 34; i++) {
    const x = (r() - 0.5) * 220, z = -250 - r() * 300, y = ceilH(x, z);
    for (let j = 0; j < 14; j++) { const s = 1.5 + r() * 2.2; gsM.push(M(x + (r() - 0.5) * 6, y - r() * 9 - 1, z + (r() - 0.5) * 6, s, s, s, r() * 3, r() * 3)); gsC.push(new THREE.Color(1, 0.9, 0.6)); }
    if (i % 4 === 0) { const l = new THREE.PointLight('#ffc070', 500, 70, 1.8); l.position.set(x, y - 12, z); scene.add(l); }
  }

  // ---- lavafalls pouring from the roof
  const fallMat = /* glsl */ `
    vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      float f = fbm(vec3(uv.x * 7.0, uv.y * 3.0 + t * 1.4, 0.0));
      float edge = smoothstep(0.0, 0.25, uv.x) * smoothstep(1.0, 0.75, uv.x);
      vec3 c = mix(vec3(1.6, 0.22, 0.02), vec3(8.0, 2.8, 0.5), smoothstep(0.45, 0.75, f));
      return vec4(c * edge, edge);
    }`;
  for (const [x, z, w] of [[-75, -280, 9], [70, -330, 7], [-62, -405, 12], [84, -455, 8], [-30, -560, 14], [40, -600, 10]] as const) {
    const top = ceilH(x, z), g = new THREE.PlaneGeometry(w, top - LAVA_Y, 1, 1).translate(0, (top + LAVA_Y) / 2, 0);
    const m = makeSurface(g, fallMat, {}, fog, { transparent: true, side: THREE.DoubleSide });
    m.position.set(x, 0, z); m.rotation.y = Math.atan2(-x, 40); scene.add(m);
    const l = new THREE.PointLight('#ff6a20', 1200, 120, 1.5); l.position.set(x * 0.85, LAVA_Y + 12, z); scene.add(l);
  }

  // ---- the stronghold pylon carrying the End frame (its top sits just below the gate at y=30)
  const brick = pbr(fog, { vertexColors: false, color: '#5d635a', roughness: 0.9 });
  const pyl = new THREE.Mesh(new THREE.CylinderGeometry(11, 15, 28.8 - LAVA_Y + 12, 8, 6), brick);
  pyl.position.set(PYLON.x, (28.8 + LAVA_Y - 12) / 2, PYLON.y); pyl.castShadow = pyl.receiveShadow = true; scene.add(pyl);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(11.6 + i * 0.9, 11.6 + i * 0.9, 1.2, 8), pbr(fog, { vertexColors: false, color: '#3d423c', roughness: 0.8 }));
    band.position.set(PYLON.x, 27.6 - i * 9, PYLON.y); scene.add(band);
  }
  for (let i = 0; i < 8; i++) { // broken balustrade posts
    const a = (i / 8) * Math.PI * 2 + 0.2, p = new THREE.Mesh(new RoundedBoxGeometry(1.4, 2 + r() * 3, 1.4, 2, 0.1), brick);
    p.position.set(PYLON.x + Math.cos(a) * 10.2, 30, PYLON.y + Math.sin(a) * 10.2); p.castShadow = true; scene.add(p);
  }
  const eyeL = new THREE.PointLight('#3dffc0', 300, 40, 1.6); eyeL.position.set(PYLON.x, 34, PYLON.y); scene.add(eyeL);

  // ---- smoke, embers, ash
  const smoke: PuffItem[] = [];
  for (let i = 0; i < 160; i++) smoke.push({ p: [(r() - 0.5) * 300, LAVA_Y + 4 + r() * 30, -230 - r() * 380], s: 14 + r() * 20, seed: r() * 50 });
  scene.add(makePuffs(smoke, { lit: new THREE.Color(0.9, 0.18, 0.04), shade: new THREE.Color(0.03, 0.01, 0.01), sunDir: new THREE.Vector3(0, -1, 0), fog, opacity: 0.45, drift: [0.3, 1.2, 0], nearFade: 12 }));
  scene.add(makeMotes({ count: 2600, box: [80, 50, 80], color: new THREE.Color(6, 1.8, 0.3), color2: new THREE.Color(4, 0.7, 0.1), size: 0.05, vel: [0.3, 2.2, 0.2], swirl: 1.4, flicker: 0.7 }));
  // engine GPU embers boiling off the lava sea
  const embers = new LargeParticles(14000, 666);
  embers.configure({
    mode: 'fall', style: 'streak', streak: 0.1, size: [0.015, 0.05], life: [3, 8],
    color: { mode: 'flat', rgb: [1.0, 0.42, 0.1] }, intensity: 3.0, brightnessVariance: 0.8, fade: [0.1, 0.4],
    turbulence: { amp: 2.2, freq: 0.08, drift: 0.4 },
    fall: { center: [0, LAVA_Y - 20, -420], box: [150, 20, 200], velocity: [0.4, 3.2, 0.2], drag: 0 },
  });
  /** Blender fungi + glowstone (assets/nether_props) instanced over the matrices placed above. */
  const plant = (part: (id: string) => THREE.Object3D) => {
    const gsBig = gsM.map((m) => m.clone().multiply(new THREE.Matrix4().makeScale(1.5, 1.5, 1.5)));
    for (const [id, ms] of [['crimson', crimsonM], ['warped', warpedM], ['glowstone', gsBig]] as const) {
      part(id).traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return;
        const om = m.material as THREE.MeshStandardMaterial;
        const im = instanced(m.geometry, pbr(fog, { vertexColors: false, color: om.color, roughness: om.roughness, emissive: om.emissive, emissiveIntensity: om.emissiveIntensity }), ms);
        im.castShadow = true; scene.add(im);
      });
    }
  };
  scene.add(makeMotes({ count: 1400, box: [60, 40, 60], color: new THREE.Color(0.25, 0.2, 0.2), size: 0.05, vel: [0.2, -0.6, 0.1], swirl: 0.6, additive: false, seed: 9 }));

  return {
    name: 'nether', scene, fog, plant,
    overlay(rd, cam, target, t) { embers.render(rd, cam, target, t); },
    update(t, _cam, bird) { key.follow(bird); setTime(scene, t); },
    post: () => ({ grade: { saturation: 1.2, gamma: 0.85 }, exposure: 0.85, bloom: 0.75, bloomThreshold: 1.0, halation: 0.35, volumetric: 0, ca: 0.9 }),
    dispose() { embers.dispose(); disposeTree(scene); disposeEnv(scene); },
  };
}

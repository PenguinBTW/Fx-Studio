// THE SIFT — Minecraft Dungeons II's new dimension, restyled: salmon "healthy sculk" meadows and pale cliffs
// under a mint sky, teal flora, glowing ichor pools in the ravines, pale giant trees and souls rising on the tide.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LargeParticles } from '../../engine/particles_large';
import type { World } from './world';
import { Sun } from './world';
import { BIRD } from './path';
import { makeSky, envFromSky, disposeEnv, terrainGeometry, islandGeometry, pbr, makeMotes, makeSurface, disposeTree, setTime, fbm2c, ridged, sstep, rng, instanced, mat4, type FogSpec } from './common';

const SUN = new THREE.Vector3(-0.35, 0.42, -0.84).normalize();
const SKY = /* glsl */ `
uniform vec3 uSun;
vec3 skyColor(vec3 d) {
  float h = d.y, s = max(dot(d, uSun), 0.0);
  vec3 c = mix(vec3(0.22, 0.86, 0.74), vec3(0.02, 0.46, 0.58), pow(clamp(h, 0.0, 1.0), 0.5));
  c = mix(c, vec3(0.70, 0.55, 0.58), smoothstep(0.02, -0.25, h));
  c += vec3(1.2, 0.85, 0.7) * pow(s, 6.0) * 0.3 + vec3(0.7, 0.65, 0.55) * smoothstep(0.9985, 0.9992, s);
  vec2 p = d.xz / max(d.y + 0.08, 0.03);
  float cl = smoothstep(0.55, 0.85, fbm2(p * 0.35 + t * 0.004)) * smoothstep(0.02, 0.2, h);
  c = mix(c, vec3(0.95, 1.0, 0.98) + vec3(0.3, 0.2, 0.1) * pow(s, 3.0), cl * 0.35);
  return c;
}`;
const TREE = new THREE.Vector3(30, -95, -1360);
const PATH_PTS: THREE.Vector3[] = [];
for (let t = 63.5; t <= 84; t += 0.08) PATH_PTS.push(BIRD.at(t));
const nearPath = (x: number, y: number, z: number) => { let m = 1e9; for (const p of PATH_PTS) m = Math.min(m, Math.hypot(p.x - x, p.y - y, p.z - z)); return m; };
/** ravine field: 0 on a ravine floor, 1 on the meadows */
const ravine = (x: number, z: number) => sstep(0.02, 0.16, Math.abs(fbm2c(x * 0.0035, z * 0.0035, 3, 21) - 0.02));
export const siftH = (x: number, z: number) => {
  const hills = 10 * fbm2c(x * 0.005, z * 0.005, 4, 8) + 6 * ridged(x * 0.009, z * 0.009, 3, 3);
  const terr = Math.round(hills / 4) * 4 * 0.55 + hills * 0.45;  // soft terraces → cliff bands
  const lumps = 1.8 * fbm2c(x * 0.045, z * 0.045, 3, 2);  // knobbly sculk surface
  return -88 + terr + lumps + 22 * sstep(160, 460, Math.abs(x)) - 26 * (1 - ravine(x, z));
};

const soulT = { value: 0 };
export function sift(renderer: THREE.WebGLRenderer): World & { plant(part: (id: string) => THREE.Object3D): void } {
  const scene = new THREE.Scene();
  const fog: FogSpec = { color: new THREE.Color(0.24, 0.78, 0.7), density: 0.0001, height: -84, falloff: 0.03 };
  const skyU = { uSun: { value: SUN } };
  scene.add(makeSky(SKY, skyU));
  scene.environment = envFromSky(renderer, SKY, skyU);
  scene.environmentIntensity = 0.35;
  const sun = new Sun(scene, SUN, '#fff2e0', 3.6, 90);
  scene.add(new THREE.HemisphereLight('#9ff0e4', '#c0605a', 0.55));
  const r = rng(9091);

  // ---- salmon sculk meadows, darker veins, teal moss on the flats, pale stone on cliffs, red-black ravine floors
  const sal = new THREE.Color(0.95, 0.42, 0.42), vein = new THREE.Color(0.55, 0.14, 0.18), teal = new THREE.Color(0.14, 0.62, 0.58);
  const stone = new THREE.Color(0.86, 0.84, 0.8), deep = new THREE.Color(0.25, 0.06, 0.1);
  const ground = new THREE.Mesh(terrainGeometry({
    x0: -900, x1: 900, z0: -1750, z1: -850, nx: 460, nz: 320, height: siftH,
    color: (x, y, z, slope, c) => {
      const v = Math.abs(fbm2c(x * 0.05, z * 0.05, 3, 4));
      c.copy(sal).lerp(vein, sstep(0.06, 0.0, v) * 0.7);
      c.lerp(teal, sstep(0.55, 0.8, fbm2c(x * 0.012, z * 0.012, 3, 9) + 0.5) * (1 - sstep(0.2, 0.4, slope)) * 0.8);
      c.lerp(stone, sstep(0.3, 0.55, slope));
      c.lerp(deep, 1 - sstep(-110, -96, y));
    },
  }), pbr(fog, { roughness: 0.92 }));
  ground.receiveShadow = ground.castShadow = true; scene.add(ground);

  // ---- coral-like sculk tufts (salmon) and teal fronds carpeting the meadows
  const branches: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const h = 1.2 + (i % 3) * 0.5, g = new THREE.CylinderGeometry(0.04, 0.16, h, 5, 1).translate(0, h / 2, 0);
    g.rotateZ(((i * 2.4) % 1.2) - 0.6).rotateY(i * 1.05); branches.push(g);
  }
  const coralG = mergeGeometries(branches)!;
  const frondG = new THREE.ConeGeometry(0.22, 2.2, 5, 1).translate(0, 1.1, 0);
  const coralMs: THREE.Matrix4[] = [], coralCs: THREE.Color[] = [], frondMs: THREE.Matrix4[] = [];
  for (let i = 0; i < 60000 && coralMs.length < 3400; i++) {
    const x = (r() - 0.5) * 520, z = -900 - r() * 640, y = siftH(x, z);
    if (ravine(x, z) < 0.85 || nearPath(x, y, z) < 5) continue;
    const s = 0.8 + r() * 2.2, m = mat4([x, y - 0.2, z], [s, s * (0.8 + r() * 0.6), s], [0, r() * 6, 0]);
    if (r() < 0.72) { if (nearPath(x, y + 6 * s, z) < 6 * s + 4) continue; coralMs.push(mat4([x, y - 0.3, z], [s * 3.2, s * (2.4 + r() * 1.6), s * 3.2], [0, r() * 6, 0])); coralCs.push(new THREE.Color().setHSL(0.97 + r() * 0.02, 0.85, 0.62 + r() * 0.08)); }
    else frondMs.push(m);
  }
  const coralMat = pbr(fog, { vertexColors: false, color: '#ffffff', roughness: 0.6, emissive: new THREE.Color('#ff6f6a'), emissiveIntensity: 0.12 });
  const fronds = instanced(frondG, pbr(fog, { vertexColors: false, color: '#27b3a6', roughness: 0.55, emissive: new THREE.Color('#0f6b66'), emissiveIntensity: 0.25 }), frondMs);
  fronds.castShadow = true; scene.add(fronds);

  // ---- pale giant trees: flared bone-white trunks carrying stacked, drooping mint-white canopies
  const bark = pbr(fog, { vertexColors: false, color: '#3e3840', roughness: 0.8 });
  const leaf = pbr(fog, { vertexColors: false, color: '#eef1ee', roughness: 0.6, emissive: new THREE.Color('#c8e8e0'), emissiveIntensity: 0.1, side: THREE.DoubleSide });
  const trunkProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) { const k = i / 24; trunkProf.push(new THREE.Vector2(0.9 + 3.2 * Math.pow(1 - k, 6) + 0.25 * Math.sin(k * 9), k * 40)); }
  const trunkG = new THREE.LatheGeometry(trunkProf, 18);
  const canopyG = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const pos = canopyG.attributes.position!;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z); pos.setY(i, pos.getY(i) * 0.35 - d * d * 0.25 + 0.06 * Math.sin(Math.atan2(z, x) * 7) * d); }
  canopyG.computeVertexNormals();
  const treeMs: THREE.Matrix4[] = [];
  const tree = (x: number, z: number, s: number) => {
    const y = siftH(x, z), k = 46 * s;
    treeMs.push(mat4([x, y - 1, z], [k * (0.9 + r() * 0.25), k, k * (0.9 + r() * 0.25)], [0, r() * 6, 0]));
  };
  for (let i = 0, n = 0; i < 400 && n < 16; i++) {
    const x = (r() - 0.5) * 640, z = -960 - r() * 600, s = 0.7 + r() * 0.8, y = siftH(x, z);
    if (ravine(x, z) < 0.9 || nearPath(x, y + 30 * s, z) < 30 * s + 16 || nearPath(x, y + 40 * s, z) < 26 * s + 16 || nearPath(x, y + 10, z) < 12) continue;
    tree(x, z, s); n++;
  }
  tree(TREE.x, TREE.z, 3.2);
  // finale landmark: a pale floating cliff isle the swallow climbs toward, with souls streaming up past it
  {
    const LAND = new THREE.Vector3(125, 10, -1330), rock = new THREE.Color('#e4e6e0'), shade = new THREE.Color('#d6d9d2'), moss = new THREE.Color('#e9ece4');
    const isle = new THREE.Mesh(islandGeometry({ radius: 60, depth: 85, seed: 27, rings: 44, segs: 110,
      top: (x, z, r01) => 4 * fbm2c(x * 0.04, z * 0.04, 3, 5) * (1 - r01),
      color: (_x, y, _z, _s, under, out) => { if (under) out.copy(shade).lerp(rock, 0.45 + 0.35 * Math.sin(y * 0.25)); else out.copy(moss); } }),
      pbr(fog, { roughness: 0.92, side: THREE.DoubleSide, emissive: new THREE.Color('#1c1e1c') }));
    isle.position.copy(LAND); isle.castShadow = true; scene.add(isle);
    for (const [dx, dz, ks] of [[-16, 8, 0.9], [22, -12, 0.7], [4, -30, 0.55], [-30, -18, 0.5], [34, 14, 0.45], [-6, 28, 0.5], [16, 32, 0.4], [-38, 12, 0.4]]) treeMs.push(mat4([LAND.x + dx, LAND.y + 1, LAND.z + dz], [46 * ks, 46 * ks, 46 * ks], [0, dx, 0]));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 10, 420, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.85, 1.4), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(LAND.x, LAND.y - 300, LAND.z); scene.add(beam);
    {
      const N = 1800, pos = new Float32Array(N * 3), sd = new Float32Array(N);
      for (let k = 0; k < N; k++) { sd[k] = k / N; pos[k * 3] = LAND.x; pos[k * 3 + 1] = LAND.y; pos[k * 3 + 2] = LAND.z; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('seed', new THREE.BufferAttribute(sd, 1));
      const sm = new THREE.ShaderMaterial({
        uniforms: { uT: soulT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float seed; uniform float uT; varying float vA;
          void main() {
            float h1 = fract(sin(seed * 917.3) * 43758.5), h2 = fract(sin(seed * 373.1) * 24634.6), h3 = fract(sin(seed * 155.7) * 11743.2);
            float ph = fract(h1 + uT * (0.05 + 0.05 * h3));
            float ang = h2 * 6.2832 + uT * (0.4 + h3 * 0.5) + ph * 7.0;
            float rad = (seed < 0.3 ? 2.0 + 6.0 * h3 : 30.0 + 30.0 * pow(h3, 2.0)) * (1.0 - ph * 0.5);
            vec3 p = position + vec3(cos(ang) * rad, seed < 0.3 ? 15.0 + ph * 150.0 : -100.0 + ph * 190.0, sin(ang) * rad);
            vA = sin(ph * 3.1416) * smoothstep(73.0, 78.0, uT);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (5.0 + 11.0 * h2 * h2) * 300.0 / -mv.z;
            gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA;
          void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
            float core = smoothstep(0.18, 0.0, d); gl_FragColor = vec4((vec3(0.5, 1.8, 3.2) * a + vec3(3.0, 3.6, 4.0) * core) * vA, a * vA); }`,
      });
      const pts = new THREE.Points(g, sm); pts.frustumCulled = false; scene.add(pts);
    }
  }

  /** Blender sculk coral + pale drooping giants (assets/sift_flora), instanced over the placements above. */
  const plant = (part: (id: string) => THREE.Object3D) => {
    const put = (id: string, ms: THREE.Matrix4[], cs?: THREE.Color[]) => part(id).traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const om = m.material as THREE.MeshStandardMaterial;
      const mt = om.name === 'SiftCoral' ? coralMat : om.name === 'PaleBark' ? bark : om.name === 'PaleLeaf' ? leaf
        : pbr(fog, { vertexColors: false, color: '#b8f4e4', roughness: 0.5, emissive: new THREE.Color('#5fe8d0'), emissiveIntensity: 0.9 });
      const im = instanced(m.geometry, mt, ms, om.name === 'SiftCoral' ? cs : undefined); im.castShadow = true; scene.add(im);
    });
    put('coral', coralMs, coralCs); put('paletree', treeMs);
  };
  // ---- glowing ichor pools on the ravine floors
  const ichor = /* glsl */ `vec4 surface(vec3 wp, vec3 n, vec2 uv) {
      float f = fbm(vec3(wp.xz * 0.08, t * 0.25)), g = fbm(vec3(wp.xz * 0.3 + t * 0.2, 3.0));
      float tide = 0.75 + 0.25 * sin(t * 0.7);
      vec3 c = mix(vec3(0.02, 0.9, 1.0), vec3(0.6, 4.0, 3.6), smoothstep(0.35, 0.8, f * 0.8 + g * 0.3)) * tide * 1.7;
      return vec4(c, 1.0); }`;
  for (let i = 0, n = 0; i < 6000 && n < 40; i++) {
    const x = (r() - 0.5) * 560, z = -920 - r() * 620;
    if (ravine(x, z) > 0.12) continue;
    const rad = 7 + r() * 16, p = makeSurface(new THREE.CircleGeometry(rad, 40).rotateX(-Math.PI / 2), ichor, {}, fog, {});
    p.position.set(x, siftH(x, z) + 3.2, z); scene.add(p); n++;
  }

  // ---- souls: engine GPU particles rising off the meadows as glowing streaks; spores drift around the camera
  const souls = new LargeParticles(3600, 2027);
  souls.configure({
    mode: 'fall', style: 'disc', size: [0.2, 0.5], life: [6, 14],
    color: { mode: 'flat', rgb: [0.3, 0.7, 1.0] }, intensity: 4.5, brightnessVariance: 0.7, fade: [0.15, 0.3],
    turbulence: { amp: 1.6, freq: 0.06, drift: 0.2 },
    fall: { center: [0, -95, -1150], box: [260, 10, 300], velocity: [0.6, 4.2, -0.4], drag: 0 },
  });
  scene.add(makeMotes({ count: 160, box: [70, 36, 70], color: new THREE.Color(0.35, 1.3, 3.0), color2: new THREE.Color(0.5, 2.2, 2.6), size: 0.03, vel: [0.6, 0.5, 0.2], swirl: 0.8, flicker: 0.5 }));

  const lightPos = new THREE.Vector3();
  return {
    name: 'sift', scene, fog, lightPos, plant,
    update(t, cam, bird) { soulT.value = t; sun.follow(bird); setTime(scene, t); lightPos.copy(cam.position).addScaledVector(SUN, 4000); },
    overlay(rd, cam, target, t) { souls.render(rd, cam, target, t); },
    post: (t) => ({ toneMap: 'aces', grade: { saturation: 1.62, gamma: 0.8, gain: 1.06, lift: [-0.03, -0.025, -0.02] }, exposure: 0.95 + 0.08 * sstep(76, 80.5, t), bloom: 0.6 + 0.7 * sstep(76, 80.5, t), bloomThreshold: 1.2, volumetric: 0.1, volumetricDecay: 0.93, halation: 0.1, ca: 0.5 }),
    dispose() { souls.dispose(); disposeTree(scene); disposeEnv(scene); },
  };
}

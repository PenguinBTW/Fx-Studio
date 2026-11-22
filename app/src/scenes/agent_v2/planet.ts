// S1 world (bars 3-8): a planet built in time-lapse on the riff. Each bar lands a stage: molten plates cool, crust and
// ridged ranges rise, oceans flood, forests spread, clouds roll in. Golden hour: amber land, teal sea, low warm sun.
import * as THREE from 'three';
import { Layer2D } from '../../engine/gl';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { bar } from '../agent_promo/kit';
import { overlayTextDuck } from '../../engine/transition';
import { term, type TLine } from './term';
import { PNOISE } from './planet_glsl';

export const S1_LINES: TLine[] = [{ text: 'i can build a world.', at: bar(4) + 0.1, hold: 2.2, cps: 16 }];
export const R = 1.6;
export const SUN = new THREE.Vector3(-0.92, 0.28, -0.05).normalize();
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const SURF_V = /* glsl */ `uniform float uGrow, uRot; varying vec3 vN, vW; ${PNOISE}
mat3 roty(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
void main() { vN = roty(uRot) * normalize(position); float h = pheight(vN, 5);
  vec3 p = normalize(position) * ${R.toFixed(2)} * (1.0 + 0.028 * uGrow * max(h, -0.05));
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
export const SURF_FN = /* glsl */ `uniform float uGrow, uSea, uForest, uMolten, uCloud, uT; uniform vec3 uSun; ${PNOISE}
vec3 shadePlanet(vec3 n0, vec3 vW) {
  vec3 n = normalize(n0); float h = pheight(n, 7) * uGrow - 0.25 * (1.0 - uGrow); float sea = mix(-0.7, 0.03, uSea); float e = h - sea;
  vec3 Ng = normalize(cross(dFdx(vW), dFdy(vW))); vec3 dpx = dFdx(vW), dpy = dFdy(vW); float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpy, Ng), r2 = cross(Ng, dpx); float det = dot(dpx, r1);
  vec3 N = e > 0.0 ? normalize(abs(det) * Ng - sign(det) * (hx * r1 + hy * r2) * 0.09) : Ng;
  vec3 V = normalize(cameraPosition - vW), L = uSun; float ndl = dot(N, L), gl = dot(Ng, L);
  float v1 = pfbm(n * 22.0, 3);
  vec3 bare = mix(vec3(0.2, 0.11, 0.06), vec3(0.5, 0.33, 0.16), smoothstep(-0.2, 0.3, v1));
  vec3 green = mix(vec3(0.09, 0.2, 0.06), vec3(0.24, 0.32, 0.1), smoothstep(-0.25, 0.25, v1 + 0.5 * e));
  float fz = uForest * smoothstep(0.015, 0.05, e) * (1.0 - smoothstep(0.22, 0.34, e + 0.1 * v1)) * (1.0 - smoothstep(0.7, 0.85, abs(n.y)));
  vec3 land = mix(bare, green, fz);
  land = mix(land, vec3(0.86, 0.72, 0.48), uSea * (1.0 - smoothstep(0.0, 0.018, e)));
  land = mix(land, vec3(0.32, 0.27, 0.24), smoothstep(0.42, 0.6, e + 0.08 * v1) * 0.7);
  land = mix(land, vec3(0.95), smoothstep(0.72, 0.85, e + 0.1 * v1 + 0.6 * smoothstep(0.8, 0.97, abs(n.y))));
  float d = -e; vec3 ocean = mix(vec3(0.12, 0.62, 0.62), vec3(0.01, 0.1, 0.16), smoothstep(0.0, 0.22, d));
  float cl = uCloud * pcloud(normalize(n + L * 0.03), uT);
  float diff = smoothstep(-0.12, 0.7, ndl) * (1.0 - 0.65 * cl);
  vec3 sunC = mix(vec3(1.0, 0.45, 0.2), vec3(1.0, 0.86, 0.66), smoothstep(-0.05, 0.45, gl));
  vec3 col;
  if (e > 0.0) col = land * (sunC * diff * 1.15 + vec3(0.03, 0.06, 0.08));
  else { vec3 H = normalize(L + V); float spec = pow(max(dot(Ng, H), 0.0), 400.0) * 4.0 + pow(max(dot(Ng, H), 0.0), 40.0) * 0.08;
    float fr = 0.03 + 0.97 * pow(1.0 - max(dot(Ng, V), 0.0), 5.0);
    col = ocean * (sunC * diff * 1.3 + vec3(0.02, 0.05, 0.07)) + sunC * spec * smoothstep(-0.05, 0.2, gl) * (1.0 - cl) + vec3(0.2, 0.45, 0.6) * fr * 0.25 * smoothstep(-0.2, 0.3, gl); }
  // molten crust: dark plates, glowing cracks that churn, cooling into the land
  float cr = pcrack(n * 5.0 + vec3(0.0, uT * 0.05, 0.0)); float cr2 = pcrack(n * 13.0 + 3.0);
  float glow = smoothstep(0.09, 0.0, cr) + 0.5 * smoothstep(0.06, 0.0, cr2);
  vec3 lava = vec3(0.03, 0.015, 0.012) * (0.4 + diff) + blackbody(clamp(glow * (0.6 + 0.4 * gn(n * 4.0 + uT * 0.3)), 0.0, 1.0)) * glow;
  col = mix(col, lava, uMolten);
  float rim = pow(1.0 - max(dot(Ng, V), 0.0), 3.0); float day = smoothstep(-0.25, 0.5, gl);
  col += mix(vec3(1.0, 0.4, 0.15), vec3(0.3, 0.7, 1.0), smoothstep(0.0, 0.4, gl)) * rim * day * (1.0 - uMolten) * 1.2;
  return col; }`;
const SURF_F = `${SURF_FN}
varying vec3 vN, vW; void main() { gl_FragColor = vec4(shadePlanet(vN, vW), 1.0); }`;

export function planetMaterials(u: Record<string, THREE.IUniform>) {
  const surf = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SURF_V, fragmentShader: SURF_F });
  const cloud = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `uniform float uRot; varying vec3 vN, vW; mat3 roty(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
      void main() { vN = roty(uRot * 1.15) * normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uCloud, uT; uniform vec3 uSun; varying vec3 vN, vW; ${PNOISE}
      void main() { vec3 n = normalize(vN); float c = pcloud(n, uT) * uCloud; vec3 Nw = normalize(vW); float gl = dot(Nw, uSun);
        vec3 lit = mix(vec3(1.0, 0.55, 0.32), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.4, gl)) * smoothstep(-0.15, 0.5, gl) * 1.5;
        gl_FragColor = vec4(lit + vec3(0.02, 0.03, 0.05), c * 0.92); }` });
  const halo = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uSun; uniform float uMolten; varying vec3 vW; void main() { vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vW);
      float d = abs(dot(N, V)); float a = pow(clamp(d / 0.42, 0.0, 1.0), 4.0) * smoothstep(0.62, 0.38, d);
      float gl = dot(N, uSun); vec3 c = mix(vec3(1.0, 0.42, 0.15), vec3(0.35, 0.72, 1.0), smoothstep(-0.05, 0.45, gl)) * smoothstep(-0.4, 0.4, gl);
      c = mix(c, vec3(1.0, 0.35, 0.08) * 0.8, uMolten); gl_FragColor = vec4(c * a * 1.4, 1.0); }` });
  return { surf, cloud, halo };
}

export function starfield(n = 4000, seed = 3) {
  const p = new Float32Array(n * 3), c = new Float32Array(n * 3); let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), b = 0.3 + 0.7 * rnd() ** 3;
    p.set([r * Math.cos(a) * 300, u * 300, r * Math.sin(a) * 300], i * 3); c.set([b, b * (0.85 + 0.15 * rnd()), b * (0.8 + 0.3 * rnd())], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false }));
}

export default class Planet extends Scene {
  private layer = new Layer2D();
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 1000);
  private u = { uGrow: { value: 0 }, uSea: { value: 0 }, uForest: { value: 0 }, uMolten: { value: 1 }, uCloud: { value: 0 }, uT: { value: 0 }, uRot: { value: 0 }, uSun: { value: SUN } };
  override async init() {
    const m = planetMaterials(this.u);
    this.scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 110), m.surf), new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.018, 40), m.cloud),
      new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.12, 40), m.halo), starfield());
  }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = f.t, u = this.u, b = (k: number) => bar(k);
    u.uT.value = T; u.uRot.value = 0.04 * T;
    u.uMolten.value = 1 - sm(b(4), b(5) + 0.4, T); u.uGrow.value = sm(b(4) - 0.2, b(5), T);
    u.uSea.value = sm(b(5), b(6) + 0.5, T); u.uForest.value = sm(b(6), b(7) + 0.4, T); u.uCloud.value = sm(b(7), b(8) + 0.4, T);
    const k = sm(b(3) - 0.3, b(9), T), d = 9.2 - 2.4 * k;
    this.cam.position.set(1.2 - 0.9 * k, 0.5 - 0.2 * k, d); this.cam.lookAt(-0.55 + 0.2 * k, 0.0, 0); this.cam.updateProjectionMatrix();
    const r = this.ctx.renderer; r.setRenderTarget(out); r.setClearColor(0x000000, 1); r.clear(true, true, true); r.render(this.scene, this.cam);
    const g = this.layer.ctx; this.layer.clear(); term(g, S1_LINES, T, { size: 44, x: 200, align: 'left', y: 920, halo: 'rgba(0,0,0,0.6)', alpha: overlayTextDuck(f.tin, f.tout) });
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); r.resetState();
    return { toneMap: 'aces', exposure: 1.0, bloom: 0.6, bloomThreshold: 0.85, halation: 0.25, vignette: 0.5, grain: 0.04, ca: 0.4 };
  }
  override dispose() { this.layer.texture.dispose(); this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose(); }); }
}

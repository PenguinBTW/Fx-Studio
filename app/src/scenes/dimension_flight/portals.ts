// The four gateways. Each portal owns a frame (lives in the world you leave) and a membrane that
// shows the next world, rendered with the same camera into a render target (see odyssey.ts).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { GLSL_NOISE, rng, type V3 } from './common';

export type PortalKind = 'nether' | 'end' | 'aether' | 'sift';

const MEMBRANE = /* glsl */ `
uniform float t, uOpen, uStyle, uIntensity, uView; uniform sampler2D uRT; uniform vec2 uRes; uniform vec2 uHalf;
varying vec2 vUv; varying vec3 vWP; varying vec3 vLP;
${GLSL_NOISE}
float stars(vec2 p, float s) { vec2 c = floor(p * s); vec2 f = fract(p * s) - 0.5; float h = bh21(c);
  vec2 o = vec2(bh21(c + 7.1), bh21(c + 3.3)) - 0.5; float d = length(f - o * 0.7);
  return step(0.86, h) * smoothstep(0.08, 0.0, d) * (0.5 + 0.5 * sin(t * 2.0 + h * 40.0)); }
void main() {
  vec2 q = vLP.xy / uHalf;                // -1..1 across the opening
  float r = max(abs(q.x), abs(q.y));
  float rim = smoothstep(0.55, 1.0, r);
  vec2 suv = gl_FragCoord.xy / uRes;
  float ang = atan(q.y, q.x);
  vec3 film; vec2 warp;
  if (uStyle < 0.5) { // nether: slow violet vortex
    float sw = ang + 2.2 / (0.35 + length(q)) * 0.25 + t * 0.6;
    float n = fbm(vec3(cos(sw) * length(q) * 2.5, sin(sw) * length(q) * 2.5, t * 0.35));
    float m = fbm(vec3(q * 3.0 + n * 1.5, t * 0.5));
    film = mix(vec3(0.08, 0.0, 0.3), vec3(0.75, 0.18, 2.4), smoothstep(0.35, 0.8, m)) + vec3(1.2, 0.5, 2.6) * pow(m, 6.0) * 3.0;
    warp = vec2(n - 0.5, m - 0.5) * 0.08;
  } else if (uStyle < 1.5) { // end: deep parallax starfield in teal
    vec3 vd = normalize(vWP - cameraPosition);
    film = vec3(0.004, 0.02, 0.025);
    for (int i = 0; i < 4; i++) { float fi = float(i); vec2 p = vLP.xy * 0.08 + vd.xz * (0.3 + fi * 0.5) + fi * 3.7 + vec2(t * 0.01 * (fi + 1.0), 0.0);
      film += mix(vec3(0.3, 1.6, 1.2), vec3(1.4, 1.8, 1.6), fract(fi * 0.37)) * stars(p, 9.0 + fi * 6.0) * (2.2 - fi * 0.4); }
    film += vec3(0.02, 0.12, 0.10) * fbm(vec3(vLP.xy * 0.12 + vd.xz, t * 0.05));
    warp = (vec2(vnoise(vec3(q * 4.0, t * 0.4)), vnoise(vec3(q * 4.0 + 9.0, t * 0.4))) - 0.5) * 0.03;
  } else if (uStyle < 2.5) { // aether: luminous water sheet with ripples
    float w = 0.0; for (int i = 0; i < 3; i++) { float fi = float(i); vec2 c = vec2(sin(fi * 2.1), cos(fi * 1.7)) * 0.4; float d = length(q - c); w += sin(d * 22.0 - t * 3.0 - fi) * exp(-d * 2.0); }
    float n = fbm(vec3(q * 3.0, t * 0.3));
    film = mix(vec3(0.15, 0.55, 1.4), vec3(0.9, 1.6, 2.2), smoothstep(0.3, 0.8, n + w * 0.12));
    film += vec3(1.5, 1.8, 2.0) * pow(max(0.0, w * 0.5 + n - 0.5), 3.0) * 2.0;
    warp = vec2(w * 0.012, (n - 0.5) * 0.04);
  } else { // sift (Deep Dark gateway): sculk-cyan veins pulsing outward like a sound wave
    float d = length(q * vec2(1.0, uHalf.y / uHalf.x));
    float n = fbm(vec3(q * 4.0, t * 0.3)), vein = smoothstep(0.06, 0.0, abs(fbm(vec3(q * 6.0, t * 0.15)) - 0.5));
    float wave = pow(0.5 + 0.5 * sin(d * 18.0 - t * 4.0 + n * 3.0), 6.0);
    film = vec3(0.0, 0.05, 0.08) + vec3(0.1, 1.4, 1.8) * (wave * 0.6 + vein * 1.2) * (0.5 + n);
    warp = vec2(n - 0.5, wave - 0.5) * 0.05;
  }
  float open = clamp(uOpen, 0.0, 1.0);
  vec3 view = texture2D(uRT, suv + warp * (1.0 - open) * (1.0 - rim)).rgb;
  float see = mix(0.42, 1.0, open) * (1.0 - rim * (1.0 - open * 0.6));
  vec3 col = mix(film * uIntensity, view, see * uView);
  col += film * uIntensity * (rim * 0.9 + 0.08) * (1.0 - open * 0.7);
  if (r > 1.0) discard;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Portal {
  group = new THREE.Group();
  frame = new THREE.Group();
  membrane: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  plane: THREE.Plane;
  half: THREE.Vector2;
  light: THREE.PointLight;
  private motes: THREE.Points;
  private frameInst: GLTFInstance | null = null;

  constructor(public kind: PortalKind, public center: THREE.Vector3, public normal: THREE.Vector3, rt: THREE.Texture, res: THREE.Vector2, up = new THREE.Vector3(0, 1, 0)) {
    normal.normalize();
    const style = { nether: 0, end: 1, aether: 2, sift: 3 }[kind];
    this.half = kind === 'end' ? new THREE.Vector2(4.6, 4.6) : kind === 'sift' ? new THREE.Vector2(8, 5.5) : new THREE.Vector2(4.2, 6.4);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, uOpen: { value: 0 }, uStyle: { value: style }, uRT: { value: rt }, uRes: { value: res }, uHalf: { value: this.half }, uIntensity: { value: 1 }, uView: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vWP; varying vec3 vLP;
        void main() { vUv = uv; vLP = position; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: MEMBRANE, side: THREE.DoubleSide,
    });
    const mg = new THREE.PlaneGeometry(this.half.x * 2, this.half.y * 2);
    this.membrane = new THREE.Mesh(mg, this.mat);
    this.group.add(this.membrane, this.frame);
    // orient: local +z = travel direction, local +y = up (or -z for the horizontal End portal)
    const z = normal.clone(), y = Math.abs(z.dot(up)) > 0.9 ? new THREE.Vector3(0, 0, -1) : up.clone();
    const x = new THREE.Vector3().crossVectors(y, z).normalize(); y.crossVectors(z, x);
    this.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    this.group.position.copy(center);
    this.plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
    const lc = { nether: '#a040ff', end: '#40ffc0', aether: '#ffd27a', sift: '#40e0ff' }[kind];
    this.light = new THREE.PointLight(lc, kind === 'end' ? 60 : 120, 60, 1.6);
    this.light.position.set(0, 0, -1.5);
    this.group.add(this.light);
    this.buildFrame();
    this.motes = this.buildMotes(lc);
    this.group.add(this.motes);
  }

  /** signed distance of p to the membrane plane (positive = beyond, in the next world) */
  side(p: THREE.Vector3) { return this.plane.distanceToPoint(p); }
  /** is p within the opening (projected onto the plane)? */
  inside(p: THREE.Vector3, margin = 0) {
    const l = this.group.worldToLocal(p.clone());
    return Math.abs(l.x) < this.half.x + margin && Math.abs(l.y) < this.half.y + margin;
  }

  update(t: number, open: number) {
    this.mat.uniforms.t!.value = t; this.mat.uniforms.uOpen!.value = open;
    (this.motes.material as THREE.ShaderMaterial).uniforms.t!.value = t;
    this.light.intensity = (this.kind === 'end' ? 60 : 120) * (0.85 + 0.15 * Math.sin(t * 3.1));
  }

  /** Aether and Deep Dark frames are Blender assets (assets/portal_aether, assets/portal_deepdark). */
  async loadFrame(project: string) {
    const id = { aether: 'portal_aether', sift: 'portal_deepdark' }[this.kind as 'aether' | 'sift'];
    if (!id) return;
    const a = resolveAsset(id, project);
    this.frameInst = await GLTFManager.instantiate(a.url, { ...a.manifest.load });
    this.frame.add(this.frameInst.root);
  }

  private buildFrame() {
    if (this.kind === 'aether' || this.kind === 'sift') return;
    const r = rng({ nether: 11, end: 12, aether: 13, sift: 14 }[this.kind]);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: V3, s: V3 | number = 1, rot: V3 = [0, 0, 0]) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(...p);
      if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
      m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; this.frame.add(m); return m;
    };
    const hx = this.half.x, hy = this.half.y;
    if (this.kind === 'nether') {
      const b = 1.45, geo = new RoundedBoxGeometry(b, b, b * 1.1, 3, 0.16);
      const mats: THREE.Material[] = this.kind === 'nether' ? [
        new THREE.MeshPhysicalMaterial({ color: '#0b0814', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.7, iridescenceIOR: 1.7, metalness: 0.2 }),
        new THREE.MeshPhysicalMaterial({ color: '#0a0612', roughness: 0.18, clearcoat: 1, metalness: 0.2, emissive: new THREE.Color('#5010c0'), emissiveIntensity: 0.18 }),
      ] : [0, 1, 2].map((i) => new THREE.MeshStandardMaterial({ color: ['#ffdf90', '#ffc960', '#fff0b0'][i], roughness: 0.55, emissive: new THREE.Color(['#ffb43c', '#ff9a20', '#ffd070'][i]), emissiveIntensity: 2.2 + i * 0.6 }));
      const ring: V3[] = [];
      const nx = Math.round((2 * hx) / b) + 2, ny = Math.round((2 * hy) / b);
      for (let i = 0; i < nx; i++) { const x = -hx - b / 2 + (i * (2 * hx + b)) / (nx - 1); ring.push([x, -hy - b / 2, 0], [x, hy + b / 2, 0]); }
      for (let j = 0; j < ny; j++) { const y = -hy + b / 2 + (j * (2 * hy - b)) / (ny - 1); ring.push([-hx - b / 2, y, 0], [hx + b / 2, y, 0]); }
      for (const p of ring) {
        const ruined = this.kind === 'nether' && p[1] > hy && p[0] > hx * 0.2;
        if (ruined && r() < 0.6) { // fallen block resting at the base
          add(geo, mats[0]!, [hx + 2.5 + r() * 3, -hy - b * 0.5, (r() - 0.5) * 4], 0.9 + r() * 0.2, [r() * 3, r() * 3, r() * 3]); continue;
        }
        const mi = this.kind === 'nether' ? (r() < 0.22 ? 1 : 0) : Math.floor(r() * 3);
        add(geo, mats[mi]!, [p[0] + (r() - 0.5) * 0.08, p[1] + (r() - 0.5) * 0.08, (r() - 0.5) * 0.15], 0.96 + r() * 0.08, [(r() - 0.5) * 0.06, (r() - 0.5) * 0.06, (r() - 0.5) * 0.06]);
      }
    } else if (this.kind === 'end') {
      const stone = new THREE.MeshStandardMaterial({ color: '#aeb894', roughness: 0.85 });
      const inlay = new THREE.MeshPhysicalMaterial({ color: '#0c2f2b', roughness: 0.2, clearcoat: 1, metalness: 0.3 });
      const eye = new THREE.MeshStandardMaterial({ color: '#0b3', emissive: new THREE.Color('#2dffb0'), emissiveIntensity: 3.0, roughness: 0.2 });
      const pupil = new THREE.MeshStandardMaterial({ color: '#020604', roughness: 0.1 });
      const body = new RoundedBoxGeometry(3.0, 3.0, 1.8, 3, 0.18), top = new RoundedBoxGeometry(2.5, 2.5, 0.3, 2, 0.08);
      const eg = new THREE.SphereGeometry(0.62, 24, 16), pg = new THREE.SphereGeometry(0.3, 16, 10);
      const c = 3.07, o = hx + 1.55;
      const spots: [number, number][] = [];
      for (const k of [-1, 0, 1]) spots.push([k * c, o], [k * c, -o], [o, k * c], [-o, k * c]);
      for (const [x, y] of spots) {
        add(body, stone, [x, y, 0.4]); add(top, inlay, [x, y, -0.55]);
        add(eg, eye, [x, y, -0.75], [1, 1, 0.7]); add(pg, pupil, [x + (r() - 0.5) * 0.2, y + (r() - 0.5) * 0.2, -1.08], [0.6, 1.2, 0.5]);
      }
    } else {
      const sand = new THREE.MeshStandardMaterial({ color: '#d9b17a', roughness: 0.88 });
      const gold = new THREE.MeshStandardMaterial({ color: '#f0b850', metalness: 1, roughness: 0.28 });
      const glow = new THREE.MeshStandardMaterial({ color: '#ffcc66', emissive: new THREE.Color('#ffaa40'), emissiveIntensity: 3 });
      add(new THREE.TorusGeometry(hx + 1.0, 0.95, 32, 180), sand, [0, 0, 0]);
      add(new THREE.TorusGeometry(hx + 0.05, 0.12, 12, 180), glow, [0, 0, 0]);
      add(new THREE.TorusGeometry(hx + 1.95, 0.16, 12, 180), gold, [0, 0, 0]);
      const glyph = new RoundedBoxGeometry(0.9, 1.4, 0.5, 2, 0.12);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(glyph, i % 3 ? sand : gold, [Math.cos(a) * (hx + 2.4), Math.sin(a) * (hx + 2.4), 0], 1, [0, 0, a - Math.PI / 2]); }
      // two hourglass pylons at the base
      const hg = new THREE.LatheGeometry([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => new THREE.Vector2(0.25 + 0.75 * Math.pow(Math.abs(i - 4) / 4, 1.6), i * 0.6)), 24);
      for (const s of [-1, 1]) add(hg, sand, [s * (hx + 3.2), -hy - 3.0, 0]);
    }
  }

  private buildMotes(color: string) {
    const n = 420, a = new Float32Array(n * 3), r = rng(91);
    for (let i = 0; i < n * 3; i++) a[i] = r();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    const style = { nether: 0, end: 1, aether: 2, sift: 3 }[this.kind];
    const m = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, uCol: { value: new THREE.Color(color).multiplyScalar(3) }, uHalf: { value: this.half }, uStyle: { value: style } },
      vertexShader: /* glsl */ `uniform float t, uStyle; uniform vec2 uHalf; varying float vA;
        void main() {
          vec3 s = position; float ph = fract(s.x + t * (0.08 + 0.1 * s.y)); vec3 p;
          if (uStyle < 0.5 || uStyle > 1.5 && uStyle < 2.5) { // drawn inward in a spiral
            float a = s.z * 6.2832 + ph * 3.0; float rr = mix(1.9, 0.2, ph) * max(uHalf.x, uHalf.y);
            p = vec3(cos(a) * rr * uHalf.x / uHalf.y, sin(a) * rr, (s.y - 0.5) * 3.0 * (1.0 - ph)); vA = sin(ph * 3.1416);
          } else if (uStyle < 1.5) { // end: sparks drift up out of the void
            p = vec3((s.y - 0.5) * 2.0 * uHalf.x, (s.z - 0.5) * 2.0 * uHalf.y, -ph * 14.0); vA = sin(ph * 3.1416) * 0.8;
          } else { // sift: sand pours down across the ring
            float a = s.z * 6.2832; float rr = sqrt(s.y) * uHalf.x * 1.3;
            p = vec3(cos(a) * rr, uHalf.y * 1.4 - ph * uHalf.y * 2.8, sin(a) * 1.5); vA = sin(ph * 3.1416) * 0.7;
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((uStyle > 2.5 ? 30.0 : 55.0) / -mv.z, 1.0, 10.0);
        }`,
      fragmentShader: /* glsl */ `uniform vec3 uCol; varying float vA;
        void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uCol * vA * smoothstep(0.5, 0.0, d), 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    return pts;
  }

  dispose() {
    this.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mm = m.material; if (mm) (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose()); });
  }
}

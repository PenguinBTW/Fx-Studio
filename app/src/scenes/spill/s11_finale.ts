// SPILL s11 (23.83 → 29.06 s): VISTA → SCREAM → WHIP → LOOP. The cursor stands on a painted outcrop, now a patchwork of
// every region it crossed, over a miniature of SPILL laid out like a quilt. On bar 11 a scream drops out of the screen
// sky; every creature tilts up. On bar 12 the camera whips up through the hanging screens into one phone, and for the
// last 0.4 s hands off to the breakout scene at its own negative time so the export's last frame flows into frame 0.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { SCREAM, WHIP, END, BEAT, lerp, sm, hash, clamp } from './kit';
import S1Breakout from './s1_breakout';

const HAND = 0.42;
// patchwork shell: region palettes in bands across the cursor's own object space, stepped edges like sewn seams
const PATCH_V = /* glsl */ `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PATCH_F = /* glsl */ `uniform float uT, uK; varying vec3 vP; varying vec3 vN;
vec3 pal(float i){ i = mod(i, 7.0); return i < 1.0 ? vec3(0.95, 0.42, 0.08) : i < 2.0 ? vec3(0.93, 0.89, 0.8) : i < 3.0 ? vec3(0.85, 0.55, 0.35) :
  i < 4.0 ? vec3(0.08, 0.08, 0.1) : i < 5.0 ? vec3(0.2, 0.75, 0.35) : i < 6.0 ? vec3(0.95, 0.6, 0.75) : vec3(0.3, 0.45, 0.95); }
void main(){ float b = floor((vP.y * 2.2 + vP.x * 1.3 + 0.35 * sin(vP.z * 7.0)) * 1.0); float k = step(fract(b * 0.37) , uK);
  vec3 c = mix(vec3(0.95, 0.42, 0.08), pal(b), k); float l = 0.45 + 0.55 * max(0.0, dot(vN, normalize(vec3(-0.5, 0.7, 0.5))));
  float seam = smoothstep(0.04, 0.0, abs(fract(vP.y * 2.2 + vP.x * 1.3 + 0.35 * sin(vP.z * 7.0)) - 0.5) - 0.46) * k;
  gl_FragColor = vec4(c * l * (1.0 - 0.6 * seam), 1.0); }`;

const PATCHES: [string, number, number, number][] = [ // kit, colour, x, z
  ['paper', 0xefe6d2, -11, -8], ['ink', 0xf4f1e8, 1, -6], ['pixel', 0x3c9a48, 12, -10], ['felt', 0x6fae4a, -13, -21],
  ['hose', 0xb9b6ae, 0, -19], ['garden', 0x7a4a8a, 13, -23], ['ps1', 0x7a6650, -6, -33], ['clay', 0xb87a4a, 8, -35]];
const PROPS: Record<string, string[]> = { paper: ['tree', 'deer', 'tree'], ink: ['reed', 'heron', 'lotus', 'reed'], pixel: ['cliff', 'fern', 'salmonA'],
  felt: ['sheep', 'pom', 'sheep', 'fox'], hose: ['house', 'flower', 'house'], garden: ['arch', 'tulip', 'peacock'], ps1: ['palm', 'dino', 'pillar'], clay: [] };
const LOOKERS = new Set(['deer', 'heron', 'sheep', 'fox', 'dino', 'peacock', 'salmonA']);

export default class S11Finale extends Scene {
  private s = new THREE.Scene(); private cam = new THREE.PerspectiveCamera(42, 9 / 16, 0.1, 600);
  private insts: GLTFInstance[] = []; private s1!: S1Breakout;
  private cur!: THREE.Object3D; private core: THREE.MeshStandardMaterial[] = []; private patchU = { uT: { value: 0 }, uK: { value: 0 } };
  private lookers: { o: THREE.Object3D; base: THREE.Euler; ph: number }[] = [];
  private phone!: THREE.Object3D; private yell!: THREE.Sprite; private screens!: THREE.InstancedMesh; private ring!: THREE.Mesh;
  private PH = new THREE.Vector3(2, 40, -58); private scrRT = new THREE.WebGLRenderTarget(540, 960);

  override async init() {
    const load = (id: string) => GLTFManager.instantiate(resolveAsset(id, this.ctx.project ?? 'spill').url, {});
    const ids = ['cursor', 'phone', 'whale', ...PATCHES.map((p) => p[0])];
    const kits = await Promise.all(ids.map(load)); this.insts = kits; const K = Object.fromEntries(ids.map((id, i) => [id, kits[i]]));
    this.s1 = new S1Breakout(this.ctx); await this.s1.init();
    this.s.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(1.0, 0.6, 0.4), vec3(0.42, 0.22, 0.6), smoothstep(0.0, 0.45, y)); c = mix(c, vec3(0.1, 0.06, 0.25), smoothstep(0.45, 0.95, y)); gl_FragColor = vec4(c, 1.0); }` })));
    this.s.background = new THREE.Color(0.98, 0.72, 0.5); this.s.fog = new THREE.Fog(0xf0a080, 70, 260);
    this.s.add(new THREE.HemisphereLight(0xbfd8ff, 0x6a4a30, 1.3)); const sun = new THREE.DirectionalLight(0xffe2b0, 3.2); sun.position.set(-30, 40, 20); this.s.add(sun);
    this.s.add(new THREE.Mesh(new THREE.CircleGeometry(80, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6a8a, roughness: 1 })));
    PATCHES.forEach(([id, col, x, z], pi) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(5.2 + hash(pi), 5.6 + hash(pi), 0.5, 7 + pi), new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, flatShading: true }));
      g.position.set(x, 0.25, z); g.rotation.y = hash(pi * 3) * 3; this.s.add(g);
      const kit = K[id]; kit.root.visible = false; this.s.add(kit.root);
      [...(PROPS[id] ?? []), ...(PROPS[id] ?? [])].forEach((nm, j) => { let src: THREE.Object3D; try { src = kit.part(nm); } catch { return; }
        const o = src.clone(); const a = j * 2.4 + pi; const r = j === 0 ? 0 : 2.6 + 0.8 * hash(pi + j);
        o.position.set(x + r * Math.cos(a), 0.5, z + r * Math.sin(a)); o.rotation.set(0, Math.atan2(-o.position.x, 20 - o.position.z) + 0.4 * (hash(j) - 0.5), 0);
        const bb = new THREE.Box3().setFromObject(src); const h = Math.max(0.01, bb.max.y - bb.min.y); o.scale.multiplyScalar((nm === 'dino' || nm === 'heron' || nm === 'arch' || nm === 'tree' ? 3.0 : 1.3) / h);
        this.s.add(o); if (LOOKERS.has(nm)) this.lookers.push({ o, base: o.rotation.clone(), ph: hash(pi * 7 + j) }); });
    });
    const wh = K.whale.root; wh.scale.setScalar(0.5); wh.position.set(-34, 26, -75); wh.rotation.y = 0.6; this.s.add(wh);
    // the outcrop the cursor stands on
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), new THREE.MeshStandardMaterial({ color: 0x6a5a7a, roughness: 1, flatShading: true }));
    rock.scale.set(1.3, 1.6, 1.1); rock.position.set(0, 3.2, 6); this.s.add(rock);
    this.cur = K.cursor.root; this.cur.scale.setScalar(1.5); this.cur.position.set(0, 8.6, 6); this.s.add(this.cur);
    const patch = new THREE.ShaderMaterial({ vertexShader: PATCH_V, fragmentShader: PATCH_F, uniforms: this.patchU });
    this.cur.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const n = (m.material as THREE.Material).name;
      if (n === 'Core') { const c = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff6a10, emissiveIntensity: 2 }); m.material = c; this.core.push(c); }
      else if (n === 'Shell') m.material = patch; });
    // the screen sky: hanging lit rectangles, one of them the phone we go back into
    const sg = new THREE.PlaneGeometry(1, 1.6); this.screens = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, side: THREE.DoubleSide, fog: false }), 420);
    const M = new THREE.Matrix4(), C = new THREE.Color();
    for (let i = 0; i < 420; i++) { const a = 3.6 + 2.2 * hash(i), r = 30 + 80 * hash(i * 1.3), y = 18 + 55 * hash(i * 2.1);
      M.compose(new THREE.Vector3(r * Math.cos(a) * 0.9, y, r * Math.sin(a)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4 * hash(i * 5), a, 0)), new THREE.Vector3().setScalar(1 + 2.5 * hash(i * 7)));
      this.screens.setMatrixAt(i, M); this.screens.setColorAt(i, C.setHSL(hash(i * 9), 0.85, 0.45 + 0.2 * hash(i * 11)).multiplyScalar(1.6)); }
    this.s.add(this.screens);
    this.phone = K.phone.root; K.phone.part('interior').visible = false; this.phone.scale.setScalar(0.45);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 14.3), new THREE.MeshBasicMaterial({ map: this.scrRT.texture, toneMapped: false })); scr.position.z = 0.44; this.phone.add(scr); this.phone.position.copy(this.PH); this.phone.lookAt(0, 10, 10); this.s.add(this.phone);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd0a0, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.position.copy(this.PH); this.ring.lookAt(0, 10, 10); this.s.add(this.ring);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; const g = cv.getContext('2d')!; g.translate(512, 256); g.rotate(-0.12);
    g.font = '900 230px Archivo, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 46; g.strokeStyle = '#1a0a20'; g.strokeText('AAAAH!', 0, 0); g.fillStyle = '#ffe14a'; g.fillText('AAAAH!', 0, 0);
    this.yell = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false, fog: false, toneMapped: false })); this.yell.visible = false; this.s.add(this.yell);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t >= END - HAND) return this.s1.render({ ...f, t: t - END }, out);
    const rr = this.ctx.renderer, T0 = SCREAM - 4 * BEAT * 1;
    // vista: patchwork stitches itself onto the shell a band per beat
    this.patchU.uK.value = clamp(Math.floor((t - T0 + 0.05) / BEAT) / 4, 0, 1); this.patchU.uT.value = t;
    const blink = ((t * 1.06) % 1) < 0.55 ? 1 : 0.15; for (const c of this.core) c.emissiveIntensity = 0.4 + 2.2 * blink;
    const up = sm(SCREAM, SCREAM + 0.35, t);
    this.cur.position.y = 8.6 + 0.12 * Math.abs(Math.sin(t * Math.PI / BEAT)) * (1 - up) + 0.6 * sm(SCREAM, SCREAM + 0.12, t) * (1 - sm(SCREAM + 0.12, SCREAM + 0.5, t));
    this.cur.rotation.set(-0.5 * up, 0.3 * Math.sin(t * 0.8) * (1 - up), 0);
    for (const L of this.lookers) { const u = sm(SCREAM + 0.05 + 0.25 * L.ph, SCREAM + 0.3 + 0.25 * L.ph, t);
      L.o.rotation.set(L.base.x - 0.7 * u, L.base.y, L.base.z); L.o.position.y = 0.5 + 0.3 * u * Math.max(0, Math.sin((t - SCREAM) * 18)) * (1 - sm(SCREAM + 0.6, SCREAM + 0.9, t)); }
    const rk = clamp((t - SCREAM) / 1.2, 0, 1); (this.ring.material as THREE.MeshBasicMaterial).opacity = t > SCREAM ? 0.9 * (1 - rk) : 0; this.ring.scale.setScalar(1 + 90 * Math.sqrt(rk));
    // camera: slow crane over the quilt → tilt up to the sky on the scream → whip and fly into the phone
    const vk = sm(T0, SCREAM, t);
    const p = new THREE.Vector3(lerp(5, -1.5, vk), lerp(24, 19, vk), lerp(24, 17, vk)).lerp(new THREE.Vector3(1.0, 6.6, 11.5), sm(SCREAM, SCREAM + 0.6, t));
    const look = new THREE.Vector3(lerp(1, -0.5, vk), lerp(-2, 1, vk), -20).lerp(this.PH, sm(SCREAM + 0.1, SCREAM + 0.8, t));
    const wk = clamp((t - WHIP) / (END - HAND - WHIP), 0, 1), we = 1 - (1 - wk) ** 3;
    const dir = new THREE.Vector3(0, 10, 10).sub(this.PH).normalize(), end = this.PH.clone().addScaledVector(dir, 9.0);
    if (t > WHIP) { p.lerp(end, we); look.copy(this.PH); }
    this.cam.position.copy(p); this.cam.lookAt(look);
    const yk = clamp((t - SCREAM) / 1.5, 0, 1); this.yell.visible = t > SCREAM && yk < 1;
    if (this.yell.visible) { const yp = this.PH.clone().lerp(p, 0.15 + 0.55 * Math.sqrt(yk)); this.yell.position.copy(yp).add(new THREE.Vector3(0.6 * Math.sin(t * 70), 0.6 * Math.cos(t * 61), 0).multiplyScalar(1 - yk));
      const d = yp.distanceTo(p), sz = d * 0.38 * (0.8 + 0.4 * Math.sqrt(yk)); this.yell.scale.set(sz, sz / 2, 1); (this.yell.material as THREE.SpriteMaterial).opacity = 1 - sm(0.75, 1, yk); } this.cam.aspect = out.width / out.height; this.cam.fov = 42 - 10 * Math.max(vk, wk) + 18 * Math.sin(Math.PI * wk); this.cam.updateProjectionMatrix();
    if (t > SCREAM) { this.s1.render({ ...f, t: Math.max(t - END, -HAND - 0.6) }, this.scrRT); }
    rr.setRenderTarget(out); rr.setClearColor(0, 1); rr.clear(); rr.render(this.s, this.cam); rr.resetState();
    const kick = t > SCREAM ? Math.exp(-(t - SCREAM) * 3) : 0, whip = Math.sin(Math.PI * wk);
    return { toneMap: 'aces', exposure: 1.05 + 0.6 * kick, bloom: 0.25 + 0.5 * kick, bloomThreshold: 1.0, vignette: 0.35, grain: 0.03,
      ca: 0.15 + 1.5 * kick + 2.5 * whip, zoom: 1 + 0.08 * whip, shake: [20 * kick * Math.sin(t * 90), 20 * kick * Math.cos(t * 77)] };
  }

  override dispose() { for (const i of this.insts) i.dispose(); this.s1?.dispose(); this.scrRT.dispose(); }
}

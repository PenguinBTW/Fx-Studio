// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// skylantern — paper lanterns rising over a dark valley at dusk. The lantern
// is a real Blender-built GLB (assets/skylantern: faceted paper shell, wire
// rim, hanging flame) cloned per lantern; every motion is closed-form f(t):
// staggered lift-off times, linear ascent, lateral sway, per-lantern flicker
// phase, distance/altitude haze fade. No accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';

const TAKE = 20;
const NL = 60;

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
// Value noise → fbm for the ridge silhouettes (same closed form as meteorfall).
function vnoise(x: number, o: number): number {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = Math.sin(i * 127.1 + o) * 43758.5453, b = Math.sin((i + 1) * 127.1 + o) * 43758.5453;
  return (a - Math.floor(a)) + ((b - Math.floor(b)) - (a - Math.floor(a))) * u;
}
function fbm(x: number, o: number): number {
  return vnoise(x, o) * 0.55 + vnoise(x * 2.13, o + 7.7) * 0.27 + vnoise(x * 4.31, o + 3.1) * 0.18;
}

const FLOOR_Y = -3.2;    // valley floor where lanterns lift from
const HAZE_Y = -2.6;     // haze pool ceiling
const FAR_Z = -46;

// ---- lantern seed schedule ---------------------------------------------------
// t0 lift-off buckets: sparse early (first lift by t≈1.5), dense 5–13 so the
// loose cluster crosses mid-frame t8–12, thin tail to ~16.5 so stragglers
// still rise through the fade-out.
interface Lantern {
  x0: number; z0: number; t0: number; v: number;
  swayA: number; swayW: number; swayP: number;
  drift: number; flick: number; scale: number; seed: number;
}
const LANTERNS: Lantern[] = [];
{
  for (let i = 0; i < NL; i++) {
    const u = i / NL;
    const t0 = u < 0.12 ? 1.0 + 4.0 * hash(i, 21)
      : u < 0.75 ? 4.5 + 8.5 * hash(i, 21)
      : 13.0 + 3.5 * hash(i, 21);
    LANTERNS.push({
      x0: (hash(i, 1) - 0.5) * 30 + (hash(i, 8) - 0.5) * 6,
      z0: -6 - 34 * Math.pow(hash(i, 2), 1.4),          // denser near, sparse far
      t0,
      v: 0.85 + 0.75 * hash(i, 3),                      // m/s ascent
      swayA: 0.35 + 0.55 * hash(i, 4),
      swayW: 0.35 + 0.5 * hash(i, 5),
      swayP: hash(i, 6) * Math.PI * 2,
      drift: (hash(i, 7) - 0.5) * 0.55,                 // wind, m/s
      flick: hash(i, 9) * Math.PI * 2,
      scale: 0.8 + 0.55 * hash(i, 10),
      seed: i,
    });
  }
}
const pos = (l: Lantern, t: number, out: THREE.Vector3): THREE.Vector3 => {
  const up = Math.max(0, t - l.t0);
  const swayGrow = Math.min(1, up / 4);                   // sway builds once aloft
  // The GLB is centered, so resting height = floor + half the model height
  // (0.62 * scale / 2); otherwise the flame and rim sink below the ground.
  const baseY = FLOOR_Y + 0.31 * l.scale;
  return out.set(
    l.x0 + l.drift * up + l.swayA * swayGrow * Math.sin(l.swayW * t + l.swayP),
    baseY + l.v * up,
    l.z0 + 0.6 * swayGrow * Math.sin(l.swayW * 0.7 * t + l.swayP * 1.7),
  );
};
// Paper glow: flame flicker on a slow breathing envelope; fades with altitude
// as the lantern climbs into haze, and with camera distance handled by fog.
function lanternGlow(l: Lantern, t: number): number {
  const up = t - l.t0;
  if (up < 0) return 0.35 + 0.1 * Math.sin(3 * t + l.flick);   // pre-lift: dim ember
  const flick = 0.82 + 0.12 * Math.sin(6.5 * t + l.flick) + 0.06 * Math.sin(13 * t + l.flick * 1.7);
  return flick * Math.max(0.12, hazeFadeFromAlt(pos(l, t, _p).y));
}
// Altitude fade shared by glow and silhouette: 1 at the floor, →0 high up.
const hazeFadeFromAlt = (y: number): number =>
  Math.exp(-Math.max(0, (y - FLOOR_Y) - 12) * 0.07);
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export default class SkylanternScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private insts: GLTFInstance[] = [];
  private lanterns: { root: THREE.Object3D; paper: THREE.MeshStandardMaterial[]; flame: THREE.MeshStandardMaterial[]; halo: THREE.Sprite; haloMat: THREE.SpriteMaterial }[] = [];
  private starGeo: THREE.BufferGeometry;
  private starMat: THREE.PointsMaterial;
  private ownedGeos: THREE.BufferGeometry[] = [];
  private ownedMats: THREE.Material[] = [];
  private ownedTexs: THREE.Texture[] = [];
  private hazeSprites: THREE.Sprite[] = [];

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, ctx.W / ctx.H, 0.1, 400);
    this.threeScene.fog = new THREE.FogExp2('#0b0a18', 0.028);

    // ---- dusk gradient (indigo zenith → ember horizon), canvas texture ------
    const sc = document.createElement('canvas');
    sc.width = 4; sc.height = 256;
    const s2d = sc.getContext('2d')!;
    const sg = s2d.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, '#060412');
    sg.addColorStop(0.45, '#141031');
    sg.addColorStop(0.72, '#3a1e33');
    sg.addColorStop(0.86, '#6b3527');
    sg.addColorStop(0.96, '#8a4a2a');
    sg.addColorStop(1, '#20101a');
    s2d.fillStyle = sg;
    s2d.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(sc);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.PlaneGeometry(220, 90);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 22, -60);
    this.threeScene.add(sky);
    this.ownedGeos.push(skyGeo); this.ownedTexs.push(skyTex); this.ownedMats.push(skyMat);

    // ---- star field (fades in as the sky darkens overhead) -------------------
    const NS = 320;
    const sp = new Float32Array(NS * 3);
    const sb = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
      sp[i * 3] = (hash(i, 31) - 0.5) * 160;
      sp[i * 3 + 1] = 14 + hash(i, 32) * 40;
      sp[i * 3 + 2] = -47 - hash(i, 33) * 10;   // in front of the sky plane (-60), behind the lanterns
      sb[i] = 0.4 + 0.6 * hash(i, 34);
    }
    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 0.35, color: '#cfd6ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false,
    });
    const stars = new THREE.Points(this.starGeo, this.starMat);
    stars.frustumCulled = false;
    this.threeScene.add(stars);
    this.starGeo.userData.base = sb;

    // ---- valley floor + ridge silhouettes ------------------------------------
    const floorGeo = new THREE.PlaneGeometry(240, 80);
    const floorMat = new THREE.MeshBasicMaterial({ color: '#05040a' });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, FLOOR_Y - 0.05, -30);
    this.threeScene.add(floor);
    this.ownedGeos.push(floorGeo); this.ownedMats.push(floorMat);

    const ridge = (zDepth: number, color: string, amp: number, off: number) => {
      const N = 140;
      const pos = new Float32Array(N * 2 * 3);
      const idx: number[] = [];
      for (let i = 0; i < N - 1; i++) {
        const a = i, b = i + 1, c = N + i, d = N + i + 1;
        idx.push(a, c, b, b, c, d);
      }
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1) - 0.5) * 120;
        const y = FLOOR_Y - 0.02 + amp * fbm(x * 0.055 + off, off * 13.7);
        pos.set([x, y, zDepth], i * 3);
        pos.set([x, FLOOR_Y - 0.02, zDepth], (N + i) * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color });
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      this.threeScene.add(m);
      this.ownedGeos.push(g); this.ownedMats.push(mat);
    };
    ridge(-44, '#0d0b1c', 4.2, 0.0);   // far range, lighter (aerial perspective)
    ridge(-30, '#070612', 3.0, 9.0);   // near range, darker

    // ---- ground haze pool (soft sprites hugging the floor) -------------------
    const hazeTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g2 = c.getContext('2d')!;
      const rg = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(140,120,150,0.55)');
      rg.addColorStop(1, 'rgba(140,120,150,0)');
      g2.fillStyle = rg; g2.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.ownedTexs.push(hazeTex);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.SpriteMaterial({
        map: hazeTex, color: '#5a4a6a', transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(26 + hash(i, 41) * 20, 4.5 + hash(i, 42) * 3, 1);
      s.position.set((hash(i, 43) - 0.5) * 60, HAZE_Y + hash(i, 44) * 0.8, -12 - hash(i, 45) * 30);
      this.threeScene.add(s);
      this.hazeSprites.push(s);
      this.ownedMats.push(m);
    }

    // lighting: cool ambient + warm underglow so paper reads, not just emission
    this.threeScene.add(new THREE.AmbientLight('#2a2440', 1.1));
    const duskKey = new THREE.DirectionalLight('#5a4470', 0.5);
    duskKey.position.set(-4, 8, 6);
    this.threeScene.add(duskKey);
  }

  override async init(): Promise<void> {
    const asset = await GLTFManager.load(
      resolveAsset('skylantern', this.ctx.project).url, { center: true });
    // One skeleton-safe instance per lantern (asset.instantiate →
    // SkeletonUtils.clone); each also gets per-lantern paper/flame material
    // clones so the flicker and haze fade can dim each individually.
    for (const l of LANTERNS) {
      const inst = asset.instantiate({ center: true });
      this.insts.push(inst);
      const root = inst.root;
      root.traverse((o) => { o.frustumCulled = false; });
      const paper: THREE.MeshStandardMaterial[] = [];
      const flame: THREE.MeshStandardMaterial[] = [];
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const nm = (mat.name || mesh.name).toLowerCase();
        const clone = mat.clone() as THREE.MeshStandardMaterial;
        mesh.material = clone;
        this.ownedMats.push(clone);
        if (nm.includes('paper') || nm.includes('shell')) {
          clone.emissive = new THREE.Color('#ff8226'); // baked GLB emissive is too pale — warm amber instead
          clone.transparent = true;                  // paper fades out high in the haze
          paper.push(clone);
        } else if (nm.includes('flame')) flame.push(clone);
      });
      root.scale.setScalar(l.scale);
      this.threeScene.add(root);

      // additive halo so the lantern reads as a glow, not a dark dot
      const haloMat = new THREE.SpriteMaterial({
        map: (this.hazeSprites[0].material as THREE.SpriteMaterial).map,
        color: '#ffb45e', transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const halo = new THREE.Sprite(haloMat);
      halo.scale.set(1.9, 1.9, 1);
      root.add(halo);
      this.ownedMats.push(haloMat);
      this.lanterns.push({ root, paper, flame, halo, haloMat });
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = Math.min(f.lt, TAKE);

    // stars strengthen as dusk settles
    this.starMat.opacity = 0.15 + 0.5 * smooth((lt - 6) / 10);

    // haze breathes very slowly
    this.hazeSprites.forEach((s, i) => {
      (s.material as THREE.SpriteMaterial).opacity =
        0.13 + 0.05 * Math.sin(0.35 * lt + i * 1.7);
    });

    for (const [i, l] of LANTERNS.entries()) {
      const L = this.lanterns[i];
      if (!L) continue;
      pos(l, lt, _p);
      L.root.position.copy(_p);
      // tiny pendulum rock from the sway
      L.root.rotation.z = 0.06 * Math.sin(l.swayW * lt + l.swayP);
      L.root.rotation.x = 0.05 * Math.sin(l.swayW * 0.7 * lt + l.swayP * 1.7);
      const g = lanternGlow(l, lt);
      const fade = Math.max(0.12, hazeFadeFromAlt(_p.y));
      for (const m of L.paper) {
        m.emissiveIntensity = 0.9 * g;
        m.opacity = Math.min(1, 0.25 + 0.75 * fade); // high lanterns stop blocking the stars
      }
      for (const m of L.flame) m.emissiveIntensity = 7 * g;
      L.haloMat.opacity = 0.16 * g;
    }

    // camera: slow push up the valley + gentle lateral drift; look slightly
    // above the horizon so the rising lanterns track through frame.
    const u = smooth(lt / TAKE);
    const az = 0.10 - 0.16 * u;
    const r = 26 - 5.5 * u;
    this.camera.position.set(
      Math.sin(az) * r + 1.2 * Math.sin(lt * 0.09),
      1.6 + 1.5 * u,
      Math.cos(az) * r,
    );
    this.camera.lookAt(0.4 * Math.sin(lt * 0.11), 5.2 + 2.4 * u, -18);
    this.camera.aspect = this.ctx.W / this.ctx.H;
    this.camera.updateProjectionMatrix();

    const r2 = this.ctx.renderer;
    r2.setRenderTarget(out);
    r2.setClearColor('#05040a');
    r2.clear();
    r2.render(this.threeScene, this.camera);
    r2.resetState();

    return { bloom: 0.7, bloomThreshold: 0.32, vignette: 0.45, grain: 0.012, exposure: 1.0 };
  }

  override dispose(): void {
    for (const inst of this.insts) inst.dispose();
    this.insts = [];
    for (const g of this.ownedGeos) g.dispose();
    for (const m of this.ownedMats) m.dispose();
    for (const t of this.ownedTexs) t.dispose();
    this.starGeo.dispose();
    this.starMat.dispose();
  }
}

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// geode — inside a cracked-open amethyst geode. The rock shell, jagged mouth
// rim, and ~170 inward crystal spikes are a real Blender-built GLB
// (assets/geode), not a shader stand-in.
//
// Closed-form throughout: the key light sweeps azimuth as f(t), and every
// sampled crystal facet flashes an analytic spectral glint when the half-
// vector between light and view crosses its normal — fresnel-ish, recomputed
// per frame, so seeking shows the exact facet state. Camera arc + dolly is
// f(t). No accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { spectrumRamp } from '../../engine/spectrum';

const TAKE = 20;
const VOID = new THREE.Color('#030208');

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Key-light azimuth/elevation — the slow sweep that walks the glint field
// across the facets. Ramped up around t=5 so the first big sweep lands ~t=8.
function lightDir(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const az = 0.55 + 1.15 * smooth((lt - 4.0) / 9.0) + 0.12 * Math.sin(lt * 0.45);
  const el = 0.42 + 0.16 * Math.sin(lt * 0.31 + 1.2);
  return out.set(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el)).normalize();
}

// Camera: reveal at the mouth rim → drift in through the cavity → deepest at
// ~t=14 → pull back out for the closing silhouette. All piecewise f(t).
function camPos(lt: number, out: THREE.Vector3): THREE.Vector3 {
  const u = Math.min(lt / TAKE, 1);
  const inZ = 3.7 - 2.9 * smooth((lt - 3.0) / 9.5);        // 3.7 → 0.8 through t≈12.5
  const backZ = 3.1 * smooth((lt - 15.6) / 3.4);           // pull out for the silhouette
  const az = 0.42 - 0.55 * u + 0.05 * Math.sin(lt * 0.4);  // gentle arc
  const r = inZ + backZ;
  return out.set(
    Math.sin(az) * r + 0.1 * Math.sin(lt * 0.7),
    0.35 + 0.5 * smooth(u) + 0.05 * Math.sin(lt * 0.53),
    Math.cos(az) * r,
  );
}

interface Facet { c: THREE.Vector3; n: THREE.Vector3; band: number }
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _h = new THREE.Vector3();
const _l = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();
const _col = new THREE.Color();

export default class GeodeScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private inst: GLTFInstance | null = null;
  private keyLight: THREE.DirectionalLight;
  private amber: THREE.PointLight;
  private amberSprite: THREE.Sprite;
  private amberMat: THREE.SpriteMaterial;
  private shaftSprite: THREE.Sprite;
  private shaftMat: THREE.SpriteMaterial;

  private facets: Facet[] = [];
  private glintGeo: THREE.BufferGeometry;
  private glintMat: THREE.PointsMaterial;

  private moteGeo: THREE.BufferGeometry;
  private moteMat: THREE.PointsMaterial;
  private moteSeed: Float32Array; // x0,y0,z0,phase,band,rad

  private crystalBox: THREE.Box3 | null = null;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.05, 60);
    this.threeScene.fog = new THREE.FogExp2('#070310', 0.09);

    this.threeScene.add(new THREE.AmbientLight('#141020', 0.85));
    this.keyLight = new THREE.DirectionalLight('#f2e9d8', 2.2);
    this.threeScene.add(this.keyLight);
    this.threeScene.add(this.keyLight.target);
    // amber backlight bleeding through a crack on the far side of the shell
    this.amber = new THREE.PointLight('#ff9433', 0, 4.5, 2.0);
    this.amber.position.set(-1.35, 0.55, -0.85);
    this.threeScene.add(this.amber);

    const glowTex = (() => {
      const cvs = document.createElement('canvas');
      cvs.width = cvs.height = 128;
      const g = cvs.getContext('2d')!;
      const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(255,190,110,0.85)');
      rg.addColorStop(0.4, 'rgba(255,150,60,0.28)');
      rg.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(cvs);
    })();
    this.amberMat = new THREE.SpriteMaterial({
      map: glowTex, color: '#ffb066', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.amberSprite = new THREE.Sprite(this.amberMat);
    this.amberSprite.scale.set(1.6, 1.9, 1);
    this.amberSprite.position.set(-1.5, 0.62, -1.0);
    this.threeScene.add(this.amberSprite);

    // light-shaft wash through the mouth (drifts with the key light azimuth)
    this.shaftMat = new THREE.SpriteMaterial({
      map: glowTex, color: '#d9c6ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.shaftSprite = new THREE.Sprite(this.shaftMat);
    this.shaftSprite.scale.set(2.6, 1.5, 1);
    this.threeScene.add(this.shaftSprite);

    // ---- facet glint points (colors rewritten per frame) ------------------
    this.glintGeo = new THREE.BufferGeometry();
    this.glintMat = new THREE.PointsMaterial({
      size: 0.035, vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });

    // ---- dust motes in the shaft ------------------------------------------
    const NM = 900;
    this.moteSeed = new Float32Array(NM * 6);
    const mp = new Float32Array(NM * 3);
    const mc = new Float32Array(NM * 3);
    for (let i = 0; i < NM; i++) {
      const o = i * 6;
      this.moteSeed[o] = (hash(i, 1) - 0.5) * 2.4;
      this.moteSeed[o + 1] = (hash(i, 2) - 0.5) * 2.4;
      this.moteSeed[o + 2] = (hash(i, 3) - 0.5) * 2.4;
      this.moteSeed[o + 3] = hash(i, 4) * Math.PI * 2;
      this.moteSeed[o + 4] = hash(i, 5);
      this.moteSeed[o + 5] = 0.05 + 0.12 * hash(i, 6);
    }
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.moteGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    this.moteMat = new THREE.PointsMaterial({
      size: 0.02, vertexColors: true, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.threeScene.add(new THREE.Points(this.moteGeo, this.moteMat));
  }

  override async init(): Promise<void> {
    this.inst = await GLTFManager.instantiate(
      resolveAsset('geode', this.ctx.project).url, {});
    const inst = this.inst;
    // Authored mouth (+Z Blender) → glTF +Y; tip the shell so the mouth faces
    // +Z toward the camera path.
    inst.root.rotation.x = Math.PI / 2;
    this.threeScene.add(inst.root);
    inst.root.updateMatrixWorld(true);

    let crys: THREE.Object3D | undefined;
    try { crys = inst.part('crystals'); } catch { crys = inst.root; }
    crys.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mm = mesh.material as THREE.MeshPhysicalMaterial;
      if (mm && 'emissive' in mm) {
        // glTF vertex colors give the violet→clear gradient; flat facets and a
        // faint inner glow make them read as cut glass, not blobs.
        mm.flatShading = true;
        mm.roughness = 0.13;
        mm.metalness = 0;
        mm.transmission = 0;
        mm.emissive = new THREE.Color('#1a0a2e');
        mm.emissiveIntensity = 0.55;
        mm.needsUpdate = true;
      }
      const geo = mesh.geometry as THREE.BufferGeometry;
      geo.computeBoundingBox();
      this.crystalBox = geo.boundingBox;

      // Deterministic ~1/3 sample of triangles, hash-thinned so coverage
      // spreads over shaft AND tip facets (a fixed stride lands on the same
      // winding position every crystal side).
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const idx = geo.getIndex();
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let tI = 0; tI < triCount; tI++) {
        if (hash(tI, 13) > 1 / 3) continue;
        const i0 = idx ? idx.getX(tI * 3) : tI * 3;
        const i1 = idx ? idx.getX(tI * 3 + 1) : tI * 3 + 1;
        const i2 = idx ? idx.getX(tI * 3 + 2) : tI * 3 + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
        const n = new THREE.Vector3().subVectors(b, a)
          // Verts are already world-space — the normal is too; no extra rotate.
          .cross(new THREE.Vector3().subVectors(c, a)).normalize();
        const cen = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3)
          .addScaledVector(n, 0.006);
        this.facets.push({ c: cen, n, band: hash(tI, 11) });
      }
    });

    const N = this.facets.length;
    const gp = new Float32Array(N * 3), gc = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      gp[i * 3] = this.facets[i]!.c.x;
      gp[i * 3 + 1] = this.facets[i]!.c.y;
      gp[i * 3 + 2] = this.facets[i]!.c.z;
    }
    this.glintGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    this.glintGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    this.threeScene.add(new THREE.Points(this.glintGeo, this.glintMat));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;

    // ---- narrative envelopes ------------------------------------------------
    const rimReveal = smooth(lt / 2.4);                      // mouth rim by t≈2
    const sweepOn = 0.25 + 0.75 * smooth((lt - 4.5) / 4.0); // sweep lands ~t=8
    const deepOn = smooth((lt - 10.0) / 4.0);               // shaft deep ~t=14
    const dimEnd = smooth((lt - 16.8) / 2.4);               // silhouette t≈18+

    camPos(lt, _cam);
    this.camera.position.copy(_cam);
    _look.set(
      0.05 + 0.35 * Math.sin(lt * 0.21) * (1 - dimEnd),
      0.25 * deepOn - 0.15 * dimEnd,
      -0.35 * deepOn,
    );
    this.camera.lookAt(_look);
    this.camera.updateMatrixWorld();

    // ---- lights -------------------------------------------------------------
    lightDir(lt, _l);
    this.keyLight.position.copy(_l).multiplyScalar(6);
    this.keyLight.intensity = (1.4 + 1.4 * sweepOn) * rimReveal * (1 - 0.8 * dimEnd);
    const amberOn = smooth((lt - 1.5) / 3.0) * (1 - 0.35 * dimEnd);
    this.amber.intensity = 1.1 * amberOn;
    this.amberMat.opacity = 0.34 * amberOn;
    this.shaftSprite.position.copy(_l).multiplyScalar(1.9);
    this.shaftMat.opacity = 0.07 * deepOn * (1 - dimEnd);

    // ---- facet glints --------------------------------------------------------
    {
      const gc = this.glintGeo.getAttribute('color') as THREE.BufferAttribute;
      const n = this.facets.length;
      const gate = rimReveal * (1 - 0.55 * dimEnd);
      for (let i = 0; i < n; i++) {
        const fc = this.facets[i]!;
        _v.subVectors(_cam, fc.c).normalize();
        _h.addVectors(_l, _v).normalize();
        const d = Math.max(0, _n.copy(fc.n).dot(_h));
        const g = Math.pow(d, 34) * sweepOn * gate;
        const [r, gg, b] = spectrumRamp(0.08 + 0.84 * fc.band);
        gc.setXYZ(i, r * g, gg * g, b * g);
      }
      gc.needsUpdate = true;
      this.glintMat.opacity = 1;
    }

    // ---- dust motes drift through the shaft ----------------------------------
    {
      const p = this.moteGeo.getAttribute('position') as THREE.BufferAttribute;
      const c = this.moteGeo.getAttribute('color') as THREE.BufferAttribute;
      const n = this.moteSeed.length / 6;
      const bright = 0.35 + 0.65 * deepOn;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        const ph = this.moteSeed[o + 3];
        const rad = this.moteSeed[o + 5];
        const x = this.moteSeed[o] + Math.sin(ph + lt * 0.21) * rad * 3.0;
        const y = this.moteSeed[o + 1] + Math.sin(ph * 1.7 + lt * 0.16) * rad * 2.4;
        const z = this.moteSeed[o + 2] + Math.cos(ph * 1.3 + lt * 0.13) * rad * 3.0;
        p.setXYZ(i, x, y, z);
        // brighter inside the light shaft: proximity to the light axis
        _v.set(x, y, z);
        const t = _v.dot(_l);
        const dx = _v.x - _l.x * t, dy = _v.y - _l.y * t, dz = _v.z - _l.z * t;
        const dShaft = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const b = Math.exp(-dShaft * dShaft * 1.6) * bright * (1 - 0.6 * dimEnd)
          * (0.4 + 0.6 * this.moteSeed[o + 4]);
        c.setXYZ(i, 0.75 * b, 0.7 * b, 0.9 * b);
      }
      p.needsUpdate = true;
      c.needsUpdate = true;
    }

    // ---- telemetry: publish the crystal cluster's screen bounds --------------
    if (typeof window !== 'undefined' && this.crystalBox && this.inst) {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P && P.probe && P.textProbes && P.recordText !== false) {
        const cm = new THREE.Matrix4().multiplyMatrices(
          this.inst.root.matrixWorld,
          (this.inst.part('crystals') as THREE.Object3D).matrixWorld,
        );
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const bb = this.crystalBox;
        for (let cc = 0; cc < 8; cc++) {
          _v.set(
            cc & 1 ? bb.max.x : bb.min.x,
            cc & 2 ? bb.max.y : bb.min.y,
            cc & 4 ? bb.max.z : bb.min.z,
          ).applyMatrix4(cm).project(this.camera);
          const px = (_v.x * 0.5 + 0.5) * this.ctx.W;
          const py = (-_v.y * 0.5 + 0.5) * this.ctx.H;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
        const w = maxX - minX, h = maxY - minY;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0,
          t: lt,
          text: 'crystals',
          fontFamily: 'Archivo, sans-serif',
          fontPx: 24,
          fillStyle: '#d9c6ff',
          globalAlpha: 1,
          layerId: 'geode',
          bbox: [minX, minY, maxX, maxY],
          w, h,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          hPct: (h / this.ctx.H) * 100,
          isStroke: false,
        });
      }
    }

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(VOID, 1);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return { bloom: 0.6, bloomThreshold: 0.3, vignette: 0.45, grain: 0.016 };
  }

  override dispose(): void {
    this.glintGeo.dispose(); this.glintMat.dispose();
    this.moteGeo.dispose(); this.moteMat.dispose();
    this.amberMat.map?.dispose(); this.amberMat.dispose();
    this.shaftMat.dispose();
    this.inst?.dispose();
  }
}

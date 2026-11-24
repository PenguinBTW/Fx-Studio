// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// prismbeam — a collimated bone-white beam strikes a slowly rotating crystal
// prism and exits as a spectral fan. The prism is a real Blender-built GLB
// (assets/prism, beveled triangular prism), not a shader stand-in.
//
// Closed-form throughout: the dispersion is recomputed analytically per frame
// from the prism's rotation angle phi(t) — Snell refraction through the two
// facets the beam actually traverses, per wavelength via the engine's Cauchy
// model (flint-glass constants through waterIOR). Seeking shows the exact fan.
// No accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { waterIOR, refractVector, type V3 } from '../../engine/refract';

const TAKE = 20;
// Flint-glass-flavoured Cauchy coefficients — stronger spread than water so
// the fan reads at 20 s macro scale: n(405)≈1.717, n(680)≈1.655.
const CAUCHY_A = 1.620;
const CAUCHY_B = 16000;
// Facet outward-normal angles of the authored GLB cross-section (degrees in
// the XZ plane, atan2(z,x)): the three flat sides of the triangular prism are
// {180, 60, -60} — read off model.glb's face normals, not assumed.
const FACE_ENTRY = 180; // faces the incoming beam (-X)
const FACE_EXIT = 60;   // faces +X/+Z — the side the internal ray reaches
const APOTHEM = 0.31;   // facet-plane distance from centre (0.62·1.0·0.5)
const SCALE = 1.0;      // scene scale applied to the GLB
const BEAM_Y = 0.78;    // beam height — upper-middle of the crystal
const CENTER_Y = 0.68;  // prism centre height (bottom edge near floor y=0)
const PRISM_X = -0.55;  // prism sits left of frame so the fan has room
const BANDS = 12;       // spectral ribbons
const LAM_MIN = 405, LAM_MAX = 680;
const FAN_TILT = -0.075; // slight downward rake on the exit fan

// Wavelength -> RGB palette (violet -> red), bone-tinted.
const BAND_COL = [
  '#9a7bff', '#7a7dff', '#5a8fff', '#46a6ff', '#3fd4cf', '#41d69a',
  '#5ed46f', '#a9d94d', '#e8d44d', '#f0a03c', '#ff7a3f', '#ff5a47',
];

const VOID = new THREE.Color('#02030a');
const BONE = new THREE.Color('#e8e4d8');

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const DEG = Math.PI / 180;
function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Prism rotation about +Y (radians). With FACE_ENTRY = 180 the incidence angle
 * equals phi itself, so base ~0.96 rad holds incidence near 55° (a 60° prism
 * at n≈1.66 only transmits for i ≳ 45° — below that the internal ray TIRs off
 * the exit facet and the fan dies). The mid-take sweep pushes incidence toward
 * grazing, which both sweeps the fan and grows the spread.
 */
function prismPhi(lt: number): number {
  return Math.PI / 6 + 0.44 + 0.011 * lt + 0.28 * smooth((lt - 8.5) / 9.5);
}

/**
 * Analytic dispersion through the prism for wavelength `lam` nm at rotation
 * `phi` (radians). Returns the exit point on the exit facet and the refracted
 * direction (XZ), or null when the ray misses / TIRs.
 */
function disperse(lam: number, phi: number, out: { p: THREE.Vector3; d: THREE.Vector3 }): boolean {
  const a1 = (FACE_ENTRY - phi / DEG) * DEG;
  const n1: V3 = [Math.cos(a1), 0, Math.sin(a1)];
  const d0: V3 = [1, 0, 0];
  const n = waterIOR(lam, CAUCHY_A, CAUCHY_B);
  const d1 = refractVector(d0, n1, 1 / n);
  if (!d1) return false;
  const a2 = (FACE_EXIT - phi / DEG) * DEG;
  const n2: V3 = [Math.cos(a2), 0, Math.sin(a2)];
  // Exit: pass the normal facing the incident (internal) side = -N2.
  const d2 = refractVector(d1, [-n2[0], -n2[1], -n2[2]], n);
  if (!d2) return false;
  // Entry point: the facet centre — the beam is aimed at it so it always
  // lands mid-facet as the prism turns (planes live at (p-C)·n = apothem).
  const ex = PRISM_X + APOTHEM * n1[0], ez = APOTHEM * n1[2];
  // Exit point: internal ray from (ex,ez) hits plane (p-C)·n2 = apothem.
  const rhs = APOTHEM + PRISM_X * n2[0];
  const s2 = (rhs - (ex * n2[0] + ez * n2[2])) / (d1[0] * n2[0] + d1[2] * n2[2]);
  out.p.set(ex + s2 * d1[0], BEAM_Y, ez + s2 * d1[2]);
  // Rake the fan slightly downward while keeping the XZ dispersion split.
  out.d.set(d2[0], FAN_TILT, d2[2]).normalize();
  return true;
}

export default class PrismbeamScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private inst: GLTFInstance | null = null;

  // Beam shaft (core + halo), dust motes, spectral fan, caustic, glints.
  private beamGeo: THREE.BufferGeometry;
  private beamMat: THREE.MeshBasicMaterial;
  private haloGeo: THREE.BufferGeometry;
  private haloMat: THREE.MeshBasicMaterial;
  private moteGeo: THREE.BufferGeometry;
  private moteMat: THREE.PointsMaterial;
  private moteSeed: Float32Array; // u along beam, lateral, phase
  private fanGeo: THREE.BufferGeometry;
  private fanMat: THREE.MeshBasicMaterial;
  private causticMat: THREE.SpriteMaterial;
  private caustic: THREE.Sprite;
  private glintMat: THREE.LineBasicMaterial;
  private glintGeo: THREE.BufferGeometry;
  private floorGeo: THREE.BufferGeometry;
  private floorMat: THREE.MeshBasicMaterial;
  private crystalBox: THREE.Box3 | null = null;

  private _tmp = { p: new THREE.Vector3(), d: new THREE.Vector3() };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, ctx.W / ctx.H, 0.1, 400);

    // ---- floor: near-black slab catching the caustic -----------------------
    const floor = new THREE.Mesh(
      (this.floorGeo = new THREE.PlaneGeometry(80, 60)),
      (this.floorMat = new THREE.MeshBasicMaterial({ color: '#04050a' })),
    );
    floor.rotation.x = -Math.PI / 2;
    this.threeScene.add(floor);

    // ---- beam: core strip + wider halo strip (XZ quads at BEAM_Y) ----------
    this.beamGeo = new THREE.BufferGeometry();
    this.beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    this.beamMat = new THREE.MeshBasicMaterial({
      color: BONE, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.threeScene.add(new THREE.Mesh(this.beamGeo, this.beamMat));
    this.haloGeo = new THREE.BufferGeometry();
    this.haloGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    this.haloMat = new THREE.MeshBasicMaterial({
      color: '#8f94b8', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.threeScene.add(new THREE.Mesh(this.haloGeo, this.haloMat));

    // ---- dust motes inside the beam ---------------------------------------
    const MOTES = 240;
    this.moteSeed = new Float32Array(MOTES * 3);
    const mp = new Float32Array(MOTES * 3);
    const mc = new Float32Array(MOTES * 3);
    for (let i = 0; i < MOTES; i++) {
      this.moteSeed[i * 3] = hash(i, 3);
      this.moteSeed[i * 3 + 1] = (hash(i, 5) - 0.5) * 2;
      this.moteSeed[i * 3 + 2] = hash(i, 7) * Math.PI * 2;
      const b = 0.25 + 0.75 * hash(i, 9);
      mc[i * 3] = BONE.r * b; mc[i * 3 + 1] = BONE.g * b; mc[i * 3 + 2] = BONE.b * b;
    }
    this.moteGeo = new THREE.BufferGeometry();
    this.moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.moteGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    this.moteMat = new THREE.PointsMaterial({
      size: 0.045, vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    this.threeScene.add(new THREE.Points(this.moteGeo, this.moteMat));

    // ---- spectral fan: one triangle per band, rebuilt per frame ------------
    const fv = new Float32Array(BANDS * 3 * 3);
    const fc = new Float32Array(BANDS * 3 * 3);
    const col = new THREE.Color();
    for (let i = 0; i < BANDS; i++) {
      col.set(BAND_COL[i % BAND_COL.length]);
      for (let v = 0; v < 3; v++) {
        fc[(i * 3 + v) * 3] = col.r; fc[(i * 3 + v) * 3 + 1] = col.g; fc[(i * 3 + v) * 3 + 2] = col.b;
      }
    }
    this.fanGeo = new THREE.BufferGeometry();
    this.fanGeo.setAttribute('position', new THREE.BufferAttribute(fv, 3));
    this.fanGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
    this.fanMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.threeScene.add(new THREE.Mesh(this.fanGeo, this.fanMat));

    // ---- caustic pool under the mean exit ray ------------------------------
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    const g2 = cvs.getContext('2d')!;
    const rg = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,0.6)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = rg; g2.fillRect(0, 0, 128, 128);
    const cTex = new THREE.CanvasTexture(cvs);
    this.causticMat = new THREE.SpriteMaterial({
      map: cTex, color: '#cfd8ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.caustic = new THREE.Sprite(this.causticMat);
    this.caustic.scale.set(2.4, 1.0, 1);
    this.caustic.position.set(3.4, 0.06, 0.4);
    this.threeScene.add(this.caustic);

    // ---- late-take glints on the crystal edges -----------------------------
    this.glintGeo = new THREE.BufferGeometry();
    this.glintMat = new THREE.LineBasicMaterial({
      color: '#dfe8ff', transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }

  override async init(): Promise<void> {
    this.inst = await GLTFManager.instantiate(
      resolveAsset('prism', this.ctx.project).url, {});
    const inst = this.inst;
    inst.root.scale.setScalar(SCALE);
    inst.root.position.set(PRISM_X, CENTER_Y, 0);
    this.threeScene.add(inst.root);
    // Edge glints: a wireframe over the crystal's own bevel edges, driven
    // late. Added as a child of the mesh so it inherits the prism rotation.
    let crystal: THREE.Object3D | undefined;
    try { crystal = inst.part('crystal'); } catch { crystal = inst.root; }
    crystal.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !this.glintGeo.getAttribute('position')) {
        this.glintGeo = new THREE.EdgesGeometry(mesh.geometry, 24);
        mesh.add(new THREE.LineSegments(this.glintGeo, this.glintMat));
        // Local bounds of the crystal for the probe telemetry below.
        mesh.geometry.computeBoundingBox();
        this.crystalBox = mesh.geometry.boundingBox;
        // A faint inner glow so the crystal reads against the near-black
        // (the glTF transmission material has no environment to refract).
        const mm = mesh.material as THREE.MeshPhysicalMaterial;
        if (mm && 'emissive' in mm) {
          mm.emissive = new THREE.Color('#0d1524');
          mm.emissiveIntensity = 0.9;
        }
      }
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;

    // ---- narrative envelopes ----------------------------------------------
    const beamOn = smooth((lt - 0.9) / 1.1);           // strikes at ~t=2
    const fanOn = smooth((lt - 2.2) / 5.8);            // resolves ~t=8
    const fanGone = 1 - smooth((lt - 16.1) / 1.6);     // exits frame ~t=17.8
    const glintOn = smooth((lt - 17.2) / 1.3);         // prism glints after
    const phi = prismPhi(lt);

    // ---- prism -------------------------------------------------------------
    if (this.inst) {
      this.inst.root.rotation.y = phi;
      this.inst.root.position.y = CENTER_Y + 0.03 * Math.sin(lt * 0.4);
    }

    // ---- beam hits the entry facet (aimed at the facet centre) -------------
    const a1 = (FACE_ENTRY - phi / DEG) * DEG;
    const ex = PRISM_X + APOTHEM * Math.cos(a1), ez = APOTHEM * Math.sin(a1);
    const quad = (geo: THREE.BufferGeometry, x0: number, x1: number, z: number, w0: number, w1: number, y: number) => {
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      p.setXYZ(0, x0, y, z - w0); p.setXYZ(1, x0, y, z + w0);
      p.setXYZ(2, x1, y, z - w1); p.setXYZ(3, x1, y, z + w1);
      p.needsUpdate = true;
      if (!geo.getIndex()) geo.setIndex([0, 1, 2, 2, 1, 3]);
    };
    quad(this.beamGeo, -9.5, ex, ez, 0.014, 0.03, BEAM_Y);
    quad(this.haloGeo, -9.5, ex, ez, 0.06, 0.11, BEAM_Y);
    this.beamMat.opacity = 0.85 * beamOn;
    this.haloMat.opacity = 0.16 * beamOn;

    // ---- motes drift through the live beam ---------------------------------
    {
      const p = this.moteGeo.getAttribute('position') as THREE.BufferAttribute;
      const n = this.moteSeed.length / 3;
      for (let i = 0; i < n; i++) {
        const u = (this.moteSeed[i * 3] + lt * 0.16) % 1;      // drift along beam
        const lat = this.moteSeed[i * 3 + 1];
        const ph = this.moteSeed[i * 3 + 2];
        const x = -9.5 + u * (ex + 9.5);
        const r = 0.05 + 0.05 * u;
        p.setXYZ(i, x, BEAM_Y + Math.sin(ph + lt * 0.7) * r,
                 ez + Math.cos(ph * 1.3 + lt * 0.5) * r * lat);
      }
      p.needsUpdate = true;
      this.moteMat.opacity = 0.5 * beamOn;
    }

    // ---- spectral fan -------------------------------------------------------
    {
      const p = this.fanGeo.getAttribute('position') as THREE.BufferAttribute;
      const L = 10, W1 = 0.2;
      let live = 0;
      for (let i = 0; i < BANDS; i++) {
        const lam = LAM_MIN + (LAM_MAX - LAM_MIN) * (i / (BANDS - 1));
        const ok = disperse(lam, phi, this._tmp);
        const o = i * 3;
        if (!ok) { for (let v = 0; v < 3; v++) p.setXYZ(o + v, 0, -40, 0); continue; }
        live++;
        const X = this._tmp.p, D = this._tmp.d;
        // perpendicular in the dispersion plane (XZ): rot90 of horizontal part
        const pl = Math.hypot(D.x, D.z) || 1;
        const px = -D.z / pl, pz = D.x / pl;
        const exX = X.x + D.x * L, exY = X.y + D.y * L, exZ = X.z + D.z * L;
        p.setXYZ(o, X.x, X.y, X.z);
        p.setXYZ(o + 1, exX - px * W1, exY - 0.12, exZ - pz * W1);
        p.setXYZ(o + 2, exX + px * W1, exY + 0.05, exZ + pz * W1);
      }
      p.needsUpdate = true;
      this.fanMat.opacity = 0.62 * fanOn * fanGone * (live / BANDS);

      // caustic pool sits where the mean exit ray meets the floor
      if (live > 0) {
        const mid = disperse(560, phi, this._tmp);
        if (mid) {
          const s = Math.min(12, Math.max(0, (this._tmp.p.y - 0.05) / Math.max(0.02, -this._tmp.d.y)));
          this.caustic.position.set(
            this._tmp.p.x + this._tmp.d.x * s,
            0.06,
            this._tmp.p.z + this._tmp.d.z * s,
          );
        }
      }
      this.causticMat.opacity = 0.15 * fanOn * fanGone;
    }

    // ---- late glints ---------------------------------------------------------
    this.glintMat.opacity = 0.09 + 0.5 * glintOn * (0.55 + 0.45 * Math.sin(lt * 2.1));

    // ---- telemetry: publish the crystal's screen bounds --------------------
    if (typeof window !== 'undefined' && this.crystalBox && this.inst) {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P && P.probe && P.textProbes && P.recordText !== false) {
        this.inst.root.updateMatrixWorld(true);
        const v = this._tmp.p;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const bb = this.crystalBox;
        for (let c = 0; c < 8; c++) {
          v.set(
            c & 1 ? bb.max.x : bb.min.x,
            c & 2 ? bb.max.y : bb.min.y,
            c & 4 ? bb.max.z : bb.min.z,
          ).applyMatrix4(this.inst.root.matrixWorld).project(this.camera);
          const px = (v.x * 0.5 + 0.5) * this.ctx.W;
          const py = (-v.y * 0.5 + 0.5) * this.ctx.H;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
        const w = maxX - minX, h = maxY - minY;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0,
          t: lt,
          text: 'crystal',
          fontFamily: 'Archivo, sans-serif',
          fontPx: 24,
          fillStyle: '#dfe8ff',
          globalAlpha: 1,
          layerId: 'prismbeam',
          bbox: [minX, minY, maxX, maxY],
          w, h,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
          hPct: (h / this.ctx.H) * 100,
          isStroke: false,
        });
      }
    }

    // ---- camera: slow push-in, beam-left composition -------------------------
    const u = Math.min(lt / TAKE, 1);
    this.camera.position.set(
      -0.35 + 0.5 * u + Math.sin(lt * 0.06) * 0.2,
      2.6 - 0.4 * u,
      6.4 - 1.3 * u,
    );
    this.camera.lookAt(0.3, 0.85, 0);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(VOID, 1);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return { bloom: 0.55, bloomThreshold: 0.34, vignette: 0.42, grain: 0.015 };
  }

  override dispose(): void {
    this.beamGeo.dispose(); this.beamMat.dispose();
    this.haloGeo.dispose(); this.haloMat.dispose();
    this.moteGeo.dispose(); this.moteMat.dispose();
    this.fanGeo.dispose(); this.fanMat.dispose();
    this.glintGeo.dispose(); this.glintMat.dispose();
    this.causticMat.map?.dispose(); this.causticMat.dispose();
    this.floorGeo.dispose(); this.floorMat.dispose();
    this.inst?.dispose();
  }
}

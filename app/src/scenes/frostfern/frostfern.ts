// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// frostfern — frost crystals growing across a dark window pane.
//
// Closed-form throughout:
//   A deterministic dendrite tree is grown once at setup: every vertex
//   stores growT (the moment its segment appears). Per frame the vertex
//   colour is a pure f(t) of growT — fresh tips flash cold cyan and
//   settle to bone. Seeking to any t shows the exact growth front.
//   Fog haze and the camera are closed-form f(t) as well.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20;
const MAX_SEG = 34000;
const FOG_SPRITES = 4;

const BONE = new THREE.Color('#dbe4f0');
const CYAN = new THREE.Color('#86d8e8');
const DARK = new THREE.Color('#04060a');
const WARM = new THREE.Color('#2b1c10');

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default class FrostfernScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private crystalGeo: THREE.BufferGeometry;
  private crystalMat: THREE.LineBasicMaterial;
  private growT: Float32Array;      // per-vertex appearance time
  private baseA: Float32Array;      // per-vertex steady brightness
  private tipGeo: THREE.BufferGeometry;
  private tipMat: THREE.PointsMaterial;
  private tipT: Float32Array;
  private bgGeo: THREE.PlaneGeometry;
  private bgMat: THREE.MeshBasicMaterial;
  private fogTex: THREE.CanvasTexture;
  private fogMats: THREE.SpriteMaterial[] = [];

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 500);

    // Pane backdrop: near-black with a faint warm lamp gradient upper-right.
    this.bgGeo = new THREE.PlaneGeometry(70, 40, 24, 16);
    const bp = this.bgGeo.getAttribute('position') as THREE.BufferAttribute;
    const bc = new Float32Array(bp.count * 3);
    for (let k = 0; k < bp.count; k++) {
      const x = bp.getX(k), y = bp.getY(k);
      const d = Math.hypot(x - 16, y - 8) / 30;
      const w = Math.pow(Math.max(0, 1 - d), 2.2);
      const c = DARK.clone().lerp(WARM, w * 0.85);
      bc[k * 3] = c.r; bc[k * 3 + 1] = c.g; bc[k * 3 + 2] = c.b;
    }
    this.bgGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    this.bgMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const bg = new THREE.Mesh(this.bgGeo, this.bgMat);
    bg.position.z = -2;
    this.threeScene.add(bg);

    // ---- Dendrite tree build ------------------------------------------------
    const pos: number[] = [];
    const t0s: number[] = [];
    const bas: number[] = [];
    const tips: number[] = [];
    const tipTs: number[] = [];
    let segs = 0;

    // Periodic herringbone: each step alternately feathers a ±~60°
    // side-branch, tapering toward the tip — the classic frost-fern look.
    const grow = (x: number, y: number, ang: number, len: number, depth: number, t0: number, seed: number, w: number) => {
      if (segs >= MAX_SEG || len < 0.3 || depth > 5) return;
      const steps = Math.max(4, Math.round(len / 0.34));
      const dur = Math.min(4.0, 0.8 + len * 0.7);
      let px = x, py = y, a = ang;
      for (let i = 1; i <= steps && segs < MAX_SEG; i++) {
        a += (hash(seed * 997 + i * 17 + depth * 131, 5) - 0.5) * 0.16;
        const ds = len / steps;
        const nx = px + Math.cos(a) * ds;
        const ny = py + Math.sin(a) * ds;
        const gt = t0 + (i / steps) * dur;
        pos.push(px, py, 0, nx, ny, 0);
        t0s.push(gt, gt);
        const b = w * (1.05 + 0.25 * hash(seed * 41 + i, 13));
        bas.push(b, b);
        segs++;
        // Side feathers alternate ±60°, shrinking toward the tip; deeper
        // levels feather less often so the silhouette stays readable.
        const taper = 1 - (i / steps) * 0.55;
        const side = i % 2 === 0 ? 1 : -1;
        const spawn = depth === 0 ? true : i % depth === 0;
        if (spawn && hash(seed * 733 + i * 97 + depth * 53, 7) < (depth === 0 ? 0.8 : 0.7)) {
          grow(nx, ny,
            a + side * (1.02 + 0.18 * hash(seed + i, 11)),
            len * (0.42 + 0.2 * hash(seed + i * 3, 17)) * taper,
            depth + 1, gt, seed * 31 + i * 7, w * 0.68);
        }
        px = nx; py = ny;
      }
      tips.push(px, py, 0);
      tipTs.push(t0 + dur);
    };

    // Seeds creeping in from the edges — corners and lower edge, DLA-look.
    const seeds: Array<[number, number, number, number, number]> = [
      // x, y, angle, len, t0
      [-13.5, -7.5, 0.55, 9.5, 0.4],
      [14.0, -6.0, Math.PI - 0.5, 10.5, 0.9],
      [-14.5, 2.0, -0.15, 8.5, 2.2],
      [12.0, 8.5, Math.PI + 0.75, 7.5, 3.6],
      [-6.0, -8.5, 1.25, 8.0, 1.6],
      [4.0, -8.8, 1.7, 7.0, 6.0],
      [14.5, 0.5, Math.PI + 0.1, 6.5, 8.0],
      [-8.0, 8.8, -1.3, 6.0, 9.5],
    ];
    seeds.forEach((s, i) => grow(s[0], s[1], s[2], s[3], 0, s[4], 101 + i * 131, 1.0));

    this.growT = new Float32Array(t0s);
    this.baseA = new Float32Array(bas);
    this.crystalGeo = new THREE.BufferGeometry();
    this.crystalGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.crystalGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    this.crystalMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const crystals = new THREE.LineSegments(this.crystalGeo, this.crystalMat);
    crystals.frustumCulled = false;
    this.threeScene.add(crystals);

    // Sparkle points at branch tips — appear as their branch completes.
    this.tipT = new Float32Array(tipTs);
    this.tipGeo = new THREE.BufferGeometry();
    this.tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tips), 3));
    this.tipGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tips.length), 3));
    this.tipMat = new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const tipPts = new THREE.Points(this.tipGeo, this.tipMat);
    tipPts.frustumCulled = false;
    this.threeScene.add(tipPts);

    // Breath-fog haze: soft sprites drifting slowly in front of the pane.
    const fc = document.createElement('canvas');
    fc.width = fc.height = 128;
    const g2d = fc.getContext('2d')!;
    const grad = g2d.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2d.fillStyle = grad;
    g2d.fillRect(0, 0, 128, 128);
    this.fogTex = new THREE.CanvasTexture(fc);
    for (let i = 0; i < FOG_SPRITES; i++) {
      const m = new THREE.SpriteMaterial({
        map: this.fogTex, color: BONE.clone(), transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const sp = new THREE.Sprite(m);
      sp.scale.set(14 + 6 * hash(i, 3), 9 + 4 * hash(i, 5), 1);
      sp.position.set(-10 + 20 * hash(i, 7), -4 + 9 * hash(i, 9), 1.2);
      this.threeScene.add(sp);
      this.fogMats.push(m);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);

    // Crystal growth: alpha ramps in over ~0.5s; fresh growth is cyan,
    // settling to bone over ~4s as the crystal "freezes into place".
    const col = this.crystalGeo.getAttribute('color') as THREE.BufferAttribute;
    const n = this.growT.length;
    const settle = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const age = lt - this.growT[i];
      const a = smooth(age * 2.2) * this.baseA[i];
      if (a <= 0) { col.setXYZ(i, 0, 0, 0); continue; }
      const m = Math.min(1, Math.max(0, age / 4));
      settle.copy(CYAN).lerp(BONE, m).multiplyScalar(a);
      col.setXYZ(i, settle.r, settle.g, settle.b);
    }
    col.needsUpdate = true;

    // Tip sparkles: pop in when the branch lands, gentle deterministic twinkle.
    const tc = this.tipGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < this.tipT.length; i++) {
      const on = smooth((lt - this.tipT[i]) * 3);
      const tw = 0.55 + 0.45 * Math.sin(lt * 2.4 + hash(i, 19) * 6.28);
      const b = on * tw * 0.7;
      tc.setXYZ(i, BONE.r * b, BONE.g * b, BONE.b * b);
    }
    tc.needsUpdate = true;

    // Fog: slow closed-form drift, densest early, thinning as frost covers.
    for (let i = 0; i < this.fogMats.length; i++) {
      this.fogMats[i].opacity = 0.11 * (0.65 + 0.35 * Math.sin(lt * 0.23 + i * 1.7)) * (1 - 0.35 * u);
    }

    // Macro lens: near-static with a very slow push-in and gentle float.
    const dist = 26 * (1.05 - 0.07 * u);
    this.camera.position.set(Math.sin(lt * 0.05) * 0.5, Math.sin(lt * 0.07 + 1.2) * 0.3, dist);
    this.camera.lookAt(0.4, 0.1, 0);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.45,
      bloomThreshold: 0.42,
      vignette: 0.38,
      grain: 0.012,
      exposure: 1.0,
    };
  }

  override dispose(): void {
    this.crystalGeo.dispose();
    this.crystalMat.dispose();
    this.tipGeo.dispose();
    this.tipMat.dispose();
    this.bgGeo.dispose();
    this.bgMat.dispose();
    this.fogTex.dispose();
    for (const m of this.fogMats) m.dispose();
  }
}

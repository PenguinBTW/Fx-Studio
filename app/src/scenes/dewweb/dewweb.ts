// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// dewweb — a spider orb web beaded with dew at first light, extreme macro.
//
// Closed-form throughout:
//   Web geometry (spokes + sagged spiral capture threads) is built once.
//   Every vertex stores its rest position + sway weight; per frame the
//   position is rest + sway(t) — seeking shows the exact sway phase.
//   Dew drops are points whose colour is a displaced sample of the analytic
//   bokeh field (fake refraction) plus a specular glint that swings as a
//   virtual sun climbs off-frame. No integration, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20;
const SPOKES = 14;
const BOKEH_N = 14;

const BONE = new THREE.Color('#e2e7ee');
const VOID = new THREE.Color('#030507');
const WARM = new THREE.Color('#e8b26a');
const GREEN_DEEP = new THREE.Color('#0d1410');
const GREEN_MID = new THREE.Color('#24331f');
const GREEN_SOFT = new THREE.Color('#3d522f');

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Analytic bokeh field shared by the sprite layer and the dew-drop
// "refraction" lookup — drops sample this at a displaced position.
const blobs: { x: number; y: number; r: number; c: THREE.Color; w: number }[] = [];
for (let i = 0; i < 9; i++) {
  blobs.push({
    x: -9 + 18 * hash(i, 11),
    y: -5 + 10 * hash(i, 13),
    r: 2.5 + 4.5 * hash(i, 17),
    c: [GREEN_MID, GREEN_SOFT, new THREE.Color('#4a3f24')][i % 3],
    w: 0.5 + 0.5 * hash(i, 19),
  });
}
function bgTint(x: number, y: number, t: number, out: THREE.Color): THREE.Color {
  out.copy(GREEN_DEEP);
  const focus = 0.5 + 0.5 * Math.sin(t * 0.32); // defocus-plane rack
  for (const b of blobs) {
    const d = Math.hypot(x - b.x, y - b.y) / (b.r * (0.8 + 0.5 * focus));
    const w = Math.pow(Math.max(0, 1 - d), 2.4) * b.w;
    out.r += b.c.r * w; out.g += b.c.g * w; out.b += b.c.b * w;
  }
  // warm crest rising mid-take, strongest near the top edge
  const crest = smooth((t - 8) / 7) * Math.max(0, 1 - Math.abs(y - 4.5) / 5);
  out.r += WARM.r * crest * 0.35; out.g += WARM.g * crest * 0.35; out.b += WARM.b * crest * 0.35;
  return out;
}

export default class DewwebScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private webGeo: THREE.BufferGeometry;
  private webMat: THREE.LineBasicMaterial;
  private rest: Float32Array;    // per-vertex rest position (x,y,z)
  private swayW: Float32Array;   // 0 at anchors/hub, 1 mid-strand
  private swayP: Float32Array;   // sway phase per vertex
  private baseA: Float32Array;   // steady brightness
  private glintP: Float32Array;  // glint phase per vertex
  private dropGeo: THREE.BufferGeometry;
  private dropMat: THREE.PointsMaterial;
  private dropRest: Float32Array;
  private dropSwayW: Float32Array;
  private dropPhase: Float32Array;
  private bokehTex: THREE.CanvasTexture;
  private bokehMats: THREE.SpriteMaterial[] = [];
  private bokehSprites: THREE.Sprite[] = [];
  private bokehBase: { x: number; y: number; s: number }[] = [];
  private crestMat: THREE.SpriteMaterial;
  private _c = new THREE.Color();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(33, ctx.W / ctx.H, 0.1, 500);

    // ---- Defocused warm-green bokeh backdrop -------------------------------
    const bc = document.createElement('canvas');
    bc.width = bc.height = 128;
    const b2d = bc.getContext('2d')!;
    const bg = b2d.createRadialGradient(64, 64, 0, 64, 64, 64);
    bg.addColorStop(0, 'rgba(255,255,255,0.55)');
    bg.addColorStop(0.45, 'rgba(255,255,255,0.16)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    b2d.fillStyle = bg;
    b2d.fillRect(0, 0, 128, 128);
    this.bokehTex = new THREE.CanvasTexture(bc);
    for (let i = 0; i < BOKEH_N; i++) {
      const m = new THREE.SpriteMaterial({
        map: this.bokehTex, transparent: true, depthWrite: false,
        color: [GREEN_MID, GREEN_SOFT, GREEN_DEEP, GREEN_DEEP][i % 4],
        opacity: 0.35,
      });
      const sp = new THREE.Sprite(m);
      const s = 3 + 6 * hash(i, 23);
      sp.scale.set(s, s, 1);
      const bx = -11 + 22 * hash(i, 29), by = -6 + 12 * hash(i, 31);
      sp.position.set(bx, by, -8);
      this.threeScene.add(sp);
      this.bokehMats.push(m);
      this.bokehSprites.push(sp);
      this.bokehBase.push({ x: bx, y: by, s });
    }
    // Sun-crest glow, rides the top edge and peaks mid-take.
    this.crestMat = new THREE.SpriteMaterial({
      map: this.bokehTex, transparent: true, depthWrite: false,
      color: WARM.clone(), opacity: 0,
    });
    const crest = new THREE.Sprite(this.crestMat);
    crest.scale.set(16, 9, 1);
    crest.position.set(2, 6.5, -7.5);
    this.threeScene.add(crest);

    // ---- Web geometry --------------------------------------------------------
    // Hub off-centre; spokes run to anchors on a big off-frame ellipse.
    const CX = -0.7, CY = 0.4;
    const anchorX: number[] = [], anchorY: number[] = [];
    for (let i = 0; i < SPOKES; i++) {
      const a = (i / SPOKES) * Math.PI * 2 + hash(i, 41) * 0.14;
      const rx = 14 + 2 * hash(i, 43), ry = 8.5 + 1.5 * hash(i, 47);
      anchorX.push(CX + Math.cos(a) * rx);
      anchorY.push(CY + Math.sin(a) * ry);
    }
    // spoke direction unit vectors
    const dirX = anchorX.map(x => x - CX), dirY = anchorY.map(y => y - CY);
    const dirL = dirX.map((x, i) => Math.hypot(x, dirY[i]));
    for (let i = 0; i < SPOKES; i++) { dirX[i] /= dirL[i]; dirY[i] /= dirL[i]; }

    const pos: number[] = [];       // xyz triples
    const swayW: number[] = [];
    const swayP: number[] = [];
    const baseA: number[] = [];
    const glintP: number[] = [];
    const dropPos: number[] = [];
    const dropSway: number[] = [];
    const dropPh: number[] = [];
    const dropSz: number[] = [];
    let segCount = 0;

    const vPush = (x: number, y: number, z: number, w: number, a: number, ph: number) => {
      pos.push(x, y, z); swayW.push(w); swayP.push(hash(segCount * 2 + w, 53) * 6.28);
      baseA.push(a); glintP.push(ph);
    };
    const strand = (x0: number, y0: number, x1: number, y1: number, u0: number, u1: number, steps: number, bright: number) => {
      // subdivide so per-vertex sag/sway stays smooth in macro
      let px = x0, py = y0;
      for (let s = 1; s <= steps; s++) {
        const v = s / steps, u = u0 + (u1 - u0) * v;
        const x = x0 + (x1 - x0) * v, y = y0 + (y1 - y0) * v;
        const w = Math.sin(Math.PI * u); // zero at both ends of the strand run
        vPush(px, py, 0, w, bright, hash(segCount, 59) * 6.28);
        vPush(x, y, 0, w, bright, hash(segCount, 59) * 6.28);
        px = x; py = y;
        segCount++;
      }
    };

    // Radial spokes: straight, brighter (structural silk).
    for (let i = 0; i < SPOKES; i++) {
      strand(CX, CY, anchorX[i], anchorY[i], 0, 1, 26, 0.9);
    }
    // Spiral capture threads: rings of increasing radius; each arc between
    // neighbouring spokes sags outward-down like a real capture spiral.
    const radii: number[] = [];
    for (let r = 1.15; r < 12.5; r *= 1.32) radii.push(r);
    for (let ri = 0; ri < radii.length; ri++) {
      const r = radii[ri];
      for (let i = 0; i < SPOKES; i++) {
        const j = (i + 1) % SPOKES;
        const x0 = CX + dirX[i] * r, y0 = CY + dirY[i] * r;
        const x1 = CX + dirX[j] * r, y1 = CY + dirY[j] * r;
        // sag: midpoint pulled outward & down
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const ox = mx - CX, oy = my - CY;
        const ol = Math.hypot(ox, oy) || 1;
        const sag = 0.16 + 0.05 * hash(ri * SPOKES + i, 61);
        const sx = mx + (ox / ol) * sag, sy = my + (oy / ol) * sag - sag * 0.4;
        // two segments through the sag point, capture silk slightly dimmer
        strand(x0, y0, sx, sy, 0, 0.55, 5, 0.62);
        strand(sx, sy, x1, y1, 0.55, 1, 5, 0.62);
        // dew beads seated along capture threads (sparser near hub)
        if (ri > 1 && hash(ri * SPOKES + i, 67) < 0.62) {
          const t = 0.25 + 0.5 * hash(ri * SPOKES + i, 71);
          const dx = x0 + (x1 - x0) * t + (sx - mx) * 0.8;
          const dy = y0 + (y1 - y0) * t + (sy - my) * 0.8;
          dropPos.push(dx, dy, 0.12);
          dropSway.push(Math.sin(Math.PI * 0.55));
          dropPh.push(hash(ri * SPOKES + i, 73) * 6.28);
          dropSz.push(0.55 + 0.45 * hash(ri * SPOKES + i, 79)); // reserved for per-drop size
        }
      }
    }

    this.rest = new Float32Array(pos);
    this.swayW = new Float32Array(swayW);
    this.swayP = new Float32Array(swayP);
    this.baseA = new Float32Array(baseA);
    this.glintP = new Float32Array(glintP);
    this.webGeo = new THREE.BufferGeometry();
    this.webGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.webGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    this.webMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true });
    const web = new THREE.LineSegments(this.webGeo, this.webMat);
    web.frustumCulled = false;
    this.threeScene.add(web);

    // ---- Dew drops -------------------------------------------------------------
    this.dropRest = new Float32Array(dropPos);
    this.dropSwayW = new Float32Array(dropSway);
    this.dropPhase = new Float32Array(dropPh);
    this.dropGeo = new THREE.BufferGeometry();
    this.dropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dropPos), 3));
    this.dropGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dropPos.length), 3));
    this.dropMat = new THREE.PointsMaterial({
      size: 0.46, vertexColors: true, transparent: true,
      map: this.bokehTex, alphaTest: 0.02,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const drops = new THREE.Points(this.dropGeo, this.dropMat);
    drops.frustumCulled = false;
    this.threeScene.add(drops);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);
    // sun crest: climbs from t≈7, peaks ~14, eases off — the warm event
    const crest = smooth((lt - 7) / 7) * (1 - 0.35 * smooth((lt - 15) / 4));
    const sunA = lt * 0.35 + 1.1; // virtual sun azimuth sweep

    // Web strands: closed-form sway — pendular breathing about rest.
    const pAttr = this.webGeo.getAttribute('position') as THREE.BufferAttribute;
    const cAttr = this.webGeo.getAttribute('color') as THREE.BufferAttribute;
    const nv = this.swayW.length;
    for (let i = 0; i < nv; i++) {
      const w = this.swayW[i];
      const bx = this.rest[i * 3], by = this.rest[i * 3 + 1];
      const sway = Math.sin(lt * 0.55 + this.swayP[i]) * 0.055 * w
        + Math.sin(lt * 0.21 + bx * 0.4) * 0.03 * w;
      pAttr.setXYZ(i, bx + sway * 0.7, by + sway * 0.4 - w * 0.008 * Math.sin(lt * 0.8), 0);
      // brightness: steady base + travelling specular glint on strand vertices
      const gl = Math.pow(Math.max(0, Math.sin(sunA * 1.9 + this.glintP[i])), 50);
      const warm = gl * crest * 0.5;
      const b = this.baseA[i] * (0.75 + 0.25 * Math.sin(lt * 0.4 + i)) + gl * 0.75;
      cAttr.setXYZ(i,
        BONE.r * b + WARM.r * warm,
        BONE.g * b + WARM.g * warm,
        BONE.b * b + WARM.b * warm);
    }
    pAttr.needsUpdate = true;
    cAttr.needsUpdate = true;

    // Dew drops: fake refraction — sample the analytic bokeh field at a
    // position displaced toward the sun, then add a specular glint spike.
    const dp = this.dropGeo.getAttribute('position') as THREE.BufferAttribute;
    const dc = this.dropGeo.getAttribute('color') as THREE.BufferAttribute;
    const nd = this.dropPhase.length;
    const sunX = Math.cos(sunA), sunY = Math.sin(sunA) * 0.6 + 0.8;
    for (let i = 0; i < nd; i++) {
      const bx = this.dropRest[i * 3], by = this.dropRest[i * 3 + 1];
      const w = this.dropSwayW[i];
      const sway = Math.sin(lt * 0.55 + this.dropPhase[i]) * 0.055 * w;
      const px = bx + sway * 0.7, py = by + sway * 0.4;
      dp.setXYZ(i, px, py, 0.12);
      // lensed background: inverted + displaced sample, brighter core
      const c = bgTint(px - sunX * 0.55, py - sunY * 0.5, lt, this._c);
      const spec = Math.pow(Math.max(0, Math.sin(sunA * 2.3 + this.dropPhase[i])), 34);
      const lens = 0.55 + 0.35 * Math.sin(this.dropPhase[i] * 3.1);
      const warm = spec * crest;
      dc.setXYZ(i,
        c.r * 1.6 * lens + BONE.r * (0.25 + spec * 1.1) + WARM.r * warm * 0.8,
        c.g * 1.6 * lens + BONE.g * (0.25 + spec * 1.1) + WARM.g * warm * 0.8,
        c.b * 1.6 * lens + BONE.b * (0.25 + spec * 1.1) + WARM.b * warm * 0.8);
    }
    dp.needsUpdate = true;
    dc.needsUpdate = true;

    // Bokeh rack: sprite scale/opacity breathe with the defocus plane.
    const focus = 0.5 + 0.5 * Math.sin(lt * 0.32);
    for (let i = 0; i < BOKEH_N; i++) {
      const bb = this.bokehBase[i];
      const s = bb.s * (0.85 + 0.4 * focus + 0.06 * Math.sin(lt * 0.5 + i * 2.2));
      this.bokehSprites[i].scale.set(s, s, 1);
      this.bokehSprites[i].position.x = bb.x + Math.sin(lt * 0.05 + i * 1.3) * 0.4;
      this.bokehSprites[i].position.y = bb.y + Math.cos(lt * 0.04 + i * 1.7) * 0.25;
      this.bokehMats[i].opacity = 0.13 + 0.11 * (1 - focus) + 0.04 * Math.sin(lt * 0.3 + i * 1.9);
    }
    this.crestMat.opacity = 0.3 * crest;

    // Macro camera: tiny lateral drift + slow push-in, kept on the hub.
    const halfHfov = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const dist = Math.max(11.5, 6.2 / Math.tan(halfHfov) / 0.98) * (1.04 - 0.05 * u);
    this.camera.position.set(
      -0.7 + Math.sin(lt * 0.07) * 0.45,
      0.4 + Math.sin(lt * 0.05 + 1.1) * 0.28,
      dist);
    this.camera.lookAt(-0.6, 0.35, 0);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(VOID, 1);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.5,
      bloomThreshold: 0.4,
      vignette: 0.42,
      grain: 0.014,
      exposure: 1.0,
    };
  }

  override dispose(): void {
    this.webGeo.dispose();
    this.webMat.dispose();
    this.dropGeo.dispose();
    this.dropMat.dispose();
    this.bokehTex.dispose();
    for (const m of this.bokehMats) m.dispose();
    this.crestMat.dispose();
  }
}

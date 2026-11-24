// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// moorise — a huge moon climbing over a dark, calm sea.
//
// Closed-form throughout:
//   alt(t)    — moon altitude fraction 0→1 (smoothstep over the take)
//   squash    — vertical squash of the disc, strong near the horizon
//   warm      — orange→bone colour ramp, driven by altitude
//   streaks   — reflection column on the water: deterministic per-streak
//               horizontal jitter, widening as the moon clears the horizon
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20;
const N_STARS = 220;
const N_STREAKS = 110;
const RIDGE_PTS = 64;

const WARM = new THREE.Color('#e8905a');
const BONE = new THREE.Color('#dbe4f0');
const SEA_LO = new THREE.Color('#04070c');

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export default class MooriseScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private moonMesh: THREE.Mesh;
  private moonMat: THREE.MeshBasicMaterial;
  private haloMesh: THREE.Sprite;
  private haloMat: THREE.SpriteMaterial;
  private haloTex: THREE.CanvasTexture;
  private streakGeo: THREE.BufferGeometry;
  private streakMat: THREE.LineBasicMaterial;
  private starGeo: THREE.BufferGeometry;
  private starMat: THREE.PointsMaterial;
  private ridgeGeo: THREE.BufferGeometry;
  private ridgeMat: THREE.LineBasicMaterial;
  private seaGeo: THREE.PlaneGeometry;
  private seaMat: THREE.MeshBasicMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 500);

    // Sea: near-black gradient plane filling the lower frame.
    this.seaGeo = new THREE.PlaneGeometry(160, 60, 1, 24);
    const sp = this.seaGeo.getAttribute('position') as THREE.BufferAttribute;
    const scol = new Float32Array(sp.count * 3);
    for (let k = 0; k < sp.count; k++) {
      const y = sp.getY(k); // -30..30; horizon sits at local y=30
      const w = Math.pow(Math.max(0, (y + 30) / 60), 1.6);
      const c = SEA_LO.clone().multiplyScalar(0.25 + 0.75 * w);
      scol[k * 3 + 0] = c.r; scol[k * 3 + 1] = c.g; scol[k * 3 + 2] = c.b;
    }
    this.seaGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    this.seaMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const sea = new THREE.Mesh(this.seaGeo, this.seaMat);
    sea.position.set(0, -30, -8); // top edge at y=0 = waterline
    this.threeScene.add(sea);

    // Ridgeline silhouette at the waterline.
    const rpos = new Float32Array(RIDGE_PTS * 3);
    for (let i = 0; i < RIDGE_PTS; i++) {
      const x = -40 + (80 * i) / (RIDGE_PTS - 1);
      rpos[i * 3 + 0] = x;
      rpos[i * 3 + 1] = 0.12 + 0.55 * Math.abs(hash(i, 3) - 0.35) + 0.18 * Math.sin(i * 0.55);
      rpos[i * 3 + 2] = -9;
    }
    this.ridgeGeo = new THREE.BufferGeometry();
    this.ridgeGeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    this.ridgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#0a0e14') });
    const ridge = new THREE.Line(this.ridgeGeo, this.ridgeMat);
    this.threeScene.add(ridge);

    // Stars — deterministic placement, dimmer low and to the sides.
    const stpos = new Float32Array(N_STARS * 3);
    const stcol = new Float32Array(N_STARS * 3);
    for (let i = 0; i < N_STARS; i++) {
      const x = -55 + 110 * hash(i, 11);
      const y = 1.5 + 14 * hash(i, 13);
      stpos[i * 3 + 0] = x; stpos[i * 3 + 1] = y; stpos[i * 3 + 2] = -10;
      const w = (0.25 + 0.75 * hash(i, 17)) * (0.4 + 0.6 * (y / 15));
      stcol[i * 3 + 0] = 0.9 * w; stcol[i * 3 + 1] = 0.93 * w; stcol[i * 3 + 2] = w;
    }
    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(stpos, 3));
    this.starGeo.setAttribute('color', new THREE.BufferAttribute(stcol, 3));
    this.starMat = new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const stars = new THREE.Points(this.starGeo, this.starMat);
    stars.frustumCulled = false;
    this.threeScene.add(stars);

    // Moon disc + halo.
    this.moonMat = new THREE.MeshBasicMaterial({ color: BONE.clone() });
    this.moonMesh = new THREE.Mesh(new THREE.CircleGeometry(2.6, 72), this.moonMat);
    this.moonMesh.position.set(2.5, 0.9, -9.5); // behind the sea plane: waterline clips the disc
    this.threeScene.add(this.moonMesh);
    // Halo: radial-gradient sprite — soft falloff, no hard ring edge.
    const hc = document.createElement('canvas');
    hc.width = hc.height = 256;
    const g2d = hc.getContext('2d')!;
    const grad = g2d.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.30)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.12)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.03)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2d.fillStyle = grad;
    g2d.fillRect(0, 0, 256, 256);
    this.haloTex = new THREE.CanvasTexture(hc);
    this.haloMat = new THREE.SpriteMaterial({
      map: this.haloTex, color: BONE.clone(), transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.haloMesh = new THREE.Sprite(this.haloMat);
    this.haloMesh.scale.set(9, 9, 1);
    this.haloMesh.position.set(2.5, 0.9, -9.55);
    this.threeScene.add(this.haloMesh);

    // Reflection streak column on the water.
    const sg = new Float32Array(N_STREAKS * 2 * 3);
    const sc = new Float32Array(N_STREAKS * 2 * 3);
    this.streakGeo = new THREE.BufferGeometry();
    this.streakGeo.setAttribute('position', new THREE.BufferAttribute(sg, 3));
    this.streakGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const streaks = new THREE.LineSegments(this.streakGeo, this.streakMat);
    streaks.frustumCulled = false;
    this.threeScene.add(streaks);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);
    const alt = smooth(Math.min(lt / 17, 1));         // climbs early, settles
    const warm = 1 - smooth(Math.min(lt / 15, 1));    // cools as it clears horizon

    // Moon: y 0.9→5.8, squash relaxes 0.72→1, colour warm→bone.
    const moonY = 0.9 + 4.9 * alt;
    const squash = 1 - 0.28 * (1 - alt);
    this.moonMesh.position.y = moonY;
    this.moonMesh.scale.set(1, squash, 1);
    const mc = WARM.clone().lerp(BONE, 1 - warm);
    this.moonMat.color.copy(mc);
    this.haloMesh.position.y = moonY;
    this.haloMesh.scale.set(9, 9 * squash, 1);
    this.haloMat.color.copy(mc.clone().multiplyScalar(0.6));
    this.haloMat.opacity = 0.3 * Math.max(0, 1 - alt * 2.2); // halo dies as the moon climbs

    // Reflection column: streaks under the moon, widening as it rises.
    const sp = this.streakGeo.getAttribute('position') as THREE.BufferAttribute;
    const sc2 = this.streakGeo.getAttribute('color') as THREE.BufferAttribute;
    const colHalf = 1.6 + 3.4 * alt;                  // widens as moon clears
    const shimmer = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(lt * 2.1));
    for (let i = 0; i < N_STREAKS; i++) {
      const off = (hash(i, 23) - 0.5) * 2 * colHalf;
      const jx = 0.22 * Math.sin(lt * (1.3 + hash(i, 29)) + hash(i, 31) * 6.28);
      const x = 2.5 + off + jx;
      const y0 = -0.1 - hash(i, 37) * 0.6;
      const len = (0.5 + 2.6 * hash(i, 41)) * (0.55 + 0.45 * alt);
      const center = 1 - Math.min(1, Math.abs(off) / colHalf);
      const w = (0.10 + 0.5 * center) * shimmer * (0.35 + 0.65 * alt);
      const c = WARM.clone().lerp(BONE, 1 - warm * center).multiplyScalar(w);
      sp.setXYZ(i * 2, x, y0, -6);
      sp.setXYZ(i * 2 + 1, x + jx * 0.3, y0 - len, -6);
      sc2.setXYZ(i * 2, c.r, c.g, c.b);
      sc2.setXYZ(i * 2 + 1, c.r * 0.15, c.g * 0.15, c.b * 0.15);
    }
    sp.needsUpdate = true;
    sc2.needsUpdate = true;

    // Slow push-in; gaze rises to track the climbing moon.
    const dist = 26 * (1.06 - 0.10 * u);
    this.camera.position.set(Math.sin(lt * 0.04) * 0.6, 2.6 - 0.5 * alt, dist);
    this.camera.lookAt(1.8, 1.6 + 1.2 * alt, -9);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.42,
      bloomThreshold: 0.5,
      vignette: 0.3,
      grain: 0.01,
      exposure: 1.0,
    };
  }

  override dispose(): void {
    this.moonMesh.geometry.dispose();
    this.moonMat.dispose();
    this.haloMat.dispose();
    this.haloTex.dispose();
    this.streakGeo.dispose();
    this.streakMat.dispose();
    this.starGeo.dispose();
    this.starMat.dispose();
    this.ridgeGeo.dispose();
    this.ridgeMat.dispose();
    this.seaGeo.dispose();
    this.seaMat.dispose();
  }
}

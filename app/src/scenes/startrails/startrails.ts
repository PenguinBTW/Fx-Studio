// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
//
// startrails — a night landscape silhouette under a spinning sky. Hundreds of
// stars arc around the north celestial pole; each trail is a closed-form arc
// segment whose angular span is w*t, so the exposure "accumulates" over the
// take (tight circles near the pole, long streaks far out). One star is a
// red giant — the single warm colour event. The ridge + standing stone are
// a static dark layer and a cool horizon glow dies as the trails lengthen.
// Star placement is hash-of-index; every position is f(t) — no Math.random.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20.0;
const N_STARS = 380;
const TRAIL_K = 40;         // polyline samples per trail
const OMEGA = 0.055;        // rad/s — sidereal rate, 63° of arc at t=20
const POLE = new THREE.Vector2(-8, 6); // Polaris, upper-left of frame
const BONE = new THREE.Color(0.84, 0.83, 0.76);
const WARM = new THREE.Color(0.95, 0.52, 0.26);   // the red giant
const COOL = new THREE.Color(0.30, 0.38, 0.52);   // horizon glow
const GIANT = 7;            // star index that carries the warm arc

/** Deterministic hash-of-index in [0,1) — no PRNG state, seek-safe. */
function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

interface StarDef {
  r: number;       // angular distance from the pole
  phi: number;     // start angle at t=0
  bright: number;
  col: THREE.Color;
}

function starDef(i: number): StarDef {
  // sqrt distribution → uniform sky density; every 37th star hugs the pole.
  const r = i % 37 === 0 ? 0.15 + 0.7 * hash(i, 3) : 0.3 + 21 * Math.sqrt(hash(i, 1));
  const phi = hash(i, 2) * Math.PI * 2;
  // Tight arcs near the pole concentrate flux → read brighter.
  const bright = Math.min(1.5, (0.5 + 1.6 / (1 + r)) * (0.45 + 0.55 * hash(i, 4)));
  const col = i === GIANT ? WARM.clone() : BONE.clone();
  // Subtle temperature variation so the field isn't monochrome.
  if (i !== GIANT) col.multiplyScalar(0.9 + 0.2 * hash(i, 5));
  return { r, phi, bright, col };
}

export default class StarTrailsScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private stars: StarDef[] = [];
  private trailLines: THREE.Line[] = [];
  private trailGeos: THREE.BufferGeometry[] = [];
  private trailMats: THREE.LineBasicMaterial[] = [];
  private headGeo: THREE.BufferGeometry;
  private headPoints: THREE.Points;
  private headMat: THREE.PointsMaterial;
  private glowGeo: THREE.PlaneGeometry;
  private glowMat: THREE.MeshBasicMaterial;
  private groundGeo: THREE.ShapeGeometry;
  private stoneGeo: THREE.ShapeGeometry;
  private groundMat: THREE.MeshBasicMaterial;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    // --- Star trails + bright heads -------------------------------------
    const headPos = new Float32Array(N_STARS * 3);
    const headCol = new Float32Array(N_STARS * 3);
    for (let i = 0; i < N_STARS; i++) {
      const s = starDef(i);
      this.stars.push(s);

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_K * 3), 3));
      const cols = new Float32Array(TRAIL_K * 3);
      for (let k = 0; k < TRAIL_K; k++) {
        const fade = Math.pow(1 - k / (TRAIL_K - 1), 1.7) * 0.55 * s.bright;
        cols[k * 3 + 0] = s.col.r * fade;
        cols[k * 3 + 1] = s.col.g * fade;
        cols[k * 3 + 2] = s.col.b * fade;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(g, mat);
      line.frustumCulled = false; // arcs grow every frame; cached bounds go stale
      this.threeScene.add(line);
      this.trailLines.push(line);
      this.trailGeos.push(g);
      this.trailMats.push(mat);

      headCol[i * 3 + 0] = s.col.r * s.bright;
      headCol[i * 3 + 1] = s.col.g * s.bright;
      headCol[i * 3 + 2] = s.col.b * s.bright;
    }
    this.headGeo = new THREE.BufferGeometry();
    this.headGeo.setAttribute('position', new THREE.BufferAttribute(headPos, 3));
    this.headGeo.setAttribute('color', new THREE.BufferAttribute(headCol, 3));
    this.headMat = new THREE.PointsMaterial({
      size: 0.13,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.headPoints = new THREE.Points(this.headGeo, this.headMat);
    this.headPoints.frustumCulled = false;
    this.threeScene.add(this.headPoints);

    // --- Cool horizon glow (additive gradient, fades as trails lengthen) --
    this.glowGeo = new THREE.PlaneGeometry(150, 26, 1, 10);
    const gp = this.glowGeo.getAttribute('position') as THREE.BufferAttribute;
    const gc = new Float32Array(gp.count * 3);
    for (let v = 0; v < gp.count; v++) {
      const hgt = (gp.getY(v) + 13) / 26; // 0 bottom → 1 top
      const wgt = Math.pow(1 - hgt, 2.2);
      gc[v * 3 + 0] = COOL.r * wgt;
      gc[v * 3 + 1] = COOL.g * wgt;
      gc[v * 3 + 2] = COOL.b * wgt;
    }
    this.glowGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    this.glowMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(this.glowGeo, this.glowMat);
    glow.position.set(0, -4, -0.5);
    this.threeScene.add(glow);

    // --- Landscape silhouette: jagged ridgeline + lone standing stone -----
    this.groundMat = new THREE.MeshBasicMaterial({ color: 0x03040a });
    const ridge = new THREE.Shape();
    ridge.moveTo(-150, -40);
    for (let x = -150; x <= 150; x += 5) {
      const jag = (hash(x + 400, 9) - 0.5) * 3.2;
      const roll = Math.sin(x * 0.045) * 1.1;
      ridge.lineTo(x, -8.5 + jag + roll);
    }
    ridge.lineTo(150, -40);
    ridge.closePath();
    this.groundGeo = new THREE.ShapeGeometry(ridge);
    const ground = new THREE.Mesh(this.groundGeo, this.groundMat);
    ground.position.z = 0.2;
    this.threeScene.add(ground);

    // Standing stone on the ridge — a tapered, slightly leaning monolith.
    const stone = new THREE.Shape();
    stone.moveTo(13.9, -8.6);
    stone.lineTo(14.6, -1.8);
    stone.lineTo(15.9, -0.6);
    stone.lineTo(16.8, -1.4);
    stone.lineTo(17.6, -8.6);
    stone.closePath();
    this.stoneGeo = new THREE.ShapeGeometry(stone);
    const stoneMesh = new THREE.Mesh(this.stoneGeo, this.groundMat);
    stoneMesh.position.z = 0.25;
    this.threeScene.add(stoneMesh);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;

    // Very slow push-in around a near-static framing; pole sits upper-left.
    const u = Math.min(lt / TAKE, 1);
    // Framing: pole at (-8,6) with arcs to r=21 → need y∈[-15.5,27.5],
    // x∈[-29.5,13.5] plus margin and the lookAt offset.
    const needH = Math.max(27.5 - 4.5, 4.5 - -15.5) + 1.5; // ~24
    const needW = Math.max(13.5 - -4, -4 - -29.5) + 1.5;   // ~27
    const halfHfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const base = Math.max(needH / Math.tan(halfHfov), needW / (Math.tan(halfHfov) * this.camera.aspect));
    const dist = base * (1.04 - 0.15 * u); // slow push-in
    this.camera.position.set(-4 + Math.sin(lt * 0.09) * 0.9, 4.5, dist);
    this.camera.lookAt(-4, 4.5, 0);
    const far = Math.max(300, dist + 60);
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    // Trails: point k sits at angle phi + omega*(t - k*step), so the polyline
    // covers every position the star occupied since t=0 — a growing exposure.
    const step = Math.min(lt, TAKE) / (TRAIL_K - 1);
    const hp = this.headGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < N_STARS; i++) {
      const s = this.stars[i]!;
      const tp = this.trailGeos[i]!.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < TRAIL_K; k++) {
        const a = s.phi + OMEGA * (lt - k * step);
        const x = POLE.x + s.r * Math.cos(a);
        const y = POLE.y + s.r * Math.sin(a);
        tp.setXYZ(k, x, y, 0);
        if (k === 0) hp.setXYZ(i, x, y, 0);
      }
      tp.needsUpdate = true;
    }
    hp.needsUpdate = true;

    // Horizon glow dies as the trails lengthen.
    this.glowMat.opacity = 0.05 + 0.19 * Math.exp(-lt / 12);

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.34,
      bloomThreshold: 0.5,
      vignette: 0.34,
      grain: 0.014,
      exposure: 1.05,
    };
  }

  override dispose(): void {
    for (let i = 0; i < N_STARS; i++) {
      this.trailGeos[i]!.dispose();
      this.trailMats[i]!.dispose();
    }
    this.headGeo.dispose();
    this.headMat.dispose();
    this.glowGeo.dispose();
    this.glowMat.dispose();
    this.groundGeo.dispose();
    this.stoneGeo.dispose();
    this.groundMat.dispose();
  }
}

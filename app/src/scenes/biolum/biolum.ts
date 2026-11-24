// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// biolum — bioluminescent plankton on a night shore, ~20s.
//
// Closed-form throughout, no integration, no Math.random:
//   Crest i is a phase front: pos_i(t) = spawnY_i - v_i·(t - t0_i). Its flash
//   fires when pos crosses the break line; intensity = amp·exp(-(t-tc)/τ).
//   After the break the same line becomes the receding foam trail:
//   foamY_i(t) = breakY - ws·(t - tc_i), opacity ∝ exp(-(t-tc)/τf).
//   Plankton motes are hash-seeded points that only glow inside an active
//   crest band or a trailing wash zone — glow = analytic envelope of
//   distance-to-crest × t, recomputed from scratch every frame.
//   Wet-sand motes hold residual twinkles for the calm spell.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20;
const HORIZON = 2.4;      // y of the horizon line
const BREAK_Y = -0.55;    // y where crests break (shore edge)
const SPAWN_Y = HORIZON - 0.25;

const VOID = new THREE.Color('#020409');
const SKY = new THREE.Color('#04060d');
const SEA = new THREE.Color('#03070c');
const SAND = new THREE.Color('#06070b');
const CYAN = new THREE.Color('#3fd9ff');
const CYAN_DEEP = new THREE.Color('#0e3a4d');
const BONE = new THREE.Color('#dfe9f2');
const WARM = new THREE.Color('#e0a95e');

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ── Crest schedule: spawn far, travel shoreward (down the frame), break at
// BREAK_Y. tc = t0 + (SPAWN_Y - BREAK_Y)/v is when each flash fires.
//   t≈2.2 small breaker → t≈7.7/8.5/9.3 big set → t≈14 trailing wash →
//   t≥16 calm with residual twinkles.
interface Crest { t0: number; v: number; amp: number; tc: number; w: number; phase: number; ws: number }
const CRESTS: Crest[] = [
  { t0: 0.5,  v: 1.5,  amp: 0.55, tc: 0, w: 0.34, phase: hash(1, 7) * 6.28,  ws: 0.42 },
  { t0: 4.2,  v: 0.79, amp: 1.0,  tc: 0, w: 0.5,  phase: hash(2, 7) * 6.28,  ws: 0.3 },
  { t0: 4.9,  v: 0.79, amp: 0.85, tc: 0, w: 0.46, phase: hash(3, 7) * 6.28,  ws: 0.32 },
  { t0: 5.6,  v: 0.79, amp: 0.7,  tc: 0, w: 0.4,  phase: hash(4, 7) * 6.28,  ws: 0.35 },
  { t0: 9.6,  v: 0.62, amp: 0.55, tc: 0, w: 0.36, phase: hash(5, 7) * 6.28,  ws: 0.4 },
  { t0: 11.5, v: 0.55, amp: 0.38, tc: 0, w: 0.3,  phase: hash(6, 7) * 6.28,  ws: 0.45 },
];
for (const c of CRESTS) c.tc = c.t0 + (SPAWN_Y - BREAK_Y) / c.v;

// Closed-form per-crest state at time t.
function crestY(c: Crest, t: number): number {
  return SPAWN_Y - c.v * Math.max(0, t - c.t0);
}
// Intensity of the glowing crest line: dim en route, flash at break, gone
// shortly after (the foam mesh takes over).
function crestGlow(c: Crest, t: number): number {
  const tau = t - c.tc;
  if (t < c.t0) return 0;
  if (tau >= 0) return c.amp * Math.exp(-tau / 1.1);
  return c.amp * 0.22 * Math.exp(-((tau / 0.9) ** 2)) + 0.05;
}
// Foam trail: after the break the streak drains back seaward (toward the
// horizon, increasing y), parking just inside the spawn band while it fades —
// it must never cross into the sky.
function foamY(c: Crest, t: number): number {
  return Math.min(SPAWN_Y - 0.35, BREAK_Y + c.ws * Math.max(0, t - c.tc));
}
function foamGlow(c: Crest, t: number): number {
  const tau = t - c.tc;
  return tau >= 0 ? c.amp * 0.6 * Math.exp(-tau / 4.5) : 0;
}

export default class BiolumScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private glowTex: THREE.CanvasTexture;
  private motesGeo: THREE.BufferGeometry;
  private moteX: Float32Array;
  private moteY: Float32Array;
  private moteSeed: Float32Array;
  private moteSand: Uint8Array;
  private crestGeos: THREE.BufferGeometry[] = [];
  private crestMats: THREE.LineBasicMaterial[] = [];
  private foamGeos: THREE.BufferGeometry[] = [];
  private foamMats: THREE.LineBasicMaterial[] = [];
  private ownedGeos: THREE.BufferGeometry[] = [];
  private ownedMats: THREE.Material[] = [];
  private starsGeo: THREE.BufferGeometry;
  private moonMat: THREE.SpriteMaterial;
  private streakMat: THREE.SpriteMaterial;
  private _c = new THREE.Color();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, ctx.W / ctx.H, 0.1, 500);

    // ---- Soft radial texture for moon glint / glow sprites -----------------
    const bc = document.createElement('canvas');
    bc.width = bc.height = 128;
    const b2d = bc.getContext('2d')!;
    const bg = b2d.createRadialGradient(64, 64, 0, 64, 64, 64);
    bg.addColorStop(0, 'rgba(255,255,255,0.85)');
    bg.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    b2d.fillStyle = bg;
    b2d.fillRect(0, 0, 128, 128);
    this.glowTex = new THREE.CanvasTexture(bc);

    // ---- Backdrop: sky / sea / sand as three near-black planes -------------
    // Tall spans keep the backdrop covering the frame at any aspect; the sand
    // edge sits below BREAK_Y so every crest flash lands on the sea, not the
    // beach.
    const quad = (y0: number, y1: number, color: THREE.Color, z: number) => {
      const g = new THREE.PlaneGeometry(40, y1 - y0);
      const m = new THREE.MeshBasicMaterial({ color });
      const q = new THREE.Mesh(g, m);
      q.position.set(0, (y0 + y1) / 2, z);
      this.threeScene.add(q);
      this.ownedGeos.push(g);
      this.ownedMats.push(m);
    };
    quad(HORIZON, 30, SKY, -12);
    quad(BREAK_Y - 0.4, HORIZON, SEA, -11);
    quad(-30, BREAK_Y - 0.3, SAND, -10);

    // ---- Warm accent: low moon + its thin glint column on the water --------
    this.moonMat = new THREE.SpriteMaterial({
      map: this.glowTex, transparent: true, depthWrite: false,
      color: WARM.clone(), opacity: 0.85,
    });
    const moon = new THREE.Sprite(this.moonMat);
    moon.scale.set(0.85, 0.85, 1);
    moon.position.set(6.4, HORIZON + 0.55, -9);
    this.threeScene.add(moon);

    this.streakMat = new THREE.SpriteMaterial({
      map: this.glowTex, transparent: true, depthWrite: false,
      color: WARM.clone(), opacity: 0.1,
    });
    const streak = new THREE.Sprite(this.streakMat);
    streak.scale.set(0.5, 2.4, 1);
    streak.position.set(6.4, HORIZON - 1.3, -9);
    this.threeScene.add(streak);

    // ---- Sparse stars -------------------------------------------------------
    const sp: number[] = [];
    const sc: number[] = [];
    for (let i = 0; i < 110; i++) {
      const x = -14 + 28 * hash(i, 101);
      const y = HORIZON + 0.6 + 7 * hash(i, 103);
      const b = 0.06 + 0.3 * hash(i, 107);
      sp.push(x, y, -11.5);
      sc.push(BONE.r * b, BONE.g * b, BONE.b * b);
    }
    this.starsGeo = new THREE.BufferGeometry();
    this.starsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sp), 3));
    this.starsGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(sc), 3));
    const starsMat = new THREE.PointsMaterial({
      size: 0.05, vertexColors: true, transparent: true, depthWrite: false,
    });
    const stars = new THREE.Points(this.starsGeo, starsMat);
    this.ownedMats.push(starsMat);
    stars.frustumCulled = false;
    this.threeScene.add(stars);

    // ---- Crest lines: wavy fronts spanning the frame -----------------------
    const LINE_N = 90;
    for (let ci = 0; ci < CRESTS.length; ci++) {
      const pos = new Float32Array(LINE_N * 3);
      const col = new Float32Array(LINE_N * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // Additive: a zero-glow line adds black = invisible, so inactive fronts
      // never draw dark streaks or occlude the additive motes behind them.
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.threeScene.add(line);
      this.crestGeos.push(geo);
      this.crestMats.push(mat);

      // Receding foam streak — same span, drawn once the crest breaks.
      const fpos = new Float32Array(LINE_N * 3);
      const fcol = new Float32Array(LINE_N * 3);
      const fgeo = new THREE.BufferGeometry();
      fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
      fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
      const fmat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const foam = new THREE.Line(fgeo, fmat);
      foam.frustumCulled = false;
      this.threeScene.add(foam);
      this.foamGeos.push(fgeo);
      this.foamMats.push(fmat);
    }

    // ---- Plankton motes -----------------------------------------------------
    // Sea motes (crest/wash glow) + wet-sand motes (residual twinkles).
    const SEA_N = 2400, SAND_N = 700, N = SEA_N + SAND_N;
    this.moteX = new Float32Array(N);
    this.moteY = new Float32Array(N);
    this.moteSeed = new Float32Array(N);
    this.moteSand = new Uint8Array(N);
    const mp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const sand = i >= SEA_N;
      this.moteSand[i] = sand ? 1 : 0;
      this.moteX[i] = -11 + 22 * hash(i, 211);
      this.moteY[i] = sand
        ? -4.2 + 3.3 * hash(i, 213)                      // wet sand band (below the sand edge at -0.85)
        : BREAK_Y - 0.05 + (SPAWN_Y - BREAK_Y + 0.15) * hash(i, 213);
      this.moteSeed[i] = hash(i, 217);
      mp[i * 3] = this.moteX[i];
      mp[i * 3 + 1] = this.moteY[i];
      mp[i * 3 + 2] = 0;
    }
    this.motesGeo = new THREE.BufferGeometry();
    this.motesGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.motesGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const motesMat = new THREE.PointsMaterial({
      size: 0.15, vertexColors: true, transparent: true,
      map: this.glowTex, alphaTest: 0.02,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const motes = new THREE.Points(this.motesGeo, motesMat);
    this.ownedMats.push(motesMat);
    motes.frustumCulled = false;
    this.threeScene.add(motes);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);

    // Precompute per-crest state for this frame (all closed-form).
    const cg = CRESTS.map((c) => crestGlow(c, lt));
    const cy = CRESTS.map((c) => crestY(c, lt));
    const fg = CRESTS.map((c) => foamGlow(c, lt));
    const fy = CRESTS.map((c) => foamY(c, lt));

    // ---- Crest + foam lines -------------------------------------------------
    const LINE_N = 90;
    for (let ci = 0; ci < CRESTS.length; ci++) {
      const c = CRESTS[ci]!;
      const g = cg[ci]!;
      const y = cy[ci]!;
      const pAttr = this.crestGeos[ci]!.getAttribute('position') as THREE.BufferAttribute;
      const cAttr = this.crestGeos[ci]!.getAttribute('color') as THREE.BufferAttribute;
      for (let s = 0; s < LINE_N; s++) {
        const x = -11 + (22 * s) / (LINE_N - 1);
        // gentle front curvature + drift, phase-locked per crest
        const wob = 0.1 * Math.sin(x * 0.9 + c.phase) + 0.05 * Math.sin(x * 2.3 + lt * 0.4 + c.phase);
        pAttr.setXYZ(s, x, y + wob, 0);
        // crest brightest near its middle section
        const edge = Math.sin((Math.PI * s) / (LINE_N - 1));
        const b = g * (0.35 + 0.65 * edge);
        cAttr.setXYZ(s, CYAN.r * b * 0.9 + BONE.r * b * 0.35,
          CYAN.g * b * 0.9 + BONE.g * b * 0.35,
          CYAN.b * b + BONE.b * b * 0.35);
      }
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;

      const fgi = fg[ci]!;
      const fyi = fy[ci]!;
      const fpAttr = this.foamGeos[ci]!.getAttribute('position') as THREE.BufferAttribute;
      const fcAttr = this.foamGeos[ci]!.getAttribute('color') as THREE.BufferAttribute;
      for (let s = 0; s < LINE_N; s++) {
        const x = -11 + (22 * s) / (LINE_N - 1);
        // foam disperses as it recedes: wobble grows with time since break
        const spread = 1 + Math.max(0, lt - c.tc) * 0.35;
        const wob = spread * (0.12 * Math.sin(x * 0.7 + c.phase * 2) + 0.06 * Math.sin(x * 1.9 + lt * 0.25));
        fpAttr.setXYZ(s, x, fyi + wob, 0);
        const edge = Math.sin((Math.PI * s) / (LINE_N - 1));
        const b = fgi * (0.25 + 0.75 * edge);
        fcAttr.setXYZ(s, CYAN.r * b * 0.5 + BONE.r * b * 0.5,
          CYAN.g * b * 0.6 + BONE.g * b * 0.5,
          CYAN.b * b * 0.7 + BONE.b * b * 0.5);
      }
      fpAttr.needsUpdate = true;
      fcAttr.needsUpdate = true;
    }

    // ---- Motes: analytic glow envelope over distance-to-crest × t ----------
    const mc = this.motesGeo.getAttribute('color') as THREE.BufferAttribute;
    const N = this.moteX.length;
    for (let i = 0; i < N; i++) {
      const my = this.moteY[i]!;
      const seed = this.moteSeed[i]!;
      let glow = 0;
      if (this.moteSand[i]) {
        // residual twinkles in the wet sand — strongest in the calm spell
        const calm = 0.25 + 0.75 * Math.exp(-(((lt - 18) / 5) * ((lt - 18) / 5)));
        glow = Math.pow(Math.max(0, Math.sin(lt * (0.8 + seed * 1.7) + seed * 40)), 8) * 0.9 * calm;
      }
      for (let ci = 0; ci < CRESTS.length; ci++) {
        const c = CRESTS[ci]!;
        if (!this.moteSand[i]) {
          // inside the active crest band
          const d = Math.abs(my - cy[ci]!);
          if (d < c.w) glow = Math.max(glow, cg[ci]! * Math.exp(-((d / c.w) * (d / c.w))));
        }
        // trailing wash zone — the wave's run-up leaves a fading cyan wash
        // on the wet sand below the break line while the foam drains back
        const tau = lt - c.tc;
        if (tau > 0 && my < BREAK_Y + 0.15 && my > BREAK_Y - 1.4) {
          const edge = clamp01(1 - (BREAK_Y + 0.15 - my) / 1.55);
          glow = Math.max(glow, fg[ci]! * 0.9 * edge);
        }
      }
      // hash-mottle so the field never reads as a uniform wash
      glow *= 0.35 + 0.65 * seed;
      mc.setXYZ(i, CYAN.r * glow * 2.3, CYAN.g * glow * 2.5, CYAN.b * glow * 2.7);
    }
    mc.needsUpdate = true;

    // ---- Moon glint + streak breathe slowly --------------------------------
    this.moonMat.opacity = 0.75 + 0.15 * Math.sin(lt * 0.21);
    this.streakMat.opacity = 0.08 + 0.05 * Math.sin(lt * 0.33 + 1.2);

    // ---- Camera: locked low over the sand, very slight push-in -------------
    const halfHfov = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    const dist = Math.max(15, 11.5 / Math.tan(halfHfov) / 0.98) * (1.03 - 0.04 * u);
    this.camera.position.set(
      Math.sin(lt * 0.06) * 0.3,
      0.9 + Math.sin(lt * 0.045) * 0.15,
      dist);
    this.camera.lookAt(0, -0.4, 0);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(VOID, 1);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.55,
      bloomThreshold: 0.35,
      vignette: 0.5,
      grain: 0.014,
      exposure: 0.95,
    };
  }

  override dispose(): void {
    this.glowTex.dispose();
    this.motesGeo.dispose();
    this.starsGeo.dispose();
    this.moonMat.dispose();
    this.streakMat.dispose();
    for (const g of this.crestGeos) g.dispose();
    for (const m of this.crestMats) m.dispose();
    for (const g of this.foamGeos) g.dispose();
    for (const m of this.foamMats) m.dispose();
    for (const g of this.ownedGeos) g.dispose();
    for (const m of this.ownedMats) m.dispose();
  }
}

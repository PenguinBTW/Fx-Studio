// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// meteorfall — a meteor shower over a dark desert ridge, ~20s.
//
// Closed-form throughout, no integration, no Math.random:
//   Meteor i is an analytic trajectory: head(t) = origin_i + dir_i·v_i·(t-s_i),
//   alive only on [s_i, s_i + d_i]. Brightness is a gaussian window over the
//   path fraction — ignite → white-hot peak → decay. The trail is the same
//   line re-parameterized behind the head with an amber fade.
//   The ridge is an fbm(height) silhouette evaluated once per frame from a
//   sum of hash-based value-noise octaves — deterministic at every t.
//   Reflections mirror only meteors whose envelope crosses a threshold onto
//   the salt-flat strip below the ridge.
//   Star twinkle, earthshine, and the cyan airglow band are all f(t).
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const TAKE = 20;
const HORIZON = -0.9;     // y of the ridge line's mean
const FLAT_Y = -2.2;      // salt-flat strip top
const SKY_TOP = 12;

const VOID = new THREE.Color('#010208');
const RIDGE = new THREE.Color('#05060a');
const FLAT = new THREE.Color('#08090f');
const WHITE = new THREE.Color('#fff6e8');
const AMBER = new THREE.Color('#e8a04c');
const AMBER_DIM = new THREE.Color('#6b4118');
const BONE = new THREE.Color('#dfe9f2');

function hash(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// 1-D value noise (hash lattice + smoothstep) for the ridge fbm.
function vnoise(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i, 53);
  const b = hash(i + 1, 53);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
function ridgeY(x: number): number {
  let h = 0;
  let amp = 1;
  let fr = 0.16;
  for (let o = 0; o < 4; o++) {
    h += amp * vnoise(x * fr + o * 17.3);
    amp *= 0.5;
    fr *= 2.1;
  }
  return HORIZON + h * 1.15 - 0.55;
}

// ── Meteor schedule --------------------------------------------------------
// ~40 streaks: a quiet opener (~t≈2), a swelling mid-shower (~6–15), a late
// thin-out. Two fireballs get oversized envelopes — the big one peaks ≈t14.
interface Meteor {
  s: number;      // ignition time
  d: number;      // duration
  ox: number; oy: number; // origin
  dx: number; dy: number; // unit direction (down-right / down-left)
  v: number;      // speed
  amp: number;    // peak brightness
  len: number;    // trail length in world units
  fire: number;   // 0 normal, 1 fireball
}
const METEORS: Meteor[] = [];
{
  const N = 42;
  for (let i = 0; i < N; i++) {
    // s distribution: sparse early, dense mid, thin late.
    let s: number;
    if (i < 6) s = 0.8 + 5 * hash(i, 601);
    else if (i < 34) s = 6 + 9.5 * hash(i, 601);
    else s = 15.5 + 4 * hash(i, 601);
    const fire = i === 18 || i === 27 ? 1 : 0; // fireballs land mid/late
    const fire2 = i === 38 ? 1 : 0;
    const ox = -9 + 18 * hash(i, 603);
    const oy = 5.5 + 5.5 * hash(i, 605);
    // direction: mostly down-right with spread; a few down-left
    const left = hash(i, 607) < 0.3;
    const a = 0.35 + 0.5 * hash(i, 609);
    const dx = Math.sin(a) * (left ? -1 : 1);
    const dy = -Math.cos(a);
    const v = (3.2 + 3.8 * hash(i, 611)) * (1 + 0.4 * (fire || fire2));
    METEORS.push({
      s: fire2 ? 13.1 : s,
      d: 0.7 + 1.5 * hash(i, 613) + (fire || fire2 ? 0.9 : 0),
      ox, oy, dx, dy,
      v,
      amp: (0.6 + 0.8 * hash(i, 617)) * (fire || fire2 ? 2.4 : 1),
      len: (1.5 + 2.2 * hash(i, 619)) * (fire || fire2 ? 1.7 : 1),
      fire: fire || fire2,
    });
  }
}

// Closed-form per-meteor state at time t.
function meteorPos(m: Meteor, t: number): { x: number; y: number } {
  const tau = Math.max(0, t - m.s);
  return { x: m.ox + m.dx * m.v * tau, y: m.oy + m.dy * m.v * tau };
}
// Gaussian ignition window over the path fraction: fast brighten, long decay.
function meteorGlow(m: Meteor, t: number): number {
  const f = (t - m.s) / m.d;
  if (f <= 0 || f >= 1) return 0;
  // asymmetric: rises sharply to peak at f≈0.3, decays with a soft tail
  const rise = 1 - Math.exp(-f / 0.12);
  const fall = Math.exp(-Math.pow((f - 0.3) / 0.5, 2) * 3.2);
  return m.amp * rise * fall;
}
// Fireball afterglow: lingers after the streak is gone. The (1-exp) ramp-in
// hands the sprite off smoothly instead of popping back to 50% opacity the
// instant the streak dies.
function afterglow(m: Meteor, t: number): number {
  const tau = t - (m.s + m.d);
  return m.fire && tau > 0 ? 0.9 * (1 - Math.exp(-tau / 0.15)) * Math.exp(-tau / 2.2) : 0;
}

const TRAIL = 26; // vertices per streak

export default class MeteorfallScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private glowTex: THREE.CanvasTexture;
  private skyTex!: THREE.CanvasTexture;
  private ridgeGeo: THREE.BufferGeometry;
  private starsGeo: THREE.BufferGeometry;
  private starBase: Float32Array;
  private starSeed: Float32Array;
  private meteorGeos: THREE.BufferGeometry[] = [];
  private meteorMats: THREE.LineBasicMaterial[] = [];
  private headMats: THREE.SpriteMaterial[] = [];
  private headSprites: THREE.Sprite[] = [];
  private reflGeos: THREE.BufferGeometry[] = [];
  private ownedGeos: THREE.BufferGeometry[] = [];
  private ownedMats: THREE.Material[] = [];
  private _c = new THREE.Color();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, ctx.W / ctx.H, 0.1, 500);

    // ---- Soft radial texture for heads / afterglow -------------------------
    const bc = document.createElement('canvas');
    bc.width = bc.height = 128;
    const b2d = bc.getContext('2d')!;
    const bg = b2d.createRadialGradient(64, 64, 0, 64, 64, 64);
    bg.addColorStop(0, 'rgba(255,255,255,0.9)');
    bg.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    b2d.fillStyle = bg;
    b2d.fillRect(0, 0, 128, 128);
    this.glowTex = new THREE.CanvasTexture(bc);

    // ---- Sky gradient (canvas texture, indigo → near-black) ----------------
    const sc = document.createElement('canvas');
    sc.width = 4; sc.height = 256;
    const s2d = sc.getContext('2d')!;
    const sg = s2d.createLinearGradient(0, 0, 0, 256);
    sg.addColorStop(0, '#010209');
    sg.addColorStop(0.45, '#060b21');
    sg.addColorStop(0.75, '#040715');
    sg.addColorStop(1, '#02030a');
    s2d.fillStyle = sg;
    s2d.fillRect(0, 0, 4, 256);
    // Faint cyan airglow band baked into the sky — soft vertical falloff,
    // high in the frame (y≈7.6 → ~31% down from the top of the gradient).
    const ag = s2d.createLinearGradient(0, 60, 0, 110);
    ag.addColorStop(0, 'rgba(47,191,174,0)');
    ag.addColorStop(0.5, 'rgba(47,191,174,0.10)');
    ag.addColorStop(1, 'rgba(47,191,174,0)');
    s2d.fillStyle = ag;
    s2d.fillRect(0, 60, 4, 50);
    // Earthshine: faint warm band hugging the horizon, baked too.
    const es = s2d.createLinearGradient(0, 215, 0, 245);
    es.addColorStop(0, 'rgba(80,64,44,0)');
    es.addColorStop(0.5, 'rgba(80,64,44,0.16)');
    es.addColorStop(1, 'rgba(80,64,44,0)');
    s2d.fillStyle = es;
    s2d.fillRect(0, 215, 4, 30);
    const skyTex = new THREE.CanvasTexture(sc);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyGeo = new THREE.PlaneGeometry(60, SKY_TOP - FLAT_Y);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, (SKY_TOP + FLAT_Y) / 2, -14);
    this.threeScene.add(sky);
    this.ownedGeos.push(skyGeo); this.ownedMats.push(skyMat);
    this.skyTex = skyTex;


    // ---- Desert ridge silhouette (fbm, rebuilt per frame) -------------------
    const R_N = 160;
    const ridgeMat = new THREE.MeshBasicMaterial({ color: RIDGE });
    // Fan strip: top edge = fbm ridge, bottom edge pinned deep.
    const idx: number[] = [];
    for (let i = 0; i < R_N - 1; i++) {
      const a = i, b = i + 1, c = R_N + i, d = R_N + i + 1;
      idx.push(a, c, b, b, c, d);
    }
    const rpos2 = new Float32Array(R_N * 2 * 3);
    const ridgeGeo2 = new THREE.BufferGeometry();
    ridgeGeo2.setAttribute('position', new THREE.BufferAttribute(rpos2, 3));
    ridgeGeo2.setIndex(idx);
    const ridge = new THREE.Mesh(ridgeGeo2, ridgeMat);
    ridge.frustumCulled = false;
    this.threeScene.add(ridge);
    this.ridgeGeo = ridgeGeo2;
    this.ownedMats.push(ridgeMat);

    // ---- Salt flat strip below the ridge ------------------------------------
    const flGeo = new THREE.PlaneGeometry(60, FLAT_Y + 14);
    const flMat = new THREE.MeshBasicMaterial({ color: FLAT });
    const flat = new THREE.Mesh(flGeo, flMat);
    flat.position.set(0, (FLAT_Y - 14) / 2, -10);
    this.threeScene.add(flat);
    this.ownedGeos.push(flGeo); this.ownedMats.push(flMat);

    // ---- Star field: hash-seeded, closed-form twinkle ------------------------
    const SN = 420;
    const sp = new Float32Array(SN * 3);
    this.starBase = new Float32Array(SN);
    this.starSeed = new Float32Array(SN);
    const scol = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const x = -15 + 30 * hash(i, 701);
      const y = HORIZON + 0.4 + 9.5 * hash(i, 703);
      sp[i * 3] = x; sp[i * 3 + 1] = y; sp[i * 3 + 2] = -11;
      this.starBase[i] = 0.08 + 0.5 * Math.pow(hash(i, 705), 2.2);
      this.starSeed[i] = hash(i, 707);
      scol[i * 3] = 0; scol[i * 3 + 1] = 0; scol[i * 3 + 2] = 0;
    }
    this.starsGeo = new THREE.BufferGeometry();
    this.starsGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starsGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    const starsMat = new THREE.PointsMaterial({
      size: 0.075, vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const stars = new THREE.Points(this.starsGeo, starsMat);
    stars.frustumCulled = false;
    this.threeScene.add(stars);
    this.ownedMats.push(starsMat);

    // ---- Meteor trails + head sprites + reflections -------------------------
    for (const m of METEORS) {
      const pos = new Float32Array(TRAIL * 3);
      const col = new Float32Array(TRAIL * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      this.threeScene.add(line);
      this.meteorGeos.push(geo);
      this.meteorMats.push(mat);

      const hm = new THREE.SpriteMaterial({
        map: this.glowTex, transparent: true, depthWrite: false,
        color: WHITE.clone(), opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const head = new THREE.Sprite(hm);
      const s = m.fire ? 1.1 : 0.42;
      head.scale.set(s, s, 1);
      this.threeScene.add(head);
      this.headMats.push(hm);
      this.headSprites.push(head);

      // Reflection: short mirrored streak on the salt flat, only while bright.
      const rp = new Float32Array(TRAIL * 3);
      const rc = new Float32Array(TRAIL * 3);
      const rgeo = new THREE.BufferGeometry();
      rgeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
      rgeo.setAttribute('color', new THREE.BufferAttribute(rc, 3));
      const rmat = new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const refl = new THREE.Line(rgeo, rmat);
      refl.frustumCulled = false;
      this.threeScene.add(refl);
      this.reflGeos.push(rgeo);
      this.ownedMats.push(rmat);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;
    const u = Math.min(lt / TAKE, 1);

    // ---- Ridge silhouette (static fbm; rebuilt so aspect changes fit) -------
    {
      const R_N = 160;
      const p = this.ridgeGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < R_N; i++) {
        const x = -16 + (32 * i) / (R_N - 1);
        p.setXYZ(i, x, ridgeY(x), -9.5);
        // Bottom edge stops at the flat top: the flats below stay visible
        // (running the fan to the frame bottom would hide them entirely).
        p.setXYZ(R_N + i, x, FLAT_Y, -9.5);
      }
      p.needsUpdate = true;
    }

    // ---- Stars: twinkle = base · (0.55 + 0.45·sin^6) -------------------------
    {
      const c = this.starsGeo.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < this.starBase.length; i++) {
        const seed = this.starSeed[i]!;
        const tw = Math.pow(Math.abs(Math.sin(lt * (0.4 + seed * 1.6) + seed * 40)), 6);
        const b = this.starBase[i]! * (0.45 + 0.55 * tw);
        c.setXYZ(i, BONE.r * b, BONE.g * b, BONE.b * b);
      }
      c.needsUpdate = true;
    }

    // ---- Meteors ------------------------------------------------------------
    for (let mi = 0; mi < METEORS.length; mi++) {
      const m = METEORS[mi]!;
      const g = meteorGlow(m, lt);
      const ag = afterglow(m, lt);
      const geo = this.meteorGeos[mi]!;
      const p = geo.getAttribute('position') as THREE.BufferAttribute;
      const c = geo.getAttribute('color') as THREE.BufferAttribute;
      const head = this.headMats[mi]!;

      if (g <= 0 && ag <= 0) {
        head.opacity = 0;
        for (let k = 0; k < TRAIL; k++) { c.setXYZ(k, 0, 0, 0); p.setXYZ(k, 0, 0, 0); }
      } else {
        const h = meteorPos(m, lt);
        const hEnd = meteorPos(m, m.s + m.d); // where the streak expired
        // While alive the head is the moving point; after the streak burns out
        // the afterglow sprite parks at the burn-out point.
        const hx = g > 0 ? h.x : hEnd.x;
        const hy = g > 0 ? h.y : hEnd.y;
        head.opacity = Math.min(1, g * 0.9 + ag * 0.55);
        head.color.copy(WHITE).lerp(AMBER, clamp01(ag * 0.8));
        this.headSprites[mi]!.position.set(hx, hy, -5);

        for (let k = 0; k < TRAIL; k++) {
          const fk = k / (TRAIL - 1);           // 0 head → 1 tail end
          const back = m.len * fk;
          const px = hx - m.dx * back;
          const py = hy - m.dy * back;
          p.setXYZ(k, px, py, -5);
          // color: white-hot head → amber → dark tail
          const fade = (1 - fk) * (1 - fk * 0.55);
          const wMix = Math.max(0, 1 - fk * 2.4); // white core only near head
          this._c.copy(AMBER_DIM).lerp(AMBER, clamp01(1 - fk * 1.6)).lerp(WHITE, wMix);
          const b = g * fade;
          c.setXYZ(k, this._c.r * b, this._c.g * b, this._c.b * b);
        }
      }
      p.needsUpdate = true;
      c.needsUpdate = true;

      // Reflection on the salt flat: mirrored, dimmed, only when bright.
      const rgeo = this.reflGeos[mi]!;
      const rp = rgeo.getAttribute('position') as THREE.BufferAttribute;
      const rc = rgeo.getAttribute('color') as THREE.BufferAttribute;
      const rg = Math.max(0, g - 1.1) * 0.08 + ag * 0.03;
      if (rg <= 0) {
        for (let k = 0; k < TRAIL; k++) rc.setXYZ(k, 0, 0, 0);
      } else {
        const h = g > 0 ? meteorPos(m, lt) : meteorPos(m, m.s + m.d);
        for (let k = 0; k < TRAIL; k++) {
          const fk = k / (TRAIL - 1);
          const back = m.len * 0.6 * fk;
          const px = h.x - m.dx * back;
          const py = FLAT_Y - (h.y - HORIZON) * 0.12 + m.dy * back * 0.12;
          rp.setXYZ(k, px, py, -8);
          const b = rg * (1 - fk);
          rc.setXYZ(k, AMBER.r * b * 0.7, AMBER.g * b * 0.7, AMBER.b * b * 0.7);
        }
      }
      rp.needsUpdate = true;
      rc.needsUpdate = true;
    }

    // ---- Camera: slow pan across the ridge + slight push-in ------------------
    const halfHfov = Math.atan(Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect);
    // Portrait crops the frame edges instead of shrinking the whole scene to
    // a sliver: the width we insist on covering scales with aspect.
    const wantW = 13.5 * Math.min(1, this.camera.aspect);
    const dist = Math.max(14, wantW / Math.tan(halfHfov) / 0.98) * (1.04 - 0.05 * u);
    this.camera.position.set(
      Math.sin(lt * 0.05) * 0.5 - 0.4,
      1.6 + Math.sin(lt * 0.04) * 0.2,
      dist);
    this.camera.lookAt(0.4 * Math.sin(lt * 0.05), 1.4, 0);
    this.camera.updateMatrixWorld();

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(VOID, 1);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.55,
      bloomThreshold: 0.3,
      vignette: 0.5,
      grain: 0.012,
      exposure: 1.0,
    };
  }

  override dispose(): void {
    this.glowTex.dispose();
    this.skyTex.dispose();
    this.ridgeGeo.dispose();
    this.starsGeo.dispose();
    for (const g of this.meteorGeos) g.dispose();
    for (const m of this.meteorMats) m.dispose();
    for (const m of this.headMats) m.dispose();
    for (const g of this.reflGeos) g.dispose();
    for (const g of this.ownedGeos) g.dispose();
    for (const m of this.ownedMats) m.dispose();
  }
}

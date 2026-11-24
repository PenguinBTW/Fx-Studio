// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
//
// pendulumwave — the classic pendulum-wave installation: 15 bobs hang in a
// line, released together at t=0, each with a slightly different period so
// the row weaves into traveling sine patterns, dissolves into apparent
// disorder mid-take, then begins re-converging toward the mirror re-phase.
// Every position is a closed-form f(t): theta_i(t) = A*cos(2*pi*f_i*t)
// with f_i = (BASE + i)/TAKE cycles/sec — no integration, no Math.random.
// Trails are rebuilt each frame by re-evaluating the same function at
// earlier times, so they stay exact under seeks.

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const N_BOBS = 15;
const TAKE = 20.0;          // seconds — full re-phase lands at t = TAKE
const BASE = 11;            // bob i completes BASE + i oscillations in the take
const RAIL_Y = 7.5;
const LEN = 9.2;            // string length
const SWING = 0.42;         // release amplitude, radians
const SPACING = 2.35;
const TRAIL_N = 44;         // trail samples
const TRAIL_SPAN = 1.5;     // seconds of history drawn
const CENTER = (N_BOBS - 1) / 2; // centremost bob carries the warm accent

const BONE = new THREE.Color(0.82, 0.81, 0.74);
const WARM = new THREE.Color(0.95, 0.55, 0.28);

const freq = (i: number) => (BASE + i) / TAKE;
const anchorX = (i: number) => (i - CENTER) * SPACING;
// Closed-form bob position at time t (swing in the x/y plane, facing camera).
function bobPos(i: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const th = SWING * Math.cos(2 * Math.PI * freq(i) * t);
  return out.set(anchorX(i) + LEN * Math.sin(th), RAIL_Y - LEN * Math.cos(th), 0);
}

export default class PendulumWaveScene extends Scene {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private bobs: THREE.Mesh[] = [];
  private strings: THREE.Line[] = [];
  private trails: THREE.Line[] = [];
  private tmp = new THREE.Vector3();
  private railMat: THREE.Material;
  private railGeo: THREE.BufferGeometry;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.threeScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 300);

    // Ceiling rail the strings hang from.
    this.railGeo = new THREE.BoxGeometry(N_BOBS * SPACING + 4, 0.22, 0.22);
    this.railMat = new THREE.MeshBasicMaterial({ color: 0x2a2d31 });
    const rail = new THREE.Mesh(this.railGeo, this.railMat);
    rail.position.y = RAIL_Y;
    this.threeScene.add(rail);

    const bobGeo = new THREE.SphereGeometry(0.42, 24, 18);
    for (let i = 0; i < N_BOBS; i++) {
      const isCenter = i === Math.round(CENTER);
      const mat = new THREE.MeshBasicMaterial({ color: isCenter ? WARM : BONE });
      const bob = new THREE.Mesh(bobGeo, mat);
      this.threeScene.add(bob);
      this.bobs.push(bob);

      // String: 2-point line from anchor to bob, updated per frame.
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const str = new THREE.Line(
        sg,
        new THREE.LineBasicMaterial({ color: 0x3c4046, transparent: true, opacity: 0.75 })
      );
      str.frustumCulled = false; // endpoints move every frame; cached bounds go stale
      this.threeScene.add(str);
      this.strings.push(str);

      // Trail: polyline of past positions; per-vertex colour fades to black
      // so additive blending reads as a luminous decaying ribbon.
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 3), 3));
      const cols = new Float32Array(TRAIL_N * 3);
      const base = isCenter ? WARM : BONE;
      for (let k = 0; k < TRAIL_N; k++) {
        const fade = Math.pow(1 - k / (TRAIL_N - 1), 1.8) * 0.34; // head→tail
        cols[k * 3 + 0] = base.r * fade;
        cols[k * 3 + 1] = base.g * fade;
        cols[k * 3 + 2] = base.b * fade;
      }
      tg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const trail = new THREE.Line(
        tg,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      trail.frustumCulled = false;
      this.threeScene.add(trail);
      this.trails.push(trail);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.lt;

    // Near-frontal slow lateral drift; subtle top-down tilt reveal in the
    // first 2s (camera starts high and eases down to the frontal plane).
    const ease = 1 - Math.pow(1 - Math.min(lt / 2, 1), 3); // easeOutCubic 0→1
    const cy = 12.5 - 9.5 * ease;
    const cx = Math.sin(0.11 * lt) * 2.6;
    // Keep the full row in frame at any aspect: half-extent of the sweep is
    // the outer anchor + string length * sin(SWING), plus the lookAt wander
    // (the frustum is centred at lx, not at the row centre) and a margin.
    const lx = Math.sin(0.11 * lt + 0.4) * 1.4;
    const halfRow = (CENTER * SPACING) + LEN * Math.sin(SWING) + Math.abs(lx) + 1.0;
    const halfHfov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = Math.max(30, halfRow / (Math.tan(halfHfov) * this.camera.aspect));
    this.camera.position.set(cx, cy, dist);
    this.camera.lookAt(lx, -0.8 + 1.2 * ease, 0);
    // Narrow aspect pulls the camera far back — keep the far plane ahead of it.
    const far = Math.max(300, dist + 60);
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    for (let i = 0; i < N_BOBS; i++) {
      bobPos(i, lt, this.tmp);
      this.bobs[i]!.position.copy(this.tmp);

      const sp = this.strings[i]!.geometry.getAttribute('position') as THREE.BufferAttribute;
      sp.setXYZ(0, anchorX(i), RAIL_Y, 0);
      sp.setXYZ(1, this.tmp.x, this.tmp.y, 0);
      sp.needsUpdate = true;

      const tp = this.trails[i]!.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < TRAIL_N; k++) {
        const tk = lt - (k / (TRAIL_N - 1)) * TRAIL_SPAN;
        if (tk < 0) {
          // Before release all bobs sit at the shared release pose.
          bobPos(i, 0, this.tmp);
        } else {
          bobPos(i, tk, this.tmp);
        }
        tp.setXYZ(k, this.tmp.x, this.tmp.y, this.tmp.z);
      }
      tp.needsUpdate = true;
    }

    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.threeScene, this.camera);
    r.resetState();

    return {
      bloom: 0.32,
      bloomThreshold: 0.52,
      vignette: 0.30,
      grain: 0.012,
      exposure: 1.06,
    };
  }

  override dispose(): void {
    this.railGeo.dispose();
    this.railMat.dispose();
    for (const b of this.bobs) {
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
    }
    for (const s of this.strings) {
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
    for (const t of this.trails) {
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
    }
  }
}

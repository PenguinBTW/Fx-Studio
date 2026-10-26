// Universal Dual-Mode 6-DOF Camera Rig (CameraRig)
// Seamlessly handles Cinematic Perspective (14mm-200mm) and Technical Isometric projections.
// Features centripetal Catmull-Rom arc-length splines, quaternion rotation interpolation,
// singular-safe orthonormal frames, analytical trauma-based procedural shake, and target tracking.
import * as THREE from 'three';
import { ViewportSpace } from './viewport';
import { type Cam } from './camera3d';
import { clamp, noise1, TAU, type V3 } from './util';
import { W, H } from './gl';

export type CameraMode = 'perspective' | 'isometric' | 'orthographic';

export interface CameraWaypoint {
  t: number;            // normalized trajectory progress [0..1]
  pos: V3;              // camera position
  target: V3;           // look-at target
  roll?: number;        // roll angle in radians (default: 0)
  focalLength?: number; // mm (if < 300) or screen px (if >= 300)
}

export interface TraumaImpulse {
  t0: number;
  intensity: number;
  decay: number;
}

export interface DollyZoomResult { position: V3; fov: number; }

const DEG = Math.PI / 180;

/**
 * Camera distance at which a subject of `widthWorld` spans `screenFraction` of the
 * frame height for a vertical fov (degrees): d = w / (2 * tan(fov/2) * screenFraction).
 */
export function dollyDistance(widthWorld: number, fovDeg: number, screenFraction = 1): number {
  const safeFov = Math.max(0.01, Math.min(179.99, fovDeg));
  const safeFrac = Math.max(1e-6, screenFraction);
  return widthWorld / (2 * Math.tan((safeFov * DEG) / 2) * safeFrac);
}

/** Pure dolly-zoom: place the camera on the ray `dir` (unit, camera forward) so the subject keeps its screen size at `fovDeg`. */
export function solveDollyZoom(
  targetPos: V3, dir: V3, widthWorld: number, fovDeg: number, screenFraction = 1,
): DollyZoomResult {
  const d = dollyDistance(widthWorld, fovDeg, screenFraction);
  return {
    position: [targetPos[0] - dir[0] * d, targetPos[1] - dir[1] * d, targetPos[2] - dir[2] * d],
    fov: fovDeg,
  };
}

/** Pure dolly-zoom sampler driven by a fov(t) function in degrees. */
export function dollyZoomAt(
  targetPos: V3, dir: V3, widthWorld: number, fovOfT: (t: number) => number, t: number, screenFraction = 1,
): DollyZoomResult {
  return solveDollyZoom(targetPos, dir, widthWorld, fovOfT(t), screenFraction);
}

/** Legacy radial autofocus: distance of the projected target from screen centre in the post.ts radial-DoF metric (0 at centre, ~0.57 at the 16:9 corner). */
export function computeScreenFocusRadius(targetWorldPos: V3, camera: THREE.PerspectiveCamera, aspect: number): number {
  const v = new THREE.Vector3(targetWorldPos[0], targetWorldPos[1], targetWorldPos[2]).project(camera);
  return Math.hypot(v.x * 0.5 * aspect, v.y * 0.5);
}

/**
 * World distance of `targetPos` along the view axis (what a depth buffer holds), for `depthFocusDist`.
 * `forward` is the unit view direction; when omitted the Euclidean distance is returned.
 */
export function focusDistance(cameraPos: V3, targetPos: V3, forward?: V3): number {
  const dx = targetPos[0] - cameraPos[0], dy = targetPos[1] - cameraPos[1], dz = targetPos[2] - cameraPos[2];
  if (!forward) return Math.hypot(dx, dy, dz);
  return dx * forward[0] + dy * forward[1] + dz * forward[2];
}

/** Polar orbit position: yaw 0 / pitch 0 sits on +Z of the target; positive pitch raises the camera. */
export function orbitPosition(targetPos: V3, radius: number, pitchRad: number, yawRad: number): V3 {
  const cp = Math.cos(pitchRad);
  return [
    targetPos[0] + radius * cp * Math.sin(yawRad),
    targetPos[1] + radius * Math.sin(pitchRad),
    targetPos[2] + radius * cp * Math.cos(yawRad),
  ];
}

export class CameraRig {
  mode: CameraMode = 'perspective';

  static dollyDistance = dollyDistance;
  static solveDollyZoom = solveDollyZoom;
  static dollyZoomAt = dollyZoomAt;
  static computeScreenFocusRadius = computeScreenFocusRadius;
  static focusDistance = focusDistance;
  static orbitPosition = orbitPosition;

  /** Unit view direction from position toward target (+Z if coincident). */
  getForwardVector(): V3 {
    const dx = this.target[0] - this.position[0];
    const dy = this.target[1] - this.position[1];
    const dz = this.target[2] - this.position[2];
    const len = Math.hypot(dx, dy, dz);
    return len < 1e-6 ? [0, 0, 1] : [dx / len, dy / len, dz / len];
  }

  /** Dolly-zoom along the current view direction; also applies position/target/lens to the rig. */
  dollyZoom(targetPos: V3, widthWorld: number, fovDeg: number, screenFraction = 1): DollyZoomResult {
    const r = solveDollyZoom(targetPos, this.getForwardVector(), widthWorld, fovDeg, screenFraction);
    this.position = r.position;
    this.target = [targetPos[0], targetPos[1], targetPos[2]];
    this.setFocalLengthPx((H / 2) / Math.tan(fovDeg * DEG / 2));
    return r;
  }

  /** Depth-DoF focus distance (world units along the view axis) to a world point. */
  focusDistance(targetPos: V3): number {
    return focusDistance(this.position, targetPos, this.getForwardVector());
  }

  computeScreenFocusRadius(targetWorldPos: V3, camera: THREE.PerspectiveCamera, aspect = W / H): number {
    return computeScreenFocusRadius(targetWorldPos, camera, aspect);
  }

  /** Place the camera on a polar orbit around targetPos and aim at it. */
  orbit(targetPos: V3, radius: number, pitchRad: number, yawRad: number): V3 {
    this.position = orbitPosition(targetPos, radius, pitchRad, yawRad);
    this.target = [targetPos[0], targetPos[1], targetPos[2]];
    return this.position;
  }

  // Active state
  position: V3 = [0, 1.8, -8.0];
  target: V3 = [0, 0, 0];
  roll = 0;
  focalLengthMm = 50.0;                // 35mm equivalent focal length
  focalLengthPx = 50.0 * (H / 24.0);   // Synchronized pixel equivalent (1080/24 = 45 px/mm)
  isoScale = 6.0;                      // World units across screen for isometric mode

  // Analytical closed-form trauma impulses (preserves f(t) sub-frame determinism)
  private impulses: TraumaImpulse[] = [];
  private _degenerateWarned = false;

  // Arc-length parameterized spline waypoints
  private waypoints: CameraWaypoint[] = [];
  private splinePos: THREE.CatmullRomCurve3 | null = null;
  private splineTarget: THREE.CatmullRomCurve3 | null = null;

  constructor(mode: CameraMode = 'perspective') {
    this.mode = mode;
  }

  /**
   * Set cinematic perspective lens focal length in millimeters (35mm format: sensor height 24mm)
   */
  setLensMm(mm: number): this {
    this.focalLengthMm = mm;
    this.focalLengthPx = mm * (H / 24.0);
    return this;
  }

  /**
   * Set focal length directly in screen pixels
   */
  setFocalLengthPx(px: number): this {
    this.focalLengthPx = px;
    this.focalLengthMm = px / (H / 24.0);
    return this;
  }

  /**
   * Switch between cinematic perspective flight and technical isometric showcase
   */
  setMode(mode: CameraMode): this {
    this.mode = mode;
    return this;
  }

  /**
   * Register a deterministic trauma impulse at timestamp t0 (decays exponentially)
   */
  addTrauma(amount: number, t0 = 0, decay = 1.5): this {
    if (amount <= 0) return this;
    this.impulses.push({ t0, intensity: amount, decay: Math.max(1e-4, decay) });
    return this;
  }

  /**
   * Calculate continuous trauma amplitude at time t (strictly closed-form f(t))
   */
  getTraumaAt(t: number): number {
    let total = 0;
    for (const imp of this.impulses) {
      if (t >= imp.t0) {
        total += imp.intensity * Math.exp(-(t - imp.t0) * imp.decay);
      }
    }
    return clamp(total, 0, 1.0);
  }

  /**
   * Build smooth centripetal Catmull-Rom flight path with constant arc-length velocity
   */
  setPath(waypoints: CameraWaypoint[]): this {
    if (waypoints.length === 0) {
      this.waypoints = [];
      this.splinePos = null;
      this.splineTarget = null;
      return this;
    }
    // Sort waypoints by normalized time t to guarantee monotonic arc-length spline
    this.waypoints = [...waypoints].sort((a, b) => a.t - b.t);
    if (this.waypoints.length === 1) {
      this.splinePos = null;
      this.splineTarget = null;
      this.position = [...this.waypoints[0].pos];
      this.target = [...this.waypoints[0].target];
      if (this.waypoints[0].roll !== undefined) this.roll = this.waypoints[0].roll;
      if (this.waypoints[0].focalLength !== undefined) {
        const fl = this.waypoints[0].focalLength;
        if (fl < 300) this.setLensMm(fl);
        else this.setFocalLengthPx(fl);
      }
      return this;
    }
    if (this.waypoints.length >= 2) {
      const posPoints = this.waypoints.map((w) => new THREE.Vector3(w.pos[0], w.pos[1], w.pos[2]));
      const targetPoints = this.waypoints.map((w) => new THREE.Vector3(w.target[0], w.target[1], w.target[2]));
      this.splinePos = new THREE.CatmullRomCurve3(posPoints, false, 'centripetal', 0.5);
      this.splineTarget = new THREE.CatmullRomCurve3(targetPoints, false, 'centripetal', 0.5);
    }
    return this;
  }

  /**
   * Sample camera trajectory along normalized arc length u in [0, 1]
   */
  evalPath(u: number): this {
    const p = clamp(u, 0, 1);
    if (this.waypoints.length === 1) {
      this.position = [...this.waypoints[0].pos];
      this.target = [...this.waypoints[0].target];
      if (this.waypoints[0].roll !== undefined) this.roll = this.waypoints[0].roll;
      if (this.waypoints[0].focalLength !== undefined) {
        const fl = this.waypoints[0].focalLength;
        if (fl < 300) this.setLensMm(fl);
        else this.setFocalLengthPx(fl);
      }
      return this;
    }
    if (this.splinePos && this.splineTarget) {
      const pos = this.splinePos.getPointAt(p);
      const tgt = this.splineTarget.getPointAt(p);
      this.position = [pos.x, pos.y, pos.z];
      this.target = [tgt.x, tgt.y, tgt.z];

      // Interpolate roll and focal length along waypoints
      if (this.waypoints.length >= 2) {
        let i = 0;
        while (i + 1 < this.waypoints.length && p > this.waypoints[i + 1]!.t) i++;
        const w0 = this.waypoints[i]!, w1 = this.waypoints[Math.min(i + 1, this.waypoints.length - 1)]!;
        const span = Math.max(1e-4, w1.t - w0.t);
        const k = clamp((p - w0.t) / span, 0, 1);
        this.roll = (w0.roll ?? 0) * (1 - k) + (w1.roll ?? 0) * k;

        const fl0 = w0.focalLength ?? this.focalLengthMm;
        const fl1 = w1.focalLength ?? fl0;
        const fl = fl0 * (1 - k) + fl1 * k;

        // Convention: < 300 is millimeters, >= 300 is screen pixels
        if (fl < 300) this.setLensMm(fl);
        else this.setFocalLengthPx(fl);
      }
    }
    return this;
  }

  /**
   * Evaluate procedural shake and return orthonormal Cam specification.
   * Completely deterministic closed-form f(t) across arbitrary sub-frame sampling.
   */
  evalCam(t: number): Cam {
    const traumaVal = this.getTraumaAt(t);
    const shakePower = traumaVal * traumaVal;

    let p = [...this.position] as V3;
    let roll = this.roll;

    if (shakePower > 0.0001) {
      const shakeTrans = 0.08 * shakePower;
      const shakeRot = 0.02 * shakePower;
      p[0] += noise1(t * 35.0, 101) * shakeTrans;
      p[1] += noise1(t * 37.0, 102) * shakeTrans;
      p[2] += noise1(t * 39.0, 103) * shakeTrans * 0.5;
      roll += noise1(t * 29.0, 104) * shakeRot;
    }

    // Compute Forward unit vector towards target (guard coincident pos==target)
    const dx = this.target[0] - p[0];
    const dy = this.target[1] - p[1];
    const dz = this.target[2] - p[2];
    const rawLen = Math.hypot(dx, dy, dz);
    if (rawLen < 1e-6 && !this._degenerateWarned) {
      // Coincident waypoint — hold +Z forward to avoid zero-basis NaN.
      console.warn('[rig] position==target, holding +Z forward to avoid degenerate basis');
      this._degenerateWarned = true;
    } else if (rawLen >= 1e-6) {
      this._degenerateWarned = false;
    }
    const len = rawLen < 1e-6 ? 1.0 : rawLen;
    const Fw: V3 = rawLen < 1e-6 ? [0, 0, 1] : [dx / len, dy / len, dz / len];

    // Singular-safe orthonormal basis:
    // When gaze aligns with world Y (|Fw.y| > 0.99), fallback to Z-axis reference up
    let upRef: V3 = [0, 1, 0];
    if (Math.abs(Fw[1]) > 0.99) {
      upRef = [0, 0, Fw[1] > 0 ? -1 : 1];
    }

    // Camera backward vector in world space: B = -Fw
    // Orthonormal basis maintaining right-handed convention (det = +1):
    // R0 = vnorm(upRef x B)
    const B: V3 = [-Fw[0], -Fw[1], -Fw[2]];
    const rx = upRef[1] * B[2] - upRef[2] * B[1];
    const ry = upRef[2] * B[0] - upRef[0] * B[2];
    const rz = upRef[0] * B[1] - upRef[1] * B[0];
    const rlen = Math.hypot(rx, ry, rz) || 1.0;
    const R0: V3 = [rx / rlen, ry / rlen, rz / rlen];

    // U0 = B x R0
    const U0: V3 = [
      B[1] * R0[2] - B[2] * R0[1],
      B[2] * R0[0] - B[0] * R0[2],
      B[0] * R0[1] - B[1] * R0[0],
    ];

    // Apply roll rotation
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);
    const R: V3 = [R0[0] * cosR + U0[0] * sinR, R0[1] * cosR + U0[1] * sinR, R0[2] * cosR + U0[2] * sinR];
    const U: V3 = [U0[0] * cosR - R0[0] * sinR, U0[1] * cosR - R0[1] * sinR, U0[2] * cosR - R0[2] * sinR];

    return {
      p,
      R,
      U,
      F: Fw,
      f: this.focalLengthPx,
      cx: W / 2,
      cy: H / 2,
    };
  }

  /**
   * Synchronize CameraRig to a Three.js Camera (Perspective or Orthographic/Isometric)
   */
  syncToThreeCamera(cam: Cam, threeCam: THREE.Camera): void {
    if (this.mode === 'perspective' && threeCam instanceof THREE.PerspectiveCamera) {
      ViewportSpace.camToThreeCamera(cam, threeCam, W, H);
    } else if ((this.mode === 'isometric' || this.mode === 'orthographic') && threeCam instanceof THREE.OrthographicCamera) {
      const aspect = W / H;
      const hHalf = this.isoScale * 0.5;
      const wHalf = hHalf * aspect;
      threeCam.left = -wHalf;
      threeCam.right = wHalf;
      threeCam.top = hHalf;
      threeCam.bottom = -hHalf;
      threeCam.near = 0.1;
      threeCam.far = 1000;
      threeCam.position.set(cam.p[0], cam.p[1], cam.p[2]);

      const viewMatrix = new THREE.Matrix4();
      viewMatrix.set(
        cam.R[0], cam.R[1], cam.R[2], -(cam.p[0] * cam.R[0] + cam.p[1] * cam.R[1] + cam.p[2] * cam.R[2]),
        cam.U[0], cam.U[1], cam.U[2], -(cam.p[0] * cam.U[0] + cam.p[1] * cam.U[1] + cam.p[2] * cam.U[2]),
        -cam.F[0], -cam.F[1], -cam.F[2], (cam.p[0] * cam.F[0] + cam.p[1] * cam.F[1] + cam.p[2] * cam.F[2]),
        0, 0, 0, 1
      );
      threeCam.matrixWorldInverse.copy(viewMatrix);
      threeCam.matrixWorld.copy(viewMatrix).invert();
      threeCam.matrixAutoUpdate = false;
      threeCam.updateProjectionMatrix();
    } else {
      console.warn(`[rig] syncToThreeCamera mismatch: mode '${this.mode}' incompatible with ${threeCam.constructor.name}`);
    }
  }
  /**
   * Generates a 3D flight trajectory ribbon/line visualizing the camera path for god-view debugging.
   */
  createDebugRibbon(scene?: THREE.Scene, samples = 100): THREE.Line | null {
    if (!this.splinePos) return null;
    const count = Math.max(2, samples);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= count; i++) {
      const u = i / count;
      const pt = this.splinePos.getPointAt(u);
      points.push(pt);
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geom, mat);
    line.name = 'CameraDebugRibbon';
    line.userData.dispose = () => {
      geom.dispose();
      mat.dispose();
    };
    if (scene) {
      scene.add(line);
    }
    return line;
  }
}

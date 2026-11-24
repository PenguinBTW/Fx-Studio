// Readout electronics + camera choreography for the CHLADNI rig.
// The machined rig itself is a Blender asset (assets/rig/model.glb); this module
// owns the dynamic bits: the console display (CanvasTexture, drawn only when its
// content changes), the status LED that flares --signal on each resonant step,
// and the closed-form camera. All animation is a pure function of t.

import * as THREE from 'three';
import { clamp, frameIdx, hash, lerp, pulse } from '../../engine/util';
import { HEX } from '../../engine/palette';
import { MODES } from './nodal';
import { STEP_TIMES } from './grains';

/** Active mode index at t, or -1 while the drive is in standby. */
export function modeIndexAt(t: number): number {
  let k = -1;
  for (let s = 0; s < STEP_TIMES.length; s++) if (t >= STEP_TIMES[s]!) k = s;
  return k;
}

/** Strongest recent step pulse in [0,1] (decays with ~0.55s half-life). */
export function rimPulseAt(t: number): number {
  let p = 0;
  for (const st of STEP_TIMES) p = Math.max(p, pulse(t, st, 0.55));
  return p;
}

// Console bezel anchors — must match assets/rig/build.py (BY = -0.018, KX/KZ below).
const KX = -0.175, KZ = 0.125;
const DISP_POS = new THREE.Vector3(KX, 0.0402, 0.1396);
const DISP_TILT = -0.61;              // face tilted up-forward (normal ≈ (0,0.57,0.82))
const LED_POS = new THREE.Vector3(KX, 0.0307, 0.1606);

export class Readout {
  readonly group = new THREE.Group();
  private displayCanvas = document.createElement('canvas');
  private displayTex: THREE.CanvasTexture;
  private ledMat: THREE.MeshStandardMaterial;
  private lastDrawKey = -1;

  constructor() {
    // Display: one canvas texture shown on BOTH faces of the slanted bezel
    // (front plane + a back copy) so the readout survives the full camera orbit.
    this.displayCanvas.width = 512;
    this.displayCanvas.height = 192;
    this.displayTex = new THREE.CanvasTexture(this.displayCanvas);
    this.displayTex.colorSpace = THREE.SRGBColorSpace;
    this.displayTex.minFilter = THREE.LinearFilter;
    this.displayTex.generateMipmaps = false;
    const dispMat = new THREE.MeshBasicMaterial({ map: this.displayTex });
    const geo = new THREE.PlaneGeometry(0.096, 0.034);
    for (const tilt of [DISP_TILT, Math.PI + DISP_TILT]) {
      const p = new THREE.Mesh(geo, dispMat);
      p.position.copy(DISP_POS);
      p.rotation.x = tilt;
      const n = new THREE.Vector3(0, -Math.sin(tilt), Math.cos(tilt));
      p.position.addScaledVector(n, tilt === DISP_TILT ? 0.0012 : 0.0006);
      this.group.add(p);
    }

    // Status LED — emissive driven in code (exported emissive can't be animated)
    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      emissive: new THREE.Color(HEX.bone),
      emissiveIntensity: 0.5,
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 10, 10), this.ledMat);
    led.position.copy(LED_POS);
    this.group.add(led);
  }

  /** Displayed frequency value at t: digits scramble-roll for 0.9s after a step. */
  private freqShownAt(t: number): { mode: number; digits: string; rolling: boolean } {
    const k = modeIndexAt(t);
    if (k < 0) return { mode: -1, digits: '----', rolling: false };
    const stepT = STEP_TIMES[k]!;
    const roll = clamp((t - stepT) / 0.9);
    if (roll >= 1) return { mode: k, digits: `${MODES[k]!.freq}`, rolling: false };
    const fi = frameIdx(t);
    const target = `${MODES[k]!.freq}`;
    let out = '';
    for (let i = 0; i < target.length; i++) {
      out += hash(fi, i, k) < roll ? target[i]! : `${Math.floor(hash(fi, i, k + 31) * 10)}`;
    }
    return { mode: k, digits: out, rolling: true };
  }

  update(t: number): void {
    const k = modeIndexAt(t);
    const rp = rimPulseAt(t);
    const shown = this.freqShownAt(t);
    const pulseOn = rp > 0.25 ? 1 : 0;

    const col = pulseOn ? new THREE.Color(HEX.signal) : new THREE.Color(HEX.bone);
    this.ledMat.emissive.copy(col);
    this.ledMat.emissiveIntensity = 0.5 + rp * 2.5;

    // Draw key includes the pulse bucket: color is a pure function of t, so a
    // scrub to the same instant always produces the same pixels.
    const key = k * 1000 + pulseOn * 100 + (shown.rolling ? frameIdx(t) : 0);
    if (key === this.lastDrawKey) return;
    this.lastDrawKey = key;

    const g = this.displayCanvas.getContext('2d')!;
    g.clearRect(0, 0, 512, 192);
    g.fillStyle = '#070708';
    g.fillRect(0, 0, 512, 192);
    g.strokeStyle = 'rgba(232,228,218,0.25)';
    g.lineWidth = 3;
    g.strokeRect(4, 4, 504, 184);

    g.textAlign = 'left';
    g.fillStyle = 'rgba(156,151,143,0.9)';
    g.font = '700 30px Archivo, sans-serif';
    g.fillText(k < 0 ? 'DRIVE · STANDBY' : `MODE (${MODES[k]!.m},${MODES[k]!.n})`, 26, 52);

    g.fillStyle = pulseOn ? HEX.signal : HEX.bone;
    g.font = '800 84px Archivo, sans-serif';
    g.fillText(k < 0 ? '---- HZ' : `${shown.digits} HZ`, 26, 152);
    this.displayTex.needsUpdate = true;
  }

  dispose(): void {
    this.displayTex.dispose();
    this.ledMat.dispose();
  }
}

/** Camera choreography for the whole scene — one unbroken CCW orbit, closed-form. */
export function cameraAt(t: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
  let theta: number, radius: number, height: number, fov: number;
  let tx = 0, ty = 0.006, tz = 0;

  if (t < 3.5) {
    const u = clamp(t / 3.5);
    theta = lerp(0.55, 0.78, u);
    radius = lerp(0.55, 0.46, u);
    height = lerp(0.34, 0.28, u);
    fov = 36;
  } else if (t < 9.0) {
    const u = clamp((t - 3.5) / 5.5);
    const e = u * u * (3 - 2 * u);
    theta = lerp(0.78, 1.18, e);
    radius = lerp(0.46, 0.30, e);
    height = lerp(0.28, 0.12, e);
    fov = lerp(36, 48, e);
  } else if (t < 15.0) {
    const u = clamp((t - 9.0) / 6.0);
    const e = u * u * (3 - 2 * u);
    theta = lerp(1.18, 1.5, e);
    radius = lerp(0.30, 0.18, e);
    height = lerp(0.12, 0.055, e);
    fov = lerp(48, 55, e);
    // Macro: gaze slides to a nodal-line region off-centre
    tx = lerp(0, 0.045, e);
    tz = lerp(0, 0.035, e);
  } else {
    const u = clamp((t - 15.0) / 7.5);
    const e = u * u * u * (u * (u * 6 - 15) + 10);
    theta = lerp(1.5, 1.72, e);
    radius = lerp(0.18, 0.54, e);
    height = lerp(0.055, 0.46, e);
    fov = lerp(55, 40, e);
    // Pull-back: gaze eases back to the plate centre (no framing snap)
    tx = lerp(0.045, 0, e);
    tz = lerp(0.035, 0, e);
    ty = lerp(0.006, 0.02, e);
  }

  // Step transient: tiny camera tremor synced to each resonant hit
  const tr = rimPulseAt(t) * 0.0035;
  const fi = frameIdx(t);
  const jx = (hash(fi, 101) - 0.5) * 2 * tr;
  const jy = (hash(fi, 103) - 0.5) * 2 * tr;

  // Hold creep: radius breathes inward over the whole scene
  radius *= 1.0 - 0.006 * t;

  const pos = new THREE.Vector3(
    Math.sin(theta) * radius + jx,
    height + jy,
    Math.cos(theta) * radius,
  );
  return { pos, target: new THREE.Vector3(tx, ty, tz), fov };
}

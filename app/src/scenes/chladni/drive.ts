// The vibration rig: machined base, driver column, clamped steel plate,
// overhead lamp housing (the motivated key light), a diegetic mode readout
// drawn on a small display, and a status LED that flares --signal on each
// resonant step. All animation is closed-form in t.

import * as THREE from 'three';
import { clamp, frameIdx, hash, lerp, pulse } from '../../engine/util';
import { HEX } from '../../engine/palette';
import { MODES } from './nodal';
import { STEP_TIMES, PLATE_HALF } from './grains';

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

export class DriveRig {
  readonly group = new THREE.Group();
  private display: THREE.Mesh;
  private displayCanvas = document.createElement('canvas');
  private displayTex: THREE.CanvasTexture;
  private led: THREE.Mesh;
  private ledMat: THREE.MeshStandardMaterial;
  private lastDrawKey = -1;

  constructor() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.38, metalness: 0.85 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.55, metalness: 0.7 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 0.35, metalness: 0.9 });
    const edge = new THREE.LineBasicMaterial({ color: new THREE.Color(HEX.bone), transparent: true, opacity: 0.22 });
    const addEdges = (m: THREE.Mesh) => m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), edge));

    // Machined base slab + feet
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.024, 0.56), darkSteel);
    base.position.y = -0.052;
    addEdges(base);
    this.group.add(base);

    // Driver column + clamp ring under plate centre
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.038, 24), steel);
    column.position.y = -0.021;
    this.group.add(column);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 24), brass);
    collar.position.y = -0.004;
    this.group.add(collar);

    // The plate: brushed steel square, centre-clamped
    const plate = new THREE.Mesh(new THREE.BoxGeometry(PLATE_HALF * 2, 0.004, PLATE_HALF * 2), steel);
    plate.position.y = 0.002;
    addEdges(plate);
    this.group.add(plate);
    const clampPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.007, 16), brass);
    clampPin.position.y = 0.006;
    this.group.add(clampPin);

    // Overhead lamp housing — justifies the spotlight
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.34), darkSteel);
    arm.position.set(0.0, 0.42, -0.17);
    this.group.add(arm);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.05, 24, 1, true), darkSteel);
    hood.position.set(0.0, 0.42, 0.0);
    this.group.add(hood);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(HEX.bone), emissiveIntensity: 2.2 }),
    );
    bulb.position.set(0.0, 0.40, 0.0);
    this.group.add(bulb);

    // Diegetic mode readout: small angled display on the front edge of the base
    this.displayCanvas.width = 512;
    this.displayCanvas.height = 192;
    this.displayTex = new THREE.CanvasTexture(this.displayCanvas);
    this.displayTex.colorSpace = THREE.SRGBColorSpace;
    this.displayTex.minFilter = THREE.LinearFilter;
    this.displayTex.generateMipmaps = false;
    const dispMat = new THREE.MeshBasicMaterial({ map: this.displayTex });
    this.display = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.0412), dispMat);
    this.display.position.set(0, -0.028, 0.2815);
    this.display.rotation.x = -0.12;
    this.group.add(this.display);

    // Status LED — emissive set in code (glTF exporter drops zero-strength emission)
    this.ledMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      emissive: new THREE.Color(HEX.bone),
      emissiveIntensity: 0.5,
    });
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 10), this.ledMat);
    this.led.position.set(0.072, -0.024, 0.2815);
    this.group.add(this.led);
  }

  /** Displayed frequency value at t: rolls/scrambles for 0.9s after a step. */
  freqShownAt(t: number): { mode: number; digits: string; rolling: boolean } {
    const k = modeIndexAt(t);
    if (k < 0) return { mode: -1, digits: '----', rolling: false };
    const stepT = STEP_TIMES[k]!;
    const roll = clamp((t - stepT) / 0.9);
    if (roll >= 1) return { mode: k, digits: `${MODES[k]!.freq}`, rolling: false };
    // Digits scramble while rolling, biased toward the target value as u -> 1.
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

    // LED: bone idle shimmer -> --signal flare at each step
    const col = rp > 0.25 ? new THREE.Color(HEX.signal) : new THREE.Color(HEX.bone);
    this.ledMat.emissive.copy(col);
    this.ledMat.emissiveIntensity = 0.5 + rp * 2.5;

    // Redraw the display only when its content changed (per-frame while rolling).
    const key = k * 1000 + (shown.rolling ? frameIdx(t) : 0) + (t < 3.5 ? 0 : 1);
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

    g.fillStyle = rp > 0.25 ? HEX.signal : HEX.bone;
    g.font = '800 84px Archivo, sans-serif';
    g.fillText(k < 0 ? '---- HZ' : `${shown.digits} HZ`, 26, 152);
    this.displayTex.needsUpdate = true;
  }
}

/** Camera choreography for the whole scene — one unbroken CCW orbit, closed-form. */
export function cameraAt(t: number): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
  // Beat windows on the orbit
  let theta: number, radius: number, height: number, fov: number;
  let tx = 0, ty = 0.008, tz = 0;

  if (t < 3.5) {
    const u = clamp(t / 3.5);
    theta = lerp(0.55, 0.78, u);
    radius = lerp(0.55, 0.46, u);
    height = lerp(0.32, 0.27, u);
    fov = 36;
  } else if (t < 9.0) {
    const u = clamp((t - 3.5) / 5.5);
    const e = u * u * (3 - 2 * u);
    theta = lerp(0.78, 1.18, e);
    radius = lerp(0.46, 0.30, e);
    height = lerp(0.27, 0.11, e);
    fov = lerp(36, 48, e);
  } else if (t < 15.0) {
    const u = clamp((t - 9.0) / 6.0);
    const e = u * u * (3 - 2 * u);
    theta = lerp(1.18, 1.5, e);
    radius = lerp(0.30, 0.17, e);
    height = lerp(0.11, 0.05, e);
    fov = lerp(48, 55, e);
    // Macro: gaze slides to a nodal-line region off-centre
    tx = lerp(0, 0.045, e);
    tz = lerp(0, 0.035, e);
  } else {
    const u = clamp((t - 15.0) / 7.5);
    const e = u * u * u * (u * (u * 6 - 15) + 10);
    theta = lerp(1.5, 1.72, e);
    radius = lerp(0.17, 0.52, e);
    height = lerp(0.05, 0.44, e);
    fov = lerp(55, 40, e);
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

// a6_critique (bars 37-52): "i don't like it." The review wall holds the real v1 stills of this film. A red marker
// lassos the real flaws I found in them and writes the note; on "check it" the one still that passed gets a green
// tick. A strip-chart recorder on the desk inks the song's loudness live (the telemetry, as an object). The camera ends
// on the blown-out A4 still that A7 rewrites (exit: agp_rewind).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { release, C, BEAT, bar, model, part, present, sceneTime, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, barOf, spin, rmsAt, FACTS, type CamKey } from './kit';
import { markTextureCanvas } from '../../engine/bridge';
import { makePrint, loadPrints, wallSlot, WALL_Z, PW, PH } from './a5_print';

/** The notes are the real v1 review notes (REVIEW.md, round 0). u,v = lasso centre on the still, r = radius. */
export const NOTES: { i: number; u: number; v: number; r: number; text: string; t: number }[] = [
  { i: 1, u: 0.5, v: 0.42, r: 0.3, text: 'blown out. no holes?', t: bar(39) },
  { i: 5, u: 0.42, v: 0.42, r: 0.26, text: 'white-out', t: bar(40.5) },
  { i: 3, u: 0.26, v: 0.38, r: 0.2, text: 'lamp hotspot', t: bar(42) },
  { i: 0, u: 0.3, v: 0.64, r: 0.12, text: 'glow detached', t: bar(43.5) },
  { i: 4, u: 0.5, v: 0.5, r: 0.32, text: 'drones too small', t: bar(45) },
  { i: 6, u: 0.5, v: 0.5, r: 0.36, text: '+2 stops', t: bar(46.5) },
  { i: 7, u: 0.22, v: 0.5, r: 0.2, text: 'flat', t: bar(48) },
];
const APPROVED = 2, T_CHECK = 75.08 + 5 * BEAT, STROKE = 0.9;
const CAM: [number, CamKey][] = [
  [36.8, { pos: [0, 2.15, 1.6], tgt: [0, 2.15, -3.5], fov: 36 }],
  [38.5, { pos: [-0.8, 2.6, 0.9], tgt: [-0.9, 2.6, -3.5], fov: 34 }],
  [44, { pos: [1.0, 2.2, 1.5], tgt: [0.2, 2.1, -3.5], fov: 36 }],
  [49.5, { pos: [3.6, 1.6, 3.4], tgt: [0.8, 1.4, -3.0], fov: 38 }],
  [52.9, { pos: [0.9, 1.6, -1.6], tgt: [0.9, 1.6, -3.5], fov: 34 }],
];

export default class A6Critique extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private prints: THREE.Group[] = []; private ink: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture }[] = [];
  private marker!: THREE.Object3D; private texs: THREE.Texture[] = [];
  private pen!: THREE.Object3D; private penQ = new THREE.Quaternion(); private strip!: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture };

  override async init() {
    enableShadows(this.ctx);
    const wall = await model(this.ctx, 'cork_wall'); shadows(wall.root); wall.root.position.z = WALL_Z; this.scene.add(wall.root);
    for (const n of ['pin_head', 'pin_needle', 'lamp_shade', 'lamp_arm']) part(wall, n).visible = false;
    this.texs = await loadPrints();
    for (let i = 0; i < 8; i++) {
      const p = makePrint(this.texs[i % this.texs.length]!); p.position.copy(wallSlot(i)); p.rotation.z = 0.04 * Math.sin(i * 2.3);
      const cv = markTextureCanvas(document.createElement('canvas')); cv.width = 512; cv.height = 288;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const ov = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, depthWrite: false }));
      ov.position.set(0, 0.03, 0.006); p.add(ov);
      this.prints.push(p); this.ink.push({ cv, tex }); this.scene.add(p);
    }
    const mk = await model(this.ctx, 'marker'); shadows(mk.root); mk.root.scale.setScalar(0.32); this.marker = mk.root; this.scene.add(mk.root);
    const sc = await model(this.ctx, 'strip_chart'); shadows(sc.root); sc.root.position.set(2.5, 0, -1.7); sc.root.rotation.y = -0.35; this.scene.add(sc.root);
    this.pen = part(sc, 'pen_pivot'); this.penQ.copy(this.pen.quaternion);
    const cv = markTextureCanvas(document.createElement('canvas')); cv.width = 256; cv.height = 512;
    this.strip = { cv, tex: new THREE.CanvasTexture(cv) }; this.strip.tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.62), new THREE.MeshStandardMaterial({ map: this.strip.tex, roughness: 0.8 }));
    sp.position.set(0, 0.64, 0.13); sp.rotation.x = -Math.PI / 2 + 0.45; sp.receiveShadow = true; sc.root.add(sp);
    const L = heroLights(this.scene, 0xffe2c0, 0x9cc9e8, 1.1, 1.0, 0.18); L.key.position.set(2, 6, 3); L.rim.position.set(-5, 3, -7);
    Object.assign(L.key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); L.key.shadow.camera.updateProjectionMatrix();
    const spot = new THREE.SpotLight(0xffc890, 16, 14, 0.75, 0.6, 1.5); spot.position.set(-1.2, 5.4, WALL_Z + 2.8); spot.target.position.set(0, 2.1, WALL_Z);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); this.scene.add(spot, spot.target);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.background = new THREE.Color(0x08090c); this.scene.fog = new THREE.Fog(0x08090c, 9, 22);
  }

  /** Point on note k's path at local time lt: the lasso, then the handwriting baseline. Returns canvas px. */
  private notePoint(k: number, lt: number): [number, number] {
    const n = NOTES[k]!, cx = n.u * 512, cy = n.v * 288, rx = n.r * 290, ry = n.r * 260;
    if (lt <= STROKE) { const s = clamp(lt / STROKE), a = -2.2 + s * Math.PI * 2.25, w = 1 + 0.07 * Math.sin(a * 3 + k); return [cx + Math.cos(a) * rx * w, cy + Math.sin(a) * ry * w]; }
    const [tx, ty] = this.textAt(k); return [tx + clamp((lt - STROKE) / 0.6) * n.text.length * 15, ty];
  }
  private textAt(k: number): [number, number] {
    const n = NOTES[k]!; return [clamp(n.u * 512 - n.r * 200, 12, 512 - n.text.length * 15 - 12), clamp(n.v * 288 + n.r * 260 + 34, 30, 278)];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    for (let i = 0; i < 8; i++) {
      const { cv, tex } = this.ink[i]!, g = cv.getContext('2d')!;
      g.clearRect(0, 0, 512, 288); g.lineCap = g.lineJoin = 'round';
      NOTES.forEach((n, k) => {
        if (n.i !== i || T < n.t) return;
        const lt = T - n.t; g.strokeStyle = '#D9262B'; g.lineWidth = 7; g.beginPath();
        for (let s = 0; s <= 64; s++) { const p = this.notePoint(k, Math.min(lt, STROKE) * (s / 64)); s ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        g.stroke();
        const ch = Math.floor(clamp((lt - STROKE) / 0.6) * n.text.length);
        if (ch > 0) { const [tx, ty] = this.textAt(k); g.font = font(F.archivo(100, 800), 30); g.lineWidth = 6; g.strokeStyle = 'rgba(239,232,218,0.85)'; g.strokeText(n.text.slice(0, ch), tx, ty); g.fillStyle = '#D9262B'; g.fillText(n.text.slice(0, ch), tx, ty); }
      });
      if (i === APPROVED && T > T_CHECK) {
        const s = prog(T, T_CHECK, T_CHECK + 0.25, ease.outCubic); g.strokeStyle = '#2FBF71'; g.lineWidth = 14; g.beginPath();
        g.moveTo(330, 160); const m = clamp(s * 2); g.lineTo(330 + 40 * m, 160 + 40 * m);
        if (s > 0.5) { const e = (s - 0.5) * 2; g.lineTo(370 + 90 * e, 200 - 120 * e); }
        g.stroke();
      }
      tex.needsUpdate = true;
    }
    // Marker: on the active stroke, else travelling between the end of one note and the start of the next.
    let k = -1; for (let j = 0; j < NOTES.length; j++) if (T >= NOTES[j]!.t) k = j;
    const world = (j: number, lt: number) => { const p = this.notePoint(j, lt), pr = this.prints[NOTES[j]!.i]!; pr.updateMatrixWorld(); return pr.localToWorld(new THREE.Vector3((p[0] / 512 - 0.5) * PW, (0.5 - p[1] / 288) * PH + 0.03, 0.03)); };
    let tip: THREE.Vector3, lift = 0;
    if (k < 0) { tip = world(0, 0).add(new THREE.Vector3(0.6, -0.5, 0.6)); lift = 1; }
    else {
      const lt = T - NOTES[k]!.t, end = STROKE + 0.6;
      if (lt <= end) tip = world(k, lt);
      else {
        const nx = k + 1 < NOTES.length ? NOTES[k + 1]!.t : bar(52), u = ease.inOutCubic(clamp((T - NOTES[k]!.t - end) / Math.max(0.01, nx - NOTES[k]!.t - end)));
        const a = world(k, end), c = k + 1 < NOTES.length ? world(k + 1, 0) : a.clone().add(new THREE.Vector3(0.4, -1.4, 1.2));
        lift = Math.sin(u * Math.PI); tip = a.lerp(c, u); tip.z += 0.25 * lift;
      }
    }
    this.marker.position.copy(tip); this.marker.rotation.set(1.05 + 0.25 * lift, 0, -0.35 + 0.05 * Math.sin(T * 3));
    // Strip chart: the paper scrolls toward the viewer; row j is the song's loudness j/60 s ago.
    const sg = this.strip.cv.getContext('2d')!, dt = 1 / 60;
    sg.fillStyle = '#EFE8DA'; sg.fillRect(0, 0, 256, 512); sg.strokeStyle = 'rgba(60,110,140,0.35)'; sg.lineWidth = 1;
    for (let x = 16; x < 256; x += 28) { sg.beginPath(); sg.moveTo(x, 0); sg.lineTo(x, 512); sg.stroke(); }
    for (let q = Math.floor(T / 0.5); q > Math.floor(T / 0.5) - 20; q--) { const row = (T - q * 0.5) / dt; sg.beginPath(); sg.moveTo(0, row); sg.lineTo(256, row); sg.stroke(); }
    const px = (tt: number) => 20 + clamp(rmsAt(tt)) * 216;
    sg.strokeStyle = '#D9262B'; sg.lineWidth = 2.5; sg.beginPath();
    for (let j = 0; j < 512; j += 2) { const x = px(T - j * dt); j ? sg.lineTo(x, j) : sg.moveTo(x, j); }
    sg.stroke(); this.strip.tex.needsUpdate = true;
    spin(this.pen, this.penQ, Math.asin(clamp((px(T) / 256 - 0.5) * 1.2 / 0.47, -0.95, 0.95)));
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, "i don't like it.", 150, 900, T, bar(37.5), { size: 42, cps: 20, color: C.bone, t1: bar(41.5) });
    typeLine(g, `${FACTS.v1Notes} notes. ${FACTS.v1Passed} pass.`, 150, 900, T, bar(49), { size: 42, cps: 20, color: C.signal, t1: bar(52.3) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x08090c, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0, bloom: 0.45, bloomThreshold: 0.9, vignette: 0.5, grain: 0.04 };
  }
  override dispose() { release(this.scene); this.layer.texture.dispose(); for (const t of this.texs) t.dispose(); for (const i of this.ink) i.tex.dispose(); this.strip.tex.dispose(); }
}

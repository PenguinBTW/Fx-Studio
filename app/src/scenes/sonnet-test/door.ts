// The door-edge assembly (Beat 0, and the Beat 4 return): brushed-metal strip, rubber seal and
// the child-lock slider in its slot. All geometry and shading is procedural.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, ease, prog } from '../../engine/util';
import { litMaterial } from './materials';
import { GLOW } from './palette';
import { SLOT_HALF_LEN, SLOT_HALF_W, KNOB_X0, KNOB_TRAVEL, KNOB_HALF, MARKERS, knobCurve } from './timing';

const SLOT_DEPTH = 0.006;
const KNOB_H = 0.0036;

function slotPlate(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const W2 = 0.08, H2 = 0.05;
  shape.moveTo(-W2, -H2); shape.lineTo(W2, -H2); shape.lineTo(W2, H2); shape.lineTo(-W2, H2); shape.closePath();
  const hole = new THREE.Path();
  const L = SLOT_HALF_LEN, w = SLOT_HALF_W;
  hole.absarc(L - w, 0, w, -Math.PI / 2, Math.PI / 2, false);
  hole.absarc(-L + w, 0, w, Math.PI / 2, Math.PI * 1.5, false);
  hole.closePath();
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.0006, bevelThickness: 0.0006, curveSegments: 18 });
  g.translate(0, 0, -0.004);
  return g;
}

function roundedBar(hx: number, hy: number, r: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hy); s.lineTo(hx - r, -hy); s.absarc(hx - r, -hy + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hx, hy - r); s.absarc(hx - r, hy - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hx + r, hy); s.absarc(-hx + r, hy - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hx, -hy + r); s.absarc(-hx + r, -hy + r, r, Math.PI, Math.PI * 1.5, false);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.0003, bevelThickness: 0.0003, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export class DoorEdge {
  group = new THREE.Group();
  private metal = litMaterial({ base: 0.62, brushed: 1, metal: 0.9 });
  private knobMat = litMaterial({ base: 0.7, brushed: 0.35, ridge: 1, ridgeF: 1400, metal: 0.8 });
  private rubber = litMaterial({ base: 0.07, brushed: 0, metal: 0.05 });
  private floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.004, 0.004, 0.005) });
  private sliver = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(...GLOW.signal).multiplyScalar(0.45) }));
  private knob: THREE.Mesh;

  constructor() {
    const plate = new THREE.Mesh(slotPlate(), this.metal);
    this.group.add(plate);

    // slot cavity floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SLOT_HALF_LEN * 2 + 0.002, SLOT_HALF_W * 2 + 0.002), this.floorMat);
    floor.position.z = -SLOT_DEPTH;
    this.group.add(floor);

    // slot side walls (dark rubber lining)
    const wallG = new THREE.BoxGeometry(SLOT_HALF_LEN * 2 - 0.004, 0.0004, SLOT_DEPTH);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(wallG, this.rubber);
      wall.position.set(0, s * (SLOT_HALF_W - 0.0002), -SLOT_DEPTH / 2);
      this.group.add(wall);
    }

    // thin red sliver on the slot floor, revealed behind the knob
    this.sliver.position.z = -SLOT_DEPTH + 0.0002;
    this.group.add(this.sliver);

    // knob: rounded block whose top is ridged by the shader's sine normal displacement
    this.knob = new THREE.Mesh(roundedBar(KNOB_HALF, SLOT_HALF_W - 0.0007, 0.0014, KNOB_H), this.knobMat);
    this.knob.position.z = -0.0006;
    this.group.add(this.knob);

    // rubber weatherstrip with a compression bevel, running along the lower door edge
    const seal = new THREE.Shape();
    seal.moveTo(0, 0); seal.lineTo(0.0125, 0); seal.quadraticCurveTo(0.0148, 0.0012, 0.0128, 0.0042);
    seal.quadraticCurveTo(0.0095, 0.0086, 0.0035, 0.0078); seal.quadraticCurveTo(0.0008, 0.0062, 0, 0.0);
    const sealG = new THREE.ExtrudeGeometry(seal, { depth: 0.16, bevelEnabled: false, curveSegments: 12 });
    sealG.translate(0, 0, -0.08);
    const sealM = new THREE.Mesh(sealG, this.rubber);
    sealM.rotation.set(0, Math.PI / 2, 0);
    sealM.position.set(0, -0.0245, -0.0016);
    sealM.scale.set(1, -1, 1);
    this.group.add(sealM);

    // folded hem lip below the slot
    const hem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.0022, 0.0066), this.metal);
    hem.position.set(0, -0.0225, -0.0004);
    this.group.add(hem);
  }

  get knobCenterX(): number { return this.knob.position.x; }

  /** Pose the assembly at time t. `pos` overrides the knob travel fraction (Beat 4 holds it at 0.5). */
  update(t: number, pos?: number): { knobX: number; redLeft: number; redRight: number } {
    const key = clamp(smoothstep(0, 3.0, t) * 1.0);
    const sweep = lerp(-0.06, 0.055, ease.inOutCubic(prog(t, 0.3, 3.2)));
    const rim = smoothstep(0.5, 3.5, t) * 0.55;
    for (const m of [this.metal, this.knobMat, this.rubber]) {
      m.uniforms.uKey!.value = pos === undefined ? key : 1;
      m.uniforms.uSweep!.value = pos === undefined ? sweep : 0.02;
      m.uniforms.uRim!.value = pos === undefined ? rim : 0.55;
    }
    const k = pos ?? knobCurve(t);
    const x = KNOB_X0 + KNOB_TRAVEL * k;
    this.knob.position.x = x;
    const left = x - KNOB_HALF;
    const rl = -SLOT_HALF_LEN + 0.0006, rr = Math.max(rl + 1e-5, left + 0.0004);
    this.sliver.scale.set(rr - rl, 0.0007, 1);
    this.sliver.position.x = (rl + rr) / 2;
    this.sliver.visible = rr - rl > 2e-5 && k > 0.01;
    return { knobX: x, redLeft: rl, redRight: rr };
  }
}

export { MARKERS };

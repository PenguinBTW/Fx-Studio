// The traveller: a procedural iridescent swallow (forward +z, up +y, wings along x).
// Pose is a pure function of (t, flap phase, amplitude, fold) supplied by the path.
import * as THREE from 'three';

function shapeGeo(pts: [number, number][]): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(-x, y)));
  const g = new THREE.ShapeGeometry(s, 6);
  g.rotateX(Math.PI / 2); // shape +y -> +z (forward)
  g.scale(-1, 1, 1); // undo the x pre-flip; keeps normals facing +y
  g.computeVertexNormals();
  return g;
}

function paint(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3, c: THREE.Color) => void) {
  const pos = g.attributes.position as THREE.BufferAttribute, nrm = g.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3), p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i); fn(p, n, c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export class Bird {
  group = new THREE.Group();
  private body = new THREE.Group();
  private shoulders: THREE.Group[] = [];
  private wrists: THREE.Group[] = [];
  private tips: THREE.Object3D[] = [];
  private tail!: THREE.Mesh;
  private head = new THREE.Group();
  mats: THREE.MeshPhysicalMaterial[] = [];
  eyeMat: THREE.MeshStandardMaterial;

  constructor(scale = 1) {
    const ink = new THREE.Color('#141a33'), belly = new THREE.Color('#efe3c8'), throat = new THREE.Color('#b3482a');
    const feather = new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.36, metalness: 0.05, side: THREE.DoubleSide,
      iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [250, 650],
      sheen: 0.6, sheenColor: new THREE.Color('#5a78ff'), sheenRoughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.4,
    });
    this.mats.push(feather);

    // body (lathe along y, rotated onto z)
    const prof: [number, number][] = [[0, -0.30], [0.028, -0.27], [0.055, -0.17], [0.078, -0.03], [0.08, 0.07], [0.07, 0.15], [0.062, 0.21], [0.045, 0.27], [0.02, 0.305], [0, 0.315]];
    const bg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
    bg.rotateX(Math.PI / 2); bg.scale(1, 0.86, 1); bg.computeVertexNormals();
    paint(bg, (p, n, c) => {
      const under = THREE.MathUtils.smoothstep(-n.y, 0.05, 0.55);
      c.copy(ink).lerp(belly, under);
      if (p.z > 0.17 && n.y < 0.35) c.lerp(throat, THREE.MathUtils.smoothstep(p.z, 0.17, 0.23) * 0.9);
    });
    const bodyMesh = new THREE.Mesh(bg, feather);
    this.body.add(bodyMesh);

    // beak + eyes
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.4 }));
    beak.position.set(0, -0.004, 0.335);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.05, emissive: new THREE.Color('#000000') });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 8), this.eyeMat);
      e.position.set(s * 0.037, 0.018, 0.255); this.head.add(e);
    }
    this.head.add(beak);
    this.body.add(this.head);

    // forked tail
    const tg = shapeGeo([[0, 0.02], [0.05, 0.0], [0.085, -0.12], [0.12, -0.36], [0.075, -0.2], [0.03, -0.13], [0, -0.12], [-0.03, -0.13], [-0.075, -0.2], [-0.12, -0.36], [-0.085, -0.12], [-0.05, 0]]);
    paint(tg, (p, _n, c) => c.copy(ink).lerp(new THREE.Color('#2b3566'), THREE.MathUtils.smoothstep(-p.z, 0.1, 0.35) * 0.5));
    this.tail = new THREE.Mesh(tg, feather);
    this.tail.position.set(0, 0.005, -0.25);
    this.body.add(this.tail);

    // wings
    const arm = shapeGeo([[0, 0.075], [0.16, 0.085], [0.31, 0.06], [0.31, -0.07], [0.2, -0.1], [0.1, -0.12], [0, -0.1]]);
    const hp: [number, number][] = [[0, 0.06], [0.2, 0.03], [0.36, -0.06], [0.5, -0.16]];
    hp.push([0.47, -0.185], [0.4, -0.19], [0.3, -0.17], [0.18, -0.135], [0.08, -0.105]);
    hp.push([0, -0.07]);
    const hand = shapeGeo(hp);
    const wingPaint = (g: THREE.BufferGeometry, off: number) => paint(g, (p, _n, c) => c.copy(ink).lerp(new THREE.Color('#33427a'), THREE.MathUtils.smoothstep(p.x + off, 0.2, 0.8) * 0.45));
    wingPaint(arm, 0); wingPaint(hand, 0.31);
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(0.045 * s, 0.03, 0.06); sh.scale.x = s;
      sh.add(new THREE.Mesh(arm, feather));
      const wr = new THREE.Group(); wr.position.set(0.305, 0, 0); sh.add(wr);
      wr.add(new THREE.Mesh(hand, feather));
      const tip = new THREE.Object3D(); tip.position.set(0.5, 0, -0.16); wr.add(tip);
      this.body.add(sh); this.shoulders.push(sh); this.wrists.push(wr); this.tips.push(tip);
    }
    this.group.add(this.body);
    this.group.scale.setScalar(scale);
    this.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }

  /** phase: flap phase (rad); amp: 0 glide .. 1 full flap; fold: 0 open .. 1 tucked (dive). */
  pose(t: number, phase: number, amp: number, fold: number) {
    const s = Math.sin(phase), c = Math.cos(phase);
    const A = 0.95 * amp;
    for (let i = 0; i < 2; i++) {
      const sh = this.shoulders[i]!, wr = this.wrists[i]!;
      const glideFlex = 0.06 * Math.sin(t * 1.3 + i);
      sh.rotation.set(0, 0, 0);
      const m = sh.scale.x; // mirrored shoulder: z/y rotations flip sign so both wings beat together
      sh.rotation.z = m * (A * s + 0.12 * (1 - amp) + glideFlex - fold * 0.25);
      sh.rotation.y = -m * (0.25 * amp * (0.5 + 0.5 * c) + fold * 0.9);
      sh.rotation.x = -0.12 * amp * c;
      wr.rotation.z = A * 0.55 * Math.sin(phase - 0.9) - 0.05 * (1 - amp) + fold * 0.2;
      wr.rotation.y = -(0.45 * amp * Math.max(0, c) + fold * 1.3 - 0.05);
    }
    this.body.position.y = -0.025 * amp * s;
    this.body.rotation.x = 0.04 * amp * c;
    this.tail.rotation.x = -0.08 * amp * Math.sin(phase + 1.2);
    this.tail.scale.x = 1 - 0.35 * fold + 0.15 * (1 - amp);
    this.head.rotation.x = -0.03 * amp * c;
  }

  wingtips(out: [THREE.Vector3, THREE.Vector3]) {
    this.group.updateMatrixWorld(true);
    this.tips[0]!.getWorldPosition(out[0]); this.tips[1]!.getWorldPosition(out[1]);
  }
}

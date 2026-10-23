// SCENE 1: BLUEPRINT STUDY (0.0s - 5.0s)
// Fine architectural technical line art, technical drafting aesthetic.
// High-density procedural wireframes, measurement ticks, architectural schematics.
// Strictly Closed-Form Frame = f(t), Zero State Leaks

import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { buildDetailedRoomProps, type PropDef } from './room_assets';

export default class BlueprintStudy extends Scene {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private lineGroup = new THREE.Group();
  private annotGroup = new THREE.Group();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const { W, H } = ctx;
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 50);

    // Deep architectural blueprint background
    this.scene.background = new THREE.Color(0x040814);

    // Line Materials
    const baseLineMat = new THREE.LineBasicMaterial({
      color: 0x3b82f6, // Royal architectural cyan
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const heroLineMat = new THREE.LineBasicMaterial({
      color: 0x93c5fd, // Luminous drafting white-cyan
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const faintLineMat = new THREE.LineBasicMaterial({
      color: 0x1d4ed8, // Deep blueprint indigo
      transparent: true,
      opacity: 0.45,
    });

    // 1. Convert all Detailed Room Props into Precise Line Wireframes
    const props = buildDetailedRoomProps();
    for (const p of props) {
      let geom: THREE.BufferGeometry;

      if (p.geomType === 'box') {
        const [w, h, d] = p.geomParams;
        geom = new THREE.BoxGeometry(w, h, d);
      } else if (p.geomType === 'cylinder') {
        const [rt, rb, h, segs] = p.geomParams;
        geom = new THREE.CylinderGeometry(rt, rb, h, segs || 12);
      } else if (p.geomType === 'cone') {
        const [r, h, segs] = p.geomParams;
        geom = new THREE.ConeGeometry(r, h, segs || 16);
      } else if (p.geomType === 'sphere') {
        const [r, wSegs, hSegs] = p.geomParams;
        geom = new THREE.SphereGeometry(r, wSegs || 12, hSegs || 12);
      } else if (p.geomType === 'torus') {
        const [r, tube, radSegs, tubSegs] = p.geomParams;
        geom = new THREE.TorusGeometry(r, tube, radSegs || 8, tubSegs || 24);
      } else {
        geom = new THREE.BoxGeometry(1, 1, 1);
      }

      const edges = new THREE.EdgesGeometry(geom);
      const isHero = p.category === 'tool' || p.category === 'lamp' || p.id === 'desk_mat' || p.id === 'model_pavilion_base';
      const wire = new THREE.LineSegments(edges, isHero ? heroLineMat : baseLineMat);
      wire.position.copy(p.pos);
      wire.rotation.copy(p.rot);
      wire.scale.copy(p.scale);
      this.lineGroup.add(wire);
    }

    // 2. Parquet Floor Grid (Fine technical grid across the floor)
    const gridPts: number[] = [];
    const gridSize = 6.4, gridStep = 0.4;
    for (let x = -gridSize / 2; x <= gridSize / 2; x += gridStep) {
      gridPts.push(x, 0.005, -gridSize / 2, x, 0.005, gridSize / 2);
    }
    for (let z = -gridSize / 2; z <= gridSize / 2; z += gridStep) {
      gridPts.push(-gridSize / 2, 0.005, z, gridSize / 2, 0.005, z);
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
    const floorGrid = new THREE.LineSegments(gridGeo, faintLineMat);
    this.lineGroup.add(floorGrid);

    // 3. Drafting Mat Grid on Desk (10mm technical millimeter grid)
    const matPts: number[] = [];
    const mW = 1.05, mH = 0.7;
    for (let x = -mW / 2; x <= mW / 2; x += 0.05) {
      matPts.push(x, 0.002, -mH / 2, x, 0.002, mH / 2);
    }
    for (let y = -mH / 2; y <= mH / 2; y += 0.05) {
      matPts.push(-mW / 2, 0.002, y, mW / 2, 0.002, y);
    }
    const matGeo = new THREE.BufferGeometry();
    matGeo.setAttribute('position', new THREE.Float32BufferAttribute(matPts, 3));
    const deskGrid = new THREE.LineSegments(matGeo, faintLineMat);
    deskGrid.position.set(-0.05, 0.812, -0.02);
    deskGrid.rotation.set(0.08, 0, 0);
    this.lineGroup.add(deskGrid);

    // 4. Geodesic Dome Study Model on Shelf 2
    const domeGeo = new THREE.IcosahedronGeometry(0.24, 2);
    const domeEdges = new THREE.EdgesGeometry(domeGeo);
    const domeWire = new THREE.LineSegments(domeEdges, heroLineMat);
    domeWire.position.set(1.35 - 0.32, 1.58 + 0.24, -1.15);
    domeWire.rotation.set(0, -0.22, 0);
    this.lineGroup.add(domeWire);

    // 5. Hero Crimson Book Wireframe (Embossed spine ribs, gilded edge block)
    const heroStartPos = new THREE.Vector3(0.96, 1.62, -0.96);
    const heroBookBox = new THREE.BoxGeometry(0.095, 0.34, 0.26);
    const heroWire = new THREE.LineSegments(new THREE.EdgesGeometry(heroBookBox), heroLineMat);
    heroWire.position.copy(heroStartPos);
    heroWire.rotation.set(0, 0.22, 0);
    this.lineGroup.add(heroWire);

    // 6. Arched Studio Window Mullions & City Wireframe Outside
    const winPts: number[] = [];
    const wW = 1.64, wH = 2.74;
    // Horizontal bars
    for (let r = 1; r <= 5; r++) {
      const y = -wH / 2 + (r * wH) / 6;
      winPts.push(-wW / 2, y, 0, wW / 2, y, 0);
    }
    // Vertical bars
    for (let c = 1; c <= 2; c++) {
      const x = -wW / 2 + (c * wW) / 3;
      winPts.push(x, -wH / 2, 0, x, wH / 2, 0);
    }
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute('position', new THREE.Float32BufferAttribute(winPts, 3));
    const winLines = new THREE.LineSegments(winGeo, baseLineMat);
    winLines.position.set(-1.8, 2.2, -2.71);
    this.lineGroup.add(winLines);

    // Distant City Skyline Wireframe outside the window
    const cityPts: number[] = [];
    const buildingXs = [-2.8, -2.4, -2.0, -1.6, -1.2, -0.8];
    buildingXs.forEach((bx, bIdx) => {
      const bHeight = 1.2 + (bIdx % 3) * 0.5;
      const bWidth = 0.35;
      cityPts.push(
        bx - bWidth / 2, 0, -3.8, bx - bWidth / 2, bHeight, -3.8,
        bx - bWidth / 2, bHeight, -3.8, bx + bWidth / 2, bHeight, -3.8,
        bx + bWidth / 2, bHeight, -3.8, bx + bWidth / 2, 0, -3.8
      );
    });
    const cityGeo = new THREE.BufferGeometry();
    cityGeo.setAttribute('position', new THREE.Float32BufferAttribute(cityPts, 3));
    const cityWire = new THREE.LineSegments(cityGeo, faintLineMat);
    this.lineGroup.add(cityWire);

    // 7. Architectural Callouts & Measurement Vectors
    const annotPts: number[] = [];
    // Desk width dimension witness line
    annotPts.push(-0.95, 0.88, 0.58, 0.95, 0.88, 0.58);
    annotPts.push(-0.95, 0.85, 0.58, -0.95, 0.91, 0.58);
    annotPts.push(0.95, 0.85, 0.58, 0.95, 0.91, 0.58);
    // Shelf height witness line
    annotPts.push(2.05, 0.36, -1.15, 2.05, 2.68, -1.15);
    annotPts.push(2.02, 0.36, -1.15, 2.08, 0.36, -1.15);
    annotPts.push(2.02, 2.68, -1.15, 2.08, 2.68, -1.15);

    const annotGeo = new THREE.BufferGeometry();
    annotGeo.setAttribute('position', new THREE.Float32BufferAttribute(annotPts, 3));
    const annotLines = new THREE.LineSegments(annotGeo, heroLineMat);
    this.annotGroup.add(annotLines);

    this.scene.add(this.lineGroup);
    this.scene.add(this.annotGroup);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { t } = f;

    // Cinematic Camera Choreography:
    // Starts low tracking across the desk instruments, sweeps past the T-square,
    // and cranes upward revealing the drafting lamp, window, and full bookcase.
    const u = Math.min(1.0, Math.max(0.0, t / 4.8));
    // Smooth C1 trajectory
    const camPos = new THREE.Vector3(
      THREE.MathUtils.lerp(-0.45, 0.35, u) + Math.sin(u * Math.PI) * 0.18,
      THREE.MathUtils.lerp(0.92, 1.48, u * u),
      THREE.MathUtils.lerp(0.72, 1.55, u)
    );
    const lookTarget = new THREE.Vector3(
      THREE.MathUtils.lerp(-0.05, 0.45, u),
      THREE.MathUtils.lerp(0.82, 1.35, u),
      THREE.MathUtils.lerp(0.05, -0.65, u)
    );

    this.camera.position.copy(camPos);
    this.camera.lookAt(lookTarget);

    // Subtle breathing pulse in drafting lines
    const pulse = 0.92 + 0.08 * Math.sin(t * 2.5);
    this.lineGroup.scale.set(1.0, pulse, 1.0);

    this.ctx.renderer.setRenderTarget(out);
    this.ctx.renderer.clear();
    this.ctx.renderer.render(this.scene, this.camera);

    return {
      exposure: 1.15,
      bloom: 0.35,
      bloomRadius: 0.45,
      vignette: 0.38,
      grain: 0.06,
    };
  }
}

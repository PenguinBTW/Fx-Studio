// =============================================================================
// BEAT 1: THE HANDLE THAT STILL WORKS (8.0s - 20.0s) & BEAT 2: ABSTRACTION (20.0s - 30.0s)
//
// Procedural stylized door interior engineering cross-section:
// - Ergonomic handle lever with cylindrical pivot bushing and return spring
// - Precision connecting rod resting in machined guide brackets
// - Pivoting pawl rotated away out of engagement (the physical disconnect)
// - Fixed latch block with catch notch
// - Real geometric wireframe edge lines on all solid parts for CAD blueprint look
// - Faint CAD architectural wireframe door structure for context
// - 3 pulls at t = 10.0s, 12.2s, 13.8s with rod stroke, traveling pulse, red flare & sparks
// - World-space noise dissolve front sweeping from latch to handle at t = 20.0s - 27.0s
// - Dolly zoom to orthographic top-down view resolving to the Interlock Glyph G
// =============================================================================

import * as THREE from 'three';
import { clamp, lerp, ease, springStep } from '../../engine/util';
import { HEX, LIN } from './palette';
import { PulseSparks, type SparkSegment } from './pulse_sparks';

export class Beat1Mechanism {
  group = new THREE.Group();

  // Mechanical Parts Assemblies
  private handleAssembly = new THREE.Group();
  private rodMesh: THREE.Mesh;
  private guideBrackets = new THREE.Group();
  private pawlAssembly = new THREE.Group();
  private latchAssembly = new THREE.Group();
  private doorWireframe: THREE.LineSegments;
  private gapBlockerMesh: THREE.Mesh;

  // Materials
  private solidMat: THREE.MeshStandardMaterial;
  private edgeMat: THREE.LineBasicMaterial;
  private wireMat: THREE.LineBasicMaterial;
  private redGapMat: THREE.MeshBasicMaterial;

  // Coordinates (in metres)
  readonly leverPivotPos: [number, number, number] = [-0.34, 0.045, 0.0];
  readonly rodStartPos: [number, number, number] = [-0.28, 0.0, 0.0];
  readonly gapPos: [number, number, number] = [0.0, 0.0, 0.0];
  readonly latchPos: [number, number, number] = [0.12, 0.0, 0.0];

  constructor() {
    // 1. Solid Bone Surface Material (dark satin metal with high-contrast bevels)
    this.solidMat = new THREE.MeshStandardMaterial({
      color: 0x242426,
      roughness: 0.35,
      metalness: 0.80,
    });

    // 2. Technical Wireframe Edge Material (emissive glowing bone lines)
    this.edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(HEX.bone),
      transparent: true,
      opacity: 0.85,
    });

    // 3. Faint Context Door Schematics Material
    this.wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(HEX.ash),
      transparent: true,
      opacity: 0.28,
    });

    // 4. Steady Red Blocker Bar Material (emissive --signal red)
    this.redGapMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(HEX.signal),
      transparent: true,
      opacity: 0.92,
    });

    const addEdges = (mesh: THREE.Mesh) => {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), this.edgeMat);
      mesh.add(edges);
    };

    // =========================================================================
    // ASSEMBLY
    // =========================================================================

    // A. Door Handle Lever (pivot at x = -0.34, y = 0.045)
    const bushingGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.024, 20);
    const bushing = new THREE.Mesh(bushingGeo, this.solidMat);
    bushing.rotation.x = Math.PI * 0.5;
    addEdges(bushing);
    this.handleAssembly.add(bushing);

    // Ergonomic lever arm
    const leverGeo = new THREE.BoxGeometry(0.13, 0.018, 0.014);
    const leverMesh = new THREE.Mesh(leverGeo, this.solidMat);
    leverMesh.position.set(0.065, 0, 0);
    addEdges(leverMesh);
    this.handleAssembly.add(leverMesh);

    // Lever clevis connecting down to the rod
    const clevisGeo = new THREE.BoxGeometry(0.016, 0.045, 0.012);
    const clevisMesh = new THREE.Mesh(clevisGeo, this.solidMat);
    clevisMesh.position.set(0.015, -0.022, 0);
    addEdges(clevisMesh);
    this.handleAssembly.add(clevisMesh);

    this.handleAssembly.position.set(...this.leverPivotPos);
    this.group.add(this.handleAssembly);

    // B. Connecting Rod (sliding along X)
    const rodGeo = new THREE.BoxGeometry(0.24, 0.010, 0.010);
    this.rodMesh = new THREE.Mesh(rodGeo, this.solidMat);
    this.rodMesh.position.set(-0.16, 0, 0);
    addEdges(this.rodMesh);
    this.group.add(this.rodMesh);

    // Machined Guide Brackets (supporting the rod)
    const bracket1Geo = new THREE.BoxGeometry(0.018, 0.028, 0.018);
    const b1 = new THREE.Mesh(bracket1Geo, this.solidMat);
    b1.position.set(-0.24, 0, 0);
    addEdges(b1);
    this.guideBrackets.add(b1);

    const b2 = new THREE.Mesh(bracket1Geo, this.solidMat);
    b2.position.set(-0.08, 0, 0);
    addEdges(b2);
    this.guideBrackets.add(b2);
    this.group.add(this.guideBrackets);

    // C. Pivoting Pawl (the Disconnect)
    const pawlBodyGeo = new THREE.BoxGeometry(0.045, 0.065, 0.014);
    const pawlBody = new THREE.Mesh(pawlBodyGeo, this.solidMat);
    pawlBody.position.set(0, 0.03, 0);
    addEdges(pawlBody);
    this.pawlAssembly.add(pawlBody);

    const pawlPivotGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.020, 16);
    const pawlPivot = new THREE.Mesh(pawlPivotGeo, this.solidMat);
    pawlPivot.rotation.x = Math.PI * 0.5;
    addEdges(pawlPivot);
    this.pawlAssembly.add(pawlPivot);

    // Positioned above the track and ROTATED AWAY (-38 degrees) by the child lock!
    this.pawlAssembly.position.set(-0.01, 0.055, 0);
    this.pawlAssembly.rotation.z = -0.66;
    this.group.add(this.pawlAssembly);

    // D. Latch Block Assembly (fixed block on right, NEVER moves)
    const latchBodyGeo = new THREE.BoxGeometry(0.12, 0.055, 0.022);
    const latchBody = new THREE.Mesh(latchBodyGeo, this.solidMat);
    latchBody.position.set(0.12, 0, 0);
    addEdges(latchBody);
    this.latchAssembly.add(latchBody);

    const strikerPinGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 16);
    const striker = new THREE.Mesh(strikerPinGeo, this.solidMat);
    striker.position.set(0.16, 0.015, 0);
    addEdges(striker);
    this.latchAssembly.add(striker);
    this.group.add(this.latchAssembly);

    // E. The Steady Red Blocker Bar in the Gap (centered at x = 0, y = 0)
    const blockerGeo = new THREE.BoxGeometry(0.009, 0.040, 0.012);
    this.gapBlockerMesh = new THREE.Mesh(blockerGeo, this.redGapMat);
    this.gapBlockerMesh.position.set(0, 0, 0);
    this.group.add(this.gapBlockerMesh);

    // F. Door Structural CAD Wireframe (inner door cavity schematics)
    const wireLines: number[] = [
      // Outer door frame
      -0.48, -0.16, -0.06,  0.28, -0.16, -0.06,
       0.28, -0.16, -0.06,  0.28,  0.18, -0.06,
       0.28,  0.18, -0.06, -0.48,  0.18, -0.06,
      -0.48,  0.18, -0.06, -0.48, -0.16, -0.06,
      // Diagonal stamping stiffeners
      -0.48, -0.16, -0.06, -0.22,  0.18, -0.06,
      -0.22,  0.18, -0.06,  0.08, -0.16, -0.06,
       0.08, -0.16, -0.06,  0.28,  0.06, -0.06,
      // Latch mounting bulkhead
       0.05, -0.16, -0.06,  0.05,  0.18, -0.06,
      // Lock barrel guide circle
      -0.34,  0.12, -0.06, -0.30,  0.14, -0.06,
      -0.30,  0.14, -0.06, -0.26,  0.12, -0.06,
      -0.26,  0.12, -0.06, -0.30,  0.10, -0.06,
      -0.30,  0.10, -0.06, -0.34,  0.12, -0.06,
    ];
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireLines, 3));
    this.doorWireframe = new THREE.LineSegments(wireGeo, this.wireMat);
    this.group.add(this.doorWireframe);
  }

  /**
   * Updates Beat 1 & Beat 2 mechanics at time t (8.0 to 30.0s).
   */
  update(t: number): {
    rodX: number;
    rodTipPos: [number, number, number];
    activePulse: { p0: [number, number, number]; p1: [number, number, number]; intensity: number } | null;
    sparks: SparkSegment[];
    gapFlare: number;
    dissolveProg: number;
    camPos: [number, number, number];
    camTarget: [number, number, number];
    camFov: number;
  } {
    // 1. Handle Pull Dynamics (Three distinct pulls)
    // Pull 1: t = 10.0s (stroke 18mm)
    // Pull 2: t = 12.2s (stroke 24mm)
    // Pull 3: t = 13.8s (stroke 30mm)
    let pullStroke = 0;
    const pulls = [
      { t0: 10.0, dur: 0.90, stroke: 0.018 },
      { t0: 12.2, dur: 0.75, stroke: 0.024 },
      { t0: 13.8, dur: 0.65, stroke: 0.030 },
    ];

    let activePulse: { p0: [number, number, number]; p1: [number, number, number]; intensity: number } | null = null;
    let sparks: SparkSegment[] = [];
    let gapFlare = 0;

    for (let i = 0; i < pulls.length; i++) {
      const p = pulls[i]!;
      const dt = t - p.t0;
      if (dt >= 0 && dt < p.dur) {
        const u = dt / p.dur;
        const wave = Math.sin(u * Math.PI);
        pullStroke = Math.max(pullStroke, wave * p.stroke);
      }

      // Dynamic rod tip position at severed gap
      const currentRodTip: [number, number, number] = [-0.04 + pullStroke, 0, 0];

      // Traveling pulse dash along the rod
      const pulseData = PulseSparks.getTravelingPulse(
        t,
        p.t0,
        this.rodStartPos,
        currentRodTip,
        0.30
      );
      if (pulseData) activePulse = pulseData;

      // Flare in --signal red at rod tip upon impact
      gapFlare = Math.max(gapFlare, PulseSparks.getGapFlare(t, p.t0, 0.30));

      // 48 falling sparks showering with gravity and fading over 0.8s from rod tip
      const s = PulseSparks.getSparks(t, p.t0, currentRodTip, 0.30, 48, 100 + i * 77);
      if (s.length > 0) sparks = sparks.concat(s);
    }

    // Apply kinematic offsets
    this.rodMesh.position.x = -0.16 + pullStroke;
    this.handleAssembly.rotation.z = pullStroke * 9.5;
    const rodTipPos: [number, number, number] = [-0.04 + pullStroke, 0, 0];

    // 2. Beat 2 Dissolve Front (20.0s to 27.0s)
    let dissolveProg = 0;
    if (t >= 20.0) {
      dissolveProg = clamp((t - 20.0) / 6.5);
      // Fade out solid surfaces and edges as dissolve sweeps
      const fade = 1.0 - ease.inOutCubic(dissolveProg);
      const isVisible = fade > 0.005;
      this.solidMat.opacity = fade;
      this.solidMat.transparent = true;
      this.edgeMat.opacity = fade * 0.85;
      this.handleAssembly.visible = isVisible;
      this.rodMesh.visible = isVisible;
      this.guideBrackets.visible = isVisible;
      this.pawlAssembly.visible = isVisible;
      this.latchAssembly.visible = isVisible;
      this.gapBlockerMesh.visible = isVisible;
      this.doorWireframe.visible = isVisible;
    } else {
      this.solidMat.opacity = 1.0;
      this.solidMat.transparent = false;
      this.edgeMat.opacity = 0.85;
      this.handleAssembly.visible = true;
      this.rodMesh.visible = true;
      this.guideBrackets.visible = true;
      this.pawlAssembly.visible = true;
      this.latchAssembly.visible = true;
      this.gapBlockerMesh.visible = true;
      this.doorWireframe.visible = true;
    }

    // 3. Camera Choreography across Beats 1 & 2
    let camPos: [number, number, number] = [0, 0, 0.35];
    let camTarget: [number, number, number] = [0, 0, 0];
    let camFov = 38.0;

    if (t < 14.5) {
      // 8.0 - 14.5s: side-on, slow 25° orbit while pushing in
      const u = clamp((t - 8.0) / 6.5);
      const angle = lerp(0.0, 0.436, ease.inOutQuad(u)); // 25 degrees
      const dist = lerp(0.36, 0.26, u);
      camPos = [Math.sin(angle) * dist - 0.05, 0.02, Math.cos(angle) * dist];
      camTarget = [-0.04, 0, 0];
      camFov = 38.0;
    } else if (t < 20.0) {
      // 14.5 - 20.0s: pulls stop; camera pushes toward the red gap until it fills center of frame
      const u = clamp((t - 14.5) / 5.5);
      const angle = lerp(0.436, 0.12, ease.inOutQuad(u));
      const dist = lerp(0.26, 0.13, ease.inOutCubic(u));
      camPos = [Math.sin(angle) * dist, 0.0, Math.cos(angle) * dist];
      camTarget = [0, 0, 0];
      camFov = 35.0;
    } else {
      // 20.0 - 30.0s: Dolly-zoom into orthographic top-down view
      const u = clamp((t - 20.0) / 7.0);
      const easeU = ease.inOutCubic(u);

      camFov = lerp(35.0, 1.5, easeU);

      const targetHeight = 0.20;
      const dist = (targetHeight * 0.5) / Math.tan((camFov * Math.PI) / 360.0);

      camPos = [0.0, 0.0, dist];
      camTarget = [0.0, 0.0, 0.0];
    }

    return {
      rodX: this.rodMesh.position.x,
      rodTipPos,
      activePulse,
      sparks,
      gapFlare,
      dissolveProg,
      camPos,
      camTarget,
      camFov,
    };
  }
}

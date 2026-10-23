// =============================================================================
// BEAT 0: THE SWITCH (0.0s - 8.0s) & BEAT 4 OUTRO (67.0s - 72.0s)
//
// Procedural trailing edge of a car door:
// - Curved automotive sheet metal panel with a 3D bevelled hem edge
// - Recessed 3D slot cavity (32mm long x 15mm wide x 6mm deep)
// - Slider knob with 7 tactile transverse grip ridges
// - Anisotropic brushed metal shader with specular highlight sweep (0.0 - 3.0s)
// - Rubber weatherstrip seal along the door edge with compression profile
// - At t = 5.2s, knob slides 14mm with spring snap and reveals a sliver of --signal red
// - Beat 4 Outro: knob rests exactly halfway (0.50), visually ambiguous
// =============================================================================

import * as THREE from 'three';
import { clamp, lerp, ease, springStep } from '../../engine/util';
import { HEX, LIN } from './palette';

export class Beat0Switch {
  group = new THREE.Group();

  // Materials
  private metalMat: THREE.ShaderMaterial;
  private rubberMat: THREE.MeshStandardMaterial;
  private cavityMat: THREE.MeshBasicMaterial;
  private redSliverMat: THREE.MeshBasicMaterial;
  private knobMat: THREE.ShaderMaterial;
  private bevelMat: THREE.MeshStandardMaterial;

  // Meshes & Assemblies
  private doorAssembly = new THREE.Group();
  private slotAssembly = new THREE.Group();
  private redIndicatorMesh: THREE.Mesh;
  private knobAssembly = new THREE.Group();

  constructor() {
    // 1. Physically-based Anisotropic Brushed Metal Shader
    this.metalMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        precision highp float;
        out vec3 vWorldPos;
        out vec3 vViewPos;
        out vec3 vNorm;
        out vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vec4 vp = modelViewMatrix * vec4(position, 1.0);
          vViewPos = vp.xyz;
          vNorm = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * vp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        in vec3 vWorldPos;
        in vec3 vViewPos;
        in vec3 vNorm;
        in vec2 vUv;

        uniform vec3 lightPos;
        uniform float lightIntensity;
        uniform vec3 baseColor;
        out vec4 fragColor;

        float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
          vec3 N = normalize(vNorm);
          vec3 L = normalize(lightPos - vWorldPos);
          vec3 V = normalize(-vViewPos);
          vec3 H = normalize(L + V);

          // Anisotropic tangent along door seam (Y axis)
          vec3 T = vec3(0.0, 1.0, 0.0);
          float dotTH = dot(T, H);
          float sinTH = sqrt(max(0.0, 1.0 - dotTH * dotTH));
          float anisoSpec = pow(sinTH, 40.0);

          float scratch = hash12(vec2(floor(vWorldPos.x * 1200.0), floor(vWorldPos.y * 30.0)));
          float diff = max(dot(N, L), 0.0);

          vec3 diffuse = baseColor * (0.16 + 0.55 * diff);
          vec3 specular = vec3(0.96, 0.95, 0.92) * anisoSpec * (0.70 + 0.30 * scratch);

          vec3 col = (diffuse + specular) * lightIntensity;
          fragColor = vec4(col, 1.0);
        }
      `,
      uniforms: {
        lightPos: { value: new THREE.Vector3(-0.35, 0.30, 0.30) },
        lightIntensity: { value: 0.0 },
        baseColor: { value: new THREE.Vector3(...LIN.bone).multiplyScalar(0.72) },
      },
    });

    // 2. Rubber Seal Material
    this.rubberMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0c,
      roughness: 0.95,
      metalness: 0.05,
    });

    // 3. Bezel Frame Material
    this.bevelMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      roughness: 0.35,
      metalness: 0.85,
    });

    // 4. Cavity & Red Sliver Materials
    this.cavityMat = new THREE.MeshBasicMaterial({ color: 0x040405 });
    this.redSliverMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(HEX.signal),
    });

    // 5. Tactile Slider Knob Material
    this.knobMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        precision highp float;
        out vec3 vWorldPos;
        out vec3 vViewPos;
        out vec3 vNorm;
        out vec2 vUv;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vec4 vp = modelViewMatrix * vec4(position, 1.0);
          vViewPos = vp.xyz;
          vNorm = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * vp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        in vec3 vWorldPos;
        in vec3 vViewPos;
        in vec3 vNorm;
        in vec2 vUv;

        uniform vec3 lightPos;
        uniform float lightIntensity;
        uniform vec3 baseColor;
        out vec4 fragColor;

        void main() {
          vec3 N = normalize(vNorm);

          // Transverse tactile ridges: 7 serrations along Y
          if (vViewPos.z > -0.005 && abs(vUv.x - 0.5) < 0.42) {
            float ridgePhase = fract(vUv.y * 7.0);
            float ridgeNorm = (ridgePhase > 0.5 ? 1.0 : -1.0) * 0.45;
            N = normalize(N + vec3(0.0, ridgeNorm, 0.0));
          }

          vec3 L = normalize(lightPos - vWorldPos);
          vec3 V = normalize(-vViewPos);
          vec3 H = normalize(L + V);

          float diff = max(dot(N, L), 0.0);
          float spec = pow(max(dot(N, H), 0.0), 32.0);

          vec3 col = baseColor * (0.20 + 0.70 * diff) + vec3(0.95) * spec * 0.45;
          col *= lightIntensity;

          fragColor = vec4(col, 1.0);
        }
      `,
      uniforms: {
        lightPos: { value: new THREE.Vector3(-0.35, 0.30, 0.30) },
        lightIntensity: { value: 0.0 },
        baseColor: { value: new THREE.Vector3(...LIN.bone).multiplyScalar(0.85) },
      },
    });

    // =========================================================================
    // 3D GEOMETRY CONSTRUCTION
    // =========================================================================

    // A. Main Door Trailing Edge (Wide enough to fill frame: width 0.26m)
    // Slot opening: x in [-0.0075, +0.0075] (15mm), y in [-0.016, +0.016] (32mm)
    // Top plate above slot (y: +0.016 to +0.22, height 0.204, center y = +0.118)
    const topPlateGeo = new THREE.PlaneGeometry(0.26, 0.204);
    const topPlate = new THREE.Mesh(topPlateGeo, this.metalMat);
    topPlate.position.set(0, 0.118, 0);
    this.doorAssembly.add(topPlate);

    // Bottom plate below slot (y: -0.22 to -0.016, height 0.204, center y = -0.118)
    const btmPlateGeo = new THREE.PlaneGeometry(0.26, 0.204);
    const btmPlate = new THREE.Mesh(btmPlateGeo, this.metalMat);
    btmPlate.position.set(0, -0.118, 0);
    this.doorAssembly.add(btmPlate);

    // Left cheek flanking slot (x: -0.13 to -0.0075, width 0.1225, center x = -0.06875)
    const leftCheekGeo = new THREE.PlaneGeometry(0.1225, 0.032);
    const leftCheek = new THREE.Mesh(leftCheekGeo, this.metalMat);
    leftCheek.position.set(-0.06875, 0, 0);
    this.doorAssembly.add(leftCheek);

    // Right cheek flanking slot (x: +0.0075 to +0.13, width 0.1225, center x = +0.06875)
    const rightCheekGeo = new THREE.PlaneGeometry(0.1225, 0.032);
    const rightCheek = new THREE.Mesh(rightCheekGeo, this.metalMat);
    rightCheek.position.set(0.06875, 0, 0);
    this.doorAssembly.add(rightCheek);

    // Outer door hem curve (left edge curling away into car exterior at x = -0.12)
    const hemCurveGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.44, 24, 1, false, Math.PI * 0.5, Math.PI * 0.5);
    const hemMesh = new THREE.Mesh(hemCurveGeo, this.metalMat);
    hemMesh.position.set(-0.12, 0, -0.024);
    hemMesh.rotation.y = Math.PI;
    this.doorAssembly.add(hemMesh);

    // B. The Extruded 3D Recessed Slot Cavity (15mm wide, 32mm tall, 6mm deep)
    const cavityBackGeo = new THREE.PlaneGeometry(0.015, 0.032);
    const cavityBack = new THREE.Mesh(cavityBackGeo, this.cavityMat);
    cavityBack.position.set(0, 0, -0.006);
    this.slotAssembly.add(cavityBack);

    // Cavity inner side walls
    const wallSideGeo = new THREE.PlaneGeometry(0.006, 0.032);
    const wallLeft = new THREE.Mesh(wallSideGeo, this.cavityMat);
    wallLeft.rotation.y = Math.PI * 0.5;
    wallLeft.position.set(-0.0075, 0, -0.003);
    this.slotAssembly.add(wallLeft);

    const wallRight = new THREE.Mesh(wallSideGeo, this.cavityMat);
    wallRight.rotation.y = -Math.PI * 0.5;
    wallRight.position.set(0.0075, 0, -0.003);
    this.slotAssembly.add(wallRight);

    // Bevel frame lips around the slot opening
    const lipTopGeo = new THREE.BoxGeometry(0.017, 0.0015, 0.001);
    const lipTop = new THREE.Mesh(lipTopGeo, this.bevelMat);
    lipTop.position.set(0, 0.0165, 0.0005);
    this.slotAssembly.add(lipTop);

    const lipBtm = new THREE.Mesh(lipTopGeo, this.bevelMat);
    lipBtm.position.set(0, -0.0165, 0.0005);
    this.slotAssembly.add(lipBtm);

    // C. The Glowing --signal Red Indicator Plate
    // Placed in upper cavity at z = -0.004 (14mm wide x 15mm tall, center y = +0.008)
    const indicatorGeo = new THREE.PlaneGeometry(0.014, 0.015);
    this.redIndicatorMesh = new THREE.Mesh(indicatorGeo, this.redSliverMat);
    this.redIndicatorMesh.position.set(0, 0.008, -0.004);
    this.slotAssembly.add(this.redIndicatorMesh);

    this.doorAssembly.add(this.slotAssembly);

    // D. Rubber Weatherstrip Seal (along exterior hem at x = -0.115)
    const sealCurve = new THREE.CylinderGeometry(0.009, 0.009, 0.44, 20);
    const sealMesh = new THREE.Mesh(sealCurve, this.rubberMat);
    sealMesh.position.set(-0.115, 0, 0.002);
    this.doorAssembly.add(sealMesh);

    // E. Tactile Slider Knob Assembly (14mm wide x 16mm tall x 6mm deep)
    const knobGeo = new THREE.BoxGeometry(0.014, 0.016, 0.006);
    const knobBody = new THREE.Mesh(knobGeo, this.knobMat);
    knobBody.position.set(0, 0, 0.002);
    this.knobAssembly.add(knobBody);

    // Initial position: at top (y = +0.008), completely covering the red indicator
    this.knobAssembly.position.set(0, 0.008, 0);
    this.doorAssembly.add(this.knobAssembly);

    this.group.add(this.doorAssembly);
  }

  /**
   * Updates Beat 0 state at time t (0.0 to 8.0s) or Beat 4 outro (67.0 to 72.0s).
   */
  update(t: number, isOutro = false): { knobProg: number; cameraZ: number } {
    let knobProg = 0;

    if (!isOutro) {
      // 1. Key Light Sweep (0.0s to 3.0s: fade from 0 to full, sweeping left to right)
      const lightFade = clamp(t / 2.8);
      const sweepX = lerp(-0.45, 0.30, ease.inOutCubic(clamp(t / 5.5)));
      this.metalMat.uniforms.lightPos!.value.set(sweepX, 0.30, 0.30);
      this.metalMat.uniforms.lightIntensity!.value = lightFade;
      this.knobMat.uniforms.lightPos!.value.set(sweepX, 0.30, 0.30);
      this.knobMat.uniforms.lightIntensity!.value = lightFade;

      // 2. Knob click at t = 5.2s:
      // Slow start for 0.6s (4.6 to 5.2), fast snap with critically damped spring and 2% overshoot
      if (t >= 4.6 && t < 5.2) {
        knobProg = 0.08 * ease.inQuad((t - 4.6) / 0.6);
      } else if (t >= 5.2) {
        const spring = springStep(t - 5.2, 4.2, 0.65);
        knobProg = clamp(0.08 + 0.92 * spring, 0, 1.02);
        if (t > 5.8) knobProg = 1.0;
      }
    } else {
      // BEAT 4 OUTRO: Knob rests EXACTLY halfway (0.50), visually ambiguous
      knobProg = 0.50;
      this.metalMat.uniforms.lightPos!.value.set(0.10, 0.30, 0.30);
      this.metalMat.uniforms.lightIntensity!.value = 1.0;
      this.knobMat.uniforms.lightPos!.value.set(0.10, 0.30, 0.30);
      this.knobMat.uniforms.lightIntensity!.value = 1.0;
    }

    // Slide distance: 14mm downwards along Y (from y = +0.008 to y = -0.006)
    const knobY = lerp(0.008, -0.006, knobProg);
    this.knobAssembly.position.y = knobY;

    this.redIndicatorMesh.visible = knobProg > 0.02;

    // Camera dolly forward 2cm over 8s
    const uDolly = ease.inOutQuad(clamp(t / 8.0));
    const cameraZ = lerp(0.175, 0.155, uDolly);

    return { knobProg, cameraZ };
  }
}

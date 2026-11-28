// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Flagship Scene 2: 'Relic // Zero-G Activation'
// Project: deep_field // Engine: f(x) Studio v0.8.0

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { ease } from '../../engine/util';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'scene_lagrange',

  models: {
    hero: {
      url: '/models/damaged_helmet.glb',
      center: true,
      fit: 3.2,
      castShadow: true,
      receiveShadow: true,
      envMapIntensity: 2.2,
    },
  },

  setup(ctx: SceneContext) {
    // 1. Procedural PBR Studio Environment Map via PMREM
    const pmrem = new THREE.PMREMGenerator(ctx.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    ctx.scene3D.environment = envRT.texture;

    // 2. Suspended Zero-G Hero Model
    const hero = ctx.getModel('hero');
    if (hero) {
      hero.root.position.set(0, 0.75, 0);
      hero.root.rotation.set(0.06, -0.2, 0);
      ctx.scene3D.add(hero.root);
    }

    // 3. Brutalist Containment Chamber: Monumental Vertical Light Columns
    const pillarGroup = new THREE.Group();
    pillarGroup.name = 'pillars';

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x141822,
      roughness: 0.35,
      metalness: 0.85,
    });

    const lightBarMat = new THREE.MeshBasicMaterial({
      color: 0x60b8ff,
    });

    const pillarCoords = [
      [-6.5, -6.5],
      [6.5, -6.5],
      [-6.5, 6.5],
      [6.5, 6.5],
    ];

    for (const [px, pz] of pillarCoords) {
      // Main pillar body
      const colGeo = new THREE.BoxGeometry(0.8, 14.0, 0.8);
      const colMesh = new THREE.Mesh(colGeo, pillarMat);
      colMesh.position.set(px, 3.5, pz);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      pillarGroup.add(colMesh);

      // Embedded vertical neon light strip
      const stripGeo = new THREE.BoxGeometry(0.12, 10.0, 0.12);
      const stripMesh = new THREE.Mesh(stripGeo, lightBarMat);
      stripMesh.position.set(px * 0.95, 3.5, pz * 0.95);
      pillarGroup.add(stripMesh);
    }
    ctx.scene3D.add(pillarGroup);

    // 4. Dark Reflective Containment Chamber Floor
    const floorGeo = new THREE.CircleGeometry(65, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07080d,
      roughness: 0.18,
      metalness: 0.88,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    floor.receiveShadow = true;
    ctx.scene3D.add(floor);

    // Concentric metallic floor trench rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x222838,
      roughness: 0.3,
      metalness: 0.9,
    });
    for (const r of [3.5, 5.5, 8.0]) {
      const ringGeo = new THREE.RingGeometry(r - 0.08, r + 0.08, 64);
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = -2.18;
      ctx.scene3D.add(ringMesh);
    }

    // 5. Cinematic Dramatic Lighting Setup
    // Warm Key Light (Tungsten 3200K)
    const key = new THREE.DirectionalLight(0xffecd0, 4.8);
    key.position.set(6.0, 7.0, 5.0);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0001;

    // Cyan Industrial Rim Light
    const rim = new THREE.DirectionalLight(0x3898ff, 4.2);
    rim.position.set(-6.0, 5.0, -5.0);

    // Overhead Skylight Kicker
    const top = new THREE.DirectionalLight(0xffb070, 2.0);
    top.position.set(0, 9.0, 0);

    // Velvet Ambient
    const fill = new THREE.AmbientLight(0x060912, 0.45);
    ctx.scene3D.add(key, rim, top, fill);

    // 6. Zero-G Drifting Atmospheric Embers (1,200 particles)
    const emberCount = 1200;
    const emberGeo = new THREE.BufferGeometry();
    const emberPos = new Float32Array(emberCount * 3);
    const emberCol = new Float32Array(emberCount * 3);

    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3 + 0] = (Math.random() - 0.5) * 14;
      emberPos[i * 3 + 1] = Math.random() * 8 - 2;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 14;

      if (Math.random() > 0.4) {
        emberCol[i * 3 + 0] = 0.4; emberCol[i * 3 + 1] = 0.75; emberCol[i * 3 + 2] = 1.0; // Cyan
      } else {
        emberCol[i * 3 + 0] = 1.0; emberCol[i * 3 + 1] = 0.70; emberCol[i * 3 + 2] = 0.35; // Warm amber
      }
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    emberGeo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));

    const emberMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
    });
    ctx.scene3D.add(new THREE.Points(emberGeo, emberMat));

    ctx.rig.setLensMm(45);
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const hero = ctx.getModel('hero');

    // Zero-g floating drift
    if (hero) {
      hero.root.position.y = 0.75 + Math.sin(f.lt * 0.45) * 0.12;
      hero.root.rotation.y = -0.2 + f.lt * 0.08;
      hero.root.rotation.x = 0.06 + Math.sin(f.lt * 0.35) * 0.03;
      hero.root.rotation.z = Math.cos(f.lt * 0.25) * 0.02;
    }

    // Directorial Camera Choreography
    // Global climax at t = 19.17s (local lt = 8.67s)
    const climaxLocal = 8.67;
    const dur = 16.3;
    const normT = Math.min(1.0, f.lt / dur);

    // Continuous monumental orbit
    const orbitAngle = -0.5 + normT * 0.95;
    const orbitRadius = 5.8 - Math.sin(normT * Math.PI) * 0.6;
    const camY = 1.2 + Math.sin(normT * 1.8) * 0.5;

    // Physical impact tremor on the drop at t = 19.17s
    let tremorX = 0;
    let tremorY = 0;
    if (f.lt >= climaxLocal && f.lt <= climaxLocal + 1.2) {
      const trP = (f.lt - climaxLocal) / 1.2;
      const decay = Math.exp(-trP * 5.0);
      tremorX = Math.sin(trP * 48.0) * 0.05 * decay;
      tremorY = Math.cos(trP * 36.0) * 0.035 * decay;
    }

    ctx.rig.position = [
      Math.sin(orbitAngle) * orbitRadius + tremorX,
      camY + tremorY,
      Math.cos(orbitAngle) * orbitRadius,
    ];
    ctx.rig.target = [0.0, 0.75, 0.0];
    ctx.rig.setLensMm(45 + normT * 10);
    ctx.updateCamera(f.t, f.p);

    // Flush scene
    ctx.flush(out, true);

    return {
      bloom: 0.25,
      vignette: 0.38,
      chromaticAberration: 0.0025,
    };
  },
});
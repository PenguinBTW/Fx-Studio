// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Flagship Scene 1: 'Relic // Dormant Inspection'
// Project: deep_field // Engine: f(x) Studio v0.8.0

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { ease } from '../../engine/util';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'scene_optic',

  models: {
    hero: {
      url: '/models/damaged_helmet.glb',
      center: true,
      fit: 2.8,
      castShadow: true,
      receiveShadow: true,
      envMapIntensity: 2.0,
    },
  },

  setup(ctx: SceneContext) {
    // 1. Procedural PBR Studio Environment Map via PMREM
    const pmrem = new THREE.PMREMGenerator(ctx.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    ctx.scene3D.environment = envRT.texture;

    // 2. Hero Model Setup & Positioning
    const hero = ctx.getModel('hero');
    if (hero) {
      hero.root.position.set(0, 0.45, 0);
      hero.root.rotation.set(0.08, -0.45, 0);
      ctx.scene3D.add(hero.root);
    }

    // 3. Brutalist Dark Slate Plinth
    const plinthGroup = new THREE.Group();
    plinthGroup.name = 'plinth';

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x12141a,
      roughness: 0.35,
      metalness: 0.75,
    });

    // Upper plinth tier
    const topTierGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.35, 48);
    const topTier = new THREE.Mesh(topTierGeo, plinthMat);
    topTier.position.y = -0.95;
    topTier.castShadow = true;
    topTier.receiveShadow = true;
    plinthGroup.add(topTier);

    // Main plinth base
    const baseTierGeo = new THREE.CylinderGeometry(2.1, 2.3, 0.8, 48);
    const baseTier = new THREE.Mesh(baseTierGeo, plinthMat);
    baseTier.position.y = -1.5;
    baseTier.castShadow = true;
    baseTier.receiveShadow = true;
    plinthGroup.add(baseTier);

    ctx.scene3D.add(plinthGroup);

    // 4. Seamless Dark Studio Floor (Cyclorama disc with soft radial dropoff)
    const floorGeo = new THREE.CircleGeometry(60, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x07080c,
      roughness: 0.25,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.9;
    floor.receiveShadow = true;
    ctx.scene3D.add(floor);

    // 5. Cinematic Three-Point Chiaroscuro Studio Lighting
    // Warm Key Light (Tungsten 3200K)
    const key = new THREE.DirectionalLight(0xffecd2, 4.2);
    key.position.set(5.5, 6.0, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0001;

    // Steel-Blue Rim Light (8500K sharp silhouette)
    const rim = new THREE.DirectionalLight(0x3888ff, 3.8);
    rim.position.set(-5.5, 4.5, -4.0);

    // Soft Overhead Skylight
    const top = new THREE.DirectionalLight(0xffcaa0, 1.6);
    top.position.set(0, 8.0, 1.0);

    // Velvet Ambient Fill
    const fill = new THREE.AmbientLight(0x060810, 0.4);
    ctx.scene3D.add(key, rim, top, fill);

    // 6. Atmospheric Drifting Dust Motes
    const dustCount = 600;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3 + 0] = (Math.random() - 0.5) * 10;
      dustPos[i * 3 + 1] = Math.random() * 5 - 1.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffd8a8,
      size: 0.035,
      transparent: true,
      opacity: 0.45,
    });
    ctx.scene3D.add(new THREE.Points(dustGeo, dustMat));

    ctx.rig.setLensMm(65);
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const hero = ctx.getModel('hero');

    // Subtle organic breathing motion
    if (hero) {
      hero.root.rotation.y = -0.45 + Math.sin(f.lt * 0.22) * 0.05;
      hero.root.rotation.x = 0.08 + Math.cos(f.lt * 0.18) * 0.02;
    }

    // Cinematic Camera Choreography
    // t: 0.0s -> 5.0s: Heroic low-angle medium push, steady and weighted
    // t: 5.0s -> 9.5s: Slow sweeping crane orbit across the visor cheekplate
    // t: 9.5s -> 11.5s: Accelerating plunge directly toward the visor ocular sensor (0, 0.45, 0)
    let camPos: [number, number, number];
    let camTarget: [number, number, number];
    let lensMm = 65;

    if (f.lt < 5.0) {
      const p = ease.inOutCubic(f.lt / 5.0);
      camPos = [
        1.8 - p * 0.4,
        0.35 + p * 0.2,
        3.6 - p * 0.6,
      ];
      camTarget = [0.0, 0.35, 0.0];
      lensMm = 65 - p * 10;
    } else if (f.lt < 9.5) {
      const p = ease.inOutCubic((f.lt - 5.0) / 4.5);
      camPos = [
        1.4 - p * 0.8,
        0.55 + p * 0.2,
        3.0 - p * 0.4,
      ];
      camTarget = [0.0, 0.42, 0.0];
      lensMm = 55 - p * 10;
    } else {
      // High-velocity forward plunge directly into ocular sensor
      const p = ease.inCubic((f.lt - 9.5) / 2.0);
      camPos = [
        0.6 * (1.0 - p),
        0.75 * (1.0 - p) + 0.45 * p,
        2.6 - p * 2.2, // Plunges down to Z=0.4m right at the visor!
      ];
      camTarget = [0.0, 0.45, -0.5];
      lensMm = 45 + p * 35;
    }

    ctx.rig.position = camPos;
    ctx.rig.target = camTarget;
    ctx.rig.setLensMm(lensMm);
    ctx.updateCamera(f.t, f.p);

    // Flush scene
    ctx.flush(out, true);

    return {
      bloom: 0.22,
      vignette: 0.36,
      chromaticAberration: 0.002,
    };
  },
});
import * as THREE from 'three';

// Swallow back plumage: deep navy with a thin-film sheen that shifts blue→violet with view angle.
export default () =>
  new THREE.MeshPhysicalMaterial({
    color: '#0b1838',
    roughness: 0.45,
    metalness: 0.0,
    sheen: 0.35,
    sheenColor: new THREE.Color('#3d6bd6'),
    sheenRoughness: 0.4,
    iridescence: 0.55,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [220, 520],
    clearcoat: 0.15,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
  });

import * as THREE from 'three';

// Swallow back plumage: deep navy with a thin-film sheen that shifts blue→violet with view angle.
export default () =>
  new THREE.MeshPhysicalMaterial({
    color: '#0b1838',
    roughness: 0.68,
    specularIntensity: 0.35,
    metalness: 0.0,
    sheen: 0.12,
    sheenColor: new THREE.Color('#3d6bd6'),
    sheenRoughness: 0.4,
    iridescence: 0.18,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [400, 480],
    clearcoat: 0.0,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
  });

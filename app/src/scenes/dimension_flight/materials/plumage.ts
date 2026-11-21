import * as THREE from 'three';

/** Camera-facing rim (kicker) light colour for the swallow; the scene sets it per world. */
export const PLUMAGE_RIM = { value: new THREE.Color('#b8d0ff') };

// Swallow back plumage: deep navy with a thin-film sheen that shifts blue→violet with view angle,
// plus a fresnel rim so the silhouette separates from dark backgrounds from any angle.
export default () => {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#0b1838',
    roughness: 0.68,
    specularIntensity: 0.35,
    metalness: 0.0,
    sheen: 0.6,
    sheenColor: new THREE.Color('#7aa8ff'),
    sheenRoughness: 0.3,
    iridescence: 0.18,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [400, 480],
    clearcoat: 0.0,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.25,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uRim = PLUMAGE_RIM;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0); totalEmissiveRadiance += uRim * fr * 0.75; }');
  };
  m.customProgramCacheKey = () => 'plumage-rim';
  return m;
};

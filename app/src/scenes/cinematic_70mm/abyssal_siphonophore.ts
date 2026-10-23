// SCENE 2: "THE ABYSSAL SIPHONOPHORE: DEEP OCEAN BIOLUMINESCENCE"
// 70mm Pelagic Trench Cinematography (Deep Ocean Prime)
// Strictly Closed-Form Frame = f(t), Zero UI, Zero HUDs, Pure Photorealism

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame, type PostOverrides } from '../../engine/scene';

const NUM_BELLS = 7;
const NUM_TENTACLES = 56;
const NUM_PHOTOPHORES = 384;
const NUM_MARINE_SNOW = 768;

// -----------------------------------------------------------------------------
// 1. Translucent Gelatinous Swimming Bell Shader (Beer-Lambert, Cauchy, Nerve Pulse)
// -----------------------------------------------------------------------------
const BELL_VERT = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

in mat4 iModelMatrix;
in vec4 iBellParams; // [bellIndex, phaseOffset, baseScale, pulseSpeed]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
out float vBellIdx;
out float vNervePulse;

void main() {
  vUv = uv;
  float bellIdx = iBellParams.x;
  vBellIdx = bellIdx;
  float t = time;

  // Harmonic organic contraction of swimming bell:
  // Closed-form: r(theta, t) = r0 * (1.0 + 0.12 * sin(3*theta + t*2.2 - bellIdx*0.5) * cos(t*1.4))
  float theta = atan(position.z, position.x);
  float contraction = 1.0 + 0.12 * sin(3.0 * theta + t * 2.2 - bellIdx * 0.5) * cos(t * 1.4);
  float axialSqueeze = 1.0 + 0.06 * cos(t * 2.2 - bellIdx * 0.5);

  vec3 localP = position;
  localP.xz *= contraction;
  localP.y *= axialSqueeze;

  // Gentle oceanic spinal undulation
  float swayX = sin(bellIdx * 0.5 + t * 0.75) * 0.12;
  float swayZ = cos(bellIdx * 0.45 + t * 0.65) * 0.10;

  vec4 wp = iModelMatrix * vec4(localP + vec3(swayX, 0.0, swayZ), 1.0);
  vWorldPos = wp.xyz;

  vec3 deformedN = normal;
  deformedN.xz *= contraction;
  vNormal = normalize(mat3(iModelMatrix) * deformedN);

  // Traveling bioluminescent neural pulse wave
  float wave = mod(t * 1.8 - bellIdx * 0.55, 6.28318);
  vNervePulse = exp(-pow(wave - 1.6, 2.0) * 3.5);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vWorldPos, 1.0);
}
`;

const BELL_FRAG = /* glsl */ `
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
in float vBellIdx;
in float vNervePulse;

uniform vec3 camPos;
uniform float time;

out vec4 fragColor;

#define PI 3.14159265359

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(camPos - vWorldPos);
  float cosTheta = max(dot(N, V), 0.0);

  // 1. Dielectric Fresnel reflection (n = 1.34 underwater)
  float f0 = 0.022;
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosTheta, 3.8);
  if (!gl_FrontFacing) fresnel *= 0.4;

  // 2. Pure crystalline electric cyan rim with subtle sapphire accent
  vec3 rimColor = mix(
    vec3(0.12, 0.90, 1.0),   // Electric diamond cyan
    vec3(0.35, 0.25, 0.85),  // Grazing sapphire-violet accent
    pow(1.0 - cosTheta, 4.0)
  ) * (fresnel * 1.5);

  // 3. Beer-Lambert Volumetric Absorption through translucent bell wall
  float thickness = mix(0.18, 0.03, vUv.y);
  vec3 sigma_a = vec3(2.2, 0.45, 0.08); // Deep sea absorption
  vec3 transmittance = exp(-sigma_a * thickness * 3.5);

  // 4. Internal Photophore Radiance & Neural Pulses
  vec3 amberCore = vec3(1.0, 0.68, 0.18) * 0.35;
  vec3 cyanPulse = vec3(0.08, 0.95, 0.90) * 0.85;
  vec3 internalLight = mix(amberCore, cyanPulse, vNervePulse);

  vec3 sssGlow = internalLight * transmittance * (0.35 + 0.65 * (1.0 - vUv.y));

  // 5. Ciliated Radial Micro-Ribs (crystalline glowing threads)
  float ribs = pow(0.5 + 0.5 * cos(vUv.x * PI * 32.0), 4.0);
  vec3 ribGlow = vec3(0.10, 0.85, 0.95) * (ribs * 0.18 * (1.0 + vNervePulse));

  // Translucent deep-sea indigo body
  vec3 bodyColor = vec3(0.005, 0.028, 0.065) * transmittance;

  vec3 finalColor = bodyColor + sssGlow + rimColor + ribGlow;
  float alpha = clamp(fresnel * 0.75 + sssGlow.g * 0.55 + 0.08, 0.06, 0.82);

  fragColor = vec4(finalColor, alpha);
}
`;

// -----------------------------------------------------------------------------
// 2. Gossamer Tentacle Filaments Shader (Cascading Waves)
// -----------------------------------------------------------------------------
const TENTACLE_VERT = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

in mat4 iModelMatrix;
in vec4 iTentParams; // [rootX, rootZ, phase, lengthScale]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

out vec3 vWorldPos;
out vec2 vUv;
out float vSpark;

void main() {
  vUv = uv;
  float phase = iTentParams.z;
  float t = time;
  float s = position.y; // [-4.0..0.0]

  // Fluid wave harmonics cascading down tentacle
  float waveX = sin(s * 1.8 - t * 1.9 + phase) * 0.16 * (-s * 0.28);
  float waveZ = cos(s * 1.5 - t * 1.6 + phase * 1.2) * 0.16 * (-s * 0.28);

  vec3 localP = position;
  localP.x += waveX;
  localP.z += waveZ;

  vec4 wp = iModelMatrix * vec4(localP, 1.0);
  vWorldPos = wp.xyz;

  // Traveling spark nodes
  float sparkWave = mod(t * 2.2 + s * 1.4 + phase, 6.28);
  vSpark = exp(-pow(sparkWave - 2.0, 2.0) * 4.0);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(vWorldPos, 1.0);
}
`;

const TENTACLE_FRAG = /* glsl */ `
precision highp float;

in vec3 vWorldPos;
in vec2 vUv;
in float vSpark;

out vec4 fragColor;

void main() {
  vec3 strandGlow = vec3(0.02, 0.25, 0.45) * 0.35;
  vec3 sparkColor = mix(vec3(0.10, 0.92, 0.85), vec3(1.0, 0.72, 0.22), vSpark);
  vec3 col = strandGlow + sparkColor * (vSpark * 2.4);

  // Smooth feathering toward filament tip so it dissolves into dark water
  float lengthFade = smoothstep(0.0, 0.25, vUv.y);
  float alpha = clamp(0.12 + vSpark * 0.78, 0.0, 0.85) * lengthFade;
  fragColor = vec4(col, alpha);
}
`;

// -----------------------------------------------------------------------------
// 3. Bioluminescent Photophore Pearl Nodes (Billboard Quads)
// -----------------------------------------------------------------------------
const PHOTO_VERT = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 iOrigin;
in vec4 iParams; // [phase, size, bellIdx, colorType]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

out vec2 vQuadPos;
out vec3 vColor;
out float vIntensity;

void main() {
  vQuadPos = position.xy * 2.0;

  float t = time;
  float phase = iParams.x;
  float bellIdx = iParams.z;

  float pulseWave = mod(t * 1.8 - bellIdx * 0.55, 6.28318);
  float pulse = exp(-pow(pulseWave - 1.6, 2.0) * 4.0);

  vec3 worldPos = iOrigin + vec3(
    sin(t * 0.75 + phase) * 0.08,
    cos(t * 0.60 + phase) * 0.06,
    sin(t * 0.70 + phase * 1.1) * 0.08
  );

  vec4 viewPos = modelViewMatrix * vec4(worldPos, 1.0);
  float pSize = iParams.y * (1.0 + pulse * 1.8);
  viewPos.xy += position.xy * pSize;

  if (iParams.w < 0.5) {
    vColor = vec3(1.0, 0.75, 0.25); // Warm amber
  } else {
    vColor = vec3(0.12, 0.95, 0.88); // Electric cyan
  }

  vIntensity = 1.0 + pulse * 2.8;
  gl_Position = projectionMatrix * viewPos;
}
`;

const PHOTO_FRAG = /* glsl */ `
precision highp float;

in vec2 vQuadPos;
in vec3 vColor;
in float vIntensity;

out vec4 fragColor;

void main() {
  float r2 = dot(vQuadPos, vQuadPos);
  if (r2 > 1.0) discard;

  float core = exp(-r2 * 4.2);
  float halo = exp(-r2 * 1.4) * 0.35;
  vec3 rgb = vColor * ((core + halo) * vIntensity * 2.0);

  fragColor = vec4(rgb, clamp((core + halo) * 0.85, 0.0, 1.0));
}
`;

// -----------------------------------------------------------------------------
// 4. Pelagic Marine Snow Field
// -----------------------------------------------------------------------------
const SNOW_VERT = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 iOrigin;
in vec3 iDrift;
in vec4 iParams; // [phase, size, unused, seed]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;

out vec2 vQuadPos;
out vec3 vColor;
out float vAlpha;

void main() {
  vQuadPos = position.xy * 2.0;
  float t = time;

  vec3 worldPos = iOrigin + iDrift * t;
  worldPos.y = mod(worldPos.y + 6.0, 12.0) - 6.0;

  worldPos.x += sin(worldPos.y * 1.4 + t * 0.35) * 0.10;
  worldPos.z += cos(worldPos.y * 1.2 + t * 0.30) * 0.10;

  vec4 viewPos = modelViewMatrix * vec4(worldPos, 1.0);
  viewPos.xy += position.xy * iParams.y;

  float distXZ = length(worldPos.xz);
  float proximity = smoothstep(3.5, 0.6, distXZ);
  vColor = mix(vec3(0.12, 0.28, 0.48), vec3(0.12, 0.82, 0.75), proximity);
  vAlpha = 0.20 + proximity * 0.60;

  gl_Position = projectionMatrix * viewPos;
}
`;

const SNOW_FRAG = /* glsl */ `
precision highp float;

in vec2 vQuadPos;
in vec3 vColor;
in float vAlpha;

out vec4 fragColor;

void main() {
  float r2 = dot(vQuadPos, vQuadPos);
  if (r2 > 1.0) discard;

  float core = exp(-r2 * 3.8);
  fragColor = vec4(vColor * (core * 1.4), core * vAlpha);
}
`;

// -----------------------------------------------------------------------------
// Procedural Geometry Construction
// -----------------------------------------------------------------------------

// Smooth rounded hemispherical cupola bell with gentle flare
function createSmoothCupolaBell(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  const segments = 48;
  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    // Angle from apex (0) to rim (PI * 0.52)
    const angle = frac * (Math.PI * 0.54);
    const r = Math.sin(angle) * 0.70 + Math.pow(frac, 3.5) * 0.12;
    const y = Math.cos(angle) * 0.48 - 0.15;
    points.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(points, 64);
  geo.computeVertexNormals();
  return geo;
}

// Slender filament ribbon
function createTentacleGeometry(len: number, segs: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.007, 0.003, len, 8, segs, true);
  geo.translate(0, -len * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

// -----------------------------------------------------------------------------
// Scene Definition: The Abyssal Siphonophore
// -----------------------------------------------------------------------------
export default defineScene({
  id: 'abyssal_siphonophore',
  duration: 12.0,

  setup: (ctx: SceneContext) => {
    // 80mm Prime Camera Rig (Cinematic Deep Ocean Framing)
    ctx.rig.setLensMm(80);
    ctx.rig.setPath([
      // t = 0.0s: Hero macro framing of cascading translucent nectophore bells
      { t: 0.00, pos: [2.1, 0.55, 4.2],  target: [0.0, 0.10, 0.0], roll:  0.02, focalLength: 80 },
      // t = 3.0s: Gliding alongside undulating bells catching electric cyan rim light
      { t: 0.25, pos: [1.6, 0.20, 3.8],  target: [0.0, 0.05, 0.0], roll: -0.02, focalLength: 80 },
      // t = 6.0s: Tracking neural bioluminescent wave traveling into gossamer tentacles
      { t: 0.50, pos: [0.9, -0.30, 3.6], target: [0.0, -0.25, 0.0], roll:  0.02, focalLength: 80 },
      // t = 9.0s: Lateral reveal of amber photophore pearls and drifting marine snow
      { t: 0.75, pos: [-1.1, 0.25, 3.9], target: [0.0, 0.05, 0.0], roll: -0.01, focalLength: 80 },
      // t = 12.0s: Realigning optical axis
      { t: 1.00, pos: [0.0, 0.40, 4.3],  target: [0.0, 0.10, 0.0], roll:  0.00, focalLength: 80 },
    ]);

    const creatureGroup = new THREE.Group();

    // 1. Cascading Translucent Swimming Bells (Nectarophores)
    const bellBaseGeo = createSmoothCupolaBell();
    const instBellGeo = new THREE.InstancedBufferGeometry();
    instBellGeo.index = bellBaseGeo.index;
    instBellGeo.attributes.position = bellBaseGeo.attributes.position!;
    instBellGeo.attributes.normal = bellBaseGeo.attributes.normal!;
    instBellGeo.attributes.uv = bellBaseGeo.attributes.uv!;

    const bellMatArr = new Float32Array(NUM_BELLS * 16);
    const bellParamsArr = new Float32Array(NUM_BELLS * 4);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < NUM_BELLS; i++) {
      // Cascading stacked hierarchy with organic spinal S-curve
      const bellY = 1.4 - i * 0.52;
      const scale = 0.95 - i * 0.055;
      const curveX = Math.sin(i * 0.45) * 0.25;
      const curveZ = Math.cos(i * 0.40) * 0.18;

      dummy.position.set(curveX, bellY, curveZ);
      dummy.rotation.set(0.08 * Math.sin(i * 0.9), 0.0, 0.06 * Math.cos(i * 0.7));
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      dummy.matrix.toArray(bellMatArr, i * 16);

      bellParamsArr[i * 4 + 0] = i;        // bellIndex
      bellParamsArr[i * 4 + 1] = i * 0.55; // phaseOffset
      bellParamsArr[i * 4 + 2] = scale;    // baseScale
      bellParamsArr[i * 4 + 3] = 1.8;      // pulseSpeed
    }

    instBellGeo.setAttribute('iModelMatrix', new THREE.InstancedBufferAttribute(bellMatArr, 16));
    instBellGeo.setAttribute('iBellParams', new THREE.InstancedBufferAttribute(bellParamsArr, 4));

    const bellMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BELL_VERT,
      fragmentShader: BELL_FRAG,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const bellMesh = new THREE.Mesh(instBellGeo, bellMat);
    bellMesh.frustumCulled = false;
    creatureGroup.add(bellMesh);
    (ctx as any).__bellMat = bellMat;

    // 2. Slender Central Stem
    const stemGeo = new THREE.CylinderGeometry(0.016, 0.010, 4.2, 16, 32);
    const stemMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BELL_VERT,
      fragmentShader: BELL_FRAG,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.set(0.0, -0.2, 0.0);
    // creatureGroup.add(stemMesh);

    // 3. Cascading Filament Tentacles (Hundreds of Gossamer Waves)
    const tentBaseGeo = createTentacleGeometry(3.6, 48);
    const instTentGeo = new THREE.InstancedBufferGeometry();
    instTentGeo.index = tentBaseGeo.index;
    instTentGeo.attributes.position = tentBaseGeo.attributes.position!;
    instTentGeo.attributes.normal = tentBaseGeo.attributes.normal!;
    instTentGeo.attributes.uv = tentBaseGeo.attributes.uv!;

    const tentMatArr = new Float32Array(NUM_TENTACLES * 16);
    const tentParamsArr = new Float32Array(NUM_TENTACLES * 4);

    for (let i = 0; i < NUM_TENTACLES; i++) {
      const bellIdx = i % NUM_BELLS;
      const bellY = 1.4 - bellIdx * 0.52;
      const curveX = Math.sin(bellIdx * 0.45) * 0.25;
      const curveZ = Math.cos(bellIdx * 0.40) * 0.18;
      const subIdx = Math.floor(i / NUM_BELLS);
      const angle = (subIdx / 8.0) * Math.PI * 2.0 + bellIdx * 0.35;
      const radius = 0.42;
      const rootX = curveX + Math.cos(angle) * radius;
      const rootZ = curveZ + Math.sin(angle) * radius;
      const rootY = bellY - 0.20;

      dummy.position.set(rootX, rootY, rootZ);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dummy.matrix.toArray(tentMatArr, i * 16);

      tentParamsArr[i * 4 + 0] = rootX;
      tentParamsArr[i * 4 + 1] = rootZ;
      tentParamsArr[i * 4 + 2] = i * 0.35;
      tentParamsArr[i * 4 + 3] = 1.0;
    }

    instTentGeo.setAttribute('iModelMatrix', new THREE.InstancedBufferAttribute(tentMatArr, 16));
    instTentGeo.setAttribute('iTentParams', new THREE.InstancedBufferAttribute(tentParamsArr, 4));

    const tentMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: TENTACLE_VERT,
      fragmentShader: TENTACLE_FRAG,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const tentMesh = new THREE.Mesh(instTentGeo, tentMat);
    tentMesh.frustumCulled = false;
    creatureGroup.add(tentMesh);
    (ctx as any).__tentMat = tentMat;

    // 4. Bioluminescent Photophore Pearl Nodes
    const photoQuadGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const instPhotoGeo = new THREE.InstancedBufferGeometry();
    instPhotoGeo.index = photoQuadGeo.index;
    instPhotoGeo.attributes.position = photoQuadGeo.attributes.position!;

    const photoOrigArr = new Float32Array(NUM_PHOTOPHORES * 3);
    const photoParamsArr = new Float32Array(NUM_PHOTOPHORES * 4);

    for (let i = 0; i < NUM_PHOTOPHORES; i++) {
      if (i < NUM_BELLS * 4) {
        // Photophores inside swimming bells
        const bIdx = Math.floor(i / 4);
        const bY = 1.4 - bIdx * 0.52 + 0.12;
        const angle = (i % 4) * Math.PI * 0.5;
        photoOrigArr[i * 3 + 0] = Math.cos(angle) * 0.14;
        photoOrigArr[i * 3 + 1] = bY;
        photoOrigArr[i * 3 + 2] = Math.sin(angle) * 0.14;

        photoParamsArr[i * 4 + 0] = i * 0.45;
        photoParamsArr[i * 4 + 1] = 0.038; // size
        photoParamsArr[i * 4 + 2] = bIdx;
        photoParamsArr[i * 4 + 3] = 0.0;   // warm amber
      } else {
        // Photophores along tentacle strands
        const tIdx = (i - NUM_BELLS * 4) % NUM_TENTACLES;
        const angle = (tIdx / NUM_TENTACLES) * Math.PI * 2.0;
        const frac = (i - NUM_BELLS * 4) / (NUM_PHOTOPHORES - NUM_BELLS * 4);
        const y = -0.5 - frac * 3.2;
        const r = 0.28 + Math.sin(frac * 6.28) * 0.15;

        photoOrigArr[i * 3 + 0] = Math.cos(angle) * r;
        photoOrigArr[i * 3 + 1] = y;
        photoOrigArr[i * 3 + 2] = Math.sin(angle) * r;

        photoParamsArr[i * 4 + 0] = i * 0.55;
        photoParamsArr[i * 4 + 1] = 0.018; // tiny pearl
        photoParamsArr[i * 4 + 2] = frac * 6.0;
        photoParamsArr[i * 4 + 3] = (i % 2 === 0) ? 0.0 : 1.0;
      }
    }

    instPhotoGeo.setAttribute('iOrigin', new THREE.InstancedBufferAttribute(photoOrigArr, 3));
    instPhotoGeo.setAttribute('iParams', new THREE.InstancedBufferAttribute(photoParamsArr, 4));

    const photoMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PHOTO_VERT,
      fragmentShader: PHOTO_FRAG,
      uniforms: {
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const photoMesh = new THREE.Mesh(instPhotoGeo, photoMat);
    photoMesh.frustumCulled = false;
    creatureGroup.add(photoMesh);
    (ctx as any).__photoMat = photoMat;

    // 5. Pelagic Marine Snow
    const snowQuadGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const instSnowGeo = new THREE.InstancedBufferGeometry();
    instSnowGeo.index = snowQuadGeo.index;
    instSnowGeo.attributes.position = snowQuadGeo.attributes.position!;

    const snowOrigArr = new Float32Array(NUM_MARINE_SNOW * 3);
    const snowDriftArr = new Float32Array(NUM_MARINE_SNOW * 3);
    const snowParamsArr = new Float32Array(NUM_MARINE_SNOW * 4);

    for (let i = 0; i < NUM_MARINE_SNOW; i++) {
      snowOrigArr[i * 3 + 0] = Math.sin(i * 15.3) * 4.2;
      snowOrigArr[i * 3 + 1] = Math.cos(i * 27.1) * 4.5;
      snowOrigArr[i * 3 + 2] = Math.sin(i * 59.7) * 4.2;

      snowDriftArr[i * 3 + 0] = Math.sin(i * 3.3) * 0.03;
      snowDriftArr[i * 3 + 1] = -0.12 - (i % 4) * 0.04;
      snowDriftArr[i * 3 + 2] = Math.cos(i * 4.5) * 0.03;

      snowParamsArr[i * 4 + 0] = i * 0.4;
      snowParamsArr[i * 4 + 1] = 0.009 + (i % 4) * 0.006;
      snowParamsArr[i * 4 + 2] = 1.0;
      snowParamsArr[i * 4 + 3] = i * 0.83;
    }

    instSnowGeo.setAttribute('iOrigin', new THREE.InstancedBufferAttribute(snowOrigArr, 3));
    instSnowGeo.setAttribute('iDrift', new THREE.InstancedBufferAttribute(snowDriftArr, 3));
    instSnowGeo.setAttribute('iParams', new THREE.InstancedBufferAttribute(snowParamsArr, 4));

    const snowMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      uniforms: {
        time: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const snowMesh = new THREE.Mesh(instSnowGeo, snowMat);
    snowMesh.frustumCulled = false;
    creatureGroup.add(snowMesh);
    (ctx as any).__snowMat = snowMat;

    (ctx as any).__creatureGroup = creatureGroup;
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer } = ctx;
    const t = f.t;
    const progress = Math.min(1.0, Math.max(0.0, f.p));

    // Update 85mm Prime Camera Flight Rig
    ctx.updateCamera(t, progress);

    const creatureGroup = (ctx as any).__creatureGroup as THREE.Group;
    const bellMat = (ctx as any).__bellMat as THREE.RawShaderMaterial;
    const tentMat = (ctx as any).__tentMat as THREE.RawShaderMaterial;
    const photoMat = (ctx as any).__photoMat as THREE.RawShaderMaterial;
    const snowMat = (ctx as any).__snowMat as THREE.RawShaderMaterial;

    // 1. Update Uniforms
    bellMat.uniforms.camPos.value.copy(ctx.threeCam.position);
    bellMat.uniforms.time.value = t;

    tentMat.uniforms.camPos.value.copy(ctx.threeCam.position);
    tentMat.uniforms.time.value = t;

    photoMat.uniforms.time.value = t;
    snowMat.uniforms.time.value = t;

    // 2. Render Deep Pelagic Trench Scene
    renderer.setRenderTarget(out);
    // Velvet midnight indigo trench background
    renderer.setClearColor(new THREE.Color(0.0018, 0.003, 0.008), 1.0);
    renderer.clear(true, true, true);

    const mainScene = new THREE.Scene();
    mainScene.add(creatureGroup);
    renderer.render(mainScene, ctx.threeCam);

    renderer.resetState();

    return {
      bloom: 0.22,
      bloomThreshold: 1.10, // Only intense photophore beads bloom, bells stay deep and rich
      ca: 0.012,
      hud: 0.0,
      frame: 0.0,
      metricReadout: 0.0,
    };
  },
});

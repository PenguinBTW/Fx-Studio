// SCENE 1: "THE GRAND HOROLOGY: PLATINUM, SAPPHIRE & PHOTOCHEMICAL SUN"
// 70mm Macro Anamorphic Cinematography (100mm Prime)
// Strictly Closed-Form Frame = f(t), Zero UI, Zero HUDs, Pure Photorealism

import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame, type PostOverrides } from '../../engine/scene';
import { FSPass, makeRT, W, H } from '../../engine/gl';

// -----------------------------------------------------------------------------
// 1. Horological PBR Shader (Analytical Studio Stage, Anglage, Côtes de Genève, Rubies)
// -----------------------------------------------------------------------------
const HOROLOGY_VERT = /* glsl */ `
precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HOROLOGY_FRAG = /* glsl */ `
precision highp float;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;

uniform vec3 camPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform float time;

// Material type:
// 0: Platinum / Rhodium (Côtes de Genève)
// 1: Brushed Titanium / Steel Bridge
// 2: 18k Yellow Gold (Balance Rim, Gears, Chatons)
// 3: Heat-Blued Steel (Screws, Studs)
// 4: Synthetic Ruby Jewel Bearing (Corundum Al2O3:Cr)
// 5: Perlage Grained Mainplate
uniform int uMatType;
uniform float uRoughness;

out vec4 fragColor;

#define PI 3.14159265359

// Analytical Studio Environment Reflection Model
// Simulates an elite horological photography studio with overhead softbox, lateral strip light, and velvet flags
vec3 evaluateStudioEnv(vec3 R, float roughness) {
  // 1. Overhead Main Softbox (Soft white gradient)
  vec3 softboxDir = normalize(vec3(0.15, 1.0, 0.25));
  float alignTop = max(dot(R, softboxDir), 0.0);
  float topLobe = pow(alignTop, mix(24.0, 3.5, roughness)) * 2.2;
  vec3 topColor = vec3(1.0, 0.98, 0.95) * topLobe;

  // 2. Lateral Grazing Strip Softbox (Warm tungsten rim defining beveled anglage edges)
  vec3 stripDir = normalize(vec3(0.85, 0.25, 0.45));
  float alignStrip = max(dot(R, stripDir), 0.0);
  float stripLobe = pow(alignStrip, mix(48.0, 6.0, roughness)) * 3.4;
  vec3 stripColor = vec3(1.0, 0.90, 0.78) * stripLobe;

  // 3. Secondary Rim Reflector (Cool silver bounce from left)
  vec3 rimDir = normalize(vec3(-0.9, 0.35, -0.2));
  float alignRim = max(dot(R, rimDir), 0.0);
  float rimLobe = pow(alignRim, mix(32.0, 4.0, roughness)) * 1.5;
  vec3 rimColor = vec3(0.85, 0.92, 1.0) * rimLobe;

  // 4. Velvet Black Studio Flags (High-contrast chiaroscuro)
  vec3 ambientDark = mix(vec3(0.012, 0.010, 0.009), vec3(0.045, 0.040, 0.038), max(0.0, R.y));

  return topColor + stripColor + rimColor + ambientDark;
}

// Thin-film temper colors for heat-blued steel
vec3 temperColor(float cosTheta) {
  float opd = 285.0 * (1.0 + 0.30 * cosTheta);
  vec3 phase = 2.0 * PI * opd / vec3(650.0, 530.0, 440.0);
  vec3 r = 0.5 + 0.5 * cos(phase);
  return mix(vec3(0.05, 0.22, 0.85), vec3(0.92, 0.62, 0.25), pow(r.r, 2.5));
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(camPos - vWorldPos);
  vec3 L = normalize(lightDir);
  vec3 H = normalize(L + V);
  vec3 R = reflect(-V, N);

  float NdotL = max(dot(N, L), 0.0);
  float NdotV = max(dot(N, V), 0.0);
  float VdotH = max(dot(V, H), 0.0);
  float NdotH = max(dot(N, H), 0.0);

  vec3 albedo = vec3(0.92);
  vec3 F0 = vec3(0.92);
  float roughness = uRoughness;
  float metalness = 1.0;
  float specularGlint = 0.0;

  if (uMatType == 0) {
    // Platinum / Rhodium with Côtes de Genève (Geneva Stripes)
    float stripe = sin(vWorldPos.x * 42.0 + sin(vWorldPos.z * 5.0) * 0.65);
    float genevaLuster = stripe * 0.25 + 0.82;
    F0 = vec3(0.92, 0.93, 0.96) * genevaLuster;
    roughness = 0.10;
  } else if (uMatType == 1) {
    // Brushed Titanium / Hand-finished Steel Bridge with Anglage
    F0 = vec3(0.85, 0.86, 0.90);
    roughness = 0.09;
    // Anglage chamfer razor-sharp ping
    specularGlint = pow(NdotH, 128.0) * 8.5;
  } else if (uMatType == 2) {
    // 18k Yellow Gold (Balance Wheel, Gear train, Chatons)
    F0 = vec3(1.02, 0.82, 0.35);
    albedo = vec3(1.0, 0.84, 0.36);
    roughness = 0.06;
    specularGlint = pow(NdotH, 96.0) * 6.0;
  } else if (uMatType == 3) {
    // Heat-Blued Steel (Screws, Studs, Hairspring)
    F0 = temperColor(NdotV);
    albedo = F0;
    roughness = 0.05;
    specularGlint = pow(NdotH, 128.0) * 7.0;
  } else if (uMatType == 4) {
    // Synthetic Ruby Jewel Bearing (Deep crimson corundum Al2O3:Cr)
    albedo = vec3(0.85, 0.02, 0.15);
    F0 = vec3(0.08); // Dielectric gem Fresnel
    metalness = 0.0;
    roughness = 0.03;
  } else if (uMatType == 5) {
    // Perlage Grained Mainplate (Circular engine-turned swirls)
    vec2 pGrid = fract(vWorldPos.xz * 12.0) - 0.5;
    float dist = length(pGrid);
    float swirl = sin(dist * 18.0 - atan(pGrid.y, pGrid.x) * 3.0);
    float perlLuster = swirl * 0.22 + 0.78;
    F0 = vec3(0.88, 0.89, 0.92) * perlLuster;
    roughness = 0.14;
  }

  // Fresnel-Schlick
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);

  // GGX Specular
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha;
  float denom = (NdotH * NdotH * (alpha2 - 1.0) + 1.0);
  float D = alpha2 / (PI * denom * denom + 1e-5);
  float G = 2.0 * NdotV * NdotL / (NdotV + NdotL + 1e-5);
  vec3 directSpec = (D * G * F / (4.0 * NdotV * NdotL + 1e-5)) * lightColor * NdotL * 4.5;

  // Environment specular reflection
  vec3 envLight = evaluateStudioEnv(R, roughness);
  vec3 envSpec = F * envLight;

  // Direct Diffuse (for non-metals like Ruby)
  vec3 diffuse = (1.0 - metalness) * albedo * (NdotL * (1.0 / PI) + 0.08);

  // Ruby subsurface transmission glow
  vec3 rubyEmission = vec3(0.0);
  if (uMatType == 4) {
    float rubySSS = exp(-1.8 * (1.0 - NdotV));
    rubyEmission = vec3(1.1, 0.04, 0.18) * (rubySSS * 2.8 + pow(max(dot(-N, L), 0.0), 3.0) * 1.5);
  }

  vec3 finalColor = diffuse + directSpec + envSpec + specularGlint * lightColor + rubyEmission;
  fragColor = vec4(finalColor, 1.0);
}
`;

// -----------------------------------------------------------------------------
// 2. Synthetic Optical Sapphire Ring Shader
// -----------------------------------------------------------------------------
const SAPPHIRE_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec3 vWorldPos;
out vec3 vNormal;

void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SAPPHIRE_FRAG = /* glsl */ `
precision highp float;
in vec3 vWorldPos;
in vec3 vNormal;
uniform vec3 camPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
out vec4 fragColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(camPos - vWorldPos);
  vec3 L = normalize(lightDir);
  vec3 H = normalize(L + V);

  float cosThetaI = max(dot(N, V), 0.0);
  float f0 = 0.077; // Sapphire n = 1.768
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosThetaI, 5.0);

  float spec = pow(max(dot(N, H), 0.0), 128.0) * 4.5;
  vec3 rimDisp = vec3(
    pow(1.0 - cosThetaI, 3.0) * 0.45,
    pow(1.0 - cosThetaI, 3.5) * 0.75,
    pow(1.0 - cosThetaI, 2.0) * 1.10
  );

  vec3 col = lightColor * spec + rimDisp * 0.65;
  float alpha = clamp(fresnel * 0.85 + spec * 0.35, 0.03, 0.65);
  fragColor = vec4(col, alpha);
}
`;

// -----------------------------------------------------------------------------
// 3. Hairspring Shader (Heat-Blued Steel Breathing Spiral)
// -----------------------------------------------------------------------------
const HAIRSPRING_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 normal;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
out vec3 vWorldPos;
out vec3 vNormal;

void main() {
  // Harmonic breathing of the Archimedean spiral spring:
  // 3.5 Hz oscillation
  float breath = 1.0 + 0.12 * sin(time * 22.0);
  vec3 p = position;
  p.xz *= breath;

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

// -----------------------------------------------------------------------------
// 4. Delicate 24k Gold Micro-Motes (Microscopic pinpoints, NOT donuts)
// -----------------------------------------------------------------------------
const MOTES_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec3 iOrigin;
in vec3 iDrift;
in vec4 iParams; // [phase, size, seed1, seed2]

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float time;
uniform float focalPlaneZ;

out vec2 vQuadPos;
out vec3 vColor;
out float vCoC;

vec3 curlNoise(vec3 p, float t) {
  float n1 = sin(p.y * 2.2 + t * 0.7) * cos(p.z * 2.2);
  float n2 = sin(p.z * 2.2 + t * 0.7) * cos(p.x * 2.2);
  float n3 = sin(p.x * 2.2 + t * 0.7) * cos(p.y * 2.2);
  return vec3(n1, n2, n3) * 0.08;
}

void main() {
  vQuadPos = position.xy * 2.0;
  float t = time;
  vec3 turb = curlNoise(iOrigin + iParams.w, t);
  vec3 worldPos = iOrigin + iDrift * sin(t * 0.4 + iParams.x) + turb;

  vec4 viewPos = modelViewMatrix * vec4(worldPos, 1.0);
  float depth = -viewPos.z;

  float distToFocus = abs(depth - focalPlaneZ);
  float coc = clamp(distToFocus * 0.25, 0.0, 1.4);
  vCoC = coc;

  float baseSize = iParams.y * (0.75 + coc * 1.2);
  viewPos.xy += position.xy * baseSize;

  vColor = vec3(1.0, 0.88, 0.45);
  gl_Position = projectionMatrix * viewPos;
}
`;

const MOTES_FRAG = /* glsl */ `
precision highp float;
in vec2 vQuadPos;
in vec3 vColor;
in float vCoC;
out vec4 fragColor;

void main() {
  float r2 = dot(vQuadPos, vQuadPos);
  if (r2 > 1.0) discard;

  float r = sqrt(r2);
  float core = exp(-r2 * 4.5);
  float rim = smoothstep(0.7, 0.95, r) * (0.5 + 0.5 * vCoC);
  float intensity = (core * 0.7 + rim * 0.8) / (1.0 + vCoC * 0.5);

  vec3 col = vColor * (intensity * 2.2);
  float alpha = clamp(core * 0.9 + rim * 0.35, 0.0, 0.85) / (1.0 + vCoC * 0.4);
  fragColor = vec4(col, alpha);
}
`;

// -----------------------------------------------------------------------------
// 5. Film Halation Post Pass
// -----------------------------------------------------------------------------
const HALATION_FRAG = /* glsl */ `
uniform sampler2D sceneTex;
uniform vec2 res;

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec4 base = texture(sceneTex, uv);
  vec3 c = base.rgb;

  vec3 halationAccum = vec3(0.0);
  vec2 texel = 1.0 / res;
  for (int i = -3; i <= 3; i++) {
    vec2 offset = vec2(float(i) * 2.5 * texel.x, 0.0);
    vec3 s = texture(sceneTex, uv + offset).rgb;
    float sLuma = dot(s, vec3(0.2126, 0.7152, 0.0722));
    if (sLuma > 2.0) {
      halationAccum += vec3(1.0, 0.28, 0.06) * (sLuma - 2.0) * 0.038;
    }
  }

  vec3 finalColor = c + halationAccum;
  fragColor = vec4(finalColor, 1.0);
}
`;

// -----------------------------------------------------------------------------
// Procedural Geometry Construction Helpers
// -----------------------------------------------------------------------------

// Creates an Archimedean spiral hairspring geometry
function createHairspringGeometry(turns: number, outerRadius: number, segments: number): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const totalAngle = turns * Math.PI * 2.0;
  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const theta = frac * totalAngle;
    const r = 0.04 + (frac * (outerRadius - 0.04));
    points.push(new THREE.Vector3(Math.cos(theta) * r, 0.0, Math.sin(theta) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, segments, 0.0055, 6, false);
}

// Creates an authentic Glucydur balance wheel with slender rim and 3 curved spokes
function createBalanceWheelGroup(materials: { gold: THREE.Material; screw: THREE.Material }): THREE.Group {
  const group = new THREE.Group();

  // 1. Slender outer rim
  const rimGeo = new THREE.TorusGeometry(0.72, 0.022, 16, 64);
  const rimMesh = new THREE.Mesh(rimGeo, materials.gold);
  rimMesh.rotation.x = Math.PI * 0.5;
  group.add(rimMesh);

  // 2. Central Collet (hub)
  const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 64);
  hubGeo.computeVertexNormals();
  const hubMesh = new THREE.Mesh(hubGeo, materials.gold);
  group.add(hubMesh);

  // 3. Three curved counterpoise spokes
  for (let s = 0; s < 3; s++) {
    const angle = (s / 3.0) * Math.PI * 2.0;
    const spokeGeo = new THREE.BoxGeometry(0.66, 0.016, 0.032);
    const spokeMesh = new THREE.Mesh(spokeGeo, materials.gold);
    spokeMesh.position.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35);
    spokeMesh.rotation.y = -angle;
    group.add(spokeMesh);
  }

  // 4. 12 Gold Timing Screws on the perimeter
  const screwGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.045, 12);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12.0) * Math.PI * 2.0;
    const screwMesh = new THREE.Mesh(screwGeo, materials.screw);
    screwMesh.position.set(Math.cos(angle) * 0.74, 0, Math.sin(angle) * 0.74);
    screwMesh.rotation.x = Math.PI * 0.5;
    screwMesh.rotation.z = -angle;
    group.add(screwMesh);
  }

  return group;
}

// Creates an authentic beveled balance cock (bridge) with 3D chamfered anglage
function createBalanceBridge(materials: { steel: THREE.Material; ruby: THREE.Material; gold: THREE.Material; screw: THREE.Material }): THREE.Group {
  const group = new THREE.Group();

  // 1. Arched Cantilever Bridge Shape
  const shape = new THREE.Shape();
  shape.moveTo(0.0, -0.22);
  shape.lineTo(0.55, -0.18);
  shape.bezierCurveTo(0.85, -0.12, 1.10, 0.15, 1.25, 0.45);
  shape.lineTo(1.15, 0.75);
  shape.bezierCurveTo(0.95, 0.45, 0.65, 0.18, 0.25, 0.10);
  shape.lineTo(0.0, 0.22);
  shape.absarc(0.0, 0.0, 0.22, Math.PI * 0.5, Math.PI * 1.5, false);

  const extrudeSettings = {
    steps: 1,
    depth: 0.05,
    curveSegments: 64,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 6,
  };

  const bridgeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  bridgeGeo.center();
  bridgeGeo.computeVertexNormals();
  const bridgeMesh = new THREE.Mesh(bridgeGeo, materials.steel);
  bridgeMesh.rotation.x = Math.PI * 0.5;
  bridgeMesh.position.set(0.48, 0.08, 0.0);
  group.add(bridgeMesh);

  // 2. 18k Yellow Gold Jewel Chaton in the center
  const chatonGeo = new THREE.TorusGeometry(0.095, 0.024, 24, 48);
  const chatonMesh = new THREE.Mesh(chatonGeo, materials.gold);
  chatonMesh.rotation.x = Math.PI * 0.5;
  chatonMesh.position.set(0.0, 0.14, 0.0);
  group.add(chatonMesh);

  // 3. Synthetic Pigeon-Blood Ruby Pivot Jewel
  const rubyGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.028, 48);
  const rubyMesh = new THREE.Mesh(rubyGeo, materials.ruby);
  rubyMesh.position.set(0.0, 0.14, 0.0);
  group.add(rubyMesh);

  // 4. Heat-Blued Screws securing the bridge
  const screwGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.04, 24);
  const screw1 = new THREE.Mesh(screwGeo, materials.screw);
  screw1.position.set(0.95, 0.13, 0.28);
  group.add(screw1);

  const screw2 = new THREE.Mesh(screwGeo, materials.screw);
  screw2.position.set(0.85, 0.13, -0.22);
  group.add(screw2);

  return group;
}

// Creates an authentic skeletonized brass/gold gear with cut teeth and beveled arms
function createSkeletonGear(radius: number, teeth: number, spokeCount: number, mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();

  // Outer toothed rim
  const rimGeo = new THREE.TorusGeometry(radius, 0.022, 12, 48);
  const rimMesh = new THREE.Mesh(rimGeo, mat);
  rimMesh.rotation.x = Math.PI * 0.5;
  group.add(rimMesh);

  // Hub
  const hubGeo = new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, 0.035, 24);
  const hubMesh = new THREE.Mesh(hubGeo, mat);
  group.add(hubMesh);

  // Spokes
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2.0;
    const spokeLen = radius * 0.85;
    const spokeGeo = new THREE.BoxGeometry(spokeLen, 0.018, 0.024);
    const spoke = new THREE.Mesh(spokeGeo, mat);
    spoke.position.set(Math.cos(angle) * (spokeLen * 0.5), 0, Math.sin(angle) * (spokeLen * 0.5));
    spoke.rotation.y = -angle;
    group.add(spoke);
  }

  // Teeth studs along rim
  const toothGeo = new THREE.BoxGeometry(0.035, 0.022, 0.022);
  for (let t = 0; t < teeth; t++) {
    const angle = (t / teeth) * Math.PI * 2.0;
    const tooth = new THREE.Mesh(toothGeo, mat);
    tooth.position.set(Math.cos(angle) * (radius + 0.015), 0, Math.sin(angle) * (radius + 0.015));
    tooth.rotation.y = -angle;
    group.add(tooth);
  }

  return group;
}

// -----------------------------------------------------------------------------
// Scene Definition: The Grand Horology
// -----------------------------------------------------------------------------
export default defineScene({
  id: 'grand_horology',
  duration: 12.0,

  setup: (ctx: SceneContext) => {
    const { renderer, W, H } = ctx;

    // 100mm Anamorphic Prime Macro Lens Rig
    ctx.rig.setLensMm(100);
    ctx.rig.setPath([
      // t = 0.0s: Dramatic macro skimming across oscillating balance wheel and hairspring
      { t: 0.00, pos: [1.35, 0.65, 2.25],  target: [0.0, 0.08, 0.0], roll: -0.01, focalLength: 95 },
      // t = 3.0s: Gliding closer past 18k gold chaton and ruby bearing catching tungsten sun
      { t: 0.25, pos: [0.95, 0.55, 1.95],  target: [0.0, 0.10, 0.0], roll:  0.02, focalLength: 100 },
      // t = 6.0s: Lateral sweep framing escape wheel and intermediate gear train with softbox glints
      { t: 0.50, pos: [0.35, 0.50, 1.85],  target: [-0.15, 0.08, 0.0], roll: -0.02, focalLength: 100 },
      // t = 9.0s: Tracking heat-blued screws and beveled anglage bridge edge
      { t: 0.75, pos: [-0.55, 0.52, 2.05], target: [0.0, 0.10, 0.0], roll:  0.01, focalLength: 100 },
      // t = 12.0s: Aligning optical axis for anamorphic lens deconstruction transition
      { t: 1.00, pos: [0.0, 0.60, 2.30],   target: [0.0, 0.10, 0.0], roll:  0.00, focalLength: 95 },
    ]);

    // -------------------------------------------------------------------------
    // Create Horology Materials
    // -------------------------------------------------------------------------
    const createShaderMat = (matType: number, roughness: number) => {
      return new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: HOROLOGY_VERT,
        fragmentShader: HOROLOGY_FRAG,
        uniforms: {
          camPos: { value: new THREE.Vector3() },
          lightDir: { value: new THREE.Vector3(1.2, 0.45, 0.75).normalize() },
          lightColor: { value: new THREE.Vector3(1.0, 0.94, 0.85) },
          time: { value: 0.0 },
          uMatType: { value: matType },
          uRoughness: { value: roughness },
        },
        depthWrite: true,
        depthTest: true,
      });
    };

    const matPlat = createShaderMat(0, 0.10);     // Platinum Côtes de Genève
    const matSteel = createShaderMat(1, 0.08);    // Brushed Steel with Anglage
    const matGold = createShaderMat(2, 0.05);     // 18k Yellow Gold
    const matBlued = createShaderMat(3, 0.04);    // Heat-Blued Steel
    const matRuby = createShaderMat(4, 0.03);     // Synthetic Pigeon-Blood Ruby
    const matPerlage = createShaderMat(5, 0.12);  // Mainplate Perlage

    (ctx as any).__allHorologyMats = [matPlat, matSteel, matGold, matBlued, matRuby, matPerlage];

    // Master 3D Group
    const horologyGroup = new THREE.Group();

    // 1. Multi-tiered Mainplate with Circular Perlage Sinks
    const mainplateGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.15, 64);
    const mainplateMesh = new THREE.Mesh(mainplateGeo, matPerlage);
    mainplateMesh.position.y = -0.12;
    horologyGroup.add(mainplateMesh);

    // Three-quarter Bridge Plate (Platinum with Côtes de Genève)
    const bridgePlateGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.06, 64, 1, false, 0, Math.PI * 1.35);
    const bridgePlateMesh = new THREE.Mesh(bridgePlateGeo, matPlat);
    bridgePlateMesh.position.set(0.0, -0.02, 0.0);
    horologyGroup.add(bridgePlateMesh);

    // 2. The Balance Assembly
    const balanceGroup = createBalanceWheelGroup({ gold: matGold, screw: matSteel });
    balanceGroup.position.set(0.0, 0.05, 0.0);
    horologyGroup.add(balanceGroup);
    (ctx as any).__balanceGroup = balanceGroup;

    // 3. The Archimedean Spiral Hairspring
    const hairspringGeo = createHairspringGeometry(9.5, 0.62, 280);
    const hairspringMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: HAIRSPRING_VERT,
      fragmentShader: HOROLOGY_FRAG,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        lightDir: { value: new THREE.Vector3(1.2, 0.45, 0.75).normalize() },
        lightColor: { value: new THREE.Vector3(1.0, 0.94, 0.85) },
        time: { value: 0.0 },
        uMatType: { value: 3 }, // Heat-blued steel
        uRoughness: { value: 0.04 },
      },
      depthWrite: true,
      depthTest: true,
    });
    const hairspringMesh = new THREE.Mesh(hairspringGeo, hairspringMat);
    hairspringMesh.position.set(0.0, 0.055, 0.0);
    horologyGroup.add(hairspringMesh);
    (ctx as any).__hairspringMat = hairspringMat;

    // 4. The Balance Bridge (Cock) with Beveled Anglage
    const balanceBridge = createBalanceBridge({ steel: matSteel, ruby: matRuby, gold: matGold, screw: matBlued });
    horologyGroup.add(balanceBridge);

    // 5. Escapement & Gear Train Assembly
    // Escape Wheel (stepped tick)
    const escapeWheel = createSkeletonGear(0.38, 15, 4, matSteel);
    escapeWheel.position.set(-0.75, 0.02, 0.45);
    horologyGroup.add(escapeWheel);
    (ctx as any).__escapeWheel = escapeWheel;

    // Third Wheel (18k Gold)
    const thirdWheel = createSkeletonGear(0.62, 32, 5, matGold);
    thirdWheel.position.set(-0.55, -0.03, -0.65);
    horologyGroup.add(thirdWheel);
    (ctx as any).__thirdWheel = thirdWheel;

    // Fourth Wheel (Centre second wheel)
    const fourthWheel = createSkeletonGear(0.78, 44, 5, matPlat);
    fourthWheel.position.set(0.65, -0.04, -0.75);
    horologyGroup.add(fourthWheel);
    (ctx as any).__fourthWheel = fourthWheel;

    // Additional Ruby Jewel Bearings set across the plates
    const rubyGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.022, 24);
    const chatonGeo = new THREE.TorusGeometry(0.075, 0.02, 12, 24);
    const rubyPositions = [
      [-0.75, 0.03, 0.45],
      [-0.55, -0.02, -0.65],
      [0.65, -0.03, -0.75],
      [1.15, 0.02, 0.35],
      [-1.10, 0.02, -0.25],
    ];

    rubyPositions.forEach(([rx, ry, rz]) => {
      const chaton = new THREE.Mesh(chatonGeo, matGold);
      chaton.position.set(rx, ry, rz);
      chaton.rotation.x = Math.PI * 0.5;
      horologyGroup.add(chaton);

      const ruby = new THREE.Mesh(rubyGeo, matRuby);
      ruby.position.set(rx, ry, rz);
      horologyGroup.add(ruby);
    });

    // Heat-blued screws holding the plates
    const screwGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.03, 16);
    const screwPositions = [
      [1.4, 0.015, 0.8],
      [-1.3, 0.015, 0.9],
      [0.2, 0.015, -1.5],
      [-1.4, 0.015, -1.1],
      [1.6, 0.015, -0.6],
    ];
    screwPositions.forEach(([sx, sy, sz]) => {
      const screw = new THREE.Mesh(screwGeo, matBlued);
      screw.position.set(sx, sy, sz);
      horologyGroup.add(screw);
    });

    (ctx as any).__horologyGroup = horologyGroup;

    // -------------------------------------------------------------------------
    // Synthetic Optical Sapphire Ring
    // -------------------------------------------------------------------------
    const sapphireGeo = new THREE.TorusGeometry(2.35, 0.055, 24, 64);
    const sapphireMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SAPPHIRE_VERT,
      fragmentShader: SAPPHIRE_FRAG,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        lightDir: { value: new THREE.Vector3(1.2, 0.45, 0.75).normalize() },
        lightColor: { value: new THREE.Vector3(1.0, 0.94, 0.85) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sapphireMesh = new THREE.Mesh(sapphireGeo, sapphireMat);
    sapphireMesh.position.set(0, 0.12, 0);
    sapphireMesh.rotation.set(Math.PI * 0.5, 0, 0);
    (ctx as any).__sapphireMesh = sapphireMesh;

    // -------------------------------------------------------------------------
    // Suspended 24k Gold Micro-Motes Field (Delicate pinpoints)
    // -------------------------------------------------------------------------
    const NUM_GOLD_MOTES = 384;
    const motesQuadGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const instMotesGeo = new THREE.InstancedBufferGeometry();
    instMotesGeo.index = motesQuadGeo.index;
    instMotesGeo.attributes.position = motesQuadGeo.attributes.position!;

    const mOrigArr = new Float32Array(NUM_GOLD_MOTES * 3);
    const mDriftArr = new Float32Array(NUM_GOLD_MOTES * 3);
    const mParamsArr = new Float32Array(NUM_GOLD_MOTES * 4);

    for (let i = 0; i < NUM_GOLD_MOTES; i++) {
      mOrigArr[i * 3 + 0] = Math.sin(i * 12.3) * 2.2;
      mOrigArr[i * 3 + 1] = 0.05 + Math.cos(i * 19.1) * 0.9;
      mOrigArr[i * 3 + 2] = Math.sin(i * 47.7) * 2.2;

      mDriftArr[i * 3 + 0] = Math.sin(i * 3.1) * 0.12;
      mDriftArr[i * 3 + 1] = Math.cos(i * 4.3) * 0.08;
      mDriftArr[i * 3 + 2] = Math.sin(i * 5.7) * 0.12;

      mParamsArr[i * 4 + 0] = i * 0.35;
      mParamsArr[i * 4 + 1] = 0.0035 + (i % 4) * 0.0018; // Microscopic pinpoints
      mParamsArr[i * 4 + 2] = 1.0;
      mParamsArr[i * 4 + 3] = i * 0.81;
    }

    const atMoOrig = new THREE.InstancedBufferAttribute(mOrigArr, 3);
    const atMoDrift = new THREE.InstancedBufferAttribute(mDriftArr, 3);
    const atMoP = new THREE.InstancedBufferAttribute(mParamsArr, 4);
    atMoOrig.setUsage(THREE.StaticDrawUsage);
    atMoDrift.setUsage(THREE.StaticDrawUsage);
    atMoP.setUsage(THREE.StaticDrawUsage);

    instMotesGeo.setAttribute('iOrigin', atMoOrig);
    instMotesGeo.setAttribute('iDrift', atMoDrift);
    instMotesGeo.setAttribute('iParams', atMoP);

    const motesMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MOTES_VERT,
      fragmentShader: MOTES_FRAG,
      uniforms: {
        time: { value: 0.0 },
        focalPlaneZ: { value: 1.8 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const motesMesh = new THREE.Mesh(instMotesGeo, motesMat);
    motesMesh.frustumCulled = false;
    (ctx as any).__motesMesh = motesMesh;

    // -------------------------------------------------------------------------
    // Photochemical Film Halation Pass
    // -------------------------------------------------------------------------
    const halationPass = new FSPass(HALATION_FRAG, {
      sceneTex: { value: null },
      res: { value: new THREE.Vector2(W, H) },
    }, { blending: THREE.NoBlending });
    (ctx as any).__halationPass = halationPass;
    (ctx as any).__sceneRT = makeRT(W, H, { depthBuffer: true });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const { renderer } = ctx;
    const t = f.t;
    const progress = Math.min(1.0, Math.max(0.0, f.p));

    // Update 100mm Anamorphic Camera Flight Rig
    ctx.updateCamera(t, progress);

    const horologyGroup = (ctx as any).__horologyGroup as THREE.Group;
    const balanceGroup = (ctx as any).__balanceGroup as THREE.Group;
    const escapeWheel = (ctx as any).__escapeWheel as THREE.Group;
    const thirdWheel = (ctx as any).__thirdWheel as THREE.Group;
    const fourthWheel = (ctx as any).__fourthWheel as THREE.Group;
    const sapphireMesh = (ctx as any).__sapphireMesh as THREE.Mesh;
    const motesMesh = (ctx as any).__motesMesh as THREE.Mesh;
    const halationPass = (ctx as any).__halationPass as FSPass;
    const sceneRT = (ctx as any).__sceneRT as THREE.WebGLRenderTarget;

    // 1. Closed-Form Kinematic Rotations Frame = f(t)
    // 3.5 Hz harmonic Glucydur balance wheel oscillation
    balanceGroup.rotation.y = Math.sin(t * 22.0) * 1.35;

    // Escapement stepped ticking rotation
    escapeWheel.rotation.y = t * 4.2;
    thirdWheel.rotation.y = -t * 1.8;
    fourthWheel.rotation.y = t * 0.95;

    // 2. Update Uniforms
    const allMats = (ctx as any).__allHorologyMats as THREE.RawShaderMaterial[];
    for (const mat of allMats) {
      mat.uniforms.camPos.value.copy(ctx.threeCam.position);
      mat.uniforms.time.value = t;
    }

    const hsMat = (ctx as any).__hairspringMat as THREE.RawShaderMaterial;
    hsMat.uniforms.camPos.value.copy(ctx.threeCam.position);
    hsMat.uniforms.time.value = t;

    const sMat = sapphireMesh.material as THREE.RawShaderMaterial;
    sMat.uniforms.camPos.value.copy(ctx.threeCam.position);

    const mMat = motesMesh.material as THREE.RawShaderMaterial;
    mMat.uniforms.time.value = t;
    mMat.uniforms.focalPlaneZ.value = ctx.threeCam.position.length();

    // 3. Render 3D Scene to intermediate RT for Halation processing
    renderer.setRenderTarget(sceneRT);
    renderer.clear(true, true, true);

    const mainScene = new THREE.Scene();
    mainScene.add(horologyGroup);
    mainScene.add(sapphireMesh);
    mainScene.add(motesMesh);
    renderer.render(mainScene, ctx.threeCam);

    // 4. Apply Photochemical Film Halation Pass to final target
    halationPass.u.sceneTex.value = sceneRT.texture;
    halationPass.render(renderer, out);

    renderer.resetState();

    return {
      bloom: 0.18,
      bloomThreshold: 0.88,
      ca: 0.012,
      hud: 0.0,
      frame: 0.0,
      metricReadout: 0.0,
    };
  },
});

// GLSL fragment shader and routines for physical Depth-Based Depth of Field & Bokeh (P7b).

export const GLSL_DOF_HELPERS = /* glsl */ `
// Linearize non-linear WebGL perspective depth [0, 1] to eye-space distance z > 0
float linearizeDepth(float zBuffer, float near, float far) {
  return (near * far) / max(far - zBuffer * (far - near), 1e-7);
}

// Circle of Confusion diameter/radius in pixels
float calcCoC(float z, float focusDist, float aperture, float maxRadius) {
  if (z <= 0.0 || focusDist <= 0.0) return 0.0;
  float c = abs(1.0 - focusDist / z) * aperture;
  return clamp(c, 0.0, maxRadius);
}

// Bokeh aperture blade diaphragm evaluation (returns weight 0..1)
float evalBokehAperture(vec2 p, int blades, float anamorphicRatio) {
  p.x *= max(anamorphicRatio, 0.01);
  float r = length(p);
  if (r < 1e-5) return 1.0;
  if (blades < 3) {
    // Circular aperture with soft antialiased boundary
    return smoothstep(1.05, 0.95, r);
  }
  // Regular polygon with 'blades' sides aligned with vertex on x-axis
  float angle = atan(p.y, p.x);
  float n = float(blades);
  float segment = 6.283185307179586 / n;
  float halfSeg = segment * 0.5;
  float phi = mod(angle, segment) - halfSeg;
  float rPoly = (r * cos(phi)) / cos(halfSeg);
  return smoothstep(1.05, 0.95, rPoly);
}

// Interleaved Gradient Noise for blue-noise-like jitter (Jimenez 2014)
float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(floor(px), vec2(0.06711056, 0.00583715))));
}
`;

export const GLSL_DOF_FRAG = /* glsl */ `
uniform sampler2D colorTex;
uniform sampler2D depthTex;
uniform vec2 res;
uniform float focusDistance;
uniform float aperture;
uniform float maxRadius;
uniform int blades;
uniform float anamorphicRatio;
uniform float near;
uniform float far;
uniform int samples;

${GLSL_DOF_HELPERS}

void main() {
  vec4 centerCol = texture(colorTex, vUv);
  float centerZBuf = texture(depthTex, vUv).r;
  float centerZ = linearizeDepth(centerZBuf, near, far);
  float centerCoC = calcCoC(centerZ, focusDistance, aperture, maxRadius);

  // Early out if DoF is inactive
  if (aperture <= 0.001 || maxRadius <= 0.001) {
    fragColor = centerCol;
    return;
  }

  // IGN jitter per pixel to eliminate concentric banding
  float jitter = ign(gl_FragCoord.xy);

  vec3 accumCol = centerCol.rgb;
  float accumWeight = 1.0;

  int nSamples = clamp(samples, 8, 64);
  float fTotal = float(nSamples);

  // Vogel's spiral gather
  for (int i = 0; i < 64; i++) {
    if (i >= nSamples) break;
    float fi = float(i);
    float theta = fi * 2.39996323 + jitter * 6.283185307;
    float r = sqrt((fi + 0.5 + (jitter - 0.5) * 0.5) / fTotal);
    vec2 unitOffset = vec2(r * cos(theta), r * sin(theta));

    // Diaphragm aperture shape weight
    float shape = evalBokehAperture(unitOffset, blades, anamorphicRatio);
    if (shape <= 0.001) continue;

    vec2 pixelOffset = unitOffset * maxRadius;
    vec2 sampleUv = vUv + pixelOffset / res;

    // Check bounds
    if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) continue;

    vec4 sampleCol = texture(colorTex, sampleUv);
    float sampleZBuf = texture(depthTex, sampleUv).r;
    float sampleZ = linearizeDepth(sampleZBuf, near, far);
    float sampleCoC = calcCoC(sampleZ, focusDistance, aperture, maxRadius);

    float distPx = length(pixelOffset);

    // Depth-aware bilateral gather sampling:
    // - Foreground samples with distPx <= sampleCoC bleed OVER in-focus background.
    // - Background samples only contribute if the center pixel itself is blurred (distPx <= centerCoC),
    //   preventing background colors from bleeding onto sharp foreground silhouettes.
    float w = 0.0;
    if (sampleZ < centerZ - 0.05) {
      // Foreground sample bleeding over background
      float bleed = clamp((sampleCoC - distPx + 1.0) / 1.5, 0.0, 1.0);
      w = bleed * shape;
    } else {
      // Background sample
      float blur = clamp((centerCoC - distPx + 1.0) / 1.5, 0.0, 1.0);
      float depthDelta = max(0.0, sampleZ - centerZ);
      float depthAtten = clamp(1.0 - depthDelta / max(centerZ * 0.5, 1.0), 0.0, 1.0);
      w = blur * shape * depthAtten;
    }

    accumCol += sampleCol.rgb * w;
    accumWeight += w;
  }

  vec3 finalRgb = accumCol / max(accumWeight, 1e-5);
  fragColor = vec4(finalRgb, centerCol.a);
}
`;

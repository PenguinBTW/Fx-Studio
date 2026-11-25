// Verification harness for the optical chain (sky + atmosphere fog + godray shafts) —
// NOT a production scene. Fullscreen shader: procedural sky dome, two analytic light
// shafts composited with height-fog transmittance, ground plane with fog. Time-of-day
// sweeps dawn→dusk across the window so captures exercise multiple sun elevations.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame, type PostOverrides } from '../../../engine/scene';
import { FSPass } from '../../../engine/gl';
import { SKY_GLSL } from '../../../engine/sky';
import { ATMOSPHERE_GLSL } from '../../../engine/atmosphere';
import { SHAFT_GLSL } from '../../../engine/godrays';
import { sunPosition } from '../../../engine/sky';

const FRAG = /* glsl */ `
${SKY_GLSL}
${ATMOSPHERE_GLSL}
${SHAFT_GLSL}
uniform vec3 sunDir;
uniform vec3 camPos;


vec3 shaftContrib(vec3 omega, vec3 apex, vec3 dir, float cosA, float len, float density, vec3 color) {
  vec2 seg = shaftRaySegment(apex, dir, cosA, len, camPos, omega);
  if (omega.y < -1e-6) { float tG = -camPos.y / omega.y; if (seg.x >= 0.0) seg.y = min(seg.y, tG); if (seg.y <= seg.x) seg = vec2(-1.0); }
  if (seg.x < 0.0) return vec3(0.0);
  float pathLen = seg.y - seg.x;
  float tm = (seg.x + seg.y) * 0.5;
  vec3 mid = camPos + omega * tm;
  vec3 co = mid - apex;
  float axial = dot(co, dir);
  float radial = length(co - dir * axial);
  float coneR = max(1e-6, axial * sqrt(1.0 - cosA * cosA) / cosA);
  float rr = min(1.0, radial / coneR);
  float edge = 0.5 + 0.5 * cos(3.14159265 * rr); // closed-form cosine density profile
  float axialFade = 1.0 - clamp(axial / len, 0.0, 1.0) * 0.6;
  float T = fogTransmittance(camPos.y, mid.y, tm, 0.015, 0.08);
  return color * density * pathLen * edge * axialFade * T;
}

void main() {
  vec2 ndc = (FRAG_PX / vec2(1920.0, 1080.0)) * 2.0 - 1.0;
  vec3 omega = normalize(vec3(ndc.x * 1.78, ndc.y + 0.35, 2.2)); // face south: the sun arc crosses the frame
  vec3 col = skyRadiance(omega, sunDir, 2.0);
  float disc = sunDisc(omega, sunDir, 0.0047, 40.0);
  col += vec3(disc, disc * 0.95, disc * 0.85);
  // ground plane: simple dark reference surface with fog
  if (omega.y < 0.0) {
    float tGround = -camPos.y / omega.y;
    vec3 gp = camPos + omega * tGround;
    float T = fogTransmittance(camPos.y, gp.y, tGround, 0.015, 0.08);
    vec3 groundCol = vec3(0.05, 0.07, 0.05) * (0.4 + 0.6 * max(0.0, sunDir.y));
    vec3 fogCol = skyRadiance(normalize(vec3(omega.x, 0.02, omega.z)), sunDir, 2.0) * 0.9;
    col = groundCol * T + fogCol * (1.0 - T);
  }
  // two shafts angled from the sun direction
  vec3 sd = normalize(-sunDir);
  col += shaftContrib(omega, sunDir * 60.0 + vec3(6.0, 0.0, 0.0), sd, cos(0.06), 80.0, 0.012, vec3(1.0, 0.9, 0.75));
  col += shaftContrib(omega, sunDir * 60.0 + vec3(-9.0, 0.0, 4.0), sd, cos(0.045), 80.0, 0.016, vec3(1.0, 0.88, 0.7));
  fragColor = vec4(col, 1.0);
}
`;

export default defineScene({
  id: 'optics_sheet',
  setup: (ctx: SceneContext) => {
    (ctx as any).__opticsPass = new FSPass(FRAG, {
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      camPos: { value: new THREE.Vector3(0, 1.7, 0) },
    });
  },
  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const pass = (ctx as any).__opticsPass as FSPass;
    // sweep time-of-day across the window: hour 7 → 19 over 10s
    const hour = 7 + (f.t / 10) * 12;
    const sp = sunPosition(hour, 52, 5);
    (pass.u.sunDir!.value as THREE.Vector3).set(...sp.dir);
    pass.render(ctx.renderer, out);
    ctx.renderer.resetState();
  },
});

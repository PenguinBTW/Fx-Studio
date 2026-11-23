// ff_pore: radiolarian -> salt crystal. We dive through one hexagonal pore: one exponential zoom drives the skeleton
// rushing past the lens and the crystal face growing inside the aperture at the same rate, ringed by a Rheinberg
// magenta/gold rim.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
float hexD(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.732))), p.x); }
void main() { vec2 p = P(); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = 0.035 * z; float h = hexD(p) / R; vec3 A = radialA(p, 1.0 + 0.4 * e, 0.2 * e) * (1.0 - 0.3 * e);
  vec3 B = tapB(p, diveS(R)); float m = smoothstep(1.0, 0.9, h); float rim = exp(-pow((h - 1.0) * 14.0, 2.0));
  vec3 c = mix(A, B, m) + mix(vec3(1.0, 0.7, 0.15), vec3(1.0, 0.1, 0.7), smoothstep(0.0, 1.0, length(p))) * rim * 1.2 * (1.0 - e * e); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

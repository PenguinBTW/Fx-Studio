// ff_ion: salt crystal -> sodium atom. We dive into the Na+ ion at the end of the corridor: one exponential zoom drives
// the lattice rushing past and the atom growing out of the ion at the same rate, spectral shells (one per orbital)
// rippling out ahead of it.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float r = length(p); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = 0.035 * z;
  vec3 A = radialA(p, 1.0 + 0.4 * e, 0.15 * e) * (1.0 - 0.3 * e); vec3 B = tapB(p, diveS(R)); float m = smoothstep(R, R * 0.85, r); float ring = 0.0;
  for (int i = 0; i < 3; i++) ring += exp(-pow((r - R * (1.15 + 0.35 * float(i))) / (0.01 + 0.03 * R), 2.0));
  vec3 sp = 0.5 + 0.5 * cos(6.2831 * (r * 1.5 - u + vec3(0.0, 0.33, 0.67))); vec3 c = mix(A, B, m) + sp * ring * 0.5 * (1.0 - e); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

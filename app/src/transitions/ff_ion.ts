// ff_ion: salt crystal -> sodium atom. The Na+ ion at the centre of the corridor swells into its electron cloud:
// spectral shells ripple out from it (one ring per orbital), A pushing through while B's orbitals bloom inside.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float r = length(p); float R = u * 1.6; vec3 A = tapA(p, 1.0 + 1.5 * u * u); vec3 B = tapB(p, mix(0.8, 1.0, u));
  float m = smoothstep(R, R - 0.25, r); float ring = 0.0; for (int i = 0; i < 3; i++) ring += exp(-pow((r - R * (0.4 + 0.3 * float(i))) * 30.0, 2.0));
  vec3 sp = 0.5 + 0.5 * cos(6.2831 * (r * 1.5 - u + vec3(0.0, 0.33, 0.67))); vec3 c = mix(A, B, m) + sp * ring * 0.5 * (1.0 - u); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

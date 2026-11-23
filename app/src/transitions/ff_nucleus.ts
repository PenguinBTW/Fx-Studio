// ff_nucleus: atom -> quark. On the shared dive camera the nucleon at the centre goes white-hot and opens at the zoom
// rate; A keeps its own descent under a radial speed smear, and the proton's interior blooms through the core at
// matched scale, tone-compressed mid-seam so the nucleons keep their form instead of clipping.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float r = length(p); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = diveR(z);
  vec3 A = radialA(p, 1.0 + 0.6 * e, 0.3 * e);
  vec3 B = tapB(p, diveS(R)); B = mix(B / (1.0 + 1.5 * dot(B, vec3(0.3, 0.5, 0.2))) * 0.6, B, e * e); float m = max(smoothstep(R, R * 0.8, r), smoothstep(0.85, 1.0, u));
  float core = exp(-sq((r - R) / (0.01 + 0.06 * R))) * (1.0 - e) + exp(-r * r / (0.001 + 0.02 * R)) * sin(3.14159 * u);
  vec3 c = mix(A, B, m) + vec3(1.4, 1.0, 1.2) * core * 0.6; gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

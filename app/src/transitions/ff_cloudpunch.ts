// ff_cloudpunch: orbit -> storm. On the shared dive camera we punch through a gap in the cloud deck: the orbit keeps
// its own descent while a billowed, fbm-edged opening grows from the dive point at the zoom rate, the storm inside it
// at matched scale, a lightning flash lighting the deck from within.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float e = smoothstep(0.0, 1.0, u); float z = diveZ(e); float R = diveR(z); vec3 A = radialA(p, 1.0 + 0.5 * e, 0.15 * e);
  float n = fftf(p * 3.0 / (0.2 + R) + uT * 0.2); float d = length(p) / R + 0.6 * (n - 0.5);
  float m = max(smoothstep(1.05, 0.8, d), smoothstep(0.85, 1.0, u)); vec3 B = tapB(p, diveS(R)); float rim = exp(-pow((d - 0.95) * 5.0, 2.0)) * (1.0 - e);
  float fl = exp(-pow((u - 0.55) * 8.0, 2.0)); vec3 c = mix(A, B, m) + vec3(0.6, 0.5, 1.2) * rim * 0.5 + vec3(0.7, 0.75, 1.3) * fl * 0.15 * m;
  gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

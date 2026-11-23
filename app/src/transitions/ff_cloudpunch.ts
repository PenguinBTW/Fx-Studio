// ff_cloudpunch: orbit -> storm. The aurora view keeps zooming with radial blur while billowed cloud tops rush over the
// lens (fbm mask growing from the dive point), a lightning flash lights the deck from inside as the storm takes over.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float s = exp(u * 1.6); vec3 A = radialA(p, s, 0.15 * u);
  vec3 B = tapB(p, exp(-(1.0 - u) * 1.1)); float n = fftf(p * 3.0 / s + uT * 0.2) + 0.35 * (1.0 - length(p));
  float m = smoothstep(1.05 - u * 1.3, 1.15 - u * 1.3, n); float rim = smoothstep(0.0, 0.5, m) * (1.0 - smoothstep(0.5, 1.0, m));
  float fl = exp(-pow((u - 0.55) * 8.0, 2.0)); vec3 c = mix(A, B, m) + vec3(0.6, 0.5, 1.2) * rim * 0.6 + vec3(0.7, 0.75, 1.3) * fl * 0.45 * m;
  gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

// ff_biolum: plankton -> radiolarian. Every cell fires at once (bright cyan bloom on A's highlights) while the camera
// pushes; the skeleton condenses out of the glow from its own centre, scale-matched (B grows 0.6x -> 1x).
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); vec3 A = tapA(p, 1.0 + 0.8 * u); float la = dot(A, vec3(0.3, 0.6, 0.1)); A += vec3(0.2, 0.9, 1.3) * smoothstep(0.2, 0.9, la) * 1.4 * sin(3.14159 * min(1.0, u * 1.4));
  vec3 B = tapB(p, 1.0); float m = smoothstep(0.35, 0.75, u + 0.25 * (fftf(p * 4.0) - 0.5) - 0.2 * length(p));
  float fl = exp(-pow((u - 0.45) * 5.0, 2.0)); vec3 c = mix(A, B, m) + vec3(0.3, 0.8, 1.2) * fl * 0.12; gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });

// ff_lens: raindrop -> plankton. We fall into the drop: inside a growing refracting disc the plankton world appears
// barrel-distorted with dispersion (each channel through its own IOR), the rim catching a rainbow, until it fills the frame.
import { ffTransition, TG } from '../scenes/freefall/tkit';
export default ffTransition(`${TG}
void main() { vec2 p = P(); float R = mix(0.55, 1.4, smoothstep(0.0, 1.0, u)); float r = length(p) / R; vec3 A = tapA(p, 1.0 + 0.6 * u);
  vec3 B = vec3(0.0); if (r < 1.0) { float k = sqrt(1.0 - r * r); for (int c = 0; c < 3; c++) { float ior = 0.6 + 0.1 * float(c); vec2 q = p * mix(ior, 1.0, u * u) * (0.6 + 0.4 * k); B[c] = tapB(q, 1.0)[c]; } }
  float m = smoothstep(1.0, 0.97, r); float rim = exp(-pow((r - 0.985) * 40.0, 2.0)); vec3 rb = 0.5 + 0.5 * cos(6.2831 * (atan(p.y, p.x) / 6.2831 * 2.0 + vec3(0.0, 0.33, 0.67)));
  vec3 c = mix(A, B, m) + rb * rim * 0.8 * (1.0 - u); gl_FragColor = vec4(c, 1.0); }`, { dur: 0.8 });
